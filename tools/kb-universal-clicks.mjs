// The Wikimedia clickstream (CC0): for one language edition and one month, every (where the reader came from → the
// article they landed on) pair with at least 10 readers, and how many. Two uses here:
//   views mode (default): the readers an article got in the month (all rows summed) → "title TAB views", for titles
//     with at least minViews. It under-counts a little (pairs under 10 are dropped) but it is the same bias for every title.
//   edges mode (--edges wanted.txt): the links readers actually followed between wanted titles (one title per line,
//     underscored): "from TAB to TAB n", type "link" only. Edge weight for the link graph: a link nobody follows is not a link a game can use.
// Usage: node tools/kb-universal-clicks.mjs <clickstream.tsv.gz> <out.tsv> [minViews=300] [--edges wanted.txt] [--lean]
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipLines } from "./kb-universal-dump.mjs";

const args = process.argv.slice(2);
const edgesAt = args.indexOf("--edges");
const wantedFile = edgesAt >= 0 ? args.splice(edgesAt, 2)[1] : null;
const leanAt = args.indexOf("--lean");
const lean = leanAt >= 0 && !!args.splice(leanAt, 1);   // for English, whose table of titles does not fit a plain Map in a small machine
const [file, out, minViews = "300"] = args;
if (!file || !out) { console.error("usage: node tools/kb-universal-clicks.mjs <clickstream.tsv.gz> <out.tsv> [minViews] [--edges wanted.txt]"); process.exit(2); }

if (wantedFile) {
  const wanted = new Set(readFileSync(wantedFile, "utf8").split("\n").filter(Boolean));
  const rows = [];
  await gunzipLines(file, line => {
    const a = line.indexOf("\t"), b = line.indexOf("\t", a + 1), c = line.indexOf("\t", b + 1);
    if (line.slice(b + 1, c) !== "link") return;
    const from = line.slice(0, a), to = line.slice(a + 1, b);
    if (wanted.has(from) && wanted.has(to)) rows.push(`${from}\t${to}\t${line.slice(c + 1)}`);
  });
  writeFileSync(out, rows.join("\n") + "\n");
  console.log(rows.length, "edges between wanted titles");
} else if (lean) {
  // English has ~8 million landing titles: sum by a 53-bit hash of the title (numbers are far lighter than strings in a Map)
  // in a first pass, and read the titles of the ones that clear the bar in a second. A collision could only add two tiny titles' views.
  const hash = s => { let h1 = 0x811c9dc5, h2 = 5381; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = (Math.imul(h2, 33) + c) >>> 0; } return h1 * 2097152 + (h2 & 0x1fffff); };
  const sums = new Map();
  await gunzipLines(file, line => {
    const a = line.indexOf("\t"), b = line.indexOf("\t", a + 1), c = line.indexOf("\t", b + 1);
    const h = hash(line.slice(a + 1, b));
    sums.set(h, (sums.get(h) || 0) + Number(line.slice(c + 1)));
  });
  const views = new Map();
  await gunzipLines(file, line => {
    const a = line.indexOf("\t"), b = line.indexOf("\t", a + 1);
    const to = line.slice(a + 1, b);
    if (!views.has(to)) { const v = sums.get(hash(to)); if (v >= Number(minViews)) views.set(to, v); }
  });
  const keep = [...views].sort((x, y) => y[1] - x[1]);
  writeFileSync(out, keep.map(([t, v]) => `${t}\t${v}`).join("\n") + "\n");
  console.log(keep.length, "titles with at least", minViews, "readers, of", sums.size);
} else {
  const views = new Map();
  await gunzipLines(file, line => {
    const a = line.indexOf("\t"), b = line.indexOf("\t", a + 1), c = line.indexOf("\t", b + 1);
    const to = line.slice(a + 1, b);
    views.set(to, (views.get(to) || 0) + Number(line.slice(c + 1)));
  });
  // main pages and special pages are in the list too; they are dropped when the titles are joined to articles
  const keep = [...views].filter(([, v]) => v >= Number(minViews));
  keep.sort((x, y) => y[1] - x[1]);
  writeFileSync(out, keep.map(([t, v]) => `${t}\t${v}`).join("\n") + "\n");
  console.log(keep.length, "titles with at least", minViews, "readers, of", views.size);
}
