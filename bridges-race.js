// Bridges as a race (duel.js): everyone at the table gets the same puzzle and plays it on their own phone; the lowest score
// wins, which is the solo score (seconds on the clock plus 30 for each hint), so a race time and a solo time mean the same.
// Pure, no page. The dealing phone makes the puzzle and puts it in the match, numbers and answer both, so nobody waits on
// the generator after the start and every phone draws exactly the same board, whichever twists it has.
import { LEVELS as LADDER, kindOf } from "./bridges-levels.js";
import { ORDER, layoutOf } from "./bridges-engine.js";
import { playable, fixedOf, fromPuzzle } from "./bridges-run.js";

/** The numbers of the ladder's levels at a difficulty, in ladder order. */
export const levelsAt = difficulty => LADDER.flatMap((L, i) => (L.level === difficulty ? [i] : []));

/**
 * The ladder level a race takes its recipe from (size, difficulty, twists): one of the levels at the chosen difficulty,
 * picked from the seed, so every twist comes round and the same seed names the same level on every phone.
 */
export function raceLevel(difficulty, seed) {
  const pool = levelsAt(ORDER.includes(difficulty) ? difficulty : "medium");
  const h = Math.imul((Number(seed) | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return pool[((h ^ (h >>> 15)) >>> 0) % pool.length];
}

/** The match for a puzzle made for a ladder level: the puzzle itself and the level it came from. */
export const matchOf = (seed, lv, puzzle) => ({ ...fixedOf(fromPuzzle("duel", seed, kindOf(lv), puzzle)), lv });

/** Whether a match from the table is a puzzle this version can play (a table can be dealt by an older phone). */
export const matchValid = m => !!m && Number.isInteger(m.lv) && m.lv >= 0 && m.lv < LADDER.length && typeof m.sol === "string"
  && playable({ ...m, v: 1, mode: "duel", ms: 0, marks: "0".repeat(m.sol.length) }) && linksOf(m) === m.sol.length;
/** How many links the match's board has: its answer is one digit for each. */
const linksOf = m => { try { return layoutOf(m.size, m.grid, m.kinds || "", m.realms || "", m.hills || "", m.roads || "", { straits: m.straits || "", hex: m.shape === "hex" }).links.length; } catch { return -1; } };

/** The match in words: the level it comes from and its size. */
export const nameOf = m => `${LADDER[m.lv]?.name || "Bridges"}, ${m.shape === "hex" ? `hex ${m.size}` : `${m.size}×${m.size}`}`;

/**
 * How far a run is from the answer, for the others at the table: the bridges laid that the answer has, out of all of
 * the answer's. A bridge the answer doesn't have counts for nothing (a link with more than the answer is right up to it).
 */
export function progress(sol, marks) {
  let right = 0, total = 0;
  for (let l = 0; l < sol.length; l++) { total += +sol[l]; right += Math.min(+sol[l], +marks[l] || 0); }
  return { right, total, pct: total ? Math.floor((100 * right) / total) : 100 };
}

/**
 * What a run tells the table while it is under way: the share done in words, and a score that ranks it behind every
 * finished run (a finished run's score is its seconds) and, among those still playing, by the bridges still to lay.
 */
export const UNDER_WAY = 100000;
export const reportOf = (sol, marks) => { const p = progress(sol, marks); return { score: UNDER_WAY + p.total - p.right, text: `${p.pct}%` }; };
