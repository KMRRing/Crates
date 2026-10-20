// Crossword at a table (README, Crossword: together), pure: the room's crossword branch as the players share it, each
// change made inside a transaction (together.js) on the state as the database gives it back (tidy). Two ways to play:
//  - split, one grid for the table and its clues dealt among the seats: Across to one and Down to the other for a
//    pair (every across answer's crossings are the other's), round the table by clue number for three to six. Each
//    sees only their own clues; anyone writes anywhere, each letter in the colour of whoever wrote it. Nobody can
//    finish alone: the crossings are how the clues you can't see get solved. A seat nobody is in has its clues shown
//    to everyone, so the table can go on without them.
//  - race, the same grid for everyone, each solving their own on their own phone, the others' progress showing; the
//    lowest time wins (the clock, and the penalties for help). A computer player may race too (crossword-solve.js).
//
//   { v: 1, app, created, people, players: { uid: { name, pid, slot, online, at? } }, asked?, n (the game's number),
//     mode, puzzle, begun (the database's time the game began), cells: { c<k>: { ch, by } }, revealed: { c<k>: 1 },
//     wrong: { c<k>: 1 }, checks, reveals, done: { at, secs } (split), runs: { s<slot>: { begun, solved, filled,
//     checks, reveals, secs, done } } (race), rival: { level, seed } | absent }
// Cells and runs are keyed c<k> and s<slot>, never by number, which the database would read back as a list with holes.
import { REVEAL_COST, CHECK_COST, solutionAt, isBlack } from "./crossword-engine.js";

export const MOST = 6;                       // the most at one table (a party's)
export const TABLE_MODES = { split: "Split the clues", race: "Race" };
const values = x => Object.values(x || {}).filter(v => v != null);
/** The seats a table keeps for people: a party's request says how many (two to six), a pair's is two. */
export const peopleOf = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
export const isTable = g => g?.v === 1 && !!g.puzzle?.rows && !!g.mode;

/** A new table with its first game. */
export function freshTable(players, { app = 1, puzzle, mode = "split", people = 2, now = Date.now(), rival = null }) {
  return tidy({ v: 1, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, n: 1, ...game(puzzle, mode, now, rival) });
}
const game = (puzzle, mode, now, rival) => ({ mode, puzzle, begun: now, cells: {}, revealed: {}, wrong: {}, checks: 0, reveals: 0, done: null, runs: {}, ...(rival ? { rival } : {}) });
/** The table as the database gives it back, made whole (it keeps no nulls, empty lists or empty objects). */
export function tidy(g) {
  g.cells ||= {}; g.revealed ||= {}; g.wrong ||= {}; g.runs ||= {};
  g.checks ||= 0; g.reveals ||= 0; g.done ||= null;
  if (!g.rival) delete g.rival;
  const p = g.puzzle;
  if (p) {
    p.rows = values(p.rows);
    p.entries = values(p.entries).map(e => ({ ...e, cells: values(e.cells), alts: values(e.alts), about: values(e.about), lead: e.lead ?? null }));
    p.theme ||= null;
  }
  return g;
}
/** A new game at the table, unless one was dealt since game n. */
export function newGameAt(g, { n, puzzle, mode, now, rival = null }) {
  if (g.n !== n) return false;
  Object.assign(g, { n: n + 1, ...game(puzzle, mode, now, rival) });
  if (!rival) delete g.rival;
  return true;
}

// ---------- split: who holds which clue ----------
/** The order clues are dealt round a table of three or more: by number, across before down at the same number. */
const dealOrder = puzzle => [...puzzle.entries].sort((a, b) => a.num - b.num || (a.dir === "across" ? -1 : 1));
/**
 * The seat holding each entry's clue, by entry index: a pair splits Across and Down; three to six take them round the
 * table in clue order, so everyone has some of each.
 */
export function holders(puzzle, people) {
  const out = new Array(puzzle.entries.length).fill(0);
  if (people <= 2) { puzzle.entries.forEach((e, i) => { out[i] = e.dir === "across" ? 0 : 1; }); return out; }
  const index = new Map(puzzle.entries.map((e, i) => [e, i]));
  dealOrder(puzzle).forEach((e, j) => { out[index.get(e)] = j % people; });
  return out;
}
/** The clues a seat can read: its own, and those of seats nobody at the table holds (`present`: the seats here). */
export function readable(g, slot, present) {
  const hold = holders(g.puzzle, g.people || 2), here = new Set(present);
  return hold.map(s => s === slot || !here.has(s));
}

// ---------- split: the shared grid ----------
const cellKey = k => `c${k}`;
/** The table's letters as one string, "#" black and "." empty, as a play's (crossword-engine.js). */
export function lettersOf(g) {
  const p = g.puzzle;
  return p.rows.join("").split("").map((ch, k) => (ch === "#" ? "#" : g.cells[cellKey(k)]?.ch || ".")).join("");
}
/** Who wrote each letter: { cell: slot }. */
export const writers = g => Object.fromEntries(Object.entries(g.cells).map(([k, c]) => [Number(k.slice(1)), c.by]));
/** Whether the grid is filled in right: the game is over, at the database's `now`. */
function settle(g, now) {
  if (g.done || lettersOf(g) !== g.puzzle.rows.join("")) return;
  const secs = Math.round((now - g.begun) / 1000);
  g.done = { at: now, secs, total: secs + g.reveals * REVEAL_COST + g.checks * CHECK_COST };
}
/**
 * Letters written by the player in seat `slot`: { cell: "A" … or "." to empty it }. A revealed cell keeps its letter;
 * a letter that changes loses its wrong mark. Whether anything changed (nothing does once the grid is done).
 */
export function writeAt(g, { n, slot, letters, now }) {
  if (g.n !== n || g.mode !== "split" || g.done) return false;
  let changed = false;
  for (const [k, ch] of Object.entries(letters)) {
    const cell = Number(k), key = cellKey(cell);
    if (isBlack(g.puzzle, cell) || g.revealed[key]) continue;
    const was = g.cells[key]?.ch || ".";
    if (was === ch) continue;
    if (ch === ".") delete g.cells[key]; else g.cells[key] = { ch, by: slot };
    delete g.wrong[key];
    changed = true;
  }
  if (changed) settle(g, now);
  return changed;
}
/** A check of cells, for the table: wrong letters marked, each counted against the team's time. How many. */
export function checkAt(g, { n, cells }) {
  if (g.n !== n || g.mode !== "split" || g.done) return -1;
  let wrong = 0;
  for (const k of cells) {
    const c = g.cells[cellKey(k)];
    if (!c || c.ch === solutionAt(g.puzzle, k) || g.wrong[cellKey(k)]) continue;
    g.wrong[cellKey(k)] = 1; wrong++;
  }
  g.checks += wrong;
  return wrong;
}
/** Reveals cells for the table, each counted against the team's time. How many. */
export function revealAt(g, { n, slot, cells, now }) {
  if (g.n !== n || g.mode !== "split" || g.done) return -1;
  let shown = 0;
  for (const k of cells) {
    const key = cellKey(k), right = solutionAt(g.puzzle, k);
    if (isBlack(g.puzzle, k) || g.revealed[key] || g.cells[key]?.ch === right) continue;
    g.cells[key] = { ch: right, by: slot };
    g.revealed[key] = 1;
    delete g.wrong[key];
    shown++;
  }
  g.reveals += shown;
  if (shown) settle(g, now);
  return shown;
}

// ---------- race: a grid each ----------
/** A seat's run, as its phone reports it: { begun, solved, filled, checks, reveals, secs, done }. */
export const runOf = (g, slot) => g.runs[`s${slot}`] || null;
/** What a racer's phone tells the table; a run that's done stands (a reload can't change it). */
export function reportAt(g, { n, slot, run }) {
  if (g.n !== n || g.mode !== "race") return false;
  const was = runOf(g, slot);
  if (was?.done) return false;
  const next = { ...was, ...run };
  if (JSON.stringify(next) === JSON.stringify(was)) return false;
  g.runs[`s${slot}`] = next;
  return true;
}
/** A race run's time: its clock and its penalties. */
export const runTotal = r => (r?.secs ?? 0) + (r?.reveals || 0) * REVEAL_COST + (r?.checks || 0) * CHECK_COST;
/**
 * The race's standings: [{ slot, name, run, total, rank, rival }], the finished by their totals (equal totals share a
 * rank), then those still going by how much they've solved. `rival`, the computer player's run so far ({ solved,
 * done, total }) if it races.
 */
export function standings(g, rival = null) {
  const rows = Object.values(g.players || {}).filter(p => p?.slot != null).map(p => ({ slot: p.slot, name: p.name, run: runOf(g, p.slot) }))
    .map(x => ({ ...x, total: x.run?.done ? runTotal(x.run) : null }));
  if (rival) rows.push({ slot: null, name: rival.name, rival: true, run: { solved: rival.solved, done: rival.done }, total: rival.done ? rival.total : null });
  rows.sort((a, b) => {
    if ((a.total != null) !== (b.total != null)) return a.total != null ? -1 : 1;
    return a.total != null ? a.total - b.total : (b.run?.solved || 0) - (a.run?.solved || 0);
  });
  let rank = 0, last = null;
  rows.forEach((x, i) => { if (x.total == null) { x.rank = null; return; } if (x.total !== last) { rank = i + 1; last = x.total; } x.rank = rank; });
  return rows;
}
/** Whether the race is over: every seat that began has finished, and nobody here is still to begin. */
export function raceOver(g, present) {
  const here = new Set(present);
  const seats = Object.values(g.players || {}).filter(p => p?.slot != null).map(p => p.slot);
  return seats.length > 0 && seats.every(s => runOf(g, s)?.done || (!here.has(s) && !runOf(g, s)?.begun));
}

// ---------- the pair's record ----------
/**
 * A finished game as the pair's record keeps it (together.js's result): split, a team result, the team's time with
 * its penalties (lower is better); race, head to head, won by the sole fastest of the people at the table.
 */
export function resultOf(g, slot, present) {
  if (!isTable(g)) return null;
  const match = `${g.created}-${g.n}`;
  if (g.mode === "split") return g.done ? { match, score: g.done.total ?? g.done.secs, won: true, coop: true, lower: true } : null;
  if (!raceOver(g, present)) return null;
  const mine = runOf(g, slot);
  if (!mine?.done) return null;
  const totals = Object.values(g.players || {}).filter(p => p?.slot != null).map(p => runOf(g, p.slot)).filter(r => r?.done).map(runTotal);
  const best = Math.min(...totals), me = runTotal(mine);
  return { match, score: me, won: me === best && totals.filter(t => t === best).length === 1, coop: false, lower: true };
}
