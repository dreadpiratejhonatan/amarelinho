/** Sons leves de UI + ambience de bar via Web Audio (sem arquivos externos). */
export class Sfx {
  constructor() {
    this.ctx = null;
    this._ambienceOn = false;
    this._ambienceWanted = false;
    this._noiseSrc = null;
    this._noiseGain = null;
    this._murmurTimer = null;
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

  /** Burburinho de bar em volume baixo (noise filtrado + murmúrios). */
  startAmbience() {
    this._ambienceWanted = true;
    if (this._ambienceOn) return;
    const ctx = this._ensure();
    if (!ctx) return;
    this.resume();

    const seconds = 2.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 980;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.028;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this._noiseSrc = src;
    this._noiseGain = gain;
    this._ambienceOn = true;

    const scheduleMurmur = () => {
      if (!this._ambienceOn || !this._ambienceWanted) return;
      this._murmurBurst();
      const next = 180 + Math.random() * 520;
      this._murmurTimer = setTimeout(scheduleMurmur, next);
    };
    this._murmurTimer = setTimeout(scheduleMurmur, 200 + Math.random() * 400);
  }

  _murmurBurst() {
    const ctx = this.ctx;
    if (!ctx || !this._ambienceOn) return;
    const voices = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < voices; i++) {
      const t0 = ctx.currentTime + i * 0.03;
      const dur = 0.08 + Math.random() * 0.18;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 220 + Math.random() * 280;
      f.Q.value = 2.5;
      osc.type = Math.random() < 0.5 ? "triangle" : "sine";
      const base = 140 + Math.random() * 260;
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.linearRampToValueAtTime(base + (Math.random() - 0.5) * 80, t0 + dur);
      const vol = 0.008 + Math.random() * 0.012;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }
  }

  stopAmbience() {
    this._ambienceWanted = false;
    if (this._murmurTimer) {
      clearTimeout(this._murmurTimer);
      this._murmurTimer = null;
    }
    if (this._noiseSrc) {
      try {
        this._noiseSrc.stop();
      } catch {
        /* already stopped */
      }
      try {
        this._noiseSrc.disconnect();
      } catch {
        /* noop */
      }
      this._noiseSrc = null;
    }
    if (this._noiseGain) {
      try {
        this._noiseGain.disconnect();
      } catch {
        /* noop */
      }
      this._noiseGain = null;
    }
    this._ambienceOn = false;
  }
}
