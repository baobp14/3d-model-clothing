"""Create identifiable demo records once: python -m app.seed_demo."""
from datetime import datetime, timedelta, timezone
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .config import Settings
from .db import make_engine
from .models import Color, Order, OrderPayment, Product, VariantInventory, DemoOrder


def main():
    engine = make_engine(Settings().database_url)
    created_products = created_orders = 0
    with Session(engine) as db, db.begin():
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext('nb-demo-seed-v1'))"))
        owner = db.scalar(text("SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' ORDER BY created_at LIMIT 1"))
        if not owner:
            raise RuntimeError('An existing admin account is required; no auth account is created.')
        owner = str(owner)
        colors = {c.id: c for c in db.scalars(select(Color))}
        products = []
        definitions = [
            ('[TEST] Áo thun kho màu và size', '[TEST] Color and size stock T-shirt', 'm-tshirts', 'men', 199000, '/img/products/hm-0685814001.webp'),
            ('[TEST] Áo sơ mi mẫu', '[TEST] Demo shirt', 'm-shirts', 'men', 349000, '/img/products/hm-0685814002.webp'),
            ('[TEST] Quần mẫu', '[TEST] Demo trousers', 'm-trousers', 'men', 459000, '/img/products/hm-0685814003.webp'),
        ]
        for index, (vi, en, category, department, price, image) in enumerate(definitions):
            seed_order = db.get(Order, str(uuid5(NAMESPACE_URL, f'nb-demo-seed-v1/order/{index}')))
            product = db.get(Product, seed_order.items[0]['product_id']) if seed_order else db.scalar(select(Product).where(Product.name_vi == vi))
            if product is None:
                variants = [{'color': color, 'size': size, 'stock': (0 if color == 'white' and size == 'S' else 30)}
                            for color in ('black', 'white') for size in ('S', 'M', 'L')]
                product = Product(name_vi=vi, name_en=en, category=category, department=department,
                                  price=price, stock=sum(v['stock'] for v in variants), colors=['black', 'white'],
                                  sizes=['S', 'M', 'L'], images=[image], is_new=True,
                                  description='[TEST] Dữ liệu mẫu để thử tồn kho từng màu/size. Màu trắng size S hết hàng.',
                                  description_en='[TEST] Demo variant inventory. White size S is sold out.')
                db.add(product)
                db.flush()
                db.add(VariantInventory(product_id=product.id, revision=0, variants=variants))
                created_products += 1
            products.append(product)
        db.flush()
        now = datetime.now(timezone.utc)
        for index in range(26):
            order_id = str(uuid5(NAMESPACE_URL, f'nb-demo-seed-v1/order/{index}'))
            if db.get(Order, order_id):
                continue
            product = products[index % len(products)]
            status = ['pending', 'confirmed', 'shipped', 'delivered', 'canceled'][index % 5]
            color = ['black', 'white'][index % 2]
            size = ['M', 'L'][index % 2]
            quantity = 1 + index % 3
            created_at = now - timedelta(days=index * 2, hours=index % 4)
            if status != 'canceled':
                book = db.get(VariantInventory, product.id)
                variants = [dict(v) for v in book.variants]
                variant = next(v for v in variants if v['color'] == color and v['size'] == size)
                if variant['stock'] < quantity:
                    raise RuntimeError('Demo stock insufficient; transaction rolled back.')
                variant['stock'] -= quantity
                book.variants = variants
                book.revision += 1
                product.stock -= quantity
            item = {'product_id': product.id, 'name': product.name_vi, 'name_vi': product.name_vi,
                    'name_en': product.name_en, 'color': color, 'color_vi': colors[color].name_vi,
                    'color_en': colors[color].name_en, 'size': size, 'quantity': quantity,
                    'price': product.price, 'variant_stock': True}
            order = Order(id=order_id, user_id=owner,
                          request_id=str(uuid5(NAMESPACE_URL, f'nb-demo-seed-v1/request/{index}')),
                          items=[item], total=product.price * quantity, status=status,
                          payment='cod' if index % 2 == 0 else 'qr', created_at=created_at,
                          delivery={'name': f'[TEST] Khách mẫu {index + 1:02}', 'phone': '0000000000',
                                    'email': 'demo@example.invalid', 'address': '[TEST] Địa chỉ giả lập',
                                    'city': 'TP. Hồ Chí Minh',
                                    'notes': '[TEST] Đơn mẫu để thử giao diện, không giao hàng hoặc thu tiền thật.'})
            db.add(order)
            db.flush()
            db.add(DemoOrder(order_id=order_id))
            if status in ('shipped', 'delivered') and index % 3 != 0:
                db.add(OrderPayment(order_id=order_id, received_by=owner,
                                    received_at=min(now, created_at + timedelta(days=1))))
            created_orders += 1
        db.flush()
        for product in products:
            book = db.get(VariantInventory, product.id)
            assert product.stock == sum(v['stock'] for v in book.variants)
    engine.dispose()
    print(f'Demo ready: {created_products} products and {created_orders} orders added. Re-running does not duplicate records.')


if __name__ == '__main__':
    main()
