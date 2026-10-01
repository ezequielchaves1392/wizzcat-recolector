import { ic } from './icons';
import { formatNumber } from '../utils/format';
import { AFFIX_BY_ID, collectorMaxLevel } from '../data/crafting';

/**
 * Panel del jugador: recolector equipado y slots de companeros.
 * Vive en su propio modulo para que el banco de pruebas visuales (/preview.html)
 * reuse exactamente el mismo marcado que la partida real.
 */
export function renderPanel(
  state: any,
  realDamage: number,
  effectiveSlots?: number,
  ingresoDe?: (companionId: string) => number
) {
  // --- Recolector equipado ---
  const equippedItem = state.equippedCollectorId
    ? state.warehouse.find((w: any) => w.id === state.equippedCollectorId)
    : null;
  const collectorContainer = document.querySelector('#equipped-collector-container');

  if (collectorContainer) {
    if (equippedItem) {
      const tier = equippedItem.tier || 1;
      const level = equippedItem.level || 0;
      // Las recolectores crafteadas suben el techo: 20 normal, hasta 35 con 5 estrellas.
      // La regla es la misma que usa el game loop para decidir la sintonización, para
      // que la barra no pueda prometer un nivel que el motor luego rechace.
      const maxLevel = collectorMaxLevel(equippedItem.maxLevel);
      const rarity = equippedItem.rarity || 'Común';
      const overclocked = Boolean(equippedItem.overclock);
      // Los afijos son la diferencia entre dos recolectores del mismo tier
      const affixes: string[] = equippedItem.affixes || [];

      collectorContainer.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                      ${overclocked ? 'rarity-glow-sobrecargado' : ''}"
               style="background: color-mix(in srgb, var(--accent) 12%, transparent);
                      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
            <span class="[&>span>svg]:w-5 [&>span>svg]:h-5 accent-text">${ic('collector')}</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-['Orbitron'] font-bold text-[13px] md:text-sm
                           text-[var(--text-main)] truncate">${equippedItem.name}</span>
              <span class="label-caps px-1.5 py-0.5 rounded"
                    style="background: color-mix(in srgb, var(--accent) 14%, transparent);
                           color: var(--accent)">T${tier}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] font-mono rarity-${slug(rarity)}">${rarity}</span>
              ${overclocked ? `<span class="text-[9px] font-mono rarity-sobrecargado">· SOBRECARGADO</span>` : ''}
              ${equippedItem.potential ? `<span class="text-[9px] text-amber-400">· ${'★'.repeat(equippedItem.potential)}</span>` : ''}
            </div>
            ${affixes.length ? `
              <div class="flex items-center gap-1 flex-wrap mt-1">
                ${affixes.map(id => {
                  const a = AFFIX_BY_ID[id];
                  return a
                    ? `<span class="text-[9px] font-mono px-1 py-[1px] rounded border rarity-${slug(a.rarity)}"
                              style="border-color: currentColor" title="${a.description}">${a.name}</span>`
                    : '';
                }).join('')}
              </div>
            ` : ''}
            ${equippedItem.forgedBy ? `
              <div class="text-[9px] font-mono text-[var(--text-muted)] mt-1 truncate">
                Forjada por <span class="accent-text">${equippedItem.forgedBy}</span>
              </div>
            ` : ''}
            <!-- Barra de nivel: comunica progreso de un vistazo -->
            <div class="flex items-center gap-2 mt-2">
              <div class="flex-1 h-1 rounded-full overflow-hidden"
                   style="background: color-mix(in srgb, var(--text-main) 10%, transparent)">
                <div class="h-full rounded-full transition-[width] duration-500 ease-out"
                     style="width: ${Math.min(100, (level / maxLevel) * 100)}%;
                            background: var(--accent)"></div>
              </div>
              <span class="text-[9px] font-mono text-[var(--text-muted)] tabular flex-shrink-0">
                Nv ${level}/${maxLevel}
              </span>
            </div>
          </div>

          <div class="text-right flex-shrink-0">
            <div class="label-caps leading-none">Daño</div>
            <div class="font-['Orbitron'] font-bold text-base md:text-lg
                        leading-tight tabular mt-0.5"
                 style="color: var(--accent)">+${formatNumber(realDamage)}</div>
          </div>
        </div>
      `;
    } else {
      collectorContainer.innerHTML = `
        <div class="text-center py-5">
          <div class="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-2
                      opacity-40 [&>span>svg]:w-5 [&>span>svg]:h-5 text-[var(--text-muted)]">
            ${ic('collector')}
          </div>
          <div class="text-[11px] font-mono text-[var(--text-muted)]">
            Sin recolector equipado
          </div>
          <div class="text-[10px] font-mono text-[var(--text-muted)] opacity-70 mt-0.5">
            Equipa uno desde el almacén
          </div>
        </div>
      `;
    }
  }

  // --- Slots de compañeros ---
  const companionsContainer = document.querySelector('#companions-slots-container');
  const slotsLabel = document.querySelector('#slots-label');
  // El total de slots incluye los que aporta el árbol de pasivas. Se recibe
  // como parámetro en vez de leerse de `state.maxCompanionSlots` porque ese es
  // solo la parte comprada con nanitas: sin el ajuste, un jugador con 3 slots
  // del árbol vería "3/3 activos" con 5 huecos reales en la cuadrícula.
  const maxSlots = effectiveSlots ?? state.maxCompanionSlots ?? 1;
  if (slotsLabel) {
    const n = state.activeCompanions.length;
    slotsLabel.textContent = `${n}/${maxSlots} activos`;
  }

  if (companionsContainer) {
    const active = state.activeCompanions
      .map((id: string) => state.companions.find((c: any) => c.id === id))
      .filter(Boolean) as any[];

    let html = '';
    for (let i = 0; i < maxSlots; i++) {
      const comp = active[i];
      if (comp) {
        const isMult = comp.type === 'multiplier';
        const rarity = comp.rarity || 'Común';
        const sweep = ['Épico', 'Legendario', 'Mítico', 'Divino', 'Sobrecargado'].includes(rarity);
        // POR QUÉ PIDE LA CIFRA AL MOTOR Y NO USA `comp.power`. `power` es el
        // valor desnudo del compañero: lo que entra en la cuenta es ese número
        // después de `passiveMultiplier`, de los logros, del árbol y del buff x2.
        // Con un multiplicador de 1,5 la ficha decía "+3 /s" y el contador subía
        // 4,5 — el panel enseñando un número que no se cobraba nunca (R3).
        //
        // El reparto es proporcional y la suma de todas las fichas da
        // exactamente `state.passiveIncome`, así que los números de aquí y el
        // bloque que entra cada segundo son la misma cifra contada dos veces.
        const aporta = ingresoDe?.(comp.id);
        const valor = isMult
          ? `×${(1 + comp.power).toFixed(2).replace(/\.?0+$/, '')}`
          : `+${formatNumber(aporta ?? comp.power)}/s`;
        const label = isMult ? 'MULT' : 'INGRESO';

        html += `
          <div class="rounded-xl p-2.5 text-center border relative overflow-hidden
                      ${sweep ? 'rare-sweep' : ''}"
               style="background: var(--bg-app);
                      border-color: color-mix(in srgb, var(--accent) 35%, transparent)">
            <div class="flex justify-center mb-1.5">
              <span class="[&>span>svg]:w-5 [&>span>svg]:h-5"
                    style="color: var(--accent)">${ic(isMult ? 'sparkle' : 'companion')}</span>
            </div>
            <div class="text-[10px] font-mono text-[var(--text-main)] truncate leading-tight
                        font-semibold">${comp.name}</div>
            <div class="text-[9px] font-mono rarity-${slug(rarity)} mt-0.5 truncate">${rarity}</div>
            <div class="mt-1.5 pt-1.5 border-t"
                 style="border-color: color-mix(in srgb, var(--accent) 20%, transparent)">
              <div class="label-caps" style="font-size:8px">${label}</div>
              <div class="text-[11px] font-mono font-bold tabular mt-0.5"
                   style="color: var(--accent)">${valor}</div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="rounded-xl p-2.5 text-center border border-dashed opacity-45
                      flex flex-col items-center justify-center"
               style="border-color: var(--border-color); background: var(--bg-app)">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4 text-[var(--text-muted)] mb-1">${ic('plus')}</span>
            <div class="text-[9px] font-mono text-[var(--text-muted)] leading-tight">Vacío</div>
          </div>
        `;
      }
    }
    companionsContainer.innerHTML = html;
  }
}

/** 'Divino' -> 'divino' para las clases .rarity-* del CSS */
function slug(rarity: string): string {
  return rarity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

