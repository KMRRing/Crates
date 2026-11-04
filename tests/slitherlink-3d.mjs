// Circuit's chart (slitherlink-3d-geo.js, the arithmetic of the 3D view): the inside of the loop, the land and sea made from it, the harbour and the
// cog's course on the sea side, the tap rule the two views share, the camera's fit, and that the page offers the view without writing the default.
import fs from "node:fs";
import { generate, puzzleOf, LINE } from "../slitherlink-engine.js";
import { insideCells, coastSegments, coastDistance, heightAt, loopPath, seaCourse, course, harbourOf, landMesh, seaMesh, edgeAtPoint, groundPoint, fitDistance, FOV, ELEVATION, MARGIN, HILL } from "../slitherlink-3d-geo.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

for (const [size, level, seed] of [[5, "easy", 11], [7, "medium", 12], [10, "easy", 13]]) {
  const pz = generate(seed, size, level, false), P = puzzleOf(size, pz.grid, pz.sol), g = P.g, marks = pz.sol, tag = `${size}x${size}`;
  const inside = insideCells(g, marks), lines = [...marks].filter(m => m === LINE).length;
  // the inside is the cells a ray from the left crosses an odd number of lines to reach: check against a flood from outside
  const out = new Uint8Array(g.cells), stack = [];
  const at = (r, c) => r * g.C + c, wall = (r, c, dr, dc) => (dr ? marks[(dr > 0 ? r + 1 : r) * g.C + c] === LINE : marks[g.H + r * (g.C + 1) + (dc > 0 ? c + 1 : c)] === LINE);
  for (let r = 0; r < g.R; r++) for (let c = 0; c < g.C; c++) if (r === 0 || c === 0 || r === g.R - 1 || c === g.C - 1) {
    // border cells are outside unless a line between them and the edge of the board says otherwise
    const edge = (r === 0 && marks[c] !== LINE) || (r === g.R - 1 && marks[g.R * g.C + c] !== LINE) || (c === 0 && marks[g.H + r * (g.C + 1)] !== LINE) || (c === g.C - 1 && marks[g.H + r * (g.C + 1) + g.C] !== LINE);
    if (edge && !out[at(r, c)]) { out[at(r, c)] = 1; stack.push([r, c]); }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= g.R || nc >= g.C || out[at(nr, nc)] || wall(r, c, dr, dc)) continue;
      out[at(nr, nc)] = 1; stack.push([nr, nc]);
    }
  }
  check(inside.every((v, k) => v === (out[k] ? 0 : 1)), `${tag}: the cells inside the loop are the ones a flood from the board's edge cannot reach`);
  const path = loopPath(g, marks);
  check(path && path.length === lines, `${tag}: the loop is walked corner by corner (${lines} lines)`);

  const lm = landMesh(g, marks), triangles = lm.index.length / 3;
  let up = 0, level0 = 0;
  for (let i = 0; i < lm.index.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => lm.index[i + k] * 3), p = k => [lm.positions[a + k], lm.positions[b + k], lm.positions[c + k]];
    const ux = p(0)[1] - p(0)[0], uy = p(1)[1] - p(1)[0], uz = p(2)[1] - p(2)[0], vx = p(0)[2] - p(0)[0], vy = p(1)[2] - p(1)[0], vz = p(2)[2] - p(2)[0];
    if (uz * vx - ux * vz > 0) up++;                       // the normal's y
  }
  for (let v = 0; v < lm.positions.length; v += 3) if (lm.positions[v + 1] > HILL + 1e-9) level0++;
  check(up === triangles, `${tag}: every triangle of the land faces up`);
  check(level0 === 0, `${tag}: no hill is taller than ${HILL} cells`);
  let shore = true;
  for (let v = 0; v < lm.positions.length; v += 3) { const x = lm.positions[v], y = lm.positions[v + 2], d = coastDistance(lm.segs, x, y); if (d < 1e-9 && Math.abs(lm.positions[v + 1]) > 1e-9) shore = false; }
  check(shore, `${tag}: the land is level with the vellum on the coast itself`);
  const area = inside.reduce((a, b) => a + b, 0);
  check(triangles === area * 25 * 2, `${tag}: the land is its ${area} cells in 5x5 squares`);
  const sm = seaMesh(g, marks, MARGIN, MARGIN), seaArea = (sm.index.length / 6);
  check(seaArea > 0 && sm.positions.length / 12 === seaArea, `${tag}: the sea is whole squares (${seaArea})`);

  const crs = seaCourse(path, 0.34), cs = course(crs), hb = harbourOf(path);
  const insideAt = (x, y) => x > 0 && y > 0 && x < g.C && y < g.R && inside[Math.floor(y) * g.C + Math.floor(x)] === 1;
  let onSea = 0;
  for (let i = 0; i < 80; i++) { const p = cs.at((i / 80) * cs.total); if (!insideAt(p.x, p.y)) onSea++; }
  check(onSea === 80, `${tag}: the cog's course is wholly on the sea side of the coast`);
  const d0 = Math.min(...crs.map(([x, y]) => coastDistance(lm.segs, x, y))), d1 = Math.max(...crs.map(([x, y]) => coastDistance(lm.segs, x, y)));
  check(d0 > 0.2 && d1 < 0.34 * Math.SQRT2 + 0.05, `${tag}: it keeps ${d0.toFixed(2)} to ${d1.toFixed(2)} cells off the coast`);
  check(!insideAt(hb.x + hb.out[0] * 0.3, hb.y + hb.out[1] * 0.3) && insideAt(hb.x - hb.out[0] * 0.3, hb.y - hb.out[1] * 0.3), `${tag}: the harbour looks out to sea and its town is on the land`);
  check(Math.abs(cs.at(cs.nearest(hb.x + hb.out[0] * 0.34, hb.y + hb.out[1] * 0.34)).x - (hb.x + hb.out[0] * 0.34)) < 0.5, `${tag}: the dock is found on the course`);
}
check(heightAt(0, 3, 3) === 0 && heightAt(5, 3, 3) > 0, "a hill's height is nothing at the shore and something inland");

// ---------- the tap rule is the flat board's, from whichever view a point comes ----------
{
  const g = puzzleOf(7, generate(5, 7, "easy", false).grid).g, { R, C, H } = g;
  const old = (x, y) => {                                       // the flat board's rule as it was written in slitherlink.js
    const gx = Math.min(C, Math.max(0, Math.round(x))), gy = Math.min(R, Math.max(0, Math.round(y))), dv = Math.abs(x - gx), dh = Math.abs(y - gy);
    if (Math.min(dv, dh) > 0.4) return -1;
    if (dh <= dv) return gy * C + Math.min(C - 1, Math.max(0, Math.floor(x)));
    return H + Math.min(R - 1, Math.max(0, Math.floor(y))) * (C + 1) + gx;
  };
  let same = true, n = 0;
  for (let y = -0.6; y <= R + 0.6; y += 0.037) for (let x = -0.6; x <= C + 0.6; x += 0.041) { n++; if (edgeAtPoint(g, x, y) !== old(x, y)) same = false; }
  check(same, `the 3D view reads a tap exactly as the flat board did (${n} points)`);
  let mids = true;
  for (let e = 0; e < g.E; e++) { const a = g.ea[e], b = g.eb[e], mx = ((a % (C + 1)) + (b % (C + 1))) / 2, my = (Math.floor(a / (C + 1)) + Math.floor(b / (C + 1))) / 2; if (edgeAtPoint(g, mx, my) !== e) mids = false; }
  check(mids, "the middle of every edge means that edge");
}

// ---------- the camera ----------
{
  let worst = Infinity;
  for (const [C, R] of [[5, 5], [7, 7], [10, 10]]) for (const aspect of [0.6, 0.82, 1.2, 1.5]) {
    const ty = Math.tan(FOV / 2), tx = ty * aspect, hw = C / 2 + MARGIN, hh = R / 2 + MARGIN, d = fitDistance(hw, hh, ELEVATION, tx, ty, 0.01, 0.01), se = Math.sin(ELEVATION), ce = Math.cos(ELEVATION);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const depth = d - sz * hh * ce, across = sx * hw, up = -sz * hh * se;
      worst = Math.min(worst, 1 - Math.max(Math.abs(across) / (depth * tx), Math.abs(up) / (depth * ty)));
    }
  }
  check(worst > 0, `every corner of the vellum is in the frame at every board size and card shape (least room ${worst.toFixed(3)})`);
  const g = groundPoint([0, 10, 10], [0, -Math.SQRT1_2, -Math.SQRT1_2]);
  check(Math.abs(g[0]) < 1e-9 && Math.abs(g[1]) < 1e-9, "a ray meets the vellum where geometry says");
  check(groundPoint([0, 10, 0], [0, 1, 0]) === null, "a ray that climbs meets nothing");
}

// ---------- the page: flat or 3D by the suite's default, written only when chosen; no pop-ups; the pixel ratio capped ----------
{
  const js = fs.readFileSync(new URL("../slitherlink.js", import.meta.url), "utf8"), gl = fs.readFileSync(new URL("../slitherlink-3d.js", import.meta.url), "utf8");
  check(/wants3D\(prefs\.view, "3d"\)/.test(js) && /choice\("View"/.test(js), "the view is the player's choice or the suite's default, and the menu offers each");
  check(!/prefs\.view\s*=\s*(wants3D|viewShown)/.test(js) && /if \(remember\) \{ prefs\.view = v;/.test(js), "the default is never written to the key: only a choice made is");
  check(/onDefaultChange/.test(js), "Settings' 2D mode reaches a game with no choice kept");
  check(/setPixelRatio\(Math\.min\(devicePixelRatio \|\| 1, 2\)\)/.test(gl), "WebGL's pixel ratio is capped at 2");
  check(!/\b(alert|confirm|prompt)\(/.test(gl + js), "no browser pop-ups");
  check(/animating\(\) \|\| now < busyUntil/.test(gl), "frames go on only while something moves");
}

process.exit(bad ? 1 : 0);
