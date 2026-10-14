// A seat game's page round its runner (seats.js): solo on this device, the game kept as <id>:game as it changes, the
// computer players in the other seats; Invite players opens a table (table-ui.js) and carries the game on there, the
// friends who scan its QR code taking the computer players' seats; a table in the address (?table=CODE) sits down at
// it; the narrator speaks each line on the phone that runs the table; Leave the table goes back to the solo game as
// it was. The page draws each view and makes its moves through move().
import { localTable, createRunner } from "./seats.js";
import { openTable, inviteSheet, createNarrator, tableInAddress, savedName } from "./table-ui.js";
import { IN_FRAME } from "./suite.js";
import { onPause, isPaused, action, line } from "./menu.js";
import { busy } from "./loading.js";

/**
 * opts: rules (the game), id (its storage prefix and table branch), app (its code's version at a table), pace,
 * botName(seat), level() (the computer players' strength), voice() (the narrator on), onView(view), onOver(view),
 * toast(msg). Returns { move, deal, view, invite, leave, menu(part), runner }.
 */
export function seatPage({ rules, id, app = 1, pace = 900, botName, level = () => null, voice = () => true, onView = () => {}, onOver = () => {}, toast = () => {} }) {
  const KEY = `${id}:game`;
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
    save(G) { if (!IN_FRAME) try { localStorage.setItem(KEY, JSON.stringify(G)); } catch { /* private mode */ } },
  };
  const solo = localTable(store, { name: savedName() || "You" });
  let narrator = createNarrator(), runner = null;

  const remote = openTable({
    game: id, app, max: rules.seats.max, toast,
    onState: () => { invite.update(); if (runner?.table === remote) runner.update(); },
    onLeave: () => { invite.close(); narrator = createNarrator(); runner.use(solo); },
  });
  const invite = inviteSheet(remote, { title: "Invite players", note: "Scan with the camera, or open the link: no app needed. Each takes a computer player's seat." });

  runner = createRunner({
    rules, table: solo, level, pace, botName,
    paused: () => IN_FRAME || isPaused(),
    onView: v => {
      narrator.muted = !voice() || IN_FRAME;
      // solo, this phone speaks; at a table, the one that runs it
      v.said = narrator.hear({ say: v.G?.say }, v.mode === "solo" ? { driver: true } : v.me) || "";
      onView(v);
    },
    onOver, onError: toast,
  });
  solo.onChange(() => { if (runner.table === solo) runner.update(); });
  onPause(() => {}, () => runner.kick());

  async function inviteNow() {
    if (remote.code) { invite.open(); return; }
    if (IN_FRAME) return;
    const done = busy("Opening a table");
    try {
      const G = solo.data.game;
      const code = await remote.start(G ? { game: G } : {});
      if (code) { narrator = createNarrator(); runner.use(remote); invite.open(); }
    } finally { done(); }
  }

  // a table in the address: sit down there (a guest from the QR code, or anyone after a reload)
  if (tableInAddress() && !IN_FRAME) {
    const done = busy("Joining the table");
    remote.joinAddress().then(ok => { if (ok) { narrator = createNarrator(); runner.use(remote); } }).finally(done);
  } else runner.update();

  return {
    runner,
    get view() { return runner.view(); },
    get atTable() { return runner.table === remote; },
    get host() { return runner.table !== remote || !!remote.me?.driver; },
    move: m => runner.move(m),
    /** A new game: solo at once; at a table only the host's. */
    deal(options, seats) {
      if (runner.table === remote && !remote.me?.driver) { toast("The host deals the next game"); return Promise.resolve(false); }
      return runner.deal(options, seats);
    },
    invite: inviteNow,
    leave: () => remote.leave(),
    /** The table's part of the game's menu (its play part): invite, who's here, leave. */
    menu(part) {
      if (runner.table !== remote) {
        if (!IN_FRAME) part.append(action("Invite players", inviteNow));
        return;
      }
      const n = remote.players.length;
      part.append(line(`Table ${remote.code}: ${n} ${n === 1 ? "person" : "people"} at it${remote.me?.driver ? ", this phone runs it" : ""}.`));
      part.append(action("Invite players", () => invite.open()));
      part.append(action("Leave the table", () => remote.leave(), "link"));
    },
  };
}
