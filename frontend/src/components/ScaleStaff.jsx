import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { useStore } from '../store/useStore.js';
import { noteToMidi, CHROMATIC_SCALE } from '../utils/musicTheory.js';

// Render a scale as ascending notes on a treble-8vb staff (guitar convention:
// written an octave above sounding pitch). When an octave run is selected in
// the sidebar, the staff shows that run's REAL octaves — selecting the C3 run
// draws C3..C4, not a fixed reference octave.
export default function ScaleStaff({ scaleNotes, root }) {
  const containerRef = useRef(null);
  const selectedOctaveRun = useStore(s => s.selectedOctaveRun);
  const scaleOctaveRuns = useStore(s => s.scaleOctaveRuns);

  useEffect(() => {
    if (!containerRef.current || !scaleNotes || scaleNotes.length === 0) return;
    containerRef.current.innerHTML = '';

    let noteData;
    if (selectedOctaveRun !== null && scaleOctaveRuns.length > 0) {
      // Exact pitches of the selected run, including the boundary root on top
      noteData = scaleOctaveRuns
        .filter(r => r.runIndex === selectedOctaveRun ||
          (r.isBoundary && r.prevRunIndex === selectedOctaveRun))
        .map(r => ({ note: r.pitchClass, octave: r.octave }));
    } else {
      // No run selected: one reference octave starting from the root
      const rootIdx = CHROMATIC_SCALE.indexOf(root || scaleNotes[0]);
      const startOctave = rootIdx >= 5 ? 3 : 4;
      let octave = startOctave;
      let prevMidi = 0;

      noteData = scaleNotes.map((note) => {
        const midi = noteToMidi(note, octave);
        if (midi !== null && midi <= prevMidi) {
          octave++;
        }
        prevMidi = noteToMidi(note, octave) || prevMidi;
        return { note, octave };
      });

      // Add the root an octave up to complete the scale
      noteData.push({
        note: scaleNotes[0],
        octave: octave + (noteToMidi(scaleNotes[0], octave) <= prevMidi ? 1 : 0),
      });
    }

    const numNotes = noteData.length;
    const noteSpacing = 55;
    const staveWidth = Math.max(300, numNotes * noteSpacing + 80);
    const totalWidth = staveWidth + 20;
    const totalHeight = 190; // extra room for labels below

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, totalHeight);
    const context = renderer.getContext();
    context.setFillStyle('#B9BCC5');
    context.setStrokeStyle('#B9BCC5');

    const stave = new Stave(10, 20, staveWidth);
    stave.addClef('treble', 'default', '8vb');
    stave.setContext(context);
    stave.setStyle({ strokeStyle: '#B9BCC5', fillStyle: '#B9BCC5' });
    stave.draw();

    const vexNotes = noteData.map(({ note, octave }) => {
      const key = `${note.toLowerCase()}/${octave + 1}`; // written 8va above sounding
      const staveNote = new StaveNote({ keys: [key], duration: 'q', clef: 'treble' });
      if (note.includes('#')) {
        staveNote.addModifier(new Accidental('#'), 0);
      } else if (note.includes('b')) {
        staveNote.addModifier(new Accidental('b'), 0);
      }
      staveNote.setStyle({ fillStyle: '#8FB8FF', strokeStyle: '#8FB8FF' });
      return staveNote;
    });

    const voice = new Voice({ numBeats: numNotes, beatValue: 4 });
    voice.addTickables(vexNotes);
    new Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
    voice.draw(context, stave);

    // Add note name labels below each notehead, aligned to actual rendered position
    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      const labelY = 170;
      vexNotes.forEach((vn, i) => {
        const x = vn.getAbsoluteX();
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x);
        label.setAttribute('y', labelY);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', '#8FB8FF');
        label.setAttribute('font-size', '11');
        label.setAttribute('font-family', 'ui-sans-serif, system-ui');
        label.setAttribute('font-weight', '600');
        label.textContent = `${noteData[i].note}${noteData[i].octave}`;
        svg.appendChild(label);
      });
    }
  }, [scaleNotes, root, selectedOctaveRun, scaleOctaveRuns]);

  if (!scaleNotes || scaleNotes.length === 0) {
    return <div className="text-chrome-500 text-sm p-4">Select a scale to view notation.</div>;
  }

  return <div ref={containerRef} className="bg-ink-900/60 rounded-lg p-2" />;
}
