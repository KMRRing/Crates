// Refinery's engine: send every stream where you like, in shares, and see what the refinery makes and earns. It runs
// the units in process order (each takes its share of every feed, up to its capacity), carries each stream's
// properties through the units, blends the pools by their blending indices, judges each against the specs the level
// sets (an off-spec blend sells as something cheaper), balances hydrogen and sulphur, and prices it all to a margin in
// $/bbl of crude. Par is the LP's plan (solve), as a refinery's planners would make it. The data is refinery-data.js.
import { STREAMS, UNITS, POOLS, CRUDES, PROPS, toIndex, fromIndex, CUT_S, CORE_SPECS, H2_PRICE, H2_IMPORT, SULPHUR, BOUGHT } from "./refinery-data.js";
import { simplex } from "./refinery-lp.js";

export const FEED = 100;                         // kb/d of crude, unless a level says otherwise
/** Units in the order their feeds are ready: every producer of a stream comes before every unit that takes it. */
export const ORDER = ["cdu", "vdu", "coker", "visbreaker", "blowing", "hvoUnit", "safUnit", "fcc", "hcu", "merox", "kht", "nht", "reformer", "bzhc", "isom", "alky", "cnht", "dht"];
/** Where a stream sells when it isn't sent anywhere: as it comes, unprocessed. */
const HOME = {
  gas: "gasPool", lpg: "lpg", butane: "lpg", propylene: "propylene", c4: "lpg", lsr: "naphtha", hsr: "naphtha", hsrT: "naphtha", reformate: "gasoline",
  isomerate: "gasoline", catNaphtha: "naphtha", catNaphthaT: "gasoline", alkylate: "gasoline", cokerNaphtha: "naphtha", hcNaphtha: "naphtha", ethanol: "gasoline",
  kero: "gasoil", jet: "jet", lgo: "gasoil", hgo: "fuelOil", lco: "fuelOil", ulsd: "diesel", hcJet: "jet", hcDiesel: "diesel", cokerGo: "fuelOil", fuelOilCutter: "fuelOil",
  hvo: "diesel", fame: "diesel", vegOil: "notBought", spk: "jet", lvgo: "fuelOil", hvgo: "fuelOil", slurry: "fuelOil", atmResid: "fuelOil", vacResid: "fuelOil", visResid: "fuelOil",
  coke: "coke", bitumen: "bitumen", etbe: "gasoline", bzCut: "naphtha", heavyReformate: "gasoline", importVgo: "notBought",
};
const T_PER_KB = 158.987;                        // m³ in a thousand barrels: kb/d × kg/m³ × this / 1000 is t/d
const ZERO = new Set(["arom", "olef", "benz", "oxy", "etoh", "ether", "fame", "grade", "asph", "bio", "ghg", "s"]);   // a stream without these has none

// ---------- the level's plant ----------
const crudeOf = level => CRUDES[level.crude];
const feedOf = level => level.feed ?? FEED;
/** The pools a level sells into (all of them unless it lists its own). */
export const poolsOf = level => level.pools || Object.keys(POOLS).filter(p => !POOLS[p].fallbackOnly);
/** The specs a pool is judged on in a level: the level's own, or the core ones. */
export const specsOf = (level, p) => (level.specs?.[p] ?? CORE_SPECS[p] ?? []).filter(k => POOLS[p].spec?.[k]);
/** The limits a pool's specs set in a level: its own, or the pool's. */
export const limitOf = (level, p, k) => level.limits?.[p]?.[k] ?? POOLS[p].spec[k];
/** The destinations a stream may go to in a level: the level's units that take it, then its pools that take it. */
export function destinations(level, s) {
  const units = level.units.filter(u => UNITS[u].feeds.includes(s));
  const pools = poolsOf(level).filter(p => POOLS[p].accept.includes(s));
  return [...units, ...pools];
}
/** Every stream a level can produce, in process order. */
export function streamsOf(level) {
  const out = [], seen = new Set(), add = s => { if (!seen.has(s)) { seen.add(s); out.push(s); } };
  for (const s of Object.keys(crudeOf(level).cuts)) add(s);
  for (const s of Object.keys(level.bought || {})) add(s);
  for (const u of ORDER) {
    if (!level.units.includes(u) || !UNITS[u].yields) continue;
    for (const feed of Object.keys(UNITS[u].yields)) for (const o of Object.keys(UNITS[u].yields[feed])) add(o);
  }
  return out;
}
/** A stream's home in a level: where it sells untouched, or its first pool, or its first unit. */
export function homeOf(level, s) {
  const d = destinations(level, s);
  return d.includes(HOME[s]) ? HOME[s] : d.find(x => POOLS[x]) || d[0] || null;
}
/** The default routing: everything to its home, or the level's own start. */
export function defaultRouting(level) {
  const r = Object.fromEntries(streamsOf(level).map(s => [s, { [homeOf(level, s)]: 1 }]));
  for (const [s, v] of Object.entries(level.start || {})) r[s] = typeof v === "string" ? { [v]: 1 } : { ...v };
  return r;
}
/** A stream's shares in a routing, as [destination, share] summing to one (a plain name is all of it). */
export function sharesOf(level, routing, s) {
  const r = routing?.[s], dests = destinations(level, s);
  let list = typeof r === "string" ? [[r, 1]] : r ? Object.entries(r) : [];
  list = list.filter(([d, f]) => f > 1e-9 && dests.includes(d));
  const tot = list.reduce((a, [, f]) => a + f, 0);
  if (tot <= 1e-9) { const h = homeOf(level, s); return h ? [[h, 1]] : []; }
  return list.map(([d, f]) => [d, f / tot]);
}
/** A routing with every stream's shares in order: a plain name becomes all of it, a missing stream its home. */
export function normalise(level, routing) {
  return Object.fromEntries(streamsOf(level).map(s => [s, Object.fromEntries(sharesOf(level, routing, s))]));
}

// ---------- properties, as blending indices ----------
/** An accumulator for a blend: each property's weight and its weighted index. */
const blend = () => ({ v: 0, m: 0, w: {}, x: {} });
function addTo(acc, v, p) {
  if (v <= 0) return;
  const d = p.d ?? 0, m = v * d;
  acc.v += v; acc.m += m;
  for (const k of Object.keys(PROPS)) {
    const val = p[k] ?? (ZERO.has(k) ? 0 : null);
    if (val == null) continue;
    const w = PROPS[k].basis === "mass" ? m : v;
    if (w <= 0) continue;
    acc.w[k] = (acc.w[k] || 0) + w;
    acc.x[k] = (acc.x[k] || 0) + w * toIndex(k, val);
  }
}
/** A blend's properties in their own units. */
function propsOf(acc) {
  const out = {};
  for (const k of Object.keys(acc.w)) if (acc.w[k] > 0) out[k] = fromIndex(k, acc.x[k] / acc.w[k]);
  return out;
}
/** A stream's own properties in a level: straight-run cuts take their sulphur, and the residue its body, from the crude. */
export function ownProps(level, s) {
  const crude = crudeOf(level), p = { ...STREAMS[s].p };
  if (STREAMS[s].sr && CUT_S[s] != null) p.s = crude.sulphur * 10000 * CUT_S[s] * sulphurScale(level.crude);
  if (s === "atmResid") Object.assign(p, crude.ar);
  return p;
}
/**
 * The cuts' sulphur follows the same pattern in every crude (CUT_S: light naphtha a fiftieth of the crude's, residue
 * half as much again), scaled so the cuts weigh up to the crude's assay exactly: a light crude puts more of its
 * sulphur in its lighter cuts.
 */
const scales = {};
function sulphurScale(c) {
  if (scales[c] != null) return scales[c];
  const crude = CRUDES[c];
  let mass = 0, s = 0;
  for (const [cut, f] of Object.entries(crude.cuts)) {
    const d = cut === "atmResid" ? crude.ar.d : STREAMS[cut].p.d;
    if (!d) continue;
    mass += f * d; s += f * d * (CUT_S[cut] ?? 0) + (CUT_S[cut] == null ? f * d * (STREAMS[cut].p.s ?? 0) / (crude.sulphur * 10000) : 0);
  }
  return (scales[c] = mass / s);
}
/** What a unit makes of a feed: [product, volume per volume of feed] (the vacuum unit by the crude's own split). */
export function yieldsOf(level, u, f) {
  if (u === "vdu") { const g = crudeOf(level).vgoShare; return { lvgo: g * 0.4, hvgo: g * 0.6, vacResid: 1 - g }; }
  return UNITS[u].yields?.[f] || {};
}
/** A product's properties, made by a unit from a feed of the given properties. */
export function productProps(level, u, f, o, fp) {
  const def = UNITS[u], c = def.carry;
  let p;
  if (c && c.to === o) {
    p = { ...STREAMS[o].p, ...fp };
    const dl = c.perFeed?.[f] || c.delta || {};
    for (const [k, v] of Object.entries(dl)) if (p[k] != null) p[k] = Math.max(0, p[k] + v);
    for (const [k, v] of Object.entries(c.scale || {})) if (p[k] != null) p[k] *= v;
    Object.assign(p, c.set || {});
  } else p = { ...STREAMS[o].p };
  if (u === "vdu" && o === "vacResid") Object.assign(p, crudeOf(level).vr, { asph: crudeOf(level).asphaltic ? 1 : 0 });
  if (def.sOf?.[o] != null) p.s = (fp.s ?? 0) * def.sOf[o];
  // renewable carbon follows a feed into every product without its own: its share by volume, and its saving spread
  // over the barrels made, so a cracker's products together save what its feed did
  if (!(c && c.to === o) && (fp.bio || fp.ghg)) {
    const made = Object.values(yieldsOf(level, u, f)).reduce((a, b) => a + b, 0) || 1;
    if (STREAMS[o].p.bio == null && fp.bio) p.bio = fp.bio;
    if (STREAMS[o].p.ghg == null && fp.ghg) p.ghg = fp.ghg / made;
  }
  return p;
}
/** The most of a unit's feed a co-processed renewable feed may be: the unit's own limit, or the level's. */
export const coLimits = (level, u) => ({ ...(UNITS[u].co || {}), ...(level.co?.[u] || {}) });

// ---------- running the refinery ----------
/**
 * Runs the refinery on a routing ({ stream: { destination: share } }, or a destination's name for all of it).
 * Returns { margin ($/bbl of crude), revenue, crudeCost, boughtCost, opex, h2Cost, sulphurNet, h2, sulphur, streams,
 * units, pools, issues }: streams[s] = { vol, props, to: { destination: kb/d } }, units[u] = { feed, cap, feeds,
 * outputs }, pools[p] = { vol, props, parts, specs, inSpec, fails, soldAs, price }.
 */
export function evaluate(level, routing) {
  const crude = crudeOf(level), F = feedOf(level), has = u => level.units.includes(u);
  const acc = {}, streams = {}, units = {}, issues = [];
  const accOf = s => acc[s] || (acc[s] = blend());
  for (const [s, f] of Object.entries(crude.cuts)) addTo(accOf(s), F * f, ownProps(level, s));
  for (const [s, v] of Object.entries(level.bought || {})) addTo(accOf(s), v, ownProps(level, s));
  const share = {};                              // stream → [[dest, share]]
  for (const s of streamsOf(level)) share[s] = sharesOf(level, routing, s);
  const to = {};                                 // stream → { dest: kb/d }, as it actually went
  const send = (s, d, v) => { if (v > 1e-9) { const t = to[s] || (to[s] = {}); t[d] = (t[d] || 0) + v; } };
  let opex = F * UNITS.cdu.opex, h2Made = 0, h2Used = 0, sRemoved = 0;
  units.cdu = { feed: F, cap: level.caps?.cdu ?? null, feeds: { crude: F }, outputs: Object.fromEntries(Object.entries(crude.cuts).map(([s, f]) => [s, F * f])) };
  for (const u of ORDER) {
    if (u === "cdu" || !has(u) || !UNITS[u].feeds.length) continue;
    const def = UNITS[u];
    const takes = def.feeds.map(s => [s, (acc[s]?.v || 0) * (share[s]?.find(([d]) => d === u)?.[1] || 0)]).filter(([, v]) => v > 1e-9);
    if (!takes.length) continue;
    // a renewable feed co-processed is held to its share of what the unit runs; what's over goes where it would have
    // gone without it, as a full unit's overflow does
    const co = coLimits(level, u), coOver = {};
    for (const t of takes) {
      const lim = co[t[0]];
      if (lim == null) continue;
      const most = (lim / (1 - lim)) * takes.reduce((a, [s, v]) => a + (s in co ? 0 : v), 0);
      if (t[1] > most + 1e-9) { coOver[t[0]] = t[1] - most; t[1] = most; }
      if ((coOver[t[0]] || 0) >= 0.05) issues.push({ kind: "co", unit: u, text: `The ${def.name.toLowerCase()} takes ${STREAMS[t[0]].name.toLowerCase()} up to ${Math.round(lim * 100)}% of its feed: ${coOver[t[0]].toFixed(1)} kb/d of it went where it would have gone without it.` });
    }
    const total = takes.reduce((a, [, v]) => a + v, 0), cap = level.caps?.[u];
    const k = cap != null && total > cap ? cap / total : 1;
    // a plan that fills a unit to the barrel overshoots it by a rounding's worth: not worth a word
    if (total - (cap ?? total) >= 0.05) issues.push({ kind: "cap", unit: u, text: `The ${def.name.toLowerCase()} is full at ${cap} kb/d: ${(total - cap).toFixed(1)} kb/d of its feed went where it would have gone without it.` });
    const unit = units[u] = { feed: 0, cap: cap ?? null, feeds: {}, outputs: {}, h2: 0, sRemoved: 0, ...(Object.keys(coOver).length ? { coOver } : {}) };
    for (const [s, want] of takes) {
      const v = want * k, fp = propsOf(acc[s]);
      send(s, u, v);
      if (want - v > 1e-9) (unit.overflow || (unit.overflow = {}))[s] = want - v;
      unit.feed += v; unit.feeds[s] = v;
      opex += v * def.opex;
      let sOut = 0;
      for (const [o, f] of Object.entries(yieldsOf(level, u, s))) {
        const p = productProps(level, u, s, o, fp);
        addTo(accOf(o), v * f, p);
        unit.outputs[o] = (unit.outputs[o] || 0) + v * f;
        sOut += v * f * (p.d || 0) * (p.s || 0);
      }
      const h = (def.h2?.[s] || 0) * v;
      if (h > 0) h2Made += h; else h2Used -= h;
      unit.h2 += h;
      const removed = Math.max(0, v * (fp.d || 0) * (fp.s || 0) - sOut) * T_PER_KB / 1e9;   // t/d of sulphur
      sRemoved += removed; unit.sRemoved += removed;
    }
  }
  // what's left of each stream goes to its pools: its pool shares, or its home for what overflowed a full unit
  const pools = {};
  for (const s of streamsOf(level)) {
    const a = acc[s];
    if (!a || a.v <= 1e-9) continue;
    const props = propsOf(a), used = Object.values(to[s] || {}).reduce((x, y) => x + y, 0);
    streams[s] = { vol: a.v, props, to: null };
    let left = a.v - used;
    if (left > 1e-9) {
      const poolShares = share[s].filter(([d]) => POOLS[d]), tot = poolShares.reduce((x, [, f]) => x + f, 0);
      const spare = POOLS[homeOf(level, s)] ? homeOf(level, s) : destinations(level, s).find(d => POOLS[d]);
      const list = tot > 1e-9 ? poolShares.map(([d, f]) => [d, f / tot]) : spare ? [[spare, 1]] : [];
      if (!list.length) issues.push({ kind: "lost", stream: s, text: `${STREAMS[s].name}: ${left.toFixed(1)} kb/d with nowhere to go.` });
      for (const [p, f] of list) {
        const v = left * f, pool = pools[p] || (pools[p] = { acc: blend(), parts: {} });
        addTo(pool.acc, v, props);
        pool.parts[s] = (pool.parts[s] || 0) + v;
        send(s, p, v);
      }
    }
    streams[s].to = to[s] || {};
  }
  // the pools: blended, judged on the level's specs, and sold as what they are
  let revenue = 0;
  const sold = {};
  const judge = (p, props) => specsOf(level, p).map(k => {
    const [lo, hi] = limitOf(level, p, k), v = props[k] ?? (ZERO.has(k) ? 0 : NaN);
    return lo != null && !(v >= lo - 1e-6) ? { k, v, lim: lo, dir: "min" } : hi != null && !(v <= hi + 1e-6) ? { k, v, lim: hi, dir: "max" } : null;
  }).filter(Boolean);
  for (const [p, pool] of Object.entries(pools)) {
    const props = propsOf(pool.acc), vol = pool.acc.v, fails = judge(p, props);
    let soldAs = p, f = fails;
    while (f.length && POOLS[soldAs].fallback) { soldAs = POOLS[soldAs].fallback; f = judge(soldAs, props); }
    // what isn't bought is refunded at each stream's own price
    const price = soldAs === "notBought" ? Object.entries(pool.parts).reduce((t, [s, v]) => t + v * refundOf(level, s), 0) / vol : priceOf(level, soldAs);
    // a market that takes only so much: the rest sells as the next grade down
    const market = level.markets?.[p], over = market != null && soldAs === p ? Math.max(0, vol - market) : 0;
    const overPrice = over ? priceOf(level, POOLS[p].fallback || "slops") : 0;
    revenue += (vol - over) * price + over * overPrice;
    if (over > 1e-6) issues.push({ kind: "market", pool: p, text: `The ${POOLS[p].name.toLowerCase()} market takes ${market} kb/d: ${over.toFixed(1)} kb/d more sold as ${POOLS[POOLS[p].fallback || "slops"].name.toLowerCase()}.` });
    sold[p] = { vol, props, parts: pool.parts, specs: specsOf(level, p), inSpec: !fails.length, fails, soldAs, price, over };
    if (fails.length) issues.push({ kind: "spec", pool: p, text: `${POOLS[p].name} is off spec (${fails.map(failText).join(", ")}): sold as ${POOLS[soldAs].name.toLowerCase()} at $${price}.` });
  }
  // hydrogen: the reformer's first, then the hydrogen plant up to its capacity, then bought in; any spare is burned
  const short = Math.max(0, h2Used - h2Made), plantCap = has("smr") ? (level.caps?.smr ?? Infinity) : 0;
  const plant = Math.min(short, plantCap), imported = short - plant, spare = Math.max(0, h2Made - h2Used);
  // where no hydrogen can be bought (level.h2Import false), a shortfall means the treaters can't run: it costs as if
  // the barrels went unsold, and the plan doesn't count
  const noImport = level.h2Import === false;
  const h2Cost = plant * H2_PRICE + imported * H2_PRICE * (noImport ? 40 : H2_IMPORT) - spare * 2;
  if (imported > 1e-6) issues.push(noImport ? { kind: "h2short", text: `Not enough hydrogen: ${imported.toFixed(1)} MMscf/d short, so the treaters can't run as planned.` }
    : { kind: "h2", text: `${has("smr") ? "The hydrogen plant is full" : "No hydrogen plant"}: ${imported.toFixed(1)} MMscf/d bought in at ${H2_IMPORT} times the price.` });
  // sulphur: the Claus plant's, up to its capacity; beyond it the treaters can't run, which costs as if it went elsewhere
  const sruCap = has("sru") ? (level.caps?.sru ?? Infinity) : 0, sOver = Math.max(0, sRemoved - sruCap);
  const sulphurNet = ((sRemoved - sOver) * (SULPHUR.price - SULPHUR.cost) - sOver * 5000) / 1000;   // $ a tonne, so k$/d
  if (sOver > 0.05) issues.push({ kind: "sru", text: `${has("sru") ? "The sulphur plant is full" : "No sulphur plant"}: ${sOver.toFixed(0)} t/d of sulphur has nowhere to go.` });
  // tickets: where a level prices them, what each road or aviation fuel's renewable part saves, at the quota price (kb/d
  // times kg a barrel is tonnes a day). An off-spec pool earns what it's sold as earns; what a market can't take, sold
  // on as the next grade down, earns none
  let tickets = 0, saved = 0;
  if (level.ticket) for (const x of Object.values(sold)) {
    const scale = POOLS[x.soldAs].tickets, t = (x.vol - x.over) * (x.props.ghg || 0);
    if (!scale || t <= 0) continue;
    x.saved = t; x.tickets = (t * level.ticket * scale) / 1000;
    saved += t; tickets += x.tickets;
  }
  const crudeCost = F * (level.crudePrice ?? crude.price);
  const boughtCost = Object.entries(level.bought || {}).reduce((t, [s, v]) => t + v * (level.prices?.[s] ?? BOUGHT[s] ?? 0), 0);
  const margin = (revenue + tickets - crudeCost - boughtCost - opex - h2Cost + sulphurNet) / F;
  return { margin, revenue, tickets, saved, crudeCost, boughtCost, opex, h2Cost, sulphurNet, h2: { made: h2Made, used: h2Used, plant, imported, spare },
    sulphur: { removed: sRemoved, cap: sruCap, over: sOver }, streams, units, pools: sold, issues };
}
/** A pool's price in a level (a level may have its own deck). */
export const priceOf = (level, p) => level.prices?.[p] ?? (p === "notBought" ? boughtPrice(level) : POOLS[p].price);
/** What the level's optional purchase costs a barrel: handed back for what isn't bought. */
const boughtPrice = level => { const s = Object.keys(level.bought || {}).find(x => POOLS.notBought.accept.includes(x)); return s ? (level.prices?.[s] ?? BOUGHT[s] ?? 0) : 0; };
/** A bought stream's price, handed back for each barrel of it left with the seller. */
export const refundOf = (level, s) => level.prices?.[s] ?? BOUGHT[s] ?? 0;
/** A failed spec in words: "RON 93.2 under 95.0", "not all jet grade". */
export function failText(f) {
  if (PROPS[f.k].flag) return f.k === "grade" ? "untreated kerosene in it" : "not an asphaltic crude's residue";
  return `${/^[A-Z]{2,}/.test(PROPS[f.k].name) ? PROPS[f.k].name : PROPS[f.k].name.toLowerCase()} ${fmtProp(f.k, f.v)} ${f.dir === "min" ? "under" : "over"} ${fmtProp(f.k, f.lim)}`;
}
/** A property's value as it reads, with its unit: 10 ppm, 0.45%, 845 kg/m³, RON 95.0. */
export function fmtProp(k, v) {
  if (v == null || Number.isNaN(v)) return "–";
  if (k === "s") return v >= 1000 ? `${+(v / 10000).toFixed(v >= 10000 ? 1 : 2)}%` : `${v < 10 ? +v.toFixed(1) : Math.round(v)} ppm`;
  if (k === "visc") return `${v >= 1000 ? Math.round(v).toLocaleString("en-GB") : +v.toFixed(v < 10 ? 1 : 0)} cSt`;
  if (PROPS[k].flag) return v >= 0.999 ? "yes" : "no";
  const n = v.toFixed(PROPS[k].dp ?? 1);
  return PROPS[k].unit ? `${n}${PROPS[k].unit.startsWith("%") ? "%" : ` ${PROPS[k].unit}`}` : n;
}

// ---------- par: the LP's plan ----------
// A refinery LP is linear except where a stream's quality depends on the plan: a treater's diesel is as good as the
// mix of feeds it was given, a cracker's products as sour as its feed. Planners solve that by successive linear
// programming: solve with each stream's quality as the current plan makes it, plus how that quality would move as its
// feeds move (the gradient), take the step, recompute, and solve again. Started from several plans, the best one that
// really runs in spec is par.

/** The LP's columns for a level: one per stream and destination, and the hydrogen plant's, imports' and spare's. */
function columnsOf(level) {
  const streams = streamsOf(level), vars = [], idx = new Map();
  for (const s of streams) for (const d of destinations(level, s)) { idx.set(`${s}>${d}`, vars.length); vars.push([s, d]); }
  const H2P = level.units.includes("smr") ? vars.push(["h2", "plant"]) - 1 : -1;
  const H2B = vars.push(["h2", "import"]) - 1, H2X = vars.push(["h2", "spare"]) - 1;
  // where each stream comes from: the crude or bought in (a constant), and the units' columns that make it
  const made = {};
  for (const [j, [f, u]] of vars.entries()) {
    if (!UNITS[u]) continue;
    for (const [o, y] of Object.entries(yieldsOf(level, u, f))) (made[o] || (made[o] = [])).push([j, y, f, u]);
  }
  return { streams, vars, idx, H2P, H2B, H2X, made };
}
/**
 * The LP at a point: the streams' properties (q, and each feed's, which set each product's), the flows there (x0,
 * per column) and each stream's volume (v0). With gradient, a spec row also carries how the blend's quality moves as a
 * stream's sources move; without, it's the planners' plain recursion.
 */
function buildLP(level, cols, q, x0, gradient) {
  const F = feedOf(level), crude = crudeOf(level), has = u => level.units.includes(u);
  const { streams, vars, idx, H2P, H2B, H2X, made } = cols;
  const n = vars.length, c = new Float64Array(n), rows = [], tag = [], elastic = [];
  vars.forEach(([s, d], j) => { if (POOLS[d]) c[j] = d === "notBought" ? refundOf(level, s) : priceOf(level, d); else if (UNITS[d]) c[j] = -UNITS[d].opex; });
  if (H2P >= 0) c[H2P] = -H2_PRICE;
  c[H2B] = -H2_PRICE * H2_IMPORT; c[H2X] = 2;
  const supply = s => F * (crude.cuts[s] || 0) + (level.bought?.[s] || 0);
  // balances: everything a stream goes to equals what's made of it
  for (const s of streams) {
    const a = {};
    for (const d of destinations(level, s)) a[idx.get(`${s}>${d}`)] = 1;
    for (const [j, y] of made[s] || []) a[j] = (a[j] || 0) - y;
    rows.push({ a, op: "=", b: supply(s) }); tag.push(["stream", s]);
  }
  for (const u of level.units) {
    const cap = level.caps?.[u];
    if (cap == null || !UNITS[u].feeds.length) continue;
    const a = {};
    for (const f of UNITS[u].feeds) if (idx.has(`${f}>${u}`)) a[idx.get(`${f}>${u}`)] = 1;
    if (Object.keys(a).length) { rows.push({ a, op: "<=", b: cap }); tag.push(["cap", u]); }
  }
  // co-processing: a renewable feed at most its share of what the unit runs, (1 − share) of it against share of the rest
  for (const u of level.units) {
    const co = coLimits(level, u);
    for (const [f, lim] of Object.entries(co)) {
      if (!idx.has(`${f}>${u}`)) continue;
      const a = { [idx.get(`${f}>${u}`)]: 1 - lim };
      for (const g of UNITS[u].feeds) if (!(g in co) && idx.has(`${g}>${u}`)) a[idx.get(`${g}>${u}`)] = -lim;
      rows.push({ a, op: "<=", b: 0 }); tag.push(["co", u, f]);
    }
  }
  {
    const a = {};
    for (const [j, [f, u]] of vars.entries()) if (UNITS[u]?.h2?.[f]) a[j] = UNITS[u].h2[f];
    if (H2P >= 0) a[H2P] = 1;
    a[H2B] = 1; a[H2X] = -1;
    rows.push({ a, op: "=", b: 0 }); tag.push(["h2"]);
    if (H2P >= 0 && level.caps?.smr != null) { rows.push({ a: { [H2P]: 1 }, op: "<=", b: level.caps.smr }); tag.push(["cap", "smr"]); }
    if (level.h2Import === false) { rows.push({ a: { [H2B]: 1 }, op: "<=", b: 0 }); tag.push(["cap", "h2import"]); }
  }
  // the products a unit makes from a feed, with their properties at this point
  const prodCache = new Map();
  const product = (u, f, o) => { const key = `${u}|${f}|${o}`; if (!prodCache.has(key)) prodCache.set(key, productProps(level, u, f, o, q[f] || ownProps(level, f))); return prodCache.get(key); };
  {
    const a = {};
    for (const [j, [f, u]] of vars.entries()) {
      if (!UNITS[u]) continue;
      const fp = q[f] || {};
      let out = 0;
      for (const [o, y] of Object.entries(yieldsOf(level, u, f))) { const p = product(u, f, o); out += y * (p.d || 0) * (p.s || 0); }
      const r = Math.max(0, (fp.d || 0) * (fp.s || 0) - out) * T_PER_KB / 1e9;
      if (r > 0) { a[j] = r; c[j] += (r * (SULPHUR.price - SULPHUR.cost)) / 1000; }
    }
    const cap = has("sru") ? level.caps?.sru : 0;
    if (cap != null && Object.keys(a).length) { rows.push({ a, op: "<=", b: cap }); tag.push(["cap", "sru"]); }
  }
  if (level.ticket) ticketTerms(level, cols, q, x0, c, product);
  // specs: each a linear limit on a pool's blend. A stream contributes its volume times how far its quality is past the
  // limit (by mass, times its density, for a mass property); with the gradient, also how that would change as each of
  // its sources (the crude, or a unit's column) gave more or less of it
  const term = (k, p, w, L) => { const val = p[k] ?? (ZERO.has(k) ? 0 : null); return val == null ? null : (PROPS[k].basis === "mass" ? (p.d || 0) : 1) * (toIndex(k, val) - L) * w; };
  for (const pl of poolsOf(level)) {
    for (const k of specsOf(level, pl)) {
      const [lo, hi] = limitOf(level, pl, k);
      for (const [lim, op] of [[lo, ">="], [hi, "<="]]) {
        if (lim == null) continue;
        const a = {}, L = toIndex(k, inside(k, lim, op)), add = (j, v) => { if (Math.abs(v) > 1e-12) a[j] = (a[j] || 0) + v; };
        for (const s of streams) {
          if (!idx.has(`${s}>${pl}`)) continue;
          const jp = idx.get(`${s}>${pl}`), M = term(k, q[s] || ownProps(level, s), 1, L);
          if (M == null) continue;
          add(jp, M);
          const V = x0 && (x0.vol[s] || 0);
          if (!gradient || !V || !(x0.x[jp] > 1e-9) || !made[s]) continue;
          // d(x·M)/d(source) = x × (e − M·b)/V, for each unit column making the stream (the crude's share is fixed)
          for (const [j, y, f, u] of made[s]) {
            const e = term(k, product(u, f, s), y, L);
            if (e != null) add(j, (x0.x[jp] * (e - M * y)) / V);
          }
        }
        if (!Object.keys(a).length) continue;
        // elastic: a violation is allowed at a penalty far above any margin, so the LP always has a plan and the
        // steps walk out of an infeasible start; each row is scaled first, so the penalty means the same for all
        const big = Math.max(...Object.values(a).map(Math.abs));
        for (const j of Object.keys(a)) a[j] /= big;
        a[n + elastic.length] = op === ">=" ? 1 : -1;
        elastic.push(1);
        rows.push({ a, op, b: 0 }); tag.push(["spec", pl, k, op]);
      }
    }
    const cap = level.markets?.[pl];
    if (cap != null) {
      const a = {};
      for (const s of streams) if (idx.has(`${s}>${pl}`)) a[idx.get(`${s}>${pl}`)] = 1;
      rows.push({ a, op: "<=", b: cap }); tag.push(["market", pl]);
    }
  }
  // the elastic columns, each costing the penalty
  const cc = new Float64Array(n + elastic.length);
  cc.set(c);
  cc.fill(-1e5, n);
  return { n: n + elastic.length, c: cc, rows, tag };
}
/**
 * Tickets in the LP's objective. A barrel's saving is earned only where it's finally sold, often several units on (fats
 * into the FCC, its naphtha through the post-treater, into petrol), so each stream's saving is valued at what a kilogram
 * of it earns downstream as the plan now routes it (tau, worked back from the pools), and every column is credited with
 * the saving it moves on, at its destination's value, less the value it had where it was: a first-order view that holds
 * however long the chain is, as the specs' one-step gradient wouldn't.
 */
function ticketTerms(level, cols, q, x0, c, product) {
  const { streams, vars, idx } = cols, ghg = s => (q[s] || ownProps(level, s)).ghg || 0;
  const k = pl => (level.ticket * (POOLS[pl].tickets || 0)) / 1000;
  // how much of a kilogram of a feed's saving each product of a unit carries on: all of it into a carried product (a
  // treater's), a share by volume into the others, none into a product that has a saving of its own
  const pass = (u, f) => {
    const ys = yieldsOf(level, u, f), tot = Object.values(ys).reduce((a, b) => a + b, 0) || 1, carry = UNITS[u].carry?.to;
    return Object.entries(ys).map(([o, y]) => [o, STREAMS[o].p.ghg != null ? 0 : o === carry ? y : y / tot]);
  };
  const share = s => {
    const ds = destinations(level, s).filter(d => idx.has(`${s}>${d}`)), tot = x0 ? ds.reduce((a, d) => a + x0.x[idx.get(`${s}>${d}`)], 0) : 0;
    return tot > 1e-9 ? ds.map(d => [d, x0.x[idx.get(`${s}>${d}`)] / tot]) : [[homeOf(level, s), 1]];
  };
  const tau = Object.fromEntries(streams.map(s => [s, 0])), via = (s, d) => (POOLS[d] ? k(d) : pass(d, s).reduce((a, [o, r]) => a + r * (tau[o] || 0), 0));
  // worked back from the pools: a chain is at most a few units long
  for (let pass_ = 0; pass_ < 8; pass_++) for (const s of streams) tau[s] = share(s).reduce((a, [d, f]) => a + f * via(s, d), 0);
  vars.forEach(([s, d], j) => {
    if (!STREAMS[s]) return;
    const out = POOLS[d] ? ghg(s) * k(d) : Object.entries(yieldsOf(level, d, s)).reduce((a, [o, y]) => a + y * (product(d, s, o).ghg || 0) * (tau[o] || 0), 0);
    c[j] += out - ghg(s) * tau[s];
  });
}
/** A limit pulled a hair inside itself, so a plan on the boundary still passes when it's run. */
function inside(k, lim, op) {
  if (PROPS[k].flag) return lim;
  const m = Math.max({ s: 0.03, visc: 0.3, d: 0.1 }[k] ?? 0.02, Math.abs(lim) * 5e-4);
  return op === ">=" ? lim + m : lim - m;
}
/** A routing from flows: each stream's shares of what it made. */
function routingOf(cols, x) {
  const r = {};
  for (const [j, [s, d]] of cols.vars.entries()) if (STREAMS[s] && x[j] > 1e-7) (r[s] || (r[s] = {}))[d] = x[j];
  for (const s of Object.keys(r)) {
    const t = Object.values(r[s]).reduce((a, b) => a + b, 0);
    for (const d of Object.keys(r[s])) { r[s][d] = r[s][d] / t; if (r[s][d] < 1e-5) delete r[s][d]; }
  }
  return r;
}
/** The flows a run of the refinery made, per LP column, and each stream's volume. */
function flowsOf(cols, res) {
  const x = new Float64Array(cols.vars.length), vol = {};
  for (const [j, [s, d]] of cols.vars.entries()) x[j] = res.streams[s]?.to?.[d] || 0;
  for (const [s, st] of Object.entries(res.streams)) vol[s] = st.vol;
  return { x, vol };
}
/** Every stream's properties as a run makes them (a stream not made keeps its guess). */
function propsFrom(res, q) {
  const out = { ...q };
  for (const [s, st] of Object.entries(res.streams)) if (st.vol > 1e-6) out[s] = st.props;
  return out;
}
/** First guesses at every stream's properties: a crude's cuts their own, a unit's products as made from its first feed. */
function guessProps(level) {
  const q = {}, crude = crudeOf(level);
  for (const s of streamsOf(level)) q[s] = ownProps(level, s);
  for (const u of ORDER) {
    if (!level.units.includes(u) || !UNITS[u].yields) continue;
    for (const f of Object.keys(UNITS[u].yields)) {
      if (!q[f]) continue;
      for (const o of Object.keys(yieldsOf(level, u, f))) if (!crude.cuts[o]) q[o] = productProps(level, u, f, o, q[f]);
    }
  }
  return q;
}
/** A plan that really runs: every pool in spec, the sulphur plant within its capacity, nothing with nowhere to go. */
const inSpec = res => Object.values(res.pools).every(p => p.inSpec || p.vol <= 1e-4) && res.sulphur.over <= 0.01 && !res.issues.some(i => i.kind === "lost" || i.kind === "h2short");
/** Shares mixed: (1 − t) of one routing's flows and t of another's, as shares. */
function mix(cols, a, b, t) {
  const x = new Float64Array(a.length);
  for (let j = 0; j < a.length; j++) x[j] = (1 - t) * a[j] + t * b[j];
  return routingOf(cols, x);
}
/**
 * Successive LP from a routing: solve at the point, move to the solution, recompute every stream's quality there, and
 * solve again, until the plan settles (a step that loses ground is taken halfway instead). Returns the best plan that
 * runs in spec, { margin, routing, result, lp }, or null.
 */
function slp(level, cols, routing, q0, steps = 12) {
  let res = evaluate(level, routing), q = propsFrom(res, q0), best = null;
  const keep = (r, rt, lp) => { if (inSpec(r) && (!best || r.margin > best.margin + 1e-9)) best = { margin: r.margin, routing: rt, result: r, lp }; };
  keep(res, routing, null);
  for (let it = 0; it < steps; it++) {
    // the gradient's linear view can promise blends that can't exist; then the plain recursion's view at this point
    const at = flowsOf(cols, res);
    let model = buildLP(level, cols, q, at, true), sol = simplex(model.n, model.c, model.rows);
    if (sol.status !== "optimal") { model = buildLP(level, cols, q, at, false); sol = simplex(model.n, model.c, model.rows); }
    if (sol.status !== "optimal") break;
    const lp = { ...model, sol };
    let rt = routingOf(cols, sol.x), r = evaluate(level, rt);
    keep(r, rt, lp);
    if (r.margin < res.margin - 1e-6 && inSpec(res)) {
      const rt2 = mix(cols, at.x, sol.x, 0.5), r2 = evaluate(level, rt2);
      keep(r2, rt2, lp);
      if (r2.margin > r.margin) { rt = rt2; r = r2; }
    }
    const moved = cols.vars.some(([s, d], j) => Math.abs((r.streams[s]?.to?.[d] || 0) - at.x[j]) > 1e-4);
    res = r; routing = rt; q = propsFrom(res, q);
    if (!moved) break;
  }
  return best;
}
/**
 * Exact local moves on a plan, the real refinery judging each: a share of a stream moved to another destination (all
 * of it, half, a fifth, a twentieth, a hundredth), kept if the margin rises. It finds what the LP's linear view of
 * the blends misses, such as a stream better kept out of a treater altogether.
 */
export function polish(level, routing, { budget = 4000 } = {}) {
  let rt = normalise(level, routing), res = evaluate(level, rt), evals = 0;
  const streams = streamsOf(level);
  for (let pass = 0; pass < 8 && evals < budget; pass++) {
    let improved = false;
    for (const s of streams) {
      if (!res.streams[s] || res.streams[s].vol < 1e-6) continue;
      const dests = destinations(level, s);
      if (dests.length < 2) continue;
      for (const d of dests) {
        for (const f of [1, 0.5, 0.2, 0.05, 0.01]) {
          const cur = rt[s][d] || 0;
          if (cur >= 1 - 1e-9) break;
          const take = Math.min(f, 1 - cur), next = {};
          // the share taken from the stream's other destinations in proportion
          for (const [x, v] of Object.entries(rt[s])) if (x !== d) next[x] = v * (1 - (cur + take)) / (1 - cur);
          next[d] = cur + take;
          const trial = { ...rt, [s]: next }, r = evaluate(level, trial);
          evals++;
          if ((inSpec(r) || !inSpec(res)) && (r.margin > res.margin + 1e-7 || (inSpec(r) && !inSpec(res)))) { rt = trial; res = r; improved = true; break; }
        }
      }
    }
    if (!improved) break;
  }
  return { margin: res.margin, routing: rt, result: res, evals };
}
/**
 * Par: the best plan found by successive LP from several starts (the default routing, and the plain recursion's plan),
 * kept only if every pool really meets its specs when the refinery runs it. Returns { margin, routing, result,
 * values: { stream: $/bbl }, capacity: { unit: $/bbl } }: the marginal values are the last LP's duals.
 */
export function solve(level, { starts: extra = [], tries = 6 } = {}) {
  const cols = columnsOf(level), q0 = guessProps(level), starts = [defaultRouting(level), ...extra];
  // every stream into the first unit that takes it, and a few seeded random plans: the blends' nonlinearity has local
  // optima, and a plan started elsewhere finds the others
  starts.push(Object.fromEntries(streamsOf(level).map(s => [s, { [destinations(level, s)[0]]: 1 }])));
  let seed = 20261026;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < tries; k++) starts.push(Object.fromEntries(streamsOf(level).map(s => [s, Object.fromEntries(destinations(level, s).map(d => [d, rnd()]))])));
  // the plain recursion's first plan, on the guessed properties
  const rec = buildLP(level, cols, q0, null, false), sol = simplex(rec.n, rec.c, rec.rows);
  if (sol.status === "optimal") starts.push(routingOf(cols, sol.x));
  let best = null;
  for (const r of starts) {
    const out = slp(level, cols, r, q0);
    if (out && (!best || out.margin > best.margin + 1e-9)) best = out;
  }
  if (!best) { const res = evaluate(level, defaultRouting(level)); best = { margin: res.margin, routing: defaultRouting(level), result: res, lp: null, infeasible: true }; }
  // alternate: exact moves find what the LP misses, the LP then fine-tunes the splits from there
  for (let round = 0; round < 4; round++) {
    const p = polish(level, best.routing, { budget: 3000 });
    if (!(p.margin > best.margin + 1e-6) || !inSpec(p.result)) break;
    best = { ...p, lp: best.lp };
    const again = slp(level, cols, p.routing, q0);
    if (again && again.margin > best.margin + 1e-6) best = { ...again, lp: again.lp || best.lp };
  }
  const values = {}, capacity = {};
  if (best.lp) best.lp.tag.forEach((t, r) => {
    if (t[0] === "stream") values[t[1]] = best.lp.sol.duals[r];
    if (t[0] === "cap") capacity[t[1]] = best.lp.sol.duals[r];
  });
  return { margin: best.margin, routing: normalise(level, best.routing), result: best.result, values, capacity };
}
