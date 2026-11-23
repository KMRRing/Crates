// Every file that makes a Web Audio context plays at the app's volume (Korbi, 23 Nov 2026: "replace sound on/off with a slider on
// volume"; before it, wave 1's "a game with sound code that never respects the mute setting" fails). Static, as the sound modules
// differ in shape: a file passes if it takes speaker and audible from volume.js, asks audible() before it makes its first context,
// and reaches the speakers only through speaker(ctx) (the one sample of silence an iPhone needs to open its output aside). And no
// page keeps a Sound switch of its own: the menu's Volume slider is the one control. A new sound file is found by its AudioContext.
// Run: node tests/sound-mute.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = readdirSync(root).filter(f => f.endsWith(".js") && f !== "sw.js");
const src = Object.fromEntries(files.map(f => [f, readFileSync(join(root, f), "utf8")]));

// Not speakers: the timegrapher listens through the microphone; music-audio takes an injected context and has its own setMuted.
// calibre.js plays a repeater gong from a button and has no Sound setting at all: whether it needs one is Korbi's call
// (7 Nov 2026, found by this test), so it is named here rather than decided.
const EXEMPT = new Set(["timegrapher.js", "music-audio.js", "calibre.js"]);

const MAKES = /new\s+(?:\(\s*)?(?:window\.|globalThis\.)?(?:AudioContext|webkitAudioContext)\b|new C\(\)/;
const TAKES = /import \{[^}]*\bspeaker\b[^}]*\baudible\b[^}]*\} from "\.\/volume\.js"|import \{[^}]*\baudible\b[^}]*\bspeaker\b[^}]*\} from "\.\/volume\.js"/;
// a line that reaches the speakers directly is the silent sample that opens an iPhone's output, or it is a fault
const DIRECT = /\.connect\(\w+\.destination\)/g, SILENT = /createBuffer\(1, 1|s\.start\(0?\)|\bb, s = \w+\.createBufferSource/;

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const makers = files.filter(f => MAKES.test(src[f]));
check(makers.length >= 15, `found the files that make audio (${makers.length})`);
for (const f of makers) {
  if (EXEMPT.has(f)) continue;
  const text = src[f], first = text.search(MAKES), gate = text.search(/\baudible\(\)/);
  const lines = text.split("\n"), direct = lines.filter((l, k) => DIRECT.test(l) && !SILENT.test(l) && !SILENT.test(lines[k - 1] || "") && !SILENT.test(lines[k + 1] || ""));
  check(TAKES.test(text) && gate !== -1 && gate < first && /speaker\(\w+\)/.test(text) && !direct.length, `${f}: asks audible() before it makes a context and plays through speaker()${direct.length ? `; not: ${direct.map(l => l.trim()).join(" | ")}` : ""}`);
}
const switches = files.filter(f => /toggle\("Sound"/.test(src[f]));
check(!switches.length, `no Sound switch is left: the Volume slider is the one control${switches.length ? `; still in ${switches.join(", ")}` : ""}`);
check(/export function volume\(/.test(src["menu.js"]) && /suite:volume/.test(src["volume.js"]), "the menu has the Volume slider, and the level is this device's (a suite: key)");
process.exit(bad ? 1 : 0);
