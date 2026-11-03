// What a tier would weigh: the record a game needs per entity (Wikidata item, name, kind, a year, a country, a short
// description) and per link, measured on the pilot's real names and on kb/'s own files for the compression ratio.
// Usage: node tools/kb-universal-sizes.mjs <scored.json> [descriptionLength=36]
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const [scoredFile, descLen = "36"] = process.argv.slice(2);
if (!scoredFile) { console.error("usage: node tools/kb-universal-sizes.mjs <scored.json> [descriptionLength]"); process.exit(2); }
const { scored } = JSON.parse(readFileSync(scoredFile, "utf8"));
const root = resolve(import.meta.dirname, "..");
const kbFile = f => readFileSync(resolve(root, f), "utf8");
const gz = s => gzipSync(s).length;
const fill = n => "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt".slice(0, Number(n));

const ents = kbFile("kb/entities.js"), links = kbFile("kb/links.js");
console.log(`kb/ today: entities.js ${ents.length} B (${(ents.length / 7838).toFixed(0)} B each, gzip ${(gz(ents) / ents.length * 100).toFixed(0)}%), links.js ${links.length} B (${(links.length / 10016).toFixed(0)} B each, gzip ${(gz(links) / links.length * 100).toFixed(0)}%)`);

// the record: [QID number, name, kind index, year, country code, description]; a link: [from row, to row, kind, weight]
const record = e => JSON.stringify([Number(e.qid.slice(1)), e.title.replace(/_/g, " "), 3, 1900, "GB", fill(descLen)]);
const tiers = ["core", "wide", "deep"];
let cumulative = 0, cumulativeGz = 0;
for (const t of tiers) {
  const list = scored.filter(e => e.tier === t);
  const body = "[" + list.map(record).join(",\n") + "]";
  cumulative += body.length; cumulativeGz += gz(body);
  console.log(`${t}: ${list.length} entities, ${(body.length / Math.max(1, list.length)).toFixed(0)} B each raw, ${(body.length / 1024).toFixed(0)} KB raw, ${(gz(body) / 1024).toFixed(0)} KB gzip (running total ${(cumulative / 1024).toFixed(0)} KB / ${(cumulativeGz / 1024).toFixed(0)} KB)`);
}
const edge = JSON.stringify([12345, 23456, 3, 7]);
console.log(`a link as JSON: ${edge.length + 1} B; as binary (two 3-byte rows, a kind, a weight): 8 B`);
