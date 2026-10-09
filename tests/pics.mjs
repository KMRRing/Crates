// Settings' "Keep pictures offline" (pics.js): every picture the games show (pics-list.js, from the build) kept on the
// device at 500 pixels, run here against a stand-in for Wikipedia, the browser's storage and its caches. Their
// addresses come fifty to a question, a title Wikipedia normalises or redirects still lands on the title asked, a page
// with no image counts as kept, a second run asks for nothing, a download cut short carries on where it stopped, the
// switch turned off stops it, and offline a game asking for a bigger picture gets the kept copy.
import { PICTURES } from "../pics-list.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the stand-ins ----------
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const nav = { onLine: true };
Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });
const cached = new Map();                                       // cache name -> Map(url -> bytes)
globalThis.caches = {
  async open(name) {
    if (!cached.has(name)) cached.set(name, new Map());
    const m = cached.get(name);
    return { async match(u) { return m.has(String(u)) ? new Response(m.get(String(u))) : undefined; }, async put(u, res) { m.set(String(u), new Uint8Array(await res.arrayBuffer())); } };
  },
};
// Wikipedia: "The Starry Night" asked as such is normalised from nothing but redirected (as if the page had moved), one
// title is asked with an underscore and normalised; "Mona Lisa" has no image; images cost one request each
const net = { api: 0, images: 0, cutAfter: Infinity, refuse: new Set() };
const thumbOf = (t, w) => `https://upload.wikimedia.org/thumb/${encodeURIComponent(t)}/${w}px.jpg`;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname === "en.wikipedia.org") {
    net.api++;
    const titles = u.searchParams.get("titles").split("|"), w = Number(u.searchParams.get("pithumbsize") || u.searchParams.get("iiurlwidth"));
    const query = { normalized: [], redirects: [], pages: [] };
    for (const t of titles) {
      let name = t;
      if (t.includes("_")) { name = t.replace(/_/g, " "); query.normalized.push({ fromencoded: false, from: t, to: name }); }
      if (name === "The Starry Night") { query.redirects.push({ from: name, to: "The Starry Night (Van Gogh)" }); name = "The Starry Night (Van Gogh)"; }
      if (name === "Mona Lisa") query.pages.push({ ns: 0, title: name });
      else if (t.startsWith("File:")) query.pages.push({ ns: 6, title: name, imageinfo: [{ thumburl: thumbOf(t, w), url: thumbOf(t, "orig") }] });
      else query.pages.push({ ns: 0, title: name, thumbnail: { source: thumbOf(t, w), width: w, height: 400 }, original: { source: thumbOf(t, "orig") } });
    }
    return new Response(JSON.stringify({ batchcomplete: true, query }));
  }
  if (net.images >= net.cutAfter) throw new TypeError("Failed to fetch");
  net.images++;
  if (net.refuse.has(url)) return new Response("no", { status: 404 });
  return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } });
};

const pics = await import("../pics.js");
const W = pics.OFFLINE_WIDTH, kept = () => cached.get("crates-pics-2") ?? new Map();
const withImage = PICTURES.filter(t => t !== "Mona Lisa").length;

check(PICTURES.length > 250 && PICTURES.includes("Mona Lisa") && PICTURES.some(t => t.startsWith("File:")), `the build lists every picture the games show (${PICTURES.length})`);
let r = await pics.keepPicturesOffline();
check(r.total === 0 && net.api === 0, "switched off, nothing is downloaded");

pics.setKeepingPictures(true);
net.cutAfter = 100;
r = await pics.keepPicturesOffline();
check(r.offline && r.kept < r.total && net.images === 100, `a download cut short stops where the connection went (${r.kept} of ${r.total})`);
const firstApi = net.api;
check(firstApi === Math.ceil(PICTURES.filter(t => !t.startsWith("File:")).length / 50) + Math.ceil(PICTURES.filter(t => t.startsWith("File:")).length / 50),
  `the addresses come fifty pictures to a question (${firstApi} questions), pages and files apart`);

net.cutAfter = Infinity;
const imagesBefore = net.images;
r = await pics.keepPicturesOffline();
check(r.done && !r.offline && r.kept === r.total && net.api === firstApi && net.images - imagesBefore === withImage - 100,
  `back online it carries on: only the ${withImage - 100} not kept yet come down, the addresses aren't asked again`);
check(kept().size === withImage && [...kept().keys()].every(u => u.includes(`/${W}px.jpg`)), `every picture is kept, at ${W} pixels (${kept().size}; a page with no image counts as kept)`);

const mapping = JSON.parse(localStorage.getItem("pics:v2"));
check(mapping[`The Starry Night@${W}`]?.t === thumbOf("The Starry Night", W), "a title Wikipedia redirects is kept under the title the games ask for");
check(mapping[`Mona Lisa@${W}`] === null, "a page without an image is remembered as having none");

const quiet = [net.api, net.images];
r = await pics.keepPicturesOffline();
check(r.kept === r.total && net.api === quiet[0] && net.images === quiet[1], "a second run, everything kept, asks Wikipedia for nothing");

// offline, a game asking for a bigger picture (Punt and Quote ask for 960 pixels) gets the kept copy
nav.onLine = false;
const urls = await pics.pictureUrls("The Starry Night", 640);
check(urls?.t === thumbOf("The Starry Night", W) && net.api === quiet[0], "offline, a game asking for 960 pixels gets the 500-pixel copy kept, without asking Wikipedia");
nav.onLine = true;

// a picture Wikipedia refuses is counted missing and tried again next time; turning the switch off stops a download
const one = mapping[`Nighthawks@${W}`].t;
kept().delete(one); net.refuse.add(one);
r = await pics.keepPicturesOffline();
check(r.missing === 1 && r.kept === r.total - 1, "a picture refused is counted missing, and tried again next time");
net.refuse.clear();
pics.setKeepingPictures(false);
const before = net.images;
r = await pics.keepPicturesOffline();
check(r.total === 0 && net.images === before, "with the switch off, nothing more comes down");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("pics: every picture can be kept offline, and a game finds the kept copy");
