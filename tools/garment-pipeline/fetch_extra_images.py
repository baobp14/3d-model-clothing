"""Tai them anh phu (nguoi mau mac, nghieng, can chat vai...) cho moi mau trong dataset/.

front.jpg / back.jpg (anh trai phang) giu nguyen -- do la anh dung de in len
mesh. Anh phu luu thanh extra_01.jpg, extra_02.jpg... va ghi URL vao
source.json["extra"], de lam gallery san pham ben TMDT.

  python tools/garment-pipeline/fetch_extra_images.py

Nguon:
  * Shopify (jumpthedark, alyxen, everlane): <trang san pham>.json -> images.
  * AS Colour (BigCommerce): quet anh 1500w tren trang; bo anh trai phang cua
    MAU KHAC va anh thumbnail, giu anh chung cua kieu (MAIN/FRONT/SIDE/TURN...).
"""
import io, json, re, sys, urllib.request

from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "dataset"
MAX_EXTRA = 6
MAX_SIDE = 1000  # px -- du cho gallery san pham, anh goc 2000px+ ton o dia
UA = {"User-Agent": "Mozilla/5.0"}
_cache: dict[str, bytes] = {}


def get(url: str) -> bytes:
    if url not in _cache:
        req = urllib.request.Request(url, headers=UA)
        _cache[url] = urllib.request.urlopen(req, timeout=60).read()
    return _cache[url]


def base(u: str) -> str:
    return u.split("?")[0]


def shopify_extras(src: dict) -> list[str]:
    data = json.loads(get(base(src["source"]).rstrip("/") + ".json"))["product"]
    skip = {base(src.get("front", "")), base(src.get("back", ""))}
    return [base(i["src"]) for i in data["images"] if base(i["src"]) not in skip]


def ascolour_extras(src: dict) -> list[str]:
    html = get(src["source"]).decode("utf-8", "ignore")
    urls = {base(u) for u in re.findall(
        r"https://cdn11\.bigcommerce\.com/[^\"' ]+/1500w/[^\"' ]+?\.jpg", html)}
    names = {}
    for u in urls:
        m = re.search(r"/\d{4}S?_([A-Z0-9_]+?)__\d+", u)
        if m:
            names[m.group(1)] = u
    # Anh trai phang theo mau: co cap "<X>" + "<X>_BACK".
    colour_flats = {n for n in names if n + "_BACK" in names}
    colour_flats |= {n + "_BACK" for n in colour_flats}
    out = []
    for n, u in sorted(names.items()):
        if n in colour_flats or n.endswith("_THUMB"):
            continue
        out.append(u)
    return out


def save_small(data: bytes, dest: Path) -> None:
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    im.save(dest, "JPEG", quality=82, optimize=True)


def complete(d: Path, src: dict) -> bool:
    """Da tai du (va doc duoc) het anh phu ghi trong source.json chua."""
    want = src.get("extra")
    if not want:
        return False
    for k in range(1, len(want) + 1):
        f = d / f"extra_{k:02d}.jpg"
        try:
            Image.open(f).verify()
        except Exception:  # noqa: BLE001
            return False
    return True


def main() -> None:
    folders = sorted(p for p in ROOT.iterdir() if (p / "source.json").exists())
    total = 0
    for d in folders:
        src = json.loads((d / "source.json").read_text(encoding="utf-8"))
        if complete(d, src):
            total += len(src["extra"])
            continue
        try:
            if "ascolour.com" in src["source"]:
                extras = ascolour_extras(src)
            else:
                extras = shopify_extras(src)
        except Exception as e:  # noqa: BLE001
            print(f"  !! {d.name}: {e}")
            continue
        extras = [u for u in extras if u not in (base(src.get("front", "")), base(src.get("back", "")))]
        extras = extras[:MAX_EXTRA]
        for old in d.glob("extra_*"):
            old.unlink()
        saved = []
        for k, u in enumerate(extras, 1):
            try:
                save_small(get(u), d / f"extra_{len(saved) + 1:02d}.jpg")
                saved.append(u)
            except Exception as e:  # noqa: BLE001
                print(f"  !! {d.name} {u}: {e}")
        src["extra"] = saved
        (d / "source.json").write_text(json.dumps(src, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        total += len(saved)
        print(f"{d.name}: +{len(saved)}")
        sys.stdout.flush()
    print(f"{total} anh phu cho {len(folders)} mau")


if __name__ == "__main__":
    main()
