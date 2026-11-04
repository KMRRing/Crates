// Mines' solid fields: a field wrapped round a solid, so it has no edge. Pure (no page), so the engine, the renderer
// (mines-3d.js) and the tests share one geometry, as mines-grid.js is for the flat fields. Every solid is a shape on a
// sphere: its faces are cut into smaller cells (more cuts, a larger size) and every point is pushed radially out onto
// the unit sphere, so a cell's corners lie on it and a cell is slightly bent where the shape needs it. A cell touches
// every cell it shares a corner with. Three solids, in the order Korbi asked for them:
//   cube: six squares, each cut into n×n. Round a corner three cells meet (the flat field has four), so the 24 corner
//     cells touch seven and every other cell eight;
//   rhombicuboctahedron: 18 squares and 8 triangles (a cube with its edges and corners cut away), every edge the same
//     length, each face cut into m×m cells of that edge cut again, so squares stay squares and triangles triangles;
//   football: the truncated icosahedron's pattern of 12 pentagons among hexagons, at finer tilings. The truncated
//     icosahedron itself is the Goldberg polyhedron GP(1,1), with 32 faces, too few to play; the larger ones are
//     GP(g,g): 30g²+2 cells, always exactly 12 pentagons. A cell touches the five or six it shares an edge with.
// A cell is a number. Each has its middle c and its outward normal nrm (unit vectors: the solid fits a sphere of
// radius 1), and its outline pts, anticlockwise seen from outside.

export const SOLIDS = {
  cube: { label: "Cube" },
  rhombi: { label: "Rhombicuboctahedron", short: "Rhombi" },
  football: { label: "Football" },
};
/** A cell's size in the thumb's measure (a square's side, a hexagon's width) from the square root of its area. */
export const AREA_TO_SIZE = { cube: 1, rhombi: 1, football: 1.0746 };

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const middle = pts => unit(pts.reduce(add, [0, 0, 0]));

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

/**
 * The board of cells given as outlines on the sphere (unit vectors, anticlockwise from outside): the cells, who
 * touches whom, how big a cell is (`size`), the commonest number of neighbours (`most`: a start is taken among the
 * cells that have that many) and the surface's distance from the middle (`front`: 1, it is a sphere).
 */
function boardOf(shape, outlines, extra = {}) {
  // corners are named by their coordinates to nine places: the same point from two faces is the same name
  const key = p => p.map(x => Math.round(x * 1e7)).join(",");
  const cells = outlines.map((pts, i) => ({ c: middle(pts), nrm: middle(pts), pts, ...(extra[i] || {}) }));
  const t = touching(outlines.map(pts => pts.map(key)));
  let area = 0;
  for (const { c, pts } of cells) for (let j = 0; j < pts.length; j++) area += Math.hypot(...cross(sub(pts[j], c), sub(pts[(j + 1) % pts.length], c))) / 2;
  const tally = new Map();
  for (const l of t.nb) tally.set(l.length, (tally.get(l.length) || 0) + 1);
  const most = [...tally].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  return { ...t, cells, size: Math.sqrt(area / cells.length) * AREA_TO_SIZE[shape], front: 1, most };
}
/** An outline turned to run anticlockwise seen from outside. */
const outward = pts => (dot(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])), middle(pts)) > 0 ? pts : [...pts].reverse());

// ---------- the cube ----------
function cube(n) {
  // each face: its outward normal and two axes along it, u × v = the normal, from the face's corner o
  const FACES = [
    { u: [0, 1, 0], v: [0, 0, 1], o: [n, 0, 0] },
    { u: [0, 0, 1], v: [0, 1, 0], o: [0, 0, 0] },
    { u: [0, 0, 1], v: [1, 0, 0], o: [0, n, 0] },
    { u: [1, 0, 0], v: [0, 0, 1], o: [0, 0, 0] },
    { u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, n] },
    { u: [0, 1, 0], v: [1, 0, 0], o: [0, 0, 0] },
  ];
  // a lattice point (0 to n along each axis) on the sphere; tan spreads the angle evenly, so the cells near a corner
  // are not so much smaller than those in a face's middle as a plain push outwards would leave them
  const at = p => unit(p.map(x => Math.tan((2 * x / n - 1) * Math.PI / 4)));
  const outlines = [], extra = [];
  FACES.forEach((F, face) => {
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = (di, dj) => [0, 1, 2].map(k => F.o[k] + (i + di) * F.u[k] + (j + dj) * F.v[k]);
      outlines.push(outward([p(0, 0), p(1, 0), p(1, 1), p(0, 1)].map(at)));
      extra.push({ u: F.u, face });                          // the face's first axis, to square it up when it is turned to you
    }
  });
  return boardOf("cube", outlines, extra);
}

// ---------- the rhombicuboctahedron ----------
function rhombi(m) {
  const s = 1 + Math.SQRT2, V = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-s, s]) V.push([a, b, c], [a, c, b], [c, a, b]);
  // its 26 faces: the corners furthest along each of the 6 + 12 + 8 directions of a cube's faces, edges and corners
  const dirs = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) dirs.push([x, y, z]);
  const outlines = [];
  for (const d of dirs) {
    const top = Math.max(...V.map(v => dot(v, d))), face = V.filter(v => dot(v, d) > top - 1e-9);
    const c = mul(face.reduce(add, [0, 0, 0]), 1 / face.length), e1 = unit(sub(face[0], c)), e2 = cross(unit(d), e1);
    face.sort((p, q) => Math.atan2(dot(sub(p, c), e2), dot(sub(p, c), e1)) - Math.atan2(dot(sub(q, c), e2), dot(sub(q, c), e1)));
    if (face.length === 4) {
      // a square cut into m×m: the same points on a shared edge from either side, as every edge is cut in m equal parts
      const [p0, p1, , p3] = face, at = (i, j) => unit(add(p0, add(mul(sub(p1, p0), i / m), mul(sub(p3, p0), j / m))));
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) outlines.push(outward([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]));
    } else {
      // a triangle cut into m² : m(m+1)/2 pointing as it does, m(m-1)/2 between them
      const [A, B, C] = face, at = (i, j) => unit(add(A, add(mul(sub(B, A), i / m), mul(sub(C, A), j / m))));
      for (let j = 0; j < m; j++) for (let i = 0; i + j < m; i++) {
        outlines.push(outward([at(i, j), at(i + 1, j), at(i, j + 1)]));
        if (i + j < m - 1) outlines.push(outward([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]));
      }
    }
  }
  return boardOf("rhombi", outlines);
}

// ---------- the football: GP(g,g) ----------
function icosahedron() {
  const g = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]];
  const faces = [], d = (x, y) => dist(v[x], v[y]);
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) {
    if (Math.abs(d(a, b) - 2) > 1e-9 || Math.abs(d(b, c) - 2) > 1e-9 || Math.abs(d(a, c) - 2) > 1e-9) continue;
    faces.push(dot(cross(sub(v[b], v[a]), sub(v[c], v[a])), v[a]) > 0 ? [a, b, c] : [a, c, b]);
  }
  return { corners: v.map(unit), faces };
}
/**
 * The convex hull of points on a sphere, as triangles turned outwards: for points on a sphere that is also the
 * Delaunay triangulation (each triangle's circle holds no other point). Built a point at a time: the triangles that
 * see the new point go, and a cone of new ones from the hole's rim to it takes their place.
 */
function hull(P) {
  const n = P.length;
  // a first tetrahedron of four points not in one plane
  const i0 = 0, i1 = 1;
  let i2 = 2; while (Math.hypot(...cross(sub(P[i1], P[i0]), sub(P[i2], P[i0]))) < 1e-6) i2++;
  let i3 = 3; while (Math.abs(dot(cross(sub(P[i1], P[i0]), sub(P[i2], P[i0])), sub(P[i3], P[i0]))) < 1e-6) i3++;
  // (oriented away from the tetrahedron's own middle: it need not hold the sphere's)
  const mid = mul([i0, i1, i2, i3].reduce((t, i) => add(t, P[i]), [0, 0, 0]), 0.25), flip = (a, b, c) => (dot(cross(sub(P[b], P[a]), sub(P[c], P[a])), sub(P[a], mid)) > 0 ? [a, b, c] : [a, c, b]);
  let faces = [flip(i0, i1, i2), flip(i0, i1, i3), flip(i0, i2, i3), flip(i1, i2, i3)];
  const seen = new Set([i0, i1, i2, i3]);
  for (let p = 0; p < n; p++) {
    if (seen.has(p)) continue;
    const see = faces.map(([a, b, c]) => dot(cross(sub(P[b], P[a]), sub(P[c], P[a])), sub(P[p], P[a])) > 1e-9);
    const edges = new Map();                                           // directed edges of the triangles that go
    faces.forEach((t, k) => { if (see[k]) for (let e = 0; e < 3; e++) edges.set(`${t[e]},${t[(e + 1) % 3]}`, [t[e], t[(e + 1) % 3]]); });
    const kept = faces.filter((_, k) => !see[k]);
    for (const [a, b] of edges.values()) if (!edges.has(`${b},${a}`)) kept.push([a, b, p]);   // the hole's rim: an edge whose twin stays
    faces = kept;
  }
  return faces;
}
function football(g) {
  const { corners, faces: ico } = icosahedron(), pts = [], index = new Map();
  const name = p => p.map(x => Math.round(x * 1e7)).join(",");
  // The lattice of a triangular grid laid over each icosahedron face, turned so that the face's corners are g steps
  // along a 30° line (class II: GP(g,g)); a lattice point inside the face is a cell, pushed out onto the sphere.
  const E1 = [1, 0], E2 = [0.5, Math.sqrt(3) / 2];
  const lat = (a, b) => [a * E1[0] + b * E2[0], a * E1[1] + b * E2[1]];
  const Bx = lat(g, g), Cx = lat(-g, 2 * g);
  const det = Bx[0] * Cx[1] - Bx[1] * Cx[0];
  for (const [A, B, C] of ico) {
    for (let a = -2 * g; a <= 2 * g; a++) for (let b = -g; b <= 3 * g; b++) {
      const [x, y] = lat(a, b);
      const s = (x * Cx[1] - y * Cx[0]) / det, t = (Bx[0] * y - Bx[1] * x) / det, e = 1e-9;
      if (s < -e || t < -e || s + t > 1 + e) continue;
      const p = unit(add(add(mul(corners[A], 1 - s - t), mul(corners[B], s)), mul(corners[C], t))), key = name(p);
      if (!index.has(key)) { index.set(key, pts.length); pts.push(p); }
    }
  }
  const tris = hull(pts), round = pts.map(() => []);
  tris.forEach((t, k) => { for (const p of t) round[p].push(k); });
  // a gentle smoothing evens out the cells (a plane lattice pushed onto a sphere makes them smaller towards the
  // corners): each point moves half way to the middle of the points round it, the triangles the same
  const around = round.map(ks => [...new Set(ks.flatMap(k => tris[k]))]);
  let at = pts.map(p => p);
  for (let pass = 0; pass < 12; pass++) {
    at = at.map((p, i) => unit(add(mul(p, 0.5), mul(middle(around[i].filter(j => j !== i).map(j => at[j])), 0.5))));
  }
  const mids = tris.map(t => middle(t.map(p => at[p])));
  const outlines = at.map((c, i) => {
    const e1 = unit(cross(Math.abs(c[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], c)), e2 = cross(c, e1);
    return round[i].map(k => [Math.atan2(dot(mids[k], e2), dot(mids[k], e1)), k]).sort((p, q) => p[0] - q[0]).map(([, k]) => mids[k]);
  });
  return boardOf("football", outlines);
}

const BUILD = { cube, rhombi, football };
const built = new Map();
/**
 * A solid field's board: { shape, k, n, nb (who touches whom, ascending), side (those sharing an edge), cells ([{ c,
 * nrm, pts }]), size (a cell's size in the units the solid is drawn in, the thumb's measure), front (how far the
 * surface facing a viewer stands from the middle), most (the commonest number of neighbours) }. k: cells along a
 * cube's edge, cuts along a rhombicuboctahedron's, or g of the football's GP(g,g).
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
 * hexagons in three on the football), the shares about even. A surface without an edge can't be coloured perfectly
 * (round a cube's corner three cells touch one another), so the split is a first guess improved until no single cell
 * gains by moving: deterministic, so every device splits a field alike.
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
