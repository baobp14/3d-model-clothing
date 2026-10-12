"""Tao nap cho de 300x300 va chia de + nap thanh 4 manh (<=220x220) co khop mong-duoi-en."""
import cadquery as cq, os, sys
D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, "out"); os.makedirs(OUT, exist_ok=True)
C = 155.0            # duong cat (tam hop)
CLR = 0.15           # khe ho moi ben cua khop
NECK, HEAD, DEPTH = 9.0, 14.0, 8.0
TABS = [(60, 1), (110, -1), (200, 1), (250, -1)]   # vi tri tab, huong
PIN_D, PIN_L = 2.0, 7.0   # lo chot filament 1.75mm

base = cq.importers.importStep(os.path.join(D, "de_goc.step"))

# --- Nap: tam 300x300x3 + vanh lot vao trong long de (trong 290x290) ---
GAP, LIP_T, LIP_H = 0.3, 2.0, 6.0
o = 290 - 2 * GAP
lid = (cq.Workplane().box(300, 300, 3, centered=(True, True, False))
       .faces(">Z").workplane().rect(o, o).rect(o - 2 * LIP_T, o - 2 * LIP_T).extrude(LIP_H)
       .translate((C, C, 0)))

# --- Ngam gai: 8 lay tren vanh nap, gờ moc vao mep tren lo cua so cua de (z 5-20) ---
# Toa do nap: z_nap = 28 - z_de. Lay dai toi z_de=16, go moc o z_de 19.5 (mep lo z_de=20).
SNAP_W, SNAP_TIP, BUMP, SLIT = 18.0, 12.0, 1.0, 1.0
y0 = 5 + 5 + GAP   # mat ngoai vanh nap (canh y nho)
for cx in (22.5, 287.5):           # tam lo cua so
    slits = cq.Workplane().box(SNAP_W + 2 * SLIT, LIP_T + 1, LIP_H, centered=(True, False, False)).translate((cx, y0 - 0.5, 3))
    tab = cq.Workplane().box(SNAP_W, LIP_T, SNAP_TIP - 3, centered=(True, False, False)).translate((cx, y0, 3))
    bump = (cq.Workplane("YZ").polyline([(y0, SNAP_TIP), (y0 - BUMP, 9.5), (y0 - BUMP, 8.5), (y0 + 0.01, 8.5)]).close()
            .extrude(SNAP_W - 2).translate((cx - (SNAP_W - 2) / 2, 0, 0)))
    for a in (0, 90, 180, 270):
        rot = lambda w: w.rotate((C, C, 0), (C, C, 1), a)
        lid = lid.cut(rot(slits)).union(rot(tab)).union(rot(bump))

def region(axis, off):
    """Vung 'duoi' cua duong cat (x<C neu axis='x'), co duoi en, noi rong them off."""
    c = C + off
    pts = [(-50, -50), (c, -50)]
    for t, s in TABS:
        n, h, tip = NECK / 2 + s * off, HEAD / 2 + s * off, C + s * DEPTH + off
        pts += [(c, t - n), (tip, t - h), (tip, t + h), (c, t + n)]
    pts += [(c, 400), (-50, 400)]
    if axis == "y": pts = [(y, x) for x, y in pts][::-1]
    w = cq.Wire.makePolygon([cq.Vector(x, y, -10) for x, y in pts], close=True)
    return cq.Workplane().add(cq.Solid.extrudeLinear(cq.Face.makeFromWires(w), cq.Vector(0, 0, 100)))

def split(solid, axis):
    lo = solid.intersect(region(axis, -CLR)); hi = solid.cut(region(axis, CLR)); return lo, hi

def pins(part, walls):
    """Lo chot ngang qua mat cat o giua thanh tuong."""
    for axis, wc in walls:
        for z in (10, 18):
            if axis == "x":   # mat cat x=C, tuong chay theo x
                cyl = cq.Workplane("YZ").center(wc, z).circle(PIN_D / 2).extrude(PIN_L, both=True).translate((C, 0, 0))
            else:
                cyl = cq.Workplane("XZ").center(wc, z).circle(PIN_D / 2).extrude(PIN_L, both=True).translate((0, C, 0))
            part = part.cut(cyl)
    return part

for name, obj, walls in [("de", base, [("x", 7.5), ("x", 302.5), ("y", 7.5), ("y", 302.5)]), ("nap", lid, [])]:
    cq.exporters.export(obj, f"{OUT}/{name}_nguyen.step")
    obj = pins(obj, walls)
    L, R = split(obj, "x")
    for sx, half in (("trai", L), ("phai", R)):
        Lo, Hi = split(half, "y")
        for sy, q in (("duoi", Lo), ("tren", Hi)):
            bb = q.val().BoundingBox()
            q = q.translate((-bb.xmin, -bb.ymin, -bb.zmin))
            if name == "nap": q = q.rotate((0, 0, 0), (1, 0, 0), 180).translate((0, bb.ylen, bb.zlen))  # mat tren up xuong ban in
            fn = f"{OUT}/{name}_{sx}_{sy}"
            cq.exporters.export(q, fn + ".step"); cq.exporters.export(q, fn + ".stl", tolerance=0.02)
            b = q.val().BoundingBox(); print(fn, round(b.xlen, 1), round(b.ylen, 1), round(b.zlen, 1), q.val().isValid())
