import { useEffect, useRef } from 'react';
import { useStore } from './store/useStore.js';
import Header from './components/Header.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import TrackContainer from './components/TrackContainer.jsx';
import { playBeat } from './utils/audio.js';

export default function App() {
  const fetchChordLibrary = useStore(s => s.fetchChordLibrary);
  const fetchScales = useStore(s => s.fetchScales);
  const isPlaying = useStore(s => s.isPlaying);
  const bpm = useStore(s => s.bpm);
  const subdivision = useStore(s => s.subdivision);
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const setCurrentBeat = useStore(s => s.setCurrentBeat);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const instrument = useStore(s => s.instrument);
  const audioEnabled = useStore(s => s.audioEnabled);

  const lastPlayedBeat = useRef(-1);

  useEffect(() => {
    fetchChordLibrary();
    fetchScales();
  }, [fetchChordLibrary, fetchScales]);

  // Play audio when currentBeat changes (scrubbing or playback)
  useEffect(() => {
    if (!audioEnabled) return;
    if (beats.length === 0) return;
    if (lastPlayedBeat.current === currentBeat) return;
    lastPlayedBeat.current = currentBeat;
    const beat = beats[currentBeat];
    if (beat) {
      const beatDur = 60 / (bpm * subdivision);
      playBeat(beat.notes, instrument, Math.min(1.2, beatDur * 0.9));
    }
  }, [currentBeat, beats, instrument, audioEnabled, bpm, subdivision]);

  // BPM-driven autoscroll
  useEffect(() => {
    if (!isPlaying) return;
    if (beats.length === 0) return;
    const intervalMs = 60000 / (bpm * subdivision);
    const id = setInterval(() => {
      const next = useStore.getState().currentBeat + 1;
      if (next >= beats.length) {
        setIsPlaying(false);
        return;
      }
      setCurrentBeat(next);
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, bpm, subdivision, beats.length, setCurrentBeat, setIsPlaying]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <Header />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <LibraryPanel />
        <TrackContainer />
      </div>
    </div>
  );
}
