// Survey: a block of rock hides a body of ore. Every row of cubes through it carries a reading on the block's faces: how many of
// its cubes are ore, and (with the seams marked) whether they lie in one seam, two, or three or more. You chip away the waste from
// the outside in; ore chipped by mistake stays and costs a strike; marks keep the cubes you are sure of safe. The rules and the
// puzzles are survey-engine.js's (every puzzle has one answer, got by reasoning along the rows); survey-3d.js draws the block;
// this file keeps the run, the clock and the taps. Your time plus the penalties is your score, lower is better. Two ways to
// play: Levels (survey-levels.js: a ladder of recipes in chapters, stars for the score, each level kept as it was left, as
// Topple's are) and Free play (a size, a reading, a random block or today's). Together, the same block for everyone at the
// table (duel.js).
import { SIZES, READINGS, STRIKE, HINT, makePuzzle, newRun, chip, mark, hint, wasteLeft, score } from "./survey-engine.js";
import { LEVELS, COUNT, CHAPTERS, chapterOf, seedOf, levelPuzzle, shapeOf, parOf, starsFor } from "./survey-levels.js";
import { miniature } from "./survey-mini.js";
import { createBlock } from "./survey-3d.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";   // the day, the same for everyone (UTC); a partner watching's frame runs no clock and writes nothing
import { roundOver } from "./random.js";
import { createDuel } from "./duel.js";

const sizeDropdown = dropdown(document.getElementById("size"));   // the header dropdown in the suite's style (see dropdown.js)

const $ = id => document.getElementById(id);
// RUN: the free block in play. TRACK: "levels" or "free", the way played. CAMP: the level being played and the stars won in each.
// LRUNS: the block of each level as it was left (by level).
const RUN = "survey:run", TIMES = "survey:times", READ = "survey:readings", VIEW = "survey:view", ERA = "survey:era", TRACK = "survey:track", CAMP = "survey:camp", LRUNS = "survey:lruns";
const DAILY = { size: "medium", readings: "seams" };   // today's block is the same for everyone, so its size and readings are fixed
const SAVE_EVERY = 5000;                                 // ms between saves of a block in play (a partner watching sees it that often)

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;
const STAR = "★", HOLLOW = "☆";
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };

// The credits-and-claims Survey kept its best and its dailies under these; the scores mean nothing now, and the games screen
// would read the old best as a time.
if (!IN_FRAME && read(ERA, 0) < 2) {
  try { localStorage.removeItem("survey:best"); localStorage.removeItem("survey:daily"); } catch { /* private mode */ }
  write(ERA, 2);
}

let S = null;              // { seed, mode ("random", "daily", "level" or "duel"), size (null in a level), level (0 on, in a level), readings, run (the engine's), fresh (a new best) }
let P = null;              // its puzzle, made from the seed
let tool = "chip";
let readings = read(READ, "seams");   // what the next random block is read with (the menu's choice)
if (!READINGS[readings]) readings = "seams";
let track = "levels";      // the way played (set below, once a saved block can be told from a stray one)
let camp = { at: 0, stars: LEVELS.map(() => 0) };
let clockFrom = null;      // when the clock last started running (performance.now), or null while it is stopped
let savedAt = 0;
let message = null;        // { text, tone }: what the line says until the next tap, else how to play
let paused = false;
const fingers = new Map();   // pointer id -> { x0, y0, x, y, cube (under it when it went down), moved }

// ---------- the block ----------
const stage = $("stage");
let view = null;
try { view = createBlock(stage); }
catch (err) {
  console.warn("Survey: no WebGL here.", err);
  stage.replaceChildren(Object.assign(document.createElement("p"), { className: "sv-nogl", textContent: "Survey draws its block in 3D, which this browser has switched off or lacks." }));
}
if (view) { const v = read(VIEW, null); if (Array.isArray(v)) view.setView(v[0], v[1]); }

// ---------- the clock ----------
// A solo block counts the time spent on screen (run.ms); a match's counts from when the table started it (duel.js).
function clockRun() {
  if (IN_FRAME || !S || S.duel || S.run.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.run.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); fingers.clear(); view?.focus(-1); }, () => { paused = false; clockRun(); });   // the menu stops the clock too
const elapsed = () => (S.run.done ? S.run.ms : S.duel ? Math.max(0, duel.now() - S.begun) : S.run.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = r => STRIKE * r.strikes + HINT * r.hints;

// ---------- keeping ----------
function save() {
  if (IN_FRAME || !S) return;
  if (S.duel) duel.keep(S);
  else if (isLevel(S)) write(LRUNS, { ...read(LRUNS, {}), [S.level]: S });
  else write(RUN, S);
  savedAt = performance.now();
}
const isLevel = s => s?.mode === "level";
const startedRun = s => !!s && !s.duel && !s.run.done && (s.run.gone.length > 0 || s.run.shown.length > 0 || s.run.marked.length > 0 || s.run.hints > 0);
const started = () => startedRun(S);
const valid = s => !!s && Number.isInteger(s.seed) && !!READINGS[s.readings] && !!s.run && Array.isArray(s.run.gone) && Array.isArray(s.run.shown) && Array.isArray(s.run.marked) && Number.isFinite(s.run.ms)
  && (isLevel(s) ? Number.isInteger(s.level) && s.level >= 0 && s.level < COUNT && s.readings === LEVELS[s.level].kind : !!SIZES[s.size]);

// ---------- the levels ----------
/** The campaign as kept: the level being played and the stars won in each, mended if it is not what it should be. */
function readCamp() {
  const c = read(CAMP, null), stars = LEVELS.map((_, k) => (Number.isInteger(c?.stars?.[k]) ? Math.max(0, Math.min(3, c.stars[k])) : 0));
  const open = stars.findIndex(s => s < 1);                          // the first level not beaten is the last one open
  return { at: Number.isInteger(c?.at) ? Math.max(0, Math.min(c.at, open < 0 ? COUNT - 1 : open)) : 0, stars };
}
/** Whether level n (0 on) is open: the first, and any whose one before is beaten. */
const isOpen = n => n === 0 || camp.stars[n - 1] >= 1;
camp = readCamp();
// A player with a free block in hand from before levels came carries on with it; anyone else begins on the ladder.
track = read(TRACK, null);
if (track !== "levels" && track !== "free") track = valid(read(RUN, null)) ? "free" : "levels";
/** The block saved for the way being played (and the level), or null. */
function savedGame() {
  const g = track === "levels" ? read(LRUNS, {})[camp.at] : read(RUN, null);
  return valid(g) && !g.duel && (track === "levels" ? g.level === camp.at && isLevel(g) : !isLevel(g)) ? g : null;
}
const bestKey = s => `${s.size}:${s.readings}`;
/** Records a cleared block's score as the best for its size and readings (lowest wins); true if it is a new best. Kept in survey:times, not survey:best, which the games screen reads as highest-is-best. */
function recordBest(sc) {
  const times = read(TIMES, {}), k = bestKey(S), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

/** Writes a cleared level's stars (the best it has had); true if this clear improved on them. */
function recordLevel(sc) {
  const n = S.level, stars = starsFor(P, sc), fresh = stars > camp.stars[n];
  if (fresh) { camp.stars[n] = stars; write(CAMP, camp); }
  return fresh;
}

// ---------- starting ----------
const hashFor = s => (isLevel(s) ? `#l=${s.level}&s=${s.seed}` : `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&z=${s.size}&r=${s.readings}`);
/** Puts a block on the table: `s` is { seed, mode, size, readings } (a level's: level, no size), `run` the run in it. */
function begin(s, run = newRun(), at = {}) {
  S = { ...s, run, ...at };
  P = isLevel(S) ? levelPuzzle(S.level, S.seed) : makePuzzle(S.seed, S.size, S.readings);
  tool = "chip";
  message = !S.duel && isLevel(S) && !started() && !S.run.done ? introOf(S.level) : null;
  clockFrom = null;
  stage.hidden = false;
  if (!isLevel(S)) $("size").value = S.size;
  view?.set(P, S.run);
  if (!S.duel) {
    track = isLevel(S) ? "levels" : "free";
    if (isLevel(S)) camp.at = S.level;                       // a link's level is the one in hand now
    if (!IN_FRAME) { write(TRACK, track); if (isLevel(S)) write(CAMP, camp); history.replaceState(null, "", hashFor(S)); }
  }
  save();
  clockRun();
  render();
}
function start(mode, size = $("size").value) {
  const daily = mode === "daily";
  begin({ seed: daily ? today() : randomSeed(), mode, size: daily ? DAILY.size : size, readings: daily ? DAILY.readings : readings });
}
/** What a level says when it is first met: its chapter's idea if it is the chapter's first, else its own word, if it has one. */
function introOf(n) {
  const ch = CHAPTERS[chapterOf(n)], L = LEVELS[n];
  const text = n === ch.from ? `${ch.name}. ${ch.about}` : L.about;
  return text ? { text, tone: "" } : null;
}
/** A block of level n (0 on): the level's own the first time it is played, a new one after that or when asked. */
function levelBlock(n, again = false) {
  begin({ seed: !again && camp.stars[n] < 1 ? seedOf(n) : randomSeed(), mode: "level", level: n, size: null, readings: LEVELS[n].kind });
}
/** Plays level n (0 on) as it was left, or new if it was not begun. */
function playLevel(n) {
  if (!isOpen(n)) return;
  clockPause();
  camp.at = n;
  write(CAMP, camp);
  track = "levels";
  write(TRACK, track);
  resume();
}
/** The block of the way now chosen, as it was left (else a new one). */
function resume() {
  S = savedGame();
  if (S) load();
  else if (track === "levels") levelBlock(camp.at);
  else start("random");
}
function setTrack(next) {
  if (next === track) return;
  clockPause();
  track = next;
  write(TRACK, track);
  resume();
}

// ---------- taps ----------
function note(text, tone = "") { message = text ? { text, tone } : null; drawLine(); }
function tapCube(i) {
  if (!S || !view || S.run.done || IN_FRAME || paused) return;
  const run = S.run;
  view.halo(-1);
  if (tool === "chip") {
    const wasMarked = run.marked.includes(i), wasShown = run.shown.includes(i), result = chip(P, run, i);
    if (result === "no") {
      note(wasMarked ? "That cube is marked, so it is safe. Take the mark off to chip it." : wasShown ? "That cube is ore: it stays." : null);
      navigator.vibrate?.(12);
      return;
    }
    if (result === "strike") { note(`Ore! That cube stays, and costs ${STRIKE} s.`, "bad"); navigator.vibrate?.(70); }
    else note(null);
  } else {
    if (!mark(P, run, i)) { note(run.shown.includes(i) ? "That cube is known to be ore already." : null); return; }
    note(null);
  }
  changed();
}
function useHint() {
  if (!S || !view || S.run.done || IN_FRAME || paused) return;
  const h = hint(P, S.run, i => (view.visible(i) ? 1 : 0));       // a cube you can see, if the readings force one
  if (!h) { note("The readings tell no more than you already know."); return; }
  view.halo(h.exposed ? h.cell : -1, [h.line]);
  const what = h.v === 0 ? "waste" : "ore";
  note(h.exposed ? `Hint: the glowing cube is ${what}${h.v === 1 ? "; it is shown in gold now" : ""}. The lit row says so.` : `Hint: the lit row forces a ${what} cube deeper in. Chip towards it.`, "good");
  changed();
}
/** The run changed: the block, the strip and the keeping follow, and the end is settled the moment the last waste is gone. */
function changed() {
  view.update();
  if (S.run.done) finish(); else { save(); tellSoon(); }
  render();
}
function finish() {
  const r = S.run;
  if (S.duel) r.ms = Math.max(0, duel.now() - S.begun);
  else if (clockFrom != null) { r.ms += performance.now() - clockFrom; clockFrom = null; }
  const sc = score(r);
  if (S.duel) { tell(true); save(); }
  else {
    S.fresh = isLevel(S) ? recordLevel(sc) : recordBest(sc);
    if (S.mode === "daily") noteDayTime("survey", sc, S.seed);      // today's block: the first clear's score
    save();
    roundOver("survey");
  }
  view.spin();
}

// ---------- drawing ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!S || !P) { put("score", "0:00"); put("penalty", ""); put("left", ""); return; }
  const r = S.run, pen = penalty(r);
  put("score", fmt(elapsed() / 1000 + pen));
  put("penalty", pen ? `+${pen} s` : "");
  put("left", String(wasteLeft(P, r)));
  if (isLevel(S)) put("par", fmt(parOf(P)));
}
function drawLine() {
  const l = $("line"), text = !S ? "The same block for everyone at the table." : message ? message.text
    : tool === "mark" ? "Tap a cube to mark it as ore: it is safe from the chisel. Tap again to take the mark off."
    : isLevel(S) && LEVELS[S.level].fog > 0 ? "Tap a cube to chip it. A ? plate is a row nobody read; the others still settle every cube."
    : S.readings === "counts" ? "Tap a cube to chip it. Each plate counts the ore cubes in its row."
    : S.readings === "runs" ? "Tap a cube to chip it. A plate lists a row's seams: 2 1 is a seam of two, a gap, then one."
    : "Tap a cube to chip it. A plate counts a row's ore; a ring says two seams, a box three or more.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `sv-line${message?.tone ? ` ${message.tone}` : ""}`;
}
function drawResult() {
  const done = !!S?.run.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const r = S.run, sc = score(r), bits = [`${fmt(r.ms / 1000)} on the clock`];
  if (r.strikes) bits.push(`${plural(r.strikes, "strike")} (+${STRIKE * r.strikes} s)`);
  if (r.hints) bits.push(`${plural(r.hints, "hint")} (+${HINT * r.hints} s)`);
  const best = isLevel(S) ? null : read(TIMES, {})[bestKey(S)], stars = isLevel(S) ? starsFor(P, sc) : 0;
  const after = S.duel ? "" : isLevel(S) ? ` ${STAR.repeat(stars)}${HOLLOW.repeat(3 - stars)} Par ${fmt(parOf(P))}.`
    : S.fresh ? " A new best." : best != null ? ` Your best here: ${fmt(best)}.` : "";
  $("verdict").textContent = `Cleared: ${fmt(sc)}. ${bits.join(", ")}.${after}`;
  $("verdict").className = "sv-verdict good";
  $("nextBtn").textContent = S.duel ? "The result" : isLevel(S) ? (S.level + 1 < COUNT ? "Next level" : "Levels") : "Another block";
}
/** The header: in a level the block's size is the level's own, so the size dropdown gives way to the level, and the par joins the score. */
function chrome() {
  const level = !!S && isLevel(S);
  $("app").classList.toggle("lv", level);
  $("size").hidden = level;
  sizeDropdown.sync();
  $("parWrap").hidden = !level;
  $("levelBtn").hidden = !level;
  if (level) $("levelBtn").textContent = `Level ${S.level + 1}`;
}
function render() {
  chrome();
  if (!S) { lobby(); return; }
  for (const b of $("tools").querySelectorAll("[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
  const off = !view || S.run.done || IN_FRAME;
  for (const b of $("tools").children) b.disabled = off;
  drawStrip(); drawLine(); drawResult();
}
/** The board before a match: no block yet. */
function lobby() {
  stage.hidden = true;
  $("result").hidden = true;
  $("controls").hidden = false;
  for (const b of $("tools").children) b.disabled = true;
  drawStrip(); drawLine();
}

// ---------- together: the same block for everyone at the table (duel.js) ----------
// Everyone at the table gets the match's block, the same size and the same rock, read the same way, and chips it on their own
// phone from the moment the table starts; the others' progress shows in the strip as the rock they have left. The lowest
// score (time plus penalties) at a cleared block wins. Your own block, bests and today's stay as they were.
const duel = createDuel({
  game: "survey", name: "Survey", accent: "--sv-in", line: $("rival"), toast, lower: true,
  deal: () => ({ seed: randomSeed(), size: SIZES[$("size").value] ? $("size").value : "small", readings }),
  describe: m => `${SIZES[m.size]?.label || "Small"}, ${(READINGS[m.readings] || READINGS.seams).toLowerCase()}: the same block for everyone, the fastest clear wins`,
  play: (match, { begun, kept }) => {
    const size = SIZES[match.size] ? match.size : "small", rd = READINGS[match.readings] ? match.readings : "seams";
    const same = kept?.seed === match.seed && kept.size === size && kept.readings === rd && valid(kept);
    begin({ seed: match.seed, mode: "duel", size, readings: rd, duel: true }, same ? kept.run : newRun(), { begun });
    tell(S.run.done);
  },
  onLobby: match => { S = null; P = null; $("size").value = SIZES[match.size] ? match.size : "small"; render(); },
  onLeave: resume,
});
/** What the table sees of this block: the rock left, and the score once it is cleared. */
function tell(done = false) {
  if (!S?.duel) return;
  const r = S.run, left = wasteLeft(P, r);
  duel.report(done ? { score: score(r), text: `${fmt(score(r))}, cleared`, done: true } : { score: left, text: `${left} rock left` });
}
let tellTimer = 0;
function tellSoon() {   // a report for every chip would be a write for every chip
  if (!S?.duel || tellTimer) return;
  tellTimer = setTimeout(() => { tellTimer = 0; if (S?.duel && !S.run.done) tell(); }, 1500);
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
// the menu: Play (a new block), Content (Levels or Free play; in Levels the ladder, in Free play random or today's, the size and
// how the rows are read), Settings (the view), About (your stars or your best here, a link)
let pick = null;                                              // the free block the menu will start: "random" or "daily"
/** The levels, three to a row under their chapter: each its rock in miniature, its number and name and the stars won. Those not open yet are dimmed; any open one can be played at any time, as it was left. */
function levelList() {
  const all = document.createElement("div");
  all.className = "sv-levels";
  CHAPTERS.forEach((ch, c) => {
    const head = document.createElement("h3"), grid = document.createElement("div"), to = CHAPTERS[c + 1]?.from ?? COUNT;
    head.className = "sv-chap";
    head.textContent = ch.name;
    grid.className = "sv-lgrid";
    for (let n = ch.from; n < to; n++) {
      const L = LEVELS[n], won = camp.stars[n], b = document.createElement("button"), map = document.createElement("div"), row = document.createElement("div"),
        num = document.createElement("b"), stars = document.createElement("span"), name = document.createElement("div"), size = document.createElement("div");
      b.type = "button";
      b.disabled = !isOpen(n);
      b.className = won ? "done" : "";
      if (n === camp.at && track === "levels") b.setAttribute("aria-current", "true");
      b.setAttribute("aria-label", `Level ${n + 1}, ${L.name}${won ? `, ${plural(won, "star")}` : ""}${b.disabled ? ", not open yet" : ""}`);
      map.className = "sv-lmap";
      map.innerHTML = miniature(shapeOf(L.shape, L.n, L.box), L.n);
      row.className = "sv-lrow";
      num.textContent = n + 1;
      stars.textContent = isOpen(n) ? STAR.repeat(won) + HOLLOW.repeat(3 - won) : "";
      row.append(num, stars);
      name.className = "sv-lname";
      name.textContent = L.name;
      size.className = "sv-lsize";
      size.textContent = (L.box ?? [L.n, L.n, L.n]).join("×");
      b.append(map, row, name, size);
      b.addEventListener("click", () => { $("menuDlg").close(); playLevel(n); });
      grid.append(b);
    }
    all.append(head, grid);
  });
  return all;
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const readingsChoice = () => choice("Readings", Object.entries(READINGS), readings, v => { readings = v; write(READ, v); });
  if (duel.on) {                                              // a match: the table's own, and the size and readings the next one deals
    duel.menu(part(body, "together"));
    part(body, "content").append(mirror("Size", $("size")), readingsChoice());
    if (!$("menuDlg").open) $("menuDlg").showModal();
    return;
  }
  const levels = track === "levels", content = part(body, "content");
  pick ??= S?.mode === "daily" ? "daily" : "random";
  part(body, "play").append(action("New block", () => (levels ? confirmLevelBlock() : confirmStart(pick)), "primary"));
  content.append(choice("Play", [["levels", "Levels"], ["free", "Free play"]], track, v => { setTrack(v); openMenu(); }));
  if (levels) content.append(levelList());
  else {
    content.append(choice("Block", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
    if (pick === "random") content.append(mirror("Size", $("size")), readingsChoice());
    else content.append(line(`Today's block is ${SIZES[DAILY.size].label.toLowerCase()}, seams marked: the same for everyone.`));
  }
  if (view) part(body, "settings").append(action("Reset the view", () => { view.setView(NaN, NaN); write(VIEW, null); }, "link"));
  const about = part(body, "about");
  if (levels) {
    const cleared = camp.stars.filter(Boolean).length;
    about.append(line(`${cleared} of ${COUNT} levels cleared, ${plural(camp.stars.reduce((a, b) => a + b, 0), "star")}. Three stars within the par, two within twice it.`));
  } else {
    const best = S ? read(TIMES, {})[bestKey(S)] : null, mine = S ? `${SIZES[S.size].label}, ${READINGS[S.readings].toLowerCase()}` : "";
    about.append(line(S ? `${mine}: ${best != null ? `best ${fmt(best)}` : "not cleared yet"}. Strikes cost ${STRIKE} s, hints ${HINT} s.` : "A block of rock, a reading on every row."));
  }
  about.append(action("Copy a link to this one", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (started() && !confirm("Start a new block? This one isn't cleared.")) return false;
  start(mode);
  return true;
}
/** Another block of the level being played. */
function confirmLevelBlock() {
  if (started() && !confirm("Start a new block of this level? This one isn't cleared.")) return false;
  levelBlock(camp.at, true);
  return true;
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- the block under a finger: a tap works the tool, a drag turns the block ----------
stage.addEventListener("pointerdown", e => {
  if (e.button > 0 || !view) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ }
  for (const g of fingers.values()) g.moved = true;                         // a second finger is not a tap
  const cube = !S || S.run.done || IN_FRAME || paused ? -1 : view.pick(e.clientX, e.clientY);
  fingers.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, cube, moved: fingers.size > 0 });
  if (cube >= 0) view.focus(cube);                                          // pressed: its three rows light up
});
addEventListener("pointermove", e => {
  const g = fingers.get(e.pointerId);
  if (!g) return;
  if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 9 * scale()) { g.moved = true; view.focus(-1); }
  if (g.moved && fingers.size === 1) view.orbit(-(e.clientX - g.x) * 0.0085, (e.clientY - g.y) * 0.0055);
  g.x = e.clientX; g.y = e.clientY;
});
function lift(e) {
  const g = fingers.get(e.pointerId);
  if (!g) return;
  fingers.delete(e.pointerId);
  if (g.moved || e.type === "pointercancel") {
    view.focus(-1);
    if (g.moved && !fingers.size && !IN_FRAME) write(VIEW, view.angles);
    return;
  }
  if (g.cube >= 0) { tapCube(g.cube); view.focus(g.cube, 1400); }
}
addEventListener("pointerup", lift);
addEventListener("pointercancel", lift);
stage.addEventListener("contextmenu", e => e.preventDefault());

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "survey");
document.querySelector(".sv-mark").innerHTML = APPS.find(a => a.id === "survey").logo;
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("menuBtn").addEventListener("click", openMenu);
$("levelBtn").addEventListener("click", openMenu);
$("nextBtn").addEventListener("click", () => {
  if (duel.on) duel.open();
  else if (isLevel(S)) { if (S.level + 1 < COUNT && isOpen(S.level + 1)) playLevel(S.level + 1); else openMenu(); }
  else start("random");
});
$("size").addEventListener("change", () => {
  if (duel.on) { if (!duel.newMatch()) $("size").value = duel.match?.size || "small"; return; }   // a new match at that size, for everyone
  if (S && $("size").value === S.size && S.mode !== "daily") return;
  if (!confirmStart("random")) $("size").value = S?.size || "small";
});
for (const b of $("tools").querySelectorAll("[data-tool]")) b.addEventListener("click", () => { tool = b.dataset.tool; message = null; render(); });
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); view?.redraw(); duel.resync(); } });
window.addEventListener("pageshow", e => { if (e.persisted) duel.resync(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const b = hashBlock(); if (!duel.on && b && !same(S, b)) begin(b); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

/** The block a link names (#s=SEED&z=SIZE&r=READINGS, #d= for a day's, #l=LEVEL&s=SEED for a level's, if it is open), or null. */
function hashBlock() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  if (h.has("l")) {
    const level = Number(h.get("l"));
    return Number.isInteger(level) && level >= 0 && level < COUNT && isOpen(level) ? { seed, mode: "level", level, size: null, readings: LEVELS[level].kind } : null;
  }
  return { seed, mode: h.get("d") ? "daily" : "random", size: SIZES[h.get("z")] ? h.get("z") : "small", readings: READINGS[h.get("r")] ? h.get("r") : "seams" };
}
const same = (a, b) => !!a && a.seed === b.seed && a.mode === b.mode && a.size === b.size && a.readings === b.readings && a.level === b.level;
/** The saved block, drawn as it was. */
function load() {
  const { run, fresh, ...block } = S;
  begin(block, run, { fresh });
}

// for tests and debugging
window.__survey = {
  get state() { return S; }, get puzzle() { return P; }, get view() { return view; }, get tool() { return tool; },
  tapCube, useHint, start, playLevel, setTrack, setTool: t => { tool = t; render(); }, duel,
  get camp() { return camp; }, get track() { return track; },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's block, still to play
function solo() {
  S = savedGame();
  const b = hashBlock();
  if (b && !same(S, b)) { begin(b); return; }                // a link's block, unless it is the saved one
  if (forToday && !IN_FRAME) {                               // today's is a free block: the one in hand, if it is today's, else a new one after asking about the one begun
    const free = read(RUN, null), mine = valid(free) && !free.duel && !isLevel(free) ? free : null;
    if (mine?.mode === "daily" && mine.seed === today()) { track = "free"; write(TRACK, track); S = mine; load(); return; }
    if (!startedRun(mine) || confirm("Today's block is waiting. Leave the one you've started?")) { start("daily"); return; }
  }
  resume();
}
// a match in the address: its block, with no solo one dealt under it
if (duel.inAddress) duel.join().then(ok => { if (!ok) solo(); });
else solo();
