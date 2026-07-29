import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Dot } from 'vexflow';
import { useStore } from '../store/useStore.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { noteToMidi } from '../utils/musicTheory.js';
import { BEAT_WIDTH, LEFT_GUTTER } from './trackLayout.js';

const STAVE_HEIGHT = 110;
const STAFF_COLOR = '#4A5160';
const NOTE_NEUTRAL = '#B9BCC5';

function toVexKey(note, octave) {
  return `${note.toLowerCase()}/${octave}`;
}

// Map a duration in quarter-note beats to the nearest VexFlow duration.
// Returns { code, dotted }.
function toVexDuration(beats) {
  const TABLE = [
    { beats: 4, code: 'w', dotted: false },
    { beats: 3, code: 'h', dotted: true },
    { beats: 2, code: 'h', dotted: false },
    { beats: 1.5, code: 'q', dotted: true },
    { beats: 1, code: 'q', dotted: false },
    { beats: 0.75, code: '8', dotted: true },
    { beats: 0.5, code: '8', dotted: false },
    { beats: 0.25, code: '16', dotted: false },
  ];
  let best = TABLE[4]; // quarter
  let bestDiff = Infinity;
  for (const t of TABLE) {
    const diff = Math.abs(t.beats - beats);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = t;
    }
  }
  return best;
}

export default function NotationView() {
  const beats = useStore(s => s.beats);
  const score = useStore(s => s.score);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (beats.length === 0) return;

    const ts = score?.meta?.timeSignature ?? [4, 4];
    const beatsPerBar = (ts[0] * 4) / ts[1];

    const totalWidth = LEFT_GUTTER + beats.length * BEAT_WIDTH + 40;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, STAVE_HEIGHT + 30);
    const context = renderer.getContext();
    context.setFillStyle(NOTE_NEUTRAL);
    context.setStrokeStyle(NOTE_NEUTRAL);

    // Group beats into measures by their real start time
    const measures = [];
    for (const beat of beats) {
      const start = beat.start ?? beat.beatIndex;
      const idx = Math.floor((start + 1e-6) / beatsPerBar);
      if (!measures[idx]) measures[idx] = [];
      measures[idx].push(beat);
    }

    let firstDrawn = true;
    measures.forEach((measure) => {
      if (!measure || measure.length === 0) return;
      const isFirst = firstDrawn;
      firstDrawn = false;

      const firstBeatIdx = measure[0].beatIndex;
      const lastBeatIdx = measure[measure.length - 1].beatIndex;
      const firstBeatCenterX = LEFT_GUTTER + firstBeatIdx * BEAT_WIDTH + BEAT_WIDTH / 2;

      const staveX = isFirst ? 10 : firstBeatCenterX - BEAT_WIDTH / 2;
      const staveEnd = LEFT_GUTTER + (lastBeatIdx + 1) * BEAT_WIDTH;
      const staveWidth = Math.max(BEAT_WIDTH, staveEnd - staveX);

      const stave = new Stave(staveX, 10, staveWidth);
      if (isFirst) stave.addClef('treble');
      stave.setContext(context);
      stave.setStyle({ strokeStyle: STAFF_COLOR, fillStyle: STAFF_COLOR });
      stave.draw();

      const notes = measure.map(beat => {
        const valid = beat.notes.filter(n => noteToMidi(n.note, n.octave) != null);
        if (valid.length === 0) {
          return new StaveNote({ keys: ['b/4'], duration: 'qr' });
        }
        const sorted = [...valid].sort((a, b) =>
          noteToMidi(a.note, a.octave) - noteToMidi(b.note, b.octave)
        );
        const keys = sorted.map(n => toVexKey(n.note, n.octave));
        const { code, dotted } = toVexDuration(beat.duration ?? 1);
        const note = new StaveNote({ keys, duration: code, clef: 'treble' });
        if (dotted) Dot.buildAndAttach([note], { all: true });
        sorted.forEach((n, i) => {
          if (n.note.includes('#')) {
            note.addModifier(new Accidental('#'), i);
          } else if (n.note.includes('b')) {
            note.addModifier(new Accidental('b'), i);
          }
        });
        const fingered = sorted.find(n => !isOpen(n.finger));
        const color = fingered ? getFingerColor(fingered.finger) : NOTE_NEUTRAL;
        note.setStyle({ fillStyle: color, strokeStyle: color });
        return note;
      });

      // SOFT mode: the voice accepts whatever durations the beats carry
      // without demanding an exactly-full measure.
      const voice = new Voice({ numBeats: beatsPerBar, beatValue: 4 });
      voice.setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], staveWidth - 40);

      voice.draw(context, stave);

      // Post-draw: move each note's SVG group to its exact target X so the
      // notation stays column-aligned with the tab row and playhead.
      notes.forEach((note, i) => {
        if (i >= measure.length) return;
        const beat = measure[i];
        const targetX = LEFT_GUTTER + beat.beatIndex * BEAT_WIDTH + BEAT_WIDTH / 2;
        const actualX = note.getAbsoluteX();
        const delta = targetX - actualX;
        if (Math.abs(delta) > 0.5) {
          const el = note.getSVGElement ? note.getSVGElement() : null;
          if (el) {
            el.setAttribute('transform', `translate(${delta}, 0)`);
          }
        }
      });
    });
  }, [beats, score]);

  if (beats.length === 0) {
    return (
      <div className="text-center text-chrome-500 py-8">
        Load a song to view notation.
      </div>
    );
  }

  return <div ref={containerRef} />;
}
