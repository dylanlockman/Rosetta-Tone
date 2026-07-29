import { useEffect, useRef } from 'react';
import { useStore } from './store/useStore.js';
import Header from './components/Header.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import TrackContainer from './components/TrackContainer.jsx';
import TransportBar from './components/TransportBar.jsx';
import { playBeat, unlockAudio } from './utils/audio.js';
import { buildScaleSequence } from './utils/scaleSequence.js';

export default function App() {
  const fetchChordLibrary = useStore(s => s.fetchChordLibrary);
  const fetchScales = useStore(s => s.fetchScales);
  const isPlaying = useStore(s => s.isPlaying);
  const bpm = useStore(s => s.bpm);
  const playbackRate = useStore(s => s.playbackRate);
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

  // Play audio when currentBeat changes (scrubbing or playback).
  // Note duration comes from the score's real event durations.
  useEffect(() => {
    if (!audioEnabled) return;
    if (beats.length === 0) return;
    if (lastPlayedBeat.current === currentBeat) return;
    lastPlayedBeat.current = currentBeat;
    const beat = beats[currentBeat];
    if (beat) {
      const secPerQuarter = 60 / (bpm * playbackRate);
      const beatDur = (beat.duration || 0.5) * secPerQuarter;
      playBeat(beat.notes, instrument, Math.min(1.5, beatDur * 0.95));
    }
  }, [currentBeat, beats, instrument, audioEnabled, bpm, playbackRate]);

  // Score-driven playback: each step waits the real gap between this beat's
  // start and the next one's, so rhythm follows the source material.
  useEffect(() => {
    if (!isPlaying) return;
    if (beats.length === 0) return;
    let cancelled = false;
    let timerId = null;

    const scheduleNext = () => {
      const cur = useStore.getState().currentBeat;
      const next = cur + 1;
      if (next >= beats.length) {
        setIsPlaying(false);
        return;
      }
      const curStart = beats[cur]?.start ?? cur * 0.5;
      const nextStart = beats[next]?.start ?? next * 0.5;
      const deltaBeats = Math.max(0.125, nextStart - curStart);
      const ms = (deltaBeats * 60000) / (bpm * playbackRate);
      timerId = setTimeout(() => {
        if (cancelled) return;
        setCurrentBeat(next);
        scheduleNext();
      }, ms);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [isPlaying, bpm, playbackRate, beats, setCurrentBeat, setIsPlaying]);

  // Scale playback: traverse the currently-visible pattern as eighth notes.
  // The sequence is rebuilt from live filter state, so changing the view mode,
  // position, or octave filter mid-playback restarts on the new pattern.
  const isScalePlaying = useStore(s => s.isScalePlaying);
  const activeScale = useStore(s => s.activeScale);
  const scaleViewMode = useStore(s => s.scaleViewMode);
  const selectedCagedPosition = useStore(s => s.selectedCagedPosition);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);

  useEffect(() => {
    if (!isScalePlaying) return;
    const state = useStore.getState();
    const sequence = buildScaleSequence(state);
    if (sequence.length === 0) {
      state.setIsScalePlaying(false);
      return;
    }

    let idx = 0;
    let timerId = null;
    let cancelled = false;
    const stepMs = () => {
      const { bpm: b, playbackRate: rate } = useStore.getState();
      return (0.5 * 60000) / (b * rate); // eighth notes
    };

    const tick = () => {
      if (cancelled) return;
      const st = useStore.getState();
      if (idx >= sequence.length) {
        if (st.scaleLoop) {
          idx = 0;
        } else {
          st.setIsScalePlaying(false);
          return;
        }
      }
      const item = sequence[idx];
      st.setScalePlayheadNote(item);
      if (st.audioEnabled) {
        playBeat([item], st.instrument, Math.min(0.9, (stepMs() / 1000) * 1.8));
      }
      idx += 1;
      timerId = setTimeout(tick, stepMs());
    };

    unlockAudio();
    tick();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      useStore.getState().setScalePlayheadNote(null);
    };
  }, [isScalePlaying, activeScale, scaleViewMode, selectedCagedPosition, selectedOctaveRun]);

  // Keyboard shortcuts: Space = play/pause, ←/→ = step beat, Home = rewind
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      const st = useStore.getState();
      // In scale view, space drives scale playback instead of the song
      if (st.scaleViewActive) {
        if (e.code === 'Space') {
          e.preventDefault();
          st.setIsScalePlaying(!st.isScalePlaying);
        }
        return;
      }
      const { beats: b, currentBeat: cur, isPlaying: playing } = st;
      if (b.length === 0) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!playing) unlockAudio();
        setIsPlaying(!playing);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentBeat(cur + 1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentBeat(cur - 1);
      } else if (e.code === 'Home') {
        e.preventDefault();
        setCurrentBeat(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCurrentBeat, setIsPlaying]);

  return (
    <div className="h-screen flex flex-col bg-ink-950 text-chrome-100 overflow-hidden">
      <Header />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative z-10">
        <LibraryPanel />
        <TrackContainer />
      </div>
      <TransportBar />
    </div>
  );
}
