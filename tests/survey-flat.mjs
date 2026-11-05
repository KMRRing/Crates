// Survey's flat view (survey-2d.js): where the slices, cubes and plates are, and which cube a touch picks. Pure geometry, no page.
import { layoutOf, cubeBox, squareAt, cubeAt, plateAt, rowSquares } from "../survey-2d.js";
import { linesOf, cellAt, coordsOf, makePuzzle } from "../survey-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const RUNS = { x: 2.6, y: 2.6, z: 2.1 }, TWO = { x: 1.3, y: 1.3, z: 1.3 };   // the widest plate of each direction, in cubes: runs, two ores
for (const [n, W, H, wide] of [[3, 390, 380], [4, 390, 380], [7, 390, 380], [5, 700, 520], [7, 800, 560], [6, 1000, 500], [7, 390, 430, RUNS], [6, 390, 430, TWO], [5, 835, 740, RUNS]]) {
  const L = layoutOf(n, W, H, wide);
  check(L.at.length === n + 1 && L.x0 >= -1e-6 && L.y0 >= -1e-6 && L.x1 <= W + 1e-6 && L.y1 <= H + 1e-6, `n=${n} at ${W}x${H}${wide ? " with wide plates" : ""}: n+1 slices inside the screen (cube ${L.u.toFixed(1)} px, ${L.cols} columns)`);
  // slices don't overlap each other
  const sep = L.at.every((a, i) => L.at.every((b, j) => i === j || a.x + a.w * L.u <= b.x + 1e-6 || b.x + b.w * L.u <= a.x + 1e-6 || a.y + a.h * L.u <= b.y + 1e-6 || b.y + b.h * L.u <= a.y + 1e-6));
  check(sep, `n=${n}: the slices stand apart`);
  // every cube of every layer is picked from its own middle, and nothing else is
  let ok = true;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const b = cubeBox(L, z, x, y);
    if (cubeAt(L, b.x + L.u / 2, b.y + L.u / 2, () => true) !== cellAt(n, x, y, z)) ok = false;
  }
  check(ok, `n=${n}: a touch on the middle of a cube picks it`);
  const d = cubeBox(L, n, 0, 0);
  check(squareAt(L, d.x + L.u / 2, d.y + L.u / 2)?.k === n && cubeAt(L, d.x + L.u / 2, d.y + L.u / 2, () => true) === -1, `n=${n}: the depth slice picks nothing`);
  const m = L.at[0];
  check(cubeAt(L, m.x + L.u / 2, m.y + L.at[0].mh * L.u + L.u * 1.5, () => true) === -1, `n=${n}: the margin where the plates are picks nothing`);
  check(cubeAt(L, cubeBox(L, 0, 1, 1).x + 3, cubeBox(L, 0, 1, 1).y + 3, i => i !== cellAt(n, 1, 1, 0)) === -1, `n=${n}: a cube already chipped picks nothing`);
  // plates: x rows at the left of their line, y rows at the top of their column, z rows in the depth slice; all distinct
  const spots = new Set(), P = linesOf(n);
  let rightPlace = true;
  for (const ln of P) {
    const [px, py] = plateAt(L, ln);
    spots.add(`${px.toFixed(1)},${py.toFixed(1)}`);
    const s = squareAt(L, px, py);
    if (ln.a === 2 ? s?.k !== n || s.x !== ln.u || s.y !== ln.v : s !== null) rightPlace = false;
  }
  // two plates of one kind never overlap: each fits the room it has (x rows: a margin as wide as the plate; y rows: staggered; z rows: widened squares)
  const need = wide || {}, plates = P.map(ln => ({ ln, c: plateAt(L, ln) })), w = (ln) => (need[["x", "y", "z"][ln.a]] || 1) * L.u;
  let clear = true;
  for (const a of plates) for (const b of plates) {
    if (a === b || a.ln.a !== b.ln.a) continue;
    const wa = w(a.ln), hh = L.u * 0.86;
    if (Math.abs(a.c[0] - b.c[0]) < wa - 1e-6 && Math.abs(a.c[1] - b.c[1]) < hh - 1e-6) clear = false;
  }
  check(clear, `n=${n}: no two plates of a kind overlap (${L.tiers} tier${L.tiers > 1 ? "s" : ""} on top)`);
  check(spots.size === 3 * n * n && rightPlace, `n=${n}: each of the ${3 * n * n} rows has its own spot for its plate, in a margin or the depth slice`);
  // a row lights its own cubes, and the depth square if it runs through the layers
  const ln = P.find(l => l.a === 2 && l.u === 1 && l.v === 2), sq = rowSquares(n, ln);
  check(sq.length === n + 1 && sq.filter(s => s.k === n).length === 1 && sq.every(s => s.x === 1 && s.y === 2), `n=${n}: a row through the layers lights that column in every layer and its depth square`);
  const row = rowSquares(n, P.find(l => l.a === 0 && l.u === 2 && l.v === 1));
  check(row.length === n && row.every(s => s.k === 1 && s.y === 2), `n=${n}: a row along x lights its line in one layer`);
}
{
  // the cube of a puzzle sits where coordsOf says
  const p = makePuzzle(7, "medium", "seams"), n = p.n, L = layoutOf(n, 390, 380), i = cellAt(n, 2, 3, 1), [x, y, z] = coordsOf(n, i);
  const b = cubeBox(L, z, x, y);
  check(cubeAt(L, b.x + 4, b.y + 4, () => true) === i, "a puzzle's cube is picked where it is drawn");
  // up is up: a higher y is higher on the screen
  check(cubeBox(L, 0, 0, 3).y < cubeBox(L, 0, 0, 0).y, "the top row of a layer is y = n - 1");
}
if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall ok");
