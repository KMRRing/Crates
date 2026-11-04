// What the Chess course asks of the board and how it judges the answer (chess-stage.js draws, chess-lessons.js asks): more of what a position
// shows, worked out from its pieces by the rules (chess-lab.js), and a move put to a lesson's goal. No DOM: the tests load it in Node.
import { START, load, after, kingSquare, sqIdx, turnOf, VAL, evalMat, mateMoves, forcedMates, stubborn, legalUcis, whyNotMate, whyNotParried, whyNotBest } from "./chess-lab.js";

/** The position after moves in SAN from the start, or from a given position. */
export function fenAfter(sans, from = START) {
  const c = load(from);
  for (const san of String(sans).split(/\s+/).filter(Boolean)) c.move(san);
  return c.fen();
}
/** The pieces of `colour` that attack sq (so, on a piece of that colour, the ones defending it). */
export const attackersOf = (fen, sq, colour) => load(fen).attackers(sq, colour);
/** The pieces of one colour that cannot leave their line without exposing their own king (pinned to it). */
export function pinned(fen, colour) {
  const c = load(fen), king = kingSquare(fen, colour), out = [];
  if (!king) return out;
  const foe = colour === "w" ? "b" : "w", now = c.attackers(king, foe).length;
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== colour || p.type === "k") continue;
    const t = load(fen);
    t.remove(p.square);
    if (t.attackers(king, foe).length > now) out.push(p.square);
  }
  return out;
}
/** Pieces (not kings) of one colour that the other side may take for nothing, or take with a cheaper piece. */
export function threatened(fen, colour) {
  const c = load(fen), foe = colour === "w" ? "b" : "w", out = [];
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== colour || p.type === "k") continue;
    const by = c.attackers(p.square, foe);
    if (!by.length) continue;
    const cheapest = Math.min(...by.map(s => VAL[c.get(s).type] || 99));
    if (!c.attackers(p.square, colour).length || cheapest < VAL[p.type]) out.push(p.square);
  }
  return out;
}
/** Which side has the opposition: the kings on one file or rank with a single square between them, and the side not to move has it. */
export function opposition(fen) {
  const [a, b] = ["w", "b"].map(colour => sqIdx(kingSquare(fen, colour)));
  const direct = (a[0] === b[0] && Math.abs(a[1] - b[1]) === 2) || (a[1] === b[1] && Math.abs(a[0] - b[0]) === 2);
  return direct ? (turnOf(fen) === "w" ? "b" : "w") : null;
}

/**
 * A move put to a goal: { ok, why } for a miss, { ok, reply (the opponent's answer, in the engine's words), more (the goal for the next
 * move) } for a hit. Goals: move (moves: the right ones, no: why the others are not, a text or one for each move), best (moves, gain:
 * material by search), mate (in: n), parry (a threat of mate in one to be stopped), line (moves: both sides' moves in turn; cue: what to
 * think of when it isn't the move; i: how far on).
 */
export function judgeMove(goal, fen, uci, i = 0) {
  const a = after(fen, uci);
  if (!a) return { ok: false, why: "That is not a legal move." };
  const reason = text => (text && typeof text === "object" ? text[uci] : text);
  switch (goal.type) {
    case "move": return goal.moves.includes(uci) ? { ok: true } : { ok: false, why: reason(goal.no) || "That is legal, but it is not what was asked." };
    case "best": {
      if (goal.moves.includes(uci)) return { ok: true };
      const base = evalMat(load(fen));
      return { ok: false, why: reason(goal.no) || whyNotBest(fen, uci, { base, value: base + goal.gain }) || "There is something better." };
    }
    case "mate": {
      const n = goal.in || 1;
      if (a.chess.isCheckmate()) return { ok: true };
      if (n === 1 || a.chess.isStalemate() || !forcedMates(fen, n).includes(uci)) return { ok: false, why: whyNotMate(fen, uci, n) };
      return { ok: true, reply: stubborn(a.fen, n - 1), more: { ...goal, in: n - 1 } };
    }
    case "parry": return mateMoves(a.fen).length ? { ok: false, why: whyNotParried(fen, uci) } : { ok: true };
    case "line": {
      const want = goal.moves[i];
      if (uci === want || goal.alt?.[i]?.includes(uci)) return { ok: true, reply: goal.moves[i + 1] || null };
      const cue = Array.isArray(goal.cue) ? goal.cue[i] : goal.cue;
      return { ok: false, why: `Not the move of this line. ${cue || ""}`.trim() };
    }
    default: throw new Error(`no goal "${goal.type}"`);
  }
}
/** The moves a goal accepts here (for the hint's arrow and for the tests): the first is the one to show. */
export function answersOf(goal, fen, i = 0) {
  switch (goal.type) {
    case "move": case "best": return goal.moves;
    case "mate": return forcedMates(fen, goal.in || 1);
    case "parry": return legalUcis(fen).filter(u => !mateMoves(after(fen, u).fen).length);
    case "line": return [goal.moves[i], ...(goal.alt?.[i] || [])];
    default: return [];
  }
}
