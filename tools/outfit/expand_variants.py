"""Mo rong products.json (1 dong / san pham) thanh catalog.json (1 dong / mau).

Thuoc tinh phong cach giu cua san pham; mau nen lay tu baseColor ma
build_prints.mjs da do tren anh da xoa nen, ten mau tu ten thu muc. Khong goi AI.

  python tools/outfit/expand_variants.py
"""
import json, os, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DS, OUT = ROOT / "dataset", ROOT / "public" / "outfit"

tags = {p["id"]: p for p in json.loads((OUT / "products.json").read_text(encoding="utf-8"))}
base_hex = {i["id"]: i["baseColor"] for i in json.loads((ROOT / "public/prints/manifest.json").read_text())["items"]}

# thu muc dai dien (da gan nhan) cua tung san pham
rep_of = {}
for d in sorted(DS.iterdir()):
    if d.name.startswith("_") or not (d / "source.json").exists():
        continue
    s = json.loads((d / "source.json").read_text(encoding="utf-8"))
    rep_of.setdefault(s.get("style") or s["source"], []).append(d)

catalog = []
for group in rep_of.values():
    rep = next(d for d in group if d.name in tags)
    t = tags[rep.name]
    prefix = os.path.commonprefix([d.name for d in group]) if len(group) > 1 else rep.name
    for d in group:
        item = json.loads(json.dumps(t))
        item["id"] = d.name
        item["product"] = rep.name
        if d != rep:
            colour = d.name[len(prefix):].strip("_").replace("_", " ") or "default"
            accents = [c for c in t["colors"] if c["role"] == "accent"]
            # Ao in hinh: phan in giu nguyen, chi doi mau vai.
            item["colors"] = [{"name": colour, "hex": base_hex.get(d.name, "#808080"), "role": "base"}] + (
                accents if t["pattern"] == "graphic" else [])
            # Ten goc co the chua mau cua thu muc dai dien ("Ao thun den tron").
            plain = re.sub(r"\s*\b(màu\s+)?(đen|trắng|xám|nâu|be|kem|xanh( (lá|dương|navy|rêu|đậm|nhạt))?|đỏ|hồng|vàng|cam|tím|kaki|olive|ghi)\b", "", t["name_vi"], flags=re.I).strip()
            item["name_vi"] = f"{plain} ({colour})"
            flat = Image.open(next(p for p in d.glob("front.*") if not p.name.endswith(".cut.png"))).convert("RGB")
            flat.thumbnail((360, 360))
            flat.save(OUT / "img" / f"{d.name}__flat.jpg", "JPEG", quality=82)
        item["model_img"] = (OUT / "img" / f"{d.name}.jpg").exists()
        catalog.append(item)

(OUT / "catalog.json").write_text(json.dumps(catalog, indent=1, ensure_ascii=False), encoding="utf-8")
print(len(catalog), "bien the;", sum(c["category"] == "bottom" for c in catalog), "quan/vay")
