// Slipway's sounds, made as they play (Web Audio: noise through a band, short sine decays; no files, so they are there
// offline): the rasp of a saw, the knock of a mallet on a chisel, the long swish of a plane, the whine of a drill, a dull
// tock when a tool is refused, and a thunk with a bell when the part is fitted. Off, and nothing is made at all.
let ctx = null, master = null, on = true, hiss = null;

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
function noise(c) {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 0.5);
    hiss = c.createBuffer(1, n, c.sampleRate);
    const d = hiss.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return hiss;
}
/** A burst of noise through a band: from `lo` to `hi` Hz, `ms` long, rising for `attack` and falling away; `chop` makes it a rasp (that many strokes). */
function burst(c, { ms, lo, hi, gain = 0.25, attack = 0.01, chop = 0, at = 0 }) {
  const t = c.currentTime + at, len = ms / 1000;
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c); src.loop = true;
  bp.type = "bandpass"; bp.frequency.setValueAtTime(lo, t); bp.frequency.exponentialRampToValueAtTime(hi, t + len); bp.Q.value = 1.2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  if (chop) for (let i = 1; i < chop * 2; i++) g.gain.linearRampToValueAtTime(i % 2 ? gain * 0.35 : gain, t + attack + (len - attack) * i / (chop * 2));
  g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * 0.2); src.stop(t + len + 0.05);
}
/** A short tone that falls: a knock, a thunk, a bell. */
function tone(c, { f0, f1 = f0, ms, gain = 0.3, type = "sine", at = 0 }) {
  const t = c.currentTime + at, len = ms / 1000, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.05);
}
const SOUNDS = {
  saw: c => burst(c, { ms: 620, lo: 700, hi: 3600, gain: 0.3, chop: 7 }),
  kerf: c => burst(c, { ms: 380, lo: 1100, hi: 3200, gain: 0.2, chop: 5 }),
  chisel: c => { tone(c, { f0: 330, f1: 150, ms: 90, gain: 0.35, type: "triangle" }); burst(c, { ms: 150, lo: 900, hi: 2200, gain: 0.2, at: 0.02 }); tone(c, { f0: 260, f1: 110, ms: 120, gain: 0.3, type: "triangle", at: 0.2 }); },
  plane: c => burst(c, { ms: 420, lo: 2200, hi: 7000, gain: 0.22, attack: 0.06 }),
  shave: c => burst(c, { ms: 300, lo: 3000, hi: 8000, gain: 0.16, attack: 0.04 }),
  adze: c => { tone(c, { f0: 180, f1: 70, ms: 110, gain: 0.4, type: "triangle" }); burst(c, { ms: 180, lo: 500, hi: 1800, gain: 0.25 }); },
  drill: c => { burst(c, { ms: 520, lo: 300, hi: 900, gain: 0.22, chop: 18 }); tone(c, { f0: 140, f1: 210, ms: 500, gain: 0.07, type: "sawtooth" }); },
  gouge: c => burst(c, { ms: 340, lo: 600, hi: 1800, gain: 0.25, attack: 0.05, chop: 2 }),
  refuse: c => tone(c, { f0: 150, f1: 90, ms: 160, gain: 0.35, type: "triangle" }),
  undo: c => tone(c, { f0: 520, f1: 380, ms: 110, gain: 0.12 }),
  tap: c => tone(c, { f0: 700, f1: 600, ms: 40, gain: 0.07 }),
  // the part fitted: a thunk, then a bell
  done: c => { tone(c, { f0: 120, f1: 60, ms: 220, gain: 0.5, type: "triangle" }); [660, 880, 1320].forEach((f, i) => tone(c, { f0: f, ms: 900 - i * 200, gain: 0.12, at: 0.16 + i * 0.09 })); },
};
export function sound(kind) {
  try { const c = audio(); if (c) SOUNDS[kind]?.(c); } catch { /* no sound here */ }
}
