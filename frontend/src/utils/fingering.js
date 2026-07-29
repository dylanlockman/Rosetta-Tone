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

// With a capo (or capo-style key shift), the hand plays in capo-relative
// frets: relative 0 IS an open string. `shift` converts absolute → relative.
function relFret(fret, shift) {
  if (fret == null) return null;
  const rel = fret - shift;
  return rel >= 0 ? rel : fret; // remapped out-of-pattern note: treat absolute
}

function frettedPositions(positions, shift = 0) {
  return positions.filter(p => relFret(p.fret, shift) > 0);
}

function signature(positions, shift = 0) {
  return frettedPositions(positions, shift)
    .map(p => `${p.string}:${relFret(p.fret, shift)}`)
    .sort()
    .join(',');
}

function matchChord(beat, chordLibrary, shift = 0) {
  const beatSig = signature(beat.notes, shift);
  if (!beatSig) return null;
  for (const chord of chordLibrary) {
    if (signature(chord.fingering) === beatSig) return chord;
  }
  return null;
}

function applyChordFingering(beat, chord, shift = 0) {
  const fingerByString = new Map();
  for (const p of chord.fingering) {
    fingerByString.set(p.string, p.finger);
  }
  for (const note of beat.notes) {
    const rel = relFret(note.fret, shift);
    if (rel == null) {
      note.finger = null; // not on the guitar (out-of-range piano note)
    } else if (rel === 0) {
      note.finger = 0; // open (or capo'd open)
    } else {
      note.finger = fingerByString.get(note.string) ?? 0;
    }
  }
}

// Determine hand position (lowest fretted note, capo-relative) in a window
// around beatIdx. Open strings are ignored when picking the position.
function localPosition(beats, beatIdx, shift = 0) {
  const start = Math.max(0, beatIdx - POSITION_WINDOW);
  const end = Math.min(beats.length - 1, beatIdx + POSITION_WINDOW);
  let minFret = Infinity;
  for (let i = start; i <= end; i++) {
    for (const n of beats[i].notes) {
      const rel = relFret(n.fret, shift);
      if (rel > 0 && rel < minFret) minFret = rel;
    }
  }
  return minFret === Infinity ? 1 : minFret;
}

function applyPositional(beat, position, shift = 0) {
  for (const note of beat.notes) {
    const rel = relFret(note.fret, shift);
    if (rel == null) {
      note.finger = null; // not on the guitar (out-of-range piano note)
      continue;
    }
    if (rel === 0) {
      note.finger = 0; // open (or capo'd open)
      continue;
    }
    let f = rel - position + 1;
    if (f < 1) f = 1;
    if (f > 4) f = 4;
    note.finger = f;
  }
}

export function inferFingerings(beats, chordLibrary = [], shift = 0) {
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];

    // Continuity: if this beat has the same fret pattern as the previous beat,
    // reuse the previous fingering to avoid spurious hand-position changes
    // within repeated chords/arpeggios.
    if (i > 0) {
      const prevSig = signature(beats[i - 1].notes, shift);
      const curSig = signature(beat.notes, shift);
      if (prevSig === curSig && prevSig !== '') {
        for (const note of beat.notes) {
          const prev = beats[i - 1].notes.find(pn => pn.string === note.string);
          note.finger = prev ? prev.finger : 0;
        }
        beat.matchedChord = beats[i - 1].matchedChord;
        continue;
      }
    }

    const matched = matchChord(beat, chordLibrary, shift);
    if (matched) {
      applyChordFingering(beat, matched, shift);
      beat.matchedChord = matched.name;
    } else {
      const position = localPosition(beats, i, shift);
      applyPositional(beat, position, shift);
      beat.matchedChord = null;
    }
  }
  return beats;
}
