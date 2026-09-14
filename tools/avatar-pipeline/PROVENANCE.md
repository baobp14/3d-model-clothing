# Nguồn gốc dữ liệu & giấy phép

## Asset 3D (mesh, target hình thể)

Toàn bộ asset trong `mh-data/` được tải bằng `fetch_assets.py` từ repo công khai
[makehumancommunity/makehuman](https://github.com/makehumancommunity/makehuman)
(nhánh `master`, thư mục `makehuman/data/...`). Các asset này được phát hành
theo **CC0 1.0 Universal** (xem `mh-data/LICENSE.ASSETS.md`, chính nó cũng được
tải về bởi cùng script) — dùng, sửa, phân phối, thương mại hoá tự do, không bắt
buộc attribution.

Không có code ứng dụng MakeHuman (giấy phép AGPL) nào được copy hay dẫn xuất.

## Ngoại lệ: measurement vertex loops (`MEASURE_RINGS`)

`build_avatar_glb.py` chứa nguyên văn danh sách chỉ số vertex dùng để đo vòng
ngực/eo/mông/cổ/vai/tay/chân (`MEASURE_RINGS`), chép lại từ class `Ruler` trong
`plugins/0_modeling_a_measurement.py` của mã nguồn MakeHuman (AGPL). Đây là
**dữ liệu số thuần** (một danh sách chỉ số vertex cố định của một mesh CC0),
không phải logic chương trình có tính sáng tạo — dùng nó không kéo theo nghĩa
vụ AGPL đối với phần còn lại của dự án này.

## Thuật toán tìm landmark

Thuật toán tìm acromion trái/phải và điểm crotch (Phụ lục C của
`AVATAR_TEST_HANDOFF.md`) là code tự viết cho dự án này, không sao chép từ
MakeHuman.

## Credit hiển thị

Trang `/avatar-test` ghi credit MakeHuman ở footer, dù CC0 không bắt buộc, vì
đó là việc nên làm.
