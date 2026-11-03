// What a question could ask about a thing, from Wikidata (CC0): its kind (instance of), a year (born, founded, first
// published), a country, a creator, and its short English description (CC0, so ours to keep, unlike Wikipedia's prose).
// The gameability test: a thing with none of these has nothing to ask. The durability test: a living person (born, no death) is gossip, not knowledge.
// Usage: node tools/kb-universal-facts.mjs <qids.json> <out.json> [batch=120]
//   Slow on purpose: one query at a time, a pause between, because the shared address is throttled (HTTP 429) if it hurries.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { sparql, qid, chunks, sleep } from "./kb-universal-wdqs.mjs";

export function factsQuery(qids) {
  const values = qids.map(q => "wd:" + q).join(" ");
  return `SELECT ?item (SAMPLE(?instL) AS ?inst) (MIN(?bornV) AS ?born) (MAX(?diedV) AS ?died) (MIN(?incV) AS ?inc) (MIN(?pubV) AS ?pub)
    (SAMPLE(?countryL) AS ?country) (SAMPLE(?creatorL) AS ?creator) (SAMPLE(?descV) AS ?desc) (SAMPLE(?humanV) AS ?human) WHERE {
    VALUES ?item { ${values} }
    OPTIONAL { ?item wdt:P31 ?i . ?i rdfs:label ?instL . FILTER(lang(?instL) = "en") }
    OPTIONAL { ?item wdt:P31 wd:Q5 . BIND(1 AS ?humanV) }
    OPTIONAL { ?item wdt:P569 ?bornV } OPTIONAL { ?item wdt:P570 ?diedV }
    OPTIONAL { ?item wdt:P571 ?incV } OPTIONAL { ?item wdt:P577 ?pubV }
    OPTIONAL { ?item wdt:P17|wdt:P495|wdt:P27 ?c . ?c rdfs:label ?countryL . FILTER(lang(?countryL) = "en") }
    OPTIONAL { ?item wdt:P50|wdt:P170|wdt:P175 ?cr . ?cr rdfs:label ?creatorL . FILTER(lang(?creatorL) = "en") }
    OPTIONAL { ?item schema:description ?descV . FILTER(lang(?descV) = "en") }
  } GROUP BY ?item`;
}

export const yearOf = s => s ? Number(/^-?\d+/.exec(s)?.[0]) : null;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [inFile, outFile, batch = "120"] = process.argv.slice(2);
  if (!outFile) { console.error("usage: node tools/kb-universal-facts.mjs <qids.json> <out.json> [batch]"); process.exit(2); }
  const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
  const todo = JSON.parse(readFileSync(inFile, "utf8")).filter(q => !out[q]);
  for (const part of chunks(todo, Number(batch))) {
    const rows = sparql(factsQuery(part), { timeout: 100 });
    for (const r of rows) out[qid(r.item)] = { inst: r.inst || null, human: !!r.human, born: yearOf(r.born), died: yearOf(r.died), inc: yearOf(r.inc), pub: yearOf(r.pub), country: r.country || null, creator: r.creator || null, desc: r.desc || null };
    for (const q of part) out[q] ||= { none: true };
    writeFileSync(outFile, JSON.stringify(out));
    console.log(Object.keys(out).length, "of", todo.length + Object.keys(out).length - part.length);
    sleep(8000);
  }
}
