"""Tao anh nguoi mau mac ao tu anh trai phang (front/back) bang Gemini.

Chong Gemini "sang tac" lai chi tiet ao bang 3 lop:
  1. Prompt rang buoc: anh ao la NGUON SU THAT, liet ke ro nhung gi cam doi
     (chu, hinh in, vi tri, mau, so nut...), bat mo ta ao TRUOC khi ve.
  2. Gui ca anh truoc + sau va anh CAN vung hinh in, de model nhin ro chi tiet.
  3. Tu kiem tra: goi Gemini lan 2 so anh tao ra voi anh goc, cham diem va
     liet ke sai khac; duoi nguong thi tao lai (toi da RETRIES lan).

  set GEMINI_API_KEY=...   (hoac them vao .env.local)
  python tools/garment-pipeline/gemini_tryon.py dataset/jtd_raise_hell_heavy_graphic_t_shirt_brown [...]

Ket qua: <thu muc mau>/ai_front.jpg, ai_back.jpg + ai_report.json
"""
import io
import json
import os
import re
import sys
from pathlib import Path

import base64
import urllib.request

from PIL import Image

# Goi qua OpenRouter (tra theo luot, re) thay vi Gemini API truc tiep: goi
# mien phi cua Google khong cho tao anh.
IMAGE_MODEL = os.environ.get("TRYON_IMAGE_MODEL", "google/gemini-2.5-flash-image")
CHECK_MODEL = os.environ.get("TRYON_CHECK_MODEL", "google/gemini-2.5-flash")
RETRIES = 2
PASS_SCORE = 8

PROMPT = """You are a product photographer doing a VIRTUAL TRY-ON, not a designer.

INPUT: flat-lay photos of ONE real garment ({kind}). They are the single source
of truth. Also given: a close-up crop of its print area.

STEP 1 - Before drawing, silently inventory the garment: base colour, every
piece of text (exact spelling, letter case, font style), every graphic and its
position/size relative to the chest or back, collar type, sleeve length,
pockets, buttons, seams, labels, hem shape.

STEP 2 - Generate ONE photo: a {model} standing straight, {view}, plain light
grey studio background, soft even light, full body from head to knees, arms
relaxed, garment fully visible and not covered by hands, hair or other items.
Plain neutral {other}.

HARD RULES - the garment must be a pixel-faithful transfer of the flat-lay:
- Do NOT redesign, restyle, simplify, "improve" or re-letter anything.
- Text: identical characters, spelling, case and font. If you cannot render a
  word exactly, keep its shape rather than inventing different letters.
- Graphics: same artwork, same colours, same size and placement.
- Base colour and fabric texture: unchanged (no recolouring by lighting).
- Same collar, sleeve length, fit, pockets, number of buttons.
- Add NOTHING that is not in the flat-lay (no extra logos, patches, text).
Only natural fabric folds and body shape may change."""

VIEWS = {
    "front": "facing the camera, front of the garment visible",
    "back": "seen from directly behind, back of the garment visible",
}

CHECK = """Image 1-2: flat-lay photos of a real garment (reference).
Image 3: generated photo of a model wearing it ({view} view).
Compare ONLY the garment. Answer JSON:
{{"score": 0-10 (10 = identical design), "differences": ["..."]}}
Count as differences: changed/misspelled text, missing or added graphics,
different colours, moved or resized prints, wrong collar/sleeves/buttons."""


def load_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if key:
        return key
    for env in [Path(__file__).resolve().parents[2] / ".env.local",
                Path("C:/thuchanh/DATN/fashion-commerce/.env.local")]:
        if env.exists():
            m = re.search(r"^OPENROUTER_API_KEY=(.+)$", env.read_text(), re.M)
            if m:
                return m.group(1).strip()
    sys.exit("Thieu OPENROUTER_API_KEY (bien moi truong hoac .env.local)")


class Client:
    def __init__(self, key: str):
        self.key = key

    def chat(self, model: str, content: list, **extra) -> dict:
        body = {"model": model, "messages": [{"role": "user", "content": content}],
                "temperature": 0.2, **extra}
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=300).read())["choices"][0]["message"]


def part(img: Image.Image) -> dict:
    img = img.convert("RGB")
    img.thumbnail((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return {"type": "image_url", "image_url": {
        "url": "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()}}


def print_crop(img: Image.Image) -> Image.Image:
    """Vung giua-tren cua ao, noi hinh in thuong nam -- cho model nhin ro."""
    w, h = img.size
    return img.crop((int(w * .2), int(h * .15), int(w * .8), int(h * .7))).resize((768, 768))


def kind_of(folder: str) -> tuple[str, str]:
    if "skirt" in folder:
        return "skirt", "top: plain white fitted tank top"
    if "pant" in folder or "short" in folder:
        return "pants" if "pant" in folder else "shorts", "top: plain white fitted t-shirt"
    if "shirt" in folder and "t_shirt" not in folder:
        return "button-up shirt", "bottoms: plain dark trousers"
    return "t-shirt", "bottoms: plain dark jeans"


def generate(client, refs: list[dict], prompt: str) -> Image.Image | None:
    msg = client.chat(IMAGE_MODEL, refs + [{"type": "text", "text": prompt}],
                      modalities=["image", "text"])
    for im in msg.get("images") or []:
        data = im["image_url"]["url"].split(",", 1)[1]
        return Image.open(io.BytesIO(base64.b64decode(data)))
    return None


def check(client, refs: list[dict], out: Image.Image, view: str) -> dict:
    msg = client.chat(CHECK_MODEL, refs + [part(out), {"type": "text", "text": CHECK.format(view=view)}],
                      response_format={"type": "json_object"})
    text = msg.get("content") or ""
    try:
        return json.loads(re.search(r"\{.*\}", text, re.S).group(0))
    except Exception:  # noqa: BLE001
        return {"score": 0, "differences": [text[:200]]}


def run(client, d: Path) -> None:
    side = lambda n: Image.open(next(d.glob(n + ".*")))  # .jpg / .webp
    front, back = side("front"), side("back")
    kind, other = kind_of(d.name)
    model = "female model" if kind == "skirt" else "model"
    report = {}
    for view, main in [v for v in (("front", front), ("back", back)) if v[0] in VIEWS_TO_RUN]:
        refs = [part(front), part(back), part(print_crop(main))]
        prompt = PROMPT.format(kind=kind, model=model, view=VIEWS[view], other=other)
        if (d / f"ai_{view}.jpg").exists():
            continue
        best = None
        for attempt in range(1, RETRIES + 1):
            img = generate(client, refs, prompt)
            if img is None:
                continue
            res = check(client, refs[:2], img, view)
            print(f"  {d.name} {view} lan {attempt}: {res.get('score')}/10 {res.get('differences')}")
            if best is None or res.get("score", 0) > best[1].get("score", 0):
                best = (img, res)
            if res.get("score", 0) >= PASS_SCORE:
                break
            # Lan sau: noi ro loi vua mac.
            prompt += "\nPREVIOUS ATTEMPT WAS REJECTED FOR: " + "; ".join(res.get("differences", []))
        if best:
            best[0].convert("RGB").save(d / f"ai_{view}.jpg", quality=90)
            report[view] = best[1]
    (d / "ai_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


VIEWS_TO_RUN = os.environ.get("TRYON_VIEWS", "front,back").split(",")


def main() -> None:
    client = Client(load_key())
    for arg in sys.argv[1:]:
        run(client, Path(arg))


if __name__ == "__main__":
    main()
