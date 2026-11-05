// The rungs of a puzzle's hidden ramp (ramp.js; Korbi, 4 November 2026: the menu is the minimum it needs to be). A puzzle used to
// ask for a Size and a Level; now it climbs both together. `rungs(sizes, levels, ok)` lists every size-and-level pair easiest first
// ("6.medium": size 6, level medium; the two scales weighed alike), and `startFor` finds the rung nearest the pair an older save
// chose, so a player begins where they used to play.
const norm = (list, v) => Math.max(0, list.findIndex(x => String(x) === String(v)));

/** The rungs, easiest first. `ok(size, level)` drops the pairs a game doesn't offer. */
export function rungs(sizes, levels, ok = () => true) {
  const ns = Math.max(1, sizes.length - 1), nl = Math.max(1, levels.length - 1);
  return sizes.flatMap((s, i) => levels.map((l, j) => ({ key: `${s}.${l}`, d: i / ns + j / nl, i, s, l })))
    .filter(x => ok(x.s, x.l)).sort((a, b) => a.d - b.d || a.i - b.i).map(x => x.key);
}
/** The rung of `list` nearest the old choice (size, level). */
export function startFor(list, sizes, levels, size, level) {
  const key = `${size}.${level}`;
  if (list.includes(key)) return key;
  const want = norm(sizes, size) / Math.max(1, sizes.length - 1) + norm(levels, level) / Math.max(1, levels.length - 1);
  const d = k => { const at = k.lastIndexOf("."); return norm(sizes, k.slice(0, at)) / Math.max(1, sizes.length - 1) + norm(levels, k.slice(at + 1)) / Math.max(1, levels.length - 1); };
  return list.reduce((best, k) => (Math.abs(d(k) - want) < Math.abs(d(best) - want) ? k : best), list[0]);
}
/** A rung as { size, level }; size comes back as the string it was listed as, so a game turns it into a number if it needs to. */
export const split = k => { const at = k.lastIndexOf("."); return { size: k.slice(0, at), level: k.slice(at + 1) }; };
