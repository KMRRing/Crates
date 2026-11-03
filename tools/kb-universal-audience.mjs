// The audience flag for every kb/ entity, from the pilot's scores (docs/universal-knowledge.md, method 6). Read-only: it
// prints the counts and writes a sidecar (id → audience) to a path of your choosing, never into kb/.
//   universal    core or wide: an article read in many editions and named by a curated list
//   borderline   deep, or thin with an educational signal: Korbi decides from the list this tool prints
//   specialist   has an article, but only thin: a niche subject, not a trader's
//   trade        thin, unmatched or ambiguous, and most of its clue links are the trader's topics
//   unknown      no article found under any of its names, or only a disambiguation page: a person looks (often a name to fix)
//   outside      a saying, quotation or word: Wikipedia has no article on it by nature, so the score cannot judge it
// A Crates answer (the entity has a `crates` position) is always kept whatever its audience: shared board codes point at it.
// Usage: node tools/kb-universal-audience.mjs <scored.json> [out.json]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadKb } from "./kb-universal-kb.mjs";

/** A clue link whose main topic is the trader's: energy, metals, agriculture, markets, finance, trade, companies, logistics, regulation, production. */
export const TRADEISH = new Set(["nrg", "met", "agr", "mkt", "fin", "trade", "co", "mkts", "logi", "firm", "reg", "prod"]);
const TRADE_SHARE = 0.5;

/** The audience of one row, given the scored article it matched (or null), its trader share and whether a curriculum names it. */
export function audienceOf(row, status, scoredEntry, tradeShare) {
  if (row.cls === "phrase") return "outside";
  if (status === "found") {
    const tier = scoredEntry.tier;
    if (tier === "core" || tier === "wide") return "universal";
    if (tier === "deep") return "borderline";
    if (scoredEntry.taught) return "borderline";
    return tradeShare >= TRADE_SHARE ? "trade" : "specialist";
  }
  return tradeShare >= TRADE_SHARE ? "trade" : "unknown";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [scoredFile, outFile] = process.argv.slice(2);
  if (!scoredFile) { console.error("usage: node tools/kb-universal-audience.mjs <scored.json> [out.json]"); process.exit(2); }
  const root = resolve(import.meta.dirname, "..");
  const { scored, kbStatus } = JSON.parse(readFileSync(scoredFile, "utf8"));
  const byId = new Map(scored.map(e => [e.id, e]));
  const rows = await loadKb(root);
  const { LINKS } = await import(pathToFileURL(resolve(root, "kb/links.js")).href);
  const trade = new Map(); // one pass over LINKS, indexed by from-id
  for (const l of LINKS) if (l.rel === "clue") { const t = trade.get(l.from) || [0, 0]; t[1]++; if (TRADEISH.has(l.aspects?.[0])) t[0]++; trade.set(l.from, t); }
  const out = {}, counts = {}, byDomain = {};
  let keptByCrates = 0;
  for (const r of rows) {
    const s = kbStatus[r.i], t = trade.get(r.id);
    const a = audienceOf(r, s.status, s.status === "found" ? byId.get(s.id) : null, t ? t[0] / t[1] : 0);
    out[r.id] = a;
    counts[a] = (counts[a] || 0) + 1;
    (byDomain[r.domain] ||= {})[a] = (byDomain[r.domain][a] || 0) + 1;
    if (r.crates != null && !["universal", "borderline"].includes(a)) keptByCrates++;
  }
  console.log("audience:", JSON.stringify(counts));
  console.log("Crates answers that the filter would have left out but keeps:", keptByCrates);
  for (const [d, c] of Object.entries(byDomain)) console.log(" ", d.padEnd(32), JSON.stringify(c));
  if (outFile) writeFileSync(outFile, JSON.stringify(out));
}
