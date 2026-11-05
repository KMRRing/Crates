// Courier's endless run is made of SEGMENTS, in three kinds (Korbi, 4 November 2026; docs/courier.md):
//   generated  the rows come whole from a BIOME's rules and a seed;
//   partial    a fixed map (gaps, walls, bridges, ramps) whose spawn slots (`?` on the ground, `~` in the air) the biome fills;
//   made       rows written by hand, as data.
// All three are lists of rows in the grammar of the engine's "sections" (reckoning-engine.js): three cells a row, `!` commands. This file is
// pure (no engine, no page): `makeSegment(biome, seed, d)` gives { rows, pitch, ... } and the engine builds it. A segment is the same for the
// same (biome, seed, difficulty), and never unwinnable by construction: a row has a free lane (at most two hazards, never two crabs side by
// side, carts never in every lane), a gap in the planks has room to land, and every piece of the old quay (a chain over a pit, a wall run) is
// taken whole, as the engine makes it. tests/courier-run.mjs proves it with a bot over many seeds in every biome.
// Difficulty `d` runs 0 to 1 over the first 3000 m (`difficultyAt`): more hazards a row, rarer breathing rows, the harder cells allowed in.

export const difficultyAt = z => Math.max(0, Math.min(1, z / 3000));
import { ENCOUNTERS, tierAt, encShareAt } from "./reckoning-encounters.js";
export { tierAt, encShareAt };

/** mulberry32: a function giving numbers from 0 to 1 from one integer seed. */
export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A biome is a rule set. `cells` are the hazards a row may take: [cell, weight, first difficulty]; `carts` the most blockers (X) in a row
// (a tunnel's walls close in); `rest` the chance of a breathing row; `pitch` metres between rows; `rows` how many a segment has; `coins`
// how rich the quay is (scales the engine's trails); `pieces` the made and partial segments that belong to it, by id.
export const BIOMES = {
  quays: {
    name: "Harbour quays", feel: "Warehouses and bollards: crabs and barrels, gulls overhead, the planks of the quay.",
    cells: [["c", 5, 0], ["b", 4, 0], ["g", 2, 0.1], ["B", 2, 0.15], ["o", 1.5, 0], ["C", 1, 0.45], ["X", 1, 0.3]], carts: 1, rest: 0.18, pitch: [11, 13], rows: [6, 9],
    pieces: ["barrels", "gap", "ferry", "granary", "dock-slam", "ditch", "ramp", "balcony"], tint: { sky: [0, 0, 0], water: 0, dusk: 0 },
    encounters: ["pincer", "roll-lane", "escort", "stagger", "patrol", "docker-run", "thrower", "shield-wall", "bottle-line", "elite", "chargers"],
  },
  salt: {
    name: "The salt road", feel: "Open road between low houses: carts block lanes, barrels in the ruts, ditches to jump, a lot of coin.",
    cells: [["X", 4, 0], ["b", 4, 0], ["c", 2, 0.1], ["B", 1.5, 0.2], ["g", 1, 0.3], ["o", 1, 0]], carts: 2, rest: 0.12, pitch: [11, 13], rows: [6, 9],
    pieces: ["barrels", "gap", "ditch", "toll", "ramp"], tint: { sky: [28, 16, -10], water: 0, dusk: 0.15 },
    encounters: ["pincer", "roll-lane", "patrol", "docker-run", "cart-run", "chargers", "thrower", "escort", "stagger", "shield-wall", "pirate-raid"],
  },
  canal: {
    name: "Canal and locks", feel: "Water on both sides: drawbridges and levers, sluice gates, gulls over the lock.",
    cells: [["c", 3, 0], ["b", 3, 0], ["g", 3, 0], ["o", 2, 0], ["B", 1, 0.2], ["X", 1, 0.3]], carts: 1, rest: 0.22, pitch: [11, 13], rows: [6, 8],
    pieces: ["bridges", "sluices", "ferry", "gap", "ditch", "sky"], tint: { sky: [-6, 6, 16], water: 0.3, dusk: 0 },
    encounters: ["gull-barrel", "stagger", "boarders", "thrower", "patrol", "docker-run", "bottle-line", "pincer", "elite", "pirate-raid"],
  },
  ship: {
    name: "Alongside the ship", feel: "A great hull beside the quay: gulls and beams, barrels rolled off the deck, walls to run along.",
    cells: [["g", 4, 0], ["B", 3, 0], ["b", 3, 0], ["c", 3, 0], ["o", 1.5, 0], ["C", 1, 0.5]], carts: 1, rest: 0.15, pitch: [11, 13], rows: [6, 9],
    pieces: ["granary", "dock-slam", "ferry", "barrels", "climb", "ramp", "balcony", "sky"], tint: { sky: [-4, 0, 10], water: 0.2, dusk: 0.1 },
    encounters: ["gull-barrel", "boarders", "escort", "pincer", "shield-wall", "thrower", "bottle-line", "elite", "pirate-raid", "docker-run"],
  },
  forest: {
    name: "Forest pass", feel: "Trees close over the road: fallen branches to roll under, logs to jump, crows, a few balloons for the children.",
    cells: [["B", 4, 0], ["b", 4, 0], ["c", 3, 0], ["g", 2, 0.1], ["o", 2.5, 0], ["X", 1, 0.35], ["C", 1, 0.5]], carts: 1, rest: 0.2, pitch: [11, 14], rows: [6, 9],
    pieces: ["barrels", "ditch", "gap", "ferry", "ramp", "sky"], tint: { sky: [-14, 8, -8], water: 0, dusk: 0.1 },
    encounters: ["roll-lane", "patrol", "gull-barrel", "chargers", "escort", "stagger", "thrower", "shield-wall", "pincer", "pirate-raid"],
  },
  tunnel: {
    name: "The cellar tunnel", feel: "Under the Kontor: a vault, lamps, narrow ways: carts in two lanes and one left to run, beams, crabs in the damp.",
    cells: [["X", 6, 0], ["B", 3, 0], ["c", 3, 0], ["b", 3, 0], ["C", 1, 0.5]], carts: 2, rest: 0.1, pitch: [11, 12], rows: [7, 10],
    pieces: ["barrels", "toll", "narrows"], tint: { sky: [-30, -26, -20], water: 0, dusk: 0.6 }, dark: true,
    encounters: ["pincer", "roll-lane", "chargers", "escort", "docker-run", "cart-run", "shield-wall", "elite"],
  },
};
export const BIOME_IDS = Object.keys(BIOMES);

const HARD = new Set(["c", "C", "b", "B", "X", "g", "o", "O"]);
const isHaz = c => HARD.has(c);

/** The cells a biome offers at difficulty d, with their weights. */
const offer = (B, d, not = []) => B.cells.filter(([c, , from]) => d >= from && !not.includes(c));
const weighted = (r, list) => {
  const total = list.reduce((n, [, w]) => n + w, 0);
  let x = r() * total;
  for (const [c, w] of list) if ((x -= w) < 0) return c;
  return list[list.length - 1][0];
};

/** One row of three cells for a biome: no more than two hazards, never two crabs side by side, never a cart in every lane, never more
 *  carts than the biome allows (every row therefore has a lane to run in; the crabs' rule is the engine's, from sections). */
function row(B, r, d, lead = null) {
  const cells = [".", ".", "."];
  const p0 = 0.32 - 0.22 * d, p2 = 0.14 + 0.28 * d;
  const x = r();
  const n = x < p0 ? 0 : x < 1 - p2 ? 1 : 2;
  const lanes = [0, 1, 2].sort(() => r() - 0.5);
  if (lead !== null && n > 0) lanes.splice(lanes.indexOf(lead), 1), lanes.unshift(lead);      // a motif: the first hazard's lane is its line
  let carts = 0;
  for (let k = 0; k < n; k++) {
    const lane = lanes[k];
    const not = [];
    if (carts >= B.carts) not.push("X");
    if (cells[lane - 1] === "c" || cells[lane + 1] === "c" || cells[lane - 1] === "C" || cells[lane + 1] === "C") not.push("c", "C");
    const near = [cells[lane - 1], cells[lane + 1]];
    if (near.includes("b")) not.push("g");                       // a jump over a barrel lifts the hero into a gull's reach in the next lane
    if (near.includes("g")) not.push("b");
    const list = offer(B, d, not);
    const cell = weighted(r, list.length ? list : [[".", 1]]);
    if (cell === "X") carts++;
    cells[lane] = cell;
  }
  return cells.join(" ");
}

/** Lines of lanes (0 left, 2 right): a zigzag, a sweep, one lane held, a pair of lanes alternating, a funnel into the middle. */
const MOTIFS = [[0, 1, 2, 1], [0, 1, 2], [2, 1, 0], [1], [0, 2], [0, 0, 2, 2], [1, 0, 1, 2]];

/** A generated segment: rows from the biome, with breathing rows now and then. */
export function genRows(B, r, d) {
  const n = B.rows[0] + Math.floor(r() * (B.rows[1] - B.rows[0] + 1));
  const rows = [];
  // rows are not independent draws (audit 37): from the start of a run a segment may follow a motif, a line of lanes the first hazard of each row keeps to
  const motif = d > 0.02 && r() < 0.35 + 0.3 * d ? MOTIFS[Math.floor(r() * MOTIFS.length)] : null;
  for (let i = 0; i < n; i++) {
    if (i > 0 && r() < B.rest * (1 - 0.6 * d)) { rows.push(". . ."); continue; }
    const rw = row(B, r, d, motif ? motif[i % motif.length] : null);
    rows.push(rw);
    if (rw.includes("C") && i < n - 1) { rows.push(". . ."); i++; }          // a bruiser is cut twice and thrown back between: it is given the row after it
  }
  return rows;
}

// ---------- made and partial segments ----------
// id -> { kind: "made" | "partial", rows, pitch, from (first difficulty), name }. A `?` is a place for the biome to put a hazard on the ground, a `~` one
// in the air (a gull, a balloon); `.` stays empty. Rows keep to the rules above, so a filled slot never shuts a row.
export const PIECES = {
  barrels: { kind: "made", name: "A stack of barrels", rows: [". b .", "b . b", ". b .", "b b .", ". . b", "b . ."], pitch: 11, from: 0 },
  gap: { kind: "partial", name: "A gap in the planks", rows: ["!rest 8", "!gap 5", "!rest 11", "? . ?", "!rest 3", ". ? .", "~ . ."], pitch: 11, from: 0 },
  ditch: { kind: "partial", name: "A ditch", rows: ["!rest 8", "!gap 4.5", "!rest 11", ". ~ .", "? . .", "!rest 8", "!gap 5.5", "!rest 11", ". . ?"], pitch: 11, from: 0.15 },
  ferry: { kind: "made", name: "The ferry gulls", rows: ["!rest 4", "!chain 0", "!rest 4"], pitch: 11, from: 0.1 },
  granary: { kind: "made", name: "A warehouse wall", rows: ["!rest 4", "!wall 0", "!rest 12"], pitch: 11, from: 0.2 },
  "dock-slam": { kind: "made", name: "Over the wall, onto the crabs", rows: ["!rest 4", "!wallslam 0", "!rest 6"], pitch: 11, from: 0.3 },
  bridges: { kind: "made", name: "The drawbridges", rows: ["!rest 4", "K1 . .", "J1 J1 J1", "!rest 4", "c . .", ". K2 .", "J2 J2 J2", "!rest 4"], pitch: 12, from: 0 },
  sluices: { kind: "made", name: "The sluice gates", rows: ["!rest 4", "W0 W1 W2", "c . .", "W2 W0 W1", "!rest 4"], pitch: 12, from: 0.1 },
  ramp: { kind: "made", name: "A ramp to the loft", rows: ["!rest 4", "!ramp 0", "!rest 8"], pitch: 11, from: 0.1 },
  balcony: { kind: "made", name: "A jump pad to the balcony", rows: ["!rest 4", "!balcony 0", "!rest 8"], pitch: 11, from: 0.2 },
  sky: { kind: "made", name: "Nothing but balloons", rows: ["!rest 4", "!sky 0", "!rest 8"], pitch: 11, from: 0.3 },
  climb: { kind: "made", name: "The ship's side", rows: ["!rest 4", "!climb 0", "!rest 8"], pitch: 11, from: 0.35 },
  narrows: { kind: "made", name: "The narrows", rows: ["!rest 4", ". X X", "$ X X", "X . X", "X $ X", "X X .", "X X $", "X . X", ". X X", "!rest 4"], pitch: 11, from: 0.1 },
  toll: { kind: "made", name: "The toll booth", rows: ["!rest 4", "1 2 3", "T1 T2 T3", "!rest 4"], pitch: 12, from: 0 },
};
const SLOT_HAZ = { ground: ["c", "b", "B"], air: ["g", "o"] };

/** Fills a partial segment's slots from the biome: a slot is a hazard (by the biome's own weights) or stays empty, and a row that already holds two
 *  hazards takes none. */
function fillSlots(B, rows, r, d) {
  return rows.map(rw => {
    if (rw[0] === "!" || !/[?~]/.test(rw)) return rw;
    const cells = rw.split(" ");
    let haz = cells.filter(isHaz).length;
    return cells.map((c, i) => {
      if (c !== "?" && c !== "~") return c;
      if (haz >= 2 || r() > 0.5 + 0.4 * d) return ".";
      const kinds = SLOT_HAZ[c === "?" ? "ground" : "air"];
      const list = offer(B, d).filter(([k]) => kinds.includes(k));
      if (!list.length) return ".";
      const cell = weighted(r, list);
      if (cells[i - 1] === "c" && cell === "c" || cells[i + 1] === "c" && cell === "c") return ".";
      haz++;
      return cell;
    }).join(" ");
  });
}

/** A segment of `biome` from (seed, d): `kind` "gen", "partial", "made" or "enc" asks for that kind (when the biome has one), else the seed decides. `opt.z` is the
 *  distance (its tier opens the encounters, its share is how often one comes) and `opt.skip` the ids that are cooling down (a piece or an encounter just used). */
export function makeSegment(biome, seed, d, want = null, opt = {}) {
  const B = BIOMES[biome], r = rng(seed * 2654435761 ^ 0x5EED), skip = opt.skip || [];
  const ok = id => !skip.includes(id);
  const have = B.pieces.filter(id => PIECES[id] && PIECES[id].from <= d + 1e-9 && ok(id));
  const tier = opt.z === undefined ? -1 : tierAt(opt.z);
  const encs = (B.encounters || []).filter(id => ENCOUNTERS[id] && ENCOUNTERS[id].from <= d + 1e-9 && ENCOUNTERS[id].tier <= tier && ok(id));
  const kinds = {
    gen: 0.55,
    partial: have.some(id => PIECES[id].kind === "partial") ? 0.2 : 0,
    made: have.some(id => PIECES[id].kind === "made") ? 0.25 : 0,
  };
  const rest = kinds.gen + kinds.partial + kinds.made, share = encs.length ? encShareAt(opt.z) : 0;
  kinds.enc = share ? rest * share / (1 - share) : 0;
  let kind = want;
  if (!kind || !kinds[kind]) {
    const x = r() * (rest + kinds.enc);
    kind = x < kinds.gen ? "gen" : x < kinds.gen + kinds.partial ? "partial" : x < rest ? "made" : "enc";
  }
  if (kind === "gen") return { kind, biome, id: `gen:${biome}:${seed}`, name: B.name, rows: genRows(B, r, d), pitch: B.pitch[0] + Math.round(r() * (B.pitch[1] - B.pitch[0])), seed };
  if (kind === "enc") {                                           // a rest, the encounter, a rest: placed after a breather, with room to get out
    const id = encs[Math.floor(r() * encs.length)];
    return { kind, biome, id, name: ENCOUNTERS[id].name, rows: ["!rest 6", `!enc ${id}`, "!rest 6"], pitch: 11, seed };
  }
  const ids = have.filter(id => PIECES[id].kind === kind);
  const id = ids[Math.floor(r() * ids.length)];
  const P = PIECES[id];
  return { kind, biome, id, name: P.name, rows: kind === "partial" ? fillSlots(B, P.rows, r, d) : P.rows.slice(), pitch: P.pitch, seed };
}

/** The next biome after `from`: any other, by seed (a short transition between them is the composer's). */
export function nextBiome(from, r) {
  const list = BIOME_IDS.filter(b => b !== from);
  return list[Math.floor(r() * list.length)];
}
