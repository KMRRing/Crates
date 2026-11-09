// Slipway's rules (slipway-rules.js): each level has exactly one answer, the published answer is it, kinds and tools do what they say.
// Run: node tests/slipway.mjs
const R = await import("../slipway-rules.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };
// two cuts are the same when two cubes share a piece in one exactly when they do in the other
const same = (a, b) => a.every((v, i) => a.every((w, k) => (v === w) === (b[i] === b[k])));

// the cuts that make an answer: every joint between cubes that are in different pieces of it
const cutsFor = (lv, sol) => { const s = new Set(); R.neighbours(lv.n).forEach((nb, c) => nb.forEach(o => { if (c < o && sol[c] !== sol[o]) s.add(R.joint(c, o)); })); return s; };
for (const lv of R.LEVELS) {
  check(lv.sol.length === lv.n ** 3, `${lv.id} ${lv.name}: an answer for every cube`);
  check(R.judge(lv, new Set()).done === false, `${lv.id}: the whole block is not the answer`);
  check(R.judge(lv, cutsFor(lv, lv.sol)).done, `${lv.id}: cutting the published answer satisfies every clue`);
  const s = R.solutions(lv, 2);
  check(!s.aborted && s.sols.length === 1, `${lv.id}: exactly one answer (${s.nodes} steps)`);
  check(s.sols[0] && same(s.sols[0], lv.sol), `${lv.id}: the solver's answer is the published cut`);
}
{
  const n = 3, k = cells => R.kindOf(n, cells.map(([x, y, z]) => R.at(n, x, y, z)));
  check(k([[0, 0, 0]]) === "cube" && k([[0, 0, 0], [1, 0, 0], [2, 0, 0]]) === "bar" && k([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]]) === "plank", "kinds: single, bar, plank");
  check(k([[0, 0, 0], [1, 0, 0], [0, 1, 0]]) === "bend" && k([[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]]) === "knot", "kinds: bends are flat, knots are not");
  check(k([...Array(8).keys()].map(i => [i & 1, i >> 1 & 1, i >> 2 & 1])) === "block", "kinds: a 2×2×2 is a block");
}
{
  const n = 3, c = R.at(n, 1, 1, 1), top = R.at(n, 1, 1, 2), none = new Set();
  const chisel = R.useTool(n, "chisel", 2, 1, top, none);
  check(chisel.add.length === 1 && chisel.add[0] === R.joint(top, c), "tools: a chisel from the top face breaks the joint to the cube below");
  const again = R.useTool(n, "chisel", 2, 1, top, new Set(chisel.add));
  check(again.add[0] === R.joint(c, R.at(n, 1, 1, 0)), "tools: the chisel goes on to the next whole joint going in");
  check(R.useTool(n, "chisel", 2, 1, top, new Set([...chisel.add, ...again.add])) === null, "tools: and then has nothing left to break");
  const saw = R.useTool(n, "saw", 2, 1, top, none);
  check(saw.add.length === 9 && saw.add.every(k => { const [a, b] = k.split("-").map(Number); return Math.abs(R.xyz(n, a)[2] - R.xyz(n, b)[2]) === 1; }), "tools: a saw breaks the nine joints of a plane");
  const bore = R.useTool(n, "bore", 2, 1, c, none);
  check(bore.add.length === 12, `tools: a bore through the middle of a 3-block breaks the 12 joints beside its rod (${bore.add.length})`);
  check(R.pieces(n, new Set(bore.add)).length === 2 && R.pieces(n, new Set(bore.add)).some(p => p.length === 3), "tools: after a bore the rod is a piece of its own");
  const glue = R.useTool(n, "glue", 2, 1, top, new Set(chisel.add));
  check(glue.remove[0] === chisel.add[0] && R.useTool(n, "glue", 2, 1, top, none) === null, "tools: glue mends a broken joint, and does nothing where none is broken");
}
// hints: doing what they say cuts the block; a cut through a piece is glued back first
for (const lv of R.LEVELS) {
  let now = new Set(), steps = 0; const texts = [];
  for (; steps < 20; steps++) {
    const h = R.hint(lv, now);
    if (!h) break;
    texts.push(h.text);
    for (const k of h.op.add) now.add(k);
    for (const k of h.op.remove) now.delete(k);
  }
  check(steps > 0 && R.judge(lv, now).done, `${lv.id}: following the hints cuts the block in ${steps} steps`);
  check(texts.every(t => /says|No number/.test(t)), `${lv.id}: every hint says which clue it uses`);
  // a cut through a piece of the answer: every joint of its first cube broken, so the cube is alone (when its piece has others)
  const sol = lv.sol, wrong = new Set(R.neighbours(lv.n)[0].map(o => R.joint(0, o)));
  if (sol.some((v, c) => c && v === sol[0])) { const h = R.hint(lv, wrong); check(h && /split|cut has/.test(h.text) && h.op.remove.length > 0, `${lv.id}: a cut through a piece is named before anything else`); }
}
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all ok");
