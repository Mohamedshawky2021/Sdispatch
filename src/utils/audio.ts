// Industrial Audio Feedback System using Web Audio API

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playClickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Audio context may be restricted before user gesture
  }
}

export function playLoadConfirmedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Upward industrial chime
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25]; // A4, C#5, E5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.18);
    });
  } catch {
    // Silent fallback
  }
}

export function playDumpCompletedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Two-tone triumphant completion sound (CAT payload meter style)
    const tones = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.08 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.24);
    });
  } catch {
    // Silent fallback
  }
}

export function playStandbyToggleSound(active: boolean) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    if (active) {
      // Start waiting / alert tone
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.linearRampToValueAtTime(450, now + 0.15);
    } else {
      // End waiting / resume tone
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(650, now + 0.15);
    }

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    // Silent fallback
  }
}

export function playDispatchAlertSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Urgent double beep for radio broadcast from dispatch
    [0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now + offset);

      gain.gain.setValueAtTime(0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.005, now + offset + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    });
  } catch {
    // Silent fallback
  }
}

export function playLowBatteryAlarmSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Industrial low battery alternating emergency warning chime
    [
      { freq: 740, delay: 0 },
      { freq: 440, delay: 0.18 },
      { freq: 740, delay: 0.36 },
      { freq: 440, delay: 0.54 },
    ].forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.2, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.16);
    });
  } catch {
    // Silent fallback
  }
}

// -------------------------------------------------------------
// Continuous High-Priority SOS Emergency Alarm Siren
// Loops continuously until acknowledged by Dispatcher or Admin
// -------------------------------------------------------------
let sosAlarmInterval: ReturnType<typeof setInterval> | null = null;
let isSosAlarmActiveFlag = false;

export function startContinuousSosAlarm(): void {
  if (typeof window === 'undefined') return;
  if (isSosAlarmActiveFlag && sosAlarmInterval) return;

  isSosAlarmActiveFlag = true;

  const playSirenBurst = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Two-tone high-low urgent industrial emergency warble (980Hz and 650Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.linearRampToValueAtTime(650, now + 0.25);
      osc.frequency.linearRampToValueAtTime(980, now + 0.5);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.58);
    } catch {
      // Audio autoplay restriction fallback
    }
  };

  playSirenBurst();
  sosAlarmInterval = setInterval(playSirenBurst, 650);
}

export function stopContinuousSosAlarm(): void {
  isSosAlarmActiveFlag = false;
  if (sosAlarmInterval) {
    clearInterval(sosAlarmInterval);
    sosAlarmInterval = null;
  }
}

export function isSosAlarmActive(): boolean {
  return isSosAlarmActiveFlag;
}

