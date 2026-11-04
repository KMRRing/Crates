// Small things the Chess course's lesson files share: a step's board from a piece list, and the goals that tap squares.
import { START, EMPTY, fenOf, load, targets } from "./chess-lab.js";
import * as G from "./gambit-rules.js";
import { Chess } from "./vendor/chess.js";

/** A step's board: "start", "empty" or a piece list (chess-lab.js fenOf, with its options f), and the marks and so on in o. */
export const bd = (pieces, o = {}, f = {}) => ({ fen: pieces === "start" ? START : pieces === "empty" ? EMPTY : fenOf(pieces, f), ...o });
/** A goal: tap every square the piece on sq can move to. */
export const reach = (board, sq) => ({ type: "squares", squares: targets(board.fen, sq), of: sq });
/** A goal: tap these squares. */
export const tap = (...squares) => ({ type: "squares", squares });
/** How a game in this position stands, as Gambit's rules say: "checkmate", "stalemate"… or null. */
export const outcomeOf = fen => G.outcome(load(fen))?.why || null;
/** A line written in SAN from a position as the engine's moves: ["e2e4", "e7e5", …]. */
export function uciLine(sans, from = START) {
  const c = new Chess(from), out = [];
  for (const san of sans.split(/\s+/).filter(Boolean)) { const m = c.move(san); out.push(m.from + m.to + (m.promotion || "")); }
  return out;
}
