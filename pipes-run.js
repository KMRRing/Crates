// Pipes as a roguelike: every level is a job, chosen from three doors. A door shows its job's twist (a harder level,
// or none) and the upgrade that delivering it earns; upgrades last the run and change how levels play and pay. An
// act's fifth level is its finale, a big contract (double pay, less planning) for a rare upgrade. Upgrades are
// rewards only: they cost no points, which stay the score and buy the tools. Pure rules, the same for everyone on the
// same seed and the same choices (today's run deals everyone the same doors): pipes.js draws them, tests/pipes.mjs
// checks them.
import { levelOf, actOf, ACT_LENGTH, COSTS } from "./pipes-engine.js";

/** The upgrades, by tier: 1 common (a door with no twist), 2 uncommon (most twisted doors), 3 rare (act finales, and
 *  a twisted door one time in three). Each is held at most once a run: six common, six uncommon, seven rare. */
export const UPGRADES = {
  survey: { tier: 1, name: "Survey team", about: "5 s more planning every level." },
  steel: { tier: 1, name: "Cheap steel", about: "Pipe costs 7 a tile, not 10." },
  buyers: { tier: 1, name: "Premium buyers", about: "Terminals pay 15% more." },
  window: { tier: 1, name: "Long window", about: "The time bonus counts down from 120 s, not 90." },
  supplier: { tier: 1, name: "Supplier discount", about: "Tools cost 30% less." },
  parts: { tier: 1, name: "Spare parts", about: "Auto-turn is on offer every level." },
  pumps: { tier: 2, name: "High-pressure pumps", about: "Pressure lasts two tiles more: some direct lines stop running dry." },
  choke: { tier: 2, name: "Choke valve", about: "The oil flows 15% slower." },
  kit: { tier: 2, name: "Wide kit", about: "Four tools on offer, not three." },
  restock: { tier: 2, name: "Restock", about: "Every tool on offer has a use more." },
  fill: { tier: 2, name: "Fast fill", about: "Fill it now counts its time at ×6, not ×4." },
  hedge: { tier: 2, name: "Hedge", about: "Crude and HVO prices never drift below list." },
  insurance: { tier: 3, name: "Insurance", about: "The first spill in each act costs no life." },
  crew: { tier: 3, name: "Spare crew", about: "A life now, and room for four." },
  prelaid: { tier: 3, name: "Pre-laid", about: "Each route's first two pipes start turned the right way." },
  leverage: { tier: 3, name: "Leverage", about: "Terminals pay 50% more, but a spill costs two lives." },
  broker: { tier: 3, name: "Broker", about: "Four jobs to choose from, not three." },
  contracts: { tier: 3, name: "Big contracts", about: "Act finales pay triple, not double." },
  model: { tier: 3, name: "Hydraulic model", about: "A red “dry” marks where a line, as the board stands, would run out of pressure." },
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
  finale: { name: "Big contract", about: "Pays double, 25% less planning" },
};
const TWISTED = ["rush", "fast", "rocky", "bare", "thin"];
/** A door's reward once every upgrade of every tier is held: a cargo, paid in points on delivery. */
export const cargoFor = n => 150 * actOf(n);
export const isFinale = n => levelOf(n).place === ACT_LENGTH - 1;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mix = (a, b) => (Math.imul(a ^ 0x2545F491, 0x9E3779B1) ^ Math.imul(b + 7, 0x85EBCA77)) >>> 0;

/**
 * The jobs on offer before level n of a run on `seed` holding `owned` upgrades (three, four with Broker), as { twist,
 * reward } (reward an upgrade's id, or "cargo" once the upgrades run out). Level 1: standard jobs for common upgrades.
 * An act's finale: the big contract, for rare ones. Otherwise a standard job for a common upgrade and twisted jobs,
 * each for an uncommon one or, one time in three, a rare. A tier that's run dry gives way to the nearest with any left.
 */
export function doorsFor(seed, n, owned = []) {
  const r = rng(mix(seed, n)), out = new Set(owned), count = owned.includes("broker") ? 4 : 3, each = f => Array.from({ length: count }, f);
  const draw = tier => {
    for (const t of [tier, ...[3, 2, 1].filter(t => t !== tier).sort((a, b) => Math.abs(a - tier) - Math.abs(b - tier) || b - a)]) {
      const left = Object.keys(UPGRADES).filter(id => UPGRADES[id].tier === t && !out.has(id));
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
 * Level n's terms under its job and the upgrades held. `build` is what the board is built with (rock, pressure: the
 * engine proves the board under it); `flow` is how the level plays (pressure, planning, the flow's tick), applied once
 * it's built, so High-pressure pumps lets a direct line built to run dry deliver. Then what it pays (tile and pump
 * costs, a pay multiplier, the time bonus window), Fill it now's rate, the market's floor, the tools on offer (null:
 * none), what a spill costs in lives, and the rest of the run's rules.
 */
export function termsFor(job, owned, n) {
  const has = id => owned.includes(id), base = levelOf(n), twist = job?.twist || "none";
  const build = {};
  if (twist === "rocky") build.rock = Math.min(0.24, base.rock * 2);
  if (twist === "thin") build.pressure = base.pressure - 1;
  return {
    twist,
    build,
    flow: {
      pressure: (build.pressure ?? base.pressure) + (has("pumps") ? 2 : 0),
      plan: Math.round((base.plan + (has("survey") ? 5000 : 0)) * (twist === "rush" || twist === "finale" ? 0.75 : 1)),
      tick: Math.round(base.tick * (has("choke") ? 1.15 : 1) * (twist === "fast" ? 0.8 : 1)),
    },
    tile: has("steel") ? 7 : COSTS.tile,
    pump: COSTS.pump,
    pay: (has("buyers") ? 1.15 : 1) * (has("leverage") ? 1.5 : 1) * (twist === "finale" ? (has("contracts") ? 3 : 2) : 1),
    bonusWindow: has("window") ? 120000 : 90000,
    fillRate: has("fill") ? 6 : 4,
    floor: has("hedge") ? 1 : 0.7,
    tools: twist === "bare" ? null : { count: has("kit") ? 4 : 3, price: has("supplier") ? 0.7 : 1, uses: has("restock") ? 1 : 0, turn: has("parts") },
    spill: has("leverage") ? 2 : 1,
    insurance: has("insurance"),
    prelaid: has("prelaid"),
    warnDry: has("model"),                   // the dry warning, which the board shows only with Hydraulic model
  };
}

/** A door as its card shows it: the job, what its twist does (a finale's with Big contracts held), and what delivering
 *  it earns. */
export function describe(door, n, owned = []) {
  const t = TWISTS[door.twist], u = UPGRADES[door.reward];
  return {
    job: t.name, twist: door.twist === "finale" && owned.includes("contracts") ? t.about.replace("double", "triple") : t.about,
    reward: u ? { name: u.name, about: u.about, tier: u.tier } : { name: "Bonus cargo", about: `${cargoFor(n)} points on delivery.`, tier: 0 },
  };
}
