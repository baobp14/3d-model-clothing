"""Product reviews and return requests for delivered orders."""
from sqlalchemy import func, select

from .errors import fail
from .models import Order, OrderPayment, OrderRefund, Product, ReturnRequest, Review, as_dict, now
from .services import lock_customer, log_event, order_dict, restock_order


def _own_delivered_order(db, user, order_id):
    order = db.get(Order, str(order_id))
    if order is None or order.user_id != user.id:
        fail('NB_ORDER_NOT_FOUND', 404)
    if order.status != 'delivered':
        fail('NB_ORDER_NOT_DELIVERED', 409)
    return order


def _author(order):
    """Show only the given name (last word of a Vietnamese full name)."""
    name = (order.delivery or {}).get('name', '').split()
    return name[-1] if name else ''


def product_reviews(db, product_id, page=1, limit=10):
    if db.get(Product, product_id) is None:
        fail('NB_PRODUCT_NOT_FOUND', 404)
    count, average = db.execute(select(func.count(Review.id), func.avg(Review.rating))
                                .where(Review.product_id == product_id)).one()
    rows = db.scalars(select(Review).where(Review.product_id == product_id)
                      .order_by(Review.created_at.desc(), Review.id.desc())
                      .offset((page - 1) * limit).limit(limit))
    reviews = [{'id': r.id, 'rating': r.rating, 'comment': r.comment, 'author': r.author, 'created_at': r.created_at}
               for r in rows]
    return {'reviews': reviews, 'count': count, 'average': round(float(average), 1) if average else None,
            'page': page, 'pages': max(1, (count + limit - 1) // limit)}


def add_review(db, user, product_id, values):
    lock_customer(db, user.id)
    order = _own_delivered_order(db, user, values.order_id)
    if not any(line['product_id'] == product_id for line in order.items):
        fail('NB_REVIEW_NOT_PURCHASED', 409)
    if db.scalar(select(Review).where(Review.order_id == order.id, Review.product_id == product_id)):
        fail('NB_REVIEW_EXISTS', 409)
    review = Review(product_id=product_id, order_id=order.id, user_id=user.id, rating=values.rating,
                    comment=values.comment, author=_author(order))
    db.add(review)
    db.flush()
    return {'id': review.id, 'rating': review.rating, 'comment': review.comment, 'author': review.author,
            'created_at': review.created_at}


def my_aftersales(db, user):
    """What the order history needs to show review/return buttons."""
    reviewed = db.execute(select(Review.order_id, Review.product_id).where(Review.user_id == user.id)).all()
    returns = db.scalars(select(ReturnRequest).where(ReturnRequest.user_id == user.id))
    return {'reviewed': [{'order_id': o, 'product_id': p} for o, p in reviewed],
            'returns': {r.order_id: {'id': r.id, 'status': r.status, 'restocked': r.restocked, 'admin_note': r.admin_note}
                        for r in returns}}


def create_return(db, user, order_id, values):
    lock_customer(db, user.id)
    order = _own_delivered_order(db, user, order_id)
    if db.scalar(select(ReturnRequest).where(ReturnRequest.order_id == order.id)):
        fail('NB_RETURN_EXISTS', 409)
    request = ReturnRequest(order_id=order.id, user_id=user.id, reason=values.reason)
    db.add(request)
    db.flush()
    log_event(db, order, 'return_requested', user)
    return as_dict(request)


def list_returns(db, status=None, page=1, limit=20):
    query = select(ReturnRequest)
    counter = select(func.count()).select_from(ReturnRequest)
    if status:
        query, counter = query.where(ReturnRequest.status == status), counter.where(ReturnRequest.status == status)
    total = db.scalar(counter)
    rows = list(db.scalars(query.order_by(ReturnRequest.created_at.desc(), ReturnRequest.id.desc())
                           .offset((page - 1) * limit).limit(limit)))
    orders = {o.id: o for o in db.scalars(select(Order).where(Order.id.in_([r.order_id for r in rows])))} if rows else {}
    items = [{**as_dict(r), 'order': order_dict(db, orders[r.order_id])} for r in rows]
    return {'returns': items, 'total': total, 'page': page, 'pages': max(1, (total + limit - 1) // limit)}


def decide_return(db, user, return_id, values):
    request = db.get(ReturnRequest, str(return_id))
    if request is None:
        fail('NB_RETURN_NOT_FOUND', 404)
    order = db.get(Order, request.order_id)
    lock_customer(db, order.user_id)
    request = db.scalar(select(ReturnRequest).where(ReturnRequest.id == str(return_id))
                        .with_for_update().execution_options(populate_existing=True))
    if request.status != values.expected_status:
        fail('NB_RETURN_STATUS_CONFLICT', 409)
    target = {'approve': 'approved', 'reject': 'rejected', 'receive': 'received'}[values.action]
    allowed = {'pending': {'approved', 'rejected'}, 'approved': {'received'}}
    if target not in allowed.get(request.status, set()):
        fail('NB_RETURN_STATUS_INVALID', 409)
    if target == 'received':
        if values.restock:
            # Only goods the shop inspected and can sell again go back into stock.
            restock_order(db, order, user, 'return')
            request.restocked = True
        if db.get(OrderPayment, order.id) and not db.get(OrderRefund, order.id):
            db.add(OrderRefund(order_id=order.id, amount=order.total, created_by=user.id))
            log_event(db, order, 'refund_required', user)
    log_event(db, order, 'return_' + target, user)
    request.status = target
    if values.note:
        request.admin_note = values.note
    request.updated_at = now()
    db.flush()
    return as_dict(request)
