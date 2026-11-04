// The dice kit (dice3d.js and its pure half dice3d-geo.js): the faces and where each lies on the atlas, that a die "showing v" has
// v up and its picture's top away from the player, the bevelled die and the lathe's cups facing outward, a throw's numbers
// being a seed's, resting places apart, what changed between two sets of dice, and that every three.js class the kit asks for
// is in the vendored bundle (it holds only what pages use, and a missing one silently drops the page to flat).
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three.js";
import * as geo from "../dice3d-geo.js";
import * as kit from "../dice3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const { FACES, FRAME, ATLAS } = geo;
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// ---------- faces ----------
check(FACES.every(([x, y, z, v]) => { const o = FACES.find(f => f[0] === -x && f[1] === -y && f[2] === -z); return o && o[3] + v === 7; }), "opposite faces make seven");
check(Object.values(FRAME).every(f => near(f.n[0] * f.up[0] + f.n[1] * f.up[1] + f.n[2] * f.up[2], 0) && near(f.right[0] * f.n[0] + f.right[1] * f.n[1] + f.right[2] * f.n[2], 0)), "each face's picture axes lie in the face");
{
  // showing(v, yaw) turns face v to the top, its picture's top toward -z; yaw turns it about the vertical
  let ok = true, tops = true;
  for (const v of [1, 2, 3, 4, 5, 6]) {
    const q = kit.showing(v, 0), f = FRAME[v];
    const n = new THREE.Vector3(...f.n).applyQuaternion(q), up = new THREE.Vector3(...f.up).applyQuaternion(q);
    if (!(near(n.y, 1) && near(up.z, -1))) { ok = false; console.log(v, n, up); }
    const yawed = new THREE.Vector3(...f.n).applyQuaternion(kit.showing(v, 1.1));
    if (!near(yawed.y, 1)) tops = false;
  }
  check(ok, "a die showing v has face v up and its picture's top away from the player, for all six");
  check(tops, "turning a die about the vertical keeps its face up");
}
{
  let inCell = true;
  for (const v of [1, 2, 3, 4, 5, 6]) {
    const { col, row } = geo.cellOf(v), f = FRAME[v];
    for (const [a, b] of [[-0.5, -0.5], [0.5, 0.5], [0, 0]]) {
      const p = [0, 1, 2].map(i => f.n[i] * 0.5 + f.right[i] * a + f.up[i] * b);
      const [u, w] = geo.atlasUV(v, ...p);
      if (u < col / 3 - 1e-9 || u > (col + 1) / 3 + 1e-9 || w < (1 - row) / 2 - 1e-9 || w > (2 - row) / 2 + 1e-9) inCell = false;
    }
  }
  check(inCell, "every point of a face lands inside its own cell of the atlas");
  check(geo.faceAt(0.5, 0.5, 0.2) === 2 && geo.faceAt(0.1, -0.5, 0.2) === 6 && geo.faceAt(0, 0, -0.5) === 4, "a point belongs to the face of its biggest axis");
}

// ---------- the die and the cup ----------
{
  const g = kit.dieGeometry(), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  let out = true, within = true;
  for (let i = 0; i < p.count; i++) {
    if (Math.max(Math.abs(p.getX(i)), Math.abs(p.getY(i)), Math.abs(p.getZ(i))) > 0.5 + 1e-6) within = false;
    if (p.getX(i) * n.getX(i) + p.getY(i) * n.getY(i) + p.getZ(i) * n.getZ(i) < -1e-6) out = false;
    if (uv.getX(i) < -1e-6 || uv.getX(i) > 1 + 1e-6 || uv.getY(i) < -1e-6 || uv.getY(i) > 1 + 1e-6) within = false;
  }
  check(out && within, "the die is a unit box with outward normals and every vertex on the atlas");
  check(g.index.count / 3 < 1400, `a die is ${g.index.count / 3} triangles (instanced for any number of them)`);
  const c = kit.cupGeometry(), cp = c.attributes.position, cn = c.attributes.normal, ix = c.index;
  let wrong = 0, checked = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const [a, b, d] = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    const e1 = [0, 1, 2].map(k => cp.array[b * 3 + k] - cp.array[a * 3 + k]), e2 = [0, 1, 2].map(k => cp.array[d * 3 + k] - cp.array[a * 3 + k]);
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (Math.hypot(...f) < 1e-12) continue;
    checked++;
    if (f[0] * cn.array[a * 3] + f[1] * cn.array[a * 3 + 1] + f[2] * cn.array[a * 3 + 2] <= 0) wrong++;
  }
  check(wrong === 0, `every triangle of the cup faces the way its normals say (${checked} checked)`);
}

// ---------- seeds, places, differences ----------
{
  const a = geo.tumble(42), b = geo.tumble(42), c = geo.tumble(43);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), "a tumble is a seed's: the same on every device");
  const s1 = geo.scatter(9, 5, { x0: -3, x1: 3, z0: -2, z1: 1 }), s2 = geo.scatter(9, 5, { x0: -3, x1: 3, z0: -2, z1: 1 });
  check(JSON.stringify(s1) === JSON.stringify(s2), "resting places come from the seed");
  let apart = true;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (Math.hypot(s1[i].x - s1[j].x, s1[i].z - s1[j].z) < 1.4) apart = false;
  check(apart, "dice rest apart from each other");
  const d = (id, o = {}) => ({ id, value: 3, x: 0, z: 0, size: 1, cover: false, ...o });
  const df = geo.diffDice([d(1), d(2, { cover: true }), d(3), d(4), d(5, { cover: false }), d(6)], [d(1), d(2), d(3, { value: 5 }), d(7), d(5, { cover: true }), d(6, { x: 3 })]);
  const ids = k => df[k].map(x => x.id).join();
  check(ids("still") === "1" && ids("revealed") === "2" && ids("rolled") === "3" && ids("born") === "7" && ids("covered") === "5" && ids("moved") === "6" && df.gone.map(x => x.id).join() === "4",
    "between two sets each die is born, gone, revealed, covered, rolled, moved or still");
}

// ---------- what the bundle has ----------
{
  const src = ["../dice3d.js", "../cartel-3d.js"].map(f => { try { return readFileSync(new URL(f, import.meta.url), "utf8"); } catch { return ""; } }).join("\n");
  const used = [...new Set([...src.matchAll(/THREE\.([A-Z]\w+)/g)].map(m => m[1]))];
  const missing = used.filter(n => !(n in THREE));
  check(used.length > 10 && !missing.length, `every three.js name the scene asks of the vendored bundle is there${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  check(!/new THREE.PerspectiveCamera|new THREE.LatheGeometry|new THREE.PlaneGeometry|new THREE.BufferAttribute|new THREE.RingGeometry|new THREE.PointLight|new THREE.SpotLight/.test(src.replace(/Float32BufferAttribute/g, "")), "no class the trimmed bundle leaves out");
  check(!/\balert\(|\bconfirm\(|\bprompt\(/.test(src), "no browser dialogs");
}
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all ok");
