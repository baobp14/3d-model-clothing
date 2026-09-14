#!/usr/bin/env python3
"""Build public/models/garment-tshirt.glb + garment-metadata.json.

Mesh ao duoc LAY KHUON TU CHINH MESH CO THE MakeHuman, khong sinh bang cong
thuc nua.

Vi sao doi: ban procedural dung than ao la mot ong tron va tay ao la mot ong
thang, roi phai khoet vong nach va han hai cai lai. Nhung lo vong nach nam
tren mat hong cua than (phap tuyen ~ +-X) con truc canh tay nghieng 51 do so
voi mat do, nen ong tay deu goc moc ra tu mot vong bien meo o goc cheo -- ket
qua la hai cai "canh" xoe ra, co bac gay ro o vai. Vong nach that la mot
duong cong yen ngua 3 chieu, khong phai lo tron cat tren ong; do la ly do
nguoi ta model quan ao bang tay chu khong sinh bang cong thuc.

Lay khuon tu co the thi VAN DE VONG NACH BIEN MAT: than va tay von da la mot
mat lien tren co the, san dung hinh yen ngua o nach. Khong con moi han, khong
con khe ho, khong con xoe.

Mesh van CO DINH THEO SIZE (khong bind vao nguoi dung) nen tin hieu chat/rong
giu nguyen -- chi la hinh dang goc lay tu mot co the tham chieu, dung nhu ao
that duoc may tren ma-no-canh chuan.

He toa do xuat ra: y = 0 tai DUONG VAI, z = 0 tai truc than, MAT TRUOC LA +Z.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT.parent / "avatar-pipeline"))

from build_avatar_glb import (  # noqa: E402
    MEASURE_RINGS,
    MH,
    MH_TO_METRES,
    BufferBuilder,
    build_render_mesh,
    compute_render_positions,
    compute_smooth_normals,
    find_landmarks,
    pack_uint32_array,
    pack_vec2_array,
    pack_vec3_array,
    parse_obj,
    vec3_min_max,
    write_glb,
)

OUT_DIR = ROOT.parent.parent / "public" / "models"

# --- Bang size ao thun unisex (cm) -------------------------------------------
# chest        : chu vi vong nguc CUA AO
# bodyLength   : dai ao, do tu HPS (mep co tren vai) xuong gau
# sleeveLength : dai tay ao, do tu mom vai doc theo truc canh tay
# sleeveOpening: chu vi cua tay -- co RIENG, khong an theo ti le vong nguc
SIZE_CHART = {
    "S": {"chest": 92.0, "bodyLength": 66.0, "sleeveLength": 18.0, "sleeveOpening": 34.0},
    "M": {"chest": 98.0, "bodyLength": 68.0, "sleeveLength": 19.0, "sleeveOpening": 36.0},
    "L": {"chest": 104.0, "bodyLength": 70.0, "sleeveLength": 20.0, "sleeveOpening": 38.0},
    "XL": {"chest": 110.0, "bodyLength": 72.0, "sleeveLength": 21.0, "sleeveOpening": 40.0},
}
SIZE_ORDER = ["S", "M", "L", "XL"]

# Cach anh in san pham can vao _ARTUV.
#
# _ARTUV la chieu phang bong ao o tu the T; anh chup ao TRAI PHANG co tay xoe
# hep hon mot chut, nen phai zoom + dich nhe cho khop. Do bang mat mot lan
# tren anh mau chuan; moi kieu bo cuc anh (chup ao trai phang, tay xoe deu,
# co o tren, gau o duoi) dung chung mot bo so nay. Client nap tu day lam gia
# tri MAC DINH cua thanh chinh; nguoi dung van keo lai duoc.
#   scale > 1  -> hoa van nho lai
#   offsetY < 0 -> anh dich len tren
PRINT_CALIBRATION = {"scale": 0.83, "offsetX": 0.0, "offsetY": -0.03}

CM = 0.01

# Khe ho vai - da khi may (m). Ao khong nam sat da, va day cung la be day vai.
FABRIC_GAP = 0.012

# Canh o gop dinh (m). Mesh co the qua min cho mo phong vai: giu nguyen thi ao
# co 6.2k dinh, settle mat 10 giay va maxStretch len 2.2 vi canh qua ngan.
# Gop ve ~1.5 cm dua so dinh ve tam 2k, ngang ban procedural cu.
DECIMATE_CELL = 0.015

# Truc canh tay o tu the A, do bang probe_body_anchors.mjs tren chinh avatar.
ARM_AXIS_RIGHT = (0.6270, -0.7787, 0.0219)
# Dinh nam trong ban kinh nay quanh truc canh tay thi tinh la THUOC CANH TAY,
# de tach khoi than khi cat theo chieu cao (canh tay o tu the A thong xuong
# duoi ca duong gau, nen cat theo y khong thoi la khong du).
ARM_PICK_RADIUS = 0.145

# Truc chan o tu the A (do bang script probe tren chinh base mesh): chan xoe
# nhe ra ngoai + ra truoc mot chut, chu yeu di xuong. Goc chan gan day chau.
LEG_AXIS_RIGHT = (0.1893, -0.9815, 0.0292)
LEG_ORIGIN_RIGHT = (0.0867, 0.7441, 0.0260)
LEG_PICK_RADIUS = 0.13
LEG_LENGTH_REF = 0.705  # day chau -> co chan tren co the tham chieu

# Duong co ao, tinh tu duong vai (mom vai / acromion).
#
# Co ao phong KHONG PHANG: phia sau cao gan bang mom vai, phia truoc trung
# xuong. Cat bang mot mat phang ngang cao hon mom vai 3.8 cm thi o do cao do
# da la than co roi -- ao thanh cai co lo om lay co, khong ra co ao phong.
NECKLINE_BACK = 0.015    # giua gay, tren mom vai mot chut
NECKLINE_FRONT = -0.026  # giua truoc, trung xuong duoi mom vai
# Lo co, do tu truc co. Trong NECK_R_INNER la duong co; ngoai NECK_R_OUTER da
# la vai vai, phai cao len che kin mom vai; giua hai moc thi chuyen muot.
#
# Dat rong qua thi nhin TU TREN XUONG se thay hai mang vai lo ra hai ben co --
# trong het nhu ao bi thung o vai, du mesh hoan toan lien. Ban dau vai chi bat
# dau che tu ban kinh 11 cm, nhan them ti le size thanh 12.4 cm, tuc lo co rong
# gan 25 cm; co tron ao phong that rong khoang 18 cm.
NECK_R_INNER = 0.045
NECK_R_OUTER = 0.095

# Phan tren nguc chi an mot phan ti le vong nguc: 1.0 la an het, 0.0 la giu
# nguyen ti le co the tham chieu.
#
# Dat thap thi vai ao HEP HON nguoi mac: yen vai bi keo cang het co (46-59% so
# canh vuot 1.15 o dai tren duong vai) trong khi ngay duoi no, o nguc tren,
# vai lai chung (17% so canh duoi 0.95). Mot dai cang nam ngay tren mot dai
# chung thi cho giap nhau bi rum lai thanh mot cai go vat ngang nguc -- do
# chinh la cho "co rum o vu". Do goc gap trung binh o dai do: 0.35 -> 18.1 do,
# 0.60 -> con te hon (20.6), 0.85 -> 7.3, 1.00 -> 7.5.
SHOULDER_SCALE_SHARE = 0.85
SHOULDER_TOP = 0.045     # mep tren cua vai ao, tren mom vai
# Do tu mesh goc: song vai (song tren cung cua vai) nam cao hon mom vai
# (acromion) khoang +2.4 den +3.7 cm, tu ban kinh 12 cm ra den 20 cm. Cat o
# +2.0 cm la cat NGAY DUOI song vai, chua lai mot dai da doc song vai --
# nhin tu tren xuong dung la hai mang vai ho ra hai ben co. Phai cat cao hon
# dinh song vai thi ao moi trum qua duoc.
# HPS = diem cao nhat cua duong co, la goc do chieu dai ao theo bang size.
HPS_RISE = NECKLINE_BACK
# Nua be day than dung de chuan hoa z khi noi suy truoc <-> sau.
NECK_DEPTH_REF = 0.075

REGION = {
    "torsoFront": 0,
    "torsoBack": 1,
    "sideSeam": 2,
    "hem": 3,
    "yoke": 4,
    "collar": 5,
    "sleeveRight": 6,
    "sleeveLeft": 7,
    "cuffRight": 8,
    "cuffLeft": 9,
}

FRONT_HALF_ANGLE = math.radians(55)

# --- Bang size quan unisex (cm) --------------------------------------------
# waist    : chu vi cap quan
# hip      : chu vi mong cua quan
# inseam   : dai ong trong, do tu day chau xuong gau
# hem      : chu vi ong gau (mo ong)
# rise     : dang cap -- cap cao hon day chau bao nhieu
PANTS_SIZE_CHART = {
    "S":  {"waist": 80.0,  "hip": 96.0,  "inseam": 74.0, "hem": 40.0, "rise": 16.0},
    "M":  {"waist": 86.0,  "hip": 102.0, "inseam": 76.0, "hem": 42.0, "rise": 17.0},
    "L":  {"waist": 92.0,  "hip": 108.0, "inseam": 78.0, "hem": 44.0, "rise": 18.0},
    "XL": {"waist": 98.0,  "hip": 114.0, "inseam": 80.0, "hem": 46.0, "rise": 19.0},
}

PANTS_REGION = {
    "waistband": 0,
    "seatFront": 1,
    "seatBack": 2,
    "legRight": 3,
    "legLeft": 4,
    "hemRight": 5,
    "hemLeft": 6,
    "crotch": 7,
}

# Anh chup quan trai phang: cap o tren, hai ong xoe xuong. Cung mot bo zoom/dich.
PANTS_PRINT_CALIBRATION = {"scale": 0.9, "offsetX": 0.0, "offsetY": 0.0}

# --- Bang size quan short unisex (cm) ---------------------------------------
# Cung mot dang hinh hoc voi quan dai (cap + hai ong, 3 vong bien): chi khac o
# inseam RAT NGAN (tren dau goi) va hem RONG hon nhieu vi ong short om lay bap
# dui tren chu khong thon xuong co chan. waist/hip giu giong quan dai vi cung
# la quan lung thun/day rut, khong can bang rieng.
SHORTS_SIZE_CHART = {
    "S":  {"waist": 80.0,  "hip": 96.0,  "inseam": 18.0, "hem": 56.0, "rise": 16.0},
    "M":  {"waist": 86.0,  "hip": 102.0, "inseam": 19.0, "hem": 58.0, "rise": 17.0},
    "L":  {"waist": 92.0,  "hip": 108.0, "inseam": 20.0, "hem": 60.0, "rise": 18.0},
    "XL": {"waist": 98.0,  "hip": 114.0, "inseam": 21.0, "hem": 62.0, "rise": 19.0},
}

# Anh chup short trai phang cung bo cuc voi quan dai (cap tren, ong xoe duoi).
SHORTS_PRINT_CALIBRATION = {"scale": 0.9, "offsetX": 0.0, "offsetY": 0.0}


def sub3(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def norm(v):
    n = math.sqrt(dot(v, v)) or 1.0
    return (v[0] / n, v[1] / n, v[2] / n)


class BodyReference:
    """Mesh co the trung tinh, da doi ve met, chan o y = 0, can giua theo X."""

    def __init__(self) -> None:
        obj = parse_obj(MH / "3dobjs" / "base.obj")
        render = build_render_mesh(obj)
        raw = compute_render_positions(render, obj.positions)

        min_y = min(p[1] for p in raw)
        self.positions = [
            (p[0] * MH_TO_METRES, (p[1] - min_y) * MH_TO_METRES, p[2] * MH_TO_METRES)
            for p in raw
        ]
        self.triangles = render.triangles
        self.uv = render.uv
        self.vertex_to_original = render.vertex_to_original
        # Phap tuyen tin cay cua CA CO THE (dinh huong dung tu nguon), dung lam
        # chuan de dinh huong lai tam giac tu tao (vd _close_inseam): kiem tra
        # cuc bo bang phap tuyen muot cua chinh mieng vai moi khong bat duoc
        # truong hop CA CUM tam giac quay nguoc dong bo voi nhau.
        self.normals = compute_smooth_normals(self.positions, self.triangles)

        # original vertex index -> render index (lay cai dau tien gap)
        self.orig_to_render: dict[int, int] = {}
        for i, o in enumerate(self.vertex_to_original):
            self.orig_to_render.setdefault(o, i)

        lm = find_landmarks(self.positions, self.vertex_to_original)
        left = self.positions[self.orig_to_render[lm["acromionLeft"]]]
        right = self.positions[self.orig_to_render[lm["acromionRight"]]]
        self.shoulder_y = (left[1] + right[1]) / 2.0
        self.acromion = {"left": left, "right": right}
        self.crotch_y = self.positions[self.orig_to_render[lm["crotch"]]][1]

        # Truc than theo Z lay tu vong nguc (nguc nam truoc, lung nam sau).
        chest = [self.orig_to_render[o] for o in MEASURE_RINGS["chest"]
                 if o in self.orig_to_render]
        self.axis_z = sum(self.positions[i][2] for i in chest) / len(chest)
        self.chest_ring = chest
        self.chest_y = sum(self.positions[i][1] for i in chest) / len(chest)
        self.chest_circ = self.ring_length(MEASURE_RINGS["chest"])

        # Vong eo / mong: dung cho quan, do y het cach do vong nguc.
        def _ring_center(name):
            idx = [self.orig_to_render[o] for o in MEASURE_RINGS[name]
                   if o in self.orig_to_render]
            ys = sum(self.positions[i][1] for i in idx) / len(idx)
            zs = sum(self.positions[i][2] for i in idx) / len(idx)
            return ys, zs

        self.waist_y, self.waist_z = _ring_center("waist")
        self.waist_circ = self.ring_length(MEASURE_RINGS["waist"])
        self.hip_y, self.hip_z = _ring_center("hip")
        self.hip_circ = self.ring_length(MEASURE_RINGS["hip"])
        # Tam ngang cua moi ong chan, do o ngang mong (khoang cach hai dui).
        hip_pts = [self.positions[self.orig_to_render[o]]
                   for o in MEASURE_RINGS["hip"] if o in self.orig_to_render]
        band = [p for p in hip_pts if abs(p[1] - self.hip_y) < 0.05]
        self.leg_center_x = sum(abs(p[0]) for p in band) / len(band) * 0.55
        # Ban kinh dui tho o ngang be phan (~day chau), de scale ong chan.
        thigh_band = [p for p in self.positions
                      if abs(p[1] - (self.crotch_y + 0.02)) < 0.015
                      and 0.02 < abs(p[0]) < 0.16]
        if thigh_band:
            xs_r = [p[0] for p in thigh_band if p[0] > 0]
            self.thigh_r = (max(xs_r) - min(xs_r)) / 2.0 if len(xs_r) > 1 else 0.09
        else:
            self.thigh_r = 0.09

    def ring_length(self, orig_ring) -> float:
        pts = [self.positions[self.orig_to_render[o]] for o in orig_ring
               if o in self.orig_to_render]
        total = 0.0
        for i in range(len(pts) - 1):
            total += math.dist(pts[i], pts[i + 1])
        return total

    def arm_coords(self, p):
        """(khoang cach toi truc canh tay gan nhat, hinh chieu doc truc, ben)."""
        best = None
        for side in ("right", "left"):
            sign = 1.0 if side == "right" else -1.0
            origin = self.acromion[side]
            axis = norm((ARM_AXIS_RIGHT[0] * sign, ARM_AXIS_RIGHT[1], ARM_AXIS_RIGHT[2]))
            d = sub3(p, origin)
            t = dot(d, axis)
            perp = math.sqrt(max(dot(d, d) - t * t, 0.0))
            if best is None or perp < best[0]:
                best = (perp, t, side)
        return best

    def leg_coords(self, p):
        """(khoang cach toi truc chan gan nhat, hinh chieu doc truc, ben).

        Nhu arm_coords nhung cho chan: goc o day chau, truc di xuong hoi xoe.
        """
        best = None
        for side in ("right", "left"):
            sign = 1.0 if side == "right" else -1.0
            origin = (LEG_ORIGIN_RIGHT[0] * sign, LEG_ORIGIN_RIGHT[1], LEG_ORIGIN_RIGHT[2])
            axis = norm((LEG_AXIS_RIGHT[0] * sign, LEG_AXIS_RIGHT[1], LEG_AXIS_RIGHT[2]))
            d = sub3(p, origin)
            t = dot(d, axis)
            perp = math.sqrt(max(dot(d, d) - t * t, 0.0))
            if best is None or perp < best[0]:
                best = (perp, t, side)
        return best

    def leg_axis(self, side):
        sign = 1.0 if side == "right" else -1.0
        origin = (LEG_ORIGIN_RIGHT[0] * sign, LEG_ORIGIN_RIGHT[1], LEG_ORIGIN_RIGHT[2])
        axis = norm((LEG_AXIS_RIGHT[0] * sign, LEG_AXIS_RIGHT[1], LEG_AXIS_RIGHT[2]))
        return origin, axis


def cluster_decimate(positions, uvs, triangles, source, cell):
    """Gop cac dinh roi vao cung mot o luoi thanh mot dinh o trong tam.

    Decimation kieu vertex clustering: tho nhung don gian va khong can phan
    tich lien ket. Tam giac nao co hai goc roi vao cung mot o thi bien mat --
    dung y do, do la tam giac da bi thu ve mot canh.
    """
    cluster_of: dict[tuple[int, int, int], int] = {}
    assign = [0] * len(positions)
    members: list[list[int]] = []
    for i, p in enumerate(positions):
        key = (int(math.floor(p[0] / cell)), int(math.floor(p[1] / cell)),
               int(math.floor(p[2] / cell)))
        c = cluster_of.get(key)
        if c is None:
            c = len(members)
            cluster_of[key] = c
            members.append([])
        assign[i] = c
        members[c].append(i)

    new_pos = []
    new_uv = []
    new_src = []
    for group in members:
        n = len(group)
        new_pos.append(tuple(sum(positions[i][k] for i in group) / n for k in range(3)))
        new_uv.append(uvs[group[0]])
        new_src.append(source[group[0]])

    new_tris = []
    for a, b, c in triangles:
        na, nb, nc = assign[a], assign[b], assign[c]
        if na == nb or nb == nc or nc == na:
            continue
        new_tris.append((na, nb, nc))

    # Bo cac o khong con tam giac nao.
    live = sorted({v for t in new_tris for v in t})
    remap = {o: k for k, o in enumerate(live)}
    return (
        [new_pos[i] for i in live],
        [new_uv[i] for i in live],
        [(remap[a], remap[b], remap[c]) for a, b, c in new_tris],
        [new_src[i] for i in live],
    )


def boundary_rings(triangles) -> list[list[int]]:
    """Cac vong bien ho, moi vong la day dinh noi tiep nhau.

    Duyet theo lien ket VO HUONG. Ban dau toi duyet theo chieu va gia dinh moi
    dinh bien chi co mot canh di ra -- sai ngay tai dinh ma hai lo cham nhau,
    va bo va lo bi ket o do.
    """
    count: dict[tuple[int, int], int] = {}
    for a, b, c in triangles:
        for x, y in ((a, b), (b, c), (c, a)):
            k = (min(x, y), max(x, y))
            count[k] = count.get(k, 0) + 1

    adj: dict[int, list[int]] = {}
    for (a, b), n in count.items():
        if n != 1:
            continue
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)

    seen: set[int] = set()
    rings: list[list[int]] = []
    for start in adj:
        if start in seen:
            continue
        ring: list[int] = []
        prev, cur = None, start
        while cur is not None and cur not in seen:
            seen.add(cur)
            ring.append(cur)
            cur, prev = next((c for c in adj[cur] if c != prev and c not in seen), None), cur
        if len(ring) >= 3:
            rings.append(ring)
    return rings


def fill_stray_holes(triangles, keep: int = 4) -> int:
    """Va cac lo ngoai `keep` duong ho hop le (ao: co+gau+hai cua tay = 4;
    quan: cap + hai gau = 3).

    Buoc gop dinh bo tam giac nao co hai goc roi vao cung mot o. O cho mat cong
    gap nhu chom vai, ca mot cum bien mat va de lai lo -- do la hai mang da
    nhin thay tren vai khi nhin tu tren xuong. `keep` vong lon nhat la cac
    duong ho co that; con lai va het.
    """
    # Va xong mot lo la cau truc bien doi, nen phai lap chu khong va mot luot.
    filled = 0
    for _ in range(8):
        rings = boundary_rings(triangles)
        if len(rings) <= keep:
            break
        rings.sort(key=len, reverse=True)

        # Chieu duyet cua canh bien trong tam giac so huu quyet dinh mat nao la
        # mat ngoai; va nguoc chieu do thi phap tuyen mieng va moi cung huong
        # voi phan mesh xung quanh.
        forward = set()
        for a, b, c in triangles:
            forward.add(a * 1000003 + b)
            forward.add(b * 1000003 + c)
            forward.add(c * 1000003 + a)

        before = len(triangles)
        for ring in rings[keep:]:
            same_dir = (ring[0] * 1000003 + ring[1]) in forward
            for i in range(1, len(ring) - 1):
                if same_dir:
                    triangles.append((ring[0], ring[i + 1], ring[i]))
                else:
                    triangles.append((ring[0], ring[i], ring[i + 1]))
            filled += 1
        if len(triangles) == before:
            break
    return filled


def dedupe_and_orient(triangles) -> tuple[int, int, int]:
    """Lam sach topo: bo mat trung, bo mat phi manifold, thong nhat chieu quay.

    Buoc gop dinh co the LAT NGUOC mot so tam giac. Chung van hien (vat lieu
    hai mat) nen khong thay bang mat, nhung computeVertexNormals cong don theo
    dien tich CO DAU: mot tam giac lat se TRU vao thay vi cong, lam hong phap
    tuyen ca mang dinh quanh no. Ket qua la nhung mang sang trang mep vuong o
    vai -- trong nhu ao bi thung, du mesh lien khoi, khong dinh nao nam trong
    co the, va khong tam giac nao suy bien.

    Thu tu quan trong:
      1. Bo mat trung va mat lam canh thanh phi manifold (3 mat chung mot
         canh). De lai thi buoc lan truyen huong di qua chung va lat sai ca
         mot vung lon -- do XL bi lat 776 mat, tuc lat nguoc ca cai ao.
      2. Lan truyen huong qua canh chung.
      3. Giu theo PHE DA SO trong moi thanh phan: tam giac goc lay tu mesh co
         the von da dung chieu, nen neu phai lat qua nua thi chinh ca thanh
         phan do moi la cai bi lat.
    """
    seen: set[tuple[int, ...]] = set()
    unique = []
    removed = 0
    for tri in triangles:
        key = tuple(sorted(tri))
        if key in seen:
            removed += 1
            continue
        seen.add(key)
        unique.append(tri)

    # Bo mat thu ba tro di tren mot canh.
    count: dict[tuple[int, int], int] = {}
    kept = []
    for tri in unique:
        a, b, c = tri
        edges = [(min(x, y), max(x, y)) for x, y in ((a, b), (b, c), (c, a))]
        if any(count.get(e, 0) >= 2 for e in edges):
            removed += 1
            continue
        for e in edges:
            count[e] = count.get(e, 0) + 1
        kept.append(tri)
    triangles[:] = kept

    edge_faces: dict[tuple[int, int], list[int]] = {}
    for f, (a, b, c) in enumerate(triangles):
        for x, y in ((a, b), (b, c), (c, a)):
            edge_faces.setdefault((min(x, y), max(x, y)), []).append(f)

    def goes(f: int, x: int, y: int) -> bool:
        a, b, c = triangles[f]
        return (a, b) == (x, y) or (b, c) == (x, y) or (c, a) == (x, y)

    flipped_total = 0
    visited = [False] * len(triangles)
    for start_f in range(len(triangles)):
        if visited[start_f]:
            continue
        visited[start_f] = True
        component = [start_f]
        flipped_here: list[int] = []
        stack = [start_f]
        while stack:
            f = stack.pop()
            a, b, c = triangles[f]
            for x, y in ((a, b), (b, c), (c, a)):
                for g in edge_faces.get((min(x, y), max(x, y)), ()):
                    if g == f or visited[g]:
                        continue
                    if goes(g, x, y):
                        ga, gb, gc = triangles[g]
                        triangles[g] = (ga, gc, gb)
                        flipped_here.append(g)
                    visited[g] = True
                    component.append(g)
                    stack.append(g)

        if len(flipped_here) * 2 > len(component):
            for f in component:
                a, b, c = triangles[f]
                triangles[f] = (a, c, b)
            flipped_total += len(component) - len(flipped_here)
        else:
            flipped_total += len(flipped_here)

    return removed, flipped_total, len(triangles)


def same_direction_edges(triangles) -> int:
    """So canh bi hai tam giac duyet cung chieu. Mesh dung phai la 0."""
    seen: set[int] = set()
    bad = 0
    for a, b, c in triangles:
        for x, y in ((a, b), (b, c), (c, a)):
            k = x * 1000003 + y
            if k in seen:
                bad += 1
            seen.add(k)
    return bad


def boundary_loops(triangles) -> list[int]:
    """So dinh cua tung vong bien ho.

    Mot cai ao dung phai co DUNG 4 vong: co, gau, hai cua tay. Nhieu hon la co
    lo thung. Dem bang so nhu the nay chac chan hon nhieu so voi xoay camera
    di tim lo bang mat -- va no chan duoc ca lop loi nay ve sau.
    """
    return [len(r) for r in boundary_rings(triangles)]


def surface_roughness(positions, triangles) -> float:
    """Do gap ghenh: lech trung binh cua moi dinh so voi trong tam cac dinh ke."""
    adj: list[set[int]] = [set() for _ in positions]
    for a, b, c in triangles:
        adj[a].update((b, c)); adj[b].update((a, c)); adj[c].update((a, b))
    total, n = 0.0, 0
    for v, ring in enumerate(adj):
        if not ring:
            continue
        k = len(ring)
        cx = sum(positions[u][0] for u in ring) / k
        cy = sum(positions[u][1] for u in ring) / k
        cz = sum(positions[u][2] for u in ring) / k
        p = positions[v]
        total += math.dist(p, (cx, cy, cz))
        n += 1
    return total / max(n, 1)


def smooth_surface(positions, triangles, frozen, passes: int = 45) -> None:
    """Lam muot mat ao tai cho, giu nguyen cac dinh trong `frozen`.

    Vai KHONG chui vao duoc cac ranh lom hep tren co the -- no bac cau qua.
    Lay khuon ao tu chinh mesh co the thi ao thua huong nguyen cai ranh duoi
    co nguc, va day mep ra 1.2 cm doc phap tuyen lai lam ranh do TU CHAM VAO
    NHAU: ban kinh cong cua ranh nho hon do day day ra. Ket qua la mot cai nep
    hinh chu U om theo vien nguc, thay ro tren mo phong -- do chinh la cho
    "co rum o vu".

    Buoc gop dinh de lai mot mat rat gap ghenh: moi dinh lech trung binh 4.8 mm
    so voi trong tam cac dinh ke no, tren mot lop vai chi cach da 12 mm. Taubin
    (no bu lai sau moi luot co, khac Laplace tran lam ao teo di) ha xuong 2.8 mm
    va cham day o day -- phan con lai la do luoi tam giac khong deu chu khong
    phai do mat ao con gon. 45 luot chi ton 5 giay luc build.
    """
    n = len(positions)
    adj: list[set[int]] = [set() for _ in range(n)]
    for a, b, c in triangles:
        adj[a].update((b, c))
        adj[b].update((a, c))
        adj[c].update((a, b))
    for lam in [0.5, -0.53] * passes:
        moved = list(positions)
        for v in range(n):
            if v in frozen or not adj[v]:
                continue
            ring = adj[v]
            k = len(ring)
            cx = sum(positions[u][0] for u in ring) / k
            cy = sum(positions[u][1] for u in ring) / k
            cz = sum(positions[u][2] for u in ring) / k
            p = positions[v]
            moved[v] = (
                p[0] + (cx - p[0]) * lam,
                p[1] + (cy - p[1]) * lam,
                p[2] + (cz - p[2]) * lam,
            )
        positions[:] = moved


def smooth_ring(positions, ring, passes: int = 6) -> None:
    """Lam muot mot vong bien tai cho, giu nguyen kich thuoc vong.

    Mep cat di theo canh tam giac cua luoi da gop o nen no rang cua: vong co
    size M dai 81.8 cm trong khi mot elip 17.9 x 16.3 cm chi dai khoang 53 cm
    -- hon nua chieu dai la do duong bien chay zic zac. Vong co gap khuc thi
    ke ca sau khi keo ve mat cat van nhin ra tung khac mot.

    Dung Taubin (mot luot co lam muot, mot luot no bu lai) chu khong phai
    Laplace tran: Laplace lam muot bang cach co dan vao trong, ap cho gau thi
    gau tu hep lai va mat chu vi da tinh theo bang size.
    """
    n = len(ring)
    if n < 6:
        return
    for lam in [0.5, -0.53] * passes:
        moved = []
        for k in range(n):
            a = positions[ring[(k - 1) % n]]
            b = positions[ring[k]]
            c = positions[ring[(k + 1) % n]]
            moved.append(tuple(
                b[j] + ((a[j] + c[j]) / 2.0 - b[j]) * lam for j in range(3)
            ))
        for k in range(n):
            positions[ring[k]] = moved[k]


def build_size(body: BodyReference, size: str) -> dict:
    spec = SIZE_CHART[size]
    target_chest = spec["chest"] * CM
    body_length = spec["bodyLength"] * CM
    sleeve_length = spec["sleeveLength"] * CM

    hps_y = body.shoulder_y + HPS_RISE

    def top_cut(x: float, z: float) -> float:
        """Mep tren cua ao tai (x, z).

        Duong co CHI trung o giua. Ap do trung cho ca be ngang thi cat mat luon
        vai va ao thanh ao tre vai. Ra ngoai ban kinh lo co, mep phai cao len
        de che kin mom vai -- do chinh la duong may vai.
        """
        dz = z - body.axis_z
        t = max(0.0, min(1.0, (dz / NECK_DEPTH_REF + 1.0) / 2.0))
        t = t * t * (3.0 - 2.0 * t)
        neck = body.shoulder_y + NECKLINE_BACK + (NECKLINE_FRONT - NECKLINE_BACK) * t

        r = math.hypot(x, dz)
        w = max(0.0, min(1.0, (r - NECK_R_INNER) / (NECK_R_OUTER - NECK_R_INNER)))
        w = w * w * (3.0 - 2.0 * w)
        return neck + (body.shoulder_y + SHOULDER_TOP - neck) * w

    neck_y = body.shoulder_y + NECKLINE_BACK  # cao nhat, dung cho cac moc chung
    hem_y = hps_y - body_length
    torso_half_max = abs(body.acromion["right"][0]) * 1.25

    # Cat tren day chau, roi keo gian phan duoi cho du dai ao.
    #
    # Co the tham chieu chi cao 1.63 m con bang size danh cho nguoi ~1.75 m,
    # nen 68 cm tinh tu HPS roi xuong duoi day chau: mesh se bam theo HAI CHAN
    # va ra hinh cai romper. Cat o day chau roi keo dai phan duoi giu duoc ca
    # hinh ong lan chieu dai that, va van giu khac biet do dai giua cac size.
    hem_cut = max(hem_y, body.crotch_y + 0.015)

    # --- chon vung ao ---------------------------------------------------------
    keep = [False] * len(body.positions)
    arm_side = [None] * len(body.positions)
    arm_t = [0.0] * len(body.positions)
    for i, p in enumerate(body.positions):
        perp, t, side = body.arm_coords(p)
        if perp < ARM_PICK_RADIUS and t > 0.02:
            # Thuoc canh tay: cat theo DAI TAY AO doc truc, khong theo chieu cao.
            arm_side[i] = side
            arm_t[i] = t
            keep[i] = t <= sleeve_length
        else:
            # Phai chan them theo be ngang. Cang tay o tu the A gap ra truoc nen
            # ban tay lech khoi truc tay thang, roi vao nhanh "than" nay va lot
            # qua bo loc chieu cao -- ket qua la hai cuc vai dinh o hai ban tay.
            keep[i] = hem_cut <= p[1] <= top_cut(p[0], p[2]) and abs(p[0]) <= torso_half_max

    tris = [t for t in body.triangles if keep[t[0]] and keep[t[1]] and keep[t[2]]]
    if not tris:
        raise RuntimeError(f"{size}: khong chon duoc vung ao")

    used = sorted({v for t in tris for v in t})
    remap = {o: n for n, o in enumerate(used)}
    positions = [body.positions[i] for i in used]
    uvs = [body.uv[i] for i in used]
    triangles = [(remap[a], remap[b], remap[c]) for a, b, c in tris]
    source = list(used)  # dinh moi -> dinh goc tren co the, de tra lai nhan vung

    positions, uvs, triangles, source = cluster_decimate(
        positions, uvs, triangles, source, DECIMATE_CELL
    )
    holes = fill_stray_holes(triangles)
    dup, flipped, _ = dedupe_and_orient(triangles)
    bad = same_direction_edges(triangles)
    if bad:
        raise RuntimeError(f"{size}: con {bad} canh cung chieu sau khi dinh huong lai")

    # Bien cat di theo canh tam giac nen gau, co va cua tay bi rang cua. Keo
    # cac dinh bien ve dung mat cat de duong may thang.
    edge_count: dict[tuple[int, int], int] = {}
    for a, b, c in triangles:
        for x, y in ((a, b), (b, c), (c, a)):
            k = (min(x, y), max(x, y))
            edge_count[k] = edge_count.get(k, 0) + 1
    boundary = {v for (a, b), n in edge_count.items() if n == 1 for v in (a, b)}

    mid_y = (hem_cut + neck_y) / 2.0
    rings = boundary_rings(triangles)

    # Cua tay keo doc TRUC TAY mot doan tinh tu vi tri goc tren co the, nen no
    # chi dung mot lan. Goi lai lan hai la doi mot doan nua: chay bon luot thi
    # tay ao dai them 8 cm va cua tay phinh tu 38 len 45 cm.
    for v in boundary:
        i = source[v]
        if arm_side[i] is None:
            continue
        p = positions[v]
        sign = 1.0 if arm_side[i] == "right" else -1.0
        axis = norm((ARM_AXIS_RIGHT[0] * sign, ARM_AXIS_RIGHT[1], ARM_AXIS_RIGHT[2]))
        d = sleeve_length - arm_t[i]
        positions[v] = (p[0] + axis[0] * d, p[1] + axis[1] * d, p[2] + axis[2] * d)

    def snap_to_cut() -> None:
        """Keo bien than ao ve dung mat cat. Dat y theo (x, z) nen lap lai
        bao nhieu lan cung ra mot ket qua."""
        for v in boundary:
            if arm_side[source[v]] is not None:
                continue
            p = positions[v]
            if p[1] < mid_y:
                positions[v] = (p[0], hem_cut, p[2])
            else:
                positions[v] = (p[0], top_cut(p[0], p[2]), p[2])

    # Lam muot va keo ve mat cat danh nhau: lam muot day dinh ra khoi mat cat,
    # keo ve lai dung theo phuong y va lam song lai theo phuong ngang. Lam xen
    # ke vai luot thi ca hai cung hoi tu; mot luot moi thu thi vong co van con
    # gap khuc (65.5 cm cho mot elip dang le chi 51 cm).
    for _ in range(4):
        for ring in rings:
            smooth_ring(positions, ring)
        snap_to_cut()

    # --- dua ve dung so do bang size -----------------------------------------
    # Vai co be day, nen phan chu vi do khe ho dong gop la 2*pi*gap; phan con
    # lai moi la do scale hinh the.
    scale = (target_chest - 2.0 * math.pi * FABRIC_GAP) / body.chest_circ

    # Vung TREN NGUC khong an theo ti le vong nguc: scale deu day mep vai lot ra
    # ngoai mom vai, trong luc keo tut xuong va de ho dinh vai. Chu vi nguc do o
    # ngang nguc nen thu gon phan tren khong lam sai so do.
    def horizontal_scale(y: float) -> float:
        if y <= body.chest_y:
            return scale
        t = min(1.0, (y - body.chest_y) / max(body.shoulder_y - body.chest_y, 1e-6))
        t = t * t * (3.0 - 2.0 * t)
        top = 1.0 + (scale - 1.0) * SHOULDER_SCALE_SHARE
        return scale + (top - scale) * t

    positions = [
        (p[0] * horizontal_scale(p[1]), p[1],
         body.axis_z + (p[2] - body.axis_z) * horizontal_scale(p[1]))
        for p in positions
    ]

    # Keo gian phan duoi nguc cho gau cham dung do dai bang size. Phan tren
    # nguc (vai, tay) giu nguyen nen khong bi meo.
    if hem_cut > hem_y + 1e-6:
        kk = (body.chest_y - hem_y) / (body.chest_y - hem_cut)
        positions = [
            p if p[1] >= body.chest_y
            else (p[0], body.chest_y - (body.chest_y - p[1]) * kk, p[2])
            for p in positions
        ]

    # Tay ao co ti le RIENG, khong an theo ti le vong nguc, va duoc NEO VE dung
    # vi tri canh tay: scale deu khong chi noi rong ma con day tinh tien ong tay
    # ra ngoai (o XL la ~5 cm), no treo lo lung roi bi va cham giang thanh mo nat.
    target_cuff_r = (spec["sleeveOpening"] * CM) / (2.0 * math.pi)
    for side in ("right", "left"):
        sign = 1.0 if side == "right" else -1.0
        origin_ref = body.acromion[side]
        sh = horizontal_scale(origin_ref[1])
        origin = (origin_ref[0] * sh, origin_ref[1],
                  body.axis_z + (origin_ref[2] - body.axis_z) * sh)
        shift = (origin_ref[0] - origin[0], 0.0, origin_ref[2] - origin[2])
        axis = norm((ARM_AXIS_RIGHT[0] * sign, ARM_AXIS_RIGHT[1], ARM_AXIS_RIGHT[2]))

        cuff = [k for k, i in enumerate(source)
                if arm_side[i] == side and arm_t[i] > sleeve_length - 0.03]
        if not cuff:
            continue
        radial = []
        for k in cuff:
            d = sub3(positions[k], (origin[0] + shift[0], origin[1], origin[2] + shift[2]))
            t = dot(d, axis)
            radial.append(math.sqrt(max(dot(d, d) - t * t, 0.0)))
        cur = sum(radial) / len(radial)
        if cur < 1e-6:
            continue
        factor = target_cuff_r / cur

        for k, i in enumerate(source):
            if arm_side[i] != side:
                continue
            # Chuyen dan tu 1.0 o vong nach sang factor o cua tay, de khong tao
            # bac gay tai cho tay noi vao than.
            w = min(1.0, max(0.0, arm_t[i] / sleeve_length))
            f = 1.0 + (factor - 1.0) * w
            p0 = positions[k]
            positions[k] = (p0[0] + shift[0] * w, p0[1], p0[2] + shift[2] * w)
            base = (origin[0] + shift[0] * w, origin[1], origin[2] + shift[2] * w)
            d = sub3(positions[k], base)
            t = dot(d, axis)
            perp = (d[0] - axis[0] * t, d[1] - axis[1] * t, d[2] - axis[2] * t)
            positions[k] = (
                base[0] + axis[0] * t + perp[0] * f,
                base[1] + axis[1] * t + perp[1] * f,
                base[2] + axis[2] * t + perp[2] * f,
            )

    # Xoa cac ranh lom hep TRUOC khi day mep ra, neu khong thi buoc day ra chinh
    # no lam ranh tu cham vao nhau. Giu nguyen bien -- bien vua duoc keo ve dung
    # mat cat o tren, lam muot nua la hong duong co, gau va cua tay.
    rough_before = surface_roughness(positions, triangles)
    smooth_surface(positions, triangles, boundary)
    rough_after = surface_roughness(positions, triangles)

    normals = compute_smooth_normals(positions, triangles)
    positions = [
        (p[0] + n[0] * FABRIC_GAP, p[1] + n[1] * FABRIC_GAP, p[2] + n[2] * FABRIC_GAP)
        for p, n in zip(positions, normals)
    ]

    # --- gan nhan vung --------------------------------------------------------
    # Collar = dung vong bien tren cong mot lop dinh ke no. Truoc day nhan theo
    # chieu cao va ban kinh: sau khi nang SHOULDER_TOP, mep tren o ngoai vai nam
    # cao hon da nen phai chan them ban kinh, ma vong co lai voi ra toi 14.4 cm
    # trong khi moc chan la 13.5 -- doan ngoai cung cua vong co roi ra ngoai
    # nhan, khong duoc ghim, va no XE XUONG 3 cm. Nhin tu sau thay co ao meo han
    # mot ben. Lay theo vong bien thi khong con moc nao de roi ra ngoai, va no
    # dung cho moi size ma khong phai chinh lai con so.
    neck_ring = max(boundary_rings(triangles), key=lambda r: max(positions[i][1] for i in r))
    collar_band = set(neck_ring)

    regions = []
    for k, i in enumerate(source):
        p = positions[k]
        y = p[1]
        if arm_side[i] is not None:
            near_cuff = arm_t[i] > sleeve_length - 0.035
            if arm_side[i] == "right":
                regions.append(REGION["cuffRight"] if near_cuff else REGION["sleeveRight"])
            else:
                regions.append(REGION["cuffLeft"] if near_cuff else REGION["sleeveLeft"])
            continue
        if k in collar_band:
            regions.append(REGION["collar"])
        elif y >= body.shoulder_y - 0.045:
            regions.append(REGION["yoke"])
        elif y <= hem_y + 0.03:
            regions.append(REGION["hem"])
        else:
            theta = math.atan2(p[2] - body.axis_z, p[0])
            d_front = abs(math.atan2(math.sin(theta - math.pi / 2), math.cos(theta - math.pi / 2)))
            d_back = abs(math.atan2(math.sin(theta + math.pi / 2), math.cos(theta + math.pi / 2)))
            if d_front < FRONT_HALF_ANGLE:
                regions.append(REGION["torsoFront"])
            elif d_back < FRONT_HALF_ANGLE:
                regions.append(REGION["torsoBack"])
            else:
                regions.append(REGION["sideSeam"])

    # --- ve he toa do local cua ao -------------------------------------------
    positions = [(p[0], p[1] - body.shoulder_y, p[2] - body.axis_z) for p in positions]
    normals = compute_smooth_normals(positions, triangles)

    # --- UV --------------------------------------------------------------------
    # Hai bo toa do:
    #   * `uvs`  (TEXCOORD_0): chieu phang (x, y) lien tuc, khong co duong cat.
    #     Dung cho weave bump map -- can lien tuc de sim khong lam rach ao.
    #     Chuan hoa u theo BE RONG THAN (khong tinh tay ao xoe o tu the T).
    #   * `art_uvs` (_ARTUV): unwrap panel de dan anh in -- tinh xa hon o duoi.
    torso_regions = {
        REGION["torsoFront"], REGION["torsoBack"], REGION["sideSeam"],
        REGION["hem"], REGION["yoke"],
    }
    torso_half = max(
        (abs(positions[k][0]) for k, r in enumerate(regions) if r in torso_regions),
        default=0.0,
    ) or 1.0

    ys = [p[1] for p in positions]
    y0, y1 = min(ys), max(ys)
    hgt = (y1 - y0) or 1.0
    uvs = [(0.5 + p[0] / (2.0 * torso_half), (p[1] - y0) / hgt) for p in positions]

    # Toa do rieng cho anh in: chieu phang CA BONG AO (than + tay + vai) vao
    # [0, 1] x [0, 1], roi chia lam doi TRUOC / SAU o hai duong suon bang
    # _FACING (theo z). Panel truoc lay anh mat truoc, panel sau lay anh mat
    # sau (shader lat u mot lan).
    #
    #   u = (x - ax0) / awd     ax0..ax1 = be rong toan bo (dau tay -> dau tay)
    #   v = (y - ay0) / avh     ay0..ay1 = tu gau len co
    #
    # Khop voi anh chup AO TRAI PHANG 1:1: tay ao trong anh -> tay ao mesh,
    # than trong anh -> than mesh. Khong ep hoa van vao khoang giua nua.
    #
    # _FACING bake tu VI TRI (z) -- on dinh hon lay tu phap tuyen (phap tuyen
    # rung tren mesh da gop dinh). Chuyen truoc <-> sau trong dai +-1.5 cm quanh
    # duong suon (z gan 0). z_center lay tu vong nguc de mat truoc/sau can nhau.
    torso_body = [p for p, region in zip(positions, regions)
                  if region in torso_regions and p[1] < -0.045]
    z_lo = min(p[2] for p in torso_body)
    z_hi = max(p[2] for p in torso_body)
    z_center = (z_lo + z_hi) * 0.5

    art_x = [p[0] for p in positions]
    art_y = [p[1] for p in positions]
    ax0, ax1 = min(art_x), max(art_x)
    ay0, ay1 = min(art_y), max(art_y)
    awd = (ax1 - ax0) or 1.0
    avh = (ay1 - ay0) or 1.0

    art_uvs = []
    facing = []
    for p in positions:
        z = p[2] - z_center
        art_uvs.append(((p[0] - ax0) / awd, (p[1] - ay0) / avh))
        t = max(0.0, min(1.0, (z + 0.015) / 0.030))
        facing.append(int(round(t * t * (3.0 - 2.0 * t) * 255)))

    loops = boundary_loops(triangles)
    if len(loops) != 4:
        raise RuntimeError(
            f"{size}: mesh co {len(loops)} vong bien {loops}, phai la 4 "
            "(co, gau, hai cua tay) -- co lo thung"
        )

    counts: dict[str, int] = {}
    inv = {v: k for k, v in REGION.items()}
    for r in regions:
        counts[inv[r]] = counts.get(inv[r], 0) + 1

    indices: list[int] = []
    for a, b, c in triangles:
        indices.extend((a, b, c))

    return {
        "size": size,
        "boundaryLoops": loops,
        "holesFilled": holes,
        "dupFaces": dup,
        "flippedFaces": flipped,
        "positions": positions,
        "normals": normals,
        "uvs": uvs,
        "art_uvs": art_uvs,
        "regions": regions,
        "facing": facing,
        "indices": indices,
        "chestCircTarget": target_chest,
        "chestCircAchieved": body.chest_circ * scale + 2.0 * math.pi * FABRIC_GAP,
        "bodyLength": body_length,
        "sleeveLength": sleeve_length,
        "hemY": hem_y - body.shoulder_y,
        "scale": scale,
        "regionCounts": counts,
        "rough": (rough_before, rough_after),
    }


def _close_inseam(
    positions, triangles, source, body: BodyReference, y_floor: float
) -> None:
    """Khau kin KHE HO doc mat trong moi ong chan.

    Base mesh MakeHuman de moi chan ho mot khe hep chay doc mat trong dui/bap
    chan: bien cua moi ong la MOT vong di xuong mot mep khe, vong qua co chan,
    roi len mep kia. Ta lay vong bien do, tach o dinh THAP nhat thanh hai nua
    (hai mep khe) roi khau chung lai -> moi ong thanh mot ong kin.

    Moi tam giac moi duoc dinh huong bang PHAP TUYEN GOC CUA CO THE
    (body.normals, qua source) chu khong doan theo hang xom: mot mieng vai
    khau tay co the tu dong bo QUAY NGUOC ca cum voi nhau (moi canh vao van
    khop chieu voi lang gieng trong cum) ma van sai huong so voi phan con lai
    -- kiem tra cuc bo sau nay se khong bat duoc, phai neo vao mot chuan tin
    cay tu luc tao.
    """
    from collections import defaultdict

    ec: dict[tuple[int, int], int] = defaultdict(int)
    for a, b, c in triangles:
        for u, v in ((a, b), (b, c), (c, a)):
            ec[(min(u, v), max(u, v))] += 1
    badj: dict[int, list[int]] = defaultdict(list)
    for (u, v), n in ec.items():
        if n == 1:
            badj[u].append(v)
            badj[v].append(u)

    # trace tung vong bien khep kin
    seen: set[int] = set()
    rings: list[list[int]] = []
    for s in list(badj):
        if s in seen or len(badj[s]) != 2:
            continue
        ring = [s]
        seen.add(s)
        cur, prev = s, None
        while True:
            nxts = [w for w in badj[cur] if w != prev]
            if not nxts:
                break
            w = nxts[0] if nxts[0] not in seen else (nxts[1] if len(nxts) > 1 else s)
            if w == s or w in seen:
                break
            ring.append(w)
            seen.add(w)
            prev, cur = cur, w
        rings.append(ring)

    for ring in rings:
        ys = [positions[v][1] for v in ring]
        xs = [positions[v][0] for v in ring]
        # Vanh cap la vanh DUY NHAT vat qua ca hai ben x -- vanh khe/gau cua
        # tung ong chan chi nam mot ben. (Loc theo do cao rieng khong an toan:
        # base mesh MakeHuman ho ca o mong, nen khe co the chay len gan cap.)
        #
        # LUU Y: co mot khe HO RONG (khong phai khe hep) chay tu duoi day chau
        # len GAN TOI EO -- co le cho don gian hoa vung kin cua MakeHuman. No
        # cung vat qua hai ben x nen bi loc o day (dung y). Thu khau no bang
        # thuat toan zip nhu inseam da ra mieng vai nhan nhum xau hon la de ho
        # -- seat_r hien tai da du lon de trum qua no ma khong lo ra ngoai,
        # chi con lai mot vet nhan nho o mat truoc trong; chap nhan duoc.
        if min(xs) < -0.015 and max(xs) > 0.015:
            continue
        if max(ys) < body.crotch_y - 0.55:
            continue  # da la vanh gau kin (o tan mat ca), khong co khe
        # Vanh nay = xuong mot mep khe -> vong qua co chan -> len mep kia.
        # Xoay cho bat dau o dinh CAO nhat (gan day chau) roi tach hai nua;
        # khau tu tren xuong, DUNG khi hai mep tach xa nhau (da toi co chan) --
        # de lo co chan lam vanh gau.
        hi = max(range(len(ring)), key=lambda i: positions[ring[i]][1])
        r = ring[hi:] + ring[:hi]                 # bat dau o day chau
        lo = min(range(len(r)), key=lambda i: positions[r[i]][1])
        half_a = r[: lo + 1]                      # day chau -> co chan, mep A
        half_b = list(reversed(r[lo:])) + [r[0]]  # day chau -> co chan, mep B
        y_stop = y_floor + 0.22   # duoi muc nay la cung co chan -> de ho lam gau
        for i in range(min(len(half_a), len(half_b)) - 1):
            a0, a1 = half_a[i], half_a[i + 1]
            b0, b1 = half_b[i], half_b[i + 1]
            if positions[a1][1] < y_stop or positions[b1][1] < y_stop:
                break
            for t in ((a0, b1, a1), (a0, b0, b1)):
                if t[0] == t[1] or t[1] == t[2] or t[2] == t[0]:
                    continue
                p0, p1, p2 = positions[t[0]], positions[t[1]], positions[t[2]]
                e1, e2 = sub3(p1, p0), sub3(p2, p0)
                fn = (
                    e1[1] * e2[2] - e1[2] * e2[1],
                    e1[2] * e2[0] - e1[0] * e2[2],
                    e1[0] * e2[1] - e1[1] * e2[0],
                )
                ref = (0.0, 0.0, 0.0)
                for idx in t:
                    bn = body.normals[source[idx]]
                    ref = (ref[0] + bn[0], ref[1] + bn[1], ref[2] + bn[2])
                triangles.append(t if dot(fn, ref) >= 0 else (t[0], t[2], t[1]))


def _fix_inward_triangles(positions, triangles, source, body: BodyReference) -> int:
    """Lat lai tam giac quay nguoc chieu so voi phap tuyen GOC CUA CO THE.

    dedupe_and_orient chi bao dam CANH khop chieu voi hang xom trong noi bo
    mieng cat -- mieng cat la mot mang HO (co bien, khong phai khoi kin), nen
    khong co gi buoc no chon dung huong "ra ngoai": BFS tu mot tam giac hat
    giong co the lam CA MIENG dong bo nguoc 100% voi nhau (moi canh vao van
    khop chieu) ma van la mat trong quay ra ngoai. Kiem tra bang phap tuyen
    MUOT CUA CHINH MIENG do se khong bat duoc ca cum nay (no tu dong bo voi
    chinh no). Phai neo vao ban goc: body.normals la phap tuyen cua CA KHOI
    co the (dinh huong dung tu luc parse OBJ), tra qua `source` de biet dinh
    nao tren mieng cat ung voi dinh nao tren co the.
    """
    flips = 0
    for i, (a, b, c) in enumerate(triangles):
        pa, pb, pc = positions[a], positions[b], positions[c]
        e1 = sub3(pb, pa)
        e2 = sub3(pc, pa)
        fn = (
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
        )
        ref = (0.0, 0.0, 0.0)
        for idx in (a, b, c):
            bn = body.normals[source[idx]]
            ref = (ref[0] + bn[0], ref[1] + bn[1], ref[2] + bn[2])
        if dot(fn, ref) < 0:
            triangles[i] = (a, c, b)
            flips += 1
    return flips


def build_pants_size(body: BodyReference, size: str, size_chart: dict = PANTS_SIZE_CHART) -> dict:
    """Cat quan tu co the tham chieu: cap quanh eo, hai ong bao lay hai chan.

    Giong build_size nhung: khong co truc xien nhu tay ao (chan gan nhu thang
    dung -> tach trai/phai theo dau cua x), va co BA vong bien (cap + hai gau)
    thay vi bon.

    Dung chung ca cho quan dai (PANTS_SIZE_CHART) va quan short
    (SHORTS_SIZE_CHART, `inseam` rat ngan): vung chon va phep bien deu lay tron
    ong chan tu day chau xuong tan mat ca roi moi co gian/nen theo `inseam` cua
    size_chart, nen chi can truyen bang size khac la ra hinh dang khac, khong
    can viet lai logic.
    """
    spec = size_chart[size]
    waist_target = spec["waist"] * CM
    hip_target = spec["hip"] * CM
    inseam = spec["inseam"] * CM
    hem_circ = spec["hem"] * CM
    rise = spec["rise"] * CM

    waist_cut = body.crotch_y + rise
    # Cat ngay tren vanh mat ca CON DAY DINH tren co the tham chieu (do bang
    # probe: co mot khoang trong 0.10-0.22m khong con dinh nao, tan mat ca that
    # su nam thap hon, ~0.06-0.10m). Cat o do roi keo dai xuong dung inseam.
    y_floor = 0.08

    # --- chon vung quan -------------------------------------------------
    # Duoi day chau: ong chan XOE RA NGOAI kha nhieu (tam ong dich tu x=0.09 o
    # dui len x=0.22 o mat ca) nen mot hinh tru THANG DUNG co tam/ban kinh co
    # dinh se hut hep dan va bo sot ca vanh mat ca. Noi tuyen tam+ban kinh cua
    # hinh tru theo do cao -- van la mot phep thu don gian tren tung dinh (bien
    # sach, khong dung truc nghieng lam vanh rang cua o day chau).
    seat_r = body.hip_circ / (2.0 * math.pi) + 0.03
    LEG_Y_TOP, LEG_Y_BOT = body.crotch_y - 0.02, 0.10
    LEG_CX_TOP, LEG_CZ_TOP, LEG_R_TOP = 0.088, 0.023, 0.13
    LEG_CX_BOT, LEG_CZ_BOT, LEG_R_BOT = 0.220, 0.010, 0.06

    def leg_profile(y: float) -> tuple[float, float, float]:
        t = min(1.0, max(0.0, (LEG_Y_TOP - y) / (LEG_Y_TOP - LEG_Y_BOT)))
        return (
            LEG_CX_TOP + (LEG_CX_BOT - LEG_CX_TOP) * t,
            LEG_CZ_TOP + (LEG_CZ_BOT - LEG_CZ_TOP) * t,
            LEG_R_TOP + (LEG_R_BOT - LEG_R_TOP) * t,
        )

    keep = [False] * len(body.positions)
    side_of = [None] * len(body.positions)
    leg_t = [0.0] * len(body.positions)
    for i, p in enumerate(body.positions):
        x, y, z = p
        if not (y_floor - 0.01 <= y <= waist_cut + 0.005):
            continue
        if y >= body.crotch_y - 0.01:
            keep[i] = math.hypot(x, z - body.axis_z) <= seat_r
        else:
            sign = 1.0 if x >= 0.0 else -1.0
            cx, cz, r = leg_profile(y)
            if math.hypot(x - sign * cx, z - cz) <= r:
                keep[i] = True
                side_of[i] = "right" if sign > 0 else "left"
                _, leg_t[i], _ = body.leg_coords(p)

    tris = [t for t in body.triangles if keep[t[0]] and keep[t[1]] and keep[t[2]]]
    if not tris:
        raise RuntimeError(f"{size}: khong chon duoc vung quan")

    used = sorted({v for t in tris for v in t})
    remap = {o: n for n, o in enumerate(used)}
    positions = [body.positions[i] for i in used]
    uvs = [body.uv[i] for i in used]
    triangles = [(remap[a], remap[b], remap[c]) for a, b, c in tris]
    source = list(used)

    positions, uvs, triangles, source = cluster_decimate(
        positions, uvs, triangles, source, DECIMATE_CELL
    )

    # --- khau duong dang: base mesh MakeHuman HO doc mat trong moi dui, nen
    # moi ong chan la mot mang mo doc chieu dai. Khau chuoi bien trong cua ong
    # phai vao chuoi bien trong cua ong trai -> hai ong kin, tong 3 vong bien.
    _close_inseam(positions, triangles, source, body, y_floor)

    holes = fill_stray_holes(triangles, keep=3)
    dup, flipped, _ = dedupe_and_orient(triangles)
    bad = same_direction_edges(triangles)
    if bad:
        raise RuntimeError(f"{size}: con {bad} canh cung chieu sau khi dinh huong lai")

    # dedupe_and_orient dinh huong theo CANH (lan truyen BFS tu mot tam giac
    # goc). Mieng vai khau tay o day chau (_close_inseam) doi khi tao ra mot
    # cum tam giac nho gan-tach-biet ma BFS lan qua het nhung van QUAY NGUOC:
    # canh khop voi hang xom (nen same_direction_edges khong bat duoc) nhung
    # phap tuyen mat lai chui vao trong, hien ra mot lo den kieu "rach" ngay
    # dinh dang chau. Sua bang cach so sanh truc tiep voi phap tuyen muot.
    flipped += _fix_inward_triangles(positions, triangles, source, body)

    edge_count: dict[tuple[int, int], int] = {}
    for a, b, c in triangles:
        for x, y in ((a, b), (b, c), (c, a)):
            k = (min(x, y), max(x, y))
            edge_count[k] = edge_count.get(k, 0) + 1
    boundary = {v for (a, b), n in edge_count.items() if n == 1 for v in (a, b)}
    rings = boundary_rings(triangles)

    # Vanh cap -> mat phang eo; vanh gau -> mat phang san. Scale ben duoi lo
    # keo chan dai ra dung inseam.
    def snap_to_cut() -> None:
        for v in boundary:
            p = positions[v]
            if p[1] > body.crotch_y:
                positions[v] = (p[0], waist_cut, p[2])
            elif p[1] < body.crotch_y - 0.10:
                positions[v] = (p[0], y_floor, p[2])

    for _ in range(4):
        for ring in rings:
            smooth_ring(positions, ring)
        snap_to_cut()

    # --- dua ve so do bang size -----------------------------------------
    scale_waist = (waist_target - 2.0 * math.pi * FABRIC_GAP) / body.waist_circ
    scale_hip = (hip_target - 2.0 * math.pi * FABRIC_GAP) / body.hip_circ
    hem_r_target = hem_circ / (2.0 * math.pi)

    def hscale(y: float) -> float:
        if y >= body.waist_y:
            return scale_waist
        if y >= body.hip_y:
            t = (y - body.hip_y) / max(body.waist_y - body.hip_y, 1e-6)
            t = t * t * (3.0 - 2.0 * t)
            return scale_hip + (scale_waist - scale_hip) * t
        return scale_hip

    # Ban kinh ong chan tham chieu o CO CHAN (tren mat ca mot chut, khong lay
    # ban chan) de biet nhan perp bao nhieu cho khop chu vi gau bang size.
    def ref_leg_r(side, t_lo, t_hi):
        rs = []
        for p in body.positions:
            perp, t, s = body.leg_coords(p)
            if s == side and t_lo <= t <= t_hi and perp < LEG_PICK_RADIUS:
                rs.append(perp)
        return sum(rs) / len(rs) if rs else 0.05

    ankle_r = {s: ref_leg_r(s, LEG_LENGTH_REF - 0.10, LEG_LENGTH_REF - 0.03)
               for s in ("right", "left")}

    # MOT phep bien lien tuc cho ca quan, khong co doan noi hai transform khac
    # nhau (do la nguon lam ghenh o cho day chau).
    #
    #  1. scale ngang quanh TRUC DUNG theo he so hs(y): eo -> mong -> (o chan)
    #     giam dan toi ti le chu vi gau / chu vi co chan.
    #  2. keo dai theo y phia duoi day chau cho gau cham dung inseam.
    #  3. rieng phan chan, THEM mot phep bop ban kinh quanh TRUC ONG (blend vao
    #     dan tu day chau xuong) de ong thon lai o co chan nhu quan that.
    natural_leg = body.crotch_y - y_floor
    stretch = inseam / max(natural_leg, 1e-6)
    # Ong chan: bop perp quanh truc ong tu 1.0 o day chau towe ti le
    # (ban kinh gau / ban kinh dui da scale) o co chan. Chan tren tinh theo
    # ban kinh dui de goc noi vao mong khong bi gay.
    thigh_r_ref = {s: ref_leg_r(s, 0.02, 0.10) for s in ("right", "left")}

    def hs(y: float) -> float:
        # eo -> mong roi giu nguyen ti le mong xuong toi chan (khong dung ti le
        # nay de thon chan -- thon lam bang squeeze quanh truc ong ben duoi).
        return hscale(y) if y >= body.hip_y else scale_hip

    def place(p, side):
        x, y, z = p
        f = hs(y)
        nx = x * f
        nz = body.axis_z + (z - body.axis_z) * f
        ny = y if y >= body.crotch_y else body.crotch_y - (body.crotch_y - y) * stretch
        if side is None:
            return (nx, ny, nz)
        origin, axis = body.leg_axis(side)
        b = min(1.0, max(0.0, (body.crotch_y - y) / max(natural_leg, 1e-6)))
        b = b * b * (3.0 - 2.0 * b)
        squeeze_end = hem_r_target / max(thigh_r_ref[side] * scale_hip, 1e-4)
        squeeze_end = min(1.15, max(0.7, squeeze_end))  # chan combo cuc doan
        sq = 1.0 + (squeeze_end - 1.0) * b
        d = sub3((nx, ny, nz), origin)
        t = dot(d, axis)
        perpv = (d[0] - axis[0] * t, d[1] - axis[1] * t, d[2] - axis[2] * t)
        return (origin[0] + axis[0] * t + perpv[0] * sq,
                origin[1] + axis[1] * t + perpv[1] * sq,
                origin[2] + axis[2] * t + perpv[2] * sq)

    positions = [place(p, side_of[source[k]]) for k, p in enumerate(positions)]
    hem_cut = body.crotch_y - inseam

    rough_before = surface_roughness(positions, triangles)
    # Nhieu luot hon ao thun (45): mieng dap day chau/dui trong con mot nep
    # gap sau o mat trong, gan nhu chum lai thanh mot khe toi -- can nhieu luot
    # muot hon de danh bay no ra thanh mot nep nong, khong con doc nhu vet rach.
    smooth_surface(positions, triangles, boundary, passes=140)
    rough_after = surface_roughness(positions, triangles)

    normals = compute_smooth_normals(positions, triangles)
    positions = [
        (p[0] + n[0] * FABRIC_GAP, p[1] + n[1] * FABRIC_GAP, p[2] + n[2] * FABRIC_GAP)
        for p, n in zip(positions, normals)
    ]

    # --- nhan vung -------------------------------------------------------
    # boundary_rings() duyet theo lien ket vo huong (xem docstring cua no): tai
    # DIEM PINCH noi vanh cap cham vao mep khe ho rong chua khau o day chau
    # (xem _close_inseam), phep duyet co the "nhay" tu vanh cap lot sang mot
    # vai dinh cua mep khe do roi quay lai -- ket qua waist_ring vo tinh gom
    # them vai dinh nam tan duoi vung dui/day chau (do bang: 6/80 dinh o day
    # ~28-31cm duoi eo thay vi ~6-7cm). Cac dinh lac nay bi gan nham nhan
    # "waistband" roi bi GHIM CHET tai do cao lung quan trong khi hang xom that
    # cua chung (dinh vung dui) tut xuong tu do khi mo phong -- canh vai giua
    # hai ben keo gian toi 2.2x du dang dung denim (gioi han 1.01x), hien ra
    # nhu mot cai lo/vet rach ngay o dung quan. Loc theo do cao that (gan
    # waist_cut) truoc khi gan nhan de bo cac dinh lac nay.
    waist_ring = max(boundary_rings(triangles),
                     key=lambda r: sum(positions[i][1] for i in r) / len(r))
    band_waist = {i for i in waist_ring if positions[i][1] > waist_cut - 0.05}
    hem_rings = [r for r in boundary_rings(triangles) if r is not waist_ring]
    band_hem = set()
    for r in hem_rings:
        band_hem |= set(r)

    regions = []
    for k, p in enumerate(positions):
        x, y, z = p
        s = side_of[source[k]]
        if k in band_waist:
            regions.append(PANTS_REGION["waistband"])
        elif k in band_hem:
            regions.append(PANTS_REGION["hemRight"] if x >= 0 else PANTS_REGION["hemLeft"])
        elif s is None or y >= body.crotch_y - 0.01:
            regions.append(PANTS_REGION["seatFront"] if z >= body.axis_z
                           else PANTS_REGION["seatBack"])
        elif leg_t[source[k]] < 0.12:
            regions.append(PANTS_REGION["crotch"])
        else:
            regions.append(PANTS_REGION["legRight"] if s == "right"
                           else PANTS_REGION["legLeft"])

    # --- toa do local: y=0 o duong eo, z=0 o truc than -------------------
    positions = [(p[0], p[1] - body.waist_y, p[2] - body.axis_z) for p in positions]
    normals = compute_smooth_normals(positions, triangles)

    # weave uv (lien tuc) + art uv (trai phang ca bong quan)
    xs = [abs(p[0]) for p in positions]
    half = max(xs) or 1.0
    ys = [p[1] for p in positions]
    y0, y1 = min(ys), max(ys)
    hgt = (y1 - y0) or 1.0
    uvs = [(0.5 + p[0] / (2.0 * half), (p[1] - y0) / hgt) for p in positions]

    ax0 = min(p[0] for p in positions)
    ax1 = max(p[0] for p in positions)
    awd = (ax1 - ax0) or 1.0
    art_uvs = []
    facing = []
    for p in positions:
        art_uvs.append(((p[0] - ax0) / awd, (p[1] - y0) / hgt))
        t = max(0.0, min(1.0, (p[2] + 0.02) / 0.04))
        facing.append(int(round(t * t * (3.0 - 2.0 * t) * 255)))

    loops = boundary_loops(triangles)
    if len(loops) != 3:
        raise RuntimeError(
            f"{size}: quan co {len(loops)} vong bien {loops}, phai la 3 "
            "(cap + hai gau) -- co lo thung hoac hai ong dinh nhau"
        )

    counts: dict[str, int] = {}
    inv = {v: k for k, v in PANTS_REGION.items()}
    for r in regions:
        counts[inv[r]] = counts.get(inv[r], 0) + 1

    indices: list[int] = []
    for a, b, c in triangles:
        indices.extend((a, b, c))

    waist_achieved = body.waist_circ * scale_waist + 2.0 * math.pi * FABRIC_GAP
    return {
        "size": size,
        "boundaryLoops": loops,
        "holesFilled": holes,
        "dupFaces": dup,
        "flippedFaces": flipped,
        "positions": positions,
        "normals": normals,
        "uvs": uvs,
        "art_uvs": art_uvs,
        "regions": regions,
        "facing": facing,
        "indices": indices,
        "waistCircTarget": waist_target,
        "waistCircAchieved": waist_achieved,
        "hipCircAchieved": body.hip_circ * scale_hip + 2.0 * math.pi * FABRIC_GAP,
        "inseam": inseam,
        "hemY": (hem_cut) - body.waist_y,
        "scale": scale_waist,
        "regionCounts": counts,
        "rough": (rough_before, rough_after),
    }


def pack_region_bytes(regions: list[int]) -> bytes:
    data = bytes(regions)
    return data + b"\x00" * ((-len(data)) % 4)


def write_garment(meshes: list[dict], out_name: str, mesh_prefix: str) -> Path:
    """Dong goi mot bo mesh (4 size) thanh mot file .glb."""
    bb = BufferBuilder()
    accessors: list[dict] = []
    gltf_meshes: list[dict] = []
    nodes: list[dict] = []

    for m in meshes:
        pos_view = bb.add(pack_vec3_array(m["positions"]))
        pos_min, pos_max = vec3_min_max(m["positions"])
        accessors.append({
            "bufferView": pos_view, "componentType": 5126, "count": len(m["positions"]),
            "type": "VEC3", "min": pos_min, "max": pos_max,
        })
        pos_acc = len(accessors) - 1

        norm_view = bb.add(pack_vec3_array(m["normals"]))
        accessors.append({
            "bufferView": norm_view, "componentType": 5126,
            "count": len(m["normals"]), "type": "VEC3",
        })
        norm_acc = len(accessors) - 1

        uv_view = bb.add(pack_vec2_array(m["uvs"]))
        accessors.append({
            "bufferView": uv_view, "componentType": 5126,
            "count": len(m["uvs"]), "type": "VEC2",
        })
        uv_acc = len(accessors) - 1

        art_view = bb.add(pack_vec2_array(m["art_uvs"]))
        accessors.append({
            "bufferView": art_view, "componentType": 5126,
            "count": len(m["art_uvs"]), "type": "VEC2",
        })
        art_acc = len(accessors) - 1

        reg_view = bb.add(pack_region_bytes(m["regions"]))
        accessors.append({
            "bufferView": reg_view, "componentType": 5121,
            "count": len(m["regions"]), "type": "SCALAR",
        })
        reg_acc = len(accessors) - 1

        fac_view = bb.add(pack_region_bytes(m["facing"]))
        accessors.append({
            "bufferView": fac_view, "componentType": 5121, "normalized": True,
            "count": len(m["facing"]), "type": "SCALAR",
        })
        fac_acc = len(accessors) - 1

        idx_view = bb.add(pack_uint32_array(m["indices"]))
        accessors.append({
            "bufferView": idx_view, "componentType": 5125,
            "count": len(m["indices"]), "type": "SCALAR",
        })
        idx_acc = len(accessors) - 1

        gltf_meshes.append({
            "name": mesh_prefix + m["size"],
            "primitives": [{
                "attributes": {
                    "POSITION": pos_acc, "NORMAL": norm_acc,
                    "TEXCOORD_0": uv_acc, "_ARTUV": art_acc, "_REGION": reg_acc, "_FACING": fac_acc,
                },
                "indices": idx_acc,
            }],
        })
        nodes.append({"mesh": len(gltf_meshes) - 1, "name": mesh_prefix + m["size"]})

    gltf = {
        "asset": {"version": "2.0", "generator": "build_garment_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gltf_meshes,
        "accessors": accessors,
        "bufferViews": bb.byte_views,
        "buffers": [{"byteLength": bb.offset}],
    }
    glb_path = OUT_DIR / out_name
    write_glb(glb_path, gltf, bb.build())
    return glb_path


def _print_report(name: str, meshes: list[dict], circ_key: str) -> None:
    print(f"{name}:")
    for m in meshes:
        tgt = m[circ_key + "Target"]
        got = m[circ_key + "Achieved"]
        print(
            "  {:<3} {:>4.0f}cm (err {:+.2f})  scale {:.3f}  gau y={:+.3f}m  "
            "verts={:5d} tris={:5d}  bien={}  va={} trung={} lat={}"
            "  ghenh={:.2f}->{:.2f}mm".format(
                m["size"], got * 100, (got - tgt) * 100, m["scale"], m["hemY"],
                len(m["positions"]), len(m["indices"]) // 3, m["boundaryLoops"],
                m["holesFilled"], m["dupFaces"], m["flippedFaces"],
                m["rough"][0] * 1000, m["rough"][1] * 1000,
            )
        )
    print("  regions:", json.dumps(meshes[0]["regionCounts"], sort_keys=True))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    body = BodyReference()
    print(
        f"Co the tham chieu: {len(body.positions)} dinh, "
        f"nguc {body.chest_circ * 100:.1f}  eo {body.waist_circ * 100:.1f}  "
        f"mong {body.hip_circ * 100:.1f} cm, vai y={body.shoulder_y:.3f}  "
        f"day chau y={body.crotch_y:.3f}  eo y={body.waist_y:.3f} m"
    )

    shirts = [build_size(body, s) for s in SIZE_ORDER]
    pants = [build_pants_size(body, s) for s in SIZE_ORDER]
    shorts = [build_pants_size(body, s, SHORTS_SIZE_CHART) for s in SIZE_ORDER]

    shirt_glb = write_garment(shirts, "garment-tshirt.glb", "tshirt_")
    pants_glb = write_garment(pants, "garment-pants.glb", "pants_")
    shorts_glb = write_garment(shorts, "garment-shorts.glb", "shorts_")

    metadata = {
        "units": "metres, Y up, z=0 at body axis, front is +Z",
        "source": "Lay khuon tu base mesh MakeHuman (CC0) -- xem PROVENANCE.md",
        "note": "Mesh khong bind vao body. Do chat/rong tinh o client (garmentFit.ts).",
        # --- ao (giu nguyen shape cu de client khong vo) ---
        "garment": "tshirt",
        "yZero": "shoulder line",
        "sizeOrder": SIZE_ORDER,
        "regions": REGION,
        "pinRegion": REGION["collar"],
        "fabricGapM": FABRIC_GAP,
        "printCalibration": PRINT_CALIBRATION,
        "sizes": {
            m["size"]: {
                "chestCircCm": round(m["chestCircAchieved"] * 100, 2),
                "bodyLengthCm": round(m["bodyLength"] * 100, 2),
                "sleeveLengthCm": round(m["sleeveLength"] * 100, 2),
                "sleeveOpeningCm": SIZE_CHART[m["size"]]["sleeveOpening"],
                "hemYm": round(m["hemY"], 4),
                "shapeScale": round(m["scale"], 4),
                "vertexCount": len(m["positions"]),
                "triangleCount": len(m["indices"]) // 3,
                "regionCounts": m["regionCounts"],
                "seams": [],
            }
            for m in shirts
        },
        # --- danh muc nhieu mon: client chon "tshirt" hoac "pants" ---
        "garments": {
            "tshirt": {
                "glb": "garment-tshirt.glb",
                "meshPrefix": "tshirt_",
                "label": "Áo thun",
                "yZero": "shoulder line",
                "regions": REGION,
                "pinRegion": REGION["collar"],
                "fitKey": "chestCircCm",
                "printCalibration": PRINT_CALIBRATION,
                "sizes": {
                    m["size"]: {
                        "chestCircCm": round(m["chestCircAchieved"] * 100, 2),
                        "bodyLengthCm": round(m["bodyLength"] * 100, 2),
                        "hemYm": round(m["hemY"], 4),
                        "vertexCount": len(m["positions"]),
                        "triangleCount": len(m["indices"]) // 3,
                        "regionCounts": m["regionCounts"],
                    }
                    for m in shirts
                },
            },
            "pants": {
                "glb": "garment-pants.glb",
                "meshPrefix": "pants_",
                "label": "Quần",
                "yZero": "waist line",
                "regions": PANTS_REGION,
                "pinRegion": PANTS_REGION["waistband"],
                "fitKey": "waistCircCm",
                "printCalibration": PANTS_PRINT_CALIBRATION,
                "sizes": {
                    m["size"]: {
                        "waistCircCm": round(m["waistCircAchieved"] * 100, 2),
                        "hipCircCm": round(m["hipCircAchieved"] * 100, 2),
                        "inseamCm": round(m["inseam"] * 100, 2),
                        "hemOpeningCm": PANTS_SIZE_CHART[m["size"]]["hem"],
                        "hemYm": round(m["hemY"], 4),
                        "vertexCount": len(m["positions"]),
                        "triangleCount": len(m["indices"]) // 3,
                        "regionCounts": m["regionCounts"],
                    }
                    for m in pants
                },
            },
            "shorts": {
                "glb": "garment-shorts.glb",
                "meshPrefix": "shorts_",
                "label": "Quần short",
                "yZero": "waist line",
                "regions": PANTS_REGION,
                "pinRegion": PANTS_REGION["waistband"],
                "fitKey": "waistCircCm",
                "printCalibration": SHORTS_PRINT_CALIBRATION,
                "sizes": {
                    m["size"]: {
                        "waistCircCm": round(m["waistCircAchieved"] * 100, 2),
                        "hipCircCm": round(m["hipCircAchieved"] * 100, 2),
                        "inseamCm": round(m["inseam"] * 100, 2),
                        "hemOpeningCm": SHORTS_SIZE_CHART[m["size"]]["hem"],
                        "hemYm": round(m["hemY"], 4),
                        "vertexCount": len(m["positions"]),
                        "triangleCount": len(m["indices"]) // 3,
                        "regionCounts": m["regionCounts"],
                    }
                    for m in shorts
                },
            },
        },
    }
    meta_path = OUT_DIR / "garment-metadata.json"
    meta_path.write_text(json.dumps(metadata, separators=(",", ":")), encoding="utf-8")

    print(shirt_glb.name + ": " + str(shirt_glb.stat().st_size) + " B")
    _print_report("Ao thun", shirts, "chestCirc")
    print(pants_glb.name + ": " + str(pants_glb.stat().st_size) + " B")
    _print_report("Quan", pants, "waistCirc")
    print(shorts_glb.name + ": " + str(shorts_glb.stat().st_size) + " B")
    _print_report("Quan short", shorts, "waistCirc")
    print(meta_path.name + ": " + str(meta_path.stat().st_size) + " B")


if __name__ == "__main__":
    main()
