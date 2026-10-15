// Party: a room for the evening, each player on their own phone. The host opens it here and shows its QR code; the
// others scan it and sit down in their browser with a name, nothing to install. The host chooses what the party plays
// and starts it, and every phone follows (party-link.js brings them back): one of Party's own games, played on this
// page, every phone showing its own player what's theirs (a word, a role, a vote to cast) while the host's phone runs
// the game and speaks for it, a narrator in the middle of the table (table.js, table-ui.js); a card, dice or board game
// on its own page, at a table in the party's room where the computer takes the seats nobody has; or, for two, any game
// with a duo match. The games are modules (party-core.js lists them, and what else a party can play); this page draws
// the lobby, Party's game in progress and what's between, and moves that game on when it's this device's to run.
import { GAMES, ONE_PHONE, gameById, startGame, advanceGame, endGame, inputsFor, playersOf, needOf, ELSEWHERE, playable, fits, seatsText, tableFrom, shownOf, mergeShown, recall } from "./party-core.js";
import { joins, playHref, whoOf } from "./party-href.js";
import { openTable, inviteSheet, createNarrator, tableInAddress, setTableParam, joinLink } from "./table-ui.js";
import { getSync } from "./net.js";
import { qrSvg } from "./qr.js";
import { h, button, names } from "./party-kit.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { bindSwitcher, APPS, nameClass } from "./apps.js";
import { IN_FRAME, playerId } from "./suite.js";
import { busy } from "./loading.js";
import "./pwa.js";

// this code's version at a table: a device with older code updates (2: the host chooses any game, and the phones
// follow it to that game's page; 3: the games remember what they've shown the party, and deal none of it again)
const APP = 3;
const $ = id => document.getElementById(id);
// each game's own stylesheet, named in its module (css: "party-<id>.css", a literal there, so tools/offline.mjs keeps
// it), linked before themes.css so the themes' overrides still come last
for (const g of [...GAMES, ...ONE_PHONE]) if (g.css && !document.querySelector(`link[href="${g.css}"]`)) {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = g.css;
  document.head.insertBefore(l, document.querySelector('link[href="themes.css"]'));
}
const OPTS = "party:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
// this device's choices: the narrator's voice, and the game and options last picked (the host's next party starts there)
const opts = { voice: true, pick: GAMES[0].id, options: {}, ...read(OPTS, {}) };
// a game's own tile (party.html?game=echo), or another game's Invite players (?game=bones&invite=1), opens Party on
// it: the page wears that game's name and logo, it's the game picked when this phone opens a party, and an invite opens
// the party at once
const params = new URLSearchParams(location.search);
const asked = playable(params.get("game"));
const inviting = !!asked && asked.kind !== "phone" && params.has("invite");
if (asked && asked.kind !== "phone") { opts.pick = asked.id; write(OPTS, opts); }
// a game on this phone alone (Higher or Lower), open over whatever else the page shows, the party's lobby included
let here = asked?.kind === "phone" ? asked : null;
/** Opens a game played on this phone alone, or (null) closes it; the address says which, so a reload comes back to it. */
function playHere(entry) {
  here = entry;
  const u = new URL(location.href);
  if (entry) u.searchParams.set("game", entry.id); else if (playable(u.searchParams.get("game"))?.kind === "phone") u.searchParams.delete("game");
  history.replaceState(null, "", u);
  draw();
}
if (params.has("invite")) { const u = new URL(location.href); u.searchParams.delete("invite"); history.replaceState(null, "", u); }
// the party this tab is in, so the games screen's Party tile finds the way back to it (this tab only: it isn't synced)
const HERE = "party:here";
const hereCode = () => { try { return sessionStorage.getItem(HERE) || ""; } catch { return ""; } };
const keepHere = code => { try { if (code) sessionStorage.setItem(HERE, code); else sessionStorage.removeItem(HERE); } catch { /* private mode */ } };

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- what the party has been shown ----------
// The games remember what they've shown the party (branch.shown: Who am I's identities, dealt or rerolled), so none
// comes round twice. This phone keeps all it has been shown, at every party it was at (SHOWN, by game), and brings it
// to the next: what it remembers that the party doesn't goes to the table, and what the table has shown comes home.
const SHOWN = "party:shown";
let brought = "";                     // what this phone last took to the table, so a write that failed isn't repeated
function remember(b) {
  if (IN_FRAME) return;                                          // a watching frame's writes go nowhere
  const mine = read(SHOWN, {}), { home, missing } = recall(mine, b);
  if (JSON.stringify(home) !== JSON.stringify(mine)) write(SHOWN, home);
  const sig = `${table.code}:${missing.map(id => `${id}${home[id].length}`)}`;
  if (!missing.length || sig === brought) return;
  brought = sig;
  table.act(cur => {
    cur.shown ||= {};
    for (const id of missing) cur.shown[id] = mergeShown(home[id], shownOf(cur, id));
  });
}

// ---------- the table ----------
let branch = null, me = null, said = "", moving = false;
const narrator = createNarrator();
narrator.muted = !opts.voice;
const table = openTable({
  game: "party", app: APP, max: 24, toast,
  onState(b, m) {
    branch = b; me = m;
    keepHere(table.code);
    remember(b);
    if (follow()) return;
    said = narrator.hear(b, m) || said;
    invite.update();
    draw();
    drive();
  },
  onLeave() { branch = null; me = null; said = ""; invite.close(); keepHere(null); draw(); },
});
const invite = inviteSheet(table, { title: "Invite players", note: "Scan with the camera, or open the link: no app needed, just a name." });

/** The game in progress, as this page sees it: { def, g, state } or null. */
const current = () => (branch?.game ? { def: gameById(branch.game.id), g: branch.game, state: branch.game.state } : null);
/** Whether this phone chooses the party's games: the host's, who opened it (or took it over when they left). */
const chooses = () => !!me?.host;

/** The party is playing another page's game: this phone goes there, if it's in it. True when it's on its way. */
function follow() {
  const p = branch?.playing;
  if (!p || IN_FRAME || moving || !joins(p, table.uid)) return moving;
  moving = true;
  location.replace(playHref(p, table.code));
  return true;
}

// ---------- moving the game on (the device that runs the table) ----------
// After each change, and when a game's clock runs out, the running device asks the game whether to move on (a vote
// complete, a deadline passed). It asks on its own copy first, so a change that would do nothing costs nothing; then
// for real, inside the table's transaction, on the freshest copy.
let wake = 0;
function drive() {
  clearTimeout(wake);
  const c = current();
  if (!c?.def || !me || IN_FRAME) return;
  const now = table.now();
  let due = false;
  try { due = advanceGame(structuredClone(branch), now); } catch (e) { console.error(e); }
  if (due) table.drive(() => table.act(b => { try { return advanceGame(b, table.now()); } catch (e) { console.error(e); return false; } }));
  const at = c.def.wakeAt?.(c.state);
  if (at && (me.driver || me.backup)) wake = setTimeout(drive, Math.max(40, at - now + 40));
}

// ---------- drawing ----------
// Text typed into a game (a guess, a clue) survives the redraws other players' moves cause: a box the game keeps
// (ctx.keep) is found again by its key, and its words, caret and focus are put back into the new one.
let typed = new Map();
function rememberTyped() {
  const out = new Map();
  for (const [key, el] of typed) if (el.isConnected) out.set(key, { value: el.value, focus: document.activeElement === el, from: el.selectionStart, to: el.selectionEnd });
  return out;
}
function restoreTyped(before, fresh) {
  for (const [key, el] of fresh) {
    const b = before.get(key);
    if (!b) continue;
    el.value = b.value;
    if (b.focus) { el.focus(); try { el.setSelectionRange(b.from, b.to); } catch { /* not a text box */ } }
  }
  typed = fresh;
}

const appOf = id => APPS.find(a => a.id === id) || null;
/** The header: the game being played (or, before a party's open, the one this page was opened for), else Party. */
let branded = "";
function brand() {
  const id = current()?.def?.id || (!branch && asked ? asked.id : "party");
  if (id === branded) return;
  branded = id;
  const app = appOf(id) || appOf("party");
  document.querySelector(".pa-mark").innerHTML = app?.logo || "";
  const name = [...$("appsBtn").childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (name && app) name.textContent = app.name;
  if (app) document.title = app.name;
}

function draw() {
  brand();
  // the narrator's strip while a game is on (in the lobby the screen is for joining and choosing)
  const sayEl = $("say");
  sayEl.hidden = !branch?.game || !!here;
  sayEl.textContent = said;
  const stage = $("stage");
  if (!branch?.game) typed = new Map();
  // a game on this phone alone keeps its screen through the party's changes underneath it
  if (here) { if (!stage.querySelector(`:scope > [data-here="${here.id}"]`)) drawHere(stage); }
  else if (!branch) drawHome(stage);
  else if (!branch.game) drawLobby(stage);
  else drawGame(stage);
}

function drawHere(stage) {
  here.def.view(stage, { back: () => playHere(null) });
  stage.firstElementChild?.setAttribute("data-here", here.id);
}

// the games screen's sections, Party's first (Quest is there too), after what's played on one phone
const SHELVES = [["phone", "On one phone"], ["party", "Party games"], ["table", "Board & card games"], ["learn", "Learning"], ["puzzle", "Puzzles"]];
/** Everything a party can play, by the games screen's sections: [[title, entries]], only what fits n people when n is given. */
function catalog(n = null) {
  const all = [...ONE_PHONE, ...GAMES, ...ELSEWHERE].map(g => playable(g.id)).filter(e => n == null || fits(e, n));
  const shelf = e => appOf(e.id)?.sec || (e.kind === "duo" ? "learn" : e.kind);
  return SHELVES.map(([sec, title]) => [title, all.filter(e => shelf(e) === sec)]).filter(([, list]) => list.length);
}
/** A game as the games screen shows it, its logo and name: picked or not. */
function tile(entry, { picked = false, onclick = null } = {}) {
  const logo = h("span", { class: "app-logo" });
  logo.innerHTML = appOf(entry.id)?.logo || entry.logo || "";
  return h("li", {}, h("button", { type: "button", class: "app-row pa-tile", "aria-pressed": String(picked), onclick },
    logo, h("b", { class: nameClass(entry.name) }, entry.name)));
}
/** The sections of games, as tiles. */
function tiles(sections, { picked = null, onPick }) {
  return sections.map(([title, list]) => h("section", { class: "pa-sec" }, h("h3", { class: "apps-sec" }, title),
    h("ul", { class: "apps-grid pa-grid" }, ...list.map(e => tile(e, { picked: e.id === picked, onclick: () => onPick(e) })))));
}
/** The game picked, at the head of the list: its logo, name, who plays it and what it is. */
function pickedCard(entry) {
  const logo = h("span", { class: "app-logo" });
  logo.innerHTML = appOf(entry.id)?.logo || "";
  return h("div", { class: "pa-picked" }, logo,
    h("span", { class: "pa-game-name" }, entry.name, entry.def?.zh ? h("span", { class: "pa-zh" }, entry.def.zh) : null),
    h("span", { class: "pa-game-n" }, seatsText(entry)),
    h("span", { class: "pa-game-blurb" }, entry.blurb));
}

function drawHome(stage) {
  const back = !IN_FRAME && hereCode() ? button(`Back to party ${hereCode()}`, () => rejoin(hereCode())) : null;
  const open = IN_FRAME ? null : button("Invite players", openTableHere, { primary: !back });
  // opened for one game (its own tile, or its Invite players): that game, how it's played, and the way to gather
  // the players
  if (asked && asked.kind !== "phone") {
    const how = asked.kind === "party"
      ? `For ${asked.min}–${asked.max} players, each on their own phone: open a party, show its QR code, and this phone runs the game and speaks for it.`
      : `${seatsText(asked)}, each on their own phone: open a party, show its QR code, and start it when everyone's in.`;
    stage.replaceChildren(h("div", { class: "pa-home fit-col" },
      h("p", { class: "pa-intro" }, `${asked.blurb} ${how}`),
      h("div", { class: "pa-rules-box fit-grow fit-scroll" }, ...(asked.def?.rules || []).map(r => h("p", {}, r))),
      back, open));
    return;
  }
  stage.replaceChildren(h("div", { class: "pa-home fit-col" },
    h("p", { class: "pa-intro" }, "A party is a room for the evening, each of you on your own phone. Open one and show its QR code; whoever opens it chooses what you play, and every phone follows."),
    h("div", { class: "pa-pick fit-grow fit-scroll" }, ...tiles(catalog(), { onPick: e => (e.kind === "phone" ? playHere(e) : showRules(e)) })),
    back, open));
}

async function openTableHere() {
  const done = busy("Opening a party");
  try { if (await table.start({ pick: opts.pick })) invite.open(); } finally { done(); }
}
async function rejoin(code) {
  setTableParam(code);
  const done = busy("Joining the party");
  try { if (!(await table.joinAddress())) keepHere(null); } finally { done(); draw(); }
}

/** Starts the game picked on its own page: its table (or a duo match's request, said yes to) in the party's room
 *  first, then the party's choice, which every phone follows (this one at once). */
async function startElsewhere(entry) {
  if (moving) return;
  moving = true;
  const done = busy(`Starting ${entry.name}`);
  try {
    const sync = await getSync(), code = table.code, at = Math.round(table.now());
    const who = playersOf(branch).map(p => p.uid);
    const playing = { id: entry.id, kind: entry.kind, page: entry.page, at, who, max: entry.max };
    // the game's table (or the request a duo game answers) and the party's choice leave together, in that order: the
    // database applies one connection's writes in the order they were sent, so nobody arrives before the table, and
    // the host waits one round trip to the database rather than two
    const [, took] = await Promise.all([
      sync.update(`crates/rooms/${code}`, entry.kind === "table" ? { [entry.id]: tableFrom(branch, entry, at) }
        : { ask: { game: entry.duo, at, answer: "yes", from: playerId(), device: sync.uid, people: who.length } }),
      table.act(b => { b.playing = playing; delete b.game; delete b.inputs; }),
    ]);
    if (!took) throw new Error("the party didn't take the choice");
    location.replace(playHref(playing, code));
  } catch (e) {
    console.error(e);
    moving = false;
    done();
    toast(`Couldn't start ${entry.name}: try again`);
  }
}

/** What stops the party starting a game, in words, or "". */
function whyNot(entry, players, options) {
  const n = players.length;
  if (entry.kind === "party") return needOf(entry.def, players, options);
  if (n < entry.min) return `${entry.name} needs ${entry.min}: ${entry.min - n} more to join`;
  if (n > entry.max) return entry.max === 2 ? `${entry.name} is for two, and there are ${n} of you` : `${entry.name} seats ${entry.max}, and there are ${n} of you`;
  return "";
}

let lastPick = null;
function drawLobby(stage) {
  const players = playersOf(branch), host = chooses(), n = players.length;
  const pick = playable(branch.pick) || playable(opts.pick) || playable(GAMES[0].id);
  const tally = branch.tally || {};
  const qr = h("button", { type: "button", class: "pa-qr", "aria-label": "Show the QR code, larger", onclick: () => invite.open() });
  qr.innerHTML = qrSvg(joinLink(table.code), { label: `QR code to join party ${table.code}` });
  const chips = h("ul", { class: "pa-chips" }, ...players.map(p => h("li", { class: `${p.online ? "" : "away"}${p.uid === table.uid ? " me" : ""}` },
    p.name, tally[p.pid] ? h("span", { class: "pa-wins", title: "Games won tonight" }, String(tally[p.pid])) : null)));
  const hostName = players.find(p => p.uid === branch.host)?.name || "The host";
  // the game picked and its options, then everything this many can play: the host's taps choose, a guest's show the rules
  const choose = e => { opts.pick = e.id; write(OPTS, opts); table.act(b => { b.pick = e.id; }); };
  const optionsOf = () => ({ ...(opts.options[pick.id] || {}), ...(branch.opts?.[pick.id] || {}) });
  const options = !pick.def?.options?.length ? null : h("div", { class: "pa-options" }, ...pick.def.options.map(o => {
    const value = branch.opts?.[pick.id]?.[o.id] ?? opts.options[pick.id]?.[o.id] ?? o.value;
    const c = choice(o.label, o.choices, value, v => {
      opts.options[pick.id] = { ...(opts.options[pick.id] || {}), [o.id]: v };
      write(OPTS, opts);
      table.act(b => { b.opts ||= {}; b.opts[pick.id] = { ...(b.opts[pick.id] || {}), [o.id]: v }; });
    });
    if (!host) c.querySelectorAll("button").forEach(b => { b.disabled = true; });
    return c;
  }));
  const list = h("div", { class: "pa-pick fit-grow fit-scroll" }, pickedCard(pick), options,
    ...tiles(catalog(n), { picked: pick.id, onPick: e => (e.kind === "phone" ? playHere(e) : host ? choose(e) : showRules(e)) }));
  // the party playing a game elsewhere that this phone isn't in (it came after a duo match began, or the table's full)
  const away = branch.playing ? playable(branch.playing.id) : null;
  const short = whyNot(pick, players, optionsOf());
  const there = players.filter(p => whoOf(branch.playing).includes(p.uid)).map(p => p.name);
  const foot = away
    ? h("p", { class: "pa-wait" }, `${there.length ? names(there) : "The others"} ${there.length === 1 ? "is" : "are"} playing ${away.name}: you're in the next game.`)
    : host ? h("div", { class: "pa-start" }, short ? h("p", { class: "pa-wait" }, short) : null,
      button(`Start ${pick.name}`, () => (pick.kind === "party" ? table.act(b => startGame(b, pick.id, optionsOf(), table.now())) : startElsewhere(pick)), { disabled: !!short }))
      : h("p", { class: "pa-wait" }, `${hostName} chooses the game and starts it`);
  // the list keeps its place through the redraws others cause (someone joining), and goes to the top when the pick
  // changes, where its card and options are
  const was = stage.querySelector(".pa-pick")?.scrollTop ?? 0;
  // two halves: who's here (with the code to join) and the game; one column on a phone, side by side held sideways
  stage.replaceChildren(h("div", { class: "pa-lobby fit-col" },
    h("div", { class: "fit-half pa-half pa-who" },
      h("div", { class: "pa-join" }, qr, h("div", { class: "pa-join-how" },
        h("p", { class: "pa-code" }, table.code),
        h("p", { class: "pa-join-note" }, "Scan to join: the camera, then the link. No app needed."),
        h("button", { type: "button", class: "btn", onclick: () => invite.open() }, "Show it larger"))),
      h("h3", { class: "pa-h" }, `Players · ${n}`), chips),
    h("div", { class: "fit-half pa-half pa-what" }, h("h3", { class: "pa-h" }, "The game"), list, foot)));
  list.scrollTop = lastPick === pick.id ? was : 0;
  lastPick = pick.id;
}

function drawGame(stage) {
  const c = current();
  if (!c.def) { stage.replaceChildren(h("p", { class: "pa-wait" }, "This game needs a newer version: close and reopen Party.")); return; }
  const players = playersOf(branch);
  // a game that keeps its screen (keepsView: the drawing games, whose pad mustn't be rebuilt under a finger, nor the
  // box being typed in, as moves arrive several times a second) is given its stage as it left it, while the same game
  // is on, and updates it where it stands
  const held = c.def.keepsView ? stage.querySelector(`:scope > .pa-game-view > .pa-play[data-seq="${c.g.seq}"]`) : null;
  const play = held || h("div", { class: "pa-play fit-grow fit-scroll", "data-seq": String(c.g.seq), "data-game": c.def.id });
  const before = rememberTyped(), fresh = new Map();
  const ctx = {
    state: c.state, me: me || { uid: table.uid }, players, inputs: inputsFor(branch, c.state.step), seq: c.g.seq,
    now: () => table.now(),
    send: value => table.send({ ...value, seq: c.g.seq, step: c.state.step }),
    // a change only this player makes (their own turn): straight into the game, on the table as it is then
    act: change => table.act(b => (b.game?.seq === c.g.seq ? change(b.game.state, b) : false)),
    keep: (el, key = "main") => fresh.set(`${c.g.seq}:${c.state.step}:${key}`, el),
  };
  try { c.def.view(play, ctx); }
  catch (e) { console.error(e); play.replaceChildren(h("p", { class: "pa-wait" }, "Something went wrong drawing this step; it's still saved.")); }
  const over = c.state.step === "over";
  const foot = over ? (chooses()
    ? h("div", { class: "pa-host" },
      button("Play again", () => table.act(b => startGame(b, c.g.id, c.g.options, table.now()))),
      button("Another game", () => table.act(b => endGame(b)), { primary: false }))
    : h("p", { class: "pa-wait" }, `${players.find(p => p.uid === branch.host)?.name || "The host"} chooses what's next`)) : null;
  const head = h("div", { class: "pa-game-head" }, h("span", { class: "pa-game-title" }, c.def.name), c.def.zh ? h("span", { class: "pa-zh" }, c.def.zh) : null,
    h("span", { class: "pa-count" }, `${players.length} playing`));
  if (held) {
    // the head and the foot replaced around the stage, which never leaves the page
    const view = held.parentElement;
    for (const n of [...view.children]) if (n !== held) n.remove();
    view.prepend(head);
    if (foot) view.append(foot);
  } else stage.replaceChildren(h("div", { class: "pa-game-view fit-col" }, head, play, foot));
  restoreTyped(before, fresh);
}

// ---------- rules, menu ----------
function showRules(entry = null) {
  const d = entry || here || (current()?.def ? playable(current().def.id) : null) || playable(branch?.pick) || (!branch ? asked : null);
  $("rulesHead").textContent = d ? d.name : "Party";
  const body = $("rulesBody");
  if (!d) {
    body.replaceChildren(
      h("p", {}, "A party is a room for the evening, each player on their own phone. Whoever opens it (Invite players) shows its QR code; the others scan it with their camera and sit down in their browser with a name: nothing to install."),
      h("p", {}, "The host chooses what the party plays and starts it, and every phone follows: to one of Party's own games, played here, where the host's phone runs the game and speaks for it (keep it in the middle of the table, screen up); to a card, dice or board game, where the computer takes the seats nobody has; or, for two, to any game you can play as a pair. From a game, the host's menu brings everyone back."),
      h("p", {}, `Party's own games: ${names(GAMES.map(g => g.name))}.`));
  } else if (d.def) body.replaceChildren(h("p", { class: "pa-rules-n" }, seatsText(d)), ...d.def.rules.map(r => h("p", {}, r)));
  else body.replaceChildren(h("p", { class: "pa-rules-n" }, seatsText(d)), h("p", {}, d.blurb), h("p", {}, `Its own page has its rules in full: Rules, at the top of ${d.name}.`));
  $("rulesDlg").showModal();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (!branch) {
    if (!IN_FRAME && hereCode()) play.append(action(`Back to party ${hereCode()}`, () => rejoin(hereCode()), "primary"));
    if (!IN_FRAME) play.append(action("Invite players", openTableHere, hereCode() ? "" : "primary"));
  } else {
    const n = playersOf(branch).length;
    play.append(line(`Party ${table.code}: ${n} of you${chooses() ? ", and you choose the games" : ""}.`));
    play.append(action("Invite players", () => invite.open(), "primary"));
    if (branch.game && chooses()) play.append(action("End this game", () => table.act(b => endGame(b))));
    play.append(action("Leave the party", () => table.leave(), "link"));
  }
  part(body, "settings").append(toggle("The narrator's voice", opts.voice, on => {
    opts.voice = on; write(OPTS, opts); narrator.muted = !on;
  }));
  part(body, "about").append(line("The phone that runs a game of Party's speaks each step aloud; every phone shows it. Keep that phone in the middle, screen up."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- the keyboard ----------
// A phone's keyboard covers the bottom of the page without the page being made any shorter: the browser shrinks only
// the part in sight (the visual viewport) and slides it down to the box being typed in, so the top of the game goes out
// of sight while you type (Sketch's drawing, while you guess it), and the page can stay slid once the keyboard goes.
// While a box has the keyboard, the page is made the height in sight and placed in it, the header and the narrator's
// strip giving way, and each game's parts share what's left: what you type, what it's about and the keyboard are in
// sight together. When the keyboard goes, the page goes back to the top of the screen.
const seen = window.visualViewport;
const typedIn = el => !!el?.matches?.("textarea, input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit])");
let seenH = 0;
function fitKeyboard() {
  const root = document.documentElement, was = root.classList.contains("typing");
  // a pinch's zoom shrinks the part in sight too, but leaves the page as it is
  const up = !!seen && typedIn(document.activeElement) && Math.abs(seen.scale - 1) < 0.01 && innerHeight - seen.height > 120;
  root.classList.toggle("typing", up);
  if (up) {
    const height = Math.round(seen.height);
    root.style.setProperty("--seen-h", `${height}px`);
    root.style.setProperty("--seen-top", `${Math.round(seen.offsetTop)}px`);
    // the box in sight in its game's part, which scrolls if the game is longer than the room left, once the page has
    // its new height
    if (height !== seenH) requestAnimationFrame(() => document.activeElement?.scrollIntoView?.({ block: "nearest", inline: "nearest" }));
    seenH = height;
  } else {
    seenH = 0;
    if (was) scrollTo(0, 0);
  }
}
seen?.addEventListener("resize", fitKeyboard);
seen?.addEventListener("scroll", fitKeyboard);
addEventListener("focusin", fitKeyboard);
addEventListener("focusout", () => setTimeout(fitKeyboard, 0));   // once the focus has gone wherever it's going

// ---------- wiring ----------
bindSwitcher($("appsBtn"), asked?.kind === "party" ? asked.id : "party");
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", () => showRules());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__party = { table, get branch() { return branch; }, get me() { return me; }, drive };
draw();
if (tableInAddress() && !IN_FRAME) {
  const done = busy("Joining the party");
  table.joinAddress().finally(done).then(() => draw());
} else if (inviting && !IN_FRAME) openTableHere();
