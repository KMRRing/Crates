// Draws Codex's app icon: the 3D scene (scene.js) rendered once, the disc laid on a navy square, written as icon.png (180,
// the iPhone's), icons/icon-192.png, icons/icon-512.png and icons/icon-maskable-512.png. The disc fills 79% of the
// square, inside the 80% circle a maskable icon keeps clear, so one picture serves all three.
//   cd tools/mark-3d && npm i --no-save three@0.170.0 && NODE_PATH=$(npm root -g) node render.mjs     (Playwright installed globally)
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");   // the globally installed one (its browser is there); NODE_PATH finds it

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "../..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = createServer((req, res) => {
  try { const f = join(here, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html")); res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const port = server.address().port;

// software WebGL: slow, but the same picture anywhere
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-gl=angle"] });
const SIZE = 1536;
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
page.on("pageerror", e => { throw e; });
await page.goto(`http://localhost:${port}/index.html?size=${SIZE}&bg=none`);
await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
await page.evaluate(() => window.setT(0));
const disc = (await page.screenshot({ omitBackground: true })).toString("base64");

// the disc on the navy square (a light from the top left, a darker edge), with a soft shadow under it
const sheet = await browser.newPage({ deviceScaleFactor: 1 });
async function icon(size, file) {
  await sheet.setViewportSize({ width: size, height: size });
  await sheet.setContent(`<body style="margin:0;width:${size}px;height:${size}px;background:radial-gradient(120% 120% at 32% 26%, #2A4256 0%, #1C2A34 48%, #0E1820 100%)">
    <img src="data:image/png;base64,${disc}" style="width:${size}px;height:${size}px;display:block;filter:drop-shadow(0 ${size * .012}px ${size * .02}px rgba(0,0,0,.55))"></body>`);
  await sheet.waitForFunction(() => document.images[0].complete);
  writeFileSync(join(root, file), await sheet.screenshot());
}
await icon(180, "icon.png"); await icon(192, "icons/icon-192.png"); await icon(512, "icons/icon-512.png"); await icon(512, "icons/icon-maskable-512.png");
await browser.close(); server.close();
console.log("icons written");
