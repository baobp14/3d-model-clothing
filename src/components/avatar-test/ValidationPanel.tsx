'use client';

import type { SolveResult } from '@/lib/avatar/avatarMorphService';
import { FIELD_LABELS } from '@/lib/avatar/bodyProfiles';

interface ValidationPanelProps {
  solve: SolveResult | null;
  solving: boolean;
}

function deltaColor(absError: number, outOfRange: boolean): string {
  if (outOfRange) return 'text-red-600';
  if (absError <= 0.5) return 'text-emerald-600';
  if (absError <= 1.5) return 'text-amber-600';
  return 'text-red-600';
}

export default function ValidationPanel({ solve, solving }: ValidationPanelProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">Validation</h2>
        {solve && (
          <span
            className={`font-mono text-xs ${solve.maxAbsError <= 1 ? 'text-emerald-600' : 'text-amber-600'}`}
          >
            max |Δ| {solve.maxAbsError.toFixed(2)} cm
          </span>
        )}
      </div>

      {solving && <p className="text-xs text-stone-500">Solving…</p>}

      {!solving && !solve && (
        <p className="text-xs text-stone-500">Nhấn “Generate Avatar” để xem đối chiếu số đo.</p>
      )}

      {!solving && solve && (
        <>
          {solve.dimensions.some((d) => d.outOfRange) && (
            <div className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
              Một hoặc nhiều số đo nằm ngoài dải morph đạt được — đã kẹp về giới hạn gần nhất.
            </div>
          )}
          {!solve.dimensions.some((d) => d.outOfRange) &&
            solve.dimensions.some((d) => d.extrapolated) && (
              <div className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                Một số axis vượt ±1.0 — hình thể đang được ngoại suy khỏi dữ liệu MakeHuman gốc.
              </div>
            )}

          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-stone-400">
                <th className="pb-1 font-medium">Dimension</th>
                <th className="pb-1 font-medium">Target</th>
                <th className="pb-1 font-medium">Mesh</th>
                <th className="pb-1 font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {solve.dimensions.map((d) => {
                const label = FIELD_LABELS[d.dimension] ?? d.dimension;
                const absError = Math.abs(d.error);
                return (
                  <tr key={d.dimension} className="border-t border-stone-100">
                    <td className="py-1 text-stone-700">{label}</td>
                    <td className="py-1 font-mono tabular-nums text-stone-600">
                      {d.target.toFixed(1)}
                    </td>
                    <td className="py-1 font-mono tabular-nums text-stone-600">
                      {d.achieved.toFixed(1)}
                    </td>
                    <td className={`py-1 font-mono tabular-nums ${deltaColor(absError, d.outOfRange)}`}>
                      {d.error >= 0 ? '+' : ''}
                      {d.error.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {solve.dimensions
            .filter((d) => d.note)
            .map((d) => (
              <p key={d.dimension} className="text-[11px] text-stone-400">
                * {d.note}
              </p>
            ))}
        </>
      )}
    </section>
  );
}
