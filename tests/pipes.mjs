const P = await import("../pipes-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
let problems = 0, built = 0, scrambledWins = 0, scrambledRuns = 0;
const kinds = {};
for (let seed = 1; seed <= 15; seed++) for (let n = 1; n <= 10; n++) {
  const lv = P.makeLevel(seed, n), again = P.makeLevel(seed, n);
  built++;
  if (JSON.stringify(lv.tiles) !== JSON.stringify(again.tiles)) { problems++; console.log("not repeatable", seed, n); }
  const win = P.solved(lv);
  if (!win.over?.win) { problems++; console.log("the solution doesn't work", seed, n, win.over, win.spill); }
  lv.tiles.flat().forEach(t => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; });
  if (n >= 4 && n < 7 && !lv.tiles.flat().some(t => t.kind === "cross")) { problems++; console.log("a two-product level without a crossing", seed, n); }
  if (n >= 7 && !lv.tiles.flat().some(t => t.kind === "blender")) { problems++; console.log("a blender level without a blender", seed, n); }
  if (lv.heads.length !== lv.level.products) { problems++; console.log("heads", seed, n); }
  // as scrambled, the flow usually spills (the player has to work)
  const run = P.newRun(lv);
  for (let i = 0; i < 300 && !run.over; i++) P.advance(lv, run, lv.level.tick);
  scrambledRuns++;
  if (run.over?.win) scrambledWins++;
  if (!run.over) { problems++; console.log("a scrambled run never ends", seed, n); }
}
check(problems === 0, `${built} levels: repeatable, every solution delivers (pumps included), crossings from level 4, blenders from 7 (tiles: ${JSON.stringify(kinds)})`);
check(scrambledWins < scrambledRuns * 0.05, `scrambled boards almost never work by luck (${scrambledWins} of ${scrambledRuns})`);
// turning: a locked or fixed tile won't turn; a pressure stall ends the run
{
  const lv = P.makeLevel(2, 1), run = P.newRun(lv);
  const well = lv.heads[0].at;
  check(!P.turn(run, well[0], well[1]) && P.turn(run, (well[0] + 1) % lv.w, 3) === !run.tiles[3][(well[0] + 1) % lv.w].fixed, "fixed tiles don't turn, loose ones do");
  // a straight corridor longer than the pressure budget with no pump stalls
  const long = { n: 1, w: 1, h: 14, level: { ...P.levelOf(1), pressure: 5 }, heads: [{ product: "crude", at: [0, 0], dir: 2 }], terminals: [{ product: "crude", at: [0, 13], dir: 0 }],
    tiles: Array.from({ length: 14 }, (_, y) => [{ kind: y === 0 ? "well" : y === 13 ? "term" : "straight", rot: 0, fixed: y === 0 || y === 13 }]), solution: Array.from({ length: 14 }, () => [0]) };
  const stall = P.solved(long);
  check(stall.over && !stall.over.win && stall.over.why === "pressure", `without a pump, a 14-tile corridor on a budget of 5 stalls (after ${stall.tilesFilled} tiles)`);
  long.tiles[5][0].kind = "pump"; long.tiles[5][0].shape = "straight"; long.tiles[10][0].kind = "pump"; long.tiles[10][0].shape = "straight";
  check(P.solved(long).over?.win, "with pumps on the way, it delivers");
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
