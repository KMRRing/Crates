// Playing one board together in the app's shared rooms (rooms.js). This handles everything that isn't the game:
// starting a room, joining one (and taking over a seat when both are taken), keeping this game's branch in step,
// moves as transactions, who's where, reconnecting after the phone sleeps, updating a device running older code,
// and leaving. A game supplies its fresh state and draws whatever state arrives.
import { getSync } from "./net.js";
import { branchPath, openRoom, createRoom, enterRoom, leaveRoom, reseat, pickSeat, otherHere } from "./rooms.js";

/** The seated players in a game's state: [id, player] (leftovers from devices that handed a seat over are skipped). */
export const seatsOf = data => Object.entries(data?.players || {}).filter(([, p]) => p && p.slot != null);

/**
 * game: the room branch ("delta"); app: this code's version for together games of this kind;
 * fresh(players): a new game state; valid(state): whether a state is this game's; onState(state): draw it;
 * onPresence(): redraw who's where; onLeave(): back to solo; toast(msg); askName(): the player's name.
 */
export function createTogether({ game, app, fresh, valid, onState, onPresence, onLeave, toast, askName }) {
  let room = null;   // { code, sync, uid, name, data, here, online, stop: [] }
  const path = code => branchPath(code, game);

  async function connect() {
    try { return await getSync(); }
    catch (e) { console.error(e); toast("Couldn't reach the game server"); return null; }
  }
  function explain(e) {
    console.error(e);
    toast(/permission/i.test(String(e?.message || e)) ? "Together mode isn't switched on in Firebase yet" : "Couldn't reach the game server");
  }
  function setRoomParam(code) {
    const u = new URL(location.href);
    if (code) u.searchParams.set("room", code); else u.searchParams.delete("room");
    history.replaceState(null, "", u);
  }

  /** Starts a new room with a fresh game in it. */
  async function start() {
    const name = await askName();
    if (!name) return false;
    const sync = await connect();
    if (!sync) return false;
    try {
      const code = await createRoom(sync, game, fresh({ [sync.uid]: { name, slot: 0, online: true } }));
      if (!code) { toast("Couldn't start a game, try again"); return false; }
      enter(code, sync, name);
      return true;
    } catch (e) { explain(e); return false; }
  }

  /**
   * Joins a room. If it began in another game, this game starts its side of it. When both seats are taken,
   * you can carry on as either player (say after moving from laptop to phone); their other device leaves.
   */
  async function join(code) {
    const sync = await connect();
    if (!sync) return false;
    try {
      const shared = await openRoom(sync, code);
      if (!shared) { toast("No game with that code"); return false; }
      const before = shared[game] || null, seats = seatsOf(before);
      let takeover = null;
      if (!seats.some(([id]) => id === sync.uid) && seats.length >= 2) {
        takeover = await pickSeat(seats);
        if (!takeover) return false;
      }
      const name = takeover ? seats.find(([id]) => id === takeover)[1].name : await askName();
      if (!name) return false;
      let full = false;
      const r = await sync.tx(path(code), cur => {
        full = false;
        if (cur === null) return before ? null : fresh({ [sync.uid]: { name, slot: 0, online: true } });
        if (!valid(cur)) return undefined;
        cur.players = Object.fromEntries(seatsOf(cur));
        if (cur.players[sync.uid]) { cur.players[sync.uid].name = name; return cur; }
        if (takeover && cur.players[takeover]) {
          const next = reseat(cur, takeover, sync.uid);          // their seat, moves and all, are now this device's
          next.players[sync.uid] = { ...next.players[sync.uid], online: true };
          return next;
        }
        const slots = Object.values(cur.players).map(p => p.slot);
        if (slots.length >= 2) { full = true; return undefined; }
        cur.players[sync.uid] = { name, slot: slots.includes(0) ? 1 : 0, online: true };
        return cur;
      });
      if (!r.committed || !r.value) { toast(full ? "Someone else just took the free seat" : "No game with that code"); return false; }
      enter(code, sync, name);
      return true;
    } catch (e) { explain(e); return false; }
  }

  function enter(code, sync, name) {
    room = { code, sync, uid: sync.uid, name, data: null, here: {}, online: true, stop: [] };
    setRoomParam(code);
    watch();
    room.stop.push(
      sync.presence?.(`${path(code)}/players/${sync.uid}`),
      sync.connection?.(ok => { if (room) { room.online = ok; onPresence(); } }),
      enterRoom(sync, code, game, name, here => { if (room) { room.here = here; onPresence(); } }),
    );
  }
  function watch() {
    room.unwatch?.();
    room.unwatch = room.sync.watch(path(room.code), onRoom, explain);
  }
  function onRoom(val) {
    if (!room) return;
    if ((val?.app || 0) > app) { updateApp(); return; }
    if (!valid(val)) { toast("That game has ended"); leave(); return; }
    if (!seatsOf(val).some(([id]) => id === room.uid)) { toast("This game continued on another device"); leave(); return; }
    room.data = val;
    try { onState(val); }
    catch (e) { console.error(e); toast("Something went wrong showing the last move; it's still saved"); }   // never freeze
  }

  /** Back from the background (Safari may have frozen the page): reconnect and fetch the room afresh. */
  function resync() {
    if (!room || document.hidden) return;
    room.sync.reconnect?.();
    watch();
  }

  /**
   * Changes the game state in one transaction; change(state) returns false to do nothing. Resolves to whether
   * it saved. (Firebase may first offer an empty cached value; answering null makes it check the server.)
   */
  async function act(change) {
    if (!room) return false;
    let newer = false;
    try {
      const r = await room.sync.tx(path(room.code), cur => {
        if (cur === null) return null;
        if (!valid(cur)) return undefined;
        if ((cur.app || 0) > app) { newer = true; return undefined; }
        cur.app = app;
        return change(cur) === false ? undefined : cur;
      });
      if (newer) { updateApp(); return false; }
      return !!(r.committed && r.value && valid(r.value));
    } catch (e) {
      console.error(e);
      toast("Couldn't save that: check your connection and try again");
      return false;
    }
  }

  /** Another device runs newer code: fetch the new files past the browser cache and reload, once per session. */
  async function updateApp() {
    const flag = `${game}:updated`;
    try {
      if (sessionStorage.getItem(flag)) { toast("Your partner has a newer version: close and reopen the game"); return; }
      sessionStorage.setItem(flag, "1");
    } catch { /* private mode */ }
    toast("Updating to the newest version…");
    const own = performance.getEntriesByType("resource").map(e => e.name).filter(u => u.startsWith(location.origin));
    await Promise.all([location.href, ...own].map(u => fetch(u, { cache: "reload" }).catch(() => null)));
    location.reload();
  }

  /** Leaves the room for good (every game). */
  function leave() {
    if (!room) return;
    room.unwatch?.();
    room.stop.forEach(stop => stop?.());
    leaveRoom(room.sync, room.code);
    room = null;
    setRoomParam(null);
    onLeave();
  }

  /** Who else is here: { name, online, game } (game is set when they have another game of the room open), or null. */
  function partner() {
    if (!room) return null;
    const seated = seatsOf(room.data).find(([id]) => id !== room.uid);
    const there = otherHere(room.here, room.uid);
    if (there && there.game !== game) return { name: there.name, online: there.online, game: there.game };
    if (!seated && !there) return null;
    return { name: seated?.[1].name || there.name, online: there ? there.online : seated[1].online !== false, game: null };
  }

  return {
    get room() { return room; },
    get online() { return room ? room.online : true; },
    start, join, act, leave, resync, partner,
  };
}
