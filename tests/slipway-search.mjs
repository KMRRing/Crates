// The proof of every par in Slipway: the exhaustive search over every use of the level's tools (slipway-puzzle.js search)
// finds nothing shorter than the par, for the curated parts and for the parts the generator makes (slipway-gen.js). A full
// proof takes about a minute, so a push proves a rotating slice (the day's), and the whole set runs with SLIPWAY_ALL=1
// (the nightly run, and before a change to the rules or the generator). A generated part also has to be the same on every
// phone: the same seed, the same part.
import { LEVELS, CHAPTERS } from "../slipway-levels.js";
import { generate } from "../slipway-gen.js";
import { search, play, status, usesOf } from "../slipway-puzzle.js";
import { today } from "../days.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ALL = !!process.env.SLIPWAY_ALL, slice = today() % 8;

// ---------- the curated parts ----------
{
  const set = ALL ? LEVELS : LEVELS.filter((_, i) => i % 8 === slice);
  for (const L of set) {
    const r = search(L, L.solution.place || L.place, L.par);
    check(r && r.best === L.par, `${L.name}: nothing shorter than its par ${L.par} (${r ? r.orders : 0} orders solve it)`);
  }
}

// ---------- the generated parts ----------
{
  const seeds = ALL ? Array.from({ length: 150 }, (_, i) => i + 1) : Array.from({ length: 4 }, (_, i) => 1000 * slice + i + 1);
  let worst = 0;
  for (const seed of seeds) {
    const reach = 1 + (seed % 6), L = generate(seed, CHAPTERS, reach);
    const r = search(L, undefined, L.par), p = play(L);
    worst = Math.max(worst, r?.orders || 0);
    check(r && r.best === L.par && p.results.every(x => x.ok) && status(p.b).solved && usesOf(p.used) === L.par, `seed ${seed} (${reach} chapters): ${L.name}, par ${L.par}, proven (${r ? r.orders : 0} orders)`);
  }
  check(true, `(the most orders of any: ${worst})`);
  const a = generate(77, CHAPTERS, 6), b = generate(77, CHAPTERS, 6);
  check(JSON.stringify(a.solution) === JSON.stringify(b.solution) && a.size.join() === b.size.join() && a.par === b.par, "the same seed makes the same part");
  check(generate(78, CHAPTERS, 6).size.join() !== a.size.join() || generate(79, CHAPTERS, 6).name !== a.name || generate(80, CHAPTERS, 6).par !== a.par, "and another seed another");
}

// ---------- the fortnight's dailies: the day is the seed, with every chapter open ----------
if (ALL) {
  for (let k = 0; k < 14; k++) {
    const day = today(new Date(Date.now() + k * 864e5)), L = generate(day, CHAPTERS, 6), r = search(L, undefined, L.par);
    check(r && r.best === L.par, `daily ${day}: ${L.name}, par ${L.par}, proven (${r ? r.orders : 0} orders)`);
  }
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
else console.log("slipway search: no part has a shorter way than its par");
