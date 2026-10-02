// Delta: boards, arithmetic and solving.
//
// A board is a field of hexes with gaps. Some hexes hold plain numbers, some hold operations (+4, −2, ×3, ÷2),
// the rest are blank. The player joins the numbers in pairs with paths that never cross or share a hex; going
// from one number to the other, each operation on the way changes the value, which must arrive exactly at the
// other number (whole numbers only; which end starts is for the player to work out). Every operation is used
// exactly once; blank hexes are optional.
//
// Generation lays random paths, puts operations on them, and computes the numbers. A board is kept only if
// exactly one way of pairing the numbers and sharing out the operations can actually be drawn, while the
// arithmetic alone allows others: those are the "this would work if it didn't cut off that" moments.

// ---------- levels ----------
// decoys: how many ways the arithmetic allows that the space rules out (at least one pairs the numbers
// differently from the answer); candidates: the most ways the arithmetic may allow, so it still narrows things.
export const LEVELS = {
  easy: { label: "Easy", radius: 3, gaps: 8, pairs: 2, len: [5, 8], ops: [2, 3], kinds: "+-", decoys: 1, candidates: 6, pairsShown: true },
  medium: { label: "Medium", radius: 3, gaps: 7, pairs: 3, len: [5, 8], ops: [2, 3], kinds: "+-×", decoys: 2, candidates: 12 },
  hard: { label: "Hard", radius: 4, gaps: 16, pairs: 3, len: [6, 10], ops: [3, 4], kinds: "+-×÷", decoys: 3, candidates: 20 },
};
export const CLUES = 2;            // clues per board outside Easy (Easy shows the pairs from the start)

// ---------- hexes (axial coordinates, pointy-top) ----------
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const key = (q, r) => `${q},${r}`;
export const unkey = k => k.split(",").map(Number);
export const neighbours = k => { const [q, r] = unkey(k); return DIRS.map(([dq, dr]) => key(q + dq, r + dr)); };
export const adjacent = (a, b) => neighbours(a).includes(b);
const inside = (q, r, R) => Math.abs(q) <= R && Math.abs(r) <= R && Math.abs(q + r) <= R;

// ---------- arithmetic ----------
const LIMIT = 9999;
/** The value after an operation like "×3", or null if it isn't allowed (÷ that doesn't divide, or out of range). */
export function apply(v, op) {
  const n = Number(op.slice(1));
  let w;
  switch (op[0]) {
    case "+": w = v + n; break;
    case "-": w = v - n; break;
    case "×": w = v * n; break;
    case "÷": if (v % n !== 0) return null; w = v / n; break;
    default: return null;
  }
  return Math.abs(w) <= LIMIT ? w : null;
}
/** How an operation is shown: a real minus sign. */
export const showOp = op => (op[0] === "-" ? `−${op.slice(1)}` : op);

/**
 * Where a drawn path stands: the numbers at its ends, the operations along it, and the value carried from
 * whichever end makes the arithmetic work. Returns { done, ok, from, to, value } (from/to only once ok).
 */
export function evaluate(board, cells) {
  const ends = cells.filter(k => k in board.nums);
  const ops = cells.filter(k => k in board.ops).map(k => board.ops[k]);
  const run = (start, list) => list.reduce((v, op) => (v === null ? null : apply(v, op)), board.nums[start]);
  const first = cells[0], last = cells[cells.length - 1];
  const value = first in board.nums ? run(first, ops) : null;
  if (cells.length < 2 || !(last in board.nums) || last === first || ends.length !== 2) return { done: false, ok: false, value };
  if (value === board.nums[last]) return { done: true, ok: true, from: first, to: last, value };
  const back = run(last, [...ops].reverse());
  if (back === board.nums[first]) return { done: true, ok: true, from: last, to: first, value: back };
  return { done: true, ok: false, value };
}

// ---------- random numbers ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, xs) => xs[Math.floor(rnd() * xs.length)];
const between = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const shuffle = (rnd, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };

// ---------- the field ----------
function field(rnd, R, gaps) {
  const all = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (inside(q, r, R)) all.push(key(q, r));
  const cells = new Set(all);
  const connected = () => {
    const start = cells.values().next().value, seen = new Set([start]), stack = [start];
    while (stack.length) for (const n of neighbours(stack.pop())) if (cells.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
    return seen.size === cells.size;
  };
  // gaps come in small clumps, so the field reads as islands and channels rather than moth holes
  let tries = 0;
  while (all.length - cells.size < gaps && tries++ < 400) {
    const seed = pick(rnd, [...cells]);
    const clump = [seed, ...shuffle(rnd, neighbours(seed).filter(n => cells.has(n))).slice(0, rnd() < 0.5 ? 1 : 0)];
    clump.forEach(k => cells.delete(k));
    if (!connected() || all.length - cells.size > gaps + 1) clump.forEach(k => cells.add(k));
  }
  return [...cells];
}

/** A random self-avoiding walk of `len` hexes through free hexes, or null. */
function walk(rnd, free, len) {
  const starts = shuffle(rnd, [...free]);
  for (const s of starts.slice(0, 12)) {
    const path = [s], used = new Set([s]);
    let steps = 0;
    const grow = () => {
      if (path.length === len) return true;
      if (++steps > 400) return false;
      for (const n of shuffle(rnd, neighbours(path[path.length - 1]).filter(n => free.has(n) && !used.has(n)))) {
        path.push(n); used.add(n);
        if (grow()) return true;
        path.pop(); used.delete(n);
      }
      return false;
    };
    if (grow()) return path;
  }
  return null;
}

/** Operations for a path and the number it ends on, starting from v; null if the values can't be kept sensible. */
function arithmetic(rnd, v, count, kinds) {
  const ops = [];
  for (let i = 0; i < count; i++) {
    const options = [];
    for (const kind of kinds) {
      if (kind === "+") options.push(`+${between(rnd, 1, 20)}`);
      if (kind === "-" && v > 2) options.push(`-${between(rnd, 1, Math.min(20, v - 1))}`);
      if (kind === "×" && v * 2 <= 600) options.push(`×${between(rnd, 2, Math.min(9, Math.floor(600 / v)))}`);
      if (kind === "÷") { const ds = [2, 3, 4, 5, 6, 7, 8, 9].filter(d => v % d === 0 && v / d >= 2); if (ds.length) options.push(`÷${pick(rnd, ds)}`); }
    }
    // the harder operations, when allowed, come up more often: they're where the thinking is
    const weighted = options.flatMap(o => (o[0] === "×" || o[0] === "÷" ? [o, o] : [o]));
    if (!weighted.length) return null;
    const op = pick(rnd, weighted);
    ops.push(op);
    v = apply(v, op);
  }
  return v >= 1 && v <= 999 ? { ops, end: v } : null;
}

// ---------- solving ----------
/**
 * Every way the arithmetic alone allows: each number paired with another, a direction, and the operations
 * it takes (as a bitmask over board op hexes), using every operation exactly once. Ignores space.
 */
export function arithmeticSolutions(board, cap = 60) {
  const ends = Object.keys(board.nums), opKeys = Object.keys(board.ops), m = opKeys.length;
  const ALL = (1 << m) - 1, maxOps = Math.min(m, 6);
  const pop = x => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  // reach[e][mask]: values reachable from number e using exactly the operations in mask, in some order
  const reach = {};
  for (const e of ends) {
    const R = new Array(1 << m);
    R[0] = new Set([board.nums[e]]);
    const masks = [...Array(1 << m).keys()].filter(x => x && pop(x) <= maxOps).sort((a, b) => pop(a) - pop(b));
    for (const mask of masks) {
      const out = new Set();
      for (let i = 0; i < m; i++) {
        if (!(mask >> i & 1) || !R[mask ^ (1 << i)]) continue;
        for (const v of R[mask ^ (1 << i)]) { const w = apply(v, board.ops[opKeys[i]]); if (w !== null) out.add(w); }
      }
      if (out.size) R[mask] = out;
    }
    reach[e] = R;
  }
  const valid = (from, to) => {
    const out = [];
    for (let mask = 1; mask <= ALL; mask++) if (reach[from][mask]?.has(board.nums[to])) out.push(mask);
    return out;
  };
  const table = {};
  for (const a of ends) for (const b of ends) if (a !== b) table[`${a}>${b}`] = valid(a, b);
  const found = [];
  const go = (left, used, chosen) => {
    if (found.length >= cap) return;
    if (!left.length) { if (used === ALL) found.push(chosen.slice()); return; }
    const [a, ...rest] = left;
    for (const b of rest) {
      const others = rest.filter(x => x !== b);
      for (const [from, to] of [[a, b], [b, a]]) {
        for (const mask of table[`${from}>${to}`]) {
          if (mask & used) continue;
          chosen.push({ from, to, mask });
          go(others, used | mask, chosen);
          chosen.pop();
        }
      }
    }
  };
  go(ends, 0, []);
  return { solutions: found, opKeys };
}

/** Orders of the operations in mask that take `from` exactly to `to`. */
function orders(board, opKeys, from, to, mask) {
  const idx = opKeys.map((_, i) => i).filter(i => mask >> i & 1), out = [];
  const go = (v, left, seq) => {
    if (!left.length) { if (v === board.nums[to]) out.push(seq.slice()); return; }
    for (const i of left) {
      const w = apply(v, board.ops[opKeys[i]]);
      if (w === null) continue;
      seq.push(opKeys[i]);
      go(w, left.filter(x => x !== i), seq);
      seq.pop();
    }
  };
  go(board.nums[from], idx, []);
  return out;
}

/**
 * Can these paths (each: from, to, and the operations it takes) all be drawn at once without crossing or
 * sharing hexes? Returns the routes ({ from, to, cells }) if so, null if not, and "unknown" if the search ran
 * out of budget.
 */
export function routeAll(board, opKeys, assignment, budget = 60000) {
  const cells = board.cells, index = new Map(cells.map((k, i) => [k, i]));
  const nbr = cells.map(k => neighbours(k).filter(n => index.has(n)).map(n => index.get(n)));
  const special = new Uint8Array(cells.length);                // numbers and operations: only their own path may enter
  for (const k of [...Object.keys(board.nums), ...Object.keys(board.ops)]) special[index.get(k)] = 1;
  const taken = new Uint8Array(cells.length);
  let steps = 0, unknown = false;
  const plans = assignment.map(a => ({ ...a, seqs: orders(board, opKeys, a.from, a.to, a.mask).map(seq => [a.from, ...seq, a.to].map(k => index.get(k))) }));
  if (plans.some(p => !p.seqs.length)) return null;
  plans.sort((x, y) => x.seqs.length - y.seqs.length);

  // can `to` still be reached from `from` through hexes this path may use?
  const reachable = (from, to, own) => {
    const seen = new Uint8Array(cells.length), stack = [from];
    seen[from] = 1;
    while (stack.length) {
      const c = stack.pop();
      if (c === to) return true;
      for (const n of nbr[c]) if (!seen[n] && !taken[n] && (!special[n] || own.has(n))) { seen[n] = 1; stack.push(n); }
    }
    return false;
  };
  const routes = [];
  const place = p => {
    if (p === plans.length) return true;
    for (const seq of plans[p].seqs) {
      const own = new Set(seq), path = [seq[0]];
      taken[seq[0]] = 1;
      // walk the waypoints in order, each leg through blank hexes
      const leg = w => {
        if (++steps > budget) { unknown = true; return false; }
        if (w === seq.length) {
          routes.push({ from: cells[seq[0]], to: cells[seq[seq.length - 1]], cells: path.map(i => cells[i]) });
          if (place(p + 1)) return true;
          routes.pop();
          return false;
        }
        const head = path[path.length - 1], goal = seq[w];
        for (const n of nbr[head]) {
          if (taken[n]) continue;
          if (n === goal) { taken[n] = 1; path.push(n); if (leg(w + 1)) return true; path.pop(); taken[n] = 0; continue; }
          if (special[n]) continue;                              // never through another number or operation
          taken[n] = 1; path.push(n);
          if (reachable(n, goal, own) && leg(w)) return true;
          path.pop(); taken[n] = 0;
          if (unknown) return false;
        }
        return false;
      };
      const done = leg(1);
      if (done) return true;
      taken[seq[0]] = 0;
      if (unknown) return false;
    }
    return false;
  };
  const ok = place(0);
  return ok ? routes : unknown ? "unknown" : null;
}

// ---------- generation ----------
/** A board for this seed and level, or null if none was found in time. */
export function generate(seed, levelId) {
  const L = LEVELS[levelId], rnd = rng(seed);
  const started = Date.now();
  for (let attempt = 0; attempt < 400 && Date.now() - started < 2500; attempt++) {
    const cells = field(rnd, L.radius, L.gaps);
    const free = new Set(cells), plan = [];
    for (let p = 0; p < L.pairs; p++) {
      const path = walk(rnd, free, between(rnd, L.len[0], L.len[1]));
      if (!path) break;
      path.forEach(k => free.delete(k));
      plan.push(path);
    }
    if (plan.length < L.pairs) continue;
    const nums = {}, ops = {}, sol = [];
    let ok = true;
    for (const path of plan) {
      const inner = path.slice(1, -1);
      const count = Math.min(inner.length, between(rnd, L.ops[0], L.ops[1]));
      const at = new Set(shuffle(rnd, [...inner.keys()]).slice(0, count));
      const start = between(rnd, 2, L.kinds.includes("×") ? 12 : 30);
      const math = arithmetic(rnd, start, count, L.kinds);
      if (!math) { ok = false; break; }
      // the operations sit on the path in the order they're applied
      const slots = inner.filter((_, i) => at.has(i));
      slots.forEach((k, i) => { ops[k] = math.ops[i]; });
      nums[path[0]] = start;
      nums[path[path.length - 1]] = math.end;
      sol.push({ from: path[0], to: path[path.length - 1], cells: path });
    }
    const values = Object.values(nums);
    if (!ok || new Set(values).size !== values.length) continue;
    const board = { level: levelId, radius: L.radius, cells, nums, ops, sol };
    const verdict = assess(board, L.candidates);
    if (!verdict || verdict.decoys < L.decoys || (L.pairs > 2 && !verdict.repaired)) continue;
    board.decoys = verdict.decoys;
    return board;
  }
  return null;
}

const pairing = s => s.map(x => [x.from, x.to].sort().join("~")).sort().join("|");

/**
 * How a board plays. null if more than one way of pairing the numbers and sharing out the operations can be
 * drawn, if the search couldn't tell, or if the arithmetic allows more than `cap` ways (too loose to reason
 * about). Otherwise: decoys, the ways the arithmetic allows that the space rules out, and repaired, whether
 * one of those pairs the numbers differently from the answer.
 */
export function assess(board, cap = 40) {
  const { solutions, opKeys } = arithmeticSolutions(board, cap + 1);
  if (solutions.length > cap) return null;
  let answer = null, decoys = 0;
  const ruledOut = [];
  for (const s of solutions) {
    const r = routeAll(board, opKeys, s);
    if (r === "unknown") return null;
    if (!r) { decoys++; ruledOut.push(s); continue; }
    if (answer) return null;
    answer = s;
  }
  if (!answer) return null;
  return { decoys, candidates: solutions.length, repaired: ruledOut.some(s => pairing(s) !== pairing(answer)) };
}

/** Whether the drawn paths solve the board: every number paired correctly and every operation used. */
export function isSolved(board, paths) {
  const used = new Set(), paired = new Set();
  for (const cells of paths) {
    const e = evaluate(board, cells);
    if (!e.ok) return false;
    cells.forEach(k => used.add(k));
    paired.add(e.from); paired.add(e.to);
  }
  return Object.keys(board.nums).every(k => paired.has(k)) && Object.keys(board.ops).every(k => used.has(k));
}
