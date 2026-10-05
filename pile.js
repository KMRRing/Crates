// The pile: what you didn't know, brought back until you do. Every knowledge game records an item when you miss
// it, pass on it, or barely stake on it, and when it comes back and you get it right it moves up a pile; wrong,
// and it drops to the first. Four piles with growing gaps, Leitner's boxes on Pimsleur's clock: ultra-short
// (due at once, for the next block), short (ten minutes), medium (twelve hours), long (a week); right in the long
// pile and it's learned. Learning mode lets each game's dealer draw what's due into its next block, alongside
// new content. Deck is the tile that reviews everything due, across the games.

const STORE = "pile:items", SETTINGS = "pile:settings";
export const PILES = [
  { id: 0, name: "Ultra-short", gap: 0 },
  { id: 1, name: "Short", gap: 10 * 60 * 1000 },
  { id: 2, name: "Medium", gap: 12 * 60 * 60 * 1000 },
  { id: 3, name: "Long", gap: 7 * 24 * 60 * 60 * 1000 },
];
export const GAMES = { punt: "Punt", quote: "Quote", chart: "Chart", crates: "Crates", rush: "Rush", slate: "Slate", parley: "Parley", brut: "Brut" };

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
let items = null;
function load() { if (!items) items = read(STORE, {}); return items; }
function save() { write(STORE, items); }

/** Learning mode: on by default. When on, the games' dealers draw due items into their next block. */
export const learning = () => read(SETTINGS, { learning: true }).learning !== false;
export function setLearning(on) { write(SETTINGS, { ...read(SETTINGS, {}), learning: !!on }); }

/**
 * Records an item. game: which game; key: its id in that game; payload: enough to ask it again anywhere
 * (see Deck); why: "wrong" | "pass" | "lowStake" | "miss" | "clue" | "lookup". A new item starts in the
 * ultra-short pile; a known one drops back to it.
 */
export function record(game, key, payload, why) {
  const all = load(), id = `${game}:${key}`, now = Date.now();
  const it = all[id] || { id, game, key, added: now, seen: 0, fails: 0, passes: 0 };
  it.payload = payload;
  it.pile = 0;
  it.due = now;
  delete it.learned;                                   // a learned item that's missed again is back in the piles
  it.fails++;
  it.last = { at: now, why };
  all[id] = it;
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
/** The item got answered when it came back: right moves it up a pile (and out, past the long one); wrong drops it to the first. */
export function answer(game, key, right) {
  const all = load(), id = `${game}:${key}`, it = all[id];
  if (!it) return null;
  const now = Date.now();
  if (right) {
    it.passes++;
    if (it.pile >= PILES.length - 1) { it.learned = now; it.due = Infinity; }
    else { it.pile++; it.due = now + PILES[it.pile].gap; }
  } else {
    it.fails++;
    it.pile = 0;
    it.due = now;
  }
  it.last = { at: now, why: right ? "right" : "wrong" };
  save();
  return it;
}
/** Every item, or a game's; learned ones last. */
export function all(game = null) {
  return Object.values(load()).filter(it => !game || it.game === game).sort((a, b) => (a.learned ? 1 : 0) - (b.learned ? 1 : 0) || a.pile - b.pile || a.due - b.due);
}
/** What's due now (or by `at`), soonest first; lower piles first among the due. */
export function due(game = null, at = Date.now()) {
  return all(game).filter(it => !it.learned && it.due <= at).sort((a, b) => a.pile - b.pile || a.due - b.due);
}
/** Counts per pile for a game or all, plus learned and due. */
export function counts(game = null) {
  const list = all(game), out = { piles: PILES.map(() => 0), learned: 0, due: 0, total: list.length };
  for (const it of list) { if (it.learned) out.learned++; else { out.piles[it.pile]++; if (it.due <= Date.now()) out.due++; } }
  return out;
}
/** Has this item been recorded (and not yet learned)? */
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
  const keys = new Set(pool.map(p => p.key));
  const dueKeys = due(game).map(it => it.key).filter(k => keys.has(k)).slice(0, Math.ceil(size / 2));
  return dueKeys;
}
