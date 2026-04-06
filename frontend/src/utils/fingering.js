// Fingering inference: enrich each beat's notes with a `finger` field (0-4).
//
// Strategy:
//   1. Chord match: if a beat's fretted positions exactly equal those of a
//      chord in the library, copy that chord's fingerings.
//   2. Otherwise (typically melody notes), use a positional / one-finger-per-fret
//      assignment: determine the local "hand position" (lowest fret in a sliding
//      window around the beat) and assign finger = (fret - position + 1),
//      clamped to 1..4. Open strings (fret 0) get finger 0.
//
// This is much more accurate for melodies than the old heuristic, which
// always assigned finger 1 to single notes regardless of where they sat
// on the neck.

const POSITION_WINDOW = 6; // beats on each side of current beat to consider

function frettedPositions(positions) {
  return positions.filter(p => p.fret > 0);
}

function signature(positions) {
  return frettedPositions(positions)
    .map(p => `${p.string}:${p.fret}`)
    .sort()
    .join(',');
}

function matchChord(beat, chordLibrary) {
  const beatSig = signature(beat.notes);
  if (!beatSig) return null;
  for (const chord of chordLibrary) {
    if (signature(chord.fingering) === beatSig) return chord;
  }
  return null;
}

function applyChordFingering(beat, chord) {
  const fingerByString = new Map();
  for (const p of chord.fingering) {
    fingerByString.set(p.string, p.finger);
  }
  for (const note of beat.notes) {
    if (note.fret === 0) {
      note.finger = 0;
    } else {
      note.finger = fingerByString.get(note.string) ?? 0;
    }
  }
}

// Determine hand position (lowest fretted note) in a window around beatIdx.
// Open strings (fret 0) are ignored when picking the position.
function localPosition(beats, beatIdx) {
  const start = Math.max(0, beatIdx - POSITION_WINDOW);
  const end = Math.min(beats.length - 1, beatIdx + POSITION_WINDOW);
  let minFret = Infinity;
  for (let i = start; i <= end; i++) {
    for (const n of beats[i].notes) {
      if (n.fret > 0 && n.fret < minFret) minFret = n.fret;
    }
  }
  return minFret === Infinity ? 1 : minFret;
}

function applyPositional(beat, position) {
  for (const note of beat.notes) {
    if (note.fret === 0) {
      note.finger = 0;
      continue;
    }
    let f = note.fret - position + 1;
    if (f < 1) f = 1;
    if (f > 4) f = 4;
    note.finger = f;
  }
}

export function inferFingerings(beats, chordLibrary = []) {
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const matched = matchChord(beat, chordLibrary);
    if (matched) {
      applyChordFingering(beat, matched);
      beat.matchedChord = matched.name;
    } else {
      const position = localPosition(beats, i);
      applyPositional(beat, position);
      beat.matchedChord = null;
    }
  }
  return beats;
}
