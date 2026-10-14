// The coach of the games played against an engine (River, Gambit): the strongest moves in a position, and what a move
// gave away. The page sets how much it says (COACH): off; hints, when asked; check, a word after each move of yours
// that gave away a good deal; always, the strongest moves shown at each of yours, and the same word.
//
// A position's analysis is the engine at full strength showing its best three moves (MultiPV 3), each with its score.
// The strongest are the best and any within a fifth of a pawn of it, the noise of a search cut off at a set number of
// positions: in an opening there are often two or three, at a combination one. A move outside the three is searched
// on its own (UCI's searchmoves), from the same position, so it's scored as the best was.
//
// A move is judged by winning chances, Lichess's curve 2 / (1 + e^(−0.00368·cp)) − 1 (−1 lost, 0 level, 1 won), so a
// pawn thrown away in a level game counts and the same pawn when a rook up doesn't: a fall of 0.2 is a mistake (?),
// 0.3 a blunder (??), as Lichess marks them. A fall under 0.2 (an inaccuracy, or a slightly weaker move) gets no word:
// the check is for the moves that matter. `scale` is a game's centipawns to chess's (Xiangqi's engine scores a soldier
// at about 1.25 of a chess pawn, so its numbers run larger), applied to the curve and to the fifth of a pawn.
import { valueOf } from "./uci.js";

/** The coach's ways, as the menu offers them. */
export const COACH = [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"]];
export const isCoach = v => COACH.some(([k]) => k === v);
const FULL = { "Skill Level": 20, UCI_LimitStrength: false };

/** A line's score in centipawns for the mover, a mate counted as ten pawns (past that, everything is won or lost alike). */
export const scoreOf = l => (l.mate != null ? (l.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, l.cp ?? 0)));
/** Winning chances for the mover, −1 to 1, from a score. */
export const chances = (cp, scale = 1) => 2 / (1 + Math.exp(-0.00368208 * cp / scale)) - 1;

/** The strongest moves of an analysis, best first: the best and those within a fifth of a pawn of it (a mate only by
 *  another as quick). */
export function strongest(lines, scale = 1) {
  if (!lines.length) return [];
  const ranked = [...lines].sort((a, b) => valueOf(b) - valueOf(a)), top = valueOf(ranked[0]);
  return ranked.filter(l => top - valueOf(l) <= 20 * scale).map(l => l.pv[0]);
}

/**
 * A move against the best, both lines from the position before it: { drop (winning chances given up), loss (centipawns,
 * a mate as ten pawns), mark ("?", "??" or null), missed (the mate it missed: n moves), allows (the mate it lets in) }.
 */
export function judge(best, played, scale = 1) {
  const drop = Math.max(0, chances(scoreOf(best), scale) - chances(scoreOf(played), scale));
  return {
    drop, loss: Math.max(0, scoreOf(best) - scoreOf(played)), mark: drop >= 0.3 ? "??" : drop >= 0.2 ? "?" : null,
    missed: best.mate > 0 && !(played.mate > 0) ? best.mate : null,
    allows: played.mate < 0 && !(best.mate < 0) ? -played.mate : null,
  };
}

/**
 * A coach on an engine (uci.js's Engine). limit: an analysis's search ("nodes 400000"); alone: a single move's
 * ("nodes 200000"). Analyses are kept for the last few positions, so a hint, the advice and the check share one.
 */
export function createCoach(engine, { limit, alone, scale = 1 }) {
  const kept = new Map();                                         // "fen|moves" → the analysis's lines (a promise)
  /** The engine's best three moves from a position (its start and the moves since), each with its score. */
  function analyse(fen, moves = []) {
    const key = `${fen}|${moves.join(" ")}`;
    if (!kept.has(key)) {
      const p = engine.search({ fen, moves, limit, options: { ...FULL, MultiPV: 3 } }).then(r => r.lines.filter(l => l.pv?.length));
      p.catch(() => kept.delete(key));                            // a search that failed is tried again next time
      kept.set(key, p);
      while (kept.size > 8) kept.delete(kept.keys().next().value);
    }
    return kept.get(key);
  }
  /** A move made from a position, against the analysis: judge()'s verdict with the strongest moves there and both
   *  lines (best, played); null when the engine has nothing to say (no move left, or a search that failed). */
  async function check(fen, moves, move) {
    const lines = await analyse(fen, moves);
    if (!lines.length) return null;
    const best = [...lines].sort((a, b) => valueOf(b) - valueOf(a))[0];
    let played = lines.find(l => l.pv[0] === move);
    if (!played) played = (await engine.search({ fen, moves, limit: `${alone} searchmoves ${move}`, options: { ...FULL, MultiPV: 1 } })).lines[0];
    if (!played) return null;
    return { strongest: strongest(lines, scale), best, played, ...judge(best, played, scale) };
  }
  return { analyse, check, strongest: lines => strongest(lines, scale) };
}
