// Columbiad's scene, on a canvas that fills the whole screen: a night sky, the Earth and the moons as lit globes
// (columbiad-globe.js), the cannon (columbiad-gun.js), the preview cone, the ghosts of earlier shots, the ring, and a flight
// that the camera follows with a glowing trail and slows for the last stretch. The page's controls are drawn over the picture,
// not beside it, so the camera fits the world into what they leave free (`setInsets`) while the sky and the Earth run edge
// to edge. The page draws only while something moves (a drag, a flight, smoke hanging, the camera easing, a moon on its rail,
// and the Earth's slow turn, a few times a second); it stops when the menu is open or the page is away. Nothing here changes a
// rule: the rules are columbiad-engine.js's, and this plays a finished flight back. The colours are the picture's own, the
// same in every theme; the chrome over it is the page's.
import { direction, targetAt, bodyAt, worldOf, T_MOON } from "./columbiad-engine.js";
import { createGlobe, loadEarth, warm, sunOf } from "./columbiad-globe.js";
import { drawGun, gunSize, MUZZLE } from "./columbiad-gun.js";

const INK = "233,223,198", BRASS = "217,164,65", BRASS_HI = "240,213,138", GOOD = "127,194,168", BAD = "232,128,111";
const SKY_TOP = "#080d19", SKY_BOT = "#16213a";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** The world box a level's aim view shows: the sky above the cannon, a little of the ground under it, and the ring; the Earth is as much of it as that holds. { x0, y0, x1, y1 }. */
export function frameOf(lvl) {
  if (lvl.frame) return { x0: lvl.frame[0], y0: lvl.frame[1], x1: lvl.frame[2], y1: lvl.frame[3] };
  const site = lvl.site ?? 90, [ox, oy] = direction(site), tx = -oy, ty = ox;
  const pts = [];
  for (const a of [-1, 1]) for (const o of [-0.5, 1.25]) pts.push([ox + tx * a + ox * o, oy + ty * a + oy * o]);
  const T = lvl.target;
  if (T && T.at) pts.push([T.at[0] - T.r - 0.3, T.at[1] - T.r - 0.3], [T.at[0] + T.r + 0.3, T.at[1] + T.r + 0.3]);
  return {
    x0: Math.min(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])),
    x1: Math.max(...pts.map(p => p[0])), y1: Math.max(...pts.map(p => p[1])),
  };
}

export function createView(canvas, hooks = {}) {
  const ctx = canvas.getContext("2d");
  let W = 1, H = 1, dpr = 1, u = 1;                                   // css pixels, device ratio, the page's rem over 16
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cam = { x: 0, y: 0, k: 100 }, goal = { x: 0, y: 0, k: 100 };
  let lvl = null, aim = { angle: 90, charge: 0 }, cone = null, coneAlpha = 1, ghosts = [], rope = null, won = false, hitAt = null, flare = 0;
  let frame = null, coneBox = null, fresh = false;
  const ins = { t: 0, r: 0, b: 0, l: 0 };                             // what the page's controls cover, in css pixels: the world is fitted into the rest
  let clock = 0, bodies = [], sun = sunOf(135, 0.5), spin = 0;        // the game's time now; the bodies to draw; the Earth's turn (turns)
  let earthG = null, spinTimer = 0;
  // the aim view: the level's own frame, grown to hold the whole cone, so the preview is never out of sight
  const base = () => (coneBox ? { x0: Math.min(frame.x0, coneBox.x0), y0: Math.min(frame.y0, coneBox.y0), x1: Math.max(frame.x1, coneBox.x1), y1: Math.max(frame.y1, coneBox.y1) } : frame);
  let flight = null, live = null;                                     // the flight playing; the trail it leaves until the next shot
  let recoil = 0, flash = 0, shake = 0, since = 0;                    // seconds since the shot, for the cannon's kick
  const smoke = [], sparks = [];
  let raf = 0, last = 0, held = false, ff = false, settleAt = 0;
  // the stars: a fixed scatter, nudged a little as the camera moves
  const stars = [];
  { let a = 20261103; for (let i = 0; i < 80; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; const x = a / 4294967296; a = (Math.imul(a, 1664525) + 1013904223) >>> 0; const y = a / 4294967296; a = (Math.imul(a, 1664525) + 1013904223) >>> 0; stars.push([x, y, 0.25 + 0.55 * (a / 4294967296), a % 9 === 0 ? 2 : 1]); } }

  const sx = x => W / 2 + (x - cam.x) * cam.k, sy = y => H / 2 - (y - cam.y) * cam.k;

  function fitTo(box, into) {
    const bw = (box.x1 - box.x0) * 1.04, bh = (box.y1 - box.y0) * 1.04, aw = Math.max(40, W - ins.l - ins.r), ah = Math.max(40, H - ins.t - ins.b);
    into.k = Math.min(aw / bw, ah / bh);
    // the box's middle lands in the middle of what the controls leave free
    into.x = (box.x0 + box.x1) / 2 - (ins.l - ins.r) / 2 / into.k;
    into.y = (box.y0 + box.y1) / 2 + (ins.t - ins.b) / 2 / into.k;
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    u = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (frame) { fitTo(base(), goal); if (!flight) Object.assign(cam, goal); }
    draw();
  }

  // ---------- the world ----------
  /** A globe's picture at a display size: three sizes of the same render, so a camera zoom never makes a new one. */
  function globeAt(g, R, pad, sizes) {
    const want = 2 * R * pad * dpr;
    let S = sizes[sizes.length - 1];
    for (const z of sizes) if (want <= z * 1.15) { S = z; break; }
    return g.picture(g.spin ?? spin, sun, S);
  }
  function planet(g, x, y, R, spinTurns, sizes, q) {
    if (R < 0.6 || x + R * 1.2 < 0 || x - R * 1.2 > W || y + R * 1.2 < 0 || y - R * 1.2 > H) return;
    g.spin = Math.round(spinTurns * q) / q;          // a new render for each step of the turn (0.4 degree for the Earth, 1 for a moon), not for each frame
    const pic = globeAt(g, R, g.pad, sizes), d = 2 * R * g.pad;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(pic, x - d / 2, y - d / 2, d, d);
  }
  function earth(ex, ey, R) {
    if (!earthG) { earthG = createGlobe("earth", { tilt: 24, roll: -12 }); loadEarth(() => { draw(); wake(); }); warm(() => { draw(); wake(); }); }
    planet(earthG, ex, ey, R, spin, [96, 192, 320, 448], 900);
    // a fine brass edge, as an engraver closes a plate's circle
    if (R > 14 * u) { ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${INK},.16)`; ctx.beginPath(); ctx.arc(ex, ey, R + 0.5, 0, 6.2832); ctx.stroke(); }
  }
  /** The bodies other than the Earth, each a lit sphere at its place at game time t (drawn no smaller than a few pixels, so the far Moon is seen). */
  function moons(t) {
    for (const b of bodies) {
      const p = bodyAt(lvl, b.i, t), x = sx(p[0]), y = sy(p[1]), R = Math.max(b.r * cam.k, b.min * u);
      if (b.rail) {                                                    // its rail, a dotted circle, so the sweep of it can be read
        ctx.save(); ctx.setLineDash([1, 7 * u]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${INK},.2)`;
        ctx.beginPath(); ctx.arc(sx(b.cx), sy(b.cy), b.a * cam.k, 0, 6.2832); ctx.stroke(); ctx.restore();
      }
      // a moon keeps one face to what it circles: its turn is its way round
      const turn = b.rail ? Math.atan2(p[1] - b.cy, p[0] - b.cx) / 6.2832 * (b.retro ? -1 : 1) : b.spin;
      planet(b.globe, x, y, R, turn + b.offset, [64, 128, 256], 360);
    }
  }
  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, SKY_TOP); g.addColorStop(1, SKY_BOT);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const px = -cam.x * cam.k * 0.06, py = cam.y * cam.k * 0.06;
    for (const [x, y, a, s] of stars) {
      ctx.fillStyle = `rgba(${INK},${a})`;
      const X = ((x * W + px) % W + W) % W, Y = ((y * H + py) % H + H) % H;
      ctx.fillRect(X, Y, s * u, s * u);
    }
    // altitude circles, dotted, as on a gunnery chart
    ctx.save();
    ctx.setLineDash([1, 6 * u]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${INK},.14)`;
    if (cam.k > 40) for (const r of [1.5, 2, 3, 4, 6, 8]) { ctx.beginPath(); ctx.arc(sx(0), sy(0), r * cam.k, 0, 6.2832); ctx.stroke(); }
    ctx.restore();
  }
  function ring() {
    const T = lvl.target, p = targetAt(lvl, now()), R = Math.max(T.r * cam.k, 7 * u), x = sx(p[0]), y = sy(p[1]);
    const col = won ? GOOD : BRASS;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${col},${won ? 0.4 : 0.1})`); g.addColorStop(1, `rgba(${col},${won ? 0.22 : 0.05})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = `rgba(${col},.95)`; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.2832); ctx.stroke();
    ctx.save();
    ctx.lineWidth = 1; ctx.setLineDash([3 * u, 3 * u]); ctx.strokeStyle = `rgba(${col},.7)`;                  // the inner third, where a shot is worth a bonus mark
    ctx.beginPath(); ctx.arc(x, y, R / 3, 0, 6.2832); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${col},.8)`; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i * 0.5236, c = Math.cos(a), s = Math.sin(a), r0 = R + 2 * u, r1 = R + (i % 3 === 0 ? 7 : 4) * u; ctx.moveTo(x + c * r0, y + s * r0); ctx.lineTo(x + c * r1, y + s * r1); }
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3 * u, y); ctx.lineTo(x + 3 * u, y); ctx.moveTo(x, y - 3 * u); ctx.lineTo(x, y + 3 * u); ctx.stroke();
    if (flare > 0) {
      ctx.lineWidth = 3 * u; ctx.strokeStyle = `rgba(${GOOD},${flare * 0.9})`;
      ctx.beginPath(); ctx.arc(x, y, R * (1 + (1 - flare) * 1.6), 0, 6.2832); ctx.stroke();
    }
  }
  function polyline(pts, from = 0, to = pts.length / 2) {
    ctx.beginPath();
    for (let i = from; i < to; i++) { const X = sx(pts[2 * i]), Y = sy(pts[2 * i + 1]); if (i === from) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
  }
  function ghostLines() {
    ghosts.forEach((g, i) => {
      const age = ghosts.length - 1 - i, a = 0.5 * Math.pow(0.55, age);
      if (!g.pts || g.pts.length < 4) return;
      ctx.lineWidth = 1.6 * u; ctx.strokeStyle = `rgba(${INK},${a})`; ctx.lineJoin = "round";
      polyline(g.pts); ctx.stroke();
      const n = g.pts.length / 2 - 1, X = sx(g.pts[2 * n]), Y = sy(g.pts[2 * n + 1]), s = 3.5 * u;
      ctx.strokeStyle = `rgba(${g.hit ? GOOD : BRASS},${Math.min(1, a * 1.7)})`; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.moveTo(X - s, Y - s); ctx.lineTo(X + s, Y + s); ctx.moveTo(X + s, Y - s); ctx.lineTo(X - s, Y + s); ctx.stroke();
    });
  }
  function coneBand() {
    if (!cone || coneAlpha <= 0.01) return;
    const c = leadCone(cone), n = c.centre.length / 2, a = coneAlpha;
    ctx.beginPath();
    for (let k = 0; k < n; k++) { const X = sx(c.left[2 * k]), Y = sy(c.left[2 * k + 1]); if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    for (let k = n - 1; k >= 0; k--) ctx.lineTo(sx(c.right[2 * k]), sy(c.right[2 * k + 1]));
    ctx.closePath();
    ctx.fillStyle = `rgba(${BRASS},${0.2 * a})`; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${BRASS},${0.6 * a})`; ctx.stroke();
    ctx.save();
    ctx.setLineDash([4 * u, 4 * u]); ctx.lineWidth = 1.4 * u; ctx.strokeStyle = `rgba(${BRASS_HI},${0.9 * a})`;
    polyline(c.centre); ctx.stroke();
    ctx.restore();
    // the far end is closed with a rule, so it is seen where the preview stops and the maths takes over
    const e = n - 1, lx = sx(c.left[2 * e]), ly = sy(c.left[2 * e + 1]), rx = sx(c.right[2 * e]), ry = sy(c.right[2 * e + 1]);
    const cx = sx(c.centre[2 * e]), cy = sy(c.centre[2 * e + 1]), mx = (lx - rx) / 2, my = (ly - ry) / 2, m = Math.max(1, Math.hypot(mx, my)), pad = Math.max(0, 5 * u - m) / m;
    ctx.lineWidth = 2 * u; ctx.strokeStyle = `rgba(${BRASS_HI},${0.9 * a})`;
    ctx.beginPath(); ctx.moveTo(cx - mx * (1 + pad), cy - my * (1 + pad)); ctx.lineTo(cx + mx * (1 + pad), cy + my * (1 + pad)); ctx.stroke();
  }
  /** Where the muzzle is in the world: the pivot (the gun's height above the ground along the surface's normal) and the barrel's reach along the aim. */
  function muzzleWorld(kick = 0) {
    const site = lvl.site ?? 90, [ox, oy] = direction(site), [dx, dy] = direction(aim.angle), g = gunSize(cam.k, u), px = ox + ox * g.PH / cam.k, py = oy + oy * g.PH / cam.k, m = (MUZZLE * g.L - kick) / cam.k;
    return [px + dx * m, py + dy * m];
  }
  function cannon() {
    const site = lvl.site ?? 90, [ox, oy] = direction(site), g = gunSize(cam.k, u);
    const kick = reduced() ? 0 : recoil * 0.1 * cam.k * (g.L / Math.max(0.34 * cam.k, 22 * u));
    drawGun(ctx, sx(ox), sy(oy), cam.k, u, site, aim.angle * Math.PI / 180, kick);
  }
  function trail() {
    if (!live) return;
    const p = live.pts, n = live.upto;
    if (n < 2) return;
    const groups = 14, per = Math.max(1, Math.ceil(n / groups));
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let g = 0, i = 0; i < n - 1; g++, i += per) {
      const j = Math.min(n, i + per + 1), f = (g + 1) / Math.ceil((n - 1) / per);
      ctx.lineWidth = (1.2 + 3.2 * f) * u; ctx.strokeStyle = `rgba(${f > 0.8 ? BRASS_HI : BRASS},${0.12 + 0.82 * f * f})`;
      polyline(p, i, j); ctx.stroke();
    }
    ctx.lineWidth = 1.2 * u; ctx.strokeStyle = `rgba(255,248,225,${0.75})`;
    polyline(p, Math.max(0, n - 12), n); ctx.stroke();
    if (live.head) {
      const X = sx(live.head[0]), Y = sy(live.head[1]), r = 11 * u;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, "rgba(255,250,230,1)"); g.addColorStop(0.3, `rgba(${BRASS_HI},.85)`); g.addColorStop(1, `rgba(${BRASS},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "#fffdf4"; ctx.beginPath(); ctx.arc(X, Y, 2.3 * u, 0, 6.2832); ctx.fill();
    }
  }
  function puffs() {
    for (const p of smoke) {
      const a = Math.max(0, 1 - p.age / p.life), r = Math.max(3 * u, (p.r0 + (p.r1 - p.r0) * Math.min(1, p.age / 1.2)) * cam.k), x = sx(p.x), y = sy(p.y);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r), c = p.dust ? "150,120,86" : "196,202,214", s = 0.22 * a * a + 0.01;
      g.addColorStop(0, `rgba(${c},${s})`); g.addColorStop(0.6, `rgba(${c},${s * 0.7})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of sparks) {
      const a = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = `rgba(${p.good ? GOOD : BRASS_HI},${a})`;
      const s = (1.5 + 2 * a) * u;
      ctx.fillRect(sx(p.x) - s / 2, sy(p.y) - s / 2, s, s);
    }
    if (flash > 0) {
      const [mx, my] = muzzleWorld(), X = sx(mx), Y = sy(my), r = (0.42 * cam.k + 18 * u) * flash;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, `rgba(255,250,225,${flash})`); g.addColorStop(0.25, `rgba(${BRASS_HI},${0.8 * flash})`); g.addColorStop(1, `rgba(${BRASS},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  function ropeWidget() {
    if (!rope) return;
    const { cx, cy, fx, fy, len, full, cap, charge } = rope;
    if (len < 2) return;
    const ux = (fx - cx) / len, uy = (fy - cy) / len, step = full / cap, nx = -uy, ny = ux;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(${INK},.28)`; ctx.lineWidth = 1.5 * u; ctx.setLineDash([2 * u, 4 * u]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + ux * full, cy + uy * full); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(${BRASS_HI},.95)`; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(fx, fy); ctx.stroke();
    for (let i = 1; i <= Math.floor(cap + 1e-9); i++) {
      const d = i * step, on = i <= Math.floor(charge + 1e-9), s = (on ? 6 : 4) * u;
      ctx.strokeStyle = on ? `rgba(${BRASS_HI},1)` : `rgba(${INK},.4)`; ctx.lineWidth = (on ? 2 : 1.2) * u;
      ctx.beginPath(); ctx.moveTo(cx + ux * d + nx * s, cy + uy * d + ny * s); ctx.lineTo(cx + ux * d - nx * s, cy + uy * d - ny * s); ctx.stroke();
    }
    ctx.fillStyle = `rgba(${BRASS},.9)`; ctx.beginPath(); ctx.arc(cx, cy, 3.5 * u, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = `rgba(${BRASS_HI},.9)`; ctx.lineWidth = 2 * u; ctx.fillStyle = "rgba(10,14,24,.5)";
    ctx.beginPath(); ctx.arc(fx, fy, 13 * u, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function vignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, "rgba(3,6,12,0)"); g.addColorStop(1, "rgba(3,6,12,.5)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!lvl) { ctx.fillStyle = SKY_TOP; ctx.fillRect(0, 0, W, H); return; }
    ctx.save();
    if (shake > 0.2) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    sky();
    const t = now();
    earth(sx(0), sy(0), cam.k);
    moons(t);
    ghostLines();
    ring();
    coneBand();
    trail();
    cannon();
    puffs();
    ctx.restore();
    vignette();
    ropeWidget();
  }

  // ---------- time ----------
  /** The world's time as the picture shows it: the flight's own while a shell is out, else the clock. */
  function now() { return flight ? flight.t0 + flight.gt : clock; }
  const rails = () => !!lvl && worldOf(lvl).moving;
  /**
   * The first stretch of a path, drawn from the muzzle: the shell's true path starts at the ground under the gun, and the gun
   * is a character much larger than that, so a display copy is led out of the muzzle and joins the true path within `fade`
   * Earth radii of travel (a picture only: the rules never see it).
   */
  function lead(pts, mx, my, fade = 1.1) {
    const n = pts.length / 2, out = Float64Array.from(pts), ox = mx - pts[0], oy = my - pts[1];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i) acc += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
      const f = acc >= fade ? 0 : (1 - acc / fade) * (1 - acc / fade);
      if (f <= 0) break;
      out[2 * i] += ox * f; out[2 * i + 1] += oy * f;
    }
    return out;
  }

  /** A cone led out of the muzzle the way a flight is (the same shift on the central path and on both edges). */
  function leadCone(c) {
    const [mx, my] = muzzleWorld(), n = c.centre.length / 2, ox = mx - c.centre[0], oy = my - c.centre[1], fade = 1.1, f = new Float64Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i) acc += Math.hypot(c.centre[2 * i] - c.centre[2 * i - 2], c.centre[2 * i + 1] - c.centre[2 * i - 1]);
      f[i] = acc >= fade ? 0 : (1 - acc / fade) * (1 - acc / fade);
    }
    const sh = a => { const o = Float64Array.from(a); for (let i = 0; i < n; i++) { o[2 * i] += ox * f[i]; o[2 * i + 1] += oy * f[i]; } return o; };
    return { ...c, centre: sh(c.centre), left: sh(c.left), right: sh(c.right) };
  }

  // ---------- motion ----------
  function pace(path) {
    // how long the flight is shown: the game's own seconds are a tenth of a second for a low shot, so a flight is stretched to
    // a length that can be watched (longer for a longer path), and slowed for the last stretch at the ring
    let len = 0;
    for (let i = 3; i < path.length; i += 3) len += Math.hypot(path[i + 1] - path[i - 2], path[i + 2] - path[i - 1]);
    return clamp(0.9 + 0.38 * len, 1.3, 4.2);
  }
  function startFlight(res, over) {
    const p = res.path, n = p.length / 3;
    let pts = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) { pts[2 * i] = p[3 * i + 1]; pts[2 * i + 1] = p[3 * i + 2]; }
    { const [mx, my] = muzzleWorld(); pts = lead(pts, mx, my); }
    const t0 = p[0], T = p[3 * (n - 1)] - t0, wall = over.wall ?? pace(p);
    flight = { res, p, n, t0, T, rate: T / wall, gt: 0, i: 0, slow: 1, prevD: Infinity, hit: false, wall, elapsed: 0 };
    live = { pts, upto: 1, head: [pts[0], pts[1]] };
    won = false; hitAt = null; flare = 0;
    since = 0; recoil = 1; flash = 1; shake = reduced() ? 0 : 6 * u; coneAlpha = 0.4;
    const [mx, my] = muzzleWorld();
    for (let i = 0; i < 9; i++) smoke.push({ x: mx, y: my, vx: (Math.random() - 0.3) * 0.05 + direction(aim.angle)[0] * 0.04, vy: (Math.random() - 0.3) * 0.05 + direction(aim.angle)[1] * 0.04, r0: 0.03, r1: 0.08 + Math.random() * 0.07, age: -i * 0.03, life: reduced() ? 1.5 : 3.2 + Math.random() });
    wake();
  }
  function finishFlight() {
    if (!flight) return;
    const f = flight;
    flight = null; coneAlpha = 1;
    if (rails()) clock = f.t0 + f.T;                                  // the world goes on from the moment the shell's flight ended
    live.upto = f.n; live.head = null;
    if (f.res.hit && f.res.hit.ok && !f.hit) { f.hit = true; hit(f.res.hit); }
    if (f.res.end === "impact") {
      const e = [live.pts[2 * (f.n - 1)], live.pts[2 * (f.n - 1) + 1]];
      for (let i = 0; i < 7; i++) smoke.push({ x: e[0], y: e[1], vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08, r0: 0.02, r1: 0.07 + Math.random() * 0.05, age: -i * 0.02, life: 1.8, dust: true });
      hooks.onImpact?.(f.res);
    }
    settleAt = 0.0001;
    hooks.onEnd?.(f.res);
    wake();
  }
  function hit(h) {
    won = true; hitAt = [h.x, h.y]; flare = 1;
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.2832, s = 0.3 + Math.random() * 1.2; sparks.push({ x: h.x, y: h.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: 0.7 + Math.random() * 0.6, good: i % 3 === 0 }); }
    hooks.onHit?.(h);
  }
  function step(dt) {
    since += dt;
    if (!reduced()) spin += dt * 0.0035;
    if (!flight && rails()) clock += dt;
    recoil = since < 0.05 ? since / 0.05 : Math.exp(-(since - 0.05) * 5.5);
    if (flash > 0) flash = Math.max(0, flash - dt / 0.14);
    if (shake > 0) shake = Math.max(0, shake - dt * 60 * u);
    if (flare > 0) flare = Math.max(0, flare - dt / 0.9);
    for (const p of smoke) { p.age += dt; if (p.age > 0) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 0.8; p.vy *= 1 - dt * 0.8; } }
    for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].age > smoke[i].life) smoke.splice(i, 1);
    for (const s of sparks) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - dt * 2.5; s.vy *= 1 - dt * 2.5; }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].age > sparks[i].life) sparks.splice(i, 1);
    if (flight) {
      const f = flight, quick = reduced();
      f.elapsed += dt;
      const T = lvl.target, tp = targetAt(lvl, now()), hx = live.head ? live.head[0] : 0, hy = live.head ? live.head[1] : 0, d = Math.hypot(hx - tp[0], hy - tp[1]);
      // the last stretch: slower, and the camera leans in, while the shell is closing on the ring
      const zone = Math.max(0.7, T.r * 3.5);
      let want = 1, lean = 0;
      if (!quick && f.gt > 0.3 * f.T && d < zone && d < f.prevD + 1e-6 && !f.hit) { want = 0.4 + 0.6 * (d / zone) * (d / zone); lean = 1 - d / zone; }
      if (!quick && f.hit && d < 0.7) want = 0.55;
      f.slow += (want - f.slow) * Math.min(1, dt * 9);
      f.prevD = d;
      f.gt += dt * f.rate * f.slow * (ff ? 4 : 1);
      while (f.i + 1 < f.n - 1 && f.p[3 * (f.i + 1)] - f.t0 <= f.gt) f.i++;
      const a = f.p[3 * f.i] - f.t0, b = f.p[3 * (f.i + 1)] - f.t0, w = b > a ? clamp((f.gt - a) / (b - a), 0, 1) : 1;
      const i = f.i;
      live.upto = i + 1;
      live.head = [live.pts[2 * i] + (live.pts[2 * i + 2] - live.pts[2 * i]) * w, live.pts[2 * i + 1] + (live.pts[2 * i + 3] - live.pts[2 * i + 1]) * w];
      if (!f.hit && f.res.hit && f.res.hit.ok && f.gt >= f.res.hit.t - f.t0) { f.hit = true; hit(f.res.hit); }
      if (f.gt >= f.T) finishFlight();
      else if (!quick) {
        // the camera: the aim view, grown to keep the shell in, and leaning toward the ring at the end
        const m = 0.55, hb = { x0: hx - m, y0: hy - m, x1: hx + m, y1: hy + m };
        const b = base(), aimBox = { x0: Math.min(b.x0, hb.x0), y0: Math.min(b.y0, hb.y0), x1: Math.max(b.x1, hb.x1), y1: Math.max(b.y1, hb.y1) };
        fitTo(aimBox, goal);
        if (lean > 0) { goal.k *= 1 + 0.35 * lean; goal.x += ((hx + tp[0]) / 2 - goal.x) * lean * 0.6; goal.y += ((hy + tp[1]) / 2 - goal.y) * lean * 0.6; }
      }
    } else if (settleAt > 0) {
      settleAt += dt;                                          // a moment where the shot ended, then back to the aim view
      if (settleAt > 0.45) settleAt = 0;
    } else fitTo(base(), goal);
    if (reduced()) { cam.x = goal.x; cam.y = goal.y; cam.k = goal.k; return; }           // no camera moves for someone who asked for less
    const e = 1 - Math.exp(-dt * 5.5);
    cam.x += (goal.x - cam.x) * e; cam.y += (goal.y - cam.y) * e; cam.k *= Math.pow(goal.k / cam.k, e);
  }
  const moving = () => !!flight || rails() || settleAt > 0 || smoke.length > 0 || sparks.length > 0 || flash > 0 || flare > 0 || shake > 0.2 || recoil > 0.004 || Math.abs(goal.k - cam.k) > 0.05 || Math.abs(goal.x - cam.x) * cam.k > 0.3 || Math.abs(goal.y - cam.y) * cam.k > 0.3;
  function tick(ts) {
    raf = 0;
    if (held) return;
    const dt = clamp((ts - last) / 1000, 0, 0.05);
    last = ts;
    hooks.before?.();
    step(dt);
    draw();
    if (moving()) raf = requestAnimationFrame(tick);
    else {
      recoil = 0; hooks.onIdle?.();
      // at rest the Earth still turns, slowly: one new picture of it every third of a second (the page draws on no clock but this one)
      if (!spinTimer && !reduced() && lvl) spinTimer = setTimeout(() => { spinTimer = 0; if (!held) { spin += 0.0011; wake(); } }, 330);
    }
  }
  function wake() { if (!raf && !held) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  return {
    resize, draw,
    redraw() { draw(); wake(); },
    setLevel(l) {
      lvl = l; frame = frameOf(l); coneBox = null; fresh = true; clock = 0; fitTo(frame, goal); Object.assign(cam, goal);
      sun = sunOf(l.sun ?? 135, 0.5);
      bodies = [];
      const w = worldOf(l);
      w.bodies.forEach((b, i) => {
        if (b.id === "earth") return;
        const v = l.look?.[b.id] || {};
        bodies.push({ i, id: b.id, r: b.r, rail: b.rail, a: b.a, cx: b.cx, cy: b.cy, retro: b.T < 0 || v.retro, min: v.min ?? 5, offset: v.offset ?? 0, spin: v.spin ?? 0,
          globe: createGlobe("moon", { tilt: v.tilt ?? 8, tint: v.tint || [1, 1, 1] }) });
      });
      if (bodies.length) warm(() => { draw(); wake(); });
      flight = null; live = null; cone = null; ghosts = []; rope = null; won = false; flare = 0; smoke.length = 0; sparks.length = 0; recoil = 0; flash = 0; shake = 0; settleAt = 0; coneAlpha = 1;
      draw();
    },
    // these only note the change and ask for a frame; the page's hooks.before runs in that frame, ahead of the drawing
    setAim(a) { aim = a; wake(); },
    /** What the page's controls cover, in css pixels { t, r, b, l }: the world is fitted into the rest, and the picture runs under them. */
    setInsets(i) {
      const same = ins.t === i.t && ins.r === i.r && ins.b === i.b && ins.l === i.l;
      Object.assign(ins, i);
      if (same || !frame) return;
      fitTo(base(), goal);
      if (!flight) Object.assign(cam, goal);
      draw();
    },
    /** The world's time now (what a shot fired this instant is fired at), and setting it (a saved game's). */
    get clock() { return now(); },
    setClock(t) { clock = t; wake(); },
    setCone(c) {
      cone = c;
      coneBox = null;
      if (c) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const a of [cone.left, cone.right]) for (let i = 0; i < a.length; i += 2) { if (a[i] < x0) x0 = a[i]; if (a[i] > x1) x1 = a[i]; if (a[i + 1] < y0) y0 = a[i + 1]; if (a[i + 1] > y1) y1 = a[i + 1]; }
        coneBox = { x0: x0 - 0.12, y0: y0 - 0.12, x1: x1 + 0.12, y1: y1 + 0.12 };
      }
      if (fresh && frame) { fitTo(base(), goal); Object.assign(cam, goal); }          // a level's first view is where it will rest, not a zoom from the bare frame
      fresh = false;
    },
    setGhosts(g) { ghosts = g; wake(); },
    setRope(r) { rope = r; wake(); },
    setWon(v) { won = v; wake(); },
    clearLive() { live = null; hitAt = null; wake(); },
    wake,
    /** Plays a finished flight: res.path is its (t, x, y) triples. over.wall sets how long it is shown. */
    fire(res, over = {}) { startFlight(res, over); return flight ? flight.wall : 0; },
    skip() { if (flight) { flight.gt = flight.T + 1; finishFlight(); fitTo(base(), goal); wake(); } },
    ff(on) { ff = on; },
    get flying() { return !!flight; },
    get fast() { return ff; },
    hold() { held = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } clearTimeout(spinTimer); spinTimer = 0; },
    release() { held = false; hooks.before?.(); draw(); if (moving()) wake(); },
    get wallOf() { return flight ? flight.wall : 0; },
    /** The point on the page, in css pixels from the canvas's corner, where a world point is. */
    screenOf(x, y) { return [sx(x), sy(y)]; },
    get scale() { return cam.k; },
  };
}
