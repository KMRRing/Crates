// Delta's generator, quickly: a few boards of every level (Hard fewer: each costs most), each with exactly one drawable answer,
// a solution that is a few long chains weaving across the field (no pair bundled, chain length and wall floors met, the
// operations not handed to the nearest pair by a glance at the map), the same board for the same seed, and every operation
// on exactly one chain. Heavy statistics aren't here (they were run by hand, docs/delta.md has the rulings behind the floors);
// tests/delta.mjs is the slow full check. Run: node tests/delta-gen.mjs
import fs from "fs";
const G = await import("../delta-gen.js");
const M = await import("../delta-metrics.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };
const SEEDS = { easy: 16, medium: 6, hard: 3 }, AGAIN = { easy: 2, medium: 1, hard: 1 };   // seeds per level (Hard costs most); how many are dealt twice for "same seed, same board"
// The same seed must give the same board on every phone (today's board, shared links), and exp, pow, log and the trig
// functions may differ in the last bit between browsers: nothing that deals a board may use them.
for (const f of ["delta-base.js", "delta-shape.js", "delta-metrics.js", "delta-gen.js"]) {
  const code = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  check(!/Math\.(exp|expm1|pow|log\w*|sin|cos|tan\w*|cbrt|hypot)\b/.test(code), `${f}: a Math function that differs between browsers`);
}
// the measures themselves, on lanes small enough to count by hand: two straight lanes side by side touch 1 + 2 + 2 times;
// a lane that doubles back on itself has walls of its own, which separate nothing
{
  const A = ["0,0", "1,0", "2,0"], B = ["0,1", "1,1", "2,1"], fold = ["0,0", "1,0", "1,1", "0,1"];
  const w = M.wallsOf([A, B]);
  check(w.cross === 5 && w.self === 0 && w.perPath.join() === "5,5", `two lanes side by side: ${w.cross} walls between them, expected 5`);
  const f = M.wallsOf([fold]);
  check(f.cross === 0 && f.self === 2, `a lane touching itself: ${f.self} walls of its own, expected 2`);
  const straight = { cells: [], ops: {}, sol: [{ from: "0,0", to: "4,0", cells: ["0,0", "1,0", "2,0", "3,0", "4,0"] }] };
  check(M.shapeOf(straight).bundled === 1, "a straight run from one number to the other counts as bundled");
}
const pairing = s => s.map(x => [x.from, x.to].sort().join("~")).sort().join("|");

for (const [level, count] of Object.entries(SEEDS)) {
  const L = G.LEVELS[level], want = L.shape;
  const worst = { walls: Infinity, len: Infinity, bundled: 0 }, t0 = process.cpuUsage();
  for (let n = 1; n <= count; n++) {
    const seed = 424200 + n * 7919, board = G.generate(seed, level), tag = `${level} seed ${seed}`;
    if (!board) { check(false, `${tag}: no board`); continue; }

    // exactly one drawable answer: the one the board was built from
    const { solutions, opKeys } = G.arithmeticSolutions(board, L.candidates * 4 + 1);
    const drawable = solutions.filter(s => { const r = G.routeAll(board, opKeys, s); return r && r !== "unknown"; });
    check(drawable.length === 1 && pairing(drawable[0]) === pairing(board.sol), `${tag}: ${drawable.length} drawable answers`);
    check(G.isSolved(board, board.sol.map(p => p.cells)), `${tag}: its own solution doesn't check out`);

    // every operation on exactly one chain; chains don't share a hex; each runs from a number to a number with none between
    const onChains = board.sol.flatMap(p => p.cells.filter(k => k in board.ops));
    check(onChains.length === Object.keys(board.ops).length && new Set(onChains).size === onChains.length, `${tag}: an operation isn't used exactly once`);
    const covered = board.sol.flatMap(p => p.cells);
    check(new Set(covered).size === covered.length, `${tag}: two chains share a hex`);
    check(board.sol.every(p => p.cells[0] in board.nums && p.cells.at(-1) in board.nums && p.cells.slice(1, -1).every(k => !(k in board.nums))), `${tag}: a chain doesn't run from number to number`);
    check(board.sol.length === L.pairs, `${tag}: ${board.sol.length} pairs`);

    // the shape: long chains, far apart ends, woven (the floors the generator holds a board to; docs/delta.md)
    const shape = M.shapeOf(board);
    worst.walls = Math.min(worst.walls, shape.walls.cross); worst.len = Math.min(worst.len, ...shape.pairs.map(p => p.len)); worst.bundled += shape.bundled;
    check(shape.bundled === 0, `${tag}: ${shape.bundled} bundled pairs`);
    check(shape.pairs.every(p => p.len >= want.minLen), `${tag}: a chain of ${Math.min(...shape.pairs.map(p => p.len))} hexes, floor ${want.minLen}`);
    check(shape.pairs.every(p => p.dist >= want.minDist), `${tag}: ends ${Math.min(...shape.pairs.map(p => p.dist))} apart, floor ${want.minDist}`);
    check(shape.walls.cross >= want.walls, `${tag}: ${shape.walls.cross} walls between chains, floor ${want.walls}`);
    check(Math.min(...shape.walls.perPath) >= want.each, `${tag}: a chain with ${Math.min(...shape.walls.perPath)} walls, floor ${want.each}`);
    check(shape.coverage >= want.cover, `${tag}: covers ${shape.coverage.toFixed(2)} of the field, floor ${want.cover}`);
    check(!G.guessable(board), `${tag}: giving each operation to its nearest pair already solves it`);
    check(board.decoys >= 0 && board.lures >= 0, `${tag}: no decoy and lure counts`);

    if (n <= AGAIN[level]) check(JSON.stringify(G.generate(seed, level)) === JSON.stringify(board), `${tag}: the same seed gave another board`);
  }
  console.log(`${level}: ${count} boards; fewest walls ${worst.walls}, shortest chain ${worst.len}, bundled ${worst.bundled} (${Math.round(process.cpuUsage(t0).user / 1000)} ms of cpu)`);
}
console.log(bad ? `${bad} problems` : "all generated boards check out");
if (bad) process.exitCode = 1;
