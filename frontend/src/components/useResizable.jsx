import { useState } from 'react';

// Persisted panel dimension. Returns [size, setSize]; setSize clamps and
// writes through to localStorage so layouts survive reloads.
export function usePanelSize(key, def, min, max) {
  const storageKey = `rt-size-${key}`;
  const [size, setSizeState] = useState(() => {
    const v = Number(localStorage.getItem(storageKey));
    return Number.isFinite(v) && v >= min && v <= max ? v : def;
  });
  const setSize = (v) => {
    const clamped = Math.max(min, Math.min(max, v));
    setSizeState(clamped);
    localStorage.setItem(storageKey, String(clamped));
  };
  return [size, setSize];
}

// Slim draggable divider. direction 'row' resizes heights (drag vertically),
// 'col' resizes widths. invert flips the delta for handles on the leading
// edge of a panel (e.g. the top edge of the bottom panel).
export function DragHandle({ direction = 'row', getStart, onResize, invert = false }) {
  const onMouseDown = (e) => {
    e.preventDefault();
    const startPos = direction === 'row' ? e.clientY : e.clientX;
    const startSize = getStart();
    const onMove = (ev) => {
      const pos = direction === 'row' ? ev.clientY : ev.clientX;
      const delta = (pos - startPos) * (invert ? -1 : 1);
      onResize(startSize + delta);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = direction === 'row' ? 'row-resize' : 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className={`flex-shrink-0 group relative z-20 ${
        direction === 'row' ? 'h-1.5 -my-0.5 cursor-row-resize w-full' : 'w-1.5 -mx-0.5 cursor-col-resize h-full'
      }`}
    >
      <div
        className={`absolute bg-gold-500/0 group-hover:bg-gold-500/40 transition-colors ${
          direction === 'row' ? 'inset-x-0 top-1/2 -translate-y-1/2 h-0.5' : 'inset-y-0 left-1/2 -translate-x-1/2 w-0.5'
        }`}
      />
    </div>
  );
}
