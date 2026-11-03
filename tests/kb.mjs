// The knowledge base: the banks the games read are current with kb/ (built from it, nothing edited by hand), and kb/
// holds together: unique ids, every link and item pointing at entities that exist, Crates' answers and clue lists in
// unbroken append-only order, every pin on a place with a position, every painting with its painter. The counts are
// the floor set by the move into kb/: knowledge only grows, so a smaller number means something was lost.
import fs from "node:fs";
import { build, render, DEALT } from "../tools/build-kb.mjs";
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
check(!stale.length, `every bank is built from kb/ and current (${Object.keys(files).length} banks)${stale.length ? `: stale ${stale.join(", ")}; a bank edited by hand is brought into kb/ by node tools/adopt-banks.mjs (rebuilding would undo the edit)` : ""}`);

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
// an aspect no game knows ("history" for hist, once) is a clue no choice of topics reaches: in whatever the mix
{
  const { KB_TOPICS } = await import("../topics.js");
  const known = new Set([...KB_TOPICS.country, ...KB_TOPICS.commodity].map(([id]) => id));
  const odd = LINKS.filter(l => (l.aspects || []).some(a => !known.has(a)));
  check(!odd.length, `every link's aspects are topics the games deal by${odd.length ? `: ${odd.slice(0, 3).map(l => `${l.from} → ${l.to} ${JSON.stringify(l.aspects)}`).join("; ")}` : ""}`);
}
check([...PINS, ...FEATURES].every(p => { const e = E.get(p.about); return Number.isFinite(p.lat ?? e.lat) && Number.isFinite(p.lon ?? e.lon); }) && FEATURES.every(f => GEOMETRY[f.about]),
  "every pin is on a place with a position, every feature has its shape");
const paintings = ENTITIES.filter(e => e.sets.includes("painting"));
check(paintings.every(p => LINKS.some(l => l.from === p.id && l.rel === "painted-by") && Number.isFinite(p.year) && p.pic), `${paintings.length} paintings, each with its painter, year and picture`);
// the questions the knowledge base writes: every painting is asked in Punt (who, where, movement) and Quote (its year),
// by hand or by the build (where it hangs, when it hangs anywhere); every museum Chart can place has its pin
{
  const { MATHS: ART } = await import("../art-bank.js");
  const QUOTES = await import("../quote-bank.js").then(m => [...m.QUOTES, ...m.RETIRED]);   // asked: dealt or kept as too niche to deal
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
// the numbers a thing carries (kb/measures.js): each a positive figure on a thing of the set it's for, asked once in Quote
// (by hand, or written by the build with the figure as its truth); a figure no measure knows is a typo in a key
{
  const { MEASURES } = await import("../kb/measures.js");
  const { UNITS } = await import("../kb/units.js");
  const QUOTES = await import("../quote-bank.js").then(m => [...m.QUOTES, ...m.RETIRED]);
  const strays = ENTITIES.flatMap(e => Object.keys(e).filter(k => ["area", "population", "depth", "length", "top"].includes(k) && !MEASURES.some(m => m.key === k && e.sets.includes(m.set))).map(k => `${e.id}.${k}`));
  check(!strays.length, `a figure only on a thing its measure is for${strays.length ? `: ${strays.slice(0, 4)}` : ""}`);
  const carried = MEASURES.flatMap(m => ENTITIES.filter(e => e.sets.includes(m.set) && e[m.key] !== undefined).map(e => ({ m, e })));
  // the built bank keeps what a question is about but not which fact; a hand-written one says so in kb/, a built one in its id
  const byId = new Map(QUOTES.map(q => [q.id, q]));
  const asked = new Map([...ESTIMATES.filter(q => q.about && q.fact).map(q => [`${q.about}:${q.fact}`, byId.get(q.id)]),
    ...carried.filter(({ m, e }) => byId.has(`mq-${m.key}-${e.id}`)).map(({ m, e }) => [`${e.id}:${m.key}`, byId.get(`mq-${m.key}-${e.id}`)])]);
  check(carried.every(({ m, e }) => Number.isFinite(e[m.key]) && e[m.key] > 0), `${carried.length} figures, each a positive number`);
  const unasked = carried.filter(({ m, e }) => !asked.has(`${e.id}:${m.key}`));
  check(!unasked.length, `every figure is a question in Quote${unasked.length ? `: not ${unasked.slice(0, 4).map(({ e, m }) => `${e.id}.${m.key}`)}` : ""}`);
  const wrong = carried.filter(({ m, e }) => { const q = asked.get(`${e.id}:${m.key}`); return q && (q.truth !== e[m.key] || q.unit !== m.unit); });
  check(!wrong.length, `a question's truth is the thing's figure, in the measure's unit${wrong.length ? `: ${wrong.slice(0, 3).map(({ e, m }) => `${e.id}.${m.key}`)}` : ""}`);
  check(MEASURES.every(m => m.unit === "year" || m.unit in UNITS || m.unit === "million"), "every measure's unit is one Order can line up (kb/units.js)");
  const built = QUOTES.filter(q => q.id.startsWith("mq-"));
  const leaks = built.filter(q => q.q.replace(/,/g, "").includes(String(q.truth)) && q.truth > 99);
  check(built.length >= 500 && new Set(built.map(q => q.id)).size === built.length && !leaks.length, `${built.length} questions written from figures, each once, none naming its own answer`);
  const count = (set, key) => ENTITIES.filter(e => e.sets.includes(set) && e[key] !== undefined).length;
  check(count("country", "area") === ENTITIES.filter(e => e.sets.includes("country")).length && count("country", "population") >= 160 && count("feature:river", "length") >= 55 && count("feature:lake", "area") >= 28 && count("feature:desert", "area") >= 20 && count("feature:range", "top") >= 25,
    `every country has its area; ${count("country", "population")} their population, ${count("feature:river", "length")} rivers their length, ${count("feature:lake", "area")} lakes their area, ${count("feature:desert", "area")} deserts, ${count("feature:range", "top")} ranges their highest summit`);
}
// who Quote may ask (3 November 2026, Korbi on the Garter question: "WAY too specific for a general audience"): every estimate
// carries the mark of its review (1 anyone, 2 a player who chose the subject, 3 too niche), a niche one is in kb/ and in the
// bank's RETIRED but never dealt, and the build's own questions are marked by the entity they are about
{
  const { AUDIENCE } = await import("../kb/items/estimates.js");
  const { QUOTES, RETIRED } = await import("../quote-bank.js");
  const unmarked = ESTIMATES.filter(q => ![1, 2, 3].includes(q.audience));
  check(!unmarked.length, `every one of ${ESTIMATES.length} estimates has its review mark (audience 1, 2 or 3)${unmarked.length ? `: not ${unmarked.slice(0, 5).map(q => q.id)}` : ""}`);
  const dealt = new Set(QUOTES.map(q => q.id)), kept = new Set(RETIRED.map(q => q.id));
  const wrong = ESTIMATES.filter(q => (DEALT.has(q.audience) ? !dealt.has(q.id) : dealt.has(q.id) || !kept.has(q.id)));
  check(!wrong.length, `${ESTIMATES.filter(q => q.audience === 3).length} niche estimates stay in kb/ and in RETIRED, none dealt${wrong.length ? `: wrong ${wrong.slice(0, 5).map(q => q.id)}` : ""}`);
  check(QUOTES.every(q => DEALT.has(q.audience)) && RETIRED.every(q => !DEALT.has(q.audience)) && !QUOTES.some(q => kept.has(q.id)) && new Set([...dealt, ...kept]).size === dealt.size + kept.size,
    `Quote deals ${QUOTES.length} questions and keeps ${RETIRED.length} retired ones, each in one list only, every one marked`);
  const strays = Object.keys(AUDIENCE).filter(id => !E.has(id) || ![2, 3].includes(AUDIENCE[id]));
  check(!strays.length, `the review of the questions the build writes names entities that exist${strays.length ? `: ${strays.slice(0, 5)}` : ""}`);
}
const floor = { entities: 4396, clue: 5526, pins: 415, features: 172, estimates: 355 };
const now = { entities: ENTITIES.length, clue: LINKS.filter(l => l.rel === "clue").length, pins: PINS.length, features: FEATURES.length, estimates: ESTIMATES.length };
check(Object.entries(floor).every(([k, v]) => now[k] >= v), `nothing lost since the move: ${Object.entries(now).map(([k, v]) => `${v} ${k}`).join(", ")}`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
