// Gears (Pipes until 4 November 2026: the id, files and saved keys keep that name): a fitting puzzle. A hand of pieces, whole
// gears, must all fit one train from the mainspring to the dial, with stars. This file is the page round it: the menu, the rules,
// the old saves cleared, and the games screen's Random round. The board is pipes-train-ui.js. The 3D map (Cube) is parked:
// MAP_ON below turns it back on (its files, pipes-map-*.js and the old-model engine pipes-puzzle*.js, are kept whole, and its
// saved keys pipes:map and pipes:mapstars are left alone).
import { createPuzzle } from "./pipes-train-ui.js";
import { STAR_LIFTS } from "./pipes-train.js";
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
/** 4 November 2026, Korbi: "Let's park the 3d mode for now, but trust it's coming later and in detail." Set true to bring the Cube
 *  back (it plays the old model, pipes-puzzle-ui.js with the map levels; it needs redoing for whole gears first). */
const MAP_ON = false;
const MODES = [["flat", "Flat (square)"], ["map", "Cube (3D map)"]].filter(([id]) => id === "flat" || MAP_ON);
let prefs = { mode: "flat", ...read(KEY.prefs, {}) };
let mode = "flat";
const deps = { $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { noteBest(); roundOver("pipes"); }, reduced,
  sound: () => !IN_FRAME && prefs.sound !== false };
const flat = createPuzzle(deps);
const boards = { flat };
if (MAP_ON) {
  const [{ createPuzzle: createMap }, { LEVELS, CHAPTERS }] = await Promise.all([import("./pipes-puzzle-ui.js"), import("./pipes-map-levels.js")]);
  boards.map = createMap(deps, { map: true, levels: LEVELS, chapters: CHAPTERS, run: "pipes:map", stars: "pipes:mapstars" });
}
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
    <p>Wind a watch's train. Every level is a plate and a hand of gears, and every piece must go down: power leaves the <b>mainspring</b> (the barrel with its coil), runs through all of them, gear to gear, and turns the <b>dial</b> at the end the way it is asked. No clock, no queue.</p>
    <ul>
      <li><b>Tap a piece in the hand</b>, then a square, to lay it. <b>Tap a piece you've laid</b> to take it back up (it's in your hand again). Pieces never turn.</li>
      <li>A <b>single gear</b> fills its square and meshes with whatever gear is beside it, on any side. A <b>duo</b> is two small gears meshed inside one square, a <b>trio</b> three: only the two at the ends reach out, one to each of two sides, so they pass the power straight through or round a corner and mesh with nothing else. Every gear is always drawn whole.</li>
      <li><b>Meshed gears turn opposite ways.</b> The mainspring turns clockwise, and a small arrow on each gear it drives says which way that gear turns. A single and a trio pass the turn on as it is; a <b>duo</b> flips it, because it has an even number of gears. Count them.</li>
      <li>A <b>jam</b>: two gears that mesh but would have to turn the <b>same</b> way, an odd loop of meshes. Gears beside each other mesh whether you meant them to or not, so a train that touches itself beside a duo jams. The gears flash red and stop, and the level can't be solved while any jam stands.</li>
      <li>A <b>load</b> (a ring with an arrow) takes a single gear only, and it must turn the way shown. The dial must turn the way its arrow shows.</li>
      <li>A <b>pillar</b> can't be built on. A <b>fixed gear</b> (dark, with a copper mark) is already pinned to the plate, and the train must run through it.</li>
      <li><b>Undo</b> is free, as many times as you like. <b>Hint</b> shows where the next piece goes, or which of yours is in the way; with one, the level can earn only the one star. Solved, the whole train turns, with a soft tick (the menu's Sound).</li>
      <li><b>Stars</b>: one for solving a level, two for solving it without a hint, three for that and hardly any piece taken back up (${STAR_LIFTS} at most, and one more for every six pieces in the hand).</li>
    </ul>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody"), b = cur();
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Menu";
  const game = MODES.length > 1 ? choice("Board", MODES, mode, v => { $("menuDlg").close(); setMode(v); }) : "";
  const solved = b.run?.solved;
  part(body, "play").append(action(solved ? "Next level" : "Level again", () => (solved ? b.next() : b.again()), "primary"), action("The rules", showRules, "link"));
  part(body, "content").append(game, b.levelList(id => { $("menuDlg").close(); b.go(id); }));
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

// the board and bests of the modes Pipes had before the puzzle (a queue, a clock, a shaft), of the face-of-a-solid cube and dodecahedron, and of the pipe-model flat levels (pipes:puzzle, pipes:stars: the 4 November 2026 gears replaced all forty) are no more; the 3D map's pipes:map and pipes:mapstars stay
// the old flat stars counted in the best the games screen shows; it is made again from the new ones at the next solve
if (!IN_FRAME && read("pipes:stars", null)) { try { localStorage.removeItem(KEY.best); } catch { /* private mode */ } }
if (!IN_FRAME) for (const k of ["pipes:plan", "pipes:flat", "pipes:deep", "pipes:daily", "pipes:run", "pipes:acts", "pipes:cube", "pipes:cubestars", "pipes:dodeca", "pipes:dodecastars", "pipes:puzzle", "pipes:stars"]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
{
  const best = read(KEY.best, null);
  if (!IN_FRAME && best && typeof best.score !== "number") try { localStorage.removeItem(KEY.best); } catch { /* private mode */ }
}
setMode(prefs.mode);
