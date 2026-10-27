// Blackjack: a Macau table, as at the Venetian. A chip picked, then tapped into the circle (and, if you like, on Over or
// Under 13 beside it), Deal, and the round comes out as the dealer deals it: a card to you, one face up to the dealer, a
// second to you; your plays (hit, stand, double, split, surrender, and insurance when the dealer shows an ace); then
// the dealer's second card (no hole card: it comes only now), drawing to 17, and everything paid. The coach (Menu) is
// off, hints (the chart's play and why, when you ask), check (a word on each play of yours, with why) or always (the
// chart's play marked and explained before you play, a different one noted); what it says is blackjack-coach.js's. The
// felt prints the table's rules. Learn, in the header, is the course; the rules are blackjack-engine.js's, basic strategy
// blackjack-strategy.js's; this file keeps the game and deals each round out.
import { START, MIN, MAX, SIDE, CHIPS, RANKS, rankOf, suitOf, value, handOf, isBlackjack, isPair, sideTotal, newGame, deal, act, plays, advice, betProblem, strategyFor } from "./blackjack-engine.js";
import { COACH, isCoach, look, judge, evText } from "./blackjack-coach.js";
import { cardHtml } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, toggle, choice } from "./menu.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE } from "./blackjack-course.js";
import { blackjackStage } from "./blackjack-stage.js";
import { rulesHtml, feltWords, chartHtml } from "./blackjack-rules.js";
import { sideways } from "./wide.js";
import { IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { hk, short, chipsHtml, toast } from "./casino.js";

const $ = id => document.getElementById(id);
const RUN = "blackjack:run", OPTS = "blackjack:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, o) => (node?.animate ? node.animate(frames, { fill: "both", ...o }).finished.catch(() => {}) : Promise.resolve());

let S = null;                       // the game (blackjack-engine.js's), as saved
const opts = { chip: 500, coach: "on", fast: false, ...read(OPTS, {}) };
// the coach was once on or off: on was the chart's play marked, which is what Always still does
if (opts.coach === true) opts.coach = "on"; else if (opts.coach === false) opts.coach = "off"; else if (!isCoach(opts.coach)) opts.coach = "on";
let hinted = null;                  // the decision the coach was asked about (hintKey), so its play shows until you've played
let last = null;                    // your last play, judged: { look, play, ok, say }, until the next round is dealt
let busy = false;                   // cards being dealt out
let vis = null;                     // while dealing: how many cards of each are showing ({ dealer, hands: [] }); else all
let cleared = false;                // the finished round taken off the felt (a new bet begun)

const valid = g => g && g.v === 1 && Array.isArray(g.shoe) && g.rules && typeof g.balance === "number" && g.side && g.lastSide;
function save() { write(RUN, S); }
function saveOpts() { write(OPTS, opts); }
const inPlay = () => S.round && S.round.phase !== "over";

// ---------- drawing ----------
function drawStrip() {
  $("balance").textContent = S.balance.toLocaleString("en-GB");
  $("limits").textContent = `${short(MIN)}–${short(MAX)}`;
  $("limits").title = `The table takes ${hk(MIN)} to ${hk(MAX)} a hand`;
  if (S.rules.continuous) {
    $("shoe").textContent = `${S.rules.decks} decks · shuffler`;
    $("shoe").title = `A continuous shuffler: each round's cards go back in, so every round is dealt from all ${S.rules.decks} decks`;
  } else {
    $("shoe").textContent = `Shoe ${S.shoeNo} · ${Math.max(0, S.cut - S.pos)} to cut`;
    $("shoe").title = `${S.rules.decks} decks; ${Math.max(0, S.cut - S.pos)} cards before the cut card`;
  }
}
const onTable = () => S.bet + S.side.over + S.side.under;
const face = id => ({ rank: RANKS[rankOf(id)], suit: suitOf(id) });
const cardName = id => `${RANKS[rankOf(id)]}${"♦♣♥♠"[suitOf(id)]}`;
/** A hand's total as the table says it: 17, or soft 17 written 7/17 while the ace can still count one. */
const say = cards => { const h = handOf(cards); return !cards.length ? "" : isBlackjack(cards) ? "BJ" : h.bust ? `${h.total}` : h.soft && h.total < 21 ? `${h.total - 10}/${h.total}` : `${h.total}`; };
const WHY = { blackjack: "Blackjack", win: "Win", "dealer bust": "Win", lose: "Lose", bust: "Bust", push: "Push", surrendered: "Surrendered", "dealer blackjack": "Dealer blackjack" };
function drawFelt() {
  const r = S.round && !cleared ? S.round : null, showDealer = r ? (vis ? r.dealer.slice(0, vis.dealer) : r.dealer) : [];
  $("dcards").innerHTML = showDealer.map((id, k) => cardHtml(face(id), { data: { k: `d${k}` }, label: cardName(id) })).join("");
  $("dtotal").textContent = showDealer.length ? say(showDealer) : "";
  $("dtotal").classList.toggle("bust", showDealer.length > 1 && handOf(showDealer).bust);
  const over = r?.phase === "over" && !vis;
  const hands = r ? r.hands.map((h, i) => {
    const cards = vis ? h.cards.slice(0, vis.hands[i] ?? h.cards.length) : h.cards, line = over ? r.result.lines[i] : null;
    const active = !over && !vis && r.phase === "play" && r.active === i && r.hands.length > 1;
    return `<div class="bj-hand${active ? " active" : ""}${line ? (line.net > 0 ? " won" : line.net < 0 ? " lost" : " pushed") : ""}">
      <div class="bj-cards">${cards.map((id, k) => cardHtml(face(id), { cls: h.doubled && k === 2 ? "doubled" : "", data: { k: `h${i}-${k}` }, label: cardName(id) })).join("")}</div>
      <div class="bj-under"><i class="bj-total">${say(cards)}</i><span class="bj-stake">${short(h.stake)}</span>${line ? `<b class="bj-why">${WHY[line.why] || line.why}${line.net ? ` ${line.net > 0 ? "+" : "−"}${short(Math.abs(line.net))}` : ""}</b>` : ""}</div></div>`;
  }).join("") : "";
  // Over/Under 13 on your first two cards, once they're both showing
  const sideShown = r && (r.side.over || r.side.under) && (!vis || vis.hands.reduce((a, n) => a + n, 0) >= 2);
  const total = sideShown ? sideTotal(r.first) : 0;
  const sideLine = !sideShown ? "" : `<p class="bj-ou">First two ${total}${["under", "over"].filter(k => r.side[k]).map(k => {
    const won = k === "over" ? total > 13 : total < 13;
    return ` · <span class="${won ? "won" : "lost"}">${k === "over" ? "Over" : "Under"} ${won ? "+" : "−"}${short(r.side[k])}</span>`;
  }).join("")}</p>`;
  // the circle and the side bets beside it: your next bets, while you're betting
  const spot = (k, name) => {
    const v = k === "main" ? S.bet : S.side[k];
    return `<button type="button" class="bj-spot ${k}${v ? " on" : ""}" data-spot="${k}" aria-label="${k === "main" ? `Your bet: ${v ? hk(v) : "none"}` : `${name}, even money: ${v ? hk(v) : "no bet"}`}">${k === "main" ? `<span>${v ? (r ? short(v) : hk(v)) : "Bet"}</span>` : `<b>${name}</b><small>${v ? short(v) : "1 to 1"}</small>`}</button>`;
  };
  // under a finished round they're smaller: the round's result comes first
  const circle = !inPlay() ? `<div class="bj-spots${r ? " after" : ""}">${spot("under", "Under 13")}${spot("main")}${spot("over", "Over 13")}</div>` : "";
  $("hands").innerHTML = `<div class="bj-row${r && r.hands.length > 1 ? " split" : ""}">${hands}</div>${sideLine}${circle}`;
  fitCards();
  drawChart();
}
/**
 * Cards as large as the felt allows: a split's hands side by side, each fitting its share of the width, and the
 * dealer's cards, your hands and what's under them its height (measured, and shrunk until they fit).
 */
function fitCards() {
  const felt = $("felt"), box = $("hands"), rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, n = Math.max(1, S.round && !cleared ? S.round.hands.length : 1);
  const most = Math.max(2, ...(S.round && !cleared ? [S.round.dealer.length, ...S.round.hands.map(h => h.cards.length)] : [2])), least = .62 * rem;
  let size = Math.max(least, Math.min((felt.clientWidth / n) / (2.5 + (most - 1) * 1.15) - 2, (sideways() ? 2.2 : 1.6) * rem));
  felt.style.setProperty("--bj-card", `${size}px`);
  const need = () => [...box.children].reduce((a, el) => a + el.offsetHeight, 0) + .5 * rem * (box.children.length - 1);
  for (let k = 0; k < 6 && size > least; k++) {
    const room = box.clientHeight, want = need();
    if (want <= room + 1) break;
    size = Math.max(least, size * Math.max(.75, room / want));
    felt.style.setProperty("--bj-card", `${size}px`);
  }
}
/** Held sideways with the coach on Always: the chart beside the felt, the hand in play's cell picked out. */
function drawChart() {
  const box = $("chartBox"), show = opts.coach === "on" && sideways();
  box.hidden = !show;
  if (!show) return;
  const r = S.round && !cleared && S.round.phase === "play" && !vis ? S.round : null, h = r?.hands[r.active];
  let pick = "hard";
  if (h && !h.done) {
    const up = value(r.dealer[0]), { total, soft } = handOf(h.cards);
    const kind = isPair(h.cards) && r.hands.length < S.rules.maxHands ? "pairs" : soft ? "soft" : "hard";
    pick = { kind, up, row: kind === "pairs" ? value(h.cards[0]) : kind === "soft" ? Math.max(13, total) : Math.min(17, Math.max(8, total)) };
  }
  box.innerHTML = chartHtml(pick, S.rules);
  // a phone held sideways hasn't the height for it
  if (box.scrollHeight > box.clientHeight + 2) box.hidden = true;
}
/** The felt's words fitted to their arcs, squeezed where a theme's lettering runs longer than the arc. */
function fitArc() {
  for (const [text, arc] of [["arcText1", "bjArc1"], ["arcText2", "bjArc2"]]) {
    const t = $(text), room = $(arc).getTotalLength() * 0.96;
    t.removeAttribute("textLength");
    if (t.getComputedTextLength() > room) { t.setAttribute("textLength", room.toFixed(1)); t.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
  }
}
const PLAYS = [["double", "Double", "chips beside"], ["split", "Split", "chips beside"], ["surrender", "Surrender", "say it"], ["hit", "Hit", "tap the felt"], ["stand", "Stand", "wave a hand"]];
/** The decision in front of you, so a hint lasts only until you play. */
const hintKey = () => { const r = S.round; return r ? `${r.phase}|${r.active}|${r.dealer[0]}|${r.hands.map(h => h.cards.join()).join(";")}` : ""; };
/** Whether the chart's play is showing: always on Always, on Hints and Check once asked for this decision. */
const advised = () => opts.coach === "on" || (opts.coach !== "off" && hinted !== null && hinted === hintKey());
const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The coach's panel at the head of the rail: the chart's play when it's showing, else your last play judged, with Hint and Why. */
function drawCoach() {
  const box = $("coach"), mode = opts.coach;
  box.hidden = mode === "off";
  if (mode === "off") return;
  const lk = inPlay() && !busy && !vis ? look(S) : null, shown = lk && advised(), judged = mode !== "hints" && last && !cleared;
  const buttons = [];
  let text = "";
  if (shown) { text = `<b>${esc(lk.short)}</b>`; buttons.push(`<button type="button" data-why="now">Why</button>`); }
  else {
    if (judged) { text = `<span class="${last.ok ? "good" : "bad"}">${esc(last.say)}</span>`; buttons.push(`<button type="button" data-why="last">Why</button>`); }
    if (lk && mode !== "on") buttons.push(`<button type="button" data-hint="1">Hint</button>`);
  }
  box.innerHTML = `<span class="bj-coach-text">${text}</span><span class="bj-coach-btns">${buttons.join("")}</span>`;
}
/** The coach's sheet: the hand, why the chart plays as it does, and every play open with what it is worth on average. */
function showWhy(lk, play, verdict) {
  $("coachBody").innerHTML = `<h3>${esc(lk.hand[0].toUpperCase() + lk.hand.slice(1))}</h3>
    ${verdict ? `<p class="bj-verdict ${verdict.ok ? "good" : "bad"}">${esc(verdict.say)}</p>` : ""}
    <p>${esc(lk.why)}</p>
    <ul class="bj-rows">${lk.rows.map(x => `<li class="${x.best ? "best" : ""}${x.play === play ? " mine" : ""}"><b>${esc(x.name)}${x.best ? "<em>chart</em>" : ""}${x.play === play ? "<em>yours</em>" : ""}</b><span class="ev">${x.ev == null ? "" : evText(x.ev)}</span><small>${esc(x.note)}</small></li>`).join("")}</ul>
    <p class="bj-foot">Averages are in bets, over the cards still to come, for hands like this one, playing the best from here.</p>`;
  if (!$("coachDlg").open) $("coachDlg").showModal();
}
function drawRail() {
  drawCoach();
  const playing = inPlay() && !busy;
  $("betting").hidden = inPlay();
  $("plays").hidden = !inPlay();
  if (!inPlay()) {
    $("chips").innerHTML = chipsHtml(CHIPS, opts.chip);
    $("clearBtn").disabled = busy || !onTable();
    $("rebetBtn").disabled = busy || !S.lastBet || (S.bet === S.lastBet && S.side.over === S.lastSide.over && S.side.under === S.lastSide.under);
    $("dealBtn").disabled = busy || !!betProblem(S.bet, S.balance, S.side);
    $("dealBtn").textContent = onTable() ? `Deal ${short(onTable())}` : "Deal";
    return;
  }
  const open = playing ? plays(S) : new Set(), tip = playing && advised() ? advice(S) : null, r = S.round;
  if (r.phase === "insurance") {
    const bj = isBlackjack(r.hands[0].cards);
    $("plays").innerHTML = `<p class="bj-ask">${bj ? "You have blackjack and the dealer shows an ace: even money?" : "The dealer shows an ace: insurance, half your bet, pays 2 to 1 if it's a blackjack"}</p>
      <div class="bj-two"><button type="button" class="cs-btn${tip === "insure" ? " chart" : ""}" data-play="insure" ${open.has("insure") ? "" : "disabled"}>${bj ? "Even money" : `Insure ${short(r.hands[0].stake / 2)}`}</button>
      <button type="button" class="cs-btn${tip === "noInsure" ? " chart" : ""}" data-play="noInsure" ${open.has("noInsure") ? "" : "disabled"}>${bj ? "No: play it" : "No insurance"}</button></div>`;
    return;
  }
  $("plays").innerHTML = `<div class="bj-three">${PLAYS.slice(0, 3).map(btn).join("")}</div><div class="bj-two">${PLAYS.slice(3).map(btn).join("")}</div>`;
  function btn([id, name, how]) {
    return `<button type="button" class="cs-btn${id === "stand" || id === "hit" ? " big" : ""}${tip === id ? " chart" : ""}" data-play="${id}" ${open.has(id) ? "" : "disabled"}><b>${name}</b><small>${how}</small></button>`;
  }
}
function render() { drawStrip(); drawFelt(); drawRail(); fitArc(); }

// ---------- dealing out ----------
/** Plays the engine's events out on the felt, a card at a time, from what was showing before. */
async function playOut(events) {
  const r = S.round, count = { dealer: 0, hands: r.hands.map(() => 0) };
  for (const e of events) if (e.to === "dealer") count.dealer++; else count.hands[e.hand]++;
  vis = { dealer: r.dealer.length - count.dealer, hands: r.hands.map((h, i) => h.cards.length - count.hands[i]) };
  drawFelt();
  for (const e of events) {
    if (e.to === "dealer") vis.dealer++; else vis.hands[e.hand]++;
    drawFelt();
    const key = e.to === "dealer" ? `d${vis.dealer - 1}` : `h${e.hand}-${vis.hands[e.hand] - 1}`, el = $("felt").querySelector(`[data-k="${key}"]`);
    await animate(el, [{ transform: "translateY(-1.5em)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: opts.fast ? 110 : 200, easing: "ease-out" });
    await wait(opts.fast ? 60 : e.to === "dealer" && events.indexOf(e) > 2 ? 380 : 140);
  }
  vis = null;
}
async function run(step) {
  if (busy) return;
  busy = true;
  drawRail();
  try {
    const before = S, res = step(S);
    S = res.state;
    cleared = false;
    save();
    await playOut(res.events);
    if (S.round.phase === "over" && before.round?.phase !== "over") { announce(); roundOver("blackjack"); }
  } catch (e) { toast(e.message); }
  busy = false;
  render();
}
/** The round's end: the dealer's hand and what you came away with. */
function announce() {
  const r = S.round, res = r.result, d = handOf(r.dealer);
  const dealer = res.dealerBJ ? "Dealer blackjack" : d.bust ? `Dealer busts with ${d.total}` : `Dealer ${d.total}`;
  $("call").innerHTML = `<span>${dealer}</span><small>${res.insurance ? `insurance ${res.insurance > 0 ? "+" : "−"}${short(Math.abs(res.insurance))} · ` : ""}${res.net > 0 ? `+${hk(res.net)}` : res.net < 0 ? `−${hk(res.net)}` : "even"}</small>`;
  if (!S.rules.continuous && S.pos >= S.cut) toast("The cut card's out: a fresh shoe for the next round");
  if (S.balance < MIN) toast("Below the table's minimum: Menu tops you up");
}

// ---------- your money and your plays ----------
/** The chip picked, onto the circle or a side bet. */
function addChip(spot) {
  if (busy || inPlay()) return;
  if (!cleared) { cleared = true; $("call").innerHTML = ""; }
  const v = opts.chip, now = spot === "main" ? S.bet : S.side[spot], most = spot === "main" ? MAX : SIDE.max;
  if (now + v > most) { toast(`${spot === "main" ? "The table" : "Over/Under 13"} takes up to ${hk(most)}`); return; }
  if (spot !== "main" && S.side[spot === "over" ? "under" : "over"]) { toast("Over or Under 13, not both"); return; }
  if (onTable() + v > S.balance) { toast("That's more than you hold"); return; }
  if (spot === "main") S.bet += v;
  else S.side = { ...S.side, [spot]: now + v };
  save();
  render();
}
function dealNow() {
  const problem = betProblem(S.bet, S.balance, S.side);
  if (problem) { toast(problem); return; }
  $("call").innerHTML = "";
  last = null;
  hinted = null;
  run(deal);
}
function playNow(play) {
  if (busy || !inPlay()) return;
  // judged on the decision as it stood, before the play changes it
  const lk = opts.coach === "off" ? null : look(S);
  if (lk && opts.coach !== "hints") {
    const v = judge(lk, play);
    last = { look: lk, play, ok: v.ok, say: v.say };
    if (opts.coach === "on" && !v.ok) toast(v.line);
  }
  hinted = null;
  run(s => act(s, play));
}

// ---------- the menu, the course, the rules ----------
function showRules() {
  $("rulesBody").innerHTML = rulesHtml(S.rules);
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
const course = createCourse({ id: "blackjack", course: COURSE, stage: blackjackStage(), cls: "bj", inFrame: IN_FRAME, onRules: showRules, onPlay: () => {} });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (S.balance < START) play.append(action(`Top up to ${hk(START)}`, () => { if (inPlay()) return; S.balance = START; S.toppedUp++; save(); render(); }, "primary"));
  const cp = progressOf("blackjack", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn the floor: the plays, the chart, the table", () => course.open()), action("Blackjack on one page", showRules, "link"));
  const st = part(body, "settings");
  st.append(choice("Coach", COACH, opts.coach, v => { opts.coach = v; hinted = null; last = null; saveOpts(); render(); }));
  st.append(toggle("Quick dealing", opts.fast, on => { opts.fast = on; saveOpts(); }));
  part(body, "about").append(line(`${S.rounds} round${S.rounds === 1 ? "" : "s"}; you hold ${hk(S.balance)}${S.toppedUp ? `, topped up ${S.toppedUp} time${S.toppedUp === 1 ? "" : "s"}` : ""}. Playing the chart, the table keeps ${(strategyFor(S.rules).edge * 100).toFixed(2)}% of what you bet. Play money: nothing real is staked.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "blackjack");
document.querySelector(".bj-mark").innerHTML = APPS.find(a => a.id === "blackjack")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("chips").addEventListener("click", e => { const b = e.target.closest("[data-chip]"); if (!b) return; opts.chip = Number(b.dataset.chip); saveOpts(); drawRail(); });
$("hands").addEventListener("click", e => { const b = e.target.closest("[data-spot]"); if (b) addChip(b.dataset.spot); });
$("clearBtn").addEventListener("click", () => { if (busy || inPlay()) return; cleared = true; $("call").innerHTML = ""; S.bet = 0; S.side = { over: 0, under: 0 }; save(); render(); });
$("rebetBtn").addEventListener("click", () => {
  if (busy || inPlay() || !S.lastBet) return;
  if (S.lastBet + S.lastSide.over + S.lastSide.under > S.balance) { toast("Not enough left for the same bets"); return; }
  cleared = true;
  $("call").innerHTML = "";
  S.bet = S.lastBet;
  S.side = { ...S.lastSide };
  save();
  render();
});
$("dealBtn").addEventListener("click", dealNow);
$("coach").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || busy) return;
  if (b.dataset.hint) { hinted = hintKey(); drawRail(); drawChart(); }
  else if (b.dataset.why === "now") { const lk = inPlay() ? look(S) : null; if (lk) showWhy(lk); }
  else if (b.dataset.why === "last" && last) showWhy(last.look, last.play, last);
});
$("coachClose").addEventListener("click", () => $("coachDlg").close());
$("plays").addEventListener("click", e => { const b = e.target.closest("[data-play]"); if (b && !b.disabled) playNow(b.dataset.play); });
new ResizeObserver(() => { fitCards(); drawChart(); }).observe($("felt"));

// for tests and debugging
window.__blackjack = { get state() { return S; }, set state(s) { S = s; render(); }, dealNow, playNow, course, get coach() { return { opts, last, hinted }; } };

S = read(RUN, null);
if (!valid(S)) S = newGame(Math.floor(Math.random() * 2 ** 31));
cleared = !S.round || S.round.phase === "over";
save();
[$("arcText1").textContent, $("arcText2").textContent] = feltWords(S.rules);
render();
document.fonts?.ready.then(fitArc);
