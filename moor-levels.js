// Moor's levels, pure (no page): a ladder of puzzles in chapters, each bringing one twist to the plain game and ending on a
// block that mixes it with what came before: the plain game; sea walls; double docks; ranges; the hex basin (plain, then with
// the twists); and the gauntlet, puzzles that hold two or three twists at once, on square boards and hex ones. Every twist has a
// hex form, so none is square-only. A level is a kind of puzzle (a size, a level, a board, twists), not one puzzle: the first
// time it is the same puzzle for everyone (the level's own seed), and a new puzzle of the level is another from the same
// recipe, so a level can be replayed for its stars. Stars are for the score as everywhere in Moor (seconds plus 30 a hint,
// lower is better): one for solving it, two for a score within twice the par, three within the par, which is the time a
// steady solver needs for the reasoning the puzzle asks. Solving a level opens the next; any open level can be played at any
// time. A level's number is its identity (stars and half-played puzzles are kept by it): new levels go at the end of their
// chapter only if no player has met the chapter yet, otherwise at the very end, and none is ever removed or moved.
import { generate, puzzleOf, effortOf, BARGE_SECONDS } from "./moor-engine.js";

const level = spec => ({ twist: "none", shape: "square", ...spec });
const hex = spec => level({ shape: "hex", ...spec });
/** The chapters: where each begins in LEVELS, its name and what it brings. */
export const CHAPTERS = [
  { name: "Moorings", from: 0, about: "Moor a barge beside every dock: one barge a dock, never touching another, the numbers saying how many lie in each row and column." },
  { name: "Sea walls", from: 6, about: "Short walls stand on the edge between two cells. A barge across a wall from a dock is not beside it, and barges side by side across a wall do not touch." },
  { name: "Double docks", from: 11, about: "A wide landing stage takes two barges. They cannot touch, so on a square board they lie on opposite sides; each still belongs to one dock only." },
  { name: "Ranges", from: 17, about: "Some numbers are only a bound: 3+ is at least three barges in that line, ≤3 at most three." },
  { name: "The hex basin", from: 24, about: "A hexagon of hexes. A barge lies in any of the six cells round its dock, barges may not lie in cells beside each other, and the numbers count rows and both diagonals." },
  { name: "The gauntlet", from: 34, about: "The twists together, on square basins and hex ones." },
];
export const LEVELS = [
  level({ name: "First berth", size: 6, level: "easy" }),
  level({ name: "Quiet water", size: 8, level: "easy" }),
  level({ name: "Open harbour", size: 10, level: "easy" }),
  level({ name: "The channel", size: 8, level: "medium" }),
  level({ name: "Deep soundings", size: 8, level: "hard" }),
  level({ name: "The long quay", size: 10, level: "medium" }),

  level({ name: "Breakwater", size: 6, level: "easy", twist: "walls" }),
  level({ name: "Mole and jetty", size: 8, level: "easy", twist: "walls" }),
  level({ name: "Stone stair", size: 8, level: "medium", twist: "walls" }),
  level({ name: "The sea gate", size: 10, level: "medium", twist: "walls" }),
  level({ name: "Harbour wall", size: 8, level: "hard", twist: "walls" }),

  level({ name: "Wide berth", size: 6, level: "easy", twist: "doubles" }),
  level({ name: "Landing stage", size: 8, level: "easy", twist: "doubles" }),
  level({ name: "A pair of barges", size: 8, level: "medium", twist: "doubles" }),
  level({ name: "Two by two", size: 10, level: "medium", twist: "doubles" }),
  level({ name: "Stage and wall", size: 8, level: "medium", twist: "walls+doubles" }),
  level({ name: "The custom house", size: 10, level: "medium", twist: "walls+doubles" }),

  level({ name: "Rough tally", size: 6, level: "easy", twist: "ranges" }),
  level({ name: "Soundings", size: 8, level: "easy", twist: "ranges" }),
  level({ name: "Fog signals", size: 8, level: "medium", twist: "ranges" }),
  level({ name: "Tide tables", size: 10, level: "medium", twist: "ranges" }),
  level({ name: "The ledger", size: 8, level: "hard", twist: "ranges" }),
  level({ name: "Walls and bounds", size: 8, level: "medium", twist: "walls+ranges" }),
  level({ name: "Stages and bounds", size: 10, level: "medium", twist: "doubles+ranges" }),

  hex({ name: "First basin", size: 5, level: "easy" }),
  hex({ name: "Six sides", size: 7, level: "easy" }),
  hex({ name: "Honeycomb", size: 9, level: "easy" }),
  hex({ name: "The wide basin", size: 9, level: "medium" }),
  hex({ name: "The deep basin", size: 9, level: "hard" }),
  hex({ name: "The great basin", size: 11, level: "medium" }),
  hex({ name: "Hex breakwater", size: 7, level: "easy", twist: "walls" }),
  hex({ name: "Hex stage", size: 7, level: "medium", twist: "doubles" }),
  hex({ name: "Hex soundings", size: 9, level: "medium", twist: "ranges" }),
  hex({ name: "Walled basin", size: 9, level: "medium", twist: "walls+doubles" }),

  level({ name: "Customs run", size: 8, level: "medium", twist: "walls+doubles+ranges" }),
  hex({ name: "Rival quays", size: 7, level: "medium", twist: "walls+doubles" }),
  level({ name: "Spring tide", size: 10, level: "medium", twist: "walls+doubles+ranges" }),
  hex({ name: "Hex tally", size: 9, level: "medium", twist: "doubles+ranges" }),
  level({ name: "Deep water", size: 10, level: "hard", twist: "walls+ranges" }),
  hex({ name: "The grand basin", size: 9, level: "hard", twist: "walls+doubles+ranges" }),
  hex({ name: "The lighthouse", size: 11, level: "expert", twist: "walls+doubles+ranges" }),
];
export const COUNT = LEVELS.length;
/** The chapter a level is in. */
export const chapterOf = i => { let c = 0; CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); return c; };

/** A level's own seed: the puzzle everyone gets the first time. */
export const seedOf = i => 7001 + 7919 * i;
/** The puzzle of level i (0 on), from a seed (default: the level's own): the engine's { grid, sol, level, … }, null if none came. */
export function levelPuzzle(i, seed = seedOf(i)) {
  const L = LEVELS[i];
  return generate(seed, L.size, L.level, L.twist, L.shape);
}
/** The kind a level asks the generator for. */
export const kindOf = i => ({ size: LEVELS[i].size, level: LEVELS[i].level, twist: LEVELS[i].twist, shape: LEVELS[i].shape });

// ---------- the stars ----------
/** Seconds of steady play before a puzzle's reasoning starts to count: reading the board. */
export const PAR_BASE = 12;
/** A steady solver's par on top of that, per barge by the reasoning that finds it (BARGE_SECONDS), and how much longer a hex basin or a twist takes to read. */
export const PAR_SLACK = 1.4;
const READING = { hex: 1.15, twist: 0.06 };
/** The par of a puzzle in seconds: a score at or under it is three stars, within twice it two. `p` is a puzzle as the engine makes it with its size (and `shape`, `walls`, `ranges`). */
export function parOf(p) {
  const P = puzzleOf(p.size, p.grid, p.sol, { shape: p.shape, walls: p.walls, ranges: p.ranges });
  const tally = effortOf(P), work = tally.reduce((a, n, lv) => a + n * BARGE_SECONDS[lv], 0);
  const twists = (p.walls ? 1 : 0) + (/2/.test(p.grid) ? 1 : 0) + (p.ranges ? 1 : 0);
  return Math.round((PAR_BASE + work * PAR_SLACK) * (p.shape === "hex" ? READING.hex : 1) * (1 + READING.twist * twists));
}
/** Stars for a score on a puzzle: 1, 2 or 3. */
export function starsFor(p, score) {
  const par = parOf(p);
  return score <= par ? 3 : score <= 2 * par ? 2 : 1;
}
