import { useStore } from '../store/useStore.js';
import { STANDARD_TUNING, fretToNote } from '../utils/musicTheory.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';

const NUM_FRETS = 24;
const FRET_WIDTH = 50;
const STRING_SPACING = 28;
const LEFT_MARGIN = 50;
const TOP_MARGIN = 24;
const DOT_RADIUS = 13;

const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAY_FRETS = [12, 24];

export default function Fretboard() {
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const activeBeat = beats[currentBeat];
  const activeNotes = activeBeat?.notes || [];

  const width = LEFT_MARGIN + (NUM_FRETS + 1) * FRET_WIDTH + 20;
  const height = TOP_MARGIN * 2 + 5 * STRING_SPACING;

  // Map of "string-fret" → note for fast lookup
  const activeMap = new Map();
  for (const n of activeNotes) {
    activeMap.set(`${n.string}-${n.fret}`, n);
  }

  return (
    <svg width={width} height={height} className="block">
      {/* Fretboard background */}
      <rect
        x={LEFT_MARGIN}
        y={TOP_MARGIN - 8}
        width={(NUM_FRETS + 1) * FRET_WIDTH}
        height={5 * STRING_SPACING + 16}
        fill="#3a2616"
        rx="4"
      />

      {/* Inlay dots */}
      {INLAY_FRETS.map(fret => (
        <circle
          key={`inlay-${fret}`}
          cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
          cy={TOP_MARGIN + 2.5 * STRING_SPACING}
          r={5}
          fill="#8a7560"
        />
      ))}
      {DOUBLE_INLAY_FRETS.map(fret => (
        <g key={`dinlay-${fret}`}>
          <circle
            cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
            cy={TOP_MARGIN + 1.5 * STRING_SPACING}
            r={5}
            fill="#8a7560"
          />
          <circle
            cx={LEFT_MARGIN + fret * FRET_WIDTH - FRET_WIDTH / 2}
            cy={TOP_MARGIN + 3.5 * STRING_SPACING}
            r={5}
            fill="#8a7560"
          />
        </g>
      ))}

      {/* Frets */}
      {Array.from({ length: NUM_FRETS + 1 }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={LEFT_MARGIN + i * FRET_WIDTH}
          y1={TOP_MARGIN}
          x2={LEFT_MARGIN + i * FRET_WIDTH}
          y2={TOP_MARGIN + 5 * STRING_SPACING}
          stroke={i === 0 ? '#f5f5f5' : '#bcbcbc'}
          strokeWidth={i === 0 ? 5 : 2}
        />
      ))}

      {/* Strings */}
      {STANDARD_TUNING.map((open, idx) => {
        const stringNumber = idx + 1;
        return (
          <g key={`string-${stringNumber}`}>
            <line
              x1={LEFT_MARGIN}
              y1={TOP_MARGIN + idx * STRING_SPACING}
              x2={LEFT_MARGIN + (NUM_FRETS + 1) * FRET_WIDTH}
              y2={TOP_MARGIN + idx * STRING_SPACING}
              stroke="#dcdcdc"
              strokeWidth={1 + idx * 0.4}
            />
            <text
              x={LEFT_MARGIN - 12}
              y={TOP_MARGIN + idx * STRING_SPACING + 4}
              fill="#cbd5e1"
              fontSize="13"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
            >
              {open.note}
            </text>
          </g>
        );
      })}

      {/* Active notes */}
      {Array.from(activeMap.values()).map((n, i) => {
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
            <circle
              cx={cx}
              cy={cy}
              r={DOT_RADIUS}
              fill={open ? 'transparent' : color}
              stroke={open ? color : '#0f172a'}
              strokeWidth={open ? 2.5 : 2}
            />
            <text
              x={cx}
              y={cy + 4}
              fill={open ? color : '#ffffff'}
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              fontFamily="ui-sans-serif, system-ui"
            >
              {open ? noteName : (n.finger || '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
