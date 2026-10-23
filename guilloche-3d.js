// Guilloché in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): a wristwatch seen from
// above whose dial is the plate being cut. Each cut is a ribbon of grooves lying on the dial; a groove is a V in section, so
// its two walls face different ways, and each wall is lit as the metal it is (a studio of soft boxes reflected in it): the
// glints sweep round a rose as the watch is tilted, which is what makes a guilloché look like one. The dial's own finish is
// worked out in its shader (rays from the centre, rings round it, lacquer, grain), and so are the case's metal, a fluted or
// coin-edged bezel, the strap's leather, crocodile or rubber; the shapes (case, lugs, crown, hands, markers, the rosette)
// are built in code, nothing is a model or a texture. Each plate has its own watch (guilloche-watch.js). Cut right, the
// plate is engraved pass by pass under a cutter, then the markers and hands are set, the glass goes on and the camera draws
// back to show the whole watch. In the corner a gauge shows the rosette of the cut in hand, turning against its rubbing
// block, so the lobes and throw are seen where they come from. The page (guilloche.js) calls: set, refresh, peek, ghost,
// reveal, assemble, mark, orbit, zoom, pause; guilloche-flat.js answers to the same calls where there is no WebGL.
import * as THREE from "./vendor/three.js";
import { scale } from "./wide.js";
import { passes, settingsOf, KNOBS } from "./guilloche-engine.js";
import { watchOf, METALS, ghostOf, luma } from "./guilloche-watch.js";

const DOUBLE = 2, ADD = 2, NORMAL = 1;                      // THREE.DoubleSide, AdditiveBlending, NormalBlending (not in the bundle's exports)
const TAU = Math.PI * 2, DEG = Math.PI / 180, M = 720;      // M: samples round a pass, as the engine's `passes` has them
const ease = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const EDGE = [p => Math.sin(p), p => 2 * Math.abs(Math.sin(p / 2)) - 1, p => (2 / Math.PI) * Math.asin(Math.sin(p))];

// ---------- the light and the surfaces ----------
const LIGHT = { uKey: { value: new THREE.Vector3(-0.5, 0.78, 0.42).normalize() }, uEnv: { value: 1 }, uTime: { value: 0 }, uPx: { value: 0.004 }, uW: { value: 0.0042 } };
const VDECL = "uniform float uPx; uniform float uW; varying vec3 vTg;";
const COMMON = `
uniform vec3 uKey; uniform float uEnv; uniform float uTime;
varying vec3 vW; varying vec3 vNw; varying vec3 vL; varying vec3 vTg;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// a softbox seen in the direction R: a rectangle round the direction c, half-sized hs, soft at its edge
float rect(vec3 R, vec3 c, vec3 u, vec3 v, vec2 hs, float soft) {
  float d = dot(R, c); if (d < .02) return 0.;
  vec2 q = clamp((hs - abs(vec2(dot(R, u), dot(R, v)) / d)) / soft, 0., 1.);
  return q.x * q.y * smoothstep(.02, .15, d);
}
// what a polished surface reflects: a dark room with a pale ceiling, a big softbox up and to the left, a strip light on the
// right, a long one in front, and the key's own glint; \`soft\` blurs them (a brushed surface sees them blurred)
vec3 studio(vec3 R, float soft) {
  vec3 col = mix(vec3(.035, .035, .04), vec3(.33, .34, .37), smoothstep(-.4, .9, R.y));
  { vec3 c = normalize(vec3(-.5, .78, .42)), u = normalize(cross(c, vec3(0., 1., 0.))), v = cross(c, u); col += vec3(3.2, 3.1, 2.9) * rect(R, c, u, v, vec2(.62, .42), soft + .06); }
  { vec3 c = normalize(vec3(.85, .38, -.25)), u = normalize(cross(c, vec3(0., 1., 0.))), v = cross(c, u); col += vec3(1.6, 1.9, 2.4) * rect(R, c, u, v, vec2(.10, .75), soft + .04); }
  { vec3 c = normalize(vec3(.1, .55, .9)), u = normalize(cross(c, vec3(0., 1., 0.))), v = cross(c, u); col += vec3(.8, .8, .85) * rect(R, c, u, v, vec2(.7, .12), soft + .05); }
  col += vec3(2.2, 2.1, 1.9) * pow(max(dot(R, uKey), 0.), 90.) / (1. + soft * 6.);
  return col * uEnv;
}
vec3 metal(vec3 base, vec3 N, float rough) {
  vec3 V = normalize(cameraPosition - vW);
  float nv = clamp(dot(N, V), 0., 1.);
  vec3 F = base + (1. - base) * pow(1. - nv, 5.);
  return F * studio(reflect(-V, N), rough * 1.4);
}
vec3 matte(vec3 albedo, vec3 N) {
  float nl = max(dot(N, uKey), 0.);
  vec3 amb = mix(vec3(.08, .085, .1), vec3(.32, .35, .4), N.y * .5 + .5);
  return albedo * (amb + vec3(1., .96, .9) * nl * .85) * uEnv;
}`;
/**
 * A surface drawn with the lighting above. \`main\` sets outgoingLight from diffuseColor and the varyings vW (world position),
 * vNw (world normal), vL (the mesh's own position), vTg (the way round, in the world); \`own\` are its uniforms, \`decl\`
 * what it declares, \`vertex\` runs in the vertex shader (it may move \`transformed\`), \`vdecl\` declares for it, \`normal\` and
 * \`tangent\` are the GLSL for the vertex's normal and the way round (the mesh's own).
 */
function surface({ main, own = {}, decl = "", vertex = "", vdecl = "", normal = "normal", tangent = "vec3(-transformed.z, 0., transformed.x)", ...opts }) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: DOUBLE, ...opts });
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, LIGHT, own);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\nvarying vec3 vW; varying vec3 vNw; varying vec3 vL; ${VDECL}\n${vdecl}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${vertex}\nvL = transformed; vNw = normalize(mat3(modelMatrix) * ${normal}); vW = (modelMatrix * vec4(transformed, 1.)).xyz; vTg = mat3(modelMatrix) * ${tangent};`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${COMMON}\n${decl}`)
      .replace("#include <opaque_fragment>", `${main}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => decl + main + vertex + vdecl + normal + tangent;
  m.userData.own = own;
  return m;
}
const col3 = hex => new THREE.Color(hex);

// the dial: its finish, the printed minute track on the flange, the hairline step where the flange begins, the shade under the bezel
const DIAL_MAIN = `{
  vec2 p = vL.xz; float r = length(p), ang = atan(p.x, -p.y), aa = fwidth(r) * 1.2 + 1e-4;
  vec3 N = vec3(0., 1., 0.), V = normalize(cameraPosition - vW), H = normalize(uKey + V);
  vec3 T = r > 1e-3 ? vec3(p.x, 0., p.y) / r : vec3(1., 0., 0.);
  if (uFinish > 1.5 && uFinish < 2.5) T = vec3(-T.z, 0., T.x);
  float tdh = dot(T, H), aniso = pow(sqrt(max(1. - tdh * tdh, 0.)), 120.);
  float fine = .6 + .4 * h21(vec2(floor(ang * 340.), 3.));
  vec3 base = uBase * (1. - .12 * smoothstep(.55, 1., r));
  if (r > 1.) base *= uRing;
  vec3 col = matte(base, N);
  if (uFinish < 2.5) col += uTint * aniso * fine * .85 * uEnv * (uFinish > .5 ? .8 : 1.);
  else if (uFinish < 3.5) col += uTint * pow(max(dot(N, H), 0.), 26.) * .2 * uEnv;
  else col += uTint * (step(.982, h21(floor(p * 700.))) * pow(max(dot(N, H), 0.), 6.) * .9 + pow(max(dot(N, H), 0.), 18.) * .08) * uEnv;
  float seg = ${TAU} / 60., da = abs(mod(ang + seg * .5, seg) - seg * .5) * r, five = ${TAU} / 12., db = abs(mod(ang + five * .5, five) - five * .5) * r;
  float band = (1. - smoothstep(1.135, 1.135 + aa, r)) * smoothstep(1.07 - aa, 1.07, r);
  float ink = max((1. - smoothstep(.0035, .0035 + aa, da)) * band * smoothstep(1.095 - aa, 1.095, r), (1. - smoothstep(.0075, .0075 + aa, db)) * band);
  ink = max(ink, (1. - smoothstep(0., aa * 1.4, abs(r - 1.148) - .003)) * .9);
  col = mix(col, uInk * uEnv * .9, ink);
  float stepLine = 1. - smoothstep(0., aa * 1.6, abs(r - 1.0));
  col = mix(col, col * .4, stepLine * .8);
  col *= mix(1., .5, smoothstep(1.105, 1.165, r));
  outgoingLight = col;
}`;
const FINISH = { sunburst: 0, satin: 2, matte: 3, grain: 4 };                 // the shader's numbers for a dial's finish
const dialMaterial = spec => {
  const base = col3(spec.dial.base);
  return surface({ main: DIAL_MAIN, decl: "uniform vec3 uBase; uniform vec3 uTint; uniform vec3 uInk; uniform float uFinish; uniform float uRing;",
    own: { uBase: { value: base }, uTint: { value: base.clone().lerp(col3("#ffffff"), 0.62) }, uInk: { value: col3(spec.dial.ink) }, uFinish: { value: FINISH[spec.dial.finish] ?? 0 }, uRing: { value: luma(spec.dial.base) > 0.45 ? 0.9 : 1.25 } } });
};

// the grooves: a ribbon of two vertices a point, a V in section, each wall lit as the metal it is
const GROOVE_VERT = "attribute float aSide; attribute vec2 aPerp; attribute float aT; varying float vU; varying float vT; varying vec3 vBw;";
const GROOVE_VERTEX = `float hw = max(uW, uPx * .9); transformed = position + vec3(aPerp.x, 0., aPerp.y) * aSide * hw; vU = aSide; vT = aT; vBw = mat3(modelMatrix) * vec3(aPerp.x, 0., aPerp.y);`;
const GROOVE_DECL = "varying float vU; varying float vT; varying vec3 vBw; uniform float uFrom; uniform float uTotal; uniform float uReveal; uniform float uAlpha;";
const ENGRAVED_MAIN = `{
  float au = abs(vU), cover = 1. - smoothstep(.5, 1., au);
  if ((uFrom + vT) / uTotal > uReveal) discard;
  vec3 N = normalize(vNw - sign(vU) * normalize(vBw) * 1.15 * smoothstep(.04, .3, au));
  vec3 c = matte(uBase, N) * .7 + metal(uTint, N, .06) * 1.35;
  outgoingLight = c * mix(.5, 1., smoothstep(0., .7, au));
  diffuseColor.a = cover * uAlpha;
}`;
const GHOST_MAIN = `{
  float au = abs(vU);
  outgoingLight = uGhost;
  diffuseColor.a = (1. - smoothstep(.45, 1., au)) * uAlpha;
}`;
const grooveMaterial = (spec, from, total) => surface({ main: ENGRAVED_MAIN, vdecl: GROOVE_VERT, vertex: GROOVE_VERTEX, normal: "vec3(0., 1., 0.)", transparent: true, depthWrite: false,
  decl: `${GROOVE_DECL} uniform vec3 uBase; uniform vec3 uTint;`,
  own: { uBase: { value: col3(spec.dial.base) }, uTint: { value: col3(spec.dial.base).lerp(col3("#ffffff"), 0.55) }, uFrom: { value: from }, uTotal: { value: total }, uReveal: { value: 1 }, uAlpha: { value: 1 } } });
const ghostMaterial = (spec, from, total) => surface({ main: GHOST_MAIN, vdecl: GROOVE_VERT, vertex: GROOVE_VERTEX, normal: "vec3(0., 1., 0.)", transparent: true, depthWrite: false,
  decl: `${GROOVE_DECL} uniform vec3 uGhost;`,
  own: { uGhost: { value: col3(ghostOf(spec.dial.base)) }, uFrom: { value: from }, uTotal: { value: total }, uReveal: { value: 1 }, uAlpha: { value: 0.62 } } });

// the case: metal with a fluted top or a coin-edged side, brushed on its flanks
const caseMain = ang => `{
  vec3 N = normalize(vNw), Tg = normalize(vTg);
  float ang = ${ang};
  if (uFlute > 0.) N = normalize(N + Tg * sin(ang * uFlute) * .6 * smoothstep(.6, .92, N.y));
  if (uKnurl > 0.) N = normalize(N + Tg * sin(ang * uKnurl) * .55 * (1. - smoothstep(.15, .5, abs(N.y))));
  float brush = (1. - smoothstep(.3, .75, N.y)) * uBrush, streak = h21(vec2(floor(ang * 600.), floor(vL.y * 60.)));
  vec3 c = metal(uMetal, N, uRough + brush * (.2 + .15 * streak));
  c *= mix(.55, 1., smoothstep(-.6, -.05, vL.y));
  outgoingLight = c;
}`;
const CASE_DECL = "uniform vec3 uMetal; uniform float uRough; uniform float uFlute; uniform float uKnurl; uniform float uBrush;";
const metalMaterial = (key, o = {}, ang = "atan(vL.x, -vL.z)", tangent) => {
  const k = METALS[key] || METALS.steel;
  return surface({ main: caseMain(ang), decl: CASE_DECL, ...(tangent ? { tangent } : {}),
    own: { uMetal: { value: col3(k.hex) }, uRough: { value: k.rough }, uFlute: { value: o.flute || 0 }, uKnurl: { value: o.knurl || 0 }, uBrush: { value: o.brush ?? 0.6 } } });
};
const HAND_MAIN = "{ outgoingLight = metal(uMetal, normalize(vNw), uRough) * uShade; }";   // (uShade dims a hand: steel under a softbox would burn out)
const handMaterial = (hex, rough = 0.07) => surface({ main: HAND_MAIN, decl: "uniform vec3 uMetal; uniform float uRough; uniform float uShade;", own: { uMetal: { value: col3(hex) }, uRough: { value: rough }, uShade: { value: 0.8 } } });
const SHADOW_MAIN = "{ outgoingLight = vec3(0.); diffuseColor.a = uAlpha; }";
const shadowMaterial = alpha => surface({ main: SHADOW_MAIN, decl: "uniform float uAlpha;", own: { uAlpha: { value: alpha } }, transparent: true, depthWrite: false });
const BLOB_MAIN = "{ float d = length(vL.xy); outgoingLight = vec3(0.); diffuseColor.a = pow(max(1. - d, 0.), 2.2) * uAlpha; }";

// the strap: leather with stitching, crocodile scales, ribbed rubber, suede
const STRAP_MAIN = `{
  vec3 N = normalize(vNw);
  float u = vL.x / .59, v = abs(vL.z), edge = smoothstep(.8, 1., abs(u));
  vec3 col = uStrap;
  float grain = h21(floor(vec2(vL.x, vL.z) * 55.));
  float spec = .5, shin = 30.;
  if (uKind < .5) {
    col *= .88 + .24 * grain;
    float stitch = (1. - smoothstep(.012, .02, abs(abs(vL.x) - .5))) * step(.5, fract(v * 13.));
    col = mix(col, uStrap * 1.9 + .06, stitch * .8);
    spec = .55; shin = 36.;
  } else if (uKind < 1.5) {
    vec2 q = vec2(vL.x * 16., v * 11.), id = floor(q), f = fract(q); float best = 9., second = 9.; vec2 cid = id;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)), o = vec2(h21(id + g), h21(id + g + 7.3)); float d = length(g + o - f); if (d < best) { second = best; best = d; cid = id + g; } else if (d < second) second = d; }
    float rim = smoothstep(0., .18, second - best);
    col *= (.8 + .4 * h21(cid)) * mix(.4, 1., rim);
    N = normalize(N + vec3((h21(cid + 1.7) - .5) * .22, 0., (h21(cid + 4.1) - .5) * .22) * rim);
    spec = .45; shin = 40.;
  } else if (uKind < 2.5) {
    N = normalize(N + vec3(0., 0., cos(v * 70.)) * .35);
    col *= .8 + .15 * cos(v * 70.);
    spec = .22; shin = 14.;
  } else {
    col *= .85 + .3 * h21(floor(vec2(vL.x, vL.z) * 220.));
    spec = .03; shin = 6.;
  }
  col *= 1. - .55 * edge;
  vec3 V = normalize(cameraPosition - vW), Hh = normalize(uKey + V);
  outgoingLight = matte(col, N) + vec3(1., .95, .88) * pow(max(dot(N, Hh), 0.), shin) * spec * .5 * uEnv * (1. - edge);
}`;

// the glass: a faint reflection of the studio, brightest at the rim
const GLASS_MAIN = `{
  vec3 N = normalize(vNw), V = normalize(cameraPosition - vW);
  float f = pow(1. - abs(dot(N, V)), 3.);
  outgoingLight = studio(reflect(-V, N), .1) * (.045 + .5 * f) * uGlass + vec3(.55, .75, .9) * f * .06 * uGlass;
  diffuseColor.a = 1.;
}`;
// the glow of the cutter's tip
const GLOW_MAIN = "{ float d = length(vL.xy); outgoingLight = uGlowCol * uGlowA; diffuseColor.a = pow(max(1. - d, 0.), 2.4); }";
// the ring that shows which cut a clue is about
const RING_MAIN = "{ outgoingLight = uRingCol * uRingA; diffuseColor.a = 1.; }";

// ---------- shapes ----------
/**
 * A solid of revolution round the vertical from an outline of points [r, y, hard] taken outward over the top and down the
 * side (the outline's left is its outside): a point is smooth (its two segments share a normal) unless it's hard (a sharp
 * edge). \`facet\` makes a polygon of \`segs\` flat sides, a face at twelve o'clock, instead of a round.
 */
function lathe(pts, segs = 128, facet = false) {
  const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const dr = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dr, dy) || 1; seg.push([-dy / l, dr / l]); }
  const prof = [];
  pts.forEach(([r, y, hard], i) => {
    const a = seg[i - 1], b = seg[i];
    if (!a || !b) { const n = a || b; prof.push([r, y, n[0], n[1]]); }
    else if (hard) prof.push([r, y, a[0], a[1]], [r, y, b[0], b[1]]);
    else { const nr = a[0] + b[0], ny = a[1] + b[1], l = Math.hypot(nr, ny) || 1; prof.push([r, y, nr / l, ny / l]); }
  });
  const pos = [], nor = [], idx = [], m = prof.length, d = TAU / segs;
  if (!facet) {
    for (let s = 0; s <= segs; s++) {
      const a = s * d, c = Math.sin(a), n = -Math.cos(a);
      for (const [r, y, nr, ny] of prof) { pos.push(r * c, y, r * n); nor.push(nr * c, ny, nr * n); }
    }
    for (let s = 0; s < segs; s++) for (let i = 0; i < m - 1; i++) { const a = s * m + i, b = a + m; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  } else {
    const k = 1 / Math.cos(Math.PI / segs);
    for (let s = 0; s < segs; s++) {
      const a0 = (s - 0.5) * d, a1 = (s + 0.5) * d, am = s * d, base = pos.length / 3;
      for (const a of [a0, a1]) for (const [r, y, nr, ny] of prof) { pos.push(r * k * Math.sin(a), y, -r * k * Math.cos(a)); nor.push(nr * Math.sin(am), ny, -nr * Math.cos(am)); }
      for (let i = 0; i < m - 1; i++) { const a = base + i, b = a + m; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
/** An arc of a fillet from (r0, y0) round to (r1, y1) as outline points (a quarter of an ellipse), smooth. */
const fillet = (r0, y0, r1, y1, n = 5) => Array.from({ length: n + 1 }, (_, i) => {
  const t = (i / n) * (Math.PI / 2);
  return [r0 + (r1 - r0) * Math.sin(t), y0 + (y1 - y0) * (1 - Math.cos(t))];
});
const DIAL_R = 1.0, FLANGE_R = 1.2, TOP = 0.105;
/** The bezel's outline for a make: from just inside the glass seat, up over the top and down the outside. */
function bezelOutline(kind) {
  const inner = [[1.15, -0.02, false], [1.15, 0.06, true], [1.168, 0.092, true]];
  if (kind === "domed") return [...inner, [1.2, 0.099], [1.25, 0.092], [1.29, 0.074], [1.315, 0.05], [1.322, 0.02], [1.322, -0.02, true]];
  if (kind === "step") return [...inner, [1.168, 0.104, true], [1.215, 0.104, true], [1.215, 0.086, true], [1.28, 0.086], [1.305, 0.078], [1.32, 0.058], [1.322, 0.03], [1.322, -0.02, true]];
  if (kind === "fluted") return [...inner, [1.168, 0.108, true], [1.28, 0.1], [1.305, 0.09], [1.32, 0.066], [1.324, 0.03], [1.324, -0.02, true]];
  const top = [...inner, [1.168, TOP, true], ...fillet(1.27, TOP, 1.322, 0.062, 4)];
  return [...top, [1.322, 0.0], [1.322, -0.02, true]];
}
/** The case under the bezel: the flank, a waist, a chamfer and the back. */
const bodyOutline = () => [[1.322, -0.02, false], [1.322, -0.2], [1.305, -0.42, false], [1.27, -0.52, true], [1.2, -0.56, true], [0.6, -0.56, false], [0, -0.56, false]];

function extrudeFlat(shape, depth, bevel = 0.01) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);                                  // the shape's y becomes the way to twelve o'clock (-z), its extrusion up
  return g;
}
const polygon = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
/** A hand or marker as a ridged blade: stations [along, half-width] from the tail to the tip, a ridge down the middle so its two faces catch light differently. */
function blade(stations, rise = 0.45) {
  const pos = [], nor = [];
  const tri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    for (const p of [a, b, c]) { pos.push(...p); nor.push(nx / l, ny / l, nz / l); }
  };
  for (let i = 0; i < stations.length - 1; i++) {
    const [s0, w0] = stations[i], [s1, w1] = stations[i + 1], h0 = w0 * rise, h1 = w1 * rise;
    const L0 = [-w0, 0, -s0], R0 = [w0, 0, -s0], T0 = [0, h0, -s0], L1 = [-w1, 0, -s1], R1 = [w1, 0, -s1], T1 = [0, h1, -s1];
    tri(L0, L1, T1); tri(L0, T1, T0); tri(R0, T1, R1); tri(R0, T0, T1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
const HAND_SHAPES = {                                      // [along as a share of the length, half-width as a share of the width]
  baton: [[-0.14, 0.5], [0, 1], [0.93, 1], [1, 0.05]],
  dauphine: [[-0.12, 0.45], [0, 1], [1, 0]],
  leaf: [[-0.12, 0.4], [0.06, 0.7], [0.45, 1], [0.8, 0.55], [1, 0]],
  sword: [[-0.1, 0.45], [0, 1], [0.55, 0.82], [1, 0]],
  spade: [[-0.12, 0.3], [0.6, 0.3], [0.68, 1], [0.77, 0.3], [1, 0]],
  alpha: [[-0.1, 0.5], [0, 0.75], [0.62, 0.75], [0.64, 1], [0.96, 1], [1, 0.1]],
};
const handGeo = (style, length, width) => blade((HAND_SHAPES[style] || HAND_SHAPES.baton).map(([s, w]) => [s * length, w * width]));

/** The strap going away from the lugs (sign 1: towards six o'clock): a band that droops a little, 6 across and 28 along. */
function strapGeo(sign) {
  const NS = 28, NX = 6, s0 = 1.5, s1 = 5, W = 0.59, pos = [], nor = [], idx = [];
  const y = s => -0.15 - 0.014 * (s - s0) ** 2, dy = s => -0.028 * (s - s0);
  for (let i = 0; i <= NS; i++) {
    const s = lerp(s0, s1, i / NS);
    for (let j = 0; j <= NX; j++) {
      const u = (j / NX) * 2 - 1, tilt = Math.sign(u) * ease(clamp01((Math.abs(u) - 0.8) / 0.2)) * 0.9;
      const w = W * (1 - 0.1 * (s - s0) / (s1 - s0));
      pos.push(u * w, y(s), sign * s);
      const nx = tilt, ny = 1, nz = -dy(s) * sign, l = Math.hypot(nx, ny, nz);
      nor.push(nx / l, ny / l, nz / l);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NX; j++) { const a = i * (NX + 1) + j, b = a + NX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
function quad() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
/** A ribbon's buffers for up to \`cap\` passes: two vertices a point (the groove's two edges), the index fixed. */
const RIBBON_INDEX = new Map();                              // a ribbon's triangles by how many passes it has room for (a plain Array: setIndex picks 32 bits itself)
function ribbon(cap) {
  const verts = cap * (M + 1) * 2;
  if (!RIBBON_INDEX.has(cap)) {
    const idx = [];
    for (let j = 0; j < cap; j++) for (let m = 0; m < M; m++) { const a = (j * (M + 1) + m) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    RIBBON_INDEX.set(cap, idx);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(verts * 3), 3));
  g.setAttribute("aPerp", new THREE.Float32BufferAttribute(new Float32Array(verts * 2), 2));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(new Float32Array(verts), 1));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(new Float32Array(verts), 1));
  g.setIndex(RIBBON_INDEX.get(cap));
  g.setDrawRange(0, 0);
  return g;
}
/** Writes passes into a ribbon (the plate's own units, lying at height h). */
function cutRibbon(g, list, h) {
  const P = g.attributes.position.array, Q = g.attributes.aPerp.array, S = g.attributes.aSide.array, T = g.attributes.aT.array;
  list.forEach((p, j) => {
    for (let m = 0; m <= M; m++) {
      const pm = (m ? m - 1 : M - 1) * 2, pn = (m < M ? m + 1 : 1) * 2;
      let tx = p[pn] - p[pm], tz = p[pn + 1] - p[pm + 1];
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      const v0 = (j * (M + 1) + m) * 2;
      for (let s = 0; s < 2; s++) {
        const v = v0 + s;
        P[3 * v] = p[2 * m]; P[3 * v + 1] = h; P[3 * v + 2] = p[2 * m + 1];
        Q[2 * v] = -tz; Q[2 * v + 1] = tx;
        S[v] = s ? 1 : -1;
        T[v] = j + m / M;
      }
    }
  });
  for (const a of ["position", "aPerp", "aSide", "aT"]) g.attributes[a].needsUpdate = true;
  g.setDrawRange(0, list.length * M * 6);
}

// ---------- the watch ----------
/** Sets uniforms on a material (its own uniform objects are shared with the compiled shader, so this works before and after it compiles). */
function setU(mat, vals) { for (const [k, v] of Object.entries(vals)) if (mat.userData.own[k]) mat.userData.own[k].value = v; }

export function createWatch(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });             // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "lg-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The watch: the dial you are engraving, with the target faint on it");
  host.append(canvas);

  const scene = new THREE.Scene(), watch = new THREE.Group();
  scene.add(watch);
  // a perspective camera from an orthographic one's parts (the bundle has none): its matrices are set by hand
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};

  const view = { job: null, run: null, ghost: true, peek: false, reveal: 1, assembled: 0, markCut: -1, gauge: true };
  const cam = { az: 0, el: 78 * DEG, zoom: 1, pan: [0, 0], sway: [0, 0] };
  let W = 1, H = 1, spec = null, parts = null, layers = [], paused = false, t = 0, last = performance.now(), lastDt = 0.016;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ----- the camera -----
  const DIST = 16, E0 = 1.5, E1 = 2.55, MAX_ZOOM = 6;                       // how far off, and how much of the watch the shorter side shows when close and when drawn back
  function pose() {
    // the tilt you gave it is kept when the watch is drawn back: the finished view starts lower, but is yours to turn and zoom
    const f = ease(view.assembled), el = lerp(78 * DEG, 58 * DEG, f) + (cam.el - 78 * DEG) + cam.sway[1], az = cam.az + cam.sway[0];
    camera.position.set(Math.sin(az) * Math.cos(el) * DIST, Math.sin(el) * DIST, Math.cos(az) * Math.cos(el) * DIST);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, lerp(0, 0.25, f));
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const half = lerp(E0, E1, f) / cam.zoom, hu = W >= H ? half * (W / H) : half, hv = W >= H ? half : half * (H / W);
    const px = -cam.pan[0], py = cam.pan[1];                     // the picture follows the finger: the window moves the other way
    camera.projectionMatrix.makePerspective((-hu + px) / DIST, (hu + px) / DIST, (hv + py) / DIST, (-hv + py) / DIST, 1, 100);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    LIGHT.uPx.value = (2 * hv) / H;
  }

  // ----- building the watch of a plate -----
  let owned = [];                                            // geometries and materials of the watch, to let go of when another is built
  const keep = o => { owned.push(o); return o; };
  const mesh = (geo, mat) => { keep(geo); keep(mat); const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; return m; };
  function build() {
    while (watch.children.length) watch.remove(watch.children[0]);
    owned.splice(0).forEach(o => o.dispose?.());
    layers = [];
    const c = spec.case, bodyMetal = c.body || c.metal, octagon = c.bezel === "octagon", P = {};
    P.dial = mesh(lathe([[0, 0], [FLANGE_R, 0]], 96), dialMaterial(spec));
    const bezelKind = octagon ? "smooth" : c.bezel;
    const bezelMat = metalMaterial(c.metal, { flute: bezelKind === "fluted" ? 72 : 0, knurl: c.bezel === "coin" ? 150 : 0, brush: 0.15 });
    const bodyMat = metalMaterial(bodyMetal, { brush: 0.8 });
    P.bezel = mesh(lathe(bezelOutline(bezelKind), octagon ? 8 : 160, octagon), bezelMat);
    P.body = mesh(lathe(bodyOutline(), octagon ? 8 : 160, octagon), bodyMat);
    watch.add(P.dial, P.bezel, P.body);
    if (octagon) {                                          // eight screws at the corners of the bezel
      const screw = keep(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6)), sm = keep(metalMaterial("steel", { brush: 0.2 }));
      for (let s = 0; s < 8; s++) {
        const a = (s + 0.5) * (TAU / 8), r = 1.245 / Math.cos(Math.PI / 8), m = new THREE.Mesh(screw, sm);
        m.position.set(r * Math.sin(a), TOP + 0.004, -r * Math.cos(a)); m.rotation.y = a; m.frustumCulled = false; watch.add(m);
      }
    }
    // four lugs: a profile extruded across
    const lugShape = new THREE.Shape();
    [[1.05, 0.06], [1.46, 0.062], [1.74, 0.0], [1.82, -0.1], [1.72, -0.2], [1.42, -0.23], [1.05, -0.34]].forEach(([x, y], i) => (i ? lugShape.lineTo(x, y) : lugShape.moveTo(x, y)));
    lugShape.closePath();
    const lug = keep(new THREE.ExtrudeGeometry(lugShape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6 }));
    lug.rotateY(-Math.PI / 2);
    lug.computeBoundingBox();
    lug.translate(-(lug.boundingBox.min.x + lug.boundingBox.max.x) / 2, 0, 0);
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const m = new THREE.Mesh(lug, bodyMat); m.position.x = sx * 0.72; m.scale.z = sz; m.frustumCulled = false; watch.add(m); }
    // the strap, both ways
    const strapKind = Math.max(0, ["leather", "croc", "rubber", "suede"].indexOf(spec.strap.kind));
    const strapMat = keep(surface({ main: STRAP_MAIN, decl: "uniform vec3 uStrap; uniform float uKind;", own: { uStrap: { value: col3(spec.strap.colour) }, uKind: { value: strapKind } } }));
    for (const sg of [1, -1]) { const m = new THREE.Mesh(keep(strapGeo(sg)), strapMat); m.frustumCulled = false; watch.add(m); }
    // the crown at three o'clock, its axis made the x axis
    const crownGeo = keep(lathe([[0, 0], [0.07, 0], [0.07, 0.07, true], [0.15, 0.07, true], [0.15, 0.1], [0.152, 0.26], [0.13, 0.285, true], [0, 0.285]], 40));
    crownGeo.rotateZ(-Math.PI / 2);
    const crown = new THREE.Mesh(crownGeo, keep(metalMaterial(c.metal, { knurl: 30, brush: 0.1 }, "atan(vL.y, vL.z)", "vec3(0., -transformed.z, transformed.y)")));
    crown.position.set(1.3, -0.06, 0); crown.frustumCulled = false;
    watch.add(crown);
    // a soft shadow on the table under the watch
    const blob = mesh(quad(), surface({ main: BLOB_MAIN, decl: "uniform float uAlpha;", own: { uAlpha: { value: 0.42 } }, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.scale.set(3.3, 5.6, 1); blob.position.set(0.28, -0.9, 0.36); blob.renderOrder = -5;
    watch.add(blob);
    P.cuts = new THREE.Group();
    watch.add(P.cuts);
    // the glass
    const Rs = 5.2;
    P.glass = mesh(new THREE.SphereGeometry(Rs, 72, 10, 0, TAU, 0, Math.asin(1.17 / Rs)), surface({ main: GLASS_MAIN, decl: "uniform float uGlass;", own: { uGlass: { value: 0.5 } }, transparent: true, blending: ADD, depthWrite: false }));
    P.glass.position.y = 0.17 - Rs; P.glass.renderOrder = 20;
    watch.add(P.glass);
    // the ring that marks a cut for a clue
    P.ring = mesh(lathe([[0.975, 0.008], [1.025, 0.008]], 160), surface({ main: RING_MAIN, decl: "uniform vec3 uRingCol; uniform float uRingA;", own: { uRingCol: { value: col3("#9ff2d6") }, uRingA: { value: 1 } }, transparent: true, blending: ADD, depthWrite: false, depthTest: false }));
    P.ring.visible = false; P.ring.renderOrder = 15;
    watch.add(P.ring);
    // the cutter: a needle and the glow of its tip
    P.cutter = new THREE.Group();
    const needle = mesh(new THREE.ConeGeometry(0.014, 0.36, 12), metalMaterial("steel", { brush: 0 }));
    needle.rotation.x = Math.PI; needle.position.y = 0.18;
    const glow = mesh(quad(), surface({ main: GLOW_MAIN, decl: "uniform vec3 uGlowCol; uniform float uGlowA;", own: { uGlowCol: { value: col3("#ffd7a0") }, uGlowA: { value: 1.4 } }, transparent: true, blending: ADD, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.scale.setScalar(0.1); glow.position.y = 0.012; glow.renderOrder = 16;
    P.cutter.add(needle, glow); P.cutter.visible = false;
    watch.add(P.cutter);
    // markers and hands, which go on once the plate is done
    P.marks = new THREE.Group(); P.hands = new THREE.Group();
    watch.add(P.marks, P.hands);
    const markMat = keep(handMaterial(METALS[spec.hands.metal]?.hex || "#cfd3d8", 0.06));
    const markShape = {
      baton: () => polygon([[-0.018, -0.07], [0.018, -0.07], [0.018, 0.07], [-0.018, 0.07]]),
      dot: () => { const s = new THREE.Shape(); s.absarc(0, 0, 0.036, 0, TAU, false); return s; },
      wedge: () => polygon([[-0.03, -0.07], [0.03, -0.07], [0, 0.075]]),
      diamond: () => polygon([[0, -0.08], [0.03, 0], [0, 0.08], [-0.03, 0]]),
    }[spec.marks];
    const markGeo = keep(extrudeFlat(markShape(), 0.012, 0.008));
    P.markList = [];
    for (let h = 0; h < 12; h++) {
      const g = new THREE.Group(), m = new THREE.Mesh(markGeo, markMat);
      m.position.z = -1.1; m.frustumCulled = false;
      g.rotation.y = -h * (TAU / 12);
      g.add(m); P.marks.add(g); P.markList.push(g);
    }
    const handHex = spec.hands.tint || METALS[spec.hands.metal]?.hex || "#cfd3d8";
    const hand = (style, len, w, y, hex, rough) => {
      const m = mesh(handGeo(style, len, w), handMaterial(hex, rough)); m.position.y = y;
      const shade = new THREE.Mesh(m.geometry, keep(shadowMaterial(0.3))); shade.scale.y = 0.001; shade.renderOrder = -2; shade.frustumCulled = false;
      const g = new THREE.Group(), sg = new THREE.Group();
      g.add(m); sg.add(shade); sg.position.set(0.035, 0.003, 0.05);
      P.hands.add(g, sg);
      return { g, sg };
    };
    P.hour = hand(spec.hands.style, 0.56, 0.072, 0.09, handHex, 0.06);
    P.minute = hand(spec.hands.style, 0.9, 0.056, 0.115, handHex, 0.06);
    P.second = hand("baton", 0.98, 0.0105, 0.14, "#d9532f", 0.12);
    P.hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 24), handMaterial("#d6c28a", 0.05));
    P.hub.position.y = 0.14;
    P.hands.add(P.hub);
    parts = P;
    applyAssembly();
  }

  // ----- the engraving of a plate -----
  let held = [], frames = [];                                // the engraving's own geometries and materials, and the rings round the registers
  function buildCuts() {
    for (const L of layers) parts.cuts.remove(L.mine, L.goal);
    for (const F of frames) parts.cuts.remove(F);
    held.splice(0).forEach(o => o.dispose?.());
    layers = []; frames = [];
    const { job } = view;
    if (!job) return;
    job.cuts.forEach((c, i) => {
      const cap = c.free.includes("n") ? KNOBS.n.max : c.fixed.n;
      const mineGeo = ribbon(cap), goalGeo = ribbon(cap), engraved = grooveMaterial(spec, 0, 1), ghost = ghostMaterial(spec, 0, 1), peekMat = grooveMaterial(spec, 0, 1);
      held.push(mineGeo, goalGeo, engraved, ghost, peekMat);
      const mine = new THREE.Mesh(mineGeo, engraved), goal = new THREE.Mesh(goalGeo, ghost);
      mine.renderOrder = 10 + i; goal.renderOrder = 5 + i; mine.frustumCulled = goal.frustumCulled = false;
      mine.position.y = 0.0035; goal.position.y = 0.0045;
      parts.cuts.add(goal, mine);
      layers.push({ mine, goal, mineGeo, goalGeo, ghost, peekMat, key: "", pts: [], from: 0 });
      if (job.answer) cutRibbon(goalGeo, passes(settingsOf(c, job.answer[i])), 0);
      if (c.at) {
        // a register is edged with a fine ring of its own, as a real one is, so it reads as a dial in the dial
        const geo = ribbon(1), mat = grooveMaterial(spec, 0, 1), edge = new THREE.Mesh(geo, mat);
        held.push(geo, mat);
        cutRibbon(geo, passes({ R: 0.99, k: 2, a: 0, shape: 0, n: 1, index: 0, feed: 0, k2: 1, a2: 0, at: c.at, size: c.size }), 0);
        setU(mat, { uFrom: 0, uTotal: 1, uReveal: 1, uAlpha: 1 });
        edge.renderOrder = 4; edge.frustumCulled = false; edge.position.y = 0.0035;
        parts.cuts.add(edge); frames.push(edge);
      }
    });
    refresh();
  }
  function refresh() {
    const { job, run } = view;
    if (!job || !parts) return;
    let from = 0;
    job.cuts.forEach((c, i) => {
      const L = layers[i], s = settingsOf(c, run.vals[i]), key = JSON.stringify(s);
      if (L.key !== key) { L.key = key; L.pts = passes(s); cutRibbon(L.mineGeo, L.pts, 0); }
      L.from = from;
      from += L.pts.length;
    });
    const total = Math.max(1, from), dim = job.cuts.length > 1 && !run.done && !job.lesson, peek = view.peek && !!job.answer;
    layers.forEach((L, i) => {
      L.mine.visible = !peek;
      L.goal.visible = !!job.answer && (peek || (view.ghost && !run.done));
      L.goal.material = peek ? L.peekMat : L.ghost;
      setU(L.mine.material, { uFrom: L.from, uTotal: total, uReveal: view.reveal, uAlpha: dim && i !== run.at ? 0.55 : 1 });
      setU(L.goal.material, { uFrom: L.from, uTotal: total, uReveal: 1, uAlpha: peek ? 1 : 0.62 });
    });
    syncGauge();
  }

  // ----- the assembly: markers, hands and glass go on -----
  function applyAssembly() {
    if (!parts) return;
    const a = view.assembled, P = parts, settle = ease(clamp01((a - 0.25) / 0.6));
    setU(P.glass.material, { uGlass: 0.5 + 0.5 * a });
    P.markList.forEach((g, h) => { const k = ease(clamp01(a * 3 - 0.08 * h)); g.scale.setScalar(Math.max(0.001, k)); g.visible = k > 0.001; });
    P.hands.visible = a > 0.2;
    P.hour.g.rotation.y = P.hour.sg.rotation.y = -(10 * 30 + 8 * 0.5) * DEG * settle;
    P.minute.g.rotation.y = P.minute.sg.rotation.y = -8 * 6 * DEG * settle;
    P.hands.position.y = (1 - settle) * 0.4;
  }

  // ----- the rosette gauge in the corner -----
  const gauge = document.createElement("div");
  gauge.className = "lg-gauge";
  const gcap = document.createElement("span");
  gcap.className = "lg-gauge-cap";
  host.append(gauge, gcap);                                  // the gauge's face is under the canvas (which draws on it), its caption over
  const gsc = new THREE.Scene(), gcam = new THREE.OrthographicCamera(-1.35, 1.35, 1.35, -1.35, 0.1, 30);
  gcam.position.set(0, 7, 3.4); gcam.lookAt(0, 0, -0.1); gcam.updateMatrixWorld(); gcam.matrixWorldInverse.copy(gcam.matrixWorld).invert();
  const ros = { mesh: null, key: "", k: 2, a: 1, shape: 0, phase: 0 };
  {
    const steel = metalMaterial("steel", { brush: 0.3 });
    ros.brass = surface({ main: caseMain("atan(vL.x, -vL.z)"), decl: CASE_DECL, own: { uMetal: { value: col3("#d9ac4a") }, uRough: { value: 0.1 }, uFlute: { value: 0 }, uKnurl: { value: 0 }, uBrush: { value: 0.1 } } });
    ros.block = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.3), steel);
    ros.arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 1.1), steel);
    ros.hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 24), steel);
    ros.block.position.y = ros.arm.position.y = 0.07; ros.hub.position.y = 0.04;
    for (const m of [ros.block, ros.arm, ros.hub]) { m.frustumCulled = false; gsc.add(m); }
  }
  const RR = 0.98, edgeR = (k, a, shape, th) => (0.74 + 0.26 * (a / 10) * (EDGE[shape] || EDGE[0])(k * th)) * RR;
  const gaugeShown = () => view.gauge && !!view.run && !view.run.done && view.assembled === 0;
  function syncGauge() {
    const { job, run } = view;
    gauge.hidden = gcap.hidden = !gaugeShown();
    if (!job || !run) return;
    const at = Math.min(run.at, job.cuts.length - 1), s = settingsOf(job.cuts[at], run.vals[at]), key = `${s.k}/${s.a}/${s.shape}`;
    Object.assign(ros, { k: s.k, a: s.a, shape: s.shape });
    gcap.textContent = `${s.k} lobes · throw ${s.a}`;
    if (key === ros.key) return;
    ros.key = key;
    if (ros.mesh) { gsc.remove(ros.mesh); ros.mesh.geometry.dispose(); }
    const pts = [], N = 360;
    for (let i = 0; i < N; i++) { const th = (i / N) * TAU, r = edgeR(s.k, s.a, s.shape, th); pts.push([r * Math.sin(th), r * Math.cos(th)]); }
    ros.mesh = new THREE.Mesh(extrudeFlat(polygon(pts), 0.1, 0.02), ros.brass);
    ros.mesh.frustumCulled = false; ros.mesh.position.y = -0.04;
    gsc.add(ros.mesh);
  }
  function drawGauge() {
    if (!gaugeShown() || !ros.mesh) return;
    const sc = scale(), size = Math.round(Math.max(64, Math.min(150, Math.min(W, H) * 0.25 / sc)) * sc), at = Math.round(8 * sc);      // the gauge's side, and its place from the canvas's bottom left, in CSS pixels (script sizes grow with the screen)
    const x = at + 2, y = at + 2;                             // its face inside its 2px brass frame
    Object.assign(gauge.style, { left: `${at}px`, bottom: `${at}px`, width: `${size}px`, height: `${size}px` });
    Object.assign(gcap.style, { left: `${at + size + Math.round(9 * sc)}px`, bottom: `${at + Math.round(4 * sc)}px` });
    // the rosette turns and the block rides its edge: where the block touches, at the top, is the edge back through the turn
    ros.phase += (view.reveal < 1 ? 3.2 : 0.5) * lastDt;
    ros.mesh.rotation.y = -ros.phase;
    const top = edgeR(ros.k, ros.a, ros.shape, -ros.phase);
    ros.block.position.z = -(top + 0.15);
    ros.arm.position.z = -(top + 0.85);
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, size - 4, size - 4);
    renderer.setScissor(x, y, size - 4, size - 4);
    renderer.clear(true, true, false);                       // the watch behind the gauge is cleared away, so the gauge's own face shows
    renderer.render(gsc, gcam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    renderer.autoClear = true;
  }

  // ----- the frame -----
  function frame(dt) {
    lastDt = dt;
    t += dt;
    LIGHT.uTime.value = t;
    // a watch held in a hand is never quite still, and the glints are what show the grooves
    cam.sway = reduced ? [0, 0] : [Math.sin(t * 0.5) * 2.2 * DEG, Math.sin(t * 0.37 + 1) * 1.8 * DEG];
    pose();
    if (parts) {
      const P = parts, a = view.assembled;
      applyAssembly();
      P.second.g.rotation.y = P.second.sg.rotation.y = a > 0.9 ? -((reduced ? 0 : t * 6) + 35 * 6) * DEG : 0;
      const on = view.markCut >= 0 && view.job && !view.run.done;
      P.ring.visible = !!on;
      if (on) {
        const c = view.job.cuts[view.markCut];
        // a register is ringed round its edge, a cut round the plate's centre at its own radius
        const rr = c.size ? c.size : c.R;
        P.ring.position.set(c.at ? c.at[0] : 0, 0, c.at ? c.at[1] : 0);
        P.ring.scale.set(rr, 1, rr);
        setU(P.ring.material, { uRingA: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 5)) });
      }
      // the cutter rides the pass being cut
      const cutting = view.reveal > 0 && view.reveal < 1 && layers.length > 0;
      P.cutter.visible = cutting;
      if (cutting) {
        const total = layers.reduce((n, L) => n + L.pts.length, 0), at = view.reveal * total;
        let acc = 0;
        for (const L of layers) {
          if (at <= acc + L.pts.length) {
            const j = Math.min(L.pts.length - 1, Math.floor(at - acc)), m = Math.min(M, Math.floor((at - acc - j) * M)), p = L.pts[j];
            P.cutter.position.set(p[2 * m], 0.004, p[2 * m + 1]);
            break;
          }
          acc += L.pts.length;
        }
      }
    }
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
    drawGauge();
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && !document.hidden) frame(dt);
  }
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    pose();
    if (paused) frame(0);
  }
  function applySkin() {
    const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    LIGHT.uEnv.value = night ? 0.82 : 1;
    renderer.toneMappingExposure = night ? 1.04 : 0.98;
  }

  // ----- what the page asks of it -----
  const api = {
    canvas,
    set(job, run) {
      const next = watchOf(job.id);
      if (next !== spec || !parts) { spec = next; build(); }
      Object.assign(view, { job, run, peek: false, reveal: 1, markCut: -1, assembled: run.done ? 1 : 0 });
      ros.key = "";
      buildCuts();
    },
    refresh() { refresh(); },
    peek(on) { if (view.peek !== on) { view.peek = on; refresh(); } },
    ghost(on) { view.ghost = on; refresh(); },
    /** The engraving cut up to a part (0 to 1); 1 is the whole. */
    reveal(x) { view.reveal = x; refresh(); },
    /** The watch put together (0 to 1): markers, hands, glass, and the camera drawing back. */
    assemble(x) { view.assembled = x; syncGauge(); },
    /** The ring on the dial where a cut sits (-1: none), for a clue. */
    mark(cut) { view.markCut = cut; },
    /** Tips the watch: the light plays on it. */
    orbit(dAz, dEl) { cam.az = Math.max(-35 * DEG, Math.min(35 * DEG, cam.az + dAz)); cam.el = Math.max(50 * DEG, Math.min(90 * DEG, cam.el + dEl)); },
    zoom(f) { cam.zoom = Math.max(1, Math.min(MAX_ZOOM, cam.zoom * f)); this.pan(0, 0); },
    /** Slide the picture by a drag of dx, dy pixels; only as far as the zoomed picture has more than the window shows. */
    pan(dx, dy) {
      const e = lerp(E0, E1, ease(view.assembled)), unit = 2 * e / cam.zoom / Math.min(W, H), room = e * (1 - 1 / cam.zoom) + (cam.zoom > 1 ? 0.2 : 0);
      cam.pan = [Math.max(-room, Math.min(room, cam.pan[0] + dx * unit)), Math.max(-room, Math.min(room, cam.pan[1] + dy * unit))];
    },
    resetView() { cam.az = 0; cam.el = 78 * DEG; cam.zoom = 1; cam.pan = [0, 0]; },
    showGauge(on) { view.gauge = on; syncGauge(); },
    pause(on) { paused = on; last = performance.now(); },
    repalette() { applySkin(); },
    get state() { return { w: W, h: H, assembled: view.assembled, reveal: view.reveal, spec, zoom: cam.zoom, angles: [cam.az, cam.el] }; },
  };
  new ResizeObserver(resize).observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  applySkin();
  resize();
  requestAnimationFrame(loop);
  return api;
}
