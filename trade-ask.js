// The History of trade course's building blocks (trade-c1.js to trade-c5.js write the chapters with them):
//   S   a short step of words, with an optional picture, card of facts, power card (kb/'s merchant-power) or its own map;
//   Q   a question of the course's own: right answer first, then three wrong ones as plausible as it (trade-lessons.js seats it);
//   T   "tap the place": the prompt, the right place and three others, all marked on the map by name;
//   L   a lesson: its map (view = [west, south, east, north] in degrees, pts = place ids, routes = lines through place ids);
//   CH  a chapter: its place in time, who acts in it (eur: "none" | "mixed"), a reading list of [who, what].
// A place id is one of trade-places.js (OWN) or trade-kb.js (a copy of kb/'s trade-place, trade-history and geo-place rows).

export const S = (say, o = {}) => ({ say, ...o });
export const Q = (q, right, wrong, why, o = {}) => ({ q, o: [right, ...wrong], why, ...o });
export const T = (q, target, decoys, why, o = {}) => ({ q, tap: { target, decoys }, why, ...o });
export const L = (id, title, view, pts, steps, o = {}) => ({ id, title, view, pts, steps, ...o });
export const CH = (id, title, span, eur, reading, lessons) => ({ id, title, span, eur, reading, lessons });

/** A small stable number for a string (FNV-1a), to seat a right answer the same way every time. */
export function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
