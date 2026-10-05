// Refinery: route every stream to a unit or a product pool, and see what the refinery earns. The engine runs the
// units in process order, blends the pools, checks the specs (an off-spec pool sells as something cheaper),
// balances hydrogen and prices it all to a margin in $/bbl of crude. The data (units, streams, pools, crudes)
// is in refinery-data.js.
import { STREAMS, UNITS, POOLS, CRUDES, H2_PRICE, RENEWABLE_FEED } from "./refinery-data.js";

export const FEED = 100;                       // kb/d of crude in every level
// units in the order their feeds are ready: distillation, residue conversion, renewables, crackers, then treating and octane
const ORDER = ["cdu", "vdu", "coker", "visbreaker", "bitumen", "hvoUnit", "fcc", "hcu", "nht", "reformer", "isom", "alky", "cnht", "dht", "kht"];
/** Where a stream naturally sells when nothing better is chosen. */
const HOME = {
  gas: "gasPool", lpg: "lpg", propylene: "propylene", c4: "lpg", lsr: "naphtha", hsr: "naphtha", hsrT: "naphtha", reformate: "gasoline", isomerate: "gasoline",
  catNaphtha: "naphtha", catNaphthaT: "gasoline", alkylate: "gasoline", cokerNaphtha: "naphtha", hcNaphtha: "naphtha", kero: "diesel", jet: "jet", lgo: "fuelOil",
  hgo: "fuelOil", lco: "fuelOil", ulsd: "diesel", hcJet: "jet", hcDiesel: "diesel", cokerGo: "fuelOil", hvo: "hvo", lvgo: "fuelOil", hvgo: "fuelOil", slurry: "fuelOil",
  atmResid: "fuelOil", vacResid: "fuelOil", visResid: "fuelOil", fuelOilCutter: "fuelOil", coke: "coke", vegOil: null, fame: "diesel", ethanol: "gasoline", bitumen: "bitumen",
};

/** The destinations a stream may go to in a level: the available units that take it, then the pools that take it. */
export function destinations(level, stream) {
  const units = level.units.filter(u => UNITS[u].feeds.includes(stream));
  const pools = Object.keys(POOLS).filter(p => POOLS[p].accept.includes(stream));
  return [...units, ...pools];
}
/** Every stream a level can produce, in process order, given which units it has. */
export function streamsOf(level) {
  const out = [];
  const seen = new Set();
  const add = s => { if (!seen.has(s)) { seen.add(s); out.push(s); } };
  for (const s of Object.keys(CRUDES[level.crude].cuts)) add(s);
  for (const u of ORDER) {
    if (!level.units.includes(u) || !UNITS[u].yields) continue;
    for (const feed of Object.keys(UNITS[u].yields)) for (const o of Object.keys(UNITS[u].yields[feed])) add(o);
  }
  for (const s of Object.keys(level.renewables || {})) add(s);
  return out;
}
/** The default routing for a level: everything to its natural pool. */
export const defaultRouting = level => Object.fromEntries(streamsOf(level).map(s => [s, destinations(level, s).includes(HOME[s]) ? HOME[s] : destinations(level, s)[destinations(level, s).length - 1]]));

/**
 * Runs the refinery. routing: { stream: destination (a unit or pool id) }. Returns { margin ($/bbl of crude),
 * revenue, crudeCost, feedCost, opex, h2Cost, h2: { made, used }, pools: { id: { vol, ron, cet, s, inSpec, fails,
 * soldAs, price } }, units: { id: { feed, outputs } }, volumes: { stream: kb/d }, issues: [text] }.
 */
export function evaluate(level, routing) {
  const crude = CRUDES[level.crude];
  const vol = {}, props = {}, units = {}, issues = [];
  // volumes, and the volume-weighted RON, cetane and sulphur that travel with them
  const addVol = (s, v, p = STREAMS[s]) => {
    vol[s] = (vol[s] || 0) + v;
    const acc = props[s] || (props[s] = { ron: 0, cet: 0, s: 0 });
    acc.ron += v * (p.ron ?? 0); acc.cet += v * (p.cet ?? 0); acc.s += v * (p.s ?? 0);
  };
  const propsOf = s => { const acc = props[s], v = vol[s] || 0; return v > 0 ? { ron: acc.ron / v, cet: acc.cet / v, s: acc.s / v } : { ron: 0, cet: 0, s: 0 }; };
  // the cuts carry the crude's sulphur: the stream figures are for a 1.6% crude like Urals, scaled by the assay
  const sulphurScale = crude.sulphur / 1.6;
  for (const [s, f] of Object.entries(crude.cuts)) addVol(s, FEED * f, { ...STREAMS[s], s: (STREAMS[s].s ?? 0) * sulphurScale });
  for (const [s, v] of Object.entries(level.renewables || {})) addVol(s, v);
  units.cdu = { feed: FEED, outputs: { ...crude.cuts } };
  let h2Made = 0, h2Used = 0, opex = FEED * UNITS.cdu.opex;
  const where = s => {
    const d = routing[s];
    const ok = d && (level.units.includes(d) && UNITS[d].feeds.includes(s) || POOLS[d]?.accept.includes(s));
    return ok ? d : (destinations(level, s).includes(HOME[s]) ? HOME[s] : destinations(level, s).slice(-1)[0]);
  };
  // the units, in order: each takes the streams routed to it and makes its outputs
  for (const u of ORDER.slice(1)) {
    if (!level.units.includes(u)) continue;
    const def = UNITS[u];
    const feeds = def.feeds.filter(s => (vol[s] || 0) > 0 && where(s) === u);
    if (!feeds.length) continue;
    const unit = { feed: 0, outputs: {} };
    for (const s of feeds) {
      const v = vol[s], inProps = propsOf(s);
      unit.feed += v;
      opex += v * def.opex;
      const y = u === "vdu" ? { lvgo: crude.vgoShare * 0.4, hvgo: crude.vgoShare * 0.6, vacResid: 1 - crude.vgoShare } : def.yields[s];
      for (const [o, f] of Object.entries(y)) {
        // a treater's main product keeps the feed's octane or cetane, shifted, with the sulphur the unit leaves;
        // distillation and residue conversion pass the feed's sulphur on; crackers' products have their own
        const carried = def.carry && STREAMS[o].group === STREAMS[s].group ? { ron: inProps.ron + (def.carry.ron ?? 0), cet: inProps.cet + (def.carry.cet ?? 0), s: def.carry.s }
          : ["vdu", "coker", "visbreaker"].includes(u) && STREAMS[o].s != null ? { ...STREAMS[o], s: inProps.s * (STREAMS[o].s / STREAMS[s].s) } : STREAMS[o];
        addVol(o, v * f, carried);
        unit.outputs[o] = (unit.outputs[o] || 0) + v * f;
      }
      const h = def.h2?.[s] || 0;
      if (h > 0) h2Made += v * h; else h2Used -= v * h;
      vol[s] = 0; props[s] = { ron: 0, cet: 0, s: 0 };         // consumed
    }
    units[u] = unit;
  }
  // the pools: blend what's left, check the specs, and sell off-spec blends as what they are
  const pools = {};
  const into = (p, s, v) => {
    const pool = pools[p] || (pools[p] = { vol: 0, ron: 0, cet: 0, s: 0, parts: {} });
    const st = propsOf(s);
    pool.vol += v;
    pool.ron += v * st.ron;
    pool.cet += v * st.cet;
    pool.s += v * st.s;
    pool.parts[s] = (pool.parts[s] || 0) + v;
  };
  for (const [s, v] of Object.entries(vol)) {
    if (v <= 0 || s === "vegOil") continue;
    const d = where(s);
    if (POOLS[d]) into(d, s, v);
    else if (POOLS[HOME[s]]) into(HOME[s], s, v);
  }
  // jet takes only jet-grade streams; the rest drop to diesel before the pools are judged
  if (pools.jet) {
    for (const [s, v] of Object.entries(pools.jet.parts)) if (!STREAMS[s].jet) { const st = propsOf(s); pools.jet.vol -= v; pools.jet.ron -= v * st.ron; pools.jet.cet -= v * st.cet; pools.jet.s -= v * st.s; delete pools.jet.parts[s]; into("diesel", s, v); issues.push(`${STREAMS[s].name} isn't jet grade: it went to the diesel pool.`); }
    if (pools.jet.vol <= 0) delete pools.jet;
  }
  let revenue = 0;
  const sold = {};
  const judge = (p, pool) => {
    const def = POOLS[p], n = pool.vol || 1;
    const ron = pool.ron / n, cet = pool.cet / n, s = pool.s / n;
    const fails = [];
    if (def.spec?.ronMin != null && ron < def.spec.ronMin) fails.push(`RON ${ron.toFixed(1)} under ${def.spec.ronMin}`);
    if (def.spec?.cetMin != null && cet < def.spec.cetMin) fails.push(`cetane ${cet.toFixed(1)} under ${def.spec.cetMin}`);
    if (def.spec?.sMax != null && s > def.spec.sMax) fails.push(`sulphur ${fmtS(s)} over ${fmtS(def.spec.sMax)}`);
    return { ron, cet, s, fails };
  };
  for (const [p, pool] of Object.entries(pools)) {
    let soldAs = p, { ron, cet, s, fails } = judge(p, pool);
    const firstFails = fails;
    while (fails.length && POOLS[soldAs].fallback) { soldAs = POOLS[soldAs].fallback; ({ fails } = judge(soldAs, pool)); }
    const price = POOLS[soldAs].price;
    revenue += pool.vol * price;
    sold[p] = { vol: pool.vol, ron, cet, s, inSpec: firstFails.length === 0, fails: firstFails, soldAs, price, parts: pool.parts };
    if (firstFails.length) issues.push(`${POOLS[p].name} is off spec (${firstFails.join(", ")}): sold as ${POOLS[soldAs].name.toLowerCase()}.`);
  }
  // hydrogen: the reformer's first; the hydrogen plant (or merchant hydrogen, dearer) covers the rest
  const h2Short = Math.max(0, h2Used - h2Made);
  const h2Cost = h2Short * H2_PRICE * (level.units.includes("smr") ? 1 : 3);
  if (h2Short > 0 && !level.units.includes("smr")) issues.push("No hydrogen plant: the shortfall is bought in at three times the price.");
  const crudeCost = FEED * crude.price;
  const feedCost = Object.entries(level.renewables || {}).reduce((t, [s, v]) => t + v * (RENEWABLE_FEED[s] || 0), 0);
  const margin = (revenue - crudeCost - feedCost - opex - h2Cost) / FEED;
  return { margin, revenue, crudeCost, feedCost, opex, h2Cost, h2: { made: h2Made, used: h2Used }, pools: sold, units, volumes: vol, issues };
}
const fmtS = ppm => (ppm >= 10000 ? `${(ppm / 10000).toFixed(1)}%` : `${Math.round(ppm)} ppm`);

/** Par: the best margin a local search finds, trying every destination for each stream in turn from several starts. */
export function solve(level, restarts = 6, seed = 1) {
  const streams = streamsOf(level);
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let best = null;
  for (let r = 0; r < restarts; r++) {
    const routing = r === 0 ? defaultRouting(level) : Object.fromEntries(streams.map(s => { const d = destinations(level, s); return [s, d[Math.floor(rnd() * d.length)]]; }));
    let score = evaluate(level, routing).margin;
    const singles = () => {
      let improved = false;
      for (const s of streams) for (const d of destinations(level, s)) {
        if (d === routing[s]) continue;
        const m = evaluate(level, { ...routing, [s]: d }).margin;
        if (m > score + 1e-9) { routing[s] = d; score = m; improved = true; }
      }
      return improved;
    };
    const pairs = () => {
      let improved = false;
      for (let i = 0; i < streams.length; i++) for (let j = i + 1; j < streams.length; j++) {
        const a = streams[i], b = streams[j];
        for (const da of destinations(level, a)) for (const db of destinations(level, b)) {
          if (da === routing[a] && db === routing[b]) continue;
          const m = evaluate(level, { ...routing, [a]: da, [b]: db }).margin;
          if (m > score + 1e-9) { routing[a] = da; routing[b] = db; score = m; improved = true; }
        }
      }
      return improved;
    };
    for (let pass = 0; pass < 10; pass++) { while (singles()) { /* climb */ } if (!pairs()) break; }
    if (!best || score > best.margin) best = { margin: score, routing: { ...routing } };
  }
  return best;
}
