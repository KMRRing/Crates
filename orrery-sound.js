// Orrery's sounds, made as they play (Web Audio: sine decays and short noise bursts, no files, so they're there offline):
// a planet landing (a tink, higher on the outer rings), a ring taken in the hand, an alignment taking hold, and
// a bell struck up a chord when it clears (a longer line is a longer chord, a combo a higher one), the end. Off, and
// nothing is made at all.
let ctx = null, master = null, on = true;
const pans = typeof StereoPannerNode !== "undefined";

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();                // a chord and a landing together mustn't clip
    squash.threshold.value = -18; squash.ratio.value = 4; squash.attack.value = 0.003; squash.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});    // browsers start audio only from a tap
  return ctx;
}
let hiss = null;
function noise(c) {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 0.1);
    hiss = c.createBuffer(1, n, c.sampleRate);
    const d = hiss.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return hiss;
}
function out(c, pan) {
  const g = c.createGain();
  if (pans && pan) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(master); } else g.connect(master);
  return g;
}
function ping(c, t, { freq, gain, dur, pan = 0, drop = 1, attack = 0.002, type = "sine" }) {
  const o = c.createOscillator(), g = out(c, pan);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function click(c, t, { freq, gain, dur, pan = 0 }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = out(c, pan);
  src.buffer = noise(c);
  f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.04);
  src.stop(t + dur + 0.02);
}
/** A struck bell: its fundamental and the inharmonic partials of a small one, ringing out. */
function bell(c, t, freq, power, pan) {
  for (const [ratio, gain, dur] of [[1, 0.2, 1.3], [2.76, 0.09, 0.9], [5.4, 0.045, 0.55], [1.004, 0.08, 1.4]]) ping(c, t, { freq: freq * ratio, gain: gain * power, dur, pan, drop: 0.998, attack: 0.003 });
}

const semitone = n => 2 ** (n / 12);
// the sounds: `t` the audio clock's time; `o` its options
const VOICES = {
  /** A planet landing: a tink, higher on the outer rings (a pentatonic scale), with a breath of the table under it. */
  land(c, t, { ring = 0, power = 0.5, pan = 0 }) {
    const f = 523.25 * semitone([0, 2, 4, 7, 9][ring] ?? 0);
    ping(c, t, { freq: f, gain: 0.2 * power, dur: 0.28, pan, drop: 0.995 });
    ping(c, t, { freq: f * 2.01, gain: 0.05 * power, dur: 0.12, pan });
    click(c, t, { freq: 1400, gain: 0.12 * power, dur: 0.02, pan });
  },
  /** A ring taken in the hand: a small click of brass on brass. */
  grab(c, t, { power = 0.5, pan = 0 }) {
    click(c, t, { freq: 2100, gain: 0.2 * power, dur: 0.014, pan });
    ping(c, t, { freq: 190, gain: 0.16 * power, dur: 0.07, pan, drop: 0.8 });
  },
  /** A ring let go: softer, lower. */
  let(c, t, { power = 0.5, pan = 0 }) {
    click(c, t, { freq: 1500, gain: 0.12 * power, dur: 0.012, pan });
    ping(c, t, { freq: 150, gain: 0.1 * power, dur: 0.06, pan, drop: 0.8 });
  },
  /** A line taking hold: a rising blip, the charge begun. */
  charge(c, t, { power = 0.5 }) {
    const o = c.createOscillator(), g = out(c, 0);
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(840, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * power, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.28);
  },
  /** An alignment clearing: a bell struck up a chord, a note for each planet; a combo starts it higher. */
  lock(c, t, { n = 3, combo = 1, power = 0.8 }) {
    const base = 392 * semitone(Math.min(10, (combo - 1) * 2)), chord = [0, 4, 7, 12, 16].slice(0, n);
    chord.forEach((s, i) => bell(c, t + i * 0.075, base * semitone(s), power * (0.8 + 0.06 * i), (i - (n - 1) / 2) * 0.18));
  },
  /** No room left: two notes going down. */
  over(c, t, { power = 0.7 }) {
    ping(c, t, { freq: 330, gain: 0.22 * power, dur: 0.9, drop: 0.96, type: "triangle" });
    ping(c, t + 0.28, { freq: 247, gain: 0.22 * power, dur: 1.4, drop: 0.94, type: "triangle" });
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
  /** Stands still with the game (the menu is open) and goes on. */
  hold() { if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); },
  release() { if (ctx && on && ctx.state === "suspended") ctx.resume().catch(() => {}); },
};
