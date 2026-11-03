// Flank's board: the squares as bitboards and the rules of a move. A board is two 64-bit sets of squares, one for each
// colour, each kept as two 32-bit halves (rows 1 to 4 in the low half, 5 to 8 in the high), because JavaScript's
// bitwise operators work on 32 bits and BigInt is far too slow for a search. Square 0 is a1 (top left), 7 is h1, 56 is
// a8; sq = row * 8 + column. Every function here takes the side to move first (pl, ph) and the other side (ol, oh),
// whichever colour each is, so one search serves both; the colours only come back when a board is read or written.
//
// The rules (nobody's: Reversi, 1880s): a disc is placed on an empty square so that, in at least one of the eight
// directions, a line of the other side's discs runs from it to one of yours; every disc on those lines turns. A side
// with no such square passes; the game ends when neither has one, and the side with more discs wins.
const NA = 0xFEFEFEFE | 0;                 // every column but a: the bits that may be reached by a step east
const NH = 0x7F7F7F7F | 0;                 // every column but h: the bits that may be reached by a step west

// one step in a direction of a board kept as two halves; the result is left in RL and RH (no allocation)
let RL = 0, RH = 0;
function sE(l, h) { RL = (l << 1) & NA; RH = (h << 1) & NA; }
function sW(l, h) { RL = (l >>> 1) & NH; RH = (h >>> 1) & NH; }
function sS(l, h) { RH = (h << 8) | (l >>> 24); RL = l << 8; }
function sN(l, h) { RL = (l >>> 8) | (h << 24); RH = h >>> 8; }
function sSE(l, h) { const a = l << 8, b = (h << 8) | (l >>> 24); RL = (a << 1) & NA; RH = (b << 1) & NA; }
function sSW(l, h) { const a = l << 8, b = (h << 8) | (l >>> 24); RL = (a >>> 1) & NH; RH = (b >>> 1) & NH; }
function sNE(l, h) { const a = (l >>> 8) | (h << 24), b = h >>> 8; RL = (a << 1) & NA; RH = (b << 1) & NA; }
function sNW(l, h) { const a = (l >>> 8) | (h << 24), b = h >>> 8; RL = (a >>> 1) & NH; RH = (b >>> 1) & NH; }

/** Where the last call of legal() or flipped() left its answer: [low half, high half]. */
export const MV = new Int32Array(2);

export const popcount = x => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0F0F0F0F;
  return Math.imul(x, 0x01010101) >>> 24;
};
/** The squares the side to move may play, left in MV. Returns whether there is one. */
export function legal(pl, ph, ol, oh) {
  const el = ~(pl | ol), eh = ~(ph | oh);
  let ml = 0, mh = 0, tl, th;
  // each direction: the other side's discs touching ours in that direction, grown along the line as far as they go;
  // the empty squares just beyond them are moves
  sE(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sE(tl, th); tl |= RL & ol; th |= RH & oh; } sE(tl, th); ml |= RL & el; mh |= RH & eh; }
  sW(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sW(tl, th); tl |= RL & ol; th |= RH & oh; } sW(tl, th); ml |= RL & el; mh |= RH & eh; }
  sS(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sS(tl, th); tl |= RL & ol; th |= RH & oh; } sS(tl, th); ml |= RL & el; mh |= RH & eh; }
  sN(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sN(tl, th); tl |= RL & ol; th |= RH & oh; } sN(tl, th); ml |= RL & el; mh |= RH & eh; }
  sSE(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sSE(tl, th); tl |= RL & ol; th |= RH & oh; } sSE(tl, th); ml |= RL & el; mh |= RH & eh; }
  sSW(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sSW(tl, th); tl |= RL & ol; th |= RH & oh; } sSW(tl, th); ml |= RL & el; mh |= RH & eh; }
  sNE(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sNE(tl, th); tl |= RL & ol; th |= RH & oh; } sNE(tl, th); ml |= RL & el; mh |= RH & eh; }
  sNW(pl, ph); tl = RL & ol; th = RH & oh;
  if (tl | th) { for (let i = 0; i < 5; i++) { sNW(tl, th); tl |= RL & ol; th |= RH & oh; } sNW(tl, th); ml |= RL & el; mh |= RH & eh; }
  MV[0] = ml; MV[1] = mh;
  return (ml | mh) !== 0;
}
/** The number of moves the side to move has. */
export function mobility(pl, ph, ol, oh) {
  legal(pl, ph, ol, oh);
  return popcount(MV[0]) + popcount(MV[1]);
}
/** The discs a disc of the side to move placed on sq would turn (0 when it turns none: not a move), left in MV. */
export function flipped(sq, pl, ph, ol, oh) {
  const bl = sq < 32 ? 1 << sq : 0, bh = sq < 32 ? 0 : 1 << (sq - 32);
  let fl = 0, fh = 0, tl, th, xl, xh;
  tl = th = 0; sE(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sE(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  tl = th = 0; sW(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sW(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  tl = th = 0; sS(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sS(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  tl = th = 0; sN(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sN(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  tl = th = 0; sSE(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sSE(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  tl = th = 0; sSW(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sSW(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  tl = th = 0; sNE(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sNE(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  tl = th = 0; sNW(bl, bh); xl = RL; xh = RH;
  while ((xl & ol) | (xh & oh)) { tl |= xl; th |= xh; sNW(xl, xh); xl = RL; xh = RH; }
  if ((xl & pl) | (xh & ph)) { fl |= tl; fh |= th; }
  MV[0] = fl; MV[1] = fh;
  return (fl | fh) !== 0;
}
/** Squares touching an empty square, as a set (the discs a move can reach: the frontier), left in MV. */
export function nextToEmpty(el, eh) {
  let l = 0, h = 0;
  sE(el, eh); l |= RL; h |= RH;
  sW(el, eh); l |= RL; h |= RH;
  sS(el, eh); l |= RL; h |= RH;
  sN(el, eh); l |= RL; h |= RH;
  sSE(el, eh); l |= RL; h |= RH;
  sSW(el, eh); l |= RL; h |= RH;
  sNE(el, eh); l |= RL; h |= RH;
  sNW(el, eh); l |= RL; h |= RH;
  MV[0] = l; MV[1] = h;
}

// ---------- names, and boards as text ----------
export const sqName = sq => "abcdefgh"[sq & 7] + (1 + (sq >> 3));
/** "c4" as a square number, or -1. */
export const sqOf = name => {
  const m = /^([a-h])([1-8])$/.exec(String(name).toLowerCase());
  return m ? (m[2] - 1) * 8 + (m[1].charCodeAt(0) - 97) : -1;
};
export const bitL = sq => (sq < 32 ? 1 << sq : 0);
export const bitH = sq => (sq < 32 ? 0 : 1 << (sq - 32));
export const hasBit = (l, h, sq) => ((sq < 32 ? l >>> sq : h >>> (sq - 32)) & 1) === 1;
/** The squares of a set, lowest first. */
export function squaresOf(l, h) {
  const out = [];
  for (let sq = 0; sq < 64; sq++) if (hasBit(l, h, sq)) out.push(sq);
  return out;
}

/**
 * A board as 64 characters, row by row from a1: "d" a dark disc, "l" a light disc, "." an empty square. This is how a
 * game is kept (plain JSON) and how a lesson writes a position. Returns { dl, dh, ll, lh }.
 */
export function parse(text) {
  const s = String(text).replace(/\s+/g, "");
  if (s.length !== 64 || /[^dl.]/.test(s)) throw new Error(`not a board: "${text}"`);
  let dl = 0, dh = 0, ll = 0, lh = 0;
  for (let sq = 0; sq < 64; sq++) {
    const c = s[sq];
    if (c === "d") { dl |= bitL(sq); dh |= bitH(sq); } else if (c === "l") { ll |= bitL(sq); lh |= bitH(sq); }
  }
  return { dl, dh, ll, lh };
}
/** The board as parse reads it. */
export function show(dl, dh, ll, lh) {
  let s = "";
  for (let sq = 0; sq < 64; sq++) s += hasBit(dl, dh, sq) ? "d" : hasBit(ll, lh, sq) ? "l" : ".";
  return s;
}
/** The usual start: light on d4 and e5, dark on e4 and d5. Dark moves first. */
export const START = "...........................ld......dl...........................";
export const count = (l, h) => popcount(l) + popcount(h);

// ---------- a game as moves ----------
/**
 * A game position, plain JSON: { b (the board text), t ("d" or "l": who is to move), over }. After a move the other
 * side moves; if it can't, the first side moves again (the other passes); if neither can, the game is over. play()
 * returns the next position, with `flips` (the squares turned) and `passed` (the side that had to pass, or "").
 */
export function position(b = START, t = "d") {
  return settle({ b, t, over: false });
}
/** Whose turn it really is: t, or the other side if t can't move, or the game's end. */
function settle(p) {
  const { dl, dh, ll, lh } = parse(p.b);
  const mine = p.t === "d" ? [dl, dh, ll, lh] : [ll, lh, dl, dh];
  if (legal(...mine)) return { ...p, over: false };
  if (legal(mine[2], mine[3], mine[0], mine[1])) return { ...p, t: p.t === "d" ? "l" : "d", over: false };
  return { ...p, over: true };
}
/** The squares the side to move may play, as a list. */
export function movesOf(p) {
  if (p.over) return [];
  const { dl, dh, ll, lh } = parse(p.b);
  const dark = p.t === "d";
  legal(dark ? dl : ll, dark ? dh : lh, dark ? ll : dl, dark ? lh : dh);
  return squaresOf(MV[0], MV[1]);
}
/** The discs a move on sq would turn, as a list (empty: not a legal move). */
export function turnsOf(p, sq) {
  if (p.over || sq < 0 || sq > 63) return [];
  const { dl, dh, ll, lh } = parse(p.b);
  if (hasBit(dl | ll, dh | lh, sq)) return [];
  const dark = p.t === "d";
  flipped(sq, dark ? dl : ll, dark ? dh : lh, dark ? ll : dl, dark ? lh : dh);
  return squaresOf(MV[0], MV[1]);
}
/** The position after the side to move plays sq, or null if it can't. */
export function play(p, sq) {
  if (p.over || sq < 0 || sq > 63) return null;
  const { dl, dh, ll, lh } = parse(p.b);
  if (hasBit(dl | ll, dh | lh, sq)) return null;
  const dark = p.t === "d";
  let pl = dark ? dl : ll, ph = dark ? dh : lh, ol = dark ? ll : dl, oh = dark ? lh : dh;
  if (!flipped(sq, pl, ph, ol, oh)) return null;
  const fl = MV[0], fh = MV[1];
  pl |= fl | bitL(sq); ph |= fh | bitH(sq); ol &= ~fl; oh &= ~fh;
  const b = dark ? show(pl, ph, ol, oh) : show(ol, oh, pl, ph);
  const next = settle({ b, t: dark ? "l" : "d", over: false });
  return { ...next, flips: squaresOf(fl, fh), sq, passed: next.over ? "" : next.t === p.t ? (dark ? "l" : "d") : "" };
}
/** Dark's and light's discs on a board. */
export function tally(b) {
  let d = 0, l = 0;
  for (let i = 0; i < 64; i++) { const c = b[i]; if (c === "d") d++; else if (c === "l") l++; }
  return { d, l };
}
/** A game from a start and its moves (squares): every position, the last first-to-last. null if a move is illegal. */
export function replay(moves, start = position()) {
  const out = [start];
  let p = start;
  for (const sq of moves) {
    p = play(p, sq);
    if (!p) return null;
    out.push(p);
  }
  return out;
}

/** The number of games of `depth` plies from a position, as the published counts have it: a pass is a ply, and a game that ends sooner counts once. */
export function perft(depth, p = position()) {
  const { dl, dh, ll, lh } = parse(p.b);
  const walk = (pl, ph, ol, oh, d) => {
    if (d === 0) return 1;
    if (!legal(pl, ph, ol, oh)) return legal(ol, oh, pl, ph) ? walk(ol, oh, pl, ph, d - 1) : 1;
    const ml = MV[0], mh = MV[1];
    let n = 0;
    for (let sq = 0; sq < 64; sq++) {
      if (!hasBit(ml, mh, sq)) continue;
      flipped(sq, pl, ph, ol, oh);
      const fl = MV[0], fh = MV[1];
      n += walk(ol & ~fl, oh & ~fh, pl | fl | bitL(sq), ph | fh | bitH(sq), d - 1);
    }
    return n;
  };
  return p.t === "d" ? walk(dl, dh, ll, lh, depth) : walk(ll, lh, dl, dh, depth);
}
