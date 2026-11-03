// Navigation: a course in celestial navigation and the sea, eighteen lessons on the suite's course sheet (course.js), each with an
// instrument to use (navigation-stage.js). This page is the door to it: the plate, where you have got to, and the way in. The lessons
// are navigation-lessons.js, the arithmetic navigation-math.js, the sky Landfall's (landfall-sky.js, landfall-stars.js).
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE } from "./navigation-lessons.js";
import { navStage } from "./navigation-stage.js";
import { plate } from "./navigation-plate.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "navigation:lessons";            // { done, of }: what the games screen's tile shows
const total = lessonsOf(COURSE).length;

bindSwitcher($("appsBtn"), "navigation");
document.querySelector(".nv-mark").innerHTML = APPS.find(a => a.id === "navigation")?.logo || "";
$("plate").innerHTML = plate();
document.querySelector(".nv-intro").textContent = `The astrolabe, the sextant, the chronometer and the moon: how a ship found itself on an empty sea with nothing but the sky, a clock and arithmetic. ${total} short lessons, each with an instrument to use.`;

const course = createCourse({ id: "navigation", course: COURSE, cls: "navc", inFrame: IN_FRAME, stage: navStage() });
const sheet = document.querySelector("dialog.ln-sheet");

/** Where the reader has got to, on the page and (for the tile) in a key of its own. */
function refresh() {
  const p = progressOf("navigation", COURSE);
  $("status").textContent = p.done === total ? "Every lesson done" : p.done ? `${p.done} of ${total} lessons` : `${total} lessons`;
  $("meter").style.width = `${Math.round(p.done / total * 100)}%`;
  $("goBtn").textContent = p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start";
  if (!IN_FRAME) try { if (p.done) localStorage.setItem(COUNT, JSON.stringify({ done: p.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
function resume() {
  const p = progressOf("navigation", COURSE);
  let at = null;
  try { at = JSON.parse(localStorage.getItem("navigation:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id || p.next.lesson.id);
}
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => course.open());
sheet.addEventListener("close", refresh);
refresh();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const p = progressOf("navigation", COURSE), play = part(body, "play");
  play.append(action(p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start the course", resume, "primary"));
  play.append(action("All the lessons", () => course.open()));
  part(body, "about").append(line(p.done ? `${p.done} of ${total} lessons done.` : `${total} lessons, in order.`));
  if (p.done && !IN_FRAME) part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done?"))) return;
    try { localStorage.removeItem("navigation:course"); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__navigation = { course, refresh };
