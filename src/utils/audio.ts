// Sistema de audio mínimo con Web Audio API (sin ficheros externos).
// El contexto se crea de forma perezosa: los navegadores exigen un gesto del
// usuario antes de dejar sonar nada.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = localStorage.getItem('cyberforge_muted') === '1';

function ensureContext(): AudioContext | null {
  if (muted) return null;
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem('cyberforge_muted', muted ? '1' : '0');
  if (!muted) ensureContext();
  return muted;
}

// Un tono corto con envolvente exponencial de caída.
function blip(freq: number, duration: number, type: OscillatorType = 'sine', volume = 1, delay = 0) {
  const audio = ensureContext();
  if (!audio || !master) return;
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  // Clic principal del recolector: agudo y corto,读的 como "tick" mecánico
  click: () => blip(660, 0.06, 'square', 0.5),
  // Compra / confirmación
  buy: () => {
    blip(520, 0.08, 'triangle', 0.6);
    blip(780, 0.1, 'triangle', 0.5, 0.07);
  },
  // Error / sin recursos
  error: () => blip(180, 0.16, 'sawtooth', 0.4),
  // Item usado
  use: () => blip(880, 0.09, 'sine', 0.6),
  // Pasos de la ruleta
  tick: () => blip(1200, 0.025, 'square', 0.25),
  // Arranque de la ruleta
  spinStart: () => blip(220, 0.25, 'sawtooth', 0.35),
  // Premio: acorde ascendente
  reward: (rare: boolean) => {
    const base = rare ? 523.25 : 392;
    blip(base, 0.18, 'triangle', 0.7);
    blip(base * 1.26, 0.18, 'triangle', 0.6, 0.09);
    blip(base * 1.5, 0.3, 'triangle', 0.55, 0.18);
    if (rare) blip(base * 2, 0.4, 'sine', 0.4, 0.27);
  },
  // Drop excepcional (mítico/divino)
  jackpot: () => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => blip(n, 0.35, 'triangle', 0.7, i * 0.085));
    blip(1567.98, 0.5, 'sine', 0.35, 0.36);
  }
};
