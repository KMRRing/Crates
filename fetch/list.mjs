// What Wikimedia Commons has of the Bavarian pattern's cards: the categories a search finds, their files (and their
// subcategories' files), and files found by name, each with its licence, author and size, and a small thumbnail to
// look at. Writes out/index.json and out/thumbs/. With fetch/want.json ({ files: [titles], width }), it also downloads
// those files at that width into out/cards/.
import { mkdir, writeFile, readFile } from "node:fs/promises";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = { "User-Agent": "AlmanacCards/1.0 (https://github.com/KMRRing/Crates; a personal card game)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.json();
      console.log("api", r.status, url.slice(0, 160));
    } catch (e) { console.log("api error", e.message); }
    await sleep(1500 * (i + 1));
  }
  return {};
}
async function download(url, path) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) { await writeFile(path, Buffer.from(await r.arrayBuffer())); return true; }
      console.log("get", r.status, url.slice(0, 160));
    } catch (e) { console.log("get error", e.message); }
    await sleep(1500 * (i + 1));
  }
  return false;
}
const safe = t => t.replace(/^File:/, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);

await mkdir("out/thumbs", { recursive: true });
let want = null;
try { want = JSON.parse(await readFile("fetch/want.json", "utf8")); } catch { /* the first look */ }

if (!want) {
  // the categories a search finds
  const cats = new Set(["Category:Bavarian pattern", "Category:Bavarian pattern playing cards", "Category:Schafkopf"]);
  for (const q of ["Bavarian pattern", "Bayerisches Bild", "Schafkopf", "Bavarian playing cards", "Munich pattern playing cards", "F. X. Schmid playing cards", "German-suited playing cards"]) {
    const r = await api({ action: "query", list: "search", srsearch: q, srnamespace: "14", srlimit: "30" });
    for (const s of r.query?.search || []) cats.add(s.title);
  }
  // their files, and their subcategories' (two levels down)
  const files = new Map(), seenCats = new Set(), from = new Map();
  async function walk(cat, depth) {
    if (seenCats.has(cat) || seenCats.size > 120) return;
    seenCats.add(cat);
    let cont = {};
    do {
      const r = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmtype: "file|subcat", cmlimit: "500", ...cont });
      for (const m of r.query?.categorymembers || []) {
        if (m.ns === 6) { files.set(m.title, true); if (!from.has(m.title)) from.set(m.title, cat); }
        else if (m.ns === 14 && depth > 0) await walk(m.title, depth - 1);
      }
      cont = r.continue ? { cmcontinue: r.continue.cmcontinue } : null;
    } while (cont);
  }
  for (const c of cats) await walk(c, 2);
  // files found by name
  for (const q of ["Bavarian pattern Ober", "Bavarian pattern Unter", "Bavarian pattern Deuce", "Bavarian-pattern", "Bayerisches Blatt", "Schafkopf Karte", "Eichel Ober", "Gras Sau", "Herz König Spielkarte", "Schellen Daus"]) {
    const r = await api({ action: "query", list: "search", srsearch: q, srnamespace: "6", srlimit: "100" });
    for (const s of r.query?.search || []) { files.set(s.title, true); if (!from.has(s.title)) from.set(s.title, `search: ${q}`); }
  }
  console.log(`${seenCats.size} categories, ${files.size} files`);
  // each file's licence, author, size, and a thumbnail
  const titles = [...files.keys()], out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const r = await api({ action: "query", titles: titles.slice(i, i + 50).join("|"), prop: "imageinfo|categories", iiprop: "url|size|mime|extmetadata", iiurlwidth: "160", cllimit: "max" });
    for (const p of r.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {}, v = k => (m[k]?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 300);
      out.push({ title: p.title, from: from.get(p.title), w: ii.width, h: ii.height, mime: ii.mime, url: ii.url, thumb: ii.thumburl,
        license: v("LicenseShortName"), artist: v("Artist"), credit: v("Credit"), desc: v("ImageDescription"), date: v("DateTimeOriginal"),
        cats: (p.categories || []).map(c => c.title.replace(/^Category:/, "")) });
    }
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  await writeFile("out/index.json", JSON.stringify({ categories: [...seenCats], files: out }, null, 1));
  // thumbnails of the likeliest: card images, not photos of packs (portrait, smaller than a poster)
  let n = 0;
  for (const f of out) {
    if (!f.thumb || !/image\/(jpeg|png|svg)/.test(f.mime)) continue;
    if (await download(f.thumb, `out/thumbs/${safe(f.title)}.${f.mime.includes("png") || f.mime.includes("svg") ? "png" : "jpg"}`)) n++;
    if (n >= 700) break;
  }
  console.log(`${n} thumbnails`);
} else {
  // the chosen files, at the width asked
  await mkdir("out/cards", { recursive: true });
  const meta = [];
  for (let i = 0; i < want.files.length; i += 50) {
    const r = await api({ action: "query", titles: want.files.slice(i, i + 50).join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: String(want.width || 600) });
    for (const p of r.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii) { console.log("missing", p.title); continue; }
      const m = ii.extmetadata || {}, v = k => (m[k]?.value || "").replace(/<[^>]+>/g, "").trim();
      const ext = ii.mime.includes("png") ? "png" : ii.mime.includes("svg") ? "svg" : "jpg";
      const src = ext === "svg" && want.svgOriginal ? ii.url : ii.thumburl || ii.url;
      const name = `${safe(p.title)}.${ext === "svg" && !want.svgOriginal ? "png" : ext}`;
      if (await download(src, `out/cards/${name}`)) meta.push({ title: p.title, file: name, license: v("LicenseShortName"), licenseUrl: v("LicenseUrl"), artist: v("Artist"), credit: v("Credit"), w: ii.width, h: ii.height });
    }
  }
  await writeFile("out/cards/meta.json", JSON.stringify(meta, null, 1));
  console.log(`${meta.length} cards`);
}
