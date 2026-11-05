// Drift's sounds, synthesised as they play (Web Audio: oscillators and filtered noise, no files, so they are there offline):
// a harbour bed (wind, lapping water, now and then a gull and a creak), a slide and a thud in each good's own voice (salt
// hisses and slumps, a herring barrel rumbles and knocks hollow, furs drag and thump softly, amber ticks like glass), a
// ship's bell and a crane's chain when crates ship, a squall's patter and a wave's wash. Nothing is made before the first
// touch (browsers refuse it) or while sound is off; effects are rate-limited so a long slide stays a texture.
let ctx = null, master = null, bed = null, primed = false, on = true, gullTimer = 0;
const last = {};

function audio() {
  if (!on || !primed) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
const often = (name, ms) => { const t = performance.now(); if (t - (last[name] || 0) < ms) return false; last[name] = t; return true; };
const noiseBuf = (c, seconds, fade) => {
  const n = Math.floor(c.sampleRate * seconds), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (fade ? (1 - i / n) ** 1.5 : 1);
  return buf;
};
function tone(freq, dur, { type = "sine", gain = 0.2, attack = 0.005, release = 0.2, at = 0, glide = null } = {}) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur + release);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + attack + dur + release + 0.05);
}
function noise(dur, { gain = 0.2, freq = 400, type = "lowpass", q = 0.7, at = 0, fade = true, sweep = null, wobble = 0 } = {}) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf(c, dur, fade);
  f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  if (wobble) {                                                     // a barrel's rumble: the gain shivers as it turns
    const l = c.createOscillator(), d = c.createGain();
    l.frequency.value = wobble; d.gain.value = gain * 0.6;
    l.connect(d).connect(g.gain); l.start(t0); l.stop(t0 + dur);
  }
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// each good's voice: a slide (filtered noise) and a landing
const VOICE = [
  { slide: { freq: 3200, type: "bandpass", q: 0.6, gain: 0.07 }, land: () => { noise(0.18, { gain: 0.3, freq: 700 }); noise(0.1, { gain: 0.05, freq: 5000, type: "highpass" }); } },                    // salt: a hiss, a soft slump
  { slide: { freq: 220, type: "lowpass", q: 1, gain: 0.16, wobble: 17 }, land: () => { tone(150, 0.05, { type: "triangle", gain: 0.32, glide: 70, release: 0.16 }); noise(0.05, { gain: 0.18, freq: 1500 }); } },   // herring: a rumble, a hollow knock
  { slide: { freq: 520, type: "lowpass", q: 0.5, gain: 0.09 }, land: () => { noise(0.22, { gain: 0.35, freq: 260 }); tone(70, 0.06, { gain: 0.16, release: 0.2 }); } },                                    // furs: a drag, a dull thump
  { slide: { freq: 5200, type: "highpass", q: 2, gain: 0.05 }, land: () => { tone(2350, 0.01, { gain: 0.07, release: 0.12 }); tone(3300, 0.01, { gain: 0.04, release: 0.1, at: 0.012 }); noise(0.03, { gain: 0.09, freq: 4000, type: "highpass" }); } },  // amber: glass ticking
];

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; if (!on) this.bed(false); },
  /** The first touch: the page may make sound from here. */
  prime() { primed = true; },
  get primed() { return primed; },
  played: 0,                                                        // sounds made (for tests)
  /** A crate sliding for `dur` seconds. */
  slide(good, dur = 0.4, power = 1) {
    if (!audio() || !often("slide" + good, 60)) return;
    const v = VOICE[good]?.slide;
    if (!v) return;
    this.played++;
    noise(Math.max(0.12, dur), { ...v, gain: v.gain * Math.min(1.4, 0.5 + power * 0.5) });
  },
  /** A crate stopping against the edge or another. */
  thud(good, delay = 0) {
    if (!audio() || !often("thud" + good, 45)) return;
    this.played++;
    if (delay) setTimeout(() => VOICE[good]?.land(), delay); else VOICE[good]?.land();
  },
  /** A crate dropped on the quay. */
  drop(good) { this.thud(good); noise(0.1, { gain: 0.05, freq: 900, at: 0.02 }); },
  /** A ship's bell, struck up to three times. */
  bell(n = 1) {
    if (!audio()) return;
    this.played++;
    for (let k = 0; k < Math.min(3, n); k++) for (const [f, g] of [[784, 0.1], [1568, 0.05], [2093, 0.025], [1190, 0.03]]) tone(f, 0.01, { gain: g, release: 1.1, at: k * 0.32 });
  },
  /** A crane's chain paying out: iron links clinking, a timber creak under. */
  chain(dur = 0.8) {
    if (!audio()) return;
    this.played++;
    for (let k = 0; k < dur * 14; k++) noise(0.025, { gain: 0.06 + Math.random() * 0.04, freq: 2600 + Math.random() * 2400, type: "bandpass", q: 4, at: k / 14 + Math.random() * 0.02 });
    this.creak(dur);
  },
  creak(dur = 0.6) { if (audio()) tone(95 + Math.random() * 30, dur, { type: "sawtooth", gain: 0.012, attack: 0.15, release: 0.3, glide: 120 + Math.random() * 40 }); },
  /** A squall's patter on the water and a rogue wave's wash. */
  rain(dur = 1.2) { if (audio()) noise(dur, { gain: 0.1, freq: 6000, type: "highpass" }); },
  wash(dur = 1) { if (audio()) noise(dur, { gain: 0.3, freq: 300, sweep: 1400 }); },
  gull() {
    if (!audio()) return;
    const f = 1500 + Math.random() * 500;
    for (let k = 0; k < 3; k++) tone(f, 0.12, { type: "triangle", gain: 0.014, attack: 0.02, release: 0.1, glide: f * 0.62, at: k * 0.22 });
  },
  /** The harbour bed: wind and lapping water under everything, a gull now and then; `strength` 0..1 is the weather. */
  bed(play, strength = 0.3) {
    if (!play) {
      clearTimeout(gullTimer);
      if (bed && ctx) { const b = bed; bed = null; try { b.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25); setTimeout(() => { b.src.stop(); b.lfo.stop(); b.lap.stop(); }, 1200); } catch { /* already stopped */ } }
      return;
    }
    const c = audio();
    if (!c) return;
    if (bed) { bed.f.frequency.setTargetAtTime(280 + strength * 700, c.currentTime, 0.5); bed.g.gain.setTargetAtTime(0.03 + strength * 0.05, c.currentTime, 0.5); return; }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    src.buffer = noiseBuf(c, 4, false); src.loop = true;
    f.type = "bandpass"; f.frequency.value = 280 + strength * 700; f.Q.value = 0.8;
    g.gain.value = 0.0001; g.gain.setTargetAtTime(0.03 + strength * 0.05, c.currentTime, 0.8);
    lfo.frequency.value = 0.11; depth.gain.value = 0.014;
    lfo.connect(depth).connect(g.gain);
    const lap = c.createOscillator(), lg = c.createGain();            // the slow swell of water against stone
    lap.frequency.value = 0.27; lg.gain.value = 0.012;
    lap.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(master);
    src.start(); lfo.start(); lap.start();
    bed = { src, g, f, lfo, lap };
    const gulls = () => { gullTimer = setTimeout(() => { if (bed) { sound.gull(); if (Math.random() < 0.3) sound.creak(); gulls(); } }, 9000 + Math.random() * 14000); };
    gulls();
  },
};
