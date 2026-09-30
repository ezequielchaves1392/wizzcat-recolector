// ==========================================================================
// Cyber-Forge · Audio
//
// Todo se sintetiza con Web Audio API: ni un solo fichero de audio, ni una
// petición de red, ni un problema de licencias. La música es generativa y el
// juego va pogando a un acorde distinto, así que nunca se repite literal.
//
// Mobile: el AudioContext se crea y se desbloquea en el primer toque, y todo
// se suspende cuando la pestaña pasa a segundo plano para no)durar la batería
// en segundo plano. Cada nodo que se crea se desconecta solo: sin fugas.
// ==========================================================================

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

let muted = localStorage.getItem('cyberforge_muted') === '1';
let musicEnabled = localStorage.getItem('cyberforge_music') !== '0';
// Nota: los efectos de audio se versionan con el multiplicador de la racha de
// clics, que sube un 2.2% por clic hasta un techo de 22 clics.
const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function isMuted() { return muted; }
export function isMusicEnabled() { return musicEnabled; }

function ensureContext(): AudioContext | null {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    // setMaxLatency no está en el tipado estándar de TS
    (ctx as AudioContext & { setMaxLatency?: (v: number) => void }).setMaxLatency?.(0.05);

    // Compresor: evita que el acorde de jackpot sature cuando hay 4-5 voces
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 22;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;
    compressor.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = muted ? 0 : 0.5;
    sfxBus.connect(compressor);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicEnabled ? 0.16 : 0;
    musicBus.connect(compressor);
    return ctx;
  } catch {
    return null;
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem('cyberforge_muted', muted ? '1' : '0');
  const audio = ensureContext();
  if (audio && sfxBus && musicBus) {
    const t = audio.currentTime;
    sfxBus.gain.cancelScheduledValues(t);
    sfxBus.gain.setTargetAtTime(muted ? 0 : 0.5, t, 0.05);
    musicBus.gain.setTargetAtTime(muted || !musicEnabled ? 0 : 0.16, t, 0.2);
  }
  return muted;
}

export function toggleMusic(): boolean {
  musicEnabled = !musicEnabled;
  localStorage.setItem('cyberforge_music', musicEnabled ? '1' : '0');
  const audio = ensureContext();
  if (audio && musicBus) {
    musicBus.gain.setTargetAtTime(muted || !musicEnabled ? 0 : 0.16, audio.currentTime, 0.4);
  }
  if (musicEnabled) startMusic();
  return musicEnabled;
}

/** Un tono con envolvente ADSR corta. Se desconecta sola al terminar. */
function blip(freq: number, duration: number, type: OscillatorType = 'sine', volume = 1, delay = 0) {
  const audio = muted ? null : ensureContext();
  if (!audio || !sfxBus) return;
  const t0 = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

export const sfx = {
  // Clic del recolector. Pitch sube ligeramente con los clics seguidos: da la
  // sensación de "cargando" sin necesidad de un sistema de combo explícito.
  click: (streak = 0) => {
    const base = 620 * Math.pow(1.022, Math.min(streak, 22));
    blip(base, 0.055, 'square', 0.42);
    blip(base * 2, 0.03, 'sine', 0.16);
  },
  buy: () => {
    blip(523.25, 0.09, 'triangle', 0.6);
    blip(783.99, 0.12, 'triangle', 0.5, 0.075);
  },
  error: () => {
    blip(174.61, 0.14, 'sawtooth', 0.35);
    blip(155.56, 0.16, 'sawtooth', 0.3, 0.05);
  },
  use: () => {
    blip(880, 0.08, 'sine', 0.55);
    blip(1318.5, 0.1, 'sine', 0.4, 0.05);
  },
  equip: () => {
    blip(392, 0.07, 'square', 0.4);
    blip(587.33, 0.1, 'square', 0.35, 0.05);
  },
  // Tick de la ruleta. Se atenúa conforme avanza: el volumen bajo solo en el
  // último tramo es lo que produce la sensación de "se está parando".
  tick: (progress = 0) => blip(1500 - progress * 500, 0.022, 'square', 0.22 * (1 - progress * 0.6)),
  spinStart: () => {
    blip(196, 0.3, 'sawtooth', 0.3);
    blip(293.66, 0.34, 'triangle', 0.22, 0.1);
  },
  reward: (rare: boolean) => {
    const base = rare ? 523.25 : 392;
    blip(base, 0.18, 'triangle', 0.65);
    blip(base * 1.26, 0.18, 'triangle', 0.55, 0.085);
    blip(base * 1.5, 0.3, 'triangle', 0.5, 0.17);
    if (rare) blip(base * 2, 0.42, 'sine', 0.35, 0.26);
  },
  jackpot: () => {
    // Arpegio ascendente: el momento más satisfactorio del juego
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) =>
      blip(n, 0.4, 'triangle', 0.62 - i * 0.05, i * 0.075)
    );
    blip(1567.98, 0.6, 'sine', 0.3, 0.38);
  },
  achievement: () => {
    [659.25, 830.61, 987.77].forEach((n, i) => blip(n, 0.3, 'sine', 0.5, i * 0.07));
  },
  levelUp: () => {
    [392, 523.25, 659.25, 784].forEach((n, i) => blip(n, 0.28, 'triangle', 0.5, i * 0.06));
  },

  // --- Prestigio y árbol ---
  // Compra de nodo: dos clicks metálicos agudos. Distinto del `buy` de tienda
  // para que el jugador sepa sin mirar en qué sección ha gastado núcleos.
  nodeBuy: () => {
    blip(1046.5, 0.06, 'square', 0.4);
    blip(1396.91, 0.1, 'square', 0.32, 0.055);
  },
  // Reciclaje: barrido descendente largo + acorde. Comunica "algo termina".
  prestige: () => {
    blip(880, 0.5, 'sawtooth', 0.4);
    blip(440, 0.6, 'sine', 0.35, 0.12);
    [261.63, 392, 523.25].forEach((n, i) => blip(n, 0.5, 'triangle', 0.42, 0.24 + i * 0.08));
    blip(1046.5, 0.7, 'sine', 0.25, 0.5);
  },

  // --- Forja ---
  // Golpe del martillo: un golpe grave con ruido encima. Se dispara al
  // empezar la fusión, no al terminar: el martillo es el que suena.
  hammer: () => {
    blip(110, 0.22, 'square', 0.55);
    blip(82.41, 0.26, 'sine', 0.4, 0.02);
  },
  // Fusión exitosa: acorde mayor con aire de "metal caliente".
  forgeSuccess: () => {
    [329.63, 415.30, 493.88, 659.25].forEach((n, i) => blip(n, 0.45, 'triangle', 0.55, i * 0.07));
    blip(1318.5, 0.55, 'sine', 0.3, 0.3);
  },
  // Fusión fallida: dos golpes secos y graves. El silencio de la cola es lo
  // que hace que se note el fallo.
  forgeFail: () => {
    blip(146.83, 0.2, 'sawtooth', 0.4);
    blip(110, 0.3, 'sawtooth', 0.35, 0.14);
  },
  // Motor de la ruleta de forja: chasquido metálico, más grave que el de cajas.
  forgeTick: (progress = 0) => blip(900 - progress * 420, 0.03, 'square', 0.2 * (1 - progress * 0.55)),

  // --- Navegación ---
  nav: () => blip(660, 0.035, 'sine', 0.22),
  // Colocación de un item: "clack" corto. Es sutil a propósito: en un drag
  // and drop se dispara muchas veces por minuto y un sonido fuerte cansa.
  place: () => blip(320, 0.045, 'square', 0.16),
  pick: () => blip(480, 0.035, 'sine', 0.14)
};

// ==========================================================================
// Música generativa
//
// Un drone de dos osciladores ligeramente desafinados da el "aire" de nave, y
// encima un pad de acordes va cambiando cada 8 compases. El pad se construye
// con un LFO de volumen: el resultado suena a sintetizador analógico sin
// necesitar ningún sample.
// ==========================================================================

let musicTimer: number | null = null;
let musicStep = 0;
let padOscs: OscillatorNode[] = [];
let padGain: GainNode | null = null;

// Progresión en La menor: Am - F - C - G. Familiar sin ser obvia.
const PROGRESSION: number[][] = [
  [220.00, 261.63, 329.63], // Am
  [174.61, 220.00, 261.63], // F
  [261.63, 329.63, 392.00], // C
  [196.00, 246.94, 293.66]  // G
];

function startPad(freqs: number[]) {
  const audio = ensureContext();
  if (!audio || !musicBus) return;
  stopPad();

  padGain = audio.createGain();
  padGain.gain.value = 0;
  // Filtro paso bajo: quita el brillo penetrante de los saw
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.6;

  // LFO sobre el volumen: da el vaivén del sintetizador
  const lfo = audio.createOscillator();
  const lfoGain = audio.createGain();
  lfo.frequency.value = 0.14;
  lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain);
  lfoGain.connect(padGain.gain);
  lfo.start();
  padOscs.push(lfo);

  padGain.connect(filter);
  filter.connect(musicBus);

  freqs.forEach((f, i) => {
    for (const detune of [-4, 4]) {
      const osc = audio.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = detune;
      const g = audio.createGain();
      g.gain.value = 0.09;
      osc.connect(g);
      g.connect(padGain!);
      osc.start();
      padOscs.push(osc);
    }
  });

  // Entrada suave del pad
  padGain.gain.setTargetAtTime(1, audio.currentTime, 2.2);
}

function stopPad() {
  const audio = ctx;
  if (!audio) { padOscs = []; return; }
  const dying = padOscs;
  padOscs = [];
  if (padGain) {
    padGain.gain.cancelScheduledValues(audio.currentTime);
    padGain.gain.setTargetAtTime(0, audio.currentTime, 0.6);
  }
  // Da margen a la envolvente antes de desconectar
  window.setTimeout(() => {
    dying.forEach(o => { try { o.stop(); } catch { /* ya parado */ } o.disconnect(); });
  }, 2200);
  padGain = null;
}

function musicTick() {
  if (!musicEnabled || muted || document.hidden) return;
  const audio = ensureContext();
  if (!audio) return;

  // Un compás cada 8 pasos
  if (musicStep % 8 === 0) {
    const chord = PROGRESSION[Math.floor(musicStep / 8) % PROGRESSION.length];
    startPad(chord);
  }
  musicStep++;
}

export function startMusic() {
  if (musicTimer !== null) return;
  ensureContext();
  musicTimer = window.setInterval(musicTick, 2600);
}

export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  stopPad();
}

/**
 * Se llama al pasar a segundo plano. En móvil, un timer activo con la
 * pestaña oculta consume batería y el navegador lo estrangula igualmente.
 */
export function setAudioSuspended(suspended: boolean) {
  if (suspended) {
    stopMusic();
  } else if (musicEnabled) {
    startMusic();
  }
}

/** Arranca todo tras el primer gesto real del usuario (requisito del navegador). */
export function primeAudio() {
  const audio = ensureContext();
  if (!audio) return;
  audio.resume().catch(() => {});
  if (musicEnabled) startMusic();
}
