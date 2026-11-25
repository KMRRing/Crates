// Dispatch's chart: where the meeting you are reading took place, on an old chart of the world, with the day's journey to it so
// far; and, once the notes are handed in, the whole day's journey. Korbi, 25 November 2026: "dispatch is ugly, needs more visuals".
// One SVG: Natural Earth's coastlines at 1:110m (world.js, public domain, loaded the first time a chart is drawn), in the page's
// own colours: a paper sea ruled every ten degrees, the land a wash of brass, the coast water-lined as the old charts are (rings
// of fainter ink round every shore), a compass rose. The place is under a wax seal with its name; the day's earlier places are
// numbered dots on a dotted track. Between meetings the chart flies from the last place to the next, drawing back for a long hop
// (at once for reduced motion). Strokes keep their width at any zoom (non-scaling-stroke); the land is one path, drawn three times
// by <use> for the water-lining.
const NS = "http://www.w3.org/2000/svg";
const make = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};
let landD = null;
/** The world's land as one path in degrees (x east, y south), made once. */
async function land() {
  if (!landD) {
    const { LAND } = await import("./world.js");
    landD = LAND.map(poly => poly.map(ring => `M${ring.map(([x, y]) => `${x} ${-y}`).join("L")}Z`).join("")).join("");
  }
  return landD;
}
const GRID = (() => {
  let d = "";
  for (let x = -180; x <= 180; x += 10) d += `M${x} -85V85`;
  for (let y = -80; y <= 80; y += 10) d += `M-180 ${y}H180`;
  return d;
})();
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let made = 0;

/** A wax seal: a blot with a scalloped edge, a ring pressed in it, and a number or a dot. */
function seal(parent, r, label) {
  const g = make("g", { class: "dp-seal" }, parent);
  let d = "";
  for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = r * (1 + 0.07 * Math.sin(k * 2.5) + 0.05 * Math.cos(k * 4.1)); d += `${k ? "L" : "M"}${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`; }
  make("path", { d: `${d}Z`, class: "dp-wax" }, g);
  make("circle", { r: r * 0.66, class: "dp-press" }, g);
  if (label != null) { const t = make("text", { class: "dp-seal-n", "text-anchor": "middle", dy: "0.35em" }, g); t.textContent = label; }
  return g;
}

/** A note's number under a small wax seal, as the day's chart numbers its places (an inline SVG). */
export function sealMark(n) {
  const svg = make("svg", { class: "dp-note-seal", viewBox: "-12 -12 24 24", "aria-hidden": "true" });
  seal(svg, 10.5, n);
  return svg;
}

/**
 * A chart in `host` (which it fills). show(places, mode): places in the day's order, each { lat, lon, name, n }; "read" centres on
 * the last (the meeting being read) under a seal, the ones before it numbered dots on the track; "day" frames them all, each under
 * its own numbered seal with its name.
 */
export function createChart(host) {
  const id = `dp-land-${++made}`, svg = make("svg", { class: "dp-chart-svg", role: "img" });
  host.append(svg);
  make("rect", { class: "dp-sea", x: 0, y: 0, width: "100%", height: "100%" }, svg);
  const defs = make("defs", {}, svg), shape = make("path", { id, "vector-effect": "non-scaling-stroke" }, defs);
  const world = make("g", {}, svg);
  make("path", { d: GRID, class: "dp-grid", "vector-effect": "non-scaling-stroke" }, world);
  // the water-lining: each ring a wide stroke of line colour with a narrower one of sea over it, leaving a hairline at that distance
  // from the shore; then the coast, half of a stroke under the land, so the borders between countries (the land is theirs) don't show
  for (const k of ["far", "sea-far", "near", "sea-near", "coast"]) make("use", { href: `#${id}`, class: `dp-wl dp-wl-${k}` }, world);
  make("use", { href: `#${id}`, class: "dp-land" }, world);
  const over = make("g", {}, svg);
  // the compass rose, in a corner, still
  const rose = make("g", { class: "dp-rose" }, svg);
  const star = (len, w, rot) => make("path", { d: `M0 ${-len}L${w} 0L0 ${len}L${-w} 0Z`, transform: `rotate(${rot})` }, rose);
  star(15, 3.2, 45); star(19, 3.8, 0); star(19, 3.8, 90);
  make("circle", { r: 3.2, class: "dp-rose-hub" }, rose);
  const north = make("text", { y: -22, "text-anchor": "middle", class: "dp-rose-n" }, rose);
  north.textContent = "N";
  land().then(d => shape.setAttribute("d", d));

  let W = 1, H = 1, view = null, target = null, flight = null, raf = 0, places = [], mode = "read";
  const project = (v, lat, lon) => { const sx = v.s * Math.cos(v.lat * Math.PI / 180); return [W / 2 + (lon - v.lon) * sx, H / 2 - (lat - v.lat) * v.s]; };
  /** The view for the places: the last one in the middle at a region's scale, or all of them framed. */
  function viewFor() {
    if (!places.length) return { lat: 30, lon: 10, s: H / 120 };
    if (mode === "read") { const p = places[places.length - 1]; return { lat: Math.max(-60, Math.min(70, p.lat)), lon: p.lon, s: H / 28 }; }
    const lats = places.map(p => p.lat), lons = places.map(p => p.lon), lat = (Math.min(...lats) + Math.max(...lats)) / 2, lon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const c = Math.cos(lat * Math.PI / 180), s = Math.min(H / (Math.max(...lats) - Math.min(...lats) + 14), W / ((Math.max(...lons) - Math.min(...lons) + 18) * c), H / 20);
    return { lat, lon, s };
  }
  /** Where a place's name goes: to the right of its mark, else the left, above or below, the first spot clear of the names and
   *  marks already placed and inside the chart; nowhere (the number says it) when none is. */
  function spot(x, y, r, name, taken) {
    const w = name.length * 10 + 8, h = 13;                     // capitals at .74rem, spaced .14em: about 10 px a letter
    const tries = [[x + r + 4, y - h / 2, "start"], [x - r - 4 - w, y - h / 2, "end"], [x - w / 2, y - r - 4 - h, "middle"], [x - w / 2, y + r + 4, "middle"]];
    for (const [bx, by, anchor] of tries) {
      if (bx < 4 || by < 4 || bx + w > W - 4 || by + h > H - 4) continue;
      if (taken.some(t => bx < t[0] + t[2] && t[0] < bx + w && by < t[1] + t[3] && t[1] < by + h)) continue;
      taken.push([bx, by, w, h]);
      return { x: anchor === "start" ? bx - x : anchor === "end" ? bx + w - x : 0, y: by + h - 2.5 - y, anchor };
    }
    return null;
  }
  function draw(v) {
    const sx = v.s * Math.cos(v.lat * Math.PI / 180);
    world.setAttribute("transform", `matrix(${sx} 0 0 ${v.s} ${W / 2 - v.lon * sx} ${H / 2 + v.lat * v.s})`);
    over.replaceChildren();
    if (!places.length) return;
    const at = places.map(p => project(v, p.lat, p.lon)), taken = at.map(([x, y]) => [x - 11, y - 11, 22, 22]);
    if (at.length > 1) make("polyline", { points: at.map(p => p.map(n => n.toFixed(1)).join(",")).join(" "), class: "dp-track" }, over);
    places.forEach((p, i) => {
      const [x, y] = at[i], last = i === places.length - 1, g = make("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, over);
      if (mode === "read" && !last) { make("circle", { r: 4, class: "dp-dot" }, g); const t = make("text", { x: 7, y: -6, class: "dp-dot-n" }, g); t.textContent = p.n; return; }
      const r = mode === "read" ? 12 : 10;
      seal(g, r, mode === "read" ? null : p.n).classList.toggle("dp-stamp", mode === "read" && !flight);
      const put = spot(x, y, r, p.name, taken);
      if (put) { const label = make("text", { x: put.x.toFixed(1), y: put.y.toFixed(1), "text-anchor": put.anchor, class: "dp-place-name" }, g); label.textContent = p.name; }
    });
  }
  function frame(now) {
    raf = 0;
    if (!flight) return;
    const t = Math.min(1, (now - flight.t0) / flight.ms), e = ease(t), a = flight.from, b = flight.to;
    const back = 1 + flight.out * Math.sin(Math.PI * t);
    view = { lat: a.lat + (b.lat - a.lat) * e, lon: a.lon + (b.lon - a.lon) * e, s: (a.s + (b.s - a.s) * e) / back };
    if (t >= 1) { flight = null; view = b; }
    draw(view);
    if (flight) raf = requestAnimationFrame(frame);
  }
  function show(list, how = "read") {
    places = list; mode = how;
    target = viewFor();
    const hop = view ? Math.hypot((target.lon - view.lon) * Math.cos(target.lat * Math.PI / 180), target.lat - view.lat) : 0;
    if (!view || still() || hop < 0.5 || how !== "read") { flight = null; view = target; draw(view); return; }
    flight = { t0: performance.now(), ms: Math.min(1600, 700 + hop * 12), from: view, to: target, out: Math.min(3, hop / 18) };
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    W = r.width; H = r.height;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    rose.setAttribute("transform", `translate(${W - 28} ${36})`);
    if (places.length) { target = viewFor(); if (!flight) { view = target; draw(view); } else flight.to = target; }
  }
  const watch = new ResizeObserver(resize);
  watch.observe(host);
  resize();
  return { el: host, show, destroy() { watch.disconnect(); cancelAnimationFrame(raf); } };
}
