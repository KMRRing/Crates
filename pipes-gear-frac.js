// Gears: exact fractions for speeds (4 November 2026). A fraction is [p, q] with q > 0, lowest terms, the sign on p; the rules never
// use floats for a speed. Small integers only (tooth counts are at most 15, and a train multiplies a dozen ratios at most).
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const mk = (p, q = 1) => { if (q < 0) { p = -p; q = -q; } const g = gcd(p, q); return [p / g, q / g]; };
export const mul = (a, b) => mk(a[0] * b[0], a[1] * b[1]);
export const div = (a, b) => mk(a[0] * b[1], a[1] * b[0]);
export const neg = a => [-a[0], a[1]];
export const abs = a => [Math.abs(a[0]), a[1]];
export const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
export const cmp = (a, b) => Math.sign(a[0] * b[1] - b[0] * a[1]);
export const sign = a => Math.sign(a[0]);
export const num = a => a[0] / a[1];
export const ONE = [1, 1];
/** "p/q" as written in a level ("1/2", "3", "-2/3"). */
export function parse(s) {
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(String(s).trim());
  if (!m) throw new Error(`bad fraction ${s}`);
  return mk(Number(m[1]), Number(m[2] || 1));
}
const GLYPH = { "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/5": "⅕", "2/5": "⅖", "3/5": "⅗", "4/5": "⅘", "1/6": "⅙", "5/6": "⅚", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞" };
/** "1/2" for the engine's and the tests' use; fmt(f, true) uses ½ where a character exists, for the chips. The sign is dropped
 *  (a speed's direction is shown by its arrow). */
export const fmt = (f, glyph = false) => {
  const s = `${Math.abs(f[0])}${f[1] === 1 ? "" : `/${f[1]}`}`;
  return glyph && GLYPH[s] ? GLYPH[s] : s;
};
