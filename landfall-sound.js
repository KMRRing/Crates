// Landfall's sounds, made as they play (Web Audio: filtered noise and sine partials, no files, so they are there offline).
//   the bed       water along the hull, wind in the rigging and, now and then, a timber's creak: quiet, always under everything;
//                 the rigging sings when the wind freshens, and the bow wave surges as she pitches into the swell
//   the bell      the ship's bell, struck in pairs by the watch system, every half hour of the ship's time
//   the sight     the bed all but stops while the sextant is up ("no music while the player is measuring")
//   small things  a mark's click, the chime of a good fix, the hollow knock of a bad ending
//   the lead      its splash alongside, the line running out over the rail, and the check as it finds the bottom
// Nothing is made until a tap has unlocked audio, nothing plays while the menu is open or the page is hidden (pause), and with
// the sound off no audio context is ever made. Two gains sit in front of the speakers: `master`, and `bedGain` for the bed alone.
let ctx = null, master = null, bedGain = null, bedNodes = null, noiseBuf = null, bus = null, lastSurge = 0;
let muted = true, paused = false, bedOn = false, hushed = false, creakTimer = 0, dayOn = false, gullTimer = 0, windLevel = 0.3, lastRollSound = 0;
const BED_LEVEL = 0.55;      // Korbi, 7 Nov 2026: "a bit too loud" (was 0.9, with master 0.85)

function audio() {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -18; squash.ratio.value = 4; squash.attack.value = 0.004; squash.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.6;
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
  // the rigging's song (13 November 2026): stays and shrouds whistle in a fresh wind, two thin tones that waver as the gusts come
  const sing = [loop(c, { type: "bandpass", freq: 430, q: 38, gain: 0 }), loop(c, { type: "bandpass", freq: 655, q: 44, gain: 0 })];
  const osc = [wobble(c, water.g.gain, 0.12, 0.18), wobble(c, slosh.g.gain, 0.19, 0.2), wobble(c, wind.g.gain, 0.06, 0.05), wobble(c, wind.g.gain, 0.21, 0.025), wobble(c, hull.g.gain, 0.33, 0.01)];
  for (const [i, n] of sing.entries()) osc.push(wobble(c, n.src.playbackRate, 0.07 + 0.05 * i, 0.04));
  for (const n of [water, slosh, wind, hull, ...sing]) n.g.connect(bedGain);
  bedNodes = { srcs: [water.src, slosh.src, wind.src, hull.src, ...sing.map(n => n.src)], osc, wind, water, hull, sing };
  setWeather();
  bedGain.gain.setTargetAtTime(hushed ? 0.05 : BED_LEVEL, c.currentTime, 1.4);
  scheduleCreak();
}
/** The wind in the rigging and the water along the hull follow the weather: a breath, a fresh wind, a gale (0 to 1). */
function setWeather() {
  if (!ctx || !bedNodes) return;
  const t = ctx.currentTime, w = windLevel;
  bedNodes.wind.g.gain.setTargetAtTime(0.03 + 0.2 * w * w + 0.04 * w, t, 1.5);
  bedNodes.wind.src.playbackRate.setTargetAtTime((0.9 + 0.5 * w) * region.wind, t, 1.5);
  bedNodes.hull.g.gain.setTargetAtTime(0.012 + 0.03 * w + (sky === "storm" ? 0.03 : 0), t, 1.5);   // rain's hiss rides the hull's high band
  bedNodes.water.g.gain.setTargetAtTime(0.4 + 0.45 * w, t, 1.5);
  const song = Math.max(0, w - 0.35) ** 2;
  for (const [i, n] of bedNodes.sing.entries()) n.g.gain.setTargetAtTime(song * (0.5 - 0.15 * i), t, 2.5);
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

// ---------- the place: what lives and sounds in this sea (Korbi, 7 Nov 2026: "more scenic", some of it telling the region) ----------
// Each region is the birds and beasts that are heard there, with how often (weights), and how the wind sounds. Chosen from the level's
// latitude: the Grey Sea is gulls, kittiwakes and a fulmar's growl; warmer water brings terns and dolphins; far south the petrels.
// By night the birds go quiet and the sea has its own: a bell buoy in haze, a whale far off.
export const REGIONS = {
  grey:     { name: "the Grey Sea",  wind: 0.9,  day: { herring: 5, kittiwake: 4, fulmar: 2 }, night: { buoy: 3, whale: 1 } },
  temperate: { name: "temperate water", wind: 1.0, day: { herring: 4, tern: 3, dolphin: 1 }, night: { buoy: 2, whale: 1, dolphin: 1 } },
  trade:    { name: "the trades",    wind: 1.12, day: { tern: 5, dolphin: 3, flying: 3 }, night: { dolphin: 2, flying: 2, whale: 1 } },
  southern: { name: "the Southern Ocean", wind: 0.8, day: { fulmar: 4, petrel: 4 }, night: { whale: 2, petrel: 1 } },
};
/** The region a latitude and longitude lie in. */
export function regionFor(lat) {
  const a = Math.abs(lat);
  return lat < -40 ? "southern" : a >= 48 ? "grey" : a >= 28 ? "temperate" : "trade";
}
let region = REGIONS.grey, sky = "clear";
const pick = table => {
  const all = Object.entries(table), total = all.reduce((t, [, w]) => t + w, 0);
  let x = Math.random() * total;
  for (const [k, w] of all) if ((x -= w) <= 0) return k;
  return all[0][0];
};
/** One thing of the sea's life, quietly and from far off; never while the sextant is up. */
export const CALLS = {
  herring(c, t) { const n = 2 + Math.floor(Math.random() * 3), f = 1350 + Math.random() * 450; for (let i = 0; i < n; i++) ping(c, t + i * 0.34, { freq: f * (1 - i * 0.05), gain: 0.02, dur: 0.3, attack: 0.04, type: "triangle", drop: 0.6 }); },
  kittiwake(c, t) { const f = 1700 + Math.random() * 200; for (let i = 0; i < 3; i++) { ping(c, t + i * 0.52, { freq: f, gain: 0.016, dur: 0.16, attack: 0.02, type: "triangle", drop: 0.8 }); ping(c, t + i * 0.52 + 0.2, { freq: f * 0.82, gain: 0.014, dur: 0.22, attack: 0.02, type: "triangle", drop: 0.85 }); } },
  tern(c, t) { const n = 5 + Math.floor(Math.random() * 4), f = 2900 + Math.random() * 500; for (let i = 0; i < n; i++) ping(c, t + i * 0.085, { freq: f * (1 + i * 0.012), gain: 0.012, dur: 0.07, attack: 0.008, type: "triangle", drop: 0.9 }); },
  fulmar(c, t) { burst(c, t, { freq: 900, q: 2.2, gain: 0.05, dur: 0.35 }); burst(c, t + 0.3, { freq: 760, q: 2.2, gain: 0.04, dur: 0.4 }); },
  petrel(c, t) { for (let i = 0; i < 3; i++) ping(c, t + i * 0.26, { freq: 1050 - i * 60, gain: 0.015, dur: 0.22, attack: 0.03, type: "sawtooth", drop: 0.75 }); },
  /** A gannet: a harsh, grating "arrah", two or three of them, from a flight going home. */
  gannet(c, t) { for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { burst(c, t + i * 0.42, { freq: 640 + Math.random() * 120, q: 3, gain: 0.05, dur: 0.28 }); ping(c, t + i * 0.42, { freq: 300, gain: 0.018, dur: 0.26, attack: 0.03, type: "sawtooth", drop: 0.85 }); } },
  /** A puffin: a low purr from the skerries, rising and falling. */
  puffin(c, t) { const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), ld = c.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(190, t + 0.5); o.frequency.linearRampToValueAtTime(120, t + 1.1); lfo.frequency.value = 28; ld.gain.value = 0.012; lfo.connect(ld).connect(g.gain); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.014, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + 1.15); o.connect(g).connect(out()); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2); },
  /** Two whistles that climb and fall, a dolphin's, a little apart. */
  dolphin(c, t) {
    for (let k = 0; k < 2; k++) {
      const o = c.createOscillator(), g = c.createGain(), t0 = t + k * 0.55;
      o.type = "sine"; o.frequency.setValueAtTime(1700, t0); o.frequency.exponentialRampToValueAtTime(3300, t0 + 0.22); o.frequency.exponentialRampToValueAtTime(2300, t0 + 0.42);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.014, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      o.connect(g).connect(out()); o.start(t0); o.stop(t0 + 0.5);
    }
  },
  /** A flying fish's flick on the water: a short run of splashes. */
  flying(c, t) { for (let i = 0; i < 4; i++) burst(c, t + i * 0.11, { freq: 2400 + Math.random() * 1200, q: 1.2, gain: 0.03, dur: 0.07, type: "highpass" }); },
  /** A bell buoy answering the swell: one dull, flat note with a long tail, a long way off. */
  buoy(c, t) { [[1, 0.5, 2.8], [2.4, 0.2, 1.6], [0.5, 0.25, 3.4]].forEach(([r, a, d]) => ping(c, t, { freq: 330 * r, gain: 0.028 * a, dur: d, attack: 0.004 })); },
  /** A whale a very long way off: a low glide that wavers, slow. */
  whale(c, t) {
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), ld = c.createGain(), dur = 4 + Math.random() * 2, f = 90 + Math.random() * 40;
    o.type = "sine"; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.9, t + dur * 0.45); o.frequency.linearRampToValueAtTime(f * 1.2, t + dur);
    lfo.frequency.value = 5; ld.gain.value = 4; lfo.connect(ld).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out()); o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  },
  /** Thunder, in a gale: a low noise that rolls and fades. */
  thunder(c, t) { burst(c, t, { freq: 110, q: 0.5, gain: 0.16, dur: 2.6, type: "lowpass" }); burst(c, t + 0.5, { freq: 70, q: 0.5, gain: 0.1, dur: 2.2, type: "lowpass" }); },
};
function scheduleLife() {
  clearTimeout(gullTimer);
  if (muted || paused || !bedOn) return;
  gullTimer = setTimeout(() => {
    const c = audio();
    if (c && !paused && !hushed && bedNodes) {
      const t = c.currentTime + 0.02;
      bus = side(c, Math.random() * 1.6 - 0.8);                          // each call from somewhere off to one side or the other
      if (sky === "storm" && Math.random() < 0.4) CALLS.thunder(c, t);
      else {
        let table = dayOn ? region.day : region.night;
        if (sky === "haze" || sky === "cloud" || sky === "thick") table = { ...table, buoy: (table.buoy || 0) + 4 };    // the bell buoy is heard in thick weather
        if (sky === "storm") table = { buoy: 2, fulmar: dayOn ? 1 : 0 };                              // birds shelter in a gale
        CALLS[pick(table)]?.(c, t);
      }
      bus = null;
    }
    scheduleLife();
  }, (sky === "storm" ? 6000 : 9000) + Math.random() * 14000);
}

// ---------- single sounds ----------

/** Where a single sound goes: the life call's place while one is being made, else straight to the speakers. */
const out = () => bus || master;
/** A place to one side (-1 left, 1 right), where the browser can pan; the speakers otherwise. */
function side(c, x) {
  if (!c.createStereoPanner) return master;
  const p = c.createStereoPanner(); p.pan.value = x; p.connect(master);
  return p;
}

function ping(c, t, { freq, gain, dur, attack = 0.002, type = "sine", drop = 1, to = out() }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(to); o.start(t); o.stop(t + dur + 0.03);
}
function burst(c, t, { freq, q, gain, dur, type = "bandpass" }) {
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noise(c); f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out()); src.start(t, Math.random()); src.stop(t + dur + 0.02);
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
  /** The bow has dipped into a swell (`k` 0 to 1, how deep): the bow wave's surge, a long rush of water that swells and draws back. */
  surge(k) {
    const c = audio();
    if (!c || !bedNodes || paused || hushed) return;
    const t = c.currentTime;
    if (t - lastSurge < 3) return;
    lastSurge = t;
    const lv = (0.03 + 0.05 * windLevel) * Math.min(1, 0.4 + k), dur = 1.6 + windLevel;
    for (const [freq, q, a, type] of [[520, 0.7, 1, "lowpass"], [2600, 0.6, 0.35, "highpass"]]) {
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = noise(c); f.type = type; f.frequency.setValueAtTime(freq * 0.6, t); f.frequency.linearRampToValueAtTime(freq, t + dur * 0.35); f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lv * a, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(bedGain); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    }
  },
  /** Call from a tap: makes (or wakes) the audio context and starts the bed if it was asked for. */
  unlock() { if (muted) return; const c = audio(); if (c && bedOn && !bedNodes && !paused) startBed(); },
  setMuted(m) {
    muted = !!m;
    if (muted) { stopBed(); if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); }
    else if (bedOn && !paused) { audio(); startBed(); scheduleLife(); }
  },
  /** The page stands still (menu, tab hidden): nothing plays; carrying on wakes it. */
  pause() { paused = true; clearTimeout(creakTimer); clearTimeout(gullTimer); if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); },
  resume() { paused = false; if (!muted && ctx) { ctx.resume().catch(() => {}); if (bedNodes) scheduleCreak(); else if (bedOn) startBed(); scheduleLife(); } },
  /** Whether it is day (a noon watch): birds by day, the night's sounds after dark. */
  day(on) { dayOn = !!on; scheduleLife(); },
  /** The level's place (its latitude): which birds and beasts the sea has, and how the wind sounds. */
  place(lat) { region = REGIONS[regionFor(lat)]; setWeather(); },
  /** The weather of the watch ("clear", "cloud", "thick", "haze", "swell", "storm"): a bell buoy in thick weather, thunder in a gale, rain's hiss. */
  conditions(w) { sky = w || "clear"; setWeather(); },
  bed(on) { bedOn = !!on; if (on) { if (!paused) startBed(); scheduleLife(); } else { stopBed(); clearTimeout(gullTimer); } },
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
  /** The deep-sea lead cast: the splash alongside, the line running out (the marks ticking over the rail, slowing as the lead sinks,
   *  longer the deeper), and the check as it touches the bottom; no check when it runs out without finding one (`depth` null). */
  lead(depth) {
    const c = audio();
    if (!c || paused) return;
    const t = c.currentTime + 0.05, run = 0.8 + Math.min(1.8, (depth ?? 130) / 60), n = Math.round(10 + run * 14);
    burst(c, t, { freq: 900, q: 0.8, gain: 0.12, dur: 0.35 });
    burst(c, t + 0.02, { freq: 2600, q: 0.6, gain: 0.05, dur: 0.5, type: "highpass" });
    for (let i = 0; i < n; i++) { const u = i / n; burst(c, t + 0.25 + run * (u + 0.25 * u * u) / 1.25, { freq: 2800 + 900 * Math.random(), q: 6, gain: 0.03 * (1 - 0.5 * u), dur: 0.015 }); }
    if (depth != null) ping(c, t + 0.3 + run, { freq: 140, gain: 0.08, dur: 0.25, drop: 0.7, type: "triangle" });
  },
  /** A bird of the sea's life called for (a flight passing): its call from off to one side. */
  call(kind) {
    const c = audio();
    if (!c || paused || hushed || !CALLS[kind]) return;
    bus = side(c, Math.random() * 1.4 - 0.7); CALLS[kind](c, c.currentTime + 0.05); bus = null;
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
