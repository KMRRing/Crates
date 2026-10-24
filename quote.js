// Quote: ten numbers, a two-sided market on each. The engine (quote-engine.js) settles a market; this file runs
// the set, draws the card and the tape, and keeps bests. At a table of two to six (a pair's duo match, a party's),
// everyone makes their own market on the same question and the reveal shows them all against the truth, with the
// standings; a pair may trade instead, one making the market and the other hitting it, lifting it or passing
// (quote-table.js is the table's rules).
import { START, PER_SET, settle, fault, pickMixed, withUnit, fmt, adequate, TOPICS, TOPIC_PRESETS, presetOf, cleanTopics } from "./quote-engine.js";
import { mixParam as linkMix, mixFromParam, anyIn } from "./topics.js";
import { QUOTES, CATS } from "./quote-bank.js";
import { bindSwitcher, APPS } from "./apps.js";
import { createTogether } from "./together.js";
import { gameHref, GAMES, roomInAddress, joiningWords } from "./rooms.js";
import { isTable, peopleFor, freshTable, newSet, keyOf, waitingFor, graceAt, quoteIn, revealNow, nextIn, moveOnNow, settleUp, makerOf, makeIn, takeIn, nextTrade, entryAt, deltasAt, books, placeRows, standingRows, resultOf, initials } from "./quote-table.js";
import { presentSlots, seated } from "./duel-core.js";
import { leaderboard, rank } from "./standings.js";
import { busy, sextant } from "./loading.js";
import * as pile from "./pile.js";
import { noteMarket } from "./ledger-log.js";
import { showPicture, askedWith, nameIn, pictureName } from "./pics.js";
/** The question as asked: about "this" picture, or naming the painting once its picture couldn't be shown. */
const questionOf = q => askedWith(q.q, q.pic, q.title);
/** The question with the thing named, where no picture stands beside it (the list at the closing bell). */
const namedQ = q => (q.pic ? nameIn(q.q, q.title || pictureName(q.pic)) : q.q);
/** A picture with the question, when it has one: a painting to date. */
function picture(q) {
  const pic = $("picture");
  if (!q.pic) { showPicture(pic, null); pic.dataset.title = ""; return; }
  if (pic.dataset.title === q.pic) return;
  pic.dataset.title = q.pic;
  // once it shows or can't, the question asks about "this" or names the painting: the question showing then, which
  // can be another with the same picture (a building's year, then its height)
  showPicture(pic, q.pic).then(shown => {
    const now = S && current();
    if (shown !== null && now?.pic === q.pic) $("question").textContent = questionOf(now);
  });
}
import "./pwa.js";
import { part, choice, topicMix, action, line } from "./menu.js";
import { today, noteComparable, arrivedForToday, dailyDue } from "./suite.js";          // the day, the same for everyone (UTC); a ranked set for your best

const $ = id => document.getElementById(id);
const APP = 2;                       // this code's version of the table (2: up to six seats, everything kept by seat)
const RUN = "quote:run", BEST = "quote:best", DAILY = "quote:daily", TOPICS_KEY = "quote:topics";
const byId = new Map(QUOTES.map(q => [q.id, q]));

let S = null;      // alone: { seed, mode: "random" | "daily", set: [ids], index, book, log: [{ id, bid, ask, delta, inside, width }], phase: "quote" | "reveal", done }
                   // at a table: the table's state (quote-table.js)
const inRoom = () => !!together.room;

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const money = n => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-GB");
const signed = n => (n >= 0 ? "+" : "−") + Math.abs(n).toLocaleString("en-GB");

// ---------- your mix of topics ----------
// A set deals from a mix of the bank's categories, each out, in or more (twice as likely), as Order, Punt and Crates
// do; a mix of one topic is that topic's set (all ten from it), with a best of its own, as refining sets always had.
/** Your topics, each 0 (out), 1 (in) or 2 (more): Balanced until you change them. */
const mix = () => cleanTopics(read(TOPICS_KEY, null));
const keepMix = w => write(TOPICS_KEY, w);
/** The one topic a mix has in, if it has only one (a set of that topic), else null. */
const focusOf = w => { const ins = TOPICS.filter(([id]) => w[id] > 0); return ins.length === 1 ? ins[0][0] : null; };
/** A mix as a link carries it (&t=trade.2,art.1: the topics in), and back. */
const mixParam = w => linkMix(TOPICS, w);
const mixFrom = t => mixFromParam(TOPICS, t);

// ---------- the run ----------
// A run counts for your best (the games screen's, your partner's) only if it's the daily, or a preset's mix (Balanced,
// Trader, Culture night) with nothing from your pile in. A daily is always Balanced and has nothing of yours in it: the
// same for everyone.
const rankedRun = (mode, w) => mode === "daily" || (presetOf(w) !== "custom" && !pile.learning());
/** The questions a set draws from: the topics in, by their weights (a single topic in: all ten from it). */
const setFor = (seed, w, personal = true, fresh = personal) => {
  const pool = QUOTES.filter(q => (w[q.cat] ?? 1) > 0);
  // learning mode: what's due leads the set (up to half of it), the rest dealt as usual around it
  // and questions about what the other games found you weak on, in Quote's form
  const own = personal && pile.learning() ? pile.picks("quote").map(it => it.key).filter(id => pool.some(q => q.id === id)).slice(0, Math.ceil(PER_SET / 2)) : [];
  const due = personal && pile.learning() ? pile.dealDue("quote", pool.map(q => ({ key: q.id, about: q.about ? [q.about] : [] })), own, Math.ceil(PER_SET / 2)) : [];
  const left = pool.filter(q => !due.includes(q.id)), draw = (from, n) => pickMixed(seed, from, w, n);
  // nothing again until the rest of the pool has had its turn (a daily is the same for everyone: no history in it)
  const rest = (fresh ? pile.freshPicks("quote", left, q => q.id, PER_SET - due.length, draw) : draw(left, PER_SET - due.length)).map(q => q.id);
  const set = [...rest];
  due.forEach((id, i) => set.splice(Math.min(set.length, Math.floor((i + 0.5) * PER_SET / due.length)), 0, id));
  if (fresh) pile.dealt("quote", set);
  return set;
};
const hashFor = s => `${s.mode === "daily" ? `#d=${s.seed}` : `#s=${s.seed}`}${s.focus ? `&f=${s.focus}` : s.topics ? `&t=${mixParam(s.topics)}` : ""}`;
/** What a link needs of a mix: one topic in (focus), or the mix itself unless it's Balanced (topics). */
const mixOf = w => { const focus = focusOf(w); return { focus, topics: focus || presetOf(w) === "balanced" ? null : w }; };
/** A set to start: today's (Balanced, the same for everyone), or a random one from a mix (yours, unless a link's). */
function newState(mode, seed, w, fresh = true) {
  if (mode === "daily" || !anyIn(TOPICS, w)) w = TOPIC_PRESETS.balanced.topics;   // a link's mix of nothing deals Balanced
  return { seed, mode, ...mixOf(w), preset: presetOf(w), ranked: rankedRun(mode, w), set: setFor(seed, w, mode !== "daily", fresh && mode !== "daily"), index: 0, book: START, log: [], phase: "quote", done: false };
}
function start(mode) {
  S = newState(mode, mode === "daily" ? today() : randomSeed(), mix());
  save();
  history.replaceState(null, "", hashFor(S));
  render();
}
function save() { if (!inRoom()) write(RUN, S); }
const current = () => byId.get(S.set[S.index]);

/** Your quote: alone, settles against the book; at a table, goes in with everyone's (or, trading, to your partner). */
function quote() {
  if (inRoom() && S.mode === "ranges" && S.quotes?.[keyOf(mySlot())]) { revealEarly(); return; }   // quoted: the button reveals without the slow, once it may
  const q = current(), bid = parse($("bid").value), ask = parse($("ask").value);
  const why = fault(q, bid, ask);
  if (why) { $("fault").textContent = why; return; }
  if (inRoom()) { quoteAtTable({ bid, ask }); return; }
  if (S.phase !== "quote") return;
  const r = settle(q, bid, ask);
  noteMarket(r.grade, r.inside);   // the Ledger: the grade, and whether the truth was inside the market
  // the pile: a B or below means you didn't adequately know it; an A or better moves a banked question up
  if (!adequate(r.grade)) pile.record("quote", q.id, { id: q.id, pic: q.pic || null, about: q.about ? [q.about] : undefined }, r.inside ? "wide" : "wrong");
  else if (pile.has("quote", q.id)) pile.answer("quote", q.id, true);
  S.book += r.delta;
  S.log.push({ id: q.id, bid, ask, delta: r.delta, inside: r.inside, width: r.width, beyond: r.beyond, grade: r.grade });
  S.phase = "reveal";
  save();
  if (S.index + 1 >= S.set.length) count();         // the last quote settled: the book is final
  render();
}
/** A set's final book counts at once, for your best and today's, not when the closing bell is rung; the bell counts
 *  it again, which changes nothing. Returns the best it's measured against. */
function count() {
  const best = S.mode === "daily" ? bestDaily(S.book) : bestEver(S.book);
  if (S.ranked) noteComparable("quote", S.book, S.mode === "daily" ? S.seed : null);   // the daily or Standard: it counts for your best
  return best;
}
function next() {
  if (inRoom()) { nextAtTable(); return; }
  if (S.done) { finish(); return; }                       // the set is over: the closing bell shows it again
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
  $("cat").textContent = CATS[q.cat];
  $("question").textContent = questionOf(q);
  picture(q);
  $("unit").textContent = q.unit === "year" ? "A year" : `In ${q.unit}`;   // the unit only: the grade widths gave the scale away
  const entry = S.log[S.index];
  $("bid").value = entry ? fmt(entry.bid, q) : "";
  $("ask").value = entry ? fmt(entry.ask, q) : "";
  $("bid").disabled = $("ask").disabled = !!entry;
  $("fault").textContent = "";
  $("quoteBtn").hidden = !!entry;
  const result = $("result");
  result.hidden = !entry;
  $("card").classList.toggle("settled", !!entry);             // the tape shows your market against the truth
  if (entry) {
    showVerdict(q, entry);
    drawTape(q, entry);
    $("note").textContent = noteOf(q);
    $("nextBtn").textContent = S.index + 1 >= S.set.length ? "Closing bell" : "Next";
  }
}
/** A market's verdict: its grade and what it earned, in the colours of how it went. */
function showVerdict(q, entry) {
  const v = $("verdict");
  const grade = entry.grade || (entry.inside ? "A" : "C");
  // A or better green, a B light green (a sound range for a number you don't know), wide but right yellow, never red
  v.className = `qt-verdict ${adequate(grade) ? "good" : grade === "B" ? "fair" : entry.inside ? "meh" : "bad"}`;
  const word = { SS: "exact", S: "sharp", A: "strong", B: "solid", C: "a miss" }[grade];
  // a wide range that held the answer is in range, not a miss: said so, in yellow
  v.textContent = grade === "C" && entry.inside ? `Wide, but in range: ${signed(entry.delta)}`
    : `${grade}, ${word}${entry.inside ? "" : `; outside, ${beyondText(q, entry)}`}: ${signed(entry.delta)}`;
}
// the note usually opens with the figure itself; when it doesn't, lead with it
const noteOf = q => (/^(About|Roughly|Around|[\d$£€])/.test(q.note) ? q.note : `${withUnit(q.truth, q)}. ${q.note}`);
function beyondText(q, e) {
  const above = q.truth > e.ask;
  if (q.scale === "log") { const ratio = above ? q.truth / e.ask : e.bid / q.truth; return `${ratio.toFixed(ratio < 10 ? 1 : 0)}× ${above ? "above your ask" : "below your bid"}`; }
  const gap = above ? q.truth - e.ask : e.bid - q.truth;
  return `${fmt(gap, { unit: "" })} ${q.unit === "year" ? (gap === 1 ? "year" : "years") : q.unit} ${above ? "above your ask" : "below your bid"}`;
}


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
  const point = e.ask === e.bid;                       // a market on one figure: a dot, labelled once
  add(point ? "span point" : "span", point ? { left: x(e.bid) } : { left: x(e.bid), width: `calc(${x(e.ask)} - ${x(e.bid)})` });
  add("lbl", { left: x(e.bid) }, fmt(e.bid, q));
  if (!point) add("lbl", { left: x(e.ask) }, fmt(e.ask, q));
  add(`truth ${e.inside ? "good" : "bad"}`, { left: x(q.truth) });
  add("lbl t", { left: x(q.truth) }, fmt(q.truth, q));
}

// ---------- at a table: a pair's duo match, or a party's of up to six ----------
let offset = 0, stopOffset = null;                     // this device's clock against the database's
const now = () => Date.now() + offset;
const mySlot = () => together.slot ?? 0;
/** This device's seat in a state read inside a transaction (the table as the database has it). */
const slotIn = g => g.players?.[together.room?.uid]?.slot;
/** The seats at the table now: seated, with Quote open on a device that's online (yours always). Until this phone has
 *  heard who's here, everyone seated counts, so a reload can't move the table on without the others. */
function present() {
  if (!inRoom() || !S) return [];
  const here = together.room.here;
  return here && Object.keys(here).length ? presentSlots(S, here, "quote", together.room.uid) : seated(S).map(([, p]) => p.slot);
}
const questionAt = id => byId.get(id);
const first = name => String(name || "Player").trim().split(/\s+/)[0];
/** "a", "a and b", "a, b and c". */
const list2 = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
/** Those left out, for a button: one or two by name, more by number, so the button stays one line. */
const without = names => (names.length > 2 ? `the other ${names.length}` : list2(names));
const nameOfSlot = slot => first(seated(S).find(([, p]) => p.slot === slot)?.[1].name);
/** Who's in a seat, as a trade's lines say it: "You", or their name. */
const seatName = slot => (slot === mySlot() ? "You" : nameOfSlot(slot) || "Your partner");
/** Each seat's label: its player's initial, two letters where two share one. */
function labels() {
  const seats = seated(S), out = {}, short = initials(seats.map(([, p]) => p.name));
  seats.forEach(([, p], i) => { out[p.slot] = short[i]; });
  return out;
}
/** A player's mark: their seat's colour, their initial. */
function seatMark(slot, label) {
  const i = document.createElement("i");
  i.className = "qt-seat";
  i.style.setProperty("--seat", `var(--p${slot % 6})`);
  i.textContent = label ?? "?";
  return i;
}
/** Who the table is waiting for, in words: "Waiting for Sarah and Tom…". */
function waitingText() {
  const names = waitingFor(S, present()).filter(s => s !== mySlot()).map(nameOfSlot);
  return names.length ? `${S.phase === "quote" ? "Quoted. " : ""}Waiting for ${list2(names)}…` : "";
}
/** Whether the grace for those still to quote or press Next is up, so the table may go on without them. */
const graceUp = () => { const at = graceAt(S, present()); return at != null && now() >= at; };
let graceTimeout = 0;
/** Redraws when the grace runs out, so the button to go on without the rest appears without a tap. */
function graceTimer() {
  clearTimeout(graceTimeout);
  const at = inRoom() && S ? graceAt(S, present()) : null;
  if (at != null && now() < at) graceTimeout = setTimeout(render, at - now() + 50);
}
function quoteAtTable(market) {
  const at = { seed: S.seed, index: S.index }, pres = present(), t = now();
  if (S.mode === "trade") together.act(g => makeIn(g, slotIn(g), market, at));
  else together.act(g => quoteIn(g, slotIn(g), market, at, pres, t, questionAt));
}
function revealEarly() {
  if (S.phase !== "quote" || !graceUp()) return;
  const pres = present(), t = now();
  together.act(g => revealNow(g, pres, t, questionAt));
}
/** Trading: the taker's choice on the maker's market. */
function take(kind) {
  const t = now();
  together.act(g => takeIn(g, slotIn(g), kind, questionAt(g.set[g.index]), t));
}
function nextAtTable() {
  if (S.phase !== "reveal") return;
  if (S.done) { finishRoom(true); return; }               // the last question: the closing bell, on this phone
  const at = { seed: S.seed, index: S.index }, pres = present(), t = now();
  if (S.mode === "trade") { together.act(g => nextTrade(g, at)); return; }
  if (S.nexts?.[keyOf(mySlot())]) { if (graceUp()) together.act(g => moveOnNow(g, pres, t)); return; }
  together.act(g => nextIn(g, slotIn(g), at, pres, t));
}
/** What the table owes itself as people come and go: the reveal or the next question once nobody here is still to act. */
function settleTable() {
  if (!inRoom() || !S || S.mode !== "ranges" || waitingFor(S, present()).length) return;
  const pres = present(), t = now();
  together.act(g => settleUp(g, pres, t, questionAt));
}

/** The books over the card: a pair's both, a bigger table's yours and where it stands. */
function drawBooks() {
  const el = $("books"), b = books(S), me = mySlot();
  const rows = rank(seated(S).map(([, p]) => ({ slot: p.slot, name: first(p.name), value: b[keyOf(p.slot)] ?? START })));
  el.className = "qt-books";
  if (rows.length <= 2) {
    el.replaceChildren(...[...rows].sort((x, y) => (y.slot === me) - (x.slot === me)).map(r => { const n = document.createElement("b"); n.textContent = `${r.name} ${money(r.value)}`; return n; }));
    return;
  }
  const mine = rows.find(r => r.slot === me), n = document.createElement("b"), s = document.createElement("span");
  n.textContent = `You ${money(mine?.value ?? START)}`;
  s.textContent = `${ordinal(mine?.rank || rows.length)} of ${rows.length}`;
  el.replaceChildren(n, s);
}
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
/** What each of you sees at a table: Ranges (everyone's own market) or Trade. */
function renderRoom() {
  const g = S, q = current();
  $("where").textContent = `Question ${g.index + 1} of ${g.set.length}`;
  drawBooks();
  $("cat").textContent = CATS[q.cat];
  $("question").textContent = questionOf(q);
  picture(q);
  $("unit").textContent = q.unit === "year" ? "A year" : `In ${q.unit}`;   // the unit only: the grade widths gave the scale away
  if (g.mode === "trade") renderTrade(g, q); else renderRanges(g, q);
  graceTimer();
}
/** Ranges: your market in private, then everyone's against the truth. */
function renderRanges(g, q) {
  const me = mySlot(), mine = g.quotes?.[keyOf(me)], quoting = g.phase === "quote", entry = g.phase === "reveal" ? entryAt(g, g.index) : null;
  $("takeBox").hidden = true;
  $("market").hidden = false;
  $("card").classList.toggle("settled", !!entry);
  $("bid").disabled = $("ask").disabled = !quoting || !!mine;
  if (mine) { $("bid").value = fmt(mine.bid, q); $("ask").value = fmt(mine.ask, q); }
  const go = $("quoteBtn"), late = waitingFor(g, present()).filter(s => s !== me), early = !!mine && late.length && graceUp();
  go.hidden = !quoting;
  go.disabled = !!mine && !early;
  go.textContent = !mine ? "Quote" : early ? `Reveal without ${without(late.map(nameOfSlot))}` : "Quoted";
  $("waiting").hidden = !(quoting && mine);
  $("waiting").textContent = waitingText();
  drawSeats(quoting);
  $("result").hidden = !entry;
  $("tape").hidden = $("note").hidden = true;
  $("table").hidden = !entry;
  if (!entry) return;
  const r = entry.res?.[keyOf(me)];
  if (r) showVerdict(q, r);
  else { $("verdict").className = "qt-verdict"; $("verdict").textContent = "No market from you on this one."; }
  drawTable(g, q, entry);
  const b = $("nextBtn"), pressed = !!g.nexts?.[keyOf(me)], on = pressed && late.length && graceUp();
  b.disabled = !g.done && pressed && !on;
  b.textContent = g.done ? "Closing bell" : !pressed ? "Next" : on ? `On without ${without(late.map(nameOfSlot))}` : "Waiting";
  $("nextNote").hidden = !(pressed && late.length);
  $("nextNote").textContent = waitingText();
}
/** While quoting at a table: who's at it, who has quoted (ticked) and who's away (faded). */
function drawSeats(show) {
  const box = $("seats");
  box.hidden = !show;
  if (!show) return;
  const tag = labels(), pres = present(), me = mySlot();
  box.replaceChildren(...seated(S).map(([, p]) => {
    const li = document.createElement("li"), name = document.createElement("span"), done = !!S.quotes?.[keyOf(p.slot)], here = pres.includes(p.slot);
    li.className = done ? "in" : here ? "" : "away";
    name.textContent = `${p.slot === me ? "You" : first(p.name)}${done ? " ✓" : here ? "" : ", away"}`;
    li.append(seatMark(p.slot, tag[p.slot]), name);
    return li;
  }));
}
/**
 * The reveal at a table: every market on one scale with the truth through them all, each in its player's colour with
 * what it earned (the best first); then the standings; then the basis of the figure.
 */
function drawTable(g, q, entry) {
  const box = $("table"), me = mySlot(), tag = labels(), rows = placeRows(g, g.index);
  const quoted = rows.filter(r => !r.none), log = q.scale === "log", f = log ? Math.log2 : x => x;
  const lo = Math.min(q.truth, ...quoted.map(r => r.bid)), hi = Math.max(q.truth, ...quoted.map(r => r.ask));
  const pad = log ? 0.6 : q.scale * 0.6, left = f(lo) - pad, right = f(hi) + pad;
  const x = v => `${((f(v) - left) / (right - left) * 100).toFixed(1)}%`;
  const el = (tag2, cls, text) => { const n = document.createElement(tag2); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const tapes = el("div", "qt-tapes");
  const head = el("div", "qt-tapes-row head");
  const headTrack = el("div", "qt-track");
  const at = (f(q.truth) - left) / (right - left), truthLbl = el("span", `qt-truth-lbl${at < 0.15 ? " lo" : at > 0.85 ? " hi" : ""}`, fmt(q.truth, q));
  truthLbl.style.left = x(q.truth);                            // near an end, the label lies inside the scale rather than off it
  headTrack.append(truthLbl);
  head.append(el("i", "qt-seat blank"), headTrack, el("b", "qt-pts"));
  tapes.append(head);
  for (const r of rows) {
    const row = el("div", `qt-tapes-row${r.slot === me ? " me" : ""}`), track = el("div", "qt-track");
    track.style.setProperty("--seat", `var(--p${r.slot % 6})`);
    if (!r.none) {
      const bar = el("div", `qt-bar${r.ask === r.bid ? " point" : ""}${r.inside ? "" : " out"}`);
      bar.style.left = x(r.bid);
      if (r.ask !== r.bid) bar.style.width = `calc(${x(r.ask)} - ${x(r.bid)})`;
      track.append(bar);
    }
    const truth = el("div", "qt-truth");
    truth.style.left = x(q.truth);
    track.append(truth);
    row.append(seatMark(r.slot, tag[r.slot]), track, el("b", "qt-pts", r.none ? "—" : signed(r.delta)));
    tapes.append(row);
  }
  const standings = leaderboard(standingRows(g, g.index).map(s => {
    const r = entry.res?.[keyOf(s.slot)];
    return { name: s.slot === me ? "You" : first(s.name), value: s.value, shown: money(s.value), delta: s.delta, seat: s.slot, me: s.slot === me,
      note: r ? `${fmt(r.bid, q)}–${fmt(r.ask, q)} · ${r.grade !== "C" ? r.grade : r.inside ? "wide" : "miss"}` : "no market" };
  }), { format: n => n.toLocaleString("en-GB") });
  const keep = box.dataset.at === `${g.seed}/${g.index}` ? box.scrollTop : 0;    // a redraw of the same reveal keeps its place
  box.replaceChildren(tapes, el("h4", "qt-h", g.done ? "Final standings" : "Standings"), standings, el("p", "qt-note", noteOf(q)));
  box.dataset.at = `${g.seed}/${g.index}`;
  box.scrollTop = keep;
}
/** Trade: what each of you sees in each phase, as a pair's match always has. */
function renderTrade(g, q) {
  const me = mySlot(), maker = makerOf(g), isMaker = me === maker, other = 1 - maker;
  const entry = g.phase === "reveal" ? entryAt(g, g.index) : null;
  const making = g.phase === "make" && isMaker, taking = g.phase === "take" && !isMaker;
  $("card").classList.remove("settled");
  $("seats").hidden = $("table").hidden = $("nextNote").hidden = true;
  $("tape").hidden = $("note").hidden = false;
  $("market").hidden = !(making || entry);
  $("quoteBtn").hidden = !making;
  $("quoteBtn").disabled = false;
  $("quoteBtn").textContent = "Quote";
  $("bid").disabled = $("ask").disabled = !making;
  if (entry) { $("bid").value = fmt(entry.bid, q); $("ask").value = fmt(entry.ask, q); }
  const waiting = $("waiting");
  waiting.hidden = !((g.phase === "make" && !isMaker) || (g.phase === "take" && isMaker));
  waiting.textContent = g.phase === "make" ? `${seatName(maker)} is making the market…` : `${seatName(other)} is looking at your market…`;
  const box = $("takeBox");
  box.hidden = !taking;
  if (taking) {
    $("shown").textContent = `${fmt(g.market.bid, q)} – ${fmt(g.market.ask, q)}`;
    $("hitBtn").textContent = `Hit the bid: sell at ${fmt(g.market.bid, q)}`;
    $("liftBtn").textContent = `Lift the offer: buy at ${fmt(g.market.ask, q)}`;
  }
  $("result").hidden = !entry;
  if (!entry) return;
  const d = deltasAt(entry), mine = d[keyOf(me)] || 0, theirs = d[keyOf(isMaker ? entry.taker ?? other : maker)] || 0;
  const who = seatName(entry.taker ?? other), makerName = seatName(entry.maker);
  const what = entry.take === "pass" ? `${who} passed` : entry.take === "hit" ? `${who} hit ${makerName === "You" ? "your" : `${makerName}'s`} bid at ${fmt(entry.bid, q)}` : `${who} lifted ${makerName === "You" ? "your" : `${makerName}'s`} offer at ${fmt(entry.ask, q)}`;
  const v = $("verdict");
  v.className = `qt-verdict ${mine >= 0 ? "good" : "bad"}`;
  v.textContent = `${what}. You ${signed(mine)}, ${seatName(isMaker ? entry.taker ?? other : maker)} ${signed(theirs)}.`;
  drawTape(q, { bid: entry.bid, ask: entry.ask, inside: entry.inside });
  $("note").textContent = noteOf(q);
  $("nextBtn").disabled = false;
  $("nextBtn").textContent = g.done ? "Closing bell" : "Next";
}

let shownBell = null;
/** Opens the closing bell's summary, as a modal on top: a dialog left open somehow (not shown as a modal) is reopened. */
function bell() { const d = $("doneDlg"); if (d.open) d.close(); d.showModal(); }
/** The closing bell at a table: who won, the books, each question's result, Play again and Back to solo. */
function finishRoom(asked = false) {                    // asked: the closing bell was pressed, so show it even if shown
  const g = S, me = mySlot(), key = `${g.seed}/${g.created}`;
  if (shownBell === key && !asked) return;
  shownBell = key;
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  const rows = rank(standingRows(g)), tops = rows.filter(r => r.rank === 1);
  add("p", "qt-big qt-won", tops.length > 1 ? (tops.length === rows.length ? "A draw" : `${list2(tops.map(r => (r.slot === me ? "you" : first(r.name))))} share it`.replace(/^you/, "You"))
    : tops[0]?.slot === me ? "You win" : `${first(tops[0]?.name)} wins`);
  const entries = g.set.map((id, i) => entryAt(g, i)).filter(Boolean);
  // a note under each name: how many markets held the truth (ranges), how many trades (a pair's trading)
  const inside = slot => entries.filter(e => e.res?.[keyOf(slot)]?.inside).length;
  const traded = slot => `${entries.filter(e => e.maker === slot).length} made, ${entries.filter(e => e.taker === slot && e.take !== "pass").length} taken`;
  body.append(leaderboard(rows.map(r => ({ name: r.slot === me ? "You" : first(r.name), value: r.value, shown: money(r.value), seat: r.slot, me: r.slot === me,
    note: g.mode === "trade" ? traded(r.slot) : `${inside(r.slot)} of ${entries.length} inside` })), { format: n => n.toLocaleString("en-GB") }));
  const lines = add("ul", "qt-lines");
  for (const e of entries) {
    const q = byId.get(e.id);
    if (!q) continue;                                      // a question the bank has since dropped: its money still counts above
    const li = document.createElement("li"), name = document.createElement("span"), delta = document.createElement("b");
    const mineD = deltasAt(e)[keyOf(me)] || 0, said = namedQ(q);
    const how = g.mode === "trade" ? `${e.maker === me ? "Made" : e.take === "pass" ? "Passed" : e.take === "hit" ? "Hit" : "Lifted"}: ` : "";
    name.textContent = `${how}${said.length > 36 ? `${said.slice(0, 34)}…` : said}`;
    delta.textContent = e.res && !e.res[keyOf(me)] ? "—" : signed(mineD);
    delta.className = mineD >= 0 ? "good" : "bad";
    li.append(name, delta);
    lines.appendChild(li);
  }
  const again = add("button", "btn primary wide", "Play again");
  again.type = "button";
  again.addEventListener("click", () => { $("doneDlg").close(); startRoomSet(); });
  const leave = add("button", "btn wide", "Back to solo");
  leave.type = "button";
  leave.addEventListener("click", () => { $("doneDlg").close(); together.leave(); });
  bell();
}

function freshRoom(players, ask = null) {
  const seed = randomSeed();
  return { ...freshTable(players, { people: peopleFor(ask), seed, set: pickMixed(seed, QUOTES, mix()).map(q => q.id) }), app: APP };
}
/** A fresh set for the table (in the way to play chosen), asking first while this one's under way. */
function startRoomSet(mode = S?.mode) {
  if (S && !S.done && (S.index > 0 || S.log || S.quotes || S.market) && !confirm("Deal a fresh set for the table? This one isn't finished.")) return;
  const seed = randomSeed(), set = pickMixed(seed, QUOTES, mix()).map(q => q.id);
  together.act(g => newSet(g, { seed, set, mode }));
}
let joining = null;                                     // the rete while this phone sits down, until the table's drawn
const joined = () => { joining?.(); joining = null; };
function onState(val) {
  const was = S;
  S = val;
  joined();
  document.getElementById("app").classList.add("at-table");
  if (!stopOffset) stopOffset = together.room?.sync.serverOffset?.(ms => { offset = ms || 0; }) || (() => {});
  if (!isTable(was) || was.index !== val.index || was.seed !== val.seed || was.mode !== val.mode) {
    $("bid").value = $("ask").value = "";                // a new question: an empty market to make
    $("fault").textContent = "";
  }
  if (isTable(was) && was.seed !== val.seed) {                             // a fresh set: the last one's bell has rung
    shownBell = null;
    if ($("doneDlg").open) $("doneDlg").close();
    toast("A fresh set for the table");
  }
  drawPartner();
  render();
  settleTable();
}
function onPresence() {
  drawPartner();
  if (!S || !inRoom()) return;
  render();
  settleTable();
}
function drawPartner() {
  const el = $("partner");
  if (!together.room) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  if (!together.online) { el.append(sextant(), "Reconnecting…"); return; }
  const others = together.others(), known = Object.keys(together.room.here || {}).length > 0;   // who's here, once heard
  if (others.length > 1) {                               // a party's table: everyone else, and who's away
    el.append("Making markets with ");
    others.forEach((o, i) => {
      if (i) el.append(i === others.length - 1 ? " and " : ", ");
      const b = document.createElement("b");
      b.textContent = first(o.name) + (o.here || !known ? "" : " (away)");
      el.append(b);
    });
    el.append(".");
    return;
  }
  const p = together.partner();
  if (!p) { el.append(`Room ${together.room.code}: ${(S?.people || 2) > 2 ? "waiting for the others" : "waiting for your partner"}.`); return; }
  const b = document.createElement("b");
  b.textContent = p.name + (p.online && !(known && others[0] && !others[0].here) ? "" : " (away)");   // seated but gone (Back to solo): away
  if (p.game && p.game !== "quote") {
    const a = document.createElement("a");
    a.href = gameHref(p.game);
    a.textContent = "Join them";
    el.append(b, ` is in ${GAMES[p.game]?.name || "another game"}. `, a);
    return;
  }
  el.append("Making markets with ", b, S?.mode === "trade" ? ": you take turns." : ".");
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
  // a finished set at the pair's table: your book against your partner's (won: alone at the top)
  result: g => resultOf(g, g.players?.[together.room?.uid]?.slot),
  game: "quote",
  app: APP,
  toast,
  askName,
  valid: isTable,
  // a table dealt as you sit down, with as many seats as the request it's dealt for asked (a party's); together.js
  // passes that request after the players
  fresh: (players, { ask } = {}) => freshRoom(players, ask),
  slots: g => g?.people || 2,
  onState,
  onPresence,
  onLeave: () => {
    joined();                                             // a join that ends in leaving (the table gone) takes the rete too
    shownBell = null;
    clearTimeout(graceTimeout);
    stopOffset?.(); stopOffset = null;
    document.getElementById("app").classList.remove("at-table");
    if ($("doneDlg").open) $("doneDlg").close();
    $("books").className = "qt-book";
    for (const id of ["seats", "table", "nextNote"]) $(id).hidden = true;
    $("tape").hidden = $("note").hidden = false;
    $("quoteBtn").disabled = false;
    $("quoteBtn").textContent = "Quote";
    $("nextBtn").disabled = false;
    soloStart();
    drawPartner();
  },
});

// ---------- the closing bell ----------
function finish() {
  // how sharp the markets were, in the game's own terms: inside and graded A or better on each question's own scale.
  // (An "average width" mixed units, doublings for ratios and plain units for years and counts, and printed 2 to the
  // power of their mean: a 76-year market came out as ×7.6e+22.)
  const inside = S.log.filter(e => e.inside).length, sharp = S.log.filter(e => e.inside && adequate(e.grade)).length;
  const best = count();
  const body = $("doneBody");
  body.replaceChildren();
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; body.appendChild(n); return n; };
  add("p", "qt-big", money(S.book));
  const stats = add("div", "qt-stats");
  for (const [v, label] of [[`${inside} of ${S.log.length}`, "inside"], [`${sharp} of ${S.log.length}`, "A or better"], [signed(S.book - START), "on the set"]]) {
    const box = document.createElement("div"), b = document.createElement("b"), s = document.createElement("span");
    b.textContent = v; s.textContent = label; box.append(b, s); stats.appendChild(box);
  }
  const lines = add("ul", "qt-lines");
  for (const e of S.log) {
    const q = byId.get(e.id);
    if (!q) continue;                                      // a question the bank has since dropped: its money still counts above
    const li = document.createElement("li"), name = document.createElement("span"), delta = document.createElement("b");
    const said = namedQ(q);
    name.textContent = said.length > 44 ? `${said.slice(0, 42)}…` : said;
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
  bell();
}
// your best: a preset's, or a single topic's of its own (a refining set's); your own mix of several keeps none
const bestKey = () => (S.focus ? `${BEST}:${S.focus}` : S.preset === "custom" ? null : BEST);
const dailyKey = () => (S.focus ? `${today()}/${S.focus}` : String(today()));
function bestEver(book) {
  const key = bestKey();
  if (!key) return book;
  const b = Math.max(read(key, -Infinity), book);
  write(key, b);
  return b;
}
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
// the menu: Play (start the set you've chosen), Content (random or today's, and for a random set your mix of topics),
// Settings (learning mode), About (your bests, a link to this set); at a table, how a pair plays (Ranges or Trade: a
// fresh set either way) and the table's own part
let pick = null;                                              // the set the menu will start: { mode }
/** Your mix of topics, in the menu: a preset, or each topic tapped out, in or more. */
const topicsPart = (box, solo = false, changed = () => {}) => box.append(topicMix(TOPICS, TOPIC_PRESETS, mix(), w => { keepMix(w); changed(); }, { note: solo ? w => (presetOf(w) !== "custom" ? null
  : focusOf(w) ? "A set of one topic keeps a best of its own." : "Your own mix doesn't count for your best; today's set and the presets do.") : null }));
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (together.room) {
    const box = part(body, "together");
    if ((S?.people || 2) === 2) box.append(choice("Play", [["ranges", "Ranges"], ["trade", "Trade"]], S?.mode || "ranges", v => { $("menuDlg").close(); startRoomSet(v); }));
    box.append(action(S?.done ? "Play again" : "A fresh set", () => startRoomSet(), "primary"),
      ...(S?.done ? [action("The closing bell", () => finishRoom(true))] : []));
    topicsPart(box);                                          // the table's fresh set comes from your mix
    box.append(action("Back to solo", () => together.leave(), "link"));
  } else {
    pick ??= { mode: S?.mode === "daily" || dailyDue("quote") ? "daily" : "random" };   // today's first, while it's still to play
    const play = part(body, "play");
    play.append(action("Start a set", () => confirmStart(pick.mode), "primary"));
    if (S?.done) play.append(action("See how it went", finish));
    const content = part(body, "content");
    content.append(choice("Set", [["random", "Random"], ["daily", "Today's"]], pick.mode, v => { pick.mode = v; openMenu(); }));
    // your topics are for random sets (today's is the same for everyone), so they're shown either way, and one changed
    // with today's picked turns the next set to a random one
    topicsPart(content, true, () => { if (pick.mode === "daily") { pick.mode = "random"; openMenu(); } });
    part(body, "settings").append(choice("Learning mode", pile.MODES, pile.mode(), pile.setMode));
    const best = read(BEST, null), daily = read(DAILY, {})[String(today())], bestRf = read(`${BEST}:refining`, null);
    part(body, "about").append(
      line([best != null ? `Best book ${money(best)}` : "No finished set yet", daily != null ? `today ${money(daily)}` : "", bestRf != null ? `refining ${money(bestRf)}` : ""].filter(Boolean).join(" · ")),
      action("Copy a link to this set", copyLink, "link"));
  }
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
$("hitBtn").addEventListener("click", () => take("hit"));
$("liftBtn").addEventListener("click", () => take("lift"));
$("passBtn").addEventListener("click", () => take("pass"));
document.addEventListener("visibilitychange", () => { if (!document.hidden) together.resync(); });
window.addEventListener("pageshow", e => { if (e.persisted) together.resync(); });
for (const id of ["bid", "ask"]) $(id).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (id === "bid" && !$("ask").value) $("ask").focus(); else quote(); } });
window.addEventListener("hashchange", () => { const h = new URLSearchParams(location.hash.slice(1)); if (!inRoom() && (h.get("s") || h.get("d"))) load(h); });

/** A linked set: #s=seed for a random one, #d=YYYYMMDD for a day's. */
function load(h) {
  const seed = Number(h.get("d") || h.get("s")), mode = h.get("d") ? "daily" : "random";
  // the mix a link carries: one topic (&f=refining, as refining sets' links always had), several (&t=…), or Balanced
  const w = CATS[h.get("f")] ? mixFrom(`${h.get("f")}.1`) : h.get("t") ? mixFrom(h.get("t")) : TOPIC_PRESETS.balanced.topics;
  if (!seed) return false;
  // the link names the run already in progress (the page was reloaded, or the phone brought the app back): carry on
  // with it, drawn as it stands, its last answer and the closing bell included; returning without drawing left the bare page
  if (S && S.seed === seed && S.mode === mode && hashFor(S) === hashFor({ seed, mode, ...mixOf(w) })) { render(); return true; }
  S = newState(mode, seed, w, false);
  save();
  render();
  return true;
}
/** Your own set: a shared link's, the saved one, or a fresh one; at start-up, today's when the games screen's tile sent
 *  you for it (opening). */
function soloStart({ opening = false } = {}) {
  S = read(RUN, null);
  if (S && (!S.set || !S.set.every(id => byId.has(id)))) S = null;    // the bank changed under a saved run
  const forToday = opening && arrivedForToday();         // from the games screen's tile: today's set, still to play
  const hash = new URLSearchParams(location.hash.slice(1));
  if (!load(hash)) {
    if (!S) start(forToday ? "daily" : "random");
    else { history.replaceState(null, "", hashFor(S)); render(); }
  }
  if (forToday && !(S.mode === "daily" && S.seed === today())) setTimeout(() => confirmStart("daily"), 0);   // it asks before leaving a set you've started
  else if (opening && S.done) finish();
}

// for tests and debugging
window.__quote = { get state() { return S; }, quote, next, start, take, get together() { return together; }, present };

// a room in the address: the set the table shares from the first moment, never your own while it's joined (the others
// would be on another question until it was), and your own, as you left it, only if the join doesn't come off
const code = roomInAddress();
if (code) {
  joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { if (!ok) { joined(); soloStart({ opening: true }); } });
} else soloStart({ opening: true });
