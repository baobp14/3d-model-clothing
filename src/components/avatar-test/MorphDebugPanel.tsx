'use client';

import type { AxisValues, BodyMeasurementSet, MorphAxis } from '@/lib/avatar/avatarMorphService';

const SLIDER_MIN = -1.6;
const SLIDER_MAX = 1.6;
const AUTHORED_LIMIT = 1.0;

const AXIS_META: Array<{ axis: MorphAxis; label: string; source: string }> = [
  { axis: 'height', label: 'Height', source: 'macro min/maxheight' },
  { axis: 'weight', label: 'Weight', source: 'macro min/maxweight (BMI-seeded, see Generate)' },
  { axis: 'chest', label: 'Chest', source: 'measure-bust-circ' },
  { axis: 'waist', label: 'Waist', source: 'measure-waist-circ' },
  { axis: 'hip', label: 'Hip', source: 'measure-hips-circ' },
  { axis: 'shoulder', label: 'Shoulder', source: 'measure-shoulder-dist' },
  { axis: 'arm', label: 'Arm', source: 'measure-upperarm+lowerarm-length' },
  { axis: 'leg', label: 'Leg', source: 'measure-upperleg+lowerleg-height' },
  { axis: 'neck', label: 'Neck', source: 'measure-neck-circ' },
];

const LIVE_ROWS: Array<{ key: keyof BodyMeasurementSet; label: string }> = [
  { key: 'height', label: 'Height' },
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hip', label: 'Hip' },
  { key: 'shoulderWidth', label: 'Shoulder (chord)' },
  { key: 'armLength', label: 'Arm length' },
  { key: 'inseam', label: 'Inseam' },
  { key: 'neck', label: 'Neck' },
];

interface MorphDebugPanelProps {
  axes: AxisValues;
  onChange: (axis: MorphAxis, value: number) => void;
  onReset: () => void;
  live: BodyMeasurementSet | null;
}

export default function MorphDebugPanel({ axes, onChange, onReset, live }: MorphDebugPanelProps) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">Morph debug</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
        >
          Reset morphs
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {AXIS_META.map(({ axis, label, source }) => {
          const value = axes[axis];
          const extreme = Math.abs(value) > AUTHORED_LIMIT;
          return (
            <div key={axis} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-stone-700">{label}</span>
                <span
                  className={`font-mono tabular-nums ${extreme ? 'text-amber-600' : 'text-stone-500'}`}
                >
                  {value >= 0 ? '+' : ''}
                  {value.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={0.01}
                value={value}
                onChange={(e) => onChange(axis, Number(e.target.value))}
                className="accent-stone-900"
              />
              <span className="text-[11px] text-stone-400">{source}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-stone-200 pt-3">
        <h3 className="mb-2 text-xs font-semibold text-stone-900">Live mesh measurement</h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {LIVE_ROWS.map(({ key, label }) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-stone-500">{label}</dt>
              <dd className="font-mono tabular-nums text-stone-800">
                {live ? `${live[key].toFixed(1)} cm` : '—'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
