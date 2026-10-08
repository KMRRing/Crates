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
// The run as a roguelike (pipes-run.js): the doors, a job's terms, finales' quotas and bosses, boards under every twist
// and boss, and scoring as netback × mult with every boon doing what its card says
const J = await import("../pipes-run.js");
{
  const wrong = [], ids = Object.keys(J.BOONS), tierOf = id => J.BOONS[id]?.tier;
  for (let seed = 1; seed <= 30; seed++) {
    const held = [];
    for (let n = 1; n <= 16; n++) {
      const doors = J.doorsFor(seed, n, held), again = J.doorsFor(seed, n, [...held]);
      if (JSON.stringify(doors) !== JSON.stringify(again)) wrong.push(`doors not repeatable (seed ${seed}, level ${n})`);
      if (doors.length !== (held.includes("broker") ? 4 : 3)) wrong.push(`${doors.length} doors (seed ${seed}, level ${n})`);
      const rewards = doors.map(d => d.reward).filter(r => r !== "cargo");
      if (new Set(rewards).size !== rewards.length) wrong.push(`a reward twice among the doors (seed ${seed}, level ${n})`);
      if (rewards.some(r => held.includes(r))) wrong.push(`a boon already held on offer (seed ${seed}, level ${n})`);
      if (n === 1 && !doors.every(d => d.twist === "none" && tierOf(d.reward) === 1)) wrong.push("level 1 isn't three standard jobs for common boons");
      else if (J.isFinale(n)) {                             // as many rares as are left, up to one a door
        const rares = ids.filter(id => tierOf(id) === 3 && !held.includes(id)).length;
        if (!doors.every(d => d.twist === "finale") || doors.filter(d => tierOf(d.reward) === 3).length !== Math.min(doors.length, rares)) wrong.push(`finale ${n} isn't big contracts for the rares left`);
      } else if (n > 1) {
        const [plain, ...twisted] = doors;
        if (plain.twist !== "none" || twisted.some(d => d.twist === "none" || d.twist === "finale") || new Set(twisted.map(d => d.twist)).size !== twisted.length) wrong.push(`level ${n}'s jobs aren't one standard and different twists`);
      }
      const take = doors[(seed + n) % doors.length].reward;    // a run taking doors in turn, swapping the oldest out when full
      if (take !== "cargo") { if (held.length >= J.SLOTS) held.shift(); held.push(take); }
    }
  }
  if (!J.doorsFor(5, 7, ids).every(d => d.reward === "cargo")) wrong.push("with every boon held, the doors don't offer cargo");
  check(!wrong.length, `doors: 30 runs of 16 levels, repeatable, three each (four with Broker), never a boon held or twice on offer; level 1 standard for commons, finales big contracts for the rares left, otherwise one standard and the rest twisted; cargo once every boon is held${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
}
{
  const n = 7, base = P.levelOf(n), T = (twist, held = [], at = n, seed = 1) => J.termsFor({ twist, reward: "steel" }, held, at, seed), t0 = T("none");
  const bossAt = boss => { for (let seed = 1; seed < 500; seed++) for (const at of [5, 10, 15, 20, 25, 30]) if (J.bossFor(seed, at) === boss) return { seed, at }; };
  const fin = boss => { const { seed, at } = bossAt(boss); return { t: J.termsFor({ twist: "finale" }, ["serpent", "survey"], at, seed), b: P.levelOf(at) }; };
  const expect = [
    [t0.flow.plan === base.plan && t0.flow.tick === base.tick && t0.flow.pressure === base.pressure && t0.pay === 1 && t0.tile === 10 && t0.tools.count === 3 && t0.spill === 1 && t0.quota === null, "a standard job plays as the level does"],
    [T("rush").flow.plan === Math.round(base.plan * 0.75) && T("fast").flow.tick === Math.round(base.tick * 0.8), "rush and fast flow"],
    [T("rocky").build.rock === Math.min(0.24, base.rock * 2) && T("thin").build.pressure === base.pressure - 1 && T("bare").tools === null, "rocky ground, low pressure, no tools"],
    [T("finale", [], 5).pay === 2 && T("finale", ["contracts"], 5).pay === 3 && T("finale", [], 5).flow.plan === P.levelOf(5).plan && T("finale", [], 5).quota === J.quotaFor(1), "a finale pays double (triple with Big contracts), keeps its planning, and has its act's quota"],
    [fin("storm").t.flow.tick === Math.round(fin("storm").b.tick * 0.7), "Storm: the oil 30% faster"],
    [fin("drought").t.build.pressure === fin("drought").b.pressure - 2, "Drought: built and played two tiles shorter"],
    [fin("strike").t.tools === null && fin("quarry").t.build.rock === Math.min(0.3, fin("quarry").b.rock * 3) && fin("audit").t.tile === 20, "Strike, Quarry, Audit"],
    [JSON.stringify(fin("regulator").t.boons) === JSON.stringify(["survey"]) && fin("regulator").t.flow.plan === fin("regulator").b.plan + 5000, "the Regulator benches the first boon, and only it"],
    [T("none", ["survey"]).flow.plan === base.plan + 5000 && T("rush", ["survey"]).flow.plan === Math.round((base.plan + 5000) * 0.75), "Survey team: 5 s more, before a rush's cut"],
    [T("none", ["pumps"]).flow.pressure === base.pressure + 2 && !T("none", ["pumps"]).build.pressure, "High-pressure pumps: played two tiles longer, built as ever"],
    [T("none", ["choke"]).flow.tick === Math.round(base.tick * 1.15) && T("none", ["steel"]).tile === 7, "Choke valve, Cheap steel"],
    [Math.abs(T("finale", ["buyers", "leverage"], 5).pay - 2 * 1.15 * 1.5) < 1e-9 && T("none", ["leverage"]).spill === 2, "Premium buyers, Leverage and a finale multiply; Leverage's spill costs two"],
    [T("none", ["window"]).bonusWindow === 120000 && T("none", ["fill"]).fillRate === 6 && T("none", ["hedge"]).floor === 1, "Long window, Fast fill, Hedge"],
    [JSON.stringify(T("none", ["kit", "supplier", "restock", "parts"]).tools) === JSON.stringify({ count: 4, price: 0.7, uses: 1, turn: true }), "the kit's boons"],
    [T("none", ["insurance", "prelaid", "model"]).insurance && T("none", ["insurance", "prelaid", "model"]).prelaid && T("none", ["model"]).warnDry && !t0.warnDry, "Insurance, Pre-laid, Hydraulic model"],
    [J.doorsFor(9, 4, ["broker"]).length === 4 && J.interestOn(10000) === 300 && J.interestOn(2000) === 100, "Broker's four doors, Interest's 5% up to 300"],
    [[1, 2, 3, 4, 5, 6].map(J.quotaFor).every((q, i, a) => !i || q > a[i - 1] * 2), "each act's quota more than doubles the last"],
  ];
  const fails = expect.filter(([ok]) => !ok).map(([, what]) => what);
  // every seed meets all six bosses in six acts
  for (let seed = 1; seed <= 50; seed++) if (new Set([5, 10, 15, 20, 25, 30].map(at => J.bossFor(seed, at))).size !== 6) { fails.push(`seed ${seed} repeats a boss within six acts`); break; }
  check(!fails.length, `a job's terms: twists, finales, the six bosses and the rule boons as their cards say; quotas rise; no boss twice in six acts${fails.length ? `: ${fails.join("; ")}` : ""}`);
}
{
  let boards = 0, drier = 0, directs = 0;
  const wrong = [];
  for (let seed = 1; seed <= 3; seed++) for (let n = 1; n <= 20; n++) for (const build of [{ rock: Math.min(0.24, P.levelOf(n).rock * 2) }, { pressure: 7 }, { pressure: 6 }, { rock: Math.min(0.3, P.levelOf(n).rock * 3) }]) {
    let lv;
    try { lv = P.makeLevel(seed, n, build); } catch (e) { wrong.push(`level ${n} (seed ${seed}) can't be built under ${JSON.stringify(build)}`); continue; }
    boards++;
    if (!P.solved(lv).over?.win) wrong.push(`level ${n} (seed ${seed}) under ${JSON.stringify(build)} doesn't deliver`);
    if (build.rock && build.rock < 0.25) {                       // High-pressure pumps lets some direct lines deliver
      const strong = { ...lv, level: { ...lv.level, pressure: lv.level.pressure + 2 } };
      for (const d of lv.directs) { directs++; if (P.runWith(strong, P.rotsFor(lv.solution, d.route)).over?.win) drier++; }
    }
  }
  check(!wrong.length && drier > 0, `${boards} boards under rocky ground, low pressure, Drought and Quarry build and deliver; with High-pressure pumps ${drier} of ${directs} direct lines stop running dry${wrong.length ? `: ${wrong.slice(0, 3).join("; ")}` : ""}`);
}
{
  // a delivery made to touch every boon: straights back to back, three bends in a row, a pump, a crossing carrying two
  // products, a ✓-marked bend, a rock beside the path, crude and HVO delivered, crude below list
  const at = (k, kind, product = "crude", extra = {}) => ({ x: k, y: 1, kind, product, second: false, marked: false, ...extra });
  const trail = [at(0, "straight"), at(1, "straight"), at(2, "bend"), at(3, "bend"), at(4, "bend"), at(5, "pump"), at(6, "cross"),
    at(6, "cross", "hvo", { second: true }), at(8, "bend", "crude", { marked: true }), at(9, "term"), at(10, "straight", "hvo"), at(11, "term", "hvo")];
  const tiles = Array.from({ length: 3 }, (_, y) => Array.from({ length: 12 }, (_, x) => ({ kind: y === 0 && x === 0 ? "rock" : "bend", rot: 0 })));
  const level = { terminals: [{ product: "crude", price: 500, at: [9, 1] }, { product: "hvo", price: 400, at: [11, 1] }] };
  const run = { trail, tiles, reached: [0, 1], pumpsFired: 1, tilesFilled: trail.length };
  const ctx = held => ({ msLeft: 35000, market: { crude: 0.9, hvo: 1 }, terms: { boons: held, pay: 1, tile: 10, pump: 40, twist: "rush" }, grow: { winding: 10, pumpjack: 4 }, streak: 2, toolsUsed: 0, planLeft: 4500 });
  const one = (id, c = ctx([id])) => { const t = J.tally(level, run, c), b = t.boons[0]; return b ? { chips: b.chips || 0, mult: +b.mult.toFixed(4), xmult: +b.xmult.toFixed(4) } : null; };
  const want = {
    serpent: { mult: 0.6 }, elbow: { chips: 80 }, hairpin: { xmult: 1.2 }, winding: { mult: 0.28 }, trunk: { mult: 0.9 }, express: { mult: 1 },
    junction: { mult: 2 }, spaghetti: { xmult: 1.5 }, booster: { chips: 100 }, compressor: { xmult: 1.2 }, bypass: null, pumpjack: { xmult: 1.25 },
    haul: { mult: 1 }, golden: null, early: { mult: 0.4 }, clockwork: { mult: 1.2 }, thrift: { mult: 2 }, toolsmith: null, marked: { mult: 0.5 },
    green: { chips: 400 }, speculator: { mult: 2 }, refinery: { xmult: 1.5 }, wildcat: { mult: 1 }, streak: { mult: 0.9 }, contrarian: { xmult: 2 },
  };
  const wrong = [];
  for (const [id, w] of Object.entries(want)) {
    const got = one(id), exp = w && { chips: w.chips || 0, mult: w.mult || 0, xmult: w.xmult || 1 };
    if (JSON.stringify(got) !== JSON.stringify(exp)) wrong.push(`${id}: ${JSON.stringify(got)}, not ${JSON.stringify(exp)}`);
  }
  const scoring = Object.keys(J.BOONS).filter(id => J.BOONS[id].tile || J.BOONS[id].end);
  if (scoring.some(id => !(id in want))) wrong.push(`untested: ${scoring.filter(id => !(id in want)).join(", ")}`);
  // the conditions the delivery above doesn't meet, met
  const noPump = { ...run, trail: trail.map(t => (t.kind === "pump" ? { ...t, kind: "bend" } : t)), pumpsFired: 0 };
  if (J.tally(level, noPump, ctx(["bypass"])).boons[0]?.xmult !== 2) wrong.push("Bypass doesn't double with no pump");
  const long = { ...run, trail: [...trail, ...Array.from({ length: 20 }, (_, k) => at(k, "straight", "crude"))] };
  if (Math.abs(J.tally(level, long, ctx(["golden"])).boons[0]?.xmult - 1.4) > 1e-9) wrong.push("Golden pipe isn't ×1.4 on 30 tiles");
  if (one("toolsmith", { ...ctx(["toolsmith"]), toolsUsed: 2 })?.mult !== 2 || one("thrift", { ...ctx(["thrift"]), toolsUsed: 2 }) !== null) wrong.push("Toolsmith and Thrift don't follow the tools used");
  // the sum: netback 850 at the terminals − 120 pipe − 40 pump + 350 time + 80 Elbow grease; mult (1 + 0.6) × 1.2 × 2
  const all = J.tally(level, run, ctx(["serpent", "elbow", "compressor", "contrarian"]));
  if (all.netback !== 1120 || Math.abs(all.mult - 3.84) > 1e-9 || all.total !== Math.round(1120 * 3.84)) wrong.push(`the sum: ${all.netback} × ${all.mult} = ${all.total}`);
  // with no boons, the tally is the engine's netback
  const lv = P.makeLevel(4, 8), solved = P.solved(lv), terms = J.termsFor({ twist: "none" }, [], 8, 4);
  if (J.tally(lv, solved, { msLeft: 40000, market: { crude: 1.1, hvo: 0.9 }, terms }).total !== P.score(lv, solved, 40000, { crude: 1.1, hvo: 0.9 }, terms).total) wrong.push("with no boons, the tally isn't the netback");
  check(!wrong.length, `scoring: netback × (1 + what boons add) × what they multiply; all ${scoring.length} scoring boons as their cards say, each alone, and together; with none, the netback as ever${wrong.length ? `: ${wrong.slice(0, 4).join("; ")}` : ""}`);
}
// The quotas against simulated runs: every level played on its designed route with 30 s of the bonus left, through five
// acts. Taking the plain door every time (commons only) gets through act 2's finale and fades by act 5's; taking the
// boon that multiplies most (and swapping out the least) goes further. Retuning a boon or a quota must keep that shape.
{
  const WORTH = { contrarian: 4, golden: 4, pumpjack: 4, winding: 4, hairpin: 3, compressor: 3, refinery: 3, serpent: 3, trunk: 3, express: 3, haul: 3, clockwork: 3, streak: 3,
    junction: 2, spaghetti: 2, bypass: 2, early: 2, thrift: 2, elbow: 1.5 }, worth = id => WORTH[id] ?? 0.2;
  const passes = { plain: [0, 0, 0, 0, 0], multiplying: [0, 0, 0, 0, 0] }, runs = 12;
  for (const policy of Object.keys(passes)) for (let seed = 1; seed <= runs; seed++) {
    const held = [], grow = {};
    let streak = 0;
    for (let n = 1; n <= 5 * P.ACT_LENGTH; n++) {
      const doors = J.doorsFor(seed, n, held), job = policy === "plain" ? doors[0] : doors.reduce((a, d) => (worth(d.reward) > worth(a.reward) ? d : a));
      const terms = J.termsFor(job, held, n, seed), lv = P.makeLevel(seed, n, terms.build);
      lv.level = { ...lv.level, ...terms.flow };
      const t = J.tally(lv, P.solved(lv), { msLeft: 30000, terms, grow, streak: streak++, toolsUsed: 0, planLeft: 0 });
      for (const id of terms.boons) if (J.BOONS[id].grows) grow[id] = (grow[id] || 0) + t.sum[J.BOONS[id].grows];
      if (J.isFinale(n) && t.total >= terms.quota) passes[policy][n / P.ACT_LENGTH - 1]++;
      if (job.reward === "cargo") continue;
      if (held.length < J.SLOTS) held.push(job.reward);
      else { const out = held.reduce((a, id, i) => (worth(id) < worth(held[a]) ? i : a), 0); if (worth(job.reward) > worth(held[out])) { delete grow[held[out]]; held[out] = job.reward; } }
    }
  }
  const { plain, multiplying } = passes;
  check(plain[1] >= runs * 0.75 && plain[4] <= runs * 0.25 && multiplying.every((m, a) => a < 2 || m > plain[a]) && multiplying[3] >= 2 * plain[3],
    `quotas: of ${runs} simulated runs, the plain doors' commons pass act finales ${plain.join(", ")}; boons picked for what they multiply ${multiplying.join(", ")}`);
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
