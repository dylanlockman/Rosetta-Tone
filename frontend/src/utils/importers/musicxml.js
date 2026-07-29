// MusicXML importer → canonical Score.
//
// Handles .musicxml / .xml (plain) and .mxl (zip-compressed) files using the
// browser's native DOMParser. Reads pitches, durations, chords, ties, voices
// (via backup/forward), harmony chord symbols, lyrics, tempo, time signature,
// and key. Guitar-flavored MusicXML that carries <string>/<fret> technical
// annotations keeps them; everything else goes through fret inference.

import { unzipSync, strFromU8 } from 'fflate';
import { createScore, createEvent } from '../score.js';
import { noteToMidi } from '../musicTheory.js';
import { inferFrets } from '../fretInference.js';

const STEP_ALTER_TO_PC = (step, alter) => {
  const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return ((BASE[step] + alter) % 12 + 12) % 12;
};

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Circle of fifths → major key root
const FIFTHS_TO_MAJOR = {
  '-7': 'B', '-6': 'F#', '-5': 'C#', '-4': 'G#', '-3': 'D#', '-2': 'A#', '-1': 'F',
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
};

function text(el, selector) {
  const child = el.querySelector(selector);
  return child ? child.textContent.trim() : null;
}

function num(el, selector) {
  const t = text(el, selector);
  return t == null ? null : Number(t);
}

// Extract the score-partwise XML string from raw bytes (.mxl is a zip whose
// META-INF/container.xml points at the real score file).
function extractXml(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // Zip magic: PK\x03\x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes);
    const container = files['META-INF/container.xml'];
    let scorePath = null;
    if (container) {
      const doc = new DOMParser().parseFromString(strFromU8(container), 'text/xml');
      scorePath = doc.querySelector('rootfile')?.getAttribute('full-path') ?? null;
    }
    if (!scorePath || !files[scorePath]) {
      scorePath = Object.keys(files).find(
        p => !p.startsWith('META-INF') && /\.(musicxml|xml)$/i.test(p)
      );
    }
    if (!scorePath) throw new Error('No score file found inside .mxl archive');
    return strFromU8(files[scorePath]);
  }
  return strFromU8(bytes);
}

function parseHarmony(harmonyEl) {
  const rootStep = text(harmonyEl, 'root > root-step');
  if (!rootStep) return null;
  const rootAlter = num(harmonyEl, 'root > root-alter') ?? 0;
  const kind = harmonyEl.querySelector('kind');
  const kindText = kind?.getAttribute('text') ?? null;
  const kindValue = kind?.textContent.trim() ?? '';
  const KIND_SUFFIX = {
    major: '', minor: 'm', dominant: '7', 'major-seventh': 'maj7',
    'minor-seventh': 'm7', 'dominant-seventh': '7', augmented: 'aug',
    diminished: 'dim', 'half-diminished': 'm7b5', 'suspended-fourth': 'sus4',
    'suspended-second': 'sus2', 'major-sixth': '6', 'minor-sixth': 'm6',
  };
  const suffix = kindText ?? KIND_SUFFIX[kindValue] ?? '';
  const pc = STEP_ALTER_TO_PC(rootStep, rootAlter);
  return `${PC_NAMES[pc]}${suffix}`;
}

// Parse a MusicXML string (or bytes) into a canonical Score.
// Merges all parts onto one timeline (RosettaTone is single-track for now).
export function musicXmlToScore(data, meta = {}) {
  const xml = typeof data === 'string' ? data : extractXml(data);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Not valid MusicXML');
  }
  const partwise = doc.querySelector('score-partwise');
  if (!partwise) {
    throw new Error('Only score-partwise MusicXML is supported');
  }

  const title = meta.title
    ?? text(doc, 'work > work-title')
    ?? text(doc, 'movement-title');
  const artist = meta.artist
    ?? doc.querySelector('identification creator[type="composer"]')?.textContent.trim()
    ?? null;

  const score = createScore({ ...meta, title, artist, source: 'musicxml' });
  const events = [];

  let bpm = null;
  let timeSignature = null;
  let keyRoot = null;
  let keyMode = null;

  for (const part of partwise.querySelectorAll(':scope > part')) {
    let divisions = 1;           // MusicXML ticks per quarter note
    let measureStart = 0;        // quarter-note beats at the top of this measure
    let cursor = 0;              // quarter-note beats within the timeline
    let currentChordSymbol = null;
    let pendingTies = new Map(); // midi → event awaiting tie-stop

    for (const measure of part.querySelectorAll(':scope > measure')) {
      cursor = measureStart;
      let measureLen = 0;

      for (const el of measure.children) {
        switch (el.tagName) {
          case 'attributes': {
            divisions = num(el, 'divisions') ?? divisions;
            const beatsN = num(el, 'time > beats');
            const beatsD = num(el, 'time > beat-type');
            if (beatsN && beatsD && !timeSignature) timeSignature = [beatsN, beatsD];
            const fifths = num(el, 'key > fifths');
            if (fifths != null && keyRoot == null) {
              keyRoot = FIFTHS_TO_MAJOR[fifths] ?? null;
              keyMode = text(el, 'key > mode') ?? 'major';
            }
            break;
          }
          case 'direction': {
            const tempo = el.querySelector('sound[tempo]')?.getAttribute('tempo');
            if (tempo && bpm == null) bpm = Number(tempo);
            break;
          }
          case 'sound': {
            const tempo = el.getAttribute('tempo');
            if (tempo && bpm == null) bpm = Number(tempo);
            break;
          }
          case 'harmony': {
            const symbol = parseHarmony(el);
            if (symbol) currentChordSymbol = symbol;
            break;
          }
          case 'backup':
            cursor -= (num(el, 'duration') ?? 0) / divisions;
            break;
          case 'forward':
            cursor += (num(el, 'duration') ?? 0) / divisions;
            break;
          case 'note': {
            const durBeats = (num(el, 'duration') ?? 0) / divisions;
            const isChordNote = el.querySelector('chord') != null;
            const start = isChordNote ? Math.max(measureStart, cursor - durBeats) : cursor;

            if (!el.querySelector('rest') && !el.querySelector('grace')) {
              const step = text(el, 'pitch > step');
              const octave = num(el, 'pitch > octave');
              const alter = num(el, 'pitch > alter') ?? 0;
              if (step != null && octave != null) {
                const pc = STEP_ALTER_TO_PC(step, alter);
                const note = PC_NAMES[pc];
                // MusicXML octave matches scientific pitch for C-based naming;
                // adjust when alteration wraps around B/C boundary.
                let oct = octave;
                if (step === 'B' && alter > 0) oct += 1;
                if (step === 'C' && alter < 0) oct -= 1;
                const midi = noteToMidi(note, oct);

                const tieStop = el.querySelector('tie[type="stop"]') != null;
                const tieStart = el.querySelector('tie[type="start"]') != null;

                if (tieStop && pendingTies.has(midi)) {
                  // Extend the tied-from event instead of creating a new one.
                  const prev = pendingTies.get(midi);
                  prev.duration += durBeats;
                  if (!tieStart) pendingTies.delete(midi);
                } else {
                  const ev = createEvent({
                    start,
                    duration: durBeats,
                    note,
                    octave: oct,
                    midi,
                    string: num(el, 'notations technical string'),
                    fret: num(el, 'notations technical fret'),
                    lyric: text(el, 'lyric > text'),
                    chordSymbol: currentChordSymbol,
                  });
                  currentChordSymbol = null;
                  events.push(ev);
                  if (tieStart) pendingTies.set(midi, ev);
                }
              }
            }

            if (!isChordNote) cursor += durBeats;
            measureLen = Math.max(measureLen, cursor - measureStart);
            break;
          }
          default:
            break;
        }
        measureLen = Math.max(measureLen, cursor - measureStart);
      }

      // Advance by the measure's content length (handles pickup bars), or the
      // nominal bar length for empty measures.
      const ts = timeSignature ?? [4, 4];
      const nominal = (ts[0] * 4) / ts[1];
      measureStart += measureLen > 0 ? measureLen : nominal;
    }
  }

  events.sort((a, b) => a.start - b.start || a.midi - b.midi);
  score.events = events;
  score.meta.bpm = bpm;
  score.meta.timeSignature = timeSignature ?? [4, 4];
  score.meta.keyRoot = keyRoot;
  score.meta.keyMode = keyMode;

  inferFrets(score);
  return score;
}
