// Injected into every page of a phone before its own scripts (phones.py: add_init_script, after `window.__phone = { uid }`).
// It is what sync.js gives a page, over /__db/* to the database in memory (server.mjs): uid, watch, tx, update, presence,
// connection, serverOffset, session, reconnect. A transaction is tried on what this phone has watched (null when it
// watches nothing there, as Firebase's cold cache does) and again on the server's value until the two agree, and a write
// is checked as the database would check it (memdb.js).
(() => {
  if (!/^https?:$/.test(location.protocol)) return;                      // the empty page a frame starts as
  if (window.__cratesSync || window.parent !== window && window.parent.__cratesSync) {
    if (window.parent !== window) window.__cratesSync = window.parent.__cratesSync;
    return;
  }
  const uid = window.__phone.uid, sid = Math.random().toString(36).slice(2, 12);
  const watches = new Map(), watched = new Map(), conn = new Set();      // watched: a path and how many watch it
  let n = 0, up = true, validate = null;
  const ready = import(location.origin + "/memdb.js").then(m => { validate = m.validate; });
  const es = new EventSource(`/__db/events?sid=${sid}&uid=${encodeURIComponent(uid)}`);
  es.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.w) watches.get(m.w)?.(m.v ?? null);
    else if (m.conn !== undefined) { up = m.conn; for (const cb of [...conn]) cb(up); }
  };
  const call = async (op, body) => {
    const r = await (await fetch(`/__db/${op}`, { method: "POST", body: JSON.stringify({ sid, ...body }) })).json();
    if (r.error) throw new Error(r.error);
    return r;
  };
  const clone = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const underWatch = p => [...watched].some(([w, k]) => k > 0 && (p === w || p.startsWith(w + "/")));
  window.__cratesSync = {
    uid,
    watch(path, cb) {
      const w = ++n;
      watches.set(w, cb);
      watched.set(path, (watched.get(path) || 0) + 1);
      call("watch", { w, path }).catch(e => console.error(e));
      return () => { watches.delete(w); watched.set(path, watched.get(path) - 1); call("unwatch", { w }).catch(() => {}); };
    },
    async tx(path, fn) {
      await ready;
      let seen = underWatch(path) ? (await call("get", { path })).v ?? null : null;     // a cold cache offers null first
      for (let tries = 0; tries < 25; tries++) {
        const next = fn(clone(seen));
        if (next !== undefined) validate(next ?? null, path);
        const r = await call("cas", { path, expect: seen, has: next !== undefined, next: next ?? null });
        if (r.retry) { seen = r.v ?? null; continue; }
        return { committed: !!r.committed, value: r.v ?? null };
      }
      throw new Error("transaction kept failing");
    },
    async update(path, obj) {
      await ready;
      for (const [k, v] of Object.entries(obj)) validate(v ?? null, `${path}/${k}`);
      await call("update", { path, obj });
    },
    presence(path) {
      let id = null, stopped = false;
      call("presence", { path }).then(r => { id = r.id; if (stopped) call("stop", { id }); });
      return () => { stopped = true; if (id) call("stop", { id }).catch(() => {}); };
    },
    session(path) {
      let id = null, stopped = false;
      call("session", { path }).then(r => { id = r.id; if (stopped) call("stop", { id, path, clear: true }); });
      return () => { stopped = true; if (id) call("stop", { id, path, clear: true }).catch(() => {}); };
    },
    connection(cb) { cb(up); conn.add(cb); return () => conn.delete(cb); },
    serverOffset(cb) { cb(0); return () => {}; },
    reconnect() {},
  };
})();
