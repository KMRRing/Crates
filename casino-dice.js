// A die as Chinese dice are made, for the casino's dice games (Sic Bo, Craps): ivory, the one's pip large and red and the
// four's red too, as Boast draws it. casino-dice.css draws it; sizes are CSS classes on the svg (mini, big), so a die in
// a cell of a layout, in the tray and in a line of the course are the same die.
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };

/** A die showing a face (1–6) as an svg; cls adds classes (mini, big, lit, dim). */
export function dieSvg(face, cls = "") {
  const pips = PIPS[face].map(([c, r]) => `<circle cx="${6 + 6 * c}" cy="${6 + 6 * r}" r="${face === 1 ? 3.6 : 2.15}"/>`).join("");
  return `<svg class="cdi${face === 1 || face === 4 ? " red" : ""}${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" role="img" aria-label="${face}"><rect x="1" y="1" width="22" height="22" rx="4.6"/>${pips}</svg>`;
}
/** Dice written "4 4 2" or "442" as a list of faces; throws for anything else, so a lesson can't show a die that isn't. */
export function parseDice(text) {
  const d = String(text).trim().replace(/\s+/g, "").split("").map(Number);
  if (!d.length || d.some(x => !(Number.isInteger(x) && x >= 1 && x <= 6))) throw new Error(`no dice "${text}"`);
  return d;
}
