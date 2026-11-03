// Manifest's 3D pictures: what manifest-art.js hands back when this device has WebGL. Each picture is a plain 2D canvas
// that the one shared renderer (manifest-3d.js) paints a scene into and that is copied at once, so a picture, once drawn,
// costs nothing, a page holds a single WebGL context, and the packages falling in, the empty quay a change round leaves,
// the water lapping at the quay all play in the canvas, from script (no CSS animation to stall in a hidden box). Only
// what moves is drawn again: the packages in the air, an effect, the water.
//
// A package falls for LANDING (the engine's) from its moment: it drops, strikes, flattens a little, rebounds, settles
// (manifest-model.js, fall). A tarpaulined stack, the stack seen from behind, the which-stack's four are the same
// pictures, still. A turn is the engine's (the stack laid out turned, its packages lying the other way), so a quarter
// turn could be played as the stack's yaw 0 to 90 degrees, ending on that layout; it isn't, because turning the stack in
// front of the player shows what the all-at-once view hides and does the mental turn the turned question asks for.
import { boxFor, isoPoint, dropTimes, visibleSet, LANDING } from "./manifest-engine.js";
import { QUAY_DEPTH, frameOf, iconFrame, cameraOf, layout, packageAt, fall } from "./manifest-model.js";
import { onPause } from "./menu.js";

// three.js is 580 KB: the game waits for it (the page asks `ready` before it draws a picture) but not for long, and a
// device that can't run it plays the flat drawing from the start, never one that turns 3D halfway through
let GL = null, M = null;
let settleLoad = null;
const loading = import("./manifest-3d.js").then(m => { M = m; GL = m.createGL(); if (GL) warm(); }).catch(() => { GL = null; });
/** Resolves when the 3D drawing is up or has been given up on. */
export const ready = Promise.race([loading, new Promise(r => { settleLoad = setTimeout(r, 4000); })]).then(() => clearTimeout(settleLoad));
/** One package drawn small, so the shaders are compiled now, while the page waits, and not as the first stack falls. */
function warm() {
  const b = boxFor(0), frame = iconFrame(b);
  GL.draw({ X: 1, Y: 1, Z: 1, b, frame, cam: cameraOf(frame, 1, 1, 1, b), opts: {},
    items: layout([[[1]]], 0, frame).map(c => ({ key: c.key, ware: c.c, box: c.box, faces: c.faces, dim: false, outline: 0 })) }, 32, 32, M.tokens());
}
/** Whether pictures are 3D now: not before WebGL is up, not once its context is lost. */
export const is3d = () => !!GL?.alive;

const node = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const REDUCED = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const FX_MS = { away: 380, fade: 500, appear: 350 };
const live = new Set();                       // the pictures that are moving: drawn each frame while they are
let raf = 0, paused = false, tkMemo = null, tkAt = 0;
let lastTick = 0, frameMs = 16, quality = 1;     // quality: how big, of its final size, a falling stack is drawn (a slow phone draws smaller)
const tokensNow = () => { const t = performance.now(); if (!tkMemo || t - tkAt > 300) { tkMemo = M.tokens(); tkAt = t; } return tkMemo; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** A canvas's pixels for a width on the page, at most 2 to a CSS pixel. */
const backing = css => clamp(Math.round(css * Math.min(devicePixelRatio || 1, 2)), 150, 1800);

// the menu, the rules or the games screen open: a solo stack stands still (a table's clock doesn't stop)
onPause(() => { paused = true; }, ms => { paused = false; for (const pic of live) if (pic.pausable) { pic.t0 += ms; if (pic.fx) pic.fx.t0 += ms; } wake(); });

function wake() { if (!raf && live.size && !paused && !document.hidden) raf = requestAnimationFrame(tick); }
document.addEventListener("visibilitychange", wake);
function tick(now) {
  raf = 0;
  if (lastTick && now - lastTick < 250) {         // not after a pause: while packages fall, a phone that can't keep up draws them smaller
    frameMs = frameMs * 0.85 + (now - lastTick) * 0.15;
    if (frameMs > 28 && quality > 0.55 && [...live].some(p => p.drop)) { quality = Math.max(0.55, quality - 0.15); frameMs = 20; }
  }
  lastTick = now;
  for (const pic of live) {
    if (pic.canvas.isConnected) pic.seen = true;
    else if (pic.seen || now - pic.born > 4000) { retire(pic); continue; }      // taken off the page, or never put on it
    try { step(pic, now); } catch (e) { console.error(e); retire(pic); }
  }
  wake();
}
function retire(pic) { live.delete(pic); pic.ro?.disconnect(); pic.full = pic.quay = null; }

const copyOf = canvas => { const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height; return c; };
/** The scene drawn at the picture's size and copied now (the renderer's canvas holds it only until the next draw) into `into`. */
function drawInto(pic, into, spec = pic.spec, lifts = null, q = 1) {
  const { width, height } = pic.canvas, w = Math.max(120, Math.round(width * q));
  const src = GL.draw(spec, w, Math.round(height * w / width), pic.tk, lifts);
  if (into.width !== width || into.height !== height) { into.width = width; into.height = height; }
  const x = into.getContext("2d");
  x.clearRect(0, 0, width, height);
  x.drawImage(src, 0, 0, width, height);
  return into;
}
const settled = pic => drawInto(pic, pic.full ??= copyOf(pic.canvas));
const emptyQuay = pic => drawInto(pic, pic.quay ??= copyOf(pic.canvas), { ...pic.spec, items: [] });

/** Puts the picture on its canvas: the scene (or its copy), with the effect in progress, the water, a marked place's tier. */
function show(pic, now, img) {
  const { ctx, canvas, spec } = pic, W = canvas.width, H = canvas.height, k = W / spec.frame.W, fx = pic.fx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);
  const p = fx ? clamp((now - fx.t0) / fx.ms, 0, 1) : 1;
  if (fx?.kind === "away") {                  // lifts off and shrinks as it goes, as the flat drawing's does
    const e = p * p;
    ctx.translate(W / 2, H / 2 - H * 0.4 * e); ctx.scale(1 - 0.2 * e, 1 - 0.2 * e); ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = 1 - e;
  }
  if (pic.waves) waves(pic, now, k);
  if (fx?.kind === "fade" || fx?.kind === "appear") {   // the stack and its shadow cross-fade with the empty quay under them
    ctx.drawImage(pic.quay, 0, 0);
    ctx.globalAlpha = fx.kind === "fade" ? 1 - p : p;
  }
  ctx.drawImage(img, 0, 0);
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const t = spec.label;
  if (t) {                                    // the tier a marked empty place is on, written on it
    const f = spec.frame;
    ctx.font = `800 ${17 * k}px system-ui, -apple-system, sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
    ctx.fillText(t.text, t.x * k, (t.y + f.room) * H / (f.H + f.room) + 6 * k);
  }
  pic.shownAt = now;
}
/** A few strokes of water lapping at the quay's foot, drifting and breathing. */
function waves(pic, now, k) {
  const { b, X, Y, frame } = pic.spec, { ctx } = pic, [r, g, bl] = pic.tk.wave;
  const at = (x, y) => { const p = isoPoint(x, y, -QUAY_DEPTH, b), [vx, vy] = frame.to([p.sx, p.sy]); return [vx * k, (vy + frame.room) * pic.canvas.height / (frame.H + frame.room)]; };
  ctx.lineWidth = 1.5 * k; ctx.lineCap = "round";
  [[X * 0.3, Y], [X * 0.78, Y], [X, Y * 0.3], [X, Y * 0.78]].forEach(([x, y], i) => {
    const [px, py] = at(x, y), ph = i * 1.7, dx = Math.sin(now / 1100 + ph) * 3.5 * k, dy = Math.sin(now / 800 + ph * 1.3) * 1.2 * k;
    ctx.strokeStyle = `rgba(${r},${g},${bl},${(0.55 + 0.4 * Math.sin(now / 900 + ph)).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(px - 9 * k + dx, py + 7 * k + dy);
    ctx.quadraticCurveTo(px - 4.5 * k + dx, py + 3.5 * k + dy, px + dx, py + 7 * k + dy);
    ctx.quadraticCurveTo(px + 4.5 * k + dx, py + 10.5 * k + dy, px + 9 * k + dx, py + 7 * k + dy);
    ctx.stroke();
  });
}

/** One frame of a moving picture: packages in the air, then the effect, then the water. */
function step(pic, now) {
  if (paused && pic.pausable) return;
  if (pic.drop) {
    const el = now - pic.t0, lifts = new Map();
    let moving = false, done = true;
    for (const it of pic.spec.items) {
      const u = (el - pic.start[it.key]) / LANDING;
      if (u < 1) done = false;
      if (u > 0 && u < 1) moving = true;
      lifts.set(it.key, fall(u));
    }
    if (moving || (done && !pic.landed)) {
      show(pic, now, drawInto(pic, pic.full ??= copyOf(pic.canvas), pic.spec, done ? null : lifts, done ? 1 : quality));
      if (done) { pic.landed = true; pic.drop = false; }
    } else if (pic.waves && now - pic.shownAt > 45) show(pic, now, pic.full);
    return;
  }
  const running = pic.fx && now - pic.fx.t0 < pic.fx.ms;
  if (running || (pic.waves && now - pic.shownAt > 45)) show(pic, now, pic.full);
  else if (pic.fx && !pic.fxShown) { show(pic, now, pic.full); pic.fxShown = true; }
  if (!running && !pic.waves && (!pic.fx || pic.fxShown)) live.delete(pic);
}
/** An effect begins: the stack in its final state is kept, and the empty quay to go with it. */
function begin(pic, kind) {
  if (!GL?.alive) return;
  if (REDUCED()) kind = "none";
  settled(pic);
  if (kind === "fade" || kind === "appear") emptyQuay(pic);
  pic.drop = false; pic.landed = true;
  pic.fx = kind === "none" ? null : { kind, t0: performance.now(), ms: FX_MS[kind] };
  pic.fxShown = false;
  if (!pic.fx) { show(pic, performance.now(), pic.full); return; }
  show(pic, pic.fx.t0, pic.full);
  live.add(pic);
  wake();
}
/** What happens to a stack leaving the quay or coming back: "away" (shipped), "fade" (a change round: the stack goes and
 *  the empty quay stays), "appear". */
export const playOut = (panel, kind) => begin(panel._pic, kind);

/** The picture for manifest-art.js's stage(cells, opts): { panel, drops }. */
export function stage3d(cells, opts) {
  const turns = opts.turns || 0, b = boxFor(turns), X = cells.length, Y = cells[0].length, Z = cells[0][0].length;
  const frame = frameOf(X, Y, Z, b, opts), tk = tokensNow();
  const markKey = opts.mark ? `${opts.mark.x},${opts.mark.y},${opts.mark.z}` : null;
  const visible = opts.blank || markKey ? visibleSet(cells, b) : null;
  const outlined = new Set([...(opts.marks || []), ...(opts.selected || [])]);
  const drops = opts.drop ? (opts.times ? { times: opts.times, last: 0 } : dropTimes(cells, opts.drop)) : { times: {}, last: 0 };
  const items = opts.blank ? [] : layout(cells, turns, frame).map(c => {
    const ringed = opts.ring === c.key;
    return { key: c.key, ware: opts.grey ? (ringed ? 6 : 0) : c.c, box: c.box, faces: c.faces,
      dim: !!((opts.highlight && c.c !== opts.highlight) || (opts.tier != null && c.z !== opts.tier)),
      outline: ringed || (markKey === c.key && (!visible || visible.has(c.key))) || outlined.has(c.key) ? 2 : 0 };   // framed: every face, so one seen only from the side is marked too
  });
  // a marked place with nothing to see there: its tile on the floor, with the tier named on it
  const hidden = !!opts.mark && (opts.blank || !visible.has(markKey));
  const tile = hidden ? { x: opts.mark.x, y: opts.mark.y } : null;
  const label = hidden ? (() => { const p = isoPoint(tile.x + 0.5, tile.y + 0.5, 0, b), [x, y] = frame.to([p.sx, p.sy]); return { x, y, text: `tier ${opts.mark.z + 1}` }; })() : null;
  const spec = { X, Y, Z, b, frame, cam: cameraOf(frame, X, Y, Z, b), items, label, opts: { markTile: tile } };

  const panel = node("div", `mf-panel${opts.small ? " small" : ""}`);
  const canvas = node("canvas", opts.tap ? "tap" : "");
  const total = frame.H + frame.room, w0 = opts.small ? 280 : 720;
  canvas.width = w0; canvas.height = Math.round(w0 * total / frame.W);
  canvas.style.setProperty("--aspect", frame.aspect.toFixed(3));
  canvas.style.aspectRatio = frame.aspect.toFixed(4);
  panel.appendChild(canvas);
  const pic = { canvas, ctx: canvas.getContext("2d"), spec, tk, born: performance.now(), t0: performance.now(), seen: false, pausable: !opts.times,
    waves: !!opts.drop && !opts.small, drop: false, landed: true, fx: null, fxShown: false, start: {}, full: null, quay: null, ro: null, shownAt: 0 };
  panel._pic = pic;
  if (opts.tap) canvas.addEventListener("click", e => {
    const r = canvas.getBoundingClientRect(), key = packageAt(items, (e.clientX - r.left) / r.width * frame.W, (e.clientY - r.top) / r.height * total - frame.room);
    if (key) opts.tap(key);
  });
  // drawn at a guess of the size it'll have, and again once the page has given it one (if that's very different)
  if (typeof ResizeObserver !== "undefined") {
    pic.ro = new ResizeObserver(() => {
      const css = canvas.clientWidth, want = css ? backing(css) : 0;
      if (!want || !GL?.alive || Math.abs(want - canvas.width) / canvas.width < 0.15) return;
      canvas.width = want; canvas.height = Math.round(want * total / frame.W);
      pic.full = pic.quay = null;
      if (pic.fx || pic.drop || pic.waves) { settled(pic); if (pic.fx?.kind === "fade" || pic.fx?.kind === "appear") emptyQuay(pic); show(pic, performance.now(), pic.full); }
      else show(pic, performance.now(), GL.draw(spec, canvas.width, canvas.height, tk));
    });
    pic.ro.observe(canvas);
  }
  if (opts.drop && items.length && !REDUCED()) {  // packages fall in, each from its own moment, the quay there before them
    pic.drop = true; pic.landed = false;
    for (const it of items) pic.start[it.key] = (drops.times[it.key] ?? 0) - (opts.since || 0);
    pic.t0 = performance.now();
    show(pic, pic.t0, drawInto(pic, pic.full = copyOf(canvas), spec, new Map(items.map(it => [it.key, fall(0)]))));
    live.add(pic);
  } else if (opts.drop) {
    show(pic, performance.now(), drawInto(pic, pic.full = copyOf(canvas)));
    if (pic.waves) live.add(pic);
  } else {
    show(pic, performance.now(), GL.draw(spec, canvas.width, canvas.height, tk));
  }
  if (opts.appear) begin(pic, "appear");
  wake();
  return { panel, drops };
}

// the small package beside an answer, drawn once per ware and copied
const ICONS = new Map();
export function icon3d(ware) {
  const tk = tokensNow(), key = `${ware}|${tk.key}`;
  let src = ICONS.get(key);
  if (!src) {
    const b = boxFor(0), frame = iconFrame(b), size = 96;
    const spec = { X: 1, Y: 1, Z: 1, b, frame, cam: cameraOf(frame, 1, 1, 1, b), quay: false, opts: {},
      items: layout([[[ware]]], 0, frame).map(c => ({ key: c.key, ware: c.c, box: c.box, faces: c.faces, dim: false, outline: 0 })) };
    src = document.createElement("canvas"); src.width = src.height = size;
    src.getContext("2d").drawImage(GL.draw(spec, size, size, tk), 0, 0);
    ICONS.set(key, src);
  }
  const c = document.createElement("canvas");
  c.className = "mf-icon"; c.width = c.height = src.width;
  c.setAttribute("aria-hidden", "true");
  c.getContext("2d").drawImage(src, 0, 0);
  return c;
}
