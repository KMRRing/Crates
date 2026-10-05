// Deck: the pile, reviewed. What the knowledge games banked comes back here in its own form: Punt's questions
// as options, Crates' clues as which-answer, Chart's places as which-country, Quote's numbers as a number judged
// in the question's own range, Rush's puzzles on the board. Right moves an item up a pile; wrong drops it back.
import * as pile from "./pile.js";
import { PILES, GAMES } from "./pile.js";
import { BANK } from "./core.js";
import { PLACES } from "./chart-bank.js";
import { GEO } from "./chart-geo.js";
const geoById = new Map(GEO.map(g => [`geo-${g.id}`, { id: `geo-${g.id}`, name: g.name, note: g.note, country: g.country, region: g.region, geo: g }]));
import { QUOTES } from "./quote-bank.js";
import { tiersOf, withUnit, tierText } from "./quote-engine.js";
import { mountPuzzle, solutionSan } from "./chess-board.js";
import { bindSwitcher, APPS } from "./apps.js";
import { setRich } from "./rich.js";
import { showPicture } from "./pics.js";
import { SUBJECTS, SUBJECT } from "./kb-index.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const MAX_REVIEW = 40;
let session = null;    // { items, at, right, wrong }
let board = null;
let picked = [];
let answered = false;  // the card on show has been answered: Enter (or, on a typed card, typing) moves on
let submitTyped = null;

const placeById = new Map(PLACES.map(p => [p.id, p]));
const quoteById = new Map(QUOTES.map(q => [q.id, q]));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (r, xs) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
const seedOf = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- the overview ----------
function overview() {
  $("overview").hidden = false;
  $("review").hidden = true;
  board?.destroy(); board = null;
  const c = pile.counts();
  $("lead").textContent = c.total ? `What you missed, passed on or barely staked on, brought back until you know it. Right moves an item up a pile; wrong drops it to the first. ${c.due ? `${c.due} due now.` : "Nothing due yet."}`
    : "Nothing banked yet. Play Punt, Quote, Chart, Crates or Rush: what you miss, pass on or stake 20% or less on lands here, and comes back until you know it.";
  $("piles").replaceChildren(...PILES.map((p, i) => {
    const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span"), small = document.createElement("small");
    b.textContent = String(c.piles[i]); s.textContent = p.name; small.textContent = p.gap ? gapText(p.gap) : "at once";
    d.append(b, s, small);
    return d;
  }), (() => { const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span"); b.textContent = String(c.learned); s.textContent = "Learned"; d.append(b, s); d.style.gridColumn = "1 / -1"; return d; })());
  $("games").replaceChildren(...Object.entries(GAMES).map(([id, name]) => {
    const g = pile.counts(id);
    if (!g.total) return null;
    const d = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = name;
    s.textContent = `${g.due ? `${g.due} due · ` : ""}${g.total - g.learned} in the piles · ${g.learned} learned`;
    s.className = g.due ? "due" : "";
    d.append(b, s);
    return d;
  }).filter(Boolean));
  drawSubjects();
  $("reviewBtn").textContent = c.due ? `Review ${Math.min(c.due, MAX_REVIEW)} due` : "Nothing to review";
  $("reviewBtn").disabled = !c.due;
}
/**
 * Coverage by subject, across the games: for each subject of the knowledge base, how many of its things the pile is
 * working on with you (due now, and in the piles) and how many you've learned there, of how many it holds. A thing
 * counts once, whichever games asked about it. Subjects you haven't touched stay off the list.
 */
function drawSubjects() {
  const per = new Map();
  for (const it of pile.all()) for (const id of new Set(it.about || [])) {
    const s = SUBJECT[id];
    if (s === undefined) continue;
    const row = per.get(s) || per.set(s, { working: new Set(), due: new Set(), learned: new Set() }).get(s);
    if (it.learned) row.learned.add(id); else { row.working.add(id); if (it.due <= Date.now()) row.due.add(id); }
  }
  for (const row of per.values()) for (const id of row.working) row.learned.delete(id);   // learned only once nothing about it is still open
  const rows = [...per.entries()].sort((a, b) => b[1].working.size - a[1].working.size || b[1].learned.size - a[1].learned.size);
  $("subjectsHead").hidden = !rows.length;
  $("subjects").replaceChildren(...rows.map(([s, r]) => {
    const d = document.createElement("div"), b = document.createElement("b"), span = document.createElement("span"), bar = document.createElement("i"), fill = document.createElement("em");
    b.textContent = SUBJECTS[s].label;
    span.textContent = `${r.working.size ? `${r.working.size} to learn${r.due.size ? ` (${r.due.size} due)` : ""}` : ""}${r.working.size && r.learned.size ? " · " : ""}${r.learned.size ? `${r.learned.size} learned` : ""} of ${SUBJECTS[s].total}`;
    if (r.due.size) span.className = "due";
    fill.style.width = `${Math.min(100, (r.learned.size / SUBJECTS[s].total) * 100).toFixed(1)}%`;
    bar.appendChild(fill);
    bar.title = `${r.learned.size} of ${SUBJECTS[s].total} learned`;
    d.append(b, span, bar);
    return d;
  }));
}
const gapText = ms => (ms >= 86400000 ? `${Math.round(ms / 86400000)} day${ms >= 2 * 86400000 ? "s" : ""}` : ms >= 3600000 ? `${Math.round(ms / 3600000)} hours` : `${Math.round(ms / 60000)} min`);

// ---------- the review ----------
function startReview() {
  const items = pile.due().slice(0, MAX_REVIEW);
  if (!items.length) { overview(); return; }
  session = { items, at: 0, right: 0, wrong: 0 };
  $("overview").hidden = true;
  $("review").hidden = false;
  ask();
}
function ask() {
  const it = session.items[session.at];
  board?.destroy(); board = null;
  picked = [];
  answered = false;
  $("progress").textContent = `${session.at + 1} of ${session.items.length}`;
  $("source").textContent = `${GAMES[it.game] || it.game} · ${PILES[it.pile].name.toLowerCase()} pile`;
  $("verdict").textContent = ""; $("verdict").className = "dk-verdict";
  $("note").textContent = "";
  $("nextBtn").hidden = true;
  $("figure").hidden = true;
  const box = $("answerBox");
  box.className = "dk-answer";
  // a typed card after a typed card keeps the field, and with it the focus (and a phone's keyboard)
  if (!(it.game === "quote" && field && box.contains(field.wrap))) box.replaceChildren();
  const r = rng(seedOf(it.id) ^ Date.now());
  if (it.game === "punt" || (it.payload?.prompt && it.payload?.options)) {
    const p = it.payload;
    $("ask").textContent = p.ask || "";
    setRich($("prompt"), p.prompt);
    if (p.svg) { $("figure").innerHTML = p.svg; $("figure").hidden = false; }
    if (p.pic) { const box = document.createElement("div"); box.className = "dk-figure"; $("figure").replaceChildren(box); $("figure").hidden = false; showPicture(box, p.pic); }
    if (p.code) { const pre = document.createElement("pre"); pre.className = "dk-code"; pre.textContent = p.code; $("figure").replaceChildren(pre); $("figure").hidden = false; }
    options(p.options, p.right, p.need || 1, p.note);
  } else if (it.game === "crates") {
    const p = it.payload;
    $("ask").textContent = `Crates · ${p.cat === "country" ? "which country" : "which commodity"}`;
    $("prompt").textContent = `${p.word}: ${p.hint}`;
    const pool = BANK.filter(a => a.cat === p.cat && a.name !== p.answer).map(a => a.name);
    const opts = shuffle(r, [p.answer, ...shuffle(r, pool).slice(0, 3)]);
    options(opts, [opts.indexOf(p.answer)], 1, `${p.answer}: ${p.word} — ${p.hint}`);
  } else if (it.game === "chart") {
    const place = placeById.get(it.key) || geoById.get(it.key);
    if (!place) { skip(); return; }
    if (place.geo) {                                           // a feature: which countries is it in
      $("ask").textContent = `Chart · physical`;
      $("prompt").textContent = `Where is ${place.name}?`;
      const pool = [...new Set(GEO.filter(g => g.region === place.geo.region && g.country !== place.country).map(g => g.country))];
      const opts = shuffle(r, [place.country, ...shuffle(r, pool).slice(0, 3)]);
      options(opts, [opts.indexOf(place.country)], 1, `${place.name}: ${place.note}`);
      return;
    }
    $("ask").textContent = `Chart · ${place.cat}`;
    $("prompt").textContent = `Which country is ${place.name} in?`;
    const pool = [...new Set(PLACES.filter(p => p.region === place.region && p.country !== place.country).map(p => p.country))];
    const opts = shuffle(r, [place.country, ...shuffle(r, pool).slice(0, 3)]);
    options(opts, [opts.indexOf(place.country)], 1, `${place.name}, ${place.country}: ${place.note}`);
  } else if (it.game === "quote") {
    const q = quoteById.get(it.key);
    if (!q) { skip(); return; }
    $("ask").textContent = `Quote · an A is ${tierText(q, "A")}`;
    $("prompt").textContent = `${q.q}${q.unit && q.unit !== "year" ? ` (${q.unit})` : ""}`;
    if (q.pic) { const box = document.createElement("div"); box.className = "dk-figure"; $("figure").replaceChildren(box); $("figure").hidden = false; showPicture(box, q.pic); }
    const { wrap, input, go } = numberField();
    input.value = "";
    go.disabled = false;
    wrap.classList.remove("done");
    submitTyped = () => {
      const v = Number(String(input.value).replace(/[^0-9.\-]/g, ""));
      if (!Number.isFinite(v) || input.value.trim() === "") { toast("Give a number"); return; }
      const A = tiersOf(q).A;
      const right = q.scale === "log" ? v > 0 && Math.abs(Math.log2(v / q.truth)) <= Math.log2(1 + A) : Math.abs(v - q.truth) <= A;
      go.disabled = true;
      wrap.classList.add("done");
      settle(right, `${right ? "Close enough" : "Not close"}: it's ${withUnit(q.truth, q)}. ${q.note || ""}`);
    };
    if (!box.contains(wrap)) box.appendChild(wrap);
    input.focus();                                   // at once, not later: a phone only raises its keyboard inside the tap or key that got here
  } else if (it.game === "parley") {
    const p = it.payload;
    $("ask").textContent = `Parley · ${{ zh: "Chinese", fr: "French", de: "German" }[p.course] || p.course}`;
    $("prompt").textContent = `${p.w}${p.py ? ` (${p.py})` : ""}`;
    const pool = pile.all("parley").filter(x => x.payload?.course === p.course && x.key !== it.key).map(x => x.payload.en);
    const opts = shuffle(r, [p.en, ...shuffle(r, [...new Set(pool)]).slice(0, 3)]);
    while (opts.length < 2) opts.push("—");
    options(opts, [opts.indexOf(p.en)], 1, `${p.w}: ${p.en}. ${p.ex?.l2 || ""} — ${p.ex?.en || ""}`);
  } else if (it.game === "rush") {
    const p = it.payload;
    const side = p.fen.split(" ")[1] === "w" ? "Black" : "White";
    $("ask").textContent = `Rush · puzzle rated ${p.rating}${p.themes?.length ? ` · ${p.themes.join(", ")}` : ""}`;
    $("prompt").textContent = `${side} to move`;
    const holder = document.createElement("div");
    box.appendChild(holder);
    board = mountPuzzle(holder, p, { interactive: true, onDone: solved => settle(solved, `${solved ? "Solved." : "Not that one."} The line: ${solutionSan(p).join(" ")}`) });
  } else { skip(); }
}
/** Multiple choice: one tap answers when one is needed; several then Answer when more are. */
function options(labels, right, need, note) {
  const box = $("answerBox");
  box.className = `dk-answer${labels.every(l => l.length <= 18) ? " two" : ""}`;
  const buttons = labels.map((label, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "dk-option"; setRich(b, label); b.setAttribute("role", need > 1 ? "checkbox" : "radio"); b.setAttribute("aria-checked", "false");
    b.addEventListener("click", () => {
      if (need === 1) { picked = [i]; judge(); return; }
      picked = picked.includes(i) ? picked.filter(x => x !== i) : [...picked, i];
      b.setAttribute("aria-checked", String(picked.includes(i)));
      if (picked.length === need) judge();
    });
    return b;
  });
  box.replaceChildren(...buttons);
  if (need > 1) { const p = document.createElement("p"); p.className = "dk-ask"; p.textContent = `Pick ${need}.`; box.prepend(p); p.style.gridColumn = "1 / -1"; }
  function judge() {
    const ok = picked.length === right.length && picked.every(i => right.includes(i));
    buttons.forEach((b, i) => { b.disabled = true; if (right.includes(i)) b.classList.add("right"); else if (picked.includes(i)) b.classList.add("wrong"); });
    settle(ok, note);
  }
}
function settle(right, note) {
  answered = true;
  const it = session.items[session.at];
  const after = pile.answer(it.game, it.key, right);
  session[right ? "right" : "wrong"]++;
  const v = $("verdict");
  v.className = `dk-verdict ${right ? "good" : "bad"}`;
  v.textContent = right ? (after?.learned ? "Right: learned." : `Right: up to the ${PILES[after.pile].name.toLowerCase()} pile, back in ${PILES[after.pile].gap ? gapText(PILES[after.pile].gap) : "a moment"}.`) : "Wrong: back to the ultra-short pile.";
  setRich($("note"), note || "");
  $("nextBtn").hidden = false;
  $("nextBtn").textContent = session.at + 1 < session.items.length ? "Next" : "Finish";
}
/**
 * The field for typed answers, made once and kept: it stays focused from one typed card to the next, so you can go
 * type, Enter, type, Enter. Enter answers, and once answered Enter moves on; so does typing, which starts the next
 * card with what you typed.
 */
let field = null;
function numberField() {
  if (field) return field;
  const wrap = document.createElement("div");
  wrap.className = "dk-number";
  const input = document.createElement("input");
  Object.assign(input, { type: "text", inputMode: "decimal", placeholder: "Your number", autocomplete: "off", enterKeyHint: "go" });
  input.setAttribute("aria-label", "Your number");
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = "Answer";
  go.addEventListener("click", () => submitTyped?.());
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (answered) next(); else submitTyped?.();
  });
  input.addEventListener("beforeinput", e => {
    if (!answered || !e.inputType.startsWith("insert")) return;
    e.preventDefault();
    next();
    if (!answered && input.isConnected) input.value = e.data || "";
  });
  wrap.append(input, go);
  return (field = { wrap, input, go });
}
function skip() { session.items.splice(session.at, 1); if (session.at >= session.items.length) finish(); else ask(); }
function next() {
  if (session.at + 1 < session.items.length) { session.at++; ask(); return; }
  finish();
}
function finish() {
  board?.destroy(); board = null;
  const c = pile.counts();
  $("overview").hidden = false;
  $("review").hidden = true;
  overview();
  if (session) toast(`${session.right} right, ${session.wrong} wrong. ${c.due ? `${c.due} still due.` : "Nothing more due now."}`, 5000);
  session = null;
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
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "stats", `Four piles with growing gaps: ultra-short (due at once), short (${gapText(PILES[1].gap)}), medium (${gapText(PILES[2].gap)}), long (${gapText(PILES[3].gap)}). An item enters at the first when you miss it, pass on it or stake 20% or less (Punt), quote a B or worse (Quote), pin it over 500 km off or with a clue (Chart), get its crate wrong (Crates), miss the puzzle (Rush), or can't name the wine before the palate (Brut); Parley's and Brut's new cards start there too. Right here or in the game moves it up; right in the long pile and it's learned.`);
  const learn = add("button", "btn wide", `Learning mode: ${pile.learning() ? "on" : "off"}`);
  learn.type = "button";
  learn.addEventListener("click", () => { pile.setLearning(!pile.learning()); openMenu(); });
  add("p", "stats", "With learning mode on, Punt, Quote and Chart lead their next blocks with what's due from the pile, up to half a block, and fill the rest with what you haven't seen; Crates runs its own learn mode. Off, the games deal as they always did and still bank what you miss.");
  const clear = add("button", "btn wide", "Forget everything");
  clear.type = "button";
  clear.addEventListener("click", () => { if (confirm("Empty the pile? Every banked item goes.")) { pile.clear(); $("menuDlg").close(); overview(); } });
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "deck");
document.querySelector(".dk-mark").innerHTML = APPS.find(a => a.id === "deck").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("reviewBtn").addEventListener("click", startReview);
$("nextBtn").addEventListener("click", next);
// the keyboard, for a card without a field: 1 to 9 pick an option, Enter moves on once it's answered
document.addEventListener("keydown", e => {
  if (!session || $("review").hidden || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, select, dialog")) return;
  if (e.key === "Enter" && answered && !e.target.closest?.("button")) { e.preventDefault(); next(); return; }
  const n = Number(e.key), option = !answered && n >= 1 ? $("answerBox").querySelectorAll(".dk-option")[n - 1] : null;
  if (option && !option.disabled) { e.preventDefault(); option.click(); }
});
window.__deck = { get session() { return session; }, startReview, overview, pile };
overview();
