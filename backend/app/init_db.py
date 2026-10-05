"""Initialize only the local SQLite database; never seed/overwrite Supabase."""
import json
import subprocess

from sqlalchemy.orm import Session

from .config import ROOT, Settings
from .db import make_engine
from .models import Base, Category, Color, Product, VariantInventory, DatasetProduct


def main():
    engine = make_engine(Settings().database_url)
    if engine.dialect.name != 'sqlite':
        raise SystemExit('Only SQLite is initialized here. For PostgreSQL follow README.md migrations.')
    script = "import {products,categories,colors} from './src/data/products.js'; process.stdout.write(JSON.stringify({products,categories,colors}));"
    catalog = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=ROOT.parent / 'frontend'))
    Base.metadata.create_all(engine)
    with Session(engine) as db, db.begin():
        for row in catalog['categories']:
            if db.get(Category, row['id']) is None:
                db.add(Category(id=row['id'], name_vi=row['vi'], name_en=row['en'], department=row['department']))
        for row in catalog['colors']:
            if db.get(Color, row['id']) is None:
                db.add(Color(id=row['id'], name_vi=row['vi'], name_en=row['en'], hex=row['hex']))
        db.flush()
        added = 0
        for row in catalog['products']:
            if db.get(Product, row['id']) is not None:
                continue
            db.add(Product(id=row['id'], name_vi=row['vi'], name_en=row['en'], department=row['department'],
                           category=row['category'], price=row['price'], stock=row.get('stock', 500), colors=row['colors'], sizes=row['sizes'],
                           images=row['images'], is_new=row['isNew'], description=row.get('description', ''),
                           description_en=row.get('descriptionEn', '')))
            db.flush()
            if row.get('variants'):
                db.add(VariantInventory(product_id=row['id'], revision=row.get('stockRevision', 0), variants=row['variants']))
            if row.get('datasetKey'):
                db.add(DatasetProduct(product_id=row['id'], dataset_key=row['datasetKey'], color_images=row.get('colorImages', {})))
            added += 1
    print(f'SQLite ready; added {added} products (existing data preserved).')
    engine.dispose()


if __name__ == '__main__':
    main()
