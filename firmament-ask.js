// Firmament's building blocks (firmament-c1.js … write the chapters with them): S a step of words, Q a question of the course's own (right
// answer first, then three wrong ones as plausible as it), N a question whose right answer is a number worked out in firmament-calc.js
// (tests/firmament.mjs recomputes every one of them from its own formulas), lesson(), and the number formatter.
// firmament-lessons.js turns them into the course sheet's steps and seats each right answer by a hash of the step's id.

/** A step of words; `fig` (if any) is drawn on the stage while it is read, instead of the lesson's own figure. */
export const S = (say, fig = null) => ({ say, ...(fig ? { fig } : {}) });
/** A question of the course's own: Q(question, right, [three wrong], why, fig?). */
export const Q = (q, right, wrong, why, fig = null) => ({ q, o: [right, ...wrong], why, ...(fig ? { fig } : {}) });
/**
 * A question about a number the course works out: N(id, question, value, fmt, [three wrong values], why, fig?). The right option is
 * fmt(value); a wrong value is a number (formatted the same way) or a string. `id` ties it to the test's own recomputation.
 */
export const N = (id, q, value, fmt, wrong, why, fig = null) => ({ q, o: [fmt(value), ...wrong.map(w => (typeof w === "number" ? fmt(w) : w))], why, calc: { id, value }, ...(fig ? { fig } : {}) });
/** A lesson: `when` is the date line under its title, `fig` the figure the stage draws unless a step has its own, steps are S, Q and N in order. */
export const lesson = (id, title, when, fig, steps) => ({ id, title, when, fig, steps });

/** 12345.6 → "12,345.6" with d decimals; the same on every machine (no locale tables). */
export function num(n, d = 0) {
  const s = Math.abs(n).toFixed(d), [i, f] = s.split(".");
  return (n < 0 ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? `.${f}` : "");
}
/** A formatter for N: number of decimals, then a unit written after the number. */
export const fmt = (d = 0, unit = "") => n => `${num(n, d)}${unit ? ` ${unit}` : ""}`;

/** A small stable number for a string (FNV-1a), to seat a right answer the same way every time. */
export function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
