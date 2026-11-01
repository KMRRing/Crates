// Bridges' levels, pure (no page): a ladder of puzzles in chapters, each chapter bringing a twist to the one before: the
// plain game on charts from 7×7 to 11×11; reefs, rock in the water that no bridge crosses; ranges, numbers that are only
// a bound ("4+", "≤3"); two realms, two colours of island each with a network of its own; and the admiralty's charts, where
// they meet. A level is a kind of puzzle (a size, a difficulty, a twist), not one puzzle: the first time it is the same
// puzzle for everyone (the level's own seed), and a new puzzle of the level is another from the same recipe, so a level can
// be replayed for its stars. Stars are for the score as everywhere in Bridges (seconds plus 30 a hint, lower is better):
// one for solving it, two for a score within twice the par, three within the par, which is a few seconds an island and
// grows with how hard the puzzle is. Solving a level opens the next; any level open can be played at any time.
import { generate } from "./bridges-engine.js";

const level = spec => ({ twist: "none", ...spec });
/** The chapters: where each begins in LEVELS, its name and what it brings. */
export const CHAPTERS = [
  { name: "Harbour charts", from: 0, about: "Bridges as it always was: every island with as many bridges as its number, all of them one network, no bridge crossing another." },
  { name: "Reefs", from: 6, about: "Rock in the water. No bridge goes over a reef, so two islands are linked only where nothing lies between them." },
  { name: "Ranges", from: 11, about: "Some numbers are only a bound: 4+ is at least four bridges, ≤3 at most three." },
  { name: "Two realms", from: 16, about: "Two colours of island. A bridge joins two of one colour, an island of the other colour in the way stops a link, and each colour is a network of its own." },
  { name: "The admiralty", from: 21, about: "The twists together." },
];
export const LEVELS = [
  level({ name: "First light", size: 7, level: "easy" }),
  level({ name: "Two shores", size: 7, level: "medium" }),
  level({ name: "Open water", size: 9, level: "easy" }),
  level({ name: "The channel", size: 9, level: "medium" }),
  level({ name: "The long haul", size: 11, level: "easy" }),
  level({ name: "Deep soundings", size: 9, level: "hard" }),

  level({ name: "Shallows", size: 7, level: "easy", twist: "reefs" }),
  level({ name: "Breakers", size: 9, level: "easy", twist: "reefs" }),
  level({ name: "Rocky cut", size: 9, level: "medium", twist: "reefs" }),
  level({ name: "The skerries", size: 11, level: "medium", twist: "reefs" }),
  level({ name: "Wreck coast", size: 11, level: "hard", twist: "reefs" }),

  level({ name: "Rough numbers", size: 7, level: "easy", twist: "ranges" }),
  level({ name: "Soundings", size: 9, level: "easy", twist: "ranges" }),
  level({ name: "Fog signals", size: 9, level: "medium", twist: "ranges" }),
  level({ name: "Tide tables", size: 11, level: "medium", twist: "ranges" }),
  level({ name: "The ledger", size: 11, level: "hard", twist: "ranges" }),

  level({ name: "Two flags", size: 7, level: "easy", twist: "realms" }),
  level({ name: "Rival ports", size: 9, level: "easy", twist: "realms" }),
  level({ name: "Border waters", size: 9, level: "medium", twist: "realms" }),
  level({ name: "Two crowns", size: 11, level: "medium", twist: "realms" }),
  level({ name: "The partition", size: 11, level: "hard", twist: "realms" }),

  level({ name: "Reef and ledger", size: 9, level: "medium", twist: "reefs+ranges" }),
  level({ name: "Rival reefs", size: 9, level: "hard", twist: "reefs+realms" }),
  level({ name: "Rival ledgers", size: 11, level: "medium", twist: "ranges+realms" }),
  level({ name: "Admiralty chart", size: 11, level: "hard", twist: "reefs+ranges+realms" }),
];
export const COUNT = LEVELS.length;
/** The chapter a level is in. */
export const chapterOf = i => { let c = 0; CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); return c; };

/** A level's own seed: the puzzle everyone gets the first time. */
export const seedOf = i => 9001 + 7919 * i;
/** The puzzle of level i (0 on), from a seed (default: the level's own): the engine's { size, grid, sol, level, … }, null if none came. */
export function levelPuzzle(i, seed = seedOf(i)) {
  const L = LEVELS[i];
  return generate(seed, L.size, L.level, L.twist);
}
/** The kind a level asks the generator for. */
export const kindOf = i => ({ size: LEVELS[i].size, level: LEVELS[i].level, twist: LEVELS[i].twist });

// ---------- the stars ----------
/** Seconds an island is allowed for the par, and the room that grows with how hard the puzzle came out. A guess, to be set by play. */
export const PAR_PER_ISLAND = 4;
export const PAR_BASE = 8;
const HARDER = { easy: 1, medium: 1.35, hard: 1.7 };
const islandsOf = grid => { let n = 0; for (const ch of grid) if (ch !== "." && ch !== "#") n++; return n; };
/** The par of a puzzle in seconds: a score at or under it is three stars, within twice it two. */
export const parOf = p => Math.round(PAR_BASE + PAR_PER_ISLAND * islandsOf(p.grid) * (HARDER[p.level] ?? 1));
/** Stars for a score on a puzzle: 1, 2 or 3. */
export function starsFor(p, score) {
  const par = parOf(p);
  return score <= par ? 3 : score <= 2 * par ? 2 : 1;
}
