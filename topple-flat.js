// Topple's table drawn flat, in SVG, where there's no WebGL: the same table and the same slabs (topple-slab.js) seen
// from above and in front without perspective, no tilt, the fall a quicker squash and slide along each one's way, the
// zoom a larger scale kept inside the whole table. It answers to the same calls as the 3D table (topple-3d.js), so the
// page doesn't know which it has. A table of several floors draws them apart (floorYs in topple-slab.js), the floor in
// play whole and the others faint behind it or in front of it.
import { CELLS, FREE, BALL, at as cellNumber } from "./topple-engine.js";
import { ROCK, WATER, VOID } from "./topple-levels.js";
import { mid, SW, SH, ST, ZOOM, heading, yawOf, hexAt, flat, slabsEl, hull, thickOf, PLANK, floorYs, featuresOf } from "./topple-slab.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const SIZE = CELLS.length, FLOORS_MAX = 3;
const MID = Array.from({ length: SIZE * FLOORS_MAX }, (_, i) => mid(...CELLS[i % SIZE]));
const FIELD = 4.17, OUTER = 4.85, BALL_R = 0.22, DECK = 0.3;            // DECK: the thickness of an upper floor
const FAINT = 0.28, SEEN = 0.55;                                         // how much of a floor not in play shows, and while a knock plays out
const ring = (apothem, grow = 0) => Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3, R = (apothem + grow) / (Math.sqrt(3) / 2); return flat(R * Math.cos(a), 0, R * Math.sin(a)); });
const poly = (pts, attrs) => el("polygon", { points: pts.map(p => p.map(v => v.toFixed(3)).join(",")).join(" "), ...attrs });
const hexAtHeight = (x, z, y, grow = 1, cls = "tp-flat-cell") => poly(Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 6) + (k * Math.PI) / 3, r = grow / Math.sqrt(3); return flat(x + r * Math.cos(a), y, z + r * Math.sin(a)); }), { class: cls });
const hexCell = (x, z) => hexAtHeight(x, z, 0);
const ellipseAt = (x, y, z, r, cls) => { const [cx, cy] = flat(x, y, z); return el("ellipse", { cx: cx.toFixed(3), cy: cy.toFixed(3), rx: r, ry: (r * Math.sin((58 * Math.PI) / 180)).toFixed(3), class: cls }); };

export function createFlat(host) {
  const svg = el("svg", { class: "tp-gl tp-flatview", "aria-hidden": "true" }), world = el("g"), bell = el("g", { class: "tp-flat-bell" }), links = el("g", { class: "tp-flat-links" });
  svg.append(world);
  host.prepend(svg);
  /** A floor of the table: its own group (so it can be faint), with its ground, the terrain on it, its balls and its dominoes. */
  const layers = Array.from({ length: FLOORS_MAX }, () => ({ g: el("g"), ground: el("g"), terr: el("g"), balls: el("g"), standing: el("g") }));
  layers.forEach(l => l.g.append(l.ground, l.terr, l.balls, l.standing));
  // the ground floor's table: a mahogany frame, brass, birch, and the sixty-one hexagons in it
  layers[0].ground.append(
    poly(ring(OUTER), { class: "tp-flat-frame" }), poly(ring(FIELD + 0.1), { class: "tp-flat-brass" }), poly(ring(FIELD), { class: "tp-flat-birch" }),
    ...CELLS.map((_, i) => hexCell(...MID[i])),
  );
  bell.append(el("path", { d: "M0-.32C-.17-.32-.25-.18-.25 0V.14L-.33.25H.33L.25.14V0C.25-.18.17-.32 0-.32Z", fill: "#e0b04a", stroke: "#7a5a14", "stroke-width": ".02" }));
  // the whole table's scale and offset (s0, ox0, oy0), and the zoom's: s = s0 · zoom, the offset kept so the view stays inside the whole
  let W = 1, H = 1, s0 = 1, ox0 = 0, oy0 = 0, s = 1, ox = 0, oy = 0, zoom = 1, painted = () => {}, current = null, anims = [], held = false, active = 0, knocking = false;
  let rules = FREE, base = new Array(SIZE).fill(0), ys = [0], lv = false;
  const headroom = () => Math.max(...base) + SH;                           // the highest a domino's top can be
  function layout() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const half = flat(OUTER / (Math.sqrt(3) / 2), 0, 0)[0], top = flat(0, headroom(), -OUTER)[1], bottom = flat(0, Math.min(0, ...ys) - 0.6, OUTER)[1];
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
  const onFloor = i => Math.floor(i / SIZE);
  /** The floors in play: the one asked for whole, the others faint (a little less so while a knock plays out, which goes over all of them). */
  function shade() {
    layers.forEach((l, n) => { l.g.style.opacity = n === active || n >= (rules.layers || 1) ? "" : String(knocking ? SEEN : FAINT); l.g.style.pointerEvents = "none"; });
  }
  /** A level's terrain (topple-levels.js; FREE for none), drawn flat: pools, stones, steps, gilding, no table, and the pieces the floors add; back to front, floor by floor. */
  function terrain(next) {
    if (next === rules) return;
    rules = next;
    lv = rules.palette === "levels";
    svg.dataset.scene = rules.scene;
    ys = floorYs(rules);
    const n = rules.n, floorOf = i => Math.floor(i / SIZE);
    base = Array.from({ length: n }, (_, i) => ys[floorOf(i)] + rules.height[i] * rules.rise + (rules.bridges && rules.terrain[i] === WATER ? PLANK : 0));          // a bridge's plank raises the water it spans
    const kids = layers.map(() => []);
    // floors in order, their hexagons back to front
    for (let g = 0; g < n; g++) {
      const l = floorOf(g), i = g % SIZE, [x, z] = MID[g], t = rules.terrain[g], y = ys[l], out = kids[l];
      if (l > 0 && t !== VOID) out.push(hexAtHeight(x, z, y - DECK, 1.0, "tp-flat-step-side"));
    }
    const order = Array.from({ length: n }, (_, g) => g).sort((a, b) => MID[a][1] - MID[b][1]);
    for (const g of order) {
      const l = floorOf(g), [x, z] = MID[g], t = rules.terrain[g], out = kids[l];
      if (t === VOID) { if (l === 0) out.push(hexAtHeight(x, z, 0, 1, "tp-flat-void")); continue; }
      if (l > 0) out.push(hexAtHeight(x, z, ys[l], 1, "tp-flat-deck"));
      if (t === WATER) out.push(hexAtHeight(x, z, ys[l], 0.92, "tp-flat-water"));
      else if (t === ROCK) out.push(hexAtHeight(x, z, ys[l], 0.62, "tp-flat-rock"));
      else if (t === 4) out.push(ellipseAt(x, ys[l], z, 0.3, "tp-flat-cup"));
      else if (rules.height[g]) out.push(hexAtHeight(x, z, ys[l], 1, "tp-flat-step-side"), hexAtHeight(x, z, base[g], 1, `tp-flat-step h${rules.height[g]}`));
      if (rules.marsh?.[g]) out.push(hexAtHeight(x, z, base[g], 0.9, "tp-flat-marsh"), ...[[-0.2, 0.1], [0.12, -0.15], [0.22, 0.18]].map(([dx, dz]) => ellipseAt(x + dx, base[g], z + dz, 0.07, "tp-flat-reed")));
      if (rules.gilded[g]) out.push(hexAtHeight(x, z, base[g], 0.78, "tp-flat-gilt"));
      if (rules.spring?.[g]) out.push(ellipseAt(x, base[g], z, 0.3, "tp-flat-spring"), ellipseAt(x, base[g] + 0.12, z, 0.16, "tp-flat-spring"));
    }
    const f = featuresOf(rules);
    for (const h of f.hedges) {
      const [x0, z0, x1, z1] = h.edge, y = base[h.i];
      kids[onFloor(h.i)].push(poly([flat(x0, y, z0), flat(x1, y, z1), flat(x1, y + 0.3, z1), flat(x0, y + 0.3, z0)], { class: "tp-flat-hedge" }));
    }
    for (const lip of f.lips) {
      const [x0, z0, x1, z1] = lip.edge, y = base[lip.i], y2 = base[lip.j];
      if (lip.water && y2 < y) kids[onFloor(lip.i)].push(poly([flat(x0, y, z0), flat(x1, y, z1), flat(x1, y2, z1), flat(x0, y2, z0)], { class: "tp-flat-fall" }));
      kids[onFloor(lip.i)].push(el("line", { class: "tp-flat-lip", x1: flat(x0, y, z0)[0].toFixed(3), y1: flat(x0, y, z0)[1].toFixed(3), x2: flat(x1, y, z1)[0].toFixed(3), y2: flat(x1, y, z1)[1].toFixed(3) }));
    }
    layers.forEach((l, k) => l.terr.replaceChildren(...kids[k]));
    links.replaceChildren(...f.links.flatMap(({ a, b }) => {
      const pa = flat(MID[a][0], base[a] + 0.02, MID[a][1]), pb = flat(MID[b][0], base[b] + 0.02, MID[b][1]);
      return [ellipseAt(MID[a][0], base[a] + 0.02, MID[a][1], 0.28, "tp-flat-portal"), ellipseAt(MID[b][0], base[b] + 0.02, MID[b][1], 0.28, "tp-flat-portal"),
        ...(onFloor(a) !== onFloor(b) ? [el("line", { class: "tp-flat-stairs", x1: pa[0].toFixed(3), y1: pa[1].toFixed(3), x2: pb[0].toFixed(3), y2: pb[1].toFixed(3) })] : [])];
    }));
    // the floors in the order they are seen: lowest first
    world.replaceChildren(...Array.from({ length: rules.layers || 1 }, (_, k) => k).sort((a, b) => ys[a] - ys[b]).map(k => layers[k].g), links, bell);
    active = Math.min(active, (rules.layers || 1) - 1);
    shade();
    layout();
    if (current) set({ ...current, fresh: [] });
  }
  const topOf = i => base[i] + SH;
  const axisOf = {}, ballOf = {};                     // the slab standing on each hexagon, and the ball
  function set({ cells, ax, mod = null, bell: bellCell, fresh = [], ghost = null }) {
    cancelFall();
    current = { cells, ax, mod, bell: bellCell };
    const lists = layers.map(() => []);
    cells.forEach((c, i) => { if (c >= 0) lists[onFloor(i)].push({ x: MID[i][0], z: MID[i][1], yaw: yawOf(ax[i] >= 0 ? ax[i] : 0), kind: c, cell: i, lift: base[i], plank: rules.terrain[i] === WATER, lv, mod: mod?.[i] || 0 }); });
    layers.forEach((l, k) => l.standing.replaceChildren(slabsEl(lists[k])));
    if (ghost) layers[onFloor(ghost.laid[0])].standing.append(slabsEl(ghost.laid.map((i, k) => ({ x: MID[i][0], z: MID[i][1], yaw: yawOf(ghost.ax[k]), kind: ghost.kinds[k], lift: base[i], plank: rules.terrain[i] === WATER, lv, mod: ghost.mod || 0 })), "ghost"));
    for (const k of Object.keys(ballOf)) delete ballOf[k];
    layers.forEach((l, k) => l.balls.replaceChildren(...cells.flatMap((c, i) => {
      if (c !== BALL || onFloor(i) !== k) return [];
      const [px, py] = flat(MID[i][0], base[i] + BALL_R, MID[i][1]);
      return [ballOf[i] = el("g", { class: "tp-flat-ball" }, el("circle", { cx: px, cy: py, r: BALL_R, class: "body" }), el("circle", { cx: px - 0.06, cy: py - 0.07, r: 0.05, class: "shine" }))];
    })));
    for (const k of Object.keys(axisOf)) delete axisOf[k];
    world.querySelectorAll("[data-cell]").forEach(g => { axisOf[g.dataset.cell] = g; });          // by hexagon, so a fall can move them
    if (bellCell >= 0) { const covered = cells[bellCell] >= 0, [x, z] = MID[bellCell], [px, py] = flat(x, covered ? topOf(bellCell) : base[bellCell], z); bell.setAttribute("transform", `translate(${px} ${py}) scale(${covered ? 0.7 : 1})`); bell.style.display = ""; } else bell.style.display = "none";
    for (const i of fresh) axisOf[i]?.animate?.([{ transform: "translateY(-.5px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 180, easing: "ease-in" });
    painted();
  }
  function cancelFall() { for (const a of anims) a.cancel(); anims = []; if (knocking) { knocking = false; shade(); } }
  /** A ball's roll: along its hexagons (a lost one on past the last, and gone), as quick as the dominoes it hits come after it. */
  function roll(r) {
    const g = ballOf[r.from];
    if (!g?.animate || !r.path.length) return;
    const [hx, hz] = heading(2 * r.dir), at = [];
    for (const i of [r.from, ...r.path]) at.push(i >= 0 ? [MID[i][0], MID[i][1], base[i]] : [at.at(-1)[0] + hx, at.at(-1)[1] + hz, at.at(-1)[2]]);
    const pts = at.map(([x, z, y]) => flat(x, y + BALL_R, z)), [x0, y0] = pts[0];
    const frames = pts.map(([x, y], k) => ({ transform: `translate(${x - x0}px,${y - y0}px)`, opacity: r.lost && k === pts.length - 1 ? 0 : 1, offset: k / (pts.length - 1) }));
    anims.push(g.animate(frames, { duration: (r.path.length + 1) * 85, delay: r.step * 85, easing: "ease-out", fill: "both" }));
  }
  function fall({ fell, rolls = [] }) {
    cancelFall();
    if ((rules.layers || 1) > 1) { knocking = true; shade(); }
    rolls.forEach(roll);
    for (const [cell, step, , way] of fell) {
      const [hx, hz] = heading(way), g = axisOf[cell], [dx, dy] = flat(hx * 0.45, 0, hz * 0.45);
      if (!g?.animate) continue;
      g.style.transformBox = "fill-box"; g.style.transformOrigin = "50% 100%";
      anims.push(g.animate([{ transform: "translate(0,0) scaleY(1)", opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scaleY(.2)`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px,${dy}px) scaleY(.2)`, opacity: 0 }], { duration: 520, delay: step * 85, easing: "ease-in", fill: "both" }));
    }
    return Promise.all(anims.map(a => a.finished.catch(() => {}))).then(() => { knocking = false; shade(); });
  }
  const hit = (px, py) => {
    // a standing domino of the floor in play takes the points that fall on its outline, the nearest to the front first
    if (!current) return -1;
    const order = current.cells.flatMap((c, i) => (c >= 0 && onFloor(i) === active ? [i] : [])).sort((a, b) => MID[b][1] - MID[a][1]);
    for (const i of order) if (inside(outlineOf(i, current.ax[i] >= 0 ? current.ax[i] : 0, 1), px, py)) return i;
    return -1;
  };
  const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > y) !== (poly[j][1] > y) && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
  function outlineOf(i, ax, grow = 1.12) {
    const yaw = yawOf(ax), c = Math.cos(yaw), sn = Math.sin(yaw), pts = [], T = thickOf(current?.mod?.[i] || 0), H = SH;
    for (const lx of [-SW / 2, SW / 2]) for (const y of [base[i], base[i] + H]) for (const lz of [-T / 2, T / 2]) pts.push(project(MID[i][0] + lx * c + lz * sn, y, MID[i][1] - lx * sn + lz * c));
    return hull(pts, grow);
  }
  const SIN = Math.sin((58 * Math.PI) / 180), COS = Math.cos((58 * Math.PI) / 180);
  /** The point of the floor in play under a point of the screen: where the line of sight meets its floor (or a step of it, which stands higher). */
  function pointAt(px, py) {
    const r = host.getBoundingClientRect(), [fx, fy] = unflat(px - r.left, py - r.top);
    const lift = (rules.layers || 1) > 1 ? ys[active] : 0;
    let z = (fy + lift * COS) / SIN;
    if (base.some(Boolean)) for (let k = 0; k < 2; k++) { const i = cellNumber(...hexAt(fx, z)); z = (fy + (i >= 0 ? base[active * SIZE + i] : lift) * COS) / SIN; }
    return [fx, z];
  }
  function cellAt(px, py) {
    const r = host.getBoundingClientRect(), i = hit(px - r.left, py - r.top);
    if (i >= 0) return i;
    const p = pointAt(px, py), c = cellNumber(...hexAt(p[0], p[1]));
    return c < 0 ? -1 : active * SIZE + c;
  }
  new ResizeObserver(layout).observe(host);
  layout();
  return {
    canvas: svg, set, fall, project, pointAt, cellAt, outlineOf, tilt() {}, level() {}, applySkin() {}, cancelFall, zoomAt, panBy, zoomTo, terrain, topOf, baseOf: i => base[i],
    hold() { held = true; for (const a of anims) a.pause(); }, release() { held = false; for (const a of anims) a.play(); },
    onPaint(fn) { painted = fn; }, spin: 0, centre: i => MID[i], redraw: layout, tilted: false, busy: false,
    get zoom() { return zoom; },
    /** The floor in play (0 on): the one a press, a drag and a laid piece mean. */
    get floor() { return active; },
    setFloor(l) { active = Math.max(0, Math.min((rules.layers || 1) - 1, l)); shade(); painted(); },
    get floorYs() { return ys; },
  };
}
