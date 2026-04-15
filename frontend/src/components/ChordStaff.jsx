import { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { fretToNote, noteToMidi } from '../utils/musicTheory.js';
import { getFingerColor } from '../utils/noteColors.js';

// Render a chord's notes stacked on a VexFlow treble clef staff.
export default function ChordStaff({ chord }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !chord || !chord.fingering) return;
    containerRef.current.innerHTML = '';

    // Compute pitches from fingering
    const pitches = chord.fingering
      .filter(f => f.fret >= 0)
      .map(f => {
        const info = fretToNote(f.string, f.fret);
        return info ? { ...info, finger: f.finger } : null;
      })
      .filter(Boolean)
      .sort((a, b) => noteToMidi(a.note, a.octave) - noteToMidi(b.note, b.octave));

    if (pitches.length === 0) return;

    const staveWidth = 200;
    const totalWidth = staveWidth + 20;
    const totalHeight = 160;

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

    const keys = pitches.map(p => `${p.note.toLowerCase()}/${p.octave}`);
    const staveNote = new StaveNote({ keys, duration: 'w', clef: 'treble' });

    // Add accidentals
    pitches.forEach((p, i) => {
      if (p.note.includes('#')) {
        staveNote.addModifier(new Accidental('#'), i);
      } else if (p.note.includes('b')) {
        staveNote.addModifier(new Accidental('b'), i);
      }
    });

    // Color by primary finger
    const fingered = pitches.find(p => p.finger > 0);
    const color = fingered ? getFingerColor(fingered.finger) : '#22d3ee';
    staveNote.setStyle({ fillStyle: color, strokeStyle: color });

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.addTickables([staveNote]);
    new Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
    voice.draw(context, stave);
  }, [chord]);

  if (!chord) {
    return <div className="text-slate-500 text-sm p-4">Select a chord to view notation.</div>;
  }

  return (
    <div className="bg-slate-800/30 rounded-lg p-2">
      <div className="text-xs text-slate-400 mb-1 px-2">{chord.name}</div>
      <div ref={containerRef} />
    </div>
  );
}
