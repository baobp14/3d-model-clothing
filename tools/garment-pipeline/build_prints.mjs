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

async function findSide(dir, side) {
  for (const ext of EXTS) {
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
function keyOutBackground(data, w, h) {
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
    Math.abs(data[i] - seed[0]) <= TOL &&
    Math.abs(data[i + 1] - seed[1]) <= TOL &&
    Math.abs(data[i + 2] - seed[2]) <= TOL;

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

  const frac = keyOutBackground(data, info.width, info.height);
  // A sane key clears a chunk but not the whole frame. If it went wild (or did
  // nothing), keep the photo opaque and just trim -- better a boxy print than
  // a hole-punched one.
  const keyed = frac > 0.04 && frac < 0.9;

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

    items.push({
      id: folder,
      name: folder.replace(/_/g, ' '),
      front: `/prints/${folder}__front.webp`,
      back: hasBack ? `/prints/${folder}__back.webp` : null,
      baseColor: front.baseColor,
      source,
    });
    process.stdout.write(
      `  ${folder}  ${front.keyed ? 'keyed' : 'as-is'}  ${front.baseColor}${hasBack ? '  +back' : ''}\n`,
    );
  }

  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ items }), 'utf8');
  console.log(`\n${items.length} prints -> public/prints/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
