// Lots, Crates' Classic (README, Lots): sixteen words, four lots of four, sorted by wordplay. The rules and the bank are
// lots-engine.js's, a board as you play it lots-run.js's and the pair's table lots-room.js's; the board's look is
// crates-board.js's, shared with Countries; this file keeps the run, the clock and the taps. Three ways to play: alone
// (today's board for everyone, or a random one), the pair at one board (open, crossed or hidden), and a race on one board
// through duel.js, for a pair or a party.
import { SIZE, MISTAKES, LEVELS, LEVEL_NAMES, TOPICS, BY_ID, deal, daily, reason, fits, shuffle } from "./lots-engine.js";
import { newRun, isRun, pick, clearPicks, shuffleLeft, submit, tick, placedOf, scoreOf, dayScore, rainbow } from "./lots-run.js";
import * as room from "./lots-room.js";
import { drawBoard as paintBoard, fitWords, shake, drawCount, createLine, setControls as paintControls, lotSheet, modeChoice } from "./crates-board.js";
import { sure } from "./sure.js";
import { bindSwitcher, APPS } from "./apps.js";
import "./pwa.js";
import { dropdown } from "./dropdown.js";
import { part, choice, action, line, mirror, onPause, isPaused } from "./menu.js";
import { topicsPart } from "./topics-ui.js";
import { subjectsOn } from "./topics-on.js";
import { today, arrivedForToday, IN_FRAME, soloHref } from "./suite.js";
import { roundOver } from "./random.js";
import { createTogether } from "./together.js";
import { createDuel } from "./duel.js";
import { busy, waitMark } from "./loading.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { TOPIC_OF, mixFromSubjects } from "./topics.js";

const $ = id => document.getElementById(id);
const RUN = "lots:run", PREFS = "lots:prefs", SEEN = "lots:seen", STATS = "lots:stats", DAILY = "lots:daily", BEST = "lots:best";
const ROOM_APP = 1, RACE_APP = 1;
const SQUARES = ["🟨", "🟩", "🟦", "🟥"];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { if (IN_FRAME) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inWords = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][n] ?? String(n);
const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)), m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };
const list2 = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const nameOfCat = id => BY_ID.get(id)?.name || "";

// ---------- what you've chosen ----------
// (an old save's play (the wall, which Lots no longer has) and rival (against the computer, gone too) are ignored)
function cleanPrefs(p) {
  p = p && typeof p === "object" ? p : {};
  return {
    level: LEVELS.includes(p.level) ? p.level : "medium",
    duo: room.MODES[p.duo] ? p.duo : "hidden",
  };
}
let prefs = cleanPrefs(read(PREFS, null));
const keepPrefs = () => write(PREFS, prefs);

// ---------- the page ----------
const el = { board: $("board"), what: $("what"), count: $("count"), sub: $("sub"), controls: $("controls"), feed: $("feed"),
  shuffle: $("shuffleBtn"), clear: $("clearBtn"), submit: $("submitBtn"), level: $("level") };
let mode = "solo";             // "solo", "duo" (the pair at one board) or "race" (duel.js)
let S = null;                  // the run on the board, alone or in a race
let G = null;                  // the pair's table, as last seen
let fresh = false;             // a board was just put down: no lot lands on it
const talk = createLine($("line"), () => promptText());   // the line under the board
const say = talk.say, drawLine = talk.draw;
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

/**
 * Draws a board: lots (found ones first, as bars in their enamel, then at the end the ones missed) and the tiles
 * still in play. tiles: [{ w, text, sel, sealed, theirs, who }]; lots: [{ g, rank, name, words, by, missed, note }].
 */
function drawBoard(lots, tiles, { off = false } = {}) {
  paintBoard(el.board, {
    lots: lots.map(l => ({ ...l, onTap: l.note ? () => lotSheet({ title: l.name, lines: l.note }) : null })),
    tiles: tiles.map(t => ({ ...t, id: t.w })), on: { tap }, off, fresh,
  });
  fresh = false;
}
const shakeBoard = () => shake(el.board);
const dots = left => drawCount(el.count, { mistakes: { left, max: MISTAKES } });
/** What the line says when nothing has just happened. */
function promptText() {
  if (mode === "duo") return duoPrompt();
  if (!S) return mode === "race" ? "The same sixteen for everyone at the table, once it starts." : "";
  if (S.done) return verdict(S);
  return S.sel.length === SIZE ? "Submit, or change a pick." : "Pick four words that belong together.";
}
const setControls = kind => paintControls(el.controls, { kind, next: mode === "race" ? "The result" : "Next board" });

// ---------- alone, or a run in a race: one board as you play it ----------
/** The lots on show: found ones in the order found, then (once it's over) the rest. */
const lotsOfRun = r => {
  const order = [...r.found, ...(r.done ? r.board.g.map((_, g) => g).filter(g => !r.found.includes(g)) : [])];
  return order.map(g => ({ g, rank: g, name: nameOfCat(r.board.g[g].c), words: r.board.g[g].w, missed: !r.found.includes(g), note: noteOf(r.board, g, r.done) }));
};
/** Why a lot's words belong, for its sheet: the reasons, and once the board is over its red herrings. */
function noteOf(board, g, over) {
  const c = BY_ID.get(board.g[g].c), why = board.g[g].w.map(w => reason(c, w)).filter(Boolean);
  const herrings = over ? board.g[g].w.flatMap(w => board.g.map((o, j) => (j !== g && fits(BY_ID.get(o.c), w) ? `${w} also fits ${nameOfCat(o.c)}.` : null)).filter(Boolean)) : [];
  return [...(why.length ? [why.join(", ")] : []), ...herrings.map(h => ["Red herring:", h])];
}
function drawRun() {
  const r = S;
  if (!r) { drawBoard([], []); drawFeed([]); el.what.textContent = mode === "race" ? "Race" : ""; drawCount(el.count); setControls("play"); el.submit.disabled = el.clear.disabled = el.shuffle.disabled = true; drawLine(); return; }
  const placed = placedOf(r);
  const tiles = r.done ? [] : r.order.filter(w => !placed.has(w)).map(w => ({ w, text: w, sel: r.sel.includes(w) }));
  drawBoard(lotsOfRun(r), tiles, { off: IN_FRAME });
  el.what.textContent = r.kind === "daily" ? "Today's board" : `${r.kind === "race" ? "Race" : "Classic"} · ${LEVEL_NAMES[r.level] || ""}`;
  dots(MISTAKES - r.mistakes);
  setControls(r.done ? "end" : "play");
  if (!r.done) {
    el.submit.disabled = IN_FRAME || r.sel.length !== SIZE;
    el.clear.disabled = IN_FRAME || !r.sel.length;
    el.shuffle.disabled = IN_FRAME;
  }
  if (mode === "solo") el.sub.hidden = true;                 // a race's and a pair's own line is duel.js's and the table's
  drawFeed(r.guesses.filter(x => x.r !== "right").map(x => ({ words: x.w, r: x.r })));
  drawLine();
}
/** Your wrong guesses so far, beside the board when it's held sideways (a phone has no room): a memory, not a hint. */
const RESULT = { one: "one away", miss: "not a lot", wrong: "wrong" };
function drawFeed(rows) {
  el.feed.replaceChildren(...rows.slice().reverse().map(x => {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = x.who ? `${x.who}: ${RESULT[x.r] || x.r}` : RESULT[x.r] || x.r;
    li.append(b, ` ${x.words.map(w => w ?? "▒").join(", ")}`);
    return li;
  }));
}
/** How the board went, in a line. */
function verdict(r) {
  const time = clock(r.ms), pts = `${scoreOf(r)} of 8`;
  const bits = [r.won ? (r.mistakes ? `Solved with ${plural(r.mistakes, "mistake")}` : "Perfect") : `Out of mistakes, ${plural(r.found.length, "lot")} found`, `${pts} in ${time}`];
  if (rainbow(r)) bits.push("a reverse rainbow");
  return `${bits.join(", ")}.`;
}

// the clock: time on screen for a board alone (it stands while the menu is open, or the page is away); a race's runs
// from the table's start, and doesn't stop
let clockFrom = null, savedAt = 0;
const ticking = () => mode === "solo" && !!S && !IN_FRAME && !S.done;
function clockRun() { if (!ticking() || clockFrom != null || document.hidden || isPaused()) return; clockFrom = performance.now(); }
function clockBook() {
  if (mode === "race" && S && !S.done) { S.ms = Math.max(0, duel.now() - S.begun); return; }
  if (clockFrom == null || !S) return;
  const now = performance.now();
  tick(S, now - clockFrom);
  clockFrom = now;
}
function clockStop() { clockBook(); clockFrom = null; }
onPause(() => { clockStop(); save(); }, () => clockRun());
function save() {
  if (IN_FRAME || !S) return;
  if (mode === "race") duel.keep(S); else if (mode === "solo") write(RUN, S);
  savedAt = performance.now();
}

/** A board on the table. */
function begin(r) {
  S = r;
  clockFrom = null;
  talk.clear();
  fresh = true;
  el.level.value = S.level;
  save();
  clockRun();
  drawRun();
}
function seenRecent() { return read(SEEN, []); }
function noteSeen(board) { write(SEEN, [...board.g.map(g => g.c), ...seenRecent().filter(id => !board.g.some(g => g.c === id))].slice(0, 80)); }
function newBoard(kind = "random") {
  const stats = read(STATS, {}), n = (stats.n || 0) + 1;
  write(STATS, { ...stats, n });
  if (kind === "daily") {
    const day = today();
    begin(newRun({ board: daily(day), kind: "daily", day, n }));
    return;
  }
  let board = deal({ seed: randomSeed(), level: prefs.level, weights: mixFromSubjects(TOPICS, TOPIC_OF.lots, subjectsOn()), recent: seenRecent() });
  if (!board) { toast("Those topics are too narrow for a board: this one deals from every topic"); board = deal({ seed: randomSeed(), level: prefs.level }); }
  noteSeen(board);
  begin(newRun({ board, kind: "random", n }));
}
const started = () => !!S && mode === "solo" && !S.done && (S.guesses.length > 0 || S.sel.length > 0);
const confirmLeave = (what = "Start a new board? This one isn't finished.") => (started() ? sure(what, { yes: "Leave it" }) : true);
const dayDone = (day = today()) => read(DAILY, {})[day] != null;
async function openToday() {
  if (S?.kind === "daily" && S.day === today()) { drawRun(); return; }
  if (dayDone()) {
    const v = read(DAILY, {})[today()], pts = Math.floor(v / 100000), secs = 99999 - (v % 100000);
    toast(`Today's board: ${pts}/8 in ${clock(secs * 1000)}. A new one tomorrow`);
    return;
  }
  if (!(await confirmLeave("Today's board is waiting. Leave the one you've started?"))) return;
  newBoard("daily");
}

// ---------- taps ----------
function tap(word) {
  if (IN_FRAME) return;
  if (mode === "duo") { duoTap(word); return; }
  if (!S) return;
  clockRun();
  clockBook();
  const r = pick(S, word);
  if (!r) return;
  if (r.res || r.why) { afterGuess(r); return; }
  talk.clear();
  save();
  drawRun();
}
function submitPicks() {
  if (IN_FRAME) return;
  if (mode === "duo") { duoSubmit(); return; }
  if (!S) return;
  clockBook();
  afterGuess(submit(S));
}
function afterGuess(r) {
  if (r.why === "tried") say("Already tried", "bad");
  else if (r.res === "right") say(nameOfCat(S.board.g[r.g].c), "good");
  else if (r.res === "one") { say("One away…", "bad"); shakeBoard(); }
  else if (r.res === "miss") { say("Not a lot", "bad"); shakeBoard(); }
  afterChange();
}
/** Whatever just changed the run: its end recorded the moment it's final, the race told. */
function afterChange() {
  if (S.done) { clockFrom = null; talk.clear(); finished(); }        // the verdict takes the line at once
  save();
  drawRun();
  if (mode === "race") tell();
}
/** The end of a board alone: today's figure and your stats. Once a board, the moment it's final. */
function finished() {
  if (mode !== "solo" || S.recorded || IN_FRAME) return;
  S.recorded = true;
  const stats = read(STATS, {});
  stats.played = (stats.played || 0) + 1;
  stats.solved = (stats.solved || 0) + (S.won ? 1 : 0);
  stats.perfect = (stats.perfect || 0) + (S.won && !S.mistakes ? 1 : 0);
  stats.streak = S.won ? (stats.streak || 0) + 1 : 0;
  stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak);
  const L = (stats.levels ||= {})[S.level] ||= { played: 0, solved: 0 };
  L.played++; if (S.won) L.solved++;
  write(STATS, stats);
  if (S.kind === "daily" && S.day && !dayDone(S.day)) {         // today's board: one go, counted now, points then time
    const days = read(DAILY, {}), v = dayScore(S);
    days[S.day] = v;
    write(DAILY, Object.fromEntries(Object.entries(days).sort(([a], [b]) => b - a).slice(0, 60)));
    write(BEST, Math.max(read(BEST, 0) || 0, v));
  }
  roundOver("lots");
}

// ---------- naming a link (Crossed: the lot your partner found) ----------
const nameDlg = $("nameDlg");
nameDlg.addEventListener("cancel", e => e.preventDefault());   // a link is named or got wrong, never skipped by Escape
/** Asks for a lot's link: head, its words, four links; onPick(id) → { right } to show before it closes. */
function askLink({ head, words, options, onPick, note = "" }) {
  $("nameHead").textContent = head;
  $("nameWords").textContent = words.join(" · ");
  $("nameNote").textContent = note;
  const box = $("nameOpts");
  box.replaceChildren(...options.map(id => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = nameOfCat(id);
    b.addEventListener("click", () => {
      for (const x of box.children) x.disabled = true;
      const res = onPick(id);
      if (res) {
        b.classList.add(res.right ? "right" : "wrong");
        if (!res.right) [...box.children][options.indexOf(res.answer)]?.classList.add("right");
        $("nameNote").textContent = res.right ? "Right" : `It was ${nameOfCat(res.answer)}`;
      }
      setTimeout(() => { if (nameDlg.open) nameDlg.close(); res?.after?.(); }, res ? 1100 : 0);
    });
    return b;
  }));
  if (!nameDlg.open) nameDlg.showModal();
}
// ---------- the menu ----------
let pickBoard = null;                                        // the board the menu will start: "random" or "daily"
function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  if (mode === "duo" || (mode !== "race" && roomInAddress() && !together.room)) duoMenu(body);
  else if (mode === "race") {
    duel.menu(part(body, "together"));
    part(body, "content").append(levelChoice());
  } else soloMenu(body);
  part(body, "play").append(action("The rules", showRules, "link"));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the rules ----------
// The menu's The rules: Classic as it's played here, its numbers the engine's own, so the sheet
// can't drift from the game. A board's clock stands still while it's open, as for the menu (menu.js).
function showRules() {
  $("rulesBody").innerHTML = `
    <p><b>Classic</b> is one of Crates' two ways to play, chosen at the top of the menu: Countries asks you to find four crates of four words and name the country behind each; Classic, here, gives you sixteen words in four hidden groups, its lots, and asks only that you find them.</p>
    <p><b>Guessing.</b> Pick four words and Submit. Four of one lot and it's found: a bar in its colour, its link named. Three of one lot is One away, anything else Not a lot; ${inWords(MISTAKES)} mistakes and the board is over. The same four can't be tried twice (trying costs nothing), and with three lots found the fourth falls into place.</p>
    <p><b>The lots.</b> Ranked from plain to devious and coloured ochre, green, blue and red. A link can be a set or a meaning, things with something (things with keys: PIANO, MAP), a phrase (___&nbsp;JACK: FLAP, CRACKER, LUMBER, APPLE), sounds alike (SEA, GEE, AYE and CUE sound like letters), or wordplay: a word hidden inside, an anagram, a letter added or taken off. Beware red herrings, words that fit two links. A tap on a lot's bar says why its words belong, and once the board is over every lot shows, with its herrings.</p>
    <p><b>Playing.</b> Tap a word to pick it and again to let it go; Deselect drops every pick, Shuffle reorders the words left, and Enter submits from a keyboard.</p>
    <p><b>Score.</b> A point a lot, and once all four are found a point for each mistake to spare: ${SIZE + MISTAKES} is perfect. Solving the hardest lot first and the plainest last is a reverse rainbow. Playing alone, the clock stands still while the menu or these rules are open.</p>
    <p><b>Levels.</b> In the header or the menu (the topics are Settings’): Easy, plain links and no red herrings; Medium, plain to devious, sometimes a herring; Hard, devious links, and always a herring that bites.</p>
    <p><b>Today's board.</b> Medium, classic, every topic, the same for everyone, and a new one at midnight UTC: one go. It counts the moment it's over, as points then time (7/8 in 1:23), and Share copies your guesses as coloured squares.</p>
    <p><b>Together.</b> The pair plays one board, one of three ways, chosen in the menu. ${Object.values(room.MODES).map(m => `<b>${m.label}</b>: ${m.blurb.replace(/^./, c => c.toLowerCase())}`).join(" ")} Or a race: the same board for everyone, the most points winning, then the quicker.</p>`;
  if (!$("rulesDlg").open) $("rulesDlg").showModal();
}
// the header's level, in the menu as everywhere (menu.js mirrors the select; its change handler deals)
const levelChoice = () => mirror("Level", el.level);
/** To Countries, Crates' own board, asking first if this one is unfinished. */
async function toCountries() {
  if (await confirmLeave("Leave this board unfinished?")) location.href = "crates.html"; else openMenu();
}
function soloMenu(body) {
  pickBoard ??= (S?.kind === "daily" && !S.done) || !dayDone() ? "daily" : "random";
  part(body, "play").append(action(S && !S.done ? "New board" : "Next board", async () => {
    if (pickBoard === "daily") { openToday(); return; }
    if (await confirmLeave()) newBoard();
  }, "primary"));
  const content = part(body, "content");
  content.append(...modeChoice("classic", toCountries), choice("Board", [["random", "Random"], ["daily", "Today's"]], pickBoard, v => { pickBoard = v; openMenu(); }));
  if (pickBoard === "random") {
    content.append(levelChoice(), ...topicsPart(content, "Today’s board deals from every one"));
  } else content.append(line(dayDone() ? "Today's board is done: a new one tomorrow." : "Today's board: Medium, the same for everyone."));
  part(body, "together").append(action("Invite players", () => { location.href = "party.html?game=lots&invite=1"; }, "link"));
  const st = read(STATS, {}), about = part(body, "about");
  const day = read(DAILY, {})[today()];
  about.append(line([st.played ? `${st.played} played, ${st.solved || 0} solved, ${st.perfect || 0} perfect` : "No board finished yet",
    st.bestStreak ? `best streak ${st.bestStreak}` : "", day != null ? `today ${Math.floor(day / 100000)}/8` : ""].filter(Boolean).join(" · ")));
}

// ---------- share ----------
async function share() {
  if (mode === "race") { duel.open(); return; }
  const r = mode === "duo" ? null : S;
  if (!r) return;
  const rows = r.guesses.map(x => x.w.map(w => SQUARES[r.board.g.findIndex(g => g.w.includes(w))]).join(""));
  const title = r.kind === "daily" ? `Crates Classic · today's board, ${String(r.day).replace(/(\d{4})(\d\d)(\d\d)/, "$3/$2/$1")}` : `Crates Classic · ${LEVEL_NAMES[r.level]}`;
  const text = [title, verdict(r), ...rows].join("\n");
  try { await navigator.clipboard.writeText(text); toast("Result copied"); } catch { toast("Couldn't copy the result"); }
}

// ---------- the pair at one board (together.js) ----------
let seenGuesses = 0, seenBoard = 0, duoOrder = null, naming = null;
const mySlot = () => together.slot ?? 0;
function askName() {
  try { const saved = localStorage.getItem("crates:name"); if (saved) return Promise.resolve(saved); } catch { /* private mode */ }
  const dlg = $("whoDlg"), input = $("whoInput");
  dlg.showModal();
  input.focus();
  return new Promise(res => $("whoForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 16);
    if (!name) { input.focus(); return; }
    dlg.close();
    try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
    res(name);
  }, { once: true }));
}
const together = createTogether({
  game: "lots", app: ROOM_APP, toast, askName,
  valid: room.isRoom,
  fresh: players => room.freshRoom(players, { seed: randomSeed(), level: prefs.level, mode: prefs.duo, app: ROOM_APP }),
  onState: val => {
    const fresh = mode !== "duo";
    mode = "duo";
    G = room.tidy(structuredClone(val));
    if (fresh || G.n !== seenBoard) { seenBoard = G.n; seenGuesses = G.guesses.length; duoOrder = null; talk.clear(); fresh = true; }
    else announce();
    if (G.race && G.race !== raceFollowed && Date.now() - G.race < 120000) { goRace(G.race); return; }
    drawDuo();
  },
  onPresence: () => { if (mode === "duo") drawDuo(); },
  onLeave: () => { G = null; mode = "solo"; if (nameDlg.open) nameDlg.close(); solo(); },
  result: val => room.resultOf(room.tidy(structuredClone(val))),
});
const partnerName = () => together.others()[0]?.name || "your partner";
const first = n => String(n || "").split(" ")[0];
function announce() {
  const me = mySlot(), v = room.viewFor(G, me);
  v.guesses.slice(seenGuesses).forEach(x => {
    const who = x.by === me ? null : first(partnerName());
    if (x.r === "right") say(who ? `${who} found a lot` : "A lot found", "good");
    else if (x.r === "wrong") say(`Wrong: ${first(partnerName())} saw how close`, "bad");
    else {
      const odd = x.odd != null ? (x.odd === me ? ", one of your picks is off" : `, one of ${first(partnerName())}'s picks is off`) : "";
      say(`${who ? `${who}: ` : ""}${x.r === "one" ? "one away" : "not a lot"}${odd}`, "bad", 4000);
      if (!who) shakeBoard();
    }
  });
  seenGuesses = v.guesses.length;
}
function duoPrompt() {
  if (!G) return "";
  const me = mySlot(), v = room.viewFor(G, me), them = first(partnerName());
  if (G.done) return `${G.won ? "Solved together" : "Out of mistakes"}: ${room.pointsOf(G)} of ${room.maxPoints(G)}. ${plural(G.tally.boards, "board")} at this table.`;
  if (G.pending) return G.pending.namer === me ? "Name the lot your partner found." : `${them} is naming the lot you found.`;
  if (!together.others().length) return "Waiting for your partner to sit down.";
  if (G.mode === "hidden") { const picks = room.picksFor(G, me).length; return picks === SIZE ? "Four picked between you: either of you submits." : `Your words are yours to pick; tell ${them} about them. ${picks} of 4 picked.`; }
  return v.mine.length === SIZE ? "Submit, or change a pick." : "Pick four words that belong together.";
}
function drawDuo() {
  if (!G) return;
  const me = mySlot(), v = room.viewFor(G, me), placed = new Set(G.found.flatMap(f => G.board.g[f.g].w).concat(G.pending ? G.board.g[G.pending.g].w : []));
  const others = together.others(), them = others[0];
  duoOrder ??= [...G.order];
  const lots = G.found.map(f => ({ g: f.g, rank: f.g, name: G.mode === "crossed" && f.named === false ? `${room.nameOf(G, f.g)} (not named)` : room.nameOf(G, f.g), words: G.board.g[f.g].w,
    by: f.by == null ? "" : f.by === me ? "found by you" : `found by ${first(them?.name)}`, note: noteOf(G.board, f.g, G.done) }));
  if (G.pending) lots.push({ g: G.pending.g, rank: G.pending.g, name: "To name", words: G.board.g[G.pending.g].w, by: G.pending.namer === me ? "yours to name" : `${first(them?.name)} names it` });
  if (G.done) G.board.g.forEach((lot, g) => { if (!G.found.some(f => f.g === g)) lots.push({ g, rank: g, name: room.nameOf(G, g), words: lot.w, missed: true, note: noteOf(G.board, g, true) }); });
  const word = new Map(v.words.map(x => [x.w, x]));
  const tiles = G.done ? [] : duoOrder.filter(w => !placed.has(w)).map(w => {
    const x = word.get(w), theirs = v.theirs.includes(w);
    return { w, text: x.sealed ? "" : w, sealed: x.sealed, sel: v.mine.includes(w), theirs, who: theirs && !x.sealed ? first(them?.name).slice(0, 1).toUpperCase() : "" };
  });
  drawBoard(lots, tiles, { off: G.done || !!G.pending });
  drawFeed(v.guesses.filter(x => x.r !== "right").map(x => ({ words: x.w, r: x.r, who: x.by === me ? "You" : first(them?.name) })));
  el.what.textContent = `${room.MODES[G.mode].label} · ${LEVEL_NAMES[G.level]}`;
  dots(MISTAKES - G.mistakes);
  el.sub.hidden = false;
  el.sub.replaceChildren(...(them ? [Object.assign(document.createElement("b"), { textContent: first(them.name) }), them.here ? (v.theirs.length ? ` · ${plural(v.theirs.length, "pick")}` : " · here") : " · away"] : [waitMark(), "Waiting for your partner"]));
  setControls(G.done ? "end" : "play");
  if (!G.done) {
    el.submit.hidden = false;
    el.submit.disabled = room.picksFor(G, me).length !== SIZE || !!G.pending || !others.length;
    el.clear.disabled = !v.mine.length;
    el.shuffle.disabled = false;
    el.controls.classList.remove("two");
  }
  drawLine();
  // crossed: the lot your partner found is yours to name
  if (v.name && naming !== `${G.n}/${v.name.g}`) {
    naming = `${G.n}/${v.name.g}`;
    askLink({
      head: `Name the lot ${first(them?.name) || "your partner"} found`, words: G.board.g[v.name.g].w, options: v.name.options,
      onPick: id => { const n = G.n; together.act(s => room.nameAt(room.tidy(s), { n, slot: me, pick: id })); return { right: id === G.board.g[v.name.g].c, answer: G.board.g[v.name.g].c }; },
    });
  }
}
function duoTap(word) {
  if (!G || G.done) return;
  const n = G.n, slot = mySlot(), local = structuredClone(G);
  if (room.pickAt(local, { n, slot, word }) === false) return;
  G = local;                                               // at once on this phone; the table follows
  talk.clear();
  drawDuo();
  together.act(s => room.pickAt(room.tidy(s), { n, slot, word }));
}
async function duoSubmit() {
  if (!G) return;
  const n = G.n, slot = mySlot(), words = room.picksFor(G, slot), partnerHere = together.others().some(o => o.here);
  let out = null;
  await together.act(s => { out = room.submitAt(room.tidy(s), { n, slot, words, partnerHere }); return ["right", "one", "miss"].includes(out); });
  if (out === "tried") say("Already tried", "bad");
  else if (out === "moved") say("Your partner changed the picks", "bad");
}
function duoClear() { if (!G) return; const n = G.n, slot = mySlot(); const local = structuredClone(G); if (room.clearAt(local, { n, slot })) { G = local; drawDuo(); together.act(s => room.clearAt(room.tidy(s), { n, slot })); } }
function duoNext(nextMode = G?.mode) {
  if (!G) return;
  const n = G.n;
  together.act(s => room.nextAt(room.tidy(s), { n, seed: randomSeed(), level: prefs.level, mode: nextMode }));
}
// a race in the pair's room: the request is written already said yes to (as a party's host does), and both phones go
let raceFollowed = 0;
async function raceInstead() {
  if (!together.room) return;
  const at = Date.now(), { sync, code, uid } = together.room;
  try {
    await sync.update(`crates/rooms/${code}`, { ask: { game: "lotsrace", at, answer: "yes", from: uid, device: uid, people: 2 } });
    await together.act(s => { s.race = at; return true; });
  } catch (e) { console.error(e); toast("Couldn't start the race"); }
}
function goRace(at) {
  raceFollowed = at;
  location.href = `lots.html?room=${together.room.code}&new=${at}&race=1`;
}
function duoMenu(body) {
  const t = part(body, "together");
  if (!G) { const w = line(joiningWords()); w.prepend(waitMark()); t.append(w, action("Back to solo", () => location.replace(soloHref()), "link")); return; }
  const others = together.others();
  t.append(line(others.length ? `With ${list2(others.map(o => `${first(o.name)}${o.here ? "" : " (away)"}`))}` : "Waiting for your partner"));
  t.append(choice("Together", Object.entries(room.MODES).map(([k, m]) => [k, m.label]), G.mode, async v => {
    prefs.duo = v; keepPrefs();
    if (G.done || (!G.guesses.length && !G.found.length) || await sure(`Start a new board, ${room.MODES[v].label.toLowerCase()}, for both of you?`, { yes: "New board" })) duoNext(v);
    else openMenu();
  }));
  t.append(line(room.MODES[G.mode].blurb));
  t.append(action("New board", async () => { if (G.done || await sure("Start a new board for both of you?", { yes: "New board" })) duoNext(); }, "primary"),
    action("Race instead", raceInstead), action("Back to solo", () => together.leave(), "link"));
  part(body, "content").append(levelChoice());
}

// ---------- a race on one board (duel.js) ----------
const duel = createDuel({
  game: "lotsrace", name: "Lots", app: RACE_APP, accent: "--lt-in", line: el.sub, toast,
  deal: () => ({ seed: randomSeed(), level: prefs.level }),
  describe: m => `${LEVEL_NAMES[m.level] || "Medium"}: the same sixteen for everyone; the most points wins (a lot each, and a point for each mistake left once solved), then the quicker`,
  play: (match, { begun, kept }) => {
    mode = "race";
    const level = LEVELS.includes(match.level) ? match.level : "medium";
    const same = isRun(kept) && kept.board.seed === match.seed && kept.level === level;
    S = same ? kept : newRun({ board: deal({ seed: match.seed, level }), kind: "race" });
    S.begun = begun;
    talk.clear();
    fresh = true;
    drawRun();
    tell();
  },
  onLobby: match => { mode = "race"; S = null; if (match?.level) el.level.value = match.level; drawRun(); },
  onLeave: () => {
    mode = "solo";
    const u = new URL(location.href); u.searchParams.delete("race"); history.replaceState(null, "", u);
    solo();
  },
});
/** What the table sees of this run: lots and mistakes as it goes, the points once it's over. */
function tell() {
  if (mode !== "race" || !S) return;
  const text = S.done ? `${scoreOf(S)} of 8${S.won ? "" : ", out"}` : `${plural(S.found.length, "lot")}${S.mistakes ? `, ${plural(S.mistakes, "mistake")}` : ""}`;
  duel.report({ score: scoreOf(S), text, done: S.done, ...(S.done ? { ms: Math.round(S.ms) } : {}) });
}

// ---------- wiring ----------
document.querySelector(".cr-mark").innerHTML = APPS.find(a => a.id === "crates").logo;
bindSwitcher($("appsBtn"), "crates");
// the level, a select in the header (hidden on the full screen: the menu mirrors it)
dropdown(el.level);
el.level.addEventListener("change", async () => {
  const v = el.level.value;
  if (mode === "race") { prefs.level = v; keepPrefs(); if (!duel.newMatch()) el.level.value = duel.match?.level || "medium"; return; }
  prefs.level = v; keepPrefs();
  if (mode === "duo") { toast(`${LEVEL_NAMES[v]} from the next board`); return; }
  if (S && S.kind === "random" && S.level === v && !S.done) return;
  if (await confirmLeave()) newBoard(); else el.level.value = S?.level || "medium";
});
el.submit.addEventListener("click", () => {
  if (el.controls.dataset.kind === "end") { if (mode === "race") duel.open(); else if (mode === "duo") duoNext(); else newBoard(); return; }
  submitPicks();
});
el.clear.addEventListener("click", () => {
  if (el.controls.dataset.kind === "end") { share(); return; }
  if (mode === "duo") { duoClear(); return; }
  if (S && clearPicks(S)) { save(); drawRun(); }
});
el.shuffle.addEventListener("click", () => {
  if (mode === "duo") { if (G) { duoOrder = shuffle(duoOrder || G.order); drawDuo(); } return; }
  if (S && !S.done) { shuffleLeft(S); save(); drawRun(); }
});
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
document.addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "Enter" && !el.submit.disabled && !el.submit.hidden) el.submit.click();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) { clockStop(); save(); } else { clockRun(); together.resync(); duel.resync(); } });
window.addEventListener("pagehide", () => { clockStop(); save(); });
window.addEventListener("pageshow", e => { if (e.persisted) { together.resync(); duel.resync(); } });
document.addEventListener("pointerdown", () => clockRun(), true);
let resized = 0;
window.addEventListener("resize", () => { clearTimeout(resized); resized = setTimeout(() => (mode === "duo" ? drawDuo() : drawRun()), 120); });
document.fonts?.ready.then(() => fitWords(el.board));
setInterval(() => {
  if (talk.expired) drawLine();
  if (!S || mode === "duo") return;
  clockBook();
  if (mode === "solo" && clockFrom != null && performance.now() - savedAt > 5000) save();
}, 250);

// for tests and debugging
window.__lots = { get run() { return S; }, get table() { return G; }, get mode() { return mode; }, tap, submitPicks, newBoard, openToday, duoNext, raceInstead, together, duel };

/** Your own board: the one you left, or today's when the games screen sent you for it, or a new one. */
async function solo() {
  mode = "solo";
  el.sub.replaceChildren();
  const kept = read(RUN, null);
  S = isRun(kept) ? kept : null;
  if (forToday && !IN_FRAME && !(S?.kind === "daily" && S.day === today()) && !dayDone()) {
    if (!started() || await sure("Today's board is waiting. Leave the one you've started?", { yes: "Leave it" })) { newBoard("daily"); return; }
  }
  if (S) begin(S);
  else if (IN_FRAME) drawRun();
  else newBoard(dayDone() ? "random" : "daily");
}
const forToday = arrivedForToday();
// a table in the address: the race (a party's, or the pair's when they chose one) or the pair's board; the mark until
// it's drawn, and no board of your own under it
const code = roomInAddress(), q = new URLSearchParams(location.search);
if (code && (q.has("party") || q.has("race"))) duel.join(code).then(ok => { if (!ok) solo(); });
else if (code) {
  const joining = busy(joiningWords(), { delay: 0 });
  together.join(code).then(ok => { joining(); if (!ok) solo(); });
} else solo();
