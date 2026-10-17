// Big Two (鋤大D) against computer players, or at a table with friends each on their own phone. The rules and words
// are bigtwo-rules.js's, the computer players bigtwo-bot.js's, the running seats.js's (seats-ui.js), the coach
// bigtwo-think.js's (in bigtwo-worker.js, off this thread) with its words from bigtwo-coach.js. This page draws the
// table: the others round it with what each played this trick, your cards along the foot, picked by a tap; and the
// coach as you choose: a hint when you ask, a word on each move of yours it would have made otherwise, or its play at
// each of your decisions.
import { rules, check, value, rankOf, suitOf, RANKS, KIND_NAMES, PLAY_TALK, DEALS, cardName, SHOW_MS } from "./bigtwo-rules.js";
import { LEVEL_NAMES } from "./bigtwo-bot.js";
import { think, quickPlan, sameMove, BUDGET } from "./bigtwo-think.js";
import { one, playsWords, moveSaid, adviceLine, after, pts, verdict } from "./bigtwo-coach.js";
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

// the coach: off; hints, when you ask; check, a hint when you ask and a word on each move of yours it would have made
// otherwise; on (Always), its play at each of your decisions as well
const COACH = [["off", "Off"], ["hints", "Hints"], ["check", "Check"], ["on", "Always"]];
let opts = { seats: 4, level: "hard", deals: 8, suits: "hk", triples: true, top: true, talk: "yue", voice: true, sort: "rank", coach: "hints", ...read(OPTS, {}) };
if (!DEALS.includes(opts.deals)) opts.deals = 8;
if (!COACH.some(([k]) => k === opts.coach)) opts.coach = "hints";
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
// the hint: the coach's play, picked for you, and the rest of your hand split into the plays the coach counts on after
// it, in a vacuum (its plan of a hand: the fewest leads it needs): { key (the decision it was asked for), cards (the play;
// none for a pass), groups: [{ cards, kind }], r (the coach's weighing) }. It shows while the cards picked are its play.
let hinted = null;
page = seatPage({
  rules, id: "bigtwo", app: 1, pace: 950, botName: s => NAMES[s] || `Seat ${s + 1}`, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); }, onOver, toast, newGame,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat] ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;

// ---------- the coach ----------
// It thinks in a worker of its own (bigtwo-worker.js), so the table never waits on it: a hint or Always's advice in
// under a second mostly, a check a little longer. Where a browser has no worker, it thinks here, in fewer deals.
// (a partner's frame, watched from the games screen, shows their table and coaches nobody)
const coaching = () => opts.coach !== "off" && !IN_FRAME;
const speaks = () => (opts.coach === "check" || opts.coach === "on") && !IN_FRAME;
const decisionOf = v => `${v.G.seq}:${v.G.n}`;
const myTurn = v => !!(v?.G && v.seat != null && v.state.step === "play" && v.state.turn === v.seat);
let worker = null, asked = 0;
const answers = new Map();
function coachWorker() {
  if (worker === null) {
    try {
      worker = new Worker(new URL("./bigtwo-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = e => { const f = answers.get(e.data.id); answers.delete(e.data.id); f?.(e.data); };
      worker.onerror = () => { worker = false; for (const f of answers.values()) f({ error: "no worker" }); answers.clear(); };
    } catch { worker = false; }
  }
  return worker;
}
function ask(kind, state, seat, move = null) {
  const w = coachWorker();
  if (!w) {
    try { return Promise.resolve({ result: think(state, seat, { ...BUDGET.here, must: kind === "check" ? move : null }) }); }
    catch (err) { return Promise.resolve({ error: String(err) }); }
  }
  return new Promise(res => { const id = ++asked; answers.set(id, res); w.postMessage({ id, kind, state, seat, move }); });
}
// the coach's weighing of your decision now ({ key, r, state, seat }), asked for once: by a Hint, or unasked (Always);
// a decision it couldn't weigh (no answer came) is noted, so nothing waits on it
let advice = null, weighing = null, hintAsked = null, failed = null;
function weigh(v) {
  const key = decisionOf(v);
  if (advice?.key === key) return Promise.resolve(advice);
  if (weighing?.key === key) return weighing.promise;
  const state = structuredClone(v.state), seat = v.seat;
  const promise = ask("think", state, seat).then(({ result }) => {
    if (weighing?.key === key) weighing = null;
    if (!result) { failed = key; return null; }
    const a = { key, r: result, state, seat };
    if (V && decisionOf(V) === key) advice = a;
    return a;
  });
  weighing = { key, promise };
  return promise;
}
// the check's word on your last move it would have made otherwise ({ words, r, mine, state }), until a move of yours
// it agrees with; and this deal's moves of yours, each with the coach's verdict, for the review at the deal's end
let word = null, notes = [], notesDeal = 0;
async function checkMove(state, seat, move) {
  const { result } = await ask("check", state, seat, move);
  if (!result || state.deal !== V?.state?.deal) return;
  const v = verdict(result, move, state, seat, Array.from({ length: state.seats }, (_, i) => nameOf(i)));
  notes.push(v ? { mine: move, agreed: false, gap: v.gap, words: v.words } : { mine: move, agreed: true });
  word = v ? { words: v.words, r: result, mine: move, state } : null;
  draw();
}
/** Asked by Always at each of your decisions: the coach's play, its cards marked. */
function advise(v) {
  if (opts.coach !== "on" || IN_FRAME || !myTurn(v) || [advice?.key, weighing?.key, failed].includes(decisionOf(v))) return;
  weigh(v).then(a => { if (a && V && decisionOf(V) === a.key) draw(); });
}
/** A new deal: the last one's notes and word go. */
function newDeal(v) {
  if (v?.state?.deal === notesDeal || v?.state?.step !== "play") return;
  notesDeal = v.state.deal;
  notes = [];
  word = null;
}

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
  newDeal(v);
  if (advice && advice.key !== decisionOf(v)) advice = null;
  $("strip").innerHTML = `Deal <b>${s.deal}</b> of ${s.opts.deals}${s.opts.suits === "tw" ? " · ♣ lowest" : ""}`;
  drawTable(v);
  drawHand(v);
  // a coach that speaks unasked keeps its room, so the table holds its size as it speaks and falls quiet
  $("status").classList.toggle("kept", speaks() && v.seat != null);
  $("status").innerHTML = `<span>${statusLine(v)}</span>`;
  drawBar();
  advise(v);
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
/** The hint, while it stands: asked for this decision (a pass leaves the hand as it was, so the hand can't tell), and
 *  the cards picked still its play. */
const liveHint = () => (hinted && V?.G && hinted.key === decisionOf(V) && sel.size === hinted.cards.length && hinted.cards.every(c => sel.has(c)) ? hinted : null);
const GAP = .55;                                                 // between the hint's groups, in card widths' em
function drawHand(v) {
  const box = $("hand");
  if (v.seat == null) { box.innerHTML = `<p class="b2-watch">Watching: you sit down at the next game.</p>`; return; }
  // with a hint, the play first (picked, raised), then each play the rest of the hand makes, apart, every other one
  // shaded, low to high; else the hand by rank or suit
  const h = liveHint();
  const parts = h ? [sortedHand(h.cards, "rank"), ...h.groups.map(g => g.cards)].filter(g => g.length) : [sortedHand(v.state.hands[v.seat] || [], opts.sort)];
  // Always: the coach's play marked in your hand, until a Hint picks it
  const advised = !h && opts.coach === "on" && advice?.key === decisionOf(v) && advice.r.best.t === "play" ? new Set(advice.r.best.cards) : null;
  let html = "", n = 0;
  parts.forEach((cards, k) => cards.forEach((id, i) => {
    const cls = [sel.has(id) && "sel", advised?.has(id) && "advised", h && k && !i && "grp", h && (k - (h.cards.length ? 1 : 0)) % 2 === 1 && !sel.has(id) && "shade"].filter(Boolean).join(" ");
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

const WHY = ' <button type="button" class="link b2-why" data-why="1">Why?</button>';
const WAIT = '<i class="ld" aria-hidden="true"></i>The coach is weighing it…';
function statusLine(v) {
  const s = v.state, h = liveHint();
  if (h && s.step === "play" && isMe(s.turn)) {
    const kind = h.cards.length ? check(s, v.seat, h.cards)?.play?.kind : null;
    if (!h.cards.length) return `<b>Hint</b>: pass · your hand plays as ${esc(playsWords(h.groups))}${WHY}`;
    return `<b>Hint</b>: ${esc(kind ? one(kind) : "this")} · ${h.groups.length ? `then ${esc(playsWords(h.groups))}` : "and you're out"}${WHY}`;
  }
  const mine = myTurn(v), key = v.G ? decisionOf(v) : "";
  if (mine && hintAsked === key && !advice && failed !== key) return WAIT;
  // Always: the coach's play at your decision; Check (and Always between your turns): its word on your last move
  if (mine && opts.coach === "on" && !IN_FRAME && failed !== key) return advice?.key === key ? `<b>Coach</b>: ${esc(adviceLine(advice.r, advice.state, advice.seat))}${WHY}` : WAIT;
  if (word && s.step === "play" && speaks()) return `<b class="b2-miss">Coach</b> ${esc(word.words)}${WHY}`;
  if (s.step === "over") return esc(s.winners.includes(v.seat) ? "You win the game" : `${s.winners.map(nameOf).join(" and ")} ${s.winners.length > 1 ? "share it" : "wins"}`);
  if (s.step === "shown") {
    const out = esc(isMe(s.result.winner) ? "You're out first!" : `${nameOf(s.result.winner)} is out`);
    // Check and Always: how this deal's moves went against the coach's
    if (!speaks() || !notes.length) return out;
    const agreed = notes.filter(n => n.agreed).length;
    return `${out} · <b>Your play</b>: the coach agreed with ${agreed} of your ${notes.length} move${notes.length === 1 ? "" : "s"}${agreed < notes.length ? ' <button type="button" class="link b2-why" data-why="review">Where it differed</button>' : ""}`;
  }
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
    ${coaching() ? `<button type="button" class="btn b2-go" data-act="hint" ${mine ? "" : "disabled"}>Hint</button>` : ""}
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
    const key = decisionOf(V);
    hintAsked = key;
    draw();
    const a = await weigh(V);
    if (!a || !V || decisionOf(V) !== key) { draw(); return; }
    const s = a.state, m = a.r.best, cards = m.t === "play" ? m.cards : [];
    const rest = s.hands[a.seat].filter(c => !cards.includes(c)), byValue = (x, y) => value(x, s.opts) - value(y, s.opts);
    const groups = (rest.length ? quickPlan(rest, s.opts).plays : []).map(p => ({ cards: [...p.cards].sort(byValue), kind: p.kind })).sort((x, y) => byValue(x.cards[0], y.cards[0]));
    hinted = { key, cards, groups, r: a.r };
    sel = new Set(cards); draw();
    return;
  }
  const move = act === "pass" ? { t: "pass" } : { t: "play", cards: [...sel] };
  // Check and Always: the move set against the coach's from the table as it was before it
  const key = decisionOf(V), before = speaks() ? structuredClone(V.state) : null, seat = V.seat, known = advice?.key === key ? advice : null;
  const why = await page.move(move);
  if (why) { toast(why); return; }
  sel = new Set(); draw();
  if (before) {
    if (known && sameMove(known.r.best, move)) { notes.push({ mine: move, agreed: true }); word = null; draw(); }
    else checkMove(before, seat, move);
  }
});

// ---------- why: the coach's choices side by side ----------
function showWhy(which) {
  const v = V, s = v?.state;
  if (!s) return;
  let head = "The coach's choices", html = "";
  const listHtml = (r, st, seat, mine) => {
    const leading = !st.trick.last;
    const rows = r.list.slice(0, 8).map((c, i) => {
      const a = after(st.hands[seat], c.move, st.opts), you = mine && sameMove(c.move, mine);
      const then = c.move.t === "pass" ? `your hand plays as ${playsWords(a.plays)}` : a.n ? `then ${playsWords(a.plays)}` : "and you're out";
      return `<li class="${i === 0 ? "best" : ""}${you ? " mine" : ""}"><b>${esc(moveSaid(c.move, st.opts, leading))}</b>${i === 0 ? " · the coach's choice" : you ? " · yours" : ""}<br><span>${esc(then)}</span><span class="b2-pts">${esc(pts(c.mean))} a deal${c.n ? ` · ${c.n} deals` : ""}</span></li>`;
    }).join("");
    const yours = mine && !r.list.slice(0, 8).some(c => sameMove(c.move, mine)) ? r.list.find(c => sameMove(c.move, mine)) : null;
    const extra = yours ? `<li class="mine"><b>${esc(moveSaid(yours.move, st.opts, leading))}</b> · yours<span class="b2-pts">${esc(pts(yours.mean))} a deal · ${yours.n} deals</span></li>` : "";
    return `<ol class="b2-choices">${rows}${extra}</ol><p class="b2-why-note">Each choice played to the end of the deal in the same ${r.deals} deals of the cards you can't see, every seat by Medium's rules, the last few cards worked out exactly; the points are what you come out of the deal with on average (what you win going out, less what you pay).</p>`;
  };
  if (which === "review") {
    head = "Your play this deal";
    const differs = notes.filter(n => !n.agreed).sort((a, b) => b.gap - a.gap);
    html = `<p>The coach agreed with ${notes.length - differs.length} of your ${notes.length} moves. Where it would have played otherwise, the costliest first:</p><ol class="b2-review">${differs.slice(0, 3).map(n => `<li>${esc(n.words)}</li>`).join("")}</ol>`;
  } else if (word && which !== "hint" && !(myTurn(v) && (liveHint() || opts.coach === "on"))) {
    head = "Your last move";
    html = `<p>${esc(word.words)}</p>${listHtml(word.r, word.state, word.state.turn, word.mine)}`;
  } else {
    const a = liveHint() ? { r: liveHint().r, state: s, seat: v.seat } : advice;
    if (!a) return;
    html = listHtml(a.r, a.state, a.seat, null);
  }
  $("whyHead").textContent = head;
  $("whyBody").innerHTML = html;
  if (!$("whyDlg").open) $("whyDlg").showModal();
}
$("status").addEventListener("click", e => { const b = e.target.closest(".b2-why"); if (b) showWhy(b.dataset.why === "review" ? "review" : liveHint() ? "hint" : ""); });
$("whyClose").addEventListener("click", () => $("whyDlg").close());

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
  set.append(choice("Coach", COACH, opts.coach, v => { opts.coach = v; keep(); word = null; draw(); }));
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
