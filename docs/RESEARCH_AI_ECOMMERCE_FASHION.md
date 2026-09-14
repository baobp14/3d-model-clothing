# Ứng dụng AI trong phần mềm bán quần áo (TMĐT thời trang)

> Tài liệu nghiên cứu cho đồ án tốt nghiệp. Mục tiêu: tổng quan các hướng AI
> đang được dùng trong thương mại điện tử thời trang, và đặt giải pháp đã
> chọn cho đồ án (avatar 3D dựng từ số đo + mặc thử bằng projected texture)
> vào đúng vị trí trong bức tranh đó — biết rõ mình đang đứng ở đâu, đánh đổi
> gì, và hướng nào để đi tiếp nếu có thêm tài nguyên (GPU/cloud).

## 1. Bốn nhóm bài toán AI phổ biến nhất trong bán quần áo online

### 1.1 Virtual try-on (mặc thử ảo)

Hai trường phái kỹ thuật hoàn toàn khác nhau, hay bị gộp chung vì cùng tên gọi:

- **2D sinh ảnh bằng diffusion model** (CatVTON, IDM-VTON, OOTDiffusion...):
  input là 1 ảnh người + 1 ảnh quần áo, output là ảnh người đó "mặc" quần áo,
  do model sinh lại toàn bộ pixel vùng thân trên/dưới — bao gồm cả nếp gấp,
  đổ bóng, độ rơi của vải theo dáng người trong ảnh gốc. Chân thực nhất hiện
  nay, nhưng cần GPU (suy luận vài giây/ảnh trên GPU tầm trung, chậm hơn
  nhiều lần trên CPU) hoặc gọi API cloud trả phí; không tạo ra một mô hình 3D
  có thể xoay 360°, chỉ là một tấm ảnh 2D cố định góc nhìn.
- **3D garment draping**: mô phỏng vật lý vải (mass-spring hoặc position-based
  dynamics) trên một mesh quần áo 3D thật, rơi theo trọng lực quanh một avatar
  3D. Cho kết quả xoay được 360°, đúng vật lý nhất, nhưng cần có sẵn *mesh 3D*
  của từng món đồ (không phải ảnh chụp) — chi phí sản xuất asset rất cao, hầu
  như chỉ khả thi với các sàn TMĐT lớn có ngân sách dựng lại toàn bộ catalogue
  thành 3D.

**Giải pháp của đồ án này** (projected texture — "dán ảnh 2D lên mesh 3D theo
phép chiếu") là một lựa chọn thứ ba, đứng giữa: không cần GPU/model sinh ảnh,
không cần mesh 3D của quần áo, chỉ cần 2 ảnh chụp phẳng (trước/sau) và một
phép chiếu hình học cố định. Đổi lại: không mô phỏng vải rơi/nhăn thật — ảnh
"dán" phẳng lên bề mặt cơ thể, chỉ đúng khi nhìn gần với góc chụp gốc, và
không tự khớp khi cơ thể avatar thay đổi hình dạng nhiều (vì phép chiếu được
tính một lần trên dáng neutral — xem `src/lib/tryon/projectorSetup.ts`). Đây
là một xấp xỉ hợp lý cho một bản demo/POC, không phải sản phẩm thương mại
hoàn chỉnh.

### 1.2 Gợi ý size / dự đoán vừa vặn (fit prediction)

Dùng lịch sử đổi trả + số đo người dùng (tự nhập hoặc suy từ ảnh) để dự đoán
"size nào vừa" cho một sản phẩm cụ thể, thường bằng mô hình học máy cổ điển
(gradient boosting) trên dữ liệu bảng, không cần deep learning nặng. Đây là
nhóm bài toán "AI nhẹ" — rẻ, dễ triển khai, ROI cao (giảm tỷ lệ đổi trả) — và
là hướng **tự nhiên để nối tiếp module `avatarMorphService.ts`** của đồ án:
số đo cơ thể đã có sẵn (form nhập tay hoặc suy từ solver), chỉ cần thêm bảng
size chart của từng nhãn hàng để so khớp.

### 1.3 Visual search & recommendation

- **Visual search**: người dùng tải lên một ảnh (chụp ngoài đường, ảnh mạng xã
  hội) để tìm sản phẩm tương tự trong catalogue — dùng embedding ảnh (CLIP hoặc
  tương đương) rồi tìm kiếm lân cận gần nhất (vector search).
- **Recommendation engine**: gợi ý sản phẩm dựa trên hành vi (collaborative
  filtering) hoặc đặc trưng sản phẩm (content-based), càng ngày càng kết hợp
  cả embedding hình ảnh lẫn văn bản mô tả.

Cả hai đều là AI "phía sau", không cần hiển thị 3D, triển khai độc lập với
phần avatar của đồ án này — nhưng cùng chia sẻ hạ tầng embedding/vector search
nếu triển khai chung một hệ thống.

### 1.4 Chatbot tư vấn & dự báo xu hướng/nhu cầu

Chatbot dựa trên LLM để tư vấn chọn đồ, trả lời câu hỏi về size/chất liệu;
và các mô hình dự báo nhu cầu (time-series) để tối ưu nhập hàng theo mùa/xu
hướng. Đây là hai mảng ứng dụng LLM/ML kinh doanh, không liên quan trực tiếp
tới phần dựng hình avatar nhưng thường xuất hiện cùng trong một nền tảng TMĐT
thời trang "AI-powered" hoàn chỉnh.

## 2. Bảng so sánh nhanh

| Hướng | Cần GPU/cloud trả phí? | Cần asset 3D quần áo? | Độ chân thực | Xoay 360°? |
| --- | --- | --- | --- | --- |
| Diffusion 2D try-on (CatVTON, IDM-VTON) | Có | Không (chỉ ảnh) | Rất cao | Không |
| 3D garment draping (mô phỏng vật lý vải) | Tuỳ (dựng mesh tốn công hơn tốn GPU) | Có (mesh 3D) | Cao nhất, đúng vật lý | Có |
| **Projected texture (đồ án này)** | Không | Không (chỉ ảnh) | Trung bình (ảnh "dán" phẳng) | Có (nhưng không đổi hình khi xoay) |
| Fit prediction (size chart ML) | Không | — | — (không phải hiển thị hình) | — |
| Visual search / recommendation | Có thể (embedding) hoặc CPU nhẹ | Không | — | — |

## 3. Vì sao chọn projected texture cho đồ án này

Quyết định xuất phát từ ràng buộc thực tế: máy hiện tại **chưa có giải pháp
GPU/cloud** để chạy hoặc gọi mô hình diffusion try-on, và việc dựng mesh 3D
cho từng món quần áo (để mô phỏng vải) vượt quá phạm vi một đồ án tốt nghiệp
đơn lẻ. Projected texture tận dụng đúng phần dữ liệu đã có sẵn từ Phase 1
(landmarks vai/hông trong `avatar-metadata.json`) để tự động khung phép chiếu,
không cần hiệu chỉnh tay, và chạy hoàn toàn real-time trên GPU thông thường
của trình duyệt (WebGL, không cần suy luận mô hình).

Phần "AI" duy nhất trong pipeline mặc thử là bước tách nền ảnh quần áo
(`@imgly/background-removal`) — chạy bằng WASM/ONNX ngay trong trình duyệt,
không tốn GPU rời, không gọi API trả phí. Đây là lựa chọn nhất quán với ràng
buộc "chưa có giải pháp GPU/cloud".

## 4. Hạn chế đã biết & hướng mở rộng

- Phép chiếu là tĩnh, tính một lần trên dáng neutral — khi người dùng kéo
  morph "chest"/"waist" mạnh, ảnh quần áo có thể lệch nhẹ khỏi vị trí da thật.
  Hướng khắc phục: tính lại phép chiếu (hoặc UV-warp cục bộ) mỗi khi morph
  thay đổi đáng kể, đánh đổi lấy chi phí tính toán mỗi frame.
- Không mô phỏng vải rơi/nhăn — nếu sau này có GPU, hướng nâng cấp tự nhiên là
  thay thế lớp overlay này bằng pipeline CatVTON đã được phác thảo sẵn trong
  `README_VTON.md` gốc (dùng `CaptureBridge`/`landmarks3D()` của
  `avatarMorphService.ts`, vốn đã cố tình để sẵn nhưng không dùng ở
  `/avatar-test` — xem `src/lib/avatar/avatarMorphService.ts` §4.8).
- Việc so khớp size (mục 1.2) là phần "AI thương mại" rẻ và có ROI cao nhất
  để làm tiếp nếu đồ án mở rộng sang hướng bán hàng thật, vì hạ tầng số đo
  (form nhập tay + solver) đã có sẵn từ Phase 1.

## 5. Tham khảo

- MakeHuman CC0 asset & `plugins/0_modeling_a_measurement.py` (nguồn
  `MEASURE_RINGS`) — xem `tools/avatar-pipeline/PROVENANCE.md`.
- CatVTON, IDM-VTON, OOTDiffusion — các mô hình diffusion virtual try-on công
  khai (tham khảo tên gọi, không phải tích hợp trực tiếp trong đồ án này).
- Kỹ thuật "projected texture mapping" / decal projection — kỹ thuật đồ họa
  thời gian thực kinh điển (không phải phát minh riêng của đồ án), áp dụng lại
  cho bài toán mặc thử quần áo.
