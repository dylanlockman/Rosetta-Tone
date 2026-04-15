import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { STANDARD_TUNING, fretToNote, noteToMidi } from '../utils/musicTheory.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { getRunInfo, getOctaveColor } from '../utils/scaleColors.js';

const NUM_FRETS = 24;
const FRET_WIDTH = 36;
const STRING_SPACING = 24;
const LEFT_MARGIN = 20;
const TOP_MARGIN = 20;
const DOT_RADIUS = 10;

const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAY_FRETS = [12, 24];

function SplitDot({ cx, cy, r, color1, color2, label, id }) {
  return (
    <g>
      <defs>
        <clipPath id={`split-tl-${id}`}>
          <polygon points={`${cx - r},${cy - r} ${cx + r},${cy - r} ${cx - r},${cy + r}`} />
        </clipPath>
        <clipPath id={`split-br-${id}`}>
          <polygon points={`${cx + r},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={color1} clipPath={`url(#split-tl-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill={color2} clipPath={`url(#split-br-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0f172a" strokeWidth={2} />
      <text
        x={cx} y={cy + 4} fill="#ffffff" fontSize="10" fontWeight="700"
        textAnchor="middle" fontFamily="ui-sans-serif, system-ui"
      >{label}</text>
    </g>
  );
}

function ScaleDot({ pos, scaleOctaveRuns }) {
  const cx = pos.fret === 0
    ? LEFT_MARGIN - 26
    : LEFT_MARGIN + pos.fret * FRET_WIDTH - FRET_WIDTH / 2;
  const cy = TOP_MARGIN + pos.stringIdx * STRING_SPACING;

  if (pos.dimmed) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={DOT_RADIUS}
          fill={pos.fret === 0 ? 'transparent' : '#475569'} stroke="#334155"
          strokeWidth={1.5} opacity={0.35} />
        <text x={cx} y={cy + 4} fill="#64748b" fontSize="9" fontWeight="600"
          textAnchor="middle" fontFamily="ui-sans-serif, system-ui" opacity={0.5}
        >{pos.pitchClass}</text>
      </g>
    );
  }

  if (pos.isBoundary) {
    return (
      <SplitDot
        cx={cx} cy={cy} r={DOT_RADIUS}
        color1={getOctaveColor(pos.prevRunIndex)}
        color2={getOctaveColor(pos.runIndex)}
        label={pos.pitchClass}
        id={`fb-${pos.stringIdx}-${pos.fret}`}
      />
    );
  }

  const color = getOctaveColor(pos.runIndex);
  return (
    <g>
      <circle cx={cx} cy={cy} r={DOT_RADIUS}
        fill={pos.fret === 0 ? 'transparent' : color}
        stroke={pos.fret === 0 ? color : '#0f172a'}
        strokeWidth={pos.fret === 0 ? 2.5 : 2} />
      <text x={cx} y={cy + 4}
        fill={pos.fret === 0 ? color : '#ffffff'}
        fontSize="10" fontWeight="700"
        textAnchor="middle" fontFamily="ui-sans-serif, system-ui"
      >{pos.pitchClass}</text>
    </g>
  );
}

export default function Fretboard() {
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const scaleViewActive = useStore(s => s.scaleViewActive);
  const activeScale = useStore(s => s.activeScale);
  const scaleOctaveRuns = useStore(s => s.scaleOctaveRuns);
  const scaleViewMode = useStore(s => s.scaleViewMode);
  const cagedPositions = useStore(s => s.cagedPositions);
  const diagonalPatterns = useStore(s => s.diagonalPatterns);
  const selectedCagedPosition = useStore(s => s.selectedCagedPosition);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);
  const selectedScaleChord = useStore(s => s.selectedScaleChord);
  const activeBeat = beats[currentBeat];
  const activeNotes = activeBeat?.notes || [];

  const width = LEFT_MARGIN + (NUM_FRETS + 1) * FRET_WIDTH + 20;
  const height = TOP_MARGIN * 2 + 5 * STRING_SPACING;

  // Song mode: map of "string-fret" → note
  const activeMap = new Map();
  if (!scaleViewActive) {
    for (const n of activeNotes) {
      activeMap.set(`${n.string}-${n.fret}`, n);
    }
  }

  // All scale positions on the fretboard
  const allScalePositions = useMemo(() => {
    if (!scaleViewActive || !activeScale || scaleOctaveRuns.length === 0) return [];
    const positions = [];
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
      const stringNumber = stringIdx + 1;
      for (let fret = 0; fret <= NUM_FRETS; fret++) {
        const noteInfo = fretToNote(stringNumber, fret);
        if (!noteInfo) continue;
        const runInfo = getRunInfo(scaleOctaveRuns, noteInfo.note, noteInfo.octave);
        if (!runInfo) continue;
        positions.push({
          stringIdx,
          string: stringNumber,
          fret,
          pitchClass: noteInfo.note,
          octave: noteInfo.octave,
          midi: noteToMidi(noteInfo.note, noteInfo.octave),
          ...runInfo,
        });
      }
    }
    return positions;
  }, [scaleViewActive, activeScale, scaleOctaveRuns]);

  // Apply view mode + filters to determine which notes are highlighted vs dimmed
  const filteredPositions = useMemo(() => {
    if (!scaleViewActive || allScalePositions.length === 0) return [];

    // Build the set of "active" positions based on view mode
    let activeSet = null; // null = show all

    if (scaleViewMode === 'vertical' && cagedPositions.length > 0) {
      // In vertical mode, if a CAGED position is selected show only that box,
      // otherwise show all but group by position
      if (selectedCagedPosition !== null && cagedPositions[selectedCagedPosition]) {
        const pos = cagedPositions[selectedCagedPosition];
        activeSet = new Set(pos.notes.map(n => `${n.string}-${n.fret}`));
      }
    } else if (scaleViewMode === 'diagonal' && diagonalPatterns.length > 0) {
      // In diagonal mode, if a position is selected show only that pattern
      if (selectedCagedPosition !== null && diagonalPatterns[selectedCagedPosition]) {
        const pat = diagonalPatterns[selectedCagedPosition];
        activeSet = new Set(pat.notes.map(n => `${n.string}-${n.fret}`));
      }
    }

    return allScalePositions.map(pos => {
      let dimmed = false;

      // Filter by view mode position
      if (activeSet && !activeSet.has(`${pos.string}-${pos.fret}`)) {
        dimmed = true;
      }

      // Filter by octave run
      if (selectedOctaveRun !== null) {
        const matchesRun = pos.runIndex === selectedOctaveRun ||
          (pos.isBoundary && pos.prevRunIndex === selectedOctaveRun);
        if (!matchesRun) dimmed = true;
      }

      return { ...pos, dimmed };
    });
  }, [allScalePositions, scaleViewMode, cagedPositions, diagonalPatterns,
      selectedCagedPosition, selectedOctaveRun]);

  return (
    <svg width={width} height={height} className="block">
      {/* Fretboard background */}
      <rect
        x={LEFT_MARGIN} y={TOP_MARGIN - 8}
        width={(NUM_FRETS + 1) * FRET_WIDTH} height={5 * STRING_SPACING + 16}
        fill="#3a2616" rx="4"
      />

      {/* Inlay dots */}
      {INLAY_FRETS.map(fret => (
        <circle key={`inlay-${fret}`}
          cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
          cy={TOP_MARGIN + 2.5 * STRING_SPACING} r={5} fill="#8a7560" />
      ))}
      {DOUBLE_INLAY_FRETS.map(fret => (
        <g key={`dinlay-${fret}`}>
          <circle cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
            cy={TOP_MARGIN + 1.5 * STRING_SPACING} r={5} fill="#8a7560" />
          <circle cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
            cy={TOP_MARGIN + 3.5 * STRING_SPACING} r={5} fill="#8a7560" />
        </g>
      ))}

      {/* CAGED position highlight box (vertical mode) */}
      {scaleViewActive && scaleViewMode === 'vertical' && selectedCagedPosition !== null &&
       cagedPositions[selectedCagedPosition] && (() => {
        const pos = cagedPositions[selectedCagedPosition];
        const x = LEFT_MARGIN + (pos.startFret > 0 ? pos.startFret - 0.5 : 0) * FRET_WIDTH;
        const w = (pos.endFret - (pos.startFret > 0 ? pos.startFret : 0) + 1) * FRET_WIDTH;
        return (
          <rect x={x} y={TOP_MARGIN - 10} width={w} height={5 * STRING_SPACING + 20}
            fill="rgba(34,211,238,0.08)" stroke="#22d3ee" strokeWidth={1}
            strokeDasharray="4 2" rx="4" />
        );
      })()}

      {/* Frets */}
      {Array.from({ length: NUM_FRETS + 1 }).map((_, i) => (
        <line key={`fret-${i}`}
          x1={LEFT_MARGIN + i * FRET_WIDTH} y1={TOP_MARGIN}
          x2={LEFT_MARGIN + i * FRET_WIDTH} y2={TOP_MARGIN + 5 * STRING_SPACING}
          stroke={i === 0 ? '#f5f5f5' : '#bcbcbc'}
          strokeWidth={i === 0 ? 5 : 2} />
      ))}

      {/* Strings */}
      {STANDARD_TUNING.map((open, idx) => (
        <g key={`string-${idx + 1}`}>
          <line x1={LEFT_MARGIN} y1={TOP_MARGIN + idx * STRING_SPACING}
            x2={LEFT_MARGIN + (NUM_FRETS + 1) * FRET_WIDTH}
            y2={TOP_MARGIN + idx * STRING_SPACING}
            stroke="#dcdcdc" strokeWidth={1 + idx * 0.4} />
          <text x={LEFT_MARGIN - 12} y={TOP_MARGIN + idx * STRING_SPACING + 4}
            fill="#cbd5e1" fontSize="13" textAnchor="end"
            fontFamily="ui-monospace, monospace">{open.note}</text>
        </g>
      ))}

      {/* Scale mode */}
      {scaleViewActive && filteredPositions.map((pos, i) => (
        <ScaleDot key={`scale-${pos.stringIdx}-${pos.fret}`}
          pos={pos} scaleOctaveRuns={scaleOctaveRuns} />
      ))}

      {/* Song mode */}
      {!scaleViewActive && Array.from(activeMap.values()).map((n, i) => {
        const stringIdx = n.string - 1;
        const noteInfo = n.note ? n : fretToNote(n.string, n.fret);
        const noteName = noteInfo?.note || '';
        const cx = n.fret === 0
          ? LEFT_MARGIN - 26
          : LEFT_MARGIN + n.fret * FRET_WIDTH - FRET_WIDTH / 2;
        const cy = TOP_MARGIN + stringIdx * STRING_SPACING;
        const open = isOpen(n.finger);
        const color = getFingerColor(n.finger);
        return (
          <g key={`note-${n.string}-${n.fret}-${i}`}>
            <circle cx={cx} cy={cy} r={DOT_RADIUS}
              fill={open ? 'transparent' : color}
              stroke={open ? color : '#0f172a'}
              strokeWidth={open ? 2.5 : 2} />
            <text x={cx} y={cy + 4}
              fill={open ? color : '#ffffff'}
              fontSize="11" fontWeight="700"
              textAnchor="middle" fontFamily="ui-sans-serif, system-ui"
            >{open ? noteName : (n.finger || '')}</text>
          </g>
        );
      })}

      {/* Chord highlight — when a chord voicing is selected, show its fret positions */}
      {selectedScaleChord?.fingering && selectedScaleChord.fingering.map((f, i) => {
        if (f.fret < 0) return null;
        const stringIdx = f.string - 1;
        const cx = f.fret === 0
          ? LEFT_MARGIN - 26
          : LEFT_MARGIN + f.fret * FRET_WIDTH - FRET_WIDTH / 2;
        const cy = TOP_MARGIN + stringIdx * STRING_SPACING;
        return (
          <g key={`chord-hl-${i}`}>
            <circle cx={cx} cy={cy} r={DOT_RADIUS + 2}
              fill="none" stroke="#22d3ee" strokeWidth={2.5} />
            <circle cx={cx} cy={cy} r={DOT_RADIUS}
              fill="#22d3ee" stroke="#0f172a" strokeWidth={1.5} opacity={0.85} />
            <text x={cx} y={cy + 4}
              fill="#fff" fontSize="9" fontWeight="700"
              textAnchor="middle" fontFamily="ui-sans-serif, system-ui"
            >{f.finger > 0 ? f.finger : ''}</text>
          </g>
        );
      })}
    </svg>
  );
}
