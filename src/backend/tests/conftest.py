import os
import getpass
import base64
import hashlib
import hmac
import json
import time
from pathlib import Path

import pytest
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
default_url = make_url(os.environ.get('DATABASE_URL', f'postgresql+psycopg://{getpass.getuser()}@localhost:5432/kids_flashcards')).set(database='kids_flashcards_test')
test_url = make_url(os.environ.get('TEST_DATABASE_URL', default_url.render_as_string(hide_password=False)))
if test_url.database != 'kids_flashcards_test' or test_url.host not in ('localhost', '127.0.0.1', '::1'):
    raise RuntimeError('Tests require the dedicated kids_flashcards_test database on localhost')
os.environ['DATABASE_URL'] = test_url.render_as_string(hide_password=False)
os.environ['LIFE2_JWT_SIGNING_KEY_BASE64'] = base64.b64encode(b'test-key-never-used-outside-tests-0123456789').decode()
os.environ['LIFE2_JWT_SIGNING_KEY_FILE'] = ''
os.environ['LIFE2_APPLICATION_ID'] = 'kids-flashcards-test'
os.environ['UPLOAD_DIR'] = str(Path(__file__).parent / '.uploads')

from fastapi.testclient import TestClient
from sqlalchemy import delete
from app.main import app
from app.database import SessionLocal
from app.models import FlashcardSet, PictureUpload
from app.config import settings
from sqlalchemy import select


def signed_token(subject='test-parent', account='test-account', **claims):
    payload = {'iss': 'life2.ralfe.me', 'aud': 'account', 'sub': subject, 'accountId': account,
               'applicationId': 'kids-flashcards-test', 'iat': int(time.time()), 'exp': int(time.time()) + 600,
               'displayName': 'Test Parent', 'email': 'parent@example.test'} | claims
    encode = lambda data: base64.urlsafe_b64encode(json.dumps(data, separators=(',', ':')).encode()).rstrip(b'=')
    body = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode(payload)
    signature = hmac.new(base64.b64decode(os.environ['LIFE2_JWT_SIGNING_KEY_BASE64']), body, hashlib.sha256).digest()
    return (body + b'.' + base64.urlsafe_b64encode(signature).rstrip(b'=')).decode()


@pytest.fixture
def client():
    from migrate_auth import migrate
    migrate()
    with SessionLocal() as session:
        initial_uploads = set(session.scalars(select(PictureUpload.filename)))
    created_ids = []
    with TestClient(app) as client:
        client.created_ids = created_ids
        client.headers['Authorization'] = f'Bearer {signed_token()}'
        yield client
    with SessionLocal.begin() as session:
        if created_ids:
            session.execute(delete(FlashcardSet).where(FlashcardSet.id.in_(created_ids)))
        new_uploads = set(session.scalars(select(PictureUpload.filename))) - initial_uploads
        if new_uploads:
            session.execute(delete(PictureUpload).where(PictureUpload.filename.in_(new_uploads)))
            for filename in new_uploads:
                (settings.upload_dir / filename).unlink(missing_ok=True)


@pytest.fixture
def create_set(client):
    def create(name='Test lesson', description='A real database lesson'):
        response = client.post('/api/sets', json={'name': name, 'description': description})
        assert response.status_code == 201, response.text
        result = response.json()
        client.created_ids.append(result['id'])
        return result
    return create
