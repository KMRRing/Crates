// Codex's mark: a C of three Geneva-striped tiers round a watch movement, and the "o" of its name as the chapter ring
// between them. `node tools/build-mark.mjs` writes every file the mark is in (a test fails if one is edited by hand):
//
//   mark/*.svg        the large cut in nine layers, bottom to top: the loader turns each as a picture on the GPU
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

const NAVY = "#1C2A34", NAVY2 = "#15222C", BR = "#C8923A", BRL = "#DDB055", BRD = "#8F6A24", CREAM = "#F3E1BA", RUBY = "#B3362C";
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
const wedge = (r1, r2, a0, a1, fill) => {
  const [x0, y0] = P(r2, a0), [x1, y1] = P(r2, a1), [x2, y2] = P(r1, a1), [x3, y3] = P(r1, a0);
  return `<path d="M${f(x0)} ${f(y0)}A${r2} ${r2} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r1} ${r1} 0 0 0 ${f(x3)} ${f(y3)}Z" fill="${fill}"/>`;
};
const arc = (r, a0, a1, stroke, sw) => {
  const [x0, y0] = P(r, a0), [x1, y1] = P(r, a1);
  return `<path d="M${f(x0)} ${f(y0)}A${r} ${r} 0 ${((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
};
/** One tier of the C: striped (every 4 degrees, so each tier ends on a stripe) when `detail`, else one solid band. */
const tier = (i, detail) => {
  const [r1, r2, end] = TIERS[i]; let s = "";
  if (detail) {
    for (let k = end / 4; k < (360 - end) / 4; k++) s += wedge(r1, r2, k * 4, (k + 1) * 4, k % 2 === 0 ? BRL : BR);
    s += arc(r1, end, 360 - end, CREAM, .6) + arc(r2, end, 360 - end, CREAM, .6);
    for (const a of [end, 360 - end]) { const [x, y] = P(r1, a), [x2, y2] = P(r2, a); s += `<path d="M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}" stroke="${CREAM}" stroke-width=".6"/>`; }
  } else {
    const [x0, y0] = P(r2, end), [x1, y1] = P(r2, 360 - end), [x2, y2] = P(r1, 360 - end), [x3, y3] = P(r1, end);
    s += `<path d="M${f(x0)} ${f(y0)}A${r2} ${r2} 0 1 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r1} ${r1} 0 1 0 ${f(x3)} ${f(y3)}Z" fill="${i === 1 ? BRL : BR}" stroke="${CREAM}" stroke-width=".5"/>`;
  }
  return s;
};
const jewel = (cx, cy, r, rr) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${BRD}" stroke="${CREAM}" stroke-width=".5"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${rr}" fill="${RUBY}"/><circle cx="${f(cx - rr * .3)}" cy="${f(cy - rr * .3)}" r="${f(rr * .3)}" fill="#F2B3A8" opacity=".8"/>`;
const screw = (cx, cy, r, ang) => {
  const a = ang * Math.PI / 180, dx = r * .75 * Math.cos(a), dy = r * .75 * Math.sin(a);
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${CREAM}" stroke="${BRD}" stroke-width=".4"/><path d="M${f(cx - dx)} ${f(cy - dy)}L${f(cx + dx)} ${f(cy + dy)}" stroke="${NAVY}" stroke-width=".55"/>`;
};
const bar = (ang, r0, r1, w0, w1) => {                  // a tapered bar along `ang` with a hairline of light brass down it
  const a = ang * Math.PI / 180, [ux, uy] = [Math.cos(a), Math.sin(a)], [nx, ny] = [-uy, ux], p0 = P(r0, ang), p1 = P(r1, ang);
  const pts = [[p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2], [p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2], [p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2], [p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2]];
  return `<path d="${path(pts)}" fill="${BRD}" stroke="${BRL}" stroke-width=".35" stroke-linejoin="miter"/><path d="M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}" stroke="${CREAM}" stroke-width=".45" opacity=".9"/>`;
};
const greatWheel = () => {                              // the great wheel: teeth, a dark field, four spokes and a hub, drawn about the centre
  let g = `<g transform="translate(50 50)"><path d="${path(ext(NA, RA, PH_A))}" fill="${BRL}" stroke="${BRD}" stroke-width=".35"/><circle r="${f(RA - 1.25 * M - 1.1)}" fill="${NAVY2}"/>`;
  for (let k = 0; k < 4; k++) g += `<path d="M-.6 -2L-.45 ${f(-(RA - 1.25 * M - .9))}H.45L.6 -2Z" fill="${BRL}" stroke="${BRD}" stroke-width=".25" transform="rotate(${90 * k + 45})"/>`;
  return g + `<circle r="2.4" fill="${BRL}" stroke="${BRD}" stroke-width=".3"/></g>`;
};

/** The layers bottom to top: [name, what turns it (null: nothing, "a" the great wheel, "r" the ring, "b"/"d" a pinion), markup]. */
export function layers(detail = true) {
  const L = [];
  L.push(["base", null, `<circle cx="50" cy="50" r="46" fill="${NAVY}"/><circle cx="50" cy="50" r="45" fill="none" stroke="${BR}" stroke-width="${detail ? .7 : 1}"/>${tier(1, detail)}<circle cx="50" cy="50" r="22" fill="${NAVY2}"/>`]);
  const ring = `<path fill-rule="evenodd" d="M${f(50 + RING_OUT)} 50A${f(RING_OUT)} ${f(RING_OUT)} 0 1 1 ${f(50 - RING_OUT)} 50A${f(RING_OUT)} ${f(RING_OUT)} 0 1 1 ${f(50 + RING_OUT)} 50Z ${path(int(NR, RR, PH_R).map(([x, y]) => [50 + x, 50 + y]))}" fill="${BR}" stroke="${BRD}" stroke-width=".3"/>`;
  L.push(["ring", "r", tier(2, detail) + ring]);
  for (const k of Object.keys(PIN)) {
    const [cx, cy] = P(D, PIN[k]);
    L.push([`pin-${k}`, k,
      `<path transform="translate(${f(cx)} ${f(cy)})" d="${path(ext(NBB, RBB, PH_BB[k]))}" fill="${BR}" stroke="${BRD}" stroke-width=".3"/>` +
      `<path transform="translate(${f(cx)} ${f(cy)})" d="${path(ext(NBF, RBF, PH_BF[k]))}" fill="${BRL}" stroke="${BRD}" stroke-width=".3"/><circle cx="${f(cx)}" cy="${f(cy)}" r="1.2" fill="${NAVY2}"/>`]);
  }
  L.push(["great", "a", tier(0, detail) + greatWheel()]);
  let fixed = `<circle cx="50" cy="50" r="24.25" fill="none" stroke="${BR}" stroke-width="4.5"/><circle cx="50" cy="50" r="26.5" fill="none" stroke="${CREAM}" stroke-width=".7"/><circle cx="50" cy="50" r="22" fill="none" stroke="${CREAM}" stroke-width=".7"/>`;
  if (detail) {
    let t = "";
    for (let k = 0; k < 60; k++) { const [x, y] = P(k % 5 ? 22.9 : 22.3, k * 6), [x2, y2] = P(25.6, k * 6); t += `M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}`; }
    fixed += `<path d="${t}" stroke="${NAVY}" stroke-width=".45"/>`;
  }
  for (const [ang, [tx, ty]] of [[PIN.b, P(D, PIN.b)], [PIN.d, P(D, PIN.d)], [270, [50, 50]]]) {
    const [x0, y0] = P(23, ang);
    fixed += `<path d="M${f(x0)} ${f(y0)}L${f(tx)} ${f(ty)}" stroke="${BRD}" stroke-width="2.1"/><path d="M${f(x0)} ${f(y0)}L${f(tx)} ${f(ty)}" stroke="${CREAM}" stroke-width=".5" opacity=".85"/>`;
  }
  L.push(["fixed", null, fixed]);
  L.push(["bar-ring", "r", bar(ALPHA_OUT, R_RIM, 41.15, 2.6, 1.7) + screw(...P(R_RIM, ALPHA_OUT), 1.3, ALPHA_OUT + 30) + screw(...P(41.15, ALPHA_OUT), 1.5, ALPHA_OUT + 30)]);
  L.push(["bar-great", "a", bar(ALPHA_IN, 2.6, 33.85, 2.6, 1.7) + screw(...P(33.85, ALPHA_IN), 1.5, ALPHA_IN + 30)]);
  let top = "";
  for (const [ang, [tx, ty], jr, rr] of [[PIN.b, P(D, PIN.b), 1.7, .85], [PIN.d, P(D, PIN.d), 1.7, .85], [270, [50, 50], 2.6, 1.3]]) {
    top += jewel(tx, ty, jr, rr); const [x0, y0] = P(24.25, ang); top += screw(x0, y0, 1.45, ang + 40);
  }
  L.push(["top", null, top]);
  return L;
}

const SPEED = { a: [T_A, 1], r: [T_R, -1], b: [T_B, -1], d: [T_B, -1] };   // seconds a turn, and the direction (1 clockwise)
const about = k => (k === "a" || k === "r" ? [50, 50] : P(D, PIN[k]));
const SVG = inner => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const smil = (k, scale = 1) => {
  const [dur, dir] = SPEED[k], [x, y] = about(k);
  return `<animateTransform attributeName="transform" type="rotate" values="0 ${f(x)} ${f(y)};${360 * dir} ${f(x)} ${f(y)}" dur="${f(dur * scale)}s" repeatCount="indefinite"/>`;
};
const still = detail => SVG(layers(detail).map(([, , body]) => `<g>${body}</g>`).join(""));

/** The tiny cut, for 16 to 24 px: the disc, the three tiers, the o, the great wheel; turning when `animated` (faster than the movement's). */
const tiny = animated => {
  const turn = (k, body) => `<g>${animated ? smil(k, .5) : ""}${body}</g>`;
  return SVG(`<circle cx="50" cy="50" r="46" fill="${NAVY}"/><circle cx="50" cy="50" r="45" fill="none" stroke="${BR}" stroke-width="1.4"/>${turn("r", tier(2, false))}${tier(1, false)}${turn("a", tier(0, false))}` +
    `<circle cx="50" cy="50" r="24.25" fill="none" stroke="${BR}" stroke-width="5"/><circle cx="50" cy="50" r="22" fill="${NAVY2}"/>` +
    turn("a", `<g transform="translate(50 50)"><path d="${path(ext(NA, RA, PH_A))}" fill="${BRL}"/><circle r="${f(RA - 1.25 * M - 1.4)}" fill="${NAVY2}"/>` +
      [45, 135, 225, 315].map(a => `<path d="M-.9 0H.9V${f(-(RA - 1.25 * M - 1))}H-.9Z" fill="${BRL}" transform="rotate(${a})"/>`).join("") +
      `<circle r="2.8" fill="${RUBY}" stroke="${BRL}" stroke-width="1"/></g>`));
};

/** The small cut inline: groups carry the classes style.css turns them by (`.turning .cx .cx-a`, ...), pinions about their own axes. */
const inline = () => {
  const cls = { a: "cx-a", r: "cx-r", b: "cx-b", d: "cx-d" };
  const g = ([, k, body]) => k ? `<g class="${cls[k]}"${k === "b" || k === "d" ? ` style="transform-origin:${f(about(k)[0])}px ${f(about(k)[1])}px"` : ""}>${body}</g>` : body;
  return `<svg class="cx" viewBox="0 0 100 100" aria-hidden="true">${layers(false).map(g).join("")}</svg>`;
};

/** Every generated file: path -> text. */
export function build() {
  const out = {}, header = what => `<!-- Codex: ${what} (drawn by tools/build-mark.mjs; edit that, not this) -->\n`;
  for (const [name, , body] of layers(true)) out[`mark/${name}.svg`] = SVG(body) + "\n";
  out["logo.svg"] = header("the logo, a C of three tiers round a watch movement (brass on navy)") + still(false) + "\n";
  out["icon.svg"] = header("the app and page icon, the logo on a rounded navy tile") + still(false).replace(`<circle cx="50" cy="50" r="46" fill="${NAVY}"/>`, `<rect width="100" height="100" rx="22" fill="${NAVY}"/>`) + "\n";
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
