import { fretToNote, noteToMidi } from './musicTheory.js';
import { createScore, createEvent, scoreToBeats } from './score.js';

// Parse standard ASCII guitar tab into the canonical Score model.
//
// Input format example:
//   e|---0---2---3---|---0---|
//   B|---1---3---0---|---1---|
//   ...
//
// Timing inference:
//   - Bar lines split each stave into measures. Each measure spans one bar of
//     the time signature (4 quarter-note beats in 4/4). An event's start is
//     proportional to its column within the measure, quantized to sixteenths.
//   - Staves without internal bar lines fall back to uniform eighth notes.
//   - An event rings until the next event on any string (or the bar ends).
//
// Technique characters (h p b r s x ~ / \) are tolerated: they don't break
// number scanning, and 'x' (muted hit) produces no note event.

const STRING_LABEL_RE = /^\s*([eEbBgGdDaA])\s*(\|)/;
const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/; // [Intro], [Verse 1], [Solo] …
// "CAPO 7", "Capo: 7", "capo on 1st fret", "(with capo on 2nd fret)" …
const CAPO_RE = /capo\D{0,12}?(\d{1,2})/i;
const BEAT_QUANT = 0.25; // sixteenth-note grid

function isTabLine(line) {
  return STRING_LABEL_RE.test(line);
}

// Identify groups of 6 consecutive tab lines (a "stave"), keeping track of
// [Section] label lines so each stave knows which song section it belongs to.
// Returns [{ lines: [6 lines], section: string|null }].
function findStaves(lines) {
  const staves = [];
  let current = [];
  let pendingSection = null;
  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      pendingSection = sectionMatch[1].trim();
      current = [];
      continue;
    }
    if (isTabLine(line)) {
      current.push(line);
      if (current.length === 6) {
        staves.push({ lines: current, section: pendingSection });
        pendingSection = null; // only the first stave after a label starts the section
        current = [];
      }
    } else if (current.length > 0) {
      // Reset partial stave on non-tab line
      current = [];
    }
  }
  return staves;
}

// Determine string number for each line in a stave (1=high E .. 6=low E).
// Standard order in tab is e B G D A E (top to bottom).
function getStringMapping(stave) {
  const labels = stave.map(line => {
    const m = line.match(STRING_LABEL_RE);
    return m ? m[1].toLowerCase() : null;
  });

  const standardOrder = ['e', 'b', 'g', 'd', 'a', 'e'];
  if (labels.every((l, i) => l === standardOrder[i])) {
    return [1, 2, 3, 4, 5, 6]; // top to bottom
  }

  const reversedOrder = ['e', 'a', 'd', 'g', 'b', 'e'];
  if (labels.every((l, i) => l === reversedOrder[i])) {
    return [6, 5, 4, 3, 2, 1];
  }

  return [1, 2, 3, 4, 5, 6];
}

// Strip the leading "X|" prefix so all lines start at column 0 of the body.
function stripPrefix(line) {
  const m = line.match(/^[^|]*\|(.*)$/);
  return m ? m[1] : line;
}

// Split the 6 aligned bodies into measures on shared bar-line columns.
// Returns an array of measures, each an array of 6 string segments.
function splitMeasures(padded) {
  const len = padded[0].length;
  const barCols = [];
  for (let col = 0; col < len; col++) {
    if (padded.every(line => line[col] === '|')) barCols.push(col);
  }

  // Only a terminating bar line (or none at all) means the stave carries no
  // internal timing structure — let the caller use the uniform-eighths
  // fallback instead of squeezing the whole stave into one bar.
  const internal = barCols.filter(c => c < len * 0.9);
  if (internal.length === 0) return null;

  const measures = [];
  let prev = 0;
  for (const col of [...barCols, len]) {
    if (col > prev) {
      const segs = padded.map(line => line.slice(prev, col));
      // Skip empty/decorative segments (all dashes)
      if (segs.some(s => /\d/.test(s))) measures.push(segs);
      else if (segs.some(s => /[^-|]/.test(s))) measures.push(segs);
    }
    prev = col + 1;
  }
  return measures.length > 0 ? measures : null;
}

// Scan one measure's 6 segments for fret events.
// Returns [{ col, stringNumber, fret }], plus the segment width.
function scanMeasure(segments, stringMap) {
  const width = Math.max(...segments.map(s => s.length));
  const events = [];
  for (let lineIdx = 0; lineIdx < 6; lineIdx++) {
    const seg = segments[lineIdx];
    let col = 0;
    while (col < seg.length) {
      const ch = seg[col];
      if (ch >= '0' && ch <= '9') {
        let numStr = ch;
        let lookahead = col + 1;
        while (lookahead < seg.length && seg[lookahead] >= '0' && seg[lookahead] <= '9') {
          numStr += seg[lookahead];
          lookahead++;
        }
        // A technique char directly before the number, itself preceded by a
        // digit, marks how this note is articulated: 7h9, 9p7, 5/7 …
        let technique = null;
        const before = col > 0 ? seg[col - 1] : '';
        const beforeThat = col > 1 ? seg[col - 2] : '';
        if (beforeThat >= '0' && beforeThat <= '9') {
          if (before === 'h' || before === 'H') technique = 'hammer';
          else if (before === 'p' || before === 'P') technique = 'pull';
          else if (before === '/' || before === '\\' || before === 's') technique = 'slide';
        }
        events.push({ col, stringNumber: stringMap[lineIdx], fret: parseInt(numStr, 10), technique });
        col = lookahead;
      } else {
        col++; // dashes, technique chars (h p b r s ~ / \), muted 'x'
      }
    }
  }
  return { events, width };
}

function quantize(beat) {
  return Math.round(beat / BEAT_QUANT) * BEAT_QUANT;
}

// Convert positioned fret events into timed Score events.
function timeMeasure(measureEvents, width, measureStartBeat, beatsPerBar) {
  // Column → beat within the bar, proportional to position, sixteenth-quantized
  const timed = measureEvents.map(ev => ({
    ...ev,
    start: measureStartBeat + quantize((ev.col / Math.max(1, width)) * beatsPerBar),
  }));

  // Sequential notes on ONE string (hammer-on/pull-off pairs like 7h9 in a
  // dense bar) can quantize onto the same grid slot — a physical
  // impossibility that also hides one number behind the other in the tab.
  // Push the later note forward one grid step so the order survives.
  const lastStartByString = new Map();
  for (const ev of timed) { // per-string column order is preserved by scanMeasure
    const prev = lastStartByString.get(ev.stringNumber);
    if (prev != null && ev.start <= prev) {
      ev.start = prev + BEAT_QUANT;
    }
    lastStartByString.set(ev.stringNumber, ev.start);
  }

  // Group starts to compute ring-out durations: each onset rings until the
  // next onset anywhere (or the end of the bar).
  const starts = [...new Set(timed.map(e => e.start))].sort((a, b) => a - b);
  const nextStart = new Map();
  starts.forEach((s, i) => {
    nextStart.set(s, i + 1 < starts.length ? starts[i + 1] : measureStartBeat + beatsPerBar);
  });

  return timed.map(ev => {
    const noteInfo = fretToNote(ev.stringNumber, ev.fret);
    if (!noteInfo) return null;
    const duration = Math.max(BEAT_QUANT, nextStart.get(ev.start) - ev.start);
    return createEvent({
      start: ev.start,
      duration,
      note: noteInfo.note,
      octave: noteInfo.octave,
      midi: noteToMidi(noteInfo.note, noteInfo.octave),
      string: ev.stringNumber,
      fret: ev.fret,
      technique: ev.technique ?? null,
    });
  }).filter(Boolean);
}

// Fallback for staves without bar lines: uniform eighth notes in onset order.
function timeUniform(measureEvents, startBeat) {
  const cols = [...new Set(measureEvents.map(e => e.col))].sort((a, b) => a - b);
  const colToIdx = new Map(cols.map((c, i) => [c, i]));
  return measureEvents.map(ev => {
    const noteInfo = fretToNote(ev.stringNumber, ev.fret);
    if (!noteInfo) return null;
    return createEvent({
      start: startBeat + colToIdx.get(ev.col) * 0.5,
      duration: 0.5,
      note: noteInfo.note,
      octave: noteInfo.octave,
      midi: noteToMidi(noteInfo.note, noteInfo.octave),
      string: ev.stringNumber,
      fret: ev.fret,
      technique: ev.technique ?? null,
    });
  }).filter(Boolean);
}

// Parse raw ASCII tab into a canonical Score.
export function tabToScore(rawText, meta = {}) {
  const timeSignature = meta.timeSignature ?? [4, 4];
  const beatsPerBar = (timeSignature[0] * 4) / timeSignature[1];

  // Capture a capo directive anywhere in the header text. Fret numbers in
  // the tab stay capo-relative; meta.capo carries the shift.
  let capo = meta.capo ?? 0;
  if (rawText && !capo) {
    const m = rawText.match(CAPO_RE);
    if (m) capo = Math.min(12, parseInt(m[1], 10));
  }
  const score = createScore({ ...meta, source: 'ascii-tab', timeSignature, capo });

  if (!rawText) return score;
  const staves = findStaves(rawText.split(/\r?\n/));

  const sections = [];
  let cursorBeat = 0;
  for (const { lines: stave, section } of staves) {
    if (section) {
      sections.push({ name: section, startBeat: cursorBeat });
    }
    const stringMap = getStringMapping(stave);
    const bodies = stave.map(stripPrefix);
    const maxLen = Math.max(...bodies.map(b => b.length));
    const padded = bodies.map(b => b.padEnd(maxLen, '-'));

    const measures = splitMeasures(padded);
    if (measures) {
      for (const segments of measures) {
        const { events, width } = scanMeasure(segments, stringMap);
        if (events.length === 0) continue;
        score.events.push(...timeMeasure(events, width, cursorBeat, beatsPerBar));
        cursorBeat += beatsPerBar;
      }
    } else {
      const { events } = scanMeasure(padded, stringMap);
      if (events.length === 0) continue;
      const timed = timeUniform(events, cursorBeat);
      score.events.push(...timed);
      // Continue seamlessly into the next stave. Rounding up to a bar
      // boundary here inserts an audible dead gap between staves — with
      // no bar lines we don't know the bar phase, so continuity wins.
      cursorBeat = timed.reduce((max, e) => Math.max(max, e.start + e.duration), cursorBeat);
    }
  }

  if (sections.length > 0) {
    score.meta.sections = sections;
  }
  return score;
}

// Back-compat shim: earlier code consumed { events, beats } directly.
export function parseTab(rawText, meta = {}) {
  const score = tabToScore(rawText, meta);
  const beats = scoreToBeats(score);
  return { score, events: score.events, beats };
}
