from uuid import NAMESPACE_URL, uuid4, uuid5

from sqlalchemy.orm import Session

from app.models import Order, Product, DemoOrder, OrderPayment
from app.prepare_demo import prepare
from test_api import shop, headers, A


def test_presentation_keeps_existing_order_money_and_stock_and_is_repeatable(shop):
    client, engine = shop
    order_id = str(uuid5(NAMESPACE_URL, 'nb-demo-seed-v1/order/0'))
    with Session(engine) as db, db.begin():
        product = db.get(Product, 1)
        product.name_vi = '[TEST] Shirt'
        db.add(Order(id=order_id, user_id=A, request_id=str(uuid4()), total=100000, payment='cod', status='delivered',
                     items=[{'product_id': 1, 'name': '[TEST] Shirt', 'name_vi': '[TEST] Shirt', 'name_en': '[TEST] Shirt', 'color': 'black', 'size': 'M', 'quantity': 1, 'price': 100000}],
                     delivery={'name': '[TEST] Customer', 'id': str(uuid4())}))
        db.flush()
        db.add(DemoOrder(order_id=order_id))
        db.add(OrderPayment(order_id=order_id, received_by=A))
    assert client.get('/api/admin/overview', headers=headers('admin')).json()['orders'] == 0
    with Session(engine) as db, db.begin():
        assert prepare(db) == 1
        assert prepare(db) == 1
        assert db.get(Product, 1).stock == 5
        assert db.get(Product, 1).name_vi == 'Shirt'
        order = db.get(Order, order_id)
        assert order.total == 100000 and order.status == 'delivered' and order.payment == 'cod'
        assert order.items[0]['name'] == 'Shirt' and order.delivery['name'] == 'Customer'
        assert db.get(DemoOrder, order_id) is None
        assert db.get(OrderPayment, order_id) is not None
    overview = client.get('/api/admin/overview', headers=headers('admin')).json()
    assert overview['orders'] == 1 and overview['received'] == 100000
    assert client.get('/api/admin/orders', headers=headers('admin')).json()['orders'][0]['is_test'] is False
