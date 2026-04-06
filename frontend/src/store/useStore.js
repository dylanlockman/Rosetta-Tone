import { create } from 'zustand';
import axios from 'axios';
import { parseTab } from '../utils/tabParser.js';
import { inferFingerings } from '../utils/fingering.js';

const api = axios.create({ baseURL: '/api' });

export const useStore = create((set, get) => ({
  songs: [],
  activeSong: null,
  beats: [],
  currentBeat: 0,
  chordLibrary: [],
  loading: false,
  error: null,

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
