// Nonogram's payoff when a picture is done and named: one thing to know of it (a note, a clue Crates asks, a place Chart
// pins, or who it borders) for every picture of every kind, kept to what the Settings subjects allow and what is not
// marked for removal; and the rings the little globe lights.
// Run: node tests/nonogram-fact.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const F = await import("../nonogram-fact.js");
const P = await import("../nonogram-pictures.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };

const facts_ = new Map();
const await_ = p => facts_.get(p.id);
const kinds = ["countries", "flags", "lakes", "regions"];
for (const topic of kinds) {
  const list = P.PICTURES.filter(p => p.topic === topic), facts = [];
  for (const p of list) { const t = await F.factFor(p); facts.push(t); facts_.set(p.id, t); }
  check(facts.every(t => t && t.length > 8 && t.length < 190 && /[.!?…]$/.test(t)), `${topic}: every one of ${list.length} has a fact that is a sentence, short enough for two lines`);
}
// a country with no clue and no place of its own gets who it borders, which its outline shows
const chad = P.pictureOf("c-chad");
check(/^Borders .*Libya.*Sudan/.test(await F.factFor(chad)), "Chad (nothing written of it) is told by its neighbours");
// the subjects: with every aspect off, no clue of Crates' is shown, and none marked for removal ever is
const off = new Proxy({}, { get: () => 0 });
const france = P.pictureOf("c-france");
check(!/Tour de France/.test(await F.factFor(france, { mix: off })), "a clue about a subject that is off is not the one shown");
const seen = new Set();
for (const p of P.PICTURES.filter(p => p.topic === "countries")) seen.add(await F.factFor(p));
check(seen.size > 100, `the facts differ from country to country (${seen.size} different)`);
// the rings the globe lights
for (const topic of ["countries", "lakes", "regions"]) check(P.PICTURES.filter(p => p.topic === topic).every(p => P.ringsOf(p)?.length), `${topic}: every picture has rings to light on the globe`);
const flat = P.PICTURES.filter(p => p.topic === "flags" && !P.ringsOf(p)?.length);
check(flat.length < 40 && flat.every(p => await_(p)), `flags: only the countries too small for the map (${flat.length}) have no globe, and each still has a fact`);
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
