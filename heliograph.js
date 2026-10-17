// Heliograph: gems creep down from the top; the heliograph at the foot fires a beam each turn, in the colour at the
// head of the queue. Lay a mirror (drag one from the tray onto the field, the beam's path drawn as you go) to turn it;
// let go and it fires. Tap the heliograph to turn it (up, right, left), Flash to fire without a new mirror. The rules
// are heliograph-engine.js's; this file draws the field, lays the mirrors, plays each shot out and keeps the game.
import { COLS, ROWS, SOURCE, LIFE, newGame, trace, fire, canPlace, nextAim, lowest, dropEvery } from "./heliograph-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "heliograph:run", BEST = "heliograph:best", SEEN = "heliograph:seen", RELAY = "heliograph:relay";
const CELL = 10;                                   // a cell in the board's own units (its viewBox is COLS by ROWS cells)
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const fmt = n => n.toLocaleString("en-GB");

// ---------- state ----------
let S = null;            // the game (heliograph-engine.js's), as saved
let playing = false;     // a shot being played out: the field takes no hand meanwhile
let drag = null;         // a mirror in hand, dragged from the tray
let picked = null;       // a mirror picked up with a tap ("/" or "\"), to lay with a tap on the field
let pending = null;      // a mirror laid with a tap, { x, y, t }: a second tap on it (or Flash) fires

const valid = g => g && g.v === 1 && Array.isArray(g.gems) && g.gems.length === COLS * ROWS && Array.isArray(g.mirrors) && Array.isArray(g.queue);
function save() { write(RUN, S); }
function newRun() {
  S = newGame(randomSeed());
  pending = picked = null;
  save();
  render();
}

// ---------- drawing ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};
const cx = x => x * CELL + CELL / 2, cy = y => y * CELL + CELL / 2;
const hex = r => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`; }).join("L");
// each colour its own cut too, so the colours can be told apart without their colour
const CUTS = [
  () => el("circle", { r: 3.9 }),
  () => el("path", { d: "M0-4.4L4.4 0L0 4.4L-4.4 0Z" }),
  () => el("rect", { x: -3.5, y: -3.5, width: 7, height: 7, rx: 1.1 }),
  () => el("path", { d: `M${hex(4.2)}Z` }),
];
/** A gem: its cut in its colour, a glint; placed by an outer group so its own can be animated. */
function gemEl(c, x, y, cls = "") {
  const inner = el("g", { class: `hg-gem c${c} ${cls}`.trim() }, CUTS[c](), el("path", { class: "hg-glint", d: "M-2.3-2.2Q-1.1-3.3.6-3.2" }));
  return el("g", { transform: `translate(${cx(x)} ${cy(y)})`, "data-cell": y * COLS + x }, inner);
}
const MIRROR = { "/": "M-3.7 3.7L3.7-3.7", "\\": "M-3.7-3.7L3.7 3.7" };
/** A mirror in its cell: the glass on a dark back, and a pip for each shot it has left. */
function mirrorEl(m, cls = "") {
  const g = el("g", { class: `hg-mir ${cls}`.trim(), transform: `translate(${cx(m.x)} ${cy(m.y)})` },
    el("path", { class: "hg-mir-back", d: MIRROR[m.t] }), el("path", { class: "hg-mir-face", d: MIRROR[m.t] }));
  for (let i = 0; i < (m.life ?? LIFE); i++) g.append(el("circle", { class: "hg-pip", cx: (i - 1) * 1.7, cy: 4.1, r: 0.6 }));
  return g;
}
const ARROW = { up: "M0-6.6L1.8-4.6H-1.8Z", right: "M6.6 0L4.6 1.8V-1.8Z", left: "M-6.6 0L-4.6-1.8V1.8Z" };
/** The heliograph: a brass ring, its glass the colour of this shot, a notch the way it faces. */
function sourceEl() {
  return el("g", { class: "hg-source", transform: `translate(${cx(SOURCE.x)} ${cy(SOURCE.y)})` },
    el("circle", { class: "hg-ring", r: 4.4 }), el("circle", { class: `hg-face c${S.queue[0]}`, r: 3 }),
    el("path", { class: "hg-glint", d: "M-1.7-1.6Q-.8-2.4.4-2.3" }), el("path", { class: "hg-arrow", d: ARROW[S.aim] }));
}
const pts = points => points.map(([x, y]) => `${cx(x).toFixed(2)},${cy(y).toFixed(2)}`).join(" ");
/** A beam's path in its legs, one a colour, each with its points (the relay's face in both) and how far along it starts. */
function legsOf(path) {
  const len = (a, b) => Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
  let run = 0;
  return path.legs.map((leg, k) => {
    const points = path.points.slice(leg.from, k + 1 < path.legs.length ? path.legs[k + 1].from + 1 : path.points.length);
    const start = run, length = points.slice(1).reduce((a, p, j) => a + len(points[j], p), 0);
    run += length;
    return { colour: leg.colour, points, start, length };
  });
}

/** The field as it stands, with `extra` (a mirror being laid, shown as it will be) and the beam's path drawn. */
function drawBoard(extra = null) {
  const svg = $("board");
  svg.setAttribute("viewBox", `0 0 ${COLS * CELL} ${ROWS * CELL}`);
  const dots = el("g", { class: "hg-dots" }), gems = el("g", { id: "gems" }), mirrors = el("g", { id: "mirrors" });
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = S.gems[y * COLS + x];
    if (c >= 0) gems.append(gemEl(c, x, y));
    else if (canPlace(S, x, y)) dots.append(el("circle", { class: "hg-dot", cx: cx(x), cy: cy(y), r: 0.45 }));
  }
  for (const m of S.mirrors) if (!(extra && extra.x === m.x && extra.y === m.y)) mirrors.append(mirrorEl(m));
  if (extra) mirrors.append(mirrorEl({ ...extra, life: LIFE }, "ghost"));
  // the beam's way as it would go now, in its colours: through the gems it would shatter (ringed) and the pairs that
  // would relay it (ringed whole), to where it stops
  const preview = el("g", { id: "preview" });
  if (!S.over) {
    const path = trace(S, extra);
    for (const leg of legsOf(path)) preview.append(el("polyline", { class: `hg-path c${leg.colour}`, points: pts(leg.points) }));
    for (const i of path.shattered) preview.append(el("circle", { class: "hg-hit", cx: cx(i % COLS), cy: cy(Math.floor(i / COLS)), r: 4.9 }));
    for (const i of path.relays) preview.append(el("circle", { class: "hg-relay", cx: cx(i % COLS), cy: cy(Math.floor(i / COLS)), r: 4.9 }));
    if (path.relays.length && (drag || picked || pending) && !read(RELAY, false)) { write(RELAY, true); toast("Two alike side by side relay the beam: it takes their colour and goes on"); }
  }
  const danger = el("line", { class: `hg-danger${lowest(S) >= ROWS - 3 ? " near" : ""}`, x1: 0, x2: COLS * CELL, y1: (ROWS - 1) * CELL, y2: (ROWS - 1) * CELL });
  svg.classList.toggle("dragging", !!(drag || picked));
  svg.replaceChildren(el("rect", { class: "hg-bed", width: COLS * CELL, height: ROWS * CELL }), dots, danger, gems, mirrors, preview, hintEl(), sourceEl(), el("g", { id: "fx" }));
}

/** A first game's first shots: how a mirror is laid, written on the field's empty middle (the drawn path says the
 *  rest), so nothing moves when it goes. */
function hintEl() {
  const g = el("g", { class: "hg-hint" });
  if (read(SEEN, false) || S.over || S.shots >= 3 || lowest(S) > 6) return g;
  const lines = picked || pending ? ["Now tap where it goes,", "and tap it again to fire"] : ["Drag a mirror onto the field", "to turn the beam; tap the", "heliograph to turn it"];
  lines.forEach((t, k) => { const n = el("text", { x: (COLS * CELL) / 2, y: 7.4 * CELL + k * 6 }); n.textContent = t; g.append(n); });
  return g;
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(BEST, 0), S.score));
  // the shots before the field comes down a row: one pip each, out of the gap between drops now
  const drop = $("drop"), of = dropEvery(S.shots);
  drop.replaceChildren(...Array.from({ length: of }, (_, i) => { const p = document.createElement("i"); if (i < S.untilDrop) p.className = "on"; return p; }));
  drop.setAttribute("aria-label", `The field comes down in ${S.untilDrop} shot${S.untilDrop === 1 ? "" : "s"}`);
}
const smallGem = (c, cls) => { const s = el("svg", { viewBox: "-5.5 -5.5 11 11", class: cls, "aria-hidden": "true" }); s.append(el("g", { class: `hg-gem c${c}` }, CUTS[c](), el("path", { class: "hg-glint", d: "M-2.3-2.2Q-1.1-3.3.6-3.2" }))); return s; };
const pieceSvg = t => el("svg", { viewBox: "-5 -5 10 10", "aria-hidden": "true" }, el("path", { class: "hg-mir-back", d: MIRROR[t] }), el("path", { class: "hg-mir-face", d: MIRROR[t] }));
function drawTray() {
  $("queue").replaceChildren(smallGem(S.queue[0], "now"), smallGem(S.queue[1], "next"));
  for (const b of document.querySelectorAll(".hg-piece")) {
    if (!b.firstChild) b.append(pieceSvg(b.dataset.t));
    b.classList.toggle("picked", picked === b.dataset.t);
    b.classList.toggle("lifted", drag?.t === b.dataset.t && drag.moved);
    b.disabled = S.over;
  }
  $("flashBtn").disabled = S.over;
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(BEST, 0);
    $("verdict").textContent = `The field reached the heliograph: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
  }
}
function render() {
  drawBoard(drag?.cell ? { ...drag.cell, t: drag.t } : pending);
  drawStrip();
  drawTray();
}

// ---------- a shot ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node.animate ? node.animate(frames, { fill: "forwards", ...opts }).finished.catch(() => {}) : Promise.resolve());
/** How far along the beam's path (in cells) it reaches each cell it crosses, to time each gem's shattering. */
function along(points) {
  const at = new Map();
  let run = 0;
  for (let k = 1; k < points.length; k++) {
    const [ax, ay] = points[k - 1], [bx, by] = points[k], len = Math.abs(bx - ax) + Math.abs(by - ay);
    const steps = Math.round(len), dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
    for (let s = 1; s <= steps; s++) { const x = Math.round(ax + dx * s), y = Math.round(ay + dy * s); if (!at.has(y * COLS + x)) at.set(y * COLS + x, run + s); }
    run += len;
  }
  return { at, total: run };
}
async function shoot(extra) {
  if (playing || S.over) return;
  const r = fire(S, extra);
  playing = true;
  pending = picked = null;
  drawBoard(extra);
  $("board").querySelector("#preview")?.remove();
  const fx = $("board").querySelector("#fx"), path = r.path, { at, total } = along(path.points);
  // the flash: the beam drawn out from the heliograph, a leg at a time in its colours, each gem it passes shattering
  // as it gets there and each pair that relays it lighting up
  const ms = Math.min(620, 140 + total * 26), when = d => ms * (d / Math.max(1, total)), lines = [];
  for (const leg of legsOf(path)) {
    const glow = el("polyline", { class: `hg-glow c${leg.colour}`, points: pts(leg.points), pathLength: 1 });
    const beam = el("polyline", { class: `hg-beam c${leg.colour}`, points: pts(leg.points), pathLength: 1 });
    fx.append(glow, beam);
    lines.push(glow, beam);
    for (const line of [glow, beam]) animate(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: Math.max(1, when(leg.length)), delay: when(leg.start), easing: "linear" });
  }
  const gemNode = i => $("board").querySelector(`#gems [data-cell="${i}"] .hg-gem`);
  for (const i of r.shattered) setTimeout(() => { gemNode(i)?.classList.add("shatter"); shards(fx, i, S.gems[i]); }, when(at.get(i) ?? total));
  for (const i of path.relays) setTimeout(() => gemNode(i)?.classList.add("relay"), when(at.get(i) ?? total));
  await wait(ms + 60);
  // what hung from nothing falls
  r.fallen.forEach((i, k) => setTimeout(() => gemNode(i)?.classList.add("fall"), k * 18));
  if (r.gain) popup(fx, r, path);
  for (const line of lines) animate(line, [{ opacity: line.classList.contains("hg-glow") ? 0.6 : 1 }, { opacity: 0 }], { duration: 260, delay: 60 });
  await wait(r.fallen.length ? 480 : 300);
  S = r.state;
  save();
  if (S.score > read(BEST, 0)) write(BEST, S.score);           // the games screen shows it at once
  if (S.shots >= 3) write(SEEN, true);
  render();
  if (r.dropped || r.cleared) await animate($("board").querySelector("#gems"), [{ transform: `translateY(${-CELL}px)` }, { transform: "translateY(0)" }], { duration: 260, easing: "ease-out" });
  if (r.cleared) toast("A clear field: 1,000 more");
  else if (r.crushed.length) toast(r.crushed.length === 1 ? "The field came down on a mirror" : `The field came down on ${r.crushed.length} mirrors`);
  playing = false;
}
/** Splinters of a shattered gem. */
function shards(fx, i, c) {
  const x = cx(i % COLS), y = cy(Math.floor(i / COLS));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + Math.random() * 0.8, d = 5 + Math.random() * 4;
    const s = el("path", { class: `hg-shard c${c}`, d: "M0-1.1L.9.7L-.9.7Z", transform: `translate(${x} ${y})` });
    fx.append(s);
    animate(s, [{ transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 }, { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d}px) rotate(${180 + Math.random() * 180}deg)`, opacity: 0 }],
      { duration: 360 + Math.random() * 160, easing: "ease-out" }).then(() => s.remove());
  }
}
/** What the shot brought in, rising from where it did most. */
function popup(fx, r, path) {
  const cells = [...r.shattered, ...r.fallen], x = cells.reduce((a, i) => a + cx(i % COLS), 0) / cells.length, y = cells.reduce((a, i) => a + cy(Math.floor(i / COLS)), 0) / cells.length;
  const t = el("text", { class: `hg-pop${cells.length >= 6 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(r.gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 900, easing: "ease-out" });
}

// ---------- laying a mirror ----------
/** The cell under a point on the screen, or null off the field. */
function cellAt(px, py) {
  const svg = $("board"), m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
  return x >= 0 && x < COLS && y >= 0 && y < ROWS ? { x, y } : null;
}
const screenCell = () => $("board").getBoundingClientRect().width / COLS;
function floatEl(t) {
  const d = document.createElement("div"), size = screenCell();
  d.className = "hg-float";
  d.style.width = d.style.height = `${size}px`;
  d.append(pieceSvg(t));
  document.body.append(d);
  return d;
}
function startDrag(e, t) {
  if (playing || S.over || e.button > 0) return;
  e.preventDefault();
  drag?.float.remove();
  // held above the finger, so the cell it's going to is in sight (a mouse needs no lift)
  drag = { t, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, lift: e.pointerType === "mouse" ? 0 : Math.max(48, screenCell() * 1.4), cell: null, float: floatEl(t) };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
  const px = e.clientX, py = e.clientY - (drag.moved ? drag.lift : 0), c = drag.moved ? cellAt(px, py) : null;
  const cell = c && canPlace(S, c.x, c.y) ? c : null, size = screenCell();
  drag.float.style.left = `${px - size / 2}px`;
  drag.float.style.top = `${py - size / 2}px`;
  drag.float.style.visibility = drag.moved && !cell ? "visible" : "hidden";   // on the field it's drawn in its cell
  if (cell?.x === drag.cell?.x && cell?.y === drag.cell?.y && drag.drawn) return;
  drag.cell = cell;
  drag.drawn = true;
  render();
}
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const { t, cell, moved } = drag;
  drag.float.remove();
  drag = null;
  if (moved && cell) { shoot({ ...cell, t }); return; }
  // a tap, not a drag: the mirror picked up (or put back), to lay with a tap on the field
  if (!moved) { picked = picked === t ? null : t; pending = null; }
  render();
}
function cancelDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.float.remove();
  drag = null;
  render();
}
/** A tap on the field: the heliograph turns; with a mirror picked up, it's laid where tapped, and a second tap fires. */
function tapField(e) {
  if (playing || S.over || drag) return;
  const c = cellAt(e.clientX, e.clientY);
  if (!c) return;
  if (c.x === SOURCE.x && c.y === SOURCE.y) { S.aim = nextAim(S.aim); save(); render(); return; }
  if (pending && pending.x === c.x && pending.y === c.y) { shoot(pending); return; }
  const t = picked || pending?.t;
  if (!t) return;
  if (!canPlace(S, c.x, c.y)) { toast("A mirror goes on an empty square"); return; }
  pending = { ...c, t };
  picked = null;
  render();
}
/** With a mouse and a mirror picked up, it's shown where it would go. */
function hoverField(e) {
  if (e.pointerType !== "mouse" || !picked || drag || playing) return;
  const c = cellAt(e.clientX, e.clientY), cell = c && canPlace(S, c.x, c.y) ? { ...c, t: picked } : null;
  if (cell?.x === pending?.x && cell?.y === pending?.y) return;
  pending = cell;
  drawBoard(pending);
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
  const best = read(BEST, 0), about = part(body, "about");
  about.append(line(`This game: ${fmt(S.score)} in ${S.shots} shot${S.shots === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "heliograph");
document.querySelector(".hg-mark").innerHTML = APPS.find(a => a.id === "heliograph").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
for (const b of document.querySelectorAll(".hg-piece")) b.addEventListener("pointerdown", e => startDrag(e, b.dataset.t));
addEventListener("pointermove", moveDrag);
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", cancelDrag);
$("board").addEventListener("pointerup", tapField);
$("board").addEventListener("pointermove", hoverField);
$("flashBtn").addEventListener("click", () => shoot(pending));
$("againBtn").addEventListener("click", newRun);
addEventListener("resize", () => { if (!playing) render(); });      // the screen turned

// for tests and debugging
window.__heliograph = { get state() { return S; }, set state(s) { S = s; render(); }, get pending() { return pending; }, shoot, cellAt, newRun };

S = read(RUN, null);
if (!valid(S)) newRun();
else render();
