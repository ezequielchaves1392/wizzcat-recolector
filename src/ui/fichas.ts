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
import { marcoDeBrillo, textoDeBrillo } from './brillo';
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
  /**
   * No se usa: el brillo lo necesita y aquí se pone a mano, porque esta ficha **es** la
   * de un recolector. Está en la interfaz solo para que quien la construya sepa que el
   * campo existe en el item real del almacén y no se sorprenda de que falte aquí.
   */
  type?: string;
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
 * Qué pestaña de la columna está abierta.
 *
 * **NO SE GUARDA, A PROPÓSITO.** Es de lo poco que no merece persistencia: el jugador
 * abre el escuadrón, mira y vuelve a la base; si mañana vuelve a entrar al juego, empezar
 * en "Recolector" es lo razonable. Guardarlo en el almacenamiento local sería un ajuste
 * más que explicar y un dato que puede quedarse viejo sin que nadie lo note.
 */
let pestanaActual: 'recolector' | 'escuadron' = 'recolector';

/** Los dos nombres de pestaña, escritos una sola vez. */
export const PESTANAS = ['recolector', 'escuadron'] as const;
export type Pestana = (typeof PESTANAS)[number];

/** Cambia de pestaña. Lo llama el manejador por delegación de `main.ts`. */
export function cambiaDePestana(destino: string): boolean {
  if (!(PESTANAS as readonly string[]).includes(destino)) return false;
  pestanaActual = destino as Pestana;
  aplicarPestana();
  return true;
}

/**
 * Pinta la pestaña activa.
 *
 * **LOS DOS PANELES SE PIN TAN SIEMPRE, Y LO QUE CAMBIA ES QUE SE VEN.** El recolector
 * y el escuadón no dejan de existir al cambiar de pestaña: el número grande del
 * recolector se sigueorefrescando en cada repintado, y el ingreso del escuadón también.
 * Si el panel oculto no se pintara, al volver a él habría un hueco vacío hasta el
 * siguiente guardado — y ese hueco sería justo lo que el jugador quiere mirar.
 *
 * El botón activo se pinta con el color de acento y el inactivo se apaga, en vez de
 * mover un borde: el mismo criterio que usa el nav, para que los dos se lean igual.
 */
export function aplicarPestana(): void {
  for (const nombre of PESTANAS) {
    const panel = document.getElementById('panel-' + nombre);
    if (panel) panel.classList.toggle('hidden', nombre !== pestanaActual);
    const boton = document.querySelector('[data-pestana="' + nombre + '"]') as HTMLElement | null;
    if (!boton) continue;
    const activo = nombre === pestanaActual;
    boton.setAttribute('aria-selected', String(activo));
    boton.setAttribute('tabindex', activo ? '0' : '-1');
    boton.classList.toggle('accent-text', activo);
    boton.style.color = activo ? 'var(--accent)' : '';
    boton.style.background = activo
      ? 'color-mix(in srgb, var(--accent) 16%, transparent)'
      : '';
  }
}

/**
 * LA FICHA DEL RECOLECTOR, con el aspecto del panel del inicio.
 *
 * `columnaDerecha` es lo que va donde en el inicio va el daño. Desde F83, quien mira
 * un perfil ajeno sí recibe una cifra: el daño final recalculado de su tarjeta
 * (arma más pasivos, sin temporales), con el partido en el `title`. Si no hay arma
 * no hay cifra y la ficha se queda con el nombre a la derecha.
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

  // **EL TIPO SE PONE AQUÍ, Y NO VIENE EN EL OBJETO.** El brillo necesita saber si el
  // item tiene techo de nivel de recolector o de compañero, y `RecolectorPintable` no
  // lo trae: quien pinta esta ficha sabe que es un recolector, y decirlo aquí es más
  // honesto que publicarlo en el perfil —donde además tendría que coaccionarse al
  // leer—. **Y ES LO QUE PERMITE QUE LA TARJETA Y LA BASE COINCIDAN**: las dos pintan
  // esta misma función, así que el brillo sale del mismo número en las dos sin que
  // nadie tenga que acordarse.
  const paraBrillo = { ...w, type: 'collector' };

  return `
    <div class="flex items-center gap-3">
      ${marcoDeBrillo(paraBrillo, `
        <!--
            EL CAJÓN DEL ICONO VA EN EL COLOR DE LA RAREZA, Y NO EN EL DE ACENTO.

            Es el mismo fallo que el del icono, un nivel más arriba: el marco ya lleva
            rarity-<slug>, y aquí el fondo y el borde se pintaban con var(--accent), que
            gana. El resultado era que **el mismo icono salía con el borde amarillo en la
            tarjeta y verde en la base**, que es el mismo item en dos pantallas distintas.

            currentColor lo hace sin repetir la rareza: el marco ya la puso, así que basta
            con usarla. Y el fondo va con una mezcla de currentColor al 12%, que es lo que
            hace que un Divino se note en su caja sin necesidad de otro color.
          -->
          <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                      ring-1 ring-current"
               style="background: color-mix(in srgb, currentColor 12%, transparent)"
               title="${textoDeBrillo(paraBrillo) || w.name}">
          <!--
            EL ICONO HEREDA EL COLOR DE LA RAREZA, Y NO EL DE ACENTO. Antes llevaba
            accent-text encima, que gana al color del marco: en el almacén el icono
            sale del color de su rareza y en la ficha salía siempre en verde del tema,
            con el mismo item delante de los dos sitios. **El marco lleva
            rarity-<slug> y basta con no taparlo.**
          -->
          <span>${ic('collector', 'w-5 h-5')}</span>
        </div>`, 'rarity-' + slug(rarity))}

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
          <!--
            EL BRILLO NO SE ESCRIBE EN LA FICHA, Y ESTA ES LA RAZÓN.

            Se puso y quedó feo: "Legendario · ★★★ · Brillo 2 de 4" no cabe en la línea, la
            parte a dos renglones y deja las estrellas colgando debajo de la rareza. El
            icono ya brilla —es justo lo que se pidió—, así que el número solo servía para
            **repetir en texto lo que el ojo ya sabe**, y a cambio rompía el que sí importa:
            la rareza y las estrellas, que están en la misma línea por algo.

            Se queda en el title del icono, que es donde va la información de apoyo: ahí
            no empuja nada y se lee cuando alguien la busca.
          -->
        </div>
        <!--
          details NO SE PONE EN LA FICHA DEL RECOLECTOR, Y POR QUÉ.

          Para un recolector, details es siempre la misma frase: "Recolector por click:
          +340", con la base y el potencial ya metidos. Al lado del número grande de la
          derecha, que es ese mismo total, era **la misma cifra escrita dos veces con dos
          nombres distintos**, y la de la izquierda era además la que más se prestaba a
          confundir: parece el daño que pega el clic y no lo es —es el número del
         Warehouse, sin buffs—.

          Para un compañero details sí vale ("Deja el recolector con un afijo
          garantizado"), así que la línea no se borra de la función: **solo se quita donde
          no aporta**, que es aquí. La regla que lo acompaña es la de siempre: si un día un
          recolector trae una descripción que no sea un número, vuelve a salir, porque
          entonces la línea estará diciendo algo.
        -->
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
  /**
   * Nivel y potencial, y solo existen para el brillo.
   *
   * El compañero **sí** tiene nivel y potencial, y los dos pagan: el nivel por
   * `multiplicadorDeNivel()` y el potencial por su posición en el rango del tier. Lo que
   * no estaba escrito en la ficha que la pinta, así que el brillo no tenía con qué
   * calcularse — y por eso hasta ahora el compañero salía sin halo siendo un item de la
   * misma calidad que el recolector de al lado.
   */
  level?: number;
  maxLevel?: number;
  potential?: number;
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
  // **EL COMPAÑERO TAMBIÉN BRILLA, Y USA EL MISMO NÚMERO QUE EL RECOLECTOR.** El tipo se
  // pone a mano por lo mismo que en la ficha del recolector: esta casilla ES la de un
  // compañero, y `c.type` es el subtipo ('multiplier' o el que produce), no el tipo de
  // item. Sin esto, el brillo lo calcularía con el techo de nivel equivocado y el
  // escalón 4 le tocaría a un compañero que no lo tiene.
  const paraBrillo = { ...c, type: 'companion' };

  return `
    <div class="rounded-xl p-2.5 text-center border relative overflow-hidden
                ${sweep ? 'rare-sweep' : ''}"
         style="background: var(--bg-app);
                border-color: color-mix(in srgb, var(--accent) 35%, transparent)">
      <div class="flex justify-center mb-1.5" title="${textoDeBrillo(paraBrillo)}">
        ${marcoDeBrillo(paraBrillo, `
          <span style="color: currentColor">${ic(isMult ? 'sparkle' : 'companion', 'w-5 h-5')}</span>`, 'rarity-' + slug(rarity))}
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