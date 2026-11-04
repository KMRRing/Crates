// Solitaire's sounds, made as they play (Web Audio: filtered noise and short sine decays, no files, so they're there
// offline): a card flicked across the baize, the snap of one dealt or turned, a riffle shuffle (a burst of tiny ticks
// that come faster as the halves interleave), a soft thunk on a foundation. Whether to play at all is the page's choice
// (the menu's Sound, off in a watching frame); off, nothing is made at all.
//
// Browsers start audio only from a gesture, and Safari wants the resume() inside the gesture's own handler, so unlock()
// listens for the first touch or key and makes the context there. A sound asked before that is silent, not queued.
let ctx = null, master = null, on = true, hiss = null, last = -1, ready = false;   // ready: a gesture has been seen
const pans = typeof StereoPannerNode !== "undefined";

function audio() {
  if (!on || !ready) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
    const squash = ctx.createDynamicsCompressor();               // a riffle and a run of auto moves pile up; this keeps them from clipping
    squash.threshold.value = -12; squash.ratio.value = 6; squash.attack.value = 0.002; squash.release.value = 0.1;
    master = ctx.createGain();
    master.gain.value = 3;                                          // the voices are written quiet (noise through a narrow filter has little energy); the squash above catches the peaks
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});   // an iPhone "interrupts" it too when the page was away
  return ctx.state === "running" ? ctx : null;
}
const noise = c => {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 0.4);
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
/** Filtered noise: its centre glides from `f0` to `f1` over `dur`, the level falling away from `gain`. */
function hit(c, t, { f0, f1 = f0, q = 1, gain, dur, pan = 0, type = "bandpass", attack = 0.002 }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = out(c, pan);
  src.buffer = noise(c);
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.1);
  src.stop(t + dur + 0.03);
}
/** A sine that falls in pitch: the body under a snap or a thunk. */
function thump(c, t, { f0, f1, gain, dur, pan = 0 }) {
  const o = c.createOscillator(), g = out(c, pan);
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o.start(t); o.stop(t + dur + 0.03);
}
const jitter = (x, by = 0.1) => x * (1 + (Math.random() * 2 - 1) * by);

/** A card slid or flicked to its place: a swish that falls in pitch, then the small pat of it landing. */
export function flick(vol = 1, pan = 0) {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  if (t - last < 0.03) return;                                   // one card, one sound: a double call in a frame is one flick
  last = t;
  hit(c, t, { f0: jitter(3600), f1: jitter(1500), q: 0.9, gain: 0.34 * vol, dur: 0.085, pan });
  hit(c, t + 0.055, { f0: jitter(2300), q: 1.4, gain: 0.2 * vol, dur: 0.035, pan });
  thump(c, t + 0.055, { f0: jitter(190), f1: 120, gain: 0.1 * vol, dur: 0.05, pan });
}
/** A card dealt or turned: crisper than a flick, a click on a little body. */
export function snap(vol = 1, pan = 0) {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  hit(c, t, { f0: jitter(4800), q: 0.8, gain: 0.34 * vol, dur: 0.03, pan, type: "highpass" });
  hit(c, t, { f0: jitter(2600), q: 1.6, gain: 0.26 * vol, dur: 0.05, pan });
  thump(c, t, { f0: jitter(210), f1: 110, gain: 0.16 * vol, dur: 0.06, pan });
}
/** A riffle shuffle: about 0.6 s of tiny ticks, each sooner than the last as the two halves run together, then the soft bridge of the cards squared. */
export function shuffle() {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + 0.01;
  let t = t0, gap = 0.04;
  for (let i = 0; i < 30; i++) {
    const swell = Math.sin(Math.PI * Math.min(1, (t - t0) / 0.62));          // quiet at the edges, fullest as they interleave
    hit(c, t, { f0: 2000 + Math.random() * 3200, q: 2.2, gain: (0.1 + 0.16 * swell) * (0.6 + Math.random() * 0.6), dur: 0.011 + Math.random() * 0.01, pan: (Math.random() - 0.5) * 0.35 });
    t += gap;
    gap = Math.max(0.011, gap * 0.935 + (Math.random() - 0.5) * 0.004);
  }
  hit(c, t + 0.02, { f0: 900, f1: 420, q: 0.7, gain: 0.2, dur: 0.16, type: "lowpass", attack: 0.012 });
  thump(c, t + 0.05, { f0: 150, f1: 90, gain: 0.1, dur: 0.1 });
}
/** Cards dealt out: `n` snaps `every` seconds apart from `after` seconds on (a shuffle takes about 0.7), each a little softer and farther across the stereo field. */
export function dealing(n = 7, every = 0.075, after = 0) {
  if (!audio()) return;
  for (let i = 0; i < n; i++) setTimeout(() => snap(0.6 * (1 - i / (n * 1.6)), (i / Math.max(1, n - 1) - 0.5) * 0.6), (after + i * every) * 1000);
}
/** A card laid on a foundation: a soft thunk, low and round. */
export function thunk(vol = 1) {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  thump(c, t, { f0: 150, f1: 62, gain: 0.5 * vol, dur: 0.16 });
  hit(c, t, { f0: 700, f1: 260, q: 0.7, gain: 0.26 * vol, dur: 0.07, type: "lowpass" });
}
/** The sound the page's setting turns on or off. */
export function setOn(v) { on = !!v; }
/** Makes the audio context from the first gesture (Safari starts it only inside one, and wants a buffer played there) and keeps trying at each gesture until it runs. */
export function unlock() {
  const events = ["pointerdown", "touchend", "keydown", "click"];
  const go = () => {
    ready = true;
    audio();
    if (!ctx) return;
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch { /* it is open anyway */ }
    if (ctx.state === "running") for (const e of events) removeEventListener(e, go, true);
  };
  for (const e of events) addEventListener(e, go, { capture: true, passive: true });
}
