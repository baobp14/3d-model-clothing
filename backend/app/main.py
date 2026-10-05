from contextlib import asynccontextmanager
import logging

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import case, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .auth import User, require_admin, require_customer
from .config import Settings
from .db import get_db, make_engine
from .errors import fail
from .models import Category, Color, Order, Product, Promotion, WishlistItem, VariantInventory, OrderPayment, as_dict, active_products, ArchivedProduct
from .schemas import AddressMutation, OrderCreate, OrderStatus, ProductCreate, ProductUpdate, PromotionInput, WishlistInput, VariantConfigure, PaymentReceive
from .search import search_products
from .services import add_product, edit_product, load_book, mutate_book, place_order, change_order_status, order_dict, lock_customer, product_dict, configure_variants, receive_payment
from .reports import list_orders, report, real_orders
from .product_pages import product_page
from .admin_tools import mark_demo, stock_history, stock_alerts, notifications, read_notifications, export_data
from .schemas import DemoMark, ReadNotifications
from datetime import date
from typing import Literal
from uuid import UUID


def create_app(settings=None, engine=None, auth_http=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        yield
        if auth_http is None:
            app.state.auth_http.close()
        if engine is None:
            app.state.engine.dispose()

    app = FastAPI(title='N&B Shop API', version='1.0.0', lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine or make_engine(settings.database_url)
    app.state.auth_http = auth_http or httpx.Client(timeout=10, follow_redirects=False)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins),
                       allow_methods=['GET', 'POST', 'PATCH'], allow_headers=['Authorization', 'Content-Type'])

    @app.exception_handler(HTTPException)
    async def api_error(_, error):
        headers = {'WWW-Authenticate': 'Bearer'} if error.status_code == 401 else None
        return JSONResponse({'code': error.detail, 'message': error.detail}, status_code=error.status_code, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        code = 'NB_INVALID_ADDRESS' if request.url.path.startswith('/api/addresses') else (
            'NB_INVALID_ORDER' if request.url.path == '/api/orders' else 'NB_INVALID_INPUT')
        fields = ['.'.join(str(part) for part in item['loc']) for item in error.errors()]
        return JSONResponse({'code': code, 'message': code, 'fields': fields}, status_code=422)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_, error):
        # Never put connection strings, SQL parameters or delivery data in API responses.
        logging.getLogger(__name__).error('Database operation failed (%s)', type(error).__name__)
        return JSONResponse({'code': 'NB_DATABASE_UNAVAILABLE', 'message': 'NB_DATABASE_UNAVAILABLE'}, status_code=503)

    @app.middleware('http')
    async def limit_body(request: Request, call_next):
        if request.method in ('POST', 'PATCH'):
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 4 * 1024 * 1024:
                    return JSONResponse({'code': 'NB_REQUEST_TOO_LARGE', 'message': 'NB_REQUEST_TOO_LARGE'}, status_code=413)
            request._body = bytes(body)
        response = await call_next(request)
        if request.url.path.startswith(('/api/addresses', '/api/orders', '/api/admin', '/api/wishlist')):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/api/health')
    def health(db: Session = Depends(get_db)):
        db.execute(text('SELECT 1'))
        return {'status': 'ok', 'database': db.bind.dialect.name, 'auth_configured': bool(settings.supabase_url and settings.supabase_anon_key)}

    def catalog_rows(db, department, query):
        statement = select(Product).where(active_products()).order_by(Product.id)
        category_statement = select(Category).order_by(Category.position, Category.id)
        if department:
            statement = statement.where(Product.department == department)
            category_statement = category_statement.where(Category.department == department)
        categories = list(db.scalars(category_statement))
        colors = list(db.scalars(select(Color).order_by(Color.id)))
        products = search_products(list(db.scalars(statement)), categories, colors, query)
        return products, categories, colors

    @app.get('/api/catalog')
    def catalog(department: str | None = Query(default=None, pattern='^(men|women|bags|watches)$'),
                q: str = Query(default='', max_length=120), db: Session = Depends(get_db)):
        products, categories, colors = catalog_rows(db, department, q)
        inventory = {row.product_id: row for row in db.scalars(select(VariantInventory))}
        return {'products': [{**as_dict(row), 'variants': inventory[row.id].variants if row.id in inventory else None, 'stock_revision': inventory[row.id].revision if row.id in inventory else None} for row in products], 'categories': [as_dict(row) for row in categories],
                'colors': [as_dict(row) for row in colors], 'total': len(products)}

    @app.get('/api/products')
    def products(q: str = Query(default='', max_length=120),
                 department: str | None = Query(default=None, pattern='^(men|women|bags|watches)$'),
                 limit: int = Query(default=24, ge=1, le=100), offset: int = Query(default=0, ge=0),
                 db: Session = Depends(get_db)):
        rows, _, _ = catalog_rows(db, department, q)
        return {'items': [product_dict(db, row) for row in rows[offset:offset + limit]], 'total': len(rows), 'limit': limit, 'offset': offset}

    @app.get('/api/product-page')
    def paged_products(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                       q: str = Query('', max_length=120), department: Literal['men', 'women', 'bags', 'watches'] | None = None,
                       categories: str = Query('', max_length=1000), colors: str = Query('', max_length=1000), sizes: str = Query('', max_length=1000),
                       stock: Literal['out', 'low', 'low_or_out', 'available'] | None = None,
                       sort: Literal['featured', 'id', 'new', 'priceAsc', 'priceDesc', 'stock', 'price'] = 'featured', db: Session = Depends(get_db)):
        return product_page(db, page, limit, q, department, categories, colors, sizes, stock, sort)

    @app.get('/api/wishlist/products')
    def wishlist_products(page: int = Query(1, ge=1), limit: int = Query(12, ge=1, le=100),
                          user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return product_page(db, page=page, limit=limit, owner=user.id)

    @app.get('/api/products/by-ids')
    def selected_products(ids: str = Query('', max_length=2000), db: Session = Depends(get_db)):
        try:
            selected = sorted({int(value) for value in ids.split(',') if value})
        except ValueError:
            fail('NB_INVALID_INPUT')
        if len(selected) > 100 or any(value < 1 or value > 9007199254740991 for value in selected):
            fail('NB_INVALID_INPUT')
        rows = list(db.scalars(select(Product).where(Product.id.in_(selected), active_products()).order_by(Product.id))) if selected else []
        inventory = {book.product_id: book for book in db.scalars(select(VariantInventory).where(VariantInventory.product_id.in_(selected)))} if selected else {}
        color_names = {c.id: {'vi': c.name_vi, 'en': c.name_en} for c in db.scalars(select(Color))} if rows else {}
        return {'products': [{**as_dict(p), 'variants': inventory[p.id].variants if p.id in inventory else None,
                              'stock_revision': inventory[p.id].revision if p.id in inventory else None,
                              'color_names': {c: color_names[c] for c in p.colors if c in color_names}} for p in rows]}

    @app.get('/api/products/{product_id}')
    def product(product_id: int, db: Session = Depends(get_db)):
        row = db.get(Product, product_id)
        if row is None:
            fail('NB_PRODUCT_NOT_FOUND', 404)
        colors = list(db.scalars(select(Color)))
        return {'product': {**product_dict(db, row), 'color_names': {c.id: {'vi': c.name_vi, 'en': c.name_en} for c in colors if c.id in row.colors}}, 'colors': [as_dict(color) for color in colors],
                'categories': [as_dict(category) for category in db.scalars(select(Category).order_by(Category.position, Category.id))]}

    @app.get('/api/addresses')
    def addresses(user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return load_book(db, user)

    @app.post('/api/addresses')
    def change_address(values: AddressMutation, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        with db.begin():
            result = mutate_book(db, user, values)
        return result

    @app.post('/api/admin/products', status_code=201)
    def create_product(values: ProductCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            result = add_product(db, values, user)
        return result

    @app.patch('/api/admin/products/{product_id}')
    def update_product(product_id: int, values: ProductUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            result = edit_product(db, product_id, values, user)
        return result

    @app.post('/api/orders')
    def create_order(values: OrderCreate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        with db.begin():
            result = place_order(db, user, values)
        return result

    @app.get('/api/orders')
    def my_orders(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), q: str = Query('', max_length=120),
                  status: Literal['pending', 'confirmed', 'shipped', 'delivered', 'canceled'] | None = None,
                  paid: Literal['received', 'unpaid'] | None = None, start: date | None = None, end: date | None = None,
                  user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return list_orders(db, user.id, page, limit, q, status, paid, start, end)

    @app.patch('/api/orders/{order_id}')
    def cancel_order(order_id: UUID, values: OrderStatus, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        with db.begin():
            return change_order_status(db, order_id, values, user)

    @app.get('/api/admin/orders')
    def all_orders(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), q: str = Query('', max_length=120),
                   scope: Literal['all', 'real', 'test'] = 'all',
                   status: Literal['pending', 'confirmed', 'shipped', 'delivered', 'canceled'] | None = None,
                   paid: Literal['received', 'unpaid'] | None = None, start: date | None = None, end: date | None = None,
                   user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return list_orders(db, None, page, limit, q, status, paid, start, end, scope=scope)

    @app.patch('/api/admin/orders/{order_id}/test')
    def set_demo(order_id: UUID, values: DemoMark, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return mark_demo(db, order_id, values, user)

    @app.get('/api/admin/products/{product_id}/history')
    def history(product_id: int, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return stock_history(db, product_id, page, limit)

    @app.get('/api/admin/stock-alerts')
    def alerts(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return stock_alerts(db, page, limit)

    @app.get('/api/admin/notifications')
    def inbox(user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return notifications(db, user)

    @app.post('/api/admin/notifications/read')
    def read_inbox(values: ReadNotifications, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return read_notifications(db, user, values.keys)

    @app.get('/api/admin/orders/export')
    def export_orders(q: str = Query('', max_length=120), scope: Literal['all', 'real', 'test'] = 'all',
                      status: Literal['pending', 'confirmed', 'shipped', 'delivered', 'canceled'] | None = None,
                      paid: Literal['received', 'unpaid'] | None = None, start: date | None = None, end: date | None = None,
                      user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return export_data(db, 'orders', dict(q=q, scope=scope, status=status, paid=paid, start=start, end=end))

    @app.get('/api/admin/inventory/export')
    def export_inventory(q: str = Query('', max_length=120), categories: str = Query('', max_length=1000),
                         stock: Literal['out', 'low', 'low_or_out', 'available'] | None = None,
                         sort: Literal['id', 'stock', 'price'] = 'id', user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return export_data(db, 'inventory', dict(q=q, categories=categories, stock=stock, sort=sort))

    @app.patch('/api/admin/orders/{order_id}/payment')
    def collect_payment(order_id: UUID, values: PaymentReceive, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return receive_payment(db, order_id, user)

    @app.patch('/api/admin/products/{product_id}/variants')
    def set_variants(product_id: int, values: VariantConfigure, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return configure_variants(db, product_id, values, user)

    @app.get('/api/admin/report')
    def chart(period: Literal['day', 'month'] = 'day', start: date | None = None, end: date | None = None,
              include_test: bool = False,
              user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return report(db, period, start, end, include_test=include_test)

    @app.patch('/api/admin/orders/{order_id}')
    def process_order(order_id: UUID, values: OrderStatus, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return change_order_status(db, order_id, values, user, admin=True)

    @app.get('/api/admin/overview')
    def overview(include_test: bool = False, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        included = True if include_test else real_orders()
        count, pending, delivered, revenue = db.execute(select(func.count(Order.id),
            func.sum(case((Order.status == 'pending', 1), else_=0)),
            func.sum(case((Order.status == 'delivered', 1), else_=0)),
            func.sum(case((Order.status == 'delivered', Order.total), else_=0))).where(included)).one()
        received = db.scalar(select(func.sum(Order.total)).join(OrderPayment, OrderPayment.order_id == Order.id).where(included))
        products, stock_units = db.execute(select(func.count(Product.id), func.sum(Product.stock)).where(active_products())).one()
        return {'orders': count, 'pending': pending or 0, 'delivered': delivered or 0, 'revenue': revenue or 0,
                'received': received or 0, 'products': products, 'stock_units': stock_units or 0,
                'low_stock': db.scalar(select(func.count(Product.id)).where(Product.stock <= 20, active_products()))}

    @app.get('/api/wishlist')
    def wishlist(user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return {'product_ids': list(db.scalars(select(WishlistItem.product_id).where(WishlistItem.user_id == user.id)))}

    @app.post('/api/wishlist')
    def save_wishlist(values: WishlistInput, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        with db.begin():
            lock_customer(db, user.id)
            if db.get(Product, values.product_id) is None or (values.saved and db.get(ArchivedProduct, values.product_id)):
                fail('NB_PRODUCT_NOT_FOUND', 404)
            item = db.get(WishlistItem, (user.id, values.product_id))
            if values.saved and item is None:
                db.add(WishlistItem(user_id=user.id, product_id=values.product_id))
            elif not values.saved and item:
                db.delete(item)
            db.flush()
            result = list(db.scalars(select(WishlistItem.product_id).where(WishlistItem.user_id == user.id)))
        return {'product_ids': result}

    @app.get('/api/promotions/{code}')
    def promotion(code: str, db: Session = Depends(get_db)):
        row = db.get(Promotion, code)
        if not row or not row.active:
            fail('NB_PROMOTION_INVALID', 404)
        return {'code': row.code, 'percent': row.percent}

    @app.get('/api/admin/promotions')
    def promotions(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), user: User = Depends(require_admin), db: Session = Depends(get_db)):
        total = db.scalar(select(func.count(Promotion.code)))
        return {'promotions': [as_dict(row) for row in db.scalars(select(Promotion).order_by(Promotion.code).offset((page - 1) * limit).limit(limit))],
                'total': total, 'page': page, 'limit': limit, 'pages': max(1, (total + limit - 1) // limit)}

    @app.post('/api/admin/promotions')
    def save_promotion(values: PromotionInput, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            # One admin lock also serializes first creation of a code.
            if db.bind.dialect.name == 'postgresql':
                db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:code, 0))'), {'code': 'promotion:' + values.code})
            row = db.scalar(select(Promotion).where(Promotion.code == values.code).with_for_update())
            if (as_dict(row) if row else None) != values.expected:
                fail('NB_PROMOTION_CONFLICT', 409)
            if row is None:
                row = Promotion(code=values.code)
                db.add(row)
            row.percent, row.active = values.percent, values.active
            db.flush()
            result = as_dict(row)
        return result

    return app


app = create_app()
