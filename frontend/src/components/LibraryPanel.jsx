import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import AddSongModal from './AddSongModal.jsx';
import { CHROMATIC_SCALE } from '../utils/musicTheory.js';
import { getOctaveColor } from '../utils/scaleColors.js';

const SECTIONS = [
  { key: 'music', label: 'Music' },
  { key: 'scales', label: 'Scales' },
  { key: 'chords', label: 'Chords' },
];

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
      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 && (
          <div className="px-4 py-6 text-sm text-slate-500 text-center">
            No songs yet. Click "+ Add Song" to start.
          </div>
        )}
        {songs.map(song => (
          <div
            key={song.id}
            className={`group flex items-center justify-between px-4 py-2 cursor-pointer border-l-2 transition-colors ${
              activeSong?.id === song.id
                ? 'bg-slate-800 border-cyan-400'
                : 'border-transparent hover:bg-slate-800/50'
            }`}
            onClick={() => handleLoadSong(song.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 truncate">{song.title}</div>
              {song.artist && (
                <div className="text-xs text-slate-500 truncate">{song.artist}</div>
              )}
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${song.title}"?`)) deleteSong(song.id);
              }}
              title="Delete"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-slate-700">
        <button
          className="w-full px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-medium rounded text-sm"
          onClick={() => setShowModal(true)}
        >
          + Add Song
        </button>
      </div>
      {showModal && <AddSongModal onClose={() => setShowModal(false)} />}
    </>
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

  // Count unique octave runs
  const maxRun = scaleOctaveRuns.reduce((max, r) => Math.max(max, r.runIndex), 0);
  const positionCount = scaleViewMode === 'diagonal'
    ? diagonalPatterns.length
    : cagedPositions.length;

  return (
    <div className="px-3 py-2 border-b border-slate-700 space-y-2">
      {/* View mode toggle */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">View</div>
        <div className="flex gap-0.5 bg-slate-800 rounded p-0.5 border border-slate-700">
          {[{ v: 'full', l: 'Full' }, { v: 'vertical', l: 'Vertical' }, { v: 'diagonal', l: 'Diagonal' }].map(({ v, l }) => (
            <button key={v} onClick={() => { setScaleViewMode(v); setSelectedCagedPosition(null); }}
              className={`flex-1 px-1 py-1 text-[10px] rounded font-medium ${
                scaleViewMode === v ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Position filter (CAGED for vertical, diagonal patterns for diagonal) */}
      {(scaleViewMode === 'vertical' || scaleViewMode === 'diagonal') && positionCount > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Position</div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedCagedPosition(null)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                selectedCagedPosition === null ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >All</button>
            {Array.from({ length: positionCount }).map((_, i) => (
              <button key={i}
                onClick={() => setSelectedCagedPosition(selectedCagedPosition === i ? null : i)}
                className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                  selectedCagedPosition === i ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >{i + 1}</button>
            ))}
          </div>
        </div>
      )}

      {/* Octave run filter */}
      {maxRun > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Octave</div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedOctaveRun(null)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium ${
                selectedOctaveRun === null ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >All</button>
            {Array.from({ length: maxRun + 1 }).map((_, i) => {
              const color = getOctaveColor(i);
              return (
                <button key={i}
                  onClick={() => setSelectedOctaveRun(selectedOctaveRun === i ? null : i)}
                  className="px-2 py-0.5 text-[10px] rounded font-medium"
                  style={{
                    backgroundColor: selectedOctaveRun === i ? color : '#1e293b',
                    color: selectedOctaveRun === i ? '#fff' : '#94a3b8',
                    border: `2px solid ${color}`,
                  }}
                >{i + 1}</button>
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
      <div className="px-3 py-3 border-b border-slate-700">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Root Note</div>
        <div className="flex flex-wrap gap-1">
          {CHROMATIC_SCALE.map(note => (
            <button
              key={note}
              onClick={() => setSelectedRoot(note)}
              className={`px-2 py-1 text-xs rounded ${
                selectedRoot === note
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      {/* Scale controls (view mode, position filter, octave filter) */}
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
                  ? 'bg-slate-800 border-cyan-400'
                  : 'border-transparent hover:bg-slate-800/50'
              }`}
              onClick={() => loadScale(scale.name, selectedRoot)}
            >
              <div className="text-sm text-slate-200">{scale.name}</div>
              {isActive && activeScale.notes && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {activeScale.notes.join(' - ')}
                </div>
              )}
            </div>
          );
        })}
        {scales.length === 0 && (
          <div className="px-4 py-6 text-sm text-slate-500 text-center">
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
    <div className="flex-1 overflow-y-auto">
      {chordLibrary.map(chord => {
        const isActive = selectedChord?.id === chord.id;
        return (
          <div
            key={chord.id}
            className={`px-4 py-2 cursor-pointer border-l-2 transition-colors ${
              isActive
                ? 'bg-slate-800 border-cyan-400'
                : 'border-transparent hover:bg-slate-800/50'
            }`}
            onClick={() => setSelectedChord(chord)}
          >
            <div className="text-sm text-slate-200">{chord.name}</div>
          </div>
        );
      })}
      {chordLibrary.length === 0 && (
        <div className="px-4 py-6 text-sm text-slate-500 text-center">
          Loading chords...
        </div>
      )}
    </div>
  );
}

export default function LibraryPanel() {
  const activeSection = useStore(s => s.activeSection);
  const setActiveSection = useStore(s => s.setActiveSection);

  return (
    <aside className="w-64 border-r border-slate-700 bg-slate-900 flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-slate-700">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeSection === key
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'music' && <MusicSection />}
      {activeSection === 'scales' && <ScalesSection />}
      {activeSection === 'chords' && <ChordsSection />}
    </aside>
  );
}
