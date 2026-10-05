// Pre-processes dataset/ flat-lay shirt photos into ready-to-use print
// textures under public/prints/, so the browser can switch prints instantly
// instead of running the WASM background-removal model on every click.
//
//   node tools/garment-pipeline/build_prints.mjs
//
// Per folder: downscale -> flood-fill the studio background to transparent
// (seeded from the corners, edge-connected only, so interior white artwork is
// kept) -> trim to the garment -> write front.png / back.png + a manifest with
// the average garment colour for the bare-fabric tint.

import sharp from 'sharp';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'dataset');
const OUT = path.join(ROOT, 'public', 'prints');
const WIDTH = 640; // the shirt UV never resolves finer than this on screen
const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const TOL = 42; // per-channel distance from the corner colour that still counts as background

/**
 * Which garment mesh a dataset folder's photos belong on.
 *
 * The dataset mixes tees, shorts and long pants in one flat folder list (see
 * dataset/README.txt) with no separate field for it -- only the folder name
 * says which is which ("ascolour_5903_beach_shorts_..." vs
 * "ascolour_5932_relax_track_pants_..."). Without this, the manifest gave
 * every item the same shirt-only treatment: browsing the preset collection
 * put pants/shorts photos on the T-shirt mesh no matter what they showed.
 * "short" is checked before "pant"/"trouser" so a folder like
 * "board_shorts_pantone_blue" still lands on shorts.
 */
function garmentKindOf(folder) {
  const s = folder.toLowerCase();
  if (/skirt/.test(s)) return 'skirt';
  // Button-up shirts ("oxford_shirt", "work_ss_shirt"), but not "t_shirt".
  if (/(^|_)(?!t_)[a-z]*_?shirt/.test(s) && !/t_shirt|tee/.test(s)) return 'shirt';
  if (/short/.test(s)) return 'shorts';
  if (/pant|trouser|jean/.test(s)) return 'pants';
  return 'tshirt';
}

async function findSide(dir, side) {
  // A BiRefNet cutout from cutout.py wins over the raw photo.
  for (const ext of ['cut.png', ...EXTS]) {
    const p = path.join(dir, `${side}.${ext}`);
    try {
      await readFile(p);
      return p;
    } catch {
      /* next */
    }
  }
  return null;
}

/** BFS flood-fill from every border pixel, clearing alpha where the colour is
 *  within TOL of the seed (corner-average) background. */
function keyOutBackground(data, w, h, tol = TOL) {
  const seed = [0, 0, 0];
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  for (const [x, y] of corners) {
    const i = (y * w + x) * 4;
    seed[0] += data[i] / 4;
    seed[1] += data[i + 1] / 4;
    seed[2] += data[i + 2] / 4;
  }
  const near = (i) =>
    Math.abs(data[i] - seed[0]) <= tol &&
    Math.abs(data[i + 1] - seed[1]) <= tol &&
    Math.abs(data[i + 2] - seed[2]) <= tol;

  const seen = new Uint8Array(w * h);
  const queue = [];
  for (let x = 0; x < w; x++) {
    queue.push(x, x + (h - 1) * w);
  }
  for (let y = 0; y < h; y++) {
    queue.push(y * w, w - 1 + y * w);
  }
  let cleared = 0;
  while (queue.length) {
    const p = queue.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!near(i)) continue;
    data[i + 3] = 0;
    cleared++;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) queue.push(p - 1);
    if (x < w - 1) queue.push(p + 1);
    if (y > 0) queue.push(p - w);
    if (y < h - 1) queue.push(p + w);
  }
  return cleared / (w * h);
}

function fillInterior(data, original, w, h) {
  const rowLo = new Int32Array(h).fill(w);
  const rowHi = new Int32Array(h).fill(-1);
  const colLo = new Int32Array(w).fill(h);
  const colHi = new Int32Array(w).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 128) continue;
      rowLo[y] = Math.min(rowLo[y], x);
      rowHi[y] = Math.max(rowHi[y], x);
      colLo[x] = Math.min(colLo[x], y);
      colHi[x] = Math.max(colHi[x], y);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] >= 128) continue;
      if (x > rowLo[y] && x < rowHi[y] && y > colLo[x] && y < colHi[x]) {
        data[i] = original[i];
        data[i + 1] = original[i + 1];
        data[i + 2] = original[i + 2];
        data[i + 3] = 255;
      }
    }
  }
}

function averageOpaque(data, w, h) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (!n) return '#41599c';
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

async function processSide(srcPath, destPath) {
  const { data, info } = await sharp(srcPath)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // A sane key clears a chunk but not the whole frame. A white garment on a
  // light-grey studio floor sits inside the default tolerance, so the fill
  // leaks through the whole garment -- retry tighter before giving up. If
  // every tolerance goes wild (or does nothing), keep the photo opaque --
  // better a boxy print than an empty one. (The failed pass has already
  // cleared alpha in `data`, so each try works on a fresh copy.)
  const original = Buffer.from(data);
  // Already cut out by cutout.py (BiRefNet): its alpha is the mask. The
  // colour key below is only the fallback -- it eats white/cream fabric on a
  // light studio floor.
  let keyed = srcPath.endsWith('.cut.png');
  for (const tol of keyed ? [] : [TOL, 20, 10, 5]) {
    data.set(original);
    const frac = keyOutBackground(data, info.width, info.height, tol);
    if (frac > 0.04 && frac < 0.9) {
      keyed = true;
      // Even the tighter key leaks into a white garment through its own
      // shading and punches holes in it. Fill back every pixel that sits
      // inside the garment both across its row and down its column.
      if (tol !== TOL) fillInterior(data, original, info.width, info.height);
      break;
    }
  }
  if (!keyed) data.set(original);

  const baseColor = averageOpaque(data, info.width, info.height);

  let img = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  if (keyed) img = img.trim({ threshold: 10 });
  await img.webp({ quality: 80, alphaQuality: 90 }).toFile(destPath);

  return { baseColor, keyed };
}

async function main() {
  const folders = (await readdir(SRC, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const items = [];
  for (const folder of folders) {
    const dir = path.join(SRC, folder);
    const frontSrc = await findSide(dir, 'front');
    if (!frontSrc) continue;
    const backSrc = await findSide(dir, 'back');

    let source;
    try {
      source = JSON.parse(await readFile(path.join(dir, 'source.json'), 'utf8')).source;
    } catch {
      /* none */
    }

    const front = await processSide(frontSrc, path.join(OUT, `${folder}__front.webp`));
    let hasBack = false;
    if (backSrc) {
      await processSide(backSrc, path.join(OUT, `${folder}__back.webp`));
      hasBack = true;
    }

    const kind = garmentKindOf(folder);
    items.push({
      id: folder,
      name: folder.replace(/_/g, ' '),
      kind,
      front: `/prints/${folder}__front.webp`,
      back: hasBack ? `/prints/${folder}__back.webp` : null,
      baseColor: front.baseColor,
      source,
    });
    process.stdout.write(
      `  ${folder}  [${kind}]  ${front.keyed ? 'keyed' : 'as-is'}  ${front.baseColor}${hasBack ? '  +back' : ''}\n`,
    );
  }

  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ items }), 'utf8');
  console.log(`\n${items.length} prints -> public/prints/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
