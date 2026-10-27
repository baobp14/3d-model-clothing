"""Test carrier and tracking code workflow on orders."""
from test_api import headers, order_payload, save_address, shop  # noqa: F401


def test_order_carrier_and_tracking_workflow(shop):
    client, _ = shop

    # Save address for customer 'a'
    address = save_address(client, token='a').json()['default_address_id']

    # Place an order as customer 'a'
    placed = client.post('/api/orders', headers=headers('a'), json=order_payload(address, items=[{'product_id': 1, 'quantity': 1, 'color': 'black', 'size': 'M'}]))
    assert placed.status_code == 200
    order_id = placed.json()['id']

    # Admin confirms order
    confirm_res = client.patch(
        f'/api/admin/orders/{order_id}',
        headers=headers('admin'),
        json={'status': 'confirmed', 'expected_status': 'pending'},
    )
    assert confirm_res.status_code == 200

    # Admin ships order with carrier and tracking code
    ship_res = client.patch(
        f'/api/admin/orders/{order_id}',
        headers=headers('admin'),
        json={
            'status': 'shipped',
            'expected_status': 'confirmed',
            'carrier': 'Giao Hàng Nhanh (GHN)',
            'tracking_code': 'GHN12345678',
        },
    )
    assert ship_res.status_code == 200
    shipped_data = ship_res.json()
    assert shipped_data['status'] == 'shipped'
    assert shipped_data['delivery']['carrier'] == 'Giao Hàng Nhanh (GHN)'
    assert shipped_data['delivery']['tracking_code'] == 'GHN12345678'

    # Customer fetches order and sees tracking information
    cust_orders = client.get('/api/orders', headers=headers('a')).json()['orders']
    my_order = next(o for o in cust_orders if o['id'] == order_id)
    assert my_order['delivery']['carrier'] == 'Giao Hàng Nhanh (GHN)'
    assert my_order['delivery']['tracking_code'] == 'GHN12345678'

    # Admin updates tracking code via dedicated shipping endpoint
    update_res = client.patch(
        f'/api/admin/orders/{order_id}/shipping',
        headers=headers('admin'),
        json={
            'carrier': 'Viettel Post',
            'tracking_code': 'VTP888999',
        },
    )
    assert update_res.status_code == 200
    assert update_res.json()['delivery']['carrier'] == 'Viettel Post'
    assert update_res.json()['delivery']['tracking_code'] == 'VTP888999'

    # Non-admin cannot call shipping update
    assert client.patch(
        f'/api/admin/orders/{order_id}/shipping',
        headers=headers('a'),
        json={'carrier': 'GHTK', 'tracking_code': '123'},
    ).status_code == 403


def test_admin_push_ghn_order(shop):
    client, _ = shop
    address = save_address(client, token='a').json()['default_address_id']
    placed = client.post('/api/orders', headers=headers('a'), json=order_payload(address, items=[{'product_id': 1, 'quantity': 1, 'color': 'black', 'size': 'M'}]))
    order_id = placed.json()['id']

    # Non-admin rejected
    assert client.post(f'/api/admin/orders/{order_id}/push-ghn', headers=headers('a')).status_code == 403

    # Admin pushes order to GHN Sandbox
    res = client.post(f'/api/admin/orders/{order_id}/push-ghn', headers=headers('admin'))
    assert res.status_code == 200
    data = res.json()
    assert data['status'] == 'shipped'
    assert data['delivery']['carrier'] == 'Giao Hàng Nhanh (GHN)'
    assert len(data['delivery']['tracking_code']) > 0
