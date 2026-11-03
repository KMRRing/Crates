// Bridges' 3D drawn in a handful of draw calls: many small pieces of geometry (an island's beach, lawn and trees, a bridge's deck
// and railings and trestles, a link's dashes) gathered into one mesh with a colour on every vertex, so the whole board is a few
// things to draw and not a few hundred. Pieces are added under a group (an island, a link's single bridge, ...) and a mesh can
// show only some of its groups (the bridges the marks say, the dashes of the links without one) by choosing which vertices to
// draw. Colours are named roles ("sand", "timber"), set again when the theme or the time of day changes.
//
// No picture in it: the geometry is plain arrays, so a test can build a batch in Node and count what it holds.
import * as THREE from "./vendor/three.js";

/** A geometry's triangles as flat arrays: positions, and normals when it has them (a piece without any gets zeros: the materials here are flat shaded or unlit). */
function flat(geo, matrix) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (matrix) g.applyMatrix4(matrix);
  const p = g.attributes.position.array, n = g.attributes.normal?.array;
  const out = { p: Float32Array.from(p), n: n ? Float32Array.from(n) : new Float32Array(p.length) };
  g.dispose();
  return out;
}

/**
 * A geometry made ready to be placed many times (`put` in a batch): its triangles as flat arrays. The geometry is let go. A board
 * has thousands of posts and piles, all alike: making each its own three.js geometry took most of the time it took to build a board.
 */
export function prep(geo) {
  const { p, n } = flat(geo, null);
  geo.dispose();
  return { p, n };
}

export function createBatch() {
  const pos = [], nor = [], pieces = [], names = [], at = new Map();   // chunks of positions and of normals, each piece's [first vertex, vertices, role number], the role names, group → [[from, count]…]
  let mesh = null, shown, count = 0, total = 0;          // `shown`: the key of the groups on show, undefined until the first choice
  const roleNo = name => { let i = names.indexOf(name); if (i < 0) { i = names.length; names.push(name); } return i; };
  const join = chunks => { const all = new Float32Array(total * 3); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; } return all; };
  /** Takes in a piece's arrays under a group. Pieces of one group that follow each other count as one range, so a group costs a few numbers however many pieces it has. */
  const take = (group, p, n, role) => {
    const from = total, vs = p.length / 3;
    pos.push(p); nor.push(n); pieces.push([from, vs, roleNo(role)]); total += vs;
    const list = at.get(group) || [], last = list.at(-1);
    if (last && last[0] + last[1] === from) last[1] += vs; else list.push([from, vs]);
    at.set(group, list);
  };
  return {
    /** Adds a piece to a group. `geo` is a three.js geometry (disposed here), `matrix` where it goes (or null), `role` its colour's name. */
    add(group, geo, matrix, role) {
      const { p, n } = flat(geo, matrix);
      take(group, p, n, role);
      geo.dispose();
    },
    /**
     * Adds a copy of a `prep`ared piece: stretched up by `sy`, moved by (lx, ly, lz), then put by the matrix `m`, which may turn and move
     * it but not scale it (the link's frame is a turn about y and a move).
     */
    put(group, tpl, m, role, lx = 0, ly = 0, lz = 0, sy = 1) {
      const e = m.elements, k = tpl.p.length, p = new Float32Array(k), n = new Float32Array(k), tp = tpl.p, tn = tpl.n;
      for (let i = 0; i < k; i += 3) {
        const x = tp[i] + lx, y = tp[i + 1] * sy + ly, z = tp[i + 2] + lz, a = tn[i], b = tn[i + 1], c = tn[i + 2];
        p[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; p[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; p[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        n[i] = e[0] * a + e[4] * b + e[8] * c; n[i + 1] = e[1] * a + e[5] * b + e[9] * c; n[i + 2] = e[2] * a + e[6] * b + e[10] * c;
      }
      take(group, p, n, role);
    },
    get vertices() { return total; },
    /** The vertices on show now (all of them before the first choice). */
    get drawn() { return shown === undefined ? total : count; },
    get triangles() { return total / 3; },
    get groups() { return [...at.keys()]; },
    /** How many vertices a set of groups has. */
    count(groups) { let c = 0; for (const g of groups) for (const [, n] of at.get(g) || []) c += n; return c; },
    /** The mesh, made once (`material` is a three.js material with `vertexColors` on when the batch has colours to give it). */
    build(material, colorOf = () => 0xffffff) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(join(pos), 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(join(nor), 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(total * 3).fill(1), 3));
      pos.length = nor.length = 0;                          // the arrays are the geometry's now
      mesh = new THREE.Mesh(g, material);
      this.recolor(colorOf);
      return mesh;
    },
    /** Sets the colours again: `colorOf(role)` is a number (0xRRGGBB) for each role's name. */
    recolor(colorOf) {
      if (!mesh) return;
      const c = new THREE.Color(), table = names.map(n => { c.set(colorOf(n)); return [c.r, c.g, c.b]; }), a = mesh.geometry.attributes.color, out = a.array;
      for (const [from, vs, r] of pieces) {
        const [cr, cg, cb] = table[r];
        for (let i = from * 3, end = (from + vs) * 3; i < end; i += 3) { out[i] = cr; out[i + 1] = cg; out[i + 2] = cb; }
      }
      a.needsUpdate = true;
    },
    /**
     * Draws only these groups (any iterable of names), or all of them for null. The vertices to draw are named in an index; nothing is
     * rebuilt when the same groups are asked for again.
     */
    show(groups) {
      if (!mesh) return 0;
      const key = groups ? [...groups].sort().join("|") : null;
      if (key === shown) return count;
      shown = key;
      const g = mesh.geometry;
      if (!groups) { g.setIndex(null); g.setDrawRange(0, Infinity); mesh.visible = true; return (count = total); }
      const index = [];
      for (const name of key ? key.split("|") : []) for (const [from, n] of at.get(name) || []) for (let i = 0; i < n; i++) index.push(from + i);
      mesh.visible = index.length > 0;
      if (index.length) { g.setIndex(index); g.setDrawRange(0, index.length); }
      return (count = index.length);
    },
    get mesh() { return mesh; },
    dispose() { if (mesh) mesh.geometry.dispose(); mesh = null; },
  };
}
