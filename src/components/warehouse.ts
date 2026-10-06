// ==========================================================================
// Almacén · Rejilla con arrastre y hoja de detalle
//
// Qué cambia respecto a la versión anterior:
//
// 1. REJILLA EN VEZ DE LISTA. El almacén tenía 20 filas de ancho completo con
//    la información metida dentro. En móvil eso obliga a hacer scroll para ver
//    4 cosas. Ahora es una rejilla de celdas cuadradas y la información vive
//    en una hoja que se abre al tocar.
//
// 2. ARRASTRE REAL (módulo 4 del encargo). Antes había un modo "Mover": tocar
//    "Mover", luego tocar el destino. Cuatro toques y un estado intermedio que
//    se podía olvidar activating. Ahora se arrastra la celda y se suelta en
//    otra. Se usa Pointer Events porque es el único mecanismo que cubre dedo,
//    ratón y lápiz con el mismo código, y `touch-action: none` en la celda
//    porque sin eso el navegador scrollea en cuanto el dedo se mueve 2px.
//
// 3. VENTA DINÁMICA. `item.sellPrice` era un número congelado en el save.
//    Ahora se pide al game loop, que aplica la valoración por tier, potencial,
//    afijos y la bonificación de venta del árbol de pasivas. Vender un recolector
//    crafteada de 5 estrellas vale 12x lo que valía al comprarla.
//
// 4. SIN EMOJIS. Se usan los iconos SVG del set. El emoji 🤖 salía como un
//    cuadrado vacío en Windows y como un robot en macOS: el mismo item se ve
//    distinto según el sistema del jugador.
// ==========================================================================

import { showToast } from '../utils/toast';
import { formatNumber } from '../utils/format';
import { ic } from '../ui/icons';
import { pageShell, mountInto, wireNav, sectionHead } from '../ui/pageShell';
import { showConfirmModal, htmlToNode } from '../utils/modal';
import { showCrateRoulette } from './crateRoulette';
import { showCrateSummary, maximoDeApertura } from './crateSummary';
import { showSintonizacion } from './sintonizacion';
import { sfx } from '../utils/audio';
import { rarityClass, raritySlug, RARITY_RANK } from './crateLoot';
import { marcoDeBrillo } from '../ui/brillo';
import { AFFIX_BY_ID, collectorMaxLevel, estrellasDe, nivelMaximoDeCompanio, costeDeNivelDeCompanio } from '../data/crafting';
import { valuationBreakdown } from '../data/valuation';
import { CRISTAL_NOMBRE } from '../data/items';
import {
  MAX_CRATE_TIER, RANURAS_BARRA, CONSUMIBLES_ASIGNABLES, consumibleAsignable,
  type CrateType
} from '../data/store';

const TYPE_ICON: Record<string, any> = {
  collector: 'collector',
  companion: 'companion',
  crate: 'crate',
  key: 'key',
  consumable: 'flask'
};

// Lo que se escribe al lado del tier en el detalle. Un tipo que no esté en esta
// tabla se pinta como "Objeto" y no como su identificador crudo: un tipo
// desconocido viene de un guardado viejo, y el jugador tiene que leer algo
// ("dice weapon, no lo conozco"), no ver la palabra `weapon` en su inventario.
const TYPE_LABEL: Record<string, string> = {
  collector: 'Recolector',
  companion: 'Compañero',
  crate: 'Caja',
  consumable: 'Consumible'
};

// Cómo se nombra UNA unidad en el selector de cantidad. Va aparte de
// `TYPE_LABEL` porque ahí el plural es un rótulo ("Caja") y aquí tiene que
// concordar con el número: "3 × caja". El sustantivo va en singular porque el
// número ya está delante y es el que concuerda.
const UNIDAD_SINGULAR: Record<string, string> = {
  crate: 'caja',
  crystal: 'cristal',
  consumable: 'consumible'
};

// La regla de apilado vive en `data/stacking` porque el game loop necesita la
// MISMA para saber si un item cabe. Con una copia aquí, el contador de ranuras y
// la rejilla acaban contando cosas distintas otra vez.
import { MAX_STACK, isStackable, countOccupiedSlots, stackUnits, textoDeCantidad, topeDePila } from '../data/stacking';
import { lorePara } from '../data/tiers';
import {
  AUTO_VENTA_POR_DEFECTO, TIPOS_DE_VENTA_AUTO, TOPES_TIER, TOPES_POTENCIAL,
  descripcionDeAutoVenta, type TipoDeVentaAuto
} from '../data/autoventa';

/**
 * Los cuatro filtros del almacén, con su etiqueta.
 *
 * **ESTO ESTABA EN LA PLANTILLA Y AHORA ESTÁ AQUÍ PORQUE LA REJILLA VACÍA LOS USA.**
 * La etiqueta vive en dos sitios —el botón y el texto de "no tienes nada de…"— y
 * escrita en los dos es una etiqueta escrita dos veces: el día que un filtro cambie de
 * nombre, el botón y el mensaje vacío dirán cosas distintas, y el único que se ve es el
 * mensaje.
 */
const FILTROS = [
  { id: 'all', label: 'Todo' },
  { id: 'collector', label: 'Recolectores' },
  { id: 'companion', label: 'Compañeros' },
  { id: 'crate', label: 'Cajas' },
  { id: 'otros', label: 'Otros' }
];

// Estado de la pantalla. Sobrevive a los re-render.
const ui = {
  selectedId: null as string | null,
  filter: 'all' as string,
  sort: 'default' as string,
  /**
   * LO QUE SE ESCRIBE EN EL BUSCADOR, Y POR QUÙ ES ESTADO Y NO UN `$query`.
   *
   * El campo tiene que sobrevivir al re-render: al escribir se repinta la rejilla y el
   * input volvería a su valor inicial, con lo que el jugador escribe una letra, la
   * pierde y no entiende por qué el buscador no hace nada. Es el mismo motivo por el que
   * `selectedId` y `elegidos` viven aquí y no en el marcado.
   *
   * **Lo que se guarda es el texto crudo y los términos se sacan al filtrar**, no al revés:
   *   así el input puede devolver exactamente lo que el jugador escribió, con sus espacios,
   *   y un buscador que te corrige el texto mientras escribes es un buscador con voz.
   */
  buscar: '',
  sheetOpen: false,
  /**
   * SELECCIÓN MÚLTIPLE, Y POR QUÉ ES ESTADO Y NO UN `{...}` de cada celda.
   *
   * Vive aquí y no en el marcado porque tiene que sobrevivir al re-render que provoca
   * cada toque: si el marcado fuera la verdad, marcar la segunda celda borraría la
   * primera. Y son **dos cosas distintas**: `selectedId` es "esta es la celda cuya ficha
   * estoy leyendo" y `elegidos` es "estas se venden juntas". Por eso NO son un solo
   * campo, y por eso el modo se puede encender sin tener nada marcado: no es lo mismo
   * mirar una ficha que preparar una venta.
   */
  multisel: false,
  elegidos: [] as string[]
};

export function renderWarehouseTab(
  container: HTMLElement,
  game: any,
  onStateChange?: () => void,
  go?: (r: any) => void
) {
  draw(container, game, onStateChange, go);
}

function draw(
  container: HTMLElement,
  game: any,
  onStateChange?: () => void,
  go?: (r: any) => void
) {
  const state = game.getState();
  const warehouse = (state.warehouse || []) as any[];
  const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;

  // --- Ranuras ocupadas --------------------------------------------------
  //
  // Esto NO es `warehouse.length`. Una pila es un item con unidades dentro, y la
  // rejilla de arriba la pinta en UNA celda: si el contador sumara entradas,
  // 19 llaves se verían en una celda y se contabilizarían como 19 ranuras.
  // Cuenta grupos, con la misma regla que usa el agrupado de abajo.
  const occupied = countOccupiedSlots(warehouse);

  // --- Filtrado y orden --------------------------------------------------
  // La rejilla sale de `visibleStacks()`, la MISMA función que usa el arrastre
  // para saber qué hay detrás de cada celda. Con dos criterios de agrupado
  // distintos —uno para pintar y otro para mover—, el arrastre movía los items a
  // un sitio distinto del que el jugador veía.
  const celdas = visibleStacks(game, state);

  // La selección sobrevive al re-render, pero se invalida si el item desaparece
  if (ui.selectedId && !warehouse.some((w: any) => w.id === ui.selectedId)) {
    ui.selectedId = null;
    ui.sheetOpen = false;
  }
  const selected = ui.selectedId ? warehouse.find((w: any) => w.id === ui.selectedId) : null;

  // Lo mismo para la selección múltiple, y por el mismo motivo. Un id que ya no está
  // en el almacén no puede seguir marcado: si se quedara, la barra anunciaría un precio
  // por un objeto que no existe, que es la clase de número que no cuadra con el cobro.
  //
  // **Y EL MODO NO SE APAGA SOLO CUANDO NO QUEDA NADA MARCADO, A PROPÓSITO.** Encenderlo
  // es el primer paso de marcar, así que el primer re-render viene con cero marcados y
  // un apagado automático lo tiraría en el acto. Se apaga con el interruptor y con el
  // botón de la barra, que están los dos a la vista, y mientras esté encendido la barra
  // enseña cero en vez de desaparecer: un modo encendido sin nada marcado dice "elige",
  // y un modo que se apaga solo parece un botón que no responde.
  if (ui.elegidos.length > 0) {
    ui.elegidos = ui.elegidos.filter((id) => warehouse.some((w: any) => w.id === id));
  }


// --- Celdas -----------------------------------------------------------
  const cell = (g: { item: any; count: number }, i: number) => {
    const w = g.item;
    const isSel = w.id === ui.selectedId;
    const isEquipped = esEquipado(w, state);
    // Marcado para la venta en lote. Es un concepto DISTINTO de `isSel`: esa es la
    // ficha que se está leyendo y la abre el panel de detalle; esta es una celda que
    // va a la barra de "vender". Por eso el marcado no puede pintarse con `is-selected`,
    // que ya significa lo otro: si compartieran clase, el jugador vería una celda
    // resaltada sin haberla abierta y otra resaltada sin estar marcada.
    const isMarcada = ui.multisel && ui.elegidos.includes(w.id);
    const count = g.count;
    // F30 · La esquina pinta el tope con un "+" cuando hay más, no un 99 pelado.
    // `data-count` sigue siendo el número REAL porque lo leen la arrastre y la
    // selección, y recortarlo ahí ya fue un bug.
    const tope = MAX_STACK[w.type] ?? 20;
    const texto = count > 0 ? textoDeCantidad(count, tope) : '';
    return `
      <button class="inv-cell ${isSel ? 'is-selected' : ''} ${isMarcada ? 'is-picked' : ''} ${count > 0 ? 'is-stackable' : ''}"
              data-cell="${i}" data-id="${w.id}" data-count="${count}"
              data-picked="${isMarcada ? '1' : '0'}"
              aria-pressed="${ui.multisel ? String(isMarcada) : 'false'}"
              style="${isEquipped ? 'border-color:#fbbf24; box-shadow: inset 0 0 0 1px #fbbf24;' : ''}"
              aria-label="${w.name}">
        <!--
          EL BRILLO, Y POR QUÉ VA EN UN MARCO Y NO EN LA CELDA.

          El anillo es un absolute y necesita un padre posicionado; si se aplicara
          directamente a la celda, el position: absolute se resolvería contra la
          rejilla entera y el halo saldría descentrado. Además el marco lleva la clase
          de rareza, que es la que da el color al anillo por currentColor: por eso el
          brillo de un Divino sale en su amarillo sin que este fichero sepa qué es un
          Divino.

          Y el halo no es solo adorno: es lo primero que se ve de un item bueno sin
          tener que abrir la ficha, que es justo lo que hace falta en una rejilla de
          veinte celdas en un móvil.
        -->
        ${marcoDeBrillo(w, `
          <span class="ring-${raritySlug(w.rarity)} w-8 h-8 rounded-lg grid place-items-center
                       ${rarityClass(w.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">
            ${ic(TYPE_ICON[w.type] ?? 'crate')}
          </span>`, 'rarity-' + raritySlug(w.rarity))}
        <!--
          LA MARCA DE "VA A VENDERSE", Y POR QUÉ ES UNA ESQUINA Y NO UN CAMBIO DE COLOR.

          Un cambio de color de fondo haría imposible distinguir "marcado para vender" de
          "marcado como ficha abierta", que es justo lo que hay que distinguir. La marca
          es un signo deticado en la esquina **inferior derecha**, que es donde no hay
          nada: el stat va en la superior derecha, el contador de pila también arriba a la
          derecha y el "EQ" abajo a la izquierda. Con cuatro Mogollete encima de la celda,
          cada uno en su esquina, y sin solaparse con ninguno.
        -->
        ${isMarcada ? `<span class="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-md accent-bg text-slate-950
                              grid place-items-center pointer-events-none
                              [&>span>svg]:w-3 [&>span>svg]:h-3">${ic('check')}</span>` : ''}
        <span class="text-[9px] font-mono text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full px-0.5">
          ${w.name}
        </span>
        <span class="text-[9px] font-mono ${isEquipped ? 'text-amber-400' : 'text-[var(--text-muted)]'}">
          ${w.tier ? `T${w.tier}` : (w.rarity ?? '')}
          <!--
            LAS ESTRELLAS SOLO PARA LO QUE TIENE POTENCIAL, Y ESTO ES LA SEGUNDA VEZ QUE
            SE ARREGLA. La ficha ya las condicionaba, pero la CELDA no, así que una caja,
            una llave o una carta salían con tres estrellas en la rejilla. Y la causa es
            la misma en las dos: la función de estrellas con un potencial ausente devuelve
            el valor por defecto, que es tres. Con la condición no hace falta tocar la
            función: lo que no tiene potencial no pregunta.
          -->
          ${(w.type === 'collector' || w.type === 'companion') && w.potential
            ? ` ${estrellasDe(w.potential)}`
            : ''}
        </span>
        ${texto ? `<span class="absolute top-0.5 right-0.5 text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-app)] rounded px-0.5">${texto}</span>` : ''}
        ${statCelda(w, game)}
        ${isEquipped ? `<span class="absolute bottom-0.5 left-1 text-[9px] font-mono text-amber-400">EQ</span>` : ''}
      </button>
    `;
  };

  /**
   * Una celda de capacidad libre.
   *
   * **`data-cell` es el indice de celda y ya no hay dos indices que distinguir.** Antes
   * esta celda llevaba tambien `data-painted`, la posicion real en la rejilla, porque
   * los huecos del jugador se intercalaban entre las ocupadas y un soltar en una celda
   * vacia tenia que poner el item donde el jugador senalaba y no al final de la lista.
   * Sin huecos no hay dos cosas que puedan confundirse: la celda vacia esta donde esta y
   * su indice es su sitio.
   *
   * **Y NO ES UNA CELDA QUE SE PUEDA TOCAR.** Es `aria-hidden` y no lleva manejador:
   * antes se soltaba un item encima y se colocaba ahi; ahora no hay arrastre, asi que
   * una celda vacia es informacion --"caben tres mas"-- y no un sitio. Se queda
   * pintada porque el contador de ranuras y la rejilla tienen que contar lo mismo.
   */
  const emptyCell = (celda: number) => `
    <div class="inv-cell opacity-25" data-cell="${celda}" data-empty="1" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('plus')}</span>
    </div>
  `;


  // **CUÁNTAS CELDAS SE PINTAN, Y POR QUÉ ES UNA LÍNEA Y NO UNA FUNCIÓN.** La cuenta
  // vivía en `totalCeldasPintadas()` porque el arrastre necesitaba el MISMO número: si
  // el pintado y el destino calcularan distinto total, un item podía acabar empujado
  // fuera de la rejilla y desaparecer de la vista sin que se hubiera vendido. Sin
  // arrastre ya no hay dos cifras que puedan separarse, así que no hay nada que
  // mantener de acuerdo: es el tablero entero y nada más.
  const totalCells = celdas.length + Math.max(0, capacity - celdas.length);
  const cells: string[] = [];
  let pintados = 0;
  for (let i = 0; i < celdas.length; i++) {
    cells.push(cell(celdas[i], i));
    pintados++;
  }
  // **Y LA COLA LIBRE VA DESPUÉS, QUE ANTES TENÍA OTRO MOTIVO.** Cuando existían los
  // huecos del jugador, contarlos antes empujaba fuera una celda de capacidad y el
  // almacén encogía solo por acomodarles sitio. Ya no hay nada que acomodar, así que la
  // cola se reparte al final porque es lo que hace una cola.
  for (let n = 0; pintados < totalCells; n++, pintados++) {
    cells.push(emptyCell(celdas.length + n));
  }

  const body = `
    <!--
      Dos columnas a partir de lg. Antes el panel de detalle era un overlay
      fixed que en escritorio se convertia en un hijo mas del contenedor en
      columna: caia DEBAJO de la rejilla, pegado a la esquina inferior
      derecha y flotando sobre el vacio. Ahora es una columna de verdad.
    -->
    <div class="flex flex-col lg:flex-row lg:gap-4 lg:items-start">

      <div class="min-w-0 flex-1">
        ${sectionHead('Almacén', 'warehouse', `
          <div class="flex items-center gap-2.5">
            <!--
              AQUÍ SOLO QUEDA EL CONTADOR DE RANURAS, Y ANTES TAMBIÉN ESTABA EL DE NANITAS.

              Lo que justificaba tener el saldo pegado a las ranuras —"en el almacén la
              decisión es local y arriba quedaba demasiado lejos"— era cierto, pero la
              solución que se tomó fue poner el saldo en un segundo sitio en vez de
              acercar el que ya había. El resultado era que la misma cifra se leía en dos
              lugares de la misma pantalla, y como solo se refrescaba uno, eran dos
              números distintos. No hacía falta elegir bien: no había dos.

              Ahora el saldo está en la franja de la cabecera, que es el mismo sitio en las
              siete pantallas y el único que se refresca en cada tick. Aquí queda lo que
              no es un saldo: cuántas ranuras quedan, que no está en ningún otro sitio y
              es lo que decide si un item se puede meter.
            -->
            <span class="text-[10px] font-mono tabular ${occupied >= capacity ? 'text-rose-400' : 'text-[var(--text-muted)]'}">
              ${occupied}/${capacity} ranuras
            </span>
          </div>
        `)}

        <div class="flex flex-wrap items-center gap-1.5 mb-3">
          ${FILTROS.map(f => `
            <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition
                           ${ui.filter === f.id ? 'accent-bg text-slate-950 font-bold' : 'btn-ghost text-[var(--text-muted)]'}"
                    data-filter="${f.id}">${f.label}</button>
          `).join('')}
<!-- EL BUSCADOR, Y POR QUÉ ESTÁ ANTES DEL SELECT DE ORDEN Y NO DESPUÉS.
             Con veinte cajas y cuarenta armas en el almacén, el filtro de tipo y el orden
             no contestan "¿dónde está el AK-7?": contestan "¿qué tipo quiero ver?". El
             buscador es la otra pregunta, y por eso tiene su propio hueco y no se
             mezcla con el filtro.
             Y el texto va en el placeholder, que es donde se lee lo que hace el campo, y no en un
             label suelto porque un buscador sin texto visible parece una casilla de
             pegar texto. -->
          <label class="relative flex-1 min-w-[9rem]" for="wh-buscar">
            <span class="sr-only">Buscar en el almacen</span>
            <input id="wh-buscar" type="search" data-wh-search autocomplete="off"
                   placeholder="Buscar por nombre, tier o rareza"
                   value="${ui.buscar}"
                   class="h-10 w-full pl-3 pr-8 rounded-lg btn-ghost text-[11px] font-mono
                          placeholder:text-[var(--text-muted)] placeholder:opacity-70
                          focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            ${ui.buscar ? `
              <button data-act="limpiar-busqueda"
                      aria-label="Quitar la busqueda"
                      class="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md
                             btn-ghost flex items-center justify-center cursor-pointer
                             [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">
                <span>${ic('close')}</span>
              </button>` : ''}
          </label>
          <select id="wh-sort" aria-label="Ordenar"
            class="ml-auto h-10 px-2 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer">
            <!--
              LA PRIMERA OPCIÓN YA NO ES "MI ORDEN", Y EL POR QUÉ ESTÁ EN EL NOMBRE.

              El almacén se puede colocar a mano: se arrastra una celda sobre otra y
              queda donde la dejes. **Esa disposición no era una opción de orden sino la
              ausencia de orden**, y por eso la opción se llamaba "Mi orden": no ordenaba
              nada, solo decía que lo de abajo era lo que había puesto el jugador. Al
              quitar el arrastre, la opción mentía: el jugador la elegía y no pasaba nada.

              Ahora se llama **"Default"** y dice la verdad: es el orden en que
              entraron los items, el del guardado. Se queda porque **es lo único que
              devuelve el almacén a su estado natural** y sin ella no hay manera de
              volver a verlo sin recargar la página.

              Y el nombre es el que trae el juego entero: el resto de selectores y de
              botones usan palabras inglesas, y una opción en medio de "Mayor valor" y
              "Mayor nivel" era la única que traducía una etiqueta de software.
            -->
            <option value="default" ${ui.sort === 'default' ? 'selected' : ''}>Default</option>
            <option value="value" ${ui.sort === 'value' ? 'selected' : ''}>Mayor valor</option>
            <!--
              LOS DOS EJES DEL STAT, Y POR QUÉ NO ES UNO.

              "Recolección por click" y "Recolección por segundo" son preguntas distintas
              sobre objetos distintos: el recolector se mide por clic y el compañero por
              segundo, y un 30 por clic no se compara con un 65 por segundo porque el clic
              se repite mil veces en un segundo. Ordenar por el número "mayor" mezclando los
              dos pondría siempre a los compañeros delante y no diría nada.

              El multiplicador tampoco entra en el de por segundo: su 1,75 no son unidades
              por segundo, son 1,75 veces lo de los demás. Queda al final, no en cero: cero
              es una cifra y el multiplicador no tiene ninguna en ese eje.
            -->
            <option value="stat" ${ui.sort === 'stat' ? 'selected' : ''}>Recolección por clic</option>
            <option value="statSeg" ${ui.sort === 'statSeg' ? 'selected' : ''}>Recolección por segundo</option>
            <option value="rarity" ${ui.sort === 'rarity' ? 'selected' : ''}>Rareza</option>
            <option value="tier" ${ui.sort === 'tier' ? 'selected' : ''}>Tier</option>
            <option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Nombre</option>
          </select>

          <!--
            EL INTERRUPTOR DE LA SELECCIÓN MÚLTIPLE, Y POR QUÉ NO ES UN BOTON SUELTO EN LA
            REJILLA.

            Vender veinte celdas con veinte toques a "Vender" y veinte diálogos es la razón
            de que esto exista. El interruptor va **junto a los filtros y no en la rejilla**
            por dos razones: una rejilla que en cada celda lleva un botón de marcar es una
            rejilla que ya no es una rejilla —el jugador no puede abrir la ficha de nada
            sin desmarcar primero—, y el interruptor tiene que poder apagarse sin haber
            tocado ninguna celda.

            Y dice qué va a pasar mientras esté encendido, porque es lo que cambia: con el
            modo apagado, tocar una celda abre su ficha; encendido, la marca. Sin ese aviso
            el primer toque parece un fallo.
          -->
          <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition flex items-center gap-1.5
                         ${ui.multisel ? 'accent-bg text-slate-950 font-bold' : 'btn-ghost text-[var(--text-muted)]'}"
                  data-act="multisel" aria-pressed="${ui.multisel}">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(ui.multisel ? 'check' : 'sparkle')}</span>
            ${ui.multisel ? 'Salir' : 'Selección múltiple'}
          </button>

          <!--
            EL BOTON DE APILAR, Y POR QUE DICE CUANTAS CELDAS LIBERA.

            Las pilas se funden solas al cargar la partida y al anadir un item, asi que
            el almacen normal ya va ordenado. Lo que no tiene camino es el item que llega
            por la puerta de atras --una compra, una partida vieja--: se queda suelto hasta
            la recarga, y el jugador ve seis celdas de Piedra con un 3 en cada una y un
            almacen que dice que esta lleno.

            El numero lo pone el MOTOR, que es quien sabe cuanto se funde de verdad. Un
            boton de apilar sin numero es una caja de boton: lo aprietas y no sabes si ha
            servido. Y sale de las CELDAS liberadas y no de los GRUPOS: fundir cuatro
            celdas de 15 en una de 20 y otra de 40 son dos grupos y cero celdas, porque
            el tope de 20 obliga a repartir.

            Apagado cuando no hay nada que fundir, con el motivo en el title: un boton
            gris sin explicacion es un boton que parece roto.
          -->
          ${(() => {
            const plan = game.planApilar?.() ?? { liberadas: 0, grupos: [] };
            const hay = plan.liberadas > 0;
            const detalle = hay
              ? plan.grupos.slice(0, 3).map((x: any) => `${x.nombre} x${x.unidades}`).join(' · ')
              : 'Ya esta todo apilado.';
            return `
            <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition flex items-center gap-1.5
                           ${hay ? 'btn-ghost text-[var(--text-main)]' : 'btn-ghost text-[var(--text-muted)] opacity-40 cursor-not-allowed'}"
                    data-act="apilar" ${hay ? '' : 'disabled'}
                    title="${detalle}">
              <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('layers')}</span>
              ${hay ? `Apilar · ${plan.liberadas}` : 'Apilar'}
            </button>`;
          })()}
        </div>

        ${ui.multisel ? multiSelBar(game) : ''}

        <!--
          LA REJILLA VACÍA, Y POR QUÉ DICE LAS DOS COSAS QUE PUEDEN ESTAR PASANDO.

          Sin búsqueda esto solo podía ser "no tienes nada de este tipo", pero en cuanto
          existe un campo de texto **hay dos motivos distintos** y se parecen tanto en la
          pantalla que el jugador no puede saber cuál es: puede no haber nada de ese tipo,
          o puede haberlo y no estar buscando lo que cree. Una rejilla en blanco sin
          explicación es indistinguible de un buscador roto, y el jugador no va a
  reescribir la búsqueda: va a abrir el inventario otra vez y a dejarlo.

          Así que el texto lleva el motivo **y la salida**: lo que se escribió y el botón
          de quitarlo. Y sale de ui.buscar, que es el texto crudo, no de los términos
          normalizados: enseñarle "ak7" cuando el jugador ha escrito "AK 7" sería una
          segunda cosa que no cuadra.

          **Y LA CONDICIÓN ES QUE NO HAY CELDAS, NO QUE EL HTML SALE VACÍO.** La rejilla
          se rellena con celdas de capacidad libre hasta el tope del almacén, así que el
          marcado nunca está vacío: con la condición sobre el html, el mensaje no salía
          nunca y lo que se veía al buscar algo inexistente era una rejilla entera de
          "+" —que es exactamente la pantalla de un almacén vacío, y por tanto
          indistinguible de un buscador que ha borrado el almacén.
        -->
        <div class="inv-grid mb-2" id="inv-grid">
          ${celdas.length === 0 ? `
            <div class="col-span-full flex flex-col items-center gap-2 py-8 text-center">
              <span class="text-[11px] text-[var(--text-muted)] leading-relaxed">
                ${ui.buscar.trim()
                  ? `Nada con "${ui.buscar.trim()}". Puede que no haya nada así en el almacén.`
                  : `No tienes nada de ${FILTROS.find(f => f.id === ui.filter)?.label.toLowerCase() ?? 'este tipo'}.`}
              </span>
              ${ui.buscar.trim() ? `
                <button class="px-3 h-9 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
                        data-act="limpiar-busqueda">Quitar la búsqueda</button>` : ''}
            </div>`
          : cells.join('')}
        </div>

    </div>

      <aside class="hidden lg:block w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-2">
        ${selected
          ? detailPanel(selected, state, game)
          : `<div class="card-glass border rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
               <span class="text-[var(--text-muted)] opacity-30 [&>span>svg]:w-9 [&>span>svg]:h-9">${ic('eye')}</span>
               <span class="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
                 Selecciona un item de la rejilla para ver su descripcion
               </span>
             </div>`}
      </aside>
    </div>

    ${selected ? detailSheet(selected, state, game) : ''}
  `;

  const root = mountInto(container, pageShell({
    title: 'Almacén',
    icon: 'warehouse',
    route: 'almacen',
    state
  }, body));

  wireNav(root, { go });
  // `wire` recibe `root` (el nodo que se recrea), no `container`. Es lo que
  // evita que los listeners se acumulen de un repintado a otro.
  wire(root, game, onStateChange, go);
}

/**
 * LA BARRA DE LA SELECCIÓN MÚLTIPLE.
 *
 * **EL NÚMERO DEL BOTÓN LO PONE EL MOTOR, Y ES LO ÚNICO QUE NO SE PUEDE HACER DE OTRA
 * MANERA.** La barra pinta `game.planSellMany()`, que es la misma función que usa
 * `sellMany()` para decidir qué se vende. Si la barra sumara los precios por su cuenta,
 * bastaría un redondeo distinto entre las dos para que el botón anunciara una cifra y el
 * cobro otra: es R3, y es exactamente el fallo que ya se pagó una vez con el botón de
 * vender una pila, que pintaba el precio unitario y cobraba el total.
 *
 * ## LO QUE SE PINTA, Y POR QUÉ ESTA ORDEN
 *
 * · **Cuántos y cuánto, antes del botón.** El jugador tiene que ver la magnitud de lo que
 *   va a pasar antes de confirmar, no después en un aviso.
 * · **El botón lleva el número, no un "Vender" a secas.** Es una venta en lote y no hay
 *   deshacer: un botón que no dice lo que cuesta es un botón que hay que pulsar a ciegas.
 * · **"Todos" y "Ninguno"** porque con veinte celdas marcar una a una es el trabajo que
 *   se estaba intentando quitar. "Todos" marca **lo que hay en la rejilla que se está
 *   viendo**, no todo el almacén: con un filtro puesto, lo que el jugador está viendo es
 *   lo que ha pedido ver, y marcar cosas que no ve sería vender a ciegas.
 * · **Los descartes salen, con su motivo.** Si el jugador ha marcado el último recolector,
 *   el botón lo dice y el precio no lo incluye. Un botón que anuncia un total que luego no
 *   se cobra entero es peor que un botón que se niegue.
 */
function multiSelBar(game: any): string {
  const state = game.getState();
  const plan = game.planSellMany(ui.elegidos);
  const celdas = visibleStacksFor(game, state, ui.filter, ui.sort, ui.buscar);
  const visibles = celdas.map((c: any) => c.item.id);
  const hayTodos = visibles.length > 0 && visibles.every((id: string) => ui.elegidos.includes(id));
  /** El nombre del item, para poder decir "el Dron Explorador está equipado". */
  const nombreDe = (id: string) => {
    const w: any = (state.warehouse as any[]).find((x: any) => x.id === id);
    return w?.name ?? null;
  };

  return `
    <div class="card-glass border rounded-xl px-3 py-2.5 mb-3 flex flex-wrap items-center gap-2.5"
         role="group" aria-label="Selección para vender">
      <span class="text-[10px] font-mono text-[var(--text-muted)]">
        <span class="text-[var(--text-main)] font-bold">${ui.elegidos.length}</span>
        ${ui.elegidos.length === 1 ? 'marcada' : 'marcadas'}
        ${ui.elegidos.length !== plan.vendibles.length
          ? `<span class="text-rose-400"> · ${plan.vendibles.length} vendibles</span>`
          : ''}
      </span>

      <button class="px-2.5 h-8 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
              data-act="ms-todos" ${hayTodos ? 'disabled style="opacity:.4"' : ''}>Todos</button>
      <button class="px-2.5 h-8 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
              data-act="ms-ninguno" ${ui.elegidos.length === 0 ? 'disabled style="opacity:.4"' : ''}>Ninguno</button>

      ${plan.bloqueados.length > 0 ? `
        <span class="text-[9px] font-mono text-rose-400 leading-tight">
          ${plan.bloqueados.map((b: any) => `${nombreDe(b.id) ?? 'Un item'}: ${b.motivo}`).join(' · ')}
        </span>` : ''}

      <button class="ml-auto px-3.5 h-9 rounded-lg text-[11px] font-bold cursor-pointer
                     ${plan.vendibles.length > 0
                       ? 'accent-bg text-slate-950'
                       : 'btn-ghost text-[var(--text-muted)] cursor-not-allowed'}"
              data-act="ms-vender" ${plan.vendibles.length > 0 ? '' : 'disabled'}>
        ${plan.vendibles.length > 0
          ? `Vender ${plan.vendibles.length} · ${formatNumber(plan.total)} ◆`
          : 'Vender'}
      </button>
    </div>`;
}

/** Hoja de detalle. En móvil va abajo con arrastre de salida; en escritorio, arriba. */
function detailSheet(item: any, state: any, game: any): string {
  return `
    <div class="fixed inset-0 z-[60] lg:hidden flex items-end justify-center pointer-events-none">
      <div class="absolute inset-0 bg-black/55 pointer-events-auto" data-act="close"></div>
      <div class="relative card-glass-elevated w-full rounded-t-2xl pointer-events-auto
                  p-4 max-h-[78dvh] overflow-y-auto overscroll-contain animate-rise-in"
           style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
        ${detailContent(item, state, game)}
      </div>
    </div>
  `;
}

/**
 * Lore y tipo del item, para compañeros y recolectores (F13).
 *
 * El lore sale del nombre (`lorePara`): cada nombre que puede llegar al almacén tiene
 * el suyo.
 *
 * **LO QUE ANTES IBAN AQUÍ Y YA NO: LA LÍNEA DEL TIPO DEL COMPAÑERO.** Decía
 * "Aporta +18/s al clickear", y ahora el stat principal va en grande justo encima con
 * esa misma cifra y esa misma etiqueta. Dos veces el mismo número en la misma ficha, a
 * dos tipos de letra distintos, es exactamente lo que hace que un jugador no sepa cuál
 * de los dos es el bueno. El tipo no se pierde: pasa a ser la **etiqueta** del número
 * grande, que es donde tiene que estar, y el multiplicador sigue sin llevar "+" porque no
 * se cobra: multiplica. Lo que queda aquí es solo el sabor, que para eso es el lore.
 */
function loreLine(item: any, state: any): string {
  const lore = lorePara(item.name);
  if (!lore) return '';
  return `
    <div class="rounded-lg px-2.5 py-1.5 mb-2.5"
         style="background: color-mix(in srgb, var(--accent) 7%, transparent);
                border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent)">
      <p class="text-[11px] italic leading-relaxed" style="color: var(--text-main)">“${lore}”</p>
    </div>`;
}

/**
 * EL STAT PRINCIPAL, EN GRANDE, CON SU ETIQUETA AL LADO Y EN UN BORDE.
 *
 * **POR QUÉ VA EN LA FICHA Y NO EN EL CUADRADO DE LA REJILLA.** La rejilla enseña el
 * tipo, la rareza y el tier: lo que hace falta para *elegir cuál mirar*. Una vez que has
 * abierto la ficha ya no estás eligiendo: estás decidiendo si te lo llevas, y para eso
 * hace falta una sola respuesta, arriba del todo y del tamaño del título. El borde es lo
 * que la separa del resto de la ficha: sin él es un número más en una columna de texto.
 *
 * **EL NÚMERO NO SE CALCULA AQUÍ.** Viene de `game.getStatPrincipal(item.id)`, que lo
 * compone con las mismas funciones con las que el motor cobra el clic y el ingreso. La
 * versión anterior de esta ficha enseñaba el daño **sin** las mejoras de nivel —la cifra
 * del item recién salido de la caja—, así que subir con cristales no movía el número que
 * el jugador estaba mirando, y el daño de verdad aparecía después, en otro sitio.
 *
 * **Y LA UNIDAD LA PONE EL MOTOR, NO ESTA FUNCIÓN.** Aquí no se añade ni un "/s" ni un
 * "×": llegan en el stat. Se probó primero con el sufijo en la vista y se leía "Produce
 * en pasivo/s", que no significa nada —el "/s" es de la cifra y la etiqueta es una
 * frase—, así que ahora la unidad va dentro de la etiqueta y la vista solo pinta.
 *
 * ## EL HOVER DEL DESGLOSE, Y POR QUÉ ES CSS Y NO UN LISTENER
 *
 * Pasa el ratón —o pon el dedo— por encima del número y sale la lista de dónde viene
 * la suma. Es **HTML y CSS pelados**, con `group` y `group-hover`, sin un solo listener:
 *
 * · La ficha se repinta en cada cambio de estado y cualquier listener hay que
 *   engancharlo otra vez, en el nodo que `mountInto()` recrea. Un listener perdido es un
 *   hover que a veces funciona, que es la forma más difícil de detectar de un bug.
 * · Un tooltip propio sería además un estado: abierta, cerrada, y su posición.
 * · Y `title` no sirve aquí: tarda un segundo en aparecer y es un rectángulo del sistema
 *   con el texto del navegador, no el del juego.
 *
 * **ABRE TAMBIÉN CON EL FOCO, PORQUE EN MÓVIL NO HAY HOVER.** El bloque lleva `tabindex`,
 * así que un toque lo enfoca y la lista sale, y con teclado se llega con el tabulador.
 * Sin eso, en el móvil el desglose sería inalcanzable y la mitad de la razón de existir
 * se pierde.
 */
function statPrincipalHTML(stat: any, game?: any, itemId?: string): string {
  if (!stat) return '';
  const esMult = stat.subtipo === 'multiplier';
  const cifra = (stat.prefijo ?? '')
    + (esMult ? Number(stat.valor).toFixed(2).replace(/0$/, '') : formatNumber(stat.valor));
  // **LAS FILAS LAS PIDE EL MOTOR, Y SON LAS MISMAS QUE LA CARD DE LA BASE.** La lista
  // de multiplicadores que traía el stat se queda como respaldo: sin ella, un stat sin
  // desglose se quedaría sin lista en vez de quedarse con la cuenta antigua, que es peor.
  const filas = (game && itemId ? game.getStatFilas?.(itemId) : null)
    ?? { base: 0, total: 0, filas: [] as any[] };
  const conDesglose = !esMult && filas.filas.length > 0;
  return `
    <div class="${conDesglose ? 'group relative cursor-help' : ''} rounded-xl px-3 py-2 mb-2.5"
         style="border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
                background: color-mix(in srgb, var(--accent) 8%, transparent)"
         ${conDesglose ? 'tabindex="0" title="De dónde sale este número"' : ''}>
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="font-['Orbitron'] font-bold text-2xl accent-text tabular leading-none">${cifra}</span>
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${stat.etiqueta}</span>
        ${conDesglose ? `<span class="text-[9px] font-mono text-[var(--text-muted)] opacity-60"
                                aria-hidden="true">ⓘ</span>` : ''}
      </div>
      ${conDesglose ? `
        <div class="hidden group-hover:block group-focus-within:block absolute z-30 left-0 right-0 top-full
                    mt-1.5 rounded-lg px-2.5 py-2 text-left shadow-lg card-glass-elevated">
          <div class="label-caps mb-1.5 flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3 [&>span>svg]:h-3 opacity-70">${ic('bolt')}</span>
            ${stat.subtipo === 'multiplier' ? 'De dónde sale el multiplicador' : 'De dónde sale'}
          </div>
          <ul class="space-y-1">
            <li class="flex items-baseline justify-between gap-2">
              <span class="text-[9px] font-mono text-[var(--text-muted)]">${textoDeLaBase(stat)}</span>
              <span class="text-[10px] font-mono tabular text-[var(--text-muted)] flex-shrink-0">
                ${formatNumber(filas.base)}
              </span>
            </li>
            ${filas.filas.map((f: any) => `
              <li class="flex items-baseline justify-between gap-2">
                <span class="text-[9px] font-mono text-[var(--text-muted)] truncate">
                  ${f.nombre}<span class="opacity-60"> · ${f.detalle}</span>
                </span>
                <span class="text-[10px] font-mono font-bold tabular accent-text flex-shrink-0">
                  +${formatNumber(f.suma)}
                </span>
              </li>`).join('')}
          </ul>
          <div class="flex items-baseline justify-between gap-2 mt-1.5 pt-1.5 border-t border-[var(--border-color)]">
            <span class="text-[9px] font-mono accent-text font-bold">${stat.etiqueta}</span>
            <span class="text-[10px] font-mono font-bold tabular accent-text">${cifra}</span>
          </div>
        </div>` : ''}
    </div>`;
}

/** Cómo se llama la base en la primera fila del desglose, que cambia con el stat. */
function textoDeLaBase(stat: any): string {
  return stat.tipo === 'companion' ? 'Poder del item' : 'Base del item';
}

/** Panel de detalle fijo en la columna derecha, solo en escritorio. */function detailPanel(item: any, state: any, game: any): string {
  return `
    <div class="card-glass border rounded-2xl p-4 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
      ${detailContent(item, state, game)}
    </div>
  `;
}

/**
 * Contenido del detalle, compartido por la hoja móvil y el panel de escritorio.
 *
 * Antes eran dos plantillas casi idénticas que se desincronizaron: el botón de
 * cerrar solo existía en una, y el panel de escritorio no tenía forma de
 * cerrarse. Un solo origen para el contenido hace que eso no vuelva a pasar.
 */
function detailContent(item: any, state: any, game: any): string {
  const isCollector = item.type === 'collector';
  const isCompanion = item.type === 'companion';
  const isEquipped = esEquipado(item, state);

  // **EL NIVEL Y EL TECHO, LEÍDOS CON LAS MISMAS FUNCIONES QUE USA EL MOTOR.**
  // El botón enseña un coste y un techo; si los calculara con números de aquí,
  // serían una segunda cuenta al lado de la del motor y se separarían en cuanto
  // cambiara la curva. Lo que el botón enseña y lo que el motor acepta sale de la
  // misma llamada.
  const nivelComp = Math.max(0, Math.floor(Number((item as any).level) || 0));
  const topeComp = nivelMaximoDeCompanio((item as any).potential, (item as any).maxLevel);
  // **EL TIER DEL COMPAÑERO, Y POR QUÉ HACE FALTA AHORA QUE ANTES NO.** El coste de
  // subir de nivel sale de `costeDeNivel(tier, nivel)`, así que sin el tier el botón
  // no puede ni calcular la cifra ni decir cuánto falta. Antes el coste no dependía
  // del item, y por eso no se leía.
  const tierComp = Math.max(1, Math.floor(Number((item as any).tier) || 1));
  // LO QUE SE VENDE, no lo que vale una unidad. `getSellPrice` es el precio
  // unitario y el botón tiene que enseñar lo que se va a cobrar: con una pila de
  // 20 llaves, "Vender · 480" y un cargo de 9.600 es R3 roto. El total lo pide
  // al game loop (`getSellTotal`) para que no sea esta vista la que multiplica y
  // las dos cosas acaben en números distintos.
  const sellTotal = game.getSellTotal?.(item.id)
    ?? Math.floor((game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0) * stackUnits(item));
  const maxStack = MAX_STACK[item.type] ?? 1;

  const affixList = (item.affixes || []).map((id: string) => {
    const a = AFFIX_BY_ID[id];
    if (!a) return '';
    return `<li class="text-[10px] flex items-start gap-1.5">
      <span class="${rarityClass(a.rarity)} flex-shrink-0 mt-[3px]">◆</span>
      <span><span class="${rarityClass(a.rarity)}">${a.name}</span>
      <span class="text-[var(--text-muted)]"> — ${a.description}</span></span>
    </li>`;
  }).join('');

  const valuation = isCollector ? valuationBreakdown(item) : [];

  // **EL STAT PRINCIPAL, Y POR QUÉ SE PIDE AL MOTOR.** El número grande es la respuesta a
  // "¿esto cuánto da?", y la respuesta la tiene el motor: es la misma cuenta que usa al
  // hacer clic y al repartir el ingreso. Antes esta ficha pintaba `item.damage`, que es la
  // cifra del item recién salido de la caja y **no sube con los cristales**, así que el
  // jugador subía de nivel y veía el mismo número, y el daño de verdad aparecía en otro
  // sitio. `getStatPrincipal` también devuelve `null` para lo que no sea recolector ni
  // compañero, y por eso el stat no se pinta en una caja, una llave o una carta.
  const statPrincipal = (isCollector || isCompanion)
    ? game.getStatPrincipal?.(item.id)
    : null;

  // **EL NIVEL Y SU TECHO, PARA LOS DOS, Y SIEMPRE.** Antes la barra era solo del
  // recolector y solo si el nivel era mayor que cero, de modo que un compañero —al que
  // los cristales también le suben el nivel— no tenía ni una palabra de progreso, y un
  // recolector recién comprado tampoco. Aquí sale en los dos casos y en el nivel cero,
  // porque "Nivel 0 / 20" con la barra vacía dice algo que no dice "no hay nivel": que
  // existe un techo, y por tanto que subirlo es una decisión y no una casualidad.
  const nivelDel = isCompanion ? nivelComp : Math.max(0, Math.floor(Number((item as any).level) || 0));
  const topeDel = isCompanion ? topeComp : collectorMaxLevel(item.maxLevel);

  return `
        <div class="flex items-start gap-2.5 mb-3">
          <span class="ring-${raritySlug(item.rarity)} w-11 h-11 rounded-xl grid place-items-center
                       flex-shrink-0 ${rarityClass(item.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">
            ${ic(TYPE_ICON[item.type] ?? 'crate')}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] truncate leading-tight">
              ${item.name}
            </h3>
            <div class="flex items-center gap-1.5 flex-wrap mt-1">
              <span class="text-[10px] font-mono ${rarityClass(item.rarity)}">${item.rarity}</span>
              ${item.tier ? `<span class="text-[10px] font-mono text-[var(--text-muted)]">T${item.tier}</span>` : ''}
              <span class="text-[10px] font-mono text-[var(--text-muted)]">${TYPE_LABEL[item.type] ?? 'Objeto'}</span>
              <!--
                LAS ESTRELLAS SOLO PARA LO QUE TIENE POTENCIAL. Se pintaban siempre, y
                la función de estrellas con un potencial ausente devuelve el valor por
                defecto, que es tres. Así que **una caja de botín, una llave y una carta
                salían con tres estrellas**: potencial para algo que no se puede subir.
                El defecto no era bonito, era información falsa en la etiqueta más
                resaltada de la ficha.
              -->
              ${(isCollector || isCompanion) && item.potential
                ? `<span class="text-[10px] text-amber-400">${estrellasDe(item.potential)}</span>`
                : ''}
            </div>
          </div>
          <button class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  data-act="close" title="Cerrar detalle" aria-label="Cerrar detalle">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
          </button>
        </div>

        <!-- Autoría: lo que hace único al objeto -->
        ${item.forgedBy ? `
          <div class="rounded-lg px-2.5 py-1.5 mb-2.5 flex items-center gap-1.5"
               style="background: color-mix(in srgb, var(--accent) 10%, transparent);
                      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-3 h-3">${ic('anvil')}</span>
            <span class="text-[10px] font-mono text-[var(--text-main)] truncate">
              Forjada por <span class="accent-text">${item.forgedBy}</span>
            </span>
          </div>
        ` : ''}

        <!--
          LA DESCRIPCIÓN, Y POR QUÉ LOS RECOLECTORES Y COMPAÑEROS NO TIENEN NINGUNA.

          El campo details es una **cadena escrita cuando el item se creó**, y eso la
          convierte en una segunda copia del stat que además se queda vieja: un
          recolector sube de nivel con cristales y su details sigue diciendo el daño del
          nivel 0. Con el stat principal en grande, la ficha enseñaba **dos números
          distintos para lo mismo y uno de los dos mentía**.

          Para el resto de tipos la línea se queda, porque ahí no es una cifra: es la
          única descripción que tienen. "Contiene recompensas máximas", "Sube 12 puntos
          la probabilidad" — eso no está en ninguna otra parte.

          Y si algún día un recolector viniera sin details, tampoco sale el "Sin
          descripción": no es que no tenga texto, es que el texto es el stat de arriba.
        -->
        ${!(isCollector || isCompanion) ? `
          <p class="text-[11px] text-[var(--text-main)] leading-relaxed mb-2.5">
            ${item.details || 'Sin descripción'}
          </p>
        ` : ''}

        ${statPrincipalHTML(statPrincipal, game, item.id)}

        <!--
          F52 · EL LORE SE ENSEÑA PARA **TODOS** LOS TIPOS, Y ANTES NO.

          Esta línea estaba detrás de un ternario que solo la pintaba para recolectores y
          compañeros, y con razón: antes solo esos dos tipos tenían lore. Lo que pasó es
          que el lore se escribió para ellos y **el resto se quedó fuera**, así que una caja,
          una piedra de calibración o un expansor llegaban a su ficha con su línea mecánica
          mecánico y nada más. Veintiocho objetos sin una frase de sabor, entre ellos los que
          más se tocan.

          La condición ahora es la del propio item y no la del tipo: **si tiene nombre con
          lore, se enseña**, y la función devuelve nada para lo que no lo tenga, que es
          lo que hace que esto no pueda enseñar una caja vacía. Un solo sitio donde se
          decide y una sola fuente de verdad para el texto.
        -->
        ${loreLine(item, state)}

        ${item.stackable ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Cantidad</div>
            <div class="flex items-baseline gap-1.5">
              <span class="font-['Orbitron'] font-bold text-base accent-text tabular">${stackUnits(item)}</span>
              <span class="text-[10px] font-mono text-[var(--text-muted)]">
                ${stackUnits(item) > maxStack ? `+ (tope de pintado ${maxStack})` : `/ ${maxStack}`}
              </span>
            </div>
          </div>
        ` : ''}

        ${(isCollector || isCompanion) && topeDel > 0 ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Nivel ${nivelDel} / ${topeDel}</div>
            <div class="meter is-tall"><span style="width:${Math.min(100, Math.max(0, (nivelDel / topeDel) * 100))}%"></span></div>
          </div>
        ` : ''}

        ${affixList ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Afijos heredados</div>
            <ul class="space-y-1">${affixList}</ul>
          </div>
        ` : ''}

        ${valuation.length ? `
          <!--
            LA VALORACIÓN YA NO ES UN ACORDEÓN.

            Estaba dentro de un \<details\>, primero cerrado y luego abierto por defecto. Las
            dos cosas sobraban. Cerrado obligaba a un clic para ver cuánto valía el item, que
            es justo el dato que se pide **antes** de vender: nadie mira la valoración
            después de haber vendido. Y abierto por defecto, lo único que aportaba el
            \<summary\> era una flechita que abre y cierra algo que no hacía falta cerrar —
            y en una ficha larga, con las acciones al final, cerrar el desglose síaba bien.

            Así que ahora es un bloque fijo: la etiqueta, las filas y el precio de venta,
            que es para lo que sirve la valoración. Un \<details\> son dos estados —abierto
            y cerrado— y un estado más que mantener para esconder algo que ya está
            sospechoso.

            **Y LA LÍNEA DE BASE YA NO ESTÁ.** La quitó la regla, porque "Base T2: 480" es
            el **valor** y el número grande de arriba es el **daño**: dos grandezas con el
            mismo nombre debajo la una de la otra. Aquí solo quedan los multiplicadores, que
            es lo que explica el precio. De dónde sale el daño lo explica el hover del
            número grande, y cada lista dice lo suyo.
          -->
          <div class="mb-2.5 rounded-xl px-2.5 py-2"
               style="border: 1px solid var(--border-color);
                      background: color-mix(in srgb, var(--text-main) 3%, transparent)">
            <div class="label-caps mb-1.5 flex items-center gap-1.5">
              <span class="[&>span>svg]:w-3 [&>span>svg]:h-3 opacity-70">${ic('scale')}</span>
              Valoración
            </div>
            <ul class="space-y-1">
              ${valuation.map(v => {
                // "Nivel 12: ×2.60" -> la etiqueta a la izquierda y la cifra a la derecha.
                const corte = v.lastIndexOf(': ');
                const etiqueta = corte > 0 ? v.slice(0, corte) : v;
                const valor = corte > 0 ? v.slice(corte + 2) : '';
                return `
                  <li class="flex items-baseline justify-between gap-3">
                    <span class="text-[10px] font-mono text-[var(--text-muted)]">${etiqueta}</span>
                    ${valor ? `<span class="text-[10px] font-mono tabular accent-text">${valor}</span>` : ''}
                  </li>`;
              }).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="flex flex-col gap-1.5 mt-3">
          ${isCollector || isCompanion ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="equip">
              ${isEquipped ? 'Desequipar' : 'Equipar'}
            </button>
          ` : ''}

          ${item.type === 'crate' ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="open">
              Abrir caja
            </button>
            ${filtroDeAutoVentaHTML(game)}
          ` : ''}


          ${item.type === 'consumable' ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="use">Usar</button>
          ` : ''}

          ${isCollector ? `
            <!--
              **MEJORAR NO ES SOLO PARA EL EQUIPADO, Y EL BOTÓN YA NO SE APAGA.**
              Antes llevaba el atributo disabled con "Equipala primero", porque el metodo del motor
              no recibia ningun id y solo sabia subir al equipado. Con veinte
              recolectores en el almacén, diecinueve tenían la mejora bloqueada por cómo
              estaban colocados: había que equipar cada uno por turnos.
              Y no hay razón de juego: el nivel es **del item**, no de la partida —la
              ficha, la valoración y el stat lo leen del objeto—, así que subir uno que no
              está en la mano no cambia nada más.
            -->
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="upgrade">
              Mejorar con cristal
            </button>
          ` : ''}

          ${isCompanion ? `
            <!-- **EL BOTÓN DICE QUÉ HACE Y EL RESTO VA EN LA HOJA.** Antes ponía
                 "Subir a nivel N · 1.234 de cristal", y ese texto era la mitad de una
                 decisión que la hoja ya enseña entera: el nivel al que sube, el coste y
                 la probabilidad. Con el coste dentro del botón el botón se acortaba a
                 sí mismo, y además se veía distinto en cada compañero, lo que rompía el
                 patrón del recolector justo debajo, que dice lo mismo. Los dos botones
                 hacen lo mismo y los dos dicen lo mismo. -->
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="upgrade-companion"
                    title="Sube el nivel con el cristal, igual que el recolector">
              ${nivelComp >= topeComp ? 'Nivel máximo' : 'Mejorar con cristal'}
            </button>
          ` : ''}

          <button class="w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px] cursor-pointer
                         border border-amber-500/30 text-amber-400"
                  style="background: color-mix(in srgb, #f59e0b 12%, transparent)"
                  data-act="sell" ${isEquipped ? 'disabled style="opacity:.4"' : ''}>
            ${stackUnits(item) > 1
              // Con pila, el número del botón es el MÁXIMO, no lo que se va a
              // cobrar: por eso lleva el × delante. "Vender · 9.120 ◆" con 19
              // llaves debajo insinúa que eso es lo que se lleva, y en realidad
              // se lleva lo que elija en el selector.
              ? `Vender ×${stackUnits(item)} · ${formatNumber(sellTotal)} ◆`
              : `Vender · ${formatNumber(sellTotal)} ◆`}
          </button>
        </div>

        ${isEquipped ? `<p class="text-[9px] text-amber-400 text-center mt-2">Desequípalo para venderlo o mejorarlo.</p>` : ''}
  `;
}

/** Los tipos cuyos items se acumulan en una sola celda. Ver `data/stacking`. */

/**
 * Si un item está equipado, leyendo el estado y no su bandera.
 *
 * Antes se leía `w.equipped`, que es una COPIA que el game loop mantiene
 * junto a `equippedCollectorId`. Son la misma información en dos sitios y nada
 * los emparejaba en caliente: `equipCollector` decide por la bandera, así que
 * si un guardado viejo traía la bandera puesta y el id vacío, la rejilla
 * pintaba "Desequipar" sobre un recolector que nadie tenía puesto —y pulsar
 * ese botón se llevaba por delante el equipado de verdad, porque el toggle
 * borraba `equippedCollectorId` sin mirar cuál era.
 *
 * El id manda porque es lo que lee el cálculo de daño. La bandera es su
 * proyección, y como dato de solo lectura para el guardado.
 */
/**
 * Exportado porque la Forja necesita **el mismo** predicado y no el suyo.
 *
 * Una regla compartida escrita dos veces es R2 en su forma mas barata de detectar: las
 * dos copias son correctas y se separan el dia que el juego aprenda una tercera
 * forma de estar equipado. Y aqui no es teorico: el flag `equipped` existe en la ficha
 * y parece servir, asi que la copia "barata" es la que sale.
 */
export function esEquipado(w: any, state: any): boolean {
  if (w.type === 'collector') return state.equippedCollectorId === w.id;
  if (w.type === 'companion') return state.activeCompanions.includes(w.id);
  return false;
}

/**
 * Los manejadores van sobre `root`, el nodo interior que `mountInto` recrea en
 * cada repintado, y NUNCA sobre `container`.
 *
 * `container` es `#app` y sobrevive a todos los renders. Un
 * `container.addEventListener('click', ...)` en cada `draw()` deja el anterior
 * vivo, y el mismo clic llega N veces. Aquí N era el número de repintados
 * desde que se entró al almacén, así que equipar y desequipar se ejecutaban
 * tantas veces como listeners hubiera: como el toggle es su propia inversa,
 * con un número par el estado acababa igual que estaba y el jugador pulsaba
 * "Desequipar" sin que pasara nada. Con un número impar sí cambiaba. De ahí
 * el "a veces funciona y a veces no".
 *
 * Los botones de filtro y el `select` de orden sí se consultan por atributo
 * sobre `root`: viven en nodos nuevos, así que no acumulan, y por cada uno hay
 * un solo elemento.
 */
function wire(root: HTMLElement, game: any, onStateChange?: () => void, go?: (r: any) => void) {
  // El re-render tiene que recibir lo mismo que el render original. Aquí se
  // perdían las rutas de navegación: al mover un item la página se repintaba
  // sin ellas y a partir de ahí no se podía saltar a otra sección.
  const container = root.parentElement as HTMLElement;
  const redraw = () => draw(container, game, onStateChange, go);

  // --- Filtro y orden ---
  root.querySelectorAll<HTMLElement>('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.nav();
      ui.filter = btn.dataset.filter!;
      redraw();
    });
  });
  root.querySelector<HTMLSelectElement>('#wh-sort')?.addEventListener('change', (e) => {
    ui.sort = (e.target as HTMLSelectElement).value;
    redraw();
  });

  /**
   * EL BUSCADOR, Y POR QUÉ VA EN SU PROPIO `input` Y NO EN EL DELEGADO DE ABAJO.
   *
   * El texto vive en `ui.buscar` y no en el nodo porque la rejilla se repinta al
   * escribir: si el input no recuperase su valor en cada repintado, el jugador escribiría
   * una letra y la perdería, y el buscador "no haría nada" sin decir por qué.
   *
   * **Y `input` Y NO `change`:** `change` en un campo de texto salta al perder el foco,
   * así que la rejilla no se filtraría hasta que el jugador pulsing fuera. Es un
   * buscador que parece no funcionar.
   *
   * El texto se guarda **crudo** y los términos se sacan al filtrar, en
   * `terminosDeBusqueda()`: así el campo devuelve al jugador exactamente lo que
   * escribió, y corregirle el texto mientras escribe es un buscador con voz.
   */
  root.querySelector<HTMLInputElement>('#wh-buscar')?.addEventListener('input', (e) => {
    ui.buscar = (e.target as HTMLInputElement).value;
    redraw();
    // **EL CURSOR VUELVE AL FINAL, Y POR QUÉ HAY QUE HASTERLO.** El repintado recrea
    // el input, así que el foco se pierde y con él el cursor: sin esto, escribir la
    // segunda letra deja el campo en medio de la palabra y a partir de la tercera ya no
    // se escribe nada. Por eso se devuelve el foco al nodo nuevo, no al viejo.
    const campo = root.querySelector<HTMLInputElement>('#wh-buscar');
    if (campo) {
      campo.focus();
      const fin = campo.value.length;
      campo.setSelectionRange(fin, fin);
    }
  });

  // --- Selección múltiple ------------------------------------------------
  // Van en el delegado de abajo y no aquí, porque los botones de la barra se pintan y
  // se borran en cada repintado: un listener por nodo habría que volver a ligar veinte
  // veces, que es justo lo que este fichero evita haciendo con `root`.

  /**
   * Marca o desmarca un id, y avisa si no se puede.
   *
   * **AVISA EN VEZ DE NO HACER NADA, Y POR QUÉ ES IMPORTANTE.** Tocar una celda que no
   * se puede vender sin que pase nada parece un botón roto: el jugador toca, no ve
   * cambio y toca otra vez pensando que se ha equivocado. Con el motivo escrito, el
   * mismo toque dice "está equipado" y el jugador entiende la rejilla.
   *
   * El motivo lo pone el motor, no esta función: es el plan del motor el que sabe qué
   * es vendible, y una comprobación de "¿está equipado?" aquí sería una copia de una
   * regla que ya vive en dos sitios del game loop.
   */
  // --- El filtro de auto-venta, en la ficha de la caja ------------------------
  // Va en el delegado y no por atributo sobre `root` porque los `<select>` cambian
  // y los botones viven en nodos que `mountInto()` recrea: consultarlos aquí es lo
  // único que no puede quedarse colgando de un nodo viejo.
  root.addEventListener('change', (e) => {
    const sel = e.target as HTMLSelectElement;
    if (sel.dataset.avTier !== undefined) {
      game.setAutoVenta?.({ tierMax: Number(sel.value) || 0 });
      redraw();
    } else if (sel.dataset.avPot !== undefined) {
      game.setAutoVenta?.({ potencialMax: Number(sel.value) || 0 });
      redraw();
    }
  });

  const marcarCelda = (id: string) => {
    if (ui.elegidos.includes(id)) {
      ui.elegidos = ui.elegidos.filter((x) => x !== id);
      redraw();
      return;
    }
    const soloEste = game.planSellMany([id]);
    if (soloEste.vendibles.length === 0 && soloEste.bloqueados.length > 0) {
      sfx.error();
      showToast(`No se puede vender: ${soloEste.bloqueados[0].motivo}.`, 'info');
      return;
    }
    sfx.pick();
    ui.elegidos = [...ui.elegidos, id];
    redraw();
  };

  // --- Selección y arrastre --------------------------------------------
  // --- Seleccionar una celda ------------------------------------------
  //
  // **UN `click` DELEGADO, Y ANTES ERA `pointerdown` MAS `pointerup` CON UN UMBRAL DE
  // 8 PIXELES PARA DECIDIR SI ERA UN TOQUE O UN ARRASTRE.** Sin arrastre no hay dos
  // gestos que distinguir, asi que el umbral no tiene nada que decidir y el `click` del
  // navegador hace el trabajo: es el mismo evento que usan los botones de al lado, y
  // funciona con el dedo, con el raton y con el teclado.
  //
  // Va sobre la rejilla y no sobre `root` porque las celdas no llevan `data-act` --el
  // delegado de abajo solo oye lo que tiene atributo-- y porque asi un clic dentro de
  // la ficha, que esta llena de botones, no puede dar en una celda por cerca. El nodo
  // es el que `mountInto()` recrea, asi que el manejador no se acumula.
  root.querySelector('#inv-grid')?.addEventListener('click', (e) => {
    const celda = (e.target as HTMLElement).closest('[data-cell][data-id]') as HTMLElement | null;
    const id = celda?.dataset.id;
    if (!id) return;
    // En selección múltiple un toque MARCA y no abre la ficha: si abriera las dos
    // cosas, el jugador no podría ni leer un item ni quitar la marca sin apagar el modo.
    if (ui.multisel) { marcarCelda(id); return; }
    sfx.pick();
    ui.selectedId = ui.selectedId === id ? null : id;
    redraw();
  });

  // --- Acciones de la hoja ---------------------------------------------
  // Delegado en `root`, no en `container`. Ver la nota de arriba: sobre
  // `container` este listener se acumulaba y el toggle de equipar se
  // ejecutaba una vez por repintado anterior.
  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.dataset.act;
    const item = ui.selectedId ? (game.getState().warehouse as any[]).find((w: any) => w.id === ui.selectedId) : null;

    switch (act) {
      // **LA CRUZ DEL BUSCADOR, Y POR QUÉ VACÍA EL CAMPO Y NO ESCRIBE EN ÉL.**
      // Escribir en el input desde un manejador de clic obliga a devolverle el foco a
      // mano, y el input está en otro sitio del marcado: una cruz que pone "a" en el
      // campo sin que el jugador lo pulse deja el cursor en un sitio raro. Vaciar el
      // estado y repintar deja el campo vacío y el foco donde estaba.
      case 'limpiar-busqueda':
        sfx.nav();
        ui.buscar = '';
        redraw();
        break;
      case 'close':
        sfx.pick();
        ui.selectedId = null;
        redraw();
        break;
      case 'equip':
        if (!item) return;
        sfx.equip();
        if (item.type === 'collector') game.equipCollector(item.id);
        else if (item.type === 'companion') {
          const ok = game.equipCompanion(item.id);
          if (!ok) showToast('No hay slots de compañero libres.', 'error');
        }
        redraw();
        onStateChange?.();
        break;
      case 'open':
        if (!item) return;
        openCrate(game, item, redraw);
        break;
      case 'use':
        if (!item) return;
        useConsumable(game, item, redraw);
        break;
      case 'upgrade':
        if (!item) return;
        // **EL ID VIAJA HASTA LA HOJA, Y ANTES NO VIAJABA.** La hoja de sintonización
        // busca el recolector por su cuenta cuando no se le dice cuál es; mientras solo
        // se podía mejorar al equipado eso no importaba, y en cuanto se puede mejorar
        // cualquiera significa que abriría siempre la del equipado con otro item delante.
        // Es el mismo motivo por el que el compañero ya pasa su `{ item }`.
        showSintonizacion(game, redraw, { tipo: 'recolector', item });
        break;

      case 'upgrade-companion': {
        // **ABRE LA MISMA HOJA QUE EL RECOLECTOR, Y POR QUÉ.**
        //
        // Antes este botón caía en `subirNivelDeCompanio()`, que pintaba un
        // `showConfirmModal` con dos frases: coste, saldo, "si falla no baja de nivel".
        // El del recolector abría la hoja de sintonización, con la misma información y
        // además la ruleta. Dos acciones que hacen lo mismo, enseñando dos cosas, y el
        // jugador tenía que aprender la segunda cada vez que cambiaba de tipo de objeto.
        //
        // **Lo que sí se conserva de la versión vieja: que el compañero no necesita
        // selectors.** En el recolector lo hubo porque había diez cristales y había que
        // elegir; el del compañero nunca lo tuvo —la regla de que sea del mismo nivel
        // la aplicaba el motor— y un selector aquí sería una pregunta sobre
        // multiplicadores que no cambia nada.
        const comp: any = item;
        if (!comp) return;
        showSintonizacion(game, redraw, { tipo: 'companero', item: comp });
        break;
      }

      case 'nada':
        // Botón informativo: no hace nada a propósito.
        return;

      // --- El filtro de auto-venta. Cada cambio va al motor y se guarda; la vista solo
      // le pasa lo que se ha pulsado. Encenderlo o cambiar un tope son decisiones del
      // juego, no del componente.
      case 'av-activa': {
        const cfg = game.getAutoVenta?.() ?? AUTO_VENTA_POR_DEFECTO;
        const nuevos = game.setAutoVenta?.({ activa: !cfg.activa });
        sfx.nav();
        // **AL ENCENDER SIN MARCAR NADA, SE MARCAN LOS RECOLECTORES.** Un conmutador
        // verde que no hace nada es un botón roto, y "vendeme las armas que no me
        // sirven" es el filtro que se quiere en el 90 % de las partidas: los compañeros
        // y los consumibles se usan, las armas son las que se acumulan.
        if (nuevos && nuevos.activa && TIPOS_DE_VENTA_AUTO.every((t) => !nuevos.tipos[t])) {
          game.setAutoVenta?.({ tipos: { collector: true, companion: false, consumable: false } });
        }
        redraw();
        break;
      }
      case 'av-tipo': {
        // **EL TIPO VIENE EN `data-av-tipo`, Y `data-act` ES LA PUERTA.** El delegado de
        // este archivo entra por `closest('[data-act]')`, asi que un boton que solo
        // tuviera `data-av-tipo` no llegaba aqui: **se veía el interruptor, se pulsaba y
        // no pasaba nada**. Por eso el boton lleva los dos atributos y no uno que haga
        // las dos cosas.
        const tipo = btn.dataset.avTipo as TipoDeVentaAuto | undefined;
        if (!tipo) return;
        const cfg = game.getAutoVenta?.() ?? AUTO_VENTA_POR_DEFECTO;
        sfx.pick();
        game.setAutoVenta?.({ tipos: { [tipo]: !cfg.tipos[tipo] } as any });
        redraw();
        break;
      }

      // --- La selección múltiple. Todas van antes de que `item` importa: son
      // barra y rejilla enteras, no la ficha de una celda.
      case 'multisel':
        sfx.nav();
        ui.multisel = !ui.multisel;
        // **AL ENCENDER, SE CIERRA LA FICHA, Y POR QUÉ ES OBLIGATORIO.**
        // `selectedId` y `elegidos` son dos conceptos y los dos se resaltan, pero con
        // estilos distintos: si la ficha sigue abierta mientras se marca, hay **dos
        // celdas de aspecto parecido y solo una es de la venta**. Se vio: el Blaser
        // seguía con el borde de "tienes abierta esta ficha" al lado de otra marcada
        // para vender, y la abierta parecía parte del lote. Sin ficha no hay dos
        // meanings: en este modo lo resaltado es lo que se vende, y punto.
        //
        // Al salir se limpian las marcas, por el mismo motivo al revés: si no, al volver
        // a entrar el jugador se encuentra una selección que no hizo.
        if (ui.multisel) {
          ui.selectedId = null;
          ui.sheetOpen = false;
        } else {
          ui.elegidos = [];
        }
        redraw();
        break;
      case 'ms-ninguno':      // --- Apilar. El motor decide y el aviso lo dice el motor: el numero de celdas
      // liberadas sale de `apilar()` y no de una cuenta de la vista.
      case 'apilar': {
        sfx.nav();
        const res = game.apilar?.();
        if (!res?.ok) {
          showToast(res?.msg ?? 'No hay nada que apilar.', 'info');
          return;
        }
        showToast(res.liberadas > 0
          ? `Apilado. ${res.liberadas} celda${res.liberadas === 1 ? '' : 's'} libre${res.liberadas === 1 ? '' : 's'}.`
          : 'Ya estaba todo apilado.', 'success');
        redraw();
        break;
      }
      case 'ms-ninguno':
        sfx.nav();
        ui.elegidos = [];
        redraw();
        break;
      case 'ms-todos': {
        sfx.nav();
        // **SOLO LO QUE SE ESTÁ VIENDO, Y POR QUÉ.** Con un filtro puesto, "todos" es
        // lo que hay en pantalla. Marcar lo que no se ve para venderlo sería dejar al
        // jugador vendiendo cosas sin verlas, que es la forma más rápida de que un
        // jugador no se fie de ese boton, y con razon.
        const celdas = visibleStacksFor(game, game.getState(), ui.filter, ui.sort, ui.buscar);
        const ids = celdas.map((c: any) => c.item.id);
        ui.elegidos = ids;
        // Los que no se pueden vender no se marcan, y el motivo lo pone el motor: el
        // plan dice cuál es el último de su tipo, que no lo sabe la vista.
        const plan = game.planSellMany(ids);
        const noVenden = plan.bloqueados.filter((b: any) => !ids.includes(b.id));
        if (noVenden.length > 0) {
          showToast(`${noVenden.length} no se pueden vender: ${noVenden[0].motivo}.`, 'info');
        }
        redraw();
        break;
      }
      case 'ms-vender': {
        if (ui.elegidos.length === 0) return;
        const res = game.sellMany(ui.elegidos);
        ui.elegidos = [];
        if (res.ok) {
          sfx.buy();
          showToast(`Vendidos ${res.sold} por ${formatNumber(res.gained ?? 0)} ◆.`, 'success');
        } else {
          sfx.error();
          showToast(res.msg || 'No se pudo vender.', 'error');
        }
        // Los descartes se dicen aunque la venta haya ido bien: es la parte de la
        // respuesta que el jugador no puede deducir de la pantalla, que ahora es un
        // item menos y ya no está.
        const bloqueados = res.bloqueados || [];
        if (bloqueados.length > 0) {
          showToast(`Sin vender: ${bloqueados[0].motivo}.`, 'info');
        }
        redraw();
        onStateChange?.();
        break;
      }
      case 'sell':
        if (!item) return;
        sellItem(game, item, redraw);
        break;
    }
  });
}


// ==========================================================================
//  Mover items
//
//  El filtro, la ordenación y el agrupado de apilables viven en
//  `visibleStacks()` y los usa tanto el pintado como el arrastre. Estaban
//  duplicados: el arrastre traducía el número de celda con
//  `Math.min(dstViewIndex, wh.length - 1)`, que solo daba el resultado correcto
//  sin filtro, sin orden y sin pilas. Con el almacén ordenado por valor, soltar
//  un item en la celda 3 lo mandaba a la posición 3 del array, que no es donde
//  el jugador lo ve.
//
//  Y el destino NO se traduce a un índice del array sino a un ANCLA: el item
//  junto al que tiene que quedar el grupo, y de qué lado. Con una celda por item
//  plano el índice parecía funcionar, pero en cuanto había una pila por medio la
//  cuenta se desviaba y el item caía una celda más allá, y los huecos del final
//  —que es lo único "vacío" que hay— se recortaban a la última celda ocupada,
//  así que arrastrar el último item a un hueco no hacía nada.
//
//  El ancla sola no bastaba: entrar siempre por delante del ancla es lo que
//  dejó el arrastre con una celda de retraso, y de paso convertía en un no-op
//  exacto soltar sobre la celda de al lado. Ver `moveItemTo`.
//
//  Con una sola función, un ancla en vez de un índice y el lado que decide quien
//  mira la rejilla, celda y array son siempre el mismo sitio.
// ==========================================================================

/**
 * Los grupos de items en el mismo orden en que los pinta la rejilla.
 *
 * Devuelve una entrada por celda: el item que representa la celda y la lista de
 * ids que hay detrás. Se agrupan los apilables igual que en el pintado, así que
 * una celda con 20 tarjetas sigue siendo una celda y sigue teniendo 20 items
 * detrás.
 *
 * `item` es el que se pinta, `count` el número de la esquina y `ids` todos los
 * items que hay detrás de la celda. Los tres van juntos porque son tres vistas
 * del MISMO grupo: el pintado necesita el representative y el contador, y el
 * arrastre necesita la lista entera, porque arrastrar una celda arrastra la
 * pila completa y no uno de los items que hay dentro.
 */
function visibleStacks(game: any, state: any): Array<{ item: any; ids: string[]; count: number }> {
  return visibleStacksFor(game, state, ui.filter, ui.sort, ui.buscar);
}

  /**
 * EL STAT EN LA ESQUINA DE LA CELDA, Y POR QUÉ ES EL MISMO NÚMERO QUE EL DE LA FICHA.
 *
 * **LO QUE PIDE ES PODER COMPARAR SIN ABRIR.** Antes, para saber cuánto daba un
 * recolector había que tocarlo y leer la ficha, y comparar dos era: volver atrás,
 * tocar el otro y recordar el primero. Con veinte objetos en la rejilla eso no es mirar,
 * es trabajar. La esquina es el sitio: está en todas, no tapa el nombre y se lee de un
 * vistazo en diagonal.
 *
 * **Y SALE DEL MOTOR, DE LA MISMA FUNCIÓN QUE LA FICHA.** No es el daño guardado ni
 * la descripción del item: es `getStatPrincipal()`, el mismo. Si la celda calculara su
 * propia cifra acabarían siendo dos números que se separan el día que cambie la regla, y
 * el peor día para descubrirlo sería un jugador comparando dos recolectores en la rejilla.
 * **La unidad también la pone el motor**, porque aquí se repitió el error: la primera
 * versión añadía "/s" a todo lo que no fuera multiplicador, y cualquier recolector salió
 * con "84/s" cuando cobra **por clic**. Dos grandezas distintas enseñadas como la misma.
 *
 * **LA ESQUINA NO SE SOLAPA CON EL CONTADOR DE PILA PORQUE NUNCA COINCIDEN.** El contador
 * es de lo apilable —cajas, llaves, cartas— y el stat es de lo que tiene stat —recolectores
 * y compañeros—, y un item no está en las dos listas. Aun así el contador se pinta
 * primero, y por eso va detrás: si algún día un tipo ganara las dos cosas, el contador es
 * el que ya estaba y no debe saltar de sitio.
 *
 * **VA FLOTANDO EN LA ESQUINA, Y ESTE PÁRRAFO ESTABA CONTRADICIENDO AL CÓDIGO.**
 * Aquí decía "no va flotando: es la primera fila de la celda" y dos líneas más abajo el
 * badge es `absolute top-1 right-1`. Las dos cosas no pueden ser verdad, y el texto se
 * quedó de cuando se probó la primera fila y no ocupaba bien: el motivo de que al final
 * flotara **no está escrito en ninguna parte**, así que queda escrito aquí lo que sí se
 * sabe, que es lo que se midió. Con el multiplicador —la etiqueta más ancha, 35
 * píxeles— el número llegó a tapar el icono, que es justo lo que dice a qué clase
 * pertenece el item.
 *
 * Lo que **no** se solapa nunca es el contador de pila, por el motivo de dos párrafos
 * arriba: son dos clases de item que no se cruzan. Y quien siga moviendo este badge
 * debería medirlo a 1280 y a 390 antes de darlo por bueno: un badge que se sale de la
 * celda en un móvil pequeño es peor que un badge que tapa el icono.
 *
 * ## ESTÁ EXPORTADA, Y POR QUÉ
 *
 * Porque la celda de material de la Forja pinta **la misma esquina con la misma
 * función**, y no una copia. La razón es el orden: la rejilla de la Forja se ordena por
 * el stat final, y si el número no estuviera a la vista el jugador vería una lista
 * ordenada por algo que no puede ver ni comprobar. La prueba de que el orden es el del
 * número que se ve es la que hace que valga; sin el número, esa prueba no tiene a qué
 * referirse.
 */
export function statCelda(w: any, game: any): string {
  const stat = game.getStatPrincipal?.(w.id);
  if (!stat) return '';
  const esMult = stat.subtipo === 'multiplier';
  const cifra = (stat.prefijo ?? '')
    + (esMult ? Number(stat.valor).toFixed(2).replace(/0$/, '') : formatNumber(stat.valor));
  return `<span class="absolute top-1 right-1 text-[10px] leading-none font-mono font-bold accent-text
                       bg-[var(--bg-app)] rounded px-1 py-px tabular"
                title="${stat.etiqueta}">${cifra}${stat.sufijo ?? ''}</span>`;
}

/**
 * Las celdas de la rejilla para un filtro y un orden concretos.
 *
 * Es `visibleStacks` sin el estado de pantalla. La versión que leía `ui.filter` y
 * `ui.sort` no se podía comprobar sin montar la pantalla entera, y el agrupado de
 * pilas es justo lo que hay que verificar: de él dependen a la vez lo que se pinta
 * y los índices que el arrastre usa como destino, así que un error ahí mueve el
 * item a un sitio distinto del que el jugador señaló.
 */
export function visibleStacksFor(
  game: any,
  state: any,
  filtro: string,
  sort: string,
  buscar = ''
): Array<{ item: any; ids: string[]; count: number }> {
  const wh = (state.warehouse || []) as any[];
  // **EL FILTRO COMPLETO, EN UN SITIO.** Tipo y búsqueda juntos, y no aplicados en la
  // vista: una rejilla que busca y un arrastre que solo filtra cuentan celdas distintas,
  // y el jugador señala un número de celda que no es el sitio que ve.
  let items = wh.filter((w: any) => pasaElFiltro(w, filtro, terminosDeBusqueda(buscar)));

  if (sort === 'name') items = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  else if (sort === 'rarity') items = [...items].sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0));
  else if (sort === 'tier') items = [...items].sort((a, b) => (b.tier || 0) - (a.tier || 0));
  // **EL NIVEL, QUE EN LA FORJA ES LA MITAD DEL NÚMERO Y EN EL ALMACÉN NO SE VE.**
  // El nivel multiplica el daño entero del item, así que dos recolectores del mismo tier y
  // el mismo potencial dan muy distinto. Es el eje que más se echa de menos en la rejilla de
  // materiales, y por eso vive aquí y no en la Forja: **es la misma regla en las dos
  // rejillas**.
  else if (sort === 'level') items = [...items].sort((a, b) => ((b.level || 0) + 1) - ((a.level || 0) + 1));
  else if (sort === 'value') {
    const precio = (w: any) => game.getSellPrice?.(w.id) ?? w.sellPrice ?? 0;
    items = [...items].sort((a, b) => precio(b) - precio(a));
  }
  // --- Ordenar por el stat, y por QUÉ son dos ejes y no uno -----------------------
  //
  // Lo que se pidió fue "encontrar los mejores", y hay dos preguntas distintas detrás:
  // el recolector que más da **por clic** y el compañero que más da **por segundo**. Son
  // dos ejes distintos, y por eso son dos opciones y no una.
  //
  // **UN RECOLECTOR DE 30 POR CLIC Y UN COMPAÑERO DE 65 POR SEGUNDO NO SE COMPARAN.** El
  // clic ocurre mil veces en un segundo, así que un compañero de 65/s gana siempre y el
  // orden por el número "mayor" no diría nada. Y el multiplicador **tampoco**: su 1,75 no
  // son 1,75 unidades por segundo, es 1,75 veces lo de los demás, así que en la misma
  // columna que un pasivo de 65 son dos cosas distintas con el mismo tipo de letra.
  //
  // Por eso cada eje **solo compara lo que se puede comparar** y deja lo demás al final,
  // en el orden que ya traían. Un `null` no es un cero: es "en este eje no hay cifra", y
  // confundirlos con un cero pondría un multiplicador o una caja por delante de todo.
  else if (sort === 'stat' || sort === 'statSeg') {
    const eje = sort === 'stat' ? 'click' as const : 'segundo' as const;
    /** La cifra del item en el eje pedido, o null si en ese eje no tiene cifra. */
    const cifra = (w: any): number | null => {
      const s = game.getStatPrincipal?.(w.id);
      if (!s) return null;
      // El recolector es el único que mide por clic; su stat no lleva "/s" y el del
      // compañero sí. Son las dos ramas de la misma pregunta.
      if (eje === 'click') return w.type === 'collector' ? s.valor : null;
      // Y por segundo solo entran los dos compañeros que **producen**: el multiplicador
      // no produce, transforma.
      if (w.type !== 'companion') return null;
      return s.subtipo === 'multiplier' ? null : s.valor;
    };
    items = [...items].sort((a, b) => {
      const ca = cifra(a);
      const cb = cifra(b);
      // Los que no tienen cifra al final, y entre ellos sin moverse: `sort` es estable en
      // V8, así que conservando el orden de entrada no hay que hacer nada más.
      if (ca === null && cb === null) return 0;
      if (ca === null) return 1;
      if (cb === null) return -1;
      if (ca !== cb) return cb - ca;
      // **A igual de stat, el de tier más alto delante.** Dos recolectores con el mismo
      // daño por clic no son iguales: el de tier alto vale más, forja a más y sube mejor.
      // Sin este desempate el orden entre ellos depende del guardado, y el mismo almacén
      // salía distinto en dos dispositivos.
      return (b.tier || 0) - (a.tier || 0);
    });
  }

  // Los items iguales se acumulan en la celda del primero, estén o no juntos en
  // el array. Antes solo se juntaban los VECINOS, así que la rejilla que pintaba
  // el agrupado y la que veía el arrastre tenían distinto número de celdas: el
  // número de celda que el jugador señalaba no era el mismo sitio en las dos.
  //
  // **Y SE ACUMULAN HASTA EL TOPE DE PILA, QUE ES LO NUEVO.** Una pila de cajas
  // está llena en 99, así que 250 cajas son tres items en el almacén y tienen que
  // ser **tres celdas**: si se agruparan en una, la rejilla diría 250 donde el
  // almacén dice tres, y el contador de ranuras —que ya cuenta tres— quedaría
  // descolocado de lo que el jugador ve. La agrupación de la vista tiene que usar
  // la misma regla que el contador, o las dos mienten con dos números distintos.
  const grupos: Array<{ item: any; ids: string[]; count: number }> = [];
  const celdaDe = new Map<string, number>();

  for (const w of items) {
    if (isStackable(w)) {
      const clave = `${w.type}_${w.name}`;
      const previa = celdaDe.get(clave);
      const tope = topeDePila(w.type);

      if (previa !== undefined && tope === Infinity) {
        grupos[previa].ids.push(w.id);
        // F30 · Se suman las unidades REALES, sin `Math.min(..., tope)`: el tope es
        // de PINTADO, y recortar aquí hacía que 150 llaves se Teachan "99" con el
        // jugador detrás de la pantalla. El texto es cosa de `textoDeCantidad`.
        grupos[previa].count += w.stackCount || 1;
        continue;
      }

      if (previa !== undefined && (grupos[previa].count as number) + stackUnits(w) <= tope) {
        grupos[previa].ids.push(w.id);
        grupos[previa].count += stackUnits(w);
        continue;
      }

      celdaDe.set(clave, grupos.length);
      grupos.push({ item: w, ids: [w.id], count: stackUnits(w) });
      continue;
    }

    grupos.push({ item: w, ids: [w.id], count: 0 });
  }

  return grupos;
}

/**
 * EL FILTRO DE AUTO-VENTA, Y POR QUÉ VA EN LA FICHA DE LA CAJA Y NO EN EL DIÁLOGO.
 *
 * ## DÓNDE
 *
 * El diálogo de "cuántas cajas" es del motor —`showConfirmModal()` con un
 * `quantity`— y meterle un formulario de filtro dentro sería pelearse con un módulo que
 * solo sabe pintar un mensaje y dos botones. La ficha de la caja es **el sitio donde ya
 * se abre la caja**, está a la vista durante todo el flujo y el filtro se guarda al
 * cambiarlo: quien lo enciende una vez no lo vuelve a tocar.
 *
 * ## QUÉ VES
 *
 * Un conmutador, tres casillas de tipo, dos selectores y **una frase que dice qué se
 * vende**. La frase es lo que hace seguro el filtro: un conmutador encendido sin
 * explicación se enciende por error, y en una venta automática no hay forma de
 * deshacerlo. La frase sale de `descripcionDeAutoVenta()`, que la lee de la
 * configuración —no es un texto escrito al lado— y por eso no puede quedarse diciendo
 * otra cosa de lo que el filtro hace.
 *
 * ## Y POR QUÉ LOS SELECTORES VAN EN ORDEN DE "CUANDO DEJO DE NECESITARLO"
 *
 * `tierMax` y `potencialMax` son "hasta T2" y "de ★2 o menos", no al revés. La pregunta
 * al abrir cajas es siempre cuánto te queda-serving, y lo que se descarta es lo bajo:
 * un T9 sirve para forjar y además es material de forja. Un filtro al revés no lo usaría
 * nadie.
 */
function filtroDeAutoVentaHTML(game: any): string {
  const cfg = game.getAutoVenta?.() ?? AUTO_VENTA_POR_DEFECTO;
  const descripcion = descripcionDeAutoVenta(cfg, nombreDeTipoDeAuto);

  const chip = (t: TipoDeVentaAuto) => {
    const marcado = cfg.tipos[t];
    return `
      <button class="px-2.5 h-8 rounded-lg text-[10px] font-mono cursor-pointer transition
                     ${marcado ? 'accent-bg text-slate-950 font-bold' : 'btn-ghost text-[var(--text-muted)]'}"
              data-act="av-tipo" data-av-tipo="${t}" aria-pressed="${marcado}">${nombreDeTipoDeAuto(t)}</button>`;
  };

  const opcion = (valor: number, texto: string, actual: number) => `
    <option value="${valor}" ${actual === valor ? 'selected' : ''}>${texto}</option>`;

  return `
    <div class="mt-2 rounded-xl px-2.5 py-2 border"
         style="border-color: color-mix(in srgb, var(--accent) 25%, transparent)">
      <button class="w-full flex items-center justify-between gap-2 cursor-pointer"
              data-act="av-activa" aria-pressed="${cfg.activa}">
        <span class="text-[10px] font-mono font-bold ${cfg.activa ? 'accent-text' : 'text-[var(--text-muted)]'}">
          Vender el botín que no quieras
        </span>
        <span class="text-[10px] font-mono ${cfg.activa ? 'accent-text' : 'text-[var(--text-muted)]'}">
          ${cfg.activa ? 'sí' : 'no'}
        </span>
      </button>

      ${cfg.activa ? `
        <div class="mt-2 flex flex-col gap-2">
          <div class="flex flex-wrap gap-1.5">${TIPOS_DE_VENTA_AUTO.map(chip).join('')}</div>
          <div class="flex items-center gap-1.5">
            <select data-av-tier class="h-8 px-1.5 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
                    aria-label="Tier máximo que se vende">
              ${TOPES_TIER.map((t) => opcion(t, t === 0 ? 'cualquier tier' : `hasta T${t}`, cfg.tierMax)).join('')}
            </select>
            <select data-av-pot class="h-8 px-1.5 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
                    aria-label="Potencial máximo que se vende">
              ${TOPES_POTENCIAL.map((p) => opcion(p, p === 0 ? 'cualquier potencial' : `hasta ★${p}`, cfg.potencialMax)).join('')}
            </select>
          </div>
          <p class="text-[9px] font-mono leading-relaxed text-[var(--text-muted)]">${descripcion}</p>
        </div>` : `
        <p class="text-[9px] font-mono leading-relaxed text-[var(--text-muted)] mt-1">${descripcion}</p>`}
    </div>`;
}

/** Cómo se llama cada tipo en el filtro. Vive aquí porque es de esta pantalla. */
function nombreDeTipoDeAuto(t: TipoDeVentaAuto): string {
  return t === 'collector' ? 'Armas' : t === 'companion' ? 'Compañeros' : 'Consumibles';
}

/**
 * Lleva el grupo que ocupa la celda de `draggedId` a la celda `dstViewIndex`.
 *
 * El destino se traduce a un ANCLA —el item que tiene que quedar detrás— y se
 * deja que el juego la busque por id DESPUÉS de quitar el grupo. No se traduce
 * a un índice del array porque la cuenta de celdas que hay detrás cambia en
 * cuanto se quita el grupo arrastrado: por eso, con una pila en medio, soltar
 * sobre una celda ocupada dejaba el item una celda más a la derecha de donde se
 * había soltado, y soltar sobre un hueco del final no movía nada, porque todos
 * los huecos se recortaban a la última celda ocupada, que era justo la celda de
 * origen.
 */

/**
 * El mismo traslado, con el filtro y el orden como parámetros en vez de leídos
 * del estado de pantalla. La rejilla que el jugador está viendo y la que usa el
 * arrastre tienen que ser LA MISMA: si divergen, el número de celda que señala no
 * es el sitio que se mueve. Se puede comprobar sin DOM, que es lo que hace este
 * banco de pruebas.
 */

/**
 * ¿Este item pasa la búsqueda del almacén?
 *
 * **LA BÚSQUEDA ES UN TERCER FILTRO, Y NO UN "ORDEN"**: el `filter` elige el tipo y
 * `sort` elige el eje, y los dos son listas cerradas de la barra de herramientas. La
 * búsqueda es texto libre, y por eso se compone con los otros dos en vez de sustituir a
 * ninguno: buscar "AK-7" dentro de "Recolectores" tiene que salir distinto de buscarlo
 * dentro de "Todo".
 *
 * ## LAS TRES MITADES DE LA COINCIDENCIA, Y POR QUÉ SON TRES
 *
 * · **El nombre**, sin tildes y en minúsculas, y con el texto del **detalle** también:
 *   el jugador busca "t10" o "divino" y el nombre no lo dice.
 * · **El tier**, como número: buscar "10" tiene que encontrar el T10 aunque el nombre no
 *   lo lleve, porque el jugador que busca por tier lo hace por el número que ve en la
 *   celda.
 * · **Una coincidencia por palabras enteras**, no por subcadena: buscar "t1" **no**
 *   devuelve el T10. Es el error clásico del buscador y el que más molesta, porque el
 *   jugador ve quince resultados que no son los que ha pedido y no entiende por qué.
 *
 * ## POR QUÉ NO ES UN `includes` SOBRE EL NOMBRE
 *
 * Porque el almacén guarda "Ak-7 Valioso" y el jugador escribe "ak 7", y porque el
 * teclado del móvil no siempre pone las tildes. Se normaliza una vez por item y una vez
 * por búsqueda —no en cada comparación—, y por eso la normalización es una función
 * suelta: el índice de la Forja necesita la misma y copiarla sería la segunda versión de
 * la misma regla.
 *
 * Y **el texto de la búsqueda se parte en términos y todos tienen que aparecer**: "ak 7"
 * son dos términos, y un jugador que escribe eso quiere los AK-7, no los AK ni los 7.
 */
export function normalizaBusqueda(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Los términos de la búsqueda, ya normalizados y sin los que no dicen nada. */
export function terminosDeBusqueda(texto: string): string[] {
  return normalizaBusqueda(texto)
    .split(/[\s,·]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/** El texto de un item por el que se puede buscar: nombre, detalle, rareza y tipo. */
export function textoBuscable(w: any): string {
  const tipo = w.type === 'collector' ? 'recolector'
    : w.type === 'companion' ? 'compañero'
    : w.type === 'consumable' ? 'consumible'
    : w.type === 'crate' ? 'caja'
    : String(w.type ?? '');
  return normalizaBusqueda(
    `${w.name ?? ''} ${w.details ?? ''} ${w.rarity ?? ''} ${tipo}`
  );
}

/** Los términos que llevan solo números, que son los del tier y los de un nombre. */
function esTerminoDeNumero(t: string): boolean {
  return /^t?\d+$/.test(t);
}

/** El número de un término numérico, con la "t" delante si la lleva. */
function numeroDeTermino(t: string): number {
  return Number(t.replace(/^t/, ''));
}

/**
 * ¿Un término encuentra a este item?
 *
 * ## POR QUÉ UN TÉRMINO CON LETRAS ES PREFIJO Y UNO NUMÉRICO NO
 *
 * Es lo que separa "ak" de "t1", y es toda la diferencia entre un buscador útil y uno
 * que parece roto:
 *
 * · **Con letras, prefijo de una palabra**: "ak" tiene que encontrar "Ak-7" y "Ak-10".
 *   Si fuera coincidencia entera, "ak" no encontraría nada y el jugador concluiría que el
 *   buscador no funciona.
 * · **Con números, el tier exacto**: "t1" tiene que devolver el T1 y **no** el T10. Un
 *   prefijo aquí devuelve el T10 al buscar el T1, y eso es el error clásico: quince
 *   resultados que no son los que se han pedido, sin explicación posible.
 *
 * Y **un número también mira dentro del texto**, porque "ak 7" son dos términos y el
 * "7" es del nombre, no del tier: sin esa mitad, escribir el nombre completo con un
 * espacio no encuentra nada, que es la forma más probable de escribirlo en un teclado.
 *
 * ## Y LAS PALABRAS SE CORTAN POR ESPACIOS, NO POR TODO LO QUE NO ES LETRA
 *
 * Que sea por espacios y no "por lo que no es una letra" es lo que hace que "ak-7" sea
 * **una** palabra. Cortando por cualquier cosa que no sea letra, el guion desaparecía y
 * "ak-7" se convertía en dos: el término entero no encontraba nada y el buscador parecía
 * roto justo con el nombre completo, que es lo primero que se escribe.
 */
function coincideTermino(w: any, termino: string, texto: string): boolean {
  if (esTerminoDeNumero(termino)) {
    // El tier es una comparación exacta, no un prefijo: por eso se lee del item.
    if (numeroDeTermino(termino) === Number(w.tier)) return true;
    // Y además dentro del texto, para los nombres que llevan números.
    return texto.includes(termino);
  }
  return texto
    .split(/[\s,;/·|]+/)
    .some((palabra: string) => palabra.length > 0 && palabra.startsWith(termino));
}

export function matchesSearch(w: any, terminos: string[]): boolean {
  if (!terminos || terminos.length === 0) return true;
  const texto = textoBuscable(w);
  // Todos los términos tienen que aparecer: son "y" y no "o", porque un jugador que
  // escribe "ak oscuro" quiere los dos, no los que tengan cualquiera de los dos.
  return terminos.every(t => coincideTermino(w, t, texto));
}

/** ¿El item pasa el filtro activo de la rejilla *y* la búsqueda activa? */
export function matchesFilter(w: any, filtro: string): boolean {
  // **`otros` ES "TODO LO QUE NO SON LAS DOS COSAS GRANDES", NO "LO QUE SOBRA".** Con el
  // filtro de cajas fuera, cajas, llaves, cristales y consumibles caen los cinco aquí, y
  // un jugador buscando las cajas para abrirlas tenía que abrirlas todas una a una para
  // reconocerlas. Con `crate` añadido a la lista de las dos cosas grandes, `otros` se
  // queda con llaves, cristales y consumibles, que es lo que se leía como "lo demás".
  //
  // **LA LISTA DE LAS DOS ESTÁ ESCRITA AQUÍ Y EN `FILTROS`, Y TIENE QUE SEGUIR SIENDO LA
  // MISMA.** Es la clase de pareja que se separa: si `matchesFilter()` gana un filtro y
  // `FILTROS` no lo enseña, el botón existe y no hace nada; y al revés sale un botón que
  // filtra por algo que no está en la regla. El banco de filtros fija las dos mitades.
  const GRANDES = ['collector', 'companion', 'crate'];
  if (filtro === 'otros' && !GRANDES.includes(w.type)) return true;
  if (filtro === 'collector' || filtro === 'companion' || filtro === 'crate') return w.type === filtro;
  return filtro === 'all';
}

/**
 * El filtro completo: tipo **y** búsqueda.
 *
 * Con la búsqueda añadida, aplicar las dos mitades en la vista era justo el sitio donde
 * podían separarse: una rejilla que busca y otro sitio que solo filtra, y un arrastre
 * que cuenta celdas distintas de las que se ven. Ahora hay un solo sitio, y es el mismo
 * que usan la rejilla, el arrastre y el banco de pruebas.
 */
export function pasaElFiltro(w: any, filtro: string, terminos: string[] = []): boolean {
  return matchesFilter(w, filtro) && matchesSearch(w, terminos);
}

// ==========================================================================
//  Acciones sobre items
//
//  Estas tres funciones ya NO mutan el estado: solo piden la operación al
//  game loop y enseñan lo que pasó. Antes cada una restaba el item por su
//  cuenta y llamaba a `updateState`, y ahí estaba el bug de las cajas: el
//  contador se recalculaba antes de que el item se hubiera quitado de verdad,
//  así que la caja volvía a aparecer en el guardado siguiente.
//
//  Concentrar la mutación en el game loop también evita que la vista y el
//  cálculo discrepen: el precio que se enseña es el que se cobra, porque los
//  dos salen del mismo número.
// ==========================================================================
/**
 * Abre una caja. Sin llave, sin selector y sin pedir permiso.
 *
 * **LO QUE SE VA NO ES UNA COMODIDAD, ES UNA DECISIÓN QUE EL JUGADOR TOMABA SIN
 * QUERER.** Antes había que tener la llave del nivel, y la llave venía de la caja
 * anterior o de la tienda: dos caminos, dos estados en el botón ("Abrir caja" o
 * "Falta la llave") y un selector para cuando había más de una que sirviera. Todo
 * eso era **el mismo juego con un paso más**, y el paso no decidía nada: el
 * premio que salía no dependía de la llave.
 *
 * Ahora el botón tiene **un solo texto** y no hay nada que comprobar antes de
 * abrir. Que el motor siga validando sigue siendo lo correcto —la vista nunca
 * decide si una operación es legal, solo la pide—, pero la vista ya no *predice*
 * si lo es.
 */
function openCrate(game: any, item: any, redraw: () => void) {
  const crateType = inferCrateType(item.name);
  // F31 · `inferCrateType` devuelve `null` para lo que no reconoce, y antes
  // devolvía `legendary`: un item con el nombre corrupto se proponía como la caja
  // más alta y el motor recibía un tipo de caja que no existía en el juego.
  if (!crateType) {
    showToast(`No se reconoce el tipo de ${item.name}.`, 'error');
    return;
  }

  confirmarYabrir(game, item, crateType, redraw);
}

function confirmarYabrir(
  game: any, item: any, crateType: any, redraw: () => void
) {
  // F18: con pila se pregunta cuántas, con el mismo selector de la venta. El
  // tope es lo que de verdad se puede abrir, y lo decide `maximoDeApertura()`:
  // las cajas que hay, y el tope de una apertura. **El mínimo de las llaves se fue
  // con ellas**, y con él la mitad de la comprobación.
  //
  // La regla vive en `crateSummary.ts` y no aquí. Antes era este `Math.min`
  // suelto, y eso era R2 en la forma más silenciosa que hay: la regla no estaba
  // duplicada, estaba **escondida** en el único sitio del proyecto al que ningún
  // banco puede llegar.
  //
  // **Y AHORA TAMBIÉN SABE CUÁNTO ESPACIO QUEDA.** El tercer mínimo de `maximoDeApertura()`
  // es el almacén, porque abrir veinte cajas llena es pedir un botín que no cabe: el item
  // que no entra **se pierde sin decir nada** y la ruleta enseña un objeto que nadie tiene.
  // Aquí se lo pregunta al motor, que es quien cuenta las ranuras ocupadas; el diálogo no
  // cuenta Slots porque no es su regla.
  const huecos = Math.max(
    0,
    (game.getCapacity?.() ?? 0) - countOccupiedSlots(game.getState().warehouse as any[])
  );
  const max = maximoDeApertura(stackUnits(item), huecos);

  // **Y SI NO HAY NI PARA UNA, SE DICE POR QUÉ EN VEZ OFRECER UN DIÁLOGO VACÍO.** Con el
  // almacén sin huecos, un selector que va de 1 a 20 y se abre en 20 es una promesa que el
  // motor no puede cumplir.
  if (huecos <= 0 && stackUnits(item) > 1) {
    showToast('No queda espacio en el almacén para el botín. Vende algo o libera una ranura.', 'error');
    return;
  }
  if (max <= 1) {
    showConfirmModal(
      mensajeAbrirCaja(item.name),
      () => abrirCajas(game, item, crateType, 1, redraw),
      { sublabel: item.name, confirmText: 'Abrir' }
    );
    return;
  }

  showConfirmModal(
    mensajeAbrirCaja(item.name),
    (units) => abrirCajas(game, item, crateType, units ?? max, redraw),
    {
      sublabel: item.name,
      confirmText: 'Abrir',
      quantity: {
        max,
        itemName: item.name,
        unitName: 'caja',
        amount: (n) => `${n} × ${item.name}`,
        verbo: 'abrir',
        sufijoImporte: '',
      }
    }
  );
}

/**
 * Abre N cajas seguidas y enseña UNA lista de lo que salió.
 *
 * Cada apertura es una llamada entera a `openCrateBox`: el motor consume, sortea
 * y aplica de una en una, así que un lote es N operaciones honestas y no una
 * operación con multiplicador. Si una falla a mitad, se para y se dice cuántas se
 * abrieron y por qué no siguieron: abrir las que quepan y contar las que sobraron,
 * que es la opción elegida de F18.
 *
 * **LO QUE CAMBIÓ ES CÓMO SE ENSEÑA, NO CÓMO SE SORTEA.** Antes un lote de 20
 * encadenaba veinte ruletas con veinte CONTINUAR: veinte pantallas para un
 * resultado, con el jugador teniendo que sumar a mano lo que se lleva. Y la
 * cifra que más importa —las nanitas— salía partida en veinte casillas.
 *
 * Ahora **una caja sigue con su ruleta** —es el momento del trompo y se pierde— y
 * **el lote se resuelve en una lista**: las monedas sumadas en una fila, los
 * materiales agrupados por lo que son, y cada objeto con su nombre. Si sale el
 * Espectro Azulado en la séptima de veinte, sale su fila y no un cartel entre
 * diecinueve.
 *
 * Y `resumenDePremios()` es una función pura, sin DOM: la regla de qué se suma y
 * qué no se suma se puede comprobar con un banco, que es lo único que impide que
 * "sumar nanitas" y "enseñar el total" se separen.
 */
function abrirCajas(
  game: any, item: any, crateType: any, n: number, redraw: () => void
) {
  const premios: any[] = [];
  let motivo = '';
  for (let i = 0; i < n; i++) {
    const res = game.openCrateBox(item.id);
    if (!res.ok || !res.reward) {
      motivo = res.msg || 'No se pudo abrir la caja.';
      break;
    }
    premios.push(res.reward);
  }

  ui.selectedId = null;
  if (premios.length === 0) {
    sfx.error();
    showToast(motivo, 'error');
    redraw();
    return;
  }

  const cerrar = () => {
    if (premios.length < n) showToast(`Se abrieron ${premios.length} de ${n}: ${motivo}`, 'info');
    redraw();
  };

  // Una sola caja conserva la ruleta: es un momento y el trompo es el premio de
  // abrir. El lote es lo que cambia, porque veinte trompos no son veinte datos.
  if (premios.length === 1) {
    showCrateRoulette(premios[0], crateType, cerrar);
    return;
  }

  showCrateSummary(premios, { crateType, pedidas: n, motivo }, cerrar);
}

/**
 * El mensaje de "se gastará la caja", con el nombre de la caja destacado.
 *
 * **LO QUE ESTA FUNCIÓN DICE Y POR QUÉ SIGUE SIENDO UN NODO Y NO UNA CADENA.** El
 * nombre va en un `span` aparte porque el texto también lo escriben el admin y el
 * guardado (R25), y un `<b>` dentro de la cadena salía en pantalla tal cual: el
 * jugador leía "Se gastará <b>Llave Reforzada</b>". Ahora solo hay un nombre y es el
 * de la caja, que viene de la partida, así que **el mismo cuidado y el mismo
 * motivo**: sigue yendo por `textContent`, porque el día que alguien lo escriba como
 * cadena va a aparecer la etiqueta dentro del mensaje.
 *
 * Y la segunda frase, la de la ruleta, sigue sin explicar cómo se sortea. Es a
 * propósito: es lo último que se lee antes de confirmar, y leerlo convierte la
 * confirmación en "pago por ver una animación que no hace nada". Lo que el jugador
 * vive es que no sabe qué va a salir hasta que la casilla se para.
 */
function mensajeAbrirCaja(nombreCaja: string): HTMLElement {
  const texto = document.createElement('span');
  const destacada = document.createElement('span');
  destacada.className = 'font-bold accent-text';
  destacada.textContent = nombreCaja;
  texto.append(
    'Se gastará ', destacada,
    '. La ruleta gira y te dice qué ha salido. Tabla distinta por caja.'
  );
  return texto;
}

/**
 * F31 · EL TIPO DE CAJA SE LEE DEL NÚMERO DEL NOMBRE.
 *
 * Antes eran cuatro palabras sueltas y, **si no reconocía el nombre, devolvía
 * `legendary`**. Eso era lo peor de la función: un item de caja con el nombre
 * corrupto, o de una partida vieja con un nombre que nadie escribía, se proponía
 * como la mejor caja del juego. Aquí lo desconocido devuelve `null`, que es lo
 * que la vista ya sabe tratar: no se puede abrir.
 *
 * Y las cuatro cajas viejas siguen leyéndose, en el nivel donde vivían.
 */
function inferCrateType(name: string): CrateType | null {
  const l = (name || '').toLowerCase();
  const moderna = l.match(/caja t(\d+)/);
  if (moderna) {
    const t = Number(moderna[1]);
    return (t >= 1 && t <= MAX_CRATE_TIER) ? (t as CrateType) : null;
  }
  if (l.includes('común')) return 1;
  if (l.includes('rara')) return 3;
  if (l.includes('épica')) return 6;
  if (l.includes('legendaria')) return 8;
  return null;
}

/**
 * Aplica un consumible, y CUÁNTOS DE UNA VEZ si el tope lo deja.
 *
 * ## POR QUÉ UN SELECTOR Y NO UN BOTÓN DE MÁXIMO
 *
 * "Usar máximo" gasta todo lo que haya, y hay un caso en el que eso **tira recursos**:
 * veinte tarjetas AFK en la pila dan tres y las otras diecisiete se consumen para nada.
 * Así que el diálogo pregunta **cuántas**, con el máximo como opción de un toque, y el
 * motor recorta lo que se pida contra el tope: ni se gasta de más ni se rechaza entero.
 *
 * ## Y EL NÚMERO LO PONE EL MOTOR
 *
 * `planUseConsumable()` es el mismo que llama el propio `useConsumable()` para decidir el
 * gasto, así que el máximo del diálogo y el tope del cobro **no pueden separarse**.
 * El `motivo` es lo que se enseña cuando no cabe ni una: sin él el jugador ve un
 * botón apagado sin saber si es que no tiene unidades, que ya está al tope o que ese
 * consumible no se usa desde el almacén.
 *
 * **SIN SELECTOR CUANDO SOLO CABE UNA**, porque un diálogo con un número que solo
 * puede ser uno es ruido.
 */
export function useConsumable(game: any, item: any, redraw: () => void) {
  const plan = game.planUseConsumable?.(item.id) ?? { unidades: 0, max: 0, motivo: null };
  if (plan.unidades <= 0) {
    sfx.error();
    showToast(plan.motivo ?? 'Ese consumible ya no hace nada.', 'info');
    return;
  }

  const aplicar = (units: number) => {
    const res = game.useConsumable(item.id, units);
    if (!res.ok) {
      sfx.error();
      showToast(res.msg || 'No se pudo usar.', 'error');
      return;
    }
    sfx.use();
    ui.selectedId = null;
    redraw();
  };

  // El texto de una unidad y el de varias, porque "aplicado" no dice si se gastaron
  // tres o veinte, y el jugador acaba mirando la pila para averiguarlo.
  const textoUno = item.details || 'Aplicar el efecto de este consumible.';
  if (plan.unidades <= 1) {
    showConfirmModal(textoUno, () => aplicar(1));
    return;
  }

  showConfirmModal(
    textoUno,
    (units?: number) => aplicar(Math.max(1, Math.floor(Number(units) || 1))),
    {
      quantity: {
        max: plan.unidades,
        // El nombre y la unidad salen de la ficha, y el verbo es el del botón: sin él
        // el selector diría "3 a vender" de un consumible que no se vende.
        itemName: item.name,
        unitName: 'unidades',
        // **EL IMPORTE DICE LO QUE SE APLICA, NO LO QUE SE GASTA.** Un consumible no se
        // cobra ni se vende: lo que se gasta es la pila, y eso lo enseña el propio
        // selector bajando el número.
        amount: (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`,
        verbo: 'aplicar',
        sufijoImporte: ''
      },
    }
  );
}

/**
 * CUANTOS CONSUMIBLES HAY DE CADA BUFF ASIGNABLE.
 *
 * **ESTO NO ES LA BARRA, Y QUE NO LO SEA ES JUSTO EL ARREGLO.** La barra se llenaba sola
 * con `consumiblesDeAcceso()`, que elegía los tres más caros del almacén. Se quitó porque
 * no era lo que se pidió y porque **elegir por el jugador es decidir por él**: la Piedra
 * de Calibración llena una ranura y es un consumible de Forja, así que un botón que no
 * hace nada aparece donde se espera que haga algo.
 *
 * Ahora las ranuras las pone el jugador y el motor las guarda, así que esta función ya no
 * tiene nada que decidir. Lo que queda es una pregunta de inventario, y esa sí es
 * del almacén: cuántos tienes de cada buff asignable.
 *
 * **Y CUENTA UNIDADES, NO ITEMS.** Una tarjeta apilada son tres unidades y por eso suma
 * `stackCount`; el selector de la ranura enseña "3", no "1". Contar filas daría un 1 en
 * un botón que gasta tres, que es el bug del contador de AFK que ya salió una vez.
 */
export function unidadesDeBuff(game: any, buffId: string): number {
  const state = game.getState();
  let total = 0;
  for (const w of (state.warehouse || []) as any[]) {
    if (w.type !== 'consumable') continue;
    // **`buffId` Y NO EL NOMBRE.** Hay partidas viejas sin el campo y el motor lo infiere
    // del nombre; aquí se cuenta solo lo que lo tiene escrito, que es donde está todo lo
    // que la barra puede asignar. Un item sin `buffId` no se puede asignar a una ranura,
    // así que tampoco tiene que contar.
    if (w.buffId !== buffId) continue;
    total += w.stackable ? (w.stackCount || 1) : 1;
  }
  return total;
}

/**
 * HOJA PARA ELEGIR QUÉ VA EN UNA RANURA.
 *
 * **ES UNA HOJA, NO UN DESPLEGABLE, POR DEDO.** Elegir consumible es una decisión que no
 * se toma con un dedo, y encima de tres huecos un desplegable acaba con media pantalla
 * tapada. La hoja se abre sobre la base, se lee entera y se cierra.
 *
 * **LO QUE SE OFRECE ES LO QUE HAY, Y SE DICE POR QUÉ CADA COSA NO SE PUEDE.** Un hueco
 * que ofrece una tarjeta que no tienes es un hueco que miente. Y uno que ya está en otra
 * ranura sale con el motivo escrito, porque "no" a secas no enseña la regla (nada puede
 * estar en dos ranuras): el motivo es lo que se recuerda.
 *
 * **EL MOTOR MANDA LA LISTA.** `getBarraConsumibles()` y `asignarBarraConsumible()` saben
 * qué se puede asignar y qué está repetido. Aquí no se decide: se pinta y se llama. Por
 * eso esta hoja no puede asignar nada que el juego no acepte.
 */
function hojaDeRanura(game: any, ranura: number, redraw: () => void): void {
  const ranuras: any[] = game.getBarraConsumibles?.() ?? [];

  // Cuántas unidades hay de cada buff. Va por el almacén y no por el guardado de la
  // ranura, porque la ranura guarda QUÉ se usa, no CUÁNTO hay.
  const unidadesDe = (buffId: string): number => {
    const state = game.getState();
    let total = 0;
    for (const w of (state.warehouse || []) as any[]) {
      if (w.type !== 'consumable') continue;
      if ((w.buffId ?? null) !== buffId) continue;
      total += w.stackable ? (w.stackCount || 1) : 1;
    }
    return total;
  };

  // En qué ranura está cada buff ahora mismo.
  const ranuraDe = (buffId: string): number =>
    ranuras.findIndex(h => h && h.buffId === buffId);

  const filas = CONSUMIBLES_ASIGNABLES.map((buffId) => {
    const ficha = consumibleAsignable(buffId);
    if (!ficha) return '';
    const n = unidadesDe(buffId);
    const en = ranuraDe(buffId);
    // `en === ranura` NO es un conflicto: es este mismo hueco. Distinguirlos evita que
    // elegir lo que ya está puesto se rechace a sí mismo.
    const enOtro = en !== -1 && en !== ranura;

    const motivo = enOtro
      ? 'Ya está en la ranura ' + (en + 1)
      : n === 0
        ? 'No tienes ninguna'
        : 'Poner aquí';
    const bloqueado = enOtro || n === 0;

    return `
      <button data-asignar="${buffId}"
        class="w-full text-left px-3 py-2.5 rounded-lg border flex items-center gap-3
               ${bloqueado ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer transition active:scale-[0.99]'} '
        style="background: color-mix(in srgb, var(--accent) 5%, transparent);
               border-color: color-mix(in srgb, var(--accent) 25%, transparent)"
        ${bloqueado ? 'disabled' : ''}>
        <span class="min-w-0 flex-1">
          <span class="block text-[12px] font-bold accent-text leading-tight truncate">
            ${ficha.name}
          </span>
          <span class="block text-[10px] font-mono text-[var(--text-muted)] leading-snug mt-0.5">
            ${ficha.details}
          </span>
        </span>
        <span class="flex-shrink-0 text-right">
          <span class="block text-[11px] font-mono font-bold tabular">${n}</span>
          <span class="block text-[9px] font-mono text-[var(--text-muted)] leading-tight">${motivo}</span>
        </span>
      </button>`;
  }).join('');

  const yaPuesto = ranuras[ranura] && ranuras[ranura].buffId;
  const vaciar = yaPuesto
    ? '<button data-vaciar class="w-full px-3 py-2.5 rounded-lg border border-[var(--border-color)]' +
      ' text-[11px] font-mono text-[var(--text-muted)] cursor-pointer transition active:scale-[0.99]">' +
      'Dejar la ranura vacía</button>'
    : '';

  const hoja = htmlToNode(`
    <div class="flex flex-col gap-2 text-left" style="max-width:24rem">
      <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
        Cada ranura usa su consumible al pulsarla. Un consumible no puede estar en dos
        ranuras a la vez, así que los que ya tienes puestos salen con el motivo.
      </p>
      ${filas}
      ${vaciar}
    </div>
  `);

  // **SIN BOTÓN DE CONFIRMAR.** Elegir en la hoja ES la acción; un "Confirmar" al lado,
  // además de duplicar la elección, aparenta que hace falta para cerrarla.
  const cerrar = showConfirmModal(hoja, () => { redraw(); }, {
    sublabel: 'Ranura ' + (ranura + 1),
    confirmDisabled: true,
    cancelText: 'Cerrar'
  });

  // Los listeners van sobre el nodo que este diálogo acaba de crear, nunca sobre `#app`:
  // el overlay vive fuera del árbol de la página (R5).
  const root: any = hoja;
  root.querySelectorAll?.('button[data-asignar]:not([disabled])').forEach((b: any) => {
    b.addEventListener('click', () => {
      const buffId = b.getAttribute('data-asignar');
      if (!buffId) return;
      const res = game.asignarBarraConsumible?.(ranura, buffId);
      // Nunca se lanza al usuario (R4): el motor contesta y se enseña lo que dijo.
      if (res && res.ok) {
        cerrar();
        redraw();
      } else if (res && res.msg) {
        showToast(res.msg, 'error');
      }
    });
  });
  root.querySelectorAll?.('button[data-vaciar]').forEach((b: any) => {
    b.addEventListener('click', () => {
      game.asignarBarraConsumible?.(ranura, null);
      cerrar();
      redraw();
    });
  });
}

/**
 * PINTAR LA BARRA, Y CABLEARLA.
 *
 * **AHORA LA LLENA EL JUGADOR, Y ESO CAMBIA TRES COSAS.** Ya no se elige por el valor:
 * cada ranura tiene lo que el jugador le puso, así que hay un hueco vacío de verdad y un
 * botón para llenarlo. Y ya no puede aparecer un consumible de Forja, porque el motor solo
 * acepta los tres de `CONSUMIBLES_ASIGNABLES` y la coacción del guardado borra cualquier
 * otra cosa que hubiera.
 *
 * **CADA RANURA ES TRES ACCIONES Y HAY QUE PODER SEGUIR LAS TRES.** El cuerpo usa, la ✕
 * quita, y el hueco vacío abre el selector. Con una sola acción por ranura habría que
 * elegir entre ellas, y hacen falta las tres: gastar sin poder quitar obliga a vaciar la
 * ranura desde el guardado, y quitar sin poder abrir el selector obliga a ir al almacén.
 *
 * **LA ✕ NO ES UN `<button>`, Y ES POR EL HTML.** Un botón dentro de un botón es HTML
 * inválido: el navegador cierra el de fuera y el clic acaba en el de dentro, así que
 * quitar se gastaba el consumible. Es un `span` con rol de botón, en una esquina para no
 * pulsarla sin querer, y con `stopPropagation` para que el clic no llegue a usar.
 *
 * **EL MOTOR DICE SI SE PUEDE USAR, NO LA VISTA.** El `plan` viene en la ranura y es el
 * mismo que usa el almacén (R3). El motivo va en el `title`: "ya está al tope" y "no
 * tienes" son cosas distintas.
 */
export function pintarBarraDeConsumibles(game: any, redraw: () => void): void {
  const barra = document.getElementById('barra-consumibles');
  if (!barra) return;
  const ranuras: any[] = game.getBarraConsumibles?.() ?? [];

  barra.innerHTML = Array.from({ length: RANURAS_BARRA }, (_, i) => {
    const h = ranuras[i];

    // **HUECO VACÍO DE VERDAD: ABRE EL SELECTOR.** Un rectángulo punteado que no hace
    // nada es un adorno; uno que abre la hoja es el sitio donde se decide qué consume
    // esta barra.
    if (!h || !h.buffId) {
      return `<button data-abrir="${i}"
        class="h-11 rounded-xl border border-dashed w-full cursor-pointer transition active:scale-95"
        style="border-color: color-mix(in srgb, var(--text-main) 15%, transparent)"
        title="Elegir qué consumible va aquí"
        aria-label="Elegir qué consumible va en la ranura ${i + 1}">
        <span class="text-[9px] font-mono text-[var(--text-muted)] leading-none">+ ranura ${i + 1}</span>
      </button>`;
    }

    // **SIN ITEM EL HUECO SIGUE OCUPADO, Y ESO ES OTRA COSA.** "No has puesto nada" y
    // "has puesto esto y te has quedado sin" se arreglan distinto: el primero abriendo la
    // hoja, el segundo gastando más. Por eso sale el nombre y un 0 en vez de un hueco
    // vacío, que mentiría sobre lo que has configurado.
    const plan = h.plan ?? { unidades: 0, max: 0, motivo: null };
    const sinItem = !h.itemId;
    const motivo = sinItem ? 'No tienes ninguna en el almacén.' : plan.motivo;
    const sirve = !sinItem && plan.unidades > 0;

    return `
      <div class="relative h-11 w-full">
        <button data-ranura="${i}"
          class="h-11 w-full rounded-xl border px-2 flex flex-col justify-center items-center
                 ${sirve ? 'cursor-pointer transition active:scale-95' : 'opacity-45 cursor-not-allowed'} '
          style="background: color-mix(in srgb, var(--accent) 5%, transparent);
                 border-color: color-mix(in srgb, var(--accent) 30%, transparent)"
          ${sirve ? '' : 'disabled aria-disabled="true"'}
          title="${motivo || h.detalles || h.nombre}">
          <span class="w-full text-center px-3 text-[9px] font-mono text-[var(--text-muted)] leading-none truncate">
            ${h.nombre}
          </span>
          <span class="text-[12px] font-mono font-bold accent-text leading-tight mt-0.5 tabular">
            ${h.unidades}
          </span>
        </button>
        <span data-quitar="${i}" role="button" tabindex="0"
          class="absolute top-0.5 right-1 w-4 h-4 rounded-full flex items-center justify-center
                 text-[11px] leading-none text-[var(--text-muted)] cursor-pointer
                 hover:text-[var(--text-main)]"
          title="Quitar de esta ranura"
          aria-label="Quitar ${h.nombre} de la ranura ${i + 1}">×</span>
      </div>`;
  }).join('');

  // --- Los tres manejadores, uno por acción, todos sobre la barra, que es el nodo que
  // `renderLayoutHTML()` crea una vez y no se recrea en cada repintado. ---
  barra.querySelectorAll('button[data-abrir]').forEach(b => {
    b.addEventListener('click', () => {
      hojaDeRanura(game, Number(b.getAttribute('data-abrir')), redraw);
    });
  });

  barra.querySelectorAll('button[data-ranura]:not([disabled])').forEach(b => {
    b.addEventListener('click', () => {
      const ranura = Number(b.getAttribute('data-ranura'));
      const h = ranuras[ranura];
      if (!h || !h.item) return;
      // El diálogo de cantidad y el de un solo uso los pone `useConsumable()`, que es el
      // mismo camino que el almacén. **La barra no reimplementa el uso: lo llama.**
      useConsumable(game, h.item, () => {
        redraw();
        pintarBarraDeConsumibles(game, redraw);
      });
    });
  });

  barra.querySelectorAll('[data-quitar]').forEach(b => {
    b.addEventListener('click', (ev) => {
      // Sin esto el clic también llega al botón de usar y se gasta el item.
      ev.stopPropagation();
      game.asignarBarraConsumible?.(Number(b.getAttribute('data-quitar')), null);
      redraw();
    });
  });
}

function sellItem(game: any, item: any, redraw: () => void) {
  const qty = stackUnits(item);
  const total = game.getSellTotal?.(item.id)
    ?? Math.floor((game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0) * qty);

  // Sin pila no hay selector: el diálogo de antes, tal cual.
  if (qty <= 1) {
    showConfirmModal(
      `Vendes ${item.name}${qty > 1 ? ` ×${qty}` : ''} por ${formatNumber(total)} nanitas.`,
      () => confirmarVenta(game, item, undefined, redraw),
      { sublabel: 'Vender', confirmText: `+${formatNumber(total)} ◆` }
    );
    return;
  }

  showConfirmModal(
    `Tienes ${qty} × ${item.name}. Elige cuántas vender.`,
    (units) => confirmarVenta(game, item, units, redraw),
    {
      sublabel: 'Vender',
      confirmText: 'Vender',
      quantity: {
        max: qty,
        itemName: item.name,
        unitName: UNIDAD_SINGULAR[item.type] ?? 'unidad',
        amount: (n) => formatNumber(game.getSellTotal?.(item.id, n) ?? 0)
      }
    }
  );
}

/** Cierra el diálogo y cobra. Separado para que las dos rutas compartan el cobro. */
function confirmarVenta(game: any, item: any, units: number | undefined, redraw: () => void) {
  const res = game.sellItem(item.id, units);
  if (!res.ok) {
    sfx.error();
    showToast(res.msg || 'No se pudo vender.', 'error');
    return;
  }
  sfx.buy();
  const n = res.sold ?? 1;
  showToast(
    `Vendido${n > 1 ? ` ×${n}` : ''} por ${formatNumber(res.gained ?? 0)} ◆`,
    'success'
  );
  // Solo se deselecciona si la pila se ha ido entera: si quedan unidades, el
  // jugador sigue trabajando con el mismo item y quitarle la ficha debajo de las
  // manos es un salto sin motivo.
  if (!game.getState().warehouse.some((w: any) => w.id === item.id)) {
    ui.selectedId = null;
  }
  redraw();
}
