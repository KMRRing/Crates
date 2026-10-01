// Glyph: solo and together play. Boards and rules come from glyph-gen.js. Together games live in the same
// Firebase rooms as Crates (crates/rooms/CODE, marked game: "glyph"); each player sees the marks of half the fields.
import { generate, gridOf, SHAPES, VALID, fieldsOf, judge, notesFrom, lettersFrom, isSolved, par, jointsOf, unkey, clearable, eligibleCells } from "./glyph-gen.js";
import { bindSwitcher, APPS } from "./apps.js";
import { getSync } from "./net.js";

const $ = id => document.getElementById(id);
const STORE = "glyph:solo";
const CHECKS = 2, REVEALS = 2;
/** Checks and rule reveals per board: unlimited on Easy, two each otherwise. */
const limitsFor = level => (level === "easy" ? { checks: Infinity, reveals: Infinity } : { checks: CHECKS, reveals: REVEALS });
const GAP = 6;
const PALETTE = { single: ["s", ["Blue", "Green", "Teal"]], pair: ["p", ["Yellow", "Orange", "Sand"]], whole: ["w", ["Violet", "Pink", "Plum"]] };
const KIND = { single: "single letters", pair: "pairs", whole: "whole field" };
const HOW = {
  single: "Each letter is judged on its own.",
  pair: "Each pair of neighbours, read left to right and top to bottom.",
  whole: "Judged as a whole once every cell is filled.",
};
const roomPath = code => `crates/rooms/${code}`;
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
const randomSeed = () => Math.floor(Math.random() * 1e9);

// ---------- state ----------
let S = null;        // { seed, level, board, log, done } — the solo save, or the room's game
let room = null;     // together: { code, uid, sync, unwatch, data }
let cursor = null;    // the cell being typed into
let dir = "Across";   // which way typing runs; tapping the cursor's cell again turns it
let pending = {};     // letters typed into the current word but not placed yet, by cell
let shownDone = null;
let clearLevel = 0;   // Clear escalates on repeated presses: broken words, then rule-breakers, then everything

const grid = () => gridOf(SHAPES[S.board.shape]);
const fields = () => fieldsOf(S.board);
const placements = () => S.log.filter(e => e.word).length;
const checksUsed = () => S.log.filter(e => e.check).length;
const revealed = () => new Set(S.log.filter(e => e.reveal != null).map(e => e.reveal));
const mySlot = () => (room ? room.data?.players?.[room.uid]?.slot ?? 0 : null);
const sees = i => !room || !!S.done || i % 2 === mySlot() || revealed().has(i);
const other = d => (d === "Across" ? "Down" : "Across");
const slotFor = (k, d) => grid().slots.find(s => s.dir === d && s.cells.includes(k));
const currentSlot = () => slotFor(cursor, dir) || slotFor(cursor, other(dir));

/** Back to the start: the cursor on the first row's first cell, typing across. */
function resetCursor() {
  const g = grid(), first = g.slots.find(s => s.dir === "Across") || g.slots[0];
  cursor = first.cells[0]; dir = first.dir; pending = {}; clearLevel = 0;
}

function styleOf(i) {
  const fs = fields(), f = fs[i], [prefix, names] = PALETTE[f.rule.type];
  const n = fs.slice(0, i).filter(g => g.rule.type === f.rule.type).length % 3;
  return { tint: `var(--g${prefix}${n})`, edge: `var(--g${prefix}${n}e)`, name: names[n], type: f.rule.type };
}

// ---------- solo ----------
function loadSolo() {
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s?.board && Array.isArray(s.log)) return s; } catch { /* fresh */ }
  return null;
}
function saveSolo() { if (!room) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode */ } }

function soloBoard(seed, level) {
  const board = generate(seed, level);
  S = { seed, level, board, log: [], done: null };
  shownDone = null;
  resetCursor();
  history.replaceState(null, "", `${location.pathname}${room ? "" : location.search}#s=${seed}&d=${level}`);
  saveSolo();
  render();
}

// ---------- actions (solo writes the save; together writes the room) ----------
async function act(change) {
  if (!room) { change(S); saveSolo(); afterChange(); return; }
  await room.sync.tx(roomPath(room.code), cur => {
    if (!cur || cur.game !== "glyph") return undefined;
    cur.log = Object.values(cur.log || {});
    return change(cur) === false ? undefined : cur;
  });
}

function place() {
  if (S.done) return;
  const slot = currentSlot(), before = lettersFrom(S.board, S.log);
  const word = slot.cells.map(k => pending[k] || before[k] || "").join("");
  if (word.length !== slot.cells.length) {
    // a frame: letters stay on the board, aren't judged and don't count until they're part of a real word
    if (!Object.keys(pending).length) { toast("Type a letter first"); return; }
    const draft = { ...pending };
    pending = {};
    act(g => { if (g.done) return false; g.log.push({ draft, ...(room && { by: room.uid }) }); });
    toast("Not a full word, so these letters aren't judged yet. Clear removes them.");
    render();
    return;
  }
  if (!VALID.has(word)) { toast(`${word} isn't in the word list`); return; }
  if (!Object.keys(pending).length && slot.cells.every(k => before[k])) { toast(`${word} is already on the board`); return; }
  pending = {};
  clearLevel = 0;
  act(g => { if (g.done) return false; g.log.push({ slot: slot.id, word, ...(room && { by: room.uid }) }); });
  const after = { ...before };
  slot.cells.forEach((k, i) => { after[k] = word[i]; });
  const broken = grid().slots.filter(s => s !== slot && s.cells.some(k => slot.cells.includes(k))
    && s.cells.every(k => after[k]) && !VALID.has(s.cells.map(k => after[k]).join("")));
  if (broken.length) toast(`That broke ${broken.map(s => `${s.dir.toLowerCase()} ${s.num} (${s.cells.map(k => after[k]).join("")})`).join(" and ")}`);
  render();
}

function check() {
  if (S.done) return;
  if (checksUsed() >= limitsFor(S.level).checks) { toast("No checks left on this board"); return; }
  const letters = lettersFrom(S.board, S.log);
  if (!Object.keys(letters).length) { toast("Place a word first: a check looks at the letters on the board"); return; }
  act(g => {
    if (g.done || g.log.filter(e => e.check).length >= limitsFor(g.level).checks) return false;
    g.log.push({ check: letters, ...(room && { by: room.uid }) });
  });
}

/** Clear: first press empties letters that aren't in a real word, the next also words breaking a rule you can see, the next everything. */
function clear() {
  if (S.done) return;
  const letters = lettersFrom(S.board, S.log);
  if (!Object.keys(letters).length) { toast("The board is already empty"); clearLevel = 0; return; }
  pending = {};
  const level = clearLevel + 1;
  clearLevel = level >= 3 ? 0 : level;
  const cells = clearable(S.board, letters, level, sees);
  const words = n => `${n} letter${n === 1 ? "" : "s"}`;
  if (!cells.length) {
    toast(level === 1 ? "Every letter is part of a real word. Press Clear again to remove words that break a rule."
      : "No word breaks a rule you can see. Press Clear again to empty the board.");
    render();
    return;
  }
  act(g => { if (g.done) return false; g.log.push({ clear: cells, ...(room && { by: room.uid }) }); });
  toast(level === 1 ? `Cleared ${words(cells.length)} that weren't part of a real word. Press again to clear rule-breakers too.`
    : level === 2 ? `Cleared ${words(cells.length)} in words that break a rule. Press again to empty the board.`
      : "Board cleared.");
}

/** Spends one of the board's two reveals on a field's rule; a single-letter rule then colours the whole keyboard. */
function reveal(i) {
  if (S.done || revealed().has(i)) return;
  if (revealed().size >= limitsFor(S.level).reveals) { toast("No rule reveals left on this board"); return; }
  act(g => {
    const used = new Set(g.log.filter(e => e.reveal != null).map(e => e.reveal));
    if (g.done || used.has(i) || used.size >= limitsFor(g.level).reveals) return false;
    g.log.push({ reveal: i, ...(room && { by: room.uid }) });
  });
}

function giveUp() {
  if (S.done) { showDone(); return; }
  if (!confirm("Show our fill and end this board?")) return;
  act(g => { if (g.done) return false; g.done = { gaveUp: true, at: Date.now() }; });
}

function newBoard(level = S.level) {
  if (!S.done && placements() && !confirm("Leave this board unfinished?")) { $("level").value = S.level; return; }
  $("menuDlg").close();
  if (!room) { soloBoard(randomSeed(), level); return; }
  const seed = randomSeed(), board = generate(seed, level);
  act(g => { g.level = level; g.seed = seed; g.board = board; g.log = []; g.done = null; });
}

/** Solved boards end themselves; both players see the result. */
function afterChange() {
  if (!S.done && isSolved(S.board, lettersFrom(S.board, S.log))) {
    act(g => { if (g.done) return false; g.done = { won: true, at: Date.now() }; });
    return;
  }
  render();
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

async function connect() {
  try { return await getSync(); }
  catch (e) { console.error(e); toast("Couldn't reach the game server"); return null; }
}

async function together() {
  const name = await askName();
  if (!name) return;
  const sync = await connect();
  if (!sync) return;
  const seed = randomSeed(), board = generate(seed, S.level);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode();
    const room0 = { game: "glyph", v: 1, owner: sync.uid, created: Date.now(), level: S.level, seed, board, log: [], done: null,
      players: { [sync.uid]: { name, slot: 0, online: true } } };
    try {
      const r = await sync.tx(roomPath(code), cur => (cur === null ? room0 : undefined));
      if (r.committed) { enter(code, sync); openMenu(); return; }
    } catch (e) { explain(e); return; }
  }
  toast("Couldn't start a game, try again");
}

async function join(code) {
  const name = await askName();
  if (!name) return false;
  const sync = await connect();
  if (!sync) return false;
  let crates = false, full = false;
  try {
    const r = await sync.tx(roomPath(code), cur => {
      crates = false; full = false;
      if (cur === null) return null;
      if (cur.game !== "glyph") { crates = true; return undefined; }
      cur.players ||= {};
      if (cur.players[sync.uid]) { cur.players[sync.uid].name = name; return cur; }
      const slots = Object.values(cur.players).map(p => p.slot);
      if (slots.length >= 2) { full = true; return undefined; }
      cur.players[sync.uid] = { name, slot: slots.includes(0) ? 1 : 0, online: true };
      return cur;
    });
    if (crates) { location.href = `./?room=${code}`; return true; }
    if (!r.committed || !r.value) { toast(full ? "That game already has two players" : "No game with that code"); return false; }
    enter(code, sync);
    return true;
  } catch (e) { explain(e); return false; }
}

function enter(code, sync) {
  room = { code, sync, uid: sync.uid, data: null };
  setRoomParam(code);
  room.unwatch = sync.watch(roomPath(code), onRoom, explain);
  sync.presence?.(`${roomPath(code)}/players/${sync.uid}`);
}

function onRoom(val) {
  if (!room) return;
  if (!val || val.game !== "glyph") { toast("That game has ended"); leave(); return; }
  room.data = val;
  const fresh = !S || S.board !== val.board && JSON.stringify(S.board) !== JSON.stringify(val.board);
  S = { seed: val.seed, level: val.level, board: val.board, log: Object.values(val.log || {}), done: val.done || null };
  if (fresh) { resetCursor(); shownDone = null; }
  if (!S.done && isSolved(S.board, lettersFrom(S.board, S.log))) afterChange();
  render();
  if ($("menuDlg").open) drawMenu();
}

function leave() {
  room?.unwatch?.();
  room = null;
  setRoomParam(null);
  S = loadSolo();
  if (!S) { soloBoard(randomSeed(), $("level").value || "easy"); return; }
  resetCursor();
  shownDone = S.done ? JSON.stringify(S.done) : null;
  render();
}

function explain(e) {
  console.error(e);
  toast(/permission/i.test(String(e?.message || e)) ? "Playing together isn't switched on in Firebase yet" : "Couldn't reach the game server");
}

function setRoomParam(code) {
  const u = new URL(location.href);
  if (code) { u.searchParams.set("room", code); u.hash = ""; } else u.searchParams.delete("room");
  history.replaceState(null, "", u);
}

// ---------- drawing ----------
function render() {
  if (!S) return;
  const g = grid(), fs = fields(), letters = lettersFrom(S.board, S.log);
  if (!cursor || !g.cells.includes(cursor)) resetCursor();
  const slot = currentSlot(), left = limitsFor(S.level).checks - checksUsed();
  $("level").value = S.level;
  $("checkBtn").textContent = left === Infinity ? "Check letters" : `Check letters (${left})`;
  $("checkBtn").disabled = !!S.done || left === 0;
  $("clearBtn").disabled = !!S.done;
  const notes = notesFrom(S.board, S.log);
  drawPartner();
  drawBoard(g, fs, letters, slot);
  drawFields(fs, notes);
  drawKeys(fs, notes);
  const doneKey = S.done ? JSON.stringify(S.done) : null;
  if (doneKey && doneKey !== shownDone) { shownDone = doneKey; showDone(); }
}

function drawPartner() {
  const el = $("partner");
  if (!room) { el.hidden = true; return; }
  const others = Object.entries(room.data?.players || {}).filter(([id]) => id !== room.uid).map(([, pl]) => pl);
  const mine = fields().map((f, i) => i).filter(i => i % 2 === mySlot()).map(i => styleOf(i).name);
  el.hidden = false;
  el.innerHTML = "";
  if (!others.length) { el.append(`Game ${room.code}: waiting for your partner to join.`); return; }
  const b = document.createElement("b");
  b.textContent = others[0].name + (others[0].online === false ? " (away)" : "");
  el.append("Playing with ", b, `. You see the marks for ${listJoin(mine)}.`);
}
const listJoin = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function drawBoard(g, fs, letters, slot) {
  const el = $("board"), size = fitLayout(g);
  el.style.width = `${g.W * size + (g.W - 1) * GAP}px`;
  el.style.height = `${g.H * size + (g.H - 1) * GAP}px`;
  const at = k => { const [r, c] = unkey(k); return { x: c * (size + GAP), y: r * (size + GAP) }; };
  const owner = {};
  fs.forEach((f, i) => f.cells.forEach(k => { owner[k] = i; }));
  const verdict = judge(S.board, letters);
  const confirmed = confirmedLetters();
  const bad = new Set(g.slots.filter(s => s.cells.every(k => letters[k]) && !VALID.has(s.cells.map(k => letters[k]).join(""))).flatMap(s => s.cells));
  const eligible = eligibleCells(S.board, letters);   // letters in a complete real word: the only ones judged
  const nodes = [];

  for (const k of g.cells) {
    const { x, y } = at(k), i = owner[k], cell = document.createElement("div");
    cell.className = "g-cell";
    Object.assign(cell.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.5}px` });
    if (i != null) {
      const st = styleOf(i);
      cell.style.background = st.tint; cell.style.borderColor = st.edge;
      if (st.type === "whole") cell.classList.add("whole");
    }
    if (!S.done && slot.cells.includes(k)) cell.classList.add(k === cursor ? "cursor" : "sel");
    const typed = pending[k] || null;
    const ch = document.createElement("span");
    if (typed) { ch.className = "pending"; ch.textContent = typed; }
    else if (letters[k]) { ch.className = "ch"; ch.textContent = letters[k]; }
    cell.appendChild(ch);
    if (!typed && letters[k]) {
      const v = verdict.cells[k];
      if (v && sees(v.field) && eligible.has(k)) cell.appendChild(mark(v.ok));
      if (bad.has(k)) cell.classList.add("broken");
      else if (!eligible.has(k)) { cell.classList.add("draft"); cell.title = "Not part of a real word yet"; }
    }
    if (confirmed[k]) {
      // a checked letter that matches our fill: outlined while it stays, a reminder in the corner once replaced
      if (!typed && letters[k] === confirmed[k]) cell.classList.add("confirmed");
      else {
        const r = document.createElement("span");
        r.className = "g-remind";
        r.style.fontSize = `${Math.max(11, size * 0.2)}px`;
        r.textContent = confirmed[k];
        r.title = "This letter matched our fill";
        cell.appendChild(r);
      }
    }
    if (S.done && !letters[k]) { ch.className = "pending"; ch.textContent = S.board.sol[k]; }
    cell.dataset.k = k;
    cell.setAttribute("role", "button");
    cell.tabIndex = 0;
    cell.setAttribute("aria-label", `${letters[k] || "Empty"}${i != null ? `, ${styleOf(i).name} field` : ""}`);
    cell.addEventListener("click", () => select(k));
    nodes.push(cell);
  }

  fs.forEach((f, i) => {
    const st = styleOf(i);
    if (f.rule.type === "pair") {
      for (const [a, b] of jointsOf(f.cells)) {
        const pa = at(a), pb = at(b), across = pa.y === pb.y, join = document.createElement("div");
        join.className = "g-join";
        const thick = Math.max(12, size * 0.32);
        Object.assign(join.style, across
          ? { left: `${pa.x + size - 4}px`, top: `${pa.y + (size - thick) / 2}px`, width: `${GAP + 8}px`, height: `${thick}px` }
          : { left: `${pa.x + (size - thick) / 2}px`, top: `${pa.y + size - 4}px`, width: `${thick}px`, height: `${GAP + 8}px` });
        join.style.background = st.edge;
        const v = verdict.joints.find(j => j.a === a && j.b === b);
        if (v && sees(i) && eligible.has(a) && eligible.has(b)) join.appendChild(mark(v.ok));
        nodes.push(join);
      }
    } else if (f.rule.type === "whole" && i in verdict.wholes && sees(i) && f.cells.every(k => eligible.has(k))) {
      const first = f.cells.slice().sort((a, b) => at(a).y - at(b).y || at(a).x - at(b).x)[0], { x, y } = at(first);
      const badge = document.createElement("div");
      badge.className = "g-badge";
      Object.assign(badge.style, { left: `${x - 9}px`, top: `${y - 9}px` });
      badge.appendChild(mark(verdict.wholes[i]));
      nodes.push(badge);
    }
  });
  el.replaceChildren(...nodes);
}

/** Letters a check showed to match our fill, by cell. */
/**
 * Sizes the board and the keyboard to the visible screen (Safari's bars included): the board as large as the width
 * allows while the keyboard keeps its minimum height, then the keys grow into whatever height is left.
 */
function fitLayout(g) {
  const vh = window.visualViewport?.height || window.innerHeight;
  // measured from what sits above the board, since the board centres itself in the space it gets
  const above = $("partner").hidden ? document.querySelector("#app > .top") : $("partner");
  const top = above.getBoundingClientRect().bottom + window.scrollY + 12;
  const app = getComputedStyle($("app"));
  const width = $("app").clientWidth - parseFloat(app.paddingLeft) - parseFloat(app.paddingRight);
  const bottom = parseFloat(app.paddingBottom) || 0;
  const fixed = $("actions").offsetHeight + 12 + 12 + 2 * KEY_GAP;    // actions and the gaps around and between rows
  const boardRoom = vh - top - bottom - fixed - 3 * MIN_KEY;
  const size = Math.max(34, Math.min((width - GAP * (g.W - 1)) / g.W, (boardRoom - GAP * (g.H - 1)) / g.H, 84));
  const spare = vh - top - bottom - fixed - (g.H * size + (g.H - 1) * GAP);
  document.documentElement.style.setProperty("--g-key-h", `${Math.max(MIN_KEY, Math.min(MAX_KEY, spare / 3))}px`);
  return size;
}
const MIN_KEY = 44, MAX_KEY = 66, KEY_GAP = 6;

function confirmedLetters() {
  const out = {};
  for (const e of S.log) if (e.check) for (const [k, ch] of Object.entries(e.check)) if (ch === S.board.sol[k]) out[k] = ch;
  return out;
}

/** The single-letter field of the clicked cell, if its marks are yours to see. */
function keyField(fs) {
  if (!cursor || S.done) return null;
  const i = fs.findIndex(f => f.cells.includes(cursor));
  return i >= 0 && fs[i].rule.type === "single" && sees(i) ? i : null;
}

/** Colours the keyboard with what the clicked cell's single-letter field has taken (green) and rejected (red). */
function drawKeys(fs, notes) {
  const i = keyField(fs);
  $("kbd").title = i != null ? `Letters the ${styleOf(i).name} field has taken (green) and rejected (red)` : "";
  const known = i != null && revealed().has(i) ? fs[i].rule : null;
  document.querySelectorAll("#kbd button[data-key]").forEach(b => {
    const ch = b.dataset.key;
    b.classList.toggle("ok", i != null && (known ? known.test(ch) : notes[i].ok.has(ch)));
    b.classList.toggle("no", i != null && (known ? !known.test(ch) : notes[i].no.has(ch)));
  });
}

function mark(ok) {
  const m = document.createElement("span");
  m.className = ok ? "g-mark-ok" : "g-mark-no";
  m.textContent = ok ? "✓" : "✕";
  m.setAttribute("aria-label", ok ? "passes" : "fails");
  return m;
}

function drawFields(fs, notes) {
  const shown = revealed(), left = limitsFor(S.level).reveals - shown.size, badge = $("revealsBadge");
  badge.hidden = left === Infinity || !!S.done;
  badge.innerHTML = `${left} × <span class="g-q" aria-hidden="true">?</span>`;
  badge.setAttribute("aria-label", `${left} rule reveal${left === 1 ? "" : "s"} left`);
  $("fields").replaceChildren(...fs.map((f, i) => {
    const st = styleOf(i), row = document.createElement("div");
    row.className = "g-field";
    const sw = document.createElement("div");
    sw.className = `g-swatch ${st.type}`;
    sw.style.background = st.tint; sw.style.borderColor = st.edge;
    const name = document.createElement("div");
    name.className = "g-fname";
    name.textContent = `${st.name}: ${KIND[st.type]}, ${f.cells.length} cells`;
    const ask = document.createElement("button");
    ask.type = "button";
    ask.className = "g-ask";
    ask.textContent = "?";
    ask.setAttribute("aria-label", `Reveal the ${st.name} field's rule`);
    ask.disabled = !!S.done || shown.has(i) || left <= 0;
    ask.addEventListener("click", () => reveal(i));
    row.append(sw, name, ask);
    line(row, HOW[st.type]);
    if (!sees(i)) { line(row, "Your partner sees this field's marks."); return row; }   // (a revealed rule is seen by both)
    const ok = [...notes[i].ok].sort(), no = [...notes[i].no].sort();
    const label = st.type === "single" ? ["Takes", "Rejects"] : ["Passed", "Failed"];
    noteLine(row, label[0], ok, "ok");
    noteLine(row, label[1], no, "no");
    if (S.done || shown.has(i)) { const r = line(row, "Rule: "); const b = document.createElement("span"); b.className = "rule"; b.textContent = f.rule.text; r.appendChild(b); }
    return row;
  }));
}
function line(row, text) { const d = document.createElement("div"); d.className = "g-fline"; d.append(text); row.appendChild(d); return d; }
function noteLine(row, label, items, kind) {
  const d = line(row, `${label}: `);
  if (!items.length) { d.append("nothing yet"); return; }
  const box = document.createElement("span");
  box.className = "g-notes";
  items.forEach(t => { const s = document.createElement("span"); s.className = `g-note ${kind}`; s.textContent = t; box.appendChild(s); });
  d.appendChild(box);
}

function showDone() {
  const g = grid(), letters = lettersFrom(S.board, S.log);
  const ours = g.slots.every(s => s.cells.every(k => letters[k] === S.board.sol[k]));
  const n = placements(), p = par(S.board);
  if (S.done.won) {
    const stars = n <= p ? 3 : n <= p + 3 ? 2 : 1;
    $("doneTitle").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    $("doneText").textContent = `Solved in ${n} placement${n === 1 ? "" : "s"} (par ${p}). ${ours ? "You found our fill." : "You found a different fill from ours, which counts just the same."}`;
  } else {
    $("doneTitle").textContent = "Our fill";
    $("doneText").textContent = "Here's the fill we had in mind, and every field's rule.";
  }
  const words = document.createElement("p");
  words.className = "g-ours";
  words.textContent = ours && S.done.won ? "" : g.slots.map(s => `${s.dir} ${s.num}: ${s.cells.map(k => S.board.sol[k]).join("")}`).join("   ");
  $("doneOurs").replaceChildren(words);
  $("doneRules").replaceChildren(...fields().map((f, i) => { const li = document.createElement("li"); li.textContent = `${styleOf(i).name}: ${f.rule.text}`; return li; }));
  $("doneDlg").showModal();
}

// ---------- the menu ----------
function openMenu() { drawMenu(); if (!$("menuDlg").open) $("menuDlg").showModal(); }

function drawMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; body.appendChild(e); return e; };
  add("button", "btn primary wide", "New board").addEventListener("click", () => newBoard());
  if (room) {
    $("menuTitle").textContent = `Game ${room.code}`;
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    add("p", "stats", "Send this link to your partner. Each of you sees the marks for half the fields, so talk about what you see.");
    add("p", "room-link", link);
    const row = add("div", "controls");
    const copy = document.createElement("button"); copy.className = "btn"; copy.textContent = "Copy link";
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link); } });
    row.appendChild(copy);
    if (navigator.share) {
      const share = document.createElement("button"); share.className = "btn"; share.textContent = "Share link";
      share.addEventListener("click", () => navigator.share({ title: "Glyph", url: link }).catch(() => {}));
      row.appendChild(share);
    }
    add("button", "btn wide", S.done ? "Show the result" : "Show our fill").addEventListener("click", () => { $("menuDlg").close(); giveUp(); });
    add("button", "link", "Leave this game").addEventListener("click", () => { $("menuDlg").close(); leave(); });
    return;
  }
  $("menuTitle").textContent = "Menu";
  add("button", "btn wide", "Play together").addEventListener("click", () => { $("menuDlg").close(); together(); });
  const form = add("form", "join-run");
  form.innerHTML = `<input aria-label="Game code" placeholder="Code from your partner" maxlength="4" autocapitalize="characters"><button class="btn" type="submit">Join</button>`;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const code = form.querySelector("input").value.toUpperCase().replace(/[^A-Z]/g, "");
    if (code.length !== 4) { toast("Codes are four letters"); return; }
    $("menuDlg").close();
    join(code);
  });
  add("button", "btn wide", S.done ? "Show the result" : "Show our fill").addEventListener("click", () => { $("menuDlg").close(); giveUp(); });
  add("button", "link", "Copy this board's link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Board link copied"); } catch { toast(location.href); }
  });
}

// ---------- input ----------
/** Tapping a cell puts the cursor there, running across by default; tapping the cursor's cell again turns it. */
function select(k) {
  if (S.done) return;
  const before = currentSlot();
  if (k === cursor) {
    if (!slotFor(k, other(dir))) return;
    dir = other(dir);
  } else {
    cursor = k;
    dir = slotFor(k, "Across") ? "Across" : "Down";
  }
  if (currentSlot() !== before) pending = {};
  render();
}

function typeKey(k) {
  if (S.done) return;
  const slot = currentSlot(), at = slot.cells.indexOf(cursor);
  if (k === "ENTER") { place(); return; }
  if (k === "BACK") {
    // delete what's typed here, or step back a cell and delete there
    if (pending[cursor]) delete pending[cursor];
    else if (at > 0) { cursor = slot.cells[at - 1]; delete pending[cursor]; }
  } else if (/^[A-Z]$/.test(k)) {
    pending[cursor] = k;
    if (at < slot.cells.length - 1) cursor = slot.cells[at + 1];
  }
  render();
}

function buildKeyboard() {
  const rows = [[..."QWERTYUIOP"], ["", ..."ASDFGHJKL", ""], ["ENTER", ..."ZXCVBNM", "BACK"]];
  const label = { BACK: "⌫", ENTER: "Place" };
  $("kbd").replaceChildren(...rows.map(keys => {
    const r = document.createElement("div");
    r.className = "g-krow";
    keys.forEach(k => {
      if (!k) { const gap = document.createElement("span"); gap.className = "g-half"; r.appendChild(gap); return; }
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label[k] || k;
      if (k.length === 1) b.dataset.key = k;
      else b.classList.add("wide");
      if (k === "ENTER") b.classList.add("place");
      if (k === "BACK") b.setAttribute("aria-label", "Delete");
      b.addEventListener("click", () => typeKey(k));
      r.appendChild(b);
    });
    return r;
  }));
}

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  // float just above the action buttons, so the board stays visible
  t.style.top = `${Math.max(8, $("actions").getBoundingClientRect().top - t.offsetHeight - 10)}px`;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3400);
}

document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (e.key === "Enter") typeKey("ENTER");
  else if (e.key === "Backspace") typeKey("BACK");
  else if (/^[a-z]$/i.test(e.key)) typeKey(e.key.toUpperCase());
  else return;
  e.preventDefault();
});
$("menuBtn").addEventListener("click", openMenu);
$("fieldsBtn").addEventListener("click", () => $("fieldsDlg").showModal());
$("fieldsClose").addEventListener("click", () => $("fieldsDlg").close());
$("fieldsDlg").addEventListener("click", e => { if (e.target === $("fieldsDlg")) $("fieldsDlg").close(); });
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("doneNew").addEventListener("click", () => { $("doneDlg").close(); newBoard(); });
$("checkBtn").addEventListener("click", check);
$("clearBtn").addEventListener("click", clear);
$("level").addEventListener("change", e => newBoard(e.target.value));
window.addEventListener("resize", () => render());
window.visualViewport?.addEventListener("resize", () => render());   // Safari's bars coming and going

// ---------- start ----------
document.querySelector(".g-mark").innerHTML = APPS.find(a => a.id === "glyph").logo;
bindSwitcher($("appsBtn"), "glyph");
buildKeyboard();
const params = new URLSearchParams(location.search);
const code = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const hash = Object.fromEntries(location.hash.slice(1).split("&").filter(Boolean).map(p => p.split("=")));
S = loadSolo();
if (hash.s && hash.d && (!S || String(S.seed) !== hash.s || S.level !== hash.d)) soloBoard(+hash.s, ["easy", "medium", "hard"].includes(hash.d) ? hash.d : "easy");
else if (!S) soloBoard(randomSeed(), "easy");
else { shownDone = S.done ? JSON.stringify(S.done) : null; history.replaceState(null, "", `${location.pathname}${location.search}#s=${S.seed}&d=${S.level}`); render(); }
if (code.length === 4) join(code).then(ok => { if (!ok) setRoomParam(null); });
window.__glyph = { get state() { return S; }, get room() { return room; }, get slot() { return S && currentSlot(); }, get cursor() { return cursor; } };
