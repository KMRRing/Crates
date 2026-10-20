// Mines' solver: what the open numbers prove, found the way a person finds it, cheapest reasoning first. It is how
// every field is proven to need no guess (mines-engine.js deals only fields it clears from the start), how a field's
// difficulty is measured, what a hint names, and how the computer players think. Pure, no page.
//
// The reasoning, in four levels (a round uses the lowest level that proves anything, so a field's grade is the
// hardest level it ever needed):
//   1 one number: a number whose mines are all found has its other neighbours safe; one with as many hidden
//     neighbours as mines still missing has them all mines;
//   2 two numbers: what two overlapping numbers prove together (the 1-1 and 1-2 patterns: the mines one must have
//     in the cells it shares with the other, and so what's left over on either side);
//   3 a group: the numbers round one number, every way of placing their mines tried, keeping what is the same in all
//     of them (a person's "if this were a mine, then…" over a small patch);
//   4 the count: near the end, the mines left over the cells left, the whole field at once.
// Anything beyond that (a deduction only a search of the whole field could find mid-game) is left out on purpose,
// so a field the solver clears is one a person can clear.

export const LEVELS = { 1: "one number", 2: "two numbers", 3: "a group of numbers", 4: "the mines left" };
const GROUP_MOST = 22;        // cells in a group (level 3): a patch a person can hold in mind
const COUNT_MOST = 40;        // hidden cells left before the count is used (level 4): the end of a field
const NODES = 60000;          // a search's budget in steps, so a hard patch can't stall a phone (counted, never timed,
                              // so every device finds the same)

/**
 * Every placement of mines on `vars` (cell numbers) that `rules` allow, searched: { any (one exists), forced
 * ([{ cell, mine }] the same in all of them) }, or null if the search ran out of budget. rules: [{ cells (a subset
 * of vars), lo, hi }], bounds on the mines among those cells.
 */
export function placements(vars, rules) {
  // the vars in the order the rules name them, so each rule's cells are assigned close together and a bad branch
  // is cut early
  const order = [], seenVar = new Set();
  for (const r of rules) for (const c of r.cells) if (!seenVar.has(c)) { seenVar.add(c); order.push(c); }
  for (const v of vars) if (!seenVar.has(v)) { seenVar.add(v); order.push(v); }
  const k = order.length, at = new Map(order.map((v, j) => [v, j]));
  const R = rules.filter(r => r.cells.length).map(r => ({ idx: r.cells.map(c => at.get(c)), lo: r.lo, hi: r.hi }));
  const of = Array.from({ length: k }, () => []);
  for (const r of R) for (const j of r.idx) of[j].push(r);
  const val = new Int8Array(k).fill(-1);
  const can = [new Uint8Array(k), new Uint8Array(k)];      // can[v][j]: some placement gives var j the value v
  let nodes = 0, broke = false;
  const fits = r => {
    let m = 0, free = 0;
    for (const j of r.idx) { if (val[j] === 1) m++; else if (val[j] === -1) free++; }
    return m <= r.hi && m + free >= r.lo;
  };
  const search = pos => {
    while (pos < k && val[pos] !== -1) pos++;               // past the var held fixed
    if (pos === k) return true;
    if (++nodes > NODES) { broke = true; return false; }
    for (const w of [0, 1]) {
      val[pos] = w;
      if (of[pos].every(fits) && search(pos + 1)) return true;
      if (broke) return false;
    }
    val[pos] = -1;
    return false;
  };
  // each var each way, unless a placement found already gave it that value: one placement settles every var at once
  let any = false;
  for (let j = 0; j < k; j++) for (const v of [0, 1]) {
    if (can[v][j]) continue;
    val.fill(-1);
    val[j] = v;
    if (of[j].every(fits) && search(0)) { any = true; for (let x = 0; x < k; x++) can[val[x]][x] = 1; }
    if (broke) return null;
  }
  const forced = [];
  for (let j = 0; j < k; j++) if (can[0][j] !== can[1][j]) forced.push({ cell: order[j], mine: !!can[1][j] });
  return { any, forced };
}

/**
 * A solver on a field (board: { n, nb, nums, mine, count }). sees(i): whether this player reads cell i's number (all
 * of them alone; a share of them together); an empty cell (0) is read by everyone, since opening it opens its
 * neighbours. State per cell: -1 hidden, 0 open, 1 a known mine.
 */
export function createSolver(board, { sees = null } = {}) {
  const { n, nb, nums } = board;
  const st = new Int8Array(n).fill(-1);
  const reads = i => nums[i] === 0 || !sees || sees(i);
  let mines = board.count;              // mines not yet known
  let hidden = n;                       // cells still hidden
  let safeLeft = n - board.count;       // safe cells still to open
  let tick = 1;                         // counts changes, so a pass knows which numbers changed since it last ran
  const changed = new Int32Array(n);    // when what cell i's number says about its neighbours last changed
  const clean = { 2: 0, 3: 0 };         // the tick at which a pass of that level last found nothing

  const touch = i => { tick++; changed[i] = tick; for (const j of nb[i]) changed[j] = tick; };
  /** Opens a cell known to be safe, and every cell an empty one opens round it. */
  function open(i) {
    if (st[i] !== -1) return;
    const stack = [i];
    while (stack.length) {
      const c = stack.pop();
      if (st[c] !== -1) continue;
      if (board.mine[c]) throw new Error(`the solver opened a mine at ${c}`);
      st[c] = 0; hidden--; safeLeft--; touch(c);
      if (nums[c] === 0) for (const j of nb[c]) if (st[j] === -1) stack.push(j);
    }
  }
  /** Notes a cell known to be a mine. */
  function markMine(i) {
    if (st[i] !== -1) return;
    if (!board.mine[i]) throw new Error(`the solver took a safe cell at ${i} for a mine`);
    st[i] = 1; hidden--; mines--; touch(i);
  }

  /** What a number says now: { cell, u (its hidden neighbours), r (the mines among them) }, or null if nothing. */
  function constraint(i) {
    if (st[i] !== 0 || !reads(i)) return null;
    const u = [];
    let r = nums[i];
    for (const j of nb[i]) { if (st[j] === -1) u.push(j); else if (st[j] === 1) r--; }
    return u.length ? { cell: i, u, r } : null;
  }
  function active() {
    const out = [];
    for (let i = 0; i < n; i++) { const c = constraint(i); if (c) out.push(c); }
    return out;
  }
  const indexed = cs => {               // hidden cell -> the numbers it's under
    const by = new Map();
    cs.forEach((c, k) => { for (const x of c.u) { let l = by.get(x); if (!l) by.set(x, l = []); l.push(k); } });
    return by;
  };

  // ---------- level 1: one number ----------
  function single(cs) {
    for (const c of cs) {
      if (c.r === 0) return { level: 1, from: [c.cell], cells: c.u, mine: false };
      if (c.r === c.u.length) return { level: 1, from: [c.cell], cells: c.u, mine: true };
    }
    return null;
  }

  // ---------- level 2: two numbers ----------
  function pair(cs) {
    const by = indexed(cs);
    for (let a = 0; a < cs.length; a++) {
      const A = cs[a], seen = new Set();
      for (const x of A.u) for (const b of by.get(x)) {
        if (b === a || seen.has(b)) continue;
        seen.add(b);
        const B = cs[b];
        if (changed[A.cell] <= clean[2] && changed[B.cell] <= clean[2]) continue;   // neither changed since a pass found nothing
        const inA = new Set(A.u), inB = new Set(B.u);
        const both = A.u.filter(y => inB.has(y)), onlyA = A.u.filter(y => !inB.has(y)), onlyB = B.u.filter(y => !inA.has(y));
        const lo = Math.max(0, A.r - onlyA.length, B.r - onlyB.length), hi = Math.min(both.length, A.r, B.r);
        const from = [A.cell, B.cell];
        if (onlyA.length && A.r - lo === 0) return { level: 2, from, cells: onlyA, mine: false };
        if (onlyA.length && A.r - hi === onlyA.length) return { level: 2, from, cells: onlyA, mine: true };
        if (onlyB.length && B.r - lo === 0) return { level: 2, from, cells: onlyB, mine: false };
        if (onlyB.length && B.r - hi === onlyB.length) return { level: 2, from, cells: onlyB, mine: true };
        if (hi === 0) return { level: 2, from, cells: both, mine: false };
        if (lo === both.length) return { level: 2, from, cells: both, mine: true };
      }
    }
    clean[2] = tick;
    return null;
  }

  // ---------- level 3: a group of numbers ----------
  function group(cs) {
    const by = indexed(cs);
    for (let a = 0; a < cs.length; a++) {
      const members = new Set([a]);
      for (const x of cs[a].u) for (const b of by.get(x)) members.add(b);
      if (members.size < 3) continue;                         // two numbers are level 2's
      const vars = [...new Set([...members].flatMap(m => cs[m].u))];
      if (vars.length > GROUP_MOST) continue;
      // every number touching the patch bounds it, exactly if all its hidden neighbours lie in it
      const inVars = new Set(vars), touching = [...new Set(vars.flatMap(v => by.get(v)))];
      if (!touching.some(t => changed[cs[t].cell] > clean[3])) continue;    // all as they were when a pass found nothing
      const rules = touching.map(t => {
        const c = cs[t], inside = c.u.filter(v => inVars.has(v)), out = c.u.length - inside.length;
        return { cells: inside, lo: Math.max(0, c.r - out), hi: Math.min(c.r, inside.length) };
      });
      const p = placements(vars, rules);
      if (p?.forced.length) {
        const mine = p.forced[0].mine;
        return { level: 3, from: [...members].map(m => cs[m].cell), cells: p.forced.filter(f => f.mine === mine).map(f => f.cell), mine };
      }
    }
    clean[3] = tick;
    return null;
  }

  // ---------- level 4: the mines left ----------
  function count(cs) {
    if (hidden > COUNT_MOST || hidden === 0) return null;
    const front = [...new Set(cs.flatMap(c => c.u))], inFront = new Set(front), rest = [];
    for (let i = 0; i < n; i++) if (st[i] === -1 && !inFront.has(i)) rest.push(i);
    const from = cs.map(c => c.cell);
    if (!front.length) {
      if (mines === 0) return { level: 4, from, cells: rest, mine: false };
      if (mines === rest.length) return { level: 4, from, cells: rest, mine: true };
      return null;
    }
    const exact = cs.map(c => ({ cells: c.u, lo: c.r, hi: c.r }));
    const p = placements(front, [...exact, { cells: front, lo: Math.max(0, mines - rest.length), hi: mines }]);
    if (!p) return null;
    if (p.forced.length) {
      const mine = p.forced[0].mine;
      return { level: 4, from, cells: p.forced.filter(f => f.mine === mine).map(f => f.cell), mine };
    }
    if (!rest.length) return null;
    // the cells no number touches: all safe if every placement of the front takes every mine left, all mines if
    // every placement leaves exactly enough to fill them
    const fewer = placements(front, [...exact, { cells: front, lo: Math.max(0, mines - rest.length), hi: mines - 1 }]);
    if (fewer && !fewer.any) return { level: 4, from, cells: rest, mine: false };
    const more = placements(front, [...exact, { cells: front, lo: Math.max(0, mines - rest.length + 1), hi: mines }]);
    if (more && !more.any) return { level: 4, from, cells: rest, mine: true };
    return null;
  }

  /** The cheapest deduction there is now, up to level `most`: { level, from (the numbers that prove it), cells, mine }, or null. */
  function next(most = 4) {
    const cs = active();
    return single(cs) || (most >= 2 && pair(cs)) || (most >= 3 && group(cs)) || (most >= 4 && count(cs)) || null;
  }
  /** Applies a deduction: its cells opened if safe, noted if mines. */
  function apply(d) { for (const c of d.cells) if (d.mine) markMine(c); else open(c); }
  /** After st was set from outside (a run's state loaded into it): the counts again, and every number as new. */
  function sync() {
    mines = board.count; hidden = 0; safeLeft = 0;
    for (let i = 0; i < n; i++) {
      if (st[i] === 1) mines--;
      if (st[i] === -1) hidden++;
      if (st[i] !== 0 && !board.mine[i]) safeLeft++;
    }
    tick++;
    changed.fill(tick);
  }

  return {
    st, open, markMine, next, apply, constraint, sync,
    get mines() { return mines; },
    get hidden() { return hidden; },
    get done() { return safeLeft === 0; },
  };
}

/**
 * Solves a field from its start, the way a person would: { solved, max (the hardest level used), rounds ({ level:
 * count }), steps ([{ level, cells, mine, from }] in order, with keepSteps) }. sees: the share of numbers this
 * player reads (createSolver); most: the hardest level to use.
 */
export function solve(board, { sees = null, most = 4, start = board.start, keepSteps = false } = {}) {
  const s = createSolver(board, { sees });
  s.open(start);
  const rounds = { 1: 0, 2: 0, 3: 0, 4: 0 }, steps = [];
  let max = 0;
  while (!s.done) {
    const d = s.next(most);
    if (!d) break;
    rounds[d.level]++;
    if (d.level > max) max = d.level;
    if (keepSteps) steps.push(d);
    s.apply(d);
  }
  return { solved: s.done, max, rounds, steps, st: s.st };
}
