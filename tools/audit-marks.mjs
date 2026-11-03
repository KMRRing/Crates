// Fills kb/audit/marks.js: a mark for every entity (u universal, r regional, s specialist, p personal, l living), by the rules
// in tools/audit-rules.mjs. Only entities the file doesn't have yet are added, so a mark changed by hand stays; --redo
// starts again from the rules; --theme promotes the specialist and personal entities that kb/audit/theme.js names to t (the
// theme tier) and a new entity is checked against it too. node tools/audit-marks.mjs [--redo] [--theme] [--list u]
// (--list prints the entities with that mark)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as R from "./audit-rules.mjs";
import { upgraded } from "./audit-theme.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const file = path.join(root, "kb/audit/marks.js");
const PERSON = /(^|:)person$|-person$|^author$|^painter$|^architect$|great-skier|inventor|thinker/;
const MUSEUM_U = ["louvre", "british museum", "metropolitan museum", "prado", "uffizi", "hermitage", "rijksmuseum", "sistine"];
const MUSEUM_R = ["tate modern", "musee d orsay", "moma", "national gallery", "van gogh museum", "reina sofia", "pergamon", "victoria and albert", "natural history museum", "science museum", "guggenheim", "centre pompidou", "egyptian museum", "acropolis museum", "topkapi", "anne frank", "deutsches museum", "palace museum", "tretyakov", "pushkin", "galleria borghese", "vatican", "kunsthistorisches", "belvedere", "gallerie dell accademia", "accademia", "mauritshuis", "yad vashem", "auschwitz", "national air and space", "smithsonian", "art institute of chicago", "getty", "british library"];
const BIRTH_U = /napoleon|mozart|picasso|einstein|van-gogh|marie-curie|shakespeare|leonardo|beethoven|gandhi|mandela|columbus|magellan|alexander-the-great|confucius|buddha|marx|darwin|newton|galileo|genghis|cleopatra|copernicus|michelangelo/;
const COUNTRY_U = new Set(["switzerland", "netherlands", "sweden", "norway", "greece", "austria", "belgium", "portugal", "ireland", "new-zealand", "israel", "singapore", "cuba", "denmark", "finland", "czech-republic", "hungary", "chile", "uk", "poland", "ukraine", "peru", "venezuela", "colombia", "morocco"]);

export function markOf(e, aspects) {
  if (R.OVERRIDE[e.id]) return R.OVERRIDE[e.id];
  const n = R.norm(e.name), has = s => e.sets.includes(s), prefix = p => e.sets.some(s => s === p || s.startsWith(`${p}:`));
  if (e.sets.some(s => PERSON.test(s)) && R.LIVING.has(n)) return R.LIVING_OK.has(n) ? "u" : "l";
  if (R.PERSONAL_SETS.some(prefix)) return "p";
  if (has("commodity")) return R.STAPLES.has(e.id) ? "u" : R.REGIONAL_COMMODITIES.has(e.id) ? "r" : "p";
  if (R.PERSONAL.has(n)) return "p";
  if (has("country")) return (e.population ?? 0) >= 40 || (e.area ?? 0) >= 2e6 || COUNTRY_U.has(e.id) ? "u" : (e.population ?? 0) >= 5 || (e.area ?? 0) >= 100000 ? "r" : "s";
  if (has("museum")) return MUSEUM_U.some(x => n.startsWith(x)) ? "u" : MUSEUM_R.some(x => n.includes(x)) ? "r" : "s";
  if (has("people-place")) return BIRTH_U.test(e.id) ? "u" : "r";
  if (R.CITIES.has(n) && ["city", "kind:place", "china-place", "geo-place"].some(prefix)) return "u";
  if (R.UNIVERSAL.has(n)) return "u";
  if (R.REGIONAL.has(n)) return "r";
  for (const [s, m] of R.SET_DEFAULT) if (prefix(s)) return m;
  const kind = e.sets.find(s => s.startsWith("kind:"));
  if (kind) {
    const a = aspects.get(e.id);
    let trade = 0, all = 0;
    for (const [k, v] of a || []) { all += v; if (R.TRADE_ASPECTS.has(k)) trade += v; }
    return all && trade * 2 >= all ? "p" : "s";
  }
  return "s";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ENTITIES } = await import(pathToFileURL(path.join(root, "kb/entities.js")).href);
  const { LINKS } = await import(pathToFileURL(path.join(root, "kb/links.js")).href);
  const have = !process.argv.includes("--redo") && fs.existsSync(file) ? (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).ENTITY : {};
  const aspects = new Map();
  for (const l of LINKS) if (l.rel === "clue") for (const a of l.aspects) { const m = aspects.get(l.from) || aspects.set(l.from, new Map()).get(l.from); m.set(a, (m.get(a) || 0) + 1); }
  const out = {};
  const promote = process.argv.includes("--theme");
  const dealtMark = upgraded;
  for (const e of ENTITIES) out[e.id] = have[e.id] === undefined ? dealtMark(e, markOf(e, aspects)) : promote ? dealtMark(e, have[e.id]) : have[e.id];
  const list = process.argv.indexOf("--list");
  if (list > 0) { const m = process.argv[list + 1]; console.log(ENTITIES.filter(e => out[e.id] === m).map(e => e.name).join("; ")); process.exit(0); }
  const body = Object.entries(out).map(([id, m]) => `${JSON.stringify(id)}: "${m}"`);
  const rows = []; for (let i = 0; i < body.length; i += 6) rows.push(`  ${body.slice(i, i + 6).join(", ")}`);
  const prior = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("export const ENTITY")[0] : `// The audit's marks (docs/the-knowledge-base.md, "Who the games ask about"): one for every entity in entities.js.
// u universal (taught in at least 8 of the 15 national school systems), r regional (3 to 7), s specialist (fewer than 3),
// p personal (Korbi's trade and market material), l living (not dealt unless on the short list). Change a call by changing its
// letter here; nothing is deleted from kb/. tools/audit-marks.mjs filled it from tools/audit-rules.mjs and only adds new entities.
`;
  fs.writeFileSync(file, `${prior}export const ENTITY = {\n${rows.join(",\n")}\n};\n`);
  const c = {}; for (const m of Object.values(out)) c[m] = (c[m] || 0) + 1;
  console.log(JSON.stringify(c), Object.keys(out).length);
}
