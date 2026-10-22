// Pipes' shaft in 3D (pipes-deep.js), drawn on one canvas in perspective, by hand (no library, so it works offline).
// The camera looks down into the shaft from a little above and follows the oil down, so the view scrolls as it goes;
// a finger turns it round the shaft (drag sideways) and tips it (drag up or down). Two walls stand behind, banded
// with the strata and marked every fifty metres; the two in front are left open. Rock is drawn as blocks of stone,
// the boons as small things that glow, the pipe as brass tube with the oil dark inside it, and the piece in hand as a
// copper ghost at the open end, turned as it will be laid, with the square it leads into outlined (red if it's shut).
// Everything is drawn back to front, square by square (the painter's way).
import { SIDE, D3, contentAt, openEnd, fits, deadEnd } from "./pipes-deep.js";

const TUBE = 0.34;                 // the pipe's width, in squares
const FOV = 0.46;                  // the shaft's half-diagonal fills this share of the box's width (or of its height, held sideways)
const DIST = 26;                   // the camera's distance from the shaft's middle, in squares: a gentle perspective
const ABOVE = 5, BELOW = 12;       // layers drawn above and below the depth the camera looks at
const EASE_MS = 420;               // how fast the camera catches up with the oil
const SPIN_MS = 150;               // a quarter turn of the piece in hand, shown turning
const css = (el, name, fallback) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** A colour as [r, g, b] from any CSS colour the page gives (hex, rgb(), a color-mix), via a 1×1 canvas. */
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function rgbOf(colour) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000"; probe.fillStyle = colour;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}
const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, alpha = 1) => (alpha >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`);

export function createShaftView(host, { onTap = () => {} } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "pi-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The shaft");
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let W = 1, H = 1, dpr = 1, F = 1, cx = 0, cy = 0;
  let yaw = 0.62, pitch = 0.62;              // turned a little east of south, looking down at 35°
  let fz = 2, target = 2, last = 0;          // the depth the camera looks at, and where it's heading
  let pal = null;
  let held = null, spin = null;              // the piece in hand as last drawn ({ at, q, turns }), and a quarter turn under way
  let drawn = null;                          // what the last frame drew, to draw it again when the box changes size
  const tints = new Map();                   // colours in light, as strings, kept (below)

  // ---------- the palette, from the page's tokens (re-read when the theme or the light changes) ----------
  function palette() {
    const get = (n, f) => rgbOf(css(host, n, f));
    const ground = get("--pi-ground", "#16212A"), stone = get("--pi-stone", "#6B5B47"), wall = get("--pi-wall", "#2A2620");
    pal = {
      ground, stone, wall,
      pipe: get("--pi-pipe", "#C99A45"), pipeDark: get("--pi-pipe-dark", "#8A6424"), oil: get("--pi-oil", "#16120E"),
      ghost: get("--pi-in", "#A9542B"), good: get("--pi-good", "#2F7D5B"), bad: get("--pi-bad", "#A8382B"),
      barrel: get("--c0", "#C8923A"), ink: get("--pi-label", "#C9B892"), font: getComputedStyle(document.body).fontFamily,
    };
    pal.light = mixRgb(pal.pipe, [255, 255, 255], 0.5);
    tints.clear();
  }
  new MutationObserver(() => { palette(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => palette());

  // ---------- the box ----------
  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const half = SIDE / Math.SQRT2;
    F = Math.min(FOV * W, 0.62 * FOV * H) * DIST / half;
    cx = W / 2; cy = H * 0.4;
    palette();
    if (drawn) draw(...drawn);
  }
  new ResizeObserver(resize).observe(host);

  // ---------- the camera ----------
  /** A point of the shaft (x east, y south, z down, in squares) on the screen: [sx, sy, depth, px per square there]. */
  function project(x, y, z) {
    const X = x - SIDE / 2, Y = fz - z, Z = y - SIDE / 2;
    const c = Math.cos(yaw), s = Math.sin(yaw), x1 = X * c - Z * s, z1 = X * s + Z * c;
    const cp = Math.cos(pitch), sp = Math.sin(pitch), y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp;
    const depth = DIST - z2, k = F / depth;
    return [cx + x1 * k, cy - y2 * k, depth, k];
  }
  // where the camera is, for which faces of a block and which walls it sees
  const camera = () => ({ x: SIDE / 2 + DIST * Math.cos(pitch) * Math.sin(yaw), y: SIDE / 2 + DIST * Math.cos(pitch) * Math.cos(yaw), z: fz - DIST * Math.sin(pitch) });

  // ---------- turning it with a finger ----------
  let down = null;
  canvas.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) < 8) return;
    down.moved = true;
    yaw -= dx * 0.009;
    pitch = Math.min(1.15, Math.max(0.3, pitch + dy * 0.006));
    down.x = e.clientX; down.y = e.clientY;
  });
  canvas.addEventListener("pointerup", e => { if (down && e.pointerId === down.id && !down.moved) onTap(); down = null; });
  canvas.addEventListener("pointercancel", () => { down = null; });

  // ---------- drawing ----------
  const shade = (c, t) => (t >= 1 ? mixRgb(c, [255, 255, 255], Math.min(0.5, t - 1)) : mixRgb(c, [0, 0, 0], 1 - t));
  // a colour in light, as a string, kept: a frame asks for the same few hundred (each block's faces) every time
  const tint = (c, t, alpha = 1) => {
    const key = `${c}|${Math.round(t * 100)}|${alpha}`;
    let v = tints.get(key);
    if (!v) { v = rgb(shade(c, Math.round(t * 100) / 100), alpha); tints.set(key, v); }
    return v;
  };
  /** A layer's band of strata: the wall's colour nudged lighter or darker by a hash of its depth. */
  const strata = z => { const h = Math.sin(z * 12.9898) * 43758.5453, v = h - Math.floor(h); return 0.82 + v * 0.3; };
  function quad(pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  /** The two walls behind the shaft, in bands a layer high, and the depth marks every fifty metres. */
  function walls(z0, z1, cam) {
    const backX = cam.x > SIDE / 2 ? 0 : SIDE, backY = cam.y > SIDE / 2 ? 0 : SIDE;
    for (let z = z0; z <= z1; z++) {
      if (z < 0) continue;
      const t = strata(z);
      quad([project(backX, 0, z), project(backX, SIDE, z), project(backX, SIDE, z + 1), project(backX, 0, z + 1)], tint(pal.wall, t * 0.92));
      quad([project(0, backY, z), project(SIDE, backY, z), project(SIDE, backY, z + 1), project(0, backY, z + 1)], tint(pal.wall, t));
    }
    // the squares' lines on the walls, faint
    ctx.strokeStyle = tint(pal.wall, 1.25, 0.35); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let z = Math.max(0, z0); z <= z1 + 1; z++) {
      const a = project(backX, 0, z), b = project(backX, SIDE, z), c = project(0, backY, z), d = project(SIDE, backY, z);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
    }
    for (let i = 0; i <= SIDE; i++) {
      const a = project(backX, i, Math.max(0, z0)), b = project(backX, i, z1 + 1), c = project(i, backY, Math.max(0, z0)), d = project(i, backY, z1 + 1);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
    }
    ctx.stroke();
  }
  /** The depth every fifty metres, at the left of the box, level with the corner where the back walls meet. */
  function marks(z0, z1, cam) {
    const backX = cam.x > SIDE / 2 ? 0 : SIDE, backY = cam.y > SIDE / 2 ? 0 : SIDE;
    ctx.font = `700 ${Math.round(Math.max(10, Math.min(13, W / 32)))}px ${pal.font}`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (let z = Math.ceil(Math.max(1, z0) / 5) * 5; z <= z1; z += 5) {
      const y = project(backX, backY, z)[1];
      if (y < 10 || y > H - 10) continue;
      ctx.strokeStyle = rgb(pal.ink, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(12, y); ctx.stroke();
      ctx.fillStyle = rgb(pal.ink, 0.9);
      ctx.fillText(`${z * 10} m`, 15, y);
    }
  }
  /** A block of rock: the faces the camera can see, those against another block left out. */
  function block(S, D, x, y, z, cam, alpha = 1) {
    const t = strata(z), base = pal.stone;
    ctx.save();
    ctx.globalAlpha = alpha;
    const solid = (dx, dy, dz) => { const w = contentAt(S, D, x + dx, y + dy, z + dz); return w === "rock"; };
    const v = (i, j, k) => project(x + i, y + j, z + k);
    const edge = tint(base, 0.55, 0.9);
    if (cam.x > x + 1 && !solid(1, 0, 0)) quad([v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)], tint(base, 0.78 * t), edge);
    if (cam.x < x && !solid(-1, 0, 0)) quad([v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1)], tint(base, 0.78 * t), edge);
    if (cam.y > y + 1 && !solid(0, 1, 0)) quad([v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)], tint(base, 0.64 * t), edge);
    if (cam.y < y && !solid(0, -1, 0)) quad([v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], tint(base, 0.64 * t), edge);
    if (cam.z < z && !solid(0, 0, -1)) quad([v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)], tint(base, t), edge);
    ctx.restore();
  }
  /** The middle of a square's side d (or the square's middle, d < 0), in squares. */
  const port = (c, d) => (d < 0 ? [c.x + 0.5, c.y + 0.5, c.z + 0.5] : [c.x + 0.5 + D3[d][0] / 2, c.y + 0.5 + D3[d][1] / 2, c.z + 0.5 + D3[d][2] / 2]);
  /** A square of pipe's line through it, from side a to side b: straight, or a quarter circle round the edge they share. */
  function line(c, a, b) {
    if (a >= 0 && (a >> 1) !== (b >> 1)) {
      const da = D3[a], db = D3[b], m = [c.x + 0.5, c.y + 0.5, c.z + 0.5];
      const K = m.map((v, i) => v + 0.5 * (da[i] + db[i])), pts = [];
      for (let i = 0; i <= 6; i++) { const s = (i / 6) * Math.PI / 2; pts.push(K.map((v, j) => v - 0.5 * (Math.cos(s) * db[j] + Math.sin(s) * da[j]))); }
      return pts;
    }
    return [port(c, a), port(c, -1), port(c, b)];
  }
  /** Part of a line, from its start: t of its length (0 to 1). */
  function part(pts, t) {
    if (t >= 1) return pts;
    const seg = [];
    for (let i = 1; i < pts.length; i++) seg.push(Math.hypot(...pts[i].map((v, j) => v - pts[i - 1][j])));
    let want = seg.reduce((a, b) => a + b, 0) * Math.max(0, t);
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (want >= seg[i - 1]) { out.push(pts[i]); want -= seg[i - 1]; continue; }
      const f = seg[i - 1] ? want / seg[i - 1] : 0;
      out.push(pts[i - 1].map((v, j) => v + (pts[i][j] - v) * f));
      break;
    }
    return out;
  }
  /** A tube along a line of points (in squares): its dark edge, its body, a glint toward the light. */
  function tube(pts, body, edge, glint, k, alpha = 1) {
    const sp = pts.map(p => project(...p)), w = TUBE * k;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const stroke = (col, width, dx = 0, dy = 0) => {
      ctx.strokeStyle = col; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(sp[0][0] + dx, sp[0][1] + dy);
      for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0] + dx, sp[i][1] + dy);
      ctx.stroke();
    };
    stroke(edge, w + 2);
    stroke(body, w);
    if (glint) stroke(glint, w * 0.28, -w * 0.16, -w * 0.18);
    ctx.restore();
  }
  function oilIn(pts, t, k) {
    if (t <= 0) return;
    const sp = part(pts, t).map(p => project(...p)), w = TUBE * k;
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = rgb(pal.oil); ctx.lineWidth = w * 0.56;
    ctx.beginPath(); ctx.moveTo(sp[0][0], sp[0][1]);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]);
    ctx.stroke();
    ctx.strokeStyle = rgb(mixRgb(pal.oil, [255, 255, 255], 0.28)); ctx.lineWidth = Math.max(1, w * 0.1);
    ctx.beginPath(); ctx.moveTo(sp[0][0] - w * 0.08, sp[0][1] - w * 0.1);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0] - w * 0.08, sp[i][1] - w * 0.1);
    ctx.stroke();
    ctx.restore();
  }
  /** A boon where it lies: a barrel, a charge (three sticks and a lit fuse) or a tank (a sphere), glowing. */
  function boon(kind, x, y, z, now) {
    const [sx, sy, , k] = project(x + 0.5, y + 0.5, z + 0.5), u = k * 0.5;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, u * 1.15), col = kind === "barrel" ? pal.barrel : kind === "charge" ? pal.bad : pal.good;
    const pulse = 0.28 + 0.12 * Math.sin(now / 320 + x + y * 2 + z);
    glow.addColorStop(0, rgb(col, pulse)); glow.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, u * 1.15, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.lineWidth = Math.max(1, u * 0.07);
    if (kind === "barrel") {
      const bw = u * 0.62, bh = u * 0.86;
      ctx.fillStyle = rgb(col); ctx.strokeStyle = rgb(shade(col, 0.5));
      ctx.beginPath(); ctx.roundRect(sx - bw / 2, sy - bh / 2, bw, bh, bw * 0.22); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - bw / 2, sy - bh * 0.18); ctx.lineTo(sx + bw / 2, sy - bh * 0.18); ctx.moveTo(sx - bw / 2, sy + bh * 0.18); ctx.lineTo(sx + bw / 2, sy + bh * 0.18); ctx.stroke();
      ctx.fillStyle = rgb(shade(col, 1.3)); ctx.beginPath(); ctx.ellipse(sx, sy - bh / 2 + bw * 0.05, bw * 0.42, bw * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    } else if (kind === "charge") {
      const sw = u * 0.2, sh = u * 0.7;
      ctx.fillStyle = rgb(col); ctx.strokeStyle = rgb(shade(col, 0.5));
      for (const dx of [-1, 0, 1]) { ctx.beginPath(); ctx.roundRect(sx + dx * sw * 1.02 - sw / 2, sy - sh / 2 + Math.abs(dx) * sw * 0.15, sw, sh, sw * 0.4); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = rgb(shade(col, 0.45)); ctx.fillRect(sx - sw * 1.6, sy + sh * 0.08, sw * 3.2, sh * 0.14);
      ctx.strokeStyle = rgb(pal.ink); ctx.beginPath(); ctx.moveTo(sx, sy - sh / 2); ctx.quadraticCurveTo(sx + sw, sy - sh * 0.75, sx + sw * 0.6, sy - sh * 0.9); ctx.stroke();
      const fl = 0.7 + 0.3 * Math.sin(now / 90);
      ctx.fillStyle = rgb(mixRgb(pal.barrel, [255, 240, 200], 0.5)); ctx.beginPath(); ctx.arc(sx + sw * 0.6, sy - sh * 0.9, sw * 0.42 * fl, 0, Math.PI * 2); ctx.fill();
    } else {
      const r = u * 0.42, g = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.4, r * 0.1, sx, sy, r);
      g.addColorStop(0, rgb(shade(col, 1.4))); g.addColorStop(1, rgb(shade(col, 0.7)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgb(shade(col, 0.45)); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgb(shade(col, 0.5)); ctx.fillRect(sx - r * 0.5, sy + r * 0.8, r * 0.18, r * 0.5); ctx.fillRect(sx + r * 0.32, sy + r * 0.8, r * 0.18, r * 0.5);
    }
    ctx.restore();
  }
  /** A square's outline (the one the ghost leads into): green if it's open, red if it's shut. */
  function outline(c, col) {
    const v = (i, j, k) => project(c.x + i, c.y + j, c.z + k);
    const edges = [[0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]];
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (const [a, b, d, e, f, g] of edges) { const p = v(a, b, d), q = v(e, f, g); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    ctx.stroke();
    ctx.restore();
  }
  /** An arrowhead at the ghost's exit, pointing the way the pipe will go on. */
  function arrow(exit, col, k) {
    const c = { x: exit.x - D3[exit.d][0], y: exit.y - D3[exit.d][1], z: exit.z - D3[exit.d][2] };
    const base = port(c, exit.d), tip = base.map((v, i) => v + D3[exit.d][i] * 0.42);
    const a = project(...base), b = project(...tip), dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, w = TUBE * k * 0.75;
    const nx = -dy / len * w, ny = dx / len * w;
    ctx.save();
    ctx.fillStyle = col; ctx.strokeStyle = rgb(pal.ground, 0.6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0] + nx, a[1] + ny); ctx.lineTo(a[0] - nx, a[1] - ny); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  /** The wellhead at the surface: a flanged stack standing out of the shaft's top, with its valve wheel. */
  function wellhead(c) {
    const base = [c.x + 0.5, c.y + 0.5, 0], top = [c.x + 0.5, c.y + 0.5, -0.9];
    const k = project(...base)[3];
    tube([base, top], rgb(pal.pipe), rgb(pal.pipeDark), rgb(pal.light), k);
    const p = project(c.x + 0.5, c.y + 0.5, -0.55), r = k * 0.22;
    ctx.save(); ctx.strokeStyle = rgb(pal.bad); ctx.lineWidth = Math.max(2, k * 0.05);
    ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  /** A point turned by angle t about the line through `pivot` along unit `axis` (Rodrigues' formula). */
  function turnAbout(p, pivot, axis, t) {
    const v = p.map((x, i) => x - pivot[i]), c = Math.cos(t), s = Math.sin(t), d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
    const k = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
    return v.map((x, i) => pivot[i] + x * c + k[i] * s + axis[i] * d * (1 - c));
  }
  /** The piece in hand turned since the last frame (the same open end, a new way): it swings a quarter into place. */
  function noteTurn(ghost, now, turns) {
    if (!ghost) { held = null; return; }
    const c = ghost.cells[0], at = `${c.x},${c.y},${c.z},${c.a},${ghost.cells.length}`, q = c.b;
    // only a turn given (not a new piece arriving the same way round), and a quarter one: about the way the pipe goes
    if (held && held.at === at && held.turns !== turns && held.q !== q) {
      const u = D3[held.q], w = D3[q], axis = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      spin = Math.hypot(...axis) > 0.5 ? { t0: now, axis, pivot: port(c, c.a) } : null;
    }
    if (!held || held.at !== at) spin = null;
    held = { at, q, turns };
  }
  /** How far a quarter turn under way has still to swing (radians, 0 once it's done), easing out. */
  function spinLeft(now) {
    if (!spin) return 0;
    const k = (now - spin.t0) / SPIN_MS;
    if (k >= 1 || reduced()) { spin = null; return 0; }
    return -(Math.PI / 2) * (1 - k) ** 3;
  }
  /** The ghost's line through a square, swung back by what's left of the turn. */
  const swung = (pts, t) => (t ? pts.map(p => turnAbout(p, spin.pivot, spin.axis, t)) : pts);

  /**
   * The frame: S the shaft, D the descent; opts: ghost (the way the piece in hand would be laid, or null), now (for
   * the boons' glow, the camera easing after the oil, and a piece swinging round as it's turned), still (the camera
   * where it should be at once, nothing swinging), turns (the quarter turns given so far: a new count swings the piece).
   */
  function draw(S, D, opts = {}) {
    const { ghost = null, now = performance.now(), still = false, turns = 0 } = opts;
    drawn = [S, D, { ...opts, still: true }];
    if (!pal) palette();
    noteTurn(still ? null : ghost, now, turns);
    const turning = spinLeft(now);
    const oil = D.pipe[D.oil.i], end = openEnd(D);
    target = Math.max(1.5, (oil.z + end.z) / 2 + 1.2);
    const dt = last ? Math.max(0, Math.min(100, now - last)) : 1000;    // never backwards: a frame asked for out of turn
    last = Math.max(last, now);
    fz = still ? target : fz + (target - fz) * (1 - Math.exp(-dt / EASE_MS));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = rgb(pal.ground); ctx.fillRect(0, 0, W, H);
    const cam = camera(), z0 = Math.floor(fz - ABOVE), z1 = Math.ceil(fz + BELOW);
    walls(z0, z1, cam);
    // the surface's rim, once it's in view
    if (z0 <= 0) {
      ctx.strokeStyle = rgb(pal.pipeDark); ctx.lineWidth = 2;
      const rim = [project(0, 0, 0), project(SIDE, 0, 0), project(SIDE, SIDE, 0), project(0, SIDE, 0)];
      ctx.beginPath(); rim.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
    }
    // everything in a square, sorted far to near
    const items = [];
    const pipeAt = new Map();
    D.pipe.forEach((c, i) => { if (c.z >= z0 - 1 && c.z <= z1) pipeAt.set(`${c.x},${c.y},${c.z}`, i); });
    const ghostAt = new Map();
    if (ghost) ghost.cells.forEach(c => ghostAt.set(`${c.x},${c.y},${c.z}`, c));
    for (let z = Math.max(0, z0); z <= z1; z++) for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) {
      const key = `${x},${y},${z}`, i = pipeAt.get(key), g = ghostAt.get(key);
      const what = i == null ? contentAt(S, D, x, y, z) : "pipe";
      if (!what && !g) continue;
      const depth = project(x + 0.5, y + 0.5, z + 0.5)[2];
      items.push({ depth, x, y, z, what, i, g });
    }
    items.sort((a, b) => b.depth - a.depth);
    // where the work is (the oil's square, the last pipe laid, the piece in hand): rock nearer the camera that stands
    // in front of it is drawn faint, so it never hides what you're doing
    const work = [D.pipe[D.oil.i], ...D.pipe.slice(-2), ...(ghost ? ghost.cells : [end])].map(c => project(c.x + 0.5, c.y + 0.5, c.z + 0.5));
    const nearest = Math.min(...work.map(w => w[2]));
    const inFront = (x, y, z) => {
      const p = project(x + 0.5, y + 0.5, z + 0.5);
      return p[2] < nearest - 0.3 && work.some(w => Math.hypot(p[0] - w[0], p[1] - w[1]) < 0.8 * (p[3] + w[3]));
    };
    for (const it of items) {
      const { x, y, z } = it;
      if (it.what === "rock") block(S, D, x, y, z, cam, inFront(x, y, z) ? 0.3 : 1);
      else if (it.what === "barrel" || it.what === "charge" || it.what === "tank") boon(it.what, x, y, z, now);
      if (it.i != null) {
        const c = D.pipe[it.i], k = project(x + 0.5, y + 0.5, z + 0.5)[3], pts = line(c, c.src ? -1 : c.a, c.b);
        if (c.src) pts.unshift([c.x + 0.5, c.y + 0.5, 0]);
        if (c.tank) {                                          // a tank in the pipe: a fat green drum round it
          tube([port(c, -1), port(c, -1)], rgb(pal.good), rgb(shade(pal.good, 0.5)), rgb(shade(pal.good, 1.35)), k * 2.1);
        }
        tube(pts, rgb(pal.pipe), rgb(pal.pipeDark), rgb(pal.light), k);
        const t = it.i < D.oil.i ? 1 : it.i === D.oil.i ? (D.flowing ? D.oil.p : 0) : 0;
        oilIn(pts, t, k);
      }
      if (it.g) {
        const ok = fits(S, D, ghost), k = project(x + 0.5, y + 0.5, z + 0.5)[3];
        const col = ok ? rgb(pal.ghost) : rgb(pal.bad);
        tube(swung(line(it.g, it.g.a, it.g.b), turning), col, rgb(shade(ok ? pal.ghost : pal.bad, 0.45)), rgb(mixRgb(ok ? pal.ghost : pal.bad, [255, 255, 255], 0.45)), k, 0.72);
      }
    }
    if (D.pipe[0].z >= z0 - 1) wellhead(D.pipe[0]);
    if (ghost) {
      const ok = fits(S, D, ghost), shut = deadEnd(S, D, ghost), ex = ghost.exit, k = project(ex.x + 0.5, ex.y + 0.5, ex.z + 0.5)[3];
      if (ok && !turning) {
        outline(ex, rgb(shut ? pal.bad : pal.good, 0.95));
        arrow(ex, rgb(shut ? pal.bad : pal.ghost), k);
      }
    } else if (!D.over) outline(end, rgb(pal.ghost, 0.5 + 0.3 * Math.sin(now / 250)));   // nothing in hand to show: the open end
    // the depths fade into the dark below
    const fade = ctx.createLinearGradient(0, H * 0.72, 0, H);
    fade.addColorStop(0, rgb(pal.ground, 0)); fade.addColorStop(1, rgb(pal.ground, 0.92));
    ctx.fillStyle = fade; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    marks(z0, z1, cam);
  }
  /** Back to the camera's first angle and depth (a new descent). */
  function reset() { yaw = 0.62; pitch = 0.62; fz = target = 2; last = 0; }
  resize();
  return { draw, resize, reset, canvas };
}
