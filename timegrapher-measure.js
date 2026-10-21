// Timegrapher's measuring, from the envelope (timegrapher-dsp.js) to the figures a timegrapher shows. Pure, so the
// live microphone, an uploaded recording and tests/timegrapher.mjs all go through it.
//
// 1. The beat rate. The envelope's autocorrelation at each standard rate's beat period and at twice it (a tick to the
//    next tick): a watch shows at both. A rate whose beat period is a multiple of the true one shows at both too, so
//    of rates in that relation the fastest that still shows wins (a 28,800 with a quiet tock looks like a 14,400 only
//    when its tock can't be heard at all, and the menu sets the vph then). A buzz in the band (a lamp, a charger)
//    repeats too, so the winner must also fold into a few sharp clicks, not a ripple.
// 2. Each beat timed by a matched filter: folded at the full oscillation (a tick and its tock), the envelope gives a
//    template of each, and every beat is found where it best correlates with its own template, the peak
//    interpolated between samples. Templates rebuilt from the aligned beats, and everything timed again.
// 3. A robust fit of beat times t_k = c + k·P + d·[k odd]: P the beat period, d how far the tock sits from halfway.
//    Rate is 86400·(P_nominal/P − 1) s/d, fast positive; beat error |d|, half the difference between the alternating
//    intervals, as Witschi defines it and the tg project computes it. Beats a knock or a voice spoiled weigh nothing.
// 4. Each template's noises: the first (unlocking) is where a beat is timed from, as Witschi times rate and beat error,
//    and the time from it to the last (the drop) gives the amplitude, A = λ / (2 sin(π t / T)), λ the lift angle and T
//    the full oscillation, shown only when the noises stand clear.

/** The beat rates a watch is tried at, slowest first. 288,000 is Frederique Constant's 40 Hz Monolithic. */
export const STANDARD = [14400, 18000, 19800, 21600, 25200, 28800, 36000, 288000];
/** The rates the menu offers by hand: the standard ones and a few rarer. */
export const MANUAL = [12000, 14400, 16200, 18000, 19800, 21600, 25200, 28800, 36000, 43200, 288000];
export const QUARTZ = 3600;                       // a quartz watch's stepping motor: one step a second

const median = a => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * The envelope with what isn't a watch taken out: a knock (far louder than the beats) and the 40 ms it rings for, and
 * a loud stretch (a voice, a rustle: 50 ms whose floor stands well above the room's), each set to the room's floor,
 * and what's left capped a little above the beats' height. Returns { env, cap, floor, masked (the fraction taken) }.
 */
export function clean(env, fe) {
  const n = env.length, sec = Math.max(1, Math.round(fe)), maxes = [];
  for (let i = 0; i < n; i += sec) { let m = 0; for (let j = i; j < Math.min(n, i + sec); j++) if (env[j] > m) m = env[j]; maxes.push(m); }
  const peak = median(maxes) || 0, blk = Math.max(1, Math.round(0.05 * fe)), floors = [];
  for (let i = 0; i < n; i += blk) floors.push(median(Array.from(env.subarray(i, Math.min(n, i + blk)))));
  const floor = median(floors) || 0, out = Float32Array.from(env), mask = new Uint8Array(n);
  floors.forEach((f, b) => {
    if (!(f > 4 * floor && f > 0.15 * peak)) return;
    for (let i = Math.max(0, (b - 1) * blk); i < Math.min(n, (b + 2) * blk); i++) mask[i] = 1;
  });
  const back = Math.round(0.005 * fe), ring = Math.round(0.04 * fe);
  for (let i = 0; i < n; i++) if (env[i] > 3 * peak && peak > 0) { for (let j = Math.max(0, i - back); j < Math.min(n, i + ring); j++) mask[j] = 1; }
  const cap = 1.6 * peak || Infinity;
  let masked = 0;
  for (let i = 0; i < n; i++) { if (mask[i]) { out[i] = floor; masked++; } else if (out[i] > cap) out[i] = cap; }
  return { env: out, cap, floor, masked: masked / (n || 1) };
}
/** The cleaned envelope with its mean taken off, for correlating. */
function prepared(env, fe) {
  const c = clean(env, fe), x = c.env;
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i];
  const mean = sum / (x.length || 1);
  for (let i = 0; i < x.length; i++) x[i] -= mean;
  return { x, cap: c.cap };
}
/** Normalised autocorrelation of x at a lag. */
function acf(x, lag) {
  let s = 0, a = 0, b = 0;
  for (let i = 0, n = x.length - lag; i < n; i++) { const u = x[i], v = x[i + lag]; s += u * v; a += u * u; b += v * v; }
  return a > 0 && b > 0 ? s / Math.sqrt(a * b) : 0;
}
/** The best autocorrelation within ±frac of a lag (at least ±1 sample), with where it is (interpolated). */
function peakNear(x, lag, frac) {
  const lo = Math.max(1, Math.floor(lag * (1 - frac)) - 1), hi = Math.min(x.length - 2, Math.ceil(lag * (1 + frac)) + 1);
  let best = -1, at = lo;
  const r = [];
  for (let l = lo; l <= hi; l++) { const v = acf(x, l); r.push(v); if (v > best) { best = v; at = l; } }
  const i = at - lo, y0 = r[i - 1], y2 = r[i + 1];
  const off = y0 != null && y2 != null && y0 - 2 * best + y2 < 0 ? 0.5 * (y0 - y2) / (y0 - 2 * best + y2) : 0;
  return { r: best, lag: at + off };
}

/**
 * Which beat rate the envelope shows, if any: { vph, period (s, a beat's, measured), strength, noise, tried } or
 * { vph: null } when no rate stands out. opts.vph forces one (it must still show), opts.within the fraction off its
 * nominal period a rate may be (±1.2 %, ±1000 s/d, by default).
 */
export function detect(env, fe, opts = {}) {
  const q = Math.max(1, Math.round(fe / 2000)), fd = fe / q, n = Math.floor(env.length / q);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < q; j++) s += env[i * q + j]; d[i] = s / q; }
  const { x } = prepared(d, fd);
  const secs = n / fd, within = opts.within ?? (opts.vph ? 0.03 : 0.012);
  const rates = opts.vph ? [opts.vph] : [...STANDARD, QUARTZ];
  // the noise of the autocorrelation: its spread over lags where nothing repeats, mostly
  const sample = [];
  for (let l = Math.round(0.006 * fd); l < Math.min(n / 2, 0.7 * fd); l += 7) sample.push(acf(x, l));
  const mid = median(sample), noise = 1.4826 * median(sample.map(v => Math.abs(v - mid))) || 0.01;
  const thr = Math.max(0.04, 5 * noise);
  const tried = [];
  for (const vph of rates) {
    const tb = 3600 / vph, lag = tb * fd;
    if (2 * tb * 1.04 > secs / 2 || lag < 4) continue;          // needs two full oscillations in half the window
    const b = peakNear(x, lag, within), f = peakNear(x, 2 * lag, within);
    let shows = b.r > thr && f.r > thr;
    // and it must fold into a few clicks: a voice's pitch or a lamp's buzz repeats too, but as a ripple
    if (shows) shows = clicky(smooth(fold(x, f.lag, 0, Math.min(n, Math.round(Math.max(3 * fd, 3 * f.lag))), Infinity), 1));
    tried.push({ vph, rb: b.r, rf: f.r, period: f.lag / fd / 2, shows });
  }
  let best = null;
  for (const t of tried) if (t.shows && (!best || t.rb + t.rf > best.rb + best.rf)) best = t;
  if (!best) return { vph: null, noise, thr, tried };
  // a rate whose beat divides this one's, and shows, is the watch's: this one only counts every other beat (or more)
  for (let again = true; again;) {
    again = false;
    for (const t of tried) {
      if (!t.shows || t.vph <= best.vph || t.vph === QUARTZ) continue;
      const m = t.vph / best.vph;
      // the Monolithic's 40 Hz is ten of a 28,800's beats: a voice's pitch can repeat that often, so it must show as
      // strongly as the rate it would replace
      const strong = t.vph !== 288000 || Math.min(t.rb, t.rf) >= 0.6 * Math.min(best.rb, best.rf);
      if (Math.abs(m - Math.round(m)) < 0.01 && Math.round(m) >= 2 && strong) { best = t; again = true; }
    }
  }
  return { vph: best.vph, period: best.period, strength: Math.min(best.rb, best.rf), noise, thr, tried };
}

// ---------- templates and the matched filter ----------
/** The envelope folded at a period (in samples, fractional) from `from`, a trimmed mean of each bin: knocks can't
 *  pull a bin up. */
function fold(env, period, from, to, cap) {
  const len = Math.max(2, Math.round(period)), bins = Array.from({ length: len }, () => []);
  for (let s = from; s + period <= to; s += period) {
    for (let j = 0; j < len; j++) {
      const p = s + j * period / len, i = Math.floor(p), f = p - i;
      if (i + 1 >= env.length) break;
      const v = env[i] * (1 - f) + env[i + 1] * f;
      bins[j].push(v > cap ? cap : v);
    }
  }
  return bins.map(b => trimmed(b));
}
function trimmed(vals) {
  if (!vals.length) return 0;
  const s = Float64Array.from(vals).sort(), keep = Math.max(1, Math.ceil(s.length * 0.8));
  let a = 0;
  for (let i = 0; i < keep; i++) a += s[i];
  return a / keep;
}
/** A unit-length, mean-free copy (what the matched filter correlates against). */
function normalised(t) {
  let m = 0;
  for (const v of t) m += v;
  m /= t.length || 1;
  const z = Float32Array.from(t, v => v - m);
  let e = 0;
  for (const v of z) e += v * v;
  const s = e > 0 ? 1 / Math.sqrt(e) : 0;
  for (let i = 0; i < z.length; i++) z[i] *= s;
  return z;
}
/**
 * The matched filter: the normalised correlation of `tpl` (normalised) with env starting near `at` (the template's
 * first sample's predicted place), searched ±span samples. Returns { at (interpolated), c (its correlation) } or null.
 */
function match(env, tpl, at, span, sums) {
  const L = tpl.length, lo = Math.max(0, Math.round(at - span)), hi = Math.min(env.length - L - 1, Math.round(at + span));
  if (hi < lo) return null;
  let best = -2, bi = lo;
  const cs = new Float32Array(hi - lo + 1);
  for (let s = lo; s <= hi; s++) {
    let dot = 0;
    for (let i = 0; i < L; i++) dot += env[s + i] * tpl[i];
    const sum = sums.s[s + L] - sums.s[s], sq = sums.q[s + L] - sums.q[s];
    const v = sq - sum * sum / L, c = v > 1e-30 ? dot / Math.sqrt(v) : 0;      // tpl is mean-free, so dot needs no mean taken
    cs[s - lo] = c;
    if (c > best) { best = c; bi = s; }
  }
  const i = bi - lo, y0 = cs[i - 1], y2 = cs[i + 1];
  const off = i > 0 && i < cs.length - 1 && y0 - 2 * best + y2 < 0 ? 0.5 * (y0 - y2) / (y0 - 2 * best + y2) : 0;
  return { at: bi + off, c: best, edge: i === 0 || i === cs.length - 1 };
}
function prefix(env) {
  const s = new Float64Array(env.length + 1), q = new Float64Array(env.length + 1);
  for (let i = 0; i < env.length; i++) { s[i + 1] = s[i] + env[i]; q[i + 1] = q[i] + env[i] * env[i]; }
  return { s, q };
}

// ---------- the fit ----------
/**
 * Beat times t_k (samples) against their beat numbers k: t = c + k·P + d·[k odd], robustly (Tukey's biweight on the
 * residuals' median spread), so a knock's beat counts for nothing. Returns { c, P, d, sigma (residual spread),
 * sP, sd (their uncertainties, widened for residuals that follow each other), used (beats kept) } or null.
 */
export function fitBeats(input) {
  if (input.length < 6) return null;
  const beats = [...input].sort((a, b) => a.k - b.k);
  let w = beats.map(() => 1), sol = null, sigma = 0;
  for (let it = 0; it < 8; it++) {
    sol = solve3(beats, w);
    if (!sol) return null;
    const res = beats.map(b => b.t - (sol.c + b.k * sol.P + (b.k & 1 ? sol.d : 0)));
    sigma = 1.4826 * median(res.map(Math.abs)) || 1e-6;
    const cut = 4.685 * sigma;
    w = res.map(r => (Math.abs(r) < cut ? (1 - (r / cut) ** 2) ** 2 : 0));
  }
  const res = beats.map(b => b.t - (sol.c + b.k * sol.P + (b.k & 1 ? sol.d : 0)));
  const kept = beats.map((b, i) => ({ ...b, r: res[i], w: w[i] })).filter(b => b.w > 0);
  if (kept.length < 6) return null;
  // the residuals' lag-one correlation (a watch's beat wanders): it widens the slope's uncertainty
  let num = 0, den = 0;
  for (let i = 1; i < kept.length; i++) { num += kept[i].r * kept[i - 1].r; den += kept[i].r * kept[i].r; }
  const rho = Math.max(0, Math.min(0.9, den > 0 ? num / den : 0)), widen = Math.sqrt((1 + rho) / (1 - rho));
  const kbar = kept.reduce((a, b) => a + b.k, 0) / kept.length, sxx = kept.reduce((a, b) => a + (b.k - kbar) ** 2, 0);
  const s = Math.sqrt(kept.reduce((a, b) => a + b.r * b.r, 0) / Math.max(1, kept.length - 3));
  return { ...sol, sigma: s, sP: (s / Math.sqrt(sxx || 1)) * widen, sd: s * 2 / Math.sqrt(kept.length) * widen, used: kept.length, rho };
}
/** Weighted least squares for [c, P, d]; with no odd beats (the ticks alone) for [c, P], d = 0. */
function solve3(beats, w) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0];
  beats.forEach((b, i) => {
    const r = [1, b.k, b.k & 1 ? 1 : 0], wi = w[i];
    if (!wi) return;
    for (let p = 0; p < 3; p++) { y[p] += wi * r[p] * b.t; for (let q = 0; q < 3; q++) A[p][q] += wi * r[p] * r[q]; }
  });
  if (A[2][2] === 0) { A[2][2] = 1; y[2] = 0; }
  const x = gauss3(A, y);
  return x ? { c: x[0], P: x[1], d: x[2] } : null;
}
function gauss3(A, y) {
  const M = A.map((r, i) => [...r, y[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    if (Math.abs(M[p][i]) < 1e-12) return null;
    [M[i], M[p]] = [M[p], M[i]];
    for (let j = 0; j < 3; j++) if (j !== i) { const f = M[j][i] / M[i][i]; for (let k = i; k < 4; k++) M[j][k] -= f * M[i][k]; }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

// ---------- a template's noises ----------
/**
 * The noises in a template (an averaged beat): peaks standing clear of its floor, the first no further before the
 * loudest than the lift could take at a low amplitude (reach, samples). Returns { first, last, peaks, onset } in
 * template samples (onset: where the first noise rises through 30 % of its height), or null.
 */
export function noises(t, fe, { minGap = 0.0008, span = [0, Infinity], reach = Infinity } = {}) {
  let main = 0;
  for (let i = 1; i < t.length; i++) if (t[i] > t[main]) main = i;
  // the floor and its noise from outside the beat (before its reach, and well after the loudest noise)
  const lo = Math.round(main - Math.min(reach, t.length) - 0.002 * fe), hi = Math.round(main + 0.004 * fe);
  const out = [];
  for (let i = 0; i < t.length; i++) if (i < lo || i > hi) out.push(t[i]);
  const quiet = out.length >= 8 ? out : Array.from(Float64Array.from(t).sort().slice(0, Math.max(3, Math.floor(t.length * 0.3))));
  const base = median(quiet), sd = 1.4826 * median(quiet.map(v => Math.abs(v - base))) || 1e-12;
  const top = t[main] - base;
  if (!(top > 8 * sd)) return null;
  const floor = base + Math.max(0.12 * top, 6 * sd), gap = Math.round(minGap * fe);
  let peaks = [];
  for (let i = Math.max(1, Math.floor(main - reach)); i < t.length - 1; i++) if (t[i] > floor && t[i] >= t[i - 1] && t[i] > t[i + 1]) peaks.push(i);
  // peaks closer than a noise's own width are one noise: keep the higher
  const merged = [];
  for (const p of peaks) {
    const last = merged[merged.length - 1];
    if (last != null && p - last < gap) { if (t[p] > t[last]) merged[merged.length - 1] = p; }
    else merged.push(p);
  }
  peaks = merged;
  if (!peaks.length) return null;
  // the onset: where the first noise rises through 30 % of its height, near its start but clear of the floor's noise
  const first = peaks[0], rise = base + 0.3 * (t[first] - base);
  let on = first;
  while (on > 0 && t[on - 1] > rise) on--;
  const onset = on > 0 ? on - 1 + (rise - t[on - 1]) / (t[on] - t[on - 1] || 1) : on;
  const strong = peaks.filter(p => p > first && t[p] - base >= 0.3 * top && p - first >= span[0] && p - first <= span[1]);
  return { first, last: strong.length ? strong[strong.length - 1] : null, peaks, onset, base, top };
}

/** Amplitude (degrees) from the lift angle (degrees), the lift's time (s) and the full oscillation (s). */
export const amplitudeOf = (lift, dt, T) => lift / (2 * Math.sin(Math.PI * dt / T));
/** The lift's time (s) an amplitude gives: amplitudeOf's inverse. */
export const liftTimeOf = (lift, amp, T) => (T / Math.PI) * Math.asin(Math.min(1, lift / (2 * amp)));

// ---------- measuring ----------
/**
 * Measures a stretch of envelope. opts: vph (forced; else detected), lift (degrees, for the amplitude; null: none),
 * flexure (no balance: rate only), known (a detection already made, reused). Returns, when it hears a watch:
 * { ok: true, vph, rate (s/d), rateErr, be (ms), beErr, amp (degrees or null), ampA, ampB, quality (0–1: the beats'
 * median correlation), kept (fraction of beats used), beats: [{ t (s from the stretch's start), k, odd, c, used }],
 * secs, sigma (ms), templates: { a, b, fe, refA, refB, noisesA, noisesB } };
 * otherwise { ok: false, why: "short" | "nothing" | "quartz" | "weak", ... }.
 */
export function measure(raw, fe, opts = {}) {
  const secs = raw.length / fe;
  if (secs < 2.5) return { ok: false, why: "short", secs };
  const look = raw.length > 10 * fe ? raw.subarray(raw.length - Math.round(10 * fe)) : raw;   // detect on the last 10 s
  const found = opts.known?.vph && (!opts.vph || opts.known.vph === opts.vph) ? opts.known : detect(look, fe, { vph: opts.vph });
  if (!found.vph) return { ok: false, why: "nothing", secs, found };
  if (found.vph === QUARTZ) return { ok: false, why: "quartz", secs, found };
  const vph = found.vph, Pn = 3600 / vph * fe;                       // nominal beat period, in samples
  const { env, cap } = clean(raw, fe), from = env.length - look.length;
  const P0 = (found.period || 3600 / vph) * fe, W = Math.round(Math.min(0.3 * P0, 0.022 * fe));
  const cut = (arr, at) => Float32Array.from({ length: 2 * W + 1 }, (_, j) => arr[((Math.round(at) - W + j) % arr.length + arr.length) % arr.length]);
  const sm = a => smooth(a, Math.max(1, Math.round(0.0004 * fe)));
  // 1. a first fold where the rate was found, over three seconds (a period a little off smears a longer one): its
  //    loudest click is a tick (which of the two is called the tick doesn't matter)
  const first = sm(fold(env, 2 * P0, from, Math.min(env.length, from + Math.round(3 * fe)), cap));
  if (!clicky(first)) return { ok: false, why: "nothing", secs, found };
  let ia = 0;
  for (let i = 1; i < first.length; i++) if (first[i] > first[ia]) ia = i;
  const sums = prefix(env), narrow = f => Math.max(0.0012 * fe, 6 * f.sigma);
  /**
   * Tracking: from the anchor forward to the end, then back to the start, each beat looked for where the fit of those
   * found so far puts it (widely until a dozen are in), the fit renewed as they come. step 2: the ticks alone.
   */
  const track = (tplA, tplB, c0, Pa, d0, wide, step = 1) => {
    const out = [];
    let c = c0, Pk = Pa, d = d0, fit = null, fitted = 0;
    const at = k => { const odd = k & 1; return { odd, pred: c + k * Pk + (odd ? d : 0) - W }; };
    const look1 = k => {
      const { odd, pred } = at(k);
      if (pred < 0 || pred + 2 * W + 2 >= env.length) return;
      const m = match(env, odd ? tplB : tplA, pred, out.length < 12 || !fit ? wide : narrow(fit), sums);
      if (!m || m.c <= 0.25 || m.edge) return;
      out.push({ t: m.at + W, k, odd: !!odd, c: m.c });
      // refitted as each of the first beats comes, then each time a quarter more are in (a fit a beat is slow at 80 a second)
      if (out.length >= 8 && (out.length < 24 || out.length >= fitted * 1.25)) {
        const f = fitBeats(out);
        fitted = out.length;
        if (f && Math.abs(f.P / Pn - 1) < 0.05) { fit = f; c = f.c; Pk = f.P; d = f.d; }
      }
    };
    for (let k = 0; at(k).pred + 2 * W + 2 < env.length; k += step) look1(k);
    for (let k = -step; at(k).pred + W > 0; k -= step) look1(k);
    return { beats: out, fit: fitBeats(out) };
  };
  // 2. the ticks alone, a full oscillation apart, pin the period down
  const ticks = track(normalised(cut(first, ia)), null, from + ia, P0, 0, Math.round(0.12 * P0), 2);
  if (!ticks.fit || ticks.beats.length < 8) return { ok: false, why: "weak", secs, found };
  // 3. folded at that period over the whole stretch, the tock stands out too, near the middle (beat error moves it)
  const P = ticks.fit.P, F = 2 * P, start = ticks.fit.c - W - Math.floor((ticks.fit.c - W) / F) * F;
  const whole = sm(fold(env, F, start, env.length, cap)), len = whole.length, scale = F / len;
  const tock = findTock(whole, W, len, P / scale, fe / scale);
  // 4. both, each against its own template; a tock that can't be heard leaves the ticks to time the rate alone
  let pass = tock == null ? ticks
    : track(normalised(cut(whole, W)), normalised(cut(whole, tock)), ticks.fit.c, P, (tock - W) * scale - P, Math.round(0.03 * P));
  if (!pass.fit || pass.beats.length < 8) pass = ticks;
  // templates rebuilt from the beats as aligned (a trimmed mean, so a knock can't spoil one), then every beat timed
  // again against them
  const rebuild = odd => {
    const rows = pass.beats.filter(b => b.odd === odd && b.c > 0.5).map(b => b.t);
    if (rows.length < 4) return null;
    const t = new Float32Array(2 * W + 1), cols = Array.from({ length: 2 * W + 1 }, () => []);
    for (const at of rows) for (let j = -W; j <= W; j++) {
      const p = at + j, i = Math.floor(p), f = p - i;
      if (i < 0 || i + 1 >= env.length) continue;
      cols[j + W].push(env[i] * (1 - f) + env[i + 1] * f);
    }
    cols.forEach((c, j) => { t[j] = trimmed(c); });
    return t;
  };
  const onlyTicks = pass === ticks, step = onlyTicks ? 2 : 1;
  const rawA = rebuild(false), rawB = onlyTicks ? null : rebuild(true);
  if (rawA && (rawB || onlyTicks)) {
    const again = onlyTicks ? track(normalised(rawA), null, pass.fit.c, pass.fit.P, 0, Math.round(0.05 * P), 2)
      : track(normalised(rawA), normalised(rawB), pass.fit.c, pass.fit.P, pass.fit.d, Math.round(0.05 * P));
    if (again.fit && again.beats.length >= pass.beats.length * 0.8) pass = again;
  }
  // a beat matching far worse than the reading's own typical beat is the room's chance resemblance (before the watch
  // was put on the microphone, say), not the watch: dropped before the last fit
  const typical = median(pass.beats.map(b => b.c)), clear = pass.beats.filter(b => b.c >= Math.max(0.3, 0.55 * typical));
  if (clear.length < pass.beats.length && clear.length >= 8) { const f = fitBeats(clear); if (f) pass = { beats: clear, fit: f }; }
  const fit = pass.fit;
  if (!fit) return { ok: false, why: "weak", secs, found };
  // the share of beats heard, over the stretch the watch was heard in (a reading may begin before it's on the mic)
  const ks = pass.beats.map(b => b.k), expected = Math.max(1, Math.floor((Math.max(...ks) - Math.min(...ks)) / step) + 1), kept = fit.used / expected;
  const quality = median(pass.beats.map(b => b.c));
  // 5. the templates' noises: the first is where each beat is timed from (Witschi times rate and beat error from the
  //    first noise), and the first to the last gives the amplitude
  const tplA = rebuild(false) || cut(whole, W), tplB = onlyTicks ? null : rebuild(true) || cut(whole, tock), T = 2 * fit.P / fe;
  const lift = opts.lift ?? null;
  const span2 = lift ? [liftTimeOf(lift, 360, T) * fe * 0.9, liftTimeOf(lift, 120, T) * fe * 1.1] : [0, Infinity];
  const lead = liftTimeOf(lift ?? 52, 130, T) * fe * 1.15;           // the furthest a first noise can lead the loudest
  const nA = noises(tplA, fe, { span: span2, reach: lead }), nB = tplB ? noises(tplB, fe, { span: span2, reach: lead }) : null;
  const refA = nA ? nA.onset - W : 0, refB = nB ? nB.onset - W : 0;
  const d = onlyTicks ? null : fit.d + (refB - refA);               // the tock's first noise against the tick's
  let ampA = null, ampB = null, amp = null;
  if (lift && !opts.flexure && nA?.last != null) {
    ampA = amplitudeOf(lift, (nA.last - nA.first) / fe, T);
    ampB = nB?.last != null ? amplitudeOf(lift, (nB.last - nB.first) / fe, T) : null;
    const fair = a => a > 120 && a < 360;
    if (fair(ampA) && (ampB == null ? onlyTicks : fair(ampB) && Math.abs(ampA - ampB) < 40)) amp = ampB == null ? ampA : (ampA + ampB) / 2;
  }
  const Ps = fit.P / fe, rate = 86400 * (3600 / vph / Ps - 1), rateErr = 86400 * (fit.sP / fit.P);
  const beats = pass.beats.map(b => ({ t: (b.t + (b.odd ? refB : refA)) / fe, k: b.k, odd: b.odd, c: b.c }));
  const weak = kept < 0.5 || fit.used < 12 || rateErr > 10;
  return {
    ok: !weak, why: weak ? "weak" : null, vph, rate, rateErr, be: d == null ? null : Math.abs(d) / fe * 1000,
    beErr: d == null ? null : fit.sd / fe * 1000, amp, ampA, ampB, quality, kept: Math.min(1, kept), beats, secs,
    sigma: fit.sigma / fe * 1000, found, period: Ps, fitC: (fit.c + refA) / fe, fitD: d == null ? null : d / fe, onlyTicks,
    templates: { a: tplA, b: tplB, fe, refA: refA + W, refB: refB + W, noisesA: nA, noisesB: nB, W },
  };
}
/**
 * In a fold over a full oscillation with the tick at `at` (bins; P a beat and fe a second, in bins), the tock: the
 * loudest point near the middle (within an eighth of a beat of it, then a fifth), if it stands clear of the floor.
 * Returns its place (bins, after `at`), or null.
 */
function findTock(f, at, len, P, fe) {
  const n = f.length, idx = i => ((Math.round(i) % n) + n) % n;
  const base = median(Array.from(f)), sd = 1.4826 * median(Array.from(f, v => Math.abs(v - base))) || 1e-12;
  const tick = f[idx(at)] - base;
  for (const reach of [0.125 * P + 0.002 * fe, 0.2 * P]) {
    let best = null;
    for (let j = -Math.round(reach); j <= Math.round(reach); j++) { const p = at + len / 2 + j; if (best == null || f[idx(p)] > f[idx(best)]) best = p; }
    if (f[idx(best)] - base > Math.max(6 * sd, 0.08 * tick)) return best;
  }
  return null;
}
/** A light moving average. */
function smooth(a, r) {
  if (r < 1) return a;
  const n = a.length, out = new Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = -r; j <= r; j++) s += a[((i + j) % n + n) % n]; out[i] = s / (2 * r + 1); }
  return out;
}
/** A fold that is a few sharp clicks over a quiet floor (a watch), not a ripple (a buzz) or flat (nothing). */
function clicky(fold) {
  const s = Float64Array.from(fold).sort(), base = s[Math.floor(s.length * 0.5)], top = s[s.length - 1];
  if (!(top > base)) return false;
  const above = fold.filter(v => v > base + 0.25 * (top - base)).length / fold.length;
  const low = s.slice(0, Math.floor(s.length * 0.5)), spread = (s[Math.floor(s.length * 0.5)] - s[Math.floor(s.length * 0.1)]) || 1e-12;
  return above < 0.25 && (top - base) > 6 * spread && low.length > 0;
}
