// Audio engine: sampled instruments with a synthesized fallback.
//
// Real FluidR3 soundfont notes (piano + steel guitar) are fetched lazily
// from jsDelivr and cached as decoded buffers. Until a note's sample has
// arrived — or if the machine is offline — the original oscillator synth
// plays instead, so sound is never missing, it just gets nicer.

import { noteToMidi } from './musicTheory.js';

const SOUNDFONT_BASE = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM';
const INSTRUMENT_FONTS = {
  piano: 'acoustic_grand_piano-mp3',
  guitar: 'acoustic_guitar_steel-mp3',
};
// Soundfont files use flat names: C#4 is stored as Db4.mp3
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const sampleCache = new Map();   // "instrument:midi" → AudioBuffer
const samplePending = new Set(); // in-flight fetches
let sampleFetchBroken = false;   // offline / CDN unreachable → stop trying

function sampleUrl(instrument, midi) {
  const name = FLAT_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  return `${SOUNDFONT_BASE}/${INSTRUMENT_FONTS[instrument]}/${name}.mp3`;
}

async function loadSample(instrument, midi) {
  const key = `${instrument}:${midi}`;
  if (sampleCache.has(key) || samplePending.has(key) || sampleFetchBroken) return;
  if (midi < 21 || midi > 108 || !INSTRUMENT_FONTS[instrument]) return;
  samplePending.add(key);
  try {
    const res = await fetch(sampleUrl(instrument, midi));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const audio = await getCtx().decodeAudioData(buf);
    sampleCache.set(key, audio);
  } catch {
    // One network failure usually means offline — don't hammer the CDN.
    sampleFetchBroken = true;
  } finally {
    samplePending.delete(key);
  }
}

// Warm the cache for a set of midi pitches (called when a song/scale loads).
export function prefetchNotes(midis, instrument = 'piano') {
  for (const midi of midis) {
    if (midi != null) loadSample(instrument, midi);
  }
}

// Play a cached sample with a gentle release at the requested duration.
function playSample(buffer, duration) {
  const c = getCtx();
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(1, now);
  const hold = Math.max(0.08, duration);
  gain.gain.setValueAtTime(1, now + hold);
  gain.gain.exponentialRampToValueAtTime(0.001, now + hold + 0.25);
  src.connect(gain);
  gain.connect(masterGain);
  src.start(now);
  src.stop(now + hold + 0.3);
}

let ctx = null;
let masterGain = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Piano-ish: triangle + sine partial, fast attack, medium decay
function playPiano(freq, duration = 0.6) {
  const c = getCtx();
  const now = c.currentTime;

  const gain = c.createGain();
  gain.connect(masterGain);

  const o1 = c.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = freq;

  const o2 = c.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = c.createGain();
  g2.gain.value = 0.3;
  o2.connect(g2);

  o1.connect(gain);
  g2.connect(gain);

  // Envelope
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.6, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  o1.start(now);
  o2.start(now);
  o1.stop(now + duration + 0.05);
  o2.stop(now + duration + 0.05);
}

// Guitar-ish: sawtooth + chorus oscillators, pluck noise burst, body resonance
function playGuitar(freq, duration = 1.4) {
  const c = getCtx();
  const now = c.currentTime;
  const end = now + duration;

  const gain = c.createGain();

  // Lowpass filter for string brightness decay
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.frequency.exponentialRampToValueAtTime(600, end);
  filter.Q.value = 1.5;

  // Body resonance EQ (~300 Hz)
  const bodyEQ = c.createBiquadFilter();
  bodyEQ.type = 'peaking';
  bodyEQ.frequency.value = 300;
  bodyEQ.gain.value = 6;
  bodyEQ.Q.value = 1;

  // Main oscillator (sawtooth)
  const o1 = c.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.value = freq;

  // Warm detuned oscillator
  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = freq;
  o2.detune.value = -12;
  const g2 = c.createGain();
  g2.gain.value = 0.4;
  o2.connect(g2);

  // Chorus oscillator for width
  const o3 = c.createOscillator();
  o3.type = 'triangle';
  o3.frequency.value = freq;
  o3.detune.value = 7;
  const g3 = c.createGain();
  g3.gain.value = 0.25;
  o3.connect(g3);

  // Pluck noise burst (simulates pick/finger attack)
  const noiseLen = 0.03;
  const noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * noiseLen), c.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
  const noiseSource = c.createBufferSource();
  noiseSource.buffer = noiseBuf;
  const noiseFilt = c.createBiquadFilter();
  noiseFilt.type = 'bandpass';
  noiseFilt.frequency.value = 3000;
  noiseFilt.Q.value = 0.8;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.35, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);
  noiseSource.connect(noiseFilt);
  noiseFilt.connect(noiseGain);
  noiseGain.connect(masterGain);

  // Signal chain: oscillators → lowpass → body EQ → gain → master
  o1.connect(filter);
  g2.connect(filter);
  g3.connect(filter);
  filter.connect(bodyEQ);
  bodyEQ.connect(gain);
  gain.connect(masterGain);

  // Two-phase envelope: sharp pluck transient, then slow ring-out
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, end);

  o1.start(now);
  o2.start(now);
  o3.start(now);
  noiseSource.start(now);
  o1.stop(end + 0.05);
  o2.stop(end + 0.05);
  o3.stop(end + 0.05);
}

export function playBeat(notes, instrument = 'piano', duration = 0.6) {
  if (!notes || notes.length === 0) return;
  const synth = instrument === 'guitar' ? playGuitar : playPiano;
  for (const n of notes) {
    const midi = n.midi ?? noteToMidi(n.note, n.octave);
    if (midi == null) continue;
    const sample = sampleCache.get(`${instrument}:${midi}`);
    if (sample) {
      playSample(sample, duration);
    } else {
      synth(midiToFreq(midi), duration);
      loadSample(instrument, midi); // next hit sounds real
    }
  }
}

export function unlockAudio() {
  getCtx();
}
