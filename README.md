# Đồ án tốt nghiệp — Avatar 3D & mặc thử (texture 3D)

## Chạy nhanh

```bash
npm install
npm run avatar:fetch     # tải asset CC0 MakeHuman về tools/avatar-pipeline/mh-data/ (~7.6 MB)
npm run avatar:build     # OBJ + .target -> public/models/avatar-{male,female}.glb + avatar-metadata.json
npm run dev
# mở http://localhost:3000/avatar-test
```

Nếu `public/models/*.glb` đã có sẵn (output tất định, không bị gitignore) thì
bỏ qua 2 lệnh `avatar:fetch`/`avatar:build`.

Kiểm chứng: `npm run avatar:verify` (GLB load được, 22 morph target) và
`npm run avatar:report` (sai số solver ≤ 0.25 cm cho 4 profile A/B/C/F).

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `tools/avatar-pipeline/` | Pipeline Python (fetch + build GLB) + script kiểm chứng Node |
| `src/lib/avatar/avatarMorphService.ts` | Lõi số đo ↔ morph target, thuần TS, chạy headless được |
| `src/lib/avatar/bodyProfiles.ts` | 4 profile mẫu (A/B/C/female) dùng để test |
| `src/lib/tryon/` | Mặc thử: khung phép chiếu (`projectorSetup.ts`), shader chiếu ảnh lên mesh (`projectedGarmentMaterial.ts`), tách nền ảnh client-side (`backgroundRemoval.ts`) |
| `src/components/avatar-test/` | UI trang `/avatar-test` (canvas 3D, form, debug panel, validation panel, upload áo) |
| `docs/RESEARCH_AI_ECOMMERCE_FASHION.md` | Nghiên cứu: các hướng AI trong TMĐT thời trang, so sánh với giải pháp đã chọn |

Toàn văn spec dựng lại Phase 1 (avatar 3D) nằm ở
`C:\Users\legia\Downloads\AVATAR_TEST_HANDOFF.md` (không copy vào repo này vì
là tài liệu bàn giao gốc, không phải tài liệu dự án).

## Ghi chú quan trọng

- **Next.js 16**: khác với training data của nhiều AI coding assistant — đọc
  `node_modules/next/dist/docs/` trước khi sửa App Router/dynamic import.
- **Try-on là projected texture, không phải AI sinh ảnh**: xem
  `docs/RESEARCH_AI_ECOMMERCE_FASHION.md` để hiểu vì sao chọn hướng này (không
  có GPU/cloud) và giới hạn của nó (ảnh "dán" phẳng, không mô phỏng vải rơi).
- License asset: CC0 1.0 (MakeHuman) — xem `tools/avatar-pipeline/PROVENANCE.md`.
