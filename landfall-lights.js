// A light's character: how a lighthouse tells itself from its neighbours at night, as the chart and the List of Lights print it.
// Pure: the scene and the page flash the lights by `lightOn`, the engine only needs the names.
//   F          fixed: a steady light
//   Fl P       a single flash every P seconds;  Fl(n) P  a group of n flashes every P seconds
//   LFl P      one long flash (two seconds or more) every P seconds
//   Oc P       occulting: lit for longer than dark, one eclipse every P seconds;  Oc(n) P  a group of n eclipses
//   Iso P      isophase: light and dark for equal times
//   Q          quick: about sixty flashes a minute
// A colour may follow the kind: R red, G green (white otherwise), as in "Fl R 5s".

const FLASH = 0.5, GAP = 1.2, ECLIPSE = 1.1;          // seconds: a flash, the dark between a group's flashes, an occulting light's eclipse
/** The parts of a character: { kind, n, period, colour }. */
export function parseChar(ch) {
  const m = /^(F|Fl|LFl|Oc|Iso|Q)(?:\((\d)\))?(?:\s+([RG]))?(?:\s+(\d+(?:\.\d+)?)s)?$/.exec(String(ch).trim());
  if (!m) throw new Error(`not a light's character: ${ch}`);
  const kind = m[1], n = Number(m[2] || 1), period = kind === "Q" ? 1 : kind === "F" ? 0 : Number(m[4]);
  if (kind !== "F" && kind !== "Q" && !(period > 0)) throw new Error(`a period is needed: ${ch}`);
  return { kind, n, period, colour: m[3] || "W" };
}
const bump = (t, at, len) => (t >= at && t <= at + len ? Math.sin(((t - at) / len) * Math.PI) : 0);
/** How bright the light shows at `t` seconds (0 dark to 1 full), its flashes rounded off as a turning lens shows them. */
export function lightOn(ch, t) {
  const c = typeof ch === "string" ? parseChar(ch) : ch, ph = c.period ? ((t % c.period) + c.period) % c.period : 0;
  switch (c.kind) {
    case "F": return 1;
    case "Q": return bump(ph, 0, 0.35);
    case "Fl": { let v = 0; for (let k = 0; k < c.n; k++) v = Math.max(v, bump(ph, k * (FLASH + GAP), FLASH)); return v; }
    case "LFl": return Math.min(1, 1.4 * bump(ph, 0, 2.2));
    case "Iso": return ph < c.period / 2 ? 1 : 0.04;
    case "Oc": { for (let k = 0; k < c.n; k++) if (ph >= k * (ECLIPSE + GAP) && ph < k * (ECLIPSE + GAP) + ECLIPSE) return 0.04; return 1; }
    default: return 0;
  }
}
/** The middle of each flash of a group (seconds into the period): where a turning lens's beams point at the ship. Empty for a light with no beams. */
export function flashTimes(ch) {
  const c = typeof ch === "string" ? parseChar(ch) : ch;
  if (c.kind === "Fl") return Array.from({ length: c.n }, (_, k) => k * (FLASH + GAP) + FLASH / 2);
  if (c.kind === "LFl") return [1.1];
  return [];
}
const NUM = ["", "one", "two", "three", "four", "five", "six"];
/** The character in words, as the List of Lights would be read aloud: "two flashes every ten seconds, white". */
export function charWords(ch) {
  const c = parseChar(ch), col = c.colour === "R" ? ", red" : c.colour === "G" ? ", green" : "", every = `every ${c.period} seconds`;
  switch (c.kind) {
    case "F": return `a fixed light${col}`;
    case "Q": return `quick flashing, a flash a second${col}`;
    case "Fl": return `${c.n === 1 ? "one flash" : `${NUM[c.n]} flashes`} ${every}${col}`;
    case "LFl": return `one long flash ${every}${col}`;
    case "Iso": return `light and dark in equal turns, ${every}${col}`;
    case "Oc": return `steady, broken by ${c.n === 1 ? "an eclipse" : `${NUM[c.n]} eclipses`} ${every}${col}`;
    default: return ch;
  }
}
/** The light's colour, for drawing: [r, g, b] 0 to 255. */
export const lightColour = ch => ({ W: [255, 226, 160], R: [255, 96, 80], G: [110, 255, 150] })[parseChar(ch).colour];
