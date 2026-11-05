// Survey skin: the suite theme and day or night as colours, for the 3D block and the flat view (no three.js here, so the flat view stays light).
// ---------- the skins ----------
export const MODES = {
  day: { rock: 0xb9ab92, sky: 0xf1e6cd, ground: 0x5a4d3c, hemi: 1.15, key: 0xfff1d6, keyI: 2.6, exposure: 1.0, shadow: 0.55 },
  night: { rock: 0x98938a, sky: 0x6c80a6, ground: 0x141a22, hemi: 1.05, key: 0xcbdaf5, keyI: 2.2, exposure: 1.05, shadow: 0.6 },
};
export const THEMES = { codex: { brass: [0xcfa142, 0xc39a3e], plate: [0x1c2a34, 0x0d151c] }, office: { brass: [0xc4a248, 0xbb9a40], plate: [0x22302a, 0x0f1612] } };
/** The skin in force: the suite's theme and day or night (as set, else as the device), with the theme's gold and blue enamels (ore, marks). */
export function skinNow() {
  const root = document.documentElement, theme = THEMES[root.dataset.theme] ? root.dataset.theme : "codex";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), pick = (name, or) => { const v = (css.getPropertyValue(name) || "").trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : or; };
  const i = night ? 1 : 0;
  return { name: `${theme} ${night ? "night" : "day"}`, night, ...MODES[night ? "night" : "day"], brass: THEMES[theme].brass[i], plate: THEMES[theme].plate[i], ore: pick("--c0", "#D49A22"), mark: pick("--c2", "#2C5B8A"), silver: night ? "#aebccf" : "#8d9db3", granite: night ? "#4b5762" : "#626d79", lamp: night ? "#ffd27a" : "#f4b640" };
}

