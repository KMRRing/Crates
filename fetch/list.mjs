// What Wikimedia Commons has of the Bavarian pattern's cards. `index`: the categories a search finds, their files (and
// their subcategories'), and files found by name, each with its licence, author and size, into out/index.json.
// `thumbs`: small thumbnails of the files that look like single cards, into out/thumbs/. With fetch/want.json
// ({ files: [titles], width }), `cards` downloads those files at that width into out/cards/ with out/cards/meta.json.
import { mkdir, writeFile, readFile } from "node:fs/promises";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = { "User-Agent": "AlmanacCards/1.0 (https://github.com/KMRRing/Crates; a personal card game)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const what = process.argv[2] || "index";
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s]`, ...a);
async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
      log("api", r.status, url.slice(0, 160));
    } catch (e) { log("api error", e.message); }
    await sleep(1000 * (i + 1));
  }
  return {};
}
async function download(url, path) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (r.ok) { await writeFile(path, Buffer.from(await r.arrayBuffer())); return true; }
      log("get", r.status, url.slice(0, 160));
      if (r.status === 429) await sleep(5000);
    } catch (e) { log("get error", e.message); }
    await sleep(1000);
  }
  return false;
}
const safe = t => t.replace(/^File:/, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);

if (what === "index") {
  const cats = new Set(["Category:Bavarian pattern", "Category:Bavarian pattern playing cards", "Category:Schafkopf"]);
  for (const q of ["Bavarian pattern", "Bayerisches Bild", "Schafkopf", "Bavarian playing cards", "Munich pattern", "German-suited playing cards", "Bavarian-Swabian pattern", "Tarock Bavarian"]) {
    const r = await api({ action: "query", list: "search", srsearch: q, srnamespace: "14", srlimit: "20" });
    for (const s of r.query?.search || []) cats.add(s.title);
  }
  log(`${cats.size} categories from the search`, [...cats].join(" | "));
  const files = new Map(), seenCats = new Set();
  async function walk(cat, depth) {
    if (seenCats.has(cat) || seenCats.size >= 80) return;
    seenCats.add(cat);
    let cont = {};
    let n = 0;
    do {
      const r = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmtype: "file|subcat", cmlimit: "500", ...cont });
      for (const m of r.query?.categorymembers || []) {
        if (m.ns === 6) { if (!files.has(m.title)) files.set(m.title, cat); n++; }
        else if (m.ns === 14 && depth > 0) await walk(m.title, depth - 1);
      }
      cont = r.continue ? { cmcontinue: r.continue.cmcontinue } : null;
    } while (cont && files.size < 6000);
    log(cat, n);
  }
  for (const c of cats) await walk(c, 1);
  for (const q of ["Bavarian pattern Ober", "Bavarian pattern Unter", "Bavarian pattern Sau", "Bayerisches Blatt", "Schafkopf Karte", "Eichel Ober", "Gras Sau", "Herz König Spielkarte", "Schellen Daus", "Bavarian deck svg"]) {
    const r = await api({ action: "query", list: "search", srsearch: q, srnamespace: "6", srlimit: "50" });
    for (const s of r.query?.search || []) if (!files.has(s.title)) files.set(s.title, `search: ${q}`);
  }
  log(`${seenCats.size} categories walked, ${files.size} files`);
  const titles = [...files.keys()], out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const r = await api({ action: "query", titles: titles.slice(i, i + 50).join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "120" });
    for (const p of r.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {}, v = k => (m[k]?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 240);
      out.push({ title: p.title, from: files.get(p.title), w: ii.width, h: ii.height, mime: ii.mime, url: ii.url, thumb: ii.thumburl,
        license: v("LicenseShortName"), artist: v("Artist"), desc: v("ImageDescription").slice(0, 160), date: v("DateTimeOriginal"), cats: v("Categories").slice(0, 200) });
    }
    if (i % 500 === 0) log(`info ${i}/${titles.length}`);
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  await mkdir("out", { recursive: true });
  await writeFile("out/index.json", JSON.stringify({ categories: [...seenCats], files: out }, null, 1));
  log(`index: ${out.length} files`);
} else if (what === "thumbs") {
  // single cards, not photos of packs: portrait, card-shaped, named or filed like a card
  const { files } = JSON.parse(await readFile("out/index.json", "utf8"));
  const cardLike = f => f.thumb && /image\/(jpeg|png|svg)/.test(f.mime) && f.h > f.w * 1.2 && f.h < f.w * 2.4
    && /ober|unter|sau|daus|ass|k[öo]nig|zehn|eichel|gras|laub|herz|schell|bav|bay|schafkopf|spielkart|card/i.test(f.title + " " + f.from + " " + f.cats);
  const pick = files.filter(cardLike);
  log(`${pick.length} card-like of ${files.length}`);
  await mkdir("out/thumbs", { recursive: true });
  let n = 0;
  for (const f of pick) {
    if (Date.now() - t0 > 15 * 60 * 1000) { log("out of time"); break; }
    if (await download(f.thumb, `out/thumbs/${safe(f.title)}.${/png|svg/.test(f.mime) ? "png" : "jpg"}`)) n++;
    if (n >= 500) break;
  }
  log(`${n} thumbnails`);
} else {
  const want = JSON.parse(await readFile("fetch/want.json", "utf8"));
  await mkdir("out/cards", { recursive: true });
  const meta = [];
  for (let i = 0; i < want.files.length; i += 50) {
    const r = await api({ action: "query", titles: want.files.slice(i, i + 50).join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: String(want.width || 500) });
    for (const p of r.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii) { log("missing", p.title); continue; }
      const m = ii.extmetadata || {}, v = k => (m[k]?.value || "").replace(/<[^>]+>/g, "").trim();
      const ext = ii.mime.includes("png") ? "png" : ii.mime.includes("svg") ? "svg" : "jpg";
      const src = ext === "svg" && want.svgOriginal ? ii.url : ii.thumburl || ii.url;
      const name = `${safe(p.title)}.${ext === "svg" && !want.svgOriginal ? "png" : ext}`;
      if (await download(src, `out/cards/${name}`)) meta.push({ title: p.title, file: name, license: v("LicenseShortName"), licenseUrl: v("LicenseUrl"), artist: v("Artist"), credit: v("Credit"), w: ii.width, h: ii.height });
    }
  }
  await writeFile("out/cards/meta.json", JSON.stringify(meta, null, 1));
  log(`${meta.length} cards`);
}
