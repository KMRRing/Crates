// Today's manifest, made off the page: cutting holds until the counter proves one has a single stow takes a moment,
// and the page should stay still meanwhile. The same day makes the same manifest on every device (stow-pack.js
// decides it in integers).
import { dailyManifest } from "./stow-pack.js";

self.onmessage = e => { self.postMessage(dailyManifest(e.data.day)); };
