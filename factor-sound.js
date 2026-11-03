// Hanse's sounds, made as they play (Web Audio: short sine decays and bursts of noise, no files, so nothing to fetch, cache or
// license), after Columbiad's (columbiad-sound.js): soft and short, a distinct one for each kind of move, a quiet bell for a
// trade. Which sound a move calls for is factor-cues.js's. Off, and nothing is made at all; the audio context is made only from
// a touch (an iPhone starts sound only from one); stopped while the menu is open or the page is away (the pause rule); a rival's
// or a computer's move is played softer than yours, and no more than MAX_LIVE sounds sound at once.
let ctx = null, master = null, dest = null, on = true, quiet = false, hiss = null, live = 0, lastLand = -1;
const MAX_LIVE = 6;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16; squash.ratio.value = 4; squash.attack.value = 0.004; squash.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(squash).connect(ctx.destination);
    const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();       // an iPhone opens its output on a first sound inside a touch
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  }
  if (!quiet && ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
  return quiet ? null : ctx;
}
function noise(c) {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 1.2);
    hiss = c.createBuffer(1, n, c.sampleRate);
    const d = hiss.getChannelData(0);
    let a = 4242;                                              // a fixed sequence: the same hiss every time
    for (let i = 0; i < n; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; d[i] = a / 2147483648 - 1; }
  }
  return hiss;
}
function burst(c, t, { freq, to = freq, q = 1, gain, dur, type = "bandpass" }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c);
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, 0);
  src.stop(t + dur + 0.05);
}
function tone(c, t, { freq, to = freq, gain, dur, type = "sine", attack = 0.004 }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(10, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}
/** A wooden knock: a short dull tap and a band of noise. */
const knock = (c, t, f = 190, gain = 0.2) => { tone(c, t, { freq: f, to: f * 0.7, gain, dur: 0.07 }); burst(c, t, { freq: f * 6, to: f * 3, q: 1.5, gain: gain * 0.35, dur: 0.03 }); };
/** A soft bell note: the pitch and a quiet inharmonic partner. */
const ding = (c, t, f, gain = 0.1, dur = 0.9) => { tone(c, t, { freq: f, gain, dur }); tone(c, t, { freq: f * 2.76, gain: gain * 0.16, dur: dur * 0.4 }); };

const VOICES = {
  /** Dice: five clacks on wood, spaced out like a roll settling, then one note that is higher the bigger the total (a seven is dull). */
  dice(c, t, { total = 7 }) {
    [0, 0.07, 0.13, 0.22, 0.34].forEach((d, i) => { knock(c, t + d, 230 + ((i * 53) % 90), 0.16 - i * 0.02); burst(c, t + d, { freq: 2600, to: 1400, q: 2, gain: 0.05, dur: 0.025 }); });
    if (total === 7) tone(c, t + 0.5, { freq: 150, to: 120, gain: 0.14, dur: 0.3 });
    else ding(c, t + 0.5, 392 * 2 ** ((total - 7) / 12), 0.07, 0.5);
  },
  /** A road laid: two knocks. */
  road(c, t) { knock(c, t, 200, 0.2); knock(c, t + 0.09, 170, 0.17); },
  /** A post founded: three taps of a mallet and a warm low note. */
  post(c, t) { [0, 0.08, 0.16].forEach((d, i) => knock(c, t + d, 160 + i * 25, 0.19)); tone(c, t + 0.2, { freq: 262, gain: 0.08, dur: 0.35 }); },
  /** A factory raised: a heavier tap, then an anvil's ring on two bright partials. */
  factory(c, t) {
    knock(c, t, 130, 0.26);
    [880, 1320].forEach((f, i) => tone(c, t + 0.1, { freq: f * 1.003 ** i, gain: 0.07 - i * 0.02, dur: 0.55 }));
    tone(c, t + 0.1, { freq: 220, gain: 0.07, dur: 0.4 });
  },
  /** The blockade moves: a creak of timber and a thump of hull. */
  blockade(c, t) {
    tone(c, t, { freq: 150, to: 105, gain: 0.07, dur: 0.4, type: "triangle", attack: 0.05 });
    burst(c, t, { freq: 700, to: 300, q: 4, gain: 0.05, dur: 0.38 });
    knock(c, t + 0.3, 110, 0.22);
  },
  /** A card taken from a hand: a quick swish and a low pluck falling away. */
  steal(c, t) { burst(c, t, { freq: 4200, to: 1200, q: 0.8, gain: 0.08, dur: 0.16 }); tone(c, t + 0.1, { freq: 330, to: 210, gain: 0.1, dur: 0.22 }); },
  /** A development card: two flicks of paper. */
  card(c, t) { burst(c, t, { freq: 3400, to: 2200, q: 1.2, gain: 0.07, dur: 0.07 }); burst(c, t + 0.09, { freq: 3000, to: 1800, q: 1.2, gain: 0.06, dur: 0.08 }); },
  /** A card landing: barely there. */
  land(c, t) { tone(c, t, { freq: 620, to: 540, gain: 0.018, dur: 0.05 }); },
  /** A trade done: two small coins. */
  trade(c, t) { ding(c, t, 1175, 0.07, 0.3); ding(c, t + 0.08, 1568, 0.06, 0.4); },
  /** The longest road or largest fleet changing hands: three rising notes. */
  title(c, t) { [392, 494, 587].forEach((f, i) => ding(c, t + i * 0.09, f, 0.1, 0.7)); },
  /** Your turn: two soft notes. */
  turn(c, t) { ding(c, t, 523, 0.07, 0.4); ding(c, t + 0.11, 659, 0.07, 0.5); },
  /** Won: a rising arpeggio held on the top. */
  win(c, t) { [523, 659, 784, 1047].forEach((f, i) => ding(c, t + i * 0.12, f, 0.12, i === 3 ? 1.6 : 0.8)); },
  /** Lost: two low notes, kind. */
  lose(c, t) { ding(c, t, 392, 0.08, 0.7); ding(c, t + 0.18, 330, 0.08, 0.9); },
  /** A trade to look at: a bell, quiet and low-key. */
  bell(c, t) { ding(c, t, 1318, 0.055, 1.1); },
};

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; if (!on && ctx) ctx.suspend?.().catch(() => {}); },
  /** From a touch: makes the audio context (and wakes it if the page was away). */
  unlock() { audio(); },
  /** One sound by name; `soft` plays it quieter (a rival's or a computer's move). */
  play(name, { soft = false, ...opts } = {}) {
    const c = audio();
    if (!c || !VOICES[name] || live >= MAX_LIVE) return;
    if (name === "land") { if (c.currentTime - lastLand < 0.07) return; lastLand = c.currentTime; }
    live++;
    setTimeout(() => { live--; }, 700);
    dest = c.createGain();
    dest.gain.value = soft ? 0.5 : 1;
    dest.connect(master);
    VOICES[name](c, c.currentTime + 0.005, opts);
  },
  /** While the menu is open or the page is away: nothing sounds. */
  suspend() { quiet = true; ctx?.suspend?.().catch(() => {}); },
  resume() { quiet = false; if (ctx && on) ctx.resume?.().catch(() => {}); },
};
