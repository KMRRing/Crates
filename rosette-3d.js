// Rosette's watch, drawn in WebGL by one fragment shader: every pixel finds where its ray meets the dial (tilted a
// little in perspective) and lights what's there, the dial, the chapter ring with its applied indices, the bezel, the
// case, its crown and lugs, so nothing is modelled and nothing is a picture. A cut cell's guilloché is the real thing:
// its V-cut grooves (a pattern's grooves are the level lines of a function of the place on the dial) set the surface's
// slope pixel by pixel, the facets catch a studio's lights by reflection as metal does, and the enamel over them tints
// what they reflect, deepest in the grooves (flinqué, translucent enamel fired over guilloché). Bare metal shows the
// lathe's turning: a satin finish whose highlight runs across the circles, as on a record. Where a groove is finer than
// a pixel its facets are smoothed, so nothing shimmers falsely. Kontor draws it all in ink instead. The page drives it
// (set, pick, project, light, tilt); it draws only when told something changed.
import { RINGS, SECTORS } from "./rosette-engine.js";

/** The dial's layout, in dial radii: the hub, the band of cells (five rings), the chapter ring, the bezel, the case. */
export const GEO = { hub: .115, inner: .175, outer: .875, rim: 1, bezel: 1.13, flank: 1.165 };
export const RING_W = (GEO.outer - GEO.inner) / RINGS;
const SECTOR = (2 * Math.PI) / SECTORS;

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0., 1.); }`;
const FRAG = `
precision highp float;
uniform vec2 uCentre;      // the dial's centre in device pixels, from the bottom left
uniform float uR;          // the dial's radius in device pixels
uniform float uF;          // the eye's distance in device pixels
uniform mat3 uRot;         // the dial's plane to the world (x right, y up, z towards the eye)
uniform vec3 uKey;         // towards the key light
uniform vec3 uFill;        // towards the fill light
uniform sampler2D uCells;  // a texel a cell: pattern + 1, the shown cut (pattern + 1, 5 a skipped repeat, +8 the first), lit, faced
uniform vec3 uEn0, uEn1, uEn2, uEn3;
uniform vec3 uBlank, uMetal, uPrint, uGlow, uWarn, uRoom, uShade;
uniform float uLugs, uTime, uInk;
uniform vec3 uPaper, uInkC;

const float PI = 3.14159265;
const float HUB = ${GEO.hub.toFixed(4)}, INNER = ${GEO.inner.toFixed(4)}, OUTER = ${GEO.outer.toFixed(4)}, RIM = 1.0, BEZEL = ${GEO.bezel.toFixed(4)}, FLANK = ${GEO.flank.toFixed(4)};
const float RW = ${RING_W.toFixed(5)};
const float SLOPE = .62;

vec3 enamel(float p) { return p < .5 ? uEn0 : p < 1.5 ? uEn1 : p < 2.5 ? uEn2 : uEn3; }

// A V-cut profile, rounded where the cut is finer than the eye can resolve: (height in periods, 0 at a ridge, -.5 in a
// groove; its slope per period).
vec2 cutProfile(float u, float k) {
  float c = cos(2. * PI * u), s = sin(2. * PI * u);
  float h = -acos(clamp(k * c, -1., 1.)) / (2. * PI);
  float d = -k * s / sqrt(max(1. - k * k * c * c, 1e-4));
  return vec2(h, d);
}
// sharpness from the period in pixels: a sharp V when it spans many, a smooth wave near two, flat below
float sharp(float period, float fp) { return clamp((period / fp - 1.6) / 4., 0., .985); }

// A family of grooves, the level lines of u (gradient g, in a dial radius): its surface (height, gradient) and depth.
vec4 family(float u, vec2 g, float fp) {
  float lam = 1. / max(length(g), 1e-5);
  vec2 pr = cutProfile(u, sharp(lam, fp));
  return vec4(SLOPE * lam * pr.x, SLOPE * lam * pr.y * g, -2. * pr.x);
}
vec4 lower(vec4 a, vec4 b) { return a.x < b.x ? a : b; }

// The four patterns: (height, gradient x, gradient y, depth 0 at a ridge, 1 in a groove), at q on the dial (polar r, a)
// in the ring 'ring'.
vec4 pattern(float p, vec2 q, float r, float a, float ring, float fp) {
  vec2 rh = q / r, ga = vec2(q.y, -q.x) / (r * r);   // the gradients of r and of the angle (clockwise from twelve)
  if (p < .5) {
    // grain d'orge (barleycorn): a rose engine's wavy circles, every other pass half a lobe round, so they cross in grains
    float P = .0235, A = .26, N = 12. * floor(1.5 + 8. * (INNER + (ring + .5) * RW));
    float w = A * sin(N * a), dw = A * N * cos(N * a);
    return lower(family(r / P + w, rh / P + dw * ga, fp), family(r / P - w, rh / P - dw * ga, fp));
  }
  if (p < 1.5) {
    // clous de Paris: two families of straight grooves crossing at right angles, leaving pyramids
    float P = .031;
    return lower(family((q.x + q.y) / (1.4142 * P), vec2(1., 1.) / (1.4142 * P), fp), family((q.x - q.y) / (1.4142 * P), vec2(1., -1.) / (1.4142 * P), fp));
  }
  if (p < 2.5) {
    // soleil (sunburst): rays from the centre, ten to an hour
    float M = 120.;
    return family(a * M / (2. * PI), ga * M / (2. * PI), fp);
  }
  // vagues (waves): a straight-line engine's waves across the dial
  float P = .026, Aw = .011, Fw = 2. * PI / .094;
  return family((q.y + Aw * sin(q.x * Fw)) / P, vec2(Aw * Fw * cos(q.x * Fw), 1.) / P, fp);
}

// The studio the metal reflects: a dim room, bright towards the top, a broad softbox where the key light is, a strip
// where the fill is.
vec3 room(vec3 R) {
  vec3 c = uRoom * mix(.08, .55, smoothstep(-.3, 1., R.z)) * mix(.9, 1.1, smoothstep(-1., 1., R.y));
  c += uRoom * 2.2 * smoothstep(.80, .97, dot(R, uKey));
  c += uRoom * .8 * smoothstep(.93, .995, dot(R, uFill));
  return c;
}
vec3 metal(vec3 N, vec3 V, vec3 F0, float gloss) {
  vec3 R = reflect(-V, N), H = normalize(uKey + V);
  float spec = pow(max(dot(N, H), 0.), mix(30., 500., gloss)) * mix(.5, 3., gloss);
  return F0 * (room(R) + spec);
}
// bare metal as the lathe leaves it: satin, the highlight running across the circles it turned
vec3 turned(vec3 N, vec3 T, vec3 V, vec3 F0) {
  vec3 H = normalize(uKey + V);
  float th = dot(T, H), aniso = pow(sqrt(max(1. - th * th, 0.)), 90.) * 1.3;
  return F0 * (room(reflect(-V, N)) * .55 + .12 * uRoom + aniso * uRoom);
}
// translucent enamel over a cut: the metal's light tinted, deeper in the grooves, under a glassy surface
vec3 enamelled(vec3 lit, vec3 en, float depth, vec3 V, vec3 Nflat) {
  vec3 tint = pow(en, vec3(mix(.75, 1.5, depth))) * 1.7;
  float fr = .04 + .45 * pow(1. - max(dot(V, Nflat), 0.), 5.);
  vec3 H = normalize(uKey + V);
  return lit * tint * (1. - fr) + room(reflect(-V, Nflat)) * fr + vec3(.9) * pow(max(dot(Nflat, H), 0.), 900.) * uRoom;
}

float line(float d, float w, float fp) { return 1. - smoothstep(w, w + 1.5 * fp, abs(d)); }

void main() {
  // the ray from the eye through this pixel, met with the dial's plane
  vec2 px = gl_FragCoord.xy - uCentre;
  vec3 E = vec3(0., 0., uF), dir = normalize(vec3(px, -uF)), n = uRot[2];
  float t = -dot(n, E) / dot(n, dir);
  vec3 X = E + t * dir;
  vec2 q = (X * uRot).xy / uR;
  float fp = t / (uF * uR) * 1.15;
  float r = length(q), a = atan(q.x, q.y);
  if (a < 0.) a += 2. * PI;
  vec3 V = normalize(E - X);
  vec3 Nflat = n;
  vec2 rh = q / max(r, 1e-4), tan2 = vec2(rh.y, -rh.x);

  vec3 col = vec3(0.);
  float alpha = 1.;
  vec2 grad = vec2(0.);
  float ink = 0.;                    // Kontor: how much ink this pixel takes
  bool lugHere = false;
  // the lugs, two horns at each end, when there's room for them
  vec2 lq = vec2(abs(q.x), abs(q.y));
  if (uLugs > .5 && r > BEZEL - .02 && lq.y < 1.46 && lq.x > .2 && lq.x < .43 && lq.y > .78) {
    float edge = min(min(lq.x - .2, .43 - lq.x), 1.46 - lq.y);
    lugHere = edge > 0.;
    if (lugHere) {
      vec2 g = edge < .035 ? (lq.x - .2 < .035 ? vec2(-1., 0.) : .43 - lq.x < .035 ? vec2(1., 0.) : vec2(0., 1.)) * (1. - edge / .035) * 1.6 : vec2(0.);
      g *= sign(q);
      vec3 N = normalize(uRot * vec3(-g, 1.));
      col = metal(N, V, uMetal, edge < .035 ? .9 : .35) * uShade;
      ink = line(edge, .004, fp);
    }
  }
  if (lugHere) {
  } else if (r > FLANK) {
    // the crown at three o'clock, then the shadow the case throws on the page
    if (q.x > FLANK - .01 && q.x < 1.285 && abs(q.y) < .086) {
      float k = q.y / .086, rib = sin(q.y * 260.);
      vec3 N = normalize(uRot * vec3(.15, k * 1.4 + rib * .25, sqrt(max(1. - k * k, .05))));
      col = metal(N, V, uMetal, .5) * uShade;
      ink = line(abs(q.y) - .086, .004, fp) + line(q.x - 1.285, .004, fp);
    } else {
      vec2 off = q + uKey.xy * .05;
      float sh = (1. - smoothstep(FLANK - .02, FLANK + .16, length(off))) * .32;
      if (uLugs > .5) sh = max(sh, (1. - smoothstep(.0, .09, max(max(abs(off.x) - .43, .2 - abs(off.x)), max(abs(off.y) - 1.46, .78 - abs(off.y))))) * .26);
      if (uInk > .5) sh = 0.;
      gl_FragColor = vec4(0., 0., 0., sh);
      return;
    }
  } else if (r > BEZEL) {
    // the case's flank, seen a little from the side
    vec3 N = normalize(uRot * vec3(rh * 1.3, .35));
    col = metal(N, V, uMetal, .3) * .8 * uShade;
    ink = line(r - FLANK, .004, fp);
  } else if (r > RIM) {
    // the bezel: polished, rounded
    float x = (r - 1.035) / .1, slope = -x / sqrt(max(1. - x * x, .02)) * .9;
    vec3 N = normalize(uRot * vec3(-slope * rh, 1.));
    col = metal(N, V, uMetal, .9) * uShade;
    col *= mix(.55, 1., smoothstep(RIM, RIM + .012, r));            // the shadow where it meets the crystal
    ink = line(r - BEZEL, .004, fp) + line(r - RIM, .004, fp);
  } else {
    // the dial, under its crystal
    vec3 N = Nflat;
    if (r < HUB) {
      // the hub: a polished dome, the hands' pinion in its middle
      float h = sqrt(max(HUB * HUB - r * r, 1e-5));
      N = normalize(uRot * vec3(q / h * .55, 1.));
      col = metal(N, V, uMetal, .95) * uShade;
      col *= smoothstep(.018, .026, r);
      ink = line(r - HUB, .004, fp) + line(r - .022, .003, fp);
    } else if (r < INNER || r > OUTER) {
      // the plain ring round the hub and the chapter ring: turned metal, the hours on the chapter ring
      vec3 T = uRot * vec3(tan2, 0.);
      col = turned(N, T, V, uBlank);
      if (r > OUTER) {
        // the applied indices: a polished baton at each hour, two at twelve, their edges bevelled
        float h = a / (2. * PI / 12.), nearest = floor(h + .5), off = (h - nearest) * (2. * PI / 12.) * r;
        bool twelve = mod(nearest, 12.) < .5;
        float centre = twelve ? (off > 0. ? .016 : -.016) : 0., hw = twelve ? .0075 : .011;
        float bx = hw - abs(off - centre), by = min(r - .895, .962 - r);
        if (bx > 0. && by > 0.) {
          vec2 g = bx < by ? tan2 * sign(off - centre) : rh * sign(r - .9285);
          float bev = 1. - smoothstep(0., .0045, min(bx, by));
          N = normalize(uRot * vec3(g * bev * 1.4, 1.));
          col = metal(N, V, uMetal, .9) * uShade;
          ink = 1. - smoothstep(.0015, .0015 + fp * 1.5, min(bx, by));
        }
        // the minute track
        float m = a / (2. * PI / 60.), mo = (m - floor(m + .5)) * (2. * PI / 60.) * r;
        float tick = line(mo, .0016, fp) * step(.967, r) * step(r, .992);
        col = mix(col, uPrint, tick * .8);
        ink = max(ink, tick);
        float rim2 = line(r - .992, .0015, fp) + line(r - .967, .0012, fp);
        col = mix(col, uPrint, rim2 * .55);
        ink = max(ink, rim2);
      }
      ink = max(ink, line(r - INNER, .0025, fp) + line(r - OUTER, .0025, fp));
    } else {
      // a cell of the dial: its ring and sector, and what's cut or shown there
      float ring = min(floor((r - INNER) / RW), ${RINGS - 1}.);
      float hs = a / (2. * PI / 12.), sector = mod(floor(hs + .5), 12.);
      vec4 cell = texture2D(uCells, vec2((sector + .5) / 12., (ring + .5) / ${RINGS}.)) * 255.;
      float pat = cell.r - 1., shown = cell.g, lit = cell.b / 255., faced = cell.a / 255.;
      float first = shown > 7.5 ? 1. : 0.;
      if (first > .5) shown -= 8.;
      // the cell's edges: its rings' circles and its sector's sides
      float r0 = INNER + ring * RW, edgeR = min(r - r0, r0 + RW - r);
      float edgeA = (.5 - abs(hs - floor(hs + .5))) * (2. * PI / 12.) * r;
      float edge = min(edgeR, edgeA);
      vec3 T = uRot * vec3(tan2, 0.);
      vec3 bare = turned(N, T, V, uBlank);
      col = bare;
      float vis = pat > -.5 ? 1. - smoothstep(.3, .85, faced) : 0.;
      float showPat = pat;
      float ghost = 0.;
      if (shown > .5 && shown < 4.5) { showPat = shown - 1.; ghost = first > .5 ? .92 : .72; }
      if (showPat > -.5 && (vis > 0. || ghost > 0.)) {
        vec4 s = pattern(showPat, q, r, a, ring, fp);
        vec3 Ng = normalize(uRot * vec3(-s.yz, 1.));
        vec3 cut = enamelled(metal(Ng, V, uBlank, .75), enamel(showPat), s.w, V, Nflat);
        float k = ghost > 0. ? ghost * (.84 + .16 * sin(uTime * 5.)) : vis;
        col = mix(bare, cut, k);
        ink = max(ink, smoothstep(.72, 1., s.w) * k * .85);
        ink = max(ink, line(edge, .0025, fp) * k);
      }
      // a cell being faced off flashes as the cutter passes
      float flash = smoothstep(0., .12, faced) * (1. - smoothstep(.12, .5, faced));
      col += uRoom * vec3(1.5) * flash;
      // a skipped repeat: its place marked, struck through
      if (shown > 4.5 && shown < 5.5) {
        float pulse = .8 + .2 * sin(uTime * 5.);
        col = mix(col, uWarn, line(edge, .004, fp) * .9 * pulse);
        float cx = r - (r0 + RW * .5), cy = (hs - floor(hs + .5)) * (2. * PI / 12.) * r;
        float x1 = line((cx - cy) * .7071, .003, fp) * step(abs(cx), RW * .28) * step(abs(cy), RW * .28);
        float x2 = line((cx + cy) * .7071, .003, fp) * step(abs(cx), RW * .28) * step(abs(cy), RW * .28);
        col = mix(col, uWarn, max(x1, x2) * .85 * pulse);
        ink = max(ink, max(line(edge, .003, fp), max(x1, x2)));
      }
      // a cut shown: its outline in its enamel
      if (ghost > 0.) {
        float o = line(edge, first > .5 ? .0055 : .0035, fp);
        col = mix(col, enamel(showPat) * 1.3 + .08, o * .85);
        ink = max(ink, o);
      }
      // a band the cut shown would finish: lit along its edges
      if (lit > 0.) {
        float glow = (1. - smoothstep(0., .022, edge)) * lit * (.7 + .3 * sin(uTime * 6.));
        col = mix(col, uGlow * 1.6, glow * .75);
        col += uGlow * lit * .12;
        ink = max(ink, glow);
      }
      // the cells' lines, printed
      float lines = max(line(edgeR, .0018, fp), line(edgeA, .0015, fp));
      col = mix(col, uPrint, lines * .45);
      ink = max(ink, lines * .6);
    }
    // the crystal over the dial: a faint reflection, brightest where it reflects the key light
    vec3 R = reflect(-V, normalize(uRot * vec3(q * .06, 1.)));
    col += uRoom * .5 * smoothstep(.985, .9995, dot(R, uKey)) + room(R) * .03;
  }
  if (uInk > .5) {
    // Kontor: the drawing office's version, ink on paper
    float shade = clamp(dot(col, vec3(.3, .5, .2)), 0., 1.);
    col = mix(uPaper, uInkC, clamp(ink, 0., 1.));
    col = mix(col, uInkC, (1. - smoothstep(.0, .25, shade)) * .25);
  }
  // to the screen: filmic tone, then sRGB
  col = col / (col + .55) * 1.25;
  col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
  gl_FragColor = vec4(col * alpha, alpha);
}`;

const rgb = hex => { const v = parseInt(hex.replace("#", "").trim().padEnd(6, "0").slice(0, 6), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
const lin = c => c.map(x => x ** 2.2);
const cssColour = (css, name, or) => { const v = css.getPropertyValue(name).trim(); return lin(rgb(/^#[0-9a-f]{3,8}$/i.test(v) ? (v.length === 4 ? `#${[...v.slice(1)].map(x => x + x).join("")}` : v) : or)); };

/** The skin in force: the suite's theme and day or night, as the shader takes it. */
function skinNow() {
  const root = document.documentElement, theme = root.dataset.theme || "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root);
  const en = [0, 1, 2, 3].map(k => cssColour(css, `--c${k}`, ["#D49A22", "#3D7A66", "#2C5B8A", "#8F3328"][k]));
  const base = { en, ink: 0, paper: [1, 1, 1], inkC: [0, 0, 0], warn: lin(rgb(night ? "#E8806F" : "#A8382B")) };
  if (theme === "kontor") return { ...base, ink: 1, blank: [1, 1, 1], metal: [1, 1, 1], print: cssColour(css, "--ink", "#1C2A34"), glow: cssColour(css, "--c1", "#3D7A66"), room: [1, 1, 1], shade: 1, paper: cssColour(css, "--sheet", night ? "#0E1310" : "#FBFAF6"), inkC: cssColour(css, "--ink", night ? "#7FD3A0" : "#1C2A34") };
  // the blank's silver, the case's metal (Almanac's in brass), the print, the studio's light
  const skins = {
    almanac: night ? { blank: "#8D9097", metal: "#B8945A", print: "#ECE2CB", glow: "#E2B24E", room: .62 } : { blank: "#DCD8CF", metal: "#C9A15C", print: "#1C2A34", glow: "#C38A24", room: 1 },
    modern: night ? { blank: "#7E868D", metal: "#A9B1B8", print: "#E3E8EB", glow: "#E1AB24", room: .6 } : { blank: "#E6E8EA", metal: "#C5CBD0", print: "#1C2A34", glow: "#C98F0E", room: 1 },
    office: night ? { blank: "#7A7A7A", metal: "#A8A8A8", print: "#E6E6E6", glow: "#4CA0E8", room: .6 } : { blank: "#E4E4E4", metal: "#C2C2C2", print: "#242424", glow: "#0F6CBD", room: 1 },
  };
  const k = skins[theme] || skins.almanac;
  return { ...base, blank: lin(rgb(k.blank)), metal: lin(rgb(k.metal)), print: lin(rgb(k.print)), glow: lin(rgb(k.glow)), room: [k.room, k.room, k.room * .98], shade: night ? .85 : 1 };
}

/**
 * The watch on a canvas: { set(cells, show), pick(x, y), project(x, y), light(az, el), tilt(x, y), theme(), resize(),
 * dispose(), radius() }. Throws where there's no WebGL (the page then draws the dial flat).
 */
export function createDial(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error("no WebGL here");
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const name of ["uCentre", "uR", "uF", "uRot", "uKey", "uFill", "uCells", "uEn0", "uEn1", "uEn2", "uEn3", "uBlank", "uMetal", "uPrint", "uGlow", "uWarn", "uRoom", "uShade", "uLugs", "uTime", "uInk", "uPaper", "uInkC"]) U[name] = gl.getUniformLocation(prog, name);
  // the cells, a texel each: what's cut, what's shown, lit, faced off
  const data = new Uint8Array(RINGS * SECTORS * 4), tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SECTORS, RINGS, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.uniform1i(U.uCells, 0);

  let skin = skinNow(), size = { w: 1, h: 1, dpr: 1, R: 1, cx: 0, cy: 0, lugs: false }, frame = 0, live = 0, t0 = performance.now();
  const view = { az: -.75, el: .78, tx: 0, ty: 0 };
  const F = () => size.R * 5.2;                     // the eye's distance, in device pixels: a gentle perspective

  function rotation() {
    const cx = Math.cos(view.tx), sx = Math.sin(view.tx), cy = Math.cos(view.ty), sy = Math.sin(view.ty);
    // Ry(ty) · Rx(tx), as columns
    return [[cy, 0, -sy], [sy * sx, cx, cy * sx], [sy * cx, -sx, cy * cx]];
  }
  const towards = (az, el) => [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];

  function paint(now) {
    frame = 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const m = rotation();
    gl.uniform2f(U.uCentre, size.cx, size.cy);
    gl.uniform1f(U.uR, size.R);
    gl.uniform1f(U.uF, F());
    gl.uniformMatrix3fv(U.uRot, false, new Float32Array(m.flat()));
    gl.uniform3fv(U.uKey, towards(view.az, view.el));
    gl.uniform3fv(U.uFill, towards(view.az + 2.6, .5));
    skin.en.forEach((c, k) => gl.uniform3fv(U[`uEn${k}`], c));
    for (const [u, v] of [["uBlank", skin.blank], ["uMetal", skin.metal], ["uPrint", skin.print], ["uGlow", skin.glow], ["uWarn", skin.warn], ["uRoom", skin.room], ["uPaper", skin.paper], ["uInkC", skin.inkC]]) gl.uniform3fv(U[u], v);
    gl.uniform3fv(U.uShade, [skin.shade, skin.shade, skin.shade]);
    gl.uniform1f(U.uLugs, size.lugs ? 1 : 0);
    gl.uniform1f(U.uInk, skin.ink);
    gl.uniform1f(U.uTime, ((now ?? performance.now()) - t0) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (live && performance.now() < live) invalidate();
    else live = 0;
  }
  const invalidate = () => { if (!frame) frame = requestAnimationFrame(paint); };

  function fit() {
    // sharp on a phone; on a big screen no more than about three million pixels, each of which the shader works out
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight), dpr = Math.min(devicePixelRatio || 1, 2.5, Math.sqrt(3e6 / (w * h)));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // as large as the room allows with the crown (out to 1.285) and the case's shadow inside it; the lugs only when
    // there's height for them
    const lugs = h / w > 1.3;
    const R = Math.min(w / 2.6, h / (lugs ? 3.05 : 2.6)) * dpr;
    size = { w, h, dpr, R, cx: canvas.width / 2, cy: canvas.height / 2, lugs };
    invalidate();
  }
  const observer = new ResizeObserver(fit);
  observer.observe(canvas);
  fit();

  /** Where on the dial a point on the screen falls: { x, y, r, a (clockwise from twelve) } in dial radii. */
  function pick(clientX, clientY) {
    const b = canvas.getBoundingClientRect();
    const px = (clientX - b.left) * size.dpr - size.cx, py = -((clientY - b.top) * size.dpr - size.cy);
    const m = rotation(), f = F(), n = m[2], d = [px, py, -f], len = Math.hypot(...d);
    for (let k = 0; k < 3; k++) d[k] /= len;
    const t = -(n[2] * f) / (n[0] * d[0] + n[1] * d[1] + n[2] * d[2]);
    const X = [t * d[0], t * d[1], f + t * d[2]];
    const x = (X[0] * m[0][0] + X[1] * m[0][1] + X[2] * m[0][2]) / size.R, y = (X[0] * m[1][0] + X[1] * m[1][1] + X[2] * m[1][2]) / size.R;
    let a = Math.atan2(x, y);
    if (a < 0) a += 2 * Math.PI;
    return { x, y, r: Math.hypot(x, y), a };
  }
  /** Where a point on the dial (in dial radii) is on the screen. */
  function project(x, y) {
    const m = rotation(), f = F(), L = [x * size.R, y * size.R];
    const X = [m[0][0] * L[0] + m[1][0] * L[1], m[0][1] * L[0] + m[1][1] * L[1], m[0][2] * L[0] + m[1][2] * L[1]];
    const k = f / (f - X[2]), b = canvas.getBoundingClientRect();
    return [b.left + (size.cx + X[0] * k) / size.dpr, b.top + (size.cy - X[1] * k) / size.dpr];
  }

  return {
    /** The dial as it stands (a pattern or -1 a cell), with show: { cut: [{ cells, pattern, cut, first }], lit: [cells], faced: { cell: 0–1 } }. */
    set(cells, show = {}) {
      data.fill(0);
      cells.forEach((p, i) => { data[i * 4] = p + 1; });
      for (const c of show.cut || []) for (const i of c.cells) data[i * 4 + 1] = (c.cut ? c.pattern + 1 : 5) + (c.first ? 8 : 0);
      for (const i of show.lit || []) data[i * 4 + 2] = 255;
      for (const [i, p] of Object.entries(show.faced || {})) data[Number(i) * 4 + 3] = Math.round(Math.min(1, Math.max(0, p)) * 255);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SECTORS, RINGS, gl.RGBA, gl.UNSIGNED_BYTE, data);
      // a cut shown pulses, so keep drawing while it's there
      if ((show.cut || []).length || (show.lit || []).length) { live = performance.now() + 60000; }
      invalidate();
    },
    /** Keep drawing for so many milliseconds (an animation the page runs). */
    run(ms) { live = Math.max(live, performance.now() + ms); invalidate(); },
    still() { live = 0; },
    pick,
    project,
    /** The key light: azimuth (round the dial, from twelve) and elevation, in radians. */
    light(az, el) { view.az = az; view.el = Math.max(.25, Math.min(1.45, el)); invalidate(); },
    /** The dial tilted towards the eye: about its horizontal and vertical axes, in radians. */
    tilt(tx, ty) { view.tx = tx; view.ty = ty; invalidate(); },
    view: () => ({ ...view }),
    radius: () => size.R / size.dpr,
    theme() { skin = skinNow(); invalidate(); },
    resize: fit,
    dispose() { observer.disconnect(); cancelAnimationFrame(frame); gl.getExtension("WEBGL_lose_context")?.loseContext(); },
  };
}

/** A cell's middle on the dial, in dial radii: [x, y] (y up, sectors clockwise from twelve). */
export function cellMiddle(i) {
  const ring = Math.floor(i / SECTORS), sector = i % SECTORS, r = GEO.inner + (ring + .5) * RING_W, a = sector * SECTOR;
  return [r * Math.sin(a), r * Math.cos(a)];
}
