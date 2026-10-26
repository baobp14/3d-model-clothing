from pathlib import Path
from types import SimpleNamespace
from zipfile import ZipFile
import json

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.import_clothing import read_dataset, build_products, apply_catalog, REPLACED
from app.models import Product, Category, VariantInventory, DatasetProduct, StockMovement
from test_api import shop, headers, save_address, order_payload
from app.services import color_gallery

ARCHIVE = Path(__file__).resolve().parents[2] / 'dataset_quanao.zip'


def dataset_rows():
    if not ARCHIVE.is_file():
        return json.loads((Path(__file__).parent / 'fixtures/clothing.json').read_text(encoding='utf-8'))
    references = [SimpleNamespace(id=i, category=c, name_vi='Reference', price=(i + 1) * 100000) for i, c in enumerate(sorted(REPLACED))]
    return build_products(read_dataset(ARCHIVE), references)


def test_complete_dataset_photos_and_exact_stock_totals():
    rows = dataset_rows()
    assert len(rows) == 54
    assert sum(len(p['colors']) for p in rows) == 108
    assert {p['category'] for p in rows} == REPLACED
    for p in rows:
        assert p['sizes'] == ['S', 'M', 'XL']
        assert p['stock'] in (1556, 1342)
        assert sum(v['stock'] for v in p['variants']) == p['stock']
        assert len(p['variants']) == len(p['colors']) * 3
        assert all(v['stock'] > 0 for v in p['variants'])
        assert p['images'] == [p['color_images'][c][0] for c in p['colors']]
        assert all('/front.' in imgs[0] and '/back.' in imgs[1] for imgs in p['color_images'].values())
    assert len(next(p for p in rows if p['key'] == 'ascolour_5051')['colors']) == 10


def test_import_preserves_history_other_categories_and_repeat_stock(shop):
    client, engine = shop
    address = save_address(client).json()['default_address_id']
    payload = order_payload(address)
    old_order = client.post('/api/orders', headers=headers(), json=payload).json()
    with Session(engine) as db, db.begin():
        for c in REPLACED:
            if not db.get(Category, c):
                db.add(Category(id=c, name_vi=c, name_en=c, department='women' if c.startswith('w-') else 'men'))
        db.flush()
        assert apply_catalog(db, dataset_rows()) == {'added': 54, 'archived': 1, 'dataset_products': 54}
        product_id = db.scalar(select(DatasetProduct).where(DatasetProduct.dataset_key == 'ascolour_5051')).product_id
    assert [p['id'] for p in client.get('/api/products/by-ids?ids=1,2').json()['products']] == [2]
    assert client.get('/api/product-page').json()['total'] == 55
    assert client.get('/api/products/1').json()['product']['archived'] is True
    assert client.get('/api/products/2').json()['product']['archived'] is False
    assert client.get('/api/admin/overview', headers=headers('admin')).json()['products'] == 55
    assert client.post('/api/orders', headers=headers(), json=order_payload(address)).json()['code'] == 'NB_PRODUCT_NOT_FOUND'
    assert client.post('/api/orders', headers=headers(), json=payload).json()['id'] == old_order['id']
    assert client.patch('/api/orders/' + old_order['id'], headers=headers(), json={'status': 'canceled', 'expected_status': 'pending'}).status_code == 200
    with Session(engine) as db:
        assert db.get(Product, 1).stock == 5
        assert db.get(Product, 1).name_en == 'Classic T-shirt'
        assert db.get(Product, 2).price == 250000
        new_product = db.get(Product, product_id)
        before, color = new_product.stock, new_product.colors[0]
    assert len(client.get(f'/api/products/{product_id}').json()['product']['color_images'][color]) >= 2
    new_payload = order_payload(address, items=[{'product_id': product_id, 'color': color, 'size': 'S', 'quantity': 2}])
    new_order = client.post('/api/orders', headers=headers(), json=new_payload).json()
    assert 'id' in new_order
    with Session(engine) as db, db.begin():
        assert db.get(Product, product_id).stock == before - 2
        assert apply_catalog(db, dataset_rows()) == {'added': 0, 'archived': 0, 'dataset_products': 54}
        assert db.get(Product, product_id).stock == before - 2
        assert len(db.scalars(select(DatasetProduct)).all()) == 54
        assert sum(v['stock'] for v in db.get(VariantInventory, product_id).variants) == before - 2
        assert len(db.scalars(select(StockMovement).where(StockMovement.product_id == product_id, StockMovement.kind == 'create')).all()) == 1
    assert client.patch('/api/orders/' + new_order['id'], headers=headers(), json={'status': 'canceled', 'expected_status': 'pending'}).status_code == 200
    assert client.get(f'/api/products/{product_id}').json()['product']['stock'] == before


def test_dataset_refuses_unsafe_zip_paths(tmp_path):
    archive = tmp_path / 'bad.zip'
    with ZipFile(archive, 'w') as z:
        z.writestr('dataset/../../outside.jpg', b'bad')
    with pytest.raises(ValueError, match='Unsafe ZIP path'):
        read_dataset(archive)


def test_admin_photo_edits_override_original_color_gallery():
    mapping = SimpleNamespace(color_images={'black': ['/black.jpg', '/black-back.jpg'], 'white': ['/white.jpg', '/white-back.jpg']})
    product = SimpleNamespace(colors=['white', 'black'], images=['/white.jpg', '/black.jpg'])
    assert color_gallery(product, mapping)['white'][0] == '/white.jpg'
    product.images[0] = '/edited.jpg'
    assert 'white' not in color_gallery(product, mapping)
    product.colors = ['black']
    product.images = ['/black.jpg']
    assert set(color_gallery(product, mapping)) == {'black'}
