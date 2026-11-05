// Atoll's 3D view (nurikabe-3d.js), the parts that are plain arithmetic: which cell a ray meets, how far the camera stands for the
// board to be in view at every turn and tilt, and that the page offers the view and keeps flat as its default.
import fs from "node:fs";
import { cellXZ, cellHit, fitDistance, basis, homeElevation, MIN_EL, MAX_EL, FOV, LAND_H, CLUE_H, BED_H, WATER_H, WATER_FULL } from "../nurikabe-3d.js";
import { works, plotsOf, outward } from "../nurikabe-works.js";
import { generate, puzzleOf, SEA } from "../nurikabe-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- a ray finds the nearest block, and a carved cell lies below the land round it ----------
{
  const N = 6, heights = Array(N * N).fill(LAND_H);
  const down = (x, z, y = 5) => cellHit(N, heights, [x, y, z], [0, -1, 0]);
  const hits = Array.from({ length: N * N }, (_, x) => { const [cx, cz] = cellXZ(N, x); return down(cx, cz) === x; });
  check(hits.every(Boolean), "straight down on a cell's middle meets that cell, all 36 of them");
  check(down(N / 2 + 1, 0) === -1, "a ray beside the board meets nothing");
  const [cx, cz] = cellXZ(N, 14);
  heights[14] = BED_H;
  // a low camera looking across the board: the land in front hides a carved cell behind it
  const aim = d => d.map(v => v / Math.hypot(...d));
  const [fx, fz] = cellXZ(N, 14 + N);        // the cell in front of it (nearer the camera)
  check(cellHit(N, heights, [fx, LAND_H + 0.2, fz + 2.5], aim([0, -0.2, -2.5])) === 14 + N, "a shallow ray meets the land in front before the carved cell behind it");
  check(cellHit(N, heights, [cx, 5, cz], [0, -1, 0]) === 14, "from straight above, a carved cell is met at its bed");
  // a finger or a ray meets the water's top over a carved cell, not its bed
  const tops = heights.slice();
  tops[14] = WATER_H;
  check(cellHit(N, tops, [cx, 5, cz], [0, -1, 0]) === 14, "a ray meets the water's surface over a sea cell");
  check(WATER_H > BED_H && WATER_H < LAND_H && CLUE_H > LAND_H, "the river's water lies above its bed and below the land; a number's block stands highest");
}

// ---------- the whole board is in view at every turn and tilt, for every card shape ----------
{
  let worst = Infinity;
  for (const N of [6, 8, 10]) for (const aspect of [0.55, 0.8, 1.4]) for (let az = 0; az < 6.3; az += 0.45) for (let el = MIN_EL; el <= MAX_EL + 1e-9; el += 0.2) {
    const ty = Math.tan(FOV / 2), tx = ty * aspect, pad = 0.04, d = fitDistance(N, az, el, tx, ty, pad, pad), { c, r, u } = basis(az, el), h = N / 2 + 0.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, CLUE_H]) {
      const p = [sx * h, y - 0.25, sz * h], depth = d - (p[0] * c[0] + p[1] * c[1] + p[2] * c[2]);
      const across = p[0] * r[0] + p[1] * r[1] + p[2] * r[2], up = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
      worst = Math.min(worst, 1 - Math.max(Math.abs(across) / (depth * tx), Math.abs(up) / (depth * ty)));
    }
  }
  check(worst > 0, `every corner of the board is inside the view (the least room left, as a share of the frame: ${worst.toFixed(3)})`);
  check(homeElevation(0.5) >= MIN_EL && homeElevation(2) <= MAX_EL && homeElevation(0.5) < homeElevation(1.4), "the first tilt is within the limits, steeper for a tall card");
}

// ---------- the waterworks, from the solved sea: one intake and one outlet on the edge, a current along the network, and no detail by a number ----------
{
  let boards = 0, edgeOk = 0, flowOk = 0, nearNum = 0, spaced = 0, barged = 0;
  for (const size of [6, 8, 10]) for (const seed of [11, 12]) {
    const p = generate(seed * 101 + size, size, "easy"), P = puzzleOf(size, p.grid, p.sol), N = size;
    const marks = Array.from({ length: N * N }, (_, x) => (P.sol[x] === 1 ? SEA : "0")).join(""), w = works(N, P.clue, marks);
    boards++;
    if (w.source >= 0 && outward(N, w.source) && w.sea[w.source] && (w.outlet < 0 || (w.outlet !== w.source && outward(N, w.outlet)))) edgeOk++;
    let ok = true;
    for (let x = 0; x < N * N; x++) if (w.sea[x] && w.dist[x] >= 0) { const l = Math.hypot(w.flow[2 * x], w.flow[2 * x + 1]); if (l > 1e-6 && Math.abs(l - 1) > 1e-3) ok = false; }
    if (ok) flowOk++;
    const stands = [...w.locks.flatMap(l => l.gates), ...w.sluices.map(s => s.cell), ...w.bridges.map(b => b.cell), ...w.norias.map(n => n.cell)];
    if (stands.every(x => !P.clue[x] && ![x - N, x + N, x - 1, x + 1].some(y => P.clue[y] && Math.abs((y % N) - (x % N)) <= 1))) nearNum++;
    if (new Set(stands).size === stands.length && stands.every(x => w.sea[x])) spaced++;
    if (w.barges === 0 || w.path.length >= 4) barged++;
  }
  check(edgeOk === boards, "the intake and the outlet are different sea cells on the board's edge");
  check(flowOk === boards, "every channel cell's current is a unit direction (or still)");
  check(nearNum === boards, "no lock gate, sluice, bridge or noria stands on or beside a number");
  check(spaced === boards, "each detail has a cell of its own, in the water");
  check(barged === boards, "barges ride only where the route from intake to outlet is long enough");
  const N = 5, clue = Array(25).fill(0);
  clue[0] = 2; clue[24] = 1;
  const marks = "0".repeat(25).split("");
  marks[1] = marks[5] = marks[6] = SEA;
  const own = plotsOf(N, clue, marks.join(""));
  check(own[0] === -1 && own[24] === -1, "a plot is whole only with its one number and exactly that many cells");
  marks[2] = marks[7] = marks[10] = marks[11] = marks[3] = marks[4] = marks[8] = marks[9] = marks[12] = marks[13] = marks[14] = marks[15] = marks[16] = marks[17] = marks[18] = marks[19] = marks[20] = marks[21] = marks[22] = marks[23] = SEA;
  const own2 = plotsOf(N, clue, marks.join(""));
  check(own2[24] === 24 && own2[0] === -1, "a lone one-cell plot is whole");
  check(WATER_FULL > WATER_H && WATER_FULL < LAND_H, "a solved canal fills above its first level and below the banks");
}

// ---------- the page: flat by default, the view on offer in the menu, the pixel ratio capped ----------
{
  const js = fs.readFileSync(new URL("../nurikabe.js", import.meta.url), "utf8"), glsrc = fs.readFileSync(new URL("../nurikabe-3d.js", import.meta.url), "utf8");
  check(/wants3D\(prefs\.view, "model"\)/.test(js) && /Play in 3D/.test(js) && /Play in 2D/.test(js), "the view is the player's choice or the suite's default (3D, flat in 2D mode), and the menu offers each view");
  check(/setPixelRatio\(Math\.min\(devicePixelRatio \|\| 1, 2\)\)/.test(glsrc), "WebGL's pixel ratio is capped at 2");
  check(!/\b(alert|confirm|prompt)\(/.test(glsrc), "no browser pop-ups");
  check(/soundSolved\(\)/.test(js) && /IN_FRAME\) soundSolved/.test(js), "the knock and the running water play on the player's own solve, never in a watching frame");
}

process.exit(bad ? 1 : 0);
