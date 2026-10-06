/**
 * LAS FICHAS DE UN RECOLECTOR Y DE UN COMPAÑERO, SUELTAS Y CON SU ASPECTO.
 *
 * ## POR QUÉ ESTÁN AQUÍ Y NO DENTRO DE `renderPanel()`
 *
 * Porque la ficha pública de un jugador tiene que enseñar los recolectores y los
 * compañeros **exactamente como los enseña la pantalla de inicio**, y la forma de que eso
 * sea verdad mañana no es prometerlo: es que las dos pinten con la misma función. Si cada
 * una tuviera su markup, un día cambiaría el color de la rareza en una y no en la otra, y
 * quien lo notaría es un jugador mirando el perfil de otro.
 *
 * ## Y POR QUÉ NO ES LO MISMO QUE LA PANTALLA DE INICIO ENTERA
 *
 * Porque el inicio enseña **la partida viva**: el daño por clic con su desglose de bonos,
 * y el ingreso que el motor calcula con los multiplicadores del árbol. Eso no lo sabe
 * quien mira un perfil ajeno —es estado del dueño— y aquí no se inventa. Lo que sí se
 * puede enseñar es lo que el dueño publicó: qué objeto es, de qué rareza, sus afijos, quién
 * lo forjó, su descripción y su barra de nivel.
 *
 * O sea: **el aspecto es el mismo y los datos son los que hay.** Un número inventado en
 * una pantalla comparativa es peor que un hueco, porque el hueco se ve.
 */

import { ic } from './icons';
import { formatNumber } from '../utils/format';
import { AFFIX_BY_ID, collectorMaxLevel, estrellasDe } from '../data/crafting';

/** 'Divino' -> 'divino' para las clases .rarity-* del CSS */
export function slug(rarity: string): string {
  return rarity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Lo que se puede enseñar de un recolector. Es un `any` a propósito: aquí llegan dos cosas distintas. */
export interface RecolectorPintable {
  id: string;
  name: string;
  tier?: number;
  level?: number;
  maxLevel?: number;
  potential?: number;
  rarity?: string;
  affixes?: string[];
  forgedBy?: string;
  details?: string;
}

/**
 * LA FICHA DEL RECOLECTOR, con el aspecto del panel del inicio.
 *
 * `columnaDerecha` es lo que va donde en el inicio va el daño: **quien mira un perfil
 * ajeno no puede recibir esa cifra**, así que la hoja le pasa otra cosa —el potencial, que
 * es lo que el dueño sí publicó— o nada, y la ficha se queda con el nombre a la derecha.
 */
export function fichaDeRecolector(
  w: RecolectorPintable,
  columnaDerecha?: { etiqueta: string; valor: string; title?: string }
): string {
  const tier = w.tier || 1;
  const level = w.level || 0;
  // El techo sale de la misma función que usa el motor para la sintonización, para que la
  // barra no pueda prometer un nivel que luego el motor rechaza.
  const maxLevel = collectorMaxLevel(w.maxLevel);
  const rarity = w.rarity || 'Común';
  const affixes: string[] = w.affixes || [];

  return `
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
           style="background: color-mix(in srgb, var(--accent) 12%, transparent);
                  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
        <span class="accent-text">${ic('collector', 'w-5 h-5')}</span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-['Orbitron'] font-bold text-[13px] md:text-sm
                       text-[var(--text-main)] truncate">${w.name}</span>
          <span class="label-caps px-1.5 py-0.5 rounded"
                style="background: color-mix(in srgb, var(--accent) 14%, transparent);
                       color: var(--accent)">T${tier}</span>
        </div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-[10px] font-mono rarity-${slug(rarity)}">${rarity}</span>
          ${w.potential ? `<span class="text-[9px] text-amber-400">· ${estrellasDe(w.potential)}</span>` : ''}
        </div>
        ${w.details ? `
          <div class="text-[10px] font-mono text-[var(--text-muted)] mt-1 truncate">
            ${w.details}
          </div>` : ''}
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
        ${w.forgedBy ? `
          <div class="text-[9px] font-mono text-[var(--text-muted)] mt-1 truncate">
            Forjada por <span class="accent-text">${w.forgedBy}</span>
          </div>
        ` : ''}
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

      ${columnaDerecha ? `
        <div class="text-right flex-shrink-0">
          <div class="label-caps leading-none">${columnaDerecha.etiqueta}</div>
          <div class="font-['Orbitron'] font-bold text-base md:text-lg
                      leading-tight tabular mt-0.5"
               style="color: var(--accent)" title="${columnaDerecha.title ?? ''}">
            ${columnaDerecha.valor}
          </div>
        </div>` : ''}
    </div>
  `;
}

/** Lo que se puede enseñar de un compañero. */
export interface CompaneroPintable {
  id: string;
  name: string;
  type?: string;
  power?: number;
  rarity?: string;
}

/**
 * LA CASILLA DEL COMPAÑERO, con el aspecto de la rejilla del inicio.
 *
 * `aporta` es el ingreso **real** cuando quien pinta lo tiene a mano —la pantalla de
 * inicio se lo pide al motor— y aquí es `undefined`, así que se enseña el `power` guardado,
 * que es el valor desnudo del objeto. **Va con la etiqueta que corresponde**: un
 * multiplicador enseña `×1,5` y no "+3/s", porque no ingreso sino factor.
 */
export function casillaDeCompanero(c: CompaneroPintable, aporta?: number): string {
  const isMult = c.type === 'multiplier';
  const rarity = c.rarity || 'Común';
  const sweep = ['Épico', 'Legendario', 'Mítico', 'Divino'].includes(rarity);
  const valor = isMult
    ? `×${(1 + (c.power ?? 0)).toFixed(2).replace(/\.?0+$/, '')}`
    : `+${formatNumber(aporta ?? c.power ?? 0)}/s`;
  const label = isMult ? 'MULT' : 'INGRESO';

  return `
    <div class="rounded-xl p-2.5 text-center border relative overflow-hidden
                ${sweep ? 'rare-sweep' : ''}"
         style="background: var(--bg-app);
                border-color: color-mix(in srgb, var(--accent) 35%, transparent)">
      <div class="flex justify-center mb-1.5">
        <span style="color: var(--accent)">${ic(isMult ? 'sparkle' : 'companion', 'w-5 h-5')}</span>
      </div>
      <div class="text-[10px] font-mono text-[var(--text-main)] truncate leading-tight
                  font-semibold">${c.name}</div>
      <div class="text-[9px] font-mono rarity-${slug(rarity)} mt-0.5 truncate">${rarity}</div>
      <div class="mt-1.5 pt-1.5 border-t"
           style="border-color: color-mix(in srgb, var(--accent) 20%, transparent)">
        <div class="label-caps" style="font-size:8px">${label}</div>
        <div class="text-[11px] font-mono font-bold tabular mt-0.5"
             style="color: var(--accent)">${valor}</div>
      </div>
    </div>
  `;
}