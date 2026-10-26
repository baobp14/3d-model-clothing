-- Đặt lại giá các sản phẩm lấy từ bộ dữ liệu quần áo về mức bán lẻ thực tế (VND).
-- Trước đây giá được chép từ catalog cũ nên lên tới 9-44 triệu đồng cho một áo thun.
-- Chỉ đổi sản phẩm có trong shop_dataset_products; giá trong các đơn cũ giữ nguyên.
-- Chạy được trên SQLite và PostgreSQL, chạy lại nhiều lần cho kết quả như nhau.
-- Khoảng giá giống PRICE_BANDS trong backend/app/import_clothing.py.

update products
set price = case category
    when 'm-tshirts'  then 199000 + 30000 * (id % 6)
    when 'm-shirts'   then 349000 + 30000 * (id % 6)
    when 'm-trousers' then 249000 + 50000 * (id % 5)
    when 'w-skirts'   then 299000 + 30000 * (id % 6)
    else price
end
where id in (select product_id from shop_dataset_products)
  and category in ('m-tshirts', 'm-shirts', 'm-trousers', 'w-skirts');
