// Generate multiple guitar voicings for a chord given its pitch classes.
// A voicing is a set of fret positions (one per string, or muted) within
// a playable hand span (~4 frets).

import { fretToNote, noteToMidi, STANDARD_TUNING, CHROMATIC_SCALE } from './musicTheory.js';

const NUM_FRETS = 15; // search up to fret 15
const MAX_SPAN = 4;   // max fret span for a hand position
const MAX_VOICINGS = 6; // cap output

/**
 * Get pitch classes from a chord fingering.
 */
function chordPitchClasses(fingering) {
  const pcs = new Set();
  for (const f of fingering) {
    if (f.fret < 0) continue;
    const info = fretToNote(f.string, f.fret);
    if (info) pcs.add(info.note);
  }
  return pcs;
}

/**
 * For each string, find all frets that produce one of the target pitch classes.
 */
function findFretOptions(pitchClasses) {
  const pcSet = pitchClasses instanceof Set ? pitchClasses : new Set(pitchClasses);
  const options = []; // options[stringIdx] = [fret, ...]
  for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
    const stringNumber = stringIdx + 1;
    const frets = [-1]; // -1 = muted (string not played)
    for (let fret = 0; fret <= NUM_FRETS; fret++) {
      const info = fretToNote(stringNumber, fret);
      if (info && pcSet.has(info.note)) {
        frets.push(fret);
      }
    }
    options.push(frets);
  }
  return options;
}

/**
 * Check if a voicing is playable: fretted notes span <= MAX_SPAN frets.
 */
function isPlayable(frets) {
  const fretted = frets.filter(f => f > 0);
  if (fretted.length === 0) return true;
  return Math.max(...fretted) - Math.min(...fretted) <= MAX_SPAN;
}

/**
 * Check if a voicing contains all required pitch classes.
 */
function coversAllPitchClasses(frets, pitchClasses) {
  const found = new Set();
  for (let i = 0; i < 6; i++) {
    if (frets[i] < 0) continue;
    const info = fretToNote(i + 1, frets[i]);
    if (info) found.add(info.note);
  }
  for (const pc of pitchClasses) {
    if (!found.has(pc)) return false;
  }
  return true;
}

/**
 * Convert a fret array [f1..f6] to a fingering array for ChordBox.
 */
function fretsToFingering(frets) {
  const fretted = frets.filter(f => f > 0);
  const minFret = fretted.length > 0 ? Math.min(...fretted) : 1;

  return frets.map((fret, i) => {
    const stringNumber = i + 1;
    if (fret < 0) return null; // muted, excluded
    let finger = 0;
    if (fret > 0) {
      finger = Math.min(4, Math.max(1, fret - minFret + 1));
    }
    return { string: stringNumber, fret, finger };
  }).filter(Boolean);
}

/**
 * Generate a signature string for deduplication.
 */
function voicingSignature(frets) {
  return frets.join(',');
}

/**
 * Generate multiple voicings for a chord.
 * Takes the original chord (for its pitch classes) and returns an array
 * of chord objects with different fingerings.
 */
export function generateVoicings(chord) {
  if (!chord?.fingering) return [chord];

  const pitchClasses = chordPitchClasses(chord.fingering);
  if (pitchClasses.size === 0) return [chord];

  const options = findFretOptions(pitchClasses);
  const voicings = [];
  const seen = new Set();

  // Add the original voicing first
  const origFrets = Array(6).fill(-1);
  for (const f of chord.fingering) {
    origFrets[f.string - 1] = f.fret;
  }
  seen.add(voicingSignature(origFrets));
  voicings.push(chord);

  // Search by sliding a position window up the neck
  for (let posStart = 0; posStart <= NUM_FRETS - MAX_SPAN; posStart++) {
    const posEnd = posStart + MAX_SPAN;

    // For this position, find valid fret choices per string
    const posOptions = options.map(stringFrets =>
      stringFrets.filter(f => f === -1 || f === 0 || (f >= posStart && f <= posEnd))
    );

    // Try combinations — use a DFS with pruning
    // To keep it fast, limit strings that can be muted (at most 2)
    const tryCombo = (stringIdx, current, mutedCount) => {
      if (voicings.length >= MAX_VOICINGS) return;
      if (stringIdx === 6) {
        const playedCount = current.filter(f => f >= 0).length;
        if (playedCount < 3) return; // need at least 3 strings
        if (!coversAllPitchClasses(current, pitchClasses)) return;
        if (!isPlayable(current)) return;
        const sig = voicingSignature(current);
        if (seen.has(sig)) return;
        seen.add(sig);

        const fingering = fretsToFingering([...current]);
        voicings.push({
          ...chord,
          id: `${chord.id}-v${voicings.length}`,
          name: chord.name,
          fingering,
        });
        return;
      }

      for (const fret of posOptions[stringIdx]) {
        if (fret === -1 && mutedCount >= 2) continue; // limit muted strings
        current.push(fret);
        tryCombo(stringIdx + 1, current, mutedCount + (fret === -1 ? 1 : 0));
        current.pop();
        if (voicings.length >= MAX_VOICINGS) return;
      }
    };

    tryCombo(0, [], 0);
    if (voicings.length >= MAX_VOICINGS) break;
  }

  return voicings;
}
