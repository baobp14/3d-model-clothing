'use client';

import { useEffect, useMemo, useState } from 'react';

type View = 'front' | 'back' | 'left' | 'right' | 'threequarter' | 'walk';
type Kind = 'tshirt' | 'shirt' | 'pants' | 'shorts' | 'skirt';

const VIEW_LABEL: Record<View, string> = {
  front: 'Mặt trước',
  back: 'Mặt sau',
  left: 'Nghiêng trái',
  right: 'Nghiêng phải',
  threequarter: 'Góc 3/4',
  walk: 'Đang bước đi',
};
const VIEWS = Object.keys(VIEW_LABEL) as View[];
// Same as SIDE_REF in src/lib/aiShots.ts: which flat-lay a view needs a print close-up of.
const SIDE_REF: Record<View, 'front' | 'back' | 'both'> = {
  front: 'front',
  back: 'back',
  left: 'both',
  right: 'both',
  threequarter: 'front',
  walk: 'front',
};
const KIND_LABEL: Record<Kind, string> = {
  tshirt: 'Áo thun',
  shirt: 'Áo sơ mi',
  pants: 'Quần dài',
  shorts: 'Quần short',
  skirt: 'Chân váy',
};

interface Sample {
  folder: string;
  kind: Kind;
  front: string;
  back: string;
  saved: View[];
  report: Partial<Record<View, { score?: number; differences?: string[] }>>;
}

interface Shot {
  status: 'idle' | 'running' | 'done' | 'error';
  image?: string;
  score?: number | null;
  differences?: string[];
  error?: string;
  ms?: number;
  saved?: boolean;
}

const fileUrl = (folder: string, file: string) =>
  `/api/ai-shots/samples?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(file)}`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/** Downscale to <= 1024 px JPEG, like part() in gemini_tryon.py. */
function toJpeg(im: HTMLImageElement, crop?: [number, number, number, number], size?: number) {
  const [sx, sy, sw, sh] = crop ?? [0, 0, im.naturalWidth, im.naturalHeight];
  const scale = size ? size / Math.max(sw, sh) : Math.min(1, 1024 / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}

/** Upper-middle of the garment, where prints usually sit (print_crop in the script). */
function printCrop(im: HTMLImageElement) {
  const w = im.naturalWidth;
  const h = im.naturalHeight;
  return toJpeg(im, [w * 0.2, h * 0.15, w * 0.6, h * 0.55], 768);
}

function scoreClass(s: number | null | undefined) {
  if (s == null) return 'bg-stone-400';
  if (s >= 8) return 'bg-emerald-600';
  if (s >= 6) return 'bg-amber-500';
  return 'bg-rose-600';
}

function Upload({ label, src, onFile }: { label: string; src: string | null; onFile: (url: string) => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-white p-3 hover:border-stone-500">
      <span className="text-xs font-medium text-stone-600">{label}</span>
      <div className="flex h-48 w-full items-center justify-center bg-stone-50">
        {src ? (
          <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-stone-400">Bấm để chọn ảnh</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(URL.createObjectURL(f));
        }}
      />
    </label>
  );
}

export default function AiShotsApp() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [folder, setFolder] = useState<string>('');
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>('tshirt');
  const [picked, setPicked] = useState<Set<View>>(new Set(['front', 'back', 'threequarter']));
  const [shots, setShots] = useState<Partial<Record<View, Shot>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/ai-shots/samples')
      .then((r) => r.json())
      .then((list: Sample[]) => {
        setSamples(list);
        if (list[0]) choose(list[0]);
      })
      .catch(() => setSamples([]));
  }, []);

  function choose(s: Sample) {
    setFolder(s.folder);
    setFront(fileUrl(s.folder, s.front));
    setBack(fileUrl(s.folder, s.back));
    setKind(s.kind);
    // Shots generated earlier by the batch script: show them without paying for a new call.
    const prev: Partial<Record<View, Shot>> = {};
    for (const v of s.saved) {
      prev[v] = {
        status: 'done',
        image: fileUrl(s.folder, `ai_${v}.jpg`),
        score: s.report[v]?.score ?? null,
        differences: s.report[v]?.differences ?? [],
        saved: true,
      };
    }
    setShots(prev);
  }

  const current = useMemo(() => samples.find((s) => s.folder === folder), [samples, folder]);

  async function run() {
    if (!front || !back || busy) return;
    setBusy(true);
    try {
      const [fi, bi] = await Promise.all([loadImage(front), loadImage(back)]);
      const f = toJpeg(fi);
      const b = toJpeg(bi);
      const crop = { front: [printCrop(fi)], back: [printCrop(bi)], both: [printCrop(fi), printCrop(bi)] };
      // Front first: every other view reuses it as the identity reference,
      // so all shots show the same model.
      const order = VIEWS.filter((v) => picked.has(v));
      let identity: string | undefined;
      for (const v of order) {
        setShots((s) => ({ ...s, [v]: { status: 'running' } }));
        const t0 = performance.now();
        try {
          const r = await fetch('/api/ai-shots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, view: v, front: f, back: b, crops: crop[SIDE_REF[v]], identity }),
          });
          const j = await r.json();
          if (!r.ok || !j.image) throw new Error(j.error ?? j.differences?.[0] ?? `HTTP ${r.status}`);
          if (v === 'front') identity = j.image;
          setShots((s) => ({
            ...s,
            [v]: { status: 'done', image: j.image, score: j.score, differences: j.differences, ms: performance.now() - t0 },
          }));
        } catch (e) {
          setShots((s) => ({ ...s, [v]: { status: 'error', error: e instanceof Error ? e.message : String(e) } }));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">Tạo ảnh người mẫu từ ảnh sản phẩm</h1>
        <p className="mt-1 text-sm text-stone-500">
          Đưa vào ảnh trải phẳng mặt trước và mặt sau của món đồ. AI tạo ảnh người mẫu mặc đúng món đó ở nhiều góc,
          rồi tự so lại với ảnh gốc và chấm độ giống 0–10.
        </p>
      </header>

      <section className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_1fr_1.2fr]">
        <Upload label="Ảnh trước" src={front} onFile={(u) => { setFront(u); setFolder(''); setShots({}); }} />
        <Upload label="Ảnh sau" src={back} onFile={(u) => { setBack(u); setFolder(''); setShots({}); }} />

        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-stone-500">Hoặc chọn sản phẩm có sẵn trong dataset</span>
            <select
              value={folder}
              onChange={(e) => {
                const s = samples.find((x) => x.folder === e.target.value);
                if (s) choose(s);
              }}
              className="rounded border border-stone-300 px-2 py-1.5"
            >
              <option value="">— ảnh tự tải lên —</option>
              {samples.map((s) => (
                <option key={s.folder} value={s.folder}>
                  {s.folder.replace(/_/g, ' ')}
                  {s.saved.length ? ` (đã có ${s.saved.length} ảnh AI)` : ''}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-1 text-xs font-medium text-stone-500">Loại đồ</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded border px-2 py-1 text-xs ${kind === k ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300'}`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-stone-500">Góc chụp cần tạo</div>
            <div className="grid grid-cols-2 gap-1">
              {VIEWS.map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={picked.has(v)}
                    onChange={(e) =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (e.target.checked) n.add(v);
                        else n.delete(v);
                        // Other views copy the model from the front shot.
                        if (n.size && !n.has('front')) n.add('front');
                        return n;
                      })
                    }
                  />
                  {VIEW_LABEL[v]}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!front || !back || busy || picked.size === 0}
            onClick={run}
            className="mt-auto rounded-lg bg-stone-900 px-4 py-2 font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Đang tạo…' : `Tạo ${picked.size} ảnh bằng AI`}
          </button>
          <p className="text-[11px] text-stone-400">
            Mỗi ảnh mất khoảng 20–40 giây và tốn một lượt gọi OpenRouter (có phí).
            {current?.saved.length ? ' Ảnh đang hiện bên dưới là ảnh đã tạo trước, chưa tốn phí.' : ''}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {VIEWS.filter((v) => shots[v]).map((v) => {
          const s = shots[v]!;
          return (
            <figure key={v} className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="relative flex aspect-[3/4] items-center justify-center bg-stone-100">
                {s.status === 'running' && <span className="animate-pulse text-sm text-stone-500">AI đang vẽ…</span>}
                {s.status === 'error' && <span className="px-3 text-center text-xs text-rose-700">{s.error}</span>}
                {s.image && <img src={s.image} alt={VIEW_LABEL[v]} className="h-full w-full object-cover" />}
                {s.status === 'done' && (
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium text-white ${scoreClass(s.score)}`}>
                    {s.score == null ? 'chưa chấm' : `giống ${s.score}/10`}
                  </span>
                )}
              </div>
              <figcaption className="space-y-1 p-3 text-xs">
                <div className="font-medium">
                  {VIEW_LABEL[v]}
                  <span className="ml-1 font-normal text-stone-400">
                    {s.saved ? '· ảnh đã tạo trước' : s.ms ? `· ${(s.ms / 1000).toFixed(0)} giây` : ''}
                  </span>
                </div>
                {s.differences?.length ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-stone-500">
                    {s.differences.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : s.status === 'done' ? (
                  <div className="text-emerald-700">Không thấy sai khác với ảnh gốc.</div>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </section>
    </div>
  );
}
