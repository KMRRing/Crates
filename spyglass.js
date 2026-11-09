// Spyglass: a picture is blurred and cropped to a small part of itself in a round spyglass; you turn the focus (Korbi, 9 Nov 2026: the player
// controls it, not a clock) and the sharper you take it the less a right answer is worth. A run is five pictures: paintings (public domain only, from Punt's art bank), flags and country outlines. Easy
// gives four answers to choose from, Medium eight, Hard a line to type in. The rules are spyglass-engine.js's; this file
// keeps the run, draws the lens and builds the page.
import { LEVELS, ROUNDS, FULL, WRONG, paintings, buildings, flags, outlines, dealRun, fraction, focus, worth, matches, norm } from "./spyglass-engine.js";
import { MATHS as ART } from "./art-bank.js";
import { MATHS as ARCH } from "./arch-bank.js";
import { flags as menuFlags } from "./menu-flags.js";
import { regionOf } from "./region.js";
import { inRegions } from "./region-core.js";
import { subjectsOn } from "./topics-on.js";
import { subjectsIn } from "./topics.js";
import * as pile from "./pile.js";
import { MATHS as FLAGS } from "./flags-bank.js";
import { COUNTRIES, REGION_OF } from "./chart-countries.js";
import { pictureUrls } from "./pics.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, todayPart } from "./menu.js";
import { ramp } from "./ramp.js";
import { sure } from "./sure.js";
import { busy } from "./loading.js";
import { today, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const RUN = "spyglass:run", BEST = "spyglass:best", DAILY = "spyglass:daily", LOOK = "spyglass:look";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const POOLS = { painting: paintings(ART), building: buildings(ARCH), flag: flags(FLAGS), outline: outlines(COUNTRIES, REGION_OF) };
// Region and Topics (the shared settings) narrow what is dealt: a flag and an outline are in a region by their country; a painting and a
// building have none (Worldwide only). Topics: paintings and buildings are Art & architecture, flags and outlines Geography; with no
// topic on every one is. Pictures (this game's own row) is a kind, or all. A daily is the same for everyone, so it uses none of them.
const regionsOfCountry = new Map(COUNTRIES.map(c => [c.about || c.id, c.regions]));
const PICTURES = [["all", "All"], ["painting", "Paintings"], ["building", "Buildings"], ["flag", "Flags"], ["outline", "Outlines"]];
const KIND = "spyglass:pictures";
const poolsFor = daily => {
  if (daily) return POOLS;
  const region = regionOf("spyglass"), on = new Set(subjectsIn(subjectsOn())), topic = k => !on.size || on.has(k === "painting" || k === "building" ? "art" : "geo");
  const inR = { painting: () => region === "world", building: () => region === "world", flag: f => inRegions(region, regionsOfCountry.get(f.id)), outline: o => inRegions(region, REGION_OF[o.answer]) };
  return Object.fromEntries(Object.entries(POOLS).map(([k, list]) => [k, topic(k) ? list.filter(inR[k]) : []]));
};
const picturesNow = () => { const k = read(KIND, "all"); return PICTURES.some(([v]) => v === k) ? k : "all"; };
const ASK = { painting: "Who painted this?", flag: "Whose flag is this?", outline: "Which country is this?" };

// ---------- the run ----------
// S: { seed, level, daily, day, items, index, scores: [points per picture, null while it's open], best (the sharpest the focus has been on the open one, 0 to 1: what a right answer is worth follows it),
//      dial (where the focus is now),
//      wrong (guesses so far on it), tried (typed guesses already counted), over, total }
let S = read(RUN, null);
if (S && S.best == null) { S.best = fraction(S.elapsed || 0, S.level); S.dial = S.best; delete S.elapsed; }       // a run saved when a clock did the focusing
const save = () => write(RUN, S);
const startLevel = () => ramp("spyglass", LEVELS, { start: "easy" });
function newRun(daily = false) {
  const seed = daily ? today() * 6151 + 7 : Math.floor(Math.random() * 2 ** 31), level = daily ? "medium" : startLevel();
  S = { ...dealRun(seed, level, poolsFor(daily), daily ? null : picturesNow() === "all" ? null : picturesNow()), daily, day: daily ? today() : null, index: 0, scores: [], best: 0, dial: 0, wrong: 0, tried: [], over: false, total: 0 };
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
/** The flag as its own SVG (spyglass-flags.js), drawn at twice the lens's size, so a crest or a star is still sharp zoomed in. The emoji is no use here:
 *  where the device has no flag emoji (Windows) it is two letters. */
async function flagSource(it) {
  const svg = (await import("./spyglass-flags.js")).FLAG_SVG[it.id];
  if (!svg) return null;
  const img = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '))}`);
  const c = document.createElement("canvas"); c.width = 1200; c.height = 960;      // as tall as the lens is, so the flag fills it
  const x = c.getContext("2d");
  x.fillStyle = "#EFE6CF"; x.fillRect(0, 0, c.width, c.height);
  const w = c.width * 0.96, h = w * 3 / 4;                                        // (all in the 4:3 set)
  x.imageSmoothingQuality = "high";
  x.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
  return { img: c, w: c.width, h: c.height };
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
/** A flag or an outline as the look has it: greyscale, or ink: black or white by brightness, with a line wherever two neighbouring colours differ
 *  by a clear step but fall on the same side of that line (Korbi, 9 Nov 2026: two pale colours side by side, a yellow and a white, must not melt
 *  into one white; there is a silhouette between them). Paintings keep their colour: in ink a painting is a smudge. */
const INK = { light: [232, 220, 190], dark: [20, 26, 31], step: 40 };       // parchment on off-black; step: the colour difference (R+G+B) that is an edge
function looked(src, lines) {
  const look = read(LOOK, "colour");
  if (!src || look === "colour") return src;
  try {
    const c = document.createElement("canvas"); c.width = src.w; c.height = src.h;
    const x = c.getContext("2d"); x.drawImage(src.img, 0, 0, src.w, src.h);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width, H = c.height;
    if (look === "ink") {
      const side = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) { const i = 4 * p; side[p] = ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) > 118) !== !!lines ? 1 : 0; }
      const edge = new Uint8Array(W * H), apart = (i, j) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) > INK.step;
      const t = Math.max(1, Math.round(W / 400));                  // a line about a quarter of a per cent of the width, so it shows at the lens's size
      for (let yy = 0; yy < H - t; yy++) for (let xx = 0; xx < W - t; xx++) {
        const p = yy * W + xx, i = 4 * p;
        if (side[p] === side[p + 1] && apart(i, i + 4)) for (let k = 0; k <= t; k++) edge[p + k] = 1;
        if (side[p] === side[p + W] && apart(i, i + 4 * W)) for (let k = 0; k <= t; k++) edge[p + k * W] = 1;
      }
      for (let p = 0; p < W * H; p++) { const i = 4 * p, v = edge[p] ? !side[p] : side[p], k = v ? INK.light : INK.dark; d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; }
    } else for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    x.putImageData(im, 0, 0);
    return { img: c, w: src.w, h: src.h, full: src };            // `full`: the colour one, which the answer fades to
  } catch { return src; }
}
async function sourceFor(it) {
  if (it.kind === "flag") return looked(await flagSource(it));
  if (it.kind === "outline") return looked(outlineSource(it.name), true);
  const urls = await pictureUrls(it.pic, 960);
  if (!urls) return null;
  for (const u of [...new Set([urls.t, urls.o])]) { try { const img = await load(u); return { img, w: img.naturalWidth, h: img.naturalHeight }; } catch { /* try the original */ } }
  return null;
}

/** Starts the open picture: fetches it, builds the answers, and lets the clock run once there is something to see. */
async function begin() {
  const me = ++token;
  phase = "loading"; source = null; unveil = 0;
  $("caption").hidden = true; $("passBtn").hidden = false; $("nextBtn").hidden = true;
  render();
  if (answered()) { phase = "shown"; reveal = { from: 1, at: 1 }; unveil = 1; tint = 1; source = await sourceFor(item()); if (me === token) { showCaption(); render(); } return; }
  const done = busy("", { delay: 350 });
  try { source = await sourceFor(item()); } finally { done(); }
  if (me !== token) return;
  if (!source) {                                   // a painting that won't load (offline): a flag or outline in its place
    const spare = dealRun(S.seed + 17 * (S.index + 1) + Math.round(S.best * 1000), S.level, S.daily ? POOLS : poolsFor(false)).items.find(i => i.kind !== "painting" && !S.items.some(o => o.answer === i.answer));
    S.items[S.index] = spare; save(); return begin();
  }
  phase = "look"; render();
}
const u = () => (phase === "shown" ? reveal.at : S.dial);

// ---------- the lens ----------
const canvas = $("lens"), box = $("seat"), low = document.createElement("canvas");
let size = [1, 1];
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1), inner = [box.clientWidth, box.clientHeight];
  if (inner[0] < 2 || inner[1] < 2) return;
  canvas.width = Math.round(inner[0] * dpr); canvas.height = Math.round(inner[1] * dpr); size = [canvas.width, canvas.height];
}
/** The picture through the lens now: the crop for the zoom, drawn at the blur's resolution and stretched to the glass (the glass is round by CSS). */
function draw() {
  if (!S) return;                                   // also once the run is over: the last picture's reveal plays out, and a resize clears the canvas (Korbi, 9 Nov 2026: the last screen was sometimes empty)
  const ctx = canvas.getContext("2d"), [cw, ch] = size;
  ctx.fillStyle = "#141A1F"; ctx.fillRect(0, 0, cw, ch);
  if (!source || phase === "loading") return;
  // the answer draws back until the whole picture sits inside the round glass
  const t = 1 - (1 - unveil) ** 3, out = 1 + (Math.hypot(source.w, source.h) / Math.max(source.w, source.h) - 1) * t;
  paint(ctx, cw, ch, source, out);
  // in black and white or ink the answer brings the colour back: the same view of the colour picture, faded in over the grey
  if (source.full && tint > 0) { ctx.globalAlpha = tint; paint(ctx, cw, ch, source.full, out); ctx.globalAlpha = 1; }
}
/** The picture through the glass: the part of it in view for the moment's zoom and blur. */
function paint(ctx, cw, ch, pic = source, out = 1) {
  const { res, zoom: z0 } = focus(u()), zoom = z0 * out, a = cw / ch, W0 = Math.max(pic.w, pic.h * a), H0 = W0 / a, it = item();
  const W = W0 * zoom, H = H0 * zoom;
  const cx = Math.max(W / 2 - (W0 - pic.w) / 2, Math.min(pic.w - W / 2 + (W0 - pic.w) / 2, zoom < 1 ? it.cx * pic.w : pic.w / 2));
  const cy = Math.max(H / 2 - (H0 - pic.h) / 2, Math.min(pic.h - H / 2 + (H0 - pic.h) / 2, zoom < 1 ? it.cy * pic.h : pic.h / 2));
  const sx = cx - W / 2, sy = cy - H / 2;
  // the part of the window that lies on the picture (a wide window around a narrow picture leaves margins)
  const ix0 = Math.max(0, sx), iy0 = Math.max(0, sy), ix1 = Math.min(pic.w, sx + W), iy1 = Math.min(pic.h, sy + H);
  if (ix1 <= ix0 || iy1 <= iy0) return;
  const dx = (ix0 - sx) / W * cw, dy = (iy0 - sy) / H * ch, dw = (ix1 - ix0) / W * cw, dh = (iy1 - iy0) / H * ch;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  if (res >= cw) { ctx.drawImage(pic.img, ix0, iy0, ix1 - ix0, iy1 - iy0, dx, dy, dw, dh); return; }
  const lw = Math.max(2, res), lh = Math.max(2, Math.round(res * ch / cw));
  low.width = lw; low.height = lh;
  const lc = low.getContext("2d");
  lc.imageSmoothingEnabled = true;
  lc.drawImage(pic.img, ix0, iy0, ix1 - ix0, iy1 - iy0, dx / cw * lw, dy / ch * lh, dw / cw * lw, dh / ch * lh);
  ctx.drawImage(low, 0, 0, lw, lh, 0, 0, cw, ch);
}
let last = 0, unveil = 0, tint = 0;                        // unveil: how far the answer has drawn the picture back to sit whole in the glass (0 close, 1 whole)
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!S) return;
  if (phase === "shown" && reveal.at < 1) reveal.at = Math.min(1, reveal.at + dt / 0.8);
  if (phase === "shown") { unveil = Math.min(1, unveil + dt / 0.6); tint = Math.min(1, tint + dt / 1.1); } else tint = 0;
  draw();
}

// ---------- guessing ----------
function good() {
  learn(S.wrong ? "wrong" : "right");
  const points = worth(S.best, S.wrong);
  S.scores[S.index] = points;
  conclude(`+${points}`);
}
function bad() { S.wrong++; save(); }
function conclude(text) {
  reveal = { from: S.dial, at: S.dial };
  phase = "shown"; save();
  $("worth").textContent = text;
  showCaption();
  if (S.index === S.items.length - 1) endRun();
  render();
}
function showCaption() { $("caption").textContent = item().caption; $("caption").hidden = false; }
function pass() {
  if (phase !== "look") return;
  S.scores[S.index] = 0; learn("pass"); conclude("Passed");
}
/** The learning piles (pile.js): a picture passed on, or named only after a wrong guess, comes back as a question (Deck, and Spyglass's next runs would
 *  draw on it through the other games); one named cleanly that was on a pile moves up it. Outlines have no picture to ask with. */
function learn(why) {
  const it = item();
  if (S.daily || it.kind === "outline") return;
  const key = `${it.kind}/${it.answer}`;
  if (why === "right") { if (pile.has("spyglass", key)) pile.answer("spyglass", key, true); return; }
  const others = [...it.options.filter(o => o !== it.answer), ...POOLS[it.kind].map(p => p.answer).filter(a => a !== it.answer)].filter((o, i, all) => all.indexOf(o) === i).slice(0, 3);   // none were shown on Hard
  const payload = it.kind === "flag" ? { ask: "Spyglass · which flag", prompt: `${it.emoji} Which country's flag is this?`, options: [it.answer, ...others], right: [0], note: it.caption }
    : { ask: it.kind === "building" ? "Spyglass · which building" : "Spyglass · which painting", prompt: it.kind === "building" ? "Which building is this?" : "Who painted this?", pic: it.pic, options: [it.answer, ...others], right: [0], note: it.caption, about: it.about };
  pile.record("spyglass", key, payload, why);
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
  S.index++; S.best = 0; S.dial = 0; S.wrong = 0; S.tried = [];
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
  if (phase === "look" || phase === "loading") $("worth").replaceChildren("Worth ", Object.assign(el("b"), { textContent: phase === "look" ? worth(S.best, S.wrong) : "–" }));
  dial.disabled = phase !== "look"; dial.value = Math.round((phase === "shown" ? 1 : S.dial) * 1000);
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
  menuFlags(body, { name: "Spyglass", game: "spyglass", region: true, topics: true, learning: true, own: [
    choice("Pictures", PICTURES, picturesNow(), v => write(KIND, v)),
    choice("Flags and outlines", [["colour", "Colour"], ["grey", "Black and white"], ["ink", "Ink"]], read(LOOK, "colour"), v => write(LOOK, v)),
    line("Black and white takes the colour out; Ink leaves only light and dark, with a line between neighbouring colours that would otherwise merge, so a flag is told by its shapes. From the next picture.")] });
  const best = read(BEST, {});
  part(body, "about").append(line(`Best: ${LEVELS.map(l => `${l} ${best[l] ?? "–"}`).join(", ")} · ${POOLS.painting.length} paintings, ${POOLS.building.length} buildings, ${POOLS.flag.length} flags, ${POOLS.outline.length} outlines · ${SECONDS.easy}s to focus on Easy`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the focus ----------
// The player turns it: the slider, the wheel, or dragging across the glass. Going back to blur costs nothing and gains nothing: what a right
// answer is worth follows the sharpest the picture has been (`best`), so you can't look, blur and look again for free.
const dial = $("focus");
function setDial(v) {
  if (!S || phase !== "look") return;
  S.dial = Math.max(0, Math.min(1, v));
  if (S.dial > S.best) { S.best = S.dial; $("worth").replaceChildren("Worth ", Object.assign(el("b"), { textContent: worth(S.best, S.wrong) })); }
  dial.value = Math.round(S.dial * 1000);
}
dial.addEventListener("input", () => setDial(dial.value / 1000));
dial.addEventListener("change", () => save());
$("lensBox").addEventListener("wheel", e => { e.preventDefault(); setDial(S.dial - Math.sign(e.deltaY) * 0.04); save(); }, { passive: false });
let drag = null;
$("lensBox").addEventListener("pointerdown", e => { drag = { x: e.clientX, d: S?.dial ?? 0 }; $("lensBox").setPointerCapture(e.pointerId); });
$("lensBox").addEventListener("pointermove", e => { if (drag) setDial(drag.d + (e.clientX - drag.x) / ($("lensBox").clientWidth * 0.8)); });
for (const ev of ["pointerup", "pointercancel"]) $("lensBox").addEventListener(ev, () => { if (drag) { drag = null; save(); } });

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
window.__spyglass = { get state() { return S; }, get phase() { return phase; }, guess, pass, next, newRun, setFocus: v => setDial(v) };
