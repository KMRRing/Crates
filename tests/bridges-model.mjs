// Bridges' model view, the part with no picture in it (bridges-model.js): where the ships of a fairway sail and that they stay
// on it, how they come about at the end of a run, the buoys that mark a lane, where a viaduct stands on piers (never where a ship
// must pass or a low bridge may be built) and the outline of its arches; and that the page offers the model, loads its code only
// when asked, and keeps to the offline rules. The picture itself (bridges-3d.js, three.js) needs a browser with WebGL and is
// looked at, not run here.
import fs from "node:fs";
import { cellXZ, labelOf, headingOf, laneRuns, laneParts, routesOf, shipAt, buoysOf, piersOf, archPoints, deckProfile, islandRadius, wallOutline, linkLine, segDistance, pickTolerance, pickLink } from "../bridges-model.js";
import { layoutOf, generate } from "../bridges-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// a 7×7 chart with one lane down column 3 (rows 1 to 5) and another along row 5 from column 3 to 6: a bend
const size = 7;
const lanes = Array.from({ length: size * size }, (_, i) => { const r = Math.floor(i / size), c = i % size; return (c === 3 && r >= 1 && r <= 5) || (r === 5 && c >= 3 && c <= 6) ? "~" : "."; }).join("");

// ---------- small things ----------
{
  const [x, z] = cellXZ(7, 0, 0), [x2, z2] = cellXZ(7, 6, 6);
  check(near(x, -3) && near(z, -3) && near(x2, 3) && near(z2, 3) && cellXZ(7, 3, 3).every(v => near(v, 0)), "the board's middle is the world's origin, a cell a unit");
  check(labelOf({ n: 4, kind: 0 }) === "4" && labelOf({ n: 4, kind: 1 }) === "4+" && labelOf({ n: 3, kind: 2 }) === "≤3", "an island's plate says its number, or its bound");
  const turn = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  check(near(turn(headingOf(1, 0)), 0) && near(turn(headingOf(0, 1)), 1.5 * Math.PI) && near(turn(headingOf(-1, 0)), Math.PI) && near(turn(headingOf(0, -1)), Math.PI / 2), "a heading turns a ship's bow (+x) to where it goes");
}

// ---------- the lanes ----------
{
  const runs = laneRuns(size, lanes), parts = laneParts(size, lanes);
  check(runs.length === 2 && runs.some(r => r.vertical && r.c === 3 && r.r === 1 && r.len === 5) && runs.some(r => !r.vertical && r.r === 5 && r.c === 3 && r.len === 4), "a lane's straight runs are found in rows and columns, a bend as two");
  check(new Set([...parts].filter(p => p >= 0)).size === 1 && parts[0] === -1 && parts[1 * size + 3] === parts[5 * size + 6], "cells of a lane that touch are one part of it, water is none");
  check(laneRuns(size, ".".repeat(49)).length === 0 && routesOf(size, "", 0).length === 0, "no lane, no run, and no ships if none are asked for");
}

// ---------- the ships' routes ----------
{
  const routes = routesOf(size, lanes, 1), line = routes.filter(r => r.kind === "line"), loop = routes.filter(r => r.kind === "loop");
  check(line.length === 1 && loop.length === 1, "one ship for each part of a lane (on its longest straight run), and one sailing round the board");
  const r = line[0], len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
  check(r.x0 === r.x1 && len > 3.5 && len < 5, `the ship's run is down the longer stretch, a little short of its ends (${len.toFixed(1)} cells)`);
  // every place a ship is, over a long time, lies in cells of the lane and heads along it or back
  let ok = true, maxStep = 0, last = null, headings = new Set();
  for (let t = 0; t < 600; t += 0.5) {
    const a = shipAt(r, t), col = Math.floor(a.x + size / 2), row = Math.floor(a.z + size / 2);
    if (lanes[row * size + col] !== "~") ok = false;
    if (last) maxStep = Math.max(maxStep, Math.hypot(a.x - last.x, a.z - last.z));
    last = a;
    headings.add(Math.round(((a.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 10) / 10);
  }
  check(ok, "a ship on a lane stays in the lane's cells, to and fro");
  check(maxStep < 0.2 * 0.5 + 0.2, `…slowly (never more than ${maxStep.toFixed(2)} cells in half a second)`);
  check(near(shipAt(r, 0).heading, headingOf(0, 1)) && shipAt(r, (len / r.speed) + r.turn / 2).heading > headingOf(0, 1) + 1 && near(shipAt(r, 2 * (len / r.speed + r.turn)).x, shipAt(r, 0).x), "it sails the run, comes about over several seconds, sails back, and the round repeats");
  const lp = loop[0];
  let inside = true;
  for (let t = 0; t < 400; t += 3) { const a = shipAt(lp, t); if (Math.abs(a.x) < size / 2 + 0.6 && Math.abs(a.z) < size / 2 + 0.6) inside = false; }
  check(inside && near(Math.hypot(shipAt(lp, 5).x, shipAt(lp, 5).z), lp.radius), "the ship round the board keeps clear of it, at its radius");
  const none = routesOf(size, "", 2);
  check(none.length === 2 && none[0].dir !== none[1].dir && none[0].radius !== none[1].radius, "a board with no lane has two ships round it, in opposite ways, not on one track");
  const wide = routesOf(9, "~".repeat(9) + ".".repeat(72), 1);
  check(wide.some(x => x.kind === "line" && x.z0 === x.z1 && x.x1 - x.x0 > 6), "a lane along a row is sailed along the row");
  check(JSON.stringify(routesOf(size, lanes, 1)) === JSON.stringify(routes), "the routes are the same every time (no chance in them)");
}

// ---------- the buoys ----------
{
  const b = buoysOf(size, lanes), key = p => `${p.x.toFixed(2)}:${p.z.toFixed(2)}`;
  check(b.length > 12 && new Set(b.map(key)).size === b.length, `buoys mark the lane's sides, none twice (${b.length})`);
  check(b.every(p => lanes[Math.floor(p.z + size / 2) * size + Math.floor(p.x + size / 2)] === "~") && b.some(p => p.red) && b.some(p => !p.red), "red and white by turns");
  // a buoy is on the edge of a lane cell, never in the way of the ship's track along its middle
  const r = routesOf(size, lanes, 0)[0], off = p => { const t = Math.max(r.z0, Math.min(r.z1, p.z)); return Math.hypot(p.x - r.x0, p.z - t); };
  check(b.every(p => off(p) > 0.3), "a buoy stands off the ship's track (none across the bend)");
}

// ---------- the viaducts ----------
{
  // find real puzzles with fairways and look at the piers of their viaducts
  let cases = 0, ok = true, why = "", withPiers = 0, laneCrossed = 0;
  for (const [i, seedSize] of [[1, 9], [2, 9], [3, 11], [4, 9], [5, 11], [6, 9]]) {
    const p = generate(5000 + i * 31, seedSize, "medium", "lanes");
    if (!p) continue;
    const lay = layoutOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills, p.lanes);
    lay.links.forEach((k, l) => {
      if (!k.high) return;
      cases++;
      const a = lay.isl[k.a], b = lay.isl[k.b], span = k.vertical ? b.r - a.r : b.c - a.c, piers = piersOf(lay, l, p.lanes);
      const cell = o => (k.vertical ? (a.r + o) * p.size + a.c : a.r * p.size + a.c + o);
      if (piers.length) withPiers++;
      if (piers.some(o => o < 1 || o >= span || !Number.isInteger(o))) { ok = false; why = "a pier outside the span"; }
      if (piers.some(o => p.lanes[cell(o)] === "~")) { ok = false; why = "a pier in a lane"; }
      for (let o = 1; o < span; o++) if (p.lanes[cell(o)] === "~") laneCrossed++;
      for (const o of piers) for (const [j, m] of lay.links.entries()) {
        if (m.high || m.vertical === k.vertical) continue;
        const c = lay.isl[m.a], d = lay.isl[m.b], cells = [];
        if (m.vertical) for (let r = c.r + 1; r < d.r; r++) cells.push(r * p.size + c.c); else for (let q = c.c + 1; q < d.c; q++) cells.push(c.r * p.size + q);
        if (cells.includes(cell(o))) { ok = false; why = `a pier where link ${j} may be bridged`; }
      }
      if (piers.some((o, n) => n && o - piers[n - 1] < 2)) { ok = false; why = "piers closer than two cells"; }
    });
  }
  check(ok && cases >= 8 && withPiers > 0 && laneCrossed > 0, `a viaduct's piers are whole cells inside it, two apart at least, never in a lane or where a low bridge could pass (${cases} viaducts, ${laneCrossed} lane cells under them)${why ? `: ${why}` : ""}`);
  const a = archPoints(1, 3, 0.7);
  check(near(a[0][0], 1) && near(a[0][1], 0) && near(a.at(-1)[0], 3) && near(a.at(-1)[1], 0, 1e-9) && Math.max(...a.map(p => p[1])) <= 0.7 + 1e-9 && a.every(p => p[0] >= 1 - 1e-9 && p[0] <= 3 + 1e-9), "an arch springs from the water at both ends and rises to its crown, no higher than asked");
  check(Math.max(...archPoints(0, 0.5, 0.7).map(p => p[1])) < 0.35, "a narrow arch is lower (a half ellipse a little taller than wide at most)");
  const w = wallOutline(6, [2, 4]);
  check(w[0][0] === 0 && w.at(-1)[0] === 0 && w.every(p => p[1] >= -0.0601 && p[1] <= 0.76 + 1e-9) && w.filter(p => near(p[1], 0)).length >= 6, "a wall's outline is closed, runs from under the water to the deck, with an arch in each stretch between supports");
  // the ship's height under an arch: a ship (mast about 0.45 × 1.7 = 0.77 at most of its scale) fits under a crown of 0.7? no: its masts are 0.42 × 1.7 = 0.71 tall, so the crown must clear them
  const crown = Math.max(...archPoints(0.5, 2, 0.7).map(p => p[1]));
  check(crown > 0.6, `an arch over open water is high enough for a ship to pass under (crown ${crown.toFixed(2)})`);
}

// ---------- how big an island is, and how a timber deck rises ----------
{
  const rs = [1, 2, 3, 4, 5, 6, 7, 8].map(islandRadius);
  check(rs.every((r, i) => i === 0 || r > rs[i - 1]) && rs[0] >= 0.25 && rs[7] < 0.55, `an island is as big as its number: a one is an islet (${rs[0].toFixed(2)} cells across the middle to the shore), an eight (${rs[7].toFixed(2)}) about fills its cell`);
  check(islandRadius(0) === islandRadius(1) && islandRadius(undefined) === islandRadius(1) && islandRadius(12) === islandRadius(8), "a number off the scale is the nearest end of it (a range's bound, a missing one)");
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
  for (const [i, sz, twist] of [[1, 7, "none"], [2, 9, "hills"], [3, 9, "lanes"], [4, 11, "hills+reefs"], [5, 11, "lanes"], [6, 9, "none"]]) {
    const p = generate(7000 + i * 17, sz, "medium", twist);
    if (!p) continue;
    const lay = layoutOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills, p.lanes);
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
        // only where another link crosses this one right there, and only a viaduct takes it from a low bridge
        const o = got >= 0 ? segs[got] : null;
        if (o && o.high && !segs[l].high && segDistance(o.ax, o.ay, o.bx, o.by, x, y) < 4) continue;
        if (o && !o.high && !segs[l].high && segDistance(o.ax, o.ay, o.bx, o.by, x, y) < 1) continue;
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
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges model: the ships' routes, buoys, viaduct piers and arches, and the page's switch to it");
process.exit(bad ? 1 : 0);
