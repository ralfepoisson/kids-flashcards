import getpass
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / '.env')


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv('DATABASE_URL', f'postgresql+psycopg://{getpass.getuser()}@localhost:5432/kids_flashcards')
    upload_dir: Path = Path(os.getenv('UPLOAD_DIR', str(BACKEND_DIR / 'data' / 'uploads'))).resolve()
    cors_origins: tuple[str, ...] = tuple(os.getenv('CORS_ORIGINS', 'http://localhost:4200,http://127.0.0.1:4200').split(','))
    life2_application_id: str = os.getenv('LIFE2_APPLICATION_ID', '')
    life2_jwt_signing_key_base64: str = os.getenv('LIFE2_JWT_SIGNING_KEY_BASE64', '')
    life2_jwt_signing_key_file: str = os.getenv('LIFE2_JWT_SIGNING_KEY_FILE', '')
    life2_auth_url: str = os.getenv('LIFE2_AUTH_BASE_URL', os.getenv('LIFE2_AUTH_URL', 'http://auth-service.localhost:46138')).rstrip('/')
    life2_callback_url: str = os.getenv('LIFE2_CALLBACK_URL', 'http://127.0.0.1:4200/auth/callback')
    cookie_secure: bool = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
    max_upload_bytes: int = 10 * 1024 * 1024


settings = Settings()
