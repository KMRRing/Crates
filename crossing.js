// Crossing: from one country to another across land borders, as few as you can. On a map with no borders: Easy lists the countries you may cross into and lights your way,
// Medium lights where you stand and has you type the next, Hard lights nothing; one that doesn't touch where you stand is a mistake. Five routes a run; each scores 100 at the fewest borders, less for each border
// beyond and each mistake. The rules are crossing-engine.js's; this file keeps the run, draws the map (Chart's projection,
// pan and pinch) and the page. Sea mode (ports, straits, canals, rivers) is crossing-sea-engine.js's, and its map and
// buttons crossing-sea-ui.js's; here it only joins the run, the menu and the canvas.
import { LEVELS, ROUTES, FULL, dealRun, begin, here, cross, back, giveUp, crossed, scoreOf, clean, totalOf, shortest, neighbours, countryOf, onLand } from "./crossing-engine.js";
import * as SE from "./crossing-sea-engine.js";
import * as SU from "./crossing-sea-ui.js";
import { COUNTRIES } from "./chart-countries.js";
import { projection, viewFitting, viewWindow, clampView, merc, fingers } from "./chart-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, todayPart } from "./menu.js";
import { ramp } from "./ramp.js";
import { sure } from "./sure.js";
import { today, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const RUN = "crossing:run", BEST = "crossing:best", DAILY = "crossing:daily", MODE = "crossing:mode";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// ---------- the run ----------
// S: { mode ("land" | "sea"), seed, level, daily, day, routes, index, now (the route in play), scores: [per finished route], over, total }
// A land route is { from, to, par }, a sea one { from, to, best } (the cheapest cost); `now` is that engine's route in play.
let S = read(RUN, null);
const save = () => write(RUN, S);
const modeNow = () => (read(MODE, "land") === "sea" ? "sea" : "land");
const isSea = () => S?.mode === "sea";
/** The ramp of a mode: land keeps the key it launched with, sea has its own (`crossing:ramp:sea`). */
const startLevel = (mode = modeNow()) => ramp("crossing", LEVELS, { start: "easy", id: mode === "sea" ? "sea" : "" });
const bestKey = (mode, level) => (mode === "sea" ? `sea:${level}` : level);
function newRun(daily = false) {
  const mode = modeNow(), seed = daily ? today() * 7919 + 11 : Math.floor(Math.random() * 2 ** 31), level = daily ? "medium" : startLevel(mode);
  S = { ...(mode === "sea" ? SE.dealRun(seed, level) : dealRun(seed, level)), mode, daily, day: daily ? today() : null, index: 0, scores: [], over: false, total: 0, seen: [] };
  S.now = (isSea() ? SE.begin : begin)(S.routes[0]);
  save(); refit(); render();
}
const route = () => S.routes[S.index];
/** A route over: its score is kept; the last one ends the run. */
function finish() {
  const r = S.now;
  if (isSea()) {
    S.scores[S.index] = SE.scoreOf(r, route().best);
    S.seen[S.index] = { from: r.from, to: r.to, cost: SE.costOf(r), best: route().best, gaveUp: r.gaveUp };
  } else {
    S.scores[S.index] = scoreOf(r);
    S.seen[S.index] = { from: r.from, to: r.to, par: r.par, crossed: crossed(r), mistakes: r.mistakes, gaveUp: r.gaveUp };
  }
  if (S.index === S.routes.length - 1) endRun();
  save();
}
function endRun() {
  S.over = true; S.total = S.scores.reduce((a, b) => a + b, 0);
  const key = bestKey(S.mode, S.level), best = read(BEST, {});
  if (!(best[key] >= S.total)) { best[key] = S.total; write(BEST, best); }
  if (S.daily) { const d = read(DAILY, {}); if (!(d[S.day ?? today()] >= S.total)) { d[S.day ?? today()] = S.total; write(DAILY, d); } }
  else { startLevel(S.mode); if (S.total >= FULL * ROUTES * 0.8) ramp.won(true); else if (S.total < FULL * ROUTES * 0.5) ramp.lost(); else ramp.won(false); }
  roundOver("crossing");
  setTimeout(showDone, 700);
}
function next() {
  if (S.over || !S.now.over) return;
  S.index++; S.now = (isSea() ? SE.begin : begin)(route());
  save(); refit(); render();
}

// ---------- the map ----------
const canvas = $("map");
let view = null, size = [1, 1];
const centre = name => { const c = countryOf(name); return { lon: c.lon, lat: c.lat }; };
let shown = null;                                  // the sea stage the view was fitted for, so a new stage refits and a pan stays
function refit() {
  if (!S || S.over) return;
  const [w, h] = size, r = route();
  shown = isSea() ? SE.stageOf(S.now) : null;
  view = isSea() ? viewFitting(SU.viewPoints(S.now), w, h, { minSpan: 10, pad: 1.5 })
    : viewFitting([centre(r.from), centre(r.to)], w, h, { minSpan: 24, pad: 1.6 });
}
function resize() {
  const box = canvas.parentElement.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (box.width < 2 || box.height < 2) return;
  canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
  size = [box.width, box.height];
  if (!view) refit(); else view = clampView(view, ...size);
  draw();
}
const proj = () => { const [w, h] = size, win = viewWindow(view, w, h); return { p: projection(win.lon0, win.lon1, win.lat0, win.lat1, w, h), win }; };

function draw() {
  if (!S || !view) return;
  const [w, h] = size, ctx = canvas.getContext("2d"), dpr = canvas.width / w, { p, win } = proj();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = css("--cx-sea"); ctx.fillRect(0, 0, w, h);
  const sea = isSea(), r = S.now, level = S.level, over = r.over;
  const at = sea ? null : here(r), path = new Set(sea ? [] : r.path);
  const best = !sea && over ? new Set(shortest(r.from, r.to)) : new Set();
  const trace = (t, ring) => { ring.forEach(([lon, lat], i) => { const [x, y] = p.toXY(lon, lat); if (i === 0) t.moveTo(x, y); else t.lineTo(x, y); }); t.closePath(); };
  ctx.lineJoin = "round";
  ctx.font = `${Math.round(10 * scale())}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const c of COUNTRIES) {
    if (!c.rings.some(ring => ring.some(([lon, lat]) => lon >= win.lon0 - 8 && lon <= win.lon1 + 8 && lat >= win.lat0 - 8 && lat <= win.lat1 + 8))) continue;
    const shape = new Path2D();
    for (const ring of c.rings) trace(shape, ring);
    ctx.fillStyle = css("--cx-land"); ctx.fill(shape, "evenodd");
    ctx.strokeStyle = css("--cx-land"); ctx.lineWidth = 0.8; ctx.stroke(shape);       // (a hairline in the land's own colour closes the seams between countries)
    if (over && best.has(c.name) && !path.has(c.name)) { ctx.globalAlpha = 0.35; ctx.fillStyle = css("--cx-goal"); ctx.fill(shape, "evenodd"); ctx.globalAlpha = 1; }
    // Easy lights the way you've come and where you stand, Medium only where you stand, Hard nothing
    if (!sea && (over || level === "easy" ? path.has(c.name) : level === "medium" && c.name === at)) { ctx.globalAlpha = c.name === at && !over ? 0.8 : 0.5; ctx.fillStyle = css("--cx-trail"); ctx.fill(shape, "evenodd"); ctx.globalAlpha = 1; }
    // no borders (9 Nov 2026): the land is one colour, so which countries touch is what you know, not what you see
    if (over && !sea && (c.name === r.from || c.name === r.to)) { ctx.strokeStyle = c.name === r.to ? css("--cx-goal") : css("--cx-trail"); ctx.lineWidth = 2.4; ctx.stroke(shape); }
  }
  if (sea) SU.draw(ctx, p, win, r, level, css, scale());
}
// ---------- gestures: drag to pan, pinch to zoom, tap to cross ----------
function gestures() {
  const touch = fingers();
  const at = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const pan = (dx, dy) => {
    const [w, h] = size, win = viewWindow(view, w, h);
    view = clampView({ lon: view.lon - dx / w * (win.lon1 - win.lon0), my: view.my + dy / h * (merc(win.lat1) - merc(win.lat0)), span: view.span }, w, h);
  };
  const zoomAt = (factor, px, py) => {
    const [w, h] = size, before = proj().p.toLonLat(px, py);
    view = clampView({ ...view, span: view.span / factor }, w, h, 4);
    const after = proj().p.toLonLat(px, py);
    view = clampView({ ...view, lon: view.lon + before[0] - after[0], my: view.my + merc(before[1]) - merc(after[1]) }, w, h, 4);
  };
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) canvas.addEventListener(type, e => e.preventDefault(), { passive: false });
  canvas.addEventListener("pointerdown", e => { try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ } touch.down(e.pointerId, ...at(e), e.isPrimary); });
  canvas.addEventListener("pointermove", e => {
    const g = touch.move(e.pointerId, ...at(e));
    if (!g) return;
    if (g.zoom) zoomAt(g.zoom, ...g.about);
    pan(...g.pan); draw();
  });
  const up = e => {
    const tap = touch.up(e.pointerId, e.type !== "pointerup")?.tap;
    if (tap && S && !S.over && !S.now.over && isSea() && S.level === "easy") { const act = SU.tapTarget(S.now, S.level, proj().p, ...tap); if (act) sea(act); }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, ...at(e)); draw(); }, { passive: false });
}

// ---------- playing ----------
let toastTimer = 0;
function toast(text, bad = false) {
  const t = $("toast"); t.textContent = text; t.classList.toggle("wrong", bad); t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800);
}
function step(name) {
  if (!name) return;
  const after = cross(S.now, name);
  if (after.note === "mistake") toast(`${name} doesn't border ${here(S.now)}`, true);
  if (after.note === "again" || after.note === "closed") return;
  S.now = after;
  if (after.over) finish();
  save(); render();
}
/** A choice at sea: a port to serve the end in hand, or the next water to sail to. A new stage refits the map. */
function sea(act) {
  const after = act.port ? SE.pick(S.now, act.port) : SE.sail(S.now, act.water);
  if (["no", "no lane", "again", "closed"].includes(after.note)) return;
  S.now = after;
  if (after.over) finish();
  save(); if (SE.stageOf(S.now) !== shown) refit(); render();
}
function undo() {
  if (!S || S.over) return;
  S.now = isSea() ? SE.back(S.now) : back(S.now);
  save(); if (isSea() && SE.stageOf(S.now) !== shown) refit(); render();
}
async function surrender() {
  if (!S || S.over || S.now.over) return;
  if (!(await sure(isSea() ? "Give up on this shipment? It scores nothing." : "Give up on this route? It scores nothing."))) return;
  S.now = (isSea() ? SE.giveUp : giveUp)(S.now); finish(); render();
}

// ---------- drawing the page ----------
const arrow = (a, b) => { const n = el("h2", "cx-route"), s = el("span", "cx-arrow", "→"); n.append(a, s, b); return n; };
function render() {
  if (!S) return;
  const r = S.now, done = r.over, sea = isSea();
  $("where").textContent = S.over ? `Run over · ${S.level}` : `${sea ? "Shipment" : "Route"} ${S.index + 1} of ${S.routes.length}${S.daily ? " · today's" : ""} · ${S.level}`;
  $("score").textContent = `Score ${S.scores.reduce((a, b) => a + (b || 0), 0)}`;
  $("route").replaceChildren(r.from, el("span", "cx-arrow", "→"), r.to);
  const trail = $("trail"), opts = $("opts");
  trail.replaceChildren(); opts.replaceChildren(); opts.hidden = done && !sea;
  if (sea) renderSea(trail, opts);
  else if (!done) {
    asking(opts, r, [...neighbours(here(r))].sort((a, b) => a.localeCompare(b)).map(n => ({ label: n, sub: "", disabled: r.path.includes(n), act: n })), step);
    trail.append(`${r.path.slice(0, -1).join(" › ")}${r.path.length > 1 ? " › " : ""}`, Object.assign(el("b"), { textContent: here(r) }),
      ` · ${plural(crossed(r), "border")} crossed${r.mistakes ? `, ${plural(r.mistakes, "mistake")}` : ""}`);
  } else {
    const best = shortest(r.from, r.to), got = scoreOf(r);
    trail.append(r.gaveUp ? `Fewest borders (${best.length - 1}): ${best.join(" › ")}`
      : `${got === FULL ? "At par" : `${plural(crossed(r), "border")}, par ${r.par}`}${r.mistakes ? `, ${plural(r.mistakes, "mistake")}` : ""}: ${got} points. Fewest (${best.length - 1}): ${best.join(" › ")}`);
  }
  $("backBtn").disabled = done || (sea ? SE.back(r) === r : r.path.length < 2);
  $("giveBtn").hidden = done; $("backBtn").hidden = done;
  $("nextBtn").hidden = !done || S.over;
  draw();
}
/** The sea's strip line and its panel: the ports or lanes to choose from, or at the end what the cheapest way was. */
function renderSea(trail, opts) {
  const r = S.now, lines = SU.summary(r, S.level);
  trail.textContent = r.over ? SU.trailText(r) : [SU.trailText(r), ...lines].join(" · ");
  if (r.over) { for (const text of lines) opts.append(el("p", "cx-sum", text)); return; }
  asking(opts, r, SU.options(r, S.level), sea);
}
/** The way to answer: Easy shows every move you may make as a button; Medium and Hard ask you to type where (a name from the same list). */
function asking(opts, r, list, act) {
  if (S.level === "easy") {
    for (const o of list) {
      const b = el("button", "cx-opt"); b.type = "button"; b.disabled = !!o.disabled;
      b.append(el("b", "", o.label)); if (o.sub) b.append(el("span", "", o.sub));
      b.addEventListener("click", () => act(o.act));
      opts.append(b);
    }
    return;
  }
  const form = el("form", "cx-type"), input = el("input"), go = el("button", "btn", "Go");
  input.autocomplete = "off"; input.autocapitalize = "words"; input.spellcheck = false; input.enterKeyHint = "go";
  input.placeholder = isSea() ? (SE.stageOf(r) === "sail" ? "The next water" : "A port") : "The next country"; input.setAttribute("aria-label", input.placeholder);
  go.type = "submit";
  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const hit = pickNamed(text, list);
    input.value = "";
    if (hit) { act(hit.act); return; }
    if (isSea()) { toast(`${text}: no lane there from here`, true); return; }
    const country = pickNamed(text, COUNTRIES.map(c => ({ label: c.name, act: c.name })));
    if (country) step(country.act); else toast(`No country called ${text}`, true);   // (one that exists but doesn't border is the usual mistake)
  });
  form.append(input, go);
  opts.append(form);
}
const norm = t => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
/** The option a typed name means: its name as typed (case, accents and a leading "the" aside), or the one name it starts (four letters at least). */
function pickNamed(text, list) {
  const t = norm(text);
  if (!t) return null;
  const exact = list.find(o => norm(o.label) === t);
  if (exact) return exact;
  const starts = t.length >= 4 ? list.filter(o => norm(o.label).startsWith(t)) : [];
  return starts.length === 1 ? starts[0] : null;
}
function showDone() {
  if (!S?.over) return;
  const body = $("doneBody"), best = read(BEST, {}), key = bestKey(S.mode, S.level);
  $("doneTitle").textContent = `${S.total} of ${ROUTES * FULL}`;
  const list = el("ul", "cx-result");
  S.seen.forEach((s, i) => {
    const li = el("li");
    li.append(el("span", "", `${s.from} → ${s.to}`), el("b", "", s.gaveUp ? "gave up" : `${S.scores[i]}`));
    list.append(li);
  });
  body.replaceChildren(list, el("p", "cx-best", `Best at ${S.level}: ${best[key] ?? "–"}`), action("New run", () => { $("doneDlg").close(); newRun(false); }, "primary"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- the menu ----------
async function setMode(mode) {
  if (mode === modeNow()) return;
  if (S && !S.over && S.index > 0 && !(await sure("Switch? This run isn't finished."))) { openMenu(); return; }
  write(MODE, mode); $("menuDlg").close(); newRun(false);
}
function openMenu() {
  const body = $("menuBody");
  startLevel();                                    // the shared level row follows the mode's ramp
  body.replaceChildren();
  part(body, "play").append(action("New run", () => { $("menuDlg").close(); newRun(false); }, "primary"));
  part(body, "content").append(choice("Mode", [["land", "Land"], ["sea", "Sea"]], modeNow(), setMode));
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    app: "crossing", done: got != null, result: got != null ? `${got} of ${ROUTES * FULL}` : "",
    play: () => { $("menuDlg").close(); newRun(true); }, playing: !!S?.daily && S.day === today() && !S.over, busy: !!S && !S.over && S.index > 0,
  });
  const best = read(BEST, {});
  const sea = modeNow() === "sea";
  part(body, "about").append(line(`Best: ${LEVELS.map(l => `${l} ${best[bestKey(modeNow(), l)] ?? "–"}`).join(", ")} · ${sea ? `${SE.ports.length} ports, ${SE.waters.length} waters` : `${COUNTRIES.filter(c => onLand(c.name)).length} countries on the big land`}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".cx-mark").innerHTML = APPS.find(a => a.id === "crossing").logo;
bindSwitcher($("appsBtn"), "crossing");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("backBtn").addEventListener("click", undo);
$("giveBtn").addEventListener("click", surrender);
$("nextBtn").addEventListener("click", next);
gestures();
new ResizeObserver(resize).observe(canvas.parentElement);
window.addEventListener("resize", resize);
async function openToday() {
  if (S && !S.over && S.index > 0 && !(await sure("Start today's run? This one isn't finished."))) return;
  newRun(true);
}
// opening: from the tile, today's; a finished run gives way to today's while it's still to play, else a random one
if (arrivedForToday() && !(S?.daily && S.day === today())) { if (S && !S.over) render(); setTimeout(openToday, 0); }
else if (!S || S.over) newRun(dailyDue("crossing"));
else render();
if (S && S.over) showDone();
resize();

// for tests and debugging
window.__crossing = { get state() { return S; }, step, sea, newRun, undo };
