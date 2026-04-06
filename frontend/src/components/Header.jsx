import { useStore } from '../store/useStore.js';
import { FINGER_COLORS } from '../utils/noteColors.js';

const FINGER_LEGEND = [
  { finger: 1, label: 'Index' },
  { finger: 2, label: 'Middle' },
  { finger: 3, label: 'Ring' },
  { finger: 4, label: 'Pinky' },
  { finger: 'T', label: 'Thumb' },
];

export default function Header() {
  const activeSong = useStore(s => s.activeSong);
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold text-cyan-400">GearBoard</span>
        {activeSong && (
          <span className="text-slate-300">
            <span className="text-slate-500 mx-2">|</span>
            {activeSong.title}
            {activeSong.artist && <span className="text-slate-500"> — {activeSong.artist}</span>}
          </span>
        )}
        {beats.length > 0 && (
          <span className="text-slate-500 text-xs ml-3">
            beat {currentBeat + 1} / {beats.length}
            {beats[currentBeat]?.matchedChord && (
              <span className="ml-2 text-cyan-400">{beats[currentBeat].matchedChord}</span>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        {FINGER_LEGEND.map(f => (
          <div key={f.finger} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: FINGER_COLORS[f.finger] }}
            />
            <span className="text-slate-400">{f.label}</span>
          </div>
        ))}
      </div>
    </header>
  );
}
