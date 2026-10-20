// Acrostic (README, Classics: Acrostic): a hidden text in a grid of squares, and clues whose answers hold exactly its
// letters, each letter numbered to its square; the answers' first letters spell where the text is from. Fill either
// side and the other fills too. The rules are acrostic-engine.js's; the puzzles are made in a worker (acrostic-worker.js,
// acrostic-make.js), each proven to fill one way only and graded by the skill a person needs. This file keeps the run,
// the clock, the keyboard and the grid, and the three ways to play with others: a team match for the pair (each holds
// half the clues), a race on the same puzzle at a party (duel.js), and a computer rival paced like a person.
import {
  LEVELS, TWISTS, DAILY, SOURCES, EMPTY, blank, put, solved, filled, wrong, right, owners, labelOf, spineCell, step, nextEmpty,
  rivalAt, rivalDone, holds, validEntry,
} from "./acrostic-engine.js";
import { STAGES as LIT_STAGES } from "./kb/items/choice/lit.js";
import { STAGES as SAYING_STAGES } from "./kb/items/choice/sayings.js";
import { scale, sideways } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, ticks, action, line, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { busy, sextant } from "./loading.js";
import { createDuel } from "./duel.js";
import { createTogether } from "./together.js";
import { joiningWords } from "./rooms.js";

const $ = id => document.getElementById(id);
const RUN = "acrostic:run", PREFS = "acrostic:prefs", TIMES = "acrostic:times", SEEN = "acrostic:seen", RIVALS = "acrostic:rivals";
const APP = 1;                       // this code's version of a match and a team's table
const HINT = 20, CHECK = 10;         // seconds added: a letter shown; each wrong letter a check finds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const STAGES = { lit: LIT_STAGES, saying: SAYING_STAGES.filter(s => s.id !== "pop") };

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const first = name => String(name || "Player").split(" ")[0];

// ---------- what you've chosen ----------
const PREF0 = { level: "medium", twist: "classic", sources: SOURCES.map(([id]) => id), stages: {}, rival: 0 };
let prefs = { ...PREF0, ...read(PREFS, {}) };
if (!LEVELS[prefs.level]) prefs.level = "medium";
if (!TWISTS[prefs.twist]) prefs.twist = "classic";
prefs.sources = (prefs.sources || []).filter(s => SOURCES.some(([id]) => id === s));
if (!prefs.sources.length) prefs.sources = PREF0.sources;
const keepPrefs = () => write(PREFS, prefs);
/** What a random puzzle is made from: the choices, and the texts played lately to pass over. */
const randomOpts = () => ({ level: prefs.level, twist: prefs.twist, sources: prefs.sources, stages: prefs.stages, avoid: read(SEEN, []) });

// ---------- the puzzles, made in a worker ----------
let worker = null, asked = 0;
const waiting = new Map();
/** A puzzle from `seed` (acrostic-make.js), made off the page's thread; resolves null when nothing could be made. */
function makeIn(seed, opts) {
  return new Promise((resolve, reject) => {
    const local = () => import("./acrostic-make.js").then(m => resolve(m.makePuzzle(seed, opts)), reject);
    try {
      if (!worker) {
        worker = new Worker(new URL("./acrostic-worker.js", import.meta.url), { type: "module" });
        worker.onmessage = e => { const job = waiting.get(e.data.id); if (!job) return; waiting.delete(e.data.id); if (e.data.error) job.reject(new Error(e.data.error)); else job.resolve(e.data.puzzle); };
        worker.onerror = e => { console.error(e); worker = null; for (const job of waiting.values()) job.retry(); waiting.clear(); };
      }
      const id = ++asked;
      waiting.set(id, { resolve, reject, retry: local });
      worker.postMessage({ id, seed, opts });
    } catch (e) { console.warn("Acrostic: no worker here, making the puzzle on the page.", e); local(); }
  });
}
// the next random puzzle, made while you solve this one, so New puzzle doesn't wait
let ahead = null;
const keyOf = o => JSON.stringify({ ...o, avoid: undefined });
function prefetch() {
  if (IN_FRAME) return;
  const opts = randomOpts(), key = keyOf(opts);
  if (ahead?.key === key) return;
  const seed = randomSeed();
  ahead = { key, seed, promise: makeIn(seed, opts).catch(e => { console.error(e); return null; }) };
}
async function nextRandom() {
  const opts = randomOpts(), key = keyOf(opts);
  const job = ahead?.key === key ? ahead : { seed: randomSeed(), promise: makeIn(randomSeed(), opts) };
  ahead = null;
  const P = await job.promise;
  return P && !opts.avoid.includes(P.id) ? P : P || null;
}

// ---------- the run ----------
// S: { mode: "random" | "daily" | "duel" | "team", P (the puzzle), entry, ms (the clock), pen (seconds added), hints,
// checks, shown (squares a hint filled), marked (squares a check found wrong), done, score, fresh (a new best), rival
// (the computer's level, 0 for none), at (the square you're on), way ("text" or "clue": which way typing runs) }
let S = null, P = null, own = null;
let clockFrom = null, savedAt = 0, paused = false;
const undo = [];                     // [{ c, before }]: this device's own changes, the latest last
const valid = s => !!s && !!s.P && Array.isArray(s.P.answers) && validEntry(s.P, s.entry) && Number.isFinite(s.ms);

function save() {
  if (IN_FRAME || !S) return;
  if (S.mode === "duel") duel.keep(S);
  else if (S.mode !== "team") write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && (S.mode === "random" || S.mode === "daily") && !S.done && filled(S.entry) > 0;

/** Puts a puzzle on the table: `s` is the run (a fresh one, or one kept), drawn and its clock started. */
function begin(s) {
  S = { pen: 0, hints: 0, checks: 0, shown: [], marked: [], done: false, rival: 0, at: 0, way: "text", ms: 0, ...s };
  P = S.P;
  own = owners(P);
  if (!(S.at >= 0 && S.at < P.cells.length)) S.at = 0;
  undo.length = 0;
  clockFrom = null;
  buildBoard();
  buildClues();
  fitLayout();
  save();
  clockRun();
  draw();
  if (S.done && S.mode !== "team" && !IN_FRAME) showDone(false);
}
function seen(id) {
  const list = read(SEEN, []).filter(x => x !== id);
  list.unshift(id);
  write(SEEN, list.slice(0, 60));
}
async function start(kind) {
  if (IN_FRAME) return;
  const done = busy(kind === "daily" ? "Setting today's acrostic" : "Setting an acrostic");
  try {
    const P0 = kind === "daily" ? await makeIn(today(), { ...DAILY, daily: true }) : await nextRandom();
    if (!P0) { toast("Nothing could be set from those sources at this level: try more of them"); return; }
    if (kind !== "daily") seen(P0.id);
    begin({ mode: kind, P: P0, entry: blank(P0), rival: kind === "daily" ? 0 : prefs.rival, day: kind === "daily" ? today() : null });
  } catch (e) { console.error(e); toast("Couldn't set a puzzle: try again"); }
  finally { done(); }
  prefetch();
}
function confirmStart(kind) {
  if (started() && !confirm(kind === "daily" ? "Start today's acrostic? This one isn't solved." : "Start a new acrostic? This one isn't solved.")) return false;
  start(kind);
  return true;
}

// ---------- the clock ----------
// A solo puzzle counts the time on screen (S.ms); a race's runs from when the table started it (duel.js); a team's
// from when its table was dealt (the database's time), and neither of those stops.
function clockRun() {
  if (IN_FRAME || !S || S.done || S.mode === "duel" || S.mode === "team" || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); }, () => { paused = false; clockRun(); });
function elapsed() {
  if (!S) return 0;
  if (S.mode === "duel") return S.done ? S.ms : Math.max(0, duel.now() - (S.begun || duel.now()));
  if (S.mode === "team") { const g = team.room?.data; return g?.done ? g.done.ms : g?.begun ? Math.max(0, teamNow() - g.begun) : 0; }
  return S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
}
const score = () => Math.round(elapsed() / 1000) + (S?.pen || 0);

// ---------- the letters ----------
/** The letters as they stand: a team's are the table's, with this device's last few laid over until the table has them. */
function entryNow() {
  if (S?.mode !== "team") return S?.entry || "";
  let e = team.room?.data?.entry || S.entry;
  for (const [c, ch] of pending) e = put(e, c, ch);
  for (const [c, ch] of sending || []) e = put(e, c, ch);
  return e;
}
/** Writes a letter (or EMPTY) into square `c`, as this player's move. */
function setLetter(c, ch, { quiet = false } = {}) {
  const before = entryNow()[c];
  const now = ch && ch !== EMPTY ? ch.toUpperCase() : EMPTY;
  if (before === now) return false;
  if (!quiet) { undo.push({ c, before }); if (undo.length > 200) undo.shift(); }
  S.marked = S.marked.filter(x => x !== c);
  if (S.mode === "team") { pending.set(c, now); flushTeam(); }
  else S.entry = put(S.entry, c, now);
  return true;
}
/** After a change: a solved puzzle ends here (the moment it's final: leaving after the last letter can't lose it). */
function changed() {
  if (S.mode === "team") { draw(); return; }
  if (solved(P, S.entry)) finish();
  else { save(); tellSoon(); }
  draw();
}

// ---------- moving and typing ----------
function select(c, way = S.way) {
  if (!S || c == null) return;
  S.at = c;
  S.way = way;
  draw();
  keepInView();
}
function selectAnswer(a) {
  const cells = P.answers[a].cells, e = entryNow();
  select(cells.find(c => e[c] === EMPTY) ?? cells[0], "clue");
}
const playing = () => !!S && !S.done && !IN_FRAME && !paused && !(S.mode === "duel" && !duel.playing) && !(S.mode === "team" && (team.room?.data?.done || !team.room));
function typeLetter(ch) {
  if (!playing()) return;
  const c = S.at;
  setLetter(c, ch);
  // on to the next square along the way, filled or not, so a word typed whole lands letter by letter in its squares;
  // at an answer's end the square stays put
  if (!solved(P, entryNow())) S.at = step(P, own, c, S.way, 1) ?? c;
  changed();
  keepInView();
}
function erase() {
  if (!playing()) return;
  const e = entryNow();
  if (e[S.at] !== EMPTY) setLetter(S.at, EMPTY);
  else {
    const b = step(P, own, S.at, S.way, -1);
    if (b == null) return;
    S.at = b;
    setLetter(b, EMPTY);
  }
  changed();
  keepInView();
}
function move(dir) {
  if (!S) return;
  const n = step(P, own, S.at, S.way, dir);
  if (n != null) select(n);
}
function nextClue(dir) {
  if (!S) return;
  const k = P.answers.length;
  selectAnswer((own[S.at].a + dir + k) % k);
}
function toggleWay() { if (S) select(S.at, S.way === "text" ? "clue" : "text"); }
function undoLast() {
  if (!playing()) return;
  const last = undo.pop();
  if (!last) { toast("Nothing to undo"); return; }
  setLetter(last.c, last.before, { quiet: true });
  S.at = last.c;
  changed();
  keepInView();
}
function check() {
  if (!playing()) return;
  const bad = wrong(P, entryNow());
  if (!bad.length) { toast(filled(entryNow()) ? "Every letter so far is right" : "Nothing to check yet"); return; }
  S.marked = bad;
  S.checks++;
  addPenalty(CHECK * bad.length);
  toast(`${plural(bad.length, "letter")} wrong, marked: +${CHECK * bad.length} s`);
  changed();
}
function hint() {
  if (!playing()) return;
  const e = entryNow();
  let c = S.at;
  if (e[c] === P.cells[c]) c = nextEmpty(P, own, e, c, S.way) ?? wrong(P, e)[0] ?? null;
  if (c == null) { toast("Nothing left to show"); return; }
  setLetter(c, P.cells[c], { quiet: true });
  S.shown = [...new Set([...S.shown, c])];
  S.hints++;
  addPenalty(HINT);
  S.at = c;
  toast(`The letter shown: +${HINT} s`);
  changed();
}
function addPenalty(secs) {
  if (S.mode === "team") { const n = secs; team.act(g => { g.pen = (g.pen || 0) + n; g.shown = S.shown; }); }
  S.pen += secs;
}

// ---------- the end ----------
function finish() {
  if (S.done) return;
  if (S.mode === "duel") S.ms = elapsed();
  else if (clockFrom != null) { S.ms += performance.now() - clockFrom; clockFrom = null; }
  S.done = true;
  S.score = Math.round(S.ms / 1000) + S.pen;
  if (S.mode === "duel") { tell(true); save(); showDone(true); return; }
  S.fresh = recordBest(S);
  if (S.mode === "daily") noteDayTime("acrostic", S.score, S.day || today());   // today's: the first solve counts
  if (S.rival) recordRival(S);
  save();
  showDone(true);
}
const bestKey = s => `${s.P.level}:${s.P.twist}`;
/** A solve's score as the best of its level and twist, lowest wins (kept apart from acrostic:best, which the games
 *  screen reads highest-first); true if it's a new best. */
function recordBest(s) {
  const times = read(TIMES, {}), k = bestKey(s), fresh = times[k] == null || s.score < times[k];
  if (fresh) { times[k] = s.score; write(TIMES, times); }
  return fresh;
}
function recordRival(s) {
  const r = read(RIVALS, {}), at = rivalDone(s.P, s.rival), k = String(s.rival);
  r[k] ||= { won: 0, lost: 0 };
  if (at == null || s.score * 1000 < at) r[k].won++; else r[k].lost++;
  write(RIVALS, r);
}

// ---------- drawing: the text ----------
let boxes = [];        // per square: its element
let wordEls = [];      // per box of the layout, in order: { el, box }
const board = $("board");
function buildBoard() {
  board.replaceChildren();
  boxes = new Array(P.cells.length);
  wordEls = [];
  const tags = P.answers.map((_, a) => labelOf(a));
  P.layout.forEach((word, w) => word.forEach((box, b) => {
    const el = document.createElement(box.c != null ? "button" : "span");
    el.className = box.c != null ? "ac-sq" : "ac-sq ac-given";
    if (box.c != null) {
      el.type = "button";
      el.dataset.c = box.c;
      el.innerHTML = `<i class="ac-tag">${tags[own[box.c].a]}</i><b class="ac-ch"></b>`;
      boxes[box.c] = el;
    } else el.innerHTML = `<b class="ac-ch">${box.g}</b>`;
    if (box.a) { const m = document.createElement("i"); m.className = "ac-punct after"; m.textContent = box.a.trim(); el.appendChild(m); }
    if (box.b) { const m = document.createElement("i"); m.className = "ac-punct before"; m.textContent = box.b; el.appendChild(m); }
    wordEls.push({ el, box, w, b, last: b === word.length - 1 });
    board.appendChild(el);
  }));
}
/** The text flowed into lines `width` wide with squares `s` px: each box's place, and the height it takes. */
function flow(width, s) {
  const gap = Math.max(1, s * 0.08), mark = s * 0.34, space = s * 0.46, lineH = s * 1.24;
  const wide = box => (box.c != null ? s : s * 0.56);              // a given digit is narrow: "8,000" reads as a number
  const after = (box, b, word) => (b < word.length - 1 ? (box.a ? mark : box.c != null || word[b + 1].c != null ? gap : 0) : 0);
  const out = [];
  let x = 0, y = 0, i = 0;
  for (const word of P.layout) {
    const lead = word[0].b ? mark : 0;
    let w = lead;
    word.forEach((box, b) => { w += wide(box) + after(box, b, word); });
    if (x > 0 && x + space + w > width) { x = 0; y += lineH; } else if (x > 0) x += space;
    x += lead;
    word.forEach((box, b) => {
      if (x + wide(box) > width + 0.5 && x > 0) { x = 0; y += lineH; }   // a word longer than the line goes on the next
      out[i++] = { x, y };
      x += wide(box) + after(box, b, word);
    });
  }
  return { at: out, height: y + s };
}
/**
 * Sizes the text's squares and the keys to the screen (Safari's bars included). Upright, the squares are as large as
 * the width and the room left by the clues' least and the keyboard allow; a long text scrolls inside its own box.
 * Sideways (#app.beside), the text has the left column to itself. The sizes are set once for the puzzle and again only
 * when the screen turns: nothing moves as you play.
 */
function fitLayout() {
  if (!P) return;
  const k = scale(), rem = 16 * k, side = sideways(), vh = window.visualViewport?.height || window.innerHeight;
  const box = $("textBox"), app = $("app");
  // a short phone keeps the spine to its line of words and its keys a little lower, for the clues' sake
  app.classList.toggle("short", !side && vh / k < 720);
  document.documentElement.style.setProperty("--ac-key", `${(side ? 2.9 : vh / k < 720 ? 2.5 : 2.75) * rem}px`);
  const width = box.clientWidth - 2 * 0.25 * rem - 2;
  let room;
  if (side) room = box.clientHeight - 2 * 0.375 * rem - 2;
  else {
    box.style.height = "0px";                                   // measured without it: what's above, and what's below
    const top = box.getBoundingClientRect().top - app.getBoundingClientRect().top;
    const below = $("spine").offsetHeight + $("dock").offsetHeight + parseFloat(getComputedStyle(app).paddingBottom || 0) + 0.5 * rem;
    const free = vh - top - below;
    // the text takes up to half of what's free (three rows of clues stay in sight, at the least two)
    room = Math.max(4 * rem, Math.min(free * 0.52, free - 6.5 * rem)) - 2 * 0.375 * rem - 2;
  }
  const lo = 1.45 * rem, hi = (side ? 3.4 : 2.1) * rem;
  let s = hi, laid = flow(width, s);
  while (s > lo && laid.height > room) { s = Math.max(lo, s - 0.5 * k); laid = flow(width, s); }
  const widest = Math.max(...laid.at.map(p => p.x + s));
  const left = Math.max(0, (width - widest) / 2);
  wordEls.forEach(({ el }, i) => { el.style.left = `${left + laid.at[i].x}px`; el.style.top = `${laid.at[i].y}px`; });
  board.style.setProperty("--sq", `${s}px`);
  board.style.height = `${laid.height}px`;
  box.style.height = side ? "" : `${Math.min(laid.height, room) + 2 * 0.375 * rem + 2}px`;
  keepInView();
}

// ---------- drawing: the clues ----------
let rows = [], blanks = [];          // per answer: its row, and per square its blank in the row
function buildClues() {
  const list = $("clues");
  list.replaceChildren();
  rows = [];
  blanks = new Array(P.cells.length);
  P.answers.forEach((ans, a) => {
    const row = document.createElement("div");
    row.className = "ac-clue";
    row.dataset.a = a;
    row.innerHTML = `<span class="ac-label">${labelOf(a)}</span><span class="ac-say"></span><span class="ac-blanks"></span>`;
    const holder = row.querySelector(".ac-blanks");
    ans.cells.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ac-bl";
      b.dataset.c = c;
      if ((P.spine.at === "last" ? i === ans.cells.length - 1 : i === 0)) b.classList.add("spine");
      holder.appendChild(b);
      blanks[c] = b;
    });
    rows.push(row);
    list.appendChild(row);
  });
  // the spine: the source, as its letters come in
  const sp = $("spine");
  sp.innerHTML = `<span class="ac-spine-say"></span><span class="ac-spine-row"></span>`;
  const holder = sp.querySelector(".ac-spine-row");
  let i = 0;
  for (const word of P.spine.text.split(/\s+/)) {
    const n = word.replace(/[^A-Za-zÀ-ÿ]/g, "").length;
    if (!n) continue;
    const g = document.createElement("span");
    g.className = "ac-spine-word";
    for (let j = 0; j < n && i < P.answers.length; j++, i++) { const b = document.createElement("button"); b.type = "button"; b.className = "ac-bl"; b.dataset.a = i; g.appendChild(b); }
    holder.appendChild(g);
  }
}
/** Whose clue `a` is to read here: yours, your partner's (a team), or nobody's (the Half twist leaves it blank). */
function clueText(a) {
  if (P.unclued?.includes(a)) return { text: "No clue: from the text alone", hidden: true };
  if (S.mode === "team") {
    const seat = team.slot, partner = team.others()[0];
    if (!holds(P, a, seat) && !readAll) return { text: `${first(partner?.name || "Your partner")}'s clue`, hidden: true, theirs: true };
  }
  return { text: P.answers[a].clue, hidden: false };
}

// ---------- drawing: everything that changes ----------
function draw() {
  if (!S || !P) return;
  const e = entryNow(), cur = S.at, a0 = own[cur]?.a, ans = P.answers[a0];
  const word = new Set(runAt(cur));
  const marked = new Set(S.marked), shown = new Set(S.mode === "team" ? shownTeam() : S.shown);
  const by = S.mode === "team" ? (team.room?.data?.by || "") : "";
  const mine = String(team.slot ?? 0);
  for (let c = 0; c < boxes.length; c++) {
    const el = boxes[c], ch = e[c] === EMPTY ? "" : e[c];
    const t = el.querySelector(".ac-ch");
    if (t.textContent !== ch) t.textContent = ch;
    el.classList.toggle("sel", own[c].a === a0);
    el.classList.toggle("cur", c === cur);
    el.classList.toggle("word", S.way === "text" && word.has(c));
    el.classList.toggle("bad", marked.has(c));
    el.classList.toggle("shown", shown.has(c));
    el.classList.toggle("theirs", !!ch && by[c] != null && by[c] !== "." && by[c] !== mine);
    const b = blanks[c];
    if (b.textContent !== ch) b.textContent = ch;
    b.classList.toggle("cur", c === cur);
    b.classList.toggle("bad", marked.has(c));
    b.classList.toggle("theirs", !!ch && by[c] != null && by[c] !== "." && by[c] !== mine);
  }
  rows.forEach((row, a) => {
    const say = clueText(a), el = row.querySelector(".ac-say");
    if (el.textContent !== say.text) el.textContent = say.text;
    row.classList.toggle("hidden", say.hidden);
    row.classList.toggle("sel", a === a0);
    row.classList.toggle("way", a === a0 && S.way === "clue");
    row.classList.toggle("full", P.answers[a].cells.every(c => e[c] !== EMPTY));
  });
  const sp = $("spine");
  sp.querySelector(".ac-spine-say").textContent = `${P.spine.at === "last" ? "Last" : "First"} letters: ${P.spine.label}`;
  sp.querySelectorAll(".ac-bl").forEach(b => { const a = Number(b.dataset.a), c = spineCell(P, a), ch = e[c] === EMPTY ? "" : e[c]; if (b.textContent !== ch) b.textContent = ch; b.classList.toggle("sel", a === a0); });
  $("kbd").querySelector("[data-way]").textContent = S.way === "text" ? "Text" : "Clue";
  $("kbd").querySelector("[data-way]").setAttribute("aria-label", S.way === "text" ? "Typing along the text: switch to the clue" : "Typing along the clue: switch to the text");
  const over = S.done || (S.mode === "team" && !!team.room?.data?.done);
  $("actions").hidden = over;
  $("donePanel").hidden = !over;
  if (over) drawVerdict();
  const off = !playing();
  for (const btn of $("actions").querySelectorAll("button")) btn.disabled = off;
  drawStrip();
  void ans;
}
const runAt = c => { for (const r of runsCache()) if (r.includes(c)) return r; return [c]; };
let runsMemo = null;
function runsCache() {
  if (runsMemo?.P === P) return runsMemo.runs;
  const runs = [];
  for (const word of P.layout) { let run = []; word.forEach(box => { if (box.c != null) run.push(box.c); else { if (run.length) runs.push(run); run = []; } }); if (run.length) runs.push(run); }
  runsMemo = { P, runs };
  return runs;
}
const put0 = {};
const show = (id, v) => { if (put0[id] !== v) { put0[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!S || !P) return;
  const e = entryNow(), pen = S.mode === "team" ? (team.room?.data?.pen || 0) : S.pen;
  show("clock", fmt(elapsed() / 1000 + pen));
  show("pen", pen ? `+${pen} s` : "");
  show("count", `${filled(e)} of ${P.cells.length}`);
  const r = $("rival");
  if (S.mode === "random" && S.rival) {
    const at = rivalDone(P, S.rival), ms = S.done ? S.score * 1000 : elapsed(), got = right(P, rivalAt(P, S.rival, ms));
    r.hidden = false;
    const text = at != null && at <= ms ? `Computer done: ${fmt(at / 1000)}` : `Computer ${got} of ${P.cells.length}`;
    if (r.textContent !== text) r.textContent = text;
  } else if (S.mode === "team") {
    r.hidden = false;
    const p = team.others()[0], text = p ? `With ${first(p.name)}${p.here ? "" : " (away)"}` : "Waiting for your partner";
    if (r.textContent !== text) r.textContent = text;
  } else if (S.mode !== "duel") r.hidden = true;
}
function drawVerdict() {
  const g = S.mode === "team" ? team.room?.data : null;
  const secs = g ? Math.round(g.done.ms / 1000) + (g.pen || 0) : S.score;
  let text = `Solved: ${fmt(secs)}.`;
  if (S.mode === "random" && S.rival) { const at = rivalDone(P, S.rival); text += at == null || S.score * 1000 < at ? " You beat the computer." : ` The computer took ${fmt(at / 1000)}.`; }
  if (S.mode === "daily") text += " Today's, done.";
  show("verdict", text);
  $("nextBtn").textContent = S.mode === "duel" ? "The result" : S.mode === "team" ? "Another together" : "New puzzle";
}
/** Keeps the square you're on in sight in the text's box and its clue in the clues' box. */
function keepInView() {
  if (!S) return;
  const near = (box, el) => {
    if (!el || !box) return;
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top < b.top + 2) box.scrollTop += r.top - b.top - 6;
    else if (r.bottom > b.bottom - 2) box.scrollTop += r.bottom - b.bottom + 6;
  };
  near($("textBox"), boxes[S.at]);
  near($("clues"), rows[own[S.at].a]);
}

// ---------- the reveal ----------
function showDone(fresh) {
  const box = $("reveal"), about = P.about || {};
  const g = S.mode === "team" ? team.room?.data : null;
  const secs = g?.done ? Math.round(g.done.ms / 1000) + (g.pen || 0) : S.score;
  box.replaceChildren();
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  box.append(el("p", "ac-title", about.title || P.text));
  if (about.by) box.append(el("p", "ac-by", about.by));
  for (const l of about.lines || []) if (l && l !== about.title) box.append(el("p", "ac-line", l));
  const bits = [`${fmt(g?.done ? g.done.ms / 1000 : S.ms / 1000)} on the clock`];
  const pen = g ? g.pen || 0 : S.pen;
  if (pen) bits.push(`+${pen} s for hints and checks`);
  const best = S.mode === "random" || S.mode === "daily" ? read(TIMES, {})[bestKey(S)] : null;
  const verdict = el("p", "ac-score", `${fmt(secs)}: ${bits.join(", ")}.${S.fresh ? ` A new best at ${LEVELS[P.level].label}.` : best != null ? ` Your best at ${LEVELS[P.level].label}: ${fmt(best)}.` : ""}`);
  box.append(verdict);
  if (S.mode === "random" && S.rival) {
    const at = rivalDone(P, S.rival);
    box.append(el("p", "ac-line", at == null || S.score * 1000 < at ? `You beat the computer (${LEVELS[["", "easy", "medium", "hard"][S.rival]].label}), which took ${fmt((at || 0) / 1000)}.` : `The computer (${LEVELS[["", "easy", "medium", "hard"][S.rival]].label}) finished first, in ${fmt(at / 1000)}.`));
  }
  $("doneTitle").textContent = S.mode === "daily" ? "Today's, solved" : "Solved";
  $("doneNext").textContent = S.mode === "duel" ? "The result" : S.mode === "team" ? "Another together" : "New puzzle";
  // a moment to see the text whole first; and the tap that typed the last letter mustn't land on the reveal's backdrop
  // (or its button) and close it
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    if ($("doneDlg").open) return;
    openedAt = performance.now();
    try { $("doneDlg").showModal(); } catch { /* already open */ }
  }, fresh ? 700 : 0);
}
let revealTimer = 0, openedAt = 0;
const settled = () => performance.now() - openedAt > 450;
function next() {
  $("doneDlg").close();
  if (S?.mode === "duel") { duel.open(); return; }
  if (S?.mode === "team") { teamAgain(); return; }
  start("random");
}

// ---------- the keyboard ----------
function buildKeyboard() {
  const rowsOf = [[..."QWERTYUIOP"], ["", ..."ASDFGHJKL", ""], ["WAY", ..."ZXCVBNM", "BACK"]];
  $("kbd").replaceChildren(...rowsOf.map(keys => {
    const r = document.createElement("div");
    r.className = "ac-krow";
    for (const k of keys) {
      if (!k) { r.appendChild(Object.assign(document.createElement("span"), { className: "ac-half" })); continue; }
      const b = document.createElement("button");
      b.type = "button";
      if (k === "WAY") { b.className = "wide way"; b.dataset.way = "1"; b.textContent = "Text"; }
      else if (k === "BACK") { b.className = "wide"; b.textContent = "⌫"; b.setAttribute("aria-label", "Delete"); }
      else { b.textContent = k; b.dataset.key = k; }
      // pressed, not clicked: a thumb's quick taps land on the key they started on
      b.addEventListener("pointerdown", ev => { ev.preventDefault(); key(k); });
      b.addEventListener("click", ev => { if (ev.detail === 0) key(k); });       // the keyboard's Enter on a focused key
      r.appendChild(b);
    }
    return r;
  }));
}
function key(k) {
  if (k === "WAY") toggleWay();
  else if (k === "BACK") erase();
  else typeLetter(k);
}
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (!S) return;
  if (e.key === "Backspace" || e.key === "Delete") erase();
  else if (e.key === "ArrowRight") move(1);
  else if (e.key === "ArrowLeft") move(-1);
  else if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) nextClue(1);
  else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) nextClue(-1);
  else if (e.key === " ") toggleWay();
  else if (/^[a-z]$/i.test(e.key)) typeLetter(e.key.toUpperCase());
  else return;
  e.preventDefault();
});

// ---------- taps ----------
board.addEventListener("click", e => {
  const sq = e.target.closest(".ac-sq[data-c]");
  if (!sq || !S) return;
  const c = Number(sq.dataset.c);
  if (c === S.at) toggleWay(); else select(c, "text");
});
$("clues").addEventListener("click", e => {
  if (!S) return;
  const bl = e.target.closest(".ac-bl[data-c]");
  if (bl) { const c = Number(bl.dataset.c); if (c === S.at && S.way === "clue") toggleWay(); else select(c, "clue"); return; }
  const row = e.target.closest(".ac-clue");
  if (row) selectAnswer(Number(row.dataset.a));
});
$("spine").addEventListener("click", e => {
  const b = e.target.closest(".ac-bl[data-a]");
  if (b && S) select(spineCell(P, Number(b.dataset.a)), "clue");
});
$("undoBtn").addEventListener("click", undoLast);
$("checkBtn").addEventListener("click", check);
$("hintBtn").addEventListener("click", hint);
$("nextBtn").addEventListener("click", () => { if (S?.done || team.room?.data?.done) { if (S.mode === "duel") duel.open(); else showDone(true); } });
$("doneNext").addEventListener("click", () => { if (settled()) next(); });
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneDlg").addEventListener("click", e => { if (e.target === $("doneDlg") && settled()) $("doneDlg").close(); });

// ---------- a race at a party: the same puzzle for everyone (duel.js) ----------
// Everyone at the table gets the match's puzzle and solves it on their own phone from the moment the table starts it;
// the others' progress shows in the strip as the letters they have right. The lowest time (with what hints and checks
// added) wins. Your own puzzle, bests and today's stay as they were.
const duel = createDuel({
  game: "acrostic", name: "Acrostic", app: APP, accent: "--ac-in", line: $("rival"), lower: true, toast,
  deal: async () => {
    const seed = randomSeed(), P0 = await makeIn(seed, { level: prefs.level, twist: prefs.twist, sources: prefs.sources, stages: prefs.stages });
    return { seed, level: prefs.level, twist: prefs.twist, P: P0 };
  },
  describe: m => `${LEVELS[m.level]?.label || "Medium"}${m.twist && m.twist !== "classic" ? `, ${TWISTS[m.twist].label.toLowerCase()}` : ""}: the same hidden text for everyone, the fastest solve wins`,
  play: (match, { begun, kept }) => {
    if (!match.P) { toast("The match's puzzle didn't arrive"); return; }
    const same = kept && kept.P?.seed === match.P.seed && valid(kept);
    begin({ mode: "duel", P: match.P, entry: same ? kept.entry : blank(match.P), ...(same ? { pen: kept.pen, hints: kept.hints, checks: kept.checks, shown: kept.shown, done: kept.done, ms: kept.ms, score: kept.score } : {}), begun });
    tell(S.done);
  },
  onLobby: () => { $("doneDlg").close(); },
  onLeave: () => { solo(); },
});
/** What the table sees of this run: the letters right, and the time once it's solved. */
function tell(done = false) {
  if (S?.mode !== "duel") return;
  const n = right(P, S.entry);
  duel.report(done ? { score: S.score, text: `${fmt(S.score)}, solved`, done: true } : { score: P.cells.length - n, text: `${n} of ${P.cells.length}` });
}
let tellTimer = 0;
function tellSoon() {   // a report for every letter would be a write for every letter
  if (S?.mode !== "duel" || tellTimer) return;
  tellTimer = setTimeout(() => { tellTimer = 0; if (S?.mode === "duel" && !S.done) tell(); }, 1500);
}

// ---------- the pair's team match: one puzzle, each holding half the clues (together.js) ----------
// Both of you see the whole text and every answer's squares; each reads only their own half of the clues (the split
// is the generator's, chosen so that neither half alone finishes it: acrostic-solve.js splitFor). Either of you types
// anywhere, the letters in the colour of whoever put them. The clock is the table's and doesn't stop.
let pending = new Map(), sending = null, readAll = false, teamOffset = 0, stopOffset = null;
const teamNow = () => Date.now() + teamOffset;
const team = createTogether({
  game: "acrostic", app: APP, toast, askName,
  fresh: async (players, { ask } = {}) => {
    const seed = randomSeed(), P0 = await makeIn(seed, { level: prefs.level, twist: prefs.twist === "half" ? "classic" : prefs.twist, sources: prefs.sources, stages: prefs.stages });
    const now = Date.now();
    return { v: 1, kind: "team", app: APP, created: now, players, n: 1, P: P0, entry: blank(P0), by: blank(P0), pen: 0, shown: [], begun: now, done: null };
  },
  valid: g => g?.v === 1 && g.kind === "team" && !!g.P && typeof g.entry === "string",
  onState: g => onTeam(g),
  onPresence: () => draw(),
  onLeave: () => { pending.clear(); sending = null; readAll = false; stopOffset?.(); stopOffset = null; solo(); },
  result: g => (g.done ? { match: `${g.created}-${g.n}`, score: Math.round(g.done.ms / 1000) + (g.pen || 0), won: true, coop: true, lower: true } : null),
});
/** The name this player goes by at a table (the suite's, asked once). */
async function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return saved; } catch { /* private mode */ }
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}
let teamDrawn = null;
function onTeam(g) {
  if (!stopOffset) stopOffset = team.room?.sync.serverOffset?.(ms => { teamOffset = ms || 0; }) || (() => {});
  const fresh = S?.mode !== "team" || S.P.seed !== g.P.seed || S.n !== g.n;
  if (fresh) {
    pending.clear(); sending = null; readAll = false;
    begin({ mode: "team", P: g.P, entry: g.entry, n: g.n, shown: g.shown || [], at: S?.mode === "team" && S.P.seed === g.P.seed ? S.at : 0 });
    $("doneDlg").close();
  }
  S.entry = g.entry;
  S.shown = g.shown || [];
  for (const [c, ch] of pending) if (g.entry[c] === ch) pending.delete(c);
  draw();
  if (g.done && !S.done) { S.done = true; showDone(true); }
  teamDrawn?.();
}
const shownTeam = () => team.room?.data?.shown || [];
/** Sends this device's letters to the table: all that came since the last send, in one transaction. */
async function flushTeam() {
  if (sending || !pending.size || !team.room) return;
  sending = new Map(pending);
  pending.clear();
  const job = sending, ms = () => Math.max(0, teamNow() - (team.room?.data?.begun || teamNow()));
  const seat = String(team.slot ?? 0);
  const ok = await team.act(g => {
    if (g.done) return false;
    let e = g.entry, by = g.by || blank(g.P);
    for (const [c, ch] of job) { e = put(e, c, ch); by = by.slice(0, c) + (ch === EMPTY ? EMPTY : seat) + by.slice(c + 1); }
    g.entry = e; g.by = by;
    if (solved(g.P, e)) g.done = { at: teamNow(), ms: Math.round(ms()) };
  });
  if (!ok) for (const [c, ch] of job) if (!pending.has(c)) pending.set(c, ch);      // not saved: again with the next
  sending = null;
  draw();
  if (pending.size) flushTeam();
}
/** A new puzzle at the table for both of you (the dealer's choices), once this one's over or by asking. */
async function teamAgain() {
  if (!team.room) return;
  const g = team.room.data;
  if (g && !g.done && filled(entryNow()) && !confirm("Start another together? This one isn't solved.")) return;
  const done = busy("Setting an acrostic for two");
  try {
    const seed = randomSeed(), P0 = await makeIn(seed, { level: prefs.level, twist: prefs.twist === "half" ? "classic" : prefs.twist, sources: prefs.sources, stages: prefs.stages });
    if (!P0) { toast("Nothing could be set: try more sources"); return; }
    await team.act(t => { Object.assign(t, { P: P0, entry: blank(P0), by: blank(P0), pen: 0, shown: [], begun: teamNow(), done: null, n: (t.n || 1) + 1 }); });
  } finally { done(); }
}

// ---------- menu and messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.replaceChildren(...(msg.endsWith("…") ? [sextant()] : []), msg);
  // just above the buttons, clear of the clock and the text
  t.style.top = `${Math.max(8, $("dock").getBoundingClientRect().top - t.offsetHeight - 10)}px`;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
let pick = null;                                              // what New puzzle starts: "random" or "daily"
function contentPart(body, forNext = false) {
  const content = part(body, "content");
  if (!forNext) content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "daily" && !forNext) { content.append(line("Today's is Medium, from every source: the same for everyone.")); return; }
  content.append(
    choice("Level", Object.entries(LEVELS).map(([id, l]) => [id, l.label]), prefs.level, v => { prefs.level = v; keepPrefs(); prefetch(); }),
    choice("Twist", Object.entries(TWISTS).map(([id, t]) => [id, t.label]), prefs.twist, v => { prefs.twist = v; keepPrefs(); prefetch(); openMenu(); }),
    line(TWISTS[prefs.twist].note),
    ticks("Sources", SOURCES, prefs.sources, list => { prefs.sources = list.length ? list : SOURCES.map(([id]) => id); keepPrefs(); prefetch(); openMenu(); }));
  // literature's and the sayings' own stages, folded away as Punt folds them
  for (const id of ["lit", "saying"].filter(x => prefs.sources.includes(x))) {
    const all = STAGES[id].map(s => s.id), on = (prefs.stages[id] || all).filter(x => all.includes(x));
    const box = document.createElement("details"), sum = document.createElement("summary"), what = document.createElement("span");
    box.className = "menu-stages";
    const say = list => { what.textContent = list.length === all.length ? " · all" : ` · ${list.length} of ${all.length}`; };
    sum.append(`${SOURCES.find(([x]) => x === id)[1]}: which`, what); say(on);
    box.append(sum, ticks(`${id} stages`, STAGES[id].map(s => [s.id, s.label]), on, list => {
      const keep = list.length && list.length < all.length ? list : null;
      if (keep) prefs.stages[id] = keep; else delete prefs.stages[id];
      keepPrefs(); prefetch(); say(keep || all);
    }));
    content.append(box);
  }
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    duel.menu(part(body, "together"));
    contentPart(body, true);
  } else if (team.room) {
    const away = team.others()[0] && !team.others()[0].here;
    part(body, "together").append(
      action("Another together", teamAgain, "primary"),
      ...(away || readAll ? [action(readAll ? "Only my clues" : "Read their clues too", () => { readAll = !readAll; draw(); })] : []),
      line(away ? "Your partner is away: you can read their clues to carry on." : "Each of you reads half the clues: say yours out loud."),
      action("Back to solo", () => team.leave(), "link"));
    contentPart(body, true);
  } else {
    pick ??= S?.mode === "daily" ? "daily" : "random";
    part(body, "play").append(action(pick === "daily" ? "Today's acrostic" : "New puzzle", () => confirmStart(pick), "primary"));
    contentPart(body);
    part(body, "settings").append(choice("Race the computer", [[0, "Off"], [1, "Easy"], [2, "Medium"], [3, "Hard"]], prefs.rival, v => { prefs.rival = v; keepPrefs(); }),
      line(prefs.rival ? "From your next puzzle: it solves the same one, as fast as a person who knows that much." : "A computer solving the same puzzle as you, beside your clock."));
  }
  const times = read(TIMES, {}), bests = Object.keys(LEVELS).map(l => times[`${l}:classic`] != null ? `${LEVELS[l].label} ${fmt(times[`${l}:classic`])}` : null).filter(Boolean);
  const r = read(RIVALS, {}), vs = Object.entries(r).map(([k, v]) => `${LEVELS[["", "easy", "medium", "hard"][k]]?.label}: ${v.won}–${v.lost}`);
  part(body, "about").append(line(bests.length ? `Your bests: ${bests.join(", ")}.` : "Your bests show here once you've solved one."),
    ...(vs.length ? [line(`Against the computer: ${vs.join(", ")}.`)] : []),
    line(`A hint shows a letter, +${HINT} s; a check marks the wrong ones, +${CHECK} s each.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "acrostic");
{ const app = APPS.find(a => a.id === "acrostic"); if (app) document.querySelector(".ac-mark").innerHTML = app.logo; }
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); duel.resync(); team.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) { duel.resync(); team.resync(); } });
window.addEventListener("pagehide", () => clockPause());
let resizeTimer = 0;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitLayout, 120); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);
buildKeyboard();

// for tests and debugging
window.__acrostic = {
  get state() { return S; }, get puzzle() { return P; }, get entry() { return entryNow(); }, typeLetter, erase, select, selectAnswer, toggleWay,
  check, hint, undoLast, start, duel, team, makeIn,
};

const forToday = arrivedForToday();   // from the games screen's tile: today's, still to play
function solo() {
  if (IN_FRAME) { const s = read(RUN, null); if (valid(s)) begin(s); return; }
  const s = read(RUN, null);
  S = null;
  if (forToday && !(s?.mode === "daily" && s.day === today() && valid(s))) {
    if (!valid(s) || s.done || filled(s.entry) === 0 || confirm("Today's acrostic is waiting. Leave the one you've started?")) { start("daily"); return; }
  }
  if (valid(s) && (s.mode === "random" || s.mode === "daily")) { begin(s); prefetch(); }
  else start("random");
}
// a race at a party, or the pair's team match, in the address: its table, with no solo puzzle dealt under it
const params = new URLSearchParams(location.search);
if (!IN_FRAME && params.get("room") && params.get("party")) duel.join().then(ok => { if (!ok) solo(); });
else if (!IN_FRAME && params.get("room")) {
  const done = busy(joiningWords(), { delay: 0 });
  const drawn = new Promise(res => { teamDrawn = res; setTimeout(res, 8000); });
  team.join(params.get("room").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4)).then(async ok => { if (ok) await drawn; teamDrawn = null; done(); if (!ok) solo(); });
} else solo();
