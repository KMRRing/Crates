// Four in a row for two, on seats.js (solo against the computer, two on one phone is the same table with both
// seats yours, a partner's match, or a table of friends each on their own phone). The board and its rules are
// silo-board.js's, the computer silo-bot.js's. A game is the columns played, in order, as a string ("33442"), so the
// state is small, plain and always replayable; a running tally of games won is carried from one game to the next.
//
// state: { moves, first (the seat that moves first this game), score: [seat 0's wins, seat 1's, draws], game (its
// number), winner (null while playing; the seat that made four, or -1 for a full board), line (the cells of the four) }
import { N, drop, outcome } from "./silo-board.js";
import { chooseMove } from "./silo-bot.js";

export { LEVEL_NAMES } from "./silo-bot.js";
/** Who starts: "take turns" (the default; the first game is seat 0's), or always one seat. */
export const STARTS = [["alternate", "Take turns"], ["you", "You"], ["other", "The other"]];

const seatOfMove = (s, k) => (s.first + k) % 2;

export const rules = {
  id: "silo",
  seats: { min: 2, max: 2 },

  deal({ options = {}, prev = null }) {
    const start = STARTS.some(([k]) => k === options.start) ? options.start : "alternate";
    const keep = prev && !options.fresh;
    const first = start === "you" ? 0 : start === "other" ? 1 : keep ? 1 - prev.first : 0;
    const s = {
      moves: "", first, score: keep ? [0, 1, 2].map(i => prev.score?.[i] || 0) : [0, 0, 0], game: keep ? (prev.game || 0) + 1 : 1,
      winner: null, line: [],
    };
    s.say = `${keep ? `Game ${s.game}. ` : ""}{s${first}} starts.`;
    return s;
  },

  toMove: s => (s.winner != null ? null : seatOfMove(s, s.moves.length)),

  act(s, seat, m) {
    if (s.winner != null) return "The game is over";
    if (seatOfMove(s, s.moves.length) !== seat) return "It isn't your turn";
    const c = Number(m?.c);
    const next = drop(s.moves, c);
    if (next === null) return Number.isInteger(c) && c >= 0 && c < 7 ? "That column is full" : "Choose a column";
    s.moves = next;
    const o = outcome(next);
    if (o.over) {
      s.winner = o.draw ? -1 : seat;
      s.line = o.line;
      s.score[o.draw ? 2 : seat]++;
      s.say = o.draw ? "A draw: the board is full." : `{s${seat}} makes four in a row.`;
    }
    return s;
  },

  bot(s, seat, { level, rng }) {
    return { c: chooseMove(s.moves, level || "medium", rng) };
  },

  over: s => s.winner != null,

  restore(s) {
    s.moves ||= "";
    s.score = [0, 1, 2].map(i => s.score?.[i] || 0);
    s.line = s.line ? Object.values(s.line).map(x => Object.values(x)) : [];
    s.first ||= 0;
    return s;
  },
};

export { N };
