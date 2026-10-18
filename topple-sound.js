// Topple's sounds, made as they play (Web Audio: noise bursts and short sine decays, no files, so they're there offline):
// the clack of a domino knocked by the one before it, the softer tock of one landing on the table, the tap of a piece
// laid, a bell's ring. A fall plays as a run: the page hands over every sound of it with the time it falls due, and
// they are scheduled on the audio clock, so a long chain keeps its rhythm whatever the frames do. Many at the same
// moment (a fork, a cone of dominoes) become one louder sound, not a racket. Off, and nothing is made at all.
let ctx = null, master = null, on = true;
const pans = typeof StereoPannerNode !== "undefined";

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();                // a run of clacks piles up; this keeps it from clipping
    squash.threshold.value = -16; squash.ratio.value = 5; squash.attack.value = 0.002; squash.release.value = 0.12;
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});    // browsers start audio only from a tap
  return ctx;
}
let hiss = null;
/** A short buffer of noise, made once. */
function noise(c) {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 0.25);
    hiss = c.createBuffer(1, n, c.sampleRate);
    const d = hiss.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return hiss;
}
/** Where a sound goes to: its own gain, panned (-1 left … 1 right) where the browser can. */
function out(c, pan) {
  const g = c.createGain();
  if (pans && pan) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(master); } else g.connect(master);
  return g;
}
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

// the sounds: `t` the audio clock's time, `power` 0–1 how hard, `pitch` a factor near one (each domino rings a little differently)
const VOICES = {
  /** One domino knocked by another: wood on wood, bright and short. */
  clack(c, t, { power = 0.6, pitch = 1, pan = 0 }) {
    burst(c, t, { freq: 2300 * pitch, q: 1.3, gain: 0.5 * power, dur: 0.018, pan });
    ping(c, t, { freq: 640 * pitch, gain: 0.34 * power, dur: 0.05, pan, drop: 0.86 });
    ping(c, t, { freq: 1480 * pitch, gain: 0.14 * power, dur: 0.028, pan, drop: 0.9 });
  },
  /** One landing flat on the table: duller and lower than a clack. */
  land(c, t, { power = 0.6, pitch = 1, pan = 0 }) {
    burst(c, t, { freq: 900 * pitch, q: 0.8, gain: 0.5 * power, dur: 0.05, pan, type: "lowpass" });
    ping(c, t, { freq: 230 * pitch, gain: 0.4 * power, dur: 0.09, pan, drop: 0.7 });
  },
  /** A piece laid on the table. */
  tap(c, t, { power = 0.5, pitch = 1, pan = 0 }) {
    burst(c, t, { freq: 1500 * pitch, q: 1, gain: 0.34 * power, dur: 0.02, pan });
    ping(c, t, { freq: 420 * pitch, gain: 0.3 * power, dur: 0.07, pan, drop: 0.8 });
  },
  /** The push itself: a heavier knock, lower the harder it is. */
  shove(c, t, { power = 0.6, pitch = 1, pan = 0 }) {
    burst(c, t, { freq: 700 * pitch, q: 0.7, gain: 0.6 * power, dur: 0.07, pan, type: "lowpass" });
    ping(c, t, { freq: 150 * pitch, gain: 0.5 * power, dur: 0.14, pan, drop: 0.6 });
  },
  /** The bell rung: a small bell's inharmonic partials, ringing out. */
  ring(c, t, { power = 0.6, pitch = 1, pan = 0 }) {
    for (const [ratio, gain, dur] of [[1, 0.2, 1.1], [2.76, 0.11, 0.8], [5.4, 0.06, 0.5], [1.005, 0.1, 1.2]]) ping(c, t, { freq: 1568 * ratio * pitch, gain: gain * power, dur, pan, drop: 0.998, attack: 0.002 });
  },
};

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; },
  played: 0,                                       // how many sounds were made (for the tests)
  /** Opens the sound from a tap (some browsers keep it shut until one). */
  unlock() {
    const c = audio();
    if (!c || c.unlocked) return;
    c.unlocked = true;
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start();
  },
  /** One sound now (or `after` seconds on). */
  play(kind, opts = {}, after = 0) {
    const c = audio();
    if (!c || !VOICES[kind]) return;
    this.played++;
    VOICES[kind](c, c.currentTime + 0.02 + after, opts);
  },
  /**
   * A run of sounds, [{ kind, at (seconds from now), power, pitch, pan }]: those within 25 ms of each other and of a
   * kind are one, louder for how many they were.
   */
  run(list) {
    const c = audio();
    if (!c) return;
    const bins = new Map();
    for (const e of list) {
      const key = `${e.kind}:${Math.round(e.at / 0.025)}`, b = bins.get(key);
      if (b) { b.n++; b.pan += e.pan || 0; b.power = Math.max(b.power, e.power ?? 0.6); } else bins.set(key, { ...e, n: 1, pan: e.pan || 0, power: e.power ?? 0.6 });
    }
    for (const b of bins.values()) this.play(b.kind, { power: Math.min(1, b.power * (1 + 0.18 * Math.log2(b.n))), pitch: b.pitch, pan: b.pan / b.n }, b.at);
  },
  /** Stands still with the game (the menu is open) and goes on. */
  hold() { if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); },
  release() { if (ctx && on && ctx.state === "suspended") ctx.resume().catch(() => {}); },
};
