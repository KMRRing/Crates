// Bridges: join islands with one or two straight bridges, none crossing, until every island has as many bridges as its
// number and all the islands are one network. The rules, the puzzles and the reasoning are bridges-engine.js's (every
// puzzle has one answer, and is graded by the hardest step a person needs); the puzzles are made in bridges-worker.js.
// This file keeps the run, the clock and the taps, and draws the board.
import { SIZES, LEVELS, DAILY, puzzleOf, generate, nextMark, withMark, solvedBy, crossed, breaks, hintFor, levelOn } from "./bridges-engine.js";
import { scale } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { today, noteDayTime, arrivedForToday, IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { busy } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "bridges:run", TIMES = "bridges:times", PREFS = "bridges:prefs", SPARES = "bridges:spares";
const HINT = 30;                     // seconds a hint adds
const SAVE_EVERY = 5000;             // ms between saves of a puzzle in play (a partner watching sees it that often)
const HOLD = 430;                    // ms a press takes to clear a link instead of adding a bridge
const REACH = 0.32;                  // how far from a link, in cells, a finger still means that link
const DISC = 0.36;                   // an island's radius, in cells: a finger on an island means no link

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Seconds as 1:05 (or 1:02:05). */
const fmt = secs => { const s = Math.max(0, Math.round(secs)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`; };
const kindText = k => `${k.size}×${k.size} · ${LEVELS[k.level]}`;
const kindKey = k => `${k.size}:${k.level}`;

// ---------- what you chose ----------
const prefs = { size: 9, level: "easy", ...read(PREFS, {}) };
if (!SIZES.includes(prefs.size)) prefs.size = 9;
if (!LEVELS[prefs.level]) prefs.level = "easy";
const savePrefs = () => { if (!IN_FRAME) write(PREFS, prefs); };
const chosenKind = () => ({ size: prefs.size, level: levelOn(prefs.size, prefs.level) });

// ---------- making puzzles ----------
// Made in a worker, so the screen stays responsive, and a spare of each kind played lately is made in the background
// and kept, so a new puzzle is instant. Where there's no worker they're made on the page, as Hitori's are.
let worker = null, workerless = false, asked = 0;
const waiting = new Map();
function make(seed, k) {
  if (workerless) return Promise.resolve(generate(seed, k.size, k.level));
  try {
    worker ||= new Worker(new URL("./bridges-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = e => { waiting.get(e.data.id)?.resolve(e.data.puzzle); waiting.delete(e.data.id); };
    worker.onerror = () => {
      workerless = true; worker = null;
      for (const w of waiting.values()) w.resolve(generate(w.seed, w.k.size, w.k.level));
      waiting.clear();
    };
  } catch { workerless = true; return Promise.resolve(generate(seed, k.size, k.level)); }
  const id = ++asked;
  return new Promise(resolve => { waiting.set(id, { resolve, seed, k }); worker.postMessage({ id, seed, size: k.size, level: k.level }); });
}
const SPARE_KINDS = 6;                 // spares kept for the kinds played most lately
function takeSpare(k) {
  const all = read(SPARES, {}), spare = all[kindKey(k)];
  if (!spare?.puzzle?.grid) return null;
  delete all[kindKey(k)];
  write(SPARES, all);
  return spare;
}
let refilling = false;
function refill(k) {
  if (IN_FRAME || refilling || read(SPARES, {})[kindKey(k)]) return;
  refilling = true;
  const seed = randomSeed();
  make(seed, k).then(puzzle => {
    refilling = false;
    if (!puzzle) return;
    const all = read(SPARES, {});
    all[kindKey(k)] = { seed, puzzle, at: Date.now() };
    const keys = Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0));
    for (const old of keys.slice(SPARE_KINDS)) delete all[old];
    write(SPARES, all);
  });
}
/** A new puzzle of a kind: the spare if there is one (instant), else made now, the rete showing if it takes a moment. */
async function nextPuzzle(k) {
  const spare = takeSpare(k);
  if (spare) { setTimeout(() => refill(k), 400); return spare; }
  const seed = randomSeed(), done = busy("Making the puzzle", { delay: 250 });
  try { return { seed, puzzle: await make(seed, k) }; } finally { done(); setTimeout(() => refill(k), 400); }
}

// ---------- the run ----------
// S: { v, mode ("random" or "daily"), seed, size, level (asked), came (what it graded), grid, sol, marks, undo, redo, ms,
//      hints, done ({ ms, score } once solved), lit (a hint's links, its island and its words), fresh (a new best) }
let S = null, P = null;
let clockFrom = null, savedAt = 0, message = null, paused = false;
const valid = s => !!s && s.v === 1 && SIZES.includes(s.size) && typeof s.grid === "string" && typeof s.marks === "string"
  && typeof s.sol === "string" && s.sol.length === s.marks.length && s.grid.length === s.size * s.size && Number.isFinite(s.ms);

function save() {
  if (IN_FRAME || !S) return;
  write(RUN, S);
  savedAt = performance.now();
}
const started = () => !!S && !S.done && (/[12]/.test(S.marks) || S.hints > 0);

/** Puts a puzzle on the board. */
function begin(s) {
  S = { v: 1, undo: [], redo: [], ms: 0, hints: 0, done: null, lit: null, ...s };
  P = puzzleOf(S.size, S.grid, S.sol);
  message = null; clockFrom = null;
  $("level").value = levelOn(S.size, S.level);
  if (!IN_FRAME) history.replaceState(null, "", hashOf(S));
  drawBoard();
  save();
  clockRun();
  render();
}
/** A new solo puzzle: today's, or a random one of the kind chosen. */
async function start(mode, k = chosenKind()) {
  if (IN_FRAME) return;
  if (mode === "daily") {
    const done = busy("Making today's puzzle", { delay: 250 });
    let puzzle;
    try { puzzle = await make(today(), DAILY); } finally { done(); }
    if (puzzle) begin(fromPuzzle("daily", today(), DAILY, puzzle));
    return;
  }
  const { seed, puzzle } = await nextPuzzle(k);
  if (puzzle) begin(fromPuzzle("random", seed, k, puzzle));
}
const fromPuzzle = (mode, seed, k, puzzle) => ({ mode, seed, size: k.size, level: k.level, came: puzzle.level, grid: puzzle.grid, sol: puzzle.sol, marks: "0".repeat(puzzle.sol.length) });
function confirmStart(mode, k) {
  if (started() && !confirm("Start a new puzzle? This one isn't solved.")) return false;
  start(mode, k);
  return true;
}

// ---------- the clock ----------
// A puzzle counts the time it's on screen (S.ms); it stands while the menu, the rules or the games screen is open.
function clockRun() {
  if (IN_FRAME || !S || S.done || clockFrom != null || document.hidden || isPaused()) return;
  clockFrom = performance.now();
}
function clockPause() {
  if (clockFrom == null) return;
  S.ms += performance.now() - clockFrom;
  clockFrom = null;
  save();
}
onPause(() => { paused = true; clockPause(); cancelPress(); }, () => { paused = false; clockRun(); });
const elapsed = () => (!S ? 0 : S.done ? S.done.ms : S.ms + (clockFrom != null ? performance.now() - clockFrom : 0));
const penalty = () => HINT * (S?.hints || 0);
const scoreOf = ms => Math.round(ms / 1000) + penalty();

// ---------- bests ----------
// Kept in bridges:times by size and level, lowest first, not bridges:best (the games screen reads a best as
// highest-is-best); the games screen's figure is today's time (noteDayTime, bridges:today).
const bestOf = s => read(TIMES, {})[kindKey({ size: s.size, level: s.came || s.level })];
function recordBest(sc) {
  const times = read(TIMES, {}), k = kindKey({ size: S.size, level: S.came || S.level }), fresh = times[k] == null || sc < times[k];
  if (fresh) { times[k] = sc; write(TIMES, times); }
  return fresh;
}

// ---------- marks ----------
/** A tap adds a bridge to the link (none, one, two, none); a hold clears it. */
function press(l, how) {
  if (!S || S.done || IN_FRAME || paused || l < 0) return;
  const from = S.marks[l], to = how === "hold" ? "0" : nextMark(from);
  if (to !== "0" && from === "0" && crossed(P, S.marks, l)) { note("A bridge there would cross another.", "bad"); render(); return; }
  setLink(l, from, to);
  if (to !== "0") navigator.vibrate?.(8);
}
function setLink(l, from, to, undoable = true) {
  if (from === to) return;
  S.marks = withMark(S.marks, l, to);
  if (undoable) { S.undo.push([l, from, to]); if (S.undo.length > 400) S.undo.shift(); S.redo = []; }
  S.lit = null;
  changed(l);
}
function undo() {
  const last = S?.undo.pop();
  if (!last || S.done) return;
  const [l, from, to] = last;
  S.redo.push(last);
  setLink(l, to, from, false);
}
function redo() {
  const next = S?.redo.pop();
  if (!next || S.done) return;
  const [l, from, to] = next;
  S.undo.push(next);
  setLink(l, from, to, false);
}
/** After any change: the line says what broke (from the rules alone, never the answer), the end is settled the moment
 *  the bridges are the answer, and the run is kept. */
function changed(at = -1) {
  const br = breaks(P, S.marks), { a, b } = at >= 0 ? P.lay.links[at] : {};
  if (at >= 0 && S.marks[at] !== "0") {
    if (br.over.includes(a) || br.over.includes(b)) note("An island has more bridges than its number.", "bad");
    else if (br.cut.includes(a) || br.cut.includes(b)) note("That group has all its bridges, and the other islands aren't joined to it.", "bad");
    else message = null;
  } else if (at >= 0) message = null;
  if (!S.done && solvedBy(P, S.marks)) finish();
  else save();
  paint();
  render();
}
function note(text, tone = "") { message = text ? { text, tone } : null; }

// ---------- hints ----------
/** A step of reasoning in words, as a hint says it. */
function explain(x) {
  const n = P.lay.isl[x.at].n, bridges = plural(x.to, "bridge");
  switch (x.tech) {
    case "all": return `The ${n} here needs every bridge its links can carry: this link takes ${x.to === 2 ? "two" : "one"}.`;
    case "need": return `The other links of this ${n} can't carry enough, so this link has at least ${bridges}.`;
    case "trial": return `Suppose this link had ${x.supposed === 0 ? "no bridge" : plural(x.supposed, "bridge")} at most: the rules break. So it has at least ${bridges}.`;
  }
  return "";
}
function useHint() {
  if (!S || S.done || IN_FRAME || paused) return;
  const h = hintFor(P, S.marks);
  if (!h) return;
  S.hints++;
  let link, to, island = null, text;
  if (h.wrong != null) {
    ({ wrong: link, should: to } = h);
    text = to === "0" ? "Hint: there is no bridge here. It is cleared now." : "Hint: this link has fewer bridges than that. It is put right now.";
  } else if (h.step) {
    ({ link, at: island } = h.step);
    to = String(h.step.to);
    const said = explain(h.step);
    text = `Hint: ${said[0].toLowerCase()}${said.slice(1)}`;
  } else {
    ({ reveal: link, should: to } = h);
    text = "Hint: this link has a bridge, or two.";
  }
  setLink(link, S.marks[link], to);
  S.lit = { set: [link], island, text };
  message = null;
  save();
  paint();
  render();
}

// ---------- the end ----------
function finish() {
  const ms = S.ms + (clockFrom != null ? performance.now() - clockFrom : 0);
  clockFrom = null;
  S.done = { ms, score: scoreOf(ms) };
  S.lit = null;
  S.fresh = recordBest(S.done.score);
  if (S.mode === "daily") noteDayTime("bridges", S.done.score, S.seed);       // today's puzzle: the first solve's time
  save();
  roundOver("bridges");
  wave();
}

// ---------- the board ----------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); parent?.appendChild(n); return n; };
/** The numbers are set a hundred times larger and scaled back down, centred by an explicit offset: Safari lays out text
 *  under a unit tall badly (as Hitori's and Delta's are). */
const TEXT_SCALE = 100;
let svg = null, linkEls = [], islEls = [], seg = [];
function drawBoard() {
  const { size, lay } = P, pad = 0.3, at = i => [lay.isl[i].c + 0.5, lay.isl[i].r + 0.5];
  svg = svgEl("svg", { viewBox: `${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`, role: "img", "aria-label": `${kindText(S)}: the board. Tap a link between two islands to build a bridge.`, class: "brg-svg" });
  svgEl("rect", { x: -pad / 2, y: -pad / 2, width: size + pad, height: size + pad, rx: 0.12, class: "brg-paper" }, svg);
  seg = lay.links.map(l => { const [x1, y1] = at(l.a), [x2, y2] = at(l.b); return { x1, y1, x2, y2 }; });
  linkEls = lay.links.map((l, i) => {
    const { x1, y1, x2, y2 } = seg[i], g = svgEl("g", { class: "brg-l" }, svg), dx = l.vertical ? 0.09 : 0, dy = l.vertical ? 0 : 0.09;
    svgEl("line", { x1, y1, x2, y2, class: "brg-guide" }, g);
    svgEl("line", { x1, y1, x2, y2, class: "brg-b brg-one" }, g);
    for (const s of [-1, 1]) svgEl("line", { x1: x1 + s * dx, y1: y1 + s * dy, x2: x2 + s * dx, y2: y2 + s * dy, class: "brg-b brg-two" }, g);
    return { g, d: Math.round((x1 + y1) * 40) };
  });
  islEls = lay.isl.map(({ n }, i) => {
    const [x, y] = at(i), g = svgEl("g", { class: "brg-i" }, svg);
    svgEl("circle", { cx: x, cy: y, r: DISC, class: "brg-disc" }, g);
    const t = svgEl("text", { x: 0, y: 0, dy: "0.36em", class: "brg-num", "font-size": 0.5 * TEXT_SCALE, transform: `translate(${x} ${y}) scale(${1 / TEXT_SCALE})` }, g);
    t.textContent = String(n);
    return g;
  });
  $("board").replaceChildren(svg);
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("contextmenu", e => e.preventDefault());
  paint();
}
/** Each link's look from the run (its bridges, a hint's, the wave) and each island's (met, over, shut off, a hint's). */
function paint() {
  if (!svg || !S) return;
  const br = breaks(P, S.marks), over = new Set(br.over), met = new Set(br.met), cut = new Set(br.cut), lit = new Set(S.lit?.set || []);
  linkEls.forEach(({ g }, l) => {
    const cls = ["brg-l", S.marks[l] === "1" ? "c1" : S.marks[l] === "2" ? "c2" : "", lit.has(l) ? "lit" : ""].filter(Boolean).join(" ");
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
  });
  islEls.forEach((g, i) => {
    const cls = ["brg-i", over.has(i) ? "over" : met.has(i) ? "met" : "", cut.has(i) ? "cut" : "", S.lit?.island === i ? "why" : ""].filter(Boolean).join(" ");
    if (g.getAttribute("class") !== cls) g.setAttribute("class", cls);
  });
}
/** The solve, shown: the bridges turn gilt from the top left. */
function wave() {
  if (!svg) return;
  svg.classList.remove("solved");
  void svg.getBoundingClientRect();
  linkEls.forEach(({ g, d }) => g.style.setProperty("--d", `${d}ms`));
  svg.classList.add("solved");
}

// ---------- the board under a finger: a tap adds a bridge, a hold clears the link ----------
let pressing = null;   // { id, link, x, y, timer, held }
const toCells = ev => {
  const m = svg?.getScreenCTM();
  return m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()) : null;
};
/** The link nearest a finger, if one is close enough and the finger isn't on an island. */
function linkAt(ev) {
  const pt = toCells(ev);
  if (!pt) return -1;
  let best = -1, d2 = REACH * REACH;
  for (let l = 0; l < seg.length; l++) {
    const { x1, y1, x2, y2 } = seg[l];
    if (Math.hypot(pt.x - x1, pt.y - y1) < DISC + 0.04 || Math.hypot(pt.x - x2, pt.y - y2) < DISC + 0.04) continue;   // on an island
    const cx = Math.min(Math.max(pt.x, Math.min(x1, x2)), Math.max(x1, x2)), cy = Math.min(Math.max(pt.y, Math.min(y1, y2)), Math.max(y1, y2));
    // a link no bridge can go on (another crosses it) loses a tie where two meet, so the tap lands on the one that can be built
    const d = (pt.x - cx) ** 2 + (pt.y - cy) ** 2 + (S.marks[l] === "0" && crossed(P, S.marks, l) ? 0.05 : 0);
    if (d < d2) { d2 = d; best = l; }
  }
  return best;
}
function down(ev) {
  if (ev.button > 0) { if (ev.button === 2) press(linkAt(ev), "hold"); return; }
  if (!S || S.done || IN_FRAME || paused) return;
  ev.preventDefault();
  cancelPress();
  const link = linkAt(ev);
  if (link < 0) return;
  try { svg.setPointerCapture(ev.pointerId); } catch { /* a synthetic event */ }
  pressing = { id: ev.pointerId, link, x: ev.clientX, y: ev.clientY, held: false };
  pressing.timer = setTimeout(() => { if (!pressing) return; pressing.held = true; navigator.vibrate?.(14); press(pressing.link, "hold"); }, HOLD);
}
function cancelPress() { if (pressing) clearTimeout(pressing.timer); pressing = null; }
addEventListener("pointermove", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  if (Math.hypot(ev.clientX - pressing.x, ev.clientY - pressing.y) > 12 * scale()) cancelPress();   // a slip off the link is no tap
});
addEventListener("pointerup", ev => {
  if (!pressing || ev.pointerId !== pressing.id) return;
  const { link, held } = pressing;
  cancelPress();
  if (!held) press(link, "tap");
});
addEventListener("pointercancel", cancelPress);

// ---------- drawing the rest ----------
const shown = {};
const put = (id, v) => { if (shown[id] !== v) { shown[id] = v; $(id).textContent = v; } };
function drawStrip() {
  if (!S) { put("time", "0:00"); put("penalty", ""); put("kind", ""); return; }
  put("time", fmt(elapsed() / 1000 + penalty()));
  put("penalty", penalty() ? `+${penalty()} s` : "");
  put("kind", `${S.mode === "daily" ? "Today · " : ""}${kindText({ size: S.size, level: S.came || S.level })}`);
}
function drawLine() {
  const l = $("line");
  let text, tone = "";
  if (!S) text = "";
  else if (S.lit) { text = S.lit.text; tone = "good"; }
  else if (message) { text = message.text; tone = message.tone; }
  else if (S.came && S.came !== S.level && !/[12]/.test(S.marks)) text = `No ${LEVELS[S.level]} puzzle came of this size this time: this one is ${LEVELS[S.came]}.`;
  else if (!/[12]/.test(S.marks)) text = "Tap the dotted line between two islands to build a bridge, again for a second, again to clear it. Hold to clear.";
  else text = "Every island with as many bridges as its number, all of them joined, no bridge crossing another.";
  if (l.textContent !== text) l.textContent = text;
  l.className = `brg-say${tone ? ` ${tone}` : ""}`;
}
function drawResult() {
  const done = !!S?.done;
  $("controls").hidden = done;
  $("result").hidden = !done;
  if (!done) return;
  const d = S.done, bits = [`${fmt(d.ms / 1000)} on the clock`], best = bestOf(S);
  if (S.hints) bits.push(`${plural(S.hints, "hint")} (+${penalty()} s)`);
  const tail = S.fresh ? " A new best." : best != null ? ` Your best here: ${fmt(best)}.` : "";
  $("verdict").textContent = `Solved: ${fmt(d.score)}. ${bits.join(", ")}.${tail}`;
}
function render() {
  const off = !S || !!S.done || IN_FRAME;
  for (const b of [$("undoBtn"), $("redoBtn"), $("hintBtn")]) b.disabled = off;
  if (S && !off) { $("undoBtn").disabled = !S.undo.length; $("redoBtn").disabled = !S.redo.length; }
  if (!S) $("board").replaceChildren();
  drawStrip(); drawLine(); drawResult();
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
// the rules: a sheet of their own, from the header's Rules and the menu
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Join the islands with bridges until every island has exactly as many bridges as its number and all the islands are one network. Every puzzle has exactly one answer, reached by reasoning, never by a guess.</p>
    <h4>The rules</h4>
    <p>A bridge runs straight, in a row or a column, from an island to the next island along it. There may be one or two bridges between a pair of islands, never three, and bridges never cross each other or pass over an island. Every island ends up with as many bridges as its number, and you can walk from any island to any other over the bridges.</p>
    <p><b>An example.</b> A 1 beside a 1 can't be joined to it, or the two would be shut off together from the rest. An island that has only one way out takes all its bridges there. And an 8 has a double bridge in each of its four directions.</p>
    <h4>Playing</h4>
    <p>Tap the dotted line between two islands to build a bridge, again to make it double, again to clear it; hold a link, or right-click it, to clear it at once. A bridge can't be built across another. The puzzle is solved the moment exactly its answer is built. Undo and Redo step through your marks, and the menu clears the board.</p>
    <p>A broken rule shows at once, the line under the board saying which: an island with too many bridges in oxblood, a group that has all its bridges while other islands are left out ringed. That comes from the rules, never the answer. An island turns blue once it has its number. Hint (+${HINT}&nbsp;s) puts a wrong bridge right first; otherwise it makes the next step a person would take and says why, the link it settled in gilt and the island that says so ringed.</p>
    <h4>Levels</h4>
    <p>A puzzle's level is the hardest step it needs, never how many islands it has. <b>Easy</b>: each island's number alone, and what can't cross (an island whose links can only just carry its number takes every bridge they can; one whose other links are too few takes the rest here). <b>Medium</b>: that the islands must all be joined too (a group with all its bridges can't be left on its own, so no bridge may shut one off). <b>Hard</b>: a trial as well, a link supposed to have at most so many bridges and followed until a rule breaks. When no puzzle of the level comes of a size, the nearest is dealt and the line says so.</p>
    <h4>Time</h4>
    <p>Your score is your time plus ${HINT} seconds a hint; lower is better, and your best is kept for each size and level. The clock stops while the menu, these rules or the games screen is open.</p>
    <h4>Today's puzzle</h4>
    <p>A 9×9 at Medium, the same for everyone. Its first solve counts the moment the bridges are the answer, and is Bridges' figure on the games screen.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
  $("rulesDlg").scrollTop = 0;                       // from the top each time, not where it was last left
}

// the menu: Play (a new puzzle, clearing the board, the rules), Content (random or today's, the size, the level), About
let pick = null;                                              // what New puzzle starts: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const content = part(body, "content");
  pick ??= S?.mode === "daily" ? "daily" : "random";
  const play = part(body, "play");
  play.append(action("New puzzle", () => confirmStart(pick), "primary"));
  if (S && !S.done && started()) play.append(action("Clear the board", clearBoard));
  play.append(action("The rules", showRules, "link"));
  content.append(choice("Puzzle", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; openMenu(); }));
  if (pick === "random") {
    content.append(choice("Size", SIZES.map(n => [n, `${n}×${n}`]), prefs.size, v => { prefs.size = v; savePrefs(); kindChanged(); openMenu(); }));
    content.append(mirror("Level", $("level")));
  } else content.append(line(`Today's puzzle is ${kindText(DAILY)}: the same for everyone.`));
  const best = S ? bestOf(S) : null;
  part(body, "about").append(
    line(S ? `${kindText({ size: S.size, level: S.came || S.level })}: ${best != null ? `best ${fmt(best)}` : "not solved yet"}.` : "Join the islands."),
    action("Copy a link to this puzzle", copyLink, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
/** The size changed in the menu: the header's level follows, and a spare is made ready. */
function kindChanged() {
  const k = chosenKind();
  $("level").value = k.level;
  refill(k);
}
function clearBoard() {
  if (!S || S.done) return;
  if (!confirm("Clear every bridge on the board?")) return;
  for (let l = 0; l < S.marks.length; l++) if (S.marks[l] !== "0") setLink(l, S.marks[l], "0");
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}

// ---------- links: #s=SEED&n=9&l=medium (#d= for a day's) ----------
const hashOf = s => `#${s.mode === "daily" ? "d" : "s"}=${s.seed}&n=${s.size}&l=${s.level}`;
function linked() {
  const h = new URLSearchParams(location.hash.slice(1)), seed = Number(h.get("d") || h.get("s"));
  if (!seed) return null;
  const size = SIZES.includes(Number(h.get("n"))) ? Number(h.get("n")) : 9;
  return { seed, mode: h.get("d") ? "daily" : "random", k: { size, level: levelOn(size, LEVELS[h.get("l")] ? h.get("l") : "medium") } };
}
async function openLinked(l) {
  const done = busy("Making the puzzle", { delay: 250 });
  let puzzle;
  try { puzzle = await make(l.seed, l.k); } finally { done(); }
  if (puzzle) begin(fromPuzzle(l.mode, l.seed, l.k, puzzle));
}

// ---------- wiring ----------
dropdown($("level"));   // the header dropdown in the suite's style (see dropdown.js)
bindSwitcher($("appsBtn"), "bridges");
document.querySelector(".brg-mark").innerHTML = APPS.find(a => a.id === "bridges")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("nextBtn").addEventListener("click", () => start("random"));
$("level").addEventListener("change", () => {
  const v = $("level").value;
  if (S && S.mode !== "daily" && v === S.level && S.size === prefs.size) return;
  const before = prefs.level;
  prefs.level = v; savePrefs();
  if (!confirmStart("random")) { prefs.level = before; savePrefs(); $("level").value = S ? levelOn(S.size, S.level) : before; }
});
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("hintBtn").addEventListener("click", useHint);
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else clockRun(); });
window.addEventListener("pagehide", () => clockPause());
window.addEventListener("hashchange", () => { const l = linked(); if (l && !(S && S.seed === l.seed && S.mode === l.mode)) openLinked(l); });
setInterval(() => {
  if (!S) return;
  drawStrip();
  if (clockFrom != null && performance.now() - savedAt > SAVE_EVERY) { clockPause(); clockRun(); }
}, 250);

// for tests and debugging
window.__bridges = {
  get state() { return S; }, get puzzle() { return P; }, press, useHint, undo, redo, start, linkAt,
  /** Where a link's middle is on the screen, for tests that tap it as a finger would. */
  screenOf: l => {
    const m = svg.getScreenCTM(), { x1, y1, x2, y2 } = seg[l], x = (x1 + x2) / 2, y = (y1 + y2) / 2;
    return { x: x * m.a + m.e, y: y * m.d + m.f };
  },
};

const forToday = arrivedForToday();   // from the games screen's tile: today's puzzle, still to play
/** Your own puzzle: a link's, today's from the tile, the saved one, or a first puzzle. */
function solo() {
  const kept = read(RUN, null);
  S = null;
  if (valid(kept)) S = kept;
  const l = linked();
  if (l && !(S && S.seed === l.seed && S.mode === l.mode && S.size === l.k.size)) { openLinked(l); return; }
  if (forToday && !IN_FRAME && !(S?.mode === "daily" && S.seed === today())) {
    if (!started() || confirm("Today's puzzle is waiting. Leave the one you've started?")) { start("daily"); return; }
  }
  if (S) { const s = S; S = null; begin(s); if (!IN_FRAME) refill(chosenKind()); }
  else if (IN_FRAME) render();
  else start("random");
}
$("level").value = chosenKind().level;
solo();
