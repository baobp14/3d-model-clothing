"""Admin stock history, actionable alerts and filtered exports."""
import csv
import hashlib
from io import StringIO

from sqlalchemy import func, literal, select, text, union_all
from sqlalchemy.dialects.postgresql import JSONB

from .errors import fail
from .models import Color, DemoOrder, NotificationRead, Order, Product, StockMovement, VariantInventory, as_dict, active_products
from .product_pages import product_page
from .reports import list_orders, real_orders
from .services import lock_customer


def mark_demo(db, order_id, values, user):
    order = db.get(Order, str(order_id))
    if not order:
        fail('NB_ORDER_NOT_FOUND', 404)
    lock_customer(db, order.user_id)
    db.scalar(select(Order).where(Order.id == order.id).with_for_update())
    marker = db.get(DemoOrder, order.id)
    current = marker is not None
    if current == values.is_test:
        return {'id': order.id, 'is_test': current}
    if current != values.expected_is_test:
        fail('NB_ORDER_STATUS_CONFLICT', 409)
    if values.is_test:
        db.add(DemoOrder(order_id=order.id))
    else:
        db.delete(marker)
    db.flush()
    return {'id': order.id, 'is_test': values.is_test}


def stock_history(db, product_id, page=1, limit=20):
    if not db.get(Product, product_id):
        fail('NB_PRODUCT_NOT_FOUND', 404)
    query = select(StockMovement).where(StockMovement.product_id == product_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(StockMovement.created_at.desc(), StockMovement.id.desc()).offset((page - 1) * limit).limit(limit))
    return {'movements': [as_dict(row) for row in rows], 'total': total, 'page': page, 'pages': max(1, (total + limit - 1) // limit)}


def stock_alerts(db, page=1, limit=20):
    if db.bind.dialect.name == 'postgresql':
        lines = func.jsonb_array_elements(VariantInventory.variants).table_valued('value').alias('variants')
        item = lines.c.value.cast(JSONB)
        color, size, quantity = item['color'].as_string(), item['size'].as_string(), item['stock'].as_integer()
    else:
        lines = func.json_each(VariantInventory.variants).table_valued('value').alias('variants')
        color, size, quantity = (func.json_extract(lines.c.value, '$.' + key) for key in ('color', 'size', 'stock'))
    base = [Product.id.label('product_id'), Product.name_vi, Product.name_en]
    variants = select(*base, color.label('color'), size.label('size'), quantity.label('stock'), VariantInventory.revision).select_from(Product).join(VariantInventory, VariantInventory.product_id == Product.id).join(lines, literal(True)).where(quantity <= 20)
    shared = select(*base, literal('').label('color'), literal('').label('size'), Product.stock.label('stock'), literal(-1).label('revision')).outerjoin(VariantInventory, VariantInventory.product_id == Product.id).where(VariantInventory.product_id.is_(None), Product.stock <= 20)
    all_rows = union_all(variants.where(active_products()), shared.where(active_products())).subquery()
    total = db.scalar(select(func.count()).select_from(all_rows))
    rows = db.execute(select(all_rows).order_by(all_rows.c.stock, all_rows.c.product_id, all_rows.c.color, all_rows.c.size).offset((page - 1) * limit).limit(limit)).mappings()
    colors = {c.id: {'vi': c.name_vi, 'en': c.name_en} for c in db.scalars(select(Color))}
    alerts = [{**row, 'color_names': colors.get(row['color'], {}), 'href': f"/admin/inventory/products/{row['product_id']}#variant-stock"} for row in rows]
    return {'alerts': alerts, 'total': total, 'page': page, 'pages': max(1, (total + limit - 1) // limit)}


def notifications(db, user):
    orders = list(db.scalars(select(Order).where(Order.status == 'pending', real_orders()).order_by(Order.created_at.desc(), Order.id.desc()).limit(20)))
    alerts = stock_alerts(db, limit=20)
    rows = [{'key': 'order:' + row.id, 'kind': 'order', 'id': row.id, 'href': '/admin/orders?q=' + row.id} for row in orders]
    for row in alerts['alerts']:
        token = hashlib.sha256(f"{row['color']}:{row['size']}".encode()).hexdigest()[:16]
        rows.append({**row, 'key': f"stock:{row['product_id']}:{token}:{row['revision']}:{row['stock']}", 'kind': 'stock'})
    read = set(db.scalars(select(NotificationRead.key).where(NotificationRead.user_id == user.id, NotificationRead.key.in_([row['key'] for row in rows])))) if rows else set()
    for row in rows:
        row['read'] = row['key'] in read
    return {'notifications': rows, 'unread': sum(not row['read'] for row in rows), 'more_orders': db.scalar(select(func.count()).select_from(Order).where(Order.status == 'pending', real_orders())) > 20, 'stock_total': alerts['total']}


def read_notifications(db, user, keys):
    lock_customer(db, user.id)
    valid = {row['key'] for row in notifications(db, user)['notifications']}
    for key in set(keys) & valid:
        if not db.get(NotificationRead, (user.id, key)):
            db.add(NotificationRead(user_id=user.id, key=key))
    db.flush()
    return notifications(db, user)


def csv_text(rows):
    output = StringIO(newline='')
    writer = csv.writer(output)
    for index, row in enumerate(rows):
        if index > 50000:
            fail('NB_EXPORT_TOO_LARGE', 422)
        writer.writerow(["'" + value if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@')) else value for value in row])
    return '\ufeff' + output.getvalue()


def export_data(db, kind, filters):
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'))
    query = list_orders if kind == 'orders' else product_page
    first = query(db, page=1, limit=100, **filters)
    if first['total'] > 10000:
        fail('NB_EXPORT_TOO_LARGE', 422)
    def rows():
        for page in range(1, first['pages'] + 1):
            data = first if page == 1 else query(db, page=page, limit=100, **filters)
            yield from data['orders' if kind == 'orders' else 'products']
    def values():
        if kind == 'orders':
            yield ['Order ID', 'Created at', 'Status', 'Test order', 'Payment status', 'Total VND', 'Recipient', 'Phone', 'Email', 'Address', 'City']
            for row in rows():
                yield [row['id'], row['created_at'].isoformat(), row['status'], row['is_test'], row['payment_status'], row['total'], row['delivery'].get('name', ''), row['delivery'].get('phone', ''), row['delivery'].get('email', ''), row['delivery'].get('address', ''), row['delivery'].get('city', '')]
        else:
            colors = {row['id']: row for row in first['colors']}
            yield ['Product ID', 'Vietnamese name', 'English name', 'Category', 'Price VND', 'Stock', 'Color ID', 'Color Vietnamese', 'Color English', 'Size', 'Variant stock']
            for row in rows():
                for variant in row['variants'] or [None]:
                    color = colors.get(variant['color'], {}) if variant else {}
                    yield [row['id'], row['name_vi'], row['name_en'], row['category'], row['price'], row['stock'], variant['color'] if variant else '', color.get('name_vi', ''), color.get('name_en', ''), variant['size'] if variant else '', variant['stock'] if variant else '']
    return {'filename': kind + '.csv', 'csv': csv_text(values()), 'total': first['total']}
