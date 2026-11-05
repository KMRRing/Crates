// Fathom's sounds, made as they play (Web Audio, no files; after factor-sound.js): a word is a cast of the lead, its
// splash and the line running out through the leadsman's hands (longer the deeper the water), then his call, a bell for
// a marked fathom and a lower plain note for an unmarked one; a word refused is the lead knocking on the planking; a
// new rank is two bells. Off, and nothing is made. The context is made only from a tap (an iPhone starts sound only from one).
let ctx = null, master = null, hiss = null, on = true;

export const setSound = v => { on = !!v; };
function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function noise(c) {
  if (!hiss) {
    hiss = c.createBuffer(1, Math.floor(c.sampleRate * 0.8), c.sampleRate);
    const d = hiss.getChannelData(0);
    let a = 4242;                                   // a fixed sequence: the same water every time
    for (let i = 0; i < d.length; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; d[i] = a / 2147483648 - 1; }
  }
  return hiss;
}
function tone(c, t, { freq, to = freq, dur, gain, type = "sine" }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function wash(c, t, { freq, to = freq * 0.5, dur, gain, type = "bandpass", q = 1.2, attack = 0.03 }) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}
/** The lead hitting the water: a slap of spray and a low plunk, lower the more it has to fall. */
function splash(c, t, fathoms) {
  wash(c, t, { freq: 3200, to: 700, dur: 0.22, gain: 0.3, attack: 0.008 });
  tone(c, t, { freq: 230 - fathoms * 6, to: 70, dur: 0.18, gain: 0.3 });
}
/** The line running out through his hands: a patter of rope ticks, slowing as the lead sinks, a fathom to every few. */
function lineOut(c, t, fathoms) {
  const n = Math.min(14, 3 + Math.round(fathoms / 1.3));
  let at = t + 0.12;
  for (let i = 0; i < n; i++) {
    wash(c, at, { freq: 2600 - i * 90, to: 1400, dur: 0.04, gain: 0.07, type: "highpass", q: 0.7, attack: 0.004 });
    at += 0.045 + i * 0.012;
  }
  return at;
}
/** The leadsman's bell: a struck bell, its partials not quite harmonic. */
function bell(c, t, freq, gain = 0.2) {
  tone(c, t, { freq, dur: 0.9, gain });
  tone(c, t, { freq: freq * 2.76, dur: 0.45, gain: gain * 0.35 });
  tone(c, t, { freq: freq * 5.4, dur: 0.2, gain: gain * 0.12 });
}
/**
 * A word cast: the splash, the line running out, then the call. `fathoms` is the water it sounds; `mark` a marked
 * fathom (a bell), else the deep (a low note that rises, the call's voice); `rank` a new rank (two bells);
 * `full` finding no bottom (the line running to its end and a long bell).
 */
export function cast(fathoms, { mark = false, rank = false, full = false } = {}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  splash(c, t, fathoms);
  const end = lineOut(c, t, fathoms);
  if (full) { tone(c, end, { freq: 440, to: 330, dur: 0.7, gain: 0.12, type: "triangle" }); bell(c, end + 0.05, 660, 0.2); bell(c, end + 0.3, 990, 0.14); return; }
  if (rank) { bell(c, end, 660, 0.2); bell(c, end + 0.17, 990, 0.2); return; }
  if (mark) bell(c, end, 880, 0.18);
  else { tone(c, end, { freq: 330, to: 392, dur: 0.22, gain: 0.16, type: "triangle" }); tone(c, end + 0.02, { freq: 660, to: 784, dur: 0.18, gain: 0.04 }); }
}
/** A word refused: the lead knocking on the planking, dull. */
export function foul() {
  const c = audio();
  if (c) tone(c, c.currentTime, { freq: 150, to: 70, dur: 0.14, gain: 0.35, type: "triangle" });
}
