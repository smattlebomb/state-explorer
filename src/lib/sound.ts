/**
 * Tiny sound effects synthesized with the Web Audio API (no audio files, so
 * they work offline). Everything is short, soft and rounded: sine/triangle
 * waves with gentle attack and release, and nothing louder than ~0.18 gain.
 */
let enabled = true;
let ctx: AudioContext | null = null;

type Ctor = typeof AudioContext;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

// iOS only starts audio from a user gesture: create/resume the context on the first touch.
if (typeof document !== 'undefined') {
  const unlock = () => {
    const a = audio();
    if (a && a.state === 'suspended') void a.resume();
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

interface Note {
  freq: number;
  /** seconds from now */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Optional pitch glide target. */
  to?: number;
}

function play(notes: Note[]) {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  if (a.state === 'suspended') void a.resume();
  const t0 = a.currentTime + 0.01;
  for (const n of notes) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.dur);
    const peak = n.gain ?? 0.15;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.05);
  }
}

/** Correct answer: a bright two-note "ding-ding". */
export function soundCorrect() {
  play([
    { freq: 1046.5, at: 0, dur: 0.18, gain: 0.14 }, // C6
    { freq: 1568, at: 0.09, dur: 0.3, gain: 0.12 }, // G6
  ]);
}

/** Wrong answer: a soft, low, downward "boop". Never a buzzer. */
export function soundWrong() {
  play([{ freq: 330, to: 220, at: 0, dur: 0.22, type: 'triangle', gain: 0.12 }]);
}

/** Combo milestone: a quick rising sparkle. */
export function soundCombo() {
  play([523.25, 659.25, 783.99, 1046.5].map((freq, i) => ({ freq, at: i * 0.06, dur: 0.16, gain: 0.1 })));
}

/** End of round: a short major-chord fanfare (C–E–G–C). */
export function soundFanfare() {
  play([
    { freq: 523.25, at: 0, dur: 0.16, type: 'triangle', gain: 0.14 },
    { freq: 659.25, at: 0.14, dur: 0.16, type: 'triangle', gain: 0.14 },
    { freq: 783.99, at: 0.28, dur: 0.16, type: 'triangle', gain: 0.14 },
    { freq: 1046.5, at: 0.42, dur: 0.5, type: 'triangle', gain: 0.16 },
    { freq: 659.25, at: 0.42, dur: 0.5, gain: 0.08 },
  ]);
}

/** Hint unlocked: a soft "pop". */
export function soundHint() {
  play([{ freq: 600, to: 900, at: 0, dur: 0.12, gain: 0.08 }]);
}
