// Lanterns' levels, pure (no page): a ladder of puzzles in chapters (5 November 2026, Korbi: "I like all the twists ... agree with
// the chapters and mixed gauntlet levels"). The plain game on boards from 7×7 to 14×14; ranges, rocks that carry only a bound
// ("2+" at least, "≤1" at most); short beams, lanterns that light only so many cells each way; mirrors, slashes that bend a beam;
// the hex board, six rays to a lantern; and the gauntlet, where they meet. Each chapter brings in one twist gently and ends on
// a block that mixes it with what came before. A level is a kind of puzzle (a size, a level, a twist), not one puzzle: the
// first time it is the same puzzle for everyone (the level's own seed), and a new puzzle of the level is another from the same
// recipe, so a level can be replayed for its stars. Stars are for the score as everywhere in Lanterns (seconds plus 30 a hint,
// lower is better): one for solving it, two for a score within twice the par, three within the par. Solving a level opens the
// next; any level open can be played at any time. A level's number is its identity (stars and unfinished runs are kept by it):
// new levels go at the end of a chapter only if the ladder is given a new LADDER_VERSION; none has been moved yet.
import { generate, twistOf, twistKey } from "./lanterns-engine.js";

const level = spec => ({ twist: "none", ...spec });
/** The chapters: where each begins in LEVELS, its name and what it brings. */
export const CHAPTERS = [
  { name: "Safe harbour", from: 0, about: "Lanterns as it always was: light every white cell, no lantern lit by another, each number the lanterns beside its rock." },
  { name: "Ranges", from: 6, about: "Some rocks carry only a bound: 2+ is at least two lanterns beside it, ≤1 at most one." },
  { name: "Short beams", from: 11, about: "A lantern's beam only runs so far: the reach on the board says how many cells each way. A rock still stops it." },
  { name: "Mirrors", from: 16, about: "A rock with a slash is a mirror. A beam that reaches it turns, and keeps going. A lantern may not be lit by a reflection of another, or of itself." },
  { name: "Hex shoals", from: 23, about: "A board of hexagons. A lantern shines along all six rays, to the next rock or the edge, and a rock may have up to six lanterns beside it." },
  { name: "The gauntlet", from: 30, about: "The twists together, on both boards." },
];
export const LEVELS = [
  level({ name: "First light", size: 7, level: "easy" }),
  level({ name: "Evening watch", size: 7, level: "medium" }),
  level({ name: "The long jetty", size: 10, level: "easy" }),
  level({ name: "Night shift", size: 10, level: "medium" }),
  level({ name: "Fog bank", size: 10, level: "hard" }),
  level({ name: "Storm coast", size: 14, level: "medium" }),

  level({ name: "Rough charts", size: 7, level: "easy", twist: "ranges" }),
  level({ name: "Tide marks", size: 7, level: "medium", twist: "ranges" }),
  level({ name: "Soundings", size: 10, level: "easy", twist: "ranges" }),
  level({ name: "Ledger lamps", size: 10, level: "medium", twist: "ranges" }),
  level({ name: "The harbour master", size: 10, level: "hard", twist: "ranges" }),

  level({ name: "Candle ends", size: 7, level: "easy", twist: "short" }),
  level({ name: "Dim wick", size: 7, level: "medium", twist: "short" }),
  level({ name: "Close quarters", size: 10, level: "easy", twist: "short" }),
  level({ name: "Lamp oil", size: 10, level: "medium", twist: "short" }),
  level({ name: "Counted shoals", size: 10, level: "medium", twist: "ranges+short" }),

  level({ name: "Polished brass", size: 7, level: "easy", twist: "mirrors" }),
  level({ name: "Silver glass", size: 7, level: "medium", twist: "mirrors" }),
  level({ name: "The mirror strait", size: 10, level: "easy", twist: "mirrors" }),
  level({ name: "Crossed beams", size: 10, level: "medium", twist: "mirrors" }),
  level({ name: "Hall of mirrors", size: 10, level: "hard", twist: "mirrors" }),
  level({ name: "Bent light", size: 10, level: "medium", twist: "short+mirrors" }),
  level({ name: "Mirror ledger", size: 10, level: "medium", twist: "ranges+mirrors" }),

  level({ name: "Honeycomb", size: 7, level: "easy", twist: "hex" }),
  level({ name: "Six rays", size: 7, level: "medium", twist: "hex" }),
  level({ name: "Hex harbour", size: 9, level: "easy", twist: "hex" }),
  level({ name: "Beehive", size: 9, level: "medium", twist: "hex" }),
  level({ name: "Wide comb", size: 9, level: "hard", twist: "hex" }),
  level({ name: "The great comb", size: 11, level: "medium", twist: "hex" }),
  level({ name: "Hex glass", size: 9, level: "medium", twist: "mirrors+hex" }),

  level({ name: "Hex ledgers", size: 9, level: "medium", twist: "ranges+hex" }),
  level({ name: "Hex candles", size: 9, level: "medium", twist: "short+hex" }),
  level({ name: "Short mirrors", size: 10, level: "hard", twist: "short+mirrors" }),
  level({ name: "Triple lamp", size: 10, level: "medium", twist: "ranges+short+mirrors" }),
  level({ name: "Mirrored ledgers", size: 9, level: "medium", twist: "ranges+mirrors+hex" }),
  level({ name: "The grand light", size: 11, level: "medium", twist: "ranges+short+mirrors+hex" }),
];
export const COUNT = LEVELS.length;
/** The chapter a level is in. */
export const chapterOf = i => { let c = 0; CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); return c; };

/** A level's own seed: the puzzle everyone gets the first time. */
export const seedOf = i => 7001 + 7919 * i;
/** The puzzle of level i (0 on), from a seed (default: the level's own): the engine's { size, grid, sol, level, … }, null if none came. */
export function levelPuzzle(i, seed = seedOf(i)) {
  const L = LEVELS[i];
  return generate(seed, L.size, L.level, L.twist);
}
/** The kind a level asks the generator for. */
export const kindOf = i => ({ size: LEVELS[i].size, level: LEVELS[i].level, twist: twistKey(LEVELS[i].twist) });
/** Whether a level is on the hex board. */
export const isHex = i => twistOf(LEVELS[i].twist).hex;

// ---------- the stars ----------
/** Seconds a white cell is allowed for the par, and the room that grows with how hard the puzzle came out. A guess, to be set by play. */
export const PAR_PER_CELL = 1.6;
export const PAR_BASE = 15;
const HARDER = { easy: 1, medium: 1.4, hard: 1.9, expert: 2.6 };
const TWISTED = 1.25;                                            // a twist is something new to read in every puzzle
const whitesOf = grid => { let n = 0; for (const ch of grid) if (ch === ".") n++; return n; };
/** The par of a puzzle in seconds: a score at or under it is three stars, within twice it two. `p`: { grid, level, twist }. */
export const parOf = p => Math.round(PAR_BASE + PAR_PER_CELL * whitesOf(p.grid) * (HARDER[p.level] ?? 1) * (p.twist && p.twist !== "none" ? TWISTED : 1));
/** Stars for a score on a puzzle: 1, 2 or 3. */
export function starsFor(p, score) {
  const par = parOf(p);
  return score <= par ? 3 : score <= 2 * par ? 2 : 1;
}
