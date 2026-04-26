/** Full-scale success beep for barcode / scan feedback (Web Audio API, no assets). */
export function playBarcodeScanBeep(): void {
  try {
    const win = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const run = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.085);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.095);
      osc.onended = () => {
        try {
          void ctx.close();
        } catch {
          /* ignore */
        }
      };
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(run);
    } else {
      run();
    }
  } catch {
    /* autoplay policy, unsupported, etc. */
  }
}

/** High-pitched error tone for unknown / invalid scans (stock count). Distinct from success (880 Hz). */
export function playStockCountErrorBeep(): void {
  try {
    const win = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const run = () => {
      const t0 = ctx.currentTime;
      // First sharp high tone (~2 kHz)
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.connect(g1);
      g1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(2000, t0);
      g1.gain.setValueAtTime(0.001, t0);
      g1.gain.linearRampToValueAtTime(1, t0 + 0.005);
      g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.085);
      osc1.start(t0);
      osc1.stop(t0 + 0.09);
      // Second higher tone (~2.7 kHz) — reads clearly as "error" vs single success beep
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2);
      g2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(2700, t0 + 0.1);
      g2.gain.setValueAtTime(0.001, t0 + 0.1);
      g2.gain.linearRampToValueAtTime(1, t0 + 0.106);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
      osc2.start(t0 + 0.1);
      osc2.stop(t0 + 0.2);
      setTimeout(() => {
        try {
          void ctx.close();
        } catch {
          /* ignore */
        }
      }, 350);
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(run);
    } else {
      run();
    }
  } catch {
    /* ignore */
  }
}
