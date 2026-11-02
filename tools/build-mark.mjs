// Codex's mark: a C of three Geneva-striped tiers round a watch movement, and the "o" of its name as the chapter ring
// between them. `node tools/build-mark.mjs` writes every file the mark is in (a test fails if one is edited by hand):
//
//   mark/*.svg        the large cut in nine layers, bottom to top (the dial, the ring's bar, the ring, the pinions, great wheel, bridge with the middle tier, jewels, the great wheel's bar): the loader turns each as a picture on the GPU
//   logo.svg          the small cut at rest: the games screen's title, and the 3D scene's source of truth
//   icon.svg          the same on a rounded navy tile (the favicon)
//   loader-small.svg  the tiny cut, turning: before the words of a short wait
//   mark.js           the small cut inline, with the classes style.css turns it by (the menu button, Settings)
//   tools/mark-3d/params.json   the tooth outlines and speeds for the 3D scene that draws the app icon's picture
//
// The mechanism is real. A great wheel (20 teeth, clockwise, 3 s) carries a bar to the INNER tier of the C; two
// compound pinions (10 teeth meshing it, 10 meshing the ring), anticlockwise, 1.5 s; an internal ring gear (40
// teeth), anticlockwise, 6 s, carries a bar to the OUTER tier. The middle tier, the o, the bridge and the jewels stand
// still. The speeds follow from the teeth, and the great wheel turns twice for the ring's once, so everything is back
// where it began every 6 s: at rest the C is whole, and while it turns the C comes apart and re-forms.
// Every wheel has one module so they mesh; tooth phases are found by scanning, not by hand (`meshOverlaps`).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const NAVY = "#1C2A34", NAVY2 = "#15222C", BR = "#C8923A", BRL = "#DDB055", BRD = "#8F6A24", HI = "#F4D98F", RUBY = "#B3362C";   // brass in four tones, and the navy it sits on
const f = x => (Math.abs(x) > 1e-9 ? x.toFixed(2).replace(/\.?0+$/, "") : "0");
const P = (r, deg) => [50 + r * Math.cos(deg * Math.PI / 180), 50 + r * Math.sin(deg * Math.PI / 180)];   // an SVG angle: clockwise from the right

export const M = .85;                                   // the module: pitch radius = M * teeth / 2
export const T_A = 3;                                   // seconds for the great wheel to turn once
export const NA = 20, NBF = 10, NBB = 10, NR = NA + NBF + NBB;   // the ring's pitch circle runs through the pinions' back wheels
const [RA, RBF, RBB, RR] = [NA, NBF, NBB, NR].map(n => M * n / 2);
export const D = RA + RBF;                              // hub to a pinion's axis
export const T_B = T_A * NBF / NA, T_R = T_B * NR / NBB;   // 1.5 s and 6 s
export const TIERS = [[32, 35.7, 44], [35.7, 39.3, 40], [39.3, 43, 36]];   // inner, middle, outer: r1, r2, half-gap in degrees
export const PIN = { b: 150, d: 30 };                   // where the pinions sit round the hub (SVG degrees)
const R_RIM = RR + 1.25 * M + .9;                       // the middle of the ring gear's solid rim, clear of its teeth
const RING_OUT = RR + 1.25 * M + 1.8;                   // its outer edge
const ALPHA_OUT = 110, ALPHA_IN = 70;                   // where the two bars leave the hub at rest

const toothAt = (n, rp, phase, rot, kind) => {         // the outline of a wheel's teeth: trapezoids, root half-width .30 pitch, tip .10
  const pitch = 360 / n, [rr, ro] = kind === "ext" ? [rp - 1.25 * M, rp + M] : [rp + 1.25 * M, rp - M], out = [];
  for (let k = 0; k < n; k++) {
    const c = phase + rot + k * pitch;
    for (const [r, da] of [[rr, -.30], [ro, -.10], [ro, .10], [rr, .30]]) {
      const a = (c + da * pitch) * Math.PI / 180; out.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  }
  return out;
};
const ext = (n, rp, phase, rot = 0) => toothAt(n, rp, phase, rot, "ext");   // teeth pointing out (a wheel)
const int = (n, rp, phase, rot = 0) => toothAt(n, rp, phase, rot, "int");   // teeth pointing in (the ring's inner edge)
const path = pts => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";
const inside = ([x, y], pl) => {
  let c = false;
  for (let i = 0, n = pl.length; i < n; i++) {
    const [x1, y1] = pl[i], [x2, y2] = pl[(i + 1) % n];
    if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c;
  }
  return c;
};

// ---- tooth phases, found by scanning: the middle of the longest run of phases with no overlap through a mesh cycle
const PH_A = 0, PH_R = 0;
const axis = k => [D * Math.cos(PIN[k] * Math.PI / 180), D * Math.sin(PIN[k] * Math.PI / 180)];
const frontOverlap = (k, phase, th) => {               // th: degrees the great wheel has turned (clockwise)
  const [cx, cy] = axis(k), a = ext(NA, RA, PH_A, th), bf = ext(NBF, RBF, phase, -th * NA / NBF).map(([x, y]) => [x + cx, y + cy]);
  return bf.filter(p => inside(p, a)).length + a.filter(p => inside(p, bf)).length;
};
const backOverlap = (k, phase, th) => {
  const [cx, cy] = axis(k), ring = int(NR, RR, PH_R, -th * (NA / NBF) * (NBB / NR)), bb = ext(NBB, RBB, phase, -th * NA / NBF).map(([x, y]) => [x + cx, y + cy]);
  const inRing = p => Math.hypot(...p) <= RING_OUT && !inside(p, ring);
  return bb.filter(inRing).length + ring.filter(p => inside(p, bb)).length;
};
const cycle = Array.from({ length: 36 }, (_, i) => i / 2);   // a mesh repeats every 360/NA = 18 degrees of the great wheel
const bestPhase = (overlap, k, pitch) => {
  const steps = Math.round(pitch / .25), ok = Array.from({ length: steps }, (_, i) => cycle.every(th => overlap(k, i * .25, th) === 0));
  let best = [0, 0];
  for (let s = 0; s < steps; s++) {
    if (!ok[s] || ok[(s + steps - 1) % steps]) continue;
    let n = 0; while (n < steps && ok[(s + n) % steps]) n++;
    if (n > best[0]) best = [n, s];
  }
  if (best[0] <= 4) throw new Error(`no clear tooth phase for pinion ${k}`);
  return ((best[1] + best[0] / 2) * .25) % pitch;
};
export const PH_BF = Object.fromEntries(Object.keys(PIN).map(k => [k, bestPhase(frontOverlap, k, 360 / NBF)]));
export const PH_BB = Object.fromEntries(Object.keys(PIN).map(k => [k, bestPhase(backOverlap, k, 360 / NBB)]));
/** Teeth overlapping anywhere in a mesh cycle (0 when every wheel clears its neighbours); `phaseError` turns the pinions out of mesh. */
export const meshOverlaps = (phaseError = 0) => Math.max(...Object.keys(PIN).flatMap(k => cycle.flatMap(th => [frontOverlap(k, PH_BF[k] + phaseError, th), backOverlap(k, PH_BB[k] + phaseError, th)])));

// ---- drawing
// Two paintings of the same drawing. The rich one (the large cut, the logo and the icon) shades every part as metal:
// each ring a rounded band (light in the middle, dark at the edges), each wheel domed, the bars bevelled, a soft shadow
// under every layer and a faint crystal's gloss on top. Every shade is symmetric about the part's own axis, so a part
// that turns keeps its lighting as it goes round; only the layers that stand still (the dial, the chapter ring, the
// crystal) are lit from one side. The flat one (the inline mark of the menu button, 40 px, and the tiny loader) has no
// outlines and no gradients: a gradient defined in one inline copy of the mark fails in another that is hidden.
const stop = (o, c, op) => `<stop offset="${f(o)}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ""}/>`;
const radial = (id, attrs, stops) => `<radialGradient id="${id}" ${attrs}>${stops.map(a => stop(...a)).join("")}</radialGradient>`;
const linear = (id, attrs, stops) => `<linearGradient id="${id}" ${attrs}>${stops.map(a => stop(...a)).join("")}</linearGradient>`;
/** A ring's cross-section from its inner to its outer radius, as offsets of the outer: dark edge, rising to the light middle and down. */
const profile = (r1, r2) => { const w = r2 - r1, o = d => (r1 + w * d) / r2; return [[o(0), BRD], [o(.22), BR], [o(.5), HI], [o(.78), BRL], [o(1), BRD]]; };
const defs = () => "<defs>" +
  TIERS.map(([r1, r2], i) => radial(`gt${i}`, `gradientUnits="userSpaceOnUse" cx="50" cy="50" r="${r2}"`, profile(r1, r2))).join("") +
  radial("gdial", 'gradientUnits="userSpaceOnUse" cx="50" cy="50" r="46"', [[0, "#2A3E50"], [.7, NAVY], [1, "#0F1A22"]]) +
  radial("ginner", 'gradientUnits="userSpaceOnUse" cx="50" cy="50" r="22"', [[0, "#1D2D3A"], [1, "#0C151C"]]) +
  linear("gbez", 'x1="0" y1="0" x2="1" y2="1"', [[0, HI], [.45, BR], [1, "#5B4115"]]) +
  radial("gchap", 'gradientUnits="userSpaceOnUse" cx="50" cy="50" r="26.5"', [[22 / 26.5, BRD], [.88, BR], [.94, HI], [1, BRD]]) +
  radial("gring", `gradientUnits="userSpaceOnUse" cx="50" cy="50" r="${f(RING_OUT)}"`, [[(RR - M) / RING_OUT, HI], [.87, BRL], [.94, BR], [1, BRD]]) +
  radial("gw", "", [[0, HI], [.55, BRL], [1, BR]]) +
  linear("gbar", 'x1="0" y1="0" x2="0" y2="1"', [[0, BRD], [.3, BRL], [.5, HI], [.72, BR], [1, BRD]]) +
  radial("gjewel", "", [[0, "#F4A59A"], [.55, RUBY], [1, "#661710"]]) +
  radial("gruby", 'cx=".38" cy=".35" r=".7"', [[0, "#F2958A"], [.45, RUBY], [1, "#661710"]]) +
  radial("gscrew", 'cx=".4" cy=".35" r=".7"', [[0, HI], [1, BR]]) +
  linear("ggloss", 'x1="0" y1="0" x2="0" y2="1"', [[0, "#FFFFFF", .17], [1, "#FFFFFF", 0]]) +
  '<clipPath id="cdial"><circle cx="50" cy="50" r="45"/></clipPath>' +
  "</defs>";
// A soft shadow under a layer's parts, made of paint and not of an SVG filter: Safari draws a filter at a coarser grid than
// the screen's, so a filtered layer came out blurry on a phone, and a filter is what a turning layer would repaint each
// frame. The part's silhouette (its black shape, highlights left out) is stamped at a few offsets round it, faintly, which
// piles up into a soft edge. `sh` falls a little down and right (what stands still), `ao` all round (what turns).
const silhouette = body => body
  .replace(/<(?:path|circle|ellipse)\b[^>]*\sopacity="[^"]*"[^>]*\/>/g, "")   // stripes and glints lie inside what is covered
  .replace(/\b(fill|stroke)="(?!none")[^"]*"/g, '$1="#000"');
const around = (r, n, o) => Array.from({ length: n }, (_, i) => [r * Math.cos(2 * Math.PI * i / n + .5), r * Math.sin(2 * Math.PI * i / n + .5), o]);
const STAMPS = [...around(.7, 6, .1), ...around(1.5, 6, .045)];
const shadow = (id, kind, body) => {
  const [dx, dy] = kind === "sh" ? [.3, .55] : [0, 0];
  return `<defs><g id="${id}">${silhouette(body)}</g></defs>` +
    STAMPS.map(([x, y, o]) => `<use href="#${id}" x="${f(x + dx)}" y="${f(y + dy)}" opacity="${o}"/>`).join("") + body;
};

const wedge = (r1, r2, a0, a1, fill, opacity) => {
  const [x0, y0] = P(r2, a0), [x1, y1] = P(r2, a1), [x2, y2] = P(r1, a1), [x3, y3] = P(r1, a0);
  return `<path d="M${f(x0)} ${f(y0)}A${r2} ${r2} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r1} ${r1} 0 0 0 ${f(x3)} ${f(y3)}Z" fill="${fill}"${opacity ? ` opacity="${opacity}"` : ""}/>`;
};
const arc = (r, a0, a1, stroke, sw) => {
  const [x0, y0] = P(r, a0), [x1, y1] = P(r, a1);
  return `<path d="M${f(x0)} ${f(y0)}A${r} ${r} 0 ${((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
};
/** One tier of the C: striped (every 4 degrees, so each tier ends on a stripe) when `detail`, else one solid band. */
const tier = (i, detail, rich) => {
  const [r1, r2, end] = TIERS[i], [x0, y0] = P(r2, end), [x1, y1] = P(r2, 360 - end), [x2, y2] = P(r1, 360 - end), [x3, y3] = P(r1, end);
  const band = `<path d="M${f(x0)} ${f(y0)}A${r2} ${r2} 0 1 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r1} ${r1} 0 1 0 ${f(x3)} ${f(y3)}Z"`;
  if (!rich) {
    if (!detail) return `${band} fill="${i === 1 ? BRL : BR}"/>`;
    let s = "";
    for (let k = end / 4; k < (360 - end) / 4; k++) s += wedge(r1, r2, k * 4, (k + 1) * 4, k % 2 === 0 ? BRL : BR);
    return s;
  }
  let s = `${band} fill="url(#gt${i})"/>`;
  if (detail) {                                          // Geneva stripes: light and dark bands laid over the rounded band
    for (let k = end / 4; k < (360 - end) / 4; k++) s += wedge(r1, r2, k * 4, (k + 1) * 4, k % 2 === 0 ? "#FFE9A8" : "#3A2808", k % 2 === 0 ? ".16" : ".11");
  }
  return s + `${band} fill="none" stroke="${BRD}" stroke-width=".3"/>`;
};
const jewel = (cx, cy, r, rr, rich) => rich
  ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="url(#gscrew)" stroke="${BRD}" stroke-width=".35"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${rr}" fill="url(#gruby)"/><circle cx="${f(cx - rr * .3)}" cy="${f(cy - rr * .3)}" r="${f(rr * .28)}" fill="#FFD9D2" opacity=".85"/>`
  : `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${BRD}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${rr}" fill="${RUBY}"/><circle cx="${f(cx - rr * .3)}" cy="${f(cy - rr * .3)}" r="${f(rr * .3)}" fill="#F2B3A8" opacity=".8"/>`;
const screw = (cx, cy, r, ang, rich) => {
  const a = ang * Math.PI / 180, dx = r * .75 * Math.cos(a), dy = r * .75 * Math.sin(a);
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${rich ? "url(#gscrew)" : BRL}" stroke="${BRD}" stroke-width=".4"/><path d="M${f(cx - dx)} ${f(cy - dy)}L${f(cx + dx)} ${f(cy + dy)}" stroke="${NAVY}" stroke-width=".55"/>`;
};
const bar = (ang, r0, r1, w0, w1, rich) => {            // a tapered bar along `ang`, bevelled (its light is across it, so it holds as the bar turns)
  const p0 = P(r0, ang), len = r1 - r0;
  if (rich) return `<g transform="translate(${f(p0[0])} ${f(p0[1])}) rotate(${ang})"><path d="M0 ${f(-w0 / 2)}L${f(len)} ${f(-w1 / 2)}L${f(len)} ${f(w1 / 2)}L0 ${f(w0 / 2)}Z" fill="url(#gbar)" stroke="${BRD}" stroke-width=".3"/></g>`;
  const a = ang * Math.PI / 180, [ux, uy] = [Math.cos(a), Math.sin(a)], [nx, ny] = [-uy, ux], p1 = P(r1, ang);
  const pts = [[p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2], [p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2], [p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2], [p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2]];
  return `<path d="${path(pts)}" fill="${BRD}" stroke="${BRL}" stroke-width=".35" stroke-linejoin="miter"/><path d="M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}" stroke="${BRL}" stroke-width=".45" opacity=".8"/>`;
};
const greatWheel = rich => {                            // the great wheel: teeth, a dark field, four spokes and a hub, drawn about the centre
  const face = rich ? "url(#gw)" : BRL;
  let g = `<g transform="translate(50 50)"><path d="${path(ext(NA, RA, PH_A))}" fill="${face}" stroke="${BRD}" stroke-width=".35"/><circle r="${f(RA - 1.25 * M - 1.1)}" fill="${NAVY2}"/>`;
  for (let k = 0; k < 4; k++) g += `<path d="M-.6 -2L-.45 ${f(-(RA - 1.25 * M - .9))}H.45L.6 -2Z" fill="${BRL}" stroke="${BRD}" stroke-width=".25" transform="rotate(${90 * k + 45})"/>`;
  return g + `<circle r="2.4" fill="${face}" stroke="${BRD}" stroke-width=".3"/></g>`;
};

/** The boss the great wheel's bar is fixed to on the arbor, the centre jewel set in it. Round about the centre with its shade
 *  the same all the way round, so it holds as the bar turns; the bar runs in under it, so there is no bare end to see. */
const hub = rich => rich
  ? `<circle cx="50" cy="50" r="3.7" fill="url(#gw)" stroke="${BRD}" stroke-width=".35"/><circle cx="50" cy="50" r="2.75" fill="none" stroke="${BRD}" stroke-width=".3"/><circle cx="50" cy="50" r="2.15" fill="url(#gjewel)" stroke="${BRD}" stroke-width=".25"/><circle cx="50" cy="50" r="1" fill="none" stroke="#F7B3A8" stroke-width=".25" opacity=".75"/>`
  : `<circle cx="50" cy="50" r="3.7" fill="${BRL}" stroke="${BRD}" stroke-width=".35"/><circle cx="50" cy="50" r="2.15" fill="${RUBY}"/>`;
/** The layers bottom to top: [name, what turns it (null: nothing, "a" the great wheel, "r" the ring, "b"/"d" a pinion), markup]. */
const DIAL = rich => `<circle cx="50" cy="50" r="46" fill="${rich ? "url(#gdial)" : NAVY}"/>`;
export function layers(detail = true, rich = true) {
  const L = [], shade = (kind, body, rich) => rich ? shadow(`s${L.length}`, kind, body) : body;
  const rim = rich ? `<circle cx="50" cy="50" r="45.1" fill="none" stroke="url(#gbez)" stroke-width="1.5"/>` : `<circle cx="50" cy="50" r="45" fill="none" stroke="${BR}" stroke-width="${detail ? .7 : 1}"/>`;
  L.push(["base", null, DIAL(rich) + rim + `<circle cx="50" cy="50" r="22" fill="${rich ? "url(#ginner)" : NAVY2}"/>`]);
  // the ring's bar is the rearmost part, on the dial and under all the rest (the ring gear it comes from, the three tiers,
  // the chapter ring, the wheels and the other bar), so no arm passes through it; both its ends are covered, so it has no screw
  L.push(["bar-ring", "r", shade("ao", bar(ALPHA_OUT, R_RIM, 41.15, 2.6, 1.7, rich), rich)]);
  const ring = `<path fill-rule="evenodd" d="M${f(50 + RING_OUT)} 50A${f(RING_OUT)} ${f(RING_OUT)} 0 1 1 ${f(50 - RING_OUT)} 50A${f(RING_OUT)} ${f(RING_OUT)} 0 1 1 ${f(50 + RING_OUT)} 50Z ${path(int(NR, RR, PH_R).map(([x, y]) => [50 + x, 50 + y]))}" fill="${rich ? "url(#gring)" : BR}" stroke="${BRD}" stroke-width=".3"/>`;
  L.push(["ring", "r", shade("ao", tier(2, detail, rich) + ring, rich)]);
  for (const k of Object.keys(PIN)) {
    const [cx, cy] = P(D, PIN[k]), face = rich ? "url(#gw)" : null;
    L.push([`pin-${k}`, k, shade("ao",
      `<path transform="translate(${f(cx)} ${f(cy)})" d="${path(ext(NBB, RBB, PH_BB[k]))}" fill="${face || BR}" stroke="${BRD}" stroke-width=".3"/>` +
      `<path transform="translate(${f(cx)} ${f(cy)})" d="${path(ext(NBF, RBF, PH_BF[k]))}" fill="${face || BRL}" stroke="${BRD}" stroke-width=".3"/><circle cx="${f(cx)}" cy="${f(cy)}" r="1.2" fill="${NAVY2}"/>`, rich)]);
  }
  L.push(["great", "a", shade("ao", tier(0, detail, rich) + greatWheel(rich), rich)]);
  let fixed = tier(1, detail, rich) + `<circle cx="50" cy="50" r="24.25" fill="none" stroke="${rich ? "url(#gchap)" : BR}" stroke-width="4.5"/>`;
  if (detail) {
    let t = "";
    for (let k = 0; k < 60; k++) { const [x, y] = P(k % 5 ? 22.9 : 22.3, k * 6), [x2, y2] = P(25.6, k * 6); t += `M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}`; }
    fixed += `<path d="${t}" stroke="${NAVY}" stroke-width=".45"/>`;
  }
  for (const [ang, r0] of [[PIN.b, D], [PIN.d, D], [270, 0]]) fixed += bar(ang, r0, 23, 2.1, 2.1, rich);
  L.push(["fixed", null, shade("sh", fixed, rich)]);
  let top = "";
  for (const [ang, [tx, ty], jr, rr] of [[PIN.b, P(D, PIN.b), 1.7, .85], [PIN.d, P(D, PIN.d), 1.7, .85], [270, [50, 50], 2.6, 1.3]]) {
    if (ang !== 270) top += jewel(tx, ty, jr, rr, rich);   // the centre one is set in the hub of the great wheel's bar
    const [x0, y0] = P(24.25, ang); top += screw(x0, y0, 1.45, ang + 40, rich);
  }
  // a crystal's gloss over the dial, upper left: the one lit-from-a-side thing over the turning parts, kept faint
  if (rich) top = shade("sh", top, true) + `<g clip-path="url(#cdial)"><ellipse cx="36" cy="26" rx="33" ry="17" transform="rotate(-32 36 26)" fill="url(#ggloss)"/></g>`;
  L.push(["top", null, top]);
  // the great wheel's bar is the topmost part: it sweeps over the bridge, the jewels and the chapter ring, as it must for nothing to pass through it
  L.push(["bar-great", "a", shade("ao", bar(ALPHA_IN, 0, 33.85, 2.8, 1.7, rich) + screw(...P(33.85, ALPHA_IN), 1.5, ALPHA_IN + 30, rich) + hub(rich), rich)]);
  return L;
}

const SPEED = { a: [T_A, 1], r: [T_R, -1], b: [T_B, -1], d: [T_B, -1] };   // seconds a turn, and the direction (1 clockwise)
const about = k => (k === "a" || k === "r" ? [50, 50] : P(D, PIN[k]));
const SVG = (inner, rich = false) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${rich ? defs() : ""}${inner}</svg>`;
const smil = (k, scale = 1) => {
  const [dur, dir] = SPEED[k], [x, y] = about(k);
  return `<animateTransform attributeName="transform" type="rotate" values="0 ${f(x)} ${f(y)};${360 * dir} ${f(x)} ${f(y)}" dur="${f(dur * scale)}s" repeatCount="indefinite"/>`;
};
const still = (detail, rich) => SVG(layers(detail, rich).map(([, , body]) => `<g>${body}</g>`).join(""), rich);

/** The tiny cut, for 16 to 24 px: the disc, the three tiers, the o, the great wheel; turning when `animated` (faster than the movement's). Flat: it turns by SMIL on the page's thread, so no gradients or shadows to repaint. */
const tiny = animated => {
  const turn = (k, body) => `<g>${animated ? smil(k, .5) : ""}${body}</g>`;
  return SVG(`<circle cx="50" cy="50" r="46" fill="${NAVY}"/><circle cx="50" cy="50" r="45" fill="none" stroke="${BR}" stroke-width="1.4"/>${turn("r", tier(2, false, false))}${tier(1, false, false)}${turn("a", tier(0, false, false))}` +
    `<circle cx="50" cy="50" r="24.25" fill="none" stroke="${BR}" stroke-width="5"/><circle cx="50" cy="50" r="22" fill="${NAVY2}"/>` +
    turn("a", `<g transform="translate(50 50)"><path d="${path(ext(NA, RA, PH_A))}" fill="${BRL}"/><circle r="${f(RA - 1.25 * M - 1.4)}" fill="${NAVY2}"/>` +
      [45, 135, 225, 315].map(a => `<path d="M-.9 0H.9V${f(-(RA - 1.25 * M - 1))}H-.9Z" fill="${BRL}" transform="rotate(${a})"/>`).join("") +
      `<circle r="2.8" fill="${RUBY}" stroke="${BRL}" stroke-width="1"/></g>`));
};

/** The small cut inline: groups carry the classes style.css turns them by (`.turning .cx .cx-a`, ...), pinions about their own axes. Flat (see above). */
const inline = () => {
  const cls = { a: "cx-a", r: "cx-r", b: "cx-b", d: "cx-d" };
  const g = ([, k, body]) => k ? `<g class="${cls[k]}"${k === "b" || k === "d" ? ` style="transform-origin:${f(about(k)[0])}px ${f(about(k)[1])}px"` : ""}>${body}</g>` : body;
  return `<svg class="cx" viewBox="0 0 100 100" aria-hidden="true">${layers(false, false).map(g).join("")}</svg>`;
};

/** Every generated file: path -> text. */
export function build() {
  const out = {}, header = what => `<!-- Codex: ${what} (drawn by tools/build-mark.mjs; edit that, not this) -->\n`;
  for (const [name, , body] of layers(true, true)) out[`mark/${name}.svg`] = SVG(body, true) + "\n";
  out["logo.svg"] = header("the logo, a C of three tiers round a watch movement (brass on navy)") + still(false, true) + "\n";
  out["icon.svg"] = header("the app and page icon, the logo on a rounded navy tile") + still(false, true).replace(DIAL(true), `<rect width="100" height="100" rx="22" fill="url(#gdial)"/>`) + "\n";
  out["loader-small.svg"] = header("the small loader, the tiny cut turning") + tiny(true) + "\n";
  out["mark.js"] = `// Generated by tools/build-mark.mjs (edit that, not this): Codex's small mark inline. style.css turns its parts (.cx-a, .cx-r,\n// .cx-b, .cx-d) while a menu is open, at the movement's true speeds.\nexport const MARK = ${JSON.stringify(inline())};\n`;
  out["tools/mark-3d/params.json"] = JSON.stringify({
    A: ext(NA, RA, PH_A), ringIn: int(NR, RR, PH_R), front: Object.fromEntries(Object.keys(PIN).map(k => [k, ext(NBF, RBF, PH_BF[k])])), back: Object.fromEntries(Object.keys(PIN).map(k => [k, ext(NBB, RBB, PH_BB[k])])),
    c: { M, RA, RBF, RBB, RR, D, RING_OUT, R_RIM, PIN, TIERS, T_A, T_B, T_R, ALPHA_OUT, ALPHA_IN },
  }) + "\n";
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  mkdirSync(join(root, "mark"), { recursive: true }); mkdirSync(join(root, "tools/mark-3d"), { recursive: true });
  const files = build();
  for (const [p, text] of Object.entries(files)) writeFileSync(join(root, p), text);
  console.log(`${Object.keys(files).length} files written; teeth clear: ${meshOverlaps() === 0}, a pinion out of mesh would overlap ${meshOverlaps(18)}`);
}
