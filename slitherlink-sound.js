// Portolan's sounds, made as they play (Web Audio, no files, so they are there offline): a quill's scratch as a coast is inked, a
// lighter tick for a crossing, a soft bell when the survey is complete. Heard only on the chart (the 3D view); off, nothing is made.
let ctx = null, master = null, on = true, hiss = null;

function audio() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});      // a browser opens sound only from a tap
  return ctx;
}
function noise(c) {
  if (!hiss) {
    hiss = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate);
    const d = hiss.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return hiss;
}
/** Filtered noise with a ragged envelope: a nib dragged over vellum. */
function scratch(c, t, { freq, dur, gain }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c);
  f.type = "bandpass"; f.frequency.setValueAtTime(freq, t); f.frequency.linearRampToValueAtTime(freq * 0.8, t + dur); f.Q.value = 2.2;
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 1; i <= 5; i++) g.gain.linearRampToValueAtTime(gain * (0.45 + 0.55 * Math.random()) * (1 - i / 7), t + (dur * i) / 6);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.15);
  src.stop(t + dur + 0.02);
}
function ping(c, t, { freq, gain, dur }) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const VOICES = {
  quill: (c, t) => scratch(c, t, { freq: 3600 + Math.random() * 900, dur: 0.11, gain: 0.5 }),
  cross: (c, t) => scratch(c, t, { freq: 4800, dur: 0.045, gain: 0.3 }),
  bell: (c, t) => { for (const [r, gain, dur] of [[1, 0.2, 2.2], [2.76, 0.08, 1.4], [5.4, 0.035, 0.8]]) ping(c, t, { freq: 880 * r, gain, dur }); },
};

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; },
  played: 0,                              // how many sounds were made (for the tests)
  /** Opens the sound from a tap (an iPhone only from the end of a touch). */
  unlock() {
    const c = audio();
    if (!c || (c.unlocked && c.state === "running")) return;
    c.unlocked = true;
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start();
  },
  play(kind, after = 0) {
    const c = audio();
    if (!c || !VOICES[kind]) return;
    this.played++;
    VOICES[kind](c, c.currentTime + 0.02 + after);
  },
};
