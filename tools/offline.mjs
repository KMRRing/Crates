// What the app needs offline. Every page and everything it loads is kept on the device by sw.js (tools/build-sw.mjs
// writes it with this list), so the whole app opens from the home screen with no connection. Origin, Arb, Lexicon
// and Order once read the knowledge base straight from kb/, which the list left out, so they never opened offline.
//
// The list is the pages and everything they reach, found by reading them (scripts, styles, imports, workers, fetches,
// any string naming one of the app's files, the manifest's icons), plus what the games load by paths they build as
// they run: every knowledge bank (Punt and Deck pick theirs by level) and Rush's puzzle bands. tests/offline.mjs
// checks a page reaches nothing missing, and fails on any new path built at run time until it's accounted for.
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export const ROOT = new URL("..", import.meta.url).pathname;

/** Never kept: the tests, the tools and the workflow, and the service worker itself (the browser fetches it). */
const NEVER = f => /^(?:tests|tools|\.github)\//.test(f) || f === "sw.js";
/** The kinds of file a page loads. */
const LOADED = /\.(?:html|m?js|css|webmanifest|json|txt|woff2?|ttf|otf|png|svg|jpe?g|webp|gif|ico|mp3|ogg|wav|glb)$/i;
/** Files that refer to nothing. */
const LEAF = /\.(?:json|txt|woff2?|ttf|otf|png|jpe?g|webp|gif|ico|mp3|ogg|wav|glb)$/i;
/** A reference that leaves the app: a scheme (https:, data:, blob:, mailto:…), another host (//…), or a fragment. */
const AWAY = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** The pages: every .html at the top. */
export const pages = (root = ROOT) => fs.readdirSync(root).filter(f => f.endsWith(".html")).sort();

/**
 * JavaScript read just far enough to tell code from words: `code` is the source with its comments blanked, `masked`
 * that with the insides of its strings, templates and regular expressions blanked too, and `strings` where each
 * plain string literal starts (all three line up with the source, character for character).
 */
export function lexed(src) {
  const n = src.length, code = src.split(""), masked = src.split(""), strings = [];
  const blank = (a, b, both) => { for (let k = a; k < b; k++) if (src[k] !== "\n") { masked[k] = " "; if (both) code[k] = " "; } };
  const stack = [];            // open template literals, each with the depth of braces its ${ … } is at
  let depth = 0, last = -1;    // last: where the last character of code was (to tell a regular expression from division)
  const regexHere = () => {
    if (last < 0) return true;
    if (/[(,=:[!&|?{};+\-*%<>~^]/.test(src[last])) return true;
    let s = last; while (s >= 0 && /[\w$]/.test(src[s])) s--;
    return /^(?:return|typeof|case|in|of|delete|void|throw|yield|await|else|do|new)$/.test(src.slice(s + 1, last + 1));
  };
  /** A template literal's text from i (just past its backtick or a closing brace): to its end, or into a ${. */
  const template = i => {
    const start = i;
    for (; i < n; i++) {
      if (src[i] === "\\") { i++; continue; }
      if (src[i] === "`") { blank(start, i); last = i; return i + 1; }
      if (src[i] === "$" && src[i + 1] === "{") { blank(start, i); stack.push(depth); depth++; last = i + 1; return i + 2; }
    }
    blank(start, n); return n;
  };
  let i = 0;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "*") { const end = src.indexOf("*/", i + 2), to = end < 0 ? n : end + 2; blank(i, to, true); i = to; continue; }
    if (c === "/" && d === "/") { const end = src.indexOf("\n", i), to = end < 0 ? n : end; blank(i, to, true); i = to; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") { if (src[j] === "\\") j++; j++; }
      strings.push(i); blank(i + 1, j); last = j; i = j + 1; continue;
    }
    if (c === "`") { i = template(i + 1); continue; }
    if (c === "/" && regexHere()) {
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== "\n" && (inClass || src[j] !== "/")) { if (src[j] === "\\") j++; else if (src[j] === "[") inClass = true; else if (src[j] === "]") inClass = false; j++; }
      blank(i + 1, j); last = j; i = j + 1; continue;
    }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (stack.length && depth === stack[stack.length - 1]) { stack.pop(); i = template(i + 1); continue; } }
    if (!/\s/.test(c)) last = i;
    i++;
  }
  return { code: code.join(""), masked: masked.join(""), strings };
}

/**
 * What a file refers to: `own`, paths taken from the file's own folder (imports, workers, a stylesheet's url()s, a
 * page's tags); `page`, paths a script hands the page (a fetch, a script or stylesheet it adds, a bank it names),
 * which the browser takes from the page's folder; `built`, each load whose path is made as the code runs (the call
 * and the start of its argument), which reading can't follow.
 */
export function refsOf(file, src) {
  const own = new Set(), page = new Set(), built = [];
  const take = (set, u) => {
    try { u = decodeURI(String(u)); } catch { /* left as written */ }
    u = u.trim().split(/[?#]/)[0];
    if (u && !AWAY.test(u) && u !== "./" && u !== ".") set.add(u);
  };
  const js = text => {
    const { code, masked, strings } = lexed(text);
    /** The string literal starting at `at`, and where it ends; null if there's none there. */
    const literal = at => { const q = code[at]; if (q !== '"' && q !== "'") return null; const end = code.indexOf(q, at + 1); return end < 0 ? null : { s: code.slice(at + 1, end), end }; };
    const after = at => { while (/\s/.test(code[at] || "")) at++; return at; };
    for (const m of masked.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*(?=["'])/g)) take(own, literal(m.index + m[0].length)?.s ?? "");
    for (const m of masked.matchAll(/\bimport\s*(?=["'])/g)) take(own, literal(m.index + m[0].length)?.s ?? "");
    for (const m of masked.matchAll(/\b(import|fetch|importScripts|new (?:Shared)?Worker)\s*\(/g)) {
      const at = after(m.index + m[0].length), lit = literal(at), rest = code.slice(at, at + 80).split("\n")[0];
      if (m[1] === "import" && code[at] === ")") continue;                       // import() with nothing in it
      if (lit && /^\s*[,)]/.test(code.slice(lit.end + 1, lit.end + 20))) take(m[1] === "fetch" || m[1] === "importScripts" ? page : own, lit.s);
      else if (!/^new URL\(\s*["'][^"']+["']\s*,\s*import\.meta\.url/.test(rest)) built.push(`${m[1]}(${rest}`);
    }
    for (const m of masked.matchAll(/new URL\(\s*/g)) {                         // new URL("./x.js", import.meta.url)
      const lit = literal(m.index + m[0].length);
      if (lit && /^\s*,\s*import\.meta\.url/.test(code.slice(lit.end + 1, lit.end + 40))) take(own, lit.s);
    }
    // a script or picture given its address by the code: a string is followed like any other, anything else flagged
    for (const m of masked.matchAll(/([\w$.]*)\.src\s*=(?!=)/g)) {
      const at = after(m.index + m[0].length);
      if (!literal(at)) built.push(`${m[1]}.src = ${code.slice(at, at + 60).split(/[;\n]/)[0]}`);
    }
    // any string that names one of the app's files: a script or stylesheet added by hand, a bank chosen by level
    for (const at of strings) { const s = literal(at)?.s; if (s && /^(?:\.{1,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*$/.test(s) && LOADED.test(s)) take(page, s); }
  };
  const css = text => {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\(\s*(["'])data:[\s\S]*?\1\s*\)/g, "");
    for (const m of code.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) take(own, m[2]);
    for (const m of code.matchAll(/@import\s+(["'])([^"']+)\1/g)) take(own, m[2]);
  };
  if (file.endsWith(".html")) {
    const html = src.replace(/<!--[\s\S]*?-->/g, "");
    for (const m of html.matchAll(/\s(?:src|href|poster|data)\s*=\s*(["'])([^"']+)\1/g)) take(own, m[2]);
    for (const m of html.matchAll(/\ssrcset\s*=\s*(["'])([^"']+)\1/g)) for (const part of m[2].split(",")) take(own, part.trim().split(/\s+/)[0]);
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) js(m[1]);
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) css(m[1]);
    for (const m of html.matchAll(/\sstyle\s*=\s*"([^"]*)"/g)) css(m[1]);
  } else if (/\.m?js$/.test(file)) js(src);
  else if (file.endsWith(".css")) css(src);
  else if (file.endsWith(".webmanifest")) {
    const m = JSON.parse(src);
    for (const x of [...(m.icons || []), ...(m.screenshots || []), ...(m.shortcuts || []).flatMap(s => s.icons || [])]) take(own, x.src);
  }
  return { own: [...own], page: [...page], built };
}

/**
 * Every file the pages reach, each with the first file that reached it; references to files that aren't there; and
 * every load built at run time, by file. A library's own run-time loads (three.js's loaders) aren't counted: the app
 * doesn't use them.
 */
export function reach(root = ROOT) {
  const reached = new Map(), missing = [], built = [], queue = [];
  const exists = f => fs.existsSync(root + f) && !fs.statSync(root + f).isDirectory();
  const visit = (file, from) => {
    if (reached.has(file) || NEVER(file)) return;
    if (!exists(file)) { if (from) missing.push({ file, from }); return; }
    reached.set(file, from);
    queue.push(file);
  };
  for (const p of pages(root)) visit(p, null);
  while (queue.length) {
    const file = queue.shift();
    if (!LOADED.test(file) || LEAF.test(file)) continue;
    const refs = refsOf(file, fs.readFileSync(root + file, "utf8"));
    if (!file.startsWith("vendor/")) for (const load of refs.built) built.push({ file, load });
    const dir = path.posix.dirname(file);
    for (const u of refs.own) visit(path.posix.normalize(path.posix.join(dir, u)), file);
    // a path a script hands the page is taken from the page's folder (the top); a string naming no file there is
    // only words ("built from kb/"), not a load, so it isn't missing
    for (const u of refs.page) {
      const top = path.posix.normalize(u);
      if (!top.startsWith("..") && exists(top)) visit(top, file);
    }
  }
  return { reached, missing, built };
}

/**
 * Every file kept offline, sorted: the pages and all they reach; every knowledge bank and every puzzle band (loaded
 * by paths built at run time); the fonts and icons; and every other file of the app's own kinds outside the source,
 * the tests and the tools, so a file loaded some way no reading finds is still there.
 */
export function offlineFiles(root = ROOT) {
  const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const ship = /\.(?:html|js|css|webmanifest|woff2|png|svg)$/;
  const files = new Set(reach(root).reached.keys());
  for (const f of tracked) if (!NEVER(f) && !f.startsWith("kb/") && (ship.test(f) || f.startsWith("puzzles/"))) files.add(f);
  for (const dir of ["fonts", "icons"]) for (const f of fs.readdirSync(root + dir)) files.add(`${dir}/${f}`);
  return [...files].filter(f => fs.existsSync(root + f) && !fs.statSync(root + f).isDirectory()).sort();
}
