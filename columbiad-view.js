// Columbiad's scene, on a canvas that fills the whole screen: a night sky, the Earth and the moons as large lit globes
// (columbiad-globe.js) with a faint well of rings round each, the launch pad on the Earth, the preview, the ghosts of earlier shots, the ring, and a flight
// that the camera follows with a glowing trail and slows for the last stretch. The page's controls are drawn over the picture,
// not beside it, so the camera fits the world into what they leave free (`setInsets`) while the sky and the Earth run edge
// to edge. The page draws only while something moves (a drag, a flight, smoke hanging, the camera easing, a moon on its rail,
// and the Earth's slow turn, a few times a second); it stops when the menu is open or the page is away. Nothing here changes a
// rule: the rules are columbiad-engine.js's, and this plays a finished flight back. The colours are the picture's own, the
// same in every theme; the chrome over it is the page's.
import { direction, targetAt, ringAt, bodyAt, worldOf } from "./columbiad-engine.js";
import { createGlobe, loadEarth, warm, sunOf } from "./columbiad-globe.js";
import { defaultIs3D } from "./mode3d.js";

const INK = "233,223,198", BRASS = "217,164,65", BRASS_HI = "240,213,138", GOOD = "127,194,168", BAD = "232,128,111";
const SKY_TOP = "#080d19", SKY_BOT = "#16213a";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** The Earth's turn, in turns a second (1.26 degrees: a day in four and a half minutes). */
const SPIN = 0.0035;

/** The world box a level's aim view shows: the launch pad and the ground round it, the Moon and the ring; the Earth is as much of it as that holds. { x0, y0, x1, y1 }. */
export function frameOf(lvl) {
  if (lvl.frame) return { x0: lvl.frame[0], y0: lvl.frame[1], x1: lvl.frame[2], y1: lvl.frame[3] };
  const site = lvl.site ?? 90, re = worldOf(lvl).re, [ox, oy] = direction(site).map(v => v * re), tx = -oy / re, ty = ox / re;
  const pts = [];
  for (const a of [-1, 1]) for (const o of [-0.5, 1.25]) pts.push([ox + tx * a + ox / re * o, oy + ty * a + oy / re * o]);
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
  let earthG = null, lastDraw = 0, idled = false;
  // the aim view: the level's own frame, grown to hold the whole cone, so the preview is never out of sight
  const base = () => (coneBox && !lvl.frame ? { x0: Math.min(frame.x0, coneBox.x0), y0: Math.min(frame.y0, coneBox.y0), x1: Math.max(frame.x1, coneBox.x1), y1: Math.max(frame.y1, coneBox.y1) } : frame);
  let flight = null, live = null;                                     // the flight playing; the trail it leaves until the next shot
  let flash = 0, pulse = 0;                                           // the glint at the pad when a shot leaves, and the pad's ring opening
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
  function globeAt(g, R, pad, sizes, turn) {
    const want = 2 * R * pad * dpr * 0.55;          // about half the screen's own pixels: the map is 1024 wide, so more is not more picture, and the page's smoothing does the rest
    let S = sizes[sizes.length - 1];
    for (const z of sizes) if (want <= z * 1.15) { S = z; break; }
    return g.picture(turn, sun, S);
  }
  function planet(g, x, y, R, spinTurns, sizes) {
    if (R < 0.6 || x + R * 1.2 < 0 || x - R * 1.2 > W || y + R * 1.2 < 0 || y - R * 1.2 > H) return;
    const pic = globeAt(g, R, g.pad, sizes, spinTurns), d = 2 * R * g.pad;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    const air = g.air(pic.width);
    if (air) ctx.drawImage(air, x - d / 2, y - d / 2, d, d);        // the Earth's air, then its disc through an exact circle (a clean limb at any size)
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, R * 1.002, 0, 6.2832); ctx.clip();
    ctx.drawImage(pic, x - d / 2, y - d / 2, d, d);
    ctx.restore();
  }
  /** The Earth at its place in the world, large: the launch pad is a point on its rim. */
  function earthBody() {
    const e = worldOf(lvl).bodies.find(b => b.id === "earth");
    if (e) earth(sx(e.x), sy(e.y), e.r * cam.k);
  }
  function earth(ex, ey, R) {
    if (!earthG) { earthG = createGlobe("earth", { tilt: 24, roll: -12, gap: 30, onFresh: () => { if (!raf && !held) { draw(); wake(); } } }); loadEarth(() => { draw(); wake(); }); warm(() => { draw(); wake(); }); }
    planet(earthG, ex, ey, R, spin, [96, 192, 288, 384, 512, 640]);
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
      planet(b.globe, x, y, R, turn + b.offset, [48, 96, 192, 320]);
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
  }
  /** A gravity well: dotted rings round a body, nearer together as it pulls harder, so where a shot will bend can be read at a glance. */
  function wells() {
    const w = worldOf(lvl);
    ctx.save();
    ctx.setLineDash([1, 6 * u]); ctx.lineWidth = 1;
    for (const b of w.bodies) {
      const x = sx(b.x), y = sy(b.y);
      if (b.rail) continue;
      for (const m of [1.5, 2, 2.8, 4]) {
        ctx.strokeStyle = `rgba(${INK},${0.16 / (0.5 + m * 0.5)})`;
        ctx.beginPath(); ctx.arc(x, y, b.r * m * cam.k, 0, 6.2832); ctx.stroke();
      }
    }
    ctx.restore();
  }
  /** The goal on the picture: the target ring, or each gate in order, with what is asked of the arrival drawn on the ring itself. */
  function ring() {
    const goal = lvl.goal || { type: "hit" }, list = lvl.gates || [lvl.target];
    list.forEach((T, i) => oneRing(T, i, list.length, goal));
  }
  function oneRing(T, i, n, goal) {
    const p = ringAt(lvl, T, now()), R = Math.max(T.r * cam.k, 7 * u), x = sx(p[0]), y = sy(p[1]);
    if (x + R * 2 < 0 || x - R * 2 > W || y + R * 2 < 0 || y - R * 2 > H) return;
    const last = i === n - 1, col = won && last ? GOOD : BRASS, lim = n > 1 ? T : goal.type === "soft" ? { soft: goal.speed } : goal.type === "fast" ? { fast: goal.speed } : {};
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${col},${won && last ? 0.4 : 0.1})`); g.addColorStop(1, `rgba(${col},${won && last ? 0.22 : 0.05})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = `rgba(${col},.95)`; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.2832); ctx.stroke();
    ctx.save();
    ctx.lineWidth = 1; ctx.setLineDash([3 * u, 3 * u]); ctx.strokeStyle = `rgba(${col},.7)`;                  // the inner third, where a shot is worth a bonus mark
    ctx.beginPath(); ctx.arc(x, y, R / 3, 0, 6.2832); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${col},.8)`; ctx.beginPath();
    for (let k = 0; k < 12; k++) { const a = k * 0.5236, c = Math.cos(a), s = Math.sin(a), r0 = R + 2 * u, r1 = R + (k % 3 === 0 ? 7 : 4) * u; ctx.moveTo(x + c * r0, y + s * r0); ctx.lineTo(x + c * r1, y + s * r1); }
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3 * u, y); ctx.lineTo(x + 3 * u, y); ctx.moveTo(x, y - 3 * u); ctx.lineTo(x, y + 3 * u); ctx.stroke();
    // the speed band: a hatched green ring outside, and the limit in figures (the band is told by its pattern as well as its colour)
    if (lim.soft !== undefined || lim.fast !== undefined) {
      ctx.save();
      ctx.setLineDash([2.5 * u, 2 * u]); ctx.lineWidth = 5 * u; ctx.strokeStyle = `rgba(${GOOD},.85)`;
      ctx.beginPath(); ctx.arc(x, y, R + 10 * u, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${GOOD},.9)`;
      ctx.beginPath(); ctx.arc(x, y, R + 7 * u, 0, 6.2832); ctx.arc(x, y, R + 13 * u, 0, 6.2832); ctx.stroke();
      ctx.restore();
      label(`${lim.soft !== undefined ? "≤" : "≥"} ${(lim.soft ?? lim.fast).toFixed(lim.soft ?? lim.fast < 10 ? 1 : 0)}`, x, y - R - 18 * u, GOOD);
    }
    if (n > 1) label(String(i + 1), x, y - R - 8 * u, BRASS_HI, 13);
    // a ring that moves: where it will be when the shot now aimed comes nearest (the preview's own moment), a faint ring, so the thumb can wait for it
    if (cone && cone.tNear !== undefined && !flight && !live && (T.body != null || T.rail)) {
      const q = ringAt(lvl, T, cone.tNear), gx = sx(q[0]), gy = sy(q[1]);
      if (Math.hypot(gx - x, gy - y) > R * 0.6) {
        ctx.save();
        ctx.setLineDash([2 * u, 3 * u]); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${BRASS_HI},.75)`;
        ctx.beginPath(); ctx.arc(gx, gy, R, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }
    }
    if (goal.type === "orbit" && last) label(`↻ ${goal.sweep}°`, x, y + R + 14 * u, BRASS_HI);
    if (goal.type === "return" && last) label("down here", x, y - R - 8 * u, BRASS_HI);
    if (flare > 0 && last) {
      ctx.lineWidth = 3 * u; ctx.strokeStyle = `rgba(${GOOD},${flare * 0.9})`;
      ctx.beginPath(); ctx.arc(x, y, R * (1 + (1 - flare) * 1.6), 0, 6.2832); ctx.stroke();
    }
  }
  function label(text, x, y, col, size = 11) {
    ctx.save();
    ctx.font = `700 ${size * u}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3 * u; ctx.strokeStyle = "rgba(6,10,20,.85)"; ctx.strokeText(text, x, y);
    ctx.fillStyle = `rgba(${col},1)`; ctx.fillText(text, x, y);
    ctx.restore();
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
  // The preview suggests where the shot goes and does not solve it (Korbi, 4 November 2026): a spray of dots, each on one of the sample
  // shells at its station (the shells are perturbed far more than a real shot, engine `previewSpread`), so the further they go the more they scatter;
  // they swell and fade. Chosen over a cone, a soft band and a fan of lines: a line of any kind still reads as the answer.
  const hash01 = i => { let h = Math.imul(i + 1, 0x9E3779B1); h ^= h >>> 15; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  function coneBand() {
    if (!cone || coneAlpha <= 0.01) return;
    const c = cone, n = c.centre.length / 2;
    if (n < 2) return;
    for (let k = 1; k < n; k++) for (let m = 0; m < 3; m++) {
      const sh = c.shells[Math.floor(hash01(k * 7 + m) * c.shells.length)], f = Math.pow(1 - k / (n - 1), 1.3), r = (1.1 + 2.6 * (k / n)) * u;
      ctx.fillStyle = `rgba(${BRASS_HI},${(0.7 * f + 0.03) * coneAlpha * (m ? 0.6 : 1)})`;
      ctx.beginPath(); ctx.arc(sx(sh[2 * k]), sy(sh[2 * k + 1]), r, 0, 6.2832); ctx.fill();
    }
  }
  /** Where a shot leaves: the pad, a point on the Earth's rim at the level's site. */
  function padWorld() {
    const re = worldOf(lvl).re, [ox, oy] = direction(lvl.site ?? 90);
    return [ox * re, oy * re];
  }
  /** The launch pad: a brass tick standing out of the rim, a small bright disc on it and a ring that opens when a shot leaves (a marker, not a machine). */
  function pad() {
    const [px, py] = padWorld(), [ox, oy] = direction(lvl.site ?? 90), X = sx(px), Y = sy(py), nx = ox, ny = -oy, L = 14 * u;
    ctx.save();
    ctx.lineCap = "round";
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, 26 * u);
    g.addColorStop(0, `rgba(${BRASS_HI},.55)`); g.addColorStop(1, `rgba(${BRASS},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, 26 * u, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = `rgba(${BRASS_HI},.95)`; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + nx * L, Y + ny * L); ctx.stroke();
    ctx.strokeStyle = `rgba(${BRASS},.9)`; ctx.lineWidth = 1.5 * u;
    ctx.beginPath(); ctx.moveTo(X - ny * 7 * u, Y + nx * 7 * u); ctx.lineTo(X + ny * 7 * u, Y - nx * 7 * u); ctx.stroke();
    ctx.fillStyle = "#fffdf4"; ctx.beginPath(); ctx.arc(X, Y, 3 * u, 0, 6.2832); ctx.fill();
    if (pulse > 0) {
      ctx.strokeStyle = `rgba(${BRASS_HI},${pulse * 0.9})`; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(X, Y, (6 + (1 - pulse) * 30) * u, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
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
      const [mx, my] = padWorld(), X = sx(mx), Y = sy(my), r = 34 * u * flash;
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
    sky();
    const t = now();
    wells();
    earthBody();
    moons(t);
    pad();
    ghostLines();
    ring();
    coneBand();
    trail();
    puffs();
    ctx.restore();
    vignette();
    ropeWidget();
  }

  // ---------- time ----------
  /** The world's time as the picture shows it: the flight's own while a shell is out, else the clock. */
  function now() { return flight ? flight.t0 + flight.gt : clock; }
  const rails = () => !!lvl && worldOf(lvl).moving;
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
    const t0 = p[0], T = p[3 * (n - 1)] - t0, wall = over.wall ?? pace(p);
    flight = { res, p, n, t0, T, rate: T / wall, gt: 0, i: 0, slow: 1, prevD: Infinity, hit: false, wall, elapsed: 0 };
    live = { pts, upto: 1, head: [pts[0], pts[1]] };
    won = false; hitAt = null; flare = 0;
    flash = 1; pulse = reduced() ? 0 : 1; coneAlpha = 0.4;
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
    if (!flight && rails()) clock += dt;
    if (flash > 0) flash = Math.max(0, flash - dt / 0.3);
    if (pulse > 0) pulse = Math.max(0, pulse - dt / 0.7);
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
  const moving = () => !!flight || rails() || settleAt > 0 || smoke.length > 0 || sparks.length > 0 || flash > 0 || pulse > 0 || flare > 0 || Math.abs(goal.k - cam.k) > 0.05 || Math.abs(goal.x - cam.x) * cam.k > 0.3 || Math.abs(goal.y - cam.y) * cam.k > 0.3;
  function tick(ts) {
    raf = 0;
    if (held) return;
    const still = !moving();
    // at rest only the Earth moves, and slowly: it is drawn at half the screen's rate, on every second frame (a steady 30 a second
    // on a 60 Hz screen), the turn being the time that has passed, whenever it is drawn
    if (still && lastDraw && ts - lastDraw < 28) { raf = requestAnimationFrame(tick); return; }
    const raw = (ts - last) / 1000, dt = clamp(raw, 0, 0.05);
    last = ts; lastDraw = ts;
    if (!reduced()) spin += Math.min(raw, 0.25) * SPIN;          // a pure function of the time that has run (a long gap, a sleeping tab, is not owed)
    hooks.before?.();
    step(dt);
    // at rest the Earth is all that changes: draw only when it has a new picture (the worker's, a moment behind the clock)
    if (moving() || !earthG || earthG.changed(spin)) draw();
    if (moving()) { raf = requestAnimationFrame(tick); idled = false; }
    else {
      if (!idled) { idled = true; hooks.onIdle?.(); }
      if (!reduced() && lvl && defaultIs3D()) raf = requestAnimationFrame(tick);   // the Earth's slow turn (Settings' 2D mode, battery saver: Columbiad is 3D only, so the Earth stands still)
    }
  }
  function wake() { if (!raf && !held) { last = performance.now(); lastDraw = 0; idled = false; raf = requestAnimationFrame(tick); } }

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
      flight = null; live = null; cone = null; ghosts = []; rope = null; won = false; flare = 0; smoke.length = 0; sparks.length = 0; flash = 0; pulse = 0; settleAt = 0; coneAlpha = 1;
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
    hold() { held = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    release() { held = false; hooks.before?.(); draw(); if (moving()) wake(); },
    get wallOf() { return flight ? flight.wall : 0; },
    /** The point on the page, in css pixels from the canvas's corner, where a world point is. */
    screenOf(x, y) { return [sx(x), sy(y)]; },
    get scale() { return cam.k; },
  };
}
