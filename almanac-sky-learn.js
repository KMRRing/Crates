// How brightly each star burns: from the pile (pile.js), the shared record of what you missed and are bringing back until you
// know it. Pure: the page hands it the pile's items, and tests hand it made-up ones. The pile only ever holds what was
// MISSED (a clue you got wrong or passed, a pin you were far from, a question you staked little on): the things you have
// "met" are the things you once had to be told, and they light as you learn them. What you always got right is not in it, so
// it stays dim; the sky shows what you worked at, not everything you know.
//
// A pile item names the things it is about (`about`: kb/ ids). Per item:
//   learned                 1     right again in the longest pile
//   the longest pile        0.9   (a three-month gap passed: all but learned)
//   longer, long            0.76, 0.58
//   medium, short           0.42, 0.3
//   ultra-short             0.2   just missed
// A thing with several items burns as brightly as its best. A thing that has an item due now and not yet learned twinkles:
// it is the one to go back to.

export const LEVEL = [0.2, 0.3, 0.42, 0.58, 0.76, 0.9];
export const LEARNED = 1;

/** The grade of one pile item, 0..1. */
export function gradeOf(item) {
  if (item.learned) return LEARNED;
  const p = Number.isInteger(item.pile) ? Math.max(0, Math.min(LEVEL.length - 1, item.pile)) : 0;
  return LEVEL[p];
}

/**
 * Every thing the pile has anything on: Map id → { lit, twinkle }.
 * `canon` maps a thing's id to the id of the star that stands for it (a duplicate in kb/ is the one it points at);
 * `known` says whether an id is a star at all (an item may be about something kb/ no longer has).
 */
export function glowOf(items, { canon = id => id, known = () => true, now = Date.now() } = {}) {
  const out = new Map();
  for (const it of items) {
    if (!it || !Array.isArray(it.about)) continue;
    const g = gradeOf(it), twinkle = !it.learned && Number.isFinite(it.due) && it.due <= now && (it.pile ?? 0) <= 1;
    for (const raw of it.about) {
      const id = canon(raw);
      if (typeof id !== "string" || !known(id)) continue;
      const at = out.get(id) || out.set(id, { lit: 0, twinkle: false }).get(id);
      if (g > at.lit) at.lit = g;
      if (twinkle) at.twinkle = true;
    }
  }
  return out;
}

/** The glow as it is kept for a partner watching (their copy of the pile is theirs, not yours): { id: percent }, negative when it twinkles. */
export function encodeGlow(map) {
  const o = {};
  for (const [id, g] of map) o[id] = (g.twinkle ? -1 : 1) * Math.max(1, Math.round(g.lit * 100));
  return o;
}
/** …and back, from whatever was kept (anything may be in a saved key). */
export function decodeGlow(saved) {
  const out = new Map();
  if (!saved || typeof saved !== "object") return out;
  for (const [id, v] of Object.entries(saved)) if (Number.isFinite(v) && v !== 0) out.set(id, { lit: Math.min(1, Math.abs(v) / 100), twinkle: v < 0 });
  return out;
}

/** How the sky stands, for its one line: how many stars burn, how many are all but known, how many twinkle. */
export function summary(map) {
  let lit = 0, learned = 0, twinkling = 0;
  for (const g of map.values()) { lit++; if (g.lit >= LEARNED) learned++; if (g.twinkle) twinkling++; }
  return { lit, learned, twinkling };
}
