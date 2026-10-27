// Lode: Strands' genre on the knowledge base. A board of 48 letters hides a country's or a commodity's words, each a
// path of touching letters, every letter used once; the word that spans the board names the theme, the mother lode.
// Trace a word by dragging through its letters, or tap them and tap the last again. Other English words of four letters
// or more earn hints, three a hint. Your time plus 30 seconds a hint is your score. The boards, rules and rival are
// lode-engine.js's, the table lode-table.js's, the drawing and the finger lode-board.js's; this file keeps the run, the
// clock, the menu and the table. Together (together.js): one board for the table, as a team with the letters shared out
// (each sees only theirs) or as a race, everyone on their own phone.
import { CELLS, MIN_WORD, LEVELS, SHAPES, RIVALS, PER_HINT, HINT_COST, SHOW_COST, POOLS, GROUPS, THEMES, themeById, boardFor, dailyDeal, newRun, tidyRun, submit, useHint, giveUp,
  scoreOf, missesOf, lockedCells, rivalPlan, rivalAt } from "./lode-engine.js";
import { MODES, isTable, tidy, tidyBoard, freshTable, readable, presentSlots, traceText, tracesOf, submitAt, hintAt, giveUpAt, runOf, beginAt, reportAt,
  botAt, standingsOf, raceOver, newGameAt, resultOf } from "./lode-table.js";
import { createBoardView } from "./lode-board.js";
import { BANK } from "./core.js";
import { KB_TOPICS, KB_PRESETS, cleanMix, presetOf, even, mixParam, mixFromParam } from "./topics.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, ticks, topicMix, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";   // the day, the same for everyone (UTC); a watching frame runs no clock and writes nothing
import { roundOver } from "./random.js";
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords, branchPath } from "./rooms.js";
import { busy, sextant } from "./loading.js";
import { leaderboard } from "./standings.js";
import * as pile from "./pile.js";

dropdown(document.getElementById("pool"));

const $ = id => document.getElementById(id);
const RUN = "lode:run", SET = "lode:settings", TIMES = "lode:times", SEEN = "lode:seen", TABLE = "lode:table";
const APP = 1;                       // the table's version: a phone with older code is updated before it sits down
const SAVE_EVERY = 5000;             // ms between saves of a board in play (a partner watching sees it that often)
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const fmt = secs => { const s = Math.max(0, Math.round(secs)), m = Math.floor(s / 60), p = n => String(n).padStart(2, "0"); return m >= 60 ? `${Math.floor(m / 60)}:${p(m % 60)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inWords = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n);
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const first = name => String(name || "Player").trim().split(/\s+/)[0];

// ---------- settings: what the next board deals, and how it's shown ----------
const ALL_TOPICS = [...KB_TOPICS.country, ...KB_TOPICS.commodity];
const CLUES = { title: "Title", every: "Every word" };
const ALL_GROUPS = [...GROUPS.country, ...GROUPS.commodity].map(([k]) => k);
function cleanSettings(s) {
  return {
    level: LEVELS[s?.level] ? s.level : "medium",
    shape: SHAPES[s?.shape] ? s.shape : "square",
    clues: CLUES[s?.clues] ? s.clues : "title",
    rival: RIVALS[s?.rival] ? s.rival : "off",
    pool: POOLS[s?.pool] ? s.pool : "mixed",
    mix: cleanMix(ALL_TOPICS, s?.mix),
    off: Array.isArray(s?.off) ? s.off.filter(k => ALL_GROUPS.includes(k)) : [],
  };
}
let settings = cleanSettings(read(SET, {}));
const saveSettings = () => { if (!IN_FRAME) write(SET, settings); };
$("pool").value = settings.pool;
const mixOf = set => (even(ALL_TOPICS, set.mix) ? null : set.mix);

// ---------- the solo board ----------
// S: { deal ({ seed, theme, level, shape, mix }), mode ("random", "daily" or "link"), day (a daily's), board (the board
// itself, kept so a reload or a new version never re-deals it), run (the engine's), clues, rival (a level, or null),
// fresh (a new best), told (the rival's finish was said) }
let S = null;
let clockFrom = null, savedAt = 0, paused = false;
let message = null;                  // { text, tone }: what the line under the board says until the next trace
let lastFound = null;                // the word just found, drawn fresh
let clueAt = 0;                      // the clue showing, in Every word
let spare = null;                    // the next random board, dealt ahead for the settings it was dealt with

const view = createBoardView($("stage"), { onTrace, onSubmit, usable: cell => usable(cell) });

const validS = s => !!s && !!s.board?.letters && s.board.letters.length === CELLS && Array.isArray(s.board.words) && !!s.run && !!s.deal;
function save() {
  if (IN_FRAME || !S) return;
  write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && !S.run.done && (S.run.found.length > 0 || S.run.extra.length > 0 || S.run.ms > 20000);

// ---------- the clock: a solo board counts the time it's on screen; a table's runs on the database's clock ----------
function clockRun() {
  if (IN_FRAME || G || !S || S.run.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null || !S) return;
  S.run.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); }, () => { paused = false; clockRun(); });   // the menu, the rules, the games screen
const soloMs = () => (S ? S.run.ms + (clockFrom != null ? performance.now() - clockFrom : 0) : 0);
const serverNow = () => Date.now() + offset;

// ---------- what's on screen: the solo board, or the table's ----------
// at a table in Team: the table's run; in Race: this phone's own run of the table's board
let G = null, myRace = null, joining = null, offset = 0, stopOffset = null, nextMode = null, nextBot = "off";
function context() {
  if (G) {
    const team = G.mode === "team";
    return { board: G.board, run: team ? G.team : myRace?.run || newRun(), table: true, team, race: !team, clues: G.clues || "title", level: G.board.level };
  }
  return S ? { board: S.board, run: S.run, table: false, team: false, race: false, clues: S.clues, level: S.deal.level } : null;
}
/** How long the board in front of you has run, in ms: a solo board's own clock, a team's from the table's start, a race
 *  run's from its own start. */
function elapsed(ctx = context()) {
  if (!ctx) return 0;
  if (!ctx.table) return soloMs();
  if (ctx.team) return G.team.done ? G.team.ms : Math.max(0, serverNow() - G.start);
  return myRace?.run.done ? myRace.run.ms : raceMs();
}
/** This phone's race run so far, on the database's clock from its own start. */
const raceMs = () => { const begun = G && runOf(G, together.slot)?.begun; return begun ? Math.max(0, serverNow() - begun) : 0; };
const counting = () => !!G && serverNow() < G.start;           // a table's countdown before its board opens
function usable(cell) {
  const ctx = context();
  if (!ctx || ctx.run.done || IN_FRAME || counting() || (ctx.race && !runOf(G, together.slot)?.begun)) return false;
  return !lockedCells(ctx.board, ctx.run)[cell];
}

// ---------- tracing ----------
function onTrace(cells) {
  const ctx = context();
  if (!ctx) return;
  message = null;
  const sealed = ctx.team ? sealedCells() : null;
  const text = cells.map(c => (sealed?.[c] ? "?" : ctx.board.letters[c])).join("");
  drawWord(text);
  if (ctx.team) shareTrace(cells);
}
function onSubmit(cells) {
  const ctx = context();
  if (!ctx || ctx.run.done || cells.length === 0) return;
  if (ctx.team) { shareTrace([], true); submitTeam(cells); return; }
  if (ctx.race) ctx.run.ms = raceMs();                         // the run's time as it stands, so the last word stops it right
  const out = submit(ctx.board, ctx.run, cells);
  said(out, ctx);
  if (out.kind === "span" || out.kind === "theme") {
    lastFound = out.w;
    if (ctx.clues === "every") clueAt = nextClue(ctx);
    navigator.vibrate?.(18);
  }
  if (ctx.race) { keepRace(); tellRace(); if (ctx.run.done) finishRace(); }
  else if (ctx.run.done) finishSolo();
  else save();
  render();
}
/** What a trace came to, in the line under the board. */
function said(out, ctx, who = null) {
  const b = ctx.board, by = who ? `${who} found ` : "";
  const w = out.w != null ? b.words[out.w] : null;
  const t = {
    span: () => [`${by}${w?.text}, the mother lode: the theme is ${b.name}.`, "gold"],
    theme: () => [`${by}${w?.text}${out.moved ? " (it runs here)" : ""}: ${lower(w?.hint)}`, "good"],
    word: () => [out.earned ? `${out.text}: a hint earned.` : `${out.text}: ${plural(PER_HINT - ctx.run.meter, "more word")} for a hint.`, ""],
    had: () => [`${out.text} counted already.`, ""],
    again: () => [`${out.text} is found already.`, ""],
    short: () => ["Four letters or more.", "bad"],
    not: () => [`${out.text} isn't in the word list.`, "bad"],
    moved: () => ["The table has moved on to another board.", "bad"],
  }[out.kind];
  if (!t) return;
  const [text, tone] = t();
  message = { text, tone };
  if (tone === "bad") navigator.vibrate?.(10);
}
const lower = s => String(s || "").replace(/^./, c => c.toLowerCase());

// ---------- drawing ----------
function sealedCells() {
  if (!G || G.mode !== "team" || together.slot == null) return null;
  const open = readable(G, together.slot, present());
  return Uint8Array.from(open, x => (x ? 0 : 1));
}
function drawBoard(ctx) {
  // at a team's table each word takes its finder's colour; until a table's board opens, its letters stay sealed, so
  // nobody starts early
  const found = ctx.run.found.map(w => ({ w, kind: w === 0 ? "span" : "theme", fresh: w === lastFound, slot: ctx.team && w ? G.by[`w${w}`] ?? null : null }));
  const shown = ctx.run.revealed.map(w => ({ w, kind: "shown" }));
  view.set(ctx.board, {
    found: [...found, ...shown],
    hint: ctx.run.hint,
    sealed: counting() ? new Uint8Array(CELLS).fill(1) : ctx.team ? sealedCells() : null,
    others: ctx.team && together.room ? tracesOf(G, together.room.here, together.room.uid) : [],
  });
  view.freeze(IN_FRAME || ctx.run.done || counting());
}
const kindWords = { country: "a country", commodity: "a commodity" };
function drawTheme(ctx) {
  const b = ctx.board, spanFound = ctx.run.found.includes(0) || ctx.run.done;
  const every = ctx.clues === "every";
  $("clueNav").hidden = !every;
  if (!every) {
    $("kind").textContent = spanFound ? `Theme · ${b.name}` : ctx.level === "hard" ? "Theme" : `Theme · ${kindWords[b.kind]}`;
    $("title").textContent = `“${b.title.text}”`;
    $("title").classList.remove("lo-clue");
    return;
  }
  const order = clueOrder(ctx), k = Math.min(clueAt, order.length - 1), w = order[k], word = b.words[w];
  const got = ctx.run.found.includes(w) || ctx.run.revealed.includes(w);
  $("kind").textContent = spanFound ? `Theme · ${b.name}` : `Clues · ${kindWords[b.kind]}`;
  $("clueAt").textContent = `${k + 1} of ${order.length}`;
  $("title").classList.add("lo-clue");
  $("title").textContent = w === 0 ? `${got ? word.text : `${word.text.length} letters`}: the theme, from side to side`
    : `${got ? word.text : `${word.text.length} letters`}: ${word.hint}`;
}
/** Every word's clue, the spanning word's last. */
const clueOrder = ctx => [...ctx.board.words.keys()].filter(i => i).concat(0);
function nextClue(ctx) {
  const order = clueOrder(ctx), open = i => !ctx.run.found.includes(order[i]) && !ctx.run.revealed.includes(order[i]);
  for (let k = 1; k <= order.length; k++) { const i = (clueAt + k) % order.length; if (open(i)) return i; }
  return clueAt;
}
function drawStrip(ctx) {
  const n = ctx.board.words.length;
  $("count").textContent = String(ctx.run.found.length);
  $("total").textContent = String(n);
  const pen = HINT_COST * ctx.run.hints + SHOW_COST * ctx.run.revealed.length;
  $("clock").textContent = counting() ? `${Math.ceil((G.start - serverNow()) / 1000)}` : fmt(elapsed(ctx) / 1000 + pen);
  $("penalty").textContent = pen ? `+${pen} s` : "";
  drawOthers(ctx);
}
/** The line beside the count: the rival's progress solo, the others' at a table. */
function drawOthers(ctx) {
  const box = $("others");
  const bits = [];
  if (!ctx.table && S?.rival) {
    const plan = planFor(S), at = rivalAt(plan, soloMs());
    bits.push([RIVALS[S.rival].label, at.done ? `done ${fmt(at.at / 1000)}` : `${at.found} of ${plan.length}`, null]);
  } else if (ctx.race) {
    for (const p of others()) { const r = runOf(G, p.slot); bits.push([first(p.name), r?.done ? `done ${fmt(r.score)}` : r?.begun ? `${r.found || 0} of ${ctx.board.words.length}` : p.here ? "ready" : "away", p.slot, p.here]); }
    const b = botAt(G, Math.max(0, serverNow() - G.start));
    if (b) bits.push([b.label, b.done ? `done ${fmt(b.score)}` : `${b.found} of ${b.of}`, null]);
  } else if (ctx.team) {
    for (const p of others()) bits.push([first(p.name), p.here ? "here" : "away", p.slot, p.here]);
  }
  box.hidden = !bits.length;
  box.replaceChildren(...bits.flatMap(([who, what, slot, here = true], i) => {
    const s = el("span", `lo-who${here ? "" : " away"}`);
    if (slot != null) { const dot = el("i", "lo-dot"); dot.style.background = `var(--p${slot % 6})`; s.append(dot); }
    s.append(el("b", "", who), ` ${what}`);
    return i ? [" · ", s] : [s];
  }));
}
function drawWord(tracing = null) {
  const w = $("word"), ctx = context();
  let text, tone = "";
  if (tracing != null && tracing.length) { text = tracing; tone = "tracing"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (!ctx) text = "";
  else if (counting()) text = "Get ready: the board opens for everyone at once.";
  else if (ctx.run.done) text = "";
  else if (ctx.team && G) text = "Trace through any letters. A sealed one is a team mate's: ask what it is, by where it is (C4).";
  else text = "Drag through touching letters, or tap them and tap the last again.";
  if (w.textContent !== text) w.textContent = text;
  w.className = `lo-word${tone ? ` ${tone}` : ""}`;
}
/** The words found so far with what links each to the theme, the newest first (shown held sideways, in the room the
 *  side column has). */
function drawFound(ctx) {
  const list = $("found"), b = ctx.board;
  const items = [...ctx.run.found].reverse().map(w => {
    const li = el("li", w ? "" : "span");
    if (ctx.team && w && G.by[`w${w}`] != null) li.style.setProperty("--vein", `var(--p${G.by[`w${w}`] % 6})`);
    li.append(el("b", "", b.words[w].text), el("span", "", w ? b.words[w].hint : `The mother lode: ${b.name}`));
    return li;
  });
  list.replaceChildren(...items);
}
function drawTools(ctx) {
  const r = ctx.run, done = r.done;
  $("tools").hidden = done;
  $("word").hidden = done;                                     // the result takes the line's room, so the board keeps its size
  $("result").hidden = !done;
  const hint = $("hintBtn");
  hint.disabled = done || r.charges <= 0 || IN_FRAME || counting();
  $("hintText").textContent = r.charges > 1 ? `Hint ×${r.charges}` : "Hint";
  [...$("meter").children].forEach((pip, k) => pip.classList.toggle("on", k < r.meter));
  $("meter").setAttribute("aria-label", `${r.meter} of ${PER_HINT} words towards a hint${r.charges ? `, ${plural(r.charges, "hint")} in hand` : ""}`);
  if (done) drawResult(ctx);
}
function drawResult(ctx) {
  const r = ctx.run, sc = scoreOf(r), bits = [];
  if (r.gaveUp) bits.push(`${plural(r.revealed.length, "word")} shown`);
  if (r.hints) bits.push(plural(r.hints, "hint"));
  let head;
  const took = ms => `${r.gaveUp ? "Shown" : "Found"} in ${fmt(ms / 1000)}${bits.length ? `, ${bits.join(", ")}: ${fmt(sc)}` : ""}.`;
  if (ctx.team) {
    const by = {};
    for (const [k, slot] of Object.entries(G.by || {})) by[slot] = (by[slot] || 0) + (k === "w0" ? 0 : 1);
    const names = people().map(p => `${p.me ? "you" : first(p.name)} ${by[p.slot] || 0}`);
    head = `Together: ${lower(took(G.team.ms))}${names.length ? ` Words: ${names.join(", ")}.` : ""}`;
  } else if (ctx.race) {
    head = took(r.ms);
  } else {
    const best = read(TIMES, {})[bestKey(S)];
    head = took(r.ms);
    if (!r.gaveUp) head += S.fresh ? " A new best." : best != null ? ` Your best here: ${fmt(best)}.` : "";
    if (S.rival) {
      const end = Math.round(rivalAt(planFor(S), Infinity).at / 1000);
      head += sc < end ? ` ${RIVALS[S.rival].label} took ${fmt(end)}: you win by ${fmt(end - sc)}.` : sc > end ? ` ${RIVALS[S.rival].label} was ${fmt(sc - end)} quicker.` : ` ${RIVALS[S.rival].label} tied.`;
    }
  }
  $("verdict").textContent = head;
  $("verdict").className = `lo-verdict${r.gaveUp ? "" : " good"}`;
  $("nextBtn").textContent = ctx.race ? "The race" : "New board";
}
function render() {
  const ctx = context();
  if (!ctx) { drawWord(); return; }
  drawTheme(ctx); drawStrip(ctx); drawBoard(ctx); drawWord(); drawTools(ctx); drawFound(ctx);
}

// ---------- the solo board's life ----------
const bestKey = s => `${s.deal.level}:${s.deal.shape}`;
/** A finished board's score as the best for its level and shape (lowest wins); true if it's a new best. Kept in
 *  lode:times, not lode:best, which the games screen would read as highest-is-best. */
function recordBest(sc) {
  const times = read(TIMES, {}), k = bestKey(S), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}
/** Puts a board on the table: made = { deal, board }. */
function begin(made, mode, day = null) {
  // today's board is the same for everyone, shown by its title too (a rival changes nothing of its score)
  S = { deal: made.deal, mode, day, board: made.board, run: newRun(), clues: mode === "daily" ? "title" : settings.clues, rival: settings.rival !== "off" ? settings.rival : null, fresh: false, told: false };
  lastFound = null; clueAt = 0; message = null; clockFrom = null;
  view.clear();
  if (mode !== "daily") write(SEEN, [...read(SEEN, []).filter(id => id !== made.deal.theme), made.deal.theme].slice(-30));
  history.replaceState(null, "", hashFor(S));
  save();
  clockRun();
  render();
  setTimeout(dealSpare, 1500);
}
const spareKey = s => JSON.stringify([s.level, s.shape, s.pool, s.off, mixOf(s)]);
/** A random board for the settings: the one dealt ahead if it's for them, else a new one. Nothing in the regions and
 *  sectors chosen can fill a board: every theme. */
function dealRandom(set = settings) {
  if (spare?.key === spareKey(set)) { const m = spare.made; spare = null; return m; }
  const deal = { seed: randomSeed(), level: set.level, shape: set.shape, mix: mixOf(set), pool: set.pool, off: set.off, avoid: read(SEEN, []) };
  return boardFor(deal) || { ...boardFor({ ...deal, pool: "mixed", off: [] }), fell: true };
}
/** The next board, dealt while you play this one, so Another board is at once. */
function dealSpare() {
  if (IN_FRAME || G || (spare && spare.key === spareKey(settings))) return;
  const key = spareKey(settings), made = dealRandom();
  spare = { key, made };
}
function start(mode) {
  const done = busy("Dealing a board");
  try {
    if (mode === "daily") { const d = today(), made = boardFor(dailyDeal(d)); begin(made, "daily", d); return; }
    const made = dealRandom();
    begin(made, "random");
    if (made.fell) toast("No theme left in the regions and sectors chosen: this board is from every theme", 3600);
  } finally { done(); }
}
function confirmStart(mode) {
  if (started() && !confirm("Start a new board? This one isn't finished.")) return false;
  start(mode);
  return true;
}
function finishSolo() {
  clockPause();
  const sc = scoreOf(S.run);
  if (!S.run.gaveUp) S.fresh = recordBest(sc);
  if (S.mode === "daily") noteDayTime("lode", sc, S.day);          // today's board: the first finish counts
  learnFrom(S.board, S.run);
  save();
  render();
  roundOver("lode");
}
/** The pile (Deck): a word you needed a hint for, or were shown, comes back as a question; one found unaided that
 *  was due counts as known. */
function learnFrom(b, run) {
  if (IN_FRAME) return;
  const t = themeById(b.theme), missed = new Set(missesOf(b, run));
  const others = BANK.filter(a => a.cat === b.kind && a.entity !== b.theme).map(a => a.name);
  const three = () => { const a = [...others]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 3); };
  b.words.forEach((w, i) => {
    if (!i || !t) return;
    const key = `${b.theme}|${w.text}`;
    if (missed.has(i)) {
      const options = [b.name, ...three()];                   // Deck deals fresh wrong ones each time
      pile.record("lode", key, { ask: `Lode · which ${b.kind}`, prompt: `${w.shown}: ${w.hint}`, options, right: [0], note: `${b.name}: ${w.shown}, ${lower(w.hint)}`,
        about: [w.entity, b.theme].filter(Boolean) }, run.revealed.includes(i) ? "miss" : "hint");
    } else if (run.found.includes(i) && pile.has("lode", key)) pile.answer("lode", key, true);
  });
}
function useHintNow() {
  const ctx = context();
  if (!ctx || ctx.run.done || ctx.run.charges <= 0 || IN_FRAME) return;
  if (ctx.team) { together.act(g => hintAt(tidy(g), { n: G.n }) != null); return; }
  const h = useHint(ctx.board, ctx.run);
  if (!h) return;
  message = { text: h.step === 2 ? "Hint: the lit word's letters, numbered in order." : `Hint: the ringed letters are a word${h.w === 0 ? ", the spanning one" : ""}. Another hint numbers them.`, tone: "good" };
  if (ctx.race) { keepRace(); tellRace(); } else save();
  render();
}
function giveUpNow() {
  const ctx = context();
  if (!ctx || ctx.run.done) return;
  if (!confirm(`Show the words still hidden? Each adds ${SHOW_COST} seconds.`)) return;
  if (ctx.team) { together.act(g => giveUpAt(tidy(g), { n: G.n, now: serverNow() })); return; }
  if (ctx.race) { ctx.run.ms = raceMs(); giveUp(ctx.board, ctx.run); finishRace(); return; }
  clockPause();
  giveUp(S.board, S.run);
  finishSolo();
}
const plans = new Map();
const planFor = s => { const k = `${s.board.seed}/${s.board.theme}/${s.rival}`; if (!plans.has(k)) plans.set(k, rivalPlan(s.board, s.rival)); return plans.get(k); };
/** The solo rival's finish, said once. */
function watchRival() {
  if (!S?.rival || S.told || S.run.done || G) return;
  const at = rivalAt(planFor(S), soloMs());
  if (at.done) { S.told = true; toast(`${RIVALS[S.rival].label} has every word, in ${fmt(at.at / 1000)}. Carry on: your own time counts.`, 4200); save(); }
}

// ---------- links ----------
function hashFor(s) {
  const d = s.deal, m = d.mix ? `&m=${mixParam(ALL_TOPICS, d.mix)}` : "";
  return `#${s.mode === "daily" ? "d" : "s"}=${d.seed}&t=${d.theme}&l=${d.level}&b=${d.shape}${m}`;
}
/** The board a link names, or null. */
function hashDeal() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s")), theme = h.get("t");
  if (!seed || !themeById(theme)) return null;
  const mix = h.get("m") ? mixFromParam(ALL_TOPICS, h.get("m")) : null;
  return { seed, theme, level: LEVELS[h.get("l")] ? h.get("l") : "medium", shape: SHAPES[h.get("b")] ? h.get("b") : "square", mix: mix && !even(ALL_TOPICS, mix) ? mix : null, daily: h.has("d") };
}
const sameDeal = (s, d) => !!s && s.deal.seed === d.seed && s.deal.theme === d.theme && s.deal.level === d.level && s.deal.shape === d.shape;
function startLinked(d) {
  const made = boardFor(d);
  if (!made) { start("random"); return; }
  begin(made, d.daily && d.seed === today() ? "daily" : "link", d.daily ? d.seed : null);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${S ? hashFor(S) : ""}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- the words, with what links them to the theme ----------
function openWords() {
  const ctx = context();
  if (!ctx) return;
  const b = ctx.board, r = ctx.run, over = r.done, body = $("wordsBody");
  $("wordsHead").textContent = over || r.found.includes(0) ? `${b.name}: the words` : "The words";
  const list = el("ol", "lo-wlist");
  b.words.forEach((w, i) => {
    const got = r.found.includes(i), shown = r.revealed.includes(i), open = got || shown || over;
    const li = el("li", `${i ? "" : "span "}${got ? "got" : shown ? "shown" : "hidden"}`);
    li.append(el("b", "lo-wtext", open ? w.text : "•".repeat(w.text.length)));
    const why = !open ? `${w.text.length} letters${i ? "" : ", from side to side: the theme"}` : i ? w.hint : `the theme, ${b.name}, from side to side`;
    const tags = [];
    if (G?.mode === "team" && G.by[`w${i}`] != null) tags.push(nameOfSlot(G.by[`w${i}`]));
    if (r.hinted.includes(i)) tags.push("a hint");
    if (shown) tags.push("shown");
    li.append(el("span", "lo-why", why));
    if (tags.length) li.append(el("small", "lo-tags", tags.join(" · ")));
    list.append(li);
  });
  const extra = r.extra.length ? el("p", "lo-extra", `Other words: ${r.extra.map(x => x.toLowerCase()).join(", ")}.`) : null;
  body.replaceChildren(list, ...(extra ? [extra] : []));
  if (over && b.title.word) body.append(el("p", "lo-extra", `The title was ${b.title.word}'s clue: “${b.title.text}”`));
  if (!$("wordsDlg").open) $("wordsDlg").showModal();
}

// ---------- the menu ----------
let pick = null;                                              // what the menu's New board starts: "random" or "daily"
const presetsOfKb = Object.fromEntries(Object.entries(KB_PRESETS).map(([k, p]) => [k, { label: p.label, topics: cleanMix(ALL_TOPICS, p.topics) }]));
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (G || joining) menuTable(body);
  else menuSolo(body);
  part(body, "play").append(action("The rules", showRules, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function menuSolo(body) {
  pick ??= S?.mode === "daily" ? "daily" : "random";
  part(body, "play").append(action("New board", () => confirmStart(pick), "primary"));
  const content = part(body, "content");
  content.append(choice("Board", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") {
    content.append(mirror("Themes", $("pool")));
    content.append(choice("Level", Object.entries(LEVELS).map(([k, L]) => [k, L.label]), settings.level, v => { settings.level = v; saveSettings(); }));
    contentChoices(content);
  } else content.append(line("Today's board is Medium and square, from every theme: the same for everyone."));
  settingsPart(part(body, "settings"));
  if (S && !S.run.done) part(body, "settings").append(action("Show the words still hidden", giveUpNow, "link"));
  const about = part(body, "about"), times = read(TIMES, {});
  about.append(line(S ? `${LEVELS[S.deal.level].label}, ${SHAPES[S.deal.shape].toLowerCase()}: ${times[bestKey(S)] != null ? `best ${fmt(times[bestKey(S)])}` : "no best yet"}. A hint adds ${HINT_COST} s.` : ""),
    action("Copy a link to this board", copyLink, "link"));
}
/** Topics, regions and sectors: what the next random board deals from. */
function contentChoices(box) {
  const groups = [];
  if (settings.pool !== "commodities") groups.push(["Country topics", KB_TOPICS.country]);
  if (settings.pool !== "countries") groups.push(["Commodity topics", KB_TOPICS.commodity]);
  box.append(topicMix(ALL_TOPICS, presetsOfKb, settings.mix, v => { settings.mix = cleanMix(ALL_TOPICS, v); saveSettings(); }, {
    groups, note: m => (presetOf(ALL_TOPICS, presetsOfKb, m) === "custom" ? "A word of topics left out comes only when a theme can't fill a board without it." : ""),
  }));
  const kinds = settings.pool === "mixed" ? ["country", "commodity"] : settings.pool === "countries" ? ["country"] : ["commodity"];
  for (const kind of kinds) {
    const options = GROUPS[kind], label = kind === "country" ? "Regions" : "Sectors";
    const on = options.map(([k]) => k).filter(k => !settings.off.includes(k));
    const wrap = el("div", "lo-include");
    const draw = () => {
      const now = options.map(([k]) => k).filter(k => !settings.off.includes(k));
      wrap.replaceChildren(ticks(label, options, now, v => { settings.off = [...settings.off.filter(k => !options.some(([o]) => o === k)), ...options.map(([k]) => k).filter(k => !v.includes(k))]; saveSettings(); }));
      const all = el("p", "lo-allnone");
      const set = keep => { settings.off = [...settings.off.filter(k => !options.some(([o]) => o === k)), ...(keep ? [] : options.map(([k]) => k))]; saveSettings(); draw(); };
      const a = el("button", "link", "All"), n = el("button", "link", "None");
      a.type = n.type = "button";
      a.addEventListener("click", () => set(true));
      n.addEventListener("click", () => set(false));
      all.append(a, " · ", n);
      wrap.append(all);
    };
    draw();
    if (on.length) box.append(wrap);
  }
}
function settingsPart(box) {
  box.append(choice("Board", Object.entries(SHAPES), settings.shape, v => { settings.shape = v; saveSettings(); }));
  box.append(choice("Clues", Object.entries(CLUES), settings.clues, v => { settings.clues = v; saveSettings(); }));
  if (!G) box.append(choice("Rival", [["off", "None"], ...Object.entries(RIVALS).map(([k, r]) => [k, r.label])], settings.rival, v => { settings.rival = v; saveSettings(); }));
  box.append(line("The board, clues and rival apply from the next board."));
}
function menuTable(body) {
  const table = part(body, "together");
  if (!G) { const wait = line(joiningWords()); wait.prepend(sextant()); table.append(wait); return; }
  const here = people().filter(p => p.here || p.me).map(p => (p.me ? "you" : first(p.name)));
  table.append(line(`${MODES[G.mode]}: ${here.join(", ")}${G.mode === "team" ? ". Each sees only their own letters." : ", each on their own board."}`));
  nextMode ??= G.mode;
  table.append(choice("Next board", Object.entries(MODES), nextMode, v => { nextMode = v; openMenu(); }));
  if (nextMode === "race") table.append(choice("Rival", [["off", "None"], ...Object.entries(RIVALS).map(([k, r]) => [k, r.label])], nextBot, v => { nextBot = v; }));
  table.append(action("A new board", dealForTable, "primary"));
  const content = part(body, "content");
  content.append(mirror("Themes", $("pool")));
  content.append(choice("Level", Object.entries(LEVELS).map(([k, L]) => [k, L.label]), settings.level, v => { settings.level = v; saveSettings(); }));
  content.append(choice("Board", Object.entries(SHAPES), settings.shape, v => { settings.shape = v; saveSettings(); }));
  content.append(choice("Clues", Object.entries(CLUES), settings.clues, v => { settings.clues = v; saveSettings(); }));
  if (!context()?.run.done) part(body, "settings").append(action("Show the words still hidden", giveUpNow, "link"));
  part(body, "together").append(action("Back to solo", () => together.leave(), "link"));
}

// ---------- the rules ----------
// The header's Rules and the menu's The rules: Lode as it's played here, its numbers the engine's own, so the sheet
// can't drift from the game. A solo clock and the rival stand still while it's open, as for the menu (menu.js).
function showRules() {
  const paces = Object.values(RIVALS).map(r => r.label).join(", ").replace(/, (\w+)$/, " or $1");
  $("rulesBody").innerHTML = `
    <p>A board of ${CELLS} letters hides a theme's words. Each word is a path of touching letters (sideways, up and down, or diagonally), no letter used twice, and between them the words use every letter on the board exactly once. One of them, the mother lode, names the theme and spans the board, touching two opposite sides.</p>
    <p><b>The theme.</b> A country or a commodity from the knowledge base, and its words are its own clues: a city, a dish, a person, a firm. The title over the board is a clue to the theme; Easy and Medium say whether it's a country or a commodity.</p>
    <p><b>Playing.</b> Drag a finger through a word's letters, or tap them one at a time and tap the last again; slide back to take a letter off, and tap away from the letters to clear. A theme word found turns blue, the mother lode gold, and the line under the board says what links it to the theme. Words lists what you've found, and how long the rest are.</p>
    <p><b>Hints.</b> Any other English word of ${inWords(MIN_WORD)} letters or more counts towards a hint, ${inWords(PER_HINT)} words to a hint, as in Strands: the dots on the Hint button fill as they come. A hint rings the letters of the hardest word still hidden; a second while they're ringed numbers them in order. Each hint adds ${HINT_COST} seconds.</p>
    <p><b>Score.</b> Your time plus the hints' seconds, lower being better. Show the words still hidden, in the menu, ends the board at ${SHOW_COST} seconds a word, more than a hint ever costs. Playing alone, the clock stands still while the menu or these rules are open.</p>
    <p><b>Levels.</b> Easy deals well-known links whose paths run straight and read rightwards or down; Hard leans on specialists' links, turns its paths and runs them backwards, and doesn't say if the theme is a country or a commodity. The menu also chooses the themes (countries, commodities or both), the topics, and the regions and sectors they come from.</p>
    <p><b>Settings.</b> Board: ${SHAPES.square}, or ${SHAPES.hex}, a honeycomb where each letter touches six. Clues: ${CLUES.title}, or ${CLUES.every}, each word's clue with its length in place of the title, one at a time with the arrows, the mother lode's last. Rival: ${paces} finds the words beside you at a person's pace. They apply from the next board.</p>
    <p><b>Today's board.</b> Medium and square, from every theme, the same for everyone, and a new one at midnight UTC. It counts the moment its last word is found.</p>
    <p><b>Together.</b> As a team, one board with its letters shared out: you see only yours, and a sealed letter is a team mate's, marked with where it is (C4, the third column's fourth letter) so you can ask for it. Anyone traces through any letters, and what you trace shows on the others' boards as it grows. Or a race: the same board on every phone from the same moment, the lowest score winning.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}

// ---------- together: one board for the table (together.js) ----------
// The pair's duo match, or a party's table of up to six. Team (a pair's first board): one run for the table, the
// letters shared out, each phone showing its own and sealing the rest; a word anyone finds opens for all, in its finder's
// colour. Race (a party's first board): the same board on every phone from the same moment, the lowest score winning,
// with a computer rival if the dealer asks. The menu chooses the next board's mode. Your solo board, bests and today's
// stay as they were.
const seated = () => { joining?.(); joining = null; };
function people() {
  if (!together.room || together.slot == null) return [];
  return [{ slot: together.slot, name: together.room.name, me: true, here: true }, ...together.others()].sort((a, b) => a.slot - b.slot);
}
const others = () => people().filter(p => !p.me);
const present = () => (G && together.room ? presentSlots(G, together.room.here, together.room.uid) : []);
const nameOfSlot = slot => { const p = people().find(x => x.slot === slot); return p?.me ? "you" : first(p?.name); };
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
/** A board for the table, from this phone's settings: a deal and its board, the board kept in the room itself. */
function tableBoard() {
  const made = dealRandom();
  return { board: made.board, clues: settings.clues };
}
const together = createTogether({
  game: "lode",
  app: APP,
  toast,
  askName,
  valid: isTable,
  slots: g => g?.people || 2,
  fresh: (players, { ask } = {}) => {
    const people = ask?.people || 2, { board, clues } = tableBoard();
    return { ...freshTable(players, { board, mode: people > 2 ? "race" : "team", people, app: APP, now: serverNow() }), clues };
  },
  onState,
  onPresence: () => { if (G) render(); },
  onLeave: () => { seated(); G = null; myRace = null; stopOffset?.(); stopOffset = null; closeRace(); solo(); },
  result: g => { try { const t = tidy(structuredClone(g)); return resultOf(t, together.slot, presentSlots(t, together.room?.here, together.room?.uid), serverNow()); } catch { return null; } },
});
function onState(val) {
  seated();
  const was = G;
  G = tidy(structuredClone(val));
  if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {});
  if (was && was.n !== G.n) { lastFound = null; clueAt = 0; message = null; view.clear(); closeRace(); toast(`A new board: ${MODES[G.mode].toLowerCase()}`); }
  if (was && G.mode === "team" && was.n === G.n) {           // what the others just found, in the line under the board
    const fresh = G.team.found.filter(w => !was.team.found.includes(w));
    for (const w of fresh) { lastFound = w; const by = G.by[`w${w}`]; if (by !== together.slot) said({ kind: w ? "theme" : "span", w }, context(), nameOfSlot(by)); }
    if (G.team.hint && G.team.hints > was.team.hints) message = { text: "A hint: the ringed letters are a word.", tone: "good" };
  }
  if (G.mode === "race") startRace();
  clockFrom = null;
  render();
  if (G.mode === "race" && raceOver(G, present()) && myRace?.run.done) openRace();
}
async function submitTeam(cells) {
  const n = G.n;
  let out = null;
  const ok = await together.act(g => { out = submitAt(tidy(g), { n, slot: together.slot, cells, now: serverNow() }); return ["span", "theme", "word"].includes(out.kind) ? undefined : false; });
  if (!out) return;
  said(out, context());
  if (ok && (out.kind === "span" || out.kind === "theme")) { lastFound = out.w; navigator.vibrate?.(18); }
  render();
}
// the trace under your finger, written to your seat as it grows (at most every 90 ms), so the others see it
let sentTrace = null, traceTimer = 0;
function shareTrace(cells, now = false) {
  const room = together.room;
  if (!room || G?.mode !== "team") return;
  const text = traceText(G.n, cells);
  clearTimeout(traceTimer);
  if (text === sentTrace) return;
  const send = () => {
    if (!together.room?.data?.players?.[room.uid]) return;      // not seated (any more): a write would leave a stray entry
    sentTrace = text;
    room.sync.update(`${branchPath(room.code, "lode")}/players/${room.uid}`, { trace: text })?.catch?.(e => console.error(e));
  };
  if (now) send(); else traceTimer = setTimeout(send, 90);
}
function dealForTable() {
  if (!G) return;
  const under = !context()?.run.done && (G.team.found.length || Object.keys(G.runs || {}).length);
  if (under && !confirm("Deal a new board for the table? This one isn't finished.")) return;
  const { board, clues } = tableBoard(), n = G.n, mode = nextMode || G.mode, bot = nextBot;
  together.act(g => { const t = tidy(g); if (!newGameAt(t, { n, board, mode, now: serverNow(), bot: bot === "off" ? null : bot })) return false; t.clues = clues; return undefined; });
}
// ---------- the race: this phone's run of the table's board ----------
const raceKey = () => `${together.room?.code}/${G.created}/${G.n}`;
function startRace() {
  const kept = read(TABLE, null);
  if (!myRace || myRace.key !== raceKey()) myRace = kept?.key === raceKey() ? { key: kept.key, run: tidyRun(kept.run) } : { key: raceKey(), run: newRun() };
  if (!runOf(G, together.slot)) together.act(g => beginAt(tidy(g), { n: G.n, slot: together.slot, now: serverNow() }));
}
function keepRace() { if (myRace && !IN_FRAME) write(TABLE, myRace); }
/** This phone's run as the table sees it. */
function tellRace() {
  if (!G || !myRace) return;
  const r = myRace.run, n = G.n;
  const run = r.done ? { found: r.found.length, hints: r.hints, done: true, ms: r.ms, score: scoreOf(r), gave: r.gaveUp } : { found: r.found.length, hints: r.hints };
  together.act(g => reportAt(tidy(g), { n, slot: together.slot, run }));
}
function finishRace() {
  const r = myRace.run;
  r.ms = Math.round(r.ms || raceMs());
  keepRace();
  tellRace();
  learnFrom(G.board, r);
  render();
  setTimeout(openRace, 400);
}
function openRace() {
  if (!G || G.mode !== "race") return;
  const over = raceOver(G, present()), rows = standingsOf(G, serverNow(), over), names = Object.fromEntries(people().map(p => [p.slot, p]));
  $("raceHead").textContent = over ? (rows[0]?.slot === together.slot && rows.filter(r => r.rank === 1).length === 1 ? "You win" : rows[0]?.slot == null ? `${rows[0]?.label} wins` : `${first(names[rows[0]?.slot]?.name)} wins`) : "The race so far";
  const list = leaderboard(rows.map(r => ({
    name: r.slot == null ? r.label : names[r.slot]?.me ? "You" : first(names[r.slot]?.name), seat: r.slot, me: r.slot === together.slot,
    value: r.done ? r.score : 1e9 - r.found, shown: r.done ? fmt(r.score) : `${r.found} found, playing`, note: r.gave ? "gave up" : null,
  })), { lower: true });
  const body = $("raceBody");
  body.replaceChildren(list);
  if (!over) { const wait = el("p", "duel-note"); wait.append(sextant(), "Waiting for the others to finish"); body.append(wait); }
  const again = el("button", "btn wide primary", "Another board"), solo = el("button", "link duel-link", "Back to solo");
  again.type = solo.type = "button";
  again.addEventListener("click", () => { closeRace(); dealForTable(); });
  solo.addEventListener("click", () => { closeRace(); together.leave(); });
  body.append(...(over ? [again] : []), solo);
  if (!$("raceDlg").open) $("raceDlg").showModal();
}
function closeRace() { if ($("raceDlg").open) $("raceDlg").close(); }

// ---------- messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "lode");
const logo = APPS.find(a => a.id === "lode")?.logo;
if (logo) document.querySelector(".lo-mark").innerHTML = logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("wordsClose").addEventListener("click", () => $("wordsDlg").close());
$("wordsDlg").addEventListener("click", e => { if (e.target === $("wordsDlg")) $("wordsDlg").close(); });
$("raceClose").addEventListener("click", closeRace);
$("raceDlg").addEventListener("click", e => { if (e.target === $("raceDlg")) closeRace(); });
$("hintBtn").addEventListener("click", useHintNow);
$("wordsBtn").addEventListener("click", openWords);
$("seeBtn").addEventListener("click", openWords);
$("nextBtn").addEventListener("click", () => { if (G?.mode === "race") openRace(); else if (G) dealForTable(); else start("random"); });
$("cluePrev").addEventListener("click", () => { const ctx = context(); if (!ctx) return; clueAt = (clueAt - 1 + ctx.board.words.length) % ctx.board.words.length; drawTheme(ctx); });
$("clueNext").addEventListener("click", () => { const ctx = context(); if (!ctx) return; clueAt = (clueAt + 1) % ctx.board.words.length; drawTheme(ctx); });
$("pool").addEventListener("change", () => {
  settings.pool = $("pool").value;
  saveSettings();
  if (G) return;                                            // at a table the next board deals from it
  if (!S || S.mode === "daily" || started()) toast(`${$("pool").selectedOptions[0].textContent}: from the next board`);
  else start("random");
});
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); together.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const d = hashDeal(); if (!G && d && !sameDeal(S, d)) startLinked(d); });
document.addEventListener("keydown", e => { if (e.key === "Escape") view.clear(); });
let wasCounting = false;
setInterval(() => {
  const ctx = context();
  if (!ctx) return;
  const now = counting();
  if (wasCounting && !now) render();                           // a table's board opens: unseal it, everyone at once
  wasCounting = now;
  drawStrip(ctx);
  if (!G && clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
  watchRival();
}, 250);

// for tests and debugging
window.__lode = {
  get state() { return S; }, get table() { return G; }, get context() { return context(); }, get settings() { return settings; },
  start, submitCells: onSubmit, useHint: useHintNow, giveUp: giveUpNow, together, view,
};

/** The solo board: a link's, today's (from the games screen's tile while it's still to play), the saved one, or a new one. */
const forToday = arrivedForToday();
function solo() {
  S = read(RUN, null);
  if (!validS(S)) S = null;
  else { S.run = tidyRun(S.run); tidyBoard(S.board); }
  const linked = hashDeal();
  if (linked && !sameDeal(S, linked)) { startLinked(linked); return; }
  if (forToday && !IN_FRAME && !(S?.mode === "daily" && S.day === today())) {
    if (!started() || confirm("Today's board is waiting. Leave the one you've started?")) { start("daily"); return; }
  }
  if (S) { history.replaceState(null, "", hashFor(S)); clockRun(); render(); setTimeout(dealSpare, 1500); }
  else if (IN_FRAME) render();
  else start("random");
}
// a table in the address: its board, under the rete, with no solo board dealt beneath it
const code = roomInAddress();
if (code && !IN_FRAME) { joining = busy(joiningWords(), { delay: 0 }); together.join(code).then(ok => { if (!ok) { seated(); solo(); } }); }
else solo();
