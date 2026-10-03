-- Cập nhật loại mesh 3D (products.tryon_kind) sau khi phần 3D có thêm
-- sơ mi dài tay, áo len, áo khoác, đầm. Chạy lại nhiều lần không lỗi.
-- Đã gộp vào nb_full_schema.sql; file này chỉ dành cho database ĐÃ chạy bản cũ.

begin;

alter table products drop constraint if exists products_tryon_kind_check;
alter table products add constraint products_tryon_kind_check
  check (tryon_kind in ('tshirt', 'tank', 'croptop', 'shirt', 'longshirt',
                        'sweater', 'jacket', 'dress',
                        'pants', 'shorts', 'capri', 'skirt'));

-- Sơ mi → dài tay; polo giữ 'shirt' (tay ngắn, có cổ).
update products set tryon_kind = 'longshirt'
  where category = 'm-shirts' and name_vi ilike 'áo sơ mi%' and tryon_kind = 'shirt';
-- Áo len, hoodie → áo len.
update products set tryon_kind = 'sweater'
  where category in ('m-knit', 'w-knit') and tryon_kind is null;
-- Vest, măng tô, áo khoác → áo khoác.
update products set tryon_kind = 'jacket'
  where category in ('m-jackets', 'w-jackets') and tryon_kind is null;
update products set tryon_kind = 'dress'
  where category = 'w-dresses' and tryon_kind is null;

commit;
