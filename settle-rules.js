export const LEVELS = 8, GRADES = 4, LIVES = 3;
// slops (SLOP) aren't one of the GRADES offered or delivered: only FAME standing on water makes them
export const WATER = 0, FAME = 1, SLOP = 4;
export const NAMES = ["Water", "FAME", "Diesel", "Naphtha", "Slops"], DENSITY = [999, 883, 835, 700, 950];   // kg/m³ at 15 °C
// FAME on water for SOUR pumps turns to slops; a draw-off is ready DRAW pumps after the last; a tanker stays TANKER pumps
export const SOUR = 5, DRAW = 10, TANKER = 10;
/** Whether a part of the game is on: all are, unless a level's rules switch one off (deliver, sour, tanker, draw). */
export const rule = (s, k) => s.rules?.[k] !== false;

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
/** Ten times the square of the parcels shipped in one pump, all its waves together. */
export const worth = n => 10 * n * n;
const shipped = waves => waves.reduce((a, w) => a + w.length, 0);

/**
 * The rules of a farm, for a layout: `tanks` (how many), `start` (parcels dealt about them), `pace` (the deliveries: until so
 * many pumps, every so many pumps, so many parcels) and `lines(tanks, want)` (the parcels in a line that ships with the
 * tanker for grade `want` at the jetty; with none given, those standing ready for their grade's tanker as well).
 * settle-engine.js is the row of six, settle-farm-engine.js the 3x3.
 */
export function rules({ tanks: TANKS, start: START, pace: PACE, lines }) {
  const paceAt = pumps => PACE.find(([until]) => pumps < until);
  const deliveryEvery = pumps => paceAt(pumps)[1];
  const deliveryCount = pumps => paceAt(pumps)[2];
  /**
   * Ships out every line with the tanker for grade `want` at the jetty, wave after wave as what's above drops: the tanks
   * after and the waves ([[t, level, grade]]).
   */
  function ship(tanks, want) {
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
  function newGame(seed) {
    const s = { v: 1, seed: seed >>> 0, n: 0, tanks: Array.from({ length: TANKS }, () => []), hand: [], pumps: 0, untilDelivery: deliveryEvery(0), sour: new Array(TANKS).fill(0), untilDraw: DRAW, lives: LIVES, score: 0, over: false };
    for (let k = 0; k < START; k++) { const d = delivery(s); if (d) s.tanks = pumped(s.tanks, d.t, d.g); }
    s.hand = [pick(s, GRADES), pick(s, GRADES)];
    return charter(s);
  }
  /** A game saved before slops and draw-offs given their clocks, and one saved before the tankers given its first. */
  function upgrade(game) {
    let s = game;
    if (s.goal != null) return s;   // a level is always whole
    if (!Array.isArray(s.sour) || s.untilDraw == null) s = { ...structuredClone(s), sour: new Array(TANKS).fill(0), untilDraw: DRAW };
    if (s.want == null) s = charter(s === game ? structuredClone(s) : s);
    return s;
  }

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
    if (rule(s, "tanker") && --s.untilTanker <= 0) {
      s.want = s.next;
      s.next = another(s, s.want);
      s.untilTanker = TANKER;
      const a = ship(s.tanks, s.want), m = shipped(a.waves);
      s.tanks = a.tanks;
      tanker = { want: s.want, waves: a.waves, gain: m ? worth(m) : 0 };
    }
    s.score += gain + (tanker?.gain ?? 0);
    s.pumps++;
    // a level is won the moment enough has shipped: nothing comes after it
    if (s.goal != null) {
      s.shipped += n + (tanker ? shipped(tanker.waves) : 0);
      if (s.shipped >= s.goal) s.won = true;
    }
    const delivered = [];
    if (!s.won && rule(s, "deliver") && --s.untilDelivery <= 0) {
      for (let k = deliveryCount(s.pumps - 1); k > 0; k--) {
        const d = delivery(s);
        if (d) { s.tanks = pumped(s.tanks, d.t, d.g); delivered.push(d); }
      }
      s.untilDelivery = deliveryEvery(s.pumps);
    }
    const soured = s.won || !rule(s, "sour") ? [] : sour(s);
    s.untilDraw = drew ? DRAW : Math.max(0, s.untilDraw - 1);
    s.over = s.won || s.lives <= 0 || (s.goal != null && s.pumps >= s.limit);
    return { state: s, waves: r.waves, gain, spilled, tanker, delivered, soured, over: s.over };
  }
  /**
   * Pumps the offered parcel in hand slot `slot` into tank t: the game after it, and what happened, for the page to
   * show: grade, level (where it settled), waves (as ship gives them), gain (what they scored), spilled (the grade
   * spilled over, or -1), tanker (the next tanker come in: { want, waves, gain }, or null), delivered ([{ t, g }]),
   * soured ([t, level]: FAME turned to slops), over. Pure.
   */
  function pump(game, slot, t) {
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
  function drawOff(game, t) {
    const s = structuredClone(game);
    if (s.over || !rule(s, "draw") || s.untilDraw > 0) throw new Error("no draw-off ready");
    if (!(t >= 0 && t < TANKS)) throw new Error("no such tank");
    const k = foot(s.tanks[t]);
    if (!k) throw new Error("nothing at its foot");
    const drained = s.tanks[t].splice(0, k);
    return { drained, ...settle(s, -1, true) };
  }
  /** Every pump there is: [{ slot, t }]. For the tests and the tuning players. */
  const moves = () => [0, 1].flatMap(slot => [...Array(TANKS).keys()].map(t => ({ slot, t })));
  /** The tanks a draw-off could be spent on now (none while it isn't ready). */
  const draws = s => (s.over || !rule(s, "draw") || s.untilDraw > 0 ? [] : [...Array(TANKS).keys()].filter(t => foot(s.tanks[t]) > 0));
  const filled = s => s.tanks.reduce((a, x) => a + x.length, 0);

  /**
   * A level's game: the level's tanks dealt from its seed (no line standing), its parts switched on or off (`rules`), a
   * goal to ship and the pumps it has. level: { id, seed, parcels (dealt about the tanks), rules, goal, limit, drawn
   * (the draw-off ready from the start), sour (pumps FAME standing on water at the start has already soured for) }.
   */
  function newLevel(level) {
    const s = { v: 1, seed: level.seed >>> 0, n: 0, tanks: Array.from({ length: TANKS }, () => []), hand: [], pumps: 0, untilDelivery: deliveryEvery(0), sour: new Array(TANKS).fill(0), untilDraw: level.drawn ? 0 : DRAW, lives: LIVES, score: 0, over: false,
      lv: level.id, rules: { ...level.rules }, goal: level.goal, limit: level.limit, shipped: 0, won: false };
    for (let k = 0; k < level.parcels; k++) { const d = delivery(s); if (d) s.tanks = pumped(s.tanks, d.t, d.g); }
    s.hand = [pick(s, GRADES), pick(s, GRADES)];
    // FAME already standing on water when the level opens has been souring for `sour` pumps
    if (level.sour) s.tanks.forEach((tank, t) => { const w = tank.lastIndexOf(WATER); if (w >= 0 && tank[w + 1] === FAME) s.sour[t] = level.sour; });
    return rule(s, "tanker") ? charter(s) : s;
  }

  return { TANKS, START, PACE, lines, deliveryEvery, deliveryCount, ship, newGame, upgrade, pump, drawOff, moves, draws, filled, newLevel };
}
