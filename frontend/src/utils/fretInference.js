// Fret inference: assign string/fret positions to score events that arrived
// without them (MusicXML, MIDI). This is the mirror image of what the tab
// parser does for durations — sheet sources know *when*, we must decide *where*.
//
// Approach: beam search over beat groups. Each group enumerates collision-free
// (string, fret) assignments for its notes; candidates are scored on:
//   - fret span within the group (a hand can only stretch so far)
//   - movement from the previous group's hand position (minimize shifting)
//   - preference for lower positions and open strings
// A small beam of alternative hand positions is kept so a cheap-now choice
// that forces a big jump later can lose to a better path.

import { STANDARD_TUNING, noteToMidi } from './musicTheory.js';

const MAX_FRET = 22;
const PREFERRED_MAX_FRET = 12;
const BEAM_WIDTH = 8;
const MAX_ASSIGNMENTS_PER_GROUP = 24;

// Open-string MIDI numbers indexed by string number (1 = high E .. 6 = low E)
const OPEN_MIDI = STANDARD_TUNING.map(t => noteToMidi(t.note, t.octave));

export function candidatesForMidi(midi) {
  const out = [];
  for (let s = 1; s <= 6; s++) {
    const fret = midi - OPEN_MIDI[s - 1];
    if (fret >= 0 && fret <= MAX_FRET) out.push({ string: s, fret });
  }
  return out;
}

// Enumerate collision-free assignments for a group of notes (each note gets a
// distinct string). Returns up to MAX_ASSIGNMENTS_PER_GROUP options, cheapest
// local cost first. Notes that cannot fit are left unassigned (null).
function enumerateAssignments(notes) {
  // Guitar has 6 strings; if the source has a wider chord (piano!), keep the
  // bass note and the top voices — the rest stay piano-only.
  let playable = notes
    .map(n => ({ note: n, candidates: candidatesForMidi(n.midi) }))
    .filter(x => x.candidates.length > 0);
  if (playable.length > 6) {
    playable.sort((a, b) => a.note.midi - b.note.midi);
    playable = [playable[0], ...playable.slice(-5)];
  }
  // Assign low notes first — they have the fewest string options.
  playable.sort((a, b) => a.candidates.length - b.candidates.length || a.note.midi - b.note.midi);

  const results = [];
  const current = [];

  function localCost(assignment) {
    const fretted = assignment.filter(a => a.fret > 0);
    const span = fretted.length > 1
      ? Math.max(...fretted.map(a => a.fret)) - Math.min(...fretted.map(a => a.fret))
      : 0;
    const height = fretted.length
      ? fretted.reduce((sum, a) => sum + a.fret, 0) / fretted.length
      : 0;
    const opens = assignment.length - fretted.length;
    const high = fretted.filter(a => a.fret > PREFERRED_MAX_FRET).length;
    return span * 3 + height * 0.3 + high * 2 - opens * 1;
  }

  function recurse(idx, usedStrings) {
    if (results.length >= MAX_ASSIGNMENTS_PER_GROUP * 4) return;
    if (idx === playable.length) {
      results.push({ assignment: current.map(a => ({ ...a })), cost: localCost(current) });
      return;
    }
    const { note, candidates } = playable[idx];
    for (const c of candidates) {
      if (usedStrings.has(c.string)) continue;
      // A hand can't span more than ~5 frets — prune early.
      const fretted = current.filter(a => a.fret > 0);
      if (c.fret > 0 && fretted.length > 0) {
        const min = Math.min(...fretted.map(a => a.fret), c.fret);
        const max = Math.max(...fretted.map(a => a.fret), c.fret);
        if (max - min > 5) continue;
      }
      usedStrings.add(c.string);
      current.push({ note, string: c.string, fret: c.fret });
      recurse(idx + 1, usedStrings);
      current.pop();
      usedStrings.delete(c.string);
    }
  }

  recurse(0, new Set());
  results.sort((a, b) => a.cost - b.cost);
  return results.slice(0, MAX_ASSIGNMENTS_PER_GROUP);
}

function handPosition(assignment, fallback) {
  const fretted = assignment.filter(a => a.fret > 0);
  if (fretted.length === 0) return fallback;
  return fretted.reduce((sum, a) => sum + a.fret, 0) / fretted.length;
}

// Group events by (quantized) start time, preserving event references.
function groupByStart(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.midi - b.midi);
  const groups = [];
  let cur = null;
  for (const ev of sorted) {
    if (!cur || ev.start - cur.start > 0.26) {
      cur = { start: ev.start, events: [] };
      groups.push(cur);
    }
    cur.events.push(ev);
  }
  return groups;
}

// Mutates score.events in place, filling string/fret where playable.
// Events already carrying a fret (e.g. from guitar MusicXML) are respected.
export function inferFrets(score) {
  const needy = score.events.filter(ev => ev.string == null || ev.fret == null);
  if (needy.length === 0) return score;

  const groups = groupByStart(needy);

  // Beam states: { cost, pos, choices: [assignment per group] }
  let beam = [{ cost: 0, pos: 3, choices: [] }];

  for (const group of groups) {
    const options = enumerateAssignments(group.events);
    if (options.length === 0) {
      // Nothing in this group is guitar-playable; carry states forward.
      beam = beam.map(st => ({ ...st, choices: [...st.choices, null] }));
      continue;
    }
    const nextBeam = [];
    for (const st of beam) {
      for (const opt of options) {
        const pos = handPosition(opt.assignment, st.pos);
        const movement = Math.abs(pos - st.pos);
        nextBeam.push({
          cost: st.cost + opt.cost + movement * 2,
          pos,
          choices: [...st.choices, opt.assignment],
        });
      }
    }
    nextBeam.sort((a, b) => a.cost - b.cost);
    beam = nextBeam.slice(0, BEAM_WIDTH);
  }

  const best = beam[0];
  if (!best) return score;

  groups.forEach((group, i) => {
    const assignment = best.choices[i];
    if (!assignment) return;
    for (const a of assignment) {
      a.note.string = a.string;
      a.note.fret = a.fret;
    }
  });

  return score;
}
