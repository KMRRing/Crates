// The plate on the Music page: a staff with a C major chord written on it over a keyboard whose three keys are lit, in the page's own
// classes (music.css), so it follows the theme and the night.
import { staffFrame, staffNotes, keyLayout, drawKeyboard } from "./music-draw.js";
import { parse } from "./music-theory.js";

export function plate() {
  const g = { clef: "treble", x: 14, y: 40, w: 272, s: 11 }, f = staffFrame(g);
  const notes = ["C4", "E4", "G4"].map((n, i) => ({ n: parse(n), x: 170 + (i % 2 ? 15 : 0), cls: "given", stem: false }));
  const keys = keyLayout(60, 83, 14, 126, 272, 66);
  return f.svg + staffNotes(f, g, notes, 0) + drawKeyboard({ keys, labels: "none", lit: new Set([60, 64, 67]) });
}
