// Pipes as a roguelike, in Balatro's spirit. A run is a string of jobs chosen from doors: each door shows its job's
// twist and the boon that delivering it earns. Boons sit in five slots and change how a level plays and scores; most
// fire as the oil passes the tiles they care about, so the route you lay is the hand you play. A delivery scores
// netback × mult: netback is what the terminals pay less pipe and pumps plus time, mult starts at 1 and boons raise it.
// An act's fifth level is its finale: a big contract that pays double, with a boss bending a rule and a quota the
// delivery must reach. Boons are rewards only: points stay the score and buy the tools. Pure rules, the same for
// everyone on the same seed and the same choices: pipes.js draws them, tests/pipes.mjs checks them.
import { levelOf, actOf, ACT_LENGTH, COSTS } from "./pipes-engine.js";

export const SLOTS = 5;
const PIPES = new Set(["straight", "bend", "cross", "pump"]);     // the tiles a route is laid with (not its ends)

/**
 * The boons. tier: 1 common (a door with no twist), 2 uncommon (most twisted doors), 3 rare (finales, and a twisted
 * door one time in three). tile(t, path): what a boon does as the oil enters a tile (t: the trail's entry; path: what
 * came before it on the same product's line); end(sum, ctx): what it does at delivery. Either returns { chips (added
 * to netback), mult (added to mult), xmult (multiplying it) } or nothing. A boon without either works through the
 * level's terms (termsFor). Held at most once each; a boon swapped out can come round again.
 */
export const BOONS = {
  // bends
  serpent: { tier: 1, icon: "🐍", name: "Serpentine", about: "+0.15 mult for each bend the oil passes.", tile: t => (t.kind === "bend" ? { mult: 0.15 } : null) },
  elbow: { tier: 1, icon: "💪", name: "Elbow grease", about: "+20 netback for each bend the oil passes.", tile: t => (t.kind === "bend" ? { chips: 20 } : null) },
  hairpin: { tier: 2, icon: "🪝", name: "Hairpin", about: "×1.2 mult for every three bends in a row.", tile: (t, p) => (t.kind === "bend" && p.bendRun % 3 === 0 ? { xmult: 1.2 } : null) },
  winding: { tier: 3, icon: "🏞️", name: "Winding river", about: "+0.02 mult for every bend the oil has passed since you took it.", grows: "bends",
    end: (s, c) => ({ mult: 0.02 * ((c.grow?.winding || 0) + s.bends) }) },
  // straights
  trunk: { tier: 1, icon: "🛤️", name: "Trunk line", about: "+0.3 mult for each straight the oil passes.", tile: t => (t.kind === "straight" ? { mult: 0.3 } : null) },
  express: { tier: 2, icon: "🚄", name: "Express", about: "+1 mult for each straight that follows a straight.", tile: (t, p) => (t.kind === "straight" && p.prev === "straight" ? { mult: 1 } : null) },
  // crossings
  junction: { tier: 1, icon: "🔀", name: "Junction", about: "+1 mult for each crossing the oil passes.", tile: t => (t.kind === "cross" ? { mult: 1 } : null) },
  spaghetti: { tier: 2, icon: "🍝", name: "Spaghetti junction", about: "×1.5 mult for each crossing carrying two products.", tile: t => (t.kind === "cross" && t.second ? { xmult: 1.5 } : null) },
  // pumps
  booster: { tier: 1, icon: "🔋", name: "Booster", about: "+100 netback for each pump the oil passes.", tile: t => (t.kind === "pump" ? { chips: 100 } : null) },
  compressor: { tier: 2, icon: "🌀", name: "Compressor", about: "×1.2 mult for each pump the oil passes.", tile: t => (t.kind === "pump" ? { xmult: 1.2 } : null) },
  bypass: { tier: 2, icon: "🛣️", name: "Bypass", about: "×2 mult if the oil passes no pump.", end: s => (s.pumps === 0 ? { xmult: 2 } : null) },
  pumpjack: { tier: 3, icon: "🛢️", name: "Pump jack", about: "×0.05 more mult for every pump the oil has passed since you took it.", grows: "pumps",
    end: (s, c) => ({ xmult: 1 + 0.05 * ((c.grow?.pumpjack || 0) + s.pumps) }) },
  pumps: { tier: 2, icon: "💨", name: "High-pressure pumps", about: "Pressure lasts two tiles more: some direct lines stop running dry." },
  // length
  haul: { tier: 1, icon: "🚚", name: "Long haul", about: "+1 mult for every 8 tiles of pipe the oil fills.", tile: (t, p) => (PIPES.has(t.kind) && p.pipe % 8 === 0 ? { mult: 1 } : null) },
  golden: { tier: 3, icon: "✨", name: "Golden pipe", about: "×0.04 more mult for each tile of pipe beyond 20.", end: s => (s.pipe > 20 ? { xmult: 1 + 0.04 * (s.pipe - 20) } : null) },
  steel: { tier: 1, icon: "🔩", name: "Cheap steel", about: "Pipe costs 7 a tile, not 10." },
  // time
  early: { tier: 2, icon: "🐦", name: "Early bird", about: "Fill it now: +0.1 mult for each second of planning left.", end: (s, c) => (c.planLeft > 0 ? { mult: 0.1 * Math.floor(c.planLeft / 1000) } : null) },
  clockwork: { tier: 3, icon: "⏱️", name: "Clockwork", about: "+0.4 mult for every 10 s of time bonus left.", end: (s, c) => (c.msLeft >= 10000 ? { mult: 0.4 * Math.floor(c.msLeft / 10000) } : null) },
  survey: { tier: 1, icon: "📐", name: "Survey team", about: "5 s more planning every level." },
  window: { tier: 1, icon: "⏳", name: "Long window", about: "The time bonus counts down from 120 s, not 90." },
  choke: { tier: 2, icon: "🐢", name: "Choke valve", about: "The oil flows 15% slower." },
  fill: { tier: 2, icon: "🪣", name: "Fast fill", about: "Fill it now counts its time at ×6, not ×4." },
  // tools
  thrift: { tier: 1, icon: "🪙", name: "Thrift", about: "+2 mult on a level you use no tools.", end: (s, c) => (!c.toolsUsed ? { mult: 2 } : null) },
  toolsmith: { tier: 2, icon: "🛠️", name: "Toolsmith", about: "+1 mult for each tool you use in the level.", end: (s, c) => (c.toolsUsed ? { mult: c.toolsUsed } : null) },
  marked: { tier: 2, icon: "✅", name: "Surveyor's marks", about: "+0.5 mult for each ✓-marked pipe the oil passes.", tile: t => (t.marked && PIPES.has(t.kind) ? { mult: 0.5 } : null) },
  supplier: { tier: 1, icon: "🏷️", name: "Supplier discount", about: "Tools cost 30% less." },
  parts: { tier: 1, icon: "🧰", name: "Spare parts", about: "Auto-turn is on offer every level." },
  kit: { tier: 2, icon: "🎒", name: "Wide kit", about: "Four tools on offer, not three." },
  restock: { tier: 2, icon: "📦", name: "Restock", about: "Every tool on offer has a use more." },
  prelaid: { tier: 3, icon: "📏", name: "Pre-laid", about: "Each route's first two pipes start turned the right way (and ✓-marked)." },
  // market and products
  interest: { tier: 1, icon: "🏦", name: "Interest", about: "After each delivery, 5% of your points on top, up to 300." },
  buyers: { tier: 1, icon: "💰", name: "Premium buyers", about: "Terminals pay 15% more." },
  green: { tier: 2, icon: "🌿", name: "Green premium", about: "HVO and bio-naphtha pay double.", end: s => (s.green ? { chips: s.green } : null) },
  speculator: { tier: 2, icon: "📉", name: "Speculator", about: "+2 mult while crude trades below list.", end: (s, c) => ((c.market?.crude ?? 1) < 1 ? { mult: 2 } : null) },
  hedge: { tier: 2, icon: "🛡️", name: "Hedge", about: "Crude and HVO prices never drift below list." },
  refinery: { tier: 3, icon: "🏭", name: "Integrated refinery", about: "×1.5 mult for each product delivered beyond the first.", end: s => (s.products > 1 ? { xmult: 1.5 ** (s.products - 1) } : null) },
  // the ground
  wildcat: { tier: 2, icon: "🪨", name: "Wildcat", about: "+1 mult for each rock beside the oil's path.", end: s => (s.rocks ? { mult: s.rocks } : null) },
  // risk
  streak: { tier: 2, icon: "🔥", name: "Clean record", about: "+0.3 mult for each level in a row delivered without a spill.", end: (s, c) => ({ mult: 0.3 * ((c.streak || 0) + 1) }) },
  contrarian: { tier: 3, icon: "🎲", name: "Contrarian", about: "×2 mult on any job with a twist (finales count).", end: (s, c) => (c.twist && c.twist !== "none" ? { xmult: 2 } : null) },
  insurance: { tier: 3, icon: "☂️", name: "Insurance", about: "The first spill in each act costs no life, and keeps your record clean." },
  crew: { tier: 3, icon: "👷", name: "Spare crew", about: "A life now, and room for four while you hold it." },
  leverage: { tier: 3, icon: "⚖️", name: "Leverage", about: "Terminals pay 50% more, but a spill costs two lives." },
  // the run itself
  broker: { tier: 3, icon: "🤝", name: "Broker", about: "Four jobs to choose from, not three." },
  contracts: { tier: 3, icon: "📜", name: "Big contracts", about: "Act finales pay triple, not double." },
  model: { tier: 3, icon: "🖥️", name: "Hydraulic model", about: "A red “dry” marks where a line, as the board stands, would run out of pressure." },
};
export const TIERS = ["Cargo", "Common", "Uncommon", "Rare"];
/** What a door's job does to its level, short enough to share a line with its name on the card. */
export const TWISTS = {
  none: { name: "Standard job", about: "" },
  rush: { name: "Rush job", about: "25% less planning" },
  fast: { name: "Fast flow", about: "Oil 20% faster" },
  rocky: { name: "Rocky ground", about: "Twice the rock" },
  bare: { name: "No tools", about: "None on offer" },
  thin: { name: "Low pressure", about: "Lasts a tile less" },
  finale: { name: "Big contract", about: "Pays double" },
};
const TWISTED = ["rush", "fast", "rocky", "bare", "thin"];
/** An act's finale bends one rule: one boss an act, the same for everyone on the seed. */
export const BOSSES = {
  storm: { name: "Storm", about: "The oil runs 30% faster." },
  drought: { name: "Drought", about: "Pressure lasts two tiles less." },
  strike: { name: "Strike", about: "No tools on offer." },
  quarry: { name: "Quarry", about: "Three times the rock." },
  audit: { name: "Audit", about: "Pipe costs double." },
  regulator: { name: "The Regulator", about: "Your first boon sits this one out." },
};
/** A door's reward once no boon of any tier is left to offer: a cargo, paid in points on delivery. */
export const cargoFor = n => 150 * actOf(n);
export const isFinale = n => levelOf(n).place === ACT_LENGTH - 1;
/** What act a's finale must score (netback × mult), set against simulated runs (tests/pipes.mjs): a build of commons
 *  alone gets through act 2 and fades over acts 3 to 5, doors taken at random over acts 4 to 6, a build chosen for what
 *  it multiplies reaches act 6 or 7. Past act 5, ×2.5 an act, faster than any build grows. */
export const quotaFor = a => [1200, 12000, 36000, 90000, 220000][a - 1] ?? Number((220000 * 2.5 ** (a - 5)).toPrecision(3));
// open-ended acts: actOf caps at the named ones, so the finale's act is counted from the level itself
const actNo = n => 1 + Math.floor((n - 1) / ACT_LENGTH);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mix = (a, b) => (Math.imul(a ^ 0x2545F491, 0x9E3779B1) ^ Math.imul(b + 7, 0x85EBCA77)) >>> 0;
/** Level n's act's boss: the six dealt in a shuffled order for the seed, so no two acts in six share one. */
export function bossFor(seed, n) {
  const r = rng(mix(seed, 1000)), order = Object.keys(BOSSES).map(id => [r(), id]).sort((a, b) => a[0] - b[0]).map(([, id]) => id);
  return order[(actNo(n) - 1) % order.length];
}
/** The quota and boss of level n's finale (null on other levels), for the doors and the level. */
export const finaleOf = (seed, n) => (isFinale(n) ? { quota: quotaFor(actNo(n)), boss: bossFor(seed, n) } : null);
/** The boons that count on a level: all held, but the first sits out a finale under the Regulator. */
export const activeBoons = (held, boss) => (boss === "regulator" ? held.slice(1) : held);

/**
 * The jobs on offer before level n of a run on `seed` holding `held` boons (three, four with Broker), as { twist,
 * reward } (reward a boon's id, or "cargo" if none is left to offer). Level 1: standard jobs for common boons. An act's
 * finale: the big contract, for rare ones. Otherwise a standard job for a common boon and twisted jobs, each for an
 * uncommon one or, one time in three, a rare. A tier that's run dry gives way to the nearest with any left.
 */
export function doorsFor(seed, n, held = []) {
  const r = rng(mix(seed, n)), out = new Set(held), count = held.includes("broker") ? 4 : 3, each = f => Array.from({ length: count }, f);
  const draw = tier => {
    for (const t of [tier, ...[3, 2, 1].filter(t => t !== tier).sort((a, b) => Math.abs(a - tier) - Math.abs(b - tier) || b - a)]) {
      const left = Object.keys(BOONS).filter(id => BOONS[id].tier === t && !out.has(id));
      if (left.length) { const id = left[Math.floor(r() * left.length)]; out.add(id); return id; }
    }
    return "cargo";
  };
  if (n === 1) return each(() => ({ twist: "none", reward: draw(1) }));
  if (isFinale(n)) return each(() => ({ twist: "finale", reward: draw(3) }));
  const twists = TWISTED.map(t => [r(), t]).sort((a, b) => a[0] - b[0]).slice(0, count - 1).map(([, t]) => t);
  return [{ twist: "none", reward: draw(1) }, ...twists.map(twist => ({ twist, reward: draw(r() < 1 / 3 ? 3 : 2) }))];
}

/**
 * Level n's terms under its job, the boons held and (on a finale) the act's boss. `build` is what the board is built
 * with (rock, pressure: the engine proves the board under it); `flow` is how it plays (pressure, planning, the flow's
 * tick), applied once it's built, so High-pressure pumps lets a direct line built to run dry deliver. Then what it pays
 * (tile and pump costs, a pay multiplier, the time bonus window), Fill it now's rate, the market's floor, the tools on
 * offer (null: none), what a spill costs in lives, the boons that count (`boons`) and a finale's boss and quota.
 */
export function termsFor(job, held, n, seed = 0) {
  const twist = job?.twist || "none", fin = twist === "finale" ? finaleOf(seed, n) : null, boss = fin?.boss || null;
  const boons = activeBoons(held, boss), has = id => boons.includes(id), base = levelOf(n), build = {};
  if (twist === "rocky") build.rock = Math.min(0.24, base.rock * 2);
  if (boss === "quarry") build.rock = Math.min(0.3, base.rock * 3);
  if (twist === "thin") build.pressure = base.pressure - 1;
  if (boss === "drought") build.pressure = base.pressure - 2;
  return {
    twist, build, boss, quota: fin?.quota ?? null, boons,
    flow: {
      pressure: (build.pressure ?? base.pressure) + (has("pumps") ? 2 : 0),
      plan: Math.round((base.plan + (has("survey") ? 5000 : 0)) * (twist === "rush" ? 0.75 : 1)),
      tick: Math.round(base.tick * (has("choke") ? 1.15 : 1) * (twist === "fast" ? 0.8 : 1) * (boss === "storm" ? 0.7 : 1)),
    },
    tile: (has("steel") ? 7 : COSTS.tile) * (boss === "audit" ? 2 : 1),
    pump: COSTS.pump,
    pay: (has("buyers") ? 1.15 : 1) * (has("leverage") ? 1.5 : 1) * (twist === "finale" ? (has("contracts") ? 3 : 2) : 1),
    bonusWindow: has("window") ? 120000 : 90000,
    fillRate: has("fill") ? 6 : 4,
    floor: has("hedge") ? 1 : 0.7,
    tools: twist === "bare" || boss === "strike" ? null : { count: has("kit") ? 4 : 3, price: has("supplier") ? 0.7 : 1, uses: has("restock") ? 1 : 0, turn: has("parts") },
    spill: has("leverage") ? 2 : 1,
    insurance: has("insurance"),
    prelaid: has("prelaid"),
    warnDry: has("model"),                   // the dry warning, which the board shows only with Hydraulic model
  };
}

/** A door as its card shows it: the job, what its twist does, a finale's boss and quota, and what delivering it
 *  earns. */
export function describe(door, n, held = [], seed = 0) {
  const t = TWISTS[door.twist], b = BOONS[door.reward], fin = door.twist === "finale" ? finaleOf(seed, n) : null;
  return {
    job: t.name, twist: door.twist === "finale" && held.includes("contracts") ? "Pays triple" : t.about,
    boss: fin ? { id: fin.boss, ...BOSSES[fin.boss] } : null, quota: fin?.quota ?? null,
    reward: b ? { id: door.reward, icon: b.icon, name: b.name, about: b.about, tier: b.tier } : { id: "cargo", icon: "🚢", name: "Bonus cargo", about: `${cargoFor(n)} points on delivery.`, tier: 0 },
  };
}

// ---------- scoring: netback × mult ----------
/** Where trail entry i sits on its product's line: its pipe count so far, the tile before it, the bends in a row. */
function placeOf(trail, i) {
  const t = trail[i];
  let pipe = 0, prev = null, bendRun = 0, run = true;
  for (let j = 0; j <= i; j++) if (PIPES.has(trail[j].kind)) pipe++;
  for (let j = i - 1; j >= 0; j--) {
    if (trail[j].product !== t.product) continue;
    prev ??= trail[j].kind;
    if (run && trail[j].kind === "bend") bendRun++; else run = false;
    if (!run) break;
  }
  return { pipe, prev, bendRun: t.kind === "bend" ? bendRun + 1 : 0 };
}
/** What the boons do as the oil enters trail entry i: [{ id, chips, mult, xmult }], in slot order. */
export function tileEffects(trail, i, boons) {
  const p = placeOf(trail, i), out = [];
  for (const id of boons) { const e = BOONS[id]?.tile?.(trail[i], p); if (e) out.push({ id, ...e }); }
  return out;
}
/** The level as delivered, for end-of-level boons: tile counts, products delivered, rocks beside the path, and
 *  what HVO and bio-naphtha paid (for Green premium). */
export function summarize(level, run, revenueOf) {
  const s = { bends: 0, straights: 0, crosses: 0, pumps: 0, pipe: 0, products: 0, rocks: 0, green: 0 };
  for (const t of run.trail || []) {
    if (!PIPES.has(t.kind)) continue;
    s.pipe++;
    if (t.kind === "bend") s.bends++; else if (t.kind === "straight") s.straights++; else if (t.kind === "cross") s.crosses++; else s.pumps++;
  }
  s.products = new Set(run.reached.map(i => level.terminals[i].product)).size;
  for (const i of run.reached) if (["hvo", "naphtha"].includes(level.terminals[i].product)) s.green += revenueOf(i);
  const rocks = new Set();
  for (const t of run.trail || []) for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const x = t.x + dx, y = t.y + dy;
    if (run.tiles[y]?.[x]?.kind === "rock") rocks.add(`${x},${y}`);
  }
  s.rocks = rocks.size;
  return s;
}
/**
 * A delivered level's score: netback × mult. Netback is what the terminals reached pay (at the market and the job's
 * pay), less pipe (every tile the oil fills) and pumps, plus time (a point a tenth of a second of the bonus window
 * left), plus what boons add; mult is 1 plus what boons add, times what they multiply, so the order of the slots never
 * matters. ctx: { msLeft, market, terms, grow (scaling boons' counts), streak, toolsUsed, planLeft (Fill it now's) }.
 * Returns { netback, mult, total, base: { revenue, pipe, pumps, time }, boons: [{ id, chips, mult, xmult, times }] (each
 * boon's share, in slot order), sum }.
 */
export function tally(level, run, context) {
  const ctx = { ...context, twist: context.terms.twist }, { terms } = ctx, boons = terms.boons || [], market = ctx.market || {};
  const revenueOf = i => level.terminals[i].price * (market[level.terminals[i].product] ?? 1) * terms.pay;
  const base = {
    revenue: Math.round(run.reached.reduce((s, i) => s + revenueOf(i), 0)),
    pipe: terms.tile * (run.trail?.length ?? run.tilesFilled),
    pumps: terms.pump * run.pumpsFired,
    time: Math.round(Math.max(0, ctx.msLeft) / 100),
  };
  const sum = summarize(level, run, revenueOf), share = new Map(boons.map(id => [id, { id, chips: 0, mult: 0, xmult: 1, times: 0 }]));
  const add = (id, e) => { const s = share.get(id); s.chips += e.chips || 0; s.mult += e.mult || 0; s.xmult *= e.xmult || 1; s.times++; };
  (run.trail || []).forEach((t, i) => { for (const e of tileEffects(run.trail, i, boons)) add(e.id, e); });
  for (const id of boons) { const e = BOONS[id]?.end?.(sum, ctx); if (e) add(id, e); }
  const parts = [...share.values()].filter(s => s.times);
  const chips = parts.reduce((t, s) => t + s.chips, 0);
  const mult = +((1 + parts.reduce((t, s) => t + s.mult, 0)) * parts.reduce((t, s) => t * s.xmult, 1)).toFixed(4);
  const netback = Math.round(base.revenue + chips - base.pipe - base.pumps + base.time);
  return { netback, mult, total: Math.max(0, Math.round(netback * mult)), base, boons: parts, sum };
}
/** Interest's share after a delivery: 5% of the points then held (the delivery's included), up to 300. */
export const interestOn = points => Math.min(300, Math.max(0, Math.round(points * 0.05)));
