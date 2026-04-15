import { getFingerColor } from '../utils/noteColors.js';

const DEFAULTS = {
  numFrets: 4,
  stringSpacing: 14,
  fretSpacing: 18,
  topMargin: 28,
  leftMargin: 16,
  dotRadius: 5,
};

// neutral = use a single color for all dots (no finger-color meaning)
// onSelect = callback when chord box is clicked
// selected = whether this chord box is currently selected
export default function ChordBox({ chord, size = 'md', neutral = false, onSelect, selected = false }) {
  if (!chord || !chord.fingering) return null;

  const scale = size === 'sm' ? 1.0 : size === 'lg' ? 1.5 : 1.2;
  const s = (v) => v * scale;

  const { numFrets, stringSpacing, fretSpacing, topMargin, leftMargin, dotRadius } = DEFAULTS;

  // Determine fret range
  const frettedNotes = chord.fingering.filter(f => f.fret > 0);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes.map(f => f.fret)) : 1;
  const maxFret = frettedNotes.length > 0 ? Math.max(...frettedNotes.map(f => f.fret)) : 1;
  const startFret = maxFret <= numFrets ? 1 : Math.max(1, minFret);
  const isOpen = startFret === 1;

  const width = s(leftMargin + 5 * stringSpacing + leftMargin);
  const height = s(topMargin + numFrets * fretSpacing + 14);

  // Build a set of strings that are played
  const playedStrings = new Set(chord.fingering.map(f => f.string));

  return (
    <div
      className={`inline-flex flex-col items-center rounded-lg p-1 transition-colors ${
        onSelect ? 'cursor-pointer hover:bg-slate-700/50' : ''
      } ${selected ? 'bg-slate-700/70 ring-1 ring-cyan-400' : ''}`}
      onClick={onSelect ? () => onSelect(chord) : undefined}
    >
      <div className="text-xs font-semibold text-slate-200 mb-1">{chord.name}</div>
      <svg width={width} height={height}>
        {/* Nut (thick bar for open position) */}
        {isOpen && (
          <line
            x1={s(leftMargin)} y1={s(topMargin)}
            x2={s(leftMargin + 5 * stringSpacing)} y2={s(topMargin)}
            stroke="#e2e8f0" strokeWidth={s(3)}
          />
        )}

        {/* Fret number — always shown */}
        <text
          x={s(leftMargin - 8)} y={s(topMargin + fretSpacing / 2 + 4)}
          fill="#94a3b8" fontSize={s(10)} textAnchor="end"
          fontFamily="ui-sans-serif, system-ui"
        >{startFret}</text>

        {/* Fret lines */}
        {Array.from({ length: numFrets + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={s(leftMargin)} y1={s(topMargin + i * fretSpacing)}
            x2={s(leftMargin + 5 * stringSpacing)} y2={s(topMargin + i * fretSpacing)}
            stroke="#64748b" strokeWidth={i === 0 && !isOpen ? s(1) : s(1)}
          />
        ))}

        {/* String lines (vertical) */}
        {Array.from({ length: 6 }).map((_, i) => (
          <line
            key={`str-${i}`}
            x1={s(leftMargin + i * stringSpacing)} y1={s(topMargin)}
            x2={s(leftMargin + i * stringSpacing)} y2={s(topMargin + numFrets * fretSpacing)}
            stroke="#94a3b8" strokeWidth={s(1)}
          />
        ))}

        {/* Open / muted markers above nut */}
        {Array.from({ length: 6 }).map((_, i) => {
          const stringNum = 6 - i; // string 6 is leftmost (low E)
          const x = s(leftMargin + i * stringSpacing);
          const y = s(topMargin - 10);
          const inChord = playedStrings.has(stringNum);
          const fingerData = chord.fingering.find(f => f.string === stringNum);

          if (inChord && fingerData && fingerData.fret === 0) {
            return (
              <circle key={`open-${i}`} cx={x} cy={y} r={s(4)}
                fill="none" stroke="#94a3b8" strokeWidth={s(1.5)} />
            );
          }
          if (!inChord) {
            return (
              <text key={`mute-${i}`} x={x} y={y + s(4)}
                fill="#64748b" fontSize={s(11)} textAnchor="middle"
                fontFamily="ui-sans-serif">×</text>
            );
          }
          return null;
        })}

        {/* Finger dots */}
        {chord.fingering.map((f, i) => {
          if (f.fret <= 0) return null;
          const stringIdx = 6 - f.string; // string 6 → leftmost
          const fretOffset = f.fret - startFret;
          if (fretOffset < 0 || fretOffset >= numFrets) return null;

          const cx = s(leftMargin + stringIdx * stringSpacing);
          const cy = s(topMargin + fretOffset * fretSpacing + fretSpacing / 2);
          const color = neutral ? '#22d3ee' : getFingerColor(f.finger);

          return (
            <g key={`dot-${i}`}>
              <circle cx={cx} cy={cy} r={s(dotRadius)}
                fill={color} stroke="#0f172a" strokeWidth={s(1)} />
              {f.finger > 0 && (
                <text x={cx} y={cy + s(3.5)}
                  fill="#fff" fontSize={s(8)} fontWeight="700"
                  textAnchor="middle" fontFamily="ui-sans-serif"
                >{f.finger}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
