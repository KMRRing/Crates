// Banquet: the hand games of a Chinese banquet table, 划拳 and 十五二十, against the computer or at a table with a friend
// each on their own phone. The rules are banquet-rules.js's, the running seats.js's (solo, or a table through
// seats-ui.js). This page draws the table: the other player at the top, the hands shown in the middle with the calls
// in large characters, your hand and your call at the foot: a tap on a hand and a tap on a call throws.
import { rules, HUA, SHIWU, HANDS, LIMITS, SHOW_MS, callsFor } from "./banquet-rules.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "banquet:opts", RECORD = "banquet:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const BOT = "Lao Wang";
const LEVELS = [["easy", "Easy"], ["sharp", "Sharp"]];
const GAMES = [["huaquan", "划拳"], ["shiwu", "十五二十"]];

let opts = { mode: "huaquan", limit: 3, level: "sharp", voice: true, ...read(OPTS, {}) };
if (!LIMITS.includes(opts.limit)) opts.limit = 3;
const saveOpts = () => write(OPTS, opts);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- hands, drawn ----------
// fingers raised from the thumb, as 划拳 counts (one is the thumb: pointing a finger at someone is rude)
const FINGERS = [{ x: 22, w: 8.5, top: 9 }, { x: 31.5, w: 8.5, top: 5 }, { x: 41, w: 8, top: 8 }, { x: 50, w: 7, top: 15 }];
/** A hand showing n fingers (0 a fist, 5 open), mirrored for the other side of the table. */
function hand(n, { flip = false, cls = "" } = {}) {
  const up = k => n >= k + 2;                 // index (k 0) up from two, middle from three…
  const fingers = FINGERS.map((f, k) => up(k)
    ? `<rect x="${f.x}" y="${f.top}" width="${f.w}" height="${44 - f.top}" rx="${f.w / 2}"/>`
    : `<rect x="${f.x}" y="31" width="${f.w}" height="13" rx="${f.w / 2}"/>`).join("");
  // the thumb's root inside the palm, so it grows from it; the fingers drawn first, the palm over their roots
  const thumb = n >= 1 ? `<rect x="14" y="27" width="10.5" height="33" rx="5.2" transform="rotate(-32 19.5 58)"/>` : `<rect x="21" y="47" width="25" height="10" rx="5"/>`;
  return `<svg class="bq-hand${cls ? ` ${cls}` : ""}" viewBox="0 0 64 82" role="img" aria-label="${n} ${n === 1 ? "finger" : "fingers"}"><g${flip ? ` transform="translate(64 0) scale(-1 1)"` : ""}>
    ${fingers}<rect class="palm" x="19" y="36" width="38" height="38" rx="10"/>${thumb}<path class="cuff" d="M23 74h30"/></g></svg>`;
}
/** 十五二十's two hands: five or nothing each. */
const pair = (total, flip = false) => `<span class="bq-pair">${hand(total >= 5 ? 5 : 0, { flip })}${hand(total >= 10 ? 5 : 0, { flip })}</span>`;
const handOf = (mode, n, flip) => (mode === "shiwu" ? pair(n, flip) : hand(n, { flip }));

/** A call's words: the verse (or the Cantonese) large, the sound and the sense beneath. */
const callOf = (mode, c) => (mode === "shiwu" ? { zh: SHIWU[c].zh, say: SHIWU[c].jp, en: SHIWU[c].en } : { zh: HUA[c].zh, say: HUA[c].py, en: HUA[c].en });

/** Cups drunk, as pips against the game's limit. */
const cupsHtml = (n, limit) => `<span class="bq-cups" aria-label="${n} of ${limit} cups">${Array.from({ length: limit }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;

// ---------- the table ----------
let V = null;
// the hand you've picked this round, before you call; and a throw made before your turn, sent the moment it comes (so
// both throw at once, as at the table, though the runner takes the throws one at a time)
let ui = { key: "", hand: null, queued: null, sent: false };
let page = null;
page = seatPage({
  rules, id: "banquet", app: 1, pace: 650, botName: () => BOT, level: () => opts.level, voice: () => opts.voice,
  onView: v => { V = v; draw(); }, onOver, toast,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? BOT;
const me = () => V?.seat ?? 0;
const isMe = seat => V?.seat != null && seat === V.seat;

function draw() {
  if (!page) return;
  const s = V?.G && V.state;
  if (s && ui.queued && ui.key === `${V.G.seq}:${s.round}` && !ui.sent && s.step === "throw" && rules.toMove(s) === V.seat) {
    ui.sent = true;
    page.move(ui.queued).then(why => { if (why) { toast(why); ui.queued = null; ui.sent = false; draw(); } });
  }
  drawSeat($("them"), V, 1 - me());
  drawSeat($("mine"), V, me());
  drawCentre(V);
  drawControls(V);
}

/** A player's place: their name, their cups, and what they've done this round. */
function drawSeat(box, v, seat) {
  if (!v?.G) { box.replaceChildren(); return; }
  const s = v.state, t = s.throws[seat], turn = s.step === "throw" && rules.toMove(s) === seat;
  const role = s.mode === "shiwu" ? (s.caller === seat ? `<span class="bq-role">calls${s.streak && s.caller === seat ? " · 1 right" : ""}</span>` : "") : "";
  const doing = s.step === "throw" ? (t ? "thrown" : turn ? (isMe(seat) ? "your throw" : "thinking…") : "") : "";
  box.className = `bq-seat ${box.id === "mine" ? "mine" : "them"}${turn ? " turn" : ""}${s.last?.loser === seat && s.step !== "throw" ? " drinks" : ""}`;
  box.innerHTML = `<b class="bq-name">${esc(nameOf(seat))}</b>${role}${cupsHtml(s.cups[seat], s.limit)}<span class="bq-doing">${doing}</span>`;
}

/** The middle: the hands shown and the calls, or the round's line while the throws come in. */
function drawCentre(v) {
  const box = $("centre");
  if (!v?.G) { box.innerHTML = `<p class="bq-lead">Throw a hand and call the total, as at a banquet table.</p>`; return; }
  const s = v.state, said = v.said ? `<p class="bq-said">${esc(v.said)}</p>` : "";
  if ((s.step === "shown" || s.step === "over") && s.last) {
    const r = s.last, my = me(), them = 1 - my;
    const callLine = seat => {
      const c = r.calls[seat];
      if (c < 0) return `<span class="bq-call none">no call</span>`;
      const w = callOf(s.mode, c), right = s.mode === "shiwu" ? r.hit : r.right[seat];
      return `<span class="bq-call ${right ? "right" : "wrong"}"><b>${esc(w.zh)}</b><small>${esc(w.say)} · ${c}</small></span>`;
    };
    box.innerHTML = `<div class="bq-shown">
      <div class="bq-throw them">${handOf(s.mode, r.hands[them], true)}${callLine(them)}</div>
      <div class="bq-total"><span>Total</span><b>${r.total}</b></div>
      <div class="bq-throw mine">${handOf(s.mode, r.hands[my], false)}${callLine(my)}</div></div>
      <p class="bq-verdict ${r.loser === undefined ? "even" : isMe(r.loser) ? "lost" : "won"}">${esc(verdict(s))}</p>
      ${s.step === "shown" ? `<span class="bq-next"><i data-until="${s.until}"></i></span>` : ""}`;
    runBar();
    return;
  }
  const hint = s.mode === "shiwu"
    ? (s.caller === me() ? "You call: show your hands and call the total of all four" : `${esc(nameOf(s.caller))} calls: show your hands`)
    : "Throw a hand and call the total of both";
  const mine = s.throws[me()];
  box.innerHTML = `${said}<div class="bq-round"><span class="bq-round-n">Round ${s.round}</span><span class="bq-hint">${hint}</span>
    ${mine ? `<span class="bq-mine-throw">${handOf(s.mode, mine.hand, false)}${mine.call != null ? `<b>${esc(callOf(s.mode, mine.call).zh)}</b>` : ""}</span>` : ""}</div>`;
}
function verdict(s) {
  const r = s.last;
  if (r.loser !== undefined) return isMe(r.loser) ? "You drink!" : `${nameOf(r.loser)} drinks!`;
  if (s.mode === "shiwu") return r.hit ? (isMe(r.caller) ? "Right! Once more and they drink" : `Right: once more and you drink`) : `Wrong: the call passes to ${isMe(s.caller) ? "you" : nameOf(s.caller)}`;
  return r.right[0] && r.right[1] ? "Both right: again" : "Neither right: again";
}

/** The bar under the shown hands, running down to the next round. */
let barRaf = 0;
function runBar() {
  cancelAnimationFrame(barRaf);
  const bar = document.querySelector(".bq-next i");
  if (!bar) return;
  const until = Number(bar.dataset.until), now = () => page.runner.table.now();
  const tick = () => {
    if (!bar.isConnected) return;
    const left = Math.max(0, until - now());
    bar.style.transform = `scaleX(${left / SHOW_MS})`;
    if (left > 0) barRaf = requestAnimationFrame(tick);
  };
  tick();
}

// ---------- your throw ----------
function drawControls(v) {
  const box = $("controls");
  if (!v?.G) { box.innerHTML = `<button class="btn primary bq-go" type="button" data-act="new">New game</button>`; return; }
  const s = v.state;
  if (v.seat == null) { box.innerHTML = `<p class="bq-status">Watching: you sit down at the next game.</p>`; return; }
  if (s.step === "over") {
    const won = s.winners.includes(v.seat);
    box.innerHTML = `<p class="bq-status">${won ? "You win" : `${esc(nameOf(s.winners[0]))} wins`}</p><button class="btn primary bq-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New game" : "The result"}</button>`;
    return;
  }
  const key = `${v.G.seq}:${s.round}`;
  if (ui.key !== key) ui = { key, hand: null, queued: null, sent: false };
  const thrown = !!s.throws[v.seat] || !!ui.queued, open = s.step === "throw" && !thrown;
  const calls = s.mode === "huaquan" || s.caller === v.seat;
  const hands = HANDS[s.mode].map(n => `<button type="button" class="bq-pick" data-hand="${n}" aria-pressed="${ui.hand === n}" ${open ? "" : "disabled"}>${handOf(s.mode, n, false)}<span>${n}</span></button>`).join("");
  let callRow = "";
  if (calls) {
    const list = ui.hand == null ? [] : callsFor(s.mode, ui.hand);
    callRow = `<div class="bq-calls${s.mode === "shiwu" ? " three" : ""}" role="group" aria-label="Your call">${(list.length ? list : (s.mode === "shiwu" ? [0, 5, 10] : [0, 1, 2, 3, 4, 5]).map(() => null)).map(c => {
      if (c == null) return `<button type="button" class="bq-callbtn" disabled><b>·</b><small>pick a hand</small></button>`;
      const w = callOf(s.mode, c);
      return `<button type="button" class="bq-callbtn" data-call="${c}" aria-pressed="${ui.queued?.call === c || s.throws[v.seat]?.call === c}" ${open ? "" : "disabled"}><b>${esc(w.zh)}</b><small>${c} · ${esc(w.say)}</small></button>`;
    }).join("")}</div>`;
  }
  const status = s.step !== "throw" ? "" : thrown ? `Thrown: waiting for ${esc(nameOf(1 - v.seat))}` : calls ? (ui.hand == null ? "Pick your hand, then your call" : "Now call the total") : "Show your hands";
  box.innerHTML = `<p class="bq-status">${status}</p><div class="bq-hands${s.mode === "shiwu" ? " three" : ""}" role="group" aria-label="Your hand">${hands}</div>${callRow}`;
}

$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  if (b.dataset.act === "new") { newGame(); return; }
  if (b.dataset.act === "result") { showEnd(V); return; }
  const s = V.state, seat = V.seat;
  if (b.dataset.hand != null) {
    ui.hand = Number(b.dataset.hand);
    // the one who doesn't call throws with the hand alone
    if (s.mode === "shiwu" && s.caller !== seat) throwNow({ t: "throw", hand: ui.hand });
    else draw();
    return;
  }
  if (b.dataset.call != null && ui.hand != null) throwNow({ t: "throw", hand: ui.hand, call: Number(b.dataset.call) });
});
/** A throw: made now if it's your turn, else the moment it is. */
function throwNow(m) {
  ui.queued = m;
  ui.sent = false;
  draw();
}

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("banquet", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1200);
}
function showEnd(v) {
  const s = v.state, mine = s.winners.includes(v.seat ?? -1);
  $("endHead").textContent = mine ? "You win: they drank first" : `${nameOf(s.winners[0])} wins`;
  const rounds = s.log.length, hits = s.log.filter(x => x.loser !== undefined).length;
  $("endBody").innerHTML = `<ol class="bq-standings">${[s.winners[0], 1 - s.winners[0]].map(i => `<li class="${s.winners.includes(i) ? "won" : ""}${isMe(i) ? " me" : ""}"><span class="nm">${esc(nameOf(i))}</span>${cupsHtml(s.cups[i], s.limit)}<b>${s.cups[i]}</b></li>`).join("")}</ol>
    <p class="bq-end-note">${rounds} ${rounds === 1 ? "round" : "rounds"}, ${hits} ${hits === 1 ? "cup" : "cups"} drunk.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  page.deal({ mode: opts.mode, limit: opts.limit }, 2);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const hua = HUA.map((c, i) => `<tr><td class="n">${i}</td><td><b>${c.zh}</b><br><small>${c.py}</small></td><td>${esc(c.en)}</td></tr>`).join("");
  const shi = Object.entries(SHIWU).map(([n, c]) => `<tr><td class="n">${n}</td><td><b>${c.zh}</b><br><small>${c.jp}</small></td><td>${esc(c.en)}</td></tr>`).join("");
  $("rulesBody").innerHTML = `
    <p>Two hand games of the banquet table, for two, played for cups: whoever drinks ${opts.limit} first loses. Here a cup is a point; at a table, it's a drink (or tea).</p>
    <h3>划拳 · huáquán, "drawing fists"</h3>
    <p>Both throw a hand at once, none to five fingers, and call the total of both hands. Fingers go up from the thumb: one is the thumb, two the thumb and the forefinger (pointing a finger at someone is rude). Whoever calls it right while the other doesn't makes the other drink; both right, or neither, and you go again. A call your own hand rules out, below your own fingers or past them and five more, is a 臭拳 (chòu quán, "stinking fist"), and isn't allowed here.</p>
    <p>Each total has its verse, said with the throw, and every region has its own; these are among the commonest.</p>
    <table class="bq-talk"><tbody>${hua}</tbody></table>
    <h3>十五二十 · sap6 ng5 ji6 sap6, "fifteen, twenty"</h3>
    <p>Hong Kong's. Each shows both hands, open (five) or a fist (nothing): none, five or ten each, so the total of four hands is 0, 5, 10, 15 or 20. One player calls, the other just shows. Call it right twice in a row and the other drinks (and calls next); call it wrong and the call passes to the other. The calls are in Cantonese:</p>
    <table class="bq-talk"><tbody>${shi}</tbody></table>
    <p class="bq-rules-note">Throws are made in turn here, but neither sees the other's until both are in, so it plays as at the table. The computer on Sharp watches what you throw and counts on your habits; on Easy it throws at random.</p>`;
  $("rulesDlg").showModal();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const set = part(body, "settings");
  set.append(choice("Game", GAMES, opts.mode, v => { opts.mode = v; saveOpts(); }));
  set.append(choice("A game ends at", LIMITS.map(n => [n, `${n} cups`]), opts.limit, v => { opts.limit = Number(v); saveOpts(); }));
  set.append(choice("The computer", LEVELS, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(line("The game and its end apply from the next game."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("banquet:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "banquet");
document.querySelector(".bq-mark").innerHTML = APPS.find(a => a.id === "banquet")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__banquet = { page, get view() { return V; }, opts };
// the first time, a game is dealt at once: the table is the menu
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
