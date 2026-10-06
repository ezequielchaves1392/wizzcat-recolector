import { ic } from './icons';
import { formatNumber } from '../utils/format';
import { AFFIX_BY_ID, collectorMaxLevel, estrellasDe } from '../data/crafting';
import { valuationConCifras } from '../data/valuation';
// **LAS FICHAS ESTÁN EN SU FICHERO PORQUE LAS USA OTRA PANTALLA.** La ficha pública de
// un jugador enseña los mismos recolectores y compañeros, y para que se vean como aquí
// hay que que las dos pinten con la misma función: si cada una tuviera su markup, un día
// cambiaría el color de una rareza en una y no en la otra.
import { fichaDeRecolector, casillaDeCompanero, slug } from './fichas';

/**
 * Panel del jugador: recolector equipado y slots de companeros.
 * Vive en su propio modulo para que el banco de pruebas visuales (/preview.html)
 * reuse exactamente el mismo marcado que la partida real.
 *
 * `bonusesDe` es **la lista de bonos uno a uno** (`getClickBonuses`), no el resumen de tres
 * cifras. Se pasaron los dos durante un rato porque el resumen sigue siendo lo que pide el
 * total de arriba, y quitar un parámetro a la vez que se rompe el panel es una forma de
 * romperlo dos veces.
 */
export function renderPanel(
  state: any,
  realDamage: number,
  effectiveSlots?: number,
  ingresoDe?: (companionId: string) => number,

  damagePartsDe?: () => { base: number; intrinseco: number; partida: number; total: number; filas: any[] }
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
      // Los afijos son la diferencia entre dos recolectores del mismo tier
      const affixes: string[] = equippedItem.affixes || [];

      // **LO QUE HAY EN ESTA TARJETA, Y POR QUE HAY UNA SOLA LISTA.**
      //
      // Antes había tres cosas que se solapaban: el desglose de tres cifras del daño, una
      // lista de multiplicadores que no se sabía si eran de daño o de precio, y un
      // "28 base +12 bonos" que no decía qué era un bono.
      //
      // **LA VALORACIÓN SE HA IDO, Y NO ES QUE ESTARA ESCONDIDA.** Eran los
      // multiplicadores del PRECIO de venta, debajo de un número que es daño: dos
      // grandezas distintas con la misma forma de letra. El precio sigue en el botón de
      // vender, que es donde se cobra; la cuenta interna del precio no hacía falta
      // encima del daño.
      //
      // **Y EL NÚMERO GRANDE VA PARTIDO EN DOS, "30+5".** Lo que produce el item por sí
      // mismo y lo que le suma la partida son dos preguntas distintas, y un solo total
      // obligaría a restar para saber cuánto es del arma. El desglose va en los mismos dos
      // grupos y con la misma separación, para que el número grande y la lista underneath
      //osion sean lo mismo visto de dos formas.
      const partes = typeof damagePartsDe === "function" ? damagePartsDe() : null;
      const intrinseco = partes ? partes.intrinseco : realDamage;
      const deLaPartida = partes ? partes.partida : 0;

      const bonoHTML = (f: any) => `
        <li class="flex items-baseline justify-between gap-2">
          <span class="text-[9px] font-mono text-[var(--text-muted)] truncate">
            ${f.nombre}${f.detalle ? ` <span class="opacity-60">· ${f.detalle}</span>` : ""}
          </span>
          <span class="text-[10px] font-mono font-bold tabular accent-text flex-shrink-0">
            +${formatNumber(f.suma)}
          </span>
        </li>`;

      const filasDelItem = (partes?.filas ?? []).filter((f: any) => f.grupo === "item");
      const filasDeLaPartida = (partes?.filas ?? []).filter((f: any) => f.grupo === "partida");

      const bonosHTML = partes && (filasDelItem.length || filasDeLaPartida.length) ? `
        <div class="mt-2.5 rounded-lg px-2.5 py-2"
             style="border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
                    background: color-mix(in srgb, var(--accent) 5%, transparent)">
          <div class="label-caps mb-1.5 flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3 [&>span>svg]:h-3 opacity-70">${ic("bolt")}</span>
            De dónde sale el daño
          </div>
          <ul class="space-y-1">
            <li class="flex items-baseline justify-between gap-2">
              <span class="text-[9px] font-mono text-[var(--text-muted)]">Base del item</span>
              <span class="text-[10px] font-mono tabular text-[var(--text-muted)] flex-shrink-0">
                ${formatNumber(partes.base)}
              </span>
            </li>
            ${filasDelItem.map(bonoHTML).join("")}
          </ul>

          ${filasDeLaPartida.length ? `
            <div class="label-caps mt-2 pt-1.5 border-t border-[var(--border-color)]">
              Más las bonificaciones de la partida</div>
            <ul class="space-y-1 mt-1">
              ${filasDeLaPartida.map(bonoHTML).join("")}
            </ul>` : ""}

          <div class="flex items-baseline justify-between gap-2 mt-1.5 pt-1.5
                      border-t border-[var(--border-color)]">
            <span class="text-[9px] font-mono accent-text font-bold">Total por click</span>
            <span class="text-[10px] font-mono font-bold tabular accent-text">
              +${formatNumber(partes.total)}
            </span>
          </div>
        </div>
      ` : "";

      // **UN SOLO NÚMERO GRANDE, Y EL DESGLOSE AL POSARSE.**
      //
      // Antes eran dos cifras en la misma línea, "+306 +13", con el signo del medio
      // atenuado. Se pidió un número grande, y la razón de ser de esa forma era que el
      // jugador lee "+306 +13" restando, que es lo que hace cuando quiere saber cuánto
      // es de su recolector y cuánto de los buffs. **Eso no se pierde: se va al
      // `title`.** El desglose completo sigue estando debajo, en "De dónde sale el daño",
      // con los dos grupos separados y etiquetados — o sea que la cuenta estaba escrita
      // dos veces en la misma pantalla.
      const danoTotal = intrinseco + deLaPartida;
      const desgloseEnElTitle = deLaPartida > 0
        ? `Del recolector +${formatNumber(intrinseco)}, más las bonificaciones de la partida +${formatNumber(deLaPartida)}.`
        : 'Lo que da el recolector. No hay ninguna bonificación de partida puesta.';
      const danoHTML = `
        <div class="flex items-baseline justify-end leading-none">
          <span class="font-['Orbitron'] font-bold text-2xl md:text-3xl"
                style="color: var(--accent)">+${formatNumber(danoTotal)}</span>
        </div>`;
      collectorContainer.innerHTML = fichaDeRecolector(equippedItem, {
        // **"DAÑO" ERA LA ETIQUETA QUE NO ENCAJABA CON NADA.** En la ficha de un
        // recolector, "Daño" era la palabra del interno del juego: en pantalla lo que
        // pega el clic son nanitas, y la misma pantalla llama "Ingreso por click" al
        // número del HUD. Dos nombres para lo mismo, y el que no cuadraba era el de la
        // ficha, que es la que se lee.
        etiqueta: 'Recolección por click',
        valor: danoHTML,
        title: desgloseEnElTitle
      }) + bonosHTML;
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
        // POR QUÉ PIDE LA CIFRA AL MOTOR Y NO USA `comp.power`. `power` es el valor
        // desnudo del compañero: lo que entra en la cuenta es ese número después de
        // `passiveMultiplier`, de los logros, del árbol y del buff x2. Con un
        // multiplicador de 1,5 la ficha decía "+3 /s" y el contador subía 4,5.
        //
        // **Y LA FICHA DE `fichas.ts` PIDE ESE `aporta`**, así que el número que se ve
        // aquí y el que se cobra son el mismo. La ficha pública del perfil enseña el
        // `power` desnudo porque no puede saber el multiplicador del árbol de otro.
        const aporta = ingresoDe?.(comp.id);
        html += casillaDeCompanero(comp, aporta);
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
