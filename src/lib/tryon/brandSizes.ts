/**
 * Real size charts per brand/style, keyed by dataset print id (folder name).
 *
 * Numbers are the brands' own garment measurements, converted to cm and to
 * circumferences (a flat "body width" or "chest width" is half the chest).
 * The try-on scales the base mesh of the same size letter so its chest (tops)
 * or waist/hip (bottoms) and length match the brand, and the ease and fit
 * verdict use these numbers instead of the generic chart in garment-metadata.
 */

export type SizeLetter = 'S' | 'M' | 'L' | 'XL';

export interface BrandSize {
  /** What the brand calls this size (SML, 32, 8...). */
  label: string;
  chestCircCm?: number;
  bodyLengthCm?: number;
  waistCircCm?: number;
  hipCircCm?: number;
  inseamCm?: number;
}

export interface BrandChart {
  id: string;
  brand: string;
  style: string;
  kind: 'tshirt' | 'pants' | 'shorts' | 'skirt';
  source: string;
  /** Elastic waistbands are measured relaxed; this much extra stretch still fits. */
  waistStretchCm?: number;
  /** Set when the brand publishes no garment measurements and a standard chart stands in. */
  estimate?: string;
  /**
   * The chart lists BODY sizes, not garment sizes: a body matching the chart fits,
   * so the garment is taken to be this much bigger (mid of the 'vừa' ease band).
   */
  bodyChartEaseCm?: number;
  sizes: Record<SizeLetter, BrandSize>;
}

const IN = 2.54;
const circ = (halfInches: number) => Math.round(halfInches * 2 * IN * 10) / 10;
const cm = (inches: number) => Math.round(inches * IN * 10) / 10;

function tee(id: string, brand: string, style: string, source: string, labels: string[], halfChestCm: number[], lengthCm: number[]): BrandChart {
  const letters: SizeLetter[] = ['S', 'M', 'L', 'XL'];
  return {
    id, brand, style, kind: 'tshirt', source,
    sizes: Object.fromEntries(letters.map((s, i) => [s, { label: labels[i], chestCircCm: halfChestCm[i] * 2, bodyLengthCm: lengthCm[i] }])) as Record<SizeLetter, BrandSize>,
  };
}

const AS_LABELS = ['SML', 'MED', 'LRG', 'XLG'];
const asBasic = (id: string, style: string, source: string) =>
  tee(id, 'AS Colour', style, source, AS_LABELS, [18.5, 20.5, 22.25, 24].map(cm), [28, 29.5, 31, 32.25].map(cm));

const JTD_SOURCE = 'https://jumpthedark.co.uk/pages/size-guide-charts';
const JTD = ['S', 'M', 'L', 'XL'];

export const BRAND_CHARTS: BrandChart[] = [
  asBasic('ascolour_5051', 'Basic Tee 5051', 'https://ascolour.com/mens-basic-tee-5051/'),
  asBasic('ascolour_5028', 'Staple Stripe Tee 5028', 'https://ascolour.com/mens-staple-stripe-tee-5028/'),
  tee('ascolour_5052', 'AS Colour', 'Block Oversized Tee 5052', 'https://ascolour.com/block-oversized-tee-5052/', AS_LABELS,
    [22.75, 23.75, 24.75, 25.75].map(cm), [28.25, 29, 30, 30.75].map(cm)),
  tee('jtd_premium', 'Jump The Dark', 'Premium T-shirt 215gsm', JTD_SOURCE, JTD, [51, 55, 58, 61], [71, 75, 77, 79]),
  tee('jtd_heavy', 'Jump The Dark', 'Heavy T-shirt 245gsm', JTD_SOURCE, JTD, [50, 53, 58, 64], [71, 74, 76, 79]),
  tee('jtd_standard', 'Jump The Dark', 'Standard T-shirt 180gsm', JTD_SOURCE, JTD, [49, 53, 56, 59], [69, 73, 75, 77]),
  {
    id: 'ascolour_5932', brand: 'AS Colour', style: 'Relax Track Pants 5932', kind: 'pants',
    source: 'https://ascolour.com/mens-relax-track-pants-5932/', waistStretchCm: 14,
    sizes: {
      S: { label: 'SML', waistCircCm: circ(13.75), inseamCm: cm(28.75) },
      M: { label: 'MED', waistCircCm: circ(14.75), inseamCm: cm(29) },
      L: { label: 'LRG', waistCircCm: circ(15.75), inseamCm: cm(29) },
      XL: { label: 'XLG', waistCircCm: circ(16.75), inseamCm: cm(29) },
    },
  },
  {
    id: 'ascolour_5903', brand: 'AS Colour', style: 'Beach Shorts 5903', kind: 'shorts',
    source: 'https://ascolour.com/beach-shorts-17-5903s/',
    sizes: {
      S: { label: '30', waistCircCm: cm(30), inseamCm: cm(6.75) },
      M: { label: '32', waistCircCm: cm(32), inseamCm: cm(7) },
      L: { label: '34', waistCircCm: cm(34), inseamCm: cm(7) },
      XL: { label: '36', waistCircCm: cm(36), inseamCm: cm(7) },
    },
  },
  {
    id: 'everlane', brand: 'Everlane', style: 'Women’s skirts (US 4–16)', kind: 'skirt',
    source: 'https://www.everlane.com/collections/womens-skirts',
    estimate: 'Everlane chỉ công bố size số (00–16), không công bố số đo; dùng bảng size cơ thể nữ chuẩn Mỹ.',
    bodyChartEaseCm: 6,
    sizes: {
      S: { label: '4', waistCircCm: cm(27), hipCircCm: cm(37) },
      M: { label: '8', waistCircCm: cm(29), hipCircCm: cm(39) },
      L: { label: '12', waistCircCm: cm(31.5), hipCircCm: cm(41.5) },
      XL: { label: '16', waistCircCm: cm(34), hipCircCm: cm(44) },
    },
  },
];

const byId = new Map(BRAND_CHARTS.map((c) => [c.id, c]));

/** The brand chart for a dataset print id, or null when the brand publishes none we have. */
export function chartForPrint(printId: string | null | undefined): BrandChart | null {
  if (!printId) return null;
  if (printId.startsWith('jtd_')) {
    return byId.get(printId.includes('premium') ? 'jtd_premium' : printId.includes('heavy') ? 'jtd_heavy' : 'jtd_standard') ?? null;
  }
  if (printId.startsWith('everlane_')) return byId.get('everlane') ?? null;
  const style = /^ascolour_\d+/.exec(printId)?.[0];
  return (style && byId.get(style)) || null;
}

/** Chest for tops, waist (plus any elastic stretch) for bottoms: what the fit verdict compares with the body. */
export function fitCircCm(chart: BrandChart, size: SizeLetter): number | undefined {
  const s = chart.sizes[size];
  const extra = (chart.waistStretchCm ?? 0) + (chart.bodyChartEaseCm ?? 0);
  return chart.kind === 'tshirt' ? s.chestCircCm : s.waistCircCm !== undefined ? s.waistCircCm + extra : undefined;
}

/**
 * Horizontal and vertical scale that turns the base mesh of `size` into the brand's
 * garment. `base` is that size's entry in garment-metadata.
 */
export function meshScale(chart: BrandChart, size: SizeLetter, base: Record<string, number>): { sx: number; sy: number } {
  const s = chart.sizes[size];
  const ratio = (target?: number, mesh?: number) => (target && mesh ? target / mesh : 1);
  if (chart.kind === 'tshirt') return { sx: ratio(s.chestCircCm, base.chestCircCm), sy: ratio(s.bodyLengthCm, base.bodyLengthCm) };
  if (chart.kind === 'skirt') return { sx: ratio(s.hipCircCm && s.hipCircCm + (chart.bodyChartEaseCm ?? 0), base.hipCircCm), sy: 1 };
  // Trousers and shorts: width from the waist (stretch included, as worn), length from the inseam.
  return { sx: ratio(fitCircCm(chart, size), base.waistCircCm), sy: ratio(s.inseamCm, base.inseamCm) };
}
