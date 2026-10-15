// Bones: dominoes for two to four, against the computer or with friends each on their own phone: Partnership, Gaple
// and Fives and Threes (bones-rules.js), on seats.js. This page lays the line out as it snakes across the table
// (bones-layout.js), the other players along the top with their tiles face down, your tiles along the foot: a tap on
// one that fits plays it, and where it would go on either end, the two places are shown on the line, to tap.
import { rules, GAMES, TILES, TARGETS, DEALS, legalPlays, endsOf, otherEnd, teamsOf, teamOf, fivesPoints } from "./bones-rules.js";
import { LEVEL_NAMES } from "./bones-bot.js";
import { layout, rowLenFor, tileSvg } from "./bones-layout.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import { scale } from "./wide.js";
import { createCourse, progressOf } from "./course.js";
import { COURSE, tileStage } from "./bones-course.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "bones:opts", RECORD = "bones:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const signed = n => (n > 0 ? `+${n}` : String(n));
// the computer players, by where the game is played
const BOTS = { partnership: ["Rosa", "Tito", "Marisol"], gaple: ["Budi", "Sari", "Agus"], fives: ["Alf", "Maggie", "Ron"] };

const saved = read(OPTS, {});
let opts = { game: GAMES[saved.game] ? saved.game : "partnership", level: LEVEL_NAMES.some(([k]) => k === saved.level) ? saved.level : "medium", voice: saved.voice ?? true };
for (const g of Object.keys(GAMES)) opts[g] = { ...GAMES[g].defaults, ...(saved[g] || {}) };
const saveOpts = () => write(OPTS, opts);
const seatsFor = game => (game === "fives" ? opts.fives.players : 4);

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the table ----------
let V = null;
// the tile you've picked when it would go on either end; cleared whenever the table moves on
let ui = { key: "", sel: null };
let page = null;
page = seatPage({
  rules, id: "bones", app: 1, pace: 850, botName: s => (BOTS[V?.state?.game || opts.game] || BOTS.partnership)[(s + 2) % 3],
  level: () => opts.level, voice: () => opts.voice, onView: v => { V = v; draw(); }, onOver, toast, newGame,
});
const me = () => V?.seat ?? 0;
const nameOf = seat => V?.seats?.[seat]?.name ?? `Seat ${seat + 1}`;
const isMe = seat => V?.seat != null && seat === V.seat;
const who = seat => (isMe(seat) ? "you" : nameOf(seat));
const Who = seat => (isMe(seat) ? "You" : nameOf(seat));
const tileName = t => `${TILES[t][0]}–${TILES[t][1]}`;
/** Where a seat sits from yours: the next to play on your right in Partnership and Gaple, on your left in Fives and Threes. */
function placeOf(s, seat) {
  const n = s.seats, d = (seat - me() + n) % n;
  if (d === 0) return "me";
  if (n === 2 || (n === 4 && d === 2)) return "top";
  return (d === 1) === GAMES[s.game].ccw ? "right" : "left";
}

function draw() {
  if (!page) return;
  const v = V;
  if (!v?.G) {
    $("info").innerHTML = ""; $("others").innerHTML = ""; $("hand").innerHTML = ""; $("status").textContent = "";
    $("board").innerHTML = `<p class="bn-lead">Dominoes for two to four: the block game in partnerships, Gaple, or Fives and Threes.</p>`;
    $("controls").innerHTML = `<button class="btn primary bn-go" type="button" data-act="new">New game</button>`;
    return;
  }
  const s = v.state, key = `${v.G.seq}:${s.handNo}:${s.log.length}:${s.step}`;
  if (ui.key !== key) ui = { key, sel: null };
  drawInfo(s);
  drawOthers(s);
  drawBoard(s);
  drawHand(s);
  drawControls(s);
  $("status").textContent = statusLine(v);
}
/** The line under your tiles: the last thing done (the narrator's line before the first tile, and at a hand's end). */
function statusLine(v) {
  const s = v.state, last = s.log.at(-1);
  if (!last || s.step !== "play") return v.said || "";
  if (last.pass) return `${Who(last.seat)} ${last.dead ? "laid a tile face down" : s.game === "fives" ? "knocked" : "passed"}`;
  const pts = s.game === "fives" && last.total != null ? `: ${last.total}${last.pts ? `, ${last.pts} ${last.pts === 1 ? "point" : "points"}` : last.total && fivesPoints(last.total) ? ", past the target" : ""}` : "";
  return `${Who(last.seat)} laid ${tileName(last.tile)}${last.end === "F" ? " to lead" : ""}${pts}`;
}

/** The game and the score, along the top. */
function drawInfo(s) {
  let score;
  if (teamsOf(s)) { const mine = teamOf(me()); score = `<b>${s.scores[mine]}</b> us · <b>${s.scores[1 - mine]}</b> them <small>to ${s.opts.target}</small>`; }
  else if (s.game === "gaple") score = `<b>${signed(s.scores[me()])}</b> you <small>deal ${s.handNo} of ${s.opts.deals}</small>`;
  else score = `<b>${s.scores[me()]}</b> you <small>to ${s.opts.target}</small>`;
  $("info").innerHTML = `<span class="bn-game">${esc(GAMES[s.game].name)}</span><span class="bn-score">${score}</span>`;
}

/** The others along the top, as they sit (left, across, right): their tiles face down, their score, what they just did. */
function drawOthers(s) {
  const order = ["left", "top", "right"].map(p => [...Array(s.seats).keys()].find(i => placeOf(s, i) === p)).filter(x => x != null);
  $("others").innerHTML = order.map(seat => {
    const turn = s.step === "play" && s.turn === seat, n = s.hands[seat].length;
    const partner = teamsOf(s) && teamOf(seat) === teamOf(me());
    const pts = teamsOf(s) ? "" : `<b class="bn-pts">${s.game === "gaple" ? signed(s.scores[seat]) : s.scores[seat]}</b>`;
    const backs = Array.from({ length: n }, () => `<i class="bn-back"></i>`).join("");
    const dead = s.dead[seat].length ? `<small class="bn-dead">${s.dead[seat].length} down</small>` : "";
    return `<div class="bn-seat at-${placeOf(s, seat)}${turn ? " turn" : ""}${partner ? " partner" : ""}">
      <span class="bn-name">${esc(nameOf(seat))}${partner ? `<small>partner</small>` : ""}${pts}</span>
      <span class="bn-backs" aria-label="${n} ${n === 1 ? "tile" : "tiles"}">${backs || `<small>out</small>`}${dead}</span>${bubbleOf(s, seat)}</div>`;
  }).join("");
}
/** What a player did on their last turn this round: knocked, laid a tile down, scored, went out. */
function bubbleOf(s, seat) {
  if (s.step !== "play") return "";
  const recent = s.log.slice(-s.seats), last = [...recent].reverse().find(l => l.seat === seat);
  if (!last) return "";
  const text = last.pass ? (last.dead ? "Face down" : s.game === "fives" ? "Knock" : "Pass") : s.out.includes(seat) ? "Out" : last.pts ? `+${last.pts}` : "";
  return text ? `<span class="bn-bubble${last.pass ? " pass" : last.pts ? " pts" : ""}">${text}</span>` : "";
}

// ---------- the line ----------
/** The board's tile size: as large as a full line allows, never larger than this. */
const MAX_UNIT = 2.4;          // rem: a tile's short side at most
function drawBoard(s) {
  const box = $("board"), W = box.clientWidth, H = box.clientHeight;
  if (!W || !H) return;
  // room for a long hand's arms; a longer one widens the view as it comes
  const len = rowLenFor(W / H, s.game === "fives" ? 16 : 22, Math.ceil(W / (MAX_UNIT * 16 * scale())) - 1);
  const L = layout(s.first, s.firstSides, s.left, s.right, len);
  const lastPlay = [...s.log].reverse().find(l => l.tile != null);
  const tiles = L.tiles.map(p => tileSvg(p, s.step === "play" && lastPlay && p.t === lastPlay.tile ? "last" : ""));
  // where the picked tile could go, on either end, to tap
  const ghosts = [];
  if (ui.sel != null && s.first != null) {
    for (const p of distinctPlays(s, legalPlays(s, V.seat).filter(x => x.tile === ui.sel))) {
      const e = endsOf(s), add = { t: p.tile, v: otherEnd(p.tile, p.end === "L" ? e.L : e.R) };
      const G = layout(s.first, s.firstSides, p.end === "L" ? [...s.left, add] : s.left, p.end === "R" ? [...s.right, add] : s.right, len);
      const g = G.tiles.find(x => x.arm === p.end && x.i === (p.end === "L" ? s.left.length : s.right.length));
      ghosts.push({ g, end: p.end });
      for (const k of ["x0", "y0"]) L.box[k] = Math.min(L.box[k], G.box[k]);
      for (const k of ["x1", "y1"]) L.box[k] = Math.max(L.box[k], G.box[k]);
    }
  }
  // the view: the row's width, the board's shape, widened if a long arm has run past it
  let hw = Math.max((len + 1) / 2, -L.box.x0 + 0.4, L.box.x1 + 0.4), hh = Math.max(hw * H / W, -L.box.y0 + 0.4, L.box.y1 + 0.4);
  hw = Math.max(hw, hh * W / H);
  hh = hw * H / W;
  const ghostSvg = ghosts.map(({ g, end }) => `<g class="bn-ghost" data-end="${end}" role="button" tabindex="0" aria-label="Play it on the ${end === "L" ? endsOf(s).L : endsOf(s).R} (${end === "L" ? "this" : "that"} end)">${tileSvg(g)}</g>`).join("");
  const result = s.step === "scored" || s.step === "over" ? resultHtml(s) : "";
  box.innerHTML = `<svg class="bn-line" viewBox="${(-hw).toFixed(3)} ${(-hh).toFixed(3)} ${(2 * hw).toFixed(3)} ${(2 * hh).toFixed(3)}" role="img" aria-label="${lineLabel(s)}">${tiles.join("")}${ghostSvg}</svg>${result}`;
}
function lineLabel(s) {
  if (s.first == null) return "No tile laid yet";
  const e = endsOf(s);
  return `${1 + s.left.length + s.right.length} tiles laid; the ends are ${e.L} and ${e.R}`;
}
/** The plays of one tile that make a difference: on either end, unless both ends are alike (then the shorter arm). */
function distinctPlays(s, list) {
  if (list.length < 2) return list;
  const e = endsOf(s);
  if (e.L === e.R && e.Ld === e.Rd) return [list.find(p => p.end === (s.left.length <= s.right.length ? "L" : "R")) || list[0]];
  return list;
}

/** A hand's end, over the line: who won it, and every hand's tiles left. */
function resultHtml(s) {
  const r = s.result;
  if (!r) return "";
  let head, sub = "";
  if (s.game === "partnership") {
    const mine = teamOf(me());
    head = r.team < 0 ? "Blocked, and level: no score" : `${r.how === "blocked" ? "Blocked: " : `${Who(r.by)} ${isMe(r.by) ? "are" : "is"} out: `}${r.team === mine ? "we" : "they"} win the hand`;
    if (r.team >= 0) sub = `${r.delta[r.team]} points${s.opts.count === "all" ? " (every hand's pips)" : ""}`;
  } else if (s.game === "gaple") {
    head = `${r.how === "blocked" ? "Blocked: " : `${Who(r.by)} ${isMe(r.by) ? "are" : "is"} out: `}${who(r.winner)} ${isMe(r.winner) ? "win" : "wins"} the hand`;
    sub = `${signed(r.delta[me()])} for you`;
  } else {
    head = r.how === "blocked" ? "Blocked" : `${Who(r.by)} ${isMe(r.by) ? "are" : "is"} out${teamsOf(s) ? " with a partner" : ""}${r.go ? ": a point" : ""}`;
    if (r.how === "blocked") sub = "No point for going out";
  }
  // what each hand holds still; in Fives and Threes, what each scored this hand (the pips there count for nothing)
  const made = p => s.log.filter(l => l.seat === p && l.pts).reduce((a, l) => a + l.pts, 0) + (r.go && r.by === p ? r.go : 0);
  const rows = [...Array(s.seats).keys()].map(p => `<li class="${isMe(p) ? "me" : ""}"><span class="nm">${esc(nameOf(p))}</span><span class="bn-left">${r.hands[p].map(miniTile).join("") || "<small>out</small>"}</span><b>${s.game === "fives" ? `+${made(p)}` : r.pips[p]}</b></li>`).join("");
  return `<div class="bn-result"><b class="bn-result-head">${esc(head)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}<ol class="bn-lefts">${rows}</ol></div>`;
}
const miniTile = t => `<svg class="bn-mini" viewBox="0 0 2 1" role="img" aria-label="${tileName(t)}">${tileSvg({ t, x: 1, y: 0.5, v: false, a: TILES[t][0], b: TILES[t][1] })}</svg>`;

// ---------- your tiles ----------
function drawHand(s) {
  const box = $("hand"), seat = V.seat;
  if (seat == null) { box.innerHTML = `<p class="bn-hint">Watching: you sit down at the next game.</p>`; return; }
  const mine = s.step === "play" && s.turn === seat, plays = mine ? legalPlays(s, seat) : [];
  const fits = new Set(plays.map(p => p.tile)), facedown = mine && !plays.length && s.game === "gaple" && s.opts.stuck === "discard";
  const tiles = s.hands[seat].map(t => {
    const cls = ["bn-mine"];
    if (mine) cls.push(fits.has(t) || facedown ? "ok" : "dim");
    if (ui.sel === t) cls.push("sel");
    return `<button type="button" class="${cls.join(" ")}" data-t="${t}" aria-label="${tileName(t)}${mine && fits.has(t) ? ", fits" : ""}"><svg viewBox="0 0 1 2" aria-hidden="true">${tileSvg({ t, x: 0.5, y: 1, v: true, a: TILES[t][0], b: TILES[t][1] })}</svg></button>`;
  });
  const dead = s.dead[seat].map(t => `<span class="bn-mine down" aria-label="${tileName(t)}, face down"><svg viewBox="0 0 1 2" aria-hidden="true">${tileSvg({ t, x: 0.5, y: 1, v: true, a: TILES[t][0], b: TILES[t][1] })}</svg></span>`);
  box.innerHTML = tiles.join("") + dead.join("");
}

function drawControls(s) {
  const box = $("controls"), seat = V.seat;
  if (seat == null) { box.innerHTML = ""; return; }
  if (s.step === "over") {
    const won = s.winners.includes(seat);
    box.innerHTML = `<p class="bn-hint">${won ? (teamsOf(s) ? "Your side wins" : "You win") : teamsOf(s) ? "Your side loses" : `${esc(s.winners.map(nameOf).join(" and "))} ${s.winners.length > 1 ? "win" : "wins"}`}</p><button class="btn primary bn-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New game" : "The result"}</button>`;
    return;
  }
  if (s.step === "scored") { box.innerHTML = `<p class="bn-hint">The next hand in a moment</p>`; return; }
  if (s.turn !== seat) { box.innerHTML = `<p class="bn-hint">${esc(nameOf(s.turn))} to play</p>`; return; }
  const plays = legalPlays(s, seat);
  if (!plays.length) {
    box.innerHTML = s.game === "gaple" && s.opts.stuck === "discard"
      ? `<p class="bn-hint">Nothing fits: tap a tile to lay it face down (it counts against you)</p>`
      : `<p class="bn-hint">Nothing fits${endsOf(s) ? ` a ${endsOf(s).L} or a ${endsOf(s).R}` : ""}</p><button class="btn primary bn-go" type="button" data-act="pass">${s.game === "fives" ? "Knock" : "Pass"}</button>`;
    return;
  }
  const picked = ui.sel != null ? distinctPlays(s, plays.filter(p => p.tile === ui.sel)) : [];
  if (picked.length === 2) {
    const e = endsOf(s), same = e.L === e.R;
    box.innerHTML = `<p class="bn-hint">${tileName(ui.sel)}: which end? (or tap where it goes on the line)</p><div class="bn-pair">${picked.map(p => `<button class="btn bn-endbtn" type="button" data-end="${p.end}">On the ${p.end === "L" ? e.L : e.R}${same ? (p.end === "L" ? " (one arm)" : " (the other)") : ""}</button>`).join("")}</div>`;
    return;
  }
  const lead = s.first == null ? (s.must ? (s.must.tiles.length === 1 ? `Lead the ${tileName(s.must.tiles[0])}` : "Lead a double") : "Lead any tile") : "Tap a tile that fits an end";
  box.innerHTML = `<p class="bn-hint">${lead}</p>`;
}

function play(m) {
  ui.sel = null;
  page.move(m).then(why => { if (why) toast(why); });
}
$("hand").addEventListener("click", e => {
  const b = e.target.closest("button[data-t]");
  if (!b || !V?.G || V.seat == null) return;
  const s = V.state, t = Number(b.dataset.t);
  if (s.step !== "play") return;
  if (s.turn !== V.seat) { toast(`${nameOf(s.turn)} is to play`); return; }
  const plays = legalPlays(s, V.seat);
  if (!plays.length) {
    if (s.game === "gaple" && s.opts.stuck === "discard") play({ t: "discard", tile: t });
    else toast(`Nothing fits: ${s.game === "fives" ? "knock" : "pass"}`);
    return;
  }
  const list = distinctPlays(s, plays.filter(p => p.tile === t));
  if (!list.length) { toast(s.first == null && s.must ? (s.must.tiles.length === 1 ? `Lead the ${tileName(s.must.tiles[0])}` : "Lead a double") : "That doesn't fit either end"); return; }
  if (list.length === 1) { play(list[0]); return; }
  ui.sel = ui.sel === t ? null : t;
  draw();
});
$("board").addEventListener("click", e => {
  const g = e.target.closest("[data-end]");
  if (g && ui.sel != null) play({ t: "play", tile: ui.sel, end: g.dataset.end });
});
$("board").addEventListener("keydown", e => {
  const g = e.target.closest?.("[data-end]");
  if (g && ui.sel != null && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); play({ t: "play", tile: ui.sel, end: g.dataset.end }); }
});
$("controls").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  if (b.dataset.act === "new") { newGame(); return; }
  if (b.dataset.act === "result") { showEnd(V); return; }
  if (b.dataset.act === "pass") { play({ t: "pass" }); return; }
  if (b.dataset.end && ui.sel != null) play({ t: "play", tile: ui.sel, end: b.dataset.end });
});

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("bones", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1800);
}
function showEnd(v) {
  const s = v.state, mine = v.seat != null && s.winners.includes(v.seat);
  $("endHead").textContent = v.seat == null ? `${s.winners.map(nameOf).join(" and ")} win` : mine ? (teamsOf(s) ? "Your side wins" : "You win") : `${s.winners.map(nameOf).join(" and ")} ${s.winners.length > 1 ? "win" : "wins"}`;
  let rows;
  if (teamsOf(s)) rows = [0, 1].sort((a, b) => s.scores[b] - s.scores[a]).map(k => `<li class="${s.winners.includes(k) ? "won" : ""}${teamOf(me()) === k ? " me" : ""}"><span class="nm">${esc([k, k + 2].map(nameOf).join(" and "))}</span><b>${s.scores[k]}</b></li>`);
  else rows = [...Array(s.seats).keys()].sort((a, b) => s.scores[b] - s.scores[a]).map(p => `<li class="${s.winners.includes(p) ? "won" : ""}${isMe(p) ? " me" : ""}"><span class="nm">${esc(nameOf(p))}</span><b>${s.game === "gaple" ? signed(s.scores[p]) : s.scores[p]}</b></li>`);
  const hands = s.history.length;
  $("endBody").innerHTML = `<ol class="bn-standings">${rows.join("")}</ol><p class="bn-end-note">${esc(GAMES[s.game].name)}, ${hands} ${hands === 1 ? "hand" : "hands"}${s.game === "gaple" ? ": chips, each hand paying the difference" : `, to ${s.opts.target}`}.</p>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  page.deal({ game: opts.game, ...opts[opts.game] }, seatsFor(opts.game));
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  $("rulesBody").innerHTML = `
    <p>Dominoes with the double-six set: 28 tiles, every pair of numbers from blank to six once. A tile is laid against an end of the line with the same number; a double lies across. Can't lay one? Knock (pass).</p>
    <h3>Partnership</h3>
    <p>The block game of Latin America and the Caribbean. Four play, partners across the table; seven tiles each, play passing to the right. The first hand is led with the double six; after that the lead passes on and any tile may lead. The hand ends when someone lays their last tile, and their side scores the pips left in the other side's hands; or when nobody can lay a tile, and the side holding fewer pips scores the other side's (level: no score). First side to ${opts.partnership.target} wins. In the menu: count every hand's pips instead, and the target.</p>
    <h3>Gaple</h3>
    <p>Indonesia's. Four, each for themselves; seven tiles each. The first hand opens with the double blank; after it the last hand's winner leads a double (or the next player round who has one). Whoever goes out, or holds the fewest pips when nobody can lay a tile, wins the hand; the fewest wins every hand, and each player pays every other the difference between their counts (the lowest tile breaks a tie). After the deals agreed, the most chips win. In the menu: lay a tile face down when you can't play (it counts against you) instead of passing, and a lone double blank counting 25.</p>
    <h3>Fives and Threes</h3>
    <p>The English pub game, for two to four (four as two partnerships); five tiles each, seven for two (the championship deal: nine for two, six for four), the rest out of play. The lead goes by lot, then to the left; any tile leads, and play goes to the left. Every tile scores what the two ends then add up to (a double at an end counts both halves; the first tile, all its pips): a point for each five and each three in it. 5 or 3 make 1, 6 and 10 make 2, 9 makes 3, 12 makes 4, 15 makes 8 (three fives and five threes), 18 makes 6, 20 makes 4. Going out scores 1 (in partnerships, when both of a side are out). Points that would take you past the target don't count; exactly ${opts.fives.target} wins at once.</p>
    <h3>Playing</h3>
    <p>Your tiles are along the foot, those that fit lifted on your turn: tap one to lay it. If it would go on either end, both places show on the line: tap one (or the buttons). The last tile laid is ringed. When a hand ends, every hand's tiles left are shown.</p>
    <p class="bn-rules-note">The computer players shed heavy tiles and doubles early and keep tiles that fit (in Fives and Threes, score what they can). On Medium and Hard they deal out the tiles they can't see as they could lie, remembering who knocked on what, play each move to the end of the hand, and take what does best; on Easy they play the rule of thumb loosely.</p>`;
  $("rulesDlg").showModal();
}

// ---------- the course ----------
// Learn (the header): dominoes taught from nothing (bones-course.js) on the course's sheet (course.js), the tiles drawn
// as the table draws them and every play judged by the rules; its last lesson starts a game against Easy. The Rules
// sheet, every rule on one page, opens from the course's map and the menu.
const course = createCourse({
  id: "bones", course: COURSE, cls: "bn", inFrame: IN_FRAME, onRules: showRules, stage: tileStage(),
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
  const cp = progressOf("bones", COURSE);
  play.append(action(cp.done ? `Learn: ${cp.done} of ${cp.of} lessons done` : "Learn Bones, from the rules", () => course.open()), action("The rules on one page", showRules, "link"));
  const set = part(body, "settings");
  set.append(choice("Game", Object.values(GAMES).map(g => [g.id, g.name]), opts.game, v => { opts.game = v; saveOpts(); openMenu(); }));
  const o = opts[opts.game], put = (k, v) => { o[k] = v; saveOpts(); };
  if (opts.game === "partnership") {
    set.append(choice("Play to", TARGETS.partnership.map(n => [n, String(n)]), o.target, v => put("target", Number(v))));
    set.append(choice("The winners score", [["losers", "Their pips"], ["all", "Every hand's"]], o.count, v => put("count", v)));
  } else if (opts.game === "gaple") {
    set.append(choice("Deals", DEALS.map(n => [n, String(n)]), o.deals, v => put("deals", Number(v))));
    set.append(choice("Stuck", [["pass", "Pass"], ["discard", "Lay one down"]], o.stuck, v => put("stuck", v)));
    set.append(toggle("A lone double blank counts 25", o.blank25, on => put("blank25", on)));
  } else {
    set.append(choice("Players", [[2, "2"], [3, "3"], [4, "4 (pairs)"]], o.players, v => put("players", Number(v))));
    set.append(choice("Play to", TARGETS.fives.map(n => [n, String(n)]), o.target, v => put("target", Number(v))));
    set.append(choice("Deal", [["pub", "Pub"], ["championship", "Championship"]], o.deal, v => put("deal", v)));
  }
  set.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(line("The game and its settings apply from the next game."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("bones:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "bones");
document.querySelector(".bn-mark").innerHTML = APPS.find(a => a.id === "bones")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("learnBtn").addEventListener("click", () => course.open());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
addEventListener("resize", draw);
window.__bones = { page, get view() { return V; }, opts, course };
// the first time, a game is dealt at once: the table is the menu
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
