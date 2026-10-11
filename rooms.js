// Rooms shared by every game in the app. A room is one four-letter code for two people. Each game keeps its
// own state in its own branch (crates/rooms/CODE/crates, crates/rooms/CODE/glyph), so switching games keeps
// you in the room and every game's progress stays where it was. "here" records which game each person has
// open, so a game can say "Sarah is in Slate".
//
//   crates/rooms/CODE = { suite: 1, created, owner, here: { uid: { game, name, pid, sessions } }, crates: {…}, glyph: {…} }
//
// Rooms from before this layout kept one game's state at the top; they're lifted into a branch when opened.

export const GAMES = {
  crates: { name: "Crates", page: "./crates.html" },
  glyph: { name: "Slate", page: "./slate.html" },    // id kept from its first name, Glyph
  delta: { name: "Delta", page: "./delta.html" },
  punt: { name: "Punt", page: "./punt.html" },
  cartel: { name: "Cartel", page: "./cartel.html" },
  spot: { name: "Spot", page: "./spot.html" },
  quote: { name: "Quote", page: "./quote.html" },
  origin: { name: "Origin", page: "./origin.html" },
  order: { name: "Order", page: "./order.html" },
  arb: { name: "Arb", page: "./arb.html" },
  calibre: { name: "Calibre", page: "./calibre.html" },
  manifest: { name: "Manifest", page: "./manifest.html" },
  chart: { name: "Chart", page: "./chart.html" },
  survey: { name: "Survey", page: "./survey.html" },
  blend: { name: "Blend", page: "./blend.html" },
  pipes: { name: "Pipes", page: "./pipes.html" },
  refinery: { name: "Refinery", page: "./refinery.html" },
  rush: { name: "Rush", page: "./rush.html" },
  deck: { name: "Deck", page: "./deck.html" },
  parley: { name: "Parley", page: "./parley.html" },
  stow: { name: "Stow", page: "./stow.html" },
  hong: { name: "Hong", page: "./hong.html" },
  tribute: { name: "Tribute", page: "./tribute.html" },
  brut: { name: "Brut", page: "./brut.html" },
};

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // no I or O, so codes can't be misread as 1 or 0
const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
const rootPath = code => `crates/rooms/${code}`;
export const branchPath = (code, game) => `${rootPath(code)}/${game}`;

/** The room code in this page's address, if any (games keep ?room=CODE there while you're in a room). */
export const roomInAddress = () => {
  const c = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z]/g, "");
  return c.length === 4 ? c : null;
};

/** An older room in the shared layout, or null if it isn't a room we know. */
function lift(cur) {
  if (cur.suite) return cur;
  if (cur.game === "glyph") {
    const { game, ...glyph } = cur;
    return { suite: 1, created: cur.created || Date.now(), owner: cur.owner || null, glyph };
  }
  if (cur.v === 3) return { suite: 1, created: cur.created || Date.now(), owner: cur.owner || null, crates: cur };
  // A pair's room (suite.js) is in this layout from the start, though nothing marks it: a partner code is just a code
  // until the pair's pages fill it (live, ask…). Asking for "suite" alone turned away a new pair's every first match.
  if (["live", "ask", "best", "watch", "duo", "here"].some(k => k in cur)) return cur;
  return null;
}

/** Opens a room by code: its contents (lifted into the shared layout if older), or null if there's none. */
export async function openRoom(sync, code) {
  let found = null;
  await sync.tx(rootPath(code), cur => {
    found = null;
    if (cur === null) return null;                 // cache cold: let the server hand us the real room
    found = lift(cur);
    return found && found !== cur ? found : undefined;     // write only when lifting an older room
  });
  return found;
}

/** Starts a new room holding this game's state; returns its code, or null if no free code turned up. */
export async function createRoom(sync, game, state) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode();
    const r = await sync.tx(rootPath(code), cur => (cur === null
      ? { suite: 1, created: Date.now(), owner: sync.uid, [game]: state } : undefined));
    if (r.committed) return code;
  }
  return null;
}

/**
 * Marks this person as here, in this game, and follows where everyone is: onHere gets
 * { uid: { game, name, online, pid } }. Each page holds its own session, so switching games can't leave you
 * marked offline by the page you just closed. pid, the player's id (playerId in suite.js), tells your other
 * devices from your partner. Returns a stop function.
 */
export function enterRoom(sync, code, game, name, onHere, pid = null) {
  const me = `${rootPath(code)}/here/${sync.uid}`;
  sync.update(me, pid ? { game, name, pid } : { game, name });
  const sid = Math.random().toString(36).slice(2, 10);
  const stopSession = sync.session?.(`${me}/sessions/${sid}`);
  const unwatch = sync.watch(`${rootPath(code)}/here`, val => {
    const out = {};
    for (const [id, h] of Object.entries(val || {})) {
      if (h?.game) out[id] = { game: h.game, name: h.name, online: !h.sessions || Object.keys(h.sessions).length > 0, pid: h.pid || null };
    }
    onHere(out);
  }, () => {});
  return () => { unwatch?.(); stopSession?.(); };
}

/** Leaves the room for good (every game): you're no longer shown as here. */
export function leaveRoom(sync, code) {
  return sync.update(`${rootPath(code)}/here/${sync.uid}`, { game: null, name: null });
}

/** The address of a game, carrying the room code when you're in one. */
export function gameHref(game) {
  const code = roomInAddress();
  return GAMES[game].page + (code ? `?room=${code}` : "");
}

/**
 * Someone else in the room, as far as "here" knows: { id, name, game, online } or null. Given your player id, your
 * own other devices aren't someone else; a page open now comes before one left open, and one in `game` (yours)
 * before one elsewhere, so a page your partner left open in another game doesn't hide them sitting across from you.
 */
export function otherHere(here, uid, pid = null, game = null) {
  const others = Object.entries(here || {}).filter(([id, h]) => h && id !== uid && !(pid && h.pid === pid));
  others.sort(([, a], [, b]) => (b.online === true) - (a.online === true) || (game ? (b.game === game) - (a.game === game) : 0));
  return others.length ? { id: others[0][0], ...others[0][1] } : null;
}

/** The seated players in a game's state: [id, player] (leftovers from devices that handed a seat over are skipped). */
export const seatsOf = data => Object.entries(data?.players || {}).filter(([, p]) => p && p.slot != null);

/**
 * A game's state with one player's id swapped for another's, everywhere it appears (seat, log entries,
 * who named or opened what): carrying on as that player on a new device.
 */
export function reseat(state, from, to) {
  return JSON.parse(JSON.stringify(state).split(JSON.stringify(from)).join(JSON.stringify(to)));
}

/**
 * Sitting down in a game's state, inside the joining transaction: the state to write, or undefined to leave it as
 * it is (it isn't this game's, or both seats are someone else's). A seat belongs to a device (its id, uid) and to the
 * player on it (pid, the player's id, the same on all their devices), so a player always gets their own seat back,
 * moves and all, on whichever device they come in on; then the free seat; then `takeover`, the seat chosen when
 * both were taken (pickSeat). `initial` is a new table: there's none yet, or it's for `asked` (the request the pair
 * just said yes to) and the table here is older (whichever of you arrives first deals it, the other sits down at it),
 * or the state here isn't one this game can read.
 */
export function sitDown(cur, { uid, pid = null, name }, { initial = null, asked = null, takeover = null, valid = () => true } = {}) {
  if (cur === null) return initial;          // none yet; without a table to deal, null makes Firebase ask the server
  if (initial && ((asked && cur.asked !== asked) || !valid(cur))) return initial;
  if (!valid(cur)) return undefined;
  const players = Object.fromEntries(seatsOf(cur));
  const mine = players[uid] ? uid
    : Object.keys(players).find(id => pid && players[id].pid === pid) ?? (takeover && players[takeover] ? takeover : null);
  const me = { name, ...(pid ? { pid } : {}), online: true };
  if (mine) {
    const next = mine === uid ? { ...cur, players } : reseat({ ...cur, players }, mine, uid);
    next.players[uid] = { ...next.players[uid], ...me };
    return next;
  }
  const slots = Object.values(players).map(p => p.slot);
  if (slots.length >= 2) return undefined;
  return { ...cur, players: { ...players, [uid]: { ...me, slot: slots.includes(0) ? 1 : 0 } } };
}

/**
 * When both seats are taken: asks which player to carry on as (for example after moving from laptop to
 * phone). seats is [[id, { name, online }]]. Resolves to the chosen id, or null.
 */
export function pickSeat(seats) {
  const dlg = document.createElement("dialog");
  dlg.className = "sheet";
  dlg.setAttribute("aria-label", "Take over a seat");
  dlg.innerHTML = `<div class="pick-head"><h2>Two players already</h2><button class="btn" type="button" data-cancel>Cancel</button></div>
    <p class="stats">Carry on as one of them, for example after switching from your laptop to your phone. Their other device leaves the game.</p>
    <div class="seat-list"></div>`;
  const list = dlg.querySelector(".seat-list");
  let chosen = null;
  for (const [id, p] of seats) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn wide";
    b.textContent = `Continue as ${p.name}${p.online === false ? " (away)" : ""}`;
    b.addEventListener("click", () => { chosen = id; dlg.close(); });
    list.appendChild(b);
  }
  document.body.appendChild(dlg);
  return new Promise(resolve => {
    dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => { dlg.remove(); resolve(chosen); }, { once: true });
    dlg.showModal();
  });
}
