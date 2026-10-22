// Lots (README, Lots): sixteen words, four lots of four, sorted by wordplay. The rules and the bank are lots-engine.js's,
// a board as you play it lots-run.js's, the computer player lots-bot.js's and the pair's table lots-room.js's; this file
// keeps the run, the clock and the taps, and draws. Three ways to play: alone (classic, or Only Connect's wall, against
// the computer if you like, today's board for everyone), the pair at one board (open, crossed or hidden), and a race on
// one board through duel.js, for a pair or a party.
import { SIZE, MISTAKES, WALL, LEVELS, LEVEL_NAMES, TOPICS, PRESETS, BY_ID, cleanMix, deal, daily, reason, fits, shuffle } from "./lots-engine.js";
import { RIVALS } from "./lots-bot.js";
import { newRun, isRun, pick, clearPicks, shuffleLeft, submit, tick, wallLeft, phaseOf, placedOf, toName, namingFor, nameLot, scoreOf, maxScore,
  dayScore, rainbow, rivalNow, versus } from "./lots-run.js";
import * as room from "./lots-room.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, topicMix, onPause, isPaused } from "./menu.js";
import { today, arrivedForToday, IN_FRAME, soloHref } from "./suite.js";
import { createTogether } from "./together.js";
import { createDuel } from "./duel.js";
import { busy, sextant } from "./loading.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { presetOf } from "./topics.js";

const $ = id => document.getElementById(id);
// the logo until the games screen knows Lots: four lot tags on one string, one in each enamel
const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="44" cy="94" rx="30" ry="3" fill="#1C2A34" opacity=".2"/><path d="M19.77 16.38L40.16 21.47M19.77 16.38L36.55 29.03M19.77 16.38L30.28 34.59M19.77 16.38L22.33 37.25" stroke="#1C2A34" stroke-width="1.6" stroke-linecap="round" fill="none"/><g transform="translate(19.77 16.38) rotate(14)"><path d="M10.51 0L21.02 -13.43H66.56Q70.07 -13.43 70.07 -9.93V9.93Q70.07 13.43 66.56 13.43H21.02Z" fill="#D49A22" stroke="#1C2A34" stroke-linejoin="round" style="stroke-width: calc(3 * var(--wire, 1))"/><path d="M31.53 -4.67H61.89M31.53 4.09H53.72" stroke="#F7F1E3" stroke-width="1.5" stroke-linecap="round" opacity=".75"/><circle cx="21.02" cy="0" r="4.2" fill="#F7F1E3" stroke="#A47528" stroke-width="2"/></g><g transform="translate(19.77 16.38) rotate(37)"><path d="M10.51 0L21.02 -13.43H66.56Q70.07 -13.43 70.07 -9.93V9.93Q70.07 13.43 66.56 13.43H21.02Z" fill="#3D7A66" stroke="#1C2A34" stroke-linejoin="round" style="stroke-width: calc(3 * var(--wire, 1))"/><path d="M31.53 -4.67H61.89M31.53 4.09H53.72" stroke="#F7F1E3" stroke-width="1.5" stroke-linecap="round" opacity=".75"/><circle cx="21.02" cy="0" r="4.2" fill="#F7F1E3" stroke="#A47528" stroke-width="2"/></g><g transform="translate(19.77 16.38) rotate(60)"><path d="M10.51 0L21.02 -13.43H66.56Q70.07 -13.43 70.07 -9.93V9.93Q70.07 13.43 66.56 13.43H21.02Z" fill="#2C5B8A" stroke="#1C2A34" stroke-linejoin="round" style="stroke-width: calc(3 * var(--wire, 1))"/><path d="M31.53 -4.67H61.89M31.53 4.09H53.72" stroke="#F7F1E3" stroke-width="1.5" stroke-linecap="round" opacity=".75"/><circle cx="21.02" cy="0" r="4.2" fill="#F7F1E3" stroke="#A47528" stroke-width="2"/></g><g transform="translate(19.77 16.38) rotate(83)"><path d="M10.51 0L21.02 -13.43H66.56Q70.07 -13.43 70.07 -9.93V9.93Q70.07 13.43 66.56 13.43H21.02Z" fill="#8F3328" stroke="#1C2A34" stroke-linejoin="round" style="stroke-width: calc(3 * var(--wire, 1))"/><path d="M31.53 -4.67H61.89M31.53 4.09H53.72" stroke="#F7F1E3" stroke-width="1.5" stroke-linecap="round" opacity=".75"/><circle cx="21.02" cy="0" r="4.2" fill="#F7F1E3" stroke="#A47528" stroke-width="2"/></g><circle cx="19.77" cy="16.38" r="4.4" fill="#A47528" stroke="#1C2A34" stroke-width="1.8"/></svg>`;
const RUN = "lots:run", PREFS = "lots:prefs", SEEN = "lots:seen", STATS = "lots:stats", DAILY = "lots:daily", BEST = "lots:best";
const ROOM_APP = 1, RACE_APP = 1;
const SQUARES = ["🟨", "🟩", "🟦", "🟥"];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inWords = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n);
const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };
const list2 = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const nameOfCat = id => BY_ID.get(id)?.name || "";

// ---------- what you've chosen ----------
const MODES = { classic: "Classic", wall: "The wall" };
function cleanPrefs(p) {
  p = p && typeof p === "object" ? p : {};
  return {
    level: LEVELS.includes(p.level) ? p.level : "medium",
    mode: MODES[p.mode] ? p.mode : "classic",
    mix: cleanMix(p.mix),
    rival: RIVALS[p.rival] ? p.rival : null,
    duo: room.MODES[p.duo] ? p.duo : "hidden",
  };
}
let prefs = cleanPrefs(read(PREFS, null));
const keepPrefs = () => write(PREFS, prefs);

// ---------- the page ----------
const el = { board: $("board"), what: $("what"), count: $("count"), rival: $("rival"), line: $("line"), controls: $("controls"), feed: $("feed"),
  shuffle: $("shuffleBtn"), clear: $("clearBtn"), submit: $("submitBtn"), level: $("level") };
let mode = "solo";             // "solo", "duo" (the pair at one board) or "race" (duel.js)
let S = null;                  // the run on the board, alone or in a race
let G = null;                  // the pair's table, as last seen
let message = null;            // { text, tone, until } shown in the line in place of what to do
let landed = null;             // the lots drawn last, to land only a new one (null: a board just put down)

function say(text, tone = "", ms = 2600) { message = text ? { text, tone, until: ms ? Date.now() + ms : Infinity } : null; drawLine(); }
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

/**
 * Draws a board: lots (found ones first, as bars in their enamel, then at the end the ones missed) and the tiles
 * still in play. tiles: [{ w, text, sel, sealed, theirs, who }]; lots: [{ g, rank, name, words, by, missed }].
 */
function drawBoard(lots, tiles, { off = false } = {}) {
  const key = lots.map(l => `${l.g}${l.missed ? "m" : ""}`).join(","), grew = landed != null && key.length > landed.length && key.startsWith(landed);
  landed = key;
  el.board.replaceChildren(
    ...lots.map((l, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `lt-lot l${l.rank}${l.missed ? " missed" : ""}${grew && i === lots.length - 1 ? " land" : ""}`;
      const name = document.createElement("span"), words = document.createElement("span");
      name.className = "lt-lot-name";
      name.textContent = l.name;
      words.className = "lt-lot-words";
      words.textContent = l.words.join(" · ");
      b.append(name, words);
      if (l.by) { const by = document.createElement("span"); by.className = "lt-lot-by"; by.textContent = l.by; b.append(by); }
      b.setAttribute("aria-label", `${l.name}: ${l.words.join(", ")}`);
      b.addEventListener("click", () => l.note && say(l.note, "note", 6000));
      return b;
    }),
    ...tiles.map(t => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `lt-tile${t.sealed ? " sealed" : ""}${t.theirs ? " theirs" : ""}`;
      const word = document.createElement("span");
      word.className = "lt-word";
      word.textContent = t.text;
      b.append(word);
      b.style.setProperty("--len", String(Math.max(5, t.text.length)));
      b.setAttribute("aria-pressed", String(!!t.sel));
      if (t.sealed) b.setAttribute("aria-label", t.theirs ? "Your partner's word, which they've picked" : "Your partner's word");
      if (t.who) { const w = document.createElement("span"); w.className = "lt-who"; w.textContent = t.who; w.setAttribute("aria-hidden", "true"); b.append(w); }
      b.disabled = off || t.sealed;
      b.addEventListener("click", () => tap(t.w));
      return b;
    }));
  fitWords();
}
/** Each tile's word on one line: shrunk where its letters are wider than the tile (KANGAROO, REMBRANDT on a phone). */
function fitWords() {
  for (const w of el.board.querySelectorAll(".lt-word")) {
    const tile = w.parentElement, cs = getComputedStyle(tile);
    const room = tile.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (w.offsetWidth > room && room > 0) w.style.fontSize = `${(parseFloat(cs.fontSize) * room / w.offsetWidth) * 0.97}px`;
  }
}
let shaking = 0;
function shake() {
  el.board.classList.remove("shake");
  void el.board.offsetWidth;
  el.board.classList.add("shake");
  clearTimeout(shaking);
  shaking = setTimeout(() => el.board.classList.remove("shake"), 400);
  navigator.vibrate?.(40);
}
/** The mistakes left, as dots, or the wall's clock and lives. */
function drawCountOf(r) {
  if (!r) { el.count.replaceChildren(); return; }
  if (r.mode === "wall") {
    const left = wallLeft(r), b = document.createElement("b");
    b.textContent = clock(left);
    b.classList.toggle("low", left < 30000 && !r.out);
    const lives = r.lives == null ? "guesses free" : plural(r.lives, "life", "lives");
    el.count.replaceChildren(b, ` ${lives}`);
    return;
  }
  dots(MISTAKES - r.mistakes);
}
function dots(left) {
  const box = document.createElement("span");
  box.className = "lt-dots";
  box.setAttribute("aria-label", `${plural(left, "mistake")} left`);
  for (let i = 0; i < MISTAKES; i++) { const d = document.createElement("i"); if (i >= left) d.className = "gone"; box.append(d); }
  el.count.replaceChildren("Mistakes", box);
}
function drawLine() {
  if (message && Date.now() > message.until) message = null;
  const text = message?.text ?? promptText();
  if (el.line.textContent !== text) el.line.textContent = text;
  el.line.className = `lt-line${message?.tone ? ` ${message.tone}` : ""}`;
}
/** What the line says when nothing has just happened. */
function promptText() {
  if (mode === "duo") return duoPrompt();
  if (!S) return mode === "race" ? "The same sixteen for everyone at the table, once it starts." : "";
  if (S.done) return verdict(S);
  if (phaseOf(S) === "name") return "The wall is frozen: name each lot's link.";
  if (S.mode === "wall") return S.sel.length ? `${4 - S.sel.length} more: the fourth is your guess.` : "Find the four lots before the clock runs out.";
  return S.sel.length === SIZE ? "Submit, or change a pick." : "Pick four words that belong together.";
}
function setControls(kind) {
  // play: Shuffle, Deselect, Submit; end: Share and the way on (Next, or the race's result)
  el.controls.classList.toggle("two", kind === "end");
  if (kind === "end") {
    el.shuffle.hidden = true;
    el.clear.textContent = "Share";
    el.submit.textContent = mode === "race" ? "The result" : "Next board";
    el.clear.disabled = false; el.submit.disabled = false;
  } else {
    el.shuffle.hidden = false;
    el.clear.textContent = "Deselect";
    el.submit.textContent = "Submit";
  }
  el.controls.dataset.kind = kind;
}

// ---------- alone, or a run in a race: one board as you play it ----------
/** The lots on show: found ones in the order found, then (once it's over, or the wall is frozen) the rest. The wall
 *  keeps a lot's link to itself until it's named: naming it is half the score. */
const lotsOfRun = r => {
  const naming = phaseOf(r) === "name", order = [...r.found, ...(r.done || naming ? r.board.g.map((_, g) => g).filter(g => !r.found.includes(g)) : [])];
  return order.map(g => {
    const named = r.mode === "wall" ? (r.names || []).find(n => n.g === g) : null, hide = r.mode === "wall" && !named;
    return { g, rank: g, name: hide ? (naming ? "Link to name" : "Found") : nameOfCat(r.board.g[g].c), words: r.board.g[g].w, missed: !r.found.includes(g),
      by: named ? (named.right ? "named" : "not named") : "", note: hide ? "" : noteOf(r.board, g, r.done) };
  });
};
/** Why a lot's words belong, for its bar: the reasons, and once the board is over its red herrings. */
function noteOf(board, g, over) {
  const c = BY_ID.get(board.g[g].c), why = board.g[g].w.map(w => reason(c, w)).filter(Boolean);
  const herrings = over ? board.g[g].w.flatMap(w => board.g.map((o, j) => (j !== g && fits(BY_ID.get(o.c), w) ? `${w} also fits ${nameOfCat(o.c)}` : null)).filter(Boolean)) : [];
  return [c.name, ...(why.length ? [why.join(", ")] : []), ...herrings.map(h => `Red herring: ${h}`)].join(". ");
}
function drawRun() {
  const r = S;
  if (!r) { drawBoard([], []); drawFeed([]); el.what.textContent = mode === "race" ? "Race" : ""; drawCountOf(null); setControls("play"); el.submit.disabled = el.clear.disabled = el.shuffle.disabled = true; drawLine(); return; }
  const placed = placedOf(r), over = r.done || phaseOf(r) === "name";
  const tiles = over ? [] : r.order.filter(w => !placed.has(w)).map(w => ({ w, text: w, sel: r.sel.includes(w) }));
  drawBoard(lotsOfRun(r), tiles, { off: IN_FRAME || phaseOf(r) !== "play" });
  el.what.textContent = r.kind === "daily" ? "Today's board" : `${r.kind === "race" ? "Race" : MODES[r.mode]} · ${LEVEL_NAMES[r.level] || ""}`;
  drawCountOf(r);
  setControls(r.done ? "end" : "play");
  if (!r.done) {
    el.submit.hidden = r.mode === "wall";                 // the wall's fourth pick is the guess
    el.submit.disabled = IN_FRAME || r.sel.length !== SIZE || phaseOf(r) !== "play";
    el.clear.disabled = IN_FRAME || !r.sel.length;
    el.shuffle.disabled = IN_FRAME || phaseOf(r) !== "play";
    el.controls.classList.toggle("two", r.mode === "wall");
  } else el.submit.hidden = false;
  drawRival();
  drawFeed(r.guesses.filter(x => x.r !== "right").map(x => ({ words: x.w, r: x.r })));
  drawLine();
}
/** Your wrong guesses so far, beside the board when it's held sideways (a phone has no room): a memory, not a hint. */
const RESULT = { one: "one away", miss: "not a lot", wrong: "wrong" };
function drawFeed(rows) {
  el.feed.replaceChildren(...rows.slice().reverse().map(x => {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = x.who ? `${x.who}: ${RESULT[x.r] || x.r}` : RESULT[x.r] || x.r;
    li.append(b, ` ${x.words.map(w => w ?? "▒").join(", ")}`);
    return li;
  }));
}
/** The line under the header: the computer you're playing against, as far as it has got. */
function drawRival() {
  if (mode === "race") return;                             // duel.js keeps that line
  const a = S && mode === "solo" ? rivalNow(S) : null;
  el.rival.hidden = !a;
  if (!a) return;
  const name = RIVALS[S.rival.level].name, b = document.createElement("b");
  b.textContent = name;
  const squares = [0, 1, 2, 3].map(i => { const s = document.createElement("i"); s.className = `lt-sq${i < a.found.length ? ` l${a.found[i]}` : ""}`; return s; });
  const said = a.done ? (a.won ? ` solved it in ${clock(a.end)}${a.mistakes ? `, ${plural(a.mistakes, "mistake")}` : ""}` : " ran out of mistakes") : a.mistakes ? ` · ${plural(a.mistakes, "mistake")}` : "";
  el.rival.replaceChildren(b, " ", ...squares, said);
}
/** How the board went, in a line. */
function verdict(r) {
  if (r.mode === "wall") {
    const named = r.names.filter(n => n.right).length;
    return `${scoreOf(r)} of 10: ${plural(r.found.length, "lot")} found, ${plural(named, "link")} named${r.out === "time" ? ", the clock ran out" : r.out === "lives" ? ", out of lives" : ""}.`;
  }
  const time = clock(r.ms), pts = `${scoreOf(r)} of 8`;
  const bits = [r.won ? (r.mistakes ? `Solved with ${plural(r.mistakes, "mistake")}` : "Perfect") : `Out of mistakes, ${plural(r.found.length, "lot")} found`, `${pts} in ${time}`];
  if (rainbow(r)) bits.push("a reverse rainbow");
  const vs = versus(r);
  if (vs) bits.push(vs.result > 0 ? `you beat ${RIVALS[r.rival.level].name}` : vs.result < 0 ? `${RIVALS[r.rival.level].name} wins (${vs.theirs} in ${clock(vs.ms)})` : `level with ${RIVALS[r.rival.level].name}`);
  return `${bits.join(", ")}.`;
}

// the clock: time on screen for a board alone (it stands while the menu is open, or the page is away); a race's runs
// from the table's start, and doesn't stop
let clockFrom = null, savedAt = 0;
const ticking = () => mode === "solo" && !!S && !IN_FRAME && phaseOf(S) === "play";
function clockRun() { if (!ticking() || clockFrom != null || document.hidden || isPaused()) return; clockFrom = performance.now(); }
function clockBook() {
  if (mode === "race" && S && !S.done) { S.ms = Math.max(0, duel.now() - S.begun); return; }
  if (clockFrom == null || !S) return;
  const now = performance.now(), froze = tick(S, now - clockFrom);
  clockFrom = froze ? null : now;
  if (froze) { save(); afterChange({ froze: true }); }
}
function clockStop() { clockBook(); clockFrom = null; }
onPause(() => { clockStop(); save(); }, () => clockRun());
function save() {
  if (IN_FRAME || !S) return;
  if (mode === "race") duel.keep(S); else if (mode === "solo") write(RUN, S);
  savedAt = performance.now();
}

/** A board on the table. */
function begin(r) {
  S = r;
  clockFrom = null;
  message = null;
  landed = null;
  el.level.value = S.level;
  save();
  clockRun();
  drawRun();
  if (phaseOf(S) === "name") askNames();
}
function seenRecent() { return read(SEEN, []); }
function noteSeen(board) { write(SEEN, [...board.g.map(g => g.c), ...seenRecent().filter(id => !board.g.some(g => g.c === id))].slice(0, 80)); }
function newBoard(kind = "random") {
  const stats = read(STATS, {}), n = (stats.n || 0) + 1;
  write(STATS, { ...stats, n });
  if (kind === "daily") {
    const day = today();
    begin(newRun({ board: daily(day), kind: "daily", day, rival: prefs.rival, n }));
    return;
  }
  let board = deal({ seed: randomSeed(), level: prefs.level, weights: prefs.mix, recent: seenRecent() });
  if (!board) { toast("Those topics are too narrow for a board: this one deals from every topic"); board = deal({ seed: randomSeed(), level: prefs.level }); }
  noteSeen(board);
  begin(newRun({ board, kind: "random", mode: prefs.mode, rival: prefs.rival, n }));
}
const started = () => !!S && mode === "solo" && !S.done && (S.guesses.length > 0 || S.sel.length > 0);
function confirmLeave(what = "Start a new board? This one isn't finished.") { return !started() || confirm(what); }
const dayDone = (day = today()) => read(DAILY, {})[day] != null;
function openToday() {
  if (S?.kind === "daily" && S.day === today()) { drawRun(); return; }
  if (dayDone()) {
    const v = read(DAILY, {})[today()], pts = Math.floor(v / 100000), secs = 99999 - (v % 100000);
    toast(`Today's board: ${pts}/8 in ${clock(secs * 1000)}. A new one tomorrow`);
    return;
  }
  if (!confirmLeave("Today's board is waiting. Leave the one you've started?")) return;
  newBoard("daily");
}

// ---------- taps ----------
function tap(word) {
  if (IN_FRAME) return;
  if (mode === "duo") { duoTap(word); return; }
  if (!S) return;
  clockRun();
  clockBook();
  const r = pick(S, word);
  if (!r) return;
  if (r.res || r.why) { afterGuess(r); return; }
  message = null;
  save();
  drawRun();
}
function submitPicks() {
  if (IN_FRAME) return;
  if (mode === "duo") { duoSubmit(); return; }
  if (!S) return;
  clockBook();
  afterGuess(submit(S));
}
function afterGuess(r) {
  if (r.why === "tried") say("Already tried", "bad");
  else if (r.res === "right") say(S.mode === "wall" ? "Found: its link is named once the wall is done" : nameOfCat(S.board.g[r.g].c), "good");
  else if (r.res === "one") { say("One away…", "bad"); shake(); }
  else if (r.res === "miss" || r.res === "wrong") { say(S.mode === "wall" ? "Wrong" : "Not a lot", "bad"); shake(); }
  afterChange();
}
/** Whatever just changed the run: its end recorded the moment it's final, the wall's naming, the race told. */
function afterChange({ froze = false } = {}) {
  if (S.done) { clockFrom = null; message = null; finished(); }        // the verdict takes the line at once
  else if (phaseOf(S) === "name") { clockFrom = null; if (froze) say("Time: the wall is frozen", "bad"); askNames(); }
  save();
  drawRun();
  if (mode === "race") tell();
}
/** The end of a board alone: today's figure, your stats, the rival's record. Once a board, the moment it's final. */
function finished() {
  if (mode !== "solo" || S.recorded || IN_FRAME) return;
  S.recorded = true;
  const stats = read(STATS, {});
  stats.played = (stats.played || 0) + 1;
  if (S.mode === "wall") {
    stats.wall = { played: (stats.wall?.played || 0) + 1, best: Math.max(stats.wall?.best || 0, scoreOf(S)) };
  } else {
    stats.solved = (stats.solved || 0) + (S.won ? 1 : 0);
    stats.perfect = (stats.perfect || 0) + (S.won && !S.mistakes ? 1 : 0);
    stats.streak = S.won ? (stats.streak || 0) + 1 : 0;
    stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak);
    const L = (stats.levels ||= {})[S.level] ||= { played: 0, solved: 0 };
    L.played++; if (S.won) L.solved++;
    const vs = versus(S);
    if (vs) { const rec = (stats.rivals ||= {})[S.rival.level] ||= [0, 0]; if (vs.result > 0) rec[0]++; else if (vs.result < 0) rec[1]++; }
  }
  write(STATS, stats);
  if (S.kind === "daily" && S.day && !dayDone(S.day)) {         // today's board: one go, counted now, points then time
    const days = read(DAILY, {}), v = dayScore(S);
    days[S.day] = v;
    write(DAILY, Object.fromEntries(Object.entries(days).sort(([a], [b]) => b - a).slice(0, 60)));
    write(BEST, Math.max(read(BEST, 0) || 0, v));
  }
}

// ---------- naming the links (the wall, frozen) ----------
const nameDlg = $("nameDlg");
nameDlg.addEventListener("cancel", e => e.preventDefault());   // a link is named or got wrong, never skipped by Escape
/** Asks for a lot's link: head, its words, four links; onPick(id) → { right } to show before it closes. */
function askLink({ head, words, options, onPick, note = "" }) {
  $("nameHead").textContent = head;
  $("nameWords").textContent = words.join(" · ");
  $("nameNote").textContent = note;
  const box = $("nameOpts");
  box.replaceChildren(...options.map(id => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = nameOfCat(id);
    b.addEventListener("click", () => {
      for (const x of box.children) x.disabled = true;
      const res = onPick(id);
      if (res) {
        b.classList.add(res.right ? "right" : "wrong");
        if (!res.right) [...box.children][options.indexOf(res.answer)]?.classList.add("right");
        $("nameNote").textContent = res.right ? "Right" : `It was ${nameOfCat(res.answer)}`;
      }
      setTimeout(() => { if (nameDlg.open) nameDlg.close(); res?.after?.(); }, res ? 1100 : 0);
    });
    return b;
  }));
  if (!nameDlg.open) nameDlg.showModal();
}
function askNames() {
  if (IN_FRAME || !S || mode !== "solo") return;
  const k = toName(S);
  if (k == null) return;
  const lot = S.board.g[k];
  askLink({
    head: `Name the link: ${k + 1} of 4`, words: lot.w, options: namingFor(S, k),
    note: S.found.includes(k) ? "" : "You didn't find this lot, but its link still scores",
    onPick: id => {
      const r = nameLot(S, id);
      if (!r) return null;
      if (S.done) finished();
      save();
      drawRun();
      return { right: r.right, answer: lot.c, after: () => (S.done ? drawRun() : askNames()) };
    },
  });
}

// ---------- the menu ----------
let pickBoard = null;                                        // the board the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (mode === "duo" || (mode !== "race" && roomInAddress() && !together.room)) duoMenu(body);
  else if (mode === "race") {
    duel.menu(part(body, "together"));
    part(body, "content").append(levelChoice());
  } else soloMenu(body);
  part(body, "play").append(action("The rules", showRules, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the rules ----------
// The header's Rules and the menu's The rules: Lots as it's played here, its numbers the engine's own, so the sheet
// can't drift from the game. A board's clock and the rival stand still while it's open, as for the menu (menu.js).
function showRules() {
  const rivals = Object.values(RIVALS).map(r => r.name).join(", ").replace(/, (\w+)$/, " or $1");
  $("rulesBody").innerHTML = `
    <p>Sixteen words, four lots of four: find the link that holds each lot together.</p>
    <p><b>Guessing.</b> Pick four words and Submit. Four of one lot and it's found: a bar in its colour, its link named. Three of one lot is One away, anything else Not a lot; ${inWords(MISTAKES)} mistakes and the board is over. The same four can't be tried twice (trying costs nothing), and with three lots found the fourth falls into place.</p>
    <p><b>The lots.</b> Ranked from plain to devious and coloured ochre, green, blue and red. A link can be a set or a meaning, things with something (things with keys: PIANO, MAP), a phrase (___&nbsp;JACK: FLAP, CRACKER, LUMBER, APPLE), sounds alike (SEA, GEE, AYE and CUE sound like letters), or wordplay: a word hidden inside, an anagram, a letter added or taken off. Beware red herrings, words that fit two links. A tap on a lot's bar says why its words belong, and once the board is over every lot shows, with its herrings.</p>
    <p><b>Playing.</b> Tap a word to pick it and again to let it go; Deselect drops every pick, Shuffle reorders the words left, and Enter submits from a keyboard.</p>
    <p><b>Score.</b> A point a lot, and once all four are found a point for each mistake to spare: ${SIZE + MISTAKES} is perfect. Solving the hardest lot first and the plainest last is a reverse rainbow. Playing alone, the clock stands still while the menu or these rules are open.</p>
    <p><b>Levels.</b> In the menu, with the topics as a mix: Easy, plain links and no red herrings; Medium, plain to devious, sometimes a herring; Hard, devious links, and always a herring that bites.</p>
    <p><b>The wall.</b> Settings' Play: Only Connect's connecting wall, against a clock of ${clock(WALL.ms)}. There's no Submit (your fourth pick is the guess, Wrong if it isn't a lot), and guesses are free until ${inWords(WALL.free)} lots are found, with ${inWords(WALL.lives)} lives after. When the clock or the lives run out, or the wall is solved, it freezes and you name each lot's link from four, found or not: a point a lot, a point a link, and ${inWords(WALL.bonus)} more for all eight, ${2 * SIZE + WALL.bonus} in all.</p>
    <p><b>The rival.</b> Settings' Against the computer: ${rivals} plays your classic board beside you as a person would, four squares under the header filling in as it finds lots. More points win, then the quicker.</p>
    <p><b>Today's board.</b> Medium, classic, every topic, the same for everyone, and a new one at midnight UTC: one go. It counts the moment it's over, as points then time (7/8 in 1:23), and Share copies your guesses as coloured squares.</p>
    <p><b>Together.</b> The pair plays one board, one of three ways, chosen in the menu. ${Object.values(room.MODES).map(m => `<b>${m.label}</b>: ${m.blurb.replace(/^./, c => c.toLowerCase())}`).join(" ")} Or a race: the same board for everyone, the most points winning, then the quicker.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
// the header's level, in the menu as everywhere (menu.js mirrors the select; its change handler deals)
const levelChoice = () => mirror("Level", el.level);
function soloMenu(body) {
  pickBoard ??= (S?.kind === "daily" && !S.done) || !dayDone() ? "daily" : "random";
  part(body, "play").append(action(S && !S.done ? "New board" : "Next board", () => {
    if (pickBoard === "daily") { openToday(); return; }
    if (confirmLeave()) newBoard();
  }, "primary"));
  const content = part(body, "content");
  content.append(choice("Board", [["random", "Random"], ["daily", "Today's"]], pickBoard, v => { pickBoard = v; openMenu(); }));
  if (pickBoard === "random") {
    content.append(levelChoice(), topicMix(TOPICS, PRESETS, prefs.mix, mix => { prefs.mix = cleanMix(mix); keepPrefs(); },
      { note: w => (presetOf(TOPICS, PRESETS, w) === "custom" ? "Your own mix of topics; today's board deals from every one." : null) }));
  } else content.append(line(dayDone() ? "Today's board is done: a new one tomorrow." : "Today's board: Medium, classic, the same for everyone."));
  const settings = part(body, "settings");
  settings.append(choice("Play", Object.entries(MODES), prefs.mode, v => {
    prefs.mode = v; keepPrefs();
    if (S && S.kind === "random" && !started() && !S.done && S.mode !== v) newBoard(); else toast(`${MODES[v]} from the next board`);
  }));
  settings.append(choice("Against the computer", [["off", "Off"], ...Object.entries(RIVALS).map(([k, r]) => [k, r.name])], prefs.rival || "off", v => {
    prefs.rival = v === "off" ? null : v; keepPrefs();
    toast(prefs.rival ? `${RIVALS[prefs.rival].name} plays your next classic board` : "No rival from the next board");
  }));
  part(body, "together").append(action("Invite players", () => { location.href = "party.html?game=lots&invite=1"; }, "link"));
  const st = read(STATS, {}), about = part(body, "about");
  const day = read(DAILY, {})[today()];
  about.append(line([st.played ? `${st.played} played, ${st.solved || 0} solved, ${st.perfect || 0} perfect` : "No board finished yet",
    st.bestStreak ? `best streak ${st.bestStreak}` : "", day != null ? `today ${Math.floor(day / 100000)}/8` : ""].filter(Boolean).join(" · ")));
  const rec = Object.entries(st.rivals || {}).map(([k, [w, l]]) => `${RIVALS[k]?.name} ${w}–${l}`);
  if (rec.length || st.wall?.played) about.append(line([rec.length ? `Against the computer: ${rec.join(", ")}` : "", st.wall?.played ? `the wall's best ${st.wall.best} of 10` : ""].filter(Boolean).join(" · ")));
}

// ---------- share ----------
async function share() {
  if (mode === "race") { duel.open(); return; }
  const r = mode === "duo" ? null : S;
  if (!r) return;
  const rows = r.guesses.map(x => x.w.map(w => SQUARES[r.board.g.findIndex(g => g.w.includes(w))]).join(""));
  const title = r.kind === "daily" ? `Lots · today's board, ${String(r.day).replace(/(\d{4})(\d\d)(\d\d)/, "$3/$2/$1")}` : `Lots · ${MODES[r.mode]}, ${LEVEL_NAMES[r.level]}`;
  const text = [title, verdict(r), ...rows].join("\n");
  try { await navigator.clipboard.writeText(text); toast("Result copied"); } catch { toast("Couldn't copy the result"); }
}

// ---------- the pair at one board (together.js) ----------
let seenGuesses = 0, seenBoard = 0, duoOrder = null, naming = null;
const mySlot = () => together.slot ?? 0;
function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return Promise.resolve(saved); } catch { /* private mode */ }
  const dlg = $("whoDlg"), input = $("whoInput");
  dlg.showModal();
  input.focus();
  return new Promise(res => $("whoForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 16);
    if (!name) { input.focus(); return; }
    dlg.close();
    try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
    res(name);
  }, { once: true }));
}
const together = createTogether({
  game: "lots", app: ROOM_APP, toast, askName,
  valid: room.isRoom,
  fresh: players => room.freshRoom(players, { seed: randomSeed(), level: prefs.level, mode: prefs.duo, app: ROOM_APP }),
  onState: val => {
    const fresh = mode !== "duo";
    mode = "duo";
    G = room.tidy(structuredClone(val));
    if (fresh || G.n !== seenBoard) { seenBoard = G.n; seenGuesses = G.guesses.length; duoOrder = null; message = null; landed = null; }
    else announce();
    if (G.race && G.race !== raceFollowed && Date.now() - G.race < 120000) { goRace(G.race); return; }
    drawDuo();
  },
  onPresence: () => { if (mode === "duo") drawDuo(); },
  onLeave: () => { G = null; mode = "solo"; if (nameDlg.open) nameDlg.close(); solo(); },
  result: val => room.resultOf(room.tidy(structuredClone(val))),
});
const partnerName = () => together.others()[0]?.name || "your partner";
const first = n => String(n || "").split(" ")[0];
function announce() {
  const me = mySlot(), v = room.viewFor(G, me);
  v.guesses.slice(seenGuesses).forEach(x => {
    const who = x.by === me ? null : first(partnerName());
    if (x.r === "right") say(who ? `${who} found a lot` : "A lot found", "good");
    else if (x.r === "wrong") say(`Wrong: ${first(partnerName())} saw how close`, "bad");
    else {
      const odd = x.odd != null ? (x.odd === me ? ", one of your picks is off" : `, one of ${first(partnerName())}'s picks is off`) : "";
      say(`${who ? `${who}: ` : ""}${x.r === "one" ? "one away" : "not a lot"}${odd}`, "bad", 4000);
      if (!who) shake();
    }
  });
  seenGuesses = v.guesses.length;
}
function duoPrompt() {
  if (!G) return "";
  const me = mySlot(), v = room.viewFor(G, me), them = first(partnerName());
  if (G.done) return `${G.won ? "Solved together" : "Out of mistakes"}: ${room.pointsOf(G)} of ${room.maxPoints(G)}. ${plural(G.tally.boards, "board")} at this table.`;
  if (G.pending) return G.pending.namer === me ? "Name the lot your partner found." : `${them} is naming the lot you found.`;
  if (!together.others().length) return "Waiting for your partner to sit down.";
  if (G.mode === "hidden") { const picks = room.picksFor(G, me).length; return picks === SIZE ? "Four picked between you: either of you submits." : `Your words are yours to pick; tell ${them} about them. ${picks} of 4 picked.`; }
  return v.mine.length === SIZE ? "Submit, or change a pick." : "Pick four words that belong together.";
}
function drawDuo() {
  if (!G) return;
  const me = mySlot(), v = room.viewFor(G, me), placed = new Set(G.found.flatMap(f => G.board.g[f.g].w).concat(G.pending ? G.board.g[G.pending.g].w : []));
  const others = together.others(), them = others[0];
  duoOrder ??= [...G.order];
  const lots = G.found.map(f => ({ g: f.g, rank: f.g, name: G.mode === "crossed" && f.named === false ? `${room.nameOf(G, f.g)} (not named)` : room.nameOf(G, f.g), words: G.board.g[f.g].w,
    by: f.by == null ? "" : f.by === me ? "found by you" : `found by ${first(them?.name)}`, note: noteOf(G.board, f.g, G.done) }));
  if (G.pending) lots.push({ g: G.pending.g, rank: G.pending.g, name: "To name", words: G.board.g[G.pending.g].w, by: G.pending.namer === me ? "yours to name" : `${first(them?.name)} names it` });
  if (G.done) G.board.g.forEach((lot, g) => { if (!G.found.some(f => f.g === g)) lots.push({ g, rank: g, name: room.nameOf(G, g), words: lot.w, missed: true, note: noteOf(G.board, g, true) }); });
  const word = new Map(v.words.map(x => [x.w, x]));
  const tiles = G.done ? [] : duoOrder.filter(w => !placed.has(w)).map(w => {
    const x = word.get(w), theirs = v.theirs.includes(w);
    return { w, text: x.sealed ? "" : w, sealed: x.sealed, sel: v.mine.includes(w), theirs, who: theirs && !x.sealed ? first(them?.name).slice(0, 1).toUpperCase() : "" };
  });
  drawBoard(lots, tiles, { off: G.done || !!G.pending });
  drawFeed(v.guesses.filter(x => x.r !== "right").map(x => ({ words: x.w, r: x.r, who: x.by === me ? "You" : first(them?.name) })));
  el.what.textContent = `${room.MODES[G.mode].label} · ${LEVEL_NAMES[G.level]}`;
  dots(MISTAKES - G.mistakes);
  el.rival.hidden = false;
  el.rival.replaceChildren(...(them ? [Object.assign(document.createElement("b"), { textContent: first(them.name) }), them.here ? (v.theirs.length ? ` · ${plural(v.theirs.length, "pick")}` : " · here") : " · away"] : [sextant(), "Waiting for your partner"]));
  setControls(G.done ? "end" : "play");
  if (!G.done) {
    el.submit.hidden = false;
    el.submit.disabled = room.picksFor(G, me).length !== SIZE || !!G.pending || !others.length;
    el.clear.disabled = !v.mine.length;
    el.shuffle.disabled = false;
    el.controls.classList.remove("two");
  }
  drawLine();
  // crossed: the lot your partner found is yours to name
  if (v.name && naming !== `${G.n}/${v.name.g}`) {
    naming = `${G.n}/${v.name.g}`;
    askLink({
      head: `Name the lot ${first(them?.name) || "your partner"} found`, words: G.board.g[v.name.g].w, options: v.name.options,
      onPick: id => { const n = G.n; together.act(s => room.nameAt(room.tidy(s), { n, slot: me, pick: id })); return { right: id === G.board.g[v.name.g].c, answer: G.board.g[v.name.g].c }; },
    });
  }
}
function duoTap(word) {
  if (!G || G.done) return;
  const n = G.n, slot = mySlot(), local = structuredClone(G);
  if (room.pickAt(local, { n, slot, word }) === false) return;
  G = local;                                               // at once on this phone; the table follows
  message = null;
  drawDuo();
  together.act(s => room.pickAt(room.tidy(s), { n, slot, word }));
}
async function duoSubmit() {
  if (!G) return;
  const n = G.n, slot = mySlot(), words = room.picksFor(G, slot), partnerHere = together.others().some(o => o.here);
  let out = null;
  await together.act(s => { out = room.submitAt(room.tidy(s), { n, slot, words, partnerHere }); return ["right", "one", "miss"].includes(out); });
  if (out === "tried") say("Already tried", "bad");
  else if (out === "moved") say("Your partner changed the picks", "bad");
}
function duoClear() { if (!G) return; const n = G.n, slot = mySlot(); const local = structuredClone(G); if (room.clearAt(local, { n, slot })) { G = local; drawDuo(); together.act(s => room.clearAt(room.tidy(s), { n, slot })); } }
function duoNext(nextMode = G?.mode) {
  if (!G) return;
  const n = G.n;
  together.act(s => room.nextAt(room.tidy(s), { n, seed: randomSeed(), level: prefs.level, mode: nextMode }));
}
// a race in the pair's room: the request is written already said yes to (as a party's host does), and both phones go
let raceFollowed = 0;
async function raceInstead() {
  if (!together.room) return;
  const at = Date.now(), { sync, code, uid } = together.room;
  try {
    await sync.update(`crates/rooms/${code}`, { ask: { game: "lotsrace", at, answer: "yes", from: uid, device: uid, people: 2 } });
    await together.act(s => { s.race = at; return true; });
  } catch (e) { console.error(e); toast("Couldn't start the race"); }
}
function goRace(at) {
  raceFollowed = at;
  location.href = `lots.html?room=${together.room.code}&new=${at}&race=1`;
}
function duoMenu(body) {
  const t = part(body, "together");
  if (!G) { const w = line(joiningWords()); w.prepend(sextant()); t.append(w, action("Back to solo", () => location.replace(soloHref()), "link")); return; }
  const others = together.others();
  t.append(line(others.length ? `With ${list2(others.map(o => `${first(o.name)}${o.here ? "" : " (away)"}`))}` : "Waiting for your partner"));
  t.append(choice("Together", Object.entries(room.MODES).map(([k, m]) => [k, m.label]), G.mode, v => {
    prefs.duo = v; keepPrefs();
    if (G.done || (!G.guesses.length && !G.found.length) || confirm(`Start a new board, ${room.MODES[v].label.toLowerCase()}, for both of you?`)) duoNext(v);
    else openMenu();
  }));
  t.append(line(room.MODES[G.mode].blurb));
  t.append(action("New board", () => { if (G.done || confirm("Start a new board for both of you?")) duoNext(); }, "primary"),
    action("Race instead", raceInstead), action("Back to solo", () => together.leave(), "link"));
  part(body, "content").append(levelChoice());
}

// ---------- a race on one board (duel.js) ----------
const duel = createDuel({
  game: "lotsrace", name: "Lots", app: RACE_APP, accent: "--lt-in", line: el.rival, toast,
  deal: () => ({ seed: randomSeed(), level: prefs.level }),
  describe: m => `${LEVEL_NAMES[m.level] || "Medium"}: the same sixteen for everyone; the most points wins (a lot each, and a point for each mistake left once solved), then the quicker`,
  play: (match, { begun, kept }) => {
    mode = "race";
    const level = LEVELS.includes(match.level) ? match.level : "medium";
    const same = isRun(kept) && kept.board.seed === match.seed && kept.level === level;
    S = same ? kept : newRun({ board: deal({ seed: match.seed, level }), kind: "race" });
    S.begun = begun;
    message = null;
    landed = null;
    drawRun();
    tell();
  },
  onLobby: match => { mode = "race"; S = null; if (match?.level) el.level.value = match.level; drawRun(); },
  onLeave: () => {
    mode = "solo";
    const u = new URL(location.href); u.searchParams.delete("race"); history.replaceState(null, "", u);
    solo();
  },
});
/** What the table sees of this run: lots and mistakes as it goes, the points once it's over. */
function tell() {
  if (mode !== "race" || !S) return;
  const text = S.done ? `${scoreOf(S)} of 8${S.won ? "" : ", out"}` : `${plural(S.found.length, "lot")}${S.mistakes ? `, ${plural(S.mistakes, "mistake")}` : ""}`;
  duel.report({ score: scoreOf(S), text, done: S.done, ...(S.done ? { ms: Math.round(S.ms) } : {}) });
}

// ---------- wiring ----------
document.querySelector(".lt-mark").innerHTML = APPS.find(a => a.id === "lots")?.logo || LOGO;
bindSwitcher($("appsBtn"), "lots");
dropdown(el.level);
el.level.addEventListener("change", () => {
  const v = el.level.value;
  if (mode === "race") { prefs.level = v; keepPrefs(); if (!duel.newMatch()) el.level.value = duel.match?.level || "medium"; return; }
  prefs.level = v; keepPrefs();
  if (mode === "duo") { toast(`${LEVEL_NAMES[v]} from the next board`); return; }
  if (S && S.kind === "random" && S.level === v && !S.done) return;
  if (confirmLeave()) newBoard(); else el.level.value = S?.level || "medium";
});
el.submit.addEventListener("click", () => {
  if (el.controls.dataset.kind === "end") { if (mode === "race") duel.open(); else if (mode === "duo") duoNext(); else newBoard(); return; }
  submitPicks();
});
el.clear.addEventListener("click", () => {
  if (el.controls.dataset.kind === "end") { share(); return; }
  if (mode === "duo") { duoClear(); return; }
  if (S && clearPicks(S)) { save(); drawRun(); }
});
el.shuffle.addEventListener("click", () => {
  if (mode === "duo") { if (G) { duoOrder = shuffle(duoOrder || G.order); drawDuo(); } return; }
  if (S && phaseOf(S) === "play") { shuffleLeft(S); save(); drawRun(); }
});
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
document.addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "Enter" && !el.submit.disabled && !el.submit.hidden) el.submit.click();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) { clockStop(); save(); } else { clockRun(); together.resync(); duel.resync(); } });
window.addEventListener("pagehide", () => { clockStop(); save(); });
window.addEventListener("pageshow", e => { if (e.persisted) { together.resync(); duel.resync(); } });
document.addEventListener("pointerdown", () => clockRun(), true);
let resized = 0;
window.addEventListener("resize", () => { clearTimeout(resized); resized = setTimeout(() => (mode === "duo" ? drawDuo() : drawRun()), 120); });
document.fonts?.ready.then(() => fitWords());
setInterval(() => {
  if (!S || mode === "duo") { if (message && Date.now() > message.until) drawLine(); return; }
  clockBook();
  if (mode === "solo" && clockFrom != null && performance.now() - savedAt > 5000) save();
  drawCountOf(S);
  drawRival();
  if (message && Date.now() > message.until) drawLine();
}, 250);

// for tests and debugging
window.__lots = { get run() { return S; }, get table() { return G; }, get mode() { return mode; }, tap, submitPicks, newBoard, openToday, duoNext, raceInstead, together, duel };

/** Your own board: the one you left, or today's when the games screen sent you for it, or a new one. */
function solo() {
  mode = "solo";
  el.rival.replaceChildren();
  const kept = read(RUN, null);
  S = isRun(kept) ? kept : null;
  if (forToday && !IN_FRAME && !(S?.kind === "daily" && S.day === today()) && !dayDone()) {
    if (!started() || confirm("Today's board is waiting. Leave the one you've started?")) { newBoard("daily"); return; }
  }
  if (S) begin(S);
  else if (IN_FRAME) drawRun();
  else newBoard(dayDone() ? "random" : "daily");
}
const forToday = arrivedForToday();
// a table in the address: the race (a party's, or the pair's when they chose one) or the pair's board; the rete until
// it's drawn, and no board of your own under it
const code = roomInAddress(), q = new URLSearchParams(location.search);
if (code && (q.has("party") || q.has("race"))) duel.join(code).then(ok => { if (!ok) solo(); });
else if (code) {
  const joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { joining(); if (!ok) solo(); });
} else solo();
