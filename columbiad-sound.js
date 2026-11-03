// Columbiad's sounds, made as they play (Web Audio: noise and short sine decays, no files, so there is nothing to cache and no
// licence to keep): the cannon's boom, a tick for each barrel of powder under the thumb, a hush while the shell is out, a chime
// when it arrives, a hollow thud when it does not. Off, and nothing is made at all. The audio context is made only from a
// touch (browsers, and an iPhone above all, start sound only from one) and is stopped while the menu is open or the page is
// hidden, which is the pause rule. An iPhone has no vibration for a web page, so the tick is a sound and a flash of the gauge.
let ctx = null, master = null, on = true, hiss = null, hush = null, quiet = false;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -14; squash.ratio.value = 6; squash.attack.value = 0.003; squash.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(squash).connect(ctx.destination);
    // an iPhone opens its output only once something has been played inside a touch: a buffer of one silent sample
    const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  }
  if (!quiet && ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
  return quiet ? null : ctx;
}
function noise(c) {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 1.5);
    hiss = c.createBuffer(1, n, c.sampleRate);
    const d = hiss.getChannelData(0);
    let a = 12345;                                            // a fixed sequence: the same hiss every time
    for (let i = 0; i < n; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; d[i] = a / 2147483648 - 1; }
  }
  return hiss;
}
function burst(c, t, { freq, to = freq, q = 0.7, gain, dur, type = "lowpass", at = 0 }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c);
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004 + at);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, 0);
  src.stop(t + dur + 0.05);
}
function tone(c, t, { freq, to = freq, gain, dur, type = "sine", attack = 0.003 }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(10, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const VOICES = {
  /** The cannon: a crack, a low thump falling away, and rumble that hangs. */
  boom(c, t) {
    burst(c, t, { freq: 4200, to: 300, q: 0.5, gain: 0.7, dur: 0.12 });
    burst(c, t, { freq: 420, to: 55, q: 0.8, gain: 1.0, dur: 1.1 });
    tone(c, t, { freq: 130, to: 34, gain: 0.95, dur: 0.7 });
    tone(c, t, { freq: 62, to: 28, gain: 0.7, dur: 1.0 });
  },
  /** One barrel of powder passing under the thumb: a short, dry tick, higher the more is loaded. */
  tick(c, t, { n = 4 }) {
    tone(c, t, { freq: 1500 + n * 55, to: 900 + n * 40, gain: 0.16, dur: 0.028, type: "triangle", attack: 0.001 });
  },
  /** A nudge: softer and lower than a tick. */
  nudge(c, t) {
    tone(c, t, { freq: 760, to: 520, gain: 0.1, dur: 0.03, type: "triangle", attack: 0.001 });
  },
  /** On arriving: a clean chime, three bell tones stepping up. */
  chime(c, t) {
    [[659.3, 0], [987.8, 0.1], [1318.5, 0.2]].forEach(([f, d]) => {
      tone(c, t + d, { freq: f, to: f * 0.998, gain: 0.3, dur: 1.5 });
      tone(c, t + d, { freq: f * 2.76, to: f * 2.75, gain: 0.05, dur: 0.6 });
    });
  },
  /** On missing: a hollow thud, wood on turf. */
  thud(c, t) {
    tone(c, t, { freq: 168, to: 62, gain: 0.7, dur: 0.32 });
    burst(c, t, { freq: 520, to: 130, q: 0.6, gain: 0.5, dur: 0.22 });
  },
};

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; if (!on) { this.hushStop(); if (ctx) ctx.suspend?.().catch(() => {}); } },
  /** From a touch: makes the audio context (and wakes it if the page was away). */
  unlock() { audio(); },
  play(name, opts = {}) {
    const c = audio();
    if (!c) return;
    VOICES[name]?.(c, c.currentTime + 0.005, opts);
  },
  /** The shell out in the air: a hush of air that rises and falls over `dur` seconds. */
  hush(dur) {
    const c = audio();
    if (!c) return;
    this.hushStop();
    const t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noise(c); src.loop = true;
    f.type = "bandpass"; f.Q.value = 0.9;
    f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(380, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.17, t + Math.min(0.25, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.1);
    hush = { src, g };
  },
  hushStop() {
    if (!hush || !ctx) { hush = null; return; }
    try { hush.g.gain.cancelScheduledValues(ctx.currentTime); hush.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04); hush.src.stop(ctx.currentTime + 0.2); } catch { /* already stopped */ }
    hush = null;
  },
  /** While the menu is open or the page is away: nothing sounds, and what was sounding stops. */
  suspend() { quiet = true; this.hushStop(); ctx?.suspend?.().catch(() => {}); },
  resume() { quiet = false; if (ctx && on) ctx.resume?.().catch(() => {}); },
};
