import os
import sys
import json
import uuid
import sqlite3
import httpx
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load config
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file = os.path.join(backend_dir, ".env")
load_dotenv(env_file)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
db_path = os.path.join(backend_dir, "shop.db")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Lỗi: Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong .env")
    sys.exit(1)

if not os.path.exists(db_path):
    print(f"❌ Lỗi: Không tìm thấy {db_path}")
    sys.exit(1)

print(f"🚀 Bắt đầu đồng bộ shop.db lên Supabase ({SUPABASE_URL})...")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

client = httpx.Client(headers=headers, timeout=60.0)

# 2. Đọc shop.db
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
cursor.execute("SELECT * FROM products ORDER BY id ASC")
products_rows = cursor.fetchall()
print(f"📦 Đã đọc {len(products_rows)} sản phẩm từ shop.db")

# 3. Chuẩn bị Categories
CATEGORIES_DEF = {
    "m-tshirts": "Áo Thun Nam",
    "m-shirts": "Áo Sơ Mi Nam",
    "m-trousers": "Quần Dài Nam",
    "w-skirts": "Chân Váy Nữ",
    "w-tshirts": "Áo Thun Nữ",
    "w-trousers": "Quần Dài Nữ",
}

categories_payload = []
category_uuid_map = {}

for slug, name in CATEGORIES_DEF.items():
    cat_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"category-{slug}"))
    category_uuid_map[slug] = cat_id
    categories_payload.append({
        "id": cat_id,
        "name": name,
        "slug": slug,
        "parent_id": None
    })

res_cat = client.post(f"{SUPABASE_URL}/rest/v1/categories", json=categories_payload)
if res_cat.status_code in (200, 201):
    print(f"✅ Đã tải lên {len(categories_payload)} danh mục vào 'categories'")
else:
    print(f"⚠️ Categories phản hồi HTTP {res_cat.status_code}: {res_cat.text}")

# 4. Chuẩn bị Products, Variants, Images, Inventory
products_payload = []
variants_payload = []
images_payload = []
inventory_payload = []

for row in products_rows:
    p_id = row["id"]
    category_slug = row["category"]
    cat_uuid = category_uuid_map.get(category_slug)
    
    prod_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"product-{p_id}"))
    
    # Created at handling
    created_at = row["created_at"]
    if not created_at:
        created_at = "2026-10-27T00:00:00Z"
    elif " " in created_at and "T" not in created_at:
        created_at = created_at.replace(" ", "T") + "Z"
        
    products_payload.append({
        "id": prod_uuid,
        "category_id": cat_uuid,
        "name": row["name_vi"],
        "slug": f"{category_slug}-{p_id}",
        "description": row["description"] or "",
        "base_price": float(row["price"]),
        "status": "active",
        "created_at": created_at
    })
    
    # Parse JSON fields
    colors = json.loads(row["colors"]) if row["colors"] else ["default"]
    sizes = json.loads(row["sizes"]) if row["sizes"] else ["M"]
    images = json.loads(row["images"]) if row["images"] else []
    stock = row["stock"] or 100
    
    # Images
    for idx, img_url in enumerate(images):
        img_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"image-{p_id}-{idx}"))
        images_payload.append({
            "id": img_uuid,
            "product_id": prod_uuid,
            "url": img_url,
            "position": idx
        })
        
    # Variants & Inventory
    num_variants = max(1, len(colors) * len(sizes))
    qty_per_variant = max(10, stock // num_variants)
    
    for c in colors:
        for s in sizes:
            variant_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"variant-{p_id}-{c}-{s}"))
            clean_color = c.replace("_", "-").upper()[:8]
            variants_payload.append({
                "id": variant_uuid,
                "product_id": prod_uuid,
                "sku": f"NB-{p_id}-{clean_color}-{s}",
                "size": s,
                "color": c,
                "price_override": None
            })
            
            inv_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"inventory-{variant_uuid}"))
            inventory_payload.append({
                "id": inv_uuid,
                "variant_id": variant_uuid,
                "quantity": qty_per_variant,
                "reserved_quantity": 0
            })

# 5. Đẩy Products lên Supabase
print(f"📤 Đang tải {len(products_payload)} sản phẩm lên Supabase...")
res_prod = client.post(f"{SUPABASE_URL}/rest/v1/products", json=products_payload)
if res_prod.status_code in (200, 201):
    print(f"✅ Đã tải lên {len(products_payload)} sản phẩm vào 'products'")
else:
    print(f"⚠️ Products phản hồi HTTP {res_prod.status_code}: {res_prod.text}")

# 6. Đẩy Product Variants lên Supabase (chia batch 100 nếu cần)
print(f"📤 Đang tải {len(variants_payload)} biến thể màu sắc & size lên Supabase...")
batch_size = 100
for i in range(0, len(variants_payload), batch_size):
    batch = variants_payload[i:i+batch_size]
    res_var = client.post(f"{SUPABASE_URL}/rest/v1/product_variants", json=batch)
    if res_var.status_code not in (200, 201):
        print(f"⚠️ Variants batch {i} phản hồi HTTP {res_var.status_code}: {res_var.text}")
print(f"✅ Đã tải lên toàn bộ {len(variants_payload)} biến thể vào 'product_variants'")

# 7. Đẩy Inventory lên Supabase
print(f"📤 Đang tải {len(inventory_payload)} dòng tồn kho vào 'inventory'...")
for i in range(0, len(inventory_payload), batch_size):
    batch = inventory_payload[i:i+batch_size]
    res_inv = client.post(f"{SUPABASE_URL}/rest/v1/inventory", json=batch)
    if res_inv.status_code not in (200, 201):
        print(f"⚠️ Inventory batch {i} phản hồi HTTP {res_inv.status_code}: {res_inv.text}")
print(f"✅ Đã tải lên toàn bộ {len(inventory_payload)} dòng tồn kho vào 'inventory'")

# 8. Đẩy Product Images lên Supabase
print(f"📤 Đang tải {len(images_payload)} ảnh sản phẩm vào 'product_images'...")
for i in range(0, len(images_payload), batch_size):
    batch = images_payload[i:i+batch_size]
    res_img = client.post(f"{SUPABASE_URL}/rest/v1/product_images", json=batch)
    if res_img.status_code not in (200, 201):
        print(f"⚠️ Images batch {i} phản hồi HTTP {res_img.status_code}: {res_img.text}")
print(f"✅ Đã tải lên toàn bộ {len(images_payload)} ảnh vào 'product_images'")

print("\n🎉 HOÀN TẤT ĐỒNG BỘ TOÀN BỘ DỮ LIỆU LÊN SUPABASE!")
