// Mines' solid fields: a field wrapped round a solid, so it has no edge. Pure (no page), so the engine, the renderer
// (mines-3d.js) and the tests share one geometry, as mines-grid.js is for the flat fields. One solid for each tiling:
//   cube: squares, n×n on each face of a cube made of little cubes. A cell touches every cell its square shares a point
//     with, as on a flat field: eight, across the cube's edges too (the three cells beyond an edge, as if that face were
//     unfolded flat beside its own); at the cube's eight corners three faces meet where a flat field has four squares
//     round a point, so each of the 24 corner cells touches seven: three on its own face and two on each of the other
//     two, the three corner cells touching one another along the cube's edges;
//   sphere: a Goldberg polyhedron blown up onto a sphere, hexagons and exactly twelve pentagons (a sphere can't be
//     covered by hexagons alone). It is made as the dual of an icosahedron whose twenty faces are each cut into m×m
//     triangles and pushed out onto the sphere: each corner of a triangle is a cell, outlined by the middles of the
//     triangles round it, six of them, or five at the icosahedron's own twelve corners. A cell touches the cells it
//     shares an edge with, six or five;
//   geodesic: those triangles themselves, 20·m² of them, each touching every triangle it shares a point with, as
//     triangle Minesweeper counts them: twelve, or eleven beside one of the twelve corners where five meet.
// A cell is a number. Each has its middle c and its outward normal nrm (unit vectors: the solid fits a sphere of
// radius 1), and its outline pts, anticlockwise seen from outside.

export const SOLIDS = {
  cube: { label: "Cube", flat: "square", most: 8 },
  sphere: { label: "Sphere", flat: "hex", most: 6 },
  geodesic: { label: "Geodesic sphere", flat: "tri", most: 12 },
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Who touches whom, from what each cell's outline is made of (keys: a corner's exact name, or a triangle's number):
 * cells sharing a key touch. Also how many keys each pair shares, so side neighbours (two or more: an edge) can be told
 * from corner ones (one: a point).
 */
function touching(keys) {
  const by = new Map();
  keys.forEach((ks, i) => { for (const k of ks) { let l = by.get(k); if (!l) by.set(k, l = []); l.push(i); } });
  const nb = [], side = [];
  keys.forEach((ks, i) => {
    const shared = new Map();
    for (const k of ks) for (const j of by.get(k)) if (j !== i) shared.set(j, (shared.get(j) || 0) + 1);
    const list = [...shared.keys()].sort((a, b) => a - b);
    nb.push(list);
    side.push(list.filter(j => shared.get(j) >= 2));
  });
  return { nb, side };
}

// ---------- the cube ----------
// Corners are counted on a lattice of the little cubes, 0 to n along each axis, so two cells share a corner exactly
// when its three whole numbers agree: no rounding decides who touches whom.
function cube(n) {
  const a = 1 / Math.sqrt(3), at = p => p.map(x => (2 * x / n - 1) * a);   // a lattice point in the unit sphere
  // each face: its outward normal and two axes along it, u × v = the normal (so u then v runs anticlockwise seen from
  // outside), from the face's corner o
  const FACES = [
    { nrm: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], o: [n, 0, 0] },
    { nrm: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: [0, 0, 0] },
    { nrm: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], o: [0, n, 0] },
    { nrm: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: [0, 0, 0] },
    { nrm: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, n] },
    { nrm: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], o: [0, 0, 0] },
  ];
  const cells = [], keys = [];
  FACES.forEach((F, face) => {
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = (di, dj) => [0, 1, 2].map(k => F.o[k] + (i + di) * F.u[k] + (j + dj) * F.v[k]);
      const lattice = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];
      keys.push(lattice.map(q => q.join(",")));
      cells.push({ c: at(p(0.5, 0.5)), nrm: F.nrm, pts: lattice.map(at), face, u: F.u });
    }
  });
  return { ...touching(keys), cells, size: 2 * a / n, front: a };
}

// ---------- the icosahedron, cut into triangles on the sphere ----------
function icosahedron() {
  const g = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]];
  // its faces: every three corners two apart from one another (the edge's length), turned to face outwards
  const faces = [], d = (x, y) => dist(v[x], v[y]);
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) {
    if (Math.abs(d(a, b) - 2) > 1e-9 || Math.abs(d(b, c) - 2) > 1e-9 || Math.abs(d(a, c) - 2) > 1e-9) continue;
    faces.push(dot(cross(sub(v[b], v[a]), sub(v[c], v[a])), v[a]) > 0 ? [a, b, c] : [a, c, b]);
  }
  return { corners: v.map(unit), faces };
}
/**
 * The icosahedron with each face cut into m×m triangles, every point pushed out onto the sphere: { points, tris }.
 * A point is named by its exact weights over the icosahedron's corners, so the point on an edge two faces share is
 * found once, from either face.
 */
function cut(m) {
  const { corners, faces } = icosahedron(), points = [], index = new Map(), tris = [];
  const point = (f, i, j) => {      // i/m of the way along the face's first edge and j/m along its second
    const [A, B, C] = faces[f];
    const w = [[A, m - i - j], [B, i], [C, j]].filter(([, x]) => x > 0).sort((x, y) => x[0] - y[0]);
    const key = w.map(([id, x]) => `${id}:${x}`).join(" ");
    let k = index.get(key);
    if (k == null) {
      k = points.length;
      index.set(key, k);
      points.push(unit(w.reduce((s, [id, x]) => add(s, corners[id].map(c => c * x)), [0, 0, 0])));
    }
    return k;
  };
  faces.forEach((_, f) => {
    for (let j = 0; j < m; j++) for (let i = 0; i + j < m; i++) {
      tris.push([point(f, i, j), point(f, i + 1, j), point(f, i, j + 1)]);                              // pointing as the face does
      if (i + j < m - 1) tris.push([point(f, i + 1, j), point(f, i + 1, j + 1), point(f, i, j + 1)]);   // between three of those
    }
  });
  return { points, tris };
}
const middle = pts => unit(pts.reduce(add, [0, 0, 0]));
const meanNeighbourGap = (cells, nb) => {
  let s = 0, k = 0;
  nb.forEach((l, i) => { for (const j of l) { s += dist(cells[i].c, cells[j].c); k++; } });
  return s / k;
};

// ---------- the sphere: a Goldberg polyhedron ----------
function sphere(m) {
  const { points, tris } = cut(m), round = points.map(() => []);
  tris.forEach((t, k) => { for (const p of t) round[p].push(k); });
  const mids = tris.map(t => middle(t.map(p => points[p])));
  const cells = points.map((c, i) => {
    // the outline: the middles of the triangles round the point, in order of their angle about it (e1 × e2 = c, so
    // the angle runs anticlockwise seen from outside)
    const e1 = unit(cross(Math.abs(c[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], c)), e2 = cross(c, e1);
    const ring = round[i].map(k => [Math.atan2(dot(mids[k], e2), dot(mids[k], e1)), k]).sort((a, b) => a[0] - b[0]);
    return { c, nrm: c, pts: ring.map(([, k]) => mids[k]) };
  });
  // two cells share an edge exactly when they share a triangle: the edge between their points is that triangle's
  const t = touching(round);
  return { ...t, cells, size: meanNeighbourGap(cells, t.nb), front: 1 };
}

// ---------- the geodesic sphere: the triangles ----------
function geodesic(m) {
  const { points, tris } = cut(m);
  const cells = tris.map(t => { const pts = t.map(p => points[p]), c = middle(pts); return { c, nrm: c, pts }; });
  let side = 0;
  for (const t of tris) for (let k = 0; k < 3; k++) side += dist(points[t[k]], points[t[(k + 1) % 3]]);
  return { ...touching(tris), cells, size: side / (3 * tris.length), front: 1 };
}

const BUILD = { cube, sphere, geodesic };
const built = new Map();
/**
 * A solid field's board: { shape, k, n, nb (who touches whom, ascending), side (those sharing an edge), cells ([{ c,
 * nrm, pts }]), size (a cell's size in the units the solid is drawn in: a square's side, a hexagon's width, a
 * triangle's side), front (how far the surface facing a viewer stands from the middle) }. k: cells along a cube's
 * edge, or the cuts along an icosahedron's edge.
 */
export function solidBoard(shape, k) {
  const key = `${shape}:${k}`;
  let b = built.get(key);
  if (!b) { b = { shape, k, ...BUILD[shape](k) }; b.n = b.cells.length; built.set(key, b); }
  return b;
}

/**
 * The split of a solid field's numbers among `people` (a share each, 0 … people-1), as fine as the solid allows: as
 * many of each cell's side neighbours as can be are in other shares (a chessboard on each face of the cube, two
 * hexagons in three on the sphere, a triangle's three sides on the geodesic sphere), the shares about even. A surface
 * without an edge can't be coloured perfectly (round a cube's corner three cells touch one another), so the split is
 * a first guess improved until no single cell gains by moving: deterministic, so every device splits a field alike.
 */
export function solidShares(shape, k, people) {
  const b = solidBoard(shape, k), key = `share:${people}`;
  if (b[key]) return b[key];
  const { n, side } = b, share = new Int8Array(n).fill(-1), sizes = new Array(people).fill(0);
  // the sizes may stray a few cells from even: enough room for a cell to move where it gains
  const slack = Math.max(1, Math.round(n / people / 25)), lo = Math.floor(n / people) - slack, hi = Math.ceil(n / people) + slack;
  const same = (i, s) => { let x = 0; for (const j of side[i]) if (share[j] === s) x++; return x; };
  // the first guess, breadth first from cell 0: each cell takes the share the fewest of its side neighbours have
  // so far, the smallest share on a tie
  const queue = [], queued = new Uint8Array(n);
  for (let start = 0; start < n; start++) {
    if (queued[start]) continue;
    queue.push(start); queued[start] = 1;
    for (let q = queue.length - 1; q < queue.length; q++) {
      const i = queue[q];
      let best = 0, cost = Infinity;
      for (let s = 0; s < people; s++) {
        const c = same(i, s) * n + sizes[s];
        if (c < cost) { cost = c; best = s; }
      }
      share[i] = best; sizes[best]++;
      for (const j of side[i]) if (!queued[j]) { queued[j] = 1; queue.push(j); }
    }
  }
  // then better: a cell moves to the share fewest of its side neighbours have, whenever that's fewer than now
  for (let pass = 0, moved = true; moved && pass < 50; pass++) {
    moved = false;
    for (let i = 0; i < n; i++) {
      const s0 = share[i];
      let best = s0, fewest = same(i, s0);
      for (let s = 0; s < people; s++) {
        if (s === s0 || sizes[s] + 1 > hi || sizes[s0] - 1 < lo) continue;
        const x = same(i, s);
        if (x < fewest) { fewest = x; best = s; }
      }
      if (best !== s0) { share[i] = best; sizes[s0]--; sizes[best]++; moved = true; }
    }
  }
  b[key] = share;
  return share;
}
