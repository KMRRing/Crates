// Timegrapher's signal chain, from the microphone's samples to the envelope the measuring works on. Pure: no page,
// so the live microphone (fed in chunks as they arrive) and a whole recording (fed at once) go through the same code,
// and tests/timegrapher.mjs runs it in Node.
//
// 1. A band-pass: a 4th-order Butterworth high-pass at 3 kHz (two biquads) and a 2nd-order low-pass at 12 kHz. A tick
//    is an impact that rings the case's resonances, a few kHz up; the room (hum and its harmonics, traffic, a fan, most
//    of a voice) sits lower, falling away with frequency, and above 12 kHz there is little but the microphone's hiss.
//    The quote's 2–8 kHz was the start; on synthetic watches in pink noise, hiss and voices, 3 kHz gained about 2 dB of
//    beat over room against 2 kHz, and 12 kHz about 1 dB against 8 (tests/timegrapher.mjs keeps the comparison).
// 2. The envelope: the band's magnitude smoothed by a 2nd-order low-pass at 1.5 kHz, quick enough (about 0.1 ms) to
//    keep a beat's three noises apart, which are 1.5 to 10 ms apart.
// 3. Every fourth sample of it kept: 12 kHz from a 48 kHz microphone (11.025 from 44.1), an 83 µs step that the
//    matched filter interpolates well below.

export const BAND = { hp: 3000, lp: 12000, env: 1500 };
export const DECIMATE = 4;

/** A biquad's coefficients (RBJ's cookbook): "lp" or "hp" at f Hz with quality q, for a sample rate fs. */
export function biquad(type, f, fs, q = Math.SQRT1_2) {
  const w = 2 * Math.PI * f / fs, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b = type === "hp" ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [(1 - c) / 2, 1 - c, (1 - c) / 2];
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: -2 * c / a0, a2: (1 - al) / a0 };
}
/** A biquad with its state, run in place over a block (direct form II transposed). */
function stage(k) {
  let z1 = 0, z2 = 0;
  return x => {
    for (let i = 0; i < x.length; i++) {
      const v = x[i], y = k.b0 * v + z1;
      z1 = k.b1 * v - k.a1 * y + z2;
      z2 = k.b2 * v - k.a2 * y;
      x[i] = y;
    }
  };
}

/**
 * The chain for one stream at sample rate fs: chain.push(samples) returns the new envelope samples (fe = fs / 4 a
 * second); chain.level() is the band's RMS over what it has been given since the last call (the signal meter's raw
 * reading before a beat is found). Its state carries from one chunk to the next, so chunks give what one block would.
 */
export function createChain(fs, band = BAND) {
  const stages = [biquad("hp", band.hp, fs, 0.5412), biquad("hp", band.hp, fs, 1.3066)];
  if (band.lp < 0.45 * fs) stages.push(biquad("lp", band.lp, fs));
  const pre = stages.map(stage), env = [stage(biquad("lp", band.env, fs)), stage(biquad("lp", band.env, fs))];
  let phase = 0, sq = 0, cnt = 0;
  return {
    fs, fe: fs / DECIMATE,
    push(input) {
      const x = Float32Array.from(input);
      for (const s of pre) s(x);
      for (let i = 0; i < x.length; i++) { sq += x[i] * x[i]; x[i] = Math.abs(x[i]); }
      cnt += x.length;
      for (const s of env) s(x);
      const out = new Float32Array(Math.max(0, Math.ceil((x.length - phase) / DECIMATE)));
      let j = 0;
      for (let i = phase; i < x.length; i += DECIMATE) out[j++] = x[i] > 0 ? x[i] : 0;
      phase = (phase - x.length) % DECIMATE;
      if (phase < 0) phase += DECIMATE;
      return j === out.length ? out : out.subarray(0, j);
    },
    level() { const v = cnt ? Math.sqrt(sq / cnt) : 0; sq = 0; cnt = 0; return v; },
  };
}

/** The envelope of a whole recording at once: { env, fe }. */
export function envelopeOf(samples, fs, band = BAND) {
  const c = createChain(fs, band);
  return { env: c.push(samples), fe: c.fe };
}

/** The band's RMS of a block: which of two channels hears the watch better. */
export function bandLevel(samples, fs, band = BAND) {
  const c = createChain(fs, band);
  c.push(samples);
  return c.level();
}
