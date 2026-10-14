// Gambit's game: chess by chess.js (vendor/chess.js, the rules as FIDE's Laws of Chess have them), kept as one plain
// JSON state changed only by act(), as River's is, so the page, the room and the tests share it. A game ends by
// checkmate or stalemate, by threefold repetition, by the fifty-move rule or with too little material to mate, all
// drawn at once (as online play does, without a claim), or by resignation.
import { Chess } from "./vendor/chess.js";

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const movesOf = game => String(game?.moves || "").split(" ").filter(Boolean);
/** A move in the engine's words ("e2e4", "e7e8q") as chess.js takes it. */
const asMove = uci => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
export const uciOf = m => m.from + m.to + (m.promotion || "");

/** The game replayed: { chess (at the last position), history (chess.js's verbose moves), fens (before each move and after the last), ok }. */
export function replay(game) {
  const chess = new Chess(game?.start || START), history = [], fens = [chess.fen()];
  for (const uci of movesOf(game)) {
    let m = null;
    try { m = chess.move(asMove(uci)); } catch { m = null; }
    if (!m) return { chess, history, fens, ok: false };
    history.push(m);
    fens.push(chess.fen());
  }
  return { chess, history, fens, ok: true };
}
/** Whether the game has ended, and how: null, or { winner: "white" | "black" | null, why }. */
export function outcome(chess) {
  if (chess.isCheckmate()) return { winner: chess.turn() === "w" ? "black" : "white", why: "checkmate" };
  if (chess.isStalemate()) return { winner: null, why: "stalemate" };
  if (chess.isInsufficientMaterial()) return { winner: null, why: "material" };
  if (chess.isThreefoldRepetition()) return { winner: null, why: "repetition" };
  if (chess.isDrawByFiftyMoves()) return { winner: null, why: "fifty" };
  return null;
}
/** The legal moves now, in the engine's words. */
export const legalUci = game => replay(game).chess.moves({ verbose: true }).map(uciOf);

/**
 * A game: { v, start, moves, result, white (the seat playing White: 0 or 1) }. act(state, seat, action): { move } from
 * the seat to move, { undo: n }, { resign: true }; the new state, or null when the action isn't allowed.
 */
export function newGame({ white = 0, start = START } = {}) {
  return { v: 1, start, moves: "", result: null, white };
}
export function waitingOn(state) {
  if (state.result) return null;
  const whiteToMove = replay(state).chess.turn() === "w";
  return whiteToMove ? state.white : 1 - state.white;
}
export function act(state, seat, action) {
  if (action.move) {
    if (state.result || waitingOn(state) !== seat) return null;
    const { chess } = replay(state);
    let m = null;
    try { m = chess.move(asMove(String(action.move))); } catch { m = null; }
    if (!m) return null;
    const uci = uciOf(m);
    return { ...state, moves: state.moves ? `${state.moves} ${uci}` : uci, result: outcome(chess) };
  }
  if (action.undo) {
    const all = movesOf(state), n = Math.min(action.undo, all.length);
    if (!n) return null;
    return { ...state, moves: all.slice(0, all.length - n).join(" "), result: null };
  }
  if (action.resign) {
    if (state.result) return null;
    return { ...state, result: { winner: seat === state.white ? "black" : "white", why: "resigned" } };
  }
  return null;
}
/** A state read back from the room or the device, tidied: the database may drop an empty string or a null. */
// a drawn game's winner is null, which the database doesn't keep: it's put back, so a game reads back as it was written
export function fromRoom(stored) {
  if (!stored || typeof stored !== "object") return null;
  return { ...stored, v: 1, start: stored.start || START, moves: typeof stored.moves === "string" ? stored.moves : "", result: stored.result ? { winner: null, ...stored.result } : null, white: stored.white === 1 ? 1 : 0 };
}
