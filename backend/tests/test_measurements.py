"""Customer body measurements test: personal sizing stored per user for recommendations."""
from test_api import headers, shop  # noqa: F401


def test_measurements_workflow_per_user(shop):
    client, _ = shop

    # Anonymous is rejected
    assert client.get('/api/account/measurements').status_code == 401
    assert client.put('/api/account/measurements', json={'height': 170}).status_code == 401

    # New customer starts with None
    res = client.get('/api/account/measurements', headers=headers('a'))
    assert res.status_code == 200
    assert res.json() == {'measurements': None}

    # Save measurements for customer 'a'
    body_a = {
        'height': 175.5,
        'weight': 68.0,
        'chest': 96.0,
        'waist': 78.0,
        'hips': 94.0,
        'shoulder': 44.0,
        'fit_preference': 'regular',
    }
    saved_a = client.put('/api/account/measurements', headers=headers('a'), json=body_a)
    assert saved_a.status_code == 200
    data_a = saved_a.json()['measurements']
    assert data_a['height'] == 175.5
    assert data_a['chest'] == 96.0
    assert data_a['fit_preference'] == 'regular'

    # Customer 'b' has distinct measurements
    res_b = client.get('/api/account/measurements', headers=headers('b'))
    assert res_b.json() == {'measurements': None}

    body_b = {
        'height': 162.0,
        'weight': 52.0,
        'chest': 84.0,
        'waist': 65.0,
        'hips': 88.0,
        'fit_preference': 'slim',
    }
    client.put('/api/account/measurements', headers=headers('b'), json=body_b)

    # Re-check customer 'a' and customer 'b'
    assert client.get('/api/account/measurements', headers=headers('a')).json()['measurements']['chest'] == 96.0
    assert client.get('/api/account/measurements', headers=headers('b')).json()['measurements']['chest'] == 84.0

    # Validation
    assert client.put('/api/account/measurements', headers=headers('a'), json={'chest': 30}).status_code == 422
    assert client.put('/api/account/measurements', headers=headers('a'), json={'fit_preference': 'invalid'}).status_code == 422
