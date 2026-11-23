// Settle's levels: the book (settle-book.js, made by settle-plan.mjs from its plan), and the melts made on the device for Random and
// Today's. A level is { id, ch, name, tip, caps, fill (each crucible foot to top), moulds (mould ids), par, seed }. Every level is
// made the same way: the moulds' measures dropped at random into the crucibles, kept only when the solver says it is a puzzle
// (`gradeOf`): it can be won, nothing casts before a move, and the par is in the row's range; from the third level on, at most two
// first moves keep the par and a greedy player (cast when you can, else anything) almost never makes it.
import { levelOf, startOf, solve, movesOf, pour, keyOf, won } from "./settle-engine.js";
import { mouldOf, CHAPTERS, METALS } from "./settle-alloys.js";
import { BOOK } from "./settle-book.js";

export { CHAPTERS };
export const LEVELS = BOOK;
export const levelById = id => LEVELS.find(L => L.id === id) || null;
export const chapterOf = L => CHAPTERS.find(c => c.id === L.ch) || null;
/** The engine's level of a book level or a melt. */
export const playOf = L => levelOf({ caps: L.caps, fill: L.fill, moulds: L.moulds.map(id => mouldOf(id).parts), kinds: L.kinds });

const rng = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
/**
 * A row's crucibles filled at random from a seed: { caps, fill, moulds, kinds? }. row: { moulds, caps (one per crucible), and from
 * the later chapters kinds (each "", "slag" or "teapot"), extra (spare measures no mould takes: dross among them), cover (the
 * crucibles that hold charcoal), raw (the measures to drop, when they are not the moulds' own: the liquation's lead and black
 * copper) }. A slag pot starts empty; zinc starts only under charcoal; lead and black copper never start together.
 */
export function fillOf(row, seed) {
  const r = rng(seed * 7919 + 17);
  const measures = (row.raw || row.moulds.flatMap(id => Object.entries(mouldOf(id).parts).flatMap(([m, n]) => Array(n).fill(m)))).concat(row.extra || []);
  for (let i = measures.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [measures[i], measures[j]] = [measures[j], measures[i]]; }
  const kinds = row.kinds || row.caps.map(() => ""), cover = new Set(row.cover || []);
  const fill = row.caps.map((_, i) => (cover.has(i) ? ["C"] : []));
  const fits = (i, m) => kinds[i] !== "slag" && fill[i].length < row.caps[i] && (m !== "Zn" || cover.has(i))
    && !(m === "Pb" && fill[i].includes("Bk")) && !(m === "Bk" && fill[i].includes("Pb"));
  for (const m of measures) {
    const open = fill.map((_, i) => i).filter(i => fits(i, m));
    if (!open.length) return null;
    fill[open[Math.floor(r() * open.length)]].push(m);
  }
  for (const f of fill) f.sort((a, b) => METALS[b].dens - METALS[a].dens);        // as it lies: the heaviest at the foot
  return { caps: row.caps.slice(), fill, moulds: row.moulds.slice(), ...(row.kinds ? { kinds: row.kinds.slice() } : {}) };
}
/**
 * How good a puzzle a filled level is: { ok, par, best (first moves that keep the par), of (first moves), greedy (of 20 greedy
 * plays, those that made the par) }. strict: the two checks of a real puzzle (few right first moves; greed fails); "best" the first
 * only (the first small levels, where greed can't miss); false none.
 */
export function gradeOf(spec, par = [1, 99], strict = true) {
  const L = playOf(spec), s = startOf(L);
  if (s.cast.some(Boolean)) return { ok: false };
  const sv = solve(L, s);
  if (!isFinite(sv.par) || sv.par < par[0] || sv.par > par[1]) return { ok: false, par: sv.par };
  const firsts = movesOf(L, s).map(([a, b]) => sv.toWin.get(keyOf(pour(L, s, a, b).state)));
  const best = firsts.filter(v => v === sv.par - 1).length;
  const r = rng(sv.states + 3);
  let greedy = 0;
  for (let g = 0; g < 20; g++) {
    let st = s, n = 0;
    while (!won(st) && n < sv.par) {
      const ms = movesOf(L, st), casting = ms.filter(([a, b]) => pour(L, st, a, b).casts.length), pool = casting.length ? casting : ms;
      if (!pool.length) break;
      st = pour(L, st, ...pool[Math.floor(r() * pool.length)]).state; n++;
    }
    if (won(st)) greedy++;
  }
  return { ok: strict === false || (best <= 2 && (strict === "best" || greedy <= 2)), par: sv.par, best, of: firsts.length, greedy, states: sv.states };
}
/**
 * A row made a puzzle: the first seed from `from` that does it, or with `hardest` the one of `tries` seeds with the highest par in
 * the row's range (then the fewest right first moves): the level, or null.
 */
export function makeLevel(row, from = 1, tries = 4000, hardest = false) {
  let best = null, bg = null;
  tries = row.tries || tries;
  for (let seed = from; seed < from + tries; seed++) {
    const spec = fillOf(row, seed);
    if (!spec) continue;
    const g = gradeOf(spec, row.par, row.strict ?? true);
    if (!g.ok) continue;
    if (!hardest) return { ...spec, par: g.par, seed };
    if (!bg || g.par > bg.par || (g.par === bg.par && g.best < bg.best)) { best = { ...spec, par: g.par, seed }; bg = g; }
  }
  return best;
}

// ---------- Random and Today's: a melt made on the device ----------
// The melts climb a hidden ramp of six rungs, from a chapter-one melt to a chapter-three one; a seed makes the same melt on every
// device, so today's is everyone's.
export const MELTS = [
  { ch: 1, par: [3, 5], rows: [[["Pb2", "Cu2", "Sn2"], [3, 3, 3]], [["plumber", "Cu2", "Sn2"], [4, 4, 4]]] },
  { ch: 1, par: [5, 7], rows: [[["plumber", "plumber", "Cu2"], [4, 4, 4]], [["Pb2", "Cu2", "Sn3"], [3, 3, 3]], [["plumber", "Pb2", "Cu2", "Sn2"], [4, 4, 4]]] },
  { ch: 2, par: [5, 7], rows: [[["hard", "fine"], [4, 4, 4]], [["speculum", "plumber", "Sn2"], [4, 4, 4]], [["fine", "fine", "Cu2"], [3, 3, 3]]] },
  { ch: 2, par: [6, 9], rows: [[["speculum", "bell", "plumber"], [4, 4, 4]], [["plumber", "fine", "pewter"], [4, 4, 4, 4]], [["fine", "fine", "Cu2"], [3, 3, 3]]] },
  { ch: 3, par: [6, 9], rows: [[["pewter", "bell"], [5, 5, 2]], [["speculum", "fine", "Pb1"], [2, 4, 4]], [["bell", "fine", "plumber"], [5, 3, 3]]] },
  { ch: 3, par: [8, 11], rows: [[["bell", "fine", "plumber"], [5, 3, 3]], [["pewter", "speculum", "fine"], [2, 2, 4, 5]], [["fine", "bell", "pewter"], [5, 4, 3, 2]], [["pewter", "hard", "fine", "plumber"], [5, 4, 4]]] },
];
/** Today's melt: from every row of the last four rungs (an alloy or a measure; so many that days side by side differ), par 6 to 10. */
export const DAILY = { ch: 3, par: [6, 10], rows: MELTS.slice(2).flatMap(M => M.rows) };
/** A melt on rung `k` of the ramp (or "daily") from a seed: a level with id "melt". */
export function meltOf(k, seed) {
  const M = k === "daily" ? DAILY : MELTS[Math.max(0, Math.min(MELTS.length - 1, k))], r = rng(seed + 101);
  for (let t = 0; t < 12; t++) {
    const [moulds, caps] = M.rows[Math.floor(r() * M.rows.length)];
    const from = (Math.imul((seed ^ Math.imul(t + 1, 0x9e3779b9)) >>> 0, 2654435761) >>> 0) % 1e9;     // far apart for days side by side
    const L = makeLevel({ moulds, caps, par: M.par }, from, 60);
    if (L) return { id: "melt", ch: M.ch, name: "Melt", tip: "", ...L };
  }
  return { ...LEVELS[0], id: "melt" };                  // (never yet: every rung finds one in its first tries)
}
