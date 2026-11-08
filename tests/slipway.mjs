// Slipway's rules (slipway-rules.js): a cut list in words that, carried out, leaves one piece; every step matters, the piece is
// whole and no plain box, a seed makes the same list, the tools reach what they say, the par way down gets there, the stars.
// Run: node tests/slipway.mjs
const R = await import("../slipway-rules.js");
const V = await import("../slipway-view.js");
let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };
const sum = a => a.reduce((s, v) => s + v, 0);

// ---------- the ways of naming cubes ----------
for (const n of [3, 4]) {
  const all = R.selectors(n), ids = new Set(all.map(s => s.id));
  check(ids.size === all.length, `${n}-block: every way of naming cubes has its own id (${all.length})`);
  const cells = [...Array(n ** 3).keys()].map(k => R.xyz(n, k));
  const hit = id => cells.filter(c => all.find(s => s.id === id).test(...c)).length;
  check(hit("k3") === 8 && hit("k0") === (n - 2) ** 3 && hit("k2") === 12 * (n - 2) && hit("k1") === 6 * (n - 2) ** 2, `${n}-block: 8 corners, ${12 * (n - 2)} edge cubes, ${6 * (n - 2) ** 2} face cubes, ${(n - 2) ** 3} in the heart`);
  check(hit("dark") + hit("light") === n ** 3 && R.selectors(n).find(s => s.id === "dark").test(0, 0, 0), `${n}-block: dark and light share the cubes, the corner at the origin being dark`);
  check(hit("s001") === n * n && hit("s211") === n * n && hit(`bz00`) === n && hit("bx00") === n && hit("by00") === n, `${n}-block: a slice has ${n * n} cubes, a shaft or a tunnel ${n}`);
  check(hit("d20=") === n * n && hit("d20>") === n * n * (n - 1) / 2, `${n}-block: a diagonal slices the block as it should`);
}
// the words, spot checked
const n3 = R.selectors(3);
check(n3.find(s => s.id === "s211").text === "the top layer" && n3.find(s => s.id === "s001").text === "the left slice" && R.selectors(4).find(s => s.id === "s112").text === "the two back slices", "a slab is named by its side and its count");
check(R.wording({ act: "cut", sel: n3.find(s => s.id === "s211"), within: null }) === "Saw off the top layer." && R.wording({ act: "keep", sel: n3.find(s => s.id === "k3"), within: n3.find(s => s.id === "s211") }) === "Within the top layer, keep only the corner cubes.", "a step reads as a sentence, with its limit first");

// ---------- carrying a list out ----------
{
  const n = 3, sel = id => n3.find(s => s.id === id);
  const left = R.carryOut(n, [{ act: "cut", sel: sel("s211"), within: null }]);
  check(sum(left) === 18, "sawing off the top layer of a 3-block leaves 18");
  const left2 = R.carryOut(n, [{ act: "keep", sel: sel("k3"), within: null }]);
  check(sum(left2) === 8, "keeping only the corners leaves 8");
  const left3 = R.carryOut(n, [{ act: "cut", sel: sel("k2"), within: sel("s211") }]);
  check(sum(left3) === 27 - 4, "within the top layer, chiselling the edge cubes away takes 4 (the top layer's edge cubes)");
  check(R.connected(3, new Uint8Array(27).fill(1)) && !R.connected(3, R.carryOut(3, [{ act: "keep", sel: sel("k3"), within: null }])), "a block is one piece, eight corners are not");
}

// ---------- the tools ----------
{
  const n = 3, k = R.at(n, 1, 2, 0);
  check(R.reach(n, "chisel", 0, k).join() === String(k), "a chisel takes the cube");
  check(R.reach(n, "bore", 2, k).length === 3 && R.reach(n, "bore", 2, k).every(j => R.xyz(n, j)[0] === 1 && R.xyz(n, j)[1] === 2), "a bore along z takes the line through it");
  check(R.reach(n, "saw", 2, k).length === 9 && R.reach(n, "saw", 2, k).every(j => R.xyz(n, j)[2] === 0), "a saw along z takes its layer");
  check(R.reach(n, "saw", 0, k).length === 9 && R.reach(n, "saw", 0, k).every(j => R.xyz(n, j)[0] === 1), "a saw along x takes the slice");
}

// ---------- the lists ----------
for (const level of R.LEVEL_IDS) {
  const L = R.LEVELS[level], seeds = 40;
  let made = 0, whole = true, sized = true, matter = true, same = true, box = true, par = true, words = true, need = true;
  for (let seed = 1; seed <= seeds; seed++) {
    const cut = R.dealCut(seed, level);
    if (!cut) continue;
    made++;
    const n = cut.n, target = Uint8Array.from(cut.target);
    if (!R.connected(n, target)) whole = false;
    if (sum(target) < L.size[0] || sum(target) > L.size[1]) sized = false;
    if (cut.steps.length < L.steps[0] || cut.steps.length > L.steps[1]) sized = false;
    if (R.carryOut(n, cut.steps).some((v, k) => v !== target[k])) matter = false;
    cut.steps.forEach((_, i) => { if (R.carryOut(n, cut.steps.filter((__, j) => j !== i)).every((v, k) => v === target[k])) matter = false; });
    if (JSON.stringify(R.dealCut(seed, level)) !== JSON.stringify(cut)) same = false;
    const ops = R.parOps(n, target);
    if (ops.length !== cut.par || ops.length < 1) par = false;
    const now = new Uint8Array(n ** 3).fill(1);
    for (const o of ops) for (const j of o.cells) now[j] = 0;
    if (now.some((v, k) => v !== target[k])) par = false;                     // the par ways really arrive, taking nothing of the piece
    if (cut.text.length !== cut.steps.length || cut.text.some(t => !/\.$/.test(t))) words = false;
    if (L.need && !cut.steps.some(s => L.need.includes(s.sel.kind))) need = false;
    if (n !== L.n) whole = false;
    if (cut.notes[0] !== R.NOTES.count) words = false;
  }
  check(made >= seeds - 2, `${level}: lists come (${made} of ${seeds})`);
  check(whole && sized, `${level}: the piece is whole and the right size, the list the right length`);
  check(matter, `${level}: carrying the list out leaves the piece, and every step matters`);
  check(par && need, `${level}: the par way down arrives without taking any of the piece${L.need ? `, and the list has a ${L.need.join(" or ")} rule` : ""}`);
  check(same && words, `${level}: a seed makes the same list, in sentences, with its notes`);
}

// ---------- the stars ----------
check(R.starsFor({ hints: 0, slips: 0, cuts: 5, par: 5 }) === 3 && R.starsFor({ hints: 0, slips: 0, cuts: 6, par: 5 }) === 3 && R.starsFor({ hints: 0, slips: 0, cuts: 7, par: 5 }) === 2, "three stars for no hint, no slips and at most one over par");
check(R.starsFor({ hints: 0, slips: 2, cuts: 5, par: 5 }) === 2 && R.starsFor({ hints: 0, slips: 3, cuts: 5, par: 5 }) === 1 && R.starsFor({ hints: 1, slips: 0, cuts: 5, par: 5 }) === 1, "two for up to two slips, one for a hint or more slips");

// ---------- the drawing ----------
check(V.rgb("#2E6B4A").join() === "46,107,74" && V.rgb("#fff").join() === "255,255,255" && V.rgb("rgb(1, 2, 3)").join() === "1,2,3", "colours read from hex and rgb()");
const square = { cube: { x: 0, y: 0, z: 0 }, axis: 2, poly: [[0, 0], [10, 0], [10, 10], [0, 10]] }, other = { cube: { x: 1, y: 0, z: 0 }, axis: 0, poly: [[5, 5], [15, 5], [15, 15], [5, 15]] };
check(V.faceAt([square, other], 7, 7) === other && V.faceAt([square, other], 2, 2) === square && V.faceAt([square, other], 30, 30) === null, "a tap finds the nearest face under it (the last drawn), or none");
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
