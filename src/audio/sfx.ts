/** Tiny WebAudio synthesiser for UI and game sound effects (no assets). */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  volume = 0.5;
  muted = false;
  private last = new Map<string, number>();

  /** The shared AudioContext (also used by the music), created on first use. */
  context(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    const ctx = this.context();
    if (ctx?.state === 'suspended') void ctx.resume();
    return ctx;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private tone(type: OscillatorType, f0: number, f1: number, t0: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(t0: number, dur: number, gain: number, freq: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  play(name: string): void {
    const now = performance.now();
    if ((this.last.get(name) ?? 0) > now - 70) return;
    this.last.set(name, now);
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'click':
        this.tone('triangle', 880, 660, t, 0.06, 0.12);
        break;
      case 'zone':
        this.tone('sine', 520, 780, t, 0.09, 0.14);
        break;
      case 'build':
        this.tone('square', 140, 70, t, 0.12, 0.12);
        this.noise(t, 0.12, 0.25, 900, 0.8);
        break;
      case 'bulldoze':
        this.noise(t, 0.35, 0.45, 300, 0.6);
        this.tone('sawtooth', 90, 45, t, 0.3, 0.07);
        break;
      case 'terraform':
        this.noise(t, 0.25, 0.3, 200, 0.7);
        break;
      case 'error':
        this.tone('square', 220, 200, t, 0.09, 0.1);
        this.tone('square', 170, 150, t + 0.1, 0.12, 0.1);
        break;
      case 'cash':
        this.tone('triangle', 1320, 1320, t, 0.08, 0.1);
        this.tone('triangle', 1760, 1760, t + 0.07, 0.12, 0.1);
        break;
      case 'fanfare':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.11, 0.22, 0.13));
        break;
      case 'siren':
        for (let i = 0; i < 3; i++) this.tone('sine', 600, 900, t + i * 0.45, 0.4, 0.08);
        break;
      case 'boom':
        this.noise(t, 1.1, 0.8, 120, 0.5);
        this.tone('sine', 80, 30, t, 0.9, 0.3);
        break;
      case 'quake':
        this.noise(t, 2.5, 0.6, 70, 0.4);
        break;
      case 'undo':
        this.tone('triangle', 660, 440, t, 0.08, 0.1);
        this.tone('triangle', 520, 330, t + 0.07, 0.1, 0.08);
        break;
      case 'message':
        this.tone('sine', 740, 740, t, 0.1, 0.08);
        this.tone('sine', 988, 988, t + 0.09, 0.14, 0.08);
        break;
    }
  }
}
