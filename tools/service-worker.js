// The service worker. tools/build-sw.mjs writes it into sw.js after VERSION and FILES: every file the app needs
// offline (tools/offline.mjs), each with the first 12 hex digits of the SHA-1 of its bytes. It keeps them all on the
// device, so every page opens and plays with no connection, from the home screen too. Requests to other sites
// (Firebase, for playing together) go to the network; Wikipedia's pictures are kept once they've been shown.
//
// An update downloads only what changed. A file whose bytes are already on the device, in an older version's copy,
// is copied across instead of fetched again (the app is about 13 MB and changes many times a day; every update once
// fetched all of it). What it does fetch it asks for at an address carrying the file's hash, so no cache on the way,
// the browser's or the site's servers', can answer with an older copy. A new version waits until the app is off
// screen to take over (pwa.js), and an older version's copy is deleted only once the new one is whole.
/* global VERSION, FILES */

const CACHE = `crates-${VERSION}`;
const PICS = "crates-pics-2";          // pictures from Wikipedia, kept once shown (pics-2: the first could hold refused thumbnails)
const KEEP = [PICS];                   // copies an update leaves alone
const TYPES = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json",
  webmanifest: "application/manifest+json", txt: "text/plain", svg: "image/svg+xml", png: "image/png", woff2: "font/woff2" };
const typeOf = (file, res) => res.headers.get("Content-Type") || TYPES[(file.match(/\.(\w+)$/) || ["", "html"])[1]] || "application/octet-stream";

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

/**
 * Makes this version's copy whole: each file already there with the right bytes is left, one held with the right
 * bytes by an older copy is copied across, and the rest is fetched, six at a time. Throws if a fetch fails.
 */
async function fill() {
  const cache = await caches.open(CACHE);
  const others = await Promise.all((await caches.keys()).filter(k => k.startsWith("crates-") && k !== CACHE && !KEEP.includes(k)).map(k => caches.open(k)));
  const want = Object.entries(FILES);
  const one = async ([file, hash]) => {
    const key = new Request(file);                       // its address in the app's folder (the worker's own)
    for (const source of [cache, ...others]) {
      const hit = await source.match(key);
      if (!hit) continue;
      const bytes = await hit.arrayBuffer();
      if (await hashOf(bytes) !== hash) continue;        // another version of the file
      if (source !== cache) await cache.put(key, stored(bytes, typeOf(file, hit)));
      return;
    }
    const res = await fetch(`${file}?v=${hash}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    // kept even if its bytes aren't the ones listed (the site may already serve a newer push): the next version,
    // finding them wrong, fetches it again rather than copying it
    await cache.put(key, stored(await res.arrayBuffer(), typeOf(file, res)));
  };
  let next = 0;
  const lane = async () => { while (next < want.length) await one(want[next++]); };
  await Promise.all(Array.from({ length: 6 }, lane));
}
/** True when this version's copy holds every file. */
async function whole() {
  const have = new Set((await (await caches.open(CACHE)).keys()).map(r => r.url));
  return Object.keys(FILES).every(f => have.has(new URL(f, self.location).href));
}

self.addEventListener("install", event => {
  event.waitUntil(fill().then(whole).then(ok => { if (!ok) throw new Error("the copy was emptied while it filled"); }));
});
self.addEventListener("activate", event => event.waitUntil((async () => {
  // an older version taking over while this one filled can have deleted this one's copy: it's made whole first, and
  // the older copies go only once it is (offline they stay, and answer for whatever this one lacks)
  if (!await whole()) await fill().catch(() => {});
  if (await whole()) for (const k of await caches.keys()) if (k.startsWith("crates-") && k !== CACHE && !KEEP.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("message", event => { if (event.data === "take-over") self.skipWaiting(); });

// pictures from Wikipedia (the API's answers and the images, thumbnails from thumb.wikimedia.org): an image fetched
// by an <img> comes back opaque (no CORS), which can still be kept and given back to an <img>
const isPicture = url => (url.hostname === "en.wikipedia.org" && url.pathname === "/w/api.php" && url.searchParams.get("prop") === "pageimages")
  || url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org";
async function picture(request) {
  const cache = await caches.open(PICS), hit = await cache.match(request);
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
