// Cloth, a mode of Nonogram (loom-play.js, its rules in loom-float.js and its ladder in loom-levels.js): weaving as a nonogram
// of floats. nonogram.js loads this file only when the menu's Mode is Cloth; the markup is in nonogram.html. It was the
// page of Loom, a game of its own until 4 November 2026 (docs/loom.md), and keeps its saves under loom:.
import { part, toggle, line, onPause } from "./menu.js";
import { createPlay } from "./loom-play.js";
import { $, read, opts, saveOpts, BEST } from "./loom-kit.js";

/** Starts the cloth on the page; returns { menu(body), play }. */
export function enterCloth() {
  const play = createPlay($("clothHost"));
  $("acts").addEventListener("click", e => play.click(e));
  // the menu stands the shuttle still; a cloth being woven when it opens is finished when it closes
  onPause(() => play.pause(), () => play.resume());
  play.enter();
  return {
    play,
    /** The cloth's parts of the menu (the page adds its Mode choice). */
    menu(body) {
      play.menu(body);
      part(body, "settings").append(toggle("Show what's wrong in the cloth", opts.marks, on => { opts.marks = on; saveOpts(); play.marks(on); }),
        toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
      const stars = read(BEST, 0);
      if (stars) part(body, "about").append(line(`${stars} star${stars === 1 ? "" : "s"} so far.`));
    },
  };
}
