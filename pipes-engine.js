// Pipes on the board: Pipe Dream's rules (1989). Pieces come off a queue and go on any square you tap, never turned;
// after a countdown the oil leaves its wellhead and runs from piece to piece, and it must pass through the level's
// quota of pipe before it spills. A piece of yours the oil hasn't reached can be blasted out by laying another over
// it, at a cost. Pure: the page (pipes.js) draws it and runs the clock, tests/pipes.mjs plays it.
//
// Squares are numbered c = y * COLS + x. Sides: 0 N, 1 E, 2 S, 3 W. A piece is its channels, each a pair of sides the
// oil can pass between; a crossing has two, and the oil may pass through it twice, once each way.

export const COLS = 7, ROWS = 9;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const back = d => (d + 2) % 4;
export const PIECES = { h: [[1, 3]], v: [[0, 2]], ne: [[0, 1]], nw: [[0, 3]], se: [[2, 1]], sw: [[2, 3]], x: [[0, 2], [1, 3]] };
export const KINDS = Object.keys(PIECES);
// the queue is dealt in bags of thirteen, shuffled: two of each straight and bend, one crossing. A bag can't leave you
// waiting long for the bend you need, as a stream of independent draws can (Tetris's bag, for the same reason).
const BAG = ["h", "h", "v", "v", "ne", "ne", "nw", "nw", "se", "se", "sw", "sw", "x"];
export const POINTS = { pipe: 50, loop: 200, pump: 250, terminal: 1000, unused: -25, blast: -50, early: 10 };
export const HURRY = 8;          // Hurry: the oil runs this many times faster, and what it fills scores double
export const TANK = 4;           // a tank takes this many times longer to fill than a pipe
export const BLAST_MS = 700;     // a blast takes this long: no piece can be laid meanwhile
export const SHOWN = 5;          // pieces of the queue on show

// ---------- chance, seeded ----------
/** A 32-bit hash of a few integers: the seed of one stream (a level's board, a bag of its queue). */
export function mix(...xs) {
  let h = 0x9E3779B9;
  for (const x of xs) { h = Math.imul(h ^ (x >>> 0), 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffled(a, r) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// ---------- the levels ----------
/**
 * What level n asks: the pipe the oil must pass through (quota), how long a pipe takes to fill (fill, ms), the time
 * before the oil leaves (countdown, ms), and what's on the board: rock, pumps (a bonus for the oil passing), a tank
 * (slow to fill: time in hand) and, from level 4, a terminal (the oil led into it once the quota is met pays a bonus
 * and ends the level cleanly; led into it sooner, it's refused, a spill). Faster and longer every level, to a floor.
 */
export function levelOf(n) {
  return {
    n,
    quota: Math.min(32, 6 + 2 * n),
    fill: Math.max(750, Math.round(3000 * 0.9 ** (n - 1))),
    countdown: Math.max(8000, 25000 - 1500 * (n - 1)),
    rocks: Math.min(12, n - 1),
    pumps: n < 3 ? 0 : n < 7 ? 1 : 2,
    tanks: n < 5 ? 0 : n < 10 ? 1 : 2,
    terminal: n >= 4,
  };
}
const at = (x, y) => y * COLS + x;
export const xy = c => [c % COLS, Math.floor(c / COLS)];
const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
/** The square beyond c on side d, or -1 off the board. */
export function beyond(c, d) { const [x, y] = xy(c), nx = x + DIRS[d][0], ny = y + DIRS[d][1]; return inside(nx, ny) ? at(nx, ny) : -1; }

/**
 * Level n of the run on seed, at a pace (1, or slower: 1.5 or 2, the countdown and the oil's every pipe taking that
 * many times as long; the board itself is the same at every pace): { seed, n, ...levelOf(n), pace, cells, source,
 * terminal }. cells[c] is null for an open
 * square, else what's fixed there: { k: "rock" }, { k: "source", d } (the wellhead, its outlet on side d),
 * { k: "terminal", d } (its inlet on side d), { k: "pump" | "tank", piece: "h" | "v" }. The same for everyone on the
 * same seed. Every board is checked: the wellhead's outlet clear for two squares, the terminal's inlet clear, a pump or
 * tank open at both ends, and nearly every open square reachable from the wellhead.
 */
export function deal(seed, n, pace = 1) {
  const lv = levelOf(n);
  for (let attempt = 0; ; attempt++) {
    const r = rng(mix(seed, n, attempt, 1)), cells = Array(COLS * ROWS).fill(null);
    const free = c => c >= 0 && !cells[c];
    const keep = new Set();                                     // squares that must stay open
    // the wellhead, off the edge ring, its outlet facing two open squares
    const sx = 1 + Math.floor(r() * (COLS - 2)), sy = 1 + Math.floor(r() * (ROWS - 2)), source = at(sx, sy);
    const outs = [0, 1, 2, 3].filter(d => beyond(beyond(source, d), d) >= 0);
    const sd = pick(r, outs);
    cells[source] = { k: "source", d: sd };
    keep.add(beyond(source, sd)); keep.add(beyond(beyond(source, sd), sd));
    let terminal = null;
    if (lv.terminal) {
      // the terminal, a fair way off: its inlet faces an open square on the board
      const spots = [];
      for (let c = 0; c < cells.length; c++) {
        if (!free(c) || keep.has(c)) continue;
        const [x, y] = xy(c);
        if (Math.abs(x - sx) + Math.abs(y - sy) < 5) continue;
        for (let d = 0; d < 4; d++) { const f = beyond(c, d); if (f >= 0 && free(f) && !keep.has(f) && f !== source) spots.push([c, d]); }
      }
      const [c, d] = pick(r, spots);
      cells[c] = { k: "terminal", d };
      keep.add(beyond(c, d));
      terminal = { c, d };
    }
    const open = () => { const out = []; for (let c = 0; c < cells.length; c++) if (free(c) && !keep.has(c)) out.push(c); return out; };
    for (let i = 0; i < lv.rocks; i++) cells[pick(r, open())] = { k: "rock" };
    // pumps and tanks: fixed straights, open at both ends (a pump that can't be passed through would be a rock)
    for (const [k, count] of [["pump", lv.pumps], ["tank", lv.tanks]]) for (let i = 0; i < count; i++) {
      const spots = [];
      for (const c of open()) for (const piece of ["h", "v"]) {
        const [a, b] = PIECES[piece][0], fa = beyond(c, a), fb = beyond(c, b);
        if (free(fa) && free(fb)) spots.push([c, piece]);
      }
      if (!spots.length) continue;
      const [c, piece] = pick(r, spots);
      cells[c] = { k, piece };
      keep.add(beyond(c, PIECES[piece][0][0])); keep.add(beyond(c, PIECES[piece][0][1]));
    }
    // nearly every open square reachable from the wellhead's outlet (rock mustn't wall off a corner of the board)
    const start = beyond(source, sd), seen = new Set([start]), todo = [start];
    while (todo.length) { const c = todo.pop(); for (let d = 0; d < 4; d++) { const f = beyond(c, d); if (f >= 0 && !seen.has(f) && (!cells[f] || cells[f].k === "pump" || cells[f].k === "tank")) { seen.add(f); todo.push(f); } } }
    const openCount = cells.filter(x => !x || x.k === "pump" || x.k === "tank").length;
    if (seen.size < openCount && attempt < 50) continue;
    if (terminal && !seen.has(beyond(terminal.c, terminal.d)) && attempt < 50) continue;
    return { seed, ...lv, fill: Math.round(lv.fill * pace), countdown: Math.round(lv.countdown * pace), pace, cells, source: { c: source, d: sd }, terminal };
  }
}
/** The i-th piece of level L's queue: the same for everyone on the same board, whatever they do with it. */
export function pieceAt(L, i) {
  const bag = Math.floor(i / BAG.length);
  return shuffled(BAG, rng(mix(L.seed, L.n, bag, 2)))[i % BAG.length];
}
/** The pieces on show from the queue's place `next`: the first is the one a tap lays. */
export const queueOf = (L, next, n = SHOWN) => Array.from({ length: n }, (_, k) => pieceAt(L, next + k));

// ---------- playing a level ----------
/**
 * A level under way: grid (the pieces laid, by square), next (the queue's place), t (ms since the level began: the
 * countdown, then the flow), flowing, path (the oil's way: { c, a, b }, the side it came in by, -1 at the wellhead,
 * and the side it leaves by), p (how far through the last of them it is, 0 to 1), filled (square -> the channels the
 * oil has passed, as bits), count (pipe passed through, for the quota), pts (the level's points by kind: pipe, loop,
 * pump, terminal, unused, blast, early: the countdown cut short), hurry,
 * lockUntil (a blast's moment), blasts, over ({ win, why, c } once it ends).
 */
export function newPlay() {
  return { grid: Array(COLS * ROWS).fill(null), next: 0, t: 0, flowing: false, path: [], p: 0, filled: {}, count: 0,
    pts: { pipe: 0, loop: 0, pump: 0, terminal: 0, unused: 0, blast: 0, early: 0 }, hurry: false, lockUntil: 0, blasts: 0, over: null };
}
/** The channel of a square's piece that takes the oil in by side a (its index and the side it leaves by), if any. */
export function channelOf(piece, a) {
  const chs = PIECES[piece] || [];
  for (let i = 0; i < chs.length; i++) { const [p, q] = chs[i]; if (p === a) return { i, out: q }; if (q === a) return { i, out: p }; }
  return null;
}
/** The piece on square c: a fixed pump's or tank's, or one laid there. */
export const pieceOn = (L, P, c) => (L.cells[c]?.piece ?? P.grid[c]);
/** Whether the oil has reached square c (its pieces can't be blasted then). */
export const oiled = (P, c) => !!P.filled[c] || P.path.some(s => s.c === c);
/**
 * Lays the queue's next piece on square c: an open square, or one of your pieces the oil hasn't reached (a blast,
 * costing points and a moment). Returns "laid" or "blast", or why it couldn't: "fixed" (rock, the wellhead, the
 * terminal, a pump or tank), "oil", "busy" (a blast still going off), "over".
 */
export function place(L, P, c) {
  if (P.over) return "over";
  if (P.t < P.lockUntil) return "busy";
  if (L.cells[c]) return "fixed";
  if (oiled(P, c)) return "oil";
  const had = P.grid[c];
  P.grid[c] = pieceAt(L, P.next++);
  if (!had) return "laid";
  P.blasts++;
  P.pts.blast += POINTS.blast;
  P.lockUntil = P.t + BLAST_MS;
  return "blast";
}
/** The oil now, before the countdown is out: each whole second of it left pays a little, once the level is cleared. */
export function release(L, P) {
  if (P.flowing || P.over) return;
  P.pts.early = POINTS.early * Math.floor((L.countdown - P.t) / 1000);
  advance(L, P, L.countdown - P.t);
}
/** Hurry: the oil runs HURRY times faster to the end of the level, and what it fills from now scores double. */
export function hurry(L, P) { if (P.flowing && !P.over) P.hurry = true; }
/** How long the oil takes over one step of its way: half a pipe out of the wellhead, a tank TANK times a pipe. */
const timeOf = (L, P, s) => (s.a < 0 ? L.fill / 2 : L.fill * (L.cells[s.c]?.k === "tank" ? TANK : 1)) / (P.hurry ? HURRY : 1);
/** The level's clock moved on by ms: the countdown, then the oil from piece to piece, until it spills or ends. */
export function advance(L, P, ms) {
  while (ms > 0 && !P.over) {
    if (!P.flowing) {
      const wait = L.countdown - P.t;
      if (ms < wait) { P.t += ms; return; }
      P.t += wait; ms -= wait;
      P.flowing = true;
      P.path.push({ c: L.source.c, a: -1, b: L.source.d });
      P.p = 0;
      continue;
    }
    const head = P.path[P.path.length - 1], span = timeOf(L, P, head), need = (1 - P.p) * span;
    if (ms < need) { P.p += ms / span; P.t += ms; return; }
    P.t += need; ms -= need; P.p = 1;
    passed(L, P, head);
    onward(L, P, head);
  }
}
/** The oil through one more piece: the quota's count and its points (double while hurrying). */
function passed(L, P, s) {
  if (s.a < 0) return;
  const k = P.hurry ? 2 : 1, piece = pieceOn(L, P, s.c), ch = channelOf(piece, s.a);
  P.count++;
  P.pts.pipe += POINTS.pipe * k;
  P.filled[s.c] = (P.filled[s.c] || 0) | (1 << ch.i);
  if (piece === "x" && P.filled[s.c] === 3) P.pts.loop += POINTS.loop * k;    // through the crossing both ways
  if (L.cells[s.c]?.k === "pump") P.pts.pump += POINTS.pump * k;
}
/** Where the oil goes from the piece it has just filled: into the next, or the level's end. */
function onward(L, P, s) {
  const c = beyond(s.c, s.b), a = back(s.b);
  if (c < 0) return end(L, P, "edge", s.c);
  const fixed = L.cells[c];
  if (fixed?.k === "rock") return end(L, P, "rock", c);
  if (fixed?.k === "source") return end(L, P, "full", c);
  if (fixed?.k === "terminal") return fixed.d === a ? end(L, P, P.count >= L.quota ? "terminal" : "early", c) : end(L, P, "shape", c);
  const piece = pieceOn(L, P, c);
  if (!piece) return end(L, P, "open", c);
  const ch = channelOf(piece, a);
  if (!ch) return end(L, P, "shape", c);
  if ((P.filled[c] || 0) & (1 << ch.i)) return end(L, P, "full", c);
  P.path.push({ c, a, b: ch.out });
  P.p = 0;
}
/** The level over: won if the oil passed through its quota (and wasn't led into the terminal short of it). On a level
 *  won, pieces of yours it never reached cost points, as in Pipe Dream; the terminal pays its bonus. A spill short of
 *  the quota ends the run, costs nothing more, and earns nothing for the countdown it cut short. */
function end(L, P, why, c) {
  const win = why === "terminal" || (why !== "early" && P.count >= L.quota);
  P.over = { win, why, c };
  if (why === "terminal") P.pts.terminal = POINTS.terminal * (P.hurry ? 2 : 1);
  if (win) P.pts.unused = POINTS.unused * P.grid.filter((piece, i) => piece && !oiled(P, i)).length;
  else P.pts.early = 0;            // the countdown cut short pays only on a level cleared: the oil let go on an empty board isn't a score
}
/** A level's points so far (its final score once it's over). */
export const pointsOf = P => Object.values(P.pts).reduce((a, b) => a + b, 0);

/**
 * The oil's way as the board stands: from where it is now (the wellhead before it leaves) through the pieces laid,
 * to where it would spill. { cells: [{ c, a, b }], end: { c, why } }, the cells after the oil's present piece; with
 * `length`, the pipe the quota would count by then. For the page: the route ahead is shown, and how far it reaches.
 */
export function ahead(L, P) {
  const filled = { ...P.filled }, cells = [];
  let s = P.path.length ? P.path[P.path.length - 1] : { c: L.source.c, a: -1, b: L.source.d };
  // the piece the oil is in now counts as passed (it will be)
  if (s.a >= 0) { const ch = channelOf(pieceOn(L, P, s.c), s.a); filled[s.c] = (filled[s.c] || 0) | (1 << ch.i); }
  let length = P.count + (P.path.length && s.a >= 0 && P.p < 1 ? 1 : 0);
  for (let guard = 0; guard < 200; guard++) {
    const c = beyond(s.c, s.b), a = back(s.b);
    if (c < 0) return { cells, length, end: { c: s.c, why: "edge" } };
    const fixed = L.cells[c];
    if (fixed?.k === "terminal") return { cells, length, end: { c, why: fixed.d === a ? (length >= L.quota ? "terminal" : "early") : "shape" } };
    if (fixed && fixed.k !== "pump" && fixed.k !== "tank") return { cells, length, end: { c, why: fixed.k === "rock" ? "rock" : "full" } };
    const piece = pieceOn(L, P, c);
    if (!piece) return { cells, length, end: { c, why: "open" } };
    const ch = channelOf(piece, a);
    if (!ch) return { cells, length, end: { c, why: "shape" } };
    if ((filled[c] || 0) & (1 << ch.i)) return { cells, length, end: { c, why: "full" } };
    filled[c] = (filled[c] || 0) | (1 << ch.i);
    s = { c, a, b: ch.out };
    cells.push(s);
    length++;
  }
  return { cells, length, end: { c: s.c, why: "loop" } };
}
