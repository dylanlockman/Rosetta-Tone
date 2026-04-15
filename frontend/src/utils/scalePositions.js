// Compute CAGED-style fretboard positions and diagonal patterns for scales.
//
// A "position" is a group of scale notes spanning ~4-5 frets where the hand
// can play without shifting. We compute positions by finding all playable
// scale notes on each string within a fret window, then sliding the window
// up the neck.

import { STANDARD_TUNING, fretToNote, noteToMidi, CHROMATIC_SCALE } from './musicTheory.js';

const NUM_FRETS = 24;
const POSITION_SPAN = 4; // frets a hand can cover (index to pinky)

/**
 * Compute all fretboard positions where scale notes appear.
 * Returns: [{ string: 1-6, fret: 0-24, note, octave, midi }]
 */
export function computeScaleFretPositions(scaleNotes) {
  if (!scaleNotes || scaleNotes.length === 0) return [];
  const scaleSet = new Set(scaleNotes);
  const positions = [];
  for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
    const stringNumber = stringIdx + 1;
    for (let fret = 0; fret <= NUM_FRETS; fret++) {
      const info = fretToNote(stringNumber, fret);
      if (!info) continue;
      if (scaleSet.has(info.note)) {
        positions.push({
          string: stringNumber,
          stringIdx,
          fret,
          note: info.note,
          octave: info.octave,
          midi: noteToMidi(info.note, info.octave),
        });
      }
    }
  }
  return positions;
}

/**
 * Compute CAGED positions (box patterns) for a scale.
 *
 * Strategy: find root note positions on strings 5 and 6, then build a box
 * around each one spanning POSITION_SPAN frets. Each box includes all scale
 * notes on all 6 strings within that fret window.
 *
 * Returns up to 5-7 positions, each: { startFret, endFret, notes: [...] }
 */
export function computeCagedPositions(scaleNotes) {
  const allPositions = computeScaleFretPositions(scaleNotes);
  if (allPositions.length === 0) return [];

  const root = scaleNotes[0];

  // Find all root note frets on strings 5 and 6 (bass strings)
  const rootFrets = new Set();
  for (const pos of allPositions) {
    if ((pos.string === 5 || pos.string === 6) && pos.note === root) {
      rootFrets.add(pos.fret);
    }
  }

  // Also consider fret 0 and positions that give good coverage
  // Build positions centered around each root fret
  const boxes = [];
  const usedStarts = new Set();

  // Sort root frets and build a box for each
  const sortedRoots = [...rootFrets].sort((a, b) => a - b);

  for (const rootFret of sortedRoots) {
    // Try centering the box so the root is reachable
    // The start fret should be at or just below the root
    let startFret = Math.max(0, rootFret - 1);

    // Avoid duplicate/overlapping boxes
    if (usedStarts.has(startFret)) {
      startFret = rootFret;
    }
    if (usedStarts.has(startFret)) continue;

    const endFret = startFret + POSITION_SPAN;
    if (endFret > NUM_FRETS) continue;

    usedStarts.add(startFret);

    // Collect all scale notes in this fret window (include open strings = fret 0 for position starting at 0)
    const notes = allPositions.filter(p => {
      if (startFret === 0) return p.fret >= 0 && p.fret <= endFret;
      return p.fret >= startFret && p.fret <= endFret;
    });

    if (notes.length > 0) {
      boxes.push({ startFret, endFret, notes });
    }
  }

  // Fill gaps: if there are large gaps between positions, add intermediate boxes
  if (boxes.length >= 2) {
    const filled = [...boxes];
    filled.sort((a, b) => a.startFret - b.startFret);

    const gaps = [];
    for (let i = 0; i < filled.length - 1; i++) {
      const gapStart = filled[i].endFret;
      const gapEnd = filled[i + 1].startFret;
      if (gapEnd - gapStart > 2) {
        const mid = Math.floor((gapStart + gapEnd) / 2);
        const s = Math.max(0, mid - Math.floor(POSITION_SPAN / 2));
        if (!usedStarts.has(s)) {
          const notes = allPositions.filter(p => p.fret >= s && p.fret <= s + POSITION_SPAN);
          if (notes.length > 0) {
            gaps.push({ startFret: s, endFret: s + POSITION_SPAN, notes });
            usedStarts.add(s);
          }
        }
      }
    }
    filled.push(...gaps);
    filled.sort((a, b) => a.startFret - b.startFret);
    return filled;
  }

  boxes.sort((a, b) => a.startFret - b.startFret);
  return boxes;
}

/**
 * Compute diagonal (3-notes-per-string) patterns.
 * Each pattern starts on a different scale degree and runs diagonally
 * across all 6 strings with 3 notes per string.
 *
 * Returns: [{ startDegree, notes: [{ string, fret, note, octave }] }]
 */
export function computeDiagonalPatterns(scaleNotes) {
  const allPositions = computeScaleFretPositions(scaleNotes);
  if (allPositions.length === 0) return [];

  // Group positions by string
  const byString = {};
  for (let s = 1; s <= 6; s++) byString[s] = [];
  for (const p of allPositions) {
    byString[p.string].push(p);
  }
  // Sort each string's notes by fret
  for (let s = 1; s <= 6; s++) {
    byString[s].sort((a, b) => a.fret - b.fret);
  }

  const patterns = [];
  const scaleLen = scaleNotes.length;

  // Build patterns starting from different positions on string 6
  // Each pattern takes 3 consecutive scale notes per string
  const string6Notes = byString[6];
  const usedStartFrets = new Set();

  for (let startIdx = 0; startIdx < Math.min(string6Notes.length, scaleLen); startIdx++) {
    const startNote = string6Notes[startIdx];
    if (usedStartFrets.has(startNote.fret)) continue;
    usedStartFrets.add(startNote.fret);

    const pattern = [];
    let currentFretMin = startNote.fret;

    // For each string (6 down to 1), find 3 consecutive scale notes
    // starting from approximately the current fret position
    let valid = true;
    for (let s = 6; s >= 1; s--) {
      const stringNotes = byString[s].filter(n => n.fret >= currentFretMin - 1);
      if (stringNotes.length < 3) {
        valid = false;
        break;
      }
      const three = stringNotes.slice(0, 3);
      pattern.push(...three);
      // Next string starts roughly where this one left off
      currentFretMin = three[three.length - 1].fret - 1;
    }

    if (valid && pattern.length >= 15) {
      patterns.push({
        startFret: startNote.fret,
        notes: pattern,
      });
    }
  }

  return patterns;
}
