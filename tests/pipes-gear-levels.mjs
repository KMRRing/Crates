// Gears, the levels played (pipes-gear-book.js) and the campaign being rebuilt (pipes-gear-campaign.mjs): each is parsed, each listed answer
// is solved by the full check, the solver finds exactly the listed answers and no others, and each campaign level carries what its themes say
// (a mechanical one its escape wheel, a tray its spares, a crown its clutch...). Ids are unique and every chapter has a name.
// Run: node tests/pipes-gear-levels.mjs
import { parseLevel, check, emptyLaid } from "../pipes-gear-engine.js";
import { solve } from "../pipes-gear-solve.js";
import { LEVELS as PLAYED, CHAPTERS as PLAYED_CHAPTERS, BOOKS as PLAYED_BOOKS } from "../pipes-gear-book.js";
import { LEVELS, CHAPTERS, BOOKS } from "../pipes-gear-levels.js";
import { PLAN, rulesBroken } from "../pipes-gear-campaign.mjs";
import { sigOf } from "../pipes-gear-book.js";
import { POOL } from "../pipes-gear-pool.js";
import { transformLevel } from "../pipes-gear-legacy.js";
import { dailySpec, randomSpec, bandOf } from "../pipes-gear-daily.js";

let bad = 0;
const ok = (c, what) => { console.log(`${c ? "ok  " : "FAIL"} ${what}`); if (!c) bad++; };
// played while the campaign is rebuilt (12 Nov 2026): Book I's kept levels and the rebuilt chapters, each level in its chapter
ok(PLAYED.length === 42 && new Set(PLAYED.map(l => l.id)).size === 42 && PLAYED.every(l => PLAYED_CHAPTERS.some(c => c.key === l.chapter)) && PLAYED_CHAPTERS.every(c => PLAYED_BOOKS.some(b => b.key === c.book)),
  `${PLAYED.length} levels played, Book I's and Mainspring's, every one in its chapter`);
ok(PLAYED.every(l => LEVELS.some(k => k.id === l.id)), "every level played is in the campaign too, so its stars carry over");
// a rebuilt level meets the plan's rules, and each of its pillars is needed: without it there is a second answer
{
  const w = [];
  LEVELS.forEach((l, i) => {
    if (!l.id.startsWith("r-")) return;
    const broken = rulesBroken(l, PLAN[i]);
    if (broken.length) w.push(`${l.id}: ${broken.join(", ")}`);
    l.map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== "#") return;
      const open = { ...l, map: l.map.map((r, k) => (k === y ? r.slice(0, x) + "." + r.slice(x + 1) : r)) }, s = solve(parseLevel(open), 2, 4e5);
      if (!s.aborted && s.sols.length < 2) w.push(`${l.id}: the pillar at ${y * l.cols + x} is not needed`);
    }));
  });
  ok(!w.length && LEVELS.filter(l => l.id.startsWith("r-")).length >= 6, `the rebuilt levels meet the plan's rules and every pillar counts${w.length ? `: ${w.slice(0, 4).join("; ")}` : ""}`);
}
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
for (const spec of LEVELS) {
  const L = parseLevel(spec);
  for (const sol of spec.sols) {
    const laid = emptyLaid(L);
    for (const [c, p] of Object.entries(sol)) laid[c] = p;
    if (!check(L, laid).solved) why ||= `${spec.id}: a listed answer is not solved`;
  }
  const s = solve(L, 7, 4e6);
  nodes += s.nodes;
  if (!spec.sols.length) why ||= `${spec.id}: no answer`;
  if (s.aborted) why ||= `${spec.id}: the solver gave up`;
  else if (s.sols.length !== spec.sols.length) why ||= `${spec.id}: ${s.sols.length} answers, ${spec.sols.length} listed`;
  else if (spec.sols.length > 6) why ||= `${spec.id}: more than six answers`;
  else {
    const mine = new Set(s.sols.map(x => key(Object.fromEntries(x.laid.map((p, c) => [c, p]).filter(([, p]) => p)))));
    if (!spec.sols.every(o => mine.has(key(o)))) why ||= `${spec.id}: the solver's answers differ from the listed`;
  }
}
ok(!why, `the solver finds exactly the listed answers of all ${LEVELS.length} levels (${nodes} pieces tried, ${Date.now() - t0} ms)${why ? `: ${why}` : ""}`);
ok(LEVELS.length === 100 && CHAPTERS.length === 13, `${LEVELS.length} levels in ${CHAPTERS.length} chapters`);
// 11 Nov 2026, Korbi: each level is a combination of themes, and the data must carry them
{
  const has = (l, t) => (l.themes || []).includes(t), w = [];
  for (const l of LEVELS) {
    const L = parseLevel(l), mech = l.power === "mech";
    if (has(l, "Mechanical") !== mech) w.push(`${l.id} mechanical`);
    if (mech && !L.trains.every(t => t.goal?.type === "escape")) w.push(`${l.id}: a mechanical train ends in its escape wheel`);
    if (has(l, "Spares") !== !!l.spare) w.push(`${l.id} spares`);
    if (has(l, "Turning") !== !!L.rotate) w.push(`${l.id} turning`);
    if (has(l, "Keyless") !== !!L.clutch) w.push(`${l.id} crown`);
    if (has(l, "Branch") && !L.pins.some(p => p.end && p.look !== "barrel")) w.push(`${l.id} branch`);
    if (has(l, "Twin barrels") && !L.pins.some(p => p.end && p.look === "barrel")) w.push(`${l.id} twin barrels`);
    if ((has(l, "Crossing") || has(l, "Layers")) && !L.pins.some(p => p.trains)) w.push(`${l.id} crossing`);
    if (L.trains.length !== (has(l, "Three trains") ? 3 : has(l, "Two pitches") || has(l, "One pitch apart") || has(l, "Crossing") ? 2 : 1)) w.push(`${l.id} trains`);
  }
  ok(!w.length, `every level carries its themes${w.length ? `: ${w.slice(0, 6).join("; ")}` : ""}`);
  const firstMech = LEVELS.findIndex(l => l.power === "mech");
  ok(firstMech === 14, `levels 1 to 14 are quartz and the mainspring arrives at 15 (first mechanical: ${firstMech + 1})`);
}

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
