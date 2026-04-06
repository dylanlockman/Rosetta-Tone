import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { useStore } from '../store/useStore.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { BEAT_WIDTH, LEFT_GUTTER } from './trackLayout.js';

const NOTES_PER_MEASURE = 4;
const MEASURE_WIDTH = NOTES_PER_MEASURE * BEAT_WIDTH;
const STAVE_HEIGHT = 110;

function toVexKey(note, octave) {
  return `${note.toLowerCase()}/${octave}`;
}

function noteHasAccidental(note) {
  return note.includes('#') || note.includes('b');
}

export default function NotationView() {
  const beats = useStore(s => s.beats);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (beats.length === 0) return;

    const numMeasures = Math.ceil(beats.length / NOTES_PER_MEASURE);
    // Total width must match the tab grid: LEFT_GUTTER + beats * BEAT_WIDTH
    const totalWidth = LEFT_GUTTER + beats.length * BEAT_WIDTH + 40;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, STAVE_HEIGHT + 30);
    const context = renderer.getContext();
    context.setFillStyle('#cbd5e1');
    context.setStrokeStyle('#cbd5e1');

    // Group beats into measures
    const measures = [];
    for (let i = 0; i < beats.length; i += NOTES_PER_MEASURE) {
      measures.push(beats.slice(i, i + NOTES_PER_MEASURE));
    }

    measures.forEach((measure, measureIdx) => {
      const isFirst = measureIdx === 0;
      // Stave x corresponds to where the FIRST beat of this measure should sit
      // minus space for the clef on the first measure.
      const firstBeatIdx = measureIdx * NOTES_PER_MEASURE;
      const firstBeatCenterX = LEFT_GUTTER + firstBeatIdx * BEAT_WIDTH + BEAT_WIDTH / 2;

      // We want stave note-start to be a bit before firstBeatCenterX so notes align
      // to beat centers. The stave x is the left edge; clef takes up gutter on first.
      const staveX = isFirst ? 10 : firstBeatCenterX - BEAT_WIDTH / 2;
      const staveWidth = isFirst
        ? (firstBeatCenterX - BEAT_WIDTH / 2) + NOTES_PER_MEASURE * BEAT_WIDTH - 10
        : NOTES_PER_MEASURE * BEAT_WIDTH;

      const stave = new Stave(staveX, 10, staveWidth);
      if (isFirst) stave.addClef('treble');
      stave.setContext(context);
      stave.setStyle({ strokeStyle: '#cbd5e1', fillStyle: '#cbd5e1' });
      stave.draw();

      const notes = measure.map(beat => {
        const sorted = [...beat.notes].sort((a, b) => {
          const am = (a.octave + 1) * 12;
          const bm = (b.octave + 1) * 12;
          return bm - am;
        });
        const keys = sorted.map(n => toVexKey(n.note, n.octave));
        const note = new StaveNote({ keys, duration: 'q', clef: 'treble' });
        sorted.forEach((n, i) => {
          if (noteHasAccidental(n.note)) {
            note.addModifier(new Accidental('#'), i);
          }
        });
        const fingered = sorted.find(n => !isOpen(n.finger));
        const color = fingered ? getFingerColor(fingered.finger) : '#cbd5e1';
        note.setStyle({ fillStyle: color, strokeStyle: color });
        return note;
      });

      // Pad with rests
      while (notes.length < NOTES_PER_MEASURE) {
        notes.push(new StaveNote({ keys: ['b/4'], duration: 'qr' }));
      }

      const voice = new Voice({ numBeats: NOTES_PER_MEASURE, beatValue: 4 });
      voice.addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], staveWidth - 40);

      // After formatting, force each real note to land at its tab beat center
      notes.forEach((note, i) => {
        if (i >= measure.length) return; // rest pad
        const beat = measure[i];
        const targetAbsX = LEFT_GUTTER + beat.beatIndex * BEAT_WIDTH + BEAT_WIDTH / 2;
        const currentAbsX = note.getAbsoluteX();
        const currentShift = note.getXShift ? note.getXShift() : (note.x_shift || 0);
        note.setXShift(currentShift + (targetAbsX - currentAbsX));
      });

      voice.draw(context, stave);
    });
  }, [beats]);

  if (beats.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        Load a song to view notation.
      </div>
    );
  }

  return <div ref={containerRef} className="bg-slate-800/50" />;
}
