from .inventory_layers import get_store_inventory_overview, get_product_inventory_layers, check_pos_availability
from contextlib import asynccontextmanager
import json
import logging
import time

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy import case, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .auth import User, UserCache, require_admin, require_customer
from .config import Settings
from .db import get_db, make_engine
from .errors import fail
from .models import Category, Color, Order, Product, Promotion, PromotionRule, QrPayment, WishlistItem, VariantInventory, OrderPayment, as_dict, active_products, ArchivedProduct
from .schemas import AddressMutation, ArchiveInput, OrderCreate, OrderStatus, ProductCreate, ProductUpdate, PromotionInput, WishlistInput, VariantConfigure, PaymentReceive, RefundComplete, OrderShippingUpdate
from .search import search_products
from .aftersales import add_review, create_return, decide_return, list_returns, my_aftersales, product_reviews
from .schemas import ReturnCreate, ReturnDecision, ReviewCreate
from .services import add_product, edit_product, load_book, mutate_book, place_order, change_order_status, order_dict, lock_customer, product_dict, configure_variants, receive_payment, update_order_shipping, log_event
from .services import check_promotion, complete_refund, order_events, promotion_dict, set_archived
from .payments import ensure_qr, order_for_reference, sync_payment
from .ratelimit import RateLimiter, client_ip
from .tconnect import TConnect, decrypt
from .reports import list_orders, report, real_orders
from .product_pages import product_page
from .admin_tools import mark_demo, stock_history, stock_alerts, notifications, read_notifications, export_data
from .schemas import DemoMark, ReadNotifications, UserLock
from .users import list_users, set_locked
from .sizecharts import all_charts, delete_chart, get_chart, save_chart
from .schemas import SizeChartInput
from .measurements import get_measurements, save_measurements
from .schemas import CustomerMeasurementsPayload
from .ghn import create_ghn_shipping_order
from .stylist import StylistPayload, ask_stylist
from datetime import date, timezone
from typing import Literal
from uuid import UUID

log = logging.getLogger('nb.api')
# No-op when the host already configured logging; otherwise request lines reach stderr.
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')


def create_app(settings=None, engine=None, auth_http=None, gateway=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        yield
        if auth_http is None:
            app.state.auth_http.close()
        if gateway is None and app.state.gateway is not None:
            app.state.gateway.close()
        if engine is None:
            app.state.engine.dispose()

    docs = settings.enable_docs
    app = FastAPI(title='N&B Shop API', version='1.0.0', lifespan=lifespan,
                  docs_url='/docs' if docs else None, redoc_url=None, openapi_url='/openapi.json' if docs else None)
    app.state.settings = settings
    app.state.engine = engine or make_engine(settings.database_url)
    app.state.auth_http = auth_http or httpx.Client(timeout=10, follow_redirects=False)
    app.state.user_cache = UserCache(settings.auth_cache_seconds)
    app.state.limiter = RateLimiter(settings.rate_limit_enabled)
    app.state.gateway = gateway or (TConnect(settings) if settings.tconnect_ready else None)
    limiter = app.state.limiter
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
        started = time.perf_counter()
        if request.method in ('POST', 'PATCH'):
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 4 * 1024 * 1024:
                    return JSONResponse({'code': 'NB_REQUEST_TOO_LARGE', 'message': 'NB_REQUEST_TOO_LARGE'}, status_code=413)
            request._body = bytes(body)
        response = await call_next(request)
        if request.url.path.startswith(('/api/addresses', '/api/orders', '/api/admin', '/api/wishlist', '/api/payments')):
            response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        # Path only: query strings can carry search terms with customer names or phones.
        log.info('%s %s %s %.0fms', request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
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
                       sort: Literal['featured', 'id', 'new', 'priceAsc', 'priceDesc', 'stock', 'price'] = 'featured',
                       archived: Literal['exclude', 'only'] = 'exclude', db: Session = Depends(get_db)):
        return product_page(db, page, limit, q, department, categories, colors, sizes, stock, sort, archived=archived)

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
        limiter.hit('addresses:' + user.id, 60, 60)
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
        limiter.hit('orders:' + user.id, 10, 60)
        if values.payment == 'qr' and app.state.gateway is None:
            fail('NB_PAYMENT_METHOD_UNAVAILABLE', 409)
        with db.begin():
            result = place_order(db, user, values, max_open_orders=settings.max_open_orders)
        return result

    @app.get('/api/payment-methods')
    def payment_methods():
        return {'methods': ['cod', 'qr'] if app.state.gateway else ['cod']}

    @app.post('/api/orders/{order_id}/qr')
    def order_qr(order_id: UUID, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        limiter.hit('qr:' + user.id, 30, 60)
        return ensure_qr(db, app.state.gateway, order_id, user)

    @app.post('/api/orders/{order_id}/payment-check')
    def check_payment(order_id: UUID, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        # Checkout polls every few seconds while the QR is shown.
        limiter.hit('payment-check:' + user.id, 40, 60)
        return sync_payment(db, app.state.gateway, order_id, user)

    @app.post('/api/admin/orders/{order_id}/payment-check')
    def admin_check_payment(order_id: UUID, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return sync_payment(db, app.state.gateway, order_id)

    @app.post('/api/payments/tconnect/ipn')
    async def tconnect_ipn(request: Request):
        limiter.hit('ipn:' + client_ip(request), 120, 60)
        gateway = app.state.gateway
        if gateway is None:
            fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
        try:
            payload = json.loads(decrypt((await request.json())['data'], gateway.key))
            reference = str(payload['order_id'])
        except (ValueError, KeyError, TypeError):
            fail('NB_INVALID_INPUT', 400)
        # The notification only says "check this order": the status API stays the source of truth.
        with Session(app.state.engine) as db:
            order_id = order_for_reference(db, reference)
            if order_id:
                await run_in_threadpool(sync_payment, db, gateway, order_id)
        return {'code': '00', 'message': 'received'}

    def settle_qr_before_cancel(db, order_id, values, user, admin):
        """A QR may be paid at the bank just before cancel; record that first."""
        if values.status != 'canceled':
            return
        with db.begin():
            order = db.get(Order, str(order_id))
            pending_qr = order is not None and (admin or order.user_id == user.id) and db.get(QrPayment, order.id) is not None and not db.get(OrderPayment, order.id)
        if pending_qr:
            sync_payment(db, app.state.gateway, order_id)

    @app.get('/api/orders')
    def my_orders(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), q: str = Query('', max_length=120),
                  status: Literal['pending', 'confirmed', 'shipped', 'delivered', 'canceled'] | None = None,
                  paid: Literal['received', 'unpaid'] | None = None, start: date | None = None, end: date | None = None,
                  user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return list_orders(db, user.id, page, limit, q, status, paid, start, end)

    @app.patch('/api/orders/{order_id}')
    def cancel_order(order_id: UUID, values: OrderStatus, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        settle_qr_before_cancel(db, order_id, values, user, admin=False)
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


    @app.get('/api/admin/inventory/summary')
    def inventory_summary(user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return get_store_inventory_overview(db)

    @app.get('/api/admin/inventory/layers/{product_id}')
    def product_layers(product_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        res = get_product_inventory_layers(db, product_id)
        if not res:
            fail('NB_PRODUCT_NOT_FOUND', 404)
        return res

    @app.get('/api/admin/inventory/check-availability')
    def check_availability(product_id: int, color: str = '', size: str = '', quantity: int = 1,
                           user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return check_pos_availability(db, product_id, color, size, quantity)

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
        settle_qr_before_cancel(db, order_id, values, user, admin=True)
        with db.begin():
            return change_order_status(db, order_id, values, user, admin=True)

    @app.patch('/api/admin/orders/{order_id}/shipping')
    def admin_order_shipping(order_id: UUID, values: OrderShippingUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return update_order_shipping(db, order_id, values, user)

    @app.post('/api/admin/orders/{order_id}/push-ghn')
    def admin_push_order_ghn(order_id: UUID, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        order = db.get(Order, str(order_id))
        if order is None:
            fail('NB_ORDER_NOT_FOUND', 404)
        if order.status == 'canceled':
            fail('NB_ORDER_STATUS_CONFLICT', 409)
        paid = db.get(OrderPayment, order.id)
        if order.payment == 'qr' and not paid:
            fail('NB_PAYMENT_REQUIRED', 409)

        order_data = order_dict(db, order)
        ghn_result = create_ghn_shipping_order(order_data)

        delivery = dict(order.delivery)
        delivery['carrier'] = ghn_result['carrier']
        delivery['tracking_code'] = ghn_result['tracking_code']
        order.delivery = delivery

        old_status = order.status
        if order.status in ('pending', 'confirmed'):
            order.status = 'shipped'
            log_event(db, order, 'status', user, from_status=old_status, to_status='shipped')

        log_event(db, order, 'ghn_pushed', user)
        db.commit()
        return order_dict(db, order)

    @app.patch('/api/admin/orders/{order_id}/refund')
    def refund_done(order_id: UUID, values: RefundComplete, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return complete_refund(db, order_id, user)

    @app.get('/api/admin/orders/{order_id}/events')
    def events(order_id: UUID, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return order_events(db, order_id)

    @app.post('/api/admin/products/{product_id}/archive')
    def archive(product_id: int, values: ArchiveInput, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return set_archived(db, product_id, values.archived, values.reason, user)

    @app.get('/api/admin/overview')
    def overview(include_test: bool = False, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        included = True if include_test else real_orders()
        count, pending, delivered, revenue = db.execute(select(func.count(Order.id),
            func.sum(case((Order.status == 'pending', 1), else_=0)),
            func.sum(case((Order.status == 'delivered', 1), else_=0)),
            func.sum(case((Order.status == 'delivered', Order.total), else_=0))).where(included)).one()
        received = db.scalar(select(func.sum(Order.total)).join(OrderPayment, OrderPayment.order_id == Order.id).where(included))
        products, stock_units = db.execute(select(func.count(Product.id), func.sum(Product.stock)).where(active_products())).one()
        # Same count as the stock alerts page: per variant where variants exist.
        return {'orders': count, 'pending': pending or 0, 'delivered': delivered or 0, 'revenue': revenue or 0,
                'received': received or 0, 'products': products, 'stock_units': stock_units or 0,
                'low_stock': stock_alerts(db, 1, 1)['total']}

    @app.get('/api/wishlist')
    def wishlist(user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return {'product_ids': list(db.scalars(select(WishlistItem.product_id).where(WishlistItem.user_id == user.id)))}

    @app.post('/api/wishlist')
    def save_wishlist(values: WishlistInput, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        limiter.hit('wishlist:' + user.id, 60, 60)
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
    def promotion(request: Request, code: str, db: Session = Depends(get_db)):
        # Unauthenticated lookup: throttle so codes cannot be guessed by brute force.
        limiter.hit('promotion:' + client_ip(request), 10, 60)
        row = db.get(Promotion, code) if len(code) <= 30 else None
        if not row or not row.active:
            fail('NB_PROMOTION_INVALID', 404)
        # Minimum subtotal is checked at checkout, where the bag total is known.
        check_promotion(db, row, float('inf'))
        rules = promotion_dict(db, row)
        return {'code': row.code, 'percent': row.percent, 'min_subtotal': rules['min_subtotal'], 'ends_at': rules['ends_at']}

    @app.get('/api/admin/promotions')
    def promotions(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), user: User = Depends(require_admin), db: Session = Depends(get_db)):
        total = db.scalar(select(func.count(Promotion.code)))
        return {'promotions': [promotion_dict(db, row) for row in db.scalars(select(Promotion).order_by(Promotion.code).offset((page - 1) * limit).limit(limit))],
                'total': total, 'page': page, 'limit': limit, 'pages': max(1, (total + limit - 1) // limit)}

    @app.post('/api/admin/promotions')
    def save_promotion(values: PromotionInput, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            # One admin lock also serializes first creation of a code.
            if db.bind.dialect.name == 'postgresql':
                db.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:code, 0))'), {'code': 'promotion:' + values.code})
            row = db.scalar(select(Promotion).where(Promotion.code == values.code).with_for_update())
            editable = ('code', 'percent', 'active', 'ends_at', 'max_uses', 'min_subtotal')
            current = {key: value for key, value in promotion_dict(db, row).items() if key in editable} if row else None
            if current != values.expected_rules():
                fail('NB_PROMOTION_CONFLICT', 409)
            if row is None:
                row = Promotion(code=values.code)
                db.add(row)
            row.percent, row.active = values.percent, values.active
            db.flush()
            rule = db.get(PromotionRule, values.code)
            if values.ends_at is None and values.max_uses is None and not values.min_subtotal:
                if rule:
                    db.delete(rule)
            else:
                rule = rule or PromotionRule(code=values.code)
                # SQLite drops the offset, so always store UTC.
                ends_at = values.ends_at.astimezone(timezone.utc) if values.ends_at else None
                rule.ends_at, rule.max_uses, rule.min_subtotal = ends_at, values.max_uses, values.min_subtotal
                db.add(rule)
            db.flush()
            result = promotion_dict(db, row)
        return result

    @app.get('/api/products/{product_id}/reviews')
    def reviews(product_id: int, page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
        return product_reviews(db, product_id, page, limit)

    @app.post('/api/products/{product_id}/reviews', status_code=201)
    def review(product_id: int, values: ReviewCreate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        with db.begin():
            return add_review(db, user, product_id, values)

    @app.get('/api/orders/aftersales')
    def aftersales(user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return my_aftersales(db, user)

    @app.post('/api/orders/{order_id}/returns', status_code=201)
    def request_return(order_id: UUID, values: ReturnCreate, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        with db.begin():
            return create_return(db, user, order_id, values)

    @app.get('/api/admin/returns')
    def admin_returns(status: Literal['pending', 'approved', 'rejected', 'received'] | None = None,
                      page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                      user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return list_returns(db, status, page, limit)

    @app.patch('/api/admin/returns/{return_id}')
    def decide(return_id: UUID, values: ReturnDecision, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        with db.begin():
            return decide_return(db, user, return_id, values)

    @app.get('/api/admin/users')
    def admin_users(q: str = Query('', max_length=120), page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                    user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return list_users(db, app.state.settings, app.state.auth_http, q, page, limit)

    @app.patch('/api/admin/users/{user_id}')
    def admin_lock_user(user_id: UUID, values: UserLock, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return set_locked(db, app.state.settings, app.state.auth_http, app.state.user_cache, user, str(user_id), values.locked)

    @app.get('/api/size-charts')
    def size_charts(db: Session = Depends(get_db)):
        return all_charts(db)

    @app.get('/api/products/{product_id}/size-chart')
    def product_size_chart(product_id: int, db: Session = Depends(get_db)):
        return get_chart(db, product_id)

    @app.put('/api/admin/products/{product_id}/size-chart')
    def save_size_chart(product_id: int, values: SizeChartInput, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return save_chart(db, product_id, values)

    @app.delete('/api/admin/products/{product_id}/size-chart')
    def remove_size_chart(product_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
        return delete_chart(db, product_id)

    @app.get('/api/account/measurements')
    def account_measurements(user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return get_measurements(db, user.id)

    @app.put('/api/account/measurements')
    def update_account_measurements(values: CustomerMeasurementsPayload, user: User = Depends(require_customer), db: Session = Depends(get_db)):
        return save_measurements(db, user.id, values)

    @app.post('/api/chat/stylist')
    def chat_stylist(payload: StylistPayload):
        settings: Settings = app.state.settings
        return ask_stylist(settings.gemini_api_key, payload)

    return app


app = create_app()
