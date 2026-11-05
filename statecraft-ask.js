// The Statecraft course's building blocks (statecraft-c1.js to statecraft-c5.js write the chapters with them):
//   S    a short step of words, with an optional card of terms or facts (or its own map);
//   SRC  words over a short quotation from a primary source in a public-domain translation, with who, what and which translation;
//   Q    a question: right answer first, then three wrong ones as long and as plausible as it (statecraft-lessons.js seats it);
//        o.k names its style: "reading" (pick the defensible reading), "myth" (myth or fact), "long" (how long, in brackets), "constraint"
//        (the case studies' constraint questions), "source" (read a source), "plain";
//   T    "tap the place": the prompt, the right place and three others, all marked on the map by name;
//   O    "put in order": items listed in their right order (the course shuffles them, without dates);
//   M    "match": pairs [left, right]; the right-hand sides are the choices for every left;
//   L    a lesson: its map (view = [west, south, east, north] in degrees, pts = place ids, routes = lines through place ids) or a card of terms;
//        o.w = 1 when the lesson's subject is Europe or the United States (tests/statecraft.mjs keeps these to a quarter of the course),
//        o.eight = the case's eight questions as [label, text] rows (a case lesson);
//   CH   a chapter: its place in time, a reading list of [who, what].
// A step carries w: 0 or 1 to override its lesson's tag, and dated: "as of 5 November 2026 (source)" when its words state a perishable fact.
export { hash } from "./trade-ask.js";

export const S = (say, o = {}) => ({ say, ...o });
export const SRC = (say, head, text, o = {}) => ({ say, card: { head, quote: text }, source: true, ...o });
export const Q = (q, right, wrong, why, o = {}) => ({ q, o: [right, ...wrong], why, ...o });
export const T = (q, target, decoys, why, o = {}) => ({ q, tap: { target, decoys }, why, ...o });
export const O = (q, order, why, o = {}) => ({ q, order, why, ...o });
export const M = (q, match, why, o = {}) => ({ q, match, why, ...o });
/** A kit step (lesson-kit.js): pair, order, bins, tf, reveal, explore, slider, decide, toggle or build, with its fields; `fig` (lesson-figs.js) beside any step. */
export const K = (kit, say, fields, why, o = {}) => ({ kit, say, why, ...fields, ...o });
export const L =(id, title, view, pts, steps, o = {}) => ({ id, title, view, pts, steps, ...o });
export const CH = (id, title, span, reading, lessons) => ({ id, title, span, reading, lessons });

/** The eight questions asked of every case (outline, section 10), in the order a case card answers them. */
export const EIGHT = ["The problem", "What constrained", "The options", "What was chosen", "Institutions that mattered", "What was luck", "The outcome", "What historians dispute"];
/** A case's eight answers, in the order of EIGHT, as the rows of its card. */
export const E = (...answers) => EIGHT.map((label, i) => [label, answers[i]]);
