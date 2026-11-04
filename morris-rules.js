// Nine Men's Morris for two, on seats.js: against the computer, two on one phone, a partner's match or a table. The rules
// of a move are morris-board.js's, the computer morris-search.js's. A game is plain JSON:
//   { seats: 2, b (the board, 24 characters "d", "l", "."), t ("d" or "l": whose turn), hd, hl (pieces still in hand),
//     dark (the seat playing dark, who moves first), moves [the moves made, as numbers], hist [the position after
//     each move, as a key, for the third-time rule], undo (take-backs allowed: not at a table), over,
//     result: { winner ("d", "l" or "" for a draw), why: "two" | "blocked" | "repeat" | "resign" } once it is over,
//     start: { b, t, hd, hl } when it began elsewhere than the empty board (a lesson) }
// A game is its moves, so a take-back replays it.
import { START, NINE, position, positionOfText, toText, movesOf, play, replay, keyOf, decode, encode, ptName } from "./morris-board.js";
import { think } from "./morris-search.js";

export { ptName };
const other = c => (c === "d" ? "l" : "d");
/** The seat whose turn it is. */
export const seatOf = (s, colour = s.t) => (colour === "d" ? s.dark : 1 - s.dark);
/** The colour a seat plays. */
export const colourOf = (s, seat) => (seat === s.dark ? "d" : "l");
/** A state's position. */
export const positionOf = s => positionOfText(s.b, s.t, s.hd, s.hl);
export const startOf = s => (s.start ? positionOfText(s.start.b, s.start.t, s.start.hd, s.start.hl) : position(START.d, START.l, "d", NINE, NINE));

/** Moves the page's worker has already worked out, by position (so the computer's turn comes without a pause). */
export const ready = new Map();
export const readyKey = (s, level) => `${level}|${keyOf(positionOf(s))}|${s.moves.length}`;

/** The last move made, as the page draws it: { f, t, x, by (the colour that made it) } or null. */
export function lastOf(s) {
  if (!s.moves.length) return null;
  const m = decode(s.moves[s.moves.length - 1]);
  return { ...m, by: other(s.t) };        // the turn passes even when the move ends the game
}
/** Positions the game has stood in, for the search to see a third time coming. */
export function seenOf(s) {
  const seen = new Map();
  for (const k of s.hist) seen.set(k, (seen.get(k) || 0) + 1);
  return seen;
}

const SIDE = { d: "Dark", l: "Light" };
function stateFrom(s, p, moves, hist) {
  s.b = toText(p); s.t = p.t; s.hd = p.hd; s.hl = p.hl;
  s.moves = moves; s.hist = hist;
  delete s.result;
  s.over = p.over;
  if (p.over) s.result = { winner: p.winner, why: p.why };
  else if (hist.filter(k => k === hist[hist.length - 1]).length >= 3) { s.over = true; s.result = { winner: "", why: "repeat" }; }
  return s;
}

export const rules = {
  id: "morris",
  seats: { min: 2, max: 2 },

  /** options: { colour: "dark" | "light" | "either" (yours against the computer; dark moves first), undo (default true),
   *  start: { b, t, hd, hl } (a position other than the empty board, for a lesson) }. */
  deal({ options = {}, rng }) {
    const st = options.start, p = st ? positionOfText(st.b, st.t || "d", st.hd || 0, st.hl || 0) : position(START.d, START.l, "d", NINE, NINE);
    const dark = options.colour === "light" ? 1 : options.colour === "either" ? (rng() < 0.5 ? 0 : 1) : 0;
    const s = { seats: 2, dark, undo: options.undo !== false, moves: [] };
    if (st) s.start = { b: st.b, t: st.t || "d", hd: st.hd || 0, hl: st.hl || 0 };
    return stateFrom(s, p, [], [keyOf(p)]);
  },

  toMove: s => (s.over ? null : seatOf(s)),

  /** A move is a move number, { undo: n } to take the last n back, or { resign: true }. */
  act(s, seat, m) {
    if (m && typeof m === "object" && m.resign) {
      if (s.over) return "The game is over";
      s.over = true;
      s.result = { winner: other(colourOf(s, seat)), why: "resign" };
      return s;
    }
    if (m && typeof m === "object" && m.undo) {
      if (!s.undo) return "Take-backs are off at a table";
      if (!s.moves.length) return "Nothing to take back";
      const n = Math.min(Math.max(1, m.undo | 0), s.moves.length), moves = s.moves.slice(0, s.moves.length - n);
      const ps = replay(moves, startOf(s));
      return stateFrom(s, ps.at(-1), moves, ps.map(keyOf));
    }
    if (!Number.isInteger(m) || m < 0) return "Tap a point";
    if (seatOf(s) !== seat) return "It isn't your turn";
    const p = positionOf(s);
    if (!movesOf(p).includes(m)) return "That isn't a legal move";
    const next = play(p, m);
    return stateFrom(s, next, [...s.moves, m], [...s.hist, keyOf(next)]);
  },

  anytime: m => !!(m && typeof m === "object" && (m.undo || m.resign)),

  bot(s, seat, { level, rng }) {
    const L = level || "medium", key = readyKey(s, L), hit = ready.get(key);
    if (hit != null) { ready.delete(key); return hit; }
    return think(positionOf(s), L, { rng, seen: seenOf(s) }).code;
  },

  over: s => !!s.over,

  restore(s) {
    s.moves = s.moves ? Object.values(s.moves) : [];
    s.hist = s.hist ? Object.values(s.hist) : [];
    return s;
  },
};
export { SIDE, encode, decode };
