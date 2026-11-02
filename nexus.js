// Nexus: a thing from the knowledge base in the middle, a ring of candidates round it, and you pick the ones the Codex
// links to it directly (nexus-engine.js says how a round is built). Five rounds a run, Orbit (everything linked), Aspect
// (only what is linked under one aspect of it) and Intruder (the one that isn't), mixed or one kind; random or today's,
// the same for everyone. A round scores what you found less what you picked wrongly, out of 100. Checking turns the
// ring into a list of verdicts with the link that was written for each, and what you missed or picked wrongly goes to the
// pile (Deck asks it again; learning mode deals those nexuses again, and the ones other games found you weak on).
// Random runs draw their nexuses from the topics that are on (the suite's one set, in Settings: topics.js, topics-on.js),
// read when the run is dealt. Together, the same five rounds for everyone at the table (duel.js), from the dealer's topics.
import { clueLines, pictureOf, whatCard } from "./thing-clues.js";
import { showPicture, credit } from "./pics.js";
import { PER_RUN, SIZES, MODES, CENTRES, dealRun, judge, reasonOf, askOf, cardsFor, settles, name, kind, TOPIC_LIST, topicsOf } from "./nexus-engine.js";
import { subjectPreset, even, mixParam, mixFromParam } from "./topics.js";
import { subjectsOn } from "./topics-on.js";
import { topicsPart } from "./topics-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line } from "./menu.js";
import { today, arrivedForToday, dailyDue } from "./suite.js";          // the day, the same for everyone (UTC)
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";
import * as pile from "./pile.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "nexus:run", BEST = "nexus:best", DAILY = "nexus:daily", PREFS = "nexus:prefs";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const DEFAULT = { mode: "mixed", size: 10 };
const prefs = (p => ({ mode: MODES.some(([m]) => m === p.mode) ? p.mode : DEFAULT.mode, size: SIZES.includes(p.size) ? p.size : DEFAULT.size }))(read(PREFS, {}));
const keepPrefs = () => write(PREFS, prefs);

// ---------- your topics ----------
// The suite's one set (Settings, or Change topics in the menu), read when a run is dealt, never kept here; the old
// nexus:topics key is no longer read or written. A preset counts for your best, your own mix doesn't.
const mix = () => topicsOf(subjectsOn());
const onPreset = () => subjectPreset(subjectsOn()) !== "custom";

// ---------- a run ----------
let S = read(RUN, null);
const save = () => { if (S?.duel) { duel.keep(S); tell(); } else write(RUN, S); };   // a match's run is kept apart from yours
const R = () => S?.rounds[S.index];
const fresh = run => ({ ...run, index: 0, total: 0, rounds: run.rounds.map(x => ({ ...x, picked: [], done: false, points: 0 })) });
const DUE = 2;                                                     // rounds of a run the pile may ask again
/**
 * What the learning mode asks again: the nexuses of the cards that are due (yours, then ones other games found you
 * weak on), put in rounds 1 and 3 with the links to find and the wrong picks to meet again.
 */
function wishes() {
  const items = pile.picks("nexus").filter(it => it.payload?.centre && CENTRES.includes(it.payload.centre));
  const own = [...new Set(items.map(it => it.payload.centre))].slice(0, DUE);
  const centres = pile.dealDue("nexus", CENTRES.map(id => ({ key: id, about: [id] })), own, DUE), must = {};
  for (const it of items) if (centres.includes(it.payload.centre)) ((must[it.payload.centre] ||= { trues: [], falses: [] })[it.payload.linked ? "trues" : "falses"]).push(it.payload.pick);
  return { forced: [centres[0], null, centres[1]], must, items: items.filter(it => centres.includes(it.payload.centre)).map(({ key, payload }) => ({ key, payload })) };
}
function newRun(daily) {
  const learn = !daily && pile.learning() ? wishes() : null;
  const seed = daily ? today() * 7919 + 41 : Math.floor(Math.random() * 2 ** 31);
  const opts = daily ? {} : { mode: prefs.mode, size: prefs.size, weights: mix(), forced: learn?.forced || [], must: learn?.must || {}, avoid: pile.recent("nexus") };
  const run = dealRun(seed, opts);
  // your own mix, a kind of round or a size of ring doesn't count for your best: today's run and the presets' standard run do
  S = { ...fresh(run), daily, day: daily ? today() : null, due: learn?.items || [],
    ranked: daily || (onPreset() && prefs.mode === DEFAULT.mode && prefs.size === DEFAULT.size) };
  if (!daily) pile.dealt("nexus", run.rounds.map(x => x.centre), 600);
  save(); render();
}
const started = () => S && !S.over && (S.index > 0 || R()?.picked.length || R()?.done);
/** Today's run, still to play: asks before leaving a run you've started. */
function openToday() {
  if (started() && !confirm("Start today's run? This one isn't finished.")) return;
  newRun(true);
}
function pickOne(id) {
  const r = R();
  if (!r || r.done) return;
  const at = r.picked.indexOf(id);
  if (r.type === "intruder") r.picked = at < 0 ? [id] : [];            // one, or none
  else if (at < 0) r.picked.push(id); else r.picked.splice(at, 1);
  save(); markPicks();
}
function check() {
  const r = R();
  if (!r || r.done || !r.picked.length) return;
  r.done = true;
  r.points = judge(r, r.picked).points;
  S.total += r.points;
  if (!S.duel) remember(r);                                         // a match's rounds are no one's to learn from
  save(); render();
  if (S.rounds.every(x => x.done)) settled();
}
/** What the round showed you didn't know goes to the pile; what it dealt to ask again moves up it, or back down. */
function remember(r) {
  const made = cardsFor(r, r.picked), again = new Set(made.map(c => c.key));
  for (const c of made) pile.record("nexus", c.key, c.payload, c.why);
  for (const { key, right } of settles(r, r.picked, S.due || [])) {
    if (right) { if (pile.has("nexus", key)) pile.answer("nexus", key, true); }
    else if (!again.has(key) && pile.has("nexus", key)) pile.answer("nexus", key, false);
  }
}
/** The last round decided: the run's total is final at once, before Finish (a match's, for the table; yours, for your
 *  best and today's, which Finish counts again, changing nothing), and random mode goes on from here. */
function settled() {
  if (S.duel) { tell(true); return; }
  count();
  roundOver("nexus");
}
function count() {
  const best = read(BEST, 0); if (S.ranked !== false && S.total > best) write(BEST, S.total);
  if (S.daily) { const d = read(DAILY, {}), day = S.day ?? today(); if (!(d[day] >= S.total)) { d[day] = S.total; write(DAILY, d); } }
}
function next() {
  if (S.index + 1 < S.rounds.length) { S.index++; save(); render(); return; }
  S.over = true; save();
  if (S.duel) { duel.open(); return; }                              // the table's result, not your best or today's
  count();
  finish();
}

// ---------- drawing ----------
/** A kind as a chip says it: "kind:company" → "company", "art-movement" → "art movement". */
const kindLabel = id => kind(id).replace(/^(kind|feature):/, "").replace(/-/g, " ");
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** The "?" beside a thing: what it is, a clue at a time (it marks the thing as not known, for Deck). */
function whatBtn(id) {
  const b = el("button", "nx-what", "?");
  b.type = "button"; b.setAttribute("aria-label", `What is ${name(id)}?`);
  b.addEventListener("click", e => { e.stopPropagation(); openClues(id, false); });
  return b;
}
function chip(r, c) {
  const li = el("li", "nx-cell"), b = el("button", "nx-chip");
  b.type = "button"; b.dataset.id = c.id;
  b.append(el("b", null, name(c.id)), el("small", null, kindLabel(c.id)));
  b.addEventListener("click", () => pickOne(c.id));
  li.append(b, whatBtn(c.id));
  return li;
}
/** One candidate after the check: found, missed, picked wrongly or rightly left out, with the link that was written for it. */
function row(r, c) {
  const picked = r.picked.includes(c.id), why = reasonOf(r, c);
  const odd = r.type === "intruder";
  const state = odd ? (c.linked ? (picked ? "wrong" : "clear") : (picked ? "found" : "missed")) : (c.linked ? (picked ? "found" : "missed") : (picked ? "wrong" : "clear"));
  const tag = { found: "Found", missed: odd ? "The intruder" : "Missed", wrong: "Wrong pick", clear: odd ? "Linked" : c.near ? "Other aspect" : "Not linked" }[state];
  const li = el("li", `nx-row ${state}`), head = el("div", "nx-head");
  head.append(el("b", null, name(c.id)), whatBtn(c.id), el("span", "nx-tag", tag));
  li.append(head);
  if (why.lead) li.append(el("p", "nx-lead", why.lead));
  if (why.because) li.append(el("p", null, why.because));
  return li;
}
// ---------- clues for any thing, and the centre's picture ----------
/** The clues for a thing of this round: never a line that names the nexus or a candidate (bar itself), which would give a link away.
 *  Only the nexus has its hints; a candidate's were written for its links, one of which could be the one asked. */
const cluesOf = (r, id) => clueLines(id, [r.centre, ...r.cands.map(c => c.id)].filter(x => x !== id).map(name), { hints: id === r.centre });
let looking = null;                                               // the thing whose clues the dialog shows
function drawClues() {
  const r = R(), all = cluesOf(r, looking), n = Math.min(r.looked?.[looking] || 0, all.length);
  $("clueTitle").textContent = name(looking);
  $("clueList").replaceChildren(...(all.length ? all.slice(0, n).map(t => el("li", null, t)) : [el("li", null, "Nothing more is known of it here.")]));
  $("clueMore").disabled = n >= all.length;
  $("clueMore").textContent = n >= all.length ? "No more clues" : "Another clue";
  $("clueNote").hidden = !!S.duel || !whatCard(looking);            // only what Deck can be asked about is marked
}
/** Asking for a thing's description: the first clue the first time, then the ones you have. Clues cost no points; they mark the
 *  thing as not known, so Deck brings it back (once a round, and not in a match, whose rounds are no one's to learn from). */
function openClues(id, more) {
  const r = R();
  if (!r || !r.cands.some(c => c.id === id) && id !== r.centre) return;
  looking = id;
  const total = cluesOf(r, id).length;
  r.looked ??= {};
  if (more || !r.looked[id]) r.looked[id] = Math.min(total, (r.looked[id] || 0) + 1);
  if (!S.duel && !(r.marked ??= []).includes(id)) { r.marked.push(id); const card = whatCard(id); if (card) pile.record("nexus", card.key, card.payload, "clue"); }
  save(); drawClues();
  $("clueBtn").textContent = r.looked[r.centre] ? `Clues · ${r.looked[r.centre]}` : "Clue";
  if (!$("clueDlg").open) $("clueDlg").showModal();
}
/** The nexus's picture, small, if it has one; a tap shows it in full. A thing without one, or one that won't load, shows nothing. */
function drawThumb(r) {
  const title = pictureOf(r.centre), thumb = $("thumb");
  thumb.hidden = !title;
  if ((thumb.dataset.title || "") === (title || "")) return;
  thumb.dataset.title = title || "";
  showPicture($("thumbBox"), title, { width: 250, alt: "" }).then(ok => { if (ok === false && thumb.dataset.title === title) thumb.hidden = true; });
}
$("clueBtn").addEventListener("click", () => openClues(R().centre, false));
$("clueMore").addEventListener("click", () => openClues(looking, true));
$("clueClose").addEventListener("click", () => $("clueDlg").close());
$("thumb").addEventListener("click", () => {
  const r = R(), title = r && pictureOf(r.centre);
  if (!title) return;
  $("picTitle").textContent = name(r.centre);
  $("picCredit").href = credit(title);
  $("picDlg").showModal();
  // a picture that can't be had (offline, and not kept) gives way to a word, not an empty frame
  showPicture($("picBox"), title, { width: 1280, alt: name(r.centre) }).then(ok => { if (ok === false) { $("picDlg").close(); toast("That picture can't be reached now."); } });
});
$("picClose").addEventListener("click", () => $("picDlg").close());
$("picBox").addEventListener("click", () => $("picDlg").close());

function markPicks() {
  const r = R();
  for (const b of $("ring").querySelectorAll(".nx-chip")) b.setAttribute("aria-pressed", String(r.picked.includes(b.dataset.id)));
  $("goBtn").disabled = !r.picked.length;
}
function render() {
  if (!S) { if (duel.on) lobby(); else newRun(false); return; }
  const r = R();
  $("centre").hidden = $("board").hidden = $("foot").hidden = false;
  $("where").textContent = `Round ${S.index + 1} of ${S.rounds.length} · ${r.type[0].toUpperCase()}${r.type.slice(1)}${S.daily ? " · today's" : S.duel ? " · together" : ""}`;
  $("score").innerHTML = `Score <b>${S.total}</b>`;
  $("centreName").textContent = name(r.centre);
  $("centreKind").textContent = kindLabel(r.centre);
  $("ask").textContent = askOf(r);
  $("clueBtn").textContent = r.looked?.[r.centre] ? `Clues · ${r.looked[r.centre]}` : "Clue";
  drawThumb(r);
  const ring = $("ring");
  ring.classList.toggle("revealed", r.done);
  ring.replaceChildren(...r.cands.map(c => (r.done ? row(r, c) : chip(r, c))));
  ring.scrollTop = 0;
  const v = $("verdict");
  v.hidden = !r.done;
  if (r.done) {
    const j = judge(r, r.picked);
    v.className = `nx-verdict ${j.points >= 100 ? "good" : j.points === 0 ? "bad" : ""}`;
    v.textContent = r.type === "intruder" ? (j.points ? "That's the intruder: +100" : "Not that one: +0")
      : `Found ${j.hits} of ${j.trues}${j.wrong ? `, ${j.wrong} wrong` : ""}: +${j.points}`;
    $("goBtn").disabled = false;
    $("goBtn").textContent = S.index + 1 < S.rounds.length ? "Next round" : "Finish";
  } else {
    $("goBtn").textContent = "Check";
    markPicks();
  }
}
$("goBtn").addEventListener("click", () => { if (R()?.done) next(); else check(); });
function finish() {
  const body = $("doneBody");
  body.replaceChildren();
  body.append(el("p", "nx-sum", `${S.total} of ${PER_RUN * 100}.`));
  const list = el("ol", "nx-sumlist");
  for (const x of S.rounds) list.append(el("li", null, `${name(x.centre)}: ${x.points}`));
  body.append(list, action("Another run", () => { $("doneDlg").close(); newRun(false); }, "primary"));
  $("doneDlg").showModal();
}
function toast(text, ms = 2600) {
  const t = $("toast");
  t.textContent = text; t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- together: the same five rounds for everyone at the table (duel.js) ----------
// Everyone gets the match's rounds and plays them on their own phone; the others' scores show in the strip. The highest
// total wins, then the quicker. Your solo run, your best, today's and your pile stay as they were.
const duel = createDuel({
  game: "nexus", name: "Nexus", line: $("rival"), toast,
  // the match carries the dealer's kind of round, ring and mix (unless every topic is in), so every phone deals the same rounds from it
  deal: () => { const w = mix(); return { seed: Math.floor(Math.random() * 2 ** 31), mode: prefs.mode, size: prefs.size, ...(even(TOPIC_LIST, w) ? {} : { t: mixParam(TOPIC_LIST, w) }) }; },
  describe: () => `The same ${PER_RUN} rounds for everyone: find the links`,
  play: (match, { kept }) => {
    S = kept?.seed === match.seed && kept.rounds ? kept
      : { ...fresh(dealRun(match.seed, { mode: match.mode, size: match.size, weights: match.t ? mixFromParam(TOPIC_LIST, match.t) : null })), duel: true };
    save(); render();
  },
  onLobby: () => { S = null; render(); },
  onLeave: () => { S = read(RUN, null); if (!S || S.over) newRun(false); else render(); },
});
/** What the table sees of this run: the total, and how many rounds are done. */
function tell(done = false) {
  const full = S.rounds.filter(x => x.done && x.points >= 100).length, decided = S.rounds.filter(x => x.done).length;
  duel.report({ score: S.total, text: done ? `${S.total}, ${full} of ${PER_RUN} clean` : `${S.total} · ${decided} of ${PER_RUN}`, ...(done ? { done: true } : {}) });
}
/** The page before a match: no round yet. */
function lobby() {
  $("where").textContent = `${PER_RUN} rounds, together`;
  $("score").innerHTML = "Score <b>0</b>";
  $("centre").hidden = $("board").hidden = $("foot").hidden = true;
}

// ---------- the menu ----------
let pick = null;
// topics changed (in the sheet Change topics opens) with today's picked: the next run is a random one, which they are for
addEventListener("topics:changed", () => { if (pick === "daily") pick = "random"; });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    const table = part(body, "together");
    duel.menu(table);
    table.append(...topicsPart(table, "The next match is dealt from your topics"));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= S?.daily ? "daily" : "random";
  part(body, "play").append(action("New run", () => newRun(pick === "daily"), "primary"));
  const content = part(body, "content");
  content.append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  // today's run is the same for everyone, so your rounds are for random runs, and so are your topics, but they're shown
  // either way: a game opens on today's, and topics shown only with Random were never found
  if (pick === "random") content.append(choice("Rounds", MODES, prefs.mode, v => { prefs.mode = v; keepPrefs(); openMenu(); }));
  content.append(...topicsPart(content, pick === "daily" ? "Today's run deals every topic" : onPreset() ? "" : "Your own mix doesn't count for your best"));
  const settings = part(body, "settings");
  if (pick === "random") settings.append(choice("Candidates", SIZES.map(n => [n, String(n)]), prefs.size, v => { prefs.size = v; keepPrefs(); openMenu(); }));
  settings.append(choice("Learning mode", pile.MODES, pile.mode(), pile.setMode));
  const best = read(BEST, 0), day = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${best}` : "No finished run yet"}${day != null ? `, today ${day}` : ""} · ${CENTRES.length.toLocaleString("en-GB")} things to start from`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
document.querySelector(".nx-mark").innerHTML = APPS.find(a => a.id === "nexus").logo;
bindSwitcher($("appsBtn"), "nexus");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
function solo() {
  if (arrivedForToday() && !(S?.daily && S.day === today())) { if (S && !S.over) render(); setTimeout(openToday, 0); }
  else if (!S || S.over) newRun(dailyDue("nexus"));
  else render();
}
// a match in the address: its rounds, with no solo run dealt under it
if (duel.inAddress) { S = null; duel.join().then(ok => { if (!ok) { S = read(RUN, null); if (!S || S.over) newRun(false); else render(); } }); }
else solo();
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });

// for tests and debugging
window.__nexus = { get state() { return S; }, pickOne, check, next, duel, openClues, newRun };
