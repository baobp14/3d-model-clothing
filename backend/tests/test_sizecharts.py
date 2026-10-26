"""Size charts: admins save a brand's chart or the shop's own measurements per product;
anyone can read them, and the try-on lists them with the product's image folders."""
from sqlalchemy.orm import Session

from app.models import Product
from test_api import headers, shop  # noqa: F401  (pytest fixture)

MEASURED = {'source': 'measured', 'kind': 'tshirt', 'note': 'Đo phẳng, sai số ±1cm',
            'sizes': {'S': {'chestCircCm': 96, 'bodyLengthCm': 68}, 'M': {'chestCircCm': 102, 'bodyLengthCm': 70.5}}}


def test_admin_saves_reads_and_clears_a_measured_chart(shop):
    client, engine = shop
    with Session(engine) as db, db.begin():
        db.get(Product, 1).images = ['/img/clothing/jtd_bone_riot/front.webp', '/img/clothing/jtd_bone_riot/back.webp']
    assert client.get('/api/products/1/size-chart').json() == {'chart': None}
    assert client.put('/api/admin/products/1/size-chart', headers=headers('a'), json=MEASURED).status_code == 403
    saved = client.put('/api/admin/products/1/size-chart', headers=headers('admin'), json=MEASURED)
    assert saved.status_code == 200
    chart = client.get('/api/products/1/size-chart').json()['chart']
    assert (chart['source'], chart['kind'], chart['sizes']['M']['bodyLengthCm']) == ('measured', 'tshirt', 70.5)
    listing = client.get('/api/size-charts').json()['charts']
    assert listing[0]['folders'] == ['jtd_bone_riot'] and listing[0]['product_id'] == 1
    assert client.delete('/api/admin/products/1/size-chart', headers=headers('admin')).json() == {'chart': None}
    assert client.get('/api/products/1/size-chart').json() == {'chart': None}


def test_size_chart_validation(shop):
    client, _ = shop
    put = lambda body, product=1: client.put(f'/api/admin/products/{product}/size-chart', headers=headers('admin'), json=body)
    assert put({**MEASURED, 'source': 'brand'}).status_code == 422  # a brand chart must name the brand chart
    assert put({**MEASURED, 'sizes': {'S': {'chestCircCm': 96}}}).status_code == 422  # tops need chest and length
    assert put({**MEASURED, 'sizes': {'S': {'chestCircCm': -1, 'bodyLengthCm': 68}}}).status_code == 422
    assert put({**MEASURED, 'sizes': {'XXXL': {'chestCircCm': 96, 'bodyLengthCm': 68}}}).status_code == 422
    assert put(MEASURED, product=999).status_code == 404
    brand = put({**MEASURED, 'source': 'brand', 'brand_chart': 'jtd_heavy'})
    assert brand.status_code == 200 and brand.json()['chart']['brand_chart'] == 'jtd_heavy'
