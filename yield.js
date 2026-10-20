// Yield (README, Yield): Spelling Bee's genre. Seven letters in a hive, or nine tiles in a wheel; words of four letters
// or more from them, each with the centre letter; points for each, ranks from Crude to Full yield. The rules, the
// puzzles and the computer player are yield-engine.js's; this file keeps the runs, draws the board and takes the taps.
// Today's puzzle and a random one are kept apart, so switching between them loses neither. Together (duel.js): a race,
// the same letters for everyone against the clock, or a team, the same letters with a centre letter each.
import { BOARDS, LEVELS, RANKS, RIVALS, deal, daily, dealTeam, yieldOf, totalOf, pointsOf, isFull, needed, rankOf, judge, chartOf,
  planFor, rivalAt, outerOf, centreFor, centresIn, teamFound, onlyMine } from "./yield-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, arrivedForToday, dailyDue, reportDuo, IN_FRAME } from "./suite.js";
import { createDuel } from "./duel.js";
import { branchPath } from "./rooms.js";
import { sextant } from "./loading.js";

dropdown(document.getElementById("pick"));   // the header dropdown in the suite's style (dropdown.js)

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = secs => { const s = Math.max(0, Math.ceil(secs)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };
const first = name => String(name || "Player").trim().split(/\s+/)[0];
const up = w => w.toUpperCase();

// ---------- what's kept ----------
// yield:day today's puzzle as played; yield:last the daily before it (its words shown from the menu); yield:run the
// random one; yield:on which of the two is on the screen; yield:prefs the choices; yield:stats the record;
// yield:daily today's points by the day, for the games screen; yield:duel a match's run on this device (duel.js's).
const DAY = "yield:day", RUN = "yield:run", ON = "yield:on", PREFS = "yield:prefs", STATS = "yield:stats", DAILY_KEY = "yield:daily", LAST = "yield:last";
const SAVE_EVERY = 5000;                          // ms between saves of the clock while it runs
const CLOCKS = [[0, "Untimed"], [180, "3 min"], [300, "5 min"]];
const prefs = { level: "medium", board: "hive", secs: 0, rival: "off", together: null, raceSecs: 180, ...read(PREFS, {}) };
// what a match you deal will be, until you choose: a pair plays as a team (a centre each, each needing the other); a
// party, a table of friends, races
const togetherMode = () => prefs.together || (new URLSearchParams(location.search).has("party") ? "race" : "team");
if (!LEVELS[prefs.level]) prefs.level = "medium";
if (!BOARDS[prefs.board]) prefs.board = "hive";
const keepPrefs = () => write(PREFS, prefs);

// ---------- the dictionary, for the words Yield doesn't count (wordlist.js, loaded once it's wanted) ----------
let dict = null, dictLoading = null;
function loadDict() {
  dictLoading ??= import("./wordlist.js").then(m => { dict = { isWord: m.isWord, isVariant: m.isVariant }; return dict; }).catch(e => { console.error(e); dictLoading = null; return null; });
  return dictLoading;
}

// ---------- the run on the screen ----------
// S: { kind ("day", "run", "race" or "team"), p (the puzzle), found (in the order found), extra (words typed that
// don't count), typed, picks (a wheel's tile for each typed letter, -1 for none free), outer (the letters round the
// centre, as shown), used (ms on the clock), secs (a sprint's length, 0 untimed), rival, top (the best rank reached),
// over, shown (the words were revealed) } and, in a match, begun and n.
let S = null;
let P = null;          // what the run's puzzle gives: { words, set, total, need, mine (this player's words), centre, plan, union }
let team = null;       // a team match as the table has it: { found: Map(word -> slot), people, over, others }
let raceTable = null;  // a race as the table has it: the others' points, for the gauge
let message = null;    // { text, tone, pts } on the line until the next change
let messageTimer = 0;
let clockFrom = null, savedAt = 0, paused = false;

const myCentre = () => (S?.kind === "team" ? centreFor(S.p, duel.together.slot ?? 0) : S?.p.centre);
const boardP = () => (S ? { ...S.p, centre: myCentre() } : null);    // the puzzle as this player plays it (a team's: their centre)
/** Works out what a run's puzzle gives, once per puzzle. */
function derive() {
  const p = boardP(), mine = yieldOf(p);
  const union = S.kind === "team" ? yieldOf(S.p, centresIn(S.p, team?.people || 2)) : mine;
  const total = totalOf(p, union);
  const plan = S.rival && RIVALS[S.rival] && S.kind !== "race" && S.kind !== "team" ? planFor(p, mine, S.rival, p.seed) : [];
  P = { words: union, set: new Set(union), mine: new Set(mine), total, need: needed(total), centre: p.centre, plan };
}
/** The words found that count here: a team's, every player's; else this player's. */
const foundMap = () => {
  if (S?.kind === "team" && team) { const m = new Map(team.found); for (const w of S.found) if (!m.has(w)) m.set(w, duel.together.slot ?? 0); return m; }
  return new Map((S?.found || []).map(w => [w, null]));
};
const pointsNow = () => (S && P ? totalOf(boardP(), [...foundMap().keys()].filter(w => P.set.has(w))) : 0);
const isOver = () => !!S?.over || (S?.kind === "team" && !!team?.over);

// ---------- the board ----------
const R = 50, H = Math.sqrt(3) * R;
// a hive: the centre, then the six round it clockwise from the top; a wheel: three rows of three, the centre in the middle
const HIVE = [[0, 0], [0, -H], [1.5 * R, -H / 2], [1.5 * R, H / 2], [0, H], [-1.5 * R, H / 2], [-1.5 * R, -H / 2]];
const WHEEL = [[-88, -88], [0, -88], [88, -88], [-88, 0], [0, 0], [88, 0], [-88, 88], [0, 88], [88, 88]];
const hexPoints = (cx, cy, r) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
let cells = [];        // [{ g, text, letter, centre }] in board order
let drawnFor = null;
/** The board's letters, in board order: a hive's centre first, a wheel's centre fifth. */
function boardLetters() {
  const out = [...(S.outer || "")];
  if (S.p.board === "wheel") out.splice(4, 0, myCentre()); else out.unshift(myCentre());
  return out;
}
function drawBoard() {
  const box = $("board");
  if (!S) { box.replaceChildren(); drawnFor = null; cells = []; return; }
  const wheel = S.p.board === "wheel", key = `${S.p.board}:${S.p.letters}:${myCentre()}:${S.outer}`;
  if (drawnFor === key) return;
  drawnFor = key;
  const svg = svgEl("svg", { viewBox: wheel ? "-136 -136 272 272" : "-131 -134 262 268", role: "presentation" });
  const spots = wheel ? WHEEL : HIVE, letters = boardLetters(), centreAt = wheel ? 4 : 0;
  cells = spots.map(([x, y], i) => {
    const g = svgEl("g", { class: `yd-cell${i === centreAt ? " centre" : ""}`, "data-i": String(i) });
    if (wheel) {
      g.append(svgEl("rect", { class: "face", x: x - 40, y: y - 40, width: 80, height: 80, rx: 6 }), svgEl("rect", { class: "inlay", x: x - 34, y: y - 34, width: 68, height: 68, rx: 3 }));
    } else {
      g.append(svgEl("polygon", { class: "face", points: hexPoints(x, y, R * 0.94) }), svgEl("polygon", { class: "inlay", points: hexPoints(x, y, R * 0.8) }));
    }
    const text = svgEl("text", { x, y: y + 1, "font-size": wheel ? 44 : 46 });
    text.textContent = letters[i] || "";
    g.append(text);
    svg.append(g);
    return { g, text, letter: letters[i], centre: i === centreAt, x, y };
  });
  box.replaceChildren(svg);
  markTeam();
  drawUsed();
}
/** At a team's table, the other players' centre letters on this board, each ringed in its player's colour. */
function markTeam() {
  for (const c of cells) { c.g.querySelector(".ring")?.remove(); c.g.querySelector(".tag")?.remove(); c.g.style.removeProperty("--who"); }
  if (S?.kind !== "team") return;
  const me = duel.together.slot ?? 0;
  for (const o of people()) {
    if (o.slot === me) continue;
    const c = cells.find(x => !x.centre && x.letter === centreFor(S.p, o.slot));
    if (!c) continue;
    c.g.style.setProperty("--who", `var(--p${o.slot % 6})`);
    c.g.insertBefore(svgEl("polygon", { class: "ring", points: hexPoints(c.x, c.y, R * 0.8) }), c.text);
    const tag = svgEl("text", { class: "tag", x: c.x, y: c.y - R * 0.55 });
    tag.textContent = initial(o.name);
    c.g.append(tag);
  }
}
/** A wheel's tiles in use by the word being made. */
function drawUsed() {
  if (!S || S.p.board !== "wheel") return;
  const used = new Set(S.picks || []);
  cells.forEach((c, i) => c.g.classList.toggle("used", used.has(i)));
}
function setBoardOff(off) { $("board").classList.toggle("off", off); }

// ---------- typing ----------
const canType = () => !!S && !!P && !isOver() && !IN_FRAME && !paused && !(S.kind === "race" && raceLeft() <= 0);
/** A letter, from a tap on the board (its cell) or a key: a wheel's tile is used once, the first free one of a key's letter. */
function add(letter, cell = null) {
  if (!canType() || S.typed.length >= 15) return;
  letter = letter.toLowerCase();
  if (S.p.board === "wheel") {
    const used = new Set(S.picks);
    let at = cell != null ? cell : cells.findIndex((c, i) => c.letter === letter && !used.has(i));
    if (at != null && used.has(at)) return;              // that tile is in the word already
    S.picks.push(at ?? -1);
  }
  S.typed += letter;
  message = null;
  typedChanged();
}
function del() {
  if (!canType() || !S.typed) return;
  S.typed = S.typed.slice(0, -1);
  if (S.p.board === "wheel") S.picks.pop();
  typedChanged();
}
function clearWord() {
  if (!S || !S.typed) return;
  S.typed = ""; S.picks = [];
  typedChanged();
}
function typedChanged() { drawWord(); drawUsed(); drawLine(); save(); }
function shuffle() {
  if (!S || IN_FRAME) return;
  const board = $("board");
  board.classList.add("mixing");
  setTimeout(() => {
    S.outer = outerOf(boardP());
    S.picks = [];                                       // a wheel's tiles move: the word keeps its letters, typed afresh onto them
    if (S.p.board === "wheel") { const t = S.typed; S.typed = ""; for (const ch of t) add(ch); }
    drawnFor = null;
    drawBoard();
    board.classList.remove("mixing");
    save();
  }, 90);
}

// ---------- a word entered ----------
const PRAISE = w => (w.length <= 4 ? "Good" : w.length <= 6 ? "Fine" : "Splendid");
async function enter() {
  if (!canType() || !S.typed) return;
  const word = S.typed;
  const p = boardP(), have = foundMap(), seats = S.kind === "team" ? new Map(people().filter(o => o.slot !== (duel.together.slot ?? 0)).map(o => [o.slot, centreFor(S.p, o.slot)])) : null;
  let r = judge(p, word, { have, centre: p.centre, seats, dict });
  if (r.kind === "unknown" && !dict) {                   // the first word Yield doesn't count: the dictionary, then judge again
    say("", "", null, true);
    await loadDict();
    if (S?.typed !== word) return;
    r = judge(p, word, { have: foundMap(), centre: p.centre, seats, dict });
  }
  if (r.kind === "word" && !P.set.has(word)) r = { kind: "unknown" };   // not this table's (a team's yield is the seats' in play)
  S.typed = ""; S.picks = [];
  const nameOf = slot => first(people().find(o => o.slot === slot)?.name);
  switch (r.kind) {
    case "word": {
      const before = rankOf(pointsNow(), P.total);
      S.found.push(word);
      const after = rankOf(pointsNow(), P.total);
      say(r.full ? (p.board === "wheel" ? "Every tile!" : "Pangram!") : after > before ? `${RANKS[after][1]}!` : PRAISE(word), "good", r.points);
      found();
      break;
    }
    case "short": refuse("Too short: four letters at least"); break;
    case "letters": refuse(p.board === "wheel" ? "Only the letters on the tiles" : "Only the letters in the hive"); break;
    case "tiles": refuse("Each tile once only"); break;
    case "centre": refuse(r.by != null ? `That one's ${nameOf(r.by)}'s: it has their ${up(centreFor(S.p, r.by))}, not your ${up(p.centre)}` : `Missing the centre letter, ${up(p.centre)}`); break;
    case "found": refuse(r.by != null && r.by !== (duel.together.slot ?? 0) ? `${nameOf(r.by)} found that one` : "Already found"); break;
    case "variant": noteExtra(word); refuse("One side of the Atlantic's spelling only: not counted", ""); break;
    case "rare": noteExtra(word); refuse("A word, but rarer than Yield counts", ""); break;
    default: refuse("Not in Yield's list");
  }
  drawWord(); drawUsed(); render(); save();
}
function noteExtra(word) { if (!S.extra.includes(word)) S.extra.push(word); }
function refuse(text, tone = "bad") {
  say(text, tone);
  const w = $("word");
  w.classList.remove("shake"); void w.offsetWidth; w.classList.add("shake");
  navigator.vibrate?.(tone === "bad" ? 18 : 0);
}
/** A word that counts: the daily's figure, the record, the table, and the end once everything is found. */
function found() {
  const pts = pointsNow(), rank = rankOf(pts, P.total), have = foundMap(), all = P.words.every(w => have.has(w));
  if (S.kind === "day") noteDaily(pts);
  if (rank > S.top) { noteRank(S.top, rank); S.top = rank; }
  if (S.kind === "team") { tell(); if (all) endTeam(); return; }
  if (S.kind === "race") { if (all) S.over = true; tell(all); return; }     // a race's result sheet is duel.js's
  if (all) finish("full");
}
/** Today's points so far, for the games screen (and your partner's): every word counts the moment it's found. */
function noteDaily(pts) {
  const d = read(DAILY_KEY, {}) || {};
  if ((d[S.p.day] ?? -1) >= pts) return;
  const keepDays = Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) >= S.p.day - 400));   // a year or so is plenty
  write(DAILY_KEY, { ...keepDays, [S.p.day]: pts });
}
/** The record: how often the coveted rank and the full yield were reached (each puzzle counts once). */
function noteRank(from, to) {
  if (S.kind === "race" || S.kind === "team") return;
  const st = read(STATS, {}) || {};
  if (from < 8 && to >= 8) st.master = (st.master || 0) + 1;
  if (from < 9 && to >= 9) st.full = (st.full || 0) + 1;
  write(STATS, st);
}

// ---------- the clock: a sprint's, and the time on screen a rival plays to ----------
const clocked = () => !!S && (S.kind === "day" || S.kind === "run") && !S.over;
function clockRun() {
  if (IN_FRAME || !clocked() || clockFrom != null || document.hidden || isPaused() || paused) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null || !S) return;
  S.used += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
const usedMs = () => (S ? S.used + (clockFrom != null ? performance.now() - clockFrom : 0) : 0);
const sprintLeft = () => (S?.secs ? S.secs - usedMs() / 1000 : Infinity);
const raceLeft = () => (S?.kind === "race" ? S.secs - (duel.now() - S.begun) / 1000 : Infinity);
onPause(() => { paused = true; clockPause(); drawLine(); }, () => { paused = false; clockRun(); });
function tick() {
  if (!S) return;
  if (S.kind === "race") {
    if (raceLeft() <= 0 && !S.over) { S.over = true; tell(true); save(); render(); return; }   // duel.js shows the result
  } else if (clocked() && S.secs && sprintLeft() <= 0) { clockPause(); S.used = S.secs * 1000; finish("time"); return; }
  drawClock();
  drawRival();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}

// ---------- drawing ----------
function drawWord() {
  const w = $("word"), typed = S?.typed || "", letters = S ? new Set(S.p.letters) : new Set(), centre = myCentre();
  w.replaceChildren(...[...typed].map((ch, i) => el("span", ch === centre ? "c" : !letters.has(ch) || (S.p.board === "wheel" && S.picks[i] === -1) ? "x" : "", ch)));
  w.style.setProperty("--word-size", `${Math.max(1.05, 1.9 - Math.max(0, typed.length - 9) * 0.14).toFixed(2)}rem`);
  w.classList.toggle("off", !canType());
  w.setAttribute("aria-label", typed ? `Your word: ${typed}` : "No letters yet");
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
  if (message?.waiting) { l.replaceChildren(sextant(), "Looking it up"); return; }
  if (message) {
    l.replaceChildren(message.text);
    if (message.pts != null) l.append(el("span", "pts", `+${message.pts}`));
    return;
  }
  const idle = !S ? (duel.on ? "The letters show when the match starts" : "")
    : isOver() ? (S.kind === "race" ? "Time" : S.shown ? "Every word shown" : S.over && S.secs ? "Time" : "")
    : paused ? "" : S.found.length ? ""
    : S.kind === "team" ? `Your letter is ${up(myCentre())}: every word of yours has it`
    : S.p.board === "wheel" ? "Each tile once; every word uses the centre" : "Four letters or more, each with the centre";
  l.replaceChildren(idle);
}
function drawGauge() {
  const pts = pointsNow(), total = P?.total || 0, rank = S && P ? rankOf(pts, total) : 0;
  $("rank").textContent = RANKS[rank][1];
  $("points").replaceChildren(String(pts), ...(total ? [el("small", "", ` / ${total}`)] : []));
  const scale = $("scale");
  if (scale.childElementCount !== RANKS.length + 1) {
    scale.replaceChildren(...RANKS.map((_, i) => { const t = el("i", `yd-tick${i === RANKS.length - 1 ? " top" : ""}`); t.style.left = `${(i / (RANKS.length - 1)) * 100}%`; return t; }), el("i", "yd-index"));
  }
  [...scale.querySelectorAll(".yd-tick")].forEach((t, i) => t.classList.toggle("on", !!total && pts >= P.need[i]));
  scale.querySelector(".yd-index:not(.them)").style.left = `${placeOf(pts) * 100}%`;
  // the rival's index, or the others' in a race, under the scale in their colours
  for (const x of scale.querySelectorAll(".yd-index.them")) x.remove();
  for (const o of rivalsOnGauge()) { const x = el("i", "yd-index them"); x.style.left = `${placeOf(o.points) * 100}%`; x.style.setProperty("--who", o.colour); x.title = o.name; scale.append(x); }
  $("gauge").setAttribute("aria-label", `${RANKS[rank][1]}: ${pts} of ${total} points. The ranks`);
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
function rivalsOnGauge() {
  if (!S || !P) return [];
  if (P.plan.length) return [{ name: RIVALS[S.rival].label, points: rivalAt(boardP(), P.plan, usedMs() / 1000).points, colour: "var(--p1)" }];
  if (S.kind === "race" && raceTable) return raceTable.map(o => ({ name: o.name, points: o.points, colour: `var(--p${o.slot % 6})` }));
  return [];
}
function drawClock() {
  const c = $("clock"), left = S?.kind === "race" ? raceLeft() : S?.kind === "team" ? Infinity : sprintLeft();
  c.hidden = !S || !Number.isFinite(left);
  if (c.hidden) return;
  c.textContent = fmt(Math.max(0, left));
  c.classList.toggle("low", left <= 30);
}
function drawFound() {
  const map = foundMap(), words = [...map.keys()].filter(w => P?.set.has(w));
  $("foundCount").textContent = plural(words.length, "word");
  $("foundLeft").textContent = P ? `of ${P.words.length}${S?.kind === "team" ? " for the team" : ""}` : "";
  const list = $("foundList"), latest = S?.found.at(-1);
  // newest first on a phone's one line; held sideways the box shows them all, in alphabetical order
  const order = matchMedia("(orientation: landscape) and (min-width: 700px)").matches ? [...words].sort() : [...(S?.kind === "team" ? [...map.keys()] : S?.found || [])].filter(w => P?.set.has(w)).reverse();
  list.replaceChildren(...order.flatMap((w, i) => {
    const s = el("span", `${isFull(boardP(), w) ? "full" : ""}${w === latest ? " new" : ""}`, up(w));
    const by = map.get(w);
    if (S.kind === "team" && by != null) { s.classList.add("by"); s.style.setProperty("--who", `var(--p${by % 6})`); }
    return i && !sidewaysNow() ? [" ", s] : [s];
  }));
}
const sidewaysNow = () => matchMedia("(orientation: landscape) and (min-width: 700px)").matches;
/** The line under the words: a rival as it plays (solo), the table's own line in a match (duel.js draws that). */
function drawRival() {
  const v = $("vs"), show = !!S && P?.plan.length > 0 && !duel.on;
  v.hidden = !show;
  if (!show) return;
  const now = rivalAt(boardP(), P.plan, usedMs() / 1000), rank = rankOf(now.points, P.total);
  const sig = `${now.points}/${rank}`;
  if (v.dataset.sig === sig) return;
  v.dataset.sig = sig;
  v.replaceChildren(el("b", "", RIVALS[S.rival].label), ` ${plural(now.words.length, "word")}, ${plural(now.points, "point")} · ${RANKS[rank][1]}`);
}
function render() {
  const p = boardP();
  $("pick").options[0].disabled = duel.on;          // at a table the header deals a match at a level; today's isn't one
  if (S && P) $("pick").value = S.kind === "day" ? "today" : LEVELS[S.p.level] ? S.p.level : "medium";
  drawBoard(); drawWord(); drawLine(); drawGauge(); drawFound(); drawClock(); drawRival();
  const off = !canType();
  setBoardOff(off);
  for (const id of ["delBtn", "enterBtn"]) $(id).disabled = off;
  $("mixBtn").disabled = !S || IN_FRAME;
  $("chartBtn").disabled = !p;
  $("foundBtn").disabled = !p;
}

// ---------- keeping ----------
function save() {
  if (IN_FRAME || !S) return;
  if (S.kind === "race" || S.kind === "team") duel.keep(S);
  else write(S.kind === "day" ? DAY : RUN, S);
  savedAt = performance.now();
}
const validRun = s => !!s && !!s.p && BOARDS[s.p.board] && typeof s.p.letters === "string" && typeof s.p.centre === "string" && Array.isArray(s.found);
/** A run made whole: what an older save or the database's round trip leaves out. */
const tidy = s => ({ typed: "", picks: [], extra: [], used: 0, secs: 0, rival: null, top: 0, over: false, shown: false, ...s, found: [...(s.found || [])] });
const started = s => !!s && !s.over && (s.found.length > 0 || s.used > 20000);

// ---------- starting ----------
/** Puts a run on the screen: `s` is a run (tidied), its puzzle worked out here. */
function show(s) {
  clockPause();
  S = tidy(s);
  if (!S.outer || S.outer.length !== S.p.letters.length - 1) S.outer = outerOf(boardP());
  derive();
  drawnFor = null;
  message = null;
  if (S.kind === "day" || S.kind === "run") write(ON, S.kind);
  save();
  clockRun();
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
  if (!last?.p) return;
  const words = yieldOf(last.p), got = new Set(last.found), body = sheet(dayName(last.p.day));
  body.append(el("p", "yd-sum", `${plural(last.found.length, "word")} of ${words.length}, ${totalOf(last.p, last.found.filter(w => words.includes(w)))} of ${totalOf(last.p, words)} points. The centre was ${up(last.p.centre)}.`));
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
function newRandom(level = prefs.level) {
  const p = deal({ seed: randomSeed(), level, board: prefs.board });
  const st = read(STATS, {}) || {};
  write(STATS, { ...st, puzzles: (st.puzzles || 0) + 1 });
  show({ kind: "run", p, found: [], secs: prefs.secs, rival: prefs.rival !== "off" ? prefs.rival : null });
}
function showRandom() {
  const kept = read(RUN, null);
  if (validRun(kept) && !kept.over) show(kept); else newRandom();
}
/** Asks before leaving a random puzzle under way for a new one. */
function confirmNew(level) {
  const kept = S?.kind === "run" ? S : read(RUN, null);
  if (started(kept) && !confirm("Start a new puzzle? This one isn't finished.")) return false;
  newRandom(level);
  return true;
}

// ---------- the end of a puzzle ----------
/** A puzzle over: "full" (every word found), "time" (a sprint's clock), "shown" (the words revealed). */
function finish(how) {
  if (!S || (S.over && how !== "full")) return;
  clockPause();
  S.over = true;
  if (how === "shown") S.shown = true;
  if (how === "time" && S.kind === "run") {
    const key = `${S.secs}:${S.p.board}:${S.p.level}`, st = read(STATS, {}) || {}, best = st.sprints?.[key];
    S.fresh = best == null || pointsNow() > best;
    if (S.fresh) write(STATS, { ...st, sprints: { ...(st.sprints || {}), [key]: pointsNow() } });
  }
  save();
  render();
  openDone();
}
function openDone() {
  const pts = pointsNow(), rank = rankOf(pts, P.total), map = foundMap(), got = [...map.keys()].filter(w => P.set.has(w));
  const body = sheet(S.kind === "team" ? "The team's yield" : S.secs && !S.shown ? "Time" : RANKS[rank][1]);
  body.append(stats([[pts, `of ${P.total} points`], [got.length, `of ${P.words.length} words`], [S.kind === "race" || S.kind === "team" ? RANKS[rank][1] : fmtLong(usedMs()), S.kind === "race" || S.kind === "team" ? "rank" : "on the clock"]]));
  if (S.kind === "run" && S.secs) {
    const best = read(STATS, {})?.sprints?.[`${S.secs}:${S.p.board}:${S.p.level}`];
    body.append(el("p", "yd-sum", S.fresh ? "A new best for this sprint." : best != null ? `Your best at ${S.secs / 60} minutes, ${BOARDS[S.p.board].toLowerCase()} ${LEVELS[S.p.level].toLowerCase()}: ${best}.` : ""));
  }
  if (P.plan.length) {
    const them = rivalAt(boardP(), P.plan, usedMs() / 1000);
    body.append(el("p", "yd-sum", `${RIVALS[S.rival].label} made ${them.points} points with ${plural(them.words.length, "word")}: ${pts > them.points ? "you win" : pts === them.points ? "a draw" : `${RIVALS[S.rival].label} wins`}.`));
  }
  // the way on before the words, which can run long
  if (S.kind === "day" || S.kind === "run") {
    if (dailyDue("yield") && S.kind !== "day") body.append(action("Today's puzzle", () => { closeSheet(); showToday(); }, "primary"));
    body.append(action("Another puzzle", () => { closeSheet(); newRandom(); }, dailyDue("yield") && S.kind !== "day" ? "" : "primary"));
  } else if (S.kind === "team") body.append(action("Another puzzle together", () => { closeSheet(); duel.again(); }, "primary"));
  body.append(el("h4", "yd-h", "Every word"), wordList(P.words, map, { missed: S.over || isOver() }));
  openSheet();
}
const fmtLong = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`; };
function stats(items) {
  const box = el("div", "yd-stats");
  for (const [v, label] of items) { const d = el("div"); d.append(el("b", "", String(v)), el("span", "", label)); box.append(d); }
  return box;
}
/** The words, alphabetical, in columns: found ones as they are (a team's in their finder's colour), missed ones faint. */
function wordList(words, map, { missed = false } = {}) {
  const ul = el("ul", `yd-words${missed ? " shown" : ""}`), p = boardP();
  for (const w of [...words].sort()) {
    const got = map.has(w);
    if (!got && !missed) continue;
    const li = el("li", `${isFull(p, w) ? "full" : ""}${got ? "" : " miss"}`);
    li.dataset.w = w;
    const by = map.get(w);
    if (S.kind === "team" && got && by != null) { const dot = el("i", "who"); dot.style.setProperty("--who", `var(--p${by % 6})`); li.append(dot); }
    li.append(up(w));
    ul.append(li);
  }
  return ul;
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

// ---------- the sheets: words, chart, ranks ----------
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
  const map = foundMap(), got = [...map.keys()].filter(w => P.set.has(w));
  const body = sheet(S.kind === "team" ? "The team's words" : "Your words");
  body.append(el("p", "yd-sum", `${plural(got.length, "word")} of ${P.words.length}, ${pointsNow()} of ${P.total} points. Tap a word for what it means.`));
  if (S.kind === "team") body.append(teamKey());
  body.append(wordList(P.words, map, { missed: isOver() }));
  if (S.extra.length) body.append(el("h4", "yd-h", "Also words, not counted"), el("p", "yd-note", S.extra.map(up).join(", ")));
  openSheet();
}
function openChart() {
  if (!S || !P) return;
  const map = foundMap();
  if (S.kind === "team") {
    // a player holds the next player's chart round the table: what's left that they can enter, to tell them
    const me = duel.together.slot ?? 0, all = people(), next = all.length > 1 ? all[(all.findIndex(o => o.slot === me) + 1) % all.length] : null;
    if (next && next.slot !== me) {
      const theirs = yieldOf(S.p, [centreFor(S.p, next.slot)]).filter(w => P.set.has(w));
      const body = sheet(`${first(next.name)}'s chart`);
      body.append(el("p", "yd-note", `What's left that ${first(next.name)} can enter, with their letter ${up(centreFor(S.p, next.slot))}: theirs to find and yours to tell them. Their phone has yours.`));
      chartInto(body, chartOf(theirs, new Set(map.keys())));
      const mine = [...P.mine].filter(w => !map.has(w)), onlyMine = mine.filter(w => !w.includes(centreFor(S.p, next.slot)));
      body.append(el("h4", "yd-h", "Yours"), el("p", "yd-note", `${plural(mine.length, "word")} left with your ${up(myCentre())}, ${onlyMine.length} only you can enter.`));
      openSheet();
      return;
    }
  }
  const body = sheet("Yield chart");
  body.append(el("p", "yd-note", "What's left to find, by first letter and length, and by the first two letters."));
  chartInto(body, chartOf(P.words, new Set(map.keys())));
  openSheet();
}
function chartInto(body, c) {
  if (!c.left) { body.append(el("p", "yd-sum", "Nothing left: every word is found.")); return; }
  const table = el("table", "yd-grid"), head = el("tr");
  head.append(el("th", "", ""), ...c.lengths.map(n => el("th", "", n === 9 ? "9+" : String(n))), el("th", "", "Σ"));
  const thead = el("thead"); thead.append(head); table.append(thead);
  const tbody = el("tbody");
  for (const r of c.rows) {
    const tr = el("tr"), th = el("th", "", r.letter);
    th.scope = "row";
    tr.append(th, ...c.lengths.map(n => el("td", r.n[n] ? "" : "z", r.n[n] ? String(r.n[n]) : "–")), el("td", r.total ? "" : "z", String(r.total)));
    tbody.append(tr);
  }
  const sum = el("tr", "sum");
  sum.append(el("th", "", "Σ"), ...c.lengths.map(n => { const v = c.rows.reduce((s, r) => s + (r.n[n] || 0), 0); return el("td", v ? "" : "z", v ? String(v) : "–"); }), el("td", "", String(c.left)));
  tbody.append(sum);
  table.append(tbody);
  body.append(table, el("h4", "yd-h", "First two letters"));
  const ul = el("ul", "yd-starts");
  for (const [two, n] of c.starts) { const li = el("li"); li.append(el("b", "", two), `-${n}`); ul.append(li); }
  body.append(ul);
}
function openRanks() {
  if (!S || !P) return;
  const pts = pointsNow(), rank = rankOf(pts, P.total), body = sheet("Ranks");
  body.append(el("p", "yd-note", "A refinery's run, from crude to every drop: each rank a share of the puzzle's points. Master refiner is the one to aim for; Full yield is every word."));
  const ul = el("ul", "yd-ranks");
  RANKS.forEach(([, name], i) => { const li = el("li", `${i === rank ? "on" : ""}${i < rank ? " done" : ""}`); li.append(el("b", "", name), el("span", "", String(P.need[i]))); ul.append(li); });
  body.append(ul);
  openSheet();
}

// ---------- together: a race or a team (duel.js) ----------
// The first to sit down at the table deals the match their own way (the menu's Together); either can deal the other
// kind from the menu at the table. A race: the same letters for everyone and a clock, the most points wins (duel.js
// ranks it). A team: the same letters and a centre each (README, Yield: Together), every player's words in one yield;
// each phone writes only its own words, to its own run, so two finds at once never collide, and the team's yield is
// every run's words together. A team's match isn't ranked: it ends when every word is found or someone calls it, and
// is recorded for the pair as a team's.
let tableWatch = null, teamReported = null;
const initial = name => (Array.from(first(name))[0] || "?").toUpperCase();
/** Everyone at the table, by seat: [{ slot, name, me }]. */
function people() {
  const g = duel.together.room?.data, me = duel.together.slot;
  if (!g) return [];
  return Object.values(g.players || {}).filter(x => x && x.slot != null).map(x => ({ slot: x.slot, name: x.name, me: x.slot === me })).sort((a, b) => a.slot - b.slot);
}
const matchText = m => (m.mode === "team"
  ? `Team: ${BOARDS[m.board]} at ${LEVELS[m.level]}. The same letters, a centre letter each: one yield between you`
  : `Race: ${BOARDS[m.board]} at ${LEVELS[m.level]}, ${m.secs / 60} minutes. The same letters for everyone: the most points wins`);
const duel = createDuel({
  game: "yield", name: "Yield", accent: "--yd-in", line: $("duelLine"), toast,
  deal: () => ({ seed: randomSeed(), mode: togetherMode(), board: prefs.board, level: prefs.level, secs: prefs.raceSecs || 180 }),
  describe: matchText,
  play: (m, { begun, kept, done, run, n }) => playMatch(m, { begun, kept, done, run, n }),
  onLobby: () => { clockPause(); S = null; P = null; team = null; raceTable = null; closeSheet(); render(); },
  onLeave: () => { stopWatch(); team = null; raceTable = null; solo(); },
  extra: () => raceExtra(),
  extraTitle: "Your words",
});
/** This device's run of a match, from what it kept or what the table has of it. */
function playMatch(m, { begun, kept, done, run, n }) {
  const p = m.mode === "team" ? dealTeam(m) : deal(m);
  const same = kept && kept.p?.letters === p.letters && kept.n === n, words = run?.words || {};
  S = null;
  show({ ...(same ? kept : {}), kind: m.mode === "team" ? "team" : "race", p, found: same ? kept.found : Object.keys(words), times: same ? kept.times : { ...words },
    secs: m.mode === "team" ? 0 : m.secs || 180, begun, n, over: !!done && m.mode !== "team", rival: null });
  watchTable();
  if (S.kind === "race" && raceLeft() <= 0 && !S.over) { S.over = true; tell(true); }
}
/** What this player's run tells the table: points (a race's score) and every word with when it was found. */
function tell(done = false) {
  if (!S || (S.kind !== "race" && S.kind !== "team") || !duel.playing) return;
  const p = boardP(), mine = S.found.filter(w => P.set.has(w) || P.mine.has(w)), pts = totalOf(p, mine);
  S.times ??= {};
  for (const w of mine) S.times[w] ??= Math.max(0, Math.round(duel.now() - S.begun));
  const words = Object.fromEntries(mine.map(w => [w, S.times[w]]));
  const last = Math.max(0, ...Object.values(words));
  if (S.kind === "race") duel.report({ score: pts, text: `${pts} points`, words, ...(done ? { done: true, ms: last } : {}) });
  else duel.report({ score: mine.length, text: plural(mine.length, "word"), words });
}
/** Watches the table for the others' words (a team's yield) and points (a race's gauge). */
function watchTable() {
  stopWatch();
  const room = duel.together.room;
  if (!room) return;
  tableWatch = room.sync.watch(branchPath(room.code, "yield"), onTable, e => console.error(e));
}
function stopWatch() { tableWatch?.(); tableWatch = null; }
function onTable(g) {
  if (!g || !S || g.n !== S.n) return;
  const runs = g.runs || {}, seats = Object.values(g.players || {}).filter(x => x && x.slot != null);
  if (S.kind === "race") {
    const me = duel.together.slot;
    raceTable = seats.filter(x => x.slot !== me && runs[`s${x.slot}`]?.begun).map(x => ({ slot: x.slot, name: x.name, points: Number(runs[`s${x.slot}`]?.score) || 0 }));
    drawGauge();
    return;
  }
  const people = Math.max(2, Number(g.people) || 2), was = team;
  team = { found: teamFound(g), people, over: g.over === g.n };
  if (!was || was.people !== people) { derive(); drawnFor = null; }
  render();
  if (team.over && teamReported !== `${g.created}-${g.n}`) {
    teamReported = `${g.created}-${g.n}`;
    const pts = pointsNow(), pct = Math.round((100 * pts) / Math.max(1, P.total));
    reportDuo("yield", `${g.created}-${g.n}`, { score: pct, won: rankOf(pts, P.total) >= 8, coop: true }).catch(e => console.error(e));
    openDone();
  }
}
/** The team calls it a day, or has found every word: the match ends for everyone at the table. */
async function endTeam() {
  if (S?.kind !== "team") return;
  const n = S.n;
  await duel.together.act(g => (g.n === n && g.over !== n ? ((g.over = n), true) : false));
}
/** The result sheet's own lines in a race: your words, those nobody else found starred, and the best you missed. */
function raceExtra() {
  if (S?.kind !== "race" || !P) return null;
  const alone = onlyMine(duel.together.room?.data, duel.together.slot);
  const box = el("div"), mine = [...S.found].filter(w => P.set.has(w)).sort();
  const ul = el("ul", "yd-words");
  for (const w of mine) ul.append(el("li", isFull(boardP(), w) ? "full" : "", `${up(w)}${alone.has(w) ? " ★" : ""}`));
  box.append(el("p", "yd-note", "★ nobody else found it."), ul);
  const missed = P.words.filter(w => !S.found.includes(w)).sort((a, b) => pointsOf(boardP(), b) - pointsOf(boardP(), a)).slice(0, 12);
  if (missed.length) box.append(el("h4", "yd-h", "The best you missed"), el("p", "yd-note", missed.map(up).join(", ")));
  return box;
}
function teamKey() {
  const p = el("p", "yd-note");
  for (const o of people()) {
    const dot = el("i", "who"); dot.style.cssText = `display:inline-block;width:.55rem;height:.55rem;border-radius:50%;margin:0 .3rem 0 .6rem;background:var(--p${o.slot % 6})`;
    p.append(dot, `${o.me ? "you" : first(o.name)} (${up(centreFor(S.p, o.slot))})`);
  }
  return p;
}

// ---------- the menu ----------
// Play: a new puzzle, the words shown. Content: which puzzle (the header's choice: today's or a level) and the board.
// Settings: a sprint's clock (for the next puzzle: a clock on a puzzle already under way would be no sprint) and a
// rival (on the puzzle in front of you, as far as it would have got by now). Together: what a match you deal will be.
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (duel.on) {
    const t = part(body, "together");
    duel.menu(t);
    if (S?.kind === "team" && !isOver()) t.append(action("Call it a day", () => { if (confirm("End this puzzle for the whole team?")) endTeam(); }, "link"));
    t.append(choice("Next match", [["team", "Team"], ["race", "Race"]], togetherMode(), v => { prefs.together = v; keepPrefs(); openMenu(); }));
    if (togetherMode() === "race") t.append(choice("Race clock", [[180, "3 min"], [300, "5 min"]], prefs.raceSecs, v => { prefs.raceSecs = v; keepPrefs(); }));
    part(body, "content").append(mirror("Level", $("pick")), choice("Board", Object.entries(BOARDS), prefs.board, v => { prefs.board = v; keepPrefs(); }));
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const play = part(body, "play");
  play.append(action(prefs.secs ? `New ${prefs.secs / 60}-minute sprint` : "New puzzle", () => confirmNew(), "primary"));
  if (S && !S.over && (S.kind === "day" || S.kind === "run")) play.append(action("Show the words", () => { if (confirm("Show every word? This puzzle ends here.")) finish("shown"); }, "link"));
  part(body, "content").append(mirror("Puzzle", $("pick")),
    choice("Board", Object.entries(BOARDS), prefs.board, v => { prefs.board = v; keepPrefs(); $("menuDlg").close(); confirmNew(); }));
  part(body, "settings").append(choice("Clock", CLOCKS, prefs.secs, v => { prefs.secs = v; keepPrefs(); openMenu(); }),
    choice("Rival", [["off", "Off"], ...Object.entries(RIVALS).map(([k, r]) => [k, r.label])], prefs.rival, v => {
      prefs.rival = v; keepPrefs();
      if (S && (S.kind === "day" || S.kind === "run") && !S.over) { S.rival = v === "off" ? null : v; derive(); save(); render(); }
    }));
  part(body, "together").append(choice("A match you deal", [["team", "Team"], ["race", "Race"]], togetherMode(), v => { prefs.together = v; keepPrefs(); }));
  const st = read(STATS, {}) || {}, sprints = Object.entries(st.sprints || {}), last = read(LAST, null);
  if (last?.p) part(body, "about").append(action(dayName(last.p.day), openLast, "link"));
  part(body, "about").append(line(`${plural(st.puzzles || 0, "random puzzle")}; Master refiner ${st.master || 0} times, Full yield ${st.full || 0}${sprints.length ? `. Sprint bests: ${sprints.map(([k, v]) => { const [secs, board, level] = k.split(":"); return `${Number(secs) / 60} min ${BOARDS[board]?.toLowerCase() || ""} ${LEVELS[level]?.toLowerCase() || ""} ${v}`; }).join(", ")}` : ""}.`),
    line("Words: SCOWL, with wordfreq's frequencies (CC BY-SA 4.0)."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
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
$("sheetClose").addEventListener("click", closeSheet);
$("sheetDlg").addEventListener("click", e => {
  if (e.target === $("sheetDlg")) { closeSheet(); return; }
  const li = e.target.closest?.(".yd-words li[data-w]");
  if (li) gloss(li);
});
$("gauge").addEventListener("click", openRanks);
// duel.js's line opens its standings, which rank teammates against each other: at a team's table it opens the words
$("duelLine").addEventListener("click", e => { if (S?.kind === "team") { e.stopImmediatePropagation(); openWords(); } }, true);
$("foundBtn").addEventListener("click", () => { if (!sidewaysNow()) openWords(); });
$("chartBtn").addEventListener("click", openChart);
$("enterBtn").addEventListener("click", enter);
$("mixBtn").addEventListener("click", shuffle);
// Delete: a tap takes a letter off, a hold clears the word
{
  let hold = 0, held = false;
  const btn = $("delBtn");
  btn.addEventListener("pointerdown", () => { held = false; clearTimeout(hold); hold = setTimeout(() => { held = true; clearWord(); }, 450); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) btn.addEventListener(ev, () => clearTimeout(hold));
  btn.addEventListener("click", () => { if (!held) del(); held = false; });
}
// a tap on the board: the letter goes in as the finger lands, so quick tapping keeps up
$("board").addEventListener("pointerdown", e => {
  const g = e.target.closest?.(".yd-cell");
  if (!g || e.button > 0) return;
  e.preventDefault();
  const i = Number(g.dataset.i), c = cells[i];
  if (!c) return;
  g.classList.add("down");
  setTimeout(() => g.classList.remove("down"), 110);
  add(c.letter, S?.p.board === "wheel" ? i : null);
});
$("board").addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
  if (/^[a-zA-Z]$/.test(e.key)) { add(e.key); e.preventDefault(); }
  else if (e.key === "Backspace") { del(); e.preventDefault(); }
  else if (e.key === "Enter") { enter(); e.preventDefault(); }
  else if (e.key === " ") { shuffle(); e.preventDefault(); }
  else if (e.key === "Escape") clearWord();
});
$("pick").addEventListener("change", () => {
  const v = $("pick").value;
  if (duel.on) {                                  // at a table: a new match at that level (today's isn't a match)
    const was = prefs.level;
    if (v !== "today") { prefs.level = v; keepPrefs(); }
    if (v === "today" || !duel.newMatch()) { prefs.level = was; keepPrefs(); $("pick").value = S?.p.level || was; }
    return;
  }
  if (v === "today") { showToday(); return; }
  prefs.level = v;
  keepPrefs();
  const kept = S?.kind === "run" ? S : read(RUN, null);
  if (validRun(kept) && kept.p.level === v && !kept.over) { show(kept); return; }
  if (!confirmNew(v)) $("pick").value = S?.kind === "day" ? "today" : S?.p.level || prefs.level;
});
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); duel.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
addEventListener("resize", () => { drawFound(); });
setInterval(tick, 250);
// the dictionary comes once the page is drawn, so the first rare word typed is answered at once
setTimeout(() => { if (!IN_FRAME) loadDict(); }, 2500);

// for tests and debugging
window.__yield = { get state() { return S; }, get derived() { return P; }, get team() { return team; }, add, del, enter, shuffle, finish, showToday, newRandom, duel, openChart, openWords };

/** Your own puzzle: the one that was on the screen (today's, or the random one), or today's when the games screen's
 *  tile sent you for it. Today's and the random one are kept apart, so going to today's loses nothing. */
function solo(forToday = false) {
  if (IN_FRAME) { const kept = read(read(ON, "day") === "run" ? RUN : DAY, null); if (validRun(kept)) show(kept); else render(); return; }
  if (forToday || read(ON, "day") === "day") showToday(); else showRandom();
}
const sentForToday = arrivedForToday();
// a match in the address: its letters, with no solo puzzle dealt under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(sentForToday); });
else solo(sentForToday);
