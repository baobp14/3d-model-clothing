"""Add shop extension tables without modifying existing products or orders."""
from sqlalchemy import Index, text
from .config import Settings
from .db import make_engine
from .models import WishlistItem, Promotion, OrderPricing, ProductCreation, VariantInventory, OrderPayment, Order, DemoOrder
from .models import StockMovement, NotificationRead, ArchivedProduct, DatasetProduct, OrderEvent, OrderRefund, QrPayment, PromotionRule


def migrate(engine):
    with engine.begin() as connection:
        for model in (WishlistItem, Promotion, OrderPricing, ProductCreation, VariantInventory, OrderPayment, DemoOrder, StockMovement, NotificationRead, ArchivedProduct, DatasetProduct,
                      OrderEvent, OrderRefund, QrPayment, PromotionRule):
            model.__table__.create(connection, checkfirst=True)
            if engine.dialect.name == 'postgresql':
                # Access is through the authenticated Python API, never public SQL.
                connection.execute(text(f'ALTER TABLE {model.__tablename__} ENABLE ROW LEVEL SECURITY'))
        definitions = [('uq_shop_product_request_id', [ProductCreation.__table__.c.request_id], True),
                       ('ix_shop_orders_created_id', [Order.__table__.c.created_at, Order.__table__.c.id], False),
                       ('ix_shop_orders_owner_created', [Order.__table__.c.user_id, Order.__table__.c.created_at], False),
                       ('ix_shop_orders_status_created', [Order.__table__.c.status, Order.__table__.c.created_at], False),
                       ('ix_shop_payment_received', [OrderPayment.__table__.c.received_at], False)]
        for name, columns, unique in definitions:
            index = next((index for index in columns[0].table.indexes if index.name == name), None)
            if index is None:
                index = Index(name, *columns, unique=unique)
            index.create(connection, checkfirst=True)
        if engine.dialect.name == 'postgresql':
            # Legacy security-definer RPCs mutate aggregate stock without updating
            # variant inventory. Current clients use Python, so retire these writes.
            # The address RPC also bypasses the Python validation and limits; no client uses it now.
            signatures = ['public.place_shop_order(jsonb,uuid,text,uuid)',
                          'public.update_inventory_product(bigint,text,bigint,integer,text,jsonb)',
                          'public.add_inventory_product(text,text,bigint,integer,text)',
                          'public.manage_customer_address(text,jsonb,uuid,boolean,bigint)']
            roles = ['PUBLIC'] + [role for role in ('anon', 'authenticated')
                                  if connection.scalar(text('SELECT 1 FROM pg_roles WHERE rolname = :role'), {'role': role})]
            for signature in signatures:
                if connection.scalar(text('SELECT to_regprocedure(:signature)'), {'signature': signature}):
                    connection.execute(text(f'REVOKE EXECUTE ON FUNCTION {signature} FROM {", ".join(roles)}'))


if __name__ == '__main__':
    engine = make_engine(Settings().database_url)
    migrate(engine)
    engine.dispose()
    print('Shop extension tables ready; existing data preserved.')
