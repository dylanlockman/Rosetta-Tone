import { fretToNote } from './musicTheory.js';

// Parse standard ASCII guitar tab into a list of note events.
//
// Input format example:
//   e|---0---2---3---|
//   B|---1---3---0---|
//   G|---0---2---0---|
//   D|---2---0---0---|
//   A|---3---0---2---|
//   E|---0---2---3---|
//
// Output: [{ note, octave, string, fret, duration, beatIndex }, ...]
// Notes that occur in the same column are grouped via shared beatIndex.

const STRING_LABEL_RE = /^\s*([eEbBgGdDaA])\s*\|/;

function isTabLine(line) {
  return STRING_LABEL_RE.test(line);
}

// Identify groups of 6 consecutive tab lines (a "stave").
function findStaves(lines) {
  const staves = [];
  let current = [];
  for (const line of lines) {
    if (isTabLine(line)) {
      current.push(line);
      if (current.length === 6) {
        staves.push(current);
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

  // Standard order: top line (index 0) = high e (string 1)
  const standardOrder = ['e', 'b', 'g', 'd', 'a', 'e'];
  const matchesStandard = labels.every((l, i) => l === standardOrder[i]);

  if (matchesStandard) {
    return [1, 2, 3, 4, 5, 6]; // top to bottom
  }

  // Reversed order: top line = low E
  const reversedOrder = ['e', 'a', 'd', 'g', 'b', 'e'];
  const matchesReversed = labels.every((l, i) => l === reversedOrder[i]);
  if (matchesReversed) {
    return [6, 5, 4, 3, 2, 1];
  }

  // Default: assume standard
  return [1, 2, 3, 4, 5, 6];
}

// Strip the leading "X|" prefix and align lines to start at column 0
function stripPrefix(line) {
  const m = line.match(/^([^|]*\|)(.*)$/);
  return m ? m[2] : line;
}

function parseStave(stave, beatOffset = 0) {
  const stringMap = getStringMapping(stave);
  const bodies = stave.map(stripPrefix);
  // Pad lines to equal length
  const maxLen = Math.max(...bodies.map(b => b.length));
  const padded = bodies.map(b => b.padEnd(maxLen, '-'));

  const events = [];
  const beats = [];
  let beatIndex = beatOffset;
  let col = 0;

  while (col < maxLen) {
    // Collect fret numbers in this column across all 6 strings
    const colFrets = [];
    let consumed = 1; // how many columns this beat occupies

    for (let lineIdx = 0; lineIdx < 6; lineIdx++) {
      const ch = padded[lineIdx][col];
      if (ch >= '0' && ch <= '9') {
        // Could be multi-digit; look ahead
        let numStr = ch;
        let lookahead = col + 1;
        while (lookahead < maxLen && padded[lineIdx][lookahead] >= '0' && padded[lineIdx][lookahead] <= '9') {
          numStr += padded[lineIdx][lookahead];
          lookahead++;
        }
        consumed = Math.max(consumed, numStr.length);
        colFrets.push({
          stringNumber: stringMap[lineIdx],
          fret: parseInt(numStr, 10),
        });
      }
    }

    if (colFrets.length > 0) {
      const beatNotes = [];
      for (const { stringNumber, fret } of colFrets) {
        const noteInfo = fretToNote(stringNumber, fret);
        if (noteInfo) {
          const ev = {
            note: noteInfo.note,
            octave: noteInfo.octave,
            string: stringNumber,
            fret,
            duration: 'q',
            beatIndex,
          };
          events.push(ev);
          beatNotes.push(ev);
        }
      }
      if (beatNotes.length > 0) {
        beats.push({ beatIndex, notes: beatNotes });
      }
      beatIndex++;
      col += consumed;
    } else {
      col++;
    }
  }

  return { events, beats, nextBeat: beatIndex };
}

export function parseTab(rawText) {
  if (!rawText) return { events: [], beats: [] };
  const lines = rawText.split(/\r?\n/);
  const staves = findStaves(lines);

  const allEvents = [];
  const allBeats = [];
  let beatOffset = 0;
  for (const stave of staves) {
    const { events, beats, nextBeat } = parseStave(stave, beatOffset);
    allEvents.push(...events);
    allBeats.push(...beats);
    beatOffset = nextBeat;
  }

  return { events: allEvents, beats: allBeats };
}
