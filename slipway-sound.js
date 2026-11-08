// Slipway's sounds, made as they play (Web Audio: short tones that fall; no files, so they are there offline): a tick
// for a square tapped, a knock of wood for a figure fitted, a dull tock for one that won't go, and a thunk with a bell
// when the cube is whole. Off, and nothing is made at all.
let ctx = null, master = null, on = true;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -14; squash.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});    // a browser starts audio only from a tap
  return ctx;
}
export const setSound = v => { on = !!v; };
/** A short tone that falls: a knock, a thunk, a bell. */
function tone(c, { f0, f1 = f0, ms, gain = 0.3, type = "sine", at = 0 }) {
  const t = c.currentTime + at, len = ms / 1000, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.05);
}
const SOUNDS = {
  tap: c => tone(c, { f0: 700, f1: 600, ms: 40, gain: 0.07 }),
  fit: c => { tone(c, { f0: 240, f1: 110, ms: 110, gain: 0.4, type: "triangle" }); tone(c, { f0: 520, f1: 300, ms: 60, gain: 0.1, at: 0.01 }); },
  refuse: c => tone(c, { f0: 150, f1: 90, ms: 160, gain: 0.35, type: "triangle" }),
  undo: c => tone(c, { f0: 520, f1: 380, ms: 110, gain: 0.12 }),
  // the cube whole: a thunk, then a bell
  done: c => { tone(c, { f0: 120, f1: 60, ms: 220, gain: 0.5, type: "triangle" }); [660, 880, 1320].forEach((f, i) => tone(c, { f0: f, ms: 900 - i * 200, gain: 0.12, at: 0.16 + i * 0.09 })); },
};
export function sound(kind) {
  try { const c = audio(); if (c) SOUNDS[kind]?.(c); } catch { /* no sound here */ }
}
