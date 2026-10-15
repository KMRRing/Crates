// Manifest: each round opens with an order book (the questions to come, by kind, with prices); the stack comes in,
// holds (ship it early for a bonus) and is gone; then the questions open: answer any, pass any. Change rounds bring
// the stack back after a blank stage with something different. The engine (manifest-engine.js) makes the rounds;
// this file shows them and takes the answers. Together, a table of two to six plays the rounds in step, against each
// other or as one team (together.js carries the room; the table's rules are the engine's last part).
import { LIVES, ROUNDS, COLOURS, VIEWS, KINDS, makeRound, priceOf, skillFactor, recordAfter, shipBonus, turn, cubeFaces, drawOrder, isoPoint, visibleSet, boxFor,
  dropTimes, LANDING, MODES, timeline, partCells, freshTable, isTable, stageOf, roundOf, partFor, livesOf, playing, repliesOf, firstOpen, waitingFor, sayReady, goOn, reply,
  ship as shipIn, settleIfDue, setNext, again, scoresOf, verdicts, resultOf, bonusAt } from "./manifest-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)
import { createTogether } from "./together.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { presentSlots } from "./duel-core.js";
import { leaderboard } from "./standings.js";
import { busy, sextant } from "./loading.js";

const $ = id => document.getElementById(id);
const RUN = "manifest:run2", BEST = "manifest:best", DAILY = "manifest:daily", RECORD = "manifest:record";
const SVG = "http://www.w3.org/2000/svg";

// S: { seed, mode, round, score, lives, right, wrong, passed, phase: "orders" | "show" | "ask" | "review" | "over",
//      prices, answers: { [order]: { given, right, paid } }, skipped: [order], judged, bonus }
// At a table, S is the round in hand in the same shape, made from the room (tableS), for the same drawing.
let S = null;
let R = null;                 // the current round from the engine
let showTimer = null, holdStart = 0;
let picked = [];              // a swap round: the containers tapped so far

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => { if (!T) write(RUN, S); };           // a table's round lives in the room, never in your run
const money = n => n.toLocaleString("en-GB");
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
try { localStorage.removeItem("manifest:duel"); } catch { /* private mode */ }   // the head-to-head's kept run, read no more

// ---------- the run ----------
function start(mode) {
  S = { seed: mode === "daily" ? today() : randomSeed(), mode, round: 1, score: 0, lives: LIVES, right: 0, wrong: 0, passed: 0 };
  history.replaceState(null, "", mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`);
  openRound();
}
/** A new round: its order book, priced by the round and your record, before the stack comes in. */
function openRound() {
  R = makeRound(S.seed, S.round);
  const record = read(RECORD, {});
  Object.assign(S, { phase: "orders", answers: {}, skipped: [], judged: false, bonus: 1,
    prices: R.orders.map(o => priceOf(o.type, S.round, record[o.type])),
    trend: R.orders.map(o => { const f = skillFactor(record[o.type]); return f < 0.9 ? "↓" : f > 1.1 ? "↑" : ""; }) });
  save();
  drawOrders();
}
/** Whether the stage shows the stack: the questions get its room when there's nothing to show. */
const viewOn = on => $("stage").classList.toggle("no-view", !on);
function drawOrders() {
  drawHud();
  title();
  clear();
  viewOn(false);
  fillBook(R.level.change
    ? "Watch the stack: it will vanish and come back with something different."
    : "The questions to come. Answer any, pass any; a wrong answer costs a life.");
  go("Bring it in", showStack);
}
/** The order book: a line of what's coming, then each order's kind, what it asks about and its price. */
function fillBook(intro) {
  const book = $("book");
  book.className = "mf-book";
  book.append(node("p", "intro", intro));
  R.orders.forEach((o, i) => {
    const row = node("div", "mf-order"), left = node("div");
    left.append(node("b", null, KINDS[o.type].name), node("span", null, o.posted));
    const price = node("span", "mf-price", money(S.prices[i]));
    if (S.trend[i]) price.appendChild(node("small", null, S.trend[i]));
    row.append(left, price);
    book.appendChild(row);
  });
}
/** While the stack's on the stage, the order book is a strip of chips: each kind and its price. */
function bookStrip() {
  const book = $("book");
  book.className = "mf-book strip";
  R.orders.forEach((o, i) => { const c = node("span", "mf-chiplet", KINDS[o.type].name); c.appendChild(node("b", null, money(S.prices[i]))); book.appendChild(c); });
}
/** The containers drop in by the round's order and the stack holds; Ship it ends the hold early, for a bonus. */
function showStack() {
  S.phase = "show";
  save();
  title();
  clear();
  bookStrip();
  const { panel, drops } = stage(R.cells, { drop: R.view });
  viewOn(true);
  $("view").replaceChildren(panel);
  const timer = $("timer");
  clearTimeout(showTimer);
  showTimer = setTimeout(() => {                      // the last one has landed: the clock runs
    timer.hidden = false;
    timer.style.setProperty("--mf-ms", `${R.level.exposure}ms`);
    timer.classList.remove("run"); void timer.offsetWidth; timer.classList.add("run");
    holdStart = performance.now();
    const ship = $("shipBtn");
    ship.hidden = false;
    ship.onclick = () => endShow(1 - (performance.now() - holdStart) / R.level.exposure);
    showTimer = setTimeout(() => endShow(0), R.level.exposure);
  }, drops.last + LANDING);
}
/** The hold is over: the stack flies off (or, in a change round, fades to an empty stage and comes back changed). */
function endShow(left) {
  if (S.phase !== "show") return;
  clearTimeout(showTimer);
  S.bonus = Math.round(shipBonus(left) * 100) / 100;
  $("timer").hidden = true;
  $("shipBtn").hidden = true;
  const panel = $("view").firstChild;
  if (R.level.change) {
    panel.classList.add("fade");
    showTimer = setTimeout(() => {
      $("view").replaceChildren();
      showTimer = setTimeout(() => { S.phase = "ask"; save(); askPhase(true); }, 1000);
    }, 500);
    return;
  }
  panel.classList.add("away");
  showTimer = setTimeout(() => { S.phase = "ask"; save(); askPhase(); }, 380);
}

// ---------- the questions ----------
const answered = () => Object.keys(S.answers).length;
/** The question in hand: the first neither answered nor passed. Questions come one at a time, in the order that gives
 *  least away first, and nothing is judged until the round's review: an answer can't help with the next. */
const current = () => R.orders.findIndex((o, i) => !S.answers[i] && !(S.skipped || []).includes(i));
function askPhase(appear = false) {
  title();
  clear();
  if (S.bonus > 1) shipped();
  drawAsks(appear);
  go(R.orders.length === 1 ? "Pass" : current() > 0 ? "Pass the rest" : "Pass them all", () => reviewPhase());
}
const shipped = () => { $("note").hidden = false; $("note").textContent = `Shipped early: answers pay ×${S.bonus.toFixed(2)}`; };
function drawAsks(appear = false) {
  const at = current();
  $("asks").replaceChildren(...R.orders.map((o, i) => (i === at ? askRow(o, i) : i < at || at < 0 ? doneRow(o, i) : laterRow(o, i))));
  drawAskStage(appear);
}
/** A question behind you: what you gave, or that you passed (at a team's table, who did). Right or wrong waits for the
 *  review. */
function doneRow(o, i) {
  const a = S.answers[i], row = node("div", "mf-row done"), head = node("div", "mf-row-head"), by = S.by?.[i];
  const said = by != null ? `${whoIs(by)}: ${a ? givenText(o.question, a.given) : "passed"}` : a ? `Answered: ${givenText(o.question, a.given)}` : "Passed";
  head.append(node("span", null, o.question.text), node("em", null, said));
  row.appendChild(head);
  return row;
}
/** A question still to come: only what the order book said, its kind and price; its picture and answers stay hidden. */
function laterRow(o, i) {
  const row = node("div", "mf-row later"), head = node("div", "mf-row-head");
  head.append(node("span", null, o.posted), node("em", null, money(Math.round(S.prices[i] * S.bonus))));
  row.appendChild(head);
  return row;
}
const givenText = (q, g) => (q.as === "number" ? String(g) : q.as === "colour" ? COLOURS[g - 1].name.toLowerCase() : q.as === "stack" ? `stack ${g + 1}` : "your pick");
function pass(i) {
  if (T) { tableReply(i, { p: 1 }); return; }
  if (S.phase !== "ask" || S.answers[i] || S.skipped.includes(i)) return;
  S.skipped.push(i);
  save();
  if (current() < 0) { reviewPhase(); return; }
  askPhase();
}
/** A change round's stage: the stack come back, to tap the container that changed (or the two that swapped). Other
 *  rounds need no stage here: each question carries its own picture. */
function drawAskStage(appear = false) {
  const q = R.level.change ? R.orders[0].question : null;
  viewOn(!!q);
  if (!q) { $("view").replaceChildren(); return; }
  const done = S.answers[0];
  const panel = stage(q.back, { turns: q.turns, tap: done ? null : key => tapBack(key), selected: picked, marks: done ? [].concat(q.answer) : [] }).panel;
  if (appear) panel.classList.add("appear");
  $("view").replaceChildren(panel);
}
/** The round's stack turned the way a question turns it. */
const turnedOf = q => turn(R.cells, q.turns);
/** What a question asks about, drawn in its card: the floor with the spot marked, or the stack turned and grey with
 *  one container lit. Each question has its own, so two never share one stage. */
function pictureFor(o) {
  const q = o.question;
  if (o.type === "turned") return stage(turnedOf(q), { turns: q.turns, grey: true, ring: q.at }).panel;
  if (q.cell && q.as === "colour") return stage(R.cells, { blank: true, mark: q.cell }).panel;
  return null;
}
/** The question in hand, as a card with everything needed to answer it at a tap: the words and the price, its picture,
 *  its answers, and a way to pass it. */
function askRow(o, i) {
  const q = o.question, row = node("div", "mf-row");
  const head = node("div", "mf-row-head");
  head.append(node("span", null, q.text), node("em", null, money(Math.round(S.prices[i] * S.bonus))));
  row.appendChild(head);
  const body = node("div", "mf-row-body"), pic = pictureFor(o);
  if (pic) {
    body.classList.add("with-pic");
    const frame = node("div", "mf-pic");
    frame.appendChild(pic);
    body.appendChild(frame);
  }
  if (q.as === "number" || q.as === "colour") {
    const opts = node("div", `mf-answers${q.as === "colour" ? " colours" : ""}`);
    opts.style.setProperty("--n", q.options.length);
    for (const opt of q.options) {
      const b = node("button", `mf-chip${q.as === "colour" ? " colour" : ""}`);
      b.type = "button";
      if (q.as === "colour") { const sw = node("i"); sw.style.background = COLOURS[opt - 1].hex; b.append(sw, COLOURS[opt - 1].name); }
      else b.textContent = String(opt);
      b.addEventListener("click", () => answer(i, opt));
      opts.appendChild(b);
    }
    body.appendChild(opts);
  } else if (q.as === "stack") {
    const grid = node("div", "mf-mini");
    q.stacks.forEach((s, k) => {
      const b = node("button");
      b.type = "button";
      b.setAttribute("aria-label", `Stack ${k + 1}`);
      b.appendChild(stage(s, { turns: q.turns, small: true }).panel);
      b.addEventListener("click", () => answer(i, k));
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }
  if (body.childElementCount) row.appendChild(body);   // a change round's question is answered on the stack itself
  if (R.orders.length > 1) {                           // pass this one and go on to the next
    const p = node("button", "mf-pass", "Pass this one");
    p.type = "button";
    p.addEventListener("click", () => pass(i));
    row.appendChild(p);
  }
  return row;
}
/** A tap on the stack that came back: one container, or two for a swap. */
function tapBack(key) {
  if (S.phase !== "ask" || S.answers[0]) return;
  const q = R.orders[0].question;
  if (q.as === "cell") { answer(0, key); return; }
  picked = picked.includes(key) ? picked.filter(k => k !== key) : [...picked, key];
  if (picked.length === 2) { const given = picked.slice().sort(); picked = []; answer(0, given); return; }
  drawAsks();
}
function answer(i, given) {
  if (T) { tableReply(i, { g: given }); return; }
  if (S.phase !== "ask" || S.answers[i] || S.skipped.includes(i)) return;
  S.answers[i] = { given };
  save();
  if (current() < 0) { reviewPhase(); return; }
  askPhase();
}
/** The round's answers judged together, once, at its review: what each pays, the lives they cost, your record. */
function judge() {
  if (S.judged) return;
  const record = read(RECORD, {});
  R.orders.forEach((o, i) => {
    const a = S.answers[i];
    if (!a) return;
    a.right = JSON.stringify(a.given) === JSON.stringify(o.question.answer);
    a.paid = a.right ? Math.round(S.prices[i] * S.bonus) : 0;
    if (a.right) { S.score += a.paid; S.right++; } else { S.lives = Math.max(0, S.lives - 1); S.wrong++; }
    record[o.type] = recordAfter(record[o.type], a.right);
  });
  if (Object.values(S.answers).some(a => !a.right)) navigator.vibrate?.(70);
  write(RECORD, record);
  S.judged = true;
  drawHud();
}

// ---------- the review ----------
const truthText = q => (q.as === "number" ? String(q.answer) : q.as === "colour" ? COLOURS[q.answer - 1].name.toLowerCase()
  : q.as === "stack" ? `stack ${q.answer + 1}` : q.as === "pair" ? "the two outlined" : "the outlined one");
function reviewPhase(focus = null) {
  judge();
  S.phase = "review";
  save();
  title();
  clear();
  const earned = Object.values(S.answers).reduce((n, a) => n + a.paid, 0);
  $("note").hidden = false;
  $("note").textContent = `This round: +${money(earned)}${S.bonus > 1 ? ` (shipped early, ×${S.bonus.toFixed(2)})` : ""}`;
  $("asks").replaceChildren(...R.orders.map((o, i) => reviewRow(o, i, focus, () => reviewPhase(focus === i ? null : i))));
  viewOn(true);
  $("view").replaceChildren(reviewPanel(focus));
  const last = S.lives <= 0 || S.round >= ROUNDS;
  go(last ? "See how it went" : `Round ${S.round + 1}`, () => {
    S.passed += R.orders.length - answered();             // counted once, as the round is left (passed one by one or all at once)
    if (last) { over(); return; }
    S.round++;
    openRound();
  });
}
/** A question at the review: what it asked and how it went (its pay, or the truth); a tap lights what it asked about. */
function reviewRow(o, i, focus, onTap, said = null) {
  const q = o.question, a = S.answers[i], row = node("div", `mf-row${a ? (a.right ? " right" : " wrong") : ""}${focus === i ? " active" : ""}`);
  const head = node("button", "mf-row-head");
  head.type = "button";
  head.append(node("span", null, q.text), node("em", null, said ?? (a ? (a.right ? `+${money(a.paid)}` : `It was ${truthText(q)}`) : `Passed: ${truthText(q)}`)));
  head.addEventListener("click", onTap);
  row.appendChild(head);
  if (focus === i && q.as === "stack") {
    const grid = node("div", "mf-mini");
    q.stacks.forEach((s, k) => { const b = node("button", k === q.answer ? "good" : a && a.given === k ? "bad" : ""); b.type = "button"; b.disabled = true; b.appendChild(stage(s, { turns: q.turns, small: true }).panel); grid.appendChild(b); });
    const body = node("div", "mf-row-body"); body.appendChild(grid); row.appendChild(body);
  }
  return row;
}
/** The stack again at the review, with whatever the focused question asked about lit. */
function reviewPanel(focus) {
  const o = focus != null ? R.orders[focus] : R.level.change ? R.orders[0] : null, q = o?.question;
  if (q && (q.as === "cell" || q.as === "pair")) return stage(q.back, { turns: q.turns, marks: [].concat(q.answer) }).panel;
  if (q && o.type === "turned") return stage(turnedOf(q), { turns: q.turns, ring: q.at }).panel;
  return stage(R.cells, { mark: q?.cell || null, highlight: q?.colour || (o?.type === "most" ? q.answer : null), tier: q?.tier ?? null }).panel;
}
function over() {
  S.phase = "over";
  save();
  const best = S.mode === "daily" ? bestDaily(S.score) : bestEver(S.score);
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = node(tag, cls, text); body.appendChild(n); return n; };
  add("p", "mf-big", money(S.score));
  const stats = add("div", "mf-stats");
  for (const [v, label] of [[S.lives > 0 ? `${ROUNDS}` : `${S.round}`, S.lives > 0 ? "rounds" : "rounds, out of lives"], [`${S.right}/${S.right + S.wrong}`, `right (${S.passed} passed)`], [money(best), S.mode === "daily" ? "today's best" : "your best"]]) {
    const box = node("div"); box.append(node("b", null, v), node("span", null, label)); stats.appendChild(box);
  }
  const again = add("button", "btn primary wide", "Again");
  again.type = "button"; again.addEventListener("click", () => { $("menuDlg").close(); start("random"); });
  const daily = add("button", "btn wide", S.mode === "daily" ? "A random run" : "Today's run");
  daily.type = "button"; daily.addEventListener("click", () => { $("menuDlg").close(); start(S.mode === "daily" ? "random" : "daily"); });
  $("menuDlg").querySelector("h2").textContent = S.lives > 0 ? "The run's done" : "Out of lives";
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function bestEver(score) { const b = Math.max(read(BEST, 0), score); write(BEST, b); return b; }
function bestDaily(score) { const d = read(DAILY, {}); d[today()] = Math.max(d[today()] || 0, score); write(DAILY, d); return d[today()]; }

// ---------- the frame ----------
function drawHud() {
  $("round").textContent = `Round ${S.round} of ${ROUNDS}`;
  $("score").textContent = money(S.score);
  $("lives").replaceChildren(...Array.from({ length: LIVES }, (_, k) => node("i", `mf-life${k >= S.lives ? " gone" : ""}`)));
}
function title() {
  $("title").textContent = `Round ${S.round} · ${R.level.change ? "spot the change" : VIEWS[R.view]}`;
}
/** Empties the stage's parts, ready for a phase to fill them. */
function clear() {
  $("book").replaceChildren();
  $("asks").replaceChildren();
  $("asks").classList.remove("sending");
  $("note").hidden = true;
  $("timer").hidden = true;
  $("timer").firstElementChild.style.animationDelay = "";
  $("shipBtn").hidden = true;
  $("goBtn").hidden = true;
  $("goBtn").disabled = false;
  $("view").replaceChildren();
}
function go(text, fn) {
  const b = $("goBtn");
  b.hidden = false;
  b.textContent = text;
  b.onclick = fn;
}

// ---------- the stage: one isometric stack ----------
const el = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const ch = sh => Math.round(Math.min(255, Math.max(0, ((n >> sh) & 255) * k))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
const GREY = "#A3ADB3", RING = "#F5F7F8";

/**
 * The stack as one isometric panel: { panel, drops }. opts: drop (an arrival order: the containers fall in; at a
 * table, times gives each one's landing on the round's clock and since how far into the drop it is), blank (the
 * floor only, for a marked position), mark {x,y,z} (outline a container, or its floor cell with the
 * tier named when it's hidden), marks [keys] (outline these), highlight (dim every colour but this), tier (dim
 * every tier but this), tap(key), selected [keys], turns (a turned stack: containers lie along y after a quarter
 * turn), grey (every container grey), ring (a key: that container lit and outlined), small (no room for drops).
 */
function stage(cells, opts = {}) {
  const panel = node("div", `mf-panel${opts.small ? " small" : ""}`);
  const b = boxFor(opts.turns || 0), X = cells.length, Y = cells[0].length, Z = cells[0][0].length, s = 46;
  const pts = [];
  const top = opts.blank ? 0 : Z;                                  // the floor alone is framed to its own size
  for (let x = 0; x <= X; x++) for (let y = 0; y <= Y; y++) for (let z = 0; z <= top; z++) pts.push(isoPoint(x, y, z, b));
  const minX = Math.min(...pts.map(p => p.sx)), maxX = Math.max(...pts.map(p => p.sx)), minY = Math.min(...pts.map(p => p.sy)), maxY = Math.max(...pts.map(p => p.sy));
  const W = (maxX - minX) * s + 20, H = (maxY - minY) * s + 20, room = opts.drop ? s * 1.6 : s * 0.25;
  const svg = el("svg", { viewBox: `0 ${-room} ${W} ${H + room}`, class: opts.tap ? "tap" : "" });
  svg.style.setProperty("--aspect", (W / (H + room)).toFixed(3));
  const P = ([sx, sy]) => `${((sx - minX) * s + 10).toFixed(1)},${((sy - minY) * s + 10).toFixed(1)}`;
  const markKey = opts.mark ? `${opts.mark.x},${opts.mark.y},${opts.mark.z}` : null;
  const visible = opts.blank || markKey ? visibleSet(cells, b) : null;
  const outlined = new Set([...(opts.marks || []), ...(opts.selected || [])]);
  for (let x = 0; x < X; x++) for (let y = 0; y < Y; y++) {        // the floor
    const f = cubeFaces(x, y, -1, b).top;
    const marked = opts.mark && opts.mark.x === x && opts.mark.y === y && (opts.blank || !visible.has(markKey));
    svg.appendChild(el("polygon", { points: f.map(P).join(" "), fill: marked ? "var(--mf-in)" : "var(--mf-floor)", stroke: "var(--sheet)", "stroke-width": 1, opacity: marked ? 0.9 : 0.6 }));
    if (marked) {
      const c = f.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
      const t = el("text", { x: ((c[0] - minX) * s + 10).toFixed(1), y: ((c[1] - minY) * s + 16).toFixed(1), "text-anchor": "middle", "font-size": 17, "font-weight": 800, fill: "#fff" });   // read in a question's card too
      t.textContent = `tier ${opts.mark.z + 1}`;
      svg.appendChild(t);
    }
  }
  const drops = opts.drop ? (opts.times ? { times: opts.times, last: 0 } : dropTimes(cells, opts.drop)) : { times: {}, last: 0 };
  const lengthwise = b.X >= b.Y;                                  // the containers' long side runs along x
  if (!opts.blank) for (const cube of drawOrder(cells)) {
    const faces = cubeFaces(cube.x, cube.y, cube.z, b), key = `${cube.x},${cube.y},${cube.z}`;
    const dim = (opts.highlight && cube.c !== opts.highlight) || (opts.tier != null && cube.z !== opts.tier);
    const ringed = opts.ring === key;
    const hex = ringed && opts.grey ? RING : opts.grey ? GREY : COLOURS[cube.c - 1].hex;
    const g = el("g", { class: `cube${opts.drop ? " drop" : ""}`, "data-key": key });
    if (dim) g.setAttribute("opacity", 0.25);
    if (opts.drop) g.style.animationDelay = `${drops.times[key] - (opts.since || 0)}ms`;   // landed already, for a phone that comes in late
    for (const [name, k] of [["left", 0.72], ["right", 0.86], ["top", 1.05]]) {
      const poly = el("polygon", { points: faces[name].map(P).join(" "), fill: shade(hex, k), stroke: "rgba(0,0,0,.3)", "stroke-width": 1, class: "mf-cell" });
      if (opts.tap) poly.addEventListener("click", () => opts.tap(key));
      g.appendChild(poly);
    }
    // the details that make a box a container: corrugations along the long side, doors on the end, roof ridges
    const lerp = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
    const lineOn = (face, t, from, to, attrs) => {
      const [x1, y1] = P(lerp(face[from[0]], face[from[1]], t)).split(","), [x2, y2] = P(lerp(face[to[0]], face[to[1]], t)).split(",");
      g.appendChild(el("line", { x1, y1, x2, y2, ...attrs }));
    };
    const ink = { stroke: "rgba(0,0,0,.28)", "stroke-width": 0.9 };
    const side = lengthwise ? faces.left : faces.right, end = lengthwise ? faces.right : faces.left;
    for (let i = 1; i < 8; i++) lineOn(side, i / 8, [0, 1], [3, 2], ink);
    lineOn(end, 0.5, [0, 1], [3, 2], { stroke: "rgba(0,0,0,.45)", "stroke-width": 1.2 });
    lineOn(end, 0.4, [0, 1], [3, 2], ink); lineOn(end, 0.6, [0, 1], [3, 2], ink);
    for (const t of [0.33, 0.66]) lineOn(faces.top, t, lengthwise ? [0, 3] : [0, 1], lengthwise ? [1, 2] : [3, 2], { stroke: "rgba(0,0,0,.14)", "stroke-width": 0.9 });
    if ((markKey === key && (!visible || visible.has(key))) || outlined.has(key) || ringed) {
      for (const name of ringed ? ["left", "right", "top"] : ["top"]) g.appendChild(el("polygon", { points: faces[name].map(P).join(" "), fill: "none", stroke: "var(--ink)", "stroke-width": 3.5, "stroke-linejoin": "round" }));
    }
    svg.appendChild(g);
  }
  panel.appendChild(svg);
  return { panel, drops };
}

// ---------- together: a table of two to six, the rounds in step ----------
// The room keeps the round and when it opened, on the database's clock; this page runs the order book, the drop and
// the hold from that, as every phone at the table does, and a reload comes back to the same moment. Against: your own
// questions, then the round's results for everyone, once everyone at the table has finished, and the next round once
// everyone has pressed Next. Together: your part of the stack, the team's questions. Your solo run, bests and today's
// are never touched; your record still learns from your own answers.
const APP = 2;                        // this code's table (the head-to-head on duel.js, until October 2026, was 1)
const MODE = "manifest:mode", LEARNED = "manifest:learned";
let T = null;                         // the table as last seen
let offset = 0, stopOffset = null;    // how far this device's clock is from the database's
let shown = "";                       // what the stage shows, as a key: drawn again only when it changes
let drawnParts = {}, hudSig = "";     // what parts of it were last drawn from (the lists, the buttons), likewise
let ticker = 0, joined = null;
let mine = { key: "", reps: {}, ship: null };   // this round: your replies not yet in the room, and when you shipped
let sending = false, settleTried = 0;
let leftAt = 0;                       // when your stack went (performance.now()): it flies off before the questions
let focus = null;                     // the results: the question lit on the stack
let finalFor = 0;                     // the game whose final standings you've gone on to
const now = () => Date.now() + offset;
const mySlot = () => together.slot;
const here = () => (T ? presentSlots(T, together.room?.here, "manifest", together.room?.uid) : []);
const first = name => String(name || "Player").split(" ")[0];
const nameOf = slot => first(Object.values(T?.players || {}).find(p => p?.slot === slot)?.name);
const whoIs = slot => (slot === mySlot() ? "You" : nameOf(slot));
const names = list => (list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);
/** Draws a part of the stage once, until its key changes. */
function once(key, fn) { if (shown === key) return; shown = key; drawnParts = {}; fn(); }
/** Redraws a part whenever what it shows (sig) changes. */
function part2(name, sig, fn) { const s = JSON.stringify(sig); if (drawnParts[name] === s) return; drawnParts[name] = s; fn(); }

const together = createTogether({
  game: "manifest", app: APP, toast, askName,
  valid: isTable,
  slots: g => g?.people || 2,
  fresh: (players, { ask } = {}) => freshTable(players, { app: APP, people: ask?.people, mode: read(MODE, "against"), seed: randomSeed(), now: now() }),
  onState: val => {
    T = val;
    stopOffset ??= together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {});
    if (!ticker) { ticker = setInterval(refresh, 250); awake(true); }
    learn();
    refresh();
    joined?.();
  },
  onPresence: () => refresh(),
  onLeave: () => {
    clearInterval(ticker); ticker = 0;
    awake(false);
    stopOffset?.(); stopOffset = null;
    T = null; shown = ""; drawnParts = {}; hudSig = ""; mine = { key: "", reps: {}, ship: null }; focus = null;
    $("atTable").hidden = true;
    solo();
  },
  result: g => resultOf(g, g?.players?.[together.room?.uid]?.slot ?? null),
});

/** The table drawn as it stands now: by the room, and by the clock (refresh runs four times a second at a table). */
function refresh() {
  if (!T || !together.room) return;
  try { draw(); } catch (e) { console.error(e); }
}
function draw() {
  const game = T.game, st = stageOf(game);
  hud(game, st);
  if (st === "lobby") drawLobby(game);
  else if (st === "play") drawPlay(game);
  else if (st === "results" || (st === "over" && finalFor !== game.n)) drawResults(game);
  else drawOver(game);
}

// the line under the round: who else is at the table, and how they stand
function hud(game, st) {
  const slot = mySlot(), team = game.mode === "team", pres = here();
  const score = team ? game.team?.pts || 0 : game.totals?.[`s${slot}`]?.pts || 0, lives = livesOf(game, slot);
  // against, once the questions are open: who's done (✓) and who's answering (…)
  const open = st === "play" && !team && now() >= timeline(roundOf(game), game.round.at).holdEnd;
  const others = Object.values(T.players || {}).filter(p => p && p.slot != null && p.slot !== slot).sort((a, b) => a.slot - b.slot).map(p => {
    const s = p.slot, away = !pres.includes(s), run = game.round?.runs?.[`s${s}`];
    const mark = away ? "away" : st === "lobby" || st === "results" ? (game.ready?.[`s${s}`] ? "✓" : "")
      : st === "play" && !team ? (!playing(game, s) ? "out" : run?.done ? "✓" : open || run?.q0 ? "…" : "") : "";
    return [first(p.name), mark, away];
  });
  const sig = JSON.stringify([st, game.mode, game.round?.r, score, lives, others, together.online]);
  if (sig === hudSig) return;
  hudSig = sig;
  $("round").textContent = st === "lobby" ? `${ROUNDS} rounds, ${team ? "together" : "against"}` : `Round ${game.round.r} of ${ROUNDS}`;
  $("score").textContent = money(score);
  $("lives").replaceChildren(...Array.from({ length: LIVES }, (_, k) => node("i", `mf-life${k >= lives ? " gone" : ""}`)));
  const at = $("atTable");
  at.hidden = false;
  at.replaceChildren();
  if (!together.online) { at.append(sextant(), "Reconnecting…"); return; }
  if (!others.length) { at.append("Waiting for the others"); return; }
  at.append(team ? "With " : "Against ");
  others.forEach(([name, mark, away], i) => {
    const who = node("span", away ? "away" : "");
    who.append(node("b", null, name), mark ? ` ${mark}` : "");
    at.append(...(i ? [" · ", who] : [who]));
  });
}

// ---------- before round 1: who's at the table, and Ready ----------
function drawLobby(game) {
  const team = game.mode === "team", slot = mySlot();
  once(`lobby/${game.n}/${game.mode}`, () => {
    clear();
    viewOn(false);
    $("title").textContent = team ? "Together: one run for the table" : "Against each other";
    const book = $("book");
    book.className = "mf-book";
    book.append(node("p", "intro", team
      ? "Each of you sees only your part of each stack: pool what you saw. The questions and the three lives are the team's; anyone answers, and the first answer counts. (Against each other: in the menu.)"
      : "The same stack for everyone at the same moment, each answering their own questions; after every round, everyone's answers and the standings. (One run as a team: Together, in the menu.)"));
  });
  const pres = here(), w = waitingFor(T, pres, now()), ready = !!game.ready?.[`s${slot}`];
  const seats = Object.values(T.players || {}).filter(p => p && p.slot != null).sort((a, b) => a.slot - b.slot)
    .map(p => [p.slot, p.slot === slot ? `${first(p.name)} (you)` : first(p.name), game.ready?.[`s${p.slot}`] ? "ready" : pres.includes(p.slot) ? "not ready yet" : "away"]);
  part2("seats", seats, () => {
    const list = node("ul", "duel-seats mf-seats");
    for (const [s, name, state] of seats) {
      const li = node("li", s === slot ? "me" : ""), who = node("b"), dot = node("i", "standings-dot");
      dot.style.background = `var(--p${s % 6})`;
      who.append(dot, name);
      li.append(who, node("span", `duel-st${state === "ready" ? " ok" : ""}`, state));
      list.append(li);
    }
    $("asks").replaceChildren(list);
  });
  const goNow = ready && w.without != null && w.without !== slot && now() >= w.at;
  part2("buttons", [ready, goNow, w.waiting, pres.length], () => {
    if (!ready) go("Ready", () => together.act(g => sayReady(g, slot, here(), now())));
    else waitButton(pres.length < 2 ? "Waiting for someone to sit down" : `Waiting for ${names(w.waiting.map(nameOf))}`);
    quiet(goNow ? `Start without ${nameOf(w.without)}` : null, () => together.act(g => goOn(g, slot, here(), now())));
  });
}
/** The plate, standing as a line of what the table waits for. */
function waitButton(text) { go(text, () => {}); $("goBtn").disabled = true; }
/** The quiet button under the stage (Ship it alone): at a table, going on without someone, or back to solo; null hides it. */
function quiet(text, fn) {
  const b = $("shipBtn");
  b.hidden = !text;
  if (text) { b.textContent = text; b.onclick = fn; }
}

// ---------- a round in play ----------
function drawPlay(game) {
  const round = game.round, slot = mySlot(), team = game.mode === "team", key = `${game.n}/${round.r}`, t = now();
  R = roundOf(game);
  const tl = timeline(R, round.at);
  if (mine.key !== key) { mine = { key, reps: {}, ship: null }; picked = []; focus = null; }
  // your stack goes at the end of the hold, or when you ship it; together, the questions open when the team's hold
  // ends (everyone with a part has shipped, or the clock)
  const myShip = (team ? round.ship?.[`s${slot}`] : round.runs?.[`s${slot}`]?.ship) ?? mine.ship;
  const teamEnd = team && round.shipped ? Math.min(tl.holdEnd, round.shipped) : tl.holdEnd;
  const viewEnd = Math.min(myShip ?? Infinity, teamEnd), askAt = team ? teamEnd : viewEnd;
  if (t < tl.drop) { playOrders(game, tl, key, t); return; }
  if (t < viewEnd) { playShow(game, tl, key, t, myShip); return; }
  if (shown === `${key}/show`) leave(key);              // the stack goes, as it does alone: off the stage, or a change round's fade
  if (performance.now() < leftAt + (R.level.change ? 1500 : 380)) return;
  if (t < askAt) { playShipped(game, tl, key, t); return; }
  if (team) teamAsk(game, key);
  else if (!playing(game, slot)) watchAsk(game, key);
  else ownAsk(game, key);
}
/** The round's order book, for the few seconds before the stack drops, its bar running down to it. */
function playOrders(game, tl, key, t) {
  const team = game.mode === "team", watching = !playing(game, mySlot());
  once(`${key}/orders`, () => {
    S = tableS(game, {});
    title();
    clear();
    viewOn(false);
    fillBook(watching ? "Out of lives: you're watching the others' stack."
      : R.level.change ? (team ? "Watch your part of the stack: it will vanish and come back whole, with something different." : "Watch the stack: it will vanish and come back with something different.")
        : team ? "The team's questions to come. You'll see only your part of the stack: pool what you saw."
          : "The questions to come, the same for everyone. Answer any, pass any; a wrong answer costs a life.");
    runTimer(tl.drop - tl.at, tl.at - t);
  });
}
/** The timer bar, running down over ms, started `delay` from now (less than 0: already that far gone). */
function runTimer(ms, delay) {
  const timer = $("timer");
  timer.hidden = false;
  timer.style.setProperty("--mf-ms", `${ms}ms`);
  timer.classList.remove("run"); void timer.offsetWidth; timer.classList.add("run");
  timer.firstElementChild.style.animationDelay = `${Math.round(delay)}ms`;
}
/** The stack comes in on the round's clock (together, only your part of it) and holds; Ship it ends your hold. */
function playShow(game, tl, key, t, myShip) {
  const slot = mySlot(), team = game.mode === "team", round = game.round;
  const mineToSee = team ? partFor(R, round.seats, slot) : null;
  once(`${key}/show`, () => {
    S = tableS(game, {});
    title();
    clear();
    bookStrip();
    viewOn(true);
    const cells = mineToSee ? partCells(R.cells, mineToSee) : R.cells;
    $("view").replaceChildren(stage(cells, { drop: R.view, times: tl.times, since: t - tl.drop }).panel);
    if (mineToSee && !mineToSee.length) { $("note").hidden = false; $("note").textContent = "You came in after the stack was shared out: your part comes next round."; }
  });
  if (t >= tl.landed && drawnParts.hold !== key) {            // landed: the hold's clock, and Ship it
    drawnParts.hold = key;
    runTimer(R.level.exposure, tl.landed - t);
    const canShip = !myShip && (team ? (round.seats || []).includes(slot) : playing(game, slot));
    quiet(canShip ? "Ship it" : null, () => shipNow());
  }
}
function shipNow() {
  const game = T?.game, slot = mySlot(), t = now();
  if (stageOf(game) !== "play") return;
  const r = game.round.r;
  mine.ship = t;                                              // your stack goes now, whatever the round trip
  $("shipBtn").hidden = true;
  if (game.mode === "team") together.act(g => shipIn(g, slot, r, { present: here(), now: t }));
  else flush();                                               // against, it goes with your replies, and is sent again with them if it must be
  refresh();
}
/** The stack leaves the stage (a change round's fades, and the stage stays empty a second). */
function leave(key) {
  shown = `${key}/left`;
  drawnParts = {};
  leftAt = performance.now();
  $("timer").hidden = true;
  $("shipBtn").hidden = true;
  const panel = $("view").firstChild;
  if (!panel) return;
  if (R.level.change) { panel.classList.add("fade"); setTimeout(() => { if (shown === `${key}/left`) $("view").replaceChildren(); }, 500); }
  else panel.classList.add("away");
}
/** Together, once you've shipped: the others still have their parts in front of them. */
function playShipped(game, tl, key, t) {
  once(`${key}/shipped`, () => {
    S = tableS(game, {});
    title();
    clear();
    bookStrip();
    viewOn(false);
    runTimer(R.level.exposure, tl.landed - t);
  });
  const round = game.round, pres = here(), still = (round.seats || []).filter(s => pres.includes(s) && !round.ship?.[`s${s}`] && s !== mySlot());
  part2("shipped", still, () => { $("note").hidden = false; $("note").replaceChildren(sextant(), still.length ? `Shipped: ${names(still.map(nameOf))} still ${still.length > 1 ? "have" : "has"} theirs` : "Shipped"); });
}

/** The round in your shape: its plain prices, the bonus, the replies so far as answers and passes (with who gave
 *  them, at a team's table, and how they went once it's settled), for the drawing alone play uses. */
function tableS(game, replies) {
  const round = game.round, r = round.r, slot = mySlot(), team = game.mode === "team";
  const bonus = team ? bonusAt(R, round.at, round.shipped) : bonusAt(R, round.at, round.runs?.[`s${slot}`]?.ship ?? mine.ship);
  const prices = R.orders.map(o => priceOf(o.type, r)), answers = {}, skipped = [], by = {};
  R.orders.forEach((o, i) => {
    const a = replies?.[`q${i}`];
    if (!a) return;
    if (a.by != null) by[i] = a.by;
    if (a.p) { skipped.push(i); return; }
    const right = JSON.stringify(a.g) === JSON.stringify(o.question.answer);
    answers[i] = { given: a.g, right, paid: right ? Math.round(prices[i] * bonus) : 0 };
  });
  return { round: r, phase: "ask", prices, trend: R.orders.map(() => ""), bonus, answers, skipped, ...(team ? { by } : {}) };
}
/** Your replies this round: the room's, and those on their way to it. */
function myReplies(game) {
  const out = { ...repliesOf(game, mySlot()) };
  for (const [i, rep] of Object.entries(mine.reps)) out[`q${i}`] ??= rep;
  return out;
}
/** Against: your own questions, one at a time, as alone; then the wait for the others. */
function ownAsk(game, key) {
  const reps = myReplies(game), n = Object.keys(reps).filter(k => k.startsWith("q")).length;
  if (firstOpen(reps, R.orders.length) < 0) { ownWait(game, key, reps); return; }
  once(`${key}/ask/${n}`, () => {
    S = tableS(game, reps);
    title();
    clear();
    if (S.bonus > 1) shipped();
    drawAsks(n === 0 && R.level.change);
    go(R.orders.length === 1 ? "Pass" : current() > 0 ? "Pass the rest" : "Pass them all", () => passRest());
  });
}
function passRest() {
  for (let i = Math.max(0, current()); i < R.orders.length; i++) if (!S.answers[i] && !S.skipped.includes(i)) mine.reps[i] ??= { p: 1 };
  refresh();
  flush();
}
/** A reply: against, yours, shown at once and sent in order (again shortly if it doesn't get there); together, the
 *  team's, which only counts if it's the first. */
function tableReply(i, rep) {
  const game = T?.game;
  if (stageOf(game) !== "play") return;
  if (game.mode === "team") { teamReply(i, rep); return; }
  if (mine.reps[i] || repliesOf(game, mySlot())[`q${i}`]) return;
  mine.reps[i] = rep;
  refresh();
  flush();
}
async function flush() {
  const game = T?.game;
  if (sending || stageOf(game) !== "play") return;
  const slot = mySlot(), r = game.round.r, key = mine.key, room = repliesOf(game, slot), shipAt = !room.ship && mine.ship;
  const todo = Object.keys(mine.reps).map(Number).filter(i => !room[`q${i}`]).sort((a, b) => a - b);
  if (!todo.length && !shipAt) return;
  sending = true;
  const ok = await together.act(g => [shipAt && shipIn(g, slot, r, { present: here(), now: shipAt }), ...todo.map(i => reply(g, slot, r, i, mine.reps[i], { present: here(), now: now() }))].some(Boolean));
  sending = false;
  if (mine.key !== key) return;
  if (ok) flush();
  else setTimeout(flush, 2000);
}
/** Against, all yours in: what you gave, and who the table waits for (going on without the last one after a while). */
function ownWait(game, key, reps) {
  once(`${key}/wait`, () => {
    S = tableS(game, reps);
    title();
    clear();
    if (S.bonus > 1) shipped();
    drawAsks();
  });
  waiting(game);
}
/** Against, out of lives: the others answer, you watch. */
function watchAsk(game, key) {
  once(`${key}/watch`, () => {
    S = tableS(game, {});
    title();
    clear();
    viewOn(false);
    $("note").hidden = false;
    $("note").textContent = "Out of lives: you're watching";
    $("asks").replaceChildren(...R.orders.map((o, i) => laterRow(o, i)));
  });
  waiting(game);
}
function waiting(game) {
  const slot = mySlot(), pres = here(), w = waitingFor(T, pres, now()), goNow = w.without != null && w.without !== slot && now() >= w.at;
  part2("waiting", [w.waiting, goNow], () => {
    waitButton(w.waiting.length ? `Waiting for ${names(w.waiting.map(nameOf))}` : "The results are coming");
    quiet(goNow ? `Go on without ${nameOf(w.without)}` : null, () => together.act(g => goOn(g, slot, here(), now())));
  });
  // someone gone from the table may have been all the round waited for: the first one here settles it (looked at once
  // a second, on a copy, before anything is sent)
  if (pres[0] === slot && performance.now() - settleTried > 1000) {
    settleTried = performance.now();
    if (settleIfDue(structuredClone(T), pres, now())) together.act(g => settleIfDue(g, here(), now()));
  }
}
/** Together: the team's questions, one at a time; anyone answers, and what someone else answered first shows. */
function teamAsk(game, key) {
  const answers = game.round.answers || {}, n = Object.keys(answers).length;
  once(`${key}/team/${n}`, () => {
    S = tableS(game, answers);
    title();
    clear();
    if (S.bonus > 1) shipped();
    drawAsks(n === 0 && R.level.change);
    if (R.orders.length === 1) go("Pass", () => pass(0));
  });
}
async function teamReply(i, rep) {
  const game = T.game, r = game.round.r, slot = mySlot();
  if (sending) return;
  sending = true;
  $("asks").classList.add("sending");
  const ok = await together.act(g => reply(g, slot, r, i, rep, { present: here(), now: now() }));
  sending = false;
  $("asks").classList.remove("sending");
  picked = [];
  const by = T?.game?.round?.answers?.[`q${i}`]?.by;
  if (!ok && by != null && by !== slot && T.game.round.r === r) toast(`${nameOf(by)} answered it first`);
  refresh();
}

// ---------- a round's results ----------
/** Everyone's answers and the standings (against), or the team's review; Next once you've seen it. */
function drawResults(game) {
  const round = game.round, slot = mySlot(), team = game.mode === "team", key = `${game.n}/${round.r}`;
  R = roundOf(game);
  const keep = shown.startsWith(`${key}/results/`) ? $("asks").scrollTop : 0;    // a question tapped further down stays in view
  once(`${key}/results/${focus}`, () => {
    S = tableS(game, team ? round.answers : repliesOf(game, slot));
    title();
    clear();
    const t = team ? game.team : game.totals?.[`s${slot}`], played = t?.last != null;
    $("note").hidden = false;
    $("note").textContent = played ? `This round: +${money(t.last)}${S.bonus > 1 ? ` (shipped early, ×${S.bonus.toFixed(2)})` : ""}`
      : t ? "Out of lives: you watched this one" : "You sat down after this round: you play the next";
    const rows = R.orders.map((o, i) => {
      const row = reviewRow(o, i, focus, () => { focus = focus === i ? null : i; refresh(); }, played ? null : `It was ${truthText(o.question)}`);
      const who = team ? teamSaid(round, o, i) : focus === i ? everyoneSaid(game, o, i) : null;
      if (who) row.insertBefore(who, row.children[1] || null);
      return row;
    });
    $("asks").replaceChildren(...(team ? [] : [standingsOf(game)]), ...rows);
    $("asks").scrollTop = keep;
    viewOn(true);
    $("view").replaceChildren(reviewPanel(focus));
  });
  if (game.over) {
    part2("next", ["over"], () => go("Final standings", () => { finalFor = game.n; focus = null; refresh(); }));
    return;
  }
  const pres = here(), w = waitingFor(T, pres, now()), ready = !!game.ready?.[`s${slot}`];
  const goNow = ready && w.without != null && w.without !== slot && now() >= w.at;
  part2("next", [ready, goNow, w.waiting], () => {
    if (!ready) go(`Round ${round.r + 1}`, () => { focus = null; together.act(g => sayReady(g, slot, here(), now())); });
    else waitButton(`Waiting for ${names(w.waiting.map(nameOf))}`);
    quiet(goNow ? `Go on without ${nameOf(w.without)}` : null, () => together.act(g => goOn(g, slot, here(), now())));
  });
}
/** Together: who answered a question, or passed it. */
function teamSaid(round, o, i) {
  const a = round.answers?.[`q${i}`];
  if (!a) return null;
  return node("p", "mf-who", a.p ? `${whoIs(a.by)} passed` : `${whoIs(a.by)} answered ${givenText(o.question, a.g)}`);
}
/** Against, a question tapped at the results: what everyone gave. */
function everyoneSaid(game, o, i) {
  const p = node("p", "mf-who");
  for (const s of scoresOf(T)) {
    if (s.last == null) continue;                              // out before this round
    const a = repliesOf(game, s.slot)[`q${i}`], v = verdicts(game, s.slot)[i];
    p.append(node("span", v === "right" ? "ok" : v === "wrong" ? "bad" : "", `${whoIs(s.slot)} ${!a || a.p ? "passed" : givenText(o.question, a.g)}`));
  }
  return p;
}
/** The standings (against): each player's answers this round and lives under the name, what the round paid, the score. */
function standingsOf(game, final = false) {
  const slot = mySlot();
  return leaderboard(scoresOf(T).map(p => {
    const marks = p.last == null ? (p.lives > 0 ? "plays from the next round" : "watching")
      : verdicts(game, p.slot).map(v => (v === "right" ? "✓" : v === "wrong" ? "✗" : "–")).join(" ");
    const lives = p.lives > 0 ? `${p.lives} ${p.lives === 1 ? "life" : "lives"}` : `out in round ${p.out}`;
    return { name: whoIs(p.slot), value: p.pts, seat: p.slot, me: p.slot === slot, ...(final ? {} : { delta: p.last ?? undefined }),
      note: final ? `${p.right} right of ${p.right + p.wrong}, ${p.passed} passed · ${lives}` : `${marks} · ${lives}` };
  }));
}

// ---------- the game over ----------
function drawOver(game) {
  const slot = mySlot(), team = game.mode === "team";
  once(`${game.n}/over`, () => {
    clear();
    viewOn(false);
    const asks = $("asks");
    if (team) {
      const t = game.team || {};
      $("title").textContent = t.lives > 0 ? "The table came through" : "Out of lives";
      const stats = node("div", "mf-stats");
      for (const [v, label] of [[`${t.lives > 0 ? ROUNDS : game.round.r}`, t.lives > 0 ? "rounds" : "rounds, out of lives"], [`${t.right || 0}/${(t.right || 0) + (t.wrong || 0)}`, `right (${t.passed || 0} passed)`], [`${Object.keys(T.players || {}).length}`, "at the table"]]) {
        const box = node("div"); box.append(node("b", null, v), node("span", null, label)); stats.appendChild(box);
      }
      asks.replaceChildren(node("p", "mf-big", money(t.pts || 0)), stats);
    } else {
      const rows = scoresOf(T), top = Math.max(...rows.map(p => p.pts)), tops = rows.filter(p => p.pts === top);
      $("title").textContent = tops.length > 1 ? (tops.some(p => p.slot === slot) ? "A draw" : `${names(tops.map(p => first(p.name)))} share it`)
        : tops[0].slot === slot ? "You win" : `${first(tops[0].name)} wins`;
      asks.replaceChildren(standingsOf(game, true));
    }
    go("Play again", () => { const n = game.n; together.act(g => again(g, slot, n, { seed: randomSeed(), present: here(), now: now() })); });
    quiet("Back to solo", () => together.leave());
  });
}

/** Your record learns from your own answers in a round just settled, once (a team's: the ones you gave). */
function learn() {
  const game = T?.game, round = game?.round;
  if (!round?.settled) return;
  const key = `${game.seed}-${game.created}/${round.r}`, slot = mySlot();
  if (read(LEARNED, "") === key) return;
  write(LEARNED, key);
  const replies = repliesOf(game, slot), v = verdicts(game, slot), record = read(RECORD, {});
  roundOf(game).orders.forEach((o, i) => {
    const a = replies[`q${i}`];
    if (a && !a.p && (game.mode !== "team" || a.by === slot)) record[o.type] = recordAfter(record[o.type], v[i] === "right");
  });
  write(RECORD, record);
  if (v.includes("wrong")) navigator.vibrate?.(70);         // as alone: a wrong answer, felt at the results
}

// ---------- the screen stays on at a table: a phone that dims mid-round misses the stack, and the table goes on ----------
let lock = null;
async function awake(on) {
  try {
    if (on && !lock && !document.hidden && navigator.wakeLock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}

/** The menu's together part: the mode for the next game, a new one now, back to solo. */
function tableMenu(body) {
  const game = T.game, st = stageOf(game), next = T.next || game.mode, slot = mySlot();
  part(body, "together").append(
    choice("Next game", Object.entries(MODES), next, v => { write(MODE, v); together.act(g => setNext(g, v)).then(() => { if ($("menuDlg").open) openMenu(); }); }),
    line(st === "lobby" ? "This game too: it hasn't started." : `This game: ${MODES[game.mode]}.`),
    action(st === "over" ? "Play again" : "A new game", () => {
      if ((st === "play" || st === "results") && !confirm("Start a new game? This one isn't over.")) return;
      const n = game.n;
      together.act(g => again(g, slot, n, { seed: randomSeed(), present: here(), now: now() }));
    }),
    action("Back to solo", () => together.leave(), "link"),
  );
}

/** Joins the table in the address: the rete until it's drawn, and solo if it doesn't come off. */
async function joinTable(code) {
  const done = busy(joiningWords(), { delay: 0 });
  const drawn = new Promise(res => { joined = res; setTimeout(res, 8000); });
  try {
    if (!(await together.join(code))) { solo(); return; }
    await drawn;
  } finally { joined = null; done(); }
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
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- menu and messages ----------
// the menu: Play (start the run you've chosen), Content (random or today's), About (your bests); at a table, its own
let pick = null;                                              // the run the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  $("menuDlg").querySelector("h2").textContent = "Menu";
  if (T) { tableMenu(body); if (!$("menuDlg").open) $("menuDlg").showModal(); return; }
  pick ??= S?.mode === "daily" ? "daily" : "random";
  part(body, "play").append(action("Start a run", () => confirmStart(pick), "primary"));
  part(body, "content").append(choice("Run", [["random", "Random"], ["daily", "Today's"]], pick, v => { pick = v; }));
  const best = read(BEST, 0), daily = read(DAILY, {})[today()];
  part(body, "about").append(line(`${best ? `Best ${money(best)}` : "No finished run yet"}${daily != null ? `, today ${money(daily)}` : ""}`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && S.phase !== "over" && (S.round > 1 || answered()) && !confirm("Start a new run? This one isn't finished.")) return;
  start(mode);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "manifest");
document.querySelector(".mf-mark").innerHTML = APPS.find(a => a.id === "manifest").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
document.addEventListener("visibilitychange", () => {
  if (T) { if (!document.hidden) { together.resync(); awake(true); } return; }    // a table's clock never stops
  if (document.hidden && S?.phase === "show") { clearTimeout(showTimer); showStack(); }   // alone, a hidden stack is shown again from the start
});
window.addEventListener("pageshow", e => { if (e.persisted && T) together.resync(); });

// for tests and debugging (skew: moves this device's idea of the database's clock on, as if that much time had passed)
window.__manifest = { get state() { return S; }, get round() { return R; }, get table() { return T; }, get together() { return together; }, get now() { return now(); }, get shown() { return shown; },
  answer, pass, start, ship: () => (T ? shipNow() : endShow(1)), over, refresh, skew: ms => { offset += ms; refresh(); } };

function solo() {
  S = read(RUN, null);
  const hash = new URLSearchParams(location.hash.slice(1));
  const linked = Number(hash.get("d") || hash.get("s")), mode = hash.get("d") ? "daily" : "random";
  if (linked && !(S && S.seed === linked && S.mode === mode)) { S = { seed: linked, mode, round: 1, score: 0, lives: LIVES, right: 0, wrong: 0, passed: 0 }; openRound(); }
  else if (!S || S.phase === "over" || !S.phase) start("random");
  else {                                               // a saved run picks up where it was; a showing starts again
    R = makeRound(S.seed, S.round);
    drawHud();
    if (S.phase === "orders") drawOrders();
    else if (S.phase === "show") showStack();
    else if (S.phase === "ask") askPhase();
    else reviewPhase();
  }
}
// a table in the address: its game, with no solo run dealt under it while it's joined
const code = roomInAddress();
if (code) joinTable(code);
else solo();
