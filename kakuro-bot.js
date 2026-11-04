// Tally's computer player, pure: the human-style solver (kakuro-logic.js) worked through at a person's pace. Each
// step takes the time a person needs for its technique (a crossing is seen in seconds, the ways a long run can fit
// take a minute, a chain longer), less when there are many cells to place at a glance and more with one, with a
// little luck either way, all at one of three paces. As a partner (Together) it sees only its share of the clues, works out its next digit from
// them and everything placed (yours included), and places it when its time is up, or waits for you when it's stuck.
import { stateOf, nextStep, apply, solved } from "./kakuro-logic.js";
import { POP } from "./kakuro-grid.js";

export const PACES = {
  steady: { label: "Steady", note: "a newspaper solver", factor: 1.6 },
  keen: { label: "Keen", note: "a regular", factor: 1 },
  sharp: { label: "Sharp", note: "a competition solver", factor: 0.55 },
};
/** Seconds a keen solver spends on a step, by technique (more for a longer run, or a longer chain). */
export function thinkSeconds(step, view) {
  const len = step.runs?.length ? view.shape.runs[step.runs[0]].cells.length : 2;
  switch (step.tech) {
    case "last": return 2.5 + 0.8 * len;                    // adding up what's there
    case "single": return 7;
    case "hidden": return 11;
    case "fit": return 14 + 6 * len;                        // the ways a run can be, against what its cells can hold
    case "area": return 95;
    case "chain": return 55 + 12 * (step.length || 4);
    default: return 30;
  }
}
const GLANCE = new Set(["last", "single"]);
/** How many cells could be placed at a glance now: the more there are, the sooner a person spots one. */
export function openCells(view, st) {
  let n = 0;
  for (const c of view.shape.white) if (!st.val[c] && POP[st.cand[c]] === 1) n++;
  return n;
}
/** How long a step takes (ms) at a pace: its technique's time, the choice there was for a glance, and luck (r). */
export function thinkMs(step, view, pace, r, choices = 1) {
  let s = thinkSeconds(step, view);
  if (GLANCE.has(step.tech)) s *= 0.45 + 2.2 / (1 + choices);
  return Math.round(s * (PACES[pace]?.factor ?? 1) * (0.7 + 0.6 * r()) * 1000);
}

/**
 * A partner's next digit, from what it sees (its view of the clues, and everything placed, by cell): { cell, digit,
 * ms }, ms how long finding it takes (the steps on the way to it included), or null when what it sees isn't enough.
 * `free(cell)`: whether it may write there (nothing in it yet).
 */
export function partnerMove(view, values, pace, r, free) {
  const st = stateOf(view, values);
  let ms = 0;
  for (let k = 0; k < 800 && !solved(view, st); k++) {
    const step = nextStep(view, st);
    if (!step) return null;
    ms += thinkMs(step, view, pace, r, GLANCE.has(step.tech) ? openCells(view, st) : 1);
    apply(view, st, step);
    if (step.place && free(step.place[0])) return { cell: step.place[0], digit: step.place[1], ms };
  }
  return null;
}
