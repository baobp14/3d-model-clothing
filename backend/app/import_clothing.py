"""Import the student clothing dataset, retaining previous products for order history.

Run with --apply to change the database; otherwise print the import plan.
Repeated imports preserve IDs, edited prices, stock and completed sales.
"""
import argparse
import hashlib
import json
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from types import SimpleNamespace

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from .config import ROOT, Settings
from .db import make_engine
from .migrate_shop import migrate
from .models import ArchivedProduct, Category, Color, DatasetProduct, Product, StockMovement, VariantInventory, active_products, as_dict
from .services import record_stock, color_gallery

SIZES = ['S', 'M', 'XL']
REPLACED = {'m-tshirts', 'm-shirts', 'm-trousers', 'w-skirts', 'w-tshirts', 'w-trousers'}
# Categories the dataset needs; created on import when missing.
CATEGORY_NAMES = {
    'w-tshirts': ('Áo thun nữ', "Women's T-shirts", 'women'),
    'w-trousers': ('Quần nữ', "Women's trousers & shorts", 'women'),
}
STYLE_NAMES = {
    '5027': ('Áo thun túi ngực Classic', 'Classic Pocket T-shirt', 'm-tshirts'),
    '5028': ('Áo thun sọc Staple', 'Staple Stripe T-shirt', 'm-tshirts'),
    '5051': ('Áo thun Basic', 'Basic T-shirt', 'm-tshirts'),
    '5052': ('Áo thun phom rộng Block', 'Block Oversized T-shirt', 'm-tshirts'),
    '5401': ('Áo sơ mi Oxford', 'Oxford Shirt', 'm-shirts'),
    '5417': ('Áo sơ mi kẻ Check', 'Check Shirt', 'm-shirts'),
    '5419': ('Áo sơ mi nhung Cord', 'Cord Shirt', 'm-shirts'),
    '5421': ('Áo sơ mi ngắn tay Work', 'Work Short-sleeve Shirt', 'm-shirts'),
    '5422': ('Áo sơ mi Work', 'Work Shirt', 'm-shirts'),
    '5903': ('Quần short Beach', 'Beach Shorts', 'm-trousers'),
    '5932': ('Quần dài Relax', 'Relax Track Pants', 'm-trousers'),
    '4001': ('Áo thun nữ Maple', "Women's Maple T-shirt", 'w-tshirts'),
    '4051': ('Áo thun nữ Basic', "Women's Basic T-shirt", 'w-tshirts'),
    '4030': ('Áo thun nữ form hộp Box', "Women's Box T-shirt", 'w-tshirts'),
    '4080': ('Áo thun nữ Heavy dáng rộng', "Women's Heavy T-shirt", 'w-tshirts'),
    '4932': ('Quần nỉ nữ Relax', "Women's Relax Track Pants", 'w-trousers'),
    '4933': ('Quần short nỉ nữ Relax', "Women's Relax Track Shorts", 'w-trousers'),
}
# Dataset color labels remain distinct; no approximate mapping to old stock colors.
COLOR_NAMES = {
    'black': ('Đen', '#171717'), 'white': ('Trắng', '#f2f0ec'),
    'navy': ('Xanh navy', '#1f2a44'), 'grey': ('Xám', '#8f8f8f'),
    'brown': ('Nâu', '#6b4b32'), 'cream': ('Kem', '#eee5d0'),
    'bone': ('Trắng ngà', '#ded8c9'), 'ecru': ('Màu mộc', '#e4dbc6'),
    'petrol_blue': ('Xanh dầu', '#285663'), 'black_white': ('Đen / trắng', '#555555'),
    'natural_mid_blue': ('Mộc / xanh', '#8596a4'), 'white_red': ('Trắng / đỏ', '#c86c70'),
    'butter': ('Vàng bơ', '#eee0a7'), 'granite': ('Xám đá', '#686963'),
    'grey_marle': ('Xám melange', '#9a9a96'), 'lemonade': ('Vàng chanh nhạt', '#f0e99b'),
    'mineral': ('Xanh khoáng', '#adc0b6'), 'orchid': ('Tím lan', '#c1a7cb'),
    'seafoam': ('Xanh bọt biển', '#b5d4c7'), 'watermelon': ('Hồng dưa hấu', '#dc808b'),
    'light_blue': ('Xanh nhạt', '#adc4de'), 'army_black': ('Xanh quân đội / đen', '#535c42'),
    'coal_black': ('Xám than / đen', '#404040'), 'carolina_blue': ('Xanh Carolina', '#83b8de'),
    'clay': ('Đất nung', '#b28167'), 'atlantic': ('Xanh Atlantic', '#48707a'),
    'cypress': ('Xanh bách', '#435e4d'), 'ink_blue': ('Xanh mực', '#2b364e'),
    'storm': ('Xám bão', '#7b8589'), 'soft_brown': ('Nâu nhạt', '#a88976'),
    'warm_trench': ('Be ấm', '#b9a383'), 'dark_indigo': ('Chàm đậm', '#273850'),
    'deep_atlantic': ('Xanh Atlantic đậm', '#284454'), 'chambray': ('Xanh chambray', '#88a0b3'),
    'sand': ('Cát', '#cdbd9d'), 'original': ('Màu gốc', '#777777'),
    'sage': ('Xanh sage', '#63806c'), 'pale_pink': ('Hồng phấn', '#e8bdb4'),
    'tan': ('Nâu tan', '#c9a980'), 'hazy_pink': ('Hồng khói', '#a58177'),
}


def read_dataset(archive):
    """Validate local archive and group colors by garment style, not by image count."""
    with zipfile.ZipFile(archive) as z:
        names = set(z.namelist())
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name:
                raise ValueError('Unsafe ZIP path')
        grouped = defaultdict(list)
        for name in sorted(names):
            if not name.endswith('/source.json'):
                continue
            row = json.loads(z.read(name))
            folder = row['folder']
            if name != f'dataset/{folder}/source.json':
                raise ValueError('Invalid product folder')
            if folder.startswith('ascolour_'):
                code = folder.split('_')[1]
                key = f'ascolour_{code}'
                vi, en, category = STYLE_NAMES[code]
                color = folder.removeprefix(key + '_')
                # Remove the garment style prefix to isolate the exact fabric color.
                prefixes = {'5027': 'classic_pocket_tee_', '5028': 'staple_stripe_tee_', '5051': 'basic_tee_', '5052': 'block_oversized_tee_', '5401': 'oxford_shirt_', '5417': 'check_shirt_', '5419': 'cord_shirt_', '5421': 'work_ss_shirt_', '5422': 'work_shirt_', '5903': 'beach_shorts_', '5932': 'relax_track_pants_',
                            '4001': 'wos_maple_tee_', '4051': 'wos_basic_tee_', '4030': 'wos_box_tee_', '4080': 'wos_heavy_tee_',
                            '4932': 'wos_relax_track_pants_', '4933': 'wos_relax_track_shorts_'}
                color = color.removeprefix(prefixes[code])
                vi, en = vi + ' AS Colour', en + ' AS Colour'
            elif folder.startswith('everlane_'):
                patterns = {
                    'cargo_mini_skirt': ('Chân váy ngắn Cargo', 'Cargo Mini Skirt'),
                    'circle_mini_skirt': ('Chân váy ngắn Circle', 'Circle Mini Skirt'),
                    'denim_mini_skirt': ('Chân váy ngắn denim', 'Denim Mini Skirt'),
                    'lace_knit_skirt': ('Chân váy dệt ren', 'Lace Knit Skirt'),
                    'mini_skirt_stretch_linen': ('Chân váy ngắn linen', 'Stretch Linen Mini Skirt'),
                    'pull_on_maxi_skirt_cotton_silk': ('Chân váy dài cotton lụa', 'Cotton Silk Maxi Skirt'),
                }
                style = next(k for k in patterns if folder.startswith('everlane_' + k + '_'))
                key = 'everlane_' + style
                vi, en = patterns[style]
                vi, en, category = vi + ' Everlane', en + ' Everlane', 'w-skirts'
                color = folder.removeprefix(key + '_')
            else:
                slug = row['source'].rstrip('/').split('/')[-1]
                key = 'jtd_' + slug if folder.startswith('jtd_') else 'alyxen_' + slug
                en = row.get('title') or slug.replace('-', ' ').title()
                vi = 'Áo thun in hình ' + en.split(' - ')[0].removesuffix('Heavy Graphic T Shirt').removesuffix('Graphic T Shirt').strip()
                category = 'm-tshirts'
                color = next((c for c in ('black', 'white', 'grey', 'brown', 'sand', 'cream') if folder.endswith('_' + c)), 'original')
            if color not in COLOR_NAMES:
                raise ValueError(f'Unknown dataset color: {color}')
            images = []
            for side in ('front', 'back'):
                candidates = sorted(n for n in names if n.startswith(f'dataset/{folder}/{side}.'))
                if len(candidates) != 1:
                    raise ValueError(f'Missing/ambiguous {side} image: {folder}')
                images.extend(candidates)
            images.extend(sorted(n for n in names if n.startswith(f'dataset/{folder}/extra_') and n.lower().endswith(('.jpg', '.webp', '.png'))))
            # Style photos can depict another color; show only the selected color's own photos.
            grouped[key].append({'folder': folder, 'color': color, 'images': ['/img/clothing/' + n.removeprefix('dataset/') for n in images], 'vi': vi, 'en': en, 'category': category, 'source': row['source']})
        if not grouped:
            raise ValueError('ZIP contains no clothing products')
        for rows in grouped.values():
            if len({r['color'] for r in rows}) != len(rows):
                raise ValueError('Duplicate color in garment style')
        return dict(sorted(grouped.items()))


# Retail price bands (VND) for the dataset garments: base + step * (n % count).
# Keep in sync with migrations/002_realistic_clothing_prices.sql.
PRICE_BANDS = {
    'm-tshirts': (199_000, 30_000, 6),
    'm-shirts': (349_000, 30_000, 6),
    'm-trousers': (249_000, 50_000, 5),
    'w-skirts': (299_000, 30_000, 6),
    'w-tshirts': (219_000, 30_000, 4),
    'w-trousers': (279_000, 40_000, 3),
}


def retail_price(category, n):
    base, step, count = PRICE_BANDS[category]
    return base + step * (n % count)


def build_products(groups, existing):
    rows = []
    for index, (key, choices) in enumerate(groups.items()):
        category = choices[0]['category']
        if category not in PRICE_BANDS:
            raise ValueError(f'No price band for {category}')
        stock = 1556 if index % 2 == 0 else 1342
        options = [(choice['color'], size) for choice in choices for size in SIZES]
        base, remainder = divmod(stock, len(options))
        variants = [{'color': color, 'size': size, 'stock': base + (i < remainder)} for i, (color, size) in enumerate(options)]
        rows.append({'key': key, 'category': category, 'department': 'women' if category.startswith('w-') else 'men',
                     'name_vi': choices[0]['vi'], 'name_en': choices[0]['en'],
                     'price': retail_price(category, index), 'stock': stock,
                     'colors': [r['color'] for r in choices], 'sizes': SIZES[:],
                     'images': [r['images'][0] for r in choices],
                     'color_images': {r['color']: r['images'] for r in choices}, 'variants': variants,
                     'description': f"{choices[0]['vi']}. Có ảnh mặt trước, mặt sau và các màu trong bộ sưu tập. Kích cỡ S, M, XL. Chọn màu và kích cỡ để xem tồn kho.",
                     'description_en': f"{choices[0]['en']}. Front and back photos are available for each color. Sizes S, M and XL. Select a color and size to check stock."})
    return rows


def apply_catalog(db, rows):
    """One atomic transaction, no edits/deletes to historical order products."""
    if db.bind.dialect.name == 'postgresql':
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended('clothing-dataset-import', 0))"))
    # Serialize with ordinary product edits / order placement.
    existing = list(db.scalars(select(Product).order_by(Product.id).with_for_update()))
    mappings = {row.dataset_key: row for row in db.scalars(select(DatasetProduct))}
    next_id = max(3000, max((p.id for p in existing), default=0) + 1)
    imported_ids, added = set(), 0
    for category, (vi, en, department) in CATEGORY_NAMES.items():
        if db.get(Category, category) is None:
            db.add(Category(id=category, name_vi=vi, name_en=en, department=department))
    db.flush()
    for row in rows:
        if row['key'] in mappings:
            imported_ids.add(mappings[row['key']].product_id)
            continue
        for color in row['colors']:
            if db.get(Color, color) is None:
                vi, hex_value = COLOR_NAMES[color]
                db.add(Color(id=color, name_vi=vi, name_en='Original color' if color == 'original' else color.replace('_', ' ').title(), hex=hex_value))
                db.flush()
        product = Product(id=next_id, **{k: row[k] for k in ('category', 'department', 'name_vi', 'name_en', 'price', 'stock', 'colors', 'sizes', 'images', 'description', 'description_en')}, is_new=True)
        db.add(product); db.flush()
        db.add(VariantInventory(product_id=product.id, revision=0, variants=row['variants']))
        db.add(DatasetProduct(product_id=product.id, dataset_key=row['key'], color_images=row['color_images']))
        db.flush()
        record_stock(db, product, (0, []), SimpleNamespace(id='00000000-0000-0000-0000-000000000000'), 'create', 'Import dataset_quanao.zip; demo inventory')
        imported_ids.add(product.id); next_id += 1; added += 1
    archived = 0
    for product in existing:
        if product.category in REPLACED and product.id not in imported_ids and db.get(DatasetProduct, product.id) is None and db.get(ArchivedProduct, product.id) is None:
            db.add(ArchivedProduct(product_id=product.id, reason='Replaced by dataset_quanao.zip'))
            archived += 1
    db.flush()
    if db.bind.dialect.name == 'postgresql':
        sequence = db.scalar(text("SELECT pg_get_serial_sequence('products', 'id')"))
        if sequence:
            db.execute(text('SELECT setval(CAST(:sequence AS regclass), (SELECT MAX(id) FROM products), true)'), {'sequence': sequence})
    return {'added': added, 'archived': archived, 'dataset_products': len(imported_ids)}


def extract_images(archive, target):
    target = target.resolve()
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            if not info.filename.startswith('dataset/') or not info.filename.lower().endswith(('.jpg', '.webp', '.png')) or '/ai_' in info.filename:
                continue
            destination = (target / info.filename.removeprefix('dataset/')).resolve()
            if not destination.is_relative_to(target):
                raise ValueError('Unsafe extraction destination')
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(z.read(info))


def write_fallback(db, destination):
    products = list(db.scalars(select(Product).where(active_products()).order_by(Product.id)))
    inventory = {r.product_id: r for r in db.scalars(select(VariantInventory))}
    datasets = {r.product_id: r for r in db.scalars(select(DatasetProduct))}
    rows = []
    for p in products:
        row = {'id': p.id, 'department': p.department, 'category': p.category, 'vi': p.name_vi, 'en': p.name_en, 'price': p.price, 'stock': p.stock, 'colors': p.colors, 'sizes': p.sizes, 'images': p.images, 'isNew': p.is_new, 'description': p.description, 'descriptionEn': p.description_en, 'createdAt': p.created_at.isoformat()}
        if p.id in inventory:
            row.update(variants=inventory[p.id].variants, stockRevision=inventory[p.id].revision)
        if p.id in datasets:
            row.update(datasetKey=datasets[p.id].dataset_key, colorImages=color_gallery(p, datasets[p.id]))
        rows.append(row)
    encode = lambda value: json.dumps(value, ensure_ascii=False, indent=2)
    categories = [{'id': r.id, 'department': r.department, 'vi': r.name_vi, 'en': r.name_en} for r in db.scalars(select(Category).order_by(Category.position, Category.id))]
    colors = [{'id': r.id, 'vi': r.name_vi, 'en': r.name_en, 'hex': r.hex} for r in db.scalars(select(Color).order_by(Color.id))]
    destination.write_text('// Generated from the active catalog; import_clothing preserves historical orders.\n'
                           + 'export const categories = ' + encode(categories) + '\n\nexport const colors = ' + encode(colors)
                           + '\n\nexport const products = ' + encode(rows) + "\n\nexport const formatPrice = value => `₫ ${value.toLocaleString('vi-VN')}`\n", encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', type=Path, default=ROOT.parent / 'dataset_quanao.zip')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    groups = read_dataset(args.zip)
    engine = make_engine(Settings().database_url)
    with Session(engine) as db:
        existing = list(db.scalars(select(Product).order_by(Product.id)))
        rows = build_products(groups, existing)
    print(json.dumps({'styles': len(rows), 'color_samples': sum(len(r) for r in groups.values()), 'categories': sorted(REPLACED), 'sizes': SIZES, 'demo_totals': [1342, 1556]}))
    if not args.apply:
        engine.dispose(); return
    migrate(engine)
    backup = ROOT / '.dataset-backups' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup.mkdir(parents=True)
    with Session(engine) as db:
        snapshot = {model.__tablename__: [as_dict(r) for r in db.scalars(select(model))] for model in (Product, Category, Color, VariantInventory, ArchivedProduct, DatasetProduct, StockMovement)}
        (backup / 'catalog.json').write_text(json.dumps(snapshot, ensure_ascii=False, default=str), encoding='utf-8')
    fallback = ROOT.parent / 'frontend/src/data/products.js'
    (backup / 'products.js').write_bytes(fallback.read_bytes())
    extract_images(args.zip, ROOT.parent / 'frontend/public/img/clothing')
    with Session(engine) as db, db.begin():
        result = apply_catalog(db, rows)
    with Session(engine) as db:
        write_fallback(db, fallback)
    (backup / 'import.json').write_text(json.dumps({'zip_sha256': hashlib.sha256(args.zip.read_bytes()).hexdigest(), **result}), encoding='utf-8')
    print(json.dumps(result))
    print('Catalog backup: ' + str(backup))
    engine.dispose()


if __name__ == '__main__':
    main()
