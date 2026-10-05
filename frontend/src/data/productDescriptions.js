const styling = [
  [/Polo Shirt/, 'Kết hợp cùng quần âu cho ngày làm việc hoặc quần jeans cho buổi hẹn cuối tuần.', 'Pair with trousers for work or jeans for a weekend outing.'],
  [/Shirt/, 'Phối cùng quần âu để tạo vẻ lịch sự, hoặc mặc ngoài áo thun cho phong cách thư thả.', 'Style with trousers for a polished look, or wear over a T-shirt for a relaxed outfit.'],
  [/T-shirt/, 'Dễ kết hợp với jeans, quần suông và áo khoác để làm mới trang phục hằng ngày.', 'Combine with jeans, relaxed trousers and a jacket to refresh your everyday outfits.'],
  [/Sweater|Hoodie|Cardigan/, 'Gợi ý phối cùng quần jeans hoặc chân váy; thêm một lớp áo khoác cho những ngày se lạnh.', 'Style with jeans or a skirt, adding a jacket on cooler days.'],
  [/Blazer|Jacket|Coat/, 'Mặc cùng áo thun và jeans cho ngày dạo phố, hoặc phối với sơ mi và quần âu khi cần chỉn chu.', 'Wear with a T-shirt and jeans for a day out, or a shirt and trousers for a polished occasion.'],
  [/Dress/, 'Kết hợp cùng túi nhỏ và giày bệt cho buổi dạo phố, hoặc thêm trang sức và giày cao gót khi đi tiệc.', 'Pair with a small bag and flats for a day out, or jewellery and heels for an evening occasion.'],
  [/Skirt/, 'Phối cùng áo kiểu cho vẻ thanh lịch hoặc áo thun và sneakers để tạo nét trẻ trung.', 'Style with a blouse for an elegant outfit or a T-shirt and sneakers for a casual look.'],
  [/Trousers|Jeans|Shorts/, 'Kết hợp cùng áo sơ mi, áo thun hoặc áo len để linh hoạt thay đổi phong cách trong tuần.', 'Pair with a shirt, T-shirt or sweater to vary your looks throughout the week.'],
  [/Top|Blouse/, 'Phối với quần âu hoặc chân váy cho ngày làm việc; kết hợp jeans khi đi cà phê cùng bạn bè.', 'Pair with trousers or a skirt for work, or jeans for coffee with friends.'],
  [/Watch/, 'Đeo cùng sơ mi để hoàn thiện vẻ chỉn chu, hoặc phối với áo thun cho điểm nhấn hằng ngày.', 'Wear with a shirt for a polished finish or a T-shirt for an everyday accent.'],
  [/Handbag|Bag/, 'Kết hợp cùng trang phục công sở hoặc váy dạo phố để tạo điểm nhấn đồng điệu.', 'Pair with workwear or a day dress for a coordinated finishing touch.'],
  [/Clutch|Wallet/, 'Một gợi ý phụ kiện cho những buổi gặp gỡ, dễ kết hợp với túi xách và trang phục cùng tông.', 'A thoughtful accessory for outings, easy to coordinate with your bag and outfit.'],
  [/Belt/, 'Phối cùng quần jeans, quần âu hoặc tạo điểm nhấn ở eo khi mặc váy và áo khoác.', 'Style with jeans or trousers, or use as a waist accent with dresses and jackets.'],
  [/Sunglasses/, 'Kết hợp với áo sơ mi, áo thun hoặc váy để hoàn thiện phong cách cho những buổi dạo phố.', 'Pair with a shirt, T-shirt or dress to finish your look for a day out.'],
  [/Scarf/, 'Quàng cùng sơ mi hoặc áo khoác; thử thắt nhẹ để tạo điểm nhấn cho trang phục đơn sắc.', 'Wear with a shirt or coat, or tie loosely to add interest to a monochrome outfit.'],
]

const fits = [
  [/^Oversized /, 'Phom rộng mang tinh thần phóng khoáng, phù hợp với cách phối nhiều lớp.', 'The oversized silhouette brings a relaxed mood to layered outfits.'],
  [/^Tailored /, 'Phong cách gọn gàng tạo tổng thể chỉn chu và dễ phối cho nhiều dịp.', 'A streamlined look makes it easy to put together polished outfits for different occasions.'],
  [/^Minimal /, 'Tinh thần tối giản giúp bạn dễ kết hợp với những món đồ sẵn có trong tủ.', 'A minimal aesthetic makes it easy to combine with your wardrobe favourites.'],
  [/^Classic /, 'Phong cách cổ điển là gợi ý cho những bộ trang phục thanh lịch hằng ngày.', 'Classic styling lends itself to elegant everyday outfits.'],
  [/^Relaxed /, 'Tinh thần thư thả phù hợp với những bộ trang phục nhẹ nhàng cho ngày thường và cuối tuần.', 'Relaxed styling suits easy outfits for everyday plans and weekends.'],
]

export function createProductDescriptions(product, colors = []) {
  const name = product.en || ''
  const style = styling.find(([pattern]) => pattern.test(name))
  const fit = fits.find(([pattern]) => pattern.test(name))
  const palette = lang => (product.colors || []).map(id => colors.find(c => c.id === id)?.[lang] || id).join(', ')
  return {
    vi: [
      `${product.vi} — một điểm nhấn cho phong cách riêng của bạn.`,
      fit?.[1] || 'Dễ đưa vào nhiều cách phối, từ trang phục thường ngày đến những buổi gặp gỡ.',
      style?.[1] || 'Kết hợp cùng những món đồ yêu thích để tạo tổng thể hài hòa.',
      palette('vi') ? `Các lựa chọn màu ${palette('vi').toLocaleLowerCase('vi-VN')} giúp bạn tìm sắc độ phù hợp với tủ đồ.` : '',
    ].filter(Boolean).join('\n'),
    en: [
      `${product.en} — an accent for your personal style.`,
      fit?.[2] || 'An easy addition to outfits for everyday plans and social occasions.',
      style?.[2] || 'Combine with your favourite pieces for a coordinated look.',
      palette('en') ? `Available in ${palette('en').toLowerCase()} to complement your wardrobe.` : '',
    ].filter(Boolean).join('\n'),
  }
}

export function getProductDescription(product, lang, colors) {
  const authored = lang === 'vi' ? product.description : product.descriptionEn
  return authored?.trim() || createProductDescriptions(product, colors)[lang]
}
