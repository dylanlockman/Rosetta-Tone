// ROYGBIV octave-based coloring for scale visualization.
// Each pass through the scale (root to next root) gets a rainbow color.
// Boundary notes (where two runs meet) are marked for split-color rendering.

import { CHROMATIC_SCALE } from './musicTheory.js';

// Red → Orange → Yellow → Green → Blue → Indigo → Violet (lowest to highest)
export const OCTAVE_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
];

export function getOctaveColor(runIndex) {
  return OCTAVE_COLORS[Math.min(runIndex, OCTAVE_COLORS.length - 1)] ?? OCTAVE_COLORS[OCTAVE_COLORS.length - 1];
}

/**
 * Compute octave-run data for every note in a scale across an octave range.
 * Returns an array of { note, octave, pitchClass, runIndex, isBoundary, prevRunIndex }.
 *
 * A "run" is one pass from root up to (but not including) the next root.
 * The root note at the top of run N is also the start of run N+1 → boundary note.
 *
 * @param {string[]} scaleNotes - pitch classes in order, e.g. ['C','D','E','F','G','A','B']
 * @param {number} startOctave - lowest octave to include (e.g. 2 for guitar low E)
 * @param {number} endOctave - highest octave to include (e.g. 6)
 */
export function computeScaleOctaveRuns(scaleNotes, startOctave = 2, endOctave = 6) {
  if (!scaleNotes || scaleNotes.length === 0) return [];

  const root = scaleNotes[0];
  const scaleSet = new Set(scaleNotes);
  const results = [];

  // Walk through every chromatic pitch from startOctave to endOctave
  // and tag scale members with their run index
  let runIndex = 0;
  let prevNoteWasRoot = false;

  for (let octave = startOctave; octave <= endOctave; octave++) {
    for (let chromIdx = 0; chromIdx < 12; chromIdx++) {
      const pitchClass = CHROMATIC_SCALE[chromIdx];
      if (!scaleSet.has(pitchClass)) continue;

      const isRoot = pitchClass === root;

      // When we hit the root above the very first one, we start a new run
      // but the root itself is a boundary (belongs to both runs)
      if (isRoot && results.length > 0) {
        results.push({
          note: pitchClass,
          octave,
          pitchClass,
          runIndex,
          isBoundary: true,
          prevRunIndex: runIndex - 1 >= 0 ? runIndex - 1 : 0,
        });
        runIndex++;
      } else {
        results.push({
          note: pitchClass,
          octave,
          pitchClass,
          runIndex,
          isBoundary: false,
          prevRunIndex: runIndex,
        });
      }
    }
  }

  return results;
}

/**
 * Look up the run info for a specific note+octave from precomputed runs.
 * Returns { runIndex, isBoundary, prevRunIndex } or null if not in the scale.
 */
export function getRunInfo(scaleOctaveRuns, pitchClass, octave) {
  return scaleOctaveRuns.find(r => r.pitchClass === pitchClass && r.octave === octave) ?? null;
}
