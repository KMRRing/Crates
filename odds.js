// Odds: a course on probability and judgement (docs/odds.md). The page is a landing behind the course's sheet (course.js):
// where you are, what your calibration record looks like, and the way back in. The lessons are odds-course.js, drawn by
// odds-stage.js; what they keep is under odds: (course.js's odds:course, odds-store.js's odds:calib and odds:ranges).
import { createCourse, progressOf, lessonsOf } from "./course.js";
import { COURSE } from "./odds-course.js";
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
watch(IN_FRAME);
bindSwitcher($("appsBtn"), "odds");
document.querySelector(".od-mark").innerHTML = APPS.find(a => a.id === "odds").logo;

const course = createCourse({ id: "odds", course: COURSE, stage: oddsStage(), cls: "od", inFrame: IN_FRAME });
const sheet = document.querySelector("dialog.ln-sheet");

/** The landing: lessons done, answers rated, the calibration plot, and the button that goes back in. */
function home() {
  const pr = progressOf("odds", COURSE), rec = readCalib(), [hits, tries] = readRanges(), b = meanBrier(rec), o = overconfidence(rec);
  $("stats").innerHTML = [[`${pr.done} of ${pr.of}`, "lessons"], [String(rec.n), "statements rated"], [b == null ? "–" : b.toFixed(3), "Brier score"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  $("goBtn").textContent = !pr.next ? "Go over the lessons" : pr.done ? `Continue: ${pr.next.lesson.title}` : "Start the course";
  $("record").innerHTML = relPlot(reliability(rec));
  $("recNote").textContent = !rec.n ? "Rate some statements in the calibration lesson and your plot appears here."
    : `${rec.n} answers${o == null ? "" : o > 0.05 ? ", overconfident by " + Math.round(100 * o) + " points" : o < -0.05 ? ", underconfident by " + Math.round(-100 * o) + " points" : ", close to calibrated"}.${tries ? ` Your 90% ranges held the truth ${hits} of ${tries} times.` : ""}`;
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
    if (!(await sure("Forget your progress, your calibration record and your range record?", { yes: "Forget them" }))) return;
    // emptied, not removed: a removed key would come back from another device (suite.js syncs keys, newest wins)
    if (!IN_FRAME) for (const [k, v] of [["odds:course", { done: {}, at: null }], [CALIB_KEY, emptyCalib()], [RANGE_KEY, [0, 0]]]) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ }
    home();
  }, "link"));
  part(body, "about").append(line(`${lessonsOf(COURSE).length} lessons. The statements and quantities are settled facts, not opinions.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
window.__odds = { course, home };
if (location.hash !== "#home") course.open();
