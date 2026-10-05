// The knowledge base: the banks the games read are current with kb/ (built from it, nothing edited by hand), and kb/
// holds together: unique ids, every link and item pointing at entities that exist, Crates' answers and clue lists in
// unbroken append-only order, every pin on a place with a position, every painting with its painter. The counts are
// the floor set by the move into kb/: knowledge only grows, so a smaller number means something was lost.
import fs from "node:fs";
import { build, render } from "../tools/build-kb.mjs";
const { ENTITIES } = await import("../kb/entities.js");
const { LINKS } = await import("../kb/links.js");
const { GEOMETRY } = await import("../kb/geometry.js");
const { PINS, FEATURES } = await import("../kb/items/pins.js");
const { ESTIMATES } = await import("../kb/items/estimates.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const E = new Map(ENTITIES.map(e => [e.id, e]));

const files = await render(await build());
const stale = Object.entries(files).filter(([f, text]) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8") !== text).map(([f]) => f);
check(!stale.length, `every bank is built from kb/ and current (${Object.keys(files).length} banks)${stale.length ? `: stale ${stale.join(", ")}` : ""}`);

check(E.size === ENTITIES.length, `${ENTITIES.length} entities, every id unique`);
const missing = LINKS.flatMap(l => [l.from, l.to, ...(l.alt || [])]).filter(id => !E.has(id));
check(!missing.length, `${LINKS.length} links, every end an entity${missing.length ? `: missing ${[...new Set(missing)].slice(0, 5)}` : ""}`);
const items = [...PINS, ...FEATURES, ...ESTIMATES.filter(q => q.about)];
check(items.every(i => E.has(i.about)), `${items.length} pins and estimates, each about an entity that exists`);
const answers = ENTITIES.filter(e => e.crates !== undefined).sort((a, b) => a.crates - b.crates);
check(answers.every((e, i) => e.crates === i) && answers.every(e => e.sets.includes("country") !== e.sets.includes("commodity") && e.sets.some(s => s.startsWith("group:"))),
  `Crates' ${answers.length} answers in unbroken board order, each a country or a commodity with its group`);
const clueLists = new Map();
for (const l of LINKS) if (l.rel === "clue") (clueLists.get(l.to) || clueLists.set(l.to, []).get(l.to)).push(l.pos);
check([...clueLists.values()].every(ps => ps.sort((a, b) => a - b).every((p, i) => p === i)) && LINKS.filter(l => l.rel === "clue").every(l => l.hint && l.aspects?.length && l.d >= 1 && E.get(l.to).crates !== undefined && (l.alt || []).every(id => E.get(id).crates !== undefined)),
  "every clue links to an answer with its hint, aspects and difficulty, in unbroken list order");
check([...PINS, ...FEATURES].every(p => { const e = E.get(p.about); return Number.isFinite(p.lat ?? e.lat) && Number.isFinite(p.lon ?? e.lon); }) && FEATURES.every(f => GEOMETRY[f.about]),
  "every pin is on a place with a position, every feature has its shape");
const paintings = ENTITIES.filter(e => e.sets.includes("painting"));
check(paintings.every(p => LINKS.some(l => l.from === p.id && l.rel === "painted-by") && Number.isFinite(p.year) && p.pic), `${paintings.length} paintings, each with its painter, year and picture`);
// the questions the knowledge base writes: every painting is asked in Punt (who, where, movement) and Quote (its year),
// by hand or by the build (where it hangs, when it hangs anywhere); every museum Chart can place has its pin
{
  const { MATHS: ART } = await import("../art-bank.js");
  const { QUOTES } = await import("../quote-bank.js");
  const { PLACES } = await import("../chart-bank.js");
  const asked = new Set(ART.flatMap(q => (q.about || []).map(id => `${id}:${q.lv}`)));
  const dated = new Set(QUOTES.filter(q => q.unit === "year" && q.about).map(q => q.about));
  const pinned = new Set(PLACES.map(p => p.about));
  // a painting with no museum (a private collection, stolen, in many versions) has no "where" to ask
  const hangs = new Set(LINKS.filter(l => l.rel === "hangs-in").map(l => l.from));
  const all = paintings.every(p => ["who", "when", ...(hangs.has(p.id) ? ["where"] : [])].every(lv => asked.has(`${p.id}:${lv}`)) && dated.has(p.id));
  const gen = ART.filter(q => q.id.startsWith("AR-G-"));
  const fair = gen.every(q => q.o.length === 4 && new Set(q.o).size === 4 && q.a.length === 1 && q.o[q.a[0]] !== undefined);
  check(all && fair && ENTITIES.filter(e => e.sets.includes("museum") && e.lat !== undefined).every(m => pinned.has(m.id)),
    `every painting asked in Punt and Quote (${gen.length} questions written by the build, each with four different options), every museum with a position pinned in Chart`);
}
const floor = { entities: 4396, clue: 5526, pins: 415, features: 172, estimates: 355 };
const now = { entities: ENTITIES.length, clue: LINKS.filter(l => l.rel === "clue").length, pins: PINS.length, features: FEATURES.length, estimates: ESTIMATES.length };
check(Object.entries(floor).every(([k, v]) => now[k] >= v), `nothing lost since the move: ${Object.entries(now).map(([k, v]) => `${v} ${k}`).join(", ")}`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
