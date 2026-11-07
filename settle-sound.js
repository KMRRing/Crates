// Settle's sounds, made as they play (Web Audio: short noise bursts and sine decays, no files, so they are there offline):
// the glug of a pour, the clunk of a parcel settling, a bell for each block cast and a stream running off, a hiss for zinc
// burning to dross, the scrape of a skim, a rising chime for a melt won, a low thud for crucibles full, a tick for a pick.
// Browsers start audio only from a touch, so nothing is made until the page calls unlock() from one; off, and nothing is
// made at all.
let ctx = null, master = null, on = true, hiss = null;

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
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});   // an iPhone "interrupts" audio when the page was away
  return ctx;
}
const noise = c => {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 0.5);
    hiss = c.createBuffer(1, n, c.sampleRate);
    const d = hiss.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return hiss;
};
function burst(c, t, { freq, q = 1, gain, dur, type = "bandpass", sweep = 1 }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c);
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.1);
  src.stop(t + dur + 0.02);
}
function ping(c, t, { freq, gain, dur, drop = 0.9, attack = 0.001, type = "sine" }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Each sound is a function of the audio context, its start time and an argument bag ({ k }: a counter, for a chain's rising bells). */
export const SOUNDS = {
  tick: (c, t) => { burst(c, t, { freq: 3000, q: 2, gain: 0.3, dur: 0.03 }); ping(c, t, { freq: 1400, gain: 0.1, dur: 0.05, drop: 0.7 }); },
  glug: (c, t) => {
    burst(c, t, { freq: 500, q: 2.5, gain: 0.5, dur: 0.22, sweep: 2.4 });
    ping(c, t + 0.02, { freq: 220, gain: 0.3, dur: 0.18, drop: 1.7 });
    ping(c, t + 0.1, { freq: 300, gain: 0.2, dur: 0.14, drop: 1.5 });
  },
  clunk: (c, t) => { ping(c, t, { freq: 130, gain: 0.55, dur: 0.16, drop: 0.5 }); burst(c, t, { freq: 800, q: 0.8, gain: 0.3, dur: 0.06 }); },
  cast: (c, t, a) => {
    const f = 880 * Math.pow(1.122, (a.k || 0) * 2);   // each block of a chain a whole tone higher
    burst(c, t, { freq: 1500, q: 0.9, gain: 0.35, dur: 0.5, sweep: 0.3 });
    ping(c, t + 0.05, { freq: f, gain: 0.25, dur: 0.8, drop: 0.995 });
    ping(c, t + 0.06, { freq: f * 1.5, gain: 0.1, dur: 0.5, drop: 0.995 });
  },
  hiss: (c, t) => { burst(c, t, { freq: 5200, q: 0.7, gain: 0.35, dur: 0.6, type: "highpass", sweep: 0.5 }); ping(c, t, { freq: 90, gain: 0.2, dur: 0.3, drop: 0.7 }); },
  skim: (c, t) => { for (let k = 0; k < 4; k++) burst(c, t + k * 0.05, { freq: 2200 - k * 300, q: 2, gain: 0.25, dur: 0.07 }); ping(c, t, { freq: 160, gain: 0.25, dur: 0.18, drop: 0.7 }); },
  nope: (c, t) => { ping(c, t, { freq: 150, gain: 0.35, dur: 0.14, drop: 0.7, type: "triangle" }); ping(c, t + 0.09, { freq: 110, gain: 0.3, dur: 0.18, drop: 0.7, type: "triangle" }); },
  win: (c, t) => { [523, 659, 784, 1047].forEach((f, k) => ping(c, t + k * 0.11, { freq: f, gain: 0.22, dur: 0.9, drop: 0.998 })); },
  lose: (c, t) => { ping(c, t, { freq: 90, gain: 0.5, dur: 0.6, drop: 0.5, type: "sawtooth" }); burst(c, t, { freq: 300, q: 0.7, gain: 0.3, dur: 0.3, sweep: 0.4 }); },
};

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; },
  /** Call from a touch: browsers open audio only from one. */
  unlock() { audio(); },
  /** Play a named sound `delay` seconds from now; `a` is { k } (a counter, for the rising bells of a chain). */
  play(name, a = {}, delay = 0) {
    const c = audio();
    if (!c || c.state !== "running" || !SOUNDS[name]) return;
    SOUNDS[name](c, c.currentTime + delay + 0.005, a);
  },
};
