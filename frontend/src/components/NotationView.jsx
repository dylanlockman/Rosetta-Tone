import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { useStore } from '../store/useStore.js';
import { getFingerColor, isOpen } from '../utils/noteColors.js';
import { BEAT_WIDTH, LEFT_GUTTER } from './trackLayout.js';

const NOTES_PER_MEASURE = 4;
const MEASURE_WIDTH = NOTES_PER_MEASURE * BEAT_WIDTH;
const STAVE_HEIGHT = 110;
const FIRST_MEASURE_OFFSET = LEFT_GUTTER; // clef + label gutter

function toVexKey(note, octave) {
  // VexFlow doesn't accept "Db", convert sharps as-is, flats already normalized upstream
  return `${note.toLowerCase().replace('#', '#')}/${octave}`;
}

function noteHasAccidental(note) {
  return note.includes('#') || note.includes('b');
}

// Treble clef line/space note labels (bottom to top)
// Lines: E G B D F     Spaces: F A C E
const STAFF_LABELS = [
  { label: 'F', kind: 'line', position: 5 },
  { label: 'E', kind: 'space', position: 4.5 },
  { label: 'D', kind: 'line', position: 4 },
  { label: 'C', kind: 'space', position: 3.5 },
  { label: 'B', kind: 'line', position: 3 },
  { label: 'A', kind: 'space', position: 2.5 },
  { label: 'G', kind: 'line', position: 2 },
  { label: 'F', kind: 'space', position: 1.5 },
  { label: 'E', kind: 'line', position: 1 },
];

export default function NotationView() {
  const beats = useStore(s => s.beats);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (beats.length === 0) return;

    const numMeasures = Math.ceil(beats.length / NOTES_PER_MEASURE);
    const totalWidth = FIRST_MEASURE_OFFSET + numMeasures * MEASURE_WIDTH + 20;

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

    let xPos = 10;
    let firstStaveTop = null;
    let firstStaveBottom = null;

    measures.forEach((measure, measureIdx) => {
      const isFirst = measureIdx === 0;
      const staveWidth = isFirst ? FIRST_MEASURE_OFFSET + MEASURE_WIDTH - 10 : MEASURE_WIDTH;
      const stave = new Stave(xPos, 10, staveWidth);
      if (isFirst) stave.addClef('treble');
      stave.setContext(context);
      stave.setStyle({ strokeStyle: '#cbd5e1', fillStyle: '#cbd5e1' });
      stave.draw();

      if (isFirst) {
        firstStaveTop = stave.getYForLine(0);
        firstStaveBottom = stave.getYForLine(4);
      }

      const notes = measure.map(beat => {
        // Sort beat notes high to low for VexFlow
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
        // Color by the highest fingered note's finger color, fall back to slate
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
      const formatWidth = isFirst
        ? staveWidth - 60 // leave room for clef
        : staveWidth - 20;
      new Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(context, stave);

      xPos += staveWidth;
    });

    // Draw EGBDF / FACE labels left of the clef
    if (firstStaveTop != null && firstStaveBottom != null) {
      // Compute y for each line/space using getYForLine
      // VexFlow lines: 0 (top) to 4 (bottom)
      // Line E (bottom) = line 4, F (top) = line 0
      // Spaces between lines
      const lineNames = ['F', 'D', 'B', 'G', 'E']; // top to bottom (line 0..4)
      const spaceNames = ['E', 'C', 'A', 'F'];     // top to bottom (4 spaces)

      // Find first stave for line positions
      const tempStave = new Stave(0, 10, 50);
      tempStave.addClef('treble');
      tempStave.setContext(context);

      lineNames.forEach((label, idx) => {
        const y = tempStave.getYForLine(idx) + 4;
        context.save();
        context.setFillStyle('#94a3b8');
        context.setFont('ui-sans-serif', 11, 'bold');
        context.fillText(label, 6, y);
        context.restore();
      });

      spaceNames.forEach((label, idx) => {
        // Space between line idx and line idx+1
        const y1 = tempStave.getYForLine(idx);
        const y2 = tempStave.getYForLine(idx + 1);
        const y = (y1 + y2) / 2 + 4;
        context.save();
        context.setFillStyle('#64748b');
        context.setFont('ui-sans-serif', 10, 'normal');
        context.fillText(label, 22, y);
        context.restore();
      });
    }
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
