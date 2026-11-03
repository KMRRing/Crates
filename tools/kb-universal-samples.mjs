// Renders the pilot's report.json as the samples file Korbi reads by eye (docs/universal-knowledge-samples.md).
// Usage: node tools/kb-universal-samples.mjs <report.json> <out.md>
import { readFileSync, writeFileSync } from "node:fs";

const [inFile, outFile] = process.argv.slice(2);
if (!outFile) { console.error("usage: node tools/kb-universal-samples.mjs <report.json> <out.md>"); process.exit(2); }
const r = JSON.parse(readFileSync(inFile, "utf8"));
const cell = v => String(v ?? "").replace(/\|/g, "/");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map(x => `| ${x.map(cell).join(" | ")} |`)].join("\n");
const kbRow = x => [x.name, x.set, x.status, x.title ? x.title.replace(/_/g, " ") : "", x.u ?? "", x.languages ?? "", x.editions ?? "", x.vital ?? "", x.trade ?? ""];
const KB_HEAD = ["kb/ thing", "set", "tier", "matched article", "score", "languages", "editions read (of 13)", "vital level", "trader links"];

const out = [];
out.push(`# Universal knowledge: the pilot's samples

Made by \`tools/kb-universal-samples.mjs\` from the pilot's report (3 November 2026). Read with \`docs/universal-knowledge.md\`. Tiers: **core** (in Vital level 3 or Meta's 1,000, or in 150+ languages and read in 8+ of the 13 editions), **wide** (Vital level 4, Meta's 10,000, or a high score), **deep** (Vital level 5, or modest score), **thin** (has an article, nothing above: where trade words land), **none** (no article found under any of the thing's names), **ambiguous** (only a disambiguation page), **phrase** (a saying or quotation: no article by nature).
"score" is the composite (0 to 1) without the education signal; "editions read" is in how many of the 13 sampled editions the article got at least 300 readers in September 2026; "trader links" is the share of the thing's clue links whose main topic is energy, metals, agriculture, money, finance, trade, companies, markets or regulation (what separates a \`trade\` audience from a \`specialist\` one).
`);
out.push(`## 1. The 60 kb/ things that score lowest (ties broken by how many links they have)\n`);
out.push(table(KB_HEAD, r.lowest.map(kbRow)));
out.push(`\n## 2. The 60 highest-scoring things kb/ lacks\n`);
out.push(table(["article", "domain", "tier", "score", "languages", "editions read", "vital level", "found through"], r.lacking.map(x => [x.title.replace(/_/g, " "), x.domain ?? "", x.tier, x.u, x.languages, x.editions, x.vital ?? "", x.from.join("+")])));
out.push(`\n## 3. A hundred kept (core or wide), a hundred cut (thin, none, ambiguous), a hundred borderline (deep)\n`);
out.push(`Random with a fixed seed, so a rerun shows the same ones. Judge each: would an adult anywhere be glad to know it?\n`);
out.push(`### Kept\n`); out.push(table(KB_HEAD, r.kept.map(kbRow)));
out.push(`\n### Cut\n`); out.push(table(KB_HEAD, r.cut.map(kbRow)));
out.push(`\n### Borderline\n`); out.push(table(KB_HEAD, r.borderline.map(kbRow)));
out.push(`\n## 4. The education slice (history in three systems)\n`);
const t = r.taught;
out.push(`${t.named} things named; by 1, 2, 3 systems: ${t.byNumberOfSystems.join(", ")}. In Vital level 3 or better: ${t.inVital.l3}; level 4: ${t.inVital.l4}; not Vital: ${t.inVital.notVital}. Already in kb/: ${t.inKb}. Of the ${t.historyL3.n} History articles in Vital level 3, ${t.historyL3.named} are named by at least one of the three slices.\n`);
out.push(`### Named by two or more systems\n`);
out.push(table(["article", "systems (u UK, a US, n India)", "vital level", "tier", "languages", "editions read", "in kb/"], t.twoOrMore.map(x => [x.title.replace(/_/g, " "), x.systems, x.vital ?? "", x.tier, x.languages, x.editions, x.inKb ? "yes" : ""])));
out.push(`\n### Named by a syllabus but not in any Vital list (level 4 or better)\n`);
out.push(table(["article", "systems", "tier", "languages", "editions read"], t.notVitalList.map(x => [x.title.replace(/_/g, " "), x.systems, x.tier, x.languages, x.editions])));
out.push(`\n### Vital level 3 History articles none of the three slices names\n\n${t.historyL3.unnamed.map(x => x.replace(/_/g, " ")).join("; ")}\n`);
out.push(`## 5. West and English bias\n`);
const cov = r.westBias.coverage;
const eds = Object.keys(Object.values(cov)[0]).filter(k => k !== "n");
out.push(`Share of each list's articles that got at least 300 readers in September 2026, per edition:\n`);
out.push(table(["list", "n", ...eds], Object.entries(cov).map(([k, v]) => [k, v.n, ...eds.map(e => Math.round(v[e] * 100) + "%")])));
out.push(`\n### Read far more in English than elsewhere (Vital level 4 or Meta list)\n`);
out.push(table(["article", "domain", "skew", "editions read", "languages"], r.westBias.mostEnglish.map(x => [x.title.replace(/_/g, " "), x.domain ?? "", x.skew, x.editions, x.languages])));
out.push(`\n### Read far more elsewhere than in English\n`);
out.push(table(["article", "domain", "skew", "editions read", "languages"], r.westBias.leastEnglish.map(x => [x.title.replace(/_/g, " "), x.domain ?? "", x.skew, x.editions, x.languages])));
writeFileSync(outFile, out.join("\n") + "\n");
console.log("wrote", outFile);
