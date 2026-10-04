"""Single-process production host for the compiled Angular UI and protected API."""
import re
from pathlib import Path

from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import FileResponse, RedirectResponse


class SiteFiles:
    def __init__(self, api, directory):
        self.api = api
        self.directory = directory.resolve()

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope['method'] in ('GET', 'HEAD'):
            path = Request(scope).url.path.removeprefix(scope.get('root_path', '')).lstrip('/')
            # Never turn an API or protected-upload miss into an HTML success.
            if not path.startswith(('api/', 'uploads/')) and path not in ('api', 'uploads'):
                page = path not in ('docs', 'redoc') and not Path(path).suffix
                target = (self.directory / ('index.html' if page else path)).resolve()
                if target.is_relative_to(self.directory) and target.is_file() and not any(p.startswith('.') for p in Path(path).parts):
                    response = FileResponse(target, headers={'Cache-Control': 'no-cache' if page else 'public, max-age=3600'})
                    await response(scope, receive, send)
                    return
        await self.api(scope, receive, send)


def create_site(api, directory: Path, base_path='/flashcards'):
    if not (directory / 'index.html').is_file():
        raise RuntimeError('Compiled frontend index.html is missing')
    if not re.fullmatch(r'/[A-Za-z0-9_-]+', base_path):
        raise ValueError('APP_BASE_PATH must be one absolute path segment')
    # Forward startup/shutdown to the API mounted behind the UI file handler.
    site = FastAPI(lifespan=api.router.lifespan_context, docs_url=None, redoc_url=None, openapi_url=None)

    @site.get(base_path, include_in_schema=False)
    def trailing_slash():
        return RedirectResponse(base_path + '/', status_code=308)

    site.mount(base_path, SiteFiles(api, directory))
    return site
