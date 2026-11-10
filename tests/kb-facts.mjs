// Every knowledge game asks about facts kb/ holds (kb/graph.js: one id per fact, the same in every game), so what you learn
// in one game is what another asks you again (Korbi, 10 Nov 2026). For each game, how many of its questions name a fact
// kb/ holds; a floor per game that only rises (knowledge moves into kb/, never out); and every fact a bank names is one
// kb/ holds. The table it prints is the list of what is still to move in.
import fs from "node:fs";
import { makeGraph, linkFact, fieldFact, stepFact } from "../kb/graph.js";
const { ENTITIES } = await import("../kb/entities.js");
const { LINKS } = await import("../kb/links.js");
const g = makeGraph(ENTITIES, LINKS);
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rows = [];                                   // [game, what it asks, asked, held]
const count = (game, what, items, factsOf) => {
  const held = items.filter(x => { const f = factsOf(x); return f.length && f.every(id => g.holds(id)); }).length;
  rows.push([game, what, items.length, held]);
};
const named = q => q.facts || [];

// Crates' clue pairs (Crates; Lode, Crossword and Origin deal the same pairs)
const raw = JSON.parse(Buffer.from(/CRATES_BANK = "([^"]+)"/.exec(fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))[1], "base64").toString("utf8"));
count("Crates, Lode, Crossword, Origin", "clue pairs", raw.flatMap(a => a.w.map(w => [w[6], a.e])), ([clue, answer]) => [linkFact(clue, "clue", answer)]);

// Punt's knowledge banks; the rest of its levels teach a method, not facts about things
const KNOWLEDGE = ["art", "cities", "flags", "refining", "swiss", "arch", "myth", "merchants", "titles", "bavaria", "britain", "china", "skiing", "lit", "sayings", "law", "wine"];
const METHOD = ["maths", "patterns", "reasoning", "words", "eco", "phy", "chm", "cs", "phil", "rel"];
for (const b of KNOWLEDGE) count("Punt", b, (await import(`../${b}-bank.js`)).MATHS, named);

// Quote's numbers (Order deals its dates and quantities from them), Order's stories, Chart's places
const { QUOTES } = await import("../quote-bank.js");
count("Quote, Order", "numbers and dates", QUOTES, named);
const { SEQUENCES } = await import("../order-bank.js");
count("Order", "story steps", SEQUENCES.flatMap(s => s.steps.map((_, i) => stepFact(`story-${s.id}`, i + 1))), f => [f]);
const { PLACES } = await import("../chart-bank.js");
count("Chart", "places", PLACES, named);

// Census, Dispatch, Crossing: their data lives in the game; kb/ holds it as links and steps (tools/games-to-kb.mjs)
const { SETS } = await import("../census-sets.js");
const membersOf = new Map();
for (const l of LINKS) if (l.rel === "member-of") (membersOf.get(l.to) || membersOf.set(l.to, []).get(l.to)).push(l.from);
count("Census", "set members", SETS.flatMap(s => (membersOf.get(`set-${s.id}`) || []).slice(0, s.items.length).map(m => linkFact(m, "member-of", `set-${s.id}`))
  .concat(Array(Math.max(0, s.items.length - (membersOf.get(`set-${s.id}`) || []).length)).fill(null))), f => (f ? [f] : []));
const { MEETINGS } = await import("../dispatch-bank.js");
const meetingAt = new Map(ENTITIES.flatMap(e => (e.meetings || []).map(m => [m.id, e.id])));
count("Dispatch", "meetings", MEETINGS, x => (meetingAt.has(x.id) ? [stepFact(meetingAt.get(x.id), x.id)] : []));
const { LANES, PORTS, INLAND } = await import("../crossing-sea-data.js");
const { COUNTRIES } = await import("../chart-countries.js");
const has = rel => LINKS.filter(l => l.rel === rel).length;
const idOf = new Map(COUNTRIES.map(c => [c.name, c.about])), pairs = new Set();
for (const c of COUNTRIES) for (const n of c.neighbours) { const o = idOf.get(n); if (c.about && o) pairs.add([c.about, o].sort().join("|")); }
const lanes = LANES.length, reach = INLAND.reduce((n, p) => n + p[4].length, 0);
count("Crossing", "land borders", [...pairs], p => { const [a, b] = p.split("|"); return [g.holds(linkFact(a, "borders", b)) ? linkFact(a, "borders", b) : linkFact(b, "borders", a)]; });
rows.push(["Crossing", "sea lanes", lanes, Math.min(lanes, has("sea-lane"))],
  ["Crossing", "ports", PORTS.length, Math.min(PORTS.length, has("port-on"))], ["Crossing", "inland routes", reach, Math.min(reach, has("inland-of"))]);

// pictures and outlines: Spyglass and Nonogram show a thing and ask which it is
const byId = g.byId;
count("Spyglass, Nonogram", "flags", COUNTRIES.filter(c => c.about), c => [fieldFact(c.about, "flag")]);
count("Spyglass, Nonogram", "country outlines", COUNTRIES.filter(c => c.about), () => []);
count("Spyglass", "paintings and buildings", ENTITIES.filter(e => e.pic && (e.sets.includes("painting") || e.sets.includes("building"))), e => [fieldFact(e.id, "pic")]);

// held outside kb/ entirely
const { CATEGORIES } = await import("../lots-bank.js");
rows.push(["Lots", "categories", CATEGORIES.length, 0]);
const decoy = await import("../party-decoy-bank.js");
count("Decoy", "sayings", decoy.SAYINGS, s => [fieldFact(s.id, "meaning")]);
rows.push(["Decoy", "odd facts", decoy.FACTS.length, 0]);

// the table, and the floors: a game's held count never drops (raise its floor when knowledge moves in)
const FLOOR = {
  "Crates, Lode, Crossword, Origin/clue pairs": 1292, "Punt/swiss": 44, "Punt/refining": 25, "Punt/art": 765, "Punt/cities": 415, "Punt/flags": 123, "Punt/arch": 201, "Punt/myth": 127,
  "Punt/merchants": 84, "Punt/titles": 30, "Punt/bavaria": 69, "Punt/britain": 51, "Punt/china": 60, "Punt/skiing": 92, "Punt/lit": 705,
  "Punt/sayings": 186, "Punt/law": 192, "Quote, Order/numbers and dates": 810, "Order/story steps": 329, "Chart/places": 676, "Census/set members": 500,
  "Dispatch/meetings": 146, "Spyglass, Nonogram/flags": 168, "Spyglass/paintings and buildings": 277, "Decoy/sayings": 245, "Crossing/land borders": 307,
};
let asked = 0, held = 0;
for (const [game, what, n, h] of rows) {
  asked += n; held += h;
  console.log(`     ${`${game}: ${what}`.padEnd(48)} ${String(h).padStart(5)} of ${String(n).padStart(5)}${h < n ? `   ${n - h} not yet in kb/` : ""}`);
}
console.log(`     ${"all knowledge games".padEnd(48)} ${String(held).padStart(5)} of ${String(asked).padStart(5)} (${Math.round((100 * held) / asked)}%); Punt's ${METHOD.join(", ")} teach a method and aren't counted`);
const low = Object.entries(FLOOR).filter(([k, f]) => { const r = rows.find(([game, what]) => `${game}/${what}` === k); return !r || r[3] < f; });
check(!low.length, low.length ? `no game holds fewer facts than it did: ${low.map(([k]) => k).join(", ")}` : "no game holds fewer facts in kb/ than its floor");

// every fact a bank names is one kb/ holds
const dangling = [];
for (const b of KNOWLEDGE) for (const q of (await import(`../${b}-bank.js`)).MATHS) for (const f of named(q)) if (!g.holds(f)) dangling.push(`${b} ${q.id}: ${f}`);
for (const q of [...QUOTES, ...PLACES]) for (const f of named(q)) if (!g.holds(f)) dangling.push(`${q.id}: ${f}`);
check(!dangling.length, dangling.length ? `facts the banks name that kb/ doesn't hold: ${dangling.slice(0, 6).join("; ")}` : "every fact a bank names is held in kb/");
process.exit(bad ? 1 : 0);
