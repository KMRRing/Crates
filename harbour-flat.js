// Harbour's flat map: the harbour seen from straight above, drawn in SVG. It's the map wherever a device can't draw in
// 3D (harbour-3d.js), or when the player asks for it, and it answers the same calls as the 3D one: setLevel, draw,
// pick, drag, release, theme, resize, dispose.
import { CLASSES } from "./harbour-engine.js";

const NS = "http://www.w3.org/2000/svg";
// hexes, pointy side up, every odd row half a hex to the right: 10 drawing units across, 8.66 from row to row
const HEX_W = 10, HEX_R = HEX_W / Math.sqrt(3), ROW_H = 1.5 * HEX_R;
const centre = (x, y) => ({ cx: HEX_W * (x + 0.5 + (y & 1) / 2), cy: HEX_R + ROW_H * y });
const hexPoints = (x, y, inset = 0) => {
  const { cx, cy } = centre(x, y), r = HEX_R - inset;
  return [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (60 * i - 30); return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`; }).join(" ");
};
/** A ship from above in a 10-unit square, bow to the east; a Handy drawn bigger than a coaster. The fleet's chips use it too. */
export const HULL = "M1.2 2.9H6.2C8.4 2.9 9.4 4 9.5 5C9.4 6 8.4 7.1 6.2 7.1H1.2Q.6 5 1.2 2.9Z";
const HULL_SCALE = { coaster: .84, handy: 1.06 };
export const hullScale = type => `translate(5 5) scale(${HULL_SCALE[type] || 1}) translate(-5 -5)`;
const GAP = 0.6, EDGE = 0.8;                 // between tiles; a jetty's border, inside its tile so every tile is as big

export function createFlat(box) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "hb-map");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "The harbour");
  box.appendChild(svg);
  let L = null, G = null;

  // Only the water is drawn, every hex the same tile with the same gap round it, and the page round them is the land.
  // The view is cropped to the water (plus a margin), so the harbour sits in the middle of its box whatever land the
  // map has around it. A jetty is a water tile in its product's colour (the customer's in blue), lettered as on the
  // map; a refinery's fills from the bottom up as its tank does.
  function setLevel(level, g) {
    L = level; G = g;
    const tiles = [], parts = [], defs = [];
    for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) if (G.at(x, y) !== "land") tiles.push({ x, y, ...centre(x, y) });
    const pad = 1.5, x0 = Math.min(...tiles.map(t => t.cx)) - HEX_W / 2 - pad, y0 = Math.min(...tiles.map(t => t.cy)) - HEX_R - pad;
    const W = Math.max(...tiles.map(t => t.cx)) + HEX_W / 2 + pad - x0, H = Math.max(...tiles.map(t => t.cy)) + HEX_R + pad - y0;
    svg.setAttribute("viewBox", `${x0.toFixed(2)} ${y0.toFixed(2)} ${W.toFixed(2)} ${H.toFixed(2)}`);
    svg.style.setProperty("--aspect", W / H);
    for (const { x, y, cx, cy } of tiles) {
      const k = G.at(x, y), j = G.jetty(x, y);
      if (!j) { parts.push(`<polygon class="hb-tile" points="${hexPoints(x, y, GAP)}"/>`); continue; }
      const shape = hexPoints(x, y, GAP + EDGE / 2);
      let level = "";
      if (j.tank) {
        defs.push(`<clipPath id="tank-${k}"><polygon points="${shape}"/></clipPath>`);
        level = `<rect class="hb-level" data-tank="${k}" data-bottom="${(cy + HEX_R).toFixed(2)}" data-full="${(2 * HEX_R).toFixed(2)}" x="${(cx - HEX_W / 2).toFixed(2)}" y="${(cy + HEX_R).toFixed(2)}" width="${HEX_W}" height="0" clip-path="url(#tank-${k})"/>`;
      }
      parts.push(`<g class="hb-jetty ${j.kind === "load" ? `load pr-${j.product}` : "discharge"}"><polygon class="hb-berth" points="${shape}"/>${level}`
        + `<polygon class="hb-edge" points="${shape}"/><text x="${cx.toFixed(2)}" y="${(cy + 1.45).toFixed(2)}">${k}</text></g>`);
    }
    svg.innerHTML = `<defs>${defs.join("")}</defs>` + parts.join("") + `<g class="hb-fleet"></g><g class="hb-marks"></g>`;
  }

  /** ships: [{ x, y, h, type, cargo }], sel: the picked ship (or -1), crash: the run's crash (or null), tanks: each
   *  refinery tank's level by its jetty's letter, still: no gliding (an edit), ms: how long a glide takes. */
  function draw({ ships, sel, crash, tanks, still, ms }) {
    svg.classList.toggle("still", still);
    svg.style.setProperty("--hb-hour", `${ms}ms`);
    const g = svg.querySelector(".hb-fleet");
    while (g.children.length > ships.length) g.lastChild.remove();
    while (g.children.length < ships.length) {
      const i = g.children.length, el = document.createElementNS(NS, "g");
      el.setAttribute("class", "hb-ship");
      el.innerHTML = `<g><path class="hb-hull" d="${HULL}"/><rect class="hb-bridge" x="1.7" y="3.5" width="1.5" height="3" rx=".35"/><g class="hb-cargo"></g></g>`
        + `<text class="hb-num" x="5.9" y="6.1">${i + 1}</text>`;
      g.appendChild(el);
    }
    ships.forEach((p, i) => {
      const el = g.children[i];
      el.classList.remove("dragging", "scrap");
      const { cx, cy } = centre(p.x, p.y);
      el.style.transform = `translate(${cx - 5}px, ${cy - 5}px)`;
      el.firstChild.setAttribute("transform", `rotate(${-60 * (p.h ?? 0)} 5 5) ${hullScale(p.type)}`);   // the bow along its heading, a Handy bigger
      // the cargo as a bar along the deck, a stretch per product, as long as the share of the ship it fills
      let x = 3.6;
      el.querySelector(".hb-cargo").innerHTML = Object.entries(p.cargo || {}).filter(([, u]) => u > 0).map(([prod, u]) => {
        const w = 4.3 * u / CLASSES[p.type].cap, r = `<rect class="hb-load pr-${prod}" x="${x}" y="4" width="${w}" height="2" rx=".4"/>`;
        x += w;
        return r;
      }).join("");
      el.classList.toggle("sel", i === sel);
      el.classList.toggle("hit", !!crash?.ships.includes(i));
    });
    const o = crash && centre(crash.at[0], crash.at[1]);
    svg.querySelector(".hb-marks").innerHTML = crash ? `<circle class="hb-crash" cx="${o.cx}" cy="${o.cy}" r="4.7"/>` : "";
    for (const el of svg.querySelectorAll(".hb-level")) {
      const k = el.dataset.tank, h = +el.dataset.full * (tanks[k] || 0) / L.jetties[k].tank.cap;
      el.setAttribute("height", h.toFixed(2));
      el.setAttribute("y", (+el.dataset.bottom - h).toFixed(2));
    }
  }

  // a point is in the hex whose centre is nearest
  const point = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  function pick(e) {
    const p = point(e), y0 = Math.round((p.y - HEX_R) / ROW_H);
    let best = null;
    for (let y = y0 - 1; y <= y0 + 1; y++) {
      const x0 = Math.round(p.x / HEX_W - 0.5 - (y & 1) / 2);
      for (let x = x0 - 1; x <= x0 + 1; x++) { const c = centre(x, y), d = (c.cx - p.x) ** 2 + (c.cy - p.y) ** 2; if (!best || d < best.d) best = { x, y, d }; }
    }
    return { x: best.x, y: best.y };
  }
  function drag(i, e, scrap) {
    const el = svg.querySelector(".hb-fleet").children[i], p = point(e);
    if (!el) return;
    el.classList.add("dragging");
    el.classList.toggle("scrap", scrap);
    el.style.transform = `translate(${p.x - 5}px, ${p.y - 5}px)`;
  }
  /** Where a hex's centre is on screen, in page pixels (for tests, and hints that point at a hex). */
  function where(x, y) {
    const { cx, cy } = centre(x, y), m = svg.getScreenCTM();
    return { clientX: m.a * cx + m.c * cy + m.e, clientY: m.b * cx + m.d * cy + m.f };
  }
  return { setLevel, draw, pick, drag, where, release() {}, theme() {}, resize() {}, dispose() { svg.remove(); }, flat: true };
}
