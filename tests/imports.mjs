// Every named import between the suite's own modules names something the module it comes from exports. A page whose
// import names something its module doesn't export never starts (the browser refuses the whole module graph), and the
// other tests, which load the games' logic but not their pages, can't see it: Punt sat on its loading screen when
// flags.js was rewritten as something else. Static: the import and export statements of every file, read as text.
import fs from "fs";
import { execSync } from "child_process";

const root = new URL("..", import.meta.url).pathname;
const files = execSync("git ls-files '*.js'", { cwd: root, encoding: "utf8" }).split("\n")
  .filter(f => f && !f.startsWith("tests/") && !f.startsWith("tools/") && !f.startsWith("vendor/") && f !== "sw.js" && fs.existsSync(root + f));
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");   // comments out (not URLs)
/** The names a const/let/var statement declares, from just after the keyword: every declarator, not just the first
 *  ("export const A = 1, B = [2, 3], C = f(4, 5)" declares A, B and C), commas inside brackets and strings skipped. */
function declared(src, i) {
  const out = [];
  let depth = 0, expect = true;
  for (; i < src.length; i++) {
    const c = src[i];
    if (expect && depth === 0) {
      const m = /^\s*([A-Za-z_$][\w$]*)/.exec(src.slice(i, i + 80));
      if (m) { out.push(m[1]); i += m[0].length - 1; expect = false; continue; }
      if (/^\s*[{[]/.test(src.slice(i, i + 4))) { expect = false; }        // a destructuring: counted by the pattern above
    }
    if (c === '"' || c === "'" || c === "`") { const q = c; for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (depth === 0 && c === ",") expect = true;
    else if (depth === 0 && c === ";") break;
    else if (depth === 0 && c === "\n" && !/,\s*$/.test(src.slice(Math.max(0, i - 200), i)) && !/^\s*[,.?:+\-*/|&]/.test(src.slice(i + 1, i + 40))) break;
  }
  return out;
}
const exportsOf = new Map();
function exported(file, seen = new Set()) {
  if (exportsOf.has(file)) return exportsOf.get(file);
  if (seen.has(file) || !fs.existsSync(root + file)) return null;
  seen.add(file);
  const src = strip(fs.readFileSync(root + file, "utf8")), names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+/g)) for (const n of declared(src, m.index + m[0].length)) names.add(n);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+\{([^}]*)\}/g)) for (const n of m[1].split(",")) { const k = n.split(":").pop().trim(); if (k) names.add(k); }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/g)) for (const n of m[1].split(",")) { const k = n.trim().split(/\s+as\s+/).pop().trim(); if (k) names.add(k); }
  if (/export\s+default\b/.test(src)) names.add("default");
  for (const m of src.matchAll(/export\s+\*\s+from\s+["'](\.[^"']+)["']/g)) {
    const inner = exported(new URL(m[1], `file:///${file}`).pathname.slice(1), seen);
    for (const n of inner || []) if (n !== "default") names.add(n);
  }
  exportsOf.set(file, names);
  return names;
}
let bad = 0, checked = 0;
for (const file of files) {
  const src = strip(fs.readFileSync(root + file, "utf8"));
  for (const m of src.matchAll(/import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g)) {
    const target = new URL(m[3], `file:///${file}`).pathname.slice(1), names = exported(target);
    if (!names) { console.log(`FAIL ${file} imports from ${m[3]}, which isn't there`); bad++; continue; }
    const wanted = m[2].split(",").map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    if (m[1]) wanted.push("default");
    for (const n of wanted) { checked++; if (!names.has(n)) { console.log(`FAIL ${file} imports ${n} from ${m[3]}, which doesn't export it`); bad++; } }
  }
  for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*["'](\.[^"']+)["']/g)) {
    const names = exported(new URL(m[2], `file:///${file}`).pathname.slice(1));
    checked++;
    if (!names?.has("default")) { console.log(`FAIL ${file} imports a default from ${m[2]}, which has none`); bad++; }
  }
  for (const m of src.matchAll(/import\s*["'](\.[^"']+)["']/g)) if (!fs.existsSync(root + new URL(m[1], `file:///${file}`).pathname.slice(1))) { console.log(`FAIL ${file} imports ${m[1]}, which isn't there`); bad++; }
}
console.log(bad ? `${bad} FAILED` : `imports: all ${checked} names imported between ${files.length} modules are exported where they're imported from`);
process.exitCode = bad ? 1 : 0;
