// Reversi's computer player at its three levels, on flank-engine.js's search: a level is how far it looks and how often
// it misses, never how long it thinks (a slow phone plays as a fast one).
//   Easy    looks one move ahead; half its moves are at random, and seven times in ten a corner on offer goes unseen.
//   Medium  looks three moves ahead and plays the last eight squares out exactly; one move in ten is a slip.
//   Hard    looks eight moves ahead (iterating from one, best moves first) and plays the last fourteen squares out exactly.
// The numbers were set by games between the levels (tools/flank-bench.mjs).
import { parse, sqName } from "./flank-board.js";
import { rootScores } from "./flank-engine.js";

export const LEVELS = {
  easy: { name: "Easy", depth: 1, exact: 0, random: 0.5, miss: 0.7, all: true },
  medium: { name: "Medium", depth: 3, exact: 8, random: 0.1, miss: 0.15, all: true },
  hard: { name: "Hard", depth: 8, exact: 14, random: 0, miss: 0, all: false },
};
export const LEVEL_NAMES = Object.entries(LEVELS).map(([k, v]) => [k, v.name]);
export const levelOf = id => LEVELS[id] || LEVELS.medium;

const CORNERS = new Set([0, 7, 56, 63]);
/** A board and the side to move as the search wants them: [mine low, mine high, theirs low, theirs high]. */
export function sidesOf(b, t) {
  const x = parse(b);
  return t === "d" ? [x.dl, x.dh, x.ll, x.lh] : [x.ll, x.lh, x.dl, x.dh];
}
/**
 * The scores of the moves a level would weigh in a position: [{ sq, score, exact }], best first. `cap` bounds the
 * positions looked at (a computer move made without the worker, which must not hold the page up).
 */
export function scoresFor(b, t, level, cap = Infinity) {
  const L = levelOf(level), [pl, ph, ol, oh] = sidesOf(b, t);
  return rootScores(pl, ph, ol, oh, { depth: L.depth, exact: L.exact, all: L.all, nodes: cap });
}
/**
 * The move a level plays out of those scores, with its slips: with probability `miss` a corner on offer goes
 * unseen (when there's another move), and with `random` it plays a move at random from those left. rng() is in [0, 1).
 */
export function pick(scores, level, rng) {
  const L = levelOf(level);
  let list = scores;
  if (!list.length) return -1;
  if (L.miss && list.some(m => CORNERS.has(m.sq)) && list.some(m => !CORNERS.has(m.sq)) && rng() < L.miss) list = list.filter(m => !CORNERS.has(m.sq));
  if (L.random && list.length > 1 && rng() < L.random) return list[Math.floor(rng() * list.length)].sq;
  return list[0].sq;
}
/** The move the level plays in a position, worked out here (tests, the bench, and the page without its worker). */
export function chooseMove(b, t, level, rng, cap = Infinity) {
  return pick(scoresFor(b, t, level, cap), level, rng);
}
export const moveText = sq => sqName(sq);
