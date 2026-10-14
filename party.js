// Party: games for a group in one room, each player on their own phone. The host opens a table here and shows its
// QR code; the others scan it and sit down in their browser with a name, nothing to install. The host picks a game
// and starts it; every phone shows its own player what's theirs (a word, a role, a vote to cast) and the step the game
// is at, and the host's phone runs the game and speaks for it, a narrator in the middle of the table (table.js,
// table-ui.js). The games are modules (party-core.js lists them); this page draws the lobby, the game in progress and
// what's between, and moves the game on when it's this device's to run.
import { GAMES, gameById, startGame, advanceGame, endGame, inputsFor, playersOf, needOf } from "./party-core.js";
import { openTable, inviteSheet, createNarrator, tableInAddress, joinLink } from "./table-ui.js";
import { qrSvg } from "./qr.js";
import { h, button, names } from "./party-kit.js";
import { part, choice, toggle, action, line } from "./menu.js";
import { bindSwitcher, APPS } from "./apps.js";
import { IN_FRAME } from "./suite.js";
import { busy } from "./loading.js";
import "./pwa.js";

const APP = 1;                                  // this code's version at a table: a device with older code updates
const $ = id => document.getElementById(id);
// each game's own stylesheet, named in its module (css: "party-<id>.css", a literal there, so tools/offline.mjs keeps
// it), linked before themes.css so the themes' overrides still come last
for (const g of GAMES) if (g.css && !document.querySelector(`link[href="${g.css}"]`)) {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = g.css;
  document.head.insertBefore(l, document.querySelector('link[href="themes.css"]'));
}
const OPTS = "party:opts";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
// this device's choices: the narrator's voice, and the game and options last picked (the host's next table starts there)
const opts = { voice: true, pick: GAMES[0].id, options: {}, ...read(OPTS, {}) };
// a game's own tile opens Party on it (party.html?game=quest): that's the game picked when this phone opens a table
{
  const asked = new URLSearchParams(location.search).get("game");
  if (gameById(asked)) { opts.pick = asked; write(OPTS, opts); }
}

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- the table ----------
let branch = null, me = null, said = "";
const narrator = createNarrator();
narrator.muted = !opts.voice;
const table = openTable({
  game: "party", app: APP, max: 24, toast,
  onState(b, m) {
    branch = b; me = m;
    said = narrator.hear(b, m) || said;
    invite.update();
    draw();
    drive();
  },
  onLeave() { branch = null; me = null; said = ""; invite.close(); draw(); },
});
const invite = inviteSheet(table, { title: "Invite players", note: "Scan with the camera, or open the link: no app needed, just a name." });

/** The game in progress, as this page sees it: { def, g, state } or null. */
const current = () => (branch?.game ? { def: gameById(branch.game.id), g: branch.game, state: branch.game.state } : null);

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

function draw() {
  // the narrator's strip while a game is on (in the lobby the screen is for joining and choosing)
  const sayEl = $("say");
  sayEl.hidden = !branch?.game;
  sayEl.textContent = said;
  const stage = $("stage");
  if (!branch?.game) typed = new Map();
  if (!branch) drawHome(stage);
  else if (!branch.game) drawLobby(stage);
  else drawGame(stage);
}

/** A game's card: its name (and Chinese name), how many play, its line; picked or not. */
function gameCard(def, { picked = false, onclick = null, disabled = false } = {}) {
  return h("button", { type: "button", class: "pa-game", "aria-pressed": String(picked), onclick, disabled },
    h("span", { class: "pa-game-name" }, def.name, def.zh ? h("span", { class: "pa-zh" }, def.zh) : null),
    h("span", { class: "pa-game-n" }, `${def.min}–${def.max} players`),
    h("span", { class: "pa-game-blurb" }, def.blurb));
}

function drawHome(stage) {
  stage.replaceChildren(h("div", { class: "pa-home fit-col" },
    h("p", { class: "pa-intro" }, "Games for a group in one room, each on their own phone. Open a table, show its QR code, and this phone runs the game and speaks for it."),
    h("div", { class: "pa-games fit-grow fit-scroll" }, ...GAMES.map(def => gameCard(def, { onclick: () => showRules(def) }))),
    IN_FRAME ? null : button("Invite players", openTableHere)));
}

async function openTableHere() {
  const done = busy("Opening a table");
  try { if (await table.start({ pick: opts.pick })) invite.open(); } finally { done(); }
}

function drawLobby(stage) {
  const players = playersOf(branch), host = me?.driver;
  const pick = gameById(branch.pick) || gameById(opts.pick) || GAMES[0];
  const tally = branch.tally || {};
  const qr = h("button", { type: "button", class: "pa-qr", "aria-label": "Show the QR code, larger", onclick: () => invite.open() });
  qr.innerHTML = qrSvg(joinLink(table.code), { label: `QR code to join table ${table.code}` });
  const chips = h("ul", { class: "pa-chips" }, ...players.map(p => h("li", { class: `${p.online ? "" : "away"}${p.uid === table.uid ? " me" : ""}` },
    p.name, tally[p.pid] ? h("span", { class: "pa-wins", title: "Games won tonight" }, String(tally[p.pid])) : null)));
  const games = h("div", { class: "pa-games fit-grow fit-scroll", role: "radiogroup", "aria-label": "The game" },
    ...GAMES.map(def => gameCard(def, { picked: def.id === pick.id, disabled: !host && def.id !== pick.id,
      onclick: host ? () => { opts.pick = def.id; write(OPTS, opts); table.act(b => { b.pick = def.id; }); } : () => showRules(def) })));
  const options = h("div", { class: "pa-options" }, ...(pick.options || []).map(o => {
    const value = branch.opts?.[pick.id]?.[o.id] ?? opts.options[pick.id]?.[o.id] ?? o.value;
    const c = choice(o.label, o.choices, value, v => {
      opts.options[pick.id] = { ...(opts.options[pick.id] || {}), [o.id]: v };
      write(OPTS, opts);
      table.act(b => { b.opts ||= {}; b.opts[pick.id] = { ...(b.opts[pick.id] || {}), [o.id]: v }; });
    });
    if (!host) c.querySelectorAll("button").forEach(b => { b.disabled = true; });
    return c;
  }));
  const n = players.length, short = needOf(pick, players, { ...(opts.options[pick.id] || {}), ...(branch.opts?.[pick.id] || {}) });
  const hostName = players.find(p => p.uid === branch.host)?.name || "the host";
  // two halves: who's here (with the code to join) and the game; one column on a phone, side by side held sideways
  stage.replaceChildren(h("div", { class: "pa-lobby fit-col" },
    h("div", { class: "fit-half pa-half pa-who" },
      h("div", { class: "pa-join" }, qr, h("div", { class: "pa-join-how" },
        h("p", { class: "pa-code" }, table.code),
        h("p", { class: "pa-join-note" }, "Scan to join: the camera, then the link. No app needed."),
        h("button", { type: "button", class: "btn", onclick: () => invite.open() }, "Show it larger"))),
      h("h3", { class: "pa-h" }, `At the table · ${n}`), chips),
    h("div", { class: "fit-half pa-half pa-what" },
      h("h3", { class: "pa-h" }, "The game"), games, options,
      host ? h("div", { class: "pa-go" }, short ? h("p", { class: "pa-wait" }, short) : null,
        button(`Start ${pick.name}`, () => { const o = { ...(opts.options[pick.id] || {}), ...(branch.opts?.[pick.id] || {}) }; table.act(b => startGame(b, pick.id, o, table.now())); }, { disabled: !!short }))
        : h("p", { class: "pa-wait" }, `${hostName} picks the game and starts it`))));
}

function drawGame(stage) {
  const c = current();
  if (!c.def) { stage.replaceChildren(h("p", { class: "pa-wait" }, "This game needs a newer version: close and reopen Party.")); return; }
  const players = playersOf(branch);
  const play = h("div", { class: "pa-play fit-grow fit-scroll" });
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
  const foot = over ? (me?.driver
    ? h("div", { class: "pa-host" },
      button("Play again", () => table.act(b => startGame(b, c.g.id, c.g.options, table.now()))),
      button("Another game", () => table.act(b => endGame(b)), { primary: false }))
    : h("p", { class: "pa-wait" }, `${players.find(p => p.uid === branch.host)?.name || "The host"} chooses what's next`)) : null;
  stage.replaceChildren(h("div", { class: "pa-game-view fit-col" },
    h("div", { class: "pa-game-head" }, h("span", { class: "pa-game-title" }, c.def.name), c.def.zh ? h("span", { class: "pa-zh" }, c.def.zh) : null,
      h("span", { class: "pa-count" }, `${players.length} playing`)),
    play, foot));
  restoreTyped(before, fresh);
}

// ---------- rules, menu ----------
function showRules(def = null) {
  const d = def || current()?.def || gameById(branch?.pick) || null;
  $("rulesHead").textContent = d ? d.name : "Party";
  const body = $("rulesBody");
  if (!d) {
    body.replaceChildren(
      h("p", {}, "Party games for a group in one room, each player on their own phone. The host opens a table (Invite players) and shows its QR code; the others scan it with their camera and sit down in their browser with a name: nothing to install."),
      h("p", {}, "The host picks a game and starts it. Every phone shows its own player what's theirs (a word, a role, a vote to cast) and the step the game is at, and the host's phone runs the game and speaks for it: keep it in the middle of the table, screen up."),
      h("p", {}, `The games: ${names(GAMES.map(g => g.name))}.`));
  } else body.replaceChildren(h("p", { class: "pa-rules-n" }, `${d.min}–${d.max} players`), ...d.rules.map(r => h("p", {}, r)));
  $("rulesDlg").showModal();
}

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  const play = part(body, "play");
  if (!branch) {
    if (!IN_FRAME) play.append(action("Invite players", openTableHere, "primary"));
  } else {
    play.append(line(`Table ${table.code}: ${playersOf(branch).length} at it${me?.driver ? ", this phone runs it" : ""}.`));
    play.append(action("Invite players", () => invite.open(), "primary"));
    if (branch.game && me?.driver) play.append(action("End this game", () => table.act(b => endGame(b))));
    play.append(action("Leave the table", () => table.leave(), "link"));
  }
  part(body, "settings").append(toggle("The narrator's voice", opts.voice, on => {
    opts.voice = on; write(OPTS, opts); narrator.muted = !on;
  }));
  part(body, "about").append(line("The phone that runs the table speaks each step aloud; every phone shows it. Keep that phone in the middle, screen up."));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

// ---------- wiring ----------
bindSwitcher($("appsBtn"), "party");
document.querySelector(".pa-mark").innerHTML = APPS.find(a => a.id === "party")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("rulesBtn").addEventListener("click", () => showRules());
$("rulesClose").addEventListener("click", () => $("rulesDlg").close());
window.__party = { table, get branch() { return branch; }, get me() { return me; }, drive };
draw();
if (tableInAddress() && !IN_FRAME) {
  const done = busy("Joining the table");
  table.joinAddress().finally(done).then(() => draw());
}
