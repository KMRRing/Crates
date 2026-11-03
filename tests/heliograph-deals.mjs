// Heliograph's levels are dealt from heliograph-seeds.js: for each level, seeds of chandeliers the engine's simple player
// ("best", the one that looks at every aim) wins, so a level is never out of reach and starts at once. This plays every one
// of them out, so it takes a while (tests/heliograph-levels.mjs has the quick checks). After a change to the engine, to the
// simple player or to a level's rules the list is stale: `node tests/heliograph-deals.mjs --find` writes a new one
// (heliograph-seeds.js), and this test then passes again. Run: node tests/heliograph-deals.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { newGame } from "../heliograph-engine.js";
import { LEVELS, rulesOf, played, dealt } from "../heliograph-levels.js";
import { SEEDS } from "../heliograph-seeds.js";

const EACH = 8;          // deals kept for a level: a level played again deals another, and comes round again after a few
const won = (n, seed) => played(newGame(seed, rulesOf(n))).won === true;

if (process.argv.includes("--find")) {
  const rows = LEVELS.map(L => {
    const seeds = [];
    for (let seed = 101 + L.n * 1000, tried = 0; seeds.length < EACH && tried < 400; seed += 13, tried++) if (won(L.n, seed)) seeds.push(seed);
    console.log(`${L.n + 1} ${L.name}: ${seeds.length}`);
    return `  [${seeds.join(", ")}],`;
  });
  const url = new URL("../heliograph-seeds.js", import.meta.url);
  const head = readFileSync(url, "utf8").split("export const SEEDS")[0];
  writeFileSync(url, `${head}export const SEEDS = [\n${rows.join("\n")}\n];\n`);
  console.log("heliograph-seeds.js written");
  process.exit(0);
}

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(SEEDS.length === LEVELS.length && SEEDS.every(l => l.length === EACH && new Set(l).size === EACH), `every level has ${EACH} deals of its own`);
const lost = [];
for (const L of LEVELS) for (const seed of SEEDS[L.n] || []) if (!won(L.n, seed)) lost.push(`${L.n + 1} ${L.name} (${seed})`);
check(!lost.length, lost.length ? `deals the simple player does not win (run with --find): ${lost.join(", ")}` : `every one of the ${LEVELS.length * EACH} deals is won by the simple player`);
// the search that finds them, which a level falls back on without a list: a level is dealt as the first of the seeds from one that is won
const d = dealt(0, 3), e = dealt(23, 3);
check(d.ok && e.ok && d.tries >= 1 && won(0, 3 + (d.tries - 1) * 7919) && won(23, 3 + (e.tries - 1) * 7919), "the search finds a deal the simple player wins");

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
