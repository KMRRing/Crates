// Manifest's cargo and quay, worked out in the shader (no pictures: the vendored three.js has no textures, and none is
// needed). The shapes are real meshes (manifest-shapes.js); what is drawn on them is worked out here from where each point
// lies on its piece: the planks, staves and hoops, the bark and its rings, the stamped bars, the straps and brass, the
// weave of the burlap, all as heights (so the light finds them) and colours.
//
// A piece is a unit cell centred on the origin. A fragment knows its place in it (vLoc, from -.5 to .5), its surface's
// normal there (vObjN), and its part of the piece (vPart.x), a seed and two coordinates (manifest-shapes.js lists them).
// Cargo types are numbered as the engine has them, 1 to 6; 0 and 7 are the tarpaulin and its lit piece, a plain box.
import { LOGS, INGOT_SHRINK } from "./manifest-shapes.js";

export const COMMON = `
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * n2(p); p = p * 2.03 + 7.3; a *= .5; } return s; }
float cov(float d, float w) { return clamp(.5 - d / w, 0., 1.); }                 // coverage of a shape from its signed distance d (negative inside), w a pixel
float sdBox(vec2 p, vec2 c, vec2 hs, float r) { vec2 q = abs(p - c) - hs + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float sdRing(vec2 p, vec2 c, float r, float hw) { return abs(length(p - c) - r) - hw; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }   // interleaved gradient noise: a fine dither
`;

/** The surface of a piece at a point: albedo, roughness, metalness, a height (the light finds the bumps) and occlusion. */
export const PACKAGE_SURFACE = `
struct Surf { vec3 col; float rough; float metal; float h; float ao; };
const float TAU = 6.2831853;

// the face of a box a point lies on: 0 the top, 1 the face toward the viewer's left, 2 the one toward the right; s along
// it and t up it (across, on a top)
void faceOf(vec3 Q, vec3 N, out int f, out float s, out float t) {
  vec3 a = abs(N);
  if (a.y > .5) { f = 0; s = Q.x; t = Q.z; }
  else if (a.z > .5) { f = 1; s = Q.x; t = Q.y; }
  else { f = 2; s = Q.z; t = Q.y; }
}
float edgeOf(float s, float t, float FS, float FT) { return min(min(s, FS - s), min(t, FT - t)); }

// ---- a tarpaulin: grey canvas and ropes, the same over any cargo (the turned question's stack, and the one piece it lights)
void tarp(vec3 Q, vec3 N, float pw, inout Surf o) {
  int f; float s, t; faceOf(Q, N, f, s, t);
  float ed = edgeOf(s, t, 1., 1.), lod = 1. - smoothstep(.02, .05, pw);
  o.h = .07 * smoothstep(0., .2, ed);
  float tw = .5 + .5 * sin((s + t) * 64.) * sin((s - t) * 57.);
  vec3 c = o.col * (1. - .06 * lod * tw) * (.93 + .12 * fbm(vec2(s, t) * 6.));
  float d1 = abs(s - .3333), d2 = abs(s - .6667), d3 = abs(t - .5);
  if (f == 2) { d1 = abs(s - .5); d2 = 9.; }
  float d = min(min(d1, d2), d3), al = d3 <= min(d1, d2) ? s : t;
  float r = cov(d - .03, pw), rd = sqrt(max(0., 1. - (d / .03) * (d / .03)));
  c *= 1. - .28 * (1. - r) * (1. - smoothstep(.03, .08, d));
  vec3 rope = vec3(.55, .42, .22) * (.82 + .3 * (.5 + .5 * sin(al * 70. + rd * 4.)) * lod);
  o.col = mix(c, rope, r);
  o.h += .016 * rd * r;
  o.rough = .95;
  o.ao = mix(.62, 1., smoothstep(0., .03, ed));
}

// ---- a crate: pine boards in a frame of battens nailed at the corners, a rope handle through a slot on each side, and the
// house mark stencilled on one
void crate(vec3 Q, vec3 N, float pw, inout Surf o) {
  vec3 q = clamp((Q - .03) / .94, 0., 1.);
  float pq = pw / .94;
  int f; float s, t; faceOf(q, N, f, s, t);
  float ed = edgeOf(s, t, 1., 1.);
  float post = max(cov(.105 - s, pq), cov(s - .895, pq));          // the battens at the corners
  float h = 0., nail = 0.;
  vec3 c;
  float bi = floor(t * 4.), bf = fract(t * 4.);
  float tone = .84 + .26 * h21(vec2(bi, float(f)));
  c = o.col * tone * (.86 + .24 * n2(vec2(s * 6. + bi * 7. + float(f) * 3., t * 110.)));
  float gap = cov(min(bf, 1. - bf) * .25 - .007, pq);
  c *= 1. - .55 * gap; h = -.012 * gap;
  for (int k = 0; k < 4; k++) {
    float ty = (float(k) + .5) / 4.;
    nail = max(nail, max(cov(length(vec2(s - .052, t - ty)) - .017, pq), cov(length(vec2(s - .948, t - ty)) - .017, pq)));
  }
  float brace = 0.;
  if (f == 1) brace = cov(abs(t - s) * .7071 - .045, pq) * step(.1, s) * step(s, .9);
  c *= 1. + .07 * max(post, brace); h += .026 * post + .018 * brace;
  c = mix(c, vec3(.1, .08, .06), nail * .85); h += .01 * nail;
  if (f != 0) {
    vec2 sl = vec2(s - .5, t - .78);
    float slot = cov(sdBox(sl, vec2(0.), vec2(.17, .03), .025), pq);
    c = mix(c, vec3(.05, .035, .02), slot); h -= .02 * slot;
    float u = clamp((s - .5) / .17, -1., 1.), ry = .78 - .045 * (1. - u * u);   // the rope sags between the slot's ends
    float rope = cov(abs(t - ry) - .02, pq) * cov(abs(s - .5) - .2, pq);
    c = mix(c, vec3(.74, .62, .4) * (.7 + .4 * (.5 + .5 * sin(s * 300. + t * 60.))), rope); h += .022 * rope;
  }
  if (f == 2) {                                                    // the house mark: a ring, a cross, burnt on with a stencil
    vec2 m = vec2(s - .5, t - .36);
    float ring = cov(abs(length(m) - .19) - .016, pq);
    float cr = max(cov(sdBox(m, vec2(0.), vec2(.012, .14), 0.), pq), cov(sdBox(m, vec2(0.), vec2(.14, .012), 0.), pq));
    float dia = cov(abs(abs(m.x) + abs(m.y) - .075) - .011, pq);
    float ink = max(ring, max(cr, dia)) * (.55 + .45 * smoothstep(.25, .5, fbm(m * 30.) + .25));
    c = mix(c, vec3(.07, .05, .035), ink * .88);
  }
  o.col = c; o.h = h; o.rough = .86;
  o.ao = mix(.6, 1., smoothstep(0., .035, ed));
}

// ---- a barrel: oak staves bound with four iron hoops, the head with its bung, the house mark on the belly
void barrel(vec3 Q, vec3 N, int part, float pw, inout Surf o) {
  vec3 P = Q - .5;
  float ang = atan(P.z, P.x), r = length(P.xz);
  vec3 oak = o.col;
  if (part == 1) {                                                 // the head: planks inside a raised chime
    float R = r / .37;
    float bi = floor((P.x + .37) / .185);
    float tone = .86 + .26 * h21(vec2(bi, 4.));
    vec3 c = oak * tone * (.9 + .2 * n2(vec2(P.z * 4. + bi * 5., P.x * 90.)));
    float fx = fract((P.x + .37) / .185) * .185;
    c *= 1. - .55 * cov(min(fx, .185 - fx) - .005, pw);
    float rim = cov(R - .87, pw / .37);
    c = mix(c, oak * 1.28, rim);
    vec2 b = P.xz - vec2(.13, .06);
    float bung = cov(length(b) - .038, pw), plug = cov(length(b) - .022, pw);
    c = mix(c, vec3(.04, .025, .015), bung); c = mix(c, oak * 1.3, plug);
    float mark = cov(abs(length(P.xz + vec2(.05, .0)) - .12) - .008, pw) * .5;   // the cooper's ring
    c = mix(c, vec3(.06, .04, .025), mark);
    o.col = c; o.h = .006 * (1. - rim) + .012 * rim; o.rough = .82;
    o.ao = mix(.75, 1., smoothstep(1., .8, R));
    return;
  }
  float sc = (ang / TAU + .5) * 18., si = floor(sc), sf = fract(sc);
  float arc = TAU * max(r, .2) / 18.;
  float seam = cov(min(sf, 1. - sf) * arc - .004, pw);
  float tone = .8 + .35 * h21(vec2(si, 1.));
  vec3 c = oak * tone * (.86 + .22 * n2(vec2(si * 11. + sf * 2., Q.y * 7.)) + .05 * sin(Q.y * 44. + si * 3.));
  c *= 1. - .6 * seam;
  float hoop = 0., dh = 9.;
  for (int k = 0; k < 4; k++) {
    float hy = k == 0 ? .08 : k == 1 ? .25 : k == 2 ? .75 : .92;
    dh = min(dh, abs(Q.y - hy));
  }
  hoop = cov(dh - .028, pw);
  vec3 iron = vec3(.11, .1, .095) * (.8 + .5 * n2(vec2(ang * 20., Q.y * 60.)));
  c *= 1. - .35 * (1. - hoop) * smoothstep(.062, .028, dh);
  c = mix(c, iron, hoop);
  float da = ang - .7854;                                          // the belly's front, toward the viewer
  vec2 m = vec2(da * .44, Q.y - .5);
  float ring = cov(abs(length(m) - .12) - .011, pw), cr = max(cov(sdBox(m, vec2(0.), vec2(.008, .09), 0.), pw), cov(sdBox(m, vec2(0.), vec2(.09, .008), 0.), pw));
  float ink = max(ring, cr) * (.5 + .5 * smoothstep(.25, .5, fbm(m * 36.) + .25)) * step(abs(da), .9);
  c = mix(c, vec3(.9, .85, .72), ink * .75);                      // chalked, not burnt: it shows on dark oak
  o.col = c; o.rough = mix(.72, .5, hoop); o.metal = hoop * .35;
  o.h = .014 * hoop - .007 * seam + .004 * sin(sc * TAU);
  o.ao = mix(.7, 1., smoothstep(0., .1, .5 - abs(Q.y - .5)) * .6 + .4);
}

// ---- timber: logs with their bark on, tied with rope; a sawn end shows rings and a heart
const vec3 LOGS[4] = vec3[4](${LOGS.map(L => `vec3(${L.y}, ${L.z}, ${L.r})`).join(", ")});
void timber(vec3 Q, vec3 N, int part, float seed, vec2 uv, float pw, inout Surf o) {
  vec3 P = Q - .5;
  if (part == 2) {                                                 // the rope: three strands twisted
    float st = fract(uv.x * 4.3 + uv.y * 3.), ridge = .5 + .5 * sin(st * TAU);
    o.col = vec3(.74, .6, .38) * (.7 + .38 * ridge) * (.9 + .15 * n2(vec2(uv.x * 30., uv.y * 5.)));
    o.h = .008 * ridge; o.rough = .95; o.ao = .95;
    return;
  }
  int k = int(seed + .5);
  vec3 L = LOGS[k];
  vec2 d = P.yz - L.xy;
  float R = length(d) / L.z, a = atan(d.x, d.y);
  if (part == 1) {                                                 // the sawn end: rings round a heart, a crack or two
    float wob = (n2(vec2(a * 1.4 + seed * 3., R * 3.)) - .5) * .09;
    float ringS = .5 + .5 * sin((R + wob) * 40.);
    vec3 c = mix(vec3(.84, .66, .4), vec3(.6, .42, .22), ringS * .6);
    c *= 1. - .22 * smoothstep(.16, 0., R);
    float crack = pow(max(0., 1. - abs(sin(a * 1.5 + seed * 5.))), 30.) * smoothstep(.12, .45, R);
    c *= 1. - .42 * crack;
    c = mix(c, o.col * .62, smoothstep(.86, .94, R));
    o.col = c; o.rough = .9; o.h = .007 * ringS - .012 * crack - .01 * smoothstep(.9, 1., R);
    o.ao = mix(1., .72, smoothstep(.8, 1., R));
    return;
  }
  float along = P.x;
  float rid = n2(vec2(a * 4.5 + seed * 4., along * 3.5));
  float fur = .5 + .5 * sin(a * 16. + rid * 5. + seed * 2.);
  vec3 c = o.col * .8 * (.55 + .6 * rid) * (.7 + .4 * fur);
  float bare = smoothstep(.7, .8, n2(vec2(a * 2. + seed * 7., along * 2.2 + 3.)));        // a patch where the bark is gone
  c = mix(c, vec3(.5, .36, .2) * (.85 + .15 * fur), bare * .8);
  float moss = smoothstep(.62, .8, fbm(vec2(a * 3. + seed, along * 5.))) * (1. - bare);
  c = mix(c, vec3(.2, .26, .12), moss * .5);
  o.col = c; o.rough = .95; o.h = .02 * fur * rid * (1. - bare);
  // inward-facing parts lie in the cleft between the logs
  vec3 toMid = normalize(vec3(0., P.y + .047, P.z) + vec3(0., 1e-4, 0.));
  o.ao = mix(.5, 1., smoothstep(-.35, .5, dot(N, toMid)));
}

// ---- ingots: bars of tin, lead and now and then copper, a maker's stamp pressed in each top
void ingot(vec3 Q, vec3 N, float seed, float pw, inout Surf o) {
  vec3 P = Q - .5;
  int bar = int(seed + .5), layer = bar / 3, k = bar - layer * 3;
  float sc = 1. - ${INGOT_SHRINK.toFixed(3)} * float(layer), across = (float(k) - 1.) * .318 * sc;
  bool alongX = (layer - (layer / 2) * 2) == 0;
  float s = alongX ? P.x : P.z, t = (alongX ? P.z : P.x) - across;
  float tone = h21(vec2(seed, 7.));
  vec3 base = mix(vec3(.78, .82, .9), vec3(.44, .48, .58), tone) * (o.col / vec3(.27, .33, .41));   // tin to lead, in the cargo's own cast
  if (tone > .86) base = vec3(.62, .3, .17);                                                        // now and then copper
  float top = smoothstep(.5, .85, N.y);
  vec3 c = base * (.82 + .3 * n2(vec2(s * 40., t * 6. + seed)) + .12 * fbm(vec2(s, t) * 14. + seed));
  // the stamp: a recessed plate with the maker's marks
  vec2 m = vec2(s, t) / sc;
  float plate = cov(sdBox(m, vec2(0.), vec2(.2, .07), .01), pw) * top;
  float glyph = 0.;
  for (int i = 0; i < 5; i++) {
    float on = step(.45, h21(vec2(float(i) + 1., seed)));
    glyph = max(glyph, on * cov(sdBox(m, vec2((float(i) - 2.) * .075, 0.), vec2(.018, .045), 0.), pw));
  }
  glyph *= plate;
  c = mix(c, c * .62, plate); c = mix(c, c * 1.5 + .05, glyph);
  float hh = -.012 * plate + .008 * glyph;
  float lowSide = 1. - top;
  c *= 1. - .22 * lowSide;
  o.col = c; o.h = hh; o.metal = .55; o.rough = .28 + .3 * fbm(vec2(s, t) * 20.);
  float tw = abs(t) / (.15 * sc);
  o.ao = mix(1., .55, smoothstep(.7, 1., tw) * lowSide);
}

// ---- a chest: dark oak planks, black iron straps with brass studs, a brass lock plate and hasp, a ring at each end
void chest(vec3 Q, vec3 N, int part, float pw, inout Surf o) {
  vec3 P = Q - .5, wood = o.col, iron = vec3(.05, .05, .06), brass = vec3(.85, .64, .25);
  vec3 c; float h = 0., strap = 0., stud = 0., plate = 0., metalness = 0., rough = .8;
  if (part == 0) {                                                 // the body
    bool front = abs(N.z) > .5;
    float s = front ? P.x : P.z, t = Q.y;                          // t from 0 to .52 up the body
    float pk = floor(t / .13), pf = fract(t / .13);
    c = wood * (.85 + .3 * h21(vec2(pk, front ? 1. : 2.))) * (.85 + .26 * n2(vec2(s * 5. + pk * 4., t * 120.)));
    float seam = cov(min(pf, 1. - pf) * .13 - .005, pw);
    c *= 1. - .55 * seam; h -= .01 * seam;
    float sd = front ? abs(abs(s) - .37) : abs(s);
    strap = max(cov(sd - .05, pw), cov(abs(t - .03) - .03, pw));   // two straps up the front, one up each end, a band at the foot
    stud = 0.;
    for (int k = 0; k < 3; k++) {
      float ty = .1 + float(k) * .17;
      stud = max(stud, front ? max(cov(length(vec2(s - .37, t - ty)) - .018, pw), cov(length(vec2(s + .37, t - ty)) - .018, pw)) : cov(length(vec2(s, t - ty)) - .018, pw));
    }
    if (front) {                                                    // the lock plate, with its keyhole
      plate = cov(sdBox(vec2(s, t - .33), vec2(0.), vec2(.075, .1), .02), pw);
      float key = max(cov(length(vec2(s, t - .35)) - .014, pw), cov(sdBox(vec2(s, t - .31), vec2(0.), vec2(.006, .026), 0.), pw));
      c = mix(c, iron, strap); c = mix(c, brass * (.9 + .15 * n2(vec2(s * 30., t * 30.))), max(stud, plate)); c = mix(c, vec3(.03), key * plate);
    } else {
      float ringS = cov(sdRing(vec2(s, t - .28), vec2(0., -.05), .075, .012), pw), pl = cov(sdBox(vec2(s, t - .28), vec2(0., .06), vec2(.05, .028), .01), pw);
      c = mix(c, iron, strap); c = mix(c, brass, max(stud, max(ringS, pl))); plate = max(ringS, pl);
    }
    h += .016 * strap + .014 * max(stud, plate);
    metalness = max(strap * .6, max(stud, plate) * .85); rough = mix(.8, .38, max(strap, max(stud, plate)));
    o.ao = mix(.6, 1., smoothstep(0., .03, front ? min(.37 - abs(P.x) + .1, Q.y) : min(.47 - abs(P.z) + .1, Q.y)) * .6 + .4);
  } else if (part == 1) {                                          // the lid: planks along its length, straps over it, the hasp
    float th = atan(P.y - .02, P.z), v = th / 3.14159;
    float pk = floor(v * 5.), pf = fract(v * 5.);
    c = wood * 1.06 * (.85 + .3 * h21(vec2(pk, 5.))) * (.85 + .26 * n2(vec2(P.x * 4. + pk * 3., v * 150.)));
    float seam = cov(min(pf, 1. - pf) * .27 - .005, pw);
    c *= 1. - .55 * seam; h -= .01 * seam;
    strap = max(cov(abs(abs(P.x) - .37) - .05, pw), cov(abs(v) - .03, pw));
    float hasp = cov(abs(P.x) - .055, pw) * cov(v - .22, pw * .75);
    for (int k = 0; k < 4; k++) {
      float vv = .14 + float(k) * .2;
      stud = max(stud, max(cov(length(vec2(P.x - .37, (v - vv) * 1.35)) - .018, pw), cov(length(vec2(P.x + .37, (v - vv) * 1.35)) - .018, pw)));
    }
    c = mix(c, iron, strap); c = mix(c, brass, max(stud, hasp));
    h += .016 * strap + .014 * max(stud, hasp);
    plate = hasp;
    metalness = max(strap * .6, max(stud, hasp) * .85); rough = mix(.78, .38, max(strap, max(stud, hasp)));
    o.ao = mix(.65, 1., smoothstep(0., .08, v) * .6 + .4);
  } else {                                                         // the lid's end: a half-moon of end grain with an iron rim
    float rad = length(vec2((P.y - .02) / .48, P.z / .37));
    c = wood * 1.1 * (.8 + .3 * n2(vec2(P.z * 6., (P.y - .02) * 90.)));
    strap = cov(.92 - rad, pw / .4);
    c = mix(c, iron, strap);
    metalness = strap * .6; rough = mix(.8, .4, strap);
    o.ao = .9;
  }
  o.col = c; o.h = h; o.rough = rough; o.metal = metalness;
}

// ---- a sack: burlap, its weave and folds, the merchant's mark on the belly, a cord round the neck
void sack(vec3 Q, vec3 N, int part, float pw, inout Surf o) {
  vec3 P = Q - .5;
  float ang = atan(P.z, P.x), u = ang * .42, v = Q.y;
  if (part == 1) { o.col = vec3(.5, .38, .2); o.rough = .95; o.ao = .9; return; }       // the knot's top
  float lod = 1. - smoothstep(.007, .02, pw);
  float wv = (.5 + .5 * sin(u * 96.) * sin(v * 96.)) * lod;
  float fold = fbm(vec2(u * 5., v * 4.));
  vec3 c = o.col * (1. - .09 * wv) * (.84 + .3 * fold);
  vec2 m = vec2((ang - .7854) * .44, v - .3);
  float tri = max(abs(m.x) * .86 + m.y * .5, -m.y) - .09;
  tri = max(tri, -(abs(m.x) * .86 + m.y * .5 - .055));
  float ring = abs(length(m) - .15) - .009;
  float mark = max(cov(tri * .8, pw), cov(ring, pw)) * (.55 + .45 * smoothstep(.25, .5, fbm(m * 30.) + .25)) * step(abs(ang - .7854), .8);
  c = mix(c, vec3(.32, .2, .12), mark * .85);
  float hem = step(.5, fract(u * 40.)) * cov(abs(v - .12) - .006, pw);   // the stitched hem
  c = mix(c, vec3(.36, .29, .2), hem * .7);
  float cord = cov(abs(v - .952) - .03, pw);
  float twist = .5 + .5 * sin(ang * 36. + v * 90.);
  c = mix(c, vec3(.55, .42, .22) * (.75 + .35 * twist), cord);
  o.col = c; o.rough = .97; o.h = .03 * (fold - .5) + .012 * cord + .004 * wv;
  o.ao = mix(.65, 1., smoothstep(0., .08, v) * .5 + .5);
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
    vertexHead: `attribute float aWare; attribute vec4 aPart; varying float vWare; varying vec4 vPart; varying vec3 vLoc; varying vec3 vObjN;`,
    vertexBody: `vWare = aWare; vPart = aPart; vLoc = position; vObjN = normal;`,
    fragmentHead: `varying float vWare; varying vec4 vPart; varying vec3 vLoc; varying vec3 vObjN;
uniform float uDim; uniform float uFade; uniform vec3 uDimTo;
${COMMON}
${PACKAGE_SURFACE}
const vec3 WC[${wareColours.length}] = vec3[${wareColours.length}](${wc});`,
    color: `
  float mfH, mfRough, mfMetal;
  {
    if (uFade < .999 && ign(gl_FragCoord.xy) > uFade) discard;
    vec3 Q = vLoc + .5;
    vec3 N = normalize(vObjN);
    float pw = max(length(fwidth(Q)) * .58, 1e-4);
    int w = int(vWare + .5), part = int(vPart.x + .5);
    Surf o; o.col = WC[w]; o.rough = .8; o.metal = 0.; o.h = 0.; o.ao = 1.;
    // 1 crate, 2 barrel, 3 timber, 4 ingots, 5 chest, 6 sack; 0 and 7 the tarpaulin and the lit piece under it
    if (w == 1) crate(Q, N, pw, o);
    else if (w == 2) barrel(Q, N, part, pw, o);
    else if (w == 3) timber(Q, N, part, vPart.y, vPart.zw, pw, o);
    else if (w == 4) ingot(Q, N, vPart.y, pw, o);
    else if (w == 5) chest(Q, N, part, pw, o);
    else if (w == 6) sack(Q, N, part, pw, o);
    else tarp(Q, N, pw, o);
    vec3 col = o.col * o.ao;
    float lum = dot(col, vec3(.3, .59, .11));
    col = mix(col, mix(vec3(lum), uDimTo, .55), uDim);                 // dimmed: the page's tone, grey of its own
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
