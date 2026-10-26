/**
 * AI model shots from a garment's flat-lay photos, via an image model on
 * OpenRouter. Server-only: holds the API key.
 *
 * Port of tools/garment-pipeline/gemini_tryon.py, so the web demo and the
 * batch script prompt the model the same way:
 *  1. The prompt pins the flat-lay as the single source of truth and lists
 *     what must not change (text, print, colour, collar, buttons...).
 *  2. Front + back photos go in, plus a close-up crop of the print area, so
 *     the model can read small lettering.
 *  3. A second, text-only model call compares the result with the flat-lay
 *     and scores it 0-10 with a list of differences.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const IMAGE_MODEL = process.env.TRYON_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image';
export const CHECK_MODEL = process.env.TRYON_CHECK_MODEL ?? 'google/gemini-2.5-flash';

export const VIEWS = {
  front: 'standing straight facing the camera, arms relaxed, front of the garment visible',
  back: 'standing straight seen from directly behind, arms relaxed, back of the garment visible',
  left: "standing in strict left profile (camera at the model's left side, 90 degrees), arms relaxed",
  right: "standing in strict right profile (camera at the model's right side, 90 degrees), arms relaxed",
  threequarter:
    'body turned 45 degrees to the camera, weight on one leg, one hand in trouser pocket, front of the garment still clearly visible',
  walk: 'walking toward the camera mid-stride, natural arm swing, relaxed confident expression, front of the garment visible',
} as const;
export type View = keyof typeof VIEWS;

/** Which flat-lay side(s) a view needs a close-up crop of. */
export const SIDE_REF: Record<View, 'front' | 'back' | 'both'> = {
  front: 'front',
  back: 'back',
  left: 'both',
  right: 'both',
  threequarter: 'front',
  walk: 'front',
};

export const KINDS = {
  tshirt: { label: 'Áo thun', kind: 't-shirt', other: 'bottoms: plain dark jeans', model: 'model' },
  shirt: { label: 'Áo sơ mi', kind: 'button-up shirt', other: 'bottoms: plain dark trousers', model: 'model' },
  pants: { label: 'Quần dài', kind: 'pants', other: 'top: plain white fitted t-shirt', model: 'model' },
  shorts: { label: 'Quần short', kind: 'shorts', other: 'top: plain white fitted t-shirt', model: 'model' },
  skirt: { label: 'Chân váy', kind: 'skirt', other: 'top: plain white fitted tank top', model: 'female model' },
} as const;
export type Kind = keyof typeof KINDS;

const PROMPT = `You are a product photographer doing a VIRTUAL TRY-ON, not a designer.

INPUT: flat-lay photos of ONE real garment ({kind}). They are the single source
of truth. Also given: a close-up crop of its print area.

STEP 1 - Before drawing, silently inventory the garment: base colour, every
piece of text (exact spelling, letter case, font style), every graphic and its
position/size relative to the chest or back, collar type, sleeve length,
pockets, buttons, seams, labels, hem shape.

STEP 2 - Generate ONE photo: a {model}, {view}, plain light grey studio
background, soft even light, full body from head to knees, garment not
covered by hands, hair or other items. Plain neutral {other}.{identity}

HARD RULES - the garment must be a pixel-faithful transfer of the flat-lay:
- Do NOT redesign, restyle, simplify, "improve" or re-letter anything.
- Text: identical characters, spelling, case and font. If you cannot render a
  word exactly, keep its shape rather than inventing different letters.
- Graphics: same artwork, same colours, same size and placement.
- Base colour and fabric texture: unchanged (no recolouring by lighting).
- Same collar, sleeve length, fit, pockets, number of buttons.
- Add NOTHING that is not in the flat-lay (no extra logos, patches, text).
Only natural fabric folds and body shape may change.`;

const IDENTITY = `
SAME PERSON: the last reference image shows the model already wearing this
garment. Use the exact same person (face, hair, skin tone, body), same
bottoms and shoes, same studio and lighting -- only the pose/angle changes.`;

const CHECK = `Image 1-2: flat-lay photos of a real garment (reference).
Image 3: generated photo of a model wearing it ({view} view).
Compare ONLY the garment. Answer JSON:
{"score": 0-10 (10 = identical design), "differences": ["..."]}
Count as differences: changed/misspelled text, missing or added graphics,
different colours, moved or resized prints, wrong collar/sleeves/buttons.`;

/** Same lookup order as the Python script: env, then the shop's .env.local. */
export function apiKey(): string | null {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  for (const f of [
    path.join(process.cwd(), '.env.local'),
    'C:/thuchanh/DATN/fashion-commerce/.env.local',
  ]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

type Part = { type: 'image_url'; image_url: { url: string } } | { type: 'text'; text: string };
const img = (dataUrl: string): Part => ({ type: 'image_url', image_url: { url: dataUrl } });

async function chat(key: string, model: string, content: Part[], extra: Record<string, unknown> = {}) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.2,
      ...extra,
    }),
  });
  if (res.status === 402) {
    // Image output needs >= $1 left on the key, even though one image costs a few cents.
    throw new Error(
      'OpenRouter từ chối: tài khoản hoặc hạn mức của khoá API còn dưới $1 (tạo ảnh cần tối thiểu $1). ' +
        'Nạp thêm hoặc nâng hạn mức khoá tại openrouter.ai/settings/keys.',
    );
  }
  if (res.status === 401) throw new Error('OPENROUTER_API_KEY không hợp lệ hoặc đã bị thu hồi.');
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return json.choices?.[0]?.message ?? {};
}

export interface ShotInput {
  kind: Kind;
  view: View;
  /** JPEG data URLs, already downscaled by the browser. */
  front: string;
  back: string;
  /** Close-up crops of the print area for this view (see SIDE_REF). */
  crops: string[];
  /** The front shot already generated -- keeps the same model across views. */
  identity?: string;
}

export interface ShotResult {
  image: string | null;
  score: number | null;
  differences: string[];
}

export async function generateShot(key: string, input: ShotInput): Promise<ShotResult> {
  const k = KINDS[input.kind];
  const refs: Part[] = [img(input.front), img(input.back), ...input.crops.map(img)];
  let identity = '';
  if (input.identity && input.view !== 'front') {
    refs.push(img(input.identity));
    identity = IDENTITY;
  }
  const prompt = PROMPT.replace('{kind}', k.kind)
    .replace('{model}', k.model)
    .replace('{view}', VIEWS[input.view])
    .replace('{other}', k.other)
    .replace('{identity}', identity);

  const msg = await chat(key, IMAGE_MODEL, [...refs, { type: 'text', text: prompt }], {
    modalities: ['image', 'text'],
  });
  const image: string | null = msg.images?.[0]?.image_url?.url ?? null;
  if (!image) return { image: null, score: null, differences: [String(msg.content ?? 'Không nhận được ảnh').slice(0, 300)] };

  // Self-check: compare only the garment with the flat-lay.
  try {
    const chk = await chat(
      key,
      CHECK_MODEL,
      [img(input.front), img(input.back), img(image), { type: 'text', text: CHECK.replace('{view}', input.view) }],
      { response_format: { type: 'json_object' } },
    );
    const parsed = JSON.parse(String(chk.content ?? '').match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      image,
      score: typeof parsed.score === 'number' ? parsed.score : null,
      differences: Array.isArray(parsed.differences) ? parsed.differences.map(String) : [],
    };
  } catch {
    return { image, score: null, differences: ['Không chấm được điểm'] };
  }
}
