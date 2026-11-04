// Wine: a course on the suite's course sheet (course.js), in eight chapters from the grapes to the market, each ending in a test. This page
// is the door to it: the plate, where you have got to, and the way in. The words and questions are wine-basics.js, wine-regions.js,
// wine-labels.js and wine-service.js (built into steps by wine-lessons.js); the stage is wine-stage.js.
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE } from "./wine-lessons.js";
import { wineStage } from "./wine-stage.js";
import { plate } from "./wine-plate.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "wine:lessons";               // { done, of }: what the games screen's tile shows
const total = lessonsOf(COURSE).length;

bindSwitcher($("appsBtn"), "wine");
document.querySelector(".wn-mark").innerHTML = APPS.find(a => a.id === "wine")?.logo || "";
$("plate").innerHTML = plate();
document.querySelector(".wn-intro").textContent = `Grapes, making, regions, labels, tasting, service, bubbles and the market: ${total} short lessons, each followed by questions, and a test at the end of every chapter.`;

const course = createCourse({ id: "wine", course: COURSE, cls: "winec", inFrame: IN_FRAME, stage: wineStage() });

/** Where the reader has got to, on the page and (for the tile) in a key of its own. */
function refresh() {
  const p = progressOf("wine", COURSE);
  $("status").textContent = p.done === total ? "Every lesson done" : p.done ? `${p.done} of ${total} lessons` : `${total} lessons`;
  $("meter").style.width = `${Math.round(p.done / total * 100)}%`;
  $("goBtn").textContent = p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start";
  if (!IN_FRAME) try { if (p.done) localStorage.setItem(COUNT, JSON.stringify({ done: p.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
function resume() {
  const p = progressOf("wine", COURSE);
  let at = null;
  try { at = JSON.parse(localStorage.getItem("wine:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id || p.next.lesson.id);
}
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => course.open());
document.querySelector("dialog.ln-sheet").addEventListener("close", refresh);
refresh();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const p = progressOf("wine", COURSE), play = part(body, "play");
  play.append(action(p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start the course", resume, "primary"));
  play.append(action("All the lessons", () => course.open()));
  part(body, "about").append(line(p.done ? `${p.done} of ${total} lessons done.` : `${total} lessons, in order.`));
  if (p.done && !IN_FRAME) part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done?"))) return;
    try { localStorage.removeItem("wine:course"); localStorage.removeItem(COUNT); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__wine = { course, refresh };
