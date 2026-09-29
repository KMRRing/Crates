// Playing together: one shared room in Firebase Realtime Database, two players.
import { PUZZLES, poolIndices, nameMatches, shuffled, clueFor, wordsKey, classify,
  RESULT_LABEL, arr } from "./core.js";
import * as view from "./view.js";

const LIVES = 2;          // per player, per puzzle
const START_CLUES = 2;    // per player on joining
const MAX_CLUES = 3;      // clues carry over; +1 per new puzzle up to this cap
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const roomPath = code => `crates/rooms/${code}`;

let syncPromise = null;
function getSync() {
  if (window.__cratesSync) return Promise.resolve(window.__cratesSync);   // test harness
  syncPromise = syncPromise || import("./sync.js").then(m => m.connect());
  return syncPromise;
}

const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");

function newMap(p, n) {
  return { n, p, order: shuffled(PUZZLES[p].groups.flatMap(gr => gr.words)),
    found: [], guesses: [], revealed: [], pending: null, done: false, won: false };
}

/** Normalise a room snapshot: Realtime Database drops empty arrays and nulls. */
function tidy(room) {
  if (!room) return null;
  room.queue = arr(room.queue);
  room.players = room.players || {};
  for (const pl of Object.values(room.players)) pl.sel = arr(pl.sel);
  const m = room.map;
  m.order = arr(m.order); m.found = arr(m.found); m.guesses = arr(m.guesses).map(g => ({ ...g, words: arr(g.words), lv: arr(g.lv) }));
  m.revealed = arr(m.revealed); m.pending = m.pending || null;
  room.tally = room.tally || { maps: 0, points: 0 };
  return room;
}
const mapScore = m => m.found.reduce((s, f) => s + 1 + (f.named ? 1 : 0), 0);

export function createCoop({ onLeave, setRoomParam, setPoolParam }) {
  let sync, code, room, unwatch, uid;
  let mySel = new Set();
  let seen = { n: 0, guesses: 0, found: 0 };
  let menuOnFirstSnapshot = false;

  const me = () => room?.players?.[uid];
  const others = () => Object.entries(room.players).filter(([id]) => id !== uid).map(([, pl]) => pl);
  const nameOf = id => room.players[id]?.name || "Partner";
  const slotOf = id => room.players[id]?.slot ?? 0;
  const link = () => `${location.origin}${location.pathname}?room=${code}`;

  // ---------- transactions ----------
  async function change(fn) {
    let note = null;
    const r = await sync.tx(roomPath(code), cur => {
      note = null;
      if (cur === null) return null;              // cache cold: let the server hand us the real room
      const out = fn(tidy(cur), msg => { note = msg; });
      return out === false ? undefined : out;     // false = abort
    });
    return { committed: r.committed, note };
  }

  function endIfOut(r) {
    const everyone = Object.values(r.players);
    if (everyone.length && everyone.every(pl => pl.lives <= 0)) {
      r.map.done = true; r.map.won = false;
      r.tally.maps += 1; r.tally.points += mapScore(r.map);
    }
  }

  // ---------- view model ----------
  function vm() {
    const m = room.map, p = PUZZLES[m.p], mine = me();
    const taken = new Set(m.found.flatMap(f => p.groups[f.g].words));
    if (m.done) p.groups.forEach(gr => gr.words.forEach(w => taken.add(w)));
    const solved = m.found.map(f => ({ ...f, by: nameOf(f.by) }));
    if (m.done) p.groups.forEach((_, g) => { if (!solved.some(r => r.g === g)) solved.push({ g, missed: true }); });

    const partnerSel = new Map();
    Object.entries(room.players).forEach(([id, pl]) => {
      if (id === uid) return;
      pl.sel.forEach(w => { if (!taken.has(w)) partnerSel.set(w, [...(partnerSel.get(w) || []), { slot: pl.slot, name: pl.name }]); });
    });

    const players = Object.entries(room.players)
      .map(([id, pl]) => ({ ...pl, me: id === uid, maxLives: LIVES, maxClues: MAX_CLUES }))
      .sort((a, b) => a.slot - b.slot);

    let status = "";
    if (m.pending && m.pending.by !== uid) status = `${nameOf(m.pending.by)} found a crate and is naming it…`;
    else if (!m.done && mine.lives <= 0) status = "You're out of lives. Your picks still show on your partner's screen.";

    const pts = mapScore(m);
    return {
      mode: "coop", puzzle: p, idx: m.p, pool: room.pool,
      order: m.order, taken, solved, mySel, partnerSel,
      revealed: new Map(m.revealed.map(r => [r.w, slotOf(r.by)])),
      myClues: mine.clues,
      players,
      pending: m.pending ? { g: m.pending.g, mine: m.pending.by === uid } : null,
      status,
      canSubmit: mySel.size === 4 && !m.done && !m.pending && mine.lives > 0,
      submitLabel: mine.lives > 0 ? "Submit" : "No lives",
      feed: m.guesses.map(g => ({ by: nameOf(g.by), slot: slotOf(g.by), words: g.words, res: g.res })),
      done: m.done,
      resultLine: m.won ? `Solved together · ${pts} of 8` : `Out of lives · ${pts} of 8`,
      sessionLine: `This session: ${room.tally.maps} puzzle${room.tally.maps === 1 ? "" : "s"} · ${room.tally.points} points`,
      canShare: false, canNext: true, nextLabel: "Next puzzle",
    };
  }
  const draw = () => room && me() && view.render(vm());

  // ---------- incoming changes ----------
  function onRoom(val) {
    if (!val) { view.toast("That game has ended", 3000); leave(); return; }
    room = tidy(val);
    if (!me()) { view.toast("You're no longer in this game", 3000); leave(); return; }
    const m = room.map, p = PUZZLES[m.p];

    if (m.n !== seen.n) {                       // a new puzzle started
      if (seen.n) view.toast(`New puzzle · you have ${me().clues} clue${me().clues === 1 ? "" : "s"}`, 2200);
      seen = { n: m.n, guesses: m.guesses.length, found: m.found.length };
      mySel = new Set(me().sel);
      view.showClue(null);
    } else {
      m.guesses.slice(seen.guesses).forEach(g => {
        const who = g.by === uid ? "You" : nameOf(g.by);
        if (g.res !== "right") view.toast(`${who}: ${RESULT_LABEL[g.res].toLowerCase()}`, 2200);
      });
      m.found.slice(seen.found).forEach(f => {
        const gr = p.groups[f.g], who = f.by === uid ? "You" : nameOf(f.by);
        view.toast(f.named ? `${who} named ${gr.answer}` : `${gr.answer}, half marks`, 2400);
      });
      seen.guesses = m.guesses.length;
      seen.found = m.found.length;
      if (m.done && !m.won) view.toast("Out of lives", 2500);
    }
    const taken = new Set(m.found.flatMap(f => p.groups[f.g].words));
    for (const w of [...mySel]) if (taken.has(w) || m.done) mySel.delete(w);
    draw();
    if (menuOnFirstSnapshot) { menuOnFirstSnapshot = false; handlers.menu(); }
  }

  // ---------- actions ----------
  const pushSel = () => sync.update(`${roomPath(code)}/players/${uid}`, { sel: [...mySel] });

  const handlers = {
    toggle(w) {
      const m = room.map;
      if (m.done || (m.pending && m.pending.by === uid)) return;
      if (mySel.has(w)) mySel.delete(w);
      else if (mySel.size < 4) mySel.add(w);
      else return;
      draw();
      pushSel();
    },
    async clue(w) {
      if (room.map.done) return;
      if (room.map.revealed.some(r => r.w === w)) { view.showClue(w, clueFor(PUZZLES[room.map.p], w)); return; }
      if (me().clues <= 0) { view.toast("You have no clues left", 1800); return; }
      const n = room.map.n;
      const r = await change((cur, why) => {
        const pl = cur.players[uid];
        if (cur.map.n !== n || cur.map.done) return false;
        if (cur.map.revealed.some(x => x.w === w)) return cur;
        if (pl.clues <= 0) { why("You have no clues left"); return false; }
        pl.clues -= 1;
        cur.map.revealed.push({ w, by: uid });
        return cur;
      });
      if (r.note) view.toast(r.note, 1800);
      if (r.committed) view.showClue(w, clueFor(PUZZLES[room.map.p], w));
    },
    async submit() {
      if (mySel.size !== 4) return;
      const words = [...mySel], key = wordsKey(words), n = room.map.n;
      const r = await change((cur, why) => {
        const m = cur.map, pl = cur.players[uid], p = PUZZLES[m.p];
        if (m.n !== n || m.done) return false;
        if (m.pending) { why("Wait for the crate to be named"); return false; }
        if (pl.lives <= 0) { why("You're out of lives"); return false; }
        if (m.guesses.some(g => wordsKey(g.words) === key)) { why("Already tried"); return false; }
        const taken = new Set(m.found.flatMap(f => p.groups[f.g].words));
        if (words.some(w => taken.has(w))) { why("Part of that is already solved"); return false; }
        const c = classify(p, words);
        m.guesses.push({ by: uid, words, res: c.res, lv: c.lv });
        if (c.res === "right") {
          m.pending = { g: c.g, by: uid };
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
      const n = room.map.n;
      await change(cur => {
        const m = cur.map;
        if (m.n !== n || !m.pending || m.pending.by !== uid) return false;
        const gr = PUZZLES[m.p].groups[m.pending.g];
        const named = guess !== null && nameMatches(guess, gr);
        m.found.push({ g: m.pending.g, by: uid, named, guess: named ? null : (guess || null) });
        m.pending = null;
        if (m.found.length === 4) {
          m.done = true; m.won = true;
          cur.tally.maps += 1; cur.tally.points += mapScore(m);
        }
        return cur;
      });
      view.showClue(null);
    },
    clear() { mySel.clear(); draw(); pushSel(); },
    shuffle() { sync.update(`${roomPath(code)}/map`, { order: shuffled(room.map.order) }); },
    async next() {
      const n = room.map.n;
      await change(cur => {
        if (cur.map.n !== n || !cur.map.done) return false;
        let pos = cur.pos + 1;
        if (pos >= cur.queue.length) {
          cur.queue = shuffled(poolIndices(cur.pool)).filter(i => i !== cur.map.p);
          pos = 0;
        }
        cur.pos = pos;
        cur.map = newMap(cur.queue[pos], n + 1);
        for (const pl of Object.values(cur.players)) {
          pl.lives = LIVES;
          pl.clues = Math.min(MAX_CLUES, pl.clues + 1);
          pl.sel = [];
        }
        return cur;
      });
    },
    async pool(value) {
      setPoolParam(value);
      await change(cur => {
        cur.pool = value;
        cur.queue = shuffled(poolIndices(value)).filter(i => i !== cur.map.p);
        cur.pos = -1;                             // the next puzzle comes from the new pool
        return cur;
      });
      view.toast("Next puzzle comes from the new pool", 2200);
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
        row.append(send, copy);
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

  function watch() {
    view.bind(handlers);
    setRoomParam(code);
    unwatch = sync.watch(roomPath(code), onRoom, err => {
      console.error(err);
      view.toast(/permission/i.test(String(err)) ? "Together mode isn't switched on in Firebase yet" : "Lost the game connection", 5000);
    });
    sync.presence?.(`${roomPath(code)}/players/${uid}`);
  }

  function explain(e) {
    console.error(e);
    view.toast(/permission/i.test(String(e?.message || e)) ? "Together mode isn't switched on in Firebase yet" : "Couldn't reach the game server", 5000);
  }

  async function create(pool) {
    const name = await askName();
    if (!(await connect())) return false;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const c = newCode();
        const queue = shuffled(poolIndices(pool));
        const r = await sync.tx(roomPath(c), cur => cur === null ? {
          v: 1, created: Date.now(), pool, queue, pos: 0,
          players: { [uid]: { name, slot: 0, lives: LIVES, clues: START_CLUES, sel: [], online: true } },
          map: newMap(queue[0], 1), tally: { maps: 0, points: 0 },
        } : undefined);
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
    let full = false;
    try {
      const r = await sync.tx(roomPath(c), cur => {
        full = false;
        if (cur === null) return null;
        const room = tidy(cur);
        if (room.players[uid]) { room.players[uid].name = name; return room; }
        const slots = Object.values(room.players).map(pl => pl.slot);
        if (slots.length >= 2) { full = true; return undefined; }
        room.players[uid] = { name, slot: slots.includes(0) ? 1 : 0, lives: LIVES, clues: START_CLUES, sel: [], online: true };
        return room;
      });
      if (!r.committed || !r.value) {
        view.toast(full ? "That game already has two players" : "No game with that code", 3500);
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
  }

  function leave() {
    stop();
    setRoomParam(null);
    onLeave();
  }

  return { create, join, stop };
}
