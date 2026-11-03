// Meta-Wiki's "List of articles every Wikipedia should have": the language-neutral sibling of the English Vital Articles.
// Its 1,000 (the base list) and its 10,000 (Expanded, one page per domain, with a quota per region) name Wikidata items
// directly, so there is nothing to translate, and its editors work across languages, which is the counterweight to the
// English list's Anglo-American lean. Only the item numbers, the section each sits in and the label are kept (CC BY-SA 4.0 page, facts as data).
// Usage: node tools/kb-universal-meta.mjs <every-index.txt> <out folder>
//   every-index.txt: the lines "offset:pageid:title" of the list's pages from metawiki's multistream index.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pageText } from "./kb-universal-vital.mjs";

const META = "https://dumps.wikimedia.org/metawiki/latest/metawiki-latest-pages-articles-multistream.xml.bz2";
const [indexFile, outDir] = process.argv.slice(2);
if (!indexFile || !outDir) { console.error("usage: node tools/kb-universal-meta.mjs <every-index.txt> <out folder>"); process.exit(2); }
mkdirSync(join(outDir, "streams"), { recursive: true });
const BASE = "List of articles every Wikipedia should have";
const pages = readFileSync(indexFile, "utf8").split("\n").filter(Boolean).map(l => { const [o, id, ...t] = l.split(":"); return { offset: Number(o), title: t.join(":") }; });
const wanted = pages.filter(p => p.title === BASE || (p.title.startsWith(BASE + "/Expanded/") && !/\/(Candidates|Count|Quotas)/.test(p.title)));
const seen = new Map();
for (const p of wanted) {
  const text = pageText(p.offset, p.title, join(outDir, "streams"), META);
  if (!text) { console.error("no text:", p.title); continue; }
  const level = p.title === BASE ? "M1" : "M2";
  const domain = p.title === BASE ? "" : p.title.slice((BASE + "/Expanded/").length);
  let section = "";
  let n = 0;
  for (const line of text.split("\n")) {
    const h = /^={2,5}.*?<!--\s*(.*?)\s*-->/.exec(line);
    if (h) { section = h[1]; continue; }
    const m = /^#+\s*\[\[:?d:(Q\d+)\|([^\]]*)\]\]/.exec(line);
    if (!m) continue;
    n++;
    const prev = seen.get(m[1]);
    if (!prev || (level === "M1" && prev.level === "M2")) seen.set(m[1], { level, domain: domain || prev?.domain || "", section, label: m[2] });
  }
  console.error(p.title, n);
}
writeFileSync(join(outDir, "meta.tsv"), [...seen].map(([q, v]) => [q, v.level, v.domain, v.section, v.label].join("\t")).join("\n") + "\n");
console.log(seen.size, "distinct items");
