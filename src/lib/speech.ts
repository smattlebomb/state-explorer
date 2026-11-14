/** Spoken narration via the Web Speech API. Silently does nothing if unsupported or turned off. */
let enabled = false;
let voice: SpeechSynthesisVoice | null = null;
let unlocked = false;

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function pickVoice() {
  const s = synth();
  if (!s) return;
  const voices = s.getVoices();
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  // Prefer a friendly-sounding local US English voice when available.
  voice =
    en.find((v) => /samantha|karen|moira|tessa|ava|allison|susan/i.test(v.name) && v.localService) ??
    en.find((v) => v.lang === 'en-US' && v.localService) ??
    en.find((v) => v.lang === 'en-US') ??
    en[0] ??
    null;
}

if (synth()) {
  pickVoice();
  synth()!.addEventListener?.('voiceschanged', pickVoice);
}

/** iOS Safari only allows speech that starts from a user gesture. A silent
 *  utterance on a tap "unlocks" it for later prompts. Never speak, even silently,
 *  while narration is off. */
function unlock() {
  const s = synth();
  if (!s || !enabled || unlocked) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  s.speak(u);
  unlocked = true;
}

export function speechSupported(): boolean {
  return synth() !== null;
}

export function setSpeechEnabled(on: boolean) {
  enabled = on;
  if (!on) {
    synth()?.cancel();
    return;
  }
  if (!unlocked && typeof document !== 'undefined') {
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  }
}

export function speak(text: string) {
  const s = synth();
  if (!s || !enabled) return;
  unlock();
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US';
  u.rate = 0.9;
  u.pitch = 1.1;
  s.speak(u);
}
