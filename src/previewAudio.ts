// ==========================================================================
//  Audio en el banco de pruebas
//
//  El preview pinta la misma cabecera que el juego, pero no monta `renderBase`,
//  que es quien conecta los botones. Sin esto, al revisar un cambio de audio
//  los dos interruptores se veían correctos y no hacían nada —el mismo fallo
//  quehadía el juego antes de arreglarlo, pero escondido en el banco de
//  pruebas en lugar de visible en el producto.
//
//  Solo existe en el preview: nunca entra en el build del juego.
// ==========================================================================

import {
  isSfxEnabled, isMusicEnabled, toggleMute, toggleMusic,
  onAudioStateChange, primeAudio
} from './utils/audio';
import { ic } from './ui/icons';

export function wirePreviewAudio(app: HTMLElement) {
  const pintar = () => {
    const musica = isMusicEnabled();
    const efectos = isSfxEnabled();

    const mb = app.querySelector('#music-btn');
    if (mb) {
      mb.innerHTML =
        `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(musica ? 'music' : 'mute')}</span>` +
        `<span class="hidden md:inline font-mono">${musica ? 'Música' : 'Off'}</span>`;
      mb.className = musica
        ? 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-main)]'
        : 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-muted)] opacity-70';
      mb.setAttribute('aria-pressed', String(musica));
      mb.setAttribute('aria-label', musica ? 'Apagar música' : 'Encender música');
    }

    const sb = app.querySelector('#mute-btn');
    if (sb) {
      sb.innerHTML =
        `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(efectos ? 'sound' : 'mute')}</span>` +
        `<span class="hidden md:inline font-mono">${efectos ? 'SFX' : 'Off'}</span>`;
      sb.className = efectos
        ? 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-main)]'
        : 'w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-muted)] opacity-70';
      sb.setAttribute('aria-pressed', String(efectos));
      sb.setAttribute('aria-label', efectos ? 'Silenciar efectos' : 'Activar efectos');
    }
  };

  app.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-audio]') as HTMLElement | null;
    if (!btn) return;
    e.preventDefault();
    primeAudio();
    if (btn.dataset.audio === 'music') toggleMusic();
    else toggleMute();
  });

  onAudioStateChange(pintar);
  pintar();
}