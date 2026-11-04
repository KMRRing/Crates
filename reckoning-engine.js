// Courier's rules (the game was Reckoning): an endless run along a quay, three lanes wide, the way Blades of Brim plays. Pure functions on one
// plain object (no page, no clock, no three.js), so a run is the same from a seed in Node tests, a daily and a duel, and
// the page (reckoning.js) only steps it, feeds it swipes and draws it (reckoning-3d.js).
//
// Space is metres: z runs down the quay, x across it (lane -1, 0, 1 are LANE_W apart), y up from the planks. The hero
// runs at a speed that climbs with distance. Four swipes are all the input: left and right change lane (or run up a
// wall), up jumps, down comes down hard. What a swipe does depends on what is near when it lands, in seconds of
// running to the foe (ttc: "time to contact"), not metres, so the windows feel the same at any speed:
//   up, a foe in my lane on the ground   within FRONT_WIN: a lunge that cuts it down; sooner: a plain jump that clears
//                                        it; later: it has hit me (foes hit whoever is within a lane of them, never
//                                        across two lanes)
//   up, a foe above in my lane           within ABOVE_WIN: a jump attack, from no more than UP_ABOVE over its base
//   left/right, a foe in the next lane   SIDE_MIN..SIDE_WIN, both on the ground or both in the air (within reach of
//                                        my height): a lane change into it with a cut; otherwise a dodge. With none in
//                                        the next lane, one two lanes across (SIDE_MIN2..SIDE_WIN) is cut the same way
//                                        On the way down, a swipe sideways swoops onto a foe on the ground the same way
//   left/right, while I fly at a foe     the cut moves to the foe in the next lane, if it hasn't landed (up, left, left from
//                                        the lane on the right: the right gull, the middle one, then the left one)
//   down, on the ground                  a roll (ROLL_T): any foe on the ground that reaches me in my lane is cut down. Down
//                                        again in the middle of one queues the next, so a run of them leaves no gap; a roll
//                                        goes under a gull's dive, but not under a lunge from the next lane
//   down, in the air above a foe         a bonk: I land on it and bounce into another jump
//   down, in the air above one jump      a slam: on the planks (never on a foe) a shockwave cuts the ground foes in
//     height                             the lanes beside me
//   down, in the air, neither of those   a quick drop, and a roll on landing (a plain jump's height or less)
//   left/right in the outer lane, with a wall beside me: a wall run, which lifts me; up on the wall is a higher jump
// The gulls of a question (a gate) can be jumped at from further off (GATE_WIN), so a jump in front of the right one
// is a jump attack, and the throw after it carries me over the gap. A swipe that has been made guards me for GUARD_T
// against the foes on the side it was made towards (up and down: the ones in my lane): the hit I was swiping into, or
// away from, a moment late, does not land.
// A kill in the air throws me up again (CHAIN_V), so a chain of flying foes carries me across a pit, and gives me back
// my jump: one more up in the air, with nothing to cut, jumps again. A swipe that has no use yet waits BUFFER seconds (a
// jump swiped a moment before landing still jumps).
//
// Flyers follow my height (drift()): a gull more than SIDE_ABOVE under me, or SIDE_BELOW over me, climbs or sinks towards
// me at DRIFT_V until I am within a swipe sideways of it again, so nobody gets out of reach by going up (a chain over a
// pit, and the gulls of a question, hang where they are: they are the bridge). Within reach, by how far over its base I am:
// up to SIDE_ABOVE a swipe sideways from the next lane cuts it, up to UP_ABOVE the up swipe does in my lane, above that
// only down does, as a bonk on the way (or a slam) that bounces me up again.
//
// The foes telegraph (think()): one within a lane of me sees me (it looks my way), then winds up, then launches at the lane
// I am in then, a crab sliding across to it, a gull diving onto it (only while I am on the ground: a gull in my own lane
// never attacks; I run under it). The hit lands where it aimed, so a lane changed, a jump or a roll after the launch dodges it.
// A flyer that has launched its dive can be cut down from the ground by a swipe sideways towards it, from the launch until
// the last DIVE_MIN seconds before it hits. A cut sideways goes on to the next foe in the same direction (SWEEP_WIN), so from the left lane one swipe right takes
// the foes in the middle and the right lane.
//
// The question twist: now and then the quay breaks at a gap no jump clears, and three gulls hang over it carrying
// three answers, one to a lane. Only the right gull throws me across; the others turn me back into the water. Where
// the questions come from is the page's business: `deal(r, n, asked)` is a function giving { id, q, o: [3 texts], a, x,
// about } (r a random number from 0 to 1; n how many gates have been made; asked their ids, to not ask twice).

export const LANE_W = 1.7;                 // metres between lane centres
export const JUMP_H = 1.6;                 // a plain jump's peak: one "jump height"
export const AIR_T = 0.72;                 // and its time in the air
export const G = 8 * JUMP_H / (AIR_T * AIR_T);
const peakV = h => Math.sqrt(2 * G * h);   // the upward speed that rises h
export const JUMP_V = G * AIR_T / 2;
export const HOP_V = peakV(0.9);           // a kill on the ground: a small hop
export const CHAIN_V = peakV(1.7);         // a kill in the air: up again, past where I was
export const BONK_V = peakV(1.9);
export const WALLJUMP_V = peakV(2.4);
export const SLAM_V = 24;
export const SLAM_MIN_Y = JUMP_H + 0.1;   // above this is "more than one jump height": a slam throws a shockwave
export const HERO_H = 1.1;
export const WALL_X = 1.5 * LANE_W;        // a wall's face
export const WALL_HERO_X = WALL_X - 0.5;   // where a wall runner's feet are
export const WALL_Y = 2.0;
export const LANE_OMEGA = 34;              // the spring of a lane change (critically damped, 1/s): 80% of the way in 0.09 s and 95% in 0.14, a quick start and a soft arrival
export const LANE_T = 4.75 / LANE_OMEGA;   // so a lane change takes this long (0.14 s) to be 95% done; a swipe made on top of another carries on from the speed it had
export const FRONT_WIN = 0.28, ABOVE_WIN = 0.55, SIDE_MIN = 0.08, SIDE_WIN = 0.6, BUFFER = 0.14, LAND_BUFFER = 0.32;   // BUFFER: how long a swipe with nothing yet to work on is kept; LAND_BUFFER: the most a jump swiped in the air is kept, to be taken on landing
export const RETARGET_MIN = 0.03;          // a cut already in flight can be moved until this close to landing
export const SIDE_MIN2 = 0.16;             // two lanes across is twice the way, so it needs twice the time to cross
export const ROLL_T = 0.45;                // seconds a roll lasts (it was 0.32; Korbi, 2 November 2026: "rolls should last a bit longer"): 4.5 to 7 m of quay
export const SIGHT_T = 1.1, WIND_T = 0.6, LAUNCH_T = 0.3;   // seconds to contact: a foe sees me, winds up, launches
export const HIT_X = 0.8 * LANE_W;         // a launched foe hits what is this near the lane it aimed at
export const DIVE_MIN = 0.03;             // a flyer already diving at me can be cut from the side until this close to hitting
export const SIDE_ABOVE = 2.0, SIDE_BELOW = 2.5;   // a swipe sideways in the air reaches a flyer in the next lane from this far above its base ("a bit above and next to it") or below it
export const UP_ABOVE = 1.2;               // an up swipe cuts a flyer in my lane only from this far above its base ("just slightly above"); higher up it is down: a bonk
export const DRIFT_V = 1.6, DRIFT_T = 4;   // a flyer climbs or sinks this many m/s towards a hero out of its reach, once he is within DRIFT_T seconds of it
export const FLY_MAX = 7;                  // and no higher than this
export const SWEEP_WIN = 0.5;              // a cut sideways goes on to the next foe in the same direction if it is within this
export const GATE_WIN = 1.0;               // a gull of a question can be jumped at from this far off (a plain gull, ABOVE_WIN)
export const GUARD_T = 0.4;                // seconds after a swipe that the foes on its side cannot hurt me
export const ROLL_REACH = 1.2;             // and how far in front of the hero a rolling cut lands
export const SLAM_R = 3.2;                 // how far ahead a slam's shockwave runs (and a metre behind)
export const REACH_UP = 3.2;               // how far above me a jump attack can reach
export const FOE_REACH = 0.7;              // a foe hits when this close along the quay
export const HURT_T = 1.4;                 // seconds of grace after a hit
export const SPEED0 = 10, SPEED1 = 16;
export const LOOK = 200;                   // metres of quay made ahead: a question's gap is made in time for 12 s of thought at 16 m/s
export const GATE_FIRST = 90, GATE_EVERY = 4;
export const KINDS = {                     // foes: base height and body height (the hero's feet are y = 0)
  crab: { y: 0, h: 1.0, air: false },
  gull: { y: 1.35, h: 0.8, air: true },
};

export const speedAt = z => SPEED0 + (SPEED1 - SPEED0) * (1 - Math.exp(-Math.max(0, z) / 700));

/** mulberry32 on the number kept in S[key]: the same run from the same seed, and the quay never depends on timing. */
function rnd(S, key = "rng") {
  let a = (S[key] = (S[key] + 0x6D2B79F5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (S, list) => list[Math.floor(rnd(S) * list.length)];
const between = (S, a, b) => a + rnd(S) * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** `launch`: the run sets off from a standstill (a third of the speed, up to full in 0.6 s) rather than at pace. */
export function newGame({ seed = 1, deal = null, hearts = 3, launch = false, section = null } = {}) {
  const S = {
    v: 1, seed, rng: seed | 0, qrng: (seed ^ 0x9E3779B9) | 0,
    t: 0, over: false, hearts, maxHearts: hearts, score: 0, bonus: 0, kills: 0, chain: 0, bestChain: 0,
    right: 0, wrong: 0, missed: 0, streak: 0, falls: 0, fwd: launch ? 0.3 : 1,
    hero: { z: 0, x: 0, y: 0, vx: 0, vy: 0, lane: 0, mode: "run", wall: 0, wallY: WALL_Y, lunge: null, slam: false, hurt: 0, noWall: 0, roll: 0, rollQ: false, jumps: 0 },
    world: { z1: 0, chunks: 0, sinceGate: 0, pits: [], walls: [], foes: [], gates: [], obs: [], pick: [], id: 1 },
    pending: [], answers: [], asked: [], ev: [],
    sec: 0, hits: 0, carried: {}, token: 0, flip: 0, inv: 0, won: false,
  };
  setDeal(S, deal);
  if (section) beginSection(S, section);
  ensure(S);
  return S;
}
/** The question dealer is a function, so it is kept off the object (and out of what is saved). */
export function setDeal(S, deal) { Object.defineProperty(S, "deal", { value: deal, writable: true, enumerable: false, configurable: true }); return S; }
export function copy(S) { return setDeal(JSON.parse(JSON.stringify(S)), S.deal); }
/** A run kept by an earlier version has none of the section fields: it is an endless run, and is given them. A run of a section that is no more is not valid. */
export function valid(S, sections = null) {
  if (!S || S.v !== 1 || !S.hero || !S.world || !Array.isArray(S.world.foes)) return false;
  if (S.sec && (!sections || !sections[S.sec - 1] || !S.mods || !Number.isFinite(S.world.finish) || S.sig !== sectionSig(sections[S.sec - 1]))) return false;
  const W = S.world;
  W.obs ||= []; W.pick ||= [];
  S.sec ||= 0; S.hits ||= 0; S.carried ||= {}; S.token ||= 0; S.flip ||= 0; S.inv ||= 0; S.won = !!S.won;
  return true;
}

export const speed = S => (S.mods ? S.mods.v0 + (S.mods.v1 - S.mods.v0) * (1 - Math.exp(-Math.max(0, S.hero.z) / 700)) : speedAt(S.hero.z)) * S.fwd;
export const laneX = lane => lane * LANE_W;

// ---------- the quay ----------

const floorAt = (S, z) => !S.world.pits.some(p => z > p.z0 && z < p.z1);
const pitAt = (S, z) => S.world.pits.find(p => z >= p.z0 - 0.5 && z <= p.z1 + 0.5) || null;
const wallAt = (S, side, z) => S.world.walls.find(w => w.side === side && z >= w.z0 - 2.2 && z <= w.z1) || null;
const gateById = (S, id) => S.world.gates.find(g => g.id === id);

function foe(S, kind, lane, z, y = KINDS[kind].y, extra = {}) {
  const f = { id: S.world.id++, kind, lane, x: laneX(lane), z, y, h: KINDS[kind].h, alive: true, spent: false, gate: null, ...extra };
  S.world.foes.push(f);
  return f;
}

/** Makes chunks of quay until there is LOOK metres of it ahead of the hero. Which kinds come, and when, is by distance. */
export function ensure(S) {
  const W = S.world;
  if (S.sec) return;                                              // a section is built whole, at its start
  while (W.z1 < S.hero.z + LOOK) chunk(S);
}

// [kind, weight, first distance]
const POOL = [["crabs", 5, 0], ["gulls", 3, 60], ["chain", 3, 140], ["wall", 3, 220], ["wallslam", 2, 330], ["rest", 1, 0]];

function chunk(S) {
  const W = S.world, z0 = W.z1;
  W.chunks++; W.sinceGate++;
  let len;
  if (W.chunks === 1) len = 18;                                   // the start: nothing to do yet
  else if (S.deal && z0 >= GATE_FIRST && W.sinceGate >= GATE_EVERY) { len = gate(S, z0); W.sinceGate = 0; }
  else {
    const kinds = POOL.filter(k => z0 >= k[2]);
    let r = rnd(S) * kinds.reduce((n, k) => n + k[1], 0), kind = kinds[0][0];
    for (const k of kinds) { if ((r -= k[1]) < 0) { kind = k[0]; break; } }
    len = CHUNKS[kind](S, z0);
  }
  W.z1 = z0 + len;
}

const reach = z => speedAt(z) * AIR_T;                            // how far a plain jump carries

const CHUNKS = {
  rest: (S, z0) => 20,
  /** One to three crabs, a lane each, 9 to 12 metres apart: a swipe each. */
  crabs(S, z0) {
    const n = 1 + Math.floor(rnd(S) * 3);
    let z = z0 + 8, lane = pick(S, [-1, 0, 1]);
    for (let i = 0; i < n; i++) {
      foe(S, "crab", lane, z);
      z += between(S, 9, 12);
      lane = pick(S, [-1, 0, 1]);
    }
    return z - z0 + 4;
  },
  /** Gulls above lanes, a crab among them. */
  gulls(S, z0) {
    let z = z0 + 8;
    for (let i = 0; i < 2; i++) {
      foe(S, "gull", pick(S, [-1, 0, 1]), z);
      z += between(S, 9, 12);
      if (i === 0) { foe(S, "crab", pick(S, [-1, 0, 1]), z); z += between(S, 9, 11); }
    }
    return z - z0 + 4;
  },
  /** A pit no jump clears, gulls hung over it a lane or less apart, high and low: an air chain. */
  chain(S, z0) {
    const n = 2 + Math.floor(rnd(S) * 2);
    const start = z0 + 8;
    let z = start + 3.5, lane = pick(S, [-1, 0, 1]);
    for (let i = 0; i < n; i++) {
      foe(S, "gull", lane, z, i % 2 ? 2.3 : 1.35);
      z += 6;
      lane = clamp(lane + pick(S, [-1, 0, 1]), -1, 1);
    }
    const end = z - 6 + 5;
    S.world.pits.push({ z0: start, z1: end });                    // 14 metres or more: no jump (11.5 at the quickest) clears it
    return end - z0 + 6;
  },
  /** A wall along one side, over a pit only a wall run crosses. */
  wall(S, z0) {
    const side = pick(S, [-1, 1]), pit = Math.max(10, reach(z0) * 1.4);
    const w0 = z0 + 6, p0 = w0 + 8, p1 = p0 + pit, w1 = p1 + 8;
    S.world.walls.push({ side, z0: w0, z1: w1 });
    S.world.pits.push({ z0: p0, z1: p1 });
    foe(S, "gull", -side, p0 + pit / 2);                          // company across the pit: a chain to try instead
    return w1 - z0 + 6;
  },
  /** A wall run ends in a wall jump high enough to slam: a row of crabs across the quay waits below. */
  wallslam(S, z0) {
    const side = pick(S, [-1, 1]), w0 = z0 + 6, w1 = w0 + 16;
    S.world.walls.push({ side, z0: w0, z1: w1 });
    for (let k = 0; k < 2; k++) for (const lane of [-1, 0, 1]) foe(S, "crab", lane, w1 + 7 + k * 9 + (lane === 0 ? 1 : 0));
    return w1 + 7 + 9 + 8 - z0;
  },
};

/** The ferry: the quay stops at a gap wider than a jump, three gulls over it with an answer each, the right one tosses
    me across. A long run-up before it, so the question can be read. */
function gate(S, z0) {
  const q = S.deal(() => rnd(S, "qrng"), S.asked.length, S.asked);
  S.asked.push(q.id);
  const len = reach(z0 + 20) * 1.45, p0 = z0 + 16, p1 = p0 + len, rack = p0 + len * 0.45;
  const g = { id: S.world.id++, z: rack, p0, p1, q, state: "open", pick: null };
  S.world.gates.push(g);
  S.world.pits.push({ z0: p0, z1: p1, gate: g.id });
  [-1, 0, 1].forEach((lane, i) => foe(S, "gull", lane, rack, 1.4, { gate: { id: g.id, i } }));
  return p1 - z0 + 10;
}

// ---------- sections ----------
// A section (reckoning-sections.js) is a short quay made by hand: rows of three cells, one to a lane, a row every `gap`
// metres, and a finish. Cells are words split on spaces: . (empty) c crab, C bruiser (two cuts, thrown back by the first),
// g gull; b barrel (jump it), B beam (roll under it), X cart (go round); goods s salt, h herring, f furs, w wax, r grog,
// a amber (hung in the air); 1 2 3 a token; T1 T2 T3 a toll booth that lets through only the token of its number;
// L a lever (turns the drawbridges over); F0 F1 a drawbridge, up when the lever is at that number; W0 W1 W2 a sluice gate
// that opens and shuts on a beat, the three a third of a beat apart; H a meal (a heart back). A row beginning with ! is a
// piece of the old quay: !rest n, !gap n (a gap in the planks of n metres), !gate (a question), !chain, !wall, !wallslam, !pitch n.
export const OBS = {                       // what blocks: base, top and length along the quay
  barrel: { y0: 0, y1: 0.85, len: 0.9 },
  beam: { y0: 0.8, y1: 2.2, len: 1.0 },
  cart: { y0: 0, y1: 2.6, len: 1.6 },
};
export const ROLL_H = 0.6;                 // the height of a hero rolling: a beam hangs above it
export const TIDE_P = 3.2, TIDE_OPEN = 0.56;   // a sluice gate: the beat in seconds and the part of it that it is open
export const GOODS = { s: "salt", h: "herring", f: "furs", w: "wax", r: "grog", a: "amber" };
export const GROG_T = 5;                   // seconds that left and right are the wrong way round after a drink
export const LOAD_LESS = 0.025, LOAD_MIN = 0.8;   // what each good carried takes off the speed of a jump, and the least it comes to

export const loadFactor = S => (S.mods?.laden ? Math.max(LOAD_MIN, 1 - LOAD_LESS * (S.carried.total || 0)) : 1);

/** Whether a thing on the quay stops the hero now. */
export function solid(S, o) {
  switch (o.kind) {
    case "toll": return S.token !== o.mark;
    case "bridge": return S.flip === o.flip;
    case "tide": return ((S.t / TIDE_P + o.ph) % 1 + 1) % 1 >= TIDE_OPEN;
    default: return true;
  }
}

function obstacle(S, kind, lane, z, extra = {}) {
  const d = OBS[extra.shape || kind] || OBS.cart;
  const o = { id: S.world.id++, kind, shape: extra.shape || kind, lane, z, len: d.len, y0: d.y0, y1: d.y1, ...extra };
  S.world.obs.push(o);
  return o;
}
function pickup(S, kind, lane, z, extra = {}) {
  const p = { id: S.world.id++, kind, lane, z, y: kind === "amber" ? 2.3 : 0.55, taken: false, ...extra };
  S.world.pick.push(p);
  return p;
}

function cell(S, tok, lane, z) {
  switch (tok) {
    case ".": return;
    case "c": foe(S, "crab", lane, z); return;
    case "C": foe(S, "crab", lane, z, 0, { hp: 2, heavy: true }); return;
    case "g": foe(S, "gull", lane, z); return;
    case "b": obstacle(S, "barrel", lane, z); return;
    case "B": obstacle(S, "beam", lane, z); return;
    case "X": obstacle(S, "cart", lane, z); return;
    case "L": pickup(S, "lever", lane, z); return;
    case "H": pickup(S, "meal", lane, z); return;
    case "1": case "2": case "3": pickup(S, "token", lane, z, { mark: +tok }); return;
  }
  if (GOODS[tok]) { pickup(S, GOODS[tok], lane, z, { good: true }); return; }
  const m = /^([TFW])(\d)$/.exec(tok);
  if (!m) throw new Error(`Courier: unknown cell "${tok}"`);
  if (m[1] === "T") obstacle(S, "toll", lane, z, { shape: "cart", mark: +m[2] });
  else if (m[1] === "F") obstacle(S, "bridge", lane, z, { shape: "cart", flip: +m[2] });
  else obstacle(S, "tide", lane, z, { shape: "cart", ph: +m[2] / 3 });
}

/** What a section is made of, as a short string: a run kept from before the section was changed is not the section any more, and is dropped. */
export function sectionSig(def) {
  const text = JSON.stringify([def.rows, def.v0, def.v1, def.gap, def.omega, def.laden, def.hearts, def.bill]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Makes a section's quay whole, as `def` (reckoning-sections.js) describes it. */
export function beginSection(S, def) {
  const W = S.world;
  S.sec = def.id; S.sig = sectionSig(def); S.rng = (def.id * 7919 + 17) | 0;              // the quay is the same every time; only the questions are dealt afresh
  S.hearts = S.maxHearts = def.hearts ?? 3;
  S.mods = { v0: def.v0, v1: def.v1 ?? def.v0, omega: def.omega || 0, laden: def.laden || 0, fog: def.fog || 0 };
  S.bill = { want: def.bill?.want || [], bad: def.bill?.bad || [] };
  S.goal = def.goal || { kind: "none", n: 0 };
  S.par = def.par || { hits: 0 };
  W.rows = [];
  let z = def.lead ?? 16, pitch = def.gap;
  for (const row of def.rows) {
    if (row[0] === "!") {
      const [cmd, arg] = row.slice(1).split(" ");
      const n = +arg;
      if (cmd === "pitch") pitch = n;
      else if (cmd === "rest") z += n;
      else if (cmd === "gap") { W.pits.push({ z0: z, z1: z + n, gap: true }); z += n; }
      else if (cmd === "gate") z += gate(S, z);
      else if (CHUNKS[cmd]) z += CHUNKS[cmd](S, z);
      else throw new Error(`Courier: unknown piece "${row}"`);
      continue;
    }
    const cells = row.trim().split(/\s+/);
    if (cells.length !== 3) throw new Error(`Courier: a row has three cells: "${row}"`);
    cells.forEach((tok, i) => cell(S, tok, i - 1, z));
    W.rows.push(z);
    z += pitch;
  }
  W.finish = z + 6; W.z1 = W.finish + 30;
  S.world.foes.sort((a, b) => a.z - b.z);
}

/** What the hero meets on the quay as he runs: a thing that stops him, and what he picks up. */
function touch(S) {
  const h = S.hero, W = S.world, hh = h.roll > 0 && h.mode === "run" ? ROLL_H : HERO_H;
  if (h.mode !== "wall") for (const o of W.obs) {
    const dz = o.z - h.z;
    if (Math.abs(dz) > o.len / 2 + 0.3 || h.hurt > 0 || Math.abs(laneX(o.lane) - h.x) > 0.75 || !solid(S, o)) continue;
    if (h.y < o.y1 - 0.1 && h.y + hh > o.y0 + 0.1) { bump(S, o); if (S.over) return; }
  }
  for (const p of W.pick) {
    if (p.taken || Math.abs(p.z - h.z) > 0.8 || h.mode === "wall" || Math.abs(laneX(p.lane) - h.x) > 0.8) continue;
    if (h.y + hh < p.y - 0.3 || h.y > p.y + 0.3) continue;
    p.taken = true;
    take1(S, p);
    if (S.over) return;
  }
}

function bump(S, o) {
  const h = S.hero;
  S.hearts--; S.hits++; h.hurt = HURT_T; S.fwd = 0.7; S.chain = 0; S.streak = 0;
  S.ev.push({ type: "hurt", id: 0, obs: o.id, hearts: S.hearts });
  if (S.hearts <= 0) end(S);
}

function take1(S, p) {
  switch (p.kind) {
    case "token": S.token = p.mark; break;
    case "lever": S.flip ^= 1; break;
    case "meal": if (S.hearts < S.maxHearts) { S.hearts++; S.ev.push({ type: "heart", hearts: S.hearts }); } break;
    default:
      if (S.bill.bad.includes(p.kind)) {                          // the customs take a heart for a thing that is not on the bill
        S.hearts--; S.hits++; S.hero.hurt = HURT_T; S.fwd = 0.7;
        S.ev.push({ type: "seized", what: p.kind, hearts: S.hearts });
        if (S.hearts <= 0) end(S);
        return;
      }
      S.carried[p.kind] = (S.carried[p.kind] || 0) + 1;
      S.carried.total = (S.carried.total || 0) + 1;
      S.bonus += 50;
      if (p.kind === "grog") S.inv = S.t + GROG_T;
  }
  S.ev.push({ type: "pick", what: p.kind, mark: p.mark || 0, id: p.id });
}

/** How far the section's aim has been got: goods of the bill carried, questions right, foes cut, the longest chain, hearts left. */
export function goalValue(S) {
  const g = S.goal || { kind: "none" };
  switch (g.kind) {
    case "goods": return S.bill.want.reduce((n, k) => n + (S.carried[k] || 0), 0);
    case "right": return S.right;
    case "kills": return S.kills;
    case "chain": return S.bestChain;
    case "hearts": return S.hearts;
    default: return 0;
  }
}
export const goalMet = S => (S.goal?.n || 0) <= goalValue(S);

/** Stars for a section: 0 if it is not passed, one for passing, two for no more than one heart over par, three for par and the full aim. */
export function starsOf(S) {
  if (!S.won) return 0;
  const par = S.par || { hits: 0 };
  return 1 + (S.hits <= par.hits + 1 ? 1 : 0) + (S.hits <= par.hits && goalValue(S) >= (par.more ?? S.goal?.n ?? 0) ? 1 : 0);
}

function finish(S) {
  S.over = true; S.won = goalMet(S);
  S.ev.push({ type: "finish", won: S.won, stars: starsOf(S), score: S.score });
}

// ---------- swipes ----------

const ttcOf = (S, f) => (f.z - S.hero.z) / speed(S);
const alive = S => S.world.foes.filter(f => f.alive && !f.spent);

/** Nearest foe (by time) in `lane` for which `ok(f, ttc)` holds. */
function nearest(S, ok) {
  let best = null, bt = Infinity;
  for (const f of alive(S)) {
    const t = ttcOf(S, f);
    if (t < -0.05 || t >= bt) continue;
    if (ok(f, t)) { best = f; bt = t; }
  }
  return best;
}
const grounded = h => h.mode === "run";

/** A swipe: "up" | "down" | "left" | "right". It works now if it can, else waits a moment (BUFFER) for something to work on. */
export function swipe(S, dir) {
  if (S.over) return S.ev;
  if (S.inv > S.t && (dir === "left" || dir === "right")) dir = dir === "left" ? "right" : "left";       // the grog: left is right
  if (!resolve(S, dir)) { const keep = keepFor(S, dir); S.pending.push({ dir, until: S.t + keep }); S.ev.push({ type: "wait", dir, keep }); }
  return S.ev;
}

/** How long a swipe with nothing to work on is kept: BUFFER, or for a jump swiped in the air with none in hand, until the planks
 *  are under me (at most LAND_BUFFER), so a jump swiped early on the way down still jumps as I land. */
function keepFor(S, dir) {
  const h = S.hero;
  if (dir !== "up" || h.mode !== "air" || h.lunge) return BUFFER;
  const t = (h.vy + Math.sqrt(h.vy * h.vy + 2 * G * Math.max(0, h.y))) / G;             // y + vy t - G t²/2 = 0
  return clamp(t + 0.03, BUFFER, LAND_BUFFER);
}

function resolve(S, dir) {
  const h = S.hero;
  if (h.lunge && (dir === "up" || dir === "down")) return false;   // while I fly at a foe only a swipe sideways counts: it moves the cut
  const lane = h.lane;
  const done = dir === "up" ? up(S) : dir === "down" ? down(S) : side(S, dir === "left" ? -1 : 1);
  if (done) h.guard = { dir, lane, until: S.t + GUARD_T };       // from the lane I swiped from: which side is "that direction"
  return done;
}

/** Whether a swipe just made guards me from this foe: the ones on its side, or in my lane for up and down. */
function guarded(S, f) {
  const g = S.hero.guard;
  if (!g || S.t >= g.until) return false;
  return g.dir === "left" ? f.lane < g.lane : g.dir === "right" ? f.lane > g.lane : f.lane === g.lane;
}

function up(S) {
  const h = S.hero;
  if (h.mode === "wall") {
    const w = h.wall;
    h.mode = "air"; h.vy = WALLJUMP_V; h.wall = 0; h.noWall = S.t + 0.3;
    S.ev.push({ type: "walljump", side: w });
    return true;
  }
  // a foe on the ground in front of me needs me close; one in the air I can reach from further, from the ground or the air
  const f = nearest(S, (f, t) => {
    if (f.lane !== h.lane) return false;                          // by the lane I mean to be in, not the x I am passing through
    if (f.y <= 0.3) return t <= FRONT_WIN && h.y < 1;
    const up = f.y + f.h * 0.3 - h.y;
    return t <= (f.gate ? GATE_WIN : ABOVE_WIN) && up <= REACH_UP && h.y - f.y <= UP_ABOVE;      // a swoop down to a gull just below counts; from higher it is a bonk
  });
  if (f) { startLunge(S, f, 0, f.y <= 0.3 ? "front" : "above"); return true; }
  if (grounded(h)) {
    h.mode = "air"; h.vy = JUMP_V * loadFactor(S); h.roll = 0;
    S.ev.push({ type: "jump" });
    return true;
  }
  if (h.mode === "air" && h.jumps > 0) {                          // a cut in the air gave my jump back: one more, from here
    h.jumps = 0; h.slam = false; h.vy = Math.max(h.vy, JUMP_V * loadFactor(S));
    S.ev.push({ type: "jump", air: true });
    return true;
  }
  return false;
}

function side(S, dir) {
  const h = S.hero;
  if (h.lunge) return retarget(S, dir);
  if (h.mode === "wall") {
    if (dir !== -h.wall) return false;                            // already at the wall
    h.mode = "air"; h.vy = 0; h.noWall = S.t + 0.3; h.lane = h.wall; h.wall = 0;
    S.ev.push({ type: "wallleave" });
    return true;
  }
  if (h.lane === dir && S.t >= h.noWall && wallAt(S, dir, h.z + 0.6)) {
    h.wallY = grounded(h) ? WALL_Y : clamp(h.y, 1.4, 3);          // from the planks the wall lifts me; from the air I keep my height
    h.mode = "wall"; h.wall = dir;
    h.vy = 0; h.roll = 0; h.jumps = 0;
    S.ev.push({ type: "wallrun", side: dir });
    return true;
  }
  const lane = h.lane + dir;
  if (lane < -1 || lane > 1) return false;
  // the next lane's foe first; with none in range there, one two lanes across (the hero crosses both lanes to it)
  let f = sideFoe(S, lane, SIDE_MIN), to = lane;
  if (!f && lane + dir >= -1 && lane + dir <= 1) { f = sideFoe(S, lane + dir, SIDE_MIN2); if (f) to = lane + dir; }
  h.lane = to;
  S.ev.push({ type: "lane", lane: to, dir });
  if (f) startLunge(S, f, dir, "side");
  return true;
}

/** Flying at a foe, a swipe sideways moves the attack to the foe in the next lane (the one I leave stays where it is),
 *  for as long as the cut has not landed: so up, left, left from the right lane reaches the left gull of a question,
 *  if it is done before the cut lands on the first or the second. The cut lands when the quay brings the foe to me,
 *  so the time to do it in is the time left, whichever gull I am flying at. */
function retarget(S, dir) {
  const h = S.hero, L = h.lunge;
  if (L.how === "bonk") return false;
  const lane = h.lane + dir;
  if (lane < -1 || lane > 1) return false;
  const f = nearest(S, (f, t) => f.lane === lane && t >= RETARGET_MIN && t <= (f.gate ? GATE_WIN : SIDE_WIN) &&
    (f.y <= 0.3 || sideReach(f, h)));
  if (!f) return false;
  h.lane = lane;
  L.foe = f.id; L.left = L.total = Math.max(0.06, ttcOf(S, f)); L.how = "side"; L.dir = dir; L.air = L.air || f.y > 0.3;
  S.ev.push({ type: "lane", lane, dir }, { type: "lunge", how: "side", kind: f.kind, gate: f.gate ? f.gate.id : 0, retarget: true });
  return true;
}

/** The foe a swipe sideways can cut in `lane`: on the ground I cut one on the ground (and, coming down, I swoop onto one
 *  from up to 4.5 m above it); in the air, one in the air within reach of my height. */
function sideFoe(S, lane, tMin) {
  const h = S.hero, falling = h.mode === "air" && h.vy <= 0;
  return nearest(S, (f, t) => f.lane === lane && t >= (diving(f) ? Math.min(tMin, DIVE_MIN) : tMin) && t <= (f.gate ? GATE_WIN : SIDE_WIN) &&
    (f.y <= 0.3 ? h.y < 1 || (falling && h.y - (f.y + f.h * 0.3) <= 4.5)
      : (diving(f) && h.y < 1) || (h.y >= 0.5 && sideReach(f, h))));
}

/** Whether a flyer is within a swipe sideways of where I am: no more than SIDE_ABOVE over its base (a bit above and next to
 *  it), no more than SIDE_BELOW under it. */
const sideReach = (f, h) => { const dy = h.y - f.y; return dy <= SIDE_ABOVE && dy >= -SIDE_BELOW; };

/** A flyer that has launched its dive: from the ground, from the side, it can be cut down while it comes. */
const diving = f => f.ph === 3 && KINDS[f.kind].air;

function down(S) {
  const h = S.hero;
  if (h.mode === "wall") {
    h.mode = "air"; h.vy = 0; h.noWall = S.t + 0.3; h.lane = h.wall; h.wall = 0;
    S.ev.push({ type: "wallleave" });
    return true;
  }
  if (grounded(h)) {
    if (h.roll > 0) { h.rollQ = true; return true; }              // rolling: the next one follows at once, so a run of them leaves no gap
    h.roll = ROLL_T; h.rollQ = false;
    S.ev.push({ type: "roll" });
    return true;
  }
  const f = nearest(S, (f, t) => f.lane === h.lane && t <= 0.22 && h.y >= f.y + f.h - 0.1 && h.y - (f.y + f.h) <= 4);
  if (f) { startLunge(S, f, 0, "bonk"); return true; }
  h.slam = h.y >= SLAM_MIN_Y;
  h.vy = -SLAM_V;
  S.ev.push({ type: "dive", slam: h.slam });
  return true;
}

/** The hero commits to a foe: he is carried to it in the time it takes the quay to bring it to him. `dir` is the way a
 *  swipe sideways went (-1, 1; 0 for the others), which a cut that goes on to the next foe carries on in. */
function startLunge(S, f, dir, how, extra = {}) {
  const h = S.hero;
  const left = Math.max(0.06, ttcOf(S, f));
  h.lunge = { foe: f.id, how, dir, left, total: left, air: h.y > 0.5 || f.y > 0.3 };       // air: it set off from the air, or is at a foe in it, so it counts as an attack in the air
  h.vy = 0; h.slam = false; h.roll = 0;
  S.ev.push({ type: "lunge", how, kind: f.kind, gate: f.gate ? f.gate.id : 0, ...extra });
}

// ---------- the step ----------

/** Runs the game dt seconds (keep dt at or under 1/60 for the windows to mean what they say). Returns the events. */
export function step(S, dt) {
  const ev = S.ev;
  if (S.over) return ev;
  const h = S.hero;
  S.t += dt;
  S.fwd = Math.min(1, S.fwd + (1 - S.fwd) * (1 - Math.exp(-dt * 6)) + dt * 0.4);          // pace comes back briskly and then eases (it was a straight 0.9 s)
  if (h.hurt > 0) h.hurt = Math.max(0, h.hurt - dt);
  const v = speed(S);

  // swipes that had nothing to work on try again
  if (S.pending.length) {
    const keep = [];
    for (const p of S.pending) {
      const n = S.ev.length;
      if (resolve(S, p.dir)) S.ev.splice(n, 0, { type: "late", dir: p.dir });          // the kept swipe worked, and what it did follows
      else if (S.t < p.until) keep.push(p);
      else S.ev.push({ type: "drop", dir: p.dir });
    }
    S.pending = keep;
  }

  h.z += v * dt;
  const prevY = h.y;

  // across: a critically damped spring to the lane (its exact solution, so any dt is stable). A lane change is an arc, a
  // quick start and a soft arrival, and a swipe made on top of another, or a cut that ends, carries on from the speed it had.
  const tx = h.mode === "wall" ? h.wall * WALL_HERO_X : laneX(h.lane);
  {
    const om = S.mods?.omega || LANE_OMEGA;                         // wet planks are slower to turn on
    const d = h.x - tx, v0 = h.vx || 0, e = Math.exp(-om * dt), c = v0 + om * d;
    h.x = tx + (d + c * dt) * e;
    h.vx = (v0 - om * c * dt) * e;
    if (Math.abs(h.x - tx) < 5e-4 && Math.abs(h.vx) < 0.05) { h.x = tx; h.vx = 0; }
  }

  // up and down
  if (h.lunge) lungeStep(S, dt);
  else if (h.mode === "wall") {
    const w = wallAt(S, h.wall, h.z);
    if (!w || h.z > w.z1) { h.mode = "air"; h.vy = 0; h.lane = h.wall; h.wall = 0; h.noWall = S.t + 0.3; ev.push({ type: "wallend" }); }
    else { h.y += clamp(h.wallY - h.y, -14 * dt, 14 * dt); h.vy = 0; }
  } else {
    if (h.mode === "run" && !floorAt(S, h.z)) { h.mode = "air"; h.vy = 0; h.roll = 0; }
    if (h.mode === "air") {
      if (h.vy > -SLAM_V + 0.01 || !h.slam) h.vy -= G * dt;
      h.y += h.vy * dt;
      if (h.vy <= 0) diveHits(S, prevY);
      if (!h.lunge && h.vy <= 0 && h.y <= 0 && h.y > -0.5 && floorAt(S, h.z)) land(S);
      else if (h.y < -3) fall(S);
    }
  }
  if (S.over) return ev;

  // a roll cuts down every foe on the ground that reaches me in my lane
  if (h.roll > 0) {
    h.roll = Math.max(0, h.roll - dt);
    for (const f of alive(S)) {
      if (f.gate || f.y > 0.3 || f.lane !== h.lane) continue;
      const dz = f.z - h.z;
      if (dz < -FOE_REACH || dz > ROLL_REACH) continue;
      if ((f.hp || 1) > 1) { stagger(S, f); continue; }
      f.alive = false; S.kills++; S.bonus += 100;
      S.ev.push({ type: "kill", id: f.id, kind: f.kind, how: "roll", y: f.y });
    }
    if (h.roll === 0 && h.rollQ) { h.roll = ROLL_T; h.rollQ = false; ev.push({ type: "roll", again: true }); }
  }

  think(S);
  drift(S, dt);

  // what the foes do
  for (const f of alive(S)) {
    if (f.gate) continue;
    const dz = f.z - h.z;
    if (dz < -FOE_REACH || dz > FOE_REACH) continue;
    if (h.hurt > 0 || (h.lunge && h.lunge.foe === f.id) || guarded(S, f)) continue;
    if (Math.abs(f.x - h.x) > (f.ph === 3 ? HIT_X : LANE_W * 1.05)) continue;     // a launched foe hits where it aimed; the others, the lane they are in and the next
    if (KINDS[f.kind].air && h.roll > 0 && grounded(h)) continue;                  // a roll goes under a gull's dive
    if (h.y < f.y + f.h - 0.15 && h.y + HERO_H > f.y + 0.1) hit(S, f);
    if (S.over) return ev;
  }

  if (S.sec) { touch(S); if (S.over) return ev; if (h.z >= S.world.finish) { finish(S); return ev; } }

  // gates passed unanswered
  for (const g of S.world.gates) if (g.state === "open" && h.z > g.z + 1.2) { g.state = "missed"; answered(S, g, null); }

  ensure(S);
  prune(S);
  S.score = Math.floor(h.z) + S.bonus;
  return ev;
}

/** Events since the last call, and clears them. */
export function take(S) { const e = S.ev; S.ev = []; return e; }

function lungeStep(S, dt) {
  const h = S.hero, L = h.lunge, f = S.world.foes.find(x => x.id === L.foe);
  if (!f || !f.alive) { h.lunge = null; return; }
  const ty = L.how === "bonk" ? f.y + f.h : Math.max(0, f.y + f.h * 0.3 - 0.2);
  // the way up (or down) to it is eased, so a cut is a burst and not a crawl: at once and then softer, and a bonk falling in. Across, the
  // lane's spring has taken me there already (a lane change is as quick with a cut as without).
  const t0 = 1 - L.left / L.total, t1 = Math.min(1, t0 + dt / L.total), e0 = lungeEase(L.how, t0), e1 = lungeEase(L.how, t1);
  h.y += (ty - h.y) * (e0 >= 1 ? 1 : (e1 - e0) / (1 - e0));
  L.left -= dt;
  if (L.left <= 1e-9) strike(S, f, L.how);
}

/** How far along its way a cut is `t` (0 to 1) of the time to the foe. */
const lungeEase = (how, t) => (how === "bonk" ? t * t : 1 - (1 - t) * (1 - t));

/** A lunge arrives. */
function strike(S, f, how) {
  const h = S.hero, L = h.lunge, high = h.y > 0.5 || !!L?.air;
  if (h.guard) h.guard.until = Math.max(h.guard.until, S.t + GUARD_T);   // the swipe is complete: the guard runs from now
  h.lunge = null;
  h.y = Math.max(h.y, 0);
  if (f.gate) {
    const g = gateById(S, f.gate.id);
    const right = g && g.state === "open" && f.gate.i === g.q.a;
    if (!g || g.state !== "open") { h.vy = high ? CHAIN_V : HOP_V; h.mode = "air"; if (high) h.jumps = 1; return; }
    g.pick = f.gate.i;
    if (right) {
      g.state = "right";
      f.alive = false;
      for (const o of S.world.foes) if (o.gate && o.gate.id === g.id) o.alive = false;         // the others fly off
      h.vy = CHAIN_V; h.mode = "air"; h.jumps = 1;
      answered(S, g, true);
      S.ev.push({ type: "kill", id: f.id, kind: f.kind, how, gate: g.id, right: true, y: f.y });
    } else {
      g.state = "wrong";
      f.spent = true;                                                  // a gull that stays where it is
      h.vy = -2; h.mode = "air"; h.jumps = 0; S.fwd = 0.25;                         // I bounce off and drop short
      answered(S, g, false);
      S.ev.push({ type: "clang", id: f.id, gate: g.id });
    }
    return;
  }
  if ((f.hp || 1) > 1) {                                             // a bruiser takes the first cut and is thrown back for the second
    stagger(S, f);
    h.mode = "air"; h.vy = how === "bonk" ? BONK_V : high ? CHAIN_V : HOP_V;
    if (high) h.jumps = 1;
    return;
  }
  f.alive = false;
  const air = high || how === "bonk" || how === "above";
  if (air) h.jumps = 1;                                              // an attack in the air gives my jump back
  S.chain = air ? S.chain + 1 : S.chain;
  S.bestChain = Math.max(S.bestChain, S.chain);
  S.kills++;
  S.bonus += 100 + 50 * Math.min(S.chain, 8);
  S.ev.push({ type: "kill", id: f.id, kind: f.kind, how, chain: S.chain, y: f.y, dir: L?.dir || 0 });
  // a cut sideways goes on, in the same direction, to the next foe in reach: no hop in between
  const next = how === "side" && L?.dir ? sweepFoe(S, h.lane + L.dir) : null;
  if (next) {
    h.lane += L.dir;
    S.ev.push({ type: "lane", lane: h.lane, dir: L.dir });
    startLunge(S, next, L.dir, "side", { sweep: true });
    h.lunge.air = air || next.y > 0.3;
    return;
  }
  h.mode = "air";
  h.vy = how === "bonk" ? BONK_V : air ? CHAIN_V : HOP_V;
}

/** A bruiser hit once: one cut less to take, and thrown back down the quay, winding up again from nothing. */
export const STAGGER_Z = 5.5;
function stagger(S, f) {
  f.hp--; f.z += STAGGER_Z; f.ph = 0; f.x = laneX(f.lane); f.pt = S.t; S.bonus += 50;
  S.ev.push({ type: "stagger", id: f.id, hp: f.hp });
}

/** The foe a cut sideways goes on to: in the next lane along, not a gull of a question (that is an answer, and is chosen),
 *  within SWEEP_WIN, and the way a swipe sideways picks one: a foe on the ground from the ground, a foe in the air from
 *  the air. */
function sweepFoe(S, lane) {
  const h = S.hero;
  if (lane < -1 || lane > 1) return null;
  return nearest(S, (f, t) => f.lane === lane && !f.gate && t >= -0.02 && t <= SWEEP_WIN &&
    (f.y <= 0.3 ? h.y < 1 : h.y >= 0.5 && sideReach(f, h)));
}

// ---------- the foes' minds ----------

const isAir = f => KINDS[f.kind].air;

/** A foe within a lane of me sees me (`ph` 1: it looks my way), winds up (2) and launches (3), by seconds to contact so
 *  it is the same at any speed. The launch commits it to the lane I am in then (`aim`): a crab slides across to it, a gull
 *  dives onto it, and the hit lands there, so a lane changed, a jump or a roll after the launch is a dodge. A gull in my own
 *  lane never attacks (I run under it), and none attacks me in the air or on a wall. A foe I only come within a lane of at the
 *  last moment goes through all three in a step or two: it was not given the time to be seen. Foes over a pit, and the
 *  gulls of a question, are the bridge, not an enemy. */
function think(S) {
  const h = S.hero, v = speed(S), reachT = FOE_REACH / v;
  for (const f of alive(S)) {
    if (f.gate || !floorAt(S, f.z)) continue;
    const t = (f.z - h.z) / v;
    let ph = f.ph || 0;
    if (ph === 3) { fly(f, t - reachT); continue; }
    if (t < -reachT) continue;
    const dl = h.lane - f.lane;
    if (t > SIGHT_T || Math.abs(dl) > 1 || (isAir(f) && dl === 0)) { f.ph = 0; continue; }
    f.look = Math.sign(dl);
    if (ph === 0) { ph = 1; f.pt = S.t; S.ev.push({ type: "notice", id: f.id, kind: f.kind, lane: f.lane, look: f.look }); }
    if (ph === 1 && t <= WIND_T) { ph = 2; f.pt = S.t; S.ev.push({ type: "wind", id: f.id, kind: f.kind, lane: f.lane }); }
    if (ph === 2 && t <= LAUNCH_T && (!isAir(f) || grounded(h))) {
      ph = 3; f.pt = S.t; f.aim = h.lane; f.lt = Math.max(0, t - reachT); f.y0 = f.y;
      S.ev.push({ type: "launch", id: f.id, kind: f.kind, lane: f.lane, aim: f.aim });
      fly(f, t - reachT);
    }
    f.ph = ph;
  }
}

/** A launched foe on its way: `p` is how far, from the launch to the moment it is within reach of me. */
function fly(f, toReach) {
  const p = f.lt > 0.001 ? clamp(1 - toReach / f.lt, 0, 1) : 1, e = p * p * (3 - 2 * p);
  f.p = p;
  f.x = laneX(f.lane) + (laneX(f.aim) - laneX(f.lane)) * e;
  if (isAir(f)) f.y = f.y0 * (1 - e);
}

/** Flyers follow my height (2 November 2026, Korbi: "enemy flyers slowly rise or fall closer to the player if the player is far
 *  above or below them"; going up was too easy a way out of everything). A flyer within DRIFT_T seconds of me, that has not
 *  launched, climbs while I am more than SIDE_ABOVE (less a tenth of a metre) over its base, until I am within that of it, and
 *  sinks while I am as far under it (SIDE_BELOW), but never below where it flies. Not over a pit and not a gull of a question: those
 *  are a bridge and an answer, and hang where they were put. */
function drift(S, dt) {
  const h = S.hero, v = speed(S);
  const above = SIDE_ABOVE - 0.1, below = SIDE_BELOW - 0.1;      // it keeps a little inside what a swipe reaches, so the edge is never where it rests
  for (const f of alive(S)) {
    if (f.gate || !isAir(f) || f.ph === 3) continue;
    const t = (f.z - h.z) / v;
    if (t < -FOE_REACH / v || t > DRIFT_T || !floorAt(S, f.z)) continue;
    const dy = h.y - f.y;
    const want = dy > above ? Math.min(FLY_MAX, h.y - above) : dy < -below ? Math.max(KINDS[f.kind].y, h.y + below) : f.y;
    f.y += clamp(want - f.y, -DRIFT_V * dt, DRIFT_V * dt);
  }
}

/** A question settled. Right: 500 points and a heart back (if I am short of one). Wrong, or passed under unanswered: a heart
 *  here, and the fall into the water that follows is the second (2 November 2026, Korbi: "getting a question wrong costs 2
 *  lives; right restores one"). */
function answered(S, g, ok) {
  S.answers.push({ id: g.q.id, bank: g.q.bank, about: g.q.about, ok });
  if (ok) {
    S.right++; S.streak++; S.bonus += 500;
    if (S.hearts < S.maxHearts) { S.hearts++; S.ev.push({ type: "heart", hearts: S.hearts }); }
  } else {
    if (ok === false) S.wrong++; else S.missed++;
    S.streak = 0;
    S.hearts = Math.max(0, S.hearts - 1); S.hits++;
  }
  S.ev.push({ type: "answer", gate: g.id, ok, q: g.q, pick: g.pick });
  if (!ok && S.hearts <= 0) end(S);
}

/** A dive meets a foe's back on the way down: I land on it. */
function diveHits(S, prevY) {
  const h = S.hero;
  if (!h.slam && h.vy > -SLAM_V + 1) return;
  for (const f of alive(S)) {
    const dz = f.z - h.z;
    if (Math.abs(dz) > 0.9 || Math.abs(f.x - h.x) > LANE_W * 0.6) continue;
    const top = f.y + f.h;
    if (prevY >= top - 0.2 && h.y <= top) { h.y = top; h.slam = false; strike(S, f, "bonk"); return; }
  }
}

function land(S) {
  const h = S.hero, slam = h.slam, impact = -h.vy;
  const dived = h.vy <= -SLAM_V + 1;                            // a down swipe in the air starts at SLAM_V; no fall of its own gets near it
  h.y = 0; h.vy = 0; h.mode = "run"; h.slam = false; h.jumps = 0;
  S.chain = 0;
  S.ev.push({ type: "land", slam, v: impact });
  if (dived && !slam) {                                         // down in a jump, with no foe to bonk and not high enough to slam, lands in a roll (2 November 2026, Korbi)
    h.roll = ROLL_T; h.rollQ = false;
    S.ev.push({ type: "roll", land: true });
  }
  if (!slam) return;
  let n = 0;
  for (const f of alive(S)) {
    if (f.gate || f.y > 1) continue;
    const dz = f.z - h.z;
    if (dz < -1 || dz > SLAM_R || Math.abs(f.x - h.x) > LANE_W * 1.05 + 0.1) continue;
    f.alive = false; n++; S.kills++;
    S.bonus += 100 + 25 * n;
    S.ev.push({ type: "kill", id: f.id, kind: f.kind, how: "slam", y: f.y });
  }
  S.ev.push({ type: "shockwave", n });
}

function hit(S, f) {
  const h = S.hero;
  f.spent = true;
  S.hearts--; S.hits++; h.hurt = HURT_T; S.fwd = 0.7; S.chain = 0; S.streak = 0;
  S.ev.push({ type: "hurt", id: f.id, hearts: S.hearts });
  if (S.hearts <= 0) end(S);
}

/** Into the water: a heart, and back on the far bank. */
function fall(S) {
  const h = S.hero, p = pitAt(S, h.z);
  S.falls++; S.hearts--; S.hits++; S.streak = 0; S.chain = 0;
  S.ev.push({ type: "fall", hearts: S.hearts });
  if (S.hearts <= 0) { end(S); return; }
  if (p) h.z = p.z1 + 1.5;
  h.y = 0; h.vy = 0; h.mode = "run"; h.slam = false; h.lunge = null; h.hurt = HURT_T + 0.3; h.roll = 0; h.jumps = 0; h.vx = 0;
}

function end(S) {
  S.over = true;
  S.ev.push({ type: "over", score: S.score });
}

function prune(S) {
  const W = S.world, z = S.hero.z - 25;
  W.foes = W.foes.filter(f => f.z > z);
  W.pits = W.pits.filter(p => p.z1 > z);
  W.walls = W.walls.filter(w => w.z1 > z);
  W.gates = W.gates.filter(g => g.p1 > z);
  W.obs = W.obs.filter(o => o.z > z);
  W.pick = W.pick.filter(p => p.z > z);
}
