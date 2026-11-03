// What kb/ holds, as a flat table the universality score can be laid against: one row per entity with a class (what kind
// of thing, so the score knows whether Wikipedia can have an article on it at all), a domain (the Vital Articles'
// eleven, so a quota can balance them) and how many links it has. Read-only: it never touches kb/.
// One pass over LINKS and ENTITIES, indexed by id (CLAUDE.md: never scan LINKS inside a loop).
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/** Things that are text (a saying, a quotation, a Bavarian word), not a subject: Wikipedia has no article on them. */
const PHRASE_SETS = new Set(["saying", "quotation", "legal-maxim", "bavarian-word", "scots-word", "chengyu", "kind:word", "kind:number"]);

/** kind (or set) → the Vital Articles domain it would sit in. First match wins; the order is the list's order. */
const DOMAIN_OF = [
  ["People", ["kind:person", "person", "author", "painter", "architect", "myth-hero", "bavaria-person", "britain-person", "china-person", "court-person", "great-skier", "art-market-person", "horology-person", "merchant-person", "scottish-inventor", "chinese-thinker", "ski-person", "art-dealer", "art-forger"]],
  ["Geography", ["country", "city", "kind:place", "geo-place", "trade-place", "people-place", "wine-place", "feature", "bavaria-place", "scotland-place", "china-place", "chinese-province", "britain-place", "lake-geneva-place", "watch-valley-place", "court-place", "ski-resort", "myth-place", "art-place", "bavarian-district", "kind:site", "building", "museum", "art-market-place"]],
  ["History", ["kind:event", "trade-history", "merchant-power", "kind:law", "chivalric-order", "peerage-rank", "german-rank", "religious-order", "court-thing", "britain-thing", "bavaria-thing", "china-thing"]],
  ["Arts", ["painting", "work", "kind:art", "kind:book", "kind:music", "kind:film", "kind:tv", "kind:video game", "art-movement", "architecture-style", "architecture-term", "kind:craft", "german-style", "watch-brand", "watch-model", "complication", "watch-finish", "watch-group", "art-record", "art-fair", "auction-house", "art-market-thing"]],
  ["Philosophy and religion", ["greek-god", "roman-god", "egyptian-god", "norse-god", "myth-creature", "legal-concept", "kind:custom", "chinese-festival"]],
  ["Everyday life", ["kind:food", "kind:drink", "kind:sport", "ski-race", "ski-thing", "kind:game", "chinese-dish", "chinese-tea", "distillery", "dress-code", "movement-part", "kind:currency"]],
  ["Society and social sciences", ["kind:company", "kind:organisation", "kind:market", "commodity", "bavarian-company", "futures-exchange", "trade-good"]],
  ["Biological and health sciences", ["kind:plant", "kind:animal", "kind:disease", "kind:natural"]],
  ["Physical sciences", ["kind:material"]],
  ["Technology", ["kind:tech", "kind:vehicle"]],
];
const DOMAIN_INDEX = new Map(DOMAIN_OF.flatMap(([d, sets]) => sets.map(s => [s, d])));

/** The first set that says what a thing is (not a group:eu style membership). */
export const primarySet = e => e.sets.find(s => !s.startsWith("group:")) || e.sets[0] || "";

/** Rows: { i, id, name, qualifier, set, cls: "phrase" | "thing", domain, degree, crates } for every entity of kb/. */
export async function loadKb(root = resolve(import.meta.dirname, "..")) {
  const { ENTITIES } = await import(pathToFileURL(resolve(root, "kb/entities.js")).href);
  const { LINKS } = await import(pathToFileURL(resolve(root, "kb/links.js")).href);
  const degree = new Map();
  for (const l of LINKS) { degree.set(l.from, (degree.get(l.from) || 0) + 1); degree.set(l.to, (degree.get(l.to) || 0) + 1); }
  return ENTITIES.map((e, i) => {
    const set = primarySet(e);
    const phrase = e.sets.some(s => PHRASE_SETS.has(s));
    const domain = DOMAIN_INDEX.get(set) || e.sets.map(s => DOMAIN_INDEX.get(s)).find(Boolean) || "Unplaced";
    return { i, id: e.id, name: e.name, qualifier: e.qualifier || "", set, sets: e.sets, cls: phrase ? "phrase" : "thing", domain,
      degree: degree.get(e.id) || 0, crates: e.crates ?? null, same: e.same || null, aliases: e.aliases || [] };
  });
}

// node tools/kb-universal-kb.mjs → the shape of kb/ by class, domain and degree
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = await loadKb();
  const count = key => { const m = new Map(); for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
  console.log(rows.length, "entities");
  console.log("by class:", count("cls").map(x => x.join(" ")).join(", "));
  console.log("by domain:", count("domain").map(x => x.join(" ")).join(", "));
  console.log("no link at all:", rows.filter(r => !r.degree).length, " crates answers:", rows.filter(r => r.crates !== null).length);
}
