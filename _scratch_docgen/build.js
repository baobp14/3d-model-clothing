const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, VerticalAlign,
  TabStopType, TabStopPosition,
} = require('docx');

const FONT = 'Times New Roman';
const SZ = 26; // 13pt body
const SZ_TITLE = 28; // 14pt

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || SZ, bold: !!opts.bold, italics: !!opts.italics, ...opts });
}

function p(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: opts.alignment,
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: opts.line },
    indent: opts.indent,
    keepNext: opts.keepNext,
  });
}

function noBorder() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: none, bottom: none, left: none, right: none };
}
function cellBorder() {
  const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  return { top: line, bottom: line, left: line, right: line };
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
const headerTable = new Table({
  width: { size: 9639, type: WidthType.DXA },
  columnWidths: [7200, 2439],
  borders: noBorder(),
  rows: [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 7200, type: WidthType.DXA },
          borders: noBorder(),
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [
            p(t('TRƯỜNG ĐẠI HỌC VĂN LANG', { bold: true, size: SZ_TITLE }), { after: 40 }),
            p(t('KHOA: CÔNG NGHỆ THÔNG TIN', { bold: true, size: SZ_TITLE }), { after: 0 }),
          ],
        }),
        new TableCell({
          width: { size: 2439, type: WidthType.DXA },
          borders: cellBorder(),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          children: [p(t('VLU.ĐAKLTN.08', { size: 22 }), { alignment: AlignmentType.CENTER, after: 0 })],
        }),
      ],
    }),
  ],
});

// ---------------------------------------------------------------------------
// Student table
// ---------------------------------------------------------------------------
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorder(),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [p(t(text, { bold: true }), { alignment: AlignmentType.CENTER, after: 0 })],
  });
}
function bodyCell(text, width, align = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorder(),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [p(t(text), { alignment: align, after: 0 })],
  });
}

const COL = [1900, 3200, 3000, 1539];
const studentTable = new Table({
  width: { size: 9639, type: WidthType.DXA },
  columnWidths: COL,
  rows: [
    new TableRow({ children: [headerCell('MSSV', COL[0]), headerCell('Họ và tên', COL[1]), headerCell('Chuyên ngành', COL[2]), headerCell('Khoá', COL[3])] }),
    new TableRow({ children: [bodyCell('2374802010366', COL[0], AlignmentType.CENTER), bodyCell('Võ Minh Nhật', COL[1]), bodyCell('Công Nghệ Phần Mềm', COL[2]), bodyCell('K29', COL[3], AlignmentType.CENTER)] }),
    new TableRow({ children: [bodyCell('2374802010045', COL[0], AlignmentType.CENTER), bodyCell('Phạm Lê Gia Bảo', COL[1]), bodyCell('Công Nghệ Phần Mềm', COL[2]), bodyCell('K29', COL[3], AlignmentType.CENTER)] }),
  ],
});

// ---------------------------------------------------------------------------
// Bullet helpers
// ---------------------------------------------------------------------------
function dash(text, opts = {}) {
  return p([t('-  ', {}), t(text, opts)], { indent: { left: 340 }, after: 120 });
}
function dashRich(runs) {
  return p([t('-  ', {}), ...runs], { indent: { left: 340 }, after: 120 });
}
function plus(label, text) {
  return p([t('+  ' + label + ': ', {}), t(text)], { indent: { left: 700 }, after: 120 });
}

// ---------------------------------------------------------------------------
// Section 1
// ---------------------------------------------------------------------------
const sec1 = [
  p(t('1. Thông tin về chung:', { bold: true, size: SZ_TITLE }), { after: 160 }),
  p([t('Tên đề tài: ', { bold: true }), t('Thiết kế và xây dựng nền tảng E-commerce thời trang tích hợp hệ thống gợi ý phối đồ thông minh')], { after: 160 }),
  p([t('Giảng viên hướng dẫn: ', { bold: true }), t('TH.S Võ Anh Tiến')], { after: 160 }),
  p(t('Sinh viên thực hiện:', { bold: true }), { after: 120 }),
  studentTable,
  p('', { after: 160 }),
];

// ---------------------------------------------------------------------------
// Section 2 -- Mục tiêu (rebalanced: full e-commerce scope first, 3D as a
// supporting differentiator, not the whole topic)
// ---------------------------------------------------------------------------
const sec2 = [
  p(t('2. Mục tiêu chính của đề tài:', { bold: true, size: SZ_TITLE }), { after: 160 }),
  dashRich([
    t('Mục tiêu 1: '),
    t('Xây dựng hoàn chỉnh một nền tảng thương mại điện tử (E-commerce) thời trang với đầy đủ luồng nghiệp vụ chuẩn: đăng ký/đăng nhập, duyệt và tìm kiếm sản phẩm, giỏ hàng, đặt hàng, thanh toán, theo dõi và quản lý đơn hàng, đánh giá sản phẩm, cùng trang quản trị dành cho người bán.'),
  ]),
  dashRich([
    t('Mục tiêu 2: '),
    t('Tích hợp hệ thống gợi ý phối đồ và gợi ý sản phẩm thông minh dựa trên trí tuệ nhân tạo (AI), giúp cá nhân hóa trải nghiệm mua sắm theo số đo cơ thể, danh mục sản phẩm và lịch sử tương tác của từng người dùng, qua đó tối ưu hóa việc lựa chọn trang phục và tăng tỷ lệ chuyển đổi mua hàng.'),
  ]),
  dashRich([
    t('Mục tiêu 3: '),
    t('Xây dựng avatar 3D dựng đúng theo số đo cơ thể người dùng và chức năng mặc thử trang phục bằng ảnh sản phẩm ngay trên trang chi tiết sản phẩm, làm công cụ hỗ trợ ra quyết định mua hàng trước khi đặt hàng, với sai số dựng hình ở mức chấp nhận được (≤ 0.5 cm cho các số đo chính).'),
  ]),
  dashRich([
    t('Mục tiêu 4: '),
    t('Đáp ứng nhu cầu thực tế của người mua sắm thời trang trực tuyến và của người bán: giảm rủi ro chọn sai size/kiểu dáng dẫn đến đổi trả, tăng trải nghiệm cá nhân hóa khi lựa chọn trang phục, đồng thời cung cấp công cụ quản lý sản phẩm và đơn hàng hiệu quả cho phía vận hành cửa hàng.'),
  ]),
  dashRich([
    t('Mục tiêu 5: '),
    t('Đảm bảo hiệu năng và khả năng chịu tải phù hợp với quy mô một cửa hàng thời trang online: hệ thống hoạt động ổn định với tối thiểu 30 người dùng truy cập đồng thời, thời gian phản hồi các trang danh sách/chi tiết sản phẩm và giỏ hàng dưới 2 giây.'),
  ]),
  dashRich([
    t('Mục tiêu 6: '),
    t('Đảm bảo an toàn thông tin người dùng và giao dịch: mật khẩu được mã hoá, phân quyền rõ ràng giữa khách hàng và quản trị viên, dữ liệu thanh toán và thông tin cá nhân được xử lý theo các nguyên tắc bảo mật cơ bản (chống SQL Injection, XSS, kiểm soát truy cập theo vai trò).'),
  ]),
  dashRich([
    t('Mục tiêu 7: '),
    t('Xây dựng giao diện responsive, hiển thị tốt trên cả máy tính và thiết bị di động, đáp ứng thói quen mua sắm chủ yếu qua điện thoại của người dùng thời trang trực tuyến.'),
  ]),
  dashRich([
    t('Mục tiêu 8: '),
    t('Đảm bảo tính nhất quán và chính xác của dữ liệu vận hành: đồng bộ tồn kho theo thời gian thực giữa giỏ hàng, đơn hàng và kho sản phẩm để tránh tình trạng bán vượt tồn kho (oversell); cung cấp báo cáo doanh thu và đơn hàng cơ bản phục vụ ra quyết định vận hành cho quản trị viên.'),
  ]),
];

// ---------------------------------------------------------------------------
// Section 3 -- Phạm vi & chức năng cốt lõi: đầy đủ luồng TMĐT trước, avatar
// 3D/mặc thử/gợi ý AI là các mục bổ trợ nằm giữa luồng, không chiếm hết.
// ---------------------------------------------------------------------------
function featureGroup(name, chucNang, nhiemVu) {
  return [dash(name + ':'), plus('Chức năng', chucNang), plus('Nhiệm vụ cốt lõi', nhiemVu)];
}

const sec3 = [
  p(t('3. Phạm vi và Các chức năng/Nhiệm vụ cốt lõi:', { bold: true, size: SZ_TITLE }), { after: 160 }),
  p(t('Hệ thống xây dựng đầy đủ luồng nghiệp vụ của một nền tảng thương mại điện tử thời trang (từ duyệt sản phẩm đến thanh toán và quản trị), có tích hợp trực quan hoá 3D và gợi ý phối đồ bằng AI như điểm khác biệt, ở mức ứng dụng thực tiễn phù hợp khối lượng 6 tín chỉ ĐATN cho 2 sinh viên.'), { after: 160 }),
  p(t('Các chức năng và nhiệm vụ chính bao gồm, theo đúng luồng trải nghiệm người mua và người quản trị:'), { after: 160 }),

  ...featureGroup(
    'Đăng ký, đăng nhập & Quản lý hồ sơ',
    'Đăng ký tài khoản, đăng nhập/đăng xuất, quản lý phiên truy cập, phân quyền khách hàng/quản trị viên; chỉnh sửa hồ sơ cá nhân, địa chỉ giao hàng và số đo cơ thể.',
    'Xây dựng cơ sở dữ liệu người dùng (tài khoản, địa chỉ, số đo cơ thể) và cơ chế xác thực + phân quyền (role-based) để tách biệt luồng khách hàng và luồng quản trị.',
  ),
  ...featureGroup(
    'Danh mục, tìm kiếm & duyệt sản phẩm',
    'Hiển thị trang chủ theo danh mục, trang danh sách sản phẩm có phân trang, tìm kiếm theo từ khoá, lọc theo danh mục/size/màu/khoảng giá, sắp xếp theo giá/độ phổ biến.',
    'Thiết kế cơ sở dữ liệu sản phẩm theo cấu trúc phân cấp Sản phẩm → Biến thể (size + màu) → SKU → Tồn kho (ví dụ: Áo A / size M / màu Đen = 10 sản phẩm), làm nền tảng để trừ/cộng tồn kho chính xác theo từng biến thể cụ thể khi đặt hàng hoặc huỷ/hoàn hàng; xây dựng API/giao diện tìm kiếm - lọc - phân trang.',
  ),
  ...featureGroup(
    'Chi tiết sản phẩm, avatar 3D & mặc thử ảo',
    'Xem chi tiết sản phẩm (ảnh, mô tả, bảng size, đánh giá); tại đây người dùng có thể dựng avatar 3D theo số đo cơ thể đã lưu và mặc thử trực tiếp sản phẩm đang xem (ảnh trước/sau) trước khi thêm vào giỏ.',
    'Xây dựng pipeline chuyển đổi số đo cơ thể thành morph target trên mesh 3D và thuật toán solver tìm tổ hợp morph khớp số đo trong sai số cho phép; cài đặt kỹ thuật chiếu ảnh (projected texture mapping) từ 2 góc trước/sau lên vùng thân trên của avatar, tự động khung theo số đo vai/ngực/hông từng người dùng.',
  ),
  ...featureGroup(
    'Gợi ý phối đồ & gợi ý sản phẩm thông minh (AI)',
    'Gợi ý sản phẩm và cách phối đồ phù hợp ngay trên trang chi tiết sản phẩm và trang chủ, dựa trên số đo cơ thể, danh mục sản phẩm đang xem và lịch sử xem/mua của người dùng.',
    'Xây dựng mô hình gợi ý kết hợp dữ liệu số đo cơ thể và đặc trưng sản phẩm (loại, màu sắc, size, danh mục) để xếp hạng và đề xuất sản phẩm/size phù hợp nhất với từng người dùng.',
  ),
  ...featureGroup(
    'Giỏ hàng',
    'Thêm/sửa/xoá sản phẩm trong giỏ, chọn size và số lượng, tự động tính tạm tính - phí vận chuyển - tổng tiền, áp dụng mã giảm giá.',
    'Xây dựng logic giỏ hàng lưu theo phiên/tài khoản, đồng bộ tồn kho theo SKU khi thêm sản phẩm, xử lý mã giảm giá và tính toán tổng đơn.',
  ),
  ...featureGroup(
    'Quản lý khuyến mãi (Admin)',
    'Quản trị viên tạo/sửa/xoá mã giảm giá, thiết lập thời gian hiệu lực, giá trị giảm (theo % hoặc số tiền cố định), điều kiện áp dụng (giá trị đơn tối thiểu, danh mục áp dụng) và giới hạn số lượt sử dụng.',
    'Xây dựng cơ sở dữ liệu khuyến mãi (mã, thời hạn, điều kiện, số lượt còn lại) và kiểm tra hợp lệ mã giảm giá tại bước giỏ hàng/thanh toán, đồng bộ ngay với mục "áp dụng mã giảm giá" phía khách hàng.',
  ),
  ...featureGroup(
    'Đặt hàng & Thanh toán',
    'Nhập/chọn địa chỉ giao hàng, chọn phương thức thanh toán (thanh toán khi nhận hàng hoặc qua cổng thanh toán trực tuyến), xác nhận và tạo đơn hàng. Thanh toán thành công thì tạo đơn hàng; thanh toán thất bại thì hiển thị thông báo lỗi và cho phép thanh toán lại.',
    'Xây dựng luồng checkout nhiều bước, tích hợp cổng thanh toán trực tuyến; xử lý callback/webhook để cập nhật trạng thái giao dịch (thành công/thất bại) và ghi nhận đồng bộ với trạng thái đơn hàng - tồn kho.',
  ),
  ...featureGroup(
    'Huỷ đơn hàng & Hoàn tiền',
    'Khách hàng gửi yêu cầu huỷ đơn (khi đơn còn ở trạng thái cho phép huỷ); hệ thống kiểm tra trạng thái đơn hiện tại trước khi chấp nhận huỷ.',
    'Khi huỷ đơn thành công: hoàn lại tồn kho theo đúng SKU đã trừ trước đó; nếu đơn đã thanh toán thì chuyển yêu cầu hoàn tiền sang trạng thái "Refund Pending" rồi "Refunded" -- ở phạm vi đồ án, có thể mô phỏng chuyển trạng thái này thay vì tích hợp hoàn tiền tự động thật qua cổng thanh toán.',
  ),
  ...featureGroup(
    'Đổi/trả hàng',
    'Khách hàng tạo yêu cầu đổi/trả hàng cho đơn đã giao, chọn lý do đổi/trả; quản trị viên xem và duyệt hoặc từ chối yêu cầu.',
    'Thiết kế cơ sở dữ liệu yêu cầu đổi/trả gắn với đơn hàng, xây dựng luồng cập nhật trạng thái (chờ duyệt/đã duyệt/từ chối/hoàn tất) và xử lý kết quả tương ứng: hoàn tiền (theo cơ chế mô phỏng như trên) hoặc tạo đơn đổi sản phẩm mới.',
  ),
  ...featureGroup(
    'Quản lý đơn hàng & Lịch sử mua hàng',
    'Xem lịch sử đơn hàng, theo dõi trạng thái đơn theo thời gian thực.',
    'Thiết kế mô hình trạng thái đơn hàng (order state machine) bao trùm cả nhánh huỷ và đổi/trả ở trên, xây dựng giao diện tra cứu và cập nhật trạng thái cho cả khách hàng và quản trị viên.',
  ),
  ...featureGroup(
    'Đánh giá & Nhận xét sản phẩm',
    'Viết đánh giá, chấm điểm sao và xem nhận xét của người mua trước đó cho từng sản phẩm.',
    'Xây dựng cơ sở dữ liệu đánh giá gắn với đơn hàng đã hoàn tất (xác thực đã mua), tính điểm trung bình và hiển thị trên trang sản phẩm.',
  ),
  ...featureGroup(
    'Trang quản trị (Admin)',
    'Quản lý sản phẩm/danh mục/biến thể-tồn kho, quản lý khuyến mãi, quản lý đơn hàng (bao gồm duyệt huỷ/đổi trả), quản lý người dùng, xem báo cáo doanh thu cơ bản.',
    'Xây dựng giao diện quản trị riêng biệt (bảo vệ bằng phân quyền), các thao tác CRUD cho sản phẩm/danh mục/khuyến mãi/đơn hàng, và truy vấn tổng hợp cho báo cáo doanh thu/đơn hàng theo thời gian.',
  ),
];

const sec3Optional = [
  p(t('Các chức năng có thể bổ sung nếu còn thời gian (ưu tiên thấp hơn nhóm chức năng cốt lõi ở trên):', { italics: true }), { after: 120, before: 60 }),
  ...[
    'Quên mật khẩu / đổi mật khẩu.',
    'Quản lý nhiều địa chỉ giao hàng cho một tài khoản.',
    'Xác nhận đơn hàng và thông báo trạng thái đơn qua email/thông báo trong ứng dụng (đã đặt → đã xác nhận → đang chuẩn bị → đang giao → đã giao).',
    'Lịch sử thanh toán.',
    'Wishlist / danh sách sản phẩm yêu thích.',
    'Sản phẩm đã xem gần đây.',
  ].map((text) => dash(text)),
];

// ---------------------------------------------------------------------------
// Section 4 -- Công nghệ / phương pháp (đầy đủ cho một hệ TMĐT, không chỉ 3D)
// ---------------------------------------------------------------------------
const sec4 = [
  p(t('4. Công nghệ/Phương pháp thực hiện:', { bold: true, size: SZ_TITLE }), { after: 160 }),
  dash('Công nghệ sử dụng:'),
  plus('Giao diện người dùng (Frontend)', 'Next.js, React, TypeScript, TailwindCSS -- xây dựng giao diện mua sắm (trang chủ, danh mục, giỏ hàng, thanh toán) và trang quản trị.'),
  plus('Dựng hình & tương tác 3D', 'three.js, @react-three/fiber, @react-three/drei (WebGL, chạy trực tiếp trên trình duyệt) -- phục vụ riêng chức năng avatar 3D và mặc thử ảo.'),
  plus('Hệ thống dữ liệu & xác thực (Backend/BaaS)', 'Next.js API Routes kết hợp Supabase (Postgres, Authentication, Storage) để lưu tài khoản, sản phẩm, đơn hàng, đánh giá và phân quyền khách hàng/quản trị viên.'),
  plus('Thanh toán trực tuyến', 'Tích hợp một cổng thanh toán phổ biến tại Việt Nam (ví dụ VNPay/Momo) cho luồng đặt hàng, song song với lựa chọn thanh toán khi nhận hàng (COD); xử lý callback/webhook để xác nhận giao dịch thành công/thất bại. Hoàn tiền (refund) được mô phỏng qua trạng thái "Refund Pending → Refunded" trong hệ thống thay vì tích hợp API hoàn tiền thật của cổng thanh toán, phù hợp phạm vi đồ án.'),
  plus('Pipeline dựng avatar', 'Python (thư viện chuẩn); bộ dữ liệu người CC0 (MakeHuman); tự xây dựng bộ chuyển đổi OBJ/target sang GLB có morph target.'),
  plus('Mặc thử ảo & gợi ý AI', 'Kỹ thuật projected texture mapping tự cài đặt trên three.js; tách nền ảnh sản phẩm ngay phía trình duyệt (WASM, không cần GPU/máy chủ riêng); mô hình gợi ý content-based/rule-based, có thể mở rộng bằng embedding hình ảnh sản phẩm.'),

  dash('Phương pháp thực hiện: Áp dụng phát triển dựa trên các công cụ và nền tảng mã nguồn mở, ưu tiên hoàn thiện luồng nghiệp vụ TMĐT trước khi tối ưu các chức năng nâng cao.'),
  plus('Lựa chọn Next.js + Supabase', 'Bộ công nghệ phổ biến cho một nền tảng TMĐT vừa và nhỏ: Next.js hỗ trợ Server-Side Rendering tối ưu SEO/hiệu năng cho trang sản phẩm, Supabase tích hợp sẵn cơ sở dữ liệu, xác thực, lưu trữ, giúp giảm tải khâu triển khai hạ tầng trong thời lượng đồ án.'),
  plus('Lựa chọn WebGL/three.js cho avatar', 'Cho phép dựng và tương tác avatar 3D ngay trên trình duyệt như một chức năng bổ trợ tại trang chi tiết sản phẩm, không yêu cầu cài đặt phần mềm bổ sung.'),
  plus('Lựa chọn projected texture thay vì AI sinh ảnh', 'Kỹ thuật chiếu ảnh không cần GPU hay chi phí máy chủ suy luận mô hình, có thể triển khai ngay trên hạ tầng hiện có; đánh đổi là độ chân thực thấp hơn AI sinh ảnh (diffusion) hoặc mô phỏng vải 3D -- đây là hướng mở rộng nếu đề tài có thêm tài nguyên GPU/cloud.'),
];

// ---------------------------------------------------------------------------
// Section 5 -- Sản phẩm dự kiến
// ---------------------------------------------------------------------------
const sec5 = [
  p(t('5. Sản phẩm/Kết quả dự kiến:', { bold: true, size: SZ_TITLE }), { after: 160 }),
  dash('File báo cáo tổng hợp kết quả thực hiện Đồ án tốt nghiệp: Tài liệu chính (dạng .pdf/.docx) mô tả toàn bộ quá trình nghiên cứu, thiết kế và kết quả.'),
  dash('Bộ mã nguồn (Source Code): Toàn bộ mã nguồn của dự án, gồm cả phần TMĐT và phần avatar 3D/gợi ý AI.'),
  dash('Ứng dụng Web minh họa: Sản phẩm demo có thể triển khai và chạy được, gồm đầy đủ luồng mua hàng (duyệt sản phẩm → giỏ hàng → thanh toán → theo dõi đơn hàng), trang quản trị, avatar 3D, mặc thử trang phục và gợi ý phối đồ.'),
  dash('Hướng dẫn sử dụng: Tài liệu hướng dẫn cài đặt, cấu hình và vận hành ứng dụng cho cả vai trò khách hàng và quản trị viên.'),
  dash('Bộ tài liệu quản lý dự án: Bao gồm các tệp tài liệu chi tiết quá trình lập kế hoạch và theo dõi dự án.'),
  dash('Bản thiết kế giao diện (UI/UX Design): Các tệp thiết kế Figma mô tả giao diện của ứng dụng, gồm luồng mua hàng và trang quản trị.'),
];

// ---------------------------------------------------------------------------
// Section 6 -- Thời gian
// ---------------------------------------------------------------------------
function dotLeaderLine(text) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: 'dot' }],
    children: [t(text + '\t')],
    spacing: { after: 160 },
    indent: { left: 340 },
  });
}

const sec6 = [
  p(t('6. Thời gian thực hiện', { bold: true, size: SZ_TITLE }), { after: 160, keepNext: true }),
  dotLeaderLine('Thời gian bắt đầu  :  HK261'),
  dotLeaderLine('Thời gian thực hiện  :  15 tuần'),
  p('', { after: 200 }),
];

// ---------------------------------------------------------------------------
// Signature block
// ---------------------------------------------------------------------------
function sigCol(role, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: noBorder(),
    margins: { left: 20, right: 20 },
    children: [
      p(t('Tp.HCM, ngày ___/___/2026', { italics: true, size: 21 }), { alignment: AlignmentType.CENTER, after: 200 }),
      p(t(role, { bold: true, size: 21 }), { alignment: AlignmentType.CENTER, after: 900, line: 240 }),
      p(t('(ký và ghi họ tên)', { italics: true, size: 20 }), { alignment: AlignmentType.CENTER, after: 0 }),
    ],
  });
}
const SIG_COL = [3213, 3213, 3213];
const sigTable = new Table({
  width: { size: 9639, type: WidthType.DXA },
  columnWidths: SIG_COL,
  borders: noBorder(),
  rows: [
    new TableRow({
      cantSplit: true,
      children: [
        sigCol('TRƯỞNG KHOA', SIG_COL[0]),
        sigCol('GIẢNG VIÊN HƯỚNG DẪN', SIG_COL[1]),
        sigCol('SINH VIÊN THỰC HIỆN', SIG_COL[2]),
      ],
    }),
  ],
});

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          size: { width: 11907, height: 16840 },
          margin: { top: 851, right: 1134, bottom: 1560, left: 1134 },
        },
      },
      children: [
        headerTable,
        p('', { after: 160 }),
        p(t('PHIẾU GIAO ĐỀ TÀI CHO SINH VIÊN', { bold: true, size: 36 }), { alignment: AlignmentType.CENTER, after: 300, before: 100 }),
        ...sec1,
        ...sec2,
        ...sec3,
        ...sec3Optional,
        ...sec4,
        ...sec5,
        ...sec6,
        sigTable,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  require('fs').writeFileSync('output.docx', buf);
  console.log('wrote output.docx', buf.length, 'bytes');
});
