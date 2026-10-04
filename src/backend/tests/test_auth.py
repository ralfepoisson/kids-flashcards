import io
import time

from PIL import Image
from conftest import signed_token


def anonymous(client):
    client.headers.pop('Authorization', None)
    client.cookies.clear()


def identity(client, subject='test-parent', account='test-account'):
    client.headers['Authorization'] = f'Bearer {signed_token(subject, account)}'
    client.cookies.clear()


def test_anonymous_cannot_write_and_can_practice_public(client, create_set):
    private = create_set('Private')
    public = create_set('Public')
    client.put(f"/api/sets/{public['id']}", json={'name': 'Public', 'is_public': True})
    anonymous(client)
    listed = client.get('/api/sets').json()
    assert any(s['id'] == public['id'] and s['can_edit'] is False for s in listed)
    assert all(s['id'] != private['id'] for s in listed)
    assert client.get(f"/api/sets/{private['id']}").status_code == 404
    assert client.get(f"/api/sets/{public['id']}").status_code == 200
    for method, path, body in [
        ('POST', '/api/sets', {'name': 'No'}),
        ('PUT', f"/api/sets/{public['id']}", {'name': 'No'}),
        ('DELETE', f"/api/sets/{public['id']}", None),
        ('POST', f"/api/sets/{public['id']}/cards", {'front_type': 'text', 'front_content': 'q', 'back_type': 'text', 'back_content': 'a'}),
        ('PUT', f"/api/sets/{public['id']}/cards/reorder", {'card_ids': []}),
    ]:
        assert client.request(method, path, json=body).status_code == 401
    assert client.post('/api/uploads', files={'file': ('x.png', b'x')}).status_code == 401


def test_account_and_subject_ownership_are_both_required(client, create_set):
    lesson = create_set()
    url = f"/api/sets/{lesson['id']}"
    assert lesson['is_public'] is False and lesson['can_edit'] is True
    assert 'owner_subject' not in lesson and 'owner_account_id' not in lesson
    for subject, account in [('other', 'test-account'), ('test-parent', 'other')]:
        identity(client, subject, account)
        assert client.get(url).status_code == 404
        assert client.put(url, json={'name': 'Changed'}).status_code == 404
    identity(client)
    client.put(url, json={'name': 'Shared', 'is_public': True})
    identity(client, 'other', 'other')
    assert client.get(url).json()['can_edit'] is False
    for method, target, body in [('PUT', url, {'name': 'No'}), ('DELETE', url, None),
        ('PUT', url + '/cards/reorder', {'card_ids': []}),
        ('POST', url + '/cards', {'front_type': 'text', 'front_content': 'q', 'back_type': 'text', 'back_content': 'a'}),
        ('PUT', url + '/cards/00000000-0000-0000-0000-000000000000', {'front_type': 'text', 'front_content': 'q', 'back_type': 'text', 'back_content': 'a'}),
        ('DELETE', url + '/cards/00000000-0000-0000-0000-000000000000', None)]:
        assert client.request(method, target, json=body).status_code == 403


def test_token_validation_and_cookie_csrf(client):
    anonymous(client)
    assert client.get('/api/auth/me').json() == {'authenticated': False, 'user': None}
    assert client.get('/api/auth/config').json()['signInUrl'].startswith('http')
    for claims in [{'exp': 1}, {'iss': 'wrong'}, {'aud': 'wrong'}, {'applicationId': 'wrong'},
                   {'iat': int(time.time()) + 600}, {'sub': ''}, {'accountId': ''},
                   {'isDelegated': True}, {'delegatedBy': 'x'}, {'sub': ['x']}, {'exp': True}]:
        client.headers['Authorization'] = f'Bearer {signed_token(**claims)}'
        assert client.get('/api/auth/me').status_code == 401
    anonymous(client)
    token = signed_token()
    assert client.post('/api/auth/session', json={'token': token}).status_code == 403
    response = client.post('/api/auth/session', json={'token': token}, headers={'Origin': 'http://127.0.0.1:4200'})
    assert response.status_code == 200
    assert 'HttpOnly' in response.headers['set-cookie'] and 'samesite=lax' in response.headers['set-cookie'].lower()
    assert client.get('/api/auth/me').json()['user']['subject'] == 'test-parent'
    assert client.post('/api/sets', json={'name': 'CSRF'}).status_code == 403
    assert client.post('/api/sets', json={'name': 'CSRF'}, headers={'Origin': 'https://evil.example'}).status_code == 403
    response = client.post('/api/sets', json={'name': 'Cookie'}, headers={'Origin': 'http://127.0.0.1:4200'})
    assert response.status_code == 201
    client.created_ids.append(response.json()['id'])
    assert client.delete('/api/auth/session', headers={'Origin': 'http://127.0.0.1:4200'}).status_code == 204
    assert client.get('/api/auth/me').json()['authenticated'] is False


def test_images_follow_series_privacy_and_cannot_be_stolen(client, create_set):
    picture = io.BytesIO()
    Image.new('RGB', (4, 4)).save(picture, format='PNG')
    uploaded = client.post('/api/uploads', files={'file': ('x.png', picture.getvalue())}).json()['url']
    lesson = create_set()
    url = f"/api/sets/{lesson['id']}"
    payload = {'front_type': 'image', 'front_content': uploaded, 'back_type': 'text', 'back_content': 'answer'}
    assert client.post(url + '/cards', json=payload).status_code == 201
    anonymous(client)
    assert client.get(uploaded).status_code == 404
    identity(client, 'other', 'other')
    other = create_set('Other')
    assert client.post(f"/api/sets/{other['id']}/cards", json=payload).status_code == 422
    identity(client)
    client.put(url, json={'name': 'Shared', 'is_public': True})
    anonymous(client)
    assert client.get(uploaded).status_code == 200
    identity(client)
    client.put(url, json={'name': 'Private', 'is_public': False})
    anonymous(client)
    assert client.get(uploaded).status_code == 404


def test_expired_cookie_is_cleared_for_anonymous_browsing(client):
    anonymous(client)
    client.cookies.set('kids_flashcards_session', signed_token(exp=1))
    response = client.get('/api/auth/me')
    assert response.status_code == 200 and response.json()['authenticated'] is False
    assert 'Max-Age=0' in response.headers['set-cookie']
    assert response.headers['cache-control'] == 'private, no-store'
    assert client.get('/api/sets').status_code == 200
    assert client.get('/api/sets').headers['cache-control'] == 'private, no-store'


def test_invalid_explicit_tokens_fail_closed(client):
    for token in ['unsigned.payload.', signed_token()[:-1] + '!', 'garbage', signed_token(aud=['account']),
                  signed_token(iat='100'), signed_token(exp=float('inf')), signed_token(scope='life2:write'), signed_token(accountId=None), signed_token(delegationId='x')]:
        client.headers['Authorization'] = f'Bearer {token}'
        assert client.get('/api/sets').status_code == 401
        assert client.post('/api/sets', json={'name': 'No'}).status_code == 401
    client.headers['Authorization'] = 'Basic abc'
    assert client.get('/api/auth/me').status_code == 401


def test_ownership_is_server_assigned_and_cannot_be_submitted(client):
    response = client.post('/api/sets', json={'name': 'Forged', 'owner_subject': 'another'})
    assert response.status_code == 422
    response = client.post('/api/sets', json={'name': 'Forged', 'owner_account_id': 'another'})
    assert response.status_code == 422


def test_login_exchange_rejects_cross_origin_and_invalid_codes(client):
    anonymous(client)
    config = client.get('/api/auth/config').json()
    assert config['exchangeUrl'] == '/api/auth/exchange'
    assert '/signIn?' in config['signInUrl'] and '&redirect=' in config['signInUrl']
    assert client.post('/api/auth/exchange', json={'code': 'a' * 43}).status_code == 403
    assert client.post('/api/auth/exchange', json={'code': 'a' * 43}, headers={'Origin': 'https://evil.example'}).status_code == 403
    assert client.post('/api/auth/exchange', json={'code': 'bad'}, headers={'Origin': 'http://127.0.0.1:4200'}).status_code == 422


def test_additive_migration_preserves_legacy_unowned_private_rows(client):
    from app.database import SessionLocal
    from app.models import FlashcardSet
    from migrate_auth import migrate
    with SessionLocal.begin() as session:
        lesson = FlashcardSet(name='Legacy preserved', description='Do not claim automatically')
        session.add(lesson)
        session.flush()
        lesson_id = str(lesson.id)
        client.created_ids.append(lesson_id)
    migrate()
    migrate()
    with SessionLocal() as session:
        from uuid import UUID
        lesson = session.get(FlashcardSet, UUID(lesson_id))
        assert lesson.name == 'Legacy preserved'
        assert lesson.owner_subject is None and lesson.owner_account_id is None and lesson.is_public is False
    assert client.get(f'/api/sets/{lesson_id}').status_code == 404
    anonymous(client)
    assert client.get(f'/api/sets/{lesson_id}').status_code == 404
