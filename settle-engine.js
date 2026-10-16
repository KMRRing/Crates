// Settle's rules, pure (no page): a tank farm of six tanks, eight parcels high, and four grades of liquid from the
// heaviest to the lightest: water, FAME (biodiesel), diesel, naphtha. A parcel pumped into a tank sinks below every
// lighter one and settles on what's heavier, lifting the lighter ones a level, so a tank always stands in order. Three
// or more parcels of one grade at one level, in neighbouring tanks, ship out; what floated above them drops a level,
// which can line up more. Two parcels are offered at a time; you choose which and where. Every few pumps a delivery
// comes in of its own, more often as the game goes on. A tank pumped past eight spills its top parcel, a life lost,
// and the third spill ends the game. The page (settle.js) draws it; tests/settle.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), tanks (six lists of grades 0–3, bottom up, each in
// order), hand (the two parcels offered), pumps, untilDelivery, lives, score, over }.

export const TANKS = 6, LEVELS = 8, GRADES = 4, LIVES = 3, START = 14;
export const NAMES = ["Water", "FAME", "Diesel", "Naphtha"], DENSITY = [999, 883, 835, 700];   // kg/m³ at 15 °C
// the deliveries: until so many pumps, every so many pumps, so many parcels
export const PACE = [[25, 3, 1], [60, 2, 1], [120, 1, 1], [200, 1, 2], [Infinity, 1, 3]];
const paceAt = pumps => PACE.find(([until]) => pumps < until);
export const deliveryEvery = pumps => paceAt(pumps)[1];
export const deliveryCount = pumps => paceAt(pumps)[2];

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

/** The tanks with a parcel of grade g pumped into tank t: it settles on what's as heavy or heavier. */
export function pumped(tanks, t, g) {
  const out = tanks.map(x => x.slice()), at = out[t].filter(x => x <= g).length;
  out[t].splice(at, 0, g);
  return out;
}
/** The parcels in a line: three or more of a grade at one level in neighbouring tanks ([t, level] pairs). */
export function lines(tanks) {
  const out = [];
  for (let level = 0; level < LEVELS + 1; level++) {
    let start = 0;
    for (let t = 1; t <= tanks.length; t++) {
      const g = tanks[start]?.[level];
      if (t < tanks.length && g != null && tanks[t][level] === g) continue;
      if (g != null && t - start >= 3) for (let k = start; k < t; k++) out.push([k, level]);
      start = t;
    }
  }
  return out;
}
/** Ships out every line, wave after wave as what's above drops: the tanks after and the waves ([[t, level, grade]]). */
export function ship(tanks) {
  let now = tanks.map(x => x.slice());
  const waves = [];
  for (let found = lines(now); found.length; found = lines(now)) {
    waves.push(found.map(([t, level]) => [t, level, now[t][level]]));
    // highest first, so the levels of the rest in the same tank stand
    for (const [t, level] of [...found].sort((a, b) => b[1] - a[1])) now[t].splice(level, 1);
  }
  return { tanks: now, waves };
}
/** A delivery for a tank: a grade and a tank with room for it that makes no line. */
function delivery(s) {
  const room = [...Array(TANKS).keys()].filter(t => s.tanks[t].length < LEVELS);
  for (let tries = 0; tries < 24 && room.length; tries++) {
    const t = room[pick(s, room.length)], g = pick(s, GRADES);
    if (!lines(pumped(s.tanks, t, g)).length) return { t, g };
  }
  return null;
}

/** A new game from a seed: START parcels about the tanks, no line standing, two parcels offered. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, tanks: Array.from({ length: TANKS }, () => []), hand: [], pumps: 0, untilDelivery: deliveryEvery(0), lives: LIVES, score: 0, over: false };
  for (let k = 0; k < START; k++) { const d = delivery(s); if (d) s.tanks = pumped(s.tanks, d.t, d.g); }
  s.hand = [pick(s, GRADES), pick(s, GRADES)];
  return s;
}
/** Ten times the square of the parcels shipped in one pump, all its waves together. */
export const worth = n => 10 * n * n;

/**
 * Pumps the offered parcel in hand slot `slot` into tank t: the game after it, and what happened, for the page to
 * show: grade, level (where it settled), waves (as ship gives them), gain, spilled (the grade spilled over, or -1),
 * delivered ([{ t, g }]), over. Pure.
 */
export function pump(game, slot, t) {
  const s = structuredClone(game), g = s.hand[slot];
  if (s.over || g == null) throw new Error("no parcel there");
  if (!(t >= 0 && t < TANKS)) throw new Error("no such tank");
  const level = s.tanks[t].filter(x => x <= g).length, r = ship(pumped(s.tanks, t, g));
  s.tanks = r.tanks;
  const n = r.waves.reduce((a, w) => a + w.length, 0), gain = n ? worth(n) : 0;
  s.score += gain;
  // past eight the top parcel spills over
  let spilled = -1;
  if (s.tanks[t].length > LEVELS) { spilled = s.tanks[t].pop(); s.lives--; }
  s.hand[slot] = pick(s, GRADES);
  s.pumps++;
  const delivered = [];
  if (--s.untilDelivery <= 0) {
    for (let k = deliveryCount(s.pumps - 1); k > 0; k--) {
      const d = delivery(s);
      if (d) { s.tanks = pumped(s.tanks, d.t, d.g); delivered.push(d); }
    }
    s.untilDelivery = deliveryEvery(s.pumps);
  }
  s.over = s.lives <= 0;
  return { state: s, grade: g, level, waves: r.waves, gain, spilled, delivered, over: s.over };
}
/** Every pump there is: [{ slot, t }]. For the tests and the tuning players. */
export const moves = () => [0, 1].flatMap(slot => [...Array(TANKS).keys()].map(t => ({ slot, t })));
export const filled = s => s.tanks.reduce((a, x) => a + x.length, 0);
