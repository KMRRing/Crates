// The audit's counts and the borderline pile. node tools/audit-report.mjs prints the entities per subject and mark, then the
// items per bank and mark; --write also writes kb/audit/borderline.md (the calls closest to the line, for Korbi's spot check).
import fs from "node:fs";
import path from "node:path";
import { ENTITIES } from "../kb/entities.js";
import { LINKS } from "../kb/links.js";
import { ENTITY } from "../kb/audit/marks.js";
import { SUBJECTS, SUBJECT } from "../kb-index.js";
import { build } from "./build-kb.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const subjectOf = id => SUBJECTS[SUBJECT[id]]?.label ?? "(no subject)";
const NAMES = { u: "universal", r: "regional", s: "specialist", p: "personal", l: "living" };
const by = {};
for (const e of ENTITIES) { const row = (by[subjectOf(e.id)] ||= { u: 0, r: 0, s: 0, p: 0, l: 0 }); row[ENTITY[e.id]]++; }
const total = { u: 0, r: 0, s: 0, p: 0, l: 0 };
console.log("subject".padEnd(26), "total   univ  regio  spec  pers  living");
for (const [s, r] of Object.entries(by).sort((a, b) => b[1].u + b[1].r + b[1].s + b[1].p + b[1].l - (a[1].u + a[1].r + a[1].s + a[1].p + a[1].l))) {
  for (const k in r) total[k] += r[k];
  console.log(s.padEnd(26), String(Object.values(r).reduce((a, b) => a + b, 0)).padStart(5), ...Object.values(r).map(n => String(n).padStart(6)));
}
console.log("ALL".padEnd(26), String(ENTITIES.length).padStart(5), ...Object.values(total).map(n => String(n).padStart(6)));

// items: dealt by the published build against everything kb/ holds
const pub = await build(), full = await build({ level: "personal" });
const line = (n, a, b) => console.log(n.padEnd(26), String(b).padStart(5), String(a).padStart(6), `(${Math.round(100 * a / (b || 1))}%)`);
console.log("\nitems", "dealt".padStart(21), "of kb/");
for (const b of Object.keys(full.choice)) line(`Punt ${b}`, pub.choice[b].MATHS.length, full.choice[b].MATHS.length);
line("Chart places", pub.chart.PLACES.length, full.chart.PLACES.length);
line("Chart features", pub.geo.GEO.length, full.geo.GEO.length);
line("Quote", pub.quote.QUOTES.length, full.quote.QUOTES.length);
line("Who am I?", Object.keys(pub.whoami.WHO).length, Object.keys(full.whoami.WHO).length);

if (process.argv.includes("--write")) {
  // the calls closest to the line: regional things a school system might still teach (named features, the next countries, famous
  // people and works kept regional), universal ones that are near the cut (smaller countries kept in), and the living kept out
  const out = [];
  const add = (subject, e, why) => out.push([subject, `${e.name} (${e.id}): ${ENTITY[e.id]}. ${why}`]);
  const has = (e, s) => e.sets.includes(s);
  for (const e of ENTITIES) {
    const m = ENTITY[e.id];
    if (has(e, "country") && m === "r" && (e.population ?? 0) >= 15) add("Geography", e, `${e.population} m people, ${e.area?.toLocaleString("en")} km²: the next after the universal countries`);
    else if (has(e, "country") && m === "u" && (e.population ?? 99) < 40 && (e.area ?? 0) < 2e6) add("Geography", e, "universal by hand (a regional power or a country every region study names), small by the numbers");
    else if (e.sets.some(s => s.startsWith("feature:")) && m === "r" && (e.length > 2500 || e.area > 150000 || e.top > 5000 || has(e, "feature:range"))) add("Geography", e, "a large named feature, regional only because no syllabus is known to name it");
    else if (e.sets.includes("city") && m === "r" && ["capital", "port"].some(() => true) && /^(lagos|dhaka|lima|bogota|jakarta)/.test(e.id)) add("Cities", e, "a megacity or national capital");
    else if (has(e, "museum") && m === "r") add("Art & architecture", e, "a famous collection, kept regional");
    else if ((has(e, "painter") || has(e, "painting")) && m === "r" && e.pic && (e.year ?? 9999) < 1950 && LINKS.filter(l => l.from === e.id).length >= 3) add("Art & architecture", e, "well documented in kb/ (three or more links), kept regional");
    else if ((has(e, "author") || has(e, "work")) && m === "r" && LINKS.filter(l => l.to === e.id || l.from === e.id).length >= 4) add("Literature, music & myth", e, "a connected author or work, kept regional");
    else if (m === "l") add("People", e, "alive, not on the short list of the globally famous");
    else if (e.sets.some(s => /-god$/.test(s)) && m === "r") add("Literature, music & myth", e, "a god of a tradition taught in a few systems");
    else if (has(e, "commodity") && m === "r") add("Trade", e, "a commodity some geography syllabuses name among minerals and crops");
  }
  const groups = {};
  for (const [s, t] of out) (groups[s] ||= []).push(t);
  const cap = 330, keep = Math.ceil(cap / Object.keys(groups).length);
  let body = `# The borderline pile\n\nFor Korbi's spot check (3 November 2026, the audit): ${Math.min(out.length, cap)} of ${out.length} calls closest to the line between universal and not, by subject. To reverse one, change its letter in \`kb/audit/marks.js\` (u universal, r regional, s specialist, p personal, l living) and run \`node tools/build-kb.mjs\`. Written by \`node tools/audit-report.mjs --write\`.\n`;
  let n = 0;
  for (const [s, list] of Object.entries(groups)) { const part = list.slice(0, keep); n += part.length; body += `\n## ${s} (${part.length} of ${list.length})\n${part.map(t => `- ${t}`).join("\n")}\n`; }
  fs.writeFileSync(path.join(root, "kb/audit/borderline.md"), body);
  console.log(`\nborderline: ${n} of ${out.length} written`);
}
