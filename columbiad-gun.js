// The Columbiad itself, drawn in canvas 2D from paths and gradients, in the Earth's own manner (columbiad-sphere.js): every surface
// is lit from the same Sun, by the same Lambert rule with the same soft terminator (a smoothstep, not a hard edge), its shadow side
// falls to the night's blue-black rather than to black, a cool bounce of the Earth's haze rims the side away from the Sun, and no part
// has a black outline: a shape ends where its shading ends, with at most a hairline between parts. The Sun is fixed on the screen,
// so as the barrel turns, its highlight slides along its girth instead of turning with it. Engraved, in the sense of the rest of the
// scene: a graticule on the Earth, fine hatching in the gun's shade. A bronze siege mortar: a rounded breech with a brass cascabel
// (the knob at its rear), a long tapering chase with raised reinforcing rings, a flared muzzle swell and a dark bore, held by the
// near timber cheek (iron straps, brass rivets) round a brass trunnion, on a plank platform in a turfed earthwork, an elevating screw
// from the breech to the platform. It is much larger than a real gun would be on
// this scale (it is a character). Nothing here is a rule: the shell starts where the engine says; the page draws a lead-in from
// the muzzle (columbiad-view.js).
const DEG = Math.PI / 180;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The gun's size in pixels for a camera scale k (pixels per Earth radius) and the page's rem over 16: L (barrel length), Th (its girth), PH (how high the pivot stands above the ground). */
export function gunSize(k, u) {
  const Th = Math.max(0.105 * k, 8 * u);
  return { L: Math.max(0.34 * k, 22 * u), Th, PH: Th * 1.55 };
}
/** How far along the barrel from the pivot the muzzle's centre is, in barrel lengths. */
export const MUZZLE = 0.9;

// ---------- the materials: a colour for how much light a point gets (0 night side .. 1 full Sun) ----------
// the shade stop is the Earth's night side (a blue-black), the top stop the Sun on the metal; brass is the codex's own (217, 164, 65)
const MATS = {
  bronze: [[0, 16, 14, 26], [0.4, 82, 56, 34], [0.78, 164, 112, 56], [1, 232, 188, 120]],
  brass: [[0, 20, 17, 30], [0.4, 118, 76, 30], [0.78, 217, 164, 65], [1, 247, 218, 152]],
  iron: [[0, 12, 15, 28], [0.45, 62, 72, 92], [0.8, 140, 156, 180], [1, 205, 217, 234]],
  timber: [[0, 17, 13, 22], [0.45, 84, 58, 34], [0.8, 140, 102, 60], [1, 192, 150, 96]],
  brick: [[0, 24, 14, 24], [0.45, 112, 64, 46], [0.8, 168, 104, 72], [1, 214, 150, 110]],
  earth: [[0, 12, 15, 26], [0.45, 56, 54, 40], [0.8, 100, 90, 60], [1, 150, 128, 84]],      // the Earth's own olive and ochre
};
/** The colour of material m at light I (0..1) on a surface turned `nz` toward the viewer; the Earth's haze bounces off the rim. */
function tone(m, I, nz) {
  let i = 1;
  while (i < m.length - 1 && I > m[i][0]) i++;
  const a = m[i - 1], b = m[i], t = clamp01((I - a[0]) / (b[0] - a[0]));
  let r = a[1] + (b[1] - a[1]) * t, g = a[2] + (b[2] - a[2]) * t, bl = a[3] + (b[3] - a[3]) * t;
  const haze = (1 - nz) * (1 - nz) * (0.25 + 0.75 * I) * 0.5;       // the Earth's own rim: (1 - z)^2 of its haze, in the same blue
  r += (120 - r) * haze; g += (172 - g) * haze; bl += (255 - bl) * haze;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}
/** The Earth's light rule: Lambert with a soft terminator. */
const lamb = d => { const t = clamp01((d + 0.1) / 0.62); return t * t * (3 - 2 * t); };

/**
 * A gradient across a surface from (x0, y0) to (x1, y1), as on a cylinder (round 1) or a flat face (round 0 is all one tone, the
 * face's own): `b` is how much of the Sun's light lies along that direction (-1 .. 1), `lz` how much toward the viewer.
 */
function across(ctx, m, x0, y0, x1, y1, b, lz, round) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1), N = 8;
  for (let i = 0; i <= N; i++) {
    const c = (2 * i / N - 1) * round, nz = Math.sqrt(1 - c * c);
    g.addColorStop(i / N, tone(m, lamb(c * b + nz * lz), nz));
  }
  return g;
}

/**
 * Draws the gun standing at (bx, by), the surface point in pixels, on a surface whose outward direction is `site` degrees round from
 * the right (90: up), the barrel at `th` radians (screen y up), kicked back `kick` pixels along its axis, lit from `sun` (x right,
 * y up, z toward the viewer: the Earth's own, from columbiad-sphere.js `sunOf`).
 * Returns the muzzle's centre in pixels: { x, y }.
 */
export function drawGun(ctx, bx, by, k, u, site, th, kick, sun = [-0.612, 0.612, 0.5]) {
  const { L, Th, PH } = gunSize(k, u), hair = Math.max(0.8, 0.8 * u);
  const ground = -(site - 90) * DEG, lz = sun[2], lxc = sun[0], lyc = -sun[1];       // the Sun's direction in canvas axes (y down)
  const cg = Math.cos(ground), sg = Math.sin(ground);
  const bxg = lxc * cg + lyc * sg, byg = -lxc * sg + lyc * cg;                       // the Sun along the ground frame's x (right) and y (down)
  const RIM = "rgba(8,10,22,.42)";

  // ---- the ground frame: the earthwork, the platform, the carriage ----
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(ground);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  // the earthwork: a rounded bank thrown up round the platform, turf-topped, its crown toward the Sun
  const mw = Th * 4.4, mh = Th * 0.78;
  ctx.fillStyle = across(ctx, MATS.earth, 0, -mh, 0, Th * 0.25, byg, lz, 0.55);
  ctx.beginPath();
  ctx.moveTo(-mw / 2 - Th * 0.9, Th * 0.3);
  ctx.bezierCurveTo(-mw / 2 - Th * 0.1, Th * 0.1, -mw * 0.36, -mh, -mw * 0.16, -mh);
  ctx.lineTo(mw * 0.16, -mh);
  ctx.bezierCurveTo(mw * 0.36, -mh, mw / 2 + Th * 0.1, Th * 0.1, mw / 2 + Th * 0.9, Th * 0.3);
  ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(9,12,22,.16)"; ctx.lineWidth = Math.max(0.8, 0.8 * u);
  ctx.beginPath(); for (let i = 1; i < 5; i++) { const y = -mh + i * mh / 4.6; ctx.moveTo(-mw, y); ctx.lineTo(mw, y + Th * 0.05); } ctx.stroke();
  const fade = ctx.createLinearGradient(0, -mh, 0, Th * 0.3);                        // the bank sinks into the Earth's own shade at its foot
  fade.addColorStop(0.55, "rgba(10,12,26,0)"); fade.addColorStop(1, "rgba(10,12,26,.4)");
  ctx.fillStyle = fade; ctx.fillRect(-mw, -mh, 2 * mw, mh + Th);
  ctx.restore();
  // the platform: timber planking, a hair of shade under its lip
  const pw = Th * 2.7, ph = Th * 0.2, py0 = -mh;
  ctx.fillStyle = across(ctx, MATS.timber, 0, py0 - ph, 0, py0, byg, lz, 0.6);
  ctx.fillRect(-pw / 2, py0 - ph, pw, ph);
  ctx.strokeStyle = "rgba(14,8,18,.35)"; ctx.lineWidth = Math.max(0.7, 0.7 * u);
  ctx.beginPath(); for (let x = -pw / 2 + Th * 0.3; x < pw / 2; x += Th * 0.3) { ctx.moveTo(x, py0 - ph); ctx.lineTo(x, py0); } ctx.stroke();
  ctx.fillStyle = "rgba(10,12,26,.25)"; ctx.fillRect(-pw / 2, py0 - 0.5, pw, Math.max(1, Th * 0.04));
  const top = py0 - ph, py = -PH;
  ctx.restore();

  // the pivot in pixels (PH along the surface's normal), and the elevating screw: a brass rod from the platform to the breech's
  // underside, swinging as the barrel lifts
  const nx = Math.cos(site * DEG), ny = -Math.sin(site * DEG), pxv = bx + nx * PH, pyv = by + ny * PH;
  const cth = Math.cos(th), sth = Math.sin(th);
  const [sbx, sby] = [pxv + cth * (-0.14 * L - kick) + sth * Th * 0.6, pyv - sth * (-0.14 * L - kick) + cth * Th * 0.6];
  const fxg = -pw * 0.3, fyg = -mh - ph;
  const fx = bx + fxg * cg - fyg * sg, fy = by + fxg * sg + fyg * cg;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = tone(MATS.brass, 0.1, 0.5); ctx.lineWidth = Math.max(2.6, 3 * u); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sbx, sby); ctx.stroke();
  ctx.strokeStyle = tone(MATS.brass, 0.85, 1); ctx.lineWidth = Math.max(1.2, 1.3 * u); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sbx, sby); ctx.stroke();
  ctx.restore();

  // ---- the barrel's frame: x along the bore from the pivot, y toward the underside ----
  const bc = lxc * sth + lyc * cth, ba = lxc * cth - lyc * sth;                        // the Sun in it: along the bore, across it
  ctx.save();
  ctx.translate(pxv, pyv);
  ctx.rotate(-th);
  ctx.translate(-kick, 0);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const x0 = -0.24 * L, xm = 0.88 * L;
  // half the girth at x: a rounded breech, a long taper (the chase), a neck and the flare of the muzzle swell, and the raised rings
  const RINGS = [[-0.04, 0.05, 0.1], [0.15, 0.034, 0.075], [0.34, 0.034, 0.075], [0.55, 0.03, 0.065], [0.7, 0.026, 0.06]];
  const ease = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const hb = x => {
    const s = x / L;
    let r;
    if (s < -0.1) r = 0.8 * Math.sqrt(Math.max(0, 1 - ((-0.1 - s) / 0.14) ** 2));
    else if (s < 0.74) r = 0.8 - 0.3 * ease((s + 0.1) / 0.84);
    else r = 0.5 + 0.15 * ease((s - 0.76) / 0.1);
    for (const [c, w, h] of RINGS) r += h * ease((w / 2 + 0.008 - Math.abs(s - c)) / 0.008);
    return Th * r;
  };
  // the cascabel: a short neck, and a knob behind the breech, brass
  ctx.fillStyle = across(ctx, MATS.brass, 0, -Th * 0.17, 0, Th * 0.17, bc, lz, 1);
  ctx.fillRect(x0 - 0.05 * L, -Th * 0.17, 0.08 * L, Th * 0.34);
  ball(ctx, x0 - 0.085 * L, 0, Th * 0.27, MATS.brass, ba, bc, lz);
  // the body, a slice at a time so that each is shaded across its own girth (a tapered cylinder: the same Sun on every ring)
  const N = 90;
  ctx.beginPath();
  ctx.moveTo(x0, 0);
  for (let i = 1; i <= N; i++) { const x = x0 + (xm - x0) * i / N; ctx.lineTo(x, -hb(x)); }
  for (let i = N; i >= 1; i--) { const x = x0 + (xm - x0) * i / N; ctx.lineTo(x, hb(x)); }
  ctx.closePath();
  ctx.save(); ctx.clip();
  const C = 56;
  for (let i = 0; i < C; i++) {
    const xa = x0 + (xm - x0) * i / C, xb = x0 + (xm - x0) * (i + 1) / C, h = Math.max(1, hb((xa + xb) / 2));
    ctx.fillStyle = across(ctx, MATS.bronze, 0, -h, 0, h, bc, lz, 1);
    ctx.fillRect(xa, -Th * 1.2, xb - xa + 1, 2.4 * Th);
  }
  // the breech sits deeper in its own shade; a soft shade under every ring's edges gives them height
  const ao = ctx.createLinearGradient(x0, 0, xm, 0);
  ao.addColorStop(0, "rgba(10,10,24,.4)"); ao.addColorStop(0.35, "rgba(10,10,24,0)");
  ctx.fillStyle = ao; ctx.fillRect(x0, -Th, xm - x0, 2 * Th);
  ctx.strokeStyle = RIM; ctx.lineWidth = hair;
  ctx.beginPath();
  for (const [c, w] of RINGS) for (const e of [c - w / 2, c + w / 2]) { const h = hb(e * L); ctx.moveTo(e * L, -h); ctx.lineTo(e * L, h); }
  ctx.stroke();
  // the Sun's streak along the girth, where the half-way vector between the Sun and the eye stands, and a faint reflected warmth under
  const hl = Math.sqrt(bc * bc + (lz + 1) * (lz + 1)), yh = (bc / hl) * 0.62;
  const streak = (y, a, w) => {
    ctx.strokeStyle = `rgba(255,232,172,${a})`; ctx.lineWidth = w;
    ctx.beginPath(); for (let i = 0; i <= N; i++) { const x = x0 + 0.03 * L + (xm - x0 - 0.04 * L) * i / N, yy = y * hb(x); if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); } ctx.stroke();
  };
  streak(yh, 0.5, Math.max(1.4, 1.9 * u)); streak(yh, 0.72, Math.max(0.8, 0.9 * u));
  ctx.restore();
  // the muzzle: a dark bore with a brass lip, a thin ring of light round it
  const zh = hb(xm), bw = Math.max(1.2, 0.04 * L), bh = zh * 0.74, bxm = xm + 0.012 * L;
  ctx.fillStyle = across(ctx, MATS.bronze, 0, -zh, 0, zh, bc, lz, 1);
  ctx.beginPath(); ctx.ellipse(bxm, 0, bw * 1.5, zh, 0, 0, 6.2832); ctx.fill();
  const bg = ctx.createRadialGradient(bxm - bw * 0.3, 0, 0, bxm, 0, bh);
  bg.addColorStop(0, "#0a0c18"); bg.addColorStop(1, "#04060e");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(bxm, 0, bw, bh, 0, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = tone(MATS.brass, 0.85, 1); ctx.lineWidth = Math.max(0.8, 0.9 * u); ctx.stroke();
  ctx.restore();

  // the carriage: the near cheek, a timber plate from the platform up and round the trunnion (it stands in front of the barrel's
  // underside), with iron straps and brass rivets
  ctx.save();
  ctx.translate(bx, by); ctx.rotate(ground);
  ctx.lineJoin = "round";
  const cw = Th * 2.6, tw = Th * 0.78;
  ctx.fillStyle = across(ctx, MATS.timber, -cw / 2, 0, cw / 2, 0, bxg, lz, 0.5);
  ctx.beginPath();
  ctx.moveTo(-cw / 2, top);
  ctx.quadraticCurveTo(-tw * 1.05, top + (py - top) * 0.55, -tw, py);
  ctx.arc(0, py, tw, Math.PI, 2 * Math.PI);
  ctx.quadraticCurveTo(tw * 1.05, top + (py - top) * 0.55, cw / 2, top);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = RIM; ctx.lineWidth = hair; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(14,8,18,.22)"; ctx.lineWidth = Math.max(0.7, 0.7 * u);          // the grain, running up the cheek
  ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * cw * 0.17, top); ctx.lineTo(i * cw * 0.1, py - tw); } ctx.stroke();
  ctx.restore();
  for (const [f, hw] of [[0.28, cw * 0.4], [0.62, tw * 1.0]]) {                                // the straps, with a rivet at each end
    const y = top + (py - top) * f;
    ctx.fillStyle = across(ctx, MATS.iron, 0, y - Th * 0.07, 0, y + Th * 0.07, byg, lz, 1);
    ctx.fillRect(-hw, y - Th * 0.07, 2 * hw, Th * 0.14);
    ctx.fillStyle = tone(MATS.brass, 0.85, 1);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * (hw - Th * 0.1), y, Math.max(1, Th * 0.04), 0, 6.2832); ctx.fill(); }
  }
  ctx.restore();

  // the trunnion: a brass cap-square held on the carriage by a pin, over the barrel at the pivot
  ctx.save();
  ctx.translate(pxv, pyv);
  ball(ctx, 0, 0, Th * 0.4, MATS.brass, lxc, lyc, lz);
  ctx.strokeStyle = "rgba(14,10,22,.5)"; ctx.lineWidth = Math.max(0.8, 0.9 * u);
  ctx.beginPath(); ctx.arc(0, 0, Th * 0.25, 0, 6.2832); ctx.stroke();
  ctx.fillStyle = tone(MATS.iron, 0.55, 1); ctx.beginPath(); ctx.arc(0, 0, Th * 0.1, 0, 6.2832); ctx.fill();
  ctx.restore();
  const m = (MUZZLE * L - kick);
  return { x: pxv + cth * m, y: pyv - sth * m };
}

/** A sphere of material m at (x, y), radius r, lit from the Sun's (a, b) in the plane (a along x, b along y, canvas axes) and `lz` toward the viewer: the Earth's globe in small. */
function ball(ctx, x, y, r, m, a, b, lz) {
  const g = ctx.createRadialGradient(x + a * r * 0.4, y + b * r * 0.4, r * 0.04, x, y, r), N = 7;
  // from the lit point outward: the light at a point on the ball falls as the point turns from the Sun
  for (let i = 0; i <= N; i++) {
    const t = i / N, nz = Math.sqrt(Math.max(0, 1 - t * t)), I = lamb(nz * lz + (1 - nz) * Math.min(1, Math.hypot(a, b)) * (1 - t) * 0.9 - t * t * 0.4);
    g.addColorStop(t, tone(m, I, nz));
  }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = "rgba(8,10,22,.5)"; ctx.lineWidth = 0.8; ctx.stroke();
}
