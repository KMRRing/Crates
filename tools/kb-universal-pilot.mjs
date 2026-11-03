// The pilot: lay the universality score against kb/. Stages (each reads the files the earlier ones wrote into the work folder):
//   titles   the English titles to look up: kb/ names and their variants, the Vital Articles, the most-read articles
//   ids      after kb-universal-resolve.mjs: which kb/ thing is which article; the universe = kb ∪ Vital ∪ most-read ∪ most-translated
//   join     after kb-universal-langs.mjs: scores and tiers everything → scored.json
//   report   the numbers and the samples as JSON (report.json) for docs/universal-knowledge.md
// Usage: node tools/kb-universal-pilot.mjs <work folder> <stage>
import { readFileSync, writeFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join, resolve as resolvePath } from "node:path";
import { loadKb } from "./kb-universal-kb.mjs";
import { variantsOf } from "./kb-universal-titles.mjs";
import { score, tier, spearman } from "./kb-universal-score.mjs";
import { TAUGHT_ROWS } from "./kb-universal-taught.mjs";

export const EDITIONS = ["en", "de", "fr", "es", "pt", "ru", "zh", "ja", "ar", "hi", "ko", "id", "it"];
const [W, stage] = process.argv.slice(2);
if (!W || !stage) { console.error("usage: node tools/kb-universal-pilot.mjs <work folder> <titles|ids|join|report>"); process.exit(2); }
const P = (...a) => join(W, ...a);
const readLines = f => readFileSync(f, "utf8").split("\n").filter(Boolean);
const json = f => JSON.parse(readFileSync(P(f), "utf8"));
const lines = async (path, fn) => { for await (const l of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) fn(l); };

/** The Vital Articles' own eleven domains; the lists name them slightly differently from page to page. */
const VITAL_DOMAIN = d => {
  const s = d.toLowerCase();
  if (s.startsWith("people")) return "People";
  if (s.startsWith("history")) return "History";
  if (s.startsWith("geography")) return "Geography";
  if (s.startsWith("art")) return "Arts";
  if (s.startsWith("philosophy")) return "Philosophy and religion";
  if (s.startsWith("everyday")) return "Everyday life";
  if (s.startsWith("society")) return "Society and social sciences";
  if (s.startsWith("biolog")) return "Biological and health sciences";
  if (s.startsWith("physical")) return "Physical sciences";
  if (s.startsWith("technology")) return "Technology";
  if (s.startsWith("math") || s.startsWith("measurement")) return "Mathematics";
  return null;
};

function vitalRows() {
  return readLines(P("vital/vital.tsv")).map(l => {
    const [title, level, domain, sub, page, d4] = l.split("\t");
    const deep = /Level \d\/([^/]+)/.exec(page);
    // level 4's page names the domain; a level-3 title is on level 4's pages too (the lists are cumulative), so it has one as well
    return { title: title.replace(/ /g, "_"), level: Number(level), domain: VITAL_DOMAIN(d4 || (deep ? deep[1] : domain)) || (/^health/i.test(domain) ? "Biological and health sciences" : null), sub };
  });
}

if (stage === "titles") {
  const kb = (await loadKb()).filter(r => r.cls === "thing");
  const all = new Set();
  for (const r of kb) for (const t of variantsOf(r)) all.add(t);
  for (const v of vitalRows()) all.add(v.title);
  readLines(P("views/en.tsv")).slice(0, 4000).forEach(l => { const t = l.split("\t")[0]; if (!t.includes(":") && t !== "Main_Page") all.add(t); });
  for (const r of TAUGHT_ROWS) all.add(r.title);
  writeFileSync(P("titles.txt"), [...all].join("\n") + "\n");
  console.log(all.size, "titles to resolve");
}

if (stage === "ids") {
  const rows = await loadKb();
  const res = json("resolved.json");
  const vital = new Map(vitalRows().map(v => [v.title, v]));
  const entries = new Map(); // final page id → { id, title, qid, vital, domain, kb: [row.i] }
  const entry = (r, why) => {
    let e = entries.get(r.id);
    if (!e) entries.set(r.id, e = { id: r.id, title: r.title, qid: r.qid, vital: null, domain: null, kb: [], from: new Set() });
    e.from.add(why);
    return e;
  };
  const kbStatus = {};
  for (const r of rows) {
    if (r.cls === "phrase") { kbStatus[r.i] = { status: "phrase" }; continue; }
    let found = null, ambiguous = false, via = -1;
    variantsOf(r).forEach((t, k) => { if (found) return; const x = res[t]; if (!x) return; if (x.dis || !x.qid) { ambiguous = ambiguous || !!x.dis; return; } found = x; via = k; });
    if (!found) { kbStatus[r.i] = { status: ambiguous ? "ambiguous" : "none" }; continue; }
    const e = entry(found, "kb"); e.kb.push(r.i);
    if (!e.domain && r.domain !== "Unplaced") e.domain = r.domain;
    kbStatus[r.i] = { status: "found", id: found.id, via };
  }
  for (const [t, v] of vital) {
    const x = res[t];
    if (!x || x.dis || !x.qid) continue;
    const e = entry(x, "vital");
    if (!e.vital || v.level < e.vital) { e.vital = v.level; e.domain = v.domain; }
  }
  for (const l of readLines(P("views/en.tsv")).slice(0, 4000)) {
    const x = res[l.split("\t")[0]];
    if (x && !x.dis && x.qid) entry(x, "read");
  }
  const taughtMiss = [];
  for (const r of TAUGHT_ROWS) {
    const x = res[r.title];
    if (!x || x.dis || !x.qid) { taughtMiss.push(r.title + (x?.dis ? " (disambiguation)" : "")); continue; }
    const e = entry(x, "taught");
    e.taught = [...new Set([...(e.taught || []), ...r.systems])];
  }
  if (taughtMiss.length) console.log("taught titles not found:", taughtMiss.join("; "));
  // Meta-Wiki's list names Wikidata items, not titles: find the English page of each; and the most translated pages join too
  // (ids only; their titles and items come from the tables)
  const meta = new Map(readLines(P("meta/meta.tsv")).map(l => { const [q, level, domain, section, label] = l.split("\t"); return [q, { level, domain, section, label }]; }));
  const top = json("top-langs.json").slice(0, 4000).map(([id]) => id);
  const need = new Set(top), pageOfQ = new Map();
  await lines(join(W, "props/qid.tsv"), l => { const t = l.indexOf("\t"); const q = "Q" + l.slice(t + 1); if (meta.has(q)) { const id = Number(l.slice(0, t)); pageOfQ.set(q, [...(pageOfQ.get(q) || []), id]); need.add(id); } });
  const titleOf = new Map(), qidOf = new Map();
  await lines(join(W, "index/ns0.tsv"), l => { const t = l.indexOf("\t"); const id = Number(l.slice(0, t)); if (need.has(id)) titleOf.set(id, l.slice(t + 1).replace(/ /g, "_")); });
  await lines(join(W, "props/qid.tsv"), l => { const t = l.indexOf("\t"); const id = Number(l.slice(0, t)); if (need.has(id)) qidOf.set(id, "Q" + l.slice(t + 1)); });
  const dis = new Set(); await lines(join(W, "props/disambig.txt"), l => { const i = Number(l); if (need.has(i)) dis.add(i); });
  const redirects = new Set(); await lines(join(W, "props/redirects.tsv"), l => { const i = Number(l.slice(0, l.indexOf("\t"))); if (need.has(i)) redirects.add(i); });
  const ok = id => titleOf.has(id) && qidOf.has(id) && !dis.has(id) && !redirects.has(id);
  for (const id of top) if (ok(id)) entry({ id, title: titleOf.get(id), qid: qidOf.get(id) }, "translated");
  let metaMissing = 0;
  for (const [q, m] of meta) {
    const id = (pageOfQ.get(q) || []).find(ok);
    if (id === undefined) { metaMissing++; continue; }
    const e = entry({ id, title: titleOf.get(id), qid: q }, "meta");
    if (!e.meta || (m.level === "M1" && e.meta.level === "M2")) e.meta = m;
  }
  console.log("Meta-Wiki items without an English article:", metaMissing, "of", meta.size);
  const list = [...entries.values()].map(e => ({ ...e, from: [...e.from] }));
  writeFileSync(P("universe.json"), JSON.stringify({ entries: list, kbStatus }));
  writeFileSync(P("ids.json"), JSON.stringify(list.map(e => e.id)));
  const by = k => list.filter(e => e.from.includes(k)).length;
  console.log(list.length, "pages in the universe: kb", by("kb"), "vital", by("vital"), "most read", by("read"), "most translated", by("translated"));
  const st = {}; for (const s of Object.values(kbStatus)) st[s.status] = (st[s.status] || 0) + 1;
  console.log("kb status:", JSON.stringify(st));
}

if (stage === "join") {
  const { entries, kbStatus } = json("universe.json");
  const langs = json("langs.json");
  const top = new Map(json("top-langs.json"));
  // each edition's readers: title → rank (1 = most read)
  const rank = {};
  for (const l of EDITIONS) { const m = new Map(); readLines(P(`views/${l}.tsv`)).forEach((x, i) => m.set(x.slice(0, x.indexOf("\t")), i + 1)); rank[l] = m; }
  const views = {};
  for (const l of EDITIONS) { const m = new Map(); readLines(P(`views/${l}.tsv`)).forEach(x => { const t = x.indexOf("\t"); m.set(x.slice(0, t), Number(x.slice(t + 1))); }); views[l] = m; }
  const out = [];
  for (const e of entries) {
    const g = langs[e.id] || { n: 0, t: {} };
    const languages = 1 + (g.n || top.get(e.id) || 0);
    const ranks = EDITIONS.map(l => rank[l].get(l === "en" ? e.title : g.t[l]) ?? null);
    const readers = EDITIONS.map(l => views[l].get(l === "en" ? e.title : g.t[l]) ?? 0);
    const metaLevel = e.meta?.level ?? null;
    const sc = score({ vital: e.vital, meta: metaLevel, languages, ranks });
    out.push({ ...e, languages, ranks, readers, ...sc, tier: tier({ vital: e.vital, meta: metaLevel, languages }, sc) });
  }
  writeFileSync(P("scored.json"), JSON.stringify({ editions: EDITIONS, scored: out, kbStatus }));
  const c = {}; for (const e of out) c[e.tier] = (c[e.tier] || 0) + 1;
  console.log(out.length, "scored;", JSON.stringify(c));
}

if (stage === "report") {
  const rows = await loadKb();
  const { LINKS } = await import(resolvePath(import.meta.dirname, "..", "kb/links.js"));
  const { editions, scored, kbStatus } = json("scored.json");
  const byId = new Map(scored.map(e => [e.id, e]));
  const dSum = new Map();
  for (const l of LINKS) if (l.rel === "clue" && typeof l.d === "number") { const a = dSum.get(l.from) || [0, 0]; a[0] += l.d; a[1]++; dSum.set(l.from, a); }
  const kbTier = r => { const s = kbStatus[r.i]; if (s.status !== "found") return s.status; return byId.get(s.id).tier; };
  const count = {}, byDomain = {};
  for (const r of rows) { const t = kbTier(r); count[t] = (count[t] || 0) + 1; (byDomain[r.domain] ||= {})[t] = ((byDomain[r.domain] || {})[t] || 0) + 1; }
  // calibration against the hand-written difficulty of clue words
  const xs = [], ys = [];
  for (const r of rows) { const d = dSum.get(r.id), s = kbStatus[r.i]; if (d && s.status === "found") { xs.push(byId.get(s.id).u); ys.push(d[0] / d[1]); } }
  const shown = r => { const s = kbStatus[r.i], e = s.status === "found" ? byId.get(s.id) : null; return { id: r.id, name: r.name, set: r.set, degree: r.degree, status: s.status === "found" ? kbTier(r) : s.status, title: e?.title, qid: e?.qid, u: e ? +e.u.toFixed(3) : null, languages: e?.languages, editions: e?.editions, vital: e?.vital ?? null }; };
  const scoredKb = rows.filter(r => kbStatus[r.i].status === "found");
  const rnd = (list, n, seed) => { let s = seed; const a = [...list]; for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  const kept = scoredKb.filter(r => ["core", "wide"].includes(kbTier(r)));
  const cut = rows.filter(r => ["thin", "none", "ambiguous"].includes(kbTier(r)));
  const border = scoredKb.filter(r => ["deep"].includes(kbTier(r)));
  const lowest = [...scoredKb].sort((a, b) => byId.get(kbStatus[a.i].id).u - byId.get(kbStatus[b.i].id).u || b.degree - a.degree).slice(0, 60).map(shown);
  const inKb = new Set(scoredKb.map(r => kbStatus[r.i].id));
  const lacking = scored.filter(e => !inKb.has(e.id)).sort((a, b) => b.u - a.u).slice(0, 60).map(e => ({ title: e.title, qid: e.qid, u: +e.u.toFixed(3), tier: e.tier, vital: e.vital, domain: e.domain, languages: e.languages, editions: e.editions, from: e.from }));
  // the education slice (history, three systems): how many named, how many by two or more, and where they stand on the other signals
  const taught = scored.filter(e => e.taught);
  const brief = e => ({ title: e.title, systems: e.taught.join(""), vital: e.vital, tier: e.tier, languages: e.languages, editions: e.editions, inKb: e.kb.length > 0 });
  const histL3 = scored.filter(e => e.vital && e.vital <= 3 && e.domain === "History");
  const taughtReport = {
    named: taught.length, byNumberOfSystems: [1, 2, 3].map(k => taught.filter(e => e.taught.length === k).length),
    inVital: { l3: taught.filter(e => e.vital && e.vital <= 3).length, l4: taught.filter(e => e.vital === 4).length, notVital: taught.filter(e => !e.vital).length },
    inKb: taught.filter(e => e.kb.length).length,
    tiers: taught.reduce((m, e) => (m[e.tier] = (m[e.tier] || 0) + 1, m), {}),
    twoOrMore: taught.filter(e => e.taught.length >= 2).map(brief),
    notVitalList: taught.filter(e => !e.vital).map(brief),
    historyL3: { n: histL3.length, named: histL3.filter(e => e.taught).length, unnamed: histL3.filter(e => !e.taught).map(e => e.title) },
  };
  const report = {
    taught: taughtReport,
    kbCounts: count, byDomain, calibration: { n: xs.length, spearman: +spearman(xs, ys).toFixed(3) },
    universe: scored.length, universeTiers: scored.reduce((m, e) => (m[e.tier] = (m[e.tier] || 0) + 1, m), {}),
    lowest, lacking, kept: rnd(kept, 100, 1).map(shown), cut: rnd(cut, 100, 2).map(shown), borderline: rnd(border, 100, 3).map(shown),
  };
  writeFileSync(P("report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ kbCounts: count, calibration: report.calibration, universe: report.universe, universeTiers: report.universeTiers }, null, 1));
}
