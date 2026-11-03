// The chart on the desk, drawn on a canvas 2D: engraved linework on parchment, the graticule with its two scales (the side scale in
// minutes of latitude is the nautical mile; the foot scale in minutes of longitude is shorter by the cosine of the latitude, which is
// the longitude trap), the invented coast, banks and harbour, the pencilled track, the fog as an ellipse, the line of position, the
// dividers and the course to steer. Pure drawing from a scene: no state, no clock.
import { ellipse, vec } from "./landfall-model.js";
import { fromLatLon } from "./landfall-sky.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200];     // arcminutes between graticule lines

/** A camera that holds all the given points (nm) with a margin in px; px per nm is kept between lo and hi. */
export function fitCamera(points, w, h, margin = 28, lo = 0.8, hi = 60) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = clamp(Math.min((w - 2 * margin) / Math.max(1e-6, x1 - x0), (h - 2 * margin) / Math.max(1e-6, y1 - y0)), lo, hi);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s };
}
/** Points around an ellipse (nm) to put in a camera. */
export function ellipsePoints(c, P, k = 2.45) {
  const e = ellipse(P, k), a = e.angle * Math.PI / 180, out = [];
  for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6, x = e.rx * Math.cos(t), y = e.ry * Math.sin(t); out.push([c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)]); }
  return out;
}
export const toScreen = (cam, w, h, p) => [w / 2 + (p[0] - cam.cx) * cam.s, h / 2 - (p[1] - cam.cy) * cam.s];
export const toWorld = (cam, w, h, x, y) => [cam.cx + (x - w / 2) / cam.s, cam.cy - (y - h / 2) / cam.s];

/** The chart's colours, read from the page's custom properties (the scene has its own palette; the page's chrome follows the theme). */
export function palette(el) {
  const cs = getComputedStyle(el), v = (n, d) => cs.getPropertyValue(n).trim() || d;
  return {
    paper: v("--lf-paper", "#e6d8b6"), ink: v("--lf-ink", "#33291c"), pencil: v("--lf-pencil", "#6b5b45"), land: v("--lf-land", "#d4c08a"),
    fog: v("--lf-fog", "#1f6f6a"), brass: v("--lf-brass", "#a07a2c"), blood: v("--lf-blood", "#a8382b"), glow: v("--lf-glow", "255,196,120"),
    mono: v("--lf-mono", 'ui-monospace, "SF Mono", Menlo, monospace'), serif: v("--lf-serif", 'Georgia, "Times New Roman", serif'),
  };
}

function ellipsePath(ctx, c, P, cam, w, h, k = 2.45) {
  const e = ellipse(P, k), [x, y] = toScreen(cam, w, h, c);
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(2, e.rx * cam.s), Math.max(2, e.ry * cam.s), -e.angle * Math.PI / 180, 0, 6.283);
}
function label(ctx, text, x, y, size, pal, { italic = false, align = "center", halo = true, color } = {}) {
  ctx.font = `${italic ? "italic " : ""}${size}px ${pal.serif}`; ctx.textAlign = align; ctx.textBaseline = "middle";
  if (halo) { ctx.lineWidth = 3; ctx.strokeStyle = pal.paper; ctx.globalAlpha = 0.8; ctx.strokeText(text, x, y); ctx.globalAlpha = 1; }
  ctx.fillStyle = color || pal.ink; ctx.fillText(text, x, y);
}

/**
 * Draws the chart. `sc`: { L (the level), cam, k (px scale), pal, t (s), trail: [{ k, p }], E, P, ghost: { E, P } | null, lop: { y, t } | null,
 * dividers: { from, course, d } | null, steer: { course, forecast: { E, P } } | null, end: { truth: [[x, y]], T } | null, here: [x, y] }.
 */
export function drawChart(ctx, w, h, sc) {
  const { L, cam, pal } = sc, k = sc.k || 1, S = p => toScreen(cam, w, h, p);
  ctx.fillStyle = pal.paper; ctx.fillRect(0, 0, w, h);
  const wb = toWorld(cam, w, h, 0, h), wt = toWorld(cam, w, h, w, 0);          // the chart's corners: west-south, east-north
  const o = L.origin;
  // the sea: faint horizontal wave strokes
  ctx.save(); ctx.strokeStyle = pal.pencil; ctx.globalAlpha = 0.07; ctx.lineWidth = 1;
  for (let y = 10; y < h; y += 22 * k) { ctx.beginPath(); for (let x = ((y * 7) % 40); x < w; x += 40 * k) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10 * k, y - 3 * k, x + 20 * k, y); } ctx.stroke(); }
  ctx.restore();
  // the graticule: parallels are straight, meridians lean a little (a minute of longitude is cos(latitude) of a mile, and the latitude changes)
  const minLat =STEPS.find(s => s * cam.s >= 46 * k) || 1200;
  ctx.save(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.28;
  const lat0 = o.lat * 60 + wb[1], lat1 = o.lat * 60 + wt[1];
  for (let a = Math.ceil(lat0 / minLat) * minLat; a <= lat1; a += minLat) {
    const y = S([0, a - o.lat * 60])[1]; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const midLat = o.lat + (wb[1] + wt[1]) / 120, cosm = Math.cos(midLat * Math.PI / 180), minLon = STEPS.find(s => s * cosm * cam.s >= 46 * k) || 1200;
  const lonA = (o.lon + wb[0] / (60 * cosm)) * 60, lonB = (o.lon + wt[0] / (60 * cosm)) * 60;
  const lons = [];
  for (let a = Math.ceil(lonA / minLon) * minLon - minLon; a <= lonB + minLon; a += minLon) {
    lons.push(a);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const lat = o.lat + (wb[1] + (wt[1] - wb[1]) * i / 6) / 60, p = S(fromLatLon(o, lat, a / 60)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
  }
  ctx.restore();
  // the land, engraved: hatched, with a few lines of shore printed into the water
  for (const poly of L.land || []) {
    const path = new Path2D();
    poly.forEach((p, i) => { const q = S(p); i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]); });
    path.closePath();
    ctx.save();
    ctx.fillStyle = pal.land; ctx.fill(path);
    ctx.clip(path);
    ctx.strokeStyle = pal.ink; ctx.globalAlpha = 0.2; ctx.lineWidth = 1;
    for (let d = -h; d < w + h; d += 7 * k) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    const sea = new Path2D(); sea.rect(0, 0, w, h); sea.addPath(path);
    ctx.clip(sea, "evenodd");
    for (const [lw, al] of [[11, 0.07], [7, 0.1], [3.5, 0.14]]) { ctx.lineWidth = lw * k; ctx.globalAlpha = al; ctx.strokeStyle = pal.ink; ctx.stroke(path); }
    ctx.restore();
    ctx.lineWidth = 1.6 * k; ctx.strokeStyle = pal.ink; ctx.lineJoin = "round"; ctx.stroke(path);
  }
  // the banks
  for (const s of L.shoals || []) {
    const [x, y] = S([s.x, s.y]), r = Math.max(4 * k, s.r * cam.s);
    if (x < -r - 40 || x > w + r + 40 || y < -r - 20 || y > h + r + 20) continue;
    ctx.save(); ctx.strokeStyle = pal.blood; ctx.fillStyle = pal.blood; ctx.lineWidth = 1.2 * k; ctx.setLineDash([2.5 * k, 3 * k]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 0.65;
    for (let i = 0; i < 7; i++) { const a = i * 2.4 + s.x, rr = r * 0.62 * Math.sqrt(((i * 37) % 7) / 7 + 0.1), px = x + rr * Math.cos(a), py = y + rr * Math.sin(a); ctx.fillRect(px - 0.9 * k, py - 0.9 * k, 1.8 * k, 1.8 * k); }
    ctx.restore();
    label(ctx, s.name, x, y + r + 9 * k, 10.5 * k, pal, { italic: true, color: pal.blood });
  }
  // the harbour: its approach, and an anchor
  if (L.harbour) {
    const H = L.harbour, [x, y] = S([H.x, H.y]), r = H.r * cam.s;
    ctx.save(); ctx.strokeStyle = pal.brass; ctx.lineWidth = 1.2 * k; ctx.setLineDash([5 * k, 4 * k]); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6 * k; ctx.lineCap = "round";
    const u = 7 * k;
    ctx.beginPath(); ctx.moveTo(0, -u); ctx.lineTo(0, u); ctx.moveTo(-u * 0.55, -u * 0.55); ctx.lineTo(u * 0.55, -u * 0.55); ctx.moveTo(-u * 0.8, u * 0.25); ctx.quadraticCurveTo(0, u * 1.35, u * 0.8, u * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -u * 1.25, u * 0.28, 0, 6.283); ctx.stroke(); ctx.restore();
    label(ctx, H.name, x, y - Math.max(r, 16 * k) - 8 * k, 12.5 * k, pal, { italic: true });
  }
  // the scales, on the edges: minutes of latitude down the side, minutes of longitude along the foot
  ctx.save(); ctx.fillStyle = pal.ink; ctx.strokeStyle = pal.ink; ctx.lineWidth = 1; ctx.font = `${9.5 * k}px ${pal.mono}`;
  ctx.fillStyle = pal.paper; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, 38 * k, h); ctx.fillRect(0, h - 15 * k, w, 15 * k); ctx.globalAlpha = 1; ctx.fillStyle = pal.ink;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  for (let a = Math.ceil(lat0 / minLat) * minLat; a <= lat1; a += minLat) {
    const y = S([0, a - o.lat * 60])[1]; if (y < 8 || y > h - 18 * k) continue;
    ctx.beginPath(); ctx.moveTo(34 * k, y); ctx.lineTo(38 * k, y); ctx.stroke(); ctx.fillText(minLat >= 60 ? `${Math.round(a / 60)}°` : `${Math.floor(a / 60)}°${String(Math.round(a % 60)).padStart(2, "0")}′`, 2 * k, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  for (const a of lons) {
    const x = S(fromLatLon(o, o.lat + wb[1] / 60, a / 60))[0]; if (x < 44 * k || x > w - 16 * k) continue;
    ctx.beginPath(); ctx.moveTo(x, h - 15 * k); ctx.lineTo(x, h - 11 * k); ctx.stroke(); ctx.fillText(minLon >= 60 ? `${Math.round(a / 60)}°` : `${Math.floor(a / 60 + 1e-9)}°${String(Math.round(((a % 60) + 60) % 60)).padStart(2, "0")}′`, x, h - 2 * k);
  }
  ctx.restore();
  // a compass rose, small, in the corner
  ctx.save(); ctx.translate(w - 24 * k, 26 * k); ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, 12 * k, 0, 6.283); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -17 * k); ctx.lineTo(3.5 * k, 0); ctx.lineTo(0, 5 * k); ctx.lineTo(-3.5 * k, 0); ctx.closePath(); ctx.fill();
  ctx.font = `700 ${9 * k}px ${pal.serif}`; ctx.textAlign = "center"; ctx.fillText("N", 0, -19 * k); ctx.restore();

  // the fog: where the ship may be, 95 in 100
  const fogAt = (c, P, a) => {
    const e = ellipse(P), [x, y] = S(c), rr = Math.max(8 * k, Math.max(e.rx, e.ry) * cam.s);
    ctx.save();
    ellipsePath(ctx, c, P, cam, w, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, pal.fog + "cc"); g.addColorStop(1, pal.fog + "44");
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fill();
    ctx.globalAlpha = Math.min(1, a + 0.25); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = pal.fog; ctx.setLineDash([6 * k, 4 * k]); ctx.stroke();
    ctx.restore();
  };
  if (sc.ghost) { ctx.save(); ctx.globalAlpha = 0.5; fogAt(sc.ghost.E, sc.ghost.P, 0.28); ctx.restore(); }
  if (sc.P && sc.E) fogAt(sc.E, sc.P, 0.5);
  // the line of position: a latitude, drawn in across the chart
  if (sc.lop) {
    const y = S([0, sc.lop.y])[1], x1 = w * clamp(sc.lop.t, 0, 1);
    ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = pal.brass; ctx.lineWidth = 2.4 * k;
    ctx.shadowColor = `rgba(${pal.glow},.8)`; ctx.shadowBlur = 8 * k;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.restore();
  }
  // the line of position from the clock: a meridian, which leans a little with the chart's latitude, drawn in from the foot
  if (sc.lopLon) {
    const n = 8, upTo = Math.round(n * clamp(sc.lopLon.t, 0, 1));
    ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = pal.brass; ctx.lineWidth = 2.4 * k;
    ctx.shadowColor = `rgba(${pal.glow},.8)`; ctx.shadowBlur = 8 * k;
    ctx.beginPath();
    for (let i = 0; i <= upTo; i++) { const lat = o.lat + (wb[1] + (wt[1] - wb[1]) * i / n) / 60, p = S(fromLatLon(o, lat, sc.lopLon.lon)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke(); ctx.restore();
  }
  // the pencilled track and its marks
  if (sc.trail?.length) {
    ctx.save(); ctx.strokeStyle = pal.pencil; ctx.lineWidth = 1.5 * k; ctx.lineJoin = "round";
    ctx.beginPath(); sc.trail.forEach((t, i) => { const q = S(t.p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.stroke(); ctx.restore();
    for (const t of sc.trail) {
      const [x, y] = S(t.p);
      ctx.save(); ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink; ctx.lineWidth = 1.5 * k;
      if (t.k === "fix") { const u = 5.5 * k; ctx.beginPath(); ctx.moveTo(x, y - u); ctx.lineTo(x + u, y); ctx.lineTo(x, y + u); ctx.lineTo(x - u, y); ctx.closePath(); ctx.fill(); }
      else if (t.k === "start") { const u = 5 * k; ctx.beginPath(); ctx.moveTo(x - u, y - u); ctx.lineTo(x + u, y + u); ctx.moveTo(x - u, y + u); ctx.lineTo(x + u, y - u); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, 3.8 * k, 0, 6.283); ctx.stroke(); }
      ctx.restore();
    }
  }
  // the dividers of the ritual: a line along the course, open to the distance
  if (sc.dividers) {
    const D = sc.dividers, v = vec(D.course), q = [D.from[0] + v[0] * D.d, D.from[1] + v[1] * D.d], a = S(D.from), b = S(q);
    // the course, ruled across the chart (so the distance has a line to be measured along)
    const far = S([D.from[0] + v[0] * Math.hypot(w, h) / cam.s, D.from[1] + v[1] * Math.hypot(w, h) / cam.s]);
    ctx.save(); ctx.strokeStyle = pal.ink; ctx.globalAlpha = 0.4; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(far[0], far[1]); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.4 * k; ctx.setLineDash([3 * k, 3 * k]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = pal.paper; ctx.lineWidth = 2 * k; for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p[0], p[1], 5 * k, 0, 6.283); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    label(ctx, `${D.d.toFixed(1)} nm`, (a[0] + b[0]) / 2 + 12 * k * v[1], (a[1] + b[1]) / 2 + 12 * k * v[0], 11 * k, pal, { color: pal.ink });
  }
  // the course to steer, and where it should leave the fog at the next twilight
  if (sc.steer && sc.E) {
    const v = vec(sc.steer.course), a = S(sc.E), len = Math.hypot(w, h);
    ctx.save(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6 * k; ctx.setLineDash([8 * k, 5 * k]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + v[0] * len, a[1] - v[1] * len); ctx.stroke(); ctx.restore();
    if (sc.steer.forecast) { ctx.save(); fogAt(sc.steer.forecast.E, sc.steer.forecast.P, 0.18); ctx.restore(); const q = S(sc.steer.forecast.E); label(ctx, "next twilight", q[0], q[1] - 14 * k, 10.5 * k, pal, { italic: true }); }
  }
  // the ending: where the ship truly went
  if (sc.end) {
    ctx.save(); ctx.strokeStyle = pal.blood; ctx.lineWidth = 2 * k; ctx.setLineDash([2 * k, 4 * k]); ctx.lineCap = "round";
    ctx.beginPath(); sc.end.truth.forEach((p, i) => { const q = S(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.setLineDash([]);
    const [x, y] = S(sc.end.T), u = 7 * k; ctx.fillStyle = pal.blood;
    ctx.beginPath(); ctx.moveTo(x, y - u); ctx.lineTo(x + u * 0.7, y + u * 0.8); ctx.lineTo(x - u * 0.7, y + u * 0.8); ctx.closePath(); ctx.fill(); ctx.restore();
    label(ctx, "where you were", x, y + 17 * k, 10.5 * k, pal, { italic: true, color: pal.blood });
  }
  // the estimate: a pencil cross where the reckoning puts the ship
  if (sc.E && !sc.end) {
    const [x, y] = S(sc.E); ctx.save(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6 * k;
    ctx.beginPath(); ctx.moveTo(x - 7 * k, y); ctx.lineTo(x + 7 * k, y); ctx.moveTo(x, y - 7 * k); ctx.lineTo(x, y + 7 * k); ctx.stroke(); ctx.restore();
  }
  // lamplight: the chart is darker toward its corners
  const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.8);
  vg.addColorStop(0, `rgba(${pal.glow},0)`); vg.addColorStop(1, "rgba(20,12,4,.34)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}
