// ==========================================================================
//  La ruleta del sintonizador: ¿sube el nivel o no?
//
//  Sintonizar un recolector es la única acción del juego donde el jugador
//  apuesta un recurso por una tirada. Antes de esto la pantalla le devolvía un
//  toast —"¡Mejora exitosa!" o "Fallo en el sintonizador"— y con eso tenía que
//  decidir si había ganado algo. Una tirada que solo se comunica con una línea
//  de texto no se siente como una tirada: el jugador no ve el canto de la
//  aguja, que es justo la parte por la que se disfruta un juego de rizos.
//
//  POR QUÉ UNA RULETA DE DOS CASILLAS Y NO UN CARTEL. Porque el juego ya tiene
//  una ruleta —la de las cajas— y el jugador sabe leerla: entra girando, para
//  y se queda quieta en el premio. Reutilizar ese lenguaje para el
//  sintonizador hace que la segunda ruleta no sea un objeto nuevo sino el
//  mismo, y por eso no se ha querido inventar una animación nueva que habría
//  que aprender aparte.
//
//  Y POR QUÉ NO LA RESUELVE ESTE FICHERO. La ruleta de las cajas sortea el
//  botín antes de girar, en `rollCrateReward`, y aquí se mantiene la misma
//  regla: quien llama ya tiene el resultado del dado —`success`— y lo coloca
//  en la casilla ganadora. Si esta función sacara un `Math.random`, la ruleta
//  estaría enseñando un resultado que el motor no aplicó: el jugador vería
//  "ÉXITO" y se quedaría en el mismo nivel. La animación enseña; el motor tira.
// ==========================================================================

import { sfx } from '../utils/audio';
import { ic } from '../ui/icons';
import type { RouletteTile } from './crateLoot';
import { mountStrip, spinTrack } from './rouletteStrip';

/** Vueltas que da el trompo. Las de la caja son 3; aquí basta con 2. */
const VUELTAS = 2;
/**
 * El giro dura menos que el de las cajas (4200 ms).
 *
 * POR QUÉ. El sintonizador se usa docenas de veces por partida —cada cristal
 * es un intento— y 4,2 s por cristal convierte una acción de un segundo en una
 * de cinco. El juego ya sabe que la tirada está decidida, así que el volteo
 * largo no compra tensión: solo hace esperar. Sigue siendo un trompo, con sus
 * chasquidos, para que se vea correr la aguja.
 *
 * Y las vueltas son dos y no tres por la misma razón: el jugador va a ver
 * estas casillas cientos de veces, y la diferencia entre dos y tres vueltas es
 * justo la que se nota como "esto tarda".
 */
const SPIN_MS = 2400;

/** Lo que la ruleta necesita saber, y que ya está decidido antes de girar. */
export interface TuningRoll {
  /**
   * Hubo tirada.
   *
   * Separate de `success` a propósito, porque son dos cosas distintas y
   * confundirlas produce una ruleta mintiendo. Un rechazo del motor —no hay
   * cristales, ya está en el techo— devuelve `success: false` SIN tirar el
   * dado: no se gastó nada y el nivel no se movió. Si eso llegara a la ruleta,
   * el jugador vería un trompo por una operación que no ocurrió.
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
 * Monta lo que la ruleta va a enseñar, a partir de lo que el motor devolvió.
 *
 * POR QUÉ ESTA FUNCIÓN EXISTE Y NO ESTÁ INLINEADA EN EL SELECTOR. Porque es la
 * regla de la que depende toda la honestidad de la ruleta, y estaba escrita en
 * el manejador del botón, donde no se puede comprobar: `verify/` no arranca
 * pantallas. Con la regla aquí, el banco la monta contra el game loop de verdad
 * y mira que la flecha "4 → 5" no pueda convertirse en "5 → 5".
 *
 * Y EL ERROR QUE ESTA FUNCIÓN CIERRA, que es de los que no dan ningún aviso.
 * El game loop sube `item.level` en el mismo objeto del almacén, así que leer el
 * nivel DESPUÉS de la llamada devuelve el nivel nuevo en los dos casos. Con
 * `levelBefore` también leído después, el acierto pintaba "5 → 5": un número que
 * no existe, sobre una ruleta que el jugador acaba de ver girar. El fallo
 * parecería correcto por casualidad, porque ahí los dos niveles coinciden de
 * verdad.
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
  res: { success?: boolean; rolled?: boolean; msg?: string },
  levelBefore: number,
  levelAfter: number
): TuningRoll {
  // `=== true` y no truthy: un `rolled` que venga `undefined` (una partida
  // guardada por un motor viejo, un mock que no se ha actualizado) se trata
  // como "no hay ruleta", que es la salida que no le enseña nada falso al
  // jugador. Es el mismo criterio que R11 con los saves.
  const rolled = res.rolled === true;
  const subio = rolled && res.success === true && levelAfter > levelBefore;
  return {
    rolled,
    success: subio,
    levelBefore,
    // En un fallo, el nivel con el que se queda es el de antes. Se pone
    // explícito y no se copia `levelAfter` porque el motor, en un fallo, no
    // toca el campo: leerlo daría el mismo número por casualidad, y el día que
    // el motor cambiara esa parte la ruleta mentiría sin que nada se encendiera.
    levelAfter: subio ? levelAfter : levelBefore,
    msg: res.msg || ''
  };
}

/**
 * Muestra la ruleta del sintonizador y, al terminar, el cartel del resultado.
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

  // POR QUÉ LAS CASILLAS ALTERNAN Y NO SORTEAN. Hay dos desenlaces posibles y
  // la tira los alterna sin azar. Con `Math.random` dos sintonizaciones del
  // mismo nivel se verían distintas sin que nada hubiera cambiado, y al
  // comparar dos capturas no se sabría si se ve otra cosa o es la misma.
  //
  // Y por qué la casilla que gana la pone este fichero y no el que la pinta: es
  // el resultado, y el resultado lo decidió el motor. Si saliera de un dado de
  // aquí, la ruleta estaría mintiendo sobre el que el motor aplicó de verdad, y
  // el motor ya cobró el cristal.
  const mount = mountStrip(overlay, (giro) => {
    const tiles: RouletteTile[] = Array.from({ length: giro.casillas }, (_, i) => (
      i % 2 === 0
        ? { label: 'MEJORA', sub: `NIVEL ${roll.levelBefore + 1}`, rarity: 'Legendario', icon: 'sparkle', tone: 'good' }
        : { label: 'FALLO', sub: `NIVEL ${roll.levelBefore}`, rarity: 'Común', icon: 'close', tone: 'bad' }
    ));
    tiles[giro.winIndex] = gano
      ? { label: 'MEJORA', sub: `NIVEL ${roll.levelAfter}`, rarity: 'Legendario', icon: 'sparkle', tone: 'good' }
      : { label: 'FALLO', sub: `NIVEL ${roll.levelAfter}`, rarity: 'Común', icon: 'close', tone: 'bad' };
    return tiles;
  }, VUELTAS);

  const result = document.createElement('div');
  result.dataset.role = 'result';
  result.className = 'opacity-0 transition-opacity duration-300 flex flex-col items-center gap-3 flex-shrink-0 pb-2';
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

  const finished = { value: false };
  spinTrack(mount, SPIN_MS, () => {
    finished.value = true;
    if (gano) sfx.levelUp(); else sfx.error();
    result.classList.remove('opacity-0');
    result.classList.add('opacity-100');
  });

  const finish = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose();
  };
  result.querySelector('[data-role="close"]')?.addEventListener('click', finish);
  // Escape cierra, pero solo con el resultado ya revelado: si se cerrara durante
  // el giro el jugador se quedaría sin ver si su cristal sirvió de algo. Es el
  // mismo criterio que la ruleta de las cajas.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && finished.value) finish();
  };
  document.addEventListener('keydown', onKey);
}
