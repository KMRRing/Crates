// Test stand-in for sync.js: a shared JSON tree in localStorage, broadcast between tabs.
// Mimics Realtime Database by dropping empty arrays and nulls on write.
(() => {
  const KEY = "fakedb", bc = new BroadcastChannel("fakedb");
  const read = () => JSON.parse(localStorage.getItem(KEY) || "{}");
  const get = (t, path) => path.split("/").reduce((o, k) => (o == null ? undefined : o[k]), t);
  const clean = v => {
    if (Array.isArray(v)) { const a = v.map(clean).filter(x => x !== undefined); return a.length ? a : undefined; }
    if (v && typeof v === "object") {
      const o = {};
      for (const [k, x] of Object.entries(v)) { const c = clean(x); if (c !== undefined) o[k] = c; }
      return Object.keys(o).length ? o : undefined;
    }
    return v === null ? undefined : v;
  };
  const put = (t, path, val) => {
    const ks = path.split("/"); let o = t;
    for (const k of ks.slice(0, -1)) o = (o[k] = o[k] && typeof o[k] === "object" ? o[k] : {});
    const c = clean(JSON.parse(JSON.stringify(val ?? null)));
    if (c === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = c;
  };
  const watchers = new Set();
  window.__fakeWatchers = watchers;   // for tests that need to see what's being watched
  const notify = () => { const t = read(); watchers.forEach(w => w.cb(structuredClone(get(t, w.path) ?? null))); };
  // Another tab's write can reach this tab's localStorage a moment after its message does, so look again shortly
  // after (real Firebase delivers the new value itself, so it has no such gap).
  bc.onmessage = () => { notify(); setTimeout(notify, 60); setTimeout(notify, 300); };
  const commit = t => { localStorage.setItem(KEY, JSON.stringify(t)); bc.postMessage(1); setTimeout(notify, 0); };
  window.__cratesSync = {
    // one id per tab, kept across page loads in it (like Firebase's anonymous sign-in on one device), so
    // switching games in a tab is the same player while each test page is its own device
    get uid() {
      let id = sessionStorage.getItem("fakeuid");
      if (!id) { id = "u" + Math.random().toString(36).slice(2, 8); sessionStorage.setItem("fakeuid", id); }
      return id;
    },
    watch(path, cb) {
      const w = { path, cb }; watchers.add(w);
      setTimeout(() => cb(structuredClone(get(read(), path) ?? null)), 0);
      return () => watchers.delete(w);
    },
    async tx(path, fn) {
      await new Promise(r => setTimeout(r, 15));
      const t = read();
      const cur = get(t, path) ?? null;
      const nv = fn(cur === null ? null : structuredClone(cur));
      if (nv === undefined) return { committed: false, value: cur };
      put(t, path, nv); commit(t);
      return { committed: true, value: get(read(), path) ?? null };
    },
    async update(path, obj) {
      const t = read();
      for (const [k, v] of Object.entries(obj)) put(t, `${path}/${k}`, v);
      commit(t);
    },
    presence() {},
    serverOffset(cb) { cb(0); return () => {}; },   // the tabs share one clock
    session(path) {
      const at = path.lastIndexOf("/"), parent = path.slice(0, at), key = path.slice(at + 1);
      this.update(parent, { [key]: true });
      return () => this.update(parent, { [key]: null });
    },
  };
})();
