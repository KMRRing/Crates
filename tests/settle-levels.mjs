// Settle's levels (settle-levels.js, made by settle-plan.mjs into settle-book.js): thirty, six to each of five chapters; each replayed by
// the plan the search found, winning at exactly its par within the turns it gives; what each chapter brings is in its levels; stars, the
// order the levels open in, and the Random and Daily melts, which must be winnable by the bot and the same on every device.
import { newGame, act, valid, findBlock } from "../settle-engine.js";
import { CHAPTERS, RECIPES } from "../settle-alloys.js";
import { playOut, columns } from "../settle-solve.js";
import { LEVELS, levelOf, specOf, starsFor, isOpen, randomSpec, dailySpec } from "../settle-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const T0 = Date.now();

// Korbi, 13 November 2026: five chapters, each a metal combination with its own mechanic, like Topple's tables
check(LEVELS.length === 30 && CHAPTERS.length === 5 && CHAPTERS.every(C => LEVELS.filter(L => L.ch === C.id).length === 6) && LEVELS.every((L, k) => levelOf(L.id) === L && L.id === `${L.ch}-${k % 6 + 1}`),
  "thirty levels, six to each of five chapters, in order");
check(LEVELS.every(L => L.tip && L.tip.length <= 190 && L.name), "every level has a name and says its trick");

// ---------- every level, replayed ----------
{
  const problems = [];
  for (const L of LEVELS) {
    const C = CHAPTERS.find(c => c.id === L.ch);
    if (!L.orders.every(id => C.orders.includes(id)) || JSON.stringify(L.feats) !== JSON.stringify(C.feats)) problems.push(`${L.id}: the chapter`);
    if (![...L.deal, ...L.start.flat()].every(m => C.metals.includes(m.replace("!", "")))) problems.push(`${L.id}: a metal from another chapter`);
    let s = newGame(specOf(L));
    if (findBlock(s.tanks, L.orders)) problems.push(`${L.id}: a block ready before the first turn`);
    if (L.plan.length !== L.par || L.limit < L.par + 3) problems.push(`${L.id}: the numbers`);
    let won = -1;
    L.plan.forEach((m, k) => { if (s.over) return; s = act(s, m).state; if (s.won && won < 0) won = k + 1; });
    if (!(s.won && won === L.par && s.pours === L.par && s.casts >= L.goal)) problems.push(`${L.id}: the plan wins at turn ${won}`);
    if (starsFor(L, L.par) !== 3 || starsFor(L, Math.ceil(L.par * 4 / 3)) !== 2 || starsFor(L, L.par * 2) !== 1) problems.push(`${L.id}: stars`);
  }
  check(!problems.length, `every level fits its chapter, starts with nothing ready, and its plan wins at its par within its turns${problems.length ? `: ${problems.join("; ")}` : ""}`);
  // what each chapter brings is in its plans: the pot's tips, the fires, the stirs, charcoal over the zinc, lead through black copper
  const uses = (ch, kind) => LEVELS.filter(L => L.ch === ch).every(L => L.plan.some(m => m[0] === kind));
  check(uses(1, -2) && uses(2, -3) && uses(3, -4), "Solder's plans tip, Pewter's fire, Bronze's stir");
  check(LEVELS.filter(L => L.ch === 4).every(L => [...L.deal, ...L.start.flat()].includes("C")) && LEVELS.filter(L => L.ch === 5).every(L => [...L.deal, ...L.start.flat()].includes("Bk")), "Brass deals charcoal, Silver black copper");
  // 13 November 2026, Korbi: "everything in this column, then the rest" must not win; from a chapter's second level on it does not
  const naive = LEVELS.filter((L, k) => k % 6 > 0 && playOut(newGame(specOf(L)), L.limit, columns).won).map(L => L.id);
  check(!naive.length, `from a chapter's second level on, "everything in this column, then the rest" loses${naive.length ? ` (not ${naive.join(", ")})` : ""}`);
}

// ---------- stars and the order ----------
{
  check(starsFor({ par: 6 }, 6) === 3 && starsFor({ par: 6 }, 8) === 2 && starsFor({ par: 6 }, 9) === 1, "three stars at par, two within a third more, else one");
  check(isOpen("1-1", {}) && !isOpen("1-2", {}) && isOpen("1-2", { "1-1": { stars: 1 } }) && !isOpen("1-3", { "1-1": { stars: 3 } }) && isOpen("2-1", { "1-6": { stars: 1 } }), "the first level is open; each next one once the one before has a star");
}

// ---------- Random and Daily ----------
{
  const r = ["1-1", "3-1", "5-6"].flatMap(id => [1, 2, 3].map(seed => [randomSpec(id, seed), randomSpec(id, seed), id]));
  check(r.every(([a, b, id]) => JSON.stringify(a) === JSON.stringify(b) && levelOf(a.from).ch <= levelOf(id).ch && a.lv === 0), "a random melt is one of the book's levels, of a chapter up to the one reached, the same for the same seed");
  const days = [20261113, 20261114, 20261115], ds = days.map(d => dailySpec(d));
  check(days.every((d, k) => JSON.stringify(dailySpec(d)) === JSON.stringify(ds[k])) && new Set(ds.map(d => d.spec.from)).size > 1 && ds.every(d => +d.spec.from.split("-")[1] > 2), "today's melt is a level of the book after a chapter's first two, the same for everyone, another most days");
  check(valid(JSON.parse(JSON.stringify(newGame(ds[0].spec, 5)))), "a melt saved as JSON is taken again");
}

check(Date.now() - T0 < 5000, `the whole file runs in under five seconds (${Date.now() - T0} ms)`);
if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle levels: plans replayed at par, stars, order, random and daily");
