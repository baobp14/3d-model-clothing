'use client';

import { useCallback, useRef, useState } from 'react';
import { blobToTexture, removeGarmentBackground } from '@/lib/tryon/backgroundRemoval';
import type * as THREE from 'three';

type Slot = 'front' | 'back';

interface SlotState {
  previewUrl: string | null;
  status: 'idle' | 'removing-bg' | 'ready' | 'error';
  error?: string;
}

interface GarmentUploadPanelProps {
  onTextureChange: (slot: Slot, texture: THREE.Texture | null) => void;
  garmentVisible: boolean;
  onToggleVisible: (visible: boolean) => void;
  ready: boolean; // avatar loaded, projectors available
}

const EMPTY_SLOT: SlotState = { previewUrl: null, status: 'idle' };

export default function GarmentUploadPanel({
  onTextureChange,
  garmentVisible,
  onToggleVisible,
  ready,
}: GarmentUploadPanelProps) {
  const [front, setFront] = useState<SlotState>(EMPTY_SLOT);
  const [back, setBack] = useState<SlotState>(EMPTY_SLOT);
  const inputRefs = { front: useRef<HTMLInputElement>(null), back: useRef<HTMLInputElement>(null) };

  const handleFile = useCallback(
    async (slot: Slot, file: File | undefined) => {
      if (!file) return;
      const setState = slot === 'front' ? setFront : setBack;
      const previewUrl = URL.createObjectURL(file);
      setState({ previewUrl, status: 'removing-bg' });
      try {
        const cutout = await removeGarmentBackground(file);
        const texture = await blobToTexture(cutout);
        onTextureChange(slot, texture);
        setState({ previewUrl: URL.createObjectURL(cutout), status: 'ready' });
      } catch (err) {
        console.error(`[tryon] background removal failed for ${slot}`, err);
        onTextureChange(slot, null);
        setState({
          previewUrl,
          status: 'error',
          error: err instanceof Error ? err.message : 'Không tách được nền ảnh.',
        });
      }
    },
    [onTextureChange],
  );

  const clearSlot = useCallback(
    (slot: Slot) => {
      onTextureChange(slot, null);
      const setState = slot === 'front' ? setFront : setBack;
      setState(EMPTY_SLOT);
      const input = inputRefs[slot].current;
      if (input) input.value = '';
    },
    [onTextureChange], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">Mặc thử (texture 3D)</h2>
        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={garmentVisible}
            onChange={(e) => onToggleVisible(e.target.checked)}
          />
          Hiện áo
        </label>
      </div>

      <p className="text-[11px] leading-relaxed text-stone-400">
        Ảnh quần áo chụp thẳng trước/sau sẽ được tách nền ngay trong trình duyệt rồi chiếu lên
        vùng thân trên của avatar. Đây là kỹ thuật projected texture — không mô phỏng vải
        rơi/nhăn thật.
      </p>
      <p className="text-[11px] leading-relaxed text-amber-600">
        ⚠️ Chỉ dùng ảnh <strong>sản phẩm phẳng / ma-nơ-canh</strong> (chỉ có áo, nền đơn giản).
        Ảnh người mẫu đang mặc chưa hỗ trợ — bộ tách nền sẽ giữ nguyên cả người, ra hình sai.
      </p>

      {(['front', 'back'] as Slot[]).map((slot) => {
        const state = slot === 'front' ? front : back;
        return (
          <div key={slot} className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed border-stone-300 bg-stone-50">
              {state.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={state.previewUrl} alt={`${slot} garment preview`} className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] text-stone-400">
                  {slot === 'front' ? 'Trước' : 'Sau'}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <input
                ref={inputRefs[slot]}
                type="file"
                accept="image/*"
                disabled={!ready}
                onChange={(e) => handleFile(slot, e.target.files?.[0])}
                className="text-xs text-stone-600 file:mr-2 file:rounded file:border-0 file:bg-stone-900 file:px-2 file:py-1 file:text-xs file:text-white disabled:opacity-40"
              />
              {state.status === 'removing-bg' && (
                <span className="text-[11px] text-stone-400">Đang tách nền…</span>
              )}
              {state.status === 'error' && (
                <span className="text-[11px] text-red-600">{state.error}</span>
              )}
              {state.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => clearSlot(slot)}
                  className="self-start text-[11px] text-stone-500 underline underline-offset-2"
                >
                  Bỏ ảnh {slot === 'front' ? 'trước' : 'sau'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {!ready && (
        <p className="text-[11px] text-amber-600">Chờ avatar tải xong trước khi upload ảnh áo.</p>
      )}
    </section>
  );
}
