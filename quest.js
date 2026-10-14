// Quest: the loyal and the traitors among them, five to ten at a round table, against the computer or with friends
// each on their own phone. The rules are quest-rules.js's, the computer players quest-bot.js's, the running seats.js's
// (solo, or a table through seats-ui.js). This page seats everyone round an oval, you at the foot and the lead passing
// clockwise, the quests in the middle; your role and what it lets you know under it (beside it, held sideways), and
// your part in the step: name a party (a tap on each player), approve or refuse one, succeed or fail a quest, or, as
// the Assassin, name the Seer. Votes and quest cards can be given before your turn comes: they're sent when it does.
import { rules, EVIL_COUNT, SIZES, SHOW_MS, isEvil, knowledge } from "./quest-rules.js";
import { LEVEL_NAMES } from "./quest-bot.js";
import { seatPage } from "./seats-ui.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, ticks, toggle, action, line } from "./menu.js";
import { IN_FRAME, noteStreak } from "./suite.js";
import "./pwa.js";

const $ = id => document.getElementById(id);
const OPTS = "quest:opts", RECORD = "quest:record";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NAMES = ["Alys", "Bertram", "Cecily", "Dunstan", "Edith", "Godric", "Hilda", "Osric", "Rowena", "Wulfric"];
const ROLE_OPTIONS = [["seer", "Seer, Assassin"], ["guardian", "Guardian, Impostor"], ["veiled", "Veiled"], ["hermit", "Hermit"]];
const PLAYERS = [5, 6, 7, 8, 9, 10];

let opts = { players: 7, roles: ["seer", "guardian"], level: "medium", voice: true, ...read(OPTS, {}) };
if (!PLAYERS.includes(opts.players)) opts.players = 7;
const saveOpts = () => write(OPTS, opts);
const roleOptions = () => Object.fromEntries(ROLE_OPTIONS.map(([k]) => [k, opts.roles.includes(k)]));

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the roles and marks, drawn ----------
const ICON = {
  seer: `<path d="M1.8 10Q10 2.6 18.2 10Q10 17.4 1.8 10Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="10" r="3" fill="currentColor"/>`,
  guardian: `<path d="M10 2.4L16.6 4.9V9.8C16.6 13.9 13.6 16.4 10 17.8C6.4 16.4 3.4 13.9 3.4 9.8V4.9Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 6V14.2M6.4 9.4H13.6" stroke="currentColor" stroke-width="1.5"/>`,
  loyal: `<path d="M10 2.2V13.2M6.2 13.2H13.8M10 13.2V16.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="17.6" r="1.2" fill="currentColor"/>`,
  assassin: `<path d="M8.5 8.8L10 18.4L11.5 8.8Z" fill="currentColor"/><path d="M6.2 8.4H13.8M10 8.4V3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="2.7" r="1.2" fill="currentColor"/>`,
  impostor: `<path d="M3.2 4.6Q10 2.4 16.8 4.6Q16.8 13.4 10 17Q3.2 13.4 3.2 4.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5.8 8.6Q7.2 7.4 8.6 8.6M11.4 8.6Q12.8 7.4 14.2 8.6M7.4 12.6Q10 11 12.6 12.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  veiled: `<path d="M3.8 17.8Q3.6 4.6 10 2.6Q16.4 4.6 16.2 17.8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6.8 17.8Q6.8 9.4 10 7.6Q13.2 9.4 13.2 17.8Z" fill="currentColor" opacity=".55"/>`,
  hermit: `<path d="M7.2 6.2H12.8L13.8 15.2H6.2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7.8 4.2H12.2M10 1.8V4.2M5.6 15.2H14.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 8.4Q11.8 10.6 10 12.8Q8.2 10.6 10 8.4Z" fill="currentColor"/>`,
  traitor: `<path d="M10 2.2V6.4M10 9V13.2M6.2 13.2H13.8M10 13.2V16.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="17.6" r="1.2" fill="currentColor"/><path d="M7.4 6.2L12.6 9.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  crown: `<path d="M3 15.5L2 5.8L6.6 9.4L10 3.6L13.4 9.4L18 5.8L17 15.5Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
  flag: `<path d="M5 2.4V17.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 3.2H15.6L13 6.8L15.6 10.4H5.6Z" fill="currentColor"/>`,
  yes: `<path d="M4 10.4L8.2 14.4L16 5.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  no: `<path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
};
const icon = (name, cls = "") => `<svg class="qs-ico${cls ? ` ${cls}` : ""}" viewBox="0 0 20 20" aria-hidden="true">${ICON[name]}</svg>`;
const SHORT = { seer: "Seer", guardian: "Guardian", loyal: "Loyal", assassin: "Assassin", impostor: "Impostor", veiled: "Veiled", hermit: "Hermit", traitor: "Traitor" };
const TITLE = { seer: "the Seer", guardian: "the Guardian", loyal: "a loyal knight", assassin: "the Assassin", impostor: "the Impostor", veiled: "the Veiled", hermit: "the Hermit", traitor: "a traitor" };

/** What your role means, in a line or two, given who's in the game. */
function roleText(s, seat) {
  const r = s.roles[seat], has = role => s.roles.includes(role);
  const others = has("hermit") && r !== "hermit" ? "You know the other traitors (marked), all but the Hermit." : "You know the other traitors (marked).";
  switch (r) {
    case "seer": return `Loyal. You know the traitors (marked)${has("veiled") ? ", all but the Veiled" : ""}. Don't let it show: if the loyal win, the Assassin names the Seer.`;
    case "guardian": return has("impostor") ? "Loyal. Of the two marked, one is the Seer, the other the Impostor." : "Loyal. The one marked is the Seer: keep them safe.";
    case "loyal": return "Loyal. You know only yourself: watch the votes and the quests.";
    case "assassin": return `A traitor. ${others} If the loyal win three quests, you name the Seer.`;
    case "impostor": return `A traitor, and to the Guardian you look like the Seer. ${others}`;
    case "veiled": return `A traitor the Seer can't see. ${others}`;
    case "hermit": return "A traitor on your own: the others don't know you, nor you them.";
    default: return `A traitor. ${others} Fail three quests.`;
  }
}

// ---------- the table ----------
let V = null, roleShown = true;
// your part in the step: the party you're naming or the one you'd strike, and a vote or a card given before your
// turn, sent the moment it comes
let ui = { key: "", pick: [], queued: null, sent: false };
let page = null;
page = seatPage({
  rules, id: "quest", app: 1, botName: s => NAMES[s % NAMES.length], level: () => opts.level, voice: () => opts.voice,
  // a vote or a card is secret till all are in: nothing to watch, so the computer gives its own at once
  pace: s => (s.step === "vote" || s.step === "quest" ? 240 : 1000),
  onView: v => { V = v; draw(); }, onOver, toast,
});
const nameOf = seat => V?.seats?.[seat]?.name ?? NAMES[seat % NAMES.length];
const isMe = seat => V?.seat != null && seat === V.seat;
const who = seat => (isMe(seat) ? "you" : nameOf(seat));
const Who = seat => (isMe(seat) ? "You" : nameOf(seat));
const list = names => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

function draw() {
  if (!page) return;
  const s = V?.G && V.state;
  if (s) {
    const key = `${V.G.seq}:${s.step}:${s.log.length}:${s.q}`;
    if (ui.key !== key) ui = { key, pick: [], queued: null, sent: false };
    if (ui.queued && !ui.sent && rules.toMove(s) === V.seat && (s.step === "vote" || s.step === "quest")) {
      ui.sent = true;
      page.move(ui.queued).then(why => { if (why) { toast(why); ui.queued = null; ui.sent = false; draw(); } });
    }
  }
  drawRing(V);
  drawCentre(V);
  drawRole(V);
  drawControls(V);
  $("status").textContent = V?.said || "";
}

/**
 * Everyone round the table's edge, evenly spaced along a rounded oblong (chips are wider than they're tall, so round an
 * oval the ones beside you would touch): you at the foot, the lead passing clockwise. Measured, so it fits any screen.
 */
function placeChips(ring, n, mine) {
  const chips = [...ring.querySelectorAll(".qs-chip")];
  if (!chips.length) return;
  const W = ring.clientWidth, H = ring.clientHeight;
  const cw = Math.max(...chips.map(c => c.offsetWidth)), ch = Math.max(...chips.map(c => c.offsetHeight));
  // the chips' centres run round inside the edge, with room above for the marks on their corners
  const A = Math.max(8, W / 2 - cw / 2 - 2), B = Math.max(8, H / 2 - ch / 2 - ch * 0.35), R = Math.min(A, B) * 0.45;
  const sx = A - R, sy = B - R, arc = (Math.PI * R) / 2, L = 4 * (sx + sy + arc);
  // from the foot's middle: left along the foot, round the corner, up the left side, along the top, down the right
  const legs = [
    [sx, t => [-t, B]],
    [arc, t => [-sx - R * Math.sin(t / R), sy + R * Math.cos(t / R)]],
    [2 * sy, t => [-A, sy - t]],
    [arc, t => [-sx - R * Math.cos(t / R), -sy - R * Math.sin(t / R)]],
    [2 * sx, t => [-sx + t, -B]],
    [arc, t => [sx + R * Math.sin(t / R), -sy - R * Math.cos(t / R)]],
    [2 * sy, t => [A, -sy + t]],
    [arc, t => [sx + R * Math.cos(t / R), sy + R * Math.sin(t / R)]],
    [sx, t => [sx - t, B]],
  ];
  const at = d => { for (const [len, f] of legs) { if (d <= len) return f(d); d -= len; } return [0, B]; };
  for (const c of chips) {
    const [x, y] = at((((Number(c.dataset.seat) - mine + n) % n) * L) / n);
    c.style.left = `${(W / 2 + x).toFixed(1)}px`;
    c.style.top = `${(H / 2 + y).toFixed(1)}px`;
  }
}

/** Everyone round the table: name, the lead, the party, the votes, and what your role lets you know of them. */
function drawRing(v) {
  const ring = $("ring");
  ring.querySelectorAll(".qs-chip").forEach(c => c.remove());
  if (!v?.G) return;
  const s = v.state, n = s.seats, mine = v.seat ?? 0, over = s.step === "over";
  const known = v.seat != null ? knowledge(s.roles, v.seat) : {};
  const last = s.log.at(-1), fresh = s.step === "shown" && s.show === "vote";
  const picking = pickMode(v), turn = rules.toMove(s);
  const party = s.step === "propose" ? (isMe(s.leader) ? ui.pick : []) : s.team;
  const html = [];
  for (let p = 0; p < n; p++) {
    const cls = ["qs-chip"];
    if (isMe(p)) cls.push("me");
    if (party.includes(p)) cls.push("party");
    if (picking && ui.pick.includes(p)) cls.push("picked");
    if (turn === p && !over && s.step !== "vote" && s.step !== "quest") cls.push("turn");
    if (over) cls.push(isEvil(s.roles[p]) ? "side-evil" : "side-good");
    else if (known[p] === "evil" || (isMe(p) && isEvil(s.roles[p]))) cls.push("evil");
    if (over && s.target === p) cls.push("struck");
    // the tag under the name: your role, what you know of them, or (at the end) everyone's role
    let tag = "";
    if (over) tag = `${icon(s.roles[p])}${SHORT[s.roles[p]]}`;
    else if (isMe(p)) tag = `${icon(s.roles[p])}${SHORT[s.roles[p]]}`;
    else if (known[p] === "evil") tag = `${icon("traitor")}traitor`;
    else if (known[p] === "seer?") tag = `${icon("seer")}${s.roles.includes("impostor") ? "Seer?" : "Seer"}`;
    // the vote: given (unseen) while it goes on, then each one, until the next
    let vote = "";
    if (s.step === "vote") vote = s.votes[p] !== null ? `<span class="qs-vote done" title="Voted"></span>` : "";
    else if (last && !over) vote = `<span class="qs-vote ${last.votes[p] ? "yes" : "no"}${fresh ? "" : " old"}">${icon(last.votes[p] ? "yes" : "no")}</span>`;
    const played = s.step === "quest" && s.team.includes(p) && s.cards[p] !== null ? `<span class="qs-played" title="Played"></span>` : "";
    const label = `${nameOf(p)}${isMe(p) ? " (you)" : ""}${s.leader === p && !over ? ", leading" : ""}${party.includes(p) ? ", in the party" : ""}`;
    html.push(`<button type="button" class="${cls.join(" ")}" data-seat="${p}" ${picking && (picking !== "kill" || canStrike(s, p)) ? `aria-pressed="${ui.pick.includes(p)}"` : "disabled"} aria-label="${esc(label)}">
      ${s.leader === p && !over ? `<span class="qs-lead" title="Leads">${icon("crown")}</span>` : ""}${party.includes(p) && s.step !== "propose" ? `<span class="qs-flag" title="In the party">${icon("flag")}</span>` : ""}
      <b class="qs-name">${esc(nameOf(p))}</b><span class="qs-tag">${tag}</span>${vote}${played}</button>`);
  }
  ring.insertAdjacentHTML("beforeend", html.join(""));
  placeChips(ring, n, mine);
}
/** What a tap on a player does now: "team" (you're naming a party), "kill" (you're the Assassin), or nothing. */
function pickMode(v) {
  if (!v?.G || v.seat == null) return null;
  const s = v.state;
  if (s.step === "propose" && s.leader === v.seat) return "team";
  if (s.step === "assassin" && rules.toMove(s) === v.seat) return "kill";
  return null;
}
/** The Assassin names someone it doesn't know for a traitor. */
const canStrike = (s, p) => p !== V.seat && knowledge(s.roles, V.seat)[p] !== "evil";

/** The middle: the five quests, the refusals, and what's happening. */
function drawCentre(v) {
  const box = $("centre");
  if (!v?.G) { box.innerHTML = `<p class="qs-lead-in">Most at the table are loyal. A few are traitors. Find them before three quests fail.</p>`; return; }
  const s = v.state, n = s.seats;
  const discs = s.quests.map((q, i) => {
    const cls = q.result || (i === s.q && s.step !== "over" ? "now" : "");
    const inner = q.result === "success" ? icon("yes") : q.result === "fail" ? icon("no") : `<b>${q.size}</b>`;
    const badge = q.result ? (q.fails ? `<i class="qs-fails">${q.fails}</i>` : "") : q.two ? `<i class="qs-two" title="Two fails to fail it">2</i>` : "";
    const say = q.result ? `Quest ${i + 1}: ${q.result === "success" ? "succeeded" : "failed"}${q.fails ? `, ${q.fails} ${q.fails === 1 ? "fail" : "fails"}` : ""}` : `Quest ${i + 1}: a party of ${q.size}${q.two ? ", two fails to fail it" : ""}`;
    return `<span class="qs-disc ${cls}" role="img" aria-label="${say}">${inner}${badge}</span>`;
  }).join("");
  const refused = Array.from({ length: 5 }, (_, i) => `<i class="${i < s.rejects ? "on" : ""}${i === 4 ? " last" : ""}"></i>`).join("");
  box.innerHTML = `<button type="button" class="qs-track" data-act="log" aria-label="The quests: tap for the parties so far">${discs}</button>
    <div class="qs-refused" role="img" aria-label="${s.rejects} of 5 parties refused"><span>Refused</span>${refused}</div>
    <div class="qs-now">${nowHtml(v)}</div>`;
  runBar();
}
function nowHtml(v) {
  const s = v.state, q = s.quests[s.q], last = s.log.at(-1);
  if (s.step === "over") {
    const why = { rejects: "five parties refused", quests: s.side === "evil" ? "three quests failed" : "three quests won", assassin: "the Seer was named", safe: "the Seer was never found" }[s.why];
    return `<b class="qs-big ${s.side}">${s.side === "evil" ? "The traitors win" : "The loyal win"}</b><small>${why}</small>`;
  }
  if (s.step === "shown" && s.show === "vote") {
    const yes = last.votes.filter(Boolean).length;
    return `<b class="qs-big ${last.approved ? "good" : "evil"}">${last.approved ? "Approved" : "Refused"} ${yes}–${s.seats - yes}</b><span class="qs-bar"><i data-until="${s.until}"></i></span>`;
  }
  if (s.step === "shown" && s.show === "quest") {
    const done = s.quests[s.q], cards = [...Array(done.team.length - done.fails).fill(true), ...Array(done.fails).fill(false)];
    return `<span class="qs-cards">${cards.map(ok => `<span class="qs-card ${ok ? "ok" : "bad"}">${icon(ok ? "yes" : "no")}</span>`).join("")}</span>
      <b class="qs-big ${done.result === "success" ? "good" : "evil"}">${done.result === "success" ? "The quest succeeds" : "The quest fails"}</b><span class="qs-bar"><i data-until="${s.until}"></i></span>`;
  }
  if (s.step === "propose") return `<small>Quest ${s.q + 1}${q.two ? " · two fails to fail it" : ""}</small><b>${esc(Who(s.leader))} ${isMe(s.leader) ? "lead" : "leads"}: a party of ${q.size}</b>`;
  if (s.step === "vote") {
    const left = s.votes.filter(x => x === null).length;
    return `<small>Quest ${s.q + 1} · ${esc(Who(s.leader))} named</small><b>${esc(list(s.team.map(who)))}</b><small>${left ? `${left} still to vote` : "All in"}</small>`;
  }
  if (s.step === "quest") {
    const left = s.team.filter(p => s.cards[p] === null).length;
    return `<small>Quest ${s.q + 1}</small><b>The party sets out</b><small>${left ? `${left} of ${s.team.length} still to choose` : "All back"}</small>`;
  }
  if (s.step === "assassin") return `<b>Three quests won</b><small>but the Assassin may yet name the Seer</small>`;
  return "";
}

/** The bar under a vote or a quest shown, running down to the next step. */
let barRaf = 0;
function runBar() {
  cancelAnimationFrame(barRaf);
  const bar = document.querySelector(".qs-bar i");
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

/** Your role, covered at a tap (a table's neighbours can see your phone). */
function drawRole(v) {
  const box = $("role");
  if (!v?.G || v.seat == null) { box.hidden = true; return; }
  box.hidden = false;
  const s = v.state, r = s.roles[v.seat];
  box.setAttribute("aria-expanded", String(roleShown));
  box.className = `qs-role ${roleShown ? (isEvil(r) ? "evil" : "good") : "covered"}`;
  box.innerHTML = roleShown
    ? `${icon(r, "qs-role-ico")}<span class="qs-role-text"><b>You are ${TITLE[r]}</b><small>${esc(roleText(s, v.seat))}</small></span>`
    : `<span class="qs-role-ico qs-hidden-ico"></span><span class="qs-role-text"><b>Your role</b><small>Covered: tap to see it</small></span>`;
}
$("role").addEventListener("click", () => { roleShown = !roleShown; draw(); });

// ---------- your part ----------
function drawControls(v) {
  const box = $("controls");
  if (!v?.G) { box.innerHTML = `<button class="btn primary qs-go" type="button" data-act="new">New game</button>`; return; }
  const s = v.state, me = v.seat;
  if (me == null) { box.innerHTML = `<p class="qs-hint">Watching: you sit down at the next game.</p>`; return; }
  if (s.step === "over") {
    const won = s.winners.includes(me);
    box.innerHTML = `<p class="qs-hint">${won ? "Your side wins" : "Your side loses"}</p><button class="btn primary qs-go" type="button" data-act="${page.host ? "new" : "result"}">${page.host ? "New game" : "The result"}</button>`;
    return;
  }
  const q = s.quests[s.q];
  if (s.step === "propose") {
    if (s.leader !== me) { box.innerHTML = `<p class="qs-hint">${esc(nameOf(s.leader))} is choosing a party of ${q.size}</p>`; return; }
    const k = ui.pick.length;
    box.innerHTML = `<p class="qs-hint">Choose ${q.size} for the party: tap them round the table (you may go yourself)</p>
      <button class="btn primary qs-go" type="button" data-act="team" ${k === q.size ? "" : "disabled"}>${k === q.size ? "Send this party" : `${k} of ${q.size} chosen`}</button>`;
    return;
  }
  if (s.step === "vote") {
    const given = s.votes[me] ?? ui.queued?.yes ?? null, sent = s.votes[me] !== null;
    const left = s.votes.filter(x => x === null).length - (given !== null && !sent ? 1 : 0);
    box.innerHTML = `<p class="qs-hint">${given === null ? "Approve this party, or refuse it?" : `You ${given ? "approve" : "refuse"}${left ? `: ${left} still to vote` : ""}`}</p>
      <div class="qs-pair"><button class="btn qs-vote-btn yes" type="button" data-vote="1" aria-pressed="${given === true}" ${sent ? "disabled" : ""}>${icon("yes")}Approve</button>
      <button class="btn qs-vote-btn no" type="button" data-vote="0" aria-pressed="${given === false}" ${sent ? "disabled" : ""}>${icon("no")}Refuse</button></div>`;
    return;
  }
  if (s.step === "quest") {
    if (!s.team.includes(me)) { box.innerHTML = `<p class="qs-hint">You wait for the party to come back</p>`; return; }
    const given = s.cards[me] ?? ui.queued?.success ?? null, sent = s.cards[me] !== null, loyal = !isEvil(s.roles[me]);
    box.innerHTML = `<p class="qs-hint">${given === null ? (loyal ? "On the quest: the loyal can only succeed" : "On the quest: succeed or fail it, unseen") : `You ${given ? "succeed" : "fail it"}: waiting for the rest`}</p>
      <div class="qs-pair"><button class="btn primary qs-card-btn" type="button" data-card="1" aria-pressed="${given === true}" ${sent ? "disabled" : ""}>${icon("yes")}Succeed</button>
      <button class="btn qs-card-btn fail" type="button" data-card="0" aria-pressed="${given === false}" ${sent || loyal ? "disabled" : ""}>${icon("no")}Fail</button></div>`;
    return;
  }
  if (s.step === "assassin") {
    if (rules.toMove(s) !== me) { box.innerHTML = `<p class="qs-hint">The Assassin is choosing whom to strike</p>`; return; }
    const t = ui.pick[0];
    box.innerHTML = `<p class="qs-hint">Which of them is the Seer? Tap them, then strike</p>
      <button class="btn primary qs-go" type="button" data-act="kill" ${t == null ? "disabled" : ""}>${t == null ? "Choose the Seer" : `Strike ${esc(nameOf(t))}`}</button>`;
    return;
  }
  box.innerHTML = `<p class="qs-hint">&nbsp;</p>`;
}

$("ring").addEventListener("click", e => {
  if (e.target.closest("[data-act=log]")) { showLog(); return; }
  const chip = e.target.closest(".qs-chip");
  if (!chip || chip.disabled || !V?.G) return;
  const p = Number(chip.dataset.seat), mode = pickMode(V);
  if (mode === "team") {
    const size = V.state.quests[V.state.q].size;
    if (ui.pick.includes(p)) ui.pick = ui.pick.filter(x => x !== p);
    else if (ui.pick.length < size) ui.pick = [...ui.pick, p];
    else ui.pick = [...ui.pick.slice(1), p];                    // full: the first chosen makes way
  } else if (mode === "kill") ui.pick = ui.pick[0] === p ? [] : [p];
  draw();
});
$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "result") { showEnd(V); return; }
  if (act === "team" || act === "kill") {
    const why = await page.move(act === "team" ? { t: "team", team: ui.pick } : { t: "kill", seat: ui.pick[0] });
    if (why) toast(why);
    return;
  }
  if (b.dataset.vote != null) give({ t: "vote", yes: b.dataset.vote === "1" });
  if (b.dataset.card != null) give({ t: "card", success: b.dataset.card === "1" });
});
/** A vote or a card: sent now if it's your turn, else the moment it is (and until then you may change it). */
function give(m) {
  if (ui.sent) return;
  ui.queued = m;
  draw();
}

// ---------- the parties so far ----------
function showLog() {
  const s = V?.state;
  if (!s) return;
  const rows = s.log.map(l => {
    const yes = [], no = [];
    l.votes.forEach((v, p) => (v ? yes : no).push(esc(Who(p))));
    const quest = s.quests[l.q], out = !l.approved ? "refused" : l.fails === undefined ? "on the quest" : `the quest ${(l.fails >= (quest.two ? 2 : 1)) ? "failed" : "succeeded"}${l.fails ? ` (${l.fails} ${l.fails === 1 ? "fail" : "fails"})` : ""}`;
    const cls = !l.approved ? "refused" : l.fails === undefined ? "" : l.fails >= (quest.two ? 2 : 1) ? "fail" : "success";
    return `<li class="${cls}"><div class="qs-log-head"><b>Quest ${l.q + 1}</b><span>${esc(Who(l.leader))} named ${esc(list(l.team.map(Who)))}</span></div>
      <div class="qs-log-votes"><span class="y">${icon("yes")}${yes.join(", ") || "nobody"}</span><span class="n">${icon("no")}${no.join(", ") || "nobody"}</span></div>
      <div class="qs-log-out">${l.approved ? "Approved" : "Refused"} ${yes.length}–${no.length}${l.approved ? `: ${out}` : ""}</div></li>`;
  });
  $("logBody").innerHTML = rows.length ? `<ol class="qs-log-list">${rows.reverse().join("")}</ol>` : `<p class="qs-rules-note">No party named yet.</p>`;
  $("logDlg").showModal();
}

// ---------- a game's end ----------
function onOver(v) {
  if (v.seat == null || IN_FRAME) return;
  const won = v.state.winners.includes(v.seat);
  const r = read(RECORD, { played: 0, won: 0 });
  r.played++;
  if (won) r.won++;
  write(RECORD, r);
  noteStreak("quest", won);
  setTimeout(() => { if (V?.over) showEnd(V); }, 1600);
}
function showEnd(v) {
  const s = v.state, mine = v.seat != null && s.winners.includes(v.seat);
  $("endHead").textContent = v.seat == null ? (s.side === "evil" ? "The traitors win" : "The loyal win") : mine ? `You win: ${s.side === "evil" ? "the traitors" : "the loyal"} carry it` : `You lose: ${s.side === "evil" ? "the traitors" : "the loyal"} carry it`;
  const why = { rejects: "Five parties were refused in a row.", quests: s.side === "evil" ? "Three quests failed." : "Three quests succeeded, and there was no Seer to find.", assassin: `Three quests succeeded, but the Assassin named ${who(s.target)}: the Seer.`, safe: `Three quests succeeded, and the Assassin named ${who(s.target)}, not the Seer.` }[s.why];
  const order = [...Array(s.seats).keys()].sort((a, b) => isEvil(s.roles[b]) - isEvil(s.roles[a]) || a - b);
  $("endBody").innerHTML = `<p class="qs-end-note">${esc(why)}</p><ol class="qs-standings">${order.map(p => `<li class="${s.winners.includes(p) ? "won" : ""}${isMe(p) ? " me" : ""} ${isEvil(s.roles[p]) ? "evil" : "good"}">${icon(s.roles[p])}<span class="nm">${esc(nameOf(p))}</span><b>${SHORT[s.roles[p]]}</b></li>`).join("")}</ol>`;
  $("endAgain").hidden = !page.host;
  if (!$("endDlg").open) $("endDlg").showModal();
}
function newGame() {
  $("endDlg").open && $("endDlg").close();
  page.deal(roleOptions(), opts.players);
}
$("endAgain").addEventListener("click", newGame);
$("endTable").addEventListener("click", () => $("endDlg").close());

// ---------- rules, menu ----------
function showRules() {
  const sizes = PLAYERS.map(n => `<tr><td class="n">${n}</td><td>${EVIL_COUNT[n]}</td>${SIZES[n].map((k, i) => `<td>${k}${i === 3 && n >= 7 ? "*" : ""}</td>`).join("")}</tr>`).join("");
  $("rulesBody").innerHTML = `
    <p>A game of hidden loyalties for five to ten. Most at the table are loyal; a few are traitors, and nobody knows who but the traitors themselves. Five quests set out one after another: three succeeding win it for the loyal, three failing for the traitors.</p>
    <h3>A quest</h3>
    <p>The leader (the lead passes clockwise each time) names a party of the size the quest asks, and may go too. Everyone votes on it, openly: more approvals than refusals and it sets out; otherwise the lead passes on. Five parties refused in a row and the traitors win at once.</p>
    <p>On the quest each member chooses, unseen, to succeed or to fail. The loyal can only succeed; a traitor may do either. One fail fails the quest, but the fourth from seven players up (*) needs two. You learn how many fails there were, never whose.</p>
    <table class="qs-sizes"><thead><tr><th>Players</th><th>Traitors</th><th colspan="5">Party for each quest</th></tr></thead><tbody>${sizes}</tbody></table>
    <h3>The roles</h3>
    <p class="qs-role-line">${icon("seer")}<span><b>The Seer</b> (loyal) knows the traitors. If the loyal win three quests, the <b>Assassin</b> ${icon("assassin")} (a traitor) names whom they think is the Seer: naming them wins it for the traitors. So the Seer steers, but quietly.</span></p>
    <p class="qs-role-line">${icon("guardian")}<span><b>The Guardian</b> (loyal) knows the Seer and the <b>Impostor</b> ${icon("impostor")} (a traitor), but not which is which.</span></p>
    <p class="qs-role-line">${icon("veiled")}<span><b>The Veiled</b> (a traitor) is hidden from the Seer.</span></p>
    <p class="qs-role-line">${icon("hermit")}<span><b>The Hermit</b> (a traitor) doesn't know the other traitors, nor they the Hermit.</span></p>
    <p class="qs-role-line">${icon("loyal")}<span><b>Loyal knights</b> know only themselves; the other <b>traitors</b> ${icon("traitor")} know each other.</span></p>
    <p>Choose the roles in the menu: the Guardian and the Veiled come only with the Seer, and a table has room for as many traitors' roles as it has traitors (the last chosen go first).</p>
    <h3>Playing</h3>
    <p>The quests are in the middle (tap them for every party so far, who led it and who voted how); round them the table, you at the foot. Votes and quest cards can be given before your turn: they're kept secret till all are in. At a table, each sees only their own role: tap yours to cover it, and talk. Accusing, defending and bluffing out loud is the game.</p>
    <p class="qs-rules-note">The computer players reason from what their role lets them know and from the play: who led which party, who voted how, which quests failed with whom on them. On Sharp a traitor votes much as a loyal player would and the Seer hides what it knows; on Easy they're looser all round.</p>`;
  $("rulesDlg").showModal();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (page.host) play.append(action("New game", newGame, "primary"));
  page.menu(play);
  const set = part(body, "settings");
  set.append(choice("Players", PLAYERS.map(n => [n, String(n)]), opts.players, v => { opts.players = Number(v); saveOpts(); }));
  set.append(ticks("Roles", ROLE_OPTIONS, opts.roles, v => { opts.roles = v; saveOpts(); }));
  set.append(choice("The computer", LEVEL_NAMES, opts.level, v => { opts.level = v; saveOpts(); }));
  set.append(line("Players and roles apply from the next game."));
  set.append(toggle("The narrator's voice", opts.voice, on => { opts.voice = on; saveOpts(); }));
  const r = read(RECORD, { played: 0, won: 0 }), st = read("quest:streak", { now: 0, best: 0 });
  part(body, "about").append(line(r.played ? `Won ${r.won} of ${r.played} games${st.best ? `; longest run of wins ${st.best}` : ""}.` : "No games finished yet."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "quest");
document.querySelector(".qs-mark").innerHTML = APPS.find(a => a.id === "quest")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", showRules);
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
$("logClose").addEventListener("click", () => $("logDlg").close());
addEventListener("resize", draw);
window.__quest = { page, get view() { return V; }, opts };
// the first time, a game is dealt at once: the table is the menu
if (!page.view.G && !page.atTable && !IN_FRAME && !new URLSearchParams(location.search).get("table")) newGame();
draw();
