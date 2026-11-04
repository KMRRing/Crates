// What Almanac may show of kb/: with Settings' "Content marked for removal" on Exclude (the default, topics-on.js) nothing marked
// appears anywhere in it: not as a star or a search hit, not as the far end of a link (a customs code is a thing of its own, linked
// to the commodity it classifies, so the commodity's entry lists it unless the link goes), not as a number (a Quote fact carries
// its own mark). Include shows all of kb/. Pure apart from `VIEW`, so tests/almanac-marked.mjs builds the view for both settings.
// The marks are the audit's (kb/audit/marks.js, carried by kb-marks.js): kept is universal, regional and theme; any other thing,
// the living included, is out under Exclude.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { KEPT } from "./kb-marks.js";
import { markedIn } from "./topics-on.js";

/** The ids kb-marks.js keeps, as a Set. */
export const KEPT_IDS = new Set(KEPT.split(" "));

/**
 * `entities`, `links` and (when given) `quotes` as Almanac shows them. A thing that is a copy of another (`same`) is shown only
 * when both are; a link only when both its ends are; a quote only when it carries no mark. With `include` all of it stays.
 * Returns { entities, links, quotes, hidden: how many things are left out }.
 */
export function filterKb(entities, links, quotes, include, kept = KEPT_IDS) {
  if (include) return { entities, links, quotes, hidden: 0 };
  const same = new Map();
  for (const e of entities) if (e.same) same.set(e.id, e.same);
  const ok = id => kept.has(id) && (!same.has(id) || kept.has(same.get(id)));
  const shown = entities.filter(e => ok(e.id));
  return {
    entities: shown,
    links: links.filter(l => ok(l.from) && ok(l.to)),
    quotes: quotes && quotes.filter(q => !q.mk),
    hidden: entities.length - shown.length,
  };
}

/** Whether this page was built to show what is marked (it reloads when Settings changes the choice). */
export const INCLUDED = markedIn();
export const VIEW = filterKb(ENTITIES, LINKS, null, INCLUDED);
