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
import { showConfirmModal } from '../utils/modal';
import { showCrateRoulette } from './crateRoulette';
import { showCrateSummary, maximoDeApertura } from './crateSummary';
import { showSintonizacion } from './sintonizacion';
import { sfx } from '../utils/audio';
import { rarityClass, raritySlug, RARITY_RANK } from './crateLoot';
import { AFFIX_BY_ID, collectorMaxLevel, estrellasDe, nivelMaximoDeCompanio, costeDeNivelDeCompanio } from '../data/crafting';
import { valuationBreakdown } from '../data/valuation';
import { CRISTAL_NOMBRE } from '../data/items';
import { MAX_CRATE_TIER, type CrateType } from '../data/store';

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

// Estado de la pantalla. Sobrevive a los re-render.
const ui = {
  selectedId: null as string | null,
  filter: 'all' as string,
  sort: 'default' as string,
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
        <span class="ring-${raritySlug(w.rarity)} w-8 h-8 rounded-lg grid place-items-center
                     ${rarityClass(w.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">
          ${ic(TYPE_ICON[w.type] ?? 'crate')}
        </span>
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
   * `data-cell` es el índice de celda, que aquí es "más allá de la última", y
   * `data-painted` es la posición REAL en la rejilla, con los huecos ya
   * intercalados. Las dos cosas se necesitan y no son la misma: soltar en una
   * celda vacía tiene que poner el item en la posición que el jugador señaló, y
   * esa posición solo la sabe el índice pintado. Antes, con un hueco por celda,
   * bastaba con "al final" y no hacia falta nada mas.
   */
  const emptyCell = (celda: number, pintado: number) => `
    <div class="inv-cell opacity-25" data-cell="${celda}" data-painted="${pintado}" data-empty="1" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('plus')}</span>
    </div>
  `;

  /**
   * Un hueco que ha dejado el jugador a propósito.
   *
   * Se ve igual que la capacidad libre a propósito: para el jugador es la misma
   * cosa —"aquí no hay nada y puedo soltar"—, y distinguirlo por el estilo
   * convertiría una diferencia que no le importa en un concepto más que
   * recordar. Lo que sí cambia es el marcado: un hueco lleva `data-gap` con el
   * id del item al que precede y NO lleva `data-cell`.
   *
   * POR QUÉ NO LLEVA `data-cell`. `data-cell` es el índice dentro de `celdas`, y
   * se usa para traducir lo que el jugador señala a un item. Un hueco no
   * representa ningún item, así que no puede llevar ese índice. Si lo llevara,
   * `closest('[data-cell]')` lo encontraría como si fuera una celda real y el
   * arrastre traduciría la señalada a un item que no existe —que es exactamente
   * el desfase de una celda que ya se corrigió una vez, caminos distintos por el
   * mismo error de concepto: confundir "posición pintada" con "celda del
   * almacén".
   */
  const gapCell = (anclaId: string) => `
    <div class="inv-cell opacity-25" data-gap="${anclaId}" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('plus')}</span>
    </div>
  `;

  // Los huecos del jugador. Solo existen en la vista sin filtro y con el orden
  // del jugador: un hueco dice "aquí no hay nada" en una disposición concreta, y
  // esa disposición deja de ser cierta en cuanto se filtra o se ordena por valor.
  // Pintarlos ahi seria una mentira.
  const gaps = visibleGaps(game, state);

  // Cuántas celdas se pintan. Es el TABLERO: el jugador ve estas celdas y puede
  // soltar en cualquiera, ocupada o no. Vive en una función porque el arrastre
  // necesita el MISMO número: si el pintado y el destino calcularan distinto
  // total, un item podría acabar empujado fuera de la rejilla y desaparecer de
  // la vista sin que se hubiera vendido.
  const totalCells = totalCeldasPintadas(celdas.length, capacity);
  const cells: string[] = [];
  let pintados = 0;
  for (let i = 0; i < celdas.length; i++) {
    // Las celdas de hueco van justas antes de su ancla, tantas como tenga.
    const cuantas = gaps.get(celdas[i].item.id) ?? 0;
    for (let h = 0; h < cuantas; h++) { cells.push(gapCell(celdas[i].item.id)); pintados++; }
    cells.push(cell(celdas[i], i));
    pintados++;
  }
  // La cola libre se reparte DESPUÉS de intercalar los huecos del jugador: si se
  // contara antes, meter un hueco acabaria empujando fuera una celda de
  // capacidad y el almacén encogería solo por acomodar cosas.
  for (let n = 0; pintados < totalCells; n++, pintados++) {
    cells.push(emptyCell(celdas.length + n, pintados));
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
          ${([
            { id: 'all', label: 'Todo' },
            { id: 'collector', label: 'Recolectores' },
            { id: 'companion', label: 'Compañeros' },
            { id: 'otros', label: 'Otros' }
          ]).map(f => `
            <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition
                           ${ui.filter === f.id ? 'accent-bg text-slate-950 font-bold' : 'btn-ghost text-[var(--text-muted)]'}"
                    data-filter="${f.id}">${f.label}</button>
          `).join('')}
          <select id="wh-sort" aria-label="Ordenar"
            class="ml-auto h-10 px-2 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer">
            <option value="default" ${ui.sort === 'default' ? 'selected' : ''}>Mi orden</option>
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
        </div>

        ${ui.multisel ? multiSelBar(game) : ''}

        <div class="inv-grid mb-2" id="inv-grid">${cells.join('')}</div>

        <p class="text-[9px] text-[var(--text-muted)] text-center leading-relaxed mt-3">
          Arrastra una celda sobre otra para reordenar. Toca para ver detalles.
        </p>
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
  const celdas = visibleStacksFor(game, state, ui.filter, ui.sort);
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

        ${isCollector || isCompanion ? loreLine(item, state) : ''}

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
          ` : ''}


          ${item.type === 'consumable' ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="use">Usar</button>
          ` : ''}

          ${isCollector ? `
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="upgrade" ${isEquipped ? '' : 'disabled style="opacity:.4"'}
                    title="${isEquipped ? '' : 'Equípala primero'}">
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
function esEquipado(w: any, state: any): boolean {
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
  // Un solo conjunto de manejadores de puntero para toda la rejilla. Cada
  // celda recibe listeners nuevos en cada re-render; si se cumularan, un
  // arrastre dispararía N veces. Se limpian antes de volver a ligar.
  const grid = root.querySelector('#inv-grid') as HTMLElement | null;
  if (grid) setupDragAndDrop(grid, game, redraw, marcarCelda);

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
        if (item.id !== game.getState().equippedCollectorId) {
          showToast('Equipa el recolector primero.', 'info');
          return;
        }
        // El selector de cristal vive en la vista y no en el game loop porque
        // elegir cristal es una decisión de interfaz. El coste, la probabilidad
        // y el consumo los calcula el juego.
        showSintonizacion(game, redraw);
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
        const celdas = visibleStacksFor(game, game.getState(), ui.filter, ui.sort);
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
//  Arrastre con Pointer Events
// ==========================================================================
function setupDragAndDrop(
  grid: HTMLElement,
  game: any,
  redraw: () => void,
  marcarCelda: (id: string) => void
) {
  let dragId: string | null = null;
  let fromIndex = -1;
  let ghost: HTMLElement | null = null;
  let activePointer: number | null = null;
  let startX = 0;
  let startY = 0;
  // Umbral en píxeles: por debajo de esto es un toque, no un arrastre. Sin
  // él, cada toque en móvil movía un píxel y seleccionaba otra celda.
  const THRESHOLD = 8;

  const cleanupGhost = () => {
    ghost?.remove();
    ghost = null;
  };

  grid.addEventListener('pointerdown', (e) => {
    const cell = (e.target as HTMLElement).closest('[data-cell]') as HTMLElement | null;
    if (!cell || (e.target as HTMLElement).closest('select, button[data-act]')) return;
    if (activePointer !== null) return; // ya hay un dedo en pantalla

    const id = cell.dataset.id;
    if (!id) return;

    // **EN SELECCIÓN MÚLTIPLE NO SE ARRASTRA NADA, Y NO ES UNA DECISIÓN DE ESTILO.**
    // Los dos gestos son incompatibles sobre la misma celda: si el dedo se mueve ocho
    // píxeles —que en un móvil es un temblor normal— el gesto pasa de "marcar" a
    // "reordenar", y el jugador ha movido sin querer algo que creía haber marcado.
    // Apagar el arrastre entero mientras el modo está encendido hace que el gesto sea
    // inequívoco: aquí un toque marca y nada más.
    if (ui.multisel) {
      // Se registra igualmente el puntero para que `finish()` sepa que este toque ha
      // empezado aquí y no venga de un arrastre anterior.
      activePointer = e.pointerId;
      dragId = id;
      fromIndex = Number(cell.dataset.cell);
      startX = e.clientX;
      startY = e.clientY;
      return;
    }

    activePointer = e.pointerId;
    dragId = id;
    fromIndex = Number(cell.dataset.cell);
    startX = e.clientX;
    startY = e.clientY;
    cell.dataset.pendingDrag = '1';
  });

  grid.addEventListener('pointermove', (e) => {
    if (activePointer !== e.pointerId || !dragId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!ghost && Math.hypot(dx, dy) < THRESHOLD) return; // todavía es un toque

    const cell = grid.querySelector(`[data-cell="${fromIndex}"]`) as HTMLElement | null;
    if (!cell) return;

    if (!ghost) {
      sfx.pick();
      cell.classList.add('is-dragging');
      delete cell.dataset.pendingDrag;
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.style.background = 'color-mix(in srgb, var(--bg-app) 88%, transparent)';
      ghost.style.border = '1px solid var(--accent)';
      ghost.innerHTML = cell.innerHTML;
      document.body.appendChild(ghost);
      // `setPointerCapture` en el elemento que recibió el pointerdown: sin
      // esto, en móvil el dedo se sale de la celda a los pocos píxeles y el
      // navegador cancela el arrastre.
      cell.setPointerCapture?.(e.pointerId);
    }

    e.preventDefault();
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;

    // Resaltar lo que hay bajo el dedo. Se resaltan también los huecos del
    // jugador: son destinos válidos, y sin este resaltado no hay forma de saber
    // que el arrastre va a funcionar. Un hueco lleva `data-gap` y no `data-cell`,
    // así que los dos selectores son necesarios y no se solapan.
    const under = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const over = (under?.closest('[data-cell],[data-gap]') ?? null) as HTMLElement | null;
    grid.querySelectorAll('.is-over').forEach(el => el.classList.remove('is-over'));
    // Lo único que no se resalta es el item que se esta arrastrando: soltarlo
    // encima de si mismo no mueve nada. Los huecos SI se resaltan, y antes no:
    // esta condicion tenia `&& over.dataset.gap === undefined`, que excluia
    // exactamente el destino que el comentario de arriba dice que hay que
    // resaltar. El drop funcionaba (el `pointerup` si resuelve `data-gap`); lo que
    // faltaba era la senal visual, y sin ella arrastrar a un hueco se lee como
    // un arrastre que no va a hacer nada.
    if (over && over.dataset.cell !== String(fromIndex)) {
      over.classList.add('is-over');
    }
  });

  const finish = (e: PointerEvent) => {
    if (activePointer !== e.pointerId) return;
    activePointer = null;

    const wasDragging = !!ghost;
    cleanupGhost();
    grid.querySelectorAll('.is-over, .is-dragging').forEach(el => el.classList.remove('is-over', 'is-dragging'));

    if (!dragId) return;
    const draggedId = dragId;
    dragId = null;
    const src = fromIndex;
    fromIndex = -1;

    if (!wasDragging) {
      // Toque simple. **QUÉ HACE DEPENDE DEL MODO, Y NO ES LA MISMA COSA.**
      //
      // Con la selección múltiple encendida, un toque marca para vender y **no abre la
      // ficha**: si abrió las dos cosas, el jugador no podría ni leer un item ni quitar
      // la marca sin tener que apagar el modo, que es justo lo que se pidió al encenderlo.
      if (ui.multisel) {
        marcarCelda(draggedId);
        return;
      }
      // Toque simple: seleccionar
      sfx.pick();
      ui.selectedId = ui.selectedId === draggedId ? null : draggedId;
      redraw();
      return;
    }

    // Arrastre: soltar sobre cualquier celda, ocupada o vacía, o sobre un hueco
    // que el jugador dejó a propósito.
    //
    // Antes solo se aceptaba una celda CON item, porque el movimiento era un
    // intercambio: soltar en un hueco no tenía sentido. Ahora es una inserción,
    // así que cualquier posición es válida, incluidas las vacías del final.
    // Por eso el resaltado ya no excluye los huecos.
    //
    // Al mover, la ordenación vuelve a "Mi orden". Es a propósito: si se
    // mantuviera, el jugador volvería a ver el almacén ordenado por valor y el
    // item que acaba de colocar no estaría donde lo dejó, que es justo la
    // sensación de que el arrastre no sirve. Acomodar a mano ES elegir "Mi
    // orden"; a partir de ahí se vuelve a ordenar si quiere.
    //
    // Hay TRES destinos distintos y cada uno con su traducción. Un hueco es un
    // intercambio de item por hueco; una celda de capacidad libre del final es
    // "vete al final y deja libre donde estabas"; y una celda ocupada es solo
    // un traslado. Conflacionarlos es lo que hacía que soltar en un hueco no
    // moviera el item, solo lo recolocara, y el jugador lo leía como "aquí no se
    // puede mover nada".
    const under = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const hueco = (under?.closest('[data-gap]') ?? null) as HTMLElement | null;
    const target = (under?.closest('[data-cell]') ?? null) as HTMLElement | null;

    if (hueco?.dataset.gap) {
      // Hueco del jugador: el item entra y el hueco se va a donde estaba.
      if (moveIntoGap(game, draggedId, hueco.dataset.gap, ui.filter, ui.sort)) {
        sfx.place();
        ui.sort = 'default';
      } else {
        showToast('Ese hueco ya está donde toca.', 'info');
      }
    } else if (target?.dataset.empty) {
      // Celda VACÍA de capacidad. Es el gesto que el jugador pedía desde el
      // principio: soltar en un espacio vacío y que el item se quede AHI, no
      // "al final". Se le pasa la posición PINTADA, que es la que señala, y no
      // el índice de celda: con huecos intercalados no son lo mismo.
      const pintado = target.dataset.painted !== undefined
        ? Number(target.dataset.painted)
        : Number(target.dataset.cell);
      if (moveToFreeCell(game, draggedId, pintado, ui.filter, ui.sort)) {
        sfx.place();
        ui.sort = 'default';
      } else {
        showToast('Ya está en la última posición: no hay más sitio libre detrás.', 'info');
      }
    } else {
      const dst = target ? Number(target.dataset.cell) : -1;
      if (dst >= 0 && dst !== src) {
        // Se apunta el orden ANTES de mover. Un traslado que se acepta pero deja el
        // almacén igual es un caso real y frecuente —soltarlo donde ya estaba—, y
        // sin esto sonaba el "colocado" como si se hubiera movido algo. El jugador
        // veía una celda quieta, con su item igual, y se quedaba con la impresión
        // de que el arrastre estaba roto. Se le dice, en una línea, qué ha pasado.
        const antes = ((game.getState().warehouse as any[]) || []).map((w: any) => w.id).join(',');

        if (moveItem(game, draggedId, dst)) {
          const despues = ((game.getState().warehouse as any[]) || []).map((w: any) => w.id).join(',');
          if (despues === antes) {
            showToast('Ya estaba en ese sitio.', 'info');
          } else {
            sfx.place();
            ui.sort = 'default';
          }
        }
      }
    }
    redraw();
  };

  grid.addEventListener('pointerup', finish);
  grid.addEventListener('pointercancel', (e) => {
    cleanupGhost();
    grid.querySelectorAll('.is-over, .is-dragging').forEach(el => el.classList.remove('is-over', 'is-dragging'));
    if (activePointer === e.pointerId) activePointer = null;
    dragId = null;
    fromIndex = -1;
  });

  // Sin esto, un arrastre en móvil termina en un clic que abre la hoja.
  grid.addEventListener('click', (e) => e.stopPropagation());
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
  return visibleStacksFor(game, state, ui.filter, ui.sort);
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
  sort: string
): Array<{ item: any; ids: string[]; count: number }> {
  const wh = (state.warehouse || []) as any[];
  let items = wh.filter((w: any) => matchesFilter(w, filtro));

  if (sort === 'name') items = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  else if (sort === 'rarity') items = [...items].sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0));
  else if (sort === 'tier') items = [...items].sort((a, b) => (b.tier || 0) - (a.tier || 0));
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
 * Cuántas celdas tiene el tablero.
 *
 * El jugador ve estas celdas y puede soltar en CUALQUIERA, ocupada o no. Es un
 * tablero de verdad, no una lista: por eso una celda vacía es un sitio libre
 * válido y no un adorno. El mínimo de 12 es para que una mochila recién estrenada
 * no salga con tres celdas y un resto de sitio invisible, y el múltiplo de tres
 * es para que las filas cierren en la rejilla.
 *
 * Vive en una función y no en línea porque el arrastre necesita el MISMO número.
 * Si el pintado y el destino calcularan distinto, un item podría acabar
 * empujado fuera de la rejilla y desaparecer de la vista sin que se hubiera
 * vendido: lo peor que puede pasarle a un inventario.
 */
function totalCeldasPintadas(celdas: number, capacity: number): number {
  return Math.max(celdas, Math.min(capacity, Math.max(12, Math.ceil(capacity / 3) * 3)));
}

/**
 * Los huecos que se pintan en la rejilla ahora mismo.
 *
 * Un hueco guardado es un id de item, y solo se pinta si la vista es la del
 * jugador —sin filtro y con su orden—, porque un hueco describe una disposición
 * concreta. Con un filtro activo, la celda que ocupa un item es otra, y el hueco
 * caería en medio de una disposición que el jugador no ha elegido nunca.
 *
 * También se filtra por "el item existe": un hueco anclado a algo que ya no está
 * no se pinta, y esconderlo es preferible a romper el arrastre. El juego limpia
 * los que sobran, pero la vista no confía en que lo haya hecho.
 */
function visibleGaps(game: any, state: any): Map<string, number> {
  const porItem = new Map<string, number>();
  if (ui.filter !== 'all' || ui.sort !== 'default') return porItem;

  // Un hueco puede ocupar VARIAS celdas seguidas, y eso se cuenta por
  // repeticiones del id: ['b','b','c'] son dos celdas vacías antes de `b` y una
  // antes de `c`. Un array de ids con duplicados en vez de un array de objetos es
  // feo, pero evita cambiar el formato guardado por algo que no ha estado vivo lo
  // bastante para que importe, y la multiplicidad se normaliza en un solo sitio.
  const ids = (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) as string[];
  const vivos = new Set((state.warehouse || []).map((w: any) => w.id));
  for (const id of ids) {
    if (!vivos.has(id)) continue;
    porItem.set(id, (porItem.get(id) ?? 0) + 1);
  }
  return porItem;
}

/**
 * Solta el grupo de `draggedId` dentro del hueco que precede a `gapBeforeId`.
 *
 * Es un INTERCAMBIO, no una inserción: el item entra en el hueco y el hueco se
 * queda donde estaba el item. Es lo que hace que arrastrar a un hueco tenga
 * sentido —si solo rellenara el hueco, el item desapareciería de donde estaba y
 * el almacén se compactaría hacia arriba, que es justo lo contrario de lo que se
 * acaba de pedir— y es la razón de que el número de huecos no cambie al
 * arrastrar.
 *
 * Se deja justo delante de su ancla, asi que si el grupo ya estaba ahi no hay
 * movimiento posible: el gesto no significa nada y se rechaza con un motivo,
 * para que el jugador no se quede pensando que el arrastre se ha roto.
 */
export function moveIntoGap(
  game: any,
  draggedId: string,
  gapBeforeId: string,
  filtro: string,
  sort: string
): boolean {
  const state = game.getState();
  const celdas = visibleStacksFor(game, state, filtro, sort);
  const origen = celdas.findIndex(c => c.ids.includes(draggedId));
  if (origen < 0) return false;

  const grupo = celdas[origen];

  // El ancla del hueco es parte del propio grupo: es el item que se arrastra, y
  // "ponlo justo delante de sí mismo" no tiene solución.
  if (grupo.ids.includes(gapBeforeId)) return false;

  // Ya está justo delante del ancla: el hueco está pegado a su derecha, así que
  // moverlo no cambiaría nada.
  const celdaAncla = celdas.findIndex(c => c.ids.includes(gapBeforeId));
  if (celdaAncla === origen + 1) return false;

  if (!game.moveItems(grupo.ids, gapBeforeId, 'antes')) return false;

  // El hueco se va donde estaba el grupo. Se ancla al item que venía justo
  // detrás, porque es el que queda arriba del sitio que el grupo acaba de dejar.
  // Si no había nada detrás —el grupo era el último— el hueco cae en la cola
  // libre, que ya se pinta vacía sola y no necesita ancla.
  //
  // La cuenta se hace sobre la lista COMPLETA y no sobre un conjunto: un id
  // puede repetirse, y cada repetición es una celda de hueco. Un `Set` las
  // fundiría en una y el item se quedaría a la izquierda de donde se soltó.
  const siguiente = celdas[origen + 1];
  const actuales: string[] = (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) as string[];
  const huecos = actuales.filter(id => id !== gapBeforeId);
  if (siguiente) huecos.push(siguiente.item.id);
  game.setWarehouseGaps?.(huecos);

  return true;
}

/**
 * Suelta el grupo de `draggedId` en la celda VACIA `dstPainted`, que es la
 * posicion PINTADA que el jugador senalo -con los huecos ya intercalados, no el
 * indice de celda.
 *
 * LA REGLA, tal y como la entiende el jugador: **mientras queden celdas vacias,
 * cualquier objeto se puede mover a cualquiera de ellas.** Tambien el ultimo, que
 * es el caso que antes se rechazaba con "no hay mas sitio libre detras": hay
 * sitio, lo que no habia era forma de representarlo.
 *
 * COMO SE REPRESENTA. El array sigue siendo una lista empaquetada, asi que el
 * item solo tiene un sitio: el final. Para que se VEA en la celda 5 hay que poner
 * celdas de hueco por delante que lo empujen hasta ahi, y por eso un hueco puede
 * ocupar varias celdas seguidas.
 *
 * DONDE VAN LOS HUECOS: todos en el item que se mueve, y ninguno en los demas.
 * Es lo que hace que los otros items se queden donde estaban. Repartirlos desde
 * la izquierda -que es lo que habia antes- metia huecos en medio de un almacen
 * lleno y desplazaba cosas que el jugador no habia tocado: al soltar un item en
 * una celda vacia se movian tres mas.
 *
 * CUANTOS. Con `K` celdas, `E` celdas de hueco ya puestas delante del item y `H`
 * nuevas, su posicion pintada es `(K - 1) + E + H`. Para que caiga en
 * `dstPainted`: `H = dstPainted - (K - 1) - E`. El tope es `2K - 1` posiciones,
 * porque no puede haber mas celdas de hueco que celdas ocupadas: cada hueco
 * necesita un item al que anclarse. Mas alla de ese tope se recorta en vez de
 * inventar una posicion.
 */
export function moveToFreeCell(
  game: any,
  draggedId: string,
  dstPainted: number,
  filtro: string,
  sort: string
): boolean {
  const state = game.getState();
  const celdas = visibleStacksFor(game, state, filtro, sort);
  const origen = celdas.findIndex(c => c.ids.includes(draggedId));
  if (origen < 0) return false;
  const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;

  const K = celdas.length;
  if (!K) return false;

  // Los huecos que ya hay, contados por item. Cada repeticion es una celda.
  const yaPuestos = new Map<string, number>();
  for (const id of (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) as string[]) {
    yaPuestos.set(id, (yaPuestos.get(id) ?? 0) + 1);
  }
  const totalPuestos = [...yaPuestos.values()].reduce((a, b) => a + b, 0);

  // El item va al final del array. Si ya estaba, no hay nada que reordenar: solo
  // hacen falta huecos. Este es el caso que antes se rechazaba.
  const grupo = celdas[origen];
  const hayQueMover = origen !== K - 1;
  if (hayQueMover && !game.moveItems(grupo.ids, null, 'despues')) return false;

  // Huecos que hay por delante del item una vez movido: los de las celdas que
  // quedan antes que el. Los del propio item se cuentan aparte, porque son
  // justamente los que se van a anadir.
  const delante = celdas
    .filter((_, i) => i !== origen)
    .reduce((sum, c) => sum + (yaPuestos.get(c.item.id) ?? 0), 0);

  // Cuantas celdas de hueco hay que poner delante del item para que su posicion
  // pintada sea la senalada.
  //
  // NO HAY TOPE DE "UN HUECO POR CELDA". Eso era un limite inventado, y hacia
  // justo lo contrario de lo que el jugador pide: con 3 celdas y 18 libres, solo
  // dejaba mover el item hasta la celda 5. El limite real es el TABLERO: no se
  // pueden poner mas celdas de las que la rejilla dibuja, porque un item
  // empujado mas alla dejaria de pintarse y pareceria perdido sin haberse
  // vendido. Ese es el unico tope que importa, y sale del MISMO numero que usa
  // el pintado.
  const wanted = Math.max(0, dstPainted - (K - 1) - delante);
  const caben = Math.max(0, totalCeldasPintadas(K, capacity) - K - totalPuestos);
  const H = Math.min(wanted, caben);

  if (!hayQueMover && H === 0) return false; // ya esta donde se pidio

  const salida: string[] = [];
  for (const c of celdas) {
    if (c.ids.includes(draggedId)) {
      // Los huecos del item se ponen DE NUEVO, por eso se quitan antes los
      // viejos: si no, cada arrastre a una celda vacia dejaria el hueco que
      // tenia y no avanzaria nunca hacia la derecha.
      salida.push(...Array<string>(H).fill(c.item.id));
      continue;
    }
    salida.push(...Array<string>(yaPuestos.get(c.item.id) ?? 0).fill(c.item.id));
  }
  game.setWarehouseGaps?.(salida);

  return true;
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
function moveItem(game: any, draggedId: string, dstViewIndex: number): boolean {
  return moveItemTo(game, draggedId, dstViewIndex, ui.filter, ui.sort);
}

/**
 * El mismo traslado, con el filtro y el orden como parámetros en vez de leídos
 * del estado de pantalla. La rejilla que el jugador está viendo y la que usa el
 * arrastre tienen que ser LA MISMA: si divergen, el número de celda que señala no
 * es el sitio que se mueve. Se puede comprobar sin DOM, que es lo que hace este
 * banco de pruebas.
 */
export function moveItemTo(
  game: any,
  draggedId: string,
  dstViewIndex: number,
  filtro: string,
  sort: string
): boolean {
  if (dstViewIndex < 0) return false;

  const celdas = visibleStacksFor(game, game.getState(), filtro, sort);
  const origen = celdas.findIndex(c => c.ids.includes(draggedId));
  if (origen < 0) return false;

  const grupo = celdas[origen];
  if (dstViewIndex === origen) return false;

  // Las celdas del final están vacías. No hay item al que anclarse, y lo que el
  // jugador quiere decir con "suéltalo ahí" es "déjalo al final", que es
  // literalmente el hueco que está señalando. Sin ancla, el juego lo pone al final.
  const destino = dstViewIndex >= celdas.length ? null : celdas[dstViewIndex];

  // Soltado sobre su propia celda, o sobre una celda que forma parte del mismo
  // grupo de apilados: no hay nada que colocar delante.
  if (destino && grupo.ids.includes(destino.ids[0])) return false;

  // DE QUÉ LADO DEL ANCLA ENTRA EL BLOQUE. Es lo que hace que el item caiga en
  // la celda señalada y no una antes. El ancla es el item de la celda destino, y
  // si el bloque entra siempre por delante acaba SIEMPRE en la celda anterior a
  // la que el jugador señaló. Peor todavía: soltar sobre la celda vecina era un
  // no-op exacto, porque el bloque ya estaba por delante de ese vecino. El
  // jugador arrastraba, veía que no se movía nada, y concluía que no se puede
  // mover a un hueco.
  //
  // La dirección la decide quien llama, no el juego: solo el que ve la rejilla
  // sabe en qué celda estaba el bloque y en cuál se ha soltado.
  //
  // Con una pila de destino el ancla es el ÚLTIMO item del grupo, no el primero:
  // entrar por detrás de solo uno partiría la pila en dos mitades separadas, que
  // se seguirían pintando como una sola celda (los items iguales se aunan estén
  // donde estén) pero dejarían el almacén guardado con un orden hecho trozos.
  const irDespues = dstViewIndex > origen;
  const ancla = destino
    ? (irDespues ? destino.ids[destino.ids.length - 1] : destino.ids[0])
    : null;

  return game.moveItems(grupo.ids, ancla, irDespues ? 'despues' : 'antes');
}

/** ¿El item pasa el filtro activo de la rejilla? */
export function matchesFilter(w: any, filtro: string): boolean {
  if (filtro === 'all') return true;
  if (filtro === 'otros') return !['collector', 'companion'].includes(w.type);
  return w.type === filtro;
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

/** Aplica un consumible. Toda la lógica vive en el game loop. */
function useConsumable(game: any, item: any, redraw: () => void) {
  showConfirmModal(
    item.details || 'Aplicar el efecto de este consumible.',
    () => {
      const res = game.useConsumable(item.id);
      if (!res.ok) {
        sfx.error();
        showToast(res.msg || 'No se pudo usar.', 'error');
        return;
      }
      sfx.use();
      ui.selectedId = null;
      showToast(res.msg || `${item.name}: aplicado`, 'success');
      redraw();
    },
    { sublabel: item.name, confirmText: 'Usar' }
  );
}

/**
 * Vende un item. El precio, la cantidad y el borrado los decide el game loop.
 *
 * POR QUÉ SOLO PREGUNTA CUANDO HAY PILA. Con una sola unidad no hay nada que
 * decidir: preguntar "¿cuántas?" sobre un item único es un paso de más que
 * solo estorba. Y preguntar cuando la pila es de 1 dejaría un camino de "vender
 * todo" que nadie usaría nunca, porque el jugador que quiere venderlo todo
 * quiere precisamente eso y por eso es el valor por defecto del selector.
 *
 * El importe de cada cantidad lo PREGUNTA al game loop (`getSellTotal`) en vez
 * de multiplicar aquí: es la misma cuenta que hace `sellItem`, y por eso el
 * número que ve el jugador y el que se cobra no pueden separarse (R3).
 */
/*
 * BORRADA: `subirNivelDeCompanio()`.
 *
 * Era la mitad del botón del compañero que no iba a la hoja de sintonización: le
 * pintaba su propio `showConfirmModal` con dos frases y, al confirmar, un `showToast`
 * con el resultado. El recolector tenía la hoja, con la misma información y además
 * la ruleta, así que la misma acción se hacía de dos maneras distintas.
 *
 * **LO QUE SE LLEVÓ Y LO QUE NO.** El coste, el saldo, el texto del fallo y la
 * secuencia los tiene ahora `showSintonizacion()`, que es el mismo código para los dos
 * objetivos. Y se conserva lo que esta función tenía de bueno y la hoja no: **que el
 * compañero sube el ingreso del recolector**, que es un efecto distinto al del
 * recolector y no se puede decir con el mismo texto.
 *
 * Lo que no se ha repetido es el aviso de "si falla no baja de nivel", porque la hoja lo
 * dice siempre, en la misma línea, para los dos.
 */
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
