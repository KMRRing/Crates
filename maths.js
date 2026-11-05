// Maths: a course from GCSE to first-year university (docs/maths.md), and its last part, Odds and judgement. The page is a
// landing behind the course sheets (course.js): where you are, the chapters of both parts with how far through each you are,
// your calibration record, and the way back in. The lessons are maths-course.js and odds-course.js, drawn by maths-stage.js and
// odds-stage.js, each part on a sheet of its own. What is kept: course.js's maths:course and odds:course (and odds-store.js's
// odds:calib and odds:ranges), and maths:lessons ({ done, of }, both parts) for the tile.
import { createCourse, lessonsOf } from "./course.js";
import { COURSE, ODDS_COURSE, LEVELS, progressAll } from "./maths-course.js";
import { mathsStage } from "./maths-stage.js";
import { oddsStage } from "./odds-stage.js";
import { readCalib, readRanges, watch, CALIB_KEY, RANGE_KEY } from "./odds-store.js";
import { meanBrier, reliability, overconfidence, emptyCalib } from "./odds-math.js";
import { relPlot } from "./odds-plot.js";
import { bindSwitcher, APPS } from "./apps.js";
import { IN_FRAME } from "./suite.js";
import "./pwa.js";
import { part, action, line } from "./menu.js";
import { sure } from "./sure.js";

const $ = id => document.getElementById(id);
const COUNT = "maths:lessons";
const lessons = c => lessonsOf(c).length;
watch(IN_FRAME);
bindSwitcher($("appsBtn"), "maths");
document.querySelector(".ma-mark").innerHTML = APPS.find(a => a.id === "maths")?.logo || "";

const sheets = {
  maths: createCourse({ id: "maths", course: COURSE, stage: mathsStage(), cls: "ma", inFrame: IN_FRAME }),
  odds: createCourse({ id: "odds", course: ODDS_COURSE, stage: oddsStage(), cls: "od", inFrame: IN_FRAME }),
};

const doneIds = id => { try { return JSON.parse(localStorage.getItem(`${id}:course`) || "{}").done || {}; } catch { return {}; } };
const rowsOf = (course, id, first) => {
  const done = doneIds(id);
  return course.chapters.map((c, i) => {
    const n = c.lessons.filter(l => done[l.id]).length;
    return `<div class="ma-ch ${id}"><span class="ma-no">${first + i}</span><span class="ma-name">${c.title}<small>${id === "maths" ? LEVELS[c.id] || "" : ""}</small></span><span class="ma-bar" aria-hidden="true"><i style="width:${Math.round(100 * n / c.lessons.length)}%"></i></span><span class="ma-n">${n}/${c.lessons.length}</span></div>`;
  }).join("");
};
const finished = (course, id) => { const done = doneIds(id); return course.chapters.filter(c => c.lessons.every(l => done[l.id])).length; };

/** The landing: lessons done, the chapters of both parts, the calibration record, and the button that goes back in. */
function home() {
  const pr = progressAll(), chapters = COURSE.chapters.length + ODDS_COURSE.chapters.length;
  const rec = readCalib(), [hits, tries] = readRanges(), b = meanBrier(rec), o = overconfidence(rec);
  $("intro").textContent = `From GCSE through IB Higher Level to the first year at university, then a last part on odds and judgement: ${pr.of} short lessons in ${chapters} chapters, each with a worked example, something to move or type, and questions the page checks from the arithmetic.`;
  $("stats").innerHTML = [[`${pr.done} of ${pr.of}`, "lessons"], [`${finished(COURSE, "maths") + finished(ODDS_COURSE, "odds")} of ${chapters}`, "chapters"], [pr.next ? pr.next.chapter.title : "All done", "next up"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  $("goBtn").textContent = !pr.next ? "Go over the lessons" : pr.done ? `Continue: ${pr.next.lesson.title}` : "Start the course";
  const oddsDone = Object.keys(doneIds("odds")).length;
  $("chapters").innerHTML = rowsOf(COURSE, "maths", 1)
    + `<button type="button" class="ma-part" data-open="odds"><b>${ODDS_COURSE.title}</b><small>Probability, expected value, Bayes, fair prices, Kelly sizing and calibration.</small><span>${oddsDone}/${lessons(ODDS_COURSE)}</span></button>`
    + rowsOf(ODDS_COURSE, "odds", COURSE.chapters.length + 1)
    + `<div class="ma-rec"><h4>Your calibration</h4><div class="ma-recfig">${relPlot(reliability(rec))}</div><p class="ma-recnote">${!rec.n ? "Rate some statements in the calibration lesson and your plot appears here."
      : `${rec.n} answers${b == null ? "" : `, Brier score ${b.toFixed(3)}`}${o == null ? "" : o > 0.05 ? ", overconfident by " + Math.round(100 * o) + " points" : o < -0.05 ? ", underconfident by " + Math.round(-100 * o) + " points" : ", close to calibrated"}.${tries ? ` Your 90% ranges held the truth ${hits} of ${tries} times.` : ""}`}</p></div>`;
  if (!IN_FRAME) try { if (pr.done) localStorage.setItem(COUNT, JSON.stringify({ done: pr.done, of: pr.of })); else localStorage.removeItem(COUNT); } catch { /* private mode */ }
}
/** Opens a part's sheet: the one named, or the one the next lesson is in. */
const openPart = id => (sheets[id || progressAll().next?.part || "maths"]).open();
$("goBtn").addEventListener("click", () => openPart());
$("chapters").addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (b) openPart(b.dataset.open); });
document.querySelectorAll("dialog.ln-sheet").forEach(d => d.addEventListener("close", home));
home();

// the menu: the way into each part, and starting over
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("Open the lessons", () => openPart()));
  play.append(action(`Open ${ODDS_COURSE.title}`, () => openPart("odds")));
  const settings = part(body, "settings");
  // emptied, not removed: a removed key would come back from another device (suite.js syncs keys, newest wins)
  const empty = pairs => { if (!IN_FRAME) for (const [k, v] of pairs) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } home(); };
  settings.append(action("Start the course over", async () => {
    if (!(await sure("Forget which Maths lessons you have done?", { yes: "Forget them" }))) return;
    empty([["maths:course", { done: {}, at: null }]]);
  }, "link"));
  settings.append(action("Start Odds and judgement over", async () => {
    if (!(await sure("Forget your Odds progress, your calibration record and your range record?", { yes: "Forget them" }))) return;
    empty([["odds:course", { done: {}, at: null }], [CALIB_KEY, emptyCalib()], [RANGE_KEY, [0, 0]]]);
  }, "link"));
  part(body, "about").append(line(`${lessons(COURSE) + lessons(ODDS_COURSE)} lessons, GCSE to first-year university and odds. Answers are checked from the working, not from a stored key.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__maths = { course: sheets.maths, odds: sheets.odds, home };
// #odds (the old Odds tile's address, odds.html) opens the last part; #home stays on the landing
if (location.hash === "#odds") openPart("odds");
else if (location.hash !== "#home") openPart();
