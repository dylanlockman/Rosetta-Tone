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

// Guitar-ish: sawtooth through a lowpass + plucky envelope
function playGuitar(freq, duration = 0.7) {
  const c = getCtx();
  const now = c.currentTime;

  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.exponentialRampToValueAtTime(800, now + duration);
  filter.Q.value = 2;

  const o1 = c.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.value = freq;

  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = freq;
  o2.detune.value = -8;
  const g2 = c.createGain();
  g2.gain.value = 0.5;
  o2.connect(g2);

  o1.connect(filter);
  g2.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  o1.start(now);
  o2.start(now);
  o1.stop(now + duration + 0.05);
  o2.stop(now + duration + 0.05);
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
