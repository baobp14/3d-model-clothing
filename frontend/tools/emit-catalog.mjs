/**
 * Đọc tools/.kaggle-cache/catalog.json (do import-kaggle.mjs sinh ra) rồi ghi:
 *   - src/data/products.js   (dữ liệu tĩnh cho fallback khi mất mạng)
 *   - supabase/schema.sql    (schema + seed, chạy lại được nhiều lần)
 *
 * Chạy: node tools/emit-catalog.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createProductDescriptions } from '../src/data/productDescriptions.js'

const { products, categories } = JSON.parse(await readFile('tools/.kaggle-cache/catalog.json', 'utf8'))

const COLORS = [
  { id: 'black', vi: 'Đen', en: 'Black', hex: '#111111' },
  { id: 'grey', vi: 'Xám', en: 'Grey', hex: '#8f8f8f' },
  { id: 'beige', vi: 'Be', en: 'Beige', hex: '#d8c7ad' },
  { id: 'navy', vi: 'Xanh navy', en: 'Navy', hex: '#1f2a44' },
  { id: 'white', vi: 'Trắng', en: 'White', hex: '#f2f0ec' },
  { id: 'brown', vi: 'Nâu', en: 'Brown', hex: '#6b4b32' },
  { id: 'burgundy', vi: 'Đỏ mận', en: 'Burgundy', hex: '#6b2737' },
  { id: 'gold', vi: 'Vàng gold', en: 'Gold', hex: '#b08d4f' },
  { id: 'silver', vi: 'Bạc', en: 'Silver', hex: '#c5c8cc' },
]

const usedColors = new Set(products.flatMap(p => p.colors))
const colors = COLORS.filter(c => usedColors.has(c.id))
for (const product of products) {
  const description = createProductDescriptions(product, colors)
  product.description = product.description?.trim() || description.vi
  product.descriptionEn = product.descriptionEn?.trim() || description.en
}

// ── src/data/products.js ─────────────────────────────────────────────────
const j = v => JSON.stringify(v)
const productLine = p => `  { id: ${p.id}, department: ${j(p.department)}, category: ${j(p.category)}, vi: ${j(p.vi)}, en: ${j(p.en)}, price: ${p.price}, colors: ${j(p.colors)}, sizes: ${j(p.sizes)}, isNew: ${p.isNew}, images: ${j(p.images)}, description: ${j(p.description)}, descriptionEn: ${j(p.descriptionEn)} },`

const js = `// Sinh tự động bởi tools/emit-catalog.mjs — đừng sửa tay.
// Nguồn: Kaggle "Fashion Product Images Dataset" (paramaggarwal), license MIT.
// Ảnh đã lọc bỏ ảnh có người mẫu và chuẩn hoá về 900x1200 trong public/img/products/.

export const categories = [
${categories.map(c => `  { id: ${j(c.id)}, department: ${j(c.department)}, vi: ${j(c.vi)}, en: ${j(c.en)} },`).join('\n')}
]

export const colors = [
${colors.map(c => `  { id: ${j(c.id)}, vi: ${j(c.vi)}, en: ${j(c.en)}, hex: ${j(c.hex)} },`).join('\n')}
]

export const products = [
${products.map(productLine).join('\n')}
]

export const formatPrice = value => \`₫ \${value.toLocaleString('vi-VN')}\`
`
await writeFile('src/data/products.js', js)

// ── supabase/schema.sql ──────────────────────────────────────────────────
const q = s => `'${String(s).replace(/'/g, "''")}'`
const arr = a => a.length ? `ARRAY[${a.map(q).join(',')}]` : `'{}'::text[]`

const sql = `-- Sinh tự động bởi tools/emit-catalog.mjs. Chạy lại được nhiều lần, an toàn.
-- Dán toàn bộ file này vào Supabase > SQL Editor > Run.

create table if not exists categories (
  id text primary key,
  name_vi text not null,
  name_en text not null,
  position int not null default 0
);

create table if not exists colors (
  id text primary key,
  name_vi text not null,
  name_en text not null,
  hex text not null
);

create table if not exists products (
  id bigint primary key,
  name_vi text not null,
  name_en text not null,
  category text not null references categories(id),
  price bigint not null check (price >= 0),
  colors text[] not null default '{}'::text[],
  sizes text[] not null default '{}'::text[],
  images text[] not null default '{}'::text[],
  is_new boolean not null default false,
  created_at timestamptz not null default now()
);

alter table categories add column if not exists department text not null default 'men';
alter table products add column if not exists department text not null default 'men';
alter table products add column if not exists description text not null default '';
alter table products add column if not exists description_en text not null default '';

create index if not exists products_department_idx on products (department);
create index if not exists products_category_idx on products (category);
create index if not exists products_price_idx on products (price);

-- RLS: chỉ cho đọc công khai, ghi phải qua dashboard/service_role
alter table categories enable row level security;
alter table colors enable row level security;
alter table products enable row level security;

${['categories', 'colors', 'products'].map(t =>
  `drop policy if exists "public read ${t}" on ${t};\ncreate policy "public read ${t}" on ${t} for select to anon, authenticated using (true);`).join('\n')}

-- Xoá catalog cũ trước khi nạp bộ mới (id đánh lại từ 1)
delete from products;
delete from categories;

insert into categories (id, department, name_vi, name_en, position) values
${categories.map((c, i) => `  (${[q(c.id), q(c.department), q(c.vi), q(c.en), i].join(', ')})`).join(',\n')}
on conflict (id) do update set department = excluded.department, name_vi = excluded.name_vi, name_en = excluded.name_en, position = excluded.position;

insert into colors (id, name_vi, name_en, hex) values
${colors.map(c => `  (${[q(c.id), q(c.vi), q(c.en), q(c.hex)].join(', ')})`).join(',\n')}
on conflict (id) do update set name_vi = excluded.name_vi, name_en = excluded.name_en, hex = excluded.hex;

insert into products (id, department, name_vi, name_en, category, price, colors, sizes, images, is_new, description, description_en) values
${products.map(p => `  (${[p.id, q(p.department), q(p.vi), q(p.en), q(p.category), p.price, arr(p.colors), arr(p.sizes), arr(p.images), Boolean(p.isNew), q(p.description), q(p.descriptionEn)].join(', ')})`).join(',\n')}
on conflict (id) do update set department = excluded.department, name_vi = excluded.name_vi, name_en = excluded.name_en, category = excluded.category, price = excluded.price, colors = excluded.colors, sizes = excluded.sizes, images = excluded.images, is_new = excluded.is_new, description = excluded.description, description_en = excluded.description_en;
`
await writeFile('supabase/schema.sql', sql)

// B? sung m? t? cho catalog ?ang c? m? kh?ng xo? d? li?u ho?c ghi ?? n?i dung ?? ch?nh.
const descriptionsSql = `alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists description_en text not null default '';

${products.map(p => `update public.products set description = case when trim(coalesce(description, '')) = '' then ${q(p.description)} else description end, description_en = case when trim(coalesce(description_en, '')) = '' then ${q(p.descriptionEn)} else description_en end where id = ${p.id} and name_vi = ${q(p.vi)};`).join('\n')}
`
await writeFile('supabase/product-descriptions.sql', descriptionsSql)

console.log(`src/data/products.js  : ${products.length} sản phẩm, ${categories.length} danh mục, ${colors.length} màu`)
console.log(`supabase/schema.sql   : ${sql.split('\n').length} dòng`)
