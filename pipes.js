// Pipes: a fitting puzzle. A hand of pieces must all fit one route for the oil from the wellhead to the terminal, with
// stars. The menu's Board chooses where it is played: flat (pipes-puzzle-ui.js) or on the faces of a cube you turn
// (pipes-solid-ui.js). This file is the page round it: the menu,
// the rules, the old saves cleared, and the games screen's Random round.
import { createPuzzle } from "./pipes-puzzle-ui.js";
import { createSolid } from "./pipes-solid-ui.js";
import { STAR_LIFTS } from "./pipes-puzzle.js";
import { LEVELS as CUBE_LEVELS, CHAPTERS as CUBE_CHAPTERS } from "./pipes-cube-levels.js";
import { LEVELS as DODECA_LEVELS, CHAPTERS as DODECA_CHAPTERS } from "./pipes-dodeca-levels.js";
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
const MODES = [["flat", "Flat"], ["cube", "Cube"], ["dodeca", "Dodecahedron"]];
let prefs = { mode: "flat", ...read(KEY.prefs, {}) };
let mode = "flat";
const flat = createPuzzle({ $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { noteBest(); roundOver("pipes"); }, reduced });
const cube = createSolid({ $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { noteBest(); roundOver("pipes"); }, reduced,
  solid: "cube", key: "cube", levels: CUBE_LEVELS, chapters: CUBE_CHAPTERS });
const dodeca = createSolid({ $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { noteBest(); roundOver("pipes"); }, reduced,
  solid: "dodeca", key: "dodeca", levels: DODECA_LEVELS, chapters: DODECA_CHAPTERS });
const boards = { flat, cube, dodeca };
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
    <h4>Cube</h4>
    <p>The same puzzle on the faces of a cube: the oil runs over an edge into the next face. <b>Drag</b> to turn the cube, pinch to zoom, and <b>tap a tile</b> to lay the piece in hand: it is turned to take the oil as it stands. <b>Tap a piece you've laid</b> to turn it a step; <b>Lift</b>, then a piece, takes it back up. <b>Look</b> turns the cube to where the oil needs a piece. A piece here turns, so a hand is only how many bends, straights and crossings: the route decides their turns. The menu's View shows the cube cut open flat, with matching letters where its edges meet.</p>
    <h4>Dodecahedron</h4>
    <p>The same on twelve pentagons: five sides to a tile, so there is no straight and no crossing. A <b>tight bend</b> joins two sides next to each other, an <b>easy bend</b> skips one.</p>`;
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
  if (b.setView) part(body, "settings").append(choice("View", b.viewOptions, b.view, v => { $("menuDlg").close(); b.setView(v); }), action("Clear the board", b.clear, "link"));
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

// the board and bests of the modes Pipes had before the puzzle (a queue, a clock, a shaft) are no more
if (!IN_FRAME) for (const k of ["pipes:plan", "pipes:flat", "pipes:deep", "pipes:daily", "pipes:run", "pipes:acts"]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
{
  const best = read(KEY.best, null);
  if (!IN_FRAME && best && typeof best.score !== "number") try { localStorage.removeItem(KEY.best); } catch { /* private mode */ }
}
setMode(prefs.mode);
