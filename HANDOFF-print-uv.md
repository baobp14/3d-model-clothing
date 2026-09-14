# Handoff — ảnh in / texture allover map lên mesh áo bị lệch & co

## TL;DR

Khi upload **ảnh sản phẩm chụp phẳng** (nhất là áo hoa văn allover hoặc áo raglan panel tương phản)
và dán lên mesh áo 3D, hoa văn bị **co vào một dải giữa ngực, lệch tâm, tỉ lệ sai**.
Nguyên nhân gốc: mesh áo chỉ có **một bộ UV chiếu phẳng (planar projection)**, không phải
layout rập từng mảnh. Vùng `torsoFront` chỉ chiếm **u ∈ [0.25, 0.75]** (giữa 50% của trục U)
và **dùng chung không gian V** với `torsoBack`, `sideSeam`, `hem`, `yoke`. Không có hình chữ
nhật riêng cho "mặt trước áo" để ảnh chụp phẳng map 1:1.

**Việc cần làm:** thêm một bộ UV thứ hai (attribute `_ARTUV`) là **unwrap từng panel thật**
(front → 1 chữ nhật, back → 1 chữ nhật, tay → chữ nhật riêng hoặc bỏ), rồi shader in lấy
`_ARTUV` thay vì `uv`. `uv` hiện tại giữ nguyên cho weave bump map.

---

## 1. Bối cảnh dự án

- Next.js 16 (App Router) + React Three Fiber. `npm run dev` → http://localhost:3000
- Trang liên quan:
  - `/garment-test` — mặc thử áo 3D, có panel "Ảnh in lên áo" (upload mặt trước / mặt sau)
  - `/mask-test` — test tách nền ảnh áo, có chế độ "Dán lên áo · model mặc (3D)"
- Mesh áo: `public/models/garment-tshirt.glb` (4 size S/M/L/XL), sinh bởi
  `tools/garment-pipeline/build_garment_glb.py` từ mesh cơ thể MakeHuman.
  Metadata: `public/models/garment-metadata.json`.
- Mesh áo là mesh thật có mô phỏng vải (PBD/Verlet), KHÔNG phải ảnh phẳng. Ảnh in được
  **blend vào màu vải trong shader** theo trọng số `_FACING` trước/sau, cố định theo đỉnh
  (baked) để hoa văn "dính vào sợi vải" khi áo chuyển động — KHÔNG dùng projected texture.

---

## 2. Triệu chứng (ảnh người dùng gửi)

- Áo raglan: panel thân hoa văn "vẹt/chim", tay + hông màu xanh rêu trơn.
- Trên mesh 3D: hoa văn chim chỉ hiện ở **một dải dọc giữa ngực** (~50-60% bề rộng thân),
  hai bên hông + vai + tay ra màu rêu (màu trung bình của ảnh). Hoa văn bị **nén ngang**
  và mép dải không thẳng (theo nếp gấp vải).
- Với ảnh có logo nhỏ ở ngực (ví dụ `makeSamplePrints`) thì OK — logo nằm giữa ngực, cân.
  Vấn đề chỉ lộ với ảnh phủ rộng.

---

## 3. Phân tích nguyên nhân (đã đo)

Dump UV theo region của `tshirt_M` (script ở cuối file):

```
region       n      u range          v range          x range (m)        z range (m)
torsoFront   232  [+0.25,+0.75]   [+0.05,+0.86]   [-0.117,+0.117]  [+0.042,+0.104]
torsoBack    381  [+0.12,+0.89]   [+0.05,+0.86]   [-0.181,+0.182]  [-0.216,-0.086]
sideSeam     362  [+0.04,+0.96]   [+0.05,+0.86]   [-0.215,+0.214]  [-0.121,+0.079]
hem           64  [+0.03,+0.97]   [+0.00,+0.05]   [-0.221,+0.221]  [-0.201,+0.052]
yoke         201  [+0.00,+1.00]   [+0.86,+0.99]   [-0.235,+0.235]  [-0.163,+0.045]
collar        38  [+0.33,+0.67]   [+0.91,+1.00]   [-0.081,+0.081]  [-0.135,+0.031]
sleeveRight  170  [+0.74,+1.16]   [+0.69,+0.92]   [+0.114,+0.310]  [-0.156,+0.014]
sleeveLeft   170  [-0.16,+0.26]   [+0.69,+0.92]   [-0.310,-0.114]  [-0.156,+0.014]
```

- UV hiện tại (`build_garment_glb.py`, phần "UV de dan anh san pham"):
  `u = 0.5 + x_local / (2 * torso_half)`, `v = (y_local - y_min) / (y_max - y_min)`
  với `torso_half = max(|x|)` trên các region thân = **0.235 m** (lấy từ `yoke`, chỗ rộng nhất).
- Ngực (`torsoFront`) chỉ rộng ±0.117 m → chỉ chiếm **u ∈ [0.25, 0.75]**. Ảnh map 0..1 lên
  toàn trục → mặt trước áo chỉ "thấy" **giữa 50%** của ảnh; 25% trái + 25% phải của ảnh rơi
  vào tay/lưng/không nhìn thấy → nhìn như ảnh bị crop/zoom vào ngực.
- `torsoFront` và `torsoBack` chồng V-range → cần `_FACING` tách. `sideSeam` quấn quanh hông
  (z từ -0.12 đến +0.08) nên nửa trước nửa sau.
- Không có rectangle "mặt trước" nào để rập ảnh phẳng map 1:1 → mọi cách chuẩn hóa 1 planar UV
  đều méo.

---

## 4. Đã thử (không giải quyết triệt để)

Tất cả nằm ở nhánh hiện tại, giữ lại vì đều cải thiện phần nào:

| Thử | File | Kết quả |
|---|---|---|
| `trimToContent()` — cắt lề trong suốt của cutout trước khi làm texture | `src/lib/tryon/backgroundRemoval.ts` | Ảnh không còn co cụm bé xíu giữa áo. Vẫn méo. |
| `averageOpaqueColor()` — lấy màu TB ảnh làm màu vải nền (tay/cổ không có ảnh thì ra màu này) | `backgroundRemoval.ts` + prop `baseColor` | Hết dải tương phản ở vai/tay. Không sửa méo. |
| `_FACING` tính lại theo VỊ TRÍ (`local z`) thay vì normal baked (normal rung do decimate) | `src/components/garment-test/GarmentClothCanvas.tsx` (`FACE_BAND = 0.05`) | Ảnh mặt trước phủ tới vai/mặt trước tay tốt hơn. Không sửa méo ngang. |
| `_printmask` = 0 trên region `collar` → ảnh in không đè lên cổ (không bị "viền cổ đôi") | `GarmentClothCanvas.tsx` shader | OK, giữ. |
| UV chuẩn hóa `u` theo `torso_half` thay vì bề rộng đầu-tay-đến-đầu-tay | `build_garment_glb.py` | Đỡ hơn (trước còn tệ hơn) nhưng ngực vẫn chỉ u∈[0.25,0.75]. |
| `blobToTexture` dùng `imageOrientation: 'flipY'` + `flipY = false` | `backgroundRemoval.ts` | Sửa bug ảnh upload bị LỘN NGƯỢC (không liên quan méo, nhưng cần). |

---

## 5. Hướng sửa đề xuất (proper fix)

### 5.1. Thêm attribute `_ARTUV` (VEC2) — UV unwrap từng panel

Trong `tools/garment-pipeline/build_garment_glb.py`:

1. **Giữ `uv` planar hiện tại** (weave bump map `makeWeaveBump` trong
   `GarmentClothCanvas.tsx` dùng `geom.uv` với `RepeatWrapping` — đừng phá).

2. **Sinh mảng `art_uv` mới** (mỗi đỉnh 1 cặp), theo region:
   - `torsoFront` (+ nửa trước của `yoke`, `sideSeam`, `hem`): unwrap thành hình chữ nhật
     `u ∈ [0,1]`, `v ∈ [0,1]`. Cách tốt: **arc-length quanh trục thân** (cylindrical unwrap)
     để hoa văn shrink-wrap, không shear:
     - `theta = atan2(x_local, z_local - z_center)` chuẩn hóa về [-pi/2, +pi/2] cho nửa trước
       → `u = 0.5 + theta / pi` (hoặc scale theo chu vi nửa trước)
     - `v = (y_local - y_hem) / (y_collar - y_hem)`
     - Hoặc đơn giản hơn: `u = 0.5 + x_local / (2 * half_width_at_that_height)` với
       `half_width_at_that_height` nội suy theo chiều cao (ngực rộng, eo hẹp) → pattern bám body.
   - `torsoBack` (+ nửa sau các region trên): unwrap tương tự thành `u ∈ [0,1], v ∈ [0,1]`.
     Shader ĐÃ tự mirror backMap (`vec2(1.0 - vArtUv.x, vArtUv.y)`), nên back panel dùng
     cùng công thức u là được.
   - `sleeveLeft/Right`, `cuffLeft/Right`: hoặc unwrap ống tay thành chữ nhật riêng
     (`u` = góc quanh trục tay, `v` = dọc `arm_t`), hoặc để `art_uv` = (clamp ra ngoài [0,1])
     và giữ fallback màu trung bình như hiện tại.
   - `collar`: bất kỳ (đang bị `_printmask=0` che).

3. **Ghi accessor + bufferView cho `_ARTUV`** giống hệt cách file này đã làm cho
   `_REGION` và `_FACING` (tìm `pack_region_bytes`, `_FACING`, `_REGION` trong file để copy pattern).
   Thêm `"artUvAttribute"` vào metadata nếu muốn.

### 5.2. Đọc `_ARTUV` ở phía client

- `src/lib/tryon/garmentFit.ts`: type `GarmentGeometry` — thêm `artUv?: Float32Array`.
- `src/components/garment-test/GarmentTestApp.tsx` (`useEffect` load GLB, chỗ đọc
  `_region` / `_facing`): đọc thêm `_ARTUV` → `geom.artUv`.
- `src/components/mask-test/Tryon3DPreview.tsx`: y hệt (đang load riêng, cùng pattern).
- `src/components/garment-test/GarmentClothCanvas.tsx` (`geometry` useMemo): set attribute
  `g.setAttribute('_artuv', new THREE.BufferAttribute(geom.artUv ?? <fallback dùng uv>, 2))`.

### 5.3. Shader

`GarmentClothCanvas.tsx` `onBeforeCompile`:
- vertexShader: thêm `attribute vec2 _artuv; ... vArtUv = _artuv;` (thay `vArtUv = uv;`).
- fragmentShader: giữ nguyên (`texture2D(frontMap, vArtUv)` / back mirror). ĐÃ có `vArtUv`.

### 5.4. Kỳ vọng sau khi sửa

- Ảnh mặt trước map **kín mặt trước áo** (không phải giữa 50%).
- Không nén ngang / lệch tâm.
- `makeSamplePrints` (logo giữa ngực) vẫn phải trông đúng — logo ở `_artuv` (0.5, ~0.6).
  Có thể cần chỉnh toạ độ vẽ logo trong `makeSamplePrints` cho khớp UV mới.

---

## 6. File & vị trí quan trọng

| File | Vai trò | Chỗ cần đụng |
|---|---|---|
| `tools/garment-pipeline/build_garment_glb.py` | Sinh `garment-tshirt.glb` | phần `# --- UV de dan anh san pham ---` (~dòng 787); phần ghi accessor `_REGION`/`_FACING` để copy cho `_ARTUV`; phần `# --- gan nhan vung ---` (region assignment, ~dòng 755) |
| `src/lib/tryon/garmentFit.ts` | Type + solver | `interface GarmentGeometry` (~dòng 356); `GARMENT_REGION` enum (~dòng 300) |
| `src/components/garment-test/GarmentClothCanvas.tsx` | Renderer áo + shader in | `geometry` useMemo (attrs `_facing`, `_printmask`, sẽ thêm `_artuv`); `onBeforeCompile` (shader in, ~dòng 158-230) |
| `src/components/garment-test/GarmentTestApp.tsx` | Trang garment-test | `loadPrint()` (~dòng 149); `useEffect` load GLB đọc `_region`/`_facing` (~dòng 205-224); prop truyền vào `<GarmentClothCanvas>` (~dòng 486) |
| `src/lib/tryon/backgroundRemoval.ts` | Tách nền + tiện ích ảnh | `removeGarmentBackground`, `trimToContent`, `averageOpaqueColor`, `blobToTexture` |
| `src/components/mask-test/MaskTestApp.tsx` | Trang mask-test (2D + 3D toggle) | — |
| `src/components/mask-test/Tryon3DPreview.tsx` | Preview 3D trong mask-test | load GLB riêng (đọc `_region`/`_facing`); dựng `<GarmentClothCanvas>` |
| `public/models/garment-tshirt.glb` | Output build | (regenerate) |
| `public/models/garment-metadata.json` | Output build | `regions`, `sizes`, `sizeOrder` |

### GARMENT_REGION ids
`torsoFront=0, torsoBack=1, sideSeam=2, hem=3, yoke=4, collar=5, sleeveRight=6, sleeveLeft=7, cuffRight=8, cuffLeft=9`

### Toạ độ local của mesh áo
`build_garment_glb.py` shift về: `y = 0` ở đường vai, hem ở `y` âm (~-0.66), cổ ở `y` hơi dương;
**front là +Z**, `z = 0` ở trục thân người. `x = 0` ở tâm người, `x` âm = bên trái người mặc.

### Shader in hiện tại (rút gọn)
```glsl
// vertex: vFacing = _facing; vPrintMask = _printmask; vArtUv = uv;
// fragment, sau #include <map_fragment>:
if (hasPrint > 0.5) {
  vec4 f = texture2D(frontMap, vArtUv);
  vec4 b = texture2D(backMap, vec2(1.0 - vArtUv.x, vArtUv.y));
  vec4 art = mix(b, f, vFacing);
  diffuseColor.rgb = mix(diffuseColor.rgb, art.rgb, art.a * vPrintMask);
}
```
`frontMap`/`backMap` mặc định = `EMPTY_TEX` (trong suốt). `hasPrint` = 1 khi có ảnh.

---

## 7. Build & kiểm tra

```bash
npm run garment:build      # sinh lại public/models/garment-tshirt.glb + metadata
npm run garment:report     # 7 assertion hành vi vải — PHẢI vẫn 7/7 PASS (UV không đụng sim)
npm run typecheck          # tsc --noEmit
npm run dev                # http://localhost:3000
```

`garment:report` không kiểm UV — sau khi đổi UV vẫn phải `Drape report OK` và 7/7 PASS
(vì UV không ảnh hưởng mô phỏng). Kiểm UV bằng mắt ở `/garment-test`:
1. Chọn size M, người mẫu B.
2. Panel "Ảnh in lên áo" → upload 1 ảnh áo hoa văn allover chụp phẳng (hoặc bấm "Dùng ảnh mẫu"
   để test logo).
3. Xoay người xem hoa văn có phủ đều mặt trước, không nén/lệch, có "dính" vào vải khi áo động.
4. `/mask-test` → "Dùng ảnh mẫu" → chế độ "Dán lên áo · model mặc (3D)" để test đường
   `removeGarmentBackground → trimToContent → texture`.

---

## 8. Script dump UV (chạy lại để đo)

```python
# node/python đều được; đây là python thuần đọc GLB
import json, struct
d = open("public/models/garment-tshirt.glb", "rb").read()
off = 12; chunks = []
while off < len(d):
    ln, ty = struct.unpack_from("<II", d, off); chunks.append((ty, d[off+8:off+8+ln])); off += 8+ln
g = json.loads(chunks[0][1]); binb = chunks[1][1]
def acc(i):
    a = g["accessors"][i]; bv = g["bufferViews"][a["bufferView"]]
    st = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    nc = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]
    fmt = {5126: "f", 5125: "I", 5123: "H", 5121: "B"}[a["componentType"]]
    sz = struct.calcsize("<" + fmt); stride = bv.get("byteStride") or nc*sz
    return [struct.unpack_from("<" + fmt*nc, binb, st + k*stride) for k in range(a["count"])]
INV = {0:"torsoFront",1:"torsoBack",2:"sideSeam",3:"hem",4:"yoke",5:"collar",6:"sleeveRight",7:"sleeveLeft",8:"cuffRight",9:"cuffLeft"}
for mesh in g["meshes"]:
    if mesh["name"] != "tshirt_M": continue
    pr = mesh["primitives"][0]
    pos = acc(pr["attributes"]["POSITION"]); uv = acc(pr["attributes"]["TEXCOORD_0"])
    reg = [int(x[0]) for x in acc(pr["attributes"]["_REGION"])]
    byr = {}
    for i, r in enumerate(reg):
        e = byr.setdefault(INV[r], {"u":[9,-9],"v":[9,-9],"x":[9,-9],"z":[9,-9],"n":0}); e["n"] += 1
        for k, arr, val in (("u",uv[i],uv[i][0]),("v",uv[i],uv[i][1]),("x",pos[i],pos[i][0]),("z",pos[i],pos[i][2])):
            e[k][0] = min(e[k][0], val); e[k][1] = max(e[k][1], val)
    for n, e in byr.items():
        print(n, e["n"], "u", e["u"], "v", e["v"], "x", e["x"], "z", e["z"])
```
