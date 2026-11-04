// Carrack's globe on the page: a canvas for the world (carrack-globe.js) under an SVG of lanes, ports, fleets and names, a
// drag that turns the Earth, a pinch or wheel that closes in, a tap that picks the nearest port. The page tells it what
// stands where (a model, below) and is told which port was tapped; the rules never come here.
//
// The model: { lanes: [lane], ports: [{ i, name, lon, lat, lab, value, ring, cls, fill, free, fort, items: [{ kind, n, fill }] }] }.
import { camera, drawWorld, laneLine, turn, zoom, frame, between, HOME, A_MIN, A_MAX, WATERS } from "./carrack-globe.js";
import { scale } from "./wide.js";

const NS = "http://www.w3.org/2000/svg";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const CHAR_W = 5.0, NAME_H = 8.5, TAP = 15, PAD = 30;
const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A name's box beside a dot at (x, y), by the side `at` (e w n s ne nw se sw). */
function boxAt(x, y, w, at) {
  const g = 5.6, h = NAME_H;
  switch (at) {
    case "e": return { x: x + g, y: y - h / 2, w, h };
    case "w": return { x: x - g - w, y: y - h / 2, w, h };
    case "n": return { x: x - w / 2, y: y - g - h, w, h };
    case "s": return { x: x - w / 2, y: y + g, w, h };
    case "ne": return { x: x + 1, y: y - g - h, w, h };
    case "nw": return { x: x - 1 - w, y: y - g - h, w, h };
    case "se": return { x: x + 1, y: y + g, w, h };
    default: return { x: x - 1 - w, y: y + g, w, h };
  }
}
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function createGlobe(host, { onTap }) {
  const canvas = document.createElement("canvas"), svg = document.createElementNS(NS, "svg");
  canvas.className = "cr-world";
  svg.setAttribute("class", "cr-over");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "The globe: 36 ports from the Baltic to Japan. Drag to turn it, pinch to zoom.");
  host.append(canvas, svg);
  const ctx = canvas.getContext("2d");
  let view = { ...HOME }, model = null, raf = 0, tween = 0, size = { w: 0, h: 0, k: 1, dpr: 1 }, shown = [];
  const pointers = new Map();
  let moved = false, pinched = false, last = null;

  // ---- sizes: a box in CSS pixels, drawn in logical units (a tablet draws larger, as the rest of the page does)
  function fit() {
    const cw = host.clientWidth, ch = host.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!cw || !ch) return false;
    // names and chips keep the size a phone gives them against the globe: a bigger box (a tablet, a screen held sideways) draws them larger
    const k = Math.round(scale() * Math.max(1, Math.min(1.7, Math.min(cw, 1.3 * ch) / 380)) * 100) / 100;
    if (cw !== size.cw || ch !== size.ch || k !== size.k || dpr !== size.dpr) {
      size = { cw, ch, k, dpr, w: cw / k, h: ch / k };
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      svg.setAttribute("viewBox", `0 0 ${size.w.toFixed(1)} ${size.h.toFixed(1)}`);
    }
    return true;
  }
  const palette = () => {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    return { space: v("--cr-space"), sea: v("--cr-globe-sea"), shallows: v("--cr-shallows"), land: v("--cr-land"), coast: v("--cr-coast"), grid: v("--cr-grid"), rim: v("--cr-rim"), air: v("--cr-air") };
  };
  const pathOf = () => { let d = ""; return { moveTo: (x, y) => { d += `M${x.toFixed(1)} ${y.toFixed(1)}`; }, lineTo: (x, y) => { d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }, get d() { return d; } }; };
  const textW = s => s.length * CHAR_W;

  function paint() {
    raf = 0;
    if (!model || !fit()) return;
    const { w, h, k, dpr } = size, cam = camera(view, w, h);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    drawWorld(ctx, cam, view, palette());
    shown = [];
    // lanes: a faint halo under all of them so they read on sea and land alike, then each by its kind
    const halo = pathOf(), lanes = [];
    for (const l of model.lanes) {
      const pts = laneLine(l), one = pathOf();
      cam.edge(one, pts);
      if (!one.d) continue;
      cam.edge(halo, pts);
      let mark = "";
      if (l.f.includes("p")) { const m = cam.toXY(...pts[pts.length >> 1]); if (m) mark = `<text class="cr-pir" x="${m[0].toFixed(1)}" y="${(m[1] + 2.4).toFixed(1)}" text-anchor="middle">×</text>`; }
      lanes.push(`<path class="cr-lane${[...l.f].map(c => " f" + c).join("")}" d="${one.d}"/>${mark}`);
    }
    let s = `<path class="cr-halo" d="${halo.d}"/>${lanes.join("")}`;
    // ports in view; the ones nearest the middle are drawn last, on top
    const seen = [];
    for (const p of model.ports) {
      const xy = cam.toXY(p.lon, p.lat);
      if (xy) seen.push({ p, x: xy[0], y: xy[1], away: cam.away(p.lon, p.lat) });
    }
    // what is already on the page, so a name finds a free place: every dot and every chip
    const taken = [];
    for (const q of seen) {
      taken.push({ x: q.x - 4.6, y: q.y - 4.6, w: 9.2, h: 9.2 });
      q.chips = q.p.items.length ? { x: q.x - (q.p.items.length * 8.5 - 1.5) / 2, y: q.y + 6, w: q.p.items.length * 8.5 - 1.5, h: 7 } : null;
      if (q.chips) taken.push(q.chips);
    }
    // names: the ones that matter first (a port you picked or can reach, then your pieces, then the dearest ports), each on
    // the first side with room, and none at all when there is none (zoom in and it appears)
    const rank = q => (q.p.ring ? 0 : 1) * 1e3 + (q.p.items.length ? 0 : 100) + (4 - Math.min(3, q.p.value)) * 10 + q.p.i / 100;
    const inBox = b => b.x >= 1 && b.y >= 1 && b.x + b.w <= w - 1 && b.y <= h - NAME_H - 1;
    const placed = [], names = new Map();
    for (const q of seen.filter(q => q.away < 84).sort((a, b) => rank(a) - rank(b))) {
      const wd = textW(q.p.name), sides = [q.p.lab, ...["e", "w", "n", "s", "ne", "nw", "se", "sw"].filter(x => x !== q.p.lab)];
      for (const at of sides) {
        const b = boxAt(q.x, q.y, wd, at);
        if (!inBox(b) || placed.some(o => hit(b, o))) continue;
        const own = taken.filter(o => !(Math.abs(o.x + o.w / 2 - q.x) < 5 && Math.abs(o.y + o.h / 2 - q.y) < 5));   // not this port's own dot
        if (own.some(o => hit(b, o))) continue;
        placed.push(b); names.set(q.p.i, b);
        break;
      }
    }
    // the seas and oceans, faint, in what room is left
    let waters = "";
    for (const [name, lon, lat, big] of WATERS) {
      if (big ? view.a > 50 : view.a < 16) continue;
      const xy = cam.toXY(lon, lat);
      if (!xy || cam.away(lon, lat) > 66) continue;
      const wd = name.length * 6.4, b = { x: xy[0] - wd / 2, y: xy[1] - 5, w: wd, h: 10 };
      if (b.x < 2 || b.x + b.w > w - 2 || placed.some(o => hit(b, o)) || taken.some(o => hit(b, o))) continue;
      waters += `<text class="cr-water${big ? " big" : ""}" x="${xy[0].toFixed(1)}" y="${(xy[1] + 3).toFixed(1)}" text-anchor="middle">${name}</text>`;
    }
    s += waters;
    for (const q of seen.sort((a, b) => b.away - a.away)) {
      const { p, x, y } = q, xy = [x.toFixed(1), y.toFixed(1)], edge = q.away > 76;
      shown.push({ i: p.i, x, y });
      s += `<g class="cr-port ${p.cls}${edge ? " rim" : ""}">`;
      if (p.ring === "reach") s += `<circle class="cr-ring" cx="${xy[0]}" cy="${xy[1]}" r="8"/>`;
      if (p.ring === "on") s += `<circle class="cr-ring on" cx="${xy[0]}" cy="${xy[1]}" r="8"/>`;
      if (p.fort) s += `<rect class="cr-fort" x="${(x - 5.6).toFixed(1)}" y="${(y - 5.6).toFixed(1)}" width="11.2" height="11.2"/>`;
      s += `<circle class="cr-dotp${p.free ? " free" : ""}" cx="${xy[0]}" cy="${xy[1]}" r="3.6"${p.free ? "" : ` style="fill:${p.fill}"`}/>`;
      const nb = names.get(p.i);
      if (nb) s += `<text class="cr-gname" x="${nb.x.toFixed(1)}" y="${(nb.y + 6.3).toFixed(1)}">${esc(p.name)}</text>`;
      if (q.chips) {
        p.items.forEach((it, j) => {
          const x0 = q.chips.x + j * 8.5, y0 = q.chips.y;
          if (it.kind === "fleet") s += `<rect class="cr-chip" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="7" height="7" style="fill:${it.fill}"/><text class="cr-n" x="${(x0 + 3.5).toFixed(1)}" y="${(y0 + 5.7).toFixed(1)}" text-anchor="middle">${it.n}</text>`;
          else s += `<path class="cr-fac" d="M${(x0 + 3.5).toFixed(1)} ${(y0 - .2).toFixed(1)}l3.7 3.7l-3.7 3.7l-3.7 -3.7z" style="fill:${it.fill}"/>`;
        });
      }
      s += `</g>`;
    }
    svg.innerHTML = s;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };

  // ---- the view
  const stop = () => { if (tween) { cancelAnimationFrame(tween); tween = 0; } };
  function goTo(target, ms = 480) {
    stop();
    if (quiet() || !fit()) { view = target; schedule(); return; }
    const from = view, t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms), e = t * t * (3 - 2 * t);
      view = between(from, target, e);
      schedule();
      tween = t < 1 ? requestAnimationFrame(step) : 0;
    };
    tween = requestAnimationFrame(step);
  }
  /** Whether every point ([lon, lat]) is comfortably on the near side and inside the box. */
  function visible(points) {
    if (!fit()) return true;
    const cam = camera(view, size.w, size.h);
    return points.every(([lon, lat]) => { const xy = cam.toXY(lon, lat); return xy && cam.away(lon, lat) < 72 && xy[0] > PAD && xy[0] < size.w - PAD && xy[1] > PAD && xy[1] < size.h - PAD; });
  }
  /** Brings the points into view: untouched when they already are (unless `force`), else turned and closed in on them. */
  function focus(points, force = false) {
    if (!points.length || (!force && visible(points))) return;
    goTo(frame(points, 34));
  }

  // ---- touches: one finger turns the globe, two close in or out, a tap picks a port
  const tapAt = (cx, cy) => {
    const r = host.getBoundingClientRect(), x = (cx - r.left) / size.k, y = (cy - r.top) / size.k;
    let best = null, bd = TAP * TAP;
    for (const q of shown) { const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; best = q.i; } }
    onTap(best);
  };
  host.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    stop();
    host.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (pointers.size === 1) { moved = false; pinched = false; }
    else pinched = true;
    last = null;
  });
  host.addEventListener("pointermove", e => {
    const p = pointers.get(e.pointerId);
    if (!p || !fit()) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (pointers.size === 1) {
      if (!moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
      moved = true;
      view = turn(view, dx / size.k, dy / size.k, size.w, size.h);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], before = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (before > 10) view = zoom(view, after / before);
      moved = true;
    }
    p.x = e.clientX; p.y = e.clientY;
    schedule();
  });
  const lift = e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (e.type === "pointerup" && !moved && !pinched && !pointers.size) tapAt(e.clientX, e.clientY);
  };
  host.addEventListener("pointerup", lift);
  host.addEventListener("pointercancel", lift);
  host.addEventListener("wheel", e => {
    e.preventDefault();
    stop();
    view = zoom(view, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0016)));
    schedule();
  }, { passive: false });
  new ResizeObserver(schedule).observe(host);

  return {
    render(m) { model = m; schedule(); },
    reset() { goTo({ ...HOME }); },
    focus, visible,
    get view() { return view; },
    set view(v) { stop(); view = v; schedule(); },
    get shown() { return shown; },
    zoomBy(f) { goTo(zoom(view, f), 220); },
    limits: [A_MIN, A_MAX],
  };
}
