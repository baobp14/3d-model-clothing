from collections import Counter
from datetime import timezone
from uuid import uuid4

from sqlalchemy import exists, func, literal, or_, select, text
from sqlalchemy.dialects.postgresql import JSONB

from .errors import fail
from .inventory_layers import get_active_reserved_counts
from .models import StockMovement, ArchivedProduct, DatasetProduct, OrderEvent, OrderRefund, PromotionRule, QrPayment
from .models import AddressBook, Category, Color, Order, Product, Promotion, OrderPricing, ProductCreation, VariantInventory, OrderPayment, as_dict, now

# Actor recorded when the payment gateway, not a person, confirms a payment.
GATEWAY_ACTOR = '00000000-0000-0000-0000-000000000000'


def aware(value):
    # SQLite returns naive datetimes; every stored timestamp is UTC.
    return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value


def log_event(db, order, kind, user=None, from_status='', to_status='', role=None):
    db.add(OrderEvent(order_id=order.id, kind=kind, from_status=from_status, to_status=to_status,
                      actor_id=user.id if user else None, actor_role=role or (user.role if user else 'system')))


def promotion_dict(db, row):
    rule = db.get(PromotionRule, row.code)
    used = db.scalar(select(func.count()).select_from(OrderPricing).join(Order, Order.id == OrderPricing.order_id)
                     .where(OrderPricing.promotion_code == row.code, Order.status != 'canceled'))
    return {**as_dict(row), 'ends_at': aware(rule.ends_at) if rule else None, 'max_uses': rule.max_uses if rule else None,
            'min_subtotal': rule.min_subtotal if rule else 0, 'used': used or 0}


def check_promotion(db, promotion, subtotal):
    """Raise unless the code can be applied to this subtotal right now."""
    if not promotion or not promotion.active:
        fail('NB_PROMOTION_INVALID', 409)
    rule = db.get(PromotionRule, promotion.code)
    if rule is None:
        return
    if rule.ends_at is not None and aware(rule.ends_at) <= now():
        fail('NB_PROMOTION_EXPIRED', 409)
    if subtotal < rule.min_subtotal:
        fail('NB_PROMOTION_MIN_SUBTOTAL', 409)
    if rule.max_uses is not None and promotion_dict(db, promotion)['used'] >= rule.max_uses:
        fail('NB_PROMOTION_EXHAUSTED', 409)


def lock_customer(db, user_id):
    if db.bind.dialect.name == 'postgresql':
        # Same key as the previous SQL RPC: old and new clients also serialize.
        db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:owner, 0))'), {'owner': user_id})


def book_dict(book):
    return {'addresses': book.addresses, 'default_address_id': book.default_address_id, 'revision': book.revision}


def load_book(db, user):
    book = db.get(AddressBook, user.id)
    return book_dict(book) if book else {'addresses': [], 'default_address_id': None, 'revision': 0}


def mutate_book(db, user, operation):
    lock_customer(db, user.id)
    book = db.scalar(select(AddressBook).where(AddressBook.user_id == user.id).with_for_update())
    if book is None:
        # The advisory lock serializes Python calls. ON CONFLICT also handles a
        # first concurrent address save from a legacy SQL RPC.
        if db.bind.dialect.name == 'postgresql':
            db.execute(text('INSERT INTO customer_address_books(user_id) VALUES (:owner) ON CONFLICT DO NOTHING'), {'owner': user.id})
            book = db.scalar(select(AddressBook).where(AddressBook.user_id == user.id).with_for_update())
        else:
            book = AddressBook(user_id=user.id, addresses=[], revision=0)
            db.add(book)
            db.flush()
    if book.revision != operation.expected_revision:
        fail('NB_ADDRESS_CONFLICT', 409)
    addresses = [dict(address) for address in book.addresses]
    address_id = str(operation.id) if operation.id else None
    index = next((i for i, address in enumerate(addresses) if address['id'] == address_id), None)
    if address_id and index is None:
        fail('NB_ADDRESS_NOT_FOUND', 404)
    saved_id = None
    if operation.action == 'save':
        if address_id is None and len(addresses) >= 5:
            fail('NB_ADDRESS_LIMIT', 409)
        saved_id = address_id or str(uuid4())
        address = {**operation.address.model_dump(), 'id': saved_id}
        if index is None:
            addresses.append(address)
        else:
            addresses[index] = address
        if book.default_address_id is None or operation.make_default:
            book.default_address_id = saved_id
    elif operation.action == 'default':
        book.default_address_id = address_id
    else:
        addresses.pop(index)
        if book.default_address_id == address_id:
            book.default_address_id = addresses[0]['id'] if addresses else None
    book.addresses = addresses
    book.revision += 1
    book.updated_at = now()
    db.flush()
    return {**book_dict(book), 'saved_address_id': saved_id}


def color_gallery(product, dataset):
    if dataset is None:
        return {}
    # Admin image/color edits take precedence over the imported photo mapping.
    return {color: dataset.color_images[color] for index, color in enumerate(product.colors)
            if index < len(product.images) and dataset.color_images.get(color)
            and dataset.color_images[color][0] == product.images[index]}


def product_dict(db, product):
    inventory = db.get(VariantInventory, product.id)
    dataset = db.get(DatasetProduct, product.id)
    by_product, by_variant, _ = get_active_reserved_counts(db)
    res_p = by_product.get(product.id, 0)
    on_hand_p = product.stock + res_p
    v_layers = []
    if inventory and inventory.variants:
        for v in inventory.variants:
            c = v.get('color') or ''
            s = v.get('size') or ''
            stk = int(v.get('stock', 0))
            res_v = by_variant.get((product.id, c, s), 0)
            v_layers.append({
                'color': c,
                'size': s,
                'available': stk,
                'reserved': res_v,
                'on_hand': stk + res_v
            })
    return {**as_dict(product), 'variants': inventory.variants if inventory else None,
            'stock_revision': inventory.revision if inventory else None,
            'archived': db.get(ArchivedProduct, product.id) is not None,
            'color_images': color_gallery(product, dataset),
            'reserved_stock': res_p,
            'on_hand_stock': on_hand_p,
            'inventory_layers': {
                'available': product.stock,
                'reserved': res_p,
                'on_hand': on_hand_p,
                'variants': v_layers
            }}


def stock_snapshot(db, product):
    inventory = db.get(VariantInventory, product.id)
    return product.stock, [dict(row) for row in inventory.variants] if inventory else []


def record_stock(db, product, before, user, kind, reason='', order_id=None):
    after = stock_snapshot(db, product)
    if before == after:
        return
    old = {(r['color'], r['size']): r['stock'] for r in before[1]}
    new = {(r['color'], r['size']): r['stock'] for r in after[1]}
    changes = [{'color': c, 'size': s, 'before': old.get((c, s)), 'after': new.get((c, s))}
               for c, s in sorted(set(old) | set(new)) if old.get((c, s)) != new.get((c, s))]
    db.add(StockMovement(product_id=product.id, before_stock=before[0], after_stock=after[0], changes=changes,
                         actor_id=user.id, kind=kind, reason=reason.strip(), order_id=order_id))


def add_product(db, values, user=None):
    payload = values.model_dump(exclude={'request_id'})
    if values.request_id and user:
        if db.bind.dialect.name == 'postgresql':
            db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:request, 0))'), {'request': 'product-create:' + str(values.request_id)})
        previous = db.scalar(select(ProductCreation).where(ProductCreation.request_id == str(values.request_id)))
        if previous:
            if previous.user_id != user.id:
                fail('NB_PRODUCT_REQUEST_OWNER', 403)
            if previous.payload != payload:
                fail('NB_PRODUCT_REQUEST_CONFLICT', 409)
            return product_dict(db, db.get(Product, previous.product_id))
    category = db.get(Category, values.category)
    if category is None:
        fail('NB_INVALID_PRODUCT')
    product = Product(name_vi=values.name, name_en=values.name_en or values.name, category=category.id,
                      department=category.department, price=values.price, stock=values.stock, images=[values.image])
    db.add(product)
    db.flush()
    if user:
        record_stock(db, product, (0, []), user, 'create')
    if values.request_id and user:
        db.add(ProductCreation(user_id=user.id, request_id=str(values.request_id), payload=payload, product_id=product.id))
        db.flush()
    return product_dict(db, product)


def open_order_uses(db, product_id, choices=None, aggregate_only=False):
    """Check matching lines in SQL without loading active orders into Python."""
    if db.bind.dialect.name == 'postgresql':
        lines = func.jsonb_array_elements(Order.items).table_valued('value').alias('order_lines')
        item = lines.c.value.cast(JSONB)
        product = item['product_id'].as_integer()
        color, size = item['color'].as_string(), item['size'].as_string()
        variant = item['variant_stock'].as_boolean()
    else:
        lines = func.json_each(Order.items).table_valued('value').alias('order_lines')
        product = func.json_extract(lines.c.value, '$.product_id')
        color = func.json_extract(lines.c.value, '$.color')
        size = func.json_extract(lines.c.value, '$.size')
        variant = func.json_extract(lines.c.value, '$.variant_stock')
    statement = select(literal(1)).select_from(Order).join(lines, literal(True)).where(
        Order.status.in_(['pending', 'confirmed']), product == product_id)
    if choices is not None:
        statement = statement.where(or_(*((func.coalesce(color, '') == c) & (func.coalesce(size, '') == s) for c, s in sorted(choices))))
    if aggregate_only:
        statement = statement.where(func.coalesce(variant, False) == False)
    return db.scalar(select(exists(statement)))


def edit_product(db, product_id, values, user=None):
    product = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
    if product is None:
        fail('NB_PRODUCT_NOT_FOUND', 404)
    before = stock_snapshot(db, product)
    actual = {'name': product.name_vi, 'price': product.price, 'stock': product.stock, 'description': product.description}
    for field in ('name_en', 'description_en', 'colors', 'sizes', 'images'):
        if getattr(values.expected, field) is not None:
            actual[field] = getattr(product, field)
    if values.expected.model_dump(exclude_none=True) != actual:
        fail('NB_PRODUCT_CONFLICT', 409)
    inventory = db.get(VariantInventory, product.id)
    if inventory and values.stock != product.stock:
        fail('NB_VARIANT_STOCK_REQUIRED', 409)
    if values.colors is not None and any(db.get(Color, color) is None for color in values.colors):
        fail('NB_INVALID_PRODUCT')
    if inventory:
        combinations = {(color, size) for color in (values.colors if values.colors is not None else product.colors) or ['']
                        for size in (values.sizes if values.sizes is not None else product.sizes) or ['']}
        previous = {(row['color'], row['size']): row for row in inventory.variants}
        removed = set(previous) - combinations
        if any(previous[key]['stock'] for key in removed):
            fail('NB_VARIANT_HAS_STOCK', 409)
        if removed and open_order_uses(db, product.id, choices=removed):
            fail('NB_VARIANT_IN_USE', 409)
        if combinations != set(previous):
            inventory.variants = [dict(previous.get(key, {'color': key[0], 'size': key[1], 'stock': 0})) for key in sorted(combinations)]
            inventory.revision += 1
    for field in ('name_en', 'description_en', 'colors', 'sizes', 'images'):
        value = getattr(values, field)
        if value is not None:
            setattr(product, field, value)
    product.name_vi, product.price, product.stock = values.name, values.price, values.stock
    product.description = values.description.strip()
    if user:
        record_stock(db, product, before, user, 'adjust', values.reason)
    db.flush()
    return product_dict(db, product)


def configure_variants(db, product_id, values, user=None):
    product = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
    if not product:
        fail('NB_PRODUCT_NOT_FOUND', 404)
    before = stock_snapshot(db, product)
    inventory = db.get(VariantInventory, product_id)
    if product.stock != values.expected_stock or (inventory.revision if inventory else None) != values.expected_revision:
        fail('NB_PRODUCT_CONFLICT', 409)
    rows = [row.model_dump() for row in values.variants]
    keys = [(row['color'], row['size']) for row in rows]
    combinations = {(color, size) for color in product.colors or [''] for size in product.sizes or ['']}
    total = sum(row['stock'] for row in rows)
    if len(set(keys)) != len(keys) or set(keys) != combinations or total > 2147483647:
        fail('NB_INVALID_PRODUCT')
    if inventory is None:
        # Do not guess how existing physical stock is distributed.
        if total != product.stock:
            fail('NB_STOCK_ALLOCATION', 409)
        # Existing aggregate orders must remain cancelable after migration.
        if open_order_uses(db, product_id, aggregate_only=True):
            fail('NB_OPEN_AGGREGATE_ORDERS', 409)
        inventory = VariantInventory(product_id=product_id, revision=0, variants=rows)
        db.add(inventory)
    else:
        inventory.variants = rows
        inventory.revision += 1
    product.stock = total
    if user:
        record_stock(db, product, before, user, 'configure' if before[1] == [] else 'adjust', values.reason)
    db.flush()
    return product_dict(db, product)


def line_counts(items):
    counts = Counter()
    for item in items:
        counts[(item['product_id'], item.get('color') or '', item.get('size') or '')] += item['quantity']
    return counts


def place_order(db, user, values, max_open_orders=None):
    lock_customer(db, user.id)
    # Lock the customer's book even for retries, matching the address lifecycle.
    book = db.scalar(select(AddressBook).where(AddressBook.user_id == user.id).with_for_update())
    lines = [item.model_dump() for item in values.items]
    existing = db.scalar(select(Order).where(Order.user_id == user.id, Order.request_id == str(values.request_id)))
    if existing:
        pricing = db.get(OrderPricing, existing.id)
        if (pricing.promotion_code if pricing else '') != values.promotion_code:
            fail('NB_ORDER_CONFLICT', 409)
        if (existing.payment != values.payment or existing.delivery['id'] != str(values.address_id)
                or line_counts(existing.items) != line_counts(lines)):
            fail('NB_ORDER_CONFLICT', 409)
        return order_dict(db, existing)
    # Pending orders reserve stock; cap them so one account cannot hold the whole catalog.
    if max_open_orders is not None and db.scalar(select(func.count()).select_from(Order).where(
            Order.user_id == user.id, Order.status == 'pending')) >= max_open_orders:
        fail('NB_TOO_MANY_OPEN_ORDERS', 409)
    address = next((address for address in (book.addresses if book else []) if address['id'] == str(values.address_id)), None)
    if address is None:
        fail('NB_ADDRESS_NOT_FOUND', 404)
    quantities = Counter()
    for item in values.items:
        quantities[item.product_id] += item.quantity
    # Lock in a stable order so two customers buying the same products do not deadlock.
    products = {}
    for product_id in sorted(quantities):
        product = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
        if product is None or db.get(ArchivedProduct, product_id):
            fail('NB_PRODUCT_NOT_FOUND', 404)
        if product.stock < quantities[product_id]:
            fail('NB_INSUFFICIENT_STOCK', 409)
        products[product_id] = product
    inventories = {product_id: db.get(VariantInventory, product_id) for product_id in products}
    before_stock = {product_id: stock_snapshot(db, product) for product_id, product in products.items()}
    variant_counts = line_counts(lines)
    for product_id, inventory in inventories.items():
        if inventory:
            rows = [dict(row) for row in inventory.variants]
            for row in rows:
                quantity = variant_counts[(product_id, row['color'], row['size'])]
                if row['stock'] < quantity:
                    fail('NB_INSUFFICIENT_STOCK', 409)
                row['stock'] -= quantity
            inventory.variants = rows
            inventory.revision += 1
    total, snapshots = 0, []
    for item in values.items:
        product = products[item.product_id]
        if item.expected_price is not None and item.expected_price != product.price:
            fail('NB_PRICE_CHANGED', 409)
        if ((item.color not in product.colors if product.colors else bool(item.color)) or
                (item.size not in product.sizes if product.sizes else bool(item.size))):
            fail('NB_INVALID_ORDER')
        total += product.price * item.quantity
        if total > 9007199254740991:
            fail('NB_INVALID_ORDER')
        color = db.get(Color, item.color) if item.color else None
        snapshots.append({**item.model_dump(), 'name': product.name_vi, 'name_vi': product.name_vi,
                          'name_en': product.name_en, 'color_vi': color.name_vi if color else '',
                          'color_en': color.name_en if color else '', 'variant_stock': bool(inventories[item.product_id]), 'price': product.price})
    discount = 0
    promotion = None
    if values.promotion_code:
        # The row lock serializes uses of one code, so max_uses cannot be overshot.
        promotion = db.scalar(select(Promotion).where(Promotion.code == values.promotion_code).with_for_update())
        check_promotion(db, promotion, total)
        discount = total * promotion.percent // 100
        if values.expected_discount is None or values.expected_discount != discount:
            fail('NB_PRICE_CHANGED', 409)
    for product_id, quantity in quantities.items():
        products[product_id].stock -= quantity
    order = Order(user_id=user.id, request_id=str(values.request_id), items=snapshots,
                  delivery=dict(address), payment=values.payment, total=total - discount)
    db.add(order)
    db.flush()
    log_event(db, order, 'created', user, to_status='pending')
    for product_id, product in products.items():
        record_stock(db, product, before_stock[product_id], user, 'order', order_id=order.id)
    if promotion:
        db.add(OrderPricing(order_id=order.id, subtotal=total, discount=discount, promotion_code=promotion.code, percent=promotion.percent))
        db.flush()
    return order_dict(db, order)


def order_dict(db, order, pricing=None, payment=None, lookup=True, products=None, colors=None):
    if lookup:
        pricing = db.get(OrderPricing, order.id)
        payment = db.get(OrderPayment, order.id)
    if products is None and any('name_en' not in line for line in order.items):
        ids = {line['product_id'] for line in order.items}
        products = {row.id: row for row in db.scalars(select(Product).where(Product.id.in_(ids)))}
    if colors is None and any('color_en' not in line for line in order.items):
        colors = {row.id: row for row in db.scalars(select(Color))}
    items = []
    for line in order.items:
        item = dict(line)
        product = (products or {}).get(item['product_id'])
        color = (colors or {}).get(item.get('color'))
        item.setdefault('name_vi', item['name'])
        item.setdefault('name_en', product.name_en if product else item['name'])
        item.setdefault('color_vi', color.name_vi if color else item.get('color', ''))
        item.setdefault('color_en', color.name_en if color else item.get('color', ''))
        items.append(item)
    refund = db.get(OrderRefund, order.id)
    return {**as_dict(order), 'items': items, 'payment_status': 'received' if payment else 'unpaid',
            'received_at': payment.received_at if payment else None, 'subtotal': pricing.subtotal if pricing else order.total,
            'discount': pricing.discount if pricing else 0, 'promotion_code': pricing.promotion_code if pricing else '',
            'refund_status': ('done' if refund.refunded_at else 'required') if refund else None,
            'refund_amount': refund.amount if refund else 0, 'refunded_at': refund.refunded_at if refund else None}


def change_order_status(db, order_id, values, user, admin=False):
    order = db.get(Order, str(order_id))
    if order is None or (not admin and order.user_id != user.id):
        fail('NB_ORDER_NOT_FOUND', 404)
    lock_customer(db, order.user_id)
    order = db.scalar(select(Order).where(Order.id == str(order_id)).with_for_update().execution_options(populate_existing=True))
    if order.status != values.expected_status:
        fail('NB_ORDER_STATUS_CONFLICT', 409)
    transitions = {'pending': {'confirmed', 'canceled'}, 'confirmed': {'shipped', 'canceled'}, 'shipped': {'delivered'}}
    if values.status not in transitions.get(order.status, set()) or (not admin and (order.status != 'pending' or values.status != 'canceled')):
        fail('NB_ORDER_STATUS_INVALID', 409)
    paid = db.get(OrderPayment, order.id)
    # QR orders are prepaid: do not prepare or ship goods before the money arrives.
    if order.payment == 'qr' and not paid and values.status in ('confirmed', 'shipped', 'delivered'):
        fail('NB_PAYMENT_REQUIRED', 409)
    if values.status == 'canceled' and paid:
        # Customers cannot cancel paid orders; an admin can, which opens a refund to settle.
        if not admin:
            fail('NB_PAID_ORDER_CANCEL', 409)
        db.add(OrderRefund(order_id=order.id, amount=order.total, created_by=user.id))
        log_event(db, order, 'refund_required', user)
    if values.status == 'canceled':
        restock_order(db, order, user, 'cancel')
    log_event(db, order, 'status', user, from_status=order.status, to_status=values.status)
    if getattr(values, 'carrier', None) or getattr(values, 'tracking_code', None):
        delivery = dict(order.delivery)
        if values.carrier:
            delivery['carrier'] = values.carrier
        if values.tracking_code:
            delivery['tracking_code'] = values.tracking_code
        order.delivery = delivery
    order.status = values.status
    db.flush()
    return order_dict(db, order)


def update_order_shipping(db, order_id, values, user):
    order = db.get(Order, str(order_id))
    if order is None:
        fail('NB_ORDER_NOT_FOUND', 404)
    delivery = dict(order.delivery)
    delivery['carrier'] = values.carrier
    delivery['tracking_code'] = values.tracking_code
    order.delivery = delivery
    log_event(db, order, 'shipping_updated', user)
    db.flush()
    return order_dict(db, order)


def restock_order(db, order, user, kind):
    """Put every line of `order` back into product and variant stock (cancel or sellable return)."""
    quantities = Counter()
    for item in order.items:
        quantities[item['product_id']] += item['quantity']
    for product_id in sorted(quantities):
        product = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
        if product is None or product.stock + quantities[product_id] > 2147483647:
            fail('NB_INVALID_PRODUCT', 409)
        before = stock_snapshot(db, product)
        inventory = db.get(VariantInventory, product_id)
        if inventory:
            rows = [dict(row) for row in inventory.variants]
            counts = line_counts([item for item in order.items if item['product_id'] == product_id])
            for row in rows:
                row['stock'] += counts[(product_id, row['color'], row['size'])]
            if sum(counts.values()) != sum(counts[(product_id, row['color'], row['size'])] for row in rows):
                fail('NB_VARIANT_IN_USE', 409)
            inventory.variants = rows
            inventory.revision += 1
        product.stock += quantities[product_id]
        record_stock(db, product, before, user, kind, order_id=order.id)


def receive_payment(db, order_id, user=None, gateway_reference=None):
    """Record payment once. `user` is the admin; without one the gateway confirmed it."""
    order = db.get(Order, str(order_id))
    if not order:
        fail('NB_ORDER_NOT_FOUND', 404)
    lock_customer(db, order.user_id)
    order = db.scalar(select(Order).where(Order.id == str(order_id)).with_for_update().execution_options(populate_existing=True))
    if not db.get(OrderPayment, order.id):
        if order.status == 'canceled':
            if user is not None:
                fail('NB_ORDER_STATUS_INVALID', 409)
            # Money for a canceled QR order still arrived: record it and refund it.
            db.add(OrderRefund(order_id=order.id, amount=order.total, created_by=GATEWAY_ACTOR))
            log_event(db, order, 'refund_required', role='gateway')
        db.add(OrderPayment(order_id=order.id, received_by=user.id if user else GATEWAY_ACTOR))
        qr = db.get(QrPayment, order.id)
        if qr and gateway_reference:
            qr.paid_reference = gateway_reference
        log_event(db, order, 'payment', user, role=None if user else 'gateway')
        db.flush()
    return order_dict(db, order)


def complete_refund(db, order_id, user):
    order = db.get(Order, str(order_id))
    refund = db.get(OrderRefund, str(order_id))
    if not order or not refund:
        fail('NB_ORDER_NOT_FOUND', 404)
    lock_customer(db, order.user_id)
    refund = db.scalar(select(OrderRefund).where(OrderRefund.order_id == order.id).with_for_update().execution_options(populate_existing=True))
    if refund.refunded_at is None:
        refund.refunded_at, refund.refunded_by = now(), user.id
        log_event(db, order, 'refunded', user)
        db.flush()
    return order_dict(db, order)


def order_events(db, order_id):
    rows = db.scalars(select(OrderEvent).where(OrderEvent.order_id == str(order_id)).order_by(OrderEvent.created_at, OrderEvent.id))
    return {'events': [as_dict(row) for row in rows]}


def set_archived(db, product_id, archived, reason, user):
    product = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
    if product is None:
        fail('NB_PRODUCT_NOT_FOUND', 404)
    row = db.get(ArchivedProduct, product_id)
    if archived and row is None:
        db.add(ArchivedProduct(product_id=product_id, reason=reason.strip() or 'admin'))
    elif not archived and row is not None:
        db.delete(row)
    db.flush()
    return product_dict(db, product)
