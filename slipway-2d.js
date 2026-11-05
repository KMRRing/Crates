// Slipway's workbench flat (Settings' 2D mode, battery saver; where there is no WebGL): the block drawn on a plain canvas, cell by
// cell, from the same camera as slipway-3d.js (a perspective one 233 cells away, so a cut seen edge-on is a line, and the saw's
// plane through the eye and a line on the screen is the same plane). It answers to the same calls (setBlock, refresh, ray, eye,
// forward, orbit, view, cursor, guide, cutGhost, offcut, throwChips, reveal, ghost, ...), so slipway.js plays the same: the named
// views (Corner, Side, Top, End) are the plan, front and end of the timber, with the part's ghost laid over the wood. The wood is
// the block's cells as little squares (no surface smoothing, no grain shader): a face of the block, lit by its slant.
import { SOLID, EYE_CELLS, VIEWS, woodBox, inKnot, idx } from "./slipway-carve.js";

const DEG = Math.PI / 180;
const MIN_FIT = 0.3, MAX_FIT = 8;                       // how far the view may close in on, or draw back from, the framing
const THEMES = {                                        // the bench behind the timber and the ghost's colour, as slipway-3d.js's skins have them
  codex: { day: { bg: "#4a3524", ghost: "#1c2a34" }, night: { bg: "#1e160f", ghost: "#e2b865" } },
  office: { day: { bg: "#bfc3c8", ghost: "#0f6cbd" }, night: { bg: "#1b1d20", ghost: "#479ef5" } },
};
const EARLY = [217, 176, 122], LATE = [156, 106, 60], KNOT = [53, 25, 10], GOUGE = [168, 56, 43];   // the wood's colours, as in the shader
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------- the camera (pure: tests/slipway-flat.mjs) ----------
/** Where the camera stands (cells) for a heading and height (radians) round the point it looks at. */
export const eyeOf = (look, az, el) => [look[0] + EYE_CELLS * Math.cos(el) * Math.sin(az), look[1] + EYE_CELLS * Math.sin(el), look[2] + EYE_CELLS * Math.cos(el) * Math.cos(az)];
/** The camera's axes: f (the way it looks), r (right on the screen) and u (up). */
export function axesOf(look, az, el) {
  const eye = eyeOf(look, az, el), f = norm(sub(look, eye)), r = norm(cross(f, [0, 1, 0]));
  return { eye, f, r, u: cross(r, f) };
}
/** A point of the block (cells) on the screen: [x, y] pixels from the canvas's top left, and its distance along the view. `pxCell` is pixels a cell is across at the middle of the wood. */
export function projectOf(cam, W, H, pxCell, p) {
  const q = sub(p, cam.eye), z = dot(q, cam.f);
  return [W / 2 + pxCell * EYE_CELLS * (dot(q, cam.r) / z), H / 2 - pxCell * EYE_CELLS * (dot(q, cam.u) / z), z];
}
/** The ray under a point of the canvas (pixels from its top left), in cells: { o, d }. The inverse of projectOf. */
export function rayOf(cam, W, H, pxCell, x, y) {
  const a = (x - W / 2) / (pxCell * EYE_CELLS), b = -(y - H / 2) / (pxCell * EYE_CELLS);
  return { o: [...cam.eye], d: norm([cam.f[0] + cam.r[0] * a + cam.u[0] * b, cam.f[1] + cam.r[1] * a + cam.u[1] * b, cam.f[2] + cam.r[2] * a + cam.u[2] * b]) };
}
/** The faces of a set of cells that have air beside them: [{ c (the cell's middle), a (axis), s (-1 or 1) }]. `solid(i, j, k)` says whether a cell is in the set. */
export function facesOf(nx, ny, nz, solid) {
  const out = [], dims = [nx, ny, nz];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!solid(i, j, k)) continue;
    for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
      const p = [i, j, k]; p[a] += s;
      if (p[a] < 0 || p[a] >= dims[a] || !solid(p[0], p[1], p[2])) out.push({ c: [i + 0.5, j + 0.5, k + 0.5], a, s, cell: [i, j, k] });
    }
  }
  return out;
}

export function createFlatBench(host) {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d"), layer = document.createElement("canvas"), lx = layer.getContext("2d");
  if (!ctx || !lx) throw new Error("no 2D canvas");
  canvas.className = "sw-gl";
  host.prepend(canvas);
  let b = null, W = 1, H = 1, az = -30 * DEG, el = 26 * DEG, pxCell = 8, fit = 8, look = [0, 0, 0], cam = axesOf(look, az, el);
  let wood = [], ghostFaces = [], cutFaces = null, cutKind = "ok", guidePoly = null, guideKind = "ok", cursorAt = null, ghostOn = true, revealing = null;
  let skin = skinNow();
  const anims = [], flying = [], dust = [];
  let frameId = 0, dead = false;

  function skinNow() {
    const root = document.documentElement, theme = THEMES[root.dataset.theme] ? root.dataset.theme : "codex";
    const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
    return { night, ...THEMES[theme][night ? "night" : "day"] };
  }
  const pose = () => { cam = axesOf(look, az, el); };
  const proj = p => projectOf(cam, W, H, pxCell, p);

  // ---------- the block ----------
  const present = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < b.nx && j < b.ny && k < b.nz && b.d[idx(b, i, j, k)] >= SOLID;
  /** A face's colour in the wood: early and late wood in stripes along the grain, a knot dark, a face the part would be cut into oxblood. */
  function tone(f) {
    const [x, y, z] = f.c, ax = b.grain || 0, across = ax === 0 ? y * 0.9 + z * 0.35 : ax === 1 ? z * 0.9 + x * 0.35 : x * 0.9 + y * 0.35;
    let late = 0.5 + 0.5 * Math.sin(across + 0.8 * Math.sin((ax === 0 ? x : ax === 1 ? y : z) * 0.12)), c = EARLY.map((e, n) => e + (LATE[n] - e) * late * 0.55);
    const h = Math.sin(f.cell[0] * 12.9898 + f.cell[1] * 78.233 + f.cell[2] * 37.719) * 43758.5453, grain = 0.94 + 0.1 * (h - Math.floor(h));
    if (inKnot(b, x, y, z)) c = c.map((v, n) => v + (KNOT[n] - v) * 0.85);
    if (b.target && b.target[idx(b, ...f.cell)] < -0.7) c = c.map((v, n) => v + (GOUGE[n] - v) * 0.6);   // the part's own wood, cut into
    return c.map(v => v * grain);
  }
  function setBlock(next) {
    b = next;
    refresh(); replaced(false);
    view("corner", false);
  }
  /** The block's surface again, from its cells (after a stroke). */
  function refresh() {
    if (!b) return;
    wood = facesOf(b.nx, b.ny, b.nz, (i, j, k) => present(i, j, k));
    for (const f of wood) f.rgb = tone(f);
    invalidate();
  }
  /** The part's outline laid somewhere else in the block (slid or turned end for end, before the first cut). */
  function replaced(redraw = true) {
    if (!b?.target) { ghostFaces = []; return; }
    ghostFaces = facesOf(b.nx, b.ny, b.nz, (i, j, k) => b.target[idx(b, i, j, k)] < 0);
    if (redraw) refresh();
  }

  // ---------- the camera: it circles the block ----------
  /** The wood that is left, framed from a pose: the look-at point and how many pixels a cell is across so it fills the canvas. */
  function framing(a, e) {
    const w = woodBox(b), mid = [(w[0] + w[3]) / 2, (w[1] + w[4]) / 2, (w[2] + w[5]) / 2], c = axesOf(mid, a, e);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const x of [w[0], w[3]]) for (const y of [w[1], w[4]]) for (const z of [w[2], w[5]]) {
      const [px, py] = projectOf(c, 1, 1, 1 / EYE_CELLS, [x, y, z]);                 // (a unit canvas, a cell a pixel wide: so the numbers are the size on the screen, over the distance)
      u0 = Math.min(u0, px); u1 = Math.max(u1, px); v0 = Math.min(v0, py); v1 = Math.max(v1, py);
    }
    return { look: mid, pxCell: Math.min(W / ((u1 - u0) * 1.14), H / ((v1 - v0) * 1.14)) / EYE_CELLS };
  }
  /** A named view (corner, side, top, end), eased to over a third of a second. */
  function view(name, animate = true) { const [a, e] = VIEWS[name]; ease(a * DEG, e * DEG, animate); }
  function ease(toAz, toEl, animate = true) {
    revealing = null;
    const to = framing(toAz, toEl), from = { az, el, pxCell, look: [...look] }, t0 = performance.now();
    let da = toAz - az; da = Math.atan2(Math.sin(da), Math.cos(da));
    fit = to.pxCell;
    if (!animate) { az = toAz; el = toEl; pxCell = to.pxCell; look = to.look; pose(); invalidate(); return; }
    go(t => {
      const u = Math.min(1, (t - t0) / 360), k = u * u * (3 - 2 * u);
      az = from.az + da * k; el = from.el + (toEl - from.el) * k; pxCell = from.pxCell + (to.pxCell - from.pxCell) * k;
      look = from.look.map((v, n) => v + (to.look[n] - v) * k);
      pose();
      return u < 1;
    });
  }
  /** Frames the wood that is left from where the camera is (after a saw cut takes a piece away). */
  const reframe = () => { if (b) ease(az, el); };
  /** Turns the camera round the block by a drag (pixels), and nearer or further by a pinch (a factor). */
  function orbit(dx, dy, zoom = 1) {
    revealing = null;
    az -= dx * 0.008;
    el = Math.max(0, Math.min(VIEWS.top[1] * DEG, el + dy * 0.008));
    for (const snap of [0, 45, 90, 135, 180, -45, -90, -135]) if (Math.abs(Math.atan2(Math.sin(az - snap * DEG), Math.cos(az - snap * DEG))) < 3 * DEG) az = snap * DEG;
    for (const snap of [0, VIEWS.top[1]]) if (Math.abs(el - snap * DEG) < 3 * DEG) el = snap * DEG;
    pxCell = Math.max(fit * MIN_FIT, Math.min(fit * MAX_FIT, pxCell * zoom));
    pose();
    invalidate();
  }
  function resize() {
    const r = host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    for (const c of [canvas, layer]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (b) { const f = framing(az, el); look = f.look; pxCell = fit = f.pxCell; pose(); }
    invalidate();
  }

  // ---------- pointing ----------
  const ray = (px, py) => { const r = canvas.getBoundingClientRect(); return rayOf(cam, W, H, pxCell, px - r.left, py - r.top); };
  const eye = () => [...cam.eye];
  const forward = () => [...cam.f];

  // ---------- what is shown over the wood ----------
  function setCursor(p, n, r) { cursorAt = p ? { p, n, r } : null; invalidate(); }
  function setGuide(poly, kind = "ok") { guidePoly = poly && poly.length >= 3 ? poly : null; guideKind = kind; invalidate(); }
  /** The wood a use would take (a grid of how much of each cell goes, 0..255), tinted `kind` ("ok" or "bad"); none clears it. */
  function setCut(grid, kind = "ok") {
    cutFaces = null; cutKind = kind;
    if (grid) {
      const go_ = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < b.nx && j < b.ny && k < b.nz && grid[idx(b, i, j, k)] >= 96;
      const faces = facesOf(b.nx, b.ny, b.nz, go_);
      if (faces.length) cutFaces = faces;
    }
    invalidate();
  }
  /** A saw's offcut (the wood it took, as a grid) falls away from where it was cut and is gone. The wood is already gone from the block. */
  function offcut(grid, away) {
    const faces = facesOf(b.nx, b.ny, b.nz, (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < b.nx && j < b.ny && k < b.nz && grid[idx(b, i, j, k)] >= 96);
    if (!faces.length || reducedMotion()) return;
    for (const f of faces) f.rgb = tone(f);
    flying.push({ faces, away, t0: performance.now() });
    go(t => { while (flying.length && t - flying[0].t0 > 620) flying.shift(); return flying.length > 0; });
  }
  /** Pieces thrown from points (cells): kind "dust" or "shave", away along `up`. A few specks that fall and fade. */
  function throwChips(points, kind, up = [0, 1, 0]) {
    if (!points?.length || reducedMotion()) return;
    const n = kind === "shave" ? 5 : 9, t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const p = points[Math.floor(Math.random() * points.length)];
      dust.push({ p: [...p], v: [up[0] * (50 + Math.random() * 90) + (Math.random() - 0.5) * 90, up[1] * (50 + Math.random() * 90) + 70 + Math.random() * 80, up[2] * (50 + Math.random() * 90) + (Math.random() - 0.5) * 90], t0, life: 0.5 + Math.random() * 0.4, shave: kind === "shave" });
    }
    go(t => { for (let i = dust.length - 1; i >= 0; i--) if ((t - dust[i].t0) / 1000 > dust[i].life) dust.splice(i, 1); return dust.length > 0; });
  }
  const reducedMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  /** The part freed: the part alone, turning slowly, for a few seconds. */
  function setReveal(on) {
    if (!on) { revealing = null; invalidate(); return; }
    cursorAt = null; guidePoly = null; cutFaces = null;
    const t0 = performance.now(), az0 = az;
    revealing = t => { az = az0 - Math.min((t - t0) / 1000, 5) * 0.55; pose(); return revealing !== null && t - t0 < 5000; };
    go(revealing);
  }

  // ---------- drawing, only while something moves ----------
  function invalidate() { if (!frameId && !dead) frameId = requestAnimationFrame(frame); }
  function go(fn) { anims.push(fn); invalidate(); }
  function frame() {
    frameId = 0;
    const t = performance.now();
    for (let i = anims.length - 1; i >= 0; i--) if (!anims[i](t)) anims.splice(i, 1);
    draw(t);
    if (anims.length) invalidate();
  }
  /** The faces turned to the camera, the farthest first. */
  function visible(faces) {
    const out = [];
    for (const f of faces) {
      const n = AXES[f.a], q = sub(f.c, cam.eye);
      if ((n[0] * q[0] + n[1] * q[1] + n[2] * q[2]) * f.s >= 0) continue;           // facing away
      out.push({ f, z: dot(q, q) });
    }
    return out.sort((p, q) => q.z - p.z);
  }
  /** The corners of a face (a unit square on its cell's side), as points of the block. */
  function corners(f, off = [0, 0, 0]) {
    const a = f.a, u = (a + 1) % 3, v = (a + 2) % 3, out = [];
    for (const [du, dv] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      const p = [f.c[0] + off[0], f.c[1] + off[1], f.c[2] + off[2]];
      p[a] += 0.5 * f.s; p[u] += du; p[v] += dv;
      out.push(p);
    }
    return out;
  }
  function path(c, pts) { c.beginPath(); pts.forEach((p, i) => { const [x, y] = proj(p); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); }
  const L = () => norm([-cam.r[0] * 0.4 + cam.u[0] * 0.75 - cam.f[0] * 0.6, -cam.r[1] * 0.4 + cam.u[1] * 0.75 - cam.f[1] * 0.6, -cam.r[2] * 0.4 + cam.u[2] * 0.75 - cam.f[2] * 0.6]);   // the light: over the viewer's shoulder, so the face you look at is lit
  function paintFaces(c, list, color, off) {
    for (const { f } of list) { path(c, corners(f, off)); c.fillStyle = color(f); c.fill(); }
  }
  function draw(now) {
    ctx.fillStyle = skin.bg; ctx.fillRect(0, 0, W, H);
    if (!b) return;
    const light = L(), edge = skin.night ? "rgba(0,0,0,.2)" : "rgba(60,35,15,.2)";
    const shade = f => { const n = AXES[f.a].map(v => v * f.s), k = 0.55 + 0.45 * Math.max(0, dot(n, light)); return `rgb(${f.rgb.map(v => Math.min(255, Math.round(v * k * (skin.night ? 0.8 : 1)))).join(",")})`; };
    const show = revealing ? wood.filter(f => b.target && b.target[idx(b, ...f.cell)] < 0.5) : wood;      // freed: only the part
    const list = visible(show);
    ctx.lineWidth = 0.5; ctx.strokeStyle = edge;
    for (const { f } of list) { path(ctx, corners(f)); ctx.fillStyle = shade(f); ctx.fill(); ctx.stroke(); }
    for (const fl of flying) {                                                      // an offcut falling away
      const s = (now - fl.t0) / 1000, off = [fl.away[0] * s * 150, fl.away[1] * s * 100 - s * s * 2600, fl.away[2] * s * 150];
      ctx.globalAlpha = Math.max(0, 1 - s * 1.6);
      for (const { f } of visible(fl.faces)) { path(ctx, corners(f, off)); ctx.fillStyle = shade(f); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // the part's ghost and the wood a use would take, seen through the block: drawn on their own layer so overlapping faces don't add up
    const overlay = (faces, color, alpha) => {
      lx.clearRect(0, 0, W, H);
      paintFaces(lx, visible(faces), () => color);
      ctx.globalAlpha = alpha; ctx.drawImage(layer, 0, 0, W, H); ctx.globalAlpha = 1;
    };
    if (ghostOn && !revealing && ghostFaces.length) overlay(ghostFaces, skin.ghost, 0.3);
    if (cutFaces) overlay(cutFaces, cutKind === "ok" ? "#2f7d5b" : "#a8382b", 0.55);
    if (guidePoly) {                                                               // the sheet a saw would cut along
      path(ctx, guidePoly);
      ctx.fillStyle = { ok: "#2f7d5b", into: "#a8382b", nothing: "#8a8a8a" }[guideKind] || "#2f7d5b"; ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke();
    }
    if (cursorAt) {                                                                // a ring where the tool would touch
      const { p, n, r } = cursorAt, t1 = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = cross(n, t1), pts = [];
      for (let i = 0; i < 32; i++) { const a = (i / 32) * 2 * Math.PI; pts.push([0, 1, 2].map(k => p[k] + n[k] * 0.15 + (t1[k] * Math.cos(a) + t2[k] * Math.sin(a)) * r)); }
      path(ctx, pts); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.stroke(); ctx.globalAlpha = 0.12; ctx.fillStyle = "#fff"; ctx.fill(); ctx.globalAlpha = 1;
    }
    for (const d of dust) {                                                        // sawdust and shavings
      const s = (now - d.t0) / 1000, p = [d.p[0] + d.v[0] * s, d.p[1] + d.v[1] * s - 400 * s * s, d.p[2] + d.v[2] * s], [x, y] = proj(p);
      ctx.globalAlpha = Math.max(0, 1 - s / d.life); ctx.fillStyle = d.shave ? "#eed6a4" : "#e0c08a";
      ctx.fillRect(x - 1.5, y - 1.5, d.shave ? 6 : 3, 3); ctx.globalAlpha = 1;
    }
  }

  const sizeWatch = new ResizeObserver(resize), skinWatch = new MutationObserver(() => { skin = skinNow(); invalidate(); }), mq = matchMedia("(prefers-color-scheme: dark)"), onScheme = () => { skin = skinNow(); invalidate(); };
  sizeWatch.observe(host);
  skinWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  mq.addEventListener?.("change", onScheme);
  resize();

  return {
    canvas, setBlock, refresh, replaced, ray, eye, forward, orbit, view, offcut, reframe, redraw: invalidate,
    cursor: setCursor, guide: setGuide, cutGhost: setCut, throwChips, reveal: setReveal,
    angles: () => [az / DEG, el / DEG],
    set ghost(on) { ghostOn = on; invalidate(); },
    get busy() { return anims.length > 0; },
    project(x, y, z) { const [px, py] = proj([x, y, z]); return [px, py]; },
    flat: true,
    /** Lets go of the canvas (the player chose the 3D bench). */
    dispose() { dead = true; cancelAnimationFrame(frameId); sizeWatch.disconnect(); skinWatch.disconnect(); mq.removeEventListener?.("change", onScheme); canvas.remove(); },
  };
}
