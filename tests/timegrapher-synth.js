// A watch on a microphone, made up for Timegrapher's tests: the beats of a lever escapement at a chosen rate, beat
// error and amplitude, each beat three noises (unlocking, impulse, drop: the lift's first and last are what an
// amplitude is timed from), tick and tock differing in loudness and spacing; the room round it (pink noise, the mic's
// hiss, mains hum and its harmonics, a few knocks on the table, someone talking) and a level that drifts as the watch
// shifts on the mic. Also a quartz watch's one step a second, a buzz with no watch in it, and the WAV a browser takes
// as a fake microphone. Deterministic from a seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = r => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };

/** The time from a beat's first noise to its last (s): the balance crossing its lift angle at this amplitude. */
export const liftTime = (amp, lift, period) => (period / Math.PI) * Math.asin(lift / (2 * amp));

/** A click: the case's resonances rung by one impact, added into x at t (s). */
function ring(x, fs, t, gain, modes, r) {
  const i0 = Math.round(t * fs);
  for (const m of modes) {
    const f = m.f * (1 + (r() - 0.5) * 0.02), ph = r() * 2 * Math.PI, len = Math.ceil(m.tau * fs * 7), w = 2 * Math.PI * f / fs;
    const g = gain * m.g * (0.85 + 0.3 * r());
    for (let i = 0; i < len; i++) {
      const k = i0 + i;
      if (k < 0 || k >= x.length) continue;
      x[k] += g * Math.exp(-i / (m.tau * fs)) * Math.sin(w * i + ph);
    }
  }
  for (let i = 0; i < 6; i++) { const k = i0 + i; if (k >= 0 && k < x.length) x[k] += gain * 0.3 * (r() * 2 - 1); }   // the impact itself
}
const resonances = (r, n, lo, hi) => Array.from({ length: n }, () => ({ f: lo + r() * (hi - lo), tau: (0.06 + r() * 0.35) / 1000, g: 0.35 + r() * 0.65 }));

/** Pink noise (Voss–McCartney, 12 rows) scaled to an RMS. */
function pink(x, rms, r) {
  if (!rms) return;
  const rows = new Float64Array(12);
  let sum = 0, acc = 0;
  const tmp = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const z = i + 1, k = Math.min(11, 31 - Math.clz32(z & -z));
    sum -= rows[k]; rows[k] = r() * 2 - 1; sum += rows[k];
    tmp[i] = sum + (r() * 2 - 1);
    acc += tmp[i] * tmp[i];
  }
  const s = rms / Math.sqrt(acc / x.length || 1);
  for (let i = 0; i < x.length; i++) x[i] += tmp[i] * s;
}

/**
 * A mechanical watch. Options (all optional): fs, secs, vph, rate (s/d, + fast), be (ms: half the difference between
 * the alternating intervals, as Witschi defines it), amp (degrees), lift (degrees), level (the drop's peak), tock (its
 * loudness against the tick), unlock and impulse (their loudness against the drop), spread (tick and tock lifts apart,
 * as a fraction), jitter (s a beat), wander (s/d, a slow swing of the rate), drift (the level's slow swing, as a
 * fraction), band ([lo, hi] Hz of the case's resonances), noise (pink RMS), hiss (white RMS), hum (50 Hz amplitude),
 * mains (50 or 60), knocks (how many), voices (how many), seed. Returns { x, beats: [first-noise times, s] }.
 */
export function synthWatch(o = {}) {
  const fs = o.fs ?? 48000, secs = o.secs ?? 30, vph = o.vph ?? 21600, rate = o.rate ?? 0, be = (o.be ?? 0) / 1000;
  const amp = o.amp ?? 280, lift = o.lift ?? 52, level = o.level ?? 0.05, tock = o.tock ?? 0.7;
  const unlock = o.unlock ?? 0.45, impulse = o.impulse ?? 0.3, spread = o.spread ?? 0.02, jitter = o.jitter ?? 8e-6;
  const wander = o.wander ?? 0, drift = o.drift ?? 0.25, [lo, hi] = o.band ?? [2800, 11000];
  const r = mulberry32(o.seed ?? 1), x = new Float32Array(Math.round(secs * fs));
  const modes = [resonances(r, 5, lo, hi), resonances(r, 5, lo, hi)];     // each pallet's noises ring the case a little differently
  const Pn = 3600 / vph;
  const beats = [];
  const gainAt = t => level * (1 + drift * Math.sin(2 * Math.PI * t / 7.3 + 1.1));
  let t = o.start ?? 0.03 + r() * Pn, k = 0;
  while (t < secs - 0.05) {
    const odd = k % 2 === 1, P = Pn / (1 + (rate + wander * Math.sin(2 * Math.PI * t / 19)) / 86400);
    const t1 = t + (odd ? be : 0) + jitter * gauss(r);
    const L = lift * (1 + (odd ? -spread : spread)), dt = liftTime(amp, L, 2 * P), g = gainAt(t1) * (odd ? tock : 1);
    const m = modes[odd ? 1 : 0];
    ring(x, fs, t1, g * unlock, m, r);
    ring(x, fs, t1 + dt * (odd ? 0.42 : 0.5), g * impulse, m, r);
    ring(x, fs, t1 + dt, g, m, r);
    beats.push(t1);
    t += P;
    k++;
  }
  room(x, fs, o, r, level);
  return { x, beats };
}

/** A quartz watch: its stepping motor's click once a second. */
export function synthQuartz(o = {}) {
  const fs = o.fs ?? 48000, secs = o.secs ?? 20, r = mulberry32(o.seed ?? 3), x = new Float32Array(Math.round(secs * fs));
  const modes = resonances(r, 4, 2500, 9000);
  for (let t = 0.2; t < secs - 0.05; t += 1) { ring(x, fs, t, o.level ?? 0.05, modes, r); ring(x, fs, t + 0.004, (o.level ?? 0.05) * 0.4, modes, r); }
  room(x, fs, o, r, o.level ?? 0.05);
  return { x };
}

/** Noise with no watch in it: the room alone, or (buzz) hiss in the ticks' band modulated at twice the mains. */
export function synthRoom(o = {}) {
  const fs = o.fs ?? 48000, secs = o.secs ?? 20, r = mulberry32(o.seed ?? 5), x = new Float32Array(Math.round(secs * fs));
  if (o.buzz) {
    const f = o.mains ?? 50, b = [];
    let y1 = 0, y2 = 0;                                   // a resonator at 4 kHz shapes the hiss into the band
    const w = 2 * Math.PI * 4000 / fs, rr = 0.97;
    for (let i = 0; i < x.length; i++) {
      const y = (r() * 2 - 1) + 2 * rr * Math.cos(w) * y1 - rr * rr * y2;
      y2 = y1; y1 = y;
      b.push(y);
    }
    const s = Math.sqrt(b.reduce((a, v) => a + v * v, 0) / b.length);
    for (let i = 0; i < x.length; i++) x[i] += (o.buzz / s) * b[i] * Math.abs(Math.sin(2 * Math.PI * f * i / fs));
  }
  room(x, fs, o, r, o.level ?? 0.05);
  return { x };
}

/** The room: pink noise, hiss, hum, knocks and voices, added into x. */
function room(x, fs, o, r, level) {
  pink(x, o.noise ?? 0.002, r);
  const hiss = o.hiss ?? 0.0004;
  if (hiss) for (let i = 0; i < x.length; i++) x[i] += hiss * gauss(r);
  const hum = o.hum ?? 0.01, mains = o.mains ?? 50;
  if (hum) for (let i = 0; i < x.length; i++) {
    const w = 2 * Math.PI * mains * i / fs;
    x[i] += hum * (Math.sin(w) + 0.35 * Math.sin(2 * w + 0.4) + 0.2 * Math.sin(3 * w + 1.3) + 0.05 * Math.sin(7 * w));
  }
  const secs = x.length / fs;
  for (let k = 0; k < (o.knocks ?? 0); k++) {                 // a knock on the table: loud, broadband, ringing for a while
    const at = Math.round((0.5 + r() * (secs - 1)) * fs), len = Math.round(fs * 0.04), g = level * (6 + r() * 14);
    let lp = 0;
    for (let i = 0; i < len && at + i < x.length; i++) { lp = 0.6 * lp + 0.4 * (r() * 2 - 1); x[at + i] += g * Math.exp(-i / (fs * 0.006)) * (r() * 2 - 1 + 2 * lp); }
  }
  for (let k = 0; k < (o.voices ?? 0); k++) {                 // a voice: a sung vowel's harmonics, then a hiss of an "s"
    const at = (0.5 + r() * (secs - 2.5)), dur = 0.7 + r() * 0.8, f0 = 100 + r() * 120, g = level * (o.voice ?? 2.5);
    const i0 = Math.round(at * fs), n = Math.round(dur * fs);
    for (let i = 0; i < n && i0 + i < x.length; i++) {
      const tt = i / fs, env = Math.sin(Math.PI * i / n);
      let v = 0;
      for (let h = 1; f0 * h < 4500; h++) v += Math.sin(2 * Math.PI * f0 * h * tt * (1 + 0.01 * Math.sin(2 * Math.PI * 5 * tt))) / h ** 0.9 * (1 + 2 * Math.exp(-(((f0 * h - 700) / 300) ** 2)) + 1.2 * Math.exp(-(((f0 * h - 1200) / 400) ** 2)));
      x[i0 + i] += g * 0.25 * env * v;
    }
    const s0 = i0 + n, sn = Math.round(0.15 * fs);
    for (let i = 0; i < sn && s0 + i < x.length; i++) x[s0 + i] += g * 0.3 * Math.sin(Math.PI * i / sn) * (r() * 2 - 1);
  }
}

/** 16-bit PCM WAV bytes of mono samples. */
export function wav(x, fs) {
  const n = x.length, buf = new ArrayBuffer(44 + 2 * n), v = new DataView(buf);
  const str = (at, s) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + 2 * n, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, fs, true);
  v.setUint32(28, fs * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, 2 * n, true);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  const s = peak > 0.99 ? 0.99 / peak : 1;
  for (let i = 0; i < n; i++) v.setInt16(44 + 2 * i, Math.round(Math.max(-1, Math.min(1, x[i] * s)) * 32767), true);
  return new Uint8Array(buf);
}
