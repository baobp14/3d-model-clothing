"""Bounded product queries; filters and sorting happen before SQL pagination."""
import unicodedata

from sqlalchemy import Text, case, exists, func, literal, or_, select

from .models import ArchivedProduct, Category, Color, Product, VariantInventory, WishlistItem, as_dict, active_products
from .search import normalize

TRANSLATE_CHARACTERS = ''.join(chr(i) for i in range(0x00c0, 0x2000)
                              if len(normalize(chr(i))) == 1 and normalize(chr(i)) != chr(i)
                              and unicodedata.category(chr(i)).startswith('L'))
TRANSLATE_REPLACEMENTS = ''.join(normalize(c) for c in TRANSLATE_CHARACTERS)


def normalized(db, expression):
    if db.bind.dialect.name == 'sqlite':
        return func.nb_normalize(expression)
    return func.translate(func.lower(expression), TRANSLATE_CHARACTERS, TRANSLATE_REPLACEMENTS)


def has_option(db, column, option):
    if db.bind.dialect.name == 'postgresql':
        return literal(option) == func.any(column)
    values = func.json_each(column).table_valued('key', 'value').alias()
    return exists(select(1).select_from(values).where(values.c.value == option))


def product_page(db, page=1, limit=20, q='', department=None, categories='', colors='', sizes='',
                 stock=None, sort='featured', owner=None, archived='exclude'):
    category_rows = list(db.scalars(select(Category).order_by(Category.position, Category.id)))
    color_rows = list(db.scalars(select(Color).order_by(Color.id)))
    # Archived products are hidden from the shop; the admin can list them to restore one.
    visible = Product.id.in_(select(ArchivedProduct.product_id)) if archived == 'only' else active_products()
    statement = select(Product).join(Category, Category.id == Product.category).where(visible)
    if owner:
        statement = statement.join(WishlistItem, WishlistItem.product_id == Product.id).where(WishlistItem.user_id == owner)
    if department:
        statement = statement.where(Product.department == department)
    for raw, column in ((categories, Product.category),):
        selected = [value for value in raw.split(',') if value]
        if selected:
            statement = statement.where(column.in_(selected))
    for raw, column in ((colors, Product.colors), (sizes, Product.sizes)):
        selected = [value for value in raw.split(',') if value]
        if selected:
            statement = statement.where(or_(*(has_option(db, column, value) for value in selected)))
    if stock:
        statement = statement.where(Product.stock == 0 if stock == 'out' else
                                    (Product.stock.between(1, 20) if stock == 'low' else Product.stock <= 20 if stock == 'low_or_out' else Product.stock > 20))
    department_names = case((Product.department == 'men', 'nam men'), (Product.department == 'women', 'nu women'),
                            (Product.department == 'bags', 'tui phu kien bags accessories'), else_='dong ho watches')
    haystack = normalized(db, Product.id.cast(Text) + literal(' ') + Product.name_vi + literal(' ') + Product.name_en
                          + literal(' ') + Category.name_vi + literal(' ') + Category.name_en + literal(' ') + department_names)
    for token in normalize(q).split():
        matching_colors = [c.id for c in color_rows if token in normalize(f'{c.id} {c.name_vi} {c.name_en}')]
        statement = statement.where(or_(haystack.contains(token, autoescape=True),
                                        *(has_option(db, Product.colors, value) for value in matching_colors)))
    # Aggregate only columns from the filtered subquery, never load the full catalog.
    filtered = statement.subquery()
    total, stock_units = db.execute(select(func.count(), func.coalesce(func.sum(filtered.c.stock), 0)).select_from(filtered)).one()
    sort_columns = {'featured': [Product.id], 'id': [Product.id], 'new': [Product.created_at.desc(), Product.id.desc()],
                    'priceAsc': [Product.price, Product.id], 'priceDesc': [Product.price.desc(), Product.id],
                    'stock': [Product.stock, Product.id], 'price': [Product.price, Product.id]}
    rows = list(db.scalars(statement.order_by(*sort_columns[sort]).offset((page - 1) * limit).limit(limit)))
    inventory = {book.product_id: book for book in db.scalars(select(VariantInventory).where(VariantInventory.product_id.in_([p.id for p in rows])))} if rows else {}
    # Metadata is small; DISTINCT options are produced by SQL without loading products.
    if db.bind.dialect.name == 'postgresql':
        size_query = select(func.unnest(Product.sizes).label('size')).where(active_products()).distinct()
        if department:
            size_query = size_query.where(Product.department == department)
        available_sizes = list(db.scalars(size_query))
    else:
        options = func.json_each(Product.sizes).table_valued('key', 'value').alias()
        size_query = select(options.c.value).select_from(Product).join(options, literal(True)).where(active_products()).distinct()
        if department:
            size_query = size_query.where(Product.department == department)
        available_sizes = list(db.scalars(size_query))
    # Storefront filters list only colors that active products in this department use;
    # `colors` stays the full palette for existing consumers.
    if db.bind.dialect.name == 'postgresql':
        color_query = select(func.unnest(Product.colors).label('color')).where(active_products()).distinct()
    else:
        color_options = func.json_each(Product.colors).table_valued('key', 'value').alias()
        color_query = select(color_options.c.value).select_from(Product).join(color_options, literal(True)).where(active_products()).distinct()
    if department:
        color_query = color_query.where(Product.department == department)
    used_colors = set(db.scalars(color_query))
    return {'products': [{**as_dict(p), 'variants': inventory[p.id].variants if p.id in inventory else None,
                          'stock_revision': inventory[p.id].revision if p.id in inventory else None} for p in rows],
            'total': total, 'stock_units': stock_units, 'page': page, 'limit': limit, 'pages': max(1, (total + limit - 1) // limit),
            'categories': [as_dict(c) for c in category_rows if not department or c.department == department],
            'colors': [as_dict(c) for c in color_rows], 'color_options': sorted(used_colors), 'sizes': sorted(available_sizes)}
