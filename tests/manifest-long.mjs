// Manifest's logs (Korbi, 3 November 2026: "yea long logs is good"; 4 November, 01:14: "there should be no short logs ever"): oak and
// birch are only ever one piece filling two cells in a line. The rules of it are in manifest-rules.mjs and its solid in
// manifest-shapes.mjs; this is the engine's part: that no cell ever holds a one-cell log, what the view shows of a log, how a team and
// a change round treat one, what the questions and the key say of it, where timber is dealt, and that a recipe without timber deals
// the very stacks it always did (so nothing saved or shared moves).
import { createHash } from "node:crypto";
const R = await import("../manifest-rules.js");
const M = await import("../manifest-engine.js");
const Lv = await import("../manifest-levels.js");
const { problems } = await import("./manifest-observer.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = (x, y, z) => `${x},${y},${z}`;
const empty = (X, Y, Z) => Array.from({ length: X }, () => Array.from({ length: Y }, () => Array(Z).fill(0)));
/** A stack of this floor with a long oak lying along x at the back of tier 0 (cells 0,0 and 1,0), and whatever `fill` puts about it. */
const logWith = (fill, X = 3, Y = 2, Z = 3) => { const c = empty(X, Y, Z); c[0][0][0] = c[1][0][0] = R.LONG_OAK; fill?.(c); return c; };

// what the view shows of a log: it is one piece, seen by both its cells, and a log whose half hardly shows is dealt as another cargo
{
  const lone = logWith(), px = M.pixelsOf(lone);
  check(M.visibleSet(lone).size === 2 && M.clearSet(lone).size === 2 && px.get("0,0,0") > 90 && px.get("1,0,0") > 90,
    "a long log alone is seen by both its cells, each half showing well over what a piece needs to be pointed at");
  const hidden = logWith(c => { c[1][1] = [1, 1, 1]; });                 // a stack of crates in front hides the whole low half
  check(M.pixelsOf(hidden).get("0,0,0") === 0 && M.visibleSet(hidden).has("0,0,0") && M.visibleSet(hidden).has("1,0,0"),
    "the pixels of a log are added: with one half hidden the log is still seen, by both cells (it is one piece)");
  const kept = logWith(c => { c[2][0] = [1, 1, 1]; });
  const hiddenOnes = [hidden, logWith(c => { c[2][0] = [1, 1, 1]; c[2][1] = [1, 1, 1]; }), logWith(c => { c[1][1] = [1, 1, 1]; c[2][0] = [1, 1, 1]; }), logWith(c => { c[0][1] = [1, 1, 1]; })];
  const before = JSON.stringify(kept), types = [1, 2, 3, 4];
  const keptOk = M.replaceHidden(kept, types), replaced = hiddenOnes.map(c => M.replaceHidden(c, types));
  check(keptOk && JSON.stringify(kept) === before && replaced.every(Boolean) && hiddenOnes.every(c => !c.flat(2).some(t => t === R.TIMBER || t === R.BIRCH || R.isLong(t)) && !R.validate(c, 4).length),
    "seen all at once, a log is dealt only if both its halves show enough: a trunk going behind a crate is dealt as another cargo, never as a one-cell log, and the stack still stands");
  check(!M.replaceHidden(logWith(c => { c[1][1] = [1, 1, 1]; }), [R.TIMBER, R.BIRCH]), "with no other cargo in play to take its place, a hidden log is reported (the round is dealt again)");
  const { times } = M.dropTimes(logWith(), "layers"), one = M.dropTimes(logWith(), "all").times;
  check(times["0,0,0"] === times["1,0,0"] && one["0,0,0"] === one["1,0,0"], "a long log lands as one, both cells at the same moment");
  const order = M.drawOrder(logWith(), 0), turned = M.drawOrder(M.turn(logWith(), 2), 2);
  check(order.length === 2 && order[0].half === 0 && order[1].half === 1 && order[0].piece === "0,0,0" && order[1].piece === "0,0,0"
    && turned.length === 2 && turned.every(c => c.piece === "1,1,0") && turned.map(c => c.half).join() === "0,1",
  "the draw order says which half of which log each cell is, as the stack lies (turned half round, the log is named by the low cell there)");
  const two = [[[9]], [[9]]];
  check(M.anchorKey(M.turn(two, 2), 2, M.turnKey(0, 0, 0, 2, 1, 2)) === "0,0,0" && M.turnKey(0, 0, 0, 2, 1, 2) === "1,0,0" && M.anchorKey(two, 0, "1,0,0") === "0,0,0" && M.anchorKey(two, 0, "5,5,5") === "5,5,5",
    "a log's name is its low cell as the picture lays it: turned half round, the cell it was named by is its high one");
}

// a team: each log is held whole by one player, whatever the floor
{
  const c = empty(4, 2, 2);
  for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) c[x][y][0] = R.INGOT;
  c[0][0][1] = c[0][1][1] = R.LONG_OAK;                                    // along y (tier 1), joining snake places 0 and 7
  let problemsFound = 0, atoms = 0;
  for (let n = 2; n <= 6; n++) {
    const parts = M.splitStack(c, n), all = parts.flat();
    if (parts.length !== n || !parts.every(p => p.length) || new Set(all).size !== 10 || all.length !== 10 || !parts.some(p => p.includes("0,0,1") && p.includes("0,1,1") && p.includes("0,0,0") && p.includes("0,1,0")) || !same(M.splitStack(c, n), parts)) problemsFound++;
    atoms++;
  }
  const small = empty(2, 2, 2);
  small[0][0][0] = small[1][0][0] = small[0][1][0] = small[1][1][0] = R.INGOT;
  small[0][0][1] = small[0][1][1] = R.LONG_OAK;
  check(!problemsFound && M.splitStack(small, 6).length === 3,
    `${atoms} splits of a floor with a log standing on two columns that are far apart in the snake keep both columns with one player (a floor too small for as many parts as players gives fewer parts)`);
  const floor = { ...M.levelOf(9), x: 3, y: 2, types: [1, 2, 3, 4, 8] };
  let none = 0, n = 0, trees = 0;
  for (let seed = 1; seed <= 20; seed++) { n++; const Rd = M.makeRound(seed, 9, 6, floor); if (!R.pieces(Rd.cells, 0).list.some(p => p.long)) none++; if (Rd.level.types.some(R.isTimber)) trees++; }
  check(none === n && !trees && !M.holdsLog(3, 2) && M.holdsLog(4, 2) && M.holdsLog(3, 3), "a floor of six columns holds no log, so it has no timber in play: a table of six needs six stretches of the floor to share");
  const FLOORS = [[4, 2, 2, 2], [3, 3, 2, 2], [4, 3, 3, 4], [4, 4, 3, 5]], parts = new Set();
  const most = FLOORS.map(([x, y, z]) => Math.max(...Array.from({ length: 30 }, (_, k) => {
    const Rd = M.makeRound(k + 1, 12, 6, { ...M.levelOf(12), x, y, z, change: null, types: [1, 2, 3, 4, 8] });
    parts.add(Rd.parts.length);
    return R.pieces(Rd.cells, 0).list.filter(p => p.long).length;
  })));
  check(most.every((m, i) => m >= 1 && m <= FLOORS[i][3]) && [...parts].join() === "6",
    `a floor has only so many logs (at most ${most.join(", ")} of ${FLOORS.map(f => f[3]).join(", ")} on 4×2×2, 3×3×2, 4×3×3, 4×4×3), so a table of six always has six stretches to share`);
}

// change rounds: a long log changes into the other tree's long log in the same two cells; a swap trades two logs of a size
{
  let changes = 0, turnedChanges = 0, swaps = 0, longChanges = 0, longTurned = 0, longSwaps = 0, found = [];
  const base = { ...M.levelOf(12), x: 4, y: 3, z: 3, types: [1, 2, 3, 4, 8], views: ["all"], orders: 1, kinds: ["count"], want: [] };
  // two logs of different trees to trade are rare, so the swap is dealt a stack of nothing but trees
  const seeds = { ware: 40, turned: 90, swap: 60 }, recipes = { ware: base, turned: base, swap: { ...base, types: [3, 8] } };
  for (const variant of ["ware", "turned", "swap"]) for (let seed = 1; seed <= seeds[variant]; seed++) {
    const L = { ...recipes[variant], change: variant }, Rd = M.makeRound(seed, 4, 0, L), o = Rd.orders[0];
    if (!o) { found.push(`${variant} ${seed}: no change`); continue; }
    found.push(...problems(Rd, `${variant} ${seed}`));
    const q = o.question, P = R.pieces(Rd.cells, 0), back = M.turn(q.back, (4 - q.turns) % 4);
    if (o.type === "swap") {
      swaps++;
      if (q.answer.some(k => P.at.get(k)?.long)) longSwaps++;
      continue;
    }
    o.type === "change" ? changes++ : turnedChanges++;
    // the pieces that differ, as the stack was dealt
    const diff = []; Rd.cells.forEach((col, x) => col.forEach((row, y) => row.forEach((t, z) => { if (back[x][y][z] !== t) diff.push([x, y, z, t, back[x][y][z]]); })));
    const long = diff.some(d => R.isLong(d[3]));
    if (diff.some(d => d[3] === R.TIMBER || d[3] === R.BIRCH || d[4] === R.TIMBER || d[4] === R.BIRCH)) found.push(`${variant} ${seed}: a one-cell log came into a change`);
    if (long) {
      o.type === "change" ? longChanges++ : longTurned++;
      if (diff.length !== 2 || !diff.every(d => R.isLong(d[3]) && R.isLong(d[4]) && d[4] !== d[3]) || R.pieces(q.back, q.turns).at.get(q.answer)?.cells.length !== 2) found.push(`${variant} ${seed}: a long log changed badly`);
    } else if (diff.length !== 1) found.push(`${variant} ${seed}: ${diff.length} cells differ`);
  }
  if (found.length) console.log("  ", found.slice(0, 6).join("\n   "));
  check(!found.length && longChanges > 0 && longTurned > 0 && longSwaps > 0 && changes + turnedChanges + swaps === 190,
    `change rounds with long logs (${longChanges} of ${changes} plain, ${longTurned} of ${turnedChanges} turned, ${longSwaps} of ${swaps} swaps involve one): a log changes for the other tree's, in the same two cells, and the answer is the piece as the picture lays it, every one fair`);
}

// the questions say what a log counts as; weights and worths have its row in the key, and column questions leave logs out
{
  let kinds = {}, rows = 0, found = [];
  for (let seed = 1; seed <= 25; seed++) for (const r of [8, 9, 10, 12]) {
    const L = { ...M.levelOf(r), change: null, kinds: ["count", "total", "tier", "weight", "worth", "load", "fits", "column", "spot", "top", "most"], views: ["layers", "all", "slices", "pair"] };
    const Rd = M.makeRound(seed, r, 0, L);
    for (const o of Rd.orders) {
      kinds[o.type] = (kinds[o.type] || 0) + 1;
      const q = o.question, legend = q.legend ? M.legendRows(q.legend) : [];
      if (["weight", "worth"].includes(o.type)) {
        const col = o.type === "weight" ? "w" : "worth", logRows = legend.filter(x => x.long);
        // a tree's row is its whole log: twice a cell of its tree, one row apiece for every tree in play, and no row of a cell of a tree
        if (logRows.length !== q.legend.types.filter(R.isTimber).length || !logRows.every(x => x.name.endsWith(" log") && R.isTimber(x.id) && x[col] === 2 * R.CARGO[x.id - 1][col]) || legend.some(x => !x.long && x[col] !== R.CARGO[x.id - 1][col])) found.push(`${seed}/${r} ${o.type}: the key's log rows`);
        rows += logRows.length;
      } else if (legend.some(x => x.long) || q.legend?.types.some(R.isTimber)) found.push(`${seed}/${r} ${o.type}: a key with a log in it`);
    }
  }
  if (found.length) console.log("  ", found.slice(0, 6).join("\n   "));
  check(!found.length && rows > 20 && kinds.count && kinds.weight && kinds.worth, `keys: weights and worths carry one row for each tree, its whole log, twice a cell of it (${rows} rows in ${kinds.weight + kinds.worth} questions); no other question has one`);
}

// the picture's model: a long log along y keeps its low half toward low y, and either cell of a log names the log
{
  const Mo = await import("../manifest-model.js");
  const cells = empty(2, 2, 2);
  cells[0][0][0] = cells[1][0][0] = R.LONG_OAK;                          // along x on tier 0
  cells[0][0][1] = cells[0][1][1] = R.LONG_BIRCH;                        // along y on tier 1
  cells[0][1][0] = R.CRATE;
  const items = Mo.layout(cells, 0, Mo.frameOf(2, 2, 2, M.boxFor(0))), at = k => items.find(c => c.key === k);
  const toward = c => { const yaw = Mo.yawOf(c, 0); return [Math.round(Math.cos(yaw)), Math.round(-Math.sin(yaw))]; };    // where the mesh's high end (+x) points: [x, engine y]
  check(same(toward(at("0,0,0")), [1, 0]) && same(toward(at("0,0,1")), [0, 1]) && at("0,1,0").half == null && Mo.yawOf(at("0,1,0"), 0) === 0,
    "a log lies along x on an even tier and along y on an odd one, its high end toward high x or y; anything else needs no half");
  check(Mo.pieceKey(at("0,1,1")) === "0,0,1" && Mo.pieceKey(at("1,0,0")) === "0,0,0" && Mo.pieceKey(at("0,1,0")) === "0,1,0"
    && same([...Mo.piecesNamed(items, ["0,1,1"])], ["0,0,1"]) && same([...Mo.piecesNamed(items, ["0,0,0", "0,1,0"])].sort(), ["0,0,0", "0,1,0"]),
  "a mark, a tap or a ring on either cell of a log is on the log, by its low cell");
  const box = Mo.joinBox(at("0,0,1").box, at("0,1,1").box);
  check(box.cx === at("0,0,1").box.cx && box.cz === (at("0,0,1").box.cz + at("0,1,1").box.cz) / 2 && box.cy === at("0,0,1").box.cy, "a long log's mesh is centred on the middle of its two cells");
  const turned = Mo.layout(M.turn(cells, 1), 1, Mo.frameOf(2, 2, 2, M.boxFor(1)));
  check(turned.filter(c => c.half === 0).length === 2 && turned.filter(c => c.half === 1).length === 2 && turned.every(c => !R.isLong(c.c) || Mo.pieceKey(c) !== undefined),
    "the layout of a turned stack still has two logs of two halves each (turning keeps a long log long)");
}

// where timber is dealt: from the start (Random's second round is the first with a floor that holds a log), in every level whose floor
// can, and never as a one-cell log, in any round of anything
{
  const logs = Rd => R.pieces(Rd.cells, 0).list.filter(p => p.long).length, lone = Rd => Rd.cells.flat(2).filter(t => t === R.TIMBER || t === R.BIRCH).length;
  let loneCells = 0, rounds = 0;
  const per = Array.from({ length: 12 }, () => []);
  for (let seed = 1; seed <= 15; seed++) for (let r = 1; r <= 12; r++) {
    const Rd = M.makeRound(seed, r, seed % 3 ? 0 : 3 + (seed % 4));
    rounds++; loneCells += lone(Rd); per[r - 1].push(logs(Rd));
  }
  const first = M.levelOf(1), second = M.levelOf(2);
  check(!loneCells && !first.types.includes(R.TIMBER) && first.types.length === 3 && second.types.includes(R.TIMBER) && !M.holdsLog(first.x, first.y),
    `Random's first round (a floor of six columns) has ingots where oak would come, every other round has oak from the start; no cell of ${rounds} rounds holds a one-cell log`);
  check(per[0].every(n => n === 0) && per.slice(1).every((ns, k) => ns.every(n => n >= 1 && n <= M.levelOf(k + 2).x * M.levelOf(k + 2).y - 6)),
    "Random deals no log on its first round's floor, and at least one in every round after it, never so many that a table of six has fewer than six stretches");
  const withTrees = Lv.LEVELS.map((lv, i) => [lv, i]).filter(([lv]) => lv.recipe.types.some(R.isTimber));
  let bareFloor = 0, none = 0, total = 0, many = 0, lonely = 0;
  for (const [lv, i] of withTrees) for (let k = 1; k <= lv.rounds; k++) for (const seed of [Lv.seedOf(i), 5, 9]) {
    const rc = Lv.recipeAt(i, k), Rd = M.makeRound(seed, k, 0, rc), n = logs(Rd);
    total++; lonely += lone(Rd);
    if (M.holdsLog(rc.x, rc.y)) { if (!n) none++; if (rc.logs && n < Math.min(rc.logs, rc.x * rc.y - 6)) many++; } else if (n || Rd.level.types.some(R.isTimber)) bareFloor++;
  }
  const yard = Lv.LEVELS.map((lv, i) => [lv, i]).filter(([lv]) => lv.recipe.logs);
  check(!none && !bareFloor && !many && !lonely && Lv.LEVELS[4].recipe.x === 4 && Lv.LEVELS[4].recipe.types.includes(R.TIMBER) && yard.length === 4 && yard[0][1] === 40 && yard.every(([lv]) => lv.recipe.types.includes(R.TIMBER) && lv.recipe.types.includes(R.BIRCH)),
    `every level with timber in play and a floor for it has a log in each round, a floor without has none (${total} rounds); the last chapter is a yard heavy with logs, both trees`);
}

// nothing saved or shared moves where there is no timber: a recipe without it deals the very stacks it always did
{
  const hash = createHash("sha1");
  let rounds = 0;
  for (let i = 0; i < 4; i++) {                                            // the first chapter's cargo is crates and barrels
    for (let k = 1; k <= Lv.LEVELS[i].rounds; k++) {
      const Rd = M.makeRound(Lv.seedOf(i), k, 0, Lv.recipeAt(i, k));
      hash.update(JSON.stringify([Rd.cells, Rd.view, [...Rd.visible], [...Rd.seen], Rd.parts, Rd.orders]));
      rounds++;
    }
  }
  const levels = hash.digest("hex").slice(0, 12);
  console.log(`   (levels ${levels} over ${rounds} rounds)`);
  check(levels === "154eb36d5380", "the first chapter's levels deal the stacks and questions they dealt before timber was always long (a digest of them: change it only for a rebuilt bank, never for logs)");
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
