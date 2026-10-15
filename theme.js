// Almanac's look, chosen on the games screen (More, Settings): the theme (Almanac, the default; Modern; Kontor; Office) and
// day or night (following the phone unless set). A plain script in every page's head, so the look is set before the
// page draws and never flashes the wrong one; and, being the first thing every page runs, where a page that plays with
// others starts connecting.
(function () {
  try {
    var t = localStorage.getItem("suite:theme"), m = localStorage.getItem("suite:mode");
    if (t === "modern" || t === "kontor" || t === "office") document.documentElement.dataset.theme = t;
    if (m === "day" || m === "night") document.documentElement.dataset.mode = m;
  } catch (e) { /* private mode: Almanac, following the phone */ }
})();
// A page opened to play with others (a table, a room or a party in its address) starts reaching the game server here,
// in its first moment, while the rest of the page loads, rather than once the game asks: connecting is most of the
// wait to sit down, and from far away (Asia to the database in Belgium) each of its round trips is a quarter second.
// The page's own modules get the same connection (net.js keeps it). Not in the frames that watch a partner's game.
if (/[?&](?:table|room|party)=/.test(location.search) && !/[?&]frame\b/.test(location.search)) {
  import("./net.js").then(function (m) { return m.getSync(); }).catch(function () { /* the game reports it when it asks */ });
}
