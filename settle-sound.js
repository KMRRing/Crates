// Settle's sounds (redesign of 23 November 2026, Korbi: "sound design too"), made as they play with Web Audio, no files, so they are
// there offline:
//   the hearth: a low roar of filtered noise with now and then a coal cracking, under everything while a level is open;
//   pick: a crucible lifted, the clay knocking on the hearth stone;
//   pour: molten metal running, a thick gurgle whose pitch falls with the metal's weight (lead low, tin bright), as long as the pour;
//   settle: what sinks slides down under the rest, a soft falling sweep (only when a metal sinks through another);
//   cast: steam off the hot mould and an anvil-like ring, a step higher for each mould cast in a row;
//   refuse: a dull clunk (a full crucible, or nothing to pour);
//   hint: a small brass tick; win: the foundry bell, three strokes.
// Browsers start audio only from a touch, so nothing is made until the page calls unlock() from one; with Sound off, nothing at all.
let ctx = null, master = null, on = true, white = null, hearth = null;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16; squash.ratio.value = 4; squash.attack.value = 0.003; squash.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});   // an iPhone suspends audio while the page is away
  return ctx;
}
const noise = c => {
  if (!white) {
    const n = Math.floor(c.sampleRate * 2);
    white = c.createBuffer(1, n, c.sampleRate);
    const d = white.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return white;
};
/** A burst of filtered noise: an envelope over a band that may sweep. */
function burst(c, t, { freq, q = 1, gain, dur, type = "bandpass", sweep = 1, attack = 0.004, out = master }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c);
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}
/** A struck or sung tone: partials (ratios of the fundamental, with their own decays) for metal; a plain sine without. */
function tone(c, t, { freq, gain, dur, drop = 1, attack = 0.002, type = "sine", partials = null }) {
  for (const [ratio, level, decay] of partials || [[1, 1, 1]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq * ratio, t);
    if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * ratio * drop, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
// a bell's partials (hum, prime, tierce, quint, nominal): the inharmonic ring of cast bronze
const BELL = [[0.5, 0.5, 1], [1, 1, 0.8], [1.19, 0.5, 0.6], [1.5, 0.35, 0.5], [2, 0.45, 0.4], [2.74, 0.2, 0.25]];
const ANVIL = [[1, 1, 1], [2.76, 0.45, 0.5], [5.4, 0.22, 0.3], [8.9, 0.1, 0.18]];

/** Each sound: a function of the context, its start time and an argument bag. */
export const SOUNDS = {
  pick: (c, t) => { tone(c, t, { freq: 180, gain: 0.32, dur: 0.12, drop: 0.6, type: "triangle" }); burst(c, t, { freq: 1600, q: 1.2, gain: 0.18, dur: 0.05 }); },
  /** a: { weight 0 light .. 1 heavy, n measures }: as long as the pour, lower for heavier metal. */
  pour: (c, t, a) => {
    const w = a.weight ?? 0.5, len = 0.32 + 0.16 * (a.n || 1), base = 620 - 380 * w;
    burst(c, t, { freq: base * 1.6, q: 0.7, gain: 0.22, dur: len, attack: 0.05, type: "lowpass", sweep: 0.7 });     // the stream's rush
    for (let k = 0; k < 4 + 2 * (a.n || 1); k++) {                                                                    // its gurgles
      const at = t + 0.04 + k * len / (4 + 2 * (a.n || 1)) + Math.random() * 0.03, f = base * (0.8 + Math.random() * 0.5);
      tone(c, at, { freq: f, gain: 0.16, dur: 0.09, drop: 1.6, attack: 0.008 });
      burst(c, at, { freq: f * 2, q: 6, gain: 0.12, dur: 0.07, sweep: 1.5 });
    }
  },
  settle: (c, t) => { burst(c, t, { freq: 900, q: 3, gain: 0.16, dur: 0.5, sweep: 0.25, attack: 0.04 }); tone(c, t + 0.05, { freq: 140, gain: 0.18, dur: 0.45, drop: 0.55 }); },
  /** a: { k }: the k-th mould cast by one pour rings a step higher. */
  cast: (c, t, a) => {
    burst(c, t, { freq: 4800, q: 0.6, gain: 0.3, dur: 0.9, type: "highpass", sweep: 0.45, attack: 0.02 });            // steam off the mould
    tone(c, t + 0.08, { freq: 660 * Math.pow(1.189, a.k || 0), gain: 0.22, dur: 1.6, partials: ANVIL });
  },
  refuse: (c, t) => { tone(c, t, { freq: 120, gain: 0.4, dur: 0.16, drop: 0.7, type: "triangle" }); burst(c, t, { freq: 400, q: 1, gain: 0.2, dur: 0.08 }); },
  hint: (c, t) => tone(c, t, { freq: 1320, gain: 0.12, dur: 0.25, partials: ANVIL }),
  undo: (c, t) => { burst(c, t, { freq: 700, q: 2, gain: 0.14, dur: 0.12, sweep: 1.8 }); },
  win: (c, t) => { for (let k = 0; k < 3; k++) tone(c, t + k * 0.55, { freq: 392, gain: 0.3 - k * 0.05, dur: 3.2, partials: BELL }); },
};

/** The hearth's roar: on while a level is open and the page is in view. */
function setHearth(want) {
  const c = want ? audio() : ctx;
  if (!c) return;
  if (want && !hearth) {
    const src = c.createBufferSource(), lo = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noise(c); src.loop = true;
    lo.type = "lowpass"; lo.frequency.value = 220; lo.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1.5);
    src.connect(lo).connect(g).connect(master); src.start();
    const crackle = setInterval(() => { if (Math.random() < 0.45) burst(c, c.currentTime, { freq: 2500 + Math.random() * 3000, q: 4, gain: 0.04 + Math.random() * 0.05, dur: 0.03, attack: 0.001 }); }, 260);
    hearth = { src, g, crackle };
  } else if (!want && hearth) {
    const h = hearth; hearth = null;
    clearInterval(h.crackle);
    h.g.gain.cancelScheduledValues(c.currentTime); h.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.2);
    h.src.stop(c.currentTime + 1);
  }
}

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; if (!on) setHearth(false); },
  /** Call from a touch: browsers open audio only from one. */
  unlock() { audio(); },
  /** Play a named sound `delay` seconds from now. */
  play(name, a = {}, delay = 0) {
    const c = audio();
    if (!c || c.state !== "running" || !SOUNDS[name]) return;
    SOUNDS[name](c, c.currentTime + delay + 0.005, a);
  },
  hearth(want) { if (on || !want) setHearth(want && on); },
};
