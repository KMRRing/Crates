// Topple's feature help, pure (no page): what each thing a level brings is called, how it reads in a few lines, and the
// little scenes that show it, each a real table run on the engine (topple-engine.js), so what is drawn is what happens.
// topple-help-ui.js draws the scenes and keeps the dialog; this file knows which features a level, a piece in hand or a
// hexagon has, so a level's table, a hand and a long press all ask the same thing and the tests can read it in Node.
//
// A scene is a small table by hand: its `rules` are a spec for `custom` (topple-levels.js), `put` the dominoes as
// [q, r, colour, axis, mod, floor], `balls` as [q, r, floor], `push` the one pushed as [q, r, way, floor], `target` the
// domino the scene is about, and `expect` what the engine must make of it (the tests hold the text to that). The falls it
// shows come from `cascade` and `knockOn`, in the engine's own order: nothing here decides what falls.
// The numbers in a text come from the engine too (`CUP_SCORE`, `BELL`); the rest are words.
import { SIZE, DIRS, at, knockOn, BELL, BALL, HEAVY, gateMod, gateOf, colourAt, RAINBOW } from "./topple-engine.js";
import { custom, CUP_SCORE, MIXES, ROCK, WATER, CUP, VOID } from "./topple-levels.js";

const fmt = n => n.toLocaleString("en-GB");
const floorOf = i => Math.floor(i / SIZE);
const [Y, R, B, , , O, G] = [0, 1, 2, 3, 4, 5, 6];   // yellow, red, blue, (black, white), orange, green
/** A line of dominoes along the east axis from (q0, 0), each [colour]: put-entries for a scene. */
const row = (colours, q0, r = 0) => colours.map((c, k) => [q0 + k, r, c, 0]);
/** The hexagons of a list [q, r, floor] and every neighbour of them on the same floor: the small table a scene is drawn on. */
const near = list => {
  const seen = new Map(), add = (q, r, f) => { if (at(q, r) >= 0) seen.set(`${q},${r},${f}`, [q, r, f]); };
  for (const [q, r, f = 0] of list) { add(q, r, f); for (const [dq, dr] of DIRS) add(q + dq, r + dr, f); }
  return [...seen.values()];
};
/** The heavy domino's and the gate's table: a push on S, along the line between two hexagons, brings A and B down on H. */
const FORK = (colourB, third) => ({ put: [[0, 0, Y, 1], [1, 0, Y, 2], ...(colourB == null ? [] : [[1, -1, colourB, 0]]), third], push: [0, 0, 1], target: [2, -1] });

// ---------- the order things are taught in (and shown in when a level has several) ----------
export const ORDER = ["mix", "rainbow", "stone", "water", "bridge", "twin", "gilded", "heavy", "gate", "steps", "spring", "marsh", "hedge", "portal", "floors", "stair", "ball", "cup"];

/**
 * Every feature: { id, name, lines (2–3 short lines; the first says what it is), scenes (one, or two to set side by side:
 * the second is what the first is not) }.
 */
export const FEATURES = [
  {
    id: "mix", name: "Mixed colours",
    lines: ["Orange is yellow and red, green is yellow and blue, purple is red and blue, grey is black and white: a mix.", "A mix is knocked by either parent and knocks either parent, and nothing else: not another mix, not a colour outside its pair."],
    scenes: [
      { put: row([Y, O, R], -1), push: [-1, 0, 0], target: [1, 0], expect: { fells: 3, falls: true } },
      { put: row([Y, O, B], -1), push: [-1, 0, 0], target: [1, 0], expect: { fells: 2, falls: false } },
    ],
  },
  {
    id: "rainbow", name: "Rainbow",
    lines: ["The rainbow is knocked by every colour and knocks every colour.", "It joins chains that nothing else would."],
    scenes: [
      { put: row([R, R, Y, B], -2), push: [-2, 0, 0], target: [0, 0], expect: { fells: 2, falls: false } },
      { put: row([R, R, RAINBOW, B], -2), push: [-2, 0, 0], target: [0, 0], expect: { fells: 4, falls: true } },
    ],
  },
  {
    id: "stone", name: "Stone",
    lines: ["Nothing is laid on a stone, and a fall stops at it.", "What lies beyond needs a chain of its own."],
    scenes: [{ rules: { scene: "cliff", map: { rock: [[0, 0]] } }, put: [[-2, 0, Y, 0], [-1, 0, Y, 0], [1, 0, Y, 0], [2, 0, Y, 0]], push: [-2, 0, 0], target: [1, 0], expect: { fells: 2, falls: false } }],
  },
  {
    id: "water", name: "Water",
    lines: ["Nothing is laid on water, and a fall cannot cross it.", "A ford, a hexagon of floor in the water, can hold a domino, and the fall goes over by it."],
    scenes: [
      { rules: { scene: "jetty", map: { water: [[0, -1], [0, 0], [0, 1]] } }, put: [[-2, 0, Y, 0], [-1, 0, Y, 0], [1, 0, Y, 0], [2, 0, Y, 0]], push: [-2, 0, 0], target: [1, 0], expect: { fells: 2, falls: false } },
      { rules: { scene: "jetty", map: { water: [[0, -1], [0, 1]] } }, put: row([Y, Y, Y, Y, Y], -2), push: [-2, 0, 0], target: [2, 0], expect: { fells: 5, falls: true } },
    ],
  },
  {
    id: "bridge", name: "Bridge",
    lines: ["A bridge is a straight piece, the one kind that may be laid on water.", "Its planks carry the fall across."],
    scenes: [
      { rules: { scene: "jetty", bridges: 0.1, map: { water: [[0, 0], [1, 0]] } }, put: [[-2, 0, Y, 0], [-1, 0, Y, 0], [2, 0, Y, 0]], push: [-2, 0, 0], target: [2, 0], expect: { fells: 2, falls: false } },
      { rules: { scene: "jetty", bridges: 0.1, map: { water: [[0, 0], [1, 0]] } }, put: row([Y, Y, Y, Y, Y], -2), push: [-2, 0, 0], target: [2, 0], expect: { fells: 5, falls: true } },
    ],
  },
  {
    id: "twin", name: "Twin",
    lines: ["A twin is one piece of two dominoes in two colours.", "Each half belongs to the chain of its own colour: it stands in one chain with one domino and in another with the other."],
    scenes: [
      { rules: { scene: "garden" }, put: [[-1, 0, Y, 0], [0, 0, Y, 0], [1, 0, R, 0], [2, 0, R, 0]], push: [-1, 0, 0], caption: "Yellow chain", expect: { fells: 2 } },
      { rules: { scene: "garden" }, put: [[-1, 0, Y, 0], [0, 0, Y, 0], [1, 0, R, 0], [2, 0, R, 0]], push: [2, 0, 6], caption: "Red chain", expect: { fells: 2 } },
    ],
  },
  {
    id: "gilded", name: "Gilded hexagon",
    lines: ["A domino that falls on a gilded hexagon doubles the whole knock (a knock is one push and all it brings down).", `The bell's ${fmt(BELL)} is added after, and never doubled.`],
    scenes: [{ rules: { scene: "garden", map: { gilded: [[0, 0]] } }, put: row([Y, Y, Y], -2), push: [-2, 0, 0], expect: { fells: 3, doubled: true } }],
  },
  {
    id: "heavy", name: "Heavy domino",
    lines: ["A heavy domino, thick with a brass band, stands through the first hit and falls on the second, both in the one knock.", "Any two dominoes will do. Pushed by hand it falls at once, and it scores double."],
    scenes: [
      { rules: { scene: "garden" }, ...FORK(null, [2, -1, B, 1, HEAVY]), expect: { fells: 2, falls: false } },
      { rules: { scene: "garden" }, ...FORK(Y, [2, -1, B, 1, HEAVY]), expect: { fells: 4, falls: true, doubled: true } },
    ],
  },
  {
    id: "gate", name: "Gate domino",
    lines: ["A gate names two colours, one on each half. It falls only when a domino of each has fallen into it, in the one knock.", "Two of one colour do not open it, and a rainbow counts as either. Pushed by hand it falls at once, and it scores double."],
    scenes: [
      { rules: { scene: "garden" }, ...FORK(Y, [2, -1, Y, 1, gateMod(Y, G)]), expect: { fells: 3, falls: false } },
      { rules: { scene: "garden" }, ...FORK(G, [2, -1, Y, 1, gateMod(Y, G)]), expect: { fells: 4, falls: true, doubled: true } },
    ],
  },
  {
    id: "steps", name: "Steps",
    lines: ["A fall goes level or down a step, never up.", "Push from the top to bring the lower dominoes down."],
    scenes: [
      { rules: { scene: "cliff", rise: 0.3, map: { height: { 2: [[1, 0], [2, 0]] } } }, put: row([Y, Y, Y, Y], -1), push: [-1, 0, 0], target: [1, 0], expect: { fells: 2, falls: false } },
      { rules: { scene: "cliff", rise: 0.3, map: { height: { 2: [[1, 0], [2, 0]] } } }, put: row([Y, Y, Y, Y], -1), push: [2, 0, 6], target: [-1, 0], expect: { fells: 4, falls: true } },
    ],
  },
  {
    id: "spring", name: "Spring",
    lines: ["A domino on a spring also reaches the hexagon beyond the next, over water or an empty hexagon, but not past a stone.", "The throw is a crossing: a knock that makes one scores double."],
    scenes: [
      { rules: { scene: "jetty", map: { spring: [[0, 0]], water: [[1, 0]] } }, put: [[0, 0, Y, 0], [2, 0, Y, 0], [3, 0, Y, 0]], push: [0, 0, 0], target: [2, 0], expect: { fells: 3, falls: true, doubled: true } },
      { rules: { scene: "jetty", map: { spring: [[0, 0]], rock: [[1, 0]] } }, put: [[0, 0, Y, 0], [2, 0, Y, 0], [3, 0, Y, 0]], push: [0, 0, 0], target: [2, 0], expect: { fells: 1, falls: false } },
    ],
  },
  {
    id: "marsh", name: "Marsh",
    lines: ["Anything may be laid on marsh, but a domino there falls and knocks nothing.", "The chain ends on it."],
    scenes: [{ rules: { scene: "garden", map: { marsh: [[0, 0]] } }, put: row([Y, Y, Y, Y], -1), push: [-1, 0, 0], target: [1, 0], expect: { fells: 2, falls: false } }],
  },
  {
    id: "hedge", name: "Hedge",
    lines: ["A hedge stands on the edge between two hexagons and stops a fall across it.", "Along the edge it changes nothing."],
    scenes: [
      { rules: { scene: "garden", map: { hedge: [[[0, 0], [1, 0]]] } }, put: row([Y, Y, Y, Y], -1), push: [-1, 0, 0], target: [1, 0], expect: { fells: 2, falls: false } },
      { rules: { scene: "garden", map: { hedge: [[[0, 0], [0, -1]]] } }, put: row([Y, Y, Y, Y], -1), push: [-1, 0, 0], target: [1, 0], expect: { fells: 4, falls: true } },
    ],
  },
  {
    id: "portal", name: "Portal",
    lines: ["Portals come in pairs. A domino that falls on one brings down the domino on the other, whichever way it faces.", "That is a crossing: the knock scores double."],
    scenes: [{ rules: { scene: "marble", links: [[[0, 0, 0], [0, 0, 2]]] }, put: [...row([Y, Y, Y], -2), ...row([Y, Y, Y], 0, 2)], push: [-2, 0, 0], target: [2, 2], expect: { fells: 6, falls: true, doubled: true } }],
  },
  {
    id: "floors", name: "Floors",
    lines: ["A table can have floors: the buttons at its side choose the one you lay on and push.", "A fall that runs off the edge of an upper floor drops to the floor below and goes on; it never climbs. A drop is a crossing: double."],
    scenes: [{
      rules: { scene: "cliff", layers: [{}, { only: [[-1, 0], [0, 0], [1, 0]] }], drops: [{ from: 1, to: 0 }] },
      put: [[-1, 0, Y, 0, 0, 1], [0, 0, Y, 0, 0, 1], [1, 0, Y, 0, 0, 1], [2, 0, Y, 0], [3, 0, Y, 0]], push: [-1, 0, 0, 1], target: [3, 0],
      view: [[-1, 0, 1], [0, 0, 1], [1, 0, 1], [2, 0, 0], [3, 0, 0], [4, 0, 0]], expect: { fells: 5, falls: true, doubled: true },
    }],
  },
  {
    id: "stair", name: "Stair",
    lines: ["A stair joins the same hexagon on two floors: a domino that falls on one end brings down the one on the other, whichever way it faces.", "A crossing doubles the knock."],
    scenes: [{
      rules: { scene: "marble", layers: [{}, { only: [[0, 0], [1, 0], [2, 0]] }], links: [[[0, 0, 0], [1, 0, 0]]] },
      put: [...row([Y, Y, Y], -2), [0, 0, Y, 0, 0, 1], [1, 0, Y, 0, 0, 1], [2, 0, Y, 0, 0, 1]], push: [-2, 0, 0], target: [2, 0, 1],
      view: [[-2, 0, 0], [-1, 0, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1], [2, 0, 1]], expect: { fells: 6, falls: true, doubled: true },
    }],
  },
  {
    id: "ball", name: "Ball",
    lines: ["A ball rolls the way it was hit, and knocks the first domino it meets.", "It rolls farther the later in the chain it is hit (its momentum), and is lost in water or off the table."],
    scenes: [
      { rules: { scene: "cliff" }, put: [[-1, 0, Y, 0], [3, 0, Y, 0]], balls: [[0, 0]], push: [-1, 0, 0], target: [3, 0], view: near([[-1, 0], [0, 0], [1, 0], [2, 0], [3, 0]]), expect: { fells: 1, falls: false } },
      { rules: { scene: "cliff" }, put: [[-3, 0, Y, 0], [-2, 0, Y, 0], [-1, 0, Y, 0], [3, 0, Y, 0]], balls: [[0, 0]], push: [-3, 0, 0], target: [3, 0], view: near([[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0]]), expect: { fells: 4, falls: true } },
    ],
  },
  {
    id: "cup", name: "Cup",
    lines: ["Nothing is laid in a cup. A ball that stops in one scores " + fmt(CUP_SCORE) + ", flat, on top of the knock.", "Another ball is put on the table."],
    scenes: [{ rules: { scene: "cliff", balls: 1, map: { cup: [[2, 0]] } }, put: [[-1, 0, Y, 0]], balls: [[0, 0]], push: [-1, 0, 0], view: near([[-1, 0], [0, 0], [1, 0], [2, 0]]), expect: { fells: 1, cups: 1 } }],
  },
];
const BY_ID = new Map(FEATURES.map(f => [f.id, f]));
export const featureOf = id => BY_ID.get(id);
/** The ids in teaching order, whatever order they were found in, none twice. */
const inOrder = ids => ORDER.filter(id => ids.has(id));

// ---------- running a scene on the engine ----------
/**
 * A scene played out: { rules, cells, ax, mod, start, way, k (knockOn's), fell, rolls, target (hexagon or -1), falls (whether
 * the target fell, or null), doubled, shown (the hexagons it is drawn on) }.
 */
export function runScene(scene) {
  const rules = custom(scene.rules || {}), hex = (q, r, f = 0) => f * SIZE + at(q, r);
  const cells = new Array(rules.n).fill(-1), ax = new Array(rules.n).fill(-1), mod = new Array(rules.n).fill(0);
  for (const [q, r, c, a, m = 0, f = 0] of scene.put) { const i = hex(q, r, f); cells[i] = c; ax[i] = a; mod[i] = m; }
  for (const [q, r, f = 0] of scene.balls || []) cells[hex(q, r, f)] = BALL;
  const [pq, pr, way, pf = 0] = scene.push, start = hex(pq, pr, pf), k = knockOn(cells, ax, start, way, -1, rules, 0, mod);
  const target = scene.target ? hex(...scene.target) : -1;
  const placed = [...scene.put.map(p => [p[0], p[1], p[5] || 0]), ...(scene.balls || []).map(b => [b[0], b[1], b[2] || 0])];
  const shown = (scene.view || near(placed)).map(([q, r, f = 0]) => hex(q, r, f)).filter(i => i >= 0 && rules.terrain[i] !== VOID);
  return { scene, rules, cells, ax, mod, start, way, k, fell: k.fell, rolls: k.rolls, target, falls: target < 0 ? null : k.fell.some(f => f[0] === target), doubled: k.gilded || k.crossed, shown };
}
/** What a scene says about itself, in a word or two: Stands or Falls (where it has a target), or the scene's own caption. */
export const verdictOf = run => run.scene.caption || (run.falls === null ? "" : run.falls ? "Falls" : "Stands");
/** The marks of what a knock came to, once it has fallen: double, a cup's flat sum. */
export function marksOf(run) {
  return [...(run.doubled ? ["×2"] : []), ...(run.k.cups ? [`+${fmt(run.k.cups * CUP_SCORE)}`] : [])];
}

// ---------- which features something has ----------
/** The features a colour brings: a mix, or the rainbow. */
const ofColour = c => (MIXES[c] ? ["mix"] : c === RAINBOW ? ["rainbow"] : []);
/** The features a domino's modifier brings: heavy, or a gate. */
const ofMod = m => (m === HEAVY ? ["heavy"] : gateOf(m) ? ["gate"] : []);

/** The features a level's rules have: its terrain, its pieces on the table, what it deals and the colours it uses. In teaching order. */
export function featuresOfRules(rules) {
  const has = new Set();
  for (let i = 0; i < rules.n; i++) {
    const t = rules.terrain[i];
    if (t === VOID) continue;
    if (t === ROCK) has.add("stone");
    else if (t === WATER) has.add("water");
    else if (t === CUP) has.add("cup");
    else if (rules.height[i]) has.add("steps");
    if (rules.gilded[i]) has.add("gilded");
    if (rules.spring[i]) has.add("spring");
    if (rules.marsh[i]) has.add("marsh");
  }
  if (rules.hedged) has.add("hedge");
  if (rules.links) rules.links.forEach((list, a) => { for (const b of list) has.add(floorOf(a) === floorOf(b) ? "portal" : "stair"); });
  if (rules.layers > 1) has.add("floors");
  for (const c of rules.colours) for (const id of ofColour(c)) has.add(id);
  if (rules.wild) has.add("rainbow");
  if (rules.bridges) has.add("bridge");
  if (rules.twins) has.add("twin");
  if (rules.balls) has.add("ball");
  if (rules.heavy) has.add("heavy");
  if (rules.gate) { has.add("gate"); for (const c of rules.gate.colours) for (const id of ofColour(c)) has.add(id); }
  for (const s of rules.start) for (const id of s.mod === "heavy" ? ["heavy"] : s.mod === "gate" ? ["gate"] : []) has.add(id);
  return inOrder(has);
}
/** The features a piece in hand has: a mix or the rainbow in its colours, heavy, a gate, a bridge, a twin. */
export function featuresOfHand(h) {
  if (!h) return [];
  const has = new Set([...ofColour(colourAt(h, 0)), ...(h.colours ? ofColour(h.colours[1]) : []), ...ofMod(h.mod || 0)]);
  if (h.bridge) has.add("bridge");
  if (h.colours) has.add("twin");
  return inOrder(has);
}
/**
 * The features of hexagon i of a table (its game's `cells` and `mod`, its rules): what the ground is, a ball, the domino
 * standing there (its colour, its modifier, a bridge if it stands on water), a hedge on any of its edges, a link, an edge
 * where a fall leaves for another floor.
 */
export function featuresAtCell(state, i, rules) {
  const has = new Set(), c = state.cells[i], t = rules.terrain[i];
  if (t === ROCK) has.add("stone");
  if (t === WATER) has.add("water");
  if (t === CUP) has.add("cup");
  if (t !== VOID && rules.height[i] > 0) has.add("steps");
  if (rules.gilded[i]) has.add("gilded");
  if (rules.spring[i]) has.add("spring");
  if (rules.marsh[i]) has.add("marsh");
  if (c === BALL) has.add("ball");
  if (c >= 0) {
    for (const id of ofColour(c)) has.add(id);
    for (const id of ofMod(state.mod ? state.mod[i] || 0 : 0)) has.add(id);
    if (t === WATER) has.add("bridge");
  }
  for (let d = 0; d < 6; d++) {
    if (rules.hedge[i * 6 + d]) has.add("hedge");
    const j = rules.nb[i * 6 + d];
    if (j >= 0 && floorOf(j) !== floorOf(i)) has.add("floors");
  }
  if (rules.links) for (const j of rules.links[i]) has.add(floorOf(i) === floorOf(j) ? "portal" : "stair");
  return inOrder(has);
}
/** The ids of `ids` not yet seen, in the order given. */
export const unseen = (ids, seen) => ids.filter(id => !seen.includes(id));

/**
 * Every key of a level's compiled rules, as help reads it or knowingly passes it by. A key the tests find that is in
 * neither list is a rule this help has not been taught: they fail until it is explained or listed as not needing it.
 */
export const RULE_KEYS = {
  read: ["terrain", "height", "gilded", "spring", "marsh", "hedged", "hedge", "links", "nb", "layers", "colours", "wild", "bridges", "twins", "heavy", "gate", "start", "balls"],
  passed: ["id", "name", "about", "goal", "stars", "n", "tall", "mods", "palette", "scene", "rise", "bell", "pace", "maxSize", "layerGap", "plain"],
};
