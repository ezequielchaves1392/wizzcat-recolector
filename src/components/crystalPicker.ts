// ==========================================================================
//  Cristal de mejora: selector
//
//  F26 · **YA NO ES UNA ELECCIÓN.** Antes esta hoja listaba los diez cristales
//  con su multiplicador y pediría que compararas dos números para decidir cuál
//  conviene: con un T7 en la mano, "x2.2 o x4" no es una elección que se pueda
//  hacer leyendo, y el resultado —cuánto subiría el acierto— no estaba en
//  ninguna parte de la pantalla.
//
//  Ahora hay un único cristal que sirve para un recolector dado, **el de su
//  mismo tier**, y esta hoja enseña una fila: la que tienes o la que te falta.
//  El coste en unidades y la probabilidad que da el cristal se enseñan ANTES de
//  confirmar, porque un x6 que cuesta 190 unidades tiene que leerse como una
//  apuesta.
//
//  El coste y la probabilidad se calculan aquí para poder pintar la lista sin
//  llamar al game loop por fila. Cuando el jugador elige, el juego los
//  recalcula y es él quien cobra: si los dos se desincronizasen, el botón
//  mostraría una cosa y ocurriría otra.
// ==========================================================================

import { ic } from '../ui/icons';
import { showToast } from '../utils/toast';
import { sfx } from '../utils/audio';
import { CRYSTAL_DEFS, MAX_CRYSTAL_TIER, crystalTierFromName } from '../data/items';
import { collectorMaxLevel } from '../data/crafting';
import { previewUpgradeChance, previewUpgradeCost } from '../gameLoop';
import { rarityClass } from './crateLoot';
import { showTuningRoulette, tuningRoll } from './tuningRoulette';

/**
 * Abre el selector de cristal para sintonizar el recolector equipado.
 *
 * F26 · **YA NO HAY QUE ELEGIR.** Antes esta hoja listaba todos los cristales del
 * almacén con su multiplicador, y elegir era una decisión de contabilidad: con
 * un T7 en la mano, "x2.2 o x4" son dos números que hay que comparar, y el
 * resultado —quéSubiría más— no estaba en ninguna parte de la pantalla.
 *
 * Ahora hay un único cristal válido, **el del mismo tier del recolector**, y la
 * hoja enseña una sola fila: la que sirve, o la que falta. El multiplicador deja
 * de ser la elección y pasa a ser la recompensa de traer el cristal correcto.
 *
 * Y el motor no recibe el nivel como argumento: `upgradeEquippedCollector()` lo
 * deduce del item. Así que esta vista no puede ofrecer un cristal que el motor
 * vaya a rechazar, ni al revés (R3).
 */
export function showCrystalPicker(game: any, redraw: () => void) {
  const state = game.getState();
  const equipo = (state.warehouse as any[]).find((w: any) => w.id === state.equippedCollectorId);

  if (!equipo) {
    showToast('Equipa un recolector primero.', 'info');
    return;
  }
  // El techo lo decide el recolector, con la MISMA regla que usa el game loop.
  // Aquí había un 35 a pelo: el máximo absoluto, que solo corresponde a un
  // recolector forjado de potencial 5. Con un recolector de la tienda (techo 20)
  // el selector se abría en el nivel 20, el jugador elegía un cristal, lo gastaba
  // y la sintonización se le rechazaba. Dos números distintos para la misma regla
  // en la misma partida: uno en la vista y otro en el motor.
  const tope = collectorMaxLevel(equipo.maxLevel);
  if ((equipo.level || 0) >= tope) {
    showToast('El recolector ya está al nivel máximo.', 'info');
    return;
  }

  // El nivel del cristal sale del tier del recolector, y es el MISMO criterio que
  // lee el motor. No se pide por parámetro ni se elige: si aquí se calculara de
  // otra manera, el botón ofrecería un cristal y la sintonización lo rechazaría.
  const tierItem = Math.max(1, Math.floor(Number(equipo.tier) || 1));
  const def = CRYSTAL_DEFS[tierItem];

  if (!def) {
    showToast(`Un T${tierItem} todavía no se puede sintonizar: el cristal más alto que existe es el T${MAX_CRYSTAL_TIER}.`, 'error');
    return;
  }

  // Solo el cristal de este tier. Si el item no trae nivel guardado se lee por su
  // nombre, que es lo que hace la migración al cargar.
  const disponible = ((state.warehouse as any[]) || []).find((w: any) =>
    w.type === 'crystal' &&
    (typeof w.tier === 'number' ? w.tier : crystalTierFromName(w.name || '')) === tierItem);
  const unidades = disponible?.stackCount || 0;
  const coste = crystalCost(equipo.level || 0);
  const alcanza = unidades >= coste;
  const prob = previewUpgradeChance(equipo.level || 0, def.power);

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
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ${rarityClass(def.rarity)}
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('crystal')}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight truncate">
            Sintonizar ${equipo.name}
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Nivel ${equipo.level || 0} · T${tierItem} · coste ${coste} x cristal · ${prob}% de éxito
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
        </button>
      </div>

      <button data-crystal="1" ${alcanza ? '' : 'disabled style="opacity:.45"'}
              class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left
                     ${alcanza ? 'cursor-pointer transition active:scale-[0.99] hover:border-[var(--accent)]' : ''}
                     border-[var(--border-color)]"
              style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
        <span class="flex-shrink-0 ${rarityClass(def.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('crystal')}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${def.name}</span>
          <span class="block text-[9px] font-mono ${alcanza ? 'text-[var(--text-muted)]' : 'text-rose-400'} mt-0.5">
            ${alcanza
              ? `${def.power}x · sale de las cajas T${tierItem}`
              : `No tienes. Sale de las cajas T${tierItem}.`}
          </span>
        </span>
        <span class="text-right flex-shrink-0">
          <span class="block text-[11px] font-mono accent-text tabular">×${unidades}</span>
          <span class="block text-[9px] font-mono ${alcanza ? 'text-[var(--text-muted)]' : 'text-rose-400'}">
            ${alcanza ? `-${coste}` : `faltan ${coste - unidades}`}
          </span>
        </span>
      </button>

      <p class="text-[10px] font-mono text-[var(--text-muted)] mt-3 leading-relaxed">
        Cada recolector se sintoniza con el cristal de su mismo tier. El cristal sube la
        probabilidad de acierto y no el daño: fallar cuesta el cristal y nada más.
      </p>
    </div>
  `;

  const cerrar = () => overlay.remove();
  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.querySelectorAll('[data-crystal]:not([disabled])').forEach(b => {
    b.addEventListener('click', () => {
      cerrar();
      sfx.use();
      // POR QUÉ EL NIVEL SE LEE ANTES DE TIRAR EL DADO. El game loop sube
      // `item.level` en el mismo objeto del almacén, así que leerlo después
      // devolvería el nivel nuevo en los dos casos y la ruleta no podría
      // pintar "4 → 5": enseñaría "5 → 5" en el acierto, que es un número que
      // no existe. `equipo` es la referencia viva al item, no una copia.
      const nivelAntes = equipo.level || 0;
      // F26 · SIN ARGUMENTO DE CRISTAL, a propósito. El motor decide el nivel
      // desde el item, así que esta vista no puede proponer un cristal distinto
      // del que se va a gastar.
      const res = game.upgradeEquippedCollector();
      // `tuningRoll()` decide qué niveles enseña la ruleta, y el porqué de que
      // el de antes se lea ANTES de la llamada está en su JSDoc. Aquí solo se le
      // pasa lo que hay.
      const roll = tuningRoll(res, nivelAntes, equipo.level || 0);
      // Y SI EL MOTOR NO TIRÓ EL DADO, NO HAY RULETA. Un rechazo —no hay
      // cristales de ese nivel, ya está en el techo, no hay colector— no es un
      // fallo de la tirada: no se ha gastado nada y no ha pasado nada. Girar
      // igualmente sería una ruleta mintiendo: el trompo anunciaría una
      // apuesta que el jugador no hizo y el cartel daría un desenlace que no
      // existe, con un mensaje que además habla de otra cosa ("Necesitas 4 x
      // Cristal de Afino"). El aviso de toast es lo que corresponde aquí, y es
      // lo que ya se veía antes de esta ruleta.
      //
      // Es un camino raro —el selector desactiva el botón cuando no llega, y el
      // techo se comprueba al abrir—, pero "raro" no es "imposible": el estado
      // puede cambiar entre abrir el selector y pulsar, y el juego no puede
      // depender de que la vista lo compruebe una vez.
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
      // con el texto "¡Mejora exitosa!" dentro y sonaba el sonido de fallo. Solo
      // el fallo se veía bien, y por casualidad, porque en ese caso el mensaje
      // de error era el que tocaba. Un resultado mal leído no da ningún aviso.
      //
      // Y POR QUÉ `res.msg` EN VEZ DE UN MENSAJE NUEVO. El texto del acierto y
      // del fallo lo redacta el motor, que es quien sabe cuánto costó y a qué
      // nivel quedó. Reescribirlo aquí sería una segunda versión de la misma
      // frase, y las dos se separarían en cuanto se tocara una.
      showTuningRoulette(roll, redraw);
    });
  });
  document.body.appendChild(overlay);
}

/**
 * Coste en unidades de cristal para subir del nivel dado.
 *
 * Delega en el game loop, no lo recalcula. La fórmula del coste tiene que estar
 * en un solo sitio: con dos copias, cambiar el coste en el juego dejaba el
 * selector enseñando la cifra vieja.
 */
function crystalCost(level: number): number {
  return previewUpgradeCost(level);
}