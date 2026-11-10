// Census (census-engine.js; its sets are kb/'s, census-bank.js): the sets are whole and their members tell apart, a typed name is judged (forgiven a
// slip, an exact name beating one, an ambiguous slip refused, a repeat noticed), the clock follows the set's size and the level,
// the score is a share, the day's set is the day's. Run: node tests/census.mjs
import { normalize } from "../typing.js";
const E = await import("../census-engine.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };

// ---------- the sets ----------
const COUNTS = { africa: 54, "south-america": 12, "central-america": 7, eu: 27, "eu-capitals": 27, g20: 19, g7: 7, "germany-borders": 9, nordic: 5, alpine: 8, asean: 11, cantons: 26, laender: 16,
  "us-states": 50, canada: 13, australia: 8, "great-lakes": 5, oceans: 5, continents: 7, "seven-summits": 7, planets: 8, "noble-gases": 7, alkali: 6, halogens: 6, "first-20": 20, pgms: 6,
  rainbow: 7, "greek-letters": 24, nato: 26, wonders: 7, "henry-wives": 6, tudors: 6, olympians: 12, muses: 9, tragedies: 10, "first-growths": 5, "bordeaux-grapes": 6, "base-metals": 6 };
check(E.SETS.length === Object.keys(COUNTS).length && E.SETS.every(s => COUNTS[s.id] === s.items.length), `${E.SETS.length} sets, each the size it says (${E.SETS.filter(s => COUNTS[s.id] !== s.items.length).map(s => `${s.id} ${s.items.length}`).join(", ") || "all"})`);
check(new Set(E.SETS.map(s => s.id)).size === E.SETS.length && E.SETS.every(s => E.GROUPS.includes(s.group) && s.title && /\.$/.test(s.ask)), "every set has its own id, a group, a title and a question");
// no two members of a set may answer to the same name (or the typing would not know which was meant)
const clash = [];
for (const s of E.SETS) {
  const seen = new Map();
  s.items.forEach((it, i) => { for (const n of [it.name, ...it.alt]) { const k = normalize(n); if (seen.has(k) && seen.get(k) !== i) clash.push(`${s.id}: ${n}`); seen.set(k, i); } });
}
check(!clash.length, `no name belongs to two members of a set${clash.length ? `: ${clash.slice(0, 5).join("; ")}` : ""}`);
check(E.SETS.every(s => s.items.every(it => it.name === it.name.trim() && it.name.length > 1)), "every member has a name");
const G = (await import("../kb/graph.js")).makeGraph((await import("../kb/entities.js")).ENTITIES, (await import("../kb/links.js")).LINKS);
check(E.SETS.every(s => s.items.every(it => G.holds(it.fact) && it.fact.endsWith(`>member-of>set-${s.id}`))), "every member names the fact it proves: its link to the set in kb/");

// ---------- judging ----------
const africa = E.setOf("africa"), none = new Set();
const j = (set, found, t) => E.judge(set, found, t);
check(j(africa, none, "kenya").kind === "new" && africa.items[j(africa, none, "kenya").index].name === "Kenya", "a name in the set is new the first time (case does not matter)");
check(j(africa, none, "  Côte d'Ivoire ").kind === "new" && j(africa, none, "ivory coast").index === j(africa, none, "cote divoire").index, "accents, spaces and other names are the same member");
check(j(africa, new Set([j(africa, none, "kenya").index]), "Kenya").kind === "again", "a name found already is noticed, not new");
check(j(africa, none, "Narnia").kind === "no" && j(africa, none, "").kind === "blank" && j(africa, none, "   ").kind === "blank", "a name not in the set is no, nothing typed is blank");
check(j(africa, none, "Tanzaina").kind === "new", "a slip of a letter is forgiven (Tanzaina is Tanzania)");
check(j(africa, none, "Niger").index !== j(africa, none, "Nigeria").index && africa.items[j(africa, none, "Niger").index].name === "Niger", "an exact name beats a slip: Niger is Niger, not Nigeria");
check(j(africa, none, "Congo").kind === "new" && africa.items[j(africa, none, "Congo").index].name === "Republic of the Congo" && africa.items[j(africa, none, "DR Congo").index].name === "Democratic Republic of the Congo", "Congo is the republic, DR Congo the democratic one");
check(j(africa, none, "Guinea").kind === "new" && africa.items[j(africa, none, "Guinea").index].name === "Guinea" && africa.items[j(africa, none, "Guinea Bissau").index].name === "Guinea-Bissau", "Guinea, Guinea-Bissau and Equatorial Guinea tell apart");
const tud = E.setOf("tudors");
check(tud.items[j(tud, none, "henry vii").index].name === "Henry VII" && tud.items[j(tud, none, "Henry VIII").index].name === "Henry VIII" && j(tud, none, "Henry VI").kind === "no", "Henry VII and VIII are told apart, and a slip two members could be is refused (Henry VI)");
const cant = E.setOf("cantons");
check(cant.items[j(cant, none, "Geneva").index].name === "Geneva" && j(cant, none, "Genève").index === j(cant, none, "Geneva").index && j(cant, none, "Basel").kind === "no" && j(cant, none, "Appenzell").kind === "no", "Geneva and Genève are one; Basel and Appenzell alone are two cantons each, so neither counts");
// every member's own name and every other name are accepted as exactly that member
let miss = 0;
for (const s of E.SETS) s.items.forEach((it, i) => { for (const n of [it.name, ...it.alt]) { const r = E.judge(s, new Set(), n); if (r.kind !== "new" || r.index !== i) { miss++; if (miss < 6) console.log(`  ${s.id}: "${n}" -> ${JSON.stringify(r)} (wanted ${i})`); } } });
check(miss === 0, "every name of every member is taken as that member");

// ---------- the clock, the score ----------
check(E.secondsFor(E.setOf("central-america"), "medium") === 90 && E.secondsFor(africa, "medium") === 360 && E.secondsFor(E.setOf("muses"), "medium") === 105, "the clock grows with the set: 90 s for seven, 105 for nine, 6 min for Africa");
check(E.secondsFor(africa, "easy") === 540 && E.secondsFor(E.setOf("muses"), "hard") === 70 && E.secondsFor(E.setOf("g7"), "hard") === 60, "Easy gives half as much again, Hard under three quarters");
check(E.percent(africa, 27) === 50 && E.percent(E.setOf("g7"), 7) === 100 && E.starsFor(100) === 3 && E.starsFor(60) === 2 && E.starsFor(59) === 1, "the score is the share found: all is three stars, three in five two");

// ---------- dealing ----------
check(E.dailySet(20261109) === E.dailySet(20261109) && new Set([20261109, 20261110, 20261111, 20261112, 20261113, 20261114].map(d => E.dailySet(d).id)).size >= 4, "a day's set is the same on every deal and differs between days");
const got = new Set(); let seen = [];
for (let i = 0; i < E.SETS.length; i++) { const s = E.dealSet("all", seen, E.rng(i + 1)); got.add(s.id); seen = [s.id, ...seen]; }
check(got.size === E.SETS.length, "dealing in turn comes round every set before repeating one");
check(E.SETS.every(x => x.subject && Array.isArray(x.regions)), "every set has a subject (the suite's list) and its continents");
check(E.dealSet({ subjects: ["art"] }, [], E.rng(2)).subject === "art" && E.dealSet({ region: "oceania" }, [], E.rng(2)).id === "australia" && E.dealSet({ region: "europe", subjects: ["geo"] }, [], E.rng(5)).regions.includes("europe"), "topics and a region choose the pool");
check(E.dealSet({ subjects: [], region: "world" }, [], E.rng(1)) && E.dealSet({ prefer: ["nato"] }, ["nato"], E.rng(1)).id === "nato", "an empty pool deals from everything; a wanted set comes first");
check(E.dealSet("Science", [], E.rng(3)).group === "Science" && E.dealSet("Science", E.SETS.filter(s => s.group === "Science").map(s => s.id), E.rng(3)).group === "Science", "a group deals its own sets, even once all have been seen");
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
