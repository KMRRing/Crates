// An offline party's database (October 2026): no internet, so no Firebase. The host's phone keeps the party's database
// in memory (memdb.js, with the Realtime Database's own rules), and every other phone reaches it over a data channel on
// the local Wi-Fi (lan-link.js pairs them). A page plays exactly as online: it asks net.js for the database and gets
// the same calls sync.js gives it (uid, watch, tx, update, presence, session, connection, serverOffset, reconnect),
// answered here instead of by Firebase, the same way:
//   - a transaction is tried on what the page has, then on what the host has until the two agree (compare and set): two
//     taps at once settle as they do online, the second tried again on the first's result;
//   - presence and sessions are undone when a page goes (its frame moves on) or its phone does (the channel closes, or
//     the phone has said nothing for a while: asleep), as Firebase's onDisconnect does;
//   - the host's clock is the shared one (serverOffset), measured by pings.
// Only the party's room travels (crates/rooms/CODE/…: the party and every game it plays): a page's own syncing (solo
// saves, where you are for your partner, flagged questions) needs the internet, and here sees an empty database that
// keeps nothing, rather than send a phone's whole history to the host. Pure: tests/lan.mjs plays tables through it.
import { memoryDb, validate, store, back, same, parts, copy } from "./memdb.js";

const CHUNK = 15000;          // characters a message: some browsers' channels take no more than 64 KB at once
const PING_MS = 3000;         // a guest says it's there this often (and measures the host's clock by it)
const LATE_MS = 8000;         // a guest that hears nothing from the host this long shows itself offline
const AWAY_MS = 9000;         // the host takes a guest that has said nothing this long as away (asleep, or gone)

const norm = path => parts(path).join("/");
/** What a game's page may reach: a room, and everything in it. */
const inRooms = path => /^crates\/rooms\/[^/]+/.test(path);
/** What the page round the frames may reach as well: its own notes (lan/…: which party the host has open). */
const forShell = path => inRooms(path) || /^lan(\/|$)/.test(path);
const later = fn => setTimeout(fn, 0);

// ---------- messages over a channel: JSON, a long one in pieces ----------
/** Wraps a data channel: send(message) (false if it's closed), onMessage(message), onClose(). */
export function wire(channel, { onMessage, onClose = () => {} }) {
  const pieces = new Map();
  let closed = false;
  channel.addEventListener("message", e => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.t !== "part") { onMessage(m); return; }
    const got = pieces.get(m.k) || [];
    got[m.i] = m.d;
    pieces.set(m.k, got);
    if (got.filter(x => x !== undefined).length < m.n) return;
    pieces.delete(m.k);
    try { onMessage(JSON.parse(got.join(""))); } catch (err) { console.error(err); }
  });
  const close = () => { if (!closed) { closed = true; onClose(); } };
  channel.addEventListener("close", close);
  channel.addEventListener("error", () => { if (channel.readyState !== "open") close(); });
  let k = 0;
  return {
    send(m) {
      if (closed || channel.readyState !== "open") return false;
      const s = JSON.stringify(m);
      try {
        if (s.length <= CHUNK) channel.send(s);
        else {
          const n = Math.ceil(s.length / CHUNK), key = ++k;
          for (let i = 0; i < n; i++) channel.send(JSON.stringify({ t: "part", k: key, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }));
        }
        return true;
      } catch (e) { console.error(e); return false; }
    },
    close() { try { channel.close(); } catch { /* already */ } close(); },
    get open() { return !closed && channel.readyState === "open"; },
  };
}

// ---------- the host: the database, and every phone's pages on it ----------
/**
 * The party's database on the host's phone. attach(channel) serves a guest's phone over its channel; local() is the
 * host's own phone, served in place. onPeers(list) hears who's connected ({ id, uid, name, away }); onChange() hears
 * every write (to keep the database through a reload: snapshot(), and createHost({ snapshot }) to put it back).
 */
export function createHost({ snapshot = null, onPeers = () => {}, onChange = () => {}, awayMs = AWAY_MS, now: clock = Date.now } = {}) {
  const db = memoryDb();
  if (snapshot) db.restore(snapshot);
  const conns = new Map();           // "peer/page" → { peer, watches: Map(id → stop), ops: Map(id → undo) }
  const peers = new Map();           // peer → { uid, name, last, away, send, link }
  let serial = 0;

  const list = () => [...peers].filter(([id]) => id !== "host").map(([id, p]) => ({ id, uid: p.uid, name: p.name, away: p.away }));
  const told = () => { try { onPeers(list()); } catch (e) { console.error(e); } };
  function connOf(peer, c) {
    const key = `${peer}/${c}`;
    let x = conns.get(key);
    if (!x) conns.set(key, x = { peer, watches: new Map(), ops: new Map() });
    return x;
  }
  /** Undoes what a page asked to be undone when it goes (its presence, its sessions), and forgets its watches. */
  function closeConn(key) {
    const x = conns.get(key);
    if (!x) return;
    conns.delete(key);
    x.watches.forEach(stop => stop());
    undo(x);
  }
  function undo(x) {
    for (const op of x.ops.values()) try { op(); } catch (e) { console.error(e); }
    x.ops.clear();
  }
  function closePeer(peer) {
    for (const [key, x] of [...conns]) if (x.peer === peer) closeConn(key);
    peers.delete(peer);
    told();
    onChange();
  }

  function handle(peer, send, m) {
    const ack = (extra = {}) => send({ t: "ack", c: m.c, rid: m.rid, ok: true, ...extra });
    const x = () => connOf(peer, m.c);
    try {
      switch (m.t) {
        case "watch": {
          const c = x();
          c.watches.get(m.id)?.();
          c.watches.set(m.id, db.watch(m.path, v => send({ t: "val", c: m.c, id: m.id, v: store(v) ?? null })));
          return;
        }
        case "unwatch": { const c = conns.get(`${peer}/${m.c}`); c?.watches.get(m.id)?.(); c?.watches.delete(m.id); return; }
        case "update":
          db.update(m.path, Object.fromEntries(Object.entries(m.obj || {}).map(([k, v]) => [k, back(v)])));
          ack(); onChange(); return;
        case "tx": {
          const now = store(db.get(m.path)) ?? null;
          if (!same(now, m.base ?? null)) { ack({ retry: true, v: now }); return; }   // the host has moved on: try again on it
          if (!("value" in m)) { ack({ v: now }); return; }                             // given up on what's there
          db.set(m.path, back(m.value));
          ack({ committed: true, v: store(db.get(m.path)) ?? null });
          onChange();
          return;
        }
        case "presence":
          db.update(m.path, { online: true });
          x().ops.set(m.id, () => db.update(m.path, { online: false }));
          onChange(); return;
        case "session":
          db.set(m.path, true);
          x().ops.set(m.id, () => db.set(m.path, null));
          onChange(); return;
        case "unop": conns.get(`${peer}/${m.c}`)?.ops.delete(m.id); return;
        case "unsession": conns.get(`${peer}/${m.c}`)?.ops.delete(m.id); db.set(m.path, null); onChange(); return;
        case "close": closeConn(`${peer}/${m.c}`); onChange(); return;
        case "ping": send({ t: "pong", t0: m.t0, now: clock() }); return;
        default:
      }
    } catch (e) {
      if (m.rid) send({ t: "ack", c: m.c, rid: m.rid, ok: false, err: String(e?.message || e) });
      else console.error(e);
    }
  }

  // a guest that has said nothing for a while is away: what its pages asked undone on their going is undone (they show
  // away to the others, and nobody waits for them); when it speaks again it's asked to say it all again (replay)
  const watchdog = setInterval(() => {
    const now = Date.now();
    for (const [peer, p] of peers) {
      if (peer === "host" || p.away || now - p.last < awayMs) continue;
      p.away = true;
      for (const c of conns.values()) if (c.peer === peer) undo(c);
      told();
      onChange();
    }
  }, Math.min(1000, awayMs / 3));

  return {
    db,
    /** Serves a guest's phone over an open channel; returns its id. */
    attach(channel) {
      const peer = `p${++serial}`;
      const link = wire(channel, {
        onMessage(m) {
          const p = peers.get(peer);
          if (!p) return;
          p.last = Date.now();
          if (p.away) { p.away = false; told(); link.send({ t: "replay" }); }
          if (m.t === "hello") {
            // a phone back after losing its link (a new channel): what its old pages left is undone first, so their
            // going doesn't undo what the same pages are about to say again
            for (const [id, q] of [...peers]) if (id !== peer && q.uid === m.uid) { q.link?.close(); closePeer(id); }
            Object.assign(p, { uid: String(m.uid || ""), name: String(m.name || "").slice(0, 24) });
            told();
            return;
          }
          handle(peer, link.send, m);
        },
        onClose: () => { if (peers.has(peer)) closePeer(peer); },
      });
      peers.set(peer, { uid: "", name: "", last: Date.now(), away: false, send: link.send, link });
      told();
      return peer;
    },
    /** The host's own phone: a transport for createClient, served in place (in order, a moment later, as a channel). */
    local() {
      let deliver = () => {};
      peers.set("host", { uid: "", name: "", last: Infinity, away: false });
      return {
        onMessage(fn) { deliver = fn; },
        send(m) { later(() => handle("host", r => later(() => deliver(r)), m)); return true; },
      };
    },
    /** Who's connected: [{ id, uid, name, away }]. */
    get peers() { return list(); },
    /** Ends a guest's link (asked to leave), or every link and the watchdog (the party's over). */
    drop(peer) { peers.get(peer)?.link?.close(); },
    close() { clearInterval(watchdog); for (const [id, p] of [...peers]) { p.link?.close(); closePeer(id); } },
    snapshot: () => db.snapshot(),
  };
}

// ---------- a phone's pages ----------
/**
 * A phone's way to the database: page() gives each page (each frame) the calls sync.js gives it; the pages share one
 * link, attached with attach(channel) on a guest (again after it's lost) or attachLocal(host) on the host. A page's
 * watches, presence and sessions are said again on a new link, and its unanswered requests sent again, so a game
 * carries on through a lost connection as it does online.
 */
export function createClient({ uid, name = "", pingMs = PING_MS, lateMs = LATE_MS }) {
  const pages = new Map();           // page → { subs: Map(id → { path, cb, value }), regs: Map(id → { t, path }), pending: Map(rid → …) }
  const connCbs = new Set(), offsetCbs = new Set();
  let link = null, connected = false, offset = 0, bestRtt = Infinity, heard = 0, nPage = 0, nId = 0, pinger = 0;

  function setConnected(on) {
    if (on === connected) return;
    connected = on;
    for (const cb of connCbs) try { cb(on); } catch (e) { console.error(e); }
  }
  const send = m => (link ? link.send(m) : false);

  function dispatch(m) {
    heard = Date.now();
    if (link?.remote) setConnected(true);
    if (m.t === "val") {
      const P = pages.get(m.c), sub = P?.subs.get(m.id);
      if (!sub) return;
      sub.value = back(m.v);
      for (const k of P.known.keys()) if (k === sub.path || k.startsWith(`${sub.path}/`)) P.known.delete(k);
      sub.cb(copy(sub.value));
    } else if (m.t === "ack") {
      const P = pages.get(m.c), wait = P?.pending.get(m.rid);
      if (!wait) return;
      P.pending.delete(m.rid);
      if (m.ok) wait.resolve(m); else wait.reject(new Error(m.err || "refused"));
    } else if (m.t === "pong") {
      const rtt = Date.now() - m.t0;
      if (rtt > bestRtt * 1.5 + 20) return;                       // a slow one says little about the clocks
      bestRtt = Math.min(bestRtt, rtt);
      const was = offset;
      offset = Math.round(m.now + rtt / 2 - Date.now());
      if (Math.abs(offset - was) > 2) for (const cb of offsetCbs) try { cb(offset); } catch (e) { console.error(e); }
    } else if (m.t === "replay") replay();            // back from away on the same link: its answers are still coming
  }

  /**
   * Says every page's watches, presence and sessions again; on a new link (resend), also what the old one left
   * unanswered (sent again, it's turned down if the first got through: a transaction finds the host moved on).
   */
  function replay({ resend = false } = {}) {
    for (const [c, P] of pages) {
      for (const [id, s] of P.subs) send({ t: "watch", c, id, path: s.path });
      for (const [id, r] of P.regs) send({ t: r.t, c, id, path: r.path });
      if (resend) for (const w of P.pending.values()) send(w.msg);
    }
  }

  /**
   * A page's calls. room(): the party's room code, once known (the host's Party makes it): a page's own syncing in
   * your partner's room (where you are, what you're playing, for them to watch) stays off the Wi-Fi too.
   */
  function page({ shell = false, room = () => null } = {}) {
    // known: what the host last said a path held, answering this page's transaction there: the next one starts from it
    // until a watch hears something newer (the host sends a transaction's answer before the change it made)
    const c = `g${++nPage}`, P = { subs: new Map(), regs: new Map(), pending: new Map(), known: new Map() }, known = P.known;
    let queue = Promise.resolve();
    pages.set(c, P);
    const ours = path => { const code = room(), m = /^crates\/rooms\/([^/]+)/.exec(path); return !code || !m || m[1] === code; };
    const allowed = path => (shell ? forShell(path) : inRooms(path)) && ours(path);
    const request = m => new Promise((resolve, reject) => {
      const rid = ++nId, msg = { ...m, c, rid };
      P.pending.set(rid, { msg, resolve, reject });
      send(msg);                         // not connected: sent on the next link (replay)
    });
    /** What this page has of a path: from a watch on it or above it (a transaction's first try), else null. */
    function cached(path) {
      for (const s of P.subs.values()) {
        if (path !== s.path && !path.startsWith(`${s.path}/`)) continue;
        if (s.value === undefined) continue;
        let v = s.value;
        for (const k of parts(path.slice(s.path.length))) { v = v && typeof v === "object" ? v[k] : null; if (v == null) break; }
        return copy(v ?? null);
      }
      return null;
    }
    return {
      uid,
      watch(path, cb, onError) {
        path = norm(path);
        if (!allowed(path)) { later(() => cb(null)); return () => {}; }
        const id = ++nId;
        P.subs.set(id, { path, cb, value: undefined, onError });
        send({ t: "watch", c, id, path });
        return () => { if (P.subs.delete(id)) send({ t: "unwatch", c, id }); };
      },
      tx(path, fn) {
        path = norm(path);
        if (!allowed(path)) return Promise.resolve({ committed: false, value: null });
        // a page's transactions go one after another, as Firebase queues them: its own can't collide with each other
        const run = async () => {
          let seen = known.has(path) ? known.get(path) : cached(path);
          for (let tries = 0; tries < 25; tries++) {
            const next = fn(copy(seen));
            if (next !== undefined) validate(next ?? null, path);     // refused here, as Firebase refuses it
            const r = await request({ t: "tx", path, base: store(seen) ?? null, ...(next === undefined ? {} : { value: store(next) ?? null }) });
            const there = back(r.v);
            known.set(path, there);
            if (r.committed) return { committed: true, value: there };
            if (r.retry) { seen = there; continue; }
            return { committed: false, value: there };
          }
          throw new Error("transaction kept failing");
        };
        const done = queue.then(run, run);
        queue = done.catch(() => {});
        return done;
      },
      async update(path, obj) {
        path = norm(path);
        for (const [k, v] of Object.entries(obj)) validate(v ?? null, `${path}/${k}`);
        if (!allowed(path)) return;
        await request({ t: "update", path, obj: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, store(v) ?? null])) });
      },
      presence(path) {
        path = norm(path);
        if (!allowed(path)) return () => {};
        const id = ++nId;
        P.regs.set(id, { t: "presence", path });
        send({ t: "presence", c, id, path });
        return () => { if (P.regs.delete(id)) send({ t: "unop", c, id }); };
      },
      session(path) {
        path = norm(path);
        if (!allowed(path)) return () => {};
        const id = ++nId;
        P.regs.set(id, { t: "session", path });
        send({ t: "session", c, id, path });
        return () => { if (P.regs.delete(id)) send({ t: "unsession", c, id, path }); };
      },
      connection(cb) { cb(connected); connCbs.add(cb); return () => connCbs.delete(cb); },
      serverOffset(cb) { cb(offset); offsetCbs.add(cb); return () => offsetCbs.delete(cb); },
      reconnect() {},                  // a lost link comes back only by scanning again (lan-ui.js)
      /** The page has gone (its frame moved on): what it asked to be undone then is undone. */
      close() {
        if (!pages.delete(c)) return;
        send({ t: "close", c });
      },
    };
  }

  function ping() { if (link?.remote) send({ t: "ping", t0: Date.now() }); }

  return {
    uid,
    page,
    /** Links to the host over an open channel (a guest; again after a lost link). onClose() hears it go. */
    attach(channel, { onClose = () => {} } = {}) {
      link?.close?.();
      const me = wire(channel, {
        onMessage: dispatch,
        onClose: () => { if (link === me) { link = null; setConnected(false); onClose(); } },
      });
      me.remote = true;
      link = me;
      bestRtt = Infinity;
      heard = Date.now();
      send({ t: "hello", uid, name });
      replay({ resend: true });
      setConnected(true);
      clearInterval(pinger);
      [0, 250, 700].forEach(ms => setTimeout(ping, ms));
      pinger = setInterval(() => {
        ping();
        if (link && Date.now() - heard > lateMs) setConnected(false);    // the host is asleep, or out of reach
      }, pingMs);
    },
    /** The host's own phone: served in place by createHost().local(). */
    attachLocal(host) {
      const t = host.local();
      t.onMessage(dispatch);
      link = { send: t.send, remote: false, close() {} };
      setConnected(true);
    },
    /** Ends the link (leaving the party). */
    detach() { clearInterval(pinger); const l = link; link = null; l?.close?.(); setConnected(false); },
    get connected() { return connected; },
    get offset() { return offset; },
  };
}
