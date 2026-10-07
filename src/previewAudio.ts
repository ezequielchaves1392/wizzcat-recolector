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

    // **EL MISMO FORMATO QUE ESCRIBE `settingsSheetHTML()`, Y POR QUÉ TIENE QUE COINCIDIR.**
    // Estos botones ya no viven en la cabecera: viven en la hoja de ajustes, que usa
    // celdas de rejilla con su texto siempre visible. Con las clases de antes —w-9, texto
    // oculto en móvil— el interruptor salía diminuto y sin su palabra, que es peor que no
    // verlo porque parece un botón roto.
    const PINTAR = 'h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer' +
      ' flex items-center justify-center gap-1.5 transition-colors';

    const mb = app.querySelector('#music-btn');
    if (mb) {
      mb.innerHTML =
        `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(musica ? 'music' : 'mute')}</span>` +
        `<span>${musica ? 'Música' : 'Música off'}</span>`;
      mb.className = PINTAR + (musica ? ' text-[var(--text-main)]' : ' text-[var(--text-muted)] opacity-70');
      mb.setAttribute('aria-pressed', String(musica));
      mb.setAttribute('aria-label', musica ? 'Apagar música' : 'Encender música');
    }

    const sb = app.querySelector('#mute-btn');
    if (sb) {
      sb.innerHTML =
        `<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic(efectos ? 'sound' : 'mute')}</span>` +
        `<span>${efectos ? 'Efectos' : 'Efectos off'}</span>`;
      sb.className = PINTAR + (efectos ? ' text-[var(--text-main)]' : ' text-[var(--text-muted)] opacity-70');
      sb.setAttribute('aria-pressed', String(efectos));
      sb.setAttribute('aria-label', efectos ? 'Silenciar efectos' : 'Activar efectos');
    }
  };

  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // **ABRIR Y CERRAR LA HOJA, QUE ANTES NO SE PODÍA COMPROBAR AQUÍ.**
    //
    // En el juego lo abre y lo cierra el `app.onclick` de `renderBase`, que no existe en el
    // preview. Sin esto, la hoja se veía bien y no respondía a nada —y es exactamente el
    // fallo que sale al revisar la cabecera, en el banco en lugar de en el producto.
    const hoja = () => app.querySelector('[data-ajustes]');
    if (target.closest('[data-cerrar-ajustes]')) {
      e.preventDefault();
      hoja()?.classList.add('hidden');
      return;
    }
    if (target.closest('[data-abrir-ajustes]')) {
      e.preventDefault();
      hoja()?.classList.remove('hidden');
      return;
    }

    const btn = target.closest('[data-audio]') as HTMLElement | null;
    if (btn) {
      e.preventDefault();
      primeAudio();
      if (btn.dataset.audio === 'music') toggleMusic();
      else toggleMute();
    }
  });

  onAudioStateChange(pintar);
  pintar();
}