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
  detours += lv.directs.length; lines += lv.level.products + (lv.level.unit ? 2 : 0);
  if (!lv.directs.length) fail("no pump detour");
  if (lv.heads.length === 1 && !lv.level.unit && P.reachableDry(lv, lv.heads[0], lv.terminals[0].at)) fail("the far terminal can be reached without a pump");
  if (lv.terminals.some(t => !(t.price > 0))) fail("a terminal without a price");
  if (lv.level.terminals === 2) {
    if (lv.terminals.length !== 2 || !lv.choice) fail("a two-terminal level without its choice");
    else { picks[lv.choice.better]++; if (lv.terminals[0].price <= lv.terminals[1].price) fail("the far terminal doesn't pay more"); }
  }
  lv.tiles.flat().forEach(t => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
  if (lv.level.products === 2 && !lv.tiles.flat().some(t => t.kind === "cross")) fail("a two-product level without a crossing");
  if (lv.level.unit && (!lv.tiles.flat().some(t => t.kind === "unit") || lv.terminals.length !== 2)) fail("an HVO unit level without its unit and two terminals");
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
check(problems === 0, `${built} levels: repeatable; routes deliver; ${detours} detours on ${lines} product lines, every direct line runs dry; one product needs a pump for its far terminal; crossings on two-product levels, HVO units on theirs, the trace of every solution delivering (tiles: ${JSON.stringify(kinds)})`);
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
// alone, crude sets off at once; sharing the board with HVO, it waits
{
  const one = P.makeLevel(1, 1), r1 = P.newRun(one);
  P.advance(one, r1, 500);
  const two = P.makeLevel(1, P.ACT_LENGTH + 1), r2 = P.newRun(two);   // the first level of act 2: two products
  P.advance(two, r2, 500);
  check(r1.heads[0].progress > 0 && r2.heads.find(h => h.product === "crude").progress === 0, "crude goes at once alone, and waits behind HVO when they share the board");
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
// Auto-turn: every pipe on a designed route turns to join it, and a board turned that way (the rest left scrambled)
// delivers; a pipe no route uses has no right way; a route straight a tool made a curve can't join its route; and a
// pipe already joining its route keeps its turn
{
  let routeCells = 0, offCells = 0, curves = 0, picksTurned = 0;
  const wrongs = [];
  for (let seed = 1; seed <= 6; seed++) for (let n = 1; n <= 20; n++) {
    const lv = P.makeLevel(seed, n), on = new Set(lv.routes.flatMap(r => r.slice(1, -1).map(([x, y]) => `${x},${y}`)));
    const rots = lv.tiles.map(row => row.map(t => t.rot));
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const t = lv.tiles[y][x];
      if (t.fixed) continue;
      const right = P.rightTurn(lv, t, x, y);
      if (on.has(`${x},${y}`)) {
        routeCells++;
        if (right.rot == null) wrongs.push(`no turn for a route pipe (seed ${seed}, level ${n})`);
        else {
          rots[y][x] = right.rot;
          if (P.rightTurn(lv, { ...t, rot: right.rot }, x, y).rot !== right.rot) wrongs.push(`a right turn doesn't hold (seed ${seed}, level ${n})`);
        }
      } else { offCells++; if (right.why !== "off") wrongs.push(`a turn for a pipe no route uses (seed ${seed}, level ${n})`); }
    }
    const turned = P.runWith(lv, rots);
    if (!turned.over?.win) wrongs.push(`a board turned by Auto-turn doesn't deliver (seed ${seed}, level ${n})`);
    // two terminals: the junction turns towards the better pick (index 0 is the far terminal)
    else if (lv.choice) { picksTurned++; if (turned.reached[0] !== (lv.choice.better === "far" ? 0 : 1)) wrongs.push(`Auto-turn led to the worse terminal (seed ${seed}, level ${n})`); }
    const straight = [...on].map(k => k.split(",").map(Number)).find(([x, y]) => lv.tiles[y][x].kind === "straight");
    if (straight) {
      curves++;
      const [x, y] = straight;
      if (P.rightTurn(lv, { ...lv.tiles[y][x], kind: "bend" }, x, y).why !== "shape") wrongs.push(`a curved route straight still turns (seed ${seed}, level ${n})`);
    }
  }
  check(!wrongs.length, `Auto-turn: ${routeCells} route pipes turn to join their routes, and 120 boards turned that way deliver (the ${picksTurned} with two terminals to the better one); ${offCells} pipes off every route have no right way; ${curves} route straights made curves can't join${wrongs.length ? `: ${wrongs.slice(0, 3).join("; ")}` : ""}`);
}
// The run as a roguelike (pipes-run.js): the doors, a job's terms, boards under every twist, scoring under terms
const J = await import("../pipes-run.js");
{
  const wrong = [], ids = Object.keys(J.UPGRADES), tierOf = id => J.UPGRADES[id]?.tier;
  for (let seed = 1; seed <= 30; seed++) {
    const owned = [];
    for (let n = 1; n <= 16; n++) {
      const doors = J.doorsFor(seed, n, owned), again = J.doorsFor(seed, n, [...owned]);
      if (JSON.stringify(doors) !== JSON.stringify(again)) wrong.push(`doors not repeatable (seed ${seed}, level ${n})`);
      if (doors.length !== (owned.includes("broker") ? 4 : 3)) wrong.push(`${doors.length} doors (seed ${seed}, level ${n})`);
      const rewards = doors.map(d => d.reward).filter(r => r !== "cargo");
      if (new Set(rewards).size !== rewards.length) wrong.push(`a reward twice among the doors (seed ${seed}, level ${n})`);
      if (rewards.some(r => owned.includes(r))) wrong.push(`an upgrade already held on offer (seed ${seed}, level ${n})`);
      if (n === 1 && !doors.every(d => d.twist === "none" && tierOf(d.reward) === 1)) wrong.push("level 1 isn't three standard jobs for common upgrades");
      else if (J.isFinale(n)) {                             // as many rares as are left, up to one a door
        const rares = ids.filter(id => tierOf(id) === 3 && !owned.includes(id)).length;
        if (!doors.every(d => d.twist === "finale") || doors.filter(d => tierOf(d.reward) === 3).length !== Math.min(doors.length, rares)) wrong.push(`finale ${n} isn't big contracts for the rares left`);
      }
      else if (n > 1 && !J.isFinale(n)) {
        const [plain, ...twisted] = doors;
        if (plain.twist !== "none" || twisted.some(d => d.twist === "none" || d.twist === "finale") || new Set(twisted.map(d => d.twist)).size !== twisted.length) wrong.push(`level ${n}'s jobs aren't one standard and different twists`);
      }
      owned.push(doors[(seed + n) % 3].reward);                // a run taking doors in turn
    }
  }
  const allHeld = J.doorsFor(5, 7, ids);
  if (!allHeld.every(d => d.reward === "cargo")) wrong.push("with every upgrade held, the doors don't offer cargo");
  check(!wrong.length, `doors: 30 runs of 16 levels, repeatable, three each (four with Broker), never an upgrade held or twice on offer; level 1 standard for commons, finales big contracts for the rares left, otherwise one standard and the rest twisted; cargo once every upgrade is held${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
}
{
  const n = 7, base = P.levelOf(n), T = (twist, owned = []) => J.termsFor({ twist, reward: "steel" }, owned, n), t0 = T("none");
  const expect = [
    [t0.flow.plan === base.plan && t0.flow.tick === base.tick && t0.flow.pressure === base.pressure && t0.pay === 1 && t0.tile === 10 && t0.tools.count === 3 && t0.spill === 1, "a standard job plays as the level does"],
    [T("rush").flow.plan === Math.round(base.plan * 0.75), "rush: 25% less planning"],
    [T("fast").flow.tick === Math.round(base.tick * 0.8), "fast flow: a 20% quicker tick"],
    [T("rocky").build.rock === Math.min(0.24, base.rock * 2), "rocky ground: twice the rock"],
    [T("thin").build.pressure === base.pressure - 1 && T("thin").flow.pressure === base.pressure - 1, "low pressure: built and played a tile shorter"],
    [T("bare").tools === null, "no tools: none on offer"],
    [T("finale").pay === 2 && T("finale").flow.plan === Math.round(base.plan * 0.75), "a finale pays double with 25% less planning"],
    [T("none", ["survey"]).flow.plan === base.plan + 5000 && T("rush", ["survey"]).flow.plan === Math.round((base.plan + 5000) * 0.75), "Survey team: 5 s more, before a rush's cut"],
    [T("none", ["pumps"]).flow.pressure === base.pressure + 2 && !T("none", ["pumps"]).build.pressure, "High-pressure pumps: played two tiles longer, built as ever"],
    [T("none", ["choke"]).flow.tick === Math.round(base.tick * 1.15), "Choke valve: a 15% slower tick"],
    [T("none", ["steel"]).tile === 7, "Cheap steel: 7 a tile"],
    [Math.abs(T("finale", ["buyers", "leverage"]).pay - 2 * 1.15 * 1.5) < 1e-9 && T("none", ["leverage"]).spill === 2, "Premium buyers, Leverage and a finale multiply; Leverage's spill costs two"],
    [T("finale", ["contracts"]).pay === 3 && T("none", ["contracts"]).pay === 1 && J.describe({ twist: "finale", reward: "crew" }, 5, ["contracts"]).twist.includes("triple"), "Big contracts: finales pay triple, and say so"],
    [J.doorsFor(9, 4, ["broker"]).length === 4 && J.doorsFor(9, 5, ["broker"]).length === 4 && J.doorsFor(9, 4).length === 3, "Broker: four doors"],
    [T("none", ["window"]).bonusWindow === 120000 && T("none", ["fill"]).fillRate === 6 && T("none", ["hedge"]).floor === 1, "Long window, Fast fill, Hedge"],
    [JSON.stringify(T("none", ["kit", "supplier", "restock", "parts"]).tools) === JSON.stringify({ count: 4, price: 0.7, uses: 1, turn: true }), "the kit's upgrades"],
    [T("none", ["insurance", "prelaid"]).insurance && T("none", ["insurance", "prelaid"]).prelaid, "Insurance and Pre-laid"],
  ];
  const fails = expect.filter(([ok]) => !ok).map(([, what]) => what);
  check(!fails.length, `a job's terms: twists, finales and all eighteen upgrades as their cards say${fails.length ? `: ${fails.join("; ")}` : ""}`);
}
{
  let boards = 0, drier = 0, directs = 0;
  const wrong = [];
  for (let seed = 1; seed <= 3; seed++) for (let n = 1; n <= 20; n++) for (const twist of ["rocky", "thin"]) {
    const t = J.termsFor({ twist }, [], n);
    let lv;
    try { lv = P.makeLevel(seed, n, t.build); } catch (e) { wrong.push(`${twist} level ${n} (seed ${seed}) can't be built`); continue; }
    boards++;
    if (!P.solved(lv).over?.win) wrong.push(`${twist} level ${n} (seed ${seed}) doesn't deliver`);
    if (twist === "rocky") {                                         // High-pressure pumps lets some direct lines deliver
      const strong = { ...lv, level: { ...lv.level, pressure: lv.level.pressure + 2 } };
      for (const d of lv.directs) { directs++; if (P.runWith(strong, P.rotsFor(lv.solution, d.route)).over?.win) drier++; }
    }
  }
  check(!wrong.length && drier > 0, `${boards} boards under rocky ground and low pressure build and deliver; with High-pressure pumps ${drier} of ${directs} direct lines stop running dry${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
}
{
  const lv = P.makeLevel(4, 2), run = P.solved(lv), plain = P.score(lv, run, 30000), t = P.score(lv, run, 30000, {}, { tile: 7, pay: 2 });
  check(t.pipe === 7 * run.tilesFilled && t.revenue === Math.round(2 * plain.revenue) && t.total === Math.max(0, t.revenue - t.pipe - t.pumps + t.time),
    `scored under a job's terms: ${t.revenue} (double ${plain.revenue}) − ${t.pipe} pipe at 7 a tile − ${t.pumps} pumps + ${t.time} time = ${t.total}`);
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
