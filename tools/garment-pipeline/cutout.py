"""Tach nen anh trai phang bang AI (rembg), chay tren may, mien phi.

Ghi dataset/<mau>/front.cut.png, back.cut.png (PNG co alpha). build_prints.mjs
uu tien cac file nay; chi khi thieu moi quay ve cach cu (so mau voi goc anh),
cach cu an lem vai trang/kem tren nen sang.

  vai toi : u2net tren GPU (DirectML, ~0.1s/anh)
  vai sang: BiRefNet-lite tren CPU -- u2net an lem tay ao trang tren nen
            trang; BiRefNet ban day du can >4GB VRAM va ~7GB RAM.

Gioi han RAM: Windows chan ca tien trinh o MAX_RAM_GB (Job Object), doc tung
anh mot, tat bo dem bo nho cua onnxruntime.

  pip install rembg onnxruntime-directml
  python tools/garment-pipeline/cutout.py           # chi lam anh chua co .cut.png
  python tools/garment-pipeline/cutout.py --force   # lam lai het
  set CUTOUT_MAX_RAM_GB=4                           # doi tran RAM (mac dinh 4)
"""
import ctypes
import os
import sys
from ctypes import wintypes
from pathlib import Path

import numpy as np
from scipy import ndimage
import onnxruntime as ort
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[2] / "dataset"
MAX_SIDE = 1024  # build_prints thu ve 1024px ngang, lon hon chi ton thoi gian
MAX_RAM_GB = float(os.environ.get("CUTOUT_MAX_RAM_GB", "4"))
LIGHT_MODEL = "birefnet-general-lite"


def cap_memory(gb: float) -> None:
    """Windows: dat tran bo nho cho chinh tien trinh nay -- vuot thi bao loi
    thay vi lam tran RAM ca may."""
    if os.name != "nt":
        return

    class IO_COUNTERS(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in (
            "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
            "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]

    class BASIC(ctypes.Structure):
        _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
                    ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                    ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD),
                    ("SchedulingClass", wintypes.DWORD)]

    class EXTENDED(ctypes.Structure):
        _fields_ = [("BasicLimitInformation", BASIC), ("IoInfo", IO_COUNTERS),
                    ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                    ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.CreateJobObjectW.restype = wintypes.HANDLE
    k32.GetCurrentProcess.restype = wintypes.HANDLE
    k32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    k32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    job = k32.CreateJobObjectW(None, None)
    info = EXTENDED()
    info.BasicLimitInformation.LimitFlags = 0x100  # JOB_OBJECT_LIMIT_PROCESS_MEMORY
    info.ProcessMemoryLimit = int(gb * 1024 ** 3)
    ok = k32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)) and \
        k32.AssignProcessToJobObject(job, k32.GetCurrentProcess())
    print(f"gioi han RAM {gb:g}GB:", "ok" if ok else f"khong dat duoc (loi {ctypes.get_last_error()})", flush=True)


def is_light(im: Image.Image) -> bool:
    """Vai sang (trang/kem/be) giua anh -- loai u2net hay an lem vao nen sang."""
    w, h = im.size
    mid = np.asarray(im.crop((w * 3 // 8, h * 3 // 8, w * 5 // 8, h * 5 // 8)).convert("L"))
    return float(np.median(mid)) > 170


def fix_symmetry(cut: Image.Image, photo: Image.Image, name: str) -> Image.Image:
    """Anh trai phang gan nhu doi xung trai-phai. Ao trang tren nen trang hay bi
    mat han mot tay ao: neu mat na lech nhieu so voi ban lat ngang cua no thi
    hop hai ban lai (mau lay tu anh goc). Ao co dang lech that (it gap) se
    khong vuot nguong."""
    a = np.asarray(cut.getchannel("A")) > 128
    # Manh roi (vd mot nua tay ao trang tach khoi than) lam mat na trong "can"
    # du thieu tay -> chi giu manh lon nhat roi moi xet doi xung.
    lab, n = ndimage.label(a)
    if n > 1:
        a = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    ys, xs = np.nonzero(a)
    if len(xs) == 0:
        return cut
    x0, x1 = xs.min(), xs.max()
    # Truc doi xung = giua cua than ao (theo hang giua), khong phai giua bbox
    # -- bbox da lech vi chinh cai tay bi mat.
    mid_rows = a[(ys.min() + ys.max()) // 2 - 5:(ys.min() + ys.max()) // 2 + 5]
    cols = np.nonzero(mid_rows.any(axis=0))[0]
    cx = (cols.min() + cols.max()) / 2 if len(cols) else (x0 + x1) / 2
    flip = np.zeros_like(a)
    src_x = np.round(2 * cx - np.arange(a.shape[1])).astype(int)
    ok = (src_x >= 0) & (src_x < a.shape[1])
    flip[:, ok] = a[:, src_x[ok]]
    iou = (a & flip).sum() / max((a | flip).sum(), 1)
    if iou > 0.9:
        if n > 1:  # van bo cac manh roi
            out = cut.copy()
            out.putalpha(Image.fromarray(np.where(a, np.asarray(cut.getchannel("A")), 0).astype(np.uint8)))
            return out
        return cut
    print(f"  {name}: mat na lech (IoU {iou:.2f}), bu bang doi xung", flush=True)
    out = photo.convert("RGBA")
    out.putalpha(Image.fromarray(((a | flip) * 255).astype(np.uint8)))
    return out


def load(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    return im


def main() -> None:
    cap_memory(MAX_RAM_GB)
    force = "--force" in sys.argv
    sessions = {}

    def session(name: str):
        if name not in sessions:
            opts = ort.SessionOptions()
            opts.enable_cpu_mem_arena = False  # tra RAM lai sau moi anh
            opts.enable_mem_pattern = False
            if name == "u2net":
                sessions[name] = new_session(name, sess_opts=opts,
                                             providers=["DmlExecutionProvider", "CPUExecutionProvider"])
            else:
                # Nua so nhan de may van dung duoc trong luc chay.
                opts.intra_op_num_threads = max(1, (os.cpu_count() or 4) // 2)
                sessions[name] = new_session(name, sess_opts=opts, providers=["CPUExecutionProvider"])
        return sessions[name]

    # Chi luu duong dan; anh doc lai luc xu ly de khong giu ca tram anh trong RAM.
    jobs = []
    for d in sorted(ROOT.iterdir()):
        if d.name.startswith("_") or not d.is_dir():
            continue
        for side in ("front", "back"):
            src = next((p for p in d.glob(f"{side}.*") if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
                        and not p.name.endswith(".cut.png") and ".tmp." not in p.name), None)
            dest = d / f"{side}.cut.png"
            if not src or (dest.exists() and not force):
                continue
            jobs.append((LIGHT_MODEL if is_light(load(src)) else "u2net", src, dest))
    # Anh toi (GPU, nhanh) truoc, anh sang (CPU, cham) sau.
    jobs.sort(key=lambda j: j[0] != "u2net")

    n = 0
    for model, src, dest in jobs:
        try:
            out = remove(load(src), session=session(model), post_process_mask=model == "u2net")
        except Exception as e:  # noqa: BLE001 -- vuot tran RAM (onnxruntime bao "bad allocation") -> mo hinh nhe
            print("  het RAM, dung u2net:", dest.parent.name, str(e)[:60], flush=True)
            sessions.pop(model, None)
            out = remove(load(src), session=session("u2net"), post_process_mask=True)
        if not any(k in src.parent.name for k in ("pant", "short", "skirt")):
            out = fix_symmetry(out, load(src), f"{src.parent.name}/{dest.stem}")
        tmp = dest.with_name(dest.stem + ".tmp.png")
        out.save(tmp, optimize=True)
        tmp.replace(dest)  # ghi xong moi doi ten: bi dung giua chung khong de lai file hong
        n += 1
        print(f"[{n}/{len(jobs)}]", dest.parent.name, dest.stem, model, flush=True)
    print(n, "anh da tach nen")


if __name__ == "__main__":
    main()
