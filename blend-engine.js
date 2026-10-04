// Blend: a competitor's sample is a secret blend of known components. You submit trial blends; the lab compares
// each to the sample on a few properties and says only higher, lower or the same. Find the recipe in as few trials
// as you can. Blends mix linearly by volume (near enough for a game), so the component table is all you need to
// reason with.

export const COMPONENTS = [
  { id: "fossil", name: "Fossil diesel", density: 835, sulphur: 8, cetane: 51, cloud: -5 },
  { id: "hvo", name: "HVO", density: 780, sulphur: 1, cetane: 75, cloud: -20 },
  { id: "rme", name: "RME", density: 883, sulphur: 3, cetane: 54, cloud: -3 },
  { id: "ucome", name: "UCOME", density: 880, sulphur: 5, cetane: 56, cloud: 1 },
  { id: "gtl", name: "GTL", density: 778, sulphur: 1, cetane: 80, cloud: -10 },
  { id: "tme", name: "Tallow ME", density: 875, sulphur: 5, cetane: 60, cloud: 12 },
];
// the lab is precise: "the same" means equal to within a hair, so only the secret reads the same on every property
export const PROPS = {
  density: { name: "Density", unit: "kg/m³", tol: 0.05 },
  sulphur: { name: "Sulphur", unit: "ppm", tol: 0.02 },
  cetane: { name: "Cetane", unit: "", tol: 0.02 },
  cloud: { name: "Cloud point", unit: "°C", tol: 0.02 },
};
export const LEVELS = {
  easy: { label: "Easy", comps: 3, props: 2, step: 10 },
  medium: { label: "Medium", comps: 3, props: 3, step: 5 },
  hard: { label: "Hard", comps: 4, props: 2, step: 10 },
  expert: { label: "Expert", comps: 4, props: 3, step: 5 },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mix = (a, b) => (Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 1, 0xC2B2AE35)) >>> 0;
function shuffle(r, xs) { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Every recipe on the grid: fractions in steps of `step` percent that sum to 100, as arrays. */
export function recipes(n, step) {
  const out = [], parts = 100 / step;
  const rec = (i, left, acc) => {
    if (i === n - 1) { out.push([...acc, left * step]); return; }
    for (let k = 0; k <= left; k++) rec(i + 1, left - k, [...acc, k * step]);
  };
  rec(0, parts, []);
  return out;
}
/** A blend's reading of a property. */
export const reading = (comps, recipe, prop) => recipe.reduce((t, f, i) => t + f / 100 * comps[i][prop], 0);
/** The lab's verdict on a trial against the secret: per property, 1 (higher), -1 (lower) or 0 (the same within tolerance). */
export function compare(puzzle, trial) {
  return puzzle.props.map(p => {
    const d = reading(puzzle.comps, trial, p) - reading(puzzle.comps, puzzle.secret, p);
    return Math.abs(d) <= PROPS[p].tol ? 0 : d > 0 ? 1 : -1;
  });
}
const same = (a, b) => a.every((v, i) => v === b[i]);

/**
 * A puzzle: { level, comps, props, secret, step, all (every recipe), par }. The components and properties are
 * drawn so that no two recipes read the same on every property (else the lab could never tell them apart).
 */
export function makePuzzle(seed, levelId) {
  const L = LEVELS[levelId], r = rng(mix(seed, Object.keys(LEVELS).indexOf(levelId)));
  for (let attempt = 0; attempt < 200; attempt++) {
    const comps = shuffle(r, COMPONENTS).slice(0, L.comps);
    const props = shuffle(r, Object.keys(PROPS)).slice(0, L.props);
    const all = recipes(L.comps, L.step);
    // every pair of recipes must differ beyond tolerance on some property
    const reads = all.map(rec => props.map(p => reading(comps, rec, p)));
    let distinct = true;
    for (let i = 0; i < all.length && distinct; i++) for (let j = i + 1; j < all.length; j++) {
      if (props.every((p, k) => Math.abs(reads[i][k] - reads[j][k]) <= PROPS[p].tol)) { distinct = false; break; }
    }
    if (!distinct) continue;
    const secret = all[Math.floor(r() * all.length)];
    const puzzle = { level: levelId, comps, props, secret, step: L.step, all };
    puzzle.par = solve(puzzle).length;
    return puzzle;
  }
  throw new Error("couldn't make a puzzle");
}

/**
 * A solver that always submits the trial splitting the remaining candidates most evenly (the fewest left in the
 * worst case), starting from the recipe nearest the middle. Its trial count is the puzzle's par.
 */
export function solve(puzzle) {
  let cands = puzzle.all;
  const trials = [];
  const first = puzzle.all.reduce((best, rec) => (spread(rec) < spread(best) ? rec : best), puzzle.all[0]);
  let trial = first;
  for (let k = 0; k < 20; k++) {
    const fb = compare(puzzle, trial);
    trials.push({ recipe: trial, feedback: fb });
    if (fb.every(v => v === 0)) return trials;
    cands = cands.filter(c => same(compare({ ...puzzle, secret: c }, trial), fb));
    if (cands.length === 1) { trials.push({ recipe: cands[0], feedback: puzzle.props.map(() => 0) }); return trials; }
    // the next trial: a recipe whose worst-case bucket among the candidates is smallest (candidates first, then any)
    let best = null, bestWorst = Infinity;
    for (const t of [...cands, ...puzzle.all]) {
      const buckets = {};
      for (const c of cands) { const key = compare({ ...puzzle, secret: c }, t).join(","); buckets[key] = (buckets[key] || 0) + 1; }
      const worst = Math.max(...Object.values(buckets)) - (cands.includes(t) ? 0.5 : 0);
      if (worst < bestWorst) { bestWorst = worst; best = t; }
    }
    trial = best;
  }
  return trials;
}
const spread = rec => rec.reduce((t, f) => t + Math.abs(f - 100 / rec.length), 0);
