// River's puzzle rush without its page (river-rush-ui.js): the bank's lines, what a puzzle comes to in words, whether a
// move answers it, and how a run chooses its puzzles and moves your rating, by the chess Rush's rules (rush.js). The bank,
// river-puzzles.txt, is found by tools/river-puzzles.mjs; tests/river.mjs checks it and these.
import * as X from "./river-rules.js";

/** The runs: three minutes with five seconds' grace for each puzzle (Standard's delay), five minutes, or no clock. */
export const MODES = { three: { label: "3 min, 5 s delay", ms: 180000, grace: 5000 }, five: { label: "5 minutes", ms: 300000 }, survival: { label: "Survival", ms: 0 } };
export const STRIKES = 3;
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A line of the bank (id|fen|moves|rating|theme) as a puzzle: { id, fen, moves, rating, theme }. The position is the
 *  one before the other side's mistake (moves[0]); the solver's moves and the replies follow, the solver's last. */
export function parsePuzzle(text) {
  const [id, fen, moves, r, theme] = text.split("|");
  return { id, fen, moves: moves.split(" "), rating: Number(r), theme: theme || "" };
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

/**
 * The rating a run's next puzzle aims at (run: { warming, daily, solved }; r: your rating; rand: the run's chance, seeded
 * by the run and how far it has got): the warm-up an easy one; today's run the same climb for everyone, 800 and 60 a
 * solve; otherwise from about 250 below your rating, 40 a solve, to about 150 above it (a miss doesn't raise it).
 */
export function targetOf(run, r, rand) {
  if (run.warming) return 650 + rand() * 100;
  if (run.daily) return Math.min(2500, 800 + run.solved * 60 + (rand() - 0.5) * 200);
  return Math.max(600, Math.min(2500, Math.min(r + 150, r - 250 + run.solved * 40) + (rand() - 0.5) * 160));
}
/** The puzzle nearest a target among those not yet used (all of them again, once a run has used every one), a salt of
 *  up to 40 points so a target doesn't always give the same one. */
export function nearest(bank, used, target, rand) {
  const free = bank.some(p => !used.has(p.id)) ? p => !used.has(p.id) : () => true;
  let best = null;
  for (const p of bank) {
    if (!free(p)) continue;
    const d = Math.abs(p.rating - target) + rand() * 40;
    if (!best || d < best.d) best = { p, d };
  }
  return best.p;
}
/** Your rating ({ r, n }) after a puzzle, Elo-style against its own: fast for your first twenty puzzles (30 points a
 *  game's worth), then slowly (10 for a solve, halving with each miss earlier in the run so a careless run can't climb;
 *  14 for a miss), between 400 and 3,000. */
export function rated({ r, n }, puzzle, solved, missesSoFar) {
  const expected = 1 / (1 + 10 ** ((puzzle.rating - r) / 400));
  const k = n < 20 ? 30 : solved ? 10 / 2 ** missesSoFar : 14;
  return { r: Math.max(400, Math.min(3000, r + k * ((solved ? 1 : 0) - expected))), n: n + 1 };
}
