// The Maths course: GCSE (a UK 16-year-old's level) up through IB Higher Level to first-year university. The chapters live in
// maths-ch*.js, written with maths-kit.js, drawn by maths-stage.js on the shared course sheet (course.js).
import { NUMBER } from "./maths-ch1.js";
import { ALGEBRA, FUNCTIONS } from "./maths-ch2.js";
import { GEOMETRY, TRIG } from "./maths-ch3.js";
import { FURTHER, DIFF, INTEGRATION } from "./maths-ch4.js";
import { SERIES, LINALG } from "./maths-ch5.js";
import { PROB, DISCRETE, DE } from "./maths-ch6.js";
import { MULTI, practiceOf } from "./maths-ch7.js";
import { COURSE as ODDS_COURSE } from "./odds-course.js";
import { progressOf } from "./course.js";

/** The level each chapter is pitched at, shown on the landing. */
export const LEVELS = { number: "GCSE", algebra: "GCSE to SL", functions: "SL", geometry: "GCSE to SL", trig: "SL to HL", further: "HL", diff: "SL to HL", integration: "SL to HL", series: "HL to Uni", linalg: "HL to Uni", prob: "SL to HL", discrete: "HL to Uni", de: "HL to Uni", multi: "Uni" };

export const COURSE = {
  title: "Maths",
  zh: "",
  // Each chapter ends with a Practice lesson of Punt's bank questions.
  chapters: [NUMBER, ALGEBRA, FUNCTIONS, GEOMETRY, TRIG, FURTHER, DIFF, INTEGRATION, SERIES, LINALG, PROB, DISCRETE, DE, MULTI].map(c => ({ ...c, lessons: [...c.lessons, practiceOf(c.id)] })),
};

export { ODDS_COURSE };

/** The two parts in the order you take them. The last, Odds and judgement (docs/maths.md), has its own sheet and keeps its
 *  progress where the Odds tile always did (`odds:course`, with `odds:calib` and `odds:ranges`), so nothing anyone did
 *  there needs moving. `id` is the progress key's prefix. */
export const PARTS = [{ id: "maths", course: COURSE }, { id: "odds", course: ODDS_COURSE }];

/** How far through all of Maths, both parts: { done, of, next: { part, chapter, lesson, index } | null }. Reads localStorage. */
export function progressAll() {
  const ps = PARTS.map(p => ({ part: p.id, ...progressOf(p.id, p.course) })), next = ps.find(p => p.next);
  return { done: ps.reduce((n, p) => n + p.done, 0), of: ps.reduce((n, p) => n + p.of, 0), next: next ? { part: next.part, ...next.next } : null };
}
