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
    context.setFillStyle('#B9BCC5');
    context.setStrokeStyle('#B9BCC5');

    // Guitar notation convention: written an octave above sounding pitch
    // (treble 8vb), which centers chord voicings on the staff instead of
    // burying them in ledger lines below it.
    const stave = new Stave(10, 20, staveWidth);
    stave.addClef('treble', 'default', '8vb');
    stave.setContext(context);
    stave.setStyle({ strokeStyle: '#B9BCC5', fillStyle: '#B9BCC5' });
    stave.draw();

    const keys = pitches.map(p => `${p.note.toLowerCase()}/${p.octave + 1}`);
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
    const color = fingered ? getFingerColor(fingered.finger) : '#F5B848';
    staveNote.setStyle({ fillStyle: color, strokeStyle: color });

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.addTickables([staveNote]);
    new Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
    voice.draw(context, stave);
  }, [chord]);

  if (!chord) {
    return <div className="text-chrome-500 text-sm p-4">Select a chord to view notation.</div>;
  }

  return (
    <div className="bg-ink-900/60 rounded-lg p-2">
      <div className="text-xs text-chrome-400 mb-1 px-2">{chord.name}</div>
      <div ref={containerRef} />
    </div>
  );
}
