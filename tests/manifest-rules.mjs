// Manifest's cargo and stacking rules: the tables are consistent (heavy goes low, what may be under what is the inverse
// of what may carry what), the validator catches every kind of break, the generator builds only stacks that pass it, the
// same seed makes the same round, and every question of every Random round has exactly one answer that an observer
// shown only what the view showed reaches from the rules (tests/manifest-observer.js).
const R = await import("../manifest-rules.js");
const M = await import("../manifest-engine.js");
const { problems } = await import("./manifest-observer.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const stack =(...ts) => [[[...ts.map(t => R.CARGO.findIndex(c => c.key === t) + 1), 0, 0, 0, 0].slice(0, 4)]];

// the tables
{
  const ids = R.CARGO.map(c => c.id);
  check(R.CARGO.length === 8 && ids.every((id, i) => id === i + 1) && R.CARGO.every(c => Number.isInteger(c.w) && c.w > 0 && Number.isInteger(c.worth) && c.worth > 0) && R.GOLD === 7 && R.BIRCH === 8 && R.TIMBER === 3 && R.INGOT === 4,
    "eight cargo types, numbered 1 to 8, with a weight and a worth each (gold and birch were added at the end: nothing saved or shared is renumbered, oak is still 3)");
  const inverse = R.CARGO.every(a => R.CARGO.every(b => R.CARRIES[b.id].includes(a.id) === R.UNDER[a.id].includes(b.id)));
  check(inverse && R.CARGO.every(c => R.UNDER[c.id].includes(0)), "what may lie under a type is the inverse of what may carry it, and the quay carries all");
  const heavyLow = R.CARGO.every(b => R.CARRIES[b.id].every(a => R.weightOf(a) <= R.weightOf(b.id)));
  check(heavyLow, "heavy goes low: nothing is carried by something lighter than itself");
  const order = ["gold", "ingot", "timber", "birch", "crate", "barrel", "chest", "sack"].map(k => R.CARGO.find(c => c.key === k));
  check(order.every((c, i) => c && (!i || order[i - 1].w > c.w)) && R.CARGO.find(c => c.key === "gold").worth === Math.max(...R.CARGO.map(c => c.worth)) && R.CARGO.find(c => c.key === "chest").worth === Math.max(...R.CARGO.filter(c => c.key !== "gold").map(c => c.worth)),
    "the order is the weights: gold > ingots > oak > birch > crates > barrels > chests > sacks (gold is worth the most, then a chest: worth is not the order)");
  const on = (t, u) => R.CARRIES[u].includes(t);   // may t stand on u
  check(R.CARRIES[R.CHEST].length === 0 && R.CARRIES[R.INGOT].includes(R.CHEST) && R.CARRIES[R.SACK].join() === String(R.SACK) && R.UNDER[R.INGOT].filter(t => t !== R.INGOT && t !== 0).every(t => R.weightOf(t) > R.weightOf(R.INGOT)),
    "a chest carries nothing, ingots carry all but heavier ingots, a sack is carried only by sacks, ingots stand on the quay or on ingots (or heavier)");
  check(on(R.CRATE, R.TIMBER) && on(R.BARREL, R.CRATE) && on(R.CHEST, R.BARREL) && on(R.SACK, R.BARREL) && !on(R.CRATE, R.BARREL) && !on(R.BARREL, R.SACK) && !on(R.TIMBER, R.CRATE) && !on(R.INGOT, R.TIMBER) && !on(R.CRATE, R.CHEST),
    "no crate on a barrel, no barrel under a crate, no timber on a crate, no ingots on timber; a chest or a sack may top a barrel, and nothing stands on a chest");
  check(on(R.BIRCH, R.TIMBER) && on(R.CRATE, R.BIRCH) && on(R.BIRCH, R.INGOT) && on(R.BIRCH, R.BIRCH) && !on(R.TIMBER, R.BIRCH) && !on(R.BIRCH, R.CRATE) && R.isTimber(R.TIMBER) && R.isTimber(R.BIRCH) && !R.isTimber(R.INGOT),
    "birch stands on oak, ingots, gold or birch and carries crates; oak does not stand on birch, birch not on a crate; both are timber");
  check(R.UNDER[R.GOLD].join() === `0,${R.GOLD}` && on(R.INGOT, R.GOLD) && on(R.CHEST, R.GOLD) && !on(R.GOLD, R.INGOT) && !on(R.GOLD, R.TIMBER) && R.CARRIES[R.GOLD].length === R.TYPES,
    "gold stands only on the quay or on gold, and carries every type");
  check(R.axisOf(0) === "x" && R.axisOf(1) === "y" && R.axisOf(2) === "x" && R.axisOf(0, 1) === "y" && R.axisOf(1, 1) === "x", "timber lies along x on an even tier and along y on an odd one; a turn swaps them (so timber on timber crosses)");
}

// the validator
{
  const ok = (...ts) => R.validate(stack(...ts), 4);
  check(!ok("crate", "crate", "sack").length && !ok("ingot", "chest").length && !ok("crate", "barrel", "barrel").length && !ok("timber", "timber").length && !ok("ingot", "timber", "crate", "barrel").length && !ok("timber", "crate", "chest").length, "stacks that follow the rules pass");
  const breaks = [["ingot", "gold"], ["birch", "timber"], ["crate", "birch"], ["chest", "crate"], ["chest", "chest"], ["crate", "ingot"], ["barrel", "ingot"], ["barrel", "crate"], ["barrel", "timber"], ["crate", "barrel", "crate"], ["sack", "crate"], ["chest", "sack"], ["timber", "ingot"], ["crate", "timber"]];
  check(breaks.every(b => ok(...b).length), `each of ${breaks.length} breaks of the carrying rule is found (${breaks.map(b => b.join("/")).join(", ")})`);
  check(ok("crate", "crate", "crate", "crate").length && ok("barrel", "barrel", "barrel", "barrel").length && ok("sack", "sack", "sack", "sack").length && !ok("ingot", "ingot", "ingot", "ingot").length && !ok("gold", "ingot", "timber", "birch").length && !ok("gold", "gold", "gold", "gold").length && ok("birch", "birch", "birch", "birch").length, "a column too heavy for its lowest piece is found (four crates, barrels, birch or sacks; four ingots or gold are fine)");
  check(R.validate([[[0, 1, 0]]], 4).length && R.validate([[[1, 0, 1]]], 4).length, "a floating piece is found, with the gap below it or at the quay");
  check(R.validate(stack("crate", "crate", "crate"), 2).length && R.validate([[[R.CODES + 1]]], 4).length, "a piece above the quay's tier limit, and a type that doesn't exist, are found");
  check(R.room([], R.CRATE, 4) === 3 && R.room([], R.INGOT, 4) === 4 && R.room([], R.GOLD, 4) === 4 && R.room([R.GOLD], R.INGOT, 4) === 3 && R.room([R.INGOT], R.GOLD, 4) === 0 && R.room([], R.BARREL, 4) === 3 && R.room([], R.SACK, 4) === 3 && R.room([R.CHEST], R.CRATE, 4) === 0
    && R.room([R.INGOT], R.CHEST, 4) === 1 && R.room([R.INGOT, R.CRATE], R.SACK, 3) === 1 && R.room([R.CRATE, R.CRATE], R.CRATE, 4) === 1 && R.room([R.BARREL], R.CRATE, 4) === 0 && R.room([R.CRATE], R.BARREL, 4) === 3,
  "room: how many more of a type go on a column, by support, load and the tier limit");
  check(R.loadAbove([R.INGOT, R.CRATE, R.SACK], 0) === 5 && R.loadAbove([R.INGOT, R.CRATE, R.SACK], 2) === 0, "the load on a piece is the weight of everything above it");
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), all = R.CARGO.map(c => c.id);
  check(same(R.deduceColumn([R.CRATE, null, R.CRATE]), [1, 1, 1]) && same(R.deduceColumn([R.INGOT, null, R.INGOT]), [4, 4, 4]) && R.deduceColumn([null, R.CRATE]) === null && R.deduceColumn([R.CRATE, null]) === null
    && same(R.deduceColumn([null, null, R.CHEST], [R.INGOT, R.CHEST]), [4, 4, 5]) && R.deduceColumn([null, null, R.CHEST], all) === null,
  "a hidden piece is named only where the rules leave one way (between two of a kind; or by the cargo in play), else it isn't");
}

// long logs (Korbi, 3 November 2026: "yea long logs is good"): oak and birch as one piece filling two cells in a line
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check(R.LONG_OAK === 9 && R.LONG_BIRCH === 10 && R.CODES === 10 && R.TYPES === 8 && R.CARGO.length === 8 && R.TIMBER === 3 && R.BIRCH === 8,
    "the long logs are cell codes 9 and 10, after the eight types: nothing saved or shared is renumbered");
  check(R.typeOf(9) === R.TIMBER && R.typeOf(10) === R.BIRCH && R.typeOf(5) === 5 && R.longOf(R.TIMBER) === 9 && R.longOf(R.BIRCH) === 10 && R.longOf(R.CRATE) === 0
    && R.isLong(9) && R.isLong(10) && !R.isLong(8) && !R.isLong(0) && R.isTimber(9) && R.isTimber(10) && R.weightOf(9) === R.weightOf(R.TIMBER) && R.worthOf(10) === R.worthOf(R.BIRCH),
  "a cell of a long log is its tree's: its type, its weight and its worth (the piece is two cells, so twice)");
  const two = [[[9]], [[9]]], four = [[[10]], [[10]], [[10]], [[10]]];
  const one = R.pieces(two);
  check(one.list.length === 1 && one.list[0].long && one.list[0].key === "0,0,0" && same(one.list[0].cells, [[0, 0, 0], [1, 0, 0]]) && one.list[0].type === R.TIMBER && one.at.get("1,0,0") === one.list[0]
    && !R.validate(two, 4).length && R.totals(two).w === 12 && R.totals(two).v === 6 && R.totals(four).w === 20 && R.totals(four).v === 16,
  "two cells of a long code in a line along the tier's axis are one piece, named by its low cell, and weigh and are worth twice a short one");
  const run = R.pieces(four);
  check(run.list.length === 2 && run.at.get("3,0,0").key === "2,0,0" && run.at.get("1,0,0").key === "0,0,0" && !R.validate(four, 4).length,
    "a run of one long code is paired from its low end: two logs end to end");
  const lone = [R.validate([[[9]], [[9]], [[9]]], 4), R.validate([[[9]], [[10]]], 4), R.validate([[[9], [9]]], 4)];
  check(lone.every(v => v.some(w => /long log with no other half/.test(w))) && R.pieces([[[9]], [[9]], [[9]]]).broken.length === 1 && R.pieces([[[9]], [[10]]]).broken.length === 2,
    "a long log with no other half is found (an odd run, two trees side by side, one standing across the tier's axis)");
  const turned = M.turn(two, 1);
  check(turned.length === 1 && turned[0].length === 2 && !R.validate(turned, 4, 1).length && R.validate(turned, 4, 0).length && R.pieces(turned, 1).list[0].key === "0,0,0"
    && [0, 1, 2, 3].every(t => !R.validate(M.turn(four, t), 4, t).length && R.pieces(M.turn(four, t), t).list.length === 2),
  "turning a stack moves its codes and nothing else: a log keeps its two cells, read along the way the turned tier lies");
  const crossed = [[[3, 9], [3, 9]]];
  check(!R.validate(crossed, 4).length && R.validate([[[3, 9], [0, 9]]], 4).some(w => /floats/.test(w)) && R.validate([[[1, 9], [1, 9]]], 4).some(w => /timber on a crate/.test(w))
    && R.validate([[[5, 9], [5, 9]]], 4).length && !R.validate([[[3, 9, 1], [3, 9, 1]]], 4).length,
  "each half stands on what is under it, on the same tier as the other (no overhang): the support and carrying rules are per cell");
  check(!R.canPlace([R.CRATE], R.LONG_OAK, 4) && R.canPlace([R.INGOT], R.LONG_BIRCH, 4) && R.canPlace([R.LONG_OAK], R.CRATE, 4) && !R.canPlace([R.LONG_BIRCH], R.TIMBER, 4)
    && R.room([R.LONG_OAK], R.CRATE, 4) === R.room([R.TIMBER], R.CRATE, 4) && R.loadAbove([R.LONG_OAK, R.CRATE, R.SACK], 0) === 5,
  "a cell of a long log carries, bears and is carried as its tree's cell does");
}

// the generator: every stack of every Random round passes the validator, repeatably
{
  let stacks = 0, tall = 0, kinds = {}, types = new Set(), problemsFound = [], column = 0;
  for (let seed = 1; seed <= 16; seed++) for (let r = 1; r <= M.ROUNDS; r++) {
    const a = M.makeRound(seed, r), b = M.makeRound(seed, r);
    stacks++;
    if (JSON.stringify(a.cells) !== JSON.stringify(b.cells) || JSON.stringify(a.orders) !== JSON.stringify(b.orders)) problemsFound.push(`${seed}/${r} isn't repeatable`);
    problemsFound.push(...problems(a, `${seed}/${r}`));
    if (a.cells.some(c => c.some(row => row.filter(Boolean).length >= 3))) tall++;
    a.cells.flat(2).forEach(t => t && types.add(R.typeOf(t)));
    for (const o of a.orders) kinds[o.type] = (kinds[o.type] || 0) + 1;
  }
  if (problemsFound.length) console.log("  ", problemsFound.slice(0, 6).join("\n   "));
  check(!problemsFound.length, `${stacks} Random rounds: every stack obeys the rules, repeats from its seed, and every question is answerable by an observer shown only what the view showed`);
  check(types.size === R.TYPES && tall > stacks / 4, `every cargo type turns up, and ${tall} stacks have a column three high`);
  const asked = Object.keys(kinds);
  check(["weight", "worth", "load", "fits"].every(k => kinds[k] > 5), `the new questions are asked (${asked.map(k => `${k} ${kinds[k]}`).join(", ")})`);
}

// a round dealt for a recipe that wants a question carries it
{
  const L = { ...M.levelOf(12), change: null, kinds: ["count", "total", "column"], want: ["column"], views: ["all"], x: 4, y: 3, z: 3, types: [1, 2, 3, 4, 5] };
  let got = 0, n = 0;
  for (let seed = 1; seed <= 30; seed++) { const a = M.makeRound(seed, 1, 0, L); n++; if (a.orders.some(o => o.type === "column")) got++; }
  check(got === n, `a recipe that wants a column question gets one (${got} of ${n} seeds), by dealing the stack again from the seed's own stream`);
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
