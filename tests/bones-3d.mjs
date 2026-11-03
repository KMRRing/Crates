// Dominoes' 3D table (Menu, View; bones-3d.js, drawn with three.js, and bones-3d-geo.js, its pure part): the table's size and the camera's
// exact fit at every pose, where a finger lands on the cloth, the line's tiles standing inside the cloth (the layout's own measure),
// the arc a tile is carried along, the pile of tiles face down, the classes the scene asks of the vendored three.js, and the page's
// wiring (flat is the default, the choice is the device's own, the scene is only loaded when asked for). Plain geometry, so it runs
// in Node in a moment; the picture itself is looked at in a browser.
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three.js";
import * as geo from "../bones-3d-geo.js";
import { layout } from "../bones-layout.js";
import { TILES } from "../bones-rules.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const BOXES = [[374, 330, 90], [374, 560, 90], [560, 780, 110], [880, 640, 100], [700, 300, 80], [320, 260, 80]];

// ---------- the table's size and the camera's fit ----------
{
  let fits = 0, total = 0, covered = 0, rows = 0;
  for (const [w, h, c] of BOXES) for (const units of [16, 22, 30]) {
    const plan = geo.planTable({ w, h, covered: c, units, minLen: Math.ceil(w / 40) - 1 });
    rows += plan.rows === geo.rowsFor(plan.len, units) && plan.len / 2 + plan.rows * (plan.len - 1) >= units ? 1 : 0;
    const v = geo.viewIn(plan, { elev: plan.elev }, w, h);
    covered += geo.rowOf([0, 0, -plan.depth / 2 + plan.m], 0, plan.elev, v.f, h) >= c - 0.5 ? 1 : 0;
    // at every pose, every corner of the table is inside the box
    for (const yaw of [-geo.MAX_YAW, 0, geo.MAX_YAW]) for (const elev of [geo.MIN_ELEV, plan.elev, geo.MAX_ELEV]) {
      const f = geo.viewIn(plan, { yaw, elev }, w, h).f;
      for (const p of plan.outline) {
        const { u, v: vv } = geo.project(p, yaw, elev);
        total++;
        if (u >= f.cu - f.hu - 1e-9 && u <= f.cu + f.hu + 1e-9 && vv >= f.cv - f.hv - 1e-9 && vv <= f.cv + f.hv + 1e-9) fits++;
      }
    }
  }
  check(rows === BOXES.length * 3, "the rows are the fewest that hold the line's room, whatever the box");
  check(fits === total, "the table is inside the box at every pose the player can reach");
  check(covered === BOXES.length * 3, "the plates' strip (the box's top pixels) lies over the far frame, never the cloth");
  const a = geo.planTable({ w: 374, h: 330, covered: 90, units: 22 }), b = geo.planTable({ w: 374, h: 330, covered: 90, units: 40 });
  check(a.len <= b.len && a.rows <= b.rows, "a longer line asks for a bigger table");
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) geo.planTable({ w: 374, h: 330, covered: 90, units: 22 });
  check(performance.now() - t0 < 1500, "working the table out takes a few milliseconds");
  // a pose is kept inside what the table allows; a zoom's move stays inside the picture
  const plan = geo.planTable({ w: 374, h: 330, covered: 90 });
  const wild = geo.viewIn(plan, { yaw: 3, elev: 0.1, zoom: 9, panU: 5, panV: -5 }, 374, 330);
  check(wild.yaw === geo.MAX_YAW && wild.elev === geo.MIN_ELEV && wild.zoom === geo.MAX_ZOOM, "yaw, tilt and zoom are held to their limits (never under the table)");
  check(near(Math.abs(wild.panU), wild.base.hu - wild.base.hu / wild.zoom) && near(Math.abs(wild.panV), wild.base.hv - wild.base.hv / wild.zoom), "the move is held inside the fitted window");
  const w1 = geo.viewIn(plan, { zoom: 1, panU: 3, panV: 3 }, 374, 330);
  check(w1.panU === 0 && w1.panV === 0, "unzoomed, there is nothing to move");
  check(geo.clampElev(NaN) === geo.START_ELEV && geo.clampYaw(NaN) === 0 && geo.clampZoom(NaN) === 1, "a number that isn't one is the opening pose");
}

// ---------- a finger on the cloth ----------
{
  const plan = geo.planTable({ w: 374, h: 330, covered: 90 });
  let worst = 0, n = 0;
  for (const yaw of [-0.3, 0, 0.35]) for (const elev of [0.7, 0.95, 1.2]) for (const zoom of [1, 2]) {
    const v = geo.viewIn(plan, { yaw, elev, zoom, panU: 0.01 }, 374, 330);
    for (const [x, z] of [[0, 0], [2.3, -1.1], [-4, 3], [5, 5]]) {
      const px = geo.pixelOf(v.f, v.yaw, v.elev, 374, 330, [x, 0.03, z]), back = geo.groundAt(v.f, v.yaw, v.elev, 374, 330, px[0], px[1], 0.03);
      worst = Math.max(worst, Math.hypot(back[0] - x, back[1] - z)); n++;
    }
  }
  check(n === 72 && worst < 1e-6, "a point on the cloth, seen at a pixel and ray-cast back, is the same point at every pose");
  const v = geo.viewIn(plan, { elev: plan.elev }, 374, 330);
  const mid = geo.groundAt(v.f, 0, plan.elev, 374, 330, 187, 165, 0);
  check(Math.abs(mid[0]) < 2 && Math.abs(mid[1]) < 3, "the middle of the box is near the middle of the table");
  const places = [{ end: "L", x: -3, z: 0, yaw: 0 }, { end: "R", x: 3, z: 0, yaw: 0 }, { end: "R", x: 5, z: 2.5, yaw: -Math.PI / 2 }];
  check(geo.nearestPlace(places, [-3.2, 0.2]).end === "L" && geo.nearestPlace(places, [3.4, -0.1]).end === "R", "a tap inside a place's tile is that place");
  check(geo.nearestPlace(places, [0, 0]) === null && geo.nearestPlace(places, [-3, 1.2], 0.45) === null, "a tap away from every place is none");
  check(geo.nearestPlace(places, [5.2, 3.4]) === places[2] && geo.nearestPlace(places, [6.2, 2.5]) === null, "a place turned across the line is measured in its own frame");
  check(geo.nearestPlace(places, [-4.2, 0.3], 0.45) === places[0], "a finger's width past the tile still counts");
}

// ---------- the line stands inside the cloth ----------
{
  let seed = 7;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  let inside = 0, runs = 0, worstX = 0, worstZ = 0;
  for (const [w, h, c] of BOXES) for (const units of [16, 22]) {
    const plan = geo.planTable({ w, h, covered: c, units, minLen: Math.ceil(w / 40) - 1 });
    for (let k = 0; k < 40; k++) {
      // a random line with `units` along each arm at most: tiles of length 2 and doubles of 1 (the layout's own units)
      const arm = () => { const a = []; let used = 0; while (used < units) { const t = Math.floor(rnd() * 28), d = TILES[t][0] === TILES[t][1]; if (used + (d ? 1 : 2) > units) break; a.push({ t, v: Math.floor(rnd() * 7) }); used += d ? 1 : 2; } return a; };
      const L = layout(13, [3, 4], arm(), arm(), plan.len);
      let ok = true;
      for (const p of L.tiles) {
        const q = geo.worldOf(p, plan.z0), hw = p.v ? 0.5 : 1, hh = p.v ? 1 : 0.5;
        worstX = Math.max(worstX, Math.abs(q.x) + hw - plan.hw); worstZ = Math.max(worstZ, Math.abs(q.z - plan.z0) + hh - plan.fd);
        if (Math.abs(q.x) + hw > plan.hw + 1e-9 || Math.abs(q.z - plan.z0) + hh > plan.fd + 1e-9) ok = false;
      }
      runs++; if (ok) inside++;
    }
  }
  check(inside === runs, `every tile of ${runs} random lines of the room asked for stands on the cloth, inside its frame (worst overhang ${worstX.toFixed(2)} across, ${worstZ.toFixed(2)} deep)`);
  const p = { x: 2, y: -1.5, v: true };
  const q = geo.worldOf(p, 0.5);
  check(q.x === 2 && q.z === -1 && q.yaw === -Math.PI / 2 && geo.worldOf({ x: 0, y: 0, v: false }).yaw === 0, "a tile across the page lies along z; its numbers (left or top first) run along its own x");
}

// ---------- a tile laid ----------
{
  const f0 = geo.flight(0), f1 = geo.flight(1), mid = geo.flight(0.5);
  check(f0.along === 0 && f0.lift === 0 && f1.along === 1 && near(f1.lift, 0, 1e-9) && f1.lean === 0 && f1.twist === 0, "a tile leaves the hand and lands flat, no lean, no twist");
  check(mid.lift > 1.2 && mid.lean > 0, "halfway it is lifted clear of the table and still leaning");
  let up = true, prev = -1, lifted = 0;
  for (let i = 0; i <= 40; i++) { const k = geo.flight(i / 40); if (k.along < prev - 1e-9) up = false; prev = k.along; lifted = Math.max(lifted, k.lift); }
  check(up && lifted < 1.6 && geo.flight(-3).along === 0 && geo.flight(9).along === 1, "it only ever moves forward, a short arc");
  const o = geo.handOrigin("me", { hw: 5.5, depth: 11 });
  check(o[2] > 5.5 && geo.handOrigin("top", { hw: 5.5, depth: 11 })[2] < -5.5 && geo.handOrigin("left", { hw: 5.5, depth: 11 })[0] < -5.5 && geo.handOrigin("right", { hw: 5.5, depth: 11 })[0] > 5.5, "each player's tile comes from their own side");
}

// ---------- the pile ----------
{
  const rect = (s, yaw) => { const c = Math.cos(yaw), n = Math.sin(yaw); return [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5]].map(([x, z]) => [s.x + x * c + z * n, s.z - x * n + z * c]); };
  const axes = r => [[r[1][0] - r[0][0], r[1][1] - r[0][1]], [r[3][0] - r[0][0], r[3][1] - r[0][1]]];
  const apart = (a, b) => axes(a).concat(axes(b)).some(([ax, az]) => { const proj = r => r.map(([x, z]) => x * ax + z * az), A = proj(a), B = proj(b); return Math.max(...A) < Math.min(...B) - 1e-9 || Math.max(...B) < Math.min(...A) - 1e-9; });
  let clash = 0;
  const spots = Array.from({ length: 16 }, (_, k) => geo.pileSpot(k, 3, 2));
  for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) if (spots[i].y === spots[j].y && !apart(rect(spots[i], spots[i].yaw), rect(spots[j], spots[j].yaw))) clash++;
  check(clash === 0, "no two tiles of a layer in the pile lie through each other");
  check(spots[0].y === 0 && spots[4].y > 0.3 && spots[4].y < geo.TILE_T && spots[15].y < 4 * geo.TILE_T, "layers stack a tile's thickness, no more, so it reads as a heap");
  const deal = { hands: [[0, 1, 2], [3, 4], [5], []], dead: [[6], [], [], []], first: 7, left: [{ t: 8, v: 1 }], right: [{ t: 9, v: 2 }] };
  const out = geo.outOfPlay(deal);
  check(out.length === 28 - 3 - 2 - 1 - 1 - 1 - 1 - 1 && !out.includes(0) && !out.includes(6) && !out.includes(7) && !out.includes(8) && !out.includes(9) && out.includes(10), "the pile is the tiles in no hand, not in the line and not laid down");
  check(geo.outOfPlay({ hands: [Array.from({ length: 7 }, (_, i) => i), Array.from({ length: 7 }, (_, i) => 7 + i), Array.from({ length: 7 }, (_, i) => 14 + i), Array.from({ length: 7 }, (_, i) => 21 + i)], dead: [[], [], [], []], first: null, left: [], right: [] }).length === 0, "a block game's four hands leave no pile");
}

// ---------- the scene's classes and the page's wiring ----------
{
  const src = read("bones-3d.js"), js = read("bones.js"), css = read("bones-3d.css"), html = read("bones.html");
  const used = [...new Set([...src.matchAll(/THREE\.(\w+)/g)].map(m => m[1]))], missing = used.filter(n => !(n in THREE));
  check(missing.length === 0, `every three.js class the table asks for is in the vendored build${missing.length ? ` (missing: ${missing.join(", ")})` : ` (${used.length} used)`}`);
  check(/tableView\("bones"\)/.test(js) && /view\.choice\(/.test(js), "the menu offers View through the shared tableView (flat is the default, the choice the device's own)");
  check(/import\("\.\/bones-3d\.js"\)/.test(js) && !/^import .*bones-3d\.js/m.test(js), "the scene is loaded only when the 3D table is asked for");
  check(/classList\.toggle\("bn3", !!table3\)/.test(js), "the page's class follows the scene being up, so a device that can't draw it stays flat");
  check(/catch\(err =>[^]*?view\.set\("table"\)/.test(js) && /onLost/.test(js) && /webglcontextlost/.test(src), "no WebGL, or a lost context, falls back to the flat table");
  check(/onPause\(\(\) => table3\?\.hold\(\)/.test(js), "the table stands still while the menu is open");
  check(/dispose\(\)/.test(src) && /renderer\.forceContextLoss/.test(src) && /geometry\.dispose/.test(src), "going back to flat disposes the geometry, the materials and the context");
  check(/shadowMap\.autoUpdate = false/.test(src) && /1000 \/ 30/.test(src) && /1000 \/ 15/.test(src) && /Math\.min\(devicePixelRatio \|\| 1, 2\)/.test(src), "it draws on demand, 30 frames a second moving, 15 settling, pixel ratio at most 2");
  check(!/rotateX\(\d/.test(css) && !/perspective\(/.test(css), "the old tipped plane is gone");
  check(html.includes("bones-3d.css"), "the page links the 3D stylesheet");
  check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "")), "sizes in rem, not px");
  check(!/\b(alert|confirm|prompt)\(/.test(src), "no browser pop-ups");
  check(/IN_FRAME/.test(read("table3d-view.js")), "a watching frame draws the flat table and never writes the choice");
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
