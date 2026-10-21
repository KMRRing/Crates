// Timegrapher's microphone tap, on the audio thread: it only copies what the microphone gives, block by block, into
// chunks of 2048 frames and posts each to the page with the frame it began at (the audio clock's own count, so a
// lost block shows as a gap rather than as time that never passed). The measuring is the page's (timegrapher-dsp.js
// and timegrapher-measure.js, which tests/timegrapher.mjs runs in Node): this stays as small as an audio thread wants.
// Up to two channels go, since an iPhone may hand a mono microphone over as a stereo track with only its left side
// live (WebKit bug 281978); the page keeps whichever hears the watch better.
const SIZE = 2048;

class TgCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufs = null;
    this.n = 0;
    this.start = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length || !input[0]) return true;
    const chans = Math.min(2, input.length), len = input[0].length;
    if (!this.bufs || this.bufs.length !== chans) { this.bufs = Array.from({ length: chans }, () => new Float32Array(SIZE)); this.n = 0; }
    if (this.n === 0) this.start = currentFrame;
    let i = 0;
    while (i < len) {
      const take = Math.min(len - i, SIZE - this.n);
      for (let c = 0; c < chans; c++) this.bufs[c].set(input[c].subarray(i, i + take), this.n);
      this.n += take;
      i += take;
      if (this.n === SIZE) {
        const out = this.bufs;
        this.port.postMessage({ frame: this.start, ch: out }, out.map(b => b.buffer));
        this.bufs = Array.from({ length: chans }, () => new Float32Array(SIZE));
        this.n = 0;
        this.start = currentFrame + i;
      }
    }
    return true;
  }
}
registerProcessor("tg-capture", TgCapture);
