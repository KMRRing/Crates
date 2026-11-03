// English Wikipedia's page_props table → each page's Wikidata item (the QID that makes one thing in many languages
// and many syllabi one entity) and its disambiguation flag; and the redirect table → where each redirect points.
// Usage: node tools/kb-universal-props.mjs <page_props.sql.gz> <redirect.sql.gz> <out folder>
// Writes qid.tsv (pageid TAB number of the Q-item), disambig.txt (pageids), redirects.tsv (pageid TAB target title).
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { scanInserts, unescapeSql } from "./kb-universal-dump.mjs";

const [propsFile, redirFile, outDir] = process.argv.slice(2);
if (!propsFile || !redirFile || !outDir) { console.error("usage: node tools/kb-universal-props.mjs <page_props.sql.gz> <redirect.sql.gz> <out folder>"); process.exit(2); }
mkdirSync(outDir, { recursive: true });

// (pp_page, 'wikibase_item', 'Q42', sortkey) and (pp_page, 'disambiguation', '', sortkey)
const qid = createWriteStream(join(outDir, "qid.tsv")), dis = createWriteStream(join(outDir, "disambig.txt"));
let q = 0, d = 0;
await scanInserts(propsFile, /\((\d+),'(wikibase_item|disambiguation)','((?:[^'\\]|\\.)*)'/g, m => {
  if (m[2] === "disambiguation") { dis.write(m[1] + "\n"); d++; }
  else { qid.write(`${m[1]}\t${m[3].slice(1)}\n`); q++; }
});
qid.end(); dis.end();
console.log(`${q} pages with a Wikidata item, ${d} disambiguation pages`);

// (rd_from, rd_namespace, 'rd_title', rd_interwiki, rd_fragment): main-namespace targets on this wiki only
const red = createWriteStream(join(outDir, "redirects.tsv"));
let r = 0;
await scanInserts(redirFile, /\((\d+),0,'((?:[^'\\]|\\.)*)',(NULL|''),(?:NULL|'(?:[^'\\]|\\.)*')\)/g, m => {
  red.write(`${m[1]}\t${unescapeSql(m[2])}\n`); r++;
});
red.end();
console.log(`${r} redirects`);
