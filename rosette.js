// Rosette: a watch's dial on a rose engine. Drag one of three cuts onto the dial: while it's held where its first copy
// fits, all its repeats are shown round the dial (a skipped one struck through) and the rings and spokes it would
// finish are lit, the line under the dial saying what it would do; let go to cut. A tap on a cut picks it up, and a
// press on the dial then shows it there, cut on letting go. With no cut in hand, a drag across the dial turns it in the
// light. The rules are rosette-engine.js's; the watch is drawn by rosette-3d.js (flat, in SVG, where there's no
// WebGL); this file plays each cut out and keeps the game.
import { RINGS, SECTORS, SHAPES, PATTERN_NAMES, newGame, echo, cut, bands, counted, worth, fitsAnywhere, maxCells, nicksFor } from "./rosette-engine.js";
import { createDial, GEO, RING_W, cellMiddle } from "./rosette-3d.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "rosette:run", BEST = "rosette:best", SEEN = "rosette:seen", TILT = "rosette:tilt";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");
const SECTOR = (2 * Math.PI) / SECTORS;

let S = null;            // the game (rosette-engine.js's), as saved
let view = null;         // the watch: rosette-3d.js's, or the flat one
let playing = false;     // a cut being played out
let drag = null;         // a cut in hand: { slot, cut, id, x0, y0, moved, lift, at, float, fromDial }
let picked = -1;         // a cut picked up with a tap, to be put down with a press on the dial
let turn = null;         // a drag turning the dial in the light: { id, x, y, az, el }

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === RINGS * SECTORS && Array.isArray(g.hand) && g.hand.length === 3;
function save() { write(RUN, S); }
function newRun() {
  dropDrag();
  picked = -1;
  S = newGame(Math.floor(Math.random() * 2 ** 31));
  save();
  render();
}

// ---------- drawing helpers ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const f3 = v => (Math.abs(v) < 5e-4 ? "0" : v.toFixed(3));
/** An SVG point on a dial of this radius, y down: r out from the middle, a clockwise from twelve. */
const at = (r, a) => `${f3(r * Math.sin(a))} ${f3(-r * Math.cos(a))}`;
/** A cell drawn on a dial whose rings run from r0 out, each w deep. */
function cellPath(i, r0, w) {
  const ring = Math.floor(i / SECTORS), sector = i % SECTORS, a0 = (sector - .5) * SECTOR, a1 = (sector + .5) * SECTOR;
  const ri = r0 + ring * w, ro = ri + w;
  return `M${at(ro, a0)}A${f3(ro)} ${f3(ro)} 0 0 1 ${at(ro, a1)}L${at(ri, a1)}A${f3(ri)} ${f3(ri)} 0 0 0 ${at(ri, a0)}Z`;
}
/** A rosette (the lathe's cam) of k lobes, round (cx, cy). */
function camPath(k, rad) {
  let d = "";
  for (let j = 0; j <= 72; j++) {
    const t = (j / 72) * 2 * Math.PI, r = rad * (1 - (k > 1 ? .2 : .14) + (k > 1 ? .2 : .14) * Math.cos(k * t + (k > 1 ? 0 : Math.PI / 2)));
    d += `${j ? "L" : "M"}${at(r, t)}`;
  }
  return `${d}Z`;
}
// each pattern's marks over its enamel, drawn in the dial's own coordinates (the sunburst's rays from its middle)
function patternMarks(p, r0, r1) {
  if (p === 2) {
    let d = "";
    for (let j = 0; j < 96; j++) { const a = (j / 96) * 2 * Math.PI; d += `M${at(r0, a)}L${at(r1, a)}`; }
    return el("path", { class: "grain", d });
  }
  let d = "";
  const s = (r1 - r0) / 9;
  for (let y = p === 1 ? -2 * r1 : -r1; y <= (p === 1 ? 2 * r1 : r1); y += p === 1 ? s * 1.2 : s) {
    if (p === 1) { d += `M${f3(-r1)} ${f3(y - r1)}L${f3(r1)} ${f3(y + r1)}M${f3(-r1)} ${f3(y + r1)}L${f3(r1)} ${f3(y - r1)}`; continue; }
    d += `M${f3(-r1)} ${f3(y)}`;
    for (let x = -r1; x <= r1; x += s) d += `Q${f3(x + s / 2)} ${f3(y + (p === 0 ? s * .55 : s * .35) * (Math.round((x + r1) / s) % 2 ? 1 : -1))} ${f3(x + s)} ${f3(y)}`;
    if (p === 0) { d += `M${f3(-r1)} ${f3(y)}`; for (let x = -r1; x <= r1; x += s) d += `Q${f3(x + s / 2)} ${f3(y - s * .55 * (Math.round((x + r1) / s) % 2 ? 1 : -1))} ${f3(x + s)} ${f3(y)}`; }
  }
  return el("path", { class: "grain", d });
}
let clipCount = 0;
/** A cut on a small dial of its own: every repeat round from twelve o'clock, the rosette at its middle. */
function miniDial(c, extra = {}) {
  const R0 = 13, R1 = 47, W = (R1 - R0) / RINGS, sh = SHAPES[c.shape];
  const ring0 = Math.floor((RINGS - sh.rings) / 2), sector0 = -Math.floor((sh.sectors - 1) / 2);
  const kids = [el("circle", { class: "face", r: R1 + 1.5 })];
  for (let k = 0; k <= RINGS; k++) kids.push(el("circle", { class: "ring", r: R0 + k * W }));
  for (let s = 0; s < SECTORS; s++) kids.push(el("path", { class: "spoke", d: `M${at(R0, (s + .5) * SECTOR)}L${at(R1, (s + .5) * SECTOR)}` }));
  const cells = [], firsts = [];
  for (let j = 0; j < c.lobes; j++) for (const [dr, ds] of sh.cells) {
    const i = (ring0 + dr) * SECTORS + (((sector0 + ds + j * SECTORS / c.lobes) % SECTORS) + SECTORS) % SECTORS;
    cells.push(i);
    if (!j) firsts.push(i);
  }
  const id = `ro-clip-${++clipCount}`, d = cells.map(i => cellPath(i, R0, W)).join("");
  kids.push(el("clipPath", { id }, el("path", { d })));
  kids.push(el("path", { class: `copy k${c.pattern}`, d }));
  kids.push(el("g", { "clip-path": `url(#${id})`, class: c.pattern === 0 ? "marks dark" : "marks" }, patternMarks(c.pattern, R0, R1)));
  kids.push(el("path", { class: "copy first", d: firsts.map(i => cellPath(i, R0, W)).join(""), fill: "none" }));
  kids.push(el("path", { class: "cam", d: camPath(c.lobes, 10.5) }));
  const n = el("text", { class: "lobes", x: 0, y: .5 });
  n.textContent = c.lobes;
  kids.push(n);
  return el("svg", { viewBox: "-50 -50 100 100", class: "mini", "aria-hidden": "true", ...extra }, ...kids);
}

// ---------- the flat dial, where there's no WebGL ----------
function createFlat(svg) {
  svg.removeAttribute("hidden");
  let shown = { cells: [], show: {} };
  function draw() {
    const { cells, show } = shown, kids = [el("circle", { class: "case", r: GEO.bezel - .03 }), el("circle", { class: "rim", r: GEO.rim })];
    for (let h = 0; h < 12; h++) kids.push(el("path", { class: "hour", d: `M${at(.9, h * SECTOR)}L${at(.96, h * SECTOR)}` }));
    const cut = new Map(), skip = [];
    for (const c of show.cut || []) for (const i of c.cells) { if (c.cut) cut.set(i, c.pattern); else skip.push(i); }
    for (let i = 0; i < RINGS * SECTORS; i++) {
      const p = cut.has(i) ? cut.get(i) : cells[i], faced = show.faced?.[i] ?? 0;
      kids.push(el("path", { d: cellPath(i, GEO.inner, RING_W), class: p >= 0 && faced < .6 ? `k${p}${cut.has(i) ? " ghost" : ""}` : "bare", style: p >= 0 ? `fill: var(--c${p})` : null }));
    }
    for (const i of skip) kids.push(el("path", { d: cellPath(i, GEO.inner, RING_W), class: "skip" }));
    for (const i of show.lit || []) kids.push(el("path", { d: cellPath(i, GEO.inner, RING_W), class: "lit" }));
    kids.push(el("circle", { class: "hub", r: GEO.hub * .8 }));
    svg.replaceChildren(...kids);
  }
  const toDial = (x, y) => { const m = svg.getScreenCTM(); if (!m) return null; const p = new DOMPoint(x, y).matrixTransform(m.inverse()); return [p.x, -p.y]; };
  return {
    set(cells, show = {}) { shown = { cells, show }; draw(); },
    run() {}, still() {},
    pick(x, y) { const q = toDial(x, y) || [9, 9]; let a = Math.atan2(q[0], q[1]); if (a < 0) a += 2 * Math.PI; return { x: q[0], y: q[1], r: Math.hypot(...q), a }; },
    project(x, y) { const m = svg.getScreenCTM(), p = new DOMPoint(x, -y).matrixTransform(m); return [p.x, p.y]; },
    light() {}, tilt() {}, view: () => ({ az: 0, el: 0 }), theme() {}, resize() {}, radius: () => svg.getBoundingClientRect().width / 2.64, flat: true,
  };
}

// ---------- the dial as it stands ----------
const hintOn = () => !read(SEEN, false) && S.cuts < 3;
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("bands").textContent = fmt(S.bands);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
}
function drawTray() {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `Nowhere left to cut: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  for (const b of document.querySelectorAll(".ro-cut")) {
    const slot = Number(b.dataset.slot), h = S.hand[slot];
    b.replaceChildren(...(h ? [miniDial(h)] : []));
    b.disabled = !h;
    b.classList.toggle("cant", !!h && !fitsAnywhere(S.cells, h));
    b.classList.toggle("lifted", drag?.slot === slot && drag.moved);
    b.classList.toggle("picked", picked === slot);
    b.setAttribute("aria-label", h ? `A cut of ${SHAPES[h.shape].cells.length} in ${PATTERN_NAMES[h.pattern]}, ${h.lobes === 1 ? "cut once" : `repeated ${h.lobes} times round`}: drag it onto the dial` : "Cut");
  }
}
function say(html) { $("line").innerHTML = html ?? ""; }
function idleLine() {
  if (S.over) return say("");
  if (hintOn()) return say("Drag a cut onto the dial: the engine repeats it round");
  if (picked >= 0) return say("Press the dial where the picked cut goes");
  // the hand just dealt brings bigger cuts
  const now = maxCells(S.sets - 1), before = maxCells(S.sets - 2);
  say(now > before && S.hand.every(h => h) ? `The cuts grow: up to <b>${now}</b> cells, copies and all` : "");
}
function render() {
  view.set(S.cells);
  view.still();
  drawStrip();
  drawTray();
  idleLine();
}

// ---------- where a cut in hand would go ----------
/** The place a cut held with its middle over a point on the screen would go, its repeats and what it would finish, or null. */
function spotAt(c, px, py) {
  const p = view.pick(px, py), sh = SHAPES[c.shape];
  if (p.r < GEO.inner - RING_W * .6 || p.r > GEO.outer + RING_W * .6) return null;
  const fr = (p.r - GEO.inner) / RING_W - .5, fs = p.a / SECTOR;
  const ring = Math.round(fr - (sh.rings - 1) / 2), sector = Math.round(fs - (sh.sectors - 1) / 2);
  // where it's held, or the nearest place close by that it fits
  let best = null;
  for (let dr = -1; dr <= 1; dr++) for (let ds = -1; ds <= 1; ds++) {
    const r0 = Math.max(0, Math.min(RINGS - sh.rings, ring + dr)), s0 = (((sector + ds) % SECTORS) + SECTORS) % SECTORS;
    const copies = echo(S.cells, c, r0, s0);
    if (!copies) continue;
    const off = Math.hypot(r0 + (sh.rings - 1) / 2 - fr, (((s0 + (sh.sectors - 1) / 2 - fs + SECTORS * 1.5) % SECTORS) - SECTORS / 2) * .8);
    if (!best || off < best.off) best = { ring: r0, sector: s0, copies, off };
  }
  if (!best || best.off > 1.6) return null;
  const cells = S.cells.slice();
  for (const k of best.copies) if (k.cut) for (const i of k.cells) cells[i] = c.pattern;
  const found = bands(cells);
  return { ...best, found, gain: found.length ? worth(counted(found)) : 0 };
}
function describe(c, spot) {
  const n = spot.copies.length, kept = spot.copies.filter(k => k.cut).length;
  const rep = n === 1 ? "Cut once" : kept === n ? (n === 2 ? "Both copies cut" : `All ${n} copies cut`) : `<span class="warn">${kept} of ${n} copies cut</span> (${n - kept === 1 ? "one would cross" : `${n - kept} would cross`} a cut)`;
  if (!spot.found.length) return `${rep}: nothing finished`;
  const rings = spot.found.filter(b => b.ring != null).length, spokes = spot.found.length - rings, trues = spot.found.filter(b => b.true).length;
  const what = [rings && `${rings === 1 ? "a ring" : `${rings} rings`}`, spokes && `${spokes === 1 ? "a spoke" : `${spokes} spokes`}`].filter(Boolean).join(" and ");
  return `${rep}: finishes ${what}${trues ? ` (${trues === spot.found.length ? "in one pattern" : `${trues} in one pattern`})` : ""}, <b>+${fmt(spot.gain)}</b>`;
}
function showSpot(c, spot) {
  if (!spot) { view.set(S.cells); say(drag?.moved || drag?.fromDial ? "Its first copy needs bare metal under it" : ""); return; }
  view.set(S.cells, { cut: spot.copies.map((k, j) => ({ cells: k.cells, pattern: c.pattern, cut: k.cut, first: j === 0 })), lit: spot.found.flatMap(b => b.cells) });
  say(describe(c, spot));
}

// ---------- a cut made ----------
const clamp = v => Math.max(0, Math.min(1, v));
/** Runs an animation: frame(t) each frame for ms milliseconds, the watch drawn throughout. */
function play(ms, frame) {
  view.run(ms + 50);
  return new Promise(done => {
    const t0 = performance.now();
    const step = now => { const t = now - t0; frame(Math.min(t, ms)); if (t < ms) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  });
}
function settle() {
  if (S.score > read(BEST, 0)) write(BEST, S.score);
  if (S.cuts >= 3) write(SEEN, true);
  save();
}
async function commit(slot, ring, sector) {
  if (playing || S.over) return;
  playing = true;
  picked = -1;
  const before = S, c = before.hand[slot], r = cut(S, slot, ring, sector);
  S = r.state;
  settle();
  drawTray();
  drawStrip();
  say("");
  // the engine turns: each copy is cut in turn, a glint as the cutter passes; a skipped one shows its mark a moment
  const cutCells = before.cells.slice();
  for (const k of r.copies) if (k.cut) for (const i of k.cells) cutCells[i] = c.pattern;
  const STEP = Math.min(110, 520 / r.copies.length), skipped = r.copies.filter(k => !k.cut).map(k => ({ cells: k.cells, pattern: c.pattern, cut: false }));
  await play(STEP * r.copies.length + 300, t => {
    const faced = {};
    r.copies.forEach((k, j) => { if (k.cut) for (const i of k.cells) faced[i] = 1 - clamp((t - j * STEP) / 280); });
    view.set(cutCells, { faced, cut: skipped });
  });
  // the bands it finished are faced off, the cutter sweeping round a ring and out along a spoke
  if (r.bands.length) {
    const delay = new Map();
    for (const b of r.bands) b.cells.forEach((i, k) => delay.set(i, Math.min(delay.get(i) ?? Infinity, k * (b.ring != null ? 38 : 70))));
    const lit = r.bands.flatMap(b => b.cells), last = Math.max(...delay.values());
    popup(lit, r.gain, r.bands);
    await play(last + 650, t => {
      const faced = {};
      for (const [i, d] of delay) faced[i] = clamp((t - d) / 600);
      view.set(cutCells, { faced, lit: t < 250 ? lit : [] });
    });
  }
  // the worn cutter slips as the new hand comes: its nicks scratched in
  if (r.nicked.length) {
    const after = S.cells.slice(), nicked = new Set(r.nicked);
    await play(420, t => { const faced = {}; for (const i of nicked) faced[i] = 1 - clamp(t / 380); view.set(after, { faced, lit: t < 300 ? r.nicked : [] }); });
  }
  render();
  if (r.nicked.length) {
    const n = nicksFor(S.sets), cells = k => (k === 1 ? "a cell" : `${k} cells`);
    say(n > nicksFor(S.sets - 1) ? `The cutter ${n === 1 ? "is worn" : "wears"}: each hand now nicks ${cells(n)}` : `The worn cutter nicked ${cells(r.nicked.length)}`);
  }
  playing = false;
}
function popup(cells, gain, found) {
  const mids = [...new Set(cells)].map(cellMiddle), x = mids.reduce((a, m) => a + m[0], 0) / mids.length, y = mids.reduce((a, m) => a + m[1], 0) / mids.length;
  // a ring's middle is the dial's: put the points over its top instead
  const ring = found.find(b => b.ring != null), [px, py] = ring && found.length === 1 ? view.project(0, GEO.inner + (ring.ring + .5) * RING_W) : view.project(x, y);
  const t = document.createElement("div"), trues = found.filter(b => b.true).length;
  t.className = `ro-pop${gain >= 2500 ? " big" : ""}`;
  t.style.left = `${px}px`;
  t.style.top = `${py}px`;
  t.textContent = `+${fmt(gain)}`;
  if (trues) { const s = document.createElement("small"); s.textContent = trues === 1 ? "one pattern" : `${trues} in one pattern`; t.append(s); }
  $("fx").append(t);
  const a = t.animate?.([{ transform: "translate(-50%, -50%)", opacity: 1 }, { transform: "translate(-50%, calc(-50% - 2.2rem))", opacity: 0 }], { duration: 1300, delay: 200, easing: "ease-out", fill: "both" });
  if (a) a.finished.then(() => t.remove(), () => t.remove()); else setTimeout(() => t.remove(), 1500);
}

// ---------- a cut in hand ----------
function floatEl(c) {
  const d = document.createElement("div");
  d.className = "ro-float";
  d.append(miniDial(c));
  document.body.append(d);
  return d;
}
function dropDrag() { drag?.float?.remove(); drag = null; }
function startDrag(e, slot, fromDial = false) {
  const c = S.hand[slot];
  if (playing || S.over || !c || e.button > 0) return;
  e.preventDefault();
  if (!fitsAnywhere(S.cells, c)) { toast("That cut has nowhere to go: its first copy needs bare metal"); return; }
  dropDrag();
  // held above the finger, so where it's going is in sight (a mouse, or a cut put down from the dial, needs no lift)
  const lift = e.pointerType === "mouse" || fromDial ? 0 : Math.max(48, view.radius() * RING_W * (SHAPES[c.shape].rings / 2 + 1.2));
  drag = { slot, cut: c, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: fromDial, lift, at: null, fromDial, float: fromDial ? null : floatEl(c) };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.moved = true; drawTray(); }
  const px = e.clientX, py = e.clientY - (drag.moved ? drag.lift : 0), spot = drag.moved ? spotAt(drag.cut, px, py) : null;
  if (drag.float) {
    const f = drag.float, half = f.getBoundingClientRect().width / 2 || 44;
    f.style.left = `${px - half}px`;
    f.style.top = `${py - half}px`;
    f.style.visibility = drag.moved && !spot ? "visible" : "hidden";   // where it fits it's shown on the dial
  }
  const key = spot ? `${spot.ring},${spot.sector}` : "";
  if (drag.key === key && drag.shown) return;
  drag.key = key;
  drag.shown = true;
  drag.at = spot;
  if (drag.moved) showSpot(drag.cut, spot);
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { slot, at: spot, moved, fromDial } = drag;
  dropDrag();
  if (spot) { commit(slot, spot.ring, spot.sector); return; }
  // a tap on a cut picks it up (or puts it back); a press on the dial that found no place leaves it picked
  if (!moved && !fromDial) picked = picked === slot ? -1 : slot;
  render();
}

// ---------- turning the dial in the light ----------
function startTurn(e) {
  if (playing || e.button > 0) return;
  e.preventDefault();
  const v = view.view();
  turn = { id: e.pointerId, x: e.clientX, y: e.clientY, az: v.az, el: v.el };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
}
function moveTurn(e) {
  if (!turn || e.pointerId !== turn.id) return;
  const dx = e.clientX - turn.x, dy = e.clientY - turn.y;
  view.light(turn.az + dx * .009, turn.el + dy * .006);
  view.tilt(Math.max(-.13, Math.min(.13, dy * .0016)), Math.max(-.13, Math.min(.13, dx * .0016)));
}
async function endTurn(e) {
  if (!turn || e.pointerId !== turn.id) return;
  turn = null;
  const { tx, ty } = view.view();
  await play(420, t => { const k = 1 - (t / 420) ** 2; view.tilt(tx * k, ty * k); });
  view.tilt(0, 0);
}
// the light following the phone's tilt, where the player has asked for it
let tiltOn = false;
function onOrient(e) {
  if (turn || drag || e.beta == null) return;
  const b = Math.max(-35, Math.min(35, e.beta - 40)), g = Math.max(-35, Math.min(35, e.gamma || 0));
  view.light(-.75 + g * .03, .78 - b * .02);
}
async function setTilt(on) {
  if (on && typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try { if ((await DeviceOrientationEvent.requestPermission()) !== "granted") on = false; } catch { on = false; }
  }
  tiltOn = on;
  write(TILT, on);
  if (on) addEventListener("deviceorientation", onOrient); else removeEventListener("deviceorientation", onOrient);
}

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("New game", newRun, "primary"));
  if (!view.flat && typeof DeviceOrientationEvent !== "undefined") part(body, "settings").append(toggle("The light follows the phone's tilt", tiltOn, on => setTilt(on)));
  const best = read(BEST, 0);
  part(body, "about").append(line(`This game: ${fmt(S.score)}, ${S.cuts} cut${S.cuts === 1 ? "" : "s"}, ${S.bands} band${S.bands === 1 ? "" : "s"} finished${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
try { view = createDial($("dial")); }
catch (err) { console.warn("Rosette: no WebGL here, so the dial is drawn flat.", err); $("dial").hidden = true; view = createFlat($("flat")); }
bindSwitcher($("appsBtn"), "rosette");
document.querySelector(".ro-mark").innerHTML = APPS.find(a => a.id === "rosette").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".ro-cut")) b.addEventListener("pointerdown", e => startDrag(e, Number(b.dataset.slot)));
const surface = view.flat ? $("flat") : $("dial");
surface.addEventListener("pointerdown", e => { if (picked >= 0 && S.hand[picked]) startDrag(e, picked, true); else startTurn(e); });
addEventListener("pointermove", e => { moveDrag(e); moveTurn(e); });
addEventListener("pointerup", e => { endDrag(e); endTurn(e); });
addEventListener("pointercancel", e => { if (drag?.id === e.pointerId) { dropDrag(); render(); } if (turn?.id === e.pointerId) endTurn(e); });
$("againBtn").addEventListener("click", newRun);
// the theme (Almanac, Modern, Kontor, Office) and day or night re-skin the watch as they change
new MutationObserver(() => view.theme()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => view.theme());
document.addEventListener("visibilitychange", () => { if (document.hidden) view.still(); });
if (read(TILT, false) && typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission !== "function") setTilt(true);

// for tests and debugging
window.__rosette = { get state() { return S; }, commit, spotAt, newRun, view: () => view };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
