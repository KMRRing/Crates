// Speed maths and Fuel maths (README, Speed maths): the toolkit both tiles share, with no page in it so tests/speedmaths.mjs
// runs it in Node. The seeded generator, the numbers as a person types and reads them, the steps of a chain and how they
// fold into an answer, and the one rule that says whether a typed answer is right.
//
// The rule (Korbi, 2 November 2026: "typed estimates accepted to one or two significant figures depending on the
// calculation"). A significant figure (s.f.) is a digit that carries the size of a number: 4,031 to 2 s.f. is 4,000 and
// 0.0137 to 1 s.f. is 0.01. An answer asked for to n s.f. is accepted when it is
//   - within a relative error of the exact figure: 5% for 1 s.f., 1% for 2 s.f. (a problem may widen its own, as a long
//     chain does), because a mental estimate is judged by how far out it is, and rounding alone has cliffs (14.9 and 15.1
//     round to 10 and 20 at 1 s.f. though they differ by 1%); or
//   - exactly the exact figure rounded to n s.f., the answer the words "to 2 s.f." ask for, which can be further out than
//     the band when the exact figure starts with a 1 (to 1 s.f., 1.4 is 1, 29% out).
// A plain sum is exact. The page says when an answer was close enough, and shows the exact figure after either way.

// ---------- randomness that is the same on every device ----------
/** A seeded generator (mulberry32): integer arithmetic only, so every phone deals the same sums from a seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A 32-bit number from any parts, so the i-th sum of a run is its own stream: a pure function of the seed and i. */
export function hashParts(...parts) {
  let h = 2166136261;
  for (const ch of parts.join("/")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** An integer from lo to hi, both included. */
export const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
export const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

// ---------- numbers as typed and as read ----------
/** x to n significant figures. */
export function roundSf(x, n) {
  if (!x || !Number.isFinite(x)) return x;
  const a = Math.abs(x);
  let e = Math.floor(Math.log10(a));
  if (10 ** (e + 1) <= a) e++; else if (10 ** e > a) e--;        // log10 of an exact power of ten can land either side
  const k = n - 1 - e;                                           // decimals to keep (negative: digits to zero)
  const r = k >= 0 ? Math.round(a * 10 ** k) / 10 ** k : Math.round(a / 10 ** -k) * 10 ** -k;
  return Math.sign(x) * r;
}
/** Two numbers equal to within float noise. */
export const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/** What a person has typed, as a number; NaN for nothing or for text that is not one. Commas are taken out, "−" is a minus. */
export function parseTyped(text) {
  const s = String(text ?? "").replace(/[\s,]/g, "").replace(/−/g, "-");
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}
/** Digits in threes: "4031000" → "4,031,000"; the decimals are left alone. */
export const group = int => int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** A figure as written in a statement: 7.45, 3.785, 1,200 (grouped from a thousand), a true minus. */
export function fmtNum(x) {
  if (!Number.isFinite(x)) return "?";
  const [i, d] = String(Number(Math.abs(x).toPrecision(12))).split(".");
  return `${x < 0 ? "−" : ""}${Math.abs(x) >= 1000 ? group(i) : i}${d ? `.${d}` : ""}`;
}
/** An exact answer as shown after: whole above a thousand, else four significant figures. */
export function fmtAnswer(x) {
  return Math.abs(x) >= 1000 ? fmtNum(Math.round(x)) : fmtNum(Number(x.toPrecision(4)));
}
/** What is being typed, grouped as it goes ("4031" → "4,031", "1234.5" → "1,234.5"), with a true minus. */
export function fmtTyped(text) {
  const m = /^(-?)(\d*)(\.?\d*)$/.exec(String(text));
  return m ? `${m[1] ? "−" : ""}${group(m[2])}${m[3]}` : String(text);
}
/** How far out, as a person says it: "0.8%", "16%", "a zero out". */
export function fmtOff(off) {
  if (off < 0.001) return "under 0.1%";
  if (off < 0.1) return `${(off * 100).toFixed(1)}%`;
  if (off < 10) return `${Math.round(off * 100)}%`;
  return "more than ten times out";
}
/** A slip of the decimal point: the typed figure is the exact one times or over a power of ten. 1 = a zero too many. */
export function slipOf(typed, exact) {
  if (!typed || !exact || typed * exact < 0) return 0;
  const k = Math.log10(Math.abs(typed / exact));
  return Math.abs(k - Math.round(k)) < 0.02 && Math.round(k) !== 0 ? Math.round(k) : 0;
}

// ---------- the one rule ----------
/** Relative error accepted besides the exactly rounded figure, by significant figures asked for. */
export const BAND = { 1: 0.05, 2: 0.01 };
/**
 * A chain's own band: its steps pile up the error of an honest shortcut (7.45 for 7.4505, 30 for 30.4 days), so a longer
 * chain is let off a little more, by half a band's width for each step beyond the third.
 */
export const chainRel = (sf, steps) => BAND[sf] * (1 + 0.5 * Math.max(0, steps - 3));
/**
 * Whether a typed answer is right for a problem ({ answer, sf (0 exact, 1 or 2), rel? }), and how: grade "exact" (the
 * figure itself, to four significant figures for an estimate), "close" (accepted by the rule above), "wrong", or "none"
 * (nothing typed). off is the relative error.
 */
export function judge(p, text) {
  const x = typeof text === "number" ? text : parseTyped(text);
  if (!Number.isFinite(x)) return { grade: "none", ok: false, x: NaN, off: null };
  const t = p.answer, off = t === 0 ? Math.abs(x) : Math.abs(x - t) / Math.abs(t);
  if (!p.sf) { const ok = near(x, t); return { grade: ok ? "exact" : "wrong", ok, x, off }; }
  if (near(x, roundSf(t, 4))) return { grade: "exact", ok: true, x, off };
  const ok = off <= (p.rel ?? BAND[p.sf]) + 1e-12 || near(x, roundSf(t, p.sf));
  return { grade: ok ? "close" : "wrong", ok, x, off };
}
/** What a problem asks, in words: "exact", or "to 2 s.f., within 1%". */
export function askText(p) {
  if (!p.sf) return "exact";
  const rel = p.rel ?? BAND[p.sf];
  return `to ${p.sf} s.f., within ${Number((rel * 100).toFixed(1))}%`;
}

// ---------- the steps of a chain ----------
// A chain is a figure and the steps worked on it in a trader's order, each followed by the unit it leaves. A step is
// { op, n, unit?, to, say? }: what it does, the figure it does it with, what that figure is a figure of, the unit that
// results, and (for a step that folds several figures into one) its own words. The words and the arithmetic come from
// the same step, so they cannot drift apart.
export const APPLY = {
  "×": (v, n) => v * n,
  "÷": (v, n) => v / n,
  "+": (v, n) => v + n,
  "−": (v, n) => v - n,
  "%": (v, n) => v * n / 100,                 // n% of it
  "+%": (v, n) => v * (1 + n / 100),          // and n% on top
  "−%": (v, n) => v * (1 - n / 100),     // less n%
};
export const mul = (n, unit, to, say) => ({ op: "×", n, unit, to, say });
export const div = (n, unit, to, say) => ({ op: "÷", n, unit, to, say });
export const plus = (n, unit, to, say) => ({ op: "+", n, unit, to, say });
export const minus = (n, unit, to, say) => ({ op: "−", n, unit, to, say });
export const pct = (n, to, say) => ({ op: "%", n, to, say });
export const addPct = (n, to, say) => ({ op: "+%", n, to, say });
export const lessPct = (n, to, say) => ({ op: "−%", n, to, say });

/** A step as the statement shows it: "× 30 days a month", "less 15%", "5% of that". */
export function stepText(s) {
  if (s.say) return s.say;
  const w = s.unit ? ` ${s.unit}` : "";
  switch (s.op) {
    case "%": return `${fmtNum(s.n)}% of that`;
    case "+%": return `add ${fmtNum(s.n)}%`;
    case "−%": return `less ${fmtNum(s.n)}%`;
    default: return `${s.op} ${fmtNum(s.n)}${w}`;
  }
}
/** The figure after each step: [v1, v2, …]. */
export function values(start, steps) {
  const out = [];
  let v = start;
  for (const s of steps) out.push(v = APPLY[s.op](v, s.n));
  return out;
}
/** The working, a line a step: "× 30 days a month = 13,500 thousand barrels a month". */
export const workingOf = p => p.steps.map(s => `${stepText(s)} = ${fmtAnswer(s.value)} ${s.to}`);

/** One draw from each of a chain's figures ({ name: [options] }); an option may be an object of figures. */
export function drawFigs(figs, r) {
  const out = {};
  for (const [k, options] of Object.entries(figs)) out[k] = pick(r, options);
  return out;
}
/**
 * A problem from a chain definition and the figures drawn: { kind "chain", id, name, topic, sf, rel, start { v, say },
 * steps (each with its value), answer, unit, worth, n }. null if the answer is not one a person can type (under 1, or over
 * a hundred million), so the dealer draws again.
 */
export function chainProblem(def, figs) {
  const built = def.build(figs), vals = values(built.start.v, built.steps);
  const steps = built.steps.map((s, i) => ({ ...s, value: vals[i] }));
  const answer = vals[vals.length - 1];
  if (!Number.isFinite(answer) || Math.abs(answer) < 1 || Math.abs(answer) >= 1e8) return null;
  if (vals.some(v => !Number.isFinite(v) || v === 0)) return null;
  const n = steps.length;
  return {
    kind: "chain", id: def.id, name: def.name, topic: def.topic, sf: def.sf, rel: def.rel ?? chainRel(def.sf, n),
    start: built.start, steps, answer, unit: steps[n - 1].to, n,
    worth: 2 * n + (def.sf === 2 ? 1 : 0),
  };
}
