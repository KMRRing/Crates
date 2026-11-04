// Music: a course in music theory and ear training, lessons on the suite's course sheet (course.js), each with an instrument to use
// (music-stage.js) and every sound made by Web Audio as it plays (music-audio.js). This page is the door: the plate, where you have got to,
// and the way in. The lessons are music-lessons.js, the theory music-theory.js. See docs/music.md for the iOS traps.
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE } from "./music-lessons.js";
import { musicStage } from "./music-stage.js";
import { createAudio } from "./music-audio.js";
import { loadPile, dueIds } from "./music-pile.js";
import { plate } from "./music-plate.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, action, line, toggle, PAUSERS } from "./menu.js";
import { IN_FRAME } from "./suite.js";
import { sure } from "./sure.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const COUNT = "music:lessons", MUTE = "music:mute";            // COUNT is { done, of }: what the games screen's tile shows
const total = lessonsOf(COURSE).length;

bindSwitcher($("appsBtn"), "music");
document.querySelector(".mu-mark").innerHTML = APPS.find(a => a.id === "music")?.logo || "";
$("plate").innerHTML = plate();

const audio = createAudio({ frame: IN_FRAME });                // a watching frame makes no sound at all
try { audio.setMuted(localStorage.getItem(MUTE) === "1"); } catch { /* private mode */ }
const stage = musicStage({ audio, inFrame: IN_FRAME });
const course = createCourse({ id: "music", course: COURSE, cls: "musc", inFrame: IN_FRAME, stage });
const sheet = document.querySelector("dialog.ln-sheet");

// The pause rule: the course sheet is itself a "pausing" dialog (course.js), and sound is its whole point, so only the others count: the
// menu, the games screen, a confirmation, and a hidden page.
const OTHERS = PAUSERS.replace(/,\s*dialog\.pauses\[open\]/, "");
function settle() {
  if (document.hidden || document.querySelector(OTHERS)) { stage.pause(); audio.pause(); } else audio.resume();
}
addEventListener("suite:pause", settle);
addEventListener("suite:resume", settle);
document.addEventListener("visibilitychange", settle);
sheet.addEventListener("close", () => stage.stop());

/** Where the reader has got to, on the page and (for the tile) in a key of its own. */
function refresh() {
  const p = progressOf("music", COURSE);
  $("status").textContent = p.done === total ? "Every lesson done" : p.done ? `${p.done} of ${total} lessons` : `${total} lessons`;
  $("meter").style.width = `${Math.round(p.done / total * 100)}%`;
  $("goBtn").textContent = p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start";
  if (!IN_FRAME) try { if (p.done) localStorage.setItem(COUNT, JSON.stringify({ done: p.done, of: total })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
function resume() {
  audio.unlock();                                              // inside the tap, so iOS lets the sound start
  const p = progressOf("music", COURSE);
  let at = null;
  try { at = JSON.parse(localStorage.getItem("music:course") || "{}").at; } catch { /* none */ }
  if (p.done === total) course.open(); else course.open(at?.id || p.next.lesson.id);
}
$("goBtn").addEventListener("click", resume);
$("mapBtn").addEventListener("click", () => { audio.unlock(); course.open(); });
sheet.addEventListener("close", refresh);
refresh();

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const p = progressOf("music", COURSE), play = part(body, "play");
  play.append(action(p.done === total ? "Go over a lesson" : p.done ? `Continue: ${p.next.lesson.title}` : "Start the course", resume, "primary"));
  play.append(action("All the lessons", () => { audio.unlock(); course.open(); }));
  const settings = part(body, "settings");
  settings.append(toggle("Sound", !audio.muted, on => { audio.setMuted(!on); try { localStorage.setItem(MUTE, on ? "0" : "1"); } catch { /* private mode */ } stage.mutedChanged(); }));
  settings.append(action("Measure my tap delay again", () => { audio.unlock(); course.open("pulse"); }));
  const due = dueIds(loadPile()).length;
  part(body, "about").append(line(`${p.done ? `${p.done} of ${total} lessons done.` : `${total} lessons, in order.`} ${due ? `${due} ear question${due > 1 ? "s" : ""} to review.` : ""}`.trim()));
  if (p.done && !IN_FRAME) part(body, "settings").append(action("Start the course over", async () => {
    if (!(await sure("Forget which lessons you have done?"))) return;
    try { localStorage.removeItem("music:course"); localStorage.removeItem(COUNT); localStorage.removeItem("music:pile"); } catch { /* private mode */ }
    location.reload();
  }, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__music = { course, refresh, audio, stage };
