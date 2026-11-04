// Chess School: a course in chess from the board to a first game, lessons on the suite's course sheet (course.js), each with a board to
// move on (chess-stage.js, Gambit's board and rules). This page is the door: the plate, where you have got to, and the way in. The lessons
// are chess-lessons.js (and the files it gathers), what a step asks and how it is judged chess-run.js. The last step plays a game in
// Chess (gambit.html) against its weakest level, from the position the lesson reached.
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE } from "./chess-lessons.js";
import { chessStage } from "./chess-stage.js";
import { plate } from "./chess-plate.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "chess:lessons";                                 // { done, of }: what the games screen's tile shows
const total = lessonsOf(COURSE).length;

bindSwitcher($("appsBtn"), "chess");
document.querySelector(".cs-mark").innerHTML = APPS.find(a => a.id === "chess")?.logo || "";
$("plate").innerHTML = plate();

const stage = chessStage();
// The game at the end of the course: Chess opened on the moves played so far, at the level the step names (gambit.js reads both).
const course = createCourse({ id: "chess", course: COURSE, cls: "chsc", inFrame: IN_FRAME, stage,
  onPlay: step => { location.href = `gambit.html?moves=${step.moves.join(",")}&level=${step.level}`; } });
const sheet = document.querySelector("dialog.ln-sheet");
sheet.addEventListener("close", () => stage.stop());

/** Where the reader has got to, on the page and (for the tile) in a key of its own. */
function refresh() {
  const p = progressOf("chess", COURSE);
  $("status").textContent = p.done === total ? "Every lesson done" : p.done ? `${p.done} of ${total} lessons` : `${total} lessons`;
  $("meter").style.width = `${Math.round(p.done / total * 100)}%`;
  $("goBtn").textContent = p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start";
  if (!IN_FRAME) try { if (p.done) localStorage.setItem(COUNT, JSON.stringify({ done: p.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
function resume() {
  const p = progressOf("chess", COURSE);
  let at = null;
  try { at = JSON.parse(localStorage.getItem("chess:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id || p.next.lesson.id);
}
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => course.open());
sheet.addEventListener("close", refresh);
refresh();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const p = progressOf("chess", COURSE), play = part(body, "play");
  play.append(action(p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start the course", resume, "primary"));
  play.append(action("All the lessons", () => course.open()));
  part(body, "about").append(line(p.done ? `${p.done} of ${total} lessons done.` : `${total} lessons, in order.`));
  if (p.done && !IN_FRAME) part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done?"))) return;
    try { localStorage.removeItem("chess:course"); localStorage.removeItem(COUNT); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__chess = { course, refresh, stage };
