// The Wine course's building blocks (wine-basics.js, wine-regions.js, wine-labels.js, wine-service.js write the chapters with them):
// S a short lesson step (words, with an optional card of facts under them), Q a question of the course's own (right answer first, then
// three wrong ones as plausible as it), B a question of the wine bank (wine-bank.js, which Punt's Wine level also draws on).
// wine-lessons.js turns them into the course sheet's steps and seats each right answer by a hash of the step's id.

/** A step of words; rows [[name, what]] show as a card of facts on the stage while it is read. */
export const S = (say, head = null, rows = null) => ({ say, ...(rows ? { card: { head, rows } } : {}) });
/** A question of the course's own: Q(question, right, [three wrong], why). */
export const Q = (q, right, wrong, why) => ({ q, o: [right, ...wrong], why });
/** A question from the wine bank, by its id (WN-001). */
export const B = id => ({ bank: id });
/** A chapter's lesson: tone is the glass drawn on the stage (red, white, rose, gold, fizz); steps are S, Q and B in order. */
export const lesson = (id, title, tone, steps) => ({ id, title, tone, steps });
/** A chapter's test: only questions. */
export const test = (id, title, tone, steps) => ({ id, title, tone, test: true, steps });

/** A small stable number for a string (FNV-1a), to seat a right answer the same way every time. */
export function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
