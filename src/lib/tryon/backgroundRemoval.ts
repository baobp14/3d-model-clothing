'use client';

import * as THREE from 'three';

/**
 * @imgly/background-removal decodes the input itself, and its own decoder
 * only whitelists a handful of mime types (png/jpeg/webp/...) -- it rejects
 * anything else (e.g. AVIF, which is now a common default export format from
 * phones and screenshot tools) with "Invalid format: image/avif", even
 * though the browser itself can decode it fine. So we always re-encode the
 * upload to PNG ourselves first, via the browser's own (much more permissive)
 * image decoder, and hand the library a format it's guaranteed to accept.
 */
async function normalizeToPng(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode image as PNG'));
    }, 'image/png');
  });
}

export interface RemoveBackgroundOptions {
  /**
   * Called as the model downloads and runs. `phase` is a short label
   * ("Tải model" / "Xử lý") and `fraction` is 0..1 within that phase -- it
   * resets when the phase changes, it is not one overall bar.
   */
  onProgress?: (phase: string, fraction: number) => void;
}

/**
 * Wraps @imgly/background-removal: runs entirely client-side via WASM/ONNX in
 * the browser -- no GPU, no server, no paid API.
 *
 * Scope, deliberately narrow: this only separates a SUBJECT from its
 * background. It has no notion of "shirt" vs "skin"/"hair", so it only gives
 * a clean cutout for a flat product / ghost-mannequin photo (just the
 * garment, plain background) -- NOT a photo of a model wearing the item. An
 * earlier attempt at person-aware "clothes only" segmentation (MediaPipe's
 * multiclass selfie segmenter) was pulled back out: it needed a body-
 * proportion heuristic to guess where a top's hem ends before pants/shorts
 * begin, which was too unreliable in practice. Upload flat product photos
 * only -- see GarmentUploadPanel's on-screen note.
 */
export async function removeGarmentBackground(
  file: File | Blob,
  opts: RemoveBackgroundOptions = {},
): Promise<Blob> {
  const png = await normalizeToPng(file);
  const { removeBackground } = await import('@imgly/background-removal');
  return removeBackground(png, {
    output: { format: 'image/png', quality: 0.95 },
    progress: opts.onProgress
      ? (key, current, total) => {
          // keys are "fetch:/…onnx" while the model downloads, "compute:…"
          // once it runs; collapse them to two user-facing phases.
          const phase = key.startsWith('fetch') ? 'Tải model' : 'Xử lý';
          opts.onProgress!(phase, total > 0 ? current / total : 0);
        }
      : undefined,
  });
}

/**
 * Crops a cutout down to its opaque content.
 *
 * The garment UV runs 0..1 across the whole shirt silhouette, so whatever the
 * texture's own frame is becomes the shirt: a product photo where the garment
 * fills 60% of the frame ends up as a 60%-size print floating in the middle of
 * the shirt with base fabric all round it. Trimming the transparent margin
 * makes the cutout's edges line up with the silhouette's edges.
 *
 * `pad` keeps a sliver of margin (fraction of the content box) so a hard-edged
 * print does not sit exactly on the hem/armhole seam.
 */
export async function trimToContent(
  blob: Blob,
  { alphaThreshold = 12, pad = 0.015 } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= alphaThreshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return blob; // nothing opaque -- leave it alone

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const px = Math.round(bw * pad);
  const py = Math.round(bh * pad);
  const cx = Math.max(0, minX - px);
  const cy = Math.max(0, minY - py);
  const cw = Math.min(w, maxX + px + 1) - cx;
  const ch = Math.min(h, maxY + py + 1) - cy;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('trim: toBlob failed'))), 'image/png');
  });
}

/**
 * Average colour of the opaque pixels in a cutout, as a `#rrggbb` string.
 *
 * The garment UV is a flat projection of a T-pose shirt; a product photo shot
 * flat has narrower, angled sleeves, so the outer-upper part of each mesh
 * sleeve maps to transparent pixels of the photo and shows bare fabric -- a
 * band of the wrong colour at the shoulders. Tinting the base fabric to the
 * shirt's own average colour makes that band read as matching fabric instead
 * of a seam, without a full UV unwrap.
 */
export async function averageOpaqueColor(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  // Downscale hard -- an average does not need the megapixels.
  const s = Math.min(1, 128 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s));
  const h = Math.max(1, Math.round(bitmap.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#41599c';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (!n) return '#41599c';
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export async function blobToTexture(blob: Blob): Promise<THREE.Texture> {
  // Flip on decode, not on the texture.
  //
  // three.js can flip a <canvas> source at upload time (flipY = true, the
  // default), which is why CanvasTexture prints come out upright. It CANNOT
  // flip an ImageBitmap the same way -- it warns and uploads it unflipped --
  // so an untouched ImageBitmap texture lands upside down relative to a
  // CanvasTexture, and the garment UV (v = 0 at the hem) then shows the photo
  // inverted. Flipping rows during createImageBitmap and clearing flipY makes
  // an uploaded photo orient exactly like the built-in sample prints.
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
