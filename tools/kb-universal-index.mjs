// Reads English Wikipedia's multistream index (offset:pageid:title for every page, about 17 million lines) once and writes
//   ns0.tsv      pageid TAB title            every main-namespace page (articles and redirects), the key to everything else
//   projects.tsv offset TAB pageid TAB title   the pages of the Vital Articles project, to read their text by byte range
// Usage: node tools/kb-universal-index.mjs <index.txt.bz2> <out folder>
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseIndexLine } from "./kb-universal-dump.mjs";

// Prefixes that make a title not an article (English Wikipedia's namespaces and their usual aliases)
const NAMESPACES = /^(Talk|User|User talk|Wikipedia|Wikipedia talk|File|File talk|MediaWiki|MediaWiki talk|Template|Template talk|Help|Help talk|Category|Category talk|Portal|Portal talk|Draft|Draft talk|TimedText|TimedText talk|Module|Module talk|Special|Media|WP|WT|Project|Image|MOS|CAT|H|T|P|MP|WikiProject):/;
const VITAL = /^Wikipedia:(Vital articles|WikiProject Vital articles)/;

const [file, outDir] = process.argv.slice(2);
if (!file || !outDir) { console.error("usage: node tools/kb-universal-index.mjs <index.txt.bz2> <out folder>"); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const ns0 = createWriteStream(join(outDir, "ns0.tsv"));
const proj = createWriteStream(join(outDir, "projects.tsv"));
const bz = spawn("bzcat", [file], { stdio: ["ignore", "pipe", "inherit"] });
let n = 0, a = 0, v = 0;
for await (const line of createInterface({ input: bz.stdout, crlfDelay: Infinity })) {
  n++;
  const e = parseIndexLine(line);
  if (!e) continue;
  const [offset, id, title] = e;
  if (VITAL.test(title)) { proj.write(`${offset}\t${id}\t${title}\n`); v++; }
  else if (!NAMESPACES.test(title)) { ns0.write(`${id}\t${title}\n`); a++; }
}
ns0.end(); proj.end();
console.log(`${n} index lines, ${a} main-namespace pages, ${v} Vital Articles pages`);
