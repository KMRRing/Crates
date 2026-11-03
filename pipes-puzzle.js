// Pipes, the puzzle (November 2026): a fitting puzzle with no clock and no queue. A level is a board (rock, a wellhead, a
// terminal, perhaps old pipe already in the ground and stakes to pass in order) and a fixed hand of pieces. Lay every
// piece of the hand so that the oil, leaving the wellhead, runs through all of them, and through the old pipe, and into
// the terminal: the oil's one route has to be made of exactly the pieces you hold. Pieces are never turned; a bend
// comes as it is, so the hand fixes which ways the route can turn. Pure: pipes-puzzle-solve.js proves every level has
// its answer, pipes-puzzle-ui.js draws it, tests/pipes-puzzle.mjs plays it.
//
// Squares are numbered c = y * cols + x; sides 0 N, 1 E, 2 S, 3 W, and pieces and their channels are pipes-engine.js's.
import { PIECES, KINDS, DIRS, back, channelOf } from "./pipes-engine.js";

export { PIECES, KINDS, DIRS, back, channelOf };
export const SIDE = "NESW";
/** A level's map is drawn with the pieces themselves: ne is └ (north and east), nw ┘, se ┌, sw ┐. */
export const GLYPH = { h: "─", v: "│", ne: "└", nw: "┘", se: "┌", sw: "┐", x: "┼" };
const OF_GLYPH = Object.fromEntries(Object.entries(GLYPH).map(([k, g]) => [g, k]));
export const STAR_LIFTS = 2;      // lifts a level allows for the third star (and one more for every six pieces)

/** The square beyond c on side d, or -1 off the board. */
export function beyond(L, c, d) {
  const x = c % L.cols + DIRS[d][0], y = Math.floor(c / L.cols) + DIRS[d][1];
  return x >= 0 && y >= 0 && x < L.cols && y < L.rows ? y * L.cols + x : -1;
}
export const xy = (L, c) => [c % L.cols, Math.floor(c / L.cols)];
/** The piece whose channel joins sides a and b (a straight or a bend), or null. */
export function pieceJoining(a, b) {
  return KINDS.find(k => k !== "x" && PIECES[k].some(([p, q]) => (p === a && q === b) || (p === b && q === a))) || null;
}

/**
 * A level from its text. spec: { id, map, out, inlet, hand }; map is rows of squares: . open ground, # rock, S the wellhead
 * (its outlet on side `out`), T the terminal (its inlet on side `inlet`), ─ │ └ ┘ ┌ ┐ ┼ old pipe, already in the
 * ground (the oil must run through it), 1-9 a stake on open ground (the route passes the stakes in order); hand is
 * "h3 v2 ne1 …", the pieces to lay, each used exactly once. Returns { id, cols, rows, cells, stakeAt, stakes, hand,
 * total, olds, source, terminal } with cells[c] null for open ground or { k: "rock" | "source" | "terminal" | "old" … }.
 */
export function parseLevel(spec) {
  const rows = spec.map.length, cols = spec.map[0].length;
  const L = { id: spec.id, name: spec.name, cols, rows, cells: Array(cols * rows).fill(null), stakeAt: Array(cols * rows).fill(0), stakes: [],
    hand: {}, total: 0, olds: 0, source: null, terminal: null, sols: spec.sols || [] };
  spec.map.forEach((row, y) => {
    if (row.length !== cols) throw new Error(`level ${spec.id}: row ${y} is ${row.length} wide, not ${cols}`);
    [...row].forEach((ch, x) => {
      const c = y * cols + x;
      if (ch === "#") L.cells[c] = { k: "rock" };
      else if (ch === "S") { L.source = { c, d: SIDE.indexOf(spec.out) }; L.cells[c] = { k: "source", d: L.source.d }; }
      else if (ch === "T") { L.terminal = { c, d: SIDE.indexOf(spec.inlet) }; L.cells[c] = { k: "terminal", d: L.terminal.d }; }
      else if (OF_GLYPH[ch]) { L.cells[c] = { k: "old", piece: OF_GLYPH[ch] }; L.olds++; }
      else if (/[1-9]/.test(ch)) L.stakeAt[c] = Number(ch);
      else if (ch !== ".") throw new Error(`level ${spec.id}: unknown square ${ch}`);
    });
  });
  if (!L.source || !L.terminal) throw new Error(`level ${spec.id}: needs a wellhead and a terminal`);
  for (const n of spec.hand.split(/\s+/).filter(Boolean)) {
    const m = /^([a-z]+)(\d+)$/.exec(n);
    if (!m || !PIECES[m[1]]) throw new Error(`level ${spec.id}: bad hand ${n}`);
    L.hand[m[1]] = Number(m[2]); L.total += Number(m[2]);
  }
  L.stakes = L.stakeAt.map((n, c) => [n, c]).filter(([n]) => n).sort((p, q) => p[0] - q[0]).map(([, c]) => c);
  L.stakes.forEach((c, i) => { if (L.stakeAt[c] !== i + 1) throw new Error(`level ${spec.id}: stakes must run 1, 2, 3…`); });
  return L;
}
/** A level back as text: parseLevel's inverse, for the generator. */
export function specOf(L) {
  const map = [];
  for (let y = 0; y < L.rows; y++) {
    let row = "";
    for (let x = 0; x < L.cols; x++) {
      const c = y * L.cols + x, f = L.cells[c];
      row += !f ? (L.stakeAt[c] ? String(L.stakeAt[c]) : ".") : f.k === "rock" ? "#" : f.k === "source" ? "S" : f.k === "terminal" ? "T" : GLYPH[f.piece];
    }
    map.push(row);
  }
  const hand = KINDS.filter(k => L.hand[k]).map(k => `${k}${L.hand[k]}`).join(" ");
  return { id: L.id, map, out: SIDE[L.source.d], inlet: SIDE[L.terminal.d], hand };
}

/** The pieces laid so far: an array by square, null where nothing is. */
export const emptyLaid = L => Array(L.cols * L.rows).fill(null);
export const pieceOn = (L, laid, c) => (L.cells[c]?.k === "old" ? L.cells[c].piece : laid[c]);
/** What's left of the hand: counts by kind, after the pieces laid. */
export function handLeft(L, laid) {
  const left = { ...L.hand };
  for (const p of laid) if (p) left[p] = (left[p] || 0) - 1;
  return left;
}
export const laidCount = laid => laid.reduce((n, p) => n + (p ? 1 : 0), 0);

/**
 * The oil's way as the board stands: from the wellhead through the pieces laid and the old pipe, until it comes to
 * something that stops it. { passes: [{ c, a, b }] (the square, the side it came in by, the side it leaves by),
 * end: { c, why } } where why is "terminal" (led in by its inlet), "shape" (a piece or the terminal that won't take it
 * in), "open" (an empty square: c is where the next piece is needed), "rock", "edge", "full" (pipe it has already filled)
 * or "loop". A crossing may be passed twice, once each way.
 */
export function trace(L, laid) {
  const passes = [], filled = {};
  let c = beyond(L, L.source.c, L.source.d), a = back(L.source.d), last = L.source.c;
  if (c < 0) return { passes, end: { c: last, why: "edge" } };
  for (let guard = 0; guard < 4 * L.cols * L.rows; guard++) {
    const f = L.cells[c];
    if (f?.k === "terminal") return { passes, end: { c, why: f.d === a ? "terminal" : "shape" } };
    if (f?.k === "rock") return { passes, end: { c, why: "rock" } };
    if (f?.k === "source") return { passes, end: { c, why: "full" } };
    const piece = pieceOn(L, laid, c);
    if (!piece) return { passes, end: { c, why: "open" } };
    const ch = channelOf(piece, a);
    if (!ch) return { passes, end: { c, why: "shape" } };
    if ((filled[c] || 0) & (1 << ch.i)) return { passes, end: { c, why: "full" } };
    filled[c] = (filled[c] || 0) | (1 << ch.i);
    passes.push({ c, a, b: ch.out });
    last = c;
    const n = beyond(L, c, ch.out);
    if (n < 0) return { passes, end: { c, why: "edge" } };
    c = n; a = back(ch.out);
  }
  return { passes, end: { c: last, why: "loop" } };
}
/**
 * The way back from the terminal: the pieces that already lead into its inlet, found by running the oil backwards.
 * { passes: [{ c, a, b }] from the terminal's side towards the wellhead (a is the side it comes from, b the side it
 * leaves by, as in trace), end: { c, why } where the chain stops: "source" (it reaches the wellhead), "open", "rock",
 * "shape", "edge" or "loop" }.
 */
export function feed(L, laid) {
  const passes = [], seen = {};
  const t = beyond(L, L.terminal.c, L.terminal.d);
  if (t < 0) return { passes, end: { c: L.terminal.c, why: "edge" } };
  let c = t, exit = back(L.terminal.d);
  for (let guard = 0; guard < 4 * L.cols * L.rows; guard++) {
    const f = L.cells[c];
    if (f?.k === "rock") return { passes, end: { c, why: "rock" } };
    if (f?.k === "source") return { passes, end: { c, why: f.d === exit ? "source" : "shape" } };
    if (f?.k === "terminal") return { passes, end: { c, why: "shape" } };
    const piece = pieceOn(L, laid, c);
    if (!piece) return { passes, end: { c, why: "open" } };
    const ch = channelOf(piece, exit);
    if (!ch) return { passes, end: { c, why: "shape" } };
    if (seen[c] & (1 << ch.i)) return { passes, end: { c, why: "loop" } };
    seen[c] = (seen[c] || 0) | (1 << ch.i);
    passes.push({ c, a: ch.out, b: exit });
    const n = beyond(L, c, ch.out);
    if (n < 0) return { passes, end: { c, why: "edge" } };
    c = n; exit = back(ch.out);
  }
  return { passes, end: { c, why: "loop" } };
}

/**
 * How the level stands: the oil's trace, and what's left to make it a solution. { passes, end, laid (pieces laid),
 * left (pieces still in the hand), strays (squares with a piece the oil doesn't pass), missed (old pipe it doesn't
 * pass), stakesOk (the stakes passed in order, as far as it has gone), solved }.
 */
export function check(L, laid) {
  const { passes, end } = trace(L, laid);
  const seen = new Set(passes.map(s => s.c));
  const strays = [], missed = [];
  laid.forEach((p, c) => { if (p && !seen.has(c)) strays.push(c); });
  L.cells.forEach((f, c) => { if (f?.k === "old" && !seen.has(c)) missed.push(c); });
  const order = [];
  for (const s of passes) if (L.stakeAt[s.c] && !order.includes(s.c)) order.push(s.c);
  const stakesOk = order.every((c, i) => c === L.stakes[i]);
  const placed = laidCount(laid), left = L.total - placed;
  const solved = end.why === "terminal" && !left && !strays.length && !missed.length && stakesOk && order.length === L.stakes.length;
  return { passes, end, placed, left, strays, missed, stakesOk, stakesPassed: order.length, solved };
}
/** Whether a hand's kind can still be laid: some of it is left. */
export const kindsLeft = (L, laid) => { const left = handLeft(L, laid); return KINDS.filter(k => L.hand[k] || left[k]); };

/** Lays kind on square c: "laid" or "swapped" (a piece of yours was there, and goes back to the hand), or why not:
 *  "fixed" (rock, wellhead, terminal, old pipe), "none" (that kind's all laid). The caller keeps the hand. */
export function lay(L, laid, c, kind) {
  if (L.cells[c]) return "fixed";
  if (!kind || (handLeft(L, laid)[kind] || 0) < 1) return "none";
  const had = laid[c];
  laid[c] = kind;
  return had ? "swapped" : "laid";
}
/** Takes the piece off square c; returns it, or null if none of yours is there. */
export function lift(L, laid, c) {
  const had = laid[c];
  if (!had) return null;
  laid[c] = null;
  return had;
}

// ---------- a solution, as the route the oil takes ----------
/** A route as the directions the oil leaves each square by, from the wellhead's outlet on: "EESSW…" (SIDE letters). */
export function routeOf(L, laid) {
  return trace(L, laid).passes.map(s => SIDE[s.b]).join("");
}
/** The pieces a route lays, as `laid` (old pipe and the wellhead are not laid): null if the route isn't a legal one for the
 *  board (it runs into rock, over its own pipe, off the edge…). The route is the directions after each square, the
 *  last one into the terminal. A square passed twice, straight each time and across itself, is a crossing. */
export function layRoute(L, route) {
  const laid = emptyLaid(L), used = new Set();
  let c = beyond(L, L.source.c, L.source.d), a = back(L.source.d);
  for (let i = 0; i < route.length; i++) {
    if (c < 0) return null;
    const f = L.cells[c], b = SIDE.indexOf(route[i]), key = `${c}:${Math.min(a, b)}${Math.max(a, b)}`;
    if (b < 0 || used.has(key)) return null;
    used.add(key);
    if (f) {
      if (f.k !== "old" || channelOf(f.piece, a)?.out !== b) return null;
    } else if (!laid[c]) {
      const piece = pieceJoining(a, b);
      if (!piece) return null;
      laid[c] = piece;
    } else if ((laid[c] === "h" || laid[c] === "v") && b === back(a) && (a % 2) !== (PIECES[laid[c]][0][0] % 2)) laid[c] = "x";
    else return null;
    c = beyond(L, c, b); a = back(b);
  }
  return c === L.terminal.c && a === L.terminal.d ? laid : null;
}
/**
 * What a hint says: the answer (of the level's few) that agrees best with the pieces laid. If some piece laid is not in it,
 * those squares: { wrong: [c…] }; otherwise the first square along the oil's way still to be laid, and the piece: { c, piece }.
 * Following hints always ends in a solution, whatever the pieces laid, since each one lifts the pieces in the way first.
 */
export function hintFor(L, laid) {
  let best = null;
  for (const route of L.sols) {
    const sol = layRoute(L, route);
    if (!sol) continue;
    const wrong = [], agree = [];
    laid.forEach((p, c) => { if (p) (sol[c] === p ? agree : wrong).push(c); });
    if (!best || wrong.length < best.wrong.length || (wrong.length === best.wrong.length && agree.length > best.agree.length)) best = { sol, wrong, agree };
  }
  if (!best) return null;
  if (best.wrong.length) return { wrong: best.wrong };
  const next = trace(L, best.sol).passes.find(s => !L.cells[s.c] && !laid[s.c]);
  return next ? { c: next.c, piece: best.sol[next.c] } : { done: true };
}
/** The stars a finished level earns: 1 for solving it, 2 for solving it without a hint, 3 for that and no more than
 *  STAR_LIFTS (and one more per six pieces) pieces taken back up. */
export function starsFor(L, { hints = 0, lifts = 0 }) {
  if (hints) return 1;
  return lifts <= STAR_LIFTS + Math.floor(L.total / 6) ? 3 : 2;
}
