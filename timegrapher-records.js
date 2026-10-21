// Timegrapher's records and verdicts, pure (tests/timegrapher.mjs runs them in Node): the positions a watch is
// measured in and what a session of them comes to, measured against the standards that say what "well tuned" means;
// the worn-rate log (the watch against the phone's clock, days apart); and the saved state, made whole again from
// whatever JSON comes back.
//
// The standards, as published:
// - COSC's chronometer criteria for balance-spring wristwatches (ISO 3159; cosc.swiss), over 15 days, 5 positions and 3
//   temperatures. Category 1 (fitting diameter over 20 mm, or surface over 314 mm²) and category 2: mean daily rate
//   −4/+6 and −5/+8 s/d; H − V (horizontal minus vertical) −6/+8 and −8/+10; largest variation of a rate from the mean,
//   10 and 15 s/d. A session here is minutes on a bench at one temperature, so these are a yardstick, not a test.
// - Witschi's tolerances for a watch fully wound ("Testing methods for mechanical watches", 2025): rate −5/+15 s/d for a
//   man's watch (−5/+25 a lady's small one); amplitude 260–320° horizontal, 240–280° vertical; beat error under
//   0.5 ms, about 3 ms needing correction; over 330°, a risk of overbanking.
// - Witschi's positions and their names: dial up CH, dial down CB, crown down 9H, crown left 6H, crown up 3H, crown
//   right 12H; XH and XV the horizontal and vertical means, D the greatest difference between positions.

export const POSITIONS = [
  { id: "DU", name: "Dial up", witschi: "CH", h: true },
  { id: "DD", name: "Dial down", witschi: "CB", h: true },
  { id: "CD", name: "Crown down", witschi: "9H", h: false },
  { id: "CU", name: "Crown up", witschi: "3H", h: false },
  { id: "CL", name: "Crown left", witschi: "6H", h: false },
  { id: "CR", name: "Crown right", witschi: "12H", h: false },
];
export const COSC = { 1: { mean: [-4, 6], hv: [-6, 8], dev: 10 }, 2: { mean: [-5, 8], hv: [-8, 10], dev: 15 } };
export const WITSCHI = { rate: [-5, 15], rateSmall: [-5, 25], ampH: [260, 320], ampV: [240, 280], be: 0.5, beFix: 3, overbank: 330 };

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const within = (v, [lo, hi]) => v >= lo && v <= hi;
const sign = v => (v > 0.05 ? "+" : v < -0.05 ? "−" : "±");
export const signed = (v, d = 1) => `${sign(v)}${Math.abs(v).toFixed(d)}`;

/**
 * A positions session's figures from its steps ([{ pos, rate, be, amp }], skipped positions left out): the mean rate
 * (X), the spread (D, the greatest difference), the largest deviation of a position from the mean, H − V, the
 * amplitudes horizontal and vertical, the worst beat error. Null when fewer than two positions were measured.
 */
export function summarise(steps) {
  const done = steps.filter(s => s && Number.isFinite(s.rate) && POSITIONS.some(p => p.id === s.pos));
  if (done.length < 2) return null;
  const rates = done.map(s => s.rate), X = mean(rates);
  const isH = s => POSITIONS.find(p => p.id === s.pos).h;
  const H = done.filter(isH), V = done.filter(s => !isH(s));
  const XH = H.length ? mean(H.map(s => s.rate)) : null, XV = V.length ? mean(V.map(s => s.rate)) : null;
  const amps = list => list.map(s => s.amp).filter(Number.isFinite);
  const ampH = mean(amps(H)), ampV = mean(amps(V)), bes = done.map(s => s.be).filter(Number.isFinite);
  return {
    n: done.length, mean: X, min: Math.min(...rates), max: Math.max(...rates), delta: Math.max(...rates) - Math.min(...rates),
    dev: Math.max(...rates.map(r => Math.abs(r - X))), XH, XV, hv: XH != null && XV != null ? XH - XV : null,
    ampH, ampV, ampDrop: ampH != null && ampV != null ? ampH - ampV : null, beMax: bes.length ? Math.max(...bes) : null,
  };
}

/**
 * What a session says, in plain words with the numbers: { level, title, lines: [...], checks: [{ what, value, limit, ok }] }.
 * level: "chronometer" (inside COSC's limits on every count it can be held to), "good" (inside Witschi's service
 * tolerance, positions close), "regulate" (positions close but the mean off: a regulator's turn), "service" (the
 * positions far apart, the beat badly out, or the amplitude low).
 */
export function verdict(sum, { category = 1, small = false } = {}) {
  if (!sum) return null;
  const c = COSC[category] || COSC[1], tol = small ? WITSCHI.rateSmall : WITSCHI.rate, checks = [];
  const add = (what, value, limit, ok) => checks.push({ what, value, limit, ok });
  add("Mean rate", `${signed(sum.mean)} s/d`, `COSC ${c.mean[0]}/+${c.mean[1]}`, within(sum.mean, c.mean));
  add("Largest from the mean", `${sum.dev.toFixed(1)} s/d`, `COSC ${c.dev}`, sum.dev <= c.dev);
  if (sum.hv != null) add("H − V", `${signed(sum.hv)} s/d`, `COSC ${c.hv[0]}/+${c.hv[1]}`, within(sum.hv, c.hv));
  if (sum.beMax != null) add("Beat error", `${sum.beMax.toFixed(1)} ms`, `Witschi < ${WITSCHI.be}`, sum.beMax < WITSCHI.be);
  if (sum.ampH != null) add("Amplitude flat", `${Math.round(sum.ampH)}°`, `Witschi ${WITSCHI.ampH.join("–")}`, within(sum.ampH, WITSCHI.ampH));
  if (sum.ampV != null) add("Amplitude hanging", `${Math.round(sum.ampV)}°`, `Witschi ${WITSCHI.ampV.join("–")}`, within(sum.ampV, WITSCHI.ampV));
  // COSC tests five positions, flat and hanging: fewer can't be held to its limits, only measured against them
  const full = sum.n >= 5 && sum.hv != null;
  const cosc = full && checks.filter(k => k.limit.startsWith("COSC")).every(k => k.ok) && (sum.beMax == null || sum.beMax < WITSCHI.be);
  const close = sum.dev <= c.dev * 1.5 && (sum.hv == null || within(sum.hv, [c.hv[0] * 1.5, c.hv[1] * 1.5]));
  const lowAmp = (sum.ampH != null && sum.ampH < WITSCHI.ampH[0] - 30) || (sum.ampV != null && sum.ampV < WITSCHI.ampV[0] - 30);
  const beBad = sum.beMax != null && sum.beMax >= WITSCHI.beFix;
  const lines = [];
  let level;
  if (cosc && !lowAmp) level = "chronometer";
  else if (!close || beBad || lowAmp) level = "service";
  else if (within(sum.mean, tol)) level = "good";
  else level = "regulate";
  const fastSlow = sum.mean > 0 ? "fast" : "slow";
  if (level === "chronometer") lines.push(`On the bench it meets COSC's limits: ${signed(sum.mean)} s/d on average, no position more than ${sum.dev.toFixed(1)} s/d from it.`);
  if (level === "good") lines.push(`Well tuned: ${signed(sum.mean)} s/d on average is inside Witschi's service tolerance (${tol[0]}/+${tol[1]}), and the positions agree within ${sum.delta.toFixed(1)} s/d.`);
  if (level === "regulate") lines.push(`The positions agree (within ${sum.delta.toFixed(1)} s/d), but it runs ${Math.abs(sum.mean).toFixed(1)} s/d ${fastSlow} on average: a turn of the regulator would bring it in.`);
  if (level === "service") {
    if (!close) lines.push(`The positions disagree: ${sum.delta.toFixed(1)} s/d between the fastest and the slowest${sum.hv != null ? `, ${signed(sum.hv)} s/d flat against hanging` : ""}. That is poise, wear or old oil: a watchmaker's job.`);
    if (beBad) lines.push(`It's ${sum.beMax.toFixed(1)} ms out of beat: Witschi puts correction at about ${WITSCHI.beFix} ms.`);
    if (lowAmp) lines.push(`The swing is low (${Math.round(sum.ampH ?? sum.ampV)}°, rough): often a sign a service is due, unless the lift angle is set too high.`);
  }
  if (level !== "service" && sum.beMax != null && sum.beMax >= WITSCHI.be) lines.push(`Beat error ${sum.beMax.toFixed(1)} ms: over Witschi's 0.5, worth putting in beat at the next service.`);
  if (!full) lines.push(`${sum.n} position${sum.n === 1 ? "" : "s"}${sum.hv == null ? `, all ${sum.XH != null ? "flat" : "hanging"}` : ""}: COSC's limits need five, flat and hanging, so this can't be called chronometer-grade.`);
  if (sum.ampDrop != null && sum.ampDrop > 60) lines.push(`It loses ${Math.round(sum.ampDrop)}° hanging against flat (rough): more than the usual 20 to 40.`);
  return { level, title: { chronometer: "Chronometer-grade", good: "Well tuned", regulate: "Worth regulating", service: "Worth a service" }[level], lines, checks };
}

/**
 * The isochronism (Witschi's Ie): how the mean rate changes from fully wound to 24 hours later, from a watch's latest
 * session of each. Returns { full, day, change (full less 24 h, Witschi's sign), ie (its size) } or null.
 */
export function isochronism(sessions) {
  const latest = wind => (sessions || []).filter(s => s?.wind === wind && Array.isArray(s.steps)).sort((a, b) => b.at - a.at)[0];
  const f = latest("full"), d = latest("24h"), sf = f && summarise(f.steps), sd = d && summarise(d.steps);
  if (!sf || !sd) return null;
  return { full: sf.mean, day: sd.mean, change: sf.mean - sd.mean, ie: Math.abs(sf.mean - sd.mean) };
}

/** One reading's words: how its rate stands in the position it was taken in. */
export function readingWords(rate, { small = false } = {}) {
  const tol = small ? WITSCHI.rateSmall : WITSCHI.rate;
  if (Math.abs(rate) > 60) return `Far off: ${signed(rate, 0)} s/d. A watch this far out is often magnetised (a compass beside it twitches); a watchmaker demagnetises it in seconds.`;
  if (within(rate, COSC[1].mean)) return "Inside COSC's limits in this position.";
  if (within(rate, tol)) return `Inside Witschi's service tolerance (${tol[0]}/+${tol[1]}) in this position.`;
  return rate > 0 ? "Fast in this position: one position isn't the day's rate, so try the positions." : "Slow in this position: one position isn't the day's rate, so try the positions.";
}

// ---------- the worn-rate log ----------
// The watch against the phone's clock, as worn: a tap the moment its seconds hand reaches 12, now and again a day or a
// week later. The phone's clock is kept to network time, so the difference between readings, over the days between
// them, is the rate as worn, with no microphone and no crystal under it. A tap's own error (a person's reaction, the
// hand's step of a sixth of a second at 21,600) is about a tenth of a second and the same each time, so over a week the
// rate is good to a few hundredths of a second a day.

/** The watch's offset from true time (s, + ahead) for a tap at `ms` (epoch) when its seconds hand was at 12: the
 *  nearest whole minute to the phone's time, moved by `minutes` when the watch is more than half a minute out. */
export function tapOffset(ms, minutes = 0) {
  const shown = Math.round(ms / 60000) * 60000 + minutes * 60000;
  return (shown - ms) / 1000;
}
export const TAP_ERROR = 0.1;           // s: one tap's error, a person's and the hand's step together
/**
 * The rate as worn from a log ([{ at (epoch ms), off (s), set (the watch was set or started then) }]): from the last
 * setting on, a straight line through the offsets. Returns { rate (s/d), err, days, n, from, to } or null under two
 * readings or an hour apart.
 */
export function wornRate(log) {
  const sorted = [...(log || [])].filter(e => Number.isFinite(e?.at) && Number.isFinite(e?.off)).sort((a, b) => a.at - b.at);
  let start = 0;
  sorted.forEach((e, i) => { if (e.set) start = i; });
  const run = sorted.slice(start);
  if (run.length < 2) return null;
  const t0 = run[0].at, xs = run.map(e => (e.at - t0) / 86400000), ys = run.map(e => e.off);
  const days = xs[xs.length - 1];
  if (days < 1 / 24) return null;
  const xm = mean(xs), ym = mean(ys), sxx = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  const b = xs.reduce((s, x, i) => s + (x - xm) * (ys[i] - ym), 0) / sxx;
  const res = run.length > 2 ? Math.sqrt(ys.reduce((s, y, i) => s + (y - ym - b * (xs[i] - xm)) ** 2, 0) / (run.length - 2)) : 0;
  const err = Math.max(TAP_ERROR, res) / Math.sqrt(sxx);
  return { rate: b, err, days, n: run.length, from: run[0].at, to: run[run.length - 1].at };
}

// ---------- the saved state ----------
const num = v => (Number.isFinite(v) ? v : null);
const str = (v, max = 60) => (typeof v === "string" ? v.slice(0, max) : "");
const list = v => (Array.isArray(v) ? v : []);
/** A reading as kept, or null. */
export function cleanReading(r) {
  if (!r || !Number.isFinite(r.at) || !Number.isFinite(r.rate)) return null;
  return { at: r.at, src: r.src === "file" ? "file" : "mic", name: str(r.name, 80) || null, vph: num(r.vph), rate: r.rate, rateErr: num(r.rateErr),
    be: num(r.be), amp: num(r.amp), quality: num(r.quality), secs: num(r.secs), lift: num(r.lift), pos: POSITIONS.some(p => p.id === r.pos) ? r.pos : null };
}
/** A session as kept, or null. */
export function cleanSession(s) {
  if (!s || !Number.isFinite(s.at)) return null;
  const steps = list(s.steps).map(x => (x && POSITIONS.some(p => p.id === x.pos) && Number.isFinite(x.rate) ? { pos: x.pos, rate: x.rate, be: num(x.be), amp: num(x.amp), quality: num(x.quality) } : null)).filter(Boolean);
  return steps.length ? { at: s.at, wind: ["full", "24h"].includes(s.wind) ? s.wind : null, steps } : null;
}
/** A worn-rate log entry, or null. */
export function cleanEntry(e) {
  return e && Number.isFinite(e.at) && Number.isFinite(e.off) ? { at: e.at, off: e.off, ...(e.set ? { set: true } : {}) } : null;
}
/** The watches, made whole from whatever JSON gave back: { current, list: [watch] }, every watch with its arrays. */
export function cleanWatches(raw, calibreIds = null) {
  const ids = new Set();
  const out = list(raw?.list).map(w => {
    if (!w || typeof w.id !== "string" || ids.has(w.id)) return null;
    ids.add(w.id);
    return {
      id: w.id, name: str(w.name) || "Watch", cal: typeof w.cal === "string" && (!calibreIds || calibreIds.has(w.cal)) ? w.cal : "auto",
      vph: num(w.vph), lift: num(w.lift),
      readings: list(w.readings).map(cleanReading).filter(Boolean).slice(0, 100),
      sessions: list(w.sessions).map(cleanSession).filter(Boolean).slice(0, 30),
      log: list(w.log).map(cleanEntry).filter(Boolean).slice(-200),
    };
  }).filter(Boolean);
  const current = out.some(w => w.id === raw?.current) ? raw.current : out[0]?.id ?? null;
  return { current, list: out };
}
