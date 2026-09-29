"""Tai anh phu (nguoi mau mac, nghieng, can chat vai...) cho dataset/.

front.jpg / back.jpg (anh trai phang) giu nguyen -- do la anh dung de in len
mesh. Anh phu chia theo DUNG CHU cua no:

  dataset/<mau>/extra_XX.jpg        anh RIENG cua mau vai do (vd nguoi mau mac
                                    ao nau cho thu muc ...brown)
  dataset/_styles/<kieu>/extra_XX.jpg
                                    anh CHUNG cua ca kieu (shop chi chup mot
                                    mau roi dung cho moi mau) -- luu MOT lan,
                                    cac thu muc mau tro toi qua source.json
                                    ["style"]. Ban truoc chep bo anh nay vao
                                    tung thu muc mau, nen 55 mau co anh nguoi
                                    mau giong het nhau.

  python tools/garment-pipeline/fetch_extra_images.py

Phan loai:
  * AS Colour (BigCommerce): anh nguoi mau (MAIN/FRONT/BACK/SIDE/TURN/LOOSE...)
    la cua ca kieu -> _styles. Anh rieng tung mau chi co anh trai phang (da
    la front/back).
  * Shopify (Jump The Dark, Alyxen, Everlane): mot anh thuoc mau C neu no gan
    voi bien the mau C, hoac ten file / mo ta anh nhac toi C. Nhac toi mau
    khac -> bo. Khong nhac mau nao va trang co nhieu mau -> _styles. Trang
    chi co mot mau -> tat ca la cua mau do.
"""
import hashlib
import io
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "dataset"
STYLES = ROOT / "_styles"
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


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def save_small(data: bytes, dest: Path) -> None:
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    im.save(dest, "JPEG", quality=82, optimize=True)


def ascolour(src: dict) -> tuple[str, list[str], list[str]]:
    """-> (ma kieu, anh rieng mau, anh chung kieu)."""
    html = get(src["source"]).decode("utf-8", "ignore")
    urls = {base(u) for u in re.findall(
        r"https://cdn11\.bigcommerce\.com/[^\"' ]+/1500w/[^\"' ]+?\.jpg", html)}
    names = {}
    for u in urls:
        m = re.search(r"/(\d{4})S?_([A-Z0-9_]+?)__\d+", u)
        if m:
            names[m.group(2)] = u
    flats = {n for n in names if n + "_BACK" in names}
    flats |= {n + "_BACK" for n in flats}
    shared = [u for n, u in sorted(names.items())
              if n not in flats and not n.endswith("_THUMB")]
    code = re.search(r"(\d{4})", src["source"]).group(1)
    return f"ascolour_{code}", [], shared


def shopify(src: dict, folder: str) -> tuple[str, list[str], list[str]]:
    url = base(src["source"]).rstrip("/")
    prod = json.loads(get(url + ".json"))["product"]
    handle = prod["handle"]
    shop = re.sub(r"^www\.", "", url.split("/")[2]).split(".")[0]

    col_idx = next((k for k, o in enumerate(prod["options"])
                    if o["name"].lower() in ("color", "colour")), None)
    colours = [] if col_idx is None else [norm(v) for v in prod["options"][col_idx]["values"]]

    if len(colours) <= 1:
        return f"{shop}_{handle}", [base(i["src"]) for i in prod["images"]], []

    var_col = {v["id"]: norm(v[f"option{col_idx + 1}"] or "") for v in prod["variants"]}

    # Tu thuoc TEN SAN PHAM khong phai mau: "BLACKLETTER" chua "black".
    name_words = set(re.split(r"[^a-z0-9]+", (handle + " " + prod["title"]).lower()))
    # Mau nhieu chu ("Heather Grey"): so khop ca cum, hoac chu cuoi ("grey")
    # neu chu do chi thuoc mot mau.
    colour_words = {norm(v): v.lower().split() for v in prod["options"][col_idx]["values"]}
    last = {}
    for c, ws in colour_words.items():
        last.setdefault(ws[-1], []).append(c)

    def words(text: str) -> list[str]:
        # Tach ca chu dinh lien trong ten file: STEPTHROUGHBACK, BLACKLETTER.
        text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
        return [w for w in re.split(r"[^a-z0-9]+", text.lower()) if w and w not in name_words]

    def colours_in(ws: list[str]) -> list[str]:
        """Cac mau nhac trong day tu, theo thu tu xuat hien."""
        found = []
        for i in range(len(ws)):
            for c, cw in colour_words.items():
                if ws[i:i + len(cw)] == cw and c not in found:
                    found.append(c)
            if ws[i] in last and len(last[ws[i]]) == 1 and last[ws[i]][0] not in found:
                found.append(last[ws[i]][0])
        return found

    def colour_of(img: dict) -> str | None:
        # 1. Ten file do shop dat -- tin nhat.
        in_name = colours_in(words(Path(base(img["src"])).stem))
        if len(in_name) == 1:
            return in_name[0]
        # 2. Anh gan voi bien the mau nao.
        tagged = {var_col[v] for v in img["variant_ids"] if v in var_col}
        if len(tagged) == 1:
            return next(iter(tagged))
        # 3. Mo ta anh: mau nhac DAU TIEN la mau ao. ("black tee with white
        #    print" -> black; mau sau thuong la mau hinh in.)
        in_alt = colours_in(words(img.get("alt") or ""))
        return in_alt[0] if in_alt else None

    # Mau cua thu muc = mau cua chinh anh mat truoc no dang dung. Ten thu muc
    # khong dang tin: mau dau tien thuong khong co hau to mau nao.
    front = base(src.get("front", ""))
    mine = next((colour_of(i) for i in prod["images"] if base(i["src"]) == front), None)
    if mine is None:
        mine = next((c for c in colour_words if norm(folder).endswith(c)), None)

    own, shared = [], []
    for img in prod["images"]:
        c = colour_of(img)
        if c == mine:
            own.append(base(img["src"]))
        elif c is None:
            shared.append(base(img["src"]))
    return f"{shop}_{handle}", own, shared


def write_images(dest: Path, urls: list[str]) -> list[str]:
    for old in dest.glob("extra_*"):
        old.unlink()
    saved = []
    seen: set[str] = set()
    for u in urls:
        if len(saved) >= MAX_EXTRA:
            break
        try:
            data = get(u)
            # Shop dang cung mot anh o hai URL khac nhau.
            h = hashlib.md5(data).hexdigest()
            if h in seen:
                continue
            seen.add(h)
            save_small(data, dest / f"extra_{len(saved) + 1:02d}.jpg")
            saved.append(u)
        except Exception as e:  # noqa: BLE001
            print(f"  !! {dest.name} {u}: {e}")
    return saved


def main() -> None:
    folders = sorted(p for p in ROOT.iterdir()
                     if p.is_dir() and not p.name.startswith("_") and (p / "source.json").exists())
    if STYLES.exists():
        shutil.rmtree(STYLES)
    styles: dict[str, dict] = {}
    n_own = 0

    for d in folders:
        src = json.loads((d / "source.json").read_text(encoding="utf-8"))
        try:
            if "ascolour.com" in src["source"]:
                style, own, shared = ascolour(src)
            else:
                style, own, shared = shopify(src, d.name)
        except Exception as e:  # noqa: BLE001
            print(f"  !! {d.name}: {e}")
            continue
        flat = {base(src.get("front", "")), base(src.get("back", ""))}
        own = [u for u in own if u not in flat]
        shared = [u for u in shared if u not in flat]

        src["extra"] = write_images(d, own)
        n_own += len(src["extra"])
        if shared:
            src["style"] = style
            st = styles.setdefault(style, {"style": style, "source": base(src["source"]),
                                           "images": shared, "colours": []})
            st["colours"].append(d.name)
        else:
            src.pop("style", None)
        (d / "source.json").write_text(json.dumps(src, indent=2, ensure_ascii=False) + "\n",
                                       encoding="utf-8")
        print(f"{d.name}: {len(src['extra'])} rieng" + (f" + kieu {style}" if shared else ""))
        sys.stdout.flush()

    n_shared = 0
    for style, st in styles.items():
        dest = STYLES / style
        dest.mkdir(parents=True, exist_ok=True)
        st["images"] = write_images(dest, st["images"])
        n_shared += len(st["images"])
        (dest / "style.json").write_text(json.dumps(st, indent=2, ensure_ascii=False) + "\n",
                                         encoding="utf-8")
    print(f"{len(folders)} mau: {n_own} anh rieng theo mau, "
          f"{n_shared} anh chung cua {len(styles)} kieu (luu 1 lan)")


if __name__ == "__main__":
    main()
