// Slipway: a timber cube cut into figures of three to five unit cubes, to be fitted back. The 24 turns (no mirrors), figures
// told apart from their mirror images, a dissection that is connected and whole, a cut that can't be sawn straight through,
// the figures fitted at the start leaving exactly one way back (counted by the exact-cover search), a seed making the same
// timber, and the stars.
// Run: node tests/slipway.mjs
const C = await import("../slipway-cut.js");
const V = await import("../slipway-view.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };

// ---------- the turns ----------
check(C.TURNS.length === 24, "a cube has 24 turns");
const L = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]];                       // an L of four
check(C.orientations(L).length === 24 && C.orientations([[0, 0, 0], [1, 0, 0], [2, 0, 0]]).length === 3, "an L of four stands 24 ways (no turn leaves it as it is), a straight three 3");
// a figure with a left and a right hand: a screw of four cubes, each step at a right angle to the last
const hand = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]], other = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, -1]];
check(C.shapeKey(hand) !== C.shapeKey(other) && C.orientations(hand).length === 12 && C.orientations(other).length === 12, "a figure and its mirror image are two figures (no turn takes one to the other)");
check(C.shapeKey(hand) === C.shapeKey(C.orientations(hand)[5]), "all of a figure's turns have one name");
check(C.quarter(C.quarter(C.quarter(C.quarter(hand, 0), 0), 0), 0).map(c => c.join()).join() === C.normal(hand).map(c => c.join()).join(), "four quarter turns bring it home");
check(C.shapeKey(C.quarter(hand, 2)) === C.shapeKey(hand), "a quarter turn keeps the figure the same figure");

// ---------- the cuts ----------
for (const level of C.LEVEL_IDS) {
  const n = C.LEVELS[level].n;
  let made = 0, whole = true, conn = true, sizes = true, saw = true, once = true, given = true, same = true;
  const seeds = level === "easy" ? 12 : 2;
  for (let seed = 1; seed <= seeds; seed++) {
    const cut = C.dealCut(seed, level);
    if (!cut) continue;
    made++;
    const all = cut.pieces.flatMap(p => p.cells).sort((a, b) => a - b);
    if (all.length !== n ** 3 || all.some((k, i) => k !== i)) whole = false;
    for (const p of cut.pieces) {
      if (p.cells.length < 3 || p.cells.length > 5) sizes = false;
      const seen = new Set([p.cells[0]]), todo = [p.cells[0]];
      while (todo.length) { const k = todo.pop(); for (const j of p.cells) if (!seen.has(j) && [1, n, n * n].some(d => Math.abs(j - k) === d && (d !== 1 || (j / n | 0) === (k / n | 0)) && (d !== n || ((j / (n * n)) | 0) === ((k / (n * n)) | 0)))) { seen.add(j); todo.push(j); } }
      if (seen.size !== p.cells.length) conn = false;
    }
    if (C.guillotine(n, cut.pieces)) saw = false;
    const fixed = cut.given.map(id => cut.pieces[id]);
    if (C.ways(n, cut.pieces, fixed) !== 1) once = false;
    if (cut.given.length >= cut.pieces.length) given = false;
    if (JSON.stringify(C.dealCut(seed, level)) !== JSON.stringify(cut)) same = false;
  }
  check(made === seeds, `${level}: timbers come (${made} of ${seeds})`);
  check(whole && sizes && conn, `${level}: the figures cover the cube once, each connected, of three to five cubes`);
  check(saw, `${level}: no timber can be cut straight through again and again`);
  check(once && given, `${level}: the figures fitted at the start leave exactly one way back`);
  check(same, `${level}: a seed makes the same timber`);
}
// the search counts honestly: with nothing fitted a loose cut has more than one way, and fitting every figure leaves one
const cut = C.dealCut(3, "easy"), n = cut.n;
check(C.ways(n, cut.pieces, cut.pieces) === 1, "every figure fitted leaves one way (the one it is)");
check(C.ways(n, cut.pieces, cut.given.slice(0, Math.max(0, cut.given.length - 1)).map(i => cut.pieces[i])) >= 1, "a figure fewer fitted still has a way");
check(C.guillotine(3, [{ cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] }, { cells: [18, 19, 20, 21, 22, 23, 24, 25, 26] }]), "two slabs are a guillotine cut");

// ---------- the stars ----------
const t = { par: 100 };
check(C.starsFor(t, 0, 90) === 3 && C.starsFor(t, 0, 101) === 2 && C.starsFor(t, 1, 10) === 2 && C.starsFor(t, 2, 10) === 1, "three stars for none shown inside par, two for none shown or one, else one");

// ---------- colours ----------
check(V.rgb("#2E6B4A").join() === "46,107,74" && V.rgb("#fff").join() === "255,255,255" && V.rgb("rgb(1, 2, 3)").join() === "1,2,3", "colours read from hex and rgb()");
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
