// Manifest: runs are twelve repeatable rounds; stacks obey gravity and stay within 4×4×3 and five colours; every order
// is fair (its answer among its options and answerable from what the view showed); turning is consistent; the
// which-stack question has four different stacks with exactly one the true one turned, and its mirror decoy is no
// turn of the stack; change rounds change what they say they change, among containers you could see; prices
// follow the round and your record.
const M = await import("../manifest-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const fail = (...why) => { bad++; console.log("  ", ...why); };
const key = (x, y, z) => `${x},${y},${z}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let orders = 0, rounds = 0;
const byType = {}, byView = {};
for (let seed = 1; seed <= 60; seed++) for (let r = 1; r <= M.ROUNDS; r++) {
  const a = M.makeRound(seed, r), b = M.makeRound(seed, r), L = a.level;
  rounds++;
  if (!same(a.cells, b.cells) || !same(a.orders, b.orders)) fail("not repeatable", seed, r);
  if (a.cells.length !== L.x || a.cells[0].length !== L.y || a.cells[0][0].length !== L.z || L.x > 4 || L.y > 4 || L.z > 3 || L.colours > 5) fail("size", seed, r);
  a.cells.forEach(col => col.forEach(row => { for (let z = 1; z < row.length; z++) if (row[z] && !row[z - 1]) fail("floating container", seed, r); }));
  if (Boolean(L.change) !== (r % 4 === 0)) fail("change round in the wrong place", seed, r);
  byView[a.view] = (byView[a.view] || 0) + 1;
  const types = a.orders.map(o => o.type);
  if (new Set(types).size !== types.length) fail("two orders of one kind", seed, r, types);
  if (!L.change && a.orders.length < Math.min(L.orders, 3)) fail("too few orders", seed, r, a.orders.length);
  const X = L.x, Y = L.y;
  for (const o of a.orders) {
    orders++;
    byType[o.type] = (byType[o.type] || 0) + 1;
    const q = o.question;
    if (!o.posted || !q.text) fail("an order without words", seed, r, o.type);
    if (q.as === "number" && (!q.options.includes(q.answer) || q.options.length !== 5 || q.options.some(v => v < 0))) fail("number options", seed, r, q);
    if (q.as === "colour" && !q.options.includes(q.answer)) fail("colour options", seed, r, q);
    if (q.cell) {
      const { x, y, z } = q.cell, k = key(x, y, z);
      if (!a.cells[x][y][z]) fail("a marked cell that's empty", seed, r, o.type);
      if (a.view === "all" && !a.visible.has(k)) fail("all at once, asking about a hidden container", seed, r, o.type);
      if (a.view === "pair" && z > 1) fail("two-tier view, asking above tier 2", seed, r, o.type);
      if (q.as === "colour" && a.cells[x][y][z] !== q.answer) fail("marked cell's colour isn't the answer", seed, r, o.type);
    }
    if (o.type === "turned") {
      const t = M.turn(a.cells, q.turns), [x, y, z] = q.at.split(",").map(Number);
      if (t[x][y][z] !== q.answer) fail("turned spot doesn't carry the colour", seed, r);
      if (!M.visibleSet(t, M.boxFor(q.turns)).has(q.at)) fail("turned spot can't be seen", seed, r);
    }
    if (o.type === "which") {
      const truth = M.turn(a.cells, q.turns);
      if (q.stacks.length !== 4 || q.stacks.filter(s => same(s, truth)).length !== 1 || !same(q.stacks[q.answer], truth)) fail("which-stack options", seed, r);
      if (new Set(q.stacks.map(s => JSON.stringify(s))).size !== 4) fail("which-stack options not all different", seed, r);
      const mirrorTurned = M.turn(M.mirror(a.cells), q.turns);
      if (q.stacks.some(s => same(s, mirrorTurned)) && [0, 1, 2, 3].some(t => same(M.turn(a.cells, t), M.mirror(a.cells)))) fail("mirror decoy is a turn of the stack", seed, r);
    }
    if (o.type === "change" || o.type === "changeTurned") {
      const back = M.turn(q.back, (4 - q.turns) % 4);        // undo the turn to compare with the stack you saw
      let diffs = [];
      a.cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c !== back[x][y][z]) diffs.push(key(x, y, z)); })));
      if (diffs.length !== 1 || diffs[0] !== key(q.cell.x, q.cell.y, q.cell.z) || !a.visible.has(diffs[0])) fail("a change round should change one container you could see", seed, r, diffs);
      if (M.turnKey(q.cell.x, q.cell.y, q.cell.z, X, Y, q.turns) !== q.answer) fail("change answer not where the container went", seed, r);
      if (!M.visibleSet(q.back, M.boxFor(q.turns)).has(q.answer)) fail("the changed container can't be seen when it's back", seed, r);
    }
    if (o.type === "swap") {
      const diffs = [];
      a.cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c !== q.back[x][y][z]) diffs.push(key(x, y, z)); })));
      const tally = s => JSON.stringify(s.flat(2).filter(Boolean).sort());
      if (!same(diffs.sort(), q.answer) || !diffs.every(k => a.visible.has(k)) || tally(a.cells) !== tally(q.back)) fail("a swap round should swap two containers you could see", seed, r, diffs);
    }
  }
}
check(bad === 0, `${rounds} rounds, ${orders} orders, all fair (${JSON.stringify(byType)}; views ${JSON.stringify(byView)})`);
const L = [1, 4, 8, 12].map(M.levelOf);
check(L.map(l => l.change).join() === ",colour,turned,swap", `change rounds 4, 8, 12: ${L.slice(1).map(l => l.change).join(", ")}`);
// turning
{
  const c = M.makeRound(7, 9).cells;
  const ok = same(M.turn(M.turn(c, 1), 3), c) && same(M.turn(c, 4), c) && [1, 2, 3].every(t => { const tc = M.turn(c, t); let good = true; c.forEach((col, x) => col.forEach((row, y) => row.forEach((v, z) => { const [a, b, d] = M.turnKey(x, y, z, c.length, c[0].length, t).split(",").map(Number); if (tc[a][b][d] !== v) good = false; }))); return good; });
  check(ok, "turning: a quarter and three quarters cancel, four is none, and every container is found where turnKey says");
}
{
  const full = [[[1, 1], [1, 1]], [[1, 1], [1, 1]]];
  const v = M.visibleSet(full), v1 = M.visibleSet(full, M.boxFor(1));
  check(!v.has("0,0,0") && v.has("1,1,1") && v.size === 7 && v1.size === 7, `a full 2×2×2 block shows 7 cubes either way round (${[...v].join(" ")})`);
}
check(L[0].x * L[0].y * L[0].z < L[3].x * L[3].y * L[3].z && L[0].exposure > L[3].exposure && M.levelOf(12).x * M.levelOf(12).y * M.levelOf(12).z <= 48, `stacks grow from ${L[0].x}×${L[0].y}×${L[0].z} to ${L[3].x}×${L[3].y}×${L[3].z}, holds from ${L[0].exposure / 1000} s to ${L[3].exposure / 1000} s`);
const p = M.priceOf("spot", 1, null), pLate = M.priceOf("spot", 12, null), pGood = M.priceOf("spot", 1, { t: 20, h: 19 }), pBad = M.priceOf("spot", 1, { t: 20, h: 3 });
check(p > 0 && pLate > p && pGood < p && pBad > p, `prices: a spot pays ${p} in round 1, ${pLate} in round 12; ${pGood} if you're usually right, ${pBad} if usually wrong`);
check(M.shipBonus(1) === 1.5 && M.shipBonus(0) === 1 && M.shipBonus(0.4) === 1.2, "shipping early: up to half as much again");
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;

// questions come in the order that gives least away first: which-stack, whose four stacks show nearly everything, last;
// and a number answer's truth isn't mostly in the middle
{
  const E = await import("../manifest-engine.js");
  let outOfOrder = 0, middle = 0, numbers = 0;
  for (let seed = 1; seed <= 300; seed++) for (let r = 1; r <= 12; r++) {
    const R = E.makeRound(seed, r), ranks = R.orders.map(o => E.ASK_ORDER.indexOf(o.type)).filter(k => k >= 0);
    if (ranks.some((k, i) => i && k < ranks[i - 1])) outOfOrder++;
    for (const o of R.orders) if (o.question.as === "number") { numbers++; if (o.question.options.indexOf(o.question.answer) === 2) middle++; }
  }
  const share = middle / numbers;
  console.log(`${outOfOrder ? "FAIL" : "ok  "} questions asked least-revealing first, which-stack last (${outOfOrder} rounds out of order)`);
  console.log(`${share > 0.3 ? "FAIL" : "ok  "} the true number is in the middle ${Math.round(share * 100)}% of the time (a fifth is fair; random scatter gave 37%)`);
  if (outOfOrder || share > 0.3) process.exitCode = 1;
}
