// === CONTADOR DE NANITAS DE LA BASE: LA CUENTA SUAVE ===
//
// POR QUÉ EXISTE ESTE MÓDULO.
//
// El tick del juego corre cada 500 ms y cobra el pasivo con
// `state.passiveIncome / TICKS_PER_SECOND` (gameLoop.ts). Con un ingreso de 5/s
// eso son 2,5 nanitas por tick, y `formatNumber` baja el entero con `Math.floor`:
// el número grande de la base alternaba +2 y +3 (307 → 309 → 312 → 314 → 317 →
// 319) mientras el HUD de al lado anunciaba "+5 Nanitas / segundo". El saldo
// estaba bien y el guardado también; lo que no era legible era el paso. Con
// cualquier ingreso impar el tirón sale: 7/s daría +3 y +4, 9/s +4 y +5.
//
// QUÉ NO ES ESTO. No redondea, no ajusta el saldo y no toca la economía: la cifra
// que entra en la cuenta es la del game loop, sin tocar. Aquí solo se decide CÓMO
// se pasa de un entero al siguiente, y siempre por dentro: al terminar el vuelo
// se pinta el entero real, nunca uno inventado.
//
// POR QUÉ SOLO LA BASE Y NO LOS OTROS CONTADORES. `#store-nanites` lo escriben
// dos código con la misma cifra —este y el intervalo de accesibilidad de
// `store.ts`— y dos escritores sobre el mismo nodo se pelean: el rodillo iría un
// tick por delante y el otro lo dejaría en el sitio cada 400 ms. Los contadores
// que hay al lado de un precio se quedan con el valor exacto, que además es lo
// que R3 pide: el precio es el que manda, el saldo es informativo.

import { formatNumber } from '../utils/format';

/** El nodo que se anima. Solo el número grande de la base. */
const ID_CONTADOR = '#nanites-counter';

/**
 * Ritmo del vuelo: un milisegundo por nanita, con dos techos.
 *
 * El mínimo es un tick completo. Rodar 2,5 nanitas en 2,5 ms no es fluido, es
 * un parpadeo: el jugador vería el mismo 307 durante medio segundo y luego un
 * salto. El máximo es lo que separa "crece" de "va con retraso": por encima de
 * 900 ms el número está más tiempo lejos de la verdad que cerca, y entonces lo
 * honesto es pintarlo entero. Las dos son甘 medidas en el mismo sitio, por eso
 * una sola función decide, sin números mágicos sueltos.
 */
const MS_POR_NANITA = 1;
const MS_MIN_VUELO = 500;
const MS_MAX_VUELO = 900;

/**
 * Estado del vuelo. De módulo y no de función (R6): `updateUI` se reconstruye
 * con cada render de la vista, y un vuelo que se olvidara a mitad de camino
 * dejaría el número congelado en mitad del camino.
 *
 * `raf` es el identificador de la cadena de cuadros. Mientras haya uno vivo NO
 * se pide otro: cada tick reencamina el vuelo que ya está corriendo, que es lo
 * que convierte cinco tropezones en un movimiento continuo. A cero, el bucle
 * está parado y no hay trabajo pendiente entre ticks.
 */
const vuelo = {
  desde: 0,
  hasta: NaN as number,
  inicio: 0,
  duracion: 0,
  raf: 0,
  iniciado: false,
  nodo: null as HTMLElement | null,
  ultimoTexto: null as string | null
};

/**
 * Duración del vuelo para una distancia dada, en ms. `0` significa que no hay
 * vuelo: el número se pinta entero de golpe.
 *
 * Se exporta entera para poder probarla sin DOM, que es donde vive la única
 * decisión con criterio de este módulo.
 */
export function duracionVuelo(distancia: number): number {
  // Ni sube, o es un salto grande: de golpe.
  if (!(distancia > 0) || distancia > MS_MAX_VUELO) return 0;
  return Math.min(MS_MAX_VUELO, Math.max(MS_MIN_VUELO, distancia * MS_POR_NANITA));
}

/** Posición interpolada del vuelo. `transcurrido` en ms desde el arranque. */
export function valorEnVuelo(
  desde: number,
  hasta: number,
  transcurrido: number,
  duracion: number
): number {
  if (duracion <= 0) return hasta;
  if (transcurrido >= duracion) return hasta;
  if (transcurrido <= 0) return desde;
  return desde + (hasta - desde) * (transcurrido / duracion);
}

/**
 * ¿El sistema pide menos movimiento?
 *
 * Se pregunta al escribir y no al importar, porque la preferencia se puede
 * cambiar con el juego abierto. Menos movimiento, no menos información (R20):
 * con esto activado el número se actualiza igual, solo que sin rodar.
 */
function pideMenosMovimiento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;   // sin `matchMedia` no hay motivo para quitar la animación
  }
}

/**
 * El nodo del contador, re-resuelto cuando el render lo sustituye (R5).
 *
 * Un nodo NUEVO es un contador nuevo: el marcado de `layout.ts` nace con "0" y lo
 * que quedara en memoria era de la vista anterior. Por eso se olvida el estado
 * al cambiar de nodo, y el primer pintado de un contador nuevo es un salto seco
 * en vez de un vuelo desde el saldo anterior.
 */
function nodoContador(): HTMLElement | null {
  if (vuelo.nodo && vuelo.nodo.isConnected) return vuelo.nodo;
  const nodo = document.querySelector(ID_CONTADOR) as HTMLElement | null;
  olvidarVuelo();
  vuelo.nodo = nodo;
  return nodo;
}

/**
 * Escribe el saldo, y solo si el texto cambia de verdad.
 *
 * A 60 cuadros por segundo, asignar el mismo `textContent` 60 veces es trabajo
 * de estilo y de layout tirado a la basura: por eso se recuerda lo último
 * pintado. Con un ingreso pasivo de 5/s esta comprobación es la que evita la
 * mitad de las escrituras, porque entre un dígito y el siguiente hay cuadros
 * enteros donde la cadena formateada no ha cambiado.
 */
function escribir(nodo: HTMLElement, valor: number) {
  const texto = formatNumber(valor);
  if (texto === vuelo.ultimoTexto) return;
  vuelo.ultimoTexto = texto;
  nodo.textContent = texto;
}

/** Suelta el vuelo y el rastro de arranque. Deja el contador como nuevo. */
function olvidarVuelo() {
  if (vuelo.raf) {
    try { cancelAnimationFrame(vuelo.raf); } catch { /* ya no hay cadena viva */ }
    vuelo.raf = 0;
  }
  vuelo.desde = 0;
  vuelo.hasta = NaN;
  vuelo.duracion = 0;
  vuelo.iniciado = false;
  vuelo.ultimoTexto = null;
}

/** Pinta el entero real y cierra cualquier vuelo en curso. */
function asentar(nodo: HTMLElement, valor: number) {
  if (vuelo.raf) {
    try { cancelAnimationFrame(vuelo.raf); } catch { /* ya no hay cadena viva */ }
    vuelo.raf = 0;
  }
  vuelo.desde = valor;
  vuelo.hasta = valor;
  vuelo.duracion = 0;
  escribir(nodo, valor);
}

/** Un cuadro del vuelo. Se autoprogama hasta aterrizar en el entero real. */
function cuadro(ahora: number) {
  const nodo = nodoContador();
  // La vista se desmontó en pleno vuelo: no hay a quién pintar.
  if (!nodo) { vuelo.raf = 0; return; }

  const transcurrido = ahora - vuelo.inicio;
  if (transcurrido >= vuelo.duracion) {
    // El entero real. Aquí acaba el vuelo y no queda una sola cifra inventada.
    escribir(nodo, vuelo.hasta);
    vuelo.desde = vuelo.hasta;
    vuelo.duracion = 0;
    vuelo.raf = 0;
    return;
  }

  escribir(nodo, valorEnVuelo(vuelo.desde, vuelo.hasta, transcurrido, vuelo.duracion));
  vuelo.raf = requestAnimationFrame(cuadro);
}

/**
 * Pinta el saldo de nanitas de la base. La llama `updateUI` en cada tick.
 *
 * El saldo real es el del game loop y no se toca aquí: esto solo decide el
 * camino entre un entero y el siguiente.
 */
export function pintarSaldoBase(total: number): void {
  const objetivo = Math.floor(Number.isFinite(total) ? total : 0);
  const nodo = nodoContador();

  // No hay HUD de la base montado —el render lo sustituye, R5—: no hay nada que
  // animar, y el vuelo se olvida para no reanudarlo cuando la vista vuelva.
  if (!nodo) {
    olvidarVuelo();
    return;
  }

  // Menos movimiento, no menos información (R20).
  if (pideMenosMovimiento()) {
    asentar(nodo, objetivo);
    return;
  }

  // Ya estamos en esa cifra: ni una escritura, ni un vuelo nuevo.
  if (objetivo === vuelo.hasta) return;

  // El primer pintado de un contador: salto seco. El marcado ya trae el saldo
  // (o un "0" recién montado) y rodarlo desde cero sería una mentira de partida.
  if (!vuelo.iniciado) {
    vuelo.iniciado = true;
    asentar(nodo, objetivo);
    return;
  }

  const ahora = performance.now();
  const actual = vuelo.raf
    ? valorEnVuelo(vuelo.desde, vuelo.hasta, ahora - vuelo.inicio, vuelo.duracion)
    : vuelo.desde;
  const duracion = duracionVuelo(objetivo - actual);

  // Bajadas y saltos grandes se pintan enteros. Un contador que baja rodando no
  // informa de nada, y una venta de 9.120 no puede ser un cambio de diez
  // segundos: en los dos casos, lo que se ve un instante después ya no ocurrió.
  if (duracion === 0) {
    asentar(nodo, objetivo);
    return;
  }

  // Reencaminar el vuelo que ya corre, si lo hay, es lo que da continuidad: los
  // ticks llegan cada 500 ms y el vuelo dura 500 ms, así que la cadena de cuadros
  // no se corta entre tick y tick.
  vuelo.desde = actual;
  vuelo.hasta = objetivo;
  vuelo.inicio = ahora;
  vuelo.duracion = duracion;
  if (!vuelo.raf) vuelo.raf = requestAnimationFrame(cuadro);

  escribir(nodo, actual);
}
