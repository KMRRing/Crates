// Statecraft: a course on the suite's course sheet (course.js) in ten chapters, from the tools of statecraft and diplomacy through the thinkers
// of strategy, war, deterrence and the new domains to thirteen case studies of actors inside constraints. This page is the door to it: the plate,
// where you have got to, and the way in. The words and questions are statecraft-c1.js to statecraft-c5.js (built into steps by
// statecraft-lessons.js); the stage (maps and cards from History of trade's, a quotation, ordering, matching) is statecraft-stage.js; what you
// miss comes back in the review (statecraft-pile.js).
import { createCourse } from "./course.js";
import { COURSE, LESSON_IDS, LESSONS, fillReview } from "./statecraft-lessons.js";
import { statecraftStage } from "./statecraft-stage.js";
import { plate } from "./statecraft-plate.js";
import { loadPile, savePile, record, dueIds } from "./statecraft-pile.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "statecraft:lessons";            // { done, of }: what the games screen's tile shows
const total = LESSON_IDS.length;

bindSwitcher($("appsBtn"), "statecraft");
document.querySelector(".sc-mark").innerHTML = APPS.find(a => a.id === "statecraft")?.logo || "";
$("plate").innerHTML = plate();
document.querySelector(".sc-intro").textContent = `How states get others to do what they want, and what stops them: ${total} short lessons on diplomacy, strategy, deterrence and thirteen actors inside their constraints.`;

let pile = loadPile();
const refill = () => fillReview(dueIds(pile));
refill();

const course = createCourse({
  id: "statecraft", course: COURSE, cls: "statecraftc", inFrame: IN_FRAME,
  stage: statecraftStage({
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

const readDone = () => { try { return JSON.parse(localStorage.getItem("statecraft:course") || "{}").done || {}; } catch { return {}; } };
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
  try { at = JSON.parse(localStorage.getItem("statecraft:course") || "{}").at; } catch { /* none */ }
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
  part(body, "about").append(line(p.done ? `${p.done} of ${total} lessons done. Each chapter ends with its reading list.` : `${total} lessons, in order. Each chapter ends with its reading list.`));
  if ((p.done || due) && !IN_FRAME) part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done, and your review?"))) return;
    try { localStorage.removeItem("statecraft:course"); localStorage.removeItem("statecraft:pile"); localStorage.removeItem(COUNT); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__statecraft = { course, refresh };
