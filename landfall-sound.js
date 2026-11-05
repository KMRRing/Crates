// Landfall's sounds, made as they play (Web Audio: filtered noise and sine partials, no files, so they are there offline).
//   the bed       water along the hull, wind in the rigging and, now and then, a timber's creak: quiet, always under everything
//   the bell      the ship's bell, struck in pairs by the watch system, every half hour of the ship's time
//   the sight     the bed all but stops while the sextant is up ("no music while the player is measuring")
//   small things  a mark's click, the chime of a good fix, the hollow knock of a bad ending
// Nothing is made until a tap has unlocked audio, nothing plays while the menu is open or the page is hidden (pause), and with
// the sound off no audio context is ever made. Two gains sit in front of the speakers: `master`, and `bedGain` for the bed alone.
let ctx = null, master = null, bedGain = null, bedNodes = null, noiseBuf = null;
let muted = true, paused = false, bedOn = false, hushed = false, creakTimer = 0, dayOn = false, gullTimer = 0, windLevel = 0.3, lastRollSound = 0;
const BED_LEVEL = 0.9;

function audio() {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -18; squash.ratio.value = 4; squash.attack.value = 0.004; squash.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(squash).connect(ctx.destination);
  }
  if (!paused && ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
  return ctx;
}
/** Two seconds of noise, made once and looped. */
function noise(c) {
  if (!noiseBuf) {
    const n = c.sampleRate * 2;
    noiseBuf = c.createBuffer(1, n, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.5 + last * 6) * 0.6; }   // brownish: more low than high
  }
  return noiseBuf;
}
function loop(c, { type, freq, q, gain }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c); src.loop = true; src.loopStart = 0; src.loopEnd = 2;
  f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  src.connect(f).connect(g);
  src.start(0, Math.random() * 1.5);
  return { src, g };
}
/** A slow wobble in a gain: an oscillator of `rate` Hz scaled by `depth` added to the gain. */
function wobble(c, param, rate, depth) {
  const o = c.createOscillator(), d = c.createGain();
  o.frequency.value = rate; d.gain.value = depth;
  o.connect(d).connect(param); o.start(0);
  return o;
}

function startBed() {
  const c = audio();
  if (!c || bedNodes) return;
  bedGain = c.createGain(); bedGain.gain.value = 0.0001; bedGain.connect(master);
  const water = loop(c, { type: "lowpass", freq: 380, q: 0.6, gain: 0.5 }), slosh = loop(c, { type: "bandpass", freq: 170, q: 1.2, gain: 0.3 });
  const wind = loop(c, { type: "bandpass", freq: 620, q: 0.8, gain: 0.07 }), hull = loop(c, { type: "bandpass", freq: 1900, q: 3, gain: 0.012 });
  const osc = [wobble(c, water.g.gain, 0.12, 0.18), wobble(c, slosh.g.gain, 0.19, 0.2), wobble(c, wind.g.gain, 0.06, 0.05), wobble(c, wind.g.gain, 0.21, 0.025), wobble(c, hull.g.gain, 0.33, 0.01)];
  for (const n of [water, slosh, wind, hull]) n.g.connect(bedGain);
  bedNodes = { srcs: [water.src, slosh.src, wind.src, hull.src], osc, wind, water, hull };
  setWeather();
  bedGain.gain.setTargetAtTime(hushed ? 0.05 : BED_LEVEL, c.currentTime, 1.4);
  scheduleCreak();
}
/** The wind in the rigging and the water along the hull follow the weather: a breath, a fresh wind, a gale (0 to 1). */
function setWeather() {
  if (!ctx || !bedNodes) return;
  const t = ctx.currentTime, w = windLevel;
  bedNodes.wind.g.gain.setTargetAtTime(0.03 + 0.2 * w * w + 0.04 * w, t, 1.5);
  bedNodes.wind.src.playbackRate.setTargetAtTime(0.9 + 0.5 * w, t, 1.5);
  bedNodes.water.g.gain.setTargetAtTime(0.4 + 0.45 * w, t, 1.5);
  bedNodes.hull.g.gain.setTargetAtTime(0.012 + 0.03 * w, t, 1.5);
}
function stopBed() {
  clearTimeout(creakTimer);
  if (!bedNodes || !ctx) { bedNodes = null; return; }
  const n = bedNodes, g = bedGain;
  bedNodes = null;
  g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  setTimeout(() => { for (const s of [...n.srcs, ...n.osc]) { try { s.stop(); } catch { /* already stopped */ } } try { g.disconnect(); } catch { /* gone */ } }, 2500);
}
/** A timber's creak: a low saw sliding between two notes through a narrow filter, rarely, and quietly. */
function creak() {
  const c = audio();
  if (!c || !bedNodes || paused) return;
  const t = c.currentTime, dur = 0.5 + Math.random() * 0.7, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), ld = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(70 + Math.random() * 50, t); o.frequency.linearRampToValueAtTime(60 + Math.random() * 70, t + dur);
  lfo.frequency.value = 9 + Math.random() * 8; ld.gain.value = 6; lfo.connect(ld).connect(o.frequency);
  f.type = "bandpass"; f.frequency.value = 260 + Math.random() * 220; f.Q.value = 9;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(bedGain);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
function scheduleCreak() {
  clearTimeout(creakTimer);
  creakTimer = setTimeout(() => { creak(); if (bedNodes) scheduleCreak(); }, (6500 + Math.random() * 9000) * (1.15 - 0.7 * windLevel));
}

/** A gull, now and then, by day: a few falling cries, high and thin, never while the sextant is up. */
function scheduleGull() {
  clearTimeout(gullTimer);
  if (!dayOn || muted || paused) return;
  gullTimer = setTimeout(() => {
    const c = audio();
    if (c && dayOn && !paused && !hushed && bedNodes) {
      const t = c.currentTime + 0.02, n = 2 + Math.floor(Math.random() * 3), f = 1350 + Math.random() * 450;
      for (let i = 0; i < n; i++) ping(c, t + i * 0.34, { freq: f * (1 - i * 0.05), gain: 0.028, dur: 0.3, attack: 0.04, type: "triangle", drop: 0.6 });
    }
    scheduleGull();
  }, 9000 + Math.random() * 14000);
}

// ---------- single sounds ----------

function ping(c, t, { freq, gain, dur, attack = 0.002, type = "sine", drop = 1, to = master }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(to); o.start(t); o.stop(t + dur + 0.03);
}
function burst(c, t, { freq, q, gain, dur, type = "bandpass" }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c); f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.02);
}
/** One stroke of the ship's bell: a small bronze bell, inharmonic partials with the high ones dying first. */
function stroke(c, t, level = 1) {
  const base = 655;
  [[1, 0.5, 3.2], [2.02, 0.32, 2.3], [2.78, 0.22, 1.7], [4.15, 0.12, 1.0], [5.4, 0.07, 0.6], [0.5, 0.18, 3.8]].forEach(([r, a, d]) => ping(c, t, { freq: base * r, gain: a * level * 0.55, dur: d, attack: 0.0015 }));
  burst(c, t, { freq: 3200, q: 1.5, gain: 0.07 * level, dur: 0.02 });
}

export const sound = {
  get muted() { return muted; },
  /** The weather's strength, 0 to 1 (landfall-look.js `windOf`): louder wind, a busier hull. */
  weather(w) { windLevel = Math.max(0, Math.min(1, w)); setWeather(); },
  /** The ship has rolled to an extreme of `deg` degrees: a timber answers now and then, a wave slaps the hull. At most one every few seconds. */
  roll(deg) {
    const c = audio();
    if (!c || !bedNodes || paused || hushed) return;
    const now = c.currentTime;
    if (now - lastRollSound < 2.4 || Math.random() > Math.min(0.55, 0.12 + deg * 0.18)) return;
    lastRollSound = now;
    if (Math.random() < 0.5) creak();
    else burst(c, now, { freq: 240 + Math.random() * 180, q: 0.9, gain: 0.05 + 0.025 * windLevel, dur: 0.5 + Math.random() * 0.5, type: "lowpass" });
    if (windLevel > 0.55 && Math.random() < 0.6) burst(c, now + 0.05, { freq: 3400, q: 0.7, gain: 0.025, dur: 0.35, type: "highpass" });
  },
  /** Call from a tap: makes (or wakes) the audio context and starts the bed if it was asked for. */
  unlock() { if (muted) return; const c = audio(); if (c && bedOn && !bedNodes && !paused) startBed(); },
  setMuted(m) {
    muted = !!m;
    if (muted) { stopBed(); if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); }
    else if (bedOn && !paused) { audio(); startBed(); }
  },
  /** The page stands still (menu, tab hidden): nothing plays; carrying on wakes it. */
  pause() { paused = true; clearTimeout(creakTimer); clearTimeout(gullTimer); if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); },
  resume() { paused = false; if (!muted && ctx) { ctx.resume().catch(() => {}); if (bedNodes) scheduleCreak(); else if (bedOn) startBed(); scheduleGull(); } },
  /** Gulls cry now and then while it is day (a noon watch); off by night. */
  day(on) { dayOn = !!on; if (on) scheduleGull(); else clearTimeout(gullTimer); },
  bed(on) { bedOn = !!on; if (on) { if (!paused) startBed(); } else stopBed(); },
  /** The bed all but stops for the sight (and comes back after). */
  hush(on) { hushed = !!on; if (ctx && bedGain && bedNodes) bedGain.gain.setTargetAtTime(on ? 0.05 : BED_LEVEL, ctx.currentTime, on ? 0.35 : 1.2); },
  /** The ship's bell: `count` strokes in pairs, as a ship strikes them. */
  bell(count) {
    const c = audio();
    if (!c || paused) return 0;
    const t0 = c.currentTime + 0.05;
    let t = t0;
    for (let i = 0; i < count; i++) { stroke(c, t, 1); t += i % 2 === 0 && i + 1 < count ? 0.55 : 1.15; }
    return t - t0;
  },
  mark() { const c = audio(); if (!c || paused) return; const t = c.currentTime; burst(c, t, { freq: 1700, q: 5, gain: 0.35, dur: 0.03 }); ping(c, t, { freq: 420, gain: 0.2, dur: 0.06, drop: 0.8 }); },
  tick() { const c = audio(); if (!c || paused) return; burst(c, c.currentTime, { freq: 2600, q: 8, gain: 0.05, dur: 0.012 }); },
  /** A fix plotted: two soft notes, rising. */
  good() { const c = audio(); if (!c || paused) return; const t = c.currentTime + 0.02; ping(c, t, { freq: 659, gain: 0.2, dur: 1.4 }); ping(c, t + 0.16, { freq: 988, gain: 0.17, dur: 1.9 }); ping(c, t + 0.16, { freq: 494, gain: 0.08, dur: 1.9 }); },
  /** A sight the plot refused: one low, flat note. */
  off() { const c = audio(); if (!c || paused) return; ping(c, c.currentTime + 0.02, { freq: 196, gain: 0.2, dur: 0.9, drop: 0.92, type: "triangle" }); },
  /** Aground, or the landfall missed: a hollow knock and a sinking tone. */
  hollow() { const c = audio(); if (!c || paused) return; const t = c.currentTime + 0.02; ping(c, t, { freq: 110, gain: 0.5, dur: 1.1, drop: 0.6 }); burst(c, t, { freq: 160, q: 1, gain: 0.5, dur: 0.18, type: "lowpass" }); ping(c, t + 0.4, { freq: 82, gain: 0.3, dur: 1.4, drop: 0.7 }); },
};
