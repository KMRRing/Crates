// History of trade: a course on the suite's course sheet (course.js), in fourteen chapters from the first obsidian blades to today's straits,
// global rather than European, with the colonial chapters as full as the rest. This page is the door to it: the plate, where you have got
// to, and the way in. The words and questions are trade-c1.js to trade-c5.js (built into steps by trade-lessons.js); the stage (maps,
// pictures, cards) is trade-stage.js.
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE } from "./trade-lessons.js";
import { tradeStage } from "./trade-stage.js";
import { plate } from "./trade-plate.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "trade:lessons";               // { done, of }: what the games screen's tile shows
const total = lessonsOf(COURSE).length;
if (!IN_FRAME) try { localStorage.removeItem("trade:pics"); } catch { /* private mode */ }   // the Pictures toggle is gone: pictures follow the suite (Settings, Keep pictures offline)

bindSwitcher($("appsBtn"), "trade");
document.querySelector(".td-mark").innerHTML = APPS.find(a => a.id === "trade")?.logo || "";
$("plate").innerHTML = plate();
document.querySelector(".td-intro").textContent = `From the first obsidian blades to today's straits, across Africa, Asia, the Americas and Europe: ${total} short lessons on maps, with questions, and what each cost.`;

const course = createCourse({ id: "trade", course: COURSE, cls: "tradec", inFrame: IN_FRAME, stage: tradeStage() });

/** Where the reader has got to, on the page and (for the tile) in a key of its own. */
function refresh() {
  const p = progressOf("trade", COURSE);
  $("status").textContent = p.done === total ? "Every lesson done" : p.done ? `${p.done} of ${total} lessons` : `${total} lessons`;
  $("meter").style.width = `${Math.round(p.done / total * 100)}%`;
  $("goBtn").textContent = p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start";
  if (!IN_FRAME) try { if (p.done) localStorage.setItem(COUNT, JSON.stringify({ done: p.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
function resume() {
  const p = progressOf("trade", COURSE);
  let at = null;
  try { at = JSON.parse(localStorage.getItem("trade:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id || p.next.lesson.id);
}
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => course.open());
document.querySelector("dialog.ln-sheet").addEventListener("close", refresh);
refresh();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const p = progressOf("trade", COURSE), play = part(body, "play");
  play.append(action(p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start the course", resume, "primary"));
  play.append(action("All the lessons", () => course.open()));
  if (!IN_FRAME) {
    const settings = part(body, "settings");
    if (p.done) settings.append(action("Start the course over", async () => {
      if (!(await sure("Forget which lessons you have done?"))) return;
      try { localStorage.removeItem("trade:course"); localStorage.removeItem(COUNT); } catch { /* private mode */ }
      location.reload();
    }, "link"));
  }
  part(body, "about").append(line(p.done ? `${p.done} of ${total} lessons done. Maps are drawn in the app; each chapter ends with its reading list.` : `${total} lessons, in order. Maps are drawn in the app; each chapter ends with its reading list.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__trade = { course, refresh };
