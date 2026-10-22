// Stow's holds in decks, drawn in 3D: a box of crates seen from above at a slant, which the player turns. The view is
// orthographic (parallel lines stay parallel, so a deck's rows stay true at any angle): the plan turned by the azimuth,
// foreshortened by the elevation, each deck lifted by its height. A crate is the prism of its plan cell (a cube, a
// hexagonal or a triangular prism), and crates are drawn back to front by the depth of their centres, which for cells of
// one lattice is a true painter's order; of each only the faces the eye can see and no neighbour covers. The near walls
// are left off so the eye sees in; the far walls carry the decks' marks. What the cargo hides and the player must see
// shows through it, dashed: a consignment (its stamp), and a crate a move would clear and where the piece would come to
// rest (their outlines, in the piece's enamel: as in Block Blast, what a piece would clear takes its colour).
import { drops, makeField, poolFor } from "./stow-engine.js";

const RAD = Math.PI / 180;
/** Where the view starts: turned a little off square, looking down into the hold. */
export const VIEW = { az: 28, el: 44 };
export const EL_MIN = 22, EL_MAX = 80;
// a deck's height, in the plan's units (a square's side, a hexagon's corner radius, a triangle's side)
const DECK = { square: 1, hex: 1.15, tri: 0.8 };
const f3 = v => (Math.abs(v) < 5e-4 ? "0" : v.toFixed(3));
const pts = list => list.map(([x, y]) => `${f3(x)},${f3(y)}`).join(" ");
const seg = ([x1, y1], [x2, y2], cls) => `<line class="${cls}" x1="${f3(x1)}" y1="${f3(y1)}" x2="${f3(x2)}" y2="${f3(y2)}"/>`;

/** A hold's plan as a drawing needs it, worked out once: each cell's corners and edges (the outward normal of each, and
 *  the cell across it, or -1 where the edge is the hold's side), the plan's centre and its reach from it. */
function geometry(field) {
  if (field.geo) return field.geo;
  const plan = field.plan, key = p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`, byEdge = new Map();
  const cells = plan.cells.map((c, i) => {
    const edges = c.pts.map((a, k) => {
      const b = c.pts[(k + 1) % c.pts.length];
      let nx = b[1] - a[1], ny = a[0] - b[0];
      if (nx * ((a[0] + b[0]) / 2 - c.x) + ny * ((a[1] + b[1]) / 2 - c.y) < 0) { nx = -nx; ny = -ny; }
      const l = Math.hypot(nx, ny), e = { a, b, nx: nx / l, ny: ny / l, nb: -1 };
      const kk = [key(a), key(b)].sort().join("|");
      if (byEdge.has(kk)) { const o = byEdge.get(kk); e.nb = o.i; o.e.nb = i; } else byEdge.set(kk, { i, e });
      return e;
    });
    return { x: c.x, y: c.y, pts: c.pts, edges };
  });
  const xs = cells.flatMap(c => c.pts.map(p => p[0])), ys = cells.flatMap(c => c.pts.map(p => p[1]));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.max(...cells.flatMap(c => c.pts.map(p => Math.hypot(p[0] - cx, p[1] - cy))));
  // a cell's inradius: how big a stamp its top takes
  const inr = Math.min(...cells[0].edges.map(e => Math.abs((cells[0].x - e.a[0]) * e.nx + (cells[0].y - e.a[1]) * e.ny)));
  field.geo = { cells, cx, cy, R, inr, dh: DECK[field.kind] || 1, H: field.decks * (DECK[field.kind] || 1) };
  return field.geo;
}

/** The camera's map: plan point and height to the drawing; depth (larger is nearer the eye); which sides face the eye,
 *  and how much light a side takes (from the upper left). */
function lens(geo, cam) {
  const a = cam.az * RAD, e = cam.el * RAD, ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
  return {
    p: (x, y, z) => { const u = x - geo.cx, v = y - geo.cy; return [ca * u - sa * v, se * (sa * u + ca * v) - ce * z]; },
    depth: (x, y, z) => ce * (sa * (x - geo.cx) + ca * (y - geo.cy)) + se * z,
    facing: e => sa * e.nx + ca * e.ny > 1e-6,
    side: e => (ca * e.nx - sa * e.ny < 0 ? "fl" : "fr"),
  };
}

/** The drawing's frame for a camera: wide enough for the plan turned any way, deep enough for the decks at this tilt. */
export function frameOf(field, cam, pad = 0.35) {
  const g = geometry(field), e = cam.el * RAD, top = -g.R * Math.sin(e) - g.H * Math.cos(e), bottom = g.R * Math.sin(e);
  return [-g.R - pad, top - pad, 2 * g.R + 2 * pad, bottom - top + 2 * pad];
}

// the convex hull of a few points (a crate's outline on the drawing), for telling what hides a stamp
function hull(ps) {
  const s = ps.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of s.reverse()) { while (hi.length >= 2 && cross(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
function inside(poly, [x, y]) {
  let sign = 0;
  for (let k = 0; k < poly.length; k++) {
    const [ax, ay] = poly[k], [bx, by] = poly[(k + 1) % poly.length], c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

/**
 * The faces of one crate: its top unless a crate stands on it, and the sides that face the eye where no crate stands
 * beside it. `has(col, z)` says whether a crate is there (for hiding faces); z may be fractional while a crate falls.
 * `mark` is what's painted on each face it shows: "stamp" (a consignment's lozenge), "dg3" or "dg5" (a dangerous
 * good's placard, a lozenge in its class's colour), "flake" (a reefer's snowflake). Returns the faces' points with
 * their kind (ft: the top, fl/fr: sides in light and in shade), the lozenges (stamps), the snowflakes' strokes (flakes,
 * a path) and the crate's outline.
 */
function crate(g, L, col, z, has, mark = null) {
  const c = g.cells[col], z0 = z * g.dh, z1 = z0 + g.dh, faces = [], stamps = [], whole = Number.isInteger(z);
  let flakes = "";
  const lozenge = (cx, cy, cz, ux, uy, uz, vx, vy, vz) => [L.p(cx + ux, cy + uy, cz + uz), L.p(cx + vx, cy + vy, cz + vz), L.p(cx - ux, cy - uy, cz - uz), L.p(cx - vx, cy - vy, cz - vz)];
  // a snowflake's three strokes through a face's middle, in the face's plane (u, v: its two half-axes)
  const flake = (cx, cy, cz, u, v, angles) => { for (const a of angles) { const k = Math.cos(a), m = Math.sin(a), d = [u[0] * k + v[0] * m, u[1] * k + v[1] * m, u[2] * k + v[2] * m]; flakes += `M${pts([L.p(cx - d[0], cy - d[1], cz - d[2])])}L${pts([L.p(cx + d[0], cy + d[1], cz + d[2])])}`; } };
  const lozenged = mark === "stamp" || mark === "dg3" || mark === "dg5";
  for (const e of c.edges) {
    if (!L.facing(e) || (whole && e.nb >= 0 && has(e.nb, z))) continue;
    faces.push({ k: L.side(e), pts: [L.p(e.a[0], e.a[1], z0), L.p(e.b[0], e.b[1], z0), L.p(e.b[0], e.b[1], z1), L.p(e.a[0], e.a[1], z1)] });
    if (!mark) continue;
    const mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2, mz = (z0 + z1) / 2, hx = (e.b[0] - e.a[0]) * 0.33, hy = (e.b[1] - e.a[1]) * 0.33, h = g.dh * 0.36;
    if (lozenged) stamps.push({ at: L.p(mx, my, mz), pts: lozenge(mx, my, mz, hx, hy, 0, 0, 0, h) });
    else flake(mx, my, mz, [hx * 0.95, hy * 0.95, 0], [0, 0, h * 0.95], [Math.PI / 2, Math.PI / 6, -Math.PI / 6]);
  }
  if (!(whole && has(col, z + 1))) {
    faces.push({ k: "ft", pts: c.pts.map(p => L.p(p[0], p[1], z1)) });
    const r = g.inr * 0.74;
    if (lozenged) stamps.push({ at: L.p(c.x, c.y, z1), pts: lozenge(c.x, c.y, z1, r, 0, 0, 0, r, 0) });
    else if (mark) flake(c.x, c.y, z1, [r * 0.8, 0, 0], [0, r * 0.8, 0], [0, Math.PI / 3, (2 * Math.PI) / 3]);
  }
  const outline = hull(c.pts.flatMap(p => [L.p(p[0], p[1], z0), L.p(p[0], p[1], z1)]));
  return { faces, stamps, flakes, outline, centre: L.p(c.x, c.y, (z0 + z1) / 2) };
}
/** A crate's group in the drawing: its faces, then what's painted on them. */
function crateMarkup(cls, k, mark) {
  const stamp = mark === "dg3" || mark === "dg5" ? `stamp ${mark}` : "stamp";
  return `<g class="${cls}">${k.faces.map(f => `<polygon class="${f.k}" points="${pts(f.pts)}"/>`).join("")}${k.stamps.map(st => `<polygon class="${stamp}" points="${pts(st.pts)}"/>`).join("")}${k.flakes ? `<path class="flake" d="${k.flakes}"/>` : ""}</g>`;
}

/**
 * A hold drawn into an SVG. Returns the scene: frame (the viewBox for the camera), setCam(cam), centre(i) (a cell's
 * centre on the drawing), px (set by the page: its pixels, as a phone counts them, to the drawing's unit, which sizes
 * the turning arrows), and draw(o), o: { board, tint (each crate's enamel, 0 for cargo), ghost (the cells a piece would
 * take), ghostTint (its enamel), lit (the cells a move would clear), gone (cells going out), lift (cell → how many decks
 * over its place it's drawn, as it falls), bad (crates breaking a rule, edged in oxblood), seat (crates just seated,
 * edged in gilt a moment), marks (cell → what's painted on its faces: crate's mark), heavy (crates of more than a
 * tonne, shaded darker), plugs (floor cells with a reefer's socket, drawn while nothing stands on them, showing through
 * what's in front), sides (port and starboard lettered at the floor's sides, the bow marked: the keel reads whichever
 * way the hold is turned) }.
 */
export function holdScene(svg, field, cam) {
  const g = geometry(field), n2 = field.n2;
  let L = lens(g, cam);
  const scene = {
    get frame() { return frameOf(field, cam); },
    setCam(c) { cam = c; L = lens(g, cam); svg.setAttribute("viewBox", scene.frame.map(f3).join(" ")); },
    centre(i) { const c = g.cells[i % n2]; return L.p(c.x, c.y, (Math.floor(i / n2) + 0.5) * g.dh); },
    draw(o) {
      const { board, tint = [], ghost = null, lit = null, gone = null, lift = null, bad = null, seat = null, marks = null, heavy = null, plugs = null, sides = false } = o, out = [];
      const mine = new Set(ghost || []);
      // the floor's grid; the far walls, the decks marked on them
      out.push(`<g class="hold">`);
      for (const c of g.cells) out.push(`<polygon class="floor" points="${pts(c.pts.map(p => L.p(p[0], p[1], 0)))}"/>`);
      const near = [];
      for (const c of g.cells) for (const e of c.edges) {
        if (e.nb >= 0) continue;
        if (L.facing(e)) { near.push(e); continue; }
        out.push(`<polygon class="wall${field.kind === "square" ? " ruled" : ""}" points="${pts([L.p(e.a[0], e.a[1], 0), L.p(e.b[0], e.b[1], 0), L.p(e.b[0], e.b[1], g.H), L.p(e.a[0], e.a[1], g.H)])}"/>`);
        for (let d = 1; d < field.decks; d++) out.push(seg(L.p(e.a[0], e.a[1], d * g.dh), L.p(e.b[0], e.b[1], d * g.dh), "deck"));
        out.push(seg(L.p(e.a[0], e.a[1], g.H), L.p(e.b[0], e.b[1], g.H), "rim"));
      }
      out.push(`</g>`);
      // the reefers' sockets on the floor, where nothing stands on them yet
      const sockets = [];
      for (const i of plugs || []) {
        if (board[i] || mine.has(i)) continue;
        const c = g.cells[i % n2], r = g.inr * 0.42, ring = [];
        for (let k = 0; k < 16; k++) ring.push(L.p(c.x + Math.cos((k * Math.PI) / 8) * r, c.y + Math.sin((k * Math.PI) / 8) * r, 0));
        const [ax, ay] = L.p(c.x - r * 0.38, c.y, 0), [bx, by] = L.p(c.x + r * 0.38, c.y, 0), pin = f3(g.inr * 0.07);
        out.push(`<g class="plug3"><polygon points="${pts(ring)}"/><circle class="pin" cx="${f3(ax)}" cy="${f3(ay)}" r="${pin}"/><circle class="pin" cx="${f3(bx)}" cy="${f3(by)}" r="${pin}"/></g>`);
        sockets.push({ at: L.p(c.x, c.y, 0), ring });
      }
      // the crates, the piece's ghost among them, back to front
      const list = [];
      for (let i = 0; i < board.length; i++) if (board[i] || mine.has(i)) {
        const col = i % n2, z = Math.floor(i / n2) + (lift?.get(i) || 0), c = g.cells[col];
        list.push({ i, col, z, d: L.depth(c.x, c.y, (z + 0.5) * g.dh) });
      }
      list.sort((p, q) => p.d - q.d || p.i - q.i);
      const solid = (col, z) => { const i = z * n2 + col; return z < field.decks && !!board[i] && !gone?.has(i) && !lift?.get(i); };
      const ghostAt = (col, z) => mine.has(z * n2 + col);
      const drawn = [], watch = [];
      for (const it of list) {
        const isGhost = mine.has(it.i) && !board[it.i], v = board[it.i], isLit = !!lit?.has(it.i), mark = v === 2 ? "stamp" : marks?.get(it.i) || null;
        const k = crate(g, L, it.col, it.z, isGhost ? ghostAt : solid, mark);
        let cls = isGhost ? `cr ghost t${o.ghostTint || 1}` : v === 2 ? "cr mark" : tint[it.i] ? `cr t${tint[it.i]}` : "cr cargo";
        if (isLit) cls += ` lit l${o.ghostTint || 1}`;
        if (gone?.has(it.i)) cls += " gone";
        if (bad?.has(it.i)) cls += " bad";
        if (seat?.has(it.i)) cls += " seat";
        if (heavy?.has(it.i)) cls += " heavy";
        out.push(crateMarkup(cls, k, mark));
        drawn.push(k);
        if (!gone?.has(it.i) && (v === 2 || isLit || isGhost)) watch.push({ k, at: drawn.length - 1, mark: v === 2, isLit, isGhost });
      }
      // the near rim, over the crates
      for (const e of near) out.push(seg(L.p(e.a[0], e.a[1], g.H), L.p(e.b[0], e.b[1], g.H), "rim near"));
      // what the crates in front hide shows through them: seen when the middle of one of its faces (a consignment, of
      // one of its stamps) is clear of every crate drawn after it
      const middle = ps => ps.reduce((m, q) => [m[0] + q[0] / ps.length, m[1] + q[1] / ps.length], [0, 0]);
      for (const w of watch) {
        const spots = w.mark && !w.isLit ? w.k.stamps.map(st => st.at) : w.k.faces.map(f => middle(f.pts)), after = drawn.slice(w.at + 1);
        if (spots.some(q => !after.some(d => inside(d.outline, q)))) continue;
        if (w.isLit || w.isGhost) out.push(`<polygon class="xray ${w.isLit ? "lit" : "ghost"} l${o.ghostTint || 1}" points="${pts(w.k.outline)}"/>`);
        if (w.mark) { const [x, y] = w.k.centre, r = g.inr * 0.62; out.push(`<polygon class="xray${w.isLit ? " going" : ""}" points="${pts([[x, y - r], [x + r, y], [x, y + r], [x - r, y]])}"/>`); }
      }
      // a socket a crate in front hides, seen through it
      for (const sk of sockets) if (drawn.some(d => inside(d.outline, sk.at))) out.push(`<polygon class="xray plug" points="${pts(sk.ring)}"/>`);
      // port and starboard, and the bow, outside the walls at the rim's height, where no crate can come in front of them
      if (sides) {
        const xs = g.cells.flatMap(c => c.pts.map(p => p[0])), ys = g.cells.flatMap(c => c.pts.map(p => p[1]));
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), my = (y0 + y1) / 2, mx = (x0 + x1) / 2;
        const [px, py] = L.p(x0 - 0.45, my, g.H), [sx, sy] = L.p(x1 + 0.45, my, g.H);
        out.push(`<text class="side3" x="${f3(px)}" y="${f3(py)}">P</text><text class="side3" x="${f3(sx)}" y="${f3(sy)}">S</text>`,
          `<polygon class="bow3" points="${pts([L.p(mx - 0.32, y0 - 0.14, g.H), L.p(mx + 0.32, y0 - 0.14, g.H), L.p(mx, y0 - 0.6, g.H)])}"/>`);
      }
      // the turning arrows, in the frame's lower corners, which the hold never reaches whichever way it's turned: 40px
      // across for a thumb (a tablet's larger), whatever the hold's scale
      const [fx, fy, fw, fh] = scene.frame, r = Math.min(20 / (scene.px || 30), fw * 0.09);
      out.push(turnArrow(fx + r * 1.25, fy + fh - r * 1.25, r, -1), turnArrow(fx + fw - r * 1.25, fy + fh - r * 1.25, r, 1));
      svg.innerHTML = out.join("");
    },
  };
  scene.setCam(cam);
  return scene;
}
/** A round button with an arrow turning the way it turns the hold (1: clockwise, seen from above). */
function turnArrow(x, y, r, dir) {
  const at = d => [x + Math.cos(d * RAD) * r * 0.52 * dir, y + Math.sin(d * RAD) * r * 0.52];
  const [a, b] = [at(-150), at(110)], t = 110 * RAD, tx = -Math.sin(t) * dir, ty = Math.cos(t), nx = Math.cos(t) * dir, ny = Math.sin(t), h = r * 0.3;
  const head = [[b[0] + tx * h, b[1] + ty * h], [b[0] - tx * h * 0.2 + nx * h * 0.75, b[1] - ty * h * 0.2 + ny * h * 0.75], [b[0] - tx * h * 0.2 - nx * h * 0.75, b[1] - ty * h * 0.2 - ny * h * 0.75]];
  return `<g class="turn" data-turn="${dir}" role="button" aria-label="Turn the hold ${dir > 0 ? "clockwise" : "anticlockwise"}"><circle cx="${f3(x)}" cy="${f3(y)}" r="${f3(r)}"/>` +
    `<path d="M${f3(a[0])} ${f3(a[1])}A${f3(r * 0.52)} ${f3(r * 0.52)} 0 1 ${dir > 0 ? 1 : 0} ${f3(b[0])} ${f3(b[1])}"/><polygon points="${pts(head)}"/></g>`;
}

// ---------- a piece on its own, in the same view as the hold (the tray, the piece in hand) ----------
const roomy = new Map();
/** A hold big enough for any piece, for drawing pieces the level's hold can't show whole. */
const bigHold = (kind, decks) => roomy.get(kind) || roomy.set(kind, makeField(kind === "square" ? { kind, w: 6, h: 6, decks } : kind === "hex" ? { kind, radius: 3, decks } : { kind, size: 3, decks })).get(kind);
/** Where a piece's cells sit, as a hold's columns and heights: from the first place it can be lowered. */
function cellsOf(field, piece) {
  let f = field, d = drops(field, piece)[0];
  if (!d) { f = bigHold(field.kind, 4); d = drops(f, piece)[0]; }
  return { f, cells: [...d.col].map((col, j) => ({ col, z: d.dz[j] })) };
}
/** The reach of some pieces from their middles to their farthest corners, which no turn of the view can draw any
 *  farther off: a tray draws them all on this one scale. Without pieces, every piece the hold deals. */
const reaches = new Map();
export function reachFor(field, pieces = null) {
  const key = pieces ? null : JSON.stringify(field.spec);
  if (key && reaches.has(key)) return reaches.get(key);
  let r = 1;
  for (const p of pieces || poolFor(field.spec)) {
    const { f, cells } = cellsOf(field, p), g = geometry(f);
    const m = cells.map(c => [g.cells[c.col].x, g.cells[c.col].y, (c.z + 0.5) * g.dh]).reduce((s, q) => s.map((v, k) => v + q[k] / cells.length), [0, 0, 0]);
    for (const c of cells) for (const q of g.cells[c.col].pts) for (const z of [c.z, c.z + 1]) r = Math.max(r, Math.hypot(q[0] - m[0], q[1] - m[1], z * g.dh - m[2]));
  }
  r += 0.15;
  if (key) reaches.set(key, r);
  return r;
}
/**
 * A piece drawn on its own in the hold's view: into svg, its crates in its enamel (with what's painted on them, mark,
 * and shaded if heavy). With fit, on the tray's scale (every
 * piece of the hold the same, centred, the same whichever way the view is turned: `reach`, else reachFor's for every
 * piece the hold deals); without, tight round it. Returns
 * { box, cx, cy } (its frame, and the middle of its crates, in the drawing's units, the hold's scale).
 */
export function drawPiece(svg, field, piece, cam, { fit = false, tint = 1, reach = null, mark = null, heavy = false } = {}) {
  const { f, cells } = cellsOf(field, piece), g = geometry(f), L = lens(g, cam), n2 = f.n2;
  const at = new Set(cells.map(c => c.z * n2 + c.col)), has = (col, z) => at.has(z * n2 + col);
  const list = cells.map(c => ({ ...c, d: L.depth(g.cells[c.col].x, g.cells[c.col].y, (c.z + 0.5) * g.dh) })).sort((p, q) => p.d - q.d);
  const out = [], all = [];
  let mx = 0, my = 0;
  for (const c of list) {
    const k = crate(g, L, c.col, c.z, has, mark);
    out.push(crateMarkup(`cr t${tint}${heavy ? " heavy" : ""}`, k, mark));
    all.push(...k.outline);
    mx += k.centre[0] / list.length; my += k.centre[1] / list.length;
  }
  svg.innerHTML = out.join("");
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  if (fit) { const r = reach || reachFor(field); svg.setAttribute("viewBox", [mx - r, my - r, 2 * r, 2 * r].map(f3).join(" ")); }
  else svg.setAttribute("viewBox", [box.x, box.y, box.w, box.h].map(f3).join(" "));
  return { box, cx: mx, cy: my };
}
