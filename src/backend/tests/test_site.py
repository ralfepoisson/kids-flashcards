"""Exercise the actual mounted API and static file server, with real PostgreSQL."""
from fastapi.testclient import TestClient
from app.site import create_site
from app.main import app


def test_subpath_spa_and_api(tmp_path):
    (tmp_path / 'index.html').write_text('<base href="/flashcards/"><app-root></app-root>')
    (tmp_path / 'main-test.js').write_text('console.log("bundle")')
    site = create_site(app, tmp_path, '/flashcards')
    with TestClient(site) as client:
        assert client.get('/flashcards', follow_redirects=False).headers['location'] == '/flashcards/'
        for path in ('/', '/auth/callback', '/set/123/practice', '/set/123/edit', '/unknown-page'):
            response = client.get('/flashcards' + path)
            assert response.status_code == 200
            assert '<base href="/flashcards/">' in response.text
            assert response.headers['cache-control'] == 'no-cache'
        assert client.get('/flashcards/main-test.js').text == 'console.log("bundle")'
        assert client.get('/flashcards/api/health').json() == {'status': 'ok', 'database': 'ok'}
        assert client.get('/flashcards/api/auth/me').headers['cache-control'] == 'private, no-store'
        assert client.get('/flashcards/api/sets').json() is not None
        assert client.get('/flashcards/api/sets').headers['cache-control'] == 'private, no-store'
        for path in ('/api/missing', '/uploads/missing.png', '/missing.js', '/.env', '/%2e%2e/secret'):
            assert client.get('/flashcards' + path).status_code == 404
        assert client.post('/flashcards/api/sets', json={'name': 'unsigned'}).status_code == 401
        assert client.get('/api/sets').status_code == 404


def test_missing_frontend_fails_startup(tmp_path):
    import pytest
    with pytest.raises(RuntimeError, match='index.html'):
        create_site(app, tmp_path, '/flashcards')


def test_subpath_secure_cookie_lifecycle(tmp_path, monkeypatch):
    from dataclasses import replace
    import app.auth as auth
    import app.main as main
    from conftest import signed_token
    production = replace(main.settings, cookie_path='/flashcards', cookie_secure=True)
    monkeypatch.setattr(main, 'settings', production)
    monkeypatch.setattr(auth, 'settings', production)
    (tmp_path / 'index.html').write_text('<base href="/flashcards/">')
    with TestClient(create_site(app, tmp_path), base_url='https://testserver') as client:
        headers = {'Origin': 'http://127.0.0.1:4200'}
        response = client.post('/flashcards/api/auth/session', json={'token': signed_token()}, headers=headers)
        cookie = response.headers['set-cookie']
        assert 'Path=/flashcards' in cookie and 'Secure' in cookie and 'HttpOnly' in cookie
        assert client.get('/flashcards/api/auth/me').json()['authenticated'] is True
        assert client.delete('/flashcards/api/auth/session', headers=headers).status_code == 204
        assert client.get('/flashcards/api/auth/me').json()['authenticated'] is False
