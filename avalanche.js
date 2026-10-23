// Avalanche: a slope of snow above a road. Each day you lay up to three charges, and press a square to see the
// avalanche everything laid so far would set off with one more there (every square that would slide ringed, the bridges
// it builds dotted, what it would score); let go on it to lay it. Fire sets the lot off as one avalanche. Then night
// falls: snow lands at random, and what it sets off runs where it runs; three layers on the road in one night bury it.
// The rules are avalanche-engine.js's; this file draws the slope, plays each day and night out and keeps the game.
import { W, H, CAP, CHARGES, LIVES, BURY, WINDS, newGame, upgrade, fire, lay, lift, laid, foresee, danger, snowfall, rocksOf } from "./avalanche-engine.js";
import { lessonGame, lessonOf, nightOf, ready, instruction, told, LESSON_DAYS } from "./avalanche-lesson.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, toggle } from "./menu.js";

const $ = id => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const RUN = "avalanche:run", BEST = "avalanche:best", ROCKY_BEST = "avalanche:rocky-best", SEEN = "avalanche:seen", OPTS = "avalanche:opts", TAUGHT = "avalanche:taught", HELD = "avalanche:held";
const CELL = 10, ROAD_Y = H * CELL + 1;
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
/** The key of this game's best: `avalanche:best` is for the open slope (the games screen shows it), rocks being easier to last on. */
const bestKey = () => (rocksOf(S).length ? ROCKY_BEST : BEST);
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const fmt = n => n.toLocaleString("en-GB");

let S = null;            // the game (avalanche-engine.js's), as saved
let playing = false;     // a day and night being played out
let press = null;        // a pointer pressing the slope
let aim = -1;            // the square whose charge is shown (laid, or lifted if the day's three are laid)

const valid = g => g && g.v === 1 && Array.isArray(g.cells) && g.cells.length === W * H;
function save() { write(RUN, S); }
const slope = () => read(OPTS, {}).rocky === true;   // the next game's slope: open, or with bare rock on it
function newRun() { S = newGame(Math.floor(Math.random() * 2 ** 31), slope()); aim = -1; save(); render(); }
/** Squares that would bury the road tonight are hatched unless the player has turned that off; the lesson's third day needs them, and the first two have none. */
const dangerOn = (g = S) => { const k = lessonOf(g); return k != null ? k === 2 : read(OPTS, {}).danger !== false; };

// ---------- the lesson ----------
// The first three days on slopes laid out by hand (avalanche-lesson.js), kept in the game itself (`lesson`, the day; `told`,
// what the day came to, once it is fired and the page waits on Next), so a reload or a partner's screen finds it where it is.
// A game interrupted for the lesson is held under `avalanche:held` and comes back when the lesson ends or is skipped.
function startLesson() {
  if (lessonOf(S) == null && S && (S.days > 0 || S.plan.length)) write(HELD, S);
  S = lessonGame(0);
  aim = -1;
  save();
  render();
}
/** The lesson over, finished or skipped: it is taught, and the game it interrupted (or a new one) goes on. */
function endLesson() {
  write(TAUGHT, true);
  const held = read(HELD, null);
  try { localStorage.removeItem(HELD); } catch { /* private mode */ }
  if (valid(held)) { S = upgrade(held); aim = -1; save(); render(); } else newRun();
}
/** Next on a lesson's told day: the next day's slope, or the end. */
function nextDay() {
  const k = lessonOf(S);
  if (k == null || !S.told || playing) return;
  if (k + 1 >= LESSON_DAYS) { endLesson(); return; }
  S = lessonGame(k + 1, S.score);
  aim = -1;
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
const at = i => [(i % W) * CELL, Math.floor(i / W) * CELL];
/** A square of the slope: its snow as deep as it is (and a tick for each layer, so it's read without its shade); a
 *  full one cracked, as it is when the next layer will set it off. */
function squareEl(d, i, cls = "", charges = 0) {
  const [x, y] = at(i);
  if (rocksOf(S).includes(i)) return el("g", { transform: `translate(${x} ${y})`, "data-cell": i }, el("g", { class: "av-sq av-rocky" },
    el("rect", { x: .35, y: .35, width: 9.3, height: 9.3, rx: 1.4 }), el("path", { class: "av-stone", d: "M1.8 7.6l2.1-4.2 2.4 1.3 2-2.6 1.1 5.5Z" })));
  const g = el("g", { transform: `translate(${x} ${y})`, "data-cell": i }, el("g", { class: `av-sq d${Math.min(d, CAP - 1)} ${d >= CAP ? "primed " : ""}${cls}`.trim() },
    el("rect", { x: .35, y: .35, width: 9.3, height: 9.3, rx: 1.4 }),
    ...Array.from({ length: Math.min(d, CAP - 1) }, (_, k) => el("rect", { class: "av-tick", x: 1.6 + k * 2.4, y: 7.6, width: 1.8, height: .9, rx: .3 }))));
  if (d >= CAP - 1) g.firstChild.append(el("path", { class: "av-crack", d: "M2.2 3.4l2 1.4 1.4-1.6 2.2 1.7" }));
  // the charges laid here, a diamond each in the top right corner
  for (let k = 0; k < charges; k++) g.append(el("path", { class: "av-charge", d: `M${8.3 - k * 2.9} .9l1.6 1.6-1.6 1.6-1.6-1.6Z` }));
  return g;
}
function roadEl(snow) {
  const g = el("g", { class: "av-road" }, el("rect", { class: "av-tarmac", x: -2, y: ROAD_Y, width: 74, height: 6.5, rx: 1 }), el("path", { class: "av-lane", d: `M0 ${ROAD_Y + 3.25}H70` }));
  // the night's snow on it, a drift for each layer, red once there's enough to bury it
  for (let k = 0; k < snow; k++) g.append(el("ellipse", { class: `av-drift${snow >= BURY ? " deep" : ""}`, cx: 8 + ((k * 23) % 56), cy: ROAD_Y + 3.4, rx: 4.6, ry: 2.2 }));
  return g;
}

/** A chalet on its square: a roof and a wall, red-ringed when a slide would carry it away. */
function chaletEl(i, cls = "") {
  const [x, y] = at(i);
  return el("g", { class: `av-chalet ${cls}`.trim(), transform: `translate(${x} ${y})`, "data-chalet": i },
    el("path", { class: "av-wall", d: "M3 5.2H7V8.6H3Z" }), el("path", { class: "av-roof", d: "M1.8 5.6L5 2.4L8.2 5.6Z" }), el("path", { class: "av-door", d: "M4.4 8.6V6.8H5.6V8.6" }));
}
/** The forecast wind over the slope: streaks on the side it blows from (none on a still night). */
function windEl(wind) {
  if (!wind) return "";
  const g = el("g", { class: "av-wind" });
  for (let k = 0; k < 3; k++) {
    const y = 14 + k * 24, d = wind === 1 ? `M-1.2 ${y}q3-1.6 6 0t6 0` : `M71.2 ${y}q-3-1.6-6 0t-6 0`;
    g.append(el("path", { d }));
  }
  return g;
}
/**
 * The slope: these depths, with extra: { ring (squares the charges would set sliding), relays (the bridges among
 * them, [{ at, extra }]), tag ([text, square]), charges (the squares of the charges laid), sliding (squares sliding
 * now), danger (squares a layer would bury the road from), natural (it's the night's), night, road (layers on the road), flake (where snow just fell), chalets (their
 * squares, else the game's), struck (chalets a slide would carry away), wind (else tonight's) }.
 */
function drawBoard(cells, extra = {}) {
  const sq = el("g", {}), laidAt = i => (extra.charges || []).filter(c => c === i).length;
  cells.forEach((d, i) => sq.append(squareEl(d, i, extra.sliding?.includes(i) ? (extra.natural ? "sliding natural" : "sliding") : "", laidAt(i))));
  // hatching where one layer of snow tonight would bury the road: a pattern, so it reads without its colour
  const risk = el("g", { class: "av-risk-sq" }, el("defs", {}, el("pattern", { id: "avHatch", width: 2.2, height: 2.2, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("rect", { width: 2.2, height: 2.2, class: "av-hatch-bg" }), el("path", { d: "M0 0V2.2", class: "av-hatch" }))));
  for (const i of extra.danger || []) { const [x, y] = at(i); risk.append(el("rect", { x: x + .35, y: y + .35, width: 9.3, height: 9.3, rx: 1.4, fill: "url(#avHatch)", class: "av-danger" })); }
  const chalets = el("g", {}, ...(extra.chalets || S.chalets).map(c => chaletEl(c, extra.struck?.includes(c) ? "struck" : "")));
  const marks = el("g", {});
  for (const i of extra.ring || []) { const [x, y] = at(i); marks.append(el("rect", { class: "av-ring", x: x + .2, y: y + .2, width: 9.6, height: 9.6, rx: 1.6 })); }
  // a bridge the chain built: a dot for each layer the square was short of full, so it reads without the points
  for (const { at: i, extra: n } of extra.relays || []) { const [x, y] = at(i); for (let k = 0; k < n; k++) marks.append(el("circle", { class: "av-relay", cx: x + 1.9 + k * 2.4, cy: y + 1.9, r: 1 })); }
  if (extra.tag) {
    const [x, y] = at(extra.tag[1]), t = el("text", { class: "av-tag", x: Math.min(58, Math.max(12, x + CELL / 2)), y: Math.max(3.4, y - 1.4) });
    t.textContent = extra.tag[0];
    marks.append(t);
  }
  if (extra.flake >= 0) { const [x, y] = at(extra.flake); marks.append(el("circle", { class: "av-flake", cx: x + CELL / 2, cy: y + CELL / 2, r: 1.6 })); }
  const kids = [el("rect", { class: "av-bed", x: -2, y: -2, width: 74, height: H * CELL + 3, rx: 2 }), sq, risk, chalets, windEl(extra.wind ?? S.wind), roadEl(extra.road || 0), marks];
  if (extra.night) kids.push(el("rect", { class: "av-night", x: -2, y: -2, width: 74, height: 91, rx: 2 }));
  kids.push(el("g", { id: "fx" }));
  $("board").replaceChildren(...kids);
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("best").textContent = fmt(Math.max(read(bestKey(), 0), S.score));
  const lesson = lessonOf(S) != null;
  document.querySelector(".av-best").hidden = lesson;      // a lesson's points count for nothing: no best beside them
  $("skipBtn").hidden = !lesson;
  const lives = $("lives");
  lives.replaceChildren(...Array.from({ length: LIVES }, (_, k) => { const p = document.createElement("i"); if (k < S.lives) p.className = "on"; return p; }));
  lives.setAttribute("aria-label", `${S.lives} of ${LIVES} lives`);
}
function drawSide(text) {
  $("tray").hidden = S.over;
  $("result").hidden = !S.over;
  if (S.over) {
    const best = read(bestKey(), 0);
    $("verdict").textContent = `The road buried a third time: ${fmt(S.score)}${S.score >= best && S.score > 0 ? ", your best" : ""}`;
    return;
  }
  const first = !read(SEEN, false) && S.days < 3, loaded = S.cells.slice(W * (H - 1)).filter(d => d >= CAP - 1).length;
  const wind = S.wind ? `, the wind ${WINDS[S.wind]} loading the ${S.wind === 1 ? "east" : "west"} side` : ", the night still";
  const n = S.plan.length;
  $("charges").replaceChildren(...Array.from({ length: CHARGES }, (_, k) => { const p = document.createElement("i"); if (k < n) p.className = "on"; return p; }));
  $("charges").setAttribute("aria-label", `${n} of ${CHARGES} charges laid`);
  const k = lessonOf(S);
  $("tray").classList.toggle("lesson", k != null);
  // a lesson's Fire waits for the step to be done, and once the day is told it is the way on
  $("fireBtn").textContent = S.told ? (k + 1 >= LESSON_DAYS ? "Play" : "Next") : "Fire";
  $("fireBtn").disabled = playing || (S.told ? false : k != null ? !ready(S) : !n);
  $("undoBtn").disabled = playing || !n || !!S.told;
  const lesson = k == null ? null : S.told ? S.told : ready(S) ? `${summary(foresee(S))}. Fire!` : instruction(S);
  $("line").textContent = text ?? lesson ?? (first && !n ? `Lay up to ${CHARGES} charges, then fire: they go off together, and a charge that sets nothing off alone can be the bridge`
    : n ? summary(foresee(S), n < CHARGES ? "" : "; tap a charge to lift it")
    : `Tonight ${snowfall(S.days)} layers of snow${wind}${loaded ? `; ${loaded} square${loaded === 1 ? "" : "s"} above the road full` : ""}`);
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** What an avalanche would do, in a line: its slides, the bridges it builds and the points, then the road and the chalets. */
function summary(f, tail = "") {
  if (!f.slide.size) return `No slide yet${tail}`;
  const bridges = f.relays.length ? `, ${plural(f.relays.length, "bridge")} built (+${f.reach - f.slide.size})` : "";
  return `${plural(f.slide.size, "slide")}${bridges}${f.slide.foot ? `, ${plural(f.slide.foot, "layer")} onto the closed road` : ""}${f.carried.length ? `, ${f.carried.length === 1 ? "a chalet" : "both chalets"} carried away, ${f.carried.length === 1 ? "halved" : "quartered"}` : ""}: +${fmt(f.gain)}${tail}`;
}
/** The slope with the day's charges on it and what they would set off. */
function render() {
  const view = planView(S);
  drawBoard(laid(S), view);
  drawStrip();
  drawRisk(S, view.danger);
  drawSide();
}
/** The legend under the slope: how many squares the hatching covers (what tonight's snow could bury the road from). */
function drawRisk(game, squares) {
  const k = lessonOf(game), box = $("risk");
  box.hidden = k == null && !dangerOn(game);    // a lesson keeps the row so its days are the same height
  box.classList.toggle("none", !squares.length || !!game.told);
  $("riskText").textContent = game.over || game.told || (k != null && !dangerOn(game)) ? ""
    : squares.length ? `${plural(squares.length, "square")} would bury the road tonight`
    : "No single flake would bury the road tonight";
}
/** How a game's laid charges and the avalanche they would set off are drawn: the extras for drawBoard. */
function planView(game) {
  const f = foresee(game);
  return { charges: game.plan, danger: dangerOn(game) ? danger(game) : [], ring: [...new Set(f.slide.waves.flat())], relays: f.relays, struck: f.carried, tag: f.slide.size ? [`+${fmt(f.gain)}`, game.plan[game.plan.length - 1]] : null };
}
/** What one more charge on a square (or one fewer, if the day's three are laid and it holds one) would set off, shown. */
function show(i) {
  if (S.told) return;
  const full = S.plan.length >= CHARGES;
  if (full && !S.plan.includes(i)) { render(); return; }
  const g = full ? lift(S, i) : lay(S, i), f = foresee(g);
  const view = planView(g);
  drawBoard(laid(g), view);
  drawRisk(g, view.danger);
  drawSide(`${full ? "Lift this charge: " : ""}${summary(f)}`);
}

// ---------- a day and a night ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, opts) => (node?.animate ? node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {}) : Promise.resolve());
/** One wave of an avalanche: the depths after it, and how many layers it sent onto the road. */
function step(cells, wave) {
  const c = cells.slice();
  let foot = 0;
  for (const i of wave) {
    c[i] -= CAP;
    const x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
      if (ny >= H) foot++;
      else if (nx >= 0 && ny >= 0 && nx < W && !rocksOf(S).includes(ny * W + nx)) c[ny * W + nx]++;
    }
  }
  return { cells: c, foot };
}
async function commit() {
  if (playing || S.over || !S.plan.length) return;
  const k = lessonOf(S);
  if (S.told || (k != null && !ready(S))) return;
  playing = true;
  aim = -1;
  const before = S, r = fire(S, k != null ? nightOf(k) : null);
  S = r.state;
  if (k != null) S.told = told(before, r);      // the lesson's day, said once it is done
  else {
    if (S.score > read(bestKey(), 0)) write(bestKey(), S.score);
    if (S.days >= 3) write(SEEN, true);
  }
  save();
  drawSide(" ");
  // the day: the charges laid, and the avalanche they set off wave by wave, the bridges dotted as they slide
  let cells = r.laid.slice(), chalets = before.chalets.slice();
  const slid = new Set();
  drawBoard(cells, { chalets, charges: before.plan });
  await wait(420);
  for (const wave of r.slide.waves) {
    cells = step(cells, wave).cells;
    wave.forEach(k => slid.add(k));
    drawBoard(cells, { sliding: wave, chalets, relays: r.relays.filter(b => slid.has(b.at)) });
    await wait(110);
  }
  if (r.carried.length) { await carry(r.carried); chalets = chalets.filter(c => !r.carried.includes(c)); }
  drawStrip();
  if (r.gain) { popup(r.slide.waves.flat(), r.gain); await wait(500); }
  // the night: the snow, layer by layer on the wind, and whatever it sets off (a lesson's first days have none)
  let road = 0;
  const night = { night: true, wind: r.wind };
  drawBoard(cells, { ...night, chalets });
  drawSide(`Night: ${r.night.length} layers of snow${r.wind ? `, the wind ${WINDS[r.wind]}` : ""}`);
  await wait(260);
  for (const { at: j, slide, carried } of r.night) {
    cells[j]++;
    drawBoard(cells, { ...night, chalets, flake: j, road });
    const drift = r.wind === 1 ? -14 : r.wind === 2 ? 14 : 0;
    await animate($("board").querySelector(".av-flake"), [{ transform: `translate(${drift}px, -14px)`, opacity: 0 }, { transform: "translate(0, 0)", opacity: 1 }], { duration: 240, easing: "ease-in" });
    for (const wave of slide?.waves || []) {
      const s = step(cells, wave);
      cells = s.cells;
      road += s.foot;
      drawBoard(cells, { ...night, chalets, sliding: wave, natural: true, road });
      await wait(110);
    }
    const gone = carried.filter(c => chalets.includes(c));
    if (gone.length) { await carry(gone); chalets = chalets.filter(c => !gone.includes(c)); }
  }
  if (r.buried) toast(S.over ? "The road buried a third time" : `The road is buried: ${S.lives} ${S.lives === 1 ? "life" : "lives"} left`);
  await wait(r.buried ? 700 : 300);
  playing = false;
  render();
}
/** Chalets a slide carries away: down the slope and gone (they're built again elsewhere). */
function carry(gone) {
  return Promise.all(gone.map(c => animate($("board").querySelector(`[data-chalet="${c}"]`), [{ transform: `translate(${at(c)[0]}px, ${at(c)[1]}px)`, opacity: 1 }, { transform: `translate(${at(c)[0]}px, ${at(c)[1] + 12}px) rotate(25deg)`, opacity: 0 }], { duration: 480, easing: "ease-in" })));
}
function popup(cells, gain) {
  const fx = $("board").querySelector("#fx"), u = [...new Set(cells)];
  const x = u.reduce((a, i) => a + at(i)[0], 0) / u.length + CELL / 2, y = u.reduce((a, i) => a + at(i)[1], 0) / u.length + CELL / 2;
  const t = el("text", { class: `av-pop${u.length >= 8 ? " big" : ""}`, x: x.toFixed(1), y: y.toFixed(1) });
  t.textContent = `+${fmt(gain)}`;
  fx.append(t);
  animate(t, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-12px)", opacity: 0 }], { duration: 1000, easing: "ease-out" });
}

// ---------- pressing the slope ----------
function cellAt(px, py) {
  const m = $("board").getScreenCTM();
  if (!m) return -1;
  const p = new DOMPoint(px, py).matrixTransform(m.inverse()), x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
  return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
}
function aimAt(e) {
  const hit = cellAt(e.clientX, e.clientY), i = rocksOf(S).includes(hit) ? -1 : hit;   // a charge can't be laid on rock
  if (i === aim) return;
  aim = i;
  if (i >= 0) show(i);
  else render();
}
$("board").addEventListener("pointerdown", e => {
  if (playing || S.over || S.told || e.button > 0 || cellAt(e.clientX, e.clientY) < 0) return;
  e.preventDefault();
  press = e.pointerId;
  aim = -2;
  aimAt(e);
});
addEventListener("pointermove", e => {
  if (press === e.pointerId) aimAt(e);
  else if (press == null && !playing && !S.over && !S.told && e.pointerType === "mouse" && e.target.closest?.("#board")) aimAt(e);   // a mouse shows a charge as it passes
});
addEventListener("pointerup", e => {
  if (press !== e.pointerId) return;
  press = null;
  const i = cellAt(e.clientX, e.clientY), full = S.plan.length >= CHARGES;
  if (i >= 0 && i === aim && !(full && !S.plan.includes(i))) { S = full ? lift(S, i) : lay(S, i); save(); }
  aim = -1;
  render();
});
addEventListener("pointercancel", e => { if (press === e.pointerId) { press = null; aim = -1; render(); } });
$("fireBtn").addEventListener("click", () => (S.told ? nextDay() : commit()));
$("skipBtn").addEventListener("click", () => { if (!playing) endLesson(); });
$("undoBtn").addEventListener("click", () => { if (playing || S.over || S.told || !S.plan.length) return; S = lift(S); save(); render(); });
$("board").addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && press == null && aim >= 0 && !playing) { aim = -1; render(); } });

// ---------- messages, the menu ----------
let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const lesson = lessonOf(S) != null;
  part(body, "play").append(lesson ? action("Skip the lesson", endLesson, "primary") : action("New game", newRun, "primary"));
  part(body, "content").append(choice("Slope", [[false, "Open"], [true, "Rocky"]], slope(), rocky => { write(OPTS, { ...read(OPTS, {}), rocky }); openMenu(); }),
    line(slope() ? "Four squares of bare rock hold no snow and turn aside what slides onto them. From the next game." : "Snow all the way across. Rocky puts four bare squares on the slope, from the next game."));
  part(body, "settings").append(
    toggle("Danger shading", read(OPTS, {}).danger !== false, on => { write(OPTS, { ...read(OPTS, {}), danger: on }); render(); }),
    line("Hatches the squares where one more layer of snow tonight would bury the road, as the charges stand."),
    ...(lesson ? [] : [action("Replay the lesson", startLesson, "link")]));
  const best = read(bestKey(), 0);
  part(body, "about").append(line(`This game: ${fmt(S.score)} in ${S.days} day${S.days === 1 ? "" : "s"}${best ? `; your best ${fmt(best)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "avalanche");
document.querySelector(".av-mark").innerHTML = APPS.find(a => a.id === "avalanche").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", newRun);

// for tests and debugging
window.__avalanche = { get state() { return S; }, commit, cellAt, newRun, startLesson, nextDay, endLesson, put: i => { S = lay(S, i); save(); render(); } };

S = read(RUN, null);
// a first visit, with no game and none ever played, opens on the lesson
if (!valid(S)) { if (!read(TAUGHT, false) && !read(SEEN, false)) startLesson(); else newRun(); }
else { S = upgrade(S); render(); }
