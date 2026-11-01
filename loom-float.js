// Loom's float puzzle, pure (no page; tests/loom-float.mjs runs it in Node, loom-cloth.js draws it, loom.js plays it).
//
// A cloth is warp threads (the lengthwise ones, a column each) crossed by picks of weft (the crosswise ones, a row each).
// At every crossing exactly one yarn shows on the face: the warp thread where it lies over the weft, the weft where it
// lies over the warp. A yarn that stays over several crossings in a row is a float, and a line's clue is the lengths of
// its own yarn's floats, in order, as a nonogram's clue is its runs: "3 1 2" on a pick means its weft shows over three
// crossings, then one, then two. Gold thread (a chapter's twist) is a third yarn laid over the ground: where it shows it
// hides both, and a line's clue then lists gold's floats in with its own, in the order they come.
//
// What a line counts is the colour that shows, not the yarn: a crossing whose warp and weft are the same colour shows
// that colour whichever lies over, so the cell is settled before you start (it is "tied down") and a float runs on across
// it. That is how stripes and plaids come to bridge the floats of a tartan.
//
// A shaft is a frame of heddles lifting its warp threads together, so threads on one shaft are alike in every pick, and
// picks that lift the same shafts are alike in every thread: a puzzle may say which columns share a shaft and which rows
// are lifted alike (`tie`), and then one tap on a cell sets every cell it is tied to. The solving is the nonogram line
// solver's (nonogram-engine.js `settle`), given each line as the three things it can tell apart: a crossing that isn't
// this line's yarn or gold, the line's own yarn, gold.

import { settle, overlap } from "./nonogram-engine.js";

export const WARP = 0, WEFT = 1, GOLD = 2;               // what shows at a crossing
export const STATES = [WARP, WEFT, GOLD];
const BITS = 1 << WARP | 1 << WEFT;                       // the states a plain crossing may be in
const popcount = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };

/**
 * A puzzle from its cloth. `warp[c]` and `weft[r]` are the yarns' colour indices; `gold` the gold thread's colour index
 * (-1 for none, and it is no yarn's colour); `cells` the states that show (row by row, w × h) which clues are made from;
 * `tie` optionally { col: class per column, row: class per row }.
 */
export function makePuzzle({ w, h, warp, weft, gold = -1, cells, tie = null, given = [] }) {
  const p = { w, h, warp, weft, gold, tie, sol: Uint8Array.from(cells), n: w * h };
  p.tied = new Uint8Array(p.n);                           // crossings whose yarns are one colour: settled, nothing to choose
  for (let r = 0, i = 0; r < h; r++) for (let c = 0; c < w; c++, i++) if (warp[c] === weft[r]) { p.tied[i] = 1; p.sol[i] = WARP; }
  // the variables: a cell, or every cell tied to it by shaft. A crossing of one colour is its own, whatever the shafts
  // would do there, since both of its yarns show alike: it must not drag the cells that share its shafts with it.
  p.cls = new Int32Array(p.n);
  const ids = new Map();
  for (let r = 0, i = 0; r < h; r++) for (let c = 0; c < w; c++, i++) {
    const key = tie && !p.tied[i] ? `${tie.col[c]}:${tie.row[r]}` : String(i);
    if (!ids.has(key)) ids.set(key, ids.size);
    p.cls[i] = ids.get(key);
  }
  p.classes = ids.size;
  p.given = new Uint8Array(p.classes);                    // classes pre-woven for you, so that the puzzle has one answer
  for (const i of given) p.given[p.cls[i]] = 1;
  p.lines = [];                                           // rows first, then columns, as the nonogram numbers them
  for (let r = 0; r < h; r++) p.lines.push({ own: weft[r], cells: Array.from({ length: w }, (_, c) => r * w + c) });
  for (let c = 0; c < w; c++) p.lines.push({ own: warp[c], cells: Array.from({ length: h }, (_, r) => r * w + c) });
  p.clues = p.lines.map(l => cluesOfLine(p, l, p.sol));
  p.through = Array.from({ length: p.classes }, () => new Set());
  p.lines.forEach((l, k) => { for (const i of l.cells) p.through[p.cls[i]].add(k); });
  return p;
}

/** The colour that shows at cell i when it is in state s. */
export const shows = (p, i, s) => (s === WARP ? p.warp[i % p.w] : s === WEFT ? p.weft[Math.floor(i / p.w)] : p.gold);
/** What a line makes of state s at cell i: 0 a crossing that isn't its yarn's or gold, 1 its own yarn, 2 gold. */
const UNSET = 255;                                       // a crossing a player hasn't set
const kindOf = (p, line, i, s) => {
  if (s === UNSET) return 0;
  const v = shows(p, i, s);
  return v === line.own ? 1 : v === p.gold ? 2 : 0;
};

/** A line's clue from the states that show along it: [[length, 1 (own) | 2 (gold)], …]. */
function cluesOfLine(p, line, states) {
  const runs = [];
  let last = 0;
  for (const i of line.cells) {
    const k = kindOf(p, line, i, states[i]);
    if (k && k === last) runs[runs.length - 1][0]++;
    else if (k) runs.push([1, k]);
    last = k;
  }
  return runs;
}
/** A clue as the cloth would show it: the lengths of the line's own floats and, apart, gold's. */
export const clueText = runs => runs.map(([n, k]) => ({ n, gold: k === 2 }));

// ---------- the solver ----------
/** Whether the player can't change crossing i: its yarns are one colour, or it is pre-woven. */
export const fixed = (p, i) => p.tied[i] === 1 || p.given[p.cls[i]] === 1;
/** The state masks to begin with: a fixed crossing settled, the rest open to the states the puzzle allows. */
export function start(p) {
  const st = new Uint8Array(p.classes), open = p.gold >= 0 ? BITS | 1 << GOLD : BITS;
  for (let i = 0; i < p.n; i++) st[p.cls[i]] = p.tied[i] || p.given[p.cls[i]] ? 1 << p.sol[i] : open;
  return st;
}
const lineMask = (p, line, st) => {
  const a = new Uint8Array(line.cells.length);
  line.cells.forEach((i, x) => { let m = 0; for (const s of STATES) if (st[p.cls[i]] >> s & 1) m |= 1 << kindOf(p, line, i, s); a[x] = m; });
  return a;
};

/**
 * Applies a line rule (settle by default, or the simpler overlap) until no line says more. Changes `st` in place and
 * returns the classes it settled in order, or null if the clues contradict what is known. `allow(k)` says whether line k's
 * clue may be used.
 */
export function propagate(p, st, rule = settle, allow = null) {
  const queue = [], queued = new Set(), settled = [];
  for (let k = 0; k < p.lines.length; k++) { queue.push(k); queued.add(k); }
  while (queue.length) {
    const k = queue.shift();
    queued.delete(k);
    if (allow && !allow(k)) continue;
    const line = p.lines[k], out = rule(lineMask(p, line, st), p.clues[k]);
    if (!out) return null;
    const nxt = new Map();
    line.cells.forEach((i, x) => {
      const c = p.cls[i];
      let m = st[c];
      for (const s of STATES) if ((m >> s & 1) && !(out[x] >> kindOf(p, line, i, s) & 1)) m &= ~(1 << s);
      nxt.set(c, (nxt.get(c) ?? st[c]) & m);
    });
    for (const [c, m] of nxt) {
      if (m === 0) return null;
      if (m !== st[c]) {
        if (popcount(m) === 1) settled.push(c);
        st[c] = m;
        for (const j of p.through[c]) if (!queued.has(j)) { queue.push(j); queued.add(j); }
      }
    }
  }
  return settled;
}
export const isKnown = m => m !== 0 && (m & (m - 1)) === 0;
export const done = st => st.every(isKnown);
/** The state a known class is in. */
export const stateOf = m => 31 - Math.clz32(m);

/**
 * How many ways the clues can be met (up to `limit`), by logic and then a search: { count, nodes }. `nodes` past `max`
 * gives up with count -1 (too deep to prove).
 */
export function count(p, { limit = 2, max = 20000, from = null, keep = null } = {}) {
  let found = 0, nodes = 0;
  const go = st => {
    if (found >= limit || nodes > max) return;
    nodes++;
    if (propagate(p, st) === null) return;
    if (done(st)) { found++; keep?.push(Uint8Array.from(st)); return; }
    let pick = -1, best = 9;
    for (let c = 0; c < st.length; c++) { const b = popcount(st[c]); if (b > 1 && b < best) { best = b; pick = c; } }
    for (const s of STATES) if (st[pick] >> s & 1) { const sub = Uint8Array.from(st); sub[pick] = 1 << s; go(sub); }
  };
  go(from ? Uint8Array.from(from) : start(p));
  return nodes > max && found < limit ? { count: -1, nodes } : { count: found, nodes };
}

/** How hard a puzzle is: 1 if the simple overlap rules alone finish it, 2 if full line logic does, 3 if it needs a guess; 0 if it has no single answer. */
export function grade(p) {
  const a = start(p);
  if (propagate(p, a, overlap) !== null && done(a)) return 1;
  const b = start(p);
  if (propagate(p, b) !== null && done(b)) return 2;
  return count(p).count === 1 ? 3 : 0;
}

/**
 * One step a person could take: a class the line logic settles from what is known, with the line that says so, or
 * null when nothing is settled by one line alone. `known` is the player's states (masks), `from` where a hint looks.
 */
export function nextStep(p, known) {
  const st = Uint8Array.from(known);
  for (const rule of [overlap, settle]) {
    for (let k = 0; k < p.lines.length; k++) {
      const line = p.lines[k], out = rule(lineMask(p, line, st), p.clues[k]);
      if (!out) continue;
      for (const [x, i] of line.cells.entries()) {
        const c = p.cls[i];
        let m = st[c];
        for (const s of STATES) if ((m >> s & 1) && !(out[x] >> kindOf(p, line, i, s) & 1)) m &= ~(1 << s);
        if (m !== st[c] && isKnown(m)) return { line: k, cell: i, state: stateOf(m) };
      }
    }
  }
  return null;
}

/** Whether every clue is met by the states in `cells` (a player's cloth, every crossing set): what the win asks. */
export function met(p, cells) {
  return p.lines.every((l, k) => {
    const runs = cluesOfLine(p, l, cells), want = p.clues[k];
    return runs.length === want.length && runs.every((r, j) => r[0] === want[j][0] && r[1] === want[j][1]);
  });
}
/** Whether a line's clue is met by the states set so far (an unset crossing counts as no yarn of its own). */
export function lineMet(p, k, cells) {
  const l = p.lines[k], runs = cluesOfLine(p, l, cells), want = p.clues[k];
  return runs.length === want.length && runs.every((r, j) => r[0] === want[j][0] && r[1] === want[j][1]);
}

/**
 * Pre-weaves crossings until the puzzle has one answer: where two answers differ, one crossing is given as it is in the
 * cloth. Returns how many it gave, or -1 if more than `most` were needed (the cloth is no good for a puzzle) or the search
 * was too deep to prove.
 */
export function makeUnique(p, most = 3, pick = n => 0) {
  let gave = 0;
  for (;;) {
    const sols = [], r = count(p, { limit: 2, keep: sols });
    if (r.count === 1) return gave;
    if (r.count !== 2 || gave >= most) return -1;
    const differ = [];
    for (let c = 0; c < p.classes; c++) if (sols[0][c] !== sols[1][c] && !p.given[c]) differ.push(c);
    if (!differ.length) return -1;
    const c = differ[pick(differ.length)];
    p.given[c] = 1;
    gave++;
  }
}
