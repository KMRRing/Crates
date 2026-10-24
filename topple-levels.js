// Topple's levels, pure (no page): fourteen tables, each bringing a new tile or floor piece and a new design, and the
// rules compiled from them for the engine (topple-engine.js). Level 1 is Topple with five colours on a plain table.
//
// Colours (levels): 0 yellow, 1 red, 2 blue, 3 black, 4 white, the mixes 5 orange (yellow + red), 6 green (yellow + blue),
// 7 purple (red + blue), 8 grey (black + white), and 9 the rainbow, which every colour knocks and which knocks every
// colour. A mix is knocked by either parent and knocks either parent (and its own colour); a mix does not knock another
// mix. Classic (no level) keeps its own three colours, 0 to 2, and its own enamels.
//
// What a table can have:
//   stone      nothing is laid there and a fall stops at it
//   water      nothing is laid there and a fall can't cross it (no hexagon drawn, a void, is the same to the rules)
//   cup        nothing is laid there; a ball that stops in it scores CUP and is put back on the table
//   height     a hexagon at a height: a fall goes level or down, never up (a cliff is a big step)
//   gilded     a hexagon whose domino, if it falls, doubles the knock's points (the bell's flat 500 is added after)
//   spring     a domino standing on it, falling, also reaches the hexagon past the next, over water, a gap or a domino of
//              another colour, not past a stone
//   marsh      anything may be laid there, but a domino there falls without knocking another
//   hedge      a wall on the edge between two hexagons: a fall cannot cross it
//   link       two hexagons (a portal pair, or a stair between two floors): a domino that falls on one also knocks the one on
//              the other, whichever way it faces
//   drop       an edge from which a fall lands on the next floor down, in the way it was going
//   layers     a table of several floors, each its own sixty-one hexagons (hexagon i of layer l is l * 61 + i); a piece is
//              laid on one floor; a fall stays on it but for links and drops
// Tiles that take more than a hit: a heavy domino falls only once two dominoes have fallen into it, whatever their
// colours; a gate domino names two colours and falls only once a domino of each has fallen into it in the one knock.
// Either scores double when it falls (like a gilded hexagon: the same doubling, not twice over).
// A level is beaten at its goal (stars at higher scores, for those who go on); beating one only opens the next.
export const FLOOR = 0, ROCK = 1, WATER = 2, VOID = 3, CUP = 4;
export const RAINBOW = 9, PEARL = RAINBOW;
export const COLOUR_NAMES = ["yellow", "red", "blue", "black", "white", "orange", "green", "purple", "grey", "rainbow"];
/** The parents of each mix. */
export const MIXES = { 5: [0, 1], 6: [0, 2], 7: [1, 2], 8: [3, 4] };
/** What a ball that stops in a cup scores. */
export const CUP_SCORE = 1500;
/** What the drawing of a table and its pieces is told of: for the page alone, the rules never look at it. */
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
const minus = (list, drop) => list.filter(c => !drop.some(d => d[0] === c[0] && d[1] === c[1]));
const on = list => list.filter(c => NUMBER.has(`${c[0]},${c[1]}`));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
/** How far round the table a hexagon is, clockwise from east (the three o'clock) as it is drawn, 0 up to a whole turn. */
const angleOf = ([q, r]) => { const a = Math.atan2(1.5 * r, Math.sqrt(3) * (q + r / 2)); return a < 0 ? a + 2 * Math.PI : a; };

export const STARS = [1.6, 2.6];
const GENTLE = { from: 40, to: 60, end: 0.8 };            // a knock nearly every hand: a table cut up has little room to spare
const level = spec => ({ colours: [0, 1, 2, 3, 4], wild: 0, bridges: 0, twins: 0, balls: 0, heavy: 0, gate: null, scene: "birch", rise: 0.16, bell: true, pace: null, maxSize: 5, map: {}, links: [], drops: [], joins: [], start: [], ...spec });

// the tables' own pieces of geometry
const RIVER = [[-4, 2], [-3, 1], [-1, 0], [0, 0], [1, -1], [3, -2], [4, -2]];          // corner to corner, the two fords left out
/** The edges round a disc of hexagons that a hedge could stand on: [a, b] pairs of neighbours, a inside and b out. */
const edgesOf = (inside, outside, skip = () => false) => inside.flatMap(a => DIRS.map(([dq, dr]) => [a, [a[0] + dq, a[1] + dr]]).filter(([c, b]) => outside.some(o => same(o, b)) && !skip(c, b)));
const GARDEN = [...edgesOf(ring(1), ring(2), c => c[1] === 0), [[-3, 1], [-3, 2]], [[3, -3], [3, -2]], [[-1, -3], [-2, -2]]];
// the spiral: a road round a mountain, a step up every fifth of a turn, a sheer drop at three o'clock, a cave under the quadrant from twelve to three
const road = c => away(c) >= 2;
const stepOf = c => (road(c) ? Math.floor((angleOf(c) / (2 * Math.PI)) * 5) : 0);
const CAVE = where(c => road(c) && angleOf(c) >= 1.5 * Math.PI);

export const LEVELS = [
  level({
    name: "The parlour", goal: 14000,
    about: "Five colours on a plain table: yellow, red, blue, black and white. The score is the chains you build.",
  }),
  level({
    name: "Cairns", goal: 13000, colours: [0, 1, 2, 3, 4, 5],
    map: { rock: [...three([2, 0]), ...three([2, -1])] },
    about: "Orange is knocked by yellow and by red, and knocks both. Stones stand where nothing is laid, and a fall stops at one.",
  }),
  level({
    name: "The river", goal: 18000, colours: [0, 1, 2, 3, 5, 6], scene: "jetty",
    map: { water: RIVER },
    about: "Green is knocked by yellow and by blue, and knocks both. A river crosses the table; its two fords are the only crossings.",
  }),
  level({
    name: "Gilded cross", goal: 37000, colours: [0, 1, 2, 3, 5, 6], heavy: 0.1, scene: "garden",
    map: { gilded: [[2, 0], [-2, 0], [0, 2], [0, -2]] },
    start: three([1, -2]).map(c => ({ at: [0, ...c], colour: 2, heavy: true })),
    about: "A heavy domino falls only once two dominoes have fallen into it. A gilded hexagon doubles a knock, and a heavy or a gate scores double when it falls.",
  }),
  level({
    name: "Ziggurat", goal: 30000, colours: [0, 1, 2, 5, 6, 7], heavy: 0.08, scene: "marble",
    map: { height: { 3: [[0, 0]], 2: ring(1), 1: ring(2) }, gilded: [[0, 0]] },
    about: "Purple is knocked by red and by blue, and knocks both. A fall goes level or down, never up: the summit is gilded, and only a chain started on it can come down.",
  }),
  level({
    name: "Archipelago", goal: 17000, colours: [0, 1, 2, 3, 6, 7], heavy: 0.05, gate: { colours: [0, 6], share: 0.08 }, pace: GENTLE, maxSize: 3, scene: "garden",
    map: { water: ring(2), spring: [...three([1, 0]), [0, 3], [-3, 0], [3, -3]] },
    start: [[3, -1], [-3, 1]].map(c => ({ at: [0, ...c], colour: 0, gate: [0, 6] })),
    about: "A spring throws a fall two hexagons on, over water. A gate domino names two colours, yellow and green here, and falls only once both have reached it in the one knock.",
  }),
  level({
    name: "Waterfall", goal: 23500, colours: [0, 1, 2, 3, 4, 8], heavy: 0.05, pace: null, maxSize: 4, scene: "cliff",
    layers: [
      { water: [[3, -1], [3, 0], [4, -1], [4, -2], [4, 0]], gilded: [[-2, -2]] },
      { only: disc(2), water: [[-1, 0], [0, 0], [1, 0], [2, 0]], gilded: [[-1, -1], [1, -2]] },
    ],
    drops: [{ from: 1, to: 0 }],
    links: [[-2, 1], [-1, -1]].map(([q, r]) => [[1, q, r], [0, q, r]]),
    about: "Two floors: a plateau of rock with a stream across it, over a lower plain. A fall that runs off any edge of the plateau lands on the plain and goes on, and two stairs in the west join the floors. A knock that crosses between them doubles.",
  }),
  level({
    name: "Two courts", goal: 52000, colours: [0, 1, 2, 5, 6, 7], bridges: 0.18, heavy: 0.05, pace: null, maxSize: 4, scene: "marble",
    map: { water: where(c => c[0] === 0 && c[1] !== 0), rock: [[0, 0]] },
    links: [[[0, -1, 1], [0, 1, -1]], [[0, -3, 2], [0, 3, -2]]],
    about: "A wall of water splits the table in two. A bridge may lie on water. A domino that falls on one of a pair of portals also knocks the other.",
  }),
  level({
    name: "Fenland", goal: 18000, colours: [0, 1, 2, 5, 6, 7], bridges: 0.18, twins: 0.18, heavy: 0.04, pace: GENTLE, maxSize: 4, scene: "garden",
    map: { water: where(c => c[1] === 0), marsh: [[1, -2], [2, -3], [-1, 2], [-2, 3]] },
    about: "A river across the table with no ford, and marsh where a domino falls without knocking another. A twin is a pair of two colours: it stands in one chain with one domino and in another with the other.",
  }),
  level({
    name: "Hedgerows", goal: 36000, colours: [0, 1, 2, 3, 4, 7], wild: 0.12, heavy: 0.05, maxSize: 4, pace: null, scene: "garden",
    map: { hedge: GARDEN },
    about: "Hedges stand on the edges between hexagons, and a fall cannot cross one. The rainbow is knocked by every colour and knocks every colour, so it joins what a hedge divides.",
  }),
  level({
    name: "The cup", goal: 30000, colours: [0, 1, 2, 3, 6, 7], balls: 3, heavy: 0.04, maxSize: 4, scene: "cliff",
    map: { height: { 2: where(c => c[0] >= 2), 1: where(c => c[0] >= 0 && c[0] <= 1) }, cup: [[-4, 1], [-4, 3], [-2, -2]] },
    about: "Three balls on the table. A fall that reaches one sets it rolling the way it was hit, and the table falls away to the west: a ball that stops in a cup scores 1,500, and another is put on the table.",
  }),
  level({
    name: "Two floors", goal: 59500, colours: [0, 1, 2, 3, 4, 6], wild: 0.1, heavy: 0.05, pace: null, maxSize: 4, scene: "marble",
    layers: [{ rock: [[-3, 1], [3, -1], [1, 2], [-1, -2]] }, { only: disc(3) }],
    drops: [{ from: 1, to: 0 }],
    links: [[2, -1], [-2, 1], [0, 3], [3, -3], [-3, 0]].map(([q, r]) => [[0, q, r], [1, q, r]]),
    about: "A gallery above the ground floor, with a stair at five places, and a fall that runs off the gallery's edge drops to the floor below. Every domino on both floors falls in the same knock, and a knock that crosses between them doubles.",
  }),
  level({
    name: "The spiral", goal: 16500, colours: [0, 1, 2, 3, 6, 7], heavy: 0.04, gate: { colours: [0, 6], share: 0.12 }, pace: GENTLE, maxSize: 4, scene: "cliff", rise: 0.2,
    layers: [
      { rock: disc(1), height: { 1: where(c => road(c) && stepOf(c) === 1), 2: where(c => road(c) && stepOf(c) === 2), 3: where(c => road(c) && stepOf(c) === 3), 4: where(c => road(c) && stepOf(c) === 4) } },
      { only: CAVE },
    ],
    // the cave's mouth: where its floor meets the road at base level, at the foot of the cliff
    joins: CAVE.flatMap(c => DIRS.map((_, d) => ({ from: [1, ...c], dir: d, to: [0, c[0] + DIRS[d][0], c[1] + DIRS[d][1]], both: true, when: n => road(n) && stepOf(n) === 0 }))),
    start: [[3, 1], [2, 2]].map(c => ({ at: [0, ...c], colour: 0, gate: [0, 6] })),
    about: "A road climbs the mountain clockwise from three o'clock, a step every fifth of a turn, and ends in a sheer drop to where it began. Under its last quarter is a cave, open at the foot of the cliff.",
  }),
  level({
    name: "Grand table", goal: 24500, colours: [0, 1, 2, 3, 4, 5, 6, 7, 8], wild: 0.06, bridges: 0.1, twins: 0.1, heavy: 0.05, gate: { colours: [0, 6], share: 0.05 }, balls: 2, maxSize: 3, pace: GENTLE, scene: "jetty",
    layers: [
      { water: minus(ring(2), [[2, 0], [-2, 0]]), height: { 2: disc(1) }, gilded: [[0, 0]], rock: three([4, -2]), spring: [[3, -1], [-3, 1], [0, 3], [0, -3]], cup: [[-4, 0], [-3, 3], [3, -3]] },
      { only: disc(2) },
    ],
    links: [[[0, 3, -3], [0, -3, 3]], [[0, 2, 0], [1, 2, 0]], [[0, -2, 0], [1, -2, 0]]],
    about: "Everything at once: nine colours, a moat with two fords, a gilded summit, springs, portals, a cup, balls and a floor above joined by stairs.",
  }),
];

// ---------- compiled for the engine ----------
/** What the engine asks of a level: per hexagon by number (terrain, height, gilded, spring, marsh, edges, links), what its colours are and what is dealt. */
function compile(spec, n) {
  const layers = spec.layers || [spec.map || {}], count = layers.length, total = SIZE * count;
  const terrain = new Uint8Array(total), height = new Uint8Array(total), gilded = new Uint8Array(total), spring = new Uint8Array(total), marsh = new Uint8Array(total);
  const hedge = new Uint8Array(total * 6), nb = new Int16Array(total * 6), links = Array.from({ length: total }, () => []);
  const num = ([l, q, r]) => (NUMBER.has(`${q},${r}`) ? l * SIZE + NUMBER.get(`${q},${r}`) : -1);
  // each hexagon's neighbours on its own floor: the table's, with no table at the edge
  const step = (g, d) => { const o = g - (g % SIZE), [q, r] = ALL[g % SIZE], k = NUMBER.get(`${q + DIRS[d][0]},${r + DIRS[d][1]}`); return k === undefined ? -1 : o + k; };
  for (let g = 0; g < total; g++) for (let d = 0; d < 6; d++) nb[g * 6 + d] = step(g, d);
  layers.forEach((m, l) => {
    const mark = (list, f) => { for (const c of on(list || [])) f(l * SIZE + NUMBER.get(`${c[0]},${c[1]}`)); };
    if (m.only) { const keep = new Set(on(m.only).map(c => `${c[0]},${c[1]}`)); ALL.forEach((c, i) => { if (!keep.has(`${c[0]},${c[1]}`)) terrain[l * SIZE + i] = VOID; }); }
    mark(m.void, i => { terrain[i] = VOID; });
    mark(m.water, i => { terrain[i] = WATER; });
    mark(m.rock, i => { terrain[i] = ROCK; });
    mark(m.cup, i => { terrain[i] = CUP; });
    for (const [h, list] of Object.entries(m.height || {})) mark(list, i => { if (!terrain[i]) height[i] = Number(h); });
    mark(m.gilded, i => { if (!terrain[i]) gilded[i] = 1; });
    mark(m.spring, i => { if (!terrain[i]) spring[i] = 1; });
    mark(m.marsh, i => { if (!terrain[i]) marsh[i] = 1; });
    for (const [a, b] of m.hedge || []) {
      const i = num([l, ...a]), j = num([l, ...b]);
      if (i < 0 || j < 0) continue;
      const d = nb.slice(i * 6, i * 6 + 6).indexOf(j);
      if (d >= 0) { hedge[i * 6 + d] = 1; hedge[j * 6 + (d + 3) % 6] = 1; }
    }
  });
  // drops: from the edge of one floor, a fall lands on the hexagon beyond it on another floor
  for (const dr of spec.drops || []) {
    for (let i = 0; i < SIZE; i++) {
      const g = dr.from * SIZE + i;
      if (terrain[g] === VOID) continue;
      for (let d = 0; d < 6; d++) {
        const beside = nb[g * 6 + d];
        if (beside >= 0 && terrain[beside] !== VOID) continue;
        if (dr.where && !dr.where(ALL[i], d)) continue;
        const [q, r] = ALL[i], t = num([dr.to, q + DIRS[d][0], r + DIRS[d][1]]);
        if (t >= 0) nb[g * 6 + d] = t;
      }
    }
  }
  for (const j of spec.joins || []) {
    const a = num(j.from), b = num(j.to);
    if (a < 0 || b < 0 || (j.when && !j.when([j.to[1], j.to[2]]))) continue;
    nb[a * 6 + j.dir] = b;
    if (j.both) nb[b * 6 + (j.dir + 3) % 6] = a;
  }
  for (const [x, y] of spec.links || []) { const a = num(x), b = num(y); if (a >= 0 && b >= 0) { links[a].push(b); links[b].push(a); } }
  const gate = spec.gate ? { colours: spec.gate.colours, share: spec.gate.share } : null;
  const start = (spec.start || []).map(s => ({ i: num(s.at), colour: s.colour, mod: s.heavy ? "heavy" : s.gate ? "gate" : null, gate: s.gate || null, axis: s.axis ?? 0 })).filter(s => s.i >= 0 && !terrain[s.i]);
  const mods = spec.heavy > 0 || !!gate || start.some(s => s.mod);
  return {
    id: n, name: spec.name, about: spec.about, goal: spec.goal, stars: spec.goal ? [spec.goal, ...STARS.map(k => Math.round((spec.goal * k) / 50) * 50)] : [],
    layers: count, n: total, terrain, height, gilded, spring, marsh, hedge, nb, links: links.some(l => l.length) ? links : null, hedged: hedge.some(Boolean),
    // no colour is tall any more: the drawing reads this for the height of a slab, and a heavy one is drawn by its own mod
    tall: new Array(10).fill(false),
    colours: spec.colours, wild: spec.wild, bridges: spec.bridges, twins: spec.twins, balls: spec.balls, heavy: spec.heavy, gate, start, mods,
    palette: n >= 0 || n === -2 ? "levels" : "classic",
    scene: spec.scene, rise: spec.rise, bell: spec.bell, pace: spec.pace, maxSize: spec.maxSize, layerGap: spec.layerGap ?? 1.9,
    plain: count === 1 && !terrain.some(Boolean) && !height.some(Boolean) && !gilded.some(Boolean) && !spring.some(Boolean) && !marsh.some(Boolean) && !spec.wild && !spec.bridges && !spec.twins && !spec.balls && !mods && !links.some(l => l.length) && !hedge.some(Boolean),
  };
}
/** The rules of a level made up (for the tests): a spec as LEVELS has, any part of it. */
export const custom = spec => compile(level({ name: "Made up", goal: 1000, about: "", ...spec }), -2);
/** The rules of play with no level: every hexagon plain, three colours, the bell hanging (Classic). */
export const FREE = Object.freeze({ ...compile({ name: "Classic", about: "", goal: 0, colours: [0, 1, 2], wild: 0, bridges: 0, twins: 0, balls: 0, heavy: 0, gate: null, scene: "birch", rise: 0.16, bell: true, pace: null, maxSize: 5, map: {}, links: [], drops: [], joins: [], start: [] }, -1) });
const COMPILED = LEVELS.map(compile);
/** Seats a made-up table as one more level, past the fourteen, so a game can be played on it (for the tests; returns its number). */
export const lodge = rules => COMPILED.push(rules) - 1;
/** The rules of level n (0 on). */
export const levelRules = n => COMPILED[n] || FREE;
/** How many stars a score is worth in a level (0 to 3). */
export const starsAt = (rules, score) => rules.stars.filter(t => score >= t).length;
/** The number of the hexagon at (q, r) in the table's order, or -1. */
export const numberOf = (q, r) => NUMBER.get(`${q},${r}`) ?? -1;
