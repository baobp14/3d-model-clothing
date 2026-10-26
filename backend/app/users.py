"""Admin user management. Accounts live in Supabase Auth, so listing and locking go
through its admin API with the secret key; order totals come from the shop DB."""
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .errors import fail
from .models import Order

LOCK_FOR = '876000h'  # about 100 years: Supabase has no permanent ban, only a duration


def _admin(config, http, method, path, **kwargs):
    if not config.supabase_url or not config.supabase_secret_key:
        fail('NB_USER_ADMIN_NOT_CONFIGURED', 503)
    try:
        response = http.request(method, config.supabase_url + '/auth/v1/admin' + path,
                                headers={'apikey': config.supabase_secret_key, 'Authorization': f'Bearer {config.supabase_secret_key}'}, **kwargs)
    except httpx.HTTPError:
        fail('NB_AUTH_UNAVAILABLE', 503)
    if response.status_code == 404:
        fail('NB_USER_NOT_FOUND', 404)
    if response.status_code != 200:
        fail('NB_AUTH_UNAVAILABLE', 503)
    return response.json()


def is_locked(row):
    until = row.get('banned_until')
    if not until:
        return False
    try:
        return datetime.fromisoformat(until.replace('Z', '+00:00')) > datetime.now(timezone.utc)
    except ValueError:
        return False


def _user_dict(row, stats):
    meta = row.get('user_metadata') or {}
    orders, spent = stats.get(row['id'], (0, 0))
    return {'id': row['id'], 'email': row.get('email') or '', 'name': meta.get('name') or '', 'phone': meta.get('phone') or '',
            'role': 'admin' if (row.get('app_metadata') or {}).get('role') == 'admin' else 'customer',
            'confirmed': bool(row.get('email_confirmed_at')), 'locked': is_locked(row),
            'created_at': row.get('created_at'), 'last_sign_in_at': row.get('last_sign_in_at'), 'orders': orders, 'spent': spent}


def list_users(db: Session, config, http, q='', page=1, limit=20):
    rows = _admin(config, http, 'GET', '/users', params={'page': 1, 'per_page': 1000}).get('users', [])
    stats = {user_id: (count, int(spent or 0)) for user_id, count, spent in db.execute(
        select(Order.user_id, func.count(), func.sum(Order.total)).where(Order.status != 'canceled').group_by(Order.user_id))}
    users = [_user_dict(row, stats) for row in rows]
    needle = q.strip().lower()
    if needle:
        users = [u for u in users if needle in f"{u['email']} {u['name']} {u['phone']}".lower()]
    users.sort(key=lambda u: u['created_at'] or '', reverse=True)
    pages = max(1, -(-len(users) // limit))
    page = min(max(page, 1), pages)
    return {'users': users[(page - 1) * limit:page * limit], 'total': len(users), 'page': page, 'pages': pages}


def set_locked(db: Session, config, http, cache, admin, user_id, locked):
    if user_id == admin.id:
        fail('NB_USER_SELF_LOCK', 409)
    row = _admin(config, http, 'GET', f'/users/{user_id}')
    if (row.get('app_metadata') or {}).get('role') == 'admin':
        fail('NB_USER_ADMIN_LOCK', 409)
    row = _admin(config, http, 'PUT', f'/users/{user_id}', json={'ban_duration': LOCK_FOR if locked else 'none'})
    cache.clear()  # drop cached sessions so the lock applies on the next request
    stats = {user_id: tuple(db.execute(select(func.count(), func.coalesce(func.sum(Order.total), 0))
                                       .where(Order.user_id == user_id, Order.status != 'canceled')).one())}
    return _user_dict(row, stats)
