// Brut's blind tasting: a flight of six wines, each revealed stage by stage (sight, nose, palate, conclusions);
// call it from six candidates as early as you dare. Points fall with each stage you needed and each wrong call.
import { WINES } from "./brut-data.js";

export const STAGES = ["Sight", "Nose", "Palate", "Conclusions"];
export const BASE = [100, 70, 45, 25];        // a right call at each stage
export const WRONG = 15;                       // each wrong call
export const FLIGHT = 6, OPTIONS = 6;
export const points = (stage, wrongs) => Math.max(0, BASE[stage] - WRONG * wrongs);
export const SWEET = ["dry", "off-dry", "medium", "sweet", "luscious"];
export const LEVEL = ["none", "low", "medium−", "medium", "medium+", "high"];
export const byId = new Map(WINES.map(w => [w.id, w]));

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (r, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };

/** A flight: six different wines in a seeded order, at least two whites and two reds. */
export function pickFlight(seed, n = FLIGHT) {
  const r = rng(seed);
  for (let tries = 0; tries < 50; tries++) {
    const pick = shuffle(r, [...WINES]).slice(0, n);
    const whites = pick.filter(w => w.colour === "white").length, reds = pick.filter(w => w.colour === "red").length;
    if (whites >= 2 && reds >= 2) return pick.map(w => w.id);
  }
  return shuffle(r, [...WINES]).slice(0, n).map(w => w.id);
}

/** How unlike two wines are on the palate: the distance a taster would have to bridge. */
const unlike = (a, b) => Math.abs(a.sweet - b.sweet) * 1.5 + Math.abs(a.acid - b.acid) + Math.abs(a.tannin - b.tannin) * 1.2 + Math.abs(a.alc - b.alc) + Math.abs(a.body - b.body) + (a.sparkling !== b.sparkling ? 3 : 0) + (a.fortified !== b.fortified ? 3 : 0);
const grapeOf = w => w.grape.split(/,| and /)[0].trim();

/**
 * The six candidates for a wine: itself, the same grape from elsewhere (one at most), the three most alike in
 * the same colour, and the rest at random from that colour; a rosé draws on the reds too. Seeded per wine.
 */
export function optionsFor(w, seed) {
  const r = rng(seed ^ w.id.length * 2654435761);
  const pool = WINES.filter(x => x.id !== w.id && (x.colour === w.colour || (w.colour === "rosé" && x.colour === "red")));
  const out = [];
  const sibling = shuffle(r, pool.filter(x => grapeOf(x) === grapeOf(w)))[0];
  if (sibling) out.push(sibling);
  const near = pool.filter(x => !out.includes(x)).sort((a, b) => unlike(w, a) - unlike(w, b) || r() - 0.5).slice(0, 3);
  out.push(...near);
  out.push(...shuffle(r, pool.filter(x => !out.includes(x))).slice(0, OPTIONS - 1 - out.length));
  return shuffle(r, [w, ...out.slice(0, OPTIONS - 1)]).map(x => x.id);
}

/** The note as text, all stages: for a review card. */
export function noteText(w) {
  const t = w.tannin ? `, ${LEVEL[w.tannin]} tannin` : "";
  return `Sight: ${w.sight}. Nose: ${w.nose.join(", ")}. Palate: ${SWEET[w.sweet]}, ${LEVEL[w.acid]} acidity${t}, ${LEVEL[w.alc]} alcohol, ${LEVEL[w.body]} body; ${w.finish} finish.`;
}
