// Census: a set is named and you type its members against the clock: the countries of Africa, the Swiss cantons, the noble gases.
// A name that is in the set is kept, one that isn't costs nothing, one you already had is said so; the clock runs out, or you give up,
// or you have the lot. The score is the share found. The sets are census-sets.js's, the judging and the clock census-engine.js's;
// this file keeps the run and builds the page.
import { SETS, GROUPS, LEVEL_IDS, setOf, judge, secondsFor, percent, starsFor, dailySet, dealSet } from "./census-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line, todayPart, isPaused } from "./menu.js";
import { ramp } from "./ramp.js";
import { sure } from "./sure.js";
import { today, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const RUN = "census:run", BEST = "census:best", SEEN = "census:seen", DAILY = "census:daily", GROUP = "census:group";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// ---------- the run ----------
// S: { v, id (the set), level, daily, day, found: [member indexes, in the order found], misses, ms (elapsed), limit (ms), over, pct }
let S = read(RUN, null);
if (S && (S.v !== 1 || !setOf(S.id))) S = null;
const save = () => write(RUN, S);
const startLevel = () => ramp("census", LEVEL_IDS, { start: "easy" });
const set = () => setOf(S.id);
const found = () => new Set(S.found);

function newRun(daily = false) {
  const level = daily ? "medium" : startLevel(), seen = read(SEEN, []);
  const chosen = daily ? dailySet(today()) : dealSet(read(GROUP, "all"), seen);
  S = { v: 1, id: chosen.id, level, daily, day: daily ? today() : null, found: [], misses: 0, ms: 0, limit: secondsFor(chosen, level) * 1000, over: false, pct: 0 };
  if (!daily) write(SEEN, [chosen.id, ...seen.filter(x => x !== chosen.id)].slice(0, SETS.length - 1));
  save(); begin();
}
function begin() {
  $("title").textContent = set().title;
  $("ask").textContent = set().ask;
  $("typed").value = "";
  note("");
  render();
  if (!S.over) setTimeout(() => $("typed").focus(), 50);
}

// ---------- typing ----------
function note(text, kind = "") { const n = $("note"); n.textContent = text; n.className = `ce-note ${kind}`; }
$("form").addEventListener("submit", e => {
  e.preventDefault();
  if (!S || S.over) return;
  const typed = $("typed").value, r = judge(set(), found(), typed);
  if (r.kind === "blank") return;
  $("typed").value = "";
  if (r.kind === "new") {
    S.found.push(r.index);
    note(`${set().items[r.index].name}`, "");
    save(); render(true);
    if (S.found.length === set().items.length) finish("all");
  } else if (r.kind === "again") note(`${set().items[r.index].name}: you have that one`, "again");
  else { S.misses++; note(r.ambiguous ? "That could be more than one: say a little more" : "Not in this set", "no"); save(); render(); }
  $("typed").focus();
});

// ---------- the end ----------
function finish(why) {
  if (!S || S.over) return;
  S.over = true; S.why = why;
  S.pct = percent(set(), S.found.length);
  const best = read(BEST, {});
  if (!(best[S.id] >= S.pct)) { best[S.id] = S.pct; write(BEST, best); }
  if (S.daily) { const d = read(DAILY, {}); if (!(d[S.day] >= S.pct)) { d[S.day] = S.pct; write(DAILY, d); } }
  else { startLevel(); const stars = starsFor(S.pct); if (stars === 3) ramp.won(true); else if (stars === 2) ramp.won(false); else ramp.lost(); }
  roundOver("census");
  save(); render();
  setTimeout(showDone, why === "all" ? 500 : 250);
}
function showDone() {
  if (!S?.over) return;
  const sset = set(), body = $("doneBody"), best = read(BEST, {});
  $("doneTitle").textContent = `${S.found.length} of ${sset.items.length}`;
  const facts = el("p", "ce-facts");
  facts.append(S.why === "all" ? "Every one. " : S.why === "time" ? "Time. " : "", `${S.pct}% of ${sset.title.toLowerCase()}${S.misses ? `, ${S.misses} ${S.misses === 1 ? "name" : "names"} that weren't in it` : ""}. `,
    el("small", "", `${clock(Math.round(Math.min(S.ms, S.limit) / 1000))} of ${clock(Math.round(S.limit / 1000))}.`));
  const nodes = [facts];
  const miss = sset.items.filter((_, i) => !S.found.includes(i)).map(it => it.name);
  if (miss.length) nodes.push(el("p", "ce-missed", `Missed: ${miss.join(", ")}.`));
  nodes.push(el("p", "ce-best", `Best at this set: ${best[S.id] ?? "–"}%`),
    action("Another set", () => { $("doneDlg").close(); newRun(false); }, "primary"));
  body.replaceChildren(...nodes);
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---------- drawing ----------
function render(newest = false) {
  if (!S) return;
  const sset = set(), n = sset.items.length;
  $("where").textContent = `${S.level[0].toUpperCase()}${S.level.slice(1)}${S.daily ? " · today's" : ""} · ${S.found.length} of ${n}`;
  drawClock();
  const box = $("found");
  box.replaceChildren();
  if (S.over) {
    // at the end: every member, those found solid, those missed dashed
    sset.items.forEach((it, i) => box.append(el("span", `ce-tag${S.found.includes(i) ? "" : " miss"}`, it.name)));
  } else {
    [...S.found].reverse().forEach((i, k) => box.append(el("span", `ce-tag${newest && k === 0 ? " new" : ""}`, sset.items[i].name)));
  }
  $("typed").disabled = S.over; $("go").disabled = S.over;
  $("giveBtn").hidden = S.over; $("nextBtn").hidden = !S.over;
}
function drawClock() {
  const left = Math.max(0, S.limit - S.ms), c = $("clock");
  c.textContent = clock(Math.ceil(left / 1000));
  c.classList.toggle("low", !S.over && left <= 15000);
}

// ---------- time ----------
let last = performance.now(), savedAt = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = now - last; last = now;
  if (!S || S.over || isPaused() || document.visibilityState !== "visible") return;
  S.ms += Math.min(dt, 250);
  const s = Math.ceil((S.limit - S.ms) / 1000);
  if (s !== savedAt) { savedAt = s; drawClock(); if (s % 5 === 0) save(); }
  if (S.ms >= S.limit) finish("time");
}

// ---------- the menu ----------
const started = () => !!S && !S.over && S.found.length > 0;
function openMenu() {
  const body = $("menuBody");
  startLevel();                                    // the shared level row follows this game's ramp
  body.replaceChildren();
  part(body, "play").append(action("New set", async () => { $("menuDlg").close(); if (started() && !(await sure("Start a new set? This one isn't finished."))) return; newRun(false); }, "primary"));
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    app: "census", done: got != null, result: got != null ? `${got}%` : "",
    play: () => { $("menuDlg").close(); openToday(); }, playing: !!S?.daily && S.day === today() && !S.over, busy: started(),
  });
  part(body, "content").append(choice("Sets", [["all", "All"], ...GROUPS.map(g => [g, g])], read(GROUP, "all"), v => write(GROUP, v)),
    line("Applies from the next set. Easy gives half as much time again, Hard under three quarters."));
  const best = read(BEST, {}), done = Object.keys(best).length;
  part(body, "about").append(line(`${SETS.length} sets; ${done ? `${done} played, ${Object.values(best).filter(p => p >= 100).length} complete.` : "none played yet."}`),
    line("Type the members of the set, in any order. Case, accents and a slip of a letter don't matter; a name that isn't in the set costs nothing."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".ce-mark").innerHTML = APPS.find(a => a.id === "census")?.logo || "";
bindSwitcher($("appsBtn"), "census");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("nextBtn").addEventListener("click", () => newRun(false));
$("giveBtn").addEventListener("click", async () => { if (S && !S.over && await sure("Give up on this set? You keep what you have.")) finish("gave up"); });
requestAnimationFrame(tick);
async function openToday() {
  if (started() && !(S.daily && S.day === today()) && !(await sure("Start today's set? This one isn't finished."))) return;
  if (S?.daily && S.day === today() && !S.over) return;
  newRun(true);
}
if (arrivedForToday() && !(S?.daily && S.day === today())) setTimeout(() => newRun(true), 0);
else if (!S) newRun(dailyDue("census"));
else if (S.over) { begin(); showDone(); }
else begin();

// for tests and debugging
window.__census = { get state() { return S; }, newRun, finish };
