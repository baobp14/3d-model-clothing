"""Reviews and return requests: only for the buyer's delivered orders; stock returns
only when an admin receives sellable goods."""
from sqlalchemy.orm import Session

from app.models import Product
from test_api import headers, order_payload, save_address, shop  # noqa: F401  (pytest fixture)


def place(client, token='a', quantity=2):
    book = client.get('/api/addresses', headers=headers(token)).json()
    address = book['addresses'][0]['id'] if book.get('addresses') else save_address(client, token).json()['saved_address_id']
    payload = order_payload(address)
    payload['items'][0]['quantity'] = quantity
    return client.post('/api/orders', headers=headers(token), json=payload).json()


def deliver(client, order_id):
    for before, after in (('pending', 'confirmed'), ('confirmed', 'shipped'), ('shipped', 'delivered')):
        response = client.patch(f'/api/admin/orders/{order_id}', headers=headers('admin'),
                                json={'status': after, 'expected_status': before})
        assert response.status_code == 200, response.text


def stock(engine, product_id=1):
    with Session(engine) as db:
        return db.get(Product, product_id).stock


def test_review_needs_the_buyers_delivered_order(shop):
    client, _ = shop
    order = place(client)
    body = {'order_id': order['id'], 'rating': 5, 'comment': 'Vải dày, mặc mát'}
    early = client.post('/api/products/1/reviews', headers=headers('a'), json=body)
    assert early.status_code == 409 and early.json()['code'] == 'NB_ORDER_NOT_DELIVERED'
    deliver(client, order['id'])
    assert client.post('/api/products/1/reviews', headers=headers('b'), json=body).status_code == 404
    other = client.post('/api/products/2/reviews', headers=headers('a'), json=body)
    assert other.status_code == 409 and other.json()['code'] == 'NB_REVIEW_NOT_PURCHASED'
    assert client.post('/api/products/1/reviews', headers=headers('a'), json={**body, 'rating': 6}).status_code == 422
    created = client.post('/api/products/1/reviews', headers=headers('a'), json=body)
    assert created.status_code == 201
    again = client.post('/api/products/1/reviews', headers=headers('a'), json=body)
    assert again.status_code == 409 and again.json()['code'] == 'NB_REVIEW_EXISTS'
    listing = client.get('/api/products/1/reviews').json()
    assert listing['count'] == 1 and listing['average'] == 5.0
    assert listing['reviews'][0]['comment'] == 'Vải dày, mặc mát'
    assert 'user_id' not in listing['reviews'][0] and 'order_id' not in listing['reviews'][0]
    mine = client.get('/api/orders/aftersales', headers=headers('a')).json()
    assert mine['reviewed'] == [{'order_id': order['id'], 'product_id': 1}]


def test_sellable_return_restocks_once_received(shop):
    client, engine = shop
    order = place(client)
    assert stock(engine) == 3
    reason = {'reason': 'Áo bị rộng so với bảng size'}
    assert client.post(f"/api/orders/{order['id']}/returns", headers=headers('a'), json=reason).status_code == 409
    deliver(client, order['id'])
    assert client.post(f"/api/orders/{order['id']}/returns", headers=headers('b'), json=reason).status_code == 404
    assert client.post(f"/api/orders/{order['id']}/returns", headers=headers('a'), json={'reason': 'x'}).status_code == 422
    request = client.post(f"/api/orders/{order['id']}/returns", headers=headers('a'), json=reason)
    assert request.status_code == 201
    duplicate = client.post(f"/api/orders/{order['id']}/returns", headers=headers('a'), json=reason)
    assert duplicate.status_code == 409 and duplicate.json()['code'] == 'NB_RETURN_EXISTS'
    return_id = request.json()['id']
    assert client.patch(f'/api/admin/returns/{return_id}', headers=headers('a'),
                        json={'action': 'approve', 'expected_status': 'pending'}).status_code == 403
    early = client.patch(f'/api/admin/returns/{return_id}', headers=headers('admin'),
                         json={'action': 'receive', 'expected_status': 'pending', 'restock': True})
    assert early.status_code == 409 and early.json()['code'] == 'NB_RETURN_STATUS_INVALID'
    approved = client.patch(f'/api/admin/returns/{return_id}', headers=headers('admin'),
                            json={'action': 'approve', 'expected_status': 'pending'})
    assert approved.json()['status'] == 'approved' and stock(engine) == 3
    received = client.patch(f'/api/admin/returns/{return_id}', headers=headers('admin'),
                            json={'action': 'receive', 'expected_status': 'approved', 'restock': True, 'note': 'Hàng còn tem'})
    assert received.json()['status'] == 'received' and received.json()['restocked'] is True
    assert stock(engine) == 5
    stale = client.patch(f'/api/admin/returns/{return_id}', headers=headers('admin'),
                         json={'action': 'receive', 'expected_status': 'approved', 'restock': True})
    assert stale.status_code == 409 and stock(engine) == 5
    listing = client.get('/api/admin/returns', headers=headers('admin'), params={'status': 'received'}).json()
    assert listing['total'] == 1 and listing['returns'][0]['order']['id'] == order['id']
    mine = client.get('/api/orders/aftersales', headers=headers('a')).json()
    assert mine['returns'][order['id']]['status'] == 'received'


def test_unsellable_or_rejected_return_keeps_stock(shop):
    client, engine = shop
    first, second = place(client, quantity=1), place(client, quantity=1)
    for order in (first, second):
        deliver(client, order['id'])
    assert stock(engine) == 3
    a = client.post(f"/api/orders/{first['id']}/returns", headers=headers('a'), json={'reason': 'Không vừa người'}).json()
    b = client.post(f"/api/orders/{second['id']}/returns", headers=headers('a'), json={'reason': 'Đổi ý không mua'}).json()
    client.patch(f"/api/admin/returns/{a['id']}", headers=headers('admin'), json={'action': 'approve', 'expected_status': 'pending'})
    damaged = client.patch(f"/api/admin/returns/{a['id']}", headers=headers('admin'),
                           json={'action': 'receive', 'expected_status': 'approved', 'restock': False, 'note': 'Hàng bị bẩn'})
    assert damaged.json()['restocked'] is False and stock(engine) == 3
    rejected = client.patch(f"/api/admin/returns/{b['id']}", headers=headers('admin'), json={'action': 'reject', 'expected_status': 'pending'})
    assert rejected.json()['status'] == 'rejected'
    assert client.patch(f"/api/admin/returns/{b['id']}", headers=headers('admin'),
                        json={'action': 'approve', 'expected_status': 'pending'}).status_code == 409
    assert stock(engine) == 3


def test_returning_a_paid_order_opens_a_refund(shop):
    client, _ = shop
    order = place(client, quantity=1)
    deliver(client, order['id'])
    assert client.patch(f"/api/admin/orders/{order['id']}/payment", headers=headers('admin'), json={'received': True}).status_code == 200
    request = client.post(f"/api/orders/{order['id']}/returns", headers=headers('a'), json={'reason': 'Áo bị lỗi đường may'}).json()
    client.patch(f"/api/admin/returns/{request['id']}", headers=headers('admin'), json={'action': 'approve', 'expected_status': 'pending'})
    client.patch(f"/api/admin/returns/{request['id']}", headers=headers('admin'),
                 json={'action': 'receive', 'expected_status': 'approved', 'restock': True})
    orders = client.get('/api/orders', headers=headers('a')).json()
    row = next(o for o in orders['orders'] if o['id'] == order['id'])
    assert row['refund_status'] == 'required' and row['refund_amount'] == order['total']
