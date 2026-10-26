from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import make_engine
from app.main import create_app
from app.models import Base, Category, Color, Order, Product, OrderPayment, OrderRefund, VariantInventory
from datetime import datetime, timezone

A, B, ADMIN = (str(uuid4()) for _ in range(3))
ADDRESS = {'name': ' Nguyễn  An ', 'email': 'an@example.com', 'phone': '0901234567',
           'city': 'Hồ Chí Minh', 'address': '12 Nguyễn Huệ', 'notes': ''}


def auth_response(request):
    assert request.url.path == '/auth/v1/user'
    assert request.headers['apikey'] == 'public-test-key'
    token = request.headers.get('authorization', '').removeprefix('Bearer ')
    if token == 'offline':
        raise httpx.ConnectError('offline', request=request)
    if token == 'expired':
        return httpx.Response(401, json={'message': 'expired'})
    if token not in ('a', 'b', 'admin', 'spoof', 'anonymous', 'unconfirmed'):
        return httpx.Response(403)
    return httpx.Response(200, json={
        'id': ADMIN if token == 'admin' else B if token == 'b' else A,
        'email_confirmed_at': None if token == 'unconfirmed' else '2026-10-03T00:00:00Z',
        'is_anonymous': token == 'anonymous',
        'app_metadata': {'role': 'admin' if token == 'admin' else 'customer'},
        'user_metadata': {'role': 'admin'},
    })


@pytest.fixture
def shop(tmp_path):
    engine = make_engine(f'sqlite:///{(tmp_path / "test.db").as_posix()}')
    Base.metadata.create_all(engine)
    with Session(engine) as db, db.begin():
        db.add_all([
            Category(id='m-tshirts', name_vi='Áo thun', name_en='T-shirts', department='men'),
            Category(id='w-dresses', name_vi='Váy', name_en='Dresses', department='women'),
            Color(id='black', name_vi='Đen', name_en='Black', hex='#000000'),
        ])
        db.flush()
        db.add_all([
            Product(id=1, name_vi='Áo thun cổ điển', name_en='Classic T-shirt', category='m-tshirts',
                    department='men', price=100000, stock=5, colors=['black'], sizes=['M', 'L'], images=['/img/a.webp']),
            Product(id=2, name_vi='Váy dài', name_en='Long dress', category='w-dresses', department='women',
                    price=250000, stock=2, colors=[], sizes=[], images=[]),
        ])
    auth_http = httpx.Client(transport=httpx.MockTransport(auth_response))
    app = create_app(Settings(database_url='unused', supabase_url='https://auth.example', supabase_anon_key='public-test-key', tconnect_base_url=''),
                     engine=engine, auth_http=auth_http)
    with TestClient(app) as client:
        yield client, engine
    auth_http.close()
    engine.dispose()


def headers(token='a'):
    return {'Authorization': f'Bearer {token}'}


def save_address(client, token='a', revision=0, **changes):
    return client.post('/api/addresses', headers=headers(token), json={
        'action': 'save', 'expected_revision': revision, 'address': {**ADDRESS, **changes},
    })


def order_payload(address_id, **changes):
    return {'items': [{'product_id': 1, 'quantity': 2, 'color': 'black', 'size': 'M'}],
            'address_id': address_id, 'payment': 'cod', 'request_id': str(uuid4()), **changes}


def test_overview_distinguishes_product_count_from_reserved_stock_and_cancellation(shop):
    client, _ = shop
    before = client.get('/api/admin/overview', headers=headers('admin')).json()
    assert before['products'] == 2
    assert before['stock_units'] == 7
    address = save_address(client).json()['default_address_id']
    order = client.post('/api/orders', headers=headers(), json=order_payload(address)).json()
    after = client.get('/api/admin/overview', headers=headers('admin')).json()
    assert after['products'] == 2
    assert after['stock_units'] == 5
    assert client.patch('/api/orders/' + order['id'], headers=headers(),
                        json={'status': 'canceled', 'expected_status': 'pending'}).status_code == 200
    restored = client.get('/api/admin/overview', headers=headers('admin')).json()
    assert restored['products'] == 2
    assert restored['stock_units'] == 7


def test_catalog_search_accents_english_colors_id_department_and_pagination(shop):
    client, _ = shop
    assert client.get('/api/health').json()['status'] == 'ok'
    for query in ['ÁO THUN', '  ao   thun den ', 'classic BLACK', 'co dien nam', '1']:
        data = client.get('/api/products', params={'q': query}).json()
        assert [p['id'] for p in data['items']] == [1]
    assert client.get('/api/catalog', params={'q': 'vay'}).json()['products'][0]['id'] == 2
    assert client.get('/api/catalog', params={'q': 'unknown'}).json()['total'] == 0
    assert client.get('/api/catalog', params={'q': "' OR 1=1 --"}).json()['total'] == 0


def test_product_pages_filter_before_sql_pagination_and_keep_global_totals(shop):
    client, engine = shop
    first = client.get('/api/product-page', params={'limit': 1}).json()
    second = client.get('/api/product-page', params={'limit': 1, 'page': 2}).json()
    assert first['total'] == second['total'] == 2
    assert first['pages'] == 2 and first['stock_units'] == 7
    assert [p['id'] for p in first['products']] == [1]
    assert [p['id'] for p in second['products']] == [2]
    assert client.get('/api/product-page', params={'page': 10, 'limit': 1}).json()['products'] == []
    for query in ['ÁO THUN', 'ao thun den', 'classic BLACK', 'co dien nam']:
        result = client.get('/api/product-page', params={'q': query}).json()
        assert [p['id'] for p in result['products']] == [1]
    filtered = client.get('/api/product-page', params={'categories': 'm-tshirts', 'colors': 'black', 'sizes': 'L', 'stock': 'low'}).json()
    assert filtered['total'] == 1 and filtered['stock_units'] == 5
    assert 'M' in filtered['sizes'] and 'L' in filtered['sizes']
    # Storefront filter options: only colors used by active products in the department.
    assert client.get('/api/product-page', params={'department': 'men'}).json()['color_options'] == ['black']
    # The black T-shirt is unisex, so its colour is offered under women too.
    assert client.get('/api/product-page', params={'department': 'women'}).json()['color_options'] == ['black']
    assert client.get('/api/product-page', params={'sizes': 'unknown'}).json()['total'] == 0
    assert client.get('/api/product-page', params={'q': '%'}).json()['total'] == 0
    assert client.get('/api/product-page', params={'sort': 'priceDesc', 'limit': 1}).json()['products'][0]['id'] == 2
    assert client.get('/api/product-page', params={'page': 0}).status_code == 422
    assert client.get('/api/product-page', params={'limit': 101}).status_code == 422


def test_wishlist_and_promotion_pages_are_bounded_and_owner_scoped(shop):
    client, _ = shop
    for product_id in [1, 2]:
        assert client.post('/api/wishlist', headers=headers(), json={'product_id': product_id, 'saved': True}).status_code == 200
    assert client.get('/api/wishlist/products').status_code == 401
    assert client.get('/api/wishlist/products', headers=headers('b')).json()['total'] == 0
    page = client.get('/api/wishlist/products', headers=headers(), params={'page': 2, 'limit': 1}).json()
    assert page['total'] == 2 and [p['id'] for p in page['products']] == [2]
    for code in ['PAGEA', 'PAGEB', 'PAGEC']:
        client.post('/api/admin/promotions', headers=headers('admin'), json={'code': code, 'percent': 10, 'active': True, 'expected': None})
    page = client.get('/api/admin/promotions', headers=headers('admin'), params={'page': 2, 'limit': 2}).json()
    assert page['total'] == 3 and page['pages'] == 2
    assert [p['code'] for p in page['promotions']] == ['PAGEC']


def test_newest_sort_uses_creation_date_and_low_stock_card_includes_sold_out(shop):
    client, engine = shop
    with Session(engine) as db, db.begin():
        db.get(Product, 1).created_at = datetime(2026, 10, 5, tzinfo=timezone.utc)
        db.get(Product, 1).is_new = False
        db.get(Product, 2).created_at = datetime(2026, 10, 1, tzinfo=timezone.utc)
        db.get(Product, 2).is_new = True
        db.get(Product, 2).stock = 0
    page = client.get('/api/product-page', params={'sort': 'new', 'limit': 1}).json()
    assert page['products'][0]['id'] == 1
    assert client.get('/api/product-page', params={'stock': 'low_or_out'}).json()['total'] == 2
    assert client.get('/api/product-page', params={'stock': 'low'}).json()['total'] == 1


def test_color_names_follow_database_updates_in_detail_and_cart_batches(shop):
    client, engine = shop
    with Session(engine) as db, db.begin():
        db.get(Color, 'black').name_en = 'Midnight black'
    expected = {'vi': 'Đen', 'en': 'Midnight black'}
    assert client.get('/api/products/1').json()['product']['color_names']['black'] == expected
    assert client.get('/api/products/by-ids?ids=1').json()['products'][0]['color_names']['black'] == expected


def check_demo_statistics(client, engine):
    from app.models import DemoOrder
    address = save_address(client).json()['saved_address_id']
    product = client.post('/api/admin/products', headers=headers('admin'), json={'name': 'Statistics fixture', 'category': 'm-tshirts', 'price': 100000, 'stock': 5, 'image': '/img/test.webp'}).json()
    values = order_payload(address, items=[{'product_id': product['id'], 'quantity': 2}])
    first = client.post('/api/orders', headers=headers(), json=values)
    second = client.post('/api/orders', headers=headers(), json={**values, 'request_id': str(uuid4())})
    assert first.status_code == 200 and second.status_code == 200
    real, demo = first.json(), second.json()
    assert real['id'] != demo['id']
    with Session(engine) as db, db.begin():
        db.add(DemoOrder(order_id=demo['id']))
    for row in (real, demo):
        assert client.patch('/api/admin/orders/' + row['id'] + '/payment', headers=headers('admin'), json={'received': True}).status_code == 200
    default = client.get('/api/admin/overview', headers=headers('admin')).json()
    included = client.get('/api/admin/overview?include_test=true', headers=headers('admin')).json()
    assert default['orders'] == 1 and included['orders'] == 2
    assert default['received'] == real['total'] and included['received'] == real['total'] + demo['total']
    for scope, row in [('real', real), ('test', demo)]:
        result = client.get('/api/admin/orders', headers=headers('admin'), params={'scope': scope, 'limit': 1}).json()
        assert result['total'] == 1 and result['orders'][0]['id'] == row['id']
        assert result['orders'][0]['is_test'] == (scope == 'test')
    assert client.get('/api/orders', headers=headers('b')).json()['total'] == 0
    report = client.get('/api/admin/report', headers=headers('admin')).json()
    with_test = client.get('/api/admin/report?include_test=true', headers=headers('admin')).json()
    assert report['orders'] == 1 and with_test['orders'] == 2
    assert report['received'] == real['total'] and with_test['received'] == real['total'] + demo['total']


def test_demo_orders_are_labeled_and_excluded_from_default_statistics(shop):
    check_demo_statistics(*shop)


def test_cart_product_selection_is_bounded_and_detail_metadata_needs_no_catalog(shop):
    client, _ = shop
    response = client.get('/api/products/by-ids', params={'ids': '2,2,999'})
    assert response.status_code == 200
    assert [p['id'] for p in response.json()['products']] == [2]
    assert client.get('/api/products/by-ids').json()['products'] == []
    assert client.get('/api/products/by-ids', params={'ids': 'abc'}).status_code == 422
    assert client.get('/api/products/by-ids', params={'ids': '0'}).status_code == 422
    assert client.get('/api/products/by-ids', params={'ids': ','.join(str(n) for n in range(1, 102))}).status_code == 422
    detail = client.get('/api/products/1').json()
    assert len(detail['categories']) == 2 and len(detail['colors']) == 1
    assert client.get('/api/catalog', params={'department': 'women', 'q': 'ao'}).json()['total'] == 0
    assert client.get('/api/products', params={'limit': 1, 'offset': 1}).json()['items'][0]['id'] == 2
    assert client.get('/api/products/999').status_code == 404
    assert client.get('/api/products', params={'q': 'x' * 121}).status_code == 422


@pytest.mark.parametrize('token', [None, 'expired', 'anonymous', 'unconfirmed', 'invalid'])
def test_invalid_auth_cannot_read_or_write_addresses(shop, token):
    client, _ = shop
    auth = headers(token) if token else {}
    assert client.get('/api/addresses', headers=auth).status_code == 401
    assert client.post('/api/addresses', headers=auth, json={'action': 'delete', 'id': str(uuid4()), 'expected_revision': 0}).status_code == 401


def test_auth_outage_fails_closed(shop):
    client, _ = shop
    assert client.get('/api/addresses', headers=headers('offline')).status_code == 503


def test_server_permissions_ignore_user_metadata_and_body_owner(shop):
    client, _ = shop
    values = {'name': 'Áo mới', 'category': 'm-tshirts', 'price': 1, 'stock': 5, 'image': '/img/test.webp'}
    assert client.post('/api/admin/products', headers=headers('spoof'), json=values).status_code == 403
    assert client.get('/api/addresses', headers=headers('admin')).status_code == 403
    assert client.post('/api/addresses', headers=headers(), json={
        'action': 'save', 'address': ADDRESS, 'expected_revision': 0, 'user_id': B,
    }).status_code == 422
    address = save_address(client).json()['saved_address_id']
    assert client.get('/api/addresses', headers=headers('b')).json()['addresses'] == []
    assert client.post('/api/addresses', headers=headers('b'), json={
        'action': 'delete', 'id': address, 'expected_revision': 0,
    }).status_code == 404
    assert client.post('/api/orders', headers=headers('b'), json=order_payload(address)).status_code == 404
    assert len(client.get('/api/addresses', headers=headers()).json()['addresses']) == 1


def test_addresses_default_limit_revision_and_delete_are_atomic(shop):
    client, _ = shop
    book = save_address(client).json()
    first = book['saved_address_id']
    assert book['default_address_id'] == first
    assert book['addresses'][0]['name'] == 'Nguyễn An'
    assert save_address(client, revision=0).status_code == 409
    for revision in range(1, 5):
        book = save_address(client, revision=revision).json()
    assert save_address(client, revision=5).json()['code'] == 'NB_ADDRESS_LIMIT'
    second = book['addresses'][1]['id']
    book = client.post('/api/addresses', headers=headers(), json={
        'action': 'default', 'id': second, 'expected_revision': 5,
    }).json()
    assert book['default_address_id'] == second
    book = client.post('/api/addresses', headers=headers(), json={
        'action': 'delete', 'id': second, 'expected_revision': 6,
    }).json()
    assert book['default_address_id'] == first and len(book['addresses']) == 4 and book['revision'] == 7


def test_invalid_address_rolls_back_without_creating_a_book(shop):
    client, _ = shop
    for change in [{'phone': '+84901234567'}, {'email': 'invalid'}, {'name': ' '}, {'notes': 'x' * 501}, {'city': 3}]:
        assert save_address(client, **change).status_code == 422
    assert client.get('/api/addresses', headers=headers()).json()['revision'] == 0


def test_admin_create_update_persist_and_stale_inventory_conflicts(shop):
    client, _ = shop
    values = {'name': 'Áo mới', 'category': 'm-tshirts', 'price': 123, 'stock': 7, 'image': '/img/test.webp'}
    response = client.post('/api/admin/products', headers=headers('admin'), json=values)
    assert response.status_code == 201
    product = response.json()
    assert client.get(f'/api/products/{product["id"]}').json()['product']['stock'] == 7
    edit = {'name': 'Tên mới', 'price': 456, 'stock': 8, 'description': 'Mô tả',
            'expected': {'name': product['name_vi'], 'price': 123, 'stock': 7, 'description': ''}}
    path = f'/api/admin/products/{product["id"]}'
    assert client.patch(path, headers=headers(), json=edit).status_code == 403
    assert client.patch(path, headers=headers('admin'), json=edit).json()['description'] == 'Mô tả'
    assert client.patch(path, headers=headers('admin'), json=edit).status_code == 409
    assert client.post('/api/admin/products', headers=headers('admin'), json={**values, 'stock': -1}).status_code == 422
    assert client.post('/api/admin/products', headers=headers('admin'), json={**values, 'price': True}).status_code == 422


def test_order_database_price_variants_aggregation_and_idempotent_retry(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    values = order_payload(address, items=[{'product_id': 1, 'quantity': 1, 'color': 'black', 'size': 'M'},
                                         {'product_id': 1, 'quantity': 2, 'color': 'black', 'size': 'L'}])
    response = client.post('/api/orders', headers=headers(), json=values)
    assert response.status_code == 200
    order = response.json()
    assert order['total'] == 300000 and order['delivery']['name'] == 'Nguyễn An'
    assert client.post('/api/orders', headers=headers(), json=values).json()['id'] == order['id']
    assert client.post('/api/orders', headers=headers(), json={**values, 'payment': 'qr'}).status_code == 409
    assert client.post('/api/orders', headers=headers('admin'), json=values).status_code == 403
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 2
        assert db.scalar(select(func.count()).select_from(Order)) == 1


@pytest.mark.parametrize('items,code', [
    ([{'product_id': 1, 'quantity': 6, 'color': 'black', 'size': 'M'}], 'NB_INSUFFICIENT_STOCK'),
    ([{'product_id': 1, 'quantity': 1, 'color': 'white', 'size': 'M'}], 'NB_INVALID_ORDER'),
    ([{'product_id': 1, 'quantity': 1, 'color': 'black', 'size': 'M'}, {'product_id': 999, 'quantity': 1}], 'NB_PRODUCT_NOT_FOUND'),
])
def test_invalid_order_rolls_back_all_stock_and_order_writes(shop, items, code):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    assert client.post('/api/orders', headers=headers(), json=order_payload(address, items=items)).json()['code'] == code
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 5
        assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_client_price_and_invalid_quantity_are_rejected(shop):
    client, _ = shop
    address = save_address(client).json()['saved_address_id']
    for quantity in [0, -1, True, 1.5, '2', 100]:
        assert client.post('/api/orders', headers=headers(), json=order_payload(address, items=[{'product_id': 1, 'quantity': quantity}])).status_code == 422
    assert client.post('/api/orders', headers=headers(), json=order_payload(address, total=1)).status_code == 422


def test_simultaneous_buyers_cannot_oversell(shop):
    client, engine = shop
    addresses = [save_address(client, token=token).json()['saved_address_id'] for token in ('a', 'b')]
    def buy(pair):
        token, address = pair
        values = order_payload(address, items=[{'product_id': 1, 'quantity': 3, 'color': 'black', 'size': 'M'}])
        return client.post('/api/orders', headers=headers(token), json=values)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(buy, zip(('a', 'b'), addresses)))
    assert sorted(response.status_code for response in responses) == [200, 409]
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 2
        assert db.scalar(select(func.count()).select_from(Order)) == 1


def test_simultaneous_retries_create_one_order(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    values = order_payload(address)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post('/api/orders', headers=headers(), json=values), range(2)))
    assert all(response.status_code == 200 for response in responses)
    assert responses[0].json()['id'] == responses[1].json()['id']
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 3


def test_private_responses_are_not_cached_and_large_body_rejected(shop):
    client, _ = shop
    assert client.get('/api/addresses', headers=headers()).headers['cache-control'] == 'no-store'
    assert client.post('/api/admin/products', headers=headers('admin'), content=b'x' * (4 * 1024 * 1024 + 1)).status_code == 413


def test_commit_failure_never_reports_success_or_leaves_stock_deducted(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    def unavailable(_):
        raise SQLAlchemyError('simulated database commit failure')
    event.listen(Session, 'before_commit', unavailable)
    try:
        response = client.post('/api/orders', headers=headers(), json=order_payload(address))
        assert response.status_code == 503 and response.json()['code'] == 'NB_DATABASE_UNAVAILABLE'
    finally:
        event.remove(Session, 'before_commit', unavailable)
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 5
        assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_missing_auth_configuration_allows_catalog_but_rejects_protected_api(shop):
    client, _ = shop
    client.app.state.settings = Settings(database_url='unused', supabase_url='', supabase_anon_key='')
    assert client.get('/api/catalog').status_code == 200
    response = client.get('/api/addresses', headers=headers())
    assert response.status_code == 503 and response.json()['code'] == 'NB_AUTH_NOT_CONFIGURED'


def test_order_history_owner_permissions_lifecycle_and_single_stock_restoration(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    payload = order_payload(address)
    order = client.post('/api/orders', headers=headers(), json=payload).json()
    assert client.get('/api/orders', headers=headers()).json()['orders'][0]['id'] == order['id']
    assert client.get('/api/orders', headers=headers('b')).json()['orders'] == []
    change = {'status': 'canceled', 'expected_status': 'pending'}
    assert client.patch('/api/orders/' + order['id'], headers=headers('b'), json=change).status_code == 404
    assert client.get('/api/admin/orders', headers=headers()).status_code == 403
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json={'status': 'confirmed', 'expected_status': 'pending'}).status_code == 409
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json=change).json()['status'] == 'canceled'
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json=change).status_code == 409
    assert client.post('/api/orders', headers=headers(), json=payload).json()['status'] == 'canceled'
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 5
    delivered = client.post('/api/orders', headers=headers(), json=order_payload(address)).json()
    previous = 'pending'
    for status in ('confirmed', 'shipped', 'delivered'):
        result = client.patch('/api/admin/orders/' + delivered['id'], headers=headers('admin'), json={'status': status, 'expected_status': previous})
        assert result.status_code == 200
        previous = status
    assert client.patch('/api/admin/orders/' + delivered['id'], headers=headers('admin'), json={'status': 'canceled', 'expected_status': 'delivered'}).status_code == 409
    report = client.get('/api/admin/overview', headers=headers('admin')).json()
    assert report['orders'] == 2 and report['delivered'] == 1 and report['revenue'] == 200000


def test_price_review_rolls_back_without_deducting_stock(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    values = order_payload(address, items=[{'product_id': 1, 'quantity': 2, 'color': 'black', 'size': 'M', 'expected_price': 90000}])
    result = client.post('/api/orders', headers=headers(), json=values)
    assert result.status_code == 409 and result.json()['code'] == 'NB_PRICE_CHANGED'
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 5
        assert db.scalar(select(func.count()).select_from(Order)) == 0
    result = client.post('/api/orders', headers=headers(), json=order_payload(address, items=[{'product_id': 2, 'quantity': 1, 'color': 'black'}]))
    assert result.status_code == 422


def test_wishlist_persists_per_customer_and_repeated_saves_are_idempotent(shop):
    client, _ = shop
    for _ in range(2):
        assert client.post('/api/wishlist', headers=headers(), json={'product_id': 1, 'saved': True}).json()['product_ids'] == [1]
    assert client.get('/api/wishlist', headers=headers('b')).json()['product_ids'] == []
    assert client.get('/api/wishlist').status_code == 401
    assert client.post('/api/wishlist', headers=headers('admin'), json={'product_id': 1, 'saved': True}).status_code == 403
    assert client.post('/api/wishlist', headers=headers(), json={'product_id': 999, 'saved': True}).status_code == 404
    assert client.post('/api/wishlist', headers=headers(), json={'product_id': 1, 'saved': False}).json()['product_ids'] == []


def test_promotion_review_snapshot_conflict_and_retry_after_deactivation(shop):
    client, engine = shop
    promotion = {'code': 'WELCOME10', 'percent': 10, 'active': True, 'expected': None}
    assert client.post('/api/admin/promotions', headers=headers(), json=promotion).status_code == 403
    saved = client.post('/api/admin/promotions', headers=headers('admin'), json=promotion).json()
    assert client.post('/api/admin/promotions', headers=headers('admin'), json=promotion).status_code == 409
    assert client.get('/api/promotions/WELCOME10').json()['percent'] == 10
    address = save_address(client).json()['saved_address_id']
    values = order_payload(address, promotion_code='WELCOME10', expected_discount=20000)
    bad = {**values, 'expected_discount': 10000}
    assert client.post('/api/orders', headers=headers(), json=bad).json()['code'] == 'NB_PRICE_CHANGED'
    order = client.post('/api/orders', headers=headers(), json=values).json()
    assert order['total'] == 180000 and order['subtotal'] == 200000 and order['discount'] == 20000
    inactive = {**promotion, 'active': False, 'expected': saved}
    assert client.post('/api/admin/promotions', headers=headers('admin'), json=inactive).status_code == 200
    assert client.get('/api/promotions/WELCOME10').status_code == 404
    assert client.post('/api/orders', headers=headers(), json=values).json()['id'] == order['id']
    assert client.post('/api/orders', headers=headers(), json={**values, 'request_id': str(uuid4())}).json()['code'] == 'NB_PROMOTION_INVALID'
    assert client.get('/api/orders', headers=headers()).json()['orders'][0]['discount'] == 20000
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 3


def test_product_bilingual_options_edit_and_stale_translation_conflict(shop):
    client, _ = shop
    row = client.get('/api/products/1').json()['product']
    expected = {'name': row['name_vi'], 'price': row['price'], 'stock': row['stock'], 'description': row['description'],
                'name_en': row['name_en'], 'description_en': row['description_en'], 'colors': row['colors'], 'sizes': row['sizes'], 'images': row['images']}
    values = {**expected, 'expected': expected, 'name_en': 'Updated English name', 'description_en': 'English description', 'sizes': ['M', 'L', 'XL'], 'images': ['/img/new.webp']}
    result = client.patch('/api/admin/products/1', headers=headers('admin'), json=values)
    assert result.status_code == 200 and result.json()['name_en'] == 'Updated English name'
    assert client.patch('/api/admin/products/1', headers=headers('admin'), json=values).status_code == 409
    assert client.get('/api/catalog').json()['products'][0]['sizes'] == ['M', 'L', 'XL']


def test_concurrent_customer_admin_cancel_restores_inventory_once(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    order = client.post('/api/orders', headers=headers(), json=order_payload(address)).json()
    def cancel(admin):
        return client.patch(('/api/admin/orders/' if admin else '/api/orders/') + order['id'], headers=headers('admin' if admin else 'a'),
                            json={'status': 'canceled', 'expected_status': 'pending'})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(cancel, (True, False)))
    assert sorted(result.status_code for result in results) == [200, 409]
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 5
        assert db.get(Order, order['id']).status == 'canceled'


def test_product_create_retries_and_concurrent_requests_create_once(shop):
    client, engine = shop
    values = {'request_id': str(uuid4()), 'name': 'New shirt', 'name_en': 'New shirt', 'category': 'm-tshirts', 'price': 123, 'stock': 5, 'image': '/img/test.webp'}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post('/api/admin/products', headers=headers('admin'), json=values), range(2)))
    assert all(response.status_code == 201 for response in results)
    assert results[0].json()['id'] == results[1].json()['id']
    assert client.post('/api/admin/products', headers=headers('admin'), json={**values, 'name': 'Changed'}).status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Product)) == 3


def test_order_pagination_search_filters_and_localized_snapshots(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    with Session(engine) as db, db.begin():
        db.get(Product, 1).stock = 100
    orders = [client.post('/api/orders', headers=headers(), json=order_payload(address)).json() for _ in range(5)]
    first = client.get('/api/orders', headers=headers(), params={'page': 1, 'limit': 2}).json()
    second = client.get('/api/orders', headers=headers(), params={'page': 2, 'limit': 2}).json()
    assert first['total'] == 5 and first['pages'] == 3 and len(first['orders']) == 2
    assert not ({row['id'] for row in first['orders']} & {row['id'] for row in second['orders']})
    assert client.get('/api/orders', headers=headers('b'), params={'q': orders[0]['id']}).json()['total'] == 0
    found = client.get('/api/orders', headers=headers(), params={'q': orders[0]['id'][:12]}).json()
    assert found['total'] == 1 and found['orders'][0]['id'] == orders[0]['id']
    assert client.get('/api/orders', headers=headers(), params={'q': '0901234567'}).json()['total'] == 5
    for query in ('Nguyễn An', 'nguyen an', '  NGUYEN   AN  '):
        assert client.get('/api/orders', headers=headers(), params={'q': query, 'limit': 2}).json()['total'] == 5
        assert client.get('/api/admin/orders', headers=headers('admin'), params={'q': query}).json()['total'] == 5
        assert client.get('/api/orders', headers=headers('b'), params={'q': query}).json()['total'] == 0
    line = found['orders'][0]['items'][0]
    assert line['name_en'] == 'Classic T-shirt' and line['color_en'] == 'Black'
    assert client.get('/api/orders', headers=headers(), params={'status': 'canceled'}).json()['total'] == 0
    assert client.get('/api/orders', headers=headers(), params={'limit': 101}).status_code == 422
    assert client.get('/api/orders', headers=headers(), params={'start': '2026-05-02', 'end': '2026-05-01'}).status_code == 422
    with Session(engine) as db, db.begin():
        row = db.get(Order, orders[0]['id'])
        row.created_at = datetime(2026, 3, 31, 18, tzinfo=timezone.utc)  # April 1 in Vietnam
        db.get(Product, 1).name_en = 'Renamed later'
        old = db.get(Order, orders[1]['id'])
        old.items = [{key: value for key, value in item.items() if key not in ('name_en', 'name_vi', 'color_en', 'color_vi')} for item in old.items]
    dated = client.get('/api/orders', headers=headers(), params={'start': '2026-04-01', 'end': '2026-04-01'}).json()
    assert dated['total'] == 1 and dated['orders'][0]['items'][0]['name_en'] == 'Classic T-shirt'
    legacy = client.get('/api/orders', headers=headers(), params={'q': orders[1]['id']}).json()['orders'][0]['items'][0]
    assert legacy['name_en'] == 'Renamed later' and legacy['color_en'] == 'Black'


def test_variant_allocation_sale_shortage_conflict_and_cancel_restore(shop):
    client, engine = shop
    configuration = {'expected_stock': 5, 'expected_revision': None, 'variants': [{'color': 'black', 'size': 'M', 'stock': 1}, {'color': 'black', 'size': 'L', 'stock': 4}]}
    assert client.patch('/api/admin/products/1/variants', headers=headers(), json=configuration).status_code == 403
    bad = {**configuration, 'variants': [{**row, 'stock': 0} for row in configuration['variants']]}
    assert client.patch('/api/admin/products/1/variants', headers=headers('admin'), json=bad).json()['code'] == 'NB_STOCK_ALLOCATION'
    configured = client.patch('/api/admin/products/1/variants', headers=headers('admin'), json=configuration).json()
    assert configured['stock_revision'] == 0 and configured['stock'] == 5
    assert client.get('/api/catalog').json()['products'][0]['variants'][1]['stock'] == 4
    address = save_address(client).json()['saved_address_id']
    assert client.post('/api/orders', headers=headers(), json=order_payload(address)).json()['code'] == 'NB_INSUFFICIENT_STOCK'
    order = client.post('/api/orders', headers=headers(), json=order_payload(address, items=[{'product_id': 1, 'quantity': 2, 'color': 'black', 'size': 'L'}])).json()
    assert order['items'][0]['variant_stock'] is True
    stale = {**configuration, 'expected_revision': 0}
    assert client.patch('/api/admin/products/1/variants', headers=headers('admin'), json=stale).status_code == 409
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 3
        assert db.get(VariantInventory, 1).variants[1]['stock'] == 2
    change = {'status': 'canceled', 'expected_status': 'pending'}
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json=change).status_code == 200
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json=change).status_code == 409
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 5
        assert db.get(VariantInventory, 1).variants[1]['stock'] == 4
        assert db.get(VariantInventory, 1).revision == 2


def check_open_order_sql(engine):
    from app.services import open_order_uses
    with Session(engine) as db, db.begin():
        rows = [
            Order(user_id=A, request_id=str(uuid4()), items=[{'product_id': 1, 'color': 'black', 'size': 'M', 'variant_stock': True}], delivery=ADDRESS, payment='cod', total=1, status='pending'),
            Order(user_id=A, request_id=str(uuid4()), items=[{'product_id': 2}], delivery=ADDRESS, payment='cod', total=1, status='confirmed'),
            Order(user_id=A, request_id=str(uuid4()), items=[{'product_id': 3}], delivery=ADDRESS, payment='cod', total=1, status='shipped'),
        ]
        db.add_all(rows)
        db.flush()
        assert open_order_uses(db, 1, choices={('black', 'M')})
        assert not open_order_uses(db, 1, choices={('black', 'L')})
        assert not open_order_uses(db, 1, aggregate_only=True)
        assert open_order_uses(db, 2, aggregate_only=True)
        assert open_order_uses(db, 2, choices={('', '')})
        assert not open_order_uses(db, 3, aggregate_only=True)
        rows[0].status = 'canceled'
        db.flush()
        assert not open_order_uses(db, 1, choices={('black', 'M')})


def test_open_order_sql_matches_product_options_and_legacy_lines(shop):
    check_open_order_sql(shop[1])


def test_remove_variant_checks_stock_then_open_orders_and_allows_shipped_order(shop):
    client, _ = shop
    configuration = {'expected_stock': 5, 'expected_revision': None, 'variants': [{'color': 'black', 'size': 'M', 'stock': 1}, {'color': 'black', 'size': 'L', 'stock': 4}]}
    assert client.patch('/api/admin/products/1/variants', headers=headers('admin'), json=configuration).status_code == 200

    def remove_m():
        row = client.get('/api/products/1').json()['product']
        expected = {'name': row['name_vi'], 'name_en': row['name_en'], 'price': row['price'], 'stock': row['stock'], 'description': row['description'], 'description_en': row['description_en'], 'colors': row['colors'], 'sizes': row['sizes'], 'images': row['images']}
        return client.patch('/api/admin/products/1', headers=headers('admin'), json={**expected, 'sizes': ['L'], 'expected': expected})

    assert remove_m().json()['code'] == 'NB_VARIANT_HAS_STOCK'
    address = save_address(client).json()['saved_address_id']
    order = client.post('/api/orders', headers=headers(), json=order_payload(address, items=[{'product_id': 1, 'quantity': 1, 'color': 'black', 'size': 'M'}])).json()
    assert remove_m().json()['code'] == 'NB_VARIANT_IN_USE'
    for previous, status in [('pending', 'confirmed'), ('confirmed', 'shipped')]:
        response = client.patch('/api/admin/orders/' + order['id'], headers=headers('admin'), json={'status': status, 'expected_status': previous})
        assert response.status_code == 200
        if status == 'confirmed':
            assert remove_m().json()['code'] == 'NB_VARIANT_IN_USE'
    result = remove_m()
    assert result.status_code == 200
    assert result.json()['stock'] == 4 and result.json()['sizes'] == ['L']
    assert result.json()['variants'] == [{'color': 'black', 'size': 'L', 'stock': 4}]


def test_old_pending_order_blocks_guessed_variant_migration(shop):
    client, _ = shop
    address = save_address(client).json()['saved_address_id']
    order = client.post('/api/orders', headers=headers(), json=order_payload(address)).json()
    configuration = {'expected_stock': 3, 'expected_revision': None, 'variants': [{'color': 'black', 'size': 'M', 'stock': 1}, {'color': 'black', 'size': 'L', 'stock': 2}]}
    result = client.patch('/api/admin/products/1/variants', headers=headers('admin'), json=configuration)
    assert result.json()['code'] == 'NB_OPEN_AGGREGATE_ORDERS'
    client.patch('/api/orders/' + order['id'], headers=headers(), json={'status': 'canceled', 'expected_status': 'pending'})
    configuration['expected_stock'] = 5
    configuration['variants'][1]['stock'] = 4
    assert client.patch('/api/admin/products/1/variants', headers=headers('admin'), json=configuration).status_code == 200


def test_payment_receipt_is_admin_only_idempotent_and_report_uses_vietnam_dates(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    order = client.post('/api/orders', headers=headers(), json=order_payload(address)).json()
    endpoint = '/api/admin/orders/' + order['id'] + '/payment'
    assert client.patch(endpoint, headers=headers(), json={'received': True}).status_code == 403
    assert client.patch(endpoint, headers=headers('admin'), json={'received': False}).status_code == 422
    assert client.patch(endpoint, headers=headers('admin'), json={'received': True}).json()['payment_status'] == 'received'
    again = client.patch(endpoint, headers=headers('admin'), json={'received': True}).json()
    assert again['payment_status'] == 'received'
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json={'status': 'canceled', 'expected_status': 'pending'}).json()['code'] == 'NB_PAID_ORDER_CANCEL'
    assert client.get('/api/orders', headers=headers(), params={'paid': 'received'}).json()['total'] == 1
    assert client.get('/api/orders', headers=headers(), params={'paid': 'unpaid'}).json()['total'] == 0
    with Session(engine) as db, db.begin():
        db.get(Order, order['id']).created_at = datetime(2026, 3, 31, 18, tzinfo=timezone.utc)
        db.get(OrderPayment, order['id']).received_at = datetime(2026, 4, 1, 18, tzinfo=timezone.utc)
    report = client.get('/api/admin/report', headers=headers('admin'), params={'start': '2026-04-01', 'end': '2026-04-02'}).json()
    assert report['series'] == [{'date': '2026-04-01', 'orders': 1, 'order_value': 200000, 'received': 0}, {'date': '2026-04-02', 'orders': 0, 'order_value': 0, 'received': 200000}]
    monthly = client.get('/api/admin/report', headers=headers('admin'), params={'start': '2026-03-01', 'end': '2026-04-30', 'period': 'month'}).json()
    assert monthly['series'][1]['received'] == 200000
    assert client.get('/api/admin/overview', headers=headers('admin')).json()['received'] == 200000
    assert client.get('/api/admin/report', headers=headers()).status_code == 403


def test_competing_orders_cannot_oversell_one_size_while_other_size_has_stock(shop):
    client, engine = shop
    allocation = {'expected_revision': None, 'expected_stock': 5, 'variants': [{'color': 'black', 'size': 'M', 'stock': 1}, {'color': 'black', 'size': 'L', 'stock': 4}]}
    client.patch('/api/admin/products/1/variants', headers=headers('admin'), json=allocation)
    addresses = {token: save_address(client, token).json()['saved_address_id'] for token in ('a', 'b')}
    def buy(token):
        return client.post('/api/orders', headers=headers(token), json=order_payload(addresses[token], items=[{'product_id': 1, 'quantity': 1, 'color': 'black', 'size': 'M'}]))
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(buy, ('a', 'b')))
    assert sorted(result.status_code for result in results) == [200, 409]
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 4
        assert db.get(VariantInventory, 1).variants == [{'color': 'black', 'size': 'M', 'stock': 0}, {'color': 'black', 'size': 'L', 'stock': 4}]


def test_receipt_and_cancellation_race_cannot_receive_money_and_restore_stock(shop):
    client, engine = shop
    address = save_address(client).json()['saved_address_id']
    order = client.post('/api/orders', headers=headers(), json=order_payload(address)).json()
    def act(receive):
        return client.patch('/api/admin/orders/' + order['id'] + ('/payment' if receive else ''), headers=headers('admin'),
                            json={'received': True} if receive else {'status': 'canceled', 'expected_status': 'pending'})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(act, (True, False)))
    # Either receipt wins (cancel then opens a refund) or cancel wins (receipt refused).
    with Session(engine) as db:
        receipt = db.get(OrderPayment, order['id'])
        assert [result.status_code for result in results] == ([200, 200] if receipt else [409, 200])
        assert db.get(Product, 1).stock == 5
        assert db.get(Order, order['id']).status == 'canceled'
        assert (db.get(OrderRefund, order['id']) is not None) == (receipt is not None)
