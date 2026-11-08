// Constellation (id yield; the rules are yield-engine.js's): seven stars, the sight-lines between them, words traced
// along them; points for each, ranks from the dark sky to the galaxy. The puzzles, the shadows and the computer player
// are the engine's; this file keeps the runs, draws the sky and takes the taps. Today's puzzle and a random one are kept
// apart, so switching between them loses neither. Together (duel.js): a race, the same sky for everyone against the clock.
import { LEVELS, DAILY, MIN_LEN, FULL_BONUS, RANKS, MASTER, TOP, GROUPS, groupOf, deal, daily, yieldOf, totalOf, pointsOf, isFull, judge,
  needed, rankOf, canStep, trailOf, skyOf, shadowsOf, easiestLeft, onlyMine } from "./yield-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { ramp } from "./ramp.js";
import { part, action, line, toggle, onPause, todayPart } from "./menu.js";
import { sure } from "./sure.js";
import { today, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";
import { branchPath } from "./rooms.js";
import { waitMark } from "./loading.js";
import { sideways } from "./wide.js";
import * as sfx from "./yield-sound.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inWords = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n);
const fmt = secs => { const s = Math.max(0, Math.ceil(secs)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };
const up = w => w.toUpperCase();

// ---------- what's kept ----------
// yield:day today's puzzle as played; yield:last the daily before it (its words shown from the menu); yield:run the
// random one; yield:on which of the two is on the screen; yield:prefs the choices; yield:stats the record;
// yield:daily today's points by the day, for the games screen; yield:duel a match's run on this device (duel.js's).
const DAY = "yield:day", RUN = "yield:run", ON = "yield:on", PREFS = "yield:prefs", STATS = "yield:stats", DAILY_KEY = "yield:daily", LAST = "yield:last";
const prefs = { level: "medium", sound: true, ...read(PREFS, {}) };
sfx.setSound(prefs.sound !== false);
if (!LEVELS[prefs.level]) prefs.level = "medium";
// Korbi, 4 November 2026: the menu is the minimum it needs to be. The level is a hidden ramp (its first rung the old saved
// level): up when a random puzzle reaches the rank to aim for, down when its words are shown. Puzzles are untimed; a race is 3 minutes.
const levelNow = () => ramp("yield", Object.keys(LEVELS), { start: prefs.level });
const RACE_SECS = 180;
const keepPrefs = () => write(PREFS, prefs);

// ---------- the dictionary, for the words Constellation doesn't count (wordlist.js, loaded once it's wanted) ----------
let dict = null, dictLoading = null;
function loadDict() {
  dictLoading ??= import("./wordlist.js").then(m => { dict = { isWord: m.isWord, isVariant: m.isVariant }; return dict; }).catch(e => { console.error(e); dictLoading = null; return null; });
  return dictLoading;
}

// ---------- the run on the screen ----------
// S: { kind ("day", "run" or "race"), p (the puzzle), found (in the order found), extra (words traced that don't count),
// typed (the word being traced), shadows (the clue is on), hints (taken), pin ({ w, n }: the word a hint is showing the first
// n stars of), top (the best rank reached), over, shown (the words were revealed) } and, in a race, secs, begun, n and times.
let S = null;
let P = null;          // what the run's puzzle gives: { words, set, total, need, sky }
let raceTable = null;  // a race as the table has it: the others' points, for the gauge
let message = null;    // { text, tone, pts } on the line until the next change
let messageTimer = 0;
let paused = false;

/** Works out what a run's puzzle gives, once per puzzle. */
function derive() {
  const words = yieldOf(S.p), total = totalOf(S.p, words);
  P = { words, set: new Set(words), total, need: needed(total), sky: skyOf(S.p) };
}
const foundSet = () => new Set(S?.found || []);
const pointsNow = () => (S && P ? totalOf(S.p, S.found.filter(w => P.set.has(w))) : 0);
const isOver = () => !!S?.over;
const raceLeft = () => (S?.kind === "race" ? S.secs - (duel.now() - S.begun) / 1000 : Infinity);
const canType = () => !!S && !!P && !isOver() && !IN_FRAME && !paused && !(S.kind === "race" && raceLeft() <= 0);

// ---------- the sky ----------
// The stars at their places in a picture 340 by 300 (the sky's own -1 to 1 spread across it), the sight-lines between them,
// the shadows over those, the word being traced in brass, and a hint's start of a word in dots.
const NS = "http://www.w3.org/2000/svg", VW = 340, VH = 300, R = 26;
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const at = s => [VW / 2 + s.x * 128, VH / 2 + s.y * 108];
let starEls = [], shadowEls = new Map(), trailEl = null, pinEl = null, drawnFor = null;
function drawBoard() {
  const box = $("board");
  if (!S || !P) { box.replaceChildren(); drawnFor = null; starEls = []; return; }
  const key = `${S.p.letters}|${S.p.edges}|${S.p.seed}`;
  if (drawnFor === key) return;
  drawnFor = key;
  const svg = svgEl("svg", { viewBox: `0 0 ${VW} ${VH}`, role: "presentation" }), { stars, links } = P.sky;
  const dust = svgEl("g", { class: "dust" });                       // faint background stars, the same on every device
  let a = (S.p.seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < 26; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; const x = (a >>> 8) % VW; a = (Math.imul(a, 1664525) + 1013904223) >>> 0; dust.append(svgEl("circle", { cx: x, cy: (a >>> 8) % VH, r: 0.7 + ((a >>> 4) % 10) / 9 })); }
  svg.append(dust, svgEl("circle", { class: "ring", cx: VW / 2, cy: VH / 2, r: 138 }), svgEl("circle", { class: "ring", cx: VW / 2, cy: VH / 2, r: 76 }));
  shadowEls = new Map();
  for (const [i, j] of links) {
    const [x1, y1] = at(stars[i]), [x2, y2] = at(stars[j]), k = i < j ? `${i}-${j}` : `${j}-${i}`;
    const sh = svgEl("line", { class: "yd-shadow", x1, y1, x2, y2 });
    shadowEls.set(k, sh);
    svg.append(svgEl("line", { class: "yd-link", x1, y1, x2, y2 }), sh);
  }
  pinEl = svgEl("polyline", { class: "yd-pin" });
  trailEl = svgEl("polyline", { class: "yd-trail" });
  svg.append(pinEl, trailEl);
  starEls = stars.map((s, i) => {
    const [x, y] = at(s), g = svgEl("g", { class: "yd-star", "data-i": String(i) });
    g.append(svgEl("circle", { class: "halo", cx: x, cy: y, r: R + 9 }), svgEl("circle", { class: "disc", cx: x, cy: y, r: R }));
    const text = svgEl("text", { x, y: y + 1 });
    text.textContent = s.ch;
    g.append(text);
    svg.append(g);
    return g;
  });
  box.replaceChildren(svg);
  drawTrail();
}
/** The stars the typed word runs through, in order (a doubled letter stays on its star). */
const typedTrail = () => trailOf(S.p, S.typed || "");
function drawTrail() {
  if (!S || !P || !starEls.length) return;
  const trail = typedTrail(), end = trail.at(-1), pts = i => at(P.sky.stars[i]).join(",");
  trailEl.setAttribute("points", trail.length > 1 ? trail.map(pts).join(" ") : "");
  const on = new Set(trail), pin = S.pin && !foundSet().has(S.pin.w) ? trailOf(S.p, S.pin.w).slice(0, S.pin.n) : [];
  pinEl.setAttribute("points", pin.length > 1 ? pin.map(pts).join(" ") : "");
  starEls.forEach((g, i) => {
    const next = end != null && i !== end && canStep(S.p, S.p.letters[end], S.p.letters[i]);
    g.classList.toggle("on", on.has(i));
    g.classList.toggle("end", i === end);
    g.classList.toggle("reach", next && canType());
    g.classList.toggle("pinned", pin.includes(i));
  });
  $("board").classList.toggle("off", !canType());
}
/** The shadows: each sight-line glows by how many of the words not yet found travel along it. */
function drawShadows() {
  const on = !!S?.shadows && !!P && !isOver();
  $("shadowBtn").setAttribute("aria-pressed", String(on));
  $("shadowBtn").classList.toggle("on", on);
  if (!P) return;
  const { lines, max } = shadowsOf(S.p, P.words, foundSet());
  for (const [k, sh] of shadowEls) {
    const n = on ? lines.get(k) || 0 : 0, f = max ? n / max : 0;
    sh.style.opacity = n ? String(0.22 + 0.7 * f) : "0";
    sh.setAttribute("stroke-width", String(n ? 6 + 12 * f : 0));
  }
}

// ---------- tracing ----------
/** A letter, from a tap on a star or a key: it must be a star the last one has a sight-line to (or the same star again). */
function add(letter, { quiet = false } = {}) {
  if (!canType() || S.typed.length >= 15) return false;
  letter = letter.toLowerCase();
  const last = S.typed.at(-1);
  if (!S.p.letters.includes(letter)) { if (!quiet) refuse("Not a star: only these seven letters"); return false; }
  if (last && !canStep(S.p, last, letter)) { if (!quiet) refuse(`No sight-line from ${up(last)} to ${up(letter)}`); return false; }
  S.typed += letter;
  message = null;
  sfx.tap(S.p.letters.indexOf(letter));
  typedChanged();
  return true;
}
function del() {
  if (!canType() || !S.typed) return;
  S.typed = S.typed.slice(0, -1);
  typedChanged();
}
function clearWord() {
  if (!S || !S.typed) return;
  S.typed = "";
  typedChanged();
}
function typedChanged() { drawWord(); drawTrail(); drawLine(); save(); }

/** A hint: the start of the easiest word not found yet, two stars of it, then one more at each press until it is whole. */
function hint() {
  if (!canType()) return;
  const have = foundSet();
  const pin = S.pin && !have.has(S.pin.w) && P.set.has(S.pin.w) ? S.pin : null, w = pin ? pin.w : easiestLeft(P.words, have);
  if (!w) return;
  if (pin && pin.n >= w.length) { say(`${plural(w.length, "letter")}: that is the whole word`); return; }
  S.pin = { w, n: pin ? pin.n + 1 : Math.min(2, w.length) };
  S.hints = (S.hints || 0) + 1;
  sfx.hint(trailOf(S.p, w)[S.pin.n - 1]);
  say(`${plural(w.length, "letter")}`);
  drawWord(); drawTrail(); save();
}
function shadowsToggle() {
  if (!S || !P || isOver()) return;
  S.shadows = !S.shadows;
  sfx.shadows(S.shadows);
  drawShadows();
  save();
}

// ---------- a word entered ----------
const CALLS = ["Good", "Nice", "Fine", "Great", "Brilliant"];
async function enter() {
  if (!canType() || !S.typed) return;
  const word = S.typed;
  let r = judge(S.p, word, { have: foundSet(), dict });
  if (r.kind === "unknown" && !dict) {                   // the first word that isn't counted: the dictionary, then judge again
    say("", "", null, true);
    await loadDict();
    if (S?.typed !== word) return;
    r = judge(S.p, word, { have: foundSet(), dict });
  }
  S.typed = "";
  switch (r.kind) {
    case "word": {
      const before = rankOf(pointsNow(), P.total);
      S.found.push(word);
      if (S.pin?.w === word) S.pin = null;
      const after = rankOf(pointsNow(), P.total);
      say(r.full ? "Full tour!" : after > before ? `${RANKS[after][1]}!` : CALLS[Math.min(CALLS.length - 1, word.length - MIN_LEN)], "good", r.points);
      sfx.found(trailOf(S.p, word), { rank: after > before, full: r.full });
      found();
      break;
    }
    case "short": refuse("Too short: four letters at least"); break;
    case "letters": refuse("Not a star: only these seven letters"); break;
    case "line": refuse(`No sight-line from ${up(word[r.at - 1])} to ${up(word[r.at])}`); break;
    case "found": refuse("Already found"); break;
    case "variant": noteExtra(word); refuse("One side of the Atlantic's spelling only: not counted", ""); break;
    case "rare": noteExtra(word); refuse("A word, but rarer than Constellation counts", ""); break;
    default: refuse("Not in Constellation's list");
  }
  drawWord(); drawTrail(); render(); save();
}
function noteExtra(word) { if (!S.extra.includes(word)) S.extra.push(word); }
function refuse(text, tone = "bad") {
  say(text, tone);
  const w = $("word");
  w.classList.remove("shake"); void w.offsetWidth; w.classList.add("shake");
  navigator.vibrate?.(tone === "bad" ? 18 : 0);
  sfx.foul();
}
/** A word that counts: the daily's figure, the record, the table, and the end once everything is found. */
function found() {
  const pts = pointsNow(), rank = rankOf(pts, P.total), have = foundSet(), all = P.words.every(w => have.has(w));
  const master = S.top < MASTER && rank >= MASTER;                 // the rank to aim for, reached with this word
  if (S.kind === "day") noteDaily(pts);
  if (rank > S.top) { noteRank(S.top, rank); S.top = rank; }
  if (S.kind === "race") { if (all) S.over = true; tell(all); return; }     // a race's result sheet is duel.js's
  if (all) finish("full");
  else if (master) { if (S.kind === "run" && S.p.level === levelNow()) ramp.won(true); roundOver("yield"); }                             // a puzzle with no end of its own: Nova is one
}
/** Today's points so far, for the games screen (and your partner's): every word counts the moment it's found. */
function noteDaily(pts) {
  const d = read(DAILY_KEY, {}) || {};
  if ((d[S.p.day] ?? -1) >= pts) return;
  const keepDays = Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) >= S.p.day - 400));   // a year or so is plenty
  write(DAILY_KEY, { ...keepDays, [S.p.day]: pts });
}
/** The record: how often Nova and Galaxy were reached (each puzzle counts once). */
function noteRank(from, to) {
  if (S.kind === "race") return;
  const st = read(STATS, {}) || {};
  if (from < MASTER && to >= MASTER) st.master = (st.master || 0) + 1;
  if (from < TOP && to >= TOP) st.full = (st.full || 0) + 1;
  write(STATS, st);
}

// ---------- drawing ----------
onPause(() => { paused = true; drawLine(); drawTrail(); }, () => { paused = false; drawTrail(); });
function drawWord() {
  const w = $("word"), typed = S?.typed || "", pin = !typed && S?.pin && !foundSet().has(S.pin.w) ? S.pin : null;
  if (pin) w.replaceChildren(...[...pin.w].map((ch, i) => el("span", i < pin.n ? "c" : "x", i < pin.n ? ch : "·")));   // a hint: the start, and a dot for each letter to come
  else w.replaceChildren(...[...typed].map(ch => el("span", "", ch)));
  w.style.setProperty("--word-size", `${Math.max(1.05, 1.9 - Math.max(0, (pin ? pin.w.length : typed.length) - 9) * 0.14).toFixed(2)}rem`);
  w.classList.toggle("off", !canType());
  w.setAttribute("aria-label", typed ? `Your word: ${typed}` : pin ? `A hint: ${pin.w.slice(0, pin.n)}, ${pin.w.length} letters` : "No letters yet");
}
function say(text, tone = "", pts = null, waiting = false) {
  message = { text, tone, pts, waiting };
  clearTimeout(messageTimer);
  if (!waiting) messageTimer = setTimeout(() => { message = null; drawLine(); }, 2400);
  drawLine();
}
function drawLine() {
  const l = $("line");
  l.className = `yd-line${message?.tone ? ` ${message.tone}` : ""}`;
  if (message?.waiting) { l.replaceChildren(waitMark(), "Looking it up"); return; }
  if (message) {
    l.replaceChildren(message.text);
    if (message.pts != null) l.append(el("span", "pts", `+${message.pts}`));
    return;
  }
  const idle = !S ? (duel.on ? "The sky shows when the match starts" : "")
    : isOver() ? (S.kind === "race" ? "Time" : S.shown ? "Every word shown" : "")
    : paused || S.found.length ? "" : "Trace words along the sight-lines: four letters or more";
  l.replaceChildren(idle);
}
// the scale is built once: a tick for each rank, your index over it, and a layer under it for the others' indexes
const scale = $("scale"), scaleTicks = RANKS.map((_, i) => { const t = el("i", `yd-tick${i === TOP ? " top" : ""}`); t.style.left = `${(i / TOP) * 100}%`; return t; });
const myIndex = el("i", "yd-index"), theirIndexes = el("span", "yd-them");
scale.replaceChildren(...scaleTicks, myIndex, theirIndexes);
function drawGauge() {
  const pts = pointsNow(), total = P?.total || 0, rank = S && P ? rankOf(pts, total) : 0;
  $("rank").textContent = RANKS[rank][1];
  $("points").replaceChildren(String(pts), ...(total ? [el("small", "", ` / ${total}`)] : []));
  scaleTicks.forEach((t, i) => t.classList.toggle("on", !!total && pts >= P.need[i]));
  myIndex.style.left = `${placeOf(pts) * 100}%`;
  drawTheirIndexes();
  $("gauge").setAttribute("aria-label", `${RANKS[rank][1]}: ${pts} of ${total} points. The ranks`);
}
/** The others' indexes in a race, under the scale in their colours. */
function drawTheirIndexes() {
  const them = S?.kind === "race" && raceTable ? raceTable.map(o => ({ name: o.name, points: o.points, colour: `var(--p${o.slot % 6})` })) : [];
  while (theirIndexes.childElementCount > them.length) theirIndexes.lastElementChild.remove();
  while (theirIndexes.childElementCount < them.length) theirIndexes.append(el("i", "yd-index them"));
  them.forEach((o, i) => { const x = theirIndexes.children[i]; x.style.left = `${placeOf(o.points) * 100}%`; x.style.setProperty("--who", o.colour); x.title = o.name; });
}
/** Where `pts` stands on the scale: the ranks are evenly spaced, the index between two of them in proportion. */
function placeOf(pts) {
  if (!P?.total) return 0;
  const need = P.need, top = need.length - 1;
  if (pts >= need[top]) return 1;
  let i = 0;
  while (i < top && pts >= need[i + 1]) i++;
  const span = need[i + 1] - need[i];
  return (i + (span > 0 ? (pts - need[i]) / span : 0)) / top;
}
function drawClock() {
  const c = $("clock"), left = raceLeft();
  c.hidden = !S || !Number.isFinite(left);
  if (c.hidden) return;
  c.textContent = fmt(Math.max(0, left));
  c.classList.toggle("low", left <= 30);
}
function drawFound() {
  const words = (S?.found || []).filter(w => P?.set.has(w));
  $("foundCount").textContent = plural(words.length, "word");
  $("foundLeft").textContent = P ? `of ${P.words.length}` : "";
  const list = $("foundList"), latest = S?.found.at(-1);
  // newest first on a phone's one line; held sideways the box shows them all, in alphabetical order
  const wide = sideways(), order = wide ? [...words].sort() : [...words].reverse();
  list.replaceChildren(...order.flatMap((w, i) => {
    const s = el("span", `${isFull(S.p, w) ? "full" : ""}${w === latest ? " new" : ""}`, up(w));
    return i && !wide ? [" ", s] : [s];
  }));
}
function render() {
  drawBoard(); drawWord(); drawTrail(); drawShadows(); drawLine(); drawGauge(); drawFound(); drawClock();
  const off = !canType();
  for (const id of ["delBtn", "enterBtn", "hintBtn"]) $(id).disabled = off;
  $("shadowBtn").disabled = !P || isOver();
  $("foundBtn").disabled = !P;
}

// ---------- keeping ----------
function save() {
  if (IN_FRAME || !S) return;
  if (S.kind === "race") duel.keep(S);
  else write(S.kind === "day" ? DAY : RUN, S);
}
const validRun = s => !!s && !!s.p && typeof s.p.letters === "string" && s.p.letters.length === 7 && typeof s.p.edges === "string" && Array.isArray(s.found);
/** A run made whole: what an older save or the database's round trip leaves out. */
const tidy = s => ({ typed: "", extra: [], top: 0, over: false, shown: false, shadows: false, hints: 0, pin: null, ...s, found: [...(s.found || [])] });
const started = s => !!s && !s.over && s.found.length > 0;

// ---------- starting ----------
/** Puts a run on the screen: `s` is a run (tidied), its puzzle worked out here. */
function show(s) {
  S = tidy(s);
  derive();
  drawnFor = null;
  message = null;
  if (S.kind === "day" || S.kind === "run") write(ON, S.kind);
  save();
  render();
  if (S.kind === "day" && S.found.length) noteDaily(pointsNow());
}
/** Today's puzzle, where you left it, or fresh: the day before's is kept to show its words (yield:last). */
function showToday() {
  const kept = read(DAY, null), day = today();
  if (validRun(kept) && kept.p.day === day) { show(kept); return; }
  if (validRun(kept) && kept.p.day < day && kept.found.length) write(LAST, { p: kept.p, found: kept.found });
  show({ kind: "day", p: daily(day), found: [] });
}
/** The last daily played before today's: every word, with what you found. */
function openLast() {
  const last = read(LAST, null);
  if (!validRun(last)) return;
  const words = yieldOf(last.p), got = new Set(last.found), body = sheet(dayName(last.p.day));
  body.append(el("p", "yd-sum", `${plural(last.found.length, "word")} of ${words.length}, ${totalOf(last.p, last.found.filter(w => words.includes(w)))} of ${totalOf(last.p, words)} points.`));
  const ul = el("ul", "yd-words shown");
  for (const w of words) { const li = el("li", `${isFull(last.p, w) ? "full" : ""}${got.has(w) ? "" : " miss"}`, up(w)); li.dataset.w = w; ul.append(li); }
  body.append(ul);
  openSheet();
}
/** A daily's name: yesterday's, or its date. */
function dayName(day) {
  const y = Math.floor(day / 10000), m = Math.floor(day / 100) % 100, d = day % 100, t = new Date(Date.UTC(y, m - 1, d));
  const yesterday = new Date(Date.UTC(Math.floor(today() / 10000), Math.floor(today() / 100) % 100 - 1, today() % 100) - 864e5);
  return t.getTime() === yesterday.getTime() ? "Yesterday's words" : `The words of ${t.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`;
}
/** A new random puzzle, as the menu has it. */
function newRandom() {
  const p = deal({ seed: randomSeed(), level: levelNow() });
  const st = read(STATS, {}) || {};
  write(STATS, { ...st, puzzles: (st.puzzles || 0) + 1 });
  show({ kind: "run", p, found: [] });
}
function showRandom() {
  const kept = read(RUN, null);
  if (validRun(kept) && !kept.over) show(kept); else newRandom();
}
/** Asks before leaving a random puzzle under way for a new one. */
async function confirmNew() {
  const kept = S?.kind === "run" ? S : read(RUN, null);
  if (started(kept) && !(await sure("Start a new puzzle? This one isn't finished."))) return false;
  newRandom();
  return true;
}

// ---------- the end of a puzzle ----------
/** A puzzle over: "full" (every word found) or "shown" (the words revealed). */
function finish(how) {
  if (!S || (S.over && how !== "full")) return;
  S.over = true;
  S.typed = "";
  if (how === "shown") { S.shown = true; if (S.kind === "run" && S.p.level === levelNow()) ramp.lost(); }
  save();
  render();
  openDone();
  if (S.kind === "day" || S.kind === "run") roundOver("yield");
}
function openDone() {
  const pts = pointsNow(), rank = rankOf(pts, P.total), got = S.found.filter(w => P.set.has(w)), tours = P.words.filter(w => isFull(S.p, w));
  const body = sheet(RANKS[rank][1]);
  body.append(el("p", "yd-sum", `${plural(P.words.length, "word")} · ${plural(P.total, "point")} · ${plural(tours.length, "full tour")}`));
  body.append(stats([[pts, `of ${P.total} points`], [got.length, `of ${P.words.length} words`], [got.filter(w => isFull(S.p, w)).length, `of ${plural(tours.length, "full tour")}`]]));
  // the way on before the words, which can run long
  if (S.kind === "day" || S.kind === "run") {
    if (dailyDue("yield") && S.kind !== "day") body.append(action("Today's puzzle", () => { closeSheet(); showToday(); }, "primary"));
    body.append(action("Another puzzle", () => { closeSheet(); newRandom(); }, dailyDue("yield") && S.kind !== "day" ? "" : "primary"));
  }
  body.append(el("h4", "yd-h", "Every word"), wordList(P.words, foundSet(), { missed: true }));
  openSheet();
}
function stats(items) {
  const box = el("div", "yd-stats");
  for (const [v, label] of items) { const d = el("div"); d.append(el("b", "", String(v)), el("span", "", label)); box.append(d); }
  return box;
}
/** The words by length, alphabetical, in columns: found ones as they are, missed ones faint. */
function wordList(words, have, { missed = false } = {}) {
  const box = el("div", "yd-cuts");
  GROUPS.forEach((name, i) => {
    const ul = el("ul", `yd-words${missed ? " shown" : ""}`), here = words.filter(w => groupOf(w) === i);
    for (const w of [...here].sort()) {
      const got = have.has(w);
      if (!got && !missed) continue;
      const li = el("li", `${isFull(S.p, w) ? "full" : ""}${got ? "" : " miss"}`, up(w));
      li.dataset.w = w;
      ul.append(li);
    }
    if (!ul.childElementCount) return;
    const head = el("h5", "yd-cut-h"), got = here.filter(w => have.has(w)).length;
    head.style.setProperty("--cut", `var(--cut${i})`);
    head.append(el("span", "", name), el("small", "", `${got} of ${here.length}`));
    box.append(head, ul);
  });
  return box;
}

// ---------- what a word means: the clue bank's plain clue (clues.js, Crossword's and Acrostic's), when it has one ----------
let glossary = null;
const loadGlossary = () => (glossary ??= import("./clues.js").catch(e => { console.error(e); glossary = null; return null; }));
/** A word tapped in a list: its plain clue under it (inside its line, so a column never parts them), or that the bank has none; tapped again, it goes. */
async function gloss(li) {
  const had = li.querySelector(".gloss");
  if (had) { had.remove(); return; }
  const bank = await loadGlossary(), clue = bank?.cluesOf(li.dataset.w)?.[0]?.text;
  li.append(el("small", "gloss", clue || "No gloss for this one"));
}

// ---------- the sheets: words, ranks ----------
function sheet(title) {
  $("sheetTitle").textContent = title;
  const body = $("sheetBody");
  body.replaceChildren();
  return body;
}
function openSheet() { if (!$("sheetDlg").open) $("sheetDlg").showModal(); }
function closeSheet() { if ($("sheetDlg").open) $("sheetDlg").close(); }
function openWords() {
  if (!S || !P) return;
  const have = foundSet(), got = S.found.filter(w => P.set.has(w));
  const body = sheet("Your words");
  body.append(el("p", "yd-sum", `${plural(got.length, "word")} of ${P.words.length}, ${pointsNow()} of ${P.total} points. Tap a word for what it means.`));
  body.append(wordList(P.words, have, { missed: isOver() }));
  if (S.extra.length) body.append(el("h4", "yd-h", "Also words, not counted"), el("p", "yd-note", S.extra.map(up).join(", ")));
  openSheet();
}
function openRanks() {
  if (!S || !P) return;
  const pts = pointsNow(), rank = rankOf(pts, P.total), body = sheet("Ranks");
  body.append(el("p", "yd-note", `From the dark sky to the galaxy: each rank a share of the puzzle's points. ${RANKS[MASTER][1]} is the one to aim for; ${RANKS[TOP][1]} is every word.`));
  const ul = el("ul", "yd-ranks");
  RANKS.forEach(([, name], i) => { const li = el("li", `${i === rank ? "on" : ""}${i < rank ? " done" : ""}`); li.append(el("b", "", name), el("span", "", String(P.need[i]))); ul.append(li); });
  body.append(ul);
  openSheet();
}

// ---------- together: a race (duel.js) ----------
// The same sky for everyone and a clock, the most points wins (duel.js ranks it). Each phone writes only its own words, to
// its own run, so two finds at once never collide.
let tableWatch = null;
const matchText = m => `Race: ${LEVELS[m.level]}, ${m.secs / 60} minutes. The same sky for everyone: the most points wins`;
const duel = createDuel({
  game: "yield", name: "Constellation", accent: "--yd-in", line: $("duelLine"), toast,
  deal: () => ({ seed: randomSeed(), level: levelNow(), secs: RACE_SECS }),
  describe: matchText,
  play: (m, { begun, kept, done, run, n }) => playMatch(m, { begun, kept, done, run, n }),
  onLobby: () => { S = null; P = null; raceTable = null; closeSheet(); render(); },
  onLeave: () => { stopWatch(); raceTable = null; solo(); },
  extra: () => raceExtra(),
  extraTitle: "Your words",
});
/** This device's run of a match, from what it kept or what the table has of it. */
function playMatch(m, { begun, kept, done, run, n }) {
  const p = deal(m);
  const same = kept && kept.p?.letters === p.letters && kept.p?.edges === p.edges && kept.n === n, words = run?.words || {};
  S = null;
  show({ ...(same ? kept : {}), kind: "race", p, found: same ? kept.found : Object.keys(words), times: same ? kept.times : { ...words },
    secs: m.secs || RACE_SECS, begun, n, over: !!done });
  watchTable();
  if (raceLeft() <= 0 && !S.over) { S.over = true; tell(true); }
}
/** What this player's run tells the table: points (a race's score) and every word with when it was found. */
function tell(done = false) {
  if (!S || S.kind !== "race" || !duel.playing) return;
  const mine = S.found.filter(w => P.set.has(w)), pts = totalOf(S.p, mine);
  S.times ??= {};
  for (const w of mine) S.times[w] ??= Math.max(0, Math.round(duel.now() - S.begun));
  const words = Object.fromEntries(mine.map(w => [w, S.times[w]]));
  const last = Math.max(0, ...Object.values(words));
  duel.report({ score: pts, text: `${pts} points`, words, ...(done ? { done: true, ms: last } : {}) });
}
/** Watches the table for the others' points (the gauge). */
function watchTable() {
  stopWatch();
  const room = duel.together.room;
  if (!room) return;
  tableWatch = room.sync.watch(branchPath(room.code, "yield"), onTable, e => console.error(e));
}
function stopWatch() { tableWatch?.(); tableWatch = null; }
function onTable(g) {
  if (!g || !S || g.n !== S.n) return;
  const runs = g.runs || {}, me = duel.together.slot;
  raceTable = Object.values(g.players || {}).filter(x => x && x.slot != null && x.slot !== me && runs[`s${x.slot}`]?.begun)
    .map(x => ({ slot: x.slot, name: x.name, points: Number(runs[`s${x.slot}`]?.score) || 0 }));
  drawGauge();
}
/** The result sheet's own lines in a race: your words, those nobody else found starred, and the best you missed. */
function raceExtra() {
  if (S?.kind !== "race" || !P) return null;
  const alone = onlyMine(duel.together.room?.data, duel.together.slot);
  const box = el("div"), mine = S.found.filter(w => P.set.has(w)).sort();
  const ul = el("ul", "yd-words");
  for (const w of mine) ul.append(el("li", isFull(S.p, w) ? "full" : "", `${up(w)}${alone.has(w) ? " ★" : ""}`));
  box.append(el("p", "yd-note", "★ nobody else found it."), ul);
  const missed = P.words.filter(w => !S.found.includes(w)).sort((a, b) => pointsOf(S.p, b) - pointsOf(S.p, a)).slice(0, 12);
  if (missed.length) box.append(el("h4", "yd-h", "The best you missed"), el("p", "yd-note", missed.map(up).join(", ")));
  return box;
}

// ---------- the menu ----------
// Play: a new puzzle, the words shown. Together: only at a table.
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    duel.menu(part(body, "together"));
    showMenu(body);
    return;
  }
  const play = part(body, "play");
  play.append(action("New puzzle", () => confirmNew(), "primary"));
  const left = S?.kind === "day" ? read(RUN, null) : null;                  // the random puzzle you left for today's
  todayPart(body, { app: "yield", play: showToday, playing: S?.kind === "day", back: validRun(left) && !left.over ? () => show(left) : null });
  if (S && !S.over && (S.kind === "day" || S.kind === "run")) play.append(action("Show the words", async () => { if (await sure("Show every word? This puzzle ends here.")) finish("shown"); }, "link"));
  part(body, "settings").append(toggle("Sound", prefs.sound !== false, v => { prefs.sound = v; sfx.setSound(v); keepPrefs(); }));
  const st = read(STATS, {}) || {}, last = read(LAST, null);
  if (validRun(last)) part(body, "about").append(action(dayName(last.p.day), openLast, "link"));
  part(body, "about").append(line(`${plural(st.puzzles || 0, "random puzzle")}; ${RANKS[MASTER][1]} ${st.master || 0} times, ${RANKS[TOP][1]} ${st.full || 0}.`),
    line("Words: SCOWL, with wordfreq's frequencies (CC BY-SA 4.0)."));
  showMenu(body);
}
/** Opens the menu as built, the rules at the foot of its play part. */
function showMenu(body) {
  part(body, "play").append(action("The rules", showRules, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the rules ----------
// The header's Rules and the menu's The rules: Constellation as it's played here, its numbers the engine's own, so the sheet
// can't drift from the game.
function showRules() {
  const ranks = RANKS.map(([share, name], i) => (i === 0 ? name : i === TOP ? `${name} (every word)` : `${name} (${Math.round(share * 100)}%)`));
  $("rulesBody").innerHTML = `
    <p>Seven letters are seven stars, joined by sight-lines. Trace words of ${inWords(MIN_LEN)} letters or more: each letter must be a star with a sight-line to the one before it. Tap a star again for a double letter, or drag across the stars; a star can be used as often as you like. The sky, not a rule, is what limits the words. Every sky has between 50 and 100 words, and at least one full tour, a word that visits all seven stars.</p>
    <p><b>Points.</b> A word of ${inWords(MIN_LEN)} letters scores 1, a longer word a point a letter, and a full tour ${FULL_BONUS} more: a six-letter word scores 6, a full tour of seven letters ${7 + FULL_BONUS}.</p>
    <p><b>Shadows.</b> Switch them on and every sight-line glows by how many of the words you have not found yet travel along it: brighter, more words. It says where to look, not what is there, and the glow dims as you find them.</p>
    <p><b>Hint.</b> The star beside Delete shows the start of the easiest word left: two stars of it and a dot for each letter, and one more star at each press.</p>
    <p><b>Ranks.</b> Your points take you from the dark sky to the galaxy, each rank a share of the puzzle's points: ${ranks.slice(0, -1).join(", ")} and ${ranks.at(-1)}. ${RANKS[MASTER][1]} is the one to aim for. Tap the gauge for the points each rank needs.</p>
    <p><b>The words.</b> Ordinary English, the same on both sides of the Atlantic: the letters never include an S, or every plural would count, and a spelling only one side uses (colour or color) never counts. A word that doesn't count is told apart: not a word, or a word but rarer than this list.</p>
    <p><b>Playing.</b> Tap or drag across the stars, then Enter. Delete takes a letter off, or the whole word if you hold it. On a keyboard: type, Enter, Backspace, Esc to clear.</p>
    <p><b>Levels.</b> Light, Medium and Heavy, which come by themselves (up as you reach ${RANKS[MASTER][1]}, down when you show the words): how far down the vocabulary ${RANKS[MASTER][1]} takes you. Light gets there on everyday words; Heavy needs words people use less.</p>
    <p><b>Today's puzzle.</b> A ${LEVELS[DAILY.level]} sky, the same for everyone, and a new one at midnight UTC. Your points count for the day as each word is found, so you can leave and come back.</p>
    <p><b>Together.</b> A race: the same sky for everyone and a clock of ${inWords(RACE_SECS / 60)} minutes, the most points winning.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}

// ---------- messages ----------
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "yield");
document.querySelector(".yd-mark").innerHTML = APPS.find(a => a.id === "yield")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("sheetClose").addEventListener("click", closeSheet);
$("sheetDlg").addEventListener("click", e => {
  if (e.target === $("sheetDlg")) { closeSheet(); return; }
  const li = e.target.closest?.(".yd-words li[data-w]");
  if (li) gloss(li);
});
$("gauge").addEventListener("click", openRanks);
$("foundBtn").addEventListener("click", () => { if (!sideways()) openWords(); });
$("shadowBtn").addEventListener("click", shadowsToggle);
$("hintBtn").addEventListener("click", hint);
$("enterBtn").addEventListener("click", enter);
// Delete: a tap takes a letter off, a hold clears the word
{
  let hold = 0, held = false;
  const btn = $("delBtn");
  btn.addEventListener("pointerdown", () => { held = false; clearTimeout(hold); hold = setTimeout(() => { held = true; clearWord(); }, 450); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) btn.addEventListener(ev, () => clearTimeout(hold));
  btn.addEventListener("click", () => { if (!held) del(); held = false; });
}
// a touch on a star: its letter goes in as the finger lands, and a drag on to the next star (with a sight-line) takes that
// one too, so a word can be swept across the sky; a drag is not sent in, Enter does that
{
  let last = null;
  const starAt = (x, y) => document.elementFromPoint(x, y)?.closest?.(".yd-star");
  const press = g => {
    const i = Number(g.dataset.i);
    g.classList.add("down");
    setTimeout(() => g.classList.remove("down"), 110);
    if (add(S?.p.letters[i] || "")) last = i;
  };
  $("board").addEventListener("pointerdown", e => {
    const g = starAt(e.clientX, e.clientY);
    if (!g || e.button > 0 || !S) return;
    e.preventDefault();
    last = null;
    press(g);
  });
  $("board").addEventListener("pointermove", e => {
    if (last == null || !(e.buttons & 1) && e.pointerType === "mouse") return;
    const g = starAt(e.clientX, e.clientY), i = g ? Number(g.dataset.i) : null;
    if (i == null || i === last) return;
    if (add(S.p.letters[i], { quiet: true })) last = i;
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("board").addEventListener(ev, () => { last = null; });
}
$("board").addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
  if (/^[a-zA-Z]$/.test(e.key)) { add(e.key); e.preventDefault(); }
  else if (e.key === "Backspace") { del(); e.preventDefault(); }
  else if (e.key === "Enter") { enter(); e.preventDefault(); }
  else if (e.key === "Escape") clearWord();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) duel.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
setInterval(() => {
  if (!S) return;
  if (S.kind === "race" && raceLeft() <= 0 && !S.over) { S.over = true; tell(true); save(); render(); return; }   // duel.js shows the result
  drawClock();
}, 250);
// the dictionary comes once the page is drawn, so the first rare word traced is answered at once
setTimeout(() => { if (!IN_FRAME) loadDict(); }, 2500);
addEventListener("resize", () => drawFound());

// for tests and debugging
window.__yield = { get state() { return S; }, get derived() { return P; }, add, del, enter, hint, shadowsToggle, finish, showToday, newRandom, duel, openWords };

/** Your own puzzle: the one that was on the screen (today's, or the random one), or today's when the games screen's
 *  tile sent you for it. Today's and the random one are kept apart, so going to today's loses nothing. */
function solo(forToday = false) {
  if (IN_FRAME) { const kept = read(read(ON, "day") === "run" ? RUN : DAY, null); if (validRun(kept)) show(kept); else render(); return; }
  if (forToday || read(ON, "day") === "day") showToday(); else showRandom();
}
const sentForToday = arrivedForToday();
// a match in the address: its sky, with no solo puzzle dealt under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(sentForToday); });
else solo(sentForToday);
