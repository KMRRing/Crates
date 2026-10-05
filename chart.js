// Chart: pin a place on the map. Drag and pinch the world to where you want, tap to place the pin, pin it; then
// see the truth, the distance and the points. Together, both of you pin the same place in private and the pins
// are revealed side by side.
import { PER_SET, distance, score, pickSet, projection, worldAspect, worldView, viewAround, viewWindow, clampView, viewCovering, merc, unmerc, LAT_MAX } from "./chart-engine.js";
import { PLACES, CATS } from "./chart-bank.js";
import { LAND, BORDERS } from "./world.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { gameHref, GAMES } from "./rooms.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const APP = 1;
const RUN = "chart:run", BEST = "chart:best", DAILY = "chart:daily";
const byId = new Map(PLACES.map(p => [p.id, p]));

let S = null;        // alone: { seed, mode, set, index, score, log: [{ id, lat, lon, km, pts }], phase: "pin" | "reveal", done }
                     // together: the room: { seed, set, index, pins: { seat: { lat, lon } }, scores: [2], log, done, players }
let pin = null;      // the provisional pin { lat, lon }
let views = { world: worldView() };                // what the map shows: pan and pinch move it
const SIZES = { world: [360, Math.round(360 / worldAspect())] };
const inRoom = () => !!together.room;
const mySeat = () => together.room?.data?.players?.[together.room.uid]?.slot ?? 0;
const seatName = seat => { const p = seatsOf(together.room?.data)?.find(([, x]) => x.slot === seat)?.[1]; return p ? p.name : seat === mySeat() ? "You" : "Your partner"; };

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => { if (!inRoom()) write(RUN, S); };
const current = () => byId.get(S.set[S.index]);
const km = d => (d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d).toLocaleString("en-GB")} km`);

// ---------- the run ----------
function start(mode) {
  const seed = mode === "daily" ? today() : randomSeed();
  S = { seed, mode, set: pickSet(seed, PLACES).map(p => p.id), index: 0, score: 0, log: [], phase: "pin", done: false };
  save();
  history.replaceState(null, "", mode === "daily" ? `#d=${seed}` : `#s=${seed}`);
  pin = null; views = { world: worldView() };
  render();
}
function confirmPin() {
  if (!pin) return;
  const p = current();
  if (inRoom()) {
    together.act(g => { if (g.phase !== "pin") return false; g.pins = { ...(g.pins || {}), [mySeat()]: pin }; if (g.pins[0] && g.pins[1]) settleRoom(g); });
    return;
  }
  if (S.phase !== "pin") return;
  const d = distance(pin, p), pts = score(d);
  S.score += pts;
  S.log.push({ id: p.id, lat: pin.lat, lon: pin.lon, km: d, pts });
  S.phase = "reveal";
  save();
  render();
}
function next() {
  if (inRoom()) {
    together.act(g => {
      if (g.phase !== "reveal") return false;
      if (g.index + 1 >= g.set.length) { g.done = true; return; }
      g.index++; g.pins = {}; g.phase = "pin";
    });
    pin = null; views = { world: worldView() };
    return;
  }
  if (S.phase !== "reveal") return;
  if (S.index + 1 >= S.set.length) { S.done = true; save(); finish(); return; }
  S.index++;
  S.phase = "pin";
  pin = null; views = { world: worldView() };
  save();
  render();
}

// ---------- drawing the maps ----------
function setup(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.aspectRatio = `${w} / ${h}`; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
/** Draws land (polygon by polygon, holes included) and borders through a projection onto a w×h context. */
function drawMap(ctx, proj, win, w, h) {
  ctx.fillStyle = css("--ch-sea");
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css("--ch-land");
  const inView = ring => ring.some(([lon, lat]) => lon >= win.lon0 - 5 && lon <= win.lon1 + 5 && lat >= win.lat0 - 5 && lat <= win.lat1 + 5)
    || ring.some(([lon]) => lon < win.lon0) && ring.some(([lon]) => lon > win.lon1);
  for (const poly of LAND) {
    if (!inView(poly[0])) continue;
    ctx.beginPath();
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.closePath();
    }
    ctx.fill("evenodd");
  }
  const span = win.lon1 - win.lon0;
  ctx.strokeStyle = css("--ch-border");
  ctx.lineWidth = span > 100 ? 0.6 : 1.1;
  ctx.beginPath();
  for (const line of BORDERS) line.forEach(([lon, lat], i) => { const [x, y] = proj.toXY(lon, lat); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  if (span <= 60) {                                              // a light graticule helps judge scale when zoomed in
    const step = span > 30 ? 5 : span > 12 ? 2 : 1;
    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = Math.ceil(win.lon0 / step) * step; lon <= win.lon1; lon += step) { const [x] = proj.toXY(lon, 0); ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let lat = Math.ceil(win.lat0 / step) * step; lat <= win.lat1; lat += step) { const [, y] = proj.toXY(0, lat); ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
}
function marker(ctx, x, y, kind) {
  ctx.beginPath();
  if (kind === "truth") {
    ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = css("--ch-good"); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  } else {
    ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = kind === "theirs" ? "#7A4BC9" : css("--ch-in"); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#fff"; ctx.stroke();
  }
}
function line(ctx, a, b, colour) {
  ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
}
const projFor = name => { const [w, h] = SIZES[name], win = viewWindow(views[name], w, h); return { proj: projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h), win, w, h }; };

/** The map as it stands: pins, and after the reveal the truth and the lines. */
function drawMaps() {
  const p = current(), reveal = S.phase === "reveal";
  const pins = inRoom() ? [[pinOf(mySeat()), "mine"], [pinOf(1 - mySeat()), "theirs"]] : [[reveal ? S.log[S.index] : pin, "mine"]];
  for (const name of ["world"]) {
    const canvas = $(name);
    const { proj, win, w, h } = projFor(name);
    const ctx = setup(canvas, w, h);
    drawMap(ctx, proj, win, w, h);
    const colour = kind => (kind === "theirs" ? "#7A4BC9" : css("--ch-in"));
    if (reveal) for (const [q, kind] of pins) if (q) line(ctx, proj.toXY(q.lon, q.lat), proj.toXY(p.lon, p.lat), colour(kind));
    for (const [q, kind] of pins) if (q) marker(ctx, ...proj.toXY(q.lon, q.lat), kind);
    if (reveal) marker(ctx, ...proj.toXY(p.lon, p.lat), "truth");
  }
}
const pinOf = seat => (S.phase === "reveal" ? Object.values(S.log || {})[S.index]?.pins?.[seat] : seat === mySeat() ? pin : null);

// ---------- gestures: drag to pan, pinch to zoom, tap to pin ----------
const canPin = () => S.phase === "pin" && !(inRoom() && S.pins?.[mySeat()]);
function gestures(name) {
  const canvas = $(name), pointers = new Map();
  let moved = 0, pinching = false;
  const at = e => { const r = canvas.getBoundingClientRect(); const [w, h] = SIZES[name]; return [(e.clientX - r.left) / r.width * w, (e.clientY - r.top) / r.height * h]; };
  const pan = (dx, dy) => {                                   // a pixel shift becomes a shift of the view's centre
    const [w, h] = SIZES[name], win = viewWindow(views[name], w, h), v = views[name];
    views[name] = clampView({ lon: v.lon - dx / w * (win.lon1 - win.lon0), my: v.my + dy / h * (merc(win.lat1) - merc(win.lat0)), span: v.span }, w, h);
  };
  const zoomAt = (factor, px, py) => {                        // zoom about a point so it stays under the fingers
    const [w, h] = SIZES[name], before = projFor(name).proj.toLonLat(px, py), v = views[name];
    views[name] = clampView({ ...v, span: v.span / factor }, w, h);
    const after = projFor(name).proj.toLonLat(px, py);
    views[name] = clampView({ ...views[name], lon: views[name].lon + before[0] - after[0], my: views[name].my + merc(before[1]) - merc(after[1]) }, w, h);
  };
  canvas.addEventListener("pointerdown", e => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    pointers.set(e.pointerId, at(e));
    if (pointers.size === 1) { moved = 0; pinching = false; }
    if (pointers.size === 2) pinching = true;
  });
  canvas.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId), now = at(e);
    if (pointers.size === 1) { pan(now[0] - prev[0], now[1] - prev[1]); moved += Math.hypot(now[0] - prev[0], now[1] - prev[1]); }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], other = a === prev ? b : a;
      const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]), d1 = Math.hypot(now[0] - other[0], now[1] - other[1]);
      const mid = [(now[0] + other[0]) / 2, (now[1] + other[1]) / 2];
      if (d0 > 0) zoomAt(d1 / d0, mid[0], mid[1]);
      pan((now[0] - prev[0]) / 2, (now[1] - prev[1]) / 2);
      moved += 10;
    }
    pointers.set(e.pointerId, now);
    drawMaps();
  });
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    const [px, py] = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (e.type === "pointerup" && pointers.size === 0 && !pinching && moved < 8 && canPin()) {
      const [lon, lat] = projFor(name).proj.toLonLat(px, py);
      pin = { lat: Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)), lon: Math.max(-180, Math.min(180, lon)) };
      render();
    }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); const [px, py] = at(e); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, px, py); drawMaps(); }, { passive: false });
}

// ---------- drawing the page ----------
function render() {
  if (!S) return;
  const p = current(), reveal = S.phase === "reveal";
  $("where").textContent = `Place ${S.index + 1} of ${S.set.length}`;
  const scores = $("scores");
  if (inRoom()) {
    scores.className = "ch-score two";
    scores.replaceChildren(...[mySeat(), 1 - mySeat()].map(seat => { const b = document.createElement("b"); b.textContent = `${seatName(seat)} ${Object.values(S.scores || [0, 0])[seat].toLocaleString("en-GB")}`; return b; }));
  } else {
    scores.className = "ch-score";
    scores.replaceChildren();
    const b = document.createElement("b"); b.id = "score"; b.textContent = S.score.toLocaleString("en-GB"); scores.appendChild(b);
  }
  $("cat").textContent = CATS[p.cat];
  $("place").textContent = p.name;
  const waitingForThem = inRoom() && S.phase === "pin" && S.pins?.[mySeat()];
  $("hint").textContent = reveal ? "Drag and pinch to look around." : waitingForThem ? `Pinned. Waiting for ${seatName(1 - mySeat())}…` : pin ? "Tap to move the pin, or pin it. Drag to pan, pinch to zoom." : "Tap to place the pin. Drag to pan, pinch to zoom.";
  if (reveal && !views.revealSet) {                       // the map frames the truth and the pin together
    const e = inRoom() ? Object.values(S.log)[S.index]?.pins?.[mySeat()] : S.log[S.index];
    views.world = e ? viewCovering(e, p, ...SIZES.world, 12) : clampView(viewAround(p.lon, p.lat, 20), ...SIZES.world);
    views.revealSet = true;
  }
  if (!reveal) views.revealSet = false;
  $("pinBtn").hidden = reveal;
  $("pinBtn").disabled = !pin || waitingForThem;
  $("pinBtn").textContent = waitingForThem ? "Pinned" : "Pin it";
  drawMaps();
  const result = $("result");
  result.hidden = !reveal;
  if (reveal) {
    const v = $("verdict");
    if (inRoom()) {
      const e = Object.values(S.log)[S.index], me = mySeat();
      const mine = e.km[me], theirs = e.km[1 - me], pm = e.pts[me], pt = e.pts[1 - me];
      v.className = `ch-verdict ${mine <= theirs ? "good" : "bad"}`;
      v.textContent = `You were ${km(mine)} off (+${pm}); ${seatName(1 - me)} ${km(theirs)} off (+${pt}).`;
    } else {
      const e = S.log[S.index];
      v.className = `ch-verdict ${e.km < 500 ? "good" : "bad"}`;
      v.textContent = `${km(e.km)} off: +${e.pts}`;
    }
    $("note").textContent = p.note || "";
    $("nextBtn").textContent = S.index + 1 >= S.set.length ? "The set" : "Next";
  }
  if (inRoom() && S.done) finishRoom();
}

// ---------- the end of a set ----------
function finish() {
  const best = S.mode === "daily" ? bestDaily(S.score) : bestEver(S.score);
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "ch-big", S.score.toLocaleString("en-GB"));
  const avg = S.log.reduce((t, e) => t + e.km, 0) / S.log.length, close = S.log.filter(e => e.km < 100).length;
  const stats = add("div", "ch-stats");
  for (const [v, label] of [[km(avg), "average miss"], [`${close}`, "within 100 km"], [best.toLocaleString("en-GB"), S.mode === "daily" ? "today's best" : "your best"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const lines = add("ul", "ch-lines");
  for (const e of S.log) {
    const q = byId.get(e.id), li = document.createElement("li"), name = document.createElement("span"), pts = document.createElement("b");
    name.textContent = q.name.length > 34 ? `${q.name.slice(0, 32)}…` : q.name;
    pts.textContent = `${km(e.km)} · +${e.pts}`;
    li.append(name, pts);
    lines.appendChild(li);
  }
  const again = add("button", "btn primary wide", "Again");
  again.type = "button"; again.addEventListener("click", () => { $("doneDlg").close(); start("random"); });
  const daily = add("button", "btn wide", S.mode === "daily" ? "A random set" : "Today's set");
  daily.type = "button"; daily.addEventListener("click", () => { $("doneDlg").close(); start(S.mode === "daily" ? "random" : "daily"); });
  const link = add("button", "btn wide", "Copy a link to this set");
  link.type = "button"; link.addEventListener("click", copyLink);
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
function bestEver(s) { const b = Math.max(read(BEST, 0), s); write(BEST, b); return b; }
function bestDaily(s) { const d = read(DAILY, {}); d[today()] = Math.max(d[today()] || 0, s); write(DAILY, d); return d[today()]; }

// ---------- together ----------
/** Both pins are in: settle the place for both. */
function settleRoom(g) {
  const p = byId.get(g.set[g.index]);
  const kms = [0, 1].map(seat => distance(g.pins[seat], p)), pts = kms.map(score);
  g.scores = Object.values(g.scores || [0, 0]).map((s, seat) => s + pts[seat]);
  g.log = Object.values(g.log || {});
  g.log.push({ id: p.id, pins: { 0: g.pins[0], 1: g.pins[1] }, km: kms, pts });
  g.phase = "reveal";
}
function freshRoom(players) {
  const seed = randomSeed();
  return { v: 1, app: APP, seed, set: pickSet(seed, PLACES).map(p => p.id), index: 0, pins: {}, scores: [0, 0], log: [], phase: "pin", done: false, created: Date.now(), players };
}
function startRoomSet() {
  const n = freshRoom(null);
  together.act(g => { Object.assign(g, { seed: n.seed, set: n.set, index: 0, pins: {}, scores: [0, 0], log: [], phase: "pin", done: false }); });
  pin = null; views = { world: worldView() };
}
let shownBell = null;
function finishRoom() {
  const g = S, me = mySeat(), key = `${g.seed}/${g.index}`;
  if (shownBell === key) return;
  shownBell = key;
  const scores = Object.values(g.scores);
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "ch-big", scores[me] > scores[1 - me] ? "You win" : scores[me] < scores[1 - me] ? `${seatName(1 - me)} wins` : "A draw");
  const stats = add("div", "ch-stats");
  for (const [v, label] of [[scores[me].toLocaleString("en-GB"), "you"], [scores[1 - me].toLocaleString("en-GB"), seatName(1 - me)], [`${Object.values(g.log).filter(e => e.km[me] < e.km[1 - me]).length}`, "places you were closer"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const again = add("button", "btn primary wide", "Play again");
  again.type = "button"; again.addEventListener("click", () => { $("doneDlg").close(); startRoomSet(); });
  const leave = add("button", "btn wide", "Leave the room");
  leave.type = "button"; leave.addEventListener("click", () => { $("doneDlg").close(); together.leave(); });
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
function onState(val) {
  const was = S;
  S = val;
  if (!was || was.index !== val.index || was.seed !== val.seed) { pin = null; views = { world: worldView() }; }
  drawPartner();
  render();
}
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append("Reconnecting…"); return; }
  const p = together.partner();
  if (!p) { el.append(`Room ${together.room.code}: waiting for your partner.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online ? "" : " (away)");
  if (p.game && p.game !== "chart") {
    const a = document.createElement("a");
    a.href = gameHref(p.game);
    a.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, a);
    return;
  }
  el.append("Pinning against ", b, ".");
}
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
const together = createTogether({
  game: "chart",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1 && Array.isArray(g.set),
  fresh: freshRoom,
  onState,
  onPresence: drawPartner,
  onLeave: () => { shownBell = null; S = read(RUN, null); pin = null; views = { world: worldView() }; drawPartner(); if (!S) start("random"); else render(); },
});

// ---------- menu, links, messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${S.mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  const room = together.room;
  if (!room) {
    add("p", "stats", "Pin a place on the map. Tap the world, fine-tune in the close-up, pin. Points fall off with distance: 1,000 on the spot, about 600 at 1,000 km, and 100 extra within 100 km.");
    button("A new set", () => confirmStart("random"));
    button("Today's set", () => confirmStart("daily"));
    if (S?.done) button("See how it went", finish);
    button("Copy a link to this set", copyLink);
    const best = read(BEST, 0), daily = read(DAILY, {})[today()];
    add("p", "stats", `${best ? `Your best: ${best.toLocaleString("en-GB")}.` : "No finished set yet."}${daily != null ? ` Today's best: ${daily.toLocaleString("en-GB")}.` : ""}`);
    add("h3", null, "Together");
    add("p", "stats", "Two phones: you both pin the same place in private, then the pins are revealed side by side. Higher total wins.");
    button("Play together", async () => { if (await together.start()) openMenu(); });
    const row = add("form", "join-run");
    const input = document.createElement("input");
    input.placeholder = "Code"; input.maxLength = 4; input.autocapitalize = "characters";
    const go = document.createElement("button");
    go.className = "btn"; go.type = "submit"; go.textContent = "Join";
    row.append(input, go);
    row.addEventListener("submit", e => {
      e.preventDefault();
      const code = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (code.length === 4) { $("menuDlg").close(); together.join(code); }
    });
  } else {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    add("h3", null, `Room ${room.code}`);
    add("p", "stats", "Send this link to your partner. Switching games (tap the title) keeps you both in this room.");
    add("p", "room-link", link);
    button("Copy link", async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); } });
    button("A fresh set", startRoomSet);
    button("Leave the room", () => together.leave(), "link");
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new set? This one isn't finished.")) return;
  start(mode);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "chart");
document.querySelector(".ch-mark").innerHTML = APPS.find(a => a.id === "chart").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
gestures("world");
$("pinBtn").addEventListener("click", confirmPin);
$("nextBtn").addEventListener("click", next);
window.addEventListener("resize", () => { if (S) drawMaps(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S) drawMaps(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (h.get("s") || h.get("d")) load(h); });

function load(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random";
  if (!seed) return false;
  if (S && S.seed === seed && S.mode === mode) return true;
  S = { seed, mode, set: pickSet(seed, PLACES).map(p => p.id), index: 0, score: 0, log: [], phase: "pin", done: false };
  save();
  pin = null; views = { world: worldView() };
  render();
  return true;
}

// for tests and debugging
window.__chart = { get state() { return S; }, get views() { return views; }, setPin: (lat, lon) => { pin = { lat, lon }; render(); }, confirmPin, next, start, get together() { return together; } };

S = read(RUN, null);
if (S && (!S.set || !S.set.every(id => byId.has(id)))) S = null;
const hash = new URLSearchParams(location.hash.slice(1));
if (!load(hash)) {
  if (!S) start("random");
  else { history.replaceState(null, "", S.mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`); render(); }
}
if (S.done) finish();
const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
if (code.length === 4) together.join(code);
