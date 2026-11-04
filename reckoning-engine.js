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
//   left/right, a foe in the next lane   up to SIDE_WIN seconds off, however late, both on the ground or both in the air (within reach of
//                                        my height): a lane change into it with a cut; otherwise a dodge. With none in
//                                        the next lane, one two lanes across (up to SIDE_WIN) is cut the same way
//                                        On the way down, a swipe sideways swoops onto a foe on the ground the same way
//   left/right, while I fly at a foe     the cut moves to the foe in the next lane, if it hasn't landed (up, left, left from
//                                        the lane on the right: the right gull, the middle one, then the left one)
//   down, on the ground                  a roll (ROLL_T): any foe on the ground that reaches me in my lane is cut down. Down
//                                        again in the middle of one queues the next, so a run of them leaves no gap; after the
//                                        last, ROLL_REC seconds of recovery in which no roll starts. A roll goes under a
//                                        gull's dive, but not under a lunge from the next lane
//   down, in the air above a foe         a bonk: I land on it and bounce into another jump
//   down, in the air above one jump      a slam: on the planks (never on a foe) a shockwave cuts the ground foes in
//     height                             the lanes beside me
//   down, in the air, neither of those   a quick drop, and a roll on landing (a plain jump's height or less)
//   left/right with a wall beside me   a wall run, which lifts me, from the outer lane or, with no foe to cut, from the middle
//   left/right on a wall, away from it  with a foe in reach that way: the aerial cut a swipe in the air would be; else a drop
//                                        one (by way of the lane); up on the wall is a higher jump
// The gulls of a question (a gate) can be jumped at from further off (GATE_WIN), so a jump in front of the right one
// is a jump attack, and the throw after it carries me over the gap. The foe a swipe goes for (and the ones a sweep goes on
// to) cannot hurt me until the swipe is done, and a foe that is hitting me waits LATE_WIN seconds before the hit lands, in
// which a swipe at it still wins (4 November 2026, Korbi: a foe you are attacking cannot hurt you, mid attack and all).
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
// I am in then, a crab sliding across to it, a gull diving onto it (only while I am on the ground; a gull in my own lane
// dives down the lane). The hit lands where it aimed, so a lane changed, a jump or a roll after the launch dodges it.
// A flyer that has launched its dive can be cut down from the ground by a swipe sideways towards it, from the launch until
// it hits (or later: a foe hitting me waits LATE_WIN). A cut sideways goes on to the next foe in the same direction (SWEEP_WIN), so from the left lane one swipe right takes
// the foes in the middle and the right lane.
//
// The question twist: now and then the quay breaks at a gap no jump clears, and three gulls hang over it carrying
// three answers, one to a lane. Only the right gull throws me across; the others turn me back into the water. Where
// the questions come from is the page's business: `deal(r, n, asked)` is a function giving { id, q, o: [3 texts], a, x,
// about } (r a random number from 0 to 1; n how many gates have been made; asked their ids, to not ask twice).

import { T, airTime } from "./reckoning-tune.js";
import { makeSegment, nextBiome, difficultyAt, rng as seeded, BIOMES, PIECES } from "./reckoning-biomes.js";

export const LANE_W = 1.7;                 // metres between lane centres
// The jump's numbers are the tuning's (reckoning-tune.js, where Korbi's Feel lab round is the default); these are its defaults at load, for the tests.
export const { JUMP_H, AIR_T, G, JUMP_V, HOP_V, CHAIN_V, BONK_V, WALLJUMP_V, SLAM_MIN_Y } = T;
export const SLAM_V = 24;
export const HERO_H = 1.1;
export const WALL_X = 1.5 * LANE_W;        // a wall's face
export const WALL_HERO_X = WALL_X - 0.5;   // where a wall runner's feet are
export const WALL_Y = 2.0;
export const WALL_TOP = 3.2;               // an ordinary wall's height: a wall run on it can be re-joined only below this, so a jump from it gets me no higher
export const PAD_V = T.PAD_V;              // a jump pad throws me this hard: up past a balcony's edge
export const LANE_OMEGA = T.LANE_OMEGA;     // the spring of a lane change (critically damped, 1/s): a quick start and a soft arrival
export const LANE_T = T.LANE_T;
export const { FRONT_WIN, ABOVE_WIN, SIDE_WIN, BUFFER, LAND_BUFFER } = T;   // BUFFER: how long a swipe with nothing yet to work on is kept; LAND_BUFFER: the most a jump swiped in the air is kept, to be taken on landing
export const RETARGET_MIN = 0.03;          // a cut already in flight can be moved until this close to landing
export const ROLL_T = T.ROLL_T;            // seconds a roll lasts
export const GULL_UP_WIN = 0.9;            // up at a gull in my lane that has seen me is a jump attack from this far off (else a plain jump flew into its dive)
export const SIGHT_T = 1.1, WIND_T = 0.6, LAUNCH_T = 0.3;   // seconds to contact: a foe sees me, winds up, launches
export const HIT_X = 0.8 * LANE_W;         // a launched foe hits what is this near the lane it aimed at
export const SIDE_ABOVE = 2.0, SIDE_BELOW = 2.5;   // a swipe sideways in the air reaches a flyer in the next lane from this far above its base ("a bit above and next to it") or below it
export const UP_ABOVE = 1.2;               // an up swipe cuts a flyer in my lane only from this far above its base ("just slightly above"); higher up it is down: a bonk
export const DRIFT_V = 1.6, DRIFT_T = 4;   // a flyer climbs or sinks this many m/s towards a hero out of its reach, once he is within DRIFT_T seconds of it
export const FLY_MAX = 7;                  // and no higher than this
export const SWEEP_WIN = 0.5;              // a cut sideways goes on to the next foe in the same direction if it is within this
export const GATE_WIN = 1.0;               // a gull of a question can be jumped at from this far off (a plain gull, ABOVE_WIN)
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
  // inert foes: they do not look, wind up or fly at me, and are broken by the same attacks that cut a crab. A barrel is jumped or broken
  // (a break gives BREAK_COINS.barrel coins); a balloon floats where it was hung and is popped (BREAK_COINS.balloon coins, and the
  // popping throws me up again like any kill in the air, so a chain of them is a stair). Run into unbroken, a barrel costs a heart (and
  // breaks), a balloon costs nothing but my chain (and pops without a reward).
  barrel: { y: 0, h: 0.85, air: false, inert: true },
  balloon: { y: 2.2, h: 1.1, air: true, inert: true },
};
export const BREAK_COINS = { barrel: 3, balloon: 2 };
export const GEM_MAX_HEARTS = 5;           // amber: each one found is a heart back, and past the hearts I have, a heart more (up to this many)
export const COIN_PASS = 0.45;             // a coin or a nugget is taken from this far above or below the hero's body: runs and jumps pick them up

export const speedAt = z => SPEED0 + (SPEED1 - SPEED0) * (1 - Math.exp(-Math.max(0, z) / 700));

/** mulberry32 on the number kept in S[key]: the same run from the same seed, and the quay never depends on timing. */
function rnd(S, key = "rng") {
  let a = (S[key] = (S[key] + 0x6D2B79F5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (S, list) => list[Math.floor(rnd(S) * list.length)];
const pickc = (S, list) => list[Math.floor(rnd(S, "crng") * list.length)];     // (the coins have a stream of their own, so they never change where the foes are)
const between = (S, a, b) => a + rnd(S) * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** `launch`: the run sets off from a standstill (a third of the speed, up to full in 0.6 s) rather than at pace. */
export function newGame({ seed = 1, deal = null, hearts = 3, launch = false, section = null, biome = null, piece = null } = {}) {
  const S = {
    v: 1, seed, rng: seed | 0, qrng: (seed ^ 0x9E3779B9) | 0,
    crng: (seed ^ 0x51ED270B) | 0, t: 0, over: false, hearts, maxHearts: hearts, score: 0, bonus: 0, kills: 0, chain: 0, bestChain: 0,
    right: 0, wrong: 0, missed: 0, streak: 0, falls: 0, fwd: launch ? 0.3 : 1,
    hero: { z: 0, x: 0, y: 0, gy: 0, kick: false, padT: 0, vx: 0, vy: 0, lane: 0, mode: "run", wall: 0, wallY: WALL_Y, lunge: null, slam: false, hurt: 0, noWall: 0, roll: 0, rollQ: false, jumps: 0, rollRec: 0 },
    world: { z1: 0, chunks: 0, sinceGate: 0, pits: [], walls: [], decks: [], pads: [], foes: [], gates: [], obs: [], pick: [], rows: [], zones: [], comp: { biome: null, left: 0, last: [], n: 0 }, id: 1 },
    pending: [], answers: [], asked: [], ev: [],
    sec: 0, hits: 0, carried: {}, token: 0, flip: 0, won: false, coins: 0, gems: 0, broke: 0, set: {}, goal: { kind: "none", n: 0 }, bill: { want: [], bad: [] }, par: { hits: 0 },
  };
  S.piece = PIECES[piece] ? piece : null;                           // Playtest: one piece of the quay, again and again
  S.only = biome || (S.piece ? Object.keys(BIOMES).find(b => BIOMES[b].pieces.includes(piece)) || "quays" : null);                                                  // a run kept to one biome (the Playtest viewer): no other, no question
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
  W.obs ||= []; W.pick ||= []; W.decks ||= []; W.pads ||= []; S.hero.gy ||= 0; W.rows ||= []; W.zones ||= []; W.comp ||= { biome: null, left: 0, last: [], n: 0 };
  S.piece ||= null; S.set ||= {}; S.goal ||= { kind: "none", n: 0 }; S.bill ||= { want: [], bad: [] }; S.par ||= { hits: 0 }; S.only ||= null;
  S.sec ||= 0; S.hits ||= 0; S.carried ||= {}; S.token ||= 0; S.flip ||= 0; S.won = !!S.won; S.coins ||= 0; S.gems ||= 0; S.broke ||= 0; if (!Number.isFinite(S.crng)) S.crng = (S.seed ^ 0x51ED270B) | 0;
  return true;
}

export const speed = S => (S.mods ? S.mods.v0 + (S.mods.v1 - S.mods.v0) * (1 - Math.exp(-Math.max(0, S.hero.z) / 700)) : speedAt(S.hero.z)) * S.fwd;
export const laneX = lane => lane * LANE_W;

// ---------- the quay ----------

const floorAt = (S, z) => !S.world.pits.some(p => z > p.z0 && z < p.z1);
const laneOfX = x => clamp(Math.round(x / LANE_W), -1, 1);
/** A deck is ground above the quay (a ramp's slope, a balcony): `y` high over lanes l0 to l1 from z0 to z1, rising over its first `ramp` metres
 *  (none: a sheer front, which a jump has to clear) and falling over its last `down` (none: a drop-down). */
function deckY(d, z) {
  if (z < d.z0 || z > d.z1) return 0;
  if (d.ramp && z < d.z0 + d.ramp) return d.y * (z - d.z0) / d.ramp;
  if (d.down && z > d.z1 - d.down) return d.y * (d.z1 - z) / d.down;
  return d.y;
}
/** The height of the ground at lane x, metre z (0 on the quay). */
export function groundY(S, x, z) {
  const l = laneOfX(x);
  let y = 0;
  for (const d of S.world.decks) if (l >= d.l0 && l <= d.l1) y = Math.max(y, deckY(d, z));
  return y;
}
/** What I would stand on: groundY, or nothing (-Infinity) over a pit with no deck across it. */
const gAt = (S, x, z) => { const g = groundY(S, x, z); return g > 0 || floorAt(S, z) ? g : -Infinity; };
const gyOf = f => f.gy || 0;
const pitAt = (S, z) => S.world.pits.find(p => z >= p.z0 - 0.5 && z <= p.z1 + 0.5) || null;
const wallAt = (S, side, z) => S.world.walls.find(w => w.side === side && z >= w.z0 - 2.2 && z <= w.z1) || null;
const topOf = w => w.top ?? WALL_TOP;
const gateById = (S, id) => S.world.gates.find(g => g.id === id);

function foe(S, kind, lane, z, y = KINDS[kind].y, extra = {}) {
  const gy = groundY(S, laneX(lane), z);
  const f = { id: S.world.id++, kind, lane, x: laneX(lane), z, y: y + gy, gy, h: KINDS[kind].h, alive: true, spent: false, gate: null, ...extra };
  S.world.foes.push(f);
  return f;
}

/** Makes chunks of quay until there is LOOK metres of it ahead of the hero. Which kinds come, and when, is by distance. */
export function ensure(S) {
  const W = S.world;
  if (S.sec) return;                                              // a section is built whole, at its start
  while (W.z1 < S.hero.z + LOOK) chunk(S);
}

/** The next stretch of quay: the start, a question's gap, or a segment from the composer. Segments come by biome, with a difficulty that rises with
 *  the distance, no repeat of the last two, and a short transition between one biome and the next. */
function chunk(S) {
  const W = S.world, z0 = W.z1, C = W.comp;
  W.chunks++; W.sinceGate++;
  let len;
  if (W.chunks === 1) { len = 18; W.zones.push({ z0, z1: z0 + len, biome: S.only || "quays", name: "start" }); }
  else if (S.deal && !S.only && z0 >= GATE_FIRST && W.sinceGate >= GATE_EVERY) { len = gate(S, z0); W.sinceGate = 0; W.zones.push({ z0, z1: z0 + len, biome: C.biome || "quays", name: "question" }); }
  else len = compose(S, z0);
  if (W.chunks > 1 && !W.skipCoins) sprinkle(S, z0, z0 + len);
  W.z1 = z0 + len;
}

/** Picks and builds the next segment (see reckoning-biomes.js). */
function compose(S, z0) {
  const W = S.world, C = W.comp, d = difficultyAt(z0), r = seeded(S.seed * 31 + C.n * 7919 + 11);
  C.n++;
  let seg;
  if (!C.biome || (C.left <= 0 && !S.only)) {                      // a new biome: a short stretch between, the way the old one runs out into the new
    const to = S.only || (C.biome ? nextBiome(C.biome, r) : "quays");
    const first = !C.biome;
    C.biome = to; C.left = 3 + Math.floor(r() * 3);
    if (!first) {
      seg = { kind: "transition", biome: to, id: `to:${to}`, rows: ["!rest 6", ". . .", "!rest 4"], pitch: 11 };
      W.zones.push({ z0, z1: z0 + 21, biome: to, name: "transition", kind: "transition" });
      return buildSegment(S, seg, z0, false);
    }
  }
  if (S.piece) {
    seg = { kind: "made", biome: C.biome, id: S.piece, name: PIECES[S.piece].name, rows: PIECES[S.piece].rows.slice(), pitch: PIECES[S.piece].pitch };
    return buildSegment(S, seg, z0, true);
  }
  for (let tries = 0; tries < 8; tries++) {
    seg = makeSegment(C.biome, Math.floor(r() * 2 ** 30), d, tries > 3 ? "gen" : null);
    if (!C.last.includes(seg.id)) break;                            // no immediate repeats of a made or partial piece (a generated one is new by its seed)
  }
  C.last.push(seg.id); if (C.last.length > 2) C.last.shift();
  C.left--;
  return buildSegment(S, seg, z0, true);
}

/** Builds a segment's rows at z0 and notes its zone; returns the length. */
export function buildSegment(S, seg, z0, zone = true) {
  const W = S.world;
  const end = buildRows(S, seg.rows, z0, Math.max(seg.pitch, Math.ceil(speedAt(z0) * 0.8 + 2.5)));      // rows a jump apart at least: a barrel's jump carries 0.72 s of running
  if (zone) W.zones.push({ z0, z1: end + 4, biome: seg.biome, name: seg.name, kind: seg.kind, id: seg.id });
  return end + 4 - z0;
}

const reach = z => speedAt(z) * airTime();                            // how far a plain jump carries

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
  /** A ramp up to a loft over two lanes, with things to cut and coins on it, and a drop-down at its end; the third lane runs below. */
  ramp(S, z0) {
    const side = pick(S, [-1, 1]), l0 = side > 0 ? 0 : -1, l1 = side > 0 ? 1 : 0, free = -side;
    const d0 = z0 + 8, rl = 14, d1 = d0 + rl + 26;
    deck(S, d0, d1, 3, l0, l1, rl, 0);
    for (let z = d0 + 2; z < d0 + rl + 2; z += 2.5) pickup(S, "coin", l1 === side ? l0 : l1, z);
    const lane = pick(S, [l0, l1]);
    foe(S, "barrel", lane, d0 + rl + 8);
    foe(S, "balloon", lane === l0 ? l1 : l0, d0 + rl + 14, 1.6);
    foe(S, "crab", lane, d0 + rl + 21);
    foe(S, "crab", free, d0 + 20);
    return d1 - z0 + 6;
  },
  /** A balcony with a sheer front (a jump pad in front of it throws me up onto it) over two lanes, balloons and coins on it, and a drop-down at its end. */
  balcony(S, z0) {
    const [l0, l1] = pick(S, [[-1, 0], [0, 1]]);
    const d0 = z0 + 14, d1 = d0 + 30;
    deck(S, d0, d1, 3.2, l0, l1, 0, 0);
    const lane = pick(S, [l0, l1]);
    pad(S, lane, d0 - 4);
    foe(S, "balloon", lane, d0 + 10, 2.2);
    foe(S, "balloon", lane === l0 ? l1 : l0, d0 + 17, 2.2);
    for (let z = d0 + 3; z < d0 + 8; z += 2) pickup(S, "coin", lane, z);
    foe(S, "crab", lane === l0 ? l1 : l0, d0 + 24);
    return d1 - z0 + 6;
  },
  /** Nothing but balloons: a jump pad, and a chain of them hung high above the quay, each one's pop throwing me up to the next. */
  sky(S, z0) {
    const lane = pick(S, [-1, 0, 1]), z = z0 + 8;
    pad(S, lane, z);
    const ys = [3.8, 5.0, 5.0, 5.0, 5.0];
    ys.forEach((y, i) => {
      foe(S, "balloon", lane, z + 5 + i * 6, y);
      if (i < ys.length - 1) pickup(S, "coin", lane, z + 8 + i * 6, { y: y + 0.9 });
    });
    return z + 5 + ys.length * 6 + 8 - z0;
  },
  /** The ship's side: the pit is water, walls stand on both sides, tall: a wall run, a jump off it, across to the other wall, higher each time,
   *  to a balcony beyond the water. */
  climb(S, z0) {
    const L = Math.max(34, speedAt(z0) * 2.6), p0 = z0 + 10, p1 = p0 + L, w0 = p0 - 8, w1 = p1 + 8, top = 8.5;
    for (const side of [-1, 1]) S.world.walls.push({ side, z0: w0, z1: w1, top });
    S.world.pits.push({ z0: p0, z1: p1 });
    deck(S, p1, p1 + 28, 4.4, -1, 1, 0, 6);
    for (let z = p1 + 3; z < p1 + 22; z += 2.5) pickup(S, "coin", 0, z);
    return p1 + 28 - z0 + 6;
  },
};

function deck(S, z0, z1, y, l0, l1, ramp = 0, down = 0) {
  const d = { id: S.world.id++, z0, z1, y, l0, l1, ramp, down };
  S.world.decks.push(d);
  return d;
}
function pad(S, lane, z) {
  const p = { id: S.world.id++, lane, z, y: groundY(S, laneX(lane), z) };
  S.world.pads.push(p);
  return p;
}

// ---------- coins ----------
// Every stretch of quay, in every run and every section, is sprinkled with trails of coins (Subway Surfers' way): a line in a lane that is
// free of foes and blockers, that changes lane where the way is blocked, and that arcs over a barrel and over a gap in the planks, which is
// the path a jump takes. Where a trail ends it now and then ends in amber, hung at the height of a jump or lower. A trail never goes
// through a lane beside a crab (the cut would carry the hero off the line), so following the coins is the safe way.
export const COIN_STEP = 2.4, COIN_ARC = 2.7;
export function sprinkle(S, z0, z1) {
  const W = S.world;
  const near = (a, z, r) => Math.abs(a - z) <= r;
  const blocked = (lane, z) => {
    for (const f of W.foes) {
      if (!f.alive || f.gate || !near(f.z, z, 2.4)) continue;
      if (f.kind === "barrel" || f.kind === "balloon") { if (f.lane === lane && f.kind === "barrel" && near(f.z, z, 0.6)) return true; continue; }
      if (Math.abs(f.lane - lane) <= (f.kind === "crab" ? 1 : 0) && (f.kind === "crab" || f.y < 2)) return true;
    }
    for (const o of W.obs) if (o.lane === lane && near(o.z, z, o.len / 2 + 1.4)) return true;
    for (const p of W.pits) if (!p.gap && z > p.z0 - 1 && z < p.z1 + 1) return true;
    return false;
  };
  const arcY = (lane, z) => {
    let y = 0.55;
    for (const f of W.foes) if (f.alive && f.kind === "barrel" && f.lane === lane && near(f.z, z, COIN_ARC)) y = Math.max(y, 0.55 + 1.15 * (1 - ((z - f.z) / COIN_ARC) ** 2));
    for (const p of W.pits) if (p.gap) { const c = (p.z0 + p.z1) / 2, R = (p.z1 - p.z0) / 2 + COIN_ARC; if (near(c, z, R)) y = Math.max(y, 0.55 + 1.0 * (1 - ((z - c) / R) ** 2)); }
    return Math.min(y, 1.5);
  };
  let lane = pickc(S, [-1, 0, 1]), left = 0, pause = 1 + Math.floor(rnd(S, "crng") * 3), made = 0;
  for (let z = z0 + 5; z < z1 - 3; z += COIN_STEP) {
    if (left <= 0) {
      if (--pause > 0) continue;
      const free = [-1, 0, 1].filter(l => !blocked(l, z)).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane));
      if (!free.length) { pause = 1; continue; }
      lane = free[0]; left = 5 + Math.floor(rnd(S, "crng") * 6); made = 0;
    }
    if (blocked(lane, z)) {                                       // the way is blocked: the trail swerves to a lane that is free here, or ends
      const free = [lane - 1, lane + 1].filter(l => l >= -1 && l <= 1 && !blocked(l, z) && !blocked(l, z + COIN_STEP * 1.5));
      if (free.length) lane = pick(S, free); else { left = 0; pause = 2; continue; }
    }
    const end = --left <= 0;
    if (end && made >= 3 && rnd(S, "crng") < 0.07) pickup(S, "gem", lane, z, { y: rnd(S, "crng") < 0.4 ? 2.0 : 1.0 });
    else pickup(S, "coin", lane, z, { y: arcY(lane, z) });
    made++;
    if (end) pause = 3 + Math.floor(rnd(S, "crng") * 4);
  }
}

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
// g gull; b barrel (jump it), B beam (roll under it), X cart (go round); goods s salt, h herring, f furs, w wax, t timber,
// a amber (hung in the air); 1 2 3 a token; T1 T2 T3 a toll booth that lets through only the token of its number;
// L a lever (turns the drawbridges over); F0 F1 a drawbridge, up when the lever is at that number; W0 W1 W2 a sluice gate
// that opens and shuts on a beat, the three a third of a beat apart; H a meal (a heart back). A row beginning with ! is a
// piece of the old quay: !rest n, !gap n (a gap in the planks of n metres), !gate (a question), !chain, !wall, !wallslam, !pitch n.
export const OBS = {                       // what blocks: base, top and length along the quay
  barrel: { y0: 0, y1: 0.85, len: 0.9 },   // (a barrel is a foe now; this is only for a run kept from before)
  beam: { y0: 0.8, y1: 2.2, len: 1.0 },
  cart: { y0: 0, y1: 2.6, len: 1.6 },
  toll: { y0: 0, y1: 2.6, len: 1.0 },
  bridge: { y0: 0, y1: 2.4, len: 2.4 },    // the raised leaf of a drawbridge stands this high at the span's far end
  tide: { y0: 0, y1: 2.6, len: 1.0 },
};
export const ROLL_H = 0.6;                 // the height of a hero rolling: a beam hangs above it
export const TIDE_P = 3.0, TIDE_OPEN = 0.5, TIDE_WARN = 0.7;   // a sluice gate: the beat in seconds, the part of it that it is open, and the seconds of warning before it changes
export const GOODS = { s: "salt", h: "herring", f: "furs", w: "wax", t: "timber", a: "amber" };
export const LOAD_LESS = 0.025, LOAD_MIN = 0.8;   // what each good carried takes off the speed of a jump, and the least it comes to

export const loadFactor = S => (S.mods?.laden ? Math.max(LOAD_MIN, 1 - LOAD_LESS * (S.carried.total || 0)) : 1);

/** Whether a thing on the quay stops the hero now. */
export function solid(S, o) {
  switch (o.kind) {
    case "toll": return S.token !== o.mark;
    case "bridge": return bridgeUp(S, o);
    case "tide": return tide(S, o).state === "shut" || tide(S, o).state === "opening";
    default: return true;
  }
}

/** A sluice gate now: "open" (raised, passable), "closing" (still passable: the lamp flashes and the leaf is half down), "shut", or
 *  "opening" (still shut: the lamp flashes and the leaf is half up); `left` the seconds until the next of those. */
export function tide(S, o) {
  const f = (((S.t / TIDE_P + o.ph) % 1) + 1) % 1, toShift = (f < TIDE_OPEN ? TIDE_OPEN - f : 1 - f) * TIDE_P;
  if (f < TIDE_OPEN) return { state: toShift <= TIDE_WARN ? "closing" : "open", left: toShift };
  return { state: toShift <= TIDE_WARN ? "opening" : "shut", left: toShift };
}
/** Which colour a drawbridge is (0 red, 1 blue), and whether it is up (shut to the hero) now. */
export const bridgeUp = (S, o) => (o.link ? !S.set[o.link] : S.flip === o.flip);
/** The colour the next lever step lowers: the bridges that are up now. */
export const leverLowers = S => S.flip;

function obstacle(S, kind, lane, z, extra = {}) {
  const d = OBS[extra.shape || kind] || OBS.cart;
  const gy = groundY(S, laneX(lane), z);
  const o = { id: S.world.id++, kind, shape: extra.shape || kind, lane, z, len: d.len, y0: d.y0 + gy, y1: d.y1 + gy, ...extra };
  S.world.obs.push(o);
  return o;
}
function pickup(S, kind, lane, z, extra = {}) {
  const p = { id: S.world.id++, kind, lane, z, y: (kind === "amber" ? 2.3 : 0.55) + groundY(S, laneX(lane), z), taken: false, ...extra };
  S.world.pick.push(p);
  return p;
}

function cell(S, tok, lane, z, ctx = {}) {
  switch (tok) {
    case ".": return;
    case "c": foe(S, "crab", lane, z); return;
    case "C": foe(S, "crab", lane, z, 0, { hp: 2, heavy: true }); return;
    case "g": foe(S, "gull", lane, z); return;
    case "b": foe(S, "barrel", lane, z); return;
    case "o": foe(S, "balloon", lane, z); return;                    // a balloon
    case "O": foe(S, "balloon", lane, z, 3.6); return;               // and a high one: out of reach from the planks
    case "$": pickup(S, "coin", lane, z); return;                    // a coin
    case "^": pickup(S, "coin", lane, z, { y: 1.8 + groundY(S, laneX(lane), z) }); return;        // a coin at the height of a jump
    case "A": pickup(S, "gem", lane, z, { y: 1.0 + groundY(S, laneX(lane), z) }); return;         // amber, rare
    case "B": obstacle(S, "beam", lane, z); return;
    case "X": obstacle(S, "cart", lane, z); return;
    case "L": pickup(S, "lever", lane, z); return;
    case "H": pickup(S, "meal", lane, z); return;
    case "1": case "2": case "3": pickup(S, "token", lane, z, { mark: +tok }); return;
  }
  if (GOODS[tok]) { pickup(S, GOODS[tok], lane, z, { good: true }); return; }
  const m = /^([TFWKJ])(\d)$/.exec(tok);
  if (!m) throw new Error(`Courier: unknown cell "${tok}"`);
  if (m[1] === "K" || m[1] === "J") {                               // a lever and the bridges tied to it alone (K1 lowers every J1 after it): nothing else is affected
    const n = +m[2], link = (ctx.links ||= {})[n] ??= S.world.id++, col = (n - 1) % 2;
    if (m[1] === "K") pickup(S, "lever", lane, z, { link, col }); else obstacle(S, "bridge", lane, z, { link, flip: col });
    return;
  }
  if (m[1] === "T") obstacle(S, "toll", lane, z, { mark: +m[2] });
  else if (m[1] === "F") obstacle(S, "bridge", lane, z, { flip: +m[2] });
  else obstacle(S, "tide", lane, z, { ph: +m[2] / 3 });
}

/** What a section is made of, as a short string: a run kept from before the section was changed is not the section any more, and is dropped. */
export function sectionSig(def) {
  const text = JSON.stringify([def.rows, def.v0, def.v1, def.gap, def.omega, def.laden, def.hearts, def.bill]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Lays rows on the quay from z (one every `pitch` metres; `!` commands lay the old pieces) and returns where the next would be. */
export function buildRows(S, rows, z, pitch) {
  const W = S.world, ctx = {};
  for (const row of rows) {
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
    cells.forEach((tok, i) => cell(S, tok, i - 1, z, ctx));
    W.rows.push(z);
    z += pitch;
  }
  return z;
}

/** Makes a section's quay whole, as `def` (reckoning-sections.js) describes it. */
export function beginSection(S, def) {
  const W = S.world;
  S.sec = def.id; S.sig = sectionSig(def); S.rng = (def.id * 7919 + 17) | 0; S.crng = (def.id * 104729 + 5) | 0;              // the quay is the same every time; only the questions are dealt afresh
  S.hearts = S.maxHearts = def.hearts ?? 3;
  S.mods = { v0: def.v0, v1: def.v1 ?? def.v0, omega: def.omega || 0, laden: def.laden || 0, fog: def.fog || 0 };
  S.bill = { want: def.bill?.want || [], bad: def.bill?.bad || [] };
  S.goal = def.goal || { kind: "none", n: 0 };
  S.par = def.par || { hits: 0 };
  W.rows = [];
  const z = buildRows(S, def.rows, def.lead ?? 16, def.gap);
  W.finish = z + 6; W.z1 = W.finish + 30;
  if (def.coins !== false) sprinkle(S, def.lead ?? 16, W.finish);
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
  for (const pd of W.pads) {                                       // a jump pad throws me up when I run onto it (or come down on it)
    if (h.mode === "wall" || S.t < h.padT || Math.abs(pd.z - h.z) > 0.7 || Math.abs(laneX(pd.lane) - h.x) > 0.75 || h.y - pd.y > 0.4) continue;
    h.mode = "air"; h.vy = T.PAD_V; h.roll = 0; h.jumps = 0; h.slam = false; h.padT = S.t + 0.4; h.kick = false;
    S.ev.push({ type: "pad", id: pd.id, lane: pd.lane });
  }
  for (const p of W.pick) {
    if (p.taken || Math.abs(p.z - h.z) > 0.8 || h.mode === "wall" || Math.abs(laneX(p.lane) - h.x) > 0.8) continue;
    if (h.y + hh < p.y - (p.kind === "coin" || p.kind === "gem" ? COIN_PASS : 0.3) || h.y > p.y + 0.3) continue;
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
    case "lever": if (p.link) S.set[p.link] = 1; else S.flip ^= 1; break;
    case "meal": if (S.hearts < S.maxHearts) { S.hearts++; S.ev.push({ type: "heart", hearts: S.hearts }); } break;
    case "coin": S.coins++; S.ev.push({ type: "pick", what: "coin", id: p.id, n: S.coins }); return;
    case "gem":                                                   // amber: a heart back, or a heart more (up to GEM_MAX_HEARTS)
      S.gems++;
      if (S.hearts >= S.maxHearts && S.maxHearts < GEM_MAX_HEARTS) S.maxHearts++;
      if (S.hearts < S.maxHearts) S.hearts++;
      S.bonus += 250;
      S.ev.push({ type: "heart", hearts: S.hearts, gem: true });
      break;
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
    if ((t < -0.05 && !late(f)) || t >= bt) continue;
    if (ok(f, t)) { best = f; bt = t; }
  }
  return best;
}
const grounded = h => h.mode === "run";

/** A swipe: "up" | "down" | "left" | "right". It works now if it can, else waits a moment (BUFFER) for something to work on. */
export function swipe(S, dir) {
  if (S.over) return S.ev;
  if (!resolve(S, dir)) { const keep = keepFor(S, dir); S.pending.push({ dir, until: S.t + keep }); S.ev.push({ type: "wait", dir, keep }); }
  return S.ev;
}

/** How long a swipe with nothing to work on is kept: BUFFER, or for a jump swiped in the air with none in hand, until the planks
 *  are under me (at most LAND_BUFFER), so a jump swiped early on the way down still jumps as I land. */
function keepFor(S, dir) {
  const h = S.hero;
  if (dir !== "up" || h.mode !== "air" || h.lunge) return T.BUFFER;
  const gf = T.G * T.FALL, y = Math.max(0, h.y - h.gy);              // y + vy t - gf t²/2 = 0 (on the way up: up to the top, then down)
  const t = h.vy > 0 && T.FALL !== 1 ? h.vy / T.G + Math.sqrt(2 * (y + h.vy * h.vy / (2 * T.G)) / gf) : (h.vy + Math.sqrt(h.vy * h.vy + 2 * gf * y)) / gf;
  return clamp(t + 0.03, T.BUFFER, T.LAND_BUFFER);
}

function resolve(S, dir) {
  const h = S.hero;
  if (h.lunge && (dir === "up" || dir === "down")) return false;   // while I fly at a foe only a swipe sideways counts: it moves the cut
  return dir === "up" ? up(S) : dir === "down" ? down(S) : side(S, dir === "left" ? -1 : 1);
}

/** A foe the swipe going on is for cannot hurt me: its target, and the ones a sweep goes on to. */
const targeted = (h, f) => !!h.lunge && (h.lunge.foe === f.id || (h.lunge.also || []).includes(f.id));
/** A foe already hitting me (its hit waits LATE_WIN) is still a target for as long as it waits, however late the swipe. */
const late = f => f.threat != null;

function up(S) {
  const h = S.hero;
  if (h.mode === "wall") {
    const w = h.wall;
    h.mode = "air"; h.vy = T.WALLJUMP_V; h.wall = 0; h.noWall = S.t + 0.3; h.kick = true;   // kick: I came off a wall, so the one across (or a higher stretch of this one) can be joined
    S.ev.push({ type: "walljump", side: w, y: h.y });
    return true;
  }
  // a foe on the ground in front of me needs me close; one in the air I can reach from further, from the ground or the air
  const f = nearest(S, (f, t) => {
    if (f.lane !== h.lane) return false;                          // by the lane I mean to be in, not the x I am passing through
    if (f.y - gyOf(f) <= 0.3) return t <= T.FRONT_WIN && h.y - gyOf(f) < 1;
    const up = f.y + f.h * 0.3 - h.y;
    return t <= (f.gate ? GATE_WIN : f.ph > 0 && h.y - h.gy < 0.5 ? GULL_UP_WIN : T.ABOVE_WIN) && up <= REACH_UP && h.y - f.y <= UP_ABOVE;      // a swoop down to a gull just below counts; from higher it is a bonk
  });
  if (f) { startLunge(S, f, 0, f.y - gyOf(f) <= 0.3 ? "front" : "above"); return true; }
  if (grounded(h)) {
    h.mode = "air"; h.vy = T.JUMP_V * loadFactor(S); h.roll = 0;
    S.ev.push({ type: "jump" });
    return true;
  }
  if (h.mode === "air" && !h.jumps && h.coyote > S.t && h.vy <= 0) {   // a moment after the quay ended: still a ground jump
    h.coyote = 0; h.vy = T.JUMP_V * loadFactor(S); h.roll = 0;
    S.ev.push({ type: "jump" });
    return true;
  }
  if (h.mode === "air" && h.jumps > 0) {                          // a cut in the air gave my jump back: one more, from here
    h.jumps = 0; h.slam = false; h.vy = Math.max(h.vy, T.JUMP_V * loadFactor(S));
    S.ev.push({ type: "jump", air: true });
    return true;
  }
  return false;
}

function side(S, dir) {
  const h = S.hero;
  if (h.lunge) return retarget(S, dir);
  if (h.mode === "wall") {
    if (dir !== -h.wall) return true;                             // towards the wall I am on: nothing to do (and nothing kept to do later)
    h.mode = "air"; h.vy = 0; h.noWall = S.t + 0.3; h.lane = h.wall; h.wall = 0;
    S.ev.push({ type: "wallleave" });
    const t = sideTarget(S, h.lane + dir, dir);                   // a foe in reach that way (4 November 2026, Korbi): leaving is the aerial cut a swipe in the air would make
    if (t) cutSide(S, t, dir);
    return true;
  }
  const wl = wallAt(S, dir, h.z + 0.6), room = wl ? topOf(wl) - 0.3 - h.y : -1;       // room: how far under the wall's top my feet are
  const same = h.lane === dir && S.t >= h.noWall, across = h.kick && h.mode === "air" && h.lane === -dir;
  if (wl && (same || across) && (grounded(h) || room >= 0)) { enterWall(S, dir, wl, { across: !same }); return true; }
  const lane = h.lane + dir;
  if (lane < -1 || lane > 1) return false;
  const tgt = sideTarget(S, lane, dir), f = tgt && tgt.f;
  // from the middle lane, towards a wall in the edge lane, with no foe to cut on the way: one swipe, by way of the lane, is the wall run
  if (!f && wl && h.lane === 0 && S.t >= h.noWall && (grounded(h) || room >= 0)) {
    h.lane = dir;
    S.ev.push({ type: "lane", lane: dir, dir });
    enterWall(S, dir, wl, { via: true });
    return true;
  }
  if (tgt) cutSide(S, tgt, dir);
  else moveTo(S, lane, dir);
  return true;
}

/** The lane change of a swipe sideways, noted for the clash rule. */
function moveTo(S, lane, dir) {
  const h = S.hero;
  h.swipe = { t: S.t, dir, from: h.lane };
  h.lane = lane;
  S.ev.push({ type: "lane", lane, dir });
}

/** The foe a swipe sideways goes for: the next lane's first; with none in range there, one two lanes across (the hero crosses both lanes to it). */
function sideTarget(S, lane, dir) {
  if (lane < -1 || lane > 1) return null;
  let f = sideFoe(S, lane), to = lane;
  if (!f && lane + dir >= -1 && lane + dir <= 1) { f = sideFoe(S, lane + dir); if (f) to = lane + dir; }
  return f ? { f, to } : null;
}

/** A swipe sideways that cuts: into the foe's lane, and at it. */
function cutSide(S, { f, to }, dir) {
  moveTo(S, to, dir);
  startLunge(S, f, dir, "side");
}

/** Onto the wall `wl` on side `dir`. */
function enterWall(S, dir, wl, extra) {
  const h = S.hero;
  h.wallY = grounded(h) ? Math.min(WALL_Y, topOf(wl) - 0.5) : clamp(h.y, 1.4, topOf(wl) - 0.5);   // from the planks the wall lifts me; from the air I keep my height
  h.mode = "wall"; h.wall = dir; h.lane = dir; h.kick = false;
  h.vy = 0; h.roll = 0; h.jumps = 0;
  S.ev.push({ type: "wallrun", side: dir, y: h.wallY, ...extra });
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
  const f = nearest(S, (f, t) => f.lane === lane && (t >= RETARGET_MIN || late(f)) && t <= (f.gate ? GATE_WIN : T.SIDE_WIN) &&
    (f.y - gyOf(f) <= 0.3 || sideReach(f, h)));
  if (!f) return false;
  h.swipe = { t: S.t, dir, from: h.lane };
  h.lane = lane;
  L.foe = f.id; L.left = L.total = Math.max(0.06, ttcOf(S, f)); L.how = "side"; L.dir = dir; L.air = L.air || f.y - gyOf(f) > 0.3;
  S.ev.push({ type: "lane", lane, dir }, { type: "lunge", how: "side", kind: f.kind, gate: f.gate ? f.gate.id : 0, retarget: true });
  return true;
}

/** The foe a swipe sideways can cut in `lane`: on the ground I cut one on the ground (and, coming down, I swoop onto one
 *  from up to 4.5 m above it); in the air, one in the air within reach of my height. */
function sideFoe(S, lane) {
  const h = S.hero, falling = h.mode === "air" && h.vy <= 0;
  return nearest(S, (f, t) => f.lane === lane && (late(f) || t >= 0) && t <= (f.gate ? GATE_WIN : T.SIDE_WIN) &&
    (f.y - gyOf(f) <= 0.3 ? h.y - gyOf(f) < 1 || (falling && h.y - (f.y + f.h * 0.3) <= 4.5)
      : (diving(f) && h.y - h.gy < 1) || (h.y - h.gy >= 0.5 && sideReach(f, h))));
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
    if (h.rollRec > 0) return false;                               // recovering from the last: the swipe waits its BUFFER for the roll to be allowed
    h.roll = T.ROLL_T; h.rollQ = false;
    S.ev.push({ type: "roll" });
    return true;
  }
  const f = nearest(S, (f, t) => f.lane === h.lane && t <= 0.22 && h.y >= f.y + f.h - 0.1 && h.y - (f.y + f.h) <= 4);
  if (f) { startLunge(S, f, 0, "bonk"); return true; }
  h.slam = h.y - h.gy >= T.SLAM_MIN_Y;
  h.vy = -SLAM_V;
  S.ev.push({ type: "dive", slam: h.slam });
  return true;
}

/** The hero commits to a foe: he is carried to it in the time it takes the quay to bring it to him. `dir` is the way a
 *  swipe sideways went (-1, 1; 0 for the others), which a cut that goes on to the next foe carries on in. */
function startLunge(S, f, dir, how, extra = {}) {
  const h = S.hero;
  const left = Math.max(0.06, ttcOf(S, f));
  h.lunge = { foe: f.id, how, dir, left, total: left, air: h.y - h.gy > 0.5 || f.y - gyOf(f) > 0.3 };       // air: it set off from the air, or is at a foe in it, so it counts as an attack in the air
  h.vy = 0; h.slam = false; h.roll = 0;
  // the foes a sweep will go on to are as safe as the one it is for: the swipe is for all of them
  if (dir && how === "side") { const n = sweepFoe(S, f.lane + dir, left); if (n && n.id !== f.id) h.lunge.also = [n.id]; }
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
    const om = S.mods?.omega || T.LANE_OMEGA;                         // wet planks are slower to turn on
    const d = h.x - tx, v0 = h.vx || 0, e = Math.exp(-om * dt), c = v0 + om * d;
    h.x = tx + (d + c * dt) * e;
    h.vx = (v0 - om * c * dt) * e;
    if (Math.abs(h.x - tx) < 5e-4 && Math.abs(h.vx) < 0.05) { h.x = tx; h.vx = 0; }
  }

  // up and down
  if (h.lunge) lungeStep(S, dt);
  else if (h.mode === "wall") {
    const w = wallAt(S, h.wall, h.z);
    if (!w || h.z > w.z1) { h.mode = "air"; h.vy = 0; h.lane = h.wall; h.wall = 0; h.noWall = S.t + 0.3; h.kick = false; ev.push({ type: "wallend", y: h.y }); }
    else { h.y += clamp(h.wallY - h.y, -14 * dt, 14 * dt); h.vy = 0; }
  } else {
    const g = gAt(S, h.x, h.z);
    h.gy = g === -Infinity ? 0 : g;
    if (g > 0.5 && g - h.y > 0.6) {                        // a deck's sheer front, run or jumped into too low: a heart, and I stand on it
      if (!h.hurt) { bump(S, { id: 0 }); if (S.over) return ev; }
      h.y = g; h.vy = Math.max(0, h.vy);
    }
    if (h.mode === "run") {
      if (g === -Infinity) { h.mode = "air"; h.vy = 0; h.roll = 0; h.coyote = S.t + T.COYOTE; }
      else if (h.y - g > 0.25) { h.mode = "air"; h.vy = 0; h.roll = 0; h.coyote = S.t + T.COYOTE; }      // off the edge of a deck: down I go
      else h.y = g;                                                // a ramp carries me up and down it
    }
    if (h.mode === "air") {
      if (h.vy > -SLAM_V + 0.01 || !h.slam) h.vy -= T.G * (h.vy < 0 ? T.FALL : 1) * dt;
      h.y += h.vy * dt;
      if (h.vy <= 0) diveHits(S, prevY);
      if (!h.lunge && h.vy <= 0 && g !== -Infinity && h.y <= g && h.y > g - 0.6) land(S);
      else if (h.y < -3) fall(S);
    }
  }
  if (S.over) return ev;

  // a roll cuts down every foe on the ground that reaches me in my lane
  if (h.roll > 0) {
    h.roll = Math.max(0, h.roll - dt);
    for (const f of alive(S)) {
      if (f.gate || isAir(f) || f.y - gyOf(f) > 0.3 || f.lane !== h.lane) continue;      // (a gull's dive is gone under, not cut)
      const dz = f.z - h.z;
      if (dz < -FOE_REACH || dz > ROLL_REACH) continue;
      if ((f.hp || 1) > 1) { stagger(S, f); continue; }
      f.alive = false; S.kills++; S.bonus += 100;
      S.ev.push({ type: "kill", id: f.id, kind: f.kind, how: "roll", x: f.x, y: f.y, z: f.z });
      payout(S, f);
    }
    if (h.roll === 0) {
      if (h.rollQ) { h.roll = T.ROLL_T; h.rollQ = false; ev.push({ type: "roll", again: true }); }
      else h.rollRec = T.ROLL_REC;                                 // the last roll of a run of them is over: a moment to get up
    }
  } else if (h.rollRec > 0) h.rollRec = Math.max(0, h.rollRec - dt);

  think(S);
  drift(S, dt);

  // what the foes do
  for (const f of alive(S)) {
    if (f.gate) continue;
    if (late(f)) {                                                  // it is hitting me, but a swipe at it still wins for LATE_WIN seconds
      if (targeted(h, f)) continue;                                 // (the swipe is not done yet: it cannot hurt me)
      if (clashes(S, f)) { clash(S, f); continue; }
      if (h.hurt > 0) f.threat = null;
      else if (S.t - f.threat >= T.LATE_WIN) { f.threat = null; hit(S, f); if (S.over) return ev; }
      continue;
    }
    const dz = f.z - h.z;
    if (dz < -FOE_REACH || dz > FOE_REACH) continue;
    if (h.hurt > 0 || targeted(h, f)) continue;
    if (Math.abs(f.x - h.x) > (inert(f) ? 0.75 : f.ph === 3 ? HIT_X : LANE_W * 1.05)) continue;     // a launched foe hits where it aimed; the others, the lane they are in and the next
    if (KINDS[f.kind].air && h.roll > 0 && grounded(h)) continue;                  // a roll goes under a gull's dive
    if (h.y < f.y + f.h - 0.15 && h.y + HERO_H > f.y + 0.1) {
      if (clashes(S, f)) clash(S, f);
      else if (inert(f) || T.LATE_WIN <= 0) hit(S, f);
      else f.threat = S.t;
    }
    if (S.over) return ev;
  }

  touch(S); if (S.over) return ev;
  if (S.sec && h.z >= S.world.finish) { finish(S); return ev; }

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
  const h = S.hero, L = h.lunge, high = h.y - h.gy > 0.5 || !!L?.air;
  h.lunge = null;
  h.y = Math.max(h.y, h.gy);
  if (f.gate) {
    const g = gateById(S, f.gate.id);
    const right = g && g.state === "open" && f.gate.i === g.q.a;
    if (!g || g.state !== "open") { h.vy = high ? T.CHAIN_V : T.HOP_V; h.mode = "air"; if (high) h.jumps = 1; return; }
    g.pick = f.gate.i;
    if (right) {
      g.state = "right";
      f.alive = false;
      for (const o of S.world.foes) if (o.gate && o.gate.id === g.id) o.alive = false;         // the others fly off
      h.vy = T.CHAIN_V; h.mode = "air"; h.jumps = 1;
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
    h.mode = "air"; h.vy = how === "bonk" ? T.BONK_V : high ? T.CHAIN_V : T.HOP_V;
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
  S.ev.push({ type: "kill", id: f.id, kind: f.kind, how, chain: S.chain, x: f.x, y: f.y, z: f.z, dir: L?.dir || 0 });
  payout(S, f);
  // a cut sideways goes on, in the same direction, to the next foe in reach: no hop in between
  const next = how === "side" && L?.dir ? sweepFoe(S, h.lane + L.dir) : null;
  if (next) {
    h.lane += L.dir;
    S.ev.push({ type: "lane", lane: h.lane, dir: L.dir });
    startLunge(S, next, L.dir, "side", { sweep: true });
    h.lunge.air = air || next.y - gyOf(next) > 0.3;
    return;
  }
  h.mode = "air";
  h.vy = how === "bonk" ? T.BONK_V : air ? T.CHAIN_V : T.HOP_V;
}

/** A foe lunging at me that I have just swiped into (4 November 2026, Korbi: "if I swipe into an enemy next to me that is lunging at me, they
 *  shouldn't then go through me, they should bounce back once we collide and die or lose their attack"). It counts when the foe has launched
 *  (`ph` 3), came from the side the swipe went to (any lane that way), and the swipe was at most CLASH_T ago, a sideways swipe that moved me
 *  (a cut, a lane change, a cut moved on). A roll alone does not count: 2 November, "rolling on a lane that the attacking enemy isn't on
 *  won't dodge their side lunges". */
export const CLASH_T = 0.3;
const clashes = (S, f) => {
  const w = S.hero.swipe;
  return !!w && f.ph === 3 && !inert(f) && !f.gate && S.t - w.t <= CLASH_T && Math.sign(f.lane - w.from) === w.dir;
};

/** The collision goes my way: a foe is knocked back and dies (a bruiser loses the attack and is thrown back), and I am not hurt. In the air it is an
 *  aerial kill: the chain and my jump back, as for any cut there. */
function clash(S, f) {
  const h = S.hero, dir = h.swipe.dir;
  f.threat = null;
  S.ev.push({ type: "clash", id: f.id, kind: f.kind, dir });
  if ((f.hp || 1) > 1) { stagger(S, f); return; }
  f.alive = false; S.kills++;
  const air = h.y - h.gy > 0.5;
  if (air) { S.chain++; S.bestChain = Math.max(S.bestChain, S.chain); h.jumps = 1; h.vy = Math.max(h.vy, T.CHAIN_V); }
  S.bonus += 100 + (air ? 50 * Math.min(S.chain, 8) : 0);
  S.ev.push({ type: "kill", id: f.id, kind: f.kind, how: "clash", chain: air ? S.chain : 0, x: f.x, y: f.y, z: f.z, dir });
  payout(S, f);
}

/** What a thing broken by an attack gives: a barrel or a balloon, coins (they are credited at once and fly to the counter). */
function payout(S, f) {
  const n = BREAK_COINS[f.kind] || 0;
  if (!n) return;
  S.coins += n; S.broke++;
  S.ev.push({ type: "coins", n, x: f.x, y: f.y + f.h / 2, z: f.z, kind: f.kind });
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
function sweepFoe(S, lane, ahead = 0) {
  const h = S.hero;
  if (lane < -1 || lane > 1) return null;
  return nearest(S, (f, t) => f.lane === lane && !f.gate && (t >= -0.02 || late(f)) && t <= SWEEP_WIN + ahead &&
    (f.y - gyOf(f) <= 0.3 ? h.y - gyOf(f) < 1 : h.y - h.gy >= 0.5 && sideReach(f, h)));
}

// ---------- the foes' minds ----------

const isAir = f => KINDS[f.kind].air;
const inert = f => !!KINDS[f.kind].inert;

/** A foe within a lane of me sees me (`ph` 1: it looks my way), winds up (2) and launches (3), by seconds to contact so
 *  it is the same at any speed. The launch commits it to the lane I am in then (`aim`): a crab slides across to it, a gull
 *  dives onto it, and the hit lands there, so a lane changed, a jump or a roll after the launch is a dodge. A gull in my own
 *  lane attacks too, diving down it (4 November 2026, Korbi: "rolling or moving after they launched (very close) can dodge"), and none
 *  attacks me in the air or on a wall. A foe I only come within a lane of at the
 *  last moment goes through all three in a step or two: it was not given the time to be seen. Foes over a pit, and the
 *  gulls of a question, are the bridge, not an enemy. */
function think(S) {
  const h = S.hero, v = speed(S), reachT = FOE_REACH / v;
  for (const f of alive(S)) {
    if (f.gate || inert(f) || !floorAt(S, f.z)) continue;
    const t = (f.z - h.z) / v;
    let ph = f.ph || 0;
    if (ph === 3) { fly(f, t - reachT); continue; }
    if (t < -reachT) continue;
    const dl = h.lane - f.lane;
    if (t > SIGHT_T || Math.abs(dl) > 1) { f.ph = 0; continue; }
    f.look = Math.sign(dl);
    if (ph === 0) { ph = 1; f.pt = S.t; S.ev.push({ type: "notice", id: f.id, kind: f.kind, lane: f.lane, look: f.look }); }
    if (ph === 1 && t <= WIND_T) { ph = 2; f.pt = S.t; S.ev.push({ type: "wind", id: f.id, kind: f.kind, lane: f.lane }); }
    if (ph === 2 && t <= LAUNCH_T && (!isAir(f) || (grounded(h) && !h.lunge))) {      // (a gull does not dive while I fly at something: at it, it would run from my cut)
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
    if (f.gate || inert(f) || !isAir(f) || f.ph === 3) continue;
    const t = (f.z - h.z) / v;
    if (t < -FOE_REACH / v || t > DRIFT_T || !floorAt(S, f.z)) continue;
    const dy = h.y - f.y;
    const want = dy > above ? Math.min(FLY_MAX + gyOf(f), h.y - above) : dy < -below ? Math.max(KINDS[f.kind].y + gyOf(f), h.y + below) : f.y;
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
  h.y = Math.max(0, h.gy); h.vy = 0; h.coyote = 0; h.mode = "run"; h.slam = false; h.jumps = 0; h.kick = false;
  S.chain = 0;
  S.ev.push({ type: "land", slam, v: impact });
  if (dived && !slam) {                                         // down in a jump, with no foe to bonk and not high enough to slam, lands in a roll (2 November 2026, Korbi)
    h.roll = T.ROLL_T; h.rollQ = false;
    S.ev.push({ type: "roll", land: true });
  }
  if (!slam) return;
  let n = 0;
  for (const f of alive(S)) {
    if (f.gate || f.y - gyOf(f) > 1) continue;
    const dz = f.z - h.z;
    if (dz < -1 || dz > SLAM_R || Math.abs(f.x - h.x) > LANE_W * 1.05 + 0.1) continue;
    f.alive = false; n++; S.kills++;
    S.bonus += 100 + 25 * n;
    S.ev.push({ type: "kill", id: f.id, kind: f.kind, how: "slam", x: f.x, y: f.y, z: f.z });
    payout(S, f);
  }
  S.ev.push({ type: "shockwave", n });
}

function hit(S, f) {
  const h = S.hero;
  if (f.kind === "balloon") {                                     // run into, a balloon pops for nothing: it only ends my chain
    f.alive = false; S.chain = 0;
    S.ev.push({ type: "kill", id: f.id, kind: f.kind, how: "bump", x: f.x, y: f.y, z: f.z, reward: false });
    return;
  }
  if (f.kind === "barrel") {                                      // a barrel run into breaks, and costs the heart
    f.alive = false;
    S.ev.push({ type: "kill", id: f.id, kind: f.kind, how: "crash", x: f.x, y: f.y, z: f.z, reward: false });
  }
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
  h.y = Math.max(0, groundY(S, h.x, h.z)); h.vy = 0; h.mode = "run"; h.slam = false; h.lunge = null; h.hurt = HURT_T + 0.3; h.roll = 0; h.jumps = 0; h.vx = 0; h.kick = false;
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
  W.decks = W.decks.filter(d => d.z1 > z);
  W.pads = W.pads.filter(p => p.z > z);
  W.gates = W.gates.filter(g => g.p1 > z);
  W.obs = W.obs.filter(o => o.z > z);
  W.pick = W.pick.filter(p => p.z > z);
  W.rows = W.rows.filter(r => r > z);
  W.zones = W.zones.filter(q => q.z1 > z);
}
