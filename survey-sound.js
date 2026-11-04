// Survey's sounds, made as they play (Web Audio: noise bursts and short sine decays, no files, so they're there offline), the
// same way Topple's are: the crack of a cube chipped, the dull knock of granite that won't give, the ring of a chisel on ore,
// the soft chord of a lantern lit, a tick for a mark, and a rising run of bells when the block is cleared. Off, and nothing
// is made at all.
let ctx = null, master = null, on = true;
const pans = typeof StereoPannerNode !== "undefined";

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();                // a lantern's chain of chips piles up; this keeps it from clipping
    squash.threshold.value = -16; squash.ratio.value = 5; squash.attack.value = 0.002; squash.release.value = 0.12;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});    // browsers start audio only from a tap
  return ctx;
}
let hiss = null;
const noise = c => {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 0.3);
    hiss = c.createBuffer(1, n, c.sampleRate);
    const d = hiss.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return hiss;
};
const out = (c, pan) => {
  const g = c.createGain();
  if (pans && pan) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(master); } else g.connect(master);
  return g;
};
function burst(c, t, { freq, q, gain, dur, pan, type = "bandpass" }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = out(c, pan);
  src.buffer = noise(c);
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.1);
  src.stop(t + dur + 0.02);
}
function ping(c, t, { freq, gain, dur, pan, drop = 0.9, attack = 0.001 }) {
  const o = c.createOscillator(), g = out(c, pan);
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}
/** A bell: a few inharmonic partials ringing out. */
const bell = (c, t, freq, gain, dur, pan) => { for (const [r, g, d] of [[1, 1, 1], [2.76, 0.4, 0.7], [5.4, 0.18, 0.4]]) ping(c, t, { freq: freq * r, gain: gain * g, dur: dur * d, pan, drop: 0.998, attack: 0.002 }); };

const VOICES = {
  /** A waste cube chipped: a dry crack and a low tock, a little different each time. */
  chip(c, t, { pitch = 1, pan = 0 }) {
    burst(c, t, { freq: 1900 * pitch, q: 0.9, gain: 0.5, dur: 0.05, pan });
    burst(c, t, { freq: 520 * pitch, q: 0.7, gain: 0.4, dur: 0.09, pan, type: "lowpass" });
    ping(c, t, { freq: 170 * pitch, gain: 0.34, dur: 0.1, pan, drop: 0.7 });
  },
  /** Ore struck by mistake: the chisel rings on metal, then a low note of regret. */
  strike(c, t, { pitch = 1, pan = 0 }) {
    burst(c, t, { freq: 3400, q: 1.6, gain: 0.45, dur: 0.03, pan });
    bell(c, t, 880 * pitch, 0.22, 0.55, pan);
    ping(c, t + 0.05, { freq: 140, gain: 0.3, dur: 0.22, pan, drop: 0.6 });
  },
  /** Granite: the chisel skids off, a hard short knock. */
  granite(c, t, { pan = 0 }) {
    burst(c, t, { freq: 4200, q: 2.2, gain: 0.3, dur: 0.012, pan });
    ping(c, t, { freq: 310, gain: 0.34, dur: 0.05, pan, drop: 0.95 });
  },
  /** A lantern lit: a warm chord, with the rock round it crumbling. */
  lamp(c, t, { pan = 0 }) {
    burst(c, t, { freq: 800, q: 0.6, gain: 0.45, dur: 0.12, pan, type: "lowpass" });
    [523.25, 659.25, 783.99].forEach((f, k) => bell(c, t + 0.04 + k * 0.06, f, 0.12, 0.9, pan));
  },
  /** A mark put down or taken up. */
  mark(c, t, { pitch = 1, pan = 0 }) {
    ping(c, t, { freq: 900 * pitch, gain: 0.18, dur: 0.05, pan, drop: 0.85 });
  },
  /** The block cleared: a rising run of bells, gold in the ear. */
  reveal(c, t, { pan = 0 }) {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, k) => bell(c, t + k * 0.09, f, 0.16, 1.1 + k * 0.1, pan));
    burst(c, t, { freq: 6000, q: 0.5, gain: 0.08, dur: 0.5, pan, type: "highpass" });
  },
};

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; },
  played: 0,                                       // how many sounds were made (for the tests)
  /** Opens the sound from a tap (an iPhone only from the end of a touch, so the page calls this at the lifting of a finger as well). */
  unlock() {
    const c = audio();
    if (!c || (c.unlocked && c.state === "running")) return;
    c.unlocked = true;
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start();
  },
  /** One sound now (or `after` seconds on), a little detuned so a run of chips is not a machine. */
  play(kind, opts = {}, after = 0) {
    const c = audio();
    if (!c || !VOICES[kind]) return;
    this.played++;
    VOICES[kind](c, c.currentTime + 0.02 + after, { pitch: 0.92 + Math.random() * 0.16, ...opts });
  },
  /** Stands still with the game (the menu is open) and goes on. */
  hold() { if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); },
  release() { if (ctx && on && ctx.state === "suspended") ctx.resume().catch(() => {}); },
};
