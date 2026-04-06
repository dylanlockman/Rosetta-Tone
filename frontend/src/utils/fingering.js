// Fingering inference: given parsed beats from tabParser and a chord library
// from the backend, enrich each beat's notes with a `finger` field (0-4).
//
// Strategy:
//   1. For each beat, build a signature of its (string, fret) positions.
//      Compare against every chord in the library; if any chord's *fretted*
//      positions exactly match the beat's *fretted* positions, copy the
//      finger numbers from that chord.
//   2. Otherwise, fall back to a heuristic: sort fretted notes by ascending
//      fret, assign fingers 1..4 in order. Open strings (fret 0) get 0.
//      If more than 4 fretted notes, extras reuse finger 1 (barre).
//
// The chord library shape (from /api/chords/all/full):
//   [{ id, name, tuning, fingering: [{string, fret, finger}, ...] }, ...]
// Muted positions in the library use fret = -1 and are ignored.

function frettedPositions(positions) {
  return positions.filter(p => p.fret > 0);
}

// Build a sorted, comparable string signature of the fretted positions.
function signature(positions) {
  return frettedPositions(positions)
    .map(p => `${p.string}:${p.fret}`)
    .sort()
    .join(',');
}

function matchChord(beat, chordLibrary) {
  const beatSig = signature(beat.notes);
  if (!beatSig) return null; // beat is all open strings — no chord match
  for (const chord of chordLibrary) {
    if (signature(chord.fingering) === beatSig) return chord;
  }
  return null;
}

function applyChordFingering(beat, chord) {
  // Build a lookup from string number to finger from the chord
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

function applyHeuristic(beat) {
  const fretted = beat.notes
    .filter(n => n.fret > 0)
    .sort((a, b) => a.fret - b.fret || a.string - b.string);

  fretted.forEach((note, i) => {
    note.finger = Math.min(i + 1, 4) || 1;
  });

  for (const note of beat.notes) {
    if (note.fret === 0) note.finger = 0;
    if (note.finger == null) note.finger = 0;
  }
}

export function inferFingerings(beats, chordLibrary = []) {
  for (const beat of beats) {
    const matched = matchChord(beat, chordLibrary);
    if (matched) {
      applyChordFingering(beat, matched);
      beat.matchedChord = matched.name;
    } else {
      applyHeuristic(beat);
      beat.matchedChord = null;
    }
  }
  return beats;
}
