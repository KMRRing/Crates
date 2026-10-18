// Orrery drawn flat, in SVG, where there's no WebGL: the same dial seen from above, drums as bands, planets as discs with
// the marks they have in 3D (a ring, bands, a crescent, a cap) so they're told apart without their colour. It
// answers to the same calls as the 3D one (orrery-3d.js), so the page doesn't know which it has: frame, event, pick,
// angleAt, at, orbit (which does nothing without a third dimension).
import { RINGS, PLACES, STEP, TAU, FORETELL } from "./orrery-engine.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const RADIUS = [20, 31, 42, 53, 64], HALF = 4.8, PR = [3, 3.3, 3.6, 3.9, 4.2], PLATE = 76, SUN = 7;       // tenths of the 3D dial's units
const polar = (r, a) => [r * Math.sin(a), -r * Math.cos(a)];
/** A planet's mark, in the picture's frame (as the 3D planets have it) at radius r. */
function mark(c, r) {
  return [
    () => el("ellipse", { class: "or-stroke", rx: r * 1.45, ry: r * 0.4, transform: "rotate(-18)" }),
    () => el("path", { class: "or-stroke", d: `M${-r * 0.78} ${-r * 0.32}H${r * 0.78}M${-r * 0.78} ${r * 0.34}H${r * 0.78}` }),
    () => el("path", { class: "or-shade", d: `M0 ${-r}A${r} ${r} 0 0 0 0 ${r}A${r * 0.5} ${r} 0 0 1 0 ${-r}Z` }),
    () => el("circle", { class: "or-cap", cx: r * 0.32, cy: -r * 0.34, r: r * 0.34 }),
  ][c]();
}

export function createFlat(host) {
  const svg = el("svg", { class: "or-gl or-flatview", "aria-hidden": "true" }), world = el("g");
  svg.append(world);
  host.prepend(svg);
  world.append(el("circle", { class: "or-flat-plate", r: PLATE }));
  for (let p = 0; p < PLACES; p++) { const [x, y] = polar(PLATE - 1, p * STEP), [x0, y0] = polar(SUN + 4, p * STEP); world.append(el("line", { class: "or-flat-spoke", x1: x0, y1: y0, x2: x, y2: y })); }
  RADIUS.forEach(r => world.append(el("circle", { class: "or-flat-band", r, "stroke-width": HALF * 2 - 0.5 })));
  const rings = RADIUS.map(() => el("g"));
  world.append(...rings);
  world.append(el("circle", { class: "or-flat-sun", r: SUN }), el("circle", { class: "or-flat-sun-core", r: SUN * 0.55 }));
  const fx = el("g"), beamsG = el("g");
  const seats = rings.map((g, k) => Array.from({ length: PLACES }, (_, p) => {
    const planet = el("g", { class: "or-planet" }), body = el("g");
    planet.append(body);
    g.append(planet);
    return { planet, body, colour: -1, kind: null };
  }));
  const ghost = el("circle", { class: "or-foretold", visibility: "hidden" });
  world.append(beamsG, ghost, fx);

  let W = 1, H = 1, s = 1, last = null, skin = { name: "flat", night: false };
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    s = Math.min(W, H) / (2 * PLATE * 1.02);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    world.setAttribute("transform", `translate(${(W / 2).toFixed(2)} ${(H / 2).toFixed(2)}) scale(${s.toFixed(4)})`);
  }
  const place = (ring, angle) => polar(RADIUS[ring], angle);
  function frame(state, dt) {
    last = state;
    for (let k = 0; k < RINGS; k++) for (let p = 0; p < PLACES; p++) {
      const c = state.rings[k].places[p], seat = seats[k][p];
      if (c < 0) { seat.planet.setAttribute("visibility", "hidden"); continue; }
      if (seat.colour !== c) {
        seat.colour = c;
        seat.body.replaceChildren(el("circle", { class: "or-disc", r: PR[k] }), mark(c, PR[k]));
        seat.planet.setAttribute("class", `or-planet k${c}`);
      }
      const [x, y] = place(k, state.rings[k].a + p * STEP);
      seat.planet.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      seat.planet.setAttribute("visibility", "visible");
    }
    const nx = state.next, due = nx.due - state.t;
    if (!state.over && nx.ring >= 0 && due < FORETELL && state.rings[nx.ring].places[nx.place] < 0) {
      const [x, y] = place(nx.ring, state.rings[nx.ring].a + nx.place * STEP);
      ghost.setAttribute("class", `or-foretold k${nx.colour}`);
      ghost.setAttribute("cx", x.toFixed(2)); ghost.setAttribute("cy", y.toFixed(2)); ghost.setAttribute("r", (PR[nx.ring] + 0.6).toFixed(2));
      ghost.setAttribute("visibility", "visible");
    } else ghost.setAttribute("visibility", "hidden");
    const lines = [];
    for (const c of state.live?.clusters ?? []) for (const m of c.members) {
      const [x, y] = place(m.ring, state.rings[m.ring].a + m.place * STEP);
      lines.push(el("line", { class: `or-flat-beam k${c.colour}`, x1: 0, y1: 0, x2: x.toFixed(2), y2: y.toFixed(2), "stroke-width": (0.6 + 1.6 * c.progress).toFixed(2), opacity: (0.35 + 0.6 * c.progress).toFixed(2) }));
    }
    beamsG.replaceChildren(...lines);
  }
  function event(e, state) {
    if (e.type !== "lock") return;
    for (const m of e.members) {
      const [x, y] = place(m.ring, state.rings[m.ring].a + m.place * STEP);
      const g = el("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }, el("g", { class: `or-planet k${e.colour}` }, el("circle", { class: "or-disc", r: PR[m.ring] }), mark(e.colour, PR[m.ring])));
      fx.append(g);
      const done = g.animate?.([{ transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(1)`, opacity: 1 }, { transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(2.2)`, opacity: 0 }], { duration: 450, easing: "ease-out" }).finished;
      (done ?? Promise.resolve()).catch(() => {}).then(() => g.remove());
    }
  }
  const toLocal = (px, py) => { const r = host.getBoundingClientRect(); return [(px - r.left - W / 2) / s, (py - r.top - H / 2) / s]; };
  /** The ring under a point of the screen, the gaps between taken by the nearer: or -1. */
  function pick(px, py) {
    const [x, y] = toLocal(px, py), d = Math.hypot(x, y);
    const k = RADIUS.reduce((b, r, j) => (Math.abs(r - d) < Math.abs(RADIUS[b] - d) ? j : b), 0);
    return Math.abs(RADIUS[k] - d) <= HALF + 0.7 ? k : -1;
  }
  const angleAt = (ring, px, py) => { const [x, y] = toLocal(px, py); return (Math.atan2(x, -y) + TAU) % TAU; };
  const at = (ring, angle) => { const [x, y] = place(ring, angle); return [W / 2 + x * s, H / 2 + y * s]; };

  new ResizeObserver(() => { resize(); if (last) frame(last, 0); }).observe(host);
  resize();
  return {
    canvas: svg, frame, event, pick, angleAt, at, sunAt: () => [W / 2, H / 2], orbit() {}, setView() {}, applySkin() {}, redraw() { if (last) frame(last, 0); },
    get skin() { return skin; }, get angles() { return [0, Math.PI / 2]; }, get live() { return { motes: 0, exits: fx.children.length, beams: beamsG.children.length }; }, size: () => [W, H],
  };
}
