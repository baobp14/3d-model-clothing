from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import StockMovement
from app.admin_tools import csv_text
from test_api import shop, headers, save_address, order_payload


def check_admin_flows(client, engine):
    product = client.post('/api/admin/products', headers=headers('admin'), json={'name': 'Operations fixture', 'name_en': 'Operations fixture', 'category': 'm-tshirts', 'price': 100, 'stock': 5, 'image': '/img/test.webp'}).json()
    endpoint = '/api/admin/products/' + str(product['id'])
    expected = {'name': product['name_vi'], 'name_en': product['name_en'], 'price': product['price'], 'stock': product['stock'], 'description': product['description'], 'description_en': product['description_en'], 'colors': product['colors'], 'sizes': product['sizes'], 'images': product['images']}
    assert client.patch(endpoint, headers=headers('admin'), json={**expected, 'colors': ['black'], 'sizes': ['M', 'L'], 'expected': expected}).status_code == 200
    config = {'expected_stock': 5, 'expected_revision': None, 'reason': 'Physical allocation', 'variants': [{'color': 'black', 'size': 'M', 'stock': 1}, {'color': 'black', 'size': 'L', 'stock': 4}]}
    assert client.patch(endpoint + '/variants', headers=headers('admin'), json=config).status_code == 200
    address = save_address(client).json()['saved_address_id']
    payload = order_payload(address, items=[{'product_id': product['id'], 'quantity': 1, 'color': 'black', 'size': 'M'}])
    order = client.post('/api/orders', headers=headers(), json=payload).json()
    assert client.post('/api/orders', headers=headers(), json=payload).json()['id'] == order['id']
    alerts = client.get('/api/admin/stock-alerts', headers=headers('admin')).json()
    matching = [r for r in alerts['alerts'] if r['product_id'] == product['id']]
    assert sorted(r['stock'] for r in matching) == [0, 4]
    assert all(r['href'] == f"/admin/inventory/products/{product['id']}#variant-stock" for r in matching)
    inbox = client.get('/api/admin/notifications', headers=headers('admin')).json()
    key = 'order:' + order['id']
    assert any(row['key'] == key and not row['read'] for row in inbox['notifications'])
    assert client.post('/api/admin/notifications/read', headers=headers(), json={'keys': [key]}).status_code == 403
    read = client.post('/api/admin/notifications/read', headers=headers('admin'), json={'keys': [key]}).json()
    assert next(row for row in read['notifications'] if row['key'] == key)['read']
    before = client.get(endpoint + '/history', headers=headers('admin')).json()
    assert before['total'] == 3
    assert [row['kind'] for row in before['movements']] == ['order', 'configure', 'create']
    for is_test in [True, True, False]:
        response = client.patch('/api/admin/orders/' + order['id'] + '/test', headers=headers('admin'), json={'is_test': is_test, 'expected_is_test': not is_test})
        assert response.status_code == 200
        assert response.json()['is_test'] == is_test
    assert client.patch('/api/admin/orders/' + order['id'] + '/test', headers=headers(), json={'is_test': True, 'expected_is_test': False}).status_code == 403
    assert client.get(endpoint + '/history', headers=headers('admin')).json()['total'] == before['total']
    cancel = {'status': 'canceled', 'expected_status': 'pending'}
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json=cancel).status_code == 200
    assert client.patch('/api/orders/' + order['id'], headers=headers(), json=cancel).status_code == 409
    adjustment = {**config, 'expected_revision': 2, 'reason': 'Physical recount', 'variants': [{'color': 'black', 'size': 'M', 'stock': 2}, {'color': 'black', 'size': 'L', 'stock': 4}]}
    assert client.patch(endpoint + '/variants', headers=headers('admin'), json=adjustment).status_code == 200
    assert client.patch(endpoint + '/variants', headers=headers('admin'), json=adjustment).status_code == 409
    history = client.get(endpoint + '/history', headers=headers('admin')).json()
    assert history['total'] == 5
    assert history['movements'][0]['reason'] == 'Physical recount'
    assert history['movements'][0]['before_stock'] == 5 and history['movements'][0]['after_stock'] == 6
    assert client.get(endpoint + '/history', headers=headers()).status_code == 403
    assert len(client.get(endpoint + '/history?page=2&limit=2', headers=headers('admin')).json()['movements']) == 2
    exported = client.get('/api/admin/inventory/export?q=Operations+fixture', headers=headers('admin')).json()
    assert exported['total'] == 1 and 'Operations fixture' in exported['csv']
    csv = client.get('/api/admin/orders/export', headers=headers('admin'), params={'q': order['id'], 'status': 'canceled', 'scope': 'real'}).json()
    assert csv['total'] == 1 and order['id'] in csv['csv']
    assert client.get('/api/admin/orders/export', headers=headers()).status_code == 403
    with Session(engine) as db:
        assert len(list(db.scalars(select(StockMovement).where(StockMovement.product_id == product['id'])))) == 5


def test_admin_history_alerts_notifications_export_and_demo_marking(shop):
    check_admin_flows(*shop)


def test_export_cells_preserve_unicode_and_escape_spreadsheet_formulas():
    result = csv_text([['Áo', '=CMD()', '+123', '@SUM(A1)', 'normal', 123]])
    assert result.startswith('\ufeff') and "'=CMD()" in result and "'@SUM(A1)" in result
