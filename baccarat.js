// Baccarat: a Macau table, as at the Venetian. Chips on the layout (Player and Banker, the Tie, and whichever of Sands
// China's side bets the menu puts on it, to match the table in front of you), Deal, and the hand comes out as the dealer
// deals it: Player, Banker, Player, Banker, the third cards sideways by the tableau; the call, the payouts, and the hand
// on the roads of the scoreboard over the table. With Squeeze on, the cards of the side you're on come face down for
// you to turn, as the biggest bet on a side squeezes them. Learn, in the header, is the course on everything the floor
// shows. The rules are baccarat-engine.js's, the roads drawn by baccarat-roads.js, the layout by baccarat-stage.js; this
// file deals each hand out on the page and keeps the game.
import { START, MIN, MAX, SIDE_MAX, CHIPS, RANKS, SPOTS, SIDES, MAIN, rankOf, suitOf, total, newGame, upgrade, changeShoe, deal, betsProblem, counts } from "./baccarat-engine.js";
import { scoreboard, askMarks } from "./baccarat-roads.js";
import { cardHtml } from "./cards.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { part, action, line, choice, toggle, ticks } from "./menu.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE } from "./baccarat-course.js";
import { baccaratStage, layoutHtml, paysAt } from "./baccarat-stage.js";
import { IN_FRAME } from "./suite.js";
import { roundOver } from "./random.js";
import { squeeze } from "./baccarat-squeeze.js";
import { rulesHtml } from "./baccarat-rules.js";
import { hk, short, chipsHtml, toast } from "./casino.js";

const $ = id => document.getElementById(id);
const RUN = "baccarat:run", OPTS = "baccarat:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { if (!IN_FRAME) try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const animate = (node, frames, o) => (node?.animate ? node.animate(frames, { fill: "both", ...o }).finished.catch(() => {}) : Promise.resolve());

let S = null;                       // the game (baccarat-engine.js's), as saved
// the side bets on the layout (SIDES' ids): by default those the Venetian's main floor has carried since April 2026
const SIDE_ROOM = 5;                // spots beside the Tie: two rows of three
const room = ids => SIDES.filter(sd => ids.includes(sd.id)).reduce((a, sd) => a + sd.spots.length, 0);
/** Side bets as kept: only sets a table has, and no more than the layout holds (the last ones go). */
function fitSides(ids) {
  let keep = Array.isArray(ids) ? ids.filter(id => SIDES.some(sd => sd.id === id)) : [];
  while (room(keep) > SIDE_ROOM) keep = keep.slice(0, -1);
  return keep;
}
const opts = { squeeze: false, chip: 1000, sides: ["pairsplus", "lucky6", "six", "monkey"], ...read(OPTS, {}) };
opts.sides = fitSides(opts.sides);
let playing = false;                // a hand being dealt out
let shown = null;                   // the last hand on the felt: { hand, bets (on it), open (cards turned), settled, done }
let asking = null;                  // the ask button held: "B" or "P", the scoreboard showing where it would go

const valid = g => g && g.v === 2 && Array.isArray(g.shoe) && g.shoe.length === 416 && Array.isArray(g.results);
function save() { write(RUN, S); }
function saveOpts() { write(OPTS, opts); }
/** The spots on the layout now: Player, Banker, the Tie, and the side bets of the sets chosen. */
const spotsHere = () => ["player", "banker", "tie", ...SIDES.filter(sd => opts.sides.includes(sd.id)).flatMap(sd => sd.spots)];
const spotName = id => SPOTS.find(sp => sp.id === id).name;

// ---------- drawing ----------
function drawStrip() {
  $("balance").textContent = S.balance.toLocaleString("en-GB");
  $("limits").textContent = `${S.table === "commission" ? "佣金" : "免佣"} ${short(MIN)}–${short(MAX)}`;
  $("limits").title = `${S.table === "commission" ? "Commission" : "No commission"}: Player and Banker HK$${MIN.toLocaleString("en-GB")} to HK$${MAX.toLocaleString("en-GB")}, the side bets to HK$${SIDE_MAX.toLocaleString("en-GB")}`;
  $("shoe").textContent = `Shoe ${S.shoeNo} · ${S.last ? "last hand" : `hand ${S.results.length + 1}`}`;
}
/** The scoreboard: the roads, the shoe's counts, and the ask buttons with what each derived road would show next. */
function drawBoard() {
  // as many squares across as fit: fewer held sideways (the board is a column), more on a short phone (less height)
  const wide = matchMedia("(orientation: landscape) and (min-width: 700px)").matches, short = matchMedia("(max-height: 760px)").matches;
  $("roads").innerHTML = scoreboard(S.results, { w: wide ? 22 : short ? 28 : 26, bead: 6, flash: asking });
  const c = counts(S.results);
  $("counts").innerHTML = `<span class="b">莊<b>${c.B}</b></span><span class="p">閒<b>${c.P}</b></span><span class="t">和<b>${c.T}</b></span><span>莊對<b>${c.bp}</b></span><span>閒對<b>${c.pp}</b></span>`;
  $("counts").setAttribute("aria-label", `This shoe: Banker ${c.B}, Player ${c.P}, Tie ${c.T}, Banker pairs ${c.bp}, Player pairs ${c.pp}`);
  for (const side of ["B", "P"]) {
    const b = $(`ask${side}`);
    b.querySelector(".bc-ask-marks").innerHTML = askMarks(S.results, side);
    b.setAttribute("aria-pressed", String(asking === side));
  }
}
const face = id => ({ rank: RANKS[rankOf(id)], suit: suitOf(id) });
const cardName = id => `${RANKS[rankOf(id)]}${"♦♣♥♠"[suitOf(id)]}`;
/** The two hands on the felt: the cards turned so far (face down while they wait for a squeeze), each hand's total. */
function drawHands() {
  for (const side of ["player", "banker"]) {
    const box = $(side === "player" ? "pcards" : "bcards"), cards = shown?.hand[side] || [];
    box.innerHTML = cards.map((id, k) => {
      const open = shown.open.includes(`${side}${k}`), cls = `${k === 2 ? "third" : ""}${!open && shown.squeeze?.includes(`${side}${k}`) ? " squeeze" : ""}`.trim();
      if (!shown.dealt.includes(`${side}${k}`)) return "";
      return open ? cardHtml(face(id), { cls, data: { k: `${side}${k}` }, label: cardName(id) }) : `<span class="cd back${cls ? ` ${cls}` : ""}" data-k="${side}${k}" role="img" aria-label="A card face down"></span>`;
    }).join("");
    const turned = cards.filter((_, k) => shown?.open.includes(`${side}${k}`));
    $(side === "player" ? "ptotal" : "btotal").textContent = turned.length ? total(turned) : "";
  }
  const w = shown?.done ? shown.hand.winner : null;
  document.querySelector(".bc-hand.p").classList.toggle("won", w === "P");
  document.querySelector(".bc-hand.b").classList.toggle("won", w === "B");
  fitCards();
}
/** Cards as large as the felt allows: two and a third laid sideways across each half, within its height. */
function fitCards() {
  const box = $("pcards"), rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const size = Math.max(.6 * rem, Math.min(box.clientHeight / 3.7, box.clientWidth / 9.4, 1.9 * rem));
  for (const b of [$("pcards"), $("bcards")]) b.style.fontSize = `${size}px`;
}
/** The layout: each spot with its name, what it pays, and the chips on it (or what it won, once the hand is done). */
function drawSpots() {
  const settled = shown?.done ? shown.settled : null, res = id => settled?.lines.find(l => l.spot === id);
  $("spots").innerHTML = layoutHtml({
    table: S.table, sides: opts.sides, buttons: true, disabled: playing,
    chip: id => {
      // while a hand is dealt its bets stay on the layout; once it's done, what each made
      const r = res(id), stake = (shown && !shown.done ? shown.bets[id] : S.bets[id]) || 0;
      if (r) return `<span class="bc-stake${r.net > 0 ? " win" : ""}">${r.net > 0 ? `+${short(r.net)}` : r.net === 0 ? "push" : `−${short(r.stake)}`}</span>`;
      return stake ? `<span class="bc-stake">${short(stake)}</span>` : "";
    },
    state: id => { const r = res(id); return r ? (r.net > 0 ? " won" : r.net < 0 ? " lost" : "") : ""; },
    label: id => `${spotName(id)}, pays ${paysAt(SPOTS.find(sp => sp.id === id), S.table)}${S.bets[id] ? `, HK$${S.bets[id]} on it` : ""}`,
  });
}
function drawRail() {
  $("chips").innerHTML = chipsHtml(CHIPS, opts.chip);
  const any = Object.values(S.bets).some(v => v > 0);
  $("clearBtn").disabled = playing || !any;
  $("rebetBtn").disabled = playing || any || !Object.values(S.lastBets || {}).some(v => v > 0);
  $("dealBtn").disabled = playing || !any;
}
function render() { drawStrip(); drawBoard(); drawHands(); drawSpots(); drawRail(); }

// ---------- betting ----------
function bet(spot) {
  if (playing) return;
  if (shown?.done) { shown = null; $("call").innerHTML = ""; drawHands(); }   // a new hand's bets: the last one's cards go
  const now = S.bets[spot] || 0, onTable = Object.values(S.bets).reduce((a, v) => a + v, 0);
  if (onTable + opts.chip > S.balance) { toast("That's more than you hold"); return; }
  if ((spot === "player" && S.bets.banker) || (spot === "banker" && S.bets.player)) { toast("Player or Banker, not both"); return; }
  const cap = MAIN.has(spot) ? MAX : SIDE_MAX;
  if (now + opts.chip > cap) { toast(`${spotName(spot)} takes up to ${hk(cap)}`); return; }
  S.bets = { ...S.bets, [spot]: now + opts.chip };
  save();
  drawSpots();
  drawRail();
}
function clearBets() { if (playing) return; S.bets = {}; save(); drawSpots(); drawRail(); }
function rebet() {
  if (playing) return;
  const sum = Object.values(S.lastBets).reduce((a, v) => a + v, 0);
  if (sum > S.balance) { toast("Not enough left for the same bets"); return; }
  if (shown?.done) { shown = null; $("call").innerHTML = ""; drawHands(); }
  S.bets = Object.fromEntries(Object.entries(S.lastBets).filter(([k]) => spotsHere().includes(k)));
  save();
  drawSpots();
  drawRail();
}

// ---------- a hand ----------
/** One card out of the shoe onto the felt, then turned (or left for the reader to squeeze). */
async function lay(side, k) {
  const key = `${side}${k}`;
  shown.dealt.push(key);
  drawHands();
  const el = $(side === "player" ? "pcards" : "bcards").querySelector(`[data-k="${key}"]`);
  await animate(el, [{ transform: `translateY(-2em)${k === 2 ? " rotate(90deg)" : ""}`, opacity: 0 }, { transform: `translateY(0)${k === 2 ? " rotate(90deg)" : ""}`, opacity: 1 }], { duration: 220, easing: "ease-out" });
}
async function turn(side, k) {
  const key = `${side}${k}`;
  // your side's card: peeled by you, in the squeeze over the felt
  if (shown.squeeze?.includes(key)) await squeeze($("felt"), shown.hand[side][k], { label: `${side === "player" ? "閒 The Player's" : "莊 The Banker's"} ${["first", "second", "third"][k]} card` });
  shown.open.push(key);
  drawHands();
  const el = $(side === "player" ? "pcards" : "bcards").querySelector(`[data-k="${key}"]`), rot = k === 2 ? " rotate(90deg)" : "";
  await animate(el, [{ transform: `scaleX(0.05)${rot}` }, { transform: `scaleX(1)${rot}` }], { duration: 180, easing: "ease-out" });
}
const SIDE_ZH = { P: ["閒贏", "Player wins", "p"], B: ["莊贏", "Banker wins", "b"], T: ["和", "Tie", "t"] };
async function dealNow() {
  if (playing) return;
  const problem = betsProblem(S.bets, S.balance);
  if (problem) { toast(problem); return; }
  const before = S, r = deal(S);
  S = r.state;
  save();
  playing = true;
  // the squeeze: the cards of the side you're on (the bigger bet, if both), turned by you
  const mine = before.bets.player > 0 ? "player" : before.bets.banker > 0 ? "banker" : null;
  shown = { hand: r.hand, bets: before.bets, open: [], dealt: [], settled: r.settled, done: false, squeeze: opts.squeeze && mine ? [0, 1, 2].map(k => `${mine}${k}`) : [] };
  $("call").innerHTML = "";
  drawSpots();
  drawRail();
  // the dealer: Player, Banker, Player, Banker; the Player's two turned, then the Banker's
  for (const [side, k] of [["player", 0], ["banker", 0], ["player", 1], ["banker", 1]]) { await lay(side, k); await wait(90); }
  for (const side of ["player", "banker"]) for (const k of [0, 1]) await turn(side, k);
  if (r.hand.natural) { $("call").innerHTML = `<small>${Math.max(r.hand.pt, r.hand.bt) === 9 ? "Natural 9" : "Natural 8"}: no third cards</small>`; await wait(500); }
  for (const side of ["player", "banker"]) if (r.hand[side].length === 3) { await wait(250); await lay(side, 2); await turn(side, 2); }
  await wait(250);
  // the call and the payouts: the pairs as the scoreboard counts them, and any side bet of yours that came in
  const [zh, en, cls] = SIDE_ZH[r.hand.winner], won = r.settled.lines.filter(l => l.net > 0 && !MAIN.has(l.spot) && l.spot !== "tie" && l.spot !== "ppair" && l.spot !== "bpair").map(l => spotName(l.spot));
  const notes = [r.hand.ppair && "Player pair", r.hand.bpair && "Banker pair", ...won].filter(Boolean), net = r.settled.net;
  shown.done = true;
  playing = false;
  $("call").innerHTML = `<span class="zh ${cls}">${zh}</span>${en}${r.hand.winner === "T" ? `, ${r.hand.pt} each` : `, ${Math.max(r.hand.pt, r.hand.bt)} to ${Math.min(r.hand.pt, r.hand.bt)}`}${notes.length ? ` <small>· ${notes.join(", ")}</small>` : ""} <small>· ${net > 0 ? `+${hk(net)}` : net < 0 ? `−${hk(net)}` : "even"}</small>`;
  render();
  if (r.hand.winner === "T" && Object.keys(S.bets).length) toast(`A tie: your ${spotName(Object.keys(S.bets)[0])} bet stays. Leave it, clear it or add to it`);
  if (r.cutCame) toast("The cut card's out: one more hand, then a new shoe");
  if (r.shoeDone) {
    await wait(1400);
    S = changeShoe(S);
    save();
    shown = null;
    $("call").innerHTML = "";
    render();
    toast(`A new shoe: the first card turned is ${RANKS[rankOf(S.burn.shown)]}, so ${S.burn.count} burned`);
  }
  if (S.balance < MIN && !Object.values(S.bets).some(v => v > 0)) toast("Below the table's minimum: Menu tops you up");
  roundOver("baccarat");
}

// ---------- the ask buttons: hold (or tap) to see where the next hand would go ----------
function setAsk(side) { asking = asking === side ? null : side; drawBoard(); }

// ---------- messages, the menu, the course ----------
function showRules() {
  $("rulesBody").innerHTML = rulesHtml(S.table);
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
const course = createCourse({ id: "baccarat", course: COURSE, stage: baccaratStage(), cls: "bc", inFrame: IN_FRAME, onRules: showRules, onPlay: () => {} });
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  play.append(action("New shoe", () => { if (playing) return; S = changeShoe(S); shown = null; $("call").innerHTML = ""; save(); render(); toast(`A new shoe: ${S.burn.count} burned`); }, "primary"));
  if (S.balance < START) play.append(action(`Top up to ${hk(START)}`, () => { S.balance = START; S.toppedUp++; save(); render(); }));
  const cp = progressOf("baccarat", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn the floor: the bets, the cards, the roads", () => course.open()), action("Baccarat on one page", showRules, "link"));
  const content = part(body, "content");
  content.append(choice("Table", [["nocommission", "No commission 免佣"], ["commission", "Commission 佣金"]], S.table, v => {
    if (playing) return;
    S.table = v;
    save();
    render();
  }));
  // the side bets, as many as two rows hold: one ticked past that pushes out the earliest
  content.append(ticks("Side bets", SIDES.map(sd => [sd.id, sd.name]), opts.sides, picked => {
    const added = picked.find(id => !opts.sides.includes(id));
    let keep = picked;
    while (room(keep) > SIDE_ROOM) {
      const out = opts.sides.find(old => keep.includes(old) && old !== added);
      if (!out) break;
      keep = keep.filter(id => id !== out);
    }
    const trimmed = keep.length < picked.length;
    opts.sides = keep;
    saveOpts();
    if (!playing) {
      const off = Object.keys(S.bets).filter(id => !spotsHere().includes(id));
      if (off.length) { S.bets = Object.fromEntries(Object.entries(S.bets).filter(([id]) => spotsHere().includes(id))); save(); }
    }
    render();
    if (trimmed) openMenu();
  }));
  part(body, "settings").append(toggle("Squeeze my cards", opts.squeeze, on => { opts.squeeze = on; saveOpts(); }));
  part(body, "about").append(line(`${S.hands} hand${S.hands === 1 ? "" : "s"} dealt; you hold ${hk(S.balance)}${S.toppedUp ? `, topped up ${S.toppedUp} time${S.toppedUp === 1 ? "" : "s"}` : ""}. Play money: nothing real is staked.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "baccarat");
document.querySelector(".bc-mark").innerHTML = APPS.find(a => a.id === "baccarat")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("spots").addEventListener("click", e => { const b = e.target.closest("[data-spot]"); if (b) bet(b.dataset.spot); });
$("chips").addEventListener("click", e => { const b = e.target.closest("[data-chip]"); if (!b) return; opts.chip = Number(b.dataset.chip); saveOpts(); drawRail(); });
$("clearBtn").addEventListener("click", clearBets);
$("rebetBtn").addEventListener("click", rebet);
$("dealBtn").addEventListener("click", () => { if (!playing) dealNow(); });
$("askB").addEventListener("click", () => setAsk("B"));
$("askP").addEventListener("click", () => setAsk("P"));
addEventListener("resize", () => { drawBoard(); fitCards(); });

// for tests and debugging
window.__baccarat = { get state() { return S; }, dealNow, bet, course };

S = upgrade(read(RUN, null));
if (!valid(S)) S = newGame(Math.floor(Math.random() * 2 ** 31));
save();
render();
