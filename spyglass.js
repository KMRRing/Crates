// Spyglass: a picture comes into focus through a brass-bound lens over about 20 seconds, and the sooner you say what it is the more
// it's worth. A run is five pictures: paintings (public domain only, from Punt's art bank), flags and country outlines. Easy
// gives four answers to choose from, Medium eight, Hard a line to type in. The rules are spyglass-engine.js's; this file
// keeps the run, draws the lens and builds the page.
import { LEVELS, ROUNDS, FULL, SECONDS, WRONG, paintings, flags, outlines, dealRun, fraction, focus, worth, matches, norm } from "./spyglass-engine.js";
import { MATHS as ART } from "./art-bank.js";
import { MATHS as FLAGS } from "./flags-bank.js";
import { COUNTRIES, REGION_OF } from "./chart-countries.js";
import { FLAGS as FLAG_DRAWINGS, COLOURS, rasterFlag } from "./nonogram-flags.js";
import { pictureUrls } from "./pics.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, todayPart, isPaused } from "./menu.js";
import { ramp } from "./ramp.js";
import { sure } from "./sure.js";
import { busy } from "./loading.js";
import { today, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const RUN = "spyglass:run", BEST = "spyglass:best", DAILY = "spyglass:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const POOLS = { painting: paintings(ART), flag: flags(FLAGS).filter(f => FLAG_DRAWINGS[f.id]), outline: outlines(COUNTRIES, REGION_OF) };
const ASK = { painting: "Who painted this?", flag: "Whose flag is this?", outline: "Which country is this?" };

// ---------- the run ----------
// S: { seed, level, daily, day, items, index, scores: [points per picture, null while it's open], elapsed (seconds on the open one),
//      wrong (guesses so far on it), tried (typed guesses already counted), over, total }
let S = read(RUN, null);
const save = () => write(RUN, S);
const startLevel = () => ramp("spyglass", LEVELS, { start: "easy" });
function newRun(daily = false) {
  const seed = daily ? today() * 6151 + 7 : Math.floor(Math.random() * 2 ** 31), level = daily ? "medium" : startLevel();
  S = { ...dealRun(seed, level, POOLS), daily, day: daily ? today() : null, index: 0, scores: [], elapsed: 0, wrong: 0, tried: [], over: false, total: 0 };
  save(); begin();
}
const item = () => S.items[S.index];
const answered = () => S.scores[S.index] != null;

// ---------- the picture ----------
let source = null;                                 // { img (an Image or canvas), w, h } for the open picture
let phase = "loading";                             // loading, look (the clock runs), shown (answered or passed)
let reveal = { from: 0, at: 0 };                   // after an answer the focus runs on to sharp
let token = 0;

const load = url => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
/** A flag painted from Nonogram's own flag drawings, not its emoji: where the device has no flag emoji (Windows) the emoji is two letters. */
function flagSource(it) {
  const flag = FLAG_DRAWINGS[it.id], W = 640, H = Math.round(W / flag.r), cols = 320, rows = Math.round(cols / flag.r), cell = W / cols;
  const c = document.createElement("canvas"); c.width = 640; c.height = 427;
  const x = c.getContext("2d");
  x.fillStyle = "#EFE6CF"; x.fillRect(0, 0, 640, 427);
  const { letters } = rasterFlag(flag, cols, rows, 2);
  const fit = Math.min(1, 427 / H), k = fit;        // (a tall flag is shrunk to the lens)
  const ox = (640 - W * k) / 2, oy = (427 - H * k) / 2;
  letters.forEach((l, i) => { if (l === "_") return; x.fillStyle = COLOURS[l]; x.fillRect(ox + (i % cols) * cell * k, oy + Math.floor(i / cols) * (H / rows) * k, cell * k + 1, (H / rows) * k + 1); });
  return { img: c, w: 640, h: 427 };
}
function outlineSource(name) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 427;
  const x = c.getContext("2d"), country = COUNTRIES.find(k => k.name === name);
  const span = country.rings.flat().reduce((m, [lon]) => [Math.min(m[0], lon), Math.max(m[1], lon)], [180, -180]);
  const wrap = span[1] - span[0] > 180, shift = lon => (wrap && lon < 0 ? lon + 360 : lon);
  const pts = country.rings.flat(), lats = pts.map(p => p[1]), lons = pts.map(p => shift(p[0]));
  const lat0 = Math.min(...lats), lat1 = Math.max(...lats), lon0 = Math.min(...lons), lon1 = Math.max(...lons);
  const kx = Math.cos((lat0 + lat1) / 2 * Math.PI / 180), k = Math.min(540 / ((lon1 - lon0) * kx || 1), 340 / (lat1 - lat0 || 1));
  const ox = 320 - (lon0 + lon1) / 2 * kx * k, oy = 213 + (lat0 + lat1) / 2 * k;
  x.fillStyle = "#C9D7DC"; x.fillRect(0, 0, 640, 427);
  x.fillStyle = "#F3ECDC"; x.strokeStyle = "#4A3F2A"; x.lineWidth = 2; x.lineJoin = "round";
  x.beginPath();
  for (const ring of country.rings) ring.forEach(([lon, lat], i) => { const X = shift(lon) * kx * k + ox, Y = oy - lat * k; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); });
  x.fill("evenodd"); x.stroke();
  return { img: c, w: 640, h: 427 };
}
async function sourceFor(it) {
  if (it.kind === "flag") return flagSource(it);
  if (it.kind === "outline") return outlineSource(it.name);
  const urls = await pictureUrls(it.pic, 960);
  if (!urls) return null;
  for (const u of [...new Set([urls.t, urls.o])]) { try { const img = await load(u); return { img, w: img.naturalWidth, h: img.naturalHeight }; } catch { /* try the original */ } }
  return null;
}

/** Starts the open picture: fetches it, builds the answers, and lets the clock run once there is something to see. */
async function begin() {
  const me = ++token;
  phase = "loading"; source = null;
  $("caption").hidden = true; $("passBtn").hidden = false; $("nextBtn").hidden = true;
  render();
  if (answered()) { phase = "shown"; reveal = { from: 1, at: 1 }; source = await sourceFor(item()); if (me === token) { showCaption(); render(); } return; }
  const done = busy("", { delay: 350 });
  try { source = await sourceFor(item()); } finally { done(); }
  if (me !== token) return;
  if (!source) {                                   // a painting that won't load (offline): a flag or outline in its place
    const spare = dealRun(S.seed + 17 * (S.index + 1) + S.elapsed, S.level, POOLS).items.find(i => i.kind !== "painting" && !S.items.some(o => o.answer === i.answer));
    S.items[S.index] = spare; save(); return begin();
  }
  phase = "look"; render();
}
const u = () => (phase === "shown" ? reveal.at : fraction(S.elapsed, S.level));

// ---------- the lens ----------
const canvas = $("lens"), box = $("lensBox"), low = document.createElement("canvas");
let size = [1, 1];
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1), inner = [box.clientWidth, box.clientHeight];
  if (inner[0] < 2 || inner[1] < 2) return;
  canvas.width = Math.round(inner[0] * dpr); canvas.height = Math.round(inner[1] * dpr); size = [canvas.width, canvas.height];
}
/** The picture through the lens now: the crop for the zoom, drawn at the blur's resolution and stretched to the glass. */
function draw() {
  if (!S || S.over) return;
  const ctx = canvas.getContext("2d"), [cw, ch] = size;
  ctx.fillStyle = "#141A1F"; ctx.fillRect(0, 0, cw, ch);
  if (!source || phase === "loading") return;
  const { res, zoom } = focus(u()), a = cw / ch, W0 = Math.max(source.w, source.h * a), H0 = W0 / a, it = item();
  const W = W0 * zoom, H = H0 * zoom;
  const cx = Math.max(W / 2 - (W0 - source.w) / 2, Math.min(source.w - W / 2 + (W0 - source.w) / 2, zoom < 1 ? it.cx * source.w : source.w / 2));
  const cy = Math.max(H / 2 - (H0 - source.h) / 2, Math.min(source.h - H / 2 + (H0 - source.h) / 2, zoom < 1 ? it.cy * source.h : source.h / 2));
  const sx = cx - W / 2, sy = cy - H / 2;
  // the part of the window that lies on the picture (a wide window around a narrow picture leaves margins)
  const ix0 = Math.max(0, sx), iy0 = Math.max(0, sy), ix1 = Math.min(source.w, sx + W), iy1 = Math.min(source.h, sy + H);
  if (ix1 <= ix0 || iy1 <= iy0) return;
  const dx = (ix0 - sx) / W * cw, dy = (iy0 - sy) / H * ch, dw = (ix1 - ix0) / W * cw, dh = (iy1 - iy0) / H * ch;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  if (res >= cw) { ctx.drawImage(source.img, ix0, iy0, ix1 - ix0, iy1 - iy0, dx, dy, dw, dh); return; }
  const lw = Math.max(2, res), lh = Math.max(2, Math.round(res * ch / cw));
  low.width = lw; low.height = lh;
  const lc = low.getContext("2d");
  lc.imageSmoothingEnabled = true;
  lc.drawImage(source.img, ix0, iy0, ix1 - ix0, iy1 - iy0, dx / cw * lw, dy / ch * lh, dw / cw * lw, dh / ch * lh);
  ctx.drawImage(low, 0, 0, lw, lh, 0, 0, cw, ch);
}
let last = 0, savedAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!S || S.over) return;
  if (phase === "look" && !isPaused() && document.visibilityState === "visible") {
    S.elapsed += dt;
    if (Math.floor(S.elapsed) !== savedAt) { savedAt = Math.floor(S.elapsed); save(); }
    $("worth").replaceChildren("Worth ", Object.assign(el("b"), { textContent: worth(u(), S.wrong) }));
  } else if (phase === "shown" && reveal.at < 1) reveal.at = Math.min(1, reveal.at + dt / 0.8);
  draw();
}

// ---------- guessing ----------
function good() {
  const points = worth(fraction(S.elapsed, S.level), S.wrong);
  S.scores[S.index] = points;
  conclude(`+${points}`);
}
function bad() { S.wrong++; save(); }
function conclude(text) {
  reveal = { from: fraction(S.elapsed, S.level), at: fraction(S.elapsed, S.level) };
  phase = "shown"; save();
  $("worth").textContent = text;
  showCaption();
  if (S.index === S.items.length - 1) endRun();
  render();
}
function showCaption() { $("caption").textContent = item().caption; $("caption").hidden = false; }
function pass() {
  if (phase !== "look") return;
  S.scores[S.index] = 0; conclude("Passed");
}
function guess(text) {
  if (phase !== "look") return null;
  if (matches(item(), text)) { good(); return true; }
  const key = norm(text);
  if (!S.tried.includes(key)) { S.tried.push(key); bad(); }
  render();
  return false;
}
function next() {
  if (phase !== "shown" || S.over) return;
  S.index++; S.elapsed = 0; S.wrong = 0; S.tried = [];
  save(); begin();
}
function endRun() {
  S.over = true; S.total = S.scores.reduce((a, b) => a + (b || 0), 0);
  const best = read(BEST, {});
  if (!(best[S.level] >= S.total)) { best[S.level] = S.total; write(BEST, best); }
  if (S.daily) { const d = read(DAILY, {}); if (!(d[S.day ?? today()] >= S.total)) { d[S.day ?? today()] = S.total; write(DAILY, d); } }
  else { startLevel(); if (S.total >= FULL * ROUNDS * 0.6) ramp.won(S.scores.every(p => p > 0)); else if (S.total < FULL * ROUNDS * 0.3) ramp.lost(); else ramp.won(false); }
  roundOver("spyglass");
  save(); setTimeout(showDone, 1200);
}

// ---------- the page ----------
function render() {
  if (!S) return;
  $("where").textContent = S.over ? `Run over · ${S.level}` : `Picture ${Math.min(S.index + 1, S.items.length)} of ${S.items.length}${S.daily ? " · today's" : ""} · ${S.level}`;
  $("score").textContent = `Score ${S.scores.reduce((a, b) => a + (b || 0), 0)}`;
  $("ask").textContent = ASK[item().kind];
  if (phase === "look" || phase === "loading") $("worth").replaceChildren("Worth ", Object.assign(el("b"), { textContent: phase === "look" ? worth(u(), S.wrong) : "–" }));
  $("passBtn").hidden = phase === "shown";
  $("nextBtn").hidden = phase !== "shown" || S.over;
  const opts = $("opts");
  opts.replaceChildren();
  const it = item(), over = phase === "shown";
  if (it.options.length) {
    for (const o of it.options) {
      const b = el("button", "sg-opt", o); b.type = "button";
      const tried = S.tried.includes(norm(o));
      b.disabled = over || phase === "loading" || tried;
      if (tried) b.classList.add("wrong");
      if (over && matches(it, o)) b.classList.add("right");
      b.addEventListener("click", () => { guess(o); });
      opts.append(b);
    }
  } else {
    const row = el("form", "sg-type"), input = el("input"), go = el("button", "btn", "Guess");
    input.autocomplete = "off"; input.autocapitalize = "off"; input.spellcheck = false; input.enterKeyHint = "go";
    input.placeholder = it.kind === "painting" ? "The painter" : "The country"; input.disabled = over || phase === "loading";
    go.type = "submit"; go.disabled = input.disabled;
    row.addEventListener("submit", e => { e.preventDefault(); const text = input.value; if (!text.trim()) return; const ok = guess(text); if (ok === false) { input.value = ""; input.classList.add("wrong"); setTimeout(() => input.classList.remove("wrong"), 500); } });
    row.append(input, go); opts.append(row);
    if (over) opts.append(el("p", "sg-hint", `It was ${it.answer}.`));
    else if (S.tried.length) opts.append(el("p", "sg-hint", `${S.tried.length} wrong so far, −${WRONG} each.`));
  }
}
function showDone() {
  if (!S?.over) return;
  const body = $("doneBody"), best = read(BEST, {});
  $("doneTitle").textContent = `${S.total} of ${ROUNDS * FULL}`;
  const list = el("ul", "sg-result");
  S.items.forEach((it, i) => { const li = el("li"); li.append(el("span", "", it.answer), el("b", "", S.scores[i] ? `${S.scores[i]}` : "passed")); list.append(li); });
  body.replaceChildren(list, el("p", "sg-best", `Best at ${S.level}: ${best[S.level] ?? "–"}`), action("New run", () => { $("doneDlg").close(); newRun(false); }, "primary"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody");
  startLevel();                                    // the shared level row follows this game's ramp
  body.replaceChildren();
  part(body, "play").append(action("New run", () => { $("menuDlg").close(); newRun(false); }, "primary"));
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    app: "spyglass", done: got != null, result: got != null ? `${got} of ${ROUNDS * FULL}` : "",
    play: () => { $("menuDlg").close(); newRun(true); }, playing: !!S?.daily && S.day === today() && !S.over, busy: !!S && !S.over && S.index > 0,
  });
  const best = read(BEST, {});
  part(body, "about").append(line(`Best: ${LEVELS.map(l => `${l} ${best[l] ?? "–"}`).join(", ")} · ${POOLS.painting.length} paintings, ${POOLS.flag.length} flags, ${POOLS.outline.length} outlines · ${SECONDS.easy}s to focus on Easy`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".sg-mark").innerHTML = APPS.find(a => a.id === "spyglass").logo;
bindSwitcher($("appsBtn"), "spyglass");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("passBtn").addEventListener("click", async () => { if (phase === "look" && await sure("Pass on this one? It scores nothing.")) pass(); });
$("nextBtn").addEventListener("click", next);
new ResizeObserver(resize).observe(box);
window.addEventListener("resize", resize);
requestAnimationFrame(frame);
async function openToday() {
  if (S && !S.over && S.index > 0 && !(await sure("Start today's run? This one isn't finished."))) return;
  newRun(true);
}
resize();
if (arrivedForToday() && !(S?.daily && S.day === today())) setTimeout(openToday, 0);
else if (!S || S.over) newRun(dailyDue("spyglass"));
else begin();
if (S && S.over) showDone();

// for tests and debugging
window.__spyglass = { get state() { return S; }, get phase() { return phase; }, guess, pass, next, newRun, setElapsed: s => { if (S) S.elapsed = s; } };
