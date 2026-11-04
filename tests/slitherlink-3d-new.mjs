// Circuit's chart after a solve: starting another puzzle takes the last one's island (land, town, flag, cog, sea) away and frees
// its geometry. Needs a browser with WebGL (Playwright); without one it says so and passes.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { generate } from "../slitherlink-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
let pw = null;
try { pw = createRequire(import.meta.url)("playwright"); } catch { /* none here */ }
if (!pw) { console.log("ok   no browser here: skipped"); process.exit(0); }
const root = path.resolve(new URL("..", import.meta.url).pathname);
const types = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".mjs": "text/javascript" };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); } });
});
await new Promise(ok => srv.listen(0, ok));
const mk = (seed, size) => { const pz = generate(seed, size, "easy", false); return { grid: pz.grid, sol: pz.sol }; };
const A = mk(21, 5), B = mk(22, 7);
let browser;
try {
  browser = await pw.chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 664 } });
  await page.goto(`http://localhost:${srv.address().port}/slitherlink.html`);
  const out = await page.evaluate(async ({ A, B }) => {
    const { createChart } = await import("./slitherlink-3d.js");
    const { puzzleOf } = await import("./slitherlink-engine.js");
    const mkHost = () => { const h = document.createElement("div"); h.style.cssText = "width:300px;height:300px;position:fixed;left:0;top:0"; document.body.append(h); return h; };
    const mkP = (size, X) => { const P = puzzleOf(size, X.grid); return { g: P.g, clue: P.clue }; };
    const st = (X, solved) => ({ marks: solved ? X.sol : X.sol.replace(/./g, "?"), over: new Set(), met: new Set(), wrong: new Set(), bad: new Set(), lit: new Set(), why: [-1, -1], vertex: -1, solved });
    const fresh = createChart(mkHost()); fresh.show(true); fresh.set(mkP(7, B)); fresh.update(st(B, false));
    const base = { ...fresh.live };
    const chart = createChart(mkHost()); chart.show(true);
    chart.set(mkP(5, A)); chart.update(st(A, false)); chart.update(st(A, true)); chart.solveAt(100);
    const during = { ...chart.live };
    chart.set(mkP(7, B)); chart.update(st(B, false));
    return { during, after: { ...chart.live }, base };
  }, { A, B });
  check(out.during.island, "a solved chart holds its island");
  check(!out.after.island && !out.after.solving && out.after.sea === 0, "a new puzzle leaves no island, no solve running and no deep sea");
  check(out.after.geometries <= out.base.geometries + 2, `its geometry is freed (${out.after.geometries} against ${out.base.geometries} for a chart that never solved)`);
} finally { await browser?.close(); srv.close(); }
process.exit(bad ? 1 : 0);
