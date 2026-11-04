// Maths: a course from GCSE to first-year university (docs/maths.md). The page is a landing behind the course's sheet
// (course.js): where you are, the chapters with how far through each you are, and the way back in. The lessons are
// maths-course.js, drawn by maths-stage.js. What is kept: course.js's maths:course, and maths:lessons ({ done, of }) for the tile.
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE, LEVELS } from "./maths-course.js";
import { mathsStage } from "./maths-stage.js";
import { bindSwitcher, APPS } from "./apps.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";
import { sure } from "./sure.js";

const $ = id => document.getElementById(id);
const COUNT = "maths:lessons";
const total = lessonsOf(COURSE).length;
bindSwitcher($("appsBtn"), "maths");
document.querySelector(".ma-mark").innerHTML = APPS.find(a => a.id === "maths")?.logo || "";

const course = createCourse({ id: "maths", course: COURSE, stage: mathsStage(), cls: "ma", inFrame: IN_FRAME });
const sheet = document.querySelector("dialog.ln-sheet");

const doneIds = () => { try { return JSON.parse(localStorage.getItem("maths:course") || "{}").done || {}; } catch { return {}; } };

/** The landing: lessons done, the chapters with their progress, and the button that goes back in. */
function home() {
  const pr = progressOf("maths", COURSE), done = doneIds();
  $("intro").textContent = `From GCSE through IB Higher Level to the first year at university: ${total} short lessons in ${COURSE.chapters.length} chapters, each with a worked example, something to move or type, and questions the page checks from the arithmetic.`;
  const chaptersDone = COURSE.chapters.filter(c => c.lessons.every(l => done[l.id])).length;
  $("stats").innerHTML = [[`${pr.done} of ${pr.of}`, "lessons"], [`${chaptersDone} of ${COURSE.chapters.length}`, "chapters"], [pr.next ? pr.next.chapter.title : "All done", "next up"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  $("goBtn").textContent = !pr.next ? "Go over the lessons" : pr.done ? `Continue: ${pr.next.lesson.title}` : "Start the course";
  $("chapters").innerHTML = COURSE.chapters.map((c, i) => {
    const n = c.lessons.filter(l => done[l.id]).length;
    return `<div class="ma-ch"><span class="ma-no">${i + 1}</span><span class="ma-name">${c.title}<small>${LEVELS[c.id] || ""}</small></span><span class="ma-bar" aria-hidden="true"><i style="width:${Math.round(100 * n / c.lessons.length)}%"></i></span><span class="ma-n">${n}/${c.lessons.length}</span></div>`;
  }).join("");
  if (!IN_FRAME) try { if (pr.done) localStorage.setItem(COUNT, JSON.stringify({ done: pr.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
$("goBtn").addEventListener("click", () => course.open());
sheet.addEventListener("close", home);
home();

// the menu: the way into the course, and starting over
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  part(body, "play").append(action("Open the lessons", () => course.open()));
  part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done?", { yes: "Forget them" }))) return;
    // emptied, not removed: a removed key would come back from another device (suite.js syncs keys, newest wins)
    if (!IN_FRAME) try { localStorage.setItem("maths:course", JSON.stringify({ done: {}, at: null })); } catch { /* private mode */ }
    home();
  }, "link"));
  part(body, "about").append(line(`${total} lessons, GCSE to first-year university. Answers are checked from the working, not from a stored key.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__maths = { course, home };
if (location.hash !== "#home") course.open();
