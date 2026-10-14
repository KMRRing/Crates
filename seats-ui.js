// A seat game's page round its runner (seats.js): solo on this device, the game kept as <id>:game as it changes, the
// computer players in the other seats; Invite players starts a party with this game picked (party.html: its room, its
// QR code, the friends' names), and the party's host brings everyone here, to a table in the party's room where each
// takes a computer player's seat; a table in the address (?table=CODE) sits down at it; the narrator speaks each line
// on the phone that runs the table. The page draws each view and makes its moves through move().
import { localTable, createRunner } from "./seats.js";
import { openTable, inviteSheet, createNarrator, tableInAddress, savedName } from "./table-ui.js";
import { IN_FRAME } from "./suite.js";
import { onPause, isPaused, action, line } from "./menu.js";
import { busy } from "./loading.js";

/** A line with its seats named: {s2} becomes whoever sits in seat 2. */
export const fillNames = (text, seats) => String(text || "").replace(/\{s(\d+)\}/g, (_, i) => seats[Number(i)]?.name ?? `Seat ${Number(i) + 1}`);

/**
 * opts: rules (the game), id (its storage prefix and table branch), app (its code's version at a table), pace,
 * botName(seat), level() (the computer players' strength), voice() (the narrator on), onView(view), onOver(view),
 * toast(msg), newGame() (the page's own deal, with its options: what the host's phone deals on arriving at a party's
 * table). Returns { move, deal, view, invite, leave, menu(part), runner }.
 */
export function seatPage({ rules, id, app = 1, pace = 900, botName, level = () => null, voice = () => true, onView = () => {}, onOver = () => {}, toast = () => {}, newGame = null }) {
  const KEY = `${id}:game`;
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
    save(G) { if (!IN_FRAME) try { localStorage.setItem(KEY, JSON.stringify(G)); } catch { /* private mode */ } },
  };
  const solo = localTable(store, { name: savedName() || "You" });
  let narrator = createNarrator(), runner = null;

  let dealFirst = false;   // at a party's table, until its first state is in: whether this phone deals its first game
  function firstDeal() {
    if (!dealFirst || !remote.data) return;
    dealFirst = false;
    if (remote.me?.host && !remote.data.game) newGame?.();
  }
  const remote = openTable({
    game: id, app, max: rules.seats.max, toast,
    onState: () => { invite.update(); if (runner?.table === remote) runner.update(); firstDeal(); },
    onLeave: () => { invite.close(); narrator = createNarrator(); runner.use(solo); },
  });
  const invite = inviteSheet(remote, { title: "Invite players", note: "Scan with the camera, or open the link: no app needed. Each takes a computer player's seat." });

  runner = createRunner({
    rules, table: solo, level, pace, botName,
    paused: () => IN_FRAME || isPaused(),
    onView: v => {
      narrator.muted = !voice() || IN_FRAME;
      // solo, this phone speaks; at a table, the one that runs it; a seat named in a line ({s2}) by who sits there now
      const say = v.G?.say ? { ...v.G.say, text: fillNames(v.G.say.text, v.seats) } : null;
      v.said = narrator.hear({ say }, v.mode === "solo" ? { driver: true } : v.me) || "";
      onView(v);
    },
    onOver, onError: toast,
  });
  solo.onChange(() => { if (runner.table === solo) runner.update(); });
  onPause(() => {}, () => runner.kick());

  // playing with others starts a party, with this game picked (the one way in: its room, its QR code, its names)
  function inviteNow() {
    if (remote.code && !party) { invite.open(); return; }
    if (IN_FRAME) return;
    location.href = `party.html?game=${id}&invite=1`;
  }

  // a table in the address: sit down there (a guest from the QR code, a party's phones, or anyone after a reload); a
  // party's host, arriving at the table its lobby set, deals the first game with this page's own options (the host's,
  // not whichever phone runs the table: a guest's may get there first), once the table's first state is in
  const party = /[?&]party=[A-Za-z]{4}\b/.test(location.search);
  if (tableInAddress() && !IN_FRAME) {
    const done = busy("Joining the table");
    remote.joinAddress().then(ok => {
      if (!ok) return;
      narrator = createNarrator();
      dealFirst = party;
      runner.use(remote);
      firstDeal();
    }).finally(done);
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
    /** The table's part of the game's menu (its play part): invite, who's here, leave (in a party, the party's part
     *  at the menu's top says it all). */
    menu(part) {
      if (runner.table !== remote) {
        if (!IN_FRAME) part.append(action("Invite players", inviteNow));
        return;
      }
      if (party) return;
      const n = remote.players.length;
      part.append(line(`Table ${remote.code}: ${n} ${n === 1 ? "person" : "people"} at it${remote.me?.driver ? ", this phone runs it" : ""}.`));
      part.append(action("Invite players", () => invite.open()));
      part.append(action("Leave the table", () => remote.leave(), "link"));
    },
  };
}
