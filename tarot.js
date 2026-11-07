// Tarot (le tarot, French tarot) for three, four or five, against computer players, or at a table with friends each on
// their own phone, or on one phone passed round. The rules and words are tarot-rules.js's, the computer players
// tarot-bot.js's and tarot-sim.js's (their thinking in tarot-worker.js, off this thread), the coach tarot-coach.js's, the
// running seats.js's (seats-ui.js). This page draws the table: the others across the top with the card each has played
// under them, the dog, the call and the result in the middle, your cards in two rows below, and the buttons for what is
// asked of you.
import {
  rules, BIDS, SIZES, POIGNEE, POIGNEE_BONUS, POIGNEE_NAMES, DEALS, TARGETS, SHOW_MS, EXCUSE, PETIT, isBout, isKing, suitOf, rankOf, classOf,
  cardName, short, PTS, legalFor, whyNot, callable, checkDiscard, poigneeLevels, sortHand, SUIT_NAMES, leadBan,
} from "./tarot-rules.js";
import { LEVEL_NAMES, LEVELS } from "./tarot-bot.js";
import { advise } from "./tarot-coach.js";
import { createThinker } from "./tarot-think.js";
import { seatPage } from "./seats-ui.js";
import { applyMove } from "./seats.js";
import { tarotCard, backHtml } from "./tarot-faces.js";
import { plateHtml, bubble, drawHandBox } from "./cardroom.js";
import { sideways } from "./wide.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { ramp } from "./ramp.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { tarotStage } from "./tarot-stage.js";
import { COURSE } from "./tarot-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "tarot:opts", RECORD = "tarot:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Marie", "Jean", "Colette", "Étienne", "Odile"];                // the computer players, by seat

let opts = { level: "hard", seats: 4, deals: 8, petitSec: true, hot: 1, colours: false, counting: true, coach: true, ...read(OPTS, {}) };
if (!LEVEL_NAMES.some(([k]) => k === opts.level)) opts.level = "hard";
if (![3, 4, 5].includes(opts.seats)) opts.seats = 4;
if (!DEALS.includes(opts.deals)) opts.deals = 8;
opts.hot = Math.max(1, Math.min(opts.seats, Number(opts.hot) || 1));
// Korbi, 4 November 2026: the menu is the minimum it needs to be. Eight deals, a Petit sec voiding the deal, the taker's
// points shown, the usual two-colour suits, whatever an older save chose (a game in hand keeps its own rules, in its
// state). The computer players' strength is the hidden ramp, its first step the old saved choice (a lesson's game plays
// Easy, once). Players and People on this phone stay: they are who sits down.
const OLD_LEVEL = opts.level;
Object.assign(opts, { deals: 8, petitSec: true, counting: true, colours: false });
let lesson = false, lessonNext = false;
const levelNow = () => (lesson ? "easy" : ramp("tarot", LEVEL_NAMES.map(([k]) => k), { start: OLD_LEVEL }));
const saveOpts = () => write(OPTS, opts);
const gameOptions = () => ({ deals: opts.deals, petitSec: opts.petitSec });
document.documentElement.classList.toggle("tr-colours", !!opts.colours);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the table and its thinking ----------
let V = null, page = null;
let sel = new Set(), selFor = "", handful = null, hinted = null, snap = null, uncovered = "";
const player = createThinker(), coach = createThinker();
const cache = new Map();                          // the worker's cards, by decision, for the runner to take
let thinking = null, asking = "";
const keyOf = (s, seat) => `${s.deal}:${s.ply}:${seat}`;
// the runner asks `bot` for a computer player's move; where the worker has worked it out, that is it
const pageRules = { ...rules, bot: (s, seat, ctx) => { const k = keyOf(s, seat), m = cache.get(k); if (m) { cache.delete(k); return m; } return rules.bot(s, seat, ctx); } };
const hot = () => !!page && !page.atTable && opts.hot > 1;
const isHot = seat => hot() && seat < opts.hot;
const randomRounds = seatRounds("tarot", ["shown"]);   // random mode's round: a deal
page = seatPage({
  rules: pageRules, id: "tarot", app: 1, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => levelNow(), voice: () => false,
  pace: s => (cache.has(keyOf(s, s.turn)) ? 650 : s.step === "play" ? 850 : 1100),
  hold: () => thinking !== null || (hot() && V?.toMove != null && V.toMove < opts.hot),
  onView: v => { V = v; follow(v); draw(); randomRounds(v); think(v); },
  onOver, toast, newGame,
});
const nameOf = seat => {
  const n = V?.state?.n ?? opts.seats;
  if (page && !page.atTable) return seat === 0 && opts.hot <= 1 ? "You" : seat < opts.hot ? `Player ${seat + 1}` : NAMES[seat] || `Seat ${seat + 1}`;
  void n;
  return V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
};
/** Who looks at the screen: the seat whose cards show, or null (a hand passed on, a watcher). */
function viewer(v) {
  if (!v?.G) return null;
  if (page.atTable) return v.seat;
  if (opts.hot <= 1) return 0;
  const t = v.toMove;
  return t != null && t < opts.hot && uncovered === coverKey(v) ? t : null;
}
const coverKey = v => `${v.G.seq}:${v.state.ply}:${v.toMove}`;
/** The seat drawn at the foot of the table. */
const footSeat = v => (page.atTable ? v.seat ?? 0 : opts.hot > 1 ? (v.toMove != null && v.toMove < opts.hot ? v.toMove : lastHot) : 0);
let lastHot = 0;
const myTurn = v => { const w = viewer(v); return w != null && v.toMove === w && !v.over; };

function follow(v) {
  if (!v.G) return;
  const s = v.state, k = `${v.G.seq}:${s.deal}:${s.step}:${s.ply}`;
  if (k !== selFor) { selFor = k; sel = new Set(); handful = null; hinted = null; }
  if (v.toMove != null && v.toMove < opts.hot) lastHot = v.toMove;
}

// ---------- the worker plays the computer's cards ----------
function think(v) {
  if (!page || !v.G || v.over || !page.host || page.atTable || IN_FRAME) { thinking = null; return; }
  const s = v.state, seat = v.toMove;
  if (seat == null || s.step !== "play" || !v.seats[seat]?.bot || isHot(seat) || !LEVELS[levelNow()]?.samples) { thinking = null; return; }
  const k = keyOf(s, seat);
  if (cache.has(k) || thinking === k) return;
  thinking = k;
  player.ask({ kind: "move", G: v.G, seat, level: levelNow() }).then(mv => {
    if (mv) cache.set(k, mv);
    if (cache.size > 6) cache.delete(cache.keys().next().value);
    if (thinking === k) { thinking = null; page.runner.kick(); }
  });
}

// ---------- the coach ----------
function askCoach() {
  const v = V;
  if (!v?.G || !myTurn(v) || IN_FRAME) return;
  const s = v.state, key = `${v.G.seq}:${s.ply}`;
  if (hinted?.key === key && hinted.words) { draw(); return; }
  hinted = { key, words: "" };
  asking = key;
  draw();
  coach.ask({ kind: "hint", G: v.G, seat: viewer(v) }).then(r => {
    if (asking !== key || !r) return;
    hinted = { key, ...r };
    applyHint(v, r);
    draw();
  });
}
/** The coach's choice picked in the hand, as if tapped. */
function applyHint(v, r) {
  const s = v.state;
  if (r.kind === "play") { sel = new Set([r.move.card]); handful = r.move.show ? { level: POIGNEE[s.n].indexOf(r.move.show.length), cards: r.move.show } : null; }
  else if (r.kind === "discard") sel = new Set(r.cards);
  else if (r.kind === "call") sel = new Set([r.move.card]);
}

// ---------- words ----------
const who = seat => nameOf(seat);
const youOr = (seat, you, they) => (viewerNow() === seat && !page.atTable && opts.hot <= 1 ? you : they);
const viewerNow = () => (V ? (page.atTable ? V.seat : opts.hot <= 1 ? 0 : footSeat(V)) : 0);
const bidName = b => BIDS[b].full || BIDS[b].name;
const needLine = s => {
  const r = TARGETS;
  void r;
  return "";
};
const attPoints = s => {
  const hasBouts = s.piles[0].filter(isBout).length;
  const pts = s.piles[0].reduce((t, c) => t + PTS[c], 0) / 2;
  return { pts, bouts: hasBouts, need: TARGETS[hasBouts] };
};
/** A verb for a seat: "you hold", "Marie holds". */
const vb = (seat, you, they) => (who(seat) === "You" ? you : they);
const theCard = c => (c === EXCUSE ? cardName(c) : `the ${cardName(c)}`);
const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const sign = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function stripLine(v) {
  const s = v.state;
  // the brass plate across the top (cardroom.js): the deal, the contract, and each seat's score
  const phase = s.step === "thrown" ? "thrown in" : s.step === "bid" ? "bidding" : "";
  const bits = [];
  if (s.taker != null && s.step !== "thrown" && s.step !== "bid") {
    bits.push(bidName(s.bid), `${esc(who(s.taker))} take${who(s.taker) === "You" ? "" : "s"}`);
    if (s.step === "play" && opts.counting) { const a = attPoints(s); bits.push(`${fmt(a.pts)} of ${a.need}`); }
  }
  return plateHtml({ title: `<small>Deal</small><b>${s.deal}/${s.opts.deals}</b>`,
    items: s.scores.map((sc, i) => ({ k: who(i).slice(0, 6), v: `${sc > 0 ? "+" : ""}${sc}`, on: s.step === "play" && s.turn === i })), tail: [phase, ...bits].filter(Boolean).join(" · ") });
}

function roleChip(v, seat) {
  const s = v.state;
  if (s.taker == null || s.step === "bid" || s.step === "thrown") return "";
  const me = footSeat(v);
  if (seat === s.taker) return `<span class="tr-role taker">${s.alone && (s.revealed || s.step === "shown") ? "Alone" : "Taker"}</span>`;
  if (s.n === 5 && s.partner === seat && (s.revealed || seat === me || s.step === "shown" || s.step === "over")) return `<span class="tr-role partner">Partner</span>`;
  return "";
}

/** What a seat has put on the table this trick (or last), as a card. */
function trickCard(s, seat) {
  const cur = s.trick.plays.find(p => p.seat === seat);
  if (cur) return { card: cur.card, old: false };
  if (!s.trick.plays.length && s.tricks.length && s.step === "play") {
    const last = s.tricks[s.tricks.length - 1], p = last.plays.find(x => x.seat === seat);
    if (p) return { card: p.card, old: true, won: last.win === seat };
  }
  return null;
}
function slotHtml(v, seat) {
  const s = v.state;
  if (s.step === "bid" || s.step === "thrown" || (s.step === "call" || s.step === "discard" || s.step === "announce") && !s.tricks.length) {
    const b = [...s.bids].reverse().find(x => x.seat === seat);
    if (s.step === "bid" || s.step === "thrown") {
      if (b) return `<span class="tr-word${b.n ? " yes" : ""}">${esc(b.n ? BIDS[b.n].short : "Pass")}</span>`;
      return s.step === "bid" && s.turn === seat && !(viewer(v) === seat) ? `<span class="tr-thinking">bidding</span>` : "";
    }
    if (seat === s.taker) return `<span class="tr-word yes">${esc(BIDS[s.bid].short)}</span>`;
    return "";
  }
  if (s.step === "shown" || s.step === "over") return "";
  const t = trickCard(s, seat);
  if (t) return tarotCard(t.card, { cls: `${t.old ? "old" : ""}${t.won ? " won" : ""}` });
  if (s.step === "play" && v.toMove === seat && viewer(v) !== seat) return `<span class="tr-thinking">${v.seats[seat]?.bot ? "thinking" : "to play"}</span>`;
  return "";
}

// ---------- the table ----------
function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("table").innerHTML = ""; $("hand").innerHTML = ""; $("strip").textContent = ""; $("bar").innerHTML = ""; $("cover").hidden = true; return; }
  const s = v.state;
  $("strip").innerHTML = stripLine(v);
  drawCover(v);
  drawTable(v);
  drawHand(v);
  coachBubble.show(statusLine(v));                                  // only the coach's word and a rule that stops a move: the buttons say the rest
  drawBar(v);
}

function drawCover(v) {
  const c = $("cover");
  const need = hot() && v.toMove != null && v.toMove < opts.hot && uncovered !== coverKey(v) && !v.over && !["shown", "thrown"].includes(v.state.step);
  if (!need) { c.hidden = true; return; }
  c.hidden = false;
  c.innerHTML = `<div class="tr-cover-in"><p class="tr-cover-name">${esc(who(v.toMove))}</p><p>Pass the phone. Tap when you have it, and nobody else is looking.</p><button class="btn primary" type="button" data-act="uncover">I am ${esc(who(v.toMove))}</button></div>`;
}

function panel(v, seat) {
  const s = v.state, turn = ["bid", "call", "discard", "announce", "play"].includes(s.step) && v.toMove === seat;
  const n = s.hands[seat].length;
  return `<div class="tr-panel${turn ? " turn" : ""}"><div class="tr-who"><b>${esc(who(seat))}</b>${roleChip(v, seat)}</div>
    <div class="tr-meta"><span class="tr-n" title="Cards left">${backHtml()}<b>${n}</b></span><span class="tr-sc" title="Points">${sign(s.scores[seat])}</span></div></div>`;
}
function drawTable(v) {
  const s = v.state, n = s.n, me = footSeat(v), box = $("table");
  const others = Array.from({ length: n - 1 }, (_, k) => (me + n - 1 - k) % n);
  const cols = others.map(o => `<div class="tr-col" data-seat="${o}">${panel(v, o)}<div class="tr-slot">${slotHtml(v, o)}</div></div>`).join("");
  const mine = `<div class="tr-me${v.toMove === me && !v.over && ["bid", "call", "discard", "announce", "play"].includes(s.step) ? " turn" : ""}"><div class="tr-slot">${slotHtml(v, me)}</div><div class="tr-mewho"><b>${esc(who(me))}</b>${roleChip(v, me)}<span class="tr-sc">${sign(s.scores[me])}</span></div></div>`;
  box.style.setProperty("--cols", n - 1);
  box.classList.toggle("tr-playing", s.step === "play");
  box.classList.toggle("tr-five", n === 5);                          // four narrow columns: a role chip wraps under the name, so room is kept for it
  box.innerHTML = `<div class="tr-cols">${cols}</div><div class="tr-mid">${midHtml(v)}</div>${mine}`;
}

/** The middle of the table: the dog, the call, the result. */
function midHtml(v) {
  const s = v.state, me = footSeat(v);
  const cardsRow = (ids, cls = "") => `<span class="cd-line tr-line ${ids.length > 6 ? "many " : ""}${cls}">${ids.map(c => tarotCard(c)).join("")}</span>`;
  if (s.step === "shown" || s.step === "over") return resultHtml(v);
  if (s.step === "thrown") return `<p class="tr-note">${s.why?.sec != null ? `<b>${esc(who(s.why.sec))}</b> ${vb(s.why.sec, "hold", "holds")} the 1 of trumps and no other trump: a petit sec. The deal is void.` : "Nobody bid: the hands are thrown in."}</p>`;
  if (s.step === "bid") {
    return `<p class="tr-note">The dog: ${s.dog.length} cards, ${s.n === 5 ? "to the taker, after a king is called" : "to the taker"}. ${s.bids.length ? "" : `<b>${esc(who(s.first))}</b> ${vb(s.first, "bid", "bids")} first.`}</p>`;
  }
  if (s.step === "call") {
    if (v.toMove === viewer(v)) return `<p class="tr-note">Call a king: its holder is your partner.</p><div class="tr-calls">${callable(s.hands[s.taker]).map(c => tarotCard(c, { cls: sel.has(c) ? "sel" : s.hands[s.taker].includes(c) ? "mine" : "", data: { call: c } })).join("")}</div>`;
    return `<p class="tr-note"><b>${esc(who(s.taker))}</b> takes with ${esc(bidName(s.bid))} and is calling a king.</p>`;
  }
  if (s.step === "discard" || s.step === "announce") {
    const what = s.dogSeen ? `<p class="tr-note">The dog</p>${cardsRow(s.dog)}` : `<p class="tr-note">${esc(bidName(s.bid))}: the dog stays face down, ${s.bid === 3 ? "its points the taker's" : "its points the defence's"}.</p>`;
    const called = s.call != null ? `<p class="tr-note">${s.alone ? "Called" : "Called, partner unknown"}: ${cardsRow([s.call])}</p>` : "";
    return what + called;
  }
  // the play: what was called, the handfuls shown, the trick
  const bits = [];
  if (s.call != null) bits.push(`Called ${cardsRow([s.call])}${s.revealed ? (s.alone ? " (alone)" : ` · partner <b>${esc(who(s.partner))}</b>`) : ""}`);
  for (const p of s.poignees) bits.push(`<b>${esc(who(p.seat))}</b> ${vb(p.seat, "show", "shows")} a ${POIGNEE_NAMES[p.level]} handful ${cardsRow(p.cards, "small")}`);
  const no = s.tricks.length + (s.trick.plays.length ? 1 : 0) || 1;
  const head = `<p class="tr-note">Trick <b>${Math.min(no, SIZES[s.n].hand)}</b> of ${SIZES[s.n].hand}${s.ecartShown.length ? ` · discarded trumps ${s.ecartShown.map(c => short(c)).join(" ")}` : ""}</p>`;
  return head + bits.map(b => `<p class="tr-note">${b}</p>`).join("");
}

function resultHtml(v) {
  const s = v.state, r = s.result;
  if (s.step === "over") return `<p class="tr-result">${esc(finalLine(s))}</p>`;
  const taker = who(r.taker), partner = r.partner != null ? who(r.partner) : null;
  const lines = [];
  lines.push(`<p class="tr-result"><b>${esc(taker)}</b> ${r.made ? "make" : "fail"}${taker === "You" ? "" : "s"} ${esc(bidName(r.bid))}${partner ? ` with ${esc(partner)}` : r.alone && s.n === 5 ? " alone" : ""}: ${fmt(r.ptsH / 2)} points and ${r.bouts} bout${r.bouts === 1 ? "" : "s"} against ${r.target}, ${r.made ? "over" : "short"} by ${r.margin}.</p>`);
  const extra = [];
  if (r.petit) extra.push(`petit au bout ${r.petit > 0 ? "to the taker's side" : "to the defence"} (${Math.abs(r.petit)} × ${r.mult})`);
  if (r.poignee) extra.push(`handfuls ${r.poignee}`);
  if (r.chelem) extra.push(`slam ${sign(r.chelem)}`);
  lines.push(`<p class="tr-note">(25 + ${r.margin})${r.made ? "" : " lost"} × ${r.mult}${extra.length ? `, ${extra.join(", ")}` : ""}: ${Math.abs(r.X)} ${r.X >= 0 ? "from" : "to"} each defender.</p>`);
  const rows = r.deltas.map((d, i) => `<span class="tr-pay ${d > 0 ? "up" : d < 0 ? "down" : ""}">${esc(who(i))} ${sign(d)}</span>`).join("");
  lines.push(`<div class="tr-pays">${rows}</div>`);
  const left = Math.max(0, (s.until ?? 0) - Date.now());
  lines.push(`<span class="tr-next" aria-hidden="true"><i style="animation-duration:${SHOW_MS}ms;animation-delay:-${Math.min(SHOW_MS, SHOW_MS - left)}ms"></i></span>`);
  return lines.join("");
}
function finalLine(s) {
  const names = s.winners.map(i => who(i)), best = Math.max(...s.scores);
  return `${names.join(" and ")} win${s.winners.length === 1 && names[0] !== "You" ? "s" : ""} the game with ${sign(best)}.`;
}

// ---------- your cards ----------
function handCards(v) {
  const w = viewer(v);
  if (w == null) return null;
  return sortHand(v.state.hands[w]);
}
function drawHand(v) {
  const box = $("hand"), s = v.state, w = viewer(v);
  const cards = handCards(v);
  if (cards == null) {
    box.style.height = "";
    const n = s.hands[footSeat(v)]?.length || 0;
    box.innerHTML = hot() && n ? `<p class="tr-watch">The hands are hidden: pass the phone.</p>` : `<p class="tr-watch">${page.atTable && v.seat == null ? "Watching: you sit down at the next game." : ""}</p>`;
    return;
  }
  const playable = myTurn(v) && s.step === "play" ? new Set(legalFor(s, w)) : null;
  const picking = myTurn(v) && s.step === "discard";
  const okPick = picking ? new Set(cards.filter(c => !isBout(c) && !isKing(c) && (c >= 22 || s.hands[w].filter(x => x >= 22 && !isKing(x)).length < s.dog.length))) : null;
  const fresh = s.step === "discard" ? new Set(s.dog) : new Set();
  const shown = new Set(handful?.cards || []);
  // Guandan's fan (cardroom.js): the trumps in one run and each suit in its own
  const cols = [cards.filter(c => c <= EXCUSE)];
  const bySuit = new Map();
  for (const c of cards.filter(c => c > EXCUSE)) { const su = suitOf(c); if (!bySuit.has(su)) bySuit.set(su, []); bySuit.get(su).push(c); }
  cols.push(...bySuit.values());
  drawHandBox(box, { cols: cols.filter(c => c.length), fan: true, html: (id, o) => tarotCard(id, o), label: String,
    classes: c => [sel.has(c) && "sel", fresh.has(c) && "fresh", shown.has(c) && "lit",
      (playable && !playable.has(c) || okPick && !okPick.has(c)) && "dim", hinted?.key === `${v.G.seq}:${s.ply}` && hinted.cards?.includes(c) && "hint"].filter(Boolean).join(" ") });
}
$("hand").addEventListener("click", e => {
  const c = e.target.closest(".cd[data-id]");
  if (!c || !V?.G || !myTurn(V)) return;
  const id = Number(c.dataset.id), s = V.state, w = viewer(V);
  if (s.step === "play") {
    if (!legalFor(s, w).includes(id)) { toast(whyNot(s, w, id)); return; }
    if (sel.has(id)) { playSelected(); return; }
    sel = new Set([id]);
    draw();
  } else if (s.step === "discard") {
    if (sel.has(id)) sel.delete(id);
    else if (sel.size < s.dog.length) sel.add(id);
    else sel = new Set([...sel].slice(1).concat(id));
    draw();
  }
});

// ---------- status and buttons ----------
/** What the bubble says: the coach's word, or why the cards picked to set aside won't do; the buttons carry all the rest. */
function statusLine(v) {
  const s = v.state, w = viewer(v);
  if (hinted?.key === `${v.G.seq}:${s.ply}` && myTurn(v)) return hinted.words ? `<b>Coach</b> ${esc(hinted.words)}` : `<span class="tr-thinking">The coach is weighing it</span>`;
  if (s.step === "discard" && w != null && myTurn(v) && sel.size === s.dog.length) { const why = checkDiscard(s.hands[w], [...sel], s.dog.length); return why ? esc(why) : ""; }
  return "";
}
const coachBubble = bubble($("coach"));

function drawBar(v) {
  const bar = $("bar"), s = v.state, w = viewer(v);
  const b = (act, text, { primary = false, off = false, cls = "" } = {}) => `<button type="button" class="btn${primary ? " primary" : ""} tr-go ${cls}" data-act="${act}"${off ? " disabled" : ""}>${text}</button>`;
  if (s.step === "shown") { bar.innerHTML = b("next", "Next deal", { primary: true }); return; }
  if (s.step === "over") { bar.innerHTML = page.host ? b("again", "New game", { primary: true }) : ""; return; }
  if (s.step === "thrown") { bar.innerHTML = b("next", "Deal again", { primary: true }); return; }
  const undo = snap && snap.G.seq === v.G.seq && snap.G.state.deal === s.deal && !page.atTable && opts.hot <= 1 ? b("undo", "Take back", { cls: "quiet" }) : "";
  if (!myTurn(v)) { bar.innerHTML = undo; return; }
  const hintBtn = opts.coach && !IN_FRAME ? b("hint", "Hint", { cls: "quiet" }) : "";
  if (s.step === "bid") {
    bar.innerHTML = b("bid0", "Pass") + [1, 2, 3, 4].map(n => b(`bid${n}`, BIDS[n].short, { primary: n === 2, off: n <= s.high })).join("") + hintBtn;
    return;
  }
  if (s.step === "call") { bar.innerHTML = b("call", sel.size ? `Call the ${short([...sel][0])}` : "Call", { primary: true, off: !sel.size }) + hintBtn; return; }
  if (s.step === "discard") {
    const k = s.dog.length, okd = sel.size === k && !checkDiscard(s.hands[w], [...sel], k);
    bar.innerHTML = b("discard", `Discard ${sel.size} of ${k}`, { primary: true, off: !okd }) + hintBtn;
    return;
  }
  if (s.step === "announce") { bar.innerHTML = b("announce0", "Play", { primary: true }) + b("announce1", "Announce a slam") + hintBtn; return; }
  const lv = poigneeLevels(s, w);
  const handBtns = lv.map(l => b(`hand${l.level}`, `Show ${l.size} (${POIGNEE_BONUS[l.level]})`, { cls: handful?.level === l.level ? "on quiet" : "quiet" })).join("");
  const one = sel.size ? [...sel][0] : null;
  bar.innerHTML = handBtns + b("play", one != null ? `Play ${short(one)}` : "Play", { primary: true, off: one == null }) + hintBtn + undo;
}

async function send(m) {
  const v = V, seat = viewer(v);
  if (seat == null) return;
  let why = "";
  const before = v.G;
  if (!page.atTable && opts.hot > 1) {
    const t = page.runner.table;
    const ok = await t.act(cur => {
      if (!cur.game) return false;
      const r = applyMove(pageRules, cur.game, seat, m, t.now());
      if (r.error) { why = r.error; return false; }
      cur.game = r.G;
    });
    if (!ok && !why) why = "Couldn't make that move: try again";
  } else why = await page.move(m);
  if (why) { toast(why); return; }
  if (!page.atTable && opts.hot <= 1) snap = { G: before };
}
function playSelected() {
  const v = V, w = viewer(v);
  if (w == null || !sel.size) return;
  const card = [...sel][0], m = { t: "play", card };
  if (handful && v.state.hands[w].length === SIZES[v.state.n].hand) m.show = handful.cards;
  void send(m);
}
$("bar").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled || !V?.G) return;
  const a = b.dataset.act, s = V.state, w = viewer(V);
  if (a === "next") { await page.move({ t: "next" }).then(why => why && toast(why)); return; }
  if (a === "again") { newGame(); return; }
  if (a === "undo") { takeBack(); return; }
  if (a === "hint") { askCoach(); return; }
  if (a.startsWith("bid")) return void send({ t: "bid", n: Number(a.slice(3)) });
  if (a === "call") return void send({ t: "call", card: [...sel][0] });
  if (a === "discard") return void send({ t: "discard", cards: [...sel] });
  if (a.startsWith("announce")) return void send({ t: "announce", yes: a === "announce1" });
  if (a === "play") return playSelected();
  if (a.startsWith("hand") && w != null) {
    const level = Number(a.slice(4));
    if (handful?.level === level) handful = null;
    else {
      const size = POIGNEE[s.n][level], hand = s.hands[w];
      const t = hand.filter(c => c < 21).sort((x, y) => x - y);
      const cards = t.length >= size ? t.slice(0, size) : hand.includes(EXCUSE) ? [...t, EXCUSE] : t;
      handful = { level, cards };
    }
    draw();
  }
});
$("cover").addEventListener("click", e => {
  if (!e.target.closest("[data-act=uncover]") || !V?.G) return;
  uncovered = coverKey(V);
  draw();
});
$("table").addEventListener("click", e => {
  const c = e.target.closest(".tr-calls .cd[data-call]");
  if (c && V?.G && myTurn(V) && V.state.step === "call") { sel = new Set([Number(c.dataset.call)]); draw(); }
});
async function takeBack() {
  if (!snap || !V?.G || snap.G.seq !== V.G.seq) return;
  const g = snap.G;
  snap = null;
  cache.clear();
  await page.runner.table.act(cur => { cur.game = g; });
  toast("Taken back");
}
// the coach is asked for the bid and the rest as well: its reading shows in the status line until you move

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const s = v.state, mine = v.seat, won = s.winners.includes(mine);
  const r = read(RECORD, { played: 0, won: 0, best: null });
  r.played++;
  if (won) r.won++;
  r.best = r.best == null ? s.scores[mine] : Math.max(r.best, s.scores[mine]);
  write(RECORD, r);
  noteStreak("tarot", won);
  if (!page.atTable && !lesson) { levelNow(); won ? ramp.won(true) : ramp.lost(); }
  setTimeout(() => { if (V?.over) showEnd(V); }, 900);
}
function showEnd(v) {
  const s = v.state, me = page.atTable ? v.seat : 0;
  $("endHead").textContent = s.winners.includes(me) ? (s.winners.length > 1 ? "You share the win" : "You win") : `${who(s.winners[0])} wins`;
  const order = s.scores.map((sc, i) => [i, sc]).sort((a, b) => b[1] - a[1]);
  $("endBody").innerHTML = `<ul class="tr-standings">${order.map(([i, sc]) => `<li class="${s.winners.includes(i) ? "won" : ""}${i === me ? " me" : ""}"><span class="nm">${esc(who(i))}</span><b>${sign(sc)}</b></li>`).join("")}</ul>
    <p class="tr-end-note">${s.log.length} deals. ${s.log.filter(e => e.made).length} contracts made, ${s.log.filter(e => !e.made).length} failed.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  snap = null; cache.clear(); uncovered = "";
  lesson = lessonNext; lessonNext = false;
  page.deal(gameOptions(), opts.seats);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, the course, the menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>French tarot (le tarot) as the Fédération Française de Tarot plays it, for three, four or five. Seventy-eight cards: the 21 trumps (atouts), the Excuse, and four suits of fourteen (1 to 10, jack, knight, queen, king). Everyone is dealt ${SIZES[3].hand} (3 players), ${SIZES[4].hand} (4) or ${SIZES[5].hand} (5); the rest, the dog (chien), is ${SIZES[3].dog} cards (3 cards with five players).</p>
    <p><b>Bids.</b> One round, each player once, each bid above the last: Petite (×1), Garde (×2), Garde sans le chien (×4: the dog counts for the taker without being looked at) or Garde contre le chien (×6: it counts for the defence). Nobody bids: thrown in. With Petite or Garde the taker (preneur) turns the dog up, takes it and sets the same number of cards aside (écart): never kings, bouts or, while there is anything else, trumps. Five players: the taker first calls a king; its holder is the partner, unknown until it is played.</p>
    <p><b>Play.</b> The player after the dealer leads. Follow suit; with none you must trump, and over-trump if you can. When a trump is led, play a higher one if you can. The Excuse is played at any time, never wins and stays with its side (a half-point card is owed if the trick goes the other way; in the last trick it changes sides).</p>
    <p><b>Counting.</b> The bouts (oudlers) are the 1 and 21 of trumps and the Excuse. The taker's side needs 56 points with no bout, 51 with one, 41 with two, 36 with three, of the 91 in the pack: king 4½, queen 3½, knight 2½, jack 1½, other cards ½, bouts 4½.</p>
    <p><b>Score.</b> (25 + points over or under) × the bid's multiplier, plus 10 × it for the petit au bout (the 1 of trumps in the last trick, to whoever wins it), plus a handful (poignée: ${POIGNEE[3].join("/")} trumps with three players, ${POIGNEE[4].join("/")} with four, ${POIGNEE[5].join("/")} with five, shown with your first card: 20, 30, 40), plus a slam (chelem: every trick; 400 if announced, 200 if not, −200 if announced and missed). The taker wins it from each opponent (with four: three times each defender's score; with three: twice; with five: twice, the partner once, or four times alone).</p>`;
  $("rulesDlg").showModal();
}
const course = createCourse({
  id: "tarot", course: COURSE, stage: tarotStage(), cls: "tr", inFrame: IN_FRAME, onRules: showRules,
  onPlay: () => { lessonNext = true; opts.seats = 4; opts.hot = 1; saveOpts(); newGame(); },
});

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("tarot", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Tarot, from the rules", () => course.open()));
  const set = part(body, "settings");
  set.append(choice("Players", [[3, "3"], [4, "4"], [5, "5"]], opts.seats, v => { opts.seats = Number(v); opts.hot = Math.min(opts.hot, opts.seats); saveOpts(); }));
  set.append(choice("On this phone", [1, 2, 3, 4, 5].filter(n => n <= opts.seats).map(n => [n, n === 1 ? "just me" : `${n} people`]), opts.hot, v => { opts.hot = Number(v); saveOpts(); }));
  set.append(line("People on this phone pass it round: each hand is hidden until its player taps. The players apply from the next game."));
  set.append(toggle("Coach", opts.coach, on => { opts.coach = on; saveOpts(); draw(); }));
  const r = read(RECORD, { played: 0, won: 0, best: null }), st = read("tarot:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}${r.best != null ? `; best ${sign(r.best)}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "tarot");
document.querySelector(".tr-mark").innerHTML = APPS.find(a => a.id === "tarot")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
window.__tarot = { page, get view() { return V; }, opts, get sel() { return sel; }, course, advise };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
