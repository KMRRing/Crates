// Shunt's sounds, made as they play (Web Audio: short noise bursts and sine decays, no files, so they're there offline): the tick of a
// lever chosen, the clack of one shoved, the ratchet of a line sliding (one click a gear, each higher than the last), the tap of a gear
// settling, a grinding for a jam, a bell for a jewel lit, the click of the cradle. Browsers start audio only from a touch, so nothing
// is made until the page calls unlock() from one; off, and nothing is made at all.
let ctx = null, master = null, on = true, hiss = null;
const pans = typeof StereoPannerNode !== "undefined";

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -18; squash.ratio.value = 5; squash.attack.value = 0.002; squash.release.value = 0.12;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});       // an iPhone "interrupts" audio when the page was away
  return ctx;
}
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
function burst(c, t, { freq, q = 1, gain, dur, pan, type = "bandpass" }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = out(c, pan);
  src.buffer = noise(c);
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.1);
  src.stop(t + dur + 0.02);
}
function ping(c, t, { freq, gain, dur, pan, drop = 0.9, attack = 0.001, type = "sine" }) {
  const o = c.createOscillator(), g = out(c, pan);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  tick: (c, t, a) => { burst(c, t, { freq: 3400, q: 2.2, gain: 0.35, dur: 0.035, pan: a.pan }); ping(c, t, { freq: 1500, gain: 0.12, dur: 0.05, pan: a.pan, drop: 0.7 }); },
  clack: (c, t, a) => { burst(c, t, { freq: 1900, q: 1.1, gain: 0.7, dur: 0.07, pan: a.pan }); ping(c, t, { freq: 190, gain: 0.5, dur: 0.12, pan: a.pan, drop: 0.55 }); },
  ratchet: (c, t, a) => {
    const f = 2300 + 260 * (a.k || 0);
    burst(c, t, { freq: f, q: 4, gain: 0.5, dur: 0.03, pan: a.pan });
    ping(c, t, { freq: f * 0.5, gain: 0.14, dur: 0.04, pan: a.pan, drop: 0.8 });
  },
  settle: (c, t, a) => { ping(c, t, { freq: 120, gain: 0.55, dur: 0.14, pan: a.pan, drop: 0.5 }); burst(c, t, { freq: 700, q: 0.8, gain: 0.35, dur: 0.06, pan: a.pan }); },
  grind: (c, t, a) => {
    for (let k = 0; k < 7; k++) burst(c, t + k * 0.045, { freq: 420 + 90 * (k % 3), q: 3, gain: 0.3, dur: 0.05, pan: a.pan, type: "bandpass" });
    ping(c, t, { freq: 90, gain: 0.3, dur: 0.4, pan: a.pan, drop: 0.7, type: "sawtooth" });
  },
  bell: (c, t, a) => { ping(c, t, { freq: 1320, gain: 0.25, dur: 0.9, pan: a.pan, drop: 0.995 }); ping(c, t + 0.01, { freq: 1980, gain: 0.12, dur: 0.6, pan: a.pan, drop: 0.995 }); },
  hold: (c, t, a) => { burst(c, t, { freq: 1200, q: 1.5, gain: 0.5, dur: 0.05, pan: a.pan }); ping(c, t, { freq: 260, gain: 0.3, dur: 0.1, pan: a.pan, drop: 0.6 }); },
};

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; },
  /** Call from a touch: browsers open audio only from one. */
  unlock() { audio(); },
  /** Play a named sound `delay` seconds from now; `a` is { pan (-1..1), k (a counter, for the ratchet) }. */
  play(name, a = {}, delay = 0) {
    const c = audio();
    if (!c || c.state !== "running" || !SOUNDS[name]) return;
    SOUNDS[name](c, c.currentTime + delay + 0.005, a);
  },
};
