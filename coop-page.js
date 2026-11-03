// The page half of a shared board (docs/coop.md): a game page opened by the party of two (&coop=1 in its address, the
// party's code as ?room=) takes its board from the room instead of its own run, sends what its player does as edits
// (board-share.js), and has a way out. A game wires it with startCoop() and keeps its own drawing; everything about
// the room, the two phones and leaving is here.
//
//   const coop = await startCoop("slitherlink", { toast, fresh, show, exit });
//   coop.edit([cellEdit("marks", 12, "0", "1")])     a change of yours: shown at once, sent to the room, merged with theirs
//   coop.board                                       the board as you see it: the room's with your unsent edits on it
//
// Not for a duo match of Crates' head-to-head kind (together.js alone) and not for Crates' own co-op (coop.js).
import { createTogether } from "./together.js";
import { createEditor, commit, validBoard, newRoom, boardOf } from "./board-share.js";
import { createCoopBar, firstName } from "./coop-ui.js";
import { leaveCoop } from "./coop-request.js";
import { coopAdapter } from "./coop-games.js";
import { roomInAddress, joiningWords } from "./rooms.js";
import { playerId, IN_FRAME } from "./suite.js";
import { sure, notice } from "./sure.js";
import { busy } from "./loading.js";

/** The party's code when this page was opened to share a board (&coop=1), else null. Never inside a watching frame. */
export const coopInAddress = () => (!IN_FRAME && /[?&]coop=1\b/.test(location.search) ? roomInAddress() : null);

/** This page's address without the party in it: the game on its own, as it opens for you. */
export function soloAddress() {
  const u = new URL(location.href);
  for (const k of ["room", "new", "party", "at", "coop"]) u.searchParams.delete(k);
  u.hash = "";
  return u.pathname.split("/").pop() + u.search;
}

/**
 * Takes this page into the party of two. Resolves the controller once the room's board is drawn, or null when there is
 * no co-op to be in (it has ended; the page then carries on as your own game).
 *   toast(text)           a short message
 *   fresh()               a board to share when the host had none in play: { fixed, layers, start? } (or a promise of one)
 *   show(board, info)     draw this board; info: { fresh (a board not drawn before), host (this phone's player is the host) }
 *   bar(el)               places the co-op bar (a line: who you are with, the way out) in the page
 *   exit()                back to your own game (default: this page without the party)
 */
export async function startCoop(id, { toast, fresh, show, bar: place, exit = () => location.replace(soloAddress()) }) {
  const code = coopInAddress();
  if (!code) return null;
  const adapter = await coopAdapter(id), rules = adapter.rules || null, me = playerId();
  let editor = null, at = null, leaving = false, lastView = null, announce = true;
  let joined = busy(joiningWords(), { delay: 0 });
  const arrived = () => { joined?.(); joined = null; };
  const isHost = () => together.room?.data?.host === me;
  const otherName = () => { const g = together.room?.data; return together.others()[0]?.name || (isHost() ? g?.names?.guest : g?.names?.host) || "your partner"; };

  const coopBar = createCoopBar({ onLeave: () => leave() });
  place?.(coopBar.el);
  function drawBar() {
    const other = together.others()[0];
    coopBar.set({ name: otherName(), here: !!other?.here, host: isHost() });
  }

  async function send(edits, mine) {
    let rev = null;
    const ok = await together.act(g => {
      if (g.board?.start?.at !== mine) { rev = null; return false; }   // another board was dealt meanwhile: these edits were for the old one
      rev = commit(g, edits, rules);
      return rev != null;
    });
    return ok ? rev : null;
  }

  function onState(g) {
    arrived();
    if (!editor || g.board.start?.at !== at) {
      editor?.pause(true);                                          // the old board's editor stays quiet for good
      at = g.board.start?.at;
      const mine = at;
      editor = createEditor({
        board: g.board, rules, send: edits => send(edits, mine),
        onView: board => { lastView = board; show(board, { fresh: announce, host: isHost() }); announce = false; },
      });
      announce = true;
    }
    editor.pause(!together.online);
    editor.hear(g.board);
    drawBar();
    if (g.left && isHost()) guestLeft(g.left);
  }

  /** The guest has left: the host's puzzle is the host's again, with what the two of you drew on it. */
  async function guestLeft(who) {
    if (leaving) return;
    leaving = true;
    const room = together.room;
    if (room) await leaveCoop(room.sync, { code: room.code, game: id, host: true, uid: room.uid, pid: room.pid, name: room.name }).catch(e => console.error(e));
    await notice(`${firstName(who.name)} left the co-op. The puzzle is yours again, as far as you got.`, { ok: "Carry on" });
    exit();
  }

  /** The room went while this phone was in it: the host ended the co-op. */
  async function onGone(last) {
    if (leaving) return;
    leaving = true;
    arrived();
    await notice(last.host === me ? "The co-op has ended." : `${firstName(last.names?.host)} ended the co-op. You are back to your own puzzle.`, { ok: "Back to my puzzle" });
    exit();
  }

  const together = createTogether({
    game: id, app: 1,
    toast: text => { if (!leaving) toast(text); },
    askName: async () => { try { return (localStorage.getItem("crates:name") || "").trim() || "Player"; } catch { return "Player"; } },
    valid: g => validBoard(g) && adapter.valid(g.board),
    slots: 2,
    fresh: async (players, { ask } = {}) => newRoom(ask?.board || await fresh(), { players, host: ask?.from ?? me, extra: ask?.names ? { names: ask.names } : {} }),
    onState,
    onPresence: () => { if (together.room?.data) { editor?.pause(!together.online); drawBar(); } },
    onLeave: () => { if (!leaving) { leaving = true; arrived(); exit(); } },
    onGone,
  });

  /** The way out, after asking: the host ends the co-op for both, the guest goes back to their own puzzle. */
  async function leave() {
    if (leaving || !together.room) return;
    const host = isHost(), name = firstName(otherName());
    const ok = await sure(host ? `End the co-op? ${name} goes back to their own puzzle; this one stays with you, as far as you got.` : `Leave the co-op? You go back to your own puzzle; ${name} keeps this one.`,
      { yes: host ? "End the co-op" : "Leave", no: "Stay" });
    if (!ok || leaving || !together.room) return;
    leaving = true;
    const room = together.room;
    await leaveCoop(room.sync, { code: room.code, game: id, host, uid: room.uid, pid: room.pid, name: room.name }).catch(e => console.error(e));
    together.leave();
    exit();
  }

  if (!(await together.join(code))) {
    arrived();
    if (!leaving) { leaving = true; await notice("That co-op is over. You are back to your own puzzle.", { ok: "OK" }); exit(); }
    return null;
  }
  return {
    id, together, bar: coopBar,
    get board() { return editor?.view || lastView; },
    get host() { return isHost(); },
    get otherName() { return otherName(); },
    /** A change of this player's: an edit or a list of them (board-share.js). */
    edit: edits => editor?.edit(edits),
    /** Another board for both of you (the host's choice of the next puzzle, or either's once it is solved). */
    async renew(share) {
      const now = Date.now(), old = together.room?.data?.board?.start?.at || 0;
      return together.act(g => { g.board = boardOf(share, Math.max(now, old + 1)); delete g.left; });
    },
    leave,
  };
}
