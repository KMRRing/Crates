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
let urls = null;
function load() { if (!urls) { try { urls = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { urls = {}; } } return urls; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(urls)); } catch { /* private mode */ } }
try { localStorage.removeItem("pics:urls"); } catch { /* private mode */ }   // the old cache held refused widths and failures

/** A page's lead image at about `width` px: { t, o } (thumbnail and original), or null if it has none or can't be reached. */
export async function pictureUrls(title, width = 640) {
  const all = load(), w = step(width), key = `${title}@${w}`;
  if (all[key] !== undefined) return all[key];
  try {
    const file = title.startsWith("File:");
    const res = await fetch(file ? `${FILE_API}&iiurlwidth=${w}&titles=${encodeURIComponent(title)}` : `${API}&pithumbsize=${w}&titles=${encodeURIComponent(title)}`);
    if (!res.ok) return null;                                  // a failure isn't remembered: next time it's asked again
    const page = (await res.json())?.query?.pages?.[0];
    const info = page?.imageinfo?.[0];
    const t = (file ? info?.thumburl : page?.thumbnail?.source) || null, o = (file ? info?.url : page?.original?.source) || null;
    all[key] = t || o ? { t: t || o, o: o || t } : null;       // a page without an image is remembered
    save();
    return all[key];
  } catch { return null; }
}
/** Puts the picture for `title` into `node` (an empty element), with a caption if given; hides the node if there's none. */
export async function showPicture(node, title, { width = 640, caption = null, alt = "" } = {}) {
  node.hidden = true;
  node.replaceChildren();
  const urls = await pictureUrls(title, width);
  if (!urls) return false;
  const img = document.createElement("img");
  img.alt = alt; img.loading = "lazy"; img.decoding = "async"; img.className = "pic";
  let tried = 0;
  img.addEventListener("error", () => {                         // a refused thumbnail: the original; then give up
    if (tried++ === 0 && urls.o && urls.o !== img.src) img.src = urls.o;
    else node.hidden = true;
  });
  img.src = urls.t;
  node.appendChild(img);
  if (caption) { const c = document.createElement("small"); c.className = "pic-caption"; c.textContent = caption; node.appendChild(c); }
  node.hidden = false;
  return true;
}
/** Wikipedia's attribution: each picture's file page gives its licence (some Wikipedia uses under fair use). */
export const credit = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
