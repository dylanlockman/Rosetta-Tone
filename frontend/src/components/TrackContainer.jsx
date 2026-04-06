import { useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import NotationView from './NotationView.jsx';
import TabView from './TabView.jsx';
import Piano from './Piano.jsx';
import Fretboard from './Fretboard.jsx';
import Playhead from './Playhead.jsx';
import { BEAT_WIDTH, LEFT_GUTTER, RIGHT_PADDING, xToBeat } from './trackLayout.js';

export default function TrackContainer() {
  const beats = useStore(s => s.beats);
  const setCurrentBeat = useStore(s => s.setCurrentBeat);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleScrub = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    const beat = xToBeat(x - BEAT_WIDTH / 2);
    setCurrentBeat(beat);
  }, [setCurrentBeat]);

  const onMouseDown = (e) => {
    setDragging(true);
    handleScrub(e.clientX);
  };
  const onMouseMove = (e) => {
    if (dragging) handleScrub(e.clientX);
  };
  const onMouseUp = () => setDragging(false);
  const onMouseLeave = () => setDragging(false);

  if (beats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Add a song or click one in the library to get started.
      </div>
    );
  }

  const totalWidth = LEFT_GUTTER + beats.length * BEAT_WIDTH + RIGHT_PADDING;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-x-auto overflow-y-auto bg-slate-950 select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
    >
      <div className="relative" style={{ width: totalWidth }}>
        {/* Row 1: Sheet music */}
        <div className="border-b border-slate-800 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">
            Sheet Music
          </div>
          <NotationView />
        </div>

        {/* Row 2: Tab */}
        <div className="border-b border-slate-800 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">
            Tab
          </div>
          <TabView />
        </div>

        {/* Row 3: Piano (sticky) */}
        <div className="border-b border-slate-800 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1 sticky left-0">
            Piano
          </div>
          <div
            className="sticky"
            style={{ left: LEFT_GUTTER, width: 'fit-content' }}
          >
            <Piano />
          </div>
        </div>

        {/* Row 4: Fretboard (sticky) */}
        <div className="py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1 sticky left-0">
            Guitar
          </div>
          <div
            className="sticky"
            style={{ left: LEFT_GUTTER, width: 'fit-content' }}
          >
            <Fretboard />
          </div>
        </div>

        {/* Playhead overlay — spans all rows */}
        <Playhead />
      </div>
    </div>
  );
}
