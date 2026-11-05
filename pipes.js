// Gears (Pipes until 4 November 2026: the id, files and saved keys keep that name): a fitting puzzle. A hand of pieces, whole
// gears, must all fit one train from the mainspring to the dial, with stars. This file is the page round it: the menu, the rules,
// the old saves cleared, and the games screen's Random round. The board is pipes-train-ui.js. The 3D map (Cube) is parked:
// MAP_ON below turns it back on (its files, pipes-map-*.js and the old-model engine pipes-puzzle*.js, are kept whole, and its
// saved keys pipes:map and pipes:mapstars are left alone).
import { createPuzzle } from "./pipes-gear-run.js";
import { STAR_LIFTS } from "./pipes-gear-engine.js";
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
    <p>Wind a watch's train. Every level is a plate and a hand of gears, and every piece must go down: power leaves a <b>mainspring</b> (the barrel with its coil, turning clockwise), runs through the pieces, wheel to wheel, and must reach its <b>dial</b> or <b>complication</b> turning the way and at the speed it wants.</p>
    <ul>
      <li><b>Tap a piece in the hand</b> to hold it; <b>tap it again to turn it</b>; tap a square to lay it (it takes the turn that suits the square unless you chose one). Or <b>drag it onto the board</b>: the ghost rides above your finger and shows a clash in red. Tap a laid piece to turn it; <b>press and hold</b> (or switch Lift on) to take it back up. The first forty levels never turn.</li>
      <li>A <b>single</b> wheel fills its square and meshes on any side. A <b>duo</b> is two wheels meshed inside one square, a <b>trio</b> three; only the two ends reach out. A <b>stack</b> is a wheel and a pinion on one arbor, on two layers: it changes the speed. A <b>riser</b> carries the turn from one layer to another.</li>
      <li><b>Meshed wheels turn opposite ways</b>; a small arrow on each wheel says which way. Along a chain of meshes every wheel has the same <b>tooth rate</b> (teeth times speed); only a stack changes it. A chip on the dial shows the speed it has and the speed it wants, as a fraction of the mainspring's.</li>
      <li><b>Tooth sizes</b> (modules 4, 5, 6: rose, gilt, steel) never mesh. Two sizes on one layer <b>clash</b>. Wheels on <b>different layers</b> pass over each other. Two trains must not mesh at all, even at one size: leave a gap.</li>
      <li>A <b>jam</b>: a loop of meshes that cannot turn, because it comes round to a wheel at another direction (an odd loop) or another speed (the tooth ratios round it do not multiply to 1: a <b>bind</b>). Jammed wheels flash oxblood and stop.</li>
      <li>A <b>click</b> (a ring with an arrow) takes a single wheel, which must turn that way. A <b>pillar</b> can't be built on; a <b>bridge</b> lets only low pieces under it (its pips are the layers that fit). A <b>pinned piece</b> (dark, with a copper mark) is fixed, and the train must run through it.</li>
      <li><b>Undo</b> is free. <b>Hint</b> shows the next piece, turned as it goes; with one, the level can earn only one star. <b>Look</b> shows every wheel's teeth and lets you isolate a layer. <b>Stars</b>: one for solving, two without a hint, three for that and hardly any piece taken back up (${STAR_LIFTS} at most, and one more for every six pieces in the hand; turning a piece you've laid counts).</li>
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
  ["pzLift", b => b.toggleLift?.()], ["pzLook", b => b.look()]]) $(id).addEventListener("click", () => fn(cur()));
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
