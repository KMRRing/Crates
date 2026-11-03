// How many other language editions have an article on a thing (English Wikipedia's langlinks table, one row per
// article-language pair), and what that article is called there (needed to look its readers up in that edition's clickstream).
// Usage: node tools/kb-universal-langs.mjs <langlinks.sql.gz> <ids.json> <langs: de,fr,…> <out.json> [top.json]
//   ids.json: array of English page ids to track. out.json: { id: { n: languages, t: { de: "Title_in_de", … } } }
//   top.json (optional): the 20,000 pages that exist in the most languages (id, n), for finding what the lists lack.
import { readFileSync, writeFileSync } from "node:fs";
import { scanInserts, unescapeSql } from "./kb-universal-dump.mjs";

const [file, idsFile, langList, out, topOut] = process.argv.slice(2);
if (!out) { console.error("usage: node tools/kb-universal-langs.mjs <langlinks.sql.gz> <ids.json> <de,fr,…> <out.json> [top.json]"); process.exit(2); }
const want = new Set(JSON.parse(readFileSync(idsFile, "utf8")));
const langs = new Set(langList.split(","));
const count = new Uint16Array(100_000_000);            // by page id: languages other than English with an article
const got = {};
let rows = 0;
await scanInserts(file, /\((\d+),'([^']+)','((?:[^'\\]|\\.)+)'\)/g, m => {   // an empty title is a placeholder, not an article
  const id = Number(m[1]);
  rows++;
  if (id < count.length) count[id]++;
  if (want.has(id)) {
    const e = got[id] || (got[id] = { n: 0, t: {} });
    e.n++;
    if (langs.has(m[2])) e.t[m[2]] = unescapeSql(m[3]).replace(/ /g, "_");
  }
});
writeFileSync(out, JSON.stringify(got));
console.log(rows, "language links;", Object.keys(got).length, "of", want.size, "tracked pages have any");
if (topOut) {
  const top = [];
  for (let i = 0; i < count.length; i++) if (count[i] >= 60) top.push([i, count[i]]);
  top.sort((a, b) => b[1] - a[1]);
  writeFileSync(topOut, JSON.stringify(top.slice(0, 20000)));
  console.log(top.length, "pages in at least 60 other languages");
}
