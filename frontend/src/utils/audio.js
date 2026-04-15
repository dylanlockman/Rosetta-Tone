// Lightweight Web Audio synthesis for piano + guitar timbres.
// No samples, no dependencies — just oscillators with shaped envelopes.

import { noteToMidi } from './musicTheory.js';

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
  const play = instrument === 'guitar' ? playGuitar : playPiano;
  for (const n of notes) {
    const midi = noteToMidi(n.note, n.octave);
    if (midi == null) continue;
    play(midiToFreq(midi), duration);
  }
}

export function unlockAudio() {
  getCtx();
}
