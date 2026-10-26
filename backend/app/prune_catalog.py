"""Keep only the student clothing dataset (dataset_quanao.zip) in the catalog.

Products outside the dataset are deleted when nothing references them; products used by
orders are archived instead so order history and cancellations keep working. Categories
and colors left without products are removed. Run with --apply; otherwise print the plan.
"""
import argparse
import json

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import ROOT, Settings
from .db import make_engine
from .import_clothing import write_fallback
from .migrate_shop import migrate
from .models import (ArchivedProduct, Category, Color, DatasetProduct, Order, Product, ProductCreation,
                     StockMovement, VariantInventory, WishlistItem)


def ordered_product_ids(db):
    ids = set()
    for items in db.scalars(select(Order.items)):
        ids.update(line['product_id'] for line in items)
    return ids


def plan(db):
    dataset = set(db.scalars(select(DatasetProduct.product_id)))
    if not dataset:
        raise SystemExit('No dataset products found. Run `python -m app.import_clothing --apply` first.')
    others = list(db.scalars(select(Product).where(Product.id.not_in(dataset)).order_by(Product.id)))
    ordered = ordered_product_ids(db)
    return dataset, [p for p in others if p.id in ordered], [p for p in others if p.id not in ordered]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    engine = make_engine(Settings().database_url)
    migrate(engine)
    with Session(engine) as db, db.begin():
        dataset, archive, remove = plan(db)
        print(f'Keep {len(dataset)} dataset products; archive {len(archive)} used by orders; delete {len(remove)}.')
        if not args.apply:
            print('Dry run. Add --apply to change the database.')
            return
        for product in archive:
            if db.get(ArchivedProduct, product.id) is None:
                db.add(ArchivedProduct(product_id=product.id, reason='catalog: dataset_quanao only'))
        ids = [p.id for p in remove]
        for model in (WishlistItem, StockMovement, VariantInventory, ProductCreation, ArchivedProduct):
            db.execute(delete(model).where(model.product_id.in_(ids)))
        db.execute(delete(Product).where(Product.id.in_(ids)))
        db.flush()
        used_categories = set(db.scalars(select(Product.category).distinct()))
        removed_categories = db.execute(delete(Category).where(Category.id.not_in(used_categories))).rowcount
        used_colors = {color for colors in db.scalars(select(Product.colors)) for color in colors or []}
        removed_colors = db.execute(delete(Color).where(Color.id.not_in(used_colors))).rowcount
        db.flush()
        print(f'Removed {removed_categories} empty categories and {removed_colors} unused colors.')
        # The static fallback must match, or a fresh SQLite init would bring the old catalog back.
        write_fallback(db, ROOT.parent / 'frontend/src/data/products.js')
        print('Active products:', db.scalar(select(func.count()).select_from(Product).where(Product.id.not_in(select(ArchivedProduct.product_id)))))
    engine.dispose()


if __name__ == '__main__':
    main()
