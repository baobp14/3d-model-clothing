'use client';

import { useEffect, useMemo, useState } from 'react';
import { recommend, type OutfitMatch, type OutfitProduct } from '@/lib/outfit/recommend';

type Item = OutfitProduct & { model_img?: boolean };
const img = (p: Item, flat = false) => `/outfit/img/${p.id}${flat || !p.model_img ? '__flat' : ''}.jpg`;

const STYLES = ['streetwear', 'casual', 'smart-casual', 'minimal', 'sporty', 'feminine', 'vintage'];

function Swatch({ hex }: { hex: string }) {
  return <span className="inline-block h-3 w-3 rounded-full border border-black/20" style={{ background: hex }} />;
}

function Tags({ p }: { p: OutfitProduct }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-neutral-600">
      {p.colors.map((c) => (
        <span key={c.name + c.hex} className="flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5">
          <Swatch hex={c.hex} />
          {c.name}
        </span>
      ))}
      <span className="rounded bg-neutral-100 px-1.5 py-0.5">{p.pattern}</span>
      {p.style.map((s) => (
        <span key={s} className="rounded bg-neutral-100 px-1.5 py-0.5">{s}</span>
      ))}
      <span className="rounded bg-neutral-100 px-1.5 py-0.5">trang trọng {p.formality}/5</span>
    </div>
  );
}

function MatchCard({ base, m, rank }: { base: OutfitProduct; m: OutfitMatch; rank: number }) {
  const [top, bottom] = base.category === 'top' ? [base, m.item] : [m.item, base];
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="relative flex h-64 items-center justify-center gap-1 bg-[#efece7] p-2">
        <img src={img(top, true)} alt="" className="h-full w-1/2 object-contain" />
        <img src={img(bottom, true)} alt="" className="h-full w-1/2 object-contain" />
        <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">
          #{rank} · {m.score.toFixed(1)} điểm
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="text-sm font-medium">{m.item.name_vi}</div>
        <Tags p={m.item} />
        <a
          href={`/garment-test?top=${encodeURIComponent(top.id)}&bottom=${encodeURIComponent(bottom.id)}`}
          className="mt-1 rounded-lg bg-black px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-neutral-800"
        >
          Mặc thử cả bộ (3D)
        </a>
        <ul className="mt-1 space-y-0.5 text-xs">
          {m.reasons.map((r, i) => (
            <li key={i} className={r.points > 0 ? 'text-emerald-700' : r.points < 0 ? 'text-rose-700' : 'text-neutral-500'}>
              {r.points > 0 ? '+' : r.points < 0 ? '−' : '·'} {r.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function OutfitDemo() {
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'top' | 'bottom'>('all');
  const [taste, setTaste] = useState<string[]>([]);

  useEffect(() => {
    fetch('/outfit/catalog.json')
      .then((r) => r.json())
      .then((ps: Item[]) => {
        setCatalog(ps);
        setSelected(ps[0]?.id ?? null);
      });
  }, []);

  const current = catalog.find((p) => p.id === selected);
  const matches = useMemo(
    () => (current ? recommend(current, catalog, { limit: 4, preferredStyles: taste }) : []),
    [current, catalog, taste],
  );
  const shown = catalog.filter((p) => filter === 'all' || p.category === filter);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Gợi ý phối đồ</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Thuộc tính mỗi món do Gemini gắn nhãn từ ảnh. Điểm phối = màu + họa tiết + phong cách + độ trang trọng + mùa,
        kèm lý do cho từng điểm. {catalog.length} sản phẩm.
      </p>

      {current && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Đang xem</div>
            <img src={img(current, true)} alt="" className="mt-2 h-80 w-full rounded-lg bg-[#efece7] object-contain p-4" />
            <div className="mt-2 font-medium">{current.name_vi}</div>
            <div className="mt-1">
              <Tags p={current} />
            </div>
            <div className="mt-4 text-xs uppercase tracking-wide text-neutral-500">Gu khách (giả lập lịch sử xem)</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setTaste((t) => (t.includes(s) ? t.filter((x) => x !== s) : [...t, s]))}
                  className={`rounded-full border px-2 py-0.5 text-xs ${taste.includes(s) ? 'border-black bg-black text-white' : 'border-black/20'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">
              Phối cùng — {current.category === 'top' ? 'quần / váy' : 'áo'} hợp nhất
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {matches.map((m, i) => (
                <MatchCard key={m.item.id} base={current} m={m} rank={i + 1} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">Chọn món để xem gợi ý</span>
          {(['all', 'top', 'bottom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-0.5 text-xs ${filter === f ? 'border-black bg-black text-white' : 'border-black/20'}`}
            >
              {f === 'all' ? 'Tất cả' : f === 'top' ? 'Áo' : 'Quần · Váy'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
          {shown.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`overflow-hidden rounded-lg border bg-white text-left ${p.id === selected ? 'border-black ring-2 ring-black' : 'border-black/10'}`}
            >
              <img src={img(p, true)} alt="" className="aspect-square w-full bg-[#efece7] object-contain p-1" />
              <div className="truncate px-1.5 py-1 text-[11px]">{p.name_vi}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
