#!/usr/bin/env python3
"""Fetch CC0 MakeHuman assets needed by build_avatar_glb.py.

Downloads base mesh, measurement targets, and macrodetail (ethnicity/weight/
height) targets from the public MakeHuman GitHub mirror. Only standard-library
modules are used (urllib, pathlib, json) -- no third-party dependencies.

License: everything fetched here is CC0 1.0 Universal (see
data/../LICENSE.ASSETS.md, also downloaded). Only data assets are fetched,
never MakeHuman *application* code (which is AGPL).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

RAW = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman"
DEST = Path(__file__).parent / "mh-data"

GENDERS = ("male", "female")
ETHNICITIES = ("african", "asian", "caucasian")

MEASURE_AXES = [
    ("bust", "circ"),
    ("waist", "circ"),
    ("hips", "circ"),
    ("shoulder", "dist"),
    ("upperarm", "length"),
    ("lowerarm", "length"),
    ("upperleg", "height"),
    ("lowerleg", "height"),
    ("neck", "circ"),
]


def measure_target_paths() -> list[str]:
    paths = []
    for name, kind in MEASURE_AXES:
        for direction in ("decr", "incr"):
            paths.append(f"data/targets/measure/measure-{name}-{kind}-{direction}.target")
    return paths


def macrodetail_paths() -> list[str]:
    paths = []
    for gender in GENDERS:
        for ethnicity in ETHNICITIES:
            paths.append(f"data/targets/macrodetails/{ethnicity}-{gender}-young.target")
        for weight in ("minweight", "averageweight", "maxweight"):
            paths.append(
                f"data/targets/macrodetails/universal-{gender}-young-averagemuscle-{weight}.target"
            )
        for height in ("minheight", "maxheight"):
            paths.append(
                f"data/targets/macrodetails/height/{gender}-young-averagemuscle-averageweight-{height}.target"
            )
    return paths


def all_remote_paths() -> list[str]:
    return (
        ["data/3dobjs/base.obj"]
        + measure_target_paths()
        + macrodetail_paths()
        + ["data/modifiers/measurement_modifiers.json", "../LICENSE.ASSETS.md"]
    )


def fetch(remote_path: str) -> bytes:
    url = f"{RAW}/{remote_path}"
    req = urllib.request.Request(url, headers={"User-Agent": "avatar-pipeline-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    paths = all_remote_paths()
    manifest = {"source": RAW, "license": "CC0-1.0", "files": [], "totalBytes": 0}

    print(f"Fetching {len(paths)} files from MakeHuman (CC0)...")
    for i, remote_path in enumerate(paths, 1):
        # "../LICENSE.ASSETS.md" lives one directory above `makehuman/`.
        if remote_path.startswith("../"):
            local_rel = "LICENSE.ASSETS.md"
        else:
            local_rel = remote_path
        local_path = DEST / local_rel
        local_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            data = fetch(remote_path)
        except urllib.error.HTTPError as exc:
            raise SystemExit(f"FAILED [{i}/{len(paths)}] {remote_path}: HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise SystemExit(f"FAILED [{i}/{len(paths)}] {remote_path}: {exc.reason}") from exc

        local_path.write_bytes(data)
        manifest["files"].append({"path": local_rel, "bytes": len(data)})
        manifest["totalBytes"] += len(data)
        print(f"  [{i}/{len(paths)}] {local_rel} ({len(data)} B)")

    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    total_mb = manifest["totalBytes"] / 1_000_000
    print(f"Done: {len(manifest['files'])} files, {total_mb:.2f} MB -> {DEST}")


if __name__ == "__main__":
    main()
