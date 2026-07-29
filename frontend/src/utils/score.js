// Canonical Score model — the single internal representation that every
// importer (ASCII tab, MusicXML, MIDI) targets and every view consumes.
//
// Score = {
//   version: 1,
//   meta: {
//     title, artist,
//     source: 'ascii-tab' | 'musicxml' | 'midi',
//     bpm: number | null,          // tempo from the source, if it carried one
//     timeSignature: [num, den],   // e.g. [4, 4]
//     keyRoot: string | null,      // e.g. 'G'
//     keyMode: 'major' | 'minor' | null,
//   },
//   events: [{
//     start: number,      // quarter-note beats from the top of the piece
//     duration: number,   // quarter-note beats
//     midi: number,
//     note: string,       // pitch class, e.g. 'C#'
//     octave: number,
//     string: number|null,  // 1 = high E .. 6 = low E (null until fret inference)
//     fret: number|null,
//     lyric: string|null,
//     chordSymbol: string|null,  // harmony annotation, e.g. 'Am7'
//   }]
// }
//
// The symmetry that gives the app its name: tab sources arrive with
// string/fret but need duration inference; sheet sources arrive with
// durations but need string/fret inference.

import { noteToMidi, midiToNote } from './musicTheory.js';

export const SCORE_VERSION = 1;

// Events are "simultaneous" only when their starts effectively coincide.
// This must be strictly SMALLER than the sixteenth quantization grid (0.25):
// a wider window merges adjacent grid slots, manufacturing impossible
// same-string "chords" out of sequential notes like hammer-on pairs.
const START_EPSILON = 0.125;

export function createScore(meta = {}, events = []) {
  return {
    version: SCORE_VERSION,
    meta: {
      title: meta.title ?? null,
      artist: meta.artist ?? null,
      source: meta.source ?? 'ascii-tab',
      bpm: meta.bpm ?? null,
      timeSignature: meta.timeSignature ?? [4, 4],
      keyRoot: meta.keyRoot ?? null,
      keyMode: meta.keyMode ?? null,
      // Capo fret from the source. Events are stored capo-RELATIVE (exactly
      // as written in the tab); the capo shift is applied when beats are
      // derived, so sounding pitch and fretboard positions come out true.
      capo: meta.capo ?? 0,
    },
    events,
  };
}

// Build a normalized event; fills midi from note/octave or vice versa.
export function createEvent({ start, duration, midi, note, octave, string = null, fret = null, lyric = null, chordSymbol = null, technique = null }) {
  if (midi == null && note != null && octave != null) {
    midi = noteToMidi(note, octave);
  }
  if ((note == null || octave == null) && midi != null) {
    const info = midiToNote(midi);
    note = info.note;
    octave = info.octave;
  }
  return { start, duration, midi, note, octave, string, fret, lyric, chordSymbol, technique };
}

// Group score events into the beat list the views subscribe to.
// Events whose starts fall within a sixteenth of each other are simultaneous.
// Returns [{ beatIndex, start, duration, notes: [...] }] sorted by start.
export function scoreToBeats(score) {
  if (!score?.events?.length) return [];
  const sorted = [...score.events].sort((a, b) => a.start - b.start || a.midi - b.midi);

  const beats = [];
  let current = null;
  for (const ev of sorted) {
    if (!current || ev.start - current.start > START_EPSILON) {
      current = { beatIndex: beats.length, start: ev.start, duration: 0, notes: [] };
      beats.push(current);
    }
    current.notes.push({
      note: ev.note,
      octave: ev.octave,
      midi: ev.midi,
      string: ev.string,
      fret: ev.fret,
      duration: ev.duration,
      lyric: ev.lyric,
      chordSymbol: ev.chordSymbol,
      technique: ev.technique ?? null,
      beatIndex: current.beatIndex,
    });
    current.duration = Math.max(current.duration, ev.duration);
  }
  return beats;
}

export function serializeScore(score) {
  return JSON.stringify(score);
}

// Parse stored parsed_json back into a Score; returns null on any problem so
// callers can fall back to re-parsing raw_content.
export function deserializeScore(json) {
  if (!json) return null;
  try {
    const score = typeof json === 'string' ? JSON.parse(json) : json;
    if (!score || !Array.isArray(score.events) || !score.meta) return null;
    return score;
  } catch {
    return null;
  }
}

// Total length in quarter-note beats (for scrubber/progress UI).
export function scoreDuration(score) {
  if (!score?.events?.length) return 0;
  return score.events.reduce((max, ev) => Math.max(max, ev.start + ev.duration), 0);
}
