// Ingot: a four-by-four board of metal bars; swipe (or press an arrow) and every bar slides as far as it will go, equal
// bars that meet merge into one of twice the value, and a new bar lands. The rules and the search are ingot-engine.js's;
// this file draws the board, plays each swipe out (the slide, then the merges and the new bar) and keeps the game.
// The game in play is kept (`ingot:run`) and opens again where it was; the best is `ingot:best`, the daily's results
// `ingot:daily` by the day (counted the moment a game on the day's board ends). A first visit gets a short lesson first
// (`ingot:taught` once it is done or skipped). The Foundry's levels are ingot-levels.js's; the stars each has earned are
// `ingot:foundry` ({ stars: { id: 1 to 3 } }), and the level being played `ingot:level`.
import { SLAG, ANVIL, MODES, DIRS, WIN, newGame, newLevel, daySeed, move, undo, end, valid, hint, searchOn, play, value, commission } from "./ingot-engine.js";
import { LEVELS, CHAPTERS } from "./ingot-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, onPause, isPaused, todayPart } from "./menu.js";
import { roundOver } from "./random.js";
import { sure } from "./sure.js";
import { today, arrivedForToday, IN_FRAME } from "./suite.js";

const $ = id => document.getElementById(id);
const DAILY = "ingot:daily", MODE = "ingot:mode", COMMISSIONS = "ingot:commission", FOUNDRY = "ingot:foundry", LEVEL = "ingot:level";
// a game in play and a best for each mode (the classic's keys as they always were); Today's is the classic's board
const runKey = m => (m === "ingot" ? "ingot:run" : `ingot:run:${m}`), bestKey = m => (m === "ingot" ? "ingot:best" : `ingot:best:${m}`);
const BEST_NOW = () => bestKey(S?.mode || "ingot");
/** The bars a commission asks for, one after another as they are met: 128, 256, 512, 1024, then 2048 each time. */
const LADDER = [7, 8, 9, 10, 11];
const commissionsDone = () => read(COMMISSIONS, { done: 0 }).done || 0;
// the Foundry: a level's stars (3 at or under the search's par, 2 within half the slack, 1 within the swipes allowed)
const starsOf = g => (!g.won ? 0 : g.moves <= g.goal.par ? 3 : g.moves <= (g.goal.par + g.goal.swipes) / 2 ? 2 : 1);
const starText = n => "★".repeat(n) + "☆".repeat(3 - n);
const earned = () => read(FOUNDRY, { stars: {} }).stars || {};
/** The levels open: every one met, and the first not yet met. */
const openTo = () => { const st = earned(), k = LEVELS.findIndex(L => !st[L.id]); return k < 0 ? LEVELS.length - 1 : k; };
const levelNow = () => { const id = read(LEVEL, null), k = LEVELS.findIndex(L => L.id === id); return LEVELS[k >= 0 && k <= openTo() ? k : openTo()]; };
const levelOf = g => LEVELS.find(L => L.id === g?.level);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
let mode = MODES[read(MODE, "ingot")] ? read(MODE, "ingot") : "ingot";
const fmt = n => n.toLocaleString("en-GB");
const SLIDE = 110, POP = 160, HINT_MS = 2600;

let S = null;             // the game (ingot-engine.js's), as saved, plus kind ("random" or "daily"), day and par
let busy = false;         // a swipe being played out
let pending = null;       // a swipe made meanwhile, played when this one is done
let hintTimer = 0;
let teach = null;         // the first game's lesson, while it runs: { step, real (the game it stands in front of) }
let teachTimer = 0;
let tileEls = [];
const sideNow = () => Math.round(Math.sqrt(S.grid.length));
const pars = new Map();   // seed -> the search's score, worked out once

const dayDone = (day = today()) => read(DAILY, {})[day] != null;
const started = () => !!S && S.moves > 0 && !S.over;
const save = () => { if (!teach) write(runKey(S.mode || "ingot"), S); };   // (the lesson's boards are never kept)
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- a game ----------
function newRun(kind = "random") {
  if (teach) quitLesson();
  const day = kind === "daily" ? today() : null;
  const seed = kind === "daily" ? daySeed(day) : Math.floor(Math.random() * 2 ** 31);
  if (kind === "daily" && mode !== "ingot") { mode = "ingot"; write(MODE, mode); }        // Today's board is the classic's
  if (kind !== "daily" && mode === "foundry") S = { ...newLevel(levelNow()), kind, day: null, par: null };
  else if (kind !== "daily" && mode === "commission") {
    const c = commission(seed, LADDER[Math.min(commissionsDone(), LADDER.length - 1)]);
    S = { ...newGame(c.seed, "commission", c.goal), kind, day, par: null };
  } else S = { ...newGame(seed, kind === "daily" ? "ingot" : mode), kind, day, par: null };
  busy = false;
  pending = null;
  save();
  render();
  ensurePar();
}
/** What the search scores on this game's board (the same spawns, if it plays the swipes it likes): worked out in the
 *  background in small slices, so the page never waits for it. */
function ensurePar() {
  const seed = S.seed;
  if (S.par != null || IN_FRAME || S.goal) return;
  if (pars.has(seed)) { S.par = pars.get(seed); save(); drawLine(); return; }
  let g = newGame(seed, S.mode);
  const slice = () => {
    if (!S || S.seed !== seed) return;
    const t = performance.now();
    while (!g.over && performance.now() - t < 6) g = play(g, 1, 2);
    if (!g.over) { setTimeout(slice, 24); return; }
    pars.set(seed, g.score);
    S.par = g.score;
    save();
    drawLine();
  };
  setTimeout(slice, 400);
}
/** A game that has ended counts once: its best, and for the day's board the day's result (the first game on it). */
function settle() {
  if (!S.over || IN_FRAME) return;
  if (S.score > read(BEST_NOW(), 0)) write(BEST_NOW(), S.score);
  if (S.kind === "daily" && S.day && !dayDone(S.day)) write(DAILY, { ...read(DAILY, {}), [S.day]: S.score });
  if (S.mode === "foundry") {
    const st = earned(), n = starsOf(S);
    if (n > (st[S.level] || 0)) write(FOUNDRY, { stars: { ...st, [S.level]: n } });
    return;
  }
  if (S.goal && S.won && !S.counted) { S.counted = true; write(COMMISSIONS, { done: commissionsDone() + 1 }); save(); }
}
function finish() {
  save();
  settle();
  render();
  if (!IN_FRAME) roundOver("ingot");
}

// ---------- drawing ----------
const metalOf = e => Math.min(e - 1, 13);
// A cast ingot seen from above: the top face, and the four faces sloping down to the wider foot, each lit its own way (the
// light from the far left); its value struck into the top. One drawing for every bar, its metal from the tile's colours.
const INGOT = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path class="f-n" d="M5 17H95L83 28H17Z"/><path class="f-w" d="M5 17L17 28V74L5 86Z"/>
  <path class="f-e" d="M95 17V86L83 74V28Z"/><path class="f-s" d="M5 86L17 74H83L95 86Z"/>
  <rect class="f-top" x="17" y="28" width="66" height="46"/><rect class="f-sheen" x="17" y="28" width="66" height="46"/>
  <path class="f-rim" d="M5 17H95V86H5ZM17 28V74H83V28Z"/>
  <text class="f-deep" x="50" y="53"></text><text class="f-num" x="50" y="51.6"></text>
  <rect class="f-heat" x="5" y="17" width="90" height="69"/>
</svg>`;
/** A lump of slag: dark, pitted, no value; it blocks its pocket until two bars merged beside it knock it loose. */
const LUMP = `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="s-lump" d="M14 58C10 44 20 30 34 27C40 18 58 16 68 25C82 26 92 38 89 52C94 64 86 79 72 80C62 89 42 88 33 81C20 82 10 72 14 58Z"/>
  <path class="s-hi" d="M30 34C38 27 52 24 62 29"/><circle class="s-pit" cx="40" cy="52" r="4.5"/><circle class="s-pit" cx="60" cy="44" r="3.2"/><circle class="s-pit" cx="64" cy="64" r="5"/><circle class="s-pit" cx="45" cy="70" r="2.6"/></svg>`;
function tileEl(e, i) {
  const t = document.createElement("div"), side = sideNow();
  t.className = "ig-tile";
  t.style.setProperty("--c", i % side);
  t.style.setProperty("--r", Math.floor(i / side));
  if (e === SLAG) { t.classList.add("slag"); t.innerHTML = LUMP; return t; }
  if (e === ANVIL) { t.classList.add("anvil"); t.innerHTML = ANVIL_SVG; return t; }
  t.dataset.m = metalOf(e);
  t.dataset.s = (e - 1) % 12;
  t.dataset.d = String(value(e)).length;
  t.innerHTML = INGOT;
  for (const tx of t.querySelectorAll("text")) tx.textContent = String(value(e));
  const stamp = document.createElement("i");
  stamp.className = "ig-stamp";
  t.append(stamp);
  return t;
}
/** The mould's pockets, as many as the board has, and its side for the drawing; a Foundry level's cold pockets frosted and
 *  its hallmark struck with the bar it wants. */
function drawSlots() {
  const side = sideNow(), slots = $("slots");
  $("board").style.setProperty("--n", side);
  $("board").dataset.side = side;
  if (slots.children.length !== side * side) slots.replaceChildren(...Array.from({ length: side * side }, () => document.createElement("i")));
  const cold = new Set(S.cold || []), at = S.goal?.at;
  [...slots.children].forEach((x, i) => {
    x.classList.toggle("cold", cold.has(i));
    x.classList.toggle("mark", i === at);
    if (i === at) x.dataset.v = fmt(value(S.goal.e)); else delete x.dataset.v;
  });
}
function drawBoard(born = -1, merged = []) {
  const box = $("tiles");
  drawSlots();
  box.replaceChildren();
  tileEls = new Array(S.grid.length).fill(null);
  S.grid.forEach((e, i) => {
    tileEls[i] = null;
    if (!e) return;
    const t = tileEl(e, i);
    box.append(t);
    tileEls[i] = t;
    // a new bar is set down in its pocket; two that meet are poured into one, which comes out glowing and cools
    if (i === born) animate(t, [{ transform: "translateY(-6%) scale(.82)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1 }], { duration: POP, easing: "ease-out" });
    else if (merged.includes(i)) {
      animate(t, [{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }], { duration: POP, easing: "ease-out" });
      if (!calm()) t.classList.add("hot");
    }
  });
  $("board").classList.toggle("over", S.over);
}
function drawLine() {
  if (S.mode === "foundry") {
    const L = levelOf(S), want = `Cast a ${fmt(value(S.goal.e))}${S.goal.at != null ? " on the hallmark" : ""}`;
    $("line").textContent = S.moves === 0 ? `${L.n}. ${L.name}: ${L.note} ${want} in ${S.goal.swipes} swipes.` : `${L.n}. ${L.name} · ${want} · ${S.moves} of ${S.goal.swipes} swipes`;
    return;
  }
  if (S.goal) { $("line").textContent = `Commission: cast a ${fmt(value(S.goal.e))} in ${S.goal.swipes} swipes · ${S.moves} swiped`; return; }
  const where = S.kind === "daily" ? "Today's board" : S.mode === "ingot" ? "Random board" : MODES[S.mode].name;
  $("line").textContent = `${where} · ${S.moves} swipe${S.moves === 1 ? "" : "s"} · par ${S.par == null ? "…" : fmt(S.par)}`;
}
function drawStrip() {
  $("score").textContent = fmt(S.score);
  $("topBar").textContent = fmt(value(S.top));
  const foundry = S.mode === "foundry";
  $("bestName").textContent = foundry ? "Par" : "Best";
  $("best").textContent = foundry ? `${S.goal.par} swipes` : fmt(Math.max(read(BEST_NOW(), 0), S.score));
}
function drawSide() {
  $("coach").hidden = !teach;
  if (teach) { $("tools").hidden = $("line").hidden = $("result").hidden = true; return; }
  $("tools").hidden = $("line").hidden = S.over;
  $("result").hidden = !S.over;
  $("undoLeft").textContent = S.undos;
  $("hintLeft").textContent = S.hints;
  $("undoBtn").disabled = !S.prev || S.undos <= 0 || S.over;
  $("hintBtn").disabled = S.hints <= 0 || S.over;
  $("againBtn").textContent = S.mode === "foundry" ? (S.won && LEVELS[levelOf(S).n] ? "Next level" : "Try again") : "New game";
  if (!S.over) { drawLine(); return; }
  if (S.mode === "foundry") {
    const want = `${fmt(value(S.goal.e))}${S.goal.at != null ? " on the hallmark" : ""}`;
    $("verdict").textContent = S.won ? `Cast: a ${want} in ${S.moves} swipes, par ${S.goal.par}. ${starText(starsOf(S))}${LEVELS[levelOf(S).n] ? "" : " The last level: the Foundry is done."}`
      : S.ended ? "Level given up." : S.moves >= S.goal.swipes ? `Out of swipes: the ${want} wasn't cast.` : `No swipe left: the ${want} wasn't cast.`;
    return;
  }
  if (S.goal) {
    $("verdict").textContent = S.won ? `Commission met: a ${fmt(value(S.goal.e))} in ${S.moves} swipes of ${S.goal.swipes}.` : S.ended ? "Commission given up." : S.moves >= S.goal.swipes ? `Out of swipes: the ${fmt(value(S.goal.e))} wasn't cast.` : `No swipe left: the ${fmt(value(S.goal.e))} wasn't cast.`;
    return;
  }
  const best = read(BEST_NOW(), 0), parts = [S.ended ? "Ended" : "No swipe left"];
  let v = `${parts[0]}: ${fmt(S.score)}`;
  if (S.score >= best && S.score > 0) v += ", your best";
  if (S.par != null) v += `. Par ${fmt(S.par)}: ${S.score >= S.par ? "beaten" : `${fmt(S.par - S.score)} short`}`;
  if (S.reached) v += ". 2048 made";
  if (S.kind === "daily") v += `. Today's board counted${read(DAILY, {})[S.day] === S.score ? "" : " (your first go stands)"}`;
  $("verdict").textContent = v + ".";
}
function render(born, merged) { drawBoard(born, merged); drawStrip(); drawSide(); }

// ---------- a swipe ----------
function animate(node, frames, opts) {
  if (!node?.animate || calm()) return Promise.resolve();
  return node.animate(frames, { fill: "both", ...opts }).finished.catch(() => {});
}
/** Every bar that moves slides to its square; a bar that merges slides on under the one it joins. */
function slideAll(slides) {
  return Promise.all(slides.filter(s => s.to !== s.from && tileEls[s.from]).map(s => {
    const side = sideNow(), dx = (s.to % side) - (s.from % side), dy = Math.floor(s.to / side) - Math.floor(s.from / side);
    tileEls[s.from].style.zIndex = s.into ? 0 : 1;
    return animate(tileEls[s.from], [{ transform: "translate(0, 0)" }, { transform: `translate(${dx * 100}%, ${dy * 100}%)` }], { duration: SLIDE, easing: "cubic-bezier(.25, .8, .3, 1)" });
  }));
}
async function swipeTo(dir) {
  if (IN_FRAME || !S || S.over || isPaused()) return;
  if (busy) { pending = dir; return; }
  const r = move(S, dir);
  if (!r || (teach && !LESSON[teach.step].want?.includes(dir))) { nudge(dir); return; }
  busy = true;
  hideHint();
  S = r.state;
  save();
  if (!teach && S.score > read(BEST_NOW(), 0)) write(BEST_NOW(), S.score);
  if (r.gain) navigator.vibrate?.(8);
  await slideAll(r.slides);
  if (r.loose?.length) await crack(r.loose);
  render(r.bar.at, r.slides.filter(s => s.into).map(s => s.to));
  if (r.made) toast(`${fmt(2 ** WIN)}: gilt. Play on`);
  busy = false;
  if (teach) { learned(); return; }
  if (r.over) { finish(); return; }
  if (pending) { const d = pending; pending = null; swipeTo(d); }
}
/** Slag knocked loose: the lumps crack and fall away before the board is drawn again. */
function crack(at) {
  return Promise.all(at.map(i => animate(tileEls[i], [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.15) rotate(8deg)", opacity: 0 }], { duration: 220, easing: "ease-in" })));
}
/** A swipe that moves nothing: the board gives a little, so it's known to have been heard. */
function nudge(dir) {
  const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0, dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
  animate($("tiles"), [{ transform: "translate(0, 0)" }, { transform: `translate(${dx * 1.2}cqw, ${dy * 1.2}cqw)` }, { transform: "translate(0, 0)" }], { duration: 140, easing: "ease-out" });
}

// ---------- undo, hint ----------
function takeBack() {
  if (busy || IN_FRAME) return;
  const u = undo(S);
  if (!u) return;
  S = u;
  save();
  hideHint();
  render();
}
function showHint() {
  if (busy || IN_FRAME || S.over || S.hints <= 0) return;
  const h = hint(S.grid, 3, searchOn(S));
  if (!h.dir) return;
  S = { ...S, hints: S.hints - 1 };
  save();
  drawSide();
  const a = $("hintArrow");
  a.dataset.dir = h.dir;
  a.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(hideHint, HINT_MS);
}
function hideHint() { clearTimeout(hintTimer); $("hintArrow").hidden = true; }
onPause(hideHint, () => {});

// ---------- input ----------
let touch = null;   // { id, x, y, fired }: a finger or the mouse down, until it has swiped once
function boardSize() { return $("board").getBoundingClientRect().width || 300; }
function down(e) {
  if (touch || e.target.closest("button, dialog, a") || (e.pointerType === "mouse" && e.button !== 0)) return;
  touch = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
}
function drag(e) {
  if (!touch || e.pointerId !== touch.id || touch.fired) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y, far = Math.max(22, boardSize() * 0.07);
  if (Math.max(Math.abs(dx), Math.abs(dy)) < far) return;
  touch.fired = true;
  swipeTo(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"));
}
function up(e) { if (touch && e.pointerId === touch.id) touch = null; }
const KEYS = { ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", a: "left", w: "up", d: "right", s: "down", h: "left", k: "up", l: "right", j: "down" };
function key(e) {
  const dir = KEYS[e.key];
  if (!dir || e.ctrlKey || e.metaKey || e.altKey || isPaused()) return;
  e.preventDefault();
  swipeTo(dir);
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
/** Leaving a game on the day's board before it ends loses its result: ask first. */
async function leaveOk() {
  if (!(started() && S.kind === "daily" && !dayDone(S.day))) return true;
  return sure("Today's board only counts when it ends. Leave this game?", { yes: "Leave it" });
}
async function fresh(kind) {
  if (teach) quitLesson();
  if (!(await leaveOk())) return;
  newRun(kind);
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action(mode === "commission" ? "New commission" : mode === "foundry" ? "Restart this level" : "New game", () => fresh("random"), "primary"));
  if (!IN_FRAME && !teach) play.append(action("How to play", () => { $("menuDlg").close(); startLesson(); }, "link"));
  const day = read(DAILY, {})[today()];
  todayPart(body, { done: dayDone(), result: day != null ? fmt(day) : "", play: () => fresh("daily"), playing: S.kind === "daily" && S.day === today() && !S.over });   // fresh asks before it leaves a game
  if (started()) play.append(action("End this game", async () => {
    if (!(await sure("End this game here? Its score stands.", { yes: "End it" }))) return;
    S = end(S);
    finish();
  }, "link"));
  // the modes (Korbi, 23 Nov 2026: "sure try some I'll test them"): each keeps its own game in play and its own best
  const content = part(body, "content");
  content.append(choice("Mode", Object.entries(MODES).map(([k, m]) => [k, m.name]), mode, async v => {
    if (teach) quitLesson();
    if (!(await leaveOk())) { openMenu(); return; }
    mode = v;
    write(MODE, v);
    const kept = read(runKey(v), null);
    if (valid(kept) && (kept.mode || "ingot") === v) { S = kept; render(); ensurePar(); } else newRun("random");
    openMenu();
  }), line(MODE_WORDS[mode]));
  if (mode === "foundry") foundryMenu(content);
  const best = read(BEST_NOW(), 0), st = earned();
  part(body, "about").append(line(S.mode === "foundry" ? `Foundry levels met: ${Object.keys(st).length} of ${LEVELS.length}, ${Object.values(st).reduce((a, b) => a + b, 0)} of ${3 * LEVELS.length} stars`
    : S.goal ? `Commissions met: ${commissionsDone()}` : `This game: ${fmt(S.score)} in ${S.moves} swipe${S.moves === 1 ? "" : "s"}, the top bar ${fmt(value(S.top))}${best ? `; your best ${fmt(best)}` : ""}`),
    line("Today's board is the same for everyone, the classic four by four: the same bars land where the same swipes make room. A second go is practice."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

/** The Foundry's chapter and level, as far as they are open: a pick starts that level. */
function foundryMenu(box) {
  const open = openTo(), st = earned(), L = levelOf(S) || levelNow(), chapter = CHAPTERS.find(c => c.id === L.chapter);
  const chapters = CHAPTERS.filter(c => LEVELS.findIndex(x => x.chapter === c.id) <= open);
  const go = async id => {
    if (!(await leaveOk())) return;
    write(LEVEL, id);
    newRun("random");
    openMenu();
  };
  box.append(choice("Chapter", chapters.map(c => [c.id, c.name]), chapter.id, v => go(LEVELS.find(x => x.chapter === v).id)),
    choice("Level", LEVELS.filter((x, i) => x.chapter === chapter.id && i <= open).map(x => [x.id, `${x.n}${st[x.id] ? ` ${starText(st[x.id])}` : ""}`]), L.id, v => go(v)),
    line(`${chapter.idea} This level, ${L.n}. ${L.name}: ${L.note}`));
}
const MODE_WORDS = {
  ingot: "Four by four: merge your way up to a 2048 and on, for the score.",
  great: "Five by five: the long game, the score running on and on.",
  slag: "Every ninth pour is a lump of slag that blocks its pocket; two bars merged beside it knock it loose.",
  commission: "An order to cast one bar in so many swipes: met once, the next asks for a bigger one.",
  foundry: "Written levels, a twist to each chapter: anvils, hallmarks, slag, cold squares. Cast the bar in the swipes allowed; stars for doing it in fewer.",
};
// an anvil seen from above: the face, the horn tapering to one side, the heel square to the other, the hardy hole in the heel
const ANVIL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="a-body" d="M8 50C18 38 30 33 40 32H86V68H40C30 67 18 62 8 50Z"/>
  <path class="a-face" d="M40 37H81V63H40C33 62 24 58 18 50C24 42 33 38 40 37Z"/><rect class="a-hole" x="70" y="45" width="7" height="7"/></svg>`;

// ---------- the first game's lesson ----------
// Korbi, 22 Nov 2026: "When user first opens up 2048 without having played the tutorial, add a quick interactive tutorial
// showing how the game is played and what the goal is". Two swipes on set boards (the arrow shows which way; another way only
// nudges the board), then the goal. It stands in front of the game, which waits untouched; done or skipped, it is kept as
// ingot:taught (synced, so one device teaches them all), and the menu's How to play brings it back.
const TAUGHT = "ingot:taught";
const LESSON = [
  { grid: [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], want: ["left"], show: "left",
    say: "Swipe left, or press ←. Every bar slides as far as it can, and two equal bars that meet become one of twice the value.",
    done: "2 and 2 made a 4, and 4 points. After every swipe a new bar lands." },
  { grid: [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0], want: ["up", "down"], show: "up",
    say: "Now make an 8: swipe so the two 4s meet.", done: "An 8, and 8 points: the bigger the bars you merge, the more they score." },
  { say: "The goal: merge your way up to a 2048 bar, then play on for the score. The game ends when no swipe moves anything. Undo and Hint: three of each a game." },
];
function startLesson() {
  if (IN_FRAME || busy || teach) return;
  hideHint();
  teach = { step: 0, real: S };
  lessonStep();
}
function lessonStep() {
  const L = LESSON[teach.step], last = teach.step === LESSON.length - 1;
  if (L.grid) {
    const g = newGame(7);
    S = { ...g, grid: L.grid.slice(), top: Math.max(...L.grid), undos: 0, hints: 0, kind: "random" };
    render();
    const a = $("hintArrow");
    a.dataset.dir = L.show;
    a.hidden = false;
  } else hideHint();
  $("coachSay").textContent = L.say;
  $("coachSkip").hidden = last;
  $("coachPlay").hidden = !last;
  drawSide();
}
/** The lesson's swipe was made: what it did, then the next step. */
function learned() {
  hideHint();
  $("coachSay").textContent = LESSON[teach.step].done;
  clearTimeout(teachTimer);
  teachTimer = setTimeout(() => { if (!teach) return; teach.step++; lessonStep(); }, calm() ? 2200 : 1700);
}
function quitLesson() {
  if (!teach) return;
  clearTimeout(teachTimer);
  hideHint();
  S = teach.real;
  teach = null;
  write(TAUGHT, true);
  render();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "ingot");
document.querySelector(".ig-mark").innerHTML = APPS.find(a => a.id === "ingot").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("againBtn").addEventListener("click", () => {
  if (S.mode === "foundry" && S.won && LEVELS[levelOf(S).n]) write(LEVEL, LEVELS[levelOf(S).n].id);   // on to the next level
  fresh("random");
});
$("undoBtn").addEventListener("click", takeBack);
$("hintBtn").addEventListener("click", showHint);
$("coachSkip").addEventListener("click", quitLesson);
$("coachPlay").addEventListener("click", quitLesson);
$("app").addEventListener("pointerdown", down);
addEventListener("pointermove", drag);
addEventListener("pointerup", up);
addEventListener("pointercancel", up);
addEventListener("keydown", key);

// for tests and debugging
window.__ingot = { get state() { return S; }, get lesson() { return teach && teach.step; }, swipeTo, newRun, DIRS };

const forToday = arrivedForToday();   // from the games screen's tile: today's board, still to play
S = read(runKey(mode), null);
if (!valid(S) || (S.mode || "ingot") !== mode) { S = null; newRun(mode === "ingot" && !dayDone() ? "daily" : "random"); }
else { render(); settle(); ensurePar(); }
if (forToday && !IN_FRAME && !(S.kind === "daily" && S.day === today()) && !dayDone()) {
  if (!started() || await sure("Today's board is waiting. Leave the game you've started?", { yes: "Leave it" })) newRun("daily");
}
// a first visit (nothing kept, no swipe made yet): the lesson first
if (!IN_FRAME && !read(TAUGHT, false) && !started() && !read(bestKey("ingot"), 0)) startLesson();
