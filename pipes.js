// Pipes: a fitting puzzle. A hand of pieces must all fit one route for the oil from the wellhead to the terminal, with
// stars. The menu's Game chooses the board: the flat one (pipes-puzzle-ui.js). This file is the page round it: the menu,
// the rules, the old saves cleared, and the games screen's Random round.
import { createPuzzle } from "./pipes-puzzle-ui.js";
import { STAR_LIFTS } from "./pipes-puzzle.js";
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
const MODES = [["flat", "Flat"]];
let prefs = { mode: "flat", ...read(KEY.prefs, {}) };
let mode = "flat";
const flat = createPuzzle({ $, read, write, toast, frame: IN_FRAME, openMenu: () => openMenu(), onSolved: () => { noteBest(); roundOver("pipes"); }, reduced });
const boards = { flat };
const cur = () => boards[mode];

/** The games screen shows `pipes:best`: here, the stars won across the boards. */
function noteBest() {
  if (IN_FRAME) return;
  write(KEY.best, { score: Object.values(boards).reduce((n, b) => n + b.totalStars(), 0) });
}
function setMode(m) {
  mode = boards[m] ? m : "flat";
  prefs.mode = mode;
  if (!IN_FRAME) write(KEY.prefs, prefs);
  cur().show();
}

// ---------- the rules ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Lay pipe for the oil. Every level is a board and a hand of pieces, and every piece must go down: the oil leaves the wellhead, runs through all of them, and into the terminal. No clock, no queue. The menu's Game chooses the board.</p>
    <ul>
      <li><b>Tap a piece in the hand</b>, then a square, to lay it. <b>Tap a piece you've laid</b> to take it back up (it's in your hand again: tap another square). The dashed line is the oil's way from the wellhead, and back from the terminal; the ringed square is where it needs a piece next, and a red cross is where it's stopped.</li>
      <li><b>Rock</b> can't be built on. <b>Old pipe</b> (dark, studded) is already in the ground, and the oil must run through it. <b>Stakes</b> are numbered: the oil passes them in order. A <b>crossing</b> carries the oil across itself, and the oil may pass it twice.</li>
      <li><b>Undo</b> is free, as many times as you like. <b>Hint</b> shows where the next piece goes, or which of yours is in the way; with one, the level can earn only the one star.</li>
      <li><b>Stars</b>: one for solving a level, two for solving it without a hint, three for that and hardly any piece taken back up (${STAR_LIFTS} at most, and one more for every six pieces in the hand).</li>
    </ul>
    <h4>Flat</h4>
    <p>Pieces are never turned: a bend comes as it is, so the bends in your hand decide which ways the route can turn.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;
}

// ---------- the menu ----------
function openMenu() {
  const body = $("menuBody"), b = cur();
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Menu";
  const game = choice("Game", MODES, mode, v => { $("menuDlg").close(); setMode(v); });
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
