// Avalanche's first three days as a lesson (pure, no page: the tests run it in Node). The real game on a slope laid out by
// hand, one idea a day: that one charge can set off a whole cluster and the points go with the square of its size; that a
// charge on each of two loaded stretches carries the square between them along as a bridge, and a bridge counts more; and
// that what a night can bury the road with is what is full near the foot, which is cleared by firing it first. A day is done
// by doing it (`ready` says when Fire may be pressed, `hint` what is missing), and what happened is told in a line (`told`).
// A game in the lesson carries `lesson` (the day, 0 to 2) and, once its day is fired, `told` (so the page waits on Next);
// both are saved with the game, so a reload or a partner's watch finds the lesson where it is.
import { W, H, BURY, newGame, foresee, danger, worth } from "./avalanche-engine.js";

const at = (x, y) => y * W + x;
/** A slope drawn by hand: rows of digits from the top, a dot for bare. */
const slope = rows => { const c = new Array(W * H).fill(0); rows.forEach((r, y) => [...r].forEach((ch, x) => { c[at(x, y)] = ch === "." ? 0 : Number(ch); })); return c; };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const fmt = n => n.toLocaleString("en-GB");

export const LESSONS = [
  { // one full square next to two more: any charge on them sets the three off as one avalanche
    cells: slope([".......", ".1.....", "..333..", "1...1..", ".......", "..1....", ".......", "......."]),
    chalets: [at(0, 0), at(6, 1)],
    night: [],
    start: "Lesson 1 of 3. Three full squares touch. Press one to lay a charge, then Fire.",
    hint: "Lay a charge on one of the three full squares (they're cracked), then Fire.",
    ready: g => foresee(g).slide.size >= 3,
    told: f => `One charge, ${plural(f.slide.size, "slide")}: 10 × ${f.slide.size}² = ${fmt(f.gain)}. A square sliding alone scores ${worth(1)}. Size counts squared.`,
  },
  { // two loaded stretches with a square one layer short between them: a charge on each, and the gap is carried along
    cells: slope([".......", "..1....", "...1...", "33233.1", ".......", "1......", ".......", "......."]),
    chalets: [at(6, 0), at(0, 1)],
    night: [],
    start: "Lesson 2 of 3. Two full stretches, a gap between. Charge one square of each, then Fire.",
    hint: "Lay one charge on a full square of each stretch (Undo any other): both slide into the gap and carry it along.",
    ready: g => foresee(g).relays.length >= 1,
    told: (f, before) => `${plural(f.slide.size, "slide")} and a bridge (the gap, a dot) count ${f.reach}: 10 × ${f.reach}² = ${fmt(f.gain)}. One stretch alone: ${fmt(foresee(before, before.plan.slice(0, 1)).gain)}.`,
  },
  { // a block of full squares at the foot: the night would bury the road, so clear them first
    cells: slope([".1.....", "....1..", ".......", "1......", "..1.1..", "...3...", "..333..", "..333.."]),
    chalets: [at(0, 0), at(6, 2)],
    night: [at(3, 7), at(2, 6)],                       // the night's two layers fall on squares that were hatched
    start: "Lesson 3 of 3. Hatched squares would bury the road tonight. Charge the full block at the foot, then Fire.",
    hint: "Hatching shows where one layer of snow would bury the road. Charge the full block at the foot: it slides first, onto the closed road.",
    ready: g => g.plan.length >= 1 && danger(g).length === 0,
    told: f => `The block went first, onto the closed road, and scored ${fmt(f.gain)}. ${f.night.some(n => n.slide) ? `Tonight's snow set off a small slide: ${plural(f.road, "layer")} reached the road, short of the ${BURY} that bury it` : "Tonight's snow fell on the hatched squares and nothing happened"}.`,
  },
];
export const LESSON_DAYS = LESSONS.length;

/** A game on the lesson's day k (0 to 2), carrying the score so far. No wind, nothing rocky. */
export function lessonGame(k, score = 0) {
  const L = LESSONS[k];
  return { ...newGame(7 + k), cells: L.cells.slice(), plan: [], chalets: L.chalets.slice(), wind: 0, days: 0, lives: 3, score, over: false, lesson: k };
}
/** The lesson's day in hand (0 to 2), or null in an ordinary game. */
export const lessonOf = g => (Number.isInteger(g?.lesson) && g.lesson >= 0 && g.lesson < LESSON_DAYS ? g.lesson : null);
/** The squares the night's layers land on in the lesson's day k (scripted, so it plays the same for everyone). */
export const nightOf = k => LESSONS[k].night.slice();
/** Whether the day's charges are the ones the lesson wants: Fire waits for it. */
export const ready = g => { const k = lessonOf(g); return k != null && !g.told && LESSONS[k].ready(g); };
/** The line for the day's instruction: what to do, or, with charges laid that aren't it yet, what is missing. */
export const instruction = g => { const k = lessonOf(g); return g.plan.length && !ready(g) ? LESSONS[k].hint : LESSONS[k].start; };
/** What happened when the day was fired, told: `before` is the game before Fire, `result` what `fire` returned. */
export const told = (before, result) => LESSONS[lessonOf(before)].told(result, before);
