// Pictures for the banks: a painting, a landmark, a person, named by its English Wikipedia page title. The page's
// lead image comes from Wikipedia at display time (the app stays small and offline-capable; the service worker keeps
// every picture it has fetched). Nothing is stored here but the mapping of titles to URLs.
//
// Wikimedia only serves thumbnails at a fixed ladder of widths (since 2026; a URL built by hand with any other width
// is refused with HTTP 400, which is how every picture here once went blank). So the width asked for is rounded up to
// the next step, and the URL comes from Wikipedia's own API rather than being built by hand; if a thumbnail is
// refused anyway, the original file is the fallback, and only then does the picture hide.
const STEPS = [120, 250, 330, 500, 960, 1280, 1920];
const step = width => STEPS.find(s => s >= width) ?? STEPS[STEPS.length - 1];
// pageimages gives a page's lead image as its thumbnail at the size asked (rounded up to a step) and its original;
// pilicense=any includes images Wikipedia uses under fair use (most 20th-century paintings); origin=* allows the call
const API = "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageimages&piprop=thumbnail|original&pilicense=any";
// a picture can also be named by its file ("File:Kirchner - Mountain Landscape from Clavadel.jpg"), for one that has no
// page of its own: imageinfo gives that file's thumbnail at the width asked, and its original
const FILE_API = "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&prop=imageinfo&iiprop=url";
const KEY = "pics:v2";                 // { "title@width": { t: thumbnail, o: original } | null (the page has no image) }
// Settings' "Keep pictures offline" keeps every picture the games show at this width, in the service worker's cache
// of pictures (sw.js names it the same): a quarter of the bytes of the 960 pixels Punt and Quote ask for, and offline
// a game asking for any width gets this copy
export const OFFLINE_WIDTH = 500;
const CACHE = "crates-pics-2";
/** The copy kept for offline play: the picture's addresses at OFFLINE_WIDTH, if they're known. */
const keptCopy = title => load()[`${title}@${OFFLINE_WIDTH}`] ?? null;
let urls = null;
function load() { if (!urls) { try { urls = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { urls = {}; } } return urls; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(urls)); } catch { /* private mode */ } }
try { if (localStorage.getItem("pics:urls") !== null) localStorage.removeItem("pics:urls"); } catch { /* private mode */ }   // the old cache held refused widths and failures

/** A page's lead image at about `width` px: { t, o } (thumbnail and original), or null if it has none or can't be reached. */
export async function pictureUrls(title, width = 640) {
  const all = load(), w = step(width), key = `${title}@${w}`;
  if (all[key] !== undefined) return all[key];
  if (navigator.onLine === false) return keptCopy(title);     // offline: the copy kept for offline play, if there is one
  try {
    const file = title.startsWith("File:");
    const res = await fetch(file ? `${FILE_API}&iiurlwidth=${w}&titles=${encodeURIComponent(title)}` : `${API}&pithumbsize=${w}&titles=${encodeURIComponent(title)}`);
    if (!res.ok) return keptCopy(title);                       // a failure isn't remembered: next time it's asked again
    const page = (await res.json())?.query?.pages?.[0];
    const info = page?.imageinfo?.[0];
    const t = (file ? info?.thumburl : page?.thumbnail?.source) || null, o = (file ? info?.url : page?.original?.source) || null;
    all[key] = t || o ? { t: t || o, o: o || t } : null;       // a page without an image is remembered
    save();
    return all[key];
  } catch { return keptCopy(title); }
}
/** Puts the picture for `title` into `node` (an empty element), with a caption if given; hides the node if there's none. */
export async function showPicture(node, title, { width = 640, caption = null, alt = "" } = {}) {
  node.hidden = true;
  node.replaceChildren();
  const urls = await pictureUrls(title, width);
  if (!urls) return false;
  const img = document.createElement("img");
  img.alt = alt; img.loading = "lazy"; img.decoding = "async"; img.className = "pic";
  // a thumbnail that won't load (refused, or offline and not kept): the copy kept for offline play, then the original
  // file; then the picture hides
  const tries = [...new Set([urls.t, keptCopy(title)?.t, urls.o].filter(Boolean))];
  let at = 0;
  img.addEventListener("error", () => { if (++at < tries.length) img.src = tries[at]; else node.hidden = true; });
  img.src = tries[0];
  node.appendChild(img);
  if (caption) { const c = document.createElement("small"); c.className = "pic-caption"; c.textContent = caption; node.appendChild(c); }
  node.hidden = false;
  return true;
}
/** Wikipedia's attribution: each picture's file page gives its licence (some Wikipedia uses under fair use). */
export const credit = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

// ---------- every picture, kept offline (Settings) ----------
// The games show a few hundred pictures (pics-list.js, written by the build from kb/): Settings' "Keep pictures offline"
// downloads them all at OFFLINE_WIDTH, straight from Wikipedia to this device (they aren't the app's to hand out: many
// 20th-century paintings are on Wikipedia under fair use). Their addresses are asked fifty at a time and remembered with
// the rest; the images come down four at a time into the service worker's picture cache. What's kept already is
// skipped, so a download cut short (offline, the page closed) carries on where it stopped, and pictures added to the
// games later come down the next time a page opens with it on.
const KEEPING = "suite:pics";          // "on" while this device keeps every picture (a suite: key: this device only)
export const keepingPictures = () => { try { return localStorage.getItem(KEEPING) === "on"; } catch { return false; } };
export function setKeepingPictures(on) { try { if (on) localStorage.setItem(KEEPING, "on"); else localStorage.removeItem(KEEPING); } catch { /* private mode */ } }
const listeners = new Set();
/** Calls f({ kept, total, missing, done, offline }) as a download goes; returns a function that stops listening. */
export const onPictures = f => { listeners.add(f); return () => listeners.delete(f); };
let running = null;
/** Keeps every picture offline (or checks they are): one download at a time, however often it's asked for. */
export const keepPicturesOffline = () => (running ||= keepAll().finally(() => { running = null; }));

/** The addresses of up to fifty pictures at OFFLINE_WIDTH: { title: { t, o } | null (no image) }; throws offline. */
async function lookUp(titles) {
  const found = {};
  for (const file of [false, true]) {
    const list = titles.filter(t => t.startsWith("File:") === file);
    if (!list.length) continue;
    const names = encodeURIComponent(list.join("|"));
    const res = await fetch(file ? `${FILE_API}&iiurlwidth=${OFFLINE_WIDTH}&titles=${names}` : `${API}&pithumbsize=${OFFLINE_WIDTH}&pilimit=50&titles=${names}`);
    if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
    const q = (await res.json())?.query || {};
    // a title as asked may be normalised (an underscore, a first letter) and redirected before it names its page
    const hop = new Map([...(q.normalized || []), ...(q.redirects || [])].map(r => [r.from, r.to]));
    const pages = new Map((q.pages || []).map(p => [p.title, p]));
    for (const title of list) {
      let name = title;
      for (let i = 0; i < 4 && hop.has(name); i++) name = hop.get(name);
      const page = pages.get(name);
      if (!page) continue;                                     // not in the answer: asked again next time
      const info = page.imageinfo?.[0];
      const t = (file ? info?.thumburl : page.thumbnail?.source) || null, o = (file ? info?.url : page.original?.source) || null;
      found[title] = t || o ? { t: t || o, o: o || t } : null;
    }
  }
  return found;
}
/** One image into the cache: asked for with CORS, so it's kept at its own size (an opaque copy, as an <img> fetches it,
 *  counts against the device's storage as if it were megabytes); a host that won't allow that is kept opaque. */
async function fetchInto(cache, url) {
  let res;
  try { res = await fetch(url, { mode: "cors", credentials: "omit" }); }
  catch { res = await fetch(url, { mode: "no-cors", credentials: "omit" }); }
  if (res.type !== "opaque" && !res.ok) return false;
  await cache.put(url, res);
  return true;
}
async function keepAll() {
  if (!keepingPictures()) return { kept: 0, total: 0, missing: 0, done: true, offline: false };
  const { PICTURES } = await import("./pics-list.js");
  const all = load(), cache = await caches.open(CACHE), total = PICTURES.length;
  let kept = 0, missing = 0;
  const tell = extra => { const p = { kept, total, missing, done: false, offline: false, ...extra }; for (const f of listeners) f(p); return p; };
  try {
    const unknown = PICTURES.filter(t => all[`${t}@${OFFLINE_WIDTH}`] === undefined);
    for (let i = 0; i < unknown.length; i += 50) { Object.assign(all, Object.fromEntries(Object.entries(await lookUp(unknown.slice(i, i + 50))).map(([t, u]) => [`${t}@${OFFLINE_WIDTH}`, u]))); save(); }
    const queue = [...PICTURES];
    let cut = false;                                             // the connection went: every lane stops
    const lane = async () => {
      while (queue.length && !cut && keepingPictures()) {        // turned off in Settings: it stops
        const urls = all[`${queue.shift()}@${OFFLINE_WIDTH}`];
        try {
          if (urls === undefined) missing++;                     // its address didn't come: next time
          else if (urls === null || await cache.match(urls.t) || await fetchInto(cache, urls.t)) kept++;   // null: no image to keep
          else missing++;                                        // refused: tried again next time
        } catch { cut = true; return; }
        tell();
      }
    };
    await Promise.all([lane(), lane(), lane(), lane()]);
    return tell({ done: true, offline: cut });
  } catch {
    return tell({ done: true, offline: true });                  // offline before the addresses came: next time
  }
}
