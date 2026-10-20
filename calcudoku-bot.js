// Calcudoku's computer player, pure: the human-style solver (calcudoku-logic.js) worked through at a person's pace.
// Each step takes the time a person needs for its technique (a single takes seconds to spot, a contradiction minutes),
// a cage's arithmetic the longer the more ways there are to weigh, a single the quicker the more there are on offer,
// with a little luck either way, all at one of three paces. As a rival it solves the grid on its own, and its plan
// says when it places each digit; as a partner it holds its share of the clues, works out its next digit from what it
// can see (your digits included), and places it when the time's up, or waits for you when it's stuck.
import { stateOf, nextStep, apply, solved, freshCtx } from "./calcudoku-logic.js";
import { rng, mix, POP, bit } from "./calcudoku-grid.js";

export const PACES = {
  steady: { label: "Steady", note: "a newspaper solver", factor: 1.6 },
  keen: { label: "Keen", note: "a regular", factor: 1 },
  sharp: { label: "Sharp", note: "a competition solver", factor: 0.55 },
};
/** Seconds a keen solver spends on a step, by technique (a cage's and a contradiction's grow with their work). */
export const THINK = {
  single: 1, full: 1.5, hidden: 4, naked: 5, cage: 2.5,
  cageline: 12, linecage: 15, pair: 18, hpair: 22, linesum: 28, triple: 30, htriple: 35,
  xwing: 45, ywing: 50, linesum2: 55, swordfish: 65, quad: 70, hquad: 80,
  forcing: 90,
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
      for (const c of cs) if (!st.val[c] && st.cand[c] & bit(d)) { k++; at = c; }
      if (k === 1) open.add(at);
    }
  }
  return open.size;
}
/** How long a step takes (ms) at a pace: its technique's time, the choice there was for a single, the work in a
 *  cage's ways or a contradiction's chain, and luck (r). */
export function thinkMs(step, pace, r, choices = 1) {
  let s = THINK[step.tech] ?? 60;
  if (SINGLES.has(step.tech)) s *= 0.45 + 2.2 / (1 + choices);
  if (step.tech === "cage") s += Math.log2(1 + (step.alive || 1));
  if (step.tech === "forcing") s += 8 * (step.cells?.length || 1);
  return Math.round(s * (PACES[pace]?.factor ?? 1) * (0.7 + 0.6 * r()) * 1000);
}

/**
 * A rival's race: when, solving this grid alone, it places each digit: [{ at, cell, digit }] (at: ms from the start).
 * Pencilling in what each cage allows is part of a harder grid: the first step beyond the plainest costs a second a
 * cell still empty.
 */
export function racePlan(view, pace, seed) {
  const r = rng(mix(seed, "race", pace)), st = stateOf(view, new Uint8Array(view.shape.cells)), ctx = freshCtx(), out = [];
  let at = 0, pencilled = false;
  for (let k = 0; k < 3000 && !solved(st); k++) {
    const step = nextStep(view, st, { ctx });
    if (!step) break;
    if (!pencilled && step.rank > 1) { pencilled = true; at += [...st.val].filter(v => !v).length * 1000 * (PACES[pace]?.factor ?? 1); }
    at += thinkMs(step, pace, r, SINGLES.has(step.tech) ? singlesOpen(view.shape, st) : 1);
    apply(view, st, step);
    if (step.place) out.push({ at: Math.round(at), cell: step.place[0], digit: step.place[1] });
  }
  return out;
}
/** How many of a race plan's digits are in by this time. */
export const placedBy = (plan, ms) => { let k = 0; while (k < plan.length && plan[k].at <= ms) k++; return k; };

/**
 * A partner's next digit, from what it sees (its own share of the clues and every digit placed): { cell, digit, ms },
 * ms how long finding it takes (the steps on the way to it included), or null when what it sees isn't enough.
 * `free(cell)`: whether it may write there (nobody's digit in it yet).
 */
export function partnerMove(view, values, pace, r, free) {
  const st = stateOf(view, values), ctx = freshCtx();
  let ms = 0;
  for (let k = 0; k < 900 && !solved(st); k++) {
    const step = nextStep(view, st, { ctx });
    if (!step) return null;
    ms += thinkMs(step, pace, r, SINGLES.has(step.tech) ? singlesOpen(view.shape, st) : 1);
    apply(view, st, step);
    if (step.place && free(step.place[0])) return { cell: step.place[0], digit: step.place[1], ms };
  }
  return null;
}
