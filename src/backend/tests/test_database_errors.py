"""Exercise a real connection failure without replacing service responses."""
import os
from pathlib import Path
import socket
import subprocess
import sys

from sqlalchemy.engine import make_url


def test_unavailable_postgres_returns_actionable_json():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        unavailable_port = probe.getsockname()[1]
    env = os.environ.copy()
    env['DATABASE_URL'] = make_url(env['DATABASE_URL']).set(host='127.0.0.1', port=unavailable_port).render_as_string(hide_password=False)
    code = '''
from fastapi.testclient import TestClient
from app.main import app
# Deliberately skip startup schema creation to test request failure handling.
client = TestClient(app)
response = client.get('/api/health')
assert response.status_code == 503, response.text
assert response.json() == {'detail': 'Database unavailable. Check local PostgreSQL and try again.'}
'''
    result = subprocess.run([sys.executable, '-c', code], cwd=Path(__file__).parent.parent,
                            env=env, capture_output=True, text=True, timeout=20)
    assert result.returncode == 0, result.stderr
