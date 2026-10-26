"""Xuat bo xuong MakeHuman (default.mhskel, CC0) cho avatar de tao dang (pose).

Avatar khong co skin trong GLB -- no la luoi + 22 morph so do. Day xuat ra
public/models/avatar-rig-{gender}.json:

  bones : ten, cha, va DAU / DUOI xuong bieu dien bang to hop co trong so cua
          K dinh luoi gan nhat. Avatar doi so do (morph) thi khop xuong di theo
          luoi, khong can xuat lai.
  skin  : 4 xuong co trong so lon nhat cho moi dinh luoi (thu tu dinh trung
          avatar-*.glb), lay tu default_weights.mhw qua vertexToOriginal.

Trinh duyet (src/lib/avatar/pose.ts) xoay xuong roi skin tuyen tinh tren CPU.
Run: python tools/avatar-pipeline/build_avatar_rig.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from build_avatar_glb import (
    ETHNICITIES,
    MH,
    MH_TO_METRES,
    apply_deltas,
    build_render_mesh,
    macrodetail_ethnicity_path,
    parse_obj,
    parse_target,
)

ROOT = Path(__file__).parent
OUT_DIR = ROOT.parent.parent / "public" / "models"
JOINT_K = 6     # dinh luoi dung de bieu dien moi khop
SKIN_K = 4      # xuong / dinh


def main() -> None:
    skel = json.loads((MH / "rigs" / "default.mhskel").read_text(encoding="utf-8"))
    weights = json.loads((MH / "rigs" / "default_weights.mhw").read_text(encoding="utf-8"))["weights"]
    obj = parse_obj(MH / "3dobjs" / "base.obj")
    render = build_render_mesh(obj)
    v2o = render.vertex_to_original

    # Moi dinh goc -> cac dinh render (mot dinh goc co the tach theo UV seam).
    o2r: dict[int, list[int]] = {}
    for r, o in enumerate(v2o):
        o2r.setdefault(o, []).append(r)

    # Thu tu xuong: cha truoc con.
    bones = skel["bones"]
    order: list[str] = []
    seen: set[str] = set()

    def visit(name: str) -> None:
        if name in seen:
            return
        parent = bones[name]["parent"]
        if parent:
            visit(parent)
        seen.add(name)
        order.append(name)

    for name in bones:
        visit(name)
    index_of = {n: i for i, n in enumerate(order)}

    for gender in ("male", "female"):
        neutral = list(obj.positions)
        for eth in ETHNICITIES:
            neutral = apply_deltas(neutral, parse_target(macrodetail_ethnicity_path(eth, gender)),
                                   weight=1.0 / 3.0)
        # Cung phep doi toa do voi build_avatar_glb (dm -> m, chan cham y=0, giua x=0).
        rp = [neutral[o] for o in v2o]
        rp = [(x * MH_TO_METRES, y * MH_TO_METRES, z * MH_TO_METRES) for x, y, z in rp]
        min_y = min(p[1] for p in rp)
        xs = [p[0] for p in rp]
        mid_x = (min(xs) + max(xs)) / 2.0

        def to_m(p):
            return (p[0] * MH_TO_METRES - mid_x, p[1] * MH_TO_METRES - min_y, p[2] * MH_TO_METRES)

        render_m = [(x - mid_x, y - min_y, z) for x, y, z in rp]

        # Luoi tim dinh gan nhat (luoi deu 4cm).
        cell = 0.04
        grid: dict[tuple[int, int, int], list[int]] = {}
        for i, p in enumerate(render_m):
            grid.setdefault((int(p[0] // cell), int(p[1] // cell), int(p[2] // cell)), []).append(i)

        def nearest(p, k):
            cx, cy, cz = int(p[0] // cell), int(p[1] // cell), int(p[2] // cell)
            for rad in range(1, 8):
                cand = []
                for dx in range(-rad, rad + 1):
                    for dy in range(-rad, rad + 1):
                        for dz in range(-rad, rad + 1):
                            cand.extend(grid.get((cx + dx, cy + dy, cz + dz), ()))
                if len(cand) >= k * 3:
                    break
            cand.sort(key=lambda i: math.dist(render_m[i], p))
            return cand[:k]

        def joint(name):
            idx = skel["joints"][name]
            pts = [to_m(neutral[i]) for i in idx]
            c = tuple(sum(q[a] for q in pts) / len(pts) for a in range(3))
            near = nearest(c, JOINT_K)
            # Trong so tai tao dung tam c: nghich dao khoang cach, roi luu ca
            # phan lech con lai (offset) de vi tri nghi khop chinh xac.
            w = [1.0 / (math.dist(render_m[i], c) + 1e-3) for i in near]
            s = sum(w)
            w = [x / s for x in w]
            mix = tuple(sum(w[j] * render_m[near[j]][a] for j in range(len(near))) for a in range(3))
            off = tuple(c[a] - mix[a] for a in range(3))
            return {"idx": near, "w": [round(x, 5) for x in w], "off": [round(x, 5) for x in off],
                    "rest": [round(x, 5) for x in c]}

        out_bones = []
        for name in order:
            b = bones[name]
            out_bones.append({
                "name": name,
                "parent": index_of[b["parent"]] if b["parent"] else -1,
                "head": joint(b["head"]),
                "tail": joint(b["tail"]),
            })

        # Skin: tron trong so theo dinh goc, giu 4 xuong lon nhat.
        per_orig: dict[int, list[tuple[int, float]]] = {}
        for bname, rows in weights.items():
            if bname not in index_of:
                continue
            bi = index_of[bname]
            for o, w in rows:
                if o in o2r:
                    per_orig.setdefault(o, []).append((bi, w))
        skin_idx: list[int] = []
        skin_w: list[float] = []
        missing = 0
        for r, o in enumerate(v2o):
            rows = sorted(per_orig.get(o, []), key=lambda t: -t[1])[:SKIN_K]
            if not rows:
                missing += 1
                rows = [(index_of["root"] if "root" in index_of else 0, 1.0)]
            s = sum(w for _, w in rows)
            rows = [(bi, w / s) for bi, w in rows] + [(0, 0.0)] * (SKIN_K - len(rows))
            for bi, w in rows:
                skin_idx.append(bi)
                skin_w.append(round(w, 4))

        out = {
            "source": "MakeHuman default.mhskel + default_weights.mhw (CC0)",
            "skinK": SKIN_K,
            "bones": out_bones,
            "skinIndex": skin_idx,
            "skinWeight": skin_w,
        }
        path = OUT_DIR / f"avatar-rig-{gender}.json"
        path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
        print(f"[{gender}] {len(out_bones)} xuong, {len(v2o)} dinh, thieu trong so {missing} -> "
              f"{path.name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
