// The service worker. tools/build-sw.mjs writes it into sw.js after VERSION and FILES: every file the app needs
// offline (tools/offline.mjs), each with the first 12 hex digits of the SHA-1 of its bytes. It keeps them all on the
// device, so every page opens and plays with no connection, from the home screen too. Requests to other sites
// (Firebase, for playing together) go to the network; Wikipedia's pictures are kept once they've been shown.
//
// An update downloads only what changed. A file whose bytes are already on the device, in an older version's copy,
// is copied across instead of fetched again (the app is about 29 MB and changes many times a day; every update once
// fetched all of it). What it does fetch it asks for at an address carrying the file's hash, so no cache on the way,
// the browser's or the site's servers', can answer with an older copy. A new version waits until the app is off
// screen to take over (pwa.js), and an older version's copy is deleted only once the new one is whole.
//
// The pages can ask (pwa.js's Update): which version this is, with its file list and whether its copy is whole; and
// for the copy to be made whole, when it's the site's version but files are missing. While a copy fills, the pages
// are told how far it has got, and if an install fails, why.
/* global VERSION, FILES */

const CACHE = `crates-${VERSION}`;
const PICS = "crates-pics-2";          // pictures from Wikipedia, kept once shown (pics-2: the first could hold refused thumbnails)
const KEEP = [PICS];                   // copies an update leaves alone
const TYPES = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json",
  webmanifest: "application/manifest+json", txt: "text/plain", svg: "image/svg+xml", png: "image/png", woff2: "font/woff2" };
const typeOf = (file, res) => res.headers.get("Content-Type") || TYPES[(file.match(/\.(\w+)$/) || ["", "html"])[1]] || "application/octet-stream";
const older = key => key.startsWith("crates-") && key !== CACHE && !KEEP.includes(key);

/** The first 12 hex digits of the SHA-1 of some bytes, as tools/build-sw.mjs hashes each file; null where the
 *  browser can't hash (then nothing is copied, and an update fetches every file, as every update once did). */
async function hashOf(bytes) {
  try {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes));
    return Array.from(d.subarray(0, 6), b => b.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}
/** A file's bytes as a response of their own: only the type comes along (not a redirect, not an encoding). */
const stored = (bytes, type) => new Response(bytes, { headers: { "Content-Type": type } });

/** Tells every page of the app, a first visit's too (no worker is in charge of it yet). */
async function tellPages(message) {
  try { for (const page of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) page.postMessage(message); }
  catch { /* no pages to tell */ }
}
/**
 * How far a copy has got, a few times a second while it fills: the files looked for on the device (checked, of
 * total), found there (copied), left to download (fetch), downloaded (fetched, and the bytes so far), and the ones on
 * their way (pending). pwa.js shows it under the rete while an update someone is waiting for fills; a page that isn't
 * waiting ignores it. done is the count a page from before these counts shows ("Downloading 120 of 747 files").
 * Whatever comes too soon after the last word is told once the moment has passed, so the last state before a long
 * wait (the file a slow download is stuck on) is always heard.
 */
let toldAt = 0, later = null;
function tell(p, last = false) {
  const wait = toldAt + 150 - Date.now();
  if (!last && wait > 0) { later ||= setTimeout(() => { later = null; tell(p, true); }, wait); return; }
  clearTimeout(later);
  later = null;
  toldAt = Date.now();
  const { pending, ...counts } = p;
  tellPages({ type: "filling", version: VERSION, ...counts, done: p.copied + p.fetched, pending: [...pending] });
}
/** Runs `job` on each of `items`, six at a time; rejects with the first that throws. */
async function lanes(items, job) {
  let next = 0;
  const lane = async () => { while (next < items.length) await job(items[next++]); };
  await Promise.all(Array.from({ length: 6 }, lane));
}
/** A response's bytes, read as they come, so the pages hear that a big file is still moving (onPiece(bytes)). */
async function bytesOf(res, onPiece) {
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader(), pieces = [];
  for (let r; !(r = await reader.read()).done;) { pieces.push(r.value); onPiece(r.value.length); }
  const bytes = new Uint8Array(pieces.reduce((n, piece) => n + piece.length, 0));
  pieces.reduce((at, piece) => { bytes.set(piece, at); return at + piece.length; }, 0);
  return bytes;
}

/**
 * Makes this version's copy whole, in two stages so the pages can be told what changed before any of it downloads:
 * every file is looked for on the device first (one already in this copy with the right bytes is left, one held with
 * the right bytes by an older copy is copied across), then only the rest is fetched. Throws if a fetch fails.
 */
async function fill() {
  const cache = await caches.open(CACHE);
  const others = await Promise.all((await caches.keys()).filter(older).map(k => caches.open(k)));
  const files = Object.entries(FILES), missing = [];
  const p = { total: files.length, checked: 0, copied: 0, fetch: 0, fetched: 0, bytes: 0, pending: new Set() };
  const onDevice = async ([file, hash]) => {
    const key = new Request(file);                       // its address in the app's folder (the worker's own)
    for (const source of [cache, ...others]) {
      const hit = await source.match(key);
      if (!hit) continue;
      const bytes = await hit.arrayBuffer();
      if (await hashOf(bytes) !== hash) continue;        // another version of the file
      if (source !== cache) await cache.put(key, stored(bytes, typeOf(file, hit)));
      return true;
    }
    return false;
  };
  await lanes(files, async f => {
    if (await onDevice(f)) p.copied++; else missing.push(f);
    p.checked++;
    tell(p);
  });
  p.fetch = missing.length;
  tell(p, true);
  await lanes(missing, async ([file, hash]) => {
    p.pending.add(file);
    tell(p);
    const res = await fetch(`${file}?v=${hash}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    const bytes = await bytesOf(res, n => { p.bytes += n; tell(p); });
    // kept even if its bytes aren't the ones listed (the site may already serve a newer push): the next version,
    // finding them wrong, fetches it again rather than copying it
    await cache.put(new Request(file), stored(bytes, typeOf(file, res)));
    p.pending.delete(file);
    p.fetched++;
    tell(p);
  });
  tell(p, true);
}
/** fill(), one at a time: the install, the activation and a page can each ask for it. */
let filling = null;
const fillOnce = () => (filling ||= fill().finally(() => { filling = null; }));
/** True when this version's copy holds every file. */
async function whole() {
  const have = new Set((await (await caches.open(CACHE)).keys()).map(r => r.url));
  return Object.keys(FILES).every(f => have.has(new URL(f, self.location).href));
}
/** Deletes the older versions' copies once this one is whole: until then they answer for whatever it lacks. */
async function tidy() {
  if (await whole()) for (const k of await caches.keys()) if (older(k)) await caches.delete(k);
}
/** Tells the pages why a copy didn't fill (a file the site no longer has, the connection gone): the page waiting
 *  for it says so. Resolves with the reason. */
async function failed(e) {
  const error = String(e?.message || e);
  await tellPages({ type: "failed", version: VERSION, error });
  return error;
}

self.addEventListener("install", event => event.waitUntil(fillOnce().then(whole)
  .then(ok => { if (!ok) throw new Error("the copy was emptied while it filled"); })
  .catch(async e => { await failed(e); throw e; })));
self.addEventListener("activate", event => event.waitUntil((async () => {
  // an older version taking over while this one filled can have deleted this one's copy: it's made whole first, and
  // the older copies go only once it is (offline they stay, and answer for whatever this one lacks)
  if (!await whole()) await fillOnce().catch(() => {});
  await tidy();
  await self.clients.claim();
})()));
self.addEventListener("message", event => {
  const ask = event.data, reply = event.ports?.[0];
  if (ask === "take-over") self.skipWaiting();
  // Update comparing this device with the site: the version in use, its files, and whether every one is here
  else if (ask?.type === "version") event.waitUntil(whole().catch(() => false).then(ok => reply?.postMessage({ version: VERSION, files: FILES, whole: ok })));
  // the site's version, but files missing from its copy (it took over offline): only those are fetched
  else if (ask?.type === "fill") event.waitUntil(fillOnce().then(whole).then(async ok => { if (ok) await tidy().catch(() => {}); reply?.postMessage({ ok }); },
    async e => reply?.postMessage({ ok: false, error: await failed(e) })));
});

// pictures from Wikipedia (the API's answers and the images, thumbnails from thumb.wikimedia.org): an image fetched
// by an <img> comes back opaque (no CORS), which can still be kept and given back to an <img>. A kept copy is found by
// its address alone: Settings keeps them with a plain request, and a reply that Varies on a header the <img>'s request
// sends differently would otherwise never match it, offline least of all
const isPicture = url => (url.hostname === "en.wikipedia.org" && url.pathname === "/w/api.php" && url.searchParams.get("prop") === "pageimages")
  || url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org";
async function picture(request) {
  const cache = await caches.open(PICS), hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone()).catch(() => {});   // kept as it's shown, not before
  return res;
}
/**
 * A file of the app, whatever ?query its address carries: this version's copy, else any version's (should this one
 * lack it), else the network. Offline, a page that isn't kept opens the games screen instead of the browser's error,
 * since an app on the home screen has no Back to leave it by.
 */
async function answer(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true }) || await caches.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try { return await fetch(request); } catch (e) {
    const home = request.mode === "navigate" && (await cache.match("./") || await caches.match("./"));
    if (home) return home;
    throw e;
  }
}
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET") return;
  if (isPicture(url)) event.respondWith(picture(request));
  else if (url.origin === self.location.origin) event.respondWith(answer(request));
});
