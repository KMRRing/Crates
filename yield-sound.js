// Constellation's sounds, made as they play (Web Audio, no files; after factor-sound.js): each star has a note of a
// pentatonic scale, so a word traced is a little tune, and a word found plays its own trail back, faster, ending on a
// bell; a word refused is a low soft knock; a new rank is two bells; a full tour runs up all seven stars; the shadows
// are a breath of air, in or out; a hint is one high ping. Off, and nothing is made. The context is made only from a
// tap (an iPhone starts sound only from one).
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
    let a = 4242;                                   // a fixed sequence: the same air every time
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
function breath(c, t, { from, to, dur, gain }) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  f.type = "bandpass"; f.Q.value = 1.4; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}
/** The note of a star: C D E G A over two octaves' first seven steps, by its place in the letters. */
export const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
const note = i => NOTES[((i % NOTES.length) + NOTES.length) % NOTES.length];
function chime(c, t, freq, gain = 0.14, dur = 0.5) {
  tone(c, t, { freq, dur, gain });
  tone(c, t, { freq: freq * 2.01, dur: dur * 0.5, gain: gain * 0.25 });
}
function bell(c, t, freq, gain = 0.2) {
  tone(c, t, { freq, dur: 0.9, gain });
  tone(c, t, { freq: freq * 2.76, dur: 0.45, gain: gain * 0.35 });
  tone(c, t, { freq: freq * 5.4, dur: 0.2, gain: gain * 0.12 });
}

/** A star touched on the way into a word: its own note, short. */
export function tap(star) {
  const c = audio();
  if (c) chime(c, c.currentTime, note(star), 0.12, 0.28);
}
/**
 * A word found: its trail's stars, one note each, quicker than they were traced; then a bell (the last star's note an
 * octave up); `rank` a new rank (two bells after); `full` a full tour (the whole scale run up, a long bell).
 */
export function found(trail, { rank = false, full = false } = {}) {
  const c = audio();
  if (!c) return;
  let t = c.currentTime;
  const steps = trail.slice(0, 9), gap = Math.max(0.045, 0.5 / Math.max(steps.length, 1));
  steps.forEach((s, i) => chime(c, t + i * gap, note(s), 0.1, 0.3));
  t += steps.length * gap + 0.04;
  if (full) { NOTES.forEach((f, i) => chime(c, t + i * 0.06, f * 2, 0.08, 0.5)); bell(c, t + 0.45, 1318.5, 0.2); return; }
  bell(c, t, note(steps.at(-1) ?? 0) * 2, 0.16);
  if (rank) { bell(c, t + 0.18, 660, 0.18); bell(c, t + 0.36, 990, 0.18); }
}
/** A word refused: a low soft knock. */
export function foul() {
  const c = audio();
  if (c) tone(c, c.currentTime, { freq: 150, to: 70, dur: 0.14, gain: 0.3, type: "triangle" });
}
/** The shadows drawn in (on) or let go (off): a breath rising or falling. */
export function shadows(onNow) {
  const c = audio();
  if (c) breath(c, c.currentTime, onNow ? { from: 500, to: 2600, dur: 0.35, gain: 0.12 } : { from: 2600, to: 500, dur: 0.3, gain: 0.09 });
}
/** A hint: one high ping, a fifth above the first star's note. */
export function hint(star = 0) {
  const c = audio();
  if (c) { chime(c, c.currentTime, note(star) * 3 / 2 * 2, 0.1, 0.6); chime(c, c.currentTime + 0.09, note(star) * 2, 0.06, 0.5); }
}
