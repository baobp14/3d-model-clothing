"""QR payment flow: create a TConnect QR for an order and confirm payment with the gateway.

Gateway calls never run inside a database transaction: SQLite takes a write lock at BEGIN
and PostgreSQL would hold row locks for the whole network round trip.
"""
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from .errors import fail
from .models import Order, OrderPayment, QrPayment
from .services import order_dict, receive_payment


def reference_for(order_id):
    # TConnect order_id: at most 30 characters. Deterministic, so retries reuse the same reference.
    return 'NB' + order_id.replace('-', '')[:20].upper()


def load_order(db, order_id, user=None):
    order = db.get(Order, str(order_id))
    if order is None or (user is not None and order.user_id != user.id):
        fail('NB_ORDER_NOT_FOUND', 404)
    return order


def qr_dict(db, order, qr):
    return {'order': order_dict(db, order), 'qr': {'reference': qr.reference, 'amount': qr.amount,
            'qr_content': qr.qr_content, 'image_png_base64': qr.image_png_base64} if qr else None}


def ensure_qr(db, gateway, order_id, user):
    with db.begin():
        order = load_order(db, order_id, user)
        if order.payment != 'qr':
            fail('NB_PAYMENT_METHOD_INVALID', 409)
        qr = db.get(QrPayment, order.id)
        if qr or order.status != 'pending' or db.get(OrderPayment, order.id):
            return qr_dict(db, order, qr)
        reference, amount = reference_for(order.id), order.total
    if gateway is None:
        fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
    qr_content, image = gateway.create_qr(reference, amount, str(uuid4()))
    try:
        with db.begin():
            db.add(QrPayment(order_id=str(order_id), reference=reference, amount=amount, qr_content=qr_content, image_png_base64=image))
    except IntegrityError:
        # A concurrent request stored the QR first; both used the same reference.
        db.rollback()
    with db.begin():
        order = load_order(db, order_id)
        return qr_dict(db, order, db.get(QrPayment, order.id))


def sync_payment(db, gateway, order_id, user=None):
    """Ask the gateway whether the QR was paid; record the payment if it was."""
    with db.begin():
        order = load_order(db, order_id, user)
        qr = db.get(QrPayment, order.id)
        if qr is None or db.get(OrderPayment, order.id):
            return qr_dict(db, order, qr)
        reference, amount = qr.reference, qr.amount
    if gateway is None:
        fail('NB_PAYMENT_GATEWAY_UNAVAILABLE', 503)
    paid, bank_reference = gateway.paid_amount(reference)
    with db.begin():
        if paid >= amount:
            receive_payment(db, order_id, gateway_reference=bank_reference or reference)
        order = load_order(db, order_id)
        return qr_dict(db, order, db.get(QrPayment, order.id))


def order_for_reference(db, reference):
    with db.begin():
        qr = db.query(QrPayment).filter(QrPayment.reference == reference).one_or_none()
        return qr.order_id if qr else None
