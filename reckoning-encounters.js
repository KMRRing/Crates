// Courier's encounters (5 November 2026; audit items 33, 61, 66): named patterns of foes that belong together, placed by the composer after a rest.
// Pure data, no engine. A part is [token, lane, t, options]: `t` is seconds of running from the encounter's start (so the shape is the same at
// 10 m/s and at 16, and "staggered launches" are that many seconds apart), `lane` is mirrored at random when the encounter is `mirror`.
// Tokens: c crab, C bruiser, g gull, b barrel, o balloon, T thrower (lobs bottles and anchors, a lane tracer first), R roller (a docker's barrel
// set rolling), K runaway cart (nothing cuts it), S shield bearer (beaten only from above), P Victual Brother (swings in from the water on a
// rope), W patrolling crab (strafes the quay until it sees me), H charger (runs at me before it lunges).
// `from` is the first difficulty (reckoning-biomes.js) and `tier` the first tier (tierAt: it keeps rising past the 3000 m where difficultyAt stops).

export const ENCOUNTERS = {
  pincer: { name: "The pincer", from: 0.05, tier: 0, mirror: false, parts: [["c", -1, 0], ["c", 1, 0]], note: "two crabs close on the middle lane: a jump or a roll when both have launched" },
  "roll-lane": { name: "Roll through the lane", from: 0.08, tier: 0, mirror: true, parts: [["c", 0, 0], ["b", 0, 0.3], ["c", 0, 0.6], ["b", 0, 0.9]], note: "four in one lane, 0.3 s apart: down, down, down" },
  escort: { name: "A bruiser and his escort", from: 0.1, tier: 1, mirror: true, parts: [["C", 0, 0], ["c", 1, 0.9], ["c", -1, 1.4]], note: "the bruiser first, and a cut each for the two behind" },
  "gull-barrel": { name: "A gull over a barrel", from: 0.12, tier: 1, mirror: true, parts: [["b", 0, 0.25], ["g", 0, 0.25], ["g", 1, 1.0]], note: "the jump over the barrel lifts me into the gull" },
  stagger: { name: "Staggered launches", from: 0.15, tier: 1, mirror: true, parts: [["c", -1, 0], ["c", 0, 0.25], ["c", 1, 0.5]], note: "three crabs a quarter second apart: one answer at a time" },
  patrol: { name: "The patrolling crab", from: 0.1, tier: 1, mirror: false, parts: [["W", 0, 0]], note: "a crab strafing the quay: cut it where it stops" },
  chargers: { name: "The chargers", from: 0.2, tier: 2, mirror: true, parts: [["H", -1, 0], ["H", 1, 0.9]], note: "two crabs that run at me before they lunge: the windows come sooner" },
  "docker-run": { name: "The docker's barrel", from: 0.1, tier: 1, mirror: true, parts: [["R", 0, 0], ["c", 1, 1.0]], note: "a barrel set rolling down my lane: jump it late, or step out" },
  "cart-run": { name: "The runaway cart", from: 0.25, tier: 2, mirror: true, parts: [["K", 0, 0], ["R", 1, 0.5]], note: "a cart nothing cuts: out of its lane" },
  thrower: { name: "The bottle thrower", from: 0.2, tier: 2, mirror: true, parts: [["T", 0, 0]], note: "a tracer on the planks, then the bottle: a lane to the side" },
  "shield-wall": { name: "The shield bearer", from: 0.3, tier: 2, mirror: true, parts: [["S", 0, 0]], note: "cuts glance off: over him and down" },
  boarders: { name: "Boarders", from: 0.4, tier: 3, mirror: true, parts: [["P", 1, 0], ["P", -1, 0.25]], note: "two Victual Brothers swing in from the water a quarter second apart" },
  "bottle-line": { name: "Behind the line", from: 0.35, tier: 3, mirror: true, parts: [["T", 0, 1.6], ["S", 1, 0], ["c", -1, 0.4]], note: "a thrower behind a shield and a crab" },
  elite: { name: "The captain's guard", from: 0.55, tier: 4, mirror: true, parts: [["S", -1, 0], ["C", 0, 0.1], ["S", 1, 0.2], ["T", 0, 1.8]], note: "shields on the flanks, a bruiser in the middle, a thrower behind" },
  "pirate-raid": { name: "The Victual Brothers' raid", from: 0.7, tier: 5, mirror: true, parts: [["P", 1, 0], ["P", -1, 0.25], ["T", 0, 1.4], ["H", 0, 2.8]], note: "boarders, a thrower behind them and a charger after" },
};
export const ENCOUNTER_IDS = Object.keys(ENCOUNTERS);

/** How far along the run's tiers (a step every 600 m): unlike difficultyAt it does not stop at 3000 m, and what it opens is the complexity of the encounters. */
export const tierAt = z => Math.max(0, Math.min(8, Math.floor(z / 600)));
/** The chance that a segment is an encounter: none in the first 250 m, then rising with the tiers, and not capped at 3000 m. */
export const encShareAt = z => (z < 250 ? 0 : Math.min(0.5, 0.16 + 0.04 * tierAt(z)));
