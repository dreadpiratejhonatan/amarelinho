/** Sons leves de UI via Web Audio (sem arquivos externos). */
export class Sfx {
  constructor() {
    this.ctx = null;
  }

  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    return this.ctx;
  }

  resume() {
    const ctx = this._ensure();
    if (ctx?.state === "suspended") ctx.resume();
  }

  _beep({ freq = 440, dur = 0.08, type = "sine", gain = 0.08, slide = 0 } = {}) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  click() {
    this._beep({ freq: 520, dur: 0.05, type: "triangle", gain: 0.06 });
  }

  open() {
    this._beep({ freq: 380, dur: 0.1, type: "sine", gain: 0.07, slide: 120 });
  }

  order() {
    this._beep({ freq: 300, dur: 0.12, type: "triangle", gain: 0.08, slide: 180 });
  }

  sit() {
    this._beep({ freq: 220, dur: 0.09, type: "sine", gain: 0.05 });
  }
}
