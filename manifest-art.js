// Manifest's drawing: the League's packages in their packing, the quay they stand on, and the little package beside an
// answer. The geometry (where a package is, what hides what) is the engine's (manifest-engine.js); this file only
// dresses it. A package is the box the engine draws and no smaller, so what shows through the stack is what the
// engine says shows; the packing is a drawing on its three faces and never changes a silhouette.
//
// Each ware has its hue, its lightness (they stand five steps apart) and its packing, three ways to tell it from the
// others, so that no one rests on colour alone: cloth is a bale lashed with crossed cord, salt a stitched sack, amber an
// iron-strapped chest with a lozenge on it, iron a bundle of bars with straps, herring a hooped cask with a fish
// chalked on it. A stack under tarpaulin (the turned question, which must not give the ware away) is ropes on grey.
import { WARES, boxFor, isoPoint, cubeFaces, drawOrder, dropTimes, visibleSet } from "./manifest-engine.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const node = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const ch = sh => Math.round(Math.min(255, Math.max(0, ((n >> sh) & 255) * k))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };

// the tarpaulin over a stack whose wares are hidden, and the one package lit under it
const TARP = "#AEA690", LIT = "#FFF8E4";
export const QUAY_DEPTH = 0.42;          // how far the quay's edge goes down below the floor, in cell heights

// ---------- a face as a unit square ----------
/** A face's pen: draws in the face's own unit square (u along its length, v up it, or across a top), and gives back path
 *  data on the screen. `w` and `h` are the face's real proportions, so a circle drawn on it is round. */
function pen(poly, w, h) {
  const [A, B, , D] = poly;
  const at = (u, v) => `${(A[0] + u * (B[0] - A[0]) + v * (D[0] - A[0])).toFixed(1)} ${(A[1] + u * (B[1] - A[1]) + v * (D[1] - A[1])).toFixed(1)}`;
  const poly2 = pts => `M${pts.map(([u, v]) => at(u, v)).join("L")}Z`;
  return {
    line: (u1, v1, u2, v2) => `M${at(u1, v1)}L${at(u2, v2)}`,
    lines: (...ls) => ls.map(([u1, v1, u2, v2]) => `M${at(u1, v1)}L${at(u2, v2)}`).join(""),
    poly: poly2,
    rect: (u1, v1, u2, v2) => poly2([[u1, v1], [u2, v1], [u2, v2], [u1, v2]]),
    /** a round thing of real radius r (the face's width being 1 along u and 1 along v) */
    disc: (cu, cv, r, n = 14) => poly2(Array.from({ length: n }, (_, i) => [cu + Math.cos(i / n * 2 * Math.PI) * r / w, cv + Math.sin(i / n * 2 * Math.PI) * r / h])),
    /** a lozenge of real half-width r */
    lozenge: (cu, cv, r) => poly2([[cu, cv + r / h], [cu + r / w, cv], [cu, cv - r / h], [cu - r / w, cv]]),
    /** a fish of real length len, nose along +u */
    fish: (cu, cv, len) => {
      const a = len / 2, n = 12, body = Array.from({ length: n }, (_, i) => { const t = i / n * 2 * Math.PI; return [cu + Math.cos(t) * a * 0.62 / w - a * 0.18 / w, cv + Math.sin(t) * a * 0.3 / h]; });
      return poly2(body) + poly2([[cu - a * 0.74 / w, cv], [cu - a / w, cv + a * 0.34 / h], [cu - a / w, cv - a * 0.34 / h]]);
    },
  };
}
// a face's real proportions (the box is 1.9 long, 1 wide, .95 high)
const LONG = [1.9, 0.95], END = [1, 0.95], TOP = [1.9, 1];

// ---------- the packings ----------
// Each draws on the long side (L), the end (E) and the top (T) with `ink` (a darker line), `lite` (a lighter one), and
// the ware's own `acc` (stroke) and `fill`.
const PACK = {
  // a bale: canvas lashed with cord, a lead seal where the cords cross
  cloth: (L, E, T, add) => {
    add("acc", L.lines([0.27, 0, 0.27, 1], [0.73, 0, 0.73, 1], [0, 0.5, 1, 0.5]) + E.lines([0.5, 0, 0.5, 1], [0, 0.5, 1, 0.5]) + T.lines([0.27, 0, 0.27, 1], [0.73, 0, 0.73, 1], [0, 0.5, 1, 0.5]));
    add("fill", L.disc(0.27, 0.5, 0.075) + L.disc(0.73, 0.5, 0.075) + T.disc(0.27, 0.5, 0.07));
    add("ink", L.lines([0.09, 0.2, 0.2, 0.2], [0.8, 0.8, 0.91, 0.8]));
  },
  // a sack: the mouth stitched across the top with its ears, folds down the belly, the merchant's mark stencilled
  salt: (L, E, T, add) => {
    add("seam", L.line(0.06, 0.84, 0.94, 0.84) + E.line(0.06, 0.84, 0.94, 0.84) + T.line(0.06, 0.5, 0.94, 0.5));
    add("ink", L.lines([0.04, 0.84, 0.0, 0.97], [0.96, 0.84, 1.0, 0.97], [0.33, 0.12, 0.31, 0.7], [0.68, 0.12, 0.7, 0.7]) + E.lines([0.5, 0.12, 0.5, 0.7]) + T.lines([0.04, 0.5, 0.0, 0.62], [0.96, 0.5, 1.0, 0.38]));
    add("fill", L.poly([[0.5, 0.6], [0.5 + 0.1 / 1.9 * 1.6, 0.2], [0.5 - 0.1 / 1.9 * 1.6, 0.2]]));
  },
  // a chest: iron straps at the ends and a lid line, rivets, and a lozenge of amber on its front
  amber: (L, E, T, add) => {
    add("dark", L.lines([0.1, 0, 0.1, 1], [0.9, 0, 0.9, 1]) + E.line(0.5, 0, 0.5, 1) + T.lines([0.1, 0, 0.1, 1], [0.9, 0, 0.9, 1]));
    add("ink", L.line(0, 0.74, 1, 0.74) + E.line(0, 0.74, 1, 0.74) + T.rect(0.1, 0.1, 0.9, 0.9));
    add("fill", L.lozenge(0.5, 0.4, 0.2) + T.lozenge(0.5, 0.5, 0.2) + L.disc(0.1, 0.1, 0.035, 8) + L.disc(0.9, 0.1, 0.035, 8) + L.disc(0.1, 0.62, 0.035, 8) + L.disc(0.9, 0.62, 0.035, 8));
  },
  // a bundle of Swedish iron: bars side by side, two straps round them; at the end, the bars' square sections
  iron: (L, E, T, add) => {
    add("lite", L.lines([0.03, 0.2, 0.97, 0.2], [0.03, 0.4, 0.97, 0.4], [0.03, 0.6, 0.97, 0.6], [0.03, 0.8, 0.97, 0.8]) + T.lines([0.03, 0.25, 0.97, 0.25], [0.03, 0.5, 0.97, 0.5], [0.03, 0.75, 0.97, 0.75]));
    add("acc", L.lines([0.2, 0, 0.2, 1], [0.8, 0, 0.8, 1]) + T.lines([0.2, 0, 0.2, 1], [0.8, 0, 0.8, 1]) + E.rect(0.1, 0.09, 0.46, 0.45) + E.rect(0.54, 0.09, 0.9, 0.45) + E.rect(0.1, 0.55, 0.46, 0.91) + E.rect(0.54, 0.55, 0.9, 0.91));
  },
  // a cask: staves, two hoops of willow, the fish chalked on, and its round head on top with the bung
  herring: (L, E, T, add) => {
    add("ink", L.lines(...[1, 2, 3, 4, 5, 6, 7, 8].map(k => [k / 9, 0, k / 9, 1])) + E.lines([0.25, 0, 0.25, 1], [0.5, 0, 0.5, 1], [0.75, 0, 0.75, 1]) + T.disc(0.5, 0.5, 0.4, 18) + T.line(0.5 - 0.4 / 1.9, 0.5, 0.5 + 0.4 / 1.9, 0.5));
    add("fill", L.rect(0, 0.1, 1, 0.21) + L.rect(0, 0.79, 1, 0.9) + E.rect(0, 0.1, 1, 0.21) + E.rect(0, 0.79, 1, 0.9));
    add("fish", L.fish(0.5, 0.5, 0.74));
    add("ink", T.disc(0.66, 0.5, 0.05, 8));
  },
  // under the tarpaulin: ropes, and nothing that says what's under it
  tarp: (L, E, T, add) => {
    add("ink", L.lines([0.33, 0, 0.33, 1], [0.66, 0, 0.66, 1], [0, 0.5, 1, 0.5]) + E.line(0, 0.5, 1, 0.5));
  },
};
// the strokes and fills a packing asks for, by name; a ware's own colours are in `accent`
const LOOK = {
  ink: { fill: "none", stroke: "rgba(0,0,0,.36)", "stroke-width": 1 },
  lite: { fill: "none", stroke: "rgba(255,255,255,.42)", "stroke-width": 1 },
  dark: { fill: "none", stroke: "rgba(34,20,6,.62)", "stroke-width": 2.2 },
  seam: { fill: "none", stroke: "rgba(70,56,36,.7)", "stroke-width": 1, "stroke-dasharray": "3 2.4" },
};
const ACCENT = {
  cloth: { acc: { fill: "none", stroke: "#EADFC2", "stroke-width": 1.7 }, fill: { fill: "#CFD3D6", stroke: "rgba(0,0,0,.4)", "stroke-width": 0.8 } },
  salt: { fill: { fill: "#6B5640", stroke: "none" } },
  amber: { fill: { fill: "#FFF1C8", stroke: "rgba(60,36,6,.55)", "stroke-width": 0.8 } },
  iron: { acc: { fill: "none", stroke: "#B9C3CD", "stroke-width": 1.5 } },
  herring: { fill: { fill: "#D9C08F", stroke: "rgba(0,0,0,.35)", "stroke-width": 0.8 }, fish: { fill: "#F4E8C6", stroke: "none" } },
};

/**
 * One package drawn into `g`, from its three faces as screen polygons ({ top, left, right }, each four points as
 * cubeFaces gives them): a ware's number (1 to 5) or 0 for one under tarpaulin, whether its long side lies along x (a
 * quarter turn puts it along y), and options: `lit` (the package picked out under the tarpaulin), `detail` (the packing:
 * left out where a whole stack is the size of a thumb), `tap`.
 */
export function paintPackage(g, faces, ware, lengthwise, { lit = false, detail = true, tap = null } = {}) {
  const base = ware ? WARES[ware - 1].hex : lit ? LIT : TARP;
  for (const [name, k] of [["left", 0.72], ["right", 0.86], ["top", 1.05]]) {
    const poly = el("polygon", { points: faces[name].map(q => q.map(n => n.toFixed(1)).join(",")).join(" "), fill: shade(base, k), class: "mf-cell" });
    if (tap) poly.addEventListener("click", tap);
    g.appendChild(poly);
  }
  if (!detail) return;
  // the long side is the left face when the package lies along x, else the right; the end is the other
  const long = lengthwise ? faces.left : faces.right, end = lengthwise ? faces.right : faces.left;
  // the top as a unit square with u along the package, whichever way it lies
  const top = lengthwise ? faces.top : [faces.top[1], faces.top[2], faces.top[3], faces.top[0]];
  const L = pen(long, ...LONG), E = pen(end, ...END), T = pen(top, ...TOP), rim = pen(faces.top, ...TOP);
  const id = ware ? WARES[ware - 1].id : "tarp", bag = {};
  const add = (style, d) => { bag[style] = (bag[style] || "") + d; };
  PACK[id](L, E, T, add);
  // a lit edge along the top's two near sides (the +x and +y edges, whichever way the package lies): it gives a dark
  // package its outline against a dark page
  add("lite", rim.lines([0.02, 0.97, 0.98, 0.97], [0.98, 0.97, 0.98, 0.03]));
  for (const [style, d] of Object.entries(bag)) {
    g.appendChild(el("path", { d, ...(ACCENT[id]?.[style] || LOOK[style]), "stroke-linejoin": "round", "pointer-events": "none" }));
  }
}

// ---------- the quay ----------
/** The planks of one floor tile, laid along the package's length, their joints staggered by where the tile lies. */
function planks(tile, lengthwise, x, y) {
  const top = lengthwise ? tile : [tile[1], tile[2], tile[3], tile[0]], T = pen(top, ...TOP);
  let d = T.lines([0, 0.25, 1, 0.25], [0, 0.5, 1, 0.5], [0, 0.75, 1, 0.75]);
  for (let j = 0; j < 4; j++) { const u = 0.28 + ((x * 3 + y * 5 + j * 2) % 5) * 0.11; d += T.line(u, j / 4, u, (j + 1) / 4); }
  return d;
}
/** The quay's body under the floor's two near edges: timber facing, a pile at every cell's edge and a waling across them. */
function quayEdge(svg, X, Y, b, to) {
  const t = QUAY_DEPTH, lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k], xy = q => q.map(n => n.toFixed(1)).join(" ");
  const facing = (x0, y0, x1, y1, side) => {
    const f = [isoPoint(x0, y0, 0, b), isoPoint(x1, y1, 0, b), isoPoint(x1, y1, -t, b), isoPoint(x0, y0, -t, b)].map(p => to([p.sx, p.sy]));
    svg.appendChild(el("polygon", { points: f.map(q => q.map(n => n.toFixed(1)).join(",")).join(" "), class: `mf-quay ${side}` }));
    svg.appendChild(el("path", { d: `M${xy(f[0])}L${xy(f[3])}M${xy(f[1])}L${xy(f[2])}M${xy(lerp(f[0], f[3], 0.5))}L${xy(lerp(f[1], f[2], 0.5))}`, class: "mf-pile" }));
  };
  for (let x = 0; x < X; x++) facing(x, Y, x + 1, Y, "l");
  for (let y = 0; y < Y; y++) facing(X, y, X, y + 1, "r");
}
/** A few strokes of water lapping at the quay's foot. */
function ripples(svg, X, Y, b, to) {
  const wave = (x, y) => { const p = isoPoint(x, y, -QUAY_DEPTH, b), [px, py] = to([p.sx, p.sy]); return `M${(px - 9).toFixed(1)} ${(py + 7).toFixed(1)}q4.5 -3.5 9 0t9 0`; };
  svg.appendChild(el("path", { d: wave(X * 0.3, Y) + wave(X * 0.78, Y) + wave(X, Y * 0.3) + wave(X, Y * 0.78), class: "mf-wave" }));
}

// ---------- one stack on the quay ----------
/**
 * The stack as one isometric panel on the quay: { panel, drops }. opts: drop (an arrival order: the packages fall in; at
 * a table, times gives each one's landing on the round's clock and since how far into the drop it is), blank (the quay
 * only, for a marked position), mark {x,y,z} (outline a package, or its place on the quay with the tier named when it's
 * hidden), marks [keys] (outline these), highlight (dim every ware but this), tier (dim every tier but this), tap(key),
 * selected [keys], turns (a turned stack: packages lie along y after a quarter turn), grey (every package under
 * tarpaulin), ring (a key: that package uncovered and outlined), small (no room for drops or packing).
 */
export function stage(cells, opts = {}) {
  const panel = node("div", `mf-panel${opts.small ? " small" : ""}`);
  const b = boxFor(opts.turns || 0), X = cells.length, Y = cells[0].length, Z = cells[0][0].length, s = 46;
  const pts = [];
  const top = opts.blank ? 0 : Z;                                  // the quay alone is framed to its own size
  for (let x = 0; x <= X; x++) for (let y = 0; y <= Y; y++) for (let z = 0; z <= top; z++) pts.push(isoPoint(x, y, z, b));
  for (const [x, y] of [[0, Y], [X, Y], [X, 0]]) pts.push(isoPoint(x, y, -QUAY_DEPTH, b));
  const minX = Math.min(...pts.map(p => p.sx)), maxX = Math.max(...pts.map(p => p.sx)), minY = Math.min(...pts.map(p => p.sy)), maxY = Math.max(...pts.map(p => p.sy));
  const W = (maxX - minX) * s + 20, H = (maxY - minY) * s + 20, room = opts.drop ? s * 1.6 : s * 0.25;
  const svg = el("svg", { viewBox: `0 ${-room} ${W} ${H + room}`, class: opts.tap ? "tap" : "" });
  svg.style.setProperty("--aspect", (W / (H + room)).toFixed(3));
  const to = ([sx, sy]) => [(sx - minX) * s + 10, (sy - minY) * s + 10];
  const markKey = opts.mark ? `${opts.mark.x},${opts.mark.y},${opts.mark.z}` : null;
  const visible = opts.blank || markKey ? visibleSet(cells, b) : null;
  const outlined = new Set([...(opts.marks || []), ...(opts.selected || [])]);
  const lengthwise = b.X >= b.Y;                                  // the packages' long side runs along x
  if (!opts.small) ripples(svg, X, Y, b, to);
  quayEdge(svg, X, Y, b, to);
  for (let x = 0; x < X; x++) for (let y = 0; y < Y; y++) {        // the quay's floor
    const f = cubeFaces(x, y, -1, b).top.map(to);
    const marked = opts.mark && opts.mark.x === x && opts.mark.y === y && (opts.blank || !visible.has(markKey));
    svg.appendChild(el("polygon", { points: f.map(q => q.map(n => n.toFixed(1)).join(",")).join(" "), class: marked ? "mf-floor marked" : "mf-floor" }));
    if (!opts.small && !marked) svg.appendChild(el("path", { d: planks(f, lengthwise, x, y), class: "mf-plank" }));
    if (marked) {
      const c = f.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
      const t = el("text", { x: c[0].toFixed(1), y: (c[1] + 6).toFixed(1), "text-anchor": "middle", "font-size": 17, "font-weight": 800, fill: "#fff" });   // read in a question's card too
      t.textContent = `tier ${opts.mark.z + 1}`;
      svg.appendChild(t);
    }
  }
  const drops = opts.drop ? (opts.times ? { times: opts.times, last: 0 } : dropTimes(cells, opts.drop)) : { times: {}, last: 0 };
  if (!opts.blank) for (const cube of drawOrder(cells)) {
    const faces = Object.fromEntries(Object.entries(cubeFaces(cube.x, cube.y, cube.z, b)).map(([k, poly]) => [k, poly.map(to)])), key = `${cube.x},${cube.y},${cube.z}`;
    const dim = (opts.highlight && cube.c !== opts.highlight) || (opts.tier != null && cube.z !== opts.tier);
    const ringed = opts.ring === key;
    const g = el("g", { class: `cube${opts.drop ? " drop" : ""}`, "data-key": key });
    if (dim) g.setAttribute("opacity", 0.25);
    if (opts.drop) g.style.animationDelay = `${drops.times[key] - (opts.since || 0)}ms`;   // landed already, for a phone that comes in late
    paintPackage(g, faces, opts.grey ? 0 : cube.c, lengthwise, { lit: ringed && opts.grey, detail: !opts.small, tap: opts.tap ? () => opts.tap(key) : null });
    if ((markKey === key && (!visible || visible.has(key))) || outlined.has(key) || ringed) {
      for (const name of ringed ? ["left", "right", "top"] : ["top"]) g.appendChild(el("polygon", { points: faces[name].map(q => q.map(n => n.toFixed(1)).join(",")).join(" "), fill: "none", stroke: "var(--ink)", "stroke-width": 3.5, "stroke-linejoin": "round", "pointer-events": "none" }));
    }
    svg.appendChild(g);
  }
  panel.appendChild(svg);
  return { panel, drops };
}

/** One package of a ware, small: beside an answer, so the answer names the ware and shows its packing. */
export function wareIcon(ware) {
  const b = boxFor(0), faces = cubeFaces(0, 0, 0, b), all = Object.values(faces).flat();
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]), minX = Math.min(...xs), minY = Math.min(...ys), k = 40 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const to = p => [(p[0] - minX) * k + 2, (p[1] - minY) * k + 2];
  const svg = el("svg", { viewBox: "0 0 44 44", class: "mf-icon", "aria-hidden": "true" });
  const g = el("g");
  paintPackage(g, Object.fromEntries(Object.entries(faces).map(([n, poly]) => [n, poly.map(to)])), ware, true, { detail: true });
  svg.appendChild(g);
  return svg;
}
