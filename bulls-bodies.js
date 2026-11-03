// Bulls' pieces as celestial bodies: one shaded sphere for each of the eight colours, drawn once as SVG symbols
// (#bu-b0..7) that every peg re-uses. The engine's colour numbers are unchanged; only what they look like is.
// A body reads by its shape as well as its colour: `sil` is its outline, `cue` the marking on it (data-cue in the
// markup), and no two bodies share either (tests/bulls-bodies.mjs).

export const BODIES = [
  { name: "Mars", sil: "disc", cue: "cap" },          // 0 red: a white polar cap and a dark plain
  { name: "Sun", sil: "rays", cue: "rays" },          // 1 yellow: a ring of rays
  { name: "Uranus", sil: "ring-thin", cue: "ring" },  // 2 green: a thin ring seen nearly end-on
  { name: "Earth", sil: "disc", cue: "land" },        // 3 blue: land and cloud
  { name: "Moon", sil: "disc", cue: "craters" },      // 4 white: craters
  { name: "Mercury", sil: "disc", cue: "basin" },     // 5 black: a gilt rim and a basin of rings
  { name: "Saturn", sil: "ring-wide", cue: "ring" },  // 6 purple: a broad tilted ring
  { name: "Jupiter", sil: "disc", cue: "bands" },     // 7 orange: bands and a red spot
];

const R = 10, C = 12;
const grad = (id, a, b, c) => `<radialGradient id="${id}" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
const GRADS = [
  grad("bu-g0", "#E98A72", "#B23A2C", "#5E1A14"),
  grad("bu-g1", "#FFF3B0", "#F4BB3C", "#C9800E"),
  grad("bu-g2", "#E2FAF0", "#6CC4B0", "#2A7774"),
  grad("bu-g3", "#8FCBF5", "#2F6FB0", "#12305A"),
  grad("bu-g4", "#FFFEF6", "#E2DAC2", "#A29A82"),
  grad("bu-g5", "#9DB0BE", "#3B4B58", "#111A22"),
  grad("bu-g6", "#EBD3F4", "#9B63AB", "#4F2460"),
  grad("bu-g7", "#F6B676", "#D06A28", "#74340F"),
].join("");
// the sphere's shading, over every disc: dark at the limb, a soft light at upper left
const LIMB = `<radialGradient id="bu-limb" cx=".38" cy=".33" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
<radialGradient id="bu-gloss" cx=".3" cy=".24" r=".4"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
const clip = (id, r) => `<clipPath id="${id}"><circle cx="${C}" cy="${C}" r="${r}"/></clipPath>`;
const CLIPS = clip("bu-k10", R) + clip("bu-k76", 7.6);

/** A shaded disc of radius r, with its surface (clipped to it) between the colour and the shading. */
const sphere = (g, r, k, surface = "", rim = ".35") => `<circle cx="${C}" cy="${C}" r="${r}" fill="url(#bu-g${g})"/>${surface ? `<g clip-path="url(#${k})">${surface}</g>` : ""}<circle cx="${C}" cy="${C}" r="${r}" fill="url(#bu-limb)"/><circle cx="${C}" cy="${C}" r="${r}" fill="url(#bu-gloss)"/><circle cx="${C}" cy="${C}" r="${r - .2}" fill="none" stroke="rgba(0,0,0,${rim})" stroke-width=".45"/>`;

const burst = () => {                                  // the Sun's rays: sixteen points, long and short
  const pts = [];
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16 - Math.PI / 2, r = i % 2 ? 8.6 : i % 4 === 0 ? 11.9 : 10.3;
    pts.push(`${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<path d="M${pts.join("L")}Z" fill="#F2B22E" stroke="#A8680A" stroke-width=".4" stroke-linejoin="round"/>`;
};
/** A ring seen at an angle: its far half behind the sphere, its near half in front. */
const ringBack = (rx, ry, tilt, stroke, w) => `<g transform="rotate(${tilt} ${C} ${C})" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"><path d="M${C - rx} ${C}A${rx} ${ry} 0 0 1 ${C + rx} ${C}"/></g>`;
const ringFront = (rx, ry, tilt, stroke, w) => `<g transform="rotate(${tilt} ${C} ${C})" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"><path d="M${C - rx} ${C}A${rx} ${ry} 0 0 0 ${C + rx} ${C}"/></g>`;

const SURFACE = [
  // Mars: a polar cap, a dark plain
  () => sphere(0, R, "bu-k10", `<path d="M7.6 12.6C9 10.6 13 10.6 15.2 12.6C16.6 14.2 15.2 16.6 12.4 16.4C9.6 16.6 6.4 15.4 7.6 12.6Z" fill="#5A1912" opacity=".5"/><ellipse cx="${C}" cy="2.6" rx="5.2" ry="2.8" fill="#FBF6E8"/><ellipse cx="${C}" cy="21.6" rx="3" ry="1.4" fill="#FBF6E8" opacity=".7"/>`),
  // Sun
  () => `${burst()}<circle cx="${C}" cy="${C}" r="8.2" fill="url(#bu-g1)"/><circle cx="${C}" cy="${C}" r="6.1" fill="none" stroke="#FFF7CF" stroke-width=".55" opacity=".7"/><circle cx="${C}" cy="${C}" r="8.2" fill="url(#bu-gloss)"/><circle cx="${C}" cy="${C}" r="8.1" fill="none" stroke="rgba(120,60,0,.35)" stroke-width=".4"/>`,
  // Uranus: a thin ring, nearly upright
  () => `${ringBack(11.4, 2.5, -78, "#CFF3E8", ".9")}${sphere(2, 7.6, "bu-k76", "", ".3")}${ringFront(11.4, 2.5, -78, "#EAFBF4", "1.1")}`,
  // Earth: land and cloud
  () => sphere(3, R, "bu-k10", `<path d="M5.6 8.6C7.2 6 11 6 12.4 8C13.4 9.6 11.4 11 9.8 11.2C8 11.8 5.6 11.2 5.6 8.6Z" fill="#58AE6E" stroke="#2F7D5B" stroke-width=".35"/><path d="M13.4 13.4C15.4 12 18.6 13.2 18.8 15.8C18.4 18.4 15.4 19 13.8 17.4C12.8 16.2 12.4 14.4 13.4 13.4Z" fill="#58AE6E" stroke="#2F7D5B" stroke-width=".35"/><path d="M14.2 4.6C15.8 4 17.6 4.8 17.4 6.2C16.2 7.4 14.8 7 14.2 4.6Z" fill="#58AE6E"/><path d="M4.6 14.6C7.6 13.2 9.4 15.4 12 14.4M10.6 4.2C13.6 3 17 3.6 19.6 6.4" fill="none" stroke="#fff" stroke-width=".95" stroke-linecap="round" opacity=".75"/>`),
  // Moon: craters
  () => sphere(4, R, "bu-k10", `<ellipse cx="9.4" cy="10" rx="4.2" ry="3" fill="#A59D84" opacity=".4"/><g fill="#B3AB92" stroke="#8D856D" stroke-width=".4"><circle cx="8" cy="8.6" r="1.7"/><circle cx="15" cy="8.2" r="1.2"/><circle cx="14.6" cy="15" r="2.3"/><circle cx="8" cy="15.6" r="1.05"/><circle cx="18" cy="12.2" r=".8"/><circle cx="12" cy="12" r=".7"/></g>`, ".3"),
  // Mercury: a basin of rings, a gilt rim
  () => `${sphere(5, R, "bu-k10", `<g fill="none" stroke="#B9C9D4" stroke-width=".55" opacity=".85"><circle cx="13.6" cy="10.4" r="4.1"/><circle cx="13.6" cy="10.4" r="2"/></g><circle cx="7.6" cy="15.4" r="1.4" fill="#26323D" stroke="#7F93A1" stroke-width=".4"/><circle cx="16.6" cy="17" r=".9" fill="#26323D" stroke="#7F93A1" stroke-width=".35"/>`, ".5")}<circle cx="${C}" cy="${C}" r="9.6" fill="none" stroke="#F2D58C" stroke-width=".9"/>`,
  // Saturn: a broad ring, tilted
  () => `${ringBack(11.7, 3.4, -20, "#EBCB7E", "1.5")}${sphere(6, 7.2, "bu-k76", `<path d="M3 11.2H21M3 13.6H21" stroke="#4F2460" stroke-width=".6" opacity=".45"/>`, ".35")}${ringFront(11.7, 3.4, -20, "#F6DC96", "1.6")}${ringFront(9.3, 2.7, -20, "#B38A3C", ".5")}`,
  // Jupiter: bands and a red spot
  () => sphere(7, R, "bu-k10", `<g opacity=".6"><rect x="0" y="5.2" width="24" height="2.2" fill="#8A4318"/><rect x="0" y="9" width="24" height="1.6" fill="#FBE6C6"/><rect x="0" y="12" width="24" height="2.4" fill="#8A4318"/><rect x="0" y="16" width="24" height="1.4" fill="#FBE6C6"/></g><ellipse cx="15.6" cy="13.8" rx="2.3" ry="1.4" fill="#B02A1E" stroke="#6E170F" stroke-width=".3"/>`),
];

/** The hidden SVG every peg draws from: the gradients, a symbol for each body and the astrolabe's rosette. */
export function bodySheet() {
  const syms = SURFACE.map((draw, i) => `<symbol id="bu-b${i}" viewBox="0 0 24 24" data-cue="${BODIES[i].cue}" data-sil="${BODIES[i].sil}">${draw()}</symbol>`).join("");
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${GRADS}${LIMB}${CLIPS}</defs>${syms}${ROSETTE}</svg>`;
}
export const symbolMarkup = i => SURFACE[i]();

// The cover's rosette, a small astrolabe: a rim, a ring of ticks, the four winds.
const ticks = Array.from({ length: 16 }, (_, i) => {
  const a = (i * Math.PI) / 8, r1 = i % 4 === 0 ? 6 : 7.2, r2 = 8.4;
  return `M${(12 + r1 * Math.cos(a)).toFixed(2)} ${(12 + r1 * Math.sin(a)).toFixed(2)}L${(12 + r2 * Math.cos(a)).toFixed(2)} ${(12 + r2 * Math.sin(a)).toFixed(2)}`;
}).join("");
const ROSETTE = `<symbol id="bu-rosette" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="12" cy="12" r="10.6" stroke-width="1"/><circle cx="12" cy="12" r="8.9" stroke-width=".5"/><path d="${ticks}" stroke-width=".7"/></g><path d="M12 4.4L13.5 10.5L19.6 12L13.5 13.5L12 19.6L10.5 13.5L4.4 12L10.5 10.5Z" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="var(--bu-rosette-eye, #fff)"/></symbol>`;

// The night sky behind the rows: fixed stars and a few fine orbits, placed once by a small seeded generator.
export function skyMarkup() {
  let s = 20261104;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let stars = "", glints = "";
  for (let i = 0; i < 40; i++) {
    const x = (next() * 100).toFixed(1), y = (next() * 160).toFixed(1), r = (0.2 + next() * next() * 0.42).toFixed(2);
    stars += `<circle class="st" cx="${x}" cy="${y}" r="${r}" opacity="${(0.3 + next() * 0.55).toFixed(2)}"/>`;
  }
  for (const [x, y] of [[88, 146]]) glints += `<path class="st gl" d="M${x} ${y - 2.4}L${x + 0.4} ${y - 0.4}L${x + 2.4} ${y}L${x + 0.5} ${y + 0.5}L${x} ${y + 2.4}L${x - 0.5} ${y + 0.5}L${x - 2.4} ${y}L${x - 0.5} ${y - 0.5}Z"/>`;
  const orbits = `<circle class="orb" cx="112" cy="-14" r="98"/><circle class="orb dash" cx="-24" cy="170" r="84"/><circle class="orb" cx="50" cy="196" r="120"/>`;
  return `<svg class="bu-sky" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${orbits}${stars}${glints}</svg>`;
}
