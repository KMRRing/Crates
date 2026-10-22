// Orrery drawn flat, in SVG, where there's no WebGL: the same orrery seen from straight above, each hoop an ellipse as
// narrow as it is tipped, its raised half drawn whole and the half tipped down dashed (from above, a tip either way
// looks the same otherwise), in the enamel of the colour whose plane it's in; planets as discs with the marks they have
// in 3D (a ring, bands, a crescent, a cap) so they're told apart without their colour, and the steps ticking and the
// tips turning as in 3D. It answers to the same calls as the 3D one (orrery-3d.js), so the page doesn't know which it
// has: frame, event, select, pick, angleAt, at, orbit (which does nothing without a third dimension).
import { RINGS, PLACES, STEP, TAU, FORETELL, dirOf, turnOf, tiltOf, planeOf } from "./orrery-engine.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const RADIUS = [20, 34, 48, 62], PR = [4.2, 4.7, 5.2, 5.6], PLATE = 76, SUN = 8.5;           // tenths of the 3D orrery's units
const P = 72;                                                                                  // points to a hoop's outline, for picking
/**
 * A planet of colour c at (0, 0), radius r, as SVG markup: its enamel's disc and the mark it has in 3D (Saturn's ring,
 * bands, a crescent, a cap), so it's told apart without its colour; in a group of class `or-planet k<c>`, which gives the
 * enamel. The flat orrery's planets and the page's colour buttons are drawn with it.
 */
export function planetSvg(c, r) {
  const f = v => +v.toFixed(2);
  return `<circle class="or-disc" r="${f(r)}"/>${[
    `<ellipse class="or-stroke" rx="${f(r * 1.45)}" ry="${f(r * 0.4)}" transform="rotate(-18)"/>`,
    `<path class="or-stroke" d="M${f(-r * 0.78)} ${f(-r * 0.32)}H${f(r * 0.78)}M${f(-r * 0.78)} ${f(r * 0.34)}H${f(r * 0.78)}"/>`,
    `<path class="or-shade" d="M0 ${f(-r)}A${f(r)} ${f(r)} 0 0 0 0 ${f(r)}A${f(r * 0.5)} ${f(r)} 0 0 1 0 ${f(-r)}Z"/>`,
    `<circle class="or-cap" cx="${f(r * 0.32)}" cy="${f(-r * 0.34)}" r="${f(r * 0.34)}"/>`,
  ][c]}`;
}

export function createFlat(host) {
  const svg = el("svg", { class: "or-gl or-flatview", "aria-hidden": "true" }), world = el("g");
  svg.append(world);
  host.prepend(svg);
  world.append(el("circle", { class: "or-flat-plate", r: PLATE }));
  world.append(el("line", { class: "or-flat-axle", x1: 0, y1: -(PLATE - 4), x2: 0, y2: PLATE - 4 }));
  const bands = RADIUS.map(() => [el("path", { class: "or-flat-band" }), el("path", { class: "or-flat-band" })]);     // its three o'clock half and its nine
  world.append(...bands.flat());
  world.append(el("circle", { class: "or-flat-sun", r: SUN }), el("circle", { class: "or-flat-sun-core", r: SUN * 0.55 }));
  const fx = el("g"), beamsG = el("g"), planetsG = el("g");
  const seats = Array.from({ length: RINGS }, (_, k) => Array.from({ length: PLACES }, () => {
    const planet = el("g", { class: "or-planet" }), body = el("g");
    planet.append(body);
    planetsG.append(planet);
    return { planet, body, colour: -1 };
  }));
  const ghost = el("circle", { class: "or-foretold", visibility: "hidden" });
  world.append(beamsG, planetsG, ghost, fx);

  let W = 1, H = 1, s = 1, last = null, skin = { name: "flat", night: false }, chosen = -1;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    s = Math.min(W, H) / (2 * PLATE * 1.02);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    world.setAttribute("transform", `translate(${(W / 2).toFixed(2)} ${(H / 2).toFixed(2)}) scale(${s.toFixed(4)})`);
  }
  const tipOf = ring => (last ? tiltOf(last.rings[ring], last.t) : 0);
  /** Where a place is, seen from above: the world's x and z. */
  const place = (ring, angle) => { const d = dirOf(tipOf(ring), angle); return [RADIUS[ring] * d[0], RADIUS[ring] * d[2]]; };
  /** Where a hoop's own place is drawn now, round the sun: its hoop ticking round. */
  const seat = (state, ring, p) => place(ring, (turnOf(state.rings[ring], state.t) + p) * STEP);
  function frame(state, dt) {
    last = state;
    bands.forEach(([east, west], k) => {
      const r = state.rings[k], t = tiltOf(r, state.t), R = RADIUS[k], rx = (R * Math.cos(t)).toFixed(2), c = planeOf(r.tip);
      const cls = `or-flat-band${k === chosen && !state.over ? " on" : ""}${c >= 0 ? ` k${c}` : ""}`;
      east.setAttribute("d", `M0 ${-R}A${rx} ${R} 0 0 1 0 ${R}`);
      west.setAttribute("d", `M0 ${R}A${rx} ${R} 0 0 1 0 ${-R}`);
      east.setAttribute("class", `${cls}${t < -1e-3 ? " down" : ""}`);           // the three o'clock half goes down for a tip the negative way
      west.setAttribute("class", `${cls}${t > 1e-3 ? " down" : ""}`);
    });
    for (let k = 0; k < RINGS; k++) for (let p = 0; p < PLACES; p++) {
      const c = state.rings[k].places[p], chair = seats[k][p];
      if (c < 0) { chair.planet.setAttribute("visibility", "hidden"); continue; }
      if (chair.colour !== c) {
        chair.colour = c;
        chair.body.innerHTML = planetSvg(c, PR[k]);
        chair.planet.setAttribute("class", `or-planet k${c}`);
      }
      const [x, y] = seat(state, k, p);
      chair.planet.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      chair.planet.setAttribute("visibility", "visible");
    }
    const nx = state.next, due = nx.due - state.t;
    if (!state.over && nx.ring >= 0 && due < FORETELL && state.rings[nx.ring].places[nx.place] < 0) {
      const [x, y] = seat(state, nx.ring, nx.place);
      ghost.setAttribute("class", `or-foretold k${nx.colour}`);
      ghost.setAttribute("cx", x.toFixed(2)); ghost.setAttribute("cy", y.toFixed(2)); ghost.setAttribute("r", (PR[nx.ring] + 0.6).toFixed(2));
      ghost.setAttribute("visibility", "visible");
    } else ghost.setAttribute("visibility", "hidden");
    const lines = [];
    for (const c of state.locks ?? []) for (const m of c.members) {
      const [x, y] = seat(state, m.ring, m.place);
      lines.push(el("line", { class: `or-flat-beam k${c.colour}`, x1: 0, y1: 0, x2: x.toFixed(2), y2: y.toFixed(2), "stroke-width": 1.6, opacity: 0.8 }));
      lines.push(el("circle", { class: `or-flat-ring k${c.colour}`, cx: x.toFixed(2), cy: y.toFixed(2), r: (PR[m.ring] * 1.45).toFixed(2) }));     // a line standing, until the beat strikes it
    }
    beamsG.replaceChildren(...lines);
  }
  function event(e, state) {
    if (e.type !== "lock") return;
    for (const m of e.members) {
      const [x, y] = seat(state, m.ring, m.place);
      const body = el("g", { class: `or-planet k${e.colour}` }), g = el("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }, body);
      body.innerHTML = planetSvg(e.colour, PR[m.ring]);
      fx.append(g);
      const done = g.animate?.([{ transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(1)`, opacity: 1 }, { transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(2.2)`, opacity: 0 }], { duration: 450, easing: "ease-out" }).finished;
      (done ?? Promise.resolve()).catch(() => {}).then(() => g.remove());
    }
  }
  const toLocal = (px, py) => { const r = host.getBoundingClientRect(); return [(px - r.left - W / 2) / s, (py - r.top - H / 2) / s]; };
  const onSegment = (x, y, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy, t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  };
  /** The hoop nearest a point of the screen (its wire, or the edge of a planet on it), if within `reach` pixels of it, else -1. */
  function pick(px, py, reach = 18) {
    const [x, y] = toLocal(px, py);
    let best = reach / s, ring = -1;
    for (let k = 0; k < RINGS; k++) {
      let [ax, ay] = place(k, 0);
      for (let i = 1; i <= P; i++) {
        const [bx, by] = place(k, (i / P) * TAU), d = onSegment(x, y, ax, ay, bx, by);
        if (d < best) { best = d; ring = k; }
        ax = bx; ay = by;
      }
      if (!last) continue;
      for (let p = 0; p < PLACES; p++) {
        if (last.rings[k].places[p] < 0) continue;
        const [cx, cy] = seat(last, k, p), d = Math.hypot(x - cx, y - cy) - PR[k];
        if (d < best) { best = d; ring = k; }
      }
    }
    return ring;
  }
  /** Where a point of the screen lies round the sun, in the plane of a hoop: clockwise from twelve o'clock round the hoop. */
  const angleAt = (ring, px, py) => { const [x, y] = toLocal(px, py); return (Math.atan2(x / Math.max(0.2, Math.cos(tipOf(ring))), -y) + TAU) % TAU; };
  const at = (ring, angle) => { const [x, y] = place(ring, angle); return [W / 2 + x * s, H / 2 + y * s]; };

  new ResizeObserver(() => { resize(); if (last) frame(last, 0); }).observe(host);
  resize();
  return {
    canvas: svg, frame, event, pick, angleAt, at, sunAt: () => [W / 2, H / 2], orbit() {}, setView() {}, applySkin() {}, redraw() { if (last) frame(last, 0); },
    select(ring) { chosen = ring; if (last) frame(last, 0); },
    get skin() { return skin; }, get angles() { return [0, Math.PI / 2]; }, get live() { return { motes: 0, exits: fx.children.length, beams: beamsG.children.length }; }, size: () => [W, H],
  };
}
