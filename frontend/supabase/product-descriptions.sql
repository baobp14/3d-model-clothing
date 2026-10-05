alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists description_en text not null default '';

update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo sơ mi phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu trắng, xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Shirt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in white, navy, grey to complement your wardrobe.' else description_en end where id = 1000 and name_vi = 'Áo sơ mi phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo polo cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu xám, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Polo Shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers for work or jeans for a weekend outing.
Available in grey, black, white to complement your wardrobe.' else description_en end where id = 1001 and name_vi = 'Áo polo cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo polo phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu đỏ mận, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Polo Shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers for work or jeans for a weekend outing.
Available in burgundy, grey, navy to complement your wardrobe.' else description_en end where id = 1002 and name_vi = 'Áo polo phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo polo cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu xám, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Polo Shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers for work or jeans for a weekend outing.
Available in grey, black, white to complement your wardrobe.' else description_en end where id = 1003 and name_vi = 'Áo polo cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo sơ mi bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in white, navy to complement your wardrobe.' else description_en end where id = 1004 and name_vi = 'Áo sơ mi bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo sơ mi cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu trắng, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in white, black, grey to complement your wardrobe.' else description_en end where id = 1005 and name_vi = 'Áo sơ mi cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo polo dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu đen, đỏ mận, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Polo Shirt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with trousers for work or jeans for a weekend outing.
Available in black, burgundy, navy to complement your wardrobe.' else description_en end where id = 1006 and name_vi = 'Áo polo dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo polo phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu trắng, xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Polo Shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers for work or jeans for a weekend outing.
Available in white, grey, black to complement your wardrobe.' else description_en end where id = 1007 and name_vi = 'Áo polo phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo polo bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.
Các lựa chọn màu xanh navy, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Polo Shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with trousers for work or jeans for a weekend outing.
Available in navy, white, grey to complement your wardrobe.' else description_en end where id = 1008 and name_vi = 'Áo polo bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo sơ mi bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.
Available in black, navy, white to complement your wardrobe.' else description_en end where id = 1009 and name_vi = 'Áo sơ mi bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, grey, white to complement your wardrobe.' else description_en end where id = 1010 and name_vi = 'Áo thun phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft T-shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in grey, black to complement your wardrobe.' else description_en end where id = 1011 and name_vi = 'Áo thun bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.' else description_en end where id = 1012 and name_vi = 'Áo thun phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic T-shirt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, navy to complement your wardrobe.' else description_en end where id = 1013 and name_vi = 'Áo thun dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.' else description_en end where id = 1014 and name_vi = 'Áo thun phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic T-shirt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.' else description_en end where id = 1015 and name_vi = 'Áo thun dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu trắng, đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored T-shirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in white, black, navy to complement your wardrobe.' else description_en end where id = 1016 and name_vi = 'Áo thun phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu trắng, xanh navy, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal T-shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in white, navy, burgundy to complement your wardrobe.' else description_en end where id = 1017 and name_vi = 'Áo thun cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft T-shirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in black, white, grey to complement your wardrobe.' else description_en end where id = 1018 and name_vi = 'Áo thun bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo thun cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.
Các lựa chọn màu trắng, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal T-shirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.
Available in white, black, grey to complement your wardrobe.' else description_en end where id = 1019 and name_vi = 'Áo thun cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, navy to complement your wardrobe.' else description_en end where id = 1020 and name_vi = 'Áo len dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đỏ mận, đen, be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Sweater — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in burgundy, black, beige to complement your wardrobe.' else description_en end where id = 1021 and name_vi = 'Áo len cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu trắng, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in white, grey, navy to complement your wardrobe.' else description_en end where id = 1022 and name_vi = 'Áo len bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo hoodie cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Hoodie — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, white to complement your wardrobe.' else description_en end where id = 1023 and name_vi = 'Áo hoodie cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in navy, grey to complement your wardrobe.' else description_en end where id = 1024 and name_vi = 'Áo len bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Sweater — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey to complement your wardrobe.' else description_en end where id = 1025 and name_vi = 'Áo len dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, white to complement your wardrobe.' else description_en end where id = 1026 and name_vi = 'Áo len dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo hoodie dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xám, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Hoodie — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, grey, white to complement your wardrobe.' else description_en end where id = 1027 and name_vi = 'Áo hoodie dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Sweater — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, navy, black to complement your wardrobe.' else description_en end where id = 1028 and name_vi = 'Áo len phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, be, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Sweater — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, beige, grey to complement your wardrobe.' else description_en end where id = 1029 and name_vi = 'Áo len dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, xanh navy, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Blazer — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, navy, burgundy to complement your wardrobe.' else description_en end where id = 1030 and name_vi = 'Áo vest cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo khoác phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Jacket — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1031 and name_vi = 'Áo khoác phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xanh navy, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in navy, black, grey to complement your wardrobe.' else description_en end where id = 1032 and name_vi = 'Áo vest bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo măng tô bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Coat — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1033 and name_vi = 'Áo măng tô bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu trắng, xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in white, navy, grey to complement your wardrobe.' else description_en end where id = 1034 and name_vi = 'Áo vest bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo măng tô phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Coat — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, navy, black to complement your wardrobe.' else description_en end where id = 1035 and name_vi = 'Áo măng tô phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo khoác phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Jacket — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, grey to complement your wardrobe.' else description_en end where id = 1036 and name_vi = 'Áo khoác phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo măng tô cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Coat — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in navy, black to complement your wardrobe.' else description_en end where id = 1037 and name_vi = 'Áo măng tô cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Blazer — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, beige to complement your wardrobe.' else description_en end where id = 1038 and name_vi = 'Áo vest dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo khoác cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Jacket — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1039 and name_vi = 'Áo khoác cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Trousers — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, white, navy to complement your wardrobe.' else description_en end where id = 1040 and name_vi = 'Quần âu bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xám, xanh navy, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in grey, navy, burgundy to complement your wardrobe.' else description_en end where id = 1041 and name_vi = 'Quần âu phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, white to complement your wardrobe.' else description_en end where id = 1042 and name_vi = 'Quần âu dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1043 and name_vi = 'Quần âu phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu trắng, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Trousers — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in white, navy, black to complement your wardrobe.' else description_en end where id = 1044 and name_vi = 'Quần âu dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1045 and name_vi = 'Quần âu phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Trousers — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy, white to complement your wardrobe.' else description_en end where id = 1046 and name_vi = 'Quần âu bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1047 and name_vi = 'Quần âu phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in navy, grey to complement your wardrobe.' else description_en end where id = 1048 and name_vi = 'Quần âu phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1049 and name_vi = 'Quần âu dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Dress — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1050 and name_vi = 'Đầm dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Dress — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in navy, black to complement your wardrobe.' else description_en end where id = 1051 and name_vi = 'Đầm bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Dress — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, white to complement your wardrobe.' else description_en end where id = 1052 and name_vi = 'Đầm dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Dress — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in beige, black to complement your wardrobe.' else description_en end where id = 1053 and name_vi = 'Đầm cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu xanh navy, trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Dress — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in navy, white, black to complement your wardrobe.' else description_en end where id = 1054 and name_vi = 'Đầm phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xám, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Dress — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, grey, navy to complement your wardrobe.' else description_en end where id = 1055 and name_vi = 'Đầm dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Dress — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, navy, white to complement your wardrobe.' else description_en end where id = 1056 and name_vi = 'Đầm phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Dress — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black, navy, white to complement your wardrobe.' else description_en end where id = 1057 and name_vi = 'Đầm phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Dress — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in navy, grey to complement your wardrobe.' else description_en end where id = 1058 and name_vi = 'Đầm bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Đầm phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Dress — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.
Available in black to complement your wardrobe.' else description_en end where id = 1059 and name_vi = 'Đầm phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo blouse cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Blouse — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white to complement your wardrobe.' else description_en end where id = 1060 and name_vi = 'Áo blouse cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo hai dây cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Vest Top — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, grey to complement your wardrobe.' else description_en end where id = 1061 and name_vi = 'Áo hai dây cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo kiểu dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, đỏ mận, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Top — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, burgundy, white to complement your wardrobe.' else description_en end where id = 1062 and name_vi = 'Áo kiểu dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo hai dây cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Vest Top — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, beige, black to complement your wardrobe.' else description_en end where id = 1063 and name_vi = 'Áo hai dây cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo blouse dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Blouse — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white to complement your wardrobe.' else description_en end where id = 1064 and name_vi = 'Áo blouse dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo kiểu dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Top — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white, navy to complement your wardrobe.' else description_en end where id = 1065 and name_vi = 'Áo kiểu dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo hai dây phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Vest Top — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white, grey to complement your wardrobe.' else description_en end where id = 1066 and name_vi = 'Áo hai dây phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo kiểu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Top — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, black to complement your wardrobe.' else description_en end where id = 1067 and name_vi = 'Áo kiểu phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo hai dây cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu trắng, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Vest Top — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in white, navy, black to complement your wardrobe.' else description_en end where id = 1068 and name_vi = 'Áo hai dây cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo hai dây phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.
Các lựa chọn màu đen, trắng, be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Vest Top — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with trousers or a skirt for work, or jeans for coffee with friends.
Available in black, white, beige to complement your wardrobe.' else description_en end where id = 1069 and name_vi = 'Áo hai dây phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo cardigan phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Cardigan — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, navy, white to complement your wardrobe.' else description_en end where id = 1070 and name_vi = 'Áo cardigan phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, black, navy to complement your wardrobe.' else description_en end where id = 1071 and name_vi = 'Áo len dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey to complement your wardrobe.' else description_en end where id = 1072 and name_vi = 'Áo len bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, black to complement your wardrobe.' else description_en end where id = 1073 and name_vi = 'Áo len bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Sweater — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, black, navy to complement your wardrobe.' else description_en end where id = 1074 and name_vi = 'Áo len dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Sweater — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1075 and name_vi = 'Áo len dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu trắng, be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Sweater — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in white, beige, black to complement your wardrobe.' else description_en end where id = 1076 and name_vi = 'Áo len phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Sweater — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in white to complement your wardrobe.' else description_en end where id = 1077 and name_vi = 'Áo len bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xám, xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Sweater — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in grey, navy, black to complement your wardrobe.' else description_en end where id = 1078 and name_vi = 'Áo len phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo len phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.
Các lựa chọn màu xanh navy, xám, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Sweater — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or a skirt, adding a jacket on cooler days.
Available in navy, grey, black to complement your wardrobe.' else description_en end where id = 1079 and name_vi = 'Áo len phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo măng tô dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Coat — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, grey to complement your wardrobe.' else description_en end where id = 1080 and name_vi = 'Áo măng tô dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Blazer — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, grey to complement your wardrobe.' else description_en end where id = 1081 and name_vi = 'Áo vest phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, be, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, beige, white to complement your wardrobe.' else description_en end where id = 1082 and name_vi = 'Áo vest bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Blazer — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, white to complement your wardrobe.' else description_en end where id = 1083 and name_vi = 'Áo vest bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Blazer — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in white, black to complement your wardrobe.' else description_en end where id = 1084 and name_vi = 'Áo vest phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, be, đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Blazer — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, beige, burgundy to complement your wardrobe.' else description_en end where id = 1085 and name_vi = 'Áo vest phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo khoác phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Jacket — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, grey to complement your wardrobe.' else description_en end where id = 1086 and name_vi = 'Áo khoác phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, be, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Blazer — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, beige, black to complement your wardrobe.' else description_en end where id = 1087 and name_vi = 'Áo vest dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo khoác bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu xám, trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Jacket — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in grey, white, black to complement your wardrobe.' else description_en end where id = 1088 and name_vi = 'Áo khoác bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Áo vest dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.
Các lựa chọn màu đen, xanh navy, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Blazer — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.
Available in black, navy, white to complement your wardrobe.' else description_en end where id = 1089 and name_vi = 'Áo vest dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xanh navy, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Skirt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in navy, black, white to complement your wardrobe.' else description_en end where id = 1090 and name_vi = 'Chân váy phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đen, đỏ mận, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Skirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in black, burgundy, white to complement your wardrobe.' else description_en end where id = 1091 and name_vi = 'Chân váy bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đen, xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Skirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in black, navy to complement your wardrobe.' else description_en end where id = 1092 and name_vi = 'Chân váy cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Skirt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in black, white to complement your wardrobe.' else description_en end where id = 1093 and name_vi = 'Chân váy cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xanh navy, be, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Skirt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in navy, beige, white to complement your wardrobe.' else description_en end where id = 1094 and name_vi = 'Chân váy phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu đỏ mận, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Skirt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in burgundy, black, white to complement your wardrobe.' else description_en end where id = 1095 and name_vi = 'Chân váy bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu be, đen, xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Skirt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in beige, black, grey to complement your wardrobe.' else description_en end where id = 1096 and name_vi = 'Chân váy phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xanh navy, đen, trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Skirt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in navy, black, white to complement your wardrobe.' else description_en end where id = 1097 and name_vi = 'Chân váy dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu trắng, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Skirt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in white, black to complement your wardrobe.' else description_en end where id = 1098 and name_vi = 'Chân váy dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Chân váy dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.
Các lựa chọn màu xám, be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Skirt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.
Available in grey, beige to complement your wardrobe.' else description_en end where id = 1099 and name_vi = 'Chân váy dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, xanh navy, be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Trousers — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, navy, beige to complement your wardrobe.' else description_en end where id = 1100 and name_vi = 'Quần âu cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen, đỏ mận, bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black, burgundy, silver to complement your wardrobe.' else description_en end where id = 1101 and name_vi = 'Quần âu phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xanh navy, đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Trousers — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in navy, black to complement your wardrobe.' else description_en end where id = 1102 and name_vi = 'Quần âu dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần âu bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Trousers — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black to complement your wardrobe.' else description_en end where id = 1103 and name_vi = 'Quần âu bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần lửng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Cropped Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black to complement your wardrobe.' else description_en end where id = 1104 and name_vi = 'Quần lửng dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần lửng phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Cropped Trousers — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in grey to complement your wardrobe.' else description_en end where id = 1105 and name_vi = 'Quần lửng phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần lửng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Cropped Trousers — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in white to complement your wardrobe.' else description_en end where id = 1106 and name_vi = 'Quần lửng dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần lửng phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Cropped Trousers — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in navy to complement your wardrobe.' else description_en end where id = 1107 and name_vi = 'Quần lửng phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần lửng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Cropped Trousers — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in black to complement your wardrobe.' else description_en end where id = 1108 and name_vi = 'Quần lửng dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Quần lửng cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Cropped Trousers — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.
Available in grey to complement your wardrobe.' else description_en end where id = 1109 and name_vi = 'Quần lửng cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in black to complement your wardrobe.' else description_en end where id = 1110 and name_vi = 'Túi xách tay phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Handbag — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in grey to complement your wardrobe.' else description_en end where id = 1111 and name_vi = 'Túi xách tay cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in brown to complement your wardrobe.' else description_en end where id = 1112 and name_vi = 'Túi xách tay phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in beige to complement your wardrobe.' else description_en end where id = 1113 and name_vi = 'Túi xách tay phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Handbag — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in silver to complement your wardrobe.' else description_en end where id = 1114 and name_vi = 'Túi xách tay bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Handbag — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in white to complement your wardrobe.' else description_en end where id = 1115 and name_vi = 'Túi xách tay cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Handbag — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in navy to complement your wardrobe.' else description_en end where id = 1116 and name_vi = 'Túi xách tay dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Handbag — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in burgundy to complement your wardrobe.' else description_en end where id = 1117 and name_vi = 'Túi xách tay dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Handbag — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in black to complement your wardrobe.' else description_en end where id = 1118 and name_vi = 'Túi xách tay phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Túi xách tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Handbag — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Pair with workwear or a day dress for a coordinated finishing touch.
Available in grey to complement your wardrobe.' else description_en end where id = 1119 and name_vi = 'Túi xách tay bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví cầm tay phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Clutch — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in black to complement your wardrobe.' else description_en end where id = 1120 and name_vi = 'Ví cầm tay phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví da phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Wallet — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in brown to complement your wardrobe.' else description_en end where id = 1121 and name_vi = 'Ví da phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví da cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Wallet — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in grey to complement your wardrobe.' else description_en end where id = 1122 and name_vi = 'Ví da cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví da dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Wallet — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in white to complement your wardrobe.' else description_en end where id = 1123 and name_vi = 'Ví da dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví cầm tay phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Clutch — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in silver to complement your wardrobe.' else description_en end where id = 1124 and name_vi = 'Ví cầm tay phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví da dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Wallet — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in navy to complement your wardrobe.' else description_en end where id = 1125 and name_vi = 'Ví da dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví cầm tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Clutch — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in beige to complement your wardrobe.' else description_en end where id = 1126 and name_vi = 'Ví cầm tay bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví cầm tay bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu vàng gold giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Clutch — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in gold to complement your wardrobe.' else description_en end where id = 1127 and name_vi = 'Ví cầm tay bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví cầm tay phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu đỏ mận giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Clutch — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in burgundy to complement your wardrobe.' else description_en end where id = 1128 and name_vi = 'Ví cầm tay phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Ví da cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Wallet — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
A thoughtful accessory for outings, easy to coordinate with your bag and outfit.
Available in black to complement your wardrobe.' else description_en end where id = 1129 and name_vi = 'Ví da cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Belt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in black to complement your wardrobe.' else description_en end where id = 1130 and name_vi = 'Thắt lưng cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Belt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in brown to complement your wardrobe.' else description_en end where id = 1131 and name_vi = 'Thắt lưng dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Belt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in grey to complement your wardrobe.' else description_en end where id = 1132 and name_vi = 'Thắt lưng phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Belt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in white to complement your wardrobe.' else description_en end where id = 1133 and name_vi = 'Thắt lưng dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Belt — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in silver to complement your wardrobe.' else description_en end where id = 1134 and name_vi = 'Thắt lưng cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Belt — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in navy to complement your wardrobe.' else description_en end where id = 1135 and name_vi = 'Thắt lưng dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng dáng suông — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Relaxed Belt — an accent for your personal style.
Relaxed styling suits easy outfits for everyday plans and weekends.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in beige to complement your wardrobe.' else description_en end where id = 1136 and name_vi = 'Thắt lưng dáng suông';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng phom ôm — một điểm nhấn cho phong cách riêng của bạn.
Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu vàng gold giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Tailored Belt — an accent for your personal style.
A streamlined look makes it easy to put together polished outfits for different occasions.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in gold to complement your wardrobe.' else description_en end where id = 1137 and name_vi = 'Thắt lưng phom ôm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Belt — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in black to complement your wardrobe.' else description_en end where id = 1138 and name_vi = 'Thắt lưng phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Thắt lưng bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Belt — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Style with jeans or trousers, or use as a waist accent with dresses and jackets.
Available in brown to complement your wardrobe.' else description_en end where id = 1139 and name_vi = 'Thắt lưng bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Kính mát phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Sunglasses — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in black to complement your wardrobe.' else description_en end where id = 1140 and name_vi = 'Kính mát phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Khăn choàng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Scarf — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in brown to complement your wardrobe.' else description_en end where id = 1141 and name_vi = 'Khăn choàng dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Khăn choàng dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu xám giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Scarf — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in grey to complement your wardrobe.' else description_en end where id = 1142 and name_vi = 'Khăn choàng dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Kính mát dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu trắng giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Sunglasses — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in white to complement your wardrobe.' else description_en end where id = 1143 and name_vi = 'Kính mát dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Kính mát dáng cổ điển — một điểm nhấn cho phong cách riêng của bạn.
Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu bạc giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Classic Sunglasses — an accent for your personal style.
Classic styling lends itself to elegant everyday outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in silver to complement your wardrobe.' else description_en end where id = 1144 and name_vi = 'Kính mát dáng cổ điển';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Kính mát cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu vàng gold giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Sunglasses — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in gold to complement your wardrobe.' else description_en end where id = 1145 and name_vi = 'Kính mát cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Khăn choàng phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu xanh navy giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Scarf — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in navy to complement your wardrobe.' else description_en end where id = 1146 and name_vi = 'Khăn choàng phom rộng';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Khăn choàng bản mềm — một điểm nhấn cho phong cách riêng của bạn.
Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.
Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.
Các lựa chọn màu be giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Soft Scarf — an accent for your personal style.
An easy addition to outfits for everyday plans and social occasions.
Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.
Available in beige to complement your wardrobe.' else description_en end where id = 1147 and name_vi = 'Khăn choàng bản mềm';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Kính mát cắt may tối giản — một điểm nhấn cho phong cách riêng của bạn.
Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu đen giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Minimal Sunglasses — an accent for your personal style.
A minimal aesthetic makes it easy to combine with your wardrobe favourites.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in black to complement your wardrobe.' else description_en end where id = 1148 and name_vi = 'Kính mát cắt may tối giản';
update public.products set description = case when trim(coalesce(description, '')) = '' then 'Kính mát phom rộng — một điểm nhấn cho phong cách riêng của bạn.
Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.
Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.
Các lựa chọn màu nâu giúp bạn tìm sắc độ phù hợp với tủ đồ.' else description end, description_en = case when trim(coalesce(description_en, '')) = '' then 'Oversized Sunglasses — an accent for your personal style.
The oversized silhouette brings a relaxed mood to layered outfits.
Pair with a shirt, T-shirt or dress to finish your look for a day out.
Available in brown to complement your wardrobe.' else description_en end where id = 1149 and name_vi = 'Kính mát phom rộng';
