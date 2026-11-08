// Crossing's sea, on the page: what the map shows of a shipment (the lanes, the waters, the ports to choose between, the way
// sailed and, at the end, the cheapest way), the buttons for the next choice and what the player's tap meant. The rules are
// crossing-sea-engine.js's; crossing.js owns the canvas, the run and the page and calls these.
import { waters, water, lanes, lanesFrom, portOf, placeOf, candidates, stageOf, waterNow, costOf, best, scoreOf } from "./crossing-sea-engine.js";

const num = n => Math.round(n).toLocaleString("en");
const MODE = { barge: "river barge", road: "road" };

/** The points a shipment's map should show: the places and, at a choice, the ports to choose between. */
export function viewPoints(route) {
  const a = placeOf(route.from), b = placeOf(route.to), stage = stageOf(route);
  const pts = pick => pick.map(p => ({ lon: p.lon, lat: p.lat }));
  if (stage === "load") return pts([a, ...candidates(route.from).map(c => portOf(c.port))]);
  if (stage === "discharge") return pts([b, ...candidates(route.to).map(c => portOf(c.port))]);
  const l = route.load && portOf(route.load), d = route.discharge && portOf(route.discharge);
  return pts([l || a, d || b]);
}

/** The cheapest shipment for the end screen, in words: the ports and the named waters between them. */
export function cheapestWords(route) {
  const top = best(route.from, route.to);
  const named = top.path.map(id => water(id)).filter(w => w.kind !== "sea").map(w => w.name);
  return `${top.load} › ${named.length ? `${named.join(" › ")} › ` : ""}${top.discharge}`;
}

/** What the page's strip says of a shipment. */
export function trailText(route) {
  const stage = stageOf(route);
  if (stage === "load") return `Which port loads at ${route.from}?`;
  if (stage === "discharge") return `Which port serves ${route.to}?`;
  const parts = [`Load ${route.load}`, `discharge ${route.discharge}`];
  return stage === "done" ? (route.gaveUp ? "Given up" : parts.join(" · ")) : `At ${water(waterNow(route)).name}`;
}

/** The choice's buttons: { label, sub, disabled, act } where act is { port } or { water }. On hard the costs stay hidden. */
export function options(route, level) {
  const stage = stageOf(route), hide = level === "hard";
  if (stage === "load" || stage === "discharge") {
    const place = stage === "load" ? route.from : route.to;
    return candidates(place).map(c => ({
      label: c.port, sub: `${MODE[c.mode]} ${num(c.km)} km${hide ? "" : ` · ${num(c.cost)}`}`, act: { port: c.port },
    }));
  }
  if (stage !== "sail") return [];
  const seen = new Set(route.path);
  return lanesFrom(waterNow(route)).sort((x, y) => water(x.to).name.localeCompare(water(y.to).name)).map(l => {
    const w = water(l.to), tag = w.kind === "canal" ? "canal" : w.kind === "strait" ? "strait" : w.kind === "cape" ? "cape" : "";
    const sub = hide ? tag : `${num(l.dist)} nm${l.toll ? ` + ${num(l.toll)} toll` : ""}${tag ? ` · ${tag}` : ""}`;
    return { label: w.name, sub, disabled: seen.has(l.to), act: { water: l.to } };
  });
}

/** The lines of text under the map when a shipment is over, and while sailing the running cost. */
export function summary(route, level) {
  const stage = stageOf(route);
  if (stage === "done") {
    const top = best(route.from, route.to);
    if (route.gaveUp) return [`Cheapest: ${num(top.cost)}`, cheapestWords(route)];
    const got = costOf(route), pts = scoreOf(route, top.cost);
    return [`${num(got)} against the cheapest ${num(top.cost)}: ${pts} points`, `Cheapest: ${cheapestWords(route)}`];
  }
  if (stage === "sail" && level !== "hard") return [`Cost so far ${num(costOf(route))}`];
  return [];
}

// ---------- the map ----------
/** Where a tap landed: the nearest button's target within reach, as the same `act` the buttons carry. */
export function tapTarget(route, level, p, x, y, reach = 30) {
  const stage = stageOf(route);
  const at = (lon, lat) => { const [px, py] = p.toXY(lon, lat); return Math.hypot(px - x, py - y); };
  let top = null, dist = reach;
  if (stage === "load" || stage === "discharge") {
    for (const c of candidates(stage === "load" ? route.from : route.to)) { const q = portOf(c.port), d = at(q.lon, q.lat); if (d < dist) { dist = d; top = { port: c.port }; } }
  } else if (stage === "sail") {
    const seen = new Set(route.path);
    for (const l of lanesFrom(waterNow(route))) { const w = water(l.to), d = at(w.lon, w.lat); if (!seen.has(l.to) && d < dist) { dist = d; top = { water: l.to }; } }
  }
  return top;
}

/** Draws the lanes, waters, ports and the way sailed on the map (the land is already there). `k` scales type and strokes. */
export function draw(ctx, p, win, route, level, css, k) {
  const stage = stageOf(route), over = stage === "done";
  const ink = css("--cx-ink"), trail = css("--cx-trail"), goal = css("--cx-goal"), border = css("--cx-border");
  const inView = (lon, lat, m = 6) => lon >= win.lon0 - m && lon <= win.lon1 + m && lat >= win.lat0 - m && lat <= win.lat1 + m;
  const xy = w => p.toXY(w.lon, w.lat);
  /** A line between two points; across the date line it is two stubs, so it doesn't run the long way round the map. */
  const line = (a, b, style, width, dash = []) => {
    ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath();
    if (Math.abs(a.lon - b.lon) > 180) {
      const shift = a.lon > b.lon ? 360 : -360;
      ctx.moveTo(...xy(a)); ctx.lineTo(...p.toXY(b.lon + shift, b.lat));
      ctx.moveTo(...xy(b)); ctx.lineTo(...p.toXY(a.lon - shift, a.lat));
    } else { ctx.moveTo(...xy(a)); ctx.lineTo(...xy(b)); }
    ctx.stroke(); ctx.setLineDash([]);
  };
  const label = (text, [x, y], { bold = false, colour = ink, dy = -9 } = {}) => {
    ctx.font = `${bold ? "700 " : ""}${Math.round((bold ? 11 : 10) * k)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = colour; ctx.fillText(text, x, y + dy);
  };
  const dot = (pt, r, fill, ring) => {
    ctx.beginPath(); ctx.arc(pt[0], pt[1], r * k, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 1.6; ctx.stroke(); }
  };
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  // the lanes, faint; a canal's in the brass of the mark
  ctx.globalAlpha = 0.55;
  for (const l of lanes) {
    const a = water(l.a), b = water(l.b);
    if (!inView(a.lon, a.lat, 30) && !inView(b.lon, b.lat, 30)) continue;
    line(a, b, l.toll ? css("--brass") || goal : border, l.toll ? 2.2 : 1);
  }
  ctx.globalAlpha = 1;

  // the best way, shown at the end
  if (over) {
    const top = best(route.from, route.to);
    for (let i = 1; i < top.path.length; i++) line(water(top.path[i - 1]), water(top.path[i]), goal, 3, [7, 5]);
  }
  // the way sailed
  for (let i = 1; i < route.path.length; i++) line(water(route.path[i - 1]), water(route.path[i]), trail, 3.2);

  // the waters: a speck each, the straits a little more
  for (const w of waters) { if (inView(w.lon, w.lat)) dot(xy(w), w.kind === "sea" ? 1.8 : 2.6, w.kind === "sea" ? border : ink); }

  // the places and ports
  const a = placeOf(route.from), b = placeOf(route.to);
  const portDot = (name, colour, bold) => { const q = portOf(name); const pt = xy(q); dot(pt, 4.2, colour, ink); label(name, pt, { bold }); };
  if (stage === "load" || stage === "discharge") {
    const place = stage === "load" ? a : b, cs = candidates(stage === "load" ? route.from : route.to);
    for (const c of cs) { const q = portOf(c.port); line(place, q, ink, 1.2, [3, 4]); }
    for (const c of cs) portDot(c.port, css("--cx-near"), true);
  }
  if (route.load) portDot(route.load, trail, false);
  if (route.discharge) portDot(route.discharge, goal, false);
  // the two ends: a square where the cargo starts, a diamond where it is bound
  const start = xy(a), end = xy(b);
  ctx.fillStyle = trail; ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
  ctx.fillRect(start[0] - 5 * k, start[1] - 5 * k, 10 * k, 10 * k); ctx.strokeRect(start[0] - 5 * k, start[1] - 5 * k, 10 * k, 10 * k);
  ctx.beginPath(); ctx.moveTo(end[0], end[1] - 7 * k); ctx.lineTo(end[0] + 6 * k, end[1]); ctx.lineTo(end[0], end[1] + 7 * k); ctx.lineTo(end[0] - 6 * k, end[1]); ctx.closePath();
  ctx.fillStyle = goal; ctx.fill(); ctx.stroke();
  label(a.name, start, { bold: true, dy: -10 * k });
  label(b.name, end, { bold: true, dy: -11 * k });

  // where the ship is, and where it can go next
  if (stage === "sail") {
    const now = water(waterNow(route)), seen = new Set(route.path);
    for (const l of lanesFrom(now.id)) {
      if (seen.has(l.to)) continue;
      const w = water(l.to), pt = xy(w);
      dot(pt, 5.5, css("--cx-near"), trail); label(w.name, pt, { colour: ink });
    }
    dot(xy(now), 7, trail, ink); label(now.name, xy(now), { bold: true, colour: ink, dy: 18 * k });
  }
  ctx.lineCap = "butt";
}
