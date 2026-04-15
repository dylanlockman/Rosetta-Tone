import { create } from 'zustand';
import axios from 'axios';
import { parseTab } from '../utils/tabParser.js';
import { inferFingerings } from '../utils/fingering.js';
import { computeScaleOctaveRuns } from '../utils/scaleColors.js';
import { computeCagedPositions, computeDiagonalPatterns } from '../utils/scalePositions.js';
import { getChordsInKey } from '../utils/musicTheory.js';
import { generateVoicings } from '../utils/chordVoicings.js';

const api = axios.create({ baseURL: '/api' });

export const useStore = create((set, get) => ({
  songs: [],
  activeSong: null,
  beats: [],
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
  subdivision: 2, // 1 = quarter, 2 = eighth, 4 = sixteenth
  isPlaying: false,
  instrument: 'piano', // 'piano' | 'guitar'
  audioEnabled: true,

  setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(300, Number(bpm) || 90)) }),
  setSubdivision: (subdivision) => set({ subdivision }),
  setScaleViewMode: (mode) => set({ scaleViewMode: mode }),
  setSelectedCagedPosition: (pos) => set({ selectedCagedPosition: pos }),
  setSelectedOctaveRun: (run) => set({ selectedOctaveRun: run }),
  setSelectedChord: (chord) => set({ selectedChord: chord, selectedScaleChord: null }),
  setSelectedScaleChord: (chord) => set({ selectedScaleChord: chord }),
  setActiveSection: (section) => {
    const update = { activeSection: section, selectedScaleChord: null };
    if (section !== 'scales') {
      update.scaleViewActive = false;
    }
    if (section === 'music') {
      update.selectedChord = null;
    }
    set(update);
  },
  setInstrument: (instrument) => set({ instrument }),
  toggleAudio: () => set({ audioEnabled: !get().audioEnabled }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),

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
      });
    } catch (e) {
      set({ error: e.message });
    }
  },

  loadSong: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get(`/songs/${id}`);
      const parsed = parseTab(data.raw_content);
      const { chordLibrary } = get();
      inferFingerings(parsed.beats, chordLibrary);
      set({
        activeSong: data,
        beats: parsed.beats,
        currentBeat: 0,
        loading: false,
        scaleViewActive: false,
        selectedChord: null,
      });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  addSong: async ({ title, artist, raw_content, source_type = 'tab' }) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/songs', {
        title, artist, source_type, raw_content,
      });
      await get().fetchSongs();
      await get().loadSong(data.id);
      set({ loading: false });
      return data.id;
    } catch (e) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  deleteSong: async (id) => {
    try {
      await api.delete(`/songs/${id}`);
      const { activeSong } = get();
      if (activeSong?.id === id) {
        set({ activeSong: null, beats: [], currentBeat: 0 });
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

