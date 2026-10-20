// Ladder: Lewis Carroll's Doublets. From the first word to the last, one letter changed at a time, every rung a word;
// par is the fewest steps it can be done in, and the score is the time with a minute for every step over par. Worked
// from either end, as on paper. The rules, the ladders and the computer players are ladder-engine.js's; the pairs with
// a link between them, Carroll's own among them, ladder-pairs.js's; this file keeps the run, the clock and the taps.
// Together, a team's ladder or a race (ladder-room.js).
import { RULES, LENGTHS, LEVELS, OVER, HINT, RIVALS, analyse, generate, levelOf, newRun, place, undoLast, working,
  words, steps, hintFor, score, rivalPlan, rivalAt } from "./ladder-engine.js";
import { BOOK, THEMES, linkedFor } from "./ladder-pairs.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, ticks, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, dailyDue, IN_FRAME } from "./suite.js";   // a partner watching's frame runs no clock and writes nothing
import { busy } from "./loading.js";
import { createLadderRoom } from "./ladder-room.js";

dropdown(document.getElementById("level"));

const $ = id => document.getElementById(id);
const RUN = "ladder:run", PREFS = "ladder:prefs", BESTS = "ladder:bests", BOOKED = "ladder:book", SEEN = "ladder:seen", PARS = "ladder:pars";
const DAILY = { level: "medium", lengths: [4, 5], rules: "classic" };   // today's is the same for everyone, so these are fixed
const KINDS = { daily: "Today's", random: "Random", linked: "Linked", book: "The book" };
const SAVE_EVERY = 5000;                                              // ms between saves of a ladder in play (a watcher sees it that often)

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const fmt = secs => { const s = Math.max(0, Math.round(secs)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const CAPS = w => String(w).toUpperCase();
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// ---------- what you've chosen ----------
const prefs = { level: "easy", lengths: [4, 5], themes: Object.keys(THEMES), rules: "classic", rival: "off", kind: "random", ...read(PREFS, {}) };
if (!LEVELS[prefs.level]) prefs.level = "easy";
if (!RULES[prefs.rules]) prefs.rules = "classic";
if (!RIVALS[prefs.rival]) prefs.rival = "off";
if (!KINDS[prefs.kind] || prefs.kind === "daily") prefs.kind = "random";
prefs.lengths = (prefs.lengths || []).filter(n => LENGTHS.includes(n));
if (!prefs.lengths.length) prefs.lengths = [4, 5];
const keepPrefs = () => write(PREFS, prefs);

// ---------- the ladder on screen ----------
// G: { kind, P (the ladder: its ends, par, routes, and a pair's line), run (the engine's), rival ({ level, plan }) or
// null, side (the end you're working at), fresh (a new best), mode: "solo", "race" or "team" }
let G = null;
let cursor = null;          // { pos, gap }: the letter of the working rung you tapped (gap: the place before it, to add one)
let typed = "";             // a whole word typed instead, waiting for Enter
let wrong = null;           // { word, until }: the word just refused, shown in the next rung a moment
let clockFrom = null, savedAt = 0, paused = false;
let message = null;         // { text, tone } until the next tap, else how to play

const room = createLadderRoom({
  onState: () => { if (G) render(); }, toast, askName, prefs, keepPrefs,
  solo: () => { G = loadSolo(); if (!G) deal(prefs.kind); else { history.replaceState(null, "", hashFor(G)); clockRun(); render(); } },
  // the table's ladder on the page (null: the lobby, where nobody sees a ladder yet)
  begin: g => {
    const same = G && g && G.mode === g.mode && G.n === g.n && G.P.start === g.P.start && G.raceI === g.raceI;
    G = g;
    if (!same) { cursor = null; typed = ""; message = null; wrong = null; }
    else if (cursor && !room.mayChange(G, cursor.pos)) cursor = null;
    if (G) render(true); else drawWaiting();
  },
});

// ---------- the clock ----------
// A solo ladder counts the time it's on screen (run.ms); a race's runs from the table's start; a team's too.
function clockRun() {
  if (IN_FRAME || !G || G.mode !== "solo" || G.run.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  G.run.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); }, () => { paused = false; clockRun(); });
const elapsed = () => (!G ? 0 : G.mode !== "solo" ? room.elapsed(G) : G.run.ms + (clockFrom != null ? performance.now() - clockFrom : 0));

// ---------- keeping ----------
function save() {
  if (IN_FRAME || !G) return;
  if (G.mode === "solo") write(RUN, G); else room.keep(G);
  savedAt = performance.now();
}
const validRun = g => !!g && !!g.P?.start && !!g.P.end && Number.isInteger(g.P.par) && Array.isArray(g.run?.top) && Array.isArray(g.run.bottom) && Number.isFinite(g.run.ms) && !!KINDS[g.kind];
function loadSolo() {
  const g = read(RUN, null);
  if (!validRun(g) || g.mode !== "solo") return null;
  g.side = g.side === "bottom" ? "bottom" : "top";
  return g;
}
const started = () => !!G && G.mode === "solo" && !G.run.done && (G.run.top.length > 1 || G.run.bottom.length > 1);
const bestKey = g => `${g.kind}:${g.P.level || levelOf(g.P)}:${g.P.rules}`;

// ---------- dealing ----------
/** Lets the page draw the rete before a long piece of work (a graph to build, a hard ladder to find). */
const paint = () => new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)));
/** A pair played as a ladder: its analysis, with the line and where it's from. */
function pairLadder(p, rules, extra = {}) {
  const P = analyse(p.a, p.b, rules);
  return P ? { ...P, level: levelOf(P), say: p.say, by: p.by || null, theme: p.theme || null, ...extra } : null;
}
const linkedLevels = new Map();
/** The linked pairs at a level, by these rules and themes (their level found once a session: each is a search). */
function linkedAt(level, rules, themes) {
  return linkedFor(rules, themes).filter(p => {
    const key = `${p.a}-${p.b}-${rules}`;
    if (!linkedLevels.has(key)) { const P = analyse(p.a, p.b, rules); linkedLevels.set(key, P ? levelOf(P) : null); }
    return linkedLevels.get(key) === level;
  });
}
/** The next linked pair: one not played yet at this level, until they've all been. */
function nextLinked(level, rules, themes) {
  let pool = linkedAt(level, rules, themes);
  if (!pool.length) pool = linkedFor(rules, themes);
  const seen = new Set(read(SEEN, [])), key = p => `${p.a}-${p.b}`;
  let fresh = pool.filter(p => !seen.has(key(p)));
  if (!fresh.length) { for (const p of pool) seen.delete(key(p)); fresh = pool; }
  const p = fresh[Math.floor(Math.random() * fresh.length)];
  seen.add(key(p));
  write(SEEN, [...seen]);
  return p;
}
const bookDone = () => read(BOOKED, {});
/** The book's chapter to play: the first not climbed. */
const bookAt = () => { const d = bookDone(); const i = BOOK.findIndex((_, k) => !d[k]); return i < 0 ? 0 : i; };

/** A new ladder of a kind (today's, random, linked, a chapter of the book), to play solo. */
async function deal(kind = prefs.kind, { chapter = null, seed = null, level = prefs.level } = {}) {
  const slow = prefs.rules === "grow" && kind !== "daily" && kind !== "book";
  const done = busy(slow ? "Setting out the words" : "Making a ladder", { delay: slow ? 0 : 150 });
  await paint();
  try {
    let P;
    if (kind === "daily") P = { ...generate(today(), DAILY), day: today() };
    else if (kind === "book") { const i = chapter ?? bookAt(); P = pairLadder(BOOK[i], "classic", { chapter: i }); }
    else if (kind === "linked") P = pairLadder(nextLinked(level, prefs.rules, prefs.themes), prefs.rules);
    else P = generate(seed ?? randomSeed(), { level, lengths: prefs.lengths, rules: prefs.rules });
    begin({ kind, P });
  } finally { done(); }
}
/** Puts a ladder on the table, solo: a fresh run, the computer player's climb if you race one. */
function begin({ kind, P }, run = newRun(P), extra = {}) {
  clockPause();
  G = { kind, P, run, mode: "solo", side: "top", rival: null, ...extra };
  if (prefs.rival !== "off" && !extra.rival && kind !== "book") G.rival = { level: prefs.rival, plan: rivalPlan(P, prefs.rival, randomSeed()) };
  cursor = null; typed = ""; message = null; wrong = null;
  $("level").value = P.level || levelOf(P);
  history.replaceState(null, "", hashFor(G));
  save();
  clockRun();
  render(true);
}
const confirmLeave = () => !started() || confirm("Start a new ladder? This one isn't finished.");

// ---------- links: #s=SEED&l=LEVEL&n=45&r=RULES (random), #d=DAY (today's), #p=A-B&r=RULES (a pair) ----------
function hashFor(g) {
  if (!g || g.mode !== "solo") return `${location.pathname}${location.search}`;
  const P = g.P, base = `${location.pathname}${location.search}`;
  if (g.kind === "daily") return `${base}#d=${P.day}`;
  if (g.kind === "random") return `${base}#s=${P.seed}&l=${P.level}&n=${prefs.lengths.join("")}&r=${P.rules}`;
  return `${base}#p=${P.start}-${P.end}&r=${P.rules}${P.chapter != null ? `&c=${P.chapter}` : ""}`;
}
function fromHash() {
  const h = new URLSearchParams(location.hash.slice(1)), rules = RULES[h.get("r")] ? h.get("r") : "classic";
  if (h.get("d")) { const day = Number(h.get("d")); return day ? { kind: "daily", P: { ...generate(day, DAILY), day } } : null; }
  if (h.get("s")) {
    const lengths = [...String(h.get("n") || "45")].map(Number).filter(n => LENGTHS.includes(n));
    const level = LEVELS[h.get("l")] ? h.get("l") : "easy";
    return { kind: "random", P: generate(Number(h.get("s")), { level, lengths: lengths.length ? lengths : [4, 5], rules }) };
  }
  if (h.get("p")) {
    const [a, b] = h.get("p").split("-"), c = h.has("c") ? Number(h.get("c")) : null, from = BOOK[c];
    const say = from && from.a === a && from.b === b ? from : linkedFor(rules).find(p => p.a === a && p.b === b) || { a, b, say: `From ${CAPS(a)} to ${CAPS(b)}` };
    const P = pairLadder(say, rules, from && from.a === a ? { chapter: c } : {});
    return P ? { kind: from && from.a === a ? "book" : "linked", P } : null;
  }
  return null;
}
const sameLadder = (g, x) => !!g && !!x && g.kind === x.kind && g.P.start === x.P.start && g.P.end === x.P.end && g.P.rules === x.P.rules;

// ---------- playing ----------
const playable = () => !!G && !G.run.done && !IN_FRAME && !paused && room.mayPlay(G);
const work = () => working(G.run, G.side);
const grow = () => G?.P.rules === "grow";
function note(text, tone = "") { message = text ? { text, tone } : null; drawLine(); }
/** Tapping a letter of the working rung: change it (tap again to let it go); growing, a gap to add a letter there. */
function tapLetter(pos, gap = false) {
  if (!playable()) return;
  typed = "";
  if (!gap && !room.mayChange(G, pos)) { note(room.whyNot(G, pos), "bad"); return; }
  cursor = cursor && cursor.pos === pos && cursor.gap === gap ? null : { pos, gap };
  message = null;
  render();
}
/** A rung of either end: work from that end. */
function tapRung(side) {
  if (!playable() || side === G.side || room.oneEnd(G)) return;
  G.side = side; cursor = null; typed = ""; message = null;
  save();
  render();
}
function key(ch) {
  if (!playable()) return;
  const w = work();
  if (cursor && !cursor.gap) { try_(w.slice(0, cursor.pos) + ch + w.slice(cursor.pos + 1)); return; }
  if (cursor && cursor.gap) { try_(w.slice(0, cursor.pos) + ch + w.slice(cursor.pos)); return; }
  if (typed.length < (grow() ? LENGTHS.at(-1) : w.length)) { typed += ch; message = null; render(); }
}
function back() {
  if (!playable()) return;
  if (typed) { typed = typed.slice(0, -1); render(); return; }
  if (cursor && !cursor.gap && grow()) { const w = work(); try_(w.slice(0, cursor.pos) + w.slice(cursor.pos + 1)); return; }
  if (cursor) { cursor = null; render(); }
}
function enter() {
  if (!playable() || !typed) return;
  try_(typed);
}
/** Tries a word as the next rung at the working end: placed, the ladder whole, or refused with the reason. */
function try_(word) {
  if (G.mode === "team") { room.teamMove(G, word, outcome); return; }
  outcome(place(G.P, G.run, G.side, word), word);
}
// every message fits one line on a phone, so the keys never move
const WHY = {
  same: () => "That's the word you're on: change a letter.",
  step: w => (grow() ? `${CAPS(w)} is more than one step away.` : `${CAPS(w)} changes more than one letter.`),
  word: w => `${CAPS(w)} isn't a word here.`,
  used: w => `${CAPS(w)} is on your ladder already.`,
  moved: () => "Someone made a rung first: here's the ladder now.",
  theirs: () => "That letter isn't yours to change.",
};
function outcome(r, word) {
  if (r === "placed" || r === "done") {
    cursor = null; typed = ""; message = null; wrong = null;
    if (r === "done") finish(); else { save(); room.report(G); }
    render(true);
    return;
  }
  wrong = { word, until: performance.now() + 900 };
  typed = "";
  if (r !== "same" && cursor?.gap) cursor = null;                   // an added letter that made no word: the gap lets go
  note((WHY[r] || WHY.word)(word), "bad");
  navigator.vibrate?.(14);
  render();
  setTimeout(() => { if (wrong && performance.now() >= wrong.until) { wrong = null; render(); } }, 950);
}
function useUndo() {
  if (!playable()) return;
  if (G.mode === "team") { room.teamUndo(G); return; }
  const side = undoLast(G.run);
  if (!side) { note("Nothing to take off yet."); return; }
  G.side = side; cursor = null; typed = ""; message = null;
  save(); room.report(G);
  render();
}
function useHint() {
  if (!playable()) return;
  if (G.mode === "team") { room.teamHint(G); return; }
  const h = hintFor(G.P, G.run, G.side);
  if (!h) { note("No way on from here: Undo first.", "bad"); return; }
  G.run.hints++;
  const r = place(G.P, G.run, G.side, h.word, { hint: true });
  cursor = null; typed = "";
  if (r === "done") { finish(); render(true); return; }
  note(`Hint: ${CAPS(h.word)}, then ${plural(h.left, "step")} to the ${G.side === "bottom" ? "first" : "last"} word.`, "good");
  save(); room.report(G);
  render(true);
}
function flip() {
  if (!playable() || room.oneEnd(G)) return;
  G.side = G.side === "top" ? "bottom" : "top";
  cursor = null; typed = ""; message = null;
  save();
  render();
}

// ---------- the end of a ladder ----------
function finish() {
  const r = G.run;
  if (G.mode !== "solo") { r.ms = elapsed(); room.finish(G); save(); return; }
  if (clockFrom != null) { r.ms += performance.now() - clockFrom; clockFrom = null; }
  const sc = score(G.P, r), over = steps(r) - G.P.par;
  const bests = read(BESTS, {}), k = bestKey(G);
  G.fresh = bests[k] == null || sc < bests[k];
  if (G.fresh) { bests[k] = sc; write(BESTS, bests); }
  if (G.kind === "daily") noteDayTime("ladder", sc, G.P.day);     // the day's first finish counts, the moment it's final
  if (G.kind === "book") { const d = bookDone(); if (!d[G.P.chapter] || sc < d[G.P.chapter].score) { d[G.P.chapter] = { steps: steps(r), par: G.P.par, score: sc }; write(BOOKED, d); } }
  const pars = read(PARS, { now: 0, best: 0 });
  pars.now = over === 0 && !r.hints ? pars.now + 1 : 0;
  pars.best = Math.max(pars.best, pars.now);
  write(PARS, pars);
  save();
}

// ---------- drawing ----------
/** The ladder's rows, top to bottom: the words of each end, and between them the next rung and those still to go at par. */
function rows() {
  const { run, P } = G, made = run.top.length + run.bottom.length - 2, toGo = P.par - made;
  const out = run.top.map((w, i) => ({ w, side: "top", i, end: i === 0, prev: run.top[i - 1] }));
  if (!run.done) {
    const between = Math.max(1, toGo - 1);
    const gaps = Array.from({ length: between - 1 }, () => ({ gap: true }));
    if (G.side === "top") out.push({ next: true }, ...gaps); else out.push(...gaps, { next: true });
  }
  run.bottom.forEach((w, i) => out.push({ w, side: "bottom", i, end: i === run.bottom.length - 1, prev: run.bottom[i + 1] }));
  return out;
}
const tile = (ch, cls = "") => { const t = el("span", `ld-t${cls ? ` ${cls}` : ""}`, ch); t.setAttribute("aria-hidden", "true"); return t; };
function wordRow(r) {
  const li = el("li", "ld-rung"), live = !G.run.done && r.side === G.side && (r.side === "top" ? r.i === G.run.top.length - 1 : r.i === 0);
  li.setAttribute("aria-label", CAPS(r.w));
  if (r.end) { li.classList.add("end", r.side === "top" ? "first" : "last"); li.dataset.tag = r.side === "top" ? "first" : "last"; }
  if (G.run.hinted.includes(r.w) && !r.end) li.classList.add("hinted");
  const by = room.byOf?.(G, r) ?? null;
  const hidden = r.end && r.side === "bottom" ? room.sealed?.(G) : null;
  [...r.w].forEach((ch, p) => {
    const changed = r.prev && r.prev.length === r.w.length && r.prev[p] !== ch;
    if (live) {
      const b = el("button", "ld-t", ch);
      b.type = "button";
      b.setAttribute("aria-label", `Change ${CAPS(ch)}`);
      if (changed) b.classList.add(by != null ? "by" : "ch");
      if (cursor && !cursor.gap && cursor.pos === p) b.classList.add("cur");
      const own = room.owner?.(G, p);
      if (own) { b.classList.add(own.cls); b.style.setProperty("--who", own.who); }
      b.addEventListener("click", () => tapLetter(p));
      li.append(b);
    } else {
      const t = tile(hidden?.[p] ? "" : ch, `${changed ? (by != null ? "by" : "ch") : ""}${hidden?.[p] ? " sealed" : ""}`.trim());
      li.append(t);
    }
  });
  if (by != null) li.style.setProperty("--who", `var(--p${by % 6})`);
  if (live && grow()) {                                   // the gaps, to add a letter there
    const t = `var(--t)`, g = `var(--gap)`, n = r.w.length;
    for (let p = 0; p <= n; p++) {
      const s = el("button", `ld-slot${cursor?.gap && cursor.pos === p ? " cur" : ""}`);
      s.type = "button";
      s.setAttribute("aria-label", p === 0 ? "Add a letter at the start" : p === n ? "Add a letter at the end" : `Add a letter after ${CAPS(r.w[p - 1])}`);
      s.style.left = `calc(50% - (${n} * ${t} + ${n - 1} * ${g}) / 2 + ${p} * (${t} + ${g}) - ${g} / 2)`;
      s.addEventListener("click", () => tapLetter(p, true));
      li.append(s);
    }
  }
  if (!live && !G.run.done && !r.end || (!live && r.end && !G.run.done)) li.addEventListener("click", () => tapRung(r.side));
  if (live) li.classList.add("work");
  return li;
}
function nextRow(r) {
  const li = el("li", "ld-rung next"), w = work(), n = grow() ? Math.max(w.length, typed.length, wrong?.word.length || 0) : w.length;
  li.setAttribute("aria-label", "The next rung");
  let shown;
  if (wrong && performance.now() < wrong.until) { shown = wrong.word; li.classList.add("bad"); }
  else if (typed) shown = typed;
  else if (cursor && !cursor.gap) shown = `${w.slice(0, cursor.pos)}?${w.slice(cursor.pos + 1)}`;
  else if (cursor && cursor.gap) shown = `${w.slice(0, cursor.pos)}?${w.slice(cursor.pos)}`;
  else shown = w;
  const len = Math.max(n, shown.length);
  for (let p = 0; p < len; p++) {
    const ch = shown[p] ?? "", q = ch === "?";
    const cls = typed ? (p < typed.length ? "typed" : "") : q ? "cur" : wrong ? "typed" : "";
    li.append(tile(q ? "" : ch, cls));
  }
  void r;
  return li;
}
function gapRow() {
  const li = el("li", "ld-rung gap");
  li.setAttribute("aria-hidden", "true");
  return li;
}
let drawnKey = "";
function drawLadder(scroll = false) {
  const ol = $("ladder"), rs = rows();
  ol.style.setProperty("--n", String(grow() ? LENGTHS.at(-1) : G.P.start.length));
  ol.style.setProperty("--rows", String(G.P.par + 1));
  ol.classList.toggle("won", !!G.run.done);
  const nodes = rs.map(r => (r.next ? nextRow(r) : r.gap ? gapRow(r) : wordRow(r)));
  // the rung just made slides in; nothing else moves
  const key = words(G.run).join(",");
  if (scroll && key !== drawnKey && drawnKey) {
    const idx = G.side === "top" ? G.run.top.length - 1 : G.run.top.length + (G.run.done ? 0 : rs.filter(r => r.next || r.gap).length);
    nodes[Math.min(idx, nodes.length - 1)]?.classList.add("new");
  }
  drawnKey = key;
  ol.replaceChildren(...nodes);
  const focus = ol.querySelector(".ld-rung.next") || ol.querySelector(".ld-rung.work");
  if (focus) focus.scrollIntoView({ block: "nearest" });
}
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!G) return;
  const r = G.run, pen = OVER * Math.max(0, r.done ? steps(r) - G.P.par : 0) + HINT * r.hints;
  put("par", String(G.P.par));
  put("steps", String(r.done ? steps(r) : r.top.length + r.bottom.length - 2));
  put("clock", fmt(elapsed() / 1000));
  put("penalty", pen ? `+${pen} s` : "");
  drawRival();
}
function drawRival() {
  const box = $("rival");
  if (G.mode !== "solo") { room.drawLine(box, G); return; }
  if (!G.rival) { box.hidden = true; return; }
  box.hidden = false;
  const { plan, level } = G.rival, at = rivalAt(plan, elapsed()), all = plan.route.length - 1, name = RIVALS[level].label;
  const text = at >= all ? `${name}: done in ${all}${all === G.P.par ? ", par" : `, ${all - G.P.par} over`}, ${fmt(plan.at.at(-1) / 1000)}` : `${name}: ${plural(at, "rung")}`;
  if (box.dataset.t !== text) { box.dataset.t = text; box.replaceChildren(Object.assign(el("span", "ld-who"), { textContent: text })); }
}
function drawSay() {
  const P = G.P, say = $("say");
  const text = P.say || `From ${CAPS(P.start)} to ${CAPS(P.end)}`;
  const from = G.kind === "book" ? `${P.by}, ${P.chapter + 1} of ${BOOK.length}` : G.kind === "daily" ? "Today's" : G.mode !== "solo" ? room.label(G) : P.theme ? THEMES[P.theme] : "";
  say.replaceChildren(text, ...(from ? [el("small", "", from)] : []));
}
function drawLine() {
  const l = $("line");
  let text;
  if (!G) text = "";
  else if (message) text = message.text;
  else if (G.run.done) text = "";
  else if (G.mode !== "solo" && room.waiting(G)) text = room.waiting(G);
  else if (typed) text = "Typing a word: Enter puts it on the ladder.";
  else if (cursor?.gap) text = "A letter to add here, from the keys.";
  else if (cursor) text = `${CAPS(work()[cursor.pos])} to what? A key changes it${grow() ? "; ⌫ drops it" : ""}.`;
  else if (G.mode === "team") text = `Tap one of your letters of ${CAPS(work())}, then its new letter.`;
  else text = `Tap a letter of ${CAPS(work())}${grow() ? " or a gap" : ""}, then its new letter.`;
  if (l.textContent !== text) l.textContent = text;
  l.className = `ld-line${message?.tone ? ` ${message.tone}` : ""}`;
}
function drawTools() {
  const live = playable();
  $("undoBtn").disabled = !live || (G.run.top.length < 2 && G.run.bottom.length < 2);
  $("hintBtn").disabled = !live;
  const one = room.oneEnd(G);
  $("flipBtn").disabled = !live || one;
  $("flipBtn").querySelector("b").textContent = G.side === "top" ? "Work up" : "Work down";
  $("flipBtn").setAttribute("aria-label", G.side === "top" ? "Work up from the last word" : "Work down from the first word");
  $("hintBtn").querySelector("small").textContent = `+${HINT} s`;
  for (const b of $("kbd").querySelectorAll("button")) b.disabled = !live;
}
function drawResult() {
  const done = !!G.run.done;
  $("side").classList.toggle("over", done);
  $("result").inert = !done;
  $("play").inert = done;
  if (!done) return;
  if (G.mode !== "solo") { room.drawResult($("verdict"), $("nextBtn"), G); return; }
  const r = G.run, P = G.P, n = steps(r), over = n - P.par, sc = score(P, r);
  const head = over === 0 ? `Par: ${n} steps.` : `${n} steps, ${plural(over, "step")} over par.`;
  const bits = [`${fmt(r.ms / 1000)} on the clock`];
  if (over > 0) bits.push(`+${OVER * over} s for the steps over`);
  if (r.hints) bits.push(`${plural(r.hints, "hint")} (+${HINT * r.hints} s)`);
  const best = read(BESTS, {})[bestKey(G)];
  const v = $("verdict");
  v.className = `ld-verdict${over === 0 ? " good" : ""}`;
  const rival = G.rival ? rivalLine() : "";
  v.replaceChildren(`${head} Score ${fmt(sc)}.`, el("small", "", `${bits.join(", ")}.${G.fresh ? " A new best." : best != null ? ` Best ${fmt(best)}.` : ""}${rival ? ` ${rival}` : ""}`));
  $("more").textContent = routesLine();
  $("nextBtn").textContent = G.kind === "book" && G.P.chapter < BOOK.length - 1 ? "Next chapter" : G.kind === "daily" ? "A random ladder" : "Another ladder";
}
/** What the routes at par were, in a sentence: how many, and whether yours was the commonest. */
function routesLine() {
  const P = G.P, mine = words(G.run).join(" ") === P.route.join(" "), atPar = steps(G.run) === P.par, via = P.route.slice(1, -1).map(CAPS).join(", ");
  const many = P.routes >= 1e6 ? "a million or more" : P.routes.toLocaleString("en-GB");
  const told = P.routes === 1 ? (atPar ? "There's one route at par, only one, and you found it." : `There's one route at par, only one: through ${via}.`)
    : atPar ? `You found one of ${many} routes at par${mine ? ", the commonest" : ""}.` : `There are ${many} routes at par; the commonest goes through ${via}.`;
  const next = G.kind === "book" && P.chapter < BOOK.length - 1 ? ` Next in the book: ${BOOK[P.chapter + 1].say}.` : "";
  return `${told}${next}`;
}
function rivalLine() {
  const { plan, level } = G.rival, name = RIVALS[level].label, n = plan.route.length - 1;
  const theirs = Math.round(plan.at.at(-1) / 1000) + OVER * Math.max(0, n - G.P.par), mine = score(G.P, G.run);
  return mine < theirs ? `You beat ${name} (${fmt(theirs)}).` : mine === theirs ? `Level with ${name}.` : `${name} won, ${fmt(theirs)}.`;
}
function render(scroll = false) {
  if (!G) return;
  drawSay(); drawStrip(); drawLadder(scroll); drawLine(); drawTools(); drawResult();
}
/** At a table before its game starts: no ladder (a race's would be seen early), the keys asleep. */
function drawWaiting() {
  $("ladder").replaceChildren();
  $("say").replaceChildren("Ladder together");
  for (const id of ["par", "steps"]) put(id, "–");
  put("clock", "0:00"); put("penalty", "");
  $("rival").hidden = true;
  $("line").textContent = "Waiting for the table: say Ready.";
  $("line").className = "ld-line";
  $("side").classList.remove("over");
  for (const b of [...$("kbd").querySelectorAll("button"), $("undoBtn"), $("hintBtn"), $("flipBtn")]) b.disabled = true;
}

// ---------- the routes: your ladder, the ones at par, the computer's ----------
function openRoutes() {
  if (!G) return;
  const body = $("doneBody"), P = G.P, r = G.run;
  body.replaceChildren();
  const sec = (title, ...kids) => { const s = el("section"); s.append(el("h4", "", title), ...kids); body.append(s); };
  const route = ws => { const p = el("p", "ld-route"); ws.forEach((w, i) => { if (i) p.append(el("i", "", "›")); p.append(w); }); return p; };
  if (r.done) sec(G.mode === "team" ? "The team's ladder" : "Your ladder", route(words(r)), el("p", "ld-note", `${steps(r)} steps; par ${P.par}.`));
  const ways = P.routes === 1 ? "one route at par, and only one" : P.routes >= 1e6 ? "a million routes at par or more" : `${P.routes.toLocaleString("en-GB")} routes at par`;
  sec("At par", route(P.route), el("p", "ld-note", `There ${P.routes === 1 ? "is" : "are"} ${ways}${P.common < P.routes ? `, ${P.common.toLocaleString("en-GB")} of them in everyday words` : ""}. ${P.detours ? `Par needs ${plural(P.detours, "detour")}: a letter changed to one that's neither its first nor its last.` : "No detours: every letter goes straight to its last."}`));
  if (G.rival) sec(RIVALS[G.rival.level].label, route(G.rival.plan.route), el("p", "ld-note", `${G.rival.plan.route.length - 1} steps in ${fmt(G.rival.plan.at.at(-1) / 1000)}.`));
  if (P.by === "Kinbote, Pale Fire" && P.start === "live") sec("Kinbote's five", el("p", "ld-note", "It can't be done in five through any word of the widest list there is: six is par, through LEND as he says."));
  $("doneTitle").textContent = r.done ? "The routes" : "Par";
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- the keys ----------
function buildKeyboard() {
  const rows = [[..."QWERTYUIOP"], ["", ..."ASDFGHJKL", ""], ["ENTER", ..."ZXCVBNM", "BACK"]];
  const label = { BACK: "⌫", ENTER: "Enter" };
  $("kbd").replaceChildren(...rows.map(keys => {
    const r = el("div", "ld-krow");
    for (const k of keys) {
      if (!k) { r.append(el("span", "ld-half")); continue; }
      const b = el("button", k.length > 1 ? "wide" : "", label[k] || k);
      b.type = "button";
      if (k === "ENTER") b.classList.add("place");
      if (k === "BACK") b.setAttribute("aria-label", "Delete");
      b.addEventListener("click", () => (k === "ENTER" ? enter() : k === "BACK" ? back() : key(k.toLowerCase())));
      r.append(b);
    }
    return r;
  }));
}
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (!G) return;
  if (e.key === "Enter") enter();
  else if (e.key === "Backspace") back();
  else if (e.key === "Escape") { cursor = null; typed = ""; render(); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    if (!playable()) return;
    const n = work().length, at = cursor && !cursor.gap ? cursor.pos : e.key === "ArrowLeft" ? n : -1;
    cursor = { pos: Math.max(0, Math.min(n - 1, at + (e.key === "ArrowLeft" ? -1 : 1))), gap: false };
    render();
  } else if (e.key === "ArrowUp" || e.key === "ArrowDown") { if ((e.key === "ArrowUp") === (G.side === "bottom")) flip(); }
  else if (/^[a-z]$/i.test(e.key)) key(e.key.toLowerCase());
  else return;
  e.preventDefault();
});

// ---------- the menu ----------
let pick = null;            // what New ladder deals: daily, random, linked, book
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (room.on || room.joining) { room.menu(body); if (!$("menuDlg").open) $("menuDlg").showModal(); return; }
  pick ??= dailyDue("ladder") ? "daily" : G?.kind && G.kind !== "daily" ? G.kind : prefs.kind;
  const startLabel = pick === "book" ? "Play the chapter" : "New ladder";
  part(body, "play").append(action(startLabel, () => { if (confirmLeave()) { if (pick !== "daily") { prefs.kind = pick; keepPrefs(); } deal(pick); } }, "primary"));
  const content = part(body, "content");
  content.append(choice("Ladders", Object.entries(KINDS), pick, v => { pick = v; openMenu(); }));
  if (pick === "daily") content.append(line(`Today's ladder is Medium, four or five letters, Classic: the same for everyone.${dailyDue("ladder") ? "" : " You've climbed it."}`));
  if (pick === "random" || pick === "linked") content.append(mirror("Level", $("level")));
  if (pick === "random") content.append(ticks("Letters", LENGTHS.map(n => [n, String(n)]), prefs.lengths, xs => { prefs.lengths = xs.length ? xs : [4, 5]; keepPrefs(); }));
  if (pick === "linked") content.append(ticks("Themes", Object.entries(THEMES), prefs.themes, xs => { prefs.themes = xs.length ? xs : Object.keys(THEMES); keepPrefs(); }));
  if (pick === "book") content.append(bookList());
  const settings = part(body, "settings");
  if (pick !== "book" && pick !== "daily") settings.append(choice("Rules", Object.entries(RULES), prefs.rules, v => { prefs.rules = v; keepPrefs(); }));
  settings.append(choice("Race the computer", [["off", "Off"], ...Object.entries(RIVALS).map(([k, r]) => [k, r.label])], prefs.rival, v => { prefs.rival = v; keepPrefs(); }));
  const pars = read(PARS, { now: 0, best: 0 }), best = G ? read(BESTS, {})[bestKey(G)] : null;
  part(body, "about").append(
    line(`${G ? `${G.kind === "daily" ? "Today's" : LEVELS[G.P.level || levelOf(G.P)].label}: ${best != null ? `best ${fmt(best)}` : "not climbed yet"}. ` : ""}Clean pars in a row ${pars.now}, most ${pars.best}. A step over par adds ${OVER} s, a hint ${HINT} s.`),
    action("The routes", openRoutes, "link"),
    action("Copy a link to this ladder", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The book's chapters: climbed (with the steps), the one to play, the ones after it. */
function bookList() {
  const done = bookDone(), at = bookAt(), box = el("div");
  const ol = el("ol", "ld-book");
  BOOK.forEach((p, i) => {
    const li = el("li", i === at ? "cur" : !done[i] && i > at ? "locked" : "");
    const r = done[i];
    li.append(el("b", "", String(i + 1)), el("span", "", p.say), r ? el("em", "", r.steps === r.par ? "par" : `+${r.steps - r.par}`) : el("i"));
    if (r || i === at) {
      li.setAttribute("role", "button");
      li.tabIndex = 0;
      li.addEventListener("click", () => { $("menuDlg").close(); if (confirmLeave()) deal("book", { chapter: i }); });
    }
    ol.append(li);
  });
  box.append(el("span", "menu-label", `The book: ${Object.keys(done).length} of ${BOOK.length} climbed`), ol);
  requestAnimationFrame(() => ol.querySelector(".cur")?.scrollIntoView({ block: "nearest" }));
  return box;
}
async function copyLink() {
  const link = `${location.origin}${hashFor(G)}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- messages, names ----------
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
bindSwitcher($("appsBtn"), "ladder");
const logo = APPS.find(a => a.id === "ladder")?.logo;
if (logo) document.querySelector(".ld-mark").innerHTML = logo;
buildKeyboard();
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneDlg").addEventListener("click", e => { if (e.target === $("doneDlg")) $("doneDlg").close(); });
$("routesBtn").addEventListener("click", openRoutes);
$("undoBtn").addEventListener("click", useUndo);
$("hintBtn").addEventListener("click", useHint);
$("flipBtn").addEventListener("click", flip);
$("nextBtn").addEventListener("click", () => {
  if (G?.mode !== "solo") { room.again(G); return; }
  if (G.kind === "book" && G.P.chapter < BOOK.length - 1) deal("book", { chapter: G.P.chapter + 1 });
  else deal(G.kind === "daily" ? "random" : G.kind);
});
$("level").addEventListener("change", () => {
  const level = $("level").value;
  if (room.on) { room.setLevel(level); return; }
  prefs.level = level; keepPrefs();
  if (!G || (G.kind !== "daily" && G.kind !== "book" && level === (G.P.level || levelOf(G.P)))) return;
  if (confirmLeave()) deal(G.kind === "linked" ? "linked" : "random", { level });
  else $("level").value = G.P.level || levelOf(G.P);
});
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); room.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) room.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const x = fromHash(); if (!room.on && x && !sameLadder(G, x)) begin(x); });
setInterval(() => {
  if (!G) return;
  drawStrip();
  if (G.mode === "solo" && clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__ladder = { get game() { return G; }, get cursor() { return cursor; }, get prefs() { return prefs; }, deal, key, back, enter, tapLetter, tapRung, useUndo, useHint, flip, room };

const forToday = arrivedForToday();   // from the games screen's tile: today's ladder, still to play
function solo() {
  G = loadSolo();
  const linked = fromHash();
  if (linked && !sameLadder(G, linked)) { begin(linked); return; }
  if (forToday && !IN_FRAME && !(G?.kind === "daily" && G.P.day === today())) {
    if (!started() || confirm("Today's ladder is waiting. Leave the one you've started?")) { deal("daily"); return; }
  }
  if (G) { history.replaceState(null, "", hashFor(G)); clockRun(); render(); }
  else deal(dailyDue("ladder") && !IN_FRAME ? "daily" : prefs.kind);
}
// a table in the address: its ladder, with no solo one dealt under it
if (room.inAddress) room.join().then(ok => { if (!ok) solo(); });
else solo();
