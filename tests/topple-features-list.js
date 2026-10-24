// What each Topple level adds, for tests/topple-features.mjs and the search for the games on record (tests/topple-reached.js).
/** What each level adds that a player must engage with, as `tagsOf` names it. */
export const FEATURES = {
  2: ["mix"], 3: ["mix"], 4: ["heavy", "gilded"], 5: ["mix", "down", "gilded"], 6: ["spring", "gate", "heavy"],
  7: ["mix", "drop", "link"], 8: ["water", "link"], 9: ["water", "marsh"], 10: ["rainbow"], 11: ["ball", "cup", "down"],
  12: ["link", "drop", "rainbow"], 13: ["gate", "down", "drop"], 14: ["mix", "gate", "spring", "link", "ball", "cup", "water", "rainbow"],
};
/** What stands in a level's way (not something to use but something to get round), by the map keys that make it. */
export const OBSTACLES = { 2: ["rock"], 3: ["water"], 6: ["water"], 8: ["water", "rock"], 9: ["water", "marsh"], 10: ["hedge"], 14: ["water", "rock"] };
/** The level's spec with those obstacles taken off its table. */
export const without = (spec, keys) => {
  const strip = m => Object.fromEntries(Object.entries(m || {}).filter(([k]) => !keys.includes(k)));
  return { ...spec, map: strip(spec.map), layers: spec.layers && spec.layers.map(strip) };
};
