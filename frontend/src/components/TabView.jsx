import { useStore } from '../store/useStore.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { BEAT_WIDTH, LEFT_GUTTER, RIGHT_PADDING } from './trackLayout.js';

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // top (string 1) to bottom (string 6)
const STRING_ROW_HEIGHT = 22;

export default function TabView() {
  const beats = useStore(s => s.beats);

  if (beats.length === 0) {
    return (
      <div className="text-center text-slate-500 py-4 font-mono text-sm">
        (Tab will appear here)
      </div>
    );
  }

  const totalWidth = LEFT_GUTTER + beats.length * BEAT_WIDTH + RIGHT_PADDING;

  // For each string row, build a sparse map: beatIndex → note
  const noteByStringBeat = new Map(); // key: "string-beat" → note
  for (const beat of beats) {
    for (const n of beat.notes) {
      noteByStringBeat.set(`${n.string}-${beat.beatIndex}`, n);
    }
  }

  return (
    <div
      className="font-mono text-sm relative"
      style={{ width: totalWidth, height: STRING_ROW_HEIGHT * 6 + 12, paddingTop: 6 }}
    >
      {STRING_LABELS.map((label, rowIdx) => {
        const stringNumber = rowIdx + 1;
        const y = rowIdx * STRING_ROW_HEIGHT;
        return (
          <div
            key={stringNumber}
            className="absolute left-0 right-0 flex items-center"
            style={{ top: y + 6, height: STRING_ROW_HEIGHT }}
          >
            {/* String label — aligned with clef area */}
            <span
              className="text-slate-400 absolute"
              style={{ left: 8, width: 16, textAlign: 'right' }}
            >
              {label}
            </span>
            {/* The "string line" */}
            <div
              className="absolute"
              style={{
                left: LEFT_GUTTER,
                right: 0,
                top: STRING_ROW_HEIGHT / 2,
                height: 1,
                backgroundColor: '#334155',
              }}
            />
            {/* Fret cells per beat */}
            {beats.map(beat => {
              const note = noteByStringBeat.get(`${stringNumber}-${beat.beatIndex}`);
              const left = LEFT_GUTTER + beat.beatIndex * BEAT_WIDTH;
              if (!note) {
                return null;
              }
              const open = isOpen(note.finger);
              const color = getFingerColor(note.finger);
              return (
                <span
                  key={`${stringNumber}-${beat.beatIndex}`}
                  className="absolute font-bold"
                  style={{
                    left: left + BEAT_WIDTH / 2 - 10,
                    width: 20,
                    textAlign: 'center',
                    color: color,
                    backgroundColor: '#0f172a',
                    paddingLeft: 2,
                    paddingRight: 2,
                    border: open ? `1px solid ${color}` : 'none',
                    borderRadius: open ? 8 : 0,
                  }}
                  title={`${note.note}${note.octave} (finger ${note.finger})`}
                >
                  {note.fret}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
