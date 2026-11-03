// Pipes: a fitting puzzle. A hand of pieces must all fit one route for the oil from the wellhead to the terminal, with
// stars. The menu's Board chooses where it is played: flat, or the 3D map (a stack of floors you turn with a finger); both
// are pipes-puzzle-ui.js with different levels. This file is the page round it: the menu, the rules, the old saves
// cleared, and the games screen's Random round.
import { createPuzzle } from "./pipes-puzzle-ui.js";
import { STAR_LIFTS } from "./pipes-puzzle.js";
import { LEVELS as MAP_LEVELS, CHAPTERS as MAP_CHAPTERS } from "./pipes-map-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line, onPause } from "./menu.js";
import { IN_FRAME } from "./suite.js";           // a partner watching's frame: it writes nothing
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const KEY = { prefs: "pipes:prefs", best: "pipes:best" };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- the boards ----------
const MODES = [["flat", "Flat (square)"], ["map", "Cube (3D map)"]];
let prefs = { mode: "flat", ...read(KEY.prefs, {}) };
let mode = "flat";
const deps = { $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { noteBest(); roundOver("pipes"); }, reduced };
const flat = createPuzzle(deps);
const map = createPuzzle(deps, { map: true, levels: MAP_LEVELS, chapters: MAP_CHAPTERS, run: "pipes:map", stars: "pipes:mapstars" });
const boards = { flat, map };
const cur = () => boards[mode];

/** The games screen shows `pipes:best`: here, the stars won across the boards. */
function noteBest() {
  if (IN_FRAME) return;
  write(KEY.best, { score: Object.values(boards).reduce((n, b) => n + b.totalStars(), 0) });
}
function setMode(m) {
  boards[mode]?.hide();
  mode = boards[m] ? m : "flat";
  prefs.mode = mode;
  if (!IN_FRAME) write(KEY.prefs, prefs);
  cur().show();
}

// ---------- the rules ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Lay pipe for the oil. Every level is a board and a hand of pieces, and every piece must go down: the oil leaves the wellhead, runs through all of them, and into the terminal. No clock, no queue. The menu's Board chooses where it is played.</p>
    <ul>
      <li><b>Tap a piece in the hand</b>, then a square, to lay it. <b>Tap a piece you've laid</b> to take it back up (it's in your hand again: tap another square). The dashed line is the oil's way from the wellhead, and back from the terminal; the ringed square is where it needs a piece next, and a red cross is where it's stopped.</li>
      <li><b>Rock</b> can't be built on. <b>Old pipe</b> (dark, studded) is already in the ground, and the oil must run through it. <b>Stakes</b> are numbered: the oil passes them in order. A <b>crossing</b> carries the oil across itself, and the oil may pass it twice.</li>
      <li><b>Undo</b> is free, as many times as you like. <b>Hint</b> shows where the next piece goes, or which of yours is in the way; with one, the level can earn only the one star.</li>
      <li><b>Stars</b>: one for solving a level, two for solving it without a hint, three for that and hardly any piece taken back up (${STAR_LIFTS} at most, and one more for every six pieces in the hand).</li>
    </ul>
    <h4>Flat</h4>
    <p>Pieces are never turned: a bend comes as it is, so the bends in your hand decide which ways the route can turn.</p>
    <h4>Cube (3D map)</h4>
    <p>The same puzzle in a cube of squares: a stack of <b>floors</b>, drawn lifted one above the next. Pieces still never turn, but now a piece can open <b>up</b> or <b>down</b> as well: a <b>riser</b> (a ring with arrows) carries the pipe through to the floor above or below, where the next piece must open the other way. <b>Tap a floor</b> (or its number on the left) to bring it forward and play on it; the floors above it fade so you can see through. <b>Drag</b> to turn the stack, <b>double-tap</b> empty space or tap the ⟲ to put it back, and <b>Look</b> brings forward the floor where the oil needs its next piece.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody"), b = cur();
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Menu";
  const game = choice("Board", MODES, mode, v => { $("menuDlg").close(); setMode(v); });
  const solved = b.run?.solved;
  part(body, "play").append(action(solved ? "Next level" : "Level again", () => (solved ? b.next() : b.again()), "primary"), action("The rules", showRules, "link"));
  part(body, "content").append(MODES.length > 1 ? game : "", b.levelList(id => { $("menuDlg").close(); b.go(id); }));
  part(body, "about").append(line(`${b.solvedCount()} of ${b.count} levels solved, ${b.totalStars()} of ${b.count * 3} stars. Three stars: no hint, and hardly a piece taken back up.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

let toastTimer = null;
function toast(msg, ms = 2000) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "pipes");
document.querySelector(".pi-mark").innerHTML = APPS.find(a => a.id === "pipes").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
// the buttons under the board belong to whichever board is showing
for (const [id, fn] of [["pzUndo", b => b.undo()], ["pzClear", b => b.clear()], ["pzHint", b => b.hint()], ["pzAgain", b => b.again()], ["pzNext", b => b.next()],
  ["pzLift", b => b.toggleLift()], ["pzLook", b => b.look()]]) $(id).addEventListener("click", () => fn(cur()));
onPause(() => cur().pause(), () => cur().resume());
window.addEventListener("resize", () => cur().resize?.());
window.__pipes = { get mode() { return mode; }, boards, setMode };

// the board and bests of the modes Pipes had before the puzzle (a queue, a clock, a shaft) and of the face-of-a-solid cube and dodecahedron are no more
if (!IN_FRAME) for (const k of ["pipes:plan", "pipes:flat", "pipes:deep", "pipes:daily", "pipes:run", "pipes:acts", "pipes:cube", "pipes:cubestars", "pipes:dodeca", "pipes:dodecastars"]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
{
  const best = read(KEY.best, null);
  if (!IN_FRAME && best && typeof best.score !== "number") try { localStorage.removeItem(KEY.best); } catch { /* private mode */ }
}
setMode(prefs.mode);
