// Census, pure: a set is named and you type its members against the clock. A typed name is judged against the members not yet
// found (typing.js: case, accents, a leading "the" and a slip of a letter are forgiven); an exact name beats a slip, and a slip
// that two members could be is not taken. The score is the share of the set found; nothing is lost for a wrong name.
import { check } from "./typing.js";
import { SETS, GROUPS } from "./census-sets.js";

export { SETS, GROUPS };
export const LEVELS = { easy: { time: 1.5 }, medium: { time: 1 }, hard: { time: 0.7 } };
export const LEVEL_IDS = Object.keys(LEVELS);
export const setOf = id => SETS.find(s => s.id === id) || null;

/** Seconds for a set at a level: more for a longer set, never under a minute or over six. */
export const secondsFor = (set, level) => Math.round(Math.min(360, Math.max(60, 40 + 7 * set.items.length)) * (LEVELS[level]?.time ?? 1) / 5) * 5;

const names = item => [item.name, ...item.alt];
/**
 * What a typed name is: { kind: "new", index } a member not found yet; { kind: "again", index } one already found; { kind: "no" }
 * nothing in the set; { kind: "blank" } nothing typed. `found` is a Set of member indexes.
 */
export function judge(set, found, typed) {
  if (!typed || !typed.trim()) return { kind: "blank" };
  const hits = [];
  set.items.forEach((item, index) => { const r = check(typed, names(item)); if (r.right) hits.push({ index, exact: r.exact }); });
  const exact = hits.filter(h => h.exact), pool = exact.length ? exact : hits;
  if (pool.length !== 1) return pool.length ? { kind: "no", ambiguous: true } : { kind: "no" };
  return { kind: found.has(pool[0].index) ? "again" : "new", index: pool[0].index };
}
/** The share of the set found, as a whole percent. */
export const percent = (set, found) => Math.round(100 * found / set.items.length);
/** Stars: all of it, most of it (three in five), or less. */
export const starsFor = pct => (pct >= 100 ? 3 : pct >= 60 ? 2 : 1);

// ---------- dealing ----------
/** A small seeded stream (mulberry32), so a day's set is the same on every phone. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Today's set: one for the day, the same for everyone. */
export const dailySet = day => SETS[Math.floor(rng(day * 31 + 7)() * SETS.length)];
/**
 * A set not dealt lately (`seen`, newest first), the one longest ago if all have been. `from` is a group name ("all" for every one), or
 * { subjects: the subject ids on (null for all), region: a continent or "world", prefer: set ids the learning mode wants back }: a
 * region with no set in it deals from the rest of the world, and the preferred sets that are in the pool come first.
 */
export function dealSet(from = "all", seen = [], rand = Math.random) {
  const o = typeof from === "string" ? { group: from } : from;
  let pool = SETS.filter(s => (!o.group || o.group === "all" || s.group === o.group) && (!o.subjects || o.subjects.includes(s.subject)));
  if (o.region && o.region !== "world" && pool.some(s => s.regions.includes(o.region))) pool = pool.filter(s => s.regions.includes(o.region));
  if (!pool.length) pool = SETS;
  const want = pool.filter(s => o.prefer?.includes(s.id));
  if (want.length) return want[Math.floor(rand() * want.length)];
  const fresh = pool.filter(s => !seen.includes(s.id));
  if (fresh.length) return fresh[Math.floor(rand() * fresh.length)];
  return pool.slice().sort((a, b) => seen.indexOf(b.id) - seen.indexOf(a.id))[0];
}
