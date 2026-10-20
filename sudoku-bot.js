// Sudoku's computer player, pure: the human-style solver (sudoku-logic.js) worked through at a person's pace. Each
// step takes the time a person would need for its technique (a single takes seconds to spot, a chain minutes), longer
// when there's only one to find and shorter when there are many, with a little luck either way, all at one of three
// paces. As a rival it solves the grid on its own, and its plan says when it places each digit; as a partner in
// Together it holds its share of the givens, works out its next digit from what it can see (yours included), and
// places it when the time's up, or waits for you when it's stuck.
import { stateOf, nextStep, apply, solved } from "./sudoku-logic.js";
import { rng, mix, POP, bit } from "./sudoku-grid.js";

export const PACES = {
  steady: { label: "Steady", note: "a newspaper solver", factor: 1.6 },
  keen: { label: "Keen", note: "a regular", factor: 1 },
  sharp: { label: "Sharp", note: "a competition solver", factor: 0.55 },
};
/** Seconds a keen solver spends on a step, by technique. */
export const THINK = {
  full: 3, hidden: 8, naked: 12, cage: 2.5,
  locked: 25, cageline: 18, pair: 35, hpair: 40, rule45: 35, triple: 50, htriple: 55,
  xwing: 70, short: 80, ywing: 80, xyzwing: 90, wwing: 95, swordfish: 100, colour: 100, quad: 110, hquad: 120, rule45b: 90, jellyfish: 130,
  xchain: 150, xychain: 160,
};
const SINGLES = new Set(["full", "hidden", "naked"]);

/** How many cells a single would settle now: the more there are, the sooner a person spots one. */
export function singlesOpen(shape, st) {
  const open = new Set();
  for (let c = 0; c < shape.cells; c++) if (!st.val[c] && POP[st.cand[c]] === 1) open.add(c);
  for (const cs of shape.units) {
    let have = 0;
    for (const c of cs) if (st.val[c]) have |= bit(st.val[c]);
    for (let d = 1; d <= shape.n; d++) {
      if (have & bit(d)) continue;
      let at = -1, k = 0;
      for (const c of cs) if (!st.val[c] && (st.cand[c] & bit(d))) { k++; at = c; }
      if (k === 1) open.add(at);
    }
  }
  return open.size;
}
/** How long a step takes (ms) at a pace: its technique's time, the choice there was for a single, and luck (r). */
export function thinkMs(step, pace, r, choices = 1) {
  let s = THINK[step.tech] ?? 60;
  if (SINGLES.has(step.tech)) s *= 0.45 + 2.2 / (1 + choices);
  return Math.round(s * (PACES[pace]?.factor ?? 1) * (0.7 + 0.6 * r()) * 1000);
}

/**
 * A rival's race: when, solving this grid alone, it places each digit: [{ at, cell, digit }] (at: ms from the start).
 * Pencilling in candidates is part of a hard grid: the first step beyond singles costs a second a cell still empty.
 */
export function racePlan(shape, givens, pace, seed) {
  const r = rng(mix(seed, "race", pace)), st = stateOf(shape, givens), ctx = { memo: new Map() }, out = [];
  let at = 0, pencilled = false;
  for (let k = 0; k < 2000 && !solved(st); k++) {
    const step = nextStep(shape, st, { ctx });
    if (!step) break;
    if (!pencilled && step.rank > 1) { pencilled = true; at += [...st.val].filter(v => !v).length * 1000 * (PACES[pace]?.factor ?? 1); }
    at += thinkMs(step, pace, r, SINGLES.has(step.tech) ? singlesOpen(shape, st) : 1);
    apply(shape, st, step);
    if (step.place) out.push({ at: Math.round(at), cell: step.place[0], digit: step.place[1] });
  }
  return out;
}
/** How many of a race plan's digits are in by this time. */
export const placedBy = (plan, ms) => { let k = 0; while (k < plan.length && plan[k].at <= ms) k++; return k; };

/**
 * A partner's next digit, from what it sees (its own givens and everything placed, as a grid of digits): { cell,
 * digit, ms }, ms how long finding it takes (the steps on the way to it included), or null when what it sees isn't
 * enough. `free(cell)`: whether it may write there (not someone's given, not filled).
 */
export function partnerMove(shape, values, pace, r, free) {
  const st = stateOf(shape, values), ctx = { memo: new Map() };
  let ms = 0;
  for (let k = 0; k < 600 && !solved(st); k++) {
    const step = nextStep(shape, st, { ctx });
    if (!step) return null;
    ms += thinkMs(step, pace, r, SINGLES.has(step.tech) ? singlesOpen(shape, st) : 1);
    apply(shape, st, step);
    if (step.place && free(step.place[0])) return { cell: step.place[0], digit: step.place[1], ms };
  }
  return null;
}
