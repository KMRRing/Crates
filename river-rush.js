// River's puzzle rush without its page (river-rush-ui.js): the bank's lines, what a puzzle comes to in words and whether a
// move answers it. The settings, the clocks, how a run chooses its puzzles and moves your rating are every game's rush's
// (rush-core.js), re-exported here for the page and the tests. The bank, river-puzzles.txt, is found by
// tools/river-puzzles.mjs; tests/river.mjs checks it and these.
import * as X from "./river-rules.js";
import { PATTERNS, zhOf } from "./river-patterns.js";

export { MODES, STRIKES, rng, targetOf, nearest, rated } from "./rush-core.js";

/** A line of the bank (id|fen|moves|rating|theme;patterns) as a puzzle: { id, fen, moves, rating, theme, patterns }. The
 *  position is the one before the other side's mistake (moves[0]); the solver's moves and the replies follow, the
 *  solver's last. The patterns are river-patterns.js's ids, named mates and tricks ("mate;mahou,duimian"). */
export function parsePuzzle(text) {
  const [id, fen, moves, r, field = ""] = text.split("|"), [theme, patterns] = field.split(";");
  return { id, fen, moves: moves.split(" "), rating: Number(r), theme: theme || "", patterns: patterns ? patterns.split(",") : [] };
}
/** A puzzle as a line of the bank, as parsePuzzle reads it. */
export const puzzleLine = p => `${p.id}|${p.fen}|${p.moves.join(" ")}|${p.rating}|${p.theme || ""}${p.patterns?.length ? `;${p.patterns.join(",")}` : ""}`;
/** The patterns a puzzle shows, named in the reader's characters: "馬後炮 and 雙將", or "". */
export function patternWords(p, script = "traditional") {
  const xs = (p.patterns || []).filter(id => PATTERNS[id]).map(id => zhOf(id, script));
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}
/** What a puzzle's first pattern is, in a line: "馬後炮: the horse is the cannon's screen and holds the general's flight". */
export function patternSay(p, script = "traditional") {
  const id = (p.patterns || []).find(x => PATTERNS[x]);
  return id ? `${zhOf(id, script)}: ${PATTERNS[id].say}` : "";
}

const PIECE = { R: "chariot", C: "cannon", H: "horse", A: "advisor", E: "elephant", P: "soldier", K: "general" };
const named = letters => {
  const xs = [...letters].map(l => `${/^[aeiou]/.test(PIECE[l]) ? "an" : "a"} ${PIECE[l]}`);
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
};
/** What a puzzle comes to: "mate in 2", "wins a chariot", "a chariot for a cannon" (what its line takes), or "". */
export function themeWords(p) {
  if (p.theme === "mate") return `mate in ${p.moves.length / 2}`;
  const m = /^\+([A-Z]*)(?:-([A-Z]+))?$/.exec(p.theme || "");
  if (!m?.[1]) return "";
  return m[2] ? `${named(m[1])} for ${named(m[2])}` : `wins ${named(m[1])}`;
}
/** The puzzle's line after the mistake, each move as the notations name it ({ cn, wxf }). */
export function lineOf(p, script = "traditional") {
  let pos = X.parseFen(p.fen);
  return p.moves.map(u => { const m = X.parseUci(u), n = X.notate(pos, m.from, m.to, script); pos = X.after(pos, m.from, m.to); return n; }).slice(1);
}
/** The side that solves a puzzle: the one not to move in its position (the other side's mistake comes first). */
export const solverOf = p => (X.parseFen(p.fen).red ? "Black" : "Red");
const mates = (pos, uci) => { const m = X.parseUci(uci); return !X.legalMoves(X.after(pos, m.from, m.to)).length; };
/** Whether a move answers the puzzle at `step` from `pos`: the line's move, or where the line mates, any mate (a side
 *  left without a move loses, in check or not). */
export function answers(p, pos, step, uci) {
  const want = p.moves[step];
  return uci === want || (step === p.moves.length - 1 && mates(pos, want) && mates(pos, uci));
}
