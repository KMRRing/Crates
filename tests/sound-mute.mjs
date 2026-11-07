// Every file that makes a Web Audio context must respect the menu's Sound switch (wave 1, Korbi: "a game with sound code that
// never respects the mute setting" fails). Static, because the sound modules differ in shape: a file passes if
//   (a) it checks its own on/muted flag before the first context is made (the flag has a setter), or
//   (b) the context is made unguarded but every file that calls it (importers, or the file itself) tests the page's Sound
//       setting where it calls. A new sound file is found by its `AudioContext` and must satisfy one of the two.
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
const OWN_GUARD = /if\s*\(\s*(?:!\s*on|muted|!\s*opts\.sound)\b/;
const HAS_SETTER = /set on\(|opts = \{ sound|setOn\b|setSound\b|setMuted\b|opts\.sound\s*=|toggle\("Sound"/;
// where a caller asks the page whether sound is wanted
const CALLER_GATE = /prefs\.sound|opts\.click\?\.\(\)|deps\.sound\?\.\(\)|sfxOn\b|sound\s*\?\.\(\)/;

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const makers = files.filter(f => MAKES.test(src[f]));
check(makers.length >= 15, `found the files that make audio (${makers.length})`);
for (const f of makers) {
  if (EXEMPT.has(f)) continue;
  const text = src[f], first = text.search(MAKES), guard = text.search(OWN_GUARD);
  if (guard !== -1 && guard < first) {
    check(HAS_SETTER.test(text), `${f}: checks its flag before it makes a context, and the flag can be set`);
    continue;
  }
  const me = f.replace(/\.js$/, ""), callers = files.filter(g => g !== f && new RegExp(`from\\s+"\\./${me}\\.js"`).test(src[g]));
  const gates = callers.length ? callers : [f];
  check(gates.every(g => CALLER_GATE.test(src[g])), `${f}: makes a context unguarded, so ${gates.join(", ")} must test the Sound setting where it calls`);
}
process.exit(bad ? 1 : 0);
