// Playing together: one room in Firebase Realtime Database, two players, two modes.
//   shared: both of you see all sixteen words.
//   hidden: each of you sees only your own eight; every crate holds words from both sides.
// Your wrong guess shows your partner how close it was, and a crate you find is theirs to name.
// Clues come from a shared pool of four per board. In shared mode your partner reads the clue you
// open (description and crate colour). In hidden mode you spend clues on tiles that are sealed on
// your screen, and you see that tile's description and crate colour yourself; its owner only sees
// that a clue was used on it. The clue's ? takes the crate colour. Sealed tiles carry no labels: you
// point them out to each other.
import { BANK, nameMatches, shuffled, wordsKey, RESULT_LABEL, arr, cleanSettings, defaultSettings } from "./core.js";
import { generate, generateSplit, encode, decode, describe, hintFor, classify, groupIndexOf } from "./gen.js";
import { getSync } from "./net.js";
import * as view from "./view.js";
import { branchPath, openRoom, createRoom, enterRoom, leaveRoom, reseat, pickSeat, otherHere, GAMES } from "./rooms.js";
import { reportDuo } from "./suite.js";
import { part, action, line } from "./menu.js";

const LIVES = 4;          // team pool per board
const CLUES = 4;          // team pool per board; unused clues don't carry over
const RECENT_ANSWERS = 16;
// Crates' state lives in the crates branch of the app's shared rooms (rooms.js), beside the other games'.
const roomPath = code => branchPath(code, "crates");
export const MODES = {
  shared: { label: "Together", blurb: "Both of you see all sixteen words." },
  hidden: { label: "Hidden", blurb: "You each see eight; every crate needs both of you." },
};


/** A fresh board from the room's pool and settings; in hidden mode each side uses its own player's. */
function newBoard(room, n) {
  const recentA = arr(room.recentA);
  const shared = cleanSettings(room.settings);
  let b, fellBack = false;
  if (room.mode === "hidden") {
    const sides = [0, 1].map(slot => cleanSettings(Object.values(room.players).find(p => p.slot === slot)?.settings));
    b = generateSplit({ pool: room.pool, sides, off: shared.off, recentA });
    if (!b) { fellBack = true; b = generateSplit({ pool: room.pool, sides: [defaultSettings(), defaultSettings()], recentA }); }
  } else {
    b = generate({ pool: room.pool, settings: shared, recentA });
    if (!b) { fellBack = true; b = generate({ pool: room.pool, settings: defaultSettings(), recentA }); }
  }
  room.recentA = [...b.groups.map(g => g.a), ...recentA].filter((a, i, all) => all.indexOf(a) === i).slice(0, RECENT_ANSWERS);
  return {
    n, code: encode(b), sides: b.sides ? b.sides.flat().join("") : null, order: shuffled(describe(b).flatMap(g => g.words)),
    found: [], guesses: [], revealed: [], pending: null, done: false, won: false,
    lives: LIVES, clues: CLUES, fellBack,
  };
}

/** Normalise a room snapshot: Realtime Database drops empty arrays and nulls. */
function tidy(room) {
  if (!room || room.v !== 3 || !room.players) return null;
  for (const pl of Object.values(room.players)) {
    pl.sel = arr(pl.sel);
    pl.settings = cleanSettings(pl.settings);
    pl.ready = pl.ready === true;
  }
  room.settings = cleanSettings(room.settings);
  room.recentA = arr(room.recentA);
  room.tally = room.tally || { maps: 0, points: 0 };
  const b = room.board;
  if (b) {
    b.order = arr(b.order); b.found = arr(b.found);
    b.guesses = arr(b.guesses).map(g => ({ ...g, words: arr(g.words), lv: arr(g.lv) }));
    b.revealed = arr(b.revealed);
    b.pending = b.pending || null; b.sides = b.sides || null;
  }
  return room;
}
const boardScore = b => b.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);

export function createCoop({ onLeave, setRoomParam, setPoolParam, mySettings, myPool }) {
  let sync, code, room, unwatch, uid, stopHere;
  let here = {};                // who has which game of this room open: { uid: { game, name, online } }
  let mySel = new Set();
  let seen = null;              // what this screen has already announced: { n, guesses, found, revealed }
  let clueShown = null;         // word whose clue is on show
  let peek = null;              // hidden mode: the sealed tile you've tapped, offering a clue
  let lobbyPrompted = false;    // the setup sheet opens by itself once per game
  let menuOnFirstSnapshot = false;
  let decoded = { code: null };

  const me = () => room?.players?.[uid];
  const partnerId = () => Object.keys(room.players).find(id => id !== uid) || null;
  const nameOf = id => room.players[id]?.name || "your partner";
  const slotOf = id => room.players[id]?.slot ?? 0;
  const hidden = () => room.mode === "hidden";
  const link = () => `${location.origin}${location.pathname}?room=${code}`;

  /** The decoded board, plus each word's crate colour and (hidden mode) which player holds it. */
  function current() {
    const b = room.board;
    if (decoded.code !== b.code || decoded.sides !== b.sides) {
      const board = decode(b.code), level = new Map(), side = new Map();
      if (board) {
        let k = 0;
        board.groups.forEach(g => g.w.forEach(i => {
          const w = BANK[g.a].words[i].w;
          level.set(w, g.level);
          if (b.sides) side.set(w, Number(b.sides[k]));
          k++;
        }));
      }
      decoded = { code: b.code, sides: b.sides, board, info: board && describe(board), level, side };
    }
    return decoded;
  }
  const mine = w => !hidden() || current().side.get(w) === me().slot;     // on my side of a hidden board
  function takenSet() {
    const b = room.board, { info } = current();
    const t = new Set(b.found.flatMap(f => info[f.g].words));
    if (b.done) info.forEach(g => g.words.forEach(w => t.add(w)));
    return t;
  }

  // ---------- transactions ----------
  async function change(fn) {
    let note = null;
    const r = await sync.tx(roomPath(code), cur => {
      note = null;
      if (cur === null) return null;              // cache cold: let the server hand us the real room
      const t = tidy(cur);
      if (!t) return undefined;
      const out = fn(t, msg => { note = msg; });
      return out === false ? undefined : out;     // false = abort
    });
    return { committed: r.committed, note };
  }

  // ---------- view model ----------
  /**
   * Hidden mode, a "one away" your partner made: whose pick is the odd one out. Shown to the player who
   * didn't submit (the submitter only learns it was wrong).
   */
  function oddPick(g) {
    if (!hidden() || g.res !== "one") return null;
    const { board } = current();
    const crates = g.words.map(w => groupIndexOf(board, w));
    const odd = g.words.find((w, k) => crates.filter(x => x === crates[k]).length === 1);
    const owner = Object.keys(room.players).find(id => room.players[id].slot === current().side.get(odd));
    return owner === uid ? "one of your picks is off" : `one of ${nameOf(owner)}'s picks is off`;
  }

  /** A guess as you may see it: your words (and solved ones) by name, your partner's sealed ones as a count. */
  function listWords(words, shown, partner) {
    const open = words.filter(shown), sealed = words.length - open.length;
    return [...open, ...(sealed ? [`${sealed} of ${nameOf(partner)}'s`] : [])].join(", ");
  }

  function players() {
    const elsewhere = id => (here[id] && here[id].game !== "crates" ? GAMES[here[id].game]?.name || null : null);
    const out = Object.entries(room.players).map(([id, pl]) => ({
      slot: pl.slot, name: pl.name, me: id === uid, online: here[id] ? here[id].online : pl.online,
      ready: !room.board && pl.ready, elsewhere: elsewhere(id),
    }));
    // your partner has another game of this room open and hasn't sat down in this one yet
    const o = otherHere(here, uid);
    if (o && !room.players[o.id] && o.game !== "crates") {
      out.push({ slot: 1 - (me()?.slot ?? 0), name: o.name, me: false, online: o.online, ready: false, elsewhere: elsewhere(o.id) });
    }
    return out.sort((a, c) => a.slot - c.slot);
  }

  /** The status line while you're alone in this game: who you're waiting for, and where they are. */
  function waiting() {
    const o = otherHere(here, uid);
    return o && o.game !== "crates" ? `Waiting for ${o.name}, who's in ${GAMES[o.game]?.name || "another game"} right now.`
      : "Waiting for your partner to join. Send the link from the menu.";
  }

  function lobbyVm() {
    const partner = partnerId();
    let status = "Set up your side in the menu, then press Ready.";
    if (!partner) status = waiting();
    else if (me().ready) status = room.players[partner].ready ? "Dealing…" : `Waiting for ${nameOf(partner)} to get ready.`;
    return {
      mode: "coop", category: null, pool: room.pool, label: "–", boardKey: "lobby",
      brief: "Hidden game: you each set up your own side, and your settings shape only the eight words dealt to you. The first board is dealt once you're both ready.",
      players: players(), team: null, status, groupsInfo: [], solved: [], cells: [], clue: null, feed: [],
      pending: null, hideControls: true, done: false,
    };
  }

  function vm() {
    if (!room.board) return lobbyVm();
    const b = room.board, { board, info, level } = current();
    const taken = takenSet();
    const partner = partnerId();
    const partnerSel = partner ? room.players[partner].sel.filter(w => !taken.has(w)) : [];
    const shown = w => mine(w) || taken.has(w);

    const solved = b.found.map(f => ({ ...f, by: nameOf(f.namer) }));
    if (b.done) info.forEach((_, g) => { if (!solved.some(r => r.g === g)) solved.push({ g, missed: true }); });

    const cells = b.order.filter(w => !taken.has(w)).map(w => {
      const sealed = !mine(w);
      const clue = b.revealed.find(r => r.w === w);
      let badge = null;
      if (!hidden()) {
        if (clue) badge = clue.by === uid ? { kind: "used" } : { kind: "open", level: level.get(w) };
        else if (mySel.has(w) && !b.done && partner) badge = { kind: b.clues > 0 ? "offer" : "spent" };
      } else if (sealed) {
        if (clue) badge = { kind: "open", level: level.get(w) };
        else if (peek === w && !b.done) badge = { kind: b.clues > 0 ? "offer" : "spent" };
      } else if (clue) badge = { kind: "used" };
      const psel = partnerSel.includes(w) ? [{ slot: slotOf(partner), name: nameOf(partner) }] : [];
      return { id: w, text: sealed ? "" : w, sealed, peek: sealed && peek === w && !clue, sel: mySel.has(w), psel, badge };
    });

    let clue = null;
    const shownClue = clueShown && b.revealed.find(r => r.w === clueShown);
    if (shownClue && !taken.has(shownClue.w)) {
      const w = shownClue.w;
      if (!hidden() && shownClue.by !== uid) {
        clue = { label: w, text: hintFor(board, w), level: level.get(w), note: `${nameOf(shownClue.by)} opened this clue for you to read.` };
      } else if (hidden() && !mine(w)) {
        clue = { label: "Sealed tile", text: hintFor(board, w), level: level.get(w),
          note: `Only you can see this. ${nameOf(partner)} can see the word: talk it through.` };
      }
    }

    let status = "";
    if (!partner) status = waiting();
    else if (b.pending) status = b.pending.namer === uid ? "" : `${nameOf(b.pending.namer)} is naming the crate${b.pending.by === uid ? " you found" : ""}…`;

    const picks = mySel.size + (hidden() ? partnerSel.length : 0);
    const pts = boardScore(b);
    return {
      mode: "coop", category: board.cat, pool: room.pool, label: b.n, boardKey: `${b.code}#${b.n}`,
      brief: hidden() ? "" : null,           // hidden mode shows no description
      groupsInfo: info, solved, cells, clue, players: players(),
      team: { lives: b.lives, maxLives: LIVES, clues: b.clues, maxClues: CLUES },
      pending: b.pending ? { g: b.pending.g, mine: b.pending.namer === uid } : null,
      status,
      canSubmit: !!partner && picks === 4 && !b.done && !b.pending && b.lives > 0,
      feed: b.guesses.map(g => ({
        by: nameOf(g.by), slot: slotOf(g.by),
        words: g.res === "right" ? g.words.join(", ") : listWords(g.words, shown, partner),   // a found crate is open to both
        res: g.by === uid && g.res !== "right" ? "hidden" : g.res,
        note: g.by === uid ? null : oddPick(g),
      })),
      done: b.done,
      resultLine: b.won ? `Solved together · ${pts} of 8` : `Out of lives · ${pts} of 8`,
      subLine: `This session: ${room.tally.maps} board${room.tally.maps === 1 ? "" : "s"} · ${room.tally.points} points`,
      canShare: false, canNext: true, nextLabel: "Next board",
    };
  }
  const draw = () => room && me() && (!room.board || current().board) && view.render(vm());

  // ---------- incoming changes ----------
  function announce(b) {
    const { info } = current(), partner = partnerId();
    b.guesses.slice(seen.guesses).forEach(g => {
      if (g.res === "right") return;
      if (g.by === uid) view.toast(partner ? `Wrong. ${nameOf(partner)} saw how close it was.` : "Wrong", 2600);
      else view.toast([`${nameOf(g.by)}: ${RESULT_LABEL[g.res].toLowerCase()}`, oddPick(g)].filter(Boolean).join(", "), 2800);
    });
    b.found.slice(seen.found).forEach(f => {
      const ans = info[f.g].answer, who = f.namer === uid ? "You" : nameOf(f.namer);
      view.toast(f.named ? `${who} named ${ans}` : `${ans}: half marks`, 2400);
    });
    b.revealed.slice(seen.revealed).forEach(r => {
      if (!hidden()) {
        if (r.by === uid) view.toast(`Clue sent: only ${nameOf(partner)} can read it`, 2400);
        else { clueShown = r.w; view.toast(`${nameOf(r.by)} opened a clue for you`, 2400); }
      } else if (r.by !== uid) {
        view.toast(`${nameOf(r.by)} used a clue on one of your tiles`, 2600);
      }
    });
    if (b.done && !seen.done && !b.won) view.toast("Out of lives", 2500);
  }

  const reportedBoards = new Set();
  function onRoom(val) {
    if (!val) { view.toast("That game has ended", 3000); leave(); return; }
    const t = tidy(val);
    if (!t) { view.toast("That game is from an older version, start a new one", 3500); leave(); return; }
    room = t;
    if (!me()) { view.toast("You're no longer in this game", 3000); leave(); return; }
    const b = room.board;
    if (!b) {                                   // hidden-mode lobby
      seen = null;
      draw();
      if (!lobbyPrompted) { lobbyPrompted = true; handlers.menu(); }
      else if (view.menuTag() === "game") handlers.menu();    // keep the open sheet's ready states current
      return;
    }
    const { board } = current();
    if (!board) { view.toast("This board doesn't exist in your version, reload the page", 4000); return; }
    if (!seen || b.n !== seen.n) {              // a new board
      if (seen) view.toast(`New board · ${LIVES} lives, ${CLUES} clues`, 2200);
      else if (lobbyPrompted && b.n === 1) view.closeMenu();                // the lobby is over: deal
      if (b.fellBack) view.toast("Settings were too narrow for a board, so this one uses Balanced", 3500);
      mySel = new Set(me().sel);
      clueShown = null;
      peek = null;
    } else {
      announce(b);
    }
    // a board finished together is a team result for the duo record: cleared (all four found) or not, once per board
    if (b.done && !reportedBoards.has(b.code)) {
      reportedBoards.add(b.code);
      reportDuo("crates", b.code, { score: null, won: b.found.length >= 4, coop: true }).catch(e => console.error(e));
    }
    seen = { n: b.n, guesses: b.guesses.length, found: b.found.length, revealed: b.revealed.length, done: b.done };
    const taken = takenSet();
    for (const w of [...mySel]) if (taken.has(w) || b.done) mySel.delete(w);
    draw();
    if (menuOnFirstSnapshot) { menuOnFirstSnapshot = false; handlers.menu(); }
  }

  // ---------- actions ----------
  const pushSel = () => sync.update(`${roomPath(code)}/players/${uid}`, { sel: [...mySel] });

  async function toggleReady() {
    await change(cur => {
      cur.players[uid].ready = !cur.players[uid].ready;
      const everyone = Object.values(cur.players);
      if (!cur.board && everyone.length === 2 && everyone.every(p => p.ready)) cur.board = newBoard(cur, 1);
      return cur;
    });
  }

  function settingsSheet() {
    const owner = room.owner === uid, back = () => handlers.menu();
    if (!hidden()) {
      view.openSettings({
        settings: room.settings, editable: owner, onBack: back, pool: room.pool,
        note: owner ? "Your settings apply to both of you, from the next board." : `${nameOf(room.owner)}'s settings apply to this game.`,
        onChange: s => change(cur => { if (cur.owner !== uid) return false; cur.settings = cleanSettings(s); return cur; }),
      });
      return;
    }
    view.openSettings({
      settings: { ...me().settings, off: room.settings.off }, editable: { words: true, groups: owner }, onBack: back, pool: room.pool,
      note: `Your preset, difficulty and topics shape only the eight words dealt to you. Which countries and commodities can come up is shared${owner ? " and set by you" : `, set by ${nameOf(room.owner)}`}.${room.board ? " Changes apply from the next board." : ""}`,
      onChange: s => change(cur => {
        cur.players[uid].settings = cleanSettings({ ...s, off: [] });
        if (cur.owner === uid) cur.settings = cleanSettings({ ...cur.settings, off: s.off });
        return cur;
      }),
    });
  }

  const handlers = {
    toggle(w) {
      const b = room.board;
      if (!b || b.done) return;
      if (!mine(w)) {                           // a sealed tile: tap to offer a clue on it, or reread one
        if (b.revealed.some(r => r.w === w)) clueShown = w;
        else peek = peek === w ? null : w;
        draw();
        return;
      }
      if (b.pending) return;
      if (mySel.has(w)) mySel.delete(w);
      else {
        const theirs = hidden() && partnerId() ? room.players[partnerId()].sel.length : 0;
        if (mySel.size + theirs >= 4) { if (theirs) view.toast("Four are picked between you", 1500); return; }
        mySel.add(w);
      }
      draw();
      pushSel();
    },
    async clue(w) {
      const b = room.board, partner = partnerId();
      if (!b || b.done) return;
      const r = b.revealed.find(x => x.w === w);
      if (hidden()) {
        if (mine(w)) { if (r) view.toast(`${nameOf(r.by)} used a clue on this one`, 2000); return; }
        if (r) { clueShown = w; draw(); return; }
        if (b.clues <= 0) { view.toast("No clues left on this board", 1800); return; }
        const res = await change((cur, why) => {
          const bb = cur.board;
          if (bb.n !== b.n || bb.done) return false;
          if (bb.revealed.some(x => x.w === w)) return cur;
          if (bb.clues <= 0) { why("No clues left on this board"); return false; }
          bb.clues -= 1;
          bb.revealed.push({ w, by: uid });
          return cur;
        });
        if (res.note) view.toast(res.note, 1800);
        if (res.committed) { peek = null; clueShown = w; draw(); }
        return;
      }
      if (r) {
        if (r.by === uid) view.toast(`Only ${nameOf(partner)} can read the clue you opened`, 2200);
        else { clueShown = w; draw(); }
        return;
      }
      if (!partner) { view.toast("Your partner reads your clues, so wait until they've joined", 2500); return; }
      if (b.clues <= 0) { view.toast("No clues left on this board", 1800); return; }
      const res = await change((cur, why) => {
        const bb = cur.board;
        if (bb.n !== b.n || bb.done) return false;
        if (bb.revealed.some(x => x.w === w)) return cur;
        if (bb.clues <= 0) { why("No clues left on this board"); return false; }
        bb.clues -= 1;
        bb.revealed.push({ w, by: uid });
        return cur;
      });
      if (res.note) view.toast(res.note, 1800);
    },
    async submit() {
      const b = room.board, partner = partnerId();
      const theirs = hidden() && partner ? room.players[partner].sel : [];
      const words = [...mySel, ...theirs];
      if (words.length !== 4) return;
      const key = wordsKey(words), n = b.n, { board, info } = current();
      const right = classify(board, words).res === "right";
      const r = await change((cur, why) => {
        const bb = cur.board;
        if (bb.n !== n || bb.done || bb.lives <= 0) return false;
        if (bb.pending) { why("Wait for the crate to be named"); return false; }
        if (hidden() && wordsKey([...mySel, ...(cur.players[partner]?.sel || [])]) !== key) {
          why("Your partner changed their picks"); return false;
        }
        if (bb.guesses.some(g => wordsKey(g.words) === key)) { why("Already tried"); return false; }
        const taken = new Set(bb.found.flatMap(f => info[f.g].words));
        if (words.some(w => taken.has(w))) { why("Part of that is already solved"); return false; }
        const c = classify(board, words);
        bb.guesses.push({ by: uid, words, res: c.res, lv: c.lv });
        if (c.res === "right") {
          // the crate is your partner's to name (yours only if they're not here)
          const namer = Object.entries(cur.players).find(([id, p]) => id !== uid && p.online !== false)?.[0] || uid;
          bb.pending = { g: c.g, by: uid, namer };
        } else {
          bb.lives -= 1;
          if (bb.lives <= 0) {
            bb.done = true; bb.won = false;
            cur.tally.maps += 1; cur.tally.points += boardScore(bb);
          }
        }
        // a found crate's tiles leave both selections; after a wrong guess everyone keeps their picks
        if (c.res === "right") for (const pl of Object.values(cur.players)) pl.sel = pl.sel.filter(w => !words.includes(w));
        return cur;
      });
      if (r.note) { view.toast(r.note, 1800); return; }
      if (r.committed && right) { mySel.clear(); draw(); }
    },
    async name(guess) {
      const n = room.board.n, { board } = current();
      await change(cur => {
        const b = cur.board;
        if (b.n !== n || !b.pending || b.pending.namer !== uid) return false;
        const ans = BANK[board.groups[b.pending.g].a];
        const named = guess !== null && nameMatches(guess, ans);
        b.found.push({ g: b.pending.g, by: b.pending.by, namer: uid, named, guess: named ? null : (guess || null) });
        b.pending = null;
        if (b.found.length === 4) {
          b.done = true; b.won = true;
          cur.tally.maps += 1; cur.tally.points += boardScore(b);
        }
        return cur;
      });
    },
    clear() { mySel.clear(); draw(); pushSel(); },
    shuffle() { if (room.board) sync.update(`${roomPath(code)}/board`, { order: shuffled(room.board.order) }); },
    async next() {
      const n = room.board.n;
      await change(cur => {
        if (cur.board.n !== n || !cur.board.done) return false;
        cur.board = newBoard(cur, n + 1);
        for (const pl of Object.values(cur.players)) pl.sel = [];
        return cur;
      });
    },
    async pool(value) {
      setPoolParam(value);
      await change(cur => { cur.pool = value; return cur; });
      view.toast(room.board ? "Next board comes from the new pool" : "Pool set for the first board", 2200);
    },
    share() {},
    menu() {
      // the duo match's menu: Play (in the hidden-mode lobby: ready, and your side), Together (who's here, the match's
      // settings or your side, back to solo)
      view.openMenu((body, close) => {
        const together = part(body, "together");
        together.append(line(players().map(pl => `${pl.name}${pl.online === false ? " (away)" : ""}${pl.ready ? " ✓ ready" : ""}`).join(" and ") || `${MODES[room.mode].label} game`));
        if (!room.board) {                                        // hidden-mode lobby
          part(body, "play").append(action(me().ready ? "Not ready" : "I'm ready", toggleReady, "primary"), action("Set up your side", settingsSheet));
        } else together.append(action(hidden() ? "Your side" : "Settings", settingsSheet));
        together.append(action("Back to solo", () => { close(); leave(); }, "link"));
      }, "game");
    },
  };

  // ---------- lifecycle ----------
  async function askName() {
    const saved = localStorage.getItem("crates:name");
    if (saved) return saved;
    const name = await view.askWho("");
    try { localStorage.setItem("crates:name", name); } catch { /* private mode */ }
    return name;
  }

  async function connect() {
    try {
      sync = await getSync();
      uid = sync.uid;
      return true;
    } catch (e) {
      console.error(e);
      view.toast("Couldn't reach the game server", 4000);
      return false;
    }
  }

  function explain(e) {
    console.error(e);
    view.toast(/permission/i.test(String(e?.message || e)) ? "Together mode isn't switched on in Firebase yet" : "Couldn't reach the game server", 5000);
  }

  function watch(name) {
    view.bind(handlers);
    setRoomParam(code);
    unwatch = sync.watch(roomPath(code), onRoom, err => explain(err));
    sync.presence?.(`${roomPath(code)}/players/${uid}`);
    stopHere = enterRoom(sync, code, "crates", name, h => { here = h; draw(); });
  }

  /** Crates' state for a room: this mode, pool and settings, with you seated. */
  function freshRoom(mode, pool, settings, name) {
    const room0 = {
      v: 3, mode, owner: uid, created: Date.now(), pool, settings: cleanSettings(settings), recentA: [],
      players: { [uid]: { name, slot: 0, sel: [], online: true, ready: false, settings: cleanSettings(settings) } },
      tally: { maps: 0, points: 0 },
    };
    if (mode !== "hidden") room0.board = newBoard(room0, 1);
    return room0;
  }

  async function create(mode, pool, settings) {
    const name = await askName();
    if (!(await connect())) return false;
    try {
      const c = await createRoom(sync, "crates", freshRoom(mode, pool, settings, name));
      if (!c) { view.toast("Couldn't start a game, try again", 3000); return false; }
      code = c;
      seen = null;
      lobbyPrompted = false;
      menuOnFirstSnapshot = mode !== "hidden";   // show the link to send (the lobby opens its own sheet)
      watch(name);
      return true;
    } catch (e) { explain(e); }
    return false;
  }

  /**
   * Joins a room. If it began in another game, Crates starts a Together game in it. When both seats are
   * taken you can carry on as either player (say after moving from laptop to phone); their other device leaves.
   */
  async function join(c) {
    let name = await askName();
    if (!(await connect())) return false;
    try {
      const shared = await openRoom(sync, c);
      if (!shared) { view.toast("No game with that code", 3500); return false; }
      const before = shared.crates ? tidy(shared.crates) : null;
      if (shared.crates && !before) { view.toast("That game is from an older version, start a new one", 3500); return false; }
      const seats = before ? Object.entries(before.players) : [];
      let takeover = null;
      if (before && !before.players[uid] && seats.length >= 2) {
        takeover = await pickSeat(seats);
        if (!takeover) return false;
        name = before.players[takeover].name;
      }
      let full = false;
      const r = await sync.tx(roomPath(c), cur => {
        full = false;
        if (cur === null) return before ? null : freshRoom("shared", myPool(), mySettings(), name);
        const t = tidy(cur);
        if (!t) return undefined;
        if (t.players[uid]) { t.players[uid].name = name; return t; }
        if (takeover && t.players[takeover]) return reseat(t, takeover, uid);   // their seat and moves are now this device's
        const slots = Object.values(t.players).map(pl => pl.slot);
        if (slots.length >= 2) { full = true; return undefined; }
        t.players[uid] = { name, slot: slots.includes(0) ? 1 : 0, sel: [], online: true, ready: false, settings: cleanSettings(mySettings()) };
        return t;
      });
      if (!r.committed || !r.value) {
        view.toast(full ? "Someone else just took the free seat" : "No game with that code", 3500);
        return false;
      }
      code = c;
      seen = null;
      lobbyPrompted = false;
      watch(name);
      return true;
    } catch (e) { explain(e); return false; }
  }

  function stop() {
    unwatch?.();
    unwatch = null;
    stopHere?.();
    stopHere = null;
    here = {};
    room = null;
    mySel = new Set();
    decoded = { code: null };
    view.closeMenu();
  }

  function leave() {
    if (sync && code) leaveRoom(sync, code);
    stop();
    setRoomParam(null);
    onLeave();
  }

  return { create, join, stop };
}
