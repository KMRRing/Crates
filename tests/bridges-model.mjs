// Bridges' model view, the part with no picture in it (bridges-model.js): the sea the ships sail (every cell that no island, built
// low bridge or viaduct pier stands on, a viaduct crossed but never sailed along), the routes they plan and round off, that the
// ships stay in free water however long they sail and however the bridges change under them, where a viaduct stands on piers
// and the outline of its arches, which link a finger is on; and that the page offers the model, loads its code only when asked,
// and keeps to the offline rules. The picture itself (bridges-3d.js, three.js) needs a browser with WebGL and is looked at,
// not run here.
import fs from "node:fs";
import { cellXZ, labelOf, headingOf, SEA_MARGIN, seaOf, seaXZ, seaCell, openWater, sailFrom, smoothRoute, routeAt, shipsFor, createFleet, piersOf, archPoints, deckProfile, islandRadius, wallOutline, linkLine, segDistance, pickTolerance, pickLink } from "../bridges-model.js";
import { layoutOf, generate } from "../bridges-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const layOf = p => layoutOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills || "", p.roads || "", { straits: p.straits || "", tree: !!p.tree });

// ---------- small things ----------
{
  const [x, z] = cellXZ(7, 0, 0), [x2, z2] = cellXZ(7, 6, 6);
  check(near(x, -3) && near(z, -3) && near(x2, 3) && near(z2, 3) && cellXZ(7, 3, 3).every(v => near(v, 0)), "the board's middle is the world's origin, a cell a unit");
  check(labelOf({ n: 4, kind: 0 }) === "4" && labelOf({ n: 4, kind: 1 }) === "4+" && labelOf({ n: 3, kind: 2 }) === "≤3", "an island's plate says its number, or its bound");
  const turn = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  check(near(turn(headingOf(1, 0)), 0) && near(turn(headingOf(0, 1)), 1.5 * Math.PI) && near(turn(headingOf(-1, 0)), Math.PI) && near(turn(headingOf(0, -1)), Math.PI / 2), "a heading turns a ship's bow (+x) to where it goes");
}

// ---------- the sea, made by hand: two hills 6 apart in row 3 with a viaduct between them, a low link crossing it at column 2 ----------
const size = 7;
const hand = (marks) => {
  const isl = [{ r: 3, c: 0, n: 2, hill: true }, { r: 3, c: 6, n: 2, hill: true }, { r: 1, c: 2, n: 1 }, { r: 5, c: 2, n: 1 }];
  const links = [{ a: 0, b: 1, vertical: false, high: true, cap: 2 }, { a: 2, b: 3, vertical: true, high: false, cap: 2 }];
  return seaOf({ size, isl, links }, marks);
};
const cell = (sea, r, c) => (r + sea.margin) * sea.w + (c + sea.margin);
{
  const open = hand("00"), viaduct = hand("10"), both = hand("11");
  check(open.w === size + 2 * SEA_MARGIN && open.margin === SEA_MARGIN && open.blocked.length === open.w * open.w, `the sea is the board and ${SEA_MARGIN} cells of open water all round it`);
  const stood = s => { const out = []; s.blocked.forEach((b, j) => { if (b) out.push(j); }); return out; };
  check(stood(open).length === 4 && [[3, 0], [3, 6], [1, 2], [5, 2]].every(([r, c]) => open.blocked[cell(open, r, c)]), "with nothing built only the islands are in the way");
  const gate = seaOf({ size, isl: [{ r: 3, c: 0, n: 1 }, { r: 3, c: 6, n: 1 }, { r: 0, c: 2, n: 1 }, { r: 0, c: 5, n: 1 }], links: [{ a: 0, b: 1, vertical: false, high: false, cap: 1 }, { a: 2, b: 3, vertical: false, high: false, cap: 1 }] }, "00");
  check(gate.blocked[cell(gate, 3, 3)] && gate.blocked[cell(gate, 0, 3)] && !gate.blocked[cell(gate, 3, 2)] && !gate.blocked[cell(gate, 3, 4)] && !gate.blocked[cell(gate, 0, 4)], "a narrow road's gate stands in its middle cell (the one before the middle on an odd span), built or not, and shuts it to the ships");
  // the viaduct: 6 apart, so cells 1 to 5; the cell under the low link's crossing (column 2) takes no pier, then piers fall at columns 3 and 5
  check([3, 5].every(c => viaduct.blocked[cell(viaduct, 3, c)]) && [1, 2, 4].every(c => !viaduct.blocked[cell(viaduct, 3, c)] && viaduct.axis[cell(viaduct, 3, c)] === 1), "a built viaduct stands on its piers, and the water between them is a way across, not along (axis 1: it runs along x)");
  const low = hand("01");
  check([2, 3, 4].every(r => low.blocked[cell(low, r, 2)]) && [1, 2, 3, 4, 5].every(c => c === 2 || !low.blocked[cell(low, 3, c)]), "a built low bridge shuts the cells under it, and a viaduct that is not built shuts none");
  check(both.blocked[cell(both, 3, 2)] && both.blocked[cell(both, 3, 3)], "where a low bridge passes under a viaduct the water is shut, not a way across");
  // across, not along: from the cell north of the viaduct's column 1 to the cell south of it the way is straight through (3 cells); column 1 to column 2 along the viaduct is no step
  const through = sailFrom(viaduct, cell(viaduct, 2, 1), cell(viaduct, 4, 1)), along = sailFrom(viaduct, cell(viaduct, 3, 1), cell(viaduct, 3, 2));
  check(through && through.length === 3 && through[1] === cell(viaduct, 3, 1), "a ship passes through an arch of the viaduct from one side to the other");
  check(along && along.length === 4 && [2, 4].includes(Math.floor(along[1] / viaduct.w) - SEA_MARGIN), "…but cannot sail along under it, from one arch to the next: it goes out and round");
  // the viaduct is open on the board only across: no step between two axis cells along the viaduct
  const d = openWater(viaduct, cell(viaduct, 3, 1));
  check(d[cell(viaduct, 3, 1)] === 0 && d[cell(viaduct, 3, 2)] === 3 && d[cell(viaduct, 3, 3)] === -1 && d[cell(viaduct, 3, 5)] === -1, "the distances run out and round, and the pier cells are never reached");
  check(openWater(viaduct, cell(viaduct, 3, 0)).every(v => v === -1) && sailFrom(viaduct, cell(viaduct, 3, 0), cell(viaduct, 0, 0)) === null && sailFrom(viaduct, -1, 0) === null, "from an island there is no way, and none from or to no cell");
  const wall = hand("11"), seen = openWater(wall, 0);
  let margin = 0, reached = 0;
  for (let r = 0; r < wall.w; r++) for (let c = 0; c < wall.w; c++) if (r < SEA_MARGIN || c < SEA_MARGIN || r >= wall.w - SEA_MARGIN || c >= wall.w - SEA_MARGIN) { margin++; if (seen[r * wall.w + c] >= 0) reached++; }
  check(margin === reached, "the margin is all one stretch of water: there is always a way round the board");
  const mid = seaXZ(open, cell(open, 3, 3)), corner = seaXZ(open, 0);
  check(near(mid[0], 0) && near(mid[1], 0) && near(corner[0], -(size / 2 + SEA_MARGIN) + 0.5) && seaCell(open, 0, 0) === cell(open, 3, 3) && seaCell(open, 99, 0) === -1 && seaCell(open, mid[0] + 0.4, mid[1] - 0.4) === cell(open, 3, 3), "a sea cell and the world point of its middle go both ways, and a point off the sea is no cell");
}

// ---------- the routes ----------
{
  const sea = hand("10"), from = cell(sea, 0, 0), to = cell(sea, 6, 6), cells = sailFrom(sea, from, to);
  check(cells[0] === from && cells.at(-1) === to && cells.length === 13 && cells.every((j, i) => !i || Math.abs(cells[i - 1] - j) === 1 || Math.abs(cells[i - 1] - j) === sea.w) && cells.every(j => !sea.blocked[j]), `the shortest way is found cell by cell, through free water only (${cells.length} cells)`);
  const route = smoothRoute(sea, cells);
  check(near(route.len, route.pts.at(-1)[3]) && route.len > 11.2 && route.len < 12.4 && route.pts.every((p, i) => !i || p[3] >= route.pts[i - 1][3]), `a route is a curve a bit shorter than its cells' steps, its corners cut round (${route.len.toFixed(1)} cells)`);
  const inside = route.pts.every(p => cells.includes(seaCell(sea, p[0], p[1])));
  check(inside, "the rounded curve never leaves the cells of the way");
  const a = routeAt(route, 0), b = routeAt(route, route.len), c = routeAt(route, route.len / 2), over = routeAt(route, route.len + 5), under = routeAt(route, -2);
  check(near(a.x, seaXZ(sea, from)[0]) && near(b.z, seaXZ(sea, to)[1], 1e-6) && c.x !== a.x && over.x === b.x && under.x === a.x, "a ship at the start of its route is at the first cell, at its end at the last, and a ship past either end stays there");
  const straight = smoothRoute(sea, sailFrom(sea, cell(sea, 0, 0), cell(sea, 0, 5)));
  check(near(straight.len, 5) && straight.pts.every(p => near(p[1], seaXZ(sea, cell(sea, 0, 0))[1]) && near(p[2], 0, 1e-9)), "a straight way is straight, the bow along x");
  const one = smoothRoute(sea, [from]);
  check(one.len === 0 && one.pts.length === 1 && routeAt(one, 3).x === one.pts[0][0], "a route of one cell is a place, not a journey");
}

// ---------- the fleet ----------
{
  check(shipsFor(7) === 2 && shipsFor(9) === 3 && shipsFor(11) === 4, "a bigger board has more ships");
  // the ships over a long time on real boards: always in free water, across a viaduct only straight, the same for the same seed
  let steps = 0, wet = 0, drift = 0, ships = 0, shared = 0, why = "";
  const pairs = [[1, 7, "hills"], [2, 9, "hills"], [3, 9, "wide"], [4, 11, "hills+realms"], [5, 11, "none"]];
  for (const [i, sz, twist] of pairs) {
    const p = generate(5000 + i * 31, sz, "medium", twist);
    if (!p) continue;
    const sea = seaOf(layOf(p), p.sol), fleet = createFleet(shipsFor(sz), i), again = createFleet(shipsFor(sz), i), other = createFleet(shipsFor(sz), i + 50);
    for (const f of [fleet, again, other]) f.setSea(sea);
    const last = fleet.ships.map(() => null);
    for (let t = 0; t < 1500; t++) {
      for (const f of [fleet, again, other]) f.advance(0.4);
      fleet.ships.forEach((s, k) => {
        steps++;
        const j = seaCell(sea, s.x, s.z);
        if (j < 0 || sea.blocked[j]) { wet++; why = `a ship in cell ${j} at step ${t}`; return; }
        if (last[k] != null && last[k] !== j && (sea.axis[j] || sea.axis[last[k]])) {                 // a step into or out of the water under a viaduct
          const along = sea.axis[j] || sea.axis[last[k]], horizontal = Math.abs(last[k] - j) === 1;
          if ((along === 1) === horizontal) { drift++; why = `a ship sailed along a viaduct at step ${t}`; }
        }
        last[k] = j;
      });
    }
    ships += fleet.ships.length;
    if (JSON.stringify(fleet.ships.map(s => [s.x, s.z])) === JSON.stringify(again.ships.map(s => [s.x, s.z]))) shared++;
    if (JSON.stringify(fleet.ships.map(s => [s.x, s.z])) === JSON.stringify(other.ships.map(s => [s.x, s.z]))) why = "another seed sails the same";
  }
  check(steps > 20000 && !wet && !drift, `ships sail 10 minutes on five real boards and are never on an island, a pier or a built bridge, nor along a viaduct (${steps} positions)${why ? `: ${why}` : ""}`);
  check(shared === pairs.length && !/same/.test(why), "the same seed and the same sea sail the same way (no chance in it), another seed another way");
  // ships are set down apart from one another
  let close = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const f = createFleet(4, seed);
    f.setSea(seaOf(layOf(generate(7000 + seed, 11, "easy")), "0".repeat(60)));
    for (const a of f.ships) for (const b of f.ships) if (a.k < b.k && Math.hypot(a.x - b.x, a.z - b.z) < 3) close++;
  }
  check(close === 0, "ships are set down at least three cells from one another, so none starts on top of another");
  // a ship moves (it is not stuck) and its bow follows where it sails
  const sea = hand("00"), f = createFleet(2, 3);
  f.setSea(sea);
  const start = f.ships.map(s => [s.x, s.z]);
  for (let t = 0; t < 200; t++) f.advance(0.5);
  check(f.ships.every((s, k) => Math.hypot(s.x - start[k][0], s.z - start[k][1]) > 0.5), "every ship is under way after a little while");
  let maxStep = 0, last = f.ships.map(s => [s.x, s.z]);
  for (let t = 0; t < 400; t++) { f.advance(0.1); f.ships.forEach((s, k) => { maxStep = Math.max(maxStep, Math.hypot(s.x - last[k][0], s.z - last[k][1])); last[k] = [s.x, s.z]; }); }
  check(maxStep < 0.04, `…slowly (never more than ${maxStep.toFixed(3)} cells in a tenth of a second)`);
  // bridges built under sailing ships: none is left in a bridge, and none sails on through one
  const live = createFleet(3, 9), board = generate(5062, 9, "medium", "hills"), lay = layOf(board), marks = Array.from({ length: lay.links.length }, () => "0");
  live.setSea(seaOf(lay, marks.join("")));
  let moved = 0, in_ = 0, through = 0;
  for (let l = 0; l < lay.links.length; l++) {
    for (let t = 0; t < 40; t++) live.advance(0.5);
    marks[l] = board.sol[l] === "0" ? "0" : board.sol[l];
    const sea2 = seaOf(lay, marks.join(""));
    const before = live.ships.map(s => [s.x, s.z]);
    live.setSea(sea2);
    live.ships.forEach((s, k) => {
      const j = seaCell(sea2, s.x, s.z);
      if (j < 0 || sea2.blocked[j]) in_++;
      if (before[k][0] !== s.x || before[k][1] !== s.z) moved++;
      const cells = s.route?.cells;
      if (cells) { const at = cells.indexOf(j); if (at < 0 || cells.slice(at).some(q => sea2.blocked[q])) through++; }
    });
  }
  check(in_ === 0 && through === 0, `as bridges are built one by one, no ship is left in one nor keeps a way through one (${moved} ships had to be moved to the nearest water)`);
  // a new board of the same size keeps the ships where they were, one of another size sets them down again
  const keep = createFleet(2, 4);
  keep.setSea(hand("00"));
  for (let t = 0; t < 30; t++) keep.advance(0.5);
  const was = keep.ships.map(s => [s.x, s.z]);
  keep.setSea(hand("00"));
  check(keep.ships.every((s, k) => s.x === was[k][0] && s.z === was[k][1]), "the sea changing a little leaves a ship where it is");
  const alone = createFleet(1, 5);
  alone.advance(1);
  check(alone.ships[0].x === 0 && alone.ships[0].z === 0, "a fleet with no sea yet stays put");
  // a sea with every route shut: a ship waits and tries again, it does not fall over
  const shut = hand("00");
  shut.blocked.fill(1);
  shut.blocked[0] = 0;
  const lone = createFleet(1, 6);
  lone.setSea(shut);
  for (let t = 0; t < 50; t++) lone.advance(1);
  check(lone.ships[0].route === null && seaCell(shut, lone.ships[0].x, lone.ships[0].z) === 0, "a ship with nowhere to go waits where it is");
}

// ---------- the viaducts ----------
{
  // find real puzzles with viaducts and look at their piers
  let cases = 0, ok = true, why = "", withPiers = 0, shut = 0;
  for (const [i, seedSize] of [[1, 9], [2, 9], [3, 11], [4, 9], [5, 11], [6, 9]]) {
    const p = generate(5000 + i * 31, seedSize, "medium", "hills");
    if (!p) continue;
    const lay = layOf(p);
    const sea = seaOf(lay, p.sol);
    lay.links.forEach((k, l) => {
      if (!k.high) return;
      cases++;
      const a = lay.isl[k.a], b = lay.isl[k.b], span = k.vertical ? b.r - a.r : b.c - a.c, piers = piersOf(lay, l);
      const cellAt = o => (k.vertical ? (a.r + o) * p.size + a.c : a.r * p.size + a.c + o);
      if (piers.length) withPiers++;
      if (piers.some(o => o < 1 || o >= span || !Number.isInteger(o))) { ok = false; why = "a pier outside the span"; }
      if (+p.sol[l]) for (const o of piers) if (!sea.blocked[(( k.vertical ? a.r + o : a.r) + sea.margin) * sea.w + (k.vertical ? a.c : a.c + o) + sea.margin]) { ok = false; why = "a pier the ships could sail through"; }
      if (+p.sol[l]) shut++;
      for (const o of piers) for (const [j, m] of lay.links.entries()) {
        if (m.high || m.vertical === k.vertical) continue;
        const c = lay.isl[m.a], d = lay.isl[m.b], cells = [];
        if (m.vertical) for (let r = c.r + 1; r < d.r; r++) cells.push(r * p.size + c.c); else for (let q = c.c + 1; q < d.c; q++) cells.push(c.r * p.size + q);
        if (cells.includes(cellAt(o))) { ok = false; why = `a pier where link ${j} may be bridged`; }
      }
      if (piers.some((o, n) => n && o - piers[n - 1] < 2)) { ok = false; why = "piers closer than two cells"; }
    });
  }
  check(ok && cases >= 8 && withPiers > 0 && shut > 0, `a viaduct's piers are whole cells inside it, two apart at least, never where a low bridge could pass, and shut to the ships once it is built (${cases} viaducts)${why ? `: ${why}` : ""}`);
  const a = archPoints(1, 3, 0.7);
  check(near(a[0][0], 1) && near(a[0][1], 0) && near(a.at(-1)[0], 3) && near(a.at(-1)[1], 0, 1e-9) && Math.max(...a.map(p => p[1])) <= 0.7 + 1e-9 && a.every(p => p[0] >= 1 - 1e-9 && p[0] <= 3 + 1e-9), "an arch springs from the water at both ends and rises to its crown, no higher than asked");
  check(Math.max(...archPoints(0, 0.5, 0.7).map(p => p[1])) < 0.35, "a narrow arch is lower (a half ellipse a little taller than wide at most)");
  const w = wallOutline(6, [2, 4]);
  check(w[0][0] === 0 && w.at(-1)[0] === 0 && w.every(p => p[1] >= -0.0601 && p[1] <= 0.76 + 1e-9) && w.filter(p => near(p[1], 0)).length >= 6, "a wall's outline is closed, runs from under the water to the deck, with an arch in each stretch between supports");
  // the ship's height under an arch: its masts are 0.42 × 1.7 = 0.71 tall at most, so the crown must clear them
  const crown = Math.max(...archPoints(0.5, 2, 0.7).map(p => p[1]));
  check(crown > 0.6, `an arch over open water is high enough for a ship to pass under (crown ${crown.toFixed(2)})`);
}

// ---------- how big an island is, and how a timber deck rises ----------
{
  const rs = [1, 2, 3, 4, 5, 6, 7, 8].map(islandRadius);
  check(rs.every((r, i) => i === 0 || r > rs[i - 1]) && rs[0] >= 0.25 && rs[7] < 0.55, `an island is as big as its number: a one is an islet (${rs[0].toFixed(2)} cells across the middle to the shore), an eight (${rs[7].toFixed(2)}) about fills its cell`);
  check(islandRadius(0) === islandRadius(1) && islandRadius(undefined) === islandRadius(1) && islandRadius(12) === islandRadius(8), "a number off the scale is the nearest end of it (a range's bound, a missing one, a twelve on a wide road)");
  // islands lie two cells apart at the least, so even two eights leave a gap for a bridge's span and its ramps
  check(2 * islandRadius(8) < 2 - 0.5, "two of the biggest islands two cells apart still leave water for a bridge between them");
  const d = deckProfile(3, 0.12, 10);
  check(d.length === 11 && near(d[0][0], 0) && near(d[0][1], 0) && near(d[10][0], 3) && near(d[10][1], 0, 1e-9) && near(Math.max(...d.map(p => p[1])), 0.12) && d.every((p, i) => i === 0 || p[0] > d[i - 1][0]), "a timber deck rises from nothing at one island to its hump in the middle and down to nothing at the other");
  // a link's ends are set in by each island's own size
  const lay = { isl: [{ r: 0, c: 0, n: 1 }, { r: 0, c: 4, n: 8 }], links: [{ a: 0, b: 1, vertical: false }] };
  const q = linkLine(lay, 7, 0, { pad: o => islandRadius(o.n) + 0.05 }), plain = linkLine(lay, 7, 0);
  check(near(q.x0 - cellXZ(7, 0, 0)[0], islandRadius(1) + 0.05) && near(cellXZ(7, 0, 4)[0] - q.x1, islandRadius(8) + 0.05) && near(plain.x0 - cellXZ(7, 0, 0)[0], 0.45), "a link starts further out from a big island than from a small one, and from 0.45 cells where no function is given");
  const w = wallOutline(6, [2, 4], { reach: 0.5, reachEnd: 0.8 }), lastFoot = Math.max(...w.filter(p => p[0] < 6 && near(p[1], -0.06)).map(p => p[0]));
  check(near(lastFoot, 6 - 0.8), "a viaduct's last arch stops where the far island's own shore is (reachEnd), not where the first's is");
}

// ---------- playing on it: which link a finger is on ----------
{
  check(near(segDistance(0, 0, 10, 0, 5, 3), 3) && near(segDistance(0, 0, 10, 0, 14, 3), 5) && near(segDistance(2, 2, 2, 2, 5, 6), 5), "a point's distance to a segment: beside it, past its end, and to a point");
  check(pickTolerance(8) === 10 && pickTolerance(30) === 15 && pickTolerance(200) === 24, "a finger reaches half a cell, but never under ten pixels nor over twenty-four");
  // a board seen from straight above, 40 pixels a cell, every link picked along its length
  const S = 40, px = (x, z) => [x * S, z * S];
  let links = 0, wrong = 0, viaducts = 0, onIsland = 0, isleCount = 0, missed = 0, why = "";
  for (const [i, sz, twist] of [[1, 7, "none"], [2, 9, "hills"], [3, 9, "wide"], [4, 11, "hills+narrow"], [5, 11, "none"], [6, 9, "none"]]) {
    const p = generate(7000 + i * 17, sz, "medium", twist);
    if (!p) continue;
    const lay = layOf(p);
    const lines = lay.links.map((_, l) => linkLine(lay, p.size, l));
    const segs = lines.map((q, l) => { const [ax, ay] = px(q.x0, q.z0), [bx, by] = px(q.x1, q.z1); return { l, ax, ay, bx, by, high: q.high }; });
    const isles = lay.isl.map(o => { const [x, z] = cellXZ(p.size, o.r, o.c), [ix, iy] = px(x, z); return { x: ix, y: iy, r: 0.4 * S }; });
    lay.links.forEach((k, l) => {
      links++;
      const a = lay.isl[k.a], b = lay.isl[k.b], q = lines[l], span = k.vertical ? b.r - a.r : b.c - a.c;
      if (!(near(q.y, k.high ? 0.8 : 0.17) && (k.vertical ? near(q.x0, q.x1) && near(Math.abs(q.z1 - q.z0), span - 0.9) : near(q.z0, q.z1) && near(Math.abs(q.x1 - q.x0), span - 0.9)))) { wrong++; why = "a link's line is not the span less the islands' share"; }
      if (k.high) viaducts++;
      for (const f of [0.2, 0.5, 0.8]) {
        const x = segs[l].ax + (segs[l].bx - segs[l].ax) * f, y = segs[l].ay + (segs[l].by - segs[l].ay) * f, got = pickLink(segs, x, y, pickTolerance(S), isles);
        if (got === l) continue;
        // only where another link crosses this one right there: a viaduct takes it from a low bridge, and two of a height (only one can be built) are a tie
        const o = got >= 0 ? segs[got] : null;
        if (o && o.high && !segs[l].high && segDistance(o.ax, o.ay, o.bx, o.by, x, y) < 4) continue;
        if (o && o.high === segs[l].high && segDistance(o.ax, o.ay, o.bx, o.by, x, y) < 1) continue;
        missed++; why = `link ${l} at ${f} gave ${got}`;
      }
    });
    isleCount += isles.length;
    for (const o of isles) if (pickLink(segs, o.x, o.y, pickTolerance(S), isles) === -1 && pickLink(segs, o.x + 0.3 * S, o.y, pickTolerance(S), isles) === -1) onIsland++;
  }
  check(links > 60 && viaducts > 0 && !wrong, `every link's line runs between its islands at its bridge's height (${links} links, ${viaducts} of them viaducts)${why ? `: ${why}` : ""}`);
  check(!missed, `a finger on a link (a fifth, half, four fifths along it) picks that link, but where another crosses it${missed ? `: ${why}` : ""}`);
  check(isleCount > 40 && onIsland === isleCount, `a finger on an island, or a little off its middle, picks no link (${onIsland} of ${isleCount} islands)`);
  // the cases, made by hand: a viaduct over a low bridge, two low links crossing, a blocked one
  const low = { l: 0, ax: 0, ay: 100, bx: 200, by: 100, high: false }, high = { l: 1, ax: 100, ay: 0, bx: 100, by: 200, high: true };
  check(pickLink([low, high], 102, 100, 18) === 1 && pickLink([high, low], 100, 101, 18) === 1, "where a viaduct passes over a low bridge a finger at the crossing means the viaduct");
  check(pickLink([low, high], 160, 103, 18) === 0 && pickLink([low, high], 100, 40, 18) === 1, "…but a finger away from the crossing means the link it is on");
  check(pickLink([low, high], 160, 130, 18) === -1 && pickLink([], 5, 5, 18) === -1, "a finger far from every link picks none");
  const crossA = { l: 0, ax: 0, ay: 100, bx: 200, by: 100, high: false, bias: 2 }, crossB = { l: 1, ax: 100, ay: 0, bx: 100, by: 200, high: false };
  check(pickLink([crossA, crossB], 100, 100, 18) === 1 && pickLink([crossB, { ...crossA, bias: 0 }], 100, 100, 18) === 1, "of two low links crossing, the one a bridge can go on wins a close call (the other has a bias)");
  check(pickLink([crossA, crossB], 160, 100, 18) === 0, "…and still gets a finger that is well along it");
  check(pickLink([low, high], 100, 108, 18, [{ x: 100, y: 110, r: 14 }]) === -1, "a finger on an island is on no link, though one is close");
  check(pickLink([{ l: 4, ax: 0, ay: 0, bx: 100, by: 0, high: false }], 50, 19, 18) === -1 && pickLink([{ l: 4, ax: 0, ay: 0, bx: 100, by: 0, high: false }], 50, 17, 18) === 4, "the tolerance is a distance in pixels");
}

// ---------- the page ----------
{
  const html = fs.readFileSync(root + "bridges.html", "utf8"), js = fs.readFileSync(root + "bridges.js", "utf8"), css = fs.readFileSync(root + "bridges.css", "utf8"), d3 = fs.readFileSync(root + "bridges-3d.js", "utf8");
  check(/id="viewBtn"/.test(html) && /id="model"/.test(html) && /id="card"/.test(html), "the page has the model's place and the button that switches to it");
  check(/import\("\.\/bridges-3d\.js"\)/.test(js) && !/^import .*bridges-3d/m.test(js), "the model's code (and three.js) is loaded only when the model is first asked for");
  check(/from "\.\/vendor\/three\.js"/.test(d3) && /from "\.\/bridges-model\.js"/.test(d3), "the picture uses the three.js the app keeps on the device, so it works offline");
  check(/\.brg-card\.is-model/.test(css) && /\.brg3-n\b/.test(css) && /\.brg3-gl\b/.test(css), "the stylesheet has the model's plates, canvas and the card's other state");
  check(/prefs\.view/.test(js) && /"model"/.test(js) && /catch \(err\)/.test(js.slice(js.indexOf("async function setView"), js.indexOf("async function setView") + 600)), "the choice is kept with the prefs, and where there is no WebGL the chart stays");
  check(/>3D</.test(html) && /<b>2D<\/b>/.test(js) && /Play in 3D/.test(js) && !/Show the model|<b>Model<\/b>/.test(js + html), "the button says 3D, and 2D when it is on; the menu says Play in 3D / 2D");
  const mouth = js.slice(js.indexOf("async function setView"), js.indexOf("async function setView") + 700);
  check(/createModel\(\$\("model"\), \{/.test(mouth) && /press,/.test(mouth) && /playable: \(\) => !!S && !S\.done && !IN_FRAME && !paused/.test(mouth) && /blocked: l => S\.marks\[l\] === "0" && crossed\(P, S\.marks, l\)/.test(mouth), "the model is given the page's press, and plays only while a run is on (not won, not watching a partner, not paused)");
  check(/model\.update\(S\.marks, br \|\| breaks\(P, S\.marks\), S\.lit\)/.test(js), "a hint's link is handed to the model with the marks");
  const hold = +/const HOLD = (\d+)/.exec(js)[1], hold3 = +/const HOLD = (\d+)/.exec(d3)[1];
  check(hold === hold3 && /opts\.press\?\.\(link, "tap"\)/.test(d3) && /opts\.press\?\.\(g\.link, "hold"\)/.test(d3) && /e\.button === 2/.test(d3) && /contextmenu/.test(d3), `a tap, a hold (${hold3} ms, as on the chart) and a right click reach the page's press`);
  check(/Math\.hypot\(e\.clientX - g\.x0, e\.clientY - g\.y0\) <= SLIP/.test(d3) && /clearTimeout\(g\.timer\)/.test(d3), "a finger that strays turns the board and builds nothing");
  check(/class="brg3-zoom"|brg3-zoom/.test(d3) && /\.brg3-zoom button/.test(css) && /wheel/.test(d3) && /MAX_ZOOM/.test(d3) && /pinch or scroll to zoom/.test(js) && /pinch to zoom/.test(html), "the board zooms by the wheel, two fingers and a pair of buttons, and the hint under it and the board's label say so");
  check(/model\?\.hold\(true\)/.test(js) && /document\.hidden/.test(d3) && /prefers-reduced-motion/.test(d3), "the model stands still while the menu is open or the tab hidden, and for a player who asks for less motion");
  check(/seaOf\(/.test(d3) && /createFleet\(/.test(d3) && !/buoysOf|routesOf|laneRuns|laneParts|shipAt|\.brg-reef|\.brg-lane|\.brg-wave|brg3-reef/.test(d3 + js + css), "the model sails its ships through the sea of the marks; no reef, lane or buoy of the old rules is left in the page");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges model: the sea and its ships, viaduct piers and arches, picking, and the page's switch to it");
process.exit(bad ? 1 : 0);
