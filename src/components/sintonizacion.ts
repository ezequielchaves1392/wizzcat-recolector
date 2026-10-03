// ==========================================================================
//  LA HOJA DE SINTONIZACIÓN
// ==========================================================================
//  POR QUÉ ESTE FICHERO SE LLAMA ASÍ Y NO COMO EL ANTERIOR.
//
//  Antes se llamaba `crystalPicker`: *selector* de cristal. Elegir entre varios
//  cristales era exactamente lo que hacía, y lo que F26 dejó de permitir cuando la
//  regla pasó a ser "el cristal del mismo nivel".
//
//  Ahora el cristal **es un recurso**: no hay varios, no hay nada que elegir y no
//  hay nada que(listar). Lo que queda de este fichero es una hoja que dice cuánto
//  cuesta, cuánto tienes y qué probabilidad hay, y que al confirmar tira.
//
//  **POR QUÉ SE HA HECHO UNA HOJA Y NO UN BOTÓN QUE TIRE DIRECTO.** Porque el
//  número sigue siendo una decisión: el coste sube con el nivel, la probabilidad
//  baja con el nivel, y fallar **gasta los cristales sin bajar el nivel**. Eso no
//  se puede hacer con un botón que se pulsa sin mirar. La hoja es el sitio donde
//  el jugador ve el coste y el riesgo antes de que sea tarde.
//
//  Y **LO QUE SE PIERDE ESTÁ DICHO**, porque es la parte de este cambio que se
//  nota al jugar: antes el cristal tenía un multiplicador de probabilidad y el
//  jugador podía elegir cuánto riesgo compraba. Con un solo recurso la
//  sintonización es determinista dado el nivel —en el 20 acierta el 35 %, en el 0
//  el 95 %— y **el riesgo que queda es el del nivel, que sube con cada subida**.
// ==========================================================================

import { showToast } from '../utils/toast';
import { sfx } from '../utils/audio';
import { ic } from '../ui/icons';
import { formatNumber } from '../utils/format';
import { showTuningRoulette, tuningRoll } from './tuningRoulette';
import { rarityClass } from './crateLoot';
import { previewUpgradeChance, previewUpgradeCost } from '../gameLoop';
import { collectorMaxLevel } from '../data/crafting';
import { CRISTAL_NOMBRE } from '../data/items';

/**
 * Abre la hoja de sintonización del recolector equipado.
 *
 * **LO QUE ESTA HOJA ENSEÑA Y DE DÓNDE SALE CADA NÚMERO.** Los tres salen del
 * motor, nunca se recalculan aquí: el techo, el coste y la probabilidad. Copiar una
 * fórmula en la vista es la forma más barata de que el botón diga una cifra y el
 * cobro otra, y ya se ha pagado una vez con el 35 a pelo de `collectorMaxLevel`.
 *
 * **Y LA RESERVA ES DE UN RECURSO, NO DE UN ITEM.** El saldo sale de
 * `state.crystals`; no hay `find()` en el almacén, ni nivel que deducir del
 * nombre, ni la comprobación de que exista una pila compatible. Es la mitad de lo
 * que había antes.
 */
export function showSintonizacion(game: any, redraw: () => void) {
  const state = game.getState();
  const equipo = (state.warehouse as any[]).find((w: any) => w.id === state.equippedCollectorId);

  if (!equipo) {
    showToast('Equipa un recolector primero.', 'info');
    return;
  }

  // El techo lo decide el recolector, con la MISMA regla que usa el game loop.
  // Aquí había un 35 a pelo: el máximo absoluto, que solo corresponde a un
  // recolector forjado de potencial 5. Con un recolector de la tienda (techo 20)
  // la hoja se abría en el nivel 20 y la sintonización se le rechazaba. Dos
  // números distintos para la misma regla en la misma partida.
  const tope = collectorMaxLevel(equipo.maxLevel);
  const nivel = equipo.level || 0;
  if (nivel >= tope) {
    showToast('El recolector ya está al nivel máximo.', 'info');
    return;
  }

  // **EL TIER SOLO SIRVE PARA EL COSTE, Y ESO ES TODO.** Ya no decide el cristal —
  // no hay—, no hay un techo de cristal que comprobar y por tanto **desaparecen
  // tres bloques enteros de esta función**: la búsqueda de la pila válida, el
  // `crystalTierFromName()` para los items sin nivel, y el rechazo de "un T30
  // todavía no se puede sintonizar".
  //
  // Ese último es la mejor noticia de las tres. La forja es infinita, así que
  // produce items por encima del T10, y antes **no se podían subir de nivel**.
  // Ahora sí, por mucho más caros.
  const tierItem = Math.max(1, Math.floor(Number(equipo.tier) || 1));
  const coste = previewUpgradeCost(tierItem, nivel);
  const tienes = state.crystals ?? 0;
  const alcanza = tienes >= coste;
  const prob = previewUpgradeChance(nivel);

  const overlay = document.createElement('div');
  // `sheet-overlay` + `sheet-panel` (ver `style.css`): abajo en el móvil, que es
  // donde el pulgar llega, y centrado en escritorio. Estas cuatro utilidades
  // estaban escritas a mano aquí, y el resultado en escritorio era una hoja de
  // 90 px pegada al borde inferior de una pantalla de 900 px.
  overlay.className = 'sheet-overlay z-[70]';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="sheet-panel card-glass-elevated animate-rise-in">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ${rarityClass('Raro')}
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('crystal')}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight truncate">
            Sintonizar ${equipo.name}
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Nivel ${nivel} → ${nivel + 1} · ${formatNumber(coste)} de ${CRISTAL_NOMBRE} · ${prob}% de éxito
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
        </button>
      </div>

      <button data-sintonizar ${alcanza ? '' : 'disabled style="opacity:.45"'}
              class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left
                     ${alcanza ? 'cursor-pointer transition active:scale-[0.99] hover:border-[var(--accent)]' : ''}
                     border-[var(--border-color)]"
              style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
        <span class="flex-shrink-0 ${rarityClass('Raro')} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('crystal')}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${CRISTAL_NOMBRE}</span>
          <span class="block text-[9px] font-mono ${alcanza ? 'text-[var(--text-muted)]' : 'text-rose-400'} mt-0.5">
            ${alcanza
              ? `Sube el nivel y el daño del recolector. Sube el nivel del ingreso de un compañero.`
              : `Te faltan ${formatNumber(coste - tienes)}. Salen de las cajas T${tierItem}.`}
          </span>
        </span>
        <span class="text-right flex-shrink-0">
          <span class="block text-[11px] font-mono accent-text tabular">${formatNumber(tienes)}</span>
          <span class="block text-[9px] font-mono ${alcanza ? 'text-[var(--text-muted)]' : 'text-rose-400'}">
            ${alcanza ? `−${formatNumber(coste)}` : `faltan ${formatNumber(coste - tienes)}`}
          </span>
        </span>
      </button>

      <p class="text-[10px] font-mono text-[var(--text-muted)] mt-3 leading-relaxed">
        Un T${tierItem} cuesta mucho más que un T1, y el coste sube en cada nivel. La
        probabilidad <strong>baja</strong> con el nivel y no hay forma de comprarse más:
        si fallas, pierdes el cristal y el recolector no baja de nivel.
      </p>
    </div>
  `;

  const cerrar = () => overlay.remove();
  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.querySelectorAll('[data-sintonizar]:not([disabled])').forEach(b => {
    b.addEventListener('click', () => {
      cerrar();
      sfx.use();
      // POR QUÉ EL NIVEL SE LEE ANTES DE TIRAR EL DADO. El game loop sube
      // `item.level` en el mismo objeto del almacén, así que leerlo después
      // devolvería el nivel nuevo en los dos casos y la ruleta no podría
      // pintar "4 → 5": enseñaría "5 → 5" en el acierto, que es un número que
      // no existe. `equipo` es la referencia viva al item, no una copia.
      const nivelAntes = equipo.level || 0;
      // SIN ARGUMENTO DE CRISTAL, a propósito. El motor lee el recurso del
      // estado, así que esta vista no puede proponer un gasto que no vaya a
      // pasar (R3).
      const res = game.upgradeEquippedCollector();
      // `tuningRoll()` decide qué niveles enseña la ruleta, y el porqué de que
      // el de antes se lea ANTES de la llamada está en su JSDoc.
      const roll = tuningRoll(res, nivelAntes, equipo.level || 0);
      // Y SI EL MOTOR NO TIRÓ EL DADO, NO HAY RULETA. Un rechazo —no hay saldo,
      // ya está en el techo, no hay recolector— no es un fallo de la tirada: no se
      // ha gastado nada y no ha pasado nada. Girar igualmente sería una ruleta
      // mintiendo.
      //
      // Es un camino raro —la hoja desactiva el botón cuando no llega, y el
      // techo se comprueba al abrir—, pero "raro" no es "imposible": el estado
      // puede cambiar entre abrir la hoja y pulsar, y el juego no puede depender
      // de que la vista lo compruebe una vez.
      if (!roll.rolled) {
        sfx.error();
        showToast(roll.msg || 'No se pudo sintonizar.', 'error');
        redraw();
        return;
      }
      // POR QUÉ `success` Y NO `ok`. El game loop tiene DOS convenciones de
      // resultado y no están unificadas: `sellItem`, `useConsumable` y
      // `openCrateBox` devuelven `{ ok, msg }`, mientras que
      // `upgradeEquippedCollector`, la Forja y la Ascensión devuelven
      // `{ success, msg }`. Aquí se leía `res.ok`, que en un `{ success }` es
      // `undefined`: `!undefined` es `true`, así que TODA sintonización caía en
      // la rama de error. Es decir, un acierto pintaba un toast rojo de "error"
      // con el texto "¡Mejora exitosa!" dentro y sonaba el sonido de fallo.
      //
      // Y POR QUÉ `res.msg` EN VEZ DE UN MENSAJE NUEVO. El texto del acierto y
      // del fallo lo redacta el motor, que es quien sabe cuánto costó y a qué
      // nivel quedó.
      showTuningRoulette(roll, redraw);
    });
  });
  document.body.appendChild(overlay);
}