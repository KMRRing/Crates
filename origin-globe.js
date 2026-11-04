// Origin's globe: Chart's world from space, with countries painted on it and tapped. The camera, turning and zooming are
// Chart's own (chart-globe.js, imported); the land is Chart's shared world (world.js, chart-islands.js) and the outlines
// of the countries are chart-countries.js. Chart's drawGlobe lives inside chart.js (a page, not importable), so its
// drawing is copied here, minus the regions and detail coastlines Origin has no use for, with the countries laid over the land.
// A view is chart-globe.js's { lon, lat, a }. No page here: origin.js owns the canvas, the touches and the colours.
import { camera, A_MIN, A_MAX } from "./chart-globe.js";
import { projection, viewWindow, merc } from "./chart-engine.js";
import { LAND, BORDERS } from "./world.js";
import { ISLANDS, ISLAND_DOTS } from "./chart-islands.js";
import { COUNTRIES } from "./chart-countries.js";

const RAD = Math.PI / 180, TAU = 2 * Math.PI;
const SPECK = 1.7;                       // an island too small to draw is a speck this big (as Chart's)
const LABEL_PX = 34;                     // a country's name shows once it is this wide on screen
const TINY_PX = 18, TOUCH_PX = 16, DOT_PX = 7;   // a country narrower than this is tapped by its middle, from this far off (over land, from a dot's width)
export { A_MIN, A_MAX };

const ISLAND_BOX = ISLANDS.map(([ring]) => { const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });
// each country: its id, outline, the box of each ring (a tap tests only the rings it might be in) and its widest ring's width in degrees
const LANDS = COUNTRIES.map(c => {
  const boxes = (c.rings || []).map(r => { const xs = r.map(p => p[0]), ys = r.map(p => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });
  return { id: c.about || c.id, name: c.name, lon: c.lon, lat: c.lat, rings: c.rings || [], boxes, wide: Math.max(0, ...boxes.map(b => b[1] - b[0])), high: Math.max(0, ...boxes.map(b => b[3] - b[2])) };
});
const BY_ID = new Map(LANDS.map(l => [l.id, l]));

/** The camera for a w × h box: Chart's, on the shorter side, so the whole globe fits and a zoom shows more along the longer one. */
export function cameraFor(view, w, h) {
  const size = Math.min(w, h), cam = camera(view, size), ox = (w - size) / 2, oy = (h - size) / 2;
  return { cam, ox, oy, w, h, pxPerRad: cam.R, away: cam.away, toXY: (lon, lat) => { const p = cam.toXY(lon, lat); return p && [p[0] + ox, p[1] + oy]; }, toLonLat: (x, y) => cam.toLonLat(x - ox, y - oy) };
}
/** Battery saver's flat map, as Chart's: Mercator through chart-engine.js's projection, a view { lon, my, span }; it traces shapes and lines as the globe's camera does, so one drawing serves both. */
export function flatFor(view, w, h) {
  const win = viewWindow(view, w, h), proj = projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h);
  const trace = (t, pts) => pts.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) t.moveTo(x, y); else t.lineTo(x, y); });
  const cam = { ...proj, shape: (t, ring) => { trace(t, ring); t.closePath(); return true; }, edge: (t, pts, closed = false) => { trace(t, pts); if (closed) t.closePath(); }, away: () => 0 };
  return { cam, ox: 0, oy: 0, w, h, flat: true, win, pxPerRad: w / (view.span * RAD), away: () => 0, toXY: proj.toXY, toLonLat: proj.toLonLat };
}
const cameraOf = (view, w, h, flat) => (flat ? flatFor(view, w, h) : cameraFor(view, w, h));
/** How wide, in screen pixels, a country is across its widest ring (foreshortened towards the edge of the globe). */
function pixelsAcross(l, cam) {
  const away = cam.away(l.lon, l.lat);
  if (away > 88) return 0;
  return Math.max(l.wide * Math.max(0.2, Math.cos(l.lat * RAD)), l.high) * RAD * cam.pxPerRad * Math.cos(away * RAD);
}
/** Whether a place is inside a country's outline (the rings together, so a hole is a hole). */
function inside(l, lon, lat) {
  let n = 0;
  l.rings.forEach((r, k) => {
    const b = l.boxes[k];
    if (lon < b[0] || lon > b[1] || lat < b[2] || lat > b[3]) return;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) n++;
    }
  });
  return n % 2 === 1;
}
/**
 * The country under a tap at (x, y) in the box, or null. A country too small to tap inside is tapped by its middle
 * (a finger's width round it); a tap in the sea takes the nearest such country, if one is that close.
 */
export function pick(view, w, h, x, y, flat = false) {
  const g = cameraOf(view, w, h, flat), spot = g.toLonLat(x, y);
  const hit = spot && LANDS.find(l => inside(l, spot[0], spot[1]));
  if (hit && pixelsAcross(hit, g) < TINY_PX) return hit.id;
  let near = null, best = hit ? DOT_PX : TOUCH_PX;     // inside a big country, only the middle of a small one beats it
  for (const l of LANDS) {
    if (l === hit || pixelsAcross(l, g) >= TINY_PX) continue;
    const p = g.toXY(l.lon, l.lat), d = p ? Math.hypot(p[0] - x, p[1] - y) : Infinity;
    if (d < best) { best = d; near = l; }
  }
  return (near || hit)?.id ?? null;
}
/** The view that shows a country: its middle and a width that holds its widest ring (never closer than `least` degrees across). */
export function viewOf(id, least = 14, flat = false) {
  const l = BY_ID.get(id);
  if (flat) return { lon: l.lon, my: merc(l.lat), span: Math.min(360, Math.max(30, l.wide * 1.8)) };
  const reach = Math.max(l.wide * Math.max(0.2, Math.cos(l.lat * RAD)), l.high, least) / 2 * 1.45;
  return { lon: l.lon, lat: Math.max(-85, Math.min(85, l.lat)), a: Math.max(A_MIN, Math.min(A_MAX, reach)) };
}


/** The countries with a colour, painted over the land: warmth fills, the answer, the one named (outlined, and a dot for a small one so it shows). */
function paintCountries(ctx, g, paint, css) {
  const { cam } = g, outline = new Path2D(), dots = [];
  const paintCountry = (id, colour, alpha = 1) => {
    const l = BY_ID.get(id);
    if (!l) return;
    const fill = new Path2D();
    let seen = false;
    for (const ring of l.rings) if (cam.shape(fill, ring)) seen = true;
    if (!seen) return;
    ctx.globalAlpha = alpha; ctx.fillStyle = colour; ctx.fill(fill, "evenodd"); ctx.globalAlpha = 1;
    if (pixelsAcross(l, g) < TINY_PX) { const p = cam.toXY(l.lon, l.lat); if (p) dots.push([p, colour]); }
  };
  for (const [id, colour] of paint.fills || []) paintCountry(id, colour);
  if (paint.answer) paintCountry(paint.answer, css("--ch-good"));
  if (paint.chosen) {
    paintCountry(paint.chosen, css("--brass"), 0.55);
    for (const ring of BY_ID.get(paint.chosen)?.rings || []) cam.edge(outline, ring, true);
  }
  return { outline, dots };
}
/** Names, widest country first, none over another, once a country is wide enough on screen. */
function drawNames(ctx, g, css) {
  const { cam } = g;
  ctx.font = "600 10px Archivo, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  const taken = [];
  for (const l of LANDS.map(l => [l, pixelsAcross(l, g)]).filter(([, px]) => px >= LABEL_PX).sort((p, q) => q[1] - p[1]).map(([l]) => l)) {
    const p = cam.toXY(l.lon, l.lat);
    if (!p || g.away(l.lon, l.lat) > 75) continue;
    const half = ctx.measureText(l.name).width / 2 + 2, box = [p[0] - half, p[0] + half, p[1] - 7, p[1] + 7];
    if (taken.some(t => box[0] < t[1] && box[1] > t[0] && box[2] < t[3] && box[3] > t[2])) continue;
    taken.push(box);
    ctx.strokeStyle = css("--ch-land"); ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.strokeText(l.name, p[0], p[1]);
    ctx.globalAlpha = 1; ctx.fillStyle = css("--ink"); ctx.fillText(l.name, p[0], p[1]);
  }
}
/** The flat map (battery saver): sea, land, coasts, borders, a graticule once close, then the countries and names, as Chart's flat map. */
export function drawFlat(ctx, w, h, view, paint, css) {
  const g = flatFor(view, w, h), { cam, win } = g, span = win.lon1 - win.lon0;
  ctx.fillStyle = css("--ch-sea"); ctx.fillRect(0, 0, w, h);
  const land = new Path2D(), coast = new Path2D(), specks = new Path2D();
  for (const poly of LAND) for (const ring of poly) { cam.shape(land, ring); cam.shape(coast, ring); }
  const speck = (lon, lat) => { const [x, y] = cam.toXY(lon, lat); specks.moveTo(x + SPECK, y); specks.arc(x, y, SPECK, 0, TAU); };
  ISLANDS.forEach((poly, k) => {
    const b = ISLAND_BOX[k];
    if (b[1] < win.lon0 - 1 || b[0] > win.lon1 + 1 || b[3] < win.lat0 - 1 || b[2] > win.lat1 + 1) return;
    const [ax, ay] = cam.toXY(b[0], b[2]), [bx, by] = cam.toXY(b[1], b[3]);
    if (Math.max(Math.abs(bx - ax), Math.abs(by - ay)) < 2 * SPECK) { if (poly[1]) speck((b[0] + b[1]) / 2, (b[2] + b[3]) / 2); return; }
    cam.shape(land, poly[0]); cam.shape(coast, poly[0]);
  });
  for (const [lon, lat] of ISLAND_DOTS) if (lon >= win.lon0 - 1 && lon <= win.lon1 + 1 && lat >= win.lat0 - 1 && lat <= win.lat1 + 1) speck(lon, lat);
  ctx.fillStyle = css("--ch-land"); ctx.fill(land, "evenodd"); ctx.fill(specks);
  const { outline, dots } = paintCountries(ctx, g, paint, css);
  ctx.strokeStyle = css("--ch-coast"); ctx.lineJoin = "round";
  ctx.lineWidth = span > 100 ? 1.1 : 1.5; ctx.stroke(coast); ctx.lineWidth = 1; ctx.stroke(specks);
  ctx.strokeStyle = css("--ch-border"); ctx.lineWidth = span > 100 ? 0.6 : 1.1;
  ctx.beginPath();
  for (const l of BORDERS) cam.edge(ctx, l);
  ctx.stroke();
  if (span <= 60) {
    const step = span > 30 ? 5 : span > 12 ? 2 : 1;
    ctx.strokeStyle = css("--ch-grid"); ctx.lineWidth = 1; ctx.beginPath();
    for (let lon = Math.ceil(win.lon0 / step) * step; lon <= win.lon1; lon += step) { const [x] = cam.toXY(lon, 0); ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let lat = Math.ceil(win.lat0 / step) * step; lat <= win.lat1; lat += step) { const [, y] = cam.toXY(0, lat); ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
  if (paint.chosen) { ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.stroke(outline); }
  for (const [[x, y], colour] of dots) { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fillStyle = colour; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = css("--ink"); ctx.stroke(); }
  drawNames(ctx, g, css);
}

/**
 * Draws the globe into a w × h context: the sea, land, borders and graticule in Chart's colours (--ch-*), then the
 * countries in `paint` ({ fills: Map id -> colour, chosen: id, answer: id }), then the names of those big enough.
 * `css(name)` reads a colour from the page.
 */
export function draw(ctx, w, h, view, paint, css) {
  const g = cameraFor(view, w, h), { cam } = g, { R } = cam, size = cam.size, a = view.a, span = 2 * a;
  ctx.fillStyle = css("--ch-space");
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(g.ox, g.oy);
  const disc = () => { ctx.beginPath(); ctx.arc(cam.cx, cam.cy, R, 0, TAU); };
  if (R < size / 2) {                                          // the whole near side in view: its atmosphere
    ctx.strokeStyle = css("--ch-in"); ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.3 - i * 0.07; ctx.beginPath(); ctx.arc(cam.cx, cam.cy, R + 1 + i * 2, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  disc(); ctx.fillStyle = css("--ch-sea"); ctx.fill();
  ctx.save(); disc(); ctx.clip();
  const land = new Path2D(), isles = new Path2D(), coast = new Path2D(), specks = new Path2D();
  for (const poly of LAND) for (const ring of poly) if (cam.shape(land, ring)) cam.edge(coast, ring, true);
  const speck = (lon, lat) => { const p = cam.toXY(lon, lat); if (p) { specks.moveTo(p[0] + SPECK, p[1]); specks.arc(p[0], p[1], SPECK, 0, TAU); } };
  ISLANDS.forEach((poly, k) => {
    const b = ISLAND_BOX[k], lon = (b[0] + b[1]) / 2, lat = (b[2] + b[3]) / 2;
    if (cam.away(lon, lat) > 100) return;
    if (Math.max((b[1] - b[0]) * Math.cos(lat * RAD), b[3] - b[2]) * RAD * R < 2 * SPECK) { if (poly[1]) speck(lon, lat); return; }   // a coastal islet waits until it's big enough
    if (cam.shape(isles, poly[0])) cam.edge(coast, poly[0], true);
  });
  for (const [lon, lat] of ISLAND_DOTS) speck(lon, lat);
  ctx.fillStyle = css("--ch-land");
  ctx.fill(land, "evenodd"); ctx.fill(isles); ctx.fill(specks);
  // the countries with a colour, over the land and under the coasts and borders
  const { outline, dots } = paintCountries(ctx, g, paint, css);
  ctx.strokeStyle = css("--ch-coast"); ctx.lineJoin = "round";
  ctx.lineWidth = span > 100 ? 1.1 : 1.5; ctx.stroke(coast);
  ctx.lineWidth = 1; ctx.stroke(specks);
  // the graticule, only where it is in view
  const step = a > 45 ? 30 : a > 18 ? 10 : a > 7 ? 5 : a > 2.5 ? 2 : 1, ds = Math.max(0.25, Math.min(3, a / 8));
  const lonReach = Math.min(180, a * 2 / Math.max(0.1, Math.cos(view.lat * RAD)) + step), latReach = Math.min(90, a * 2 + step);
  const grid = new Path2D();
  for (let lon = Math.ceil((view.lon - lonReach) / step) * step; lon <= view.lon + lonReach; lon += step) {
    const pts = []; for (let lat = Math.max(-90, view.lat - latReach); lat <= Math.min(90, view.lat + latReach); lat += ds) pts.push([lon, lat]);
    cam.edge(grid, pts);
  }
  for (let lat = Math.ceil(Math.max(-90, view.lat - latReach) / step) * step; lat <= Math.min(90, view.lat + latReach); lat += step) {
    const pts = []; for (let lon = view.lon - lonReach; lon <= view.lon + lonReach; lon += ds) pts.push([lon, lat]);
    cam.edge(grid, pts);
  }
  ctx.strokeStyle = css("--ch-grid"); ctx.lineWidth = 1; ctx.stroke(grid);
  ctx.strokeStyle = css("--ch-border");
  ctx.lineWidth = span > 100 ? 0.8 : 1.1;
  ctx.beginPath();
  for (const l of BORDERS) cam.edge(ctx, l);
  ctx.stroke();
  if (paint.chosen) { ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.stroke(outline); }
  for (const [[x, y], colour] of dots) {
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fillStyle = colour; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = css("--ink"); ctx.stroke();
  }
  const shade = ctx.createRadialGradient(cam.cx, cam.cy, 0, cam.cx, cam.cy, R);          // darkening towards the edge, so it reads as a ball
  shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(0.6, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.42)");
  ctx.fillStyle = shade; ctx.fillRect(-g.ox, -g.oy, w, h);
  ctx.restore();
  if (R < size * 0.7) { disc(); ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1; ctx.stroke(); }
  drawNames(ctx, g, css);
  ctx.restore();
}
