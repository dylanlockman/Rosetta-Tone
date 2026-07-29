import { useStore } from '../store/useStore.js';

export default function Header() {
  const activeSong = useStore(s => s.activeSong);
  const scaleViewActive = useStore(s => s.scaleViewActive);
  const activeScale = useStore(s => s.activeScale);
  const instrument = useStore(s => s.instrument);
  const setInstrument = useStore(s => s.setInstrument);

  return (
    <header className="flex items-center justify-between px-5 h-12 border-b border-ink-700/60 bg-ink-900 relative z-10 flex-shrink-0">
      <div className="flex items-baseline gap-4 min-w-0">
        <span className="font-serif italic text-2xl text-chrome-100 tracking-tight select-none">
          Rosetta<span className="text-gold-400">Tone</span>
        </span>

        {scaleViewActive && activeScale ? (
          <span className="text-sm text-chrome-300 truncate">
            {activeScale.root} {activeScale.name}
            <span className="text-chrome-500 ml-2 hidden lg:inline">
              {activeScale.notes?.join(' · ')}
            </span>
          </span>
        ) : activeSong ? (
          <span className="text-sm text-chrome-300 truncate">
            {activeSong.title}
            {activeSong.artist && (
              <span className="text-chrome-500"> — {activeSong.artist}</span>
            )}
          </span>
        ) : null}
      </div>

      {/* Audio instrument voice */}
      <div className="flex items-center gap-2">
        <span className="panel-label hidden sm:block">Sound</span>
        <div className="flex items-center gap-0.5 bg-ink-850 rounded-lg p-0.5 border border-ink-700/50">
          {['piano', 'guitar'].map(v => (
            <button
              key={v}
              onClick={() => setInstrument(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                instrument === v
                  ? 'bg-ink-700 text-chrome-100'
                  : 'text-chrome-400 hover:text-chrome-100'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
