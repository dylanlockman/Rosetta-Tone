import { useEffect, useRef } from 'react';
import { useStore } from './store/useStore.js';
import Header from './components/Header.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import TrackContainer from './components/TrackContainer.jsx';
import { playBeat } from './utils/audio.js';

export default function App() {
  const fetchChordLibrary = useStore(s => s.fetchChordLibrary);
  const isPlaying = useStore(s => s.isPlaying);
  const bpm = useStore(s => s.bpm);
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const setCurrentBeat = useStore(s => s.setCurrentBeat);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const instrument = useStore(s => s.instrument);
  const audioEnabled = useStore(s => s.audioEnabled);

  const lastPlayedBeat = useRef(-1);

  useEffect(() => {
    fetchChordLibrary();
  }, [fetchChordLibrary]);

  // Play audio when currentBeat changes (scrubbing or playback)
  useEffect(() => {
    if (!audioEnabled) return;
    if (beats.length === 0) return;
    if (lastPlayedBeat.current === currentBeat) return;
    lastPlayedBeat.current = currentBeat;
    const beat = beats[currentBeat];
    if (beat) {
      const beatDur = 60 / bpm;
      playBeat(beat.notes, instrument, Math.min(1.2, beatDur * 0.9));
    }
  }, [currentBeat, beats, instrument, audioEnabled, bpm]);

  // BPM-driven autoscroll
  useEffect(() => {
    if (!isPlaying) return;
    if (beats.length === 0) return;
    const intervalMs = 60000 / bpm;
    const id = setInterval(() => {
      const next = useStore.getState().currentBeat + 1;
      if (next >= beats.length) {
        setIsPlaying(false);
        return;
      }
      setCurrentBeat(next);
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, bpm, beats.length, setCurrentBeat, setIsPlaying]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <div className="flex flex-1 min-h-0">
        <LibraryPanel />
        <TrackContainer />
      </div>
    </div>
  );
}
