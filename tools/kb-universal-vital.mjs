// The community's own list of what matters: Wikipedia's Vital Articles (level 1 = 10 articles … level 5 = 50,000), read
// from the English dump by byte range (a multistream bzip2 file opens at any stream's offset without reading the rest).
// What is kept is only which article titles the lists name and under which domain (a fact about the list); the lists'
// wikitext (CC BY-SA 4.0) is read here and thrown away, never copied into the repo.
// Usage: node tools/kb-universal-vital.mjs <projects.tsv> <out folder> [maxLevel]
//   projects.tsv from tools/kb-universal-index.mjs. Writes vital.tsv: title, level, heading, subheading, page, level-4 domain (TAB-separated)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DUMP = "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles-multistream.xml.bz2";
const UA = "CodexKnowledgeResearch/0.1 (Korbi's game suite; repo KMRRing/Crates)";
const WINDOW = 12 * 1024 * 1024; // a stream holds ~100 pages; the list pages are large, so read generously and let bzcat stop where the data does

const unxml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** The wikitext of the page `title` whose stream starts at `offset`, or null. Caches the stream's text on disk. */
export function pageText(offset, title, cacheDir, dump = DUMP) {
  const f = join(cacheDir, `${offset}.xml`);
  let xml;
  if (existsSync(f)) xml = readFileSync(f, "utf8");
  else {
    const bz = execFileSync("curl", ["-sS", "--retry", "3", "-m", "180", "-A", UA, "-r", `${offset}-${offset + WINDOW}`, dump], { maxBuffer: WINDOW + 4096 });
    try { xml = execFileSync("bzcat", { input: bz, maxBuffer: 1 << 30, stdio: ["pipe", "pipe", "ignore"] }).toString("utf8"); }
    catch (e) { xml = (e.stdout || Buffer.alloc(0)).toString("utf8"); } // the window ends mid-stream of the next block: bzcat fails after the first stream's text
    writeFileSync(f, xml);
  }
  const i = xml.indexOf(`<title>${title.replace(/&/g, "&amp;")}</title>`);
  if (i < 0) return null;
  const a = xml.indexOf("<text", i), b = xml.indexOf("</text>", a);
  if (a < 0 || b < 0) return null;
  return unxml(xml.slice(xml.indexOf(">", a) + 1, b));
}

/** Titles named on a Vital Articles page, each with the headings it stands under: [{ title, domain, sub }]. */
export function listedArticles(wikitext) {
  const out = [];
  let h2 = "", sub = "";
  for (const raw of wikitext.split("\n")) {
    const h = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(raw);
    if (h) { const text = h[2].replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?|\{\{[^}]*\}\}/g, "").trim(); if (h[1].length === 2) { h2 = text; sub = ""; } else sub = text; continue; }
    if (!/^[*#]/.test(raw)) continue;
    const line = raw.replace(/\{\{[^{}]*\}\}/g, "").replace(/\{\{[^{}]*\}\}/g, ""); // icons and templates, twice for nesting
    const m = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/.exec(line);
    if (!m) continue;
    const title = m[1].trim().replace(/_/g, " ");
    if (/^(File|Category|Wikipedia|Image|Template|Portal|Help|Talk|User):/i.test(title)) continue;
    out.push({ title: title[0].toUpperCase() + title.slice(1), domain: h2, sub });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [projects, outDir, maxLevel = "4"] = process.argv.slice(2);
  mkdirSync(outDir, { recursive: true });
  const cache = join(outDir, "streams"); mkdirSync(cache, { recursive: true });
  const rows = readFileSync(projects, "utf8").split("\n").filter(Boolean).map(l => l.split("\t")).map(([o, id, t]) => ({ offset: Number(o), id: Number(id), title: t }));
  // The lists in use: level 3's one page, level 4's twelve domain pages (and any pages under them), level 5's pages. The project also
  // holds older layouts of level 4 (Science, Religion…), a Candidates page and a Removed page per list, which are not the list.
  const DOMAINS = "People|History|Geography|Arts|Philosophy and religion|Everyday life|Society and social sciences|Biology and health sciences|Physical sciences|Technology|Mathematics|Measurement";
  const IN_USE = new RegExp(`^Wikipedia:Vital articles/Level (3$|4/(${DOMAINS})(/|$)|5/)`);
  // "Article alerts" is a log of nominations and deletions under level 5, not a list: it names articles that are on no level
  const pages = rows.filter(r => IN_USE.test(r.title) && !/\/(Candidates|Removed|draft|Draft|Nav bar|header|Article alerts)\b/i.test(r.title))
    .map(r => ({ ...r, level: /^Wikipedia:Vital articles\/Level (\d)/.exec(r.title)[1] })).filter(r => Number(r.level) <= Number(maxLevel));
  console.error(pages.length, "list pages up to level", maxLevel);
  const seen = new Map(); // title → { level (lowest = most vital), domain, sub }
  // written after every page, so a long run (level 5 is ~120 pages of ~50 MB of text each to open) can be used while it is still going
  const flush = () => writeFileSync(join(outDir, "vital.tsv"), [...seen].map(([t, v]) => [t, v.level, v.domain, v.sub, v.page, v.d4].join("\t")).join("\n") + "\n");
  for (const p of pages) {
    const text = pageText(p.offset, p.title, cache);
    if (!text) { console.error("no text:", p.title); continue; }
    const items = listedArticles(text);
    console.error(p.title, items.length);
    const d4 = /Level 4\/([^/]+)/.exec(p.title)?.[1] || ""; // level 3's headings are coarser (one "Science"), level 4's pages name the eleven domains
    for (const it of items) {
      const key = it.title, lvl = Number(p.level);
      if (!seen.has(key) || seen.get(key).level > lvl) seen.set(key, { level: lvl, domain: it.domain, sub: it.sub, page: p.title, d4: seen.get(key)?.d4 || "" });
      if (d4) seen.get(key).d4 = d4;
    }
    flush();
  }
  console.log(seen.size, "distinct articles");
}
