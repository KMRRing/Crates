// Punt: pick an option, stake a share of the pot (every bet pays 2×), or pass (rules in punt-gen.js).
// Solo sessions are saved in this browser. At a table (a pair's match, or a party of up to six) everyone gets the
// same question and stakes on their own phone: Against, each on a pot of their own; Together, on one pot for the
// table. A question settles once everyone at the table has staked, and the reveal shows what each did and where
// everyone stands (punt-table.js has the rules of the table).
import { makeSession, moreQuestions, rightCount, averageReturn, showReturn, knowledgeStats, guessChance, LEVELS, LENGTHS, START_POT, NAME_MODES, ODDS, showChips, mixQuestions, TOPIC_LIST, TOPIC_PRESETS, CLUE_TOPICS, MIX, BATCH } from "./punt-gen.js";
import { picksOf, judged, lengthOf, logOf, settleRound, advance, runOver, stake as stakeAt, pressNext, goOn, carryOn, waitingFor, goOnAt, presentIds, seatedIds, potOf, isBust, maxShare, modeOf, MODES, peopleFor, standingsAfter, resultFor, averageFor } from "./punt-table.js";
import { createTogether } from "./together.js";
import { leaderboard, signed } from "./standings.js";
import { busy, sextant } from "./loading.js";
import * as pile from "./pile.js";
import { noteStake } from "./ledger-log.js";
import { setRich } from "./rich.js";
import { showPicture, askedWith } from "./pics.js";
import { bindSwitcher, APPS } from "./apps.js";
import { dropdown } from "./dropdown.js";
import "./pwa.js";
import { check } from "./typing.js";
import * as known from "./known.js";
import { fileFlag, flagged, localFlags, sendFlags, allFlags, flagsAsText } from "./question-flags.js";
import { gameHref, GAMES, joiningWords } from "./rooms.js";
import { part, choice, action, mirror, line, weights, ticks } from "./menu.js";
import { today, noteComparable, arrivedForToday } from "./suite.js";   // the day, the same for everyone; comparable results
import { roundOver } from "./random.js";

const $ = id => document.getElementById(id);
const STORE = "punt:solo", LENGTH = "punt:length", BEST = "punt:best", RECORDS = "punt:records", MATHS_PICKS = "punt:maths";
const APP = 2;                                     // 2: tables of up to six, Against or Together
const ME = "me";                                   // the solo player's seat
const randomSeed = () => Math.floor(Math.random() * 1e9);

// S: { seed, level, length, questions, index, pot, phase: "bet" | "reveal", bets: { id: { pick, pct } }, log: [result], done }
// A pick is a list of option indices (all of the right ones, when several are), or null for a pass.
// a result: { index, pot (before), bets, change }. At a table, S is the room's branch (punt-table.js).
let S = null;
let pick = [];        // the options chosen on this device for the current question
let typed = "";       // or, for a name-it question with typing on, the answer typed
let pct = 0;          // the stake chosen on this device, as a share of the pot
let shownDone = null;
let offset = 0;       // at a table: this device's distance from the database's clock, which stakes are timed by

const me = () => (together.room ? together.room.uid : ME);
const maxPct = () => (together.room ? maxShare(S) : 100);
/** This player's pot: at a table Against, their own; otherwise the one pot. */
const myPot = () => (together.room ? potOf(S, me()) : S.pot);
const question = () => S.questions[S.index];
const now = () => Date.now() + offset;
/** Who's at the table now (this device always): the others with Punt open on a device that's online. Until the room
 *  has said who's where (a moment after sitting down) everyone seated counts, so nobody is gone on without unseen. */
const here = () => {
  if (!together.room) return [ME];
  const where = together.room.here;
  return where?.[together.room.uid] ? presentIds(S, where, me()) : seatedIds(S);
};

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
async function bankDeal(level, picks, personal = true) {
  const { MATHS, STAGES } = await loadBank(level);
  const ids = STAGES.map(x => x.id);
  const stages = (picks.stages || ids).filter(x => ids.includes(x));
  const resolved = { stages: stages.length ? stages : ids, diffs: picks.diffs?.length ? picks.diffs.filter(d => DIFFICULTIES.includes(d)) : DIFFICULTIES };
  const pool = MATHS.filter(q => resolved.stages.includes(q.lv) && resolved.diffs.includes(q.d));
  // learning mode: what's due from the pile leads the next block; the rest prefers questions not yet seen (never in
  // today's run, which is the same for everyone)
  const learning = personal && pile.learning();
  // its own due questions, then its questions about what the other games found you weak on (up to a third of a block)
  const ownDue = learning ? pile.picks("punt").map(it => it.key).filter(k => k.startsWith(`${level}/`)).map(k => k.slice(level.length + 1)) : [];
  const dueKeys = learning ? pile.dealDue("punt", pool.map(q => ({ key: q.id, about: q.about })), ownDue, ownDue.length + 5) : [];
  const seenKeys = learning ? new Set(pile.all("punt").map(it => it.key).filter(k => k.startsWith(`${level}/`)).map(k => k.slice(level.length + 1))) : new Set();
  return { deal: { pool, stages: Object.fromEntries(STAGES.map(x => [x.id, x.label])), dueKeys, seenKeys }, picks: resolved };
}
// ---------- topics: a run mixes the topics in (each in, or more), on one difficulty range ----------
const TOPICS_KEY = "punt:topics", DIFFS_KEY = "punt:diffs";
/** The topics chosen: { preset, weights: { topic: 0 | 1 | 2 } } (Balanced to start). */
function chosenTopics() {
  try {
    const t = JSON.parse(localStorage.getItem(TOPICS_KEY));
    // a preset is taken as it stands now (a topic added since, or a preset rebalanced, reaches those who chose it);
    // weights set by hand are kept as they were
    if (t?.preset && TOPIC_PRESETS[t.preset]) return { ...t, weights: { ...TOPIC_PRESETS[t.preset].topics } };
    if (t?.weights) return t;
  } catch { /* first time */ }
  return { preset: "balanced", weights: { ...TOPIC_PRESETS.balanced.topics } };
}
const keepTopics = t => { try { localStorage.setItem(TOPICS_KEY, JSON.stringify(t)); } catch { /* private mode */ } };
/** The difficulties chosen (1–10), for every topic. */
function chosenDiffs() {
  try { const d = JSON.parse(localStorage.getItem(DIFFS_KEY)); if (Array.isArray(d) && d.length) return d.filter(x => DIFFICULTIES.includes(x)); } catch { /* first time */ }
  return [...DIFFICULTIES];
}
const keepDiffs = d => { try { localStorage.setItem(DIFFS_KEY, JSON.stringify(d)); } catch { /* private mode */ } };
/** What each topic in deals from: a clue topic its category, a subject bank its deal (its stages, the difficulties). */
async function topicSources(mixPicks, personal = true) {
  const ins = TOPIC_LIST.filter(([id]) => (mixPicks.weights[id] || 0) > 0);
  return Promise.all(ins.map(async ([id, label]) => {
    const weight = mixPicks.weights[id];
    if (CLUE_TOPICS[id]) return { id, label, weight, cat: CLUE_TOPICS[id], diffs: mixPicks.diffs };
    const { deal } = await bankDeal(id, { stages: personal ? chosenPicks(id).stages : null, diffs: mixPicks.diffs }, personal);
    return { id, label, weight, ...deal };
  }));
}
const mixNow = () => ({ weights: chosenTopics().weights, diffs: chosenDiffs() });
/** A mixed run's questions: a fixed length in one batch, an endless run's first block. */
async function mixSession(seed, length, mixPicks, { personal = true, name = nameDeal() } = {}) {
  const count = length === "endless" ? BATCH : LENGTHS[length]?.questions ?? MIX.questions;
  return mixQuestions(seed, await topicSources(mixPicks, personal), count, [], name);
}
// ---------- what counts: today's run and Standard ----------
// Your best (the games screen's, the one your partner sees) counts only runs anyone could have played: today's run,
// dealt from the date on the Standard settings with nothing of yours in it, and any run you set up on those settings
// with learning off. Standard: the Balanced topics, every difficulty, the standard length, and name-it off (Known
// deals from your own history).
// a run that counts for your best: today's, or a mix on one of the presets (Balanced, Trader, Culture night) with every
// difficulty in, at any length
const onPreset = (level, picks) => level === "mix" && !!TOPIC_PRESETS[picks?.preset] && (!picks.diffs || DIFFICULTIES.every(d => picks.diffs.includes(d)));
const standardPicks = () => ({ weights: { ...TOPIC_PRESETS.balanced.topics }, diffs: [...DIFFICULTIES] });
const isStandard = (level, length, picks) => level === "mix" && length === "standard" && !pile.learning() && nameMode() === "off"
  && TOPIC_LIST.every(([id]) => (picks?.weights?.[id] || 0) === 1) && DIFFICULTIES.every(d => picks?.diffs?.includes(d));

/** A run's link: today's run by its date; else seed, level, length, and for a bank its stages and difficulties. */
function linkOf(s) {
  if (s.daily) return `#day=${s.seed}`;
  const n = lengthOf(s) === "standard" ? "" : `&n=${lengthOf(s)}`;
  const m = isMaths(s.level) && s.maths ? `&st=${s.maths.stages.join(",")}&df=${s.maths.diffs.join(",")}`
    : s.level === "mix" && s.mix ? `&t=${Object.entries(s.mix.weights).filter(([, w]) => w > 0).map(([k, w]) => `${k}.${w}`).join(",")}&df=${s.mix.diffs.join(",")}` : "";
  return `#s=${s.seed}&d=${s.level}${n}${m}`;
}
/** The choice a link carries, if any (st = stages, df = difficulties; for topics t = topic.weight list), else the chosen one. */
function picksFromHash(h, level) {
  if (level === "mix") {
    const weights = Object.fromEntries((h.get("t") || "").split(",").map(x => x.split(".")).filter(([k, w]) => TOPIC_LIST.some(([t]) => t === k) && Number(w) > 0).map(([k, w]) => [k, Number(w)]));
    const diffs = (h.get("df") || "").split(",").map(Number).filter(d => DIFFICULTIES.includes(d));
    return Object.keys(weights).length ? { weights, diffs: diffs.length ? diffs : [...DIFFICULTIES] } : mixNow();
  }
  const stages = (h.get("st") || "").split(",").filter(Boolean);
  const diffs = (h.get("df") || "").split(",").map(Number).filter(d => DIFFICULTIES.includes(d));
  return stages.length && diffs.length ? { stages, diffs } : chosenPicks(level);
}

// ---------- sessions ----------
/** The run length chosen last (standard, 100 questions or endless), kept for the next run. */
function chosenLength() { try { const l = localStorage.getItem(LENGTH); return LENGTHS[l] ? l : "standard"; } catch { return "standard"; } }

/** A table's run, dealt on this device from its own topics: table holds the table's own (mode, people), kept as they are. */
async function freshState(level, length, players = null, picks = null, table = {}) {
  const seed = randomSeed();
  if (level === "mix") {
    const mixPicks = picks?.weights ? picks : mixNow();
    return { v: 1, app: APP, seed, level, length, mix: mixPicks, questions: await mixSession(seed, length, mixPicks), index: 0, pot: START_POT, phase: "bet",
      bets: {}, log: [], done: null, created: Date.now(), ...table, ...(players && { players }) };
  }
  const bank = isMaths(level) ? await bankDeal(level, picks || chosenPicks(level)) : null;
  const deal = bank?.deal || null, maths = bank?.picks;
  return { v: 1, app: APP, seed, level, length, ...(deal && { maths }), questions: makeSession(seed, level, length, deal, nameDeal()), index: 0, pot: START_POT, phase: "bet",
    bets: {}, log: [], done: null, created: Date.now(), ...table, ...(players && { players }) };
}
function loadSolo() { try { const s = JSON.parse(localStorage.getItem(STORE)); return s?.questions?.length ? s : null; } catch { return null; } }
function saveSolo() { if (!together.room) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode */ } }

async function soloSession(seed, level, length = chosenLength(), picks = null, daily = false) {
  if (level === "mix") {
    if (daily) length = "standard";
    const mixPicks = daily ? standardPicks() : picks?.weights ? picks : mixNow();
    const questions = await mixSession(seed, length, mixPicks, daily ? { personal: false, name: { mode: "off", known: {} } } : {});
    if (!questions.length) { toast("Put at least one topic in"); render(); return; }
    S = { v: 1, seed, level, length, mix: mixPicks, ...(daily && { daily: true }), ranked: daily || onPreset(level, mixPicks),
      questions, index: 0, pot: START_POT, phase: "bet", bets: {}, log: [], done: null };
    resetChoice(); shownDone = null; saveSolo(); history.replaceState(null, "", linkOf(S)); render();
    return;
  }
  const bank = isMaths(level) ? await bankDeal(level, picks || chosenPicks(level)) : null;
  const deal = bank?.deal || null, maths = bank?.picks;
  if (deal && !deal.pool.length) { toast("No questions match that choice"); render(); return; }
  S = { v: 1, seed, level, length, ...(deal && { maths }), questions: makeSession(seed, level, length, deal, nameDeal()), index: 0, pot: START_POT, phase: "bet", bets: {}, log: [], done: null };
  resetChoice();
  shownDone = null;
  saveSolo();
  history.replaceState(null, "", linkOf(S));
  render();
}

/** Today's run: the date's seed on the Standard settings, nothing of yours dealt in; the same for everyone. Solo only. */
async function newDaily() {
  if (together.room) { toast("Today's run is played alone"); return; }
  if (S && !S.done && S.index > 0 && !confirm("Start today's run? This one isn't finished.")) { render(); return; }
  soloSession(today(), "mix", "standard", null, true);
}
async function newSession(level = S.level, length = chosenLength(), picks = null) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new run? This one isn't finished.")) { render(); return; }
  try { localStorage.setItem(LENGTH, length); } catch { /* private mode */ }
  if (!together.room) { soloSession(randomSeed(), level, length, picks); return; }
  dealTable({ level, length, picks });
}
/** A new run at the table, dealt on this device: every pot back to 1,000 (Play again, New run, the other kind of pot). */
async function dealTable({ level = "mix", length = lengthOf(S), picks = null, mode = modeOf(S) } = {}) {
  const next = await freshState(level, length, null, picks);
  return together.act(g => {
    Object.assign(g, { seed: next.seed, level, length, maths: next.maths || null, mix: next.mix || null, questions: next.questions, mode, index: 0,
      pot: START_POT, pots: null, phase: "bet", bets: {}, next: null, log: [], done: null });
  });
}

/** Ends an endless run where it stands, to see how it went. */
function endRun() {
  if (S.done || !S.log.length) return;
  change(g => { if (g.done) return false; g.done = { at: Date.now(), ended: true }; });
  if (!together.room) roundOver("punt");
}

const resetChoice = () => { pick = []; typed = ""; pct = 0; };
// Name it (Menu, Content): off, known (only clues this device has recognised the other way round, in Crates or Punt;
// the default) or all (every question). A name-it question is typed: the strictest test. One dealt by a partner who
// started the run is typed too, unless this device has name-it off, when it's chosen from options like any other.
const NAME = "punt:name";
const nameMode = () => { try { const m = localStorage.getItem(NAME); return NAME_MODES[m] ? m : "known"; } catch { return "known"; } };
const nameDeal = () => ({ mode: nameMode(), known: known.all() });
const typedNow = q => q?.kind === "name" && nameMode() !== "off";
// the box a name is typed into, kept across redraws so typing isn't interrupted; the phone's own suggestions are off,
// since they would turn recalling the name back into choosing it
const typedInput = Object.assign(document.createElement("input"), { type: "text", className: "pt-typed", placeholder: "Type the name", autocomplete: "off", spellcheck: false });
typedInput.setAttribute("autocorrect", "off");
typedInput.setAttribute("autocapitalize", "off");
typedInput.setAttribute("enterkeyhint", "go");
typedInput.setAttribute("aria-label", "Your answer");
typedInput.addEventListener("input", () => { typed = typedInput.value; drawBetting(question(), !!S.bets?.[me()]); });
typedInput.addEventListener("keydown", e => { if (e.key !== "Enter") return; e.preventDefault(); typedInput.blur(); if (pct > 0 && typed.trim()) place(false); });

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

function place(passing) {
  if (S.done || S.phase !== "bet") return;
  const q = question(), need = rightCount(q), typing = typedNow(q), answered = typing ? !!typed.trim() : pick.length === need;
  // a pass is a bet of 0%: it needs an answer like any other (what you'd have said, and whether it was right, counts)
  if (!answered || (!passing && pct <= 0)) {
    toast(!answered ? (typing ? "Type your answer first" : need > 1 ? `Pick all ${need} right answers` : "Pick an option first") : "Set a stake, or pass at 0%");
    return;
  }
  const share = passing ? 0 : Math.min(pct, maxPct());
  const bet = typing ? { ...(typed.trim() && { typed: typed.trim() }), pct: share }
    : { pick: [...pick].sort((a, b) => a - b), pct: share };
  const id = me(), index = S.index;
  if (!together.room) {
    change(g => {
      if (g.done || g.phase !== "bet" || g.index !== index) return false;
      g.bets[id] = bet;
      settleRound(g, [ME]);
    });
    countIfOver();
    return;
  }
  // at a table it's timed on the database's clock (the slow are gone on without once the others have waited a while)
  const at = here(), when = now();
  together.act(g => g.index === index && stakeAt(g, id, { ...bet, at: when }, at)).then(ok => { if (!ok && S.index === index) toast("The table went on without that stake"); });
}
/** A run's last bet settled (or the pot gone): its average is final, so it counts at once, not when its summary is
 *  opened. An endless run goes on until you stop it, and counts then. */
function countIfOver() {
  if (S.phase !== "reveal" || !(S.pot <= 0 || (lengthOf(S) !== "endless" && S.index + 1 >= S.questions.length))) return;
  const avg = averageReturn(S.log) ?? 0;
  recordBest(avg);
  if (S.ranked) noteComparable("punt", avg, S.daily ? S.seed : null);
  roundOver("punt");
}

/** An endless run's next block, dealt as the last question of the one before is passed (null for a run of a set length). */
async function moreFor(s) {
  if (lengthOf(s) !== "endless") return null;
  if (s.level === "mix") { const sources = await topicSources(s.mix || mixNow()); return g => mixQuestions(g.seed, sources, BATCH, g.questions, nameDeal()); }
  const deal = isMaths(s.level) ? (await bankDeal(s.level, s.maths || chosenPicks(s.level))).deal : null;
  return g => moreQuestions(g.seed, g.level, g.questions, deal, nameDeal());
}
async function next() {
  const index = S.index, more = await moreFor(S);
  if (!together.room) {
    resetChoice();                       // before the next question is drawn, so it doesn't show this one's pick and stake
    change(g => (g.phase === "reveal" && g.index === index ? advance(g, more) : false));
    return;
  }
  const at = here(), when = now();
  together.act(g => g.index === index && pressNext(g, me(), at, when, more));
}
/** Everyone else done, and the slow have had their grace: on without them (their stake is nothing). */
async function goOnWithout() {
  const index = S.index, phase = S.phase, more = phase === "reveal" ? await moreFor(S) : null, at = here(), when = now();
  together.act(g => g.index === index && g.phase === phase && goOn(g, at, when, more));
}
/**
 * Moves the table on when nobody's left to wait for though nobody's own move did it (the last one still to stake left,
 * or their phone slept). A moment after the table or who's here last changed: a phone that has just sat down is seated
 * a moment before it says it's here, and mustn't be gone on without in between.
 */
let carryTimer = 0;
function carryOnSoon() {
  clearTimeout(carryTimer);
  if (!together.room || !S || S.done) return;
  carryTimer = setTimeout(async () => {
    if (!together.room || !S || S.done) return;
    const at = here(), w = waitingFor(S, at);
    if (w.ids.length || w.seats) return;
    const index = S.index, phase = S.phase, more = phase === "reveal" ? await moreFor(S) : null, when = now();
    together.act(g => g.index === index && g.phase === phase && carryOn(g, at, when, more));
  }, 1500);
}

// ---------- rendering ----------
/** The question as asked: about "this" picture, or naming the thing once its picture couldn't be shown (not when the
 *  name is one of the options). */
function drawPrompt(q) {
  const text = askedWith(q.prompt, q.pic, q.title, q.options?.map(o => o.label));
  setRich($("prompt"), text);
  $("prompt").classList.toggle("long", text.length > 30);
}
/** What the last question did to this player's pot: their own, Against; the table's, Together and solo. */
const changeOf = last => (together.room && modeOf(S) === "against" ? last?.bets?.[me()]?.change ?? 0 : last?.change ?? 0);
function render() {
  if (!S) return;
  $("level").value = S.level;
  $("app").classList.toggle("at-table", !!together.room);
  drawPartner();
  const q = question() || S.questions[S.questions.length - 1];
  const last = S.log[S.log.length - 1];
  const reveal = S.phase === "reveal" || S.done;
  $("progress").textContent = lengthOf(S) === "endless" ? `Question ${S.index + 1}` : `Question ${Math.min(S.index + 1, S.questions.length)} of ${S.questions.length}`;
  const avg = together.room && modeOf(S) === "against" ? averageFor(S, me()) : averageReturn(S.log), over = together.room && modeOf(S) === "against" ? S.log.filter(r => r.bets?.[me()]).length : S.log.length;
  $("avg").hidden = avg === null;
  if (avg !== null) $("avg").textContent = `Average ${showReturn(avg)} a question over ${over}`;
  const pot = $("pot");
  pot.textContent = showChips(myPot());
  pot.className = reveal && last ? (changeOf(last) > 0 ? "up" : changeOf(last) < 0 ? "down" : "") : "";

  $("ask").textContent = q.ask;
  drawPrompt(q);
  $("figure").hidden = !q.svg;
  if (q.svg) $("figure").innerHTML = q.svg;                       // a drawing from the bank, for patterns
  $("code").hidden = !q.code;
  if (q.code) $("code").textContent = q.code;                 // a snippet to read, for the code bank
  const pic = $("picture");
  if (!q.pic) { showPicture(pic, null); pic.dataset.title = ""; }
  else if (pic.dataset.title !== q.pic) {
    pic.dataset.title = q.pic;
    // once it shows or can't, the question asks about "this" or names the painting or building: the question showing
    // then, which can be another about the same picture (who painted it, then where it hangs)
    showPicture(pic, q.pic, { alt: "" }).then(shown => {
      const now = S && (question() || S.questions[S.questions.length - 1]);
      if (shown !== null && now?.pic === q.pic) drawPrompt(now);
    });
  }
  drawMathsBar();
  const need = rightCount(q);
  $("need").hidden = need === 1;
  $("need").textContent = need === 2 ? "Two of these are right: pick both." : `${need} of these are right: pick all ${need}.`;
  // at a table, once your stake is in, the options show what you staked on (after a reload too)
  const staked = !reveal && together.room ? S.bets?.[me()] : null;
  const chosen = reveal ? picksOf(last?.bets[me()]?.pick) || [] : staked ? picksOf(staked.pick) || [] : pick;
  const anyonePicked = i => Object.values(last?.bets || {}).some(x => picksOf(x.pick)?.includes(i));
  if (reveal ? last?.bets[me()]?.typed != null || typedNow(q) : typedNow(q)) drawTyped(q, reveal, last);
  else $("options").replaceChildren(...q.options.map((o, i) => {
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
      if (together.room) b.append(pickers(last, i));
    } else b.addEventListener("click", () => toggle(i));
    return b;
  }));

  const waiting = !reveal && !!S.bets?.[me()];
  if (typedNow(q) || (reveal && last?.bets[me()]?.typed != null)) $("options").removeAttribute("role");
  else $("options").setAttribute("role", need > 1 ? "group" : "radiogroup");
  $("betting").hidden = reveal;
  $("result").hidden = !reveal;
  // at the reveal the slip has less room: keep the right answer in sight; a new question starts from the top
  if (reveal) requestAnimationFrame(() => $("options").querySelector(".right")?.scrollIntoView({ block: "nearest" }));
  else if ($("slipBody").dataset.q !== String(S.index)) { $("slipBody").scrollTop = 0; $("slipBody").dataset.q = String(S.index); }
  if (!reveal) drawBetting(q, waiting);
  else drawResult(q, last);
  if (reveal) fileLatest();
  if (S.done && JSON.stringify(S.done) !== shownDone) { shownDone = JSON.stringify(S.done); showDone(); }
  if (together.room) wakeForGrace();
}
/** At the reveal, a dot in each player's colour on the option they picked. */
function pickers(last, i) {
  const box = document.createElement("span");
  box.className = "pt-pickers";
  for (const id of seatedIds(S)) {
    if (!picksOf(last?.bets?.[id]?.pick)?.includes(i)) continue;
    const dot = document.createElement("i"), p = S.players[id];
    dot.style.background = `var(--p${p.slot % 6})`;
    dot.title = id === me() ? "You" : p.name || "Player";
    box.append(dot);
  }
  return box;
}

// ---------- at a table: who it waits for ----------
/** Names as a list: "Tom", "Tom and Ana", "Tom, Ana and Bo"; seats not yet sat in as "1 more player". */
function whoText({ ids, seats }) {
  const names = ids.map(id => (id === me() ? "you" : firstName(id)));
  if (seats) names.push(`${seats} more player${seats === 1 ? "" : "s"}`);
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
/** Who this device is waiting on (the others still to stake or press Next), once its own part is done; else null. */
function waitingOthers() {
  if (!together.room || S.done) return null;
  const mine = S.phase === "reveal" ? !!S.next?.[me()] : !!S.bets?.[me()] || isBust(S, me());
  if (!mine) return null;
  const w = waitingFor(S, here());
  return w.ids.length || w.seats ? w : null;
}
/** Whether the slow have had their grace, so this device may go on without them. */
const graceOver = () => { const at = goOnAt(S, here()); return at != null && now() >= at; };
let graceTimer = 0;
/** Redraws once the slow's grace runs out, so Go on without them appears then. */
function wakeForGrace() {
  clearTimeout(graceTimer);
  const at = waitingOthers() ? goOnAt(S, here()) : null;
  if (at != null && now() < at) graceTimer = setTimeout(render, at - now() + 50);
}
/** The main button while the table waits: Waiting for Tom, then Go on without Tom. */
function waitButton(btn, w) {
  const go = graceOver(), bust = S.phase === "bet" && isBust(S, me());
  btn.disabled = !go;
  btn.textContent = go ? `Go on without ${w.ids.length ? whoText(w) : "them"}` : `${bust ? "Bust · waiting" : "Waiting"} for ${whoText(w)}`;
  btn.dataset.go = go ? "1" : "";
}

/** A name-it question answered by typing: the box to type in; at the reveal, the name, and what was typed if it differs. */
function drawTyped(q, reveal, last) {
  const box = $("options");
  if (!reveal) {
    if (box.firstChild !== typedInput || box.children.length !== 1) box.replaceChildren(typedInput);
    const staked = together.room ? S.bets?.[me()] : null, shown = staked ? staked.typed ?? "" : typed;   // at a table, what you staked on
    if (typedInput.value !== shown) typedInput.value = shown;
    typedInput.disabled = !!S.bets?.[me()];
    return;
  }
  const mine = last?.bets[me()], res = mine?.typed != null ? check(mine.typed, [q.answer]) : null;
  const card = document.createElement("div"), name = document.createElement("b");
  card.className = "pt-typed-result";
  name.textContent = q.answer;
  card.append(name);
  if (res && !res.exact) {
    const you = document.createElement("span");
    you.className = res.right ? "close" : "wrong";
    you.textContent = res.right ? `You typed "${mine.typed}": close enough` : `You typed "${mine.typed}"`;
    card.append(you);
  }
  box.replaceChildren(card);
}
// the most of a shared pot one player may stake, by its name (the share: half for two, a third for three…)
const SHARE = { 100: "All in", 50: "Half", 33: "A third", 25: "A quarter", 20: "A fifth", 16: "A sixth" };
function drawBetting(q, waiting) {
  const typing = typedNow(q), max = maxPct(), bust = !!together.room && isBust(S, me());
  const slider = $("stake");
  slider.max = max;
  slider.value = pct;
  slider.disabled = waiting || bust;
  const stake = Math.floor(myPot() * pct / 100);
  $("chips").replaceChildren(...[...[0, 5, 10, 25, 50].filter(x => x < max), max].map(x => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.disabled = waiting || bust;
    b.textContent = x === max ? SHARE[x] || `${x}%` : `${x}%`;
    b.addEventListener("click", () => { pct = x; render(); });
    return b;
  }));
  $("passBtn").disabled = waiting || bust || !(typedNow(q) ? !!typed.trim() : pick.length === rightCount(q));   // a pass needs an answer too
  const bet = $("betBtn"), w = waitingOthers();
  bet.dataset.go = "";
  bet.disabled = waiting || bust || (typing ? !typed.trim() : pick.length !== rightCount(q)) || pct <= 0;
  // the Bet button says it all: the stake, and what comes back if right (every bet pays double); at a table, once
  // yours is in, who it waits for
  if (w) waitButton(bet, w);
  else bet.textContent = bust ? "Bust: watching the others" : waiting ? "Waiting" : stake > 0 ? `Bet ${showChips(stake)} · pays ${showChips(stake * ODDS)}` : "Pays double";
}

/** What one player did at a question, in a few words: their pick (✓ or ✗), and what they staked. */
function didText(q, id, b) {
  if (!b) return "";
  if (b.none) return isBust(S, id) && !b.pot ? "bust" : "no stake";
  const p = picksOf(b.pick), right = judged(q, b).right;
  const what = b.typed != null ? `"${b.typed}"` : p?.map(i => q.options[i]?.label).filter(Boolean).join(" + ");
  const mark = right == null ? "" : right ? "✓ " : "✗ ";
  return `${mark}${what || "nothing picked"} · ${b.pct ? `${showChips(b.stake)} (${b.pct}%)` : "passed"}`;
}
/** The table after a question: everyone's pick, stake and gain or loss, ranked by pot (Together: by what each added). */
function drawStandings(q, last) {
  const box = $("standings");
  box.hidden = !together.room;
  if (!together.room) { box.replaceChildren(); return; }
  const against = modeOf(S) === "against";
  box.replaceChildren(leaderboard(standingsAfter(S, last).map(r => ({
    name: r.id === me() ? "You" : r.name, value: r.value, shown: against ? showChips(r.value) : signed(r.value, showChips),
    ...(r.bet && { delta: r.change }), seat: r.slot, me: r.id === me(), note: didText(q, r.id, r.bet),
  })), { format: showChips }));
}

function drawResult(q, last) {
  const v = $("verdict");
  if (!last) { v.textContent = ""; return; }
  const mine = last.bets[me()];
  v.className = "pt-verdict" + (changeOf(last) > 0 ? " won" : changeOf(last) < 0 ? " lost" : "");
  const sign = n => `${n > 0 ? "+" : n < 0 ? "−" : ""}${showChips(Math.abs(n))}`;
  const yours = () => {
    if (mine?.none) return isBust(S, me()) && !mine.pot ? "You're bust: watching the others." : "No stake: the table went on.";
    if (!mine || !mine.pct) {
      const would = judged(q, mine).right;
      return would == null ? "Passed." : would ? "Passed: your pick was right." : "Passed: your pick was wrong.";
    }
    return mine.change > 0 ? `Right! ${sign(mine.change)}` : `Wrong. ${sign(mine.change)}`;
  };
  // at a table, what everyone did is in the standings under it; Together, the verdict says what the pot did too
  v.textContent = together.room && modeOf(S) === "together" ? `${yours().replace(/\.$/, "")} · pot ${sign(last.change)}` : yours();
  drawStandings(q, last);
  $("notes").replaceChildren(...q.notes.map(n => {
    const li = document.createElement("li"), b = document.createElement("b"), t = document.createElement("span");
    setRich(b, n.label);
    setRich(t, `: ${n.text}`);
    li.append(b, t);
    return li;
  }));
  drawFlag(q);
  const nextBtn = $("nextBtn"), w = waitingOthers();
  nextBtn.hidden = !!S.done;
  nextBtn.disabled = false;
  nextBtn.dataset.go = "";
  if (w) { waitButton(nextBtn, w); return; }
  nextBtn.textContent = !together.room ? (S.pot <= 0 || (lengthOf(S) !== "endless" && S.index + 1 >= S.questions.length) ? "See how you did" : "Next question")
    : runOver(S) ? "Final standings" : "Next question";
}

function showDone() {
  if (together.room) { showTableDone(); return; }
  $("doneTable").hidden = true;
  $("doneSolo").hidden = true;
  $("doneNew").textContent = "New session";
  const bets = S.log.flatMap(r => Object.entries(r.bets).filter(([id]) => id === me()).map(([, b]) => b));   // a pass is a bet of 0%
  const won = bets.filter(b => b.change > 0).length;
  $("doneTitle").textContent = S.pot <= 0 ? "Bust" : S.pot > START_POT ? "Up on the house" : S.pot < START_POT ? "Down on the day" : "Level";
  const avg = averageReturn(S.log) ?? 0;
  const stats = [["Final pot", showChips(S.pot)], ["A question", showReturn(avg)], ["Bets won", `${won} of ${bets.length}`]];
  const best = recordBest(avg);
  if (S.ranked) noteComparable("punt", avg, S.daily ? S.seed : null);   // today's run, or a preset with every difficulty: it counts for your best
  drawDoneStats(stats);
  const passes = S.log.filter(r => !r.bets[me()]?.pct).length;
  const what = `${LEVELS[S.level].label}, ${LENGTHS[lengthOf(S)].label.toLowerCase()}`;
  $("doneNote").textContent = `${S.log.length} question${S.log.length === 1 ? "" : "s"}, ${passes} pass${passes === 1 ? "" : "es"}. ` +
    `Your best average on ${what}: ${showReturn(best)} a question. The same run for anyone with the link: ` +
    `${location.origin}${location.pathname}${linkOf(S)}`;
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
function drawDoneStats(stats) {
  $("doneStats").replaceChildren(...stats.map(([label, value]) => {
    const box = document.createElement("div"), dd = document.createElement("dd"), dt = document.createElement("dt");
    dd.textContent = value; dt.textContent = label;
    box.append(dd, dt);
    return box;
  }));
}
/**
 * The end of a run at a table: the final standings (Against: who won, by pot; Together: the team's pot, and what each
 * added to it), Play again and Back to solo. A table's run touches no best and no daily.
 */
function showTableDone() {
  const against = modeOf(S) === "against", rows = standingsAfter(S), first = rows.filter(r => r.value === rows[0]?.value);
  const won = id => S.log.filter(r => r.bets?.[id]?.change > 0).length, staked = id => S.log.filter(r => r.bets?.[id] && !r.bets[id].none).length;
  if (against) {
    $("doneTitle").textContent = first.length > 1 ? (first.some(r => r.id === me()) ? "A draw" : `${whoText({ ids: first.map(r => r.id), seats: 0 })} share it`)
      : first[0]?.id === me() ? "You win" : `${first[0]?.name || "Player"} wins`;
    drawDoneStats([["Your pot", showChips(myPot())], ["A question", showReturn(averageFor(S, me()) ?? 0)], ["Bets won", `${won(me())} of ${staked(me())}`]]);
  } else {
    $("doneTitle").textContent = S.pot <= 0 ? "Bust" : S.pot > START_POT ? "Up on the house" : S.pot < START_POT ? "Down on the day" : "Level";
    drawDoneStats([["Final pot", showChips(S.pot)], ["A question", showReturn(averageReturn(S.log) ?? 0)], ["Bets won", `${won(me())} of ${staked(me())}`]]);
  }
  $("doneTable").hidden = false;
  $("doneTable").replaceChildren(leaderboard(rows.map(r => ({
    name: r.id === me() ? "You" : r.name, value: r.value, shown: against ? showChips(r.value) : signed(r.value, showChips),
    ...(against && { delta: r.value - START_POT }), seat: r.slot, me: r.id === me(),
    note: `${won(r.id)} of ${staked(r.id)} bets won${against ? ` · ${showReturn(averageFor(S, r.id) ?? 0)} a question` : ""}`,
  })), { format: showChips }));
  $("doneNote").textContent = `${S.log.length} question${S.log.length === 1 ? "" : "s"}${against ? ", each on a pot of their own" : ", one pot for the table"}.`;
  $("doneNew").textContent = "Play again";
  $("doneSolo").hidden = false;
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
  const picked = mine?.typed != null ? [mine.typed] : (picksOf(mine?.pick) || []).map(i => q.options[i]?.label).filter(Boolean);
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
/** A settled question as a record for knowledgeStats, or null: one the table went on without you through says nothing. */
function recordOf(r) {
  const b = r?.bets?.[me()], q = S.questions[r?.index];
  if (!b || b.none || !q) return null;
  const { right } = judged(q, b);
  return { o: ODDS, f: (b.pct || 0) / 100, r: right == null ? null : right ? 1 : 0, g: guessChance(q, typedNow(q)) };
}
/** This run's settled questions, as records for knowledgeStats. */
const runRecords = () => S.log.map(recordOf).filter(Boolean);
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
  const rec = recordOf(last);
  if (!rec) return;
  all.push({ ...rec, key, lv: S.level, n: lengthOf(S) });
  try { localStorage.setItem(RECORDS, JSON.stringify(all.slice(-5000))); } catch { /* private mode */ }
}

/** The pile: a wrong answer, a pass, or a stake of 20% or less banks the question; a confident right answer moves a banked one up. */
function bankLatest(last) {
  const q = S.questions[last.index], mine = last.bets?.[me()];
  if (!q || !mine || mine.none || !q.key) return;
  const right = judged(q, mine).right, asName = typedNow(q);
  // the Ledger: what your stake believed, what happened, and what a pure guess would have had
  noteStake(mine.pct, ODDS, right === true, guessChance(q, asName));
  // what's recognised one way round can be asked the other (known.js); a name-it question typed goes to the pile as one,
  // so Deck asks it again as a name to type, not as options to choose from
  if (asName && q.pair) known.named(q.pair, right === true);
  else if (right && mine.pct > 0 && q.pairs?.length) known.recognised(q.pairs);
  const lv = q.src || S.level, key = asName ? `${lv}/name/${q.key}` : `${lv}/${q.key}`;
  const payload = asName ? { name: true, prompt: q.prompt, ask: q.ask, answer: q.answer, note: q.notes?.[0] ? `${q.notes[0].label}: ${q.notes[0].text}` : "" } : { prompt: q.prompt, ask: q.ask, options: q.options.map(o => o.label), right: q.options.map((o, i) => (o.right ? i : -1)).filter(i => i >= 0), need: rightCount(q), note: q.notes?.[0] ? `${q.notes[0].label}: ${q.notes[0].text}` : "", svg: q.svg || null, pic: q.pic || null, ...(q.title && { title: q.title }), code: q.code || null, level: S.level, about: q.about };
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
    (st.passes ? ` Your ${st.passes} pass${st.passes === 1 ? " was a bet" : "es were bets"} of 0%: right ${st.passRight} of ${st.passes}.` : ""));

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

// ---------- at a table ----------
const firstName = id => String(S?.players?.[id]?.name || "Player").split(" ")[0];
/**
 * The line under the header at a table: everyone else in their colour, with their pot (Against) and a tick once
 * they've staked (at the reveal, once they've pressed Next); away for one whose phone isn't at the table. A pair's
 * partner in another game: Join them.
 */
function drawPartner() {
  const el = $("partner");
  if (!together.room || !S?.players) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append(sextant(), "Reconnecting… stakes made now may not reach the table."); return; }
  const others = together.others(), p = together.partner();
  if (others.length <= 1 && p?.game) {
    const b = document.createElement("b"), go = document.createElement("a");
    b.textContent = p.name;
    go.href = gameHref(p.game);
    go.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, go);
    return;
  }
  if (!others.length) { el.append(sextant(), "Waiting for the others to sit down"); return; }
  const against = modeOf(S) === "against", ready = id => (S.phase === "reveal" ? !!S.next?.[id] : !!S.bets?.[id]);
  if (!against) el.append("Sharing a pot with ");
  others.forEach((o, i) => {
    if (i) el.append(" · ");
    const who = document.createElement("span"), dot = document.createElement("i"), b = document.createElement("b");
    who.className = `pt-who${o.here ? "" : " away"}`;
    dot.className = "standings-dot";
    dot.style.background = `var(--p${o.slot % 6})`;
    b.textContent = firstName(o.id);
    who.append(dot, b, against ? ` ${showChips(potOf(S, o.id))}` : "", !o.here ? " away" : ready(o.id) && !S.done ? " ✓" : "");
    el.append(who);
  });
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

// a run at a table: the same questions for everyone, Against (a pot each, head to head) or Together (one pot, a team)
let stopOffset = null;
let joining = null;                                           // the rete over the page while a room is joined
const joined = () => { joining?.(); joining = null; };
const together = createTogether({
  game: "punt",
  app: APP,
  toast,
  askName,
  valid: g => !!g?.questions,
  slots: g => g?.people || 2,
  // a new table, dealt on the first phone to arrive from its own topics: Against, with seats for as many as were asked
  // (a promise: a subject bank may need loading)
  fresh: (players, { ask } = {}) => freshState("mix", chosenLength(), players, null, { mode: "against", people: peopleFor(ask) }),
  result: g => resultFor(g, together.room?.uid),
  onState: val => {
    joined();
    stopOffset ??= together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || null;
    const moved = !S || S.seed !== val.seed || S.index !== val.index || S.phase !== val.phase;
    S = { ...val, questions: Object.values(val.questions || {}), bets: val.bets || {}, log: logOf(val), pots: val.pots || {}, next: val.next || {} };
    if (moved) resetChoice();
    if (moved && !val.done) { shownDone = null; if ($("doneDlg").open) $("doneDlg").close(); }   // a new run: Play again
    render();
    carryOnSoon();
  },
  onPresence: () => { if (!S?.players) return; render(); carryOnSoon(); },
  onLeave: () => {
    joined();
    stopOffset?.();
    stopOffset = null;
    offset = 0;
    clearTimeout(carryTimer);
    clearTimeout(graceTimer);
    if ($("doneDlg").open) $("doneDlg").close();
    S = loadSolo();
    if (!S) { soloSession(randomSeed(), "mix", "standard"); return; }
    shownDone = S.done ? JSON.stringify(S.done) : null;      // your solo run's summary was seen when it ended
    resetChoice();
    history.replaceState(null, "", `${location.search}${linkOf(S)}`);
    render();
  },
});
/** Against or Together: the other kind of pot is a new run, asked first while this one's under way. */
function switchMode(mode) {
  if (modeOf(S) === mode) return;
  const started = !S.done && (S.index > 0 || S.log.length || Object.keys(S.bets || {}).length);
  if (started && !confirm(`Start a new run ${mode === "against" ? "with a pot each" : "with one pot for the table"}? This one isn't finished.`)) { drawMenu(); return; }
  dealTable({ level: S.level, length: lengthOf(S), picks: S.mix || S.maths || null, mode });
}

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
// the menu: Play (a new run, ending an endless one), Content (the run's length; the level is the header's), Settings
// (learning mode), About (stats, flagged questions, a link); in a room, back to solo
let pickLength = null;                                        // the length the menu will start
let pickCopies = [];                                          // the menu's copies of the bar's pickers: [button, source, fallback]
new MutationObserver(() => { for (const [b, src, fb] of pickCopies) b.textContent = src.textContent || fb; })
  .observe($("mathsBar"), { childList: true, characterData: true, subtree: true });
function drawMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  pickLength ??= lengthOf(S);
  const play = part(body, "play");
  // at a table a new run is the whole table's (dealt from your choices below), and today's run is played alone
  if (together.room) play.append(action("New run", () => newSession("mix", pickLength), "primary"));
  else play.append(action("New run", () => newSession("mix", pickLength), "primary"), action("Today's run", newDaily),
    line(S?.daily ? "Today's run: it counts for your best." : S?.ranked ? "A preset with every difficulty in: it counts for your best."
      : "Your best counts today's run, and runs on a preset (Balanced, Trader, Culture night) with every difficulty in, at any length."));
  if (lengthOf(S) === "endless" && !S.done && S.log.length) play.append(action("End this run", endRun));
  // what a run deals: a preset or your own mix of topics (each out, in or more), the difficulties for all of them,
  // and each subject bank's stages; a change applies to the next run
  const topics = chosenTopics(), content = part(body, "content");
  const presets = [...Object.entries(TOPIC_PRESETS).map(([id, p]) => [id, p.label]), ...(topics.preset === "custom" ? [["custom", "Your own"]] : [])];
  content.append(
    choice("Preset", presets, topics.preset, id => { if (id === "custom") return; keepTopics({ preset: id, weights: { ...TOPIC_PRESETS[id].topics } }); drawMenu(); }),
    weights("Topics", TOPIC_LIST, topics.weights, w => {
      keepTopics({ preset: "custom", weights: w });
      content.querySelector("[aria-label='Preset']")?.querySelectorAll("button").forEach(o => o.setAttribute("aria-checked", "false"));   // your own mix now
    }),
    ticks("Difficulty", DIFFICULTIES.map(d => [d, String(d)]), chosenDiffs(), d => keepDiffs(d.length ? d : [...DIFFICULTIES])));
  const stages = document.createElement("div");
  content.append(stages);
  for (const [id, label] of TOPIC_LIST.filter(([id]) => !CLUE_TOPICS[id] && (topics.weights[id] || 0) > 0)) {
    loadBank(id).then(({ STAGES }) => {
      const mine = chosenPicks(id), on = (mine.stages || STAGES.map(x => x.id)).filter(x => STAGES.some(y => y.id === x));
      const box = document.createElement("details"), sum = document.createElement("summary"), what = document.createElement("span");
      box.className = "menu-stages";
      const say = list => { what.textContent = list.length === STAGES.length ? " · all stages" : ` · ${list.length} of ${STAGES.length} stages`; };
      sum.append(`${label} stages`, what); say(on);
      box.append(sum, ticks(`${label} stages`, STAGES.map(x => [x.id, x.label]), on, list => {
        const keep = list.length ? list : STAGES.map(x => x.id);
        try { localStorage.setItem(picksKey(id), JSON.stringify({ ...mine, stages: keep })); } catch { /* private mode */ }
        say(keep);
      }));
      stages.append(box);
    });
  }
  content.append(choice("Length", Object.entries(LENGTHS).map(([id, L]) => [id, id === "standard" ? `${MIX.questions}` : id === "hundred" ? "100" : L.label]), pickLength, v => { pickLength = v; }),
    // countries and commodities only; a change applies to the next run
    ...(["countries", "commodities"].some(id => (topics.weights[id] || 0) > 0) ? [choice("Name it", Object.entries(NAME_MODES), nameMode(), mo => {
      try { localStorage.setItem(NAME, mo); } catch { /* private mode */ }
    })] : []));
  part(body, "settings").append(choice("Learning mode", pile.MODES, pile.mode(), pile.setMode));
  if (together.room) {
    const max = maxShare(S);
    part(body, "together").append(choice("Pots", Object.entries(MODES), modeOf(S), switchMode),
      line(modeOf(S) === "against" ? "A pot each: the most at the end wins." : `One pot for the table: each stakes up to ${(SHARE[max] || `${max}%`).toLowerCase()} of it.`),
      action("Back to solo", () => together.leave(), "link"));
  }
  if ($("avg").textContent && !$("avg").hidden) part(body, "about").append(line($("avg").textContent));
  part(body, "about").append(action("Your stats", () => openStats("run")), action("Flagged questions", () => openFlags(false)),
    ...(together.room ? [] : [action("Copy a link to this run", async () => {
      try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast(location.href, 6000); }
    }, "link")]));
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
$("doneNew").addEventListener("click", () => {
  $("doneDlg").close();
  if (together.room) dealTable({ level: S.level, length: lengthOf(S), picks: S.mix || S.maths || null });   // Play again: the table's topics
  else newSession("mix", lengthOf(S));
});
$("doneSolo").addEventListener("click", () => { $("doneDlg").close(); together.leave(); });
dropdown($("level"));
$("level").addEventListener("change", e => newSession(e.target.value, lengthOf(S)));
$("stagesBtn").addEventListener("click", openMathsPicks);
$("diffsBtn").addEventListener("click", openMathsPicks);
$("mathsClose").addEventListener("click", () => $("mathsDlg").close());
$("mathsGo").addEventListener("click", applyMathsPicks);
$("stake").addEventListener("input", e => { pct = Number(e.target.value); render(); });
$("passBtn").addEventListener("click", () => place(true));
// at a table, once the slow have had their grace, the button that waited for them goes on without them
$("betBtn").addEventListener("click", () => ($("betBtn").dataset.go ? goOnWithout() : place(false)));
$("nextBtn").addEventListener("click", () => ($("nextBtn").dataset.go ? goOnWithout() : next()));
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
window.addEventListener("hashchange", () => {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("s")), level = h.get("d"), day = Number(h.get("day"));
  if (!together.room && day && !(S?.daily && S.seed === day)) { soloSession(day, "mix", "standard", null, true); return; }
  const length = LENGTHS[h.get("n")] ? h.get("n") : "standard";
  if (!together.room && seed && LEVELS[level] && !(S && S.seed === seed && S.level === level && lengthOf(S) === length)) soloSession(seed, level, length, isMaths(level) || level === "mix" ? picksFromHash(h, level) : null);
});

// for tests and debugging
window.__punt = { get state() { return S; }, get together() { return together; } };

// start: a shared session (#s=…&d=…), the saved one, or a fresh run of the chosen topics for a first visit
const hash = new URLSearchParams(location.hash.slice(1));
const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
/** Your own run: a shared link's, today's from the games screen's tile, the saved one, or a fresh one. */
function soloStart() {
  S = loadSolo();
  const forToday = arrivedForToday() && !together.room;       // from the games screen's tile: today's run, still to play
  const linked = Number(hash.get("s")), linkedLevel = hash.get("d"), linkedLength = LENGTHS[hash.get("n")] ? hash.get("n") : "standard", linkedDay = Number(hash.get("day"));
  if (forToday && !S) soloSession(today(), "mix", "standard", null, true);
  else if (linkedDay && !(S?.daily && S.seed === linkedDay)) soloSession(linkedDay, "mix", "standard", null, true);
  else if (linked && LEVELS[linkedLevel] && !(S && S.seed === linked && S.level === linkedLevel && lengthOf(S) === linkedLength)) soloSession(linked, linkedLevel, linkedLength, isMaths(linkedLevel) || linkedLevel === "mix" ? picksFromHash(hash, linkedLevel) : null);
  else if (!S) soloSession(randomSeed(), "mix", "standard");
  else {
    shownDone = S.done ? JSON.stringify(S.done) : null;
    history.replaceState(null, "", `${location.search}${linkOf(S)}`);
    render();
    if (forToday && !(S.daily && S.seed === today())) setTimeout(newDaily, 0);   // it asks before leaving a run you've started
  }
}
// a room in the address: the run you share from the first moment, never your own while the room is joined (the others
// would be on another question until it was), and your own only if the join doesn't come off
if (code.length === 4) {
  joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { if (!ok) { joined(); soloStart(); } });
} else soloStart();
