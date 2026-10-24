// Topple's lessons, pure (no page): one for each thing a level brings in, with the small table it is shown on and the push
// that shows it. What the animation shows is never written by hand: it is the engine's own fall (`cascade`, `knockOn`)
// on that table, so a lesson can't say what the rules don't do (tests/topple-lessons.mjs checks each one against them).
// The page (topple-lesson-ui.js) draws and plays them; this file says which lesson a table, a piece or a hexagon means.
import { SIZE, CELLS, at as cellAt, knockOn, gateMod, HEAVY, BALL, RAINBOW, floorOf } from "./topple-engine.js";
import { custom, numberOf, WATER, ROCK, CUP } from "./topple-levels.js";

const NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** A lesson's table: a level's spec (topple-levels.js) with the nine colours unless it says otherwise. */
const table = spec => ({ colours: NINE, ...spec });
const Y = 0, R = 1, G = 6, O = 5;                          // yellow, red, green, orange
const gate = gateMod(Y, G);
/** The two-hit geometry the heavy and gate lessons share: S falls on A and B, which both fall on the domino at (2, -1); it falls on (3, -1) and (3, -2). */
const PAIR = (colA, colB, mid, midMod, endA, endB, end, endMod) => [
  [0, 0, Y, 1], [1, 0, colA, 2], [1, -1, colB, 0], [2, -1, mid, 1, midMod], [3, -1, endA, 2], ...(endB === null ? [] : [[3, -2, endB, 0]]), [4, -2, end, 1, endMod],
];

/**
 * Each lesson: id, title, text (what it says, in a few plain sentences), scene (a level's spec, topple-levels.js), dominoes
 * ([q, r, colour, axis, mod, floor]; a ball is colour BALL), push ({ q, r, way, floor }: the knock shown), expect(k, at) (what
 * the engine must make of that knock: `k` is knockOn's answer, `at(q, r, floor)` a hexagon's number), and where it has them
 * `ring` (hexagons to ring, [q, r, floor]) and `floors` (the floor buttons are part of the lesson).
 */
export const LESSONS = [
  {
    id: "mix", title: "Mixed colours",
    text: "A mix is knocked by either of its parents and knocks either of them: orange is yellow and red, green is yellow and blue, purple is red and blue, grey is black and white. Here the orange carries the fall from yellow to red. A mix does not knock another mix.",
    scene: table({}),
    dominoes: [[-1, 0, Y, 0], [0, 0, O, 0], [1, 0, R, 0]], push: { q: -1, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 3 && k.fell.some(f => f[0] === at(1, 0) && f[2] === at(0, 0)),
  },
  {
    id: "rainbow", title: "The rainbow",
    text: "The rainbow is knocked by every colour and knocks every colour. Placed between two chains of different colours it joins them, even where a hedge divides the table.",
    scene: table({}),
    dominoes: [[-1, 0, R, 0], [0, 0, RAINBOW, 0], [1, 0, 2, 0]], push: { q: -1, r: 0, way: 0 },
    expect: k => k.fell.length === 3,
  },
  {
    id: "heavy", title: "Heavy dominoes",
    text: "A heavy domino, thick with a brass band, falls only once two dominoes have fallen into it; one hit leaves it standing. Each time one falls, the knock scores double.",
    scene: table({ heavy: 0.1 }),
    dominoes: PAIR(Y, Y, Y, HEAVY, Y, null, Y, HEAVY), push: { q: 0, r: 0, way: 1 },
    ring: [[2, -1, 0], [4, -2, 0]],
    expect: (k, at) => k.fell.some(f => f[0] === at(2, -1)) && !k.fell.some(f => f[0] === at(4, -2)) && k.gilded,
  },
  {
    id: "gate", title: "Gates",
    text: "A gate names two colours, one on each half, and falls only once a domino of each has fallen into it in the same knock. Two of one colour don't open it. A gate falling doubles the knock.",
    scene: table({ gate: { colours: [Y, G], share: 0.1 } }),
    dominoes: PAIR(Y, G, Y, gate, Y, Y, Y, gate), push: { q: 0, r: 0, way: 1 },
    ring: [[2, -1, 0], [4, -2, 0]],
    expect: (k, at) => k.fell.some(f => f[0] === at(2, -1)) && !k.fell.some(f => f[0] === at(4, -2)) && k.gilded,
  },
  {
    id: "spring", title: "Springs",
    text: "A domino standing on a spring also knocks the hexagon beyond the next one, over water, an empty hexagon or a domino of another colour, but not past a stone. A knock that crosses a spring's throw doubles.",
    scene: table({ map: { spring: [[0, 0]], water: [[1, 0]] } }),
    dominoes: [[0, 0, Y, 0], [2, 0, Y, 0], [3, 0, Y, 0]], push: { q: 0, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 3 && k.crossed && k.fell.some(f => f[0] === at(2, 0) && f[2] === at(0, 0)),
  },
  {
    id: "marsh", title: "Marsh",
    text: "Dominoes can be laid on marsh like anywhere else, but one standing there falls without knocking another: the fall ends at it.",
    scene: table({ map: { marsh: [[0, 0]] } }),
    dominoes: [[-1, 0, Y, 0], [0, 0, Y, 0], [1, 0, Y, 0]], push: { q: -1, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 2 && !k.fell.some(f => f[0] === at(1, 0)),
  },
  {
    id: "hedge", title: "Hedges",
    text: "A hedge stands on the edge between two hexagons, and a fall cannot cross it. A fall can still run along it.",
    scene: table({ map: { hedge: [[[0, 0], [1, 0]]] } }),
    dominoes: [[-1, 0, Y, 0], [0, 0, Y, 0], [1, 0, Y, 0], [2, 0, Y, 0]], push: { q: -1, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 2 && !k.fell.some(f => f[0] === at(1, 0)),
  },
  {
    id: "portal", title: "Portals",
    text: "Portals come in pairs, drawn as rings. A domino that falls on one also knocks the domino on the other, whichever way that faces. The knock doubles.",
    scene: table({ links: [[[0, -2, 0], [0, 2, 0]]] }),
    dominoes: [[-3, 0, Y, 0], [-2, 0, Y, 0], [2, 0, Y, 2], [3, -1, Y, 2]], push: { q: -3, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 4 && k.crossed && k.fell.some(f => f[0] === at(2, 0) && f[2] === at(-2, 0)),
  },
  {
    id: "stair", title: "Stairs",
    text: "A stair joins a hexagon on one floor to one on another, drawn as a dashed line. A domino that falls on one end brings down the domino on the other, above or below. The knock doubles.",
    scene: table({ layers: [{}, { only: [[-1, 0], [0, 0], [1, 0]] }], links: [[[0, 0, 0], [1, 0, 0]]] }),
    dominoes: [[-1, 0, Y, 0, 0, 1], [0, 0, Y, 0, 0, 1], [0, 0, Y, 0], [1, 0, Y, 0]], push: { q: -1, r: 0, way: 0, floor: 1 },
    expect: (k, at) => k.fell.length === 4 && k.crossed && k.fell.some(f => f[0] === at(0, 0, 0) && f[2] === at(0, 0, 1)),
  },
  {
    id: "drop", title: "Drops",
    text: "A fall that runs off the edge of an upper floor lands on the floor below and goes on the way it was going. The knock doubles.",
    scene: table({ layers: [{}, { only: [[-1, 0], [0, 0], [1, 0]] }], drops: [{ from: 1, to: 0 }] }),
    dominoes: [[-1, 0, Y, 0, 0, 1], [0, 0, Y, 0, 0, 1], [1, 0, Y, 0, 0, 1], [2, 0, Y, 0], [3, 0, Y, 0]], push: { q: -1, r: 0, way: 0, floor: 1 },
    expect: (k, at) => k.fell.length === 5 && k.crossed && k.fell.some(f => f[0] === at(2, 0, 0) && f[2] === at(1, 0, 1)),
  },
  {
    id: "step", title: "Steps",
    text: "Hexagons stand at different heights. A fall goes level or down, never up: the domino on higher ground than the one that hit it stays standing.",
    scene: table({ map: { height: { 2: [[0, 0]], 1: [[1, 0]], 3: [[1, -1]] } } }),
    dominoes: [[0, 0, Y, 1], [1, 0, Y, 0], [1, -1, Y, 0], [2, 0, Y, 0]], push: { q: 0, r: 0, way: 1 },
    expect: (k, at) => k.fell.some(f => f[0] === at(1, 0)) && !k.fell.some(f => f[0] === at(1, -1)) && k.fell.length === 3,
  },
  {
    id: "water", title: "Water",
    text: "Nothing is laid on water, and a fall can't cross it: an empty water hexagon ends the fall.",
    scene: table({ map: { water: [[0, 0]] } }),
    dominoes: [[-2, 0, Y, 0], [-1, 0, Y, 0], [1, 0, Y, 0], [2, 0, Y, 0]], push: { q: -2, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 2 && !k.fell.some(f => f[0] === at(1, 0)),
  },
  {
    id: "bridge", title: "Bridges",
    text: "A bridge is a piece with a plank under each domino, and may be laid on water. Dominoes standing on it carry a fall across the water like any others.",
    scene: table({ bridges: 0.18, map: { water: [[0, 0]] } }),
    dominoes: [[-1, 0, Y, 0], [0, 0, Y, 0], [1, 0, Y, 0]], push: { q: -1, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 3 && k.fell.some(f => f[0] === at(0, 0)),
  },
  {
    id: "stones", title: "Stones",
    text: "Nothing is laid on a stone, and a fall stops at it. A spring can't throw a fall past one.",
    scene: table({ map: { rock: [[0, 0]] } }),
    dominoes: [[-2, 0, Y, 0], [-1, 0, Y, 0], [1, 0, Y, 0]], push: { q: -2, r: 0, way: 0 },
    expect: (k, at) => k.fell.length === 2 && !k.fell.some(f => f[0] === at(1, 0)),
  },
  {
    id: "twin", title: "Twins",
    text: "A twin is a pair of dominoes of two colours, one to each. Each half stands in the chain of its own colour; the two halves don't knock each other, since they differ. Here the yellow half falls with the yellow chain and the red half stands.",
    scene: table({ twins: 0.18 }),
    dominoes: [[-2, 0, Y, 0], [-1, 0, Y, 0], [0, 0, R, 0], [1, 0, R, 0]], push: { q: -2, r: 0, way: 0 },
    ring: [[-1, 0, 0], [0, 0, 0]],
    expect: (k, at) => k.fell.length === 2 && k.fell.some(f => f[0] === at(-1, 0)) && !k.fell.some(f => f[0] === at(0, 0)),
  },
  {
    id: "gilded", title: "Gilded hexagons",
    text: "A gilded hexagon, outlined in gold, doubles the knock if the domino standing on it falls. A heavy domino or a gate falling doubles it the same way, never twice over.",
    scene: table({ map: { gilded: [[0, 0]] } }),
    dominoes: [[-1, 0, Y, 0], [0, 0, Y, 0], [1, 0, Y, 0]], push: { q: -1, r: 0, way: 0 },
    expect: k => k.fell.length === 3 && k.gilded && k.gain === 10 * 3 * 3 * 2,
  },
  {
    id: "ball", title: "Balls",
    text: "A fall that reaches a ball sets it rolling the way it was hit. It rolls further the longer the fall behind it, and knocks the first domino in its path.",
    scene: table({ balls: 1 }),
    dominoes: [[0, 0, Y, 0], [1, 0, BALL, -1], [3, 0, Y, 0]], push: { q: 0, r: 0, way: 0 },
    expect: (k, at) => k.rolls.length === 1 && k.rolls[0].dir === 0 && k.rolls[0].hit === at(3, 0) && k.fell.some(f => f[0] === at(3, 0)),
  },
  {
    id: "cup", title: "Cups",
    text: "A ball that stops in a cup scores 1,500 on top of the knock, and another ball is put on the table.",
    scene: table({ balls: 1, map: { cup: [[3, 0]] } }),
    dominoes: [[0, 0, Y, 0], [1, 0, BALL, -1]], push: { q: 0, r: 0, way: 0 },
    expect: (k, at) => k.cups === 1 && k.rolls[0].end === at(3, 0) && k.gain === 10 * k.units * k.steps + 1500,
  },
  {
    id: "floors", title: "Floors",
    text: "On a table of several floors the buttons at its corner choose the floor you lay, turn and push on. A knock falls over all the floors at once.",
    scene: table({ layers: [{}, { only: [[-1, 0], [0, 0], [1, 0]] }], links: [[[0, 0, 0], [1, 0, 0]]] }),
    dominoes: [[-1, 0, Y, 0, 0, 1], [0, 0, Y, 0, 0, 1], [0, 0, Y, 0], [1, 0, Y, 0]], push: { q: -1, r: 0, way: 0, floor: 1 }, floors: true,
    expect: (k, at) => k.fell.some(f => floorOf(f[0]) === 0) && k.fell.some(f => floorOf(f[0]) === 1),
  },
  {
    id: "crossing", title: "Crossings",
    text: "A knock that crosses something the table adds, a spring's throw, a portal, a stair or a drop to a lower floor, doubles. It doubles once, however many it crosses.",
    scene: table({ map: { spring: [[0, 0]] } }),
    dominoes: [[0, 0, Y, 0], [2, 0, Y, 0]], push: { q: 0, r: 0, way: 0 },
    expect: k => k.fell.length === 2 && k.crossed && k.gain === 10 * 2 * 2 * 2,
  },
];
export const IDS = LESSONS.map(l => l.id);
export const lessonById = id => LESSONS.find(l => l.id === id) || null;

/** The number of hexagon (q, r) on floor f. */
const hexOf = (q, r, f = 0) => f * SIZE + cellAt(q, r);

/** A lesson played on the engine: its rules and table, the push, and what the push does. */
export function playLesson(lesson, { dominoes = lesson.dominoes, scene = lesson.scene } = {}) {
  const rules = custom(scene), cells = new Array(rules.n).fill(-1), ax = new Array(rules.n).fill(-1), mod = new Array(rules.n).fill(0);
  for (const [q, r, colour, axis, m = 0, f = 0] of dominoes) { const i = hexOf(q, r, f); cells[i] = colour; ax[i] = axis; mod[i] = m; }
  const { q, r, way, floor = 0 } = lesson.push, start = hexOf(q, r, floor);
  const k = knockOn(cells, ax, start, way, -1, rules, 0, mod);
  return { rules, cells, ax, mod, start, way, k, at: hexOf };
}
/** Whether the engine does what the lesson says. */
export const holds = lesson => !!lesson.expect(playLesson(lesson).k, hexOf);

/**
 * The hexagons of a lesson's table that are drawn (the rest is left out so a small thing is drawn large): every hexagon of a
 * floor within one of a domino, a ball, the push or anything the lesson's table marks, on the floors the lesson uses.
 */
export function shown(lesson) {
  const { rules, cells } = playLesson(lesson), keep = new Set(), near = new Set();
  const marked = i => cells[i] !== -1 || rules.terrain[i] === WATER || rules.terrain[i] === ROCK || rules.terrain[i] === CUP || rules.height[i] > 0 || rules.gilded[i] || rules.spring[i] || rules.marsh[i];
  for (let i = 0; i < rules.n; i++) if (marked(i)) near.add(i);
  for (const i of near) {
    keep.add(i);
    const f = floorOf(i), [q, r] = CELLS[i % SIZE];
    for (const [dq, dr] of [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]) {
      const c = cellAt(q + dq, r + dr);
      if (c >= 0 && rules.terrain[f * SIZE + c] !== 3) keep.add(f * SIZE + c);
    }
  }
  for (const i of [...keep]) if (rules.terrain[i] === 3) keep.delete(i);
  // a link's ends, and the edge a fall leaves a floor by, are drawn whole
  for (const list of rules.links || []) for (const j of list) if (near.has(j)) keep.add(j);
  return keep;
}

// ---------- which lessons a table, a piece or a hexagon means ----------
const has = (arr, f = x => x) => !!arr && Array.from(arr).some(f);
const linked = (rules, across) => has(rules.links, (list, i) => list.some(j => (floorOf(i) !== floorOf(j)) === across));
const dropped = rules => { for (let i = 0; i < rules.n; i++) for (let d = 0; d < 6; d++) { const j = rules.nb[i * 6 + d]; if (j >= 0 && floorOf(j) !== floorOf(i)) return true; } return false; };
/** The lessons a level's table needs from the start: what is on it, not what it will deal. Ids in the order of LESSONS. */
export function tableLessons(rules) {
  if (!rules || rules.palette !== "levels") return [];
  const on = {
    mix: false, rainbow: false, heavy: false, gate: false, bridge: false, twin: false,                                // pieces: they come with the deal (`pieceLessons`)
    spring: has(rules.spring), marsh: has(rules.marsh), hedge: !!rules.hedged, portal: linked(rules, false), stair: linked(rules, true), drop: dropped(rules),
    step: has(rules.height), water: has(rules.terrain, t => t === WATER), stones: has(rules.terrain, t => t === ROCK), gilded: has(rules.gilded),
    ball: rules.balls > 0, cup: has(rules.terrain, t => t === CUP), floors: rules.layers > 1,
  };
  on.crossing = on.spring || on.portal || on.stair || on.drop;
  return IDS.filter(id => on[id]);
}
/** The lessons a piece asks for: heavy and gate dominoes, a bridge, a twin, the rainbow, a mixed colour. Most specific first; none for a plain piece. */
export function pieceLessons(h) {
  if (!h) return [];
  const out = [];
  if (h.mod === HEAVY) out.push("heavy");
  else if (h.mod >= 10) out.push("gate");
  if (h.bridge) out.push("bridge");
  if (h.colours) out.push("twin");
  for (const c of h.colours || [h.colour]) { if (c === RAINBOW) out.push("rainbow"); else if (c >= 5 && c <= 8) out.push("mix"); }
  return [...new Set(out)];
}
/** The lessons a game needs now: its table's, and those of the pieces in hand and the dominoes standing. */
export function gameLessons(game, rules) {
  if (!game || !rules || rules.palette !== "levels") return [];
  const want = new Set(tableLessons(rules));
  for (const h of game.hand || []) for (const id of pieceLessons(h)) want.add(id);
  game.cells.forEach((c, i) => {
    if (c < 0) return;
    if (c === RAINBOW) want.add("rainbow"); else if (c >= 5 && c <= 8) want.add("mix");
    const m = game.mod ? game.mod[i] : 0;
    if (m === HEAVY) want.add("heavy"); else if (m >= 10) want.add("gate");
    if (rules.terrain[i] === WATER) want.add("bridge");
  });
  return IDS.filter(id => want.has(id));
}
/**
 * The lesson a press on hexagon i means: the domino standing there if it is a special one (heavy, gate, rainbow, a mix, a
 * bridge on water), else a ball, else the hexagon's own feature; null for none. `hedgeEdge` says the press is on an edge with a hedge.
 */
export function cellLesson(game, rules, i, hedgeEdge = false) {
  if (i < 0 || !rules || rules.palette !== "levels") return null;
  const c = game.cells[i], m = game.mod ? game.mod[i] : 0;
  if (c >= 0) {
    if (m === HEAVY) return "heavy";
    if (m >= 10) return "gate";
    if (c === RAINBOW) return "rainbow";
    if (c >= 5 && c <= 8) return "mix";
    if (rules.terrain[i] === WATER) return "bridge";
  }
  if (c === BALL) return "ball";
  if (hedgeEdge) return "hedge";
  const t = rules.terrain[i];
  if (t === CUP) return "cup";
  if (rules.spring[i]) return "spring";
  if (rules.marsh[i]) return "marsh";
  if (rules.links && rules.links[i].length) return rules.links[i].some(j => floorOf(j) !== floorOf(i)) ? "stair" : "portal";
  if (rules.gilded[i]) return "gilded";
  if (t === WATER) return "water";
  if (t === ROCK) return "stones";
  if (rules.height[i] > 0) return "step";
  for (let d = 0; d < 6; d++) { const j = rules.nb[i * 6 + d]; if (j >= 0 && floorOf(j) !== floorOf(i)) return "drop"; }
  return null;
}
