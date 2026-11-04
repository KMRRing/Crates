// The curated parts of Slipway's chapters that are built from features (slipway-build.js): each a name, where it goes in
// the cog, the line that teaches its rule, and a spec. tests/slipway-puzzle.mjs plays every solution through the rules and
// shows the wrong order or side does not work; tests/slipway-search.mjs proves nothing is shorter (the search).
import { build } from "./slipway-build.js";

/** [id, name, place in the cog, line, spec] */
export const PART_SPECS = [
  // ---- the saw: the view is the puzzle ----
  ["cleat", "Cleat", "rig", "A horn for a rope, tapered at both ends and its edge eased. The slopes are seen from the side, the edge from the end: no one view shows both.",
    { size: [22, 9, 8], features: [["slope", { end: "l", run: 7, drop: 3.5 }], ["slope", { end: "r", run: 7, drop: 3.5 }], ["chamfer", { edge: "tf", size: 2.5 }]] }],
  ["cathead", "Cathead", "bow", "The beam that carries the anchor: waste on top, a slope at the outboard end, an edge to ease. Read each plane's view before you draw.",
    { size: [26, 13, 9], cap: 3, features: [["slope", { end: "r", run: 9, drop: 5 }], ["chamfer", { edge: "bb", size: 3 }]] }],

  // ---- the plane: with the grain, flat faces, not through a knot ----
  ["strake", "Fender strake", "hull", "A rubbing strake with a rebate for the plank above. A knot sits in the waste over it, and the iron stops on a knot: take the waste first.",
    { size: [28, 12, 8], cap: 4, knots: [[14, 10.5, 4, 1.3]], features: [["pocket", { x0: 8, x1: 20, depth: 3, via: "plane" }]] }],
  ["pintle", "Pintle block", "rudder", "The log stands on end, so its top is end grain and the plane will not touch it. Plane the rebate up and down the grain, never across.",
    { size: [20, 12, 8], grain: 1, cap: 3, features: [["trim", { end: "r", a: 4 }], ["pocket", { x0: 6, x1: 13, depth: 3, via: "plane" }]] }],

  // ---- the drill and the gouge: square faces, and wood to back the bit ----
  ["tholepin", "Tholepin", "hull", "A peg the oar turns on, its hole near the end. Squaring that end thins the wood round the bit: bore while the waste still backs it.",
    { size: [30, 10, 8], features: [["trim", { end: "l", a: 3 }], ["hole", { axis: 1, at: [5.7, 4] }], ["slope", { end: "r", run: 10, drop: 4 }]] }],
  ["deadeye", "Deadeye", "rig", "A block with a dish for the shroud's lanyard. The gouge needs a rim of wood round it: scoop the dish before the edge beside it is eased away.",
    { size: [18, 9, 11], features: [["dish", { at: [9, 5.5] }], ["chamfer", { edge: "tf", size: 3.5 }], ["slope", { end: "l", run: 5, drop: 4 }]] }],
  ["trenailbeam", "Trenail beam", "hull", "A beam pegged through its thickness. The bit must go in square and come out square: bore before either face is eased.",
    { size: [24, 10, 8], features: [["hole", { axis: 2, at: [12, 6] }], ["chamfer", { edge: "tf", size: 4 }], ["chamfer", { edge: "tb", size: 4 }]] }],
  ["sheave", "Sheave block", "rig", "A knot sits in the waste over the pin hole, and the bit grabs a knot. Here the saw goes first, and the bore after.",
    { size: [26, 13, 8], cap: 3, knots: [[12, 11.5, 4, 1.4]], features: [["hole", { axis: 1, at: [12, 4], phase: 3.5 }], ["slope", { end: "r", run: 8, drop: 4 }]] }],

  // ---- the back saw and the chisel: score the shoulders, then chop between ----
  ["scarf", "Keel scarf", "keel", "A deep step where two timbers meet, too deep for the plane. Score both shoulders with the back saw, then chop between them.",
    { size: [24, 13, 7], cap: 3, features: [["pocket", { x0: 8, x1: 14, depth: 7, via: "chisel" }]] }],
  ["gudgeon", "Gudgeon lap", "rudder", "A lap at the end of a timber. One shoulder to score: the other side is open air, so the grain is free that way.",
    { size: [26, 12, 7], cap: 2, features: [["slope", { end: "l", run: 8, drop: 4 }], ["pocket", { x0: 20, x1: 26, depth: 6, via: "chisel" }]] }],
  ["partner", "Mast partner", "mast", "A mortise for the mast and a hole close beside it. Once the mortise is open the wall between is too thin to bore.",
    { size: [30, 13, 7], cap: 3, features: [["hole", { axis: 1, at: [16.2, 3.5] }], ["pocket", { x0: 8, x1: 14, depth: 7, via: "chisel" }]] }],
  ["bitt", "Windlass bitt", "bow", "A mortise cut through a knot. The knot stops the plane but not the chisel.",
    { size: [32, 13, 7], cap: 3, knots: [[11, 8, 3.5, 1.2]], tools: { plane: 2 }, features: [["slope", { end: "r", run: 9, drop: 5 }], ["pocket", { x0: 8, x1: 14, depth: 7, via: "chisel" }]] }],
  ["cheek", "Tabernacle cheek", "mast", "The cheek the mast pivots between: a deep mortise, a squared end, a sloped head. Each saw can undo what the chisel needs.",
    { size: [28, 14, 7], cap: 4, features: [["trim", { end: "l", a: 3 }], ["slope", { end: "r", run: 8, drop: 4 }], ["pocket", { x0: 8, x1: 14, depth: 8, via: "chisel" }]] }],

  // ---- the adze and the spokeshave: rough across the grain, finish along it ----
  ["tiller", "Tiller", "rudder", "Half round on top, like a hand-worn bar. The adze goes across the grain and leaves a rough skin; the spokeshave follows with the grain.",
    { size: [20, 12, 12], features: [["crown", { sag: 5, adze: [4, 10, 16], shave: [2.4, 9.6] }]] }],
  ["handspike", "Handspike", "deck", "A lever for the windlass, round to the hand and tapered at one end. The spokeshave jams on deep stock: the adze first.",
    { size: [24, 12, 12], features: [["crown", { sag: 5, adze: [4, 12], shave: [2.4, 9.6] }], ["slope", { end: "r", run: 12, drop: 5 }]] }],
  ["capstan", "Capstan bar", "deck", "A bar rounded on top with a hole for the pin near its squared end. The saw that squares the end thins the wall: bore first, round after.",
    { size: [24, 12, 12], features: [["trim", { end: "l", a: 3 }], ["hole", { axis: 1, at: [5.7, 6] }], ["crown", { sag: 5, adze: [6, 14, 20], shave: [2.4, 9.6] }]] }],
  ["oar", "Oar loom", "hull", "The loom of an oar: rounded, with a squared grip end. Two tools with the grain, one across it.",
    { size: [26, 12, 12], features: [["trim", { end: "r", a: 3 }], ["crown", { sag: 5, adze: [4, 12, 19], shave: [2.4, 9.6] }]] }],
  ["yard", "Yardarm", "rig", "The tip of a yard, rounded, tapered, and drilled for the lift. Which comes first, and which last?",
    { size: [26, 12, 12], features: [["hole", { axis: 1, at: [20, 6] }], ["crown", { sag: 5, adze: [13, 21.5], shave: [2.4, 9.6] }], ["slope", { end: "l", run: 10, drop: 7 }]] }],

  // ---- everything ----
  ["futtock", "Frame futtock", "hull", "A rib of the hull: a mortise for the keel, a taper to the head, a peg hole through. Seven things to get in order.",
    { size: [28, 14, 7], cap: 4, features: [["hole", { axis: 2, at: [21, 5] }], ["slope", { end: "r", run: 9, drop: 5 }], ["pocket", { x0: 6, x1: 12, depth: 7, via: "chisel" }]] }],
  ["stemknee", "Stem knee", "bow", "The log stands on end for the stem's grain. Slopes and an edge, and every plane is seen from a different place.",
    { size: [16, 14, 8], grain: 1, cap: 4, features: [["slope", { end: "l", run: 4, drop: 3 }], ["slope", { end: "r", run: 4, drop: 3 }], ["chamfer", { edge: "tb", size: 3 }]] }],
  ["rudderhead", "Rudder head", "rudder", "The tiller fits this head: a square end, a thin wall round the bore, a dish for the pin's washer, a slope behind.",
    { size: [28, 10, 11], features: [["trim", { end: "l", a: 3 }], ["hole", { axis: 1, at: [5.7, 5.5] }], ["dish", { at: [15, 5.5] }], ["chamfer", { edge: "tf", size: 4 }], ["slope", { end: "r", run: 8, drop: 4 }]] }],
  ["hawse", "Hawse bolster", "bow", "A rounded bolster for the cable, with a dish for its chafing leather. The dish needs a rim: shape it before the top is rounded away.",
    { size: [24, 13, 14], features: [["dish", { at: [12, 7], r: 5, depth: 5.5 }], ["crown", { sag: 6, adze: [4, 12, 20], shave: [2.8, 11.2] }]] }],
  ["bowsprit", "Bowsprit bitt", "bow", "A post the bowsprit is held by: a mortise, a hole near the squared end, a taper. The saw that squares the end ruins the hole.",
    { size: [32, 13, 7], cap: 3, features: [["trim", { end: "r", a: 3 }], ["hole", { axis: 1, at: [24.3, 3.5] }], ["slope", { end: "l", run: 8, drop: 4 }], ["pocket", { x0: 10, x1: 16, depth: 7, via: "chisel" }]] }],
  ["sternpost", "Stern post", "rudder", "The post the rudder hangs from: everything the chapters taught, at once.",
    { size: [32, 14, 7], cap: 4, knots: [[19, 9, 3.5, 1.2]], features: [["trim", { end: "l", a: 3 }], ["hole", { axis: 1, at: [5.7, 3.5] }], ["pocket", { x0: 14, x1: 20, depth: 8, via: "chisel" }], ["slope", { end: "r", run: 8, drop: 4 }]] }],
];

export const built = () => PART_SPECS.map(([id, name, place, line, spec]) => ({ id, name, spot: place, line, ...build(spec) }));
