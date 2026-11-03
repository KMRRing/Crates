// Almanac's star chart: the sky is laid out the same on every device, every thing in kb/ has a place in it and subjects keep
// to their own regions; a star burns brighter the better it is learned; the camera maps the sky to the screen and a tap finds
// its star; and every file the page loads is there. Pure modules only: nothing here opens WebGL.
import fs from "fs";
import path from "path";
import { ENTITIES } from "../kb/entities.js";
import { LINKS } from "../kb/links.js";
import { SUBJECTS } from "../topics.js";
import { seeded, relax } from "../almanac-sky-force.js";
import { buildLayout, RADIUS } from "../almanac-sky-build.mjs";
import { LAYOUT } from "../almanac-sky-layout.js";
import { decode, place, jitter } from "../almanac-sky-place.js";
import { SUBJECT_IDS, COLOURS, subjectsOf } from "../almanac-sky-subjects.js";
import { buildSky, regionMiddles, MAX_LINES, MAX_LENGTH } from "../almanac-sky-data.js";
import { LEVEL, LEARNED, gradeOf, glowOf, encodeGlow, decodeGlow, summary } from "../almanac-sky-learn.js";
import * as C from "../almanac-sky-camera.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const root = new URL("..", import.meta.url).pathname;

// ---------- the layout: deterministic ----------
{
  const r = seeded(7), n = 300, start = new Float64Array(3 * n), anchor = new Float64Array(3 * n), pull = new Float64Array(n).fill(0.04);
  for (let i = 0; i < 3 * n; i++) { start[i] = 0; anchor[i] = ((i / 3 | 0) % 2 ? 1 : -1) * 20 * (i % 3 === 0 ? 1 : 0); }
  const edges = []; for (let i = 1; i < n; i++) edges.push([i, Math.floor(r() * i), 0.6]);   // everything starts in one spot: only the seed says which way each goes
  const run = seed => relax({ n, edges, start, anchor, pull, steps: 60, seed });
  const a = run(3), b = run(3), c = run(4);
  check(a.every((v, i) => v === b[i]), "relaxing the same graph with the same seed gives the same positions to the last bit");
  check(a.some((v, i) => v !== c[i]), "…and another seed gives another sky");
  check(a.every(Number.isFinite), "relaxing never gives a position that isn't a number");
  check(jitter("copper", 1) === jitter("copper", 1) && jitter("copper", 1) !== jitter("copper", 2) && jitter("zinc", 1) >= 0 && jitter("zinc", 1) < 1,
    "a newcomer's jitter is a fixed float in [0, 1) per thing");
}
{
  // a slice of kb/ (every 9th thing and the links between them): laid out twice, the same
  const keep = new Set(ENTITIES.filter((e, i) => i % 9 === 0 && !e.same).map(e => e.id));
  const ents = ENTITIES.filter(e => keep.has(e.id)), links = LINKS.filter(l => keep.has(l.from) && keep.has(l.to));
  const t0 = Date.now(), one = buildLayout(ents, links), two = buildLayout(ents, links);
  check(one.xyz.length === 3 * ents.length && one.ids.length === ents.length, `a slice of ${ents.length} things is all laid out (${Date.now() - t0} ms for two)`);
  check(one.xyz.every((v, i) => v === two.xyz[i]) && one.ids.join("\n") === two.ids.join("\n"), "laying out the same kb/ twice gives the same sky, to the last bit");
  check(Array.from(one.xyz).every(Number.isFinite) && Array.from(one.xyz).every(v => Math.abs(v) <= RADIUS * 1.6), "every laid-out place is a number inside the sky");
}

// ---------- the layout kept in the repository ----------
const stars = ENTITIES.filter(e => !e.same);
const stored = decode(LAYOUT);
{
  const have = stars.filter(e => stored.has(e.id)).length;
  check(have >= stars.length * 0.95,
    `the stored layout places ${have} of ${stars.length} things (at least 95%: run \`node almanac-sky-build.mjs\` when kb/ has grown)`);
  check([...stored.values()].every(p => p.every(Number.isFinite) && Math.hypot(...p) <= RADIUS * 1.5), "every stored place is inside the sky");
  const ids = new Set(); let dup = 0; for (const id of LAYOUT.ids.split("\n")) { if (ids.has(id)) dup++; ids.add(id); }
  check(!dup && ids.size === stored.size, "the stored layout has each thing once");
}

// ---------- the sky: every thing is a star, subjects keep to their regions ----------
const sky = buildSky(ENTITIES, LINKS, LAYOUT);
{
  check(sky.n === stars.length && sky.xyz.length === 3 * sky.n && sky.xyz.every(Number.isFinite), `every thing that isn't a copy is a star with a place (${sky.n})`);
  check(ENTITIES.every(e => sky.rowOf.has(e.id) || (e.same && !sky.rowOf.has(e.same))), "every id in kb/ finds its star, a copy finding its original's");
  check(sky.subjects.every(s => s.length >= 1 && s.length <= 3 && s.every(k => k >= 0 && k < SUBJECT_IDS.length)), "every star has one to three subjects, each a real one");
  check(SUBJECT_IDS.length === SUBJECTS.length && SUBJECT_IDS.every(id => /^#[0-9a-f]{6}$/i.test(COLOURS[id] || "")), "each of Settings' subjects has a colour");
  check(sky.lines.length % 2 === 0 && sky.lines.length / 2 <= MAX_LINES && sky.lines.every(r => r >= 0 && r < sky.n), `the chart is ${sky.lines.length / 2} lines, within ${MAX_LINES}`);
  let longest = 0;
  for (let k = 0; k < sky.lines.length; k += 2) {
    const a = sky.lines[k], b = sky.lines[k + 1];
    longest = Math.max(longest, Math.hypot(sky.xyz[3 * a] - sky.xyz[3 * b], sky.xyz[3 * a + 1] - sky.xyz[3 * b + 1], sky.xyz[3 * a + 2] - sky.xyz[3 * b + 2]));
  }
  check(longest <= MAX_LENGTH + 1e-3, `no chart line crosses between regions (longest ${longest.toFixed(1)}, limit ${MAX_LENGTH})`);
  check(sky.size.every(s => s >= 2.6 - 1e-4 && s <= 8.0 + 1e-4) && sky.weight.every(w => w >= 0 && w <= 1), "star sizes stay between 2.6 and 8 pixels");

  // regions: a star lies nearer to the middle of its own subject than the typical star lies to another subject's middle
  const mids = regionMiddles(sky, SUBJECT_IDS.length), live = mids.map((m, k) => (m && m[3] >= 20 ? k : -1)).filter(k => k >= 0);
  let own = 0, all = 0, ownD = 0, otherD = 0, otherN = 0;
  for (let r = 0; r < sky.n; r++) {
    const s = sky.subjects[r][0];
    if (!live.includes(s)) continue;
    let best = -1, bd = Infinity;
    for (const k of live) {
      const m = mids[k], d = Math.hypot(sky.xyz[3 * r] - m[0], sky.xyz[3 * r + 1] - m[1], sky.xyz[3 * r + 2] - m[2]);
      if (d < bd) { bd = d; best = k; }
      if (k === s) ownD += d; else { otherD += d; otherN++; }
    }
    all++; if (best === s) own++;
  }
  check(own / all > 0.7, `most stars (${Math.round(100 * own / all)}%) lie nearer their own subject's middle than any other's`);
  check(ownD / all < 0.5 * (otherD / otherN), `a star is ${(ownD / all).toFixed(0)} from its own subject's middle, ${(otherD / otherN).toFixed(0)} from the others'`);
  check(live.length >= 15, `${live.length} subjects have a region of their own`);
}

// ---------- a thing kb/ gained since the layout was made is still placed ----------
{
  const extra = [{ id: "zz-new-1", name: "New one", sets: ["country"] }, { id: "zz-new-2", name: "New two", sets: ["country"] }, { id: "zz-lone", name: "Lone", sets: [] }];
  const ents = [...ENTITIES, ...extra], some = ENTITIES.find(e => !e.same && stored.has(e.id));
  const links = [...LINKS, { from: "zz-new-1", to: some.id }];
  const subj = subjectsOf(ents, links), made = place(ents, links, subj.map(s => s[0]), LAYOUT), again = place(ents, links, subj.map(s => s[0]), LAYOUT);
  const at = id => { const r = made.stars.findIndex(i => ents[i].id === id); return [0, 1, 2].map(k => made.xyz[3 * r + k]); };
  const home = stored.get(some.id), first = at("zz-new-1");
  check(made.stars.length === stars.length + extra.length && made.xyz.every(Number.isFinite), "newcomers are stars with places too");
  check(Math.hypot(first[0] - home[0], first[1] - home[1], first[2] - home[2]) < 8, "a newcomer with a neighbour is put beside it");
  check(made.xyz.every((v, i) => v === again.xyz[i]), "newcomers are put in the same place on every device");
}

// ---------- the glow ----------
{
  const item = (pile, o = {}) => ({ id: `i${Math.random()}`, pile, about: ["a"], due: Date.now() + 1e9, ...o });
  const levels = [0, 1, 2, 3, 4, 5].map(p => gradeOf(item(p)));
  check(levels.every((v, i) => i === 0 || v > levels[i - 1]) && levels[0] > 0.1 && levels[5] < LEARNED, "the longer a thing is kept (the higher its pile), the brighter it burns, up to learned");
  check(gradeOf(item(2, { learned: Date.now() })) === LEARNED && gradeOf(item(undefined)) === LEVEL[0] && gradeOf(item(99)) === LEVEL[5] && gradeOf(item(-3)) === LEVEL[0],
    "a learned thing burns at full; a pile out of range is the nearest one");
  const now = 1e12, g = glowOf([item(1, { about: ["x", "y"] }), item(4, { about: ["x"] }), item(0, { about: ["z"], due: now - 5 }), item(3, { about: ["w"], due: now - 5 }),
    item(0, { about: ["l"], due: null, learned: now - 9 }), item(0, { about: ["gone", 7, null] })], { now, known: id => id !== "gone" });
  check(near(g.get("x").lit, LEVEL[4]) && near(g.get("y").lit, LEVEL[1]), "a thing burns as brightly as its best item");
  check(g.get("z").twinkle && !g.get("w").twinkle && !g.get("x").twinkle && !g.get("l").twinkle, "only a thing that is due, and not yet in a long pile or learned, twinkles");
  check(g.get("l").lit === LEARNED && !g.has("gone") && g.size === 5, "learned things burn at full; things kb/ doesn't know and junk in `about` are left out");
  check(glowOf([]).size === 0 && glowOf([null, {}, { about: "a" }]).size === 0, "a pile with nothing in it lights nothing: the sky is dim, and says why");
  const canon = glowOf([item(2, { about: ["copy"] })], { canon: id => (id === "copy" ? "orig" : id) });
  check(canon.has("orig") && !canon.has("copy"), "a copy's item lights its original's star");
  const back = decodeGlow(encodeGlow(g));
  check([...g].every(([id, v]) => back.get(id) && near(back.get(id).lit, v.lit, 0.006) && back.get(id).twinkle === v.twinkle), "a glow kept for a partner reads back the same");
  check(decodeGlow(null).size === 0 && decodeGlow("x").size === 0 && decodeGlow({ a: "no", b: 0, c: NaN }).size === 0, "a damaged kept glow reads as an empty one");
  const s = summary(g);
  check(s.lit === 5 && s.learned === 1 && s.twinkling === 1, "the sky's line counts what burns, what is learned and what twinkles");
}

// ---------- the camera ----------
{
  const W = 390, H = 664, cam = { yaw: 0.7, pitch: 0.3, dist: 80, at: [5, -3, 10] }, vp = C.viewProjection(cam, W / H);
  const mid = C.project(vp, 5, -3, 10, W, H);
  check(near(mid[0], W / 2, 1e-3) && near(mid[1], H / 2, 1e-3) && near(mid[2], 80, 1e-3), "the camera's target is in the middle of the screen, `dist` in front");
  const eyeAt = C.eye(cam), behind = C.project(vp, eyeAt[0] * 2 - 5, eyeAt[1] * 2 + 3, eyeAt[2] * 2 - 10, W, H);
  check(behind[2] < 0 && Number.isNaN(behind[0]), "a point behind the camera has a negative depth and no place on screen");
  const up = C.project(vp, 5, 3, 10, W, H);
  check(up[1] < mid[1], "up in the sky is up on the screen");
  const o = C.orbit(cam, 40, 20, H), back = C.orbit(o, -40, -20, H);
  check(o.yaw !== cam.yaw && near(back.yaw, cam.yaw) && near(back.pitch, cam.pitch), "a drag turns the camera and the opposite drag turns it back");
  check(C.orbit(cam, 0, 1e6, H).pitch <= C.MAX_PITCH + 1e-9 && C.orbit(cam, 0, -1e6, H).pitch >= -C.MAX_PITCH - 1e-9, "the camera cannot flip over the poles");
  check(C.zoom(cam, 1e-6).dist === C.MIN_DIST && C.zoom(cam, 1e6).dist === C.MAX_DIST && C.zoom(cam, 0.5).dist === 40, "zooming keeps the camera between its nearest and furthest");
  const bad1 = C.cleanCamera({ yaw: NaN, pitch: "x", dist: -4, at: [1, "a"] });
  check([bad1.yaw, bad1.pitch, bad1.dist, ...bad1.at].every(Number.isFinite) && bad1.at.length === 3 && bad1.dist >= C.MIN_DIST, "a damaged saved camera becomes a good one");
  const p = C.pan(cam, 30, 0, H), moved = Math.hypot(p.at[0] - cam.at[0], p.at[1] - cam.at[1], p.at[2] - cam.at[2]);
  const e = C.eye(cam), ahead = [0, 1, 2].map(k => (cam.at[k] - e[k]) / cam.dist), slide = [0, 1, 2].map(k => p.at[k] - cam.at[k]);
  check(moved > 0 && near(slide[0] * ahead[0] + slide[1] * ahead[1] + slide[2] * ahead[2], 0, 1e-5) && p.dist === cam.dist,
    "a two-finger drag slides the target across the screen, not toward or away from it");
  // picking: a star under the finger is the one found, behind the camera or switched off is not
  const pts = new Float32Array([5, -3, 10, 5 + 8, -3, 10, 5, 4, 10]);
  const hit = C.project(vp, pts[3], pts[4], pts[5], W, H);
  check(C.pick(vp, pts, W, H, hit[0] + 3, hit[1] - 2) === 1 && C.pick(vp, pts, W, H, 5, 5) === -1, "a tap within reach finds its star; a tap on empty sky finds none");
  check(C.pick(vp, pts, W, H, hit[0], hit[1], 22, null, i => i !== 1) === -1, "a star switched off cannot be tapped");
  const pair = new Float32Array([5.5, -3, 10, 5.8, -3, 10]);       // the smaller one a little nearer the finger
  check(C.pick(vp, pair, W, H, W / 2, H / 2, 22, [0.1, 0.9]) === 1 && C.pick(vp, pair, W, H, W / 2, H / 2, 22) === 0, "of two stars under a finger the bigger one is taken");
  // the whole sky fits on the screen it is first shown on, wide and tall
  for (const [w, h] of [[390, 664], [390, 844], [820, 1180], [1180, 820]]) {
    const fit = { yaw: 0.6, pitch: 0.3, dist: C.fitDistance(w / h), at: [0, 0, 0] }, v = C.viewProjection(fit, w / h);
    let out = 0;
    for (let r = 0; r < sky.n; r++) {
      const q = C.project(v, sky.xyz[3 * r], sky.xyz[3 * r + 1], sky.xyz[3 * r + 2], w, h);
      if (!(q[0] >= -w * 0.05 && q[0] <= w * 1.05 && q[1] >= -h * 0.05 && q[1] <= h * 1.05)) out++;
    }
    check(out / sky.n < 0.01, `the whole sky is in view at ${w}×${h} (${out} stars outside)`);
  }
  // a flight ends exactly where it was sent, the short way round
  const to = { yaw: cam.yaw + 2 * Math.PI - 0.2, pitch: 0.1, dist: C.NEAR_STAR, at: [20, 0, 0] }, fl = C.flight(cam, to, 500);
  let last = null, k = 0;
  for (; k < 100; k++) { const s = C.step(fl, 50); last = s.cam; if (s.done) break; }
  check(k >= 9 && k <= 10 && near(last.dist, C.NEAR_STAR, 1e-6) && near(last.at[0], 20, 1e-6) && Math.abs(fl.to.yaw - fl.from.yaw) < Math.PI + 1e-9, "a flight takes its time, ends on its target and turns the short way");
}

// ---------- every file the page loads is there ----------
{
  const read = f => fs.readFileSync(root + f, "utf8"), exists = f => fs.existsSync(root + f);
  const missing = [];
  const need = (from, ref) => { if (!/^(https?:|data:|#|mailto:)/.test(ref)) { const p = ref.split(/[?#]/)[0]; if (p && !exists(path.posix.normalize(path.posix.join(path.posix.dirname(from), p)))) missing.push(`${from} → ${ref}`); } };
  const html = read("almanac.html");
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) need("almanac.html", m[1]);
  const mods = ["almanac.js", ...fs.readdirSync(root).filter(f => /^almanac-sky.*\.m?js$/.test(f))];
  for (const f of mods) {
    const src = read(f);
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["'](\.[^"']+)["']/g)) need(f, m[1]);
  }
  check(!missing.length, `every file the Almanac page and its star chart import is there${missing.length ? `: missing ${missing.join(", ")}` : ` (${mods.length} scripts, almanac.html)`}`);
  // the elements the sky is handed are in the page
  const ids = ["sky", "skyStage", "skyGL", "skyInk", "skyHint", "skyMsg", "skySubjects", "skyHome", "skyPanel", "skyHits", "skyLegend", "skyCard", "modeList", "modeSky", "q", "results", "entry"];
  const gone = ids.filter(id => !new RegExp(`id="${id}"`).test(html));
  check(!gone.length, `the page has every element the chart is wired to${gone.length ? `: missing ${gone.join(", ")}` : ""}`);
  check(read("almanac.js").includes('import("./almanac-sky.js")') && !/^import .*almanac-sky/m.test(read("almanac.js")), "the list opens without loading the chart (it is loaded when asked for)");

  // what the chart keeps is Almanac's own, and nothing in it is a browser pop-up or a filter
  const sk = read("almanac-sky.js"), keys = [...sk.matchAll(/["'`](lexicon:[\w:]+)["'`]/g)].map(m => m[1]);
  check(keys.length >= 2 && keys.every(k => k.startsWith("lexicon:sky")), `the chart's saved state is under lexicon:sky (${[...new Set(keys)].join(", ")})`);
  const all = mods.map(read).join("\n") + read("almanac.css");
  check(!/\b(?:alert|confirm|prompt)\s*\(/.test(all), "no browser pop-ups");
  check(!/<filter|filter\s*:\s*url|feGaussian/.test(all + html), "no SVG filters");
  check(!/\bthree\b/i.test(mods.map(f => read(f).split("\n").filter(l => /^import/.test(l)).join("\n")).join("\n")), "the chart draws with raw WebGL: no three.js");
  const gl = read("almanac-sky-gl.js");
  check(/Math\.min\(\s*window\.devicePixelRatio[^,]*,\s*2\s*\)/.test(gl), "the pixel ratio is capped at 2");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("almanac sky: laid out the same everywhere, every thing placed, subjects apart, the glow follows the pile, the camera and every file are right");
