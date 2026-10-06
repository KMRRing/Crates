// Harbour's sounds, made as they play (Web Audio: oscillators and filtered noise, no files, so they're there offline):
// a horn as a ship leaves a berth, a pump's blip on a load, a chime on a delivery, a dull thud for a refusal or a crash,
// a little flourish when the plan is done, and the sea's hush under a run. Quiet by design, and rate-limited, so 16×
// stays a texture rather than a racket. Off, and nothing is made at all.
let ctx = null, master = null, sea = null, on = true;
const last = {};                                   // when each sound last played, for the rate limit

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
  if (ctx.state === "suspended") ctx.resume();     // browsers start audio only from a tap: Run is one
  return ctx;
}
const often = (name, ms) => { const t = performance.now(); if (t - (last[name] || 0) < ms) return false; last[name] = t; return true; };

function tone(freq, dur, { type = "sine", gain = 0.2, attack = 0.01, release = 0.3, at = 0, glide = null } = {}) {
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
function noiseBuffer(c, seconds, fade) {
  const n = Math.floor(c.sampleRate * seconds), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (fade ? 1 - i / n : 1);
  return buf;
}
function noise(dur, { gain = 0.2, freq = 400 } = {}) {
  const c = audio();
  if (!c) return;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuffer(c, dur, true);
  f.type = "lowpass"; f.frequency.value = freq;
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sound = {
  get on() { return on; },
  set on(v) { on = !!v; if (!on) this.sea(false); },
  played: 0,                                       // how many sounds were made (for the tests)
  /** A ship leaves a berth: two low reeds, a fifth apart. */
  horn() { if (!often("horn", 260)) return; this.played++; tone(110, 0.32, { type: "sawtooth", gain: 0.05, attack: 0.05, release: 0.22 }); tone(164.8, 0.32, { type: "sawtooth", gain: 0.035, attack: 0.05, release: 0.22 }); },
  /** A parcel lifted: the pump's short hum. */
  pump() { if (!often("pump", 90)) return; this.played++; tone(72, 0.1, { type: "triangle", gain: 0.12, release: 0.08 }); },
  /** A parcel delivered: a small bell. */
  chime() { if (!often("chime", 110)) return; this.played++; tone(880, 0.04, { gain: 0.07, release: 0.6 }); tone(1318.5, 0.04, { gain: 0.045, release: 0.7, at: 0.06 }); },
  /** A refusal or a crash: something soft, struck. */
  thud() { if (!often("thud", 150)) return; this.played++; noise(0.22, { gain: 0.45, freq: 170 }); tone(55, 0.08, { gain: 0.18, release: 0.25 }); },
  /** The plan delivered everything: four rising notes. */
  done() { this.played++; [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, 0.05, { gain: 0.05, release: 0.45, at: i * 0.09 })); },
  /** The sea's hush under a run: noise through a low filter, swelling slowly. */
  sea(play) {
    if (!play) { if (sea) { const s = sea; sea = null; try { s.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); setTimeout(() => s.src.stop(), 1500); } catch { /* already stopped */ } } return; }
    const c = audio();
    if (!c || sea) return;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    src.buffer = noiseBuffer(c, 3, false); src.loop = true;
    f.type = "lowpass"; f.frequency.value = 520;
    g.gain.value = 0.0001; g.gain.setTargetAtTime(0.035, c.currentTime, 0.6);
    lfo.frequency.value = 0.16; depth.gain.value = 0.015;               // a swell every six seconds or so
    lfo.connect(depth).connect(g.gain);
    src.connect(f).connect(g).connect(master);
    src.start(); lfo.start();
    sea = { src, g };
  },
};
