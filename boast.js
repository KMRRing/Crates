// Boast: Liar's dice with Chinese rules (吹牛, 大話骰) against computer players, or at a table with friends each on
// their own phone. The rules and the words are boast-rules.js's, the computer players boast-bot.js's, the running
// seats.js's (solo, or a table through seats-ui.js). This page draws the table: the others' cups round the top, the bid
// in the middle as it's called, your five dice and the bid you're making at the bottom.
import { rules, bidWords, CALLS, leastAfter, plain, opening, most, LIMITS, cupCount, canFollow, SHOW_MS } from "./boast-rules.js";
import { LEVEL_NAMES, oddsFor } from "./boast-bot.js";
import { seatPage, fillNames } from "./seats-ui.js";
import { seeded, mix } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { diceStage } from "./course-dice.js";
import { COURSE, judge, words as bidEnglish } from "./boast-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "boast:opts", RECORD = "boast:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Ling", "Lin", "Wei", "Fang", "Ming", "Kit"];                // the computer players, by seat
const TALK = [["zh", "普通话"], ["yue", "廣東話"], ["en", "English"]];

// the menu's choices: the next game's (players, its end, the house rules, the table talk) and the page's own
let opts = { seats: 4, level: "hard", limit: 6, pi: true, bao: false, san: false, talk: "zh", odds: false, voice: true, ...read(OPTS, {}) };
if (!LIMITS.includes(opts.limit)) opts.limit = 6;
const saveOpts = () => write(OPTS, opts);
const gameOptions = () => ({ limit: opts.limit, pi: opts.pi, bao: opts.bao, san: opts.san, talk: opts.talk });

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the dice and the cups, drawn ----------
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
/** A die, as Chinese dice are: the one's pip large and red, the four's red too. */
function die(face, cls = "") {
  const pips = PIPS[face].map(([c, r]) => `<circle cx="${6 + 6 * c}" cy="${6 + 6 * r}" r="${face === 1 ? 3.6 : 2.15}"/>`).join("");
  return `<svg class="bo-die${face === 1 || face === 4 ? " red" : ""}${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" role="img" aria-label="${face}"><rect x="1" y="1" width="22" height="22" rx="4.6"/>${pips}</svg>`;
}
const CUP = `<svg class="bo-cup" viewBox="0 0 24 24" aria-hidden="true"><path class="body" d="M6.5 6h11l3 11.5q-8.5 2.8-17 0Z"/><path class="band" d="M4.1 14.6q7.9 2.3 15.8 0"/><path class="rim" d="M6.5 6h11"/></svg>`;

/** A bid's words in the table's language, and in the others beneath. */
function words(b, talk = opts.talk) {
  const w = bidWords(b);
  if (talk === "yue") return { main: w.yue, sub: `${w.jp} · ${w.en}` };
  if (talk === "en") return { main: w.en, sub: `${w.zh} ${w.py}` };
  return { main: w.zh, sub: `${w.py} · ${w.en}` };
}
const callWord = (k, talk = opts.talk) => (talk === "en" ? CALLS[k].en : talk === "yue" ? CALLS[k].yue : CALLS[k].zh);
const callSub = (k, talk = opts.talk) => (talk === "en" ? `${CALLS[k].zh} ${CALLS[k].py}` : talk === "yue" ? CALLS[k].jp : CALLS[k].py);
/** A bid in short: 5 × ⚄, plain marked. */
const short = b => `<span class="bo-short">${b.n}<span class="x">×</span>${die(b.f, "mini")}${plain(b) && b.f !== 1 ? `<span class="bo-zhai">${callWord("zhai")}</span>` : ""}</span>`;
/** Cups drunk, as pips against the game's limit. */
function cupsHtml(n, limit) {
  if (limit > 6) return `<span class="bo-cups" aria-label="${n} of ${limit} cups"><b>${n}</b>/${limit}</span>`;
  return `<span class="bo-cups" aria-label="${n} of ${limit} cups">${Array.from({ length: limit }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
}

// ---------- the table ----------
let V = null;                                     // the view on screen
let ui = { key: "", n: 0, f: 0, z: false };       // the bid you're setting, for the position it was set in
let shaken = "";                                  // the round whose dice last shook
let page = null;                                  // set once the runner is up (it draws its first view while starting)
const randomRounds = seatRounds("boast", ["shown"]);   // random mode's round: a round of bidding, its cups lifted
page = seatPage({
  rules, id: "boast", app: 1, pace: 1150, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); randomRounds(v); }, onOver, toast, newGame,
});
const lastBid = s => (s?.bids?.length ? s.bids[s.bids.length - 1] : null);
const nameOf = seat => (V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`);
const isMe = seat => V?.seat != null && seat === V.seat;

function draw() {
  if (!page) return;
  const v = V;
  document.body.classList.toggle("bo-watch", !!v?.G && v.seat == null);
  drawOthers(v);
  drawCentre(v);
  drawLog(v);
  drawMine(v);
  drawControls(v);
}

/** The others round the table, in turn from you. */
function drawOthers(v) {
  const box = $("others");
  if (!v?.G) { box.replaceChildren(); return; }
  const s = v.state, me = v.seat ?? 0, shown = s.step === "shown" || s.step === "over";
  const order = Array.from({ length: s.seats }, (_, i) => (me + 1 + i) % s.seats).filter(i => v.seat == null || i !== v.seat);
  box.dataset.n = order.length;
  box.innerHTML = order.map(i => {
    const seat = v.seats[i], mine = s.bids.filter(b => b.s === i), bid = mine[mine.length - 1];
    const res = shown ? s.result : null;
    const turn = (s.step === "bid" && s.turn === i) || (s.step === "pi" && lastBid(s)?.s === i);
    const calls = res && res.challenger === i ? `<span class="bo-call">${callWord(res.kind === "fanpi" ? "pi" : res.kind)}</span>` : "";
    const piNow = s.step === "pi" && s.pi?.by === i ? `<span class="bo-call">${callWord("pi")}</span>` : "";
    const dice = res ? `<span class="bo-dice small">${(res.dice[i] || []).map(d => die(d, cupCount([d], res.bid, s.opts) ? "lit" : "dim")).join("")}</span>` : "";
    return `<li class="bo-p${turn ? " turn" : ""}${res && res.loser === i ? " loser" : ""}${seat.bot ? " bot" : ""}${seat.away ? " away" : ""}">
      <span class="bo-p-head">${CUP}<b class="bo-p-name">${esc(seat.name)}</b></span>
      ${cupsHtml(s.cups[i], s.opts.limit)}
      <span class="bo-p-bid">${calls || piNow || (bid ? short(bid) : turn ? `<span class="bo-thinking">thinking</span>` : "")}</span>${dice}</li>`;
  }).join("");
}

/** The middle of the table: the bid as called, or the cups lifted and who drinks. */
function drawCentre(v) {
  const box = $("centre");
  if (!v?.G) {
    box.innerHTML = `<p class="bo-lead">Five dice each under a cup. Bid how many of a face lie under all the cups together; call the last bid a lie with 开.</p>`;
    return;
  }
  const s = v.state, b = lastBid(s), said = v.said ? `<p class="bo-said">${esc(v.said)}</p>` : "";
  const trail = s.bids.length > 1 ? `<p class="bo-trail">${s.bids.slice(-6, -1).map(x => `<span>${esc(nameOf(x.s))} ${short(x)}</span>`).join("")}</p>` : "";
  if (s.step === "shown" || s.step === "over") {
    const r = s.result, w = words({ ...r.bid, n: r.count });
    const verdict = r.held ? `The bid held: ${esc(nameOf(r.loser))} ${isMe(r.loser) ? "drink" : "drinks"} ${r.stake === 1 ? "a cup" : `${r.stake} cups`}`
      : `A lie: ${esc(nameOf(r.loser))} ${isMe(r.loser) ? "drink" : "drinks"} ${r.stake === 1 ? "a cup" : `${r.stake} cups`}`;
    box.innerHTML = `${said}<div class="bo-bid shown"><span class="bo-bid-call">${esc(callWord(r.kind === "fanpi" ? "fanpi" : r.kind === "pi" ? "pi" : "kai"))}</span>
      <span class="bo-bid-big">${r.count}<span class="x">×</span>${die(r.bid.f, "big")}</span>
      <span class="bo-bid-words">${esc(w.main)} <small>against ${r.bid.n}${plain(r.bid) && r.bid.f !== 1 ? `, ${esc(callWord("zhai"))}` : ""}</small></span></div>
      <p class="bo-verdict ${r.held ? "held" : "broke"}">${verdict}</p>
      ${s.step === "shown" ? `<span class="bo-next"><i data-until="${s.until}"></i></span>` : ""}`;
    runBar();
    return;
  }
  if (!b) {
    const starter = s.turn;
    box.innerHTML = `${said}<div class="bo-bid empty"><span class="bo-bid-round">Round ${s.round}</span>
      <span class="bo-bid-words">${isMe(starter) ? "You open" : `${esc(nameOf(starter))} opens`}</span>
      <small>at least ${opening(s.seats)} dice · ones are wild</small></div>`;
    return;
  }
  const w = words(b);
  const odds = opts.odds && v.seat != null && b.s !== v.seat ? oddsLine(v) : "";
  const pi = s.step === "pi" ? `<p class="bo-verdict pi">${esc(nameOf(s.pi.by))} ${isMe(s.pi.by) ? "chop" : "chops"} it: ${esc(callWord("pi"))} ${esc(callSub("pi"))}, two cups at stake${isMe(b.s) ? ". Chop back for four?" : ""}</p>` : "";
  box.innerHTML = `${said}<div class="bo-bid"><span class="bo-bid-by">${isMe(b.s) ? "Your bid" : `${esc(nameOf(b.s))}’s bid`}${b.fly ? ` · ${esc(callWord("fei"))}` : ""}</span>
    <span class="bo-bid-big">${b.n}<span class="x">×</span>${die(b.f, "big")}${plain(b) && b.f !== 1 ? `<span class="bo-zhai big">${esc(callWord("zhai"))}</span>` : ""}</span>
    <span class="bo-bid-words">${esc(w.main)}</span><small class="bo-bid-sub">${esc(w.sub)}</small></div>${pi}${odds}${trail}`;
}

/** The round's bids in full, newest last (beside the table when it's held sideways). */
function drawLog(v) {
  const box = $("log");
  if (!v?.G) { box.replaceChildren(); return; }
  const s = v.state;
  box.innerHTML = `<li class="bo-log-head">Round ${s.round}</li>` + s.bids.map(b => {
    const w = words(b);
    return `<li><span class="who">${esc(nameOf(b.s))}</span>${short(b)}<span class="w">${esc(w.main)}${b.fly ? ` · ${esc(callWord("fei"))}` : ""}</span></li>`;
  }).join("") + (s.step === "shown" || s.step === "over" ? `<li class="bo-log-end">${esc(nameOf(s.result.challenger))}: ${esc(callWord(s.result.kind === "fanpi" ? "fanpi" : s.result.kind === "pi" ? "pi" : "kai"))}</li>` : "");
  box.scrollTop = box.scrollHeight;
}

/** The chance the last bid holds, reckoned on your dice and the bids (the computer's Hard reckoning). */
let oddsCache = { key: "", p: null };
function oddsLine(v) {
  const s = v.state, key = `${v.G.seq}:${s.round}:${s.bids.length}:${v.seat}`;
  if (oddsCache.key !== key) oddsCache = { key, p: oddsFor(s, v.seat, seeded(mix(v.G.seed, s.bids.length * 31 + s.round))) };
  const p = oddsCache.p;
  return p == null ? "" : `<p class="bo-odds">Holds about ${Math.round(100 * p)}% on your dice and the bids</p>`;
}

/** The bar under the lifted cups, running down to the next round. */
let barRaf = 0;
function runBar() {
  cancelAnimationFrame(barRaf);
  const bar = document.querySelector(".bo-next i");
  if (!bar) return;
  const until = Number(bar.dataset.until), now = () => page.runner.table.now(), total = SHOW_MS;
  const tick = () => {
    if (!bar.isConnected) return;
    const left = Math.max(0, until - now());
    bar.style.transform = `scaleX(${left / total})`;
    if (left > 0) barRaf = requestAnimationFrame(tick);
  };
  tick();
}

/** Your cup: your five dice, large; lit when they count for the bid lifted. */
function drawMine(v) {
  const box = $("mine");
  if (!v?.G || v.seat == null) { box.innerHTML = v?.G ? `<p class="bo-watching">Watching: you sit down at the next game.</p>` : ""; return; }
  const s = v.state, hand = s.dice[v.seat] || [], res = s.step === "shown" || s.step === "over" ? s.result : null;
  const turn = (s.step === "bid" && s.turn === v.seat) || (s.step === "pi" && lastBid(s)?.s === v.seat);
  const key = `${v.G.seq}:${s.round}`;
  const shake = key !== shaken && s.step === "bid" && !s.bids.length;
  shaken = key;
  box.className = `bo-mine${turn ? " turn" : ""}${res && res.loser === v.seat ? " loser" : ""}`;
  box.innerHTML = `<div class="bo-mine-head"><b>${esc(nameOf(v.seat))}</b>${cupsHtml(s.cups[v.seat], s.opts.limit)}</div>
    <div class="bo-dice mine${shake ? " shake" : ""}" aria-label="Your dice">${hand.map(d => die(d, res ? (cupCount([d], res.bid, s.opts) ? "lit" : "dim") : "")).join("")}</div>`;
}

// ---------- your move ----------
/** The face your cup holds most of (with the ones, for a wild bid). */
function bestFace(hand) {
  let best = 2, most = -1;
  for (const f of [2, 3, 4, 5, 6]) { const c = hand.filter(d => d === f || d === 1).length; if (c > most || (c === most && f > best)) { most = c; best = f; } }
  return best;
}
/** Your bid as you set it, kept to what may follow the last; reset when the table moves. */
function settle(v) {
  const s = v.state, prev = lastBid(s), key = `${v.G.seq}:${s.round}:${s.bids.length}`;
  if (ui.key !== key) {
    const f = bestFace(s.dice[v.seat] || []);
    ui = { key, f, z: false, n: leastAfter(prev, f, false, s.seats, s.opts) ?? opening(s.seats) };
    if (leastAfter(prev, f, false, s.seats, s.opts) == null) { ui.z = true; ui.n = leastAfter(prev, f, true, s.seats, s.opts) ?? ui.n; }
  }
  if (ui.f === 1) ui.z = true;
  const least = leastAfter(prev, ui.f, ui.z, s.seats, s.opts);
  if (least != null && ui.n < least) ui.n = least;
  ui.n = Math.min(ui.n, most(s.seats, s.opts));
  return least;
}

function drawControls(v) {
  const box = $("controls");
  if (!v?.G) { box.innerHTML = `<button class="btn primary bo-go" type="button" data-act="new">New game</button>`; return; }
  const s = v.state;
  if (v.seat == null) { box.innerHTML = `<p class="bo-status">${esc(statusLine(v))}</p>`; return; }
  if (s.step === "over") {
    box.innerHTML = `<p class="bo-status">${esc(statusLine(v))}</p><button class="btn primary bo-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New game" : "The result"}</button>`;
    return;
  }
  const prev = lastBid(s);
  if (s.step === "pi" && prev?.s === v.seat) {
    box.innerHTML = `<p class="bo-status">${esc(nameOf(s.pi.by))} chopped your bid. Trust it? Chop back and four cups ride on it.</p>
      <div class="bo-row two"><button class="btn bo-call-btn" type="button" data-act="take"><b>${esc(callWord("take"))}</b><small>let it open · 2 cups</small></button>
      <button class="btn primary bo-call-btn" type="button" data-act="fanpi"><b>${esc(callWord("fanpi"))}</b><small>${esc(callSub("fanpi"))} · 4 cups</small></button></div>`;
    return;
  }
  const mine = s.step === "bid" && s.turn === v.seat;
  const least = mine ? settle(v) : null;
  const can = mine && least != null;
  const faces = [2, 3, 4, 5, 6, 1].map(f => {
    const ok = mine && leastAfter(prev, f, ui.z || f === 1, s.seats, s.opts) != null;
    return `<button type="button" class="bo-face" data-face="${f}" aria-pressed="${mine && ui.f === f}" ${ok ? "" : "disabled"} aria-label="${f}s">${die(f)}</button>`;
  }).join("");
  const w = can ? words({ n: ui.n, f: ui.f, z: ui.z }) : null;
  const zhaiOk = mine && ui.f !== 1 && leastAfter(prev, ui.f, !ui.z, s.seats, s.opts) != null;
  box.innerHTML = `<p class="bo-status">${esc(mine ? (prev ? "Raise, or open the last bid" : `Open the bidding: at least ${opening(s.seats)}`) : statusLine(v))}</p>
    <div class="bo-row bo-setter">
      <button type="button" class="btn bo-step" data-act="less" aria-label="One die fewer" ${can && ui.n > least ? "" : "disabled"}>−</button>
      <span class="bo-n" aria-live="polite">${mine ? ui.n : "–"}</span>
      <button type="button" class="btn bo-step" data-act="more" aria-label="One die more" ${can && ui.n < most(s.seats, s.opts) ? "" : "disabled"}>+</button>
      <button type="button" class="btn bo-zhai-btn" data-act="zhai" aria-pressed="${mine && (ui.z || ui.f === 1)}" ${zhaiOk ? "" : "disabled"}>${esc(callWord("zhai"))}<small>${ui.f === 1 ? "ones" : "plain"}</small></button>
    </div>
    <div class="bo-faces" role="group" aria-label="The face">${faces}</div>
    <div class="bo-row act">
      <button type="button" class="btn primary bo-bid-btn" data-act="bid" ${can ? "" : "disabled"}><b>${can ? esc(w.main) : "Bid"}</b><small>${can ? esc(w.sub.split(" · ")[0]) : "your turn next"}</small></button>
      <button type="button" class="btn bo-call-btn" data-act="kai" ${mine && prev ? "" : "disabled"}><b>${esc(callWord("kai"))}</b><small>${esc(callSub("kai"))}</small></button>
      ${s.opts.pi ? `<button type="button" class="btn bo-call-btn" data-act="pi" ${mine && prev ? "" : "disabled"}><b>${esc(callWord("pi"))}</b><small>×2</small></button>` : ""}
    </div>`;
}

function statusLine(v) {
  const s = v.state;
  if (s.step === "over") {
    const win = s.winners.map(nameOf);
    return v.seat != null && s.winners.includes(v.seat) ? (win.length > 1 ? `You drank least, with ${win.filter(n => n !== nameOf(v.seat)).join(" and ")}` : "You drank least: you win") : `${win.join(" and ")} drank least`;
  }
  if (s.step === "shown") return "The cups are up";
  if (s.step === "pi") return `${nameOf(lastBid(s).s)} decides: chop back, or let it open`;
  const who = v.seats[s.turn];
  if (isMe(s.turn)) return "Your turn";
  return who?.bot && !who.away ? `${who.name} is thinking…` : `${who?.name || "Someone"}’s turn`;
}

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const act = b.dataset.act, face = b.dataset.face;
  if (face) { ui.f = Number(face); if (ui.f === 1) ui.z = true; draw(); return; }
  if (act === "less") { ui.n--; draw(); return; }
  if (act === "more") { ui.n++; draw(); return; }
  if (act === "zhai") {
    ui.z = !ui.z;
    const least = leastAfter(lastBid(V.state), ui.f, ui.z, V.state.seats, V.state.opts);
    if (least != null) ui.n = Math.max(least, ui.z ? Math.min(ui.n, least) : ui.n);
    draw();
    return;
  }
  if (act === "new") { newGame(); return; }
  if (act === "result") { showEnd(V); return; }
  const move = act === "bid" ? { t: "bid", n: ui.n, f: ui.f, z: ui.z || ui.f === 1 } : { t: act };
  const why = await page.move(move);
  if (why) toast(why);
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("boast", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 900);
}
function showEnd(v) {
  const s = v.state, rows = Array.from({ length: s.seats }, (_, i) => i).sort((a, b) => s.cups[a] - s.cups[b]);
  const mine = v.seat != null && s.winners.includes(v.seat);
  $("endHead").textContent = mine ? (s.winners.length > 1 ? "You share the win" : "You drank least") : `${s.winners.map(nameOf).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`;
  const kinds = s.log.reduce((m, e) => ({ ...m, [e.kind]: (m[e.kind] || 0) + 1 }), {});
  $("endBody").innerHTML = `<ol class="bo-standings">${rows.map(i => `<li class="${s.winners.includes(i) ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(nameOf(i))}</span>${cupsHtml(s.cups[i], Math.max(s.opts.limit, s.cups[i]))}<b>${s.cups[i]}</b></li>`).join("")}</ol>
    <p class="bo-end-note">${s.log.length} rounds: ${kinds.kai || 0} opened, ${(kinds.pi || 0) + (kinds.fanpi || 0)} chopped${kinds.fanpi ? `, ${kinds.fanpi} chopped back` : ""}.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  page.deal(gameOptions(), Math.max(2, Math.min(6, opts.seats)));
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const w = (n, f, z = false) => bidWords({ n, f, z });
  const row = (b, what) => `<tr><td>${what}</td><td><b>${b.zh}</b><br><small>${b.py}</small></td><td><b>${b.yue}</b><br><small>${b.jp}</small></td></tr>`;
  const call = (k, what) => `<tr><td>${what}</td><td><b>${CALLS[k].zh}</b><br><small>${CALLS[k].py}</small></td><td><b>${CALLS[k].yue}</b><br><small>${CALLS[k].jp}</small></td></tr>`;
  $("rulesBody").innerHTML = `
    <p>Liar's dice as it's played round a table in Hong Kong, Macau and Guangdong (大話骰, daai6 waa6 sik1, "big-talk dice") and on the mainland (吹牛, chuīniú, "to brag"). Everyone has five dice under a cup and sees only their own.</p>
    <p><b>Bidding.</b> In turn, each says how many dice of one face lie under all the cups together: "four fives" means at least four 5s on the table. The opening bid is at least as many dice as there are players. Each bid must beat the last: more dice, or as many of a higher face (2 lowest, 6 highest).</p>
    <p><b>Ones are wild</b>: a 1 counts as whatever face is bid. A plain bid (斋, zhāi) counts no ones: "four fives, plain" needs four real 5s. A bid on ones is plain by nature, and the highest plain face. A plain bid may follow a wild one at the same count; going back to wild ones after a plain bid (飞, fēi, "fly") takes two dice more.</p>
    <p><b>Opening.</b> Instead of bidding, the next player may call the last bid a lie: 开 (kāi, "open"). Every cup is lifted and the face counted (with the ones, unless the bid was plain). As many or more: the bid held and the opener drinks. Fewer: the bidder drinks. 劈 (pī, "chop") opens at double: two cups ride on it, and the bidder may answer 反劈 (fǎn pī, "chop back") to make it four. Whoever drank starts the next round.</p>
    <p><b>The end.</b> When someone has drunk ${opts.limit} cups, the game ends; whoever drank least wins. Here a cup is a point; at a table, it's a drink.</p>
    <p><b>House rules</b> (Menu): 豹子 (bàozi, "leopard"): five dice alike under one cup count seven, five alike with ones among them six. 散 (sǎn, "scattered"): a cup of five different faces is rolled again before anyone bids.</p>
    <h3>What's said at the table</h3>
    <table class="bo-talk"><thead><tr><th></th><th>普通话</th><th>廣東話</th></tr></thead><tbody>
    ${row(w(3, 5), "Three fives")}${row(w(2, 6), "Two sixes")}${row(w(4, 3, true), "Four threes, plain")}${row(w(5, 1), "Five ones")}${row(w(12, 2), "Twelve twos")}
    ${call("kai", "Open!")}${call("pi", "Chop!")}${call("fanpi", "Chop back!")}${call("zhai", "Plain (no wild ones)")}${call("fei", "Fly: wild again")}
    <tr><td>Drink!</td><td><b>喝！</b><br><small>hē</small></td><td><b>飲！</b><br><small>jam2</small></td></tr>
    <tr><td>Shake the cups</td><td><b>摇骰子</b><br><small>yáo shǎizi</small></td><td><b>搖骰</b><br><small>jiu4 sik1</small></td></tr>
    </tbody></table>
    <p class="bo-rules-note">Mandarin counts "two" of something as 两 (liǎng), the face two as 二 (èr); Cantonese counts dice with 粒 (nap1, "grain"), Mandarin with 个 (gè). Menu, Table talk, sets the language the bids are called in.</p>`;
  $("rulesDlg").showModal();
}

// ---------- the course ----------
// Learn (the header): the game taught from nothing (boast-course.js) on the course's sheet (course.js), the dice drawn
// as the table draws them, counted by the rules (wild ones, plain bids); its last lesson starts a game against Easy.
// The Rules sheet, every rule on one page, opens from the course's map and the menu.
const course = createCourse({
  id: "boast", course: COURSE, cls: "bo", inFrame: IN_FRAME, onRules: showRules,
  stage: diceStage({ die, counts: (hand, bid) => cupCount(hand, bid), follows: (prev, bid, seats) => canFollow(prev, bid, seats), words: bidEnglish, judge }),
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
  const cp = progressOf("boast", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Boast, from the rules", () => course.open()), action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  const next = () => { saveOpts(); };
  set.append(choice("Players", [[2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]], opts.seats, v => { opts.seats = Number(v); next(); }));
  set.append(choice("A game ends at", LIMITS.map(n => [n, `${n} cups`]), opts.limit, v => { opts.limit = Number(v); next(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; next(); }));
  set.append(choice("Table talk", TALK, opts.talk, v => { opts.talk = v; next(); draw(); }));
  set.append(toggle("劈 and 反劈 (chop, chop back)", opts.pi, on => { opts.pi = on; next(); }));
  set.append(toggle("豹子: five alike count extra", opts.bao, on => { opts.bao = on; next(); }));
  set.append(toggle("散: five different faces rolled again", opts.san, on => { opts.san = on; next(); }));
  set.append(line("Players, the end and the house rules apply from the next game."));
  set.append(toggle("Show the odds of the last bid", opts.odds, on => { opts.odds = on; next(); draw(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; next(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("boast:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "boast");
document.querySelector(".bo-mark").innerHTML = APPS.find(a => a.id === "boast")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__boast = { page, get view() { return V; }, opts, fillNames, course };
// the first time, a game is dealt at once: the table is the menu
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
