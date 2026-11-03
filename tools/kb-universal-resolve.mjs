// Joins titles to Wikidata items. Input: a list of English titles (underscored, one per line); output: for each, the
// page it lands on after redirects, that page's Wikidata item (QID), and whether it is a disambiguation page.
// Memory stays small by streaming the big tables once per step and keeping only the rows asked for.
// Usage: node tools/kb-universal-resolve.mjs <titles.txt> <index folder> <props folder> <out.json>
//   index folder: ns0.tsv from kb-universal-index.mjs; props folder: qid.tsv, disambig.txt, redirects.tsv from kb-universal-props.mjs
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";

const lines = async (path, fn) => { for await (const l of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) fn(l); };

/** title → page id for every wanted title that is a main-namespace page. */
async function idsOf(wanted, ns0) {
  const out = new Map();
  await lines(ns0, l => { const t = l.indexOf("\t"); const title = l.slice(t + 1).replace(/ /g, "_"); if (wanted.has(title)) out.set(title, Number(l.slice(0, t))); });
  return out;
}

export async function resolve(titles, indexDir, propsDir) {
  const ns0 = join(indexDir, "ns0.tsv");
  const wanted = new Set(titles);
  const id = await idsOf(wanted, ns0);                                   // 1. the titles that exist
  const hop = new Map([...id].map(([t, i]) => [t, { title: t, id: i }])); // title → where it currently points
  for (let round = 0; round < 2; round++) {                              // 2. follow redirects (twice: double redirects exist)
    const byId = new Map([...hop.values()].map(h => [h.id, h]));
    const target = new Map();                                            // page id → redirect target title
    await lines(join(propsDir, "redirects.tsv"), l => { const t = l.indexOf("\t"); const i = Number(l.slice(0, t)); if (byId.has(i)) target.set(i, l.slice(t + 1).replace(/ /g, "_")); });
    const tids = await idsOf(new Set(target.values()), ns0);
    for (const h of hop.values()) { const tt = target.get(h.id); if (tt && tids.has(tt)) { h.title = tt; h.id = tids.get(tt); h.redirected = true; } }
  }
  const finals = new Set([...hop.values()].map(h => h.id));
  const qid = new Map(), dis = new Set();                                // 3. Wikidata items and disambiguation pages
  await lines(join(propsDir, "qid.tsv"), l => { const t = l.indexOf("\t"); const i = Number(l.slice(0, t)); if (finals.has(i)) qid.set(i, "Q" + l.slice(t + 1)); });
  await lines(join(propsDir, "disambig.txt"), l => { const i = Number(l); if (finals.has(i)) dis.add(i); });
  const out = {};
  for (const [t, h] of hop) out[t] = { id: h.id, title: h.title, qid: qid.get(h.id) || null, dis: dis.has(h.id) ? 1 : 0, redirect: h.redirected ? 1 : 0 };
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [titlesFile, indexDir, propsDir, out] = process.argv.slice(2);
  if (!out) { console.error("usage: node tools/kb-universal-resolve.mjs <titles.txt> <index folder> <props folder> <out.json>"); process.exit(2); }
  const titles = readFileSync(titlesFile, "utf8").split("\n").filter(Boolean);
  const r = await resolve(titles, indexDir, propsDir);
  writeFileSync(out, JSON.stringify(r));
  console.log(titles.length, "titles asked,", Object.keys(r).length, "found,", Object.values(r).filter(x => x.qid).length, "with a Wikidata item,", Object.values(r).filter(x => x.dis).length, "disambiguation");
}
