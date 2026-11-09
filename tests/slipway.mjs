// Slipway's rules (slipway-rules.js): each level has exactly one answer, the published answer is it, kinds and tools do what they say.
// Run: node tests/slipway.mjs
const R = await import("../slipway-rules.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };
// two cuts are the same when two cubes share a piece in one exactly when they do in the other
const same = (a, b) => a.every((v, i) => a.every((w, k) => (v === w) === (b[i] === b[k])));

for (const lv of R.LEVELS) {
  const paint = Uint8Array.from(lv.sol, v => v + 1);
  check(lv.sol.length === lv.n ** 3, `${lv.id}: an answer for every cube`);
  check(R.judge(lv, paint).done, `${lv.id}: the published answer satisfies every clue`);
  const s = R.solutions(lv, 2);
  check(!s.aborted && s.sols.length === 1, `${lv.id}: exactly one answer (${s.nodes} steps)`);
  check(s.sols[0] && same(s.sols[0], lv.sol), `${lv.id}: the solver's answer is the published cut`);
  const broken = paint.slice(); broken[0] = 9;
  check(!R.judge(lv, broken).done, `${lv.id}: a wrong painting is not done`);
}
{
  const n = 3, k = cells => R.kindOf(n, cells.map(([x, y, z]) => R.at(n, x, y, z)));
  check(k([[0, 0, 0]]) === "cube" && k([[0, 0, 0], [1, 0, 0], [2, 0, 0]]) === "bar" && k([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]]) === "plank", "kinds: single, bar, plank");
  check(k([[0, 0, 0], [1, 0, 0], [0, 1, 0]]) === "bend" && k([[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]]) === "knot", "kinds: bends are flat, knots are not");
  check(k([...Array(8).keys()].map(i => [i & 1, i >> 1 & 1, i >> 2 & 1])) === "block", "kinds: a 2×2×2 is a block");
}
{
  const n = 3, c = R.at(n, 1, 1, 1);
  check(R.reach(n, "chisel", 2, c).length === 1 && R.reach(n, "bore", 0, c).length === 3 && R.reach(n, "saw", 2, c).length === 9, "tools: chisel one, bore three, saw nine");
  check(R.reach(n, "saw", 2, c).every(k => R.xyz(n, k)[2] === 1) && R.reach(n, "bore", 0, c).every(k => R.xyz(n, k)[1] === 1 && R.xyz(n, k)[2] === 1), "tools: the saw keeps its height, the bore its row");
}
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all ok");
