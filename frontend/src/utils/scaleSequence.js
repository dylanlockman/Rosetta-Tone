// Build the ordered note sequence for scale playback.
//
// The key idea: playback follows *whatever the user is looking at* — the
// current view mode and filters become practice patterns:
//   - vertical + position selected  → that CAGED box, low string to high
//   - diagonal + position selected  → the 3-notes-per-string run up the neck
//   - full view (or no position)    → the scale pitch-by-pitch across the
//     octave runs, mapped to nearby fretboard positions
// Every sequence ascends then descends (without repeating the apex note).

import { noteToMidi } from './musicTheory.js';
import { computeScaleFretPositions } from './scalePositions.js';

function withDescent(seq) {
  if (seq.length <= 1) return seq;
  return [...seq, ...seq.slice(0, -1).reverse()];
}

function fromBoxNotes(notes) {
  // Low string (6) to high (1), low fret to high within each string,
  // deduped per string+fret.
  const seen = new Set();
  const ordered = [...notes]
    .sort((a, b) => b.string - a.string || a.fret - b.fret)
    .filter(n => {
      const key = `${n.string}-${n.fret}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(n => ({
      string: n.string,
      fret: n.fret,
      note: n.note,
      octave: n.octave,
      midi: n.midi ?? noteToMidi(n.note, n.octave),
    }));
  return withDescent(ordered);
}

export function buildScaleSequence({
  activeScale,
  scaleViewMode,
  cagedPositions,
  diagonalPatterns,
  selectedCagedPosition,
  selectedOctaveRun,
  scaleOctaveRuns,
  scaleCapo = 0,
}) {
  if (!activeScale?.notes?.length) return [];

  // Box / diagonal pattern playback
  if (scaleViewMode === 'vertical' && selectedCagedPosition !== null &&
      cagedPositions[selectedCagedPosition]) {
    return fromBoxNotes(cagedPositions[selectedCagedPosition].notes);
  }
  if (scaleViewMode === 'diagonal' && selectedCagedPosition !== null &&
      diagonalPatterns[selectedCagedPosition]) {
    return fromBoxNotes(diagonalPatterns[selectedCagedPosition].notes);
  }

  // Full view: walk the octave runs pitch by pitch, choosing the fretboard
  // position closest to where the hand already is. With a capo, only
  // positions at or above it exist.
  const allPositions = computeScaleFretPositions(activeScale.notes, scaleCapo);
  const byMidi = new Map();
  for (const p of allPositions) {
    if (!byMidi.has(p.midi)) byMidi.set(p.midi, []);
    byMidi.get(p.midi).push(p);
  }

  let pitches = scaleOctaveRuns;
  if (selectedOctaveRun !== null) {
    pitches = pitches.filter(r =>
      r.runIndex === selectedOctaveRun ||
      (r.isBoundary && r.prevRunIndex === selectedOctaveRun)
    );
  }

  const seq = [];
  let prevFret = scaleCapo;
  // Movement cost plus a mild near-the-capo preference, so the path crosses
  // strings the way a hand would instead of climbing one string up the neck.
  const cost = (c) => Math.abs(c.fret - prevFret) + (c.fret - scaleCapo) * 0.35;
  for (const r of pitches) {
    const midi = noteToMidi(r.pitchClass, r.octave);
    const candidates = byMidi.get(midi);
    if (!candidates?.length) continue; // outside guitar range
    const best = candidates.reduce((a, b) => (cost(a) <= cost(b) ? a : b));
    prevFret = best.fret;
    seq.push({
      string: best.string,
      fret: best.fret,
      note: r.pitchClass,
      octave: r.octave,
      midi,
    });
  }
  return withDescent(seq);
}
