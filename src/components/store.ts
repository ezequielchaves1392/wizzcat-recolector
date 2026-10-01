// ==========================================================================
// Mercado · Tienda
//
// 1. PRECIO REAL. La tarjeta mostraba `item.cost` y el game loop cobraba lo
//    mismo. Al añadir la reducción de coste del árbol, si la tarjeta siguiera
//    mostrando el precio base el jugador pagaría más de lo que ve. Ahora
//    ambos salen del mismo número, calculado en un único sitio.
//
// 2. CATEGORÍAS CON ICONOS. Las etiquetas eran "📦 Cajas", "⚡ Recursos"... Los
//    emojis se veían distintos según el sistema operativo, así que se
//    sustituyeron por iconos SVG del mismo set que el resto del juego.
//
// 3. DESCRIPCIONES REALES. Antes una caja decía "Contiene recompensas básicas",
//    que no dice nada: el jugador no tenía forma de saber si le convenía.
//    Ahora cada producto tiene una descripción de dos líneas que explica qué
//    hace y qué trae, y al tocar la tarjeta se abre el detalle completo.
//
// 4. BOTÓN "COMPRAR" FIJO. Cuando no hay nanitas suficientes el botón decía
//    "Sin nanitas", y el texto cambiando impedía reconocerlo como la misma
//    acción. Ahora siempre dice "Comprar" y lo que cambia es su aspecto.
//
// 5. PESTAÑAS CON INDICADOR. La categoría activa se pintaba cambiando las
//    clases del botón, lo que además obligaba a re-renderizar la lista entera.
//    Ahora hay un indicador que se desplaza, y las pestañas no cambian de
//    ancho al activarse.
//
// 6. LA PESTAÑA ACTIVA AL COMIENZO. Siete pestañas no caben en un móvil, así
//    que elegir "Compañeros" dejaba el indicador resaltando un botón fuera de
//    pantalla. Ahora la tira se desplaza y deja la categoría activa en el
//    primer botón, que es donde el jugador está mirando.
// ==========================================================================

import { formatNumber } from '../utils/format';
import { ic, type IconName } from '../ui/icons';
import { pageShell, mountInto, wireNav, statStrip } from '../ui/pageShell';
import { TIER_SYSTEM } from '../data/tiers';
import { STORE_ITEMS, CRATE_TYPES, RANURA_POR_CARTA, COMPANION_SLOT_BUY } from '../data/store';
// Para las cuatro cartas de llave: el nivel sale de `STORE_KEY_TIER` y el
// nombre, la rareza y el texto de `KEY_DEFS`. Ver `rarityOf` y `descFor`.
import { STORE_KEY_TIER, KEY_DEFS, cratesOpenedBy } from '../data/items';
import { sfx } from '../utils/audio';
import { showToast } from '../utils/toast';
import { rarityClass, raritySlug } from './crateLoot';
import { countOccupiedSlots } from '../data/stacking';

interface Category {
  id: string;
  label: string;
  icon: string;
  items: string[];
}

const CATEGORIES: Category[] = [
  { id: 'llaves', label: 'Llaves', icon: 'key', items: ['keyT0', 'keyT1', 'keyT2', 'keyT3'] },
  { id: 'cajas', label: 'Cajas', icon: 'crate', items: ['commonCrate', 'rareCrate', 'epicCrate', 'legendaryCrate'] },
  { id: 'recursos', label: 'Recursos', icon: 'crystal', items: ['upgradeCrystal', 'warehouseSlot', 'backpackExpander'] },
  // F4 · Solo las tres tarjetas. `clickBuff` y `passiveBuff` se han retirado de la
  // lista: la categoría ya no puede nombrarlos porque no existen, y
  // `STORE_ITEMS` no los tiene, así que una carta ahí daría un error de
  // `undefined` al pintar.
{ id: 'cartas', label: 'Cartas', icon: 'card', items: ['afkCard', 'clickX2Card', 'clickX3Card'] },
  { id: 'forja', label: 'Forja', icon: 'flask', items: ['calibrationStone', 'stabilityNano'] },
  { id: 'mejoras', label: 'Mejoras', icon: 'layers', items: Object.keys(RANURA_POR_CARTA) },
  { id: 'companeros', label: 'Compañeros', icon: 'companion', items: Array.from({ length: 10 }, (_, i) => `companionCardT${i + 1}`) },
  { id: 'recolectores', label: 'Recolectores', icon: 'collector', items: Array.from({ length: 10 }, (_, i) => `collectorCardT${i + 1}`) }
];

/**
 * Descripciones de producto. El texto responde a las dos preguntas que el
 * jugador se hace al mirar una tarjeta: "¿qué me da?" y "¿me compensa?".
 */
const DESCRIPTIONS: Record<string, { what: string; detail: string }> = {
  commonCrate: {
    what: 'Caja básica con recursos de partida temprana.',
    detail: 'Puede dar nanitas, cristales, llaves, drones T1 o una ranura de almacén. Es la única caja cuyo contenido medio cubre su precio.'
  },
  rareCrate: {
    what: 'Caja de nivel medio: crystals, compañeros T3 y recolectores T4 sobrecargadas.',
    detail: 'Las recolectores sobrecargadas valen bastante más que una del mismo tier en la tienda. Suele salir rentable si necesitas material de forja.'
  },
  epicCrate: {
    what: 'Caja alta: compañeros T6, recolectores T6 y Piedras de Calibración.',
    detail: 'Puede incluir dos compañeros exclusivos que no se compran de ninguna otra forma, y es la mejor fuente de piedras de calibración.'
  },
  legendaryCrate: {
    what: 'La caja máxima: recolectores T8, Nanopartículas y tres exclusivos.',
    detail: 'El premio habitual son los compañeros Divinos que solo existen aquí. La Nanopartícula de Estabilidad sale casi siempre de esta caja.'
  },

  key: {
    what: 'Una llave. Se gasta una por cada caja que abras.',
    // POR QUÉ AQUÍ NO SE DICE CÓMO ESTÁ HECHA LA TIRADA. Antes decía "con el
    // botín ya decidido antes de girar", que era verdad y no era lo que había que
    // contar: es hablar como si la ruleta no sorteara nada, y el jugador leía que
    // el trompo es un adorno y que el premio ya estaba escrito. Lo que el jugador
    // vive es al revés de lo que dice la frase: él no sabe qué va a salir hasta
    // que la casilla se para. Ese es el trompo, y es lo único que esta tarjeta
    // tiene que contar.
    detail: 'Las cajas del almacén se aperturan aquí. Gastas la llave, la ruleta gira y te dice qué ha salido. Cada caja tiene su propia tabla de botín.'
  },
  upgradeCrystal: {
    what: 'Cristal para subir el nivel del recolector equipado.',
    detail: 'El nivel multiplica el daño del recolector y sube hasta 20 en las de tienda, o 35 en las crafteadas. El coste en cristales crece por nivel y el éxito baja.'
  },
  warehouseSlot: {
    what: 'Añade 5 ranuras permanentes al almacén.',
    detail: 'Las ranuras del árbol de pasivas se suman a estas. Ampliar es irreversible, pero es de las pocas compras que nunca sobran.'
  },
  backpackExpander: {
    what: 'Añade 1 ranura al almacén, de pago único.',
    detail: 'Cuesta lo mismo por ranura que la ampliación grande pero permite comprar solo lo que falta.'
  },

  afkCard: {
    what: 'Permite seguir cobrando con la ventana cerrada o en otra aplicación.',
    detail: 'El tiempo de la tarjeta se suma, hasta un máximo de 3 tarjetas a la vez. Cuanto más invertido tengas en compañeros activos, más rinde.'
  },
  clickBuff: {
    what: 'x2 al daño de click durante 30 minutos.',
    detail: 'Afecta al recolector, no al ingreso pasivo. Conviene usarlo cuando vas a dedicate a pulsar en vez de a mirar los números.'
  },
  passiveBuff: {
    what: 'x2 a todo el ingreso pasivo durante 1 hora.',
    detail: 'Multiplica a los compañeros activos, no al daño de click. Es la mejor carta si tu estilo es dejar que trabajen solos.'
  },
  clickX2Card: {
    what: 'x2 al click durante 30 segundos.',
    detail: 'Muy corta a propósito: para gastarla en el pico de una racha de clics, no para llevarla puesta.'
  },
  clickX3Card: {
    what: 'x3 al click durante 30 segundos.',
    detail: 'El doble de efecto que la x2 por cinco veces el precio. Solo sale rentable con muchos clics por segundo.'
  },

  calibrationStone: {
    what: 'Sube 12 puntos la probabilidad de la próxima fusión.',
    detail: 'Se usa en la Forja y se puede gastar más de una por intento, hasta 5. Cuantas más gastes en una tirada, más riesgo que asumes.'
  },
  stabilityNano: {
    what: 'Sube 8 puntos la probabilidad y garantiza un afijo extra.',
    detail: 'Es el único consumible que mejora el recolector resultante, no solo las probabilidades. Sale de la Caja Legendaria.'
  },

  companionSlot1: {
    what: 'Una ranura más de compañero activo.',
    detail: 'Los compañeros activos son los que generan ingreso pasivo. Con más ranuras puedes usar a los que tengas, pero también subirlos de tier.'
  },
  companionSlot2: {
    what: 'Abre hasta 3 ranuras de compañero de golpe.',
    detail: 'Sale mucho más barato por ranura que comprar la ranura suelta, pero solo tiene sentido si ya usas las 2 primeras.'
  }
};

/** Descripción de las tarjetas de tier, generada: cambia el número, no la idea. */
function tierDescription(kind: 'companion' | 'collector', tier: number): { what: string; detail: string } {
  const range = tierRange(tier);
  const r = tierRarity(tier);
  if (kind === 'companion') {
    return {
      what: `Compañero de tier ${tier} (${r}): entre +${range[0]} y +${range[1]} de ingreso por segundo.`,
      detail: 'Solo cuenta si lo equipas en una ranura activa. El nombre, el poder exacto y la rareza se sortean al comprarlo.'
    };
  }
  return {
    what: `Recolector de tier ${tier} (${r}): entre +${range[0]} y +${range[1]} de daño por click.`,
    detail: 'El daño y la rareza se sortean al comprarlo. Los tiers altos suben de precio por estilo, no por ser objetivamente mejores: el coste por punto de daño se mantiene plano en toda la curva.'
  };
}

/** Rango de poder de un tier, para la línea de detalle de las tarjetas. */
function tierRange(tier: number): [number, number] {
  return (TIER_SYSTEM.ranges as Record<number, [number, number]>)[tier] ?? [1, 5];
}

function tierRarity(tier: number): string {
  return (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier] ?? 'Común';
}

/** Estado de la pantalla. Sobrevive a los re-renders. */
const ui = {
  category: 'cajas',
  detail: null as string | null,
  /** Desplazamiento horizontal de la tira de pestañas antes del último render. */
  stripScroll: 0
};

/** Icono del producto según su clave. */
function iconFor(itemKey: string): IconName {
  if (itemKey.endsWith('Crate')) return 'crate';
  if (itemKey.startsWith('collectorCardT')) return 'collector';
  if (itemKey.startsWith('companionCardT')) return 'companion';
  const map: Record<string, IconName> = {
    keyT0: 'key', keyT1: 'key', keyT2: 'key', keyT3: 'key',
    upgradeCrystal: 'crystal', warehouseSlot: 'warehouse', backpackExpander: 'warehouse',
    // F4 · `clickBuff` y `passiveBuff` ya no tienen carta, así que ya no hay icono que
// inventarles. Si volvieran, volverían aquí.
afkCard: 'clock', clickX2Card: 'bolt', clickX3Card: 'bolt',
    calibrationStone: 'flask', stabilityNano: 'flask',
    // Las cartas de ranura salen de la tabla, no de una entrada por carta. Con una
  // entrada por carta, una ranura nueva nace sin icono y con el de la última.
  ...Object.fromEntries(Object.keys(RANURA_POR_CARTA).map(k => [k, 'layers']))
  };
  return map[itemKey] ?? 'store';
}

function rarityOf(itemKey: string): string | null {
  // La rareza de una llave sale de su definición, no de una tabla de aquí: si
  // se escribiera aparte, añadir una llave obligaría a acordarse de tocarla en
  // tres sitios y el olvido es silencioso.
  if (STORE_KEY_TIER[itemKey] !== undefined) return KEY_DEFS[STORE_KEY_TIER[itemKey]].rarity;
  if (itemKey.endsWith('Crate')) {
    return ({ commonCrate: 'Común', rareCrate: 'Raro', epicCrate: 'Épico', legendaryCrate: 'Legendario' } as Record<string, string>)[itemKey] ?? null;
  }
  if (itemKey.startsWith('companionCardT')) return tierRarity(parseInt(itemKey.slice(14)));
  if (itemKey.startsWith('collectorCardT')) return tierRarity(parseInt(itemKey.slice(11)));
  const map: Record<string, string> = {
    upgradeCrystal: 'Raro', warehouseSlot: 'Raro', backpackExpander: 'Raro',
    // F4 · Sin `clickBuff` ni `passiveBuff`: no hay carta, no hay rareza.
afkCard: 'Raro', clickX2Card: 'Raro', clickX3Card: 'Épico',
    calibrationStone: 'Raro', stabilityNano: 'Legendario',
    // La rareza de una ranura sale de su posición en la tabla: cuanto más cara, más
  // alta. Es una regla y por eso se calcula; escribirla a mano por carta era otra
  // cosa que hay que acordarse de tocar al añadir una.
  ...Object.fromEntries(COMPANION_SLOT_BUY.map((_, i) => [
    `companionSlot${i + 1}`,
    i >= 1 ? 'Legendario' : 'Épico'
  ]))
  };
  return map[itemKey] ?? null;
}

function descFor(itemKey: string): { what: string; detail: string } {
  if (DESCRIPTIONS[itemKey]) return DESCRIPTIONS[itemKey];
  // Las llaves tampoco tienen texto aquí, y por el mismo motivo que la rareza:
  // el `details` de `KEY_DEFS` ya lo dice con el mismo criterio que la regla que
  // decide si la abre. Escribirlo otra vez es la forma de volver a mentir.
  if (STORE_KEY_TIER[itemKey] !== undefined) {
    const def = KEY_DEFS[STORE_KEY_TIER[itemKey]];
    return { what: `Abre ${cratesOpenedBy(def.tier).map(c => CRATE_TYPES[c].name).join(', ')}.`, detail: `Las cajas sueltan llaves de su propio nivel, así que se repone sola.` };
  }
  if (itemKey.startsWith('companionCardT')) return tierDescription('companion', parseInt(itemKey.slice(14)));
  if (itemKey.startsWith('collectorCardT')) return tierDescription('collector', parseInt(itemKey.slice(11)));
  return { what: '', detail: '' };
}

/** Estado del producto dentro de la partida. */
function statusOf(itemKey: string, state: any, game: any): { disabled: boolean; reason: string | null } {
  const effSlots = game.getCompanionSlots?.() ?? state.maxCompanionSlots;
  // F7/F11 · El tope de esta carta sale de la fila de la tabla, no de un `if` por
  // carta. Con tres cartas y tres `if` escritos a mano, añadir la cuarta era
  // acordarse de los tres sitios; con la tabla es una fila.
  const ranura = RANURA_POR_CARTA[itemKey];
  if (ranura && effSlots >= ranura.da) return { disabled: true, reason: 'Comprado' };
  if (itemKey === 'backpackExpander' && state.warehouseCapacity >= 50) return { disabled: true, reason: 'Al máximo' };
  // "¿Cabe esta compra?" lo contesta el game loop, que es quien cobra. Preguntar
  // aquí solo por el fullness del almacén apagaba el botón de una caja que sí
  // cabía en la pila de cajas que ya había, y al revés: dejaba encendido lo
  // que `buyStoreItem` iba a rechazar. Una ranura es una pila, no una unidad.
  if (game.canBuyStoreItem?.(itemKey) === false) return { disabled: true, reason: 'Almacén lleno' };
  return { disabled: false, reason: null };
}

export function renderStoreTab(
  container: HTMLElement,
  game: any,
  onBack: () => void,
  go?: (r: any) => void
) {
  const state = game.getState();
  const discount = state.bonus?.costReduction || 0;
  const cost = (base: number) => Math.floor(base * (1 - discount));

  const category = CATEGORIES.find(c => c.id === ui.category) ?? CATEGORIES[0];

  const card = (itemKey: string) => {
    const item = (STORE_ITEMS as Record<string, any>)[itemKey];
    if (!item) return '';
    const price = cost(item.cost);
    const canAfford = state.nanites >= price;
    const { disabled, reason } = statusOf(itemKey, state, game);
    // Bloqueado = no se puede comprar por ESTADO, no por falta de dinero.
    // Los dos casos se muestran distintos: el primero explica el motivo, el
    // segundo solo se atenúa.
    const blocked = disabled || !canAfford;
    const rarity = rarityOf(itemKey);
    const isCheap = discount > 0 && Math.floor(item.cost) > price;

    // Nota contextual: el número que cambia con la partida
    let note = '';
    if (itemKey === 'backpackExpander') {
      note = `Capacidad real: ${countOccupiedSlots(state.warehouse)}/${game.getCapacity?.() ?? state.warehouseCapacity}`;
    } else if (itemKey === 'warehouseSlot') {
      note = `Ranuras de tienda: ${state.warehouseCapacity}`;
    } else if (itemKey === 'afkCard') {
      note = `${Math.round((game.getAfkDurationMs?.() ?? 600_000) / 60_000)} min cada una · acumulable ×3`;
    } else if (itemKey === 'key') {
      note = `Tienes ${state.keys}`;
    } else if (itemKey === 'upgradeCrystal') {
      note = `Tienes ${state.upgradeCrystals}`;
    } else if (RANURA_POR_CARTA[itemKey]) {
      // F7/F11 · CUÁNTAS RANURAS ABRE ESTA CARTA, EN EL NÚMERO.
      //
      // El texto no dice "+N": dice cuántas quedan por abrir, restando las que ya
      // tienes. Esa es la cifra que el jugador está decidiendo, y es la que no
      // puede mentir: sale de la misma tabla que el `if` que desactiva el botón y
      // del mismo número que el motor escribe. Antes ponía "+3" escrito a mano
      // cuando el motor daba 5.
      //
      // Y sale del total EFECTIVO, que incluye el árbol: si el árbol ya te dio la
      // ranura 3 y te queda la 4, la tarjeta tiene que decir 1 y no 2, o el
      // jugador paga por algo que ya tiene.
      const compra = RANURA_POR_CARTA[itemKey];
      const actual = game.getCompanionSlots?.() ?? state.maxCompanionSlots;
      const anade = Math.max(0, compra.da - actual);
      const detalle = anade === 1
        ? 'Abre 1 ranura más de escuadrón'
        : `Abre ${anade} ranuras más de escuadrón`;
      note = `${detalle} · Tienes ${actual}`;
    } else if (itemKey === 'calibrationStone' || itemKey === 'stabilityNano') {
      const inStore = (state.warehouse as any[]).find(w => w.buffId === (itemKey === 'calibrationStone' ? 'calibrationStone' : 'stabilityNano'));
      note = `En almacén: ${inStore?.stackCount || 0}`;
    }

    return `
      <button class="card-glass border rounded-xl p-3 flex flex-col gap-2 text-left cursor-pointer
                     transition active:scale-[0.98] hover:border-[var(--accent)] ${disabled ? 'opacity-60' : ''}"
              data-info="${itemKey}" aria-label="Ver detalles de ${item.label}">
        <div class="flex items-start gap-2.5">
          <span class="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0
                       ${rarity ? 'ring-' + raritySlug(rarity) : ''}
                       ${rarity ? rarityClass(rarity) : ''} [&>span>svg]:w-4 [&>span>svg]:h-4">
            ${ic(iconFor(itemKey))}
          </span>
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-bold text-[var(--text-main)] leading-tight">${item.label}</div>
            ${note ? `<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5 leading-snug">${note}</div>` : ''}
          </div>
          <span class="text-[var(--text-muted)] opacity-40 flex-shrink-0 -mr-1 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">
            ${ic('info')}
          </span>
        </div>

        <div class="flex items-end justify-between gap-2 mt-auto pt-1">
          <div>
            <div class="font-['Orbitron'] font-bold text-[14px] accent-text tabular leading-none flex items-baseline gap-1">
              ${formatNumber(price)}
              <span class="accent-text text-[10px] not-italic" aria-hidden="true">◆</span>
            </div>
            ${isCheap
              ? `<div class="text-[9px] font-mono text-emerald-400 line-through leading-none mt-0.5">${formatNumber(item.cost)}</div>`
              : `<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">nanitas</div>`}
          </div>
          <!--
            El estado bloqueado viaja en el atributo data-blocked, no en una
            clase. Antes el manejador sniffaba className, así que cambiar el
            estilo de un botón rompía en silencio la lógica de la compra: se
            veía gris pero dejaba comprar.

            El precio también va en el DOM (data-price) y el aspecto sale de
            .store-buy en CSS: la hoja se refresca sin re-pintarse y asi el
            refresco tiene con comparar precio contra saldo.
          -->
          <span class="store-buy text-[10px] font-mono px-2.5 h-8 rounded-lg
                       grid place-items-center flex-shrink-0"
                data-buy="${itemKey}" data-price="${price}"
                ${blocked ? 'data-blocked="1"' : ''}
                ${canAfford && !disabled ? 'data-afford="1"' : ''}
                role="button" tabindex="0"
                aria-label="${item.label}: ${reason ?? (canAfford ? 'Comprar' : 'No alcanza')}">
            ${reason ?? 'Comprar'}
          </span>
        </div>
      </button>
    `;
  };

  // --- Hoja de detalle ---
  const detail = ui.detail ? detailSheet(ui.detail, cost, state, game) : '';

  const body = `
    ${statStrip([
      { label: 'Nanitas', value: formatNumber(state.nanites), glyph: '◆', valueId: 'store-nanites' },
      { label: 'Almacén', value: `${countOccupiedSlots(state.warehouse)}/${game.getCapacity?.() ?? state.warehouseCapacity}` },
      { label: 'Descuento', value: discount > 0 ? `−${Math.round(discount * 100)}%` : '—', tone: discount > 0 ? 'text-emerald-400' : undefined },
      { label: 'Llaves', value: String(state.keys) }
    ])}

    <div id="cat-tabs" class="relative flex gap-1 mb-3 overflow-x-auto pb-1" role="tablist">
      <span id="cat-pill"
            class="absolute top-0 h-10 rounded-lg accent-bg pointer-events-none z-0"
            style="transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), width 260ms cubic-bezier(0.16, 1, 0.3, 1); will-change: transform"></span>
      ${CATEGORIES.map(c => `
        <button class="relative z-10 px-3 h-10 rounded-lg text-[10px] font-mono flex-shrink-0
                       transition-colors duration-200 cursor-pointer"
                data-cat="${c.id}" role="tab"
                aria-selected="${c.id === ui.category}"
                style="${c.id === ui.category ? 'color:#06121f;font-weight:700' : 'color:var(--text-muted)'}">
          <span class="inline-flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(c.icon as IconName)}</span>
            ${c.label}
          </span>
        </button>
      `).join('')}
    </div>

    ${category.id === 'forja' && !((state.nodeLevels?.blueprint) > 0) ? `
      <div class="rounded-xl border p-3 mb-2.5 text-[10px] leading-relaxed"
           style="border-color: color-mix(in srgb, #f59e0b 40%, transparent);
                  background: color-mix(in srgb, #f59e0b 8%, transparent)">
        Puedes comprar estas piedras antes de desbloquear la forja, pero no
        sirven de nada hasta que tengas el nodo <span class="text-amber-400">Planos Viejos</span>.
      </div>
    ` : ''}

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      ${category.items.map(card).join('')}
    </div>

    ${detail}
  `;

  const root = mountInto(container, pageShell({
    title: 'Mercado',
    subtitle: discount > 0 ? `Descuento del árbol aplicado: −${Math.round(discount * 100)}%` : 'Todo se paga con nanitas',
    icon: 'store',
    onBack,
    state,
    hideNanites: true
  }, body));

  wireNav(root, { back: onBack, go });

  // El indicador se posiciona al montar, una vez que el navegador conoce los
  // anchos. Antes que nada se deja fuera de pantalla: si se pinta en 0 y luego
  // se mide, se ve un destello en la esquina.
  positionPill(root, ui.category);
  scrollStripToStart(root, ui.category);

  root.querySelectorAll<HTMLElement>('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.cat === ui.category) return;
      sfx.nav();
      ui.category = btn.dataset.cat!;
      ui.detail = null;
      // La tira se reconstruye en cada render y nace en scroll 0. Se guarda
      // dónde estaba para que el deslizamiento al inicio se vea como una
      // continuación y no como un salto de vuelta al origen.
      const strip = root.querySelector('#cat-tabs') as HTMLElement | null;
      ui.stripScroll = strip?.scrollLeft ?? 0;
      renderStoreTab(container, game, onBack, go);
    });
  });

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // El botón "Comprar" vive DENTRO de la tarjeta. Se detiene la propagación
    // para que comprar no abra a la vez la hoja de detalle.
    const buy = target.closest('[data-buy]') as HTMLElement | null;
    if (buy) {
      e.stopPropagation();
      const key = buy.dataset.buy!;
      if (buy.dataset.blocked) {
        sfx.error();
        const st = statusOf(key, game.getState(), game);
        showToast(st.reason ?? 'No te alcanza', 'info');
        return;
      }
      const bought = game.buyStoreItem(key as any);
      if (bought === false) {
        sfx.error();
        showToast('No se pudo completar la compra.', 'error');
        return;
      }
      sfx.buy();
      showToast('Comprado', 'success');
      renderStoreTab(container, game, onBack, go);
      return;
    }

    const info = target.closest('[data-info]') as HTMLElement | null;
    if (info) {
      sfx.pick();
      ui.detail = ui.detail === info.dataset.info ? null : info.dataset.info!;
      renderStoreTab(container, game, onBack, go);
      return;
    }

    if ((target as HTMLElement).closest('[data-detail-close]')) {
      sfx.pick();
      ui.detail = null;
      renderStoreTab(container, game, onBack, go);
    }
  });

  startAffordabilityWatch(root, game);
}

/** Mueve la píldora de la pestaña activa hasta su botón. */
function positionPill(root: HTMLElement, activeId: string) {  const pill = root.querySelector('#cat-pill') as HTMLElement | null;
  const btn = root.querySelector(`[data-cat="${activeId}"]`) as HTMLElement | null;
  if (!pill || !btn) return;
  // Se mide en el siguiente frame, cuando el navegador ya calculó el layout.
  requestAnimationFrame(() => {
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  });
  // Respaldo para pestañas ocultas, donde rAF no se dispara
  window.setTimeout(() => {
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, 60);
}

/**
 * Lleva la pestaña activa al comienzo de la tira.
 *
 * Siete categorías no caben en un móvil: "Compañeros" y "Recolectores" quedan
 * fuera de la vista. Antes la píldora se desplazaba hasta ellas y el jugador
 * veía moverse un resaltado hacia un botón que no tenía delante, sin ninguna
 * pista de qué categoría había abierto.
 *
 * El detalle de continuidad importa: `renderStoreTab` reconstruye la tira en
 * cada cambio de categoría y el nodo nuevo nace con `scrollLeft` en 0. Si solo
 * se pidiese el deslizamiento suave, la tira pegaría un tirón al principio y
 * luego se movería, lo que se lee como un fallo. Por eso primero se restaura
 * la posición anterior de forma instantánea y desde ahí se deja que el navegador
 * anime hasta el origen.
 *
 * Si la tira no desborda (pantalla ancha) no hay nada que desplazar y se
 * respeta la posición actual en lugar de forzar un `scrollTo` inútil.
 */
function scrollStripToStart(root: HTMLElement, activeId: string) {
  const strip = root.querySelector('#cat-tabs') as HTMLElement | null;
  const btn = root.querySelector(`[data-cat="${activeId}"]`) as HTMLElement | null;
  if (!strip || !btn) return;
  if (strip.scrollWidth <= strip.clientWidth) return;
  strip.scrollLeft = ui.stripScroll;
  // `offsetLeft` se mide contra la tira, no contra la ventana, así que sigue
  // siendo la posición del botón dentro del contenido aunque esté desplazado.
  strip.scrollTo({ left: btn.offsetLeft, behavior: 'smooth' });
}

/** Hoja de detalle de un producto. */
function detailSheet(
  itemKey: string,
  cost: (base: number) => number,
  state: any,
  game: any
): string {
  const item = (STORE_ITEMS as Record<string, any>)[itemKey];
  if (!item) return '';
  const price = cost(item.cost);
  const canAfford = state.nanites >= price;
  const { disabled, reason } = statusOf(itemKey, state, game);
  const rarity = rarityOf(itemKey);
  const d = descFor(itemKey);

  return `
    <div class="sheet-overlay z-[60]">
      <div class="absolute inset-0 bg-black/55 pointer-events-auto" data-detail-close></div>
      <div class="sheet-panel card-glass-elevated animate-rise-in">
        <div class="flex items-start gap-3 mb-3">
          <span class="w-12 h-12 rounded-xl grid place-items-center flex-shrink-0
                       ${rarity ? 'ring-' + raritySlug(rarity) : ''}
                       ${rarity ? rarityClass(rarity) : ''} [&>span>svg]:w-6 [&>span>svg]:h-6">
            ${ic(iconFor(itemKey))}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight">
              ${item.label}
            </h3>
            ${rarity ? `<div class="text-[10px] font-mono mt-0.5 ${rarityClass(rarity)}">${rarity}</div>` : ''}
          </div>
          <button class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  data-detail-close aria-label="Cerrar">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
          </button>
        </div>

        <p class="text-[12px] text-[var(--text-main)] leading-relaxed mb-1.5">${d.what}</p>
        <p class="text-[11px] text-[var(--text-muted)] leading-relaxed mb-3">${d.detail}</p>

        <div class="rounded-xl border border-[var(--border-color)] p-3 mb-3 flex items-center justify-between gap-3"
             style="background: color-mix(in srgb, var(--accent) 8%, transparent)">
          <div>
            <div class="label-caps mb-0.5">Precio</div>
            <div class="font-['Orbitron'] font-bold text-lg accent-text tabular flex items-baseline gap-1">
              ${formatNumber(price)}<span class="text-[12px] not-italic" aria-hidden="true">◆</span>
            </div>
          </div>
          <div class="text-right">
            <div class="label-caps mb-0.5">Tienes</div>
            <div class="font-mono text-[12px] text-[var(--text-main)] tabular">
              <span id="store-nanites-sheet">${formatNumber(state.nanites)}</span> ◆
            </div>
          </div>
        </div>

        <button class="store-buy w-full h-12 rounded-xl font-['Orbitron'] font-bold text-[12px] cursor-pointer
                       ${disabled ? 'opacity-50' : ''}"
                data-buy="${itemKey}" data-price="${price}"
                ${canAfford && !disabled ? 'data-afford="1"' : ''}
                ${disabled ? 'disabled' : ''}>
          ${reason ?? 'Comprar'}
        </button>
      </div>
    </div>
  `;
}

// ==========================================================================
//  Refresco de qué se puede comprar
//
//  El mercado se re-pintaba al cambiar de pestaña, al comprar y al abrir o
//  cerrar un detalle. Nunca por tiempo. Y como el saldo decide qué botón está
//  encendido, el efecto era un bloqueo sin explicación: un jugador que se
//  queda esperando a que el ingreso pasivo cubra el precio no podía comprar
//  nunca, porque la página solo se actualizaba al navegar fuera y volver.
//
//  Aquí solo se tocan los atributos data-afford y data-blocked de los botones
//  que ya están en el DOM. No se re-pinta la página, y por eso no se rompen la
//  animación de la pila de pestañas, la hoja de detalle ni el scroll.
// ==========================================================================

/** Cronómetro del refresco. Vive fuera para no dejar ninguno detrás. */
let affordabilityTimer: number | null = null;

/** Periodo del refresco. 400 ms es imperceptible y no satura el DOM. */
const AFFORDABILITY_MS = 400;

/**
 * Pone al día el estado de todos los botones de compra de la hoja.
 *
 * El precio se lee de `data-price` y no se recalcula: el descuento del árbol no
 * cambia entre re-renders, así que el precio del DOM es el bueno, y recalcularlo
 * aquí metería una segunda copia de la regla de descuento en el archivo.
 */
function refreshAffordability(root: HTMLElement, game: any) {
  const state = game.getState();

  root.querySelectorAll<HTMLElement>('[data-buy]').forEach(btn => {
    const key = btn.dataset.buy;
    const price = Number(btn.dataset.price);
    // Sin data-price no hay nada que comparar: se deja como está.
    if (!key || !Number.isFinite(price)) return;

    const { disabled } = statusOf(key, state, game);
    const canAfford = state.nanites >= price;

    if (disabled || !canAfford) btn.setAttribute('data-blocked', '1');
    else btn.removeAttribute('data-blocked');

    if (canAfford && !disabled) btn.setAttribute('data-afford', '1');
    else btn.removeAttribute('data-afford');
  });

  // El saldo aparece dos veces en el mercado: en la franja de arriba y en la
  // hoja de detalle. Las dos se actualizan aquí.
  const value = formatNumber(state.nanites || 0);
  for (const id of ['#store-nanites', '#store-nanites-sheet']) {
    const el = root.querySelector(id);
    if (el) el.textContent = value;
  }
}

/**
 * Arranca el refresco y lo mantiene vivo mientras la hoja esté en pantalla.
 *
 * El temporizador se suicida solo: `root` se recrea en cada re-render y se
 * desconecta del documento al salir del mercado, así que basta con mirar
 * `isConnected`. Es lo único que sobrevive al problema de que `unmount()` no
 * llega a llamarse nunca en este proyecto.
 */
function startAffordabilityWatch(root: HTMLElement, game: any) {
  if (affordabilityTimer !== null) {
    window.clearInterval(affordabilityTimer);
    affordabilityTimer = null;
  }

  affordabilityTimer = window.setInterval(() => {
    if (!root.isConnected) {
      if (affordabilityTimer !== null) window.clearInterval(affordabilityTimer);
      affordabilityTimer = null;
      return;
    }
    refreshAffordability(root, game);
  }, AFFORDABILITY_MS);
}
