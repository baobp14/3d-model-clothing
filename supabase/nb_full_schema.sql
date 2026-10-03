-- =============================================================================
-- N&B — schema đầy đủ cho sàn TMĐT thời trang (bổ sung vào database hiện có)
-- =============================================================================
-- Database đang có 3 bảng: categories, colors, products. File này GIỮ NGUYÊN
-- 3 bảng đó (chỉ thêm cột) và thêm các bảng còn thiếu cho: người dùng, biến thể
-- + tồn kho, giỏ hàng, khuyến mãi, đơn hàng, thanh toán, hậu mãi, AI, mặc thử 3D.
--
-- Cách chạy: Supabase > SQL Editor > dán cả file > Run.
-- Chạy lại nhiều lần không lỗi (if not exists / drop policy if exists).
-- Toàn bộ nằm trong 1 transaction: lỗi ở đâu thì không có gì bị ghi.
--
-- Quy ước kiểu id (theo database hiện có):
--   categories.id, colors.id : text   (vd 'm-shirts', 'black')
--   products.id              : bigint
--   bảng mới                 : uuid, riêng product_variants dùng bigint
--   người dùng               : uuid của Supabase Auth (auth.users.id)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Hàm dùng chung
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. NGƯỜI DÙNG & HỒ SƠ
-- =============================================================================

-- Hồ sơ 1-1 với auth.users. Tự tạo khi đăng ký (trigger bên dưới), app không
-- insert trực tiếp. Mật khẩu do Supabase Auth giữ, không lưu ở đây.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Tạo hồ sơ cho các tài khoản đã đăng ký trước khi có trigger.
insert into profiles (id, email, full_name)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name'
from auth.users u
on conflict (id) do nothing;

-- Dùng trong RLS: người đang đăng nhập có phải admin không.
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  line text not null,               -- số nhà, đường
  ward text,
  district text,
  city text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on addresses(user_id);

-- Số đo cơ thể để dựng avatar 3D / mặc thử (khớp AvatarBodyInput bên repo 3D).
create table if not exists body_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text check (gender in ('male', 'female')),
  height_cm numeric,
  weight_kg numeric,
  chest_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  shoulder_width_cm numeric,
  arm_length_cm numeric,
  inseam_cm numeric,
  neck_cm numeric,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 2. DANH MỤC & SẢN PHẨM
-- =============================================================================

-- Thêm cột cho products (giữ nguyên các cột cũ: colors[], sizes[], images[]).
alter table products add column if not exists slug text;
alter table products add column if not exists description text;
alter table products add column if not exists status text not null default 'active';
alter table products add column if not exists updated_at timestamptz not null default now();
-- Loại mesh 3D để mặc thử; null = sản phẩm không mặc thử được.
alter table products add column if not exists tryon_kind text;

do $$ begin
  alter table products add constraint products_status_check
    check (status in ('draft', 'active', 'hidden'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table products add constraint products_tryon_kind_check
    check (tryon_kind in ('tshirt', 'tank', 'croptop', 'shirt', 'longshirt',
                          'sweater', 'jacket', 'dress',
                          'pants', 'shorts', 'capri', 'skirt'));
exception when duplicate_object then null; end $$;

-- slug mặc định = id, admin sửa lại cho đẹp sau.
update products set slug = id::text where slug is null;
create unique index if not exists products_slug_key on products(slug);
create index if not exists products_category_idx on products(category);
create index if not exists products_status_idx on products(status);

-- Gợi ý loại mesh theo danh mục; chỉnh tay từng sản phẩm nếu cần.
update products set tryon_kind = 'tshirt' where tryon_kind is null and category in ('m-tshirts', 'w-tops');
-- Sơ mi → dài tay; polo → 'shirt' (tay ngắn, có cổ).
update products set tryon_kind = 'longshirt' where tryon_kind is null and category = 'm-shirts' and name_vi ilike 'áo sơ mi%';
update products set tryon_kind = 'shirt'  where tryon_kind is null and category = 'm-shirts';
update products set tryon_kind = 'sweater' where tryon_kind is null and category in ('m-knit', 'w-knit');
update products set tryon_kind = 'jacket' where tryon_kind is null and category in ('m-jackets', 'w-jackets');
update products set tryon_kind = 'dress'  where tryon_kind is null and category = 'w-dresses';
update products set tryon_kind = 'pants'  where tryon_kind is null and category in ('m-trousers', 'w-trousers');
update products set tryon_kind = 'skirt'  where tryon_kind is null and category = 'w-skirts';

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- Biến thể bán được: 1 sản phẩm × 1 size × 1 màu = 1 SKU, có tồn kho riêng.
-- Giỏ hàng và đơn hàng trỏ vào đây, không trỏ vào products.
create table if not exists product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  size text not null,
  color text not null references colors(id),
  sku text not null unique,
  price_override bigint check (price_override >= 0),  -- null = dùng products.price
  stock int not null default 0 check (stock >= 0),     -- tồn kho thật
  reserved int not null default 0 check (reserved >= 0), -- đang giữ cho đơn chưa thanh toán
  unique (product_id, size, color)
);
create index if not exists product_variants_product_id_idx on product_variants(product_id);

-- Tạo biến thể từ 2 mảng colors × sizes đang có. Tồn kho mẫu = 20 để demo.
-- Bỏ qua màu chưa có trong bảng colors.
insert into product_variants (product_id, size, color, sku, stock)
select p.id, s.size, c.color, p.id || '-' || c.color || '-' || s.size, 20
from products p
cross join lateral unnest(p.sizes) as s(size)
cross join lateral unnest(p.colors) as c(color)
where exists (select 1 from colors where colors.id = c.color)
on conflict (product_id, size, color) do nothing;

-- Sản phẩm không có size (đồng hồ...) → một biến thể size 'F' (free size) mỗi màu.
insert into product_variants (product_id, size, color, sku, stock)
select p.id, 'F', c.color, p.id || '-' || c.color || '-F', 20
from products p
cross join lateral unnest(p.colors) as c(color)
where cardinality(p.sizes) = 0
  and exists (select 1 from colors where colors.id = c.color)
on conflict (product_id, size, color) do nothing;

-- Ảnh sản phẩm, có thể gắn theo màu (chọn màu đen → hiện ảnh màu đen).
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references products(id) on delete cascade,
  color text references colors(id),   -- null = ảnh chung mọi màu
  url text not null,
  position int not null default 0
);
create index if not exists product_images_product_id_idx on product_images(product_id);

-- Chép ảnh từ mảng products.images (chỉ chạy lần đầu).
insert into product_images (product_id, url, position)
select p.id, img.url, img.pos - 1
from products p
cross join lateral unnest(p.images) with ordinality as img(url, pos)
where not exists (select 1 from product_images pi where pi.product_id = p.id);

-- Bảng size từng sản phẩm, để chấm Chật / Vừa / Rộng khi mặc thử.
-- Áo so vòng ngực, quần/váy so vòng eo; cột không áp dụng để null.
create table if not exists product_size_charts (
  product_id bigint not null references products(id) on delete cascade,
  size text not null,
  chest_cm numeric,          -- áo: vòng ngực
  body_length_cm numeric,    -- áo: dài áo từ đỉnh vai
  sleeve_length_cm numeric,  -- áo: dài tay
  waist_cm numeric,          -- quần/váy: vòng cạp
  hip_cm numeric,            -- quần/váy: vòng mông
  inseam_cm numeric,         -- quần: dài đáy trong
  hem_cm numeric,            -- quần: vòng ống / váy: vòng gấu
  length_cm numeric,         -- váy: dài từ cạp xuống gấu
  primary key (product_id, size)
);

-- Ảnh in trải phẳng đã xoá nền, dán lên mesh 3D khi mặc thử.
create table if not exists product_prints (
  product_id bigint not null references products(id) on delete cascade,
  color text not null references colors(id),
  front_url text not null,
  back_url text,                              -- null = dùng lại mặt trước
  print_scale numeric not null default 1,
  print_offset_y numeric not null default 0,
  primary key (product_id, color)
);

-- =============================================================================
-- 3. GIỎ HÀNG & KHUYẾN MÃI
-- =============================================================================

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id bigint not null references product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  added_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index if not exists cart_items_cart_id_idx on cart_items(cart_id);

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value bigint not null check (value > 0),      -- % (1–100) hoặc số tiền VND
  max_discount bigint,                          -- trần giảm cho loại percent
  min_order_value bigint not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,                              -- null = không giới hạn
  used_count int not null default 0,
  is_active boolean not null default true
);

-- =============================================================================
-- 4. ĐƠN HÀNG & THANH TOÁN
-- =============================================================================
-- Máy trạng thái đơn:
--   pending → paid → shipping → completed
--   pending/paid → cancelled
--   paid/shipping/completed → refunding → refunded
-- COD: pending → shipping → completed (thu tiền khi giao).

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(md5(random()::text), 1, 8)), -- mã đơn hiển thị
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'shipping', 'completed',
                      'cancelled', 'refunding', 'refunded')),
  payment_method text not null check (payment_method in ('cod', 'vnpay')),
  promotion_id uuid references promotions(id) on delete set null,
  -- Chốt địa chỉ lúc đặt: sửa/xoá sổ địa chỉ sau đó không làm đổi đơn cũ.
  recipient_name text not null,
  phone text not null,
  shipping_address text not null,
  note text,
  subtotal bigint not null default 0,
  discount bigint not null default 0,
  shipping_fee bigint not null default 0,
  total bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_id_idx on orders(user_id);
create index if not exists orders_status_idx on orders(status);

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- Dòng trong đơn: chốt tên, size, màu, giá tại lúc mua.
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id bigint references product_variants(id) on delete set null,
  product_id bigint references products(id) on delete set null,
  product_name text not null,
  size text not null,
  color text not null,
  image_url text,
  unit_price bigint not null check (unit_price >= 0),
  quantity int not null check (quantity > 0)
);
create index if not exists order_items_order_id_idx on order_items(order_id);

-- Log mỗi lần đổi trạng thái (tự ghi bằng trigger, app không cần insert).
create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null, -- null = hệ thống
  note text,
  changed_at timestamptz not null default now()
);
create index if not exists order_status_history_order_id_idx on order_status_history(order_id);

create or replace function log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status on orders;
create trigger orders_log_status after insert or update of status on orders
  for each row execute function log_order_status();

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null check (provider in ('cod', 'vnpay')),
  amount bigint not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  transaction_ref text,                   -- mã giao dịch phía VNPay
  signature_verified boolean not null default false, -- đã kiểm chữ ký callback chưa
  raw_response jsonb,                     -- lưu nguyên callback để đối soát
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payments_order_id_idx on payments(order_id);

-- =============================================================================
-- 5. HẬU MÃI
-- =============================================================================

-- Chỉ review được món đã mua (gắn với order_item), mỗi món 1 lần.
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references order_items(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_product_id_idx on reviews(product_id);

create table if not exists wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- Yêu cầu hủy / đổi trả / hoàn tiền, admin duyệt rồi mới đổi trạng thái đơn.
create table if not exists return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('cancel', 'return', 'refund')),
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'resolved')),
  admin_note text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists return_requests_order_id_idx on return_requests(order_id);

-- =============================================================================
-- 6. AI & TƯƠNG TÁC
-- =============================================================================

-- Log hành vi làm nguồn cho gợi ý sản phẩm.
create table if not exists product_views (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,                       -- khách chưa đăng nhập
  product_id bigint not null references products(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'add_to_cart', 'purchase', 'tryon')),
  created_at timestamptz not null default now()
);
create index if not exists product_views_product_id_idx on product_views(product_id);
create index if not exists product_views_user_id_idx on product_views(user_id);

-- Lịch sử chat với chatbot tư vấn.
create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_id_idx on chat_messages(session_id);

-- =============================================================================
-- 7. PHÂN QUYỀN (Row Level Security)
-- =============================================================================
-- - Catalog: ai cũng đọc, chỉ admin ghi.
-- - Dữ liệu cá nhân: chỉ chủ tài khoản (và admin) đọc/ghi.
-- - Đơn hàng, thanh toán: khách chỉ ĐỌC đơn của mình. Tạo đơn / trừ kho /
--   xác nhận thanh toán phải làm ở server (API route dùng service_role key,
--   key này bỏ qua RLS) — không cho client tự insert đơn để tránh sửa giá.
-- - 3 bảng cũ (categories, colors, products): KHÔNG đụng RLS, giữ như hiện tại.

-- Catalog mới: public read + admin write
do $$
declare t text;
begin
  foreach t in array array['product_variants', 'product_images', 'product_size_charts',
                           'product_prints', 'promotions']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "admin write" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Bảng của riêng từng người (cột user_id): chủ + admin toàn quyền
do $$
declare t text;
begin
  foreach t in array array['addresses', 'body_profiles', 'carts', 'wishlists']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id or is_admin())', t);
  end loop;
end $$;

alter table profiles enable row level security;
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id or is_admin());
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Không cho khách tự nâng mình lên admin. (Làm bằng trigger vì policy trên
-- profiles mà lại đọc profiles sẽ bị lỗi đệ quy.) auth.uid() null = chạy từ
-- SQL Editor / service_role, được phép.
create or replace function protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'Không được tự đổi role';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role before update on profiles
  for each row execute function protect_profile_role();
drop policy if exists "admin manage profiles" on profiles;
create policy "admin manage profiles" on profiles for all using (is_admin()) with check (is_admin());

alter table cart_items enable row level security;
drop policy if exists "own cart items" on cart_items;
create policy "own cart items" on cart_items for all
  using (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()));

alter table orders enable row level security;
drop policy if exists "read own orders" on orders;
create policy "read own orders" on orders for select using (auth.uid() = user_id or is_admin());
drop policy if exists "admin update orders" on orders;
create policy "admin update orders" on orders for update using (is_admin()) with check (is_admin());

do $$
declare t text;
begin
  foreach t in array array['order_items', 'order_status_history', 'payments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "read via own order" on %I', t);
    execute format('create policy "read via own order" on %I for select using (is_admin() or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()))', t);
  end loop;
end $$;

alter table reviews enable row level security;
drop policy if exists "public read" on reviews;
create policy "public read" on reviews for select using (true);
drop policy if exists "review own purchase" on reviews;
create policy "review own purchase" on reviews for insert with check (
  auth.uid() = user_id and exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.user_id = auth.uid()
      and o.status = 'completed' and oi.product_id = reviews.product_id
  )
);
drop policy if exists "manage own review" on reviews;
create policy "manage own review" on reviews for delete using (auth.uid() = user_id or is_admin());

alter table return_requests enable row level security;
drop policy if exists "read own requests" on return_requests;
create policy "read own requests" on return_requests for select using (auth.uid() = user_id or is_admin());
drop policy if exists "create own request" on return_requests;
create policy "create own request" on return_requests for insert with check (
  auth.uid() = user_id and status = 'pending'
  and exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);
drop policy if exists "admin resolve requests" on return_requests;
create policy "admin resolve requests" on return_requests for update using (is_admin()) with check (is_admin());

alter table product_views enable row level security;
drop policy if exists "log own events" on product_views;
create policy "log own events" on product_views for insert
  with check (user_id is null or user_id = auth.uid());
drop policy if exists "admin read events" on product_views;
create policy "admin read events" on product_views for select using (is_admin());

alter table chat_messages enable row level security;
drop policy if exists "own chat" on chat_messages;
create policy "own chat" on chat_messages for select using (auth.uid() = user_id or is_admin());
drop policy if exists "write own chat" on chat_messages;
create policy "write own chat" on chat_messages for insert
  with check (user_id is null or user_id = auth.uid());

commit;
