// Reversi for two, on seats.js: against the computer, two on one phone, a partner's match, or a table (flank-board.js
// has the rules of a move, flank-bot.js the computer). A game is plain JSON:
//   { seats: 2, b (the board, 64 characters), t ("d" or "l": whose turn it is), over, dark (the seat playing dark, who
//     moves first), moves [the squares played], start (the board it began on), t0 (and whose turn), last: { sq, flips,
//     by, passed } (the move just made: all the page draws it from), undo (take-backs allowed: not at a table),
//     result: { d, l, winner } once it is over }
// A side with no move passes by itself (flank-board.js's position() sees to that), so the moves are the whole game and
// a take-back is a replay.
import { START, position, play, replay, tally, sqName } from "./flank-board.js";
import { scoresFor, pick, levelOf } from "./flank-bot.js";

export { START, sqName };
const other = c => (c === "d" ? "l" : "d");
/** The seat whose turn it is. */
export const seatOf = (s, colour = s.t) => (colour === "d" ? s.dark : 1 - s.dark);
/** The colour a seat plays. */
export const colourOf = (s, seat) => (seat === s.dark ? "d" : "l");
/** A state's position, for flank-board.js. */
export const positionOf = s => ({ b: s.b, t: s.t, over: s.over });

// ---------- the computer's moves, worked out in a worker and kept here ----------
// rules.bot() is synchronous, but a good move takes the page's worker a moment: the page asks the worker for the
// scores of a position's moves, hands them to prime(), and lets the runner go on; bot() finds them here. Without them
// (a table whose computer moved before the worker answered, the tests, the bench) it searches here, to a limit on the
// positions looked at, so it can never hold the page for long.
const memo = new Map();
export const keyOf = (b, t, level) => `${level}|${t}|${b}`;
export function prime(b, t, level, scores) {
  memo.set(keyOf(b, t, level), scores);
  if (memo.size > 12) memo.delete(memo.keys().next().value);
}
export const primed = (b, t, level) => memo.has(keyOf(b, t, level));
const SYNC_CAP = 120000;

function finish(s) {
  const n = tally(s.b);
  s.result = { d: n.d, l: n.l, winner: n.d > n.l ? "d" : n.l > n.d ? "l" : "" };
  return s;
}
/** A state from a position and the moves that led to it; `by` is the colour that made the last of them. */
function stateFrom(s, p, moves, by = "") {
  s.b = p.b; s.t = p.t; s.over = p.over; s.moves = moves;
  s.last = p.sq == null ? null : { sq: p.sq, flips: p.flips, by, passed: p.passed || "" };
  delete s.result;
  return p.over ? finish(s) : s;
}

export const rules = {
  id: "flank",
  seats: { min: 2, max: 2 },

  /** options: { colour: "dark" | "light" | "either" (yours against the computer; dark moves first), undo (default true),
   *  start: { b, t } (a position other than the opening) }. */
  deal({ options = {}, rng }) {
    const start = options.start?.b || START, t0 = options.start?.t || "d";
    const p = position(start, t0);
    const dark = options.colour === "light" ? 1 : options.colour === "either" ? (rng() < 0.5 ? 0 : 1) : 0;
    const s = { seats: 2, dark, undo: options.undo !== false, start, t0, moves: [] };
    return stateFrom(s, p, []);
  },

  toMove: s => (s.over ? null : seatOf(s)),

  /** A move is a square (0 to 63), or { undo: n } to take the last n back. */
  act(s, seat, m) {
    if (m && typeof m === "object" && m.undo) {
      if (!s.undo) return "Take-backs are off at a table";
      const n = Math.min(Math.max(1, m.undo | 0), s.moves.length);
      if (!s.moves.length) return "Nothing to take back";
      const moves = s.moves.slice(0, s.moves.length - n), ps = replay(moves, position(s.start, s.t0));
      return stateFrom(s, ps.at(-1), moves, ps.at(-2)?.t);
    }
    if (!Number.isInteger(m) || m < 0 || m > 63) return "Tap a square";
    if (seatOf(s) !== seat) return "It isn't your turn";
    const p = play(positionOf(s), m);
    if (!p) return `${sqName(m)} flanks nothing`;
    return stateFrom(s, p, [...s.moves, m], s.t);
  },

  anytime: m => !!(m && typeof m === "object" && m.undo),

  bot(s, seat, { level, rng }) {
    const L = level || "medium", scores = memo.get(keyOf(s.b, s.t, L)) || scoresFor(s.b, s.t, L, SYNC_CAP);
    return pick(scores, L, rng);
  },

  over: s => !!s.over,

  restore(s) {
    s.moves = s.moves ? Object.values(s.moves) : [];
    if (s.last) s.last.flips = s.last.flips ? Object.values(s.last.flips) : [];
    return s;
  },
};
export { levelOf };
