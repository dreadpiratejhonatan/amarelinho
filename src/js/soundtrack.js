/**
 * Trilha ambient quieta (estilo peaceful / fundo).
 * Pads baixíssimos + notas raras — murmúrio do bar fica no primeiro plano.
 */

const MOTIFS = [
  [0, -1, -1, -1, 2, -1],
  [-1, -1, 4, -1, -1, -1],
  [0, -1, -1, -1, -1, -1],
  [-1, -1, -1, 2, -1, -1],
];

const TRACKS = [
  {
    id: "noite-calma",
    name: "Noite calma",
    scale: [196.0, 220.0, 261.63, 293.66, 329.63],
    pad: [65.41, 98.0, 130.81],
    beat: 2.8,
    density: 0.18,
    bright: 0.04,
    length: 14,
  },
  {
    id: "gelada-soft",
    name: "Gelada soft",
    scale: [174.61, 196.0, 233.08, 261.63, 311.13],
    pad: [58.27, 87.31, 116.54],
    beat: 3.0,
    density: 0.15,
    bright: 0.03,
    length: 12,
  },
];

function randInt(n) {
  if (n <= 0) return 0;
  return (Math.random() * n) | 0;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Soundtrack {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.enabled = true;
    this.running = false;
    this.padOsc = [];
    this.padFilter = null;
    this.padGain = null;
    this.noteFilter = null;
    this.echo = null;
    this.queue = [];
    this.timer = 0;
    this.track = null;
    this.playlist = [];
    this.index = 0;
    this.beat = 2.8;
    this.notesLeftInTrack = 0;
    this._raf = 0;
    this._last = 0;
  }

  /** @param {AudioContext} ctx @param {AudioNode} destination */
  start(ctx, destination) {
    if (!ctx || !destination) return;
    if (this.running && this.ctx === ctx) {
      this.setEnabled(this.enabled);
      return;
    }
    this.stop();
    this.ctx = ctx;
    this.master = destination;
    this.bus = ctx.createGain();
    // Quase subliminar — bem atrás do murmur
    this.bus.gain.value = this.enabled ? 0.07 : 0;
    this.bus.connect(destination);
    this._setupGraph(ctx);
    this.playlist = shuffle(TRACKS);
    this.index = 0;
    this._beginTrack(this.playlist[this.index]);
    this.running = true;
    this._last = performance.now();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    const t = this.ctx?.currentTime || 0;
    for (const p of this.padOsc) {
      try {
        p.g.gain.setTargetAtTime(0, t, 0.08);
        p.o.stop(t + 0.4);
      } catch {
        /* noop */
      }
    }
    this.padOsc = [];
    try {
      this.bus?.disconnect();
    } catch {
      /* noop */
    }
    this.bus = null;
    this.queue = [];
    this.track = null;
    this.ctx = null;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.bus || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(this.enabled ? 0.07 : 0, t, 0.5);
  }

  _setupGraph(ctx) {
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 280;
    this.padFilter.Q.value = 0.3;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.55;
    this.padFilter.connect(this.padGain).connect(this.bus);

    this.padOsc = [0, 1].map((i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 110;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(this.padFilter);
      o.start();
      return { o, g };
    });

    // Eco bem fraco
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.2;
    const d = ctx.createDelay(2.5);
    d.delayTime.value = 1.1;
    const fb = ctx.createGain();
    fb.gain.value = 0.1;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 700;
    this.echo.connect(d);
    d.connect(damp).connect(fb).connect(d);
    d.connect(this.bus);

    this.noteFilter = ctx.createBiquadFilter();
    this.noteFilter.type = "lowpass";
    this.noteFilter.frequency.value = 1200;
    this.noteFilter.Q.value = 0.2;
    this.noteFilter.connect(this.bus);
  }

  _beginTrack(track) {
    this.track = track;
    this.beat = track.beat;
    this.notesLeftInTrack = track.length;
    this.queue = [];
    this._retunePad(track.pad);
    this._fillPhrase();
    this.timer = 4 + Math.random() * 3;
  }

  _retunePad(freqs) {
    const ctx = this.ctx;
    if (!ctx || !this.padOsc.length) return;
    const t = ctx.currentTime;
    for (let i = 0; i < this.padOsc.length; i++) {
      const f = freqs[i % freqs.length] || 110;
      const cur = Math.max(40, this.padOsc[i].o.frequency.value || f);
      this.padOsc[i].o.frequency.cancelScheduledValues(t);
      this.padOsc[i].o.frequency.setValueAtTime(cur, t);
      this.padOsc[i].o.frequency.exponentialRampToValueAtTime(Math.max(40, f), t + 3.5);
      const vol = i === 0 ? 0.028 : 0.016;
      this.padOsc[i].g.gain.setTargetAtTime(vol, t, 1.4);
    }
  }

  _fillPhrase() {
    const track = this.track;
    if (!track) return;
    const motif = MOTIFS[randInt(MOTIFS.length)];
    const max = track.scale.length - 1;
    for (let i = 0; i < motif.length && this.notesLeftInTrack > 0; i++) {
      this.notesLeftInTrack--;
      const raw = motif[i];
      if (raw < 0 || Math.random() > track.density) {
        this.queue.push([-1, 8 + randInt(10)]);
        continue;
      }
      const deg = Math.max(0, Math.min(max, raw));
      const beats = [6, 8, 10, 12][randInt(4)];
      this.queue.push([deg, beats]);
    }
    // Respiração longa entre frases
    this.queue.push([-1, 16 + randInt(14)]);
  }

  _playNote(degree, beats) {
    const ctx = this.ctx;
    const track = this.track;
    if (!ctx || !this.bus || !track || degree < 0 || !this.enabled) return;
    const base = track.scale[degree % track.scale.length];
    const f = base * (Math.random() < track.bright ? 2 : 1);
    const dur = Math.max(2.0, beats * this.beat * 1.05);
    const t0 = ctx.currentTime;

    // Só sine limpo — sem stack triangle agressivo
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.035, t0 + 0.45);
    g.gain.setValueAtTime(0.028, t0 + 0.45 + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const dest = this.noteFilter || this.bus;
    osc.connect(g).connect(dest);
    if (this.echo) {
      const send = ctx.createGain();
      send.gain.value = 0.18;
      g.connect(send).connect(this.echo);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _nextTrack() {
    if (!this.playlist.length) return;
    this.index = (this.index + 1) % this.playlist.length;
    this._beginTrack(this.playlist[this.index]);
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    if (!this.enabled || !this.track) return;

    this.timer -= dt;
    if (this.timer > 0) return;

    if (!this.queue.length) {
      if (this.notesLeftInTrack <= 0) {
        this._nextTrack();
        return;
      }
      this._fillPhrase();
    }

    const [deg, beats] = this.queue.shift() || [-1, 8];
    if (deg >= 0) this._playNote(deg, beats);
    this.timer = Math.max(0.8, beats * this.beat * (0.5 + Math.random() * 0.2));
  }
}
