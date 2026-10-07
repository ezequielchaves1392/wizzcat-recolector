// ==========================================================================
//  El cartel del sintonizador: ¿sube el nivel o no?
//
//  Sintonizar un recolector es la única acción del juego donde el jugador
//  apuesta un recurso por una tirada. Antes de que hubiera cartel, la pantalla
//  devolvía un toast —"¡Mejora exitosa!" o "Fallo en el sintonizador"— y con
//  eso tenía que decidir si había ganado algo. Una tirada que solo se comunica
//  con una línea de texto no se siente como una tirada.
//
//  Antes esto era una ruleta de dos casillas, con el mismo lenguaje que la de
//  las cajas. La ruleta se ha quitado del juego entero (B17) y lo que queda es
//  lo que la ruleta enseñaba al final: el cartel del resultado, directo y sin
//  giro. El motor ya tiró el dado y el nivel ya se movió antes de montar nada.
//
//  Y POR QUÉ NO RESUELVE NADA ESTE FICHERO. La regla es la misma que con las
//  cajas: quien llama ya tiene el resultado del dado —`success`— y aquí solo
//  se enseña. Si este fichero sacara un `Math.random`, estaría enseñando un
//  resultado que el motor no aplicó: el jugador vería "¡MEJORA!" y se quedaría
//  en el mismo nivel. La animación enseñaba; el motor tira.
// ==========================================================================

import { sfx } from '../utils/audio';
import { ic } from '../ui/icons';

/** Lo que el cartel necesita saber, y que ya está decidido antes de enseñarlo. */
export interface TuningRoll {
  /**
   * Hubo tirada.
   *
   * Separate de `success` a propósito, porque son dos cosas distintas y
   * confundirlas produce un cartel mintiendo. Un rechazo del motor —no hay
   * cristales, ya está en el techo— devuelve `success: false` SIN tirar el
   * dado: no se gastó nada y el nivel no se movió. Si eso llegara al cartel,
   * el jugador vería un "FALLO" por una operación que no ocurrió.
   */
  rolled: boolean;
  /** El motor ya tiró el dado y salió bueno. */
  success: boolean;
  /** Nivel del recolector antes de la tirada. */
  levelBefore: number;
  /** Nivel con el que se queda. En un fallo es el mismo que `levelBefore`. */
  levelAfter: number;
  /** El mensaje del motor. Se enseña tal cual y no se reescribe aquí. */
  msg: string;
}

/**
 * Monta lo que el cartel va a enseñar, a partir de lo que el motor devolvió.
 *
 * POR QUÉ ESTA FUNCIÓN EXISTE Y NO ESTÁ INLINEADA EN EL SELECTOR. Porque es la
 * regla de la que depende toda la honestidad del cartel, y estaba escrita en
 * el manejador del botón, donde no se puede comprobar: `verify/` no arranca
 * pantallas. Con la regla aquí, el banco la monta contra el game loop de verdad
 * y mira que la flecha "4 → 5" no pueda convertirse en "5 → 5".
 *
 * Y EL ERROR QUE ESTA FUNCIÓN CIERRA, que es de los que no dan ningún aviso.
 * El game loop sube `item.level` en el mismo objeto del almacén, así que leer el
 * nivel DESPUÉS de la llamada devuelve el nivel nuevo en los dos casos. Con
 * `levelBefore` también leído después, el acierto pintaba "5 → 5": un número que
 * no existe. El fallo parecería correcto por casualidad, porque ahí los dos
 * niveles coinciden de verdad.
 *
 * Por eso `levelBefore` se lee ANTES de llamar al motor y se pasa como dato, y
 * por eso el nivel de después sale de una relación y no de una segunda lectura.
 *
 * CÓMO SE SABE QUE HUBO TIRADA. Lo dice el motor, con `rolled`. No se deduce
 * aquí, y no se deduce mirando si el cristal se gastó: los rechazos del motor
 * devuelven `success: false` igual que un fallo del dado, así que `success` no
 * alcanza, y la única forma de saberlo por aquí sería repetir en la vista la
 * regla de consumo del motor (R1 y R2). Un único dato que el motor ya sabe
 * evita las dos cosas.
 */
export function tuningRoll(
  res: { success?: boolean; rolled?: boolean; msg?: string; level?: number },
  levelBefore: number,
  levelAfter: number
): TuningRoll {
  // `=== true` y no truthy: un `rolled` que venga `undefined` (una partida
  // guardada por un motor viejo, un mock que no se ha actualizado) se trata
  // como "no hay cartel", que es la salida que no le enseña nada falso al
  // jugador. Es el mismo criterio que R11 con los saves.
  const rolled = res.rolled === true;
  const subio = rolled && res.success === true && levelAfter > levelBefore;
  // **Y SI EL MOTOR DICE QUE SUBIÓ PERO LOS NÚMEROS NO, NO SE PINTA "FALLO".** El cartel
  // lleva un `msg` que viene del motor, así que en ese caso se leería "FALLO · sin cambio"
  // encima de "¡Mejora exitosa!". Dos verdades contradictorias en la misma tarjeta, y la que
  // miente es la grande. Cuando el motor afirma que subió, la cifra que se enseña es la
  // que da: una subida de un nivel por la vía corta se ve como una subida.
  const suboSegunElMotor = rolled && res.success === true;
  const nivelFinal = suboSegunElMotor
    ? Math.max(levelAfter, levelBefore + 1)
    : levelBefore;
  return {
    rolled,
    success: suboSegunElMotor,
    levelBefore,
    // En un fallo, el nivel con el que se queda es el de antes. Se pone
    // explícito y no se copia `levelAfter` porque el motor, en un fallo, no
    // toca el campo: leerlo daría el mismo número por casualidad, y el día que
    // el motor cambiara esa parte el cartel mentiría sin que nada se encendiera.
    levelAfter: nivelFinal,
    msg: res.msg || ''
  };
}

/**
 * Muestra el cartel del sintonizador.
 * `onClose` se llama cuando el jugador acepta.
 */
export function showTuningRoulette(roll: TuningRoll, onClose: () => void) {
  const gano = roll.success;
  const tono = gano ? 'text-cyan-300' : 'text-rose-400';

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 p-4 app-bg overflow-y-auto';
  overlay.innerHTML = `
    <div class="text-center flex-shrink-0">
      <div class="mb-2 [&>span>svg]:w-9 [&>span>svg]:h-9" style="color: var(--accent)">${ic('crystal')}</div>
      <h2 class="font-['Orbitron'] font-black text-lg tracking-wider" style="color: var(--accent)">SINTONIZANDO</h2>
      <p class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">${gano ? 'RESONANCIA ESTABLE' : 'SIN RESONANCIA'}</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const result = document.createElement('div');
  result.dataset.role = 'result';
  result.className = 'flex flex-col items-center gap-3 flex-shrink-0 pb-2';
  result.innerHTML = `
    <div class="card-glass-elevated border ${gano ? 'border-cyan-400/40' : 'border-rose-500/40'} rounded-2xl px-6 py-5 flex flex-col items-center gap-2 max-w-sm text-center">
      <div class="mb-1 [&>span>svg]:w-12 [&>span>svg]:h-12 ${tono}">${ic(gano ? 'sparkle' : 'close')}</div>
      <div class="font-['Orbitron'] font-black text-2xl leading-none ${tono}">${gano ? '¡MEJORA!' : 'FALLO'}</div>
      <div class="text-[11px] font-mono tabular ${tono}">
        Nivel ${roll.levelBefore}${gano ? ` → ${roll.levelAfter}` : ' · sin cambio'}
      </div>
      <div class="text-xs font-mono mt-1" style="color: var(--text-main)">${roll.msg}</div>
    </div>
    <button data-role="close" class="px-6 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
      CONTINUAR
    </button>`;
  overlay.appendChild(result);

  if (gano) sfx.levelUp(); else sfx.error();

  const finish = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose();
  };
  result.querySelector('[data-role="close"]')?.addEventListener('click', finish);
  // Escape cierra: como ya no hay giro, el resultado está revelado desde el
  // primer instante y no hay momento en el que cerrar deje sin verlo.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
  };
  document.addEventListener('keydown', onKey);
}
