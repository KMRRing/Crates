// Portolan's chart for the honeycomb and for causeways (slitherlink-3d-geo.js, the arithmetic of the 3D view): the inside of a loop that
// isn't a square's plain outline, the land cut from hexagons, the sea, the harbour and the cog's course told from the inside out, and the tap.
import fs from "node:fs";
import { generate, puzzleOf } from "../slitherlink-engine.js";
import { insideCells, insideAt, coastSegments, coastDistance, loopPath, seaCourse, course, harbourOf, landMesh, seaMesh, edgeAtPoint, MARGIN, HILL } from "../slitherlink-3d-geo.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const kinds = [["hex", 5, "easy", "none", 3], ["hex", 7, "medium", "ranges", 4], ["hex", 9, "easy", "none", 5], ["square", 7, "easy", "tunnels", 6], ["square", 5, "medium", "ranges+tunnels", 7]];
for (const [shape, size, level, twist, seed] of kinds) {
  const pz = generate(seed, size, level, false, { shape, twist }), P = puzzleOf(size, pz.grid, pz.sol, { shape, tun: pz.tun }), g = P.view, marks = pz.sol, tag = `${shape} ${size}${pz.tun ? " with causeways" : ""}`;
  const lines = [...marks].filter(m => m === "1").length, inside = insideCells(g, marks);
  // the inside is what the lines say: a line between two cells puts them on opposite sides, a crossed edge on the same side, a line on the board's rim has the cell inside
  let fine = true;
  g.ecells.forEach((cs, e) => {
    const line = marks[e] === "1";
    if (cs.length === 1) { if ((inside[cs[0]] === 1) !== line) fine = false; } else if ((inside[cs[0]] !== inside[cs[1]]) !== line) fine = false;
  });
  check(fine && inside.some(x => x) && inside.some(x => !x), `${tag}: the cells inside the loop are the ones the lines put on the inner side (a line changes the side, a crossed edge doesn't)`);
  const path = loopPath(g, marks);
  check(path && path.length === lines, `${tag}: the loop is walked corner by corner, straight through a causeway (${lines} lines)`);
  const lm = landMesh(g, marks), triangles = lm.index.length / 3, area = inside.reduce((a, b) => a + b, 0);
  let up = 0, tall = 0;
  for (let i = 0; i < lm.index.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => lm.index[i + k] * 3), ux = lm.positions[b] - lm.positions[a], uz = lm.positions[b + 2] - lm.positions[a + 2], vx = lm.positions[c] - lm.positions[a], vz = lm.positions[c + 2] - lm.positions[a + 2];
    if (uz * vx - ux * vz > 0) up++;
  }
  for (let v = 0; v < lm.positions.length; v += 3) if (lm.positions[v + 1] > HILL + 1e-9) tall++;
  check(up === triangles && tall === 0, `${tag}: every triangle of the land faces up, no hill taller than ${HILL}`);
  check(shape !== "hex" || triangles === area * 6 * 16, `${tag}: ${shape === "hex" ? `the land is its ${area} hexagons in 96 triangles each` : "the land is its squares"}`);
  let shore = true;
  for (let v = 0; v < lm.positions.length; v += 3) { const d = coastDistance(lm.segs, lm.positions[v], lm.positions[v + 2]); if (d < 1e-9 && Math.abs(lm.positions[v + 1]) > 1e-9) shore = false; }
  check(shore, `${tag}: the land is level with the vellum on the coast itself`);
  const [bx0, by0, bx1, by1] = g.box, sm = seaMesh(shape === "hex" ? { ...g, W: bx1 - bx0, H: by1 - by0 } : g, marks, MARGIN, MARGIN);
  check(sm.index.length > 0 && sm.positions.length / 12 === sm.index.length / 6, `${tag}: the sea is whole squares (${sm.index.length / 6})`);
  const outside = (x, y) => !insideAt(lm.segs, x, y), crs = seaCourse(path, 0.34, (x, y) => !outside(x, y)), cs = course(crs), hb = harbourOf(path, (x, y) => !outside(x, y));
  let onSea = 0;
  for (let i = 0; i < 120; i++) { const p = cs.at((i / 120) * cs.total); if (outside(p.x, p.y)) onSea++; }
  check(onSea >= 112, `${tag}: the cog's course is on the sea side of the coast (${onSea} of 120 points; a causeway may take it over)`);
  check(outside(hb.x + hb.out[0] * 0.3, hb.y + hb.out[1] * 0.3) && !outside(hb.x - hb.out[0] * 0.3, hb.y - hb.out[1] * 0.3), `${tag}: the harbour looks out to sea and its town is on the land`);
  if (shape === "hex") {
    let mids = true, same = true, n = 0;
    for (let e = 0; e < g.E; e++) { const [x1, y1, x2, y2] = g.epos[e]; if (edgeAtPoint(g, (x1 + x2) / 2, (y1 + y2) / 2) !== e) mids = false; }
    for (let y = by0 - 0.5; y <= by1 + 0.5; y += 0.31) for (let x = bx0 - 0.5; x <= bx1 + 0.5; x += 0.29) {
      n++;
      let best = -1, bd = 0.16;
      for (let e = 0; e < g.E; e++) { const [x1, y1, x2, y2] = g.epos[e], dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))), d = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2; if (d < bd) { bd = d; best = e; } }
      if (edgeAtPoint(g, x, y) !== best) same = false;
    }
    check(mids && same, `${tag}: the middle of every edge means that edge, and a tap means the nearest edge within 0.4 (${n} points)`);
  }
}

// ---------- the chart wired to it ----------
{
  const gl = fs.readFileSync(new URL("../slitherlink-3d.js", import.meta.url), "utf8"), js = fs.readFileSync(new URL("../slitherlink.js", import.meta.url), "utf8");
  check(/buildBridges/.test(gl) && /seaCourse\(path, 0\.34, free/.test(gl) && /normalise/.test(gl), "the chart draws causeways as stone bridges over a ford, and tells a honeycomb's coast from the inside");
  check(/model\.set\(\{ g: P\.view, clue: P\.clue, twisted/.test(js) && !/modelOn = .*twisted/.test(js), "the page gives the chart every board, not only the plain square");
}

process.exit(bad ? 1 : 0);
