import { useStore } from '../store/useStore.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { noteToMidi } from '../utils/musicTheory.js';

const WHITE_KEY_WIDTH = 50;
const WHITE_KEY_HEIGHT = 180;
const BLACK_KEY_WIDTH = 32;
const BLACK_KEY_HEIGHT = 115;

const START_OCTAVE = 3;
const NUM_OCTAVES = 2;

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEY_OFFSETS = {
  'C#': 0,
  'D#': 1,
  'F#': 3,
  'G#': 4,
  'A#': 5,
};

export default function Piano() {
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const activeBeat = beats[currentBeat];
  const activeNotes = activeBeat?.notes || [];

  const totalWhiteKeys = NUM_OCTAVES * 7;
  const width = totalWhiteKeys * WHITE_KEY_WIDTH + 4;
  const height = WHITE_KEY_HEIGHT + 8;

  // Build active map by midi → finger
  const activeByMidi = new Map();
  for (const n of activeNotes) {
    const midi = noteToMidi(n.note, n.octave);
    if (midi != null) activeByMidi.set(midi, n);
  }

  const whiteKeys = [];
  const blackKeys = [];

  for (let oct = 0; oct < NUM_OCTAVES; oct++) {
    const octave = START_OCTAVE + oct;
    WHITE_NOTES.forEach((note, i) => {
      const x = (oct * 7 + i) * WHITE_KEY_WIDTH + 2;
      const midi = noteToMidi(note, octave);
      whiteKeys.push({ note, octave, x, midi, active: activeByMidi.get(midi) });
    });
    Object.entries(BLACK_KEY_OFFSETS).forEach(([note, whiteIdx]) => {
      const x = (oct * 7 + whiteIdx + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2 + 2;
      const midi = noteToMidi(note, octave);
      blackKeys.push({ note, octave, x, midi, active: activeByMidi.get(midi) });
    });
  }

  return (
    <svg width={width} height={height} className="block">
      {/* White keys */}
      {whiteKeys.map((k, i) => {
        const fill = k.active ? getFingerColor(k.active.finger) : '#ffffff';
        const open = k.active && isOpen(k.active.finger);
        return (
          <g key={`w-${i}`}>
            <rect
              x={k.x}
              y={4}
              width={WHITE_KEY_WIDTH - 2}
              height={WHITE_KEY_HEIGHT}
              fill={open ? '#ffffff' : fill}
              stroke={k.active && open ? getFingerColor(0) : '#1e293b'}
              strokeWidth={k.active && open ? 4 : 2}
              rx="3"
            />
            <text
              x={k.x + WHITE_KEY_WIDTH / 2 - 1}
              y={WHITE_KEY_HEIGHT - 8}
              fill={k.active && !open ? '#ffffff' : '#475569'}
              fontSize="13"
              fontWeight="600"
              textAnchor="middle"
            >
              {k.active && !open ? k.active.finger : `${k.note}${k.octave}`}
            </text>
          </g>
        );
      })}

      {/* Black keys */}
      {blackKeys.map((k, i) => {
        const fill = k.active ? getFingerColor(k.active.finger) : '#0f172a';
        return (
          <g key={`b-${i}`}>
            <rect
              x={k.x}
              y={4}
              width={BLACK_KEY_WIDTH}
              height={BLACK_KEY_HEIGHT}
              fill={fill}
              stroke="#0f172a"
              strokeWidth="2"
              rx="2"
            />
            {k.active && (
              <text
                x={k.x + BLACK_KEY_WIDTH / 2}
                y={BLACK_KEY_HEIGHT - 8}
                fill="#ffffff"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
              >
                {k.active.finger || k.note}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
