// Gears (Pipes until 4 November 2026: the id, files and saved keys keep that name): a fitting puzzle. A hand of gears must all fit one train from the mainspring to the load, with
// stars. The menu's Board chooses where it is played: flat, or the 3D map (a stack of floors you turn with a finger); both
// are pipes-puzzle-ui.js with different levels. This file is the page round it: the menu, the rules, the old saves
// cleared, and the games screen's Random round.
import { createPuzzle } from "./pipes-puzzle-ui.js";
import { STAR_LIFTS } from "./pipes-puzzle.js";
import { LEVELS as MAP_LEVELS, CHAPTERS as MAP_CHAPTERS } from "./pipes-map-levels.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, toggle, action, line, onPause } from "./menu.js";
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
const deps = { $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { noteBest(); roundOver("pipes"); }, reduced,
  sound: () => !IN_FRAME && prefs.sound !== false };
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
    <p>Wind a watch's train. Every level is a plate and a hand of gears, and every gear must go down: power leaves the <b>mainspring</b> (the barrel with its coil), runs through all of them, edge to edge, and turns the <b>load</b> at the end (a small watch dial) the way it is asked. No clock, no queue. The menu's Board chooses where it is played.</p>
    <ul>
      <li><b>Tap a piece in the hand</b>, then a square, to lay it. <b>Tap a piece you've laid</b> to take it back up (it's in your hand again). A gear's teeth show only on the sides it <b>meshes</b> with: a neighbour's teeth must face them. The dashed line is the train's way from the mainspring, and back from the load; the ringed square is where it needs a gear next, and a red cross is where it's stopped.</li>
      <li><b>Meshed gears turn opposite ways.</b> A small arrow on each gear the train has reached says which way it turns. Gears meshed round a loop must agree: a closed loop that would need a gear to turn both ways <b>jams</b>, and the cross says so.</li>
      <li><b>Loads</b> are numbered, with an arrow: the gear laid there must turn that way (clockwise or counter-clockwise), and the train reaches them in order. The last load, the dial, must turn the way its arrow shows.</li>
      <li>A <b>reduction</b> is two small gears meshed in one square: the train goes in at one and out at the other, which turns the other way. It is the one piece that changes who turns which way, so count the gears before each load.</li>
      <li><b>Pillars</b> can't be built on. A <b>fixed gear</b> (dark, with a stud) is already pinned to the plate, and the train must run through it. A <b>crossover</b> has two gears on separate levels: one piece, two trains, and the power may pass it twice.</li>
      <li><b>Undo</b> is free, as many times as you like. <b>Hint</b> shows where the next piece goes, or which of yours is in the way; with one, the level can earn only the one star. Solved, the whole train turns, with a soft tick (the menu's Sound).</li>
      <li><b>Stars</b>: one for solving a level, two for solving it without a hint, three for that and hardly any piece taken back up (${STAR_LIFTS} at most, and one more for every six pieces in the hand).</li>
    </ul>
    <h4>Flat</h4>
    <p>Pieces are never turned: a gear comes as it is, so the pieces in your hand decide which ways the train can turn.</p>
    <h4>Cube (3D map)</h4>
    <p>The same in a cube of squares: a stack of <b>floors</b>, drawn lifted one above the next. A piece can also open <b>up</b> or <b>down</b> (a ring with an arrow): an <b>arbor</b>, a shaft that joins the gear to the gear above or below it. An arbor does not mesh: both gears on it turn the <b>same</b> way. An arbor piece on its own passes the power straight through a floor. <b>Tap a floor</b> (or its number on the left) to bring it forward and play on it; the floors above it fade so you can see through. <b>Drag</b> to turn the stack, <b>double-tap</b> empty space or tap the ⟲ to put it back, and <b>Look</b> brings forward the floor where the train needs its next gear.</p>`;
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
  part(body, "settings").append(toggle("Sound", prefs.sound !== false, on => { prefs.sound = on; if (!IN_FRAME) write(KEY.prefs, prefs); }));
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
