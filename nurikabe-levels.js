// Dujiang's levels, pure (no page): a ladder of puzzles in chapters, each bringing one twist to the ones before: the plain
// game; bounds, numbers that are only a limit ("5+" at least five cells, "≤4" at most four); islands with no number ("?"),
// the land count given instead; arch bridges, where an island crosses a canal on a bridge and the water runs under it; and
// the gauntlet, where the twists meet. A level is a kind of puzzle (a size, a level, a twist), not one puzzle: the first
// time it is the same puzzle for everyone (the level's own seed) and a new puzzle of the level is another from the same
// recipe, so a level can be replayed for its stars. Solving a level opens the next; any level open can be played at any
// time. A level's number is its identity (stars and unfinished puzzles are kept by it): new levels go at the end of their
// chapter only with a new LADDER_VERSION and a `was` on every level whose number moved, as Bridges' ladder does.
import { generate } from "./nurikabe-engine.js";

const level = spec => ({ twist: "none", ...spec });
/** The chapters: where each begins in LEVELS, its name and what it brings. */
export const CHAPTERS = [
  { name: "The first paddies", from: 0, about: "Dujiang as it always was: each number is an island of that many cells, the sea is one piece and has no 2×2 pool." },
  { name: "Bounds", from: 6, about: "Some numbers are only a limit: 5+ is an island of at least five cells, ≤4 one of at most four." },
  { name: "Unmarked plots", from: 11, about: "A ? is an island of any size, one cell or more. The board says how many cells of land there are in all." },
  { name: "Arch bridges", from: 16, about: "An arched cell is part of the island on either side of it and counts in its size, while the water runs under it: it joins the sea at its two sides." },
  { name: "The gauntlet", from: 21, about: "The twists together." },
];
export const LEVELS = [
  level({ name: "Nursery plot", size: 6, level: "easy" }),
  level({ name: "Two ditches", size: 6, level: "medium" }),
  level({ name: "The terrace", size: 8, level: "easy" }),
  level({ name: "Sluice and weir", size: 8, level: "medium" }),
  level({ name: "The broad polder", size: 10, level: "easy" }),
  level({ name: "Flood season", size: 6, level: "hard" }),

  level({ name: "Rough plots", size: 6, level: "easy", twist: "ranges" }),
  level({ name: "Fallow", size: 8, level: "easy", twist: "ranges" }),
  level({ name: "Silt and stone", size: 8, level: "medium", twist: "ranges" }),
  level({ name: "The ledger", size: 10, level: "easy", twist: "ranges" }),
  level({ name: "The tax roll", size: 8, level: "hard", twist: "ranges" }),

  level({ name: "Unnamed field", size: 6, level: "easy", twist: "unknown" }),
  level({ name: "Wild paddies", size: 8, level: "easy", twist: "unknown" }),
  level({ name: "Common land", size: 8, level: "medium", twist: "unknown" }),
  level({ name: "The long fallow", size: 6, level: "hard", twist: "unknown" }),
  level({ name: "Deep water", size: 8, level: "hard", twist: "unknown" }),

  level({ name: "First arch", size: 6, level: "easy", twist: "bridges" }),
  level({ name: "The causeway", size: 8, level: "easy", twist: "bridges" }),
  level({ name: "Moon bridge", size: 8, level: "medium", twist: "bridges" }),
  level({ name: "Nine arches", size: 10, level: "easy", twist: "bridges" }),
  level({ name: "The great span", size: 8, level: "hard", twist: "bridges" }),

  level({ name: "Tally and arch", size: 8, level: "medium", twist: "ranges+bridges" }),
  level({ name: "Nameless crossing", size: 8, level: "medium", twist: "unknown+bridges" }),
  level({ name: "Count and wonder", size: 8, level: "medium", twist: "ranges+unknown" }),
  level({ name: "Imperial survey", size: 10, level: "easy", twist: "ranges+unknown+bridges" }),
  level({ name: "The grand canal", size: 8, level: "hard", twist: "ranges+unknown+bridges" }),
];
export const COUNT = LEVELS.length;
export const LADDER_VERSION = 1;
/** The chapter a level is in. */
export const chapterOf = i => { let c = 0; CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); return c; };

/** A level's own seed: the puzzle everyone gets the first time. */
export const seedOf = i => 6101 + 7919 * i;
/** The kind a level asks the generator for. */
export const kindOf = i => ({ size: LEVELS[i].size, level: LEVELS[i].level, twist: LEVELS[i].twist });
/** The puzzle of level i (0 on), from a seed (default: the level's own): the engine's { size, grid, sol, level, … }, null if none came. */
export const levelPuzzle = (i, seed = seedOf(i)) => generate(seed, LEVELS[i].size, LEVELS[i].level, LEVELS[i].twist);

// ---------- the stars ----------
/** Stars are for the score as everywhere in Dujiang (seconds plus 30 a hint, lower is better): one for solving it, two for a
 *  score within twice the par, three within the par. The par is a few seconds a stone and grows with how hard the puzzle came
 *  out; a guess, to be set by play. */
export const PAR_PER_STONE = 9;
export const PAR_BASE = 15;
const HARDER = { easy: 1, medium: 1.4, hard: 1.9 };
const stonesOf = grid => { let n = 0; for (const ch of grid) if (ch !== "-") n++; return n; };
/** The par of a puzzle in seconds. A "?" has no number in the grid but is a stone all the same, so it is counted from `bd`. */
export const parOf = p => Math.round((PAR_BASE + PAR_PER_STONE * (stonesOf(p.grid) + (p.bd ? [...p.bd].filter(c => c === "?").length : 0))) * (HARDER[p.level] ?? 1));
/** Stars for a score on a puzzle: 1, 2 or 3. */
export function starsFor(p, score) {
  const par = parOf(p);
  return score <= par ? 3 : score <= 2 * par ? 2 : 1;
}
