import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { noteToMidi, CHROMATIC_SCALE } from '../utils/musicTheory.js';

// Render a scale as ascending notes on a VexFlow treble clef staff (one octave).
export default function ScaleStaff({ scaleNotes, root }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !scaleNotes || scaleNotes.length === 0) return;
    containerRef.current.innerHTML = '';

    // Build ascending notes starting from root in octave 4
    const rootIdx = CHROMATIC_SCALE.indexOf(root || scaleNotes[0]);
    const startOctave = rootIdx >= 5 ? 3 : 4;
    let octave = startOctave;
    let prevMidi = 0;

    const noteData = scaleNotes.map((note) => {
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

    const numNotes = noteData.length;
    const noteSpacing = 55;
    const staveWidth = Math.max(300, numNotes * noteSpacing + 80);
    const totalWidth = staveWidth + 20;
    const totalHeight = 190; // extra room for labels below

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, totalHeight);
    const context = renderer.getContext();
    context.setFillStyle('#cbd5e1');
    context.setStrokeStyle('#cbd5e1');

    const stave = new Stave(10, 20, staveWidth);
    stave.addClef('treble');
    stave.setContext(context);
    stave.setStyle({ strokeStyle: '#cbd5e1', fillStyle: '#cbd5e1' });
    stave.draw();

    const vexNotes = noteData.map(({ note, octave }) => {
      const key = `${note.toLowerCase()}/${octave}`;
      const staveNote = new StaveNote({ keys: [key], duration: 'q', clef: 'treble' });
      if (note.includes('#')) {
        staveNote.addModifier(new Accidental('#'), 0);
      } else if (note.includes('b')) {
        staveNote.addModifier(new Accidental('b'), 0);
      }
      staveNote.setStyle({ fillStyle: '#22d3ee', strokeStyle: '#22d3ee' });
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
        label.setAttribute('fill', '#22d3ee');
        label.setAttribute('font-size', '11');
        label.setAttribute('font-family', 'ui-sans-serif, system-ui');
        label.setAttribute('font-weight', '600');
        label.textContent = noteData[i].note;
        svg.appendChild(label);
      });
    }
  }, [scaleNotes, root]);

  if (!scaleNotes || scaleNotes.length === 0) {
    return <div className="text-slate-500 text-sm p-4">Select a scale to view notation.</div>;
  }

  return <div ref={containerRef} className="bg-slate-800/30 rounded-lg p-2" />;
}
