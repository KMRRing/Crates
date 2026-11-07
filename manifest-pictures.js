// Manifest's 3D pictures: what manifest-art.js hands back when this device has WebGL. Each picture is a plain 2D canvas
// that the one shared renderer (manifest-3d.js) paints a scene into and that is copied at once, so a picture, once drawn,
// costs nothing, a page holds a single WebGL context, and the packages falling in, the empty quay a change round leaves,
// the water moving and the slow sway all play in the canvas, from script (no CSS animation to stall in a hidden box). Only
// what moves is drawn again: the packages in the air, an effect, the water.
//
// A package falls for LANDING (the engine's) from its moment: it drops, strikes, flattens a little, rebounds, settles
// (manifest-model.js, fall). A tarpaulined stack, the stack seen from behind, the which-stack's four are the same
// pictures, still. A turn is the engine's (the stack laid out turned, its packages lying the other way), so a quarter
// turn could be played as the stack's yaw 0 to 90 degrees, ending on that layout; it isn't, because turning the stack in
// front of the player shows what the all-at-once view hides and does the mental turn the turned question asks for.
import { boxFor, dropTimes, visibleSet, LANDING } from "./manifest-engine.js";
import { frameOf, iconFrame, layout, fall, yawOf, pieceKey, piecesNamed, joinBox } from "./manifest-model.js";
import { lensOf, projector, facesBy, swayAt, tapAt } from "./manifest-lens.js";
import { typeOf, codeOf } from "./manifest-rules.js";
import { hull } from "./manifest-shapes.js";
import { onPause } from "./menu.js";
import { deckAt } from "./manifest-harbour.js";
import { defaultIs3D } from "./mode3d.js";
import { load3d } from "./loading.js";

// three.js is 580 KB: the game waits for it (the page asks `ready` before it draws a picture) but not for long, and a
// device that can't run it plays the flat drawing from the start, never one that turns 3D halfway through
let GL = null, M = null;
let settleLoad = null;
// (Settings' 2D mode, battery saver: the flat drawing from the start, three.js not even fetched; this game keeps no choice of its own)
const loading = (defaultIs3D() ? load3d(import("./manifest-3d.js")) : Promise.reject(new Error("2D mode"))).then(m => { M = m; GL = m.createGL(); if (GL) warm(); }).catch(() => { GL = null; });
/** Resolves when the 3D drawing is up or has been given up on. */
export const ready = Promise.race([loading, new Promise(r => { settleLoad = setTimeout(r, 4000); })]).then(() => clearTimeout(settleLoad));
/** One package drawn small, so the shaders are compiled now, while the page waits, and not as the first stack falls. */
function warm() {
  const b = boxFor(0), frame = iconFrame(b);
  GL.draw({ X: 1, Y: 1, Z: 1, b, frame, cam: lensOf(frame, 1, 1, 1, b), opts: {},
    items: itemsOf(layout([[[1]]], 0, frame), { turns: 0 }) }, 32, 32, M.tokens());
}
/** Whether pictures are 3D now: not before WebGL is up, not once its context is lost. */
export const is3d = () => !!GL?.alive;

const node = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const REDUCED = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** How long the shipping takes: the pieces go up the crane's ropes aboard the cog, then the cog sails (a tap ends it). The intro is the drop's own time. */
export const OUT_MS = 1150;
const FX_MS = { away: OUT_MS, fade: 500, appear: 350 };
/** The harbour round the stack in the big pictures (the stack coming in, a change round): a margin of view box units on every side, so the crane, the cog and the town show. */
const PAD = 24;
const ease = u => u * u * (3 - 2 * u);
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
    if (frameMs > 28 && quality > 0.55 && [...live].some(p => p.drop || p.live)) { quality = Math.max(0.55, quality - 0.15); frameMs = 20; }
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
function drawInto(pic, into, spec = pic.spec, lifts = null, q = 1, anim = null) {
  const { width, height } = pic.canvas, w = Math.max(120, Math.round(width * q));
  const src = GL.draw(spec, w, Math.round(height * w / width), pic.tk, lifts, anim);
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
  if (fx?.kind === "away" && !spec.scene) {                  // lifts off and shrinks as it goes, as the flat drawing's does
    const e = p * p;
    ctx.translate(W / 2, H / 2 - H * 0.4 * e); ctx.scale(1 - 0.2 * e, 1 - 0.2 * e); ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = 1 - e;
  }
  if (fx?.kind === "fade" || fx?.kind === "appear") {   // the stack and its shadow cross-fade with the empty quay under them
    ctx.drawImage(pic.quay, 0, 0);
    ctx.globalAlpha = fx.kind === "fade" ? 1 - p : p;
  }
  ctx.drawImage(img, 0, 0);
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (spec.ring && !fx) ringOver(pic, k);
  const t = spec.label;
  if (t) {                                    // the tier a marked empty place is on, written on it
    const f = spec.frame;
    ctx.font = `800 ${17 * k}px system-ui, -apple-system, sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
    ctx.fillText(t.text, t.x * k, (t.y + f.room) * H / (f.H + f.room) + 6 * k);
  }
  pic.shownAt = now;
}
/** The marked piece's outline drawn over the picture, through whatever stands in front of it: a ring in the page's paper and ink
 *  (3 November 2026: "I can't see the marked piece in this one"). */
function ringOver(pic, k) {
  const { ctx, spec, tk } = pic, f = spec.frame, sy = pic.canvas.height / (f.H + f.room), at = ([x, y]) => [x * k, (y + f.room) * sy];
  ctx.save();
  ctx.beginPath();
  spec.ring.forEach((p, i) => { const [x, y] = at(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgb(${tk.yard})`; ctx.lineWidth = 7 * k; ctx.stroke();
  ctx.strokeStyle = `rgb(${tk.ink})`; ctx.lineWidth = 3.4 * k; ctx.stroke();
  ctx.restore();
}
/** What moves in the harbour at a moment: the water, the crane's wheel, the jib (over the stack while the cargo comes down, then swung away),
 *  the ropes, and, in the shipping, the cog. Returns the scene's anim and the pieces' lifts for the shipping (null otherwise). */
function animOf(pic, now) {
  const A = { time: now, wheelTurn: now / 240, swing: 1, shipAt: 0, sailed: 0, hang: false }, fx = pic.fx;
  if (pic.drop) { A.swing = 0; A.hang = true; return { A }; }
  if (fx?.kind === "away" && pic.spec.scene) {
    const p = clamp((now - fx.t0) / fx.ms, 0, 1), n = pic.spec.items.length, { sx, sy } = pic.out ??= outOf(pic);
    A.swing = p < 0.15 ? 1 - ease(p / 0.15) : p < 0.6 ? 0 : ease((p - 0.6) / 0.2);
    A.hang = true;
    A.shipAt = p < 0.6 ? 0 : ease((p - 0.6) / 0.4);
    A.sailed = clamp((p - 0.5) / 0.15, 0, 1);
    const [tx, ty, tz] = deckAt(sx), lifts = new Map();
    pic.out.order.forEach((it, r) => {
      const u = clamp((p - 0.1 - 0.28 * r / Math.max(1, n)) / 0.36, 0, 1), e = ease(u);
      lifts.set(it.key, { lift: 0, squash: 1, fade: u > 0.88 ? 1 - (u - 0.88) / 0.12 : 1, rope: u > 0 && u < 0.88,
        dx: (tx - it.box.cx) * e, dz: (tz - it.box.cz) * e, dy: (ty - it.box.cy) * e + Math.sin(Math.PI * e) * (1.1 + sy * 0.15), scale: 1 - 0.55 * e });
    });
    return { A, lifts };
  }
  const since = pic.landedAt != null ? now - pic.landedAt : 1e9;
  A.swing = ease(clamp(since / 700, 0, 1));
  return { A };
}
/** The shipping's order: the top tier goes first. */
function outOf(pic) {
  const { X, Y, Z, b, items } = pic.spec;
  return { sx: X * b.X, sz: Y * b.Y, sy: Z * b.H, b, order: items.slice().sort((a, c) => c.box.cy - a.box.cy || c.box.cx + c.box.cz - a.box.cx - a.box.cz) };
}
const swayOf = (pic, now) => (pic.sways ? { ...pic.spec, sway: swayAt(now) } : pic.spec);

/** One frame of a moving picture: packages in the air, then the effect, the sway and the water. */
function step(pic, now) {
  if (paused && pic.pausable) return;
  const { A, lifts: out } = animOf(pic, now);
  if (pic.drop) {
    const el = now - pic.t0, lifts = new Map();
    let done = true;
    for (const it of pic.spec.items) {
      const u = (el - pic.start[it.key]) / LANDING;
      if (u < 1) done = false;
      const f = fall(u);
      lifts.set(it.key, { ...f, rope: f.lift > 0.06 && f.fade > 0.3 });
    }
    show(pic, now, drawInto(pic, pic.full ??= copyOf(pic.canvas), swayOf(pic, now), done ? null : lifts, done ? 1 : quality, { ...A, hang: !done }));
    if (done) { pic.landed = true; pic.drop = false; pic.landedAt = now; }
    return;
  }
  if (out) {                                                    // the shipping: drawn in the scene each frame, to its end
    show(pic, now, drawInto(pic, pic.full ??= copyOf(pic.canvas), pic.spec, out, quality, A));
    if (now - pic.fx.t0 >= pic.fx.ms) { pic.fxShown = true; live.delete(pic); }
    return;
  }
  const running = pic.fx && now - pic.fx.t0 < pic.fx.ms;
  if (pic.live && now - pic.shownAt > 38) show(pic, now, drawInto(pic, pic.full ??= copyOf(pic.canvas), swayOf(pic, now), null, quality, A));
  else if (running) show(pic, now, pic.full);
  else if (pic.fx && !pic.fxShown) { show(pic, now, pic.full); pic.fxShown = true; }
  if (!running && !pic.live && (!pic.fx || pic.fxShown)) live.delete(pic);
}
/** An effect begins: the stack in its final state is kept, and the empty quay to go with it. */
function begin(pic, kind) {
  if (!GL?.alive) return;
  if (REDUCED()) kind = "none";
  if (kind === "away" && pic.spec.scene) {                      // the crane and the cog: played in the scene
    pic.drop = false; pic.landed = true; pic.live = false; pic.sways = false; pic.out = null;
    pic.fx = { kind, t0: performance.now(), ms: FX_MS[kind] };
    pic.fxShown = false;
    live.add(pic);
    wake();
    return;
  }
  settled(pic);
  if (kind === "fade" || kind === "appear") emptyQuay(pic);
  pic.drop = false; pic.landed = true; pic.live = false; pic.sways = false;
  pic.fx = kind === "none" ? null : { kind, t0: performance.now(), ms: FX_MS[kind] };
  pic.fxShown = false;
  if (!pic.fx) { show(pic, performance.now(), pic.full); return; }
  show(pic, pic.fx.t0, pic.full);
  live.add(pic);
  wake();
}
/** A tap on the picture: the cargo that is still coming down is down, and the shipping is over (the page moves on by its own timer). */
export function skip(panel) {
  const pic = panel?._pic;
  if (!pic || !GL?.alive) return;
  if (pic.drop) {
    pic.drop = false; pic.landed = true; pic.landedAt = performance.now() - 5000;
    show(pic, performance.now(), drawInto(pic, pic.full ??= copyOf(pic.canvas), swayOf(pic, performance.now()), null, 1, animOf(pic, performance.now()).A));
  } else if (pic.fx?.kind === "away" && pic.spec.scene) {
    pic.fx.t0 = performance.now() - pic.fx.ms;
  }
}
/** What happens to a stack leaving the quay or coming back: "away" (shipped), "fade" (a change round: the stack goes and
 *  the empty quay stays), "appear". */
export const playOut = (panel, kind) => begin(panel._pic, kind);

/** The scene's pieces for the layout's cells. A log is one mesh over two cells (a tree's type has no other): its low cell draws it, its high cell is only there
 *  to be tapped and to land with it. `named`: the piece keys to outline; `ringPiece`: the one picked out under tarpaulin. */
function itemsOf(cubes, o) {
  return cubes.map(c => {
    const piece = pieceKey(c), ringed = o.ringPiece != null && piece === o.ringPiece, long = !o.grey && c.half != null;
    return { key: c.key, piece, ware: o.grey ? (ringed ? M.LIT_WARE : 0) : typeOf(c.c), skip: long && c.half === 1,
      box: long && c.half === 0 ? joinBox(c.box, cubes.find(m => m.piece === c.piece && m.half === 1).box) : c.box,
      faces: c.faces, yaw: yawOf(c, o.turns, !!o.grey),
      dim: !!((o.highlight && typeOf(c.c) !== o.highlight) || (o.tier != null && c.z !== o.tier)),
      outline: ringed || (o.named?.has(piece) && o.markHidden !== piece) ? 2 : 0 };   // framed: every face, so one seen only from the side is marked too
  });
}

/** The picture for manifest-art.js's stage(cells, opts): { panel, drops }. */
export function stage3d(cells, opts) {
  const turns = opts.turns || 0, b = boxFor(turns), X = cells.length, Y = cells[0].length, Z = cells[0][0].length;
  const frame = frameOf(X, Y, Z, b, { ...opts, pad: opts.drop || opts.tap ? PAD : 0 }), tk = tokensNow();
  const markKey = opts.mark ? `${opts.mark.x},${opts.mark.y},${opts.mark.z}` : null;
  const visible = opts.blank || markKey ? visibleSet(cells, b) : null;
  const lens = lensOf(frame, X, Y, Z, b), proj = projector(lens);
  const cubes = layout(cells, turns, frame, (x, y, z, bx) => facesBy(proj, x, y, z, bx));
  // a marked, selected or ringed piece is marked whole: a long log by either of its cells
  const named = piecesNamed(cubes, [...(opts.marks || []), ...(opts.selected || []), ...(markKey ? [markKey] : [])]);
  const ringPiece = opts.ring ? pieceKey(cubes.find(c => c.key === opts.ring) || {}) : null;
  const drops = opts.drop ? (opts.times ? { times: opts.times, last: 0 } : dropTimes(cells, opts.drop)) : { times: {}, last: 0 };
  const items = opts.blank ? [] : itemsOf(cubes, { ...opts, turns, named, ringPiece, markHidden: markKey && visible && !visible.has(markKey) ? markKey : null });
  // a marked place with nothing to see there: its tile on the floor, with the tier named on it
  const hidden = !!opts.mark && (opts.blank || !visible.has(markKey));
  const tile = hidden ? { x: opts.mark.x, y: opts.mark.y } : null;
  const label = hidden ? (() => { const [x, y] = proj([(tile.x + 0.5) * b.X, 0, (tile.y + 0.5) * b.Y]); return { x, y, text: `tier ${opts.mark.z + 1}` }; })() : null;
  const ringFaces = ringPiece != null ? items.filter(it => it.piece === ringPiece).flatMap(it => Object.values(it.faces).flat()) : [];
  const ring = ringFaces.length ? hull(ringFaces) : null;                              // the piece's hexagon (a long log's, both cells'), drawn over the rest
  const spec = { X, Y, Z, b, frame, cam: lens, items, label, ring, scene: !opts.small, opts: { markTile: tile } };

  const panel = node("div", `mf-panel${opts.small ? " small" : ""}`);
  const canvas = node("canvas", `${opts.tap ? "tap" : ""}${opts.small ? "" : " scene"}`.trim());
  const total = frame.H + frame.room, w0 = opts.small ? 280 : 720;
  canvas.width = w0; canvas.height = Math.round(w0 * total / frame.W);
  canvas.style.setProperty("--aspect", frame.aspect.toFixed(3));
  canvas.style.aspectRatio = frame.aspect.toFixed(4);
  panel.appendChild(canvas);
  const pic = { canvas, ctx: canvas.getContext("2d"), spec, tk, born: performance.now(), t0: performance.now(), seen: false, pausable: !opts.times,
    live: !!opts.drop && !opts.small, sways: !!opts.drop && !opts.small, landedAt: null, out: null, drop: false, landed: true, fx: null, fxShown: false, start: {}, full: null, quay: null, ro: null, shownAt: 0 };
  panel._pic = pic;
  if (opts.tap) canvas.addEventListener("click", e => {
    const r = canvas.getBoundingClientRect(), piece = tapAt(proj, items, (e.clientX - r.left) / r.width * frame.W, (e.clientY - r.top) / r.height * total - frame.room);
    if (piece != null) opts.tap(piece);                                              // by what the picture draws there (a long log by its low cell, whichever half is tapped)
  });
  // drawn at a guess of the size it'll have, and again once the page has given it one (if that's very different)
  if (typeof ResizeObserver !== "undefined") {
    pic.ro = new ResizeObserver(() => {
      const css = canvas.clientWidth, want = css ? backing(css) : 0;
      if (!want || !GL?.alive || Math.abs(want - canvas.width) / canvas.width < 0.15) return;
      canvas.width = want; canvas.height = Math.round(want * total / frame.W);
      pic.full = pic.quay = null;
      if (pic.fx || pic.drop || pic.live) { settled(pic); if (pic.fx?.kind === "fade" || pic.fx?.kind === "appear") emptyQuay(pic); show(pic, performance.now(), pic.full); }
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
    if (pic.live) live.add(pic);
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
    const code = codeOf(ware), long = code !== ware, b = boxFor(0), frame = iconFrame(b, long), size = 96, cells = long ? [[[code]], [[code]]] : [[[code]]];   // a tree is its log: two cells along x
    const spec = { X: cells.length, Y: 1, Z: 1, b, frame, cam: lensOf(frame, cells.length, 1, 1, b), quay: false, opts: {},
      items: itemsOf(layout(cells, 0, frame), { turns: 0 }) };
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
