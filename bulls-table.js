// Bulls played together (together.js keeps it in the room's "bulls" branch), pure, so tests/bulls.mjs can play whole
// tables through the database's own round trip. Up to six at a table, each on their own phone, three ways:
//  - Team: one board for the table and one code to break. Anyone guesses, but the key pegs of your guess show on
//    everyone's screen but yours, so the player who guesses is always told by another what it scored (in Lock, the
//    clues are shared out instead, and nobody holds enough of them to open it alone).
//  - Race: the same code (or lock) for everyone, each on their own board; the fewest guesses wins, then the quicker.
//  - Versus: each sets a code for the next player round the table and breaks the one set for them (two players: each
//    other's), the genre's own two-player game; the fewest guesses wins, then the quicker.
// Every change is made inside a transaction and only if the table is as the player's screen showed it.
import { VARIANTS, secretOf, score, invalid } from "./bulls-engine.js";
import { LOCK_LEVELS, makeLock, shareClues, scoreLock, WRONG } from "./bulls-lock.js";

export const PLAYS = { team: "Team", race: "Race", versus: "Versus" };
export const KINDS = { break: "Break", lock: "Lock" };
export const MOST = 6;

const list = x => (Array.isArray(x) ? x : x && typeof x === "object" ? Object.values(x) : []).filter(v => v != null);
const sk = slot => `s${slot}`;

/** A game for the table: kind (break or lock), play (team, race or versus; a lock has no versus), the board or the
 *  level, a seed, and the seats in it (`ring`, in seat order: versus passes codes round it, team shares clues by it). */
export function dealGame({ kind = "break", play = "team", variant = "classic", level = "medium", seed }, slots, now) {
  kind = KINDS[kind] ? kind : "break";
  play = PLAYS[play] && !(kind === "lock" && play === "versus") ? play : "team";
  const ring = [...new Set(slots)].sort((a, b) => a - b);
  const game = { kind, play, seed, dealt: now, ring };
  if (kind === "break") game.variant = VARIANTS[variant] ? variant : "classic";
  else {
    game.level = LOCK_LEVELS[level] ? level : "medium";
    if (play === "team") {
      const lock = makeLock(game.level, seed, { minClues: Math.min(ring.length, 4) });
      game.hands = Object.fromEntries(shareClues(lock, ring.length).map((h, i) => [sk(ring[i]), h]));
    }
  }
  if (play === "team") game.board = kind === "break" ? { rows: [] } : { tries: [], strikes: 0 };
  else game.seats = {};
  if (play === "versus") game.codes = {};
  return game;
}
/** A new table with its first game, for the people sat at it. */
export function freshTable(players, { app = 1, people = 2, now = Date.now(), deal = {} } = {}) {
  const slots = Object.values(players).map(p => p.slot);
  return { v: 1, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, n: 1, game: dealGame(deal, slots, now) };
}
export const isTable = g => g?.v === 1 && !!g.game?.kind && Number.isInteger(g.n);

/** The table as the database gives it back, made whole: it keeps no empty lists, no nulls, and may return a list with
 *  holes. Changes it, and returns it. */
export function tidy(g) {
  const G = g.game;
  G.ring = list(G.ring);
  const rows = r => list(r).map(x => ({ ...x, g: list(x.g), b: x.b || 0, c: x.c || 0 }));
  const tries = t => list(t).map(x => ({ ...x, a: list(x.a) }));
  if (G.play === "team") {
    G.board ||= {};                                           // a board with nothing on it yet comes back as nothing at all
    if (G.kind === "break") G.board.rows = rows(G.board.rows);
    else { G.board.tries = tries(G.board.tries); G.board.strikes ||= 0; }
  }
  if (G.play !== "team") {
    G.seats ||= {};
    for (const s of Object.values(G.seats)) { if (G.kind === "break") s.rows = rows(s.rows); else { s.tries = tries(s.tries); s.strikes ||= 0; s.hints ||= 0; } }
  }
  if (G.hands) for (const k of Object.keys(G.hands)) G.hands[k] = list(G.hands[k]);
  if (G.play === "versus") { G.codes ||= {}; for (const k of Object.keys(G.codes)) G.codes[k] = list(G.codes[k]); }
  return g;
}

// ---------- what each seat breaks, and sees ----------
const LOCKS = new Map();
/** The game's lock (made from its seed and level, the same on every phone; a team's with a clue for each of its seats). */
export function lockOf(G) {
  const key = `${G.level}/${G.seed}/${G.play === "team" ? Math.min(G.ring.length, 4) : 0}`;
  if (!LOCKS.has(key)) { LOCKS.set(key, makeLock(G.level, G.seed, { minClues: G.play === "team" ? Math.min(G.ring.length, 4) : 0 })); if (LOCKS.size > 8) LOCKS.delete(LOCKS.keys().next().value); }
  return LOCKS.get(key);
}
/** Versus: the seat whose code this seat breaks (the one before it round the table). */
export function setterOf(G, slot) {
  const i = G.ring.indexOf(slot);
  return i < 0 ? null : G.ring[(i - 1 + G.ring.length) % G.ring.length];
}
/** Versus: the seat that breaks this seat's code. */
export function breakerOf(G, slot) {
  const i = G.ring.indexOf(slot);
  return i < 0 ? null : G.ring[(i + 1) % G.ring.length];
}
/** The code a seat is breaking: the game's own, or (versus) the one set for it; null while it isn't set. */
export function targetOf(G, slot) {
  if (G.kind === "lock") return lockOf(G).secret;
  if (G.play !== "versus") return secretOf(G.variant, G.seed);
  const code = G.codes?.[sk(setterOf(G, slot))];
  return code?.length ? code : null;
}
/** Team: whether a row's key pegs show to this seat: everyone's but the guesser's, and everyone's once it's over. */
export const keysShown = (G, row, slot) => G.play !== "team" || row.by !== slot || !!G.board?.done;
/** Team Lock: the clues this seat holds (a seat that came after the deal holds none until the next game). */
export const handOf = (G, slot) => G.hands?.[sk(slot)] || [];
/** Versus: whether every seat round the table has set its code, so the breaking has begun. */
export const allSet = G => G.play !== "versus" || G.ring.every(s => G.codes?.[sk(s)]?.length);

// ---------- moves ----------
const pegsOf = G => (G.kind === "break" ? VARIANTS[G.variant].pegs : lockOf(G).p);
const rowsOf = G => (G.kind === "break" ? VARIANTS[G.variant].rows : Infinity);
const on = (g, n) => g.n === n;
/** Why an answer to a lock can't be tried: a digit missing or twice. */
const badAnswer = (G, a) => (!Array.isArray(a) || a.length !== pegsOf(G) || a.some(x => !Number.isInteger(x) || x < 0 || x > 9) ? "Fill every digit" : new Set(a).size < a.length ? "Every digit different" : null);

/**
 * Team Break: a guess for the table, made only if the board still has the `seen` rows the guesser's screen showed
 * (someone else's guess got there first: "taken"). The outcome: "broken", "out", "ok", "taken", "over" or "moved".
 */
export function teamGuess(g, { n, seen, slot, guess, now }) {
  const G = g.game, B = G.board;
  if (!on(g, n) || G.play !== "team" || G.kind !== "break") return "moved";
  if (B.done) return "over";
  if (B.rows.length !== seen) return "taken";
  if (invalid(G.variant, guess)) return invalid(G.variant, guess);
  const s = score(guess, targetOf(G, slot));
  B.rows.push({ g: guess.slice(), b: s.b, c: s.c, by: slot, at: now });
  if (s.b === pegsOf(G)) B.done = { how: "broken", at: now, by: slot };
  else if (B.rows.length >= rowsOf(G)) B.done = { how: "out", at: now };
  return B.done?.how || "ok";
}
/** Team Lock: an answer tried for the table: "open", "wrong" (a strike for the team), "over" or "moved". */
export function teamTry(g, { n, slot, answer, now }) {
  const G = g.game, B = G.board;
  if (!on(g, n) || G.play !== "team" || G.kind !== "lock") return "moved";
  if (B.done) return "over";
  if (badAnswer(G, answer)) return badAnswer(G, answer);
  const ok = scoreLock(answer, lockOf(G).secret)[0] === pegsOf(G);
  B.tries.push({ a: answer.slice(), by: slot, at: now, ok });
  if (ok) B.done = { how: "open", at: now, by: slot };
  else B.strikes++;
  return ok ? "open" : "wrong";
}
/** Race and Versus: this seat's own board, begun the first time its phone shows the game (its clock starts then; in
 *  Versus once every code is set). */
export function begin(g, { n, slot, now }) {
  const G = g.game;
  if (!on(g, n) || G.play === "team" || G.seats[sk(slot)] || (G.play === "versus" && (!G.ring.includes(slot) || !allSet(G)))) return false;
  G.seats[sk(slot)] = G.kind === "break" ? { rows: [], from: now } : { tries: [], strikes: 0, hints: 0, from: now };
  return true;
}
/** Versus: the code a seat sets for the next round the table, once; the breaking begins when the last is set. */
export function setCode(g, { n, slot, code, now }) {
  const G = g.game;
  if (!on(g, n) || G.play !== "versus" || !G.ring.includes(slot)) return "moved";
  if (G.codes[sk(slot)]?.length) return "set";
  if (invalid(G.variant, code)) return invalid(G.variant, code);
  G.codes[sk(slot)] = code.slice();
  if (allSet(G)) G.start = now;
  return "ok";
}
/** Race and Versus Break: a guess on this seat's own board, if it still has the `seen` rows: "broken", "out", "ok", … */
export function ownGuess(g, { n, slot, seen, guess, now }) {
  const G = g.game, S = G.seats?.[sk(slot)];
  if (!on(g, n) || G.play === "team" || G.kind !== "break") return "moved";
  if (!S) return "unseated";
  if (S.done) return "over";
  if (S.rows.length !== seen) return "taken";
  if (invalid(G.variant, guess)) return invalid(G.variant, guess);
  const s = score(guess, targetOf(G, slot));
  S.rows.push({ g: guess.slice(), b: s.b, c: s.c, at: now });
  if (s.b === pegsOf(G)) S.done = "broken";
  else if (S.rows.length >= rowsOf(G)) S.done = "out";
  if (S.done) S.at = now;
  return S.done || "ok";
}
/** Race Lock: an answer tried on this seat's own lock: "open", "wrong" (a strike), … ; hint: one more hint taken. */
export function ownTry(g, { n, slot, answer, now }) {
  const G = g.game, S = G.seats?.[sk(slot)];
  if (!on(g, n) || G.play !== "race" || G.kind !== "lock") return "moved";
  if (!S) return "unseated";
  if (S.done) return "over";
  if (badAnswer(G, answer)) return badAnswer(G, answer);
  const ok = scoreLock(answer, lockOf(G).secret)[0] === pegsOf(G);
  S.tries.push({ a: answer.slice(), at: now, ok });
  if (ok) { S.done = "open"; S.at = now; } else S.strikes++;
  return ok ? "open" : "wrong";
}
export function ownHint(g, { n, slot, seen }) {
  const S = g.game.seats?.[sk(slot)];
  if (!on(g, n) || !S || S.done || g.game.kind !== "lock" || S.hints !== seen) return false;
  S.hints++;
  return true;
}

// ---------- how it went ----------
/** When a seat's clock started: Team at the deal, Versus when the last code was set, Race at the seat's first look. */
const fromOf = (G, S) => (G.play === "team" ? G.dealt : G.play === "versus" ? G.start ?? S?.from : S?.from);
/** A finished run's figures: { done, guesses (Break), secs (the time, and Lock's penalties: WRONG a strike, a hint
 *  the same), score (what ranks: lower is better) }. */
export function runOf(G, slot) {
  const S = G.play === "team" ? null : G.seats?.[sk(slot)];
  if (G.play !== "team" && !S) return null;
  const end = G.play === "team" ? G.board.done?.at : S.at, from = fromOf(G, S);
  const ms = end != null && from != null ? Math.max(0, end - from) : null;
  if (G.kind === "break") {
    const rows = G.play === "team" ? G.board.rows : S.rows, done = G.play === "team" ? G.board.done?.how ?? null : S.done ?? null;
    // the broken first, by guesses, then the quicker; the rows ran out: after every broken one
    return { done, guesses: rows.length, ms, score: done === "broken" ? rows.length : done === "out" ? rowsOf(G) + 1 : null };
  }
  const T = G.play === "team" ? G.board : S, done = G.play === "team" ? T.done?.how ?? null : T.done ?? null;
  const secs = ms == null ? null : Math.round(ms / 1000) + WRONG * (T.strikes || 0) + WRONG * (T.hints || 0);
  return { done, ms, secs, strikes: T.strikes || 0, hints: T.hints || 0, score: done ? secs : null };
}
/** Race and Versus: everyone who began, best first, each with a rank (equal runs share one): [{ slot, run, rank }]. */
export function standings(G) {
  if (G.play === "team") return [];
  const rows = Object.keys(G.seats || {}).map(k => ({ slot: Number(k.slice(1)), run: runOf(G, Number(k.slice(1))) }));
  const key = r => [r.run.score ?? Infinity, G.kind === "break" ? r.run.ms ?? Infinity : 0];
  const cmp = (a, b) => { const [x1, y1] = key(a), [x2, y2] = key(b); return x1 - x2 || y1 - y2; };
  rows.sort((a, b) => cmp(a, b) || a.slot - b.slot);
  for (const r of rows) r.rank = 1 + rows.filter(o => cmp(o, r) < 0).length;
  return rows;
}
/**
 * Whether the game is over: Team once the board is broken, out or open; Race and Versus once everyone who began has
 * finished, two at least, and nobody at the table (present: the seats here now) is still to begin.
 */
export function isOver(G, present = G.ring) {
  if (G.play === "team") return !!G.board.done;
  const begun = Object.keys(G.seats || {}).map(k => Number(k.slice(1)));
  if (begun.length < 2 || !begun.every(s => G.seats[sk(s)].done)) return false;
  return present.every(s => begun.includes(s) || (G.play === "versus" && !G.ring.includes(s)));
}
/** The game as one player saw it, once it's over, for the pair's record: { match, score, won, coop, lower }, else null. */
export function resultOf(g, slot, present) {
  const G = g?.game;
  if (!G || !isOver(G, present)) return null;
  const match = `${g.created}-${g.n}`;
  if (G.play === "team") return { match, score: null, won: G.board.done.how !== "out", coop: true };
  const rows = standings(G), mine = rows.find(r => r.slot === slot);
  if (!mine?.run.done) return null;
  return { match, score: mine.run.score, won: mine.rank === 1 && rows.filter(r => r.rank === 1).length === 1 && mine.run.done !== "out", lower: true };
}
/** A new game at the table, dealt by whoever asked (their kind, play, board or level), for the seats at it now. */
export function newGameAt(g, { n, deal, slots, now }) {
  if (g.n !== n) return false;
  g.n = n + 1;
  g.game = dealGame(deal, slots, now);
  return true;
}
