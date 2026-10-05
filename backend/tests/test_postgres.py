"""Exercise the PostgreSQL SQL path against the existing migrations via psycopg.

PGlite uses one connection; these tests verify SQL/types/transactions, while
concurrent request tests run on SQLite. Native PostgreSQL concurrency remains
a deployment check.
"""
from pathlib import Path
import socket
import subprocess
import time

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import make_engine
from app.main import create_app
from app.models import Order, Product, OrderPayment
from datetime import datetime, timezone
from uuid import uuid4
from app.migrate_shop import migrate
from test_api import A, B, ADMIN, auth_response, headers, order_payload, save_address


@pytest.fixture
def pg_shop(tmp_path_factory):
    workspace = Path(__file__).resolve().parents[2]
    script = workspace / 'frontend' / 'supabase' / 'python-api-db.mjs'
    ready = tmp_path_factory.mktemp('postgres') / 'ready'
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    process = subprocess.Popen(['node', str(script), str(port), str(ready)],
                               stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    engine = None
    auth_http = None
    try:
        deadline = time.monotonic() + 90
        while not ready.exists():
            if process.poll() is not None:
                pytest.fail(process.stderr.read().decode('utf-8', errors='replace'))
            if time.monotonic() > deadline:
                pytest.fail('PostgreSQL test database did not start in 90 seconds')
            time.sleep(0.05)
        engine = make_engine(f'postgresql+psycopg://postgres@127.0.0.1:{port}/postgres?sslmode=disable')
        migrate(engine)
        # Return the only physical connection to the PGlite socket between operations.
        with engine.begin() as connection:
            for owner in (A, B, ADMIN):
                connection.execute(text('INSERT INTO auth.users(id) VALUES (:owner)'), {'owner': owner})
        auth_http = httpx.Client(transport=httpx.MockTransport(auth_response))
        app = create_app(Settings(supabase_url='https://auth.example', supabase_anon_key='public-test-key'),
                         engine=engine, auth_http=auth_http)
        with TestClient(app) as client:
            yield client, engine
    finally:
        if auth_http:
            auth_http.close()
        if engine:
            engine.dispose()
        if process.poll() is None:
            process.stdin.write(b'stop\n')
            process.stdin.flush()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        process.stdin.close()
        process.stderr.close()


def test_postgres_demo_orders_are_labeled_and_excluded_from_default_statistics(pg_shop):
    from test_api import check_demo_statistics
    check_demo_statistics(*pg_shop)


def test_postgres_admin_history_alerts_notifications_and_export(pg_shop):
    from test_admin_tools import check_admin_flows
    check_admin_flows(*pg_shop)


def test_postgres_open_order_sql_matches_product_options_and_legacy_lines(pg_shop):
    from test_api import check_open_order_sql
    check_open_order_sql(pg_shop[1])


def test_postgres_existing_schema_uuid_jsonb_array_sequence_and_address_revision(pg_shop):
    client, engine = pg_shop
    with engine.begin() as connection:
        assert connection.scalar(text("SELECT has_function_privilege('authenticated', 'public.place_shop_order(jsonb,uuid,text,uuid)', 'EXECUTE')")) is False
    assert client.get('/api/health').json()['database'] == 'postgresql'
    page = client.get('/api/product-page', params={'q': 'ao thun den', 'colors': 'black', 'limit': 2, 'sort': 'priceAsc'}).json()
    assert page['total'] > 2 and len(page['products']) == 2
    assert all('black' in p['colors'] for p in page['products'])
    assert page['products'][0]['price'] <= page['products'][1]['price']
    assert client.get('/api/product-page', params={'sizes': 'not-a-size'}).json()['total'] == 0
    result = client.get('/api/products', params={'q': 'ao thun'}).json()
    assert result['total'] > 0 and isinstance(result['items'][0]['colors'], list)
    book = save_address(client).json()
    assert book['revision'] == 1 and book['default_address_id'] == book['saved_address_id']
    assert client.get('/api/addresses', headers=headers()).json()['addresses'][0]['name'] == 'Nguyễn An'
    assert save_address(client, revision=0).status_code == 409
    assert client.get('/api/addresses', headers=headers('b')).json()['addresses'] == []
    product = client.post('/api/admin/products', headers=headers('admin'), json={
        'name': 'Áo PostgreSQL', 'category': 'm-tshirts', 'price': 123000, 'stock': 5, 'image': '/img/test.webp',
    }).json()
    assert product['id'] >= 2000 and product['stock'] == 5

    # The additive tables and lifecycle run against real PostgreSQL SQL types.
    assert client.post('/api/wishlist', headers=headers(), json={'product_id': product['id'], 'saved': True}).json()['product_ids'] == [product['id']]
    assert client.get('/api/wishlist', headers=headers('b')).json()['product_ids'] == []
    assert client.post('/api/admin/promotions', headers=headers('admin'), json={'code': 'PG10', 'percent': 10, 'active': True, 'expected': None}).status_code == 200
    values = order_payload(book['saved_address_id'], items=[{'product_id': product['id'], 'quantity': 2, 'expected_price': 123000}], promotion_code='PG10', expected_discount=24600)
    order = client.post('/api/orders', headers=headers(), json=values).json()
    assert order['total'] == 221400 and order['discount'] == 24600
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json={'status': 'canceled', 'expected_status': 'pending'}).json()['status'] == 'canceled'
    assert client.get('/api/products/' + str(product['id'])).json()['product']['stock'] == 5
    allocation = {'expected_revision': None, 'expected_stock': 5, 'variants': [{'color': '', 'size': '', 'stock': 5}]}
    assert client.patch('/api/admin/products/' + str(product['id']) + '/variants', headers=headers('admin'), json=allocation).status_code == 200
    paid_order = client.post('/api/orders', headers=headers(), json=order_payload(book['saved_address_id'], items=[{'product_id': product['id'], 'quantity': 2, 'expected_price': 123000}])).json()
    assert paid_order['items'][0]['variant_stock'] is True
    assert client.patch('/api/admin/orders/' + paid_order['id'] + '/payment', headers=headers('admin'), json={'received': True}).json()['payment_status'] == 'received'
    assert client.get('/api/orders', headers=headers(), params={'q': paid_order['id'], 'paid': 'received', 'limit': 1}).json()['total'] == 1
    for query in ('Nguyễn An', 'nguyen an', '  NGUYEN   AN  '):
        assert client.get('/api/orders', headers=headers(), params={'q': query, 'paid': 'received', 'limit': 1}).json()['total'] == 1
        assert client.get('/api/orders', headers=headers('b'), params={'q': query}).json()['total'] == 0
    with Session(engine) as db, db.begin():
        db.get(Order, paid_order['id']).created_at = datetime(2026, 3, 31, 18, tzinfo=timezone.utc)
        db.get(OrderPayment, paid_order['id']).received_at = datetime(2026, 4, 1, 18, tzinfo=timezone.utc)
    report = client.get('/api/admin/report', headers=headers('admin'), params={'start': '2026-04-01', 'end': '2026-04-02'}).json()
    assert report['series'][0]['order_value'] == 246000 and report['series'][1]['received'] == 246000
    values = {'request_id': str(uuid4()), 'name': 'Retry PG', 'category': 'm-tshirts', 'price': 1000, 'stock': 2, 'image': '/img/test.webp'}
    first = client.post('/api/admin/products', headers=headers('admin'), json=values).json()
    assert client.post('/api/admin/products', headers=headers('admin'), json=values).json()['id'] == first['id']


def test_postgres_order_server_price_retry_conflict_and_rollback(pg_shop):
    client, engine = pg_shop
    address = save_address(client).json()['saved_address_id']
    product = client.post('/api/admin/products', headers=headers('admin'), json={
        'name': 'Áo PostgreSQL', 'category': 'm-tshirts', 'price': 123000, 'stock': 5, 'image': '/img/test.webp',
    }).json()
    values = order_payload(address, items=[{'product_id': product['id'], 'quantity': 2}])
    response = client.post('/api/orders', headers=headers(), json=values)
    assert response.status_code == 200, response.text
    order = response.json()
    assert order['total'] == 246000
    assert client.post('/api/orders', headers=headers(), json=values).json()['id'] == order['id']
    assert client.post('/api/orders', headers=headers(), json={**values, 'payment': 'qr'}).status_code == 409
    invalid = order_payload(address, items=[{'product_id': product['id'], 'quantity': 1}, {'product_id': 999999, 'quantity': 1}])
    assert client.post('/api/orders', headers=headers(), json=invalid).status_code == 404
    with Session(engine) as db:
        assert db.get(Product, product['id']).stock == 3
        assert len(list(db.scalars(select(Order)))) == 1


def test_postgres_product_edit_detects_stock_changed_by_order(pg_shop):
    client, _ = pg_shop
    address = save_address(client).json()['saved_address_id']
    product = client.post('/api/admin/products', headers=headers('admin'), json={
        'name': 'Áo PostgreSQL', 'category': 'm-tshirts', 'price': 123000, 'stock': 5, 'image': '/img/test.webp',
    }).json()
    assert client.post('/api/orders', headers=headers(), json=order_payload(
        address, items=[{'product_id': product['id'], 'quantity': 2}],
    )).status_code == 200
    path = f'/api/admin/products/{product["id"]}'
    values = {'name': 'Áo PostgreSQL đã sửa', 'price': 150000, 'stock': 10, 'description': 'Mô tả thử nghiệm',
              'expected': {'name': product['name_vi'], 'price': product['price'], 'stock': 5, 'description': ''}}
    assert client.patch(path, headers=headers('admin'), json=values).status_code == 409
    values['expected']['stock'] = 3
    response = client.patch(path, headers=headers('admin'), json=values)
    assert response.status_code == 200 and response.json()['description'] == 'Mô tả thử nghiệm'
