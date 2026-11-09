// Crossing's sea rules, pure (crossing.js draws them; tests/crossing-sea.mjs runs them). A shipment goes from one place to
// another by water: first the port that serves each end (an inland place reaches one by river or road, a port is its own),
// then the lane from the loading port's water to the discharge port's. Everything costs in one unit, a nautical mile of
// steaming: sea miles as they are, a canal's toll on top, an inland kilometre dearer (road 2.5, barge 0.8) and 150 to change
// from land to ship at each inland end. The score is how near the whole cost is to the cheapest one that exists.
import { WATERS, LANES, TOLLS, PORTS, INLAND } from "./crossing-sea-data.js";

export const ROUTES = 5;
export const LEVELS = ["easy", "medium", "hard"];
export const ROAD = 2.5, BARGE = 0.8, TRANSHIP = 150, FULL = 100, SLOPE = 150;   // score: 100 less 1.5 points per 1% over the cheapest
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the graph ----------
const rad = d => d * Math.PI / 180;
/** Great-circle nautical miles. */
export function nm(lon1, lat1, lon2, lat2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export const waters = Object.entries(WATERS).map(([id, [name, lon, lat, kind]]) => ({ id, name, lon, lat, kind: kind || "sea" }));
const WATER = new Map(waters.map(w => [w.id, w]));
export const water = id => WATER.get(id) || null;
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const NEXT = new Map(waters.map(w => [w.id, []]));
export const lanes = LANES.map(([a, b]) => {
  const A = WATER.get(a), B = WATER.get(b);
  if (!A || !B) throw new Error(`lane ${a}-${b}: unknown water`);
  const lane = { a, b, dist: Math.round(nm(A.lon, A.lat, B.lon, B.lat)), toll: TOLLS[key(a, b)] ?? TOLLS[`${a}-${b}`] ?? TOLLS[`${b}-${a}`] ?? 0 };
  NEXT.get(a).push({ to: b, ...lane }); NEXT.get(b).push({ to: a, ...lane });
  return lane;
});
/** The lanes leaving a water: [{ to, dist, toll }], with the cost of taking each (dist + toll). */
export const lanesFrom = id => (NEXT.get(id) || []).map(l => ({ to: l.to, dist: l.dist, toll: l.toll, cost: l.dist + l.toll }));
export const laneCost = (a, b) => { const l = NEXT.get(a)?.find(x => x.to === b); return l ? l.dist + l.toll : null; };

/** Cheapest cost and path (waters, both ends included) between two waters; Dijkstra, ties to the alphabetically first.
 *  `closed`: waters nobody can pass (a strait shut), for a scenario. */
const cache = new Map();
function from(source, closed = []) {
  const ck = `${source}|${[...closed].sort()}`;
  if (cache.has(ck)) return cache.get(ck);
  const shut = new Set(closed), cost = new Map([[source, 0]]), prev = new Map(), done = new Set();
  for (;;) {
    let at = null;
    for (const [id, c] of cost) if (!done.has(id) && (at === null || c < cost.get(at) || (c === cost.get(at) && id < at))) at = id;
    if (at === null) break;
    done.add(at);
    for (const l of NEXT.get(at)) {
      if (shut.has(l.to)) continue;
      const c = cost.get(at) + l.dist + l.toll;
      if (!cost.has(l.to) || c < cost.get(l.to) - 1e-9 || (Math.abs(c - cost.get(l.to)) < 1e-9 && at < prev.get(l.to))) { cost.set(l.to, c); prev.set(l.to, at); }
    }
  }
  const out = { cost, prev };
  cache.set(ck, out);
  return out;
}
export function cheapest(a, b, closed = []) {
  const { cost, prev } = from(a, closed);
  if (!cost.has(b)) return null;
  const path = [b];
  while (path[0] !== a) path.unshift(prev.get(path[0]));
  return { cost: cost.get(b), path };
}
/** What a list of waters costs to sail in order (null when two in a row aren't joined by a lane). */
export function sailCost(path) {
  let sum = 0;
  for (let i = 1; i < path.length; i++) { const c = laneCost(path[i - 1], path[i]); if (c === null) return null; sum += c; }
  return sum;
}
/** Sea miles only (no tolls) along a path. */
export const sailDistance = path => path.slice(1).reduce((s, w, i) => s + (laneCost(path[i], w) - (NEXT.get(path[i]).find(x => x.to === w).toll)), 0);

// ---------- ports and places ----------
export const ports = PORTS.map(([name, country, lon, lat, wid, river = 0]) => {
  const w = WATER.get(wid);
  if (!w) throw new Error(`port ${name}: unknown water ${wid}`);
  return { name, country, lon, lat, water: wid, river, approach: Math.round(nm(lon, lat, w.lon, w.lat) + river) };
});
const PORT = new Map(ports.map(p => [p.name, p]));
export const portOf = name => PORT.get(name) || null;
const INLAND_BY = new Map(INLAND.map(([name, country, lon, lat, via]) => [name, { name, country, lon, lat, inland: true, via }]));
/** Every place a shipment can start or end: the ports, and the inland places that reach them. */
export const places = [...ports.map(p => ({ name: p.name, country: p.country, lon: p.lon, lat: p.lat, inland: false })), ...INLAND_BY.values()];
const PLACE = new Map(places.map(p => [p.name, p]));
export const placeOf = name => PLACE.get(name) || null;
/** The ports that serve a place, each with what getting there costs: [{ port, km, mode, cost }]. A port serves itself, free. */
export function candidates(name) {
  const p = INLAND_BY.get(name);
  if (!p) return PORT.has(name) ? [{ port: name, km: 0, mode: "port", cost: 0 }] : [];
  return p.via.map(([port, km, mode]) => ({ port, km, mode, cost: Math.round(km * (mode === "barge" ? BARGE : ROAD)) + TRANSHIP }));
}
const candOf = (place, port) => candidates(place).find(c => c.port === port) || null;

/** The cheapest whole shipment between two places: { cost, load, discharge, path (waters) }. */
export function best(fromPlace, toPlace, closed = []) {
  let top = null;
  for (const a of candidates(fromPlace)) for (const b of candidates(toPlace)) {
    const A = PORT.get(a.port), B = PORT.get(b.port), sea = cheapest(A.water, B.water, closed);
    if (!sea) continue;
    const cost = a.cost + A.approach + sea.cost + B.approach + b.cost;
    if (!top || cost < top.cost - 1e-9 || (Math.abs(cost - top.cost) < 1e-9 && `${a.port}|${b.port}` < `${top.load}|${top.discharge}`)) top = { cost, load: a.port, discharge: b.port, path: sea.path };
  }
  return top;
}

// ---------- a deal ----------
// Easy: port to port. Medium: one end inland. Hard: both. Never two places in one country, and the sea between them long
// enough (4+ lanes on the best path) to have somewhere to go wrong.
const KINDS = { easy: [false, false], medium: [true, false], hard: [true, true] };
export function dealRun(seed, level = "medium", ok = () => true) {
  // `ok(country)`: the region; at least one end in it (a region with few ports can't have both), and everywhere if that fails
  const run = anywhere => {
  const r = rng(seed), [inA, inB] = KINDS[level] || KINDS.medium, used = new Set(), out = [];
  const pool = inland => places.filter(p => p.inland === inland);
  const tries = r() < 0.5 ? [inA, inB] : [inB, inA];     // which end is inland in a medium shipment varies
  let guard = 0;
  while (out.length < ROUTES && guard++ < 4000) {
    const A = shuffle(r, pool(tries[0]))[0], B = shuffle(r, pool(tries[1]))[0];
    if (!A || !B || used.has(A.name) || used.has(B.name) || A.country === B.country || (!anywhere && !ok(A.country) && !ok(B.country))) continue;
    const top = best(A.name, B.name);
    if (!top || top.path.length < 5 || top.load === top.discharge) continue;
    out.push({ from: A.name, to: B.name, best: Math.round(top.cost) });
    used.add(A.name); used.add(B.name);
  }
  return out;
  };
  let routes = run(false);
  if (routes.length < ROUTES) routes = run(true);
  return { level, seed, routes };
}

// ---------- a shipment in play ----------
/** A shipment begun. A place with one port (a port itself) has it chosen already. */
export function begin({ from, to }) {
  const route = { from, to, load: null, discharge: null, path: [], over: false, gaveUp: false };
  return settle(route);
}
function settle(route) {
  const r = { ...route };
  const one = name => { const c = candidates(name); return c.length === 1 ? c[0].port : null; };
  if (!r.load && one(r.from)) r.load = one(r.from);
  if (r.load && !r.discharge && one(r.to)) r.discharge = one(r.to);
  if (r.load && r.discharge && !r.path.length) {
    r.path = [PORT.get(r.load).water];
    if (r.path[0] === PORT.get(r.discharge).water) r.over = true;
  }
  return r;
}
/** What the player has to do next: "load", "discharge", "sail" or "done". */
export const stageOf = route => (route.over ? "done" : !route.load ? "load" : !route.discharge ? "discharge" : "sail");
export const waterNow = route => route.path.at(-1) ?? null;
/** The port served: loading first, then discharge. Returns the route after, with `note` ("loaded", "discharged", "no"). */
export function pick(route, port) {
  const stage = stageOf(route);
  if (stage !== "load" && stage !== "discharge") return { ...route, note: "no" };
  if (!candOf(stage === "load" ? route.from : route.to, port)) return { ...route, note: "no" };
  const after = settle({ ...route, [stage]: port });
  return { ...after, note: stage === "load" ? "loaded" : "discharged" };
}
/** Sail on to a water joined to this one by a lane; reaching the discharge port's water ends the shipment. */
export function sail(route, to) {
  if (stageOf(route) !== "sail") return { ...route, note: "closed" };
  const at = waterNow(route);
  if (to === at) return { ...route, note: "again" };
  if (laneCost(at, to) === null) return { ...route, note: "no lane" };
  const path = [...route.path, to];
  return { ...route, path, over: to === PORT.get(route.discharge).water, note: "sailed" };
}
/** One step back: a water of the lane, else the last choice made by hand. Costs nothing. */
export function back(route) {
  if (route.over && !route.gaveUp && route.path.length > 1) return route;     // a finished shipment stays finished
  if (route.over || stageOf(route) === "done") return route;
  if (route.path.length > 1) return { ...route, path: route.path.slice(0, -1) };
  const sole = name => candidates(name).length === 1;
  if (route.discharge && !sole(route.to)) return { ...route, discharge: null, path: [] };
  if (route.load && !sole(route.from)) return { ...route, load: null, discharge: sole(route.to) ? null : route.discharge, path: [] };
  return route;
}
export const giveUp = route => ({ ...route, over: true, gaveUp: true });
/** The cost of the shipment so far (the whole of it once over). Null until a port is chosen. */
export function costOf(route) {
  if (!route.load) return null;
  const A = candOf(route.from, route.load), pa = PORT.get(route.load);
  let sum = A.cost + pa.approach + (sailCost(route.path) ?? 0);
  if (route.over && !route.gaveUp) { const B = candOf(route.to, route.discharge); sum += PORT.get(route.discharge).approach + B.cost; }
  return sum;
}
/** Points: 100 for the cheapest shipment there is, 1.5 off for each 1% dearer, nothing for a shipment given up. */
export function scoreOf(route, cheapestCost = best(route.from, route.to).cost) {
  if (route.gaveUp || !route.over) return 0;
  return Math.max(0, Math.round(FULL - SLOPE * (costOf(route) / cheapestCost - 1)));
}
/** A shipment at the cheapest cost. */
export const clean = route => route.over && !route.gaveUp && costOf(route) <= best(route.from, route.to).cost + 0.5;
export const totalOf = routes => routes.reduce((s, r) => s + scoreOf(r), 0);
