// HUD de buffs: tarjetas compactas con contador, barra de progreso y botón de
// cancelar. Vive aparte para que el banco de pruebas (/preview.html) lo reuse.
//
// Dos copias del mismo markup: una en la cabecera (escritorio, `lg:`) y otra bajo
// la cabecera (móvil). Se parchean a la vez para que no haya dos implementaciones.

import { ic, type IconName } from './icons';
import { totalConcedidoDe, sePuedeCancelar, BUFF_LABELS, type BuffKey } from '../data/buffs';

/**
 * El HUD de buffs, y **por qué la barra usa el total concedido y no la duración de la
 * tarjeta**.
 *
 * ## LA BARRA MENTÍA, Y EN EL CASO QUE LA HACÍA INÚTIL
 *
 * Era `restante / durationMs`, con `durationMs` siendo **una** tarjeta. Pero el motor
 * **acumula**: tres tarjetas de click x2 de treinta segundos dejan el buff puesto
 * treinta minutos. O sea que el denominador era treinta segundos para algo que puede
 * durar media hora, y la barra se quedaba clavada en el 100 % mientras el contador
 * corría: se veía como una barra muerta, que es peor que no tener barra porque el
 * jugador lee "no está haciendo nada" de un buff que sí está haciendo.
 *
 * Los tres buffs con el problema eran el `clickX2`, el `clickX3` y el `passiveBoost`;
 * el `clickBoost` y el AFK casualmente tenían tope igual a una tarjeta, y por eso
 * parecían bien.
 *
 * ## Y POR QUÉ NO SIRVE EL TECHO
 *
 * Porque con una sola tarjeta de treinta segundos la barra saldría al 1,6 % del tope de
 * treinta minutos, y eso parece un buff a punto de expirar cuando acaba de empezar. El
 * denominador honrado es **lo que se concedió en el último uso**, que no se deduce de
 * nada guardado: por eso hay un campo por buff (`BUFF_TOTAL_FIELDS`).
 *
 * ## EL `0` ES "NO SE SABE", Y ESTÁ TRATADO
 *
 * Las partidas viejas no tienen el campo, y la carga lo coacciona a 0. Con 0 se vuelve
 * a la duración de una tarjeta, que es lo que se pintaba antes: **el cambio degrada al
 * comportamiento anterior en vez de romper**, y nunca sale un `NaN` al `style`, que es
 * lo que hace que la barra desaparezca sin que se entienda por qué.
 */
export interface BuffDef {
  key: string;
  icon: IconName;
  label: string;
  tag?: string;
  durationMs: number;
  /** Clases completas y literales: el generador de Tailwind debe verlas */
  accent: string;
  bar: string;
  getExpires: (state: any) => number;
  /**
   * Cuánto se concedió en el último uso. `0` significa "no se sabe" y el denominador
   * cae a `durationMs`. Sale de `totalConcedidoDe()`, que es donde vive el campo.
   */
  getTotal: (state: any) => number;
}

export const BUFF_DEFS: BuffDef[] = [
  {
    key: 'clickBoost', icon: 'bolt', label: 'Clicks x2', durationMs: 30 * 60 * 1000,
    accent: 'border-emerald-500/40 text-emerald-500 dark:text-emerald-400',
    bar: 'bg-emerald-400',
    getExpires: (s) => s.buffs.clickBoostExpiresAt,
    getTotal: (s) => totalConcedidoDe(s, 'clickBoost')
  },
  {
    key: 'clickX2', icon: 'bolt', label: 'Clicks x2', tag: 'rápida', durationMs: 30 * 1000,
    accent: 'border-cyan-500/40 text-cyan-500 dark:text-cyan-400',
    bar: 'bg-cyan-400',
    getExpires: (s) => s.buffs.clickX2ExpiresAt,
    getTotal: (s) => totalConcedidoDe(s, 'clickX2')
  },
  {
    key: 'clickX3', icon: 'bolt', label: 'Clicks x3', tag: 'rápida', durationMs: 30 * 1000,
    accent: 'border-purple-500/40 text-purple-500 dark:text-purple-400',
    bar: 'bg-purple-400',
    getExpires: (s) => s.buffs.clickX3ExpiresAt,
    getTotal: (s) => totalConcedidoDe(s, 'clickX3')
  },
  {
    key: 'passiveBoost', icon: 'shield', label: 'Recolección por segundo x2', durationMs: 60 * 60 * 1000,
    accent: 'border-blue-500/40 text-blue-500 dark:text-blue-400',
    bar: 'bg-blue-400',
    getExpires: (s) => s.buffs.passiveBoostExpiresAt,
    getTotal: (s) => totalConcedidoDe(s, 'passiveBoost')
  },
  {
    key: 'afk', icon: 'card', label: 'AFK', durationMs: 30 * 60 * 1000,
    accent: 'border-amber-500/40 text-amber-500 dark:text-amber-400',
    bar: 'bg-amber-400',
    getExpires: (s) => s.afkExpiresAt,
    getTotal: (s) => totalConcedidoDe(s, 'afk')
  }
];

let built = false;

function buildCard(def: BuffDef): string {
  return `
    <div data-buff="${def.key}"
         class="hidden card-glass border ${def.accent} rounded-xl pl-1.5 pr-1 py-1
                flex items-center gap-1.5 flex-shrink-0">
      <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(def.icon)}</span>
      <span class="flex flex-col gap-1">
        <span class="flex items-baseline gap-1.5 leading-none whitespace-nowrap">
          <span class="text-[10px] font-mono font-bold">${def.label}</span>
          ${def.tag ? `<span class="text-[9px] font-mono uppercase tracking-wider opacity-55">${def.tag}</span>` : ''}
          <span data-role="time" class="text-[10px] font-mono tabular-nums opacity-75">0:00</span>
        </span>
        <span class="h-[2.5px] w-full rounded-full bg-black/40 overflow-hidden block">
          <span data-role="bar"
                class="block h-full rounded-full ${def.bar}
                       transition-[width] duration-500 ease-linear"
                style="width:100%"></span>
        </span>
      </span>
      <!--
        LA CRUCE SOLO SI LA REGLA DICE QUE SI, Y VA EN EL IF Y NO EN UN DISABLED:
        un boton apagado encima de una cruce sigue siendo un boton que parece que se
        puede pulsar, y el jugador no tiene forma de saber por que no hace nada.
        La regla es sePuedeCancelar(), la misma que lee el motor: si aqui y alla se
        separan, uno deja de cancelar y el otro sigue.
      -->
      ${sePuedeCancelar(def.key) ? `
      <button data-cancel="${def.key}" title="Cancelar ${def.label}" aria-label="Cancelar ${def.label}"
              class="hit-expand w-5 h-5 flex items-center justify-center rounded-md text-[11px] leading-none
                     opacity-40 hover:opacity-100 hover:bg-white/10 active:scale-90
                     transition cursor-pointer shrink-0">${ic('close', 'w-3 h-3')}</button>
      ` : ''}
    </div>
  `;
}

function buildAll(): string {
  return BUFF_DEFS.map(buildCard).join('') + `
    <div data-buff="global"
         class="hidden card-glass border border-sky-500/40 rounded-xl px-2 py-1
                text-[10px] font-mono text-sky-500 dark:text-sky-400 flex-shrink-0 whitespace-nowrap">
      ${ic('sparkle', 'w-3 h-3 mr-1')}Global ×<span data-role="value">1</span>
    </div>
  `;
}

/**
 * Parchea las tarjetas. Se crean una sola vez y luego solo se actualizan el
 * contador y la barra: reescribir el innerHTML en cada tick destruiría el nodo
 * entre mousedown y mouseup y el clic en la X se perdería.
 */
export function renderBuffHud(state: any, now: number, force = false): void {
  const roots = [
    document.querySelector('#active-buffs-hud'),
    document.querySelector('#buffs-hud-mobile')
  ].filter(Boolean) as HTMLElement[];
  if (roots.length === 0) return;

  if (!built || force) {
    const html = buildAll();
    roots.forEach(r => { r.innerHTML = html; });
    built = true;
  }

  for (const def of BUFF_DEFS) {
    const remaining = Math.max(0, def.getExpires(state) - now);
    const timeText = formatCountdown(remaining);
    // **EL DENOMINADOR ES LO QUE SE CONCEDIÓ, Y SI NO SE SABE, UNA TARJETA.**
    // El `||` no es una comodidad: una partida vieja llega sin el campo y la carga lo
    // deja en 0, y sin esto el denominador sería 0 y la barra daría NaN, que es un
    // `width` inválido y una barra que desaparece sin motivo aparente.
    const total = def.getTotal(state) || def.durationMs;
    const width = `${Math.max(0, Math.min(100, (remaining / total) * 100))}%`;

    for (const root of roots) {
      const card = root.querySelector(`[data-buff="${def.key}"]`);
      if (!card) continue;
      card.classList.toggle('hidden', remaining <= 0);
      if (remaining <= 0) continue;
      const timeEl = card.querySelector('[data-role="time"]');
      if (timeEl) timeEl.textContent = timeText;
      const barEl = card.querySelector('[data-role="bar"]') as HTMLElement | null;
      if (barEl) barEl.style.width = width;
    }
  }

  // El multiplicador global no es un consumible: se informa, no se cancela
  const mult = Number(state.passiveMultiplier) || 1;
  for (const root of roots) {
    const card = root.querySelector('[data-buff="global"]');
    if (!card) continue;
    card.classList.toggle('hidden', mult <= 1);
    const valueEl = card.querySelector('[data-role="value"]');
    if (valueEl) valueEl.textContent = mult.toFixed(2).replace(/\.?0+$/, '');
  }
}

/** Obliga a reconstruir las tarjetas: se usa al volver de un layout distinto. */
export function resetBuffHud(): void {
  built = false;
}

/** Solo para el banco de pruebas. */
export function renderBuffHudForPreview(state: any): void {
  renderBuffHud(state, Date.now(), true);
}

/** mm:ss, o h:mm:ss a partir de una hora */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * El nombre del buff para el dialogo que lo confirma.
 *
 * **LEE LA TABLA COMPARTIDA Y NO `BUFF_DEFS`.** El dialogo ("Se pierde el tiempo
 * restante de X") y el aviso que sale al confirmarlo ("X cancelado") son los dos
 * momentos en los que el jugador lee el nombre del buff, y los dos tienen que
 * decir lo mismo: si cada uno mirara su tabla, un renombre moveria una y no la
 * otra. La tabla es `BUFF_LABELS`, en `data/buffs.ts`, y `cancelBuff()` devuelve
 * el mismo valor.
 */
export function buffLabel(key: string): string {
  return BUFF_LABELS[key as BuffKey] ?? 'el buff';
}
