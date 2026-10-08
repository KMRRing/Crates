// Calibre's 3D view: the movement pulled apart, each layer at a height of its own. The plan's drawings are flat, so a
// layer is drawn with the plan's own artwork under one affine map, an axonometric projection: turned by the azimuth,
// tilted by the elevation, lifted by its height. Seen straight down (90°) it is the plan itself; tilted, the stack opens
// out. The main plate is the floor and the side the level works on faces up: the train's layers rising from it (1 to 5,
// the escapement, the balance, an automatic module's), the dial side's hanging under it with the hands below them; or,
// on a level worked under the dial, the dial side rising and the train under. Either way the eye stays on the plan's
// side, so nothing is mirrored and every wheel turns as it does on the plan. Every part keeps its thickness (a darker
// silhouette a little further off), the arbors stand through the layers as steel staffs, a rail names each layer at its
// height (a tap chooses it), and the parts on the layer in hand are named where they sit. The drag that pans the plan
// turns the view here; pinch and the buttons zoom.
import { el, drawPart, drawPlate, drawHands, handLength, extentOf, reachOf, arborName, LAYER_NAMES } from "./calibre-draw.js";
import { radius, MODULE, ESCAPE_R, BALANCE_R } from "./calibre-engine.js";

const DIAL = [6, 7, 8], TRAIN = [1, 2, 3, 4, 5, 9, 10, 11, 12];
/** Where the view starts: turned a little, and tilted low enough to open the stack. */
export const CAM = { az: -24, el: 26, zoom: 1, panX: 0, panY: 0 };
const RAD = Math.PI / 180;

/**
 * The stack: the plate at height 0, the side worked on (up: "train" or "dial") rising from it, the other hanging under
 * it, each layer in use a slot of its own (the layer in hand and the one a chosen part goes on count as in use); the
 * hands a slot past the dial side's end.
 */
function stackOf(arbors, extra, up) {
  const used = new Set(extra.filter(x => x != null));
  for (const a of arbors) for (const p of a.parts || []) used.add(p.layer);
  const slot = new Map([[0, 0]]), sign = up === "dial" ? -1 : 1;
  TRAIN.filter(l => used.has(l)).forEach((l, i) => slot.set(l, sign * (i + 1)));
  DIAL.filter(l => used.has(l)).forEach((l, i) => slot.set(l, -sign * (i + 1)));
  const top = Math.max(...slot.values()), bottom = Math.min(...slot.values());
  return { slot, top, bottom, hands: up === "dial" ? top + 1 : bottom - 1 };
}
/** The projection of a plane at height z, as an SVG matrix: x and y turned by the azimuth, y foreshortened by the
 *  elevation, the height lifting it up the screen. */
const matrixAt = (cam, z) => {
  const t = cam.az * RAD, f = cam.el * RAD;
  return [Math.cos(t), Math.sin(f) * Math.sin(t), -Math.sin(t), Math.sin(f) * Math.cos(t), 0, -Math.cos(f) * z];
};
const project = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const STEEL = new Set(["pinion", "ratchet", "star", "cam", "snail", "column", "heart", "century", "reverser"]);
/**
 * A part's thickness: its silhouette in a darker brass, steel or blue, a little further from the eye than the part. A
 * disc is enough (the part drawn over it covers all but the edge); a balance, a date ring and a tourbillon's cage are
 * rings; the thin parts (a fork, a finger, a lever, a trip) have none worth showing.
 */
function drawSide(parent, a, p, ctx) {
  const tone = p.kind === "escape" ? "s-blue" : STEEL.has(p.kind) ? "s-steel" : "s-brass", ghost = ctx.ghost ? " ghost" : "";
  const at = `translate(${a.x} ${a.y})`;
  const disc = r => el("circle", { transform: at, r, class: `cb-side ${tone}${ghost}` }, parent);
  const ring = (r, w) => el("circle", { transform: at, r, "stroke-width": w, class: `cb-side-ring ${tone}${ghost}` }, parent);
  if (p.kind === "balance") return ring(BALANCE_R - 0.14, 0.32);
  if (p.kind === "star" && p.internal) return ring(p.r + 0.75, 1.15);
  if (p.kind === "cage") return ring(radius(p.sun) + radius(p.pinion) + 0.8, 0.22);
  if (p.kind === "rotor") {
    const rr = ctx.reach * 0.92, g = el("g", {}, parent);
    el("path", { d: `M${-rr} 0A${rr} ${rr} 0 0 1 ${rr} 0L${rr * 0.72} 0A${rr * 0.72} ${rr * 0.72} 0 0 0 ${-rr * 0.72} 0Z`, class: `cb-side s-brass rotor${ghost}` }, g);
    ctx.dyn.push([g, st => g.setAttribute("transform", `${at} rotate(${(st.angles[a.id] || 0) * 360})`)]);
    return g;
  }
  const r = { escape: ESCAPE_R, star: p.r, cam: 2.6, snail: 2.6, kidney: 2.6, column: 1.25, heart: 0.95, century: 2 }[p.kind] ?? (p.teeth ? radius(p.teeth, p.m) + (p.m || MODULE) * 0.8 : 0);
  return r ? disc(r) : null;
}
const css = m => `matrix(${m.map(v => +v.toFixed(5)).join(" ")})`;

/**
 * Draws the design in 3D into svg. o: { plate, arbors (as shown), out, layer (in hand), target (the layer a chosen part
 * goes on), selected, guides, focus (the arbors drawn full), lit (a mesh lit: { a, b }), callouts (false: no names on
 * the layer in hand, as a lesson's picture has names of its own), fit (a lesson's picture: { ids (the arbors to frame,
 * all if none), up (only their parts on the side worked on), px: [w, h] (its size on the page, for the rail's
 * lettering) }: framed on those parts, not the plate), dyn, cam }. Returns the scene: update(cam) moves the camera without redrawing,
 * toPlane(layer, ux, uy) finds the point on a layer's plane under a point of the view (user units), arborAt(ux, uy) the
 * arbor whose part is nearest it, and layerAt(target) the layer a tapped rail label names.
 */
export function draw3d(svg, o) {
  const { arbors, plate } = o, R = reachOf(plate), S = Math.max(2.2, R * 0.27), T = Math.min(0.36, S * 0.1);
  const stack = stackOf(arbors, [o.layer, o.target], o.up), zOf = layer => (stack.slot.get(layer) ?? 0) * S, handsZ = stack.hands * S;
  const hasHands = arbors.some(a => handLength(a, plate) > 0);
  // a bridge's post stands from the plate through the train's layers, to the bridge over them
  const postTop = o.up === "dial" ? (Math.min(stack.bottom, -1) - 0.6) * S : (Math.max(stack.top, 1) + 0.6) * S;
  /** Where an arbor shows best: its highest part on the side worked on (always up), else its lowest under the plate, or a
   *  post's bridge. */
  const topOf = a => { const zs = (a.parts || []).map(p => zOf(p.layer)); return a.noParts ? postTop : zs.some(z => z > 0) ? Math.max(...zs) : Math.min(0, ...zs); };
  const faint = id => !!o.focus && !o.focus.has(id) && !o.focus.has(String(id).replace(/~$/, ""));
  svg.replaceChildren();
  // layers: the planes to project ({ z, g, at: its offset in height, bias: how far behind its height it's drawn }), and
  // staffs: the arbors' segments between neighbouring heights; both are put in order, far before near
  const world = el("g", { class: "cb-3d" }, svg), layers = [], staffs = [];
  const plane = (z, cls, bias = 0) => { const g = el("g", { class: cls }, world); layers.push({ z, g, at: 0, bias }); return g; };
  // the plate, faint enough to see the train through
  const plateG = plane(0, "cb-3d-plate");
  drawPlate(plateG, plate);
  // each layer in use: its parts' far faces (darker: their thickness), then the parts themselves
  const byLayer = new Map();
  for (const a of arbors) for (const p of a.parts || []) { if (!byLayer.has(p.layer)) byLayer.set(p.layer, []); byLayer.get(p.layer).push({ a, p }); }
  const clashing = new Set((o.out?.clashes || []).flatMap(c => c.arbors));
  for (const [layer, slot] of stack.slot) {
    if (!layer) continue;
    const z = slot * S, parts = byLayer.get(layer) || [];
    if (layer === o.layer || layer === o.target) {                // the plane being built on, and where a chosen part goes
      const work = plane(z, "cb-3d-work", -2 * T);
      if (typeof plate === "number") el("circle", { r: plate }, work); else el("rect", { x: -plate.w / 2, y: -plate.h / 2, width: plate.w, height: plate.h, rx: 1.2 }, work);
      if (layer === (o.target ?? o.layer)) for (const c of o.guides || []) el("circle", { cx: c.x, cy: c.y, r: c.r, class: "cb-guide" }, work);
    }
    if (!parts.length) continue;
    const side = el("g", { class: "cb-3d-side" }, world), face = el("g", { class: "cb-3d-face" }, world);
    layers.push({ z, g: side, at: -T, bias: -T }, { z, g: face, at: 0, bias: 0 });
    for (const { a, p } of parts) {
      const ctx = { arbors, layer: o.layer, reach: R, dyn: o.dyn, ghost: faint(a.id), clash: clashing.has(a.id) };
      drawSide(side, a, p, ctx);
      drawPart(face, a, p, ctx);
    }
    // where two wheels on this layer engage: the green dot of the plan, on its own level
    for (const m of (o.out?.meshes || []).filter(x => x.layer === layer)) {
      const A = arbors.find(x => x.id === m.a || `${x.id}~` === m.a), B = arbors.find(x => x.id === m.b || `${x.id}~` === m.b), k = m.ra / (m.ra + m.rb);
      const lit = o.lit && ((o.lit.a === A?.id && o.lit.b === B?.id) || (o.lit.a === B?.id && o.lit.b === A?.id));
      if (A && B) el("circle", { cx: A.x + (B.x - A.x) * k, cy: A.y + (B.y - A.y) * k, r: lit ? 0.42 : 0.2, class: `cb-mesh${lit ? " lit" : ""}${faint(A.id) || faint(B.id) ? " ghost" : ""}` }, face);
    }
  }
  // the hands, past the dial side
  const handsG = plane(handsZ, "cb-3d-hands");
  drawHands(handsG, arbors, plate, o);
  // the arbors: staffs from the plate through every layer they carry (an arbor riding another's, the hour wheel on the
  // centre's, shares its staff); a post stands from the plate through the train. A segment between each pair of
  // neighbouring heights, so each lies behind the layers nearer the eye and over those further off
  const heights = [...new Set([...stack.slot.values(), ...(arbors.some(a => a.noParts) ? [postTop / S] : [])].map(v => v * S))].sort((u, v) => u - v);
  for (const a of arbors) {
    if (a.on) continue;
    const zs = [0, ...arbors.filter(b => b === a || b.on === a.id).flatMap(b => (b.parts || []).map(p => zOf(p.layer)))];
    if (a.noParts) zs.push(postTop);
    const lo = Math.min(...zs), hi = Math.max(...zs), cuts = heights.filter(z => z >= lo - 1e-9 && z <= hi + 1e-9);
    for (let i = 1; i < cuts.length; i++) staffs.push({ a, lo: cuts[i - 1], hi: cuts[i], line: el("line", { class: `cb-staff${faint(a.id) ? " ghost" : ""}${a.noParts ? " post" : ""}` }, world) });
  }
  // the rail: each layer named at its height, the one in hand marked; a tap chooses it
  const rail = el("g", { class: "cb-rail" }, svg), marks = [];
  for (const [layer, slot] of [...stack.slot].sort((u, v) => v[1] - u[1])) {
    const g = el("g", { class: `cb-rail-mark${layer === o.layer ? " on" : ""}${layer === 0 ? " plate" : ""}`, "data-layer": layer }, rail);
    const tick = el("line", {}, g), hit = el("rect", { class: "cb-rail-hit" }, g), t = el("text", {}, g);
    t.textContent = layer === 0 ? "Plate" : LAYER_NAMES[layer] || layer;
    marks.push({ layer, z: slot * S, g, tick, hit, t });
  }
  if (hasHands) {
    const g = el("g", { class: "cb-rail-mark hands" }, rail), t = el("text", {}, g);
    t.textContent = "Hands";
    marks.push({ layer: null, z: handsZ, g, tick: el("line", {}, g), hit: el("rect", { class: "cb-rail-hit" }, g), t });
  }
  // the names of the parts on the layer in hand (and the arbor selected), where they sit
  const notes = el("g", { class: "cb-callouts" }, svg), callouts = [];
  for (const a of o.callouts === false ? [] : arbors) for (const p of a.parts || []) {
    if (p.layer !== o.layer && a.id !== o.selected) continue;
    if (faint(a.id) || a.noParts) continue;
    const t = el("text", { class: `cb-callout${a.id === o.selected ? " sel" : ""}` }, notes);
    t.textContent = `${arborName(a)}${p.teeth ? ` · ${p.teeth}` : ""}`;
    callouts.push({ a, z: zOf(p.layer), t });
  }

  let flipped = null;
  const scene = {
    cam: { ...o.cam },
    update(cam = scene.cam) {
      scene.cam = cam;
      const m = z => matrixAt(cam, z), dir = cam.el < 0 ? -1 : 1;   // dir: which way the eye is, up the stack or down it
      for (const L of layers) L.g.setAttribute("transform", css(m(L.z + L.at * dir)));
      // far before near: from the bottom up seen from the dial side, from the top down seen from below
      if (flipped !== dir) {
        flipped = dir;
        const order = [...layers.map(L => ({ k: (L.z + L.bias * dir) * dir, n: L.g })), ...staffs.map(s => ({ k: ((s.lo + s.hi) / 2) * dir, n: s.line }))];
        order.sort((u, v) => u.k - v.k);
        for (const { n } of order) world.appendChild(n);
      }
      for (const s of staffs) {
        const [x1, y1] = project(m(s.lo), s.a.x, s.a.y), [x2, y2] = project(m(s.hi), s.a.x, s.a.y);
        Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => s.line.setAttribute(k, v.toFixed(3)));
      }
      // what the view must hold: the plate's outline at the top and bottom of the stack (and the hands' level), or for a
      // lesson's picture its own parts at their heights, their hands, and where their staffs meet the plate
      const outline = typeof plate === "number" ? Array.from({ length: 48 }, (_, i) => [Math.cos(i * Math.PI / 24) * plate, Math.sin(i * Math.PI / 24) * plate])
        : [[-plate.w / 2, -plate.h / 2], [plate.w / 2, -plate.h / 2], [plate.w / 2, plate.h / 2], [-plate.w / 2, plate.h / 2]];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const hold = (z, x, y) => { const [u, v] = project(m(z), x, y); x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); };
      const ring = (z, cx, cy, r) => { for (let i = 0; i < 24; i++) hold(z, cx + Math.cos(i * Math.PI / 12) * r, cy + Math.sin(i * Math.PI / 12) * r); };
      const framed = o.fit ? arbors.filter(a => !o.fit.ids || o.fit.ids.includes(a.id)) : null;
      if (framed?.length) {
        for (const a of framed) {
          hold(0, a.x, a.y);
          for (const p of a.parts || []) if (!o.fit.up || zOf(p.layer) >= 0) ring(zOf(p.layer), a.x, a.y, extentOf(p, R));
          if (handLength(a, plate) && (!o.fit.up || handsZ > 0)) ring(handsZ, a.x, a.y, handLength(a, plate));
        }
      } else for (const z of hasHands ? [Math.min(stack.bottom * S, handsZ), Math.max(stack.top * S, handsZ)] : [stack.bottom * S, stack.top * S]) for (const [x, y] of outline) hold(z, x, y);
      // the rail stands left of the stack: each label level with its layer's left edge (a picture's lettering about 11 px)
      const k0 = o.fit?.px ? Math.min(o.fit.px[0] / Math.max(1e-6, x1 - x0), o.fit.px[1] / Math.max(1e-6, y1 - y0)) : 0;
      const fs = k0 ? 11 / (k0 * 0.8) : Math.max(0.62, R * 0.065), left = x0 - 0.5, edge = x0;
      const mid = framed?.length ? [framed.reduce((t, a) => t + a.x, 0) / framed.length, framed.reduce((t, a) => t + a.y, 0) / framed.length] : null;
      for (const k of marks) {
        let ex = Infinity, ey = 0;
        if (mid) [ex, ey] = [edge, project(m(k.z), ...mid)[1]];
        else for (const [x, y] of outline) { const [u, v] = project(m(k.z), x, y); if (u < ex) { ex = u; ey = v; } }
        const lx = left - fs * 0.4;
        k.t.setAttribute("x", lx.toFixed(3)); k.t.setAttribute("y", (ey + fs * 0.35).toFixed(3)); k.t.setAttribute("font-size", fs.toFixed(3));
        Object.entries({ x1: lx + fs * 0.25, y1: ey, x2: ex, y2: ey }).forEach(([a, v]) => k.tick.setAttribute(a, v.toFixed(3)));
        const w = fs * 0.62 * k.t.textContent.length + fs;
        Object.entries({ x: lx - w + fs * 0.4, y: ey - fs * 0.85, width: w + (ex - lx), height: fs * 1.7 }).forEach(([a, v]) => k.hit.setAttribute(a, v.toFixed(3)));
        x0 = Math.min(x0, lx - fs * 0.62 * k.t.textContent.length - 0.3);
      }
      for (const c of callouts) {
        const [u, v] = project(m(c.z), c.a.x, c.a.y);
        c.t.setAttribute("x", u.toFixed(3)); c.t.setAttribute("y", (v - fs * 0.55).toFixed(3)); c.t.setAttribute("font-size", (fs * 0.85).toFixed(3));
      }
      // straight down the rail and the names would pile onto one line: they fade in as the stack opens
      const shown = Math.min(1, Math.max(0, (80 - Math.abs(cam.el)) / 18));
      rail.style.opacity = notes.style.opacity = shown;
      rail.style.pointerEvents = shown > 0.5 ? "" : "none";
      // the view: the whole stack with a margin, zoomed and panned; with the bottom of the picture covered (the inspector
      // over it), the stack keeps to the room above
      const pad = (x1 - x0) * 0.04 + 0.6, w = (x1 - x0 + 2 * pad) / cam.zoom, h = (y1 - y0 + 2 * pad) / cam.zoom;
      const cx = (x0 + x1) / 2 + cam.panX, cy = (y0 + y1) / 2 + cam.panY, box = scene.inset > 0 ? svg.getBoundingClientRect() : null;
      if (box?.width && box.height) {
        const room = box.height * (1 - scene.inset), k = Math.max(w / box.width, h / room);   // units a pixel
        svg.setAttribute("viewBox", `${(cx - (box.width / 2) * k).toFixed(3)} ${(cy - (room / 2) * k).toFixed(3)} ${(box.width * k).toFixed(3)} ${(box.height * k).toFixed(3)}`);
      } else svg.setAttribute("viewBox", `${(cx - w / 2).toFixed(3)} ${(cy - h / 2).toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`);
    },
    /** How much of the picture's height, from the bottom, something covers: the view keeps the stack above it. */
    inset: 0,
    /** The point of a layer's plane under a point of the view: the projection undone (its determinant is sin(el)). */
    toPlane(layer, ux, uy) {
      const [a, b, c, d, , f] = matrixAt(scene.cam, zOf(layer)), det = a * d - b * c, v = uy - f;
      return [(d * ux - c * v) / det, (-b * ux + a * v) / det];
    },
    /** A point of a layer's plane in the view's units (for tests, and anything placed over the view). */
    toView(layer, x, y) { return project(matrixAt(scene.cam, zOf(layer)), x, y); },
    /** The top of an arbor in the view's units: where a name for it goes. */
    topView(a) { return project(matrixAt(scene.cam, topOf(a)), a.x, a.y); },
    /** The arbor with a part nearest a point of the view, the nearer the viewer the better among those close enough. */
    arborAt(ux, uy, reach) {
      let best = null;
      const toward = Math.sign(scene.cam.el) || 1;
      for (const a of arbors) for (const p of [{ layer: 0 }, ...(a.parts || [])]) {
        const z = zOf(p.layer), [u, v] = project(matrixAt(scene.cam, z), a.x, a.y), d = Math.hypot(u - ux, v - uy);
        if (d > reach) continue;
        // the nearest wins; where two are about as near, the one nearer the eye
        if (!best || d < best.d - 0.25 || (d < best.d + 0.25 && z * toward > best.z * toward)) best = { a, d, z, layer: p.layer };
      }
      return best && { a: best.a, layer: best.layer };
    },
    /** The layer a tap on the rail chose (null off the rail, or on the hands or the plate). */
    layerAt(target) { const g = target.closest?.(".cb-rail-mark"); const l = g ? Number(g.dataset.layer) : NaN; return Number.isFinite(l) && l ? l : null; },
    zOf,
  };
  scene.update(o.cam);
  return scene;
}
