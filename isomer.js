// Isomer (README, Isomer): Jumble's genre, its final answer a thing from the knowledge base clued by its hint. This file
// draws the puzzle and keeps the run: the rows and their squares, the rack of letters under the thumb, the clue, the
// clock, the menu; solo (random or today's, with a computer rival if you like), with your partner (two jumbles each,
// the final together: isomer-table.js) or a race at a table of up to six (duel.js). The puzzle and the rules are
// isomer-engine.js's.
import { MODES, LEVELS, DAILY, PER_HINT, RIVALS, makePuzzle, newRun, tidyRun, itemsOf, rackOf, spelled, place, placeLetter, unplace, back, clear, reshuffle, hint, solveFrom, hintsOf, scoreOf, nextOpen, clock, rivalPlan, rivalSolved, rng, revealTo } from "./isomer-engine.js";
import { isPair, freshPair, tidy as tidyTable, beginAt, solveAt, hintAt, newGameAt, resultOf as pairResult, halfFor, teamScore, itemKey, APP as PAIR_APP } from "./isomer-table.js";
import { KB_TOPICS, KB_PRESETS, cleanMix, presetOf } from "./topics.js";
import { createTogether } from "./together.js";
import { createDuel } from "./duel.js";
import { busy, sextant } from "./loading.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, topicMix, action, line, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";   // the day, the same for everyone; a partner watching's frame runs no clock and writes nothing
import { roomInAddress, joiningWords } from "./rooms.js";
import * as pile from "./pile.js";
import * as known from "./known.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const RUN = "isomer:run", OPTS = "isomer:opts", MIX = "isomer:mix", TIMES = "isomer:times", RIVAL_RECORD = "isomer:rivals", PAIR = "isomer:pair";
const SAVE_EVERY = 5000;                 // ms between saves of the clock while a puzzle is in play (a partner watching sees it that often)
const first = name => String(name || "Player").trim().split(/\s+/)[0];

// ---------- what to deal: the menu's choices ----------
const TOPICS = [...KB_TOPICS.country, ...KB_TOPICS.commodity];
const CATS = { mixed: "Mixed", country: "Countries", commodity: "Commodities" };
const RIVAL_NAMES = { off: "Off", ...Object.fromEntries(Object.entries(RIVALS).map(([k, v]) => [k, v.label])) };
function opts() {
  const o = read(OPTS, {}) || {};
  return { mode: MODES[o.mode] ? o.mode : "classic", level: LEVELS[o.level] ? o.level : "medium", cat: CATS[o.cat] ? o.cat : "mixed", rival: RIVAL_NAMES[o.rival] ? o.rival : "off" };
}
const setOpt = (k, v) => write(OPTS, { ...opts(), [k]: v });
const mix = () => cleanMix(TOPICS, read(MIX, null));
const presetNow = () => presetOf(TOPICS, KB_PRESETS, mix());

// ---------- the puzzle on the screen ----------
// S: { kind ("random", "daily", "race" or "pair"), puzzle, run (the engine's), day, ranked (a preset or today's: it
// counts for your best), rival (a computer's pace, or "off"), begun (a race's start, server time), fresh (a new best) }
let S = null, P = null, items = [];
let clockFrom = null, savedAt = 0, paused = false;
let message = null;                       // { text, tone } the clue panel says until the next move
const elapsed = () => {
  if (!S) return 0;
  if (S.kind === "race") return S.run.done ? S.run.ms : Math.max(0, duel.now() - S.begun);
  if (S.kind === "pair") return G?.done ? G.done.ms : G?.start ? Math.max(0, serverNow() - G.start) : 0;
  return S.run.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
};
function clockRun() {
  if (IN_FRAME || !S || S.kind === "race" || S.kind === "pair" || S.run.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.run.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); }, () => { paused = false; clockRun(); });   // the menu stops a solo clock too

function save() {
  if (IN_FRAME || !S) return;
  savedAt = performance.now();
  if (S.kind === "race") duel.keep(S);
  else if (S.kind === "pair") { if (G) write(PAIR, { code: together.room?.code, uid: together.room?.uid, created: G.created, n: G.n, run: S.run }); }
  else write(RUN, S);
}
const started = () => !!S && (S.kind === "random" || S.kind === "daily") && !S.run.done && (S.run.squares.some(sq => sq.some(k => k >= 0)) || hintsOf(S.run) > 0);

/** Puts a puzzle on the screen with its run (a fresh one unless given). */
function show(next) {
  S = next;
  P = S.puzzle;
  items = itemsOf(P);
  S.run = tidyRun(P, S.run) || newRun(P);
  if (S.rival && S.rival !== "off") S.plan = rivalPlan(P, S.rival, P.seed);
  else S.plan = null;
  clockFrom = null;
  message = null;
  build();
  save();
  clockRun();
  render();
}
/** A new puzzle of your own: random from the menu's choices, or today's (the same for everyone). */
async function deal(kind = "random") {
  const o = opts(), daily = kind === "daily";
  const done = busy("Jumbling the words", { delay: 200 });
  await new Promise(res => setTimeout(res, 30));               // let the rete show before the first deal's work
  try {
    const seed = daily ? today() : randomSeed();
    const puzzle = makePuzzle(seed, daily ? DAILY : { mode: o.mode, level: o.level, cat: o.cat, mix: mix() });
    show({ kind, puzzle, run: null, day: daily ? seed : null, ranked: daily || presetNow() !== "custom", rival: o.rival });
    if (puzzle.wide) toast("Too few clues in your topics for that: dealt from every topic");
  } catch (e) { console.error(e); toast("Couldn't deal a puzzle: try another level"); }
  finally { done(); }
}
function confirmDeal(kind) {
  if (started() && !confirm("Start a new puzzle? This one isn't solved.")) return false;
  deal(kind);
  return true;
}

// ---------- moves ----------
const mineToPlay = i => !S.run.solved[i] && (S.kind !== "pair" || i >= P.words.length || G?.owners[i] === together.slot);
const busyNow = () => !S || S.run.done || IN_FRAME || (S.kind === "race" && !duel.playing);
function choose(i) {
  if (!S || i < 0 || i >= items.length) return;
  S.run.active = i;
  message = null;
  save(); render();
}
function tapTile(k) {
  const i = S?.run.active;
  if (busyNow() || !mineToPlay(i)) return;
  moved(i, place(P, S.run, i, k));
}
function typeLetter(ch) {
  const i = S?.run.active;
  if (busyNow() || !mineToPlay(i)) return;
  moved(i, placeLetter(P, S.run, i, ch));
}
/** What a placement came to: a wrong row shakes, a solved one says so and the next unsolved row comes up. */
function moved(i, out) {
  if (out === "no") { navigator.vibrate?.(10); return; }
  if (out === "wrong") { shake(i); message = { text: items[i].kind === "final" ? "Not the answer: move the letters round." : "Not a word: move the letters round.", tone: "bad" }; }
  if (out === "solved") solved(i);
  else { save(); render(); }
}
function solved(i) {
  navigator.vibrate?.(25);
  glow(i);
  message = null;
  if (S.kind === "pair") solveTogether(i);
  if (!S.run.done) S.run.active = nextOpenFor(i);
  if (S.run.done) finish();
  else { save(); tell(); }
  render();
}
/** The next row you can play after i: your own or a final, in a pair's match. */
function nextOpenFor(i) {
  let j = i;
  for (let step = 0; step < items.length; step++) { j = nextOpen(S.run, j); if (mineToPlay(j)) return j; if (j === i) break; }
  return S.run.active;
}
function tapSquare(i, s) {
  if (busyNow()) return;
  if (S.run.active !== i) { choose(i); return; }
  if (mineToPlay(i) && unplace(P, S.run, i, s)) { message = null; save(); render(); }
}
function takeBack() { const i = S?.run.active; if (!busyNow() && mineToPlay(i) && back(P, S.run, i)) { message = null; save(); render(); } }
function clearRow() { const i = S?.run.active; if (!busyNow() && mineToPlay(i) && clear(P, S.run, i)) { message = null; save(); render(); } }
function shuffleRack() { const i = S?.run.active; if (!busyNow() && !S.run.solved[i]) { reshuffle(S.run, i, rng(randomSeed())); save(); render(); } }
async function useHint() {
  const i = S?.run.active;
  if (busyNow() || !mineToPlay(i)) return;
  if (S.kind === "pair") { hintTogether(i); return; }
  const out = hint(P, S.run, i);
  if (out === "no") return;
  message = { text: `A letter shown: +${PER_HINT} s.`, tone: "" };
  if (out === "solved") solved(i); else { save(); render(); }
}

// ---------- the end of a puzzle ----------
/** The last answer in: the time is final, and counts at once (your best, today's), the pile learns what you missed.
 *  Once a puzzle: on the phone that put the last answer in, or the one that saw it arrive from the table. */
function finish() {
  if (S.counted) return;
  S.counted = true;
  const r = S.run;
  if (S.kind === "race") r.ms = Math.max(0, duel.now() - S.begun);
  else if (S.kind === "pair") r.ms = G?.done?.ms ?? elapsed();
  else if (clockFrom != null) { r.ms += performance.now() - clockFrom; clockFrom = null; }
  r.done = true;
  learn();
  if (S.kind === "random" || S.kind === "daily") {
    const sc = scoreOf(r);
    if (S.ranked) {
      const times = read(TIMES, {}), k = `${P.mode}/${P.level}`;
      S.fresh = times[k] == null || sc < times[k];
      if (S.fresh) { times[k] = sc; write(TIMES, times); }
    }
    if (S.kind === "daily") noteDayTime("isomer", sc, S.day);
    if (S.plan) {                                               // against the computer: who was quicker
      const rec = read(RIVAL_RECORD, {}), mine = rec[S.rival] || { won: 0, lost: 0 };
      if (sc * 1000 <= S.plan.end) mine.won++; else mine.lost++;
      rec[S.rival] = mine;
      write(RIVAL_RECORD, rec);
    }
  }
  save();
  tell(true);
}
/** What you didn't find goes to the pile as a name-it card (Deck asks it again); what you found clean, you're known to
 *  know (Punt's name-it may ask it the other way round), and a card of it that was due moves up. */
function learn() {
  if (IN_FRAME) return;
  const things = [...P.finals.map((f, fi) => [f, P.words.length + fi]), ...(P.theme ? P.words.map((w, wi) => [w, wi]) : [])];
  for (const [x, i] of things) {
    if (!x.key || !x.card) continue;
    const helped = S.run.hints[i];
    if (helped) pile.record("isomer", x.key, x.card, helped >= items[i].n - 1 ? "miss" : "clue");
    else {
      if (pile.has("isomer", x.key)) pile.answer("isomer", x.key, true);
      if (x.pair) known.recognised([x.pair]);
    }
  }
}

// ---------- drawing ----------
const rows = [];
/** Lays the rows out for this puzzle: one a jumble, then the final (or two), their squares, their circles. */
function build() {
  const board = $("board");
  board.replaceChildren();
  rows.length = 0;
  const longest = Math.max(...P.words.map(w => w.answer.length));
  const finalSpan = Math.max(...P.finals.map(f => f.answer.length + 0.6 * (f.parts.length - 1)));
  board.style.setProperty("--n", String(longest));
  board.style.setProperty("--lab", String(longest));
  board.style.setProperty("--fn", String(finalSpan));
  // the height every row shares: what the gaps between rows and the rule over the answers leave (isomer.css)
  const m = P.words.length, f = P.finals.length;
  board.style.setProperty("--rows", String(m + f));
  board.style.setProperty("--over", `${((m - 1) * 0.3 + 0.55 + 0.45 + (f - 1) * 0.3 + 0.15).toFixed(2)}rem`);
  const list = el("div", "is-rows");
  P.words.forEach((w, i) => {
    const row = el("div", "is-row");
    row.dataset.i = String(i);
    const lab = el("span", "is-jumble"), sqs = el("span", "is-squares");
    for (let s = 0; s < w.answer.length; s++) { const b = el("button", `is-sq${w.circles.includes(s) ? " ring" : ""}`); b.type = "button"; b.dataset.s = String(s); sqs.append(b); }
    const mark = el("span", "is-tick");
    row.append(lab, sqs, mark);
    list.append(row);
    rows.push({ row, lab, sqs, mark });
  });
  const answers = el("div", "is-answers");
  P.finals.forEach((f, fi) => {
    const i = P.words.length + fi, row = el("div", "is-row is-final");
    row.dataset.i = String(i);
    const sqs = el("span", "is-squares");
    let s = 0;
    f.parts.forEach((n, pi) => {
      if (pi) sqs.append(el("span", "is-gap"));
      for (let j = 0; j < n; j++, s++) { const b = el("button", "is-sq"); b.type = "button"; b.dataset.s = String(s); sqs.append(b); }
    });
    row.append(sqs);
    answers.append(row);
    rows.push({ row, sqs, lab: null, mark: null });
  });
  board.append(list, answers);
  // the rack holds as many tiles as the longest item: one row of them, or two for a long final
  const most = Math.max(...items.map(it => it.letters.length)), lines = most > 8 ? 2 : 1;
  $("rack").style.setProperty("--per", String(Math.ceil(most / lines)));
  $("rack").style.setProperty("--lines", String(lines));
  // two finals' clues, or a clue in halves with a line about the other half, take a taller box, set for the whole puzzle
  $("app").classList.toggle("is-tall-clue", P.finals.length > 1 || S.kind === "pair");
}
const LETTER = ch => ch.toUpperCase();
function render() {
  if (!S) return;
  const run = S.run, active = run.active, pair = S.kind === "pair";
  P.words.forEach((w, i) => {
    const r = rows[i], sealed = pair && G && G.owners[i] !== together.slot && !run.solved[i];
    r.row.className = `is-row${i === active ? " on" : ""}${run.solved[i] ? " done" : ""}${sealed ? " sealed" : ""}`;
    r.lab.textContent = sealed ? "" : LETTER(w.jumble);
    r.lab.setAttribute("aria-label", sealed ? `${partnerName()}'s jumble` : `Jumble ${i + 1}: ${w.jumble.toUpperCase().split("").join(" ")}`);
    drawSquares(r.sqs, i, sealed);
    r.mark.textContent = run.solved[i] ? "✓" : "";
    if (pair && G) {                                            // whose jumble it is, in a pair's match
      const owner = G.owners[i];
      r.mark.style.setProperty("--who", `var(--p${owner})`);
      r.mark.classList.toggle("who", !run.solved[i]);
      if (!run.solved[i]) r.mark.textContent = owner === together.slot ? "" : initial(partnerName());
    } else r.mark.classList.remove("who");
  });
  P.finals.forEach((f, fi) => {
    const i = P.words.length + fi, r = rows[i];
    r.row.className = `is-row is-final${i === active ? " on" : ""}${run.solved[i] ? " done" : ""}`;
    drawSquares(r.sqs, i, false);
  });
  drawClue();
  drawRack();
  drawStrip();
  drawEnd();
}
function drawSquares(box, i, sealed) {
  const it = items[i], run = S.run, locked = run.locked[i];
  [...box.querySelectorAll(".is-sq")].forEach((b, s) => {
    const k = run.squares[i][s], ch = sealed ? "" : k >= 0 ? LETTER(it.letters[k]) : "";
    if (b.textContent !== ch) b.textContent = ch;
    b.classList.toggle("hinted", locked.includes(s));
    b.classList.toggle("full", k >= 0);
    b.disabled = sealed;
  });
}
function drawRack() {
  const box = $("rack"), i = S.run.active, it = items[i], solved = S.run.solved[i];
  const tiles = rackOf(P, S.run, i), playable = mineToPlay(i) && !busyNow();
  // the rack keeps one button a tile, redrawn in place, so a finger on it never loses its tap to a rebuilt row
  while (box.children.length > tiles.length) box.lastChild.remove();
  while (box.children.length < tiles.length) { const b = el("button", "is-tile"); b.type = "button"; box.append(b); }
  tiles.forEach((t, x) => {
    const b = box.children[x], ch = t.open ? LETTER(t.ch) : "";
    if (b.textContent !== ch) b.textContent = ch;
    b.dataset.k = String(t.k);
    b.className = `is-tile${t.used ? " used" : ""}${t.open ? "" : " shut"}`;
    b.disabled = !playable || solved || t.used || !t.open;
    b.setAttribute("aria-label", t.open ? `${t.ch.toUpperCase()}${t.used ? ", placed" : ""}` : "A circled letter still to find");
  });
  box.classList.toggle("final", it.kind === "final");
  for (const id of ["shuffleBtn", "clearBtn", "backBtn", "hintBtn"]) $(id).disabled = !playable || solved;
}
/** The clue panel: what the row in hand asks (a theme's hint, the final's clue), or what just happened. */
function drawClue() {
  const box = $("clue"), i = S.run.active, it = items[i];
  box.replaceChildren();
  box.className = `is-clue${message?.tone ? ` ${message.tone}` : ""}`;
  if (S.run.done) { drawAnswers(box); return; }
  if (message) { box.append(el("p", "is-say", message.text)); return; }
  const pair = S.kind === "pair" && G;
  if (it.kind === "word") {
    const w = P.words[i];
    if (pair && G.owners[i] !== together.slot && !S.run.solved[i]) { box.append(el("p", "is-say", `${partnerName()}'s jumble: ask what letters it has.`)); return; }
    if (w.hint) { box.append(clueLine(w.topic || "Clue", w.hint)); return; }
    if (S.run.solved[i]) { box.append(el("p", "is-say", `${w.answer.toUpperCase()}: solved.`)); return; }
  }
  // the final's clue: on a jumble's row too, as the newspaper's cartoon sits over its jumbles
  if (P.theme) box.append(el("p", "is-say", "Each jumble's hint shows when you're on it."));
  P.finals.forEach((f, fi) => {
    const half = pair ? halfFor(f, together.slot) : f.clue, two = P.finals.length > 1;
    box.append(clueLine([two ? (fi ? "Second" : "First") : "", half.tag].filter(Boolean).join(" · "), half.text));
  });
  if (pair) box.append(el("p", "is-half", `${partnerName()} has the other half of the clue.`));
}
/** A clue as a line: its tag (what it is, its topic) and its words run on after it. */
function clueLine(tag, text) {
  const p = el("p", "is-hint");
  if (tag) p.append(el("span", "is-tag", tag), " ");
  if (text) p.append(text);
  return p;
}
/** Once it's done: every final named in full with its clue, and in a theme each clue with its hint. */
function drawAnswers(box) {
  for (const f of P.finals) {
    const p = el("p", "is-hint");
    p.append(el("b", "", f.text), ` · ${f.told || f.clue.text}`);
    box.append(p);
  }
  if (P.theme) for (const w of P.words) { const p = el("p", "is-note"); p.append(el("b", "", w.text), `: ${w.hint}`); box.append(p); }
}
function drawStrip() {
  const ms = elapsed(), pen = S.kind === "pair" && G ? teamScore(G, 0) : PER_HINT * hintsOf(S.run);
  put("time", clock(ms / 1000));
  put("penalty", pen ? `+${pen} s` : "");
  const o = `${MODES[P.mode].label} · ${LEVELS[P.level].label}`;
  put("where", S.kind === "daily" ? `Today's · ${o}` : S.kind === "pair" ? `With ${partnerName()} · ${o}` : S.kind === "race" ? `Race · ${o}` : o);
  const g = $("ghost");
  if (S.plan) {
    const k = rivalSolved(S.plan, S.run.done ? S.run.ms : ms), all = items.length;
    g.hidden = false;
    put("ghost", k >= all ? `${RIVALS[S.rival].label} done ${clock(S.plan.end / 1000)}` : `${RIVALS[S.rival].label} ${k}/${all}`);
  } else g.hidden = true;
}
const shownText = {};
const put = (id, v) => { if (shownText[id] !== v) { shownText[id] = v; $(id).textContent = v; } };
function drawEnd() {
  const done = S.run.done;
  $("work").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const sc = S.kind === "pair" && G?.done ? G.done.score : scoreOf(S.run), h = S.kind === "pair" && G ? teamScore(G, 0) / PER_HINT : hintsOf(S.run);
  const bits = [h ? `${clock(S.run.ms / 1000)} and ${h} hinted letter${h === 1 ? "" : "s"}` : "no hints"];
  if (S.kind === "random" || S.kind === "daily") {
    const best = read(TIMES, {})[`${P.mode}/${P.level}`];
    if (S.fresh) bits.push("a new best"); else if (best != null && S.ranked) bits.push(`best ${clock(best)}`);
    if (S.plan) bits.push(sc * 1000 <= S.plan.end ? `${RIVALS[S.rival].label} beaten (${clock(S.plan.end / 1000)})` : `${RIVALS[S.rival].label} quicker (${clock(S.plan.end / 1000)})`);
    bits.push(`par ${clock(P.secs)}`);
  }
  const v = $("verdict");
  v.replaceChildren(el("b", "", `Solved in ${clock(sc)}`), el("small", "", bits.join(" · ")));
  $("nextBtn").textContent = S.kind === "race" ? "The result" : S.kind === "pair" ? "Another together" : S.kind === "random" && dailyDue("isomer") ? "Today's puzzle" : "Another";
}
function shake(i) { const r = rows[i]?.row; if (!r) return; r.classList.remove("shake"); void r.offsetWidth; r.classList.add("shake"); }
function glow(i) { const r = rows[i]?.row; if (!r) return; r.classList.remove("glow"); void r.offsetWidth; r.classList.add("glow"); }

// ---------- together: your partner, two jumbles each, the final together (isomer-table.js) ----------
let G = null;                    // the pair's table as last seen, made whole (null: not at one)
let joining = null, offset = 0, stopOffset = null, tableSeen = null;
// when this phone sat down at the pair's table and at the race: a move to the other made since then is followed
let seatedAt = Infinity, raceSeatedAt = Infinity;
const serverNow = () => Date.now() + offset;
const seatedNow = () => { joining?.(); joining = null; };
const partnerName = () => first(together.others()[0]?.name || "Your partner");
const initial = name => (Array.from(first(name))[0] || "?").toUpperCase();
const together = createTogether({
  game: "isomer",
  app: PAIR_APP,
  toast,
  askName,
  valid: isPair,
  slots: 2,
  fresh: async players => freshPair(players, { puzzle: await pairPuzzle(), app: PAIR_APP }),
  onState: onTable,
  onPresence: () => { if (G) { maybeBegin(); render(); } },
  onLeave: () => {
    seatedNow();
    G = null; stopOffset?.(); stopOffset = null; seatedAt = Infinity;
    if (switching) return;
    solo();
  },
  result: pairResult,
});
/** A puzzle for the pair, from the dealer's choices (a theme's jumbles carry their hints to their holder). */
async function pairPuzzle() {
  const o = opts();
  return makePuzzle(randomSeed(), { mode: o.mode, level: o.level, cat: o.cat, mix: mix() });
}
function onTable(val) {
  seatedNow();
  const was = G;
  G = tidyTable(structuredClone(val));
  if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {});
  if (!was) { seatedAt = serverNow(); atTable("pair"); }
  tableSeen?.(); tableSeen = null;
  const kept = read(PAIR, null);
  if (!S || S.kind !== "pair" || was?.n !== G.n || was?.created !== G.created) {
    const mine = kept && kept.code === together.room?.code && kept.uid === together.room?.uid && kept.created === G.created && kept.n === G.n ? kept.run : null;
    show({ kind: "pair", puzzle: G.puzzle, run: mine, rival: "off" });
    if (was && was.n !== G.n) toast("A new puzzle for the two of you");
  }
  // what the table has that this phone hasn't drawn: your partner's solves, the final's letters shown to both
  items.forEach((_, i) => { if (G.solved[itemKey(P, i)] && !S.run.solved[i]) { solveFrom(P, S.run, i); glow(i); } });
  P.finals.forEach((_, fi) => { const i = P.words.length + fi, n = G.fh[`f${fi}`] || 0; if (n) revealTo(P, S.run, i, n); });
  if (!mineToPlay(S.run.active) && !S.run.done) S.run.active = nextOpenFor(S.run.active);
  if (G.done || S.run.done) { S.run.done = true; finish(); }
  maybeBegin();
  save();
  render();
}
/** Both here and the clock not started: this phone starts it, for the two of you. */
function maybeBegin() {
  if (!G || G.start || together.others().length < 1 || !together.others().every(o => o.here)) return;
  const n = G.n;
  together.act(g => beginAt(tidyTable(g), { n, now: serverNow() }));
}
async function solveTogether(i) {
  const n = G.n, slot = together.slot;
  await together.act(g => solveAt(tidyTable(g), { n, i, slot, now: serverNow() }));
}
async function hintTogether(i) {
  const n = G.n, slot = together.slot;
  if (i < P.words.length) {                                     // your own jumble: shown here, counted for the team
    const ok = await together.act(g => hintAt(tidyTable(g), { n, i, slot }));
    if (!ok) return;
    const out = hint(P, S.run, i);
    message = { text: `A letter shown: +${PER_HINT} s for the team.`, tone: "" };
    if (out === "solved") solved(i); else { save(); render(); }
    return;
  }
  // a final's next letter, shown on both phones
  const ok = await together.act(g => hintAt(tidyTable(g), { n, i, slot }));
  if (!ok) toast("That's every letter a hint can show: put the rest in");
}
/** A new puzzle for the two of you (asked first while this one is under way). */
async function againTogether() {
  if (!G) return;
  if (!G.done && Object.keys(G.solved).length && !confirm("Deal a new puzzle for the two of you? This one isn't solved.")) return;
  const n = G.n, puzzle = await pairPuzzle();
  await together.act(g => newGameAt(tidyTable(g), { n, puzzle }));
}

// ---------- a race: the same puzzle for everyone at the table (duel.js) ----------
let switching = false;           // leaving the pair's table for a race, not for solo
const duel = createDuel({
  game: "isomer:race", name: "Isomer", accent: "--is-in", line: $("rival"), toast, lower: true,
  deal: () => {
    const o = opts();
    return { seed: randomSeed(), rival: o.rival, puzzle: makePuzzle(randomSeed(), { mode: o.mode, level: o.level, cat: o.cat, mix: mix() }) };
  },
  describe: m => `${MODES[m.puzzle?.mode]?.label || "Classic"}, ${(LEVELS[m.puzzle?.level]?.label || "Medium").toLowerCase()}: the same jumbles for everyone, the quickest wins`,
  play: (match, { begun, kept }) => {
    switching = false;
    atTable("race");
    const same = kept?.puzzle?.seed === match.puzzle.seed;
    show({ kind: "race", puzzle: match.puzzle, run: same ? kept.run : null, begun, rival: match.rival || "off" });
    tell();
  },
  extra: () => {
    if (!S?.plan) return null;
    return el("p", "duel-note", `The computer (${RIVALS[S.rival].label}) took ${clock(S.plan.end / 1000)}.`);
  },
  extraTitle: "The computer",
  onLobby: () => { S = null; P = null; atTable("race"); lobby(); },
  onLeave: () => { raceSeatedAt = Infinity; if (!switching) solo(); },
});
/** What the table sees of this run: how many are left, and the score once it's done. */
function tell(done = S?.run.done) {
  if (S?.kind !== "race") return;
  const left = S.run.solved.filter(x => !x).length;
  duel.report(done ? { score: scoreOf(S.run), text: `${clock(scoreOf(S.run))}`, done: true } : { score: left, text: `${items.length - left} of ${items.length}` });
}
/** Before a race starts: no puzzle yet. */
function lobby() {
  $("board").replaceChildren(el("p", "is-wait", "The puzzle comes when the race starts."));
  $("clue").replaceChildren();
  $("rack").replaceChildren();
  $("work").hidden = false; $("result").hidden = true;
  for (const id of ["shuffleBtn", "clearBtn", "backBtn", "hintBtn"]) $(id).disabled = true;
  put("time", "0:00"); put("penalty", ""); put("where", "Race");
  $("ghost").hidden = true;
}
/** From the pair's table to a race on the same puzzle kind: both phones go (the partner follows the table's word). */
async function raceInstead() {
  const code = together.room?.code;
  if (!code) return;
  switching = true;
  await together.act(g => { g.race = serverNow(); return true; });
  together.leave();
  if (!(await duel.join(code))) { switching = false; solo(); return; }
  raceSeatedAt = serverNow();
  if (duel.together.room?.data?.start) duel.again();           // a fresh match, not one the two of you raced before
}
/** And back from a pair's race to two jumbles each: both phones go, a new puzzle at the pair's table. */
async function pairInstead() {
  const code = duel.together.room?.code;
  if (!code) return;
  switching = true;
  await duel.together.act(g => { g.pair = serverNow(); return true; });
  duel.leave();
  if (!(await together.join(code))) { switching = false; solo(); return; }
  switching = false;
  await new Promise(res => { if (G) res(); else { tableSeen = res; setTimeout(res, 5000); } });
  // the table the two of you left for the race: a new puzzle on it
  if (G && (G.done || G.race)) { const n = G.n, puzzle = await pairPuzzle(); await together.act(g => newGameAt(tidyTable(g), { n, puzzle })); }
}
const inParty = () => /[?&]party=/.test(location.search);
// which of the pair's two tables this phone was last at (a reload in a pair's race sits down at the race again)
const WHERE = "isomer:where";
const atTable = kind => { const code = (kind === "race" ? duel.together : together).room?.code; if (code && !inParty()) write(WHERE, { code, kind }); };

// ---------- the menu ----------
let pick = null;                 // what New puzzle deals: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {                                               // a race: the table's own (and, for the pair, back to two each)
    const t = part(body, "together");
    duel.menu(t);
    if (!inParty()) t.insertBefore(action("Two jumbles each instead", pairInstead), t.lastElementChild);
    contentPart(body, false);
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  if (together.room || joining) {                              // the pair's match: a new puzzle, a race, back to solo
    const t = part(body, "together");
    if (G) t.append(action("New puzzle together", againTogether, "primary"), line(`With ${partnerName()}: two jumbles each, the final together.`), action("Race instead", raceInstead));
    else { const wait = line(joiningWords()); wait.prepend(sextant()); t.append(wait); }
    t.append(action("Back to solo", backToSolo, "link"));
    contentPart(body, false);
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  pick ??= (S?.kind === "daily" && !S.run.done) || dailyDue("isomer") ? "daily" : "random";
  part(body, "play").append(action("New puzzle", () => confirmDeal(pick), "primary"));
  const content = part(body, "content");
  content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") contentPart(body, true);
  else content.append(line("Today's is a Classic at Medium, every topic in: the same for everyone."));
  part(body, "settings").append(choice("Computer rival", Object.entries(RIVAL_NAMES), opts().rival, v => setOpt("rival", v)));
  const times = read(TIMES, {}), rec = read(RIVAL_RECORD, {});
  const best = S ? times[`${S.puzzle.mode}/${S.puzzle.level}`] : null;
  const vs = Object.entries(rec).filter(([k, v]) => RIVALS[k] && v.won + v.lost).map(([k, v]) => `${RIVALS[k].label} ${v.won}–${v.lost}`);
  part(body, "about").append(line(`${S ? `${MODES[S.puzzle.mode].label}, ${LEVELS[S.puzzle.level].label.toLowerCase()}: ${best != null ? `best ${clock(best)}` : "not solved yet"}. ` : ""}A hinted letter is ${PER_HINT} s.${vs.length ? ` Against the computer: ${vs.join(", ")}.` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The content choices: the mode, the level, what the finals are about (countries, commodities) and the topics. */
function contentPart(body, topics) {
  const o = opts(), content = part(body, "content");
  content.append(choice("Mode", Object.entries(MODES).map(([k, m]) => [k, m.label]), o.mode, v => setOpt("mode", v)),
    choice("Level", Object.entries(LEVELS).map(([k, l]) => [k, l.label]), o.level, v => setOpt("level", v)),
    choice("Answers", Object.entries(CATS), o.cat, v => { setOpt("cat", v); openMenu(); }));
  if (!topics) return;
  const groups = o.cat === "country" ? [["Country topics", KB_TOPICS.country]] : o.cat === "commodity" ? [["Commodity topics", KB_TOPICS.commodity]]
    : [["Country topics", KB_TOPICS.country], ["Commodity topics", KB_TOPICS.commodity]];
  content.append(topicMix(TOPICS, KB_PRESETS, mix(), w => write(MIX, w),
    { groups, note: w => (presetOf(TOPICS, KB_PRESETS, w) === "custom" ? "Your own mix doesn't count for your best; today's and the presets do." : null) }));
}
const backToSolo = () => { if (together.room) together.leave(); else if (duel.on) duel.leave(); else location.replace(location.pathname); };

// ---------- messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}

// ---------- wiring ----------
document.querySelector(".is-mark").innerHTML = APPS.find(a => a.id === "isomer")?.logo || "";
bindSwitcher($("appsBtn"), "isomer");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("board").addEventListener("click", e => {
  const row = e.target.closest(".is-row");
  if (!row || !S) return;
  const i = Number(row.dataset.i), sq = e.target.closest(".is-sq");
  if (sq && !sq.disabled) tapSquare(i, Number(sq.dataset.s));
  else choose(i);
});
$("rack").addEventListener("click", e => { const b = e.target.closest(".is-tile"); if (b && !b.disabled) tapTile(Number(b.dataset.k)); });
$("shuffleBtn").addEventListener("click", shuffleRack);
$("clearBtn").addEventListener("click", clearRow);
$("backBtn").addEventListener("click", takeBack);
$("hintBtn").addEventListener("click", useHint);
$("nextBtn").addEventListener("click", () => {
  if (S?.kind === "race") duel.open();
  else if (S?.kind === "pair") againTogether();
  else deal(dailyDue("isomer") ? "daily" : "random");
});
document.addEventListener("keydown", e => {
  if (!S || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
  const k = e.key;
  if (/^[a-z]$/i.test(k)) { e.preventDefault(); typeLetter(k.toLowerCase()); }
  else if (k === "Backspace") { e.preventDefault(); takeBack(); }
  else if (k === "Enter" || k === "Tab") { e.preventDefault(); choose(nextOpenFor(S.run.active)); }
  else if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); choose((S.run.active + (k === "ArrowDown" ? 1 : items.length - 1)) % items.length); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); together.resync(); duel.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) { together.resync(); duel.resync(); } });
window.addEventListener("pagehide", () => clockPause());
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);
// a partner who went from the pair's table to a race, or back, since this phone sat down: it follows them there
setInterval(() => {
  if (switching) return;
  if (G?.race && G.race >= seatedAt && together.room) {
    const code = together.room.code;
    switching = true;
    together.leave();
    duel.join(code).then(ok => { raceSeatedAt = serverNow(); if (!ok) { switching = false; solo(); } });
  } else if (duel.on && !inParty() && (duel.together.room?.data?.pair || 0) >= raceSeatedAt) {
    const code = duel.together.room.code;
    switching = true;
    duel.leave();
    together.join(code).then(ok => { switching = false; if (!ok) solo(); });
  }
}, 1000);

// for tests and debugging
window.__isomer = { get state() { return S; }, get table() { return G; }, deal, show, choose, tapTile, typeLetter, useHint, together, duel };

// ---------- starting ----------
const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
function solo() {
  const kept = read(RUN, null);
  const ok = kept?.puzzle?.words && (kept.kind === "random" || kept.kind === "daily");
  if (forToday && !IN_FRAME && !(ok && kept.kind === "daily" && kept.day === today())) {
    if (!(ok && kept.run && !kept.run.done && (kept.run.squares || []).some(sq => sq.some(k => k >= 0))) || confirm("Today's puzzle is waiting. Leave the one you've started?")) { deal("daily"); return; }
  }
  if (ok) show(kept);
  else if (!IN_FRAME) deal(dailyDue("isomer") ? "daily" : "random");
}
// a table in the address (the pair's match or their race, a party's race): the rete until it's drawn, and no solo
// puzzle under it. A request said yes to (&new=) is always the pair's split match; a reload goes back to whichever of
// the pair's two tables this phone was at.
const code = roomInAddress(), where = read(WHERE, null);
const toRace = inParty() || (!new URLSearchParams(location.search).has("new") && where?.code === code && where.kind === "race");
if (code && toRace) duel.join(code).then(ok => { raceSeatedAt = serverNow(); if (!ok) solo(); });
else if (code) { joining = busy(joiningWords(), { delay: 0 }); together.join(code).then(ok => { if (!ok) { seatedNow(); solo(); } }); }
else solo();
// once the page is up, the solver's model and word lists are made in a quiet moment, so the next deal is quick
if (!IN_FRAME) setTimeout(() => { try { makePuzzle(1, { mode: "classic", level: "easy" }); } catch { /* the deal will say */ } }, 1500);
