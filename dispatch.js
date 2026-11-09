// Dispatch: a day of meetings with notable people, read once; then your notes of the day come back spoiled (a name swapped for
// another's, a place wrong, a line left blank) and you put them right from memory. The score is the share of slots right.
// The meetings are dispatch-bank.js's, the dealing, spoiling and marking dispatch-engine.js's; this file keeps the run and the page.
import { continentOf, MEETINGS, LEVELS, LEVEL_IDS, SLOTS, SLOT_LABEL, meetingOf, textOf, dealDay, dailyDay, takeNotes, options, score } from "./dispatch-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, todayPart, isPaused } from "./menu.js";
import { flags } from "./menu-flags.js";
import { regionOf } from "./region.js";
import * as pile from "./pile.js";
import { ramp } from "./ramp.js";
import { sure } from "./sure.js";
import { today, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { showPicture, pictureName } from "./pics.js";

const $ = id => document.getElementById(id);
const RUN = "dispatch:run", BEST = "dispatch:best", DAILY = "dispatch:daily";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { if (IN_FRAME) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// ---------- the run ----------
// S: { v, level, daily, day, ids (the day's meetings), notes, phase: "read" | "notes" | "done", idx (the meeting being read), ms (on it), pct, fixed }
let S = read(RUN, null);
if (S && (S.v !== 1 || !Array.isArray(S.ids) || !S.ids.every(meetingOf))) S = null;
const save = () => write(RUN, S);
const startLevel = () => ramp("dispatch", LEVEL_IDS, { start: "easy" });
const limit = () => LEVELS[S.level].read * 1000;

function newRun(daily = false) {
  const level = daily ? "medium" : startLevel();
  const ids = daily ? dailyDay(today()) : dealDay(level, Math.random, { region: regionOf("dispatch"), prefer: dueMeetings() });
  S = { v: 1, level, daily, day: daily ? today() : null, ids, notes: takeNotes(ids, level), phase: "read", idx: 0, ms: 0, pct: 0, fixed: 0 };
  save(); render();
}

/** The meetings the learning mode would bring back in this day: its own due ones (pile.js), most overdue first. */
function dueMeetings() {
  if (!pile.learning()) return [];
  return pile.picks("dispatch").map(it => it.key).filter(id => meetingOf(id)).slice(0, 3);
}
/** The learning piles: a meeting with a slot wrong or blank at the end comes back as a question about its first such slot (to Deck
 *  and to Dispatch's next days); one with all three right that was on a pile moves up it. Today's day is the same for everyone and
 *  teaches nothing. */
function learn() {
  if (S.daily) return;
  const { marks } = score(S.ids, S.notes);
  S.ids.forEach((id, i) => {
    const x = meetingOf(id), miss = SLOTS.find(slot => !marks[i][slot]);
    if (!miss) { if (pile.has("dispatch", id)) pile.answer("dispatch", id, true); return; }
    const same = MEETINGS.filter(y => y.id !== id && textOf(miss, y) !== textOf(miss, x));
    const near = [...same.filter(y => continentOf(y) === continentOf(x)), ...same.filter(y => continentOf(y) !== continentOf(x))];
    const pick = near.map((y, k) => [((k + id.length) * 7919) % 997 + (continentOf(y) === continentOf(x) ? 0 : 1000), textOf(miss, y)]).sort((a, b) => a[0] - b[0]);
    const others = [...new Set(pick.map(a => a[1]))].slice(0, 3);
    const prompt = miss === "who" ? `${x.place}, ${x.year}: ${x.what}` : miss === "where" ? `${x.who} ${x.what} (${x.year})` : `${x.who} in ${x.place}, ${x.year}`;
    pile.record("dispatch", id, { ask: `Dispatch · ${miss === "what" ? "what was said" : miss}`, prompt, options: [textOf(miss, x), ...others], right: [0], note: `${x.who} (${x.nat}), ${x.place}, ${x.year}: ${x.why}` }, "miss");
  });
}

// ---------- the end ----------
function handIn() {
  if (!S || S.phase !== "notes") return;
  S.phase = "done";
  S.pct = score(S.ids, S.notes).pct;
  const best = read(BEST, {});
  if (!(best[S.level] >= S.pct)) { best[S.level] = S.pct; write(BEST, best); }
  if (S.daily) { const d = read(DAILY, {}); if (!(d[S.day] >= S.pct)) { d[S.day] = S.pct; write(DAILY, d); } }
  else { startLevel(); if (S.pct === 100) ramp.won(true); else if (S.pct >= 70) ramp.won(false); else ramp.lost(); }
  roundOver("dispatch");
  learn();
  save(); render();
  setTimeout(showDone, 250);
}
function showDone() {
  if (S?.phase !== "done") return;
  const s = score(S.ids, S.notes), best = read(BEST, {});
  $("doneTitle").textContent = `${s.right} of ${s.total}`;
  const facts = el("p", "dp-facts");
  facts.append(`${S.pct}% of the day's details, ${S.fixed ? `${S.fixed} ${S.fixed === 1 ? "change" : "changes"} made.` : "no changes made."}`);
  const recap = el("ol", "dp-recap");
  S.ids.map(meetingOf).forEach(x => { const li = el("li"); li.append(el("b", "", `${x.who} (${x.nat})`), ` ${x.what}${x.alt ? `, or: ${x.alt}` : ""} (${x.place}, ${x.year}). ${x.why}`); recap.append(li); });
  $("doneBody").replaceChildren(facts, el("p", "dp-best", `Best at ${S.level}: ${best[S.level] ?? "–"}%`), recap, action("Another day", () => { $("doneDlg").close(); newRun(false); }, "primary"));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- drawing ----------
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function render() {
  if (!S) return;
  const stage = $("stage"), n = S.ids.length, level = `${S.level[0].toUpperCase()}${S.level.slice(1)}${S.daily ? " · today's" : ""}`;
  $("goBtn").hidden = false;
  if (S.phase === "read") {
    const x = meetingOf(S.ids[S.idx]);
    $("where").textContent = `${level} · meeting ${S.idx + 1} of ${n}`;
    const bar = el("div", "dp-time"), fill = el("i"); bar.append(fill); fill.id = "fill";
    const scene = el("article", "dp-scene");
    scene.append(el("p", "dp-place", `${x.place} · ${x.year}`), el("h2", "dp-who", x.who), el("p", "dp-nat", x.nat), el("p", "dp-said", `${x.what[0].toUpperCase()}${x.what.slice(1)}.`), el("p", "dp-why", x.why));
    const pic = el("figure", "dp-pic");
    pic.hidden = true;
    if (x.pic) scene.prepend(pic);
    stage.replaceChildren(bar, scene);
    if (x.pic) showPicture(pic, x.pic, { width: 500, caption: pictureName(x.pic), alt: x.pic });
    $("goBtn").textContent = S.idx + 1 < n ? "Next" : "To my notes";
    drawTime();
  } else {
    const done = S.phase === "done", s = score(S.ids, S.notes);
    $("where").textContent = done ? `${level} · ${s.right} of ${s.total} right` : `${level} · your notes`;
    $("clock").textContent = "";
    const nodes = [];
    if (!done) nodes.push(el("p", "dp-help", "Your notes were written in a hurry. Some details are wrong and some are blank: tap a detail to change it, then hand the notes in. A person can appear twice, and a fact may be worded another way from how you read it."));
    S.ids.forEach((id, i) => {
      const x = meetingOf(id), card = el("section", "dp-note");
      const wrongYear = done && s.marks[i].year === false, from = wrongYear ? meetingOf(s.marks[i].storyOf) : null;
      card.append(el("h3", wrongYear ? "dp-year-wrong" : "", wrongYear ? `${i + 1} · ${x.year}: this story is ${from.year}` : `${i + 1} · ${x.year}`));
      for (const slot of SLOTS) {
        const v = S.notes[i][slot], held = v ? meetingOf(v) : null, row = el("div", "dp-row"), b = el("button", "dp-slot", held ? textOf(slot, held) : "—");
        b.type = "button";
        if (!held) b.classList.add("blank");
        if (done) { b.disabled = true; b.classList.add(s.marks[i][slot] ? "right" : "wrong"); } else b.addEventListener("click", () => pick(i, slot));
        row.append(el("span", "", SLOT_LABEL[slot]), b);
        card.append(row);
        if (done && !s.marks[i][slot]) card.append(el("p", "dp-fix", textOf(slot, x)));
      }
      nodes.push(card);
    });
    stage.replaceChildren(...nodes);
    $("goBtn").textContent = done ? "Another day" : "Hand in";
  }
}
function drawTime() {
  const f = $("fill"); if (!f || S.phase !== "read") return;
  f.style.width = `${Math.min(100, 100 * S.ms / limit())}%`;
  $("clock").textContent = clock(Math.max(0, Math.ceil((limit() - S.ms) / 1000)));
}

// ---------- picking ----------
function pick(i, slot) {
  const list = options(S.ids, slot, S.level, (() => { let a = (S.ids.length * 131 + i * 17 + SLOTS.indexOf(slot)) >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })());
  $("pickTitle").textContent = `${SLOT_LABEL[slot]}, note ${i + 1}`;
  const body = $("pickBody"), set = v => { if (S.notes[i][slot] !== v) { S.notes[i][slot] = v; S.fixed++; save(); } $("pickDlg").close(); render(); };
  body.replaceChildren(...list.map(o => { const b = el("button", `btn${S.notes[i][slot] === o.id ? " primary" : ""}`, o.text); b.type = "button"; b.addEventListener("click", () => set(o.id)); return b; }),
    (() => { const b = el("button", "btn", "Leave blank"); b.type = "button"; b.addEventListener("click", () => set(null)); return b; })());
  $("pickDlg").showModal();
}

// ---------- time ----------
let last = performance.now(), shown = -1;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = now - last; last = now;
  if (!S || S.phase !== "read" || isPaused() || document.visibilityState !== "visible") return;
  S.ms += Math.min(dt, 250);
  if (S.ms >= limit()) { advance(); return; }
  drawTime();
  const s = Math.floor(S.ms / 1000); if (s !== shown) { shown = s; save(); }
}
function advance() {
  if (!S || S.phase !== "read") return;
  S.ms = 0;
  if (S.idx + 1 < S.ids.length) S.idx++; else S.phase = "notes";
  save(); render();
}

// ---------- the menu ----------
const started = () => !!S && S.phase !== "done" && (S.phase === "notes" || S.idx > 0);
function openMenu() {
  const body = $("menuBody");
  startLevel();                                    // the shared level row follows this game's ramp
  body.replaceChildren();
  part(body, "play").append(action("New day", async () => { $("menuDlg").close(); if (started() && !(await sure("Start a new day? This one isn't finished."))) return; newRun(false); }, "primary"));
  const got = read(DAILY, {})[today()];
  todayPart(body, {
    app: "dispatch", done: got != null, result: got != null ? `${got}%` : "",
    play: () => { $("menuDlg").close(); openToday(); }, playing: !!S?.daily && S.day === today() && S.phase !== "done", busy: started(),
  });
  flags(body, { name: "Dispatch", game: "dispatch", region: true, learning: true });   // both are for random days; today's is the same for everyone
  const best = read(BEST, {});
  part(body, "about").append(line(LEVEL_IDS.map(l => `${l[0].toUpperCase()}${l.slice(1)} ${LEVELS[l].n} meetings, ${LEVELS[l].read} s each${best[l] != null ? ` (best ${best[l]}%)` : ""}`).join("; ") + "."),
    line("Read each meeting once: who it was and their nationality, where, and what they said. Then your notes come back with some details wrong or blank, and a fact may be worded another way. Some people turn up twice in a day. Put the notes right from memory."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
async function openToday() {
  if (started() && !(S.daily && S.day === today()) && !(await sure("Start today's day? This one isn't finished."))) return;
  if (S?.daily && S.day === today() && S.phase !== "done") return;
  newRun(true);
}

// ---------- wiring ----------
document.querySelector(".dp-mark").innerHTML = APPS.find(a => a.id === "dispatch")?.logo || "";
bindSwitcher($("appsBtn"), "dispatch");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("pickClose").addEventListener("click", () => $("pickDlg").close());
$("goBtn").addEventListener("click", () => { if (!S) return; if (S.phase === "read") advance(); else if (S.phase === "notes") handIn(); else newRun(false); });
requestAnimationFrame(tick);
if (arrivedForToday() && !(S?.daily && S.day === today())) setTimeout(() => newRun(true), 0);
else if (!S) newRun(dailyDue("dispatch"));
else { render(); if (S.phase === "done") showDone(); }

// for tests and debugging
window.__dispatch = { get state() { return S; }, newRun, advance, handIn };
