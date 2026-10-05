// Punt: pick an option, stake a share of the pot at the house's odds, or pass (rules in punt-gen.js).
// Solo sessions are saved in this browser. Together, both players share one pot; each stakes up to half of it
// on their own pick, so you can back the same option or hedge against each other. A question settles once
// everyone at the table has bet or passed.
import { makeSession, moreQuestions, settle, pickedRight, rightCount, averageReturn, showReturn, knowledgeStats, LEVELS, LENGTHS, START_POT,
  showOdds, showChips } from "./punt-gen.js";
import { createTogether, seatsOf } from "./together.js";
import * as pile from "./pile.js";
import { setRich } from "./rich.js";
import { showPicture } from "./pics.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { fileFlag, flagged, localFlags, sendFlags, allFlags, flagsAsText } from "./flags.js";
import { gameHref, GAMES } from "./rooms.js";

const $ = id => document.getElementById(id);
const STORE = "punt:solo", LENGTH = "punt:length", BEST = "punt:best", RECORDS = "punt:records", MATHS_PICKS = "punt:maths";
const APP = 1;
const ME = "me";                                   // the solo player's seat
const randomSeed = () => Math.floor(Math.random() * 1e9);

// S: { seed, level, length, questions, index, pot, phase: "bet" | "reveal", bets: { id: { pick, pct } }, log: [result], done }
// A pick is a list of option indices (all of the right ones, when several are), or null for a pass.
// a result: { index, pot (before), bets, change }
let S = null;
let pick = [];        // the options chosen on this device for the current question
let pct = 0;          // the stake chosen on this device, as a share of the pot
let shownDone = null;

const me = () => (together.room ? together.room.uid : ME);
const maxPct = () => (together.room ? 50 : 100);
const question = () => S.questions[S.index];
const seated = () => (together.room ? seatsOf(together.room.data).map(([id]) => id) : [ME]);

// ---------- question banks (Maths, Refining): a bank module with STAGES and MATHS, filtered by stages and difficulties ----------
const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const banks = {};            // level id -> the loaded module
async function loadBank(level) { if (!banks[level]) banks[level] = await import(LEVELS[level].bank); return banks[level]; }
const isMaths = level => !!LEVELS[level]?.maths;
const picksKey = level => (level === "maths" ? MATHS_PICKS : `punt:picks:${level}`);
/** The stages and difficulties chosen for a bank's runs: null stages means all of them. */
function chosenPicks(level) {
  try {
    const m = JSON.parse(localStorage.getItem(picksKey(level)));
    return m?.stages?.length && m?.diffs?.length ? { stages: m.stages, diffs: m.diffs } : { stages: null, diffs: DIFFICULTIES };
  } catch { return { stages: null, diffs: DIFFICULTIES }; }
}
/**
 * The bank, filtered to a choice, with a label per stage: what the engine needs to deal. Returns { deal, picks }
 * with the picks resolved (unknown stages dropped, none meaning all).
 */
async function bankDeal(level, picks) {
  const { MATHS, STAGES } = await loadBank(level);
  const ids = STAGES.map(x => x.id);
  const stages = (picks.stages || ids).filter(x => ids.includes(x));
  const resolved = { stages: stages.length ? stages : ids, diffs: picks.diffs?.length ? picks.diffs.filter(d => DIFFICULTIES.includes(d)) : DIFFICULTIES };
  const pool = MATHS.filter(q => resolved.stages.includes(q.lv) && resolved.diffs.includes(q.d));
  // learning mode: what's due from the pile leads the next block; the rest prefers questions not yet seen
  const learning = pile.learning();
  const dueKeys = learning ? pile.due("punt").map(it => it.key).filter(k => k.startsWith(`${level}/`)).map(k => k.slice(level.length + 1)) : [];
  const seenKeys = learning ? new Set(pile.all("punt").map(it => it.key).filter(k => k.startsWith(`${level}/`)).map(k => k.slice(level.length + 1))) : new Set();
  return { deal: { pool, stages: Object.fromEntries(STAGES.map(x => [x.id, x.label])), dueKeys, seenKeys }, picks: resolved };
}
/** A run's link: seed, level, length, and for a bank its stages and difficulties. */
function linkOf(s) {
  const n = lengthOf(s) === "standard" ? "" : `&n=${lengthOf(s)}`;
  const m = isMaths(s.level) && s.maths ? `&st=${s.maths.stages.join(",")}&df=${s.maths.diffs.join(",")}` : "";
  return `#s=${s.seed}&d=${s.level}${n}${m}`;
}
/** The choice a link carries, if any (st = stages, df = difficulties), else the chosen one. */
function picksFromHash(h, level) {
  const stages = (h.get("st") || "").split(",").filter(Boolean);
  const diffs = (h.get("df") || "").split(",").map(Number).filter(d => DIFFICULTIES.includes(d));
  return stages.length && diffs.length ? { stages, diffs } : chosenPicks(level);
}

// ---------- sessions ----------
/** The run length chosen last (standard, 100 questions or endless), kept for the next run. */
function chosenLength() { try { const l = localStorage.getItem(LENGTH); return LENGTHS[l] ? l : "standard"; } catch { return "standard"; } }
const lengthOf = s => (LENGTHS[s?.length] ? s.length : "standard");

async function freshState(level, length, players = null, picks = null) {
  const seed = randomSeed();
  const bank = isMaths(level) ? await bankDeal(level, picks || chosenPicks(level)) : null;
  const deal = bank?.deal || null, maths = bank?.picks;
  return { v: 1, app: APP, seed, level, length, ...(deal && { maths }), questions: makeSession(seed, level, length, deal), index: 0, pot: START_POT, phase: "bet",
    bets: {}, log: [], done: null, created: Date.now(), ...(players && { players }) };
}
function loadSolo() { try { const s = JSON.parse(localStorage.getItem(STORE)); return s?.questions?.length ? s : null; } catch { return null; } }
function saveSolo() { if (!together.room) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode */ } }

async function soloSession(seed, level, length = chosenLength(), picks = null) {
  const bank = isMaths(level) ? await bankDeal(level, picks || chosenPicks(level)) : null;
  const deal = bank?.deal || null, maths = bank?.picks;
  if (deal && !deal.pool.length) { toast("No questions match that choice"); render(); return; }
  S = { v: 1, seed, level, length, ...(deal && { maths }), questions: makeSession(seed, level, length, deal), index: 0, pot: START_POT, phase: "bet", bets: {}, log: [], done: null };
  resetChoice();
  shownDone = null;
  saveSolo();
  history.replaceState(null, "", linkOf(S));
  render();
}

async function newSession(level = S.level, length = chosenLength(), picks = null) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new run? This one isn't finished.")) { render(); return; }
  try { localStorage.setItem(LENGTH, length); } catch { /* private mode */ }
  if (!together.room) { soloSession(randomSeed(), level, length, picks); return; }
  const next = await freshState(level, length, null, picks);
  together.act(g => { Object.assign(g, { seed: next.seed, level, length, maths: next.maths || null, questions: next.questions, index: 0, pot: START_POT, phase: "bet", bets: {}, log: [], done: null }); });
}

/** Ends an endless run where it stands, to see how it went. */
function endRun() {
  if (S.done || !S.log.length) return;
  change(g => { if (g.done) return false; g.done = { at: Date.now(), ended: true }; });
}

const resetChoice = () => { pick = []; pct = 0; };
/** A saved pick as a list (sessions saved before several-right questions stored one index). */
const picksOf = p => (p == null ? null : Array.isArray(p) ? p : Object.values(p ?? {}).length ? Object.values(p) : [p]);

/**
 * Tapping an option: with one right answer it's chosen; with several it toggles, and once as many are chosen as
 * are right, the next tap swaps out the earliest.
 */
function toggle(i) {
  const need = rightCount(question());
  if (need === 1) pick = [i];
  else if (pick.includes(i)) pick = pick.filter(x => x !== i);
  else pick = [...pick, i].slice(-need);
  render();
}

// ---------- betting ----------
/** Applies a change to the session: the solo save, or the room in one transaction. */
function change(fn) {
  if (together.room) return together.act(g => { g.bets ||= {}; g.log = Object.values(g.log || {}); return fn(g); });
  if (fn(S) === false) return Promise.resolve(false);
  saveSolo();
  render();
  return Promise.resolve(true);
}

/** Once everyone at the table has bet or passed: pay out, and show what happened. */
function settleIfReady(g, ids) {
  if (!ids.every(id => g.bets[id])) return;
  const q = g.questions[g.index];
  let total = 0;
  const bets = {};
  for (const id of ids) {
    const { pct: share } = g.bets[id], p = picksOf(g.bets[id].pick);
    const { stake, change: c } = p == null || !share ? { stake: 0, change: 0 } : settle(g.pot, share, pickedRight(q, p), q.offered);
    bets[id] = { pick: p, pct: share, stake, change: c };
    total += c;
  }
  g.log.push({ index: g.index, pot: g.pot, bets, change: total });
  g.pot = Math.max(0, g.pot + total);
  g.phase = "reveal";
  g.bets = {};
}

function place(passing) {
  if (S.done || S.phase !== "bet") return;
  const need = rightCount(question());
  if (!passing && (pick.length !== need || pct <= 0)) {
    toast(pick.length !== need ? (need > 1 ? `Pick all ${need} right answers` : "Pick an option first") : "Set a stake, or pass");
    return;
  }
  const chosen = pick.length === need ? [...pick].sort((a, b) => a - b) : null;
  const bet = passing ? { pick: chosen, pct: 0 } : { pick: chosen, pct: Math.min(pct, maxPct()) };
  const id = me(), index = S.index;
  change(g => {
    if (g.done || g.phase !== "bet" || g.index !== index) return false;
    g.bets[id] = bet;
    settleIfReady(g, together.room ? seatsOf(g).map(([x]) => x) : [ME]);
  });
}

async function next() {
  const index = S.index;
  const deal = isMaths(S.level) && lengthOf(S) === "endless" ? (await bankDeal(S.level, S.maths || chosenPicks(S.level))).deal : null;
  change(g => {
    if (g.phase !== "reveal" || g.index !== index) return false;
    g.questions = Object.values(g.questions);
    if (g.pot <= 0 || (lengthOf(g) !== "endless" && g.index + 1 >= g.questions.length)) { g.done = { at: Date.now() }; return; }
    if (g.index + 1 >= g.questions.length) g.questions = g.questions.concat(moreQuestions(g.seed, g.level, g.questions, deal));
    g.index++;
    g.phase = "bet";
  }).then(() => resetChoice());
}

// ---------- rendering ----------
function render() {
  if (!S) return;
  $("level").value = S.level;
  drawPartner();
  const q = question() || S.questions[S.questions.length - 1];
  const last = S.log[S.log.length - 1];
  const reveal = S.phase === "reveal" || S.done;
  $("progress").textContent = lengthOf(S) === "endless" ? `Question ${S.index + 1}` : `Question ${Math.min(S.index + 1, S.questions.length)} of ${S.questions.length}`;
  const avg = averageReturn(S.log);
  $("avg").hidden = avg === null;
  if (avg !== null) $("avg").textContent = `Average ${showReturn(avg)} a question over ${S.log.length}`;
  const pot = $("pot");
  pot.textContent = showChips(S.pot);
  pot.className = reveal && last ? (last.change > 0 ? "up" : last.change < 0 ? "down" : "") : "";

  $("ask").textContent = q.ask;
  setRich($("prompt"), q.prompt);
  $("figure").hidden = !q.svg;
  if (q.svg) $("figure").innerHTML = q.svg;                       // a drawing from the bank, for patterns
  $("code").hidden = !q.code;
  if (q.code) $("code").textContent = q.code;                 // a snippet to read, for the code bank
  const pic = $("picture");
  if (q.pic) { if (pic.dataset.title !== q.pic) { pic.dataset.title = q.pic; showPicture(pic, q.pic, { alt: "" }); } }
  else { pic.hidden = true; pic.dataset.title = ""; }
  $("prompt").classList.toggle("long", q.prompt.length > 30);
  drawMathsBar();
  const need = rightCount(q);
  $("need").hidden = need === 1;
  $("need").textContent = need === 2 ? "Two of these are right: pick both." : `${need} of these are right: pick all ${need}.`;
  const chosen = reveal ? picksOf(last?.bets[me()]?.pick) || [] : pick;
  const anyonePicked = i => Object.values(last?.bets || {}).some(x => picksOf(x.pick)?.includes(i));
  $("options").replaceChildren(...q.options.map((o, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pt-option${o.label.length > 18 ? " long" : ""}`;
    b.setAttribute("role", need > 1 ? "checkbox" : "radio");
    b.setAttribute("aria-checked", String(chosen.includes(i)));
    setRich(b, o.label);
    if (reveal) {
      b.disabled = true;
      if (o.right) b.classList.add("right");
      else if (anyonePicked(i)) b.classList.add("wrong");
    } else b.addEventListener("click", () => toggle(i));
    return b;
  }));

  const waiting = !reveal && !!S.bets?.[me()];
  $("options").setAttribute("role", need > 1 ? "group" : "radiogroup");
  $("betting").hidden = reveal;
  $("result").hidden = !reveal;
  if (!reveal) drawBetting(q, waiting);
  else drawResult(q, last);
  if (reveal) fileLatest();
  if (S.done && JSON.stringify(S.done) !== shownDone) { shownDone = JSON.stringify(S.done); showDone(); }
}

function drawBetting(q, waiting) {
  $("odds").textContent = showOdds(q.offered);
  const slider = $("stake");
  slider.max = maxPct();
  slider.value = pct;
  slider.disabled = waiting;
  const stake = Math.floor(S.pot * pct / 100);
  $("stakeLine").innerHTML = "";
  if (waiting) $("stakeLine").append(`Your bet is in. Waiting for ${partnerName()}.`);
  else if (stake > 0) {
    const s = document.createElement("b"), w = document.createElement("b");
    s.textContent = showChips(stake); w.textContent = showChips(Math.round(stake * q.offered));
    $("stakeLine").append(`Stake `, s, ` (${pct}%) returns `, w, " if right");
  } else $("stakeLine").append(together.room ? "Stake up to half the shared pot, or pass." : "Choose a stake, or pass.");
  $("chips").replaceChildren(...[0, 5, 10, 25, 50, 100].filter(x => x <= maxPct()).map(x => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.disabled = waiting;
    b.textContent = x === maxPct() ? (together.room ? "Half" : "All in") : `${x}%`;
    b.addEventListener("click", () => { pct = x; render(); });
    return b;
  }));
  $("passBtn").disabled = waiting;
  $("betBtn").disabled = waiting || pick.length !== rightCount(q) || pct <= 0;
  $("betBtn").textContent = stake > 0 ? `Bet ${showChips(stake)}` : "Bet";
}

function drawResult(q, last) {
  const v = $("verdict");
  if (!last) { v.textContent = ""; return; }
  const mine = last.bets[me()];
  v.className = "pt-verdict" + (last.change > 0 ? " won" : last.change < 0 ? " lost" : "");
  const signed = n => `${n > 0 ? "+" : n < 0 ? "−" : ""}${showChips(Math.abs(n))}`;
  if (together.room) {
    const parts = Object.entries(last.bets).map(([id, b]) => `${id === me() ? "You" : nameOf(id)} ${!b.pct ? "passed" : `${signed(b.change)}`}`);
    v.textContent = `${parts.join(", ")}. Pot ${signed(last.change)}.`;
  } else if (!mine || !mine.pct) {
    const would = mine?.pick ? pickedRight(q, picksOf(mine.pick)) : null;
    v.textContent = would == null ? "Passed." : would ? "Passed: your pick was right." : "Passed: your pick was wrong.";
  }
  else v.textContent = mine.change > 0 ? `Right! ${signed(mine.change)}` : `Wrong. ${signed(mine.change)}`;
  $("notes").replaceChildren(...q.notes.map(n => {
    const li = document.createElement("li"), b = document.createElement("b"), t = document.createElement("span");
    setRich(b, n.label);
    setRich(t, `: ${n.text}`);
    li.append(b, t);
    return li;
  }));
  const verdict = q.offered > q.fair ? "more than it was worth" : q.offered < q.fair ? "less than it was worth" : "about what it was worth";
  $("house").textContent = `The house put a typical player's chance at ${Math.round(q.chance * 100)}%, a fair price of ${showOdds(q.fair)}. It paid ${showOdds(q.offered)}: ${verdict}.`;
  drawFlag(q);
  $("nextBtn").hidden = !!S.done;
  $("nextBtn").textContent = S.pot <= 0 || (lengthOf(S) !== "endless" && S.index + 1 >= S.questions.length) ? "See how you did" : "Next question";
}

function showDone() {
  const bets = S.log.flatMap(r => Object.entries(r.bets).filter(([id, b]) => id === me() && b.pct > 0).map(([, b]) => b));
  const won = bets.filter(b => b.change > 0).length;
  $("doneTitle").textContent = S.pot <= 0 ? "Bust" : S.pot > START_POT ? "Up on the house" : S.pot < START_POT ? "Down on the day" : "Level";
  const avg = averageReturn(S.log) ?? 0;
  const stats = [["Final pot", showChips(S.pot)], ["A question", showReturn(avg)], ["Bets won", `${won} of ${bets.length}`]];
  const best = recordBest(avg);
  $("doneStats").replaceChildren(...stats.map(([label, value]) => {
    const box = document.createElement("div"), dd = document.createElement("dd"), dt = document.createElement("dt");
    dd.textContent = value; dt.textContent = label;
    box.append(dd, dt);
    return box;
  }));
  const passes = S.log.filter(r => !r.bets[me()]?.pct).length;
  const what = `${LEVELS[S.level].label}, ${LENGTHS[lengthOf(S)].label.toLowerCase()}`;
  $("doneNote").textContent = `${S.log.length} question${S.log.length === 1 ? "" : "s"}, ${passes} pass${passes === 1 ? "" : "es"}. ` +
    `Your best average on ${what}: ${showReturn(best)} a question. The same run for anyone with the link: ` +
    `${location.origin}${location.pathname}${linkOf(S)}`;
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

/** Keeps the best average return per question for each level and length (runs of at least ten questions). */
function recordBest(avg) {
  const key = `${S.level}/${lengthOf(S)}`;
  let all = {};
  try { all = JSON.parse(localStorage.getItem(BEST)) || {}; } catch { /* private mode */ }
  if (S.log.length >= 10 && (all[key] == null || avg > all[key])) {
    all[key] = avg;
    try { localStorage.setItem(BEST, JSON.stringify(all)); } catch { /* private mode */ }
  }
  return all[key] ?? avg;
}

// ---------- flags: questions you disagree with ----------
const REASONS = ["A right answer is marked wrong", "A wrong answer is marked right", "The clue is unclear or misleading", "Something else"];
const flagKey = q => `${q.key}|${q.prompt}`;
function drawFlag(q) {
  const done = flagged("punt", flagKey(q));
  $("flagBtn").disabled = done;
  $("flagBtn").textContent = done ? "Flagged: thanks" : "Disagree with this answer? Flag it";
}
let flagReason = null;
function openFlag() {
  const q = question();
  flagReason = null;
  $("flagWhat").textContent = `${q.ask} ${q.prompt}: marked right ${q.options.filter(o => o.right).map(o => o.label).join(" and ")}.`;
  $("flagNote").value = "";
  $("flagSend").disabled = true;
  $("flagReasons").replaceChildren(...REASONS.map(r => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", "false");
    b.textContent = r;
    b.addEventListener("click", () => {
      flagReason = r;
      for (const x of $("flagReasons").children) x.setAttribute("aria-checked", String(x === b));
      $("flagSend").disabled = false;
    });
    return b;
  }));
  $("flagDlg").showModal();
}
function sendFlag() {
  const q = question(), last = S.log[S.log.length - 1], mine = last?.bets[me()];
  const picked = (picksOf(mine?.pick) || []).map(i => q.options[i]?.label).filter(Boolean);
  fileFlag("punt", {
    key: flagKey(q), level: LEVELS[S.level].label, seed: S.seed, index: S.index, kind: q.kind, ask: q.ask, prompt: q.prompt,
    options: q.options.map(o => ({ label: o.label, right: !!o.right })), picked, reason: flagReason, note: $("flagNote").value.trim(),
  });
  $("flagDlg").close();
  drawFlag(q);
  toast(navigator.onLine ? "Flagged" : "Flagged: it'll be sent when you're back online");
}

/** The flagged questions: this device's, and everyone's from the database, with a copy button to hand them over. */
async function openFlags(everyone = false) {
  const body = $("flagsBody");
  body.innerHTML = "";
  const add = (tag, cls, text, parent = body) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; parent.appendChild(n); return n; };
  const tabs = add("div", "pt-lengths pt-tabs");
  for (const [all, label] of [[false, "This device"], [true, "Everyone"]]) {
    const b = add("button", "btn", label, tabs);
    b.type = "button";
    b.setAttribute("aria-pressed", String(everyone === all));
    b.addEventListener("click", () => openFlags(all));
  }
  if (!$("flagsDlg").open) $("flagsDlg").showModal();
  let list = localFlags("punt");
  if (everyone) {
    const wait = add("p", "stats", navigator.onLine ? "Loading…" : "Everyone's flags need a connection.");
    if (!navigator.onLine) return;
    try { list = await allFlags("punt"); wait.remove(); }
    catch { wait.textContent = "Couldn't load them (no connection, or the database doesn't accept flags yet: see the README)."; return; }
  }
  const unsent = list.filter(f => f.sent === false).length;
  add("p", "stats", list.length ? `${list.length} flagged${unsent ? `, ${unsent} waiting to be sent` : ""}.` : "Nothing flagged yet. After a question, tap \"Disagree with this answer?\" to flag it.");
  if (!list.length) return;
  const copy = add("button", "btn primary wide", "Copy them as text");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(flagsAsText("Punt", list)); toast("Copied: paste them to Claude"); }
    catch { toast("Couldn't copy here"); }
  });
  const ul = add("ul", "pt-flaglist");
  for (const f of [...list].reverse()) {
    const li = add("li", null, null, ul);
    add("b", null, `${f.ask} ${f.prompt}`, li);
    add("div", null, `${f.reason}${f.note ? `: ${f.note}` : ""}`, li);
    add("small", null, `${new Date(f.at).toLocaleDateString()}${f.sent === false ? ", waiting to be sent" : ""}`, li);
  }
}

// ---------- the stage and difficulty pickers, for any bank ----------
let picking = null;    // the choice being made in the sheet
async function drawMathsBar() {
  const bar = $("mathsBar");
  bar.hidden = !isMaths(S.level);
  if (bar.hidden) return;
  const { STAGES } = await loadBank(S.level);
  const m = S.maths || (await bankDeal(S.level, chosenPicks(S.level))).picks, labels = Object.fromEntries(STAGES.map(x => [x.id, x.label]));
  $("stagesBtn").textContent = m.stages.length === STAGES.length ? "All stages" : m.stages.map(x => labels[x]).join(", ");
  $("diffsBtn").textContent = m.diffs.length === 10 ? "Difficulty 1–10" : `Difficulty ${runs(m.diffs)}`;
}
/** 1, 2, 3, 5, 8, 9 → "1–3, 5, 8–9". */
function runs(nums) {
  const out = [];
  for (const n of [...nums].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
}
async function openMathsPicks() {
  const { STAGES, MATHS } = await loadBank(S.level);
  const current = S.maths || (await bankDeal(S.level, chosenPicks(S.level))).picks;
  picking = { stages: [...current.stages], diffs: [...current.diffs] };
  $("mathsTitle").textContent = `${LEVELS[S.level].label} questions`;
  $("mathsNote").textContent = LEVELS[S.level].note;
  const chip = (parent, text, on, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = text; b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", () => { fn(); draw(); });
    parent.appendChild(b);
  };
  const draw = () => {
    $("stagePicks").replaceChildren();
    for (const x of STAGES) chip($("stagePicks"), x.label, picking.stages.includes(x.id), () => {
      picking.stages = picking.stages.includes(x.id) ? picking.stages.filter(y => y !== x.id) : [...picking.stages, x.id];
    });
    $("diffPicks").replaceChildren();
    for (const d of DIFFICULTIES) chip($("diffPicks"), String(d), picking.diffs.includes(d), () => {
      picking.diffs = picking.diffs.includes(d) ? picking.diffs.filter(y => y !== d) : [...picking.diffs, d];
    });
    const n = MATHS.filter(q => picking.stages.includes(q.lv) && picking.diffs.includes(q.d)).length;
    $("mathsCount").textContent = n ? `${n} questions match.` : "Nothing matches that: pick more stages or difficulties.";
    $("mathsGo").disabled = !n;
  };
  draw();
  if (!$("mathsDlg").open) $("mathsDlg").showModal();
}
async function applyMathsPicks() {
  const { STAGES } = await loadBank(S.level);
  const choice = { stages: STAGES.map(x => x.id).filter(x => picking.stages.includes(x)), diffs: [...picking.diffs].sort((a, b) => a - b) };
  try { localStorage.setItem(picksKey(S.level), JSON.stringify(choice)); } catch { /* private mode */ }
  $("mathsDlg").close();
  newSession(S.level, lengthOf(S), choice);
}

// ---------- stats ----------
/** This run's settled questions, as records for knowledgeStats. */
function runRecords() {
  return S.log.map(r => {
    const b = r.bets[me()], q = S.questions[r.index];
    if (!b || !q) return null;
    const p = picksOf(b.pick);
    return { o: q.offered, f: (b.pct || 0) / 100, r: p ? (pickedRight(q, p) ? 1 : 0) : null };
  }).filter(Boolean);
}
/** Every question settled on this device, kept for the all-runs view (the most recent 5,000). */
function allRecords() { try { return JSON.parse(localStorage.getItem(RECORDS)) || []; } catch { return []; } }
/** Files the latest settled question once (each is keyed by run and question). */
function fileLatest() {
  const last = S.log[S.log.length - 1];
  if (!last) return;
  const key = `${S.seed}/${S.level}/${lengthOf(S)}/${last.index}`;
  const all = allRecords();
  if (all.some(x => x.key === key)) return;
  bankLatest(last);
  const rec = runRecords().slice(-1)[0];
  if (!rec) return;
  all.push({ ...rec, key, lv: S.level, n: lengthOf(S) });
  try { localStorage.setItem(RECORDS, JSON.stringify(all.slice(-5000))); } catch { /* private mode */ }
}

/** The pile: a wrong answer, a pass, or a stake of 20% or less banks the question; a confident right answer moves a banked one up. */
function bankLatest(last) {
  const q = S.questions[last.index], mine = last.bets[me()];
  if (!q || !mine || !q.key) return;
  const right = mine.pick ? pickedRight(q, picksOf(mine.pick)) : null;
  const key = `${S.level}/${q.key}`;
  const payload = { prompt: q.prompt, ask: q.ask, options: q.options.map(o => o.label), right: q.options.map((o, i) => (o.right ? i : -1)).filter(i => i >= 0), need: rightCount(q), note: q.notes?.[0] ? `${q.notes[0].label}: ${q.notes[0].text}` : "", svg: q.svg || null, pic: q.pic || null, code: q.code || null, level: S.level };
  if (!mine.pct) pile.record("punt", key, payload, "pass");
  else if (!right) pile.record("punt", key, payload, "wrong");
  else if (mine.pct <= 20) pile.record("punt", key, payload, "lowStake");
  else if (pile.has("punt", key)) pile.answer("punt", key, true);
}

const pctText = x => (x == null ? "–" : `${Math.round(x * 100)}%`);
function openStats(scope = "run") {
  const recs = scope === "run" ? runRecords() : allRecords().filter(x => x.lv === S.level);
  const st = knowledgeStats(recs);
  const body = $("statsBody");
  body.innerHTML = "";
  const add = (tag, cls, text, parent = body) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; parent.appendChild(n); return n; };
  const tabs = add("div", "pt-lengths pt-tabs");
  for (const [id, label] of [["run", "This run"], ["all", `All ${LEVELS[S.level].label} runs`]]) {
    const b = add("button", "btn", label, tabs);
    b.type = "button";
    b.setAttribute("aria-pressed", String(scope === id));
    b.addEventListener("click", () => openStats(id));
  }
  if (!st.bets) { add("p", "stats", "No bets settled yet: stats appear once you've staked on a few questions."); if (!$("statsDlg").open) $("statsDlg").showModal(); return; }

  add("h3", null, "Expected outcome");
  add("p", "stats", "What your picks earn per chip, ignoring compounding: the view that matters over a fixed run.");
  const grid = add("dl", "pt-stats");
  for (const [label, value] of [["Bets right", `${st.right} of ${st.bets}`], ["Edge a bet", showReturn(st.edge)], ["On staked chips", showReturn(st.roi)]]) {
    const box = add("div", null, null, grid), dd = add("dd", null, value, box);
    add("dt", null, label, box);
    void dd;
  }
  add("p", "stats", `You were right on ${pctText(st.hitRate)} of your bets; their prices needed ${pctText(st.needed)} to break even. ` +
    `Edge a bet is what each chip would have earned at equal stakes (${showReturn(st.edge)}); on staked chips is what your actual stakes earned (${showReturn(st.roi)}).` +
    (st.passPicks ? ` On passes where you'd picked, you'd have been right ${st.passRight} of ${st.passPicks}.` : ""));

  add("h3", null, "Kelly");
  add("p", "stats", "How big you bet against how often bets that size came off. Kelly is the stake that grows a pot fastest in the long run, so this is the view for endless runs.");
  const table = add("table", "pt-kelly");
  const head = add("tr", null, null, add("thead", null, null, table));
  for (const h of ["You staked", "Bets", "Right", "Kelly says"]) add("th", null, h, head);
  const tb = add("tbody", null, null, table);
  for (const b of st.bands) {
    const tr = add("tr", null, null, tb);
    add("td", null, b.label, tr);
    add("td", null, String(b.n), tr);
    add("td", null, b.n ? pctText(b.hit) : "–", tr);
    add("td", null, b.n ? (b.kelly > 0 ? pctText(b.kelly) : "pass") : "–", tr);
  }
  const verdict = st.sizing == null ? "Kelly would pass on bets like yours: at those hit rates and prices there was no edge."
    : st.sizing > 1.4 ? `You staked about ${st.sizing.toFixed(1)}× what Kelly would: over-betting, which risks more than your knowledge earns.`
    : st.sizing < 0.7 ? `You staked about ${st.sizing.toFixed(1)}× what Kelly would: you could back yourself harder when you're this sure.`
    : `You staked about ${st.sizing.toFixed(1)}× what Kelly would: close to the growth-optimal size.`;
  add("p", "stats", `${verdict} Growth a question: yours ${showReturn(st.growth)}, Kelly on your own hit rates ${showReturn(st.kellyGrowth)} (with hindsight). ` +
    `${recs.length < 30 ? "With this few bets the numbers swing a lot; they settle over 100 or more." : ""}`);
  if (!$("statsDlg").open) $("statsDlg").showModal();
}

// ---------- together ----------
function nameOf(id) { return together.room?.data?.players?.[id]?.name || "your partner"; }
function partnerName() { return together.partner()?.name || "your partner"; }
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "";
  if (!together.online) { el.append("Reconnecting… bets made now may not reach your partner."); return; }
  const p = together.partner();
  if (!p) { el.append(`Game ${together.room.code}: waiting for your partner to join.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online ? "" : " (away)");
  if (p.game) {
    const go = document.createElement("a");
    go.href = gameHref(p.game);
    go.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, go);
    return;
  }
  const theirs = Object.keys(S.bets || {}).some(id => id !== me());
  el.append("Sharing a pot with ", b, S.phase === "bet" && theirs ? " (their bet is in)." : ".");
}

async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}

const together = createTogether({
  game: "punt",
  app: APP,
  toast,
  askName,
  valid: g => !!g?.questions,
  fresh: players => freshState(S?.level || "medium", chosenLength(), players),   // a promise: the maths bank may need loading
  onState: val => {
    const moved = !S || S.seed !== val.seed || S.index !== val.index || S.phase !== val.phase;
    S = { ...val, questions: Object.values(val.questions || {}), bets: val.bets || {}, log: Object.values(val.log || {}) };
    if (moved) resetChoice();
    if (moved && !val.done) shownDone = null;
    render();
  },
  onPresence: () => drawPartner(),
  onLeave: () => { S = loadSolo(); if (!S) { soloSession(randomSeed(), "easy"); return; } resetChoice(); render(); },
});

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function openMenu() { drawMenu(); if (!$("menuDlg").open) $("menuDlg").showModal(); }
function drawMenu() {
  const body = $("menuBody");
  body.innerHTML = "";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  const learn = add("button", "btn wide", `Learning mode: ${pile.learning() ? "on" : "off"}`);
  learn.type = "button";
  learn.addEventListener("click", () => { pile.setLearning(!pile.learning()); drawMenu(); });
  add("p", "stats", `What you miss, pass or stake 20% or less on goes to the pile and leads your next blocks until you know it (${pile.counts("punt").due} due here now). Deck, on the games screen, reviews everything due across the games.`);
  add("h3", null, "Run length");
  const lengths = add("div", "pt-lengths");
  for (const [id, L] of Object.entries(LENGTHS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = id === "standard" ? `Standard (${LEVELS[S.level].questions})` : id === "hundred" ? "100" : L.label;
    b.setAttribute("aria-pressed", String(lengthOf(S) === id));
    b.addEventListener("click", () => { $("menuDlg").close(); newSession(S.level, id); });
    lengths.appendChild(b);
  }
  button("New run", () => newSession(S.level, lengthOf(S)));
  if (lengthOf(S) === "endless" && !S.done && S.log.length) button("End this run", endRun);
  button("Your stats", () => openStats("run"));
  button("Flagged questions", () => openFlags(false));
  const room = together.room;
  if (!room) {
    button("Play together", async () => { if (await together.start()) openMenu(); });
    const row = add("form", "join-run");
    const input = document.createElement("input");
    input.placeholder = "Code"; input.maxLength = 4; input.autocapitalize = "characters";
    const go = document.createElement("button");
    go.className = "btn"; go.type = "submit"; go.textContent = "Join";
    row.append(input, go);
    row.addEventListener("submit", e => {
      e.preventDefault();
      const code = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (code.length === 4) { $("menuDlg").close(); together.join(code); }
    });
    button("Copy a link to this session", async () => {
      try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast(location.href, 6000); }
    }, "link");
  } else {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    add("h3", null, `Game ${room.code}`);
    add("p", "stats", "Send this link to your partner: you share one pot, and each of you stakes up to half of it on your own pick. Switching games (tap the title) keeps you both in this room, and each game's progress is kept.");
    add("p", "room-link", link);
    button("Copy link", async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); } });
    button("Leave the room", () => together.leave(), "link");
  }
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "punt");
document.querySelector(".pt-mark").innerHTML = APPS.find(a => a.id === "punt").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("statsClose").addEventListener("click", () => $("statsDlg").close());
$("flagBtn").addEventListener("click", openFlag);
$("flagClose").addEventListener("click", () => $("flagDlg").close());
$("flagSend").addEventListener("click", sendFlag);
$("flagsClose").addEventListener("click", () => $("flagsDlg").close());
sendFlags();                     // anything flagged offline goes now
$("doneStatsBtn").addEventListener("click", () => { $("doneDlg").close(); openStats("run"); });
$("doneNew").addEventListener("click", () => { $("doneDlg").close(); newSession(S.level, lengthOf(S)); });
$("level").addEventListener("change", e => newSession(e.target.value, lengthOf(S)));
$("stagesBtn").addEventListener("click", openMathsPicks);
$("diffsBtn").addEventListener("click", openMathsPicks);
$("mathsClose").addEventListener("click", () => $("mathsDlg").close());
$("mathsGo").addEventListener("click", applyMathsPicks);
$("stake").addEventListener("input", e => { pct = Number(e.target.value); render(); });
$("passBtn").addEventListener("click", () => place(true));
$("betBtn").addEventListener("click", () => place(false));
$("nextBtn").addEventListener("click", next);
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
window.addEventListener("hashchange", () => {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("s")), level = h.get("d");
  const length = LENGTHS[h.get("n")] ? h.get("n") : "standard";
  if (!together.room && seed && LEVELS[level] && !(S && S.seed === seed && S.level === level && lengthOf(S) === length)) soloSession(seed, level, length, isMaths(level) ? picksFromHash(h, level) : null);
});

// for tests and debugging
window.__punt = { get state() { return S; }, get together() { return together; } };

// start: a shared session (#s=…&d=…), the saved one, or a fresh Easy session for a first visit
const hash = new URLSearchParams(location.hash.slice(1));
const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
S = loadSolo();
const linked = Number(hash.get("s")), linkedLevel = hash.get("d"), linkedLength = LENGTHS[hash.get("n")] ? hash.get("n") : "standard";
if (linked && LEVELS[linkedLevel] && !(S && S.seed === linked && S.level === linkedLevel && lengthOf(S) === linkedLength)) soloSession(linked, linkedLevel, linkedLength, isMaths(linkedLevel) ? picksFromHash(hash, linkedLevel) : null);
else if (!S) soloSession(randomSeed(), "easy", "standard");
else {
  shownDone = S.done ? JSON.stringify(S.done) : null;
  history.replaceState(null, "", `${location.search}${linkOf(S)}`);
  render();
}
if (code.length === 4) together.join(code);
