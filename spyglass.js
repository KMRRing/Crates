// Spyglass: a picture comes into focus through a round spyglass over about 20 seconds (Korbi, 9 Nov 2026: a clock does the focusing, the player
// does not turn it), and the sooner you say what it is the more it's worth. A run is five pictures: paintings (public domain only, from Punt's art bank), flags and country outlines. Easy
// gives four answers to choose from, Medium eight, Hard a line to type in. The rules are spyglass-engine.js's; this file
// keeps the run, draws the lens and builds the page.
import { LEVELS, ROUNDS, FULL, SECONDS, WRONG, paintings, buildings, flags, outlines, dealRun, fraction, spent, focus, worth, matches, norm } from "./spyglass-engine.js";
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
import { part, action, line, choice, todayPart, isPaused } from "./menu.js";
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
// S: { seed, level, daily, day, items, index, scores: [points per picture, null while it's open], elapsed (seconds on the open one),
//      wrong (guesses so far on it), tried (typed guesses already counted), over, total }
let S = read(RUN, null);
if (S && S.push == null) S.push = 0;
if (S && S.elapsed == null) { S.elapsed = (S.best || 0) * SECONDS[S.level]; delete S.best; delete S.dial; }       // a run saved while the player turned the focus
const save = () => write(RUN, S);
const startLevel = () => ramp("spyglass", LEVELS, { start: "easy" });
function newRun(daily = false) {
  const seed = daily ? today() * 6151 + 7 : Math.floor(Math.random() * 2 ** 31), level = daily ? "medium" : startLevel();
  S = { ...dealRun(seed, level, poolsFor(daily), daily ? null : picturesNow() === "all" ? null : picturesNow()), daily, day: daily ? today() : null, index: 0, scores: [], elapsed: 0, push: 0, wrong: 0, tried: [], over: false, total: 0 };
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
  const c = document.createElement("canvas"); c.width = 1200; c.height = 900;      // the flag to its edges (all in the 4:3 set): the glass stretches them to the rim
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, c.width, c.height);
  return { img: c, w: c.width, h: c.height };
}
/**
 * A flag flying at the masthead of a ship at sea (Korbi, 10 Nov 2026: "zoom it out to an image containing the flag, a mast of a
 * ship at sea"). While you look, the glass is on the flag (`view`); the answer draws back to the whole ship. Drawn here, the
 * sky, the sea and the ship varying a little by flag, so no two look alike; the flag waves only a little, so it reads as itself.
 */
function atSea(flag, id) {
  const N = 1600, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d");
  let h = 2166136261; for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const pick = n => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return h % n; };
  const SKIES = [["#6E93B0", "#E9D8B4", "#F4E2B8"], ["#4A5F86", "#E8B98A", "#F6C98E"], ["#86A9C4", "#F0E4C8", "#FFF3D6"]];
  const [top, low, sun] = SKIES[pick(SKIES.length)], horizon = N * 0.6;      // (the caption plate covers the glass's lowest fifth: the ship sits above it)
  // the sky, the sun low on it and a few clouds
  let g = x.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, top); g.addColorStop(1, low); x.fillStyle = g; x.fillRect(0, 0, N, horizon);
  const sx = N * (0.62 + pick(30) / 100);
  g = x.createRadialGradient(sx, horizon - 40, 10, sx, horizon - 40, N * 0.35); g.addColorStop(0, sun); g.addColorStop(1, "rgba(255,240,210,0)"); x.fillStyle = g; x.fillRect(0, 0, N, horizon);
  x.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 6; i++) { const cx = pick(N), cy = N * (0.08 + pick(40) / 100 * 0.5); for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(cx + j * 70 - 100, cy + (j % 2) * 18, 120, 34, 0, 0, 6.283); x.fill(); } }
  // a far coast
  x.fillStyle = "rgba(70,80,82,0.45)"; x.beginPath(); x.moveTo(0, horizon);
  for (let X = 0; X <= N * 0.45; X += 40) x.lineTo(X, horizon - 30 - 26 * Math.sin(X / 90) - 18 * Math.sin(X / 37));
  x.lineTo(N * 0.5, horizon); x.fill();
  // the sea, darker towards you, with its swell
  g = x.createLinearGradient(0, horizon, 0, N); g.addColorStop(0, "#6F8FA0"); g.addColorStop(1, "#1E3646"); x.fillStyle = g; x.fillRect(0, horizon, N, N - horizon);
  for (let y = horizon + 8, k = 0; y < N; k++, y += 6 + k * 1.1) {
    const amp = 2 + k * 0.45, len = 60 + k * 9;
    x.strokeStyle = `rgba(230,240,240,${0.1 + Math.min(0.2, k * 0.006)})`; x.lineWidth = 1 + k * 0.06; x.beginPath();
    for (let X = -(pick(len)); X < N; X += len * 1.7) { x.moveTo(X, y); x.quadraticCurveTo(X + len / 2, y - amp, X + len, y); }
    x.stroke();
  }
  // the ship, side on, bow to the right
  const wl = N * 0.76, bow = N * 0.8, stern = N * 0.22, deck = wl - N * 0.085, mast = N * 0.43, fx = mast + 9, fy = N * 0.15, fw = N * 0.3, fh = fw * flag.h / flag.w;
  x.fillStyle = "rgba(10,20,26,0.35)"; x.beginPath(); x.ellipse((bow + stern) / 2, wl + 18, (bow - stern) / 2, 22, 0, 0, 6.283); x.fill();
  x.fillStyle = "#3A2618"; x.beginPath(); x.moveTo(stern - 10, deck - 30); x.lineTo(bow + 40, deck - 6);
  x.quadraticCurveTo(bow + 10, wl - 10, bow - 60, wl); x.lineTo(stern + 40, wl); x.quadraticCurveTo(stern, wl - 20, stern - 10, deck - 30); x.fill();
  x.strokeStyle = "#C9A04A"; x.lineWidth = 7; x.beginPath(); x.moveTo(stern, deck - 6); x.lineTo(bow + 10, deck + 12); x.stroke();
  x.fillStyle = "#1A1210"; x.strokeStyle = "#B08A3E"; x.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const px = stern + 120 + i * (bow - stern - 260) / 6, py = deck + 22 + (px - stern) / (bow - stern) * 16; x.fillRect(px, py, 26, 20); x.strokeRect(px, py, 26, 20); }
  // the masts, the yards with their sails furled, the rigging
  const spar = (X, y0, y1, w) => { g = x.createLinearGradient(X - w, 0, X + w, 0); g.addColorStop(0, "#4A2F1B"); g.addColorStop(0.5, "#7A5532"); g.addColorStop(1, "#3A2414"); x.fillStyle = g; x.fillRect(X - w / 2, y1, w, y0 - y1); };
  const yard = (X, y, half) => { x.fillStyle = "#4A2F1B"; x.fillRect(X - half, y - 5, 2 * half, 10); x.fillStyle = "#E8DCC0"; x.beginPath(); x.ellipse(X, y + 12, half * 0.92, 13, 0, 0, 6.283); x.fill(); x.strokeStyle = "rgba(60,45,30,0.4)"; x.lineWidth = 2; x.stroke(); };
  const mizzen = stern + (mast - stern) * 0.35;
  spar(mast, deck, fy - 50, 18); spar(mizzen, deck, N * 0.34, 13);
  yard(mast, N * 0.42, N * 0.16); yard(mast, N * 0.55, N * 0.19); yard(mizzen, N * 0.47, N * 0.1);
  x.save(); x.translate(bow + 30, deck - 10); x.rotate(-0.32); x.fillStyle = "#4A2F1B"; x.fillRect(0, -5, N * 0.13, 10); x.restore();     // the bowsprit
  x.strokeStyle = "rgba(30,24,20,0.75)"; x.lineWidth = 2.5; x.beginPath();
  const tip = [bow + 30 + N * 0.13 * Math.cos(0.32), deck - 10 - N * 0.13 * Math.sin(0.32)];
  for (const [ax, ay, bx, by] of [[mast, fy - 40, ...tip], [mast, N * 0.4, ...tip], [mast, fy - 40, mizzen, N * 0.35], [mizzen, N * 0.35, stern - 10, deck - 30]]) { x.moveTo(ax, ay); x.lineTo(bx, by); }
  for (let i = 0; i < 4; i++) { x.moveTo(mast, N * 0.4); x.lineTo(mast - 60 - i * 22, deck - 2); x.moveTo(mast, N * 0.4); x.lineTo(mast + 60 + i * 22, deck + 2); }
  x.stroke();
  x.fillStyle = "#C9A04A"; x.beginPath(); x.arc(mast, fy - 54, 13, 0, 6.283); x.fill();
  // the flag at the masthead, the halyard to its hoist; a little wave towards its fly, and the light on its folds
  const amp = fh * 0.025, slices = 120;
  x.strokeStyle = "rgba(30,24,20,0.8)"; x.lineWidth = 2; x.beginPath(); x.moveTo(mast + 6, fy - 46); x.lineTo(fx, fy); x.moveTo(fx, fy + fh); x.lineTo(mast + 6, fy + fh + 40); x.stroke();
  for (let i = 0; i < slices; i++) {
    const t = i / slices, dy = amp * Math.sin(t * 9) * t, sw = fw / slices;
    x.drawImage(flag.img, flag.w * t, 0, flag.w / slices + 1, flag.h, fx + fw * t, fy + dy, sw + 1, fh);
    const light = Math.cos(t * 9) * t * 0.14;
    x.fillStyle = light > 0 ? `rgba(255,255,255,${light})` : `rgba(0,0,0,${-light})`; x.fillRect(fx + fw * t, fy + dy, sw + 1, fh);
  }
  return { img: c, w: N, h: N, view: { x: fx - 6, y: fy - amp, w: fw + 12, h: fh + 2 * amp } };
}
// A country's outline as a satellite sees it (Korbi, 10 Nov 2026: "the sea blue and the country as per satellite, desert etc;
// in ink the sea black and the country white"): NASA's Blue Marble (public domain, as Columbiad's globe uses it) laid inside the
// outline, the sea around it plain blue, so nothing but the country's own shape and ground gives it away.
let earth = null;
const earthMap = () => (earth ||= load("columbiad-earth.jpg").catch(() => null));
async function outlineSource(name, ink = false) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 427;
  const x = c.getContext("2d"), country = COUNTRIES.find(k => k.name === name), map = ink ? null : await earthMap();
  const span = country.rings.flat().reduce((m, [lon]) => [Math.min(m[0], lon), Math.max(m[1], lon)], [180, -180]);
  const wrap = span[1] - span[0] > 180, shift = lon => (wrap && lon < 0 ? lon + 360 : lon);
  const pts = country.rings.flat(), lats = pts.map(p => p[1]), lons = pts.map(p => shift(p[0]));
  const lat0 = Math.min(...lats), lat1 = Math.max(...lats), lon0 = Math.min(...lons), lon1 = Math.max(...lons);
  const kx = Math.cos((lat0 + lat1) / 2 * Math.PI / 180), k = Math.min(540 / ((lon1 - lon0) * kx || 1), 340 / (lat1 - lat0 || 1));
  const ox = 320 - (lon0 + lon1) / 2 * kx * k, oy = 213 + (lat0 + lat1) / 2 * k;
  const ink6 = ([r, g, b]) => `rgb(${r},${g},${b})`;
  x.fillStyle = ink ? ink6(INK.dark) : "#2E6295"; x.fillRect(0, 0, 640, 427);
  x.beginPath();
  for (const ring of country.rings) ring.forEach(([lon, lat], i) => { const X = shift(lon) * kx * k + ox, Y = oy - lat * k; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); });
  if (map) {
    // the map is longitude and latitude in equal steps, as the outline is drawn, so it lands on the outline by one scale and shift
    x.save(); x.clip("evenodd"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    for (const turn of wrap ? [0, 360] : [0]) x.drawImage(map, (turn - 180) * kx * k + ox, oy - 90 * k, 360 * kx * k, 180 * k);
    x.restore();
    x.strokeStyle = "rgba(15,25,32,0.85)"; x.lineWidth = 1.6; x.lineJoin = "round"; x.stroke();
  } else { x.fillStyle = ink ? ink6(INK.light) : "#5E8A4A"; x.fill("evenodd"); }
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
  if (it.kind === "flag") {
    const flag = await flagSource(it);
    if (!flag) return null;
    const look = looked(flag), scene = atSea(look, it.id);
    if (look.full) scene.full = atSea(look.full, it.id);                 // the colour one the answer fades to: the same ship, the flag in colour
    return scene;
  }
  if (it.kind === "outline") {
    const colour = await outlineSource(it.name);
    return read(LOOK, "colour") === "ink" ? { ...(await outlineSource(it.name, true)), full: colour } : looked(colour);   // grey: the same ground in greys
  }
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
  try { source = await sourceFor(item()); if (source) { stretched(source); if (source.full) stretched(source.full); } } finally { done(); }   // the surround is drawn while it still says loading
  if (me !== token) return;
  if (!source) {                                   // a painting that won't load (offline): a flag or outline in its place
    const spare = dealRun(S.seed + 17 * (S.index + 1) + S.elapsed, S.level, S.daily ? POOLS : poolsFor(false)).items.find(i => i.kind !== "painting" && !S.items.some(o => o.answer === i.answer));
    S.items[S.index] = spare; save(); return begin();
  }
  phase = "look"; render();
}
// The focus on show: the clock's, or the player's own if they have pushed the slider ahead of it. The clock runs on underneath and the push
// does not grow when they let go, so the picture stands still until the clock has caught up with it (Korbi, 10 Nov 2026).
const seen = () => Math.max(fraction(S.elapsed, S.level), S.push || 0);
const u = () => (phase === "shown" ? reveal.at : seen());
const owed = () => spent(S.elapsed, S.level, S.push);                 // what the points are charged for (the push counts at once, the clock goes on adding to it)

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
  const t = 1 - (1 - unveil) ** 3;
  paint(ctx, cw, ch, source, t);
  // in black and white or ink the answer brings the colour back: the same view of the colour picture, faded in over the grey
  if (source.full && tint > 0) { ctx.globalAlpha = tint; paint(ctx, cw, ch, source.full, t); ctx.globalAlpha = 1; }
}
// The glass is round and a picture is not: its edges are stretched out to the rim, as a lens bends what is at its edge
// (Korbi, 10 Nov 2026: "the centre of the image undistorted, a sort of fisheye effect around the edges"). Measured by how
// far a point is from the middle as a share of the picture's half-width or half-height, whichever is the more (its box
// norm u: 1 on the picture's edge), the middle up to INNER stays as it is; beyond it a point shows the picture from
// bend(u), nearer the middle, so the outer band of the picture is drawn out and its very edge reaches the rim.
const INNER = 0.78, REACH = 0.75, SEAM = 1.5;     // the part left as it is; how far round the picture the stretch reaches (a share of its longer side); the most a ring's edge may jump, in pixels
const bend = u => (u <= INNER ? u : INNER + (1 - INNER) * (1 - Math.exp(-(u - INNER) / (1 - INNER))));
/** The picture with its surround: drawn once for a picture, from the outside in, each ring the picture as large as the bend asks there. */
function stretched(pic) {
  if (pic.ext) return pic.ext;
  const M = Math.round(Math.max(pic.w, pic.h) * REACH), W = pic.w + 2 * M, H = pic.h + 2 * M, k = Math.min(1, 1000 / Math.max(W, H));   // the surround is only ever the stretched edge: it needs no more
  const c = document.createElement("canvas"); c.width = Math.round(W * k); c.height = Math.round(H * k);
  const x = c.getContext("2d"), hw = pic.w / 2 * k, hh = pic.h / 2 * k, mx = c.width / 2, my = c.height / 2, top = Math.max(W / pic.w, H / pic.h);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  // where one ring meets the next the picture jumps by u·Δ(1/s) of a half-width: rings are spaced so that's under SEAM pixels
  const inv = u => bend(u) / u, slope = u => Math.abs(inv(u + 1e-3) - inv(u - 1e-3)) / 2e-3;
  for (let u = top; u > INNER; u -= Math.min(0.08, SEAM / (Math.max(hw, hh) * u * Math.max(slope(u), 1e-4)))) {
    const s = u / bend(u);
    x.save(); x.beginPath(); x.rect(mx - u * hw, my - u * hh, 2 * u * hw, 2 * u * hh); x.clip();
    x.drawImage(pic.img, mx - s * hw, my - s * hh, 2 * s * hw, 2 * s * hh);
    x.restore();
  }
  x.save(); x.beginPath(); x.rect(mx - INNER * hw, my - INNER * hh, 2 * INNER * hw, 2 * INNER * hh); x.clip();
  x.drawImage(pic.img, mx - hw, my - hh, 2 * hw, 2 * hh); x.restore();
  return (pic.ext = { img: c, M, k });
}
/** The picture through the glass: the part of it in view for the moment's zoom and blur, its stretched surround round it.
 *  t: how far the answer has drawn back (0 to 1), until the whole picture sits in the glass; a flag's ship draws back from its flag. */
function paint(ctx, cw, ch, pic = source, t = 0) {
  const v = pic.view || { x: 0, y: 0, w: pic.w, h: pic.h };       // what you look at: the picture, or the flag on its ship
  const out = pic.view ? 1 : 1 + (Math.hypot(v.w, v.h) / Math.max(v.w, v.h) - 1) * t;
  const { res, zoom: z0 } = focus(u()), zoom = z0 * out, a = cw / ch, W0 = Math.max(v.w, v.h * a), H0 = W0 / a, it = item();
  let W = W0 * zoom, H = H0 * zoom;
  // a window wider than the picture (the answer drawing back) is centred on it: clamped, its two limits cross and it would slide off to one side
  const mid = (win, whole, margin, want) => win >= whole + 2 * margin ? whole / 2 : Math.max(win / 2 - margin, Math.min(whole - win / 2 + margin, want));
  let cx = v.x + mid(W, v.w, (W0 - v.w) / 2, zoom < 1 ? it.cx * v.w : v.w / 2);
  let cy = v.y + mid(H, v.h, (H0 - v.h) / 2, zoom < 1 ? it.cy * v.h : v.h / 2);
  if (pic.view && t > 0) {                        // from the flag out to the ship and the sea: the window grows evenly and slides to the middle
    W *= Math.pow(Math.max(pic.w, pic.h * a) / W, t); H = W / a;
    cx += (pic.w / 2 - cx) * t; cy += (pic.h / 2 - cy) * t;
  }
  const sx = cx - W / 2, sy = cy - H / 2, ext = stretched(pic);
  // into a target tw by th: the surround fills the window; the picture's own middle goes over it, as sharp as it comes
  const layers = (t, tw, th) => {
    t.imageSmoothingEnabled = true; t.imageSmoothingQuality = "high";
    t.drawImage(ext.img, (sx + ext.M) * ext.k, (sy + ext.M) * ext.k, W * ext.k, H * ext.k, 0, 0, tw, th);
    const ex = pic.w / 2 * (1 - INNER), ey = pic.h / 2 * (1 - INNER);
    const x0 = Math.max(ex, sx), y0 = Math.max(ey, sy), x1 = Math.min(pic.w - ex, sx + W), y1 = Math.min(pic.h - ey, sy + H);
    if (x1 > x0 && y1 > y0) t.drawImage(pic.img, x0, y0, x1 - x0, y1 - y0, (x0 - sx) / W * tw, (y0 - sy) / H * th, (x1 - x0) / W * tw, (y1 - y0) / H * th);
  };
  if (res >= cw) { layers(ctx, cw, ch); return; }
  const lw = Math.max(2, res), lh = Math.max(2, Math.round(res * ch / cw));
  low.width = lw; low.height = lh;
  layers(low.getContext("2d"), lw, lh);
  ctx.drawImage(low, 0, 0, lw, lh, 0, 0, cw, ch);
}
let last = 0, savedAt = 0, unveil = 0, tint = 0;                        // unveil: how far the answer has drawn the picture back to sit whole in the glass (0 close, 1 whole)
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!S) return;
  if (phase === "look" && !S.over && !isPaused() && document.visibilityState === "visible") {
    S.elapsed += dt;
    if (Math.floor(S.elapsed) !== savedAt) { savedAt = Math.floor(S.elapsed); save(); }
    $("worth").replaceChildren("Worth ", Object.assign(el("b"), { textContent: worth(owed(), S.wrong) }));
    if (!dragging) $("focus").value = Math.round(u() * 1000);               // the slider follows the focus as the clock brings it on
  } else if (phase === "shown" && reveal.at < 1) reveal.at = Math.min(1, reveal.at + dt / 0.8);
  if (phase === "shown") { unveil = Math.min(1, unveil + dt / 0.6); tint = Math.min(1, tint + dt / 1.1); } else tint = 0;
  draw();
}

// ---------- guessing ----------
function good() {
  learn(S.wrong ? "wrong" : "right");
  const points = worth(owed(), S.wrong);
  S.scores[S.index] = points;
  conclude(`+${points}`);
}
function bad() { S.wrong++; save(); }
function conclude(text) {
  reveal = { from: seen(), at: seen() };
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
  if (why === "right") { pile.answer("spyglass", key, true, it.facts); return; }     // its own item, or another game's on the same fact
  const others = [...it.options.filter(o => o !== it.answer), ...POOLS[it.kind].map(p => p.answer).filter(a => a !== it.answer)].filter((o, i, all) => all.indexOf(o) === i).slice(0, 3);   // none were shown on Hard
  const payload = it.kind === "flag" ? { ask: "Spyglass · which flag", prompt: `${it.emoji} Which country's flag is this?`, options: [it.answer, ...others], right: [0], note: it.caption }
    : { ask: it.kind === "building" ? "Spyglass · which building" : "Spyglass · which painting", prompt: it.kind === "building" ? "Which building is this?" : "Who painted this?", pic: it.pic, options: [it.answer, ...others], right: [0], note: it.caption, about: it.about };
  pile.record("spyglass", key, { ...payload, facts: it.facts }, why);
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
  S.index++; S.elapsed = 0; S.push = 0; S.wrong = 0; S.tried = [];
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
  if (phase === "look" || phase === "loading") $("worth").replaceChildren("Worth ", Object.assign(el("b"), { textContent: phase === "look" ? worth(owed(), S.wrong) : "–" }));
  const dial = $("focus"); dial.disabled = phase !== "look"; dial.value = Math.round(u() * 1000);
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
// the focus slider: pull the picture into focus ahead of the clock, and a right answer is worth less at once; it cannot be pulled back
let dragging = false;
$("focus").addEventListener("pointerdown", () => { dragging = true; });
addEventListener("pointerup", () => { dragging = false; });
$("focus").addEventListener("input", e => {
  if (phase !== "look") return;
  const v = e.target.value / 1000;
  if (v > seen()) S.push = v;
  e.target.value = Math.round(seen() * 1000);
  $("worth").replaceChildren("Worth ", Object.assign(el("b"), { textContent: worth(owed(), S.wrong) }));
});
$("focus").addEventListener("change", () => { dragging = false; save(); });
window.__spyglass = { get state() { return S; }, get phase() { return phase; }, guess, pass, next, newRun, setElapsed: x => { if (S) S.elapsed = x; } };
