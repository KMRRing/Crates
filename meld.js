// Meld (gin rummy for two) against the computer, or at a table with a friend on their own phone. The rules are
// meld-rules.js's, the computer player meld-bot.js's, the running seats.js's (seats-ui.js). This page draws the table:
// the other hand as backs, the stock and the pile between, what the other has picked up from the pile, and your cards
// along the foot, melds together if you like; and a hand's end with every card shown.
import { rules, TO, BONUS, SHOW_MS, RANKS, rankOf, suitOf, cardName, short, deadCount, arrangements } from "./meld-rules.js";
import { LEVEL_NAMES } from "./meld-bot.js";
import { seatPage } from "./seats-ui.js";
import { cardHtml, backHtml, fitRow } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "meld:opts", RECORD = "meld:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Marlow", "Rowan"];                                         // the computer players, by seat
const SORTS = [["melds", "Melds first"], ["rank", "By rank"], ["suit", "By suit"]];

let opts = { level: "hard", to: 100, sort: "melds", voice: false, ...read(OPTS, {}) };
if (!LEVEL_NAMES.some(([k]) => k === opts.level)) opts.level = "hard";
if (!TO.includes(opts.to)) opts.to = 100;
if (!SORTS.some(([k]) => k === opts.sort)) opts.sort = "melds";
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

const face = id => ({ rank: RANKS[rankOf(id)], suit: suitOf(id) });
const card = (id, cls = "") => cardHtml(face(id), { cls, label: cardName(id) });
const cards = (ids, cls = "") => ids.map(id => card(id, cls)).join("");

let V = null, sel = null, selFor = "", page = null;
const randomRounds = seatRounds("meld", ["shown"]);                         // random mode's round: a hand
page = seatPage({
  rules, id: "meld", app: 1, pace: 1100, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); randomRounds(v); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const mine = () => V?.seat ?? 0;                                           // the seat drawn at the foot (a watcher sees seat 0's)
const isMe = seat => V?.seat != null && seat === V.seat;
const myTurn = v => !!(v?.G && v.seat != null && v.toMove === v.seat);

// ---------- what's said ----------
const who = seat => (isMe(seat) ? "You" : nameOf(seat));
const verb = (seat, you, they) => (isMe(seat) ? you : they);
/** The hand's end in a sentence. */
function resultLine(s) {
  const r = s.result, by = r.by, foe = 1 - by;
  if (r.kind === "wash") return "Two cards left in the stock: a draw. Nobody scores.";
  if (r.kind === "big") return `${who(by)} ${verb(by, "go", "goes")} big gin. ${who(by)} ${verb(by, "score", "scores")} ${r.points} (${r.dead[foe]} deadwood and ${r.bonus}).`;
  if (r.kind === "gin") return `${who(by)} ${verb(by, "go", "goes")} gin: ${r.points} (${r.dead[foe]} deadwood and ${r.bonus}).`;
  const laid = r.lay.length ? ` after laying off ${r.lay.length}` : "";
  if (r.undercut) return `${who(by)} ${verb(by, "knock", "knocks")} with ${r.dead[by]}, but ${who(foe)} ${verb(foe, "hold", "holds")} ${r.dead[foe]}${laid}: undercut! ${who(foe)} ${verb(foe, "score", "scores")} ${r.points} (${r.dead[by] - r.dead[foe]} and ${r.bonus}).`;
  return `${who(by)} ${verb(by, "knock", "knocks")} with ${r.dead[by]}; ${who(foe)} ${verb(foe, "hold", "holds")} ${r.dead[foe]}${laid}. ${who(by)} ${verb(by, "score", "scores")} ${r.points}.`;
}
/** The latest thing done at the table, in a few words. */
function lastLine(s) {
  const l = s.last;
  if (!l) return "";
  if (l.did === "deal") return `${who(l.seat)} ${verb(l.seat, "deal", "deals")}: the ${short(l.card)} is turned up.`;
  if (l.did === "pass") return `${who(l.seat)} ${verb(l.seat, "pass", "passes")}.`;
  if (l.did === "stock") return `${who(l.seat)} ${verb(l.seat, "draw", "draws")} from the stock.`;
  if (l.did === "take" || l.did === "pile") return `${who(l.seat)} ${verb(l.seat, "take", "takes")} the ${short(l.card)}.`;
  return `${who(l.seat)} ${verb(l.seat, "throw", "throws")} the ${short(l.card)}.`;
}

// ---------- the table ----------
function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("table").innerHTML = ""; $("hand").innerHTML = ""; $("status").textContent = ""; $("strip").textContent = ""; $("bar").innerHTML = ""; return; }
  const s = v.state, me = mine();
  const key = `${v.G.seq}:${s.hand}:${s.step}:${(s.hands[me] || []).length}`;
  if (key !== selFor) { selFor = key; sel = null; }
  const mark = (k, n) => `<b>${esc(who(k))}</b> ${n}`;
  $("strip").innerHTML = `Hand <b>${s.hand}</b> · game to ${s.opts.to} · ${mark(me, s.scores[me])} · ${mark(1 - me, s.scores[1 - me])}`;
  drawTable(v);
  drawHand(v);
  $("status").innerHTML = statusLine(v);
  drawBar(v);
}

function drawTable(v) {
  const s = v.state, me = mine(), foe = 1 - me, box = $("table");
  const shown = s.step === "shown" || s.step === "over";
  const turn = !shown && v.toMove === foe;
  // the other hand: backs, or every card once the hand is over
  const backs = shown ? "" : `<span class="ml-backs">${s.hands[foe].map(() => backHtml()).join("")}</span>`;
  const grabs = s.grabs[foe].slice(-6);
  const took = shown ? "" : `<p class="ml-grabs">${grabs.length ? `Picked up from the pile <span class="cd-line">${cards(grabs)}</span>` : "Nothing picked up from the pile"}</p>`;
  const reveal = shown && s.result ? `<div class="ml-reveal">${revealHtml(s, foe)}</div>` : "";
  const foeBlock = `<div class="ml-foe${turn ? " turn" : ""}"><p class="ml-who"><b>${esc(nameOf(foe))}</b><span class="ml-sc">${s.scores[foe]}</span><span class="ml-n">${s.hands[foe].length} cards</span></p>${backs}${took}${reveal}</div>`;
  let mid;
  if (shown && s.result) {
    const left = Math.max(0, (s.until ?? 0) - Date.now());
    mid = `<div class="ml-mid ml-over"><p class="ml-result">${esc(s.step === "over" ? finalLine(s) : resultLine(s))}</p>${s.step === "shown" ? `<span class="ml-next" aria-hidden="true"><i style="animation-duration:${SHOW_MS}ms;animation-delay:-${Math.min(SHOW_MS, SHOW_MS - left)}ms"></i></span>` : ""}</div>`;
  } else {
    const top = s.discard[s.discard.length - 1];
    const draws = myTurn(v) && s.step === "draw", offer = myTurn(v) && s.step === "offer";
    mid = `<div class="ml-mid"><div class="ml-piles">
      <button type="button" class="ml-stock${draws ? " live" : ""}" data-pick="stock" aria-label="The stock, ${s.stock.length} cards"${draws ? "" : " disabled"}>${backHtml()}<span class="ml-count">${s.stock.length}</span></button>
      <button type="button" class="ml-pile${draws && !s.mustStock || offer ? " live" : ""}" data-pick="pile" aria-label="The pile, top card ${top == null ? "none" : cardName(top)}"${(draws && !s.mustStock) || offer ? "" : " disabled"}>${top == null ? '<span class="ml-empty"></span>' : card(top)}<span class="ml-count">${s.discard.length}</span></button>
    </div><p class="ml-last">${esc(lastLine(s))}</p></div>`;
  }
  box.innerHTML = foeBlock + mid;
}

/** A seat's cards laid out as the hand ended: its melds, then the rest; cards laid off by the other in brass. */
function shownHand(s, k) {
  const r = s.result;
  if (r.melds[k].length || r.rest[k].length) return { melds: r.melds[k], rest: r.rest[k] };
  const a = arrangements(s.hands[k], 1)[0];
  return { melds: a.melds, rest: a.rest };
}
function revealHtml(s, k) {
  const { melds, rest } = shownHand(s, k), lit = new Set(s.result.lay);
  const groups = melds.map(g => `<span class="cd-line ml-meld">${g.map(c => card(c, lit.has(c) ? "lit" : "")).join("")}</span>`).join("");
  const dead = rest.length ? `<span class="cd-line ml-rest">${cards(rest)}</span>` : "";
  return `${groups}${dead}${s.result.kind === "wash" ? "" : `<span class="ml-dead">${s.result.dead[k]} deadwood</span>`}`;
}
function finalLine(s) {
  const f = s.final;
  return `${who(f.winner)} ${verb(f.winner, "win", "wins")} the game, ${f.totals[f.winner]} to ${f.totals[1 - f.winner]}${f.shutout ? " (a shutout)" : ""}.`;
}

// ---------- your cards ----------
let known = new Set(), knownFor = "";
/** The card (or cards) you've just drawn, to show it among the rest: what's in your hand now that wasn't before the draw. */
function freshOf(v) {
  if (v.seat == null) return new Set();
  const s = v.state, hand = s.hands[v.seat], key = `${v.G.seq}:${s.hand}`;
  if (key !== knownFor) { knownFor = key; known = new Set(hand); return new Set(); }
  if (s.step === "discard" && s.turn === v.seat) return new Set(hand.filter(c => !known.has(c)));
  known = new Set(hand);
  return new Set();
}
const GAP = .55;                                                   // between melds, in card widths' em
function drawHand(v) {
  const box = $("hand"), s = v.state;
  if (v.seat == null) { box.innerHTML = `<p class="ml-watch">Watching: you sit down at the next game.</p>`; return; }
  const shown = s.step === "shown" || s.step === "over";
  let parts;
  if (shown && s.result) {
    const h = shownHand(s, v.seat);
    parts = [...h.melds, h.rest].filter(g => g.length);
  } else {
    const hand = s.hands[v.seat];
    if (opts.sort === "melds") { const a = arrangements(hand, 1)[0]; parts = [...a.melds, a.rest].filter(g => g.length); }
    else parts = [[...hand].sort(opts.sort === "suit" ? (a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b) : (a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b))];
  }
  const fresh = shown ? new Set() : freshOf(v), lit = new Set(shown && s.result ? s.result.lay : []);
  let html = "", n = 0;
  parts.forEach((g, k) => g.forEach((id, i) => {
    const cls = [sel === id && "sel", fresh.has(id) && "fresh", lit.has(id) && "lit", k && !i && "grp"].filter(Boolean).join(" ");
    html += cardHtml(face(id), { cls, data: { id }, label: cardName(id) });
    n++;
  }));
  box.innerHTML = html;
  fitRow(box, n, { max: 1.15 });
  // the gaps between melds take width the row's fitting didn't count: the cards close up to keep it
  const gaps = parts.length - 1, size = parseFloat(box.style.getPropertyValue("--cd-size"));
  if (gaps && size && n > 1) {
    const cw = size * 2.5, step = Math.min(cw * 1.04, (box.clientWidth - cw - gaps * GAP * size) / (n - 1));
    box.style.setProperty("--cd-step", `${Math.max(step, cw * 0.22)}px`);
  }
}
$("hand").addEventListener("click", e => {
  const c = e.target.closest(".cd[data-id]");
  if (!c || !V?.G || !myTurn(V) || V.state.step !== "discard") return;
  const id = Number(c.dataset.id);
  sel = sel === id ? null : id;
  draw();
});

/** The deadwood left by throwing each card: what the status line and the Knock button say. */
function throwing(v) {
  const s = v.state, hand = s.hands[v.seat], out = new Map();
  for (const c of hand) if (c !== s.took) out.set(c, deadCount(hand.filter(x => x !== c)));
  return out;
}
function statusLine(v) {
  const s = v.state;
  if (s.step === "over") return `<span>${esc(finalLine(s))}</span>`;
  if (s.step === "shown") {
    const r = s.result, me = mine();
    if (r.kind === "wash") return "<span>Hands shown. Nobody scores.</span>";
    return `<span>${esc(`${who(me)} ${verb(me, "hold", "holds")} ${r.dead[me]} deadwood${r.lay.length && r.by !== me ? " after laying off" : ""}.`)} Tap Next hand, or wait.</span>`;
  }
  if (v.seat == null) return `<span>${esc(nameOf(v.toMove ?? 0))} to play.</span>`;
  if (!myTurn(v)) return `<span>${esc(nameOf(v.toMove))} ${v.seats[v.toMove]?.bot ? "is thinking…" : "to play."}</span>`;
  const up = short(s.discard[s.discard.length - 1]);
  if (s.step === "offer") return `<span>${s.last?.did === "pass" ? `${esc(nameOf(1 - v.seat))} passed. ` : ""}Take the <b>${up}</b>, or pass.</span>`;
  if (s.step === "draw") return `<span>${s.mustStock ? "You both passed the upcard: <b>draw from the stock</b>." : `Draw from the stock, or take the <b>${up}</b>.`}</span>`;
  const out = throwing(v), best = Math.min(...out.values());
  if (sel != null && out.has(sel)) {
    const d = out.get(sel);
    return `<span>Throw the <b>${short(sel)}</b>: <b>${d}</b> deadwood${d === 0 ? ", gin" : d <= 10 ? ", you can knock" : ""}.</span>`;
  }
  if (sel != null) return `<span>You can't throw back the <b>${short(sel)}</b> you just took.</span>`;
  return `<span>Pick a card to throw. The best leaves <b>${best}</b> deadwood${best <= 10 ? ": you can knock" : " (knock at 10 or less)"}.</span>`;
}

function drawBar(v) {
  const bar = $("bar"), s = v.state;
  const b = (act, text, { primary = false, off = false } = {}) => `<button type="button" class="btn${primary ? " primary" : ""} ml-go" data-act="${act}"${off ? " disabled" : ""}>${text}</button>`;
  if (s.step === "shown") { bar.innerHTML = b("next", "Next hand", { primary: true }); return; }
  if (s.step === "over") { bar.innerHTML = page.host ? b("again", "New game", { primary: true }) : ""; return; }
  if (!myTurn(v)) { bar.innerHTML = ""; return; }
  const top = short(s.discard[s.discard.length - 1]);
  if (s.step === "offer") { bar.innerHTML = b("pass", "Pass") + b("take", `Take the ${top}`, { primary: true }); return; }
  if (s.step === "draw") { bar.innerHTML = b("stock", "Draw from the stock", { primary: true }) + b("pile", `Take the ${top}`, { off: !!s.mustStock }); return; }
  // the discard: Throw, and Knock (Gin, or Big gin with all eleven cards melded)
  const out = throwing(v), d = sel != null ? out.get(sel) : undefined;
  const big = deadCount(s.hands[v.seat]) === 0;
  const knock = big ? b("big", "Big gin", { primary: true })
    : b("knock", d === 0 ? "Gin" : d != null && d <= 10 ? `Knock · ${d}` : "Knock", { off: d == null || d > 10 });
  bar.innerHTML = b("throw", sel != null && out.has(sel) ? `Throw ${short(sel)}` : "Throw", { primary: !big, off: sel == null || !out.has(sel) }) + knock;
}

async function play(m) {
  const why = await page.move(m);
  if (why) toast(why);
}
$("bar").addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled || !V?.G) return;
  const a = b.dataset.act;
  if (a === "take" || a === "pass" || a === "next") return void play({ t: a });
  if (a === "stock" || a === "pile") return void play({ t: a });
  if (a === "throw") return void play({ t: "discard", card: sel });
  if (a === "knock") return void play({ t: "knock", card: sel });
  if (a === "big") return void play({ t: "knock", card: null });
  if (a === "again") newGame();
});
$("table").addEventListener("click", e => {
  const p = e.target.closest("[data-pick]");
  if (!p || p.disabled || !V?.G) return;
  const s = V.state;
  play({ t: s.step === "offer" ? "take" : p.dataset.pick });
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.final.winner === v.seat;
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("meld", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 900);
}
function showEnd(v) {
  const s = v.state, f = s.final, me = mine(), order = [me, 1 - me];
  $("endHead").textContent = f.winner === v.seat ? "You win" : `${nameOf(f.winner)} wins`;
  const row = k => `<tr class="${k === f.winner ? "won" : ""}"><th>${esc(who(k))}</th><td>${s.scores[k]}</td><td>${f.boxes[k] * BONUS.box}</td><td>${k === f.winner ? f.game : 0}</td><td><b>${f.totals[k]}</b></td></tr>`;
  $("endBody").innerHTML = `<table class="ml-tally"><thead><tr><th></th><td>Points</td><td>Hands won</td><td>Game</td><td>Total</td></tr></thead><tbody>${order.map(row).join("")}</tbody></table>
    <p class="ml-end-note">${s.log.length} hands. Hands won count ${BONUS.box} each; the game ${BONUS.game}${f.shutout ? ", doubled for a shutout" : ""}.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  page.deal({ to: opts.to }, 2);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Gin rummy for two. Ten cards each; be first to knock with less deadwood than the other, or to go gin.</p>
    <p><b>Melds.</b> Three or four cards of a rank, or three or more of a suit in a row (ace low: A-2-3 is a run, Q-K-A is not). Cards in no meld are <b>deadwood</b>: an ace counts 1, the face cards 10, the rest their number.</p>
    <p><b>A turn.</b> Draw the top of the stock or the top of the pile, then throw one card on the pile. You can't throw back the card you took from the pile. To begin, the player who didn't deal may take the turned-up card or pass; then the dealer may; if both pass, the first draws from the stock.</p>
    <p><b>Knocking.</b> With 10 or less in deadwood after your throw, you may knock instead of throwing: the hands are shown. The other player lays off, putting cards on your melds (the fourth of a set of three, the card above or below a run) to cut their deadwood; Meld does it for them, as well as it can be done.</p>
    <p><b>Scoring.</b> Knock with less than the other has left and you score the difference. If the other has as much or less, it is an <b>undercut</b>: they score the difference and ${BONUS.undercut} more. <b>Gin</b> (no deadwood, the other can't lay off) scores their deadwood and ${BONUS.gin}. <b>Big gin</b> (all eleven cards in melds, no throw) scores their deadwood and ${BONUS.big}.</p>
    <p><b>The stock.</b> When only two cards are left and the player who drew doesn't knock, the hand is a draw: nobody scores.</p>
    <p><b>The game</b> goes to ${TO.join(", ")} points (the menu). The winner then adds ${BONUS.game} for the game (${BONUS.game * 2} if the other has nothing), and each side ${BONUS.box} for every hand won.</p>`;
  $("rulesDlg").showModal();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  play.append(action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  const keep = () => saveOpts();
  set.append(choice("Computer player", LEVEL_NAMES, opts.level, v => { opts.level = v; keep(); }));
  set.append(choice("A game goes to", TO.map(n => [n, String(n)]), opts.to, v => { opts.to = Number(v); keep(); }));
  set.append(line("The length applies from the next game."));
  set.append(choice("Your cards", SORTS, opts.sort, v => { opts.sort = v; keep(); draw(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; keep(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("meld:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "meld");
document.querySelector(".ml-mark").innerHTML = APPS.find(a => a.id === "meld")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
window.__meld = { page, get view() { return V; }, opts };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
