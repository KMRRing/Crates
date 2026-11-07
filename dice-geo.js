// A real die for three.js scenes (vendor/three.js): a cube with rounded edges and a bead for each pip, built once and instanced.
// Written for Cartel's table; yacht-3d.js has its own copy of the same shapes and could take these instead.
import * as THREE from "./vendor/three.js";
import { DIE, FACES, PIP_AT } from "./yacht-3d-geo.js";

const V = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/** A box with rounded edges and corners, `size` along each side. */
export function roundedBox(size = DIE, r = 0.085, seg = 5) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg), p = g.attributes.position, inner = size / 2 - r, c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    V.set(p.getX(i), p.getY(i), p.getZ(i));
    c.set(Math.max(-inner, Math.min(inner, V.x)), Math.max(-inner, Math.min(inner, V.y)), Math.max(-inner, Math.min(inner, V.z)));
    V.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, V.x, V.y, V.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Geometries joined into one (positions, normals and indices). */
export function merge(list) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    const ix = g.index;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

/** The pips of a die: a flattened bead on each face where the face's number has one; the one's apart (it is red). */
export function pipGeometry(onlyOne) {
  const parts = [], off = DIE * 0.24;
  for (const [nx, ny, nz, value] of FACES) {
    if ((value === 1) !== onlyOne) continue;
    const n = new THREE.Vector3(nx, ny, nz), u = Math.abs(ny) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), w = new THREE.Vector3().crossVectors(n, u);
    for (const [a, b] of PIP_AT[value]) {
      const g = new THREE.SphereGeometry(value === 1 ? 0.12 : 0.085, 12, 8), m = new THREE.Matrix4();
      const p = n.clone().multiplyScalar(DIE / 2 - 0.012).addScaledVector(u, a * off).addScaledVector(w, b * off);
      m.compose(p, new THREE.Quaternion().setFromUnitVectors(UP, n), new THREE.Vector3(1, 0.34, 1));   // squashed along the face's normal
      g.applyMatrix4(m);
      parts.push(g);
    }
  }
  return merge(parts);
}

/** The die's turn that shows `value` on top, turned `yaw` about the vertical. */
export function showing(value, yaw = 0) {
  const f = FACES.find(x => x[3] === value) || FACES[0];
  const q = new THREE.Quaternion().setFromUnitVectors(V.set(f[0], f[1], f[2]), UP);
  return new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(q);
}
