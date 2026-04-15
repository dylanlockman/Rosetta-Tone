export const CHROMATIC_SCALE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Strings 1..6 (1 = high E, 6 = low E)
export const STANDARD_TUNING = [
  { note: 'E', octave: 4 }, // string 1
  { note: 'B', octave: 3 }, // string 2
  { note: 'G', octave: 3 }, // string 3
  { note: 'D', octave: 3 }, // string 4
  { note: 'A', octave: 2 }, // string 5
  { note: 'E', octave: 2 }, // string 6
];

export function noteToMidi(note, octave) {
  const idx = CHROMATIC_SCALE.indexOf(note);
  if (idx === -1) return null;
  return (octave + 1) * 12 + idx;
}

export function midiToNote(midi) {
  const note = CHROMATIC_SCALE[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { note, octave };
}

// stringNumber is 1-indexed (1=high E .. 6=low E)
export function fretToNote(stringNumber, fret) {
  const open = STANDARD_TUNING[stringNumber - 1];
  if (!open || fret < 0) return null;
  const baseMidi = noteToMidi(open.note, open.octave);
  return midiToNote(baseMidi + fret);
}

// Return chords from the library whose pitch classes are all members of the scale.
export function getChordsInKey(scaleNotes, chordLibrary) {
  if (!scaleNotes || scaleNotes.length === 0 || !chordLibrary) return [];
  const scaleSet = new Set(scaleNotes);
  return chordLibrary.filter(chord => {
    if (!chord.fingering || chord.fingering.length === 0) return false;
    const pitchClasses = new Set();
    for (const f of chord.fingering) {
      if (f.fret < 0) continue; // muted string
      const info = fretToNote(f.string, f.fret);
      if (info) pitchClasses.add(info.note);
    }
    if (pitchClasses.size === 0) return false;
    for (const pc of pitchClasses) {
      if (!scaleSet.has(pc)) return false;
    }
    return true;
  });
}

// intervals is a comma-separated string of semitone steps, e.g. "2,2,1,2,2,2,1"
export function getScaleNotes(root, intervalsStr) {
  const rootIdx = CHROMATIC_SCALE.indexOf(root);
  if (rootIdx === -1) return [];
  const intervals = intervalsStr.split(',').map(Number);
  const notes = [root];
  let cur = rootIdx;
  for (let i = 0; i < intervals.length - 1; i++) {
    cur = (cur + intervals[i]) % 12;
    notes.push(CHROMATIC_SCALE[cur]);
  }
  return notes;
}
