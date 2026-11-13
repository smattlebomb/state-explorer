/**
 * Confetti helpers (canvas-confetti, bundled). Bursts are short (~1s) and
 * automatically skipped when the device asks for reduced motion.
 */
import confetti from 'canvas-confetti';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const COLORS = ['#facc15', '#22c55e', '#38bdf8', '#f472b6', '#fb923c', '#a78bfa'];

/** A small burst of stars + confetti from a screen point (client px). */
export function burstAt(x: number, y: number, big = false) {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  const origin = { x: x / window.innerWidth, y: y / window.innerHeight };
  const base = { origin, colors: COLORS, disableForReducedMotion: true, ticks: big ? 90 : 60, gravity: 1.1, scalar: big ? 1.1 : 0.9, zIndex: 60 };
  void confetti({ ...base, particleCount: big ? 50 : 24, spread: big ? 100 : 70, startVelocity: big ? 38 : 26, shapes: ['star'] });
  void confetti({ ...base, particleCount: big ? 40 : 16, spread: big ? 120 : 80, startVelocity: big ? 32 : 22 });
}

/** Two side cannons — used for a 5-in-a-row combo and a 3-star round. */
export function bigCelebration() {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  const base = { colors: COLORS, disableForReducedMotion: true, ticks: 100, particleCount: 45, spread: 65, startVelocity: 45, zIndex: 60 };
  void confetti({ ...base, angle: 60, origin: { x: 0, y: 0.8 } });
  void confetti({ ...base, angle: 120, origin: { x: 1, y: 0.8 } });
}
