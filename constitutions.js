// Constitutions and institutions: a course on the suite's course sheet (course.js), in 64 lessons: what a constitution does, how powers are separated and checked, how they
// are divided, the old and non-Western orders, and the United States and the European Union in detail (who starts an act, who can stop it, how long it takes). This page is the
// door to it: the plate, where you have got to, and the way in. The words and questions are constitutions-c1.js to constitutions-c6.js (built into steps by
// constitutions-lessons.js); the stage (terms, sources, ordering) is constitutions-stage.js.
import { createCourse } from "./course.js";
import { COURSE, LESSON_IDS, LESSONS, fillReview } from "./constitutions-lessons.js";
import { constStage } from "./constitutions-stage.js";
import { plate } from "./constitutions-plate.js";
import { loadPile, savePile, record, dueIds } from "./constitutions-pile.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "constitutions:lessons";            // { done, of }: what the games screen's tile shows
const total = LESSON_IDS.length;

bindSwitcher($("appsBtn"), "constitutions");
document.querySelector(".cn-mark").innerHTML = APPS.find(a => a.id === "constitutions")?.logo || "";
$("plate").innerHTML = plate();
document.querySelector(".cn-intro").textContent = `Constitutions and institutions, from Athens to the EU's directives: ${total} short lessons, with questions and a review of what you missed.`;

let pile = loadPile();
const refill = () => fillReview(dueIds(pile));
refill();

const course = createCourse({
  id: "constitutions", course: COURSE, cls: "cnc", inFrame: IN_FRAME,
  stage: constStage({
    onResult(step, ok) {
      if (IN_FRAME) return;
      const inReview = !!step.review;
      pile = loadPile();                       // another device may have added to it
      record(pile, step.id, ok);
      savePile(pile);
      if (!inReview) refill();                 // never reshuffle the review lesson while it is being played
      refresh();
    },
  }),
});
const sheet = document.querySelector("dialog.ln-sheet");

const readDone = () => { try { return JSON.parse(localStorage.getItem("constitutions:course") || "{}").done || {}; } catch { return {}; } };
/** Lessons done (the review is not a lesson of the course) and what's next. */
function progress() {
  const done = readDone(), n = LESSON_IDS.filter(id => done[id]).length;
  return { done: n, next: LESSON_IDS.find(id => !done[id]) || null };
}
const titleOf = id => LESSONS.find(l => l.id === id)?.title || "";

function refresh() {
  const p = progress(), due = dueIds(pile).length;
  $("status").textContent = p.done === total ? "Every lesson done" : p.done ? `${p.done} of ${total} lessons` : `${total} lessons`;
  $("meter").style.width = `${Math.round(p.done / total * 100)}%`;
  $("goBtn").textContent = p.done === total ? "Go over a lesson" : p.done ? `Continue: ${titleOf(p.next)}` : "Start";
  $("reviewBtn").hidden = !due;
  $("reviewBtn").textContent = `Review: ${due} to go over`;
  if (!IN_FRAME) try { if (p.done) localStorage.setItem(COUNT, JSON.stringify({ done: p.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
function resume() {
  const p = progress();
  let at = null;
  try { at = JSON.parse(localStorage.getItem("constitutions:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id && at.id !== "review" ? at.id : p.next);
}
function review() { pile = loadPile(); refill(); course.open("review"); }
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => course.open());
$("reviewBtn").addEventListener("click", review);
sheet.addEventListener("close", () => { pile = loadPile(); refill(); refresh(); });
refresh();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const p = progress(), due = dueIds(pile).length, play = part(body, "play");
  play.append(action(p.done === total ? "Go over a lesson" : p.done ? `Continue: ${titleOf(p.next)}` : "Start the course", resume, "primary"));
  play.append(action("All the lessons", () => course.open()));
  if (due) play.append(action(`Review: ${due} to go over`, review));
  part(body, "about").append(line(p.done ? `${p.done} of ${total} lessons done.` : `${total} lessons, in order.`));
  if ((p.done || due) && !IN_FRAME) part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done, and your review?"))) return;
    try { localStorage.removeItem("constitutions:course"); localStorage.removeItem("constitutions:pile"); localStorage.removeItem(COUNT); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__constitutions = { course, refresh };
