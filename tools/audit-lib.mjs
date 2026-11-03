// The audit's rule in code (docs/the-knowledge-base.md, "Who the games ask about"): a topic is UNIVERSAL when at least
// THRESHOLD of the fifteen school systems teach it (curriculum cells F or K), REGIONAL at 3 up to that, SPECIALIST below 3.
// node tools/audit-lib.mjs prints the curriculum map's counts.
import { pathToFileURL } from "node:url";
export const THRESHOLD = 8;
export const REGIONAL_FROM = 3;
/** Votes for a topic: the systems whose cell is F (fetched) or K (known); `?` and `-` are none. */
export const votes = t => [...t.cells].filter(c => c === "F" || c === "K").length;
export const unverified = t => [...t.cells].filter(c => c === "?").length;
/** u universal, r regional, s specialist. */
export const classify = t => { const v = votes(t); return v >= THRESHOLD ? "u" : v >= REGIONAL_FROM ? "r" : "s"; };
/** Within one vote of a line, or a non-universal topic that the unverified cells could lift over it. */
export function borderline(t) {
  const v = votes(t), q = unverified(t);
  const c = classify(t);
  if (Math.abs(v - THRESHOLD) <= 1 || Math.abs(v - REGIONAL_FROM) <= 1) return true;
  if (c !== "u" && v + q >= THRESHOLD) return true;
  return false;
}

// ---- the marks on kb/'s entities and items (kb/audit/marks.js, kb/audit/levels.js) ----
import { ENTITY } from "../kb/audit/marks.js";
import { LEVEL, ITEM_MARK, QUOTE_CAT, AUDIENCE_MARK, WHOAMI_LIVING } from "../kb/audit/levels.js";
const LIVING_OWN = new Set(WHOAMI_LIVING);
/** A living person off the short list of the globally famous (an entity marked l, or one of Who am I?'s own). */
export const isLiving = id => ENTITY[id] === "l" || LIVING_OWN.has(id);
const RANK = { u: 0, r: 1, t: 1, s: 2, p: 3, l: 3 };
/** The worst of some marks (a missing one puts no limit): an item is as universal as its least universal part. */
export const worst = (...ms) => ms.reduce((a, b) => (b && RANK[b] > RANK[a] ? b : a), "u");
/** What each build writes: `public`, the build CI, the published app and the tests use, holds everything but the living, each item
 *  carrying its mark if it is marked for removal (`mk`: s or p); `personal` holds the living too (for the tests of the writing).
 *  Which the games deal is decided at run time by Settings' choice, Exclude (the kept: u, r, t) or Include. */
export const LEVELS = { public: new Set(["u", "r", "t", "s", "p"]), personal: new Set(["u", "r", "t", "s", "p", "l"]) };
/** The kept tiers: universal, regional and theme. Marked for removal: specialist and personal. */
export const KEPT = new Set(["u", "r", "t"]);
/** The compact mark an item carries when it is marked for removal (or living, in the one place a living thing stays: Crates). */
export const mkOf = m => (m === "s" || m === "p" || m === "l" ? m : undefined);
export const entityMark = id => ENTITY[id];
/** A Punt question: its level's mark and the mark of the first entity it is about (its subject). */
export function choiceMark(bank, q) {
  if (ITEM_MARK[q.id]) return ITEM_MARK[q.id];
  const lv = LEVEL[bank]; const level = lv?.[q.lv] ?? lv?.["*"];
  // a quotation is asked as famous as its work and its author (about = [the line, the work, the author]); other items by their subject, the first
  const ids = bank === "lit" ? q.about?.slice(1) : q.about?.slice(0, 1);
  return worst(level, ...(ids?.length ? ids : [null]).map(id => (id ? ENTITY[id] ?? "s" : "u")));
}
/** A Quote estimate: its audience, its category, and the entity it is about. */
export function estimateMark(q) {
  const ent = q.about ? ENTITY[q.about] ?? "s" : "u", cat = QUOTE_CAT[q.cat];
  const m = worst(AUDIENCE_MARK[q.audience] ?? "s", cat, ent);
  // a theme entity's estimate is theme however specialist its audience, unless its category is trade or markets
  return m === "s" && ent === "t" && !cat ? "t" : m;
}
/** A Chart pin or feature: the entity it is about. */
export const pinMark = p => ENTITY[p.about] ?? "s";

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { TOPICS } = await import("../kb/audit/curriculum.js");
  const by = {};
  for (const t of TOPICS) { const a = (by[t.area] ||= { u: 0, r: 0, s: 0, edge: 0 }); a[classify(t)]++; if (borderline(t)) a.edge++; }
  console.log(`threshold ${THRESHOLD} of 15`);
  for (const [a, n] of Object.entries(by)) console.log(a, JSON.stringify(n));
}
