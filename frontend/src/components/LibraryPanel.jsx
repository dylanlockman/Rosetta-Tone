import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import AddSongModal from './AddSongModal.jsx';
import { CHROMATIC_SCALE } from '../utils/musicTheory.js';
import { usePanelSize, DragHandle } from './useResizable.jsx';
import { getOctaveColor } from '../utils/scaleColors.js';

const SECTIONS = [
  { key: 'music', label: 'Music' },
  { key: 'scales', label: 'Scales' },
  { key: 'chords', label: 'Chords' },
];

const SOURCE_BADGES = {
  tab: { label: 'TAB', color: '#8A8F9E' },
  musicxml: { label: 'XML', color: '#6366F1' },
  midi: { label: 'MIDI', color: '#22C55E' },
  url: { label: 'URL', color: '#8A8F9E' },
};

function SongRow({ song, active, onLoad, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const badge = SOURCE_BADGES[song.source_type];

  return (
    <div
      className={`group flex items-center justify-between pl-4 pr-2 py-2 cursor-pointer border-l-2 transition-colors ${
        active
          ? 'bg-ink-800/70 border-gold-400'
          : 'border-transparent hover:bg-ink-800/40'
      }`}
      onClick={onLoad}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm text-chrome-100 truncate flex items-center gap-2">
          <span className="truncate">{song.title}</span>
          {badge && badge.label !== 'TAB' && (
            <span
              className="text-[9px] font-mono px-1 rounded border flex-shrink-0"
              style={{ color: badge.color, borderColor: `${badge.color}55` }}
            >{badge.label}</span>
          )}
        </div>
        {song.artist && (
          <div className="text-xs text-chrome-500 truncate">{song.artist}</div>
        )}
      </div>
      {confirming ? (
        <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
          <button
            className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            onClick={onDelete}
          >Delete</button>
          <button
            className="text-[10px] px-1.5 py-0.5 rounded text-chrome-400 hover:text-chrome-100 transition-colors"
            onClick={() => setConfirming(false)}
          >Keep</button>
        </div>
      ) : (
        <button
          className="opacity-0 group-hover:opacity-100 text-chrome-500 hover:text-red-400 ml-2 px-1 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  );
}

function MusicSection() {
  const songs = useStore(s => s.songs);
  const activeSong = useStore(s => s.activeSong);
  const fetchSongs = useStore(s => s.fetchSongs);
  const loadSong = useStore(s => s.loadSong);
  const deleteSong = useStore(s => s.deleteSong);
  const setActiveSection = useStore(s => s.setActiveSection);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const handleLoadSong = (id) => {
    loadSong(id);
    setActiveSection('music');
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto py-1">
        {songs.length === 0 && (
          <div className="px-4 py-8 text-sm text-chrome-500 text-center">
            No songs yet.<br />Paste a tab or drop a MusicXML / MIDI file.
          </div>
        )}
        {songs.map(song => (
          <SongRow
            key={song.id}
            song={song}
            active={activeSong?.id === song.id}
            onLoad={() => handleLoadSong(song.id)}
            onDelete={() => deleteSong(song.id)}
          />
        ))}
      </div>
      <div className="p-3 border-t border-ink-700/60">
        <button
          className="w-full px-3 py-2 bg-gold-400 hover:bg-gold-300 text-ink-950 font-semibold rounded-lg text-sm transition-colors"
          onClick={() => setShowModal(true)}
        >
          + Add Song
        </button>
      </div>
      {showModal && <AddSongModal onClose={() => setShowModal(false)} />}
    </>
  );
}

function ScalePlayControls() {
  const isScalePlaying = useStore(s => s.isScalePlaying);
  const setIsScalePlaying = useStore(s => s.setIsScalePlaying);
  const loop = useStore(s => s.loop);
  const toggleLoop = useStore(s => s.toggleLoop);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setIsScalePlaying(!isScalePlaying)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
          isScalePlaying
            ? 'bg-gold-400 text-ink-950 shadow-glowGold'
            : 'bg-ink-800 text-gold-400 hover:bg-ink-700'
        }`}
        title="Play the visible pattern (Space)"
      >
        {isScalePlaying ? (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <rect x="0.5" y="0.5" width="2.6" height="7" rx="0.8" />
            <rect x="4.9" y="0.5" width="2.6" height="7" rx="0.8" />
          </svg>
        ) : (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M1.5 0.9a0.6 0.6 0 0 1 .92-.51l5 3.1a0.6 0.6 0 0 1 0 1.02l-5 3.1a0.6 0.6 0 0 1-.92-.51V0.9z" />
          </svg>
        )}
        {isScalePlaying ? 'Stop' : 'Play'}
      </button>
      <button
        onClick={toggleLoop}
        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
          loop
            ? 'bg-ink-700 text-gold-400'
            : 'bg-ink-850 text-chrome-500 hover:text-chrome-300'
        }`}
        title="Loop playback"
      >
        ∞
      </button>
    </div>
  );
}

function ScaleControls() {
  const scaleViewActive = useStore(s => s.scaleViewActive);
  const scaleViewMode = useStore(s => s.scaleViewMode);
  const setScaleViewMode = useStore(s => s.setScaleViewMode);
  const cagedPositions = useStore(s => s.cagedPositions);
  const diagonalPatterns = useStore(s => s.diagonalPatterns);
  const selectedCagedPosition = useStore(s => s.selectedCagedPosition);
  const setSelectedCagedPosition = useStore(s => s.setSelectedCagedPosition);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);
  const setSelectedOctaveRun = useStore(s => s.setSelectedOctaveRun);
  const scaleOctaveRuns = useStore(s => s.scaleOctaveRuns);

  if (!scaleViewActive) return null;

  const maxRun = scaleOctaveRuns.reduce((max, r) => Math.max(max, r.runIndex), 0);
  // First octave each run starts in — so buttons read as real octaves (C3, C4…)
  const runStartOctave = {};
  for (const r of scaleOctaveRuns) {
    if (!(r.runIndex in runStartOctave)) runStartOctave[r.runIndex] = r.octave;
  }
  const positionCount = scaleViewMode === 'diagonal'
    ? diagonalPatterns.length
    : cagedPositions.length;

  return (
    <div className="px-3 py-2.5 border-b border-ink-700/60 space-y-2.5">
      {/* Playback */}
      <div className="flex items-center justify-between">
        <div className="panel-label">Playback</div>
        <ScalePlayControls />
      </div>

      {/* View mode toggle */}
      <div>
        <div className="panel-label mb-1">View</div>
        <div className="flex gap-0.5 bg-ink-850 rounded-lg p-0.5 border border-ink-700/50">
          {[{ v: 'full', l: 'Full' }, { v: 'vertical', l: 'Vert' }, { v: 'diagonal', l: 'Diag' }, { v: 'pitchmap', l: 'Pitch Map' }].map(({ v, l }) => (
            <button key={v} onClick={() => {
                setScaleViewMode(v);
                // Filters are sticky across view switches; only clamp if the
                // new mode has fewer positions than the selected index.
                const count = v === 'diagonal' ? diagonalPatterns.length : cagedPositions.length;
                if (selectedCagedPosition !== null && selectedCagedPosition >= count) {
                  setSelectedCagedPosition(null);
                }
              }}
              className={`flex-1 px-1 py-1 text-[10px] rounded-md font-medium transition-colors ${
                scaleViewMode === v ? 'bg-ink-700 text-chrome-100' : 'text-chrome-400 hover:text-chrome-100'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Position filter (CAGED for vertical, diagonal patterns for diagonal) */}
      {(scaleViewMode === 'vertical' || scaleViewMode === 'diagonal') && positionCount > 0 && (
        <div>
          <div className="panel-label mb-1">Position</div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedCagedPosition(null)}
              className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors ${
                selectedCagedPosition === null ? 'bg-gold-400 text-ink-950' : 'bg-ink-850 text-chrome-400 hover:text-chrome-100'
              }`}
            >All</button>
            {Array.from({ length: positionCount }).map((_, i) => (
              <button key={i}
                onClick={() => setSelectedCagedPosition(selectedCagedPosition === i ? null : i)}
                className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors ${
                  selectedCagedPosition === i ? 'bg-gold-400 text-ink-950' : 'bg-ink-850 text-chrome-400 hover:text-chrome-100'
                }`}
              >{i + 1}</button>
            ))}
          </div>
        </div>
      )}

      {/* Octave run filter */}
      {maxRun > 0 && (
        <div>
          <div className="panel-label mb-1">Octave</div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedOctaveRun(null)}
              className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors ${
                selectedOctaveRun === null ? 'bg-gold-400 text-ink-950' : 'bg-ink-850 text-chrome-400 hover:text-chrome-100'
              }`}
            >All</button>
            {Array.from({ length: maxRun + 1 }).map((_, i) => {
              const color = getOctaveColor(i);
              const startOct = runStartOctave[i];
              const root = scaleOctaveRuns[0]?.pitchClass ?? '';
              return (
                <button key={i}
                  onClick={() => setSelectedOctaveRun(selectedOctaveRun === i ? null : i)}
                  className="px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors"
                  title={startOct != null ? `${root}${startOct} – ${root}${startOct + 1}` : ''}
                  style={{
                    backgroundColor: selectedOctaveRun === i ? color : '#161920',
                    color: selectedOctaveRun === i ? '#fff' : '#8A8F9E',
                    border: `1.5px solid ${selectedOctaveRun === i ? color : `${color}66`}`,
                  }}
                >{startOct != null ? `${root}${startOct}` : i + 1}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScalesSection() {
  const scales = useStore(s => s.scales);
  const activeScale = useStore(s => s.activeScale);
  const loadScale = useStore(s => s.loadScale);
  const [selectedRoot, setSelectedRoot] = useState('C');

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Root note selector */}
      <div className="px-3 py-3 border-b border-ink-700/60">
        <div className="panel-label mb-2">Root Note</div>
        <div className="flex flex-wrap gap-1">
          {CHROMATIC_SCALE.map(note => (
            <button
              key={note}
              onClick={() => setSelectedRoot(note)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                selectedRoot === note
                  ? 'bg-gold-400 text-ink-950 font-semibold'
                  : 'bg-ink-850 text-chrome-400 hover:bg-ink-800 hover:text-chrome-100'
              }`}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Scale controls (playback, view mode, position filter, octave filter) */}
      <ScaleControls />

      {/* Scale list */}
      <div className="py-1">
        {scales.map(scale => {
          const isActive = activeScale?.name === scale.name && activeScale?.root === selectedRoot;
          return (
            <div
              key={scale.id}
              className={`px-4 py-2 cursor-pointer border-l-2 transition-colors ${
                isActive
                  ? 'bg-ink-800/70 border-gold-400'
                  : 'border-transparent hover:bg-ink-800/40'
              }`}
              onClick={() => loadScale(scale.name, selectedRoot)}
            >
              <div className="text-sm text-chrome-100">{scale.name}</div>
              {isActive && activeScale.notes && (
                <div className="text-xs text-chrome-500 mt-0.5 font-mono">
                  {activeScale.notes.join(' · ')}
                </div>
              )}
            </div>
          );
        })}
        {scales.length === 0 && (
          <div className="px-4 py-6 text-sm text-chrome-500 text-center">
            Loading scales...
          </div>
        )}
      </div>
    </div>
  );
}

function ChordsSection() {
  const chordLibrary = useStore(s => s.chordLibrary);
  const selectedChord = useStore(s => s.selectedChord);
  const setSelectedChord = useStore(s => s.setSelectedChord);

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {chordLibrary.map(chord => {
        const isActive = selectedChord?.id === chord.id;
        return (
          <div
            key={chord.id}
            className={`px-4 py-2 cursor-pointer border-l-2 transition-colors ${
              isActive
                ? 'bg-ink-800/70 border-gold-400'
                : 'border-transparent hover:bg-ink-800/40'
            }`}
            onClick={() => setSelectedChord(chord)}
          >
            <div className="text-sm text-chrome-100">{chord.name}</div>
          </div>
        );
      })}
      {chordLibrary.length === 0 && (
        <div className="px-4 py-6 text-sm text-chrome-500 text-center">
          Loading chords...
        </div>
      )}
    </div>
  );
}

export default function LibraryPanel() {
  const activeSection = useStore(s => s.activeSection);
  const setActiveSection = useStore(s => s.setActiveSection);
  const [width, setWidth] = usePanelSize('library-w', 256, 200, 420);

  return (
    <aside className="relative border-r border-ink-700/60 bg-ink-900 flex flex-col flex-shrink-0"
           style={{ width }}>
      <div className="absolute right-0 top-0 bottom-0 z-20">
        <DragHandle direction="col" getStart={() => width} onResize={setWidth} />
      </div>
      {/* Tab bar */}
      <div className="flex border-b border-ink-700/60">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors relative ${
              activeSection === key
                ? 'text-gold-400'
                : 'text-chrome-500 hover:text-chrome-300'
            }`}
          >
            {label}
            {activeSection === key && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {activeSection === 'music' && <MusicSection />}
      {activeSection === 'scales' && <ScalesSection />}
      {activeSection === 'chords' && <ChordsSection />}
    </aside>
  );
}
