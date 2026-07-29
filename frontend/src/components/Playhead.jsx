import { useStore } from '../store/useStore.js';
import { beatToX, BEAT_WIDTH } from './trackLayout.js';

export default function Playhead({ height }) {
  const currentBeat = useStore(s => s.currentBeat);
  const beats = useStore(s => s.beats);
  const isPlaying = useStore(s => s.isPlaying);
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
        backgroundColor: '#F5B848',
        boxShadow: '0 0 8px rgba(245, 184, 72, 0.7)',
        zIndex: 20,
        // Glide between beats during playback; snap when scrubbing
        transition: isPlaying ? 'left 110ms linear' : 'none',
      }}
    >
      {/* Cap at the top, like a tape-machine locator */}
      <div
        style={{
          position: 'absolute',
          top: -1,
          left: -4,
          width: 10,
          height: 6,
          backgroundColor: '#F5B848',
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        }}
      />
    </div>
  );
}
