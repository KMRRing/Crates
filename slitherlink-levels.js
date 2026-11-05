// Portolan's levels, pure (no page): a ladder of puzzles in chapters, each chapter bringing one twist gently and ending on a block that
// mixes it with what came before; then the gauntlet, where ranges, tunnels and the honeycomb meet. A level is a kind of puzzle (a
// board, a size, a difficulty, a twist), not one puzzle: the first time it is the same puzzle for everyone (the level's own seed), and
// a new puzzle of the level is another from the same recipe, so a level can be replayed for its stars. Stars are for the score as
// everywhere in Portolan (seconds plus 30 a hint, lower is better): one for solving it, two for a score within twice the par, three
// within the par, which grows with the cells and the level. Solving a level opens the next; any level open can be played at any time.
//
// A level's number never changes once shipped; new levels go at the end of their chapter's list only by adding a chapter after the last.
import { generate } from "./slitherlink-engine.js";

const level = spec => ({ board: "square", twist: "none", ...spec });
/** The chapters: where each begins in LEVELS, its name and what it brings. */
export const CHAPTERS = [
  { name: "Harbour charts", from: 0, about: "Portolan as it always was: one loop along the lines, every number telling how many sides of its cell the loop uses." },
  { name: "Rough soundings", from: 6, about: "Some numbers are only a bound: 2+ is at least two sides of its cell, ≤1 at most one." },
  { name: "Causeways", from: 11, about: "A dot marked as a causeway is where the loop crosses itself, straight over and under: all four of its lines are drawn, and the loop goes straight on both ways." },
  { name: "Honeycomb coast", from: 17, about: "The same loop on a honeycomb: each hexagon shows 0 to 6 and every corner has two lines or none. A honeycomb corner has three edges, so it has no causeways." },
  { name: "The gauntlet", from: 24, about: "Bounds, causeways and the honeycomb, together." },
];
export const LEVELS = [
  level({ name: "First landfall", size: 5, level: "easy" }),
  level({ name: "Coastwise", size: 5, level: "medium" }),
  level({ name: "Open water", size: 7, level: "easy" }),
  level({ name: "Dead reckoning", size: 7, level: "medium" }),
  level({ name: "Deep soundings", size: 7, level: "hard" }),
  level({ name: "The long coast", size: 10, level: "medium" }),

  level({ name: "Rough numbers", size: 5, level: "easy", twist: "ranges" }),
  level({ name: "Soundings", size: 7, level: "easy", twist: "ranges" }),
  level({ name: "Fog signals", size: 7, level: "medium", twist: "ranges" }),
  level({ name: "Tide tables", size: 10, level: "medium", twist: "ranges" }),
  level({ name: "The ledger", size: 7, level: "hard", twist: "ranges" }),

  level({ name: "First ford", size: 5, level: "easy", twist: "tunnels" }),
  level({ name: "The causeway", size: 7, level: "easy", twist: "tunnels" }),
  level({ name: "Over and under", size: 7, level: "medium", twist: "tunnels" }),
  level({ name: "Long bridge", size: 10, level: "medium", twist: "tunnels" }),
  level({ name: "Ledger and ford", size: 7, level: "medium", twist: "ranges+tunnels" }),
  level({ name: "Causeway ledger", size: 10, level: "medium", twist: "ranges+tunnels" }),

  level({ name: "Six sides", board: "hex", size: 5, level: "easy" }),
  level({ name: "The hive", board: "hex", size: 5, level: "medium" }),
  level({ name: "Open comb", board: "hex", size: 7, level: "easy" }),
  level({ name: "Cells", board: "hex", size: 7, level: "medium" }),
  level({ name: "Wax and honey", board: "hex", size: 7, level: "hard" }),
  level({ name: "Rough comb", board: "hex", size: 7, level: "medium", twist: "ranges" }),
  level({ name: "Wax ledger", board: "hex", size: 9, level: "medium", twist: "ranges" }),

  level({ name: "Fogbound ford", size: 7, level: "hard", twist: "ranges+tunnels" }),
  level({ name: "Admiralty chart", size: 10, level: "medium", twist: "ranges+tunnels" }),
  level({ name: "Hive and ledger", board: "hex", size: 7, level: "hard", twist: "ranges" }),
  level({ name: "The grand survey", size: 10, level: "hard", twist: "ranges+tunnels" }),
];
export const COUNT = LEVELS.length;
/** The chapter a level is in. */
export const chapterOf = i => { let c = 0; CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); return c; };

/** A level's own seed: the puzzle everyone gets the first time. */
export const seedOf = i => 9001 + 7919 * i;
/** The kind a level asks the generator for. */
export const kindOf = i => ({ board: LEVELS[i].board, size: LEVELS[i].size, level: LEVELS[i].level, twist: LEVELS[i].twist });
/** The puzzle of level i (0 on), from a seed (default: the level's own): the engine's { size, grid, sol, level, … }, null if none came. */
export function levelPuzzle(i, seed = seedOf(i)) {
  const L = LEVELS[i];
  return generate(seed, L.size, L.level, false, { shape: L.board, twist: L.twist });
}

// ---------- the stars ----------
/** Seconds a cell is allowed for the par, and the room that grows with the level. A guess, to be set by play. */
export const PAR_PER_CELL = 3.2;
export const PAR_BASE = 10;
const HARDER = { easy: 1, medium: 1.35, hard: 1.7 };
const TWISTY = { none: 1, ranges: 1.1, tunnels: 1.1, "ranges+tunnels": 1.2 };
/** The par of a puzzle in seconds: a score at or under it is three stars, within twice it two. `cells` is the count of the board. */
export const parOf = (cells, level, twist = "none") => Math.round(PAR_BASE + PAR_PER_CELL * cells * (HARDER[level] ?? 1) * (TWISTY[twist] ?? 1));
/** Stars for a score: 1, 2 or 3. */
export function starsFor(cells, level, twist, score) {
  const par = parOf(cells, level, twist);
  return score <= par ? 3 : score <= 2 * par ? 2 : 1;
}
