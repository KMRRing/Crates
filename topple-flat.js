// Topple's table drawn flat, in SVG, where there's no WebGL: the same table and the same slabs (topple-slab.js) seen
// from above and in front without perspective, no tilt, the fall a quicker squash and slide along each one's way, the
// zoom a larger scale kept inside the whole table. It answers to the same calls as the 3D table (topple-3d.js), so the
// page doesn't know which it has.
import { CELLS, FREE, at as cellNumber } from "./topple-engine.js";
import { ROCK, WATER, VOID } from "./topple-levels.js";
import { mid, SW, SH, ST, TALL, ZOOM, heading, yawOf, hexAt, flat, slabsEl, hull, heightOf, PLANK } from "./topple-slab.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const MID = CELLS.map(([q, r]) => mid(q, r));
const FIELD = 4.17, OUTER = 4.85;
const ring = (apothem, grow = 0) => Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3, R = (apothem + grow) / (Math.sqrt(3) / 2); return flat(R * Math.cos(a), 0, R * Math.sin(a)); });
const poly = (pts, attrs) => el("polygon", { points: pts.map(p => p.map(v => v.toFixed(3)).join(",")).join(" "), ...attrs });
const hexAtHeight = (x, z, y, grow = 1, cls = "tp-flat-cell") => poly(Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 6) + (k * Math.PI) / 3, r = grow / Math.sqrt(3); return flat(x + r * Math.cos(a), y, z + r * Math.sin(a)); }), { class: cls });
const hexCell = (x, z) => hexAtHeight(x, z, 0);

export function createFlat(host) {
  const svg = el("svg", { class: "tp-gl tp-flatview", "aria-hidden": "true" }), world = el("g"), terr = el("g"), standing = el("g"), bell = el("g", { class: "tp-flat-bell" });
  svg.append(world);
  host.prepend(svg);
  world.append(
    poly(ring(OUTER), { class: "tp-flat-frame" }), poly(ring(FIELD + 0.1), { class: "tp-flat-brass" }), poly(ring(FIELD), { class: "tp-flat-birch" }),
    ...CELLS.map((_, i) => hexCell(...MID[i])), terr, standing, bell,
  );
  bell.append(el("path", { d: "M0-.32C-.17-.32-.25-.18-.25 0V.14L-.33.25H.33L.25.14V0C.25-.18.17-.32 0-.32Z", fill: "#e0b04a", stroke: "#7a5a14", "stroke-width": ".02" }));
  // the whole table's scale and offset (s0, ox0, oy0), and the zoom's: s = s0 · zoom, the offset kept so the view stays inside the whole
  let W = 1, H = 1, s0 = 1, ox0 = 0, oy0 = 0, s = 1, ox = 0, oy = 0, zoom = 1, painted = () => {}, current = null, anims = [], held = false;
  const headroom = () => Math.max(...base) + (rules.tall.some(Boolean) ? TALL : SH);       // the highest a domino's top can be
  function layout() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const half = flat(OUTER / (Math.sqrt(3) / 2), 0, 0)[0], top = flat(0, headroom(), -OUTER)[1], bottom = flat(0, -0.5, OUTER)[1];
    s0 = Math.min(W / (2 * half * 1.04), H / ((bottom - top) * 1.06));
    const fx = (W / 2 - ox) / s, fy = (H / 2 - oy) / s;              // the point at the middle, to keep there
    ox0 = W / 2; oy0 = H / 2 - ((top + bottom) / 2) * s0;
    s = s0 * zoom; ox = W / 2 - fx * s; oy = H / 2 - fy * s;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    place();
  }
  function place() {
    s = s0 * zoom;
    ox = Math.max(W - (W - ox0) * zoom, Math.min(ox0 * zoom, ox));
    oy = Math.max(H - (H - oy0) * zoom, Math.min(oy0 * zoom, oy));
    world.setAttribute("transform", `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${s.toFixed(3)})`);
    painted();
  }
  function zoomAt(z, px, py) {
    const r = host.getBoundingClientRect(), x = px - r.left, y = py - r.top, fx = (x - ox) / s, fy = (y - oy) / s;
    zoom = Math.max(1, Math.min(ZOOM, z));
    s = s0 * zoom; ox = x - fx * s; oy = y - fy * s;
    place();
  }
  function panBy(dx, dy) { ox += dx; oy += dy; place(); }
  function zoomTo(z, px, py, ms = 220) {
    const from = zoom, t0 = performance.now();
    const step = () => {
      const u = Math.min(1, (performance.now() - t0) / ms), e = u * u * (3 - 2 * u);
      zoomAt(from + (z - from) * e, px, py);
      if (u < 1) requestAnimationFrame(step);
    };
    step();
  }
  const project = (x, y, z) => { const [fx, fy] = flat(x, y, z); return [ox + fx * s, oy + fy * s]; };
  const unflat = (px, py) => [(px - ox) / s, (py - oy) / s];
  // a level's terrain (topple-levels.js; FREE for none), drawn flat: pools, stones, steps, gilding and no table, back to front
  let rules = FREE, base = new Array(CELLS.length).fill(0);
  function terrain(next) {
    if (next === rules) return;
    rules = next;
    svg.dataset.scene = rules.scene;
    base = CELLS.map((_, i) => rules.height[i] * rules.rise + (rules.bridges && rules.terrain[i] === WATER ? PLANK : 0));          // a bridge's plank raises the water it spans
    const kids = [];
    CELLS.map((_, i) => i).sort((a, b) => MID[a][1] - MID[b][1]).forEach(i => {
      const [x, z] = MID[i], t = rules.terrain[i];
      if (t === VOID) kids.push(hexAtHeight(x, z, 0, 1, "tp-flat-void"));
      else if (t === WATER) kids.push(hexAtHeight(x, z, 0, 0.92, "tp-flat-water"));
      else if (t === ROCK) kids.push(hexAtHeight(x, z, 0, 0.62, "tp-flat-rock"));
      else if (base[i]) kids.push(hexAtHeight(x, z, 0, 1, "tp-flat-step-side"), hexAtHeight(x, z, base[i], 1, `tp-flat-step h${rules.height[i]}`));
      if (rules.gilded[i]) kids.push(hexAtHeight(x, z, base[i], 0.78, "tp-flat-gilt"));
    });
    terr.replaceChildren(...kids);
    layout();
    if (current) set({ ...current, fresh: [] });
  }
  const topOf = (i, kind = current?.cells[i]) => base[i] + heightOf(rules.tall, kind);
  const axisOf = {};                                  // the slab standing on each hexagon
  function set({ cells, ax, bell: bellCell, fresh = [], ghost = null }) {
    cancelFall();
    current = { cells, ax, bell: bellCell };
    const list = [];
    cells.forEach((c, i) => { if (c >= 0) list.push({ x: MID[i][0], z: MID[i][1], yaw: yawOf(ax[i] >= 0 ? ax[i] : 0), kind: c, cell: i, h: heightOf(rules.tall, c), lift: base[i], plank: rules.terrain[i] === WATER }); });
    standing.replaceChildren(slabsEl(list));
    if (ghost) standing.append(slabsEl(ghost.laid.map((i, k) => ({ x: MID[i][0], z: MID[i][1], yaw: yawOf(ghost.ax[k]), kind: ghost.kinds[k], h: heightOf(rules.tall, ghost.kinds[k]), lift: base[i], plank: rules.terrain[i] === WATER })), "ghost"));
    for (const k of Object.keys(axisOf)) delete axisOf[k];
    standing.querySelectorAll("[data-cell]").forEach(g => { axisOf[g.dataset.cell] = g; });          // by hexagon, so a fall can move them
    if (bellCell >= 0) { const covered = cells[bellCell] >= 0, [x, z] = MID[bellCell], [px, py] = flat(x, covered ? topOf(bellCell) : base[bellCell], z); bell.setAttribute("transform", `translate(${px} ${py}) scale(${covered ? 0.7 : 1})`); bell.style.display = ""; } else bell.style.display = "none";
    for (const i of fresh) axisOf[i]?.animate?.([{ transform: "translateY(-.5px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 180, easing: "ease-in" });
    painted();
  }
  function cancelFall() { for (const a of anims) a.cancel(); anims = []; }
  function fall({ fell }) {
    cancelFall();
    for (const [cell, step, , way] of fell) {
      const [hx, hz] = heading(way), g = axisOf[cell], [dx, dy] = flat(hx * 0.45, 0, hz * 0.45);
      if (!g?.animate) continue;
      g.style.transformBox = "fill-box"; g.style.transformOrigin = "50% 100%";
      anims.push(g.animate([{ transform: "translate(0,0) scaleY(1)", opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scaleY(.2)`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px,${dy}px) scaleY(.2)`, opacity: 0 }], { duration: 520, delay: step * 85, easing: "ease-in", fill: "both" }));
    }
    return Promise.all(anims.map(a => a.finished.catch(() => {}))).then(() => {});
  }
  const hit = (px, py) => {
    // a standing domino takes the points that fall on its outline, the nearest to the front first
    if (!current) return -1;
    const order = current.cells.flatMap((c, i) => (c >= 0 ? [i] : [])).sort((a, b) => MID[b][1] - MID[a][1]);
    for (const i of order) if (inside(outlineOf(i, current.ax[i] >= 0 ? current.ax[i] : 0, 1), px, py)) return i;
    return -1;
  };
  const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > y) !== (poly[j][1] > y) && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
  function outlineOf(i, ax, grow = 1.12, kind = current?.cells[i]) {
    const yaw = yawOf(ax), c = Math.cos(yaw), sn = Math.sin(yaw), pts = [], H = heightOf(rules.tall, kind);
    for (const lx of [-SW / 2, SW / 2]) for (const y of [base[i], base[i] + H]) for (const lz of [-ST / 2, ST / 2]) pts.push(project(MID[i][0] + lx * c + lz * sn, y, MID[i][1] - lx * sn + lz * c));
    return hull(pts, grow);
  }
  function pointAt(px, py) {
    const r = host.getBoundingClientRect(), [fx, fy] = unflat(px - r.left, py - r.top), sin = Math.sin(58 * Math.PI / 180), cos = Math.cos(58 * Math.PI / 180);
    let z = fy / sin;
    // on a step the point is where the line of sight meets the step's top, which stands higher on the screen
    if (base.some(Boolean)) for (let k = 0; k < 2; k++) { const i = cellNumber(...hexAt(fx, z)); z = (fy + (i >= 0 ? base[i] : 0) * cos) / sin; }
    return [fx, z];
  }
  function cellAt(px, py) {
    const r = host.getBoundingClientRect(), i = hit(px - r.left, py - r.top);
    if (i >= 0) return i;
    const p = pointAt(px, py);
    return cellNumber(...hexAt(p[0], p[1]));
  }
  new ResizeObserver(layout).observe(host);
  layout();
  return {
    canvas: svg, set, fall, project, pointAt, cellAt, outlineOf, tilt() {}, level() {}, applySkin() {}, cancelFall, zoomAt, panBy, zoomTo, terrain, topOf, baseOf: i => base[i],
    hold() { held = true; for (const a of anims) a.pause(); }, release() { held = false; for (const a of anims) a.play(); },
    onPaint(fn) { painted = fn; }, spin: 0, centre: i => MID[i], redraw: layout, tilted: false, busy: false,
    get zoom() { return zoom; },
  };
}
