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
import PitchMap from './PitchMap.jsx';
import { usePanelSize, DragHandle } from './useResizable.jsx';
import { generateVoicings } from '../utils/chordVoicings.js';
import { fretToNote } from '../utils/musicTheory.js';
import { getRunInfo } from '../utils/scaleColors.js';
import { FINGER_COLORS } from '../utils/noteColors.js';
import { BEAT_WIDTH, LEFT_GUTTER, RIGHT_PADDING, xToBeat } from './trackLayout.js';

const FINGER_LEGEND = [
  { finger: 1, label: 'Index' },
  { finger: 2, label: 'Middle' },
  { finger: 3, label: 'Ring' },
  { finger: 4, label: 'Pinky' },
  { finger: 'T', label: 'Thumb' },
];

// Label sits top-right; children (e.g. finger legend) sit top-left.
function PanelHeader({ label, children }) {
  return (
    <div className="flex items-center justify-between px-3 mb-1 min-h-[16px]">
      <div>{children}</div>
      <span className="panel-label">{label}</span>
    </div>
  );
}

function FingerLegend() {
  return (
    <div className="flex items-center gap-3">
      {FINGER_LEGEND.map(f => (
        <div key={f.finger} className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: FINGER_COLORS[f.finger] }}
          />
          <span className="text-[10px] text-chrome-500">{f.label}</span>
        </div>
      ))}
    </div>
  );
}

// Song-section pills: [Intro] [Verse] … parsed from the tab source.
function SectionPills() {
  const sections = useStore(s => s.sections);
  const songSection = useStore(s => s.songSection);
  const setSongSection = useStore(s => s.setSongSection);
  if (sections.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap px-3 py-2 border-b border-ink-700/40">
      <button
        onClick={() => setSongSection(null)}
        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
          songSection === null
            ? 'bg-gold-400 text-ink-950'
            : 'bg-ink-850 text-chrome-400 hover:text-chrome-100'
        }`}
      >
        All
      </button>
      {sections.map((s, i) => (
        <button
          key={i}
          onClick={() => setSongSection(songSection === i ? null : i)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
            songSection === i
              ? 'bg-gold-400 text-ink-950'
              : 'bg-ink-850 text-chrome-400 hover:text-chrome-100'
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

function SongView({ beats, scrollRef, dragging, setDragging, handleScrub }) {
  const onMouseDown = (e) => { setDragging(true); handleScrub(e.clientX); };
  const onMouseMove = (e) => { if (dragging) handleScrub(e.clientX); };
  const onMouseUp = () => setDragging(false);
  const onMouseLeave = () => setDragging(false);
  const totalWidth = LEFT_GUTTER + beats.length * BEAT_WIDTH + RIGHT_PADDING;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 anim-fade-up">
      <SectionPills />
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-x-auto overflow-y-auto select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
        >
          <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
            <div className="border-b border-ink-700/40 py-2">
              <NotationView />
            </div>
            <div className="border-b border-ink-700/40 py-2">
              <TabView />
            </div>
            <Playhead />
          </div>
        </div>
        {/* Band labels pinned top-right of the visible area */}
        <div className="absolute top-2 right-3 panel-label pointer-events-none">Sheet Music</div>
        <div className="absolute right-3 panel-label pointer-events-none" style={{ top: 172 }}>Tab</div>
      </div>
    </div>
  );
}

// Position label for a voicing: "Open" (uses open strings / nut position)
// or the lowest fretted fret up the neck.
function voicingPosition(fingering) {
  const all = fingering || [];
  const fretted = all.filter(f => f.fret > 0);
  if (fretted.length === 0) return 'Open';
  const min = Math.min(...fretted.map(f => f.fret));
  const hasOpen = all.some(f => f.fret === 0);
  if (min <= 1 || (hasOpen && min <= 3)) return 'Open';
  return `${min}fr`;
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

  // Group alternate voicings under their chord name. Same pitch classes,
  // different physical spellings — that's the whole point of showing them.
  const chordGroups = useMemo(() => {
    const groups = new Map();
    for (const chord of filteredChords) {
      if (!groups.has(chord.name)) groups.set(chord.name, []);
      groups.get(chord.name).push(chord);
    }
    return [...groups.entries()];
  }, [filteredChords]);

  // Pitch Map mode takes the whole middle area — it IS the alignment view
  if (scaleViewMode === 'pitchmap') {
    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative">
        <div className="panel-label absolute top-3 right-4 z-10">
          Pitch Map · {activeScale.root} {activeScale.name} — every fret above the key it sounds
        </div>
        <PitchMap />
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden anim-fade-up">
      {/* Left: scale on staff */}
      <div className="flex-1 flex flex-col border-r border-ink-700/40 p-4 overflow-y-auto relative">
        <div className="panel-label mb-2 text-right">
          Scale · {activeScale.root} {activeScale.name}
        </div>
        <ScaleStaff scaleNotes={activeScale.notes} root={activeScale.root} />
      </div>

      {/* Right: chords in key, grouped by name */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        <div className="panel-label mb-2 text-right">
          Chords in Key
          {selectedCagedPosition !== null && (
            <span className="ml-1 text-gold-400 normal-case">(pos {selectedCagedPosition + 1})</span>
          )}
          {selectedOctaveRun !== null && (
            <span className="ml-1 text-gold-400 normal-case">(octave filtered)</span>
          )}
        </div>
        {chordGroups.length === 0 ? (
          <div className="text-chrome-500 text-sm">No matching chords in this position.</div>
        ) : (
          <div className="space-y-4">
            {chordGroups.map(([name, voicings]) => (
              <div key={name}>
                <div className="flex items-baseline gap-2 mb-1.5 border-b border-ink-700/40 pb-1">
                  <span className="font-serif italic text-lg text-chrome-100">{name}</span>
                  <span className="text-[10px] text-chrome-500">
                    {voicings.length} voicing{voicings.length > 1 ? 's' : ''} · same notes, different spots
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {voicings.map(chord => (
                    <ChordBox key={chord.id} chord={chord} size="md" neutral
                      subtitle={voicingPosition(chord.fingering)}
                      onSelect={handleChordSelect}
                      selected={selectedScaleChord?.id === chord.id} />
                  ))}
                </div>
              </div>
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

  const voicings = useMemo(() => {
    if (!selectedChord) return [];
    return generateVoicings(selectedChord);
  }, [selectedChord]);

  const handleVoicingSelect = (chord) => {
    setSelectedScaleChord(selectedScaleChord?.id === chord.id ? null : chord);
  };

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden anim-fade-up">
      {/* Left: all voicings */}
      <div className="flex-1 flex flex-col border-r border-ink-700/40 p-4 overflow-y-auto">
        <div className="panel-label mb-2 text-right">
          {selectedChord.name} — Voicings
        </div>
        <div className="flex flex-wrap gap-3">
          {voicings.map(v => (
            <ChordBox key={v.id} chord={v} size="md"
              subtitle={voicingPosition(v.fingering)}
              onSelect={handleVoicingSelect}
              selected={selectedScaleChord?.id === v.id} />
          ))}
        </div>
      </div>

      {/* Right: chord on staff */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <div className="panel-label mb-3 absolute top-4 right-4">Notation</div>
        <ChordStaff chord={selectedScaleChord || selectedChord} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 anim-fade-up">
      <div className="text-center">
        <div className="font-serif italic text-5xl text-chrome-100 tracking-tight">
          Rosetta<span className="text-gold-400">Tone</span>
        </div>
        <div className="text-chrome-500 text-sm mt-2 tracking-wide">
          one score · four views — tab, staff, fretboard, keys
        </div>
      </div>
      <div className="flex gap-3 text-xs text-chrome-400">
        <div className="px-4 py-3 rounded-lg border border-ink-700/60 bg-ink-900/60 text-center w-40">
          <div className="text-chrome-100 font-medium mb-0.5">Add a song</div>
          Paste a tab or drop a MusicXML / MIDI file
        </div>
        <div className="px-4 py-3 rounded-lg border border-ink-700/60 bg-ink-900/60 text-center w-40">
          <div className="text-chrome-100 font-medium mb-0.5">Explore scales</div>
          CAGED boxes, diagonal runs, chords in key
        </div>
        <div className="px-4 py-3 rounded-lg border border-ink-700/60 bg-ink-900/60 text-center w-40">
          <div className="text-chrome-100 font-medium mb-0.5">Learn chords</div>
          Voicings up the neck, spelled on the staff
        </div>
      </div>
      <div className="text-chrome-500 text-[11px] font-mono">
        space — play · ← → — step · home — rewind
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

  // Resizable instrument panels (persisted)
  const [pianoH, setPianoH] = usePanelSize('piano-h', 150, 90, 340);
  const [guitarH, setGuitarH] = usePanelSize('guitar-h', 190, 110, 380);

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
  const showFingerLegend = showSongView;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-ink-950 overflow-hidden">
      {/* Piano — resizable height, full width */}
      <div className="border-b border-ink-700/40 pt-2 flex-shrink-0 overflow-hidden bg-ink-900/40 flex flex-col"
           style={{ height: pianoH }}>
        <PanelHeader label="Piano" />
        <div className="flex-1 min-h-0 px-4 pb-1">
          <Piano />
        </div>
      </div>
      <DragHandle direction="row" getStart={() => pianoH} onResize={setPianoH} />

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
      {showEmpty && <EmptyState />}

      {/* Fretboard — resizable height, full width */}
      <DragHandle direction="row" getStart={() => guitarH} onResize={setGuitarH} invert />
      <div className="border-t border-ink-700/40 pt-2 flex-shrink-0 overflow-hidden bg-ink-900/40 flex flex-col"
           style={{ height: guitarH }}>
        <PanelHeader label="Guitar">
          {showFingerLegend && <FingerLegend />}
        </PanelHeader>
        <div className="flex-1 min-h-0 px-4 pb-1">
          <Fretboard />
        </div>
      </div>
    </div>
  );
}
