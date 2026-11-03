// Typed links between a set of Wikidata items, from Wikidata's own statements (CC0): only the kinds a game can use.
// A hairball of "related to" is no use to a question; "built in", "made by", "part of", "caused", "followed by" are.
// Usage: node tools/kb-universal-links.mjs <qids.json> <out.json> [chunk=300]
//   Both ends must be in the set, so the graph is the set's own: the core's links to the core.
import { readFileSync, writeFileSync } from "node:fs";
import { sparql, qid, chunks, sleep } from "./kb-universal-wdqs.mjs";

/** Wikidata property → the kind of link a game can use. */
export const USABLE = {
  P31: "is-a", P279: "kind-of", P361: "part-of", P527: "has-part",
  P17: "in", P131: "in", P495: "from", P159: "seat-in",
  P50: "made-by", P170: "made-by", P84: "made-by", P112: "made-by", P175: "made-by",
  P737: "influenced-by", P135: "movement", P101: "same-field", P136: "same-genre",
  P155: "after", P156: "before", P828: "caused-by", P1542: "caused",
  P463: "member-of", P108: "worked-at", P69: "studied-at", P19: "born-in", P20: "died-in", P27: "of-country", P37: "language-of",
};

export function linksQuery(from, to) {
  const v = list => list.map(q => "wd:" + q).join(" ");
  const props = Object.keys(USABLE).map(p => "wdt:" + p).join(" ");
  return `SELECT ?a ?p ?b WHERE { VALUES ?a { ${v(from)} } VALUES ?b { ${v(to)} } VALUES ?p { ${props} } ?a ?p ?b . FILTER(?a != ?b) }`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [inFile, outFile, chunk = "300"] = process.argv.slice(2);
  if (!outFile) { console.error("usage: node tools/kb-universal-links.mjs <qids.json> <out.json> [chunk]"); process.exit(2); }
  const qids = JSON.parse(readFileSync(inFile, "utf8"));
  const edges = [];
  for (const part of chunks(qids, Number(chunk))) {
    for (const r of sparql(linksQuery(part, qids), { timeout: 100 })) edges.push([qid(r.a), qid(r.p), qid(r.b)]);
    console.log(edges.length, "edges");
    sleep(8000);
  }
  writeFileSync(outFile, JSON.stringify(edges));
  const byKind = {};
  for (const [, p] of edges) byKind[USABLE[p]] = (byKind[USABLE[p]] || 0) + 1;
  console.log(JSON.stringify(byKind));
}
