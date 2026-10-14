// Big Two (鋤大D) against computer players, or at a table with friends each on their own phone. The rules and words
// are bigtwo-rules.js's, the computer players bigtwo-bot.js's, the running seats.js's (seats-ui.js). This page draws
// the table: the others round it with what each played this trick, your cards along the foot, picked by a tap.
import { rules, check, value, rankOf, suitOf, RANKS, KIND_NAMES, PLAY_TALK, DEALS, cardName, SHOW_MS } from "./bigtwo-rules.js";
import { botMove, plan, LEVEL_NAMES } from "./bigtwo-bot.js";
import { seatPage } from "./seats-ui.js";
import { cardHtml, backHtml, fitRow } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { createCourse, progressOf } from "./course.js";
import { cardStage } from "./course-cards.js";
import { COURSE, judge, hold } from "./bigtwo-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "bigtwo:opts", RECORD = "bigtwo:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Ah Wing", "Kit", "Mei", "Ming"];                          // the computer players, by seat
const TALK = [["yue", "廣東話"], ["zh", "普通话"], ["en", "English"]];

let opts = { seats: 4, level: "hard", deals: 8, suits: "hk", triples: true, top: true, talk: "yue", voice: true, sort: "rank", ...read(OPTS, {}) };
if (!DEALS.includes(opts.deals)) opts.deals = 8;
const saveOpts = () => write(OPTS, opts);
const gameOptions = () => ({ deals: opts.deals, suits: opts.suits, triples: opts.triples, top: opts.top, talk: opts.talk });

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

const face = id => ({ rank: RANKS[rankOf(id)], suit: suitOf(id) });
const cards = (ids, cls = "") => ids.map(id => cardHtml(face(id), { cls, label: cardName(id) })).join("");
const playName = k => KIND_NAMES[k.kind];

let V = null, sel = new Set(), selFor = "", page = null;
// the hint: Hard's play, picked for you, and the rest of your hand split into the plays it assumes it can make after
// it, in a vacuum (bigtwo-bot.js's plan, as a computer player organises its own hand): { key (the hand it was asked
// for), cards (the play; none for a pass), groups: [{ cards, kind }] }. It shows while the cards picked are its play.
let hinted = null;
page = seatPage({
  rules, id: "bigtwo", app: 1, pace: 950, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;

/** Where each seat sits round the table, from yours: the next to your right, then across, then to your left. */
function placeOf(seat) {
  const n = V.state.seats, me = V.seat ?? 0, k = (seat - me + n) % n;
  if (k === 0) return "at-me";
  if (n === 3) return k === 1 ? "at-right" : "at-left";
  return ["at-me", "at-right", "at-top", "at-left"][k];
}

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("table").innerHTML = ""; $("hand").innerHTML = ""; $("status").textContent = ""; drawBar(); return; }
  const s = v.state;
  // the picked cards stay picked while the others play; a new hand, or a move of yours, clears them
  const key = `${v.G.seq}:${s.deal}:${(s.hands[v.seat ?? 0] || []).length}`;
  if (key !== selFor) { selFor = key; sel = new Set(); }
  $("strip").innerHTML = `Deal <b>${s.deal}</b> of ${s.opts.deals}${s.opts.suits === "tw" ? " · ♣ lowest" : ""}`;
  drawTable(v);
  drawHand(v);
  $("status").innerHTML = `<span>${statusLine(v)}</span>`;
  drawBar();
}

/** The latest a seat has done in this trick: its cards, or a pass. */
function actOf(s, seat) {
  for (let i = s.trick.plays.length - 1; i >= 0; i--) if (s.trick.plays[i].seat === seat) return s.trick.plays[i];
  return null;
}
function drawTable(v) {
  const s = v.state, shown = s.step === "shown" || s.step === "over", res = shown ? s.result : null;
  const seatHtml = seat => {
    const place = placeOf(seat), a = actOf(s, seat), turn = s.step === "play" && s.turn === seat, lead = !shown && s.trick.by === seat && s.trick.last;
    const count = s.hands[seat].length, sc = s.scores[seat];
    let play = "";
    if (res) {
      const left = res.hands[seat];
      play = res.winner === seat ? `<span class="b2-out">Out · +${res.paid.reduce((a, b) => a + b, 0)}</span>`
        : `<span class="cd-line b2-left">${cards(left)}</span><span class="b2-pay">−${res.paid[seat]}</span>`;
    } else if (a?.pass) play = `<span class="b2-pass">${esc(PLAY_TALK.pass[s.opts.talk === "en" ? "en" : s.opts.talk])}</span>`;
    else if (a?.cards) play = `<span class="cd-line">${cards(a.cards)}</span>`;
    else if (turn && !isMe(seat)) play = `<span class="b2-thinking">thinking</span>`;
    const back = place === "at-me" ? "" : `<span class="b2-n" title="Cards left">${backHtml("tiny")}<b>${count}</b></span>`;
    return `<div class="b2-seat ${place}${turn ? " turn" : ""}${lead ? " lead" : ""}${count === 1 && !res ? " last" : ""}">
      <div class="b2-who"><b>${esc(nameOf(seat))}</b>${back}<span class="b2-sc">${sc > 0 ? "+" : ""}${sc}</span></div>
      <div class="b2-play">${play}</div></div>`;
  };
  const centre = res ? `<div class="b2-centre"><p class="b2-said">${esc(v.said || "")}</p>${s.step === "shown" ? `<span class="b2-next"><i data-until="${s.until}"></i></span>` : ""}</div>`
    : `<div class="b2-centre"><p class="b2-said">${esc(v.said || "")}</p>${s.trick.last ? `<p class="b2-beat">To beat: <b>${esc(nameOf(s.trick.by))}</b>'s ${esc(playName(s.trick.last))}</p>` : `<p class="b2-beat">${isMe(s.turn) ? "Your lead" : `${esc(nameOf(s.turn))} leads`}</p>`}</div>`;
  $("table").dataset.n = s.seats;
  $("table").innerHTML = Array.from({ length: s.seats }, (_, i) => seatHtml(i)).join("") + centre;
  runBar();
}

let barRaf = 0;
function runBar() {
  cancelAnimationFrame(barRaf);
  const bar = document.querySelector(".b2-next i");
  if (!bar) return;
  const until = Number(bar.dataset.until), now = () => page.runner.table.now();
  const tick = () => { if (!bar.isConnected) return; const left = Math.max(0, until - now()); bar.style.transform = `scaleX(${left / SHOW_MS})`; if (left > 0) barRaf = requestAnimationFrame(tick); };
  tick();
}

/** Your cards in a row, picked ones raised, sorted by rank (or by suit). */
function sortedHand(hand, so) {
  const o = V.state.opts;
  return [...hand].sort(so === "suit" ? (a, b) => suitOf(a) - suitOf(b) || value(a, o) - value(b, o) : (a, b) => value(a, o) - value(b, o));
}
/** The hint, while it stands: asked for this hand, and the cards picked still its play. */
const liveHint = () => (hinted && hinted.key === selFor && sel.size === hinted.cards.length && hinted.cards.every(c => sel.has(c)) ? hinted : null);
const GAP = .55;                                                 // between the hint's groups, in card widths' em
function drawHand(v) {
  const box = $("hand");
  if (v.seat == null) { box.innerHTML = `<p class="b2-watch">Watching: you sit down at the next game.</p>`; return; }
  // with a hint, the play first (picked, raised), then each play the rest of the hand makes, apart, every other one
  // shaded, low to high; else the hand by rank or suit
  const h = liveHint();
  const parts = h ? [sortedHand(h.cards, "rank"), ...h.groups.map(g => g.cards)].filter(g => g.length) : [sortedHand(v.state.hands[v.seat] || [], opts.sort)];
  let html = "", n = 0;
  parts.forEach((cards, k) => cards.forEach((id, i) => {
    const cls = [sel.has(id) && "sel", h && k && !i && "grp", h && (k - (h.cards.length ? 1 : 0)) % 2 === 1 && !sel.has(id) && "shade"].filter(Boolean).join(" ");
    html += cardHtml(face(id), { cls, data: { id }, label: cardName(id) });
    n++;
  }));
  box.innerHTML = html;
  fitRow(box, n, { max: 1.15 });
  // the gaps between the groups take width the row's fitting didn't count: the cards close up to keep it
  const gaps = parts.length - 1, size = parseFloat(box.style.getPropertyValue("--cd-size"));
  if (gaps && size && n > 1) {
    const cw = size * 2.5, step = Math.min(cw * 1.04, (box.clientWidth - cw - gaps * GAP * size) / (n - 1));
    box.style.setProperty("--cd-step", `${Math.max(step, cw * 0.22)}px`);
  }
}
$("hand").addEventListener("click", e => {
  const c = e.target.closest(".cd[data-id]");
  if (!c || !V?.G || V.seat == null) return;
  const id = Number(c.dataset.id);
  if (sel.has(id)) sel.delete(id); else sel.add(id);
  draw();
});

const ARTICLE = { fullhouse: "a full house", four: "four of a kind" }, PLURAL = { fullhouse: "full houses", four: "fours of a kind", flush: "flushes", straightflush: "straight flushes" };
const one = k => ARTICLE[k] || `a ${KIND_NAMES[k]}`, many = (k, n) => `${["", "", "two", "three", "four", "five", "six", "seven", "eight"][n] || n} ${PLURAL[k] || `${KIND_NAMES[k]}s`}`;
/** Plays in words, the longest first: "a straight, a pair and two singles". */
function playsWords(groups) {
  const order = ["straightflush", "four", "fullhouse", "flush", "straight", "triple", "pair", "single"], counts = new Map();
  for (const g of groups) counts.set(g.kind, (counts.get(g.kind) || 0) + 1);
  const words = order.filter(k => counts.has(k)).map(k => (counts.get(k) === 1 ? one(k) : many(k, counts.get(k))));
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
function statusLine(v) {
  const s = v.state, h = liveHint();
  if (h && s.step === "play" && isMe(s.turn)) {
    const kind = h.cards.length ? check(s, v.seat, h.cards)?.play?.kind : null;
    if (!h.cards.length) return `<b>Hint</b>: pass · your hand plays as ${esc(playsWords(h.groups))}`;
    return `<b>Hint</b>: ${esc(kind ? one(kind) : "this")} · ${h.groups.length ? `then ${esc(playsWords(h.groups))}` : "and you're out"}`;
  }
  if (s.step === "over") return esc(s.winners.includes(v.seat) ? "You win the game" : `${s.winners.map(nameOf).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`);
  if (s.step === "shown") return esc(isMe(s.result.winner) ? "You're out first!" : `${nameOf(s.result.winner)} is out`);
  if (v.seat == null) return esc(`${nameOf(s.turn)} to play`);
  if (!isMe(s.turn)) { const w = v.seats[s.turn]; return esc(w?.bot && !w.away ? `${w.name} is thinking…` : `${w?.name || "Someone"} to play`); }
  const nxt = (v.seat + 1) % s.seats, warn = s.opts.top && s.hands[nxt].length === 1 ? ` · <b>頂大</b>: ${esc(nameOf(nxt))} has one card` : "";
  if (s.mustLead != null) return `Your lead: the ${esc(cardName(s.mustLead))} must be in it${warn}`;
  if (!s.trick.last) return `Your lead: any play${warn}`;
  const k = s.trick.last;
  return `Beat the ${esc(playName(k))}, or pass${warn}`;
}

function drawBar() {
  const bar = $("bar"), v = V;
  const mine = v?.G && v.seat != null && v.state.step === "play" && v.state.turn === v.seat;
  const picked = [...sel];
  const c = mine && picked.length ? check(v.state, v.seat, picked) : null;
  const playLabel = c?.play ? `Play ${playName(c.play)}` : picked.length ? "Play" : "Play";
  bar.innerHTML = `<button type="button" class="btn b2-go" data-act="pass" ${mine && v.state.trick.last ? "" : "disabled"}>Pass</button>
    <button type="button" class="btn b2-go" data-act="hint" ${mine ? "" : "disabled"}>Hint</button>
    <button type="button" class="btn primary b2-go b2-play-btn" data-act="play" ${c?.play ? "" : "disabled"}>${esc(playLabel)}</button>
    ${picked.length ? `<button type="button" class="icon-btn b2-clear" data-act="clear" aria-label="Put them back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ""}`;
  if (!v?.G) bar.innerHTML = `<button type="button" class="btn primary b2-go" data-act="new">New game</button>`;
  else if (v.state.step === "over" && page.host) bar.innerHTML = `<button type="button" class="btn primary b2-go" data-act="new">New game</button>`;
}
$("bar").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "clear") { sel = new Set(); draw(); return; }
  if (act === "hint") {
    const s = V.state, m = botMove(s, V.seat, { level: "hard" }), cards = m.t === "play" ? m.cards : [];
    const rest = s.hands[V.seat].filter(c => !cards.includes(c)), byValue = (a, b) => value(a, s.opts) - value(b, s.opts);
    const groups = (rest.length ? plan(rest, s.opts).plays : []).map(p => ({ cards: [...p.cards].sort(byValue), kind: p.kind })).sort((a, b) => byValue(a.cards[0], b.cards[0]));
    hinted = { key: selFor, cards, groups };
    sel = new Set(cards); draw();
    return;
  }
  const move = act === "pass" ? { t: "pass" } : { t: "play", cards: [...sel] };
  const why = await page.move(move);
  if (why) toast(why);
  else { sel = new Set(); draw(); }
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("bigtwo", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 900);
}
function showEnd(v) {
  const s = v.state, order = Array.from({ length: s.seats }, (_, i) => i).sort((a, b) => s.scores[b] - s.scores[a]);
  $("endHead").textContent = s.winners.includes(v.seat) ? (s.winners.length > 1 ? "You share the win" : "You win") : `${s.winners.map(nameOf).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`;
  const outs = order.map(i => s.log.filter(e => e.winner === i).length);
  $("endBody").innerHTML = `<ol class="b2-standings">${order.map((i, k) => `<li class="${s.winners.includes(i) ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(nameOf(i))}</span><span class="b2-outs">out first ${outs[k]}×</span><b>${s.scores[i] > 0 ? "+" : ""}${s.scores[i]}</b></li>`).join("")}</ol>
    <p class="b2-end-note">${s.log.length} deals. A point a card left, two a card from ten (雙炒), three with all thirteen (三炒).</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  page.deal(gameOptions(), Math.max(3, Math.min(4, opts.seats)));
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const row = (k, en) => `<tr><td>${en}</td><td><b>${PLAY_TALK[k].yue}</b><br><small>${PLAY_TALK[k].jp}</small></td><td><b>${PLAY_TALK[k].zh}</b><br><small>${PLAY_TALK[k].py}</small></td></tr>`;
  $("rulesBody").innerHTML = `
    <p>Big Two (鋤大D, co4 daai6 di1, "hoeing the big deuce") is Hong Kong's card game: be first to play out all your cards. Four players, thirteen cards each (three players get seventeen, the spare to whoever holds the ♦3).</p>
    <p><b>Order.</b> Twos are the highest cards, threes the lowest: 3 4 5 6 7 8 9 10 J Q K A 2. Between equal ranks the suit decides: ♦ diamonds (階磚) lowest, then ♣ clubs (梅花), ♥ hearts (紅心), ♠ spades (葵扇) highest. Menu, Suits, swaps clubs and diamonds, as some tables do.</p>
    <p><b>Plays.</b> A single, a pair, a triple, or five cards: a straight (five ranks in a row), a flush (five of a suit), a full house (three and two), four of a kind with one more card, a straight flush. Four cards on their own aren't a play.</p>
    <p><b>The first play</b> of a game is the ♦3's, and must include it. After that, each player in turn (to the right) plays the same number of cards, higher, or passes. A pass doesn't stop you playing when your turn comes round again. When everyone else has passed, the last player to play leads anything. The first out wins the deal and leads the next.</p>
    <p><b>What beats what.</b> Singles by rank, then suit. Pairs by rank, then their higher suit. Five-card hands by kind: straight &lt; flush &lt; full house &lt; four of a kind &lt; straight flush. Straights from 34567 up to 10JQKA, then 23456, then A2345, the highest; no straight goes round from K through A to 2. Flushes by their ranks from the top, the suit only when every rank is the same; full houses by their three, four of a kind by its four.</p>
    <p><b>頂大</b> (ding2 daai6, "top it"): when the next player has one card left, a single you play must be your highest, or you'd let them out cheaply. Menu turns it off.</p>
    <p><b>Scoring.</b> When someone goes out, each other player pays a point for each card left, two for each when ten or more are left (雙炒, soeng1 caau2, "double fry"), three for each when all thirteen are (三炒). The winner takes them all. A game is ${opts.deals} deals; the most points wins.</p>
    <h3>What's said at the table</h3>
    <table class="b2-talk"><thead><tr><th></th><th>廣東話</th><th>普通话</th></tr></thead><tbody>
    ${row("single", "A single")}${row("pair", "A pair")}${row("triple", "Three of a kind")}${row("straight", "Straight")}${row("flush", "Flush")}${row("fullhouse", "Full house")}${row("four", "Four of a kind")}${row("straightflush", "Straight flush")}${row("pass", "Pass")}
    <tr><td>Last card!</td><td><b>剩一張！</b><br><small>zing6 jat1 zoeng1</small></td><td><b>剩一张！</b><br><small>shèng yì zhāng</small></td></tr>
    <tr><td>The suits ♦ ♣ ♥ ♠</td><td><b>階磚 梅花 紅心 葵扇</b><br><small>gaai1 zyun1, mui4 faa1, hung4 sam1, kwai4 sin3</small></td><td><b>方块 梅花 红桃 黑桃</b><br><small>fāngkuài, méihuā, hóngtáo, hēitáo</small></td></tr>
    </tbody></table>
    <p class="b2-rules-note">蛇 (se4) is Cantonese for a straight, "snake"; 花 (faa1), "flower", a flush; 俘虜 (fu1 lou5), "prisoner", a full house. Taiwan plays the game as 大老二 (dà lǎo èr), the mainland as 锄大地.</p>`;
  $("rulesDlg").showModal();
}

// ---------- the course ----------
// Learn (the header): the game taught from nothing as Hong Kong plays it (bigtwo-course.js) on the course's sheet
// (course.js), the cards drawn as the table draws them; its last lesson starts a game against Easy. The Rules sheet,
// every rule on one page, opens from the course's map and the menu.
const course = createCourse({
  id: "bigtwo", course: COURSE, stage: cardStage({ face, label: cardName, judge, hold }), cls: "b2", inFrame: IN_FRAME, onRules: showRules,
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
  const cp = progressOf("bigtwo", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Big Two, from the rules", () => course.open()), action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  const keep = () => saveOpts();
  set.append(choice("Players", [[3, "3"], [4, "4"]], opts.seats, v => { opts.seats = Number(v); keep(); }));
  set.append(choice("A game is", DEALS.map(n => [n, `${n} deals`]), opts.deals, v => { opts.deals = Number(v); keep(); }));
  set.append(choice("Computer players", LEVEL_NAMES, opts.level, v => { opts.level = v; keep(); }));
  set.append(choice("Suits, lowest first", [["hk", "♦ ♣ ♥ ♠"], ["tw", "♣ ♦ ♥ ♠"]], opts.suits, v => { opts.suits = v; keep(); }));
  set.append(toggle("Triples", opts.triples, on => { opts.triples = on; keep(); }));
  set.append(toggle("頂大: top it for one card", opts.top, on => { opts.top = on; keep(); }));
  set.append(line("Players, the length and the house rules apply from the next game."));
  set.append(choice("Your cards", [["rank", "By rank"], ["suit", "By suit"]], opts.sort, v => { opts.sort = v; keep(); draw(); }));
  set.append(choice("Table talk", TALK, opts.talk, v => { opts.talk = v; keep(); }));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; keep(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("bigtwo:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "bigtwo");
document.querySelector(".b2-mark").innerHTML = APPS.find(a => a.id === "bigtwo")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
window.__bigtwo = { page, get view() { return V; }, opts, get sel() { return sel; }, course };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
