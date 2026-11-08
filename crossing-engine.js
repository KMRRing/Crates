// Crossing's rules, pure (crossing.js draws them; tests/crossing.mjs runs them): the land graph (countries, and who shares
// a border with whom, from chart-countries.js, which has them from the source's topology), a route's shortest crossing,
// a run's deal by level, the steps you take and what a route scores.
// A route runs from one country to another, one land border at a time. Par is the fewest borders crossed; the score is
// 100 at par, 15 off for each border beyond it and 8 off for each tap on a country that doesn't touch the one you're in.
// Islands (the countries with no land neighbour) are out of the land game; the sea is the other mode's.
import { COUNTRIES } from "./chart-countries.js";

export const ROUTES = 5;                          // routes a run
export const LEVELS = ["easy", "medium", "hard"];
export const PAR_RANGE = { easy: [3, 4], medium: [5, 7], hard: [8, 12] };   // borders in the shortest crossing, by level
export const EXTRA = 15, MISTAKE = 8, FULL = 100;
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the graph ----------
const BY_NAME = new Map(COUNTRIES.map(c => [c.name, c]));
/** Who shares a border with whom: names known to the map only (the source's Western Sahara is inside Morocco's outline here). */
const ADJ = new Map(COUNTRIES.map(c => [c.name, c.neighbours.filter(n => BY_NAME.has(n))]));
export const countryOf = name => BY_NAME.get(name) || null;
export const neighbours = name => ADJ.get(name) || [];
export const touches = (a, b) => neighbours(a).includes(b);

/** Every country's distance in borders from `from` (a Map; countries it can't reach are absent). Breadth first. */
export function distances(from) {
  const d = new Map([[from, 0]]), queue = [from];
  for (let i = 0; i < queue.length; i++) for (const n of neighbours(queue[i])) if (!d.has(n)) { d.set(n, d.get(queue[i]) + 1); queue.push(n); }
  return d;
}
const MAIN = (() => {                              // the one big piece of land: Eurasia, Africa and the Americas, joined at Sinai and Darién
  let best = [];
  const seen = new Set();
  for (const name of ADJ.keys()) {
    if (seen.has(name)) continue;
    const part = [...distances(name).keys()];
    part.forEach(n => seen.add(n));
    if (part.length > best.length) best = part;
  }
  return new Set(best);
})();
/** The countries the land game uses: those on the big piece of land. */
export const LAND = [...MAIN].sort();
export const onLand = name => MAIN.has(name);

/** One shortest crossing from a to b, the countries in order, both ends included (null when there is no land route). Ties go to
 *  the alphabetically first neighbour, so it is the same everywhere. */
export function shortest(a, b) {
  const d = distances(b);                          // from the goal: every step then goes to a neighbour one nearer
  if (!d.has(a)) return null;
  const path = [a];
  while (path.at(-1) !== b) {
    const here = path.at(-1);
    path.push([...neighbours(here)].filter(n => d.get(n) === d.get(here) - 1).sort()[0]);
  }
  return path;
}
/** Par: the fewest borders to cross from a to b. */
export const parOf = (a, b) => distances(a).get(b) ?? null;

// ---------- a deal ----------
/** A run: five routes of the level, no country twice among the starts and goals. Same seed, same run. */
export function dealRun(seed, level = "medium") {
  const [lo, hi] = PAR_RANGE[level] || PAR_RANGE.medium, r = rng(seed), used = new Set(), routes = [];
  const starts = shuffle(r, LAND);
  for (const from of starts) {
    if (routes.length === ROUTES) break;
    if (used.has(from)) continue;
    const d = distances(from);
    const goals = shuffle(r, LAND.filter(g => !used.has(g) && d.get(g) >= lo && d.get(g) <= hi));
    if (!goals.length) continue;
    routes.push({ from, to: goals[0], par: d.get(goals[0]) });
    used.add(from); used.add(goals[0]);
  }
  return { level, seed, routes };
}

// ---------- a route in play ----------
/** A route begun: you stand in `from`, nothing crossed. */
export const begin = ({ from, to, par }) => ({ from, to, par, path: [from], mistakes: 0, over: false, gaveUp: false });
/** Where you stand. */
export const here = route => route.path.at(-1);
/** The country tapped: a neighbour of where you stand takes you into it (reaching the goal ends the route); anything else is a
 *  mistake, which costs. Returns the route after, with `note` saying what happened: "step", "arrived", "mistake" or "again"
 *  (the country you're already in) or "closed" (the route is over). */
export function cross(route, name) {
  if (route.over) return { ...route, note: "closed" };
  const at = here(route);
  if (name === at) return { ...route, note: "again" };
  if (!touches(at, name)) return { ...route, mistakes: route.mistakes + 1, note: "mistake" };
  const path = [...route.path, name];
  return name === route.to ? { ...route, path, over: true, note: "arrived" } : { ...route, path, note: "step" };
}
/** One step back (a route's start can't be stepped back from). Costs nothing. */
export const back = route => (route.over || route.path.length < 2 ? route : { ...route, path: route.path.slice(0, -1) });
/** The route given up on: it ends unsolved. */
export const giveUp = route => ({ ...route, over: true, gaveUp: true });

/** Borders crossed so far. */
export const crossed = route => route.path.length - 1;
/** What a route scored: 100 at par, less 15 a border beyond it and 8 a mistake; nothing for a route given up. */
export function scoreOf(route) {
  if (route.gaveUp || !route.over) return 0;
  return Math.max(0, FULL - EXTRA * (crossed(route) - route.par) - MISTAKE * route.mistakes);
}
/** True when the route reached the goal at par with no mistake. */
export const clean = route => route.over && !route.gaveUp && crossed(route) === route.par && route.mistakes === 0;
/** A run's total (each route 100 at most). */
export const totalOf = routes => routes.reduce((s, r) => s + scoreOf(r), 0);
