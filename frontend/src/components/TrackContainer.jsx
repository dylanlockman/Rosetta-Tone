import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import NotationView from './NotationView.jsx';
import TabView from './TabView.jsx';
import Piano from './Piano.jsx';
import Fretboard from './Fretboard.jsx';
import Playhead from './Playhead.jsx';
import ScaleStaff from './ScaleStaff.jsx';
import ChordStaff from './ChordStaff.jsx';
import ChordBox from './ChordBox.jsx';
import { generateVoicings } from '../utils/chordVoicings.js';
import { fretToNote } from '../utils/musicTheory.js';
import { getRunInfo } from '../utils/scaleColors.js';
import { BEAT_WIDTH, LEFT_GUTTER, RIGHT_PADDING, xToBeat } from './trackLayout.js';

function SongView({ beats, scrollRef, dragging, setDragging, handleScrub }) {
  const onMouseDown = (e) => { setDragging(true); handleScrub(e.clientX); };
  const onMouseMove = (e) => { if (dragging) handleScrub(e.clientX); };
  const onMouseUp = () => setDragging(false);
  const onMouseLeave = () => setDragging(false);
  const totalWidth = LEFT_GUTTER + beats.length * BEAT_WIDTH + RIGHT_PADDING;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-x-auto overflow-y-auto select-none min-h-0 min-w-0"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
    >
      <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
        <div className="border-b border-slate-800 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">
            Sheet Music
          </div>
          <NotationView />
        </div>
        <div className="border-b border-slate-800 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">
            Tab
          </div>
          <TabView />
        </div>
        <Playhead />
      </div>
    </div>
  );
}

function ScaleView({ activeScale, chordsInKey }) {
  const selectedScaleChord = useStore(s => s.selectedScaleChord);
  const setSelectedScaleChord = useStore(s => s.setSelectedScaleChord);
  const selectedCagedPosition = useStore(s => s.selectedCagedPosition);
  const cagedPositions = useStore(s => s.cagedPositions);
  const scaleViewMode = useStore(s => s.scaleViewMode);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);
  const scaleOctaveRuns = useStore(s => s.scaleOctaveRuns);

  const handleChordSelect = (chord) => {
    setSelectedScaleChord(selectedScaleChord?.id === chord.id ? null : chord);
  };

  // Filter chord voicings by selected position and/or octave
  const filteredChords = useMemo(() => {
    let result = chordsInKey;

    // Filter by CAGED position fret range
    if (selectedCagedPosition !== null && cagedPositions[selectedCagedPosition]) {
      const pos = cagedPositions[selectedCagedPosition];
      result = result.filter(chord => {
        const fretted = chord.fingering.filter(f => f.fret > 0);
        if (fretted.length === 0) return pos.startFret === 0;
        const minFret = Math.min(...fretted.map(f => f.fret));
        const maxFret = Math.max(...fretted.map(f => f.fret));
        return minFret >= pos.startFret && maxFret <= pos.endFret + 1;
      });
    }

    // Filter by octave run — keep chords whose notes fall within the octave range
    if (selectedOctaveRun !== null && scaleOctaveRuns.length > 0) {
      result = result.filter(chord => {
        return chord.fingering.some(f => {
          if (f.fret < 0) return false;
          const info = fretToNote(f.string, f.fret);
          if (!info) return false;
          const run = getRunInfo(scaleOctaveRuns, info.note, info.octave);
          if (!run) return false;
          return run.runIndex === selectedOctaveRun ||
            (run.isBoundary && run.prevRunIndex === selectedOctaveRun);
        });
      });
    }

    return result;
  }, [chordsInKey, selectedCagedPosition, cagedPositions, selectedOctaveRun, scaleOctaveRuns]);

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      {/* Left: scale on staff */}
      <div className="flex-1 flex flex-col border-r border-slate-800 p-4 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
          Scale: {activeScale.root} {activeScale.name}
        </div>
        <ScaleStaff scaleNotes={activeScale.notes} root={activeScale.root} />
      </div>

      {/* Right: chords in key */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
          Chords in Key
          {selectedCagedPosition !== null && (
            <span className="ml-1 text-cyan-400">(pos {selectedCagedPosition + 1})</span>
          )}
          {selectedOctaveRun !== null && (
            <span className="ml-1 text-cyan-400">(oct {selectedOctaveRun + 1})</span>
          )}
        </div>
        {filteredChords.length === 0 ? (
          <div className="text-slate-500 text-sm">No matching chords in this position.</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {filteredChords.map(chord => (
              <ChordBox key={chord.id} chord={chord} size="md" neutral
                onSelect={handleChordSelect}
                selected={selectedScaleChord?.id === chord.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChordView({ selectedChord }) {
  const selectedScaleChord = useStore(s => s.selectedScaleChord);
  const setSelectedScaleChord = useStore(s => s.setSelectedScaleChord);

  // Generate all voicings for the selected chord
  const voicings = useMemo(() => {
    if (!selectedChord) return [];
    return generateVoicings(selectedChord);
  }, [selectedChord]);

  const handleVoicingSelect = (chord) => {
    setSelectedScaleChord(selectedScaleChord?.id === chord.id ? null : chord);
  };

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      {/* Left: all voicings */}
      <div className="flex-1 flex flex-col border-r border-slate-800 p-4 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
          {selectedChord.name} — Voicings
        </div>
        <div className="flex flex-wrap gap-3">
          {voicings.map(v => (
            <ChordBox key={v.id} chord={v} size="md"
              onSelect={handleVoicingSelect}
              selected={selectedScaleChord?.id === v.id} />
          ))}
        </div>
      </div>

      {/* Right: chord on staff */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">
          Notation
        </div>
        <ChordStaff chord={selectedScaleChord || selectedChord} />
      </div>
    </div>
  );
}

export default function TrackContainer() {
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const setCurrentBeat = useStore(s => s.setCurrentBeat);
  const isPlaying = useStore(s => s.isPlaying);
  const activeSection = useStore(s => s.activeSection);
  const scaleViewActive = useStore(s => s.scaleViewActive);
  const activeScale = useStore(s => s.activeScale);
  const chordsInKey = useStore(s => s.chordsInKey);
  const selectedChord = useStore(s => s.selectedChord);
  const scrollRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleScrub = useCallback((clientX) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    const beat = xToBeat(x - BEAT_WIDTH / 2);
    setCurrentBeat(beat);
  }, [setCurrentBeat]);

  // Auto-scroll the notation/tab area to keep the playhead visible
  useEffect(() => {
    if (!scrollRef.current || beats.length === 0) return;
    const el = scrollRef.current;
    const playheadX = LEFT_GUTTER + currentBeat * BEAT_WIDTH + BEAT_WIDTH / 2;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    const margin = el.clientWidth * 0.3;

    if (playheadX < viewLeft + margin) {
      el.scrollTo({ left: Math.max(0, playheadX - margin), behavior: isPlaying ? 'auto' : 'smooth' });
    } else if (playheadX > viewRight - margin) {
      el.scrollTo({ left: playheadX - el.clientWidth + margin, behavior: isPlaying ? 'auto' : 'smooth' });
    }
  }, [currentBeat, beats.length, isPlaying]);

  // Determine which middle content to show
  const showScaleView = activeSection === 'scales' && scaleViewActive && activeScale;
  const showChordView = activeSection === 'chords' && selectedChord;
  const showSongView = !showScaleView && !showChordView && beats.length > 0;
  const showEmpty = !showScaleView && !showChordView && !showSongView;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-slate-950 overflow-hidden">
      {/* Piano — static, centered */}
      <div className="border-b border-slate-800 py-2 flex-shrink-0 overflow-hidden">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">
          Piano
        </div>
        <div className="flex justify-center px-4 overflow-hidden">
          <Piano />
        </div>
      </div>

      {/* Middle — context-aware */}
      {showScaleView && (
        <ScaleView activeScale={activeScale} chordsInKey={chordsInKey} />
      )}
      {showChordView && (
        <ChordView selectedChord={selectedChord} />
      )}
      {showSongView && (
        <SongView
          beats={beats}
          scrollRef={scrollRef}
          dragging={dragging}
          setDragging={setDragging}
          handleScrub={handleScrub}
        />
      )}
      {showEmpty && (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Add a song or click one in the library to get started.
        </div>
      )}

      {/* Fretboard — static, centered */}
      <div className="border-t border-slate-800 py-2 flex-shrink-0 overflow-hidden">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">
          Guitar
        </div>
        <div className="flex justify-center px-4 overflow-hidden">
          <Fretboard />
        </div>
      </div>
    </div>
  );
}
