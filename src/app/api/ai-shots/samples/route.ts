import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';

const DATASET = path.join(process.cwd(), 'dataset');
const SAFE = /^[a-z0-9_]+$/;
const FILE = /^(front|back|ai_[a-z]+)\.(jpg|webp)$/;

function kindOf(folder: string) {
  if (folder.includes('skirt')) return 'skirt';
  if (folder.includes('short')) return 'shorts';
  if (folder.includes('pant')) return 'pants';
  if (folder.includes('shirt') && !folder.includes('t_shirt')) return 'shirt';
  return 'tshirt';
}

/**
 * GET                          -> list of dataset items with flat-lays
 * GET ?folder=x&file=front.jpg -> that image (flat-lay or a saved ai_*.jpg)
 */
export async function GET(request: NextRequest) {
  const folder = request.nextUrl.searchParams.get('folder');
  const file = request.nextUrl.searchParams.get('file');

  if (folder || file) {
    if (!folder || !file || !SAFE.test(folder) || !FILE.test(file)) {
      return new Response('bad request', { status: 400 });
    }
    const p = path.join(DATASET, folder, file);
    if (!existsSync(p)) return new Response('not found', { status: 404 });
    return new Response(readFileSync(p), {
      headers: {
        'Content-Type': file.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const items = readdirSync(DATASET, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SAFE.test(d.name))
    .map((d) => {
      const files = readdirSync(path.join(DATASET, d.name));
      const pick = (side: string) => files.find((f) => FILE.test(f) && f.startsWith(side + '.'));
      let report: Record<string, { score?: number; differences?: string[] }> = {};
      try {
        report = JSON.parse(readFileSync(path.join(DATASET, d.name, 'ai_report.json'), 'utf8'));
      } catch {
        /* no report */
      }
      return {
        report,
        folder: d.name,
        kind: kindOf(d.name),
        front: pick('front'),
        back: pick('back'),
        saved: files.filter((f) => /^ai_[a-z]+\.jpg$/.test(f)).map((f) => f.slice(3, -4)),
      };
    })
    .filter((x) => x.front && x.back)
    // Items with the most saved shots first: best for showing results offline.
    .sort((a, b) => b.saved.length - a.saved.length || a.folder.localeCompare(b.folder));

  return Response.json(items);
}
