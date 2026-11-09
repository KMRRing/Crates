// The Region setting, one control for every knowledge game that can sort its items by where they are (Korbi, 9 Nov 2026: "a
// shared resource ... flags"): the same seven choices everywhere, kept per game (`<game>:region`, so it syncs with the game's
// other keys) because Oceania in Chart shouldn't follow you into Origin. A game filters its pool with `inRegion`: an item's
// regions are the continents it belongs to (chart-countries.js's `regions`); worldwide keeps everything.
// A game whose region is already a header dropdown (Chart, Lode) keeps it and mirrors it into the menu (menu-flags.js).
import { choice } from "./menu.js";
import { IN_FRAME } from "./suite.js";

import { REGIONS, known, inRegions } from "./region-core.js";
export { REGIONS };
const key = game => `${game}:region`;

/** The game's region now: "world", or one of the six continents. */
export function regionOf(game) {
  try { const r = JSON.parse(localStorage.getItem(key(game))); return known(r) ? r : "world"; } catch { return "world"; }
}
export function setRegion(game, r) {
  if (IN_FRAME || !known(r)) return;
  try { localStorage.setItem(key(game), JSON.stringify(r)); } catch { /* private mode */ }
}
/** Whether an item in `regions` (an array of continents, or one) belongs in the region now. An item with no region is only in Worldwide. */
export const inRegion = (game, regions) => inRegions(regionOf(game), regions);
/** The menu row: Region, the same seven choices; `onChange(region)` after the choice is kept. */
export function regionControl(game, onChange) {
  return choice("Region", REGIONS, regionOf(game), r => { setRegion(game, r); onChange?.(r); });
}
