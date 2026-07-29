import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { STANDARD_TUNING, fretToNote, noteToMidi } from '../utils/musicTheory.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { getRunInfo, getOctaveColor } from '../utils/scaleColors.js';
import { candidatesForMidi } from '../utils/fretInference.js';

const NUM_FRETS = 24;
const FRET_WIDTH = 36;
const STRING_SPACING = 24;
const LEFT_MARGIN = 52;   // nut position — leaves room for labels + full open-string dots
const OPEN_X = 30;        // center of open-string dots (halo fits: 30 ± 15)
const TOP_MARGIN = 22;
const DOT_RADIUS = 10;

const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAY_FRETS = [12, 24];
const NUMBERED_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

// Wound strings (low E, A, D) get a brass tint; plain strings are steel.
const STRING_COLORS = ['#C9CDD4', '#C9CDD4', '#C9CDD4', '#C79F63', '#BE9354', '#B58745'];

function noteX(fret) {
  return fret === 0 ? OPEN_X : LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2;
}

function SplitDot({ cx, cy, r, color1, color2, label, id, onHover }) {
  return (
    <g className="note-transition" {...onHover}>
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0B0C10" strokeWidth={2} />
      <text
        x={cx} y={cy + 3.5} fill="#ffffff" fontSize="9.5" fontWeight="700"
        textAnchor="middle" fontFamily='"Instrument Sans", sans-serif'
      >{label}</text>
    </g>
  );
}

function ScaleDot({ pos, onHover }) {
  const cx = noteX(pos.fret);
  const cy = TOP_MARGIN + pos.stringIdx * STRING_SPACING;

  if (pos.dimmed) {
    return (
      <g className="note-transition" {...onHover}>
        <circle cx={cx} cy={cy} r={DOT_RADIUS - 2}
          fill={pos.fret === 0 ? 'transparent' : '#262B38'} stroke="#333A4A"
          strokeWidth={1} opacity={0.45} />
        <text x={cx} y={cy + 3.5} fill="#5C6272" fontSize="8.5" fontWeight="600"
          textAnchor="middle" fontFamily='"Instrument Sans", sans-serif' opacity={0.6}
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
        onHover={onHover}
      />
    );
  }

  const color = getOctaveColor(pos.runIndex);
  return (
    <g className="note-transition" {...onHover}>
      <circle cx={cx} cy={cy} r={DOT_RADIUS}
        fill={pos.fret === 0 ? 'rgba(11,12,16,0.75)' : color}
        stroke={pos.fret === 0 ? color : '#0B0C10'}
        strokeWidth={pos.fret === 0 ? 2.5 : 2} />
      <text x={cx} y={cy + 3.5}
        fill={pos.fret === 0 ? color : '#ffffff'}
        fontSize="9.5" fontWeight="700"
        textAnchor="middle" fontFamily='"Instrument Sans", sans-serif'
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
  const scalePlayhead = useStore(s => s.scalePlayhead);
  const hoverMidi = useStore(s => s.hoverMidi);
  const setHoverMidi = useStore(s => s.setHoverMidi);
  const score = useStore(s => s.score);
  const transpose = useStore(s => s.transpose);
  const activeBeat = beats[currentBeat];
  const activeNotes = activeBeat?.notes || [];

  // Capo bar position: the source capo plus any capo-style key shift.
  // Everything at this fret plays "open".
  const capoFret = !scaleViewActive
    ? Math.max(0, (score?.meta?.capo ?? 0) + transpose)
    : 0;

  const width = LEFT_MARGIN + (NUM_FRETS + 1) * FRET_WIDTH + 16;
  const height = TOP_MARGIN * 2 + 5 * STRING_SPACING + 14;
  const neckTop = TOP_MARGIN - 10;
  const neckHeight = 5 * STRING_SPACING + 20;

  const hoverProps = (midi) => ({
    onMouseEnter: () => setHoverMidi(midi),
    onMouseLeave: () => setHoverMidi(null),
    style: { cursor: 'crosshair' },
  });

  // Song mode: map of "string-fret" → note. Notes without a fret position
  // (out-of-range piano notes from MusicXML/MIDI) only appear on the piano.
  const activeMap = new Map();
  if (!scaleViewActive) {
    for (const n of activeNotes) {
      if (n.string == null || n.fret == null) continue;
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

    let activeSet = null; // null = show all

    if (scaleViewMode === 'vertical' && cagedPositions.length > 0) {
      if (selectedCagedPosition !== null && cagedPositions[selectedCagedPosition]) {
        const pos = cagedPositions[selectedCagedPosition];
        activeSet = new Set(pos.notes.map(n => `${n.string}-${n.fret}`));
      }
    } else if (scaleViewMode === 'diagonal' && diagonalPatterns.length > 0) {
      if (selectedCagedPosition !== null && diagonalPatterns[selectedCagedPosition]) {
        const pat = diagonalPatterns[selectedCagedPosition];
        activeSet = new Set(pat.notes.map(n => `${n.string}-${n.fret}`));
      }
    }

    return allScalePositions.map(pos => {
      let dimmed = false;
      if (activeSet && !activeSet.has(`${pos.string}-${pos.fret}`)) {
        dimmed = true;
      }
      if (selectedOctaveRun !== null) {
        const matchesRun = pos.runIndex === selectedOctaveRun ||
          (pos.isBoundary && pos.prevRunIndex === selectedOctaveRun);
        if (!matchesRun) dimmed = true;
      }
      return { ...pos, dimmed };
    });
  }, [allScalePositions, scaleViewMode, cagedPositions, diagonalPatterns,
      selectedCagedPosition, selectedOctaveRun]);

  const playheadNote = scaleViewActive ? scalePlayhead?.note : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
         className="block w-full h-full">
      <defs>
        {/* Ebony neck with a subtle sheen */}
        <linearGradient id="neckGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#191410" />
          <stop offset="0.5" stopColor="#221B14" />
          <stop offset="1" stopColor="#171310" />
        </linearGradient>
        <linearGradient id="fretGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7A808C" />
          <stop offset="0.5" stopColor="#AEB4BF" />
          <stop offset="1" stopColor="#70767F" />
        </linearGradient>
        <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Neck */}
      <rect
        x={LEFT_MARGIN} y={neckTop}
        width={(NUM_FRETS + 1) * FRET_WIDTH} height={neckHeight}
        fill="url(#neckGrad)" rx="5"
      />
      <rect
        x={LEFT_MARGIN} y={neckTop}
        width={(NUM_FRETS + 1) * FRET_WIDTH} height={3}
        fill="rgba(255,255,255,0.05)" rx="2"
      />
      <rect
        x={LEFT_MARGIN} y={neckTop + neckHeight - 3}
        width={(NUM_FRETS + 1) * FRET_WIDTH} height={3}
        fill="rgba(0,0,0,0.4)" rx="2"
      />

      {/* Inlays */}
      {INLAY_FRETS.map(fret => (
        <circle key={`inlay-${fret}`}
          cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
          cy={TOP_MARGIN + 2.5 * STRING_SPACING} r={4.5}
          fill="rgba(236,234,228,0.10)" />
      ))}
      {DOUBLE_INLAY_FRETS.map(fret => (
        <g key={`dinlay-${fret}`}>
          <circle cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
            cy={TOP_MARGIN + 1.5 * STRING_SPACING} r={4.5} fill="rgba(236,234,228,0.10)" />
          <circle cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
            cy={TOP_MARGIN + 3.5 * STRING_SPACING} r={4.5} fill="rgba(236,234,228,0.10)" />
        </g>
      ))}

      {/* CAGED position highlight box (vertical mode) */}
      {scaleViewActive && scaleViewMode === 'vertical' && selectedCagedPosition !== null &&
       cagedPositions[selectedCagedPosition] && (() => {
        const pos = cagedPositions[selectedCagedPosition];
        const x = LEFT_MARGIN + (pos.startFret > 0 ? pos.startFret - 0.5 : 0) * FRET_WIDTH;
        const w = (pos.endFret - (pos.startFret > 0 ? pos.startFret : 0) + 1) * FRET_WIDTH;
        return (
          <rect x={x} y={neckTop - 2} width={w} height={neckHeight + 4}
            fill="rgba(245,184,72,0.06)" stroke="#F5B848" strokeWidth={1}
            strokeDasharray="5 3" rx="5" opacity={0.8} />
        );
      })()}

      {/* Nut (bone) + frets (nickel) */}
      {Array.from({ length: NUM_FRETS + 1 }).map((_, i) => (
        i === 0 ? (
          <rect key="nut"
            x={LEFT_MARGIN - 2} y={neckTop + 2}
            width={5} height={neckHeight - 4}
            fill="#E4DCC8" rx="1.5" />
        ) : (
          <rect key={`fret-${i}`}
            x={LEFT_MARGIN + i * FRET_WIDTH - 1} y={neckTop + 2}
            width={2} height={neckHeight - 4}
            fill="url(#fretGrad)" opacity={0.85} />
        )
      ))}

      {/* Fret numbers */}
      {NUMBERED_FRETS.map(fret => (
        <text key={`fnum-${fret}`}
          x={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
          y={neckTop + neckHeight + 12}
          fill="#5C6272" fontSize="9" fontWeight="500" textAnchor="middle"
          fontFamily='"JetBrains Mono", monospace'
        >{fret}</text>
      ))}

      {/* Capo bar — the clamp across the neck; this fret is now "open" */}
      {capoFret > 0 && capoFret <= NUM_FRETS && (() => {
        const cx = LEFT_MARGIN + capoFret * FRET_WIDTH - FRET_WIDTH + 6;
        return (
          <g>
            <rect x={cx} y={neckTop - 6}
              width={9} height={neckHeight + 12}
              rx={4.5} fill="#1D2027" stroke="#F5B848" strokeWidth={1.5} />
            <rect x={cx + 2.5} y={neckTop - 2}
              width={4} height={neckHeight + 4}
              rx={2} fill="rgba(245,184,72,0.35)" />
            <text x={cx + 4.5} y={neckTop - 11}
              fill="#F5B848" fontSize="8.5" fontWeight="700" textAnchor="middle"
              fontFamily='"JetBrains Mono", monospace'
            >CAPO</text>
          </g>
        );
      })()}

      {/* Strings */}
      {STANDARD_TUNING.map((open, idx) => (
        <g key={`string-${idx + 1}`}>
          <line x1={LEFT_MARGIN} y1={TOP_MARGIN + idx * STRING_SPACING + 1}
            x2={LEFT_MARGIN + (NUM_FRETS + 1) * FRET_WIDTH}
            y2={TOP_MARGIN + idx * STRING_SPACING + 1}
            stroke="rgba(0,0,0,0.5)" strokeWidth={1 + idx * 0.4} />
          <line x1={LEFT_MARGIN} y1={TOP_MARGIN + idx * STRING_SPACING}
            x2={LEFT_MARGIN + (NUM_FRETS + 1) * FRET_WIDTH}
            y2={TOP_MARGIN + idx * STRING_SPACING}
            stroke={STRING_COLORS[idx]} strokeWidth={0.8 + idx * 0.35} />
          <text x={12} y={TOP_MARGIN + idx * STRING_SPACING + 3.5}
            fill="#8A8F9E" fontSize="11" textAnchor="middle" fontWeight="500"
            fontFamily='"JetBrains Mono", monospace'>{open.note}</text>
        </g>
      ))}

      {/* Scale mode */}
      {scaleViewActive && filteredPositions.map((pos) => (
        <ScaleDot key={`scale-${pos.stringIdx}-${pos.fret}`} pos={pos}
          onHover={hoverProps(pos.midi)} />
      ))}

      {/* Cross-highlight: every position matching the hovered pitch */}
      {hoverMidi != null && candidatesForMidi(hoverMidi).map(({ string, fret }) => (
        <circle key={`hover-${string}-${fret}`}
          cx={noteX(fret)} cy={TOP_MARGIN + (string - 1) * STRING_SPACING}
          r={DOT_RADIUS + 3.5} fill="none" stroke="#FFD98A" strokeWidth={1.5}
          strokeDasharray="3 2" style={{ pointerEvents: 'none' }} />
      ))}

      {/* Scale playback: traveling highlight */}
      {scaleViewActive && playheadNote && (
        <g filter="url(#dotGlow)" style={{ pointerEvents: 'none' }}>
          <circle cx={noteX(playheadNote.fret)}
            cy={TOP_MARGIN + (playheadNote.string - 1) * STRING_SPACING}
            r={DOT_RADIUS + 4}
            fill="none" stroke="#FFD98A" strokeWidth={2.5} />
          <circle cx={noteX(playheadNote.fret)}
            cy={TOP_MARGIN + (playheadNote.string - 1) * STRING_SPACING}
            r={DOT_RADIUS + 1.5}
            fill="rgba(255,217,138,0.25)" />
        </g>
      )}

      {/* Song mode */}
      {!scaleViewActive && Array.from(activeMap.values()).map((n, i) => {
        const stringIdx = n.string - 1;
        const noteInfo = n.note ? n : fretToNote(n.string, n.fret);
        const noteName = noteInfo?.note || '';
        const midi = n.midi ?? noteToMidi(noteInfo?.note, noteInfo?.octave);
        const cx = noteX(n.fret);
        const cy = TOP_MARGIN + stringIdx * STRING_SPACING;
        const open = isOpen(n.finger);
        const color = getFingerColor(n.finger);
        return (
          <g key={`note-${n.string}-${n.fret}-${i}`}
             filter={open ? undefined : 'url(#dotGlow)'}
             style={{ animation: 'pop-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
             {...hoverProps(midi)}>
            <circle cx={cx} cy={cy} r={DOT_RADIUS}
              fill={open ? 'rgba(11,12,16,0.75)' : color}
              stroke={open ? color : '#0B0C10'}
              strokeWidth={open ? 2.5 : 2} />
            <text x={cx} y={cy + 4}
              fill={open ? color : '#ffffff'}
              fontSize="10.5" fontWeight="700"
              textAnchor="middle" fontFamily='"Instrument Sans", sans-serif'
            >{open ? noteName : (n.finger || '')}</text>
          </g>
        );
      })}

      {/* Chord highlight — when a chord voicing is selected, show its fret positions */}
      {selectedScaleChord?.fingering && selectedScaleChord.fingering.map((f, i) => {
        if (f.fret < 0) return null;
        const stringIdx = f.string - 1;
        const cx = noteX(f.fret);
        const cy = TOP_MARGIN + stringIdx * STRING_SPACING;
        return (
          <g key={`chord-hl-${i}`}>
            <circle cx={cx} cy={cy} r={DOT_RADIUS + 2}
              fill="none" stroke="#F5B848" strokeWidth={2.5} />
            <circle cx={cx} cy={cy} r={DOT_RADIUS}
              fill="#F5B848" stroke="#0B0C10" strokeWidth={1.5} opacity={0.9} />
            <text x={cx} y={cy + 4}
              fill="#0B0C10" fontSize="9" fontWeight="700"
              textAnchor="middle" fontFamily='"Instrument Sans", sans-serif'
            >{f.finger > 0 ? f.finger : ''}</text>
          </g>
        );
      })}
    </svg>
  );
}
