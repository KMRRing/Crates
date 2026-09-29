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
  const notify = () => { const t = read(); watchers.forEach(w => w.cb(structuredClone(get(t, w.path) ?? null))); };
  bc.onmessage = notify;
  const commit = t => { localStorage.setItem(KEY, JSON.stringify(t)); bc.postMessage(1); setTimeout(notify, 0); };
  window.__cratesSync = {
    uid: "u" + Math.random().toString(36).slice(2, 8),
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
  };
})();
