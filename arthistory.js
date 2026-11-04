// Art history: a course from the pyramids to the end of 1929 on the suite's course sheet (course.js), in 27 lessons, each with pictures, a
// credit line under each, and exercises that can be done by name when a picture won't load. This page is the door to it: the plate, where
// you have got to, and the way in. The words are arthistory-text.js, the works arthistory-works.js, the steps arthistory-lessons.js, the
// pictures arthistory-stage.js (fetched from Wikipedia by pics.js as they're shown).
import { createCourse } from "./course.js";
import { COURSE, LESSON_IDS, fillReview } from "./arthistory-lessons.js";
import { artStage } from "./arthistory-stage.js";
import { plate } from "./arthistory-plate.js";
import { loadPile, savePile, record, dueIds } from "./arthistory-pile.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "arthistory:lessons";            // { done, of }: what the games screen's tile shows
const total = LESSON_IDS.length;

bindSwitcher($("appsBtn"), "arthistory");
document.querySelector(".ah-mark").innerHTML = APPS.find(a => a.id === "arthistory")?.logo || "";
$("plate").innerHTML = plate();
document.querySelector(".ah-intro").textContent = `From the pyramids to the end of 1929: ${total} short lessons with pictures to look at, and questions that bring back what you missed.`;

let pile = loadPile(), inReview = false;
const refill = () => fillReview(dueIds(pile));
refill();

const course = createCourse({
  id: "arthistory", course: COURSE, cls: "ahc", inFrame: IN_FRAME,
  stage: artStage({
    onResult(step, ok) {
      if (IN_FRAME) return;
      inReview = !!step.review;
      pile = loadPile();                       // another device may have added to it
      record(pile, step.id, ok);
      savePile(pile);
      if (!inReview) refill();                 // never reshuffle the review lesson while it is being played
      refresh();
    },
  }),
});
const sheet = document.querySelector("dialog.ln-sheet");

const readDone = () => { try { return JSON.parse(localStorage.getItem("arthistory:course") || "{}").done || {}; } catch { return {}; } };
/** Lessons done (the review is not a lesson of the course) and what's next. */
function progress() {
  const done = readDone(), n = LESSON_IDS.filter(id => done[id]).length;
  return { done: n, next: LESSON_IDS.find(id => !done[id]) || null };
}
const titleOf = id => COURSE.chapters.flatMap(c => c.lessons).find(l => l.id === id)?.title || "";

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
  try { at = JSON.parse(localStorage.getItem("arthistory:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id && at.id !== "review" ? at.id : p.next);
}
function review() { pile = loadPile(); refill(); course.open("review"); }
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => course.open());
$("reviewBtn").addEventListener("click", review);
sheet.addEventListener("close", () => { inReview = false; pile = loadPile(); refill(); refresh(); });
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
    try { localStorage.removeItem("arthistory:course"); localStorage.removeItem("arthistory:pile"); localStorage.removeItem(COUNT); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__arthistory = { course, refresh };
