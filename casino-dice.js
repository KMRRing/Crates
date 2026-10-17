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

const element = html => { const t = document.createElement("template"); t.innerHTML = html; return t.content.firstElementChild; };
/**
 * The dice tumbling in `box` for `ms`, each landing on its face (`faces`, one per die) one after another, the last at
 * the end. Dice that land get the `land` class (casino-dice.css animates it); the box has `rolling` while they tumble.
 * With reduced motion the dice don't turn, they just land.
 */
export async function tumble(box, faces, ms) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches, n = faces.length;
  box.classList.toggle("rolling", !still);
  const any = () => dieSvg(1 + Math.floor(Math.random() * 6));
  box.innerHTML = faces.map(any).join("");
  const at = faces.map((_, i) => (n === 1 ? 1 : 0.55 + (0.45 * i) / (n - 1)) * ms), t0 = performance.now(), landed = faces.map(() => false);
  await new Promise(done => {
    const tick = () => {
      const t = performance.now() - t0;
      [...box.children].forEach((el, i) => {
        if (landed[i]) return;
        if (t >= at[i]) { landed[i] = true; el.replaceWith(element(dieSvg(faces[i], "land"))); }
        else if (!still) el.replaceWith(element(any()));
      });
      if (landed.every(Boolean)) { done(); return; }
      setTimeout(tick, 90);
    };
    tick();
  });
  box.classList.remove("rolling");
}
