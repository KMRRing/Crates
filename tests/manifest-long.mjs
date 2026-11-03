// Manifest's long logs (Korbi, 3 November 2026: "yea long logs is good"): oak and birch as one piece filling two cells in a line.
// The rules of it are in manifest-rules.mjs and its solid in manifest-shapes.mjs; this is the engine's part: what the view shows of
// a log, how a team and a change round treat one, what the questions say of it, and that a recipe without long logs deals the
// very stacks it always did (so nothing saved or shared moves).
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

// what the view shows of a log: it is one piece, seen by both its cells, and a log whose half hardly shows is dealt short
{
  const lone = logWith(), px = M.pixelsOf(lone);
  check(M.visibleSet(lone).size === 2 && M.clearSet(lone).size === 2 && px.get("0,0,0") > 90 && px.get("1,0,0") > 90,
    "a long log alone is seen by both its cells, each half showing well over what a piece needs to be pointed at");
  const hidden = logWith(c => { c[1][1] = [1, 1, 1]; });                 // a stack of crates in front hides the whole low half
  check(M.pixelsOf(hidden).get("0,0,0") === 0 && M.visibleSet(hidden).has("0,0,0") && M.visibleSet(hidden).has("1,0,0"),
    "the pixels of a log are added: with one half hidden the log is still seen, by both cells (it is one piece)");
  const kept = logWith(c => { c[2][0] = [1, 1, 1]; });
  const shortened = [hidden, logWith(c => { c[2][0] = [1, 1, 1]; c[2][1] = [1, 1, 1]; }), logWith(c => { c[1][1] = [1, 1, 1]; c[2][0] = [1, 1, 1]; }), logWith(c => { c[0][1] = [1, 1, 1]; })];
  const before = JSON.stringify(kept);
  M.shortenHidden(kept);
  shortened.forEach(c => M.shortenHidden(c));
  check(JSON.stringify(kept) === before && shortened.every(c => !c.flat(2).some(R.isLong) && c[0][0][0] === R.TIMBER && c[1][0][0] === R.TIMBER),
    "seen all at once, a log is dealt long only if both its halves show enough: a trunk going behind a crate is read as a short one, so it is dealt as two");
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
  for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) c[x][y][0] = R.TIMBER;
  c[0][0][1] = c[0][1][1] = R.LONG_OAK;                                    // along y (tier 1), joining snake places 0 and 7
  let problemsFound = 0, atoms = 0;
  for (let n = 2; n <= 6; n++) {
    const parts = M.splitStack(c, n), all = parts.flat();
    if (parts.length !== n || !parts.every(p => p.length) || new Set(all).size !== 10 || all.length !== 10 || !parts.some(p => p.includes("0,0,1") && p.includes("0,1,1") && p.includes("0,0,0") && p.includes("0,1,0")) || !same(M.splitStack(c, n), parts)) problemsFound++;
    atoms++;
  }
  const small = empty(2, 2, 2);
  small[0][0][0] = small[1][0][0] = small[0][1][0] = small[1][1][0] = R.TIMBER;
  small[0][0][1] = small[0][1][1] = R.LONG_OAK;
  check(!problemsFound && M.splitStack(small, 6).length === 3,
    `${atoms} splits of a floor with a log standing on two columns that are far apart in the snake keep both columns with one player (a floor too small for as many parts as players gives fewer parts)`);
  const floor = { ...M.levelOf(9, false), x: 3, y: 2, long: { p: 1, min: 0, max: 3 } };
  let none = 0, n = 0;
  for (let seed = 1; seed <= 20; seed++) { n++; if (!R.pieces(M.makeRound(seed, 9, 6, floor).cells, 0).list.some(p => p.long)) none++; }
  check(none === n, "a floor of six columns deals no long log: a table of six needs six stretches of the floor to share");
}

// change rounds: a long log changes into the other tree's long log in the same two cells; a swap trades two logs of a size
{
  let changes = 0, turnedChanges = 0, swaps = 0, longChanges = 0, longTurned = 0, longSwaps = 0, found = [];
  const base = { ...M.levelOf(12, false), x: 4, y: 3, z: 3, types: [1, 2, 3, 4, 8], views: ["all"], orders: 1, kinds: ["count"], want: [], long: { p: 1, min: 1, max: 3 } };
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
    const L = { ...M.levelOf(r, false), change: null, kinds: ["count", "total", "tier", "weight", "worth", "load", "fits", "column", "spot", "top", "most"], views: ["layers", "all", "slices", "pair"], long: { p: 1, min: 1, max: 3 } };
    const Rd = M.makeRound(seed, r, 0, L);
    for (const o of Rd.orders) {
      kinds[o.type] = (kinds[o.type] || 0) + 1;
      const q = o.question, legend = q.legend ? M.legendRows(q.legend) : [];
      if (["weight", "worth"].includes(o.type)) {
        const longRows = legend.filter(x => R.isLong(x.id));
        // a long log is twice its tree's, one row apiece for every tree in play
        if (longRows.length !== q.legend.types.filter(R.longOf).length || !longRows.every(x => x.name.startsWith("Long ") && x[o.type === "weight" ? "w" : "worth"] === 2 * legend.find(y => y.id === R.typeOf(x.id))[o.type === "weight" ? "w" : "worth"])) found.push(`${seed}/${r} ${o.type}: the key's long rows`);
        rows += longRows.length;
      } else if (legend.some(x => R.isLong(x.id))) found.push(`${seed}/${r} ${o.type}: a key with long rows`);
    }
  }
  if (found.length) console.log("  ", found.slice(0, 6).join("\n   "));
  check(!found.length && rows > 20 && kinds.count && kinds.weight && kinds.worth, `keys: weights and worths carry a row for each long log, twice its tree's (${rows} rows in ${kinds.weight + kinds.worth} questions); no other question has one`);
}

// the picture's model: a long log along y keeps its low half toward low y, and either cell of a log names the log
{
  const Mo = await import("../manifest-model.js");
  const cells = empty(2, 2, 2);
  cells[0][0][0] = cells[1][0][0] = R.LONG_OAK;                          // along x on tier 0
  cells[0][0][1] = cells[0][1][1] = R.LONG_BIRCH;                        // along y on tier 1
  cells[0][1][0] = R.TIMBER;
  const items = Mo.layout(cells, 0, Mo.frameOf(2, 2, 2, M.boxFor(0))), at = k => items.find(c => c.key === k);
  const toward = c => { const yaw = Mo.yawOf(c, 0); return [Math.round(Math.cos(yaw)), Math.round(-Math.sin(yaw))]; };    // where the mesh's high end (+x) points: [x, engine y]
  check(same(toward(at("0,0,0")), [1, 0]) && same(toward(at("0,0,1")), [0, 1]) && at("0,1,0").half == null && Mo.yawOf(at("0,1,0"), 0) === 0,
    "a long log lies along x on an even tier and along y on an odd one, its high end toward high x or y; a short bundle needs no half");
  check(Mo.pieceKey(at("0,1,1")) === "0,0,1" && Mo.pieceKey(at("1,0,0")) === "0,0,0" && Mo.pieceKey(at("0,1,0")) === "0,1,0"
    && same([...Mo.piecesNamed(items, ["0,1,1"])], ["0,0,1"]) && same([...Mo.piecesNamed(items, ["0,0,0", "0,1,0"])].sort(), ["0,0,0", "0,1,0"]),
  "a mark, a tap or a ring on either cell of a log is on the log, by its low cell");
  const box = Mo.joinBox(at("0,0,1").box, at("0,1,1").box);
  check(box.cx === at("0,0,1").box.cx && box.cz === (at("0,0,1").box.cz + at("0,1,1").box.cz) / 2 && box.cy === at("0,0,1").box.cy, "a long log's mesh is centred on the middle of its two cells");
  const turned = Mo.layout(M.turn(cells, 1), 1, Mo.frameOf(2, 2, 2, M.boxFor(1)));
  check(turned.filter(c => c.half === 0).length === 2 && turned.filter(c => c.half === 1).length === 2 && turned.every(c => !R.isLong(c.c) || Mo.pieceKey(c) !== undefined),
    "the layout of a turned stack still has two logs of two halves each (turning keeps a long log long)");
}

// where long logs are dealt: Random from round 10 (after the sacks, with oak alone at first), the last chapter's levels, never before
{
  const count = Rd => Rd.cells.flat(2).filter(R.isLong).length / 2;
  const before = [], from = [];
  for (let seed = 1; seed <= 12; seed++) for (let r = 1; r <= 12; r++) (r < M.LONG_FROM ? before : from).push([r, count(M.makeRound(seed, r))]);
  check(M.LONG_FROM === 10 && before.every(([, n]) => n === 0) && from.every(([, n]) => n >= 1) && from.every(([, n]) => n <= M.levelOf(M.LONG_FROM).long.max),
   `Random deals no long log before round ${M.LONG_FROM} and at least one in each round from it, never more than ${M.levelOf(M.LONG_FROM).long.max}`);
  const last = Lv.LEVELS.map((lv, i) => [lv, i]).filter(([lv]) => lv.recipe.long);
  let short = 0, total = 0;
  for (const [lv, i] of last) for (let k = 1; k <= lv.rounds; k++) for (const seed of [Lv.seedOf(i), 5, 9]) {
    const rc = Lv.recipeAt(i, k), n = count(M.makeRound(seed, k, 0, rc));
    total++;
    if (n < Math.min(rc.long.min, 1) || n > rc.long.max) short++;
  }
  check(last.length === 4 && last[0][1] === 40 && last.every(([lv]) => lv.recipe.types.includes(R.TIMBER) && lv.recipe.types.includes(R.BIRCH)) && !short,
    `the chapter after Gold has the long logs, four levels, both trees in play (${total} rounds, each with a log and within its most)`);
}

// nothing saved or shared moves: a recipe without long logs deals the very stacks it always did
{
  const PLAIN = 8;                                                         // Random's rounds before long logs may come in
  const hash = createHash("sha1");
  let rounds = 0;
  for (let i = 0; i < Lv.COUNT; i++) {
    if (Lv.LEVELS[i].recipe.long) continue;                                // a chapter that has long logs is new and moves nothing
    for (let k = 1; k <= Lv.LEVELS[i].rounds; k++) for (const team of [0]) {
      const Rd = M.makeRound(Lv.seedOf(i), k, team, Lv.recipeAt(i, k));
      hash.update(JSON.stringify([Rd.cells, Rd.view, [...Rd.visible], [...Rd.seen], Rd.parts, Rd.orders]));
      rounds++;
    }
  }
  const levels = hash.digest("hex").slice(0, 12), random = createHash("sha1");
  for (let seed = 1; seed <= 4; seed++) for (let r = 1; r <= PLAIN; r++) for (const team of [0, 4]) {
    const Rd = M.makeRound(seed, r, team);
    random.update(JSON.stringify([Rd.cells, Rd.view, [...Rd.visible], [...Rd.seen], Rd.parts, Rd.orders]));
  }
  const plain = random.digest("hex").slice(0, 12);
  console.log(`   (levels ${levels} over ${rounds} rounds, Random ${plain})`);
  check(M.LONG_FROM > PLAIN && levels === "5c4213f57c88" && plain === "3433bcfe75e0",
    "the first 40 levels and Random's first eight rounds deal the stacks and questions they dealt before long logs existed (a digest of them: change it only for a rebuilt bank, never for long logs)");
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
