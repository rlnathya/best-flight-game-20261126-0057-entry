// SKYLINE — tiny WebAudio sound: engine hum tied to throttle and speed,
// a chime when a ring is passed, a thud on touchdown. Everything is
// guarded: no audio context exists until the player first interacts, and
// any failure simply leaves the game silent.

let ctx = null;
let engineOsc = null;
let engineGain = null;
let muted = false;

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (engineGain) engineGain.gain.value = muted ? 0 : 0.05;
  return muted;
}

export function ensureAudio() {
  if (ctx || muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
  } catch (err) { ctx = null; }
}

export function updateEngineSound(throttle, speed) {
  if (!ctx || !engineOsc || !engineGain || muted) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    engineOsc.frequency.value = 42 + throttle * 55 + speed * 0.35;
    engineGain.gain.value = 0.025 + throttle * 0.05;
  } catch (err) { /* stay silent */ }
}

function blip(freq, dur, type, vol) {
  if (!ctx || muted) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (err) { /* stay silent */ }
}

export function playRingChime() {
  blip(660, 0.18, 'sine', 0.22);
  setTimeout(() => blip(990, 0.3, 'sine', 0.2), 90);
}

export function playTouchdown() { blip(110, 0.25, 'triangle', 0.3); }
export function playCrash() { blip(55, 0.7, 'sawtooth', 0.3); }
export function playClick() { blip(520, 0.07, 'square', 0.08); }
