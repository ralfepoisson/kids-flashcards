"""Explicit additive migration. Back up database and uploads before executing."""
from sqlalchemy import text
from app.database import Base, engine
from app import models  # register tables


def migrate():
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE IF EXISTS flashcard_sets ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false"))
        connection.execute(text("ALTER TABLE IF EXISTS flashcard_sets ADD COLUMN IF NOT EXISTS owner_subject varchar(200)"))
        connection.execute(text("ALTER TABLE IF EXISTS flashcard_sets ADD COLUMN IF NOT EXISTS owner_account_id varchar(200)"))
        Base.metadata.create_all(connection)


if __name__ == '__main__':
    migrate()
    print('Authentication schema migrated; existing series preserved private and unowned.')
