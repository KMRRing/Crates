// Settle's levels (settle-levels.js): nine, three to a guild's tier; each deals its melt from its seed and carries the plan a
// search found (settle-solve.js), replayed here to win at exactly its par; stars, the order the levels open in, and the
// Random and Daily melts, which must be winnable by the bot, the same on every device, and of one metal family.
import { newGame, pour, skim, valid } from "../settle-engine.js";
import { RECIPES, TIERS } from "../settle-alloys.js";
import { playOut } from "../settle-solve.js";
import { LEVELS, levelOf, specOf, starsFor, isOpen, randomSpec, dailySpec } from "../settle-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const step = (s, [slot, c]) => (slot < 0 ? skim(s, c) : pour(s, slot, c)).state;

check(LEVELS.length === 9 && LEVELS.every((l, k) => l.id === k + 1 && levelOf(l.id) === l) && TIERS.every(t => LEVELS.filter(l => l.tier === t.id).length === 3), "nine levels, numbered in order, three to a tier");

// ---------- every level, replayed ----------
{
  const problems = [];
  for (const L of LEVELS) {
    const t = TIERS.find(x => x.id === L.tier);
    if (!L.orders.every(id => t.orders.includes(id)) || L.cols !== t.cols || L.height > t.height) problems.push(`${L.id}: the tier`);
    let s = newGame(specOf(L), L.seed);
    if (L.plan.length !== L.par || s.tanks.some(x => x.length)) problems.push(`${L.id}: the numbers`);
    let won = -1;
    L.plan.forEach((m, k) => { if (s.over) return; s = step(s, m); if (s.won && won < 0) won = k + 1; });
    if (!(s.won && won === L.par && s.pours === L.par && s.casts >= L.goal)) problems.push(`${L.id}: the plan wins at turn ${won}`);
    if (starsFor(L, L.par) !== 3 || starsFor(L, Math.ceil(L.par * 4 / 3)) !== 2 || starsFor(L, L.par * 2) !== 1) problems.push(`${L.id}: stars`);
    const bot = playOut(newGame(specOf(L), L.seed), 150);
    if (!bot.won) problems.push(`${L.id}: the bot, seeing two parcels, does not win`);
  }
  check(!problems.length, `every level fits its tier, its plan wins at its par and the bot wins it${problems.length ? `: ${problems.join("; ")}` : ""}`);
  check(LEVELS.filter(l => l.tier === 3).every(l => newGame(specOf(l), l.seed).burn) && LEVELS.filter(l => l.tier < 3).every(l => !newGame(specOf(l), l.seed).burn), "zinc, and so burning, only in the brass tier");
}

// ---------- stars and the order ----------
{
  check(starsFor({ par: 6 }, 6) === 3 && starsFor({ par: 6 }, 8) === 2 && starsFor({ par: 6 }, 9) === 1, "three stars at par, two within a third more, else one");
  check(isOpen(1, {}) && !isOpen(2, {}) && isOpen(2, { 1: { stars: 1 } }) && !isOpen(3, { 1: { stars: 3 } }), "the first level is open; each next one once the one before has a star");
}

// ---------- Random and Daily ----------
{
  const family = id => (RECIPES[id].parts.Sn ? "p" : "b");
  const problems = [];
  let won = 0, total = 0;
  for (const L of LEVELS) for (let seed = 1; seed <= 6; seed++) {
    const spec = randomSpec(L.id, seed), again = randomSpec(L.id, seed);
    if (JSON.stringify(spec) !== JSON.stringify(again)) problems.push(`random ${L.id}/${seed}: not repeatable`);
    if (new Set(spec.orders.map(family)).size !== 1 || spec.orders.some(id => RECIPES[id].w > spec.cols)) problems.push(`random ${L.id}/${seed}: orders`);
    const s = playOut(newGame(spec, seed), 150);
    total++; if (s.won) won++;
  }
  check(!problems.length && won === total, `random melts are repeatable, of one family, and the bot wins ${won} of ${total}${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`);
  let dw = 0;
  const days = Array.from({ length: 30 }, (_, k) => 20261101 + k);
  for (const d of days) {
    const { spec, seed } = dailySpec(d), again = dailySpec(d);
    if (JSON.stringify(spec) !== JSON.stringify(again.spec) || seed !== again.seed || new Set(spec.orders.map(family)).size !== 1) problems.push(`daily ${d}`);
    if (playOut(newGame(spec, seed), 150).won) dw++;
  }
  check(!problems.length && dw === days.length, `daily melts are the same each time they are asked for, and the bot wins ${dw} of ${days.length}`);
  check(JSON.stringify(dailySpec(20261101).spec) !== JSON.stringify(dailySpec(20261102).spec) || dailySpec(20261101).seed !== dailySpec(20261102).seed, "another day, another melt");
  check(valid(JSON.parse(JSON.stringify(newGame(dailySpec(20261101).spec, 5)))), "a melt saved as JSON is taken again");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle levels: plans replayed at par, stars, order, random and daily");
