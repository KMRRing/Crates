// Pictures for the banks: a painting, a landmark, a person, named by its English Wikipedia page title. The page's
// lead image comes from Wikipedia's summary API at display time (the app stays small and offline-capable; the
// service worker keeps every picture it has fetched). Nothing is stored here but the mapping of titles to URLs.
const API = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const KEY = "pics:urls";
let urls = null;
function load() { if (!urls) { try { urls = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { urls = {}; } } return urls; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(urls)); } catch { /* private mode */ } }
/** The URL of a page's lead image at about `width` px, or null if the page has none or can't be reached. */
export async function pictureUrl(title, width = 640) {
  const all = load(), key = `${title}@${width}`;
  if (all[key] !== undefined) return all[key];
  try {
    const res = await fetch(API + encodeURIComponent(title.replace(/ /g, "_")), { headers: { Accept: "application/json" } });
    if (!res.ok) { all[key] = null; save(); return null; }
    const json = await res.json();
    const src = json.originalimage?.source || json.thumbnail?.source || null;
    const url = src && json.thumbnail?.source ? json.thumbnail.source.replace(/\/\d+px-/, `/${width}px-`) : src;
    all[key] = url || null;
    save();
    return all[key];
  } catch { return null; }
}
/** Puts the picture for `title` into `node` (an empty element), with a caption if given; hides the node if there's none. */
export async function showPicture(node, title, { width = 640, caption = null, alt = "" } = {}) {
  node.hidden = true;
  node.replaceChildren();
  const url = await pictureUrl(title, width);
  if (!url) return false;
  const img = document.createElement("img");
  img.src = url; img.alt = alt; img.loading = "lazy"; img.decoding = "async"; img.className = "pic";
  img.addEventListener("error", () => { node.hidden = true; });
  node.appendChild(img);
  if (caption) { const c = document.createElement("small"); c.className = "pic-caption"; c.textContent = caption; node.appendChild(c); }
  node.hidden = false;
  return true;
}
/** Wikipedia's attribution: pictures are free to use with their file pages' licences. */
export const credit = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
