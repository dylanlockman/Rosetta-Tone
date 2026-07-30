import { useEffect, useRef } from 'react';
import { useStore } from './store/useStore.js';
import Header from './components/Header.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import TrackContainer from './components/TrackContainer.jsx';
import TransportBar from './components/TransportBar.jsx';
import Toast from './components/Toast.jsx';
import { playBeat, unlockAudio, prefetchNotes } from './utils/audio.js';
import { buildScaleSequence } from './utils/scaleSequence.js';
import { noteToMidi } from './utils/musicTheory.js';

export default function App() {
  const fetchChordLibrary = useStore(s => s.fetchChordLibrary);
  const fetchScales = useStore(s => s.fetchScales);
  const isPlaying = useStore(s => s.isPlaying);
  const bpm = useStore(s => s.bpm);
  const beats = useStore(s => s.beats);
  const currentBeat = useStore(s => s.currentBeat);
  const setCurrentBeat = useStore(s => s.setCurrentBeat);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const instrument = useStore(s => s.instrument);
  const audioEnabled = useStore(s => s.audioEnabled);
  const songSection = useStore(s => s.songSection);
  const activeScale = useStore(s => s.activeScale);

  const lastPlayedBeat = useRef(-1);

  useEffect(() => {
    fetchChordLibrary();
    fetchScales();
  }, [fetchChordLibrary, fetchScales]);

  // Warm the sample cache for everything currently on screen, so playback
  // uses real instrument sounds from the first note where possible.
  useEffect(() => {
    const midis = new Set();
    for (const b of beats) {
      for (const n of b.notes) {
        const m = n.midi ?? noteToMidi(n.note, n.octave);
        if (m != null) midis.add(m);
      }
    }
    if (activeScale) {
      for (const r of useStore.getState().scaleOctaveRuns) {
        const m = noteToMidi(r.pitchClass, r.octave);
        if (m != null) midis.add(m);
      }
    }
    if (midis.size > 0) prefetchNotes(midis, instrument);
  }, [beats, activeScale, instrument]);

  // Play audio when currentBeat changes (scrubbing or playback).
  // Note duration comes from the score's real event durations.
  useEffect(() => {
    if (!audioEnabled) return;
    if (beats.length === 0) return;
    if (lastPlayedBeat.current === currentBeat) return;
    lastPlayedBeat.current = currentBeat;
    const beat = beats[currentBeat];
    if (beat) {
      const secPerQuarter = 60 / bpm;
      const beatDur = (beat.duration || 0.5) * secPerQuarter;
      playBeat(beat.notes, instrument, Math.min(1.5, beatDur * 0.95));
    }
  }, [currentBeat, beats, instrument, audioEnabled, bpm]);

  // Score-driven playback with drift-free timing: every beat is scheduled
  // against an absolute anchor (performance.now at play start), so timer
  // overhead never accumulates and 140 BPM actually plays at 140.
  // Respects the active section's bounds and the loop toggle.
  useEffect(() => {
    if (!isPlaying) return;
    if (beats.length === 0) return;
    let cancelled = false;
    let timerId = null;

    const msPerQuarter = 60000 / bpm;
    const { sections } = useStore.getState();
    const range = songSection != null && sections[songSection]
      ? sections[songSection]
      : { startIndex: 0, endIndex: beats.length - 1 };

    let anchorTime = performance.now();
    let anchorBeatStart = beats[useStore.getState().currentBeat]?.start ?? 0;

    const scheduleNext = () => {
      if (cancelled) return;
      const cur = useStore.getState().currentBeat;
      let next = cur + 1;

      if (next > range.endIndex) {
        if (useStore.getState().loop) {
          // Re-anchor and jump back to the top of the range.
          next = range.startIndex;
          anchorTime = performance.now() + msPerQuarter * (beats[cur]?.duration ?? 0.5);
          anchorBeatStart = beats[next]?.start ?? 0;
          timerId = setTimeout(() => {
            if (cancelled) return;
            setCurrentBeat(next);
            scheduleNext();
          }, Math.max(0, anchorTime - performance.now()));
          return;
        }
        setIsPlaying(false);
        return;
      }

      const nextStart = beats[next]?.start ?? next * 0.5;
      const targetTime = anchorTime + (nextStart - anchorBeatStart) * msPerQuarter;
      timerId = setTimeout(() => {
        if (cancelled) return;
        setCurrentBeat(next);
        scheduleNext();
      }, Math.max(0, targetTime - performance.now()));
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [isPlaying, bpm, beats, songSection, setCurrentBeat, setIsPlaying]);

  // Scale playback: traverse the currently-visible pattern as eighth notes.
  // The sequence is rebuilt from live filter state, so changing the view mode,
  // position, or octave filter mid-playback restarts on the new pattern.
  const isScalePlaying = useStore(s => s.isScalePlaying);
  const scaleViewMode = useStore(s => s.scaleViewMode);
  const selectedCagedPosition = useStore(s => s.selectedCagedPosition);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);
  const scaleCapo = useStore(s => s.scaleCapo);

  useEffect(() => {
    if (!isScalePlaying) return;
    const state = useStore.getState();
    const sequence = buildScaleSequence(state);
    if (sequence.length === 0) {
      state.setIsScalePlaying(false);
      return;
    }

    let step = 0; // absolute step count, never resets — keeps the clock drift-free
    let timerId = null;
    let cancelled = false;
    const anchorTime = performance.now();
    const stepMs = () => (0.5 * 60000) / useStore.getState().bpm; // eighth notes

    const tick = () => {
      if (cancelled) return;
      const st = useStore.getState();
      const idx = step % sequence.length;
      if (step > 0 && idx === 0 && !st.loop) {
        st.setIsScalePlaying(false);
        return;
      }
      const item = sequence[idx];
      st.setScalePlayhead({ note: item, idx, total: sequence.length });
      if (st.audioEnabled) {
        playBeat([item], st.instrument, Math.min(0.9, (stepMs() / 1000) * 1.8));
      }
      step += 1;
      timerId = setTimeout(tick, Math.max(0, anchorTime + step * stepMs() - performance.now()));
    };

    unlockAudio();
    tick();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      useStore.getState().setScalePlayhead(null);
    };
  }, [isScalePlaying, activeScale, scaleViewMode, selectedCagedPosition, selectedOctaveRun, scaleCapo]);

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
      <Toast />
    </div>
  );
}
