// The window onto the sky: a stereographic projection about a view direction (it keeps circles round, and bends the horizon into
// the arc it is from a deck) and the drawing of the sky on a canvas 2D. The projection is pure and tested in Node
// (tests/landfall-skyview.mjs); the drawing is the page's. Nothing here fetches or uses a filter: a star is a disc and a glow.
export const D2R = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;

/** A view looking toward (az, alt) degrees, `fov` degrees from top to bottom of a canvas w by h pixels. */
export function makeView(az, alt, fov, w, h) {
  const a = az * D2R, e = alt * D2R;
  const f = [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)];
  const right = [Math.cos(a), -Math.sin(a), 0];
  const up = [-Math.sin(e) * Math.sin(a), -Math.sin(e) * Math.cos(a), Math.cos(e)];
  return { az, alt, fov, w, h, f, right, up, R: (h / 2) / (2 * Math.tan(fov * D2R / 4)) };   // r = 2 R tan(c / 2): fov / 2 maps to h / 2
}
/** Where a place on the sky (az from north through east, alt) falls on the canvas, or null when it is behind the viewer. */
export function project(v, az, alt) {
  const a = az * D2R, e = alt * D2R, p = [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)];
  const z = dot(p, v.f);
  if (z < -0.9) return null;
  const k = 2 * v.R / (1 + z);
  return { x: v.w / 2 + k * dot(p, v.right), y: v.h / 2 - k * dot(p, v.up), z };
}
/** The sky under a canvas point: { az, alt }. */
export function unproject(v, px, py) {
  const x = px - v.w / 2, y = v.h / 2 - py, r = Math.hypot(x, y);
  if (r < 1e-9) return { az: v.az, alt: v.alt };
  const c = 2 * Math.atan(r / (2 * v.R)), s = Math.sin(c), co = Math.cos(c);
  const d = [0, 1, 2].map(i => v.f[i] * co + (v.right[i] * x / r + v.up[i] * y / r) * s);
  return { az: (Math.atan2(d[0], d[1]) / D2R + 360) % 360, alt: Math.asin(clamp(d[2], -1, 1)) / D2R };
}
/** The pixel size of one degree at a canvas point (for sizing a cloud or a ring in degrees). */
export function degPx(v, px, py) {
  const a = unproject(v, px, py), b = project(v, a.az, Math.min(89.9, a.alt + 1)) || { x: px, y: py - 1 };
  return Math.hypot(b.x - px, b.y - py);
}

/** The star nearest a tap within `radius` px, brighter ones first among near ties; null if none. `stars`: [{ az, alt, mag, hr }] now visible. */
export function pick(v, stars, x, y, radius) {
  let best = null, bs = Infinity;
  for (const s of stars) {
    const p = project(v, s.az, s.alt);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > radius) continue;
    const score = d + 3 * s.mag;
    if (score < bs) { bs = score; best = s; }
  }
  return best;
}

// ---------- colour ----------

const KEYS = [   // [sun altitude, zenith, horizon] in rgb: dusk and dawn alike
  [4, [92, 128, 178], [236, 178, 120]], [0, [70, 104, 156], [232, 150, 98]], [-3, [40, 64, 108], [206, 124, 90]], [-6, [24, 40, 76], [128, 86, 104]],
  [-9, [14, 26, 54], [64, 58, 86]], [-12, [8, 17, 32], [30, 38, 58]], [-16, [5, 9, 15], [14, 20, 30]], [-22, [3, 6, 10], [8, 13, 20]],
];
/** The colours of the sky's zenith and horizon for the sun's altitude, as [r, g, b] each. */
export function skyColours(sunAlt) {
  if (sunAlt >= KEYS[0][0]) return { top: KEYS[0][1], hor: KEYS[0][2] };
  for (let i = 1; i < KEYS.length; i++) {
    if (sunAlt >= KEYS[i][0]) {
      const [a0, t0, h0] = KEYS[i - 1], [a1, t1, h1] = KEYS[i], k = (sunAlt - a1) / (a0 - a1);
      return { top: t1.map((x, j) => mix(x, t0[j], k)), hor: h1.map((x, j) => mix(x, h0[j], k)) };
    }
  }
  return { top: KEYS.at(-1)[1], hor: KEYS.at(-1)[2] };
}
const rgb = (c, a = 1) => `rgba(${c.map(Math.round).join(",")},${a})`;
const STAR_COLOUR = { 2061: "#ffb98a", 6134: "#ffa97c", 1457: "#ffc69a", 5340: "#ffd0a4", 1713: "#cfe0ff", 7001: "#d6e4ff", 2491: "#d8e6ff", 5056: "#cfe0ff", 424: "#fff2d6" };

/** Radius in px for a magnitude. */
export const starRadius = (mag, k = 1) => clamp(2.7 - 0.55 * mag, 0.7, 3.4) * k;

/**
 * Draws the sky. `sc`: { sunAlt, sunAz, stars: [{ hr, az, alt, mag }] (all above the horizon), limMag, lamp, clouds: [{ az, alt, r }],
 * figure: [[designation lines as star-lists of hr]] | null, label, ring: hr | null, picked: hr | null, t: seconds, dpr }.
 */
export function drawSky(ctx, v, sc) {
  const { w, h } = v, k = sc.k || 1, col = skyColours(sc.sunAlt);
  // the sky: a gradient from the zenith's colour to the horizon's, down to where the horizon falls on this canvas
  const hp = project(v, v.az, 0), hy = hp ? clamp(hp.y, h * 0.35, h * 1.4) : h * 1.4;
  const g = ctx.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, rgb(col.top)); g.addColorStop(1, rgb(col.hor));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // the twilight glow in the quarter the sun is below
  const sp = project(v, sc.sunAz, Math.max(-8, sc.sunAlt));
  if (sp && sc.sunAlt > -16) {
    const r = Math.max(w, h) * 0.9, a = clamp((sc.sunAlt + 16) / 14, 0, 1) * 0.55, rg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r);
    rg.addColorStop(0, rgb(col.hor.map(x => Math.min(255, x * 1.15)), a)); rg.addColorStop(1, rgb(col.hor, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  }
  // the stars
  const lim = sc.limMag - (sc.lamp ? 1.3 : 0);
  const byHr = new Map();
  ctx.save();
  for (const s of sc.stars) {
    const p = project(v, s.az, s.alt);
    if (!p) continue;
    byHr.set(s.hr, p);
    if (p.x < -8 || p.x > w + 8 || p.y < -8 || p.y > h + 8) continue;
    const ext = 0.3 / Math.max(0.12, Math.sin(Math.max(0.5, s.alt) * D2R)) - 0.3, m = s.mag + ext;
    let a = clamp((lim - m) / 1.1 + 0.1, 0, 1);
    if (a <= 0.01) continue;
    const tw = 1 + (0.1 + (s.alt < 25 ? 0.2 : 0)) * Math.sin(sc.t * (2.1 + (s.hr % 7) * 0.37) + s.hr);
    a = clamp(a * tw, 0, 1);
    const r = starRadius(m, k);
    ctx.globalAlpha = a;
    ctx.fillStyle = STAR_COLOUR[s.hr] || "#fff4dc";
    if (r > 1.6) { ctx.globalAlpha = a * 0.22; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, 6.283); ctx.fill(); ctx.globalAlpha = a; }
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
  }
  ctx.restore();
  // a constellation's line figure, when a hint draws it
  if (sc.figure) {
    ctx.save();
    ctx.strokeStyle = "rgba(226,190,120,.55)"; ctx.lineWidth = 1.2 * k; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const line of sc.figure.lines) {
      ctx.beginPath();
      let pen = false;
      for (const hr of line) { const p = byHr.get(hr); if (!p) { pen = false; continue; } pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; }
      ctx.stroke();
    }
    if (sc.figure.label) {
      const pts = sc.figure.keys.map(hr => byHr.get(hr)).filter(Boolean);
      if (pts.length) {
        const cx = pts.reduce((t, p) => t + p.x, 0) / pts.length, cy = Math.max(...pts.map(p => p.y)) + 16 * k;
        ctx.font = `italic ${12 * k}px Georgia, "Times New Roman", serif`; ctx.fillStyle = "rgba(236,208,150,.85)"; ctx.textAlign = "center";
        ctx.fillText(sc.figure.label, clamp(cx, 40, w - 40), clamp(cy, 14, h - 6));
      }
    }
    ctx.restore();
  }
  // the horizon and the sea: the horizon is a circle on this projection; the sea fills below it
  const sea = [];
  for (let d = -100; d <= 100; d += 2) { const p = project(v, v.az + d, 0); if (p) sea.push(p); }
  if (sea.length > 3 && sea.some(p => p.y < h + 40)) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-w, h * 3); sea.forEach((p, i) => ctx.lineTo(p.x, p.y)); ctx.lineTo(w * 2, h * 3); ctx.closePath();
    const hs = clamp(Math.min(...sea.map(p => p.y)), 0, h), sg = ctx.createLinearGradient(0, hs, 0, hs + h * 0.5);
    const dark = col.hor.map(x => x * 0.22 + 4);
    sg.addColorStop(0, rgb(col.hor.map((x, i) => mix(x, dark[i], 0.55)))); sg.addColorStop(0.18, rgb(dark)); sg.addColorStop(1, rgb(dark.map(x => x * 0.55)));
    ctx.fillStyle = sg; ctx.fill();
    ctx.lineWidth = 1 * k; ctx.strokeStyle = rgb(col.hor.map(x => Math.min(255, x * 1.3)), 0.5);
    ctx.beginPath(); sea.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.restore();
  }
  // cloud: soft dark discs
  for (const c of sc.clouds || []) {
    const p = project(v, c.az, c.alt);
    if (!p) continue;
    const r = c.r * degPx(v, p.x, p.y);
    const cg = ctx.createRadialGradient(p.x, p.y, r * 0.15, p.x, p.y, r);
    cg.addColorStop(0, rgb(col.top.map(x => x * 0.55 + 14), 0.97)); cg.addColorStop(0.7, rgb(col.top.map(x => x * 0.55 + 14), 0.85)); cg.addColorStop(1, rgb(col.top, 0));
    ctx.fillStyle = cg; ctx.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
  }
  // the ring a hint puts round a star, and the one the navigator has chosen
  const ring = (hr, style, r, dash) => {
    const p = byHr.get(hr);
    if (!p || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return;
    ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = 1.5 * k; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.arc(p.x, p.y, r * k, 0, 6.283); ctx.stroke(); ctx.restore();
  };
  if (sc.ring) ring(sc.ring, "rgba(236,208,150,.9)", 15, [3, 4]);
  if (sc.picked) ring(sc.picked, "rgba(255,255,255,.95)", 11);
  // the lamp: a warm veil over everything while it burns
  if (sc.lamp) { ctx.fillStyle = "rgba(255,170,90,.11)"; ctx.fillRect(0, 0, w, h); }
}
