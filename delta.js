// Delta: join the numbers in pairs with paths whose operations turn one into the other (rules in delta-gen.js).
// Solo boards are saved in this browser; together games live in the room's delta branch (together.js) and both
// players draw on the same board.
import { generate, LEVELS, CLUES, evaluate, isSolved, showOp, apply, unkey, key, adjacent } from "./delta-gen.js";
import { createTogether, seatsOf } from "./together.js";
import { bindSwitcher, APPS } from "./apps.js";
import { gameHref, GAMES } from "./rooms.js";

const $ = id => document.getElementById(id);
const STORE = "delta:solo", SEEN_HELP = "delta:help";
const APP = 1;                                       // together games: bumped when their shape changes
const COLOURS = 6;                                   // path colours (--d-p0…)
const SQ3 = Math.sqrt(3);
const randomSeed = () => Math.floor(Math.random() * 1e9);

// S: { seed, level, board, paths: { id: { c, k: "q,r;q,r;…" } }, clues: [pair index], done, ms, startedAt }
let S = null;
let drawing = null;   // the path under the finger: { id, c, cells }
let clockFrom = null;
let shownDone = null;

// ---------- paths ----------
const cellsOf = rec => (rec?.k ? rec.k.split(";") : []);
const pathList = paths => Object.entries(paths || {}).map(([id, rec]) => ({ id, c: rec.c, cells: cellsOf(rec) })).filter(p => p.cells.length);

/**
 * The paths with one path set to these cells (or removed, with fewer than two). Any other path it crosses is
 * cut where they meet, keeping the part before; a number belongs to one path only. Colours stay put; a new
 * path takes the first free one.
 */
function withPath(paths, id, colour, cells) {
  const out = {};
  const mine = new Set(cells);
  for (const [pid, rec] of Object.entries(paths || {})) {
    if (pid === id) continue;
    const theirs = cellsOf(rec);
    const cut = cells.length >= 2 ? theirs.findIndex(k => mine.has(k)) : -1;
    const kept = cut < 0 ? theirs : theirs.slice(0, cut);
    if (kept.length >= 2) out[pid] = { c: rec.c, k: kept.join(";") };
  }
  if (cells.length >= 2) {
    const used = new Set(Object.values(out).map(r => r.c));
    let c = colour;
    if (c == null || used.has(c)) for (c = 0; used.has(c); c++);
    out[id] = { c: c % COLOURS, k: cells.join(";") };
  }
  return out;
}
const newId = () => Math.random().toString(36).slice(2, 8);

// ---------- solo ----------
function loadSolo() {
  try { const s = JSON.parse(localStorage.getItem(STORE)); return s?.board ? s : null; } catch { return null; }
}
function saveSolo() { if (!together.room) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode */ } }

function soloBoard(seed, level) {
  const board = generate(seed, level);
  if (!board) { toast("Couldn't make a board, try again"); return; }
  S = { seed, level, board, paths: {}, clues: [], done: null, ms: 0 };
  shownDone = null;
  clockFrom = null;
  clockRun();
  saveSolo();
  history.replaceState(null, "", `#s=${seed}&d=${level}`);
  render();
}

/** Deals a new board (a hard one can take a moment, so the screen says so first). */
function newBoard(level = S.level) {
  if (S && !S.done && pathList(S.paths).length && !confirm("Start a new board? This one isn't finished.")) { render(); return; }
  toast("Dealing…");
  setTimeout(() => {
    const seed = randomSeed();
    if (!together.room) { soloBoard(seed, level); return; }
    const board = generate(seed, level);
    if (!board) { toast("Couldn't make a board, try again"); return; }
    together.act(g => { Object.assign(g, { level, seed, board, paths: {}, clues: [], done: null, startedAt: Date.now() }); });
  }, 30);
}

// ---------- the clock (solo: time on screen; together: dealt to finished) ----------
function clockRun() { if (!together.room && S && !S.done && clockFrom == null && !document.hidden) clockFrom = performance.now(); }
function clockPause() {
  if (clockFrom == null) return;
  S.ms = (S.ms || 0) + performance.now() - clockFrom;
  clockFrom = null;
  saveSolo();
}
function elapsed() {
  if (S.startedAt) return (S.done?.at || Date.now()) - S.startedAt;
  return (S.ms || 0) + (clockFrom != null ? performance.now() - clockFrom : 0);
}
const clockText = ms => {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, pad = n => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

// ---------- changes ----------
/** Applies a change to the game: the solo save, or the room in one transaction. */
async function change(fn) {
  if (together.room) return together.act(g => { g.paths ||= {}; g.clues = Object.values(g.clues || {}); return fn(g); });
  if (fn(S) === false) return false;
  afterChange();
  return true;
}
function afterChange() {
  if (!S.done && isSolved(S.board, pathList(S.paths).map(p => p.cells))) {
    clockPause();
    const at = Date.now();
    if (together.room) together.act(g => { if (g.done) return false; g.done = { won: true, at }; });
    else S.done = { won: true, at };
  }
  saveSolo();
  render();
}

function commit(id, colour, cells) {
  const tidy = cells.length >= 2 ? cells : [];
  if (together.room) {
    S.paths = withPath(S.paths, id, colour, tidy);   // shown at once; the room's copy follows
    render();
    together.act(g => { if (g.done) return false; g.paths = withPath(g.paths || {}, id, colour, tidy); });
    return;
  }
  change(g => { if (g.done) return false; g.paths = withPath(g.paths, id, colour, tidy); });
}

function clue() {
  if (S.done) return;
  const pairs = S.board.sol;
  if (LEVELS[S.level].pairsShown) { toast("On Easy every pair is shown"); return; }
  const left = CLUES - S.clues.length;
  if (left <= 0) { toast("No clues left on this board"); return; }
  const next = pairs.findIndex((_, i) => !S.clues.includes(i));
  if (next < 0) return;
  change(g => { if (g.done || g.clues.length >= CLUES || g.clues.includes(next)) return false; g.clues.push(next); });
}

function clearAll() {
  if (S.done || !pathList(S.paths).length) return;
  if (!confirm("Remove every path?")) return;
  change(g => { if (g.done) return false; g.paths = {}; });
}

function giveUp() {
  if (S.done) { showDone(); return; }
  if (!confirm("Show the solution and end this board?")) return;
  clockPause();
  const paths = Object.fromEntries(S.board.sol.map((p, i) => [`s${i}`, { c: i, k: p.cells.join(";") }]));
  change(g => { if (g.done) return false; g.paths = paths; g.done = { won: false, at: Date.now() }; });
}

// ---------- geometry ----------
const centre = k => { const [q, r] = unkey(k); return [SQ3 * (q + r / 2), 1.5 * r]; };
function hexAt(x, y) {
  const qf = (SQ3 / 3) * x - y / 3, rf = (2 / 3) * y, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf), dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return key(q, r);
}
/** The hexes on a straight run from a to b (b included), for a finger that moved several hexes at once. */
function lineBetween(a, b) {
  const [aq, ar] = unkey(a), [bq, br] = unkey(b);
  const n = Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(aq + ar - bq - br));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = SQ3 * ((aq + (bq - aq) * t) + (ar + (br - ar) * t) / 2), y = 1.5 * (ar + (br - ar) * t);
    const k = hexAt(x + 1e-6, y + 1e-6);
    if (out[out.length - 1] !== k) out.push(k);
  }
  return out;
}
const corners = ([x, y], rad) => Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 180 * (60 * i - 30);
  return `${(x + rad * Math.cos(a)).toFixed(3)},${(y + rad * Math.sin(a)).toFixed(3)}`;
}).join(" ");

// ---------- drawing with a finger ----------
let svg = null;
function toBoard(e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  return hexAt(q.x, q.y);
}
const onBoard = k => S.board.cells.includes(k);

function startDraw(e) {
  if (S.done) return;
  const k = toBoard(e);
  if (!onBoard(k)) return;
  const paths = pathList(S.paths);
  if (k in S.board.nums) {
    // starting from a number replaces the path it was on
    const old = paths.find(p => p.cells.includes(k));
    drawing = { id: old?.id || newId(), c: old?.c ?? null, cells: [k] };
  } else {
    // grabbing a path somewhere along it carries on from there
    const on = paths.find(p => p.cells.includes(k));
    if (!on) return;
    drawing = { id: on.id, c: on.c, cells: on.cells.slice(0, on.cells.indexOf(k) + 1) };
  }
  svg.setPointerCapture?.(e.pointerId);
  render();
}

function moveDraw(e) {
  if (!drawing) return;
  const k = toBoard(e), head = drawing.cells[drawing.cells.length - 1];
  if (k === head || !onBoard(k)) return;
  for (const step of adjacent(head, k) ? [k] : lineBetween(head, k)) if (!stepTo(step)) break;
  render();
}

/** One hex further (or back): returns false when the path can't go there. */
function stepTo(k) {
  const cells = drawing.cells, head = cells[cells.length - 1];
  const at = cells.indexOf(k);
  if (at >= 0) { cells.length = at + 1; return true; }               // back along the path
  if (!onBoard(k) || !adjacent(head, k)) return false;
  if (cells.length > 1 && head in S.board.nums) return false;         // finished on a number
  cells.push(k);
  return true;
}

function endDraw() {
  if (!drawing) return;
  const { id, c, cells } = drawing;
  drawing = null;
  commit(id, c, cells);
  const e = cells.length >= 2 ? evaluate(S.board, cells) : null;
  if (e?.done && !e.ok) toast(e.value === null ? "A ÷ on that path doesn't divide evenly either way" : "That path doesn't add up either way");
}

// ---------- rendering ----------
function render() {
  if (!S) return;
  $("level").value = S.level;
  drawStatus();
  drawPartner();
  drawBoard();
  const shown = LEVELS[S.level].pairsShown;
  $("clueBtn").textContent = shown ? "Clue" : `Clue (${Math.max(0, CLUES - S.clues.length)})`;
  $("clueBtn").disabled = !!S.done || shown || S.clues.length >= CLUES;
  $("clearBtn").disabled = !!S.done || !pathList(S.paths).length;
  if (S.done && JSON.stringify(S.done) !== shownDone) { shownDone = JSON.stringify(S.done); showDone(); }
}

function drawStatus() {
  const paths = pathList(S.paths), board = S.board;
  const pairs = Object.keys(board.nums).length / 2, ops = Object.keys(board.ops).length;
  const joined = paths.filter(p => evaluate(board, p.cells).ok).length;
  const used = new Set(paths.flatMap(p => p.cells).filter(k => k in board.ops)).size;
  $("status").textContent = S.done
    ? (S.done.won ? `Solved in ${clockText(elapsed())}.` : "The solution.")
    : `${joined} of ${pairs} pairs joined, ${used} of ${ops} operations used.`;
}

function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = "";
  if (!together.online) { el.append("Reconnecting… moves made now may not reach your partner."); return; }
  const p = together.partner();
  if (!p) { el.append(`Game ${together.room.code}: waiting for your partner to join.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online ? "" : " (away)");
  if (p.game) {
    const go = document.createElement("a");
    go.href = gameHref(p.game);
    go.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, go);
    return;
  }
  el.append("Playing with ", b, ".");
}

const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v);
  parent?.appendChild(n);
  return n;
}

function drawBoard() {
  const board = S.board;
  let paths = pathList(S.paths);
  if (drawing) paths = pathList(withPath(S.paths, drawing.id, drawing.c, drawing.cells.length >= 2 ? drawing.cells : []))
    .concat(drawing.cells.length === 1 ? [{ id: drawing.id, c: drawing.c ?? 0, cells: drawing.cells }] : []);
  const pts = board.cells.map(centre), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const pad = 1.05;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];

  // one lasting <svg> per board: a finger that started on it keeps drawing however often its contents redraw
  const id = `${S.seed}/${S.level}`;
  if (!svg || svg.dataset.board !== id || !svg.isConnected) {
    svg = el("svg", { role: "img" });
    svg.dataset.board = id;
    svg.addEventListener("pointerdown", startDraw);
    svg.addEventListener("pointermove", moveDraw);
    svg.addEventListener("pointerup", endDraw);
    svg.addEventListener("pointercancel", endDraw);
    $("board").replaceChildren(svg);
  }
  const root = svg;
  root.setAttribute("viewBox", box.map(v => v.toFixed(3)).join(" "));
  const tiles = el("g", {}), lines = el("g", {}), marks = el("g", {}), labels = el("g", {});
  root.replaceChildren(tiles, lines, marks, labels);
  for (const k of board.cells) el("polygon", { points: corners(centre(k), 0.93), class: `d-tile${k in board.ops ? " op" : ""}` }, tiles);

  // paths: a broad current in the path's colour, arrows once it adds up, dashed if it can't
  const verdicts = new Map();
  for (const p of paths) {
    if (p.cells.length < 2) continue;
    const e = evaluate(board, p.cells);
    verdicts.set(p.id, e);
    const run = e.ok && e.from !== p.cells[0] ? [...p.cells].reverse() : p.cells;
    el("polyline", { points: run.map(k => centre(k).map(v => v.toFixed(3)).join(",")).join(" "),
      class: `d-path${e.done && !e.ok ? " wrong" : ""}`, stroke: `var(--d-p${(p.c ?? 0) % COLOURS})` }, lines);
    if (e.ok) for (let i = 0; i + 1 < run.length; i += 2) arrow(centre(run[i]), centre(run[i + 1]), lines);
  }

  // operations, then numbers on top
  for (const [k, op] of Object.entries(board.ops)) {
    const [x, y] = centre(k);
    el("text", { x, y, class: "d-op" }, labels).textContent = showOp(op);
  }
  const tags = pairTags();
  for (const [k, v] of Object.entries(board.nums)) {
    const [x, y] = centre(k), digits = String(v).length;
    const owner = paths.find(p => p.cells.includes(k));
    el("circle", { cx: x, cy: y, r: 0.7, class: "d-num-disc" }, labels);
    if (owner && verdicts.get(owner.id)?.ok) el("circle", { cx: x, cy: y, r: 0.7, fill: "none", stroke: `var(--d-p${owner.c % COLOURS})`, "stroke-width": 0.14 }, labels);
    el("text", { x, y, class: "d-num", "font-size": (digits >= 4 ? 0.48 : digits === 3 ? 0.58 : 0.72) }, labels).textContent = v;
    if (tags[k]) {
      el("circle", { cx: x + 0.56, cy: y - 0.56, r: 0.24, class: "d-tag-disc" }, labels);
      el("text", { x: x + 0.56, y: y - 0.56, class: "d-tag" }, labels).textContent = tags[k];
    }
  }

  // ticks and crosses at the far end of finished paths
  for (const p of paths) {
    const e = verdicts.get(p.id);
    if (!e?.done) continue;
    const [x, y] = centre(e.ok ? e.to : p.cells[p.cells.length - 1]);
    el("circle", { cx: x - 0.56, cy: y + 0.56, r: 0.22, class: e.ok ? "d-mark-ok" : "d-mark-no" }, marks);
    el("text", { x: x - 0.56, y: y + 0.56, class: "d-mark-glyph" }, marks).textContent = e.ok ? "✓" : "✕";
  }

  // the running value at the finger
  if (drawing && drawing.cells.length) {
    const cells = drawing.cells, head = cells[cells.length - 1];
    const startVal = board.nums[cells[0]];
    const value = cells.filter(k => k in board.ops).reduce((v, k) => (v === null ? null : apply(v, board.ops[k])), startVal ?? null);
    const [x, y] = centre(head);
    const text = value === null ? "÷?" : String(value);
    const w = 0.36 + 0.27 * text.length;
    const g = el("g", { class: "d-bubble" }, root);
    el("rect", { x: x - w / 2, y: y - 1.55, width: w, height: 0.62, rx: 0.31 }, g);
    el("text", { x, y: y - 1.24 }, g).textContent = text;
  }

}

function arrow([x1, y1], [x2, y2], parent) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, a = Math.atan2(y2 - y1, x2 - x1), s = 0.14;
  const p = (dx, dy) => `${(mx + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(3)},${(my + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(3)}`;
  el("polygon", { points: `${p(s, 0)} ${p(-s, s)} ${p(-s, -s)}`, class: "d-arrow" }, parent);
}

/** Letters on numbers that are known to belong together: every pair on Easy, clued pairs otherwise. */
function pairTags() {
  const out = {}, shown = LEVELS[S.level].pairsShown || S.done;
  S.board.sol.forEach((p, i) => {
    if (!shown && !S.clues.includes(i)) return;
    out[p.from] = out[p.to] = "ABCDEF"[i];
  });
  return out;
}

// ---------- sheets ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function showDone() {
  $("doneTitle").textContent = S.done.won ? "Solved" : "The solution";
  const stats = [["Time", clockText(elapsed())], ["Clues", LEVELS[S.level].pairsShown ? "–" : S.clues.length], ["Pairs", S.board.sol.length]];
  $("doneStats").replaceChildren(...stats.map(([label, value]) => {
    const box = document.createElement("div"), dd = document.createElement("dd"), dt = document.createElement("dt");
    dd.textContent = value; dt.textContent = label;
    box.append(dd, dt);
    return box;
  }));
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

function openMenu() { drawMenu(); if (!$("menuDlg").open) $("menuDlg").showModal(); }
function drawMenu() {
  const body = $("menuBody");
  body.innerHTML = "";
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  button("New board", () => newBoard());
  button("How to play", () => $("helpDlg").showModal());
  if (!S.done) button("Show the solution", giveUp);
  const room = together.room;
  if (!room) {
    button("Play together", async () => { if (await together.start()) openMenu(); });
    const row = add("form", "join-run");
    const input = document.createElement("input");
    input.placeholder = "Code"; input.maxLength = 4; input.autocapitalize = "characters";
    const go = document.createElement("button");
    go.className = "btn"; go.type = "submit"; go.textContent = "Join";
    row.append(input, go);
    row.addEventListener("submit", e => {
      e.preventDefault();
      const code = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (code.length === 4) { $("menuDlg").close(); joinRoom(code); }
    });
    button("Copy a link to this board", async () => {
      try { await navigator.clipboard.writeText(location.href); toast("Link copied"); } catch { toast(location.href, 6000); }
    }, "link");
  } else {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    add("h3", null, `Game ${room.code}`);
    add("p", "stats", "Send this link to your partner: you both draw on the same board. Switching games (tap the title) keeps you both in this room, and each game's progress is kept.");
    add("p", "room-link", link);
    button("Copy link", async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); } });
    button("Leave the room", () => together.leave(), "link");
  }
}

// ---------- together ----------
async function askName() {
  const saved = localStorage.getItem("crates:name");
  if (saved) return saved;
  const dlg = $("nameDlg");
  dlg.showModal();
  $("nameInput").focus();
  const name = await new Promise(res => dlg.addEventListener("close", () => res($("nameInput").value.trim()), { once: true }));
  if (name) try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
  return name;
}

const together = createTogether({
  game: "delta",
  app: APP,
  toast,
  askName,
  valid: g => !!g?.board,
  fresh: players => {
    const level = S?.level || "medium", seed = randomSeed();
    return { v: 1, app: APP, created: Date.now(), startedAt: Date.now(), level, seed, board: generate(seed, level), paths: {}, clues: [], done: null, players };
  },
  onState: val => {
    clockPause();
    const fresh = !S || S.seed !== val.seed;
    S = { seed: val.seed, level: val.level, board: val.board, paths: val.paths || {}, clues: Object.values(val.clues || {}), done: val.done || null, startedAt: val.startedAt || val.created };
    if (fresh) { shownDone = val.done ? JSON.stringify(val.done) : null; drawing = null; }
    if (!S.done && isSolved(S.board, pathList(S.paths).map(p => p.cells))) afterChange();
    render();
  },
  onPresence: () => drawPartner(),
  onLeave: () => { S = loadSolo(); if (!S) { soloBoard(randomSeed(), "easy"); return; } shownDone = S.done ? JSON.stringify(S.done) : null; clockRun(); render(); },
});

async function joinRoom(code) {
  clockPause();
  if (!(await together.join(code))) { clockRun(); render(); }
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "delta");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("helpClose").addEventListener("click", () => $("helpDlg").close());
$("helpGo").addEventListener("click", () => $("helpDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneNew").addEventListener("click", () => { $("doneDlg").close(); newBoard(); });
$("clueBtn").addEventListener("click", clue);
$("clearBtn").addEventListener("click", clearAll);
$("level").addEventListener("change", e => newBoard(e.target.value));
document.addEventListener("visibilitychange", () => { if (document.hidden) clockPause(); else { clockRun(); together.resync(); } });
window.addEventListener("pagehide", clockPause);
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
$("app").querySelector(".d-mark").innerHTML = APPS.find(a => a.id === "delta").logo;

// start: a shared board (#s=…&d=…), the saved one, or a fresh Easy board for a first visit
const hash = new URLSearchParams(location.hash.slice(1));
const params = new URLSearchParams(location.search);
const code = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
S = loadSolo();
const linked = Number(hash.get("s")), linkedLevel = hash.get("d");
if (linked && LEVELS[linkedLevel] && !(S && S.seed === linked && S.level === linkedLevel)) soloBoard(linked, linkedLevel);
else if (!S) soloBoard(randomSeed(), "easy");
else { shownDone = S.done ? JSON.stringify(S.done) : null; history.replaceState(null, "", `${location.search}#s=${S.seed}&d=${S.level}`); clockRun(); render(); }
if (!localStorage.getItem(SEEN_HELP) && !code) { $("helpDlg").showModal(); try { localStorage.setItem(SEEN_HELP, "1"); } catch { /* private mode */ } }
if (code.length === 4) joinRoom(code);

window.__delta = { get state() { return S; }, get drawing() { return drawing; }, withPath, get together() { return together; } };
