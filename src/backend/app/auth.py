"""Verify Life2 account tokens; the browser only keeps an HttpOnly session cookie."""
import base64
import binascii
import hashlib
import hmac
import json
import math
import time
from dataclasses import dataclass
from pathlib import Path

from fastapi import Depends, HTTPException, Request, Response

from .config import settings

COOKIE_NAME = 'kids_flashcards_session'


@dataclass(frozen=True)
class Identity:
    subject: str
    account_id: str
    display_name: str | None = None
    email: str | None = None

    def output(self):
        return {'subject': self.subject, 'accountId': self.account_id,
                'displayName': self.display_name, 'email': self.email}


def signing_key():
    try:
        encoded = settings.life2_jwt_signing_key_base64
        if not encoded and settings.life2_jwt_signing_key_file:
            encoded = Path(settings.life2_jwt_signing_key_file).read_text().strip()
        key = base64.b64decode(encoded, validate=True)
        if len(key) < 32 or not settings.life2_application_id:
            raise ValueError('Missing key/application configuration')
        return key
    except (OSError, ValueError, binascii.Error):
        raise HTTPException(503, 'Life2 authentication is not configured') from None


def decode_segment(segment):
    return base64.b64decode(segment + '=' * (-len(segment) % 4), altchars=b'-_', validate=True)


def verify_token(token: str) -> Identity:
    key = signing_key()
    try:
        if len(token) > 16384:
            raise ValueError()
        header, payload, signature = token.split('.')
        metadata = json.loads(decode_segment(header))
        if metadata.get('alg') != 'HS256' or metadata.get('crit') or metadata.get('typ', 'JWT') != 'JWT':
            raise ValueError()
        expected = hmac.new(key, f'{header}.{payload}'.encode('ascii'), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, decode_segment(signature)):
            raise ValueError()
        claims = json.loads(decode_segment(payload))
        now = time.time()
        if not isinstance(claims, dict):
            raise ValueError()
        if claims.get('iss') != 'life2.ralfe.me' or claims.get('aud') != 'account':
            raise ValueError()
        if claims.get('applicationId') != settings.life2_application_id:
            raise ValueError()
        for field in ('exp', 'iat'):
            if type(claims.get(field)) not in (int, float) or not math.isfinite(claims[field]):
                raise ValueError()
        if not claims['iat'] <= now < claims['exp'] or claims['iat'] >= claims['exp']:
            raise ValueError()
        if 'nbf' in claims and (type(claims['nbf']) not in (int, float) or not claims['nbf'] <= now):
            raise ValueError()
        for field in ('sub', 'accountId'):
            if not isinstance(claims.get(field), str) or not claims[field].strip() or len(claims[field]) > 200:
                raise ValueError()
        if any(claims.get(field) for field in ('isDelegated', 'delegatedBy', 'delegationId', 'delegation', 'act', 'actor', 'scope', 'scp', 'client_id', 'resource')):
            raise ValueError()
        return Identity(claims['sub'], claims['accountId'],
                        claims.get('displayName') if isinstance(claims.get('displayName'), str) else None,
                        claims.get('email') if isinstance(claims.get('email'), str) else None)
    except (ValueError, TypeError, KeyError, UnicodeError, AttributeError, binascii.Error, RecursionError):
        raise HTTPException(401, 'Invalid or expired Life2 session') from None


def current_identity(request: Request, response: Response):
    authorization = request.headers.get('authorization')
    if authorization is not None:
        scheme, _, token = authorization.partition(' ')
        if scheme.lower() != 'bearer' or not token:
            raise HTTPException(401, 'Invalid or expired Life2 session')
        return verify_token(token)
    token = request.cookies.get(COOKIE_NAME)
    if token:
        try:
            return verify_token(token)
        except HTTPException as error:
            if error.status_code != 401:
                raise
            response.delete_cookie(COOKIE_NAME, path=settings.cookie_path, secure=settings.cookie_secure, httponly=True, samesite='lax')
    return None


def check_origin(request: Request):
    if request.headers.get('origin') not in settings.cors_origins:
        raise HTTPException(403, 'Request origin is not allowed')


def require_identity(request: Request, identity: Identity | None = Depends(current_identity)):
    if identity is None:
        raise HTTPException(401, 'Please log in to make changes')
    if request.headers.get('authorization') is None:
        check_origin(request)
    return identity
