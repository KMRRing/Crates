// The shore round Bridges' 3D sea (bridges-coast.js), pure: a coast of its own for every puzzle, clear of the board and of the ships,
// land as far as the camera can ever see (so the square of water never shows at any tilt, turn or zoom), cheap, and the same on every phone.
import * as THREE from "../vendor/three.js";
import fs from "node:fs";
import { coastOf, reachOf, seenFrom, groundAt, hashOf, N, BOARD_PAD, GAP, TAU, ASPECTS, FOV as COAST_FOV, MIN_EL, MAX_EL, MAX_ZOOM } from "../bridges-coast.js";
import { fitDistance, SEA_MARGIN } from "../bridges-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DEG = Math.PI / 180, FOV = 30 * DEG, SIZES = [5, 7, 9, 11];
const edgeOf = (size, t) => (size / 2 + BOARD_PAD) / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t)));    // the board's square (with its plates), along an angle

// ---------- every puzzle has its own bay, the same everywhere ----------
{
  const a = coastOf(12345, 9), b = coastOf(12345, 9), c = coastOf(12346, 9), d = coastOf("another seed", 9);
  const same = (x, y) => x.water.every((v, i) => v === y.water[i]) && x.tris.length === y.tris.length && x.pines.length === y.pines.length && x.rocks.every((r, i) => r.x === y.rocks[i].x);
  check(same(a, b), "a seed gives one coast, whenever and wherever it is made (both phones of a race see the same bay)");
  check(!same(a, c) && !same(a, d) && !same(c, d), "a seed next to it, or a word, gives another");
  check(hashOf(7) === hashOf("7") && hashOf("a") !== hashOf("b"), "a number and its digits are one seed");
  const many = Array.from({ length: 30 }, (_, i) => coastOf(i * 7919, 9)), heads = new Set(many.map(k => Math.floor(k.water.indexOf(Math.max(...k.water)) / (N / 12))));
  check(heads.size >= 7, `bays differ in shape from puzzle to puzzle (the farthest head of 30 coasts lies in ${heads.size} of 12 directions)`);
}

// ---------- clear of the board and the ships; beaches and cliffs both ----------
{
  let worstGap = Infinity, worstShip = Infinity, cliffs = [], beaches = [], lighthouses = 0, worstThing = Infinity, worstPine = Infinity, over = 0;
  for (const size of SIZES) for (let seed = 1; seed <= 40; seed++) {
    const k = coastOf(seed * 104729, size), ship = size / 2 + SEA_MARGIN - 0.5;
    let c = 0, bch = 0;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * TAU;
      worstGap = Math.min(worstGap, k.water[i] - edgeOf(size, t));
      worstShip = Math.min(worstShip, k.water[i] - ship / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))));       // the farthest a ship's middle goes, along this angle
      if (k.cliff[i] > 0.9) c++;
      if (k.cliff[i] < 0.1) bch++;
    }
    cliffs.push(c / N); beaches.push(bch / N);
    if (k.lighthouse) lighthouses++;
    for (const r of k.rocks) worstThing = Math.min(worstThing, Math.max(Math.abs(r.x), Math.abs(r.z)) - size / 2 - r.s);
    for (const q of k.pines) { const t = Math.atan2(q.z, q.x), i = (((t / TAU) % 1) + 1) % 1 * N; worstPine = Math.min(worstPine, Math.hypot(q.x, q.z) - k.water[Math.floor(i) % N]); }
    if (k.tris.length > 2600 || k.rocks.length > 30 || k.pines.length > 80) over++;
  }
  check(worstGap >= GAP - 1e-6, `the waterline stays ${worstGap.toFixed(2)} cells from the board's square or more, round every coast of 160 (the plates and the strait numbers are inside it)`);
  check(worstShip >= 0.75, `and ${worstShip.toFixed(2)} cells clear of the farthest a ship's middle sails (${SEA_MARGIN} cells of margin round the board), more than a hull's half length: no ship runs aground`);
  check(worstThing >= SEA_MARGIN + 0.3 - 1e-6, `no rock reaches into the water the ships sail (the nearest ${(worstThing - SEA_MARGIN).toFixed(2)} cells outside it), and no pine stands on the water (the nearest ${worstPine.toFixed(2)} beyond the waterline)`);
  check(Math.min(...cliffs) >= 0.2 && Math.min(...beaches) >= 0.15, `every coast has both: at least ${(Math.min(...cliffs) * 100).toFixed(0)}% cliff and ${(Math.min(...beaches) * 100).toFixed(0)}% beach of its length`);
  check(lighthouses >= 4 && lighthouses <= 150, `a lighthouse on some of the heads (${lighthouses} coasts of 160), never on all`);
  check(over === 0, "every coast is within budget: at most 2600 triangles, 30 rocks and 80 pines");
}

// ---------- the land: solid, facing up, as high as it should be ----------
{
  const k = coastOf(99, 9);
  const levels = k.dist.length;
  check(k.tris.length === N * (levels - 1) * 2 && k.tris.every(t => t.p.length === 9), `the land is a closed ring of ${k.tris.length} triangles (${N} angles by ${levels - 1} rings by two)`);
  const up = k.tris.every(t => { const p = t.p, ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2], vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2]; return uz * vx - ux * vz > 0; });
  check(up, "every triangle faces up (a cull of the back faces leaves no hole)");
  const roles = new Set(k.tris.map(t => t.role));
  check(["sand", "cliff", "cliffHi", "grass", "grassHi"].every(r => roles.has(r)), `its slopes take their colours: ${[...roles].sort().join(", ")}`);
  let under = 0, wl = 0;
  for (let i = 0; i < N; i++) { if (k.high[i][0] >= -0.1) under++; if (Math.abs(k.high[i][1]) > 0.1) wl++; }
  check(under === 0 && wl === 0, "the land goes under the sea before the waterline and meets the swell at it, all the way round");
  check(Math.max(...k.high.flat()) < 7 && Math.min(...k.rad.map(r => r.at(-1))) >= k.far, `no mountain over 7 cells, and the last ring (${Math.min(...k.rad.map(r => r.at(-1))).toFixed(0)}) lies beyond the land's far edge (${k.far.toFixed(0)}) everywhere`);
  check(Math.abs(groundAt(k, k.rad[0][3], 0) - k.high[0][3]) < 0.02 && Math.abs(groundAt(k, k.rad[0][3] + 1e-6, 0) - groundAt(k, k.rad[0][3], 0)) < 0.01, "the ground's height is read off the grid at its points and is continuous between them");
  for (let seed = 1; seed < 200; seed++) {
    const c = coastOf(seed, 7);
    if (!c.lighthouse) continue;
    const t = Math.atan2(c.lighthouse.z, c.lighthouse.x), i = (((t / TAU) % 1) + 1) % 1 * N;
    check(Math.hypot(c.lighthouse.x, c.lighthouse.z) > c.water[Math.floor(i) % N] + 1 && c.lighthouse.y > 0.8, "a lighthouse stands back from the edge on high ground");
    break;
  }
}

// ---------- the land is built for the camera the page has ----------
{
  const src = fs.readFileSync(new URL("../bridges-3d.js", import.meta.url), "utf8"), num = re => { const m = src.match(re); return m && Number(m[1]); };
  const page = { min: num(/MIN_EL = (\d+) \* DEG/), max: num(/MAX_EL = (\d+) \* DEG/), fov: num(/FOV = (\d+) \* DEG/), zoom: num(/MAX_ZOOM = ([\d.]+)/) };
  check(page.min * DEG === MIN_EL && page.max * DEG === MAX_EL && page.fov * DEG === COAST_FOV && page.zoom === MAX_ZOOM, `the coast's camera limits (${MIN_EL / DEG}° to ${MAX_EL / DEG}°, ${COAST_FOV / DEG}° of view, zoom to ${MAX_ZOOM}) are the page's own in bridges-3d.js: change one and the other, or the sea's edge shows`);
  check(/\(size \/ 2\) \* \(1 - 1 \/ zoom\) \+ 0\.5/.test(src), "and the page's pan limit is still the one the reach assumes");
}

// ---------- the sea's square never shows ----------
// from a camera anywhere the game allows, every ray through the screen's edge meets the land inside the coast's far edge
{
  const ty = Math.tan(FOV / 2);
  let seed = 7, worst = 0, cases = 0, over = 0;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const size of SIZES) {
    const k = coastOf(5, size), half = size / 2 + BOARD_PAD, box = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 1.4]) box.push(sx * half, y, sz * half);
    for (let q = 0; q < 700; q++) {
      const aspect = ASPECTS[0] + next() * (ASPECTS.at(-1) - ASPECTS[0]), el = (30 + next() * 50) * DEG, az = next() * TAU, zoom = 1 + next() * 2.6, tx = ty * aspect;
      const fit = fitDistance(box, az, el, [0, 0.15, 0], tx, ty, 0, 0), lim = (size / 2) * (1 - 1 / zoom) + 0.5;
      const px = (next() * 2 - 1) * lim * (zoom === 1 ? 0 : 1), pz = (next() * 2 - 1) * lim * (zoom === 1 ? 0 : 1);
      const seen = seenFrom(az, el, fit / zoom, px, pz, tx, ty);
      worst = Math.max(worst, seen); cases++;
      if (!(seen <= k.far)) over++;
    }
  }
  check(over === 0, `over ${cases} random cameras (any turn, tilt from 30° to 80°, zoom, pan and card from tall to wide) the farthest water in view is ${worst.toFixed(0)} cells out, inside the land's edge`);
  for (const size of SIZES) check(reachOf(size) <= coastOf(1, size).far, `${size}×${size}: the land reaches ${coastOf(1, size).far.toFixed(0)} cells, the camera at most ${reachOf(size).toFixed(0)}`);
  // the same ray maths, checked against a real projection
  const size = 9, az = 70 * DEG, el = 30 * DEG, aspect = 0.6, tx = ty * aspect, dist = 40;
  const eye = new THREE.Vector3(Math.sin(az) * Math.cos(el) * dist, 0.15 + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
  const world = new THREE.Matrix4().lookAt(eye, new THREE.Vector3(0, 0.15, 0), new THREE.Vector3(0, 1, 0)).setPosition(eye);
  const proj = new THREE.Matrix4().makePerspective(-0.5 * ty * aspect, 0.5 * ty * aspect, 0.5 * ty, -0.5 * ty, 0.5, 400), inv = proj.clone().invert();
  let far = 0;
  for (const [u, v] of [[-1, 1], [1, 1], [-1, -1], [1, -1], [0, 1], [-1, 0], [1, 0], [0, -1]]) {
    const g = new THREE.Vector3(u, v, 0.5).applyMatrix4(inv).applyMatrix4(world), t = (0 - eye.y) / (g.y - eye.y);
    far = Math.max(far, Math.hypot(eye.x + (g.x - eye.x) * t, eye.z + (g.z - eye.z) * t));
  }
  check(Math.abs(far - seenFrom(az, el, dist, 0, 0, tx, ty)) < 1e-6, "the reach's own ray maths agrees with a real projection matrix to a millionth of a cell");
  void size;
}

// ---------- cheap ----------
{
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) coastOf(i, 11);
  const per = (performance.now() - t0) / 20;
  check(per < 60, `a coast takes ${per.toFixed(1)} ms to make (the largest board), once, with the puzzle`);
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges coast: a bay of its own for every puzzle, clear of the board, with land to the farthest the camera can see");
process.exit(bad ? 1 : 0);
