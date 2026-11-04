// Firmament: a narrative course in how we came to know the universe (people, arguments, instruments and the evidence that settled each question),
// on the suite's course sheet (course.js). This page is the door to it: the plate, where you have got to, and the way in. The words and
// questions are firmament-c1.js …, built into steps by firmament-lessons.js; the stage (a diagram drawn in the app for every step) is
// firmament-stage.js with firmament-figs.js.
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE } from "./firmament-lessons.js";
import { firmamentStage } from "./firmament-stage.js";
import { plate } from "./firmament-plate.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "firmament:lessons";               // { done, of }: what the games screen's tile shows
const total = lessonsOf(COURSE).length;

bindSwitcher($("appsBtn"), "firmament");
document.querySelector(".fm-mark").innerHTML = APPS.find(a => a.id === "firmament")?.logo || "";
$("plate").innerHTML = plate();
document.querySelector(".fm-intro").textContent = `How we came to know the universe, from Babylon to the Big Bang, told through the people, the arguments and the evidence that settled each one: ${total} short lessons, each with a diagram and questions.`;

const course = createCourse({ id: "firmament", course: COURSE, cls: "firmamentc", inFrame: IN_FRAME, stage: firmamentStage() });

/** Where the reader has got to, on the page and (for the tile) in a key of its own. */
function refresh() {
  const p = progressOf("firmament", COURSE);
  $("status").textContent = p.done === total ? "Every lesson done" : p.done ? `${p.done} of ${total} lessons` : `${total} lessons`;
  $("meter").style.width = `${Math.round(p.done / total * 100)}%`;
  $("goBtn").textContent = p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start";
  if (!IN_FRAME) try { if (p.done) localStorage.setItem(COUNT, JSON.stringify({ done: p.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
function resume() {
  const p = progressOf("firmament", COURSE);
  let at = null;
  try { at = JSON.parse(localStorage.getItem("firmament:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id || p.next.lesson.id);
}
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => course.open());
document.querySelector("dialog.ln-sheet").addEventListener("close", refresh);
refresh();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const p = progressOf("firmament", COURSE), play = part(body, "play");
  play.append(action(p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start the course", resume, "primary"));
  play.append(action("All the lessons", () => course.open()));
  // the two games that teach the same sky by playing it: linked, not repeated here
  const more = part(body, "content");
  more.append(action("Landfall: find your way by the stars", () => { location.href = "./landfall.html"; }, "link"));
  more.append(action("Orrery: the planets in motion", () => { location.href = "./orrery.html"; }, "link"));
  part(body, "about").append(line(p.done ? `${p.done} of ${total} lessons done.` : `${total} lessons, in order.`));
  if (p.done && !IN_FRAME) part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done?"))) return;
    try { localStorage.removeItem("firmament:course"); localStorage.removeItem(COUNT); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__firmament = { course, refresh };
