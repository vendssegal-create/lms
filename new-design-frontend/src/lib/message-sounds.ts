type MessageSoundKind = 'send' | 'receive';

let audioContext: AudioContext | null = null;
let unlockInstalled = false;

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

function resumeAudioContext() {
  const context = getAudioContext();
  if (!context || context.state === 'running') {
    return;
  }

  void context.resume().catch(() => {});
}

export function installMessageSoundUnlock() {
  if (typeof window === 'undefined' || unlockInstalled) {
    return;
  }

  unlockInstalled = true;
  const unlock = () => {
    resumeAudioContext();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

export async function playMessageSound(kind: MessageSoundKind) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state !== 'running') {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const now = context.currentTime;
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, now);

  const oscillator = context.createOscillator();
  oscillator.type = kind === 'send' ? 'triangle' : 'sine';
  oscillator.connect(gain);

  if (kind === 'send') {
    oscillator.frequency.setValueAtTime(620, now);
    oscillator.frequency.exponentialRampToValueAtTime(780, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
    return;
  }

  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  oscillator.start(now);
  oscillator.stop(now + 0.2);
}
