// Test stand-in for sync.js: a shared JSON tree in localStorage, broadcast between tabs. It does to what's written what
// the Realtime Database does (tests/rtdb.js is the same for the node tests): refuses the whole write for undefined, NaN
// or Infinity, a function, or a key with . # $ / [ ] anywhere in it, as Firebase's SDK throws; keeps no nulls and no
// empty lists or objects; keeps a list as an object of its indices, and reads an object whose keys are all integers,
// more than half of them present, back as a list with holes. It once dropped undefined quietly and closed up lists,
// so two tabs played Tribute together happily while the real database refused its every first lead.
(() => {
  const KEY = "fakedb", bc = new BroadcastChannel("fakedb");
  const BAD_KEY = /[.#$/\[\]\x00-\x1f\x7f]/;
  const validate = (v, path) => {
    if (v === undefined) throw new Error(`transaction failed: Data returned contains undefined in property '${path}'`);
    if (typeof v === "function" || typeof v === "symbol" || typeof v === "bigint") throw new Error(`Data contains a ${typeof v} in property '${path}'`);
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error(`Data contains ${v} in property '${path}'`);
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (!k.length || BAD_KEY.test(k)) throw new Error(`Data has an invalid key "${k}" in property '${path}'`);
      validate(x, `${path}/${k}`);
    }
  };
  const store = v => {
    if (v === null) return undefined;
    if (typeof v !== "object") return v;
    const o = {};
    for (const [k, x] of Object.entries(v)) { const s = store(x); if (s !== undefined) o[k] = s; }
    return Object.keys(o).length ? o : undefined;
  };
  const back = s => {
    if (s === undefined || s === null) return null;
    if (typeof s !== "object") return s;
    const keys = Object.keys(s), ints = keys.every(k => /^(0|[1-9]\d*)$/.test(k));
    if (ints && keys.length && Math.max(...keys.map(Number)) < 2 * keys.length) { const a = []; for (const k of keys) a[Number(k)] = back(s[k]); return a; }
    const o = {};
    for (const k of keys) o[k] = back(s[k]);
    return o;
  };
  const read = () => JSON.parse(localStorage.getItem(KEY) || "{}");
  const get = (t, path) => back(path.split("/").reduce((o, k) => (o == null ? undefined : o[k]), t));
  const put = (t, path, val) => {
    validate(val ?? null, path);
    const ks = path.split("/"); let o = t;
    for (const k of ks.slice(0, -1)) o = (o[k] = o[k] && typeof o[k] === "object" ? o[k] : {});
    const s = store(val ?? null);
    if (s === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = s;
  };
  const watchers = new Set();
  window.__fakeWatchers = watchers;   // for tests that need to see what's being watched
  const notify = () => { const t = read(); watchers.forEach(w => w.cb(get(t, w.path))); };
  // Another tab's write can reach this tab's localStorage a moment after its message does, so look again shortly
  // after (real Firebase delivers the new value itself, so it has no such gap).
  bc.onmessage = () => { notify(); setTimeout(notify, 60); setTimeout(notify, 300); };
  const commit = t => { localStorage.setItem(KEY, JSON.stringify(t)); bc.postMessage(1); setTimeout(notify, 0); };
  const locked = fn => (navigator.locks ? navigator.locks.request(KEY, async () => fn()) : Promise.resolve().then(fn));
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
      setTimeout(() => cb(get(read(), path)), 0);
      return () => watchers.delete(w);
    },
    // a transaction is one read and write that no other tab's can come between (the database does that on its side;
    // without the lock two tabs arriving at once each dealt a table, and the second wrote over the first)
    async tx(path, fn) {
      await new Promise(r => setTimeout(r, 15));
      return locked(() => {
        const t = read();
        const cur = get(t, path);
        const nv = fn(cur === null ? null : structuredClone(cur));
        if (nv === undefined) return { committed: false, value: cur };
        put(t, path, nv); commit(t);
        return { committed: true, value: get(read(), path) };
      });
    },
    async update(path, obj) {
      return locked(() => {
        const t = read();
        for (const [k, v] of Object.entries(obj)) put(t, `${path}/${k}`, v);
        commit(t);
      });
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
