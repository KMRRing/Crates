// Manifest's levels, pure (no page): a ladder of short runs in chapters, each chapter bringing one thing to the one before
// (a cargo, a rule, a kind of question, the change rounds). A level is a recipe (manifest-engine.js, levelOf) and a few
// rounds: the first time it is the same run for everyone (the level's own seed), and a replay is another from the same
// recipe, so a level can be played again for its stars. Stars: 1 for coming through all its rounds with a life to spare,
// 2 for no more than one wrong answer and three quarters of the questions right, 3 for every question right (a pass
// is not a wrong answer, but it is not right). A level opens when the one before it has a star; any open level can be
// played at any time, and a level once open stays open.

/** What a step of a chapter is: the stack's size, how many questions, the hold, how many rounds, and how many wrong answers
 *  end the run (`lives`). Each chapter has four steps, easy to hard. */
const STEPS = [
  { x: 3, y: 2, z: 2, orders: 2, exposure: 9000, rounds: 3, lives: 4 },
  { x: 3, y: 3, z: 2, orders: 3, exposure: 8500, rounds: 3, lives: 4 },
  { x: 3, y: 3, z: 3, orders: 3, exposure: 8000, rounds: 4, lives: 3 },
  { x: 4, y: 3, z: 3, orders: 4, exposure: 7500, rounds: 5, lives: 3 },
];
const BASIC = ["count", "total", "tier", "spot", "top", "most"];
const ALL = ["layers", "all", "slices", "pair"];

/**
 * The chapters: `types` the cargo in play, `kinds` the questions it may ask, `want` the ones it tries to carry in every round
 * the view allows, `views` the views that take turns, `x`, `y` and `z` the floor's width, depth and the quay's tiers where the chapter changes them, `logs` how many logs of timber each step has at least (a floor of fewer than seven columns holds none, so a chapter with timber gives its first step the floor for one), `changes` the
 * change rounds of each step (round number: "ware" | "turned" | "swap"), `names` its four levels.
 */
const CHAPTER_SPECS = [
  { name: "Crates and barrels", about: "Heavy goes low: a crate can carry crates and barrels, a barrel carries only barrels. Count, and say what stood where.",
    types: [1, 2], kinds: BASIC, want: [], views: ["layers", "all", "layers", "all"], names: ["First load", "Two tiers", "Behind the stack", "The wharf"] },
  { name: "Timber", about: "Oak comes as logs, each lying across two cells end to end. Layers of logs cross, and carry crates and barrels too. Now the stack may be shown turned.",
    types: [1, 2, 3], kinds: [...BASIC, "turned"], want: [], views: ["layers", "all", "slices", "all"], x: [4, 3, 3, 4], names: ["Logs ashore", "Crossed layers", "The raft", "Timber yard"] },
  { name: "Ingots", about: "Piles of ingots weigh eight hundredweight, the most so far, and carry almost anything. Weigh what you saw: the question tells you what each weighs.",
    types: [1, 2, 3, 4], kinds: [...BASIC, "turned", "weight"], want: ["weight"], views: ["layers", "all", "slices", "pair"], names: ["Ballast", "Bar iron", "Heavy goods", "The foundry"] },
  { name: "Chests", about: "A chest goes last: its lid is domed and nothing stands on it. Between two of one kind, what you cannot see is that kind.",
    types: [1, 2, 3, 4, 5], kinds: [...BASIC, "turned", "weight", "column"], want: ["column"], views: ["all", "layers", "all", "slices"], z: [3, 3, 3, 3], names: ["The strongbox", "Under lock", "Hidden below", "The treasury"] },
  { name: "Sacks", about: "Sacks are the lightest: they stand on anything but a chest and carry only sacks. Put a price on the stack: what it was worth.",
    types: [1, 2, 3, 4, 5, 6], kinds: [...BASIC, "turned", "weight", "worth", "column"], want: ["worth"], views: ["layers", "all", "pair", "slices"], names: ["Salt sacks", "Light cargo", "A cheap hold", "The market"] },
  { name: "Changes", about: "The stack goes aboard and comes back with something different: one piece changed, turned round, or two swapped.",
    types: [1, 2, 3, 4, 5, 6], kinds: [...BASIC, "turned", "weight", "worth"], want: [], views: ["layers", "all", "slices", "all"], names: ["Something's different", "A new angle", "Swapped about", "The night watch"],
    changes: [{ 3: "ware" }, { 3: "turned" }, { 2: "ware", 4: "swap" }, { 2: "ware", 4: "turned", 5: "swap" }] },
  { name: "Loads", about: "What a piece bears, and what room is left: a column may carry only so much, and the quay stacks only so high.",
    types: [1, 2, 3, 4, 5, 6], kinds: [...BASIC, "weight", "worth", "load", "fits"], want: ["load", "fits"], views: ["layers", "slices"], z: [3, 3, 4, 4], names: ["What it bears", "Room aloft", "Tall stacks", "The tallest tier"] },
  { name: "The quay master", about: "Everything together, every kind of question, and the stack shown any way round.",
    types: [1, 2, 3, 4, 5, 6], kinds: [...BASIC, "turned", "which", "weight", "worth", "load", "fits", "column"], want: [], views: ALL, names: ["Morning tally", "Busy quay", "The harbour master", "The whole manifest"],
    changes: [{}, { 3: "ware" }, { 4: "turned" }, { 5: "swap" }] },
  // the two chapters after the quay master were added later, at the end, so that the stars already won (kept by level number) keep their levels
  { name: "White timber", about: "A second tree: birch logs, slender and pale with dark marks, lighter than oak and heavier than a crate. They lie in crossing layers like oak and go between oak and crates.",
    types: [1, 2, 3, 4, 5, 6, 8], kinds: [...BASIC, "turned", "weight", "worth", "load", "column"], want: ["weight"], views: ["layers", "all", "slices", "pair"], names: ["Silver birch", "Two trees", "The sawmill", "Pale and dark"],
    changes: [{}, { 3: "ware" }, { 4: "turned" }, { 3: "ware", 5: "swap" }] },
  { name: "Gold", about: "Gold ingots weigh the most and are worth the most: they stand only on the quay or on more gold. Same shape as the ingots, richer, with a crown stamped on top.",
    types: [1, 2, 3, 4, 5, 6, 7, 8], kinds: [...BASIC, "turned", "weight", "worth", "load", "fits", "column"], want: ["worth", "weight"], views: ["layers", "all", "slices", "pair"], z: [3, 3, 3, 4], names: ["A glint", "The strongroom", "Bullion", "The royal hoard"],
    changes: [{}, { 3: "ware" }, { 2: "turned", 4: "swap" }, { 2: "ware", 4: "turned", 5: "swap" }] },
  // the chapter after the two above, again at the end so that the stars already won keep their levels: a yard heavy with timber, once both trees are known
  { name: "Timber yard", about: "A quay stacked with logs, end to end along their layer: count a log once, and the key gives what a whole log weighs.",
    types: [1, 2, 3, 4, 5, 6, 8], kinds: [...BASIC, "turned", "weight", "worth", "load", "column"], want: ["weight"], views: ["layers", "all", "slices", "pair"], y: [3, 3, 3, 3], z: [2, 3, 3, 3],
    logs: [2, 2, 2, 3], names: ["A long log", "End to end", "The spar yard", "Masts and spars"],
    changes: [{}, { 3: "ware" }, { 4: "turned" }, { 3: "ware", 5: "swap" }] },
];

/** The chapters: where each begins in LEVELS, its name and what it brings. */
export const CHAPTERS = CHAPTER_SPECS.map((c, k) => ({ name: c.name, about: c.about, from: k * STEPS.length, types: c.types }));
/** The levels: { name, chapter, step, rounds, lives, recipe (the base of every round), changes }. */
export const LEVELS = CHAPTER_SPECS.flatMap((c, k) => STEPS.map((s, step) => ({
  name: c.names[step], chapter: k, step, rounds: s.rounds, lives: s.lives, changes: c.changes?.[step] || {},
  recipe: { x: c.x?.[step] ?? s.x, y: c.y?.[step] ?? s.y, z: c.z?.[step] ?? s.z, types: c.types, kinds: c.kinds, want: c.want, views: c.views, orders: s.orders, exposure: s.exposure, change: null, ...(c.logs ? { logs: c.logs[step] } : {}) },
})));
export const COUNT = LEVELS.length;
/** The chapter a level is in. */
export const chapterOf = i => LEVELS[i].chapter;
/** A level's own seed: the run everyone gets the first time. */
export const seedOf = i => 4001 + 7919 * i;

/** The recipe of round k (1 on) of level i: its base, and a change round where the level has one. */
export function recipeAt(i, k) {
  const L = LEVELS[i], change = L.changes[k] || null;
  return { ...L.recipe, change, orders: change ? 1 : L.recipe.orders };
}

// ---------- the stars ----------
/** Stars for a run of a level: tally is { right, wrong, passed } over its questions; 0 if the lives ran out first. */
export function starsFor(i, tally) {
  const { right = 0, wrong = 0, passed = 0 } = tally, asked = right + wrong + passed;
  if (!asked || wrong >= LEVELS[i].lives) return 0;
  return wrong === 0 && passed === 0 ? 3 : wrong <= 1 && right >= Math.ceil(asked * 0.75) ? 2 : 1;
}

// ---------- the campaign as kept (manifest:camp) ----------
export const CAMP_VERSION = 1;
/** The campaign mended into what it should be: { v, at (the level in hand), stars (0 to 3 for each level), played (how many
 *  times each has been started: the first time is everyone's run, the rest are fresh ones) }. */
export function mendCamp(c) {
  const stars = LEVELS.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const played = LEVELS.map((_, k) => (Number.isInteger(c?.played?.[k]) && c.played[k] > 0 ? c.played[k] : stars[k] ? 1 : 0));
  const open = stars.findIndex(s => s < 1), last = open < 0 ? COUNT - 1 : open;      // the first level not yet passed is the last one open
  return { v: CAMP_VERSION, at: Number.isInteger(c?.at) ? Math.max(0, Math.min(c.at, last)) : 0, stars, played };
}
/** Whether a level is open: the first, or one whose predecessor has a star. */
export const isOpen = (camp, n) => n === 0 || camp.stars[n - 1] >= 1;
