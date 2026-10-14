// Landlord (斗地主) against computer players, or at a table with friends each on their own phone. The rules and words
// are landlord-rules.js's, the computer players landlord-bot.js's, the running seats.js's (seats-ui.js). This page draws
// the table: the two others at its top corners with what each did this trick, the kitty between them, your cards
// along the foot, picked by a tap; the bidding's buttons while it's on.
import { rules, check, playsFor, countsOf, rankOf, suitOf, RANKS, TYPE_NAMES, PLAY_TALK, DEALS, cardName, SHOW_MS, THROWN_MS, BIG, SMALL } from "./landlord-rules.js";
import { botMove, LEVEL_NAMES } from "./landlord-bot.js";
import { seatPage } from "./seats-ui.js";
import { cardHtml, backHtml, fitRow } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { cardStage } from "./course-cards.js";
import { COURSE, judge } from "./landlord-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "landlord:opts", RECORD = "landlord:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Da Hai", "Lao Wang", "Xiao Mei"];                    // the computer players, by seat
const TALK = [["zh", "普通话"], ["yue", "廣東話"], ["en", "English"]];

let opts = { level: "hard", deals: 6, bidding: "points", talk: "zh", voice: true, counter: true, order: "big", ...read(OPTS, {}) };
if (!DEALS.includes(opts.deals)) opts.deals = 6;
const saveOpts = () => write(OPTS, opts);
const gameOptions = () => ({ deals: opts.deals, bidding: opts.bidding, talk: opts.talk });

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- words, in the table talk chosen ----------
const W = {
  zh: { landlord: "地主", peasant: "农民", pass: "不要", cant: "要不起", nobid: "不叫", pts: n => `${n}分`, call: "叫地主", rob: "抢地主", norob: "不抢", kitty: "底牌" },
  yue: { landlord: "地主", peasant: "農民", pass: "唔要", cant: "要唔起", nobid: "唔叫", pts: n => `${["", "一", "兩", "三"][n]}分`, call: "叫地主", rob: "搶地主", norob: "唔搶", kitty: "底牌" },
  en: { landlord: "Landlord", peasant: "Peasant", pass: "Pass", cant: "Can't", nobid: "No bid", pts: n => `${n} point${n > 1 ? "s" : ""}`, call: "Landlord!", rob: "Rob!", norob: "No rob", kitty: "Kitty" },
};
const words = s => W[s?.opts?.talk] || W.zh;

const face = id => (id === BIG ? { joker: "big" } : id === SMALL ? { joker: "small" } : { rank: RANKS[rankOf(id)], suit: suitOf(id) });
const cards = (ids, cls = "") => ids.map(id => cardHtml(face(id), { cls, label: cardName(id) })).join("");
/** Cards on the table in rows of at most `per` (a long play, or the cards left at the end, don't run off the table). */
function rows(ids, per) {
  const out = [], many = ids.length > 6 ? " many" : "";
  for (let i = 0; i < ids.length; i += per) out.push(`<span class="cd-line${many}">${cards(ids.slice(i, i + per))}</span>`);
  return `<span class="ll-rows">${out.join("")}</span>`;
}
const typeName = p => TYPE_NAMES[p.type];

let V = null, sel = new Set(), selFor = "", page = null, hints = { key: "", list: [], i: 0 };
page = seatPage({
  rules, id: "landlord", app: 1, pace: 950, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); }, onOver, toast,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;

/** Where each seat sits round the table, from yours: the next to your right, the other to your left. */
function placeOf(seat) {
  const me = V.seat ?? 0, k = (seat - me + 3) % 3;
  return ["at-me", "at-right", "at-left"][k];
}

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("table").innerHTML = ""; $("hand").innerHTML = ""; $("status").textContent = ""; $("counter").innerHTML = ""; drawBar(); return; }
  const s = v.state;
  // the picked cards stay picked while the others play; a new hand, or a move of yours, clears them
  const key = `${v.G.seq}:${s.deal}:${s.landlord}:${(s.hands[v.seat ?? 0] || []).length}`;
  if (key !== selFor) { selFor = key; sel = new Set(); }
  $("strip").innerHTML = stripLine(s);
  drawTable(v);
  drawCounter(v);
  drawHand(v);
  $("status").innerHTML = statusLine(v);
  drawBar();
}

/** The deal, and the stake as it stands: the bid (or 1, doubled by each rob), doubled by each bomb. */
function stripLine(s) {
  const head = `Deal <b>${s.deal}</b> of ${s.opts.deals}`;
  if (s.step === "bid" || s.step === "thrown") return `${head} · ${s.opts.bidding === "rob" ? "calling the landlord" : "bidding"}${s.opts.bidding === "rob" && s.robs ? ` · ×${2 ** s.robs}` : ""}`;
  const r = s.step === "play" ? null : s.result, doubles = r ? r.doubles : s.doubles, stake = r ? r.stake : s.stake;
  const robs = s.opts.bidding === "rob" ? s.robs : 0, spring = r && (r.spring || r.anti) ? 1 : 0, bombs = doubles - robs - spring;
  const n = (k, one) => `${k} ${one}${k > 1 ? "s" : ""}`;
  const why = [s.opts.bidding === "points" ? `bid ${stake}` : "", robs ? n(robs, "rob") : "", bombs ? n(bombs, "bomb") : "", spring ? (r.spring ? "spring" : "anti-spring") : ""].filter(Boolean).join(", ");
  return `${head} · Stake <b>${stake * 2 ** doubles}</b>${why ? ` <small>(${why})</small>` : ""}`;
}

/** The latest a seat has done in this trick, or bid in this bidding. */
function actOf(s, seat) {
  for (let i = s.trick.plays.length - 1; i >= 0; i--) if (s.trick.plays[i].seat === seat) return s.trick.plays[i];
  return null;
}
function bidOf(s, seat) {
  for (let i = s.bids.length - 1; i >= 0; i--) if (s.bids[i].seat === seat) return s.bids[i];
  return null;
}
function bidWord(s, b) {
  const w = words(s);
  if (s.opts.bidding === "points") return b.n ? w.pts(b.n) : w.nobid;
  if (b.phase === "call") return b.yes ? w.call : w.nobid;
  return b.yes ? w.rob : w.norob;
}
function drawTable(v) {
  const s = v.state, w = words(s), res = s.step === "shown" || s.step === "over" ? s.result : null;
  const seatHtml = seat => {
    const place = placeOf(seat), turn = (s.step === "play" || s.step === "bid") && s.turn === seat, per = place === "at-me" ? 14 : 8;
    const lead = !res && s.step === "play" && s.trick.by === seat && s.trick.last;
    const count = s.hands[seat].length, sc = s.scores[seat], role = s.landlord == null ? "" : seat === s.landlord ? "landlord" : "peasant";
    let play = "";
    if (res) {
      const left = res.hands[seat], d = res.deltas[seat];
      play = `${left.length ? rows(left, per) : `<span class="ll-out">Out</span>`}<span class="ll-pay ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d)}</span>`;
    } else if (s.step === "bid" || s.step === "thrown") {
      const b = bidOf(s, seat);
      if (b) play = `<span class="ll-word${(s.opts.bidding === "points" ? b.n : b.yes) ? " yes" : ""}">${esc(bidWord(s, b))}</span>`;
      else if (turn && !isMe(seat)) play = `<span class="ll-thinking">bidding</span>`;
    } else {
      const a = actOf(s, seat);
      if (a?.pass) play = `<span class="ll-word">${esc(a.cant ? w.cant : w.pass)}</span>`;
      else if (a?.cards) play = rows(a.cards, per);
      else if (turn && !isMe(seat)) play = `<span class="ll-thinking">thinking</span>`;
    }
    const back = place === "at-me" ? "" : `<span class="ll-n${count <= 2 && !res ? " low" : ""}" title="Cards left">${backHtml()}<b>${count}</b></span>`;
    const chip = role ? `<span class="ll-role ${role}">${esc(w[role])}</span>` : "";
    const score = `<span class="ll-sc" title="Points">${sc > 0 ? "+" : ""}${sc}</span>`;
    // the others: name and side, then cards left and points; yours on one line
    const who = place === "at-me" ? `<div class="ll-who"><b>You</b>${chip}${score}</div>`
      : `<div class="ll-who"><b>${esc(nameOf(seat))}</b>${chip}</div><div class="ll-meta">${back}${score}</div>`;
    return `<div class="ll-seat ${place}${turn ? " turn" : ""}${lead ? " lead" : ""}">${who}<div class="ll-play">${play}</div></div>`;
  };
  const kitty = s.landlord == null && !res ? `<span class="cd-line">${s.kitty.map(() => backHtml()).join("")}</span>` : `<span class="cd-line">${cards(s.kitty)}</span>`;
  let mid = "";
  if (res) {
    const sp = res.spring ? " · Spring! 春天" : res.anti ? " · Anti-spring! 反春" : "";
    mid = `<p class="ll-beat"><b>${res.won ? "The landlord wins" : "The peasants win"}</b> ×${res.unit}${sp}</p>${s.step === "shown" ? `<span class="ll-next"><i data-until="${s.until}" data-ms="${SHOW_MS}"></i></span>` : ""}`;
  } else if (s.step === "thrown") mid = `<p class="ll-beat">Nobody bid: the cards are dealt again</p><span class="ll-next"><i data-until="${s.until}" data-ms="${THROWN_MS}"></i></span>`;
  else if (s.step === "bid") {
    const lead = s.opts.bidding === "points" ? (s.high ? `High bid: <b>${esc(nameOf(s.holder))}</b>, ${s.high}` : `<b>${esc(nameOf(s.first))}</b> had the face-up card`) : (s.holder != null ? `<b>${esc(nameOf(s.holder))}</b> would be landlord` : `<b>${esc(nameOf(s.first))}</b> had the face-up card`);
    mid = `<p class="ll-beat">${lead}</p>`;
  } else if (s.trick.last) mid = `<p class="ll-beat">To beat: <b>${esc(isMe(s.trick.by) ? "your" : `${nameOf(s.trick.by)}'s`)}</b> ${esc(typeName(s.trick.last))}</p>`;
  else mid = `<p class="ll-beat">${isMe(s.turn) ? "Your lead" : `<b>${esc(nameOf(s.turn))}</b> leads`}</p>`;
  $("table").innerHTML = [0, 1, 2].map(seatHtml).join("") +
    `<div class="ll-kitty" title="The kitty (底牌)"><span class="ll-kitty-name">${esc(w.kitty)}</span>${kitty}</div>` +
    `<div class="ll-centre"><p class="ll-said">${esc(v.said || "")}</p>${mid}</div>`;
  runBar();
}

let barRaf = 0;
function runBar() {
  cancelAnimationFrame(barRaf);
  const bar = document.querySelector(".ll-next i");
  if (!bar) return;
  const until = Number(bar.dataset.until), ms = Number(bar.dataset.ms), now = () => page.runner.table.now();
  const tick = () => { if (!bar.isConnected) return; const left = Math.max(0, until - now()); bar.style.transform = `scaleX(${left / ms})`; if (left > 0) barRaf = requestAnimationFrame(tick); };
  tick();
}

/** 记牌器: how many of each rank you haven't seen yet (not in your hand, not played), the jokers and twos first. */
function drawCounter(v) {
  const box = $("counter");
  box.hidden = !opts.counter || v.seat == null;
  if (box.hidden) return;
  const s = v.state, c = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1];
  for (const id of s.hands[v.seat]) c[rankOf(id)]--;
  for (const id of s.played) c[rankOf(id)]--;
  const label = r => (r === 14 ? "大" : r === 13 ? "小" : RANKS[r]);
  box.innerHTML = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(r => `<span class="${c[r] ? "" : "none"}${c[r] === 4 ? " all" : ""}" title="${r > 12 ? (r === 14 ? "Big joker" : "Small joker") : RANKS[r]}: ${c[r]} unseen"><i>${label(r)}</i><b>${c[r]}</b></span>`).join("");
}

/** Your cards in a row, picked ones raised: biggest first, as the apps hold them (or smallest first). */
function sortedHand(hand) {
  const k = id => rankOf(id) * 4 + Math.max(0, suitOf(id));
  return [...hand].sort(opts.order === "small" ? (a, b) => k(a) - k(b) : (a, b) => k(b) - k(a));
}
function drawHand(v) {
  const box = $("hand");
  if (v.seat == null) { box.innerHTML = `<p class="ll-watch">Watching: you sit down at the next game.</p>`; return; }
  const hand = sortedHand(v.state.hands[v.seat] || []);
  box.innerHTML = hand.map(id => cardHtml(face(id), { cls: sel.has(id) ? "sel" : "", data: { id }, label: cardName(id) })).join("");
  fitRow(box, hand.length, { max: 1.15 });
}
$("hand").addEventListener("click", e => {
  const c = e.target.closest(".cd[data-id]");
  if (!c || !V?.G || V.seat == null) return;
  const id = Number(c.dataset.id);
  if (sel.has(id)) sel.delete(id); else sel.add(id);
  draw();
});

function statusLine(v) {
  const s = v.state;
  if (s.step === "over") return esc(s.winners.includes(v.seat) ? "You win the game" : `${s.winners.map(i => (isMe(i) ? "You" : nameOf(i))).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`);
  if (s.step === "shown") { const mine = v.seat != null && (v.seat === s.landlord) === s.result.won; return esc(v.seat == null ? "" : mine ? `Your side wins: ${s.result.deltas[v.seat] > 0 ? "+" : ""}${s.result.deltas[v.seat]}` : `Your side loses: ${s.result.deltas[v.seat]}`); }
  if (s.step === "thrown") return "Dealing again";
  if (v.seat == null) return esc(`${nameOf(s.turn)} to ${s.step === "bid" ? "bid" : "play"}`);
  if (!isMe(s.turn)) { const w = v.seats[s.turn]; return esc(w?.bot && !w.away ? `${w.name} is ${s.step === "bid" ? "bidding" : "thinking"}…` : `${w?.name || "Someone"} to ${s.step === "bid" ? "bid" : "play"}`); }
  if (s.step === "bid") {
    if (s.opts.bidding === "points") return s.high ? `Bid more than <b>${s.high}</b> to be landlord, or pass` : "Your bid: <b>1, 2 or 3</b> to be landlord, or pass";
    if (s.phase === "call") return "Call to be landlord, or pass";
    if (s.phase === "final") return `You called: rob <b>${esc(nameOf(s.holder))}</b> back (×2), or let them have it`;
    return `Rob the landlord from <b>${esc(nameOf(s.holder))}</b> (×2), or not`;
  }
  const team = s.landlord === v.seat ? "You're the landlord" : `With ${esc(nameOf([0, 1, 2].find(i => i !== v.seat && i !== s.landlord)))}`;
  if (!s.trick.last) return `${team} · <b>your lead</b>`;
  const can = playsFor(s, v.seat).length;
  return `${team} · ${can ? `beat the ${esc(typeName(s.trick.last))}, or pass` : "<b>nothing beats it</b>: pass"}`;
}

function drawBar() {
  const bar = $("bar"), v = V;
  if (!v?.G || (v.state.step === "over" && page.host)) { bar.innerHTML = `<button type="button" class="btn primary ll-go" data-act="new">New game</button>`; return; }
  const s = v.state, mine = v.seat != null && s.turn === v.seat;
  if (s.step === "bid" || s.step === "thrown") {
    const on = mine && s.step === "bid", w = words(s);
    if (s.opts.bidding === "points") {
      bar.innerHTML = `<button type="button" class="btn ll-go" data-act="bid" data-n="0" ${on ? "" : "disabled"}>${esc(w.nobid)}</button>` +
        [1, 2, 3].map(n => `<button type="button" class="btn ${n === 3 ? "primary " : ""}ll-go" data-act="bid" data-n="${n}" ${on && n > s.high ? "" : "disabled"}>${esc(w.pts(n))}</button>`).join("");
    } else {
      const call = s.phase === "call";
      bar.innerHTML = `<button type="button" class="btn ll-go" data-act="bid" data-yes="0" ${on ? "" : "disabled"}>${esc(call ? w.nobid : w.norob)}</button>
        <button type="button" class="btn primary ll-go" data-act="bid" data-yes="1" ${on ? "" : "disabled"}>${esc(call ? w.call : w.rob)}</button>`;
    }
    return;
  }
  const playing = mine && s.step === "play", picked = [...sel];
  const c = playing && picked.length ? check(s, v.seat, picked) : null;
  bar.innerHTML = `<button type="button" class="btn ll-go" data-act="pass" ${playing && s.trick.last ? "" : "disabled"}>${esc(s.trick.last && playing && !playsFor(s, v.seat).length ? words(s).cant : "Pass")}</button>
    <button type="button" class="btn ll-go" data-act="hint" ${playing ? "" : "disabled"}>Hint</button>
    <button type="button" class="btn primary ll-go ll-play-btn" data-act="play" ${c?.play ? "" : "disabled"}>${esc(c?.play ? `Play ${typeName(c.play)}` : "Play")}</button>
    ${picked.length ? `<button type="button" class="icon-btn ll-clear" data-act="clear" aria-label="Put them back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ""}`;
}
/** Hint: the computer's play first, then each other play that's possible, one a tap. */
function hint() {
  const v = V, s = v.state, key = `${v.G.seq}:${v.G.n}`;
  if (hints.key !== key) {
    const all = playsFor(s, v.seat).sort((a, b) => ((a.type === "bomb" || a.type === "rocket") - (b.type === "bomb" || b.type === "rocket")) || a.rank - b.rank || a.n - b.n);
    const m = botMove(s, v.seat, { level: "hard" }), list = [];
    if (m.t === "play") list.push(m.cards);
    for (const p of all) if (!list.some(c => c.slice().sort().join() === p.cards.slice().sort().join())) list.push(p.cards);
    hints = { key, list, i: 0 };
  }
  if (!hints.list.length) { toast(s.trick.last ? "Nothing of yours beats it: pass" : "Play anything"); return; }
  sel = new Set(hints.list[hints.i % hints.list.length]);
  hints.i++;
  draw();
}
$("bar").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "clear") { sel = new Set(); draw(); return; }
  if (act === "hint") { hint(); return; }
  const move = act === "bid" ? (b.dataset.n != null ? { t: "bid", n: Number(b.dataset.n) } : { t: "bid", yes: b.dataset.yes === "1" })
    : act === "pass" ? { t: "pass" } : { t: "play", cards: [...sel] };
  const why = await page.move(move);
  if (why) toast(why);
  else if (act !== "bid") { sel = new Set(); draw(); }
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("landlord", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 900);
}
function showEnd(v) {
  const s = v.state, order = [0, 1, 2].sort((a, b) => s.scores[b] - s.scores[a]);
  const nm = i => (isMe(i) ? "You" : nameOf(i));
  $("endHead").textContent = s.winners.includes(v.seat) ? (s.winners.length > 1 ? "You share the win" : "You win") : `${s.winners.map(nm).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`;
  const lords = i => { const as = s.log.filter(e => e.landlord === i); return as.length ? `landlord ${as.length}×, won ${as.filter(e => e.won).length}` : "never landlord"; };
  $("endBody").innerHTML = `<ol class="ll-standings">${order.map(i => `<li class="${s.winners.includes(i) ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(nm(i))}</span><span class="ll-lords">${lords(i)}</span><b>${s.scores[i] > 0 ? "+" : ""}${s.scores[i]}</b></li>`).join("")}</ol>
    <p class="ll-end-note">${s.log.length} deals. The landlord wins or pays the stake to each peasant: the bid${s.opts.bidding === "rob" ? " (1, doubled by each rob)" : ""}, doubled by each bomb and rocket and by a spring.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  page.deal(gameOptions(), 3);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const row = (k, en, ex) => `<tr><td>${en}${ex ? `<br><small>${ex}</small>` : ""}</td><td><b>${PLAY_TALK[k].zh}</b><br><small>${PLAY_TALK[k].py}</small></td><td><b>${PLAY_TALK[k].yue}</b><br><small>${PLAY_TALK[k].jp}</small></td></tr>`;
  $("rulesBody").innerHTML = `
    <p>Landlord (斗地主, dòu dìzhǔ, "fight the landlord") is China's most played card game: one player, the landlord (地主), against the other two, the peasants (农民), who play as a side. Be first to play out all your cards; a peasant going out wins for both.</p>
    <p><b>The deal.</b> All 54 cards, both jokers in: seventeen each and three face down, the kitty (底牌, dǐpái). A card is turned face up as they're dealt: whoever gets it bids first.</p>
    <p><b>Bidding</b>, as the menu has it. <i>For points</i> (叫分): once round, each bids 1, 2 or 3 points, more than the last bid, or passes (不叫); a 3 ends it at once, and the highest bidder is landlord at that stake. <i>Call and rob</i> (叫地主, 抢地主, as the apps play): the first to call is landlord unless robbed; each player after the caller may rob once, each rob doubling the stake; if anyone robbed, the caller has the last word. Nobody bids: the cards are dealt again.</p>
    <p><b>The landlord</b> takes the kitty, shown to everyone first, and leads. Play goes round to the right.</p>
    <p><b>Order.</b> Big joker (大王), small joker (小王), 2, A, K, Q, J, 10 … 3. Suits don't matter.</p>
    <h3>The plays</h3>
    <table class="ll-talk"><thead><tr><th></th><th>普通话</th><th>廣東話</th></tr></thead><tbody>
    ${row("single", "A single")}${row("pair", "A pair")}${row("triple", "Three of a kind")}
    ${row("trio1", "Three with one", "any other card: 777+4")}${row("trio2", "Three with a pair", "777+44")}
    ${row("straight", "Straight", "five or more in a row, 3 to A: 34567")}${row("pairs", "Pairs in a row", "three or more: 334455")}
    ${row("plane", "Airplane", "threes in a row: 777888")}${row("plane1", "Airplane with wings", "a card for each three: 777888+39")}${row("plane2", "Airplane with pairs", "a pair for each three: 777888+3399")}
    ${row("four2", "Four with two", "two other cards: 7777+39")}${row("four22", "Four with two pairs", "7777+3399")}
    ${row("bomb", "Bomb", "four alike: 7777")}${row("rocket", "Rocket", "both jokers")}
    </tbody></table>
    <p class="ll-rules-note">Twos and jokers can't be in a chain. A kicker (the card or pair a three, airplane or four takes) can't be of the threes' or the four's own rank, and the two jokers can't both be kickers.</p>
    <p><b>Beating it.</b> Each player in turn beats the last play with the same kind of play and as many cards, higher, or passes (passing doesn't stop you playing next time round). A chain is ranked by its lowest card, a three or a four by its own rank (the kickers don't count). A bomb beats anything but a higher bomb or the rocket; the rocket beats everything. Two passes in a row end the trick, and whoever played last leads anything.</p>
    <p><b>Scoring.</b> The stake is the bid${opts.bidding === "rob" ? " (calling and robbing: 1, doubled by each rob)" : ""}, doubled for each bomb and rocket played, and doubled again for a spring (春天, chūntiān: the landlord out before either peasant has played a card) or an anti-spring (反春, fǎnchūn: the peasants out with the landlord having played only their first lead). The landlord wins it from each peasant, or pays it to each: twice the stake either way. A game is ${opts.deals} deals; the most points wins.</p>
    <h3>What's said at the table</h3>
    <table class="ll-talk"><thead><tr><th></th><th>普通话</th><th>廣東話</th></tr></thead><tbody>
    ${row("pass", "Pass")}${row("cant", "Can't beat it")}
    <tr><td>Bids</td><td><b>1分 2分 3分 不叫</b><br><small>yì fēn, liǎng fēn, sān fēn, bú jiào</small></td><td><b>一分 兩分 三分 唔叫</b><br><small>jat1 fan1, loeng5 fan1, saam1 fan1, m4 giu3</small></td></tr>
    <tr><td>Call, rob</td><td><b>叫地主 抢地主 不抢</b><br><small>jiào dìzhǔ, qiǎng dìzhǔ, bù qiǎng</small></td><td><b>叫地主 搶地主 唔搶</b><br><small>giu3 dei6 zyu2, coeng2 dei6 zyu2, m4 coeng2</small></td></tr>
    <tr><td>Two cards left!</td><td><b>剩两张！</b><br><small>shèng liǎng zhāng</small></td><td><b>剩兩張！</b><br><small>zing6 loeng5 zoeng1</small></td></tr>
    <tr><td>The jokers</td><td><b>大王 小王</b><br><small>dàwáng, xiǎowáng</small></td><td><b>大鬼 細鬼</b><br><small>daai6 gwai2, sai3 gwai2</small></td></tr>
    </tbody></table>
    <p class="ll-rules-note">要不起 ("can't afford it") is the pass of a player who has nothing that beats the play; 不要 the pass of one who chooses not to. Both tell the table something, and the computer players count it. The counter under the table (记牌器, jìpáiqì, as the apps have it; Menu turns it off) shows how many of each rank you haven't seen yet.</p>`;
  $("rulesDlg").showModal();
}

// ---------- the course ----------
// Learn (the header): the game taught from nothing (landlord-course.js) on the course's sheet (course.js), the cards drawn
// as the table draws them; its last lesson starts a game against Easy. The Rules sheet, every rule on one page, opens
// from the course's map and the menu.
const course = createCourse({
  id: "landlord", course: COURSE, stage: cardStage({ face, label: cardName, judge }), cls: "ll", inFrame: IN_FRAME, onRules: showRules,
  onPlay: () => {
    if (page.atTable) { toast("Your table plays on: try a game against Easy when you're back to solo"); return; }
    opts.level = "easy";
    saveOpts();
    newGame();
  },
});

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("landlord", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Landlord, from the rules", () => course.open()), action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  const keep = () => saveOpts();
  set.append(choice("A game is", DEALS.map(n => [n, `${n} deals`]), opts.deals, v => { opts.deals = Number(v); keep(); }));
  set.append(choice("Bidding", [["points", "For points 叫分"], ["rob", "Call and rob 抢地主"]], opts.bidding, v => { opts.bidding = v; keep(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; keep(); }));
  set.append(line("The length and the bidding apply from the next game."));
  set.append(choice("Your cards", [["big", "Biggest first"], ["small", "Smallest first"]], opts.order, v => { opts.order = v; keep(); draw(); }));
  set.append(toggle("Card counter 记牌器", opts.counter, on => { opts.counter = on; keep(); draw(); }));
  set.append(choice("Table talk", TALK, opts.talk, v => { opts.talk = v; keep(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; keep(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("landlord:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "landlord");
document.querySelector(".ll-mark").innerHTML = APPS.find(a => a.id === "landlord")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
window.__landlord = { page, get view() { return V; }, opts, get sel() { return sel; }, course };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
