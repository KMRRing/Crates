// Today's hold, made off the page: composing boards until the solver proves one and sets its par takes a moment, and
// the page should stay still meanwhile. The same day makes the same level on every device (stow-engine.js decides it
// in integers).
import { dailyLevel } from "./stow-engine.js";

self.onmessage = e => { self.postMessage(dailyLevel(e.data.day)); };
