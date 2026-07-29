import { create } from 'zustand';
import axios from 'axios';
import { tabToScore } from '../utils/tabParser.js';
import { scoreToBeats, deserializeScore, serializeScore } from '../utils/score.js';
import { inferFingerings } from '../utils/fingering.js';
import { transposeBeats } from '../utils/transpose.js';
import { computeScaleOctaveRuns } from '../utils/scaleColors.js';
import { computeCagedPositions, computeDiagonalPatterns } from '../utils/scalePositions.js';
import { getChordsInKey } from '../utils/musicTheory.js';
import { generateVoicings } from '../utils/chordVoicings.js';

const api = axios.create({ baseURL: '/api' });

// Derive display beats from the canonical score: group, transpose, finger.
function deriveBeats(score, transpose, chordLibrary) {
  let beats = scoreToBeats(score);
  if (transpose) beats = transposeBeats(beats, transpose);
  inferFingerings(beats, chordLibrary);
  return beats;
}

// Map score.meta.sections ({name, startBeat}) onto beat index ranges.
function deriveSections(score, beats) {
  const raw = score?.meta?.sections;
  if (!raw?.length || beats.length === 0) return [];
  const sections = raw.map(s => {
    let startIndex = beats.findIndex(b => b.start >= s.startBeat - 1e-6);
    if (startIndex === -1) startIndex = beats.length - 1;
    return { name: s.name, startBeat: s.startBeat, startIndex, endIndex: beats.length - 1 };
  });
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].endIndex = Math.max(sections[i].startIndex, sections[i + 1].startIndex - 1);
  }
  return sections;
}

export const useStore = create((set, get) => ({
  songs: [],
  activeSong: null,
  score: null,             // canonical Score for the active song
  beats: [],               // derived from score via scoreToBeats()
  currentBeat: 0,
  chordLibrary: [],
  scales: [],
  activeSection: 'music', // 'music' | 'scales' | 'chords'
  activeScale: null,       // { name, root, notes }
  scaleViewActive: false,
  scaleOctaveRuns: [],     // computed octave-run data for fretboard/piano
  scaleViewMode: 'full',   // 'full' | 'vertical' | 'diagonal'
  cagedPositions: [],      // computed CAGED box positions
  diagonalPatterns: [],    // computed 3-notes-per-string diagonal patterns
  selectedCagedPosition: null, // null = all, 0-based index
  selectedOctaveRun: null,     // null = all, 0-based run index
  selectedChord: null,         // full chord object { id, name, fingering } (chords tab)
  selectedScaleChord: null,    // chord selected in scale view (highlights on piano)
  chordsInKey: [],             // chords whose pitch classes fit the active scale
  loading: false,
  error: null,
  bpm: 90,
  transpose: 0,        // key shift in semitones (capo-style on the guitar)
  loop: false,         // loops the song / active section / scale pattern
  isPlaying: false,
  sections: [],        // [{ name, startBeat, startIndex, endIndex }]
  songSection: null,   // index into sections, or null = whole song
  hoverMidi: null,     // cross-highlight between fretboard and piano
  // Scale playback
  isScalePlaying: false,
  scalePlayhead: null, // { note: {string,fret,note,octave,midi}, idx, total }
  instrument: 'piano', // 'piano' | 'guitar'
  audioEnabled: true,

  setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(300, Number(bpm) || 90)) }),
  setTranspose: (t) => {
    const clamped = Math.max(-12, Math.min(12, t));
    const { score, chordLibrary } = get();
    if (!score) { set({ transpose: clamped }); return; }
    set({ transpose: clamped, beats: deriveBeats(score, clamped, chordLibrary) });
  },
  setHoverMidi: (hoverMidi) => set({ hoverMidi }),
  setSongSection: (idx) => {
    const { sections } = get();
    if (idx == null || !sections[idx]) {
      set({ songSection: null });
    } else {
      set({ songSection: idx, currentBeat: sections[idx].startIndex });
    }
  },
  setScaleViewMode: (mode) => set({ scaleViewMode: mode }),
  setSelectedCagedPosition: (pos) => set({ selectedCagedPosition: pos }),
  setSelectedOctaveRun: (run) => set({ selectedOctaveRun: run }),
  setSelectedChord: (chord) => set({ selectedChord: chord, selectedScaleChord: null }),
  setSelectedScaleChord: (chord) => set({ selectedScaleChord: chord }),
  setActiveSection: (section) => {
    const update = { activeSection: section, selectedScaleChord: null };
    if (section !== 'scales') {
      update.scaleViewActive = false;
      update.isScalePlaying = false;
      update.scalePlayhead = null;
    }
    if (section === 'music') {
      update.selectedChord = null;
    }
    set(update);
  },
  setInstrument: (instrument) => set({ instrument }),
  toggleAudio: () => set({ audioEnabled: !get().audioEnabled }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsScalePlaying: (isScalePlaying) => set(
    isScalePlaying ? { isScalePlaying } : { isScalePlaying, scalePlayhead: null }
  ),
  toggleLoop: () => set({ loop: !get().loop }),
  setScalePlayhead: (scalePlayhead) => set({ scalePlayhead }),

  fetchSongs: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/songs');
      set({ songs: data, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  fetchChordLibrary: async () => {
    try {
      const { data } = await api.get('/chords/all/full');
      set({ chordLibrary: data });
    } catch (e) {
      set({ error: e.message });
    }
  },

  fetchScales: async () => {
    try {
      const { data } = await api.get('/scales');
      set({ scales: data });
    } catch (e) {
      set({ error: e.message });
    }
  },

  loadScale: async (name, root) => {
    try {
      const { data } = await api.get(`/scales/${encodeURIComponent(name)}/${encodeURIComponent(root)}`);
      const runs = computeScaleOctaveRuns(data.notes, 0, 8);
      const caged = computeCagedPositions(data.notes);
      const diagonal = computeDiagonalPatterns(data.notes);
      const { chordLibrary } = get();
      const inKey = getChordsInKey(data.notes, chordLibrary);
      // Expand each chord to multiple voicings
      const inKeyWithVoicings = inKey.flatMap(chord => generateVoicings(chord));
      set({
        activeScale: { name: data.name, root: data.root, notes: data.notes },
        scaleOctaveRuns: runs,
        cagedPositions: caged,
        diagonalPatterns: diagonal,
        chordsInKey: inKeyWithVoicings,
        selectedCagedPosition: null,
        selectedOctaveRun: null,
        scaleViewActive: true,
        isScalePlaying: false,
        scalePlayhead: null,
      });
    } catch (e) {
      set({ error: e.message });
    }
  },

  loadSong: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get(`/songs/${id}`);
      // Prefer the canonical Score stored at ingest; fall back to re-parsing
      // raw tab content for songs saved before parsed_json existed.
      let score = deserializeScore(data.parsed_json);
      if (!score) {
        score = tabToScore(data.raw_content, { title: data.title, artist: data.artist });
      }
      const { chordLibrary } = get();
      const beats = deriveBeats(score, 0, chordLibrary);
      set({
        activeSong: data,
        score,
        beats,
        sections: deriveSections(score, beats),
        songSection: null,
        transpose: 0,
        currentBeat: 0,
        loading: false,
        scaleViewActive: false,
        selectedChord: null,
        ...(score.meta?.bpm ? { bpm: Math.max(20, Math.min(300, Math.round(score.meta.bpm))) } : {}),
      });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  // `score` may be a prebuilt canonical Score (from the MusicXML/MIDI
  // importers). For plain tab pastes it's built here, so parsing happens
  // exactly once per song — at ingest.
  addSong: async ({ title, artist, raw_content, source_type = 'tab', score = null }) => {
    set({ loading: true, error: null });
    try {
      if (!score) {
        score = tabToScore(raw_content, { title, artist });
      }
      if (score.events.length === 0) {
        throw new Error('No notes found — check the content format.');
      }
      const { data } = await api.post('/songs', {
        title, artist, source_type, raw_content,
        parsed_json: serializeScore(score),
      });
      await get().fetchSongs();
      await get().loadSong(data.id);
      set({ loading: false });
      return data.id;
    } catch (e) {
      set({ error: e.response?.data?.error || e.message, loading: false });
      throw e;
    }
  },

  deleteSong: async (id) => {
    try {
      await api.delete(`/songs/${id}`);
      const { activeSong } = get();
      if (activeSong?.id === id) {
        set({ activeSong: null, score: null, beats: [], sections: [], songSection: null, currentBeat: 0 });
      }
      await get().fetchSongs();
    } catch (e) {
      set({ error: e.message });
    }
  },

  setCurrentBeat: (beat) => {
    const { beats } = get();
    if (beats.length === 0) return;
    const clamped = Math.max(0, Math.min(beats.length - 1, Math.round(beat)));
    set({ currentBeat: clamped });
  },
}));

