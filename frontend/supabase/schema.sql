-- Sinh tự động bởi tools/emit-catalog.mjs. Chạy lại được nhiều lần, an toàn.
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

drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select to anon, authenticated using (true);
drop policy if exists "public read colors" on colors;
create policy "public read colors" on colors for select to anon, authenticated using (true);
drop policy if exists "public read products" on products;
create policy "public read products" on products for select to anon, authenticated using (true);

-- Xoá catalog cũ trước khi nạp bộ mới (id đánh lại từ 1)
delete from products;
delete from categories;

insert into categories (id, department, name_vi, name_en, position) values
  ('m-shirts', 'men', 'Áo sơ mi', 'Shirts', 0),
  ('m-tshirts', 'men', 'Áo thun', 'T-shirts', 1),
  ('m-knit', 'men', 'Áo len', 'Knitwear', 2),
  ('m-jackets', 'men', 'Áo khoác & vest', 'Jackets & blazers', 3),
  ('m-trousers', 'men', 'Quần', 'Trousers', 4),
  ('w-dresses', 'women', 'Đầm', 'Dresses', 5),
  ('w-tops', 'women', 'Áo kiểu', 'Blouses & tops', 6),
  ('w-knit', 'women', 'Áo len', 'Knitwear', 7),
  ('w-jackets', 'women', 'Áo khoác', 'Coats & jackets', 8),
  ('w-skirts', 'women', 'Chân váy', 'Skirts', 9),
  ('w-trousers', 'women', 'Quần', 'Trousers', 10),
  ('wa-men', 'watches', 'Đồng hồ nam', 'Men''s watches', 11),
  ('wa-women', 'watches', 'Đồng hồ nữ', 'Women''s watches', 12),
  ('b-bags', 'bags', 'Túi xách', 'Bags', 13),
  ('b-wallet', 'bags', 'Ví & đồ da nhỏ', 'Wallets & small leather goods', 14),
  ('b-belt', 'bags', 'Thắt lưng', 'Belts', 15),
  ('b-scarf', 'bags', 'Khăn & kính', 'Scarves & sunglasses', 16)
on conflict (id) do update set department = excluded.department, name_vi = excluded.name_vi, name_en = excluded.name_en, position = excluded.position;

insert into colors (id, name_vi, name_en, hex) values
  ('black', 'Đen', 'Black', '#111111'),
  ('grey', 'Xám', 'Grey', '#8f8f8f'),
  ('beige', 'Be', 'Beige', '#d8c7ad'),
  ('navy', 'Xanh navy', 'Navy', '#1f2a44'),
  ('white', 'Trắng', 'White', '#f2f0ec'),
  ('brown', 'Nâu', 'Brown', '#6b4b32'),
  ('burgundy', 'Đỏ mận', 'Burgundy', '#6b2737'),
  ('gold', 'Vàng gold', 'Gold', '#b08d4f'),
  ('silver', 'Bạc', 'Silver', '#c5c8cc')
on conflict (id) do update set name_vi = excluded.name_vi, name_en = excluded.name_en, hex = excluded.hex;

insert into products (id, department, name_vi, name_en, category, price, colors, sizes, images, is_new, description, description_en) values
  (1000, 'men', 'Áo sơ mi phom rộng', 'Oversized Shirt', 'm-shirts', 14700000, ARRAY['white','navy','grey'], ARRAY['XS','S','M','L','XL'], ARRAY['/img/products/hm-0795836001.webp','/img/products/hm-0795836004.webp','/img/products/hm-0795836007.webp'], true, 'Áo sơ mi phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu trắng, xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Shirt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in white, navy, grey to complement your wardrobe.'),
  (1001, 'men', 'Áo polo cắt may tối giản', 'Minimal Polo Shirt', 'm-shirts', 22600000, ARRAY['grey','black','white'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0654410007.webp','/img/products/hm-0654410008.webp','/img/products/hm-0654410009.webp'], false, 'Áo polo cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu xám, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Polo Shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers for work or jeans for a weekend outing.
Available in grey, black, white to complement your wardrobe.'),
  (1002, 'men', 'Áo polo phom ôm', 'Tailored Polo Shirt', 'm-shirts', 17900000, ARRAY['burgundy','grey','navy'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0443860005.webp','/img/products/hm-0443860011.webp','/img/products/hm-0443860013.webp'], false, 'Áo polo phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu đỏ mận, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Polo Shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers for work or jeans for a weekend outing.
Available in burgundy, grey, navy to complement your wardrobe.'),
  (1003, 'men', 'Áo polo cắt may tối giản', 'Minimal Polo Shirt', 'm-shirts', 27600000, ARRAY['grey','black','white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0570004007.webp','/img/products/hm-0570004009.webp','/img/products/hm-0570004010.webp'], false, 'Áo polo cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu xám, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Polo Shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers for work or jeans for a weekend outing.
Available in grey, black, white to complement your wardrobe.'),
  (1004, 'men', 'Áo sơ mi bản mềm', 'Soft Shirt', 'm-shirts', 15100000, ARRAY['white','navy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0584298001.webp','/img/products/hm-0584298016.webp'], false, 'Áo sơ mi bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in white, navy to complement your wardrobe.'),
  (1005, 'men', 'Áo sơ mi cắt may tối giản', 'Minimal Shirt', 'm-shirts', 35300000, ARRAY['white','black','grey'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0781758001.webp','/img/products/hm-0781758003.webp','/img/products/hm-0781758006.webp'], false, 'Áo sơ mi cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu trắng, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in white, black, grey to complement your wardrobe.'),
  (1006, 'men', 'Áo polo dáng suông', 'Relaxed Polo Shirt', 'm-shirts', 34500000, ARRAY['black','burgundy','navy'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0378124004.webp','/img/products/hm-0378124007.webp','/img/products/hm-0378124009.webp'], false, 'Áo polo dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu đen, đỏ mận, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Polo Shirt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with trousers for work or jeans for a weekend outing.
Available in black, burgundy, navy to complement your wardrobe.'),
  (1007, 'men', 'Áo polo phom ôm', 'Tailored Polo Shirt', 'm-shirts', 14800000, ARRAY['white','grey','black'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0658329002.webp','/img/products/hm-0658329004.webp','/img/products/hm-0658329008.webp'], false, 'Áo polo phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu trắng, xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Polo Shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers for work or jeans for a weekend outing.
Available in white, grey, black to complement your wardrobe.'),
  (1008, 'men', 'Áo polo bản mềm', 'Soft Polo Shirt', 'm-shirts', 21300000, ARRAY['navy','white','grey'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0671599001.webp','/img/products/hm-0671599002.webp','/img/products/hm-0671599003.webp'], true, 'Áo polo bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu xanh navy, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Polo Shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with trousers for work or jeans for a weekend outing.
Available in navy, white, grey to complement your wardrobe.'),
  (1009, 'men', 'Áo sơ mi bản mềm', 'Soft Shirt', 'm-shirts', 26900000, ARRAY['black','navy','white'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0734940001.webp','/img/products/hm-0734940002.webp','/img/products/hm-0734940003.webp'], false, 'Áo sơ mi bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in black, navy, white to complement your wardrobe.'),
  (1010, 'men', 'Áo thun phom ôm', 'Tailored T-shirt', 'm-tshirts', 19900000, ARRAY['black','grey','white'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0449263003.webp','/img/products/hm-0449263004.webp','/img/products/hm-0449263005.webp'], false, 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, grey, white to complement your wardrobe.'),
  (1011, 'men', 'Áo thun bản mềm', 'Soft T-shirt', 'm-tshirts', 15800000, ARRAY['grey','black'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0507431008.webp','/img/products/hm-0507431024.webp'], false, 'Áo thun bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft T-shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in grey, black to complement your wardrobe.'),
  (1012, 'men', 'Áo thun phom ôm', 'Tailored T-shirt', 'm-tshirts', 12400000, ARRAY['black','white','grey'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0636587001.webp','/img/products/hm-0636587002.webp','/img/products/hm-0636587003.webp'], false, 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.'),
  (1013, 'men', 'Áo thun dáng cổ điển', 'Classic T-shirt', 'm-tshirts', 11800000, ARRAY['black','white','navy'], ARRAY['M','L','XL'], ARRAY['/img/products/hm-0570002001.webp','/img/products/hm-0570002002.webp','/img/products/hm-0570002008.webp'], true, 'Áo thun dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic T-shirt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, navy to complement your wardrobe.'),
  (1014, 'men', 'Áo thun phom ôm', 'Tailored T-shirt', 'm-tshirts', 9100000, ARRAY['black','white','grey'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0541491001.webp','/img/products/hm-0541491002.webp','/img/products/hm-0541491003.webp'], true, 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.'),
  (1015, 'men', 'Áo thun dáng cổ điển', 'Classic T-shirt', 'm-tshirts', 13800000, ARRAY['black','white','grey'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0593829001.webp','/img/products/hm-0593829002.webp','/img/products/hm-0593829003.webp'], false, 'Áo thun dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic T-shirt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.'),
  (1016, 'men', 'Áo thun phom ôm', 'Tailored T-shirt', 'm-tshirts', 21400000, ARRAY['white','black','navy'], ARRAY['XS','M','L'], ARRAY['/img/products/hm-0684021001.webp','/img/products/hm-0684021003.webp','/img/products/hm-0684021006.webp'], false, 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu trắng, đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in white, black, navy to complement your wardrobe.'),
  (1017, 'men', 'Áo thun cắt may tối giản', 'Minimal T-shirt', 'm-tshirts', 16700000, ARRAY['white','navy','burgundy'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0591466002.webp','/img/products/hm-0591466004.webp','/img/products/hm-0591466011.webp'], true, 'Áo thun cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu trắng, xanh navy, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal T-shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in white, navy, burgundy to complement your wardrobe.'),
  (1018, 'men', 'Áo thun bản mềm', 'Soft T-shirt', 'm-tshirts', 14900000, ARRAY['black','white','grey'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0598755001.webp','/img/products/hm-0598755002.webp','/img/products/hm-0598755011.webp'], false, 'Áo thun bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft T-shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.'),
  (1019, 'men', 'Áo thun cắt may tối giản', 'Minimal T-shirt', 'm-tshirts', 19700000, ARRAY['white','black','grey'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0685816001.webp','/img/products/hm-0685816002.webp','/img/products/hm-0685816003.webp'], false, 'Áo thun cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu trắng, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal T-shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in white, black, grey to complement your wardrobe.'),
  (1020, 'men', 'Áo len dáng cổ điển', 'Classic Sweater', 'm-knit', 47400000, ARRAY['black','grey','navy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0609146001.webp','/img/products/hm-0609146011.webp','/img/products/hm-0609146014.webp'], true, 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, navy to complement your wardrobe.'),
  (1021, 'men', 'Áo len cắt may tối giản', 'Minimal Sweater', 'm-knit', 31200000, ARRAY['burgundy','black','beige'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0787123005.webp','/img/products/hm-0787123007.webp','/img/products/hm-0787123008.webp'], true, 'Áo len cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đỏ mận, đen, be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Sweater — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in burgundy, black, beige to complement your wardrobe.'),
  (1022, 'men', 'Áo len bản mềm', 'Soft Sweater', 'm-knit', 25600000, ARRAY['white','grey','navy'], ARRAY['XS','M','L'], ARRAY['/img/products/hm-0755574001.webp','/img/products/hm-0755574002.webp','/img/products/hm-0755574003.webp'], false, 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu trắng, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in white, grey, navy to complement your wardrobe.'),
  (1023, 'men', 'Áo hoodie cắt may tối giản', 'Minimal Hoodie', 'm-knit', 30400000, ARRAY['black','grey','white'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0557248001.webp','/img/products/hm-0557248002.webp','/img/products/hm-0557248003.webp'], false, 'Áo hoodie cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Hoodie — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, white to complement your wardrobe.'),
  (1024, 'men', 'Áo len bản mềm', 'Soft Sweater', 'm-knit', 44400000, ARRAY['navy','grey'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0669562001.webp','/img/products/hm-0669562002.webp'], false, 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in navy, grey to complement your wardrobe.'),
  (1025, 'men', 'Áo len dáng suông', 'Relaxed Sweater', 'm-knit', 38600000, ARRAY['black','grey'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0552743001.webp','/img/products/hm-0552743009.webp'], false, 'Áo len dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Sweater — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey to complement your wardrobe.'),
  (1026, 'men', 'Áo len dáng cổ điển', 'Classic Sweater', 'm-knit', 30000000, ARRAY['black','grey','white'], ARRAY['XS','S','M','L','XL'], ARRAY['/img/products/hm-0685813001.webp','/img/products/hm-0685813002.webp','/img/products/hm-0685813003.webp'], false, 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, white to complement your wardrobe.'),
  (1027, 'men', 'Áo hoodie dáng suông', 'Relaxed Hoodie', 'm-knit', 44300000, ARRAY['black','grey','white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0685814001.webp','/img/products/hm-0685814002.webp','/img/products/hm-0685814003.webp'], false, 'Áo hoodie dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Hoodie — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, white to complement your wardrobe.'),
  (1028, 'men', 'Áo len phom ôm', 'Tailored Sweater', 'm-knit', 30300000, ARRAY['grey','navy','black'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0564358003.webp','/img/products/hm-0564358004.webp','/img/products/hm-0564358012.webp'], false, 'Áo len phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Sweater — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, navy, black to complement your wardrobe.'),
  (1029, 'men', 'Áo len dáng suông', 'Relaxed Sweater', 'm-knit', 37800000, ARRAY['black','beige','grey'], ARRAY['XS','M','L'], ARRAY['/img/products/hm-0715828001.webp','/img/products/hm-0715828002.webp','/img/products/hm-0715828005.webp'], false, 'Áo len dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, be, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Sweater — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, beige, grey to complement your wardrobe.'),
  (1030, 'men', 'Áo vest cắt may tối giản', 'Minimal Blazer', 'm-jackets', 117300000, ARRAY['grey','navy','burgundy'], ARRAY['XS','M','L'], ARRAY['/img/products/hm-0783354001.webp','/img/products/hm-0783354002.webp','/img/products/hm-0783354003.webp'], true, 'Áo vest cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, xanh navy, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Blazer — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, navy, burgundy to complement your wardrobe.'),
  (1031, 'men', 'Áo khoác phom rộng', 'Oversized Jacket', 'm-jackets', 122700000, ARRAY['black','navy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0602673007.webp','/img/products/hm-0602673010.webp'], false, 'Áo khoác phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Jacket — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy to complement your wardrobe.'),
  (1032, 'men', 'Áo vest bản mềm', 'Soft Blazer', 'm-jackets', 67200000, ARRAY['navy','black','grey'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0713995001.webp','/img/products/hm-0713995003.webp','/img/products/hm-0713995004.webp'], false, 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xanh navy, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in navy, black, grey to complement your wardrobe.'),
  (1033, 'men', 'Áo măng tô bản mềm', 'Soft Coat', 'm-jackets', 84800000, ARRAY['black','navy'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0765907001.webp','/img/products/hm-0765907002.webp'], false, 'Áo măng tô bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Coat — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy to complement your wardrobe.'),
  (1034, 'men', 'Áo vest bản mềm', 'Soft Blazer', 'm-jackets', 81300000, ARRAY['white','navy','grey'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0628631001.webp','/img/products/hm-0628631002.webp','/img/products/hm-0628631004.webp'], false, 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu trắng, xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in white, navy, grey to complement your wardrobe.'),
  (1035, 'men', 'Áo măng tô phom rộng', 'Oversized Coat', 'm-jackets', 61900000, ARRAY['grey','navy','black'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0880485002.webp','/img/products/hm-0880485003.webp','/img/products/hm-0880485004.webp'], false, 'Áo măng tô phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Coat — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, navy, black to complement your wardrobe.'),
  (1036, 'men', 'Áo khoác phom ôm', 'Tailored Jacket', 'm-jackets', 123800000, ARRAY['black','grey'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0807005003.webp','/img/products/hm-0807005009.webp'], false, 'Áo khoác phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Jacket — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, grey to complement your wardrobe.'),
  (1037, 'men', 'Áo măng tô cắt may tối giản', 'Minimal Coat', 'm-jackets', 110200000, ARRAY['navy','black'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0631777005.webp','/img/products/hm-0631777006.webp'], false, 'Áo măng tô cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Coat — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in navy, black to complement your wardrobe.'),
  (1038, 'men', 'Áo vest dáng cổ điển', 'Classic Blazer', 'm-jackets', 85900000, ARRAY['black','navy','beige'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0553092001.webp','/img/products/hm-0553092007.webp','/img/products/hm-0553092017.webp'], false, 'Áo vest dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Blazer — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, beige to complement your wardrobe.'),
  (1039, 'men', 'Áo khoác cắt may tối giản', 'Minimal Jacket', 'm-jackets', 111600000, ARRAY['black','navy'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0819500001.webp','/img/products/hm-0819500004.webp'], false, 'Áo khoác cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Jacket — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy to complement your wardrobe.'),
  (1040, 'men', 'Quần âu bản mềm', 'Soft Trousers', 'm-trousers', 26700000, ARRAY['black','white','navy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0732188001.webp','/img/products/hm-0732188002.webp','/img/products/hm-0732188003.webp'], true, 'Quần âu bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Trousers — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, white, navy to complement your wardrobe.'),
  (1041, 'men', 'Quần âu phom rộng', 'Oversized Trousers', 'm-trousers', 31200000, ARRAY['grey','navy','burgundy'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0761501001.webp','/img/products/hm-0761501003.webp','/img/products/hm-0761501004.webp'], false, 'Quần âu phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xám, xanh navy, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in grey, navy, burgundy to complement your wardrobe.'),
  (1042, 'men', 'Quần âu dáng suông', 'Relaxed Trousers', 'm-trousers', 41500000, ARRAY['black','white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0416157003.webp','/img/products/hm-0416157005.webp'], false, 'Quần âu dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, white to complement your wardrobe.'),
  (1043, 'men', 'Quần âu phom ôm', 'Tailored Trousers', 'm-trousers', 31000000, ARRAY['black','navy'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0744306001.webp','/img/products/hm-0744306002.webp'], false, 'Quần âu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.'),
  (1044, 'men', 'Quần âu dáng cổ điển', 'Classic Trousers', 'm-trousers', 19800000, ARRAY['white','navy','black'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0759311001.webp','/img/products/hm-0759311002.webp','/img/products/hm-0759311003.webp'], false, 'Quần âu dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu trắng, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Trousers — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in white, navy, black to complement your wardrobe.'),
  (1045, 'men', 'Quần âu phom rộng', 'Oversized Trousers', 'm-trousers', 31400000, ARRAY['black','navy'], ARRAY['M','L','XL'], ARRAY['/img/products/hm-0710877001.webp','/img/products/hm-0710877002.webp'], false, 'Quần âu phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.'),
  (1046, 'men', 'Quần âu bản mềm', 'Soft Trousers', 'm-trousers', 34800000, ARRAY['black','navy','white'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0411758001.webp','/img/products/hm-0411758003.webp','/img/products/hm-0411758008.webp'], false, 'Quần âu bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Trousers — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy, white to complement your wardrobe.'),
  (1047, 'men', 'Quần âu phom rộng', 'Oversized Trousers', 'm-trousers', 30700000, ARRAY['black','navy'], ARRAY['S','M','L','XL'], ARRAY['/img/products/hm-0525500001.webp','/img/products/hm-0525500003.webp'], false, 'Quần âu phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.'),
  (1048, 'men', 'Quần âu phom ôm', 'Tailored Trousers', 'm-trousers', 40400000, ARRAY['navy','grey'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0384482001.webp','/img/products/hm-0384482003.webp'], false, 'Quần âu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in navy, grey to complement your wardrobe.'),
  (1049, 'men', 'Quần âu dáng suông', 'Relaxed Trousers', 'm-trousers', 30000000, ARRAY['black','navy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0491912001.webp','/img/products/hm-0491912002.webp'], false, 'Quần âu dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.'),
  (1050, 'women', 'Đầm dáng suông', 'Relaxed Dress', 'w-dresses', 99600000, ARRAY['black','navy'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0220094001.webp','/img/products/hm-0220094011.webp'], false, 'Đầm dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Dress — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, navy to complement your wardrobe.'),
  (1051, 'women', 'Đầm bản mềm', 'Soft Dress', 'w-dresses', 60200000, ARRAY['navy','black'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0618287001.webp','/img/products/hm-0618287002.webp'], false, 'Đầm bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Dress — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in navy, black to complement your wardrobe.'),
  (1052, 'women', 'Đầm dáng cổ điển', 'Classic Dress', 'w-dresses', 93500000, ARRAY['black','white'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0646490003.webp','/img/products/hm-0646490013.webp'], false, 'Đầm dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Dress — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, white to complement your wardrobe.'),
  (1053, 'women', 'Đầm cắt may tối giản', 'Minimal Dress', 'w-dresses', 104400000, ARRAY['beige','black'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0625358003.webp','/img/products/hm-0625358005.webp'], true, 'Đầm cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Dress — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in beige, black to complement your wardrobe.'),
  (1054, 'women', 'Đầm phom ôm', 'Tailored Dress', 'w-dresses', 90200000, ARRAY['navy','white','black'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0615524001.webp','/img/products/hm-0615524002.webp','/img/products/hm-0615524003.webp'], false, 'Đầm phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu xanh navy, trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Dress — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in navy, white, black to complement your wardrobe.'),
  (1055, 'women', 'Đầm dáng cổ điển', 'Classic Dress', 'w-dresses', 102200000, ARRAY['black','grey','navy'], ARRAY['S','M'], ARRAY['/img/products/hm-0859077005.webp','/img/products/hm-0859077008.webp','/img/products/hm-0859077013.webp'], false, 'Đầm dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Dress — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, grey, navy to complement your wardrobe.'),
  (1056, 'women', 'Đầm phom ôm', 'Tailored Dress', 'w-dresses', 60400000, ARRAY['black','navy','white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0877014001.webp','/img/products/hm-0877014007.webp','/img/products/hm-0877014008.webp'], true, 'Đầm phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Dress — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, navy, white to complement your wardrobe.'),
  (1057, 'women', 'Đầm phom ôm', 'Tailored Dress', 'w-dresses', 68700000, ARRAY['black','navy','white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0745475001.webp','/img/products/hm-0745475003.webp','/img/products/hm-0745475004.webp'], false, 'Đầm phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Dress — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, navy, white to complement your wardrobe.'),
  (1058, 'women', 'Đầm bản mềm', 'Soft Dress', 'w-dresses', 73500000, ARRAY['navy','grey'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0767799002.webp','/img/products/hm-0767799003.webp'], true, 'Đầm bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Dress — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in navy, grey to complement your wardrobe.'),
  (1059, 'women', 'Đầm phom rộng', 'Oversized Dress', 'w-dresses', 117700000, ARRAY['black'], ARRAY['XS','S','M'], ARRAY['/img/products/hm-0649397003.webp'], true, 'Đầm phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Dress — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black to complement your wardrobe.'),
  (1060, 'women', 'Áo blouse cắt may tối giản', 'Minimal Blouse', 'w-tops', 13300000, ARRAY['black','white'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0695632001.webp','/img/products/hm-0695632002.webp'], false, 'Áo blouse cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Blouse — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white to complement your wardrobe.'),
  (1061, 'women', 'Áo hai dây cắt may tối giản', 'Minimal Vest Top', 'w-tops', 23500000, ARRAY['white','grey'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0534164001.webp','/img/products/hm-0534164002.webp'], true, 'Áo hai dây cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Vest Top — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, grey to complement your wardrobe.'),
  (1062, 'women', 'Áo kiểu dáng suông', 'Relaxed Top', 'w-tops', 18700000, ARRAY['black','burgundy','white'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0664074001.webp','/img/products/hm-0664074003.webp','/img/products/hm-0664074005.webp'], false, 'Áo kiểu dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, đỏ mận, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Top — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, burgundy, white to complement your wardrobe.'),
  (1063, 'women', 'Áo hai dây cắt may tối giản', 'Minimal Vest Top', 'w-tops', 21500000, ARRAY['white','beige','black'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0716672001.webp','/img/products/hm-0716672002.webp','/img/products/hm-0716672003.webp'], false, 'Áo hai dây cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Vest Top — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, beige, black to complement your wardrobe.'),
  (1064, 'women', 'Áo blouse dáng cổ điển', 'Classic Blouse', 'w-tops', 22100000, ARRAY['white'], ARRAY['S','M','L','XL'], ARRAY['/img/products/hm-0616849006.webp'], false, 'Áo blouse dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Blouse — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white to complement your wardrobe.'),
  (1065, 'women', 'Áo kiểu dáng cổ điển', 'Classic Top', 'w-tops', 21800000, ARRAY['black','white','navy'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0770315005.webp','/img/products/hm-0770315006.webp','/img/products/hm-0770315009.webp'], false, 'Áo kiểu dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Top — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white, navy to complement your wardrobe.'),
  (1066, 'women', 'Áo hai dây phom ôm', 'Tailored Vest Top', 'w-tops', 15800000, ARRAY['black','white','grey'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0565379001.webp','/img/products/hm-0565379002.webp','/img/products/hm-0565379003.webp'], false, 'Áo hai dây phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Vest Top — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white, grey to complement your wardrobe.'),
  (1067, 'women', 'Áo kiểu phom ôm', 'Tailored Top', 'w-tops', 18300000, ARRAY['white','black'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0458924001.webp','/img/products/hm-0458924002.webp'], false, 'Áo kiểu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Top — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, black to complement your wardrobe.'),
  (1068, 'women', 'Áo hai dây cắt may tối giản', 'Minimal Vest Top', 'w-tops', 12400000, ARRAY['white','navy','black'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0513373002.webp','/img/products/hm-0513373007.webp','/img/products/hm-0513373008.webp'], false, 'Áo hai dây cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Vest Top — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, navy, black to complement your wardrobe.'),
  (1069, 'women', 'Áo hai dây phom rộng', 'Oversized Vest Top', 'w-tops', 30000000, ARRAY['black','white','beige'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0749699001.webp','/img/products/hm-0749699002.webp','/img/products/hm-0749699007.webp'], false, 'Áo hai dây phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng, be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Vest Top — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white, beige to complement your wardrobe.'),
  (1070, 'women', 'Áo cardigan phom ôm', 'Tailored Cardigan', 'w-knit', 30800000, ARRAY['black','navy','white'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0579541001.webp','/img/products/hm-0579541004.webp','/img/products/hm-0579541007.webp'], false, 'Áo cardigan phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Cardigan — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, navy, white to complement your wardrobe.'),
  (1071, 'women', 'Áo len dáng cổ điển', 'Classic Sweater', 'w-knit', 32500000, ARRAY['grey','black','navy'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0673677001.webp','/img/products/hm-0673677002.webp','/img/products/hm-0673677003.webp'], false, 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, black, navy to complement your wardrobe.'),
  (1072, 'women', 'Áo len bản mềm', 'Soft Sweater', 'w-knit', 42200000, ARRAY['grey'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0519749004.webp'], false, 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey to complement your wardrobe.'),
  (1073, 'women', 'Áo len bản mềm', 'Soft Sweater', 'w-knit', 40700000, ARRAY['grey','black'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0504154001.webp','/img/products/hm-0504154010.webp'], true, 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, black to complement your wardrobe.'),
  (1074, 'women', 'Áo len dáng suông', 'Relaxed Sweater', 'w-knit', 43800000, ARRAY['grey','black','navy'], ARRAY['XS','L','XL'], ARRAY['/img/products/hm-0591334002.webp','/img/products/hm-0591334003.webp','/img/products/hm-0591334010.webp'], false, 'Áo len dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Sweater — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, black, navy to complement your wardrobe.'),
  (1075, 'women', 'Áo len dáng cổ điển', 'Classic Sweater', 'w-knit', 24800000, ARRAY['black','navy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0637515002.webp','/img/products/hm-0637515003.webp'], true, 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, navy to complement your wardrobe.'),
  (1076, 'women', 'Áo len phom ôm', 'Tailored Sweater', 'w-knit', 38300000, ARRAY['white','beige','black'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0678942003.webp','/img/products/hm-0678942022.webp','/img/products/hm-0678942023.webp'], false, 'Áo len phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu trắng, be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Sweater — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in white, beige, black to complement your wardrobe.'),
  (1077, 'women', 'Áo len bản mềm', 'Soft Sweater', 'w-knit', 38700000, ARRAY['white'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0693242003.webp'], false, 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in white to complement your wardrobe.'),
  (1078, 'women', 'Áo len phom rộng', 'Oversized Sweater', 'w-knit', 26400000, ARRAY['grey','navy','black'], ARRAY['S','M','L','XL'], ARRAY['/img/products/hm-0628979001.webp','/img/products/hm-0628979002.webp','/img/products/hm-0628979003.webp'], true, 'Áo len phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Sweater — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, navy, black to complement your wardrobe.'),
  (1079, 'women', 'Áo len phom ôm', 'Tailored Sweater', 'w-knit', 44900000, ARRAY['navy','grey','black'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0496111004.webp','/img/products/hm-0496111007.webp','/img/products/hm-0496111017.webp'], false, 'Áo len phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xanh navy, xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Sweater — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in navy, grey, black to complement your wardrobe.'),
  (1080, 'women', 'Áo măng tô dáng cổ điển', 'Classic Coat', 'w-jackets', 68100000, ARRAY['black','grey'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0534181002.webp','/img/products/hm-0534181006.webp'], false, 'Áo măng tô dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Coat — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, grey to complement your wardrobe.'),
  (1081, 'women', 'Áo vest phom ôm', 'Tailored Blazer', 'w-jackets', 66500000, ARRAY['black','navy','grey'], ARRAY['XS','M','L'], ARRAY['/img/products/hm-0568601006.webp','/img/products/hm-0568601007.webp','/img/products/hm-0568601008.webp'], false, 'Áo vest phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Blazer — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, grey to complement your wardrobe.'),
  (1082, 'women', 'Áo vest bản mềm', 'Soft Blazer', 'w-jackets', 80000000, ARRAY['grey','beige','white'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0708138002.webp','/img/products/hm-0708138004.webp','/img/products/hm-0708138012.webp'], false, 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, be, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, beige, white to complement your wardrobe.'),
  (1083, 'women', 'Áo vest bản mềm', 'Soft Blazer', 'w-jackets', 52200000, ARRAY['black','navy','white'], ARRAY['M','L'], ARRAY['/img/products/hm-0636455003.webp','/img/products/hm-0636455004.webp','/img/products/hm-0636455007.webp'], false, 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, white to complement your wardrobe.'),
  (1084, 'women', 'Áo vest phom ôm', 'Tailored Blazer', 'w-jackets', 112200000, ARRAY['white','black'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0728156001.webp','/img/products/hm-0728156006.webp'], false, 'Áo vest phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Blazer — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in white, black to complement your wardrobe.'),
  (1085, 'women', 'Áo vest phom ôm', 'Tailored Blazer', 'w-jackets', 120300000, ARRAY['black','beige','burgundy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0578487002.webp','/img/products/hm-0578487004.webp','/img/products/hm-0578487011.webp'], false, 'Áo vest phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, be, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Blazer — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, beige, burgundy to complement your wardrobe.'),
  (1086, 'women', 'Áo khoác phom rộng', 'Oversized Jacket', 'w-jackets', 103700000, ARRAY['black','grey'], ARRAY['XS','S','M','L','XL'], ARRAY['/img/products/hm-0884465001.webp','/img/products/hm-0884465002.webp'], false, 'Áo khoác phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Jacket — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, grey to complement your wardrobe.'),
  (1087, 'women', 'Áo vest dáng cổ điển', 'Classic Blazer', 'w-jackets', 109000000, ARRAY['grey','beige','black'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0675319001.webp','/img/products/hm-0675319002.webp','/img/products/hm-0675319004.webp'], true, 'Áo vest dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Blazer — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, beige, black to complement your wardrobe.'),
  (1088, 'women', 'Áo khoác bản mềm', 'Soft Jacket', 'w-jackets', 62200000, ARRAY['grey','white','black'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0784276002.webp','/img/products/hm-0784276003.webp','/img/products/hm-0784276004.webp'], true, 'Áo khoác bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Jacket — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, white, black to complement your wardrobe.'),
  (1089, 'women', 'Áo vest dáng suông', 'Relaxed Blazer', 'w-jackets', 138700000, ARRAY['black','navy','white'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0705258001.webp','/img/products/hm-0705258002.webp','/img/products/hm-0705258008.webp'], true, 'Áo vest dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Blazer — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, white to complement your wardrobe.'),
  (1090, 'women', 'Chân váy phom ôm', 'Tailored Skirt', 'w-skirts', 21000000, ARRAY['navy','black','white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0639838001.webp','/img/products/hm-0639838002.webp','/img/products/hm-0639838003.webp'], true, 'Chân váy phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xanh navy, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Skirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in navy, black, white to complement your wardrobe.'),
  (1091, 'women', 'Chân váy bản mềm', 'Soft Skirt', 'w-skirts', 41200000, ARRAY['black','burgundy','white'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0652731001.webp','/img/products/hm-0652731003.webp','/img/products/hm-0652731006.webp'], true, 'Chân váy bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đen, đỏ mận, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Skirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in black, burgundy, white to complement your wardrobe.'),
  (1092, 'women', 'Chân váy cắt may tối giản', 'Minimal Skirt', 'w-skirts', 35000000, ARRAY['black','navy'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0851400001.webp','/img/products/hm-0851400009.webp'], true, 'Chân váy cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Skirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in black, navy to complement your wardrobe.'),
  (1093, 'women', 'Chân váy cắt may tối giản', 'Minimal Skirt', 'w-skirts', 40200000, ARRAY['black','white'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0607154001.webp','/img/products/hm-0607154014.webp'], true, 'Chân váy cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Skirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in black, white to complement your wardrobe.'),
  (1094, 'women', 'Chân váy phom rộng', 'Oversized Skirt', 'w-skirts', 31100000, ARRAY['navy','beige','white'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0599719002.webp','/img/products/hm-0599719006.webp','/img/products/hm-0599719008.webp'], false, 'Chân váy phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xanh navy, be, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Skirt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in navy, beige, white to complement your wardrobe.'),
  (1095, 'women', 'Chân váy bản mềm', 'Soft Skirt', 'w-skirts', 31900000, ARRAY['burgundy','black','white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0873884003.webp','/img/products/hm-0873884005.webp','/img/products/hm-0873884006.webp'], false, 'Chân váy bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đỏ mận, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Skirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in burgundy, black, white to complement your wardrobe.'),
  (1096, 'women', 'Chân váy phom rộng', 'Oversized Skirt', 'w-skirts', 43800000, ARRAY['beige','black','grey'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/hm-0858856001.webp','/img/products/hm-0858856002.webp','/img/products/hm-0858856004.webp'], false, 'Chân váy phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu be, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Skirt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in beige, black, grey to complement your wardrobe.'),
  (1097, 'women', 'Chân váy dáng suông', 'Relaxed Skirt', 'w-skirts', 26900000, ARRAY['navy','black','white'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0658304001.webp','/img/products/hm-0658304003.webp','/img/products/hm-0658304004.webp'], true, 'Chân váy dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xanh navy, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Skirt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in navy, black, white to complement your wardrobe.'),
  (1098, 'women', 'Chân váy dáng suông', 'Relaxed Skirt', 'w-skirts', 44300000, ARRAY['white','black'], ARRAY['XS','S','M'], ARRAY['/img/products/hm-0734077001.webp','/img/products/hm-0734077002.webp'], false, 'Chân váy dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Skirt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in white, black to complement your wardrobe.'),
  (1099, 'women', 'Chân váy dáng cổ điển', 'Classic Skirt', 'w-skirts', 43800000, ARRAY['grey','beige'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0655710006.webp','/img/products/hm-0655710008.webp'], false, 'Chân váy dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xám, be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Skirt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in grey, beige to complement your wardrobe.'),
  (1100, 'women', 'Quần âu cắt may tối giản', 'Minimal Trousers', 'w-trousers', 29500000, ARRAY['black','navy','beige'], ARRAY['S','M','L'], ARRAY['/img/products/hm-0568597006.webp','/img/products/hm-0568597007.webp','/img/products/hm-0568597008.webp'], true, 'Quần âu cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy, be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Trousers — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy, beige to complement your wardrobe.'),
  (1101, 'women', 'Quần âu phom ôm', 'Tailored Trousers', 'w-trousers', 42700000, ARRAY['black','burgundy','silver'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/hm-0779781001.webp','/img/products/hm-0779781002.webp','/img/products/hm-0779781005.webp'], false, 'Quần âu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, đỏ mận, bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, burgundy, silver to complement your wardrobe.'),
  (1102, 'women', 'Quần âu dáng cổ điển', 'Classic Trousers', 'w-trousers', 39800000, ARRAY['navy','black'], ARRAY['XS','S','M'], ARRAY['/img/products/hm-0660712002.webp','/img/products/hm-0660712003.webp'], true, 'Quần âu dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Trousers — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in navy, black to complement your wardrobe.'),
  (1103, 'women', 'Quần âu bản mềm', 'Soft Trousers', 'w-trousers', 33100000, ARRAY['black'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/hm-0655784001.webp'], false, 'Quần âu bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Trousers — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black to complement your wardrobe.'),
  (1104, 'women', 'Quần lửng dáng suông', 'Relaxed Cropped Trousers', 'w-trousers', 38100000, ARRAY['black'], ARRAY['S','M','L'], ARRAY['/img/products/my-31464.webp'], false, 'Quần lửng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Cropped Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black to complement your wardrobe.'),
  (1105, 'women', 'Quần lửng phom rộng', 'Oversized Cropped Trousers', 'w-trousers', 33400000, ARRAY['grey'], ARRAY['S','M','L'], ARRAY['/img/products/my-15338.webp'], false, 'Quần lửng phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Cropped Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in grey to complement your wardrobe.'),
  (1106, 'women', 'Quần lửng dáng cổ điển', 'Classic Cropped Trousers', 'w-trousers', 30000000, ARRAY['white'], ARRAY['XS','S','L','XL'], ARRAY['/img/products/my-27230.webp'], false, 'Quần lửng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Cropped Trousers — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in white to complement your wardrobe.'),
  (1107, 'women', 'Quần lửng phom ôm', 'Tailored Cropped Trousers', 'w-trousers', 42200000, ARRAY['navy'], ARRAY['XS','S','M','XL'], ARRAY['/img/products/my-5014.webp'], false, 'Quần lửng phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Cropped Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in navy to complement your wardrobe.'),
  (1108, 'women', 'Quần lửng dáng suông', 'Relaxed Cropped Trousers', 'w-trousers', 32400000, ARRAY['black'], ARRAY['XS','S','M','L','XL'], ARRAY['/img/products/my-28521.webp'], false, 'Quần lửng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Cropped Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black to complement your wardrobe.'),
  (1109, 'women', 'Quần lửng cắt may tối giản', 'Minimal Cropped Trousers', 'w-trousers', 36700000, ARRAY['grey'], ARRAY['XS','M','L','XL'], ARRAY['/img/products/my-17926.webp'], false, 'Quần lửng cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Cropped Trousers — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in grey to complement your wardrobe.'),
  (1110, 'bags', 'Túi xách tay phom ôm', 'Tailored Handbag', 'b-bags', 44300000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-35913.webp'], false, 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in black to complement your wardrobe.'),
  (1111, 'bags', 'Túi xách tay cắt may tối giản', 'Minimal Handbag', 'b-bags', 49600000, ARRAY['grey'], '{}'::text[], ARRAY['/img/products/my-10209.webp'], false, 'Túi xách tay cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Handbag — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in grey to complement your wardrobe.'),
  (1112, 'bags', 'Túi xách tay phom ôm', 'Tailored Handbag', 'b-bags', 89700000, ARRAY['brown'], '{}'::text[], ARRAY['/img/products/my-17132.webp'], false, 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in brown to complement your wardrobe.'),
  (1113, 'bags', 'Túi xách tay phom ôm', 'Tailored Handbag', 'b-bags', 78200000, ARRAY['beige'], '{}'::text[], ARRAY['/img/products/my-54000.webp'], false, 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in beige to complement your wardrobe.'),
  (1114, 'bags', 'Túi xách tay bản mềm', 'Soft Handbag', 'b-bags', 71700000, ARRAY['silver'], '{}'::text[], ARRAY['/img/products/my-9004.webp'], false, 'Túi xách tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Handbag — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in silver to complement your wardrobe.'),
  (1115, 'bags', 'Túi xách tay cắt may tối giản', 'Minimal Handbag', 'b-bags', 59000000, ARRAY['white'], '{}'::text[], ARRAY['/img/products/my-27668.webp'], false, 'Túi xách tay cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Handbag — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in white to complement your wardrobe.'),
  (1116, 'bags', 'Túi xách tay dáng cổ điển', 'Classic Handbag', 'b-bags', 77500000, ARRAY['navy'], '{}'::text[], ARRAY['/img/products/my-58274.webp'], false, 'Túi xách tay dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Handbag — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in navy to complement your wardrobe.'),
  (1117, 'bags', 'Túi xách tay dáng suông', 'Relaxed Handbag', 'b-bags', 34000000, ARRAY['burgundy'], '{}'::text[], ARRAY['/img/products/my-18163.webp'], false, 'Túi xách tay dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Handbag — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in burgundy to complement your wardrobe.'),
  (1118, 'bags', 'Túi xách tay phom ôm', 'Tailored Handbag', 'b-bags', 38200000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-49567.webp'], false, 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in black to complement your wardrobe.'),
  (1119, 'bags', 'Túi xách tay bản mềm', 'Soft Handbag', 'b-bags', 51400000, ARRAY['grey'], '{}'::text[], ARRAY['/img/products/my-58189.webp'], false, 'Túi xách tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Handbag — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in grey to complement your wardrobe.'),
  (1120, 'bags', 'Ví cầm tay phom rộng', 'Oversized Clutch', 'b-wallet', 13800000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-52565.webp'], false, 'Ví cầm tay phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Clutch — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in black to complement your wardrobe.'),
  (1121, 'bags', 'Ví da phom rộng', 'Oversized Wallet', 'b-wallet', 21500000, ARRAY['brown'], '{}'::text[], ARRAY['/img/products/my-41277.webp'], false, 'Ví da phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Wallet — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in brown to complement your wardrobe.'),
  (1122, 'bags', 'Ví da cắt may tối giản', 'Minimal Wallet', 'b-wallet', 26400000, ARRAY['grey'], '{}'::text[], ARRAY['/img/products/my-36537.webp'], false, 'Ví da cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Wallet — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in grey to complement your wardrobe.'),
  (1123, 'bags', 'Ví da dáng cổ điển', 'Classic Wallet', 'b-wallet', 25200000, ARRAY['white'], '{}'::text[], ARRAY['/img/products/my-20625.webp'], false, 'Ví da dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Wallet — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in white to complement your wardrobe.'),
  (1124, 'bags', 'Ví cầm tay phom ôm', 'Tailored Clutch', 'b-wallet', 18600000, ARRAY['silver'], '{}'::text[], ARRAY['/img/products/my-25113.webp'], false, 'Ví cầm tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Clutch — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in silver to complement your wardrobe.'),
  (1125, 'bags', 'Ví da dáng cổ điển', 'Classic Wallet', 'b-wallet', 31200000, ARRAY['navy'], '{}'::text[], ARRAY['/img/products/my-58237.webp'], false, 'Ví da dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Wallet — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in navy to complement your wardrobe.'),
  (1126, 'bags', 'Ví cầm tay bản mềm', 'Soft Clutch', 'b-wallet', 12800000, ARRAY['beige'], '{}'::text[], ARRAY['/img/products/my-16750.webp'], false, 'Ví cầm tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Clutch — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in beige to complement your wardrobe.'),
  (1127, 'bags', 'Ví cầm tay bản mềm', 'Soft Clutch', 'b-wallet', 19900000, ARRAY['gold'], '{}'::text[], ARRAY['/img/products/my-58270.webp'], false, 'Ví cầm tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu vàng gold giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Clutch — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in gold to complement your wardrobe.'),
  (1128, 'bags', 'Ví cầm tay phom rộng', 'Oversized Clutch', 'b-wallet', 26300000, ARRAY['burgundy'], '{}'::text[], ARRAY['/img/products/my-16744.webp'], false, 'Ví cầm tay phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Clutch — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in burgundy to complement your wardrobe.'),
  (1129, 'bags', 'Ví da cắt may tối giản', 'Minimal Wallet', 'b-wallet', 14100000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-43391.webp'], false, 'Ví da cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Wallet — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in black to complement your wardrobe.'),
  (1130, 'bags', 'Thắt lưng cắt may tối giản', 'Minimal Belt', 'b-belt', 10300000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-58466.webp'], false, 'Thắt lưng cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Belt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in black to complement your wardrobe.'),
  (1131, 'bags', 'Thắt lưng dáng cổ điển', 'Classic Belt', 'b-belt', 16200000, ARRAY['brown'], '{}'::text[], ARRAY['/img/products/my-17071.webp'], false, 'Thắt lưng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Belt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in brown to complement your wardrobe.'),
  (1132, 'bags', 'Thắt lưng phom ôm', 'Tailored Belt', 'b-belt', 23100000, ARRAY['grey'], '{}'::text[], ARRAY['/img/products/my-20070.webp'], false, 'Thắt lưng phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Belt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in grey to complement your wardrobe.'),
  (1133, 'bags', 'Thắt lưng dáng suông', 'Relaxed Belt', 'b-belt', 10700000, ARRAY['white'], '{}'::text[], ARRAY['/img/products/my-41530.webp'], false, 'Thắt lưng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Belt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in white to complement your wardrobe.'),
  (1134, 'bags', 'Thắt lưng cắt may tối giản', 'Minimal Belt', 'b-belt', 23600000, ARRAY['silver'], '{}'::text[], ARRAY['/img/products/my-16993.webp'], false, 'Thắt lưng cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Belt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in silver to complement your wardrobe.'),
  (1135, 'bags', 'Thắt lưng dáng cổ điển', 'Classic Belt', 'b-belt', 14400000, ARRAY['navy'], '{}'::text[], ARRAY['/img/products/my-34545.webp'], false, 'Thắt lưng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Belt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in navy to complement your wardrobe.'),
  (1136, 'bags', 'Thắt lưng dáng suông', 'Relaxed Belt', 'b-belt', 11000000, ARRAY['beige'], '{}'::text[], ARRAY['/img/products/my-51254.webp'], false, 'Thắt lưng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Relaxed Belt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in beige to complement your wardrobe.'),
  (1137, 'bags', 'Thắt lưng phom ôm', 'Tailored Belt', 'b-belt', 24800000, ARRAY['gold'], '{}'::text[], ARRAY['/img/products/my-42916.webp'], false, 'Thắt lưng phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu vàng gold giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Tailored Belt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in gold to complement your wardrobe.'),
  (1138, 'bags', 'Thắt lưng phom rộng', 'Oversized Belt', 'b-belt', 15000000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-42942.webp'], false, 'Thắt lưng phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Belt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in black to complement your wardrobe.'),
  (1139, 'bags', 'Thắt lưng bản mềm', 'Soft Belt', 'b-belt', 26700000, ARRAY['brown'], '{}'::text[], ARRAY['/img/products/my-19210.webp'], false, 'Thắt lưng bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Belt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in brown to complement your wardrobe.'),
  (1140, 'bags', 'Kính mát phom rộng', 'Oversized Sunglasses', 'b-scarf', 10100000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-38177.webp'], false, 'Kính mát phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Sunglasses — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in black to complement your wardrobe.'),
  (1141, 'bags', 'Khăn choàng dáng cổ điển', 'Classic Scarf', 'b-scarf', 20100000, ARRAY['brown'], '{}'::text[], ARRAY['/img/products/my-38306.webp'], false, 'Khăn choàng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Scarf — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in brown to complement your wardrobe.'),
  (1142, 'bags', 'Khăn choàng dáng cổ điển', 'Classic Scarf', 'b-scarf', 23700000, ARRAY['grey'], '{}'::text[], ARRAY['/img/products/my-23469.webp'], false, 'Khăn choàng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Scarf — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in grey to complement your wardrobe.'),
  (1143, 'bags', 'Kính mát dáng cổ điển', 'Classic Sunglasses', 'b-scarf', 21800000, ARRAY['white'], '{}'::text[], ARRAY['/img/products/my-48225.webp'], false, 'Kính mát dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Sunglasses — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in white to complement your wardrobe.'),
  (1144, 'bags', 'Kính mát dáng cổ điển', 'Classic Sunglasses', 'b-scarf', 11000000, ARRAY['silver'], '{}'::text[], ARRAY['/img/products/my-21350.webp'], false, 'Kính mát dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Classic Sunglasses — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in silver to complement your wardrobe.'),
  (1145, 'bags', 'Kính mát cắt may tối giản', 'Minimal Sunglasses', 'b-scarf', 10700000, ARRAY['gold'], '{}'::text[], ARRAY['/img/products/my-38214.webp'], false, 'Kính mát cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu vàng gold giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Sunglasses — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in gold to complement your wardrobe.'),
  (1146, 'bags', 'Khăn choàng phom rộng', 'Oversized Scarf', 'b-scarf', 15000000, ARRAY['navy'], '{}'::text[], ARRAY['/img/products/my-12746.webp'], false, 'Khăn choàng phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Scarf — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in navy to complement your wardrobe.'),
  (1147, 'bags', 'Khăn choàng bản mềm', 'Soft Scarf', 'b-scarf', 24400000, ARRAY['beige'], '{}'::text[], ARRAY['/img/products/my-23467.webp'], false, 'Khăn choàng bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Soft Scarf — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in beige to complement your wardrobe.'),
  (1148, 'bags', 'Kính mát cắt may tối giản', 'Minimal Sunglasses', 'b-scarf', 24700000, ARRAY['black'], '{}'::text[], ARRAY['/img/products/my-30285.webp'], false, 'Kính mát cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Minimal Sunglasses — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in black to complement your wardrobe.'),
  (1149, 'bags', 'Kính mát phom rộng', 'Oversized Sunglasses', 'b-scarf', 19100000, ARRAY['brown'], '{}'::text[], ARRAY['/img/products/my-17335.webp'], false, 'Kính mát phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.', 'Oversized Sunglasses — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in brown to complement your wardrobe.')
on conflict (id) do update set department = excluded.department, name_vi = excluded.name_vi, name_en = excluded.name_en, category = excluded.category, price = excluded.price, colors = excluded.colors, sizes = excluded.sizes, images = excluded.images, is_new = excluded.is_new, description = excluded.description, description_en = excluded.description_en;
