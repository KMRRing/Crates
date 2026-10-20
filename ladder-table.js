// Ladder's table (README, Ladder, Together): pure, so tests/ladder.mjs plays it through the database's round trip. One
// table in the room holds either game: a team's one ladder, or a race on the same ladders. It is duel-core.js's table
// (the lobby where each says Ready, the countdown to a start everyone shares, each player's run), with a team's ladder
// beside the runs: every change is made inside the room's transaction.
//
// Team: one ladder for the table, worked down from the first word. Each player holds some of the letters (dealt round
// the table, a step further each game) and only they may change them; each sees only their own letters of the last
// word. So nobody can finish alone: the others' letters must move too, and only they know where theirs must end. A
// player who is away (asleep, gone) lets go of their letters: anyone may change them until they're back.
// Race: the same ladders for everyone, each climbed on their own phone; the lowest score (time from the start, a minute
// a step over par, half a minute a hint) wins.
import { isStep, isRung, routeFrom, generate, LEVELS, RULES, OVER, HINT } from "./ladder-engine.js";
import { freshDuel, isDuel, seated, runOf, startAll } from "./duel-core.js";

export const MODES = { team: "Team", race: "Race" };
export const RACE_LADDERS = 3;

/**
 * A match from a seed: a team's one ladder (Classic, its letters keep their places, long enough for everyone to hold
 * one, and with a letter to change for each), or a race's three. Stored whole in the table, so every phone plays
 * exactly what was dealt.
 */
export function dealFor(seed, { n = 2, mode = defaultMode(n), level = "easy", rules = "classic", lengths = [4, 5] } = {}) {
  const team = mode === "team", lv = LEVELS[level] ? level : "easy";
  const slim = P => ({ start: P.start, end: P.end, par: P.par, routes: P.routes, common: P.common, detours: P.detours, needs: P.needs, route: P.route, rules: P.rules, level: P.level, seed: P.seed });
  if (team) {
    let P = null;
    for (let k = 0; k < 40 && !(P && splits(P, n)); k++) P = generate(seed + k * 104729, { level: lv, lengths: [teamLength(n)], rules: "classic" });
    return { seed, mode, level: lv, rules: "classic", ladders: [slim(P)] };
  }
  return { seed, mode, level: lv, rules: RULES[rules] ? rules : "classic", ladders: Array.from({ length: RACE_LADDERS }, (_, i) => slim(generate(seed + i * 7919, { level: lv, lengths, rules }))) };
}
/** A new table, its first match dealt. */
export const freshTable = (players, { app = 1, people = 2, match, now = Date.now() } = {}) => freshDuel(players, { app, people, match, now });
export const isTable = g => isDuel(g) && !!MODES[g.match?.mode] && Array.isArray(g.match.ladders) && g.match.ladders.length > 0 && !!g.match.ladders[0]?.start;
/** The mode a table plays by default: a team for a pair, a race for a party. */
export const defaultMode = people => (people > 2 ? "race" : "team");
/** How long a team's words should be: one letter at least for everyone, four at least. */
export const teamLength = people => Math.min(6, Math.max(4, people));

// ---------- the team's ladder ----------
/** The letters the first and last words differ in: every ladder between them changes each of these at least once. */
export const mustChange = P => [...P.start].map((c, p) => (c !== P.end[p] ? p : -1)).filter(p => p >= 0);
/**
 * Who holds each letter, [slot for each letter]: the letters that must change dealt first, round the seated players in
 * seat order, then the rest, starting a step further each game. So while there are as many letters to change as
 * players, everyone holds one that every ladder must change, and nobody can climb it alone.
 */
export const ownersFor = (g, P) => lettersFor(P, seated(g).map(([, p]) => p.slot), g.n || 1);
/** The same deal for any seats (`slots`, in order) in game n: a table's, or a solo player and the computer's. */
export function lettersFor(P, slots, n = 1) {
  const owners = Array(P.start.length).fill(slots[0] ?? 0);
  if (!slots.length) return owners;
  const must = mustChange(P), rest = [...P.start].map((_, p) => p).filter(p => !must.includes(p));
  [...must, ...rest].forEach((p, k) => { owners[p] = slots[(k + n - 1) % slots.length]; });
  return owners;
}
/** Whether a ladder splits for a team of n: as many letters to change as players. */
export const splits = (P, n) => mustChange(P).length >= n;
/** Sets the team's ladder going for this match, once (inside the transaction that starts it). */
export function startTeam(g) {
  if (g.match.mode !== "team" || g.team?.n === g.n) return false;
  const P = g.match.ladders[0];
  g.team = { n: g.n, rungs: [{ w: P.start, by: -1 }], hints: 0, owners: ownersFor(g, P) };
  return true;
}
/** Starts every ready run, and the team's ladder with them. */
export function startTable(g, now) {
  startAll(g, now);
  startTeam(g);
  return true;
}
export const teamOn = g => !!g?.team && g.team.n === g.n;
export const teamWord = g => g.team.rungs.at(-1).w;
/** The team's ladder as a run of the engine's: worked from the top only, the last word at the foot (once reached, its last rung). */
export const teamRun = g => {
  const ws = g.team.rungs.map(r => r.w), done = !!g.team.done;
  return { top: done ? ws.slice(0, -1) : ws, bottom: [g.match.ladders[0].end], order: [], hinted: g.team.rungs.filter(r => r.hint).map(r => r.w), hints: g.team.hints || 0, ms: 0, done };
};
/** The letter a step changes (-1 when it isn't a one-letter change). */
const changed = (a, b) => { if (a.length !== b.length) return -1; let at = -1; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (at >= 0) return -1; at = i; } return at; };
/**
 * A rung made by the player in `slot`, from the rung they saw as the last (`from`, its index): "placed", "done", or why
 * not: "moved" (someone made a rung first), "same", "step", "word", "used", "theirs" (another player's letter, and they're
 * here). `present`: the slots at the table now; `start`: the match's start, for the team's time.
 */
export function teamMove(g, { n, slot, from, word, present = [], now = Date.now() }) {
  if (g.n !== n || !teamOn(g)) return "moved";
  const T = g.team, P = g.match.ladders[0], w = String(word || "").toLowerCase();
  if (T.done) return "done";
  if (T.rungs.length - 1 !== from) return "moved";
  const cur = teamWord(g);
  if (w === cur) return "same";
  if (!isStep(cur, w, P.rules)) return "step";
  if (!isRung(P, w)) return "word";
  if (T.rungs.some(r => r.w === w)) return "used";
  const owner = T.owners[changed(cur, w)];
  if (owner !== slot && present.includes(owner)) return "theirs";
  T.rungs.push({ w, by: slot });
  if (w === P.end) finishTeam(g, now);
  return T.done ? "done" : "placed";
}
/** Takes the last rung off (anyone may), if the ladder is as the player saw it. */
export function teamUndo(g, { n, from }) {
  if (g.n !== n || !teamOn(g) || g.team.done || g.team.rungs.length - 1 !== from || g.team.rungs.length < 2) return false;
  g.team.rungs.pop();
  return true;
}
/** A hint for the team: the next rung on the commonest shortest route from its last rung, whoever's letter it is. */
export function teamHint(g, { n, from, now = Date.now() }) {
  if (g.n !== n || !teamOn(g) || g.team.done || g.team.rungs.length - 1 !== from) return null;
  const P = g.match.ladders[0], route = routeFrom(P, teamWord(g), P.end, g.team.rungs.map(r => r.w));
  if (!route || route.length < 2) return null;
  g.team.rungs.push({ w: route[1], by: -1, hint: true });
  g.team.hints = (g.team.hints || 0) + 1;
  if (route[1] === P.end) finishTeam(g, now);
  return route[1];
}
function finishTeam(g, now) {
  const T = g.team, P = g.match.ladders[0], steps = T.rungs.length - 1, ms = Math.max(0, now - (g.start || now));
  T.done = true;
  T.at = now;
  T.steps = steps;
  T.score = Math.round(ms / 1000) + OVER * Math.max(0, steps - P.par) + HINT * (T.hints || 0);
}

// ---------- the race ----------
/**
 * A race run, as the table keeps it: { score, text, done, at (ladders done), over (steps over par in all), hints }.
 * The score, once done, is the seconds from the start, a minute for every step over par and half a minute a hint.
 */
export function raceReport({ at, over, hints, ms, count, done }) {
  const score = Math.round(ms / 1000) + OVER * over + HINT * hints;
  return { score: done ? score : 0, at, over, hints, done: !!done, text: done ? `${fmtTime(score)}${over ? `, +${over}` : ", par"}` : `${at} of ${count}` };
}
const fmtTime = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
/** The race's order: a finished run before one still going, the lower score first; one still going by ladders climbed. */
export const raceOrder = (a, b) => (b.done ? 1 : 0) - (a.done ? 1 : 0) || (a.done ? a.score - b.score : (b.at || 0) - (a.at || 0)) || (a.ms ?? Infinity) - (b.ms ?? Infinity) || 0;

// ---------- the pair's record ----------
/**
 * The match as this player saw it, for the pair's duo record once it's over: a team's score (won: it was climbed), or
 * a race's place (won: first alone). null while it's on.
 */
export function teamResult(g) {
  if (!teamOn(g) || !g.team.done) return null;
  return { match: `${g.created}-${g.n}`, score: g.team.score, won: true, coop: true, lower: true };
}
/** Whether every player at the table has finished the race (two at least began it). */
export function raceOver(g, present) {
  const begun = seated(g).filter(([, p]) => runOf(g, p.slot)?.begun);
  if (begun.length < 2 || !begun.every(([, p]) => runOf(g, p.slot).done)) return false;
  return seated(g).every(([, p]) => runOf(g, p.slot)?.begun || !present.includes(p.slot));
}
