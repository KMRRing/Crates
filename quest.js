// Quest: the loyal and the traitors among them, five to ten at a round table, against the computer or with friends
// each on their own phone. The rules are quest-rules.js's, the computer players quest-bot.js's, the running seats.js's
// (solo, or a table through seats-ui.js). This page seats everyone round an oval, you at the foot and the lead passing
// clockwise, the quests in the middle; your role and what it lets you know under it (beside it, held sideways), and
// your part in the step: name a party (a tap on each player), approve or refuse one, succeed or fail a quest, or, when
// the traitors confer at the end, name the Seer. Votes and quest cards can be given before your turn comes: they're
// sent when it does. A tap on a player at any other time is talk: accuse them, say you trust them, or take it back;
// what's been said of each shows at their foot, the newest line under the table, and the computer players talk too
// (questChat, from the device that runs the table).
import { rules, EVIL_COUNT, SIZES, SHOW_MS, isEvil, knowledge, talk, stances, named } from "./quest-rules.js";
import { LEVEL_NAMES, questChat } from "./quest-bot.js";
import { seatPage } from "./seats-ui.js";
import { seeded, mix } from "./seats.js";
import { bindSwitcher, APPS } from "./apps.js";
import { part, choice, ticks, toggle, action, line, isPaused, onPause } from "./menu.js";
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

let opts = { players: 7, roles: ["seer", "guardian"], level: "medium", voice: true, chat: true, ...read(OPTS, {}) };
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
  up: `<path d="M2.4 8.4H5.9V17.4H2.4Z" fill="currentColor"/><path d="M7.2 9L10.3 2.9C10.8 2 12.6 2.2 12.6 3.8L12.2 7.6H16.3C17.4 7.6 18.2 8.6 17.9 9.7L16.4 16C16.2 16.8 15.5 17.4 14.7 17.4H7.2Z" fill="currentColor"/>`,
  down: `<g transform="rotate(180 10 10)"><path d="M2.4 8.4H5.9V17.4H2.4Z" fill="currentColor"/><path d="M7.2 9L10.3 2.9C10.8 2 12.6 2.2 12.6 3.8L12.2 7.6H16.3C17.4 7.6 18.2 8.6 17.9 9.7L16.4 16C16.2 16.8 15.5 17.4 14.7 17.4H7.2Z" fill="currentColor"/></g>`,
  speech: `<path d="M2.8 3.4H17.2V12.8H9.6L5.4 16.6V12.8H2.8Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
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
    case "assassin": return `A traitor. ${others} If the loyal win three quests, the traitors name the Seer: yours is the last word.`;
    case "impostor": return `A traitor, and to the Guardian you look like the Seer. ${others}`;
    case "veiled": return `A traitor the Seer can't see. ${others}`;
    case "hermit": return "A traitor on your own: the others don't know you, nor you them.";
    default: return `A traitor. ${others} Fail three quests.`;
  }
}

// ---------- the talk, in words ----------
// A computer player's word is said in its own words, by its reason (why: quest-bot.js), the target always after the
// verb, so that "you" fits; a person's is told.
const SAYS = {
  accuse: {
    fail: ["I don't trust {x}: that quest failed with {x} on it.", "My money's on {x} for that fail."],
    fails: ["Failed quest after failed quest, and {x} on them.", "I keep seeing {x} on the quests that fail."],
    lead: ["The party that failed was chosen by {x}.", "I don't like the party chosen by {x}."],
    votes: ["The party that failed was waved through by {x}.", "I'm watching {x}: an approval for the party that failed."],
    agree: ["I'm with the others on {x}.", "I have my doubts about {x} too."],
    back: ["Me? I'd look at {x} instead.", "Says {x}. Ask yourselves why."],
    gut: ["I don't trust {x}.", "Something about {x} doesn't sit right."],
  },
  trust: {
    clean: ["Only good quests for {x} so far. I trust {x}.", "I trust {x}: every quest with {x} on it succeeded."],
    defend: ["Leave {x} alone.", "I believe {x}."],
    votes: ["I trust {x}: a vote against the party that failed.", "Good votes from {x}."],
    gut: ["I trust {x}.", "I'd go on a quest with {x}."],
  },
  dropAccuse: ["I may have been wrong about {x}.", "I'm not so sure about {x} now."],
  dropTrust: ["I'm less sure of {x} now.", "I'd think twice about {x} now."],
  deny: ["Not me.", "I'm loyal. Look elsewhere.", "Wrong. I'm loyal.", "That isn't me."],
  name: {
    votes: ["The Seer is {x}: never a vote for a party with one of us on it.", "I say {x}: voted like someone who knew."],
    talk: ["Strike at {x}: named us too well.", "I say {x}. Too sure of us, too soon."],
    gut: ["My guess is {x}.", "I'd say {x}."],
    agree: ["Agreed: strike at {x}.", "I'm with that: strike at {x}."],
  },
};
/** The line s.talk[i] as the page shows it: the speaker's name, and their words or what they did. */
function lineHtml(s, i) {
  const l = s.talk[i], obj = p => esc(isMe(p) ? "you" : nameOf(p)), by = `<b>${esc(Who(l.by))}</b>`;
  if (l.why) {
    // what a dropped word was: the speaker's last one of that player before it
    const was = l.t === "drop" ? s.talk.slice(0, i).findLast(x => x.by === l.by && x.seat === l.seat && (x.t === "accuse" || x.t === "trust"))?.t : null;
    const words = l.t === "deny" ? SAYS.deny : l.t === "drop" ? (was === "trust" ? SAYS.dropTrust : SAYS.dropAccuse) : SAYS[l.t]?.[l.why] || SAYS[l.t]?.gut || [""];
    return `${by}: ${esc(words[(i + l.by) % words.length]).replaceAll("{x}", obj(l.seat))}`;
  }
  const me = isMe(l.by), verb = (one, many) => (me ? one : many);
  if (l.t === "accuse") return `${by} ${verb("accuse", "accuses")} ${obj(l.seat)}`;
  if (l.t === "trust") return `${by} ${verb("trust", "trusts")} ${obj(l.seat)}`;
  if (l.t === "drop") return `${by} ${verb("take", "takes")} back what ${me ? "you" : "they"} said of ${obj(l.seat)}`;
  if (l.t === "name") return `${by} ${verb("name", "names")} ${obj(l.seat)} as the Seer`;
  return `${by} ${verb("say", "says")}: not me`;
}

// ---------- the table ----------
let V = null, roleShown = true;
// your part in the step: the party you're naming or the one you'd strike, a vote or a card given before your turn
// (sent the moment it comes), and, leading, whether a tap on a player talks instead of choosing; and the player whose
// talk card is open, which stays open from step to step
let ui = { key: "", pick: [], queued: null, sent: false, talking: false };
let popSeat = null;
let page = null;
page = seatPage({
  // app 2: the talk and the traitors' strike (a phone on older code at the table is asked to update)
  rules, id: "quest", app: 2, botName: s => NAMES[s % NAMES.length], level: () => opts.level, voice: () => opts.voice,
  // a vote or a card is secret till all are in: nothing to watch, so the computer gives its own at once; the
  // computer's strike waits for the traitors' words
  pace: s => (s.step === "vote" || s.step === "quest" ? 240 : s.step === "assassin" ? 2000 : 1000),
  onView: v => { V = v; draw(); }, onOver, toast, newGame,
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
    if (ui.key !== key) ui = { key, pick: [], queued: null, sent: false, talking: false };
    if (ui.queued && !ui.sent && rules.toMove(s) === V.seat && (s.step === "vote" || s.step === "quest")) {
      ui.sent = true;
      page.move(ui.queued).then(why => { if (why) { toast(why); ui.queued = null; ui.sent = false; draw(); } });
    }
  }
  // what's under the table first: the table takes the room it leaves, measured as the players are placed
  feedOf(V);
  drawRole(V);
  drawControls(V);
  drawFeed(V);
  drawCentre(V);
  drawRing(V);
  drawPop(V);
  chatSoon();
}

// ---------- what's said: the narrator's lines and the talk, newest last ----------
// Kept on this phone as they come (a game opened anew starts from its last few words); the newest shows under the
// table, more of them held sideways. The one who just spoke is marked at the table for a moment.
let feed = { seq: null, n: 0, talk: 0, items: [], drawn: "" };
let spoke = { by: null, at: 0 }, spokeTimer = 0;
const SPOKE_MS = 3500;
function feedOf(v) {
  if (!v?.G) { feed = { seq: null, n: 0, talk: 0, items: [], drawn: "" }; return; }
  const s = v.state, n = v.G.say?.n || 0;
  if (feed.seq !== v.G.seq) {
    // the narrator's line goes before the last few words, unless those were said before this party's vote
    feed = { seq: v.G.seq, n, talk: s.talk.length, items: s.talk.slice(-3).map((_, j, a) => ({ line: s.talk.length - a.length + j })), drawn: "" };
    if (v.said) feed.items.splice(s.talk.at(-1)?.k === s.log.length ? 0 : feed.items.length, 0, { say: v.said });
    return;
  }
  if (n > feed.n && v.said) feed.items.push({ say: v.said });
  feed.n = n;
  for (let i = feed.talk; i < s.talk.length; i++) { feed.items.push({ line: i }); spoke = { by: s.talk[i].by, at: performance.now() }; }
  feed.talk = s.talk.length;
  feed.items = feed.items.slice(-8);
}
function drawFeed(v) {
  const s = v?.G && v.state;
  const html = feed.items.map(it => (it.say ? `<span class="say">${esc(it.say)}</span>` : s?.talk[it.line] ? `<span class="talk">${lineHtml(s, it.line)}</span>` : ""));
  const key = html.join("|");
  if (key === feed.drawn) return;
  feed.drawn = key;
  $("statusOld").innerHTML = html.slice(0, -1).map(h => `<p>${h}</p>`).join("");
  $("statusNow").innerHTML = html.at(-1) || "";
}
/** The seat whose word is new, while it is (and a redraw when it no longer is). */
function speaking() {
  const left = SPOKE_MS - (performance.now() - spoke.at);
  clearTimeout(spokeTimer);
  if (spoke.by == null || left <= 0) return null;
  spokeTimer = setTimeout(draw, left + 30);
  return spoke.by;
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

/**
 * Everyone round the table: name, the lead, the party, the votes, what your role lets you know of them, and what's been
 * said of them (accused, trusted; named as the Seer while the traitors confer, when the table sees who they are).
 */
function drawRing(v) {
  const ring = $("ring");
  ring.querySelectorAll(".qs-chip").forEach(c => c.remove());
  if (!v?.G) return;
  const s = v.state, n = s.seats, mine = v.seat ?? 0, over = s.step === "over", open = s.step === "assassin";
  const known = v.seat != null ? knowledge(s.roles, v.seat) : {};
  const last = s.log.at(-1), fresh = s.step === "shown" && s.show === "vote";
  const picking = pickMode(v), turn = rules.toMove(s), talker = speaking();
  const party = s.step === "propose" ? (isMe(s.leader) ? ui.pick : []) : s.team;
  const st = stances(s), names = Object.values(named(s)), myWord = v.seat != null ? st[v.seat] : {};
  const html = [];
  for (let p = 0; p < n; p++) {
    const cls = ["qs-chip"], evil = isEvil(s.roles[p]);
    if (isMe(p)) cls.push("me");
    if (party.includes(p)) cls.push("party");
    if (picking && ui.pick.includes(p)) cls.push("picked");
    if (popSeat === p) cls.push("asked");
    if (turn === p && !over && s.step !== "vote" && s.step !== "quest") cls.push("turn");
    if (over) cls.push(evil ? "side-evil" : "side-good");
    else if (known[p] === "evil" || ((isMe(p) || open) && evil)) cls.push("evil");
    if (over && s.target === p) cls.push("struck");
    // the tag under the name: your role, what you know of them, or (conferring, and at the end) the traitors' roles
    let tag = "";
    if (over || isMe(p) || (open && evil)) tag = `${icon(s.roles[p])}${SHORT[s.roles[p]]}`;
    else if (known[p] === "evil") tag = `${icon("traitor")}traitor`;
    else if (known[p] === "seer?") tag = `${icon("seer")}${s.roles.includes("impostor") ? "Seer?" : "Seer"}`;
    // the vote: given (unseen) while it goes on, then each one, until the next
    let vote = "";
    if (s.step === "vote") vote = s.votes[p] !== null ? `<span class="qs-vote done" title="Voted"></span>` : "";
    else if (last && !over) vote = `<span class="qs-vote ${last.votes[p] ? "yes" : "no"}${fresh ? "" : " old"}">${icon(last.votes[p] ? "yes" : "no")}</span>`;
    const played = s.step === "quest" && s.team.includes(p) && s.cards[p] !== null ? `<span class="qs-played" title="Played"></span>` : "";
    // what's said of them, at their foot: how many accuse them and trust them (yours ringed), or name them the Seer
    const acc = st.filter((w, a) => a !== p && w[p] === "accuse").length, tru = st.filter((w, a) => a !== p && w[p] === "trust").length;
    const nm = names.filter(x => x === p).length;
    let said = "";
    if (open) said = nm ? `<i class="named" title="Named as the Seer">${icon("assassin")}${nm}</i>` : "";
    else if (!over) said = `${acc ? `<i class="acc${myWord[p] === "accuse" ? " mine" : ""}" title="Accused">${icon("down")}${acc}</i>` : ""}${tru ? `<i class="tru${myWord[p] === "trust" ? " mine" : ""}" title="Trusted">${icon("up")}${tru}</i>` : ""}`;
    const label = `${nameOf(p)}${isMe(p) ? " (you)" : ""}${s.leader === p && !over ? ", leading" : ""}${party.includes(p) ? ", in the party" : ""}${acc ? `, accused by ${acc}` : ""}${tru ? `, trusted by ${tru}` : ""}${nm ? `, named by ${nm}` : ""}`;
    // a tap: chooses, while you name a party or the Seer; else opens what's said of them (to say your own)
    const tap = picking ? (picking === "team" || canStrike(s, p) ? `aria-pressed="${ui.pick.includes(p)}"` : "disabled") : over || open ? "disabled" : `aria-haspopup="dialog" aria-expanded="${popSeat === p}"`;
    html.push(`<button type="button" class="${cls.join(" ")}" data-seat="${p}" ${tap} aria-label="${esc(label)}">
      ${s.leader === p && !over ? `<span class="qs-lead" title="Leads">${icon("crown")}</span>` : ""}${party.includes(p) && s.step !== "propose" ? `<span class="qs-flag" title="In the party">${icon("flag")}</span>` : ""}${talker === p ? `<span class="qs-speak" title="Speaking">${icon("speech")}</span>` : ""}
      <b class="qs-name">${esc(nameOf(p))}</b><span class="qs-tag">${tag}</span>${vote}${played}${said ? `<span class="qs-said">${said}</span>` : ""}</button>`);
  }
  ring.insertAdjacentHTML("beforeend", html.join(""));
  placeChips(ring, n, mine);
}
/**
 * What a tap on a player does now: "team" (you're naming a party, unless you'd rather talk first), "kill" (the strike is
 * yours), "name" (a traitor telling the one who strikes whom they think is the Seer), or null (it opens what's said).
 */
function pickMode(v) {
  if (!v?.G || v.seat == null) return null;
  const s = v.state;
  if (s.step === "propose" && s.leader === v.seat && !ui.talking) return "team";
  if (s.step === "assassin" && isEvil(s.roles[v.seat])) return rules.toMove(s) === v.seat ? "kill" : "name";
  return null;
}
/** The Seer is among the loyal: the traitors know each other now. */
const canStrike = (s, p) => !isEvil(s.roles[p]);

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
    const why = { rejects: "five parties refused", quests: s.side === "evil" ? "three quests failed" : "three quests won", assassin: "the traitors named the Seer", safe: "the Seer was never found" }[s.why];
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
  if (s.step === "assassin") { const k = rules.toMove(s); return `<small>Three quests won, but</small><b>the traitors confer</b><small>${esc(Who(k))} ${isMe(k) ? "strike" : "strikes"} at the Seer</small>`; }
  return "";
}

/**
 * The talk card for the player tapped, by their chip: who accuses and who trusts them, and your word of them (Accuse,
 * Trust; pressed again, taken back); yours, who accuses you, and Not me. Shut at a tap outside it.
 */
function drawPop(v) {
  const pop = $("pop"), s = v?.G && v.state, p = popSeat;
  if (p == null || !s || s.step === "over" || s.step === "assassin" || p >= s.seats) { popSeat = null; pop.hidden = true; return; }
  const st = stances(s), me = v.seat;
  const by = t => st.map((w, a) => (a !== p && w[p] === t ? a : -1)).filter(a => a >= 0);
  const names = l => list(l.map(a => (isMe(a) ? "you" : nameOf(a))));
  const acc = by("accuse"), tru = by("trust"), word = me != null && p !== me ? st[me][p] : null;
  const said = [acc.length ? `accused by ${names(acc)}` : "", tru.length ? `trusted by ${names(tru)}` : ""].filter(Boolean).join("; ");
  let body = `<small class="qs-pop-said">${said ? esc(said[0].toUpperCase() + said.slice(1)) : "Nobody has said anything of them yet"}</small>`;
  if (me != null && p !== me) {
    body += `<div class="qs-pop-btns"><button class="btn qs-say acc" type="button" data-say="accuse" aria-pressed="${word === "accuse"}">${icon("down")}${word === "accuse" ? "Accused" : "Accuse"}</button>
      <button class="btn qs-say tru" type="button" data-say="trust" aria-pressed="${word === "trust"}">${icon("up")}${word === "trust" ? "Trusted" : "Trust"}</button></div>
      ${word ? `<small class="qs-pop-note">Tap it again to take it back</small>` : ""}`;
  } else if (p === me && acc.length) body += `<div class="qs-pop-btns one"><button class="btn qs-say" type="button" data-say="deny">Not me</button></div>`;
  pop.innerHTML = `<b class="qs-pop-name">${esc(p === me ? "You" : nameOf(p))}</b>${body}`;
  pop.setAttribute("aria-label", p === me ? "What's said of you" : `What's said of ${nameOf(p)}`);
  pop.hidden = false;
  // by the chip, toward the middle of the table, inside it
  const ring = $("ring"), chip = ring.querySelector(`.qs-chip[data-seat="${p}"]`);
  if (!chip) return;
  const W = ring.clientWidth, H = ring.clientHeight, cx = parseFloat(chip.style.left), cy = parseFloat(chip.style.top), ch = chip.offsetHeight;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const y = cy > H / 2 ? cy - ch * 0.85 - ph - 4 : cy + ch / 2 + 10;
  pop.style.left = `${Math.min(Math.max(4, cx - pw / 2), W - pw - 4).toFixed(1)}px`;
  pop.style.top = `${Math.min(Math.max(4, y), H - ph - 4).toFixed(1)}px`;
}
function openPop(p) {
  popSeat = popSeat === p ? null : p;
  draw();
  if (popSeat != null) $("pop").querySelector("button")?.focus({ preventScroll: true });
}
const closePop = () => { if (popSeat != null) { popSeat = null; draw(); } };

/**
 * Your word at the table. It isn't a move (the game never waits on it), so it goes on the table as a change of its
 * own, worked out on what's there. Resolves whether it was said.
 */
async function speak(m) {
  const v = V, t = page.runner.table;
  if (!v?.G || v.seat == null || IN_FRAME) return false;
  const first = talk(rules.restore(structuredClone(v.G.state)), v.seat, m);
  if (typeof first === "string") { toast(first); return false; }
  let why = "";
  const ok = await t.act(cur => {
    if (!cur.game || cur.game.seq !== v.G.seq) { why = "That game has ended"; return false; }
    const r = talk(rules.restore(structuredClone(cur.game.state)), v.seat, m);
    if (typeof r === "string") { why = r; return false; }
    cur.game = { ...cur.game, state: r };
  });
  if (!ok) toast(why || "That wasn't heard: try again");
  return ok;
}

// ---------- the computer players' talk ----------
// A word isn't a move, so the runner doesn't make the computer's: the device that runs the table (solo, this one)
// lets them speak in the lulls, one at a time, a beat after the table last changed (each change puts it off, so they
// talk while someone thinks or a result is shown, not over the moves), a word back sooner. At most three words of
// their own a step; a word back is always let through. Off in the menu, they keep their counsel (they still weigh
// what's said).
const BEAT = 1300, ANSWER = 800, CONFER = 900;
let chatTimer = 0, chatStep = { key: "", from: 0 };
function chatSoon() {
  clearTimeout(chatTimer);
  const v = V, t = page.runner.table;
  if (!opts.chat || !v?.G || v.over || IN_FRAME || !(t.local || t.me?.driver) || (t.local && isPaused())) return;
  const s = v.state, key = `${v.G.seq}:${s.step}:${s.log.length}`;
  if (chatStep.key !== key) chatStep = { key, from: s.talk.length };
  const last = s.talk.at(-1), answer = last?.t === "accuse" && v.seats[last.seat]?.bot;
  chatTimer = setTimeout(chatNow, answer ? ANSWER : s.step === "assassin" ? CONFER : BEAT + Math.floor(Math.random() * 600));
}
function chatNow() {
  const t = page.runner.table, seats = page.view.seats, level = opts.level, from = chatStep.from;
  t.act(cur => {
    const G = cur.game;
    if (!G || (t.local && isPaused())) return false;
    const s = rules.restore(structuredClone(G.state));
    if (rules.over(s)) return false;
    const own = s.talk.slice(from).filter(l => seats[l.by]?.bot && l.why !== "back").length;
    // round the table from the leader, whoever was just accused first
    const last = s.talk.at(-1), first = last?.t === "accuse" ? last.seat : null;
    const order = Array.from({ length: s.seats }, (_, i) => (s.leader + 1 + i) % s.seats).filter(p => seats[p]?.bot).sort((a, b) => (b === first) - (a === first));
    for (const p of order) {
      const m = questChat(s, p, level, seeded(mix(G.seed ^ 0x7A1C, G.n * 4096 + s.talk.length * 16 + p)), { quiet: own >= 3 });
      const r = m && talk(s, p, m);
      if (!r || typeof r === "string") continue;
      cur.game = { ...G, state: r };
      return;
    }
    return false;
  });
}
onPause(() => clearTimeout(chatTimer), () => chatSoon());

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
    // leading, a tap chooses; Talk turns it to talk until you've said your word
    box.innerHTML = `<p class="qs-hint">${ui.talking ? "Tap a player to accuse them or say you trust them" : `Choose ${q.size} for the party: tap them round the table (you may go yourself)`}</p>
      <div class="qs-lead-go"><button class="btn qs-talk-btn" type="button" data-act="talk" aria-pressed="${ui.talking}">${ui.talking ? "Choose" : "Talk"}</button>
      <button class="btn primary qs-go" type="button" data-act="team" ${k === q.size ? "" : "disabled"}>${k === q.size ? "Send this party" : `${k} of ${q.size} chosen`}</button></div>`;
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
    // the traitors confer: the one who strikes chooses, the others tell them whom they'd name, the loyal wait
    const k = rules.toMove(s);
    if (k === me) {
      // what the other traitors say, in short: who names whom
      const by = new Map();
      for (const [a, x] of Object.entries(named(s))) if (Number(a) !== me) by.set(x, [...(by.get(x) || []), nameOf(Number(a))]);
      const advice = [...by].map(([x, l]) => `${list(l)} ${l.length > 1 ? "name" : "names"} ${nameOf(x)}`).join("; ");
      const t = ui.pick[0];
      box.innerHTML = `<p class="qs-hint">${t == null ? `The strike is yours: tap the Seer${advice ? `. ${esc(advice)}` : ""}` : "Strike, or tap another"}</p>
        <button class="btn primary qs-go" type="button" data-act="kill" ${t == null ? "disabled" : ""}>${t == null ? "Choose the Seer" : `Strike ${esc(nameOf(t))}`}</button>`;
    } else if (isEvil(s.roles[me])) {
      const mine = named(s)[me];
      box.innerHTML = `<p class="qs-hint">${mine == null ? `Tell ${esc(nameOf(k))}, who strikes, whom you think is the Seer: tap them` : `You named ${esc(nameOf(mine))}: ${esc(nameOf(k))} strikes`}</p>`;
    } else box.innerHTML = `<p class="qs-hint">The traitors are choosing whom to strike: ${esc(nameOf(k))} has the last word</p>`;
    return;
  }
  box.innerHTML = `<p class="qs-hint">&nbsp;</p>`;
}

$("ring").addEventListener("click", async e => {
  if (e.target.closest("[data-act=log]")) { showLog(); return; }
  const said = e.target.closest("#pop [data-say]");
  if (said) {
    const p = popSeat, t = said.dataset.say, word = V?.seat != null ? stances(V.state)[V.seat][p] : null;
    // pressed again, a word is taken back
    const m = t === "deny" ? { t } : { t: word === t ? "drop" : t, seat: p };
    if (await speak(m)) { popSeat = null; ui.talking = false; draw(); }
    return;
  }
  const chip = e.target.closest(".qs-chip");
  if (!chip || chip.disabled || !V?.G) return;
  const p = Number(chip.dataset.seat), mode = pickMode(V);
  if (mode === "team") {
    const size = V.state.quests[V.state.q].size;
    if (ui.pick.includes(p)) ui.pick = ui.pick.filter(x => x !== p);
    else if (ui.pick.length < size) ui.pick = [...ui.pick, p];
    else ui.pick = [...ui.pick.slice(1), p];                    // full: the first chosen makes way
  } else if (mode === "kill") ui.pick = ui.pick[0] === p ? [] : [p];
  else if (mode === "name") { speak({ t: "name", seat: p }); return; }
  else { openPop(p); return; }
  draw();
});
// a tap anywhere else shuts the talk card; so does Escape
document.addEventListener("click", e => { if (popSeat != null && !e.target.closest("#pop, .qs-chip")) closePop(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && popSeat != null) closePop(); });
$("controls").addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled || !V?.G) return;
  const act = b.dataset.act;
  if (act === "new") { newGame(); return; }
  if (act === "result") { showEnd(V); return; }
  if (act === "talk") { ui.talking = !ui.talking; if (!ui.talking) popSeat = null; draw(); return; }
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

// ---------- the parties so far, and what was said between them ----------
function showLog() {
  const s = V?.state;
  if (!s) return;
  // the words said after k parties had been voted on
  const words = k => s.talk.flatMap((l, i) => (l.k === k ? [`<li class="qs-log-talk">${lineHtml(s, i)}</li>`] : []));
  const rows = [...words(0), ...s.log.flatMap((l, k) => [party(l), ...words(k + 1)])];
  $("logBody").innerHTML = rows.length ? `<ol class="qs-log-list">${rows.reverse().join("")}</ol>` : `<p class="qs-rules-note">No party named yet.</p>`;
  $("logDlg").showModal();
}
/** A party in the sheet: who named whom, who voted how, how it went. */
function party(l) {
  const yes = [], no = [], quest = V.state.quests[l.q], failed = l.fails >= (quest.two ? 2 : 1);
  l.votes.forEach((v, p) => (v ? yes : no).push(esc(Who(p))));
  const out = !l.approved ? "refused" : l.fails === undefined ? "on the quest" : `the quest ${failed ? "failed" : "succeeded"}${l.fails ? ` (${l.fails} ${l.fails === 1 ? "fail" : "fails"})` : ""}`;
  const cls = !l.approved ? "refused" : l.fails === undefined ? "" : failed ? "fail" : "success";
  return `<li class="${cls}"><div class="qs-log-head"><b>Quest ${l.q + 1}</b><span>${esc(Who(l.leader))} named ${esc(list(l.team.map(Who)))}</span></div>
    <div class="qs-log-votes"><span class="y">${icon("yes")}${yes.join(", ") || "nobody"}</span><span class="n">${icon("no")}${no.join(", ") || "nobody"}</span></div>
    <div class="qs-log-out">${l.approved ? "Approved" : "Refused"} ${yes.length}–${no.length}${l.approved ? `: ${out}` : ""}</div></li>`;
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
  const struck = s.striker != null && isMe(s.striker) ? "you" : "the traitors";
  const why = { rejects: "Five parties were refused in a row.", quests: s.side === "evil" ? "Three quests failed." : "Three quests succeeded, and there was no Seer to find.", assassin: `Three quests succeeded, but ${struck} named ${who(s.target)}: the Seer.`, safe: `Three quests succeeded, and ${struck} named ${who(s.target)}, not the Seer.` }[s.why];
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
    <p class="qs-role-line">${icon("seer")}<span><b>The Seer</b> (loyal) knows the traitors. If the loyal win three quests, the traitors name whom they think is the Seer, and naming them wins it for the traitors. So the Seer steers, but quietly.</span></p>
    <p class="qs-role-line">${icon("assassin")}<span><b>The Assassin</b> (a traitor) has the last word on whom the traitors name.</span></p>
    <p class="qs-role-line">${icon("guardian")}<span><b>The Guardian</b> (loyal) knows the Seer and the <b>Impostor</b> ${icon("impostor")} (a traitor), but not which is which.</span></p>
    <p class="qs-role-line">${icon("veiled")}<span><b>The Veiled</b> (a traitor) is hidden from the Seer.</span></p>
    <p class="qs-role-line">${icon("hermit")}<span><b>The Hermit</b> (a traitor) doesn't know the other traitors, nor they the Hermit.</span></p>
    <p class="qs-role-line">${icon("loyal")}<span><b>Loyal knights</b> know only themselves; the other <b>traitors</b> ${icon("traitor")} know each other.</span></p>
    <p>Choose the roles in the menu: the Guardian and the Veiled come only with the Seer, and a table has room for as many traitors' roles as it has traitors (the last chosen go first).</p>
    <h3>The strike</h3>
    <p>When the loyal have won three quests, the traitors confer: they know each other now (and the table sees who they are), each may name whom they think is the Seer, and then one strikes. The Assassin, when a person plays them; if the computer does, a traitor a person plays; with no person among the traitors, the computer's Assassin, going with the name most of them gave.</p>
    <h3>Talk</h3>
    <p>Tap a player to accuse them of being a traitor, or to say you trust them; tap the same again to take it back. You can accuse no more players than there are traitors. What's been said of each player shows at their foot (${icon("down")} accused, ${icon("up")} trusted, yours ringed), the newest line under the table, and all of it in the parties so far. Leading, tap Talk to speak before you choose.</p>
    <p>The computer players weigh what's said by who says it: a loyal player's accusation leans true, a traitor seldom accuses another, so an accusation from someone under suspicion counts for its target. They speak their minds too, answer when accused, and the traitors among them lie.</p>
    <h3>Playing</h3>
    <p>The quests are in the middle (tap them for every party so far, who led it and who voted how, and what was said); round them the table, you at the foot. Votes and quest cards can be given before your turn: they're kept secret till all are in. At a table, each sees only their own role: tap yours to cover it. Accusing, defending and bluffing out loud is the game.</p>
    <p class="qs-rules-note">The computer players reason from what their role lets them know and from the play: who led which party, who voted how, which quests failed with whom on them, who said what of whom. On Sharp a traitor votes much as a loyal player would and the Seer hides what it knows; on Easy they're looser all round.</p>`;
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
  set.append(toggle("The computer players talk", opts.chat, on => { opts.chat = on; saveOpts(); }));
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
