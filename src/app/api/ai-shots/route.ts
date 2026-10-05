import { apiKey, generateShot, KINDS, VIEWS, type ShotInput } from '@/lib/aiShots';

// One image + one check call; the image model alone often takes 20-40 s.
export const maxDuration = 120;

/** POST one view: { kind, view, front, back, crops, identity? } -> { image, score, differences } */
export async function POST(request: Request) {
  const key = apiKey();
  if (!key) {
    return Response.json(
      { error: 'Thiếu OPENROUTER_API_KEY (biến môi trường hoặc .env.local).' },
      { status: 500 },
    );
  }
  const body = (await request.json()) as Partial<ShotInput>;
  if (!body.kind || !(body.kind in KINDS) || !body.view || !(body.view in VIEWS)) {
    return Response.json({ error: 'kind / view không hợp lệ' }, { status: 400 });
  }
  if (!body.front?.startsWith('data:image/') || !body.back?.startsWith('data:image/')) {
    return Response.json({ error: 'Cần ảnh mặt trước và mặt sau' }, { status: 400 });
  }
  try {
    const out = await generateShot(key, {
      kind: body.kind,
      view: body.view,
      front: body.front,
      back: body.back,
      crops: (body.crops ?? []).filter((c) => c.startsWith('data:image/')).slice(0, 2),
      identity: body.identity?.startsWith('data:image/') ? body.identity : undefined,
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
