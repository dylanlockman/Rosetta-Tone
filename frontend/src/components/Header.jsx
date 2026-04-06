import { useStore } from '../store/useStore.js';
import { FINGER_COLORS } from '../utils/noteColors.js';
import { unlockAudio } from '../utils/audio.js';

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
  const bpm = useStore(s => s.bpm);
  const setBpm = useStore(s => s.setBpm);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const instrument = useStore(s => s.instrument);
  const setInstrument = useStore(s => s.setInstrument);
  const audioEnabled = useStore(s => s.audioEnabled);
  const toggleAudio = useStore(s => s.toggleAudio);

  const handlePlayToggle = () => {
    if (!isPlaying) unlockAudio();
    setIsPlaying(!isPlaying);
  };

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

      <div className="flex items-center gap-4 text-xs">
        {/* Transport */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayToggle}
            disabled={beats.length === 0}
            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <label className="flex items-center gap-1 text-slate-400">
            BPM
            <input
              type="number"
              min="20"
              max="300"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-14 px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-100 text-center"
            />
          </label>
        </div>

        {/* Instrument toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5 border border-slate-700">
          <button
            onClick={() => setInstrument('piano')}
            className={`px-2 py-0.5 rounded ${instrument === 'piano' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
          >
            Piano
          </button>
          <button
            onClick={() => setInstrument('guitar')}
            className={`px-2 py-0.5 rounded ${instrument === 'guitar' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
          >
            Guitar
          </button>
        </div>

        <button
          onClick={toggleAudio}
          className={`px-2 py-0.5 rounded border ${audioEnabled ? 'border-cyan-600 text-cyan-300' : 'border-slate-700 text-slate-500'}`}
          title="Toggle audio output"
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>

        {/* Finger legend */}
        <div className="flex items-center gap-3 ml-2">
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
      </div>
    </header>
  );
}
