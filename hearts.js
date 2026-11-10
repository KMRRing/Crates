// Hearts against three computer players, or at a table with friends each on their own phone. The rules are
// hearts-rules.js's, the computer players hearts-bot.js's, the running seats.js's (seats-ui.js). This page draws the table:
// the others round it with their cards left, score and the points they've taken this hand, the trick laid in a cross at its
// middle, and your cards along the foot. The pass is three cards picked and sent with one button; in the play a tap picks
// a card up and a second tap (or Play) plays it, the cards you may not play dimmed.
import { rules, legalCards, whyNot, sumPoints, trickWinner, pointsOf, cardName, RANKS, TARGETS, suitOf, rankOf } from "./hearts-rules.js";
import { LEVEL_NAMES } from "./hearts-bot.js";
import { seatPage } from "./seats-ui.js";
import { createCourse, progressOf } from "./course.js";
import { cardStage } from "./course-cards.js";
import { COURSE, judge, hold, face as courseFace, label as courseLabel, withLabels } from "./hearts-course.js";
import { cardHtml, backHtml } from "./cards.js";
import { plateHtml, drawHandBox } from "./cardroom.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, action, line, onPause } from "./menu.js";
import { ramp } from "./ramp.js";
import { tableView } from "./table3d-view.js";
import { createHearts3d, plateOf } from "./hearts-3d.js";
import { seatRounds } from "./random.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "hearts:opts", RECORD = "hearts:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Hugo", "Mira", "Otto", "Lena"];                         // the computer players, by seat

let opts = { level: "hard", to: 100, moon: "add", ...read(OPTS, {}) };
if (!TARGETS.includes(opts.to)) opts.to = 100;
// Korbi, 4 November 2026: the menu is the minimum it needs to be. The game is to 100 and a shot moon adds 26 to the others, whatever an older save chose (a game in hand
// keeps its own rules, in its state). The computer's strength is the hidden ramp, its first step the old saved choice (a
// lesson's game plays Easy, once).
const OLD_LEVEL = opts.level;
Object.assign(opts, { to: 100, moon: "add" });
let lesson = false, lessonNext = false;
const levelNow = () => (lesson ? "easy" : ramp("hearts", LEVEL_NAMES.map(([k]) => k), { start: OLD_LEVEL }));
const saveOpts = () => write(OPTS, opts);
const gameOptions = () => ({ to: opts.to, moon: opts.moon });

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

const face = id => ({ rank: RANKS[rankOf(id)], suit: suitOf(id) });
const cardMarkup = (id, cls = "", data = {}) => cardHtml(face(id), { cls, data, label: cardName(id) });
const DIR_WORD = { left: "left", right: "right", across: "across", hold: "no pass" };
const DIR_ARROW = { left: "←", right: "→", across: "↑" };

let V = null, sel = new Set(), selFor = "", page = null;
const randomRounds = seatRounds("hearts", ["shown"]);   // random mode's round: a hand
page = seatPage({
  rules, id: "hearts", app: 1, pace: s => (s?.step === "pass" ? 300 : 760), botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => levelNow(), voice: () => false,
  onView: v => { V = v; draw(); randomRounds(v); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;
const who = seat => (isMe(seat) ? "You" : nameOf(seat));
/** "You take" / "Mira takes": a verb that agrees with the seat's name. */
const does = (seat, you, other) => `${who(seat)} ${isMe(seat) ? you : other}`;

/** Where each seat sits round the table, from yours: the next seat to your left (play goes round to the left), then across. */
function placeOf(seat) {
  const k = (seat - (V.seat ?? 0) + 4) % 4;
  return ["at-me", "at-left", "at-top", "at-right"][k];
}

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) { $("table").innerHTML = ""; $("hand").innerHTML = ""; $("status").textContent = ""; $("strip").textContent = ""; drawBar(); return; }
  const s = v.state;
  // the picked cards stay picked while the others play; a new hand, a pass done or a move of yours clears them
  const key = `${v.G.seq}:${s.deal}:${s.step === "pass" ? "p" : "q"}:${(s.hands[v.seat ?? 0] || []).length}`;
  if (key !== selFor) { selFor = key; sel = new Set(); }
  // the brass plate across the top (cardroom.js): the hand, every seat's score, the target and the hearts (the pass is the button's)
  $("strip").innerHTML = plateHtml({ title: `<small>Hand</small><b>${s.deal}</b>`,
    items: [0, 1, 2, 3].map(i => ({ k: isMe(i) ? "You" : nameOf(i), v: s.scores[i], on: s.step === "play" && s.turn === i })),
    tail: `to ${s.opts.to}<br>♥ ${s.broken ? "broken" : "unbroken"}` });
  drawTable(v);
  drawHand(v);
  drawBar();
}

// ---------- the table ----------
const shownStep = s => s.step === "shown" || s.step === "over";
const trickOf = (s, seat) => s.trick.plays.find(p => p.seat === seat)?.card;
const takenBy = (s, seat) => sumPoints(s.took[seat]);
/** Who took the trick just played (while it's shown) or the one before it (the lead, once cleared). */
const trickWinnerNow = s => (s.step === "trick" ? trickWinner(s.trick.plays) : null);

function seatHtml(v, seat) {
  const s = v.state, place = placeOf(seat), turn = s.step === "play" && s.turn === seat, taken = takenBy(s, seat);
  let tag = "";
  if (s.step === "pass") tag = s.give[seat].length === 3 ? `<span class="hr-tag ok">passed</span>` : isMe(seat) ? "" : `<span class="hr-thinking">choosing</span>`;
  else if (turn && !isMe(seat)) tag = `<span class="hr-thinking">thinking</span>`;
  const back = place === "at-me" ? "" : `<span class="hr-n" title="Cards left">${backHtml("tiny")}<b>${s.hands[seat].length}</b></span>`;
  return `<div class="hr-seat ${place}${turn ? " turn" : ""}${trickWinnerNow(s) === seat ? " wins" : ""}">
    <div class="hr-who"><b>${esc(who(seat))}</b>${back}<span class="hr-pts" title="Points taken this hand" style="${taken ? "" : "visibility:hidden"}">+${taken}</span></div>
    ${place === "at-me" ? "" : `<div class="hr-play">${tag || "&nbsp;"}</div>`}</div>`;
}

function centreHtml(v) {
  const s = v.state, me = v.seat ?? 0;
  if (s.step === "pass") {
    const done = s.give.filter(g => g.length === 3).length;
    return `<div class="hr-centre"><div class="hr-pass"><span class="arrow" aria-hidden="true">${DIR_ARROW[s.dir] || ""}</span><span class="word">Pass ${DIR_WORD[s.dir]}</span><span class="done">${done} of 4 have passed</span></div></div>`;
  }
  if (shownStep(s) && s.result) {
    const r = s.result, rows = [0, 1, 2, 3].map(i => `<li class="${isMe(i) ? "me " : ""}${r.delta[i] === 0 ? "zero" : ""}"><span class="nm">${esc(who(i))}</span><span class="hp">${r.delta[i] > 0 ? "+" : ""}${r.delta[i]}</span><b>${s.scores[i]}</b></li>`).join("");
    const moon = r.moon >= 0 ? `<p class="hr-moon">${esc(does(r.moon, "shoot", "shoots"))} the moon!</p>` : "";
    return `<div class="hr-centre"><div class="hr-result"><h3>Hand ${s.result.deal}</h3>${moon}<ol>${rows}</ol></div></div>`;
  }
  const win = trickWinnerNow(s);
  const slot = seat => {
    const c = trickOf(s, seat), k = (seat - me + 4) % 4, cls = ["s-me", "s-left", "s-top", "s-right"][k];
    return `<div class="hr-slot ${cls}${win === seat ? " win" : ""}">${c != null ? cardMarkup(c) : ""}</div>`;
  };
  return `<div class="hr-centre"><div class="hr-trick">${[0, 1, 2, 3].map(slot).join("")}</div></div>`;
}

const view = tableView("hearts");                                  // Menu, View: the flat table or the 3D one (hearts-3d.js)
let three = null;

function resultLine(s) {
  if (!shownStep(s) || !s.result) return "";
  const r = s.result;
  return r.moon >= 0 ? `${does(r.moon, "shoot", "shoots")} the moon!` : "Hand over";
}

function drawTable(v) {
  const s = v.state, table = $("table");
  if (view.get() === "3d") {
    table.classList.add("hr3");
    three ||= createHearts3d(table, { quiet: () => IN_FRAME });
    const me = v.seat ?? 0, win = trickWinnerNow(s), res = shownStep(s) ? s.result : null;
    const plates = [0, 1, 2, 3].map(seat => plateOf({
      name: who(seat), seat, mine: isMe(seat), turn: s.step === "play" && s.turn === seat, count: s.hands[seat].length, score: s.scores[seat], taken: takenBy(s, seat),
      word: s.step === "pass" && s.give[seat].length === 3 ? "Passed" : res ? `${res.delta[seat] > 0 ? "+" : ""}${res.delta[seat]}` : "",
      think: (s.step === "play" && s.turn === seat && !isMe(seat)) || (s.step === "pass" && s.give[seat].length < 3 && !isMe(seat)), win: win === seat || (res && res.moon === seat), over: !!res,
    }));
    const lanes = [0, 1, 2, 3].map(seat => { const c = trickOf(s, seat); return c != null ? cardMarkup(c, win === seat ? "lit" : "") : ""; });
    const note = s.step === "pass" ? "" : resultLine(s);
    three.draw({ me, plates, lanes, top: `<p class="hr-note">${esc(note)}</p>`, winner: !s.trick.plays.length && s.done > 0 ? s.trick.lead : null });
    return;
  }
  if (three) { three.dispose(); three = null; table.classList.remove("hr3"); }
  table.innerHTML = [0, 1, 2, 3].filter(seat => placeOf(seat) !== "at-me").map(seat => seatHtml(v, seat)).join("") + centreHtml(v) + seatHtml(v, v.seat ?? 0);
}

// ---------- your cards ----------
const myTurn = v => !!(v?.G && v.seat != null && v.state.step === "play" && v.state.turn === v.seat);
function drawHand(v) {
  const box = $("hand");
  if (v.seat == null) { box.innerHTML = `<p class="hr-watch">Watching: you sit down at the next game.</p>`; box.style.height = ""; return; }
  const s = v.state, hand = s.hands[v.seat], mine = myTurn(v), legal = mine ? new Set(legalCards(s, v.seat)) : null;
  const gave = s.step === "pass" && s.give[v.seat].length === 3, got = s.step !== "pass" && s.done < 3 ? new Set(s.recv[v.seat]) : null;
  box.classList.toggle("turn", mine);
  // Guandan's fan (cardroom.js): a run to a suit, the suits alternating black and red, the highest first
  const cols = [3, 2, 1, 0].map(su => hand.filter(id => suitOf(id) === su).sort((x, y) => rankOf(y) - rankOf(x))).filter(c => c.length);
  drawHandBox(box, { cols, fan: true, face, label: cardName,
    classes: id => [sel.has(id) && "sel", gave && s.give[v.seat].includes(id) && "sel", legal && !legal.has(id) && "no", got?.has(id) && "recv"].filter(Boolean).join(" ") });
}
$("hand").addEventListener("click", async e => {
  const c = e.target.closest(".cd[data-id]");
  if (!c || !V?.G || V.seat == null) return;
  const id = Number(c.dataset.id), s = V.state;
  if (s.step === "pass") {
    if (s.give[V.seat].length === 3) return;
    if (sel.has(id)) sel.delete(id);
    else if (sel.size >= 3) { toast("Pass three cards: put one back first"); return; }
    else sel.add(id);
    draw();
    return;
  }
  if (!myTurn(V)) { if (s.step === "play") toast(`${nameOf(s.turn)} to play`); return; }
  const why = whyNot(s, V.seat, id);
  if (why) { toast(why); return; }
  if (sel.has(id)) { await doPlay(id); return; }
  sel = new Set([id]);
  draw();
});

async function doPlay(id) {
  const why = await page.move({ t: "play", card: id });
  if (why) { toast(why); return; }
  sel = new Set();
  draw();
}

function drawBar() {
  const bar = $("bar"), v = V;
  if (!v?.G) { bar.innerHTML = `<button type="button" class="btn primary hr-go" data-act="new">New game</button>`; return; }
  const s = v.state, seated = v.seat != null;
  if (s.step === "over") { bar.innerHTML = page.host ? `<button type="button" class="btn primary hr-go" data-act="new">New game</button>` : ""; return; }
  if (s.step === "shown") { bar.innerHTML = seated || page.host ? `<button type="button" class="btn primary hr-go hr-main" data-act="next">Next hand</button>` : ""; return; }
  if (!seated) { bar.innerHTML = ""; return; }
  if (s.step === "pass") {
    const gave = s.give[v.seat].length === 3;
    bar.innerHTML = `<button type="button" class="btn primary hr-go hr-main" data-act="give" ${!gave && sel.size === 3 ? "" : "disabled"}>${gave ? "Passed" : sel.size === 3 ? `Pass 3 ${DIR_WORD[s.dir]}` : `Pass ${DIR_WORD[s.dir]} · ${sel.size} of 3`}</button>`
      + (sel.size && !gave ? `<button type="button" class="icon-btn hr-clear" data-act="clear" aria-label="Put them back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : "");
    return;
  }
  const mine = myTurn(v), pick = [...sel][0], ready = mine && pick != null && !whyNot(s, v.seat, pick);
  bar.innerHTML = `<button type="button" class="btn primary hr-go hr-main" data-act="play" ${ready ? "" : "disabled"}>${ready ? `Play ${esc(cardName(pick))}` : "Play"}</button>`;
}
$("bar").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "clear") { sel = new Set(); draw(); return; }
  if (act === "next") { const why = await page.move({ t: "next" }); if (why) toast(why); return; }
  if (act === "give") {
    const why = await page.move({ t: "give", cards: [...sel] });
    if (why) { toast(why); return; }
    sel = new Set();
    draw();
    return;
  }
  if (act === "play" && sel.size) await doPlay([...sel][0]);
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("hearts", won);
  if (!page.atTable && !lesson) { levelNow(); won ? ramp.won(true) : ramp.lost(); }
  setTimeout(() => { if (V?.over) showEnd(V); }, 1200);
}
function showEnd(v) {
  const s = v.state, order = [0, 1, 2, 3].sort((a, b) => s.scores[a] - s.scores[b]);
  $("endHead").textContent = s.winners.includes(v.seat) ? "You win" : `${s.winners.map(who).join(" and ")} wins`;
  const moons = i => s.log.filter(e => e.moon === i).length;
  $("endBody").innerHTML = `<ol class="hr-standings">${order.map(i => `<li class="${s.winners.includes(i) ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(who(i))}</span><span class="sub">${moons(i) ? `shot the moon ${moons(i)}×` : ""}</span><b>${s.scores[i]}</b></li>`).join("")}</ol>
    <p class="hr-end-note">${s.log.length} hands, played to ${s.opts.to}. The fewest points wins.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  if ($("endDlg").open) $("endDlg").close();
  lesson = lessonNext; lessonNext = false;
  sel = new Set();
  page.deal(gameOptions(), 4);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Hearts is a trick-taking game for four, each for themselves: take as few points as you can. Every heart is a point and the Q♠ is thirteen, 26 in a hand.</p>
    <p><b>The pass.</b> Each hand begins with everyone passing three cards face down: to the left in the first hand, to the right in the second, across in the third, and in the fourth none; then round again. Pick the three, tap Pass. You see the three you were passed marked on the foot of those cards.</p>
    <p><b>The play.</b> The holder of the 2♣ leads it. Play goes round to the left and you must follow the suit led if you can; if you can't, play anything. The highest card of the suit led takes the trick and leads the next. The first trick has no points in it unless you can't help it (a hand of nothing but hearts and the Q♠). Hearts can't be led until one has been played on an earlier trick (they are "broken"), unless you hold nothing else. The Q♠ doesn't break them.</p>
    <p><b>Scoring.</b> At the end of a hand each player takes the points in their tricks. The game goes on until someone reaches 100 points (Menu: 50, 100 or 150), and then the lowest score wins; a tie for the lowest plays on.</p>
    <p><b>Shooting the moon.</b> Take every heart and the Q♠ in one hand and you score nothing while the other three score 26 each (Menu can turn that into 26 off your own score).</p>`;
  $("rulesDlg").showModal();
}

// ---------- the course ----------
// Learn (Menu): the game taught from nothing in this engine's variant (hearts-course.js) on the course's sheet
// (course.js); its last lesson starts a game against Easy.
const course = createCourse({
  id: "hearts", course: COURSE, stage: withLabels(cardStage({ face: courseFace, label: courseLabel, judge, hold })), cls: "hr", inFrame: IN_FRAME, onRules: showRules,
  onPlay: () => {
    if (page.atTable) { toast("Your table plays on: try a game against Easy when you're back to solo"); return; }
    lessonNext = true;
    newGame();
  },
});

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const cp = progressOf("hearts", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Hearts, from the rules", () => course.open()));
  const set = part(body, "settings");
  const keep = () => saveOpts();
  set.append(view.choice(() => draw()));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("hearts:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "hearts");
document.querySelector(".hr-mark").innerHTML = APPS.find(a => a.id === "hearts")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", () => draw());
onPause(() => three?.pause(true), () => three?.pause(false));
window.__hearts = { page, course, get view() { return V; }, opts, get sel() { return sel; } };
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
