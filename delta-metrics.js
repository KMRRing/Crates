// Delta: how a solution looks, in numbers. Pure. A board's solution (board.sol) is the set of paths it was built
// from; a good one is a few LONG chains that wind across the whole field and run side by side, so which operation
// belongs to which pair has to be worked out and the chains have to be fitted together. A bad one is a short hop
// between two numbers with its operations lying on it ("bundled"): nothing to work out, the maths is decoration.
import { distance, neighbours } from "./delta-base.js";

/** A pair is bundled when its numbers are adjacent or one hex apart, or its path is within two steps of a straight
 *  line between them (the player just joins them). */
export const BUNDLED = { dist: 2, slack: 2 };

/**
 * Walls: the borders between cells of two DIFFERENT paths (each border counted once). `self` counts borders between
 * cells of the same path that aren't consecutive on it (the path touching itself), which separate nothing.
 * Returns { cross, self, share (cross / (cross + self)), perPath (cross borders touching each path), covered }.
 */
export function wallsOf(paths) {
  const owner = new Map(), at = new Map();
  paths.forEach((cells, i) => cells.forEach((k, j) => { owner.set(k, i); at.set(k, j); }));
  const perPath = paths.map(() => 0);
  let cross = 0, self = 0;
  for (const [k, i] of owner) {
    for (const n of neighbours(k)) {
      const j = owner.get(n);
      if (j === undefined || n < k) continue;                           // outside the paths, or already counted from n
      if (i !== j) { cross++; perPath[i]++; perPath[j]++; }
      else if (Math.abs(at.get(k) - at.get(n)) !== 1) self++;
    }
  }
  return { cross, self, share: cross + self ? cross / (cross + self) : 0, perPath, covered: owner.size };
}

/** The nearest pair of an operation by hex distance to its numbers (the nearer one, then both together): a pair index, or -1 on a tie. */
export function nearestPair(board, op) {
  let best = Infinity, who = -1;
  board.sol.forEach((p, i) => {
    const a = distance(op, p.from), b = distance(op, p.to), d = Math.min(a, b) * 100 + a + b;
    if (d < best) { best = d; who = i; } else if (d === best) who = -1;
  });
  return who;
}

/** How a board's solution looks. */
export function shapeOf(board) {
  const paths = board.sol.map(p => p.cells), walls = wallsOf(paths), opCells = Object.keys(board.ops);
  const pairs = board.sol.map(p => {
    const len = p.cells.length, dist = distance(p.from, p.to), slack = len - 1 - dist;
    const own = p.cells.filter(k => k in board.ops);
    // operations lying on some shortest route between the numbers: on the straight hop
    const onHop = own.filter(k => distance(p.from, k) + distance(k, p.to) === dist).length;
    return { len, dist, slack, ops: own.length, onHop, bundled: dist <= BUNDLED.dist || slack <= BUNDLED.slack };
  });
  const nearOwn = opCells.filter(k => nearestPair(board, k) === board.sol.findIndex(p => p.cells.includes(k))).length;
  return {
    pairs, walls, field: board.cells.length, covered: walls.covered, coverage: walls.covered / board.cells.length,
    bundled: pairs.filter(p => p.bundled).length,
    nearOwn: opCells.length ? nearOwn / opCells.length : 0,         // the share of operations a glance at the map gives to the right pair
  };
}
