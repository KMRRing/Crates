// Yield's sounds, made as they play (Web Audio, no files; after factor-sound.js): a word is a valve opening and a
// draw-off running into its cut, lower and longer the heavier the cut; a word refused is a dull valve thunk; a balanced
// slate is two bell tones. Off, and nothing is made. The context is made only from a tap (an iPhone starts sound only from one).
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
    let a = 4242;                                   // a fixed sequence: the same flow every time
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
function flow(c, t, { freq, dur, gain }) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}
/** A word drawn off into cut `i` (0 light ends .. 4 residue); `full` adds a bell. */
export function draw(i, full = false) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime, dur = 0.16 + i * 0.07;
  tone(c, t, { freq: 520 - i * 70, to: 300 - i * 40, dur: 0.07, gain: 0.25 });          // the valve
  flow(c, t + 0.05, { freq: 1500 - i * 220, dur, gain: 0.22 });                            // the draw-off running
  if (full) { tone(c, t + 0.1, { freq: 880, dur: 0.5, gain: 0.16 }); tone(c, t + 0.1, { freq: 1320, dur: 0.4, gain: 0.08 }); }
}
/** A word refused: a closed valve's thunk. */
export function shut() {
  const c = audio();
  if (c) tone(c, c.currentTime, { freq: 150, to: 70, dur: 0.14, gain: 0.35, type: "triangle" });
}
/** A balanced slate (or a new rank): two bell tones. */
export function slate() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, { freq: 660, dur: 0.5, gain: 0.2 }); tone(c, t + 0.16, { freq: 990, dur: 0.7, gain: 0.2 });
}
