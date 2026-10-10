// Settings' "Keep pictures offline" (pics.js): every picture the games show (pics-list.js, from the build) kept on the
// device at 500 pixels, run here against a stand-in for Wikipedia, the browser's storage and its caches. Their
// addresses come fifty to a question, a title Wikipedia normalises or redirects still lands on the title asked, a page
// with no image is counted apart (Settings says how many, not "all kept"), a second run asks for nothing, a download cut
// short carries on where it stopped, the switch turned off stops it, and offline a game asking for a bigger picture gets
// the kept copy. Then a picture on a page (showPicture), against a stand-in <img>: a slow address or a slow image gives
// way to the copy kept on the device, only the latest picture asked of a box touches it, and a question about "this"
// names the thing once its picture can't be shown (askedWith), unless the name is one of its answers.
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
const net = { api: 0, images: 0, cutAfter: Infinity, refuse: new Set(), hang: new Set() };   // hang: titles Wikipedia never answers for
const thumbOf = (t, w) => `https://upload.wikimedia.org/thumb/${encodeURIComponent(t)}/${w}px.jpg`;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname === "en.wikipedia.org") {
    net.api++;
    const titles = u.searchParams.get("titles").split("|"), w = Number(u.searchParams.get("pithumbsize") || u.searchParams.get("iiurlwidth"));
    if (titles.some(t => net.hang.has(t))) return new Promise(() => {});
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
check(r.done && !r.offline && r.kept === withImage && r.none === 1 && net.api === firstApi && net.images - imagesBefore === withImage - 100,
  `back online it carries on: only the ${withImage - 100} not kept yet come down, the addresses aren't asked again`);
check(kept().size === withImage && [...kept().keys()].every(u => u.includes(`/${W}px.jpg`)), `every picture is kept, at ${W} pixels (${kept().size}; the page with no image counted apart, not as kept)`);

const mapping = JSON.parse(localStorage.getItem("pics:v2"));
check(mapping[`The Starry Night@${W}`]?.t === thumbOf("The Starry Night", W), "a title Wikipedia redirects is kept under the title the games ask for");
check(mapping[`Mona Lisa@${W}`] === null, "a page without an image is remembered as having none");

const quiet = [net.api, net.images];
r = await pics.keepPicturesOffline();
check(r.kept + r.none === r.total && net.api === quiet[0] && net.images === quiet[1], "a second run, everything kept, asks Wikipedia for nothing");

// offline, a game asking for a bigger picture (Punt and Quote ask for 960 pixels) gets the kept copy
nav.onLine = false;
const urls = await pics.pictureUrls("The Starry Night", 640);
check(urls?.t === thumbOf("The Starry Night", W) && net.api === quiet[0], "offline, a game asking for 960 pixels gets the 500-pixel copy kept, without asking Wikipedia");
nav.onLine = true;

// a picture Wikipedia refuses is counted missing and tried again next time; turning the switch off stops a download
const one = mapping[`American Gothic@${W}`].t;
kept().delete(one); net.refuse.add(one);
r = await pics.keepPicturesOffline();
check(r.missing === 1 && r.kept === withImage - 1, "a picture refused is counted missing, and tried again next time");
net.refuse.clear();
pics.setKeepingPictures(false);
const before = net.images;
r = await pics.keepPicturesOffline();
check(r.total === 0 && net.images === before, "with the switch off, nothing more comes down");

// ---------- a picture on a page ----------
// a stand-in <img>: what each address does when it's set (load, error, or nothing for a while), and a box to put it in
const images = { plan: new Map(), set: [] };                  // address -> "load" | "error" | "hang"
globalThis.document = {
  createElement: tag => {
    if (tag !== "img") return { className: "", textContent: "" };
    const on = {}, img = { addEventListener: (type, f) => { (on[type] ||= []).push(f); }, fire: type => (on[type] || []).forEach(f => f()) };
    Object.defineProperty(img, "src", { get: () => img.at, set: u => {
      img.at = u; images.set.push(u);
      const what = images.plan.get(u) || "load";
      if (what !== "hang") setTimeout(() => { if (img.at === u) img.fire(what); }, 1);
    } });
    return img;
  },
};
const box = () => ({ hidden: true, children: [], replaceChildren(...c) { this.children = c; }, appendChild(c) { this.children.push(c); } });
const shows = node => (node.hidden ? null : node.children[0]?.src ?? null);
const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
// the waits for a weak connection (seconds) run here in a moment: every timer pics.js sets is shortened
const realTimeout = globalThis.setTimeout;
const quick = on => { globalThis.setTimeout = on ? (f, ms, ...a) => realTimeout(f, Math.min(ms ?? 0, 20), ...a) : realTimeout; };
pics.setKeepingPictures(true);
const keptOf = t => mapping[`${t}@${W}`].t, big = t => thumbOf(t, 960);

// a page with no image: nothing shows, and the question names the thing instead of "this"
let node = box();
let shown = await pics.showPicture(node, "Mona Lisa");
check(shown === false && node.hidden, "a page with no image shows nothing, and says so");
check(pics.askedWith("The year this was painted", "Mona Lisa", "Mona Lisa") === "The year Mona Lisa was painted"
  && pics.askedWith("Who painted this?", "Mona Lisa", "Mona Lisa", ["Leonardo da Vinci", "Raphael"]) === "Who painted Mona Lisa?",
  `then its question names it: "${pics.askedWith("The year this was painted", "Mona Lisa", "Mona Lisa")}"`);
check(pics.askedWith("Which painting is this?", "Mona Lisa", "Mona Lisa", ["Mona Lisa", "Lady with an Ermine"]) === "Which painting is this?",
  "but not when the name is one of the answers: naming it would give the answer away");
check(pics.askedWith("The year this was painted", "American Gothic", "American Gothic") === "The year this was painted", "a picture that hasn't failed keeps its question as written");
check(pics.nameIn("This building's height, to its tip", "the Seagram Building") === "The Seagram Building's height, to its tip"
  && pics.nameIn("Which style is this?", "the Seagram Building") === "Which style is the Seagram Building?", "a name opening the question takes a capital, and keeps its small \"the\" inside one");

// a picture that shows, at the size asked for
node = box();
shown = await pics.showPicture(node, "The Starry Night", { width: 960 });
check(shown === true && shows(node) === big("The Starry Night"), "online, a picture shows at the size asked for");

// online, but a weak connection: the address of the size asked for doesn't come, so the copy on the device shows
quick(true);
net.hang.add("Arnolfini Portrait");
node = box();
shown = await pics.showPicture(node, "Arnolfini Portrait", { width: 960 });
check(shown === true && shows(node) === keptOf("Arnolfini Portrait"), "an address that doesn't come gives way to the copy kept on the device");
net.hang.clear();
// …or the address comes, but the image doesn't
images.plan.set(big("Girl with a Pearl Earring"), "hang");
node = box();
shown = await pics.showPicture(node, "Girl with a Pearl Earring", { width: 960 });
check(shown === true && shows(node) === keptOf("Girl with a Pearl Earring"), "an image that doesn't come gives way to the copy kept on the device");
// …and one that fails, with no copy to fall back on: the picture hides, and its question names it
images.plan.set(big("The Kiss (Klimt)"), "error").set(keptOf("The Kiss (Klimt)"), "error").set(thumbOf("The Kiss (Klimt)", "orig"), "error");
node = box();
shown = await pics.showPicture(node, "The Kiss (Klimt)", { width: 960 });
check(shown === false && node.hidden && pics.askedWith("The year this was painted", "The Kiss (Klimt)", "The Kiss") === "The year The Kiss was painted",
  "a picture none of whose addresses loads hides, and its question names it");
images.plan.clear();
shown = await pics.showPicture(box(), "The Kiss (Klimt)", { width: 960 });
check(shown === true && pics.askedWith("The year this was painted", "The Kiss (Klimt)", "The Kiss") === "The year this was painted", "shown later, it's \"this\" again");
quick(false);

// only the latest picture asked of a box touches it: the one before, slow to come or failing late, leaves it alone
net.hang.add("Las Meninas");
node = box();
const first = pics.showPicture(node, "Las Meninas", { width: 1280 });
await tick();
shown = await pics.showPicture(node, "The Night Watch", { width: 1280 });
check(shown === true && shows(node) === thumbOf("The Night Watch", 1280), "the next question's picture shows while the last one's is still on its way");
net.hang.clear();
images.plan.set(thumbOf("Liberty Leading the People", 1280), "hang");
const late = pics.showPicture(node, "Liberty Leading the People", { width: 1280 });
await tick();
const after = pics.showPicture(node, "American Gothic", { width: 1280 });
check(await after === true && shows(node) === thumbOf("American Gothic", 1280) && node.children.length === 1, "a picture asked for after one still loading takes the box alone");
quick(true);
check(await late === null && await first === null, "the earlier calls give up the box: they hide nothing, and add nothing");
check(!node.hidden && shows(node) === thumbOf("American Gothic", 1280), "and the picture showing stays");
quick(false);
images.plan.clear();
check(await pics.showPicture(node, null) === null && node.hidden && !node.children.length, "a question without a picture empties the box");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("pics: every picture can be kept offline, a game finds the kept copy, and a question names what it can't show");
