import hashlib
import threading
import time
from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .errors import fail
from .users import is_locked

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class User:
    id: str
    role: str = 'customer'


class UserCache:
    """Successful Auth lookups keyed by token hash, so each request need not call Supabase."""
    def __init__(self, seconds, clock=time.monotonic):
        self.seconds = seconds
        self.clock = clock
        self.rows = {}
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            row = self.rows.get(key)
            if row and row[0] > self.clock():
                return row[1]
            self.rows.pop(key, None)
            return None

    def put(self, key, user):
        if self.seconds <= 0:
            return
        with self.lock:
            if len(self.rows) > 10000:
                now = self.clock()
                self.rows = {k: v for k, v in self.rows.items() if v[0] > now}
            self.rows[key] = (self.clock() + self.seconds, user)

    def clear(self):
        with self.lock:
            self.rows = {}


def require_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        fail('NB_AUTH_REQUIRED', 401)
    config = request.app.state.settings
    if not config.supabase_url or not config.supabase_anon_key:
        fail('NB_AUTH_NOT_CONFIGURED', 503)
    cache = request.app.state.user_cache
    key = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    cached = cache.get(key)
    if cached:
        return cached
    user = verify_user(request, config, credentials)
    cache.put(key, user)
    return user


def verify_user(request, config, credentials):
    # The Auth server validates the token and returns authoritative app_metadata.
    # Never trust a decoded JWT payload or user_metadata.role from the browser.
    try:
        response = request.app.state.auth_http.get(
            config.supabase_url + '/auth/v1/user',
            headers={'apikey': config.supabase_anon_key, 'Authorization': f'Bearer {credentials.credentials}'},
        )
    except httpx.HTTPError:
        fail('NB_AUTH_UNAVAILABLE', 503)
    if response.status_code in (401, 403):
        fail('NB_AUTH_REQUIRED', 401)
    if response.status_code != 200:
        fail('NB_AUTH_UNAVAILABLE', 503)
    try:
        data = response.json()
        user_id = str(UUID(data['id']))
        if data.get('is_anonymous') or not data.get('email_confirmed_at'):
            fail('NB_AUTH_REQUIRED', 401)
        if is_locked(data):
            fail('NB_ACCOUNT_LOCKED', 403)
        metadata = data.get('app_metadata') or {}
        if not isinstance(metadata, dict):
            fail('NB_AUTH_REQUIRED', 401)
        role = 'admin' if metadata.get('role') == 'admin' else 'customer'
    except (ValueError, KeyError, TypeError):
        fail('NB_AUTH_REQUIRED', 401)
    return User(user_id, role)


def require_admin(user: User = Depends(require_user)):
    if user.role != 'admin':
        fail('NB_ADMIN_REQUIRED', 403)
    return user


def require_customer(user: User = Depends(require_user)):
    if user.role != 'customer':
        fail('NB_CUSTOMER_REQUIRED', 403)
    return user
