// Whether an entity is theme material (kb/audit/theme.js): the game's own world, German, Bavarian, Scottish, Alpine, mercantile,
// Hanseatic, and a bit of oil. node tools/audit-marks.mjs --theme applies it to kb/audit/marks.js.
import { REGIONAL_SAYING_LANG, THEME_SETS, NOT_ALPINE, THEME_COUNTRY, COUNTRY_NOT, THEME_LANG, THEME_IDS, OIL_IDS } from "../kb/audit/theme.js";

export function themeOf(e) {
  const sets = e.sets || [];
  if (THEME_IDS.has(e.id) || OIL_IDS.has(e.id)) return true;
  if (THEME_SETS.some(s => sets.includes(s))) return true;
  if (sets.includes("ski-resort")) return !NOT_ALPINE.has(e.id);
  if (sets.includes("saying") && THEME_LANG.test(e.lang || "")) return true;
  if (THEME_COUNTRY.has(e.country) && !COUNTRY_NOT.some(s => sets.includes(s))) return true;
  return false;
}

/** The mark an entity gets from the theme rules, given the one it has: s or p become t (theme), a specialist English or Latin saying r. */
export function upgraded(e, m) {
  if (m !== "s" && m !== "p") return m;
  if (themeOf(e)) return "t";
  if (m === "s" && (e.sets || []).includes("saying") && REGIONAL_SAYING_LANG.test(e.lang || "")) return "r";
  return m;
}
