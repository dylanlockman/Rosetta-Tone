import { useCallback, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import { unlockAudio } from '../utils/audio.js';
import { transposeLabel } from '../utils/transpose.js';

function PlayIcon({ playing }) {
  return playing ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="1.5" width="3.4" height="11" rx="1" />
      <rect x="8.6" y="1.5" width="3.4" height="11" rx="1" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3.5 1.8a1 1 0 0 1 1.52-.86l8 5.2a1 1 0 0 1 0 1.72l-8 5.2a1 1 0 0 1-1.52-.86V1.8z" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M11.5 6V4.8A2.3 2.3 0 0 0 9.2 2.5H3.9" />
      <path d="m5.6 0.9-1.8 1.6 1.8 1.6" />
      <path d="M3.5 9v1.2a2.3 2.3 0 0 0 2.3 2.3h5.3" />
      <path d="m9.4 14.1 1.8-1.6-1.8-1.6" />
    </svg>
  );
}

function Stepper({ onDecrement, onIncrement, label, children }) {
  return (
    <div className="flex items-center gap-0.5" title={label}>
      <button
        onClick={onDecrement}
        className="w-6 h-6 rounded-md text-chrome-400 hover:text-chrome-100 hover:bg-ink-800 transition-colors text-sm leading-none"
      >−</button>
      {children}
      <button
        onClick={onIncrement}
        className="w-6 h-6 rounded-md text-chrome-400 hover:text-chrome-100 hover:bg-ink-800 transition-colors text-sm leading-none"
      >+</button>
    </div>
  );
}

export default function TransportBar() {
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const setCurrentBeat = useStore(s => s.setCurrentBeat);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const bpm = useStore(s => s.bpm);
  const setBpm = useStore(s => s.setBpm);
  const transpose = useStore(s => s.transpose);
  const setTranspose = useStore(s => s.setTranspose);
  const score = useStore(s => s.score);
  const loop = useStore(s => s.loop);
  const toggleLoop = useStore(s => s.toggleLoop);
  const audioEnabled = useStore(s => s.audioEnabled);
  const toggleAudio = useStore(s => s.toggleAudio);
  const sections = useStore(s => s.sections);
  const songSection = useStore(s => s.songSection);
  const scaleViewActive = useStore(s => s.scaleViewActive);
  const activeScale = useStore(s => s.activeScale);
  const isScalePlaying = useStore(s => s.isScalePlaying);
  const setIsScalePlaying = useStore(s => s.setIsScalePlaying);
  const scalePlayhead = useStore(s => s.scalePlayhead);

  const trackRef = useRef(null);

  // Scale mode: the transport drives the scale pattern instead of a song.
  const scaleMode = scaleViewActive && Boolean(activeScale);
  const hasSong = beats.length > 0 && !scaleMode;
  const hasContent = hasSong || scaleMode;
  const playing = scaleMode ? isScalePlaying : isPlaying;

  const progress = scaleMode
    ? (scalePlayhead ? scalePlayhead.idx / Math.max(1, scalePlayhead.total - 1) : 0)
    : hasSong ? currentBeat / Math.max(1, beats.length - 1) : 0;
  const matchedChord = hasSong ? beats[currentBeat]?.matchedChord : null;

  const counterText = scaleMode
    ? scalePlayhead
      ? `${String(scalePlayhead.idx + 1).padStart(3, '0')}`
      : '—'
    : hasSong ? String(currentBeat + 1).padStart(3, '0') : '—';
  const counterTotal = scaleMode
    ? scalePlayhead ? String(scalePlayhead.total).padStart(3, '0') : '—'
    : hasSong ? String(beats.length).padStart(3, '0') : '—';

  const handlePlayToggle = () => {
    if (!hasContent) return;
    unlockAudio();
    if (scaleMode) {
      setIsScalePlaying(!isScalePlaying);
      return;
    }
    if (!isPlaying && currentBeat >= beats.length - 1) setCurrentBeat(0);
    setIsPlaying(!isPlaying);
  };

  const seekFromPointer = useCallback((clientX) => {
    if (!trackRef.current || beats.length === 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setCurrentBeat(Math.round(frac * (beats.length - 1)));
  }, [beats.length, setCurrentBeat]);

  const onTrackMouseDown = (e) => {
    if (!hasSong) return;
    seekFromPointer(e.clientX);
    const onMove = (ev) => seekFromPointer(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const keyLabel = transposeLabel(score?.meta?.keyRoot, transpose);
  const sectionRange = songSection != null ? sections[songSection] : null;
  const denom = Math.max(1, beats.length - 1);

  return (
    <footer className="flex items-center gap-5 px-5 h-16 border-t border-ink-700/60 bg-ink-900/95 backdrop-blur relative z-10 flex-shrink-0">
      {/* Play */}
      <button
        onClick={handlePlayToggle}
        disabled={!hasContent}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0
          ${hasContent
            ? playing
              ? 'bg-gold-400 text-ink-950 shadow-glowGold'
              : 'bg-gold-400 text-ink-950 hover:bg-gold-300 hover:scale-105'
            : 'bg-ink-800 text-chrome-500 cursor-not-allowed'}`}
        title="Play / Pause (Space)"
      >
        <PlayIcon playing={playing && hasContent} />
      </button>

      {/* Loop */}
      <button
        onClick={toggleLoop}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors -ml-2 ${
          loop ? 'text-gold-400 bg-ink-800' : 'text-chrome-500 hover:text-chrome-300 hover:bg-ink-800'
        }`}
        title={sectionRange ? `Loop ${sectionRange.name}` : 'Loop'}
      >
        <LoopIcon />
      </button>

      {/* Counter + chord / scale label */}
      <div className="flex items-baseline gap-3 min-w-[8rem]">
        <span className="font-mono text-sm text-chrome-100">
          {counterText}
          <span className="text-chrome-500"> / {counterTotal}</span>
        </span>
        {scaleMode && activeScale && (
          <span className="font-serif italic text-lg text-gold-400 leading-none whitespace-nowrap">
            {activeScale.root} {activeScale.name}
          </span>
        )}
        {matchedChord && (
          <span className="font-serif italic text-lg text-gold-400 leading-none">{matchedChord}</span>
        )}
      </div>

      {/* Scrubber */}
      <div
        ref={trackRef}
        onMouseDown={onTrackMouseDown}
        className={`flex-1 h-8 flex items-center group ${hasSong ? 'cursor-pointer' : ''}`}
      >
        <div className="relative w-full h-1 rounded-full bg-ink-700 overflow-visible">
          {/* Active-section emphasis */}
          {hasSong && sectionRange && (
            <div
              className="absolute inset-y-0 rounded-full bg-gold-500/25"
              style={{
                left: `${(sectionRange.startIndex / denom) * 100}%`,
                width: `${((sectionRange.endIndex - sectionRange.startIndex) / denom) * 100}%`,
              }}
            />
          )}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gold-500/80"
            style={{ width: `${progress * 100}%`, transition: playing ? 'none' : 'width 120ms ease' }}
          />
          {/* Section boundary ticks */}
          {hasSong && sections.map((s, i) => (
            <div
              key={i}
              className="absolute w-px bg-chrome-500/70"
              style={{ left: `${(s.startIndex / denom) * 100}%`, top: -3, bottom: -3 }}
              title={s.name}
            />
          ))}
          {hasSong && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gold-400 shadow-glowGold
                         opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress * 100}% - 6px)` }}
            />
          )}
        </div>
      </div>

      {/* BPM */}
      <div className="flex items-center gap-2">
        <span className="panel-label">BPM</span>
        <Stepper
          label="Tempo"
          onDecrement={() => setBpm(bpm - 5)}
          onIncrement={() => setBpm(bpm + 5)}
        >
          <input
            type="number"
            min="20"
            max="300"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            className="w-11 bg-transparent font-mono text-sm text-chrome-100 text-center outline-none
                       border-b border-transparent focus:border-gold-500 transition-colors"
          />
        </Stepper>
      </div>

      {/* Key shift (song mode only) — capo-style transpose */}
      {hasSong && (
        <div className="flex items-center gap-2">
          <span className="panel-label">Key</span>
          <Stepper
            label="Key shift (capo-style)"
            onDecrement={() => setTranspose(transpose - 1)}
            onIncrement={() => setTranspose(transpose + 1)}
          >
            <span
              className={`font-mono text-sm min-w-[2rem] text-center ${transpose !== 0 ? 'text-gold-400' : 'text-chrome-100'}`}
              title={transpose !== 0 ? `${transpose > 0 ? '+' : ''}${transpose} semitones` : 'Original key'}
            >
              {keyLabel}
            </span>
          </Stepper>
        </div>
      )}

      {/* Audio toggle */}
      <button
        onClick={toggleAudio}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          audioEnabled ? 'text-gold-400 hover:bg-ink-800' : 'text-chrome-500 hover:bg-ink-800'
        }`}
        title="Toggle audio output"
      >
        {audioEnabled ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2.5 4.8 5.3H2.5a.7.7 0 0 0-.7.7v4a.7.7 0 0 0 .7.7h2.3L8 13.5V2.5z" />
            <path d="M10.5 5.5a3.4 3.4 0 0 1 0 5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            <path d="M12.3 3.8a6 6 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2.5 4.8 5.3H2.5a.7.7 0 0 0-.7.7v4a.7.7 0 0 0 .7.7h2.3L8 13.5V2.5z" />
            <path d="m10.5 6 4 4M14.5 6l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </footer>
  );
}
