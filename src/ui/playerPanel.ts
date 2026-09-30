import { ic } from './icons';
import { formatNumber } from '../utils/format';

/**
 * Panel del jugador: recolector equipado y slots de companeros.
 * Vive en su propio modulo para que el banco de pruebas visuales (/preview.html)
 * reuse exactamente el mismo marcado que la partida real.
 */
export function renderPanel(state: any, realDamage: number) {
  // --- Recolector equipado ---
  const equippedItem = state.equippedWeaponId
    ? state.warehouse.find((w: any) => w.id === state.equippedWeaponId)
    : null;
  const collectorContainer = document.querySelector('#equipped-collector-container');

  if (collectorContainer) {
    if (equippedItem) {
      const tier = equippedItem.tier || 1;
      const level = equippedItem.level || 0;
      const rarity = equippedItem.rarity || 'Común';
      const overclocked = Boolean(equippedItem.overclock);

      collectorContainer.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                      ${overclocked ? 'rarity-glow-sobrecargado' : ''}"
               style="background: color-mix(in srgb, var(--accent) 12%, transparent);
                      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
            <span class="[&>span>svg]:w-5 [&>span>svg]:h-5 accent-text">${ic('weapon')}</span>
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
            </div>
            <!-- Barra de nivel: comunica progreso de un vistazo -->
            <div class="flex items-center gap-2 mt-2">
              <div class="flex-1 h-1 rounded-full overflow-hidden"
                   style="background: color-mix(in srgb, var(--text-main) 10%, transparent)">
                <div class="h-full rounded-full transition-[width] duration-500 ease-out"
                     style="width: ${Math.min(100, (level / 20) * 100)}%;
                            background: var(--accent)"></div>
              </div>
              <span class="text-[9px] font-mono text-[var(--text-muted)] tabular flex-shrink-0">
                Nv ${level}/20
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
            ${ic('weapon')}
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
  const maxSlots = state.maxCompanionSlots || 1;
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
        const value = isMult
          ? `×${(1 + comp.power).toFixed(2).replace(/\.?0+$/, '')}`
          : `+${formatNumber(comp.power)}/s`;
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
                   style="color: var(--accent)">${value}</div>
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

