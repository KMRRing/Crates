// Silo's computer player. Four in a row is a solved game (the first mover wins by starting in the middle), so the levels
// are not how deep a player sees but how often it misses what is there to see: a win it could take, a loss it could stop.
//   Hard    never misses. From about a dozen discs on it solves the position exactly and plays a move of the best score;
//           before that, which no phone can solve, it searches twelve plies or so with a judgement of threats at the end.
//   Medium  sees a win or a loss within a move or two nearly always, one three or four plies away mostly, and one
//           further off now and then; in a quiet position it plays the better of a few moves by a short search.
//   Easy    misses a good share even of the one-move wins and the one-move losses, and has no sight beyond; in a quiet
//           position it plays a middle column more often than not.
// What a level "sees" is a fact of the position found by the exact search below (a forced win or loss within a few
// plies); each fact is noticed with the level's chance, drawn from the move's seed, so a move worked out twice is the
// same. Pure and plain: the page may hand Hard's answer in from a worker (advise), else it is worked out here, small.
import { ORDER, legal as legalCols } from "./silo-board.js";
import { createSolver } from "./silo-solver.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
/**
 * The chance a level notices a forced result `h` plies away: [win in 1, loss in 2, win in 3, loss in 4, win in 5, loss
 * in 6]. A loss in 2 is both the threat to stop and the column not to play under.
 */
export const SIGHT = {
  easy: [0.72, 0.58, 0.18, 0.08, 0.03, 0.02],
  medium: [0.98, 0.95, 0.82, 0.66, 0.4, 0.25],
  hard: [1, 1, 1, 1, 1, 1],
};
/** Where a level's quiet moves come from: the width of the choice (Easy: a column at random, middle more likely). */
const QUIET = { easy: { depth: 0 }, medium: { depth: 4, nodes: 4000, wobble: 0.12 } };

let shared = null;
/** The solver the page's computer player uses when no worker answers (small: the worker takes the large tables). */
export function solverHere() { return shared ||= createSolver({ bits: 18, thinkBits: 16 }); }
/** For the tests and the bench: their own, so a run doesn't depend on what an earlier one left in the tables. */
export const newSolver = opts => createSolver(opts);

/** Moves the page's worker has already worked out: moves string → column. Hard plays one of these when it is there. */
const advice = new Map();
export function advise(moves, col) { advice.set(moves, col); if (advice.size > 64) advice.delete(advice.keys().next().value); }
export const advised = moves => advice.get(moves);

/** How much a level of Hard may spend on a move here (nodes), by the discs played: more late, where it solves. */
export function hardBudget(n, big = false) {
  return big ? { solve: n >= 12 ? 4_000_000 : 0, think: 1_500_000, depth: 16 } : { solve: n >= 16 ? 400_000 : 0, think: 40_000, depth: 10 };
}

/**
 * Hard's move: the exact best by score when the position can be solved inside the budget (ties: the one nearest the
 * middle, or by `pick` among them), else the deepest search the budget allows. Returns { col, value, exact, depth }:
 * value is the exact score for the mover when `exact` (22 less the winner's discs; 0 a draw; negative a loss), else a
 * judgement in hundredths of a disc (and ±(10000 less the discs) for a forced result).
 */
export function hardMove(moves, { solver = solverHere(), big = false, pick = null } = {}) {
  const n = moves.length, budget = hardBudget(n, big);
  if (n === 0) return { col: 3, value: 1, exact: false, depth: 0 };               // the middle, which wins
  if (budget.solve) {
    const s = solver.scores(moves, budget.solve);
    if (s) {
      const col = pick ? pick(s.best) : s.best[0];
      return { col, value: s.top, exact: true, depth: 0, scores: s.scores };
    }
  }
  const t = solver.think(moves, { depth: budget.depth, nodeLimit: budget.think });
  if (t) return { col: t.col, value: t.value, exact: false, depth: t.depth };
  const l = legalCols(moves);
  return { col: l[0], value: 0, exact: false, depth: 0 };
}

/**
 * A computer player's column for the position (the moves so far): level easy | medium | hard; rng draws the level's
 * noticing and its quiet choices.
 */
export function chooseMove(moves, level, rng, opts = {}) {
  const cols = legalCols(moves);
  if (cols.length === 1) return cols[0];
  if (level === "hard") {
    const a = advised(moves);
    if (a != null && cols.includes(a)) return a;
    return hardMove(moves, { ...opts, pick: best => best[0] }).col;
  }
  const sight = SIGHT[level] || SIGHT.medium, solver = opts.solver || solverHere();
  const facts = solver.tactics(moves, 6);
  const seen = (h, mode) => h > 0 && rng() < sight[Math.min(h, 6) - 1] && (mode === "win" ? h % 2 === 1 : h % 2 === 0);
  // a win it notices: the soonest
  let wins = facts.filter(f => f.win && seen(f.win, "win")).sort((p, q) => p.win - q.win);
  if (wins.length) return wins[0].c;
  // a loss it notices rules a move out; if every move loses, the one that loses last
  const lost = new Set(facts.filter(f => f.lose && seen(f.lose, "lose")).map(f => f.c));
  let rest = facts.filter(f => !lost.has(f.c));
  if (!rest.length) rest = facts.slice().sort((p, q) => (q.lose || 99) - (p.lose || 99)).slice(0, 1);
  // a quiet position (or what it doesn't see): by its level's way of choosing
  const q = QUIET[level] || QUIET.medium;
  if (!q.depth) {
    // middle columns more likely: weight 4, 3, 2, 1 from the middle out
    const w = rest.map(f => 4 - Math.abs(f.c - 3));
    let r = rng() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < w.length - 1 && (r -= w[i]) > 0) i++;
    return rest[i].c;
  }
  const allowed = new Set(rest.map(f => f.c));
  const t = solver.think(moves, { depth: q.depth, nodeLimit: q.nodes });
  if (t && allowed.has(t.col) && rng() >= q.wobble) return t.col;
  const order = ORDER.filter(c => allowed.has(c));
  return order[Math.floor(rng() * Math.min(order.length, 3))];
}
