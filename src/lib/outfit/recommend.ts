/**
 * Outfit recommender: scores top + bottom pairs from AI-tagged attributes.
 *
 * Deterministic and explainable on purpose: every point added or removed
 * carries a Vietnamese reason, so the UI can say WHY a pair was suggested.
 */

export type Category = 'top' | 'bottom';
export type Pattern = 'solid' | 'graphic' | 'stripe' | 'check' | 'denim' | 'texture';

export interface TaggedColor {
  name: string;
  hex: string;
  role: 'base' | 'accent';
}

export interface OutfitProduct {
  id: string;
  /** Same value for every colour of one product; used to avoid suggesting
   *  the same pants in four colours. */
  product?: string;
  name_vi: string;
  category: Category;
  subtype: string;
  colors: TaggedColor[];
  pattern: Pattern;
  style: string[];
  formality: number;
  season: string[];
  fit: string;
}

export interface Reason {
  points: number;
  text: string;
}

export interface OutfitMatch {
  item: OutfitProduct;
  score: number;
  reasons: Reason[];
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

interface Hsl {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function hexToHsl(hex: string): Hsl {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x808080;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

const NEUTRAL_NAMES = /black|white|grey|gray|charcoal|navy|beige|cream|bone|sand|khaki|ivory|natural|denim|indigo|stone|ecru|off-white|tan|camel|coal/i;

/** Neutrals (black/white/grey/navy/beige/denim) go with everything. */
export function isNeutral(c: TaggedColor): boolean {
  const { s, l } = hexToHsl(c.hex);
  if (NEUTRAL_NAMES.test(c.name)) return true;
  return s < 0.18 || l < 0.15 || l > 0.9;
}

function baseColor(p: OutfitProduct): TaggedColor {
  const c = p.colors.find((c) => c.role === 'base') ?? p.colors[0] ?? { name: 'grey', hex: '#808080', role: 'base' };
  // Denim is worn as a neutral whatever shade of blue the tagger calls it.
  return p.pattern === 'denim' ? { ...c, name: `denim ${c.name}` } : c;
}

function hueGap(a: Hsl, b: Hsl): number {
  const d = Math.abs(a.h - b.h) % 360;
  return d > 180 ? 360 - d : d;
}

function scoreColor(a: OutfitProduct, b: OutfitProduct): Reason[] {
  const ca = baseColor(a);
  const cb = baseColor(b);
  const na = isNeutral(ca);
  const nb = isNeutral(cb);
  const ha = hexToHsl(ca.hex);
  const hb = hexToHsl(cb.hex);

  if (na && nb) {
    const contrast = Math.abs(ha.l - hb.l);
    if (contrast > 0.35) return [{ points: 3, text: `Hai màu trung tính tương phản sáng–tối (${ca.name} + ${cb.name})` }];
    if (contrast < 0.08 && ca.name.toLowerCase() === cb.name.toLowerCase())
      return [{ points: 0, text: `Cùng một màu ${ca.name} từ trên xuống dưới, hơi đơn điệu` }];
    return [{ points: 2, text: `Hai màu trung tính dễ phối (${ca.name} + ${cb.name})` }];
  }
  if (na || nb) {
    const [colour, neutral] = na ? [cb, ca] : [ca, cb];
    return [{ points: 3, text: `Nền ${neutral.name} trung tính làm nổi màu ${colour.name}` }];
  }
  const gap = hueGap(ha, hb);
  if (gap < 30) return [{ points: 2, text: `Hai màu cùng tông (${ca.name} + ${cb.name})` }];
  if (gap > 150) return [{ points: 2, text: `Cặp màu bổ túc tương phản (${ca.name} + ${cb.name})` }];
  if (gap >= 80 && gap <= 150) return [{ points: -2, text: `Hai màu nổi lệch tông dễ "đá" nhau (${ca.name} + ${cb.name})` }];
  return [{ points: 0, text: `Hai màu nổi, phối được nhưng kén người mặc` }];
}

// ---------------------------------------------------------------------------
// Other criteria
// ---------------------------------------------------------------------------

const BUSY: Pattern[] = ['graphic', 'stripe', 'check'];

function scorePattern(a: OutfitProduct, b: OutfitProduct): Reason[] {
  const ba = BUSY.includes(a.pattern);
  const bb = BUSY.includes(b.pattern);
  if (ba && bb) return [{ points: -3, text: 'Cả hai món đều có họa tiết, rối mắt' }];
  if (ba || bb) {
    const busy = ba ? a : b;
    return [{ points: 2, text: `Món còn lại trơn giúp ${busy.pattern === 'graphic' ? 'hình in' : 'họa tiết'} nổi bật` }];
  }
  return [];
}

const STYLE_VI: Record<string, string> = {
  streetwear: 'streetwear',
  casual: 'casual',
  'smart-casual': 'smart-casual',
  minimal: 'tối giản',
  sporty: 'thể thao',
  feminine: 'nữ tính',
  vintage: 'vintage',
};

function scoreStyle(a: OutfitProduct, b: OutfitProduct): Reason[] {
  const shared = a.style.filter((s) => b.style.includes(s));
  if (shared.length === 0) return [{ points: -1, text: 'Hai món khác phong cách' }];
  return [{ points: Math.min(shared.length, 2) * 1.5, text: `Cùng phong cách ${shared.map((s) => STYLE_VI[s] ?? s).join(', ')}` }];
}

function scoreFormality(a: OutfitProduct, b: OutfitProduct): Reason[] {
  const d = Math.abs(a.formality - b.formality);
  if (d === 0) return [{ points: 2, text: 'Cùng mức độ trang trọng' }];
  if (d === 1) return [{ points: 1, text: 'Độ trang trọng tương đương' }];
  return [{ points: -3 * (d - 1), text: 'Lệch độ trang trọng (ví dụ sơ mi công sở với quần đi biển)' }];
}

function scoreSeason(a: OutfitProduct, b: OutfitProduct): Reason[] {
  if (!a.season.length || !b.season.length) return [];
  if (a.season.some((s) => b.season.includes(s))) return [];
  return [{ points: -2, text: 'Không cùng mùa' }];
}

// ---------------------------------------------------------------------------

export function scorePair(a: OutfitProduct, b: OutfitProduct): { score: number; reasons: Reason[] } {
  const reasons = [
    ...scoreColor(a, b),
    ...scorePattern(a, b),
    ...scoreStyle(a, b),
    ...scoreFormality(a, b),
    ...scoreSeason(a, b),
  ];
  return { score: reasons.reduce((s, r) => s + r.points, 0), reasons };
}

export interface RecommendOptions {
  limit?: number;
  /** Style tags the viewer tends to browse/buy -- small boost each. */
  preferredStyles?: string[];
}

/** Best items of the OTHER category to wear with `item`. */
export function recommend(item: OutfitProduct, catalog: OutfitProduct[], opts: RecommendOptions = {}): OutfitMatch[] {
  const { limit = 4, preferredStyles = [] } = opts;
  return catalog
    .filter((c) => c.category !== item.category && c.id !== item.id)
    .map((c) => {
      const { score, reasons } = scorePair(item, c);
      const liked = c.style.filter((s) => preferredStyles.includes(s));
      if (liked.length) reasons.push({ points: 1, text: 'Hợp gu bạn hay xem' });
      return { item: c, score: score + (liked.length ? 1 : 0), reasons };
    })
    .sort((x, y) => y.score - x.score)
    .filter((m, i, all) => {
      const p = m.item.product ?? m.item.id;
      return all.findIndex((o) => (o.item.product ?? o.item.id) === p) === i;
    })
    .slice(0, limit);
}
