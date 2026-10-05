"""Remove test labels from the existing seeded presentation data, without new orders."""
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.orm import Session

from .config import ROOT, Settings
from .db import make_engine
from .models import DemoOrder, Order, Product, as_dict
from .services import lock_customer


def clean_labels(value):
    if isinstance(value, str):
        return value.replace('[TEST]', '').strip()
    if isinstance(value, list):
        return [clean_labels(v) for v in value]
    if isinstance(value, dict):
        return {k: clean_labels(v) for k, v in value.items()}
    return value


def prepare(db):
    ids = [str(uuid5(NAMESPACE_URL, f'nb-demo-seed-v1/order/{i}')) for i in range(26)]
    orders = [order for order_id in ids if (order := db.get(Order, order_id))]
    for owner in sorted({o.user_id for o in orders}):
        lock_customer(db, owner)
    product_ids = {line['product_id'] for order in orders for line in order.items}
    for product_id in product_ids:
        product = db.get(Product, product_id)
        if product:
            for field in ('name_vi', 'name_en', 'description', 'description_en'):
                setattr(product, field, clean_labels(getattr(product, field)))
    for order in orders:
        order.items = clean_labels(order.items)
        order.delivery = clean_labels(order.delivery)
        marker = db.get(DemoOrder, order.id)
        if marker:
            db.delete(marker)
    db.flush()
    return len(orders)


def main():
    engine = make_engine(Settings().database_url)
    backup = ROOT / '.dataset-backups' / ('presentation-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(parents=True)
    with Session(engine) as db, db.begin():
        ids = [str(uuid5(NAMESPACE_URL, f'nb-demo-seed-v1/order/{i}')) for i in range(26)]
        orders = [order for order_id in ids if (order := db.get(Order, order_id))]
        product_ids = {line['product_id'] for order in orders for line in order.items}
        snapshot = {'orders': [as_dict(o) for o in orders], 'products': [as_dict(db.get(Product, i)) for i in product_ids], 'test_ids': [o.id for o in orders if db.get(DemoOrder, o.id)]}
        (backup / 'before.json').write_text(json.dumps(snapshot, ensure_ascii=False, default=str), encoding='utf-8')
        count = prepare(db)
    engine.dispose()
    print(f'Presentation ready: {count} existing orders included in default statistics; no orders created and no stock/payment changes.')


if __name__ == '__main__':
    main()
