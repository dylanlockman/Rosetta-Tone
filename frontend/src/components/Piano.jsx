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
// White keys: A0, B0, then C1-B7 (7*7=49), then C8 = 2 + 49 + 1 = 52
// Build the full key list once
function build88Keys() {
  const whites = [];
  const blacks = [];
  let whiteIdx = 0;

  // A0, B0 (partial first octave — no C0/D0/E0/F0/G0 on a real piano)
  for (const note of ['A', 'B']) {
    whites.push({ note, octave: 0, whiteIdx });
    whiteIdx++;
  }
  // A#0 / Bb0
  blacks.push({ note: 'A#', octave: 0, afterWhiteIdx: 0 }); // after A0

  // Full octaves 1-7
  for (let oct = 1; oct <= 7; oct++) {
    WHITE_NOTES.forEach((note) => {
      whites.push({ note, octave: oct, whiteIdx });
      whiteIdx++;
    });
    Object.entries(BLACK_KEY_OFFSETS).forEach(([note, offset]) => {
      // The black key sits after the white key at position (octaveStart + offset)
      const octStart = 2 + (oct - 1) * 7; // whiteIdx where this octave starts
      blacks.push({ note, octave: oct, afterWhiteIdx: octStart + offset });
    });
  }

  // C8 (final key)
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
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#1e293b" strokeWidth={1} rx={rx} />
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
        // Highlight this pitch class in all octaves on the piano
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
  const height = WHITE_KEY_HEIGHT + 8;

  // Build active map by midi (song mode)
  const activeByMidi = useMemo(() => {
    const map = new Map();
    if (!scaleViewActive) {
      for (const n of activeNotes) {
        const midi = noteToMidi(n.note, n.octave);
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
    // CAGED position filter doesn't directly apply to piano (it's a guitar concept)
    // but we can filter by which notes appear in the selected position's fret range
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

  const whiteKeys = KEYS_88.whites.map((k, i) => {
    const x = k.whiteIdx * WHITE_KEY_WIDTH + 2;
    const midi = noteToMidi(k.note, k.octave);
    const runInfo = scaleViewActive ? getRunInfo(scaleOctaveRuns, k.note, k.octave) : null;
    const filtered = scaleViewActive && runInfo && !passesFilter(k.note, k.octave);
    const chordHighlight = chordMidiSet.size > 0 && chordMidiSet.has(midi);
    return { ...k, x, midi, active: activeByMidi.get(midi), runInfo, filtered, chordHighlight };
  });

  const blackKeys = KEYS_88.blacks.map((k, i) => {
    const x = (k.afterWhiteIdx + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2 + 2;
    const midi = noteToMidi(k.note, k.octave);
    const runInfo = scaleViewActive ? getRunInfo(scaleOctaveRuns, k.note, k.octave) : null;
    const filtered = scaleViewActive && runInfo && !passesFilter(k.note, k.octave);
    const chordHighlight = chordMidiSet.size > 0 && chordMidiSet.has(midi);
    return { ...k, x, midi, active: activeByMidi.get(midi), runInfo, filtered, chordHighlight };
  });

  // Show label only on C keys for compactness
  const showLabel = (note, octave) => note === 'C';

  return (
    <svg width={width} height={height} className="block">
      {/* White keys */}
      {whiteKeys.map((k, i) => {
        const kw = WHITE_KEY_WIDTH - 1;
        const label = showLabel(k.note, k.octave) ? `C${k.octave}` : '';

        // Scale mode — in scale
        if (scaleViewActive && k.runInfo) {
          if (k.filtered) {
            return (
              <g key={`w-${i}`}>
                <rect x={k.x} y={4} width={kw} height={WHITE_KEY_HEIGHT}
                  fill="#d1d5db" stroke="#1e293b" strokeWidth={1} rx="2" opacity={0.3} />
              </g>
            );
          }
          if (k.runInfo.isBoundary) {
            return (
              <g key={`w-${i}`}>
                <SplitKey x={k.x} y={4} w={kw} h={WHITE_KEY_HEIGHT}
                  color1={getOctaveColor(k.runInfo.prevRunIndex)}
                  color2={getOctaveColor(k.runInfo.runIndex)} id={`pw-${i}`} />
                {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 3}
                  fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
              </g>
            );
          }
          return (
            <g key={`w-${i}`}>
              <rect x={k.x} y={4} width={kw} height={WHITE_KEY_HEIGHT}
                fill={getOctaveColor(k.runInfo.runIndex)} stroke="#1e293b" strokeWidth={1} rx="2" />
              {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 3}
                fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
            </g>
          );
        }

        // Scale mode — not in scale
        if (scaleViewActive) {
          return (
            <g key={`w-${i}`}>
              <rect x={k.x} y={4} width={kw} height={WHITE_KEY_HEIGHT}
                fill="#e2e8f0" stroke="#1e293b" strokeWidth={1} rx="2" opacity={0.4} />
              {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 3}
                fill="#94a3b8" fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
            </g>
          );
        }

        // Song mode
        const fill = k.active ? getFingerColor(k.active.finger) : '#ffffff';
        const open = k.active && isOpen(k.active.finger);
        return (
          <g key={`w-${i}`}>
            <rect x={k.x} y={4} width={kw} height={WHITE_KEY_HEIGHT}
              fill={open ? '#ffffff' : fill}
              stroke={k.active && open ? getFingerColor(0) : '#1e293b'}
              strokeWidth={k.active && open ? 2 : 1} rx="2" />
            {label && <text x={k.x + kw / 2} y={WHITE_KEY_HEIGHT - 3}
              fill={k.active && !open ? '#fff' : '#475569'}
              fontSize="8" fontWeight="600" textAnchor="middle">{label}</text>}
          </g>
        );
      })}

      {/* Black keys */}
      {blackKeys.map((k, i) => {
        if (scaleViewActive && k.runInfo) {
          if (k.filtered) {
            return (
              <g key={`b-${i}`}>
                <rect x={k.x} y={4} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                  fill="#1e293b" stroke="#0f172a" strokeWidth="1" rx="1" opacity={0.3} />
              </g>
            );
          }
          if (k.runInfo.isBoundary) {
            return (
              <g key={`b-${i}`}>
                <SplitKey x={k.x} y={4} w={BLACK_KEY_WIDTH} h={BLACK_KEY_HEIGHT}
                  color1={getOctaveColor(k.runInfo.prevRunIndex)}
                  color2={getOctaveColor(k.runInfo.runIndex)} id={`pb-${i}`} rx={1} />
              </g>
            );
          }
          return (
            <g key={`b-${i}`}>
              <rect x={k.x} y={4} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                fill={getOctaveColor(k.runInfo.runIndex)} stroke="#0f172a" strokeWidth="1" rx="1" />
            </g>
          );
        }

        if (scaleViewActive) {
          return (
            <g key={`b-${i}`}>
              <rect x={k.x} y={4} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
                fill="#0f172a" stroke="#0f172a" strokeWidth="1" rx="1" opacity={0.3} />
            </g>
          );
        }

        const fill = k.active ? getFingerColor(k.active.finger) : '#0f172a';
        return (
          <g key={`b-${i}`}>
            <rect x={k.x} y={4} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
              fill={fill} stroke="#0f172a" strokeWidth="1" rx="1" />
          </g>
        );
      })}

      {/* Chord highlight overlays — bright ring on keys belonging to selected chord */}
      {chordMidiSet.size > 0 && whiteKeys.filter(k => k.chordHighlight).map((k, i) => (
        <rect key={`whl-${i}`} x={k.x} y={4} width={WHITE_KEY_WIDTH - 1} height={WHITE_KEY_HEIGHT}
          fill="none" stroke="#22d3ee" strokeWidth={2.5} rx="2" />
      ))}
      {chordMidiSet.size > 0 && blackKeys.filter(k => k.chordHighlight).map((k, i) => (
        <rect key={`bhl-${i}`} x={k.x} y={4} width={BLACK_KEY_WIDTH} height={BLACK_KEY_HEIGHT}
          fill="none" stroke="#22d3ee" strokeWidth={2.5} rx="1" />
      ))}
    </svg>
  );
}
