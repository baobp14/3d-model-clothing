from collections import Counter
import json
from sqlalchemy import select
from .models import Order, Product, VariantInventory, Category, Color, as_dict

# Rule-based location mapping for a single boutique store (No extra DB table needed!)
RACK_LOCATION_MAP = {
    'm-shirts': {'display_rack': 'Sào S-01 (Mặt trước)', 'backroom_shelf': 'Kệ K-A1'},
    'm-tshirts': {'display_rack': 'Sào T-01 (Khu vực trung tâm)', 'backroom_shelf': 'Kệ K-A2'},
    'm-trousers': {'display_rack': 'Kệ Quần Q-01 (Bên trái)', 'backroom_shelf': 'Kệ K-B1'},
    'w-skirts': {'display_rack': 'Sào V-01 (Khu nữ sảnh)', 'backroom_shelf': 'Kệ K-C1'},
    'w-tshirts': {'display_rack': 'Sào WT-01 (Khu nữ)', 'backroom_shelf': 'Kệ K-C2'},
    'w-trousers': {'display_rack': 'Kệ Quần WQ-01 (Khu nữ)', 'backroom_shelf': 'Kệ K-C3'},
}

def get_active_reserved_counts(db):
    """
    Computes reserved stock from active orders (pending, confirmed)
    waiting to be packed and shipped.
    Returns:
        by_product: Counter {product_id: int}
        by_variant: Counter {(product_id, color, size): int}
        open_orders_count: int
    """
    orders = db.scalars(
        select(Order.items).where(Order.status.in_(['pending', 'confirmed']))
    ).all()

    by_product = Counter()
    by_variant = Counter()

    for items in orders:
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except Exception:
                continue
        for item in (items or []):
            p_id = item.get('product_id')
            qty = int(item.get('quantity', 1))
            c_name = item.get('color') or ''
            s_name = item.get('size') or ''
            by_product[p_id] += qty
            by_variant[(p_id, c_name, s_name)] += qty

    return by_product, by_variant, len(orders)


def get_location_hint(category_id):
    """Returns store floor and backroom location hint without extra database tables."""
    return RACK_LOCATION_MAP.get(category_id, {
        'display_rack': 'Sào trưng bày chung',
        'backroom_shelf': 'Kho sau kệ tiêu chuẩn'
    })


def get_product_inventory_layers(db, product_id):
    """
    Returns full 2-layer inventory details for a specific product:
    - Layer 1: Physical On-Hand stock present in store
    - Layer 2: Reserved stock committed to active online orders
    - Derived: Available stock for in-store walk-in checkout or new orders
    """
    product = db.get(Product, product_id)
    if not product:
        return None

    by_product, by_variant, _ = get_active_reserved_counts(db)
    inventory = db.get(VariantInventory, product_id)
    
    reserved_prod = by_product.get(product.id, 0)
    available_prod = int(product.stock)
    on_hand_prod = available_prod + reserved_prod

    loc = get_location_hint(product.category)

    variants_layer = []
    if inventory and inventory.variants:
        for v in inventory.variants:
            c = v.get('color') or ''
            s = v.get('size') or ''
            stk = int(v.get('stock', 0))
            res = by_variant.get((product.id, c, s), 0)
            on_hand = stk + res
            variants_layer.append({
                'color': c,
                'size': s,
                'available': stk,
                'reserved': res,
                'on_hand': on_hand,
                'can_sell_in_store': stk > 0,
                'display_rack': loc['display_rack'],
                'backroom_shelf': loc['backroom_shelf']
            })

    return {
        'product_id': product.id,
        'name_vi': product.name_vi,
        'name_en': product.name_en,
        'category': product.category,
        'price': product.price,
        'on_hand_stock': on_hand_prod,
        'reserved_stock': reserved_prod,
        'available_stock': available_prod,
        'display_rack': loc['display_rack'],
        'backroom_shelf': loc['backroom_shelf'],
        'variants': variants_layer
    }


def get_store_inventory_overview(db):
    """
    Returns high-level 2-layer KPI summary for the entire boutique store.
    """
    products = list(db.scalars(select(Product)).all())
    by_product, _, open_orders = get_active_reserved_counts(db)

    total_available = sum(p.stock for p in products)
    total_reserved = sum(by_product.get(p.id, 0) for p in products)
    total_on_hand = total_available + total_reserved

    return {
        'total_products': len(products),
        'total_on_hand': total_on_hand,
        'total_reserved': total_reserved,
        'total_available': total_available,
        'open_orders_count': open_orders
    }


def check_pos_availability(db, product_id, color='', size='', requested_qty=1):
    """
    Enables cashier / POS in the store to instantly check if an item
    can be sold to a walk-in customer without conflicting with online orders.
    """
    product = db.get(Product, product_id)
    if not product:
        return {'found': False, 'message': 'Sản phẩm không tồn tại.'}

    by_product, by_variant, _ = get_active_reserved_counts(db)
    inventory = db.get(VariantInventory, product_id)

    if inventory and inventory.variants:
        match = next((v for v in inventory.variants if (v.get('color') or '') == color and (v.get('size') or '') == size), None)
        if not match:
            return {'found': False, 'message': f'Biến thể màu {color} size {size} không tồn tại.'}
        available = int(match.get('stock', 0))
        reserved = by_variant.get((product_id, color, size), 0)
    else:
        available = int(product.stock)
        reserved = by_product.get(product_id, 0)

    on_hand = available + reserved
    can_sell = available >= requested_qty

    loc = get_location_hint(product.category)

    if can_sell:
        msg = f"ĐỦ HÀNG: Còn {available} chiếc khả dụng để bán tại quầy (Tồn thực tế trong shop: {on_hand}, đang giữ đơn online: {reserved})."
    else:
        if on_hand > 0:
            msg = f"HẾT KHẢ DỤNG: Trong shop còn {on_hand} chiếc nhưng ĐÃ CÓ KHÁCH WEB ĐẶT TRƯỚC {reserved} chiếc. Không thể bán tại quầy để tránh xung đột đơn."
        else:
            msg = "HẾT HÀNG: Cửa hàng đã hết sạch mẫu này cả tại quầy lẫn online."

    return {
        'found': True,
        'product_id': product.id,
        'product_name': product.name_vi,
        'color': color,
        'size': size,
        'available': available,
        'reserved': reserved,
        'on_hand': on_hand,
        'can_sell': can_sell,
        'requested_qty': requested_qty,
        'display_rack': loc['display_rack'],
        'backroom_shelf': loc['backroom_shelf'],
        'message': msg
    }
