// MIDI importer → canonical Score.
//
// Uses @tonejs/midi for file parsing. All non-percussion tracks are merged
// onto one timeline; starts/durations are converted from ticks to quarter-note
// beats, quantized to a sixteenth grid so simultaneous-ish notes group into
// beats cleanly. String/fret come from fret inference.

// Interop-safe import: Vite resolves the ESM build (named exports), while
// Node (used for quick script tests) falls back to the CJS default export.
import * as MidiPkg from '@tonejs/midi';
const { Midi } = MidiPkg.Midi ? MidiPkg : MidiPkg.default;
import { createScore, createEvent } from '../score.js';
import { midiToNote } from '../musicTheory.js';
import { inferFrets } from '../fretInference.js';

const QUANT = 0.25; // sixteenth-note grid

function quantize(beats) {
  return Math.round(beats / QUANT) * QUANT;
}

// data: ArrayBuffer or Uint8Array of a .mid file
export function midiToScore(data, meta = {}) {
  const midi = new Midi(data);

  const bpm = midi.header.tempos?.[0]?.bpm
    ? Math.round(midi.header.tempos[0].bpm)
    : null;
  const tsEvent = midi.header.timeSignatures?.[0]?.timeSignature;
  const timeSignature = tsEvent ? [tsEvent[0], tsEvent[1]] : [4, 4];
  const ppq = midi.header.ppq || 480;

  const score = createScore({
    ...meta,
    title: meta.title ?? midi.header.name ?? null,
    source: 'midi',
    bpm,
    timeSignature,
  });

  const events = [];
  for (const track of midi.tracks) {
    if (track.instrument?.percussion) continue;
    for (const n of track.notes) {
      const start = quantize(n.ticks / ppq);
      const duration = Math.max(QUANT, quantize(n.durationTicks / ppq));
      const { note, octave } = midiToNote(n.midi);
      events.push(createEvent({ start, duration, midi: n.midi, note, octave }));
    }
  }

  if (events.length === 0) {
    throw new Error('No playable notes found in this MIDI file');
  }

  // Dedupe identical (start, midi) collisions from doubled tracks.
  const seen = new Set();
  score.events = events
    .sort((a, b) => a.start - b.start || a.midi - b.midi)
    .filter(ev => {
      const key = `${ev.start}:${ev.midi}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  inferFrets(score);
  return score;
}
