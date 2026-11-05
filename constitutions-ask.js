// The Constitutions and institutions course's building blocks (constitutions-c1.js to constitutions-c6.js write the chapters with them):
//   S   a short step of words, with an optional card of terms: S(say, [head, [[term, meaning], ...]]);
//   R   read a source: R(say, head, quoted words, who/where); public-domain or official texts, a line or two;
//   Q   a question: right answer first, then three wrong ones as long and plausible as it (constitutions-lessons.js seats it);
//   O   put the steps in order: O(question, items in their right order, why); the stage shuffles them;
//   L   a lesson: L(id, title, reg, nonWestern, steps); reg is "west" (its subject is Europe or the US), "world" or "mixed";
//       nonWestern names the case from outside the West that the lesson carries (the test looks for it in the words);
//   CH  a chapter: CH(id, title, span, reading [[who, what]], lessons).

export const S = (say, card = null) => ({ say, ...(card ? { card: { head: card[0], rows: card[1] } } : {}) });
export const R = (say, head, text, by) => ({ say, src: { head, text, by } });
export const Q = (q, right, wrong, why) => ({ q, o: [right, ...wrong], why });
export const O = (q, items, why) => ({ ord: { q, items, why } });
export const L = (id, title, reg, nw, steps) => ({ id, title, reg, nw, steps });
export const CH = (id, title, span, reading, lessons) => ({ id, title, span, reading, lessons });

/** A small stable number for a string (FNV-1a), to seat a right answer the same way every time. */
export function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
