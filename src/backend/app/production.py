import os
from pathlib import Path
from .main import app as api
from .site import create_site

app = create_site(api, Path(os.environ.get('FRONTEND_DIR', '/app/frontend')), os.environ.get('APP_BASE_PATH', '/flashcards'))
