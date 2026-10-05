// Quote: ten numbers, a two-sided market on each. The engine (quote-engine.js) settles a market; this file runs
// the set, draws the card and the tape, and keeps bests. Together, the room holds the set and you alternate: one
// makes the market, the other hits it, lifts it or passes (together.js).
import { START, PER_SET, settle, fault, trade, pickSet, withUnit, fmt, tiersText, tiersOf, adequate } from "./quote-engine.js";
import { QUOTES, CATS } from "./quote-bank.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether, seatsOf } from "./together.js";
import { gameHref, GAMES } from "./rooms.js";
import * as pile from "./pile.js";
import { showPicture } from "./pics.js";
/** A picture with the question, when it has one: a painting to date. */
function picture(q) {
  const pic = $("picture");
  if (!q.pic) { pic.hidden = true; pic.dataset.title = ""; return; }
  if (pic.dataset.title !== q.pic) { pic.dataset.title = q.pic; showPicture(pic, q.pic); }
}
import "./pwa.js";

const $ = id => document.getElementById(id);
const APP = 1;                       // this code's version of the together state
const RUN = "quote:run", BEST = "quote:best", DAILY = "quote:daily";
const byId = new Map(QUOTES.map(q => [q.id, q]));

let S = null;      // alone: { seed, mode: "random" | "daily", set: [ids], index, book, log: [{ id, bid, ask, delta, inside, width }], phase: "quote" | "reveal", done }
                   // together: the room's state: { seed, set, index, phase: "make" | "take" | "reveal", market, take, books: [2], log, done, players }
const inRoom = () => !!together.room;
const mySeat = () => together.room?.data?.players?.[together.room.uid]?.slot ?? 0;
const makerOf = g => g.index % 2;            // the maker alternates each question
const seatName = seat => { const p = seatsOf(together.room?.data)?.find(([, x]) => x.slot === seat)?.[1]; return p ? p.name : seat === mySeat() ? "You" : "Your partner"; };

const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const money = n => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-GB");
const signed = n => (n >= 0 ? "+" : "−") + Math.abs(n).toLocaleString("en-GB");

// ---------- the run ----------
/** The questions a set draws from: everything, or one category only (a focus), with the category cap lifted. */
const setFor = (seed, focus) => {
  const pool = focus ? QUOTES.filter(q => q.cat === focus) : QUOTES;
  // learning mode: what's due leads the set (up to half of it), the rest dealt as usual around it
  // and questions about what the other games found you weak on, in Quote's form
  const own = pile.learning() ? pile.due("quote").map(it => it.key).filter(id => pool.some(q => q.id === id)).slice(0, Math.ceil(PER_SET / 2)) : [];
  const due = pile.learning() ? pile.dealDue("quote", pool.map(q => ({ key: q.id, about: q.about ? [q.about] : [] })), own, Math.ceil(PER_SET / 2)) : [];
  const rest = pickSet(seed, pool.filter(q => !due.includes(q.id)), PER_SET - due.length, focus ? PER_SET : 2).map(q => q.id);
  const set = [...rest];
  due.forEach((id, i) => set.splice(Math.min(set.length, Math.floor((i + 0.5) * PER_SET / due.length)), 0, id));
  return set;
};
const hashFor = s => `${s.mode === "daily" ? `#d=${s.seed}` : `#s=${s.seed}`}${s.focus ? `&f=${s.focus}` : ""}`;
function start(mode, focus = null) {
  const seed = mode === "daily" ? today() : randomSeed();
  S = { seed, mode, focus, set: setFor(seed, focus), index: 0, book: START, log: [], phase: "quote", done: false };
  save();
  history.replaceState(null, "", hashFor(S));
  render();
}
function save() { if (!inRoom()) write(RUN, S); }
const current = () => byId.get(S.set[S.index]);

/** Your quote: alone, settles against the book; together, goes to your partner to hit, lift or pass. */
function quote() {
  const q = current(), bid = parse($("bid").value), ask = parse($("ask").value);
  const why = fault(q, bid, ask);
  if (why) { $("fault").textContent = why; return; }
  if (inRoom()) {
    together.act(g => { if (g.phase !== "make" || makerOf(g) !== mySeat()) return false; g.market = { bid, ask }; g.take = null; g.phase = "take"; });
    return;
  }
  if (S.phase !== "quote") return;
  const r = settle(q, bid, ask);
  // the pile: a B or below means you didn't adequately know it; an A or better moves a banked question up
  if (!adequate(r.grade)) pile.record("quote", q.id, { id: q.id, pic: q.pic || null, about: q.about ? [q.about] : undefined }, r.inside ? "wide" : "wrong");
  else if (pile.has("quote", q.id)) pile.answer("quote", q.id, true);
  S.book += r.delta;
  S.log.push({ id: q.id, bid, ask, delta: r.delta, inside: r.inside, width: r.width, beyond: r.beyond, grade: r.grade });
  S.phase = "reveal";
  save();
  render();
}
/** Together: the taker's choice on the maker's market. */
function take(kind) {
  together.act(g => {
    if (g.phase !== "take" || makerOf(g) === mySeat()) return false;
    const q = byId.get(g.set[g.index]), r = trade(q, g.market.bid, g.market.ask, kind), maker = makerOf(g);
    g.books = Object.values(g.books);
    g.books[maker] += r.maker;
    g.books[1 - maker] += r.taker;
    g.log = Object.values(g.log || {});
    g.log.push({ id: q.id, bid: g.market.bid, ask: g.market.ask, take: kind, maker, deltaMaker: r.maker, deltaTaker: r.taker, inside: q.truth >= g.market.bid && q.truth <= g.market.ask, edge: r.edge });
    g.take = kind;
    g.phase = "reveal";
  });
}
function next() {
  if (inRoom()) {
    together.act(g => {
      if (g.phase !== "reveal") return false;
      if (g.index + 1 >= g.set.length) { g.done = true; return; }
      g.index++; g.market = null; g.take = null; g.phase = "make";
    });
    return;
  }
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
  if (!S) return;
  if (inRoom()) { renderRoom(); return; }
  $("where").textContent = `Question ${S.index + 1} of ${S.set.length}`;
  const q = current();
  const books = $("books");
  books.replaceChildren("Book ");
  const book = document.createElement("b");
  book.id = "book";
  book.textContent = money(S.book);
  book.className = S.book > START ? "up" : S.book < START ? "down" : "";
  books.appendChild(book);
  $("waiting").hidden = true;
  $("takeBox").hidden = true;
  $("market").hidden = false;
  $("widths").hidden = false;
  $("cat").textContent = CATS[q.cat];
  $("question").textContent = q.q;
  picture(q);
  $("unit").textContent = `${q.unit === "year" ? "A year" : `In ${q.unit}`} · ${tiersText(q)}`;
  const entry = S.log[S.index];
  $("bid").value = entry ? fmt(entry.bid, q) : "";
  $("ask").value = entry ? fmt(entry.ask, q) : "";
  $("bid").disabled = $("ask").disabled = !!entry;
  $("fault").textContent = "";
  $("quoteBtn").hidden = !!entry;
  drawWidths(q);
  const result = $("result");
  result.hidden = !entry;
  $("card").classList.toggle("settled", !!entry);             // the tape shows your market against the truth
  if (entry) {
    const v = $("verdict");
    const grade = entry.grade || (entry.inside ? "A" : "C");
    v.className = `qt-verdict ${adequate(grade) ? "good" : "bad"}`;
    const word = { SS: "exact", S: "sharp", A: "adequate", B: "pushing it", C: "a miss" }[grade];
    v.textContent = `${grade}, ${word}${entry.inside ? "" : `; outside, ${beyondText(q, entry)}`}: ${signed(entry.delta)}`;
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

/** The shortcuts: set a market of a tier's radius around what you've typed (one number, or the middle of two). */
function drawWidths(q) {
  const box = $("widths");
  box.replaceChildren();
  const log = q.scale === "log";
  const T = tiersOf(q);
  for (const g of ["S", "A", "B"]) {
    const w = T[g];
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${g} ${log ? `±${Math.round(w * 100)}%` : `±${w}`}`;
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
const nice = x => { const p = 10 ** Math.floor(Math.log10(x)); return Math.round(x / p * 2) * p / 2; };
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

/** Together: what each of you sees in each phase. */
function renderRoom() {
  const g = S, q = current(), me = mySeat(), maker = makerOf(g), isMaker = me === maker;
  $("where").textContent = `Question ${g.index + 1} of ${g.set.length}`;
  const books = $("books");
  books.className = "qt-books";
  books.replaceChildren();
  for (const seat of [me, 1 - me]) {
    const b = document.createElement("b");
    b.textContent = `${seatName(seat)} ${money(Object.values(g.books)[seat])}`;
    books.appendChild(b);
  }
  $("cat").textContent = CATS[q.cat];
  $("question").textContent = q.q;
  picture(q);
  $("unit").textContent = `${q.unit === "year" ? "A year" : `In ${q.unit}`} · ${tiersText(q)}`;
  $("fault").textContent = "";
  const entry = g.log && Object.values(g.log)[g.index];
  const making = g.phase === "make" && isMaker, taking = g.phase === "take" && !isMaker;
  $("market").hidden = !(making || g.phase === "reveal");
  $("widths").hidden = !making;
  $("quoteBtn").hidden = !making;
  if (!making) { $("bid").disabled = $("ask").disabled = true; }
  if (making) { $("bid").disabled = $("ask").disabled = false; if (document.activeElement !== $("ask")) $("bid").value = $("bid").value; drawWidths(q); }
  if (g.phase === "reveal" && entry) { $("bid").value = fmt(entry.bid, q); $("ask").value = fmt(entry.ask, q); }
  const waiting = $("waiting");
  waiting.hidden = !((g.phase === "make" && !isMaker) || (g.phase === "take" && isMaker));
  waiting.textContent = g.phase === "make" ? `${seatName(maker)} is making the market…` : `${seatName(1 - maker)} is looking at your market…`;
  const box = $("takeBox");
  box.hidden = !taking;
  if (taking) {
    $("shown").textContent = `${fmt(g.market.bid, q)} – ${fmt(g.market.ask, q)}`;
    $("hitBtn").textContent = `Hit the bid: sell at ${fmt(g.market.bid, q)}`;
    $("liftBtn").textContent = `Lift the offer: buy at ${fmt(g.market.ask, q)}`;
  }
  const result = $("result");
  result.hidden = g.phase !== "reveal" || !entry;
  if (g.phase === "reveal" && entry) {
    const mine = entry.maker === me ? entry.deltaMaker : entry.deltaTaker, theirs = entry.maker === me ? entry.deltaTaker : entry.deltaMaker;
    const who = seatName(1 - entry.maker), makerName = seatName(entry.maker);
    const what = entry.take === "pass" ? `${who} passed` : entry.take === "hit" ? `${who} hit ${makerName === "You" ? "your" : `${makerName}'s`} bid at ${fmt(entry.bid, q)}` : `${who} lifted ${makerName === "You" ? "your" : `${makerName}'s`} offer at ${fmt(entry.ask, q)}`;
    const v = $("verdict");
    v.className = `qt-verdict ${mine >= 0 ? "good" : "bad"}`;
    v.textContent = `${what}. You ${signed(mine)}, ${seatName(1 - me)} ${signed(theirs)}.`;
    drawTape(q, { bid: entry.bid, ask: entry.ask, inside: entry.inside });
    $("note").textContent = /^(About|Roughly|Around|[\d$£€])/.test(q.note) ? q.note : `${withUnit(q.truth, q)}. ${q.note}`;
    $("nextBtn").textContent = g.index + 1 >= g.set.length ? "Closing bell" : "Next";
  }
  if (g.done) finishRoom();
}

let shownBell = null;
function finishRoom() {
  const g = S, me = mySeat(), key = `${g.seed}/${g.index}`;
  if (shownBell === key) return;
  shownBell = key;
  const books = Object.values(g.books), mine = books[me], theirs = books[1 - me];
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "qt-big", mine > theirs ? "You win" : mine < theirs ? `${seatName(1 - me)} wins` : "A draw");
  const stats = add("div", "qt-stats");
  for (const [v, label] of [[money(mine), "you"], [money(theirs), seatName(1 - me)], [`${Object.values(g.log).filter(e => e.take !== "pass").length}`, "trades"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const lines = add("ul", "qt-lines");
  for (const e of Object.values(g.log)) {
    const q = byId.get(e.id), li = document.createElement("li"), name = document.createElement("span"), delta = document.createElement("b");
    const mineD = e.maker === me ? e.deltaMaker : e.deltaTaker;
    name.textContent = `${e.maker === me ? "Made" : e.take === "pass" ? "Passed" : e.take === "hit" ? "Hit" : "Lifted"}: ${q.q.length > 36 ? `${q.q.slice(0, 34)}…` : q.q}`;
    delta.textContent = signed(mineD);
    delta.className = mineD >= 0 ? "good" : "bad";
    li.append(name, delta);
    lines.appendChild(li);
  }
  const again = add("button", "btn primary wide", "Play again");
  again.type = "button";
  again.addEventListener("click", () => { $("doneDlg").close(); startRoomSet(); });
  const leave = add("button", "btn wide", "Leave the room");
  leave.type = "button";
  leave.addEventListener("click", () => { $("doneDlg").close(); together.leave(); });
  if (!$("doneDlg").open) $("doneDlg").showModal();
}

// ---------- together ----------
function freshRoom(players) {
  const seed = randomSeed();
  return { v: 1, app: APP, seed, set: pickSet(seed, QUOTES).map(q => q.id), index: 0, phase: "make", market: null, take: null, books: [START, START], log: [], done: false, created: Date.now(), players };
}
function startRoomSet() {
  const next = freshRoom(null);
  together.act(g => { Object.assign(g, { seed: next.seed, set: next.set, index: 0, phase: "make", market: null, take: null, books: [START, START], log: [], done: false }); });
}
function onState(val) {
  S = val;
  if (!S.books) S.books = [START, START];
  drawPartner();
  render();
}
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append("Reconnecting…"); return; }
  const p = together.partner();
  if (!p) { el.append(`Room ${together.room.code}: waiting for your partner.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online ? "" : " (away)");
  if (p.game && p.game !== "quote") {
    const a = document.createElement("a");
    a.href = gameHref(p.game);
    a.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, a);
    return;
  }
  el.append("Making markets with ", b, ": you take turns.");
}
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
  game: "quote",
  app: APP,
  toast,
  askName,
  valid: g => g?.v === 1 && Array.isArray(g.set),
  fresh: freshRoom,
  onState,
  onPresence: drawPartner,
  onLeave: () => { shownBell = null; S = read(RUN, null); drawPartner(); $("books").className = "qt-book"; if (!S) start("random"); else render(); },
});

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
  add("p", "stats", `${S.mode === "daily" ? "Today's best" : "Your best"}: ${money(best)}. Each question has its own range for "close": a tight market on the number pays up to 300, a near miss still pays, and the loss grows smoothly the further out the truth lies, up to 300.`);
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
const bestKey = () => (S.focus ? `${BEST}:${S.focus}` : BEST);
const dailyKey = () => (S.focus ? `${today()}/${S.focus}` : String(today()));
function bestEver(book) { const b = Math.max(read(bestKey(), -Infinity), book); write(bestKey(), b); return b; }
function bestDaily(book) { const d = read(DAILY, {}); d[dailyKey()] = Math.max(d[dailyKey()] ?? -Infinity, book); write(DAILY, d); return d[dailyKey()]; }

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
  const link = `${location.origin}${location.pathname}${hashFor(S)}`;
  try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); }
}
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", () => { $("menuDlg").close(); fn(); }); return b; };
  const room = together.room;
  if (!room) {
    add("p", "stats", "Make a market on a number: a bid and an ask. Each question says what counts as close; the tighter and the nearer, the more it pays, falling off smoothly, and the further out the truth lies the more you lose. Ten questions, a book of 1,000 to start.");
    button("A new set", () => confirmStart("random"));
    button("Today's set", () => confirmStart("daily"));
    const learn = add("button", "btn wide", `Learning mode: ${pile.learning() ? "on" : "off"}`);
    learn.type = "button";
    learn.addEventListener("click", () => { pile.setLearning(!pile.learning()); $("menuDlg").close(); openMenu(); });
    add("p", "stats", `A miss, or a market wider than three ranges, sends the question to the pile; it leads your next sets until you quote it tight (${pile.counts("quote").due} due now). Deck reviews everything due.`);
    add("h3", null, "Refining");
    add("p", "stats", `Sets drawn only from the ${QUOTES.filter(q => q.cat === "refining").length} refining questions: European fuel specs, what each blendstock brings, cetane and cold flow, energy contents, RED III, quotas, duties and cracks. Crush these and you have the numbers of the trade.`);
    button("A refining set", () => confirmStart("random", "refining"));
    button("Today's refining set", () => confirmStart("daily", "refining"));
    if (S?.done) button("See how it went", finish);
    button("Copy a link to this set", copyLink);
    const best = read(BEST, null), daily = read(DAILY, {})[String(today())], bestRf = read(`${BEST}:refining`, null), dailyRf = read(DAILY, {})[`${today()}/refining`];
    add("p", "stats", `${best != null ? `Your best book: ${money(best)}.` : "No finished set yet."}${daily != null ? ` Today's best: ${money(daily)}.` : ""}${bestRf != null ? ` Refining: best ${money(bestRf)}${dailyRf != null ? `, today ${money(dailyRf)}` : ""}.` : ""}`);
    add("h3", null, "Together");
    add("p", "stats", "Two phones, taking turns: one makes the market, the other hits the bid, lifts the offer or passes. A trade settles between you; a pass settles the maker against the house.");
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
      if (code.length === 4) { $("menuDlg").close(); together.join(code); }
    });
  } else {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    add("h3", null, `Room ${room.code}`);
    add("p", "stats", "Send this link to your partner. Switching games (tap the title) keeps you both in this room.");
    add("p", "room-link", link);
    button("Copy link", async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link, 6000); } });
    button("A fresh set", startRoomSet);
    button("Leave the room", () => together.leave(), "link");
  }
  if (!$("menuDlg").open) $("menuDlg").showModal();
}
function confirmStart(mode, focus = null) {
  if (S && !S.done && S.index > 0 && !confirm("Start a new set? This one isn't finished.")) return;
  start(mode, focus);
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "quote");
document.querySelector(".qt-mark").innerHTML = APPS.find(a => a.id === "quote").logo;
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("doneClose").addEventListener("click", () => $("doneDlg").close());
$("quoteBtn").addEventListener("click", quote);
$("nextBtn").addEventListener("click", next);
$("hitBtn").addEventListener("click", () => take("hit"));
$("liftBtn").addEventListener("click", () => take("lift"));
$("passBtn").addEventListener("click", () => take("pass"));
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
for (const id of ["bid", "ask"]) $(id).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (id === "bid" && !$("ask").value) $("ask").focus(); else quote(); } });
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (h.get("s") || h.get("d")) load(h); });

/** A linked set: #s=seed for a random one, #d=YYYYMMDD for a day's. */
function load(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random", focus = CATS[h.get("f")] ? h.get("f") : null;
  if (!seed) return false;
  if (S && S.seed === seed && S.mode === mode && (S.focus || null) === focus) return true;
  S = { seed, mode, focus, set: setFor(seed, focus), index: 0, book: START, log: [], phase: "quote", done: false };
  save();
  render();
  return true;
}

// for tests and debugging
window.__quote = { get state() { return S; }, quote, next, start, get together() { return together; } };

S = read(RUN, null);
if (S && (!S.set || !S.set.every(id => byId.has(id)))) S = null;    // the bank changed under a saved run
const hash = new URLSearchParams(location.hash.slice(1));
if (!load(hash)) {
  if (!S) start("random");
  else { history.replaceState(null, "", hashFor(S)); render(); }
}
if (S.done) finish();
const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
if (code.length === 4) together.join(code);
