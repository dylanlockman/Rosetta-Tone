// Key shift (capo-style). Shifting a song by n semitones slides every fret
// by n — familiar shapes, new pitch. Notes whose shifted fret falls off the
// neck are re-mapped to the nearest playable position for the new pitch;
// notes with no playable position (or that never had one) stay piano-only.

import { midiToNote, CHROMATIC_SCALE } from './musicTheory.js';
import { candidatesForMidi } from './fretInference.js';

const MAX_FRET = 22;

// beats: output of scoreToBeats() on the untransposed score. Returns new
// beats with pitch, fret, and midi shifted by `semitones`.
export function transposeBeats(beats, semitones) {
  if (!semitones) return beats;
  return beats.map(beat => ({
    ...beat,
    notes: beat.notes.map(n => {
      const midi = (n.midi ?? null) === null ? null : n.midi + semitones;
      if (midi == null) return { ...n };
      const { note, octave } = midiToNote(midi);
      let string = n.string;
      let fret = n.fret != null ? n.fret + semitones : null;
      if (fret != null && (fret < 0 || fret > MAX_FRET)) {
        // Capo shift fell off the neck — re-map to the nearest position.
        const candidates = candidatesForMidi(midi);
        if (candidates.length > 0) {
          const target = n.fret ?? 0;
          const best = candidates.reduce((a, b) =>
            Math.abs(a.fret - target) <= Math.abs(b.fret - target) ? a : b
          );
          string = best.string;
          fret = best.fret;
        } else {
          string = null;
          fret = null;
        }
      }
      return { ...n, midi, note, octave, string, fret };
    }),
  }));
}

// Display label for the current key shift: the transposed key letter when
// the score declared a key, otherwise a signed semitone count.
export function transposeLabel(keyRoot, semitones) {
  if (keyRoot) {
    const idx = CHROMATIC_SCALE.indexOf(keyRoot);
    if (idx !== -1) {
      return CHROMATIC_SCALE[((idx + semitones) % 12 + 12) % 12];
    }
  }
  if (!semitones) return '0';
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}
