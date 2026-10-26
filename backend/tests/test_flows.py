"""QR payment, refunds, order history, promotion rules, archiving and API hardening."""
import csv
import io
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.admin_tools import csv_text
from app.config import Settings
from app.db import make_engine
from app.main import create_app
from app.models import Base, Category, Color, Order, OrderPayment, Product
from app.tconnect import decrypt, encrypt
from test_api import auth_response, headers, save_address, order_payload


class FakeGateway:
    key = os.urandom(32)

    def __init__(self):
        self.paid = {}
        self.created = []
        self.checks = 0

    def create_qr(self, reference, amount, request_id):
        self.created.append((reference, amount))
        return f'QR:{reference}:{amount}', 'iVBORw0KGgo='

    def paid_amount(self, reference):
        self.checks += 1
        return self.paid.get(reference, 0), 'BANKREF' if reference in self.paid else ''

    def close(self):
        pass


def build(tmp_path, gateway=None, **options):
    engine = make_engine(f'sqlite:///{(tmp_path / "flows.db").as_posix()}')
    Base.metadata.create_all(engine)
    with Session(engine) as db, db.begin():
        db.add_all([Category(id='m-tshirts', name_vi='Áo thun', name_en='T-shirts', department='men'),
                    Color(id='black', name_vi='Đen', name_en='Black', hex='#000000')])
        db.flush()
        db.add(Product(id=1, name_vi='Áo thun', name_en='T-shirt', category='m-tshirts', department='men',
                       price=100000, stock=50, colors=['black'], sizes=['M', 'L'], images=['/img/a.webp']))
    calls = []
    def counted(request):
        calls.append(request.headers.get('authorization'))
        return auth_response(request)
    auth_http = httpx.Client(transport=httpx.MockTransport(counted))
    # Pin options a developer's .env may set (docs, real TConnect credentials).
    options = {'enable_docs': False, 'tconnect_base_url': '', **options}
    settings = Settings(database_url='unused', supabase_url='https://auth.example', supabase_anon_key='public-test-key', **options)
    return TestClient(create_app(settings, engine=engine, auth_http=auth_http, gateway=gateway)), engine, calls


@pytest.fixture
def flows(tmp_path):
    gateway = FakeGateway()
    client, engine, calls = build(tmp_path, gateway)
    with client:
        yield client, engine, gateway, calls
    engine.dispose()


def qr_order(client, token='a'):
    address = save_address(client, token).json()['saved_address_id']
    return client.post('/api/orders', headers=headers(token), json=order_payload(address, payment='qr')).json()


def test_qr_order_must_be_paid_before_confirmation(flows):
    client, engine, gateway, _ = flows
    assert client.get('/api/payment-methods').json() == {'methods': ['cod', 'qr']}
    order = qr_order(client)
    qr = client.post(f"/api/orders/{order['id']}/qr", headers=headers()).json()['qr']
    assert qr['amount'] == 200000 and len(qr['reference']) <= 30
    # Retrying returns the stored QR instead of creating another one.
    assert client.post(f"/api/orders/{order['id']}/qr", headers=headers()).json()['qr'] == qr
    assert len(gateway.created) == 1
    assert client.post(f"/api/orders/{order['id']}/qr", headers=headers('b')).status_code == 404
    confirm = {'status': 'confirmed', 'expected_status': 'pending'}
    assert client.patch(f"/api/admin/orders/{order['id']}", headers=headers('admin'), json=confirm).json()['code'] == 'NB_PAYMENT_REQUIRED'
    assert client.post(f"/api/orders/{order['id']}/payment-check", headers=headers()).json()['order']['payment_status'] == 'unpaid'
    gateway.paid[qr['reference']] = 199999
    assert client.post(f"/api/orders/{order['id']}/payment-check", headers=headers()).json()['order']['payment_status'] == 'unpaid'
    gateway.paid[qr['reference']] = 200000
    assert client.post(f"/api/orders/{order['id']}/payment-check", headers=headers()).json()['order']['payment_status'] == 'received'
    assert client.patch(f"/api/admin/orders/{order['id']}", headers=headers('admin'), json=confirm).status_code == 200
    kinds = [(e['kind'], e['actor_role']) for e in client.get(f"/api/admin/orders/{order['id']}/events", headers=headers('admin')).json()['events']]
    assert kinds == [('created', 'customer'), ('payment', 'gateway'), ('status', 'admin')]
    assert client.get(f"/api/admin/orders/{order['id']}/events", headers=headers()).status_code == 403


def test_customer_cancel_checks_bank_first(flows):
    client, engine, gateway, _ = flows
    order = qr_order(client)
    qr = client.post(f"/api/orders/{order['id']}/qr", headers=headers()).json()['qr']
    gateway.paid[qr['reference']] = qr['amount']
    cancel = client.patch(f"/api/orders/{order['id']}", headers=headers(), json={'status': 'canceled', 'expected_status': 'pending'})
    assert cancel.json()['code'] == 'NB_PAID_ORDER_CANCEL'
    with Session(engine) as db:
        assert db.get(OrderPayment, order['id']) is not None
        assert db.get(Product, 1).stock == 48


def test_admin_cancel_of_paid_order_opens_refund(flows):
    client, engine, _, _ = flows
    address = save_address(client).json()['saved_address_id']
    order = client.post('/api/orders', headers=headers(), json=order_payload(address)).json()
    client.patch(f"/api/admin/orders/{order['id']}/payment", headers=headers('admin'), json={'received': True})
    canceled = client.patch(f"/api/admin/orders/{order['id']}", headers=headers('admin'), json={'status': 'canceled', 'expected_status': 'pending'}).json()
    assert canceled['refund_status'] == 'required' and canceled['refund_amount'] == 200000
    assert client.patch(f"/api/admin/orders/{order['id']}/refund", headers=headers(), json={'refunded': True}).status_code == 403
    done = client.patch(f"/api/admin/orders/{order['id']}/refund", headers=headers('admin'), json={'refunded': True}).json()
    assert done['refund_status'] == 'done'
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 50
    kinds = [e['kind'] for e in client.get(f"/api/admin/orders/{order['id']}/events", headers=headers('admin')).json()['events']]
    assert set(kinds) == {'created', 'payment', 'refund_required', 'status', 'refunded'}


def test_ipn_triggers_verified_payment_check(flows):
    client, engine, gateway, _ = flows
    order = qr_order(client)
    qr = client.post(f"/api/orders/{order['id']}/qr", headers=headers()).json()['qr']
    body = {'data': encrypt(json.dumps({'order_id': qr['reference'], 'amount': qr['amount']}), gateway.key)}
    # The notification alone is not trusted: unpaid at the gateway means still unpaid.
    assert client.post('/api/payments/tconnect/ipn', json=body).status_code == 200
    with Session(engine) as db:
        assert db.get(OrderPayment, order['id']) is None
    gateway.paid[qr['reference']] = qr['amount']
    assert client.post('/api/payments/tconnect/ipn', json=body).status_code == 200
    assert client.post('/api/payments/tconnect/ipn', json=body).status_code == 200
    with Session(engine) as db:
        assert db.get(OrderPayment, order['id']) is not None
    assert client.post('/api/payments/tconnect/ipn', json={'data': 'zz'}).status_code == 400
    assert decrypt(encrypt('ping', gateway.key), gateway.key) == 'ping'


def test_qr_is_refused_without_gateway(tmp_path):
    client, engine, _ = build(tmp_path)
    with client:
        assert client.get('/api/payment-methods').json() == {'methods': ['cod']}
        address = save_address(client).json()['saved_address_id']
        assert client.post('/api/orders', headers=headers(), json=order_payload(address, payment='qr')).json()['code'] == 'NB_PAYMENT_METHOD_UNAVAILABLE'
    engine.dispose()


def test_open_order_cap_and_rate_limits(tmp_path):
    client, engine, _ = build(tmp_path, max_open_orders=2)
    with client:
        address = save_address(client).json()['saved_address_id']
        codes = [client.post('/api/orders', headers=headers(), json=order_payload(address)).status_code for _ in range(3)]
        assert codes == [200, 200, 409]
        lookups = [client.get('/api/promotions/NOPE').status_code for _ in range(11)]
        assert lookups[:10] == [404] * 10 and lookups[10] == 429
    engine.dispose()


def test_promotion_rules(flows):
    client, engine, _, _ = flows
    admin = headers('admin')
    # Old clients send only code/percent/active as `expected`; rules default to "no limit".
    row = client.post('/api/admin/promotions', headers=admin, json={'code': 'ONCE', 'percent': 10, 'active': True, 'expected': None}).json()
    row = client.post('/api/admin/promotions', headers=admin, json={'code': 'ONCE', 'percent': 10, 'active': True, 'max_uses': 1, 'min_subtotal': 150000,
                                                                     'expected': {'code': 'ONCE', 'percent': 10, 'active': True}}).json()
    assert row['max_uses'] == 1 and row['used'] == 0
    address = save_address(client).json()['saved_address_id']
    small = order_payload(address, items=[{'product_id': 1, 'quantity': 1, 'color': 'black', 'size': 'M'}], promotion_code='ONCE', expected_discount=10000)
    assert client.post('/api/orders', headers=headers(), json=small).json()['code'] == 'NB_PROMOTION_MIN_SUBTOTAL'
    first = client.post('/api/orders', headers=headers(), json=order_payload(address, promotion_code='ONCE', expected_discount=20000))
    assert first.status_code == 200
    assert client.post('/api/orders', headers=headers('b'), json=order_payload(save_address(client, 'b').json()['saved_address_id'], promotion_code='ONCE', expected_discount=20000)).json()['code'] == 'NB_PROMOTION_EXHAUSTED'
    assert client.get('/api/promotions/ONCE').json()['code'] == 'NB_PROMOTION_EXHAUSTED'
    # Canceling frees the use again.
    client.patch(f"/api/orders/{first.json()['id']}", headers=headers(), json={'status': 'canceled', 'expected_status': 'pending'})
    assert client.get('/api/promotions/ONCE').status_code == 200
    listed = client.get('/api/admin/promotions', headers=admin).json()['promotions'][0]
    past = (datetime.now(timezone(timedelta(hours=7))) - timedelta(minutes=1)).isoformat()
    saved = client.post('/api/admin/promotions', headers=admin, json={'code': 'ONCE', 'percent': 10, 'active': True, 'ends_at': past, 'max_uses': 1, 'min_subtotal': 150000, 'expected': listed})
    assert saved.status_code == 200
    # The listed row round-trips as `expected` even with a timezone-aware end time.
    again = client.get('/api/admin/promotions', headers=admin).json()['promotions'][0]
    assert client.post('/api/admin/promotions', headers=admin, json={'code': 'ONCE', 'percent': 10, 'active': True, 'ends_at': past, 'max_uses': 1, 'min_subtotal': 150000, 'expected': again}).status_code == 200
    assert client.get('/api/promotions/ONCE').json()['code'] == 'NB_PROMOTION_EXPIRED'


def test_archive_hides_product_from_shop(flows):
    client, engine, _, _ = flows
    admin = headers('admin')
    assert client.post('/api/admin/products/1/archive', headers=headers(), json={'archived': True}).status_code == 403
    assert client.post('/api/admin/products/1/archive', headers=admin, json={'archived': True, 'reason': 'Discontinued'}).json()['archived'] is True
    assert client.get('/api/product-page').json()['total'] == 0
    assert [p['id'] for p in client.get('/api/product-page?archived=only').json()['products']] == [1]
    address = save_address(client).json()['saved_address_id']
    assert client.post('/api/orders', headers=headers(), json=order_payload(address)).json()['code'] == 'NB_PRODUCT_NOT_FOUND'
    client.post('/api/admin/products/1/archive', headers=admin, json={'archived': False})
    assert client.get('/api/product-page').json()['total'] == 1


def test_auth_lookups_are_cached_and_docs_hidden(flows):
    client, _, _, calls = flows
    client.get('/api/wishlist', headers=headers())
    client.get('/api/wishlist', headers=headers())
    assert calls.count('Bearer a') == 1
    assert client.get('/docs').status_code == 404 and client.get('/openapi.json').status_code == 404
    response = client.get('/api/health')
    assert response.headers['x-content-type-options'] == 'nosniff' and response.headers['x-frame-options'] == 'DENY'


def test_csv_neutralizes_tab_and_carriage_return_prefixes():
    rows = list(csv.reader(io.StringIO(csv_text([['\t=1+1', '\rcmd', 'ok']]).removeprefix('﻿'), newline='')))
    assert rows == [["'\t=1+1", "'\rcmd", 'ok']]
