// Courier's sounds and haptics, made as they play (Web Audio: filtered noise, sine and saw decays, no files, so they're there offline), in the
// way of solitaire-sound.js and harbour-sound.js. The page hands over the rules' events (cue); every event the engine emits is mapped in EVENTS or
// listed in SILENT, and tests/courier-sound.mjs fails for one that is neither, so a new event cannot be forgotten.
//
// Browsers start audio only from a gesture, and Safari wants the resume() inside the gesture's own handler: unlock() listens for the first touch or
// key. A sound asked before that is silent, not queued. Light on the CPU: one noise buffer, a cap on voices alive, nothing made per frame (the
// footsteps are a distance counter; a voice is made only when a step falls).
import { JUMP_V } from "./reckoning-engine.js";

let ctx = null, master = null, hiss = null, ready = false, on = true, haptics = true, live = false, bed = null, cryTimer = 0, coinAt = -9, coinRun = 0, stride = 0, foot = 0;
const pans = typeof StereoPannerNode !== "undefined";
const MAX_VOICES = 22;
const ends = new Float64Array(MAX_VOICES);                 // when each voice slot falls silent (the context's clock)
const gate = {};                                            // when each named sound last played, for the rate limit
const heavy = [0, 0, 0, 0]; let heavyAt = 0;               // ids of bruisers cut once (their second cut is the heavy one)

function audio() {
  if (!on || !ready) return null;
  if (!ctx) {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
    const squash = ctx.createDynamicsCompressor();          // a chain of cuts and coins piles up; this keeps it from clipping
    squash.threshold.value = -12; squash.ratio.value = 6; squash.attack.value = 0.002; squash.release.value = 0.12;
    master = ctx.createGain();
    master.gain.value = 2.6;                                // the voices are written quiet; the squash catches the peaks
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});   // an iPhone "interrupts" it when the page was away
  return ctx.state === "running" ? ctx : null;
}
/** A free voice slot for a sound lasting `dur` from `t`, or false: the most important sounds (pri 1) may take the oldest one. */
function room(t, dur, pri = 0) {
  let free = -1, oldest = 0;
  for (let i = 0; i < MAX_VOICES; i++) {
    if (ends[i] <= t) { free = i; break; }
    if (ends[i] < ends[oldest]) oldest = i;
  }
  if (free < 0) { if (!pri) return false; free = oldest; }
  ends[free] = t + dur + 0.05;
  return true;
}
const often = (name, t, gap) => { if (t - (gate[name] || -9) < gap) return false; gate[name] = t; return true; };
const noise = c => {
  if (!hiss) {
    const n = Math.floor(c.sampleRate * 0.5);
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
const jitter = (x, by = 0.08) => x * (1 + (Math.random() * 2 - 1) * by);

/** Filtered noise: its centre glides from `f0` to `f1` over `dur`, the level falling from `gain`. */
function hit(c, t, { f0, f1 = f0, q = 1, gain, dur, pan = 0, type = "bandpass", attack = 0.002, pri = 0 }) {
  if (!room(t, dur, pri)) return;
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
/** A tone gliding from `f0` to `f1`: the body under a thud, a ping, a bell. `filter` shapes a saw into a cry. */
function tone(c, t, { f0, f1 = f0, gain, dur, type = "sine", attack = 0.003, pan = 0, pri = 0, filter = 0, q = 3 }) {
  if (!room(t, dur, pri)) return;
  const o = c.createOscillator(), g = out(c, pan);
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (filter) { const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filter; f.Q.value = q; o.connect(f).connect(g); } else o.connect(g);
  o.start(t); o.stop(t + dur + 0.03);
}
/** A struck bell: a fundamental and two partials that are not harmonics, ringing for `dur`. */
function bell(c, t, f, gain, dur, pan = 0) {
  tone(c, t, { f0: f, gain, dur, pan, pri: 1 });
  tone(c, t, { f0: f * 2.76, gain: gain * 0.35, dur: dur * 0.5, pan });
  tone(c, t, { f0: f * 5.4, gain: gain * 0.12, dur: dur * 0.25, pan });
}
/** A gull's cry: a saw swept up and down through a formant. `far` takes the top off (the bed's). */
function cry(c, t, gain, far = false, pan = 0) {
  const k = far ? 0.7 : 1, d = far ? 0.55 : 0.34;
  tone(c, t, { f0: 1250 * k, f1: 2100 * k, gain, dur: d * 0.45, type: "sawtooth", filter: 2000 * k, q: 4, pan, attack: 0.02 });
  tone(c, t + d * 0.4, { f0: 2100 * k, f1: 1050 * k, gain: gain * 0.9, dur: d * 0.7, type: "sawtooth", filter: 1800 * k, q: 4, pan, attack: 0.01 });
}

// ---------- the sounds ----------

const swish = (c, t, v, pan, hi = 1) => hit(c, t, { f0: jitter(1500 * hi), f1: jitter(3400 * hi), q: 0.9, gain: 0.2 * v, dur: 0.1, pan });
function thud(c, t, v = 1, deep = 1) {
  tone(c, t, { f0: 130 * deep, f1: 52 * deep, gain: 0.5 * v, dur: 0.2, pri: 1 });
  hit(c, t, { f0: 600, f1: 220, q: 0.7, gain: 0.28 * v, dur: 0.09, type: "lowpass", pri: 1 });
}
function ping(c, t, step, v = 1) {                          // a coin: pentatonic steps up the chain, a bright partial on top
  const f = Math.min(3520, 880 * 2 ** ([0, 2, 4, 7, 9][step % 5] / 12 + Math.floor(step / 5)));
  tone(c, t, { f0: f, gain: 0.16 * v, dur: 0.2, attack: 0.002 });
  tone(c, t, { f0: f * 2.01, gain: 0.05 * v, dur: 0.08 });
}
function pop(c, t, v) { hit(c, t, { f0: 3000, q: 0.5, gain: 0.3 * v, dur: 0.03, pri: 1 }); tone(c, t, { f0: 420, f1: 140, gain: 0.2 * v, dur: 0.05 }); }
function crack(c, t, v) {
  hit(c, t, { f0: 3200, q: 0.6, gain: 0.3 * v, dur: 0.07, type: "highpass", pri: 1 });
  hit(c, t, { f0: 800, f1: 400, q: 1.5, gain: 0.34 * v, dur: 0.08 });
  hit(c, t + 0.045, { f0: 1500, q: 2, gain: 0.2 * v, dur: 0.05 });
  tone(c, t, { f0: 190, f1: 80, gain: 0.26 * v, dur: 0.11 });
}
/** A cut, by what was cut: a tick for a gull, a chunk for a crab, a heavier one for a bruiser, a crack for a barrel, a pop for a balloon. */
function cut(c, t, kind, v = 1, big = false) {
  if (kind === "gull") {
    hit(c, t, { f0: 5200, q: 0.8, gain: 0.3 * v, dur: 0.03, type: "highpass", pri: 1 });
    tone(c, t, { f0: 1900, f1: 1300, gain: 0.1 * v, dur: 0.03 });
  } else if (kind === "barrel" || kind === "roller") crack(c, t, v);
  else if (kind === "balloon") pop(c, t, v);
  else if (kind === "shield") {                                  // a shield rung like a bell, then the man
    tone(c, t, { f0: 330, f1: 300, gain: 0.3 * v, dur: 0.35, type: "triangle", pri: 1 });
    tone(c, t, { f0: 497, f1: 470, gain: 0.16 * v, dur: 0.25, type: "triangle" });
    hit(c, t, { f0: 1500, f1: 600, q: 1, gain: 0.3 * v, dur: 0.06, pri: 1 });
  } else if (kind === "thrower") {                               // glass, and a grunt
    hit(c, t, { f0: 4200, q: 1.2, gain: 0.26 * v, dur: 0.05, type: "highpass", pri: 1 });
    tone(c, t, { f0: 190, f1: 90, gain: 0.3 * v, dur: 0.1 });
  } else if (kind === "pirate") {
    hit(c, t, { f0: 1300, f1: 500, q: 1, gain: 0.34 * v, dur: 0.07, pri: 1 });
    tone(c, t, { f0: 140, f1: 70, gain: 0.34 * v, dur: 0.14 });
    tone(c, t + 0.03, { f0: 440, f1: 250, gain: 0.1 * v, dur: 0.12, type: "sawtooth", filter: 1200 });
  }
  else if (big) {
    tone(c, t, { f0: 150, f1: 48, gain: 0.55 * v, dur: 0.24, pri: 1 });
    hit(c, t, { f0: 1100, f1: 300, q: 0.8, gain: 0.4 * v, dur: 0.1, pri: 1 });
    hit(c, t, { f0: 2400, q: 1.5, gain: 0.2 * v, dur: 0.04 });
  } else {
    hit(c, t, { f0: 1000, f1: 500, q: 1, gain: 0.36 * v, dur: 0.06, pri: 1 });
    tone(c, t, { f0: 230, f1: 110, gain: 0.32 * v, dur: 0.08 });
  }
}
function amber(c, t) { [1318.5, 1760, 2093, 2637].forEach((f, i) => bell(c, t + i * 0.07, f, 0.1, 0.7)); }
function drum(c, t, v = 1) {
  tone(c, t, { f0: 150, f1: 62, gain: 0.55 * v, dur: 0.3, pri: 1 });
  hit(c, t, { f0: 500, f1: 180, q: 0.7, gain: 0.25 * v, dur: 0.12, type: "lowpass", pri: 1 });
}
function splash(c, t) {
  hit(c, t, { f0: 2400, f1: 600, q: 0.6, gain: 0.4, dur: 0.5, pri: 1, attack: 0.01 });
  hit(c, t, { f0: 500, f1: 200, q: 0.7, gain: 0.4, dur: 0.35, type: "lowpass", pri: 1 });
  tone(c, t + 0.08, { f0: 320, f1: 900, gain: 0.12, dur: 0.1 });
  tone(c, t + 0.2, { f0: 260, f1: 760, gain: 0.09, dur: 0.12 });
}
const HURT = 40, WRONG = [25, 45, 70], FALL = [60, 40, 90];
/** A short vibration where the browser has one (not iOS Safari: skipped there). */
function buzz(pattern) {
  if (haptics && typeof navigator !== "undefined" && navigator.vibrate) try { navigator.vibrate(pattern); } catch { /* blocked */ }
}
const sideOf = ev => (ev.dir > 0 ? 0.4 : ev.dir < 0 ? -0.4 : 0);

/** Every event the engine emits that makes a sound: (event, context, now). */
export const EVENTS = {
  jump(ev, c, t) {
    if (!often("jump", t, 0.04)) return;
    tone(c, t, { f0: ev.air ? 420 : 250, f1: ev.air ? 760 : 470, gain: 0.13, dur: 0.1 });
    hit(c, t, { f0: 900, f1: 2000, q: 0.8, gain: 0.08, dur: 0.07 });
  },
  lane(ev, c, t) { if (often("lane", t, 0.05)) swish(c, t, 0.8, sideOf(ev)); },
  lunge(ev, c, t) { if (often("lunge", t, 0.05)) swish(c, t, 1.3, sideOf(ev), 1.25); },
  dive(ev, c, t) { if (often("dive", t, 0.08)) hit(c, t, { f0: 3000, f1: 450, q: 0.9, gain: ev.slam ? 0.3 : 0.22, dur: 0.24 }); },
  roll(ev, c, t) {
    if (!often("roll", t, 0.1)) return;
    for (let i = 0; i < 3; i++) hit(c, t + i * 0.085, { f0: 650 + i * 120, q: 1.1, gain: 0.2, dur: 0.11, type: "lowpass" });
  },
  land(ev, c, t) {
    if (!often("land", t, 0.05)) return;
    if (ev.slam) { thud(c, t, 1.5, 0.55); return; }
    if (ev.v > JUMP_V * 1.35) { thud(c, t, 1, 0.8); return; }
    hit(c, t, { f0: 500, f1: 260, q: 0.7, gain: 0.2, dur: 0.07, type: "lowpass" });
    tone(c, t, { f0: 120, f1: 75, gain: 0.16, dur: 0.07 });
  },
  shockwave(ev, c, t) {
    hit(c, t + 0.02, { f0: 180, f1: 1500, q: 0.8, gain: 0.34, dur: 0.38, attack: 0.05, pri: 1 });
    tone(c, t + 0.02, { f0: 62, f1: 40, gain: 0.3, dur: 0.45, pri: 1 });
  },
  kill(ev, c, t) {
    if (!often("kill" + ev.id, t, 0.05)) return;
    const big = ev.kind === "crab" && heavy.includes(ev.id);
    cut(c, t, ev.kind, ev.how === "slam" ? 0.7 : ev.how === "bump" || ev.how === "crash" ? 0.9 : 1, big);
  },
  stagger(ev, c, t) { heavy[heavyAt++ & 3] = ev.id; cut(c, t, "crab", 1, true); },
  clang(ev, c, t) { tone(c, t, { f0: 620, gain: 0.14, dur: 0.18, type: "triangle" }); tone(c, t, { f0: 933, gain: 0.08, dur: 0.12, type: "triangle" }); },
  pick(ev, c, t) {
    if (ev.what === "coin") {
      coinRun = t - coinAt < 0.7 ? Math.min(coinRun + 1, 9) : 0; coinAt = t;
      ping(c, t, coinRun);
    } else if (ev.what !== "gem") {                           // amber's chime is its heart's
      tone(c, t, { f0: 520, f1: 780, gain: 0.12, dur: 0.1 });
      tone(c, t + 0.05, { f0: 780, f1: 1040, gain: 0.1, dur: 0.1 });
    }
  },
  coins(ev, c, t) {
    for (let i = 0; i < Math.min(ev.n, 4); i++) { coinRun = Math.min(coinRun + 1, 9); ping(c, t + 0.03 + i * 0.05, coinRun, 0.8); }
    coinAt = t;
  },
  heart(ev, c, t) {
    if (ev.gem) { amber(c, t); return; }
    tone(c, t, { f0: 392, gain: 0.14, dur: 0.3, pri: 1 });
    tone(c, t + 0.09, { f0: 587, gain: 0.12, dur: 0.4, pri: 1 });
  },
  seized(ev, c, t) { thud(c, t, 0.8); buzz(HURT); },
  hurt(ev, c, t) {
    thud(c, t, 1.1);
    tone(c, t + 0.02, { f0: 98, f1: 78, gain: 0.26, dur: 0.24, type: "triangle", pri: 1 });   // the short low tone
    buzz(HURT);
  },
  fall(ev, c, t) { splash(c, t); buzz(FALL); },
  wind(ev, c, t) {                                            // the telegraph, heard as well as seen
    const pan = (ev.lane || 0) * 0.5;
    if (ev.kind === "gull") cry(c, t, 0.1, false, pan);
    else if (ev.kind === "crab") {
      hit(c, t, { f0: 3600, q: 1, gain: 0.2, dur: 0.02, type: "highpass", pan });
      hit(c, t + 0.07, { f0: 3200, q: 1, gain: 0.22, dur: 0.02, type: "highpass", pan });
    } else if (ev.kind === "thrower") {                         // a bottle neck clinked, a breath drawn
      bell(c, t, 2093, 0.1, 0.3, pan); hit(c, t + 0.1, { f0: 600, f1: 1400, q: 0.8, gain: 0.14, dur: 0.25, pan, attack: 0.1 });
    } else if (ev.kind === "roller") {                          // a barrel started: the low rumble of staves on planks
      for (let i = 0; i < 4; i++) tone(c, t + i * 0.06, { f0: 90 + i * 8, f1: 70, gain: 0.2, dur: 0.07, type: "triangle", pan });
    } else if (ev.kind === "shield") {                          // a boss rapped with a knuckle
      tone(c, t, { f0: 700, f1: 640, gain: 0.16, dur: 0.12, type: "triangle", pan }); tone(c, t + 0.08, { f0: 700, f1: 640, gain: 0.14, dur: 0.12, type: "triangle", pan });
    } else if (ev.kind === "pirate") {                          // a rope creaking under a weight
      hit(c, t, { f0: 420, f1: 780, q: 4, gain: 0.16, dur: 0.3, pan, attack: 0.05 }); tone(c, t, { f0: 120, f1: 160, gain: 0.1, dur: 0.3, type: "sawtooth", pan, filter: 500 });
    }
  },
  launch(ev, c, t) {
    const pan = (ev.lane || 0) * 0.5;
    if (ev.kind === "gull") hit(c, t, { f0: 2600, f1: 700, q: 0.9, gain: 0.16, dur: 0.2, pan });
    else if (ev.kind === "crab" || ev.kind === "shield") hit(c, t, { f0: 900, f1: 500, q: 1, gain: 0.12, dur: 0.1, pan });
    else if (ev.kind === "roller") { thud(c, t, 0.7, 1.2); hit(c, t, { f0: 300, f1: 150, q: 0.8, gain: 0.2, dur: 0.4, type: "lowpass", pan }); }
    else if (ev.kind === "pirate") hit(c, t, { f0: 2400, f1: 500, q: 0.9, gain: 0.2, dur: 0.3, pan });       // the swing: air torn
  },
  throw(ev, c, t) {                                           // a whistle through the air, to the lane aimed at
    const pan = (ev.aim || 0) * 0.5;
    hit(c, t, { f0: 1800, f1: ev.shot === "anchor" ? 500 : 2600, q: 1.4, gain: 0.2, dur: ev.shot === "anchor" ? 0.5 : 0.18, pan });
  },
  smash(ev, c, t) { thud(c, t, 1.1, 1.4); hit(c, t, { f0: 1500, f1: 700, q: 1, gain: 0.3, dur: 0.1, pri: 1, pan: (ev.lane || 0) * 0.5 }); bell(c, t, 261.6, 0.12, 0.5); },
  answer(ev, c, t) {
    if (ev.ok === true) { bell(c, t, 988, 0.18, 0.8); bell(c, t + 0.1, 1480, 0.14, 1); return; }
    drum(c, t, ev.ok === false ? 1 : 0.7); drum(c, t + 0.14, 0.6);
    buzz(WRONG);
  },
  walljump(ev, c, t) { EVENTS.jump({ air: true }, c, t); },
  wallrun(ev, c, t) { if (often("wallrun", t, 0.1)) hit(c, t, { f0: 1400, f1: 900, q: 1.5, gain: 0.14, dur: 0.18, pan: ev.side > 0 ? 0.3 : -0.3 }); },
  pad(ev, c, t) { tone(c, t, { f0: 170, f1: 560, gain: 0.2, dur: 0.2, type: "triangle", pri: 1 }); hit(c, t, { f0: 800, f1: 2400, q: 0.8, gain: 0.1, dur: 0.12 }); },
  finish(ev, c, t) { if (ev.won) [523.3, 659.3, 784, 1046.5].forEach((f, i) => bell(c, t + i * 0.1, f, 0.14, 0.9)); else drum(c, t, 0.8); },
};
/** Events that deliberately make no sound: another event covers them, or there is nothing to hear. */
export const SILENT = [
  "wait",        // a swipe kept for later: nothing has happened yet
  "late",        // a kept swipe that worked: its lane/lunge event follows and sounds
  "drop",        // a kept swipe that never worked
  "notice",      // a foe has seen me: its wind-up is the telegraph that is heard
  "wallleave",   // the wall let go: the jump or lane event of the swipe sounds
  "clash",       // a lunging foe met my swipe: its kill or stagger follows and sounds
  "wallend",     // the wall ran out: the fall or landing sounds
  "over",        // the run ended: the hit or fall that ended it has sounded
];

/** The page hands over each event the rules emit (never in a watching frame). */
export function cue(ev) {
  const fn = EVENTS[ev.type];
  if (!fn) return;
  const c = audio();
  if (c) fn(ev, c, c.currentTime);
  else if (ev.type === "hurt" || ev.type === "seized") buzz(HURT);          // no audio yet (or none at all): the haptics still go
  else if (ev.type === "fall") buzz(FALL);
  else if (ev.type === "answer" && ev.ok !== true) buzz(WRONG);
}
/** A new biome: a soft two-note bell. */
export function biome() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  bell(c, t, 523.3, 0.1, 1.2); bell(c, t + 0.18, 784, 0.09, 1.5);
}
/** Footsteps tied to run speed: called each frame; a step falls every STRIDE metres run on the ground, alternating feet, soft and low. */
const STRIDE = 3.3;
export function feet(dt, mps, onGround) {
  if (!live || !onGround || mps <= 0) return;
  stride += dt * mps;
  if (stride < STRIDE) return;
  stride -= STRIDE;
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  foot ^= 1;
  if (!room(t, 0.07)) return;
  hit(c, t, { f0: foot ? 420 : 340, f1: 200, q: 0.7, gain: 0.07, dur: 0.06, type: "lowpass" });
  tone(c, t, { f0: foot ? 105 : 90, f1: 60, gain: 0.07, dur: 0.06 });
}

// ---------- the bed: water lapping and an occasional distant gull ----------

function startBed(c) {
  if (bed) return;
  const src = c.createBufferSource(), lo = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
  src.buffer = noise(c); src.loop = true;
  lo.type = "lowpass"; lo.frequency.value = 380;
  g.gain.value = 0.0001; g.gain.setTargetAtTime(0.05, c.currentTime, 0.6);
  lfo.frequency.value = 0.21; depth.gain.value = 0.025;      // a lap every five seconds or so
  lfo.connect(depth).connect(g.gain);
  src.connect(lo).connect(g).connect(master);
  src.start(0, Math.random() * 0.2); lfo.start();
  bed = { src, lfo, g };
}
function stopBed() {
  if (!bed) return;
  const b = bed; bed = null;
  try { b.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); } catch { /* the context is gone */ }
  setTimeout(() => { try { b.src.stop(); b.lfo.stop(); } catch { /* already stopped */ } }, 900);
}
function gullLater() {
  clearTimeout(cryTimer);
  cryTimer = setTimeout(() => {
    const c = audio();
    if (live && c) cry(c, c.currentTime, 0.035, true, Math.random() - 0.5);
    if (live) gullLater();
  }, 9000 + Math.random() * 14000);
}
function hush() { clearTimeout(cryTimer); stopBed(); }
function wake() {
  const c = audio();
  if (c) startBed(c);
  else if (ctx) setTimeout(() => { const c2 = live && !bed && audio(); if (c2) startBed(c2); }, 300);   // the context is resuming (the tab came back)
  gullLater();
}
/** True while the run is going (not paused, not over, not hidden): the bed plays and the footsteps fall; false silences both. */
export function setLive(v) {
  v = !!v;
  if (v === live) return;
  live = v;
  if (live) wake(); else hush();
}
export function setOn(v) { on = !!v; if (!on) hush(); else if (live) wake(); }
export function setHaptics(v) { haptics = !!v; }
/** A little ping, for the menu's Sound switch turned on. */
export function sample() { const c = audio(); if (c) ping(c, c.currentTime, 0); }
/** Makes the audio context from the first gesture (Safari starts it only inside one, and wants a buffer played there), and keeps trying at each gesture until it runs. */
export function unlock() {
  const events = ["pointerdown", "touchend", "keydown", "click"];
  const go = () => {
    ready = true;
    audio();
    if (!ctx) return;
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch { /* it is open anyway */ }
    if (ctx.state === "running") {
      for (const e of events) removeEventListener(e, go, true);
      if (live && !bed) wake();
    }
  };
  for (const e of events) addEventListener(e, go, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {      // a hidden tab is silent and costs nothing
    if (document.hidden) { hush(); if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); }
    else if (live) wake();
  });
}
