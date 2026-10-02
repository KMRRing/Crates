// Delta: boards, arithmetic and solving.
//
// A board is a field of hexes with gaps. Some hexes hold plain numbers, some hold operations (+4, −2, ×3, ÷2),
// the rest are blank. The player joins the numbers in pairs with paths that never cross or share a hex; going
// from one number to the other, each operation on the way changes the value, which must arrive exactly at the
// other number (whole numbers only). A path runs from the number it's drawn from, so which end starts is for
// the player to work out. Values can become fractions (5 ÷ 4 = 1¼). Every operation is used exactly once;
// blank hexes are optional.
//
// Generation lays random paths, puts operations on them, and computes the numbers. A board is kept only if
// exactly one way of pairing the numbers and sharing out the operations can actually be drawn, while the
// arithmetic alone allows others, and only if it is full of tempting single paths: ones that add up and could be
// drawn on their own but belong to no answer, because they block another pair or use an operation another pair
// needs. Those are the "this works, but it cuts off that" moments, and they should be all over the board.

// ---------- levels ----------
// decoys: whole solutions the arithmetic allows that the space rules out; candidates: the most whole solutions
// the arithmetic may allow, so it still narrows things; lures: tempting single paths (see above) and spread, how
// many of the numbers they must touch. liveValue: the running value shows while drawing; verdicts: whether a
// finished path is marked right or wrong straight away, or only once every number is joined. big: round steps
// that make big numbers (×10, ×100, ×1,000, +300 on a round number…); fractions: ÷ may leave a fraction.
export const LEVELS = {
  easy: { label: "Easy", radius: 3, gaps: 8, pairs: 2, len: [5, 8], ops: [2, 3], kinds: "+-", start: [2, 30], step: [1, 20],
    decoys: 1, candidates: 6, lures: 2, spread: 2, pairsShown: true, liveValue: true, verdicts: "now" },
  medium: { label: "Medium", radius: 3, gaps: 7, pairs: 3, len: [5, 8], ops: [2, 3], kinds: "+-×", start: [2, 15], step: [1, 20],
    decoys: 2, candidates: 12, lures: 6, spread: 5, liveValue: true, verdicts: "now", big: true },
  hard: { label: "Hard", radius: 3, gaps: 5, pairs: 3, len: [6, 9], ops: [3, 4], kinds: "+-×÷", start: [3, 24], step: [2, 30],
    decoys: 3, candidates: 32, lures: 8, spread: 6, liveValue: false, verdicts: "end", big: true, fractions: true },
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
// Values are exact fractions [numerator, denominator] in lowest terms (denominator > 0). Boards store whole
// numbers as numbers and fractions as "n/d"; operations are a sign and a whole number ("×100", "÷4", "-2").
const LIMIT = 1e7;
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const frac = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
/** A board number (whole, or "n/d") as a fraction. */
export const valueOf = x => (typeof x === "number" ? [x, 1] : frac(...String(x).split("/").map(Number)));
const stored = ([n, d]) => (d === 1 ? n : `${n}/${d}`);
export const sameValue = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

/** The value after an operation like "×3", or null if it runs out of range. */
export function apply(v, op) {
  const k = Number(op.slice(1));
  let r;
  switch (op[0]) {
    case "+": r = frac(v[0] + k * v[1], v[1]); break;
    case "-": r = frac(v[0] - k * v[1], v[1]); break;
    case "×": r = frac(v[0] * k, v[1]); break;
    case "÷": r = frac(v[0], v[1] * k); break;
    default: return null;
  }
  return Math.abs(r[0] / r[1]) <= LIMIT && r[1] <= 1e6 ? r : null;
}

const GLYPHS = { "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/5": "⅕", "2/5": "⅖", "3/5": "⅗", "4/5": "⅘",
  "1/6": "⅙", "5/6": "⅚", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞" };
const grouped = n => n.toLocaleString("en-US");
/** How a value reads: 10,000 · ¾ · 2½ (a fraction without its own glyph reads 3/7). */
export function showValue(x) {
  const [n, d] = Array.isArray(x) ? x : valueOf(x);
  if (d === 1) return (n < 0 ? "−" : "") + grouped(Math.abs(n));
  const whole = Math.floor(Math.abs(n) / d), rest = Math.abs(n) % d;
  return (n < 0 ? "−" : "") + (whole ? grouped(whole) : "") + (GLYPHS[`${rest}/${d}`] || `${whole ? " " : ""}${rest}/${d}`);
}
/** How an operation reads: a real minus sign, and big numbers grouped (×1,000). */
export const showOp = op => `${op[0] === "-" ? "−" : op[0]}${grouped(Number(op.slice(1)))}`;

/** The value carried along a path from its first cell (a number), or null. */
export function valueAlong(board, cells) {
  if (!(cells[0] in board.nums)) return null;
  return cells.filter(k => k in board.ops).reduce((v, k) => (v === null ? null : apply(v, board.ops[k])), valueOf(board.nums[cells[0]]));
}

/**
 * Where a drawn path stands. It runs from the number it was drawn from: the value starts there and each
 * operation along the way changes it in turn. Returns { done (it reaches a second number), ok (the value
 * arrives exactly), from, to, value (so far, as a fraction; null if it ran out of range) }.
 */
export function evaluate(board, cells) {
  const first = cells[0], last = cells[cells.length - 1];
  const value = valueAlong(board, cells);
  const done = cells.length >= 2 && last in board.nums && last !== first && cells.filter(k => k in board.nums).length === 2;
  return { done, ok: done && sameValue(value, valueOf(board.nums[last])), from: first, to: last, value };
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

/**
 * Every operation that may follow value v, keeping the mental maths light at every size: times tables on small
 * numbers, round numbers times small ones, shifts by 10, 100 and 1,000, round steps on big round numbers, and
 * simple halves, thirds and quarters. Big numbers can only come from easy steps, so a big number is a hint at
 * the operation that made it (10,000 wants the ×100), never a sum like 259 × 13. Grouped by kind.
 */
function lightOps([n, d], L) {
  const has = k => L.kinds.includes(k), a = Math.abs(n / d), out = { "+": [], "-": [], "×": [], "÷": [] };
  const range = (lo, hi, f = x => x) => { const r = []; for (let x = lo; x <= hi; x++) r.push(f(x)); return r; };
  if (d === 1) {
    if (has("+")) {
      if (a <= 100) out["+"].push(...range(L.step[0], L.step[1], k => `+${k}`));
      if (L.big && n % 100 === 0) out["+"].push(...range(1, 9, k => `+${k * (n % 1000 === 0 ? 1000 : 100)}`));
    }
    if (has("-")) {
      if (a <= 100 && n > L.step[0] + 1) out["-"].push(...range(L.step[0], Math.min(L.step[1], n - 1), k => `-${k}`));
      if (L.big && n % 100 === 0 && n > 200) out["-"].push(...range(1, Math.min(9, n / 100 - 1), k => `-${k * 100}`));
    }
    if (has("×")) {
      if (a <= 12) out["×"].push(...range(2, 9, k => `×${k}`));
      else if ((a <= 100 && (n % 10 === 0 || a <= 25)) || (n % 100 === 0 && a <= 5000)) out["×"].push(...range(2, 5, k => `×${k}`));
      if (L.big && a <= 100) out["×"].push(...[10, 100, 1000].filter(x => a * x <= 100000).map(x => `×${x}`));
    }
    if (has("÷")) {
      out["÷"].push(...range(2, 9).filter(k => n % k === 0 && a / k >= 1 && (a <= 100 || (n % 100 === 0 && (n / 100) % k === 0))).map(k => `÷${k}`));
      if (L.big) out["÷"].push(...[10, 100, 1000].filter(k => n % k === 0 && a / k >= 2).map(k => `÷${k}`));
      if (L.fractions && a <= 12) out["÷"].push(...[2, 3, 4, 5, 6, 8].filter(k => n % k !== 0).map(k => `÷${k}`));
    }
  } else if (L.fractions) {
    // a fraction: clear it (¾ × 4 = 3), add or take a whole number (¾ + 2 = 2¾), or halve it
    if (has("×")) out["×"].push(...[d, 2 * d].filter(k => k <= 12).map(k => `×${k}`), ...([2, 4, 5].includes(d) && a <= 10 ? ["×10"] : []));
    if (has("+")) out["+"].push(...range(1, 9, k => `+${k}`));
    if (has("-") && a > 2) out["-"].push(...range(1, Math.floor(a) - 1, k => `-${k}`));
    if (has("÷") && d * 2 <= 8 && a < 10) out["÷"].push("÷2");
  }
  return out;
}

/**
 * The next operation for a path at value v. Usually a kind, then an operand; × and ÷ come up more often than
 * + and − (they're where the thinking is), a ÷ that leaves a fraction most of all. Often it reuses an operation
 * already on the board, so other pairs could use it too: that's what makes the lures.
 */
function nextOp(rnd, v, L, onBoard) {
  const byKind = lightOps(v, L);
  const all = Object.values(byKind).flat();
  if (!all.length) return null;
  const again = onBoard.filter(op => all.includes(op));
  if (again.length && rnd() < 0.2) return pick(rnd, again);
  const leavesFraction = op => op[0] === "÷" && v[1] === 1 && v[0] % Number(op.slice(1)) !== 0;
  const kinds = Object.keys(byKind).filter(k => byKind[k].length)
    .flatMap(k => Array(k === "÷" && byKind[k].some(leavesFraction) ? 4 : k === "×" || k === "÷" ? 2 : 1).fill(k));
  const kind = pick(rnd, kinds), choices = byKind[kind];
  const fractional = choices.filter(leavesFraction);
  return pick(rnd, fractional.length && rnd() < 0.6 ? fractional : choices);
}

/** A value a board can show as a number: positive, at most 100,000, a whole number or a simple fraction. */
const showable = ([n, d]) => n > 0 && n / d <= 100000 && [1, 2, 3, 4, 5, 6, 8].includes(d) && (d === 1 || n / d < 100);

/** Operations for a path and the value it ends on, starting from a whole number; null if it can't stay showable. */
function arithmetic(rnd, start, count, L, onBoard) {
  let v = [start, 1];
  const ops = [];
  for (let i = 0; i < count; i++) {
    const op = nextOp(rnd, v, L, onBoard);
    if (!op) return null;
    ops.push(op);
    v = apply(v, op);
    if (!v) return null;
  }
  return showable(v) ? { ops, end: v } : null;
}

// ---------- solving ----------
/**
 * Every way the arithmetic alone allows: each number paired with another, a direction, and the operations
 * it takes (as a bitmask over board op hexes), using every operation exactly once. Ignores space.
 */
const SCALE = 840;
export function arithmeticSolutions(board, cap = 60) {
  const ends = Object.keys(board.nums), opKeys = Object.keys(board.ops), m = opKeys.length;
  const ALL = (1 << m) - 1, maxOps = Math.min(m, 5);
  const pop = x => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  // the masks to fill, smallest first (built once), and the operations unpacked for the hot loop below
  const masks = [];
  for (let x = 1; x <= ALL; x++) if (pop(x) <= maxOps) masks.push(x);
  masks.sort((a, b) => pop(a) - pop(b));
  // values are counted in 840ths, so every fraction with a denominator up to 8 is a whole number of them and the
  // search can use plain numbers (paths through rarer fractions, like sevenths of a third, aren't followed; nor
  // are paths of more than five operations: boards are built with at most four per path)
  const kind = opKeys.map(k => board.ops[k][0]), num = opKeys.map(k => Number(board.ops[k].slice(1)));
  const step = (v, i) => {
    let w;
    switch (kind[i]) {
      case "+": w = v + num[i] * SCALE; break;
      case "-": w = v - num[i] * SCALE; break;
      case "×": w = v * num[i]; break;
      default: if (v % num[i] !== 0) return null; w = v / num[i];
    }
    return Math.abs(w) <= LIMIT * SCALE ? w : null;
  };
  const scaled = x => { const [n, d] = valueOf(x); return n * (SCALE / d); };
  // reach[e][mask]: values reachable from number e using exactly the operations in mask, in some order
  const reach = {};
  for (const e of ends) {
    const R = new Array(ALL + 1);
    R[0] = [scaled(board.nums[e])];
    for (const mask of masks) {
      const out = new Set();
      for (let i = 0; i < m; i++) {
        if (!(mask >> i & 1)) continue;
        const before = R[mask ^ (1 << i)];
        if (!before) continue;
        for (const v of before) { const w = step(v, i); if (w !== null) out.add(w); }
      }
      if (out.size) R[mask] = [...out];
    }
    reach[e] = R.map(list => list && new Set(list));
  }
  const valid = (from, to) => {
    const out = [];
    const target = scaled(board.nums[to]);
    for (let mask = 1; mask <= ALL; mask++) if (reach[from][mask]?.has(target)) out.push(mask);
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
  return { solutions: found, opKeys, table };
}

/** Orders of the operations in mask that take `from` exactly to `to`. */
function orders(board, opKeys, from, to, mask) {
  const idx = opKeys.map((_, i) => i).filter(i => mask >> i & 1), out = [];
  const target = valueOf(board.nums[to]);
  const go = (v, left, seq) => {
    if (!left.length) { if (sameValue(v, target)) out.push(seq.slice()); return; }
    for (const i of left) {
      const w = apply(v, board.ops[opKeys[i]]);
      if (w === null) continue;
      seq.push(opKeys[i]);
      go(w, left.filter(x => x !== i), seq);
      seq.pop();
    }
  };
  go(valueOf(board.nums[from]), idx, []);
  return out;
}

/**
 * Can these paths (each: from, to, and the operations it takes) all be drawn at once without crossing or
 * sharing hexes? Returns the routes ({ from, to, cells }) if so, null if not, and "unknown" if the search ran
 * out of budget.
 */
export function routeAll(board, opKeys, assignment, budget = 25000) {
  const cells = board.cells, index = new Map(cells.map((k, i) => [k, i]));
  const nbr = cells.map(k => neighbours(k).filter(n => index.has(n)).map(n => index.get(n)));
  const special = new Uint8Array(cells.length);                // numbers and operations: only their own path may enter
  for (const k of [...Object.keys(board.nums), ...Object.keys(board.ops)]) special[index.get(k)] = 1;
  const taken = new Uint8Array(cells.length);
  let steps = 0, unknown = false;
  const plans = assignment.map(a => {
    const seqs = orders(board, opKeys, a.from, a.to, a.mask).map(seq => [a.from, ...seq, a.to].map(k => index.get(k)));
    const all = seqs[0] || [];
    return { ...a, seqs, all, ownSet: new Set(all) };
  });
  if (plans.some(p => !p.seqs.length)) return null;
  plans.sort((x, y) => x.seqs.length - y.seqs.length);

  // the hexes reachable from `from` through free hexes and this path's own numbers and operations
  const reach = (from, own) => {
    const seen = new Uint8Array(cells.length), stack = [from];
    seen[from] = 1;
    while (stack.length) {
      const c = stack.pop();
      for (const n of nbr[c]) if (!seen[n] && !taken[n] && (!special[n] || own.has(n))) { seen[n] = 1; stack.push(n); }
    }
    return seen;
  };
  // after a step: can this path still reach all its remaining waypoints, and can every later path still join
  // all of its own? (Cutting a later path off is found here at once, not after trying every route.)
  const stillPossible = (p, head, seq, w, own) => {
    const mine = reach(head, own);
    for (let i = w; i < seq.length; i++) if (!mine[seq[i]]) return false;
    for (let q = p + 1; q < plans.length; q++) {
      const { all, ownSet } = plans[q];
      const seen = reach(all[0], ownSet);
      for (const c of all) if (!seen[c]) return false;
    }
    return true;
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
          if (stillPossible(p, n, seq, w, own) && leg(w)) return true;
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
/**
 * A board for this seed and level. The same seed always gives the same board (tries are counted, not timed).
 * It starts strict about how much the space must decide; if nothing turns up, it relaxes that step by step,
 * but never the rule that exactly one answer can be drawn. stats, if given, counts why tries failed.
 */
export function generate(seed, levelId, stats = null) {
  const L = LEVELS[levelId], rnd = rng(seed);
  const phases = [
    { tries: 200, decoys: L.decoys, candidates: L.candidates, repaired: L.pairs > 2, lures: L.lures, spread: L.spread },
    { tries: 200, decoys: Math.max(1, L.decoys - 1), candidates: L.candidates * 2, repaired: false, lures: Math.ceil(L.lures / 2), spread: L.spread - 1 },
    { tries: 600, decoys: 0, candidates: L.candidates * 4, repaired: false, lures: 0, spread: 0 },
  ];
  for (const phase of phases) {
    const board = attempt(rnd, L, levelId, phase, stats);
    if (board) return board;
  }
  return null;
}

function attempt(rnd, L, levelId, phase, stats) {
  const note = why => { if (stats) stats[why] = (stats[why] || 0) + 1; };
  for (let t = 0; t < phase.tries; t++) {
    const cells = field(rnd, L.radius, L.gaps);
    const free = new Set(cells), plan = [];
    for (let p = 0; p < L.pairs; p++) {
      const path = walk(rnd, free, between(rnd, L.len[0], L.len[1]));
      if (!path) break;
      path.forEach(k => free.delete(k));
      plan.push(path);
    }
    if (plan.length < L.pairs) { note("no room for the paths"); continue; }
    const nums = {}, ops = {}, sol = [];
    let ok = true;
    for (const path of plan) {
      const inner = path.slice(1, -1);
      const count = Math.min(inner.length, between(rnd, L.ops[0], L.ops[1]));
      const at = new Set(shuffle(rnd, [...inner.keys()]).slice(0, count));
      // a few goes at numbers that aren't on the board yet
      const taken = new Set(Object.values(nums).map(String));
      let math = null, start = 0;
      for (let go = 0; go < 6 && !math; go++) {
        start = between(rnd, L.start[0], L.start[1]);
        if (taken.has(String(start))) continue;
        const m = arithmetic(rnd, start, count, L, Object.values(ops));
        if (m && !taken.has(String(stored(m.end))) && !sameValue(m.end, [start, 1])) math = m;
      }
      if (!math) { ok = false; break; }
      // the operations sit on the path in the order they're applied
      const slots = inner.filter((_, i) => at.has(i));
      slots.forEach((k, i) => { ops[k] = math.ops[i]; });
      nums[path[0]] = start;
      nums[path[path.length - 1]] = stored(math.end);
      sol.push({ from: path[0], to: path[path.length - 1], cells: path });
    }
    const values = Object.values(nums).map(String);
    if (!ok || new Set(values).size !== values.length) { note("numbers clash"); continue; }
    const board = { level: levelId, radius: L.radius, cells, nums, ops, sol };
    const verdict = assess(board, phase.candidates, stats, phase);
    if (!verdict) continue;
    if (verdict.decoys < phase.decoys || (phase.repaired && !verdict.repaired)) { note("arithmetic gives it away"); continue; }
    board.decoys = verdict.decoys;
    board.lures = verdict.lures;
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
export function assess(board, cap = 40, stats = null, want = { lures: 0, spread: 0 }) {
  const note = why => { if (stats) stats[why] = (stats[why] || 0) + 1; };
  const { solutions, opKeys, table } = arithmeticSolutions(board, cap + 1);
  if (solutions.length > cap) { note("arithmetic too loose"); return null; }
  // the answer a board was built from; if the board is fair, it is the only one that can be drawn
  const maskOf = cells => cells.reduce((m, k) => (k in board.ops ? m | (1 << opKeys.indexOf(k)) : m), 0);
  const intended = board.sol.map(p => ({ from: p.from, to: p.to, mask: maskOf(p.cells) }));
  const lures = luresOf(board, opKeys, table, intended, want);
  if (lures.count < want.lures || lures.spread < want.spread) { note("too few lures"); return null; }
  let answer = null, decoys = 0;
  const ruledOut = [];
  for (const s of solutions) {
    const r = routeAll(board, opKeys, s);
    if (r === "unknown") { note("search ran out"); return null; }
    if (!r) { decoys++; ruledOut.push(s); continue; }
    if (answer) { note("two answers"); return null; }
    answer = s;
  }
  if (!answer) return null;
  return { decoys, candidates: solutions.length, repaired: ruledOut.some(s => pairing(s) !== pairing(answer)), lures: lures.count, spread: lures.spread };
}

/**
 * Lures: single paths that add up and can be drawn on their own, but aren't part of the answer, so taking one
 * blocks another pair or uses an operation another pair needs. Counts them (stopping once there are enough)
 * and how many of the numbers they touch.
 */
function luresOf(board, opKeys, table, answer, want) {
  const inAnswer = new Set(answer.map(a => `${a.from}>${a.to}>${a.mask}`));
  let count = 0;
  const touched = new Set();
  for (const [pair, masks] of Object.entries(table)) {
    const [from, to] = pair.split(">");
    for (const mask of masks) {
      if (count >= want.lures && touched.size >= want.spread) return { count, spread: touched.size };
      if (inAnswer.has(`${from}>${to}>${mask}`)) continue;
      if (count >= want.lures && touched.has(from) && touched.has(to)) continue;   // adds nothing now
      const r = routeAll(board, opKeys, [{ from, to, mask }], 1500);
      if (!r || r === "unknown") continue;
      count++;
      touched.add(from); touched.add(to);
    }
  }
  return { count, spread: touched.size };
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
