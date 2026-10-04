"""Create only this app's database, if absent, using existing localhost PostgreSQL."""
import argparse
import os

import psycopg
from sqlalchemy.engine import make_url

from app.config import settings

parser = argparse.ArgumentParser()
parser.add_argument('--test', action='store_true', help='Initialize kids_flashcards_test')
args = parser.parse_args()
url = make_url(os.environ.get('TEST_DATABASE_URL', settings.database_url.replace('/kids_flashcards', '/kids_flashcards_test')) if args.test else settings.database_url)
allowed = 'kids_flashcards_test' if args.test else 'kids_flashcards'
if url.database != allowed or url.host not in ('localhost', '127.0.0.1', '::1'):
    raise SystemExit(f'This helper creates only {allowed} on localhost. Create other configured databases yourself.')
conninfo = dict(host=url.host, port=url.port or 5432, user=url.username, password=url.password, dbname='postgres')
with psycopg.connect(**conninfo, autocommit=True) as connection:
    exists = connection.execute('SELECT 1 FROM pg_database WHERE datname = %s', (allowed,)).fetchone()
    if not exists:
        connection.execute(psycopg.sql.SQL('CREATE DATABASE {}').format(psycopg.sql.Identifier(allowed)))
        print(f'Created {allowed} on localhost.')
    else:
        print(f'{allowed} already exists; preserved.')
