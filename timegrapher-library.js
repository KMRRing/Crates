// Timegrapher's library of watches, pure (tests/timegrapher.mjs runs it in Node): what a reading says about which
// watch it was, learnt from the watch's own readings; and how a watch is keeping over the months, from its history.
//
// Which watch: the beat rate (vph) parts most watches at once (Korbi's Monolithic beats 288,000, the Heart Beat 28,800,
// the Reversos and the Rado 21,600). Between watches that beat alike, a watch is known by what stays its own between
// services: its beat error (set by where the hairspring is pinned, and seldom the same in two watches), the shape of its
// beat (when its three noises come and how loud each is, a template of the escapement and its case), and, more
// loosely, its rate and amplitude, which move with position and wind. Each watch keeps a print of these, learnt from
// every reading kept for it; a reading is set against every print that beats alike and the likeliest named, with how
// sure. Two watches of the same calibre and case regulated alike can't be told apart, and the page says so rather
// than guess.
//
// How it's keeping: a baseline from its first readings after its last service (or its first readings at all), set
// against its latest: an amplitude fallen 30° or more, or under 220°, is the usual sign of oils drying (Witschi: 260°
// flat, fully wound, is the floor of a healthy watch); a beat error grown past 0.8 ms wants regulating; a rate that
// jumps 20 s/d or more from its own is most often magnetism, or a knock. Makers ask for a service every five to eight
// years (JLC: every six to eight), so the date of the last is kept and counted.

const TPL = 64;                          // a template's points, as kept
const LEARN = 20;                        // the readings a print weighs at most: older ones fade, so a regulated watch is learnt again

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n & 1 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const fin = v => Number.isFinite(v);

// ---------- prints ----------
/** A beat's template brought to TPL points, its level and loudness taken out (mean 0, length 1), or null. */
export function shapeOf(t) {
  if (!t || t.length < 8) return null;
  const out = new Array(TPL);
  for (let i = 0; i < TPL; i++) {
    const p = (i / (TPL - 1)) * (t.length - 1), k = Math.floor(p), f = p - k;
    out[i] = t[k] * (1 - f) + (t[Math.min(t.length - 1, k + 1)] ?? 0) * f;
  }
  const m = mean(out), c = out.map(v => v - m), n = Math.hypot(...c);
  return n > 0 ? c.map(v => Math.round((v / n) * 1e4) / 1e4) : null;
}
/** What a reading says of its watch: { vph, rate, be, amp, a, b (the tick's and tock's shapes) }, or null. */
export function fingerprint(res) {
  if (!res?.ok || !fin(res.vph) || !fin(res.rate)) return null;
  return { vph: res.vph, rate: res.rate, be: fin(res.be) ? res.be : null, amp: fin(res.amp) ? res.amp : null, a: shapeOf(res.templates?.a), b: shapeOf(res.templates?.b) };
}
/** How alike two shapes are, -1 to 1: the best correlation within a few points of each other (a beat timed a little early or late). */
export function alike(x, y) {
  if (!x || !y || x.length !== y.length) return null;
  let best = -1;
  for (let s = -3; s <= 3; s++) {
    let sum = 0;
    for (let i = 0; i < x.length; i++) { const j = i + s; if (j >= 0 && j < y.length) sum += x[i] * y[j]; }
    best = Math.max(best, sum);
  }
  return best;
}
/** A running mean and spread (Welford's), weighing at most LEARN readings. */
function stat(s, v) {
  if (!fin(v)) return s;
  const n = Math.min(LEARN, (s?.n ?? 0) + 1), m0 = s?.m ?? v, m = m0 + (v - m0) / n;
  return { n, m, q: (s?.q ?? 0) * ((n - 1) / Math.max(1, s?.n ?? 1)) + (v - m0) * (v - m) };
}
const sd = s => (s && s.n > 1 ? Math.sqrt(s.q / (s.n - 1)) : null);
function blend(old, fresh, n) {
  if (!fresh) return old ?? null;
  if (!old) return fresh;
  const w = 1 / Math.min(LEARN, n), out = old.map((v, i) => v * (1 - w) + fresh[i] * w), len = Math.hypot(...out) || 1;
  return out.map(v => Math.round((v / len) * 1e4) / 1e4);
}
/** A watch's print with one reading more learnt into it. */
export function learn(print, fp) {
  if (!fp) return print ?? null;
  const p = print && print.vph === fp.vph ? print : { vph: fp.vph, n: 0 };
  const n = Math.min(LEARN, (p.n ?? 0) + 1);
  return { vph: fp.vph, n, rate: stat(p.rate, fp.rate), be: stat(p.be, fp.be), amp: stat(p.amp, fp.amp), a: blend(p.a, fp.a, n), b: blend(p.b, fp.b, n) };
}
/** A print as kept, made whole from JSON, or null. */
export function cleanPrint(p) {
  if (!p || !fin(p.vph) || !fin(p.n)) return null;
  const st = s => (s && fin(s.n) && fin(s.m) && fin(s.q) ? { n: s.n, m: s.m, q: Math.max(0, s.q) } : null);
  const sh = a => (Array.isArray(a) && a.length === TPL && a.every(fin) ? a : null);
  return { vph: p.vph, n: Math.max(0, Math.min(LEARN, Math.round(p.n))), rate: st(p.rate), be: st(p.be), amp: st(p.amp), a: sh(p.a), b: sh(p.b) };
}

// ---------- which watch ----------
/**
 * Which watch a reading is, from the watches ([{ id, vph (what it beats: its own, its calibre's, or null by ear),
 * quartz, print }]). Returns { ranked: [{ id, p (0 to 1), why: [words] }], sure (the first is likely and well ahead),
 * twins (two or more beat alike with nothing yet to part them) }; ranked empty when no watch beats so.
 *
 * Each watch that beats so is weighed by how far the reading stands from its print, in its own spread (or a typical
 * one while it has few readings): beat error the most, its beat's shape next, rate and amplitude least. A watch with no
 * readings yet weighs as one would that is typical; one heard by ear (no vph) beats anything, so weighs a little less.
 */
export function identify(watches, fp) {
  if (!fp) return { ranked: [], sure: false, twins: false };
  const SPREAD = { be: 0.12, rate: 6, amp: 25 };                 // a watch's own spread between readings, typically
  const rows = [];
  for (const w of watches) {
    if (w.quartz) continue;
    if (w.vph && w.vph !== fp.vph) continue;
    const pr = w.print && w.print.vph === fp.vph && w.print.n > 0 ? w.print : null, why = [];
    let chi = 0;
    const term = (key, weight, unit, digits) => {
      const s = pr?.[key], v = fp[key];
      if (!s || !fin(v)) { chi += weight; return; }                    // nothing to set it against: a typical distance
      const spread = Math.max(SPREAD[key] * (s.n > 3 ? 0.6 : 1), sd(s) ?? 0), z = (v - s.m) / spread;
      chi += weight * z * z;
      if (Math.abs(z) < 1.5) why.push(`${key === "be" ? "beat error" : key === "amp" ? "amplitude" : "rate"} ${v.toFixed(digits)} ${unit}, as its own ${s.m.toFixed(digits)}`);
    };
    term("be", 1, "ms", 1);
    term("rate", 0.25, "s/d", 1);
    term("amp", 0.25, "°", 0);
    const ca = alike(fp.a, pr?.a), cb = alike(fp.b, pr?.b), c = [ca, cb].filter(fin);
    if (c.length) {
      // the same watch's beat correlates with its print about 0.75 to 0.99 from one reading to the next (a phone held
      // a little differently), so the shape parts watches only when it's far off, and weighs less than the beat error
      const mc = mean(c), z = (1 - mc) / 0.15;
      chi += 0.5 * z * z;
      if (mc > 0.93) why.push("its beat's shape");
    } else chi += 0.5;
    const like = Math.exp(-0.5 * chi) * (w.vph ? 1 : 0.6);
    rows.push({ id: w.id, like, learnt: pr?.n ?? 0, why });
  }
  const total = rows.reduce((s, r) => s + r.like, 0);
  const ranked = rows.map(r => ({ id: r.id, p: total > 0 ? r.like / total : 1 / rows.length, why: r.why, learnt: r.learnt })).sort((a, b) => b.p - a.p);
  const sure = ranked.length > 0 && ranked[0].p >= 0.75 && (ranked.length < 2 || ranked[0].p >= 3 * ranked[1].p) && (ranked[0].learnt > 0 || ranked.length === 1);
  // beating alike and nothing learnt to part them: the page asks rather than guesses
  const twins = ranked.length > 1 && ranked.filter(r => r.learnt === 0).length >= 2 && !sure;
  return { ranked, sure, twins };
}

// ---------- how it's keeping ----------
const YEAR = 365.25 * 86400000;
export const SERVICE_YEARS = 6;                // JLC asks for one every six to eight years; others five to eight
/**
 * A watch's health from its readings and sessions (each a point in time with its rate, amplitude and beat error) and
 * its last service (an ISO date, or null). Returns { status: "good" | "watch" | "service" | "unknown", lines: [words],
 * series: { rate, amp, be: [[at, value]…] oldest first }, baseline, latest, served (years since, or null) }.
 */
export function health(w, now = Date.now()) {
  const served = w.served ? Date.parse(w.served) : NaN, since = fin(served) ? served : -Infinity;
  const points = [
    ...(w.readings || []).map(r => ({ at: r.at, rate: r.rate, amp: r.amp, be: r.be })),
    ...(w.sessions || []).map(s => {
      const steps = s.steps || [], m = k => { const v = steps.map(x => x[k]).filter(fin); return v.length ? mean(v) : null; };
      return { at: s.at, rate: m("rate"), amp: m("amp"), be: m("be") };
    }),
  ].filter(p => fin(p.at)).sort((a, b) => a.at - b.at);
  const series = k => points.filter(p => fin(p[k])).map(p => [p.at, p[k]]);
  const out = { status: "unknown", lines: [], series: { rate: series("rate"), amp: series("amp"), be: series("be") }, baseline: null, latest: null, served: fin(served) ? (now - served) / YEAR : null };
  const after = points.filter(p => p.at >= since);
  const years = out.served;
  if (years != null && years >= SERVICE_YEARS) out.lines.push(`Last serviced ${years.toFixed(1)} years ago: makers ask for one every ${SERVICE_YEARS} to 8 years.`);
  if (after.length < 4) {
    if (years != null && years >= SERVICE_YEARS) out.status = "service";
    out.lines.unshift(after.length ? "A few more readings and its baseline is set." : "No readings yet: Listen with it on the microphone.");
    return out;
  }
  // the baseline from its first readings since the service (a third of them, three at least, ten at most); the latest
  // from its last five
  const nb = Math.max(3, Math.min(10, Math.floor(after.length / 3))), base = after.slice(0, nb), late = after.slice(-Math.min(5, after.length - nb) || -1);
  const med = (list, k) => median(list.map(p => p[k]).filter(fin));
  const b = { rate: med(base, "rate"), amp: med(base, "amp"), be: med(base, "be") }, l = { rate: med(late, "rate"), amp: med(late, "amp"), be: med(late, "be") };
  out.baseline = b; out.latest = l;
  let level = 0;                                   // 0 good, 1 keep an eye on it, 2 a service
  if (fin(b.amp) && fin(l.amp)) {
    const drop = b.amp - l.amp;
    if (l.amp < 220) { level = 2; out.lines.push(`Amplitude ${Math.round(l.amp)}°, low: a healthy watch swings 260° or more flat, fully wound. Oils drying, or a mainspring tiring: a service.`); }
    else if (drop >= 30) { level = Math.max(level, drop >= 50 ? 2 : 1); out.lines.push(`Amplitude down ${Math.round(drop)}° from its ${Math.round(b.amp)}° (now ${Math.round(l.amp)}°): the usual first sign of oils drying.`); }
  }
  if (fin(l.be) && l.be >= 0.8 && (!fin(b.be) || l.be - b.be >= 0.3)) { level = Math.max(level, l.be >= 3 ? 2 : 1); out.lines.push(`Beat error ${l.be.toFixed(1)} ms${fin(b.be) ? `, from ${b.be.toFixed(1)}` : ""}: it wants putting in beat${l.be >= 3 ? ", now" : ""}.`); }
  const last = after[after.length - 1], prior = med(after.slice(-6, -1), "rate");
  if (fin(last.rate) && fin(prior) && Math.abs(last.rate - prior) >= 20) {
    level = Math.max(level, 1);
    out.lines.push(`Its last reading jumped to ${last.rate >= 0 ? "+" : "−"}${Math.abs(last.rate).toFixed(0)} s/d from about ${prior >= 0 ? "+" : "−"}${Math.abs(prior).toFixed(0)}: magnetised (a compass beside it twitches), or knocked. A watchmaker demagnetises one in seconds.`);
  } else if (fin(b.rate) && fin(l.rate) && Math.abs(l.rate - b.rate) >= 10) {
    level = Math.max(level, 1);
    out.lines.push(`Rate ${l.rate >= 0 ? "+" : "−"}${Math.abs(l.rate).toFixed(1)} s/d, from ${b.rate >= 0 ? "+" : "−"}${Math.abs(b.rate).toFixed(1)}: drifted; worth regulating.`);
  }
  if (years != null && years >= SERVICE_YEARS) level = 2;
  out.status = ["good", "watch", "service"][level];
  if (!level) out.lines.unshift(`Keeping as it did${fin(served) ? " since its service" : ""}: ${fin(l.amp) ? `≈${Math.round(l.amp)}°, ` : ""}${fin(l.be) ? `${l.be.toFixed(1)} ms, ` : ""}${l.rate >= 0 ? "+" : "−"}${Math.abs(l.rate).toFixed(1)} s/d.`);
  return out;
}
export const STATUS = { good: "Keeping well", watch: "Keep an eye on it", service: "Service due", unknown: "Not enough yet" };
