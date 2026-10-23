// The watch each plate is cut for (pure data; guilloche-3d.js builds it in 3D, guilloche-flat.js paints it flat). A dial is
// not a bare plate: it has a colour and a finish, a case of a metal and a bezel of a make, hands and markers of a style, and a
// strap, and each of the eight plates has its own, so that going on through the plates is going through a watchmaker's range.
// Colours are CSS hex; nothing here is drawn.
export const METALS = {
  steel: { name: "Steel", hex: "#cfd3d8", rough: 0.1 },
  gold: { name: "Yellow gold", hex: "#e9b84b", rough: 0.08 },
  rose: { name: "Rose gold", hex: "#e6a28d", rough: 0.08 },
  platinum: { name: "Platinum", hex: "#dedfe4", rough: 0.07 },
  titanium: { name: "Titanium", hex: "#8e929a", rough: 0.22 },
  bronze: { name: "Bronze", hex: "#c98a52", rough: 0.16 },
};
export const FINISHES = ["sunburst", "satin", "matte", "grain"];                 // a dial's: rays from the centre, rings round it, lacquer, a fine grain
export const BEZELS = ["smooth", "fluted", "coin", "domed", "step", "octagon"];  // round and polished; fluted; coin-edged; thin and domed; stepped; eight-sided with screws
export const HANDS = ["baton", "dauphine", "leaf", "sword", "spade", "alpha"];
export const MARKS = ["baton", "dot", "wedge", "diamond"];
export const STRAPS = ["leather", "croc", "rubber", "suede"];

/** The watch of each plate, by the plate's id. `body` is the case's metal under the bezel, if not the bezel's. */
export const WATCHES = {
  wave: { name: "Silver sunburst", dial: { base: "#cfd1d5", finish: "sunburst", ink: "#25282d" }, case: { metal: "steel", bezel: "smooth" }, hands: { style: "baton", metal: "steel" }, marks: "baton", strap: { kind: "leather", colour: "#1d1c1b" } },
  edge: { name: "Champagne and gold", dial: { base: "#d8bf8c", finish: "sunburst", ink: "#3b2d14" }, case: { metal: "gold", bezel: "smooth" }, hands: { style: "leaf", metal: "gold" }, marks: "wedge", strap: { kind: "leather", colour: "#5b3a22" } },
  rose: { name: "Salmon and rose gold", dial: { base: "#dfa58f", finish: "satin", ink: "#4a2a22" }, case: { metal: "rose", bezel: "coin" }, hands: { style: "dauphine", metal: "rose" }, marks: "diamond", strap: { kind: "suede", colour: "#d6c8ae" } },
  ribbon: { name: "Midnight and platinum", dial: { base: "#1f3a6c", finish: "sunburst", ink: "#e9edf6" }, case: { metal: "platinum", bezel: "domed" }, hands: { style: "sword", metal: "platinum" }, marks: "baton", strap: { kind: "croc", colour: "#1b2b4b" } },
  basket: { name: "Racing green, two-tone", dial: { base: "#21503d", finish: "sunburst", ink: "#f0e7c9" }, case: { metal: "gold", body: "steel", bezel: "step" }, hands: { style: "baton", metal: "gold" }, marks: "dot", strap: { kind: "suede", colour: "#274034" } },
  dial: { name: "Slate and titanium", dial: { base: "#5c626a", finish: "satin", ink: "#eef0f2" }, case: { metal: "titanium", bezel: "octagon" }, hands: { style: "alpha", metal: "steel" }, marks: "baton", strap: { kind: "rubber", colour: "#1c1e21" } },
  three: { name: "Ivory and platinum", dial: { base: "#ece3cf", finish: "grain", ink: "#2a2a44" }, case: { metal: "platinum", bezel: "coin" }, hands: { style: "spade", metal: "steel", tint: "#2f4f93" }, marks: "dot", strap: { kind: "suede", colour: "#6d7075" } },
  lines: { name: "Ice and bronze", dial: { base: "#e6e9eb", finish: "satin", ink: "#2c3136" }, case: { metal: "bronze", bezel: "smooth" }, hands: { style: "baton", metal: "bronze" }, marks: "baton", strap: { kind: "leather", colour: "#8a5a34" } },
  paris: { name: "Antique gold hobnail", dial: { base: "#7a5420", finish: "sunburst", ink: "#f4e4bb" }, case: { metal: "steel", bezel: "coin" }, hands: { style: "dauphine", metal: "steel" }, marks: "diamond", strap: { kind: "croc", colour: "#4a2a17" } },
  barley: { name: "Teal and titanium", dial: { base: "#1f4a4a", finish: "sunburst", ink: "#e6f0ea" }, case: { metal: "titanium", bezel: "fluted" }, hands: { style: "leaf", metal: "steel" }, marks: "wedge", strap: { kind: "leather", colour: "#16282a" } },
  medallion: { name: "Olive and platinum", dial: { base: "#52613f", finish: "grain", ink: "#f2f0dc" }, case: { metal: "platinum", bezel: "step" }, hands: { style: "alpha", metal: "platinum" }, marks: "dot", strap: { kind: "suede", colour: "#3c4636" } },
  registers: { name: "Burgundy and bronze", dial: { base: "#5b1f2e", finish: "satin", ink: "#f0d9c2" }, case: { metal: "bronze", bezel: "step" }, hands: { style: "leaf", metal: "bronze" }, marks: "wedge", strap: { kind: "croc", colour: "#3a1620" } },
  chrono: { name: "Glacier and steel", dial: { base: "#a9bfcc", finish: "sunburst", ink: "#1d2f3d" }, case: { metal: "steel", bezel: "fluted" }, hands: { style: "sword", metal: "steel" }, marks: "baton", strap: { kind: "rubber", colour: "#1b3550" } },
  grand: { name: "Aubergine and gold", dial: { base: "#3a2142", finish: "grain", ink: "#f1dea8" }, case: { metal: "gold", bezel: "domed" }, hands: { style: "spade", metal: "gold", tint: "#f1dea8" }, marks: "diamond", strap: { kind: "suede", colour: "#2a1d30" } },
  master: { name: "Onyx and gold", dial: { base: "#101114", finish: "satin", ink: "#ead9a4" }, case: { metal: "gold", bezel: "fluted" }, hands: { style: "dauphine", metal: "gold" }, marks: "diamond", strap: { kind: "croc", colour: "#151515" } },
};
export const watchOf = id => WATCHES[id] || WATCHES.rose;                  // the first plate's, the showpiece

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
/** How light a colour looks, 0 to 1 (Rec. 709 weights on the sRGB values, which is all this is for: choosing ink against it). */
export const luma = hex => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** The colour the target is drawn in over a dial: a deep verdigris on a light dial, a bright one on a dark. */
export const ghostOf = dial => (luma(dial) > 0.42 ? "#0d6f5c" : "#7fe8c6");
