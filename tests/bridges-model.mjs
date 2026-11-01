// Bridges' model view, the part with no picture in it (bridges-model.js): where the ships of a fairway sail and that they stay
// on it, how they come about at the end of a run, the buoys that mark a lane, where a viaduct stands on piers (never where a ship
// must pass or a low bridge may be built) and the outline of its arches; and that the page offers the model, loads its code only
// when asked, and keeps to the offline rules. The picture itself (bridges-3d.js, three.js) needs a browser with WebGL and is
// looked at, not run here.
import fs from "node:fs";
import { cellXZ, labelOf, headingOf, laneRuns, laneParts, routesOf, shipAt, buoysOf, piersOf, archPoints, wallOutline } from "../bridges-model.js";
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

// ---------- the page ----------
{
  const html = fs.readFileSync(root + "bridges.html", "utf8"), js = fs.readFileSync(root + "bridges.js", "utf8"), css = fs.readFileSync(root + "bridges.css", "utf8"), d3 = fs.readFileSync(root + "bridges-3d.js", "utf8");
  check(/id="viewBtn"/.test(html) && /id="model"/.test(html) && /id="card"/.test(html), "the page has the model's place and the button that switches to it");
  check(/import\("\.\/bridges-3d\.js"\)/.test(js) && !/^import .*bridges-3d/m.test(js), "the model's code (and three.js) is loaded only when the model is first asked for");
  check(/from "\.\/vendor\/three\.js"/.test(d3) && /from "\.\/bridges-model\.js"/.test(d3), "the picture uses the three.js the app keeps on the device, so it works offline");
  check(/\.brg-card\.is-model/.test(css) && /\.brg3-n\b/.test(css) && /\.brg3-gl\b/.test(css), "the stylesheet has the model's plates, canvas and the card's other state");
  check(/prefs\.view/.test(js) && /"model"/.test(js) && /catch \(err\)/.test(js.slice(js.indexOf("async function setView"), js.indexOf("async function setView") + 600)), "the choice is kept with the prefs, and where there is no WebGL the chart stays");
  check(/model\?\.hold\(true\)/.test(js) && /document\.hidden/.test(d3) && /prefers-reduced-motion/.test(d3), "the model stands still while the menu is open or the tab hidden, and for a player who asks for less motion");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges model: the ships' routes, buoys, viaduct piers and arches, and the page's switch to it");
process.exit(bad ? 1 : 0);
