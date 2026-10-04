from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4
from urllib.parse import urlencode
import json
import time
import httpx

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, or_, func, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from .auth import COOKIE_NAME, Identity, current_identity, require_identity, check_origin, verify_token, decode_segment
from .config import settings
from .database import Base, engine, get_session
from .models import Flashcard, FlashcardSet, PictureUpload
from .schemas import CardInput, CardOutput, ReorderInput, SetDetail, SetInput, SetOutput

settings.upload_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app):
    if settings.initialize_schema:
        Base.metadata.create_all(engine)
    yield


app = FastAPI(title='Kids Flashcards API', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=['*'], allow_headers=['*'], allow_credentials=True)


@app.middleware('http')
async def private_responses(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.removeprefix(request.scope.get('root_path', '')).startswith(('/api/auth', '/api/sets', '/api/uploads', '/uploads')):
        response.headers['Cache-Control'] = 'private, no-store'
        response.headers['Vary'] = 'Origin, Cookie, Authorization'
    return response


@app.exception_handler(OperationalError)
async def database_unavailable(request, error):
    return JSONResponse(status_code=503, content={'detail': 'Database unavailable. Check local PostgreSQL and try again.'})


class SessionInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(min_length=1, max_length=16384)


@app.get('/api/auth/config')
def auth_config():
    query = urlencode({'applicationId': settings.life2_application_id, 'redirect': settings.life2_callback_url})
    return {'signInUrl': f'{settings.life2_auth_url}/signIn?{query}', 'exchangeUrl': '/api/auth/exchange'}


class ExchangeInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    code: str = Field(pattern=r'^[A-Za-z0-9_-]{43}$', min_length=43, max_length=43)


@app.post('/api/auth/exchange')
async def exchange_login(payload: ExchangeInput, request: Request):
    check_origin(request)
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            result = await client.post(f'{settings.life2_auth_url}/api/login/exchange',
                                       json={'code': payload.code}, headers={'Origin': request.headers['origin']})
        if result.status_code == 400:
            raise HTTPException(400, 'Invalid or expired login handoff')
        if result.status_code != 200:
            raise HTTPException(503, 'Life2 authentication is unavailable')
        token = result.json().get('token')
        if not isinstance(token, str):
            raise ValueError()
        verify_token(token)
        return {'token': token}
    except (httpx.HTTPError, ValueError, AttributeError):
        raise HTTPException(503, 'Life2 authentication is unavailable') from None


@app.get('/api/auth/me')
def auth_me(identity: Identity | None = Depends(current_identity)):
    return {'authenticated': identity is not None, 'user': identity.output() if identity else None}


@app.post('/api/auth/session')
def auth_session(payload: SessionInput, request: Request, response: Response):
    check_origin(request)
    identity = verify_token(payload.token)
    expires = json.loads(decode_segment(payload.token.split('.')[1]))['exp']
    response.set_cookie(COOKIE_NAME, payload.token, max_age=max(1, int(expires - time.time())), path=settings.cookie_path,
                        httponly=True, secure=settings.cookie_secure, samesite='lax')
    return {'authenticated': True, 'user': identity.output()}


@app.delete('/api/auth/session', status_code=204)
def logout(request: Request):
    check_origin(request)
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, path=settings.cookie_path, secure=settings.cookie_secure, httponly=True, samesite='lax')
    return response


def owns(record, identity):
    return identity is not None and record.owner_subject == identity.subject and record.owner_account_id == identity.account_id


def visible_sets(identity):
    if identity is None:
        return FlashcardSet.is_public.is_(True)
    return or_(FlashcardSet.is_public.is_(True), and_(FlashcardSet.owner_subject == identity.subject,
                                                    FlashcardSet.owner_account_id == identity.account_id))


def find_set(session: Session, set_id: UUID, identity: Identity | None, lock=False) -> FlashcardSet:
    query = select(FlashcardSet).where(FlashcardSet.id == set_id, visible_sets(identity))
    if lock:
        query = query.with_for_update()
    result = session.scalar(query)
    if result is None:
        raise HTTPException(404, 'Flashcard set not found')
    if lock and not owns(result, identity):
        raise HTTPException(403, 'Only the series owner can make changes')
    return result


def find_card(session: Session, set_id: UUID, card_id: UUID) -> Flashcard:
    result = session.scalar(select(Flashcard).where(Flashcard.id == card_id, Flashcard.set_id == set_id))
    if result is None:
        raise HTTPException(404, 'Flashcard not found in this set')
    return result


def ordered_cards(session: Session, set_id: UUID):
    return list(session.scalars(select(Flashcard).where(Flashcard.set_id == set_id).order_by(Flashcard.position)))


def set_output(session: Session, lesson: FlashcardSet, identity: Identity | None):
    return SetOutput(id=lesson.id, name=lesson.name, description=lesson.description,
                     created_at=lesson.created_at, is_public=lesson.is_public, can_edit=owns(lesson, identity),
                     card_count=session.scalar(select(func.count()).select_from(Flashcard).where(Flashcard.set_id == lesson.id)))


def image_link_filter(url):
    return or_(and_(Flashcard.front_type == 'image', Flashcard.front_content == url),
               and_(Flashcard.back_type == 'image', Flashcard.back_content == url))


def validate_images(payload: CardInput, session: Session, identity: Identity):
    for face in ('front', 'back'):
        if getattr(payload, f'{face}_type') == 'image':
            content = getattr(payload, f'{face}_content')
            filename = content.removeprefix('/uploads/')
            if not content.startswith('/uploads/') or Path(filename).name != filename or not filename or not (settings.upload_dir / filename).is_file():
                raise HTTPException(422, f'{face.capitalize()} image must be an uploaded picture')
            upload = session.get(PictureUpload, filename)
            # A legacy picture remains available through its readable series without inferring upload ownership.
            readably_linked = session.scalar(select(Flashcard.id).join(FlashcardSet).where(
                visible_sets(identity), image_link_filter(content)).limit(1))
            if not (upload and owns(upload, identity)) and not readably_linked:
                raise HTTPException(422, 'Picture is not available to this user')


@app.get('/api/health')
def health(session: Session = Depends(get_session, scope='function')):
    session.execute(text('SELECT 1'))
    return {'status': 'ok', 'database': 'ok'}


@app.get('/api/sets', response_model=list[SetOutput])
def list_sets(session: Session = Depends(get_session, scope='function'), identity: Identity | None = Depends(current_identity)):
    rows = session.execute(select(FlashcardSet, func.count(Flashcard.id)).outerjoin(Flashcard).where(visible_sets(identity)).group_by(FlashcardSet.id).order_by(FlashcardSet.created_at.desc(), FlashcardSet.id)).all()
    return [SetOutput(id=s.id, name=s.name, description=s.description, created_at=s.created_at,
                      is_public=s.is_public, can_edit=owns(s, identity), card_count=count) for s, count in rows]


@app.post('/api/sets', response_model=SetOutput, status_code=201)
def create_set(payload: SetInput, session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    lesson = FlashcardSet(**payload.model_dump(), owner_subject=identity.subject, owner_account_id=identity.account_id)
    session.add(lesson)
    session.flush()
    return set_output(session, lesson, identity)


@app.get('/api/sets/{set_id}', response_model=SetDetail)
def get_set(set_id: UUID, session: Session = Depends(get_session, scope='function'), identity: Identity | None = Depends(current_identity)):
    lesson = find_set(session, set_id, identity)
    return SetDetail(**set_output(session, lesson, identity).model_dump(), cards=[CardOutput.model_validate(c) for c in ordered_cards(session, set_id)])


@app.put('/api/sets/{set_id}', response_model=SetOutput)
def edit_set(set_id: UUID, payload: SetInput, session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    lesson = find_set(session, set_id, identity, lock=True)
    for field, value in payload.model_dump().items():
        setattr(lesson, field, value)
    session.flush()
    return set_output(session, lesson, identity)


@app.delete('/api/sets/{set_id}', status_code=204)
def delete_set(set_id: UUID, session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    session.delete(find_set(session, set_id, identity, lock=True))
    session.flush()
    return Response(status_code=204)


@app.put('/api/sets/{set_id}/cards/reorder', response_model=list[CardOutput])
def reorder_cards(set_id: UUID, payload: ReorderInput, session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    find_set(session, set_id, identity, lock=True)
    cards = ordered_cards(session, set_id)
    by_id = {card.id: card for card in cards}
    if len(payload.card_ids) != len(cards) or set(payload.card_ids) != set(by_id):
        raise HTTPException(422, 'Include every card in this set exactly once')
    result = []
    for position, card_id in enumerate(payload.card_ids):
        card = by_id[card_id]
        card.position = position
        result.append(card)
    session.flush()
    return result


@app.post('/api/sets/{set_id}/cards', response_model=CardOutput, status_code=201)
def create_card(set_id: UUID, payload: CardInput, session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    find_set(session, set_id, identity, lock=True)
    validate_images(payload, session, identity)
    count = session.scalar(select(func.count()).select_from(Flashcard).where(Flashcard.set_id == set_id))
    card = Flashcard(set_id=set_id, position=count, **payload.model_dump())
    session.add(card)
    session.flush()
    return card


@app.put('/api/sets/{set_id}/cards/{card_id}', response_model=CardOutput)
def edit_card(set_id: UUID, card_id: UUID, payload: CardInput, session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    find_set(session, set_id, identity, lock=True)
    validate_images(payload, session, identity)
    card = find_card(session, set_id, card_id)
    for field, value in payload.model_dump().items():
        setattr(card, field, value)
    session.flush()
    return card


@app.delete('/api/sets/{set_id}/cards/{card_id}', status_code=204)
def delete_card(set_id: UUID, card_id: UUID, session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    find_set(session, set_id, identity, lock=True)
    session.delete(find_card(session, set_id, card_id))
    session.flush()
    for position, card in enumerate(ordered_cards(session, set_id)):
        card.position = position
    session.flush()
    return Response(status_code=204)


@app.post('/api/uploads', status_code=201)
async def upload_picture(file: UploadFile = File(...), session: Session = Depends(get_session, scope='function'), identity: Identity = Depends(require_identity)):
    content = await file.read(settings.max_upload_bytes + 1)
    await file.close()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(413, 'Pictures must be 10 MiB or smaller')
    formats = {'PNG': '.png', 'JPEG': '.jpg', 'WEBP': '.webp', 'GIF': '.gif'}
    try:
        with Image.open(BytesIO(content)) as picture:
            extension = formats.get(picture.format)
            if extension is None:
                raise HTTPException(422, 'Choose a PNG, JPEG, WebP, or GIF picture')
            picture.verify()
        with Image.open(BytesIO(content)) as picture:
            picture.load()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, 'The upload is not a valid picture') from None
    filename = f'{uuid4()}{extension}'
    session.add(PictureUpload(filename=filename, owner_subject=identity.subject, owner_account_id=identity.account_id))
    session.flush()
    (settings.upload_dir / filename).write_bytes(content)
    return {'url': f'/uploads/{filename}'}


@app.get('/uploads/{filename}')
def get_picture(filename: str, session: Session = Depends(get_session, scope='function'), identity: Identity | None = Depends(current_identity)):
    if Path(filename).name != filename or not (settings.upload_dir / filename).is_file():
        raise HTTPException(404, 'Picture not found')
    upload = session.get(PictureUpload, filename)
    readable = session.scalar(select(Flashcard.id).join(FlashcardSet).where(
        visible_sets(identity), image_link_filter(f'/uploads/{filename}')).limit(1))
    if not readable and not (upload and owns(upload, identity)):
        raise HTTPException(404, 'Picture not found')
    return FileResponse(settings.upload_dir / filename)
