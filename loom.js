// Loom: weaving, as a nonogram of floats (loom-play.js, its rules in loom-float.js and its ladder in loom-levels.js): paint
// what shows at each crossing until every line's clue is met. This file is the page: the menu and the header. (The draft,
// the first Loom, is gone, 2 November 2026; what it kept under loom: stays on the device.)
import { bindSwitcher, APPS } from "./apps.js";
import { part, toggle, line, onPause } from "./menu.js";
import { createPlay } from "./loom-play.js";
import { $, read, opts, saveOpts, BEST } from "./loom-kit.js";
import "./pwa.js";

const play = createPlay($("clothHost"));

function openMenu() {
  const body = $("menuBody");
  body.replaceChildren();
  play.menu(body);
  const st = part(body, "settings");
  st.append(toggle("Show what's wrong in the cloth", opts.marks, on => { opts.marks = on; saveOpts(); play.marks(on); }));
  st.append(toggle("Sound", opts.sound, on => { opts.sound = on; saveOpts(); }));
  const stars = read(BEST, 0);
  if (stars) part(body, "about").append(line(`${stars} star${stars === 1 ? "" : "s"} so far.`));
  if (!$("menuDlg").open) $("menuDlg").showModal();
}

bindSwitcher($("appsBtn"), "loom");
document.querySelector(".lm-mark").innerHTML = APPS.find(a => a.id === "loom")?.logo || "";
$("menuBtn").addEventListener("click", openMenu);
$("menuClose").addEventListener("click", () => $("menuDlg").close());
$("acts").addEventListener("click", e => play.click(e));
// the menu stands the shuttle still; a cloth being woven when it opens is finished when it closes
onPause(() => play.pause(), () => play.resume());
play.enter();
window.__loom = { play: play.debug, openMenu };
