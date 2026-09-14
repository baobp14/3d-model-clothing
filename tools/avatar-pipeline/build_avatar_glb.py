#!/usr/bin/env python3
"""Build public/models/avatar-{male,female}.glb + avatar-metadata.json from the
MakeHuman CC0 assets fetched into tools/avatar-pipeline/mh-data/.

Pure standard library (json, struct, array, pathlib) -- no numpy, no Blender,
no MakeHuman application code. See AVATAR_TEST_HANDOFF.md for the full spec
this file implements (Appendices A-D contain the pieces that cannot be
derived from first principles: measurement vertex rings, the group-skip rule,
the landmark-finding algorithm, and the GLB binary layout).
"""
from __future__ import annotations

import json
import struct
from array import array
from pathlib import Path

ROOT = Path(__file__).parent
MH = ROOT / "mh-data" / "data"
OUT_DIR = ROOT.parent.parent / "public" / "models"

MH_TO_METRES = 0.1
GENDERS = ("male", "female")
ETHNICITIES = ("african", "asian", "caucasian")

# --- Appendix A: MEASURE_RINGS (verbatim from MakeHuman's Ruler class) ------
MEASURE_RINGS = {
    "neck": [7514, 10358, 7631, 7496, 7488, 7489, 7474, 7475, 7531, 7537, 7543, 7549, 7555,
             7561, 7743, 7722, 856, 1030, 1051, 850, 844, 838, 832, 826, 820, 756, 755, 770,
             769, 777, 929, 3690, 804, 800, 808, 801, 799, 803, 7513, 7515, 7521, 7514],
    "chest": [8439, 8455, 8462, 8446, 8478, 8494, 8557, 8510, 8526, 8542, 10720, 10601, 10603,
              10602, 10612, 10611, 10610, 10613, 10604, 10605, 10606, 3942, 3941, 3940, 3950,
              3947, 3948, 3949, 3938, 3939, 3937, 4065, 1870, 1854, 1838, 1885, 1822, 1806,
              1774, 1790, 1783, 1767, 1799, 8471],
    "waist": [4121, 10760, 10757, 10777, 10776, 10779, 10780, 10778, 10781, 10771, 10773,
              10772, 10775, 10774, 10814, 10834, 10816, 10817, 10818, 10819, 10820, 10821,
              4181, 4180, 4179, 4178, 4177, 4176, 4175, 4196, 4173, 4131, 4132, 4129, 4130,
              4128, 4138, 4135, 4137, 4136, 4133, 4134, 4108, 4113, 4118, 4121],
    "hip": [4341, 10968, 10969, 10971, 10970, 10967, 10928, 10927, 10925, 10926, 10923, 10924,
            10868, 10875, 10861, 10862, 4228, 4227, 4226, 4242, 4234, 4294, 4293, 4296, 4295,
            4297, 4298, 4342, 4345, 4346, 4344, 4343, 4361, 4341],
    "shoulder": [7478, 8274],
    "upperarm": [8274, 10037],
    "lowerarm": [10040, 10548],
    "upperleg": [10970, 11230],
    "lowerleg": [11225, 12820],
}

# 22 morph targets, ORDER IS A CONTRACT with avatar-metadata.json / avatarMorphService.ts
MORPH_ORDER = [
    "height_incr", "height_decr", "weight_incr", "weight_decr",
    "chest_incr", "chest_decr", "waist_incr", "waist_decr",
    "hip_incr", "hip_decr", "shoulder_incr", "shoulder_decr",
    "upperarm_incr", "upperarm_decr", "lowerarm_incr", "lowerarm_decr",
    "upperleg_incr", "upperleg_decr", "lowerleg_incr", "lowerleg_decr",
    "neck_incr", "neck_decr",
]

# morph name -> (relative path under mh-data/data, is-per-gender)
_MEASURE = "targets/measure/measure-{name}-{kind}-{dir}.target"
MORPH_SOURCE = {
    "chest_incr": ("measure-bust-circ-incr", False),
    "chest_decr": ("measure-bust-circ-decr", False),
    "waist_incr": ("measure-waist-circ-incr", False),
    "waist_decr": ("measure-waist-circ-decr", False),
    "hip_incr": ("measure-hips-circ-incr", False),
    "hip_decr": ("measure-hips-circ-decr", False),
    "shoulder_incr": ("measure-shoulder-dist-incr", False),
    "shoulder_decr": ("measure-shoulder-dist-decr", False),
    "upperarm_incr": ("measure-upperarm-length-incr", False),
    "upperarm_decr": ("measure-upperarm-length-decr", False),
    "lowerarm_incr": ("measure-lowerarm-length-incr", False),
    "lowerarm_decr": ("measure-lowerarm-length-decr", False),
    "upperleg_incr": ("measure-upperleg-height-incr", False),
    "upperleg_decr": ("measure-upperleg-height-decr", False),
    "lowerleg_incr": ("measure-lowerleg-height-incr", False),
    "lowerleg_decr": ("measure-lowerleg-height-decr", False),
    "neck_incr": ("measure-neck-circ-incr", False),
    "neck_decr": ("measure-neck-circ-decr", False),
}


def measure_target_path(name: str) -> Path:
    return MH / "targets" / "measure" / f"{name}.target"


def macrodetail_ethnicity_path(ethnicity: str, gender: str) -> Path:
    return MH / "targets" / "macrodetails" / f"{ethnicity}-{gender}-young.target"


def macrodetail_weight_path(gender: str, level: str) -> Path:
    return MH / "targets" / "macrodetails" / f"universal-{gender}-young-averagemuscle-{level}.target"


def macrodetail_height_path(gender: str, level: str) -> Path:
    return MH / "targets" / "macrodetails" / "height" / f"{gender}-young-averagemuscle-averageweight-{level}.target"


# --- OBJ parsing -------------------------------------------------------------

class ObjMesh:
    def __init__(self) -> None:
        self.positions: list[tuple[float, float, float]] = []  # decimetres, original index
        self.uvs: list[tuple[float, float]] = []
        # each face: (group_name, [(v_idx0, vt_idx0), ...])
        self.faces: list[tuple[str, list[tuple[int, int]]]] = []


def parse_obj(path: Path) -> ObjMesh:
    mesh = ObjMesh()
    group = "default"
    with path.open(encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("g "):
                group = line[2:].strip()
                continue
            if line.startswith("v "):
                x, y, z = (float(p) for p in line.split()[1:4])
                mesh.positions.append((x, y, z))
                continue
            if line.startswith("vt "):
                u, v = (float(p) for p in line.split()[1:3])
                mesh.uvs.append((u, v))
                continue
            if line.startswith("f "):
                corners = []
                for token in line.split()[1:]:
                    parts = token.split("/")
                    v_idx = int(parts[0]) - 1
                    vt_idx = int(parts[1]) - 1 if len(parts) > 1 and parts[1] else -1
                    corners.append((v_idx, vt_idx))
                mesh.faces.append((group, corners))
    return mesh


def is_skipped_group(name: str) -> bool:
    return name.startswith("helper") or name.startswith("joint")


# --- Target (.target) parsing ------------------------------------------------

def parse_target(path: Path) -> dict[int, tuple[float, float, float]]:
    """Returns {original_vertex_index: (dx, dy, dz)} in decimetres. Empty dict
    for a header-only ("empty") target file, e.g. *-averageweight-*.target."""
    deltas: dict[int, tuple[float, float, float]] = {}
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open(encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            idx = int(parts[0])
            dx, dy, dz = (float(p) for p in parts[1:4])
            deltas[idx] = (dx, dy, dz)
    return deltas


def apply_deltas(
    base: list[tuple[float, float, float]],
    deltas: dict[int, tuple[float, float, float]],
    weight: float = 1.0,
) -> list[tuple[float, float, float]]:
    if weight == 0 or not deltas:
        return list(base)
    out = list(base)
    for idx, (dx, dy, dz) in deltas.items():
        x, y, z = out[idx]
        out[idx] = (x + dx * weight, y + dy * weight, z + dz * weight)
    return out


# --- Render mesh construction (Appendix B) -----------------------------------

class RenderMesh:
    def __init__(self) -> None:
        self.vertex_to_original: list[int] = []  # render idx -> original v idx
        self.corner_to_render: dict[tuple[int, int], int] = {}  # (v_idx, vt_idx) -> render idx
        self.uv: list[tuple[float, float]] = []  # render idx -> (u, v)
        self.triangles: list[tuple[int, int, int]] = []  # render idx triples
        self.skipped_group_count = 0
        self.skipped_face_count = 0


def build_render_mesh(obj: ObjMesh) -> RenderMesh:
    rm = RenderMesh()
    seen_groups_skipped: set[str] = set()
    for group, corners in obj.faces:
        if is_skipped_group(group):
            seen_groups_skipped.add(group)
            rm.skipped_face_count += 1
            continue
        render_corners = []
        for (v_idx, vt_idx) in corners:
            key = (v_idx, vt_idx)
            render_idx = rm.corner_to_render.get(key)
            if render_idx is None:
                render_idx = len(rm.vertex_to_original)
                rm.corner_to_render[key] = render_idx
                rm.vertex_to_original.append(v_idx)
                rm.uv.append(obj.uvs[vt_idx] if vt_idx >= 0 else (0.0, 0.0))
            render_corners.append(render_idx)
        # fan triangulation
        for k in range(1, len(render_corners) - 1):
            rm.triangles.append((render_corners[0], render_corners[k], render_corners[k + 1]))
    rm.skipped_group_count = len(seen_groups_skipped)
    return rm


def compute_render_positions(
    render: RenderMesh, original_positions: list[tuple[float, float, float]]
) -> list[tuple[float, float, float]]:
    return [original_positions[orig] for orig in render.vertex_to_original]


def compute_smooth_normals(
    positions: list[tuple[float, float, float]], triangles: list[tuple[int, int, int]]
) -> list[tuple[float, float, float]]:
    acc = [[0.0, 0.0, 0.0] for _ in positions]
    for (a, b, c) in triangles:
        ax, ay, az = positions[a]
        bx, by, bz = positions[b]
        cx, cy, cz = positions[c]
        e1 = (bx - ax, by - ay, bz - az)
        e2 = (cx - ax, cy - ay, cz - az)
        # unnormalized cross product -- area-weighted contribution
        cross = (
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
        )
        for v in (a, b, c):
            acc[v][0] += cross[0]
            acc[v][1] += cross[1]
            acc[v][2] += cross[2]
    normals = []
    for x, y, z in acc:
        length = (x * x + y * y + z * z) ** 0.5
        if length < 1e-12:
            normals.append((0.0, 1.0, 0.0))
        else:
            normals.append((x / length, y / length, z / length))
    return normals


# --- Appendix C: landmark finding --------------------------------------------

def find_landmarks(
    render_positions_m: list[tuple[float, float, float]],
    vertex_to_original: list[int],
) -> dict[str, int]:
    """positions already in metres, centred on X, feet at y=0. Returns original
    vertex indices for acromionRight, acromionLeft, crotch."""
    # acromion right: first render vertex whose original id is 8274
    right_render = None
    for i, orig in enumerate(vertex_to_original):
        if orig == 8274:
            right_render = i
            break
    if right_render is None:
        raise ValueError("acromion right (original vertex 8274) not present in render mesh")
    ax, ay, az = render_positions_m[right_render]

    # acromion left: nearest render vertex to the mirrored point (-ax, ay, az)
    best_i = -1
    best_d2 = float("inf")
    for i, (x, y, z) in enumerate(render_positions_m):
        d2 = (x + ax) ** 2 + (y - ay) ** 2 + (z - az) ** 2
        if d2 < best_d2:
            best_d2 = d2
            best_i = i
    if best_d2 > 1e-8:
        raise ValueError(f"acromion left mirror search failed, best d^2={best_d2}")
    left_render = best_i

    # crotch: lowest vertex on the sagittal plane within the pelvis band
    ys = [p[1] for p in render_positions_m]
    span = max(ys) - min(ys)
    y_min_all = min(ys)
    crotch_render = None
    crotch_y = None
    for i, (x, y, z) in enumerate(render_positions_m):
        if abs(x) <= 0.012 and 0.35 * span < y < 0.60 * span:
            if crotch_y is None or y < crotch_y:
                crotch_y = y
                crotch_render = i
    if crotch_render is None:
        raise ValueError("crotch landmark search found no candidate vertices")

    return {
        "acromionRight": vertex_to_original[right_render],
        "acromionLeft": vertex_to_original[left_render],
        "crotch": vertex_to_original[crotch_render],
        # kept for debug/report printing only, not part of the metadata contract
        "_acromionRightRender": right_render,
        "_acromionLeftRender": left_render,
        "_crotchRender": crotch_render,
    }


# --- GLB binary writer (Appendix D) ------------------------------------------

GLB_MAGIC = 0x46546C67
GLB_VERSION = 2
CHUNK_TYPE_JSON = 0x4E4F534A
CHUNK_TYPE_BIN = 0x004E4942


def pad_to_4(data: bytes, pad_byte: bytes) -> bytes:
    remainder = len(data) % 4
    if remainder == 0:
        return data
    return data + pad_byte * (4 - remainder)


def write_glb(path: Path, gltf_json: dict, bin_data: bytes) -> None:
    json_bytes = json.dumps(gltf_json, separators=(",", ":")).encode("utf-8")
    json_bytes = pad_to_4(json_bytes, b" ")
    bin_bytes = pad_to_4(bin_data, b"\x00")

    json_chunk = struct.pack("<II", len(json_bytes), CHUNK_TYPE_JSON) + json_bytes
    bin_chunk = struct.pack("<II", len(bin_bytes), CHUNK_TYPE_BIN) + bin_bytes

    total_length = 12 + len(json_chunk) + len(bin_chunk)
    header = struct.pack("<III", GLB_MAGIC, GLB_VERSION, total_length)

    path.write_bytes(header + json_chunk + bin_chunk)


class BufferBuilder:
    def __init__(self) -> None:
        self.chunks: list[bytes] = []
        self.byte_views: list[dict] = []
        self.offset = 0

    def add(self, data: bytes) -> int:
        assert len(data) % 4 == 0, "all accessor data must already be 4-byte aligned"
        view_index = len(self.byte_views)
        self.byte_views.append({"buffer": 0, "byteOffset": self.offset, "byteLength": len(data)})
        self.chunks.append(data)
        self.offset += len(data)
        return view_index

    def build(self) -> bytes:
        return b"".join(self.chunks)


def pack_vec3_array(values: list[tuple[float, float, float]]) -> bytes:
    flat = array("f")
    for x, y, z in values:
        flat.extend((x, y, z))
    return flat.tobytes()


def pack_vec2_array(values: list[tuple[float, float]]) -> bytes:
    flat = array("f")
    for u, v in values:
        flat.extend((u, v))
    return flat.tobytes()


def pack_uint32_array(values: list[int]) -> bytes:
    flat = array("I", values)
    return flat.tobytes()


def vec3_min_max(values: list[tuple[float, float, float]]) -> tuple[list[float], list[float]]:
    xs = [v[0] for v in values]
    ys = [v[1] for v in values]
    zs = [v[2] for v in values]
    return [min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)]


def build_gltf_for_gender(
    gender: str,
    render: RenderMesh,
    positions_m: list[tuple[float, float, float]],
    normals: list[tuple[float, float, float]],
    uvs: list[tuple[float, float]],
    indices: list[int],
    morph_deltas_m: list[list[tuple[float, float, float]]],
) -> tuple[dict, bytes]:
    bb = BufferBuilder()
    accessors = []

    pos_view = bb.add(pack_vec3_array(positions_m))
    pos_min, pos_max = vec3_min_max(positions_m)
    accessors.append({
        "bufferView": pos_view, "componentType": 5126, "count": len(positions_m),
        "type": "VEC3", "min": pos_min, "max": pos_max,
    })
    pos_accessor = len(accessors) - 1

    norm_view = bb.add(pack_vec3_array(normals))
    accessors.append({"bufferView": norm_view, "componentType": 5126, "count": len(normals), "type": "VEC3"})
    norm_accessor = len(accessors) - 1

    uv_view = bb.add(pack_vec2_array(uvs))
    accessors.append({"bufferView": uv_view, "componentType": 5126, "count": len(uvs), "type": "VEC2"})
    uv_accessor = len(accessors) - 1

    idx_view = bb.add(pack_uint32_array(indices))
    accessors.append({"bufferView": idx_view, "componentType": 5125, "count": len(indices), "type": "SCALAR"})
    idx_accessor = len(accessors) - 1

    target_accessor_indices = []
    for deltas in morph_deltas_m:
        view = bb.add(pack_vec3_array(deltas))
        d_min, d_max = vec3_min_max(deltas)
        accessors.append({
            "bufferView": view, "componentType": 5126, "count": len(deltas),
            "type": "VEC3", "min": d_min, "max": d_max,
        })
        target_accessor_indices.append(len(accessors) - 1)

    bin_data = bb.build()

    mesh = {
        "name": f"avatar-{gender}",
        "extras": {"targetNames": MORPH_ORDER},
        "weights": [0.0] * len(MORPH_ORDER),
        "primitives": [{
            "attributes": {"POSITION": pos_accessor, "NORMAL": norm_accessor, "TEXCOORD_0": uv_accessor},
            "indices": idx_accessor,
            "material": 0,
            "targets": [{"POSITION": a} for a in target_accessor_indices],
            "extras": {"targetNames": MORPH_ORDER},
        }],
    }

    gltf = {
        "asset": {"version": "2.0", "generator": "avatar-pipeline/build_avatar_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": f"avatar-{gender}"}],
        "meshes": [mesh],
        "materials": [{
            "name": "skin",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.82, 0.68, 0.58, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.9,
            },
            "doubleSided": False,
        }],
        "accessors": accessors,
        "bufferViews": bb.byte_views,
        "buffers": [{"byteLength": len(bin_data)}],
    }
    return gltf, bin_data


# --- Main build per gender ----------------------------------------------------

def build_gender(gender: str, obj: ObjMesh, render: RenderMesh, report: dict) -> dict:
    base_positions = obj.positions

    neutral = list(base_positions)
    for ethnicity in ETHNICITIES:
        deltas = parse_target(macrodetail_ethnicity_path(ethnicity, gender))
        neutral = apply_deltas(neutral, deltas, weight=1.0 / 3.0)

    render_positions_dm = compute_render_positions(render, neutral)
    # decimetres -> metres
    render_positions_m = [(x * MH_TO_METRES, y * MH_TO_METRES, z * MH_TO_METRES) for (x, y, z) in render_positions_dm]

    min_y = min(p[1] for p in render_positions_m)
    xs = [p[0] for p in render_positions_m]
    mid_x = (min(xs) + max(xs)) / 2.0
    render_positions_m = [(x - mid_x, y - min_y, z) for (x, y, z) in render_positions_m]
    ground_offset_m = -min_y

    normals = compute_smooth_normals(render_positions_m, render.triangles)
    indices = [i for tri in render.triangles for i in tri]

    landmarks = find_landmarks(render_positions_m, render.vertex_to_original)

    # debug metrics (Appendix C sanity check)
    ar = render_positions_m[landmarks["_acromionRightRender"]]
    al = render_positions_m[landmarks["_acromionLeftRender"]]
    shoulder_chord_cm = (
        (ar[0] - al[0]) ** 2 + (ar[1] - al[1]) ** 2 + (ar[2] - al[2]) ** 2
    ) ** 0.5 * 100
    crotch_y = render_positions_m[landmarks["_crotchRender"]][1]
    inseam_cm = crotch_y * 100
    height_cm = (max(p[1] for p in render_positions_m) - min(p[1] for p in render_positions_m)) * 100

    # 22 morph target deltas, in render-vertex order, metres
    morph_deltas_m: list[list[tuple[float, float, float]]] = []
    for name in MORPH_ORDER:
        if name in MORPH_SOURCE:
            target_name, _ = MORPH_SOURCE[name]
            deltas_orig = parse_target(measure_target_path(target_name))
        elif name == "height_incr":
            deltas_orig = parse_target(macrodetail_height_path(gender, "maxheight"))
        elif name == "height_decr":
            deltas_orig = parse_target(macrodetail_height_path(gender, "minheight"))
        elif name == "weight_incr":
            deltas_orig = parse_target(macrodetail_weight_path(gender, "maxweight"))
        elif name == "weight_decr":
            deltas_orig = parse_target(macrodetail_weight_path(gender, "minweight"))
        else:
            raise KeyError(name)

        render_deltas = []
        for orig_idx in render.vertex_to_original:
            dx, dy, dz = deltas_orig.get(orig_idx, (0.0, 0.0, 0.0))
            render_deltas.append((dx * MH_TO_METRES, dy * MH_TO_METRES, dz * MH_TO_METRES))
        morph_deltas_m.append(render_deltas)

    gltf, bin_data = build_gltf_for_gender(
        gender, render, render_positions_m, normals, render.uv, indices, morph_deltas_m
    )

    out_path = OUT_DIR / f"avatar-{gender}.glb"
    write_glb(out_path, gltf, bin_data)
    size_bytes = out_path.stat().st_size

    print(f"[{gender}] {len(render_positions_m)} verts, {len(render.triangles)} tris, "
          f"height {height_cm/100:.4f} m, ground_offset {ground_offset_m:.4f} m")
    print(f"[{gender}] shoulderWidthCm(chord) {shoulder_chord_cm:.2f}, inseamCm {inseam_cm:.2f}")
    print(f"[{gender}] -> {out_path.name} ({size_bytes} B)")

    report["genders"][gender] = {
        "vertices": len(render_positions_m),
        "triangles": len(render.triangles),
        "heightMetres": round(height_cm / 100, 4),
        "groundOffsetMetres": round(ground_offset_m, 4),
        "shoulderWidthChordCm": round(shoulder_chord_cm, 2),
        "inseamCm": round(inseam_cm, 2),
        "glbBytes": size_bytes,
    }

    return {
        "acromionLeft": landmarks["acromionLeft"],
        "acromionRight": landmarks["acromionRight"],
        "crotch": landmarks["crotch"],
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    obj = parse_obj(MH / "3dobjs" / "base.obj")
    render = build_render_mesh(obj)

    print(f"Base OBJ: {len(obj.positions)} original verts, {len(obj.faces)} faces")
    print(f"Render mesh: {render.skipped_group_count} groups / {render.skipped_face_count} faces skipped "
          f"-> {len(render.vertex_to_original)} verts, {len(render.triangles)} triangles")

    report = {"genders": {}}
    landmarks_by_gender = {}
    for gender in GENDERS:
        landmarks_by_gender[gender] = build_gender(gender, obj, render, report)

    metadata = {
        "morphOrder": MORPH_ORDER,
        "measureRings": MEASURE_RINGS,
        "landmarks": landmarks_by_gender,
        "vertexToOriginal": render.vertex_to_original,
        "units": "metres, Y up, feet at y=0",
        "source": "MakeHuman CC0 1.0 (makehumancommunity/makehuman)",
        "build": report,
    }
    metadata_path = OUT_DIR / "avatar-metadata.json"
    metadata_path.write_text(json.dumps(metadata, separators=(",", ":")), encoding="utf-8")
    print(f"metadata -> {metadata_path.name} ({metadata_path.stat().st_size} B)")


if __name__ == "__main__":
    main()
