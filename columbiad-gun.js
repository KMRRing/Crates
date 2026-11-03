// The Columbiad itself, drawn in canvas 2D from paths and gradients, in the Earth's own manner (columbiad-sphere.js): every surface
// is lit from the same Sun, by the same Lambert rule with the same soft terminator (a smoothstep, not a hard edge), its shadow side
// falls to the night's blue-black rather than to black, a cool bounce of the Earth's haze rims the side away from the Sun, and no part
// has a black outline: a shape ends where its shading ends, with at most a hairline between parts. The Sun is fixed on the screen,
// so as the barrel turns, its highlight slides along its girth instead of turning with it. Engraved, in the sense of the rest of the
// scene: a graticule on the Earth, fine hatching in the gun's shade. A bottle-shaped bronze gun with a swollen breech and a cascabel
// (the knob at its rear), iron reinforcing bands, a muzzle swell and a dark bore, brass trunnion caps, on a timber cheek, a brick
// pedestal and an earthwork mound, an elevating screw from the breech to the pedestal. It is much larger than a real gun would be on
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
  brass: [[0, 20, 17, 30], [0.4, 118, 76, 30], [0.78, 217, 164, 65], [1, 247, 218, 152]],
  iron: [[0, 12, 15, 28], [0.45, 62, 72, 92], [0.8, 140, 156, 180], [1, 205, 217, 234]],
  timber: [[0, 17, 13, 22], [0.45, 84, 58, 34], [0.8, 140, 102, 60], [1, 192, 150, 96]],
  brick: [[0, 24, 14, 24], [0.45, 112, 64, 46], [0.8, 168, 104, 72], [1, 214, 150, 110]],
  earth: [[0, 14, 17, 28], [0.45, 70, 64, 44], [0.8, 128, 108, 66], [1, 178, 150, 94]],      // the Earth's own olive and ochre
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
  const HAIR = "rgba(8,10,22,.5)";
  // ---- the ground frame: the mound, the pedestal, the cheek ----
  const cg = Math.cos(ground), sg = Math.sin(ground);
  const bxg = lxc * cg + lyc * sg, byg = -lxc * sg + lyc * cg;                       // the Sun along the ground frame's x (right) and y (down)
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(ground);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  // the earthwork: a long low mound, its crown toward the Sun, engraved in horizontal hatching
  const mw = Th * 3.9, mh = Th * 0.95;
  ctx.fillStyle = across(ctx, MATS.earth, 0, -mh, 0, Th * 0.2, byg, lz, 0.45);
  ctx.beginPath(); ctx.moveTo(-mw / 2 - Th * 0.7, Th * 0.25); ctx.quadraticCurveTo(-mw / 2, -mh * 0.2, -mw * 0.32, -mh); ctx.lineTo(mw * 0.32, -mh); ctx.quadraticCurveTo(mw / 2, -mh * 0.2, mw / 2 + Th * 0.7, Th * 0.25); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(9,12,22,.3)"; ctx.lineWidth = Math.max(0.8, 0.8 * u);
  ctx.beginPath(); for (let i = 1; i < 6; i++) { const y = -mh + i * mh / 5.5; ctx.moveTo(-mw, y); ctx.lineTo(mw, y + Th * 0.05); } ctx.stroke();
  ctx.restore();
  // the pedestal: brick, courses and joints, one face lit across its width
  const pw = Th * 2.1, ph = Th * 0.62, pt = -mh;
  ctx.fillStyle = across(ctx, MATS.brick, -pw / 2, 0, pw / 2, 0, bxg, lz, 0.45);
  ctx.fillRect(-pw / 2, pt - ph, pw, ph);
  ctx.save(); ctx.beginPath(); ctx.rect(-pw / 2, pt - ph, pw, ph); ctx.clip();
  ctx.strokeStyle = "rgba(20,10,20,.4)"; ctx.lineWidth = Math.max(0.7, 0.7 * u);
  ctx.beginPath();
  for (let r = 1; r < 3; r++) { const y = pt - ph + r * ph / 3; ctx.moveTo(-pw / 2, y); ctx.lineTo(pw / 2, y); }
  for (let r = 0; r < 3; r++) { const off = r % 2 ? 0 : Th * 0.26; for (let x = -pw / 2 + off; x < pw / 2; x += Th * 0.52) { ctx.moveTo(x, pt - ph + r * ph / 3); ctx.lineTo(x, pt - ph + (r + 1) * ph / 3); } }
  ctx.stroke();
  ctx.restore();
  // the stone coping, whose top faces the Sun when it is above
  ctx.fillStyle = across(ctx, MATS.brass, 0, pt - ph - Th * 0.1, 0, pt - ph + Th * 0.02, byg, lz, 0.7);
  ctx.fillRect(-pw / 2 - Th * 0.08, pt - ph - Th * 0.1, pw + Th * 0.16, Th * 0.12);
  // the cheek: a timber upright up to the trunnion, with iron straps
  const top = pt - ph - Th * 0.1, py = -PH, cw = Th * 1.15;
  ctx.fillStyle = across(ctx, MATS.timber, -cw / 2, 0, cw / 2, 0, bxg, lz, 0.5);
  ctx.beginPath(); ctx.moveTo(-cw / 2, top); ctx.lineTo(-cw * 0.3, py + Th * 0.1); ctx.quadraticCurveTo(0, py - Th * 0.5, cw * 0.3, py + Th * 0.1); ctx.lineTo(cw / 2, top); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = tone(MATS.iron, 0.25, 0.9); ctx.lineWidth = Math.max(1.4, 1.6 * u);
  ctx.beginPath(); ctx.moveTo(-cw * 0.46, top - Th * 0.16); ctx.lineTo(cw * 0.46, top - Th * 0.16); ctx.moveTo(-cw * 0.38, top - Th * 0.5); ctx.lineTo(cw * 0.38, top - Th * 0.5); ctx.stroke();
  ctx.restore();

  // the pivot in pixels (PH along the surface's normal), and the elevating screw: a brass rod from the pedestal's top to the breech's
  // underside, swinging as the barrel lifts
  const nx = Math.cos(site * DEG), ny = -Math.sin(site * DEG), pxv = bx + nx * PH, pyv = by + ny * PH;
  const cth = Math.cos(th), sth = Math.sin(th);
  const [sbx, sby] = [pxv + cth * (-0.17 * L - kick) + sth * Th * 0.52, pyv - sth * (-0.17 * L - kick) + cth * Th * 0.52];
  const fxg = -pw * 0.38, fyg = -mh - ph - Th * 0.1;
  const fx = bx + fxg * cg - fyg * sg, fy = by + fxg * sg + fyg * cg;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = tone(MATS.brass, 0.1, 0.5); ctx.lineWidth = Math.max(3, 3.4 * u); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sbx, sby); ctx.stroke();
  ctx.strokeStyle = tone(MATS.brass, 0.85, 1); ctx.lineWidth = Math.max(1.4, 1.5 * u); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sbx, sby); ctx.stroke();
  ctx.restore();

  // ---- the barrel's frame: x along the bore from the pivot, y toward the underside ----
  // the Sun in it: along the bore, across it (positive toward the underside)
  const bc = lxc * sth + lyc * cth, ba = lxc * cth - lyc * sth;
  ctx.save();
  ctx.translate(pxv, pyv);
  ctx.rotate(-th);
  ctx.translate(-kick, 0);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const x0 = -0.22 * L, xm = 0.86 * L;
  // half the barrel's height at x: swollen breech, a long taper (the chase), a swell at the muzzle
  const hb = x => {
    if (x < 0.55 * L) { const t = (x - x0) / (0.55 * L - x0); return Th * (0.78 - 0.26 * t * (2 - t)); }
    if (x < 0.76 * L) return Th * 0.52;
    const t = Math.min(1, (x - 0.76 * L) / (0.07 * L)); return Th * (0.52 + 0.08 * Math.sin(t * Math.PI * 0.5));
  };
  // the cascabel: a neck and a knob behind the breech, the knob a sphere lit like the Earth
  ctx.fillStyle = across(ctx, MATS.brass, 0, -Th * 0.2, 0, Th * 0.2, bc, lz, 1);
  ctx.fillRect(x0 - 0.06 * L, -Th * 0.2, 0.08 * L, Th * 0.4);
  ball(ctx, x0 - 0.1 * L, 0, Th * 0.3, MATS.brass, ba, bc, lz);
  // the body, a column at a time so that each is shaded across its own girth (a tapered cylinder: the same Sun on every ring)
  const N = 14;
  ctx.beginPath();
  ctx.moveTo(x0, -hb(x0));
  for (let i = 1; i <= N; i++) { const x = x0 + (xm - x0) * i / N; ctx.lineTo(x, -hb(x)); }
  for (let i = N; i >= 0; i--) { const x = x0 + (xm - x0) * i / N; ctx.lineTo(x, hb(x)); }
  ctx.closePath();
  ctx.save(); ctx.clip();
  const C = 28;
  for (let i = 0; i < C; i++) {
    const xa = x0 + (xm - x0) * i / C, xb = x0 + (xm - x0) * (i + 1) / C, h = hb((xa + xb) / 2);
    ctx.fillStyle = across(ctx, MATS.brass, 0, -h, 0, h, bc, lz, 1);
    ctx.fillRect(xa, -Th, xb - xa + 1, 2 * Th);
  }
  // the breech is darker, deeper in its own shade; the bore end brighter
  const ao = ctx.createLinearGradient(x0, 0, xm, 0);
  ao.addColorStop(0, "rgba(10,10,24,.34)"); ao.addColorStop(0.3, "rgba(10,10,24,0)");
  ctx.fillStyle = ao; ctx.fillRect(x0, -Th, xm - x0, 2 * Th);
  // engraver's hatching in the shade (on the side away from the Sun), a fine line along the barrel, and the Sun's streak on the other
  const away = bc > 0 ? -1 : 1;                                       // the side of the girth in shade
  ctx.strokeStyle = "rgba(10,8,24,.32)"; ctx.lineWidth = Math.max(0.7, 0.75 * u);
  ctx.beginPath();
  for (let x = x0 + 0.02 * L; x < xm; x += 0.028 * L) { const h = hb(x); ctx.moveTo(x, away * h * 0.95); ctx.lineTo(x + 0.025 * L, away * h * 0.42); }
  ctx.stroke();
  const hl = Math.sqrt(bc * bc + (lz + 1) * (lz + 1)), yh = (bc / hl) * 0.78;       // the highlight sits where the half-way vector between the Sun and the eye stands
  ctx.strokeStyle = "rgba(255,238,190,.62)"; ctx.lineWidth = Math.max(1.2, 1.6 * u);
  ctx.beginPath(); for (let i = 0; i <= N; i++) { const x = x0 + (xm - x0) * i / N, y = yh * hb(x); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
  ctx.restore();
  // iron reinforcing bands, cylinders in their own right, edged in brass
  const band = (x, w, extra) => {
    const h = hb(x + w / 2) + Th * extra;
    ctx.fillStyle = across(ctx, MATS.iron, 0, -h, 0, h, bc, lz, 1);
    ctx.fillRect(x, -h, w, 2 * h);
    ctx.strokeStyle = HAIR; ctx.lineWidth = hair;
    ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, h); ctx.moveTo(x + w, -h); ctx.lineTo(x + w, h); ctx.stroke();
    ctx.strokeStyle = tone(MATS.brass, 0.72, 1); ctx.lineWidth = Math.max(1, 1.1 * u);
    ctx.beginPath(); ctx.moveTo(x + w * 0.14, -h); ctx.lineTo(x + w * 0.14, h); ctx.moveTo(x + w * 0.86, -h); ctx.lineTo(x + w * 0.86, h); ctx.stroke();
  };
  band(-0.17 * L, 0.075 * L, 0.1);
  band(0.2 * L, 0.05 * L, 0.07);
  band(0.4 * L, 0.05 * L, 0.07);
  // the muzzle: a brass lip, and the bore as a dark oval with its own rim
  const zh = hb(xm);
  ctx.fillStyle = across(ctx, MATS.brass, 0, -zh, 0, zh, bc, lz, 1);
  ctx.fillRect(xm - 0.045 * L, -zh - Th * 0.07, 0.065 * L, 2 * zh + Th * 0.14);
  ctx.strokeStyle = HAIR; ctx.lineWidth = hair;
  ctx.strokeRect(xm - 0.045 * L, -zh - Th * 0.07, 0.065 * L, 2 * zh + Th * 0.14);
  const bw = Math.max(1.2, 0.05 * L * 0.55), bh = zh * 0.78, bg = ctx.createRadialGradient(xm + 0.02 * L - bw * 0.3, 0, 0, xm + 0.02 * L, 0, bh);
  bg.addColorStop(0, "#0a0c18"); bg.addColorStop(1, "#04060e");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(xm + 0.02 * L, 0, bw, bh, 0, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = tone(MATS.brass, 0.9, 1); ctx.lineWidth = Math.max(0.8, 0.9 * u); ctx.stroke();
  ctx.restore();

  // the trunnion cap, brass, on the cheek: over the barrel, at the pivot, a sphere lit from the Sun
  ctx.save();
  ctx.translate(pxv, pyv);
  ball(ctx, 0, 0, Th * 0.42, MATS.brass, lxc, lyc, lz, true);
  ctx.strokeStyle = "rgba(14,10,22,.55)"; ctx.lineWidth = Math.max(0.8, 0.9 * u);
  ctx.beginPath(); ctx.arc(0, 0, Th * 0.26, 0, 6.2832); ctx.stroke();
  ctx.fillStyle = "#14101c"; ctx.beginPath(); ctx.arc(0, 0, Th * 0.07, 0, 6.2832); ctx.fill();
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
