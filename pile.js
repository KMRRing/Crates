// The pile: what you didn't know, brought back until you do. Every knowledge game records an item when you miss
// it, pass on it, or barely stake on it, and when it comes back and you get it right it moves up a pile; wrong,
// and it drops to the first. Six piles with growing gaps, Leitner's boxes on Pimsleur's clock: ultra-short
// (due at once, for the next block), short (ten minutes), medium (twelve hours), long (a week), longer (a month),
// longest (three months); right in the longest pile and it's learned. Chess puzzles skip the short-term piles: ultra-short,
// a week, three months. (Until October 2026 the week was the last;
// items learned then come back once, a month after they were learned.) Every item that comes back, right or wrong,
// goes to the Ledger's record with how long it was away (ledger-log.js). Learning mode lets each game's dealer draw what's due into its next block, alongside
// new content. Deck is the tile that reviews everything due, across the games.
//
// What you learn is a fact, whichever game asks it (Korbi, 10 Nov 2026: "the user should revise the same items regardless of
// which game they play"). An item is one game's question, as it was asked, so Deck can ask it again; it also names the facts
// it tests (`facts`, kb/graph.js ids: krone>clue>norway, norway.area). Items that test the same fact share one state: missed in
// any game, every one of them drops to the first pile; right in any game, even a question that game has no item for, every one
// moves up. A game in learning mode deals its own questions on any fact that's due, whoever missed it; Deck asks a fact once.

import { noteRecall } from "./ledger-log.js";
import { today } from "./days.js";

const STORE = "pile:items", SETTINGS = "pile:settings", DAY = 24 * 60 * 60 * 1000;
export const PILES = [
  { id: 0, name: "Ultra-short", gap: 0 },
  { id: 1, name: "Short", gap: 10 * 60 * 1000 },
  { id: 2, name: "Medium", gap: 12 * 60 * 60 * 1000 },
  { id: 3, name: "Long", gap: 7 * DAY },
  { id: 4, name: "Longer", gap: 30 * DAY },
  { id: 5, name: "Longest", gap: 91 * DAY },
];
// the piles a game's items climb through. Most use every pile; a chess puzzle skips the short-term ones (a tactic seen
// ten minutes or twelve hours ago is still in mind, so passing it then proves little): ultra-short, then a week, then
// three months, then learned
const LADDER = { rush: [0, 3, 5] };
/** The pile an item moves to when it's right, or null if that makes it learned. */
export function nextPile(game, pile) {
  const steps = LADDER[game] || PILES.map(p => p.id);
  const next = steps.find(s => s > pile);
  return next === undefined ? null : next;
}
// brut: what Brut (retired, November 2026) put on the pile; its wine cards are Punt's Wine level now, and the key stays so those are still asked
export const GAMES = { punt: "Punt", quote: "Quote", chart: "Chart", crates: "Crates", rush: "Chess", slate: "Slate", brut: "Wine",
  nonogram: "Nonogram", lode: "Lode", crossword: "Crossword" };

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
let items = null;
function load() {
  if (items) return items;
  items = read(STORE, {});
  // once: what was learned when the week was the last pile comes back for its month, a month after it was learned
  const settings = read(SETTINGS, {});
  if (!settings.months) {
    for (const it of Object.values(items)) if (it.learned) { it.pile = 4; it.due = it.learned + PILES[4].gap; delete it.learned; }
    save();
    write(SETTINGS, { ...settings, months: true });
  }
  return items;
}
function save() { write(STORE, items); }

// ---------- facts ----------
/** The items that test any of these facts (kb/graph.js ids), learned or not. */
function carrying(facts) {
  if (!facts?.length) return [];
  const want = new Set(facts);
  return Object.values(load()).filter(it => it.facts?.some(f => want.has(f)));
}
/** One item's new state on every other item that tests one of its facts: a fact is in one pile, whichever game asked it. */
function share(it) {
  for (const o of carrying(it.facts)) {
    if (o === it) continue;
    o.pile = it.pile; o.due = it.due; o.last = { ...it.last, via: it.game };
    if (it.learned) o.learned = it.learned; else delete o.learned;
  }
}
/** The facts due now (or by `at`), in the learning mode's order: what any game's items say is due. */
export function dueFacts(at = Date.now()) {
  const out = new Set();
  for (const it of picks(null, at)) for (const f of it.facts || []) out.add(f);
  return out;
}
/**
 * Gives the items a game recorded before items named their facts the facts its questions test: the game hands over its pool
 * ([{ key, facts }]) as it deals. Nothing else of an item changes.
 */
export function adopt(game, pool) {
  const all = load(), at = new Map(pool.filter(q => q.facts?.length).map(q => [q.key, q.facts]));
  let changed = false;
  for (const it of Object.values(all)) if (it.game === game && !it.facts && at.has(it.key)) { it.facts = at.get(it.key); changed = true; }
  if (changed) save();
}

/** An item's last answers, oldest first: [[YYYYMMDD, 1 right | 0 wrong when it came back | 2 the miss that put it in the pile]…],
 *  at most HISTORY. Items stored before it existed have none (`it.h` absent): the Ledger then falls back on their latest answer. */
export const HISTORY = 8;
export const historyOf = it => (Array.isArray(it?.h) ? it.h : []);
function remember(it, code, now) {
  it.h = [...historyOf(it).slice(1 - HISTORY), [today(new Date(now)), code]];
}

/**
 * The learning mode, one for every game (shown in each game's menu, Settings; the games screen's Choose sheet has it too):
 *   norepeat  deals nothing from the piles, and keeps what it deals fresh: nothing again until the rest has had its turn
 *   revision  Revise: what's due, the longest-term pile first (what a lapse would cost most); how the games always dealt
 *   learn     Learn: what's newest, the ultra-short and the short pile mixed one for one, due or not, so a new miss is
 *             drilled before it can fade; nothing from the longer piles
 * Korbi, 9 Nov 2026: three modes, "no repeats, revise, learn". The fourth, Mixed, is gone; a mode saved as it reads as Revise.
 * The old on/off switch is read as revise/no repeats.
 */
export const MODES = [["norepeat", "No repeats"], ["revision", "Revise"], ["learn", "Learn"]];
export function mode() {
  const s = read(SETTINGS, {});
  return MODES.some(([m]) => m === s.mode) ? s.mode : s.learning === false ? "norepeat" : "revision";     // "mixed" (gone) and anything unknown: revise
}
export function setMode(m) { if (MODES.some(([k]) => k === m)) write(SETTINGS, { ...read(SETTINGS, {}), mode: m }); }
/** Whether the piles deal anything (every mode but No repeats). */
export const learning = () => mode() !== "norepeat";

// what each game has dealt lately, oldest first, for No repeats: a game's `fresh` weighs these down
const DEALT = "pile:dealt", DEALT_CAP = 1500;
/** Notes keys a game has just dealt (keeps the latest `cap`, so a pool smaller than that comes round again in turn). */
export function dealt(game, keys, cap = DEALT_CAP) {
  const all = read(DEALT, {}), had = (all[game] || []).filter(k => !keys.includes(k));
  all[game] = [...had, ...keys].slice(-cap);
  write(DEALT, all);
}
/**
 * No repeats for a dealer: `need` picks (`pick(pool, n)` is the game's own draw) from what hasn't been dealt lately,
 * the rest from what has if that falls short. `key` names a pool item as `dealt` was told it.
 */
export function freshPicks(game, pool, key, need, pick) {
  if (need <= 0) return [];
  const lately = recent(game), got = pick(pool.filter(x => !lately.has(key(x))), need);
  return got.length >= need ? got : [...got, ...pick(pool.filter(x => lately.has(key(x))), need - got.length)];
}
/** The keys a game has dealt lately: a Set, for a dealer to put last. */
export const recent = game => new Set(read(DEALT, {})[game] || []);

/**
 * Records an item. game: which game; key: its id in that game; payload: enough to ask it again anywhere
 * (see Deck); why: "wrong" | "pass" | "lowStake" | "miss" | "clue" | "lookup". A new item starts in the
 * ultra-short pile; a known one drops back to it.
 */
export function record(game, key, payload, why) {
  const all = load(), id = `${game}:${key}`, now = Date.now();
  if (all[id]) noteRecall(now - (all[id].last?.at ?? all[id].added), false);   // it came back, and you didn't have it
  const it = all[id] || { id, game, key, added: now, seen: 0, fails: 0, passes: 0 };
  it.payload = payload;
  if (payload?.about?.length) it.about = payload.about;     // the entities it's about (kb/), so other games can ask about them too
  if (payload?.facts?.length) it.facts = payload.facts;     // the facts it tests: its state is theirs, in every game
  it.pile = 0;
  it.due = now;
  delete it.learned;                                   // a learned item that's missed again is back in the piles
  it.fails++;
  it.last = { at: now, why };
  remember(it, all[id] ? 0 : 2, now);
  all[id] = it;
  share(it);
  save();
  return it;
}
/** Adds an item to learn (a new word): it starts in the ultra-short pile, due now, without counting as a miss. */
export function add(game, key, payload) {
  const all = load(), id = `${game}:${key}`;
  if (all[id]) return all[id];
  const now = Date.now();
  all[id] = { id, game, key, added: now, seen: 0, fails: 0, passes: 0, payload, pile: 0, due: now, last: { at: now, why: "new" } };
  save();
  return all[id];
}
/** Notes an item was shown (for the cap on how much of a block is old). */
export function seen(game, key) {
  const all = load(), id = `${game}:${key}`;
  if (all[id]) { all[id].seen++; all[id].shown = Date.now(); save(); }
}
/**
 * The item got answered when it came back: right moves it up a pile (and out, past the long one); wrong drops it to the first.
 * `facts`: what the question tests. A game with no item for it moves another game's item on the same fact instead (its
 * learning mode dealt the question because that fact was due), so a fact learned in one game is learned in all.
 */
export function answer(game, key, right, facts = null) {
  const all = load(), id = `${game}:${key}`;
  let it = all[id];
  if (it && !it.facts && facts?.length) it.facts = facts;
  if (!it) {
    const due = Date.now();
    it = carrying(facts).filter(o => !o.learned).sort((a, b) => (b.due <= due) - (a.due <= due) || b.pile - a.pile)[0];
    if (!it) return null;
    // right in another game before the fact is due: it was in mind anyway, so the gap it was waiting out still stands
    if (right && it.due > due) return it;
  }
  const now = Date.now();
  noteRecall(now - (it.last?.at ?? it.added), right);
  if (right) {
    it.passes++;
    const next = nextPile(it.game, it.pile);
    if (next === null) { it.learned = now; it.due = Infinity; }
    else { it.pile = next; it.due = now + PILES[next].gap; }
  } else {
    it.fails++;
    it.pile = 0;
    it.due = now;
  }
  it.last = { at: now, why: right ? "right" : "wrong", ...(it.game !== game ? { via: game } : {}) };
  remember(it, right ? 1 : 0, now);
  share(it);
  save();
  return it;
}
/** Every item, or a game's; learned ones last. */
export function all(game = null) {
  return Object.values(load()).filter(it => !game || it.game === game).sort((a, b) => (a.learned ? 1 : 0) - (b.learned ? 1 : 0) || a.pile - b.pile || a.due - b.due);
}
/**
 * What's due now (or by `at`), the most revised first: the highest pile first, and within a pile the longest overdue.
 * What has lasted longest is what a lapse would cost most, so it's checked first; moving a new miss from the ultra-short
 * pile up is for when every longer check is done. Deck's review and every game's learning mode take this order.
 */
export function due(game = null, at = Date.now()) {
  return all(game).filter(it => !it.learned && it.due <= at).sort((a, b) => b.pile - a.pile || a.due - b.due);
}
/** Items, one for each fact: of the items that test the same fact, the one asked last (the form you last met it in). Deck asks a fact once. */
export function oncePerFact(list) {
  const seen = new Set(), out = [];
  const latest = [...list].sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));
  const keep = new Set();
  for (const it of latest) { if (it.facts?.some(f => seen.has(f))) continue; for (const f of it.facts || []) seen.add(f); keep.add(it); }
  for (const it of list) if (keep.has(it)) out.push(it);
  return out;
}
/**
 * What the learning mode deals now, from a game's items (or every game's), in the order to deal it: revise is due(); learn
 * the ultra-short and short piles mixed one for one (the shorter first), due or not yet; No repeats nothing.
 */
export function picks(game = null, at = Date.now()) {
  const m = mode();
  if (m === "norepeat") return [];
  if (m === "revision") return due(game, at);
  const young = pile => all(game).filter(it => !it.learned && it.pile === pile).sort((a, b) => a.due - b.due), a = young(0), b = young(1), out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) for (const it of [a[i], b[i]]) if (it) out.push(it);
  return out;
}
/** Counts per pile for a game or all, plus learned and due. */
export function counts(game = null) {
  const list = all(game), out = { piles: PILES.map(() => 0), learned: 0, due: 0, total: list.length };
  for (const it of list) { if (it.learned) out.learned++; else { out.piles[it.pile]++; if (it.due <= Date.now()) out.due++; } }
  return out;
}
/**
 * The knowledge base's entities that other games have found you weak on: what's due there now, by entity, with how
 * many due items name it. A game's learning mode deals its own questions about them, in its own format: miss who
 * painted the Mona Lisa in Punt and Quote asks the year it was painted; miss Geneva in Crates and Chart asks you to
 * pin it.
 */
export function weakElsewhere(game, at = Date.now()) {
  const weak = new Map();
  for (const it of picks(null, at)) if (it.game !== game) for (const id of it.about || []) weak.set(id, (weak.get(id) || 0) + 1);
  return weak;
}
/**
 * A learning mode's picks from a game's pool: its own due keys first, then (up to `cap`) its questions on facts that are due
 * (whichever game missed them), then questions about what other games found you weak on, most-missed first, never one
 * already dealt. pool: [{ key, about, facts }].
 */
export function dealDue(game, pool, ownDue, cap) {
  adopt(game, pool);
  const weak = weakElsewhere(game), facts = dueFacts(), taken = new Set(ownDue);
  const onFact = pool.filter(q => !taken.has(q.key) && q.facts?.some(f => facts.has(f)));
  for (const q of onFact) taken.add(q.key);
  const cross = pool.filter(q => !taken.has(q.key) && q.about?.some(id => weak.has(id)))
    .sort((a, b) => Math.max(...b.about.map(id => weak.get(id) || 0)) - Math.max(...a.about.map(id => weak.get(id) || 0)));
  return [...ownDue, ...[...onFact, ...cross].slice(0, Math.max(0, cap - ownDue.length)).map(q => q.key)];
}
/** Has this item been recorded (and not yet learned)? */
/** Replaces what an item shows (its question has been rewritten since it went in) and nothing else: not its pile, its
 *  streak or when it's due. */
export function refresh(game, key, payload) { const all = load(), it = all[`${game}:${key}`]; if (!it) return; it.payload = payload; save(); }
export function has(game, key) { const it = load()[`${game}:${key}`]; return !!it && !it.learned; }
export function forget(game, key) { const all = load(); delete all[`${game}:${key}`]; save(); }
export function clear() { items = {}; save(); }

/**
 * A dealer's helper: given the game, the pool it would deal from (items with a `key`) and the block size, returns
 * the keys to put in the block: all due items first (up to half the block), then new content preferring the
 * unseen. Never the same key twice. The caller then builds the block in that order.
 */
export function plan(game, pool, size) {
  if (!learning()) return null;
  adopt(game, pool);
  const keys = new Set(pool.map(p => p.key)), facts = dueFacts();
  const own = picks(game).map(it => it.key).filter(k => keys.has(k));
  // and its own questions on facts another game found due
  const onFact = pool.filter(p => !own.includes(p.key) && p.facts?.some(f => facts.has(f))).map(p => p.key);
  return [...own, ...onFact].slice(0, Math.ceil(size / 2));
}
