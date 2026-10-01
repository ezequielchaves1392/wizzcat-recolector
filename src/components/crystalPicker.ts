// ==========================================================================
//  Cristal de mejora: selector
//
//  Los cristales ahora son de varios niveles, así que "Mejorar con cristales"
//  ya no tiene un único significado: hay que elegir cuál gastar. El coste en
//  unidades y la probabilidad que da se enseñan ANTES de confirmar, porque
//  un cristal x4 que cuesta 40 unidades tiene que leerse como una apuesta.
//
//  Ordenar de mejor a peor es una decisión, no un descuido: el cristal más
//  raro es el más caro y el que más riesgo quita, así que es el que merece
//  más atención. El más barato queda al final.
//
//  El coste y la probabilidad se calculan aquí para poder pintar la lista sin
//  llamar al game loop por fila. Cuando el jugador elige, el juego los
//  recalcula y es él quien cobra: si los dos se desincronizasen, el botón
//  mostraría una cosa y ocurriría otra.
// ==========================================================================

import { ic } from '../ui/icons';
import { showToast } from '../utils/toast';
import { sfx } from '../utils/audio';
import { CRYSTAL_DEFS } from '../data/items';
import { collectorMaxLevel } from '../data/crafting';
import { previewUpgradeChance, previewUpgradeCost } from '../gameLoop';
import { rarityClass } from './crateLoot';

/**
 * Abre el selector de cristal para sintonizar el recolector equipado.
 *
 * Se llama desde la hoja de detalle, con el recolector ya equipado. La lista
 * sale del almacén real, así que solo ofrece lo que el jugador tiene.
 */
export function showCrystalPicker(game: any, redraw: () => void) {
  const state = game.getState();
  const equipo = (state.warehouse as any[]).find((w: any) => w.id === state.equippedCollectorId);

  if (!equipo) {
    showToast('Equipa un recolector primero.', 'info');
    return;
  }
  // El techo lo decide el recolector, con la MISMA regla que usa el game loop.
  // Aquí había un 35 a pelo: el máximo absoluto, que solo corresponde a un
  // recolector forjado de potencial 5. Con un recolector de la tienda (techo 20)
  // el selector se abría en el nivel 20, el jugador elegía un cristal, lo gastaba
  // y la sintonización se le rechazaba. Dos números distintos para la misma regla
  // en la misma partida: uno en la vista y otro en el motor.
  const tope = collectorMaxLevel(equipo.maxLevel);
  if ((equipo.level || 0) >= tope) {
    showToast('El recolector ya está al nivel máximo.', 'info');
    return;
  }

  const disponibles = ((state.warehouse as any[]) || [])
    .filter((w: any) => w.type === 'crystal')
    .sort((a: any, b: any) => (b.tier || 1) - (a.tier || 1));

  if (disponibles.length === 0) {
    showToast('No tienes cristales de mejora.', 'error');
    return;
  }

  const overlay = document.createElement('div');
  // `sheet-overlay` + `sheet-panel` (ver `style.css`): abajo en el móvil, que es
  // donde el pulgar llega, y centrado en escritorio. Estas cuatro utilidades
  // estaban escritas a mano aquí, y el resultado en escritorio era una hoja de
  // 90 px pegada al borde inferior de una pantalla de 900 px.
  overlay.className = 'sheet-overlay z-[70]';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="sheet-panel card-glass-elevated animate-rise-in">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ring-raro rarity-raro
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('crystal')}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight truncate">
            Sintonizar ${equipo.name}
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Nivel ${equipo.level || 0} · coste ${crystalCost(equipo.level || 0)} x cristal
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        ${disponibles.map((k: any, i: number) => {
          const t = typeof k.tier === 'number' ? k.tier : 1;
          const def = CRYSTAL_DEFS[t];
          const unidades = k.stackCount || 1;
          const coste = crystalCost(equipo.level || 0);
          const alcanza = unidades >= coste;
          const prob = previewUpgradeChance(equipo.level || 0, def?.power ?? 1);
          return `
            <button data-crystal="${k.id}" data-idx="${i}" ${alcanza ? '' : 'disabled style="opacity:.45"'}
                    class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left
                           ${alcanza ? 'cursor-pointer transition active:scale-[0.99] hover:border-[var(--accent)]' : ''}
                           border-[var(--border-color)]"
                    style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
              <span class="flex-shrink-0 ${rarityClass(k.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('crystal')}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${k.name}</span>
                <span class="block text-[9px] font-mono text-[var(--text-muted)] mt-0.5">
                  ${def?.power ?? 1}x · ${prob}% de éxito
                </span>
              </span>
              <span class="text-right flex-shrink-0">
                <span class="block text-[11px] font-mono accent-text tabular">×${unidades}</span>
                <span class="block text-[9px] font-mono ${alcanza ? 'text-[var(--text-muted)]' : 'text-rose-400'}">
                  ${alcanza ? `-${coste}` : 'faltan'}
                </span>
              </span>
            </button>`;
        }).join('')}
      </div>
    </div>
  `;

  const cerrar = () => overlay.remove();
  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.querySelectorAll('[data-crystal]:not([disabled])').forEach(b => {
    b.addEventListener('click', () => {
      const idx = Number((b as HTMLElement).dataset.idx);
      cerrar();
      sfx.use();
      const res = game.upgradeEquippedCollector(disponibles[idx].tier || 1);
      // POR QUÉ `success` Y NO `ok`. El game loop tiene DOS convenciones de
      // resultado y no están unificadas: `sellItem`, `useConsumable` y
      // `openCrateBox` devuelven `{ ok, msg }`, mientras que
      // `upgradeEquippedCollector`, la Forja y la Ascensión devuelven
      // `{ success, msg }`. Aquí se leía `res.ok`, que en un `{ success }` es
      // `undefined`: `!undefined` es `true`, así que TODA sintonización caía en
      // la rama de error. Es decir, un acierto pintaba un toast rojo de "error"
      // con el texto "¡Mejora exitosa!" dentro y sonaba el sonido de fallo. Solo
      // el fallo se veía bien, y por casualidad, porque en ese caso el mensaje
      // de error era el que tocaba. Un resultado mal leído no da ningún aviso.
      if (!res.success) {
        sfx.error();
        showToast(res.msg || 'No se pudo sintonizar.', 'error');
      } else {
        showToast(res.msg, 'success');
      }
      redraw();
    });
  });
  document.body.appendChild(overlay);
}

/**
 * Coste en unidades de cristal para subir del nivel dado.
 *
 * Delega en el game loop, no lo recalcula. La fórmula del coste tiene que estar
 * en un solo sitio: con dos copias, cambiar el coste en el juego dejaba el
 * selector enseñando la cifra vieja.
 */
function crystalCost(level: number): number {
  return previewUpgradeCost(level);
}