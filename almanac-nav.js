// Where you are in the Almanac, as plain data: the address (what `#…` says), the trail through entries inside the sky's
// popup, and the arrow keys through what a search found. Pure, so Node tests them and the page only draws what they say.
//
// The address:   (nothing) or #sky   the star chart, no entry open
//                #e=<id>             the star chart with that entry's popup
//                #list               the list view
//                #list&e=<id>        the list view, that entry open

/** What an address says: { list, e }. Anything it does not know is left out, so a damaged address is the star chart. */
export function parseHash(hash) {
  const p = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  return { list: p.has("list"), e: p.get("e") || null };
}
/** The address for a view: parseHash(formatHash(v)) is v. The star chart with nothing open is an empty address. */
export function formatHash({ list = false, e = null } = {}) {
  const p = [];
  if (list) p.push("list");
  if (e) p.push(`e=${encodeURIComponent(e)}`);
  return p.length ? `#${p.join("&")}` : "";
}

/**
 * The entries read in one popup, one after another: following a link goes on, Back goes back along them. Going to the
 * entry already showing is not a step; the trail keeps the last `max`, and a fresh start (a tap on a star, a search) is
 * a new trail.
 */
export function createTrail(max = 40) {
  let ids = [];
  return {
    start(id) { ids = id ? [id] : []; },
    go(id) {
      if (!id || ids[ids.length - 1] === id) return;
      ids.push(id);
      if (ids.length > max) ids.shift();
    },
    /** One step back: the entry now showing, or null when there is nowhere to go (the first entry stays). */
    back() { if (ids.length > 1) ids.pop(); return ids[ids.length - 1] ?? null; },
    get current() { return ids[ids.length - 1] ?? null; },
    get previous() { return ids.length > 1 ? ids[ids.length - 2] : null; },
    get canBack() { return ids.length > 1; },
    get depth() { return ids.length; },
    list: () => [...ids],
  };
}

/** The highlighted result after a key, among `count` results (-1 for none yet): the arrows walk, and stop at the ends. */
export function stepHit(index, key, count) {
  if (count <= 0) return -1;
  if (key === "ArrowDown") return Math.min(count - 1, index + 1);
  if (key === "ArrowUp") return index <= 0 ? 0 : index - 1;
  return index;
}
/** The result Enter takes: the one highlighted, else the first. */
export const hitFor = (index, count) => (count <= 0 ? -1 : index >= 0 && index < count ? index : 0);
