// Bulls' pieces as celestial bodies: one shaded sphere for each of the eight colours, drawn once as SVG symbols
// (#bu-b0..7) that every peg re-uses. The engine's colour numbers are unchanged; only what they look like is.
// A body reads by its shape as well as its colour: `sil` is its outline, `cue` the marking on it (data-cue in the
// markup), and no two bodies share either (tests/bulls-bodies.mjs).

export const BODIES = [
  { name: "Vulcan", sil: "disc-mid", cue: "lava" },         // 0 red: a black crust split by glowing lava
  { name: "Sun", sil: "rays", cue: "rays" },            // 1 yellow: a ring of rays
  { name: "Saturn", sil: "ring-wide", cue: "ring" },    // 2 green: a broad tilted ring round a small globe
  { name: "Moon", sil: "disc-small", cue: "craters" },  // 3 blue: a small grey globe with craters
  { name: "Comet", sil: "tail", cue: "tail" },          // 4 white: a small bright head and a long tail
  { name: "Jupiter", sil: "disc-large", cue: "bands" }, // 5 black: the largest globe, banded, with a red spot
  { name: "Europa", sil: "disc-wide", cue: "cracks" },       // 6 purple: pale ice crossed by dark cracks
  { name: "Venus", sil: "halo", cue: "swirl" },         // 7 orange: wrapped in violet cloud, a soft halo
];

const R = 10, C = 12;
const grad = (id, a, b, c) => `<radialGradient id="${id}" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
const GRADS = [
  grad("bu-g0", "#4A3A36", "#1F1614", "#080504"),
  grad("bu-g1", "#FFF3B0", "#F4BB3C", "#C9800E"),
  grad("bu-g2", "#FFF4CC", "#E6C47A", "#8E6E2C"),
  grad("bu-g3", "#E4E4E0", "#A4A4A0", "#5E5E5C"),
  grad("bu-g4", "#FFFFFF", "#DCEBFA", "#7FA6CF"),
  grad("bu-g5", "#F6B676", "#C8661F", "#6E3010"),
  grad("bu-g6", "#F2FCFF", "#B8E0EE", "#5A93B2"),
  grad("bu-g7", "#E6C2EE", "#8E4C9E", "#34154A"),
  `<linearGradient id="bu-tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFEBFF" stop-opacity=".95"/><stop offset=".45" stop-color="#6FB4F5" stop-opacity=".55"/><stop offset="1" stop-color="#6FB4F5" stop-opacity="0"/></linearGradient>`,
].join("");
// the sphere's shading, over every disc: dark at the limb, a soft light at upper left
const LIMB = `<radialGradient id="bu-limb" cx=".38" cy=".33" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
<radialGradient id="bu-gloss" cx=".3" cy=".24" r=".4"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
const clip = (id, r) => `<clipPath id="${id}"><circle cx="${C}" cy="${C}" r="${r}"/></clipPath>`;
const CLIPS = clip("bu-k10", R) + clip("bu-k76", 7.6) + clip("bu-k86", 8.6) + clip("bu-k34", 3.4) + clip("bu-k112", 11.2) + clip("bu-k90", 9) + clip("bu-k94", 9.4);

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
  // Vulcan: a black crust, lava in the cracks, a red glow round the limb
  () => `<circle cx="${C}" cy="${C}" r="10.9" fill="#FF5A14" opacity=".28"/>${sphere(0, 8.6, "bu-k86", `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9L9 11L11 15L16 16L18 20M9 11L10 6L15 5M16 16L19 12L20 8M11 15L7 18" stroke="#FF6A1A" stroke-width="1.5" opacity=".5"/><path d="M5 9L9 11L11 15L16 16L18 20M9 11L10 6L15 5M16 16L19 12L20 8M11 15L7 18" stroke="#FFC24A" stroke-width=".6"/></g>`, ".5")}`,
  // Sun
  () => `${burst()}<circle cx="${C}" cy="${C}" r="8.2" fill="url(#bu-g1)"/><circle cx="${C}" cy="${C}" r="6.1" fill="none" stroke="#FFF7CF" stroke-width=".55" opacity=".7"/><circle cx="${C}" cy="${C}" r="8.2" fill="url(#bu-gloss)"/><circle cx="${C}" cy="${C}" r="8.1" fill="none" stroke="rgba(120,60,0,.35)" stroke-width=".4"/>`,
  // Saturn: a broad ring, tilted
  () => `${ringBack(11.7, 3.4, -20, "#EBCB7E", "1.5")}${sphere(2, 6.6, "bu-k76", `<path d="M3 11.2H21M3 13.6H21" stroke="#8E6E2C" stroke-width=".6" opacity=".5"/>`, ".35")}${ringFront(11.7, 3.4, -20, "#F6DC96", "1.6")}${ringFront(9.3, 2.7, -20, "#B38A3C", ".5")}`,
  // Moon: small, grey, cratered
  () => `<g transform="translate(4.8 4.8) scale(.6)">${sphere(3, R, "bu-k10", `<g fill="#9C9C98" stroke="#6E6E6A" stroke-width=".5"><circle cx="8" cy="8.6" r="1.9"/><circle cx="15" cy="8.2" r="1.3"/><circle cx="14.6" cy="15" r="2.5"/><circle cx="8" cy="15.6" r="1.2"/><circle cx="18" cy="12.2" r=".9"/><circle cx="12" cy="12" r=".8"/></g>`, ".3")}</g>`,
  // Comet: a small bright head, a tail running away from the light
  () => `<path d="M7.4 5.6L24 20.4L20.4 24L5.6 7.4Z" fill="url(#bu-tail)"/><path d="M6.4 6.4L23 22" stroke="#9ED0FF" stroke-width=".7" stroke-linecap="round" opacity=".8"/><circle cx="7.6" cy="7.6" r="4.6" fill="#BFE3FF" opacity=".35"/>${sphere(4, 3.4, "bu-k34", "", ".3").replace(/cx="12" cy="12"/g, 'cx="7.6" cy="7.6"')}`,
  // Jupiter: the largest, bands and a red spot
  () => sphere(5, 11.2, "bu-k112", `<g opacity=".6"><rect x="0" y="5.2" width="24" height="2.2" fill="#7A3A12"/><rect x="0" y="9" width="24" height="1.6" fill="#FBE6C6"/><rect x="0" y="12" width="24" height="2.4" fill="#7A3A12"/><rect x="0" y="16" width="24" height="1.4" fill="#FBE6C6"/></g><ellipse cx="15.6" cy="13.8" rx="2.3" ry="1.4" fill="#B02A1E" stroke="#6E170F" stroke-width=".3"/>`),
  // Europa: pale ice, long dark cracks
  () => sphere(6, 9, "bu-k90", `<g fill="none" stroke="#2A4A6E" stroke-width=".7" stroke-linecap="round"><path d="M3 9L9 12L14 10L21 15M9 12L11 18L16 21M14 10L15 4M6 16L11 18"/></g>`, ".35"),
  // Venus: violet cloud in swirls, a soft halo
  () => `<circle cx="${C}" cy="${C}" r="11.2" fill="#C48AE0" opacity=".3"/>${sphere(7, 8.2, "bu-k94", `<g fill="none" stroke="#F0D6F6" stroke-width="1.5" stroke-linecap="round" opacity=".75"><path d="M3 9C8 6 12 11 16 8C18 7 20 8 21 9"/><path d="M3 14C8 11 12 16 17 13C19 12 20 13 21 14"/><path d="M5 19C9 17 13 20 18 17"/></g>`, ".25")}`,
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

// The night sky behind the rows: a field of fine stars, a few fine orbits with a small lit body on each going slowly round
// (SMIL, so bulls.js can pause it with the menu), placed once by a small seeded generator. Reduced motion draws it still.
export function skyMarkup(still = false) {
  let s = 20261104;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let stars = "", glints = "";
  for (let i = 0; i < 90; i++) {
    const x = (next() * 100).toFixed(1), y = (next() * 160).toFixed(1), r = (0.14 + next() * next() * 0.5).toFixed(2), o = (0.25 + next() * 0.6).toFixed(2);
    const tw = !still && i % 9 === 0 ? `<animate attributeName="opacity" values="${o};${(o * 0.35).toFixed(2)};${o}" dur="${(3 + next() * 4).toFixed(1)}s" begin="-${(next() * 5).toFixed(1)}s" repeatCount="indefinite"/>` : "";
    stars += `<circle class="st${i % 7 === 0 ? " warm" : i % 5 === 0 ? " cool" : ""}" cx="${x}" cy="${y}" r="${r}" opacity="${o}">${tw}</circle>`;
  }
  for (const [x, y] of [[88, 146], [90, 12]]) glints += `<path class="st gl" d="M${x} ${y - 2.6}L${x + 0.4} ${y - 0.4}L${x + 2.6} ${y}L${x + 0.5} ${y + 0.5}L${x} ${y + 2.6}L${x - 0.5} ${y + 0.5}L${x - 2.6} ${y}L${x - 0.5} ${y - 0.5}Z"/>`;
  const orbit = (cx, cy, r, cls, a0, dur, rad) => {
    const spin = still ? "" : `<animateTransform attributeName="transform" type="rotate" from="${a0} ${cx} ${cy}" to="${a0 + 360} ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>`;
    return `<circle class="orb${cls}" cx="${cx}" cy="${cy}" r="${r}"/><g transform="rotate(${a0} ${cx} ${cy})">${spin}<circle class="halo" cx="${cx + r}" cy="${cy}" r="${rad * 3}"/><circle class="sat" cx="${cx + r}" cy="${cy}" r="${rad}"/></g>`;
  };
  const orbits = orbit(112, -14, 98, "", 200, 240, 1.15) + orbit(-24, 170, 84, " dash", 20, 300, 0.9) + orbit(50, 196, 120, "", 110, 360, 1.4);
  return `<svg class="bu-sky" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${orbits}${stars}${glints}</svg>`;
}
