import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { noteToMidi, fretToNote } from '../utils/musicTheory.js';
import { getRunInfo, getOctaveColor } from '../utils/scaleColors.js';

// Shrunk dimensions for 88-key layout
const WHITE_KEY_WIDTH = 18;
const WHITE_KEY_HEIGHT = 100;
const BLACK_KEY_WIDTH = 12;
const BLACK_KEY_HEIGHT = 62;

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEY_OFFSETS = {
  'C#': 0,
  'D#': 1,
  'F#': 3,
  'G#': 4,
  'A#': 5,
};

// 88 keys: A0 to C8
function build88Keys() {
  const whites = [];
  const blacks = [];
  let whiteIdx = 0;

  for (const note of ['A', 'B']) {
    whites.push({ note, octave: 0, whiteIdx });
    whiteIdx++;
  }
  blacks.push({ note: 'A#', octave: 0, afterWhiteIdx: 0 });

  for (let oct = 1; oct <= 7; oct++) {
    WHITE_NOTES.forEach((note) => {
      whites.push({ note, octave: oct, whiteIdx });
      whiteIdx++;
    });
    Object.entries(BLACK_KEY_OFFSETS).forEach(([note, offset]) => {
      const octStart = 2 + (oct - 1) * 7;
      blacks.push({ note, octave: oct, afterWhiteIdx: octStart + offset });
    });
  }

  whites.push({ note: 'C', octave: 8, whiteIdx });
  return { whites, blacks };
}

const KEYS_88 = build88Keys();

function SplitKey({ x, y, w, h, color1, color2, id, rx = 2 }) {
  return (
    <g>
      <defs>
        <clipPath id={`split-key-tl-${id}`}>
          <polygon points={`${x},${y} ${x + w},${y} ${x},${y + h}`} />
        </clipPath>
        <clipPath id={`split-key-br-${id}`}>
          <polygon points={`${x + w},${y} ${x + w},${y + h} ${x},${y + h}`} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={color1} clipPath={`url(#split-key-tl-${id})`} rx={rx} />
      <rect x={x} y={y} width={w} height={h} fill={color2} clipPath={`url(#split-key-br-${id})`} rx={rx} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#0B0C10" strokeWidth={1} rx={rx} />
    </g>
  );
}

export default function Piano() {
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const scaleViewActive = useStore(s => s.scaleViewActive);
  const scaleOctaveRuns = useStore(s => s.scaleOctaveRuns);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);
  const selectedCagedPosition = useStore(s => s.selectedCagedPosition);
  const cagedPositions = useStore(s => s.cagedPositions);
  const selectedScaleChord = useStore(s => s.selectedScaleChord);
  const scalePlayheadNote = useStore(s => s.scalePlayheadNote);
  const activeBeat = beats[currentBeat];
  const activeNotes = activeBeat?.notes || [];

  // Compute MIDI set for selected scale chord (for highlighting)
  const chordMidiSet = useMemo(() => {
    if (!selectedScaleChord?.fingering) return new Set();
    const midis = new Set();
    for (const f of selectedScaleChord.fingering) {
      if (f.fret < 0) continue;
      const info = fretToNote(f.string, f.fret);
      if (info) {
        const pc = info.note;
        for (let oct = 0; oct <= 8; oct++) {
          const m = noteToMidi(pc, oct);
          if (m != null) midis.add(m);
        }
      }
    }
    return midis;
  }, [selectedScaleChord]);

  const totalWhiteKeys = KEYS_88.whites.length; // 52
  const width = totalWhiteKeys * WHITE_KEY_WIDTH + 4;
  const height = WHITE_KEY_HEIGHT + 12;

  const playheadMidi = scaleViewActive && scalePlayheadNote ? scalePlayheadNote.midi : null;

  // Build active map by midi (song mode)
  const activeByMidi = useMemo(() => {
    const map = new Map();
    if (!scaleViewActive) {
      for (const n of activeNotes) {
        const midi = n.midi ?? noteToMidi(n.note, n.octave);
        if (midi != null) map.set(midi, n);
      }
    }
    return map;
  }, [scaleViewActive, activeNotes]);

  // Check if a note passes the current filters (octave run + CAGED position)
  const passesFilter = (note, octave) => {
    if (!scaleViewActive) return true;
    const runInfo = getRunInfo(scaleOctaveRuns, note, octave);
    if (!runInfo) return false;
    if (selectedOctaveRun !== null && runInfo.runIndex !== selectedOctaveRun &&
        !(runInfo.isBoundary && runInfo.prevRunIndex === selectedOctaveRun)) {
      return false;
    }
    if (selectedCagedPosition !== null && cagedPositions.length > 0) {
      const pos = cagedPositions[selectedCagedPosition];
      if (pos) {
        const midi = noteToMidi(note, octave);
        const inPosition = pos.notes.some(n => noteToMidi(n.note, n.octave) === midi);
        if (!inPosition) return false;
      }
    }
    return true;
  };

  const whiteKeys = KEYS_88.whites.map((k) => {
    const x = k.whiteIdx * WHITE_KEY_WIDTH + 2;
    const midi = noteToMidi(k.note, k.octave);
    const runInfo = scaleViewActive ? getRunInfo(scaleOctaveRuns, k.note, k.octave) : null;
    const filtered = scaleViewActive && runInfo && !passesFilter(k.note, k.octave);
    const chordHighlight = chordMidiSet.size > 0 && chordMidiSet.has(midi);
    return { ...k, x, midi, active: activeByMidi.get(midi), runInfo, filtered, chordHighlight };
  });

  const blackKeys = KEYS_88.blacks.map((k) => {
    const x = (k.afterWhiteIdx + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2 + 2;
    const midi = noteToMidi(k.note, k.octave);
    const runInfo = scaleViewActive ? getRunInfo(scaleOctaveRuns, k.note, k.octave) : null;
    const filtered = scaleViewActive && runInfo && !passesFilter(k.note, k.octave);
    const chordHighlight = chordMidiSet.size > 0 && chordMidiSet.has(midi);
    return { ...k, x, midi, active: activeByMidi.get(midi), runInfo, filtered, chordHighlight };
  });

  const showLabel = (note) => note === 'C';
  const pressed = (k) => Boolean(k.active) || k.midi === playheadMidi;

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id="ivory" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DFDCD3" />
          <stop offset="0.85" stopColor="#F2F0EA" />
          <stop offset="1" stopColor="#E4E1D8" />
        </linearGradient>
        <linearGradient id="ebonyKey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A2D35" />
          <stop offset="0.12" stopColor="#14161B" />
          <stop offset="1" stopColor="#1D2027" />
        </linearGradient>
        <filter id="keyGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Felt strip above the keys */}
      <rect x={0} y={0} width={width} height={4} fill="#7F1D1D" rx={1} />

      {/* White keys */}
      {whiteKeys.map((k, i) => {
        const kw = WHITE_KEY_WIDTH - 1;
        const label = showLabel(k.note) ? `C${k.octave}` : '';
        const isPressed = pressed(k);
        const dy = isPressed ? 1.5 : 0;

        // Scale mode — in scale
        if (scaleViewActive && k.runInfo) {
          const isPlayhead = k.midi === playheadMidi;
          if (k.filtered) {
            return (
              <g key={`w-${i}`}>
                <rect x={k.x} y={6} width={kw} height={WHITE_KEY_HEIGHT}
                  fill="#B9BCC5" stroke="#0B0C10" strokeWidth={1} rx="2" opacity={0.25} />
              </g>
            );
          }
          if (k.runInfo.isBoundary) {
            return (
              <g key={`w-${i}`} transform={isPlayhead ? 'translate(0,1.5)' : undefined}
                 filter={isPlayhead ? 'url(#keyGlow)' : undefined} className="note-transition">
                <SplitKey x={k.x} y={6} w={kw} h={WHITE_KEY_HEIGHT}
                  color1={getOctaveColor(k.runInfo.prevRunIndex)}
                  color2={getOctaveColor(k.runInfo.runIndex)} id={`pw-${i}`} />
                {isPlayhead && <rect x={k.x} y={6} width={kw} height={WHITE_KEY_HEIGHT}
                  fill="none" stroke="#FFD98A" strokeWidth={2.5} rx="2" />}
                {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 1}
                  fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
              </g>
            );
          }
          return (
            <g key={`w-${i}`} transform={isPlayhead ? 'translate(0,1.5)' : undefined}
               filter={isPlayhead ? 'url(#keyGlow)' : undefined} className="note-transition">
              <rect x={k.x} y={6} width={kw} height={WHITE_KEY_HEIGHT}
                fill={getOctaveColor(k.runInfo.runIndex)} stroke="#0B0C10" strokeWidth={1} rx="2" />
              {isPlayhead && <rect x={k.x} y={6} width={kw} height={WHITE_KEY_HEIGHT}
                fill="none" stroke="#FFD98A" strokeWidth={2.5} rx="2" />}
              {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 1}
                fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
            </g>
          );
        }

        // Scale mode — not in scale
        if (scaleViewActive) {
          return (
            <g key={`w-${i}`}>
              <rect x={k.x} y={6} width={kw} height={WHITE_KEY_HEIGHT}
                fill="url(#ivory)" stroke="#0B0C10" strokeWidth={1} rx="2" opacity={0.35} />
              {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 1}
                fill="#8A8F9E" fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
            </g>
          );
        }

        // Song mode
        const open = k.active && isOpen(k.active.finger);
        const fill = k.active && !open ? getFingerColor(k.active.finger) : 'url(#ivory)';
        return (
          <g key={`w-${i}`} transform={dy ? `translate(0,${dy})` : undefined}
             filter={k.active && !open ? 'url(#keyGlow)' : undefined}
             className="note-transition">
            <rect x={k.x} y={6} width={kw} height={WHITE_KEY_HEIGHT}
              fill={fill}
              stroke={open ? getFingerColor(0) : '#0B0C10'}
              strokeWidth={open ? 2 : 1} rx="2" />
            {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 1}
              fill={k.active && !open ? '#fff' : '#5C6272'}
              fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
          </g>
        );
      })}

      {/* Black keys */}
      {blackKeys.map((k, i) => {
        const isPressed = pressed(k);
        const dy = isPressed ? 1.5 : 0;

        if (scaleViewActive && k.runInfo) {
          const isPlayhead = k.midi === playheadMidi;
          if (k.filtered) {
            return (
              <g key={`b-${i}`}>
                <rect x={k.x} y={6} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                  fill="#1D212B" stroke="#0B0C10" strokeWidth="1" rx="1" opacity={0.3} />
              </g>
            );
          }
          if (k.runInfo.isBoundary) {
            return (
              <g key={`b-${i}`} transform={isPlayhead ? 'translate(0,1.5)' : undefined}
                 filter={isPlayhead ? 'url(#keyGlow)' : undefined} className="note-transition">
                <SplitKey x={k.x} y={6} w={BLACK_KEY_WIDTH} h={BLACK_KEY_HEIGHT}
                  color1={getOctaveColor(k.runInfo.prevRunIndex)}
                  color2={getOctaveColor(k.runInfo.runIndex)} id={`pb-${i}`} rx={1} />
                {isPlayhead && <rect x={k.x} y={6} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                  fill="none" stroke="#FFD98A" strokeWidth={2} rx="1" />}
              </g>
            );
          }
          return (
            <g key={`b-${i}`} transform={isPlayhead ? 'translate(0,1.5)' : undefined}
               filter={isPlayhead ? 'url(#keyGlow)' : undefined} className="note-transition">
              <rect x={k.x} y={6} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                fill={getOctaveColor(k.runInfo.runIndex)} stroke="#0B0C10" strokeWidth="1" rx="1" />
              {isPlayhead && <rect x={k.x} y={6} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                fill="none" stroke="#FFD98A" strokeWidth={2} rx="1" />}
            </g>
          );
        }

        if (scaleViewActive) {
          return (
            <g key={`b-${i}`}>
              <rect x={k.x} y={6} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                fill="url(#ebonyKey)" stroke="#0B0C10" strokeWidth="1" rx="1" opacity={0.35} />
            </g>
          );
        }

        const fill = k.active ? getFingerColor(k.active.finger) : 'url(#ebonyKey)';
        return (
          <g key={`b-${i}`} transform={dy ? `translate(0,${dy})` : undefined}
             filter={k.active ? 'url(#keyGlow)' : undefined} className="note-transition">
            <rect x={k.x} y={6} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
              fill={fill} stroke="#0B0C10" strokeWidth="1" rx="1" />
          </g>
        );
      })}

      {/* Chord highlight overlays — gold ring on keys belonging to selected chord */}
      {chordMidiSet.size > 0 && whiteKeys.filter(k => k.chordHighlight).map((k, i) => (
        <rect key={`whl-${i}`} x={k.x} y={6} width={WHITE_KEY_WIDTH - 1} height={WHITE_KEY_HEIGHT}
          fill="none" stroke="#F5B848" strokeWidth={2.5} rx="2" />
      ))}
      {chordMidiSet.size > 0 && blackKeys.filter(k => k.chordHighlight).map((k, i) => (
        <rect key={`bhl-${i}`} x={k.x} y={6} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
          fill="none" stroke="#F5B848" strokeWidth={2.5} rx="1" />
      ))}
    </svg>
  );
}
