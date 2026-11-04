// Nine Men's Morris: the board and the rules of a move (classic rules, nobody's). Twenty-four points on three nested
// squares, joined along the squares' sides and by four spokes through their midpoints; a point is 0 to 23, ring * 8 +
// place, ring 0 the outer square, 1 the middle, 2 the inner, place 0 the top left corner and on clockwise (1 the top
// middle, 2 the top right ... 7 the left middle). A side's pieces are a 24-bit set, so a search can copy positions freely.
//
// The rules: each side has nine pieces to place, one a turn, on any empty point; then they move one a turn to a
// neighbouring empty point; a side left with three flies, to any empty point. Three of one side in a line is a mill, and
// closing one (by a placing or a move) takes one of the other side's pieces, off a mill only if none is outside one.
// A side loses at two pieces (counting those still in hand), or on its turn with no move (blocked). The third time the
// same position comes up with the same side to move is a draw.
//
// A move is one number, kept whole (so a game is a list of numbers): (from + 1) + 25 * (to + 24 * (take + 1)) with from
// -1 when placing and take -1 when nothing is taken.
export const N = 24, FULL = (1 << N) - 1, NINE = 9;

const XY = [];                                   // [x, y] of each point on a 7 x 7 grid, y 0 at the top
for (let r = 0; r < 3; r++) {
  const a = r, b = 3, c = 6 - r;
  XY.push([a, a], [b, a], [c, a], [c, b], [c, c], [b, c], [a, c], [a, b]);
}
export const COORD = XY;
const FILES = "abcdefg";
/** a1 is the bottom left of the grid, g7 the top right (the usual notation of the game). */
export const ptName = i => FILES[XY[i][0]] + (7 - XY[i][1]);
export const ptOf = name => { const x = FILES.indexOf(name[0]), y = 7 - Number(name.slice(1)); return XY.findIndex(p => p[0] === x && p[1] === y); };

// neighbours: along a square's sides, and, at a side's middle (odd places), to the next square in or out
export const ADJ = new Int32Array(N);
const NEIGH = [];
for (let i = 0; i < N; i++) {
  const r = i >> 3, p = i & 7, list = [r * 8 + ((p + 1) & 7), r * 8 + ((p + 7) & 7)];
  if (p & 1) { if (r > 0) list.push((r - 1) * 8 + p); if (r < 2) list.push((r + 1) * 8 + p); }
  NEIGH.push(list);
  ADJ[i] = list.reduce((m, j) => m | (1 << j), 0);
}
export const neighbours = i => NEIGH[i];
export const DEGREE = NEIGH.map(l => l.length);

// the sixteen mills: each square's four sides, and the four spokes
export const MILLS = [];
for (let r = 0; r < 3; r++) for (let s = 0; s < 4; s++) MILLS.push([r * 8 + s * 2, r * 8 + s * 2 + 1, r * 8 + ((s * 2 + 2) & 7)]);
for (let p = 1; p < 8; p += 2) MILLS.push([p, 8 + p, 16 + p]);
export const MILL_MASK = MILLS.map(m => m.reduce((x, i) => x | (1 << i), 0));
/** The two mills each point lies on, as masks. */
export const MILLS_AT = Array.from({ length: N }, (_, i) => MILL_MASK.filter(m => m & (1 << i)));

export const popcount = x => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0F0F0F0F;
  return Math.imul(x, 0x01010101) >>> 24;
};
const low = m => 31 - Math.clz32(m & -m);
/** The points of a set, as a list. */
export function bits(m) { const out = []; while (m) { const i = low(m); out.push(i); m &= m - 1; } return out; }

export const encode = (f, t, x = -1) => (f + 1) + 25 * (t + N * (x + 1));
export function decode(code) { const f = (code % 25) - 1, r = Math.floor(code / 25); return { f, t: r % N, x: Math.floor(r / N) - 1 }; }

/** Whether a piece just put on point t of the set m completes a mill. */
export const closes = (m, t) => { const a = MILLS_AT[t]; return (m & a[0]) === a[0] || (m & a[1]) === a[1]; };
/** The pieces of a set that stand in a mill. */
export function inMills(m) { let out = 0; for (const k of MILL_MASK) if ((m & k) === k) out |= k; return out; }
/** The pieces of `opp` one may take: those outside a mill, or any if every one is in a mill. */
export function takeable(opp) { const free = opp & ~inMills(opp); return free || opp; }

/** Whether the side holding `hand` pieces and `me` on the board flies: no pieces in hand and three on the board. */
export const flies = (me, hand) => hand === 0 && popcount(me) === 3;

/**
 * The moves of the side `me` against `opp`, with `hand` pieces still to place: a list of move numbers. A move that
 * closes a mill comes once for each piece it may take (or once with nothing taken, if there is none to take).
 */
export function gen(me, opp, hand) {
  const empty = FULL & ~(me | opp), out = [];
  const add = (f, t) => {
    const next = (f < 0 ? me : me & ~(1 << f)) | (1 << t);
    if (closes(next, t)) {
      const rem = takeable(opp);
      if (rem) { for (let m = rem; m; m &= m - 1) out.push(encode(f, t, low(m))); return; }
    }
    out.push(encode(f, t, -1));
  };
  if (hand > 0) { for (let m = empty; m; m &= m - 1) add(-1, low(m)); return out; }
  const fly = popcount(me) === 3;
  for (let s = me; s; s &= s - 1) {
    const f = low(s);
    for (let m = fly ? empty : ADJ[f] & empty; m; m &= m - 1) add(f, low(m));
  }
  return out;
}

// ---------- a position: { d, l (the sets), t (whose turn), hd, hl (pieces in hand), over, winner, why } ----------
export const START = { d: 0, l: 0, t: "d", hd: NINE, hl: NINE };
const other = c => (c === "d" ? "l" : "d");
export const total = (p, c) => popcount(p[c]) + p[c === "d" ? "hd" : "hl"];

/** A position from its parts, with the end of the game worked out (the side to move lost: blocked, or down to two). */
export function position(d = 0, l = 0, t = "d", hd = 0, hl = 0) {
  const p = { d, l, t, hd, hl, over: false, winner: "", why: "" };
  const me = p[t], opp = p[other(t)], hand = t === "d" ? hd : hl;
  if (popcount(me) + hand < 3) { p.over = true; p.winner = other(t); p.why = "two"; }
  else if (hand === 0 && !gen(me, opp, 0).length) { p.over = true; p.winner = other(t); p.why = "blocked"; }
  return p;
}
export const positionOfText = (b, t = "d", hd = 0, hl = 0) => {
  let d = 0, l = 0;
  for (let i = 0; i < N; i++) { if (b[i] === "d") d |= 1 << i; else if (b[i] === "l") l |= 1 << i; }
  return position(d, l, t, hd, hl);
};
export function toText(p) {
  let s = "";
  for (let i = 0; i < N; i++) s += p.d & (1 << i) ? "d" : p.l & (1 << i) ? "l" : ".";
  return s;
}
export const EMPTY_BOARD = ".".repeat(N);

export const movesOf = p => (p.over ? [] : gen(p[p.t], p[other(p.t)], p.t === "d" ? p.hd : p.hl));
/** Whether the side to move is placing, moving or flying. */
export function phaseOf(p, c = p.t) {
  const hand = c === "d" ? p.hd : p.hl;
  return hand > 0 ? "place" : popcount(p[c]) === 3 ? "fly" : "move";
}

/** The position after a move (which must be one of movesOf's), with the end of the game worked out. */
export function play(p, code) {
  const { f, t, x } = decode(code), c = p.t, o = other(c);
  let me = p[c], opp = p[o], hd = p.hd, hl = p.hl;
  if (f >= 0) me &= ~(1 << f); else if (c === "d") hd--; else hl--;
  me |= 1 << t;
  if (x >= 0) opp &= ~(1 << x);
  const d = c === "d" ? me : opp, l = c === "d" ? opp : me;
  return position(d, l, o, hd, hl);
}
/** The position's identity for repetition: the board, whose turn, the hands. */
export const keyOf = p => `${p.d}.${p.l}${p.t}${p.hd}${p.hl}`;

/** A game from its moves: the position after each (index 0 the start), or null if one of them is illegal. */
export function replay(moves, start = START) {
  let p = position(start.d, start.l, start.t, start.hd, start.hl);
  const out = [p];
  for (const m of moves) {
    if (p.over || !movesOf(p).includes(m)) return null;
    p = play(p, m);
    out.push(p);
  }
  return out;
}
/** The number of games of `depth` plies from a position (for the tests). */
export function perft(depth, p = position(START.d, START.l, "d", NINE, NINE)) {
  if (depth === 0 || p.over) return 1;
  let n = 0;
  for (const m of movesOf(p)) n += perft(depth - 1, play(p, m));
  return n;
}
