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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { TOPICS } = await import("../kb/audit/curriculum.js");
  const by = {};
  for (const t of TOPICS) { const a = (by[t.area] ||= { u: 0, r: 0, s: 0, edge: 0 }); a[classify(t)]++; if (borderline(t)) a.edge++; }
  console.log(`threshold ${THRESHOLD} of 15`);
  for (const [a, n] of Object.entries(by)) console.log(a, JSON.stringify(n));
}
