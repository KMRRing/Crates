// Playing together: one shared room in Firebase Realtime Database, two players.
import { BANK, nameMatches, shuffled, wordsKey, RESULT_LABEL, arr, cleanSettings, defaultSettings } from "./core.js";
import { generate, encode, decode, describe, hintFor, classify } from "./gen.js";
import * as view from "./view.js";

const LIVES = 2;          // per player, per board
const CLUES = 2;          // per player, per board; unused clues don't carry over
const RECENT_ANSWERS = 16;
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const roomPath = code => `crates/rooms/${code}`;

let syncPromise = null;
function getSync() {
  if (window.__cratesSync) return Promise.resolve(window.__cratesSync);   // test harness
  syncPromise = syncPromise || import("./sync.js").then(m => m.connect());
  return syncPromise;
}

const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");

/** A fresh board for the room, drawn with the room's pool and settings. */
function newBoard(room, n) {
  const settings = cleanSettings(room.settings);
  const b = generate({ pool: room.pool, settings, recentA: arr(room.recentA) })
    || generate({ pool: room.pool, settings: defaultSettings(), recentA: arr(room.recentA) });
  room.recentA = [...b.groups.map(g => g.a), ...arr(room.recentA)].filter((a, i, all) => all.indexOf(a) === i).slice(0, RECENT_ANSWERS);
  return { n, code: encode(b), order: shuffled(describe(b).flatMap(g => g.words)),
    found: [], guesses: [], revealed: [], pending: null, done: false, won: false };
}

/** Normalise a room snapshot: Realtime Database drops empty arrays and nulls. */
function tidy(room) {
  if (!room || !room.board) return null;
  room.players = room.players || {};
  for (const pl of Object.values(room.players)) {
    pl.sel = arr(pl.sel);
    pl.clues = Math.min(Number.isFinite(pl.clues) ? pl.clues : CLUES, CLUES);
  }
  const b = room.board;
  b.order = arr(b.order); b.found = arr(b.found);
  b.guesses = arr(b.guesses).map(g => ({ ...g, words: arr(g.words), lv: arr(g.lv) }));
  b.revealed = arr(b.revealed); b.pending = b.pending || null;
  room.recentA = arr(room.recentA);
  room.settings = cleanSettings(room.settings);
  room.tally = room.tally || { maps: 0, points: 0 };
  return room;
}
const boardScore = b => b.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);

export function createCoop({ onLeave, setRoomParam, setPoolParam }) {
  let sync, code, room, unwatch, uid;
  let mySel = new Set();
  let seen = { n: 0, guesses: 0, found: 0 };
  let menuOnFirstSnapshot = false;
  let decoded = { code: null, board: null, info: null };

  const me = () => room?.players?.[uid];
  const nameOf = id => room.players[id]?.name || "Partner";
  const slotOf = id => room.players[id]?.slot ?? 0;
  const link = () => `${location.origin}${location.pathname}?room=${code}`;
  const current = () => {
    if (decoded.code !== room.board.code) {
      const board = decode(room.board.code);
      decoded = { code: room.board.code, board, info: board && describe(board) };
    }
    return decoded;
  };

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

  function endIfOut(r) {
    const everyone = Object.values(r.players);
    if (everyone.length && everyone.every(pl => pl.lives <= 0)) {
      r.board.done = true; r.board.won = false;
      r.tally.maps += 1; r.tally.points += boardScore(r.board);
    }
  }

  // ---------- view model ----------
  function vm() {
    const b = room.board, { board, info } = current(), mine = me();
    const taken = new Set(b.found.flatMap(f => info[f.g].words));
    if (b.done) info.forEach(gr => gr.words.forEach(w => taken.add(w)));
    const solved = b.found.map(f => ({ ...f, by: nameOf(f.by) }));
    if (b.done) info.forEach((_, g) => { if (!solved.some(r => r.g === g)) solved.push({ g, missed: true }); });

    const partnerSel = new Map();
    Object.entries(room.players).forEach(([id, pl]) => {
      if (id === uid) return;
      pl.sel.forEach(w => { if (!taken.has(w)) partnerSel.set(w, [...(partnerSel.get(w) || []), { slot: pl.slot, name: pl.name }]); });
    });

    const players = Object.entries(room.players)
      .map(([id, pl]) => ({ ...pl, me: id === uid, maxLives: LIVES, maxClues: CLUES }))
      .sort((a, c) => a.slot - c.slot);

    let status = "";
    if (b.pending && b.pending.by !== uid) status = `${nameOf(b.pending.by)} found a crate and is naming it…`;
    else if (!b.done && mine.lives <= 0) status = "You're out of lives. Your picks still show on your partner's screen.";

    const pts = boardScore(b);
    return {
      mode: "coop", category: board.cat, pool: room.pool, label: b.n, boardKey: `${b.code}#${b.n}`,
      groupsInfo: info, order: b.order, taken, solved, mySel, partnerSel,
      revealed: new Map(b.revealed.map(r => [r.w, slotOf(r.by)])),
      myClues: mine.clues,
      players,
      pending: b.pending ? { g: b.pending.g, mine: b.pending.by === uid } : null,
      status,
      canSubmit: mySel.size === 4 && !b.done && !b.pending && mine.lives > 0,
      submitLabel: mine.lives > 0 ? "Submit" : "No lives",
      feed: b.guesses.map(g => ({ by: nameOf(g.by), slot: slotOf(g.by), words: g.words, res: g.res })),
      done: b.done,
      resultLine: b.won ? `Solved together · ${pts} of 8` : `Out of lives · ${pts} of 8`,
      sessionLine: `This session: ${room.tally.maps} board${room.tally.maps === 1 ? "" : "s"} · ${room.tally.points} points`,
      canShare: false, canNext: true, nextLabel: "Next board",
    };
  }
  const draw = () => room && me() && current().board && view.render(vm());

  // ---------- incoming changes ----------
  function onRoom(val) {
    if (!val) { view.toast("That game has ended", 3000); leave(); return; }
    const t = tidy(val);
    if (!t) { view.toast("That game is from an older version, start a new one", 3500); leave(); return; }
    room = t;
    if (!me()) { view.toast("You're no longer in this game", 3000); leave(); return; }
    const b = room.board, { board, info } = current();
    if (!board) { view.toast("This board doesn't exist in your version, reload the page", 4000); return; }

    if (b.n !== seen.n) {                       // a new board started
      if (seen.n) view.toast(`New board · ${CLUES} clues each`, 2200);
      seen = { n: b.n, guesses: b.guesses.length, found: b.found.length };
      mySel = new Set(me().sel);
      view.showClue(null);
    } else {
      b.guesses.slice(seen.guesses).forEach(g => {
        const who = g.by === uid ? "You" : nameOf(g.by);
        if (g.res !== "right") view.toast(`${who}: ${RESULT_LABEL[g.res].toLowerCase()}`, 2200);
      });
      b.found.slice(seen.found).forEach(f => {
        const ans = info[f.g].answer, who = f.by === uid ? "You" : nameOf(f.by);
        view.toast(f.named ? `${who} named ${ans}` : `${ans}, half marks`, 2400);
      });
      seen.guesses = b.guesses.length;
      seen.found = b.found.length;
      if (b.done && !b.won) view.toast("Out of lives", 2500);
    }
    const taken = new Set(b.found.flatMap(f => info[f.g].words));
    for (const w of [...mySel]) if (taken.has(w) || b.done) mySel.delete(w);
    draw();
    if (menuOnFirstSnapshot) { menuOnFirstSnapshot = false; handlers.menu(); }
  }

  // ---------- actions ----------
  const pushSel = () => sync.update(`${roomPath(code)}/players/${uid}`, { sel: [...mySel] });

  function settingsSheet() {
    const owner = room.owner === uid;
    view.openSettings({
      settings: room.settings, editable: owner,
      note: owner ? "Your settings apply to both of you, from the next board."
        : `${nameOf(room.owner)}'s settings apply to this game.`,
      onChange: s => change(cur => { if (cur.owner !== uid) return false; cur.settings = cleanSettings(s); return cur; }),
      onBack: () => handlers.menu(),
    });
  }

  const handlers = {
    toggle(w) {
      const b = room.board;
      if (b.done || (b.pending && b.pending.by === uid)) return;
      if (mySel.has(w)) mySel.delete(w);
      else if (mySel.size < 4) mySel.add(w);
      else return;
      draw();
      pushSel();
    },
    async clue(w) {
      const b = room.board, { board } = current();
      if (b.done) return;
      if (b.revealed.some(r => r.w === w)) { view.showClue(w, hintFor(board, w)); return; }
      if (me().clues <= 0) { view.toast("You have no clues left", 1800); return; }
      const n = b.n;
      const r = await change((cur, why) => {
        const pl = cur.players[uid];
        if (cur.board.n !== n || cur.board.done) return false;
        if (cur.board.revealed.some(x => x.w === w)) return cur;
        if (pl.clues <= 0) { why("You have no clues left"); return false; }
        pl.clues -= 1;
        cur.board.revealed.push({ w, by: uid });
        return cur;
      });
      if (r.note) view.toast(r.note, 1800);
      if (r.committed) view.showClue(w, hintFor(board, w));
    },
    async submit() {
      if (mySel.size !== 4) return;
      const words = [...mySel], key = wordsKey(words), n = room.board.n, { board, info } = current();
      const r = await change((cur, why) => {
        const b = cur.board, pl = cur.players[uid];
        if (b.n !== n || b.done) return false;
        if (b.pending) { why("Wait for the crate to be named"); return false; }
        if (pl.lives <= 0) { why("You're out of lives"); return false; }
        if (b.guesses.some(g => wordsKey(g.words) === key)) { why("Already tried"); return false; }
        const taken = new Set(b.found.flatMap(f => info[f.g].words));
        if (words.some(w => taken.has(w))) { why("Part of that is already solved"); return false; }
        const c = classify(board, words);
        b.guesses.push({ by: uid, words, res: c.res, lv: c.lv });
        if (c.res === "right") {
          b.pending = { g: c.g, by: uid };
          for (const other of Object.values(cur.players)) other.sel = other.sel.filter(w => !words.includes(w));
        } else {
          pl.lives -= 1;
          endIfOut(cur);
        }
        pl.sel = [];
        return cur;
      });
      if (r.note) { view.toast(r.note, 1800); return; }
      if (r.committed) { mySel.clear(); draw(); }
    },
    async name(guess) {
      const n = room.board.n, { board } = current();
      await change(cur => {
        const b = cur.board;
        if (b.n !== n || !b.pending || b.pending.by !== uid) return false;
        const ans = BANK[board.groups[b.pending.g].a];
        const named = guess !== null && nameMatches(guess, ans);
        b.found.push({ g: b.pending.g, by: uid, named, guess: named ? null : (guess || null) });
        b.pending = null;
        if (b.found.length === 4) {
          b.done = true; b.won = true;
          cur.tally.maps += 1; cur.tally.points += boardScore(b);
        }
        return cur;
      });
      view.showClue(null);
    },
    clear() { mySel.clear(); draw(); pushSel(); },
    shuffle() { sync.update(`${roomPath(code)}/board`, { order: shuffled(room.board.order) }); },
    async next() {
      const n = room.board.n;
      await change(cur => {
        if (cur.board.n !== n || !cur.board.done) return false;
        cur.board = newBoard(cur, n + 1);
        for (const pl of Object.values(cur.players)) {
          pl.lives = LIVES;
          pl.clues = CLUES;
          pl.sel = [];
        }
        return cur;
      });
    },
    async pool(value) {
      setPoolParam(value);
      await change(cur => { cur.pool = value; return cur; });
      view.toast("Next board comes from the new pool", 2200);
    },
    share() {},
    menu() {
      view.openMenu((body, close) => {
        const h = document.createElement("h3");
        h.textContent = `Game ${code}`;
        body.appendChild(h);
        const p = document.createElement("p");
        p.className = "stats";
        p.textContent = Object.values(room.players).length < 2
          ? "Send your partner the link. They join from any phone or laptop."
          : Object.values(room.players).sort((a, b) => a.slot - b.slot)
            .map(pl => `${pl.name}${pl.online === false ? " (away)" : ""}`).join(" and ");
        body.appendChild(p);

        const row = document.createElement("div");
        row.className = "controls";
        const send = document.createElement("button");
        send.className = "btn primary";
        send.textContent = "Send link";
        send.addEventListener("click", async () => {
          try {
            if (navigator.share) await navigator.share({ title: "Crates", text: "Play Crates with me", url: link() });
            else { await navigator.clipboard.writeText(link()); view.toast("Link copied", 1500); }
          } catch { /* share sheet dismissed */ }
        });
        const copy = document.createElement("button");
        copy.className = "btn";
        copy.textContent = "Copy link";
        copy.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(link()); view.toast("Link copied", 1500); } catch { view.toast(link(), 6000); }
        });
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "btn";
        settingsBtn.textContent = "Settings";
        settingsBtn.addEventListener("click", settingsSheet);
        row.append(send, copy, settingsBtn);
        body.appendChild(row);

        const lk = document.createElement("p");
        lk.className = "room-link";
        lk.textContent = link();
        body.appendChild(lk);

        const leaveBtn = document.createElement("button");
        leaveBtn.className = "link";
        leaveBtn.textContent = "Leave and play solo";
        leaveBtn.addEventListener("click", () => { close(); leave(); });
        body.appendChild(leaveBtn);
      });
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

  function watch() {
    view.bind(handlers);
    setRoomParam(code);
    unwatch = sync.watch(roomPath(code), onRoom, err => explain(err));
    sync.presence?.(`${roomPath(code)}/players/${uid}`);
  }

  async function create(pool, settings) {
    const name = await askName();
    if (!(await connect())) return false;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const c = newCode();
        const room0 = { v: 2, owner: uid, created: Date.now(), pool, settings: cleanSettings(settings), recentA: [],
          players: { [uid]: { name, slot: 0, lives: LIVES, clues: CLUES, sel: [], online: true } },
          tally: { maps: 0, points: 0 } };
        room0.board = newBoard(room0, 1);
        const r = await sync.tx(roomPath(c), cur => (cur === null ? room0 : undefined));
        if (r.committed) {
          code = c;
          seen = { n: 0, guesses: 0, found: 0 };
          menuOnFirstSnapshot = true;             // show the link to send once the room is loaded
          watch();
          return true;
        }
      }
      view.toast("Couldn't start a game, try again", 3000);
    } catch (e) { explain(e); }
    return false;
  }

  async function join(c) {
    const name = await askName();
    if (!(await connect())) return false;
    code = c;
    let full = false, old = false;
    try {
      const r = await sync.tx(roomPath(c), cur => {
        full = false; old = false;
        if (cur === null) return null;
        const t = tidy(cur);
        if (!t) { old = true; return undefined; }
        if (t.players[uid]) { t.players[uid].name = name; return t; }
        const slots = Object.values(t.players).map(pl => pl.slot);
        if (slots.length >= 2) { full = true; return undefined; }
        t.players[uid] = { name, slot: slots.includes(0) ? 1 : 0, lives: LIVES, clues: CLUES, sel: [], online: true };
        return t;
      });
      if (!r.committed || !r.value) {
        view.toast(old ? "That game is from an older version, start a new one"
          : full ? "That game already has two players" : "No game with that code", 3500);
        return false;
      }
      seen = { n: 0, guesses: 0, found: 0 };
      watch();
      return true;
    } catch (e) { explain(e); return false; }
  }

  function stop() {
    unwatch?.();
    unwatch = null;
    room = null;
    mySel = new Set();
    decoded = { code: null, board: null, info: null };
  }

  function leave() {
    stop();
    setRoomParam(null);
    onLeave();
  }

  return { create, join, stop };
}
