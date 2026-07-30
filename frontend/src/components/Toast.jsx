import { useEffect } from 'react';
import { useStore } from '../store/useStore.js';

// Surfaces store.error as a dismissible toast instead of swallowing it.
// Auto-dismisses; any new error restarts the timer.
export default function Toast() {
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 6000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  if (!error) return null;

  return (
    <div className="fixed bottom-20 right-5 z-50 max-w-sm anim-fade-up">
      <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-ink-900/95 backdrop-blur px-4 py-3 shadow-2xl">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
          <path d="M8 1.5 15 14H1L8 1.5z" stroke="#F87171" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 6v4M8 12v.5" stroke="#F87171" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <div className="text-sm text-chrome-100 leading-snug">{error}</div>
        <button
          onClick={clearError}
          className="text-chrome-500 hover:text-chrome-100 leading-none text-lg -mt-0.5"
          title="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
