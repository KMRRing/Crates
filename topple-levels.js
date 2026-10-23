// Topple's levels, pure (no page): eighteen tables, each adding one thing to the last, and the rules compiled from them for
// the engine (topple-engine.js). Level 1 is Topple as it has always been (the same table, pieces, pace and scoring) with
// a goal to reach; the others keep what the ones before taught and add to it:
//   stones      a hexagon with a stone on it: nothing is laid there and a fall stops at it
//   water       a hexagon of water (or no table at all, which is the same to the rules): nothing is laid there and an
//               ordinary fall can't cross it
//   tall        every domino of a colour is tall: falling, it reaches the hexagon beyond the next as well, across
//               water or an empty hexagon (not past a stone), and climbs a step
//   gilded      a hexagon whose domino, if it falls, doubles the knock's points (the bell's flat 500 is added after, not doubled)
//   terraces    a hexagon at a height of 0, 1 or 2: a fall goes level or down, never up (a tall one climbs a step)
//   pearl       a fourth colour, dealt now and then in pieces of one or two: knocked by every colour and knocking every
//               colour, so it joins what else would stand apart
//   bridges     a straight piece of two or three that may lie on water (planks under the dominoes)
//   twins       a pair of two colours
//   balls       that many balls on the table at all times: a fall that reaches one sets it rolling (topple-engine.js, rollOf)
//   scene, rise what the table is made of and stands on (birch, marble, jetty, cliff, garden), and how high a step of height
//               stands in the drawing (a fall doesn't care): how it looks, nothing more
// A level is beaten at its goal (stars at higher scores, for those who go on); beating one only opens the next.
// The goals follow what each table gives, not a count up: level 1's is 20000 (Korbi, 23 October 2026), and each other is
// a share of what the careful player of tests/topple-players.js scores there in the median, the share rising from a half
// to three quarters, rounded; a table cut up by water or stones scores less, so its goal is lower, and the tables were
// chosen so that it falls by steps and not in a drop (a first Stones with seven stones scored a third of Classic).
// Hexagons are numbered row by row as the engine numbers them (tests/topple-levels.mjs checks that they agree).
export const FLOOR = 0, ROCK = 1, WATER = 2, VOID = 3;
export const PEARL = 3;
/** What a table is made of and stands on, for the drawing alone (topple-3d.js, topple-flat.js): the rules never look at it. */
export const SCENES = ["birch", "marble", "jetty", "cliff", "garden"];

const R = 4;
const ALL = [];
for (let r = -R; r <= R; r++) for (let q = Math.max(-R, -R - r); q <= Math.min(R, R - r); q++) ALL.push([q, r]);
const NUMBER = new Map(ALL.map(([q, r], i) => [`${q},${r}`, i]));
export const SIZE = ALL.length;

// ---------- drawing a map in a few words ----------
const away = ([q, r]) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
const where = f => ALL.filter(f);
/** A hexagon turned sixty degrees `steps` times about the middle. */
const spin = ([q, r], steps) => { let c = [q, r]; for (let k = 0; k < ((steps % 6) + 6) % 6; k++) c = [-c[1], c[0] + c[1]]; return c; };
const six = c => [0, 1, 2, 3, 4, 5].map(k => spin(c, k));
const three = c => [0, 2, 4].map(k => spin(c, k));
const disc = n => where(c => away(c) <= n);
const ring = n => where(c => away(c) === n);
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
/** The hexagons from `from`, then a step in each direction given (as the engine's DIRS: east, north-east, north-west, west, south-west, south-east). */
const walk = (from, dirs) => { const out = [from]; let c = from; for (const d of dirs) { c = [c[0] + DIRS[d][0], c[1] + DIRS[d][1]]; out.push(c); } return out; };
const turned = (list, steps) => list.map(c => spin(c, steps));
const minus = (list, drop) => list.filter(c => !drop.some(d => d[0] === c[0] && d[1] === c[1]));
const on = list => list.filter(c => NUMBER.has(`${c[0]},${c[1]}`));

// a river from the west corner to the east, winding through the middle; two fords where it can be laid on
const RIVER = walk([-4, 2], [1, 0, 1, 0, 1, 0, 1, 0]);
const FORDS = [RIVER[2], RIVER[6]];
// three arms from the middle to alternate corners
/** Every hexagon with this q: a line across the table, 60° from its rows. */
const column = q => where(c => c[0] === q);
const ARMS = [[0, 0], ...[0, 2, 4].flatMap(k => [1, 2, 3].map(n => spin([n, 0], k)))];

// ---------- the levels ----------
// `map`: stones, water, void (no table), gilded (hexagons), and height ({ 1: […], 2: […] }); `tall`: the colours (0–2) that
// are tall; `pearl`: the share of pieces dealt in pearl; `bell`: whether the bell hangs; `pace`: the knocks' pace if not the
// game's own; `goal`: the score that beats it, and its stars at STARS times the goal.
export const STARS = [1.6, 2.6];
const GENTLE = { from: 40, to: 60, end: 0.8 };            // a knock nearly every hand: a table cut up by water has little room to spare
const level = spec => ({ tall: [], pearl: 0, bridges: 0, twins: 0, balls: 0, scene: "birch", rise: 0.16, bell: true, pace: null, maxSize: 5, map: {}, ...spec });
export const LEVELS = [
  level({
    name: "Classic", goal: 20000,
    about: "Topple as it is: lay the pieces, then knock a chain down. The goal is the score on the strip.",
  }),
  level({
    name: "Stones", goal: 16500, map: { rock: three([2, 0]) },
    about: "A stone stands where no domino can: nothing is laid on it, and a fall stops at it.",
  }),
  level({
    name: "The river", goal: 10000, map: { water: minus(RIVER.slice(1, 8), FORDS) },
    about: "Water: nothing is laid on it and a fall can't cross it, except at the two fords, which are laid on like any hexagon.",
  }),
  level({
    name: "Long legs", scene: "jetty", goal: 10000, tall: [2], maxSize: 4, pace: GENTLE, map: { water: turned(RIVER.slice(1, 8), 2) },
    about: "The blue dominoes are tall. Falling, one reaches the hexagon past the next as well, over water or a gap (not past a stone), so a chain can cross a river with no ford.",
  }),
  level({
    name: "Gilded", scene: "garden", goal: 12500, tall: [2], map: { water: minus(RIVER, FORDS), gilded: [[1, 1], [-2, 3], [-1, -1], [2, -3]] },
    about: "A fall that brings down a domino on a gilded hexagon scores double; the bell's 500 is added after and is not doubled.",
  }),
  level({
    name: "Terraces", scene: "marble", goal: 8600, tall: [2], map: { rock: three([3, -1]), height: { 2: disc(1), 1: ring(2) } },
    about: "A fall goes level or down, never up a step. A tall domino climbs one.",
  }),
  level({
    name: "Pearl", scene: "garden", goal: 9500, tall: [2], pearl: 0.12, map: { water: minus(RIVER, FORDS), rock: three([3, -1]) },
    about: "Pearls are wild: every colour knocks them and they knock every colour, so a pearl joins chains that would stand apart. They come in pieces of one or two.",
  }),
  level({
    name: "Three islands", scene: "jetty", goal: 7600, tall: [2], pearl: 0.12, maxSize: 4, pace: GENTLE, map: { water: ARMS, void: [spin([4, 0], 1), spin([4, 0], 3), spin([4, 0], 5)], gilded: three([2, 1]) },
    about: "Three islands round a channel. Blue and pearl cross it; the rest go round by its end.",
  }),
  level({
    name: "Quarry", scene: "cliff", goal: 9300, tall: [2], pearl: 0.12, map: { rock: [...six([2, -1]), ...six([4, -2])], height: { 1: where(c => c[0] + c[1] / 2 > 0.4), 2: where(c => c[0] + c[1] / 2 > 2.6) }, gilded: [[3, 0]] },
    about: "Stones everywhere and a stepped hillside on one side.",
  }),
  level({
    name: "The moat", scene: "garden", goal: 5400, tall: [2], pearl: 0.12, maxSize: 4, pace: GENTLE, map: { water: minus(ring(2), [[2, 0], [-2, 0]]), height: { 1: disc(1) }, gilded: [[0, 0]], rock: three([3, -1]) },
    about: "A raised island in the middle, ringed by water but for two fords, with a gilded summit.",
  }),
  level({
    name: "Crossroads", scene: "jetty", goal: 5300, tall: [2], pearl: 0.12, maxSize: 4, pace: GENTLE, map: { water: [...minus(RIVER, FORDS), ...minus(turned(RIVER, 2), [turned(RIVER, 2)[3], turned(RIVER, 2)[7]])], gilded: [[3, -1], [-3, 1], [1, 2], [-1, -2]], rock: [[2, 2], [-2, -2]] },
    about: "Two rivers cross, four banks, three fords between them. Blue and pearl are the way over.",
  }),
  level({
    name: "Grand table", scene: "marble", goal: 4200, tall: [2], pearl: 0.12, maxSize: 4, pace: GENTLE,
    map: { water: minus(ring(2), [[2, 0], [-2, 0]]), rock: three([4, 0]), height: { 2: disc(1), 1: ring(3) }, gilded: [[0, 0], ...three([3, 0])] },
    about: "Everything at once: a summit in a moat, a terraced bank, stones in the corners.",
  }),
  level({
    name: "Bridges", scene: "garden", goal: 30000, tall: [2], pearl: 0.12, maxSize: 4, pace: GENTLE, bridges: 0.2, map: { water: RIVER, gilded: [[-1, -2], [2, 1]] },
    about: "A river with no ford. A bridge is a straight piece of two or three, with planks, that may lie on water: lay one across and the chains of both banks are one.",
  }),
  level({
    name: "Twins", scene: "marble", goal: 36000, tall: [2], pearl: 0.12, twins: 0.22, map: { rock: six([3, -1]), gilded: three([2, 1]) },
    about: "A twin is a pair of two colours. It stands in one chain with one domino and in another with the other, so it joins two groups that would never meet.",
  }),
  level({
    name: "The stair", scene: "cliff", rise: 0.22, goal: 36000, tall: [2], pearl: 0.12, maxSize: 4, pace: GENTLE,
    map: {
      height: { 1: column(0), 2: column(1), 3: column(2), 4: column(3) },
      void: [...column(4), ...where(c => c[1] === -4), ...where(c => c[0] + c[1] === 4 && c[0] < 4)],
      gilded: [[3, -1], [3, -2]], rock: [[-3, 2], [-2, -2]],
    },
    about: "Four steps up a spine of rock, and a drop to the mist on either side and at the top. A fall goes down a stair and never up one (a tall domino climbs a step); nothing stands over the edge.",
  }),
  level({
    name: "Marbles", scene: "marble", goal: 58000, tall: [2], pearl: 0.12, maxSize: 4, balls: 3, map: { rock: three([3, -1]), gilded: three([2, 1]) },
    about: "Three balls on the table. A fall that reaches one sets it rolling the way it was hit, until it meets a stone, a domino or runs out of push; it brings down the domino it meets and counts as one more in the knock.",
  }),
  level({
    name: "Downhill", scene: "garden", goal: 39000, tall: [2], pearl: 0.12, maxSize: 4, balls: 3,
    map: { height: { 1: where(c => c[0] <= 2 && c[0] >= 1), 2: where(c => c[0] <= 0 && c[0] >= -1), 3: where(c => c[0] <= -2) }, rock: [[-3, 3], [3, -3]], gilded: [[3, -2], [-2, 0]] },
    about: "A hillside falling away to the east. A ball runs down a slope for nothing and only pays for a step up: set one going at the top and it crosses the table.",
  }),
  level({
    name: "Grand tour", scene: "jetty", goal: 50000, tall: [2], pearl: 0.1, bridges: 0.15, twins: 0.15, maxSize: 4, pace: GENTLE, balls: 2,
    map: { water: minus(RIVER, FORDS), rock: [[3, -3], [-3, 3]], gilded: [[-1, -2], [2, 1]] },
    about: "The river again, with its two fords, bridges, twins and two balls: a ball that rolls into the water is lost, and another is put on the table.",
  }),
];

// ---------- compiled for the engine ----------
/** What the engine asks of a level, per hexagon by number (terrain, height, gilded) and per colour (tall), and its goal. */
function compile(spec, n) {
  const terrain = new Uint8Array(SIZE), height = new Uint8Array(SIZE), gilded = new Uint8Array(SIZE), m = spec.map;
  const mark = (list, f) => { for (const c of on(list || [])) f(NUMBER.get(`${c[0]},${c[1]}`)); };
  mark(m.void, i => { terrain[i] = VOID; });
  mark(m.water, i => { terrain[i] = WATER; });
  mark(m.rock, i => { terrain[i] = ROCK; });
  for (const [h, list] of Object.entries(m.height || {})) mark(list, i => { if (!terrain[i]) height[i] = Number(h); });
  mark(m.gilded, i => { if (!terrain[i]) gilded[i] = 1; });
  return {
    id: n, name: spec.name, about: spec.about, goal: spec.goal, stars: spec.goal ? [spec.goal, ...STARS.map(k => Math.round((spec.goal * k) / 50) * 50)] : [],
    terrain, height, gilded, tall: [0, 1, 2, 3].map(k => spec.tall.includes(k)), pearl: spec.pearl, bridges: spec.bridges, twins: spec.twins, balls: spec.balls, scene: spec.scene, rise: spec.rise, bell: spec.bell, pace: spec.pace, maxSize: spec.maxSize,
    plain: !terrain.some(Boolean) && !height.some(Boolean) && !gilded.some(Boolean) && !spec.tall.length && !spec.pearl && !spec.bridges && !spec.twins && !spec.balls,
  };
}
/** The rules of a level made up (for the tests): a spec as LEVELS has, any part of it. */
export const custom = spec => compile(level({ name: "Made up", goal: 1000, about: "", ...spec }), -2);
/** The rules of play with no level: every hexagon plain, no colour tall, no pearl, the bell hanging (Classic). */
export const FREE = Object.freeze({ ...compile({ name: "Classic", about: "", goal: 0, tall: [], pearl: 0, bridges: 0, twins: 0, balls: 0, scene: "birch", rise: 0.16, bell: true, pace: null, maxSize: 5, map: {} }, -1) });
const COMPILED = LEVELS.map(compile);
/** The rules of level n (0 on). */
export const levelRules = n => COMPILED[n] || FREE;
/** How many stars a score is worth in a level (0 to 3). */
export const starsAt = (rules, score) => rules.stars.filter(t => score >= t).length;
/** The number of the hexagon at (q, r) in the table's order, or -1. */
export const numberOf = (q, r) => NUMBER.get(`${q},${r}`) ?? -1;
