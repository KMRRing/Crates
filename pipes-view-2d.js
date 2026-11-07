// Gears: the board as a flat SVG (4 November 2026): the battery-saver view and the reference for what a frame means (docs/pipes-contract.md).
// A square is 60 units in an SVG whose viewBox is the plate in squares with a margin of 4. Every wheel is a node of the engine's graph, drawn
// whole with all its teeth: the module (tooth size) is its metal, the layer a soft shadow and pips on the hub, the engine's turn an
// arrow, and the engine's exact speed its pace: each wheel's animation lasts T0 / |omega|, and every wheel counts from one start (`epoch`),
// which is what keeps meshed teeth meshed. No SVG filters (Safari blurs them). The view draws from the frame only and never calls the engine.
import { el, turnArrow } from "./pipes-draw.js";
import { shapeOf, radius, rootR, tipR, CELL } from "./pipes-gear-shapes.js";
import * as F from "./pipes-gear-frac.js";

const PAD = 4, SLOTS = 8, rad = a => a * Math.PI / 180;
const pt = (r, a) => `${(r * Math.cos(rad(a))).toFixed(2)} ${(r * Math.sin(rad(a))).toFixed(2)}`;
const cache = new Map();
/** The outline of a wheel of n teeth at module m: trapezoid teeth rooted 0.72 m inside the pitch circle and tipped 0.64 m outside it. */
export function outline(n, m, inner = false) {
  const key = `${n}.${m}.${inner}`;
  if (cache.has(key)) return cache.get(key);
  const r = radius(m, n), root = rootR(m, n), tip = tipR(m, n), pitch = 360 / n, w0 = pitch * 0.3, w1 = pitch * 0.15;
  let d;
  if (!inner) {
    d = `M${pt(root, -w0)}`;
    for (let k = 0; k < n; k++) { const a = k * pitch; d += `L${pt(tip, a - w1)}L${pt(tip, a + w1)}L${pt(root, a + w0)}A${root} ${root} 0 0 1 ${pt(root, a + pitch - w0)}`; }
    d += "Z";
  } else {
    // a ring: the teeth point inwards from the rim at r + 0.7 m
    const out = r + 1.6 * m;
    d = `M${out} 0A${out} ${out} 0 1 1 ${-out} 0A${out} ${out} 0 1 1 ${out} 0ZM${pt(r + 0.64 * m, -w0)}`;
    for (let k = 0; k < n; k++) { const a = k * pitch; d += `L${pt(r - 0.72 * m, a - w1)}L${pt(r - 0.72 * m, a + w1)}L${pt(r + 0.64 * m, a + w0)}A${r + 0.64 * m} ${r + 0.64 * m} 0 0 1 ${pt(r + 0.64 * m, a + pitch - w0)}`; }
    d += "Z";
  }
  cache.set(key, d);
  return d;
}

/** The angle of every wheel of a piece so that meshed wheels interleave: for tiles and ghosts, which have no engine behind them. */
export function shapePhases(sh) {
  const ph = Array(sh.wheels.length).fill(null);
  const pairs = [...sh.mesh, ...sh.wheels.flatMap((w, i) => sh.wheels.map((o, j) => (i < j && w.a === o.a ? [i, j, "rigid"] : null)).filter(Boolean))];
  for (let s = 0; s < sh.wheels.length; s++) {
    if (ph[s] !== null) continue;
    ph[s] = 0;
    for (let again = true; again;) {
      again = false;
      for (const [u, v, kind] of pairs) for (const [a, b] of [[u, v], [v, u]]) {
        if (ph[a] === null || ph[b] !== null) continue;
        again = true;
        if (kind === "rigid") { ph[b] = ph[a]; continue; }
        const A = sh.wheels[a], B = sh.wheels[b], th = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI, pu = 360 / A.n, pv = 360 / B.n;
        const fu = ((((th - ph[a]) / pu) % 1) + 1) % 1, fv = ((0.5 - fu) % 1 + 1) % 1;
        ph[b] = th + 180 - pv * fv;
      }
    }
  }
  return ph;
}

/**
 * One wheel at (x, y) in the group g. opts: dir (0 cw, 1 ccw, null unknown), phase, id (gear id, for the board's animation), skin ("", "barrel",
 * "sink", "pin"), jam, clash, driven, shadow (layer offset), faded, showN, ring.
 */
export function drawWheel(g, w, o = {}) {
  const { x, y, n, m, layer: l } = w, r = radius(m, n), root = rootR(m, n);
  const out = el("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})`, class: `gear m${m} l${l} ${o.skin || ""}${o.jam ? " jam" : ""}${o.clash ? " clash" : ""}${o.faded ? " faded" : ""}${o.driven === false ? " idle" : ""}` }, g);
  if (l > 1 && !o.ring) el("path", { d: outline(n, m), class: "g-shadow", transform: `translate(${(1.4 * (l - 1)).toFixed(1)} ${(1.6 * (l - 1)).toFixed(1)})` }, out);
  const spin = el("g", { class: `spin${o.dir === null || o.dir === undefined ? "" : o.dir ? " ccw" : " cw"}`, "data-n": n, ...(o.id !== undefined ? { "data-id": o.id } : {}) }, out);
  const body = el("g", { transform: `rotate(${(o.phase || 0).toFixed(2)})` }, spin);
  el("path", { d: outline(n, m, !!o.ring), class: "g-body", "fill-rule": "evenodd" }, body);
  const hub = Math.max(2.4, Math.min(6, r * 0.26));
  if (o.skin === "barrel") {
    let d = "M0 0";
    for (let t = 0; t <= 5.2 * Math.PI; t += 0.25) d += `L${((root * 0.1 + t * root * 0.075) * Math.cos(t)).toFixed(2)} ${((root * 0.1 + t * root * 0.075) * Math.sin(t)).toFixed(2)}`;
    el("path", { d, class: "g-spring" }, body);
  } else if (!o.ring && n >= 6) {
    const rim = root - Math.max(2.6, m * 0.9);
    el("circle", { r: rim.toFixed(2), class: "g-rim" }, body);
    const holes = n > 8 ? 5 : 3, hr = Math.max(1.6, rim * 0.2), at = rim * 0.6;
    for (let k = 0; k < holes; k++) el("circle", { cx: (at * Math.cos(rad(k * 360 / holes - 90))).toFixed(2), cy: (at * Math.sin(rad(k * 360 / holes - 90))).toFixed(2), r: hr.toFixed(2), class: "g-hole" }, body);
  }
  if (!o.ring) {
    el("circle", { r: hub.toFixed(2), class: "g-hub" }, body);
    el("circle", { r: (hub * 0.42).toFixed(2), class: "g-jewel" }, body);
  }
  if (o.showN) {
    const t = el("text", { y: (hub * 0.5 + 0.5).toFixed(1), class: "g-n", "text-anchor": "middle", "font-size": Math.max(5, Math.min(8, r * 0.5)).toFixed(1) }, out);
    t.textContent = n;
  } else if (o.dir !== null && o.dir !== undefined && !o.noArrow && !o.ring && o.skin !== "barrel") turnArrow(out, 0, 0, o.dir, r > 17 ? 10 : r > 11 ? 6.6 : 5, "g-turn on");
  if (o.pips && l >= 1 && !o.ring) for (let k = 0; k < l; k++) el("circle", { cx: ((k - (l - 1) / 2) * 3.2).toFixed(1), cy: (hub + 3.4).toFixed(1), r: 1.1, class: "g-pip" }, out);
  return out;
}

/** A shape's wheels at (ox, oy), for tiles, ghosts and the hint. */
export function drawShape(g, sh, o = {}) {
  const ph = shapePhases(sh), grp = el("g", { transform: `translate(${o.ox || 0} ${o.oy || 0})`, class: o.cls || "" }, g);
  sh.wheels.map((w, i) => ({ w, i })).sort((a, b) => a.w.l - b.w.l).forEach(({ w, i }) => drawWheel(grp, { ...w, layer: w.l }, { phase: ph[i], skin: o.skin, pips: o.pips, noArrow: true, ring: sh.ring?.some(([, v]) => v === i) }));
  return grp;
}

// ---------- the complications: flat pictures on the sink wheel ----------
const DIAL_R = 0.66;
function sinkArt(g, w, type, id) {
  const r = radius(w.m, w.n), d = Math.max(7, r * DIAL_R);
  const art = el("g", { transform: `translate(${w.x.toFixed(2)} ${w.y.toFixed(2)})`, class: `art ${type}` }, g);
  const dial = (rr, hands = true) => {
    el("circle", { r: rr, class: "g-dial" }, art);
    for (let k = 0; k < 12; k++) el("path", { d: `M${pt(rr * (k % 3 ? 0.78 : 0.68), k * 30)}L${pt(rr * 0.9, k * 30)}`, class: "g-tick" }, art);
    if (hands) {
      el("path", { d: `M0 ${rr * 0.1}V${-rr * 0.55}`, class: "g-hand hour", "data-hand": "hour", "data-id": id }, art);
      el("path", { d: `M0 ${rr * 0.14}V${-rr * 0.82}`, class: "g-hand minute", "data-hand": "minute", "data-id": id }, art);
    }
    el("circle", { r: 1.6, class: "g-jewel" }, art);
  };
  if (type === "seconds") { dial(d * 0.9, false); el("path", { d: `M0 ${d * 0.15}V${-d * 0.8}`, class: "g-hand sec", "data-hand": "second", "data-id": id }, art); el("circle", { r: 1.4, class: "g-jewel" }, art); }
  else if (type === "moon") {
    const disc = el("g", { class: "spin-art", "data-id": id, "data-art": "moon" }, art);
    el("circle", { r: d, class: "g-moon" }, disc);
    el("circle", { cx: d * 0.25, cy: -d * 0.1, r: d * 0.42, class: "g-moon-gold" }, disc);
    el("circle", { cx: d * 0.42, cy: -d * 0.2, r: d * 0.36, class: "g-moon-bg" }, disc);
    for (const [a, b] of [[-0.55, -0.5], [-0.3, 0.45], [0.5, 0.55]]) el("circle", { cx: d * a, cy: d * b, r: 0.9, class: "g-star" }, disc);
  } else if (type === "escape") {
    // the escape wheel is the sink wheel; beside it the balance swings
    const bal = el("g", { transform: `translate(${(r * 0.35).toFixed(1)} ${(-r * 0.2).toFixed(1)})`, class: "balance" }, art);
    const swing = el("g", { class: "swing" }, bal);
    el("circle", { r: d * 0.55, class: "g-balance" }, swing);
    el("path", { d: `M${-d * 0.55} 0H${d * 0.55}M0 ${-d * 0.55}V${d * 0.55}`, class: "g-spoke" }, swing);
    let sp = "M0 0";
    for (let t = 0; t < 6 * Math.PI; t += 0.3) sp += `L${(t * d * 0.07 * Math.cos(t)).toFixed(2)} ${(t * d * 0.07 * Math.sin(t)).toFixed(2)}`;
    el("path", { d: sp, class: "g-hairspring" }, swing);
  } else if (type === "tourbillon") {
    const cage = el("g", { class: "spin-art", "data-id": id, "data-art": "cage" }, art);
    el("circle", { r: d * 0.85, class: "g-cage" }, cage);
    for (let k = 0; k < 3; k++) el("circle", { cx: (d * 0.85 * Math.cos(rad(k * 120 - 90))).toFixed(2), cy: (d * 0.85 * Math.sin(rad(k * 120 - 90))).toFixed(2), r: 1.8, class: "g-post" }, cage);
    el("circle", { r: d * 0.3, class: "g-balance" }, cage);
  } else if (type === "chime") {
    const cyl = el("g", { class: "spin-art", "data-id": id, "data-art": "cyl" }, art);
    el("circle", { r: d * 0.8, class: "g-cyl" }, cyl);
    for (let k = 0; k < 7; k++) el("circle", { cx: (d * 0.6 * Math.cos(rad(k * 51))).toFixed(2), cy: (d * 0.6 * Math.sin(rad(k * 51))).toFixed(2), r: 1.1, class: "g-pin" }, cyl);
  } else if (type === "date") {
    el("circle", { r: d * 0.52, class: "g-dial" }, art);
    el("rect", { x: -d * 0.28, y: -d * 0.9, width: d * 0.56, height: d * 0.32, rx: 1, class: "g-window" }, art);
    for (let k = 0; k < 12; k++) el("path", { d: `M${pt(d * 0.38, k * 30)}L${pt(d * 0.48, k * 30)}`, class: "g-tick" }, art);
  } else dial(d);
  return art;
}

// ---------- the view ----------
const STEP = 70;       // ms between squares as a solved train starts turning
const IDLE_MS = 40000; // a solved movement stops turning after this long, as a battery saver; a tap wakes it
const T = CELL;

export function createView({ board, onGesture, onLost } = {}) {
  void onLost;
  const view = { kind: "2d", caps: { explode: false, tilt: false } };
  let plan = null, svg = null, gGround = null, gWheels = null, gTop = null, chips = null, last = null;
  let motion = true, focus = null, showN = false, epoch = 0, runUpTo = 0, runTimer = 0, idleTimer = 0, asleep = false, layered = false;
  let prevLaid = null;

  const cellXY = c => [(c % plan.cols) * T, Math.floor(c / plan.cols) * T];
  // The picture's box in plate units: the plate with a margin, or for a round plate (voids in its corners) the circle that holds its squares.
  let vb = { x: -PAD, y: -PAD, w: 0, h: 0 }, rim = 0;
  const boxOf = p => {
    const w = p.cols * T, h = p.rows * T, round = p.terrain.includes("void");
    if (!round) return { box: { x: -PAD, y: -PAD, w: w + 2 * PAD, h: h + 2 * PAD }, rim: 0 };
    let R = 0;
    p.terrain.forEach((t, c) => {
      if (t === "void") return;
      const x0 = (c % p.cols) * T - w / 2, y0 = Math.floor(c / p.cols) * T - h / 2;
      R = Math.max(R, ...[[x0, y0], [x0 + T, y0], [x0, y0 + T], [x0 + T, y0 + T]].map(([x, y]) => Math.hypot(x, y)));
    });
    R += 3;
    return { box: { x: w / 2 - R - PAD, y: h / 2 - R - PAD, w: 2 * (R + PAD), h: 2 * (R + PAD) }, rim: R };
  };
  const px = (x, y) => [((x - vb.x) / vb.w) * 100, ((y - vb.y) / vb.h) * 100];

  view.setLevel = p => {
    plan = p;
    layered = new Set([...p.trains.flatMap(t => [t.barrel.l, t.sink.l]), ...p.pins.map(q => Number(String(q.kind).match(/\.(\d)/)?.[1] || 1))]).size > 1 || p.terrain.some(t => t.startsWith("bridge"));
    board.replaceChildren();
    ({ box: vb, rim } = boxOf(p));
    board.style.setProperty("--cols", vb.w / T);
    board.style.setProperty("--rows", vb.h / T);
    board.classList.toggle("round", rim > 0);
    svg = el("svg", { viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, role: "img", "aria-label": `${p.name}: the plate` });
    gGround = el("g", { class: "ground" }, svg);
    gWheels = el("g", { class: "wheels" }, svg);
    gTop = el("g", { class: "marks" }, svg);
    chips = document.createElement("div");
    chips.className = "pi-chips";
    board.append(svg, chips);
    drawGround();
    prevLaid = null; last = null; epoch = 0; runUpTo = 0; asleep = false;
    clearTimeout(runTimer); clearTimeout(idleTimer);
    svg.addEventListener("pointerdown", e => { if (e.button === 2) return; wake(); onGesture?.({ type: "down", clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, event: e }); });
    svg.addEventListener("contextmenu", e => e.preventDefault());
  };

  function drawGround() {
    gGround.replaceChildren();
    if (rim) {
      // a round plate: the gearbox's face and its brass bezel, the squares laid on it
      const cx = plan.cols * T / 2, cy = plan.rows * T / 2;
      el("circle", { cx, cy, r: rim + 2.5, class: "disc-bezel" }, gGround);
      el("circle", { cx, cy, r: rim, class: "disc" }, gGround);
    }
    for (let c = 0; c < plan.cols * plan.rows; c++) {
      if (plan.terrain[c] === "void") continue;
      const [x, y] = cellXY(c), g = el("g", { transform: `translate(${x} ${y})` }, gGround), ter = plan.terrain[c];
      el("rect", { x: 1, y: 1, width: T - 2, height: T - 2, rx: 6, class: ter === "pillar" ? "slot rock" : "slot" }, g);
      if (ter === "pillar") { el("circle", { cx: 30, cy: 30, r: 11, class: "g-pillar" }, g); el("circle", { cx: 30, cy: 30, r: 5, class: "g-screw" }, g); el("path", { d: "M26 30H34", class: "g-slot" }, g); }
      else if (ter.startsWith("bridge")) {
        // a low bridge: a band across the square with Geneva stripes, and its height in pips
        el("rect", { x: 3, y: 3, width: T - 6, height: T - 6, rx: 5, class: "bridge" }, g);
        for (let k = 0; k < 9; k++) el("path", { d: `M${9 + k * 5} 5V${T - 5}`, class: "stripe" }, g);
        const h = Number(ter.slice(-1));
        for (let k = 0; k < h; k++) el("circle", { cx: 30 + (k - (h - 1) / 2) * 7, cy: 30, r: 2.4, class: "bridge-pip" }, g);
      }
    }
  }

  const wheelOpts = (frame, gear) => {
    const M = frame.M, id = gear.id, dim = focus !== null && gear.layer !== focus;
    const skin = gear.fixed === "barrel" ? "barrel" : gear.fixed === "sink" ? "sink" : gear.fixed === "pin" ? "pin" : "";
    return { id, dir: M.dir[id] >= 0 ? M.dir[id] : null, phase: frame.phase[id] || 0, skin, jam: M.jam.has(id), clash: clashSet.has(id), driven: M.dir[id] >= 0, faded: dim, showN, pips: layered, ring: gear.ring };
  };
  let clashSet = new Set();

  view.draw = frame => {
    if (!plan) return;
    last = frame;
    const M = frame.M, res = frame.res;
    clashSet = new Set(M.clash.flat());
    focus = frame.focus ?? focus;
    showN = !!frame.look;
    gWheels.replaceChildren();
    gTop.replaceChildren();
    const order = [...M.gears].sort((a, b) => a.layer - b.layer || a.id - b.id);
    for (const gear of order) {
      const o = wheelOpts(frame, gear);
      if (prevLaid && frame.laid[gear.c] !== prevLaid[gear.c] && !gear.fixed) o.skin += " pop";
      const w = drawWheel(gWheels, gear, o);
      void w;
      if (gear.fixed === "sink") {
        const tr = plan.trains.find(t => t.sink.c === gear.c);
        if (gear.i === (tr.sink.ring ? 1 : 0)) sinkArt(gWheels, gear, tr.sink.ring ? "date" : tr.sink.goal?.type || "wheel", gear.id);
      }
      if (gear.fixed === "pin" && plan.pins.find(p => p.c === gear.c && p.goal) && gear.i === (plan.pins.find(p => p.c === gear.c).goal.w ?? 0)) {
        const [cx, cy] = cellXY(gear.c);
        el("circle", { cx: cx + 8, cy: cy + 52, r: 4, class: "fixed-mark" }, gTop);
      }
      if (gear.fixed === "barrel") { const [cx, cy] = cellXY(gear.c); turnArrow(gTop, cx + 9, cy + 9, 0, 5, "g-turn bright"); }
    }
    // clicks: a pawl ring waiting on an empty square, a stake on a gear
    for (const k of plan.clicks) {
      const [x, y] = cellXY(k.c), st = res.clicks[k.c] || "";
      if (!frame.laid[k.c]) { el("circle", { cx: x + 30, cy: y + 30, r: 25, class: "load-ring" }, gTop); turnArrow(gTop, x + 30, y + 30, k.dir, 11, "g-turn load big"); }
      else { el("circle", { cx: x + 12, cy: y + 12, r: 10, class: `stake ${st}` }, gTop); turnArrow(gTop, x + 12, y + 12, k.dir, 6, `g-turn load plate ${st}`); }
    }
    // jam and clash marks
    for (const c of res.jams) { const [x, y] = cellXY(c); el("rect", { x: x + 2, y: y + 2, width: T - 4, height: T - 4, rx: 7, class: "mark-bad" }, gTop); }
    for (const [u, v] of M.clash) for (const id of [u, v]) { const g = M.gears[M.idx[id]]; el("circle", { cx: g.x, cy: g.y, r: radius(g.m, g.n) + 2, class: "mark-bad round" }, gTop); }
    // the ghost and the hint
    if (frame.ghost) {
      const gh = frame.ghost, [x, y] = cellXY(gh.c), sh = shapeOf(gh.kind, gh.rot || 0);
      if (sh) { drawShape(gTop, sh, { ox: x, oy: y, cls: `ghost${gh.ok === false ? " bad" : ""}` }); el("rect", { x: x + 2, y: y + 2, width: T - 4, height: T - 4, rx: 7, class: `pick${gh.ok === false ? " bad" : ""}` }, gTop); }
    }
    const h = frame.hint;
    if (h) {
      for (const c of h.wrong || []) { const [x, y] = cellXY(c); el("rect", { x: x + 3, y: y + 3, width: T - 6, height: T - 6, rx: 8, class: "pick bad" }, gTop); }
      if (h.piece !== undefined) {
        const [x, y] = cellXY(h.c), i = h.piece.lastIndexOf("@"), sh = shapeOf(h.piece.slice(0, i), Number(h.piece.slice(i + 1)));
        if (sh) drawShape(gTop, sh, { ox: x, oy: y, cls: "ghost" });
        el("rect", { x: x + 3, y: y + 3, width: T - 6, height: T - 6, rx: 8, class: "pick" }, gTop);
      }
    }
    if (frame.held && frame.held.hover !== undefined) void 0;
    drawChips(frame);
    prevLaid = frame.laid.slice();
    applyMotion(frame);
  };

  /** The speed chips on every goal wheel: what it has and what it wants. */
  function drawChips(frame) {
    chips.replaceChildren();
    for (const cm of frame.res.comps) {
      if (!cm.want) continue;
      const gear = frame.M.gears[frame.M.idx[cm.c * SLOTS + cm.w]];
      if (!gear) continue;
      const [lx, ly] = px(gear.x, gear.y - radius(gear.m, gear.n) - 4);
      const chip = document.createElement("span");
      chip.className = `pi-chip ${cm.status}`;
      chip.style.left = `clamp(1.7rem, ${lx}%, calc(100% - 1.7rem))`; chip.style.top = `max(1.2rem, ${ly}%)`;
      chip.textContent = cm.status === "ok" ? `×${F.fmt(cm.want, true)}` : cm.status === "off" ? `wants ×${F.fmt(cm.want, true)}` : cm.status === "wrong" ? `wrong way` : `×${F.fmt(cm.has, true)} → ×${F.fmt(cm.want, true)}`;
      chips.append(chip);
    }
  }

  // ---------- motion ----------
  function applyMotion(frame) {
    if (!frame.solved || !motion || asleep) return;
    if (!epoch) epoch = performance.now();
    const M = frame.M, T0 = frame.T0, now = performance.now();
    const squareOn = c => { const k = M.order.indexOf(c); return k >= 0 && k < runUpTo; };
    for (const sp of gWheels.querySelectorAll(".spin.cw, .spin.ccw")) {
      const id = Number(sp.dataset.id), c = Math.floor(id / SLOTS), w = M.omega[id];
      if (!w || !squareOn(c)) continue;
      const turnMs = T0 / F.num(F.abs(w)), a = sp.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${sp.classList.contains("ccw") ? -360 : 360}deg)` }], { duration: turnMs, iterations: Infinity });
      a.currentTime = now - epoch;
    }
    for (const art of gWheels.querySelectorAll("[data-id]:not(.spin)")) {
      const id = Number(art.dataset.id), c = Math.floor(id / SLOTS), w = M.omega[id];
      if (!w || !squareOn(c)) continue;
      const g = M.gears[M.idx[id]], sign = M.dir[id] ? -1 : 1, turnMs = T0 / F.num(F.abs(w));
      let ms = turnMs, from = 0, n = 1;
      if (art.dataset.hand === "hour") ms = turnMs * 12;
      if (art.dataset.hand === "second") ms = turnMs / 2;
      if (art.dataset.art === "cage") n = 1;
      void g; void n;
      const a = art.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${sign * 360 + from}deg)` }], { duration: ms, iterations: Infinity });
      a.currentTime = now - epoch;
    }
    for (const sw of gWheels.querySelectorAll(".swing")) {
      const id = M.gears.find(g => g.fixed === "sink")?.id, w = id !== undefined ? M.omega[id] : null;
      if (w && squareOn(Math.floor(id / SLOTS))) sw.animate([{ transform: "rotate(-70deg)" }, { transform: "rotate(70deg)" }], { duration: Math.max(260, T0 / F.num(F.abs(w)) / 8), direction: "alternate", iterations: Infinity, easing: "ease-in-out" });
    }
  }
  function wake() {
    if (!asleep) { clearTimeout(idleTimer); if (last?.solved) idleTimer = setTimeout(sleep, IDLE_MS); return; }
    asleep = false; epoch = 0;
    if (last) { runUpTo = Infinity; view.draw(last); idleTimer = setTimeout(sleep, IDLE_MS); }
  }
  function sleep() { asleep = true; if (last) view.draw(last); }

  /** Plays an event, then draws and calls done: "run" starts the solved train turning gear by gear from the barrels. */
  view.animate = (ev, done) => {
    if (ev.type === "run" && last) {
      clearTimeout(runTimer); epoch = performance.now(); runUpTo = 0; asleep = false;
      const total = last.M.order.length + 2;
      if (!motion) { runUpTo = Infinity; view.draw(last); return done?.(); }
      const tick = () => {
        runUpTo++;
        view.draw(last);
        view.onTick?.(runUpTo, total);
        if (runUpTo >= total) { runUpTo = Infinity; view.draw(last); clearTimeout(idleTimer); idleTimer = setTimeout(sleep, IDLE_MS); return done?.(); }
        runTimer = setTimeout(tick, STEP);
      };
      runTimer = setTimeout(tick, STEP);
    } else done?.();
  };
  /** A solved level already shown (opened again): turning at once. */
  view.runNow = () => { runUpTo = Infinity; asleep = false; epoch = 0; if (last) { view.draw(last); clearTimeout(idleTimer); idleTimer = setTimeout(sleep, IDLE_MS); } };
  view.stop = () => { clearTimeout(runTimer); clearTimeout(idleTimer); runUpTo = 0; epoch = 0; };
  view.hit = (clientX, clientY) => {
    if (!plan || !svg) return null;
    const r = svg.getBoundingClientRect();
    const vx = (clientX - r.left) / r.width * vb.w + vb.x, vy = (clientY - r.top) / r.height * vb.h + vb.y;
    const x = Math.floor(vx / T), y = Math.floor(vy / T);
    if (x >= 0 && y >= 0 && x < plan.cols && y < plan.rows && plan.terrain[y * plan.cols + x] !== "void") return { kind: "cell", c: y * plan.cols + x, sub: [vx - x * T, vy - y * T] };
    return { kind: "off" };
  };
  view.project = c => {
    const r = svg.getBoundingClientRect(), [x, y] = cellXY(c);
    return [r.left + (x + 30 - vb.x) / vb.w * r.width, r.top + (y + 30 - vb.y) / vb.h * r.height];
  };
  /** Rings a square once (the workings strip's chips). */
  view.pulse = c => {
    const [x, y] = cellXY(c), p = el("rect", { x: x + 2, y: y + 2, width: T - 4, height: T - 4, rx: 7, class: "pulse" }, gTop);
    setTimeout(() => p.remove(), 1100);
  };
  view.setLayerFocus = l => { focus = l; if (last) view.draw({ ...last, focus: l }); };
  view.look = on => { showN = on; if (last) view.draw({ ...last, look: on }); };
  view.setMotion = on => { motion = on; if (last) view.draw(last); };
  view.dispose = () => { clearTimeout(runTimer); clearTimeout(idleTimer); board.replaceChildren(); plan = null; svg = null; };
  view.svg = () => svg;
  return view;
}
