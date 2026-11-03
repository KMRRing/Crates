// Bridges' 3D in a few draw calls (bridges-batch.js): pieces gathered under groups into one mesh with a colour on every vertex, a
// mesh that shows only the groups it is told to, and colours that change with the theme. Plain geometry, so it runs in Node.
import * as THREE from "../vendor/three.js";
import { createBatch, prep } from "../bridges-batch.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const BOX = 36;                                              // vertices of a box as separate triangles

const b = createBatch();
b.add("a", new THREE.BoxGeometry(1, 1, 1), at(0, 0, 0), "sand");
b.add("a", new THREE.BoxGeometry(1, 1, 1), at(2, 0, 0), "grass");
b.add("b", new THREE.BoxGeometry(1, 1, 1), at(4, 0, 0), "sand");
b.add("a", new THREE.BoxGeometry(1, 1, 1), at(6, 0, 0), "timber");        // a group may be added to again after another's
b.add("c", new THREE.CylinderGeometry(0.2, 0.3, 1, 8), null, "timber");
check(b.vertices === 4 * BOX + b.count(["c"]) && b.groups.join() === "a,b,c", `five pieces in three groups: ${b.vertices} vertices, ${b.triangles} triangles`);
check(b.count(["a"]) === 3 * BOX && b.count(["a", "b"]) === 4 * BOX && b.count(["nothing"]) === 0, "a group counts its own pieces, wherever they were added");

const mesh = b.build(new THREE.MeshStandardMaterial({ vertexColors: true }), role => ({ sand: 0xff0000, grass: 0x00ff00, timber: 0x0000ff }[role]));
const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
check(pos.count === b.vertices && col.count === b.vertices && mesh.geometry.attributes.normal.count === b.vertices, "one mesh holds every piece, with a position, a normal and a colour on each vertex");
check(col.array[0] === 1 && col.array[1] === 0 && col.array[2] === 0 && col.array[BOX * 3] === 0 && col.array[BOX * 3 + 1] === 1, "each piece has the colour of its role (the first sand red, the next grass green)");
check(Math.abs(pos.getX(BOX) - 2) <= 0.51 && Math.abs(pos.getX(2 * BOX) - 4) <= 0.51, "a piece is where its matrix put it");

// a prepared piece, placed many times: the same triangles as making the geometry and moving it each time
{
  const link = new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(3, 0, -2), local = new THREE.Matrix4().makeTranslation(0.7, 0.2, -0.3);
  const viaAdd = createBatch(), viaPut = createBatch();
  viaAdd.add("g", new THREE.CylinderGeometry(0.02, 0.024, 0.4, 5), link.clone().multiply(local).multiply(new THREE.Matrix4().makeScale(1, 1, 1)), "pile");
  const tpl = prep(new THREE.CylinderGeometry(0.02, 0.024, 1, 5));
  viaPut.put("g", tpl, link, "pile", 0.7, 0.2, -0.3, 0.4);
  const ma = viaAdd.build(new THREE.MeshStandardMaterial({ vertexColors: true })), mp = viaPut.build(new THREE.MeshStandardMaterial({ vertexColors: true }));
  let worst = 0, worstN = 0;
  const pa = ma.geometry.attributes.position.array, pp = mp.geometry.attributes.position.array, na = ma.geometry.attributes.normal.array, np = mp.geometry.attributes.normal.array;
  for (let i = 0; i < pa.length; i++) { worst = Math.max(worst, Math.abs(pa[i] - pp[i])); }
  // the side normals of a pile stretched in height differ a little (the taper); the caps' and the turn are exact
  for (let i = 0; i < na.length; i += 3) worstN = Math.max(worstN, Math.hypot(na[i] - np[i], na[i + 1] - np[i + 1], na[i + 2] - np[i + 2]));
  check(pa.length === pp.length && worst < 1e-5, `a placed copy is where the moved geometry is (the farthest vertex ${worst.toExponential(1)} off)`);
  check(worstN < 0.06, `and faces the same way (a stretched pile's slanted sides differ by at most ${worstN.toFixed(3)})`);
  check(viaPut.vertices === viaAdd.vertices && viaPut.count(["g"]) === viaAdd.count(["g"]), "and is in its group the same");
  viaAdd.dispose(); viaPut.dispose();
}

// a piece's vertices are the same ones whichever group they are shown as
check(b.show(null) === b.vertices && mesh.geometry.index === null && mesh.visible, "no choice shows everything, without an index");
check(b.show(["b"]) === BOX && mesh.geometry.index.count === BOX && mesh.geometry.drawRange.count === BOX, "one group shows its vertices only");
const idx = Array.from(mesh.geometry.index.array);
check(idx.every(i => i >= 2 * BOX && i < 3 * BOX) && new Set(idx).size === BOX, "and they are that group's");
check(b.show(["a", "c"]) === 3 * BOX + b.count(["c"]) && mesh.geometry.index.count === 3 * BOX + b.count(["c"]), "a group added to in two places shows all of both");
const first = mesh.geometry.index;
b.show(["c", "a"]);
check(mesh.geometry.index === first, "the same groups asked for in another order rebuild nothing");
check(b.show([]) === 0 && !mesh.visible, "no groups, nothing drawn");
check(b.show(["b"]) === BOX && mesh.visible, "and back");

// the colours of a new theme
b.recolor(() => 0x336699);
check(Math.abs(col.array[0] - col.array[BOX * 3]) < 1e-9 && col.array[2] > col.array[0], "recolouring sets every vertex again from its role");
b.recolor(role => (role === "sand" ? 0xffffff : 0x000000));
check(col.array[0] === 1 && col.array[BOX * 3] === 0 && col.array[2 * BOX * 3] === 1, "by role: the sand white, the rest black");

// a big one: a board's worth of pieces is still one mesh, and choosing groups stays cheap
{
  const big = createBatch();
  for (let g = 0; g < 200; g++) for (let k = 0; k < 6; k++) big.add(`link${g}`, new THREE.BoxGeometry(0.1, 0.1, 0.4), at(g, k, 0), k % 2 ? "timber" : "rail");
  const m = big.build(new THREE.MeshStandardMaterial({ vertexColors: true }), () => 0xffffff), t0 = performance.now();
  const n = big.show(Array.from({ length: 100 }, (_, g) => `link${g * 2}`));
  check(m.geometry.attributes.position.count === 200 * 6 * BOX && n === 100 * 6 * BOX && performance.now() - t0 < 500, `200 links of six pieces are ${m.geometry.attributes.position.count} vertices in one mesh; showing 100 of them took ${Math.round(performance.now() - t0)} ms`);
  big.dispose();
}
// more vertices than a 16-bit index reaches: a board's bridges, every variant of every link, are well over it
{
  const huge = createBatch();
  for (let g = 0; g < 2000; g++) huge.add(`g${g}`, new THREE.BoxGeometry(0.1, 0.1, 0.1), at(g, 0, 0), "x");
  const m = huge.build(new THREE.MeshStandardMaterial({ vertexColors: true })), n = huge.show(["g1999", "g3", "g1500"]);
  const idx = m.geometry.index;
  check(huge.vertices === 2000 * BOX && n === 3 * BOX && idx.count === 3 * BOX && Math.max(...idx.array) === 2000 * BOX - 1, `${huge.vertices} vertices: the groups far along are reached (the largest index ${Math.max(...idx.array)}, in a ${idx.array.constructor.name})`);
  huge.dispose();
}
b.dispose();
check(b.mesh === null, "a batch lets its geometry go");

console.log(bad ? `\n${bad} FAILED` : "\nbridges batch: pieces in one mesh, groups shown, roles coloured");
process.exit(bad ? 1 : 0);
