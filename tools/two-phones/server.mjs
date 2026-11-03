// Two (or more) phones in one machine, for looking at what two people do together (docs/coop.md, "Looking at it"): this
// serves the repository to browsers and gives every page the Realtime Database in memory (tests/fake-db.js) through
// /__db/*, so two browser contexts on one pair code see each other as two phones do. The container cannot reach Firebase;
// this is what stands in for it. A page gets its database from shim.js (window.__cratesSync, which net.js looks for first).
//
//   node tools/two-phones/server.mjs [port]            then drive it with phones.py (Playwright for Python)
//
// Control, for the driver: GET /__db/ctl?op=read&path=…, op=write&path=…&value=JSON, op=offline&uid=…, op=online&uid=….
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fakeDb } from "../../tests/fake-db.js";

const root = path.resolve(new URL("../../", import.meta.url).pathname);
const port = Number(process.argv[2] || 8777);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".txt": "text/plain", ".wasm": "application/wasm", ".mp3": "audio/mpeg", ".jpg": "image/jpeg" };
const db = fakeDb();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// a session is one open document: its device on the database, its open watches, what is to happen when it closes
const sessions = new Map();
const push = (s, msg) => { if (s.live) s.res.write(`data: ${JSON.stringify(msg)}\n\n`); };
const others = s => [...sessions.values()].some(o => o !== s && o.uid === s.uid && o.live);
function watchFor(s, w, p) { s.watches.get(w)?.stop?.(); s.watches.set(w, { path: p, stop: s.dev.watch(p, v => push(s, { w, v })) }); }

async function api(op, q, body) {
  const s = sessions.get(body?.sid);
  if (op === "ctl") {
    if (q.op === "read") return { v: db.read(q.path) };
    if (q.op === "write") { db.write(q.path, JSON.parse(q.value)); return {}; }
    if (q.op === "sessions") return { v: [...sessions.values()].map(x => ({ uid: x.uid, offline: x.offline })) };
    const mine = [...sessions.values()].filter(x => x.uid === q.uid && x.live);
    if (q.op === "offline") {                                      // the phone loses its connection: what it asked to happen then happens
      db.drop(q.uid);
      for (const x of mine) { x.offline = true; for (const f of x.effects.values()) f(true); push(x, { conn: false }); }
      return {};
    }
    if (q.op === "online") {                                       // and comes back: a new device on the database, its watches opened again
      for (const x of mine) {
        x.dev = db.device(x.uid); x.offline = false;
        for (const [w, { path: p }] of x.watches) watchFor(x, w, p);
        for (const f of x.effects.values()) f(false);
        push(x, { conn: true });
      }
      return {};
    }
    return {};
  }
  if (!s) throw new Error("no such session");
  if (op === "watch") { watchFor(s, body.w, body.path); return {}; }
  if (op === "unwatch") { s.watches.get(body.w)?.stop?.(); s.watches.delete(body.w); return {}; }
  if (op === "get") return { v: db.read(body.path) };
  if (s.offline) throw new Error("offline");
  if (op === "cas") {
    const server = db.read(body.path);
    if (!same(server, body.expect)) return { retry: true, v: server };
    if (!body.has) return { committed: false, v: server };
    db.write(body.path, body.next ?? null);
    return { committed: true, v: db.read(body.path) };
  }
  if (op === "update") { await s.dev.update(body.path, body.obj); return {}; }
  if (op === "presence" || op === "session") {
    const id = ++s.ids, p = body.path, on = op === "presence" ? v => db.write(`${p}/online`, v) : v => db.write(p, v ? true : null);
    on(true);
    // gone with the document, or the connection: a sibling document of the same phone keeps it online
    s.effects.set(id, down => { if (down) { if (op === "session" || !others(s)) on(false); } else on(true); });
    return { id };
  }
  if (op === "stop") {
    const f = s.effects.get(body.id);
    s.effects.delete(body.id);
    if (body.clear) db.write(body.path, null);
    return {};
  }
  throw new Error(`no such call: ${op}`);
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  if (p === "/__db/events") {
    const sid = url.searchParams.get("sid"), uid = url.searchParams.get("uid");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(": hello\n\n");
    const s = { sid, uid, dev: db.device(uid), res, live: true, offline: false, watches: new Map(), effects: new Map(), ids: 0 };
    sessions.set(sid, s);
    req.on("close", () => {
      s.live = false;
      for (const f of s.effects.values()) f(true);
      for (const { stop } of s.watches.values()) stop?.();
      sessions.delete(sid);
    });
    return;
  }
  if (p.startsWith("/__db/")) {
    let data = "";
    req.on("data", c => (data += c));
    req.on("end", async () => {
      try {
        const out = await api(p.slice(6), Object.fromEntries(url.searchParams), data ? JSON.parse(data) : null);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e.message || e) }));
      }
    });
    return;
  }
  let f = p;
  if (f.endsWith("/")) f += "index.html";
  const file = path.join(root, f);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`two phones on http://localhost:${port}/`));
