// Manifest: each round opens with an order book (the questions to come, by kind, with prices); the stack comes in,
// holds (ship it early for a bonus) and is gone; then the questions open: answer any, pass any. Change rounds bring
// the stack back after a blank stage with something different. The engine (manifest-engine.js) makes the rounds;
// this file shows them and takes the answers.
import { LIVES, ROUNDS, COLOURS, VIEWS, KINDS, makeRound, priceOf, skillFactor, recordAfter, shipBonus, turn, cubeFaces, drawOrder, isoPoint, visibleSet, boxFor } from "./manifest-engine.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, choice, action, line } from "./menu.js";
import { today } from "./suite.js";          // the day, the same for everyone (UTC)

const $ = id => document.getElementById(id);
const RUN = "manifest:run2", BEST = "manifest:best", DAILY = "manifest:daily", RECORD = "manifest:record";
const SVG = "http://www.w3.org/2000/svg";

// S: { seed, mode, round, score, lives, right, wrong, passed, phase: "orders" | "show" | "ask" | "review" | "over",
//      prices, answers: { [order]: { given, right, paid } }, bonus }
let S = null;
let R = null;                 // the current round from the engine
let showTimer = null, holdStart = 0;
let picked = [];              // a swap round: the containers tapped so far

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const save = () => write(RUN, S);
const money = n => n.toLocaleString("en-GB");
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

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
  Object.assign(S, { phase: "orders", answers: {}, bonus: 1,
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
  const book = $("book");
  book.className = "mf-book";
  book.append(node("p", "intro", R.level.change
    ? "Watch the stack: it will vanish and come back with something different."
    : "The questions to come. Answer any, pass any; a wrong answer costs a life."));
  R.orders.forEach((o, i) => {
    const row = node("div", "mf-order"), left = node("div");
    left.append(node("b", null, KINDS[o.type].name), node("span", null, o.posted));
    const price = node("span", "mf-price", money(S.prices[i]));
    if (S.trend[i]) price.appendChild(node("small", null, S.trend[i]));
    row.append(left, price);
    book.appendChild(row);
  });
  go("Bring it in", showStack);
}
/** The containers drop in by the round's order and the stack holds; Ship it ends the hold early, for a bonus. */
function showStack() {
  S.phase = "show";
  save();
  title();
  clear();
  const book = $("book");
  book.className = "mf-book strip";
  R.orders.forEach((o, i) => { const c = node("span", "mf-chiplet", KINDS[o.type].name); c.appendChild(node("b", null, money(S.prices[i]))); book.appendChild(c); });
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
  }, drops.last + 450);
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
function askPhase(appear = false) {
  title();
  clear();
  if (S.bonus > 1) { $("note").hidden = false; $("note").textContent = `Shipped early: answers pay ×${S.bonus.toFixed(2)}`; }
  drawAsks(appear);
  go(R.orders.length === 1 ? "Pass" : answered() ? "Done: pass the rest" : "Pass them all", () => reviewPhase());
}
function drawAsks(appear = false) {
  $("asks").replaceChildren(...R.orders.map((o, i) => askRow(o, i)));
  drawAskStage(appear);
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
/** A question as a card with everything needed to answer it at a tap: the words and the price, its picture, its
 *  answers. Answered, it keeps only what it paid or cost. Passing is leaving it: the button below ends the round. */
function askRow(o, i) {
  const q = o.question, a = S.answers[i], row = node("div", "mf-row");
  if (a) row.classList.add(a.right ? "right" : "wrong");
  const head = node("div", "mf-row-head");
  head.append(node("span", null, q.text), node("em", null, a ? (a.right ? `+${money(a.paid)}` : "a life") : money(Math.round(S.prices[i] * S.bonus))));
  row.appendChild(head);
  if (a) return row;
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
  if (S.phase !== "ask" || S.answers[i]) return;
  const o = R.orders[i], q = o.question;
  const right = JSON.stringify(given) === JSON.stringify(q.answer);
  const paid = right ? Math.round(S.prices[i] * S.bonus) : 0;
  S.answers[i] = { given, right, paid };
  if (right) { S.score += paid; S.right++; } else { S.lives--; S.wrong++; navigator.vibrate?.(70); }
  const record = read(RECORD, {});
  record[o.type] = recordAfter(record[o.type], right);
  write(RECORD, record);
  save();
  drawHud();
  if (S.lives <= 0 || answered() === R.orders.length) { reviewPhase(); return; }
  askPhase();
}

// ---------- the review ----------
const truthText = q => (q.as === "number" ? String(q.answer) : q.as === "colour" ? COLOURS[q.answer - 1].name.toLowerCase()
  : q.as === "stack" ? `stack ${q.answer + 1}` : q.as === "pair" ? "the two outlined" : "the outlined one");
function reviewPhase(focus = null) {
  S.phase = "review";
  save();
  title();
  clear();
  const earned = Object.values(S.answers).reduce((n, a) => n + a.paid, 0);
  $("note").hidden = false;
  $("note").textContent = `This round: +${money(earned)}${S.bonus > 1 ? ` (shipped early, ×${S.bonus.toFixed(2)})` : ""}`;
  const asks = $("asks");
  asks.replaceChildren(...R.orders.map((o, i) => {
    const q = o.question, a = S.answers[i], row = node("div", `mf-row${a ? (a.right ? " right" : " wrong") : ""}${focus === i ? " active" : ""}`);
    const head = node("button", "mf-row-head");
    head.type = "button";
    head.append(node("span", null, q.text), node("em", null, a ? (a.right ? `+${money(a.paid)}` : `It was ${truthText(q)}`) : `Passed: ${truthText(q)}`));
    head.addEventListener("click", () => reviewPhase(focus === i ? null : i));
    row.appendChild(head);
    if (focus === i && q.as === "stack") {
      const grid = node("div", "mf-mini");
      q.stacks.forEach((s, k) => { const b = node("button", k === q.answer ? "good" : a && a.given === k ? "bad" : ""); b.type = "button"; b.disabled = true; b.appendChild(stage(s, { turns: q.turns, small: true }).panel); grid.appendChild(b); });
      const body = node("div", "mf-row-body"); body.appendChild(grid); row.appendChild(body);
    }
    return row;
  }));
  // the stack again, with whatever the focused question asked about lit
  viewOn(true);
  const o = focus != null ? R.orders[focus] : R.level.change ? R.orders[0] : null, q = o?.question;
  let panel;
  if (q && (q.as === "cell" || q.as === "pair")) panel = stage(q.back, { turns: q.turns, marks: [].concat(q.answer) }).panel;
  else if (q && o.type === "turned") panel = stage(turnedOf(q), { turns: q.turns, ring: q.at }).panel;
  else panel = stage(R.cells, { mark: q?.cell || null, highlight: q?.colour || (o?.type === "most" ? q.answer : null), tier: q?.tier ?? null }).panel;
  $("view").replaceChildren(panel);
  const last = S.lives <= 0 || S.round >= ROUNDS;
  go(last ? "See how it went" : `Round ${S.round + 1}`, () => {
    S.passed += R.orders.length - answered();             // counted once, as the round is left
    if (last) { over(); return; }
    S.round++;
    openRound();
  });
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
  $("note").hidden = true;
  $("timer").hidden = true;
  $("shipBtn").hidden = true;
  $("goBtn").hidden = true;
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

/** When each container lands, by the round's order: { "x,y,z": ms, last }. */
function dropTimes(cells, order) {
  const times = {};
  let k = 0, last = 0;
  const stagger = 45, pause = 1300;
  for (const cube of drawOrder(cells)) {
    const key = `${cube.x},${cube.y},${cube.z}`;
    let at;
    if (order === "layers") at = cube.z * pause + k * stagger;
    else if (order === "slices") at = cube.y * pause + k * stagger;
    else if (order === "pair") at = cube.z < 2 ? cube.z * pause + k * stagger : 2 * pause + 600 + k * 25;
    else at = k * 35;
    times[key] = at;
    last = Math.max(last, at);
    k++;
  }
  return { times, last };
}

/**
 * The stack as one isometric panel: { panel, drops }. opts: drop (an arrival order: the containers fall in),
 * blank (the floor only, for a marked position), mark {x,y,z} (outline a container, or its floor cell with the
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
  const drops = opts.drop ? dropTimes(cells, opts.drop) : { times: {}, last: 0 };
  const lengthwise = b.X >= b.Y;                                  // the containers' long side runs along x
  if (!opts.blank) for (const cube of drawOrder(cells)) {
    const faces = cubeFaces(cube.x, cube.y, cube.z, b), key = `${cube.x},${cube.y},${cube.z}`;
    const dim = (opts.highlight && cube.c !== opts.highlight) || (opts.tier != null && cube.z !== opts.tier);
    const ringed = opts.ring === key;
    const hex = ringed && opts.grey ? RING : opts.grey ? GREY : COLOURS[cube.c - 1].hex;
    const g = el("g", { class: `cube${opts.drop ? " drop" : ""}`, "data-key": key });
    if (dim) g.setAttribute("opacity", 0.25);
    if (opts.drop) g.style.animationDelay = `${drops.times[key]}ms`;
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

// ---------- menu and messages ----------
// the menu: Play (start the run you've chosen), Content (random or today's), About (your bests)
let pick = null;                                              // the run the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
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
document.addEventListener("visibilitychange", () => { if (document.hidden && S?.phase === "show") { clearTimeout(showTimer); showStack(); } });  // a hidden stack is shown again from the start

window.__manifest = { get state() { return S; }, get round() { return R; }, answer, start, ship: () => endShow(1) };   // for tests and debugging

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
