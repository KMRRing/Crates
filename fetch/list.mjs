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
  // the Bavarian pattern's own category and its subcategories, and a few near it: not a search's wanderings
  const cats = ["Category:Bavarian pattern", "Category:Schafkopf", "Category:Obers (playing cards)", "Category:Unters (playing cards)", "Category:German-suited playing cards"];
  const files = new Map(), seenCats = new Set();
  async function walk(cat, depth) {
    if (seenCats.has(cat) || seenCats.size >= 40) return;
    seenCats.add(cat);
    let cont = {}, n = 0;
    do {
      const r = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmtype: "file|subcat", cmlimit: "500", ...cont });
      for (const m of r.query?.categorymembers || []) {
        if (m.ns === 6) { if (!files.has(m.title)) files.set(m.title, cat); n++; }
        else if (m.ns === 14 && depth > 0) await walk(m.title, depth - 1);
      }
      cont = r.continue ? { cmcontinue: r.continue.cmcontinue } : null;
    } while (cont && n < 600);
    log(cat, n);
  }
  await walk(cats[0], 2);
  for (const c of cats.slice(1)) await walk(c, 0);
  log(`${seenCats.size} categories walked, ${files.size} files`);
  const titles = [...files.keys()].slice(0, 900), out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const r = await api({ action: "query", titles: titles.slice(i, i + 50).join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "120" });
    for (const p of r.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {}, v = k => (m[k]?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 240);
      out.push({ title: p.title, from: files.get(p.title), w: ii.width, h: ii.height, mime: ii.mime, url: ii.url, thumb: ii.thumburl,
        license: v("LicenseShortName"), artist: v("Artist"), desc: v("ImageDescription").slice(0, 160), date: v("DateTimeOriginal"), cats: v("Categories").slice(0, 200) });
    }
    log(`info ${i}/${titles.length}`);
    await sleep(300);
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
  const pick = files.filter(f => /Bavarian|Schafkopf/i.test(f.from)).concat(files.filter(f => !/Bavarian|Schafkopf/i.test(f.from) && cardLike(f)).slice(0, 150));
  log(`${pick.length} card-like of ${files.length}`);
  await mkdir("out/thumbs", { recursive: true });
  let n = 0;
  for (const f of pick) {
    if (Date.now() - t0 > 15 * 60 * 1000) { log("out of time"); break; }
    if (await download(f.thumb, `out/thumbs/${safe(f.title)}.${/png|svg/.test(f.mime) ? "png" : "jpg"}`)) n++;
    await sleep(150);
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
