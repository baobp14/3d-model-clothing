from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, JSON, Text, TypeDecorator, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


class UtcDateTime(TypeDecorator):
    """DateTime(timezone=True) that also stays aware on SQLite, which drops the offset.
    Values are written in UTC, so a naive value read back is UTC."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value


class Base(DeclarativeBase):
    pass


json_type = JSON().with_variant(JSONB(), 'postgresql')
array_type = JSON().with_variant(ARRAY(Text()), 'postgresql')


class Category(Base):
    __tablename__ = 'categories'
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name_vi: Mapped[str] = mapped_column(Text)
    name_en: Mapped[str] = mapped_column(Text)
    department: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)


class Color(Base):
    __tablename__ = 'colors'
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name_vi: Mapped[str] = mapped_column(Text)
    name_en: Mapped[str] = mapped_column(Text)
    hex: Mapped[str] = mapped_column(Text)


class Product(Base):
    __tablename__ = 'products'
    __table_args__ = (CheckConstraint('price >= 0'), CheckConstraint('stock >= 0'))
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, 'sqlite'), primary_key=True, autoincrement=True)
    name_vi: Mapped[str] = mapped_column(Text)
    name_en: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(ForeignKey('categories.id'))
    department: Mapped[str] = mapped_column(Text, index=True)
    price: Mapped[int] = mapped_column(BigInteger)
    stock: Mapped[int] = mapped_column(Integer, default=500)
    colors: Mapped[list] = mapped_column(array_type, default=list)
    sizes: Mapped[list] = mapped_column(array_type, default=list)
    images: Mapped[list] = mapped_column(array_type, default=list)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str] = mapped_column(Text, default='')
    description_en: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class ArchivedProduct(Base):
    __tablename__ = 'shop_archived_products'
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), primary_key=True)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class DatasetProduct(Base):
    __tablename__ = 'shop_dataset_products'
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), primary_key=True)
    dataset_key: Mapped[str] = mapped_column(Text, unique=True)
    color_images: Mapped[dict] = mapped_column(json_type, default=dict)


def active_products():
    from sqlalchemy import select
    return Product.id.not_in(select(ArchivedProduct.product_id))


class AddressBook(Base):
    __tablename__ = 'customer_address_books'
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    addresses: Mapped[list] = mapped_column(json_type, default=list)
    default_address_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    revision: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class Order(Base):
    __tablename__ = 'shop_orders'
    __table_args__ = (UniqueConstraint('user_id', 'request_id'), CheckConstraint('total >= 0'))
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), index=True)
    request_id: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    items: Mapped[list] = mapped_column(json_type)
    delivery: Mapped[dict] = mapped_column(json_type)
    payment: Mapped[str] = mapped_column(Text)
    total: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(Text, default='pending')
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class WishlistItem(Base):
    __tablename__ = 'shop_wishlist'
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), primary_key=True)


class Promotion(Base):
    __tablename__ = 'shop_promotions'
    __table_args__ = (CheckConstraint('percent >= 1 AND percent <= 80'),)
    code: Mapped[str] = mapped_column(Text, primary_key=True)
    percent: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class OrderPricing(Base):
    __tablename__ = 'shop_order_pricing'
    order_id: Mapped[str] = mapped_column(ForeignKey('shop_orders.id'), primary_key=True)
    subtotal: Mapped[int] = mapped_column(BigInteger)
    discount: Mapped[int] = mapped_column(BigInteger)
    promotion_code: Mapped[str] = mapped_column(Text)
    percent: Mapped[int] = mapped_column(Integer)


class ProductCreation(Base):
    __tablename__ = 'shop_product_requests'
    __table_args__ = (UniqueConstraint('request_id'),)
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    request_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    payload: Mapped[dict] = mapped_column(json_type)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'))


class VariantInventory(Base):
    __tablename__ = 'shop_variant_inventory'
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), primary_key=True)
    revision: Mapped[int] = mapped_column(BigInteger, default=0)
    variants: Mapped[list] = mapped_column(json_type)


class StockMovement(Base):
    __tablename__ = 'shop_stock_movements'
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), index=True)
    before_stock: Mapped[int] = mapped_column(BigInteger)
    after_stock: Mapped[int] = mapped_column(BigInteger)
    changes: Mapped[list] = mapped_column(json_type)
    kind: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    actor_id: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    order_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), ForeignKey('shop_orders.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now, index=True)


class NotificationRead(Base):
    __tablename__ = 'shop_notification_reads'
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    read_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class DemoOrder(Base):
    __tablename__ = 'shop_demo_orders'
    order_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey('shop_orders.id'), primary_key=True)


class OrderPayment(Base):
    __tablename__ = 'shop_order_payments'
    order_id: Mapped[str] = mapped_column(ForeignKey('shop_orders.id'), primary_key=True)
    received_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)
    received_by: Mapped[str] = mapped_column(Uuid(as_uuid=False))


class OrderEvent(Base):
    """Who changed an order and when: creation, status, payment and refund steps."""
    __tablename__ = 'shop_order_events'
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey('shop_orders.id'), index=True)
    kind: Mapped[str] = mapped_column(Text)
    from_status: Mapped[str] = mapped_column(Text, default='')
    to_status: Mapped[str] = mapped_column(Text, default='')
    actor_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    actor_role: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class OrderRefund(Base):
    """A paid order canceled by an admin; money must be returned outside the shop."""
    __tablename__ = 'shop_order_refunds'
    order_id: Mapped[str] = mapped_column(ForeignKey('shop_orders.id'), primary_key=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)
    created_by: Mapped[str] = mapped_column(Uuid(as_uuid=False))
    refunded_at: Mapped[datetime | None] = mapped_column(UtcDateTime(), nullable=True)
    refunded_by: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)


class QrPayment(Base):
    """TConnect dynamic QR for one order; `reference` is the order id sent to the bank."""
    __tablename__ = 'shop_qr_payments'
    order_id: Mapped[str] = mapped_column(ForeignKey('shop_orders.id'), primary_key=True)
    reference: Mapped[str] = mapped_column(Text, unique=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    qr_content: Mapped[str] = mapped_column(Text)
    image_png_base64: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)
    paid_reference: Mapped[str] = mapped_column(Text, default='')


class PromotionRule(Base):
    """Optional limits for a promotion code; a code without a row has no limits."""
    __tablename__ = 'shop_promotion_rules'
    __table_args__ = (CheckConstraint('max_uses IS NULL OR max_uses >= 1'), CheckConstraint('min_subtotal >= 0'))
    code: Mapped[str] = mapped_column(ForeignKey('shop_promotions.code'), primary_key=True)
    ends_at: Mapped[datetime | None] = mapped_column(UtcDateTime(), nullable=True)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_subtotal: Mapped[int] = mapped_column(BigInteger, default=0)


class Review(Base):
    """One rating per product per delivered order of the customer who bought it."""
    __tablename__ = 'shop_reviews'
    __table_args__ = (UniqueConstraint('order_id', 'product_id'), CheckConstraint('rating BETWEEN 1 AND 5'))
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), index=True)
    order_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey('shop_orders.id'))
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default='')
    author: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class ReturnRequest(Base):
    """Return of a delivered order: pending -> approved | rejected, approved -> received.
    Stock comes back only when an admin receives the goods and marks them sellable."""
    __tablename__ = 'shop_return_requests'
    __table_args__ = (CheckConstraint("status IN ('pending', 'approved', 'rejected', 'received')"),)
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey('shop_orders.id'), unique=True)
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), index=True)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default='pending')
    restocked: Mapped[bool] = mapped_column(Boolean, default=False)
    admin_note: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


class ProductSizeChart(Base):
    """Garment measurements per size for one product: copied from a brand's published
    chart, or measured by the shop when the brand publishes none."""
    __tablename__ = 'shop_product_size_charts'
    __table_args__ = (CheckConstraint("source IN ('brand', 'measured')"),
                      CheckConstraint("kind IN ('tshirt', 'pants', 'shorts', 'skirt')"))
    product_id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, 'sqlite'), ForeignKey('products.id'), primary_key=True)
    source: Mapped[str] = mapped_column(Text)
    brand_chart: Mapped[str] = mapped_column(Text, default='')
    kind: Mapped[str] = mapped_column(Text)
    sizes: Mapped[dict] = mapped_column(JSON)
    note: Mapped[str] = mapped_column(Text, default='')
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime(), default=now)


def as_dict(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}
