import { useStore } from '../store/useStore.js';
import { beatToX, BEAT_WIDTH } from './trackLayout.js';

export default function Playhead({ height }) {
  const currentBeat = useStore(s => s.currentBeat);
  const beats = useStore(s => s.beats);
  if (beats.length === 0) return null;

  const x = beatToX(currentBeat) + BEAT_WIDTH / 2;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x - 1,
        top: 0,
        width: 2,
        height: height || '100%',
        backgroundColor: '#FBBF24',
        boxShadow: '0 0 6px rgba(251, 191, 36, 0.8)',
        zIndex: 20,
      }}
    />
  );
}
