// Gears, the levels of Books II to V (docs/pipes.md): each is parsed, each listed answer is solved by the full check, and the solver finds
// exactly the listed answers (at most six), no others. Ids are unique and every chapter has a name. Run: node tests/pipes-gear-levels.mjs
import { parseLevel, check, emptyLaid } from "../pipes-gear-engine.js";
import { solve } from "../pipes-gear-solve.js";
import { LEVELS, CHAPTERS, BOOKS, sigOf } from "../pipes-gear-book.js";
import { LEVELS as NEW } from "../pipes-gear-levels.js";
import { POOL } from "../pipes-gear-pool.js";
import { transformLevel } from "../pipes-gear-legacy.js";
import { dailySpec, randomSpec, bandOf } from "../pipes-gear-daily.js";

let bad = 0;
const ok = (c, what) => { console.log(`${c ? "ok  " : "FAIL"} ${what}`); if (!c) bad++; };
const ids = new Set(LEVELS.map(l => l.id));
ok(ids.size === LEVELS.length, `${LEVELS.length} levels with unique ids`);
ok(LEVELS.every(l => CHAPTERS.some(c => c.key === l.chapter)) && CHAPTERS.every(c => BOOKS.some(b => b.key === c.book)), "every level has its chapter and every chapter its book");
ok(new Set(LEVELS.map(sigOf)).size === LEVELS.length, "every level has its own signature");
const t0 = Date.now();
let why = "", nodes = 0;
const prove = (spec, label = spec.id) => {
  const L = parseLevel(spec);
  for (const sol of spec.sols) {
    const laid = emptyLaid(L);
    for (const [c, p] of Object.entries(sol)) laid[c] = p;
    if (!check(L, laid).solved) return `${label}: a listed answer is not solved`;
  }
  return "";
};
const key = o => JSON.stringify(Object.entries(o).sort((a, b) => a[0] - b[0]));
for (const spec of NEW) {
  const L = parseLevel(spec);
  for (const sol of spec.sols) {
    const laid = emptyLaid(L);
    for (const [c, p] of Object.entries(sol)) laid[c] = p;
    if (!check(L, laid).solved) why ||= `${spec.id}: a listed answer is not solved`;
  }
  const s = solve(L, 7, 4e6);
  nodes += s.nodes;
  if (s.aborted) why ||= `${spec.id}: the solver gave up`;
  else if (s.sols.length !== spec.sols.length) why ||= `${spec.id}: ${s.sols.length} answers, ${spec.sols.length} listed`;
  else if (spec.sols.length > 6) why ||= `${spec.id}: more than six answers`;
  else {
    const mine = new Set(s.sols.map(x => key(Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p)))));
    if (!spec.sols.every(o => mine.has(key(o)))) why ||= `${spec.id}: the solver's answers differ from the listed`;
  }
}
ok(!why, `the solver finds exactly the listed answers of all ${NEW.length} levels of Books II to V (${nodes} pieces tried, ${Date.now() - t0} ms)${why ? `: ${why}` : ""}`);

// ---------- the pool of the Daily and Random plates ----------
{
  let w = "", n = 0, nodes2 = 0;
  for (const [band, list] of Object.entries(POOL)) for (const spec of list) {
    n++;
    w ||= prove(spec, `${band} ${spec.id}`);
    const s = solve(parseLevel(spec), 5, 4e6);
    nodes2 += s.nodes;
    if (s.aborted || s.sols.length !== spec.sols.length || s.sols.length > 4) w ||= `${band} ${spec.id}: the solver finds ${s.sols.length} answers, ${spec.sols.length} listed`;
  }
  ok(!w && n >= 90, `all ${n} plates of the pool are proven by the solver, at most four answers each${w ? `: ${w}` : ""}`);
  // the eight turns and mirrors keep every answer: a plate of each band under every one
  let tw = "";
  for (const list of Object.values(POOL)) for (const spec of list) for (let k = 0; k < 8; k++) tw ||= prove(transformLevel(spec, k), `${spec.id} turn ${k}`);
  ok(!tw, `every plate of the pool keeps its answers under all eight turns and mirrors${tw ? `: ${tw}` : ""}`);
  let dw = "";
  for (let day = 20261101; day < 20261131; day++) { const sp = await dailySpec(day); dw ||= prove(sp, `daily ${day}`); if (sp.chapter !== bandOf(day)) dw ||= `${day}: wrong band`; }
  for (let n2 = 0; n2 < 12; n2++) for (const solved of [0, 30, 60]) dw ||= prove(await randomSpec(n2, solved), `random ${n2}`);
  ok(!dw, `thirty days of daily plates and thirty-six random ones are solved by their answers${dw ? `: ${dw}` : ""}`);
  const days = new Set(); for (let day = 20261101; day < 20261131; day++) days.add((await dailySpec(day)).hand + (await dailySpec(day)).map.join(""));
  ok(days.size >= 25, `a month of daily plates has ${days.size} different ones`);
}
if (bad) process.exit(1);
console.log("\nall pipes-gear-levels checks passed");
