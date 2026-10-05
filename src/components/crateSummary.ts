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
import { TOPE_PILA } from '../data/stacking';

/**
 * CUÁNTAS CAJAS SE ABREN DE UNA VEZ.
 *
 * **Y AHORA ES EL TOPE DE LA PILA, LEÍDO DE SU TABLA.** Estaba en veinte, con un
 * argumento que parecía bueno: una lista de cincuenta premios no cabe en una pantalla y
 * un scroll que esconde el final esconde justo la parte que más importa. El argumento
 * era cierto y la conclusión estaba equivocada, porque **la lista ya no es una línea por
 * caja**: `resumenDePremios()` agrupa las monedas y los materiales, así que noventa y
 * nueve cajas suelen salir en cuatro o cinco filas. Lo que no se agrupa son los objetos,
 * y treinta objetos en una columna con scroll es una columna con scroll: se ha visto
 * siempre.
 *
 * **EL NÚMERO NO SE ESCRIBE AQUÍ.** Sale de `TOPE_PILA.crate`, que es la regla de
 * almacenamiento. Diecinueve sonaba a decisión de diseño y era una **copia** del 99 de la
 * pila que se quedó vieja cuando la pila subió: dos números que hablan del mismo tope y
 * que solo se comparaban entre sí el día que alguien los comparaba. El banco `loteCheck`
 * hace esa comparación —`MAX_APERTURA_LOTE <= TOPE_PILA.crate`— y ahora que son el mismo
 * número solo puede decir que lo son.
 *
 * **LO QUE SIGUE SIENDO EL LÍMITE NO ES ESTE, SON LOS HUECOS.** Abrir noventa y nueve
 * cajas con el almacén lleno es pedir un botín que no cabe: lo que no entra **se pierde
 * sin decir nada** y el jugador ve una tirada con una línea donde no hay objeto. Por eso
 * `maximoDeApertura()` sigue acotando por los huecos libres, y por eso el mínimo sigue
 * siendo el número de huecos y no el de cajas: lo peor que puede pasar es **un hueco más
 * por apertura**.
 */
export const MAX_APERTURA_LOTE = TOPE_PILA.crate;

/**
 * Cuántas cajas se pueden abrir de golpe con lo que hay encima.
 *
 * Antes eran **tres** mínimos —cajas, llaves y tope— y los tres hacían falta. Con
 * las llaves fuera son **dos**, y el que queda es el mismo de antes: las cajas que
 * tienes, y el tope de una apertura. Sin el primero el motor se queda a medias; sin
 * el segundo, el diálogo ofrecería 45 aperturas y escondería el final de la lista
 * detrás de un scroll.
 *
 * **LO QUE NO SE HACE ES DEJAR EL PARÁMETRO DE LAS LLAVES COMO UN CERO FIJO.** Sería
 * `Math.min(cajas, 0, 20)`, o sea devolver siempre 0: la firma se queda igual, el
 * diálogo no abre nada y no hay ningún error. Un parámetro que ya no significa nada
 * es una puerta, y el que venga detrás le pasará el número que se le ocurra.
 *
 * **POR QUÉ VIVE AQUÍ Y NO EN LA VISTA.** Antes era un `Math.min` suelto dentro
 * del manejador de clic del almacén, y eso quiere decir que **ningún banco podía
 * comprobarlo**: la regla que decide cuántas cajas se abren de golpe vivía en el
 * único sitio del proyecto donde las pruebas no llegan. Es R2 en la forma más
 * silenciosa: la regla no estaba duplicada, estaba escondida.
 */
export function maximoDeApertura(cajas: number, huecosLibres = Infinity): number {
  return Math.max(
    0,
    Math.min(
      Math.floor(cajas) || 0,
      MAX_APERTURA_LOTE,
      // **EL TERCER MÍNIMO ES EL ESPACIO, Y ES EL QUE FALTABA.** Abrir veinte cajas con el
      // almacén lleno es pedir un botín que no cabe: `addToWarehouse()` devuelve `false`,
      // el premio **se pierde sin decir nada** y el jugador ve una tirada con veinte líneas
      // donde un objeto no está. Es la peor clase de fallo de una lotería: el jugador cree
      // que ha perdido el premio por mala suerte, y la culpa es del inventario.
      //
      // **POR QUÉ EL NÚMERO DE HUECOS Y NO EL DE CAJAS.** Cada apertura consume una caja y
      // puede traer un item que ocupe una ranura, o sea que lo peor que puede pasar es
      // **un hueco más por apertura**. Con los huecos que hay de límite, ninguna apertura
      // puede quedarse sin sitio. Y por qué no "huecos más uno": abrir una caja que está
      // sola en su celda libera ese hueco, pero si está en una pila de veinte la celda se
      // queda y el hueco sigue haciendo falta. El caso que no depende de la pila es el que
      // manda, y por eso el límite es el número de huecos y no un "más" para aprovechar el
      // caso fácil.
      //
      // `Infinity` es el valor por defecto para que esta función siga siendo la regla de
      // "cuántas cajas tienes" cuando se llama sin saber el almacén —los bancos, y quien
      // solo quiera el tope—. **Y SOLO `Infinity` SIGNIFICA "NO LO SE"**, con una
      // comparación exacta y no con "no es un número": un `NaN` también sale de la
      // comprobación, y tratarlo como "sin límite" dejaría abrir veinte cajas con el
      // almacén lleno, que es justo lo que este mínimo viene a impedir. Un `NaN` de huecos
      // son cero huecos —la respuesta que no promete nada— y por eso cae por `|| 0`.
      (huecosLibres === Infinity ? MAX_APERTURA_LOTE : Math.max(0, Math.floor(huecosLibres) || 0))
    )
  );
}

const LOOT_UNITS: Record<string, string> = {
  nanites: 'Nanitas',
  crystals: 'Cristales',
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
 * materiales —nanitas, cristales, cajas y consumibles— porque son
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