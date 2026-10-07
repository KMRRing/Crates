// Pipes' engine: levels are repeatable and proven (their routes deliver, their direct lines run dry, a one-product
// board can't reach its far terminal without a pump), two-terminal boards are priced so either pick can be right,
// scrambled boards almost never work by luck, and the pressure rule and the netback hold.
const P = await import("../pipes-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

let problems = 0, built = 0, scrambledWins = 0, detours = 0, lines = 0;
const kinds = {}, picks = { near: 0, far: 0 };
for (let seed = 1; seed <= 10; seed++) for (let n = 1; n <= 20; n++) {
  const lv = P.makeLevel(seed, n), again = P.makeLevel(seed, n);
  const fail = (...why) => { problems++; console.log(...why, "seed", seed, "level", n); };
  built++;
  if (JSON.stringify(lv.tiles) !== JSON.stringify(again.tiles)) fail("not repeatable");
  if (!P.solved(lv).over?.win) fail("the solution doesn't deliver");
  for (const route of lv.routes) if (!P.runWith(lv, P.rotsFor(lv.solution, route)).over?.win) fail("a designed route doesn't deliver");
  for (const d of lv.directs) if (P.runWith(lv, P.rotsFor(lv.solution, d.route)).over?.why !== "pressure") fail("a direct line doesn't run dry");
  detours += lv.directs.length; lines += lv.level.products + (lv.level.separator ? 2 : 0);
  if (!lv.directs.length) fail("no pump detour");
  if (lv.heads.length === 1 && !lv.level.separator && P.reachableDry(lv, lv.heads[0], lv.terminals[0].at)) fail("the far terminal can be reached without a pump");
  if (lv.terminals.some(t => !(t.price > 0))) fail("a terminal without a price");
  if (lv.level.terminals === 2) {
    if (lv.terminals.length !== 2 || !lv.choice) fail("a two-terminal level without its choice");
    else { picks[lv.choice.better]++; if (lv.terminals[0].price <= lv.terminals[1].price) fail("the far terminal doesn't pay more"); }
  }
  lv.tiles.flat().forEach(t => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
  if (lv.level.products === 2 && !lv.tiles.flat().some(t => t.kind === "cross")) fail("a two-product level without a crossing");
  if (lv.level.separator && (!lv.tiles.flat().some(t => t.kind === "separator") || lv.terminals.length !== 2)) fail("a separator level without its separator and two terminals");
  // the trace of the solved board delivers every line; of the scrambled board, it rarely does
  const solvedTiles = lv.tiles.map((row, y) => row.map((t, x) => ({ ...t, rot: lv.solution[y][x] })));
  if (!P.trace(lv, solvedTiles).every(l => l.end === "delivered" || l.end === "separated")) fail("the trace of the solution doesn't deliver");
  if (lv.heads.length !== lv.level.products) fail("heads");
  // as scrambled, the flow usually spills (the player has to work)
  const run = P.newRun(lv);
  for (let i = 0; i < 4000 && !run.over; i++) P.advance(lv, run, 250);
  if (run.over?.win) scrambledWins++;
  if (!run.over) fail("a scrambled run never ends");
}
check(problems === 0, `${built} levels: repeatable; routes deliver; ${detours} detours on ${lines} product lines, every direct line runs dry; one product needs a pump for its far terminal; crossings on two-product levels, separators on theirs, the trace of every solution delivering (tiles: ${JSON.stringify(kinds)})`);
check(picks.near > 0 && picks.far > 0, `two-terminal levels: either terminal can be the better pick (near ${picks.near}, far ${picks.far})`);
check(scrambledWins < built * 0.05, `scrambled boards almost never work by luck (${scrambledWins} of ${built})`);

// the netback: price, less 10 a tile and 40 a pump, plus time; nothing for a spill
{
  const lv = P.makeLevel(4, 2), run = P.solved(lv), s = P.score(lv, run, 30000);
  const expected = lv.terminals[run.reached[0]].price - 10 * run.tilesFilled - 40 * run.pumpsFired + 300;
  check(s.total === Math.max(0, expected) && run.pumpsFired >= 1, `netback: ${s.revenue} − ${s.pipe} pipe − ${s.pumps} pumps + ${s.time} time = ${s.total}`);
  const spilt = P.newRun(lv);
  for (let i = 0; i < 4000 && !spilt.over; i++) P.advance(lv, spilt, 250);
  check(spilt.over?.win || P.score(lv, spilt, 30000).total === 0, "a spill pays nothing");
}
// alone, crude sets off at once; sharing the board with gas, it waits
{
  const one = P.makeLevel(1, 1), r1 = P.newRun(one);
  P.advance(one, r1, 500);
  const two = P.makeLevel(1, P.ACT_LENGTH + 1), r2 = P.newRun(two);   // the first level of act 2: two products
  P.advance(two, r2, 500);
  check(r1.heads[0].progress > 0 && r2.heads.find(h => h.product === "crude").progress === 0, "crude goes at once alone, and waits behind gas when they share the board");
}
// turning: a locked or fixed tile won't turn; a pressure stall ends the run
{
  const lv = P.makeLevel(2, 1), run = P.newRun(lv);
  const well = lv.heads[0].at;
  check(!P.turn(run, well[0], well[1]) && P.turn(run, (well[0] + 1) % lv.w, 3) === !run.tiles[3][(well[0] + 1) % lv.w].fixed, "fixed tiles don't turn, loose ones do");
  // a straight corridor longer than the pressure budget with no pump stalls
  const long = { n: 1, w: 1, h: 14, level: { ...P.levelOf(1), pressure: 5 }, heads: [{ product: "crude", at: [0, 0], dir: 2 }], terminals: [{ product: "crude", at: [0, 13], dir: 0, price: 100 }],
    tiles: Array.from({ length: 14 }, (_, y) => [{ kind: y === 0 ? "well" : y === 13 ? "term" : "straight", rot: 0, fixed: y === 0 || y === 13 }]), solution: Array.from({ length: 14 }, () => [0]) };
  const stall = P.solved(long);
  check(stall.over && !stall.over.win && stall.over.why === "pressure", `without a pump, a 14-tile corridor on a budget of 5 stalls (after ${stall.tilesFilled} tiles)`);
  long.tiles[5][0].kind = "pump"; long.tiles[5][0].shape = "straight"; long.tiles[10][0].kind = "pump"; long.tiles[10][0].shape = "straight";
  check(P.solved(long).over?.win, "with pumps on the way, it delivers");
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
