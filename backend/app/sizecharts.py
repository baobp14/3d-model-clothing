"""Per-product size charts: the brand's published measurements or the shop's own."""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .errors import fail
from .models import Product, ProductSizeChart, now

FOLDER = re.compile(r'/img/clothing/([^/]+)/')


def chart_dict(row):
    return {'product_id': row.product_id, 'source': row.source, 'brand_chart': row.brand_chart, 'kind': row.kind,
            'sizes': row.sizes, 'note': row.note, 'updated_at': row.updated_at}


def get_chart(db: Session, product_id: int):
    row = db.get(ProductSizeChart, product_id)
    return {'chart': chart_dict(row) if row else None}


def save_chart(db: Session, product_id: int, values):
    if db.get(Product, product_id) is None:
        fail('NB_PRODUCT_NOT_FOUND', 404)
    row = db.get(ProductSizeChart, product_id) or ProductSizeChart(product_id=product_id)
    row.source, row.brand_chart, row.kind, row.note = values.source, values.brand_chart if values.source == 'brand' else '', values.kind, values.note
    row.sizes = {size: measures.model_dump(exclude_none=True) for size, measures in values.sizes.items()}
    row.updated_at = now()
    db.add(row)
    db.commit()
    return {'chart': chart_dict(row)}


def delete_chart(db: Session, product_id: int):
    row = db.get(ProductSizeChart, product_id)
    if row:
        db.delete(row)
        db.commit()
    return {'chart': None}


def all_charts(db: Session):
    """Every saved chart with the dataset folders of its product, so the 3D try-on can
    look a chart up by the print it is wearing."""
    rows = db.execute(select(ProductSizeChart, Product.images).join(Product, Product.id == ProductSizeChart.product_id)).all()
    return {'charts': [{**chart_dict(chart), 'folders': sorted({m.group(1) for image in images or [] if (m := FOLDER.search(image))})}
                       for chart, images in rows]}
