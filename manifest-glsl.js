// Manifest's packages and quay, worked out in the shader (no pictures: the vendored three.js has no textures, and none is
// needed). A package is a plain box, its packing drawn on its three faces from where each point lies on the face: the
// bevel, the weave, the cords and straps, the staves and hoops, all as heights (so the light finds them) and colours.
// Nothing here changes a silhouette: the box is the box the engine says it is.
//
// A face is a rectangle with s along its length and t across or up it: the top (s along the package, t across), the long
// side (s along it, t up) and the end (s across, t up). The package is PL long (s), PH high and PW wide, in the scene's units.

export const COMMON = `
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * n2(p); p = p * 2.03 + 7.3; a *= .5; } return s; }
float cov(float d, float w) { return clamp(.5 - d / w, 0., 1.); }                 // coverage of a shape from its signed distance d (negative inside), w a pixel
float sdBox(vec2 p, vec2 c, vec2 hs, float r) { vec2 q = abs(p - c) - hs + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float sdRing(vec2 p, vec2 c, float r, float hw) { return abs(length(p - c) - r) - hw; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }   // interleaved gradient noise: a fine dither
`;

/** The surface of a package at a point: albedo, roughness, metalness, a height (the light finds the bumps) and occlusion. */
export const PACKAGE_SURFACE = `
const float PL = 1.9, PH = .95, PW = 1.;
struct Surf { vec3 col; float rough; float metal; float h; float ao; };

// cords or ropes: across the package at s1 and s2, and one along it (round the middle of an end); coverage, the distance to
// the nearest cord's middle, and how far along that cord the point lies
float lash(int f, float s, float t, float FS, float FT, float s1, float s2, float cw, float pw, out float d, out float along) {
  float d1 = abs(s - s1), d2 = abs(s - s2), d3 = abs(t - FT * .5);
  if (f == 2) { d1 = abs(s - FS * .5); d2 = 9.; }
  d = min(min(d1, d2), d3);
  along = d3 <= min(d1, d2) ? s : t;
  return cov(d - cw, pw);
}
float edgeOf(float s, float t, float FS, float FT) { return min(min(s, FS - s), min(t, FT - t)); }

// ---- a tarpaulin: grey canvas, ropes (the turned question's stack, and the one package it lights)
void tarp(int f, float s, float t, float FS, float FT, float pw, inout Surf o) {
  float ed = edgeOf(s, t, FS, FT), lod = 1. - smoothstep(.02, .05, pw);
  o.h = .07 * smoothstep(0., .2, ed);
  float tw = .5 + .5 * sin((s + t) * 64.) * sin((s - t) * 57.);
  vec3 c = o.col * (1. - .06 * lod * tw) * (.93 + .12 * fbm(vec2(s, t) * 6.));
  float d, al, r = lash(f, s, t, FS, FT, FS / 3., FS * 2. / 3., .03, pw, d, al);
  float rd = sqrt(max(0., 1. - (d / .03) * (d / .03)));
  c *= 1. - .28 * (1. - r) * (1. - smoothstep(.03, .08, d));
  vec3 rope = vec3(.55, .42, .22) * (.82 + .3 * (.5 + .5 * sin(al * 70. + rd * 4.)) * lod);
  o.col = mix(c, rope, r);
  o.h += .016 * rd * r;
  o.rough = .95;
  o.ao = mix(.62, 1., smoothstep(0., .03, ed));
}

// ---- cloth: a bale of woad-blue canvas lashed with cord, a lead seal where the cords cross, the end folded like an envelope
void bale(int f, float s, float t, float FS, float FT, float pw, inout Surf o) {
  float ed = edgeOf(s, t, FS, FT), lod = 1. - smoothstep(.02, .05, pw);
  o.h = .075 * smoothstep(0., .17, ed);
  float tw = .5 + .5 * sin((s + t) * 68.) * sin((s - t) * 61.);
  vec3 canvas = o.col * (1. - .09 * lod * tw) * (.95 + .1 * fbm(vec2(s, t) * 7.));
  float d, al, r = lash(f, s, t, FS, FT, .55, 1.35, .032, pw, d, al);
  float rd = sqrt(max(0., 1. - (d / .032) * (d / .032)));
  canvas *= 1. - .3 * (1. - r) * (1. - smoothstep(.032, .085, d));
  vec3 cord = vec3(.78, .66, .42) * (.86 + .22 * (.5 + .5 * sin(al * 72. + rd * 4.)) * lod);
  o.h += .02 * rd * r;
  if (f == 2) {                                                    // the folded end: creases from the corners, the hem
    float u = (s - FS * .5) / (FS * .5), v = (t - FT * .5) / (FT * .5);
    float cr = min(abs(u - v), abs(u + v)) * .5;
    float k = 1. - smoothstep(0., .04, cr);
    o.h -= .016 * k;
    canvas *= 1. - .22 * k;
  }
  vec3 c = mix(canvas, cord, r);
  // the lead seal where the cords cross
  float dseal = 9.;
  if (f == 0) dseal = min(length(vec2(s - .55, t - .5)), length(vec2(s - 1.35, t - .5)));
  else if (f == 1) dseal = min(length(vec2(s - .55, t - FT * .5)), length(vec2(s - 1.35, t - FT * .5)));
  else dseal = length(vec2(s - .5, t - FT * .5));
  float seal = cov(dseal - .062, pw);
  float stamp = cov(abs(dseal - .036) - .007, pw) * .35;
  c = mix(c, vec3(.44, .46, .49) * (1. - stamp), seal);
  o.h += .014 * seal;
  o.col = c;
  o.rough = mix(.95, .35, seal);
  o.metal = seal * .8;
  o.ao = mix(.6, 1., smoothstep(0., .035, ed));
}

// ---- salt: a pale burlap sack, puffed, its mouth stitched, the merchant's mark stencilled on the belly
void sack(int f, float s, float t, float FS, float FT, float pw, inout Surf o) {
  float ed = edgeOf(s, t, FS, FT), lod = 1. - smoothstep(.02, .05, pw);
  // pillowy: fat at the middle, the folds of cloth across it
  float pil = smoothstep(0., .24, ed);
  float fold = (fbm(vec2(s * 3.4 + float(f) * 5., t * 3.4)) - .45) * .05;
  o.h = .15 * pil + fold * pil * 1.4;
  float wv = .5 + .5 * sin(s * 105.) * sin(t * 105.);                // burlap
  vec3 c = o.col * (1. - .075 * lod * wv) * (.94 + .1 * fbm(vec2(s, t) * 5. + 3.));
  c *= 1. - .1 * smoothstep(0., .5, -fold * 12.) ;
  // the stitched seam: along the top, across the end, with the little ears of the mouth
  float seam = 9.;
  if (f == 0) seam = abs(t - .5);
  else if (f == 2) seam = abs(s - .5);
  float stitch = step(.5, fract((f == 0 ? s : t) * 16.)) * cov(seam - .012, pw);
  float ridge = 1. - smoothstep(0., .035, seam);
  o.h += .012 * ridge;
  c = mix(c, vec3(.36, .29, .2), stitch * .8);
  // the stencil: a triangle in a ring, brown, a little broken
  if (f == 1) {
    vec2 q = vec2(s - .95, t - FT * .5);
    float tri = max(abs(q.x) * .86 + q.y * .5, -q.y) - .15;          // an upright triangle
    tri = max(tri, -(abs(q.x) * .86 + q.y * .5 - .1));              // hollow: the triangle's outline
    float ring = abs(length(q) - .26) - .012;
    float mark = max(cov(tri * .8, pw), cov(ring, pw));
    mark *= .5 + .5 * smoothstep(.25, .5, fbm(q * 28.) + .25);
    c = mix(c, vec3(.3, .2, .12), mark * .85);
  }
  o.col = c;
  o.rough = .96;
  o.ao = mix(.6, 1., smoothstep(0., .08, ed));
}

// ---- amber: an iron-strapped chest of planks, a hasp's plate, a lozenge of polished amber, ring handles at the ends
void chest(int f, float s, float t, float FS, float FT, float pw, inout Surf o) {
  float ed = edgeOf(s, t, FS, FT), lod = 1. - smoothstep(.02, .05, pw);
  o.h = .02 * smoothstep(0., .05, ed);
  float lid = (f == 0) ? 1. : step(.69, t);
  float pk = (f == 0) ? floor(t / .2) : floor(t / .17);
  float pkf = (f == 0) ? fract(t / .2) * .2 : fract(t / .17) * .17;
  float tone = .88 + .22 * h21(vec2(pk, float(f) + lid * 7.));
  float grain = n2(vec2(s * 2.1 + pk * 3.1, t * 40.));
  vec3 wood = o.col * tone * (.9 + .16 * grain);
  float seamLine = cov(min(pkf, (f == 0 ? .2 : .17) - pkf) - .005, pw) * (f == 0 ? 1. : 1. - lid);
  wood *= 1. - .45 * seamLine;
  float lidSeam = (f == 0) ? 0. : cov(abs(t - .69) - .008, pw);
  wood *= 1. - .5 * lidSeam;
  wood = mix(wood, wood * 1.07, lid);
  vec3 c = wood;
  float hh = 0.;
  // iron straps: round the chest near each end of its length; down the middle of an end
  float sa = f == 2 ? FS * .5 : .19, sb = f == 2 ? 9. : FS - .19, bw = f == 2 ? .085 : .068;
  float strap = max(cov(abs(s - sa) - bw, pw), cov(abs(s - sb) - bw, pw));
  vec3 iron = vec3(.075, .075, .085) * (.8 + .5 * grain);
  c = mix(c, iron, strap);
  hh += .014 * strap;
  float ra = f == 0 ? .12 : .09, rb = f == 0 ? FT - .12 : .62;
  float rivets = 0.;
  for (int k = 0; k < 2; k++) {
    float tt = k == 0 ? ra : rb;
    rivets = max(rivets, max(cov(length(vec2(s - sa, t - tt)) - .026, pw), cov(length(vec2(s - sb, t - tt)) - .026, pw)));
  }
  c = mix(c, vec3(.26, .24, .22), rivets);
  // the amber: a lozenge in an iron frame, domed and glossy
  vec2 q = f == 1 ? vec2(s - .95, t - .38) : f == 0 ? vec2(s - .95, t - .5) : vec2(1., 1.);
  float r = f == 1 ? .27 : .2;
  float dia = abs(q.x) + abs(q.y);
  float frame = cov(abs(dia - r) - .03, pw) * step(float(f), 1.5);
  float gem = cov(dia - r + .028, pw) * step(float(f), 1.5);
  float dome = clamp(1. - dia / r, 0., 1.);
  vec3 amberLo = vec3(.62, .26, .03), amberHi = vec3(1., .72, .2);
  vec3 gc = mix(amberLo, amberHi, smoothstep(-.1, .2, (q.y * .9 - q.x * .6) + dome * .22));
  gc += .35 * smoothstep(.14, .02, length(q - vec2(-.07, .08))) ;     // the glint
  c = mix(c, iron, frame);
  c = mix(c, gc, gem);
  hh += .012 * frame + .03 * gem * sqrt(dome);
  // the handle ring at each end
  float ringS = 0.;
  if (f == 2) {
    vec2 p = vec2(s - FS * .5, t - .43);
    ringS = cov(sdRing(p, vec2(0., -.06), .1, .018), pw);
    float plate = cov(sdBox(p, vec2(0., .1), vec2(.07, .04), .015), pw);
    c = mix(c, iron * 1.4, max(ringS, plate));
    hh += .016 * max(ringS, plate);
  }
  o.col = c;
  o.rough = mix(.62, .38, strap) * mix(1., .3, gem);
  o.metal = max(strap * .55, max(rivets * .6, ringS * .6));
  o.h += hh;
  o.ao = mix(.68, 1., smoothstep(0., .03, ed)) * (1. - .18 * lidSeam);
}

// ---- iron: a bundle of square bars bound with two straps; the cut ends show as a grid of bright squares
void bundle(int f, float s, float t, float FS, float FT, float pw, inout Surf o) {
  float ed = edgeOf(s, t, FS, FT), lod = 1. - smoothstep(.02, .05, pw);
  vec3 steel = o.col;
  float bars = 4.;
  float bp = 1., gap = 0., tone = 1.;
  if (f == 0) { float r = t / (FT / bars); float rf = fract(r); float m = min(rf, 1. - rf); bp = smoothstep(0., .2, m); gap = 1. - smoothstep(0., .08, m); tone = .8 + .45 * h21(vec2(floor(r), 2.)); }
  else if (f == 1) { float r = t / (FT / bars); float rf = fract(r); float m = min(rf, 1. - rf); bp = smoothstep(0., .2, m); gap = 1. - smoothstep(0., .08, m); tone = .8 + .45 * h21(vec2(floor(r), 5.)); }
  float h = .035 * bp;
  vec3 c = steel * 1.35 * tone * (.75 + .55 * bp);
  float rough = mix(.62, .34, bp);
  if (f == 2) {                                                    // the bars' square ends
    float rs = s / (FS / bars), rt = t / (FT / bars);
    float ms = min(fract(rs), 1. - fract(rs)), mt = min(fract(rt), 1. - fract(rt));
    float sq = smoothstep(0., .14, ms) * smoothstep(0., .14, mt);
    float cut = h21(vec2(floor(rs), floor(rt)));
    c = mix(steel * .55, vec3(.2, .22, .25) * (.8 + .5 * cut), sq);
    h = .04 * sq;
    rough = mix(.7, .3, sq);
  }
  // two straps round the bundle
  float sa = .42, sb = FS - .42, bw = .075;
  float strap = (f == 2) ? 0. : max(cov(abs(s - sa) - bw, pw), cov(abs(s - sb) - bw, pw));
  vec3 band = vec3(.2, .215, .25) * (.85 + .3 * n2(vec2(s * 30., t * 30.)));
  c = mix(c, band, strap);
  h += .016 * strap * 1.5;
  float rivet = 0.;
  if (f != 2) {
    float tt = f == 0 ? FT * .5 : FT * .5;
    rivet = max(cov(length(vec2(s - sa, t - FT * .22)) - .024, pw), max(cov(length(vec2(s - sb, t - FT * .22)) - .024, pw), max(cov(length(vec2(s - sa, t - FT * .78)) - .024, pw), cov(length(vec2(s - sb, t - FT * .78)) - .024, pw))));
  }
  c = mix(c, vec3(.3, .32, .35), rivet);
  o.col = c;
  o.h = h + .01 * smoothstep(0., .04, ed) + .012 * rivet;
  o.rough = mix(rough, .4, strap);
  o.metal = .3;
  o.ao = mix(.6, 1., smoothstep(0., .03, ed)) * (1. - .45 * gap);
}

// ---- herring: a hooped cask lying on its side, its belly curved, a fish chalked on it, the round head at each end
float fishSd(vec2 p) {
  float body = (length((p - vec2(.04, 0.)) / vec2(.3, .125)) - 1.) * .125;
  float tx = (-.22 - p.x) / .19;
  float tail = max(abs(p.y) - .13 * tx, max(-tx, tx - 1.) * .19);
  return min(body, tail);
}
void cask(int f, float s, float t, float FS, float FT, float pw, inout Surf o) {
  float ed = edgeOf(s, t, FS, FT), lod = 1. - smoothstep(.02, .05, pw);
  vec3 wood = o.col;
  vec3 hoopC = vec3(.62, .45, .24);
  if (f == 2) {                                                    // the head: a round of planks inside its chime
    vec2 q = vec2(s - FS * .5, t - FT * .5);
    float r = length(q), R = .475;
    float inside = cov(r - R, pw);
    float plank = floor((s - .02) / .32);
    vec3 hd = wood * (.95 + .22 * h21(vec2(plank, 4.))) * (.92 + .16 * n2(vec2(s * 40., t * 3.)));
    float seams = cov(min(fract((s - .02) / .32), 1. - fract((s - .02) / .32)) * .32 - .006, pw);
    hd *= 1. - .5 * seams;
    float rim = cov(abs(r - (R - .028)) - .028, pw);
    hd = mix(hd, wood * 1.32, rim);
    vec3 corner = vec3(.07, .045, .03);
    o.col = mix(corner, hd, inside);
    o.h = .03 * inside * (1. - rim) + .04 * rim * inside - .02 * seams * inside + .01 * smoothstep(0., .04, ed);
    o.rough = .8;
    o.ao = mix(.62, 1., smoothstep(0., .03, ed)) * mix(.75, 1., inside);
    return;
  }
  float across = (t - FT * .5) / (FT * .5);                        // -1 to 1 over the curve of the belly
  float bil = (s - FS * .5) / (FS * .5);
  float stave = t / (FT / 8.), sf = fract(stave);
  float sm = min(sf, 1. - sf) * (FT / 8.);
  vec3 c = wood * (.82 + .3 * h21(vec2(floor(stave), float(f)))) * (.9 + .2 * n2(vec2(s * 2.2, t * 55.)));
  c *= 1. - .55 * cov(sm - .005, pw);
  float hp = 0.;
  float hoop = 0.;
  float hs[4]; hs[0] = .15; hs[1] = .43; hs[2] = FS - .43; hs[3] = FS - .15;
  for (int k = 0; k < 4; k++) hoop = max(hoop, cov(abs(s - hs[k]) - .036, pw));
  vec3 hc = hoopC * (.85 + .3 * n2(vec2(s * 20., t * 60.)));
  c = mix(c, hc, hoop);
  float dh = 9.;
  for (int k = 0; k < 4; k++) dh = min(dh, abs(s - hs[k]));
  c *= 1. - .35 * (1. - hoop) * smoothstep(.07, .036, dh);
  hp += .018 * hoop;
  if (f == 0) {                                                    // the bung, on top of the belly
    float bung = cov(length(vec2(s - .95, t - FT * .5)) - .075, pw);
    float plug = cov(length(vec2(s - .95, t - FT * .5)) - .047, pw);
    c = mix(c, vec3(.05, .03, .02), bung);
    c = mix(c, wood * 1.25, plug);
  } else {                                                         // the fish
    vec2 p = vec2(s - .95, t - FT * .5);
    float fish = cov(fishSd(p), pw) * (.55 + .45 * smoothstep(.25, .6, fbm(p * 30.) + .3));
    float eye = cov(length(p - vec2(.17, .03)) - .02, pw);
    c = mix(c, vec3(.93, .9, .8), fish * .9);
    c = mix(c, vec3(.08, .05, .03), eye * fish);
  }
  o.col = c;
  o.h = -.13 * across * across - .05 * bil * bil + hp + .004 * sm / (FT / 8.);
  o.rough = mix(.7, .5, hoop);
  o.metal = hoop * .05;
  o.ao = mix(.68, 1., smoothstep(0., .03, ed));
}
`;

// the surface's height turned into a normal (three's bump mapping, from the height worked out in the shader)
const BUMP = `
  {
    vec2 dH = vec2(dFdx(mfH), dFdy(mfH));
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 R1 = cross(sy, normal), R2 = cross(normal, sx);
    float det = dot(sx, R1) * faceDirection;
    vec3 grad = sign(det) * (dH.x * R1 + dH.y * R2);
    normal = normalize(abs(det) * normal - grad);
  }`;

/** The hooks into three's physical material: attributes and varyings, then the surface worked out before the light. */
export function packageShader(wareColours) {
  const wc = wareColours.map(c => `vec3(${c.map(n => n.toFixed(4)).join(",")})`).join(",");
  return {
    vertexHead: `attribute float aWare; varying float vWare; varying vec3 vLoc; varying vec3 vObjN;`,
    vertexBody: `vWare = aWare; vLoc = position; vObjN = normal;`,
    fragmentHead: `varying float vWare; varying vec3 vLoc; varying vec3 vObjN;
uniform float uDim; uniform float uFade; uniform vec3 uDimTo; uniform float uMark; uniform vec3 uInk; uniform vec3 uPaper;
${COMMON}
${PACKAGE_SURFACE}
const vec3 WC[7] = vec3[7](${wc});`,
    color: `
  float mfH, mfRough, mfMetal;
  {
    if (uFade < .999 && ign(gl_FragCoord.xy) > uFade) discard;
    vec3 P = (vLoc + .5) * vec3(PL, PH, PW);
    vec3 an = abs(vObjN);
    int f = an.y > .5 ? 0 : (an.z > .5 ? 1 : 2);
    float s, t, FS, FT;
    if (f == 0) { s = P.x; t = P.z; FS = PL; FT = PW; }
    else if (f == 1) { s = P.x; t = P.y; FS = PL; FT = PH; }
    else { s = P.z; t = P.y; FS = PW; FT = PH; }
    float pw = max((fwidth(s) + fwidth(t)) * .6, 1e-4);
    float w = vWare;
    Surf o; o.col = WC[int(w + .5)]; o.rough = .8; o.metal = 0.; o.h = 0.; o.ao = 1.;
    if (w < .5 || w > 5.5) tarp(f, s, t, FS, FT, pw, o);
    else if (w < 1.5) bale(f, s, t, FS, FT, pw, o);
    else if (w < 2.5) sack(f, s, t, FS, FT, pw, o);
    else if (w < 3.5) chest(f, s, t, FS, FT, pw, o);
    else if (w < 4.5) bundle(f, s, t, FS, FT, pw, o);
    else cask(f, s, t, FS, FT, pw, o);
    vec3 col = o.col * o.ao;
    float lum = dot(col, vec3(.3, .59, .11));
    col = mix(col, mix(vec3(lum), uDimTo, .55), uDim);                 // dimmed: the page's tone, grey of its own
    if (uMark > .5 && (f == 0 || uMark > 1.5)) {                       // marked: a frame inside the face's edge, ink outside and paper in, so it shows on dark iron and pale salt alike
      float e = edgeOf(s, t, FS, FT), fp = cov(e - .1, pw), fr = cov(e - .05, pw);
      col = mix(mix(col, uPaper, fp), uInk, fr); o.h *= 1. - fp; o.rough = mix(o.rough, .9, fp); o.metal *= 1. - fp;
    }
    diffuseColor.rgb = col;
    mfH = o.h; mfRough = o.rough; mfMetal = o.metal;
  }`,
    rough: `float roughnessFactor = mfRough;`,
    metal: `float metalnessFactor = mfMetal;`,
    normal: BUMP,
  };
}

/** The quay: oak planks on top laid along the packages, timber facing on the two near sides with piles and a waling. */
export const QUAY = {
  vertexHead: `varying vec3 vW; varying vec3 vObjN; varying vec3 vLoc;`,
  vertexBody: `vW = (modelMatrix * vec4(position, 1.)).xyz; vObjN = normal; vLoc = position;`,
  fragmentHead: `varying vec3 vW; varying vec3 vObjN; varying vec3 vLoc;
uniform vec3 uTimber; uniform vec2 uCell; uniform float uAlong; uniform float uDepth;
${COMMON}`,
  color: `
  float mfH, mfRough = .85;
  {
    vec3 an = abs(vObjN);
    vec3 col;
    float h = 0., ao = 1.;
    if (an.y > .5) {                                                // the floor: boards laid along the packages
      float u = uAlong < .5 ? vW.x : vW.z, v = uAlong < .5 ? vW.z : vW.x;
      float pw = max((fwidth(u) + fwidth(v)) * .6, 1e-4);
      float row = floor(v / .25), fv = fract(v / .25) * .25;
      float off = h21(vec2(row, 3.)) * 1.9;
      float cu = floor((u + off) / 1.9), fu = fract((u + off) / 1.9) * 1.9;
      float tone = .86 + .26 * h21(vec2(row, cu));
      float grain = n2(vec2(u * 1.3 + row * 4.1, v * 38.));
      col = uTimber * tone * (.88 + .2 * grain);
      float gap = max(cov(min(fv, .25 - fv) - .007, pw), cov(min(fu, 1.9 - fu) - .007, pw) * 1.);
      col *= 1. - .55 * gap;
      float nail = max(cov(length(vec2(fu - .09, fv - .125)) - .016, pw), cov(length(vec2(fu - 1.81, fv - .125)) - .016, pw));
      col = mix(col, uTimber * .35, nail);
      h = -.01 * gap;
      ao = 1.;
    } else {                                                        // the facing: upright boards, piles at every cell's edge, a waling
      float a = an.x > .5 ? vW.z : vW.x;
      float cellA = an.x > .5 ? uCell.y : uCell.x;
      float y = vW.y;
      float pw = max((fwidth(a) + fwidth(y)) * .6, 1e-4);
      float board = floor(a / .21), fb = fract(a / .21) * .21;
      col = uTimber * .5 * (.82 + .3 * h21(vec2(board, 9.))) * (.88 + .22 * n2(vec2(a * 40., y * 3.)));
      col *= 1. - .5 * cov(min(fb, .21 - fb) - .005, pw);
      float dp = abs(a - floor(a / cellA + .5) * cellA);
      float pile = cov(dp - .07, pw);
      float pr = sqrt(max(0., 1. - (dp / .07) * (dp / .07)));
      vec3 pc = uTimber * .33 * (.85 + .25 * n2(vec2(a * 12., y * 30.)));
      col = mix(col, pc, pile);
      h = .035 * pr * pile;
      float wal = cov(abs(y + uDepth * .5) - .045, pw);
      col = mix(col, uTimber * .6, wal * (1. - pile * .5));
      h += .02 * wal;
      col *= mix(.5, 1., smoothstep(-uDepth, -uDepth * .5, y));      // wet toward the water
      ao = mix(.75, 1., smoothstep(-uDepth, -.04, y));
    }
    diffuseColor.rgb = col * ao;
    mfH = h;
  }`,
  rough: `float roughnessFactor = mfRough;`,
  normal: BUMP,
};
