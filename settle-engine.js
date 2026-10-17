// Settle's rules, pure (no page): a tank farm of six tanks, eight parcels high, and four grades of liquid from the
// heaviest to the lightest: water, FAME (biodiesel), diesel, naphtha. A parcel pumped into a tank sinks below every
// lighter one and settles on what's heavier, lifting the lighter ones a level, so a tank always stands in order. Three
// or more parcels of one grade at one level, in neighbouring tanks, ship out; what floated above them drops a level,
// which can line up more. Two parcels are offered at a time; you choose which and where. Every few pumps a delivery
// comes in of its own, more often as the game goes on. A tank pumped past eight spills its top parcel, a life lost,
// and the third spill ends the game. FAME left standing on water sours: after five pumps the parcel touching the water
// turns to slops, an emulsion heavier than FAME and lighter than water, which never lines up. Every few pumps a
// draw-off is ready: spent on a tank, it drains the water and slops from its foot, and what's above drops, which can
// line up and ship. And a tanker at the jetty takes one grade: three of it in a line ship, four of any other; every
// ten pumps the next comes, for another grade (shown while it waits), and the lines of three of its grade standing
// ready ship as it comes in. The page (settle.js) draws it; tests/settle.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), tanks (six lists of grades 0–4, bottom up, each in order
// of density), hand (the two parcels offered), pumps (moves made, draw-offs too), untilDelivery, sour (for each tank,
// pumps its FAME has stood on water), untilDraw (pumps until a draw-off is ready; 0, ready), want (the grade the
// tanker at the jetty takes), next (the next tanker's), untilTanker (pumps until it comes), lives, score, over }.

export const TANKS = 6, LEVELS = 8, GRADES = 4, LIVES = 3, START = 14;
// slops (SLOP) aren't one of the GRADES offered or delivered: only FAME standing on water makes them
export const WATER = 0, FAME = 1, SLOP = 4;
export const NAMES = ["Water", "FAME", "Diesel", "Naphtha", "Slops"], DENSITY = [999, 883, 835, 700, 950];   // kg/m³ at 15 °C
// FAME on water for SOUR pumps turns to slops; a draw-off is ready DRAW pumps after the last; a tanker stays TANKER pumps
export const SOUR = 5, DRAW = 10, TANKER = 10;
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

/** The level a parcel of grade g settles at in a tank: on everything as heavy or heavier. */
export const settles = (tank, g) => tank.filter(x => DENSITY[x] >= DENSITY[g]).length;
/** The tanks with a parcel of grade g pumped into tank t: it settles on what's as heavy or heavier. */
export function pumped(tanks, t, g) {
  const out = tanks.map(x => x.slice());
  out[t].splice(settles(out[t], g), 0, g);
  return out;
}
/** How many parcels a draw-off would take from a tank: the water and slops at its foot (the two heaviest). */
export const foot = tank => tank.filter(x => x === WATER || x === SLOP).length;
/** How many of grade g in a line ship with the tanker for grade `want` at the jetty: three of its grade, four of any other. */
export const need = (g, want) => (want == null || g === want ? 3 : 4);
/**
 * The parcels in a line that ships with the tanker for grade `want` ([t, level] pairs): three or more of its grade at one
 * level in neighbouring tanks, four or more of any other; slops never. With no tanker given, three of any grade: the
 * lines standing ready for their grade's tanker as well.
 */
export function lines(tanks, want) {
  const out = [];
  for (let level = 0; level < LEVELS + 1; level++) {
    let start = 0;
    for (let t = 1; t <= tanks.length; t++) {
      const g = tanks[start]?.[level];
      if (t < tanks.length && g != null && tanks[t][level] === g) continue;
      if (g != null && g !== SLOP && t - start >= need(g, want)) for (let k = start; k < t; k++) out.push([k, level]);
      start = t;
    }
  }
  return out;
}
/**
 * Ships out every line with the tanker for grade `want` at the jetty, wave after wave as what's above drops: the tanks
 * after and the waves ([[t, level, grade]]).
 */
export function ship(tanks, want) {
  let now = tanks.map(x => x.slice());
  const waves = [];
  for (let found = lines(now, want); found.length; found = lines(now, want)) {
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
    if (!lines(pumped(s.tanks, t, g), s.want).length) return { t, g };
  }
  return null;
}

/** The grade of the tanker after one for grade g: any other, at random. */
const another = (s, g) => (g + 1 + pick(s, GRADES - 1)) % GRADES;
/** The first tankers: the one at the jetty, the next, and the pumps until it comes. */
function charter(s) {
  s.want = pick(s, GRADES);
  s.next = another(s, s.want);
  s.untilTanker = TANKER;
  return s;
}
/** A new game from a seed: START parcels about the tanks, no line of three standing, two parcels offered, a tanker in. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, tanks: Array.from({ length: TANKS }, () => []), hand: [], pumps: 0, untilDelivery: deliveryEvery(0), sour: new Array(TANKS).fill(0), untilDraw: DRAW, lives: LIVES, score: 0, over: false };
  for (let k = 0; k < START; k++) { const d = delivery(s); if (d) s.tanks = pumped(s.tanks, d.t, d.g); }
  s.hand = [pick(s, GRADES), pick(s, GRADES)];
  return charter(s);
}
/** A game saved before slops and draw-offs given their clocks, and one saved before the tankers given its first. */
export function upgrade(game) {
  let s = game;
  if (!Array.isArray(s.sour) || s.untilDraw == null) s = { ...structuredClone(s), sour: new Array(TANKS).fill(0), untilDraw: DRAW };
  if (s.want == null) s = charter(s === game ? structuredClone(s) : s);
  return s;
}
/** Ten times the square of the parcels shipped in one pump, all its waves together. */
export const worth = n => 10 * n * n;

/**
 * Where FAME stands on water (the parcel over a tank's top water), a pump nearer souring; at SOUR the FAME touching
 * the water turns to slops, which then stand between them. The parcels that turned, [t, level].
 */
function sour(s) {
  const turned = [];
  s.tanks.forEach((tank, t) => {
    const w = tank.lastIndexOf(WATER);
    if (w < 0 || tank[w + 1] !== FAME) { s.sour[t] = 0; return; }
    if (++s.sour[t] < SOUR) return;
    tank[w + 1] = SLOP;
    s.sour[t] = 0;
    turned.push([t, w + 1]);
  });
  return turned;
}
const shipped = waves => waves.reduce((a, w) => a + w.length, 0);
/**
 * The rest of a move, a pump or a draw-off: what lines up ships, the tank pumped into (t, or -1) spills past eight,
 * the next tanker may come in (the lines of three of its grade shipping), a delivery may come, FAME on water sours,
 * and a draw-off comes nearer (or, just spent, starts again).
 */
function settle(s, t, drew) {
  const r = ship(s.tanks, s.want);
  s.tanks = r.tanks;
  const n = shipped(r.waves), gain = n ? worth(n) : 0;
  // past eight the top parcel spills over
  let spilled = -1;
  if (t >= 0 && s.tanks[t].length > LEVELS) { spilled = s.tanks[t].pop(); s.lives--; }
  let tanker = null;
  if (--s.untilTanker <= 0) {
    s.want = s.next;
    s.next = another(s, s.want);
    s.untilTanker = TANKER;
    const a = ship(s.tanks, s.want), m = shipped(a.waves);
    s.tanks = a.tanks;
    tanker = { want: s.want, waves: a.waves, gain: m ? worth(m) : 0 };
  }
  s.score += gain + (tanker?.gain ?? 0);
  s.pumps++;
  const delivered = [];
  if (--s.untilDelivery <= 0) {
    for (let k = deliveryCount(s.pumps - 1); k > 0; k--) {
      const d = delivery(s);
      if (d) { s.tanks = pumped(s.tanks, d.t, d.g); delivered.push(d); }
    }
    s.untilDelivery = deliveryEvery(s.pumps);
  }
  const soured = sour(s);
  s.untilDraw = drew ? DRAW : Math.max(0, s.untilDraw - 1);
  s.over = s.lives <= 0;
  return { state: s, waves: r.waves, gain, spilled, tanker, delivered, soured, over: s.over };
}
/**
 * Pumps the offered parcel in hand slot `slot` into tank t: the game after it, and what happened, for the page to
 * show: grade, level (where it settled), waves (as ship gives them), gain (what they scored), spilled (the grade
 * spilled over, or -1), tanker (the next tanker come in: { want, waves, gain }, or null), delivered ([{ t, g }]),
 * soured ([t, level]: FAME turned to slops), over. Pure.
 */
export function pump(game, slot, t) {
  const s = structuredClone(game), g = s.hand[slot];
  if (s.over || g == null) throw new Error("no parcel there");
  if (!(t >= 0 && t < TANKS)) throw new Error("no such tank");
  const level = settles(s.tanks[t], g);
  s.tanks = pumped(s.tanks, t, g);
  s.hand[slot] = pick(s, GRADES);
  return { grade: g, level, ...settle(s, t, false) };
}
/**
 * Spends the draw-off on tank t: the water and slops at its foot drained, what's above dropping into their place.
 * The game after it, and what happened: drained (the grades taken, bottom up), then as a pump's. Pure; throws if no
 * draw-off is ready or the tank has nothing at its foot.
 */
export function drawOff(game, t) {
  const s = structuredClone(game);
  if (s.over || s.untilDraw > 0) throw new Error("no draw-off ready");
  if (!(t >= 0 && t < TANKS)) throw new Error("no such tank");
  const k = foot(s.tanks[t]);
  if (!k) throw new Error("nothing at its foot");
  const drained = s.tanks[t].splice(0, k);
  return { drained, ...settle(s, -1, true) };
}
/** Every pump there is: [{ slot, t }]. For the tests and the tuning players. */
export const moves = () => [0, 1].flatMap(slot => [...Array(TANKS).keys()].map(t => ({ slot, t })));
/** The tanks a draw-off could be spent on now (none while it isn't ready). */
export const draws = s => (s.over || s.untilDraw > 0 ? [] : [...Array(TANKS).keys()].filter(t => foot(s.tanks[t]) > 0));
export const filled = s => s.tanks.reduce((a, x) => a + x.length, 0);
