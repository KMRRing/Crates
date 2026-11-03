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
  check(R.CARGO.length === 6 && ids.every((id, i) => id === i + 1) && R.CARGO.every(c => Number.isInteger(c.w) && c.w > 0 && Number.isInteger(c.worth) && c.worth > 0), "six cargo types, numbered 1 to 6, with a weight and a worth each");
  const inverse = R.CARGO.every(a => R.CARGO.every(b => R.CARRIES[b.id].includes(a.id) === R.UNDER[a.id].includes(b.id)));
  check(inverse && R.CARGO.every(c => R.UNDER[c.id].includes(0)), "what may lie under a type is the inverse of what may carry it, and the quay carries all");
  const heavyLow = R.CARGO.every(b => R.CARRIES[b.id].every(a => R.weightOf(a) <= R.weightOf(b.id)));
  check(heavyLow, "heavy goes low: nothing is carried by something lighter than itself");
  check(R.CARRIES[R.CHEST].length === 0 && R.CARRIES[R.INGOT].length === 6 && R.SOLE_UNDER[R.CHEST] === R.INGOT && R.SOLE_UNDER[R.INGOT] === R.INGOT && R.SOLE_UNDER[R.CRATE] === 0,
    "a chest carries nothing, ingots carry all; a chest or ingots above the first tier can only stand on ingots");
  check(R.axisOf(0) === "x" && R.axisOf(1) === "y" && R.axisOf(2) === "x" && R.axisOf(0, 1) === "y" && R.axisOf(1, 1) === "x", "timber lies along x on an even tier and along y on an odd one; a turn swaps them (so timber on timber crosses)");
}

// the validator
{
  const ok = (...ts) => R.validate(stack(...ts), 4);
  check(!ok("crate", "crate", "sack").length && !ok("ingot", "chest").length && !ok("barrel", "barrel", "crate").length && !ok("timber", "timber").length && !ok("ingot", "timber", "timber").length, "stacks that follow the rules pass");
  const breaks = [["chest", "crate"], ["crate", "chest"], ["crate", "ingot"], ["barrel", "ingot"], ["timber", "barrel"], ["barrel", "timber"], ["barrel", "crate", "barrel"], ["sack", "crate"], ["chest", "sack"]];
  check(breaks.every(b => ok(...b).length), `each of ${breaks.length} breaks of the carrying rule is found (${breaks.map(b => b.join("/")).join(", ")})`);
  check(ok("crate", "crate", "crate", "crate").length && ok("barrel", "barrel", "barrel", "barrel").length && ok("sack", "sack", "sack", "sack").length && !ok("ingot", "ingot", "ingot", "ingot").length, "a column too heavy for its lowest piece is found (four crates, barrels or sacks; four ingots are fine)");
  check(R.validate([[[0, 1, 0]]], 4).length && R.validate([[[1, 0, 1]]], 4).length, "a floating piece is found, with the gap below it or at the quay");
  check(R.validate(stack("crate", "crate", "crate"), 2).length && R.validate([[[9]]], 4).length, "a piece above the quay's tier limit, and a type that doesn't exist, are found");
  check(R.room([], R.CRATE, 4) === 3 && R.room([], R.INGOT, 4) === 4 && R.room([], R.BARREL, 4) === 3 && R.room([], R.SACK, 4) === 3 && R.room([R.CHEST], R.CRATE, 4) === 0
    && R.room([R.INGOT], R.CHEST, 4) === 1 && R.room([R.INGOT, R.CRATE], R.SACK, 3) === 1 && R.room([R.CRATE, R.CRATE], R.CRATE, 4) === 1 && R.room([R.BARREL], R.CRATE, 4) === 3,
  "room: how many more of a type go on a column, by support, load and the tier limit");
  check(R.loadAbove([R.INGOT, R.CRATE, R.SACK], 0) === 3 && R.loadAbove([R.INGOT, R.CRATE, R.SACK], 2) === 0, "the load on a piece is the weight of everything above it");
  const d = R.deduceColumn([null, null, R.CHEST]), e = R.deduceColumn([null, R.CRATE]), f = R.deduceColumn([R.CRATE, null, R.INGOT]);
  check(JSON.stringify(d) === JSON.stringify([4, 4, 5]) && e === null && JSON.stringify(f) === JSON.stringify([1, 4, 4]) && R.deduceColumn([R.CRATE, null]) === null,
    "what is under a chest or ingots is deduced all the way down; under anything else it isn't");
}

// the generator: every stack of every Random round passes the validator, repeatably
{
  let stacks = 0, tall = 0, kinds = {}, types = new Set(), problemsFound = [], column = 0;
  for (let seed = 1; seed <= 40; seed++) for (let r = 1; r <= M.ROUNDS; r++) {
    const a = M.makeRound(seed, r), b = M.makeRound(seed, r);
    stacks++;
    if (JSON.stringify(a.cells) !== JSON.stringify(b.cells) || JSON.stringify(a.orders) !== JSON.stringify(b.orders)) problemsFound.push(`${seed}/${r} isn't repeatable`);
    problemsFound.push(...problems(a, `${seed}/${r}`));
    if (a.cells.some(c => c.some(row => row.filter(Boolean).length >= 3))) tall++;
    a.cells.flat(2).forEach(t => t && types.add(t));
    for (const o of a.orders) kinds[o.type] = (kinds[o.type] || 0) + 1;
  }
  if (problemsFound.length) console.log("  ", problemsFound.slice(0, 6).join("\n   "));
  check(!problemsFound.length, `${stacks} Random rounds: every stack obeys the rules, repeats from its seed, and every question is answerable by an observer shown only what the view showed`);
  check(types.size === 6 && tall > stacks / 4, `all six cargo types turn up, and ${tall} stacks have a column three high`);
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
