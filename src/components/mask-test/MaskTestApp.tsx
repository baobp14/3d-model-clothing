'use client';

// Bench for the garment background remover.
//
// The 3D try-on prints a front photo and a back photo onto the shirt, and each
// one is run through removeGarmentBackground first. Whether the print looks
// right on the shirt comes down almost entirely to whether that cutout is
// clean: a fringe of leftover background becomes a grey halo around the print,
// a hole punched through a pale logo becomes a see-through patch, a stray speck
// of kept background becomes a floating smudge. This page runs the exact same
// function the try-on uses and shows the alpha channel three ways so those
// three failure modes are each visible on their own.

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  removeGarmentBackground,
  type RemoveBackgroundOptions,
} from '@/lib/tryon/backgroundRemoval';

const Tryon3DPreview = dynamic(() => import('./Tryon3DPreview'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-stone-400">
      Đang tải WebGL…
    </div>
  ),
});

type Mode = 'inspect' | 'wear';

type View = 'cutout' | 'matte' | 'edge';

const VIEW_LABELS: Record<View, string> = {
  cutout: 'Ảnh đã tách (nền ô caro)',
  matte: 'Kênh alpha (trắng = giữ)',
  edge: 'Viền cắt chồng lên ảnh gốc',
};

/** Pixel work is capped to this on the long edge; display uses full res. */
const WORK_MAX = 1400;

/** alpha at or above this counts as kept, at or below 255-this as removed. */
const SOLID = 248;
const CLEAR = 8;

interface Metrics {
  width: number;
  height: number;
  keptPct: number;
  fringePct: number;
  islandCount: number;
  strayIslandPct: number;
  holeCount: number;
  holePct: number;
}

function Button({
  active, onClick, children, disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'rounded border px-2.5 py-1 text-xs transition disabled:opacity-40 '
        + (active
          ? 'border-stone-900 bg-stone-900 text-white'
          : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-100')
      }
    >
      {children}
    </button>
  );
}

/** Draws a plausible flat product photo so the page works with no upload. */
function makeSamplePhoto(): Promise<File> {
  const w = 900;
  const h = 1120;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;

  // A studio backdrop is never a flat colour: sweep plus a soft vignette plus
  // fine noise, so the remover has something real to separate against.
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#eef0f2');
  bg.addColorStop(1, '#d9dcdf');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  const noise = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < noise.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    noise.data[i] += n;
    noise.data[i + 1] += n;
    noise.data[i + 2] += n;
  }
  ctx.putImageData(noise, 0, 0);

  // T-shirt silhouette.
  const cx = w / 2;
  ctx.save();
  ctx.translate(0, 40);
  ctx.beginPath();
  ctx.moveTo(cx - 150, 120);
  ctx.lineTo(cx - 250, 210);       // shoulder to sleeve
  ctx.lineTo(cx - 300, 330);
  ctx.lineTo(cx - 210, 380);       // sleeve hem
  ctx.lineTo(cx - 150, 300);
  ctx.lineTo(cx - 165, 900);       // side seam to hem
  ctx.lineTo(cx + 165, 900);
  ctx.lineTo(cx + 150, 300);
  ctx.lineTo(cx + 210, 380);
  ctx.lineTo(cx + 300, 330);
  ctx.lineTo(cx + 250, 210);
  ctx.lineTo(cx + 150, 120);
  ctx.quadraticCurveTo(cx, 180, cx - 150, 120); // neck scoop
  ctx.closePath();

  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 12;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#2f3d63';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // A pale chest print: the classic thing a remover eats a hole through.
  ctx.fillStyle = '#e7e9ef';
  ctx.fillRect(cx - 90, 430, 180, 130);
  ctx.fillStyle = '#2f3d63';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DATN', cx, 512);
  ctx.restore();

  return new Promise((resolve) => {
    cv.toBlob((b) => {
      resolve(new File([b!], 'anh-mau.png', { type: 'image/png' }));
    }, 'image/png');
  });
}

/** Flood-fills connected components of `mask` (4-connectivity), returns labels. */
function components(mask: Uint8Array, w: number, h: number, want: 0 | 1) {
  const label = new Int32Array(w * h).fill(-1);
  const areas: number[] = [];
  const touchesBorder: boolean[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== want || label[start] !== -1) continue;
    const id = areas.length;
    let area = 0;
    let border = false;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q >= 0 && mask[q] === want && label[q] === -1) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    areas.push(area);
    touchesBorder.push(border);
  }
  return { areas, touchesBorder };
}

interface Analysis {
  metrics: Metrics;
  matteUrl: string;
  edgeUrl: string;
}

/** Reads the cutout's alpha channel and turns it into numbers plus two views. */
async function analyze(cutout: Blob, original: Blob): Promise<Analysis> {
  const cutBmp = await createImageBitmap(cutout);
  const fullW = cutBmp.width;
  const fullH = cutBmp.height;
  const scale = Math.min(1, WORK_MAX / Math.max(fullW, fullH));
  const w = Math.max(1, Math.round(fullW * scale));
  const h = Math.max(1, Math.round(fullH * scale));

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(cutBmp, 0, 0, w, h);
  cutBmp.close();
  const { data } = ctx.getImageData(0, 0, w, h);

  const kept = new Uint8Array(w * h);
  let solid = 0;
  let fringe = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    if (a >= SOLID) { solid++; kept[p] = 1; }
    else if (a > CLEAR) { fringe++; kept[p] = 1; }
  }
  const total = w * h;

  const keptComp = components(kept, w, h, 1);
  const keptOrder = keptComp.areas
    .map((area, id) => ({ area, id }))
    .sort((a, b) => b.area - a.area);
  const strayArea = keptOrder.slice(1).reduce((s, c) => s + c.area, 0);

  // A hole is a removed-region component that touches no image border: the
  // remover punched it out of the middle of the garment.
  const removed = new Uint8Array(w * h);
  for (let p = 0; p < kept.length; p++) removed[p] = kept[p] ? 0 : 1;
  const remComp = components(removed, w, h, 1);
  let holeCount = 0;
  let holeArea = 0;
  for (let id = 0; id < remComp.areas.length; id++) {
    if (remComp.touchesBorder[id]) continue;
    holeCount++;
    holeArea += remComp.areas[id];
  }

  // Matte: alpha as greyscale, opaque.
  const matte = ctx.createImageData(w, h);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    matte.data[i] = a;
    matte.data[i + 1] = a;
    matte.data[i + 2] = a;
    matte.data[i + 3] = 255;
  }
  ctx.putImageData(matte, 0, 0);
  const matteUrl = cv.toDataURL('image/png');

  // Edge: the original with the cutout boundary drawn over it in magenta.
  const origBmp = await createImageBitmap(original);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(origBmp, 0, 0, w, h);
  origBmp.close();
  const over = ctx.getImageData(0, 0, w, h);
  for (let p = 0; p < kept.length; p++) {
    if (!kept[p]) continue;
    const x = p % w;
    const y = (p / w) | 0;
    const edge =
      (x > 0 && !kept[p - 1]) ||
      (x < w - 1 && !kept[p + 1]) ||
      (y > 0 && !kept[p - w]) ||
      (y < h - 1 && !kept[p + w]);
    if (!edge) continue;
    const i = p * 4;
    over.data[i] = 236;
    over.data[i + 1] = 0;
    over.data[i + 2] = 140;
    over.data[i + 3] = 255;
  }
  ctx.putImageData(over, 0, 0);
  const edgeUrl = cv.toDataURL('image/png');

  return {
    metrics: {
      width: fullW,
      height: fullH,
      keptPct: (100 * (solid + fringe)) / total,
      fringePct: (100 * fringe) / total,
      islandCount: keptComp.areas.length,
      strayIslandPct: (100 * strayArea) / total,
      holeCount,
      holePct: (100 * holeArea) / total,
    },
    matteUrl,
    edgeUrl,
  };
}

export default function MaskTestApp() {
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [cutUrl, setCutUrl] = useState<string | null>(null);
  const [cutBlob, setCutBlob] = useState<Blob | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<{ phase: string; fraction: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('inspect');
  const [view, setView] = useState<View>('cutout');
  const [zoom, setZoom] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);

  // Object URLs have to be revoked by hand or they leak for the tab's life.
  const urls = useRef<string[]>([]);
  const track = (u: string) => { urls.current.push(u); return u; };
  useEffect(() => () => { urls.current.forEach(URL.revokeObjectURL); }, []);

  const run = useCallback(async (file: File | Blob) => {
    setStatus('working');
    setErrorMsg(null);
    setAnalysis(null);
    setCutUrl(null);
    setCutBlob(null);
    setProgress({ phase: 'Chuẩn bị', fraction: 0 });
    const src = track(URL.createObjectURL(file));
    setSrcUrl(src);
    try {
      const opts: RemoveBackgroundOptions = {
        onProgress: (phase, fraction) => setProgress({ phase, fraction }),
      };
      const cutout = await removeGarmentBackground(file, opts);
      setCutBlob(cutout);
      setCutUrl(track(URL.createObjectURL(cutout)));
      setProgress({ phase: 'Phân tích', fraction: 0 });
      setAnalysis(await analyze(cutout, file));
      setStatus('done');
    } catch (err) {
      console.error('[mask-test]', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    } finally {
      setProgress(null);
    }
  }, []);

  const m = analysis?.metrics;

  const verdicts = useMemo(() => {
    if (!m) return [];
    return [
      {
        ok: m.fringePct < 1.5,
        label: 'Mép cắt gọn',
        detail: `${m.fringePct.toFixed(2)}% pixel nửa trong suốt (viền mờ / răng cưa)`,
      },
      {
        ok: m.strayIslandPct < 0.2,
        label: 'Không sót mảng nền',
        detail: `${m.islandCount} mảng rời, mảng thừa chiếm ${m.strayIslandPct.toFixed(3)}%`,
      },
      {
        ok: m.holePct < 0.3,
        label: 'Không thủng giữa áo',
        detail: `${m.holeCount} lỗ, tổng ${m.holePct.toFixed(3)}% diện tích`,
      },
      {
        ok: m.keptPct > 8 && m.keptPct < 80,
        label: 'Giữ đúng phần áo',
        detail: `giữ lại ${m.keptPct.toFixed(1)}% khung hình`,
      },
    ];
  }, [m]);

  const activeUrl =
    view === 'cutout' ? cutUrl : view === 'matte' ? analysis?.matteUrl : analysis?.edgeUrl;

  return (
    <div className="flex h-full flex-col bg-stone-50 text-stone-800">
      <header className="border-b border-stone-200 bg-white px-4 py-2.5">
        <h1 className="text-sm font-semibold">Tách nền ảnh áo — kiểm tra</h1>
        <p className="text-xs text-stone-500">
          Chạy đúng hàm <code>removeGarmentBackground</code> mà phần mặc thử dùng, rồi soi kênh
          alpha ba kiểu: nền ô caro để thấy chỗ trong suốt, ảnh alpha để thấy viền mờ và lỗ
          thủng, viền cắt chồng lên ảnh gốc để xem đường cắt có bám mép áo không.
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-r border-stone-200 bg-white p-4">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Ảnh</h2>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              disabled={status === 'working'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) run(f);
              }}
              className="w-full text-xs text-stone-600 file:mr-2 file:rounded file:border-0 file:bg-stone-900 file:px-2 file:py-1 file:text-xs file:text-white disabled:opacity-40"
            />
            <Button
              disabled={status === 'working'}
              onClick={async () => run(await makeSamplePhoto())}
            >
              Dùng ảnh mẫu
            </Button>
            <p className="text-[11px] leading-relaxed text-amber-600">
              Chỉ ảnh sản phẩm chụp thẳng / ma-nơ-canh (nền đơn giản). Ảnh người mặc sẽ bị giữ
              nguyên cả người.
            </p>
          </section>

          {status === 'working' && (
            <section className="space-y-1 text-xs text-stone-500">
              <div>{progress?.phase ?? 'Đang chạy'}…</div>
              {progress && (
                <div className="h-1 w-full overflow-hidden rounded bg-stone-200">
                  <div
                    className="h-full bg-stone-800 transition-all"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
              )}
              <p className="text-[11px] text-stone-400">
                Lần đầu phải tải ~40&nbsp;MB model, hơi lâu.
              </p>
            </section>
          )}

          {status === 'error' && (
            <p className="text-xs text-red-600">Lỗi: {errorMsg}</p>
          )}

          {(m || cutBlob) && (
            <>
              <section>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Chế độ
                </h2>
                <div className="space-y-1.5">
                  <Button active={mode === 'inspect'} onClick={() => setMode('inspect')}>
                    Soi mép cắt (2D)
                  </Button>
                  <Button active={mode === 'wear'} onClick={() => setMode('wear')}>
                    Dán lên áo · model mặc (3D)
                  </Button>
                </div>
              </section>

              {mode === 'inspect' && m && (
                <>
                  <section>
                    <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Kiểu xem
                    </h2>
                    <div className="space-y-1.5">
                      {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
                        <Button key={v} active={view === v} onClick={() => setView(v)}>
                          {VIEW_LABELS[v]}
                        </Button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Phóng to · {zoom.toFixed(1)}×
                    </h2>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={0.5}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full"
                    />
                  </section>
                </>
              )}

              {mode === 'wear' && (
                <section className="text-[11px] leading-relaxed text-stone-500">
                  Ảnh đã tách được dán vào mặt trước của áo size M trên người mẫu F2. Cổ áo
                  không nhận ảnh in nên không bị viền đôi. Đổi size / người mẫu ở trang{' '}
                  <a href="/garment-test" className="underline">
                    Mặc thử áo
                  </a>
                  .
                </section>
              )}

              {m && (
                <>
                  <section className="space-y-1.5 border-t border-stone-200 pt-3">
                    {verdicts.map((v) => (
                      <div key={v.label} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={v.ok ? 'text-emerald-600' : 'text-red-600'}>
                            {v.ok ? '✓' : '✗'}
                          </span>
                          <span className="font-medium">{v.label}</span>
                        </div>
                        <div className="pl-4 text-[11px] text-stone-500">{v.detail}</div>
                      </div>
                    ))}
                  </section>

                  <section className="border-t border-stone-200 pt-3 text-[11px] text-stone-500">
                    Ảnh gốc {m.width}×{m.height}px. Phân tích ở tối đa {WORK_MAX}px cạnh dài.
                  </section>
                </>
              )}
            </>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          {mode === 'wear' && (
            <div className="h-full">
              <Tryon3DPreview cutout={cutBlob} />
            </div>
          )}

          {mode === 'inspect' && (
          <div className="h-full overflow-auto p-4">
          {!activeUrl && status !== 'working' && (
            <div className="flex h-full items-center justify-center text-sm text-stone-400">
              Chọn ảnh áo hoặc bấm “Dùng ảnh mẫu”.
            </div>
          )}

          {view === 'cutout' && srcUrl && cutUrl && (
            <div className="grid grid-cols-2 gap-4">
              <figure className="space-y-1">
                <figcaption className="text-xs text-stone-500">Ảnh gốc</figcaption>
                <div className="overflow-auto rounded border border-stone-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={srcUrl}
                    alt="ảnh gốc"
                    style={{ width: `${zoom * 100}%` }}
                    className="block"
                  />
                </div>
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-xs text-stone-500">Đã tách nền</figcaption>
                <div
                  className="overflow-auto rounded border border-stone-200"
                  style={{
                    backgroundColor: '#fff',
                    backgroundImage:
                      'repeating-conic-gradient(#e7e5e4 0% 25%, #fafaf9 0% 50%)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cutUrl}
                    alt="đã tách nền"
                    style={{ width: `${zoom * 100}%` }}
                    className="block"
                  />
                </div>
              </figure>
            </div>
          )}

          {view !== 'cutout' && activeUrl && (
            <div className="overflow-auto rounded border border-stone-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeUrl}
                alt={VIEW_LABELS[view]}
                style={{ width: `${zoom * 100}%` }}
                className="block"
              />
            </div>
          )}
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
