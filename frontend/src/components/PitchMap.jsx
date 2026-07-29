import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { STANDARD_TUNING, fretToNote, noteToMidi } from '../utils/musicTheory.js';
import { getRunInfo, getOctaveColor } from '../utils/scaleColors.js';

// Pitch Map — the structural answer to "how does the fretboard align to the
// piano?". Each guitar string is a row plotted in TRUE PITCH SPACE: a note's
// x-position is its piano key's x-position, so every fret dot sits directly
// above the key it sounds. Same pitch on different strings stacks into a
// vertical column — one key, many frets.

const WHITE_W = 16;          // white key width in viewBox units
const KEY_STRIP_H = 64;      // mini piano strip height
const BLACK_W = 10;
const BLACK_H = 40;
const ROW_H = 30;            // per-string row height
const TOP = 26;              // headroom for labels
const LEFT = 34;             // room for string letters
const DOT_R = 7.5;

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const MIDI_LO = 21;  // A0
const MIDI_HI = 108; // C8

// x-center of a midi note's key, mirroring the main Piano's geometry:
// white keys on a uniform grid, black keys straddling the boundary.
function buildKeyGeometry() {
  const byMidi = new Map();
  let whiteIdx = 0;
  for (let midi = MIDI_LO; midi <= MIDI_HI; midi++) {
    const pc = midi % 12;
    const note = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][pc];
    const isWhite = WHITE_NOTES.includes(note);
    if (isWhite) {
      byMidi.set(midi, { x: LEFT + whiteIdx * WHITE_W + WHITE_W / 2, white: true, whiteIdx, note });
      whiteIdx++;
    } else {
      // Black key sits on the boundary after the previous white key
      byMidi.set(midi, { x: LEFT + whiteIdx * WHITE_W, white: false, note });
    }
  }
  return { byMidi, whiteCount: whiteIdx };
}

const KEYS = buildKeyGeometry();

export default function PitchMap() {
  const activeScale = useStore(s => s.activeScale);
  const scaleOctaveRuns = useStore(s => s.scaleOctaveRuns);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);
  const scalePlayhead = useStore(s => s.scalePlayhead);
  const hoverMidi = useStore(s => s.hoverMidi);
  const setHoverMidi = useStore(s => s.setHoverMidi);

  const width = LEFT + KEYS.whiteCount * WHITE_W + 12;
  const stringsH = 6 * ROW_H;
  const height = TOP + stringsH + 14 + KEY_STRIP_H + 8;
  const stripY = TOP + stringsH + 14;

  const hoverProps = (midi) => ({
    onMouseEnter: () => setHoverMidi(midi),
    onMouseLeave: () => setHoverMidi(null),
    style: { cursor: 'crosshair' },
  });

  // Every scale position, with pitch-space x and filter state
  const positions = useMemo(() => {
    if (!activeScale || scaleOctaveRuns.length === 0) return [];
    const out = [];
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
      for (let fret = 0; fret <= 24; fret++) {
        const info = fretToNote(stringIdx + 1, fret);
        if (!info) continue;
        const runInfo = getRunInfo(scaleOctaveRuns, info.note, info.octave);
        if (!runInfo) continue;
        const midi = noteToMidi(info.note, info.octave);
        const key = KEYS.byMidi.get(midi);
        if (!key) continue;
        const dimmed = selectedOctaveRun !== null &&
          runInfo.runIndex !== selectedOctaveRun &&
          !(runInfo.isBoundary && runInfo.prevRunIndex === selectedOctaveRun);
        out.push({ stringIdx, fret, midi, x: key.x, ...info, ...runInfo, dimmed });
      }
    }
    return out;
  }, [activeScale, scaleOctaveRuns, selectedOctaveRun]);

  // Scale membership per midi for the key strip
  const runByMidi = useMemo(() => {
    const m = new Map();
    for (const r of scaleOctaveRuns) {
      const midi = noteToMidi(r.pitchClass, r.octave);
      if (midi != null) m.set(midi, r);
    }
    return m;
  }, [scaleOctaveRuns]);

  if (!activeScale) return null;

  const playheadMidi = scalePlayhead?.note?.midi ?? null;
  const guideMidi = hoverMidi ?? playheadMidi;
  const guideX = guideMidi != null ? KEYS.byMidi.get(guideMidi)?.x : null;

  const rowY = (stringIdx) => TOP + stringIdx * ROW_H + ROW_H / 2;

  return (
    <div className="flex-1 min-h-0 p-3 anim-fade-up">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
           className="block w-full h-full">
        {/* Vertical pitch guide through everything */}
        {guideX != null && (
          <line x1={guideX} y1={TOP - 8} x2={guideX} y2={stripY + KEY_STRIP_H}
            stroke="#FFD98A" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.8} />
        )}

        {/* String rows */}
        {STANDARD_TUNING.map((open, stringIdx) => {
          const y = rowY(stringIdx);
          const openMidi = noteToMidi(open.note, open.octave);
          const lo = KEYS.byMidi.get(openMidi)?.x ?? LEFT;
          const hi = KEYS.byMidi.get(Math.min(openMidi + 24, MIDI_HI))?.x ?? width - 12;
          return (
            <g key={`row-${stringIdx}`}>
              {/* The string's playable pitch span */}
              <line x1={lo} y1={y} x2={hi} y2={y}
                stroke="#333A4A" strokeWidth={1.5 + stringIdx * 0.25} />
              <text x={12} y={y + 3.5} fill="#8A8F9E" fontSize="10" fontWeight="500"
                textAnchor="middle" fontFamily='"JetBrains Mono", monospace'>
                {open.note}
              </text>
            </g>
          );
        })}

        {/* Scale dots in pitch space, labeled with fret numbers */}
        {positions.map((p) => {
          const y = rowY(p.stringIdx);
          const isPlayhead = playheadMidi != null && scalePlayhead?.note?.string === p.stringIdx + 1
            && scalePlayhead?.note?.fret === p.fret;
          if (p.dimmed) {
            return (
              <g key={`d-${p.stringIdx}-${p.fret}`} {...hoverProps(p.midi)}>
                <circle cx={p.x} cy={y} r={DOT_R - 2} fill="#1D212B" stroke="#333A4A" strokeWidth={1} opacity={0.5} />
              </g>
            );
          }
          const color = p.isBoundary ? getOctaveColor(p.prevRunIndex) : getOctaveColor(p.runIndex);
          const color2 = getOctaveColor(p.runIndex);
          return (
            <g key={`d-${p.stringIdx}-${p.fret}`} {...hoverProps(p.midi)} className="note-transition">
              <circle cx={p.x} cy={y} r={DOT_R}
                fill={p.isBoundary ? color2 : color}
                stroke={hoverMidi === p.midi ? '#FFD98A' : '#0B0C10'}
                strokeWidth={hoverMidi === p.midi ? 2 : 1.5} />
              <text x={p.x} y={y + 3.5} fill="#fff" fontSize="7.5" fontWeight="700"
                textAnchor="middle" fontFamily='"JetBrains Mono", monospace'>
                {p.fret}
              </text>
              {isPlayhead && (
                <circle cx={p.x} cy={y} r={DOT_R + 3.5} fill="none"
                  stroke="#FFD98A" strokeWidth={2.5} />
              )}
            </g>
          );
        })}

        {/* Mini piano strip */}
        <g>
          {/* White keys */}
          {[...KEYS.byMidi.entries()].filter(([, k]) => k.white).map(([midi, k]) => {
            const run = runByMidi.get(midi);
            const inScale = Boolean(run);
            const isPlayhead = midi === playheadMidi;
            const fill = inScale
              ? getOctaveColor(run.isBoundary ? run.prevRunIndex : run.runIndex)
              : '#ECEAE4';
            const dimmed = inScale && selectedOctaveRun !== null &&
              run.runIndex !== selectedOctaveRun &&
              !(run.isBoundary && run.prevRunIndex === selectedOctaveRun);
            return (
              <g key={`wk-${midi}`} {...hoverProps(midi)}>
                <rect x={k.x - WHITE_W / 2} y={stripY} width={WHITE_W - 1} height={KEY_STRIP_H}
                  fill={fill} opacity={dimmed ? 0.25 : inScale ? 1 : 0.5}
                  stroke="#0B0C10" strokeWidth={1} rx={2} />
                {midi % 12 === 0 && (
                  <text x={k.x} y={stripY + KEY_STRIP_H - 4} fill={inScale ? '#fff' : '#5C6272'}
                    fontSize="7.5" fontWeight="600" textAnchor="middle">
                    C{Math.floor(midi / 12) - 1}
                  </text>
                )}
                {isPlayhead && (
                  <rect x={k.x - WHITE_W / 2} y={stripY} width={WHITE_W - 1} height={KEY_STRIP_H}
                    fill="none" stroke="#FFD98A" strokeWidth={2.5} rx={2} />
                )}
              </g>
            );
          })}
          {/* Black keys */}
          {[...KEYS.byMidi.entries()].filter(([, k]) => !k.white).map(([midi, k]) => {
            const run = runByMidi.get(midi);
            const inScale = Boolean(run);
            const isPlayhead = midi === playheadMidi;
            const fill = inScale
              ? getOctaveColor(run.isBoundary ? run.prevRunIndex : run.runIndex)
              : '#14161B';
            const dimmed = inScale && selectedOctaveRun !== null &&
              run.runIndex !== selectedOctaveRun &&
              !(run.isBoundary && run.prevRunIndex === selectedOctaveRun);
            return (
              <g key={`bk-${midi}`} {...hoverProps(midi)}>
                <rect x={k.x - BLACK_W / 2} y={stripY} width={BLACK_W} height={BLACK_H}
                  fill={fill} opacity={dimmed ? 0.3 : 1}
                  stroke="#0B0C10" strokeWidth={1} rx={1.5} />
                {isPlayhead && (
                  <rect x={k.x - BLACK_W / 2} y={stripY} width={BLACK_W} height={BLACK_H}
                    fill="none" stroke="#FFD98A" strokeWidth={2} rx={1.5} />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
