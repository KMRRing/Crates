// Nonogram's computer player, pure (no page): it solves the way the hints do (nonogram-engine.js, nextStep), the
// simplest rule first, from what is on the grid, and it is paced like a person: a while to see each step, longer for a
// harder rule, then a moment for each cell it fills or crosses out. In a split game it reads only its own lines' clues
// and works from the grid you share, so it waits on you when its lines say no more, as a partner would. Played against,
// it solves its own copy of the same puzzle. tests/nonogram.mjs checks it.
import { nextStep, knownFrom, unknownState, isKnown } from "./nonogram-engine.js";

/** How quickly it sees and draws, in ms: a step by the simple rules, by the complete line logic, by a contradiction; a
 *  cell filled; a cell crossed out (quicker: a swipe). */
export const PACES = {
  easy: { label: "Easy", simple: 5200, line: 12000, contradiction: 30000, fill: 700, cross: 320 },
  medium: { label: "Medium", simple: 2600, line: 6000, contradiction: 15000, fill: 420, cross: 200 },
  hard: { label: "Hard", simple: 1300, line: 3000, contradiction: 7000, fill: 240, cross: 110 },
};

/**
 * A computer player's mind: what it knows, its masks, kept between steps so what it worked out but didn't draw (a
 * colour struck off a cell) stays known to it. allow(k): the lines it may read.
 */
export function createMind(p, allow = null) {
  return { p, allow, st: unknownState(p) };
}

/**
 * Its next move, from the grid as it now is (a partner's cells included): { cells: [[cell, colour]…] (colour 0: cross it
 * out), rule, line, think (ms before it starts), each: [ms per cell…] }, or null when its lines say nothing more for
 * now. rand: 0 … 1, so it isn't a metronome. Cells already right on the grid aren't drawn again.
 */
export function botMove(mind, grid, pace = PACES.medium, rand = Math.random) {
  const { p } = mind, seen = knownFrom(p, grid);
  for (let i = 0; i < seen.length; i++) if (isKnown(seen[i])) mind.st[i] = seen[i] & mind.st[i] ? seen[i] : mind.st[i];
  const step = nextStep(p, mind.st, mind.allow);
  if (!step) return null;
  const fresh = step.cells.filter(([i]) => !isKnown(seen[i]));
  if (!fresh.length) return botMove(mind, grid, pace, rand);   // all already drawn: on to the next thing it sees
  const think = Math.round(pace[step.rule] * (0.7 + 0.6 * rand()));
  return { cells: fresh, rule: step.rule, line: step.line, think, each: fresh.map(([, c]) => Math.round((c ? pace.fill : pace.cross) * (0.8 + 0.4 * rand()))) };
}
