from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import DateTime, Text, func, literal, or_, select

from .errors import fail
from .models import Color, Order, OrderPayment, OrderPricing, Product, DemoOrder
from .services import order_dict
from .product_pages import normalized
from .search import normalize

VN = timezone(timedelta(hours=7))


def bounds(start, end):
    if (start and end and start > end) or end == date.max:
        fail('NB_INVALID_DATE_RANGE')
    return (datetime.combine(start, time.min, VN).astimezone(timezone.utc) if start else None,
            datetime.combine(end + timedelta(days=1), time.min, VN).astimezone(timezone.utc) if end else None)


def real_orders():
    return Order.id.not_in(select(DemoOrder.order_id))


def list_orders(db, owner=None, page=1, limit=20, q='', status=None, paid=None, start=None, end=None, scope='all'):
    statement = select(Order, OrderPricing, OrderPayment).outerjoin(OrderPricing, OrderPricing.order_id == Order.id).outerjoin(OrderPayment, OrderPayment.order_id == Order.id)
    if owner:
        statement = statement.where(Order.user_id == owner)
    if scope != 'all':
        statement = statement.where(real_orders() if scope == 'real' else Order.id.in_(select(DemoOrder.order_id)))
    for token in normalize(q).split():
        statement = statement.where(or_(
            func.lower(func.replace(Order.id.cast(Text), '-', '')).contains(token.replace('-', ''), autoescape=True) if token.replace('-', '') else False,
            normalized(db, Order.delivery['name'].as_string()).contains(token, autoescape=True),
            Order.delivery['phone'].as_string().contains(token, autoescape=True),
            normalized(db, Order.delivery['email'].as_string()).contains(token, autoescape=True)))
    if status:
        statement = statement.where(Order.status == status)
    if paid:
        statement = statement.where(OrderPayment.order_id.is_not(None) if paid == 'received' else OrderPayment.order_id.is_(None))
    lower, upper = bounds(start, end)
    if lower:
        statement = statement.where(Order.created_at >= lower)
    if upper:
        statement = statement.where(Order.created_at < upper)
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    rows = db.execute(statement.order_by(Order.created_at.desc(), Order.id.desc()).offset((page - 1) * limit).limit(limit)).all()
    ids = {item['product_id'] for order, _, _ in rows for item in order.items}
    products = {row.id: row for row in db.scalars(select(Product).where(Product.id.in_(ids)))} if ids else {}
    colors = {row.id: row for row in db.scalars(select(Color))} if rows else {}
    demo_ids = set(db.scalars(select(DemoOrder.order_id).where(DemoOrder.order_id.in_([order.id for order, _, _ in rows])))) if rows else set()
    return {'orders': [{**order_dict(db, order, pricing, payment, lookup=False, products=products, colors=colors), 'is_test': order.id in demo_ids} for order, pricing, payment in rows],
            'total': total, 'page': page, 'limit': limit, 'pages': max(1, (total + limit - 1) // limit)}


def report(db, period='day', start=None, end=None, include_test=False):
    today = datetime.now(VN).date()
    start = start or today - timedelta(days=29)
    end = end or today
    lower, upper = bounds(start, end)
    if (end - start).days > 366:
        fail('NB_INVALID_DATE_RANGE')
    # Group in SQL; neither order items nor customer data are loaded for charts.
    local_created = Order.created_at.op('AT TIME ZONE', return_type=DateTime())(literal('Asia/Ho_Chi_Minh', Text)) if db.bind.dialect.name == 'postgresql' else func.datetime(Order.created_at, '+7 hours')
    local_received = OrderPayment.received_at.op('AT TIME ZONE', return_type=DateTime())(literal('Asia/Ho_Chi_Minh', Text)) if db.bind.dialect.name == 'postgresql' else func.datetime(OrderPayment.received_at, '+7 hours')
    fmt = 'YYYY-MM' if period == 'month' else 'YYYY-MM-DD'
    bucket = func.to_char(local_created, fmt) if db.bind.dialect.name == 'postgresql' else func.strftime('%Y-%m' if period == 'month' else '%Y-%m-%d', local_created)
    payment_bucket = func.to_char(local_received, fmt) if db.bind.dialect.name == 'postgresql' else func.strftime('%Y-%m' if period == 'month' else '%Y-%m-%d', local_received)
    included = True if include_test else real_orders()
    order_rows = db.execute(select(bucket.label('bucket'), func.count(Order.id), func.sum(Order.total)).where(included, Order.created_at >= lower, Order.created_at < upper, Order.status != 'canceled').group_by(bucket)).all()
    payment_rows = db.execute(select(payment_bucket.label('bucket'), func.sum(Order.total)).select_from(OrderPayment).join(Order, Order.id == OrderPayment.order_id).where(included, OrderPayment.received_at >= lower, OrderPayment.received_at < upper).group_by(payment_bucket)).all()
    ordered = {key: (count, value) for key, count, value in order_rows}
    received = dict(payment_rows)
    series = []
    day = start
    while day <= end:
        key = day.strftime('%Y-%m' if period == 'month' else '%Y-%m-%d')
        if not series or series[-1]['date'] != key:
            count, value = ordered.get(key, (0, 0))
            series.append({'date': key, 'orders': count, 'order_value': value or 0, 'received': received.get(key, 0) or 0})
        day += timedelta(days=1)
    return {'period': period, 'start': str(start), 'end': str(end), 'series': series,
            'orders': sum(row['orders'] for row in series), 'order_value': sum(row['order_value'] for row in series),
            'received': sum(row['received'] for row in series)}
