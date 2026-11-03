// The Columbiad itself, drawn in canvas 2D from paths and gradients: a bottle-shaped bronze gun with a swollen breech and a
// cascabel (the knob at its rear), iron reinforcing bands edged in brass, a muzzle swell and a dark bore, brass trunnion caps,
// on a timber cheek, a brick pedestal and an earthwork mound, an elevating screw from the breech to the pedestal. Engraved:
// a dark edge to every shape and fine hatching in the shade, with a warm highlight along the top so it reads against the night.
// It is much larger than a real gun would be on this scale (it is a character), at the same size as before. Nothing here is a
// rule: the shell starts where the engine says; the page draws a lead-in from the muzzle (columbiad-view.js).
const DEG = Math.PI / 180;

/** The gun's size in pixels for a camera scale k (pixels per Earth radius) and the page's rem over 16: L (barrel length), Th (its girth), PH (how high the pivot stands above the ground). */
export function gunSize(k, u) {
  const Th = Math.max(0.105 * k, 8 * u);
  return { L: Math.max(0.34 * k, 22 * u), Th, PH: Th * 1.55 };
}
/** How far along the barrel from the pivot the muzzle's centre is, in barrel lengths. */
export const MUZZLE = 0.9;

function metal(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [at, c] of stops) g.addColorStop(at, c);
  return g;
}

/**
 * Draws the gun standing at (bx, by), the surface point in pixels, on a surface whose outward direction is `site` degrees round from
 * the right (90: up), the barrel at `th` radians (screen y up), kicked back `kick` pixels along its axis.
 * Returns the muzzle's centre in pixels: { x, y }.
 */
export function drawGun(ctx, bx, by, k, u, site, th, kick) {
  const { L, Th, PH } = gunSize(k, u), lw = Math.max(1, 1.2 * u);
  const ground = -(site - 90) * DEG;
  // ---- the ground frame: the mound, the pedestal, the cheek ----
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(ground);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  // the earthwork: a long low mound, engraved in horizontal hatching, a lighter crown where the Sun strikes it
  const mw = Th * 3.9, mh = Th * 0.95;
  ctx.fillStyle = metal(ctx, -mh, Th * 0.2, [[0, "#6a5236"], [0.35, "#4a3822"], [1, "#241a10"]]);
  ctx.strokeStyle = "#120b05"; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(-mw / 2 - Th * 0.7, Th * 0.25); ctx.quadraticCurveTo(-mw / 2, -mh * 0.2, -mw * 0.32, -mh); ctx.lineTo(mw * 0.32, -mh); ctx.quadraticCurveTo(mw / 2, -mh * 0.2, mw / 2 + Th * 0.7, Th * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(15,9,4,.42)"; ctx.lineWidth = Math.max(0.8, 0.8 * u);
  ctx.beginPath(); for (let i = 1; i < 6; i++) { const y = -mh + i * mh / 5.5; ctx.moveTo(-mw, y); ctx.lineTo(mw, y + Th * 0.05); } ctx.stroke();
  ctx.strokeStyle = "rgba(225,190,120,.3)"; ctx.beginPath(); ctx.moveTo(-mw * 0.3, -mh + 1); ctx.lineTo(mw * 0.3, -mh + 1); ctx.stroke();
  ctx.restore();
  // the pedestal: brick, courses and joints
  const pw = Th * 2.1, ph = Th * 0.62, pt = -mh;
  ctx.fillStyle = metal(ctx, pt - ph, pt, [[0, "#9a6a4a"], [0.5, "#7a4e36"], [1, "#4a2c1e"]]);
  ctx.beginPath(); ctx.rect(-pw / 2, pt - ph, pw, ph); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(-pw / 2, pt - ph, pw, ph); ctx.clip();
  ctx.strokeStyle = "rgba(20,10,5,.5)"; ctx.lineWidth = Math.max(0.7, 0.7 * u);
  ctx.beginPath();
  for (let r = 1; r < 3; r++) { const y = pt - ph + r * ph / 3; ctx.moveTo(-pw / 2, y); ctx.lineTo(pw / 2, y); }
  for (let r = 0; r < 3; r++) { const off = r % 2 ? 0 : Th * 0.26; for (let x = -pw / 2 + off; x < pw / 2; x += Th * 0.52) { ctx.moveTo(x, pt - ph + r * ph / 3); ctx.lineTo(x, pt - ph + (r + 1) * ph / 3); } }
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#b08a52"; ctx.beginPath(); ctx.rect(-pw / 2 - Th * 0.08, pt - ph - Th * 0.1, pw + Th * 0.16, Th * 0.12); ctx.fill(); ctx.stroke();   // the stone coping
  // the cheek: a timber upright up to the trunnion, with iron straps
  const top = pt - ph - Th * 0.1, py = -PH, cw = Th * 1.15;
  ctx.fillStyle = metal(ctx, py, top, [[0, "#7b5a34"], [0.5, "#5c4026"], [1, "#35230f"]]);
  ctx.beginPath(); ctx.moveTo(-cw / 2, top); ctx.lineTo(-cw * 0.3, py + Th * 0.1); ctx.quadraticCurveTo(0, py - Th * 0.5, cw * 0.3, py + Th * 0.1); ctx.lineTo(cw / 2, top); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(14,10,8,.85)"; ctx.lineWidth = Math.max(1.4, 1.6 * u);
  ctx.beginPath(); ctx.moveTo(-cw * 0.46, top - Th * 0.16); ctx.lineTo(cw * 0.46, top - Th * 0.16); ctx.moveTo(-cw * 0.38, top - Th * 0.5); ctx.lineTo(cw * 0.38, top - Th * 0.5); ctx.stroke();
  ctx.restore();

  // the pivot in pixels (PH along the surface's normal), and the elevating screw: a brass rod from the pedestal's top to the breech's
  // underside, swinging as the barrel lifts
  const nx = Math.cos(site * DEG), ny = -Math.sin(site * DEG), pxv = bx + nx * PH, pyv = by + ny * PH;
  const cth = Math.cos(th), sth = Math.sin(th);
  const [sbx, sby] = [pxv + cth * (-0.17 * L - kick) + sth * Th * 0.52, pyv - sth * (-0.17 * L - kick) + cth * Th * 0.52];
  const cg = Math.cos(ground), sg = Math.sin(ground), fxg = -pw * 0.38, fyg = top;
  const fx = bx + fxg * cg - fyg * sg, fy = by + fxg * sg + fyg * cg;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#140c04"; ctx.lineWidth = Math.max(3, 3.4 * u); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sbx, sby); ctx.stroke();
  ctx.strokeStyle = "#d9a441"; ctx.lineWidth = Math.max(1.5, 1.7 * u); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(sbx, sby); ctx.stroke();
  ctx.restore();

  // ---- the barrel's frame: x along the bore from the pivot, y toward the underside ----
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
  // the cascabel: a neck and a knob behind the breech
  ctx.fillStyle = metal(ctx, -Th * 0.3, Th * 0.3, [[0, "#e6b866"], [0.5, "#a8742a"], [1, "#4a2c0e"]]);
  ctx.strokeStyle = "#140b03"; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.rect(x0 - 0.06 * L, -Th * 0.2, 0.08 * L, Th * 0.4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x0 - 0.1 * L, 0, Th * 0.3, 0, 6.2832); ctx.fill(); ctx.stroke();
  // the body
  const N = 14;
  ctx.beginPath();
  ctx.moveTo(x0, -hb(x0));
  for (let i = 1; i <= N; i++) { const x = x0 + (xm - x0) * i / N; ctx.lineTo(x, -hb(x)); }
  for (let i = N; i >= 0; i--) { const x = x0 + (xm - x0) * i / N; ctx.lineTo(x, hb(x)); }
  ctx.closePath();
  ctx.fillStyle = metal(ctx, -Th * 0.8, Th * 0.8, [[0, "#3a2410"], [0.1, "#8a5a22"], [0.3, "#f3cf86"], [0.46, "#cf9540"], [0.75, "#7a4c1a"], [1, "#24150a"]]);
  ctx.fill();
  ctx.strokeStyle = "#120a03"; ctx.lineWidth = Math.max(1.3, 1.5 * u); ctx.stroke();
  ctx.save(); ctx.clip();
  // engraver's shading in the shadow, a pair of long fine lines along the barrel, the warm rim on top
  ctx.strokeStyle = "rgba(20,10,3,.38)"; ctx.lineWidth = Math.max(0.7, 0.75 * u);
  ctx.beginPath();
  for (let x = x0 + 0.02 * L; x < xm; x += 0.028 * L) { ctx.moveTo(x, Th * 0.78); ctx.lineTo(x + 0.025 * L, Th * 0.3); }
  ctx.moveTo(x0, Th * 0.12); ctx.lineTo(xm, Th * 0.12); ctx.moveTo(x0, -Th * 0.2); ctx.lineTo(xm, -Th * 0.2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,236,178,.75)"; ctx.lineWidth = Math.max(1, 1.1 * u);
  ctx.beginPath(); for (let i = 0; i <= N; i++) { const x = x0 + (xm - x0) * i / N, y = -hb(x) + Th * 0.07; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
  ctx.restore();
  // iron reinforcing bands edged in brass: the breech ring, and two on the chase
  const band = (x, w, extra) => {
    const h = hb(x + w / 2) + Th * extra;
    ctx.fillStyle = metal(ctx, -h, h, [[0, "#1c1f26"], [0.2, "#5a6270"], [0.34, "#aeb8c6"], [0.55, "#5b6371"], [1, "#16181d"]]);
    ctx.strokeStyle = "#0a0b0e"; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.rect(x, -h, w, 2 * h); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#d9a441"; ctx.lineWidth = Math.max(1, 1.1 * u);
    ctx.beginPath(); ctx.moveTo(x + w * 0.1, -h); ctx.lineTo(x + w * 0.1, h); ctx.moveTo(x + w * 0.9, -h); ctx.lineTo(x + w * 0.9, h); ctx.stroke();
  };
  band(-0.17 * L, 0.075 * L, 0.1);
  band(0.2 * L, 0.05 * L, 0.07);
  band(0.4 * L, 0.05 * L, 0.07);
  // the muzzle: a brass lip, and the bore as a dark oval
  const zh = hb(xm);
  ctx.fillStyle = metal(ctx, -zh, zh, [[0, "#b58a3a"], [0.3, "#f6dc98"], [0.6, "#c99a45"], [1, "#5a3a12"]]);
  ctx.strokeStyle = "#140b03"; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.rect(xm - 0.045 * L, -zh - Th * 0.07, 0.065 * L, 2 * zh + Th * 0.14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#070402";
  ctx.beginPath(); ctx.ellipse(xm + 0.02 * L, 0, Math.max(1.2, 0.05 * L * 0.55), zh * 0.78, 0, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = "#e9c777"; ctx.lineWidth = Math.max(0.8, 0.9 * u); ctx.stroke();
  ctx.restore();

  // the trunnion cap, brass, on the cheek: over the barrel, at the pivot
  ctx.save();
  ctx.translate(pxv, pyv);
  const g = ctx.createRadialGradient(-Th * 0.1, -Th * 0.12, Th * 0.04, 0, 0, Th * 0.42);
  g.addColorStop(0, "#fff0bd"); g.addColorStop(0.45, "#d9a441"); g.addColorStop(1, "#6b4510");
  ctx.fillStyle = g; ctx.strokeStyle = "#140b03"; ctx.lineWidth = Math.max(1.2, 1.4 * u);
  ctx.beginPath(); ctx.arc(0, 0, Th * 0.42, 0, 6.2832); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(20,10,3,.7)"; ctx.lineWidth = Math.max(0.8, 0.9 * u);
  ctx.beginPath(); ctx.arc(0, 0, Th * 0.26, 0, 6.2832); ctx.stroke();
  ctx.fillStyle = "#2a1a08"; ctx.beginPath(); ctx.arc(0, 0, Th * 0.07, 0, 6.2832); ctx.fill();
  ctx.restore();
  const m = (MUZZLE * L - kick);
  return { x: pxv + cth * m, y: pyv - sth * m };
}
