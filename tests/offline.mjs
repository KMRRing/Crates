// Every page opens offline, from the home screen too. The service worker (sw.js, written by tools/build-sw.mjs) keeps
// every file a page loads (tools/offline.mjs finds them); Origin, Arb, Lexicon and Order once imported the knowledge
// base straight from kb/, which the list left out, so on a phone with no connection they never opened. Checked here:
// nothing a page loads is missing or left out; a load whose path is built as the code runs is one accounted for
// below; and the service worker itself, run against a stand-in for the browser's caches and the network: what an
// update downloads (only what changed), what it copies, and what it answers offline.
import fs from "fs";
import vm from "vm";
import { ROOT, reach, offlineFiles, refsOf } from "../tools/offline.mjs";
import { serviceWorker, hashOf } from "../tools/build-sw.mjs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ---------- reading code for what it loads ----------
{
  const r = refsOf("x.js", `import { a } from "./a.js"; import "./b.js"; export * from "./c.js";
    const s = "// not a comment", re = /["'\`]/g; /* import "./no1.js" */ // import "./no2.js"
    const t = \`\${x ? \`(\${y})\` : ""} done\`; fetch("./e.json"); import("./d.js");
    fetch(\`./puzzles/band-\${b}.txt\`); new Worker(new URL("./w.js", import.meta.url), { type: "module" });
    s.src = "./vendor/v.js"; img.src = url; if (q.src === t.id) {} const banks = { m: "./maths-bank.js" };`);
  check(same(r.own, ["./a.js", "./b.js", "./c.js", "./d.js", "./w.js"]), "imports, re-exports, import() and module workers are found; commented-out ones aren't");
  check(same(r.page, ["./e.json", "./vendor/v.js", "./maths-bank.js", "./a.js", "./b.js", "./c.js", "./d.js", "./w.js"]),
    "a fetch, a script added by hand and a bank named in a list are found (a regular expression or a template doesn't derail the reading)");
  check(r.built.length === 2 && r.built[0].startsWith("fetch(`./puzzles/") && r.built[1].startsWith("img.src = url"),
    "a path built as the code runs is flagged (a comparison isn't an assignment)");
  const css = refsOf("x.css", `a { background: url("pic.png"); mask: url("data:image/svg+xml,<svg><use href='url(%23a)'/></svg>"); } @import "more.css";`);
  check(same(css.own, ["pic.png", "more.css"]), "a stylesheet's url()s and @imports are found, data: addresses left alone");
  const html = refsOf("x.html", `<link rel="manifest" href="m.webmanifest"><script src="theme.js"></script><!-- <script src="old.js"></script> -->
    <script>location.replace("slate.html" + location.search);</script>`);
  check(same(html.own, ["m.webmanifest", "theme.js"]) && same(html.page, ["slate.html"]), "a page's tags and inline scripts are read, its comments aren't");
}

// ---------- the app as it is ----------
const { reached, missing, built } = reach();
const files = offlineFiles(), listed = new Set(files);
check(!missing.length, missing.length ? `every file a page loads is there: missing ${missing.map(m => `${m.file} (named in ${m.from})`).join(", ")}` : `every file the ${reached.size} files the pages reach name is there`);
const left = [...reached.keys()].filter(f => !listed.has(f));
check(!left.length, left.length ? `everything a page reaches is kept offline: not ${left.join(", ")}` : `everything the pages reach is kept offline (${files.length} files)`);
const kb = ["kb/entities.js", "kb/links.js", "kb/items/sequences.js"].filter(f => !listed.has(f));
check(!kb.length && ["origin.js", "arb.js", "lexicon.js", "order.js"].every(f => reached.has(f)),
  "Origin, Arb, Lexicon and Order open offline: the knowledge base they import (kb/entities.js, kb/links.js, kb/items/sequences.js) is kept");
const banks = fs.readdirSync(ROOT).filter(f => f.endsWith("-bank.js") || f === "bank.js"), puzzles = fs.readdirSync(ROOT + "puzzles").map(f => `puzzles/${f}`);
check([...banks, ...puzzles].every(f => listed.has(f)), `every knowledge bank (${banks.length}) and every puzzle band (${puzzles.length}) is kept, whichever a game asks for`);
check(!files.some(f => /^(tests|tools)\//.test(f) || f === "sw.js") && !files.some(f => f.startsWith("kb/") && !reached.has(f)),
  "the tests, the tools, sw.js and the knowledge base's other files aren't sent to phones");

// Loads whose paths are built as the code runs, which reading can't follow: each with how what it loads is there
// offline. A new one fails here until what it loads is kept (tools/offline.mjs) and it's added to this list.
const RUNTIME = [
  ["deck.js", /^import\(LEVELS\[/, "a knowledge bank by level: every *-bank.js is kept"],
  ["punt.js", /^import\(LEVELS\[/, "the same banks"],
  ["rush.js", /^fetch\(`\.\/puzzles\/band-/, "a puzzle band: every file in puzzles/ is kept"],
  ["suite.js", /^f\.src = u\.toString\(\)/, "the watching frame: a page of the app, every one kept (watching needs a connection anyway)"],
  ["pwa.js", /^fetch\(u, \{ cache: "reload" \}/, "Update: refreshes every kept file from the network, online only"],
  ["pwa.js", /^fetch\(`\.\/sw\.js\?check=/, "Update's check that the site answers: the network, on purpose"],
  ["pics.js", /^fetch\(file \?/, "Wikipedia's answer naming a picture: remembered by pics.js once seen"],
  ["pics.js", /^img\.src = urls\./, "a Wikipedia picture: kept by sw.js once shown"],
  ["sync.js", /^fetch\(url \+/, "Firebase: playing together, watching and syncing need a connection"],
];
const unknown = built.filter(b => !RUNTIME.some(([file, re]) => b.file === file && re.test(b.load)));
check(!unknown.length, unknown.length ? `every load built at run time is accounted for: not ${unknown.map(b => `${b.file}: ${b.load.slice(0, 60)}`).join("; ")}` : `every load built at run time is accounted for (${built.length})`);

// ---------- the service worker, run ----------
const BASE = "https://kmrring.github.io/Crates/";
/** A stand-in for the browser: its caches, the network (a map of the site's files), the worker's events. */
function browser(site) {
  const store = new Map();                                             // cache name -> Map(url -> { bytes, type })
  const net = { site, log: [], down: false };
  const abs = x => new URL(typeof x === "string" ? x : x.url, BASE).href;
  const answer = e => new Response(e.bytes.slice(), { headers: { "Content-Type": e.type } });
  class Cache {
    constructor(m) { this.m = m; }
    async match(req, o = {}) {
      const u = abs(req), key = o.ignoreSearch ? u.split("?")[0] : u;
      for (const [k, e] of this.m) if ((o.ignoreSearch ? k.split("?")[0] : k) === key) return answer(e);
      return undefined;
    }
    async put(req, res) { this.m.set(abs(req), { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("Content-Type") }); }
    async keys() { return [...this.m.keys()].map(url => ({ url })); }
  }
  const caches = {
    async open(n) { if (!store.has(n)) store.set(n, new Map()); return new Cache(store.get(n)); },
    async keys() { return [...store.keys()]; },
    async delete(n) { return store.delete(n); },
    async match(req, o) { for (const m of store.values()) { const hit = await new Cache(m).match(req, o); if (hit) return hit; } return undefined; },
  };
  async function fetch(req) {
    const url = new URL(abs(req));
    net.log.push(url.pathname.replace("/Crates/", "") + url.search);
    if (net.down) throw new TypeError("Failed to fetch");
    const file = url.pathname.replace("/Crates/", "") || "index.html";
    return net.site[file] == null ? new Response("not here", { status: 404 }) : new Response(net.site[file], { headers: { "Content-Type": "text/plain" } });
  }
  const handlers = {};
  const self = { location: new URL("sw.js", BASE), addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim: async () => {} } };
  class Req extends Request { constructor(input, init) { super(typeof input === "string" ? new URL(input, BASE).href : input, init); } }
  return { store, net, caches, fetch, self, handlers, Request: Req };
}
/** Runs a version of the worker, built from `site` (file -> text), in `b`; returns its event handlers. */
function worker(b, site, version) {
  const files = { "./": hashOf(site["index.html"]) };
  for (const [f, text] of Object.entries(site)) files[f] = hashOf(text);
  const logic = fs.readFileSync(new URL("../tools/service-worker.js", import.meta.url), "utf8");
  const context = vm.createContext({ self: b.self, caches: b.caches, fetch: b.fetch, Request: b.Request, Response, Headers, URL, crypto: globalThis.crypto, console });
  vm.runInContext(`const VERSION = "${version}"; const FILES = ${JSON.stringify(files)};\n${logic}`, context);
  return { ...b.handlers };
}
const run = async (h, type, extra = {}) => { let p = null; h[type]({ ...extra, waitUntil: x => { p = x; }, respondWith: x => { p = x; } }); return p; };
const text = async res => (res ? new TextDecoder().decode(await res.arrayBuffer()) : null);
{
  const v1 = { "index.html": "<title>Almanac</title>", "app.js": "export const a = 1;", "kb/links.js": "export const LINKS = [];", "puzzles/band-0600.txt": "p1" };
  const b = browser({ ...v1 });
  let h = worker(b, v1, "one");
  await run(h, "install"); await run(h, "activate");
  check(same(b.net.log, ["?v=" + hashOf(v1["index.html"]), ...Object.entries(v1).map(([f, t]) => `${f}?v=${hashOf(t)}`)]) && b.store.get("crates-one").size === 5,
    "a first install fetches every file once, at an address carrying its hash (no cache on the way can answer with an older copy)");

  // an update: one file changed, one added
  const v2 = { ...v1, "app.js": "export const a = 2;", "kb/entities.js": "export const ENTITIES = [];" };
  Object.assign(b.net.site, v2); b.net.log = [];
  h = worker(b, v2, "two");
  await run(h, "install");
  check(same(b.net.log, [`app.js?v=${hashOf(v2["app.js"])}`, `kb/entities.js?v=${hashOf(v2["kb/entities.js"])}`]), "an update fetches only what changed or is new; the rest is copied from the copy already there");
  await run(h, "activate");
  check(same(b.store.keys(), ["crates-two"]), "once the new copy is whole, the old one goes");

  // offline: files answered whatever their ?query, an unknown page opens the games screen, other sites are left alone
  b.net.down = true;
  check(await text(await run(h, "fetch", { request: { url: BASE + "app.js?x=1", method: "GET", mode: "cors" } })) === v2["app.js"], "offline, a file is answered from the copy, whatever ?query its address carries");
  check(await text(await run(h, "fetch", { request: { url: BASE + "crates.html?room=AB", method: "GET", mode: "navigate" } })) === v1["index.html"],
    "offline, a page that isn't kept opens the games screen, not the browser's error (a home-screen app has no Back)");
  check(await run(h, "fetch", { request: { url: "https://croatiabio.firebaseio.com/x.json", method: "GET", mode: "cors" } }) === null, "another site's requests go to the network, untouched");
  const failed = await run(h, "fetch", { request: { url: BASE + "nothing.js", method: "GET", mode: "cors" } }).then(() => false, () => true);
  check(failed, "offline, a file that isn't kept fails as it would without the worker");

  // a copy holding the wrong bytes (a stale copy from the site's servers) is fetched again, not copied
  b.net.down = false; b.net.log = [];
  const two = b.store.get("crates-two");
  two.set(BASE + "kb/links.js", { bytes: new TextEncoder().encode("stale"), type: "text/plain" });
  const v3 = { ...v2, "app.js": "export const a = 3;" };
  Object.assign(b.net.site, v3);
  h = worker(b, v3, "three");
  await run(h, "install");
  check(same(b.net.log, [`app.js?v=${hashOf(v3["app.js"])}`, `kb/links.js?v=${hashOf(v3["kb/links.js"])}`]), "a copy whose bytes aren't the listed ones is fetched again, never copied");

  // a fetch that fails fails the install, and the old version stays
  b.net.site["app.js"] = null;
  const v4 = { ...v3, "app.js": "export const a = 4;" };
  h = worker(b, v4, "four");
  const failedInstall = await run(h, "install").then(() => false, () => true);
  check(failedInstall && b.store.has("crates-two"), "a file that won't download fails the install: the version before stays, whole");

  // an older version taking over mid-fill can delete the new copy: it's refilled at activation (from the older
  // copy, then the network), and the older copy goes only once the new one is whole
  b.store.delete("crates-four"); b.net.site["app.js"] = v4["app.js"];
  await run(h, "install");
  b.store.delete("crates-four"); b.net.down = true;
  await run(h, "activate");
  check(b.store.has("crates-two") || b.store.has("crates-three"), "offline, a copy left incomplete keeps the older copies to fall back on");
  const fallback = await text(await run(h, "fetch", { request: { url: BASE + "kb/entities.js", method: "GET", mode: "cors" } }));
  check(fallback === v2["kb/entities.js"], "and what it lacks is answered from them");
  b.net.down = false;
  await run(h, "activate");
  check(same(b.store.keys(), ["crates-four"]) && b.store.get("crates-four").size === 6, "back online, the copy is made whole and only then do the older ones go");
}

// ---------- sw.js as the workflow writes it ----------
{
  const { text: sw, files: shipped } = serviceWorker();
  let parses = true;
  try { new vm.Script(sw); } catch { parses = false; }
  const FILES = JSON.parse(sw.match(/const FILES = (\{[\s\S]*?\});/)[1]);
  check(parses && same(Object.keys(FILES), ["./", ...shipped]) && FILES["./"] === FILES["index.html"] && FILES["origin.js"] === hashOf(fs.readFileSync(ROOT + "origin.js")),
    `sw.js parses, and lists every kept file with the hash of its bytes (the app's own address as the games screen)`);
  const size = shipped.reduce((s, f) => s + fs.statSync(ROOT + f).size, 0);
  console.log(`     ${shipped.length} files, ${(size / 1e6).toFixed(1)} MB on the device`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("offline: every page opens with no connection, and an update downloads only what changed");
