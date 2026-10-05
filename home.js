// Almanac's home: the app opens on the screen of games, with no game open. Crates used to be the front page; a link
// made for it then (a shared board, a room, a run, a pool) still goes to Crates, now at crates.html.
const q = new URLSearchParams(location.search);
if (["b", "room", "run", "cat"].some(k => q.has(k))) location.replace(`crates.html${location.search}${location.hash}`);
else {
  const { bindSwitcher } = await import("./apps.js");
  bindSwitcher(document.getElementById("appsBtn"), null);
  const games = document.querySelector("dialog.apps");
  games.addEventListener("cancel", e => e.preventDefault());   // home has nothing behind it to close back to
  games.showModal();
  document.activeElement?.blur();                              // no focus ring on the first chip: nothing was chosen yet
}
import "./pwa.js";
