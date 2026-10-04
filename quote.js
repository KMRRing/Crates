// Quote: ten numbers, a two-sided market on each. The engine (quote-engine.js) settles a market; this file runs
// the set, draws the card and the tape, and keeps bests.
import { START, PER_SET, settle, fault, pickSet, withUnit, fmt } from "./quote-engine.js";
import { QUOTES, CATS } from "./quote-bank.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const RUN = "quote:run", BEST = "quote:best", DAILY = "quote:daily";
const byId = new Map(QUOTES.map(q => [q.id, q]));

let S = null;      // { seed, mode: "random" | "daily", set: [ids], index, book, log: [{ id, bid, ask, delta, inside, width }], phase: "quote" | "reveal", done }

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const money = n => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-GB");
const signed = n => (n >= 0 ? "+" : "−") + Math.abs(n).toLocaleString("en-GB");

// ---------- the run ----------
function start(mode) {
  const seed = mode === "daily" ? today() : randomSeed();
  S = { seed, mode, set: pickSet(seed, QUOTES).map(q => q.id), index: 0, book: START, log: [], phase: "quote", done: false };
  save();
  history.replaceState(null, "", mode === "daily" ? `#d=${seed}` : `#s=${seed}`);
  render();
}
function save() { write(RUN, S); }
const current = () => byId.get(S.set[S.index]);

/** Your quote: settles against the book and shows where the truth fell. */
function quote() {
  if (S.phase !== "quote") return;
  const q = current(), bid = parse($("bid").value), ask = parse($("ask").value);
  const why = fault(q, bid, ask);
  if (why) { $("fault").textContent = why; return; }
  const r = settle(q, bid, ask);
  S.book += r.delta;
  S.log.push({ id: q.id, bid, ask, delta: r.delta, inside: r.inside, width: r.width, beyond: r.beyond });
  S.phase = "reveal";
  save();
  render();
}
function next() {
  if (S.phase !== "reveal") return;
  if (S.index + 1 >= S.set.length) { S.done = true; save(); finish(); return; }
  S.index++;
  S.phase = "quote";
  save();
  render();
  $("bid").focus();
}
const parse = s => { const n = Number(String(s).replace(/,/g, "").trim()); return s.trim() === "" ? NaN : n; };

// ---------- drawing ----------
function render() {
  const q = current();
  $("where").textContent = `Question ${S.index + 1} of ${S.set.length}`;
  const book = $("book");
  book.textContent = money(S.book);
  book.className = S.book > START ? "up" : S.book < START ? "down" : "";
  $("cat").textContent = CATS[q.cat];
  $("question").textContent = q.q;
  $("unit").textContent = q.unit === "year" ? "A year" : `In ${q.unit}`;
  const entry = S.log[S.index];
  $("bid").value = entry ? fmt(entry.bid, q) : "";
  $("ask").value = entry ? fmt(entry.ask, q) : "";
  $("bid").disabled = $("ask").disabled = !!entry;
  $("fault").textContent = "";
  $("quoteBtn").hidden = !!entry;
  drawWidths(q);
  const result = $("result");
  result.hidden = !entry;
  if (entry) {
    const v = $("verdict");
    v.className = `qt-verdict ${entry.inside ? "good" : "bad"}`;
    v.textContent = entry.inside ? `Inside: ${signed(entry.delta)}` : `Outside, ${beyondText(q, entry)}: ${signed(entry.delta)}`;
    drawTape(q, entry);
    // the note usually opens with the figure itself; when it doesn't, lead with it
    $("note").textContent = /^(About|Roughly|Around|[\d$£€])/.test(q.note) ? q.note : `${withUnit(q.truth, q)}. ${q.note}`;
    $("nextBtn").textContent = S.index + 1 >= S.set.length ? "Closing bell" : "Next";
  }
}
function beyondText(q, e) {
  const above = q.truth > e.ask;
  if (q.scale === "log") { const ratio = above ? q.truth / e.ask : e.bid / q.truth; return `${ratio.toFixed(ratio < 10 ? 1 : 0)}× ${above ? "above your ask" : "below your bid"}`; }
  const gap = above ? q.truth - e.ask : e.bid - q.truth;
  return `${fmt(gap, { unit: "" })} ${q.unit === "year" ? "years" : q.unit} ${above ? "above your ask" : "below your bid"}`;
}

/** The shortcuts: set a market of a given width around what you've typed (one number, or the middle of two). */
function drawWidths(q) {
  const box = $("widths");
  box.replaceChildren();
  const log = q.scale === "log";
  const steps = log ? [0.05, 0.1, 0.25, 0.5] : [0.08, 0.2, 0.4, 1].map(x => nice(x * q.scale));
  for (const w of steps) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = log ? `±${Math.round(w * 100)}%` : `±${w}`;
    b.disabled = S.phase !== "quote";
    b.addEventListener("click", () => {
      const bid = parse($("bid").value), ask = parse($("ask").value);
      const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (log ? Math.sqrt(bid * ask) : (bid + ask) / 2) : Number.isFinite(bid) ? bid : Number.isFinite(ask) ? ask : NaN;
      if (!Number.isFinite(mid) || (log && mid <= 0)) { $("fault").textContent = "Type a number first; the shortcuts set the width around it."; return; }
      const lo = log ? mid / (1 + w) : mid - w, hi = log ? mid * (1 + w) : mid + w;
      $("bid").value = fmt(round(lo, q), q);
      $("ask").value = fmt(round(hi, q), q);
      $("fault").textContent = "";
    });
    box.appendChild(b);
  }
}
const nice = x => { const p = 10 ** Math.floor(Math.log10(x)); return Math.round(x / p) * p; };
const round = (v, q) => (q.scale === "log" ? Number(v.toPrecision(3)) : q.scale >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

/** The tape: a rail with your bid and ask as a span and the truth as a tick, on the question's own scale. */
function drawTape(q, e) {
  const tape = $("tape");
  tape.replaceChildren();
  const log = q.scale === "log";
  const f = log ? Math.log2 : x => x;
  const lo = Math.min(e.bid, q.truth), hi = Math.max(e.ask, q.truth);
  const pad = log ? 0.6 : q.scale * 0.6;
  const left = log ? f(lo) - pad : lo - pad, right = log ? f(hi) + pad : hi + pad;
  const x = v => `${((f(v) - left) / (right - left) * 100).toFixed(1)}%`;
  const add = (cls, style, text) => { const d = document.createElement("div"); d.className = cls; Object.assign(d.style, style); if (text != null) d.textContent = text; tape.appendChild(d); return d; };
  add("rail", {});
  add("span", { left: x(e.bid), width: `calc(${x(e.ask)} - ${x(e.bid)})` });
  add("lbl", { left: x(e.bid) }, fmt(e.bid, q));
  add("lbl", { left: x(e.ask) }, fmt(e.ask, q));
  add(`truth ${e.inside ? "good" : "bad"}`, { left: x(q.truth) });
  add("lbl t", { left: x(q.truth) }, fmt(q.truth, q));
}

// ---------- the closing bell ----------
function finish() {
  const inside = S.log.filter(e => e.inside).length;
  const widths = S.log.map(e => e.width), avgWidth = widths.reduce((t, w) => t + w, 0) / widths.length;
  const best = S.mode === "daily" ? bestDaily(S.book) : bestEver(S.book);
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "qt-big", money(S.book));
  const stats = add("div", "qt-stats");
  for (const [v, label] of [[`${inside} of ${S.log.length}`, "inside"], [`×${(2 ** avgWidth).toFixed(1)}`, "average width"], [signed(S.book - START), "on the set"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const lines = add("ul", "qt-lines");
  for (const e of S.log) {
    const q = byId.get(e.id), li = document.createElement("li"), name = document.createElement("span"), delta = document.createElement("b");
    name.textContent = q.q.length > 44 ? `${q.q.slice(0, 42)}…` : q.q;
    delta.textContent = signed(e.delta);
    delta.className = e.delta >= 0 ? "good" : "bad";
    li.append(name, delta);
    lines.appendChild(li);
  }
  add("p", "stats", `${S.mode === "daily" ? "Today's best" : "Your best"}: ${money(best)}. Tight and inside earns most; wider than 4× earns nothing; outside costs 150 a doubling, up to 600.`);
  const again = add("button", "btn primary wide", "Again");
  again.type = "button";
  again.addEventListener("click", () => { $("doneDlg").close(); start("random"); });
  const daily = add("button", "btn wide", S.mode === "daily" ? "A random set" : "Today's set");
  daily.type = "button";
  daily.addEventListener("click", () => { $("doneDlg").close(); start(S.mode === "daily" ? "random" : "daily"); });
  const link = add("button", "btn wide", "Copy a link to this set");
  link.type = "button";
  link.addEventListener("click", copyLink);
  if (!$("doneDlg").open) $("doneDlg").showModal();
}
function bestEver(book) { const b = Math.max(read(BEST, -Infinity), book); write(BEST, b); return b; }
function bestDaily(book) { const d = read(DAILY, {}); d[today()] = Math.max(d[today()] ?? -Infinity, book); write(DAILY, d); return d[today()]; }

// ---------- menu, links, messages ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
async function copyLink() {
  const link = `${location.origin}${location.pathname}${S.mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  add("p", "stats", "Make a market on a number: a bid and an ask. Inside pays more the tighter your market; outside costs more the further out the truth lies. Ten questions, a book of 1,000 to start.");
  button("A new set", () => confirmStart("random"));
  button("Today's set", () => confirmStart("daily"));
  if (S?.done) button("See how it went", finish);
  button("Copy a link to this set", copyLink);
  const best = read(BEST, null), daily = read(DAILY, {})[today()];
  add("p", "stats", `${best != null ? `Your best book: ${money(best)}.` : "No finished set yet."}${daily != null ? ` Today's best: ${money(daily)}.` : ""}`);
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new set? This one isn't finished.")) return;
  start(mode);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "quote");
document.querySelector(".qt-mark").innerHTML = APPS.find(a => a.id === "quote").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("quoteBtn").addEventListener("click", quote);
$("nextBtn").addEventListener("click", next);
for (const id of ["bid", "ask"]) $(id).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (id === "bid" && !$("ask").value) $("ask").focus(); else quote(); } });
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (h.get("s") || h.get("d")) load(h); });

/** A linked set: #s=seed for a random one, #d=YYYYMMDD for a day's. */
function load(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random";
  if (!seed) return false;
  if (S && S.seed === seed && S.mode === mode) return true;
  S = { seed, mode, set: pickSet(seed, QUOTES).map(q => q.id), index: 0, book: START, log: [], phase: "quote", done: false };
  save();
  render();
  return true;
}

// for tests and debugging
window.__quote = { get state() { return S; }, quote, next, start };

S = read(RUN, null);
if (S && (!S.set || !S.set.every(id => byId.has(id)))) S = null;    // the bank changed under a saved run
const hash = new URLSearchParams(location.hash.slice(1));
if (!load(hash)) {
  if (!S) start("random");
  else { history.replaceState(null, "", S.mode === "daily" ? `#d=${S.seed}` : `#s=${S.seed}`); render(); }
}
if (S.done) finish();
