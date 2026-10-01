"""Gan nhan thuoc tinh phoi do cho tung SAN PHAM trong dataset/ bang Gemini.

Moi san pham (gom cac thu muc mau cung kieu) lay 1 thu muc dai dien, gui anh
trai phang mat truoc, nhan ve JSON thuoc tinh. Ket qua: public/outfit/products.json
kem anh thu nho public/outfit/img/<id>.jpg (anh AI nguoi mau neu co, khong thi
anh trai phang).

  python tools/outfit/tag_products.py
"""
import base64, io, json, re, sys, time, urllib.request
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DS = ROOT / "dataset"
OUT = ROOT / "public" / "outfit"
MODEL = "gemini-2.5-flash"

PROMPT = """Tag this garment for an outfit recommender. Look only at the garment.
Return JSON exactly:
{"category": "top"|"bottom",
 "subtype": "tshirt"|"shirt"|"pants"|"shorts"|"skirt",
 "colors": [{"name": str, "hex": "#rrggbb", "role": "base"|"accent"}],
 "pattern": "solid"|"graphic"|"stripe"|"check"|"denim"|"texture",
 "style": subset of ["streetwear","casual","smart-casual","minimal","sporty","feminine","vintage"],
 "formality": 1-5 (1 beach/lounge, 2 casual, 3 smart-casual, 4 business, 5 formal),
 "season": subset of ["spring","summer","autumn","winter"],
 "fit": "slim"|"regular"|"relaxed"|"oversized",
 "name_vi": short Vietnamese product name, e.g. "Áo thun nâu in hình"}
"base" = the main fabric colour (exactly one). "accent" = print/trim colours (max 2)."""


def key() -> str:
    t = Path("C:/thuchanh/DATN/fashion-commerce/.env.local").read_text()
    return re.search(r"^GEMINI_API_KEY=(.+)$", t, re.M).group(1).strip()


def ask_openrouter(jpeg: bytes) -> dict:
    """Du phong khi het luot Gemini mien phi (~20 luot/ngay): cung model qua OpenRouter."""
    t = Path("C:/thuchanh/DATN/fashion-commerce/.env.local").read_text()
    k = re.search(r"^OPENROUTER_API_KEY=(.+)$", t, re.M).group(1).strip()
    body = {"model": "google/gemini-2.5-flash", "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()}},
                {"type": "text", "text": PROMPT}]}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {k}", "Content-Type": "application/json"})
    text = json.loads(urllib.request.urlopen(req, timeout=120).read())["choices"][0]["message"]["content"]
    return json.loads(re.search(r"\{.*\}", text, re.S).group(0))


def products() -> list[Path]:
    seen = {}
    for d in sorted(DS.iterdir()):
        if d.name.startswith("_") or not (d / "source.json").exists():
            continue
        s = json.loads((d / "source.json").read_text(encoding="utf-8"))
        seen.setdefault(s.get("style") or s["source"], d)
    return list(seen.values())


def main() -> None:
    client = genai.Client(api_key=key())
    (OUT / "img").mkdir(parents=True, exist_ok=True)
    out_file = OUT / "products.json"
    done = {p["id"]: p for p in json.loads(out_file.read_text(encoding="utf-8"))} if out_file.exists() else {}
    for d in products():
        if d.name in done:
            continue
        flat = Image.open(next(d.glob("front.*"))).convert("RGB")
        flat.thumbnail((768, 768))
        buf = io.BytesIO(); flat.save(buf, "JPEG", quality=88)
        tags = None
        for attempt in range(2):
            try:
                r = client.models.generate_content(
                    model=MODEL,
                    contents=[types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"), PROMPT],
                    config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0))
                tags = json.loads(r.text)
                break
            except Exception as e:  # noqa: BLE001  (free tier: 10 req/phut)
                print("  retry", d.name, str(e)[:80]); time.sleep(5)
        if tags is None:
            tags = ask_openrouter(buf.getvalue())
        shot = d / "ai_front.jpg" if (d / "ai_front.jpg").exists() else next(d.glob("front.*"))
        im = Image.open(shot).convert("RGB"); im.thumbnail((480, 640))
        im.save(OUT / "img" / f"{d.name}.jpg", "JPEG", quality=82)
        flat.thumbnail((360, 360)); flat.save(OUT / "img" / f"{d.name}__flat.jpg", "JPEG", quality=82)
        done[d.name] = {"id": d.name, **tags}
        out_file.write_text(json.dumps(list(done.values()), indent=1, ensure_ascii=False), encoding="utf-8")
        print(d.name, tags.get("subtype"), [c["name"] for c in tags.get("colors", [])], tags.get("style"), tags.get("formality"))
        sys.stdout.flush()
    print(len(done), "san pham")


if __name__ == "__main__":
    main()
