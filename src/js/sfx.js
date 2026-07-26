/** Sons leves de UI + ambience de bar via Web Audio (sem arquivos externos). */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = 0.7;
    this.musicOn = true;
    this._ambienceOn = false;
    this._ambienceWanted = false;
    this._noiseSrc = null;
    this._noiseGain = null;
    this._murmurTimer = null;
    this._fxTimer = null;
    this._musicTimer = null;
    this._masterNode = null;
    this.station = 0; // 0 batida, 1 samba, 2 off-ish soft
  }

  nextStation() {
    this.station = (this.station + 1) % 3;
    this.setMusic(this.station !== 2);
    return ["Batida da casa", "Samba no pé", "Só papo"][this.station];
  }

  setVolume(v) {
    this.master = Math.max(0, Math.min(1, v));
    if (this._masterNode) this._masterNode.gain.value = this.master;
  }

  setMusic(on) {
    this.musicOn = !!on;
  }

  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this._masterNode = this.ctx.createGain();
    this._masterNode.gain.value = this.master;
    this._masterNode.connect(this.ctx.destination);
    return this.ctx;
  }

  _out() {
    this._ensure();
    return this._masterNode || this.ctx?.destination;
  }

  resume() {
    const ctx = this._ensure();
    if (ctx?.state === "suspended") ctx.resume();
  }

  _beep({ freq = 440, dur = 0.08, type = "sine", gain = 0.08, slide = 0 } = {}) {
    const ctx = this._ensure();
    const out = this._out();
    if (!ctx || !out) return;
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
    g.connect(out);
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

  coin() {
    this._beep({ freq: 880, dur: 0.07, type: "square", gain: 0.04, slide: 200 });
    this._beep({ freq: 1175, dur: 0.1, type: "triangle", gain: 0.035, slide: -40 });
  }

  cheer() {
    const ctx = this._ensure();
    const out = this._out();
    if (!ctx || !out) return;
    for (let i = 0; i < 5; i++) {
      const t0 = ctx.currentTime + i * 0.04;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220 + i * 55, t0);
      osc.frequency.linearRampToValueAtTime(440 + i * 40, t0 + 0.25);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.02, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.32);
    }
  }

  boo() {
    this._beep({ freq: 160, dur: 0.22, type: "sawtooth", gain: 0.02, slide: -60 });
    this._beep({ freq: 120, dur: 0.28, type: "triangle", gain: 0.015, slide: -40 });
  }

  almost() {
    this._beep({ freq: 520, dur: 0.08, type: "triangle", gain: 0.03, slide: 80 });
    this._beep({ freq: 400, dur: 0.12, type: "sine", gain: 0.02, slide: -120 });
  }

  glass() {
    this._beep({ freq: 980, dur: 0.06, type: "sine", gain: 0.018, slide: 220 });
    this._beep({ freq: 1320, dur: 0.05, type: "triangle", gain: 0.012, slide: -80 });
  }

  chuckle() {
    const ctx = this._ensure();
    const out = this._out();
    if (!ctx || !out) return;
    for (let i = 0; i < 3; i++) {
      const t0 = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(280 + i * 40, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.01, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.1);
    }
  }

  tvBlip() {
    this._beep({ freq: 180, dur: 0.14, type: "sawtooth", gain: 0.008, slide: 90 });
  }

  /** Batida / samba synth — groove do boteco. */
  _batidaHit() {
    if (!this.musicOn || !this._ambienceOn || this.station === 2) return;
    const ctx = this._ensure();
    const out = this._out();
    if (!ctx || !out) return;
    const t0 = ctx.currentTime;
    const samba = this.station === 1;
    const kick = ctx.createOscillator();
    const kg = ctx.createGain();
    kick.type = "sine";
    kick.frequency.setValueAtTime(samba ? 120 : 140, t0);
    kick.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    kg.gain.setValueAtTime(0.0001, t0);
    kg.gain.exponentialRampToValueAtTime(samba ? 0.038 : 0.045, t0 + 0.01);
    kg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    kick.connect(kg);
    kg.connect(out);
    kick.start(t0);
    kick.stop(t0 + 0.15);
    this._beep({
      freq: (samba ? 880 : 720) + Math.random() * 80,
      dur: 0.04,
      type: "triangle",
      gain: 0.012,
    });
    if (samba && Math.random() < 0.5) {
      this._beep({ freq: 660, dur: 0.03, type: "square", gain: 0.008 });
    }
    if (Math.random() < (samba ? 0.45 : 0.35)) {
      const notes = samba ? [220, 277, 330] : [196, 247, 294];
      for (const f of notes) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.012, t0 + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g);
        g.connect(out);
        o.start(t0 + 0.05);
        o.stop(t0 + 0.38);
      }
    }
  }

  startAmbience() {
    this._ambienceWanted = true;
    if (this._ambienceOn) return;
    const ctx = this._ensure();
    const out = this._out();
    if (!ctx || !out) return;
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
    gain.gain.value = 0.026;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start();

    this._noiseSrc = src;
    this._noiseGain = gain;
    this._ambienceOn = true;

    const scheduleMurmur = () => {
      if (!this._ambienceOn || !this._ambienceWanted) return;
      this._murmurBurst();
      this._murmurTimer = setTimeout(scheduleMurmur, 180 + Math.random() * 520);
    };
    this._murmurTimer = setTimeout(scheduleMurmur, 200 + Math.random() * 400);

    const scheduleFx = () => {
      if (!this._ambienceOn || !this._ambienceWanted) return;
      const r = Math.random();
      if (r < 0.35) this.glass();
      else if (r < 0.6) this.chuckle();
      else if (r < 0.75) this.tvBlip();
      this._fxTimer = setTimeout(scheduleFx, 2800 + Math.random() * 5200);
    };
    this._fxTimer = setTimeout(scheduleFx, 2500 + Math.random() * 2000);

    const beat = () => (this.station === 1 ? 240 : 280) + (Math.random() < 0.15 ? 100 : 0);
    const scheduleMusic = () => {
      if (!this._ambienceOn || !this._ambienceWanted) return;
      this._batidaHit();
      this._musicTimer = setTimeout(scheduleMusic, beat());
    };
    this._musicTimer = setTimeout(scheduleMusic, 800);
  }

  _murmurBurst() {
    const ctx = this.ctx;
    const out = this._out();
    if (!ctx || !out || !this._ambienceOn) return;
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
      g.connect(out);
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
    if (this._fxTimer) {
      clearTimeout(this._fxTimer);
      this._fxTimer = null;
    }
    if (this._musicTimer) {
      clearTimeout(this._musicTimer);
      this._musicTimer = null;
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
