// ==========================================================================
//  Apertura en lote: la lista de lo que salió de N cajas
//
//  Un lote no es N ruletas. Es N tiradas —una por caja, con su propia
//  probabilidad y su propio botín— pero **enseñarlas una a una es mentira sobre
//  lo que pasó**: veinte cajas no son veinte eventos, son un resultado. El
//  jugador que abre veinte quiere saber qué se lleva, no ver veinte trompos.
//
//  Y el número que importa no es el del medio premio: es la suma. "10 veces
//  nanitas" no son diez noticias, es una cifra, y teacharla partida en veinte
//  casillas obliga al jugador a sumar a mano para saber cuánto tiene. La fila de
//  nanitas sale una, con el total ya sumado, y **no hay un cuadro aparte que la
//  repita**: un número que aparece dos veces en la misma pantalla hace que el
//  jugador se pregunte cuál de los dos es el bueno.
//
//  Lo que sale de la ruleta es lo que entra en la lista, premio por premio y sin
//  recalcular nada: la ruleta sigue decidiendo con `pickLoot()` y el mismo
//  `resolveLootAmount()` que cuando se abre de una en una.
// ==========================================================================

import { sfx } from '../utils/audio';
import { ic, type IconName } from '../ui/icons';
import {
  isCountedLoot, lootAmountText, rarityClass,
  RARITY_GLOW, RARITY_TEXT, RARITY_RANK, CRATE_META,
  type CrateReward
} from './crateLoot';
import { formatNumber } from '../utils/format';
import type { CrateType } from '../data/store';

/**
 * CUÁNTAS CAJAS SE ABREN DE UNA VEZ.
 *
 * **Y POR QUÉ 20 SI LA PILA CABE 99.** Antes eran el mismo número y no era
 * casualidad: veinte cajas era exactamente una pila, así que el diálogo y la
 * esquina de la celda decían lo mismo. Con la caja apilando de 99 en 99 (G3) los
 * dos topes se separan, y este ya no es el del almacén: es una decisión de
 * **cuántas aperturas de golpe se le ofrecen a alguien**.
 *
 * **Y NO ES MÁS PORQUE UNA LISTA DE 50 PREMIOS NO CABE EN UNA PANTALLA.** Con 20
 * caben en una columna con scroll y el jugador ve el total sin desplazar. Un tope
 * más alto no daría más información: daría un scroll que esconde el final, que
 * es justo la parte que más importa. Subir el tope de pila a 99 **no obliga** a
 * subir este: son dos cosas distintas y atarlas era casualidad.
 */
export const MAX_APERTURA_LOTE = 20;

/**
 * Cuántas cajas se pueden abrir de golpe con lo que hay encima.
 *
 * Son tres mínimos y **los tres hacen falta, por motivos distintos**: las cajas
 * que tienes, las llaves que tienes y el tope de una apertura. Sin los dos
 * primeros el motor se queda a medias; sin el tercero, el diálogo ofrecería 45
 * aperturas y escondería el final de la lista detrás de un scroll.
 *
 * **POR QUÉ VIVE AQUÍ Y NO EN LA VISTA.** Antes era un `Math.min` suelto dentro
 * del manejador de clic del almacén, y eso quiere decir que **ningún banco podía
 * comprobarlo**: la regla que decide cuántas cajas se abren de golpe vivía en el
 * único sitio del proyecto donde las pruebas no llegan. Es R2 en la forma más
 * silenciosa: la regla no estaba duplicada, estaba escondida.
 */
export function maximoDeApertura(cajas: number, llaves: number): number {
  return Math.max(
    0,
    Math.min(
      Math.floor(cajas) || 0,
      Math.floor(llaves) || 0,
      MAX_APERTURA_LOTE
    )
  );
}

const LOOT_UNITS: Record<string, string> = {
  nanites: 'Nanitas',
  crystals: 'Cristales',
  keys: 'Llaves',
  crate: 'Cajas',
  consumable: 'Unidades'
};

/** Una fila del resumen. `veces` es cuántas cajas lo sacaron. */
export interface ResumenFila {
  reward: CrateReward;
  /** Unidades sumadas de este premio. */
  total: number;
  /** Cuántas veces salió. */
  veces: number;
}

/**
 * La clave con la que dos premios se suman.
 *
 * **LO QUE SE SUMA Y LO QUE NO, Y POR QUÉ.** Se suman las monedas y los
 * materiales —nanitas, cristales, llaves, cajas y consumibles— porque son
 * intercambiables entre sí y al jugador le importa la cantidad, no cuántas veces
 * le salieron. **Los objetos no se suman**: dos Drones Explorador son dos drones,
 * y escribirlos como "×2" hidingaría que hay dos celdas ocupadas y dos compañeros
 * que elegir. Cada compañero, cada recolector y cada cosmético sale en su fila,
 * con su nombre y su poder.
 *
 * Los materiales se agrupan **por lo que son, no por su nombre**: el cristal T3
 * de la caja T3 y el de la T4 son el mismo material y van a la misma fila. Por eso
 * la clave lleva el `materialTier` o el `keyTier` y no solo el nombre.
 */
function claveDeFila(premio: CrateReward, i: number): string {
  switch (premio.kind) {
    case 'nanites': return 'nanites';
    case 'crystals': return `crystals:${premio.materialTier ?? 1}`;
    case 'keys': return `keys:${premio.keyTier ?? 1}`;
    case 'crate': return `crate:${premio.name}`;
    case 'consumable': return `consumable:${premio.name}`;
    // Los objetos llevan su índice, así que nunca se suman entre sí: cada uno es
    // una fila. El índice es lo que los mantiene separados sin tener que comparar
    // nombres, que pueden repetirse legítimamente (dos Drones del mismo nombre).
    default: return `obj:${i}`;
  }
}

/**
 * Agrupa N premios en filas sumadas.
 *
 * Es una función pura y sin DOM a propósito: lo que decide cómo se agrupa es una
 * regla del juego, y una regla que vive dentro de un `innerHTML` no se puede
 * comprobar con un banco.
 */
export function resumenDePremios(premios: CrateReward[]): ResumenFila[] {
  const porClave = new Map<string, ResumenFila>();
  const salida: ResumenFila[] = [];

  for (let i = 0; i < premios.length; i++) {
    const p = premios[i];
    const clave = claveDeFila(p, i);
    const previa = porClave.get(clave);
    const unidades = p.amount ?? 1;

    if (previa) {
      previa.total += unidades;
      previa.veces++;
      continue;
    }
    const fila: ResumenFila = { reward: p, total: unidades, veces: 1 };
    porClave.set(clave, fila);
    salida.push(fila);
  }

  return salida;
}

/**
 * La lista de lo que salió de un lote de cajas.
 *
 * `abiertas` y `pedidas` se enseñan siempre los dos: cuando coinciden, el jugador
 * ve que se abrió todo; cuando no, ve que se paró y por qué, en el sitio donde se
 * decide si le importa. Un "se abrieron 12 de 20" escondido en un aviso que se
 * va solo es información que ya no está.
 */
export function showCrateSummary(
  premios: CrateReward[],
  opts: { crateType: CrateType; pedidas: number; motivo?: string },
  onClose: () => void
) {
  const meta = CRATE_META[opts.crateType];
  const filas = resumenDePremios(premios);

  // Y LA SUMA DE LAS NANITAS ESTÁ EN SU FILA, Y SOLO EN SU FILA.
  //
  // La primera versión de esta hoja enseñaba además, debajo de la lista, un cuadro
  // grande con "TOTAL EN NANITAS". Y eran **el mismo número dos veces**: una vez
  // como la fila de nanitas de la lista y otra como el total de abajo. Lo pedido
  // era que las cantidades se acumulasen —que saliera "600" y no tres "+200"— y
  // eso ya lo hace la fila. El cuadro de abajo no añadía información: obligaba a
  // mirar el mismo sitio dos veces y a preguntarse cuál de los dos es el bueno.
  //
  // Por eso **no se calcula ningún total aparte**: lo que se ve es la lista, y la
  // lista ya está sumada por `resumenDePremios()`. Una cifra que se calcula dos
  // veces es una cifra que un día discrepa de la otra.
  //
  // Y en vez de ese cuadro, lo que se distingue es la fila: la de nanitas se
  // pinta más grande y con más fondo. La cifra que el jugador va a buscar se
  // encuentra sin contar filas.
  const hayNanitas = filas.some(f => f.reward.kind === 'nanites');

  const filaHtml = (f: ResumenFila): string => {
    const r = f.reward;
    const rarityColor = rarityClass(r.rarity);
    const glow = RARITY_GLOW[r.rarity] || '';
    const unit = LOOT_UNITS[r.kind] ?? '';
    const counted = isCountedLoot(r);
    // **LA FILA DE NANITAS SE PINTA DISTINTA**, y es lo único que esta hoja
    // destaca. Antes había un cuadro de total debajo; al quitarlo, la cifra que
    // el jugador va a buscar es la de esta fila, y si se lee como las demás
    // obligaría a contar las filas para encontrarla.
    const esNanitas = r.kind === 'nanites';
    // "×3" solo cuando el mismo material salió más de una vez. Con un uno, el
    // asterisco sería ruido en todas las filas.
    const veces = f.veces > 1 ? `<span class="text-[9px] font-mono opacity-70 ml-1">×${f.veces}</span>` : '';
    return `
      <div class="flex items-center gap-3 rounded-xl border ${rarityColor} px-3 ${esNanitas ? 'py-3' : 'py-2'} ${glow}" style="background: color-mix(in srgb, var(--accent) ${esNanitas ? 14 : 6}%, transparent)">
        <span class="flex-shrink-0 ${RARITY_TEXT[r.rarity] || ''} [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(r.icon as IconName)}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${r.name}${veces}</span>
          <span class="block text-[9px] font-mono text-[var(--text-muted)] truncate">${r.rarity}${unit ? ` · ${unit}` : ''}</span>
        </span>
        <span class="text-right flex-shrink-0">
          ${counted ? `<span class="block ${esNanitas ? 'text-[17px]' : 'text-[13px]'} font-mono font-bold accent-text tabular">+${formatNumber(f.total)}</span>` : ''}
          ${!counted && f.total > 1 ? `<span class="block text-[11px] font-mono text-[var(--text-muted)]">×${f.total}</span>` : ''}
          ${r.item ? '<span class="block text-[9px] font-mono text-[var(--text-muted)]">✓ Almacén</span>' : ''}
        </span>
      </div>`;
  };

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-4 app-bg';
  overlay.innerHTML = `
    <div class="text-center flex-shrink-0">
      <div class="mb-2 [&>span>svg]:w-8 [&>span>svg]:h-8" style="color: var(--accent)">${ic(meta.icon as IconName)}</div>
      <h2 class="font-['Orbitron'] font-black text-base tracking-wider" style="color: var(--accent)">
        ${meta.name.toUpperCase()}
      </h2>
      <p class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">
        ${premios.length} ${premios.length === 1 ? 'CAJA ABIERTA' : 'CAJAS ABIERTAS'}
        ${opts.pedidas !== premios.length ? ` DE ${opts.pedidas}` : ''}
      </p>
    </div>

    <div class="card-glass-elevated border rounded-2xl w-full max-w-md max-h-[55vh] overflow-y-auto flex flex-col gap-1.5 p-3">
      ${filas.map(filaHtml).join('')}
      ${!hayNanitas ? '<p class="text-[10px] font-mono text-center pt-1" style="color: var(--text-muted)">Esta vez no salieron nanitas.</p>' : ''}
    </div>

    ${opts.motivo ? `<p class="text-[10px] font-mono text-center" style="color: var(--text-muted)">${opts.motivo}</p>` : ''}

    <button data-role="close" class="px-6 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer flex-shrink-0">
      CONTINUAR
    </button>`;
  document.body.appendChild(overlay);

  const mejorRareza = filas.reduce((a, f) => Math.max(a, RARITY_RANK[f.reward.rarity] ?? 0), 0);
  if (mejorRareza >= 4) sfx.jackpot();
  else if (mejorRareza >= 2) sfx.reward(true);
  else sfx.reward(false);

  const cerrar = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose();
  };
  overlay.querySelector('[data-role="close"]')?.addEventListener('click', cerrar);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cerrar();
  };
  document.addEventListener('keydown', onKey);
}