// For the tests: the Realtime Database in memory, with as many devices on it as a test needs, so a whole table (a
// host, three guests, a phone that drops off) can be played in Node. Each device is what sync.js gives a page: uid,
// watch, tx, update, presence, connection, serverOffset, session, reconnect. Writes are refused and stored as the
// database would (tests/rtdb.js: no undefined or NaN, no empty lists or objects, lists read back as lists with holes);
// a transaction is first tried on what the device has cached (null if it watches nothing there, as Firebase does with
// a cold cache) and tried again on the server's value until the two agree; watchers hear of every change, a moment
// later, as they would over the network.
import { validate, memoryDb } from "../memdb.js";

const clone = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function fakeDb() {
  // the database itself is memdb.js's, as an offline party's host keeps it; the devices round it are this file's
  const db = memoryDb(), get = db.get, set = db.set;
  const watchers = new Set(), devices = new Map(), tick = () => new Promise(r => setTimeout(r, 0));
  let pending = false;
  function notify() {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      for (const w of watchers) {
        if (!w.live()) continue;
        const v = get(w.path);
        if (w.seen !== undefined && same(v, w.seen)) continue;
        w.seen = clone(v);
        w.cb(clone(v));
      }
    }, 0);
  }

  function device(uid) {
    const me = { uid, online: true, onDrop: [], cache: new Map() };
    devices.set(uid, me);
    const live = () => me.online;
    const watching = path => [...watchers].some(w => w.uid === uid && (path === w.path || path.startsWith(w.path + "/")));
    return {
      uid,
      watch(path, cb, onError) {
        const w = { uid, path, cb, live, seen: undefined };
        watchers.add(w);
        setTimeout(() => { if (watchers.has(w) && live()) { w.seen = clone(get(path)); cb(clone(get(path))); } }, 0);
        return () => watchers.delete(w);
      },
      async tx(path, fn) {
        await tick();
        if (!me.online) throw new Error("offline");
        let seen = watching(path) ? clone(get(path)) : null;   // a cold cache offers null first
        for (let tries = 0; tries < 25; tries++) {
          const next = fn(clone(seen));
          const server = clone(get(path));
          if (!same(seen, server)) { seen = server; continue; } // the server had something else: try again on it
          if (next === undefined) return { committed: false, value: server };
          set(path, next);
          notify();
          return { committed: true, value: clone(get(path)) };
        }
        throw new Error("transaction kept failing");
      },
      async update(path, obj) {
        await tick();
        if (!me.online) throw new Error("offline");
        for (const [k, v] of Object.entries(obj)) validate(v ?? null, `${path}/${k}`);
        for (const [k, v] of Object.entries(obj)) set(`${path}/${k}`, v);
        notify();
      },
      presence(path) {
        if (me.online) { for (const [k, v] of Object.entries({ online: true })) set(`${path}/${k}`, v); notify(); }
        const off = () => { set(`${path}/online`, false); notify(); };
        me.onDrop.push(off);
        return () => { me.onDrop = me.onDrop.filter(f => f !== off); };
      },
      connection(cb) { cb(me.online); me.connCbs = [...(me.connCbs || []), cb]; return () => { me.connCbs = me.connCbs.filter(f => f !== cb); }; },
      serverOffset(cb) { cb(0); return () => {}; },
      session(path) { set(path, true); notify(); const off = () => { set(path, null); notify(); }; me.onDrop.push(off); return () => { me.onDrop = me.onDrop.filter(f => f !== off); off(); }; },
      reconnect() {},
    };
  }
  return {
    device,
    read: path => clone(get(path)),
    write(path, value) { set(path, value); notify(); },
    /** A device loses its connection: what it asked to happen on disconnect happens, and it hears nothing more. */
    drop(uid) { const d = devices.get(uid); if (!d || !d.online) return; d.online = false; d.onDrop.forEach(f => f()); (d.connCbs || []).forEach(cb => cb(false)); },
    /** Waits until every write so far has reached every watcher. */
    async settle(rounds = 4) { for (let i = 0; i < rounds; i++) await new Promise(r => setTimeout(r, 0)); },
  };
}
