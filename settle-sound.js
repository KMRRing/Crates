// Settle's sounds, made as they play with Web Audio, no files, so they are there offline. A foundry's (Korbi, 23 Nov 2026: "change
// the sounds so they're more appropriate with the theme"):
//   the hearth: embers crackling quietly over a barely-there warm bed, calm, no roar and no bellows (Korbi, 25 Nov 2026);
//   pick and lift: iron tongs closing on a clay crucible, a short clink and the clay's knock;
//   pour: molten metal running, a soft rush with a sizzle of oxide through it (not water's gurgle), heavier and lower for heavier
//   metal, as long as the pour, and the thick plop where it lands;
//   settle: a heavy metal sinking through a lighter one, a slow low welling;
//   cast: the ingot quenched, a burst of steam, and its ring as it is knocked from the mould, a step higher for each in a row;
//   refuse: the tongs knocking a crucible that will take nothing; undo: the tongs set the crucible back; hint: one breath of the bellows;
//   win: the foundry's bell, three strokes (bell metal, which the levels cast);
//   burn: zinc catching fire, a soft roar and a crackle as it goes up in white smoke; liquate: lead drawing the silver, a deep welling
//   with a faint bright ring.
// Browsers start audio only from a touch, so nothing is made until the page calls unlock() from one; at volume nought, nothing at all.
import { speaker, audible } from "./volume.js";
let ctx = null, master = null, on = true, white = null, hearth = null;

function audio() {
  if (!on || !audible()) return null;
  if (!ctx) {
    const C = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16; squash.ratio.value = 4; squash.attack.value = 0.003; squash.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(squash).connect(speaker(ctx));
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
// a bell's partials (hum, prime, tierce, quint, nominal): the inharmonic ring of cast bronze; an ingot's (a bar struck, its modes); iron's
const BELL = [[0.5, 0.5, 1], [1, 1, 0.8], [1.19, 0.5, 0.6], [1.5, 0.35, 0.5], [2, 0.45, 0.4], [2.74, 0.2, 0.25]];
const INGOT = [[1, 1, 1], [2.76, 0.4, 0.45], [5.4, 0.18, 0.25], [8.9, 0.08, 0.15]];
const IRON = [[1, 1, 1], [2.3, 0.6, 0.6], [3.9, 0.35, 0.4], [6.1, 0.2, 0.25]];
/** Tongs: iron meeting iron or clay, a bright short clink over a dull knock. */
function tongs(c, t, gain = 1, clay = 1) {
  tone(c, t, { freq: 1850 + Math.random() * 300, gain: 0.07 * gain, dur: 0.16, partials: IRON });
  burst(c, t, { freq: 3200, q: 2, gain: 0.08 * gain, dur: 0.03, attack: 0.001 });
  if (clay) { tone(c, t + 0.012, { freq: 210, gain: 0.22 * gain * clay, dur: 0.09, drop: 0.6, type: "triangle" }); burst(c, t + 0.012, { freq: 520, q: 1.4, gain: 0.12 * gain * clay, dur: 0.06 }); }
}
/** A sizzle: many tiny crackles, as oxide skin breaks on hot metal, over `dur` seconds. */
function sizzle(c, t, dur, gain) {
  const n = Math.round(dur * 55);
  for (let k = 0; k < n; k++) burst(c, t + Math.random() * dur, { freq: 3500 + Math.random() * 4000, q: 3, gain: gain * (0.4 + Math.random() * 0.6), dur: 0.012 + Math.random() * 0.02, attack: 0.001 });
}

/** Each sound: a function of the context, its start time and an argument bag. */
export const SOUNDS = {
  pick: (c, t) => tongs(c, t, 0.9),
  /** a: { weight 0 light .. 1 heavy, n measures, len seconds of pouring }: lower for heavier metal, as long as the pour. */
  pour: (c, t, a) => {
    const w = a.weight ?? 0.5, len = a.len ?? 0.3 + 0.14 * (a.n || 1), body = 520 - 300 * w;
    burst(c, t, { freq: body, q: 0.8, gain: 0.2, dur: len + 0.15, attack: 0.08, type: "bandpass", sweep: 0.75 });      // the stream's soft rush
    burst(c, t, { freq: 170 - 60 * w, q: 0.7, gain: 0.16, dur: len + 0.2, attack: 0.1, type: "lowpass" });            // its weight
    sizzle(c, t + 0.05, len, 0.05);
    const land = t + len * 0.375;                                                                                       // where it lands: a thick plop
    tone(c, land, { freq: 150 - 50 * w, gain: 0.24, dur: 0.22, drop: 0.55 });
    burst(c, land, { freq: 900, q: 1.5, gain: 0.08, dur: 0.12, sweep: 0.5 });
  },
  settle: (c, t) => {
    tone(c, t, { freq: 95, gain: 0.22, dur: 0.7, drop: 0.6, attack: 0.08 });
    for (let k = 0; k < 4; k++) tone(c, t + 0.08 + k * 0.11 + Math.random() * 0.04, { freq: 130 + Math.random() * 60, gain: 0.08, dur: 0.12, drop: 1.5, attack: 0.01 });
  },
  /** a: { k }: the k-th mould cast by one pour rings a step higher. */
  cast: (c, t, a) => {
    burst(c, t, { freq: 5200, q: 0.5, gain: 0.32, dur: 1.2, type: "highpass", sweep: 0.5, attack: 0.008 });           // the quench's steam
    sizzle(c, t, 0.6, 0.06);
    tone(c, t + 0.35, { freq: 523 * Math.pow(1.189, a.k || 0), gain: 0.2, dur: 1.8, partials: INGOT });                 // the ingot knocked out, ringing
  },
  refuse: (c, t) => { tongs(c, t, 0.7, 1.4); tongs(c, t + 0.09, 0.5, 1.2); },
  hint: (c, t) => {                                                                                                      // one breath of the bellows
    burst(c, t, { freq: 380, q: 0.6, gain: 0.16, dur: 0.55, attack: 0.18, sweep: 1.4 });
    burst(c, t + 0.05, { freq: 1200, q: 0.8, gain: 0.05, dur: 0.45, attack: 0.15, sweep: 0.8 });
  },
  undo: (c, t) => { burst(c, t, { freq: 900, q: 1.5, gain: 0.08, dur: 0.18, sweep: 0.6, attack: 0.02 }); tongs(c, t + 0.16, 0.6); },
  win: (c, t) => { for (let k = 0; k < 3; k++) tone(c, t + k * 0.55, { freq: 392, gain: 0.3 - k * 0.05, dur: 3.2, partials: BELL }); },
  burn: (c, t) => {
    burst(c, t, { freq: 700, q: 0.6, gain: 0.22, dur: 0.9, attack: 0.06, sweep: 2.2 });
    burst(c, t + 0.05, { freq: 260, q: 0.7, gain: 0.16, dur: 0.8, attack: 0.1, type: "lowpass" });
    sizzle(c, t, 0.7, 0.07);
  },
  liquate: (c, t) => {
    tone(c, t, { freq: 82, gain: 0.2, dur: 0.8, drop: 0.7, attack: 0.1 });
    for (let k = 0; k < 3; k++) tone(c, t + 0.1 + k * 0.13, { freq: 120 + Math.random() * 50, gain: 0.07, dur: 0.14, drop: 1.4, attack: 0.01 });
    tone(c, t + 0.25, { freq: 1568, gain: 0.05, dur: 0.9, partials: INGOT });
  },
};

/** The hearth (on while a level is open and the page is in view). Korbi, 25 Nov 2026: "make it an ambient crackling, not the weird
 *  wooshing. very quiet and calm, not a wild fire" - so no bellows and no roar: a barely-there warm bed, and over it embers
 *  crackling at uneven moments, mostly single dry ticks, sometimes a little run of them, rarely a soft pop. */
function setHearth(want) {
  const c = want ? audio() : ctx;
  if (!c) return;
  if (want && !hearth) {
    const src = c.createBufferSource(), lo = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noise(c); src.loop = true;
    lo.type = "lowpass"; lo.frequency.value = 140; lo.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.012, c.currentTime + 2.5);
    src.connect(lo).connect(g).connect(master); src.start();
    const crackle = (t, level) => burst(c, t, { freq: 1100 + Math.random() * 2400, q: 3, gain: level * (0.5 + Math.random()),
      dur: 0.008 + Math.random() * 0.014, attack: 0.001, sweep: 0.6 });
    const tick = setInterval(() => {
      const now = c.currentTime, roll = Math.random();
      if (roll < 0.22) crackle(now + Math.random() * 0.18, 0.012);                                    // a single ember ticking
      else if (roll < 0.27) for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++)       // a little run of them
        crackle(now + i * (0.03 + Math.random() * 0.05), 0.014);
      else if (roll < 0.285) burst(c, now, { freq: 420, q: 1.2, gain: 0.02, dur: 0.06, attack: 0.002, sweep: 0.5 });   // a soft pop
    }, 180);
    hearth = { src, g, tick };
  } else if (!want && hearth) {
    const h = hearth; hearth = null;
    clearInterval(h.tick);
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
