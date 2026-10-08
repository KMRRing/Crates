// Harbour's regions on squares: a region at about 11 km a square. The player builds road, rail and pipeline square by
// square and places depots; hires ships, trucks and trains, each a shuttle between two places along what was built; and
// pipelines flow between the places they join. A domestic plant can feed a terminal at the pace of the player's own plan
// for a harbour level (Rundown): the region prices that harbour's speed. The month runs hour by hour: towns draw their
// station tanks and pay for what they draw, a unit they can't have costs a penalty, and the month's change in stock is
// valued at its cheapest cost, so nothing is gained by ending it full. Pure: no page, no clock. (Solvers: the level lab.)
const MAIN = [[20.95, 55.0], [21.05, 55.4], [21.13, 55.71], [21.07, 55.92], [21.0, 56.51], [21.18, 56.89], [21.56, 57.39], [22.0, 57.6], [22.59, 57.76], [22.8, 57.5], [23.2, 57.2], [23.6, 56.97], [24.1, 57.02], [24.4, 57.26], [24.36, 57.75], [24.45, 58.1], [24.5, 58.38], [24.0, 58.3], [23.51, 58.57], [23.54, 58.94], [23.68, 59.22], [24.05, 59.35], [24.4, 59.47], [24.75, 59.44], [24.96, 59.5], [25.7, 59.58], [26.53, 59.5], [27.2, 59.45], [27.76, 59.4], [28.04, 59.46], [28.4, 59.4], [28.4, 55.0]];
const ISLANDS = [[[21.85, 58.32], [22.2, 58.55], [22.65, 58.6], [23.25, 58.55], [23.35, 58.36], [22.95, 58.2], [22.55, 58.12], [22.2, 57.95], [22.05, 57.91], [22.0, 58.15]], [[22.05, 58.95], [22.45, 59.08], [22.9, 59.0], [22.95, 58.8], [22.55, 58.72], [22.2, 58.8]], [[23.1, 58.66], [23.3, 58.7], [23.35, 58.58], [23.15, 58.55]]];
const FINLAND = [[20.0, 60.4], [21.5, 60.3], [22.4, 60.05], [22.95, 59.82], [23.6, 59.98], [24.4, 60.1], [24.95, 60.15], [25.66, 60.3], [26.4, 60.4], [26.94, 60.45], [27.8, 60.5], [28.4, 60.6], [28.4, 61], [20.0, 61]];
const PEIPUS = [[27.05, 58.95], [27.6, 58.98], [27.9, 58.75], [27.85, 58.35], [27.55, 57.98], [27.35, 58.15], [27.1, 58.55]];
const inside = ([x, y], poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

export const WATER = 0, LAND = 1, OFF = 2;   // a square: sea or lake; land to build on; land out of play (Finland, over the border)
const RUNDOWN = [                                              // plans for Rundown, each with the best month it allows here
  { name: "One Handy", hours: 49, ships: {handy: 1}, note: "misses Rundown's window", best: 342.6,
    plan: {"built":{"road":[],"rail":[186,185,184,183,182,181,180,179,468,440,412,384,356,328,300,272,244,216,188,187],"pipe":[206]},"vehicles":[{"type":"handy","from":"klaipeda","to":"muuga","start":10},{"type":"handy","from":"klaipeda","to":"muuga","start":25},{"type":"handy","from":"klaipeda","to":"muuga","start":40},{"type":"handy","from":"klaipeda","to":"muuga","start":55},{"type":"train","from":"muuga","to":"rakvere","start":0},{"type":"train","from":"muuga","to":"tartu","start":0}],"flows":[{"from":"muuga","to":"tallinn"}]} },
  { name: "Two coasters", hours: 39, ships: {coaster: 2}, note: "Rundown's cost star", best: 398.6,
    plan: {"built":{"road":[],"rail":[186,185,184,183,182,181,180,179,468,440,412,384,356,328,300,272,244,216,188,187],"pipe":[206]},"vehicles":[{"type":"handy","from":"klaipeda","to":"muuga","start":0},{"type":"handy","from":"klaipeda","to":"muuga","start":20},{"type":"handy","from":"klaipeda","to":"muuga","start":40},{"type":"train","from":"muuga","to":"rakvere","start":0},{"type":"train","from":"muuga","to":"tartu","start":0}],"flows":[{"from":"muuga","to":"tallinn"}]} },
  { name: "A Handy and a coaster", hours: 36, ships: {handy: 1, coaster: 1}, best: 393.4,
    plan: {"built":{"road":[],"rail":[186,185,184,183,182,181,180,179,468,440,412,384,356,328,300,272,244,216,188,187],"pipe":[206]},"vehicles":[{"type":"handy","from":"klaipeda","to":"muuga","start":10},{"type":"handy","from":"klaipeda","to":"muuga","start":30},{"type":"handy","from":"klaipeda","to":"muuga","start":50},{"type":"train","from":"muuga","to":"rakvere","start":0},{"type":"train","from":"muuga","to":"tartu","start":0}],"flows":[{"from":"muuga","to":"tallinn"}]} },
  { name: "Three coasters", hours: 31, ships: {coaster: 3}, note: "Rundown's speed star", best: 447,
    plan: {"built":{"road":[],"rail":[186,185,184,183,182,181,180,179,468,440,412,384,356,328,300,272,244,216,188,187],"pipe":[206]},"vehicles":[{"type":"handy","from":"klaipeda","to":"muuga","start":0},{"type":"handy","from":"klaipeda","to":"muuga","start":30},{"type":"train","from":"muuga","to":"rakvere","start":0},{"type":"train","from":"muuga","to":"tartu","start":0}],"flows":[{"from":"muuga","to":"tallinn"}]} }
];
export const SQUARE_REGIONS = [
  {
    id: "estonia", chapter: "baltic", name: "Your terminal", teaches: "what a faster harbour is worth",
    brief: "Your terminal at Muuga takes a domestic plant's rundown as fast as your plan for Rundown moves it: 24 units a round. The rest has to be imported from Klaipėda. Tallinn, Rakvere and Tartu draw their station tanks every day: keep them from running dry.",
    grid: { lon0: 22.9, lat1: 60.12, dlon: 0.19, dlat: 0.1, cols: 28, rows: 21 },
    places: {
      klaipeda: { name: "Klaipėda", kind: "source", at: [0, 4], offmap: 22 },              // off the map's west edge: 22 h to it
      muuga: { name: "Muuga", kind: "terminal", at: [10, 6], domestic: true, tank: { cap: 40, start: 24 } },   // yours: no fee
      tallinn: { name: "Tallinn", kind: "town", at: [9, 7], label: "left", tank: { cap: 16, start: 16, use: 0.6 } },
      rakvere: { name: "Rakvere", kind: "town", at: [18, 7], tank: { cap: 8, start: 8, use: 0.2 } },
      tartu: { name: "Tartu", kind: "town", at: [20, 17], tank: { cap: 8, start: 8, use: 0.2 } },
    },
    prices: { buy: 1.6, sell: 2.2, short: 1, domestic: 1.2 },                               // $k a unit
    build: { road: 0.2, rail: 0.6, pipe: 4, depot: 3 },                                      // $k a square; a depot
    depot: { cap: 20 },
    vehicles: {                                                                             // speed: squares an hour; rate: units an hour; hire: $k a day; run: $k a square driven
      coaster: { name: "Coaster", mode: "sea", cap: 4, speed: 2, rate: 2, hire: 0.5, run: 0, max: 4 },
      handy: { name: "Handy", mode: "sea", cap: 10, speed: 2, rate: 2, hire: 0.8, run: 0, max: 4 },
      truck: { name: "Truck", mode: "road", cap: 2, speed: 4, rate: 2, hire: 0.1, run: 0.02, max: 10 },
      train: { name: "Train", mode: "rail", cap: 8, speed: 4, rate: 4, hire: 0.4, run: 0.02, max: 2 },
    },
    pipe: { rate: 1 },                                                                      // units an hour a pipeline square carries, shared by its flows
    feeds: "rundown", round: 24,                                                            // the harbour whose plan feeds the plant; units a round
    rundown: RUNDOWN,
    // the par: the best month known, which needs Rundown's speed star; its plan, with that feed, to watch
    par: { profit: RUNDOWN[3].best },
    plans: [{ par: ["profit"], feed: { hours: RUNDOWN[3].hours, ships: RUNDOWN[3].ships }, ...RUNDOWN[3].plan }],
    days: 28,
  },
];

/** The plant's feed for a harbour's bests: the hours of the fastest finish and the fleet that did it (older bests
 *  without a fleet are read as Rundown's reference plan of those hours or slower). None until the harbour is finished. */
export function feedOf(R, best) {
  if (!best || best.hours == null) return null;
  const slowest = [...R.rundown].sort((a, b) => a.hours - b.hours), ref = slowest.find(x => x.hours >= best.hours) || slowest[slowest.length - 1];
  const ships = best.hoursFleet || ref.ships;
  return { hours: best.hours, ships };
}

/** The squares: sea, land, or out of play, from the coastline. */
export function terrain(R) {
  const { lon0, lat1, dlon, dlat, cols, rows } = R.grid, t = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const p = [lon0 + (c + .5) * dlon, lat1 - (r + .5) * dlat];
    t[r * cols + c] = inside(p, PEIPUS) ? WATER : inside(p, FINLAND) ? OFF : ISLANDS.some(i => inside(p, i)) ? LAND : inside(p, MAIN) ? (p[0] > 27.97 ? OFF : LAND) : WATER;
  }
  return t;
}

/** Every place of a plan: the region's own, the depots built, the site if opened. */
export function placesOf(R, plan) {
  const out = {};
  for (const [id, p] of Object.entries(R.places)) if (p.kind !== "site" || plan.site) out[id] = p.kind === "site" ? { ...p, kind: "terminal" } : p;
  if (plan.site && R.places.paldiski) {   // the month's opening stock is yours, so it sits where you keep it: your own terminal, once it's open
    out.paldiski = { ...out.paldiski, tank: { ...out.paldiski.tank, start: R.places.muuga.tank.start } };
    out.muuga = { ...out.muuga, tank: { ...out.muuga.tank, start: 0 } };
  }
  for (const k of plan.depots || []) out[`depot${k}`] = { name: "Depot", kind: "depot", at: [k % R.grid.cols, Math.floor(k / R.grid.cols)], tank: { cap: R.depot.cap, start: 0 } };
  return out;
}
const MODE_OF = { sea: null, road: "road", rail: "rail", pipe: "pipe" };

/** The shortest way between two places for a mode: through squares built for it (or the sea, for ships), and through
 *  places, which every network may pass. Ships start at the map's edge for Klaipėda and berth beside a terminal. */
export function route(R, plan, T, mode, from, to) {
  const { cols, rows } = R.grid, P = placesOf(R, plan), a = P[from], b = P[to];
  if (!a || !b || from === to) return null;
  const idx = ([c, r]) => r * cols + c, start = idx(a.at), goal = idx(b.at);
  const placeAt = new Set(Object.values(P).map(p => idx(p.at)));
  const net = mode === "sea" ? null : new Set(plan.built?.[MODE_OF[mode]] || []);
  const ok = k => mode === "sea" ? T[k] === WATER || k === goal || k === start : placeAt.has(k) || net.has(k);
  const prev = new Int32Array(cols * rows).fill(-1); prev[start] = start;
  const q = [start];
  for (let i = 0; i < q.length; i++) {
    const k = q[i]; if (k === goal) break;
    const c = k % cols, r = Math.floor(k / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, n = nr * cols + nc;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || prev[n] !== -1 || !ok(n)) continue;
      // a ship may only leave or reach a place on land from the sea beside it
      if (mode === "sea" && T[k] !== WATER && T[n] !== WATER) continue;
      prev[n] = k; q.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const path = []; for (let k = goal; k !== start; k = prev[k]) path.push(k); path.push(start);
  return path.reverse();
}

/** What building the plan costs: squares of each kind, depots, the site's terminal. */
export function buildCost(R, plan) {
  const b = plan.built || {}, n = k => (b[k] || []).length;
  return +(n("road") * R.build.road + n("rail") * R.build.rail + n("pipe") * R.build.pipe + (plan.depots || []).length * R.build.depot + (plan.site && R.places.paldiski ? R.places.paldiski.cost : 0)).toFixed(1);
}

/** The month, hour by hour. With record, each vehicle's place on its way (as a square position), every tank, and the
 *  ledger as it builds, for the page to play back. */
export function simulate(R, plan, record = false) {
  const T = terrain(R), H = R.days * 24, P = placesOf(R, plan), pr = R.prices, cols = R.grid.cols;
  const tank = Object.fromEntries(Object.entries(P).filter(([, p]) => p.tank).map(([id, p]) => [id, p.tank.start]));
  const stock0 = Object.values(tank).reduce((a, v) => a + v, 0);
  const veh = (plan.vehicles || []).map(v => {
    const V = R.vehicles[v.type], path = route(R, plan, T, V.mode, v.from, v.to);
    const far = (v.from === "klaipeda" || v.to === "klaipeda") ? R.places.klaipeda.offmap : 0;
    return { ...v, V, path, legs: path ? far + (path.length - 1) / V.speed : 0, state: path ? "pre" : "stuck", t: v.start || 0, aboard: 0, idle: 0, along: 0 };
  });
  const flows = (plan.flows || []).map(f => ({ ...f, path: route(R, plan, T, "pipe", f.from, f.to) }));
  let revenue = 0, bought = 0, short = 0, running = 0, fees = 0, domestic = 0, domesticCost = 0;
  // the plant's rundown reaches the terminal as fast as the player's plan for the harbour moves it: a round's units
  const rd = plan.feed || null, home = Object.keys(P).find(id => P[id].domestic);
  const rdRate = rd ? R.round / rd.hours : 0;
  const rec = record ? { pos: veh.map(() => new Float32Array(H * 2)), state: veh.map(() => new Uint8Array(H)), tank: Object.fromEntries(Object.keys(tank).map(k => [k, new Float32Array(H)])), revenue: new Float32Array(H), bought: new Float32Array(H), short: new Float32Array(H) } : null;
  const S = { pre: 0, load: 1, go: 2, unload: 3, back: 4, wait: 5, stuck: 6 };
  for (let h = 0; h < H; h++) {
    if (rd && home) { const m = Math.min(rdRate, P[home].tank.cap - tank[home]); if (m > 1e-9) { tank[home] += m; domestic += m; domesticCost += m * pr.domestic; } }   // what can't be taken backs up at the plant
    for (const [id, p] of Object.entries(P)) if (p.kind === "town") { const u = Math.min(tank[id], p.tank.use); tank[id] -= u; revenue += u * pr.sell; short += p.tank.use - u; }
    // pipelines: each flow takes what its line has left this hour, square by square (a trunk shared by two flows carries
    // their sum, no more), what the far end has room for, and what the near end has
    const used = new Map();
    for (const f of flows) if (f.path && P[f.from]?.tank && P[f.to]?.tank) {
      const mid = f.path.slice(1, -1), left = mid.reduce((a, k) => Math.min(a, R.pipe.rate - (used.get(k) || 0)), R.pipe.rate);
      const m = Math.min(left, tank[f.from], P[f.to].tank.cap - tank[f.to]);
      if (m > 1e-9) { tank[f.from] -= m; tank[f.to] += m; for (const k of mid) used.set(k, (used.get(k) || 0) + m); }
    }
    for (const v of veh) {
      let st = v.state;
      if (st === "pre") { if (h >= v.t) st = v.state = "load"; }
      if (st === "load") {
        const want = v.V.cap - v.aboard;
        if (want <= 1e-9) { st = v.state = "go"; v.along = 0; running += v.V.run * (v.path.length - 1); }
        else if (v.from === "klaipeda") { const m = Math.min(want, v.V.rate); v.aboard += m; bought += m * pr.buy; }
        else { const m = Math.min(want, v.V.rate, tank[v.from]); if (m > 1e-9) { tank[v.from] -= m; v.aboard += m; } else { v.idle++; if (rec) rec.state[veh.indexOf(v)][h] = S.wait; } }
      } else if (st === "go" || st === "back") {
        v.along += 1; if (v.along >= v.legs) { v.along = v.legs; st = v.state = st === "go" ? "unload" : "load"; }
      } else if (st === "unload") {
        const room = P[v.to].tank ? P[v.to].tank.cap - tank[v.to] : Infinity, m = Math.min(v.aboard, v.V.rate, room);
        if (m > 1e-9) { if (P[v.to].tank) tank[v.to] += m; v.aboard -= m; fees += m * (P[v.to].fee || 0); } else { v.idle++; if (rec) rec.state[veh.indexOf(v)][h] = S.wait; }
        if (v.aboard <= 1e-9) { v.aboard = 0; st = v.state = "back"; v.along = 0; running += v.V.run * (v.path.length - 1); }
      }
      if (rec) {
        const i = veh.indexOf(v), path = v.path; if (rec.state[i][h] !== S.wait) rec.state[i][h] = S[v.state] ?? 0;
        if (path) {
          // where on its way: the fraction of the voyage done, the off-map part (to or from Klaipėda) beyond the edge
          const far = v.legs - (path.length - 1) / v.V.speed, out = v.state === "go", home = v.state === "back";
          let sq = v.state === "unload" ? path.length - 1 : 0;
          if (out || home) { const done = out ? v.along : v.legs - v.along, onMap = (done - (v.from === "klaipeda" ? far : 0)) * v.V.speed; sq = Math.max(0, Math.min(path.length - 1, onMap)); }
          const k0 = Math.floor(sq), k1 = Math.min(path.length - 1, k0 + 1), f = sq - k0, a = path[k0], b = path[k1];
          rec.pos[i][h * 2] = (a % cols) + ((b % cols) - (a % cols)) * f; rec.pos[i][h * 2 + 1] = Math.floor(a / cols) + (Math.floor(b / cols) - Math.floor(a / cols)) * f;
        }
      }
    }
    if (rec) { for (const k of Object.keys(tank)) rec.tank[k][h] = tank[k]; rec.revenue[h] = revenue; rec.bought[h] = bought; rec.short[h] = short; }
  }
  const stock1 = Object.values(tank).reduce((a, v) => a + v, 0) + veh.reduce((a, v) => a + v.aboard, 0);
  const rdHire = rd ? Object.entries(rd.ships).reduce((a, [t, n]) => a + n * R.vehicles[t].hire * R.days, 0) : 0;
  const hire = veh.reduce((a, v) => a + v.V.hire * R.days, 0) + rdHire, build = buildCost(R, plan), penalty = short * pr.short, stockChange = (stock1 - stock0) * (pr.domestic ?? pr.buy);   // at the cheapest cost it could have had: no gain in ending full
  const r1 = x => Math.round(x * 10) / 10;
  const squares = ["road", "rail", "pipe"].reduce((a, m) => a + (plan.built?.[m] || []).length, 0);
  return { profit: r1(revenue - bought - domesticCost - hire - build - penalty - running - fees + stockChange), domestic: r1(domestic), domesticCost: r1(domesticCost), rdHire: r1(rdHire), rdRate: +rdRate.toFixed(3), revenue: r1(revenue), bought: r1(bought), hire: r1(hire), build: r1(build), running: r1(running), fees: r1(fees),
    penalty: r1(penalty), short: r1(short), vehicles: veh.length, squares,
    stockChange: r1(stockChange), stuck: veh.filter(v => !v.path).length, idle: veh.reduce((a, v) => a + v.idle, 0), rec, S };
}

