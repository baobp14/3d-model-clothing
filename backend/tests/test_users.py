"""Admin user management: list Supabase accounts with their order totals, lock and unlock
customers, and refuse requests from a locked account."""
import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from test_aftersales import place
from test_api import A, ADMIN, B, auth_response, headers, shop as base_shop  # noqa: F401

LOCKED = {}


def users_payload():
    return [
        {'id': A, 'email': 'an@example.com', 'email_confirmed_at': '2026-10-01T00:00:00Z', 'created_at': '2026-10-01T00:00:00Z',
         'user_metadata': {'name': 'Nguyễn An', 'phone': '0901234567'}, 'app_metadata': {}, 'banned_until': LOCKED.get(A)},
        {'id': B, 'email': 'binh@example.com', 'email_confirmed_at': '2026-10-02T00:00:00Z', 'created_at': '2026-10-02T00:00:00Z',
         'user_metadata': {'name': 'Trần Bình'}, 'app_metadata': {}},
        {'id': ADMIN, 'email': 'admin@example.com', 'email_confirmed_at': '2026-09-01T00:00:00Z', 'created_at': '2026-09-01T00:00:00Z',
         'user_metadata': {}, 'app_metadata': {'role': 'admin'}},
    ]


def transport(request):
    path = request.url.path
    if path == '/auth/v1/user':
        response = auth_response(request)
        if response.status_code == 200 and response.json()['id'] in LOCKED:
            return httpx.Response(200, json={**response.json(), 'banned_until': LOCKED[response.json()['id']]})
        return response
    assert request.headers['apikey'] == 'secret-test-key'
    rows = {row['id']: row for row in users_payload()}
    if path == '/auth/v1/admin/users':
        return httpx.Response(200, json={'users': list(rows.values())})
    user_id = path.rsplit('/', 1)[-1]
    if user_id not in rows:
        return httpx.Response(404)
    if request.method == 'PUT':
        if b'"none"' in request.content:
            LOCKED.pop(user_id, None)
        else:
            LOCKED[user_id] = '2126-01-01T00:00:00Z'
        rows = {row['id']: row for row in users_payload()}
    return httpx.Response(200, json=rows[user_id])


@pytest.fixture
def shop(base_shop):
    client, engine = base_shop
    LOCKED.clear()
    http = httpx.Client(transport=httpx.MockTransport(transport))
    app = create_app(Settings(database_url='unused', supabase_url='https://auth.example', supabase_anon_key='public-test-key',
                              supabase_secret_key='secret-test-key', tconnect_base_url=''), engine=engine, auth_http=http)
    with TestClient(app) as users_client:
        yield users_client, engine
    http.close()


def test_admin_lists_users_with_order_totals_and_search(shop):
    client, _ = shop
    order = place(client, 'a', quantity=1)
    assert client.get('/api/admin/users', headers=headers('a')).status_code == 403
    listing = client.get('/api/admin/users', headers=headers('admin')).json()
    assert listing['total'] == 3
    an = next(u for u in listing['users'] if u['id'] == A)
    assert (an['name'], an['orders'], an['spent'], an['locked']) == ('Nguyễn An', 1, order['total'], False)
    found = client.get('/api/admin/users', headers=headers('admin'), params={'q': 'trần'}).json()
    assert [u['email'] for u in found['users']] == ['binh@example.com']


def test_locked_customer_is_refused_until_unlocked(shop):
    client, _ = shop
    assert client.get('/api/orders', headers=headers('a')).status_code == 200
    locked = client.patch(f'/api/admin/users/{A}', headers=headers('admin'), json={'locked': True})
    assert locked.status_code == 200 and locked.json()['locked'] is True
    refused = client.get('/api/orders', headers=headers('a'))
    assert refused.status_code == 403 and refused.json()['code'] == 'NB_ACCOUNT_LOCKED'
    assert client.patch(f'/api/admin/users/{A}', headers=headers('admin'), json={'locked': False}).json()['locked'] is False
    assert client.get('/api/orders', headers=headers('a')).status_code == 200


def test_admins_cannot_be_locked(shop):
    client, _ = shop
    own = client.patch(f'/api/admin/users/{ADMIN}', headers=headers('admin'), json={'locked': True})
    assert own.status_code == 409 and own.json()['code'] == 'NB_USER_SELF_LOCK'
    assert client.patch(f'/api/admin/users/{B}', headers=headers('a'), json={'locked': True}).status_code == 403
