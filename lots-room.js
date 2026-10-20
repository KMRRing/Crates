// Lots for two at one board (README, Lots: together), on together.js: the pair's table, every change to it pure (it
// runs inside the database's transaction) and tested by tests/lots.mjs through the database's round trip. Three
// ways to share a board, each making both players needed:
//  - open: both see all sixteen and each other's picks, four mistakes between them;
//  - crossed: both see all sixteen, but what a guess came to (one away, or not) shows only on the other's phone, and
//    a lot one of you finds is the other's to name, from four links;
//  - hidden: each sees eight of the sixteen, every lot holding words from both, so neither can make one alone.
import { SIZE, MISTAKES, LEVELS, BY_ID, deal, classify, comboKey, points, namingOptions, split, shuffle, seeded } from "./lots-engine.js";

export const ROOM_V = 1;
export const MODES = {
  open: { label: "Open", blurb: "Both of you see all sixteen and each other's picks." },
  crossed: { label: "Crossed", blurb: "You see what your partner's guesses came to, not your own, and name the lots they find." },
  hidden: { label: "Hidden", blurb: "You each see eight; every lot needs words from both of you." },
};

const list = x => (Array.isArray(x) ? x.filter(v => v != null) : x && typeof x === "object" ? Object.keys(x).sort((a, b) => a - b).map(k => x[k]).filter(v => v != null) : []);
export const isRoom = g => g?.v === ROOM_V && g.kind === "lots" && !!g.board?.g && Number.isInteger(g.n);

/** A board for the table: dealt, its sixteen in an order everyone shares, and in hidden play who holds what. */
function boardFor({ seed, level, mode }) {
  const board = deal({ seed, level: LEVELS.includes(level) ? level : "medium" }) || deal({ seed, level: "medium" });
  return {
    board, order: shuffle(board.g.flatMap(g => g.w), seeded(seed ^ 0x2545f491)),
    ...(mode === "hidden" ? { sides: split(board, seed) } : {}),
  };
}
/** A new table with its first board. */
export function freshRoom(players, { seed, level = "medium", mode = "open", people = 2, app = 1, now = Date.now() } = {}) {
  const g = { v: ROOM_V, kind: "lots", app, created: now, people: Math.max(2, Math.min(2, Number(people) || 2)), players, n: 0, tally: { boards: 0, solved: 0, points: 0 } };
  newBoard(g, { seed, level, mode });
  return g;
}
function newBoard(g, { seed, level, mode }) {
  g.n = (g.n || 0) + 1;
  g.mode = MODES[mode] ? mode : "open";
  g.level = LEVELS.includes(level) ? level : "medium";
  g.seed = seed;
  Object.assign(g, boardFor({ seed, level: g.level, mode: g.mode }));
  if (g.mode !== "hidden") delete g.sides;
  g.sel = {};
  g.guesses = [];
  g.found = [];
  g.pending = null;
  g.mistakes = 0;
  g.done = false;
  g.won = false;
  delete g.race;                    // a race the pair went to belongs to the board before
}
/** A table as the database gives it back (no empty lists, lists as objects with holes), made whole again. */
export function tidy(g) {
  if (!g) return g;
  g.order = list(g.order);
  g.board.g = list(g.board.g).map(lot => ({ ...lot, w: list(lot.w) }));
  g.sel = Object.fromEntries(Object.entries(g.sel || {}).map(([k, v]) => [k, list(v)]));
  g.guesses = list(g.guesses).map(x => ({ ...x, w: list(x.w) }));
  g.found = list(g.found);
  g.pending = g.pending ? { ...g.pending, options: list(g.pending.options) } : null;
  g.mistakes = g.mistakes || 0;
  g.done = !!g.done;
  g.won = !!g.won;
  g.tally ||= { boards: 0, solved: 0, points: 0 };
  return g;
}

// ---------- what's where ----------
const lotOf = (g, w) => g.board.g.findIndex(lot => lot.w.includes(w));
const placed = g => new Set(g.found.flatMap(f => g.board.g[f.g].w).concat(g.pending ? g.board.g[g.pending.g].w : []));
/** Whose word it is in hidden play (0 or 1), or null when both see it. */
export const holder = (g, w) => (g.mode === "hidden" ? g.sides?.[w] ?? null : null);
const mine = (g, slot, w) => holder(g, w) == null || holder(g, w) === slot;
const selOf = (g, slot) => list(g.sel?.[`s${slot}`]);
/** The picks a guess is made of: your own; in hidden play both players' together. */
export const picksFor = (g, slot) => (g.mode === "hidden" ? [...selOf(g, 0), ...selOf(g, 1)] : selOf(g, slot));
export const pointsOf = g => points(g.found.length, g.mistakes, g.won) + g.found.filter(f => f.named).length;
export const maxPoints = g => 2 * SIZE + (g.mode === "crossed" ? SIZE : 0);

// ---------- the changes, each inside a transaction: false leaves the table as it was ----------
/** A tap on a word: it joins this player's picks, or leaves them. */
export function pickAt(g, { n, slot, word }) {
  if (g.n !== n || g.done || g.pending || !g.order.includes(word) || placed(g).has(word) || !mine(g, slot, word)) return false;
  const key = `s${slot}`, sel = selOf(g, slot);
  if (sel.includes(word)) { g.sel[key] = sel.filter(w => w !== word); return true; }
  if (picksFor(g, slot).length >= SIZE || sel.length >= SIZE) return false;
  g.sel[key] = [...sel, word];
  return true;
}
export function clearAt(g, { n, slot }) {
  if (g.n !== n || !selOf(g, slot).length) return false;
  g.sel[`s${slot}`] = [];
  return true;
}
/**
 * A guess, of the picks this player sees (both players' in hidden play, which must be the ones they saw): "right",
 * "one", "miss", or why not ("tried", "moved"). A lot found in crossed play waits for the other to name it.
 */
export function submitAt(g, { n, slot, words, partnerHere = true }) {
  if (g.n !== n || g.done) return "moved";
  if (g.pending) return "naming";
  const picks = picksFor(g, slot);
  if (picks.length !== SIZE || comboKey(picks) !== comboKey(words)) return "moved";
  if (g.guesses.some(x => comboKey(x.w) === comboKey(picks))) return "tried";
  const c = classify(g.board, picks);
  const guess = { by: slot, w: picks, r: c.res };
  if (c.res === "one" && g.mode === "hidden") {
    // whose pick is the odd one out: shown to the one who didn't make the guess
    const odd = picks.find(w => c.lv.filter(k => k === lotOf(g, w)).length === 1);
    guess.odd = holder(g, odd);
  }
  g.guesses.push(guess);
  // a lot found leaves everyone's picks; after a wrong guess they stay, to change one
  if (c.res === "right") for (const k of Object.keys(g.sel)) g.sel[k] = list(g.sel[k]).filter(w => !picks.includes(w));
  if (c.res === "right") {
    if (g.mode === "crossed" && partnerHere) g.pending = { g: c.g, by: slot, namer: 1 - slot, options: namingOptions(g.board, c.g, g.seed) };
    else found(g, c.g, slot, null);
  } else if (++g.mistakes >= MISTAKES) finish(g, false);
  return c.res;
}
/** Crossed play: the other names the lot just found, from its four links. */
export function nameAt(g, { n, slot, pick }) {
  if (g.n !== n || !g.pending || g.pending.namer !== slot || !g.pending.options.includes(pick)) return false;
  const { g: k, by } = g.pending;
  g.pending = null;
  found(g, k, by, pick === g.board.g[k].c);
  return true;
}
function found(g, k, by, named) {
  g.found.push({ g: k, by, ...(named == null ? {} : { named }) });
  // three found: the last four can only be the fourth lot
  if (g.found.length === SIZE - 1 && !g.pending) {
    const last = g.board.g.findIndex((_, j) => !g.found.some(f => f.g === j));
    g.found.push({ g: last, by: null });
  }
  if (g.found.length === SIZE) finish(g, true);
}
function finish(g, won) {
  g.done = true;
  g.won = won;
  g.pending = null;
  g.tally.boards += 1;
  g.tally.solved += won ? 1 : 0;
  g.tally.points += pointsOf(g);
}
/** The table's next board: once, whoever asks first (n is the board they saw). */
export function nextAt(g, { n, seed, level, mode }) {
  if (g.n !== n) return false;
  newBoard(g, { seed, level: level || g.level, mode: mode || g.mode });
  return true;
}
/** The board as one player saw it once it's over, for the pair's record: a team result. */
export function resultOf(g) {
  return g?.done ? { match: `${g.created}-${g.n}`, score: pointsOf(g), won: g.won, coop: true } : null;
}

// ---------- what each player sees ----------
/**
 * The table as player `slot` sees it: each word (its text, or sealed in hidden play when the other holds it), and
 * each guess with what it came to as this player may know it: the guesser's own wrong guess in crossed play is only
 * "wrong", the other sees one away or not; in hidden play the one who didn't guess also sees whose pick was the odd one.
 */
export function viewFor(g, slot) {
  const words = g.order.map(w => ({ w, sealed: !mine(g, slot, w) }));
  const guesses = g.guesses.map(x => {
    const own = x.by === slot;
    const r = x.r === "right" ? "right" : g.mode === "crossed" && own ? "wrong" : x.r;
    return { by: x.by, w: x.w.map(w => (mine(g, slot, w) || placed(g).has(w) ? w : null)), r, ...(x.odd != null && !own ? { odd: x.odd } : {}) };
  });
  return { words, guesses, mine: selOf(g, slot), theirs: selOf(g, 1 - slot), name: g.pending?.namer === slot ? g.pending : null };
}
/** The category name of a lot, for the page. */
export const nameOf = (g, k) => BY_ID.get(g.board.g[k].c)?.name || "";
