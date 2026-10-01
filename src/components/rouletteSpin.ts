// ==========================================================================
//  La matemática del giro de la ruleta de cajas
//
//  POR QUÉ UN FICHERO APARTE Y SIN UN SOLO IMPORT. Son números puros, y eso es
//  justo lo que los hace comprobables: `verify/rouletteCheck.ts` los monta sin
//  DOM, sin audio y sin navegador. Si vivieran dentro de `crateRoulette.ts`,
//  importar ese fichero en Node significaría arrancar Web Audio y leer
//  `window.innerWidth`, y el banco no podría existir.
//
//  LA REGLA DE ORO DE ESTE FICHERO, y el motivo de que exista: LA CURVA QUE
//  DESCRIBE EL MOVIMIENTO Y LA QUE DECIDEN LOS CHASQUIDOS SON LA MISMA. Antes
//  el chasquido iba a un intervalo constante calculado aparte
//  (`duracion / casillas`) y el resultado era que sonaba fuerte y espaciado
//  durante el tramo final, que es donde la cinta casi está quieta, y en cambio
//  callaba durante el primer segundo, que es donde la cinta vuela. El sonido
//  describía el tiempo, no el movimiento. Aquí los dos salen de la misma curva,
//  y un chasquido cae SIEMPRE en el instante en que una frontera de casilla
//  pasa por el marcador.
// ==========================================================================

/**
 * La curva del frenado: `cubic-bezier(0.425, 0.85, 0.775, 1)`.
 *
 * No es un `ease-out` elegido a ojo. Es el ajuste de la parábola `d = 2t - t²`,
 * que es el modelo de una rueda a la que se le quita la energía poco a poco:
 * velocidad constante al principio y deceleración constante hasta pararse. El
 * error medio del ajuste es de 0.0004, o sea que es indistinguible de la física
 * que imita.
 *
 * Y esto decide lo que el jugador siente. Con la curva anterior
 * (`0.16, 1, 0.3, 1`) el 90% del camino se recorría en el primer 25% del
 * tiempo, y los tres segundos que quedaban eran un arrastre sin salida: el ojo
 * abandona la tirada mucho antes de que termine y el final se lee como "esto
 * que dura tanto no está pasando nada". Frenar por física deja el último
 * segundo lleno de casillas lentas, que es la anticipación.
 *
 * El array es de cuatro números para poder interpolarlo tal cual en el
 * `cubic-bezier()` de la transición CSS. Que sea la MISMA curva en CSS y en
 * los chasquidos es la razón de ser de `instante()`.
 */
export const FRENADO: readonly [number, number, number, number] = [0.425, 0.85, 0.775, 1];

/** Vueltas de la ventana visible que da el giro. */
export const VUELTAS = 3;

/**
 * Iteraciones de bisección para invertir la curva.
 *
 * 32 bastan de sobra: cada una parte el intervalo a la mitad, así que 32
 * dejan un error de 2^-32. Con 24 ya era invisible y cuesta lo mismo.
 */
const ITERACIONES = 32;

function coordenadaX(t: number, x1: number, x2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
}

function coordenadaY(t: number, y1: number, y2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
}

/**
 * Cuánto se ha recorrido cuando ha pasado `p` del tiempo, de 0 a 1.
 *
 * La x y la y de una `cubic-bezier` no comparten fórmula, así que para pedir el
 * recorrido hay que encontrar primero el `t` cuya x es `p`. Se busca por
 * bisección y no con la fórmula cerrada de Newton porque en estos puntos de
 * control la x siempre crece: la bisección no puede fallar y son treinta
 * multiplicaciones, que a esta escala es nada.
 */
export function avance(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const [x1, y1, x2, y2] = FRENADO;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < ITERACIONES; i++) {
    const t = (lo + hi) / 2;
    if (coordenadaX(t, x1, x2) < p) lo = t;
    else hi = t;
  }
  return coordenadaY((lo + hi) / 2, y1, y2);
}

/**
 * El revés de `avance()`: qué instante del giro toca para haber recorrido `f`
 * del camino, de 0 a 1.
 *
 * Es lo que permite chasquear en el instante exacto en que una casilla
 * atraviesa el marcador. La alternativa descartada es repartir los chasquidos
 * por el tiempo (`setTimeout` cada `duracion / casillas`), que es lo que había
 * y lo que hacía que el sonido no cuadrase con lo que se veía: en el frenado un
 * intervalo constante suena a metrónomo, y además el primer tramo, que es
 * donde la cinta vuela, se quedaba sin un solo chasquido.
 */
export function instante(f: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < ITERACIONES; i++) {
    const p = (lo + hi) / 2;
    if (avance(p) < f) lo = p;
    else hi = p;
  }
  return (lo + hi) / 2;
}

/** Geometría de un giro: cuántas casillas pintar y hasta dónde llevarlas. */
export interface Giro {
  /** Cuántas casillas tiene la cinta. */
  casillas: number;
  /** Índice de la casilla ganadora. */
  winIndex: number;
  /** Píxeles que se desplaza la pista, en positivo. */
  viaje: number;
  /** Cuántas casillas caben en la ventana. */
  visibles: number;
}

/**
 * Reparte las casillas del giro y dice hasta dónde tiene que ir la pista.
 *
 * POR QUÉ LAS VUELTAS SE CUENTAN EN VENTANAS Y NO EN CASILLAS FIJAS. La
 * ventana visible mide `max-w-2xl` en escritorio y el ancho de la pantalla en
 * móvil, así que en el móvil caben cuatro casillas y en el escritorio seis. Un
 * número de vueltas constante en casillas daría en el móvil un trompo corto y
 * en el escritorio uno largo; contando ventanas visibles el trompo dura lo
 * mismo en los dos, que es lo que el jugador percibe como normal.
 *
 * POR QUÉ LA CASILLA GANADORA VA AL FINAL DE LA VUELTA. Viaja
 * `(vueltas * visibles) + visibles` casillas: tres vueltas enteras más la
 * última, para que el trompo no pare en un sitio distinto cada vez y para que
 * al frenar quede cinta por delante de la aguja. Sin eso la cinta se acaba antes
 * de tiempo y el premio se para en el aire, o se ve el borde vacío de la cinta
 * debajo del marcador.
 *
 * `viaje` va en positivo y quien mueve la pista le pone el signo: el
 * desplazamiento y la aritmética de la línea se leen mejor así.
 */
export function geometria(opts: {
  ventanaPx: number;
  pasoPx: number;
  casillaPx: number;
  vueltas?: number;
}): Giro {
  const { ventanaPx, pasoPx, casillaPx } = opts;
  const vueltas = opts.vueltas ?? VUELTAS;
  // Por debajo de tres casillas visibles no hay trompo que contar, y con una
  // ventana más estrecha que una casilla la cuenta daría cero y la cinta no
  // avanzaría. Es un suelo, no un caso real.
  const visibles = Math.max(3, Math.floor(ventanaPx / pasoPx));
  const winIndex = vueltas * visibles + visibles;
  return {
    visibles,
    winIndex,
    casillas: winIndex + visibles + 1,
    viaje: winIndex * pasoPx + casillaPx / 2 - ventanaPx / 2
  };
}

/**
 * Los instantes, en milisegundos, en que una frontera de casilla pasa por el
 * marcador. Uno por chasquido.
 *
 * La cuenta sale de la geometría y no de un reparto: la frontera de la casilla
 * `j` está bajo la aguja cuando la pista se ha desplazado
 * `j * pasoPx - ventanaPx / 2`, así que los chasquidos caen en las fronteras y
 * no en un paso por casilla medido a ojo.
 *
 * El último cruce se deja fuera a propósito (`d < viaje`): en el final el
 * chasquido sonaría encima del sonido del premio, que es un acorde, y se
 * pisarían.
 */
export function crucesDeCasilla(opts: {
  viajePx: number;
  pasoPx: number;
  ventanaPx: number;
  duracionMs: number;
}): number[] {
  const { viajePx, pasoPx, ventanaPx, duracionMs } = opts;
  if (viajePx <= 0 || pasoPx <= 0 || duracionMs <= 0) return [];
  const primera = Math.ceil((ventanaPx / 2) / pasoPx);
  const ultima = Math.floor((viajePx + ventanaPx / 2) / pasoPx);
  const cruces: number[] = [];
  for (let j = primera; j <= ultima; j++) {
    const d = j * pasoPx - ventanaPx / 2;
    if (d <= 0 || d >= viajePx) continue;
    cruces.push(Math.round(instante(d / viajePx) * duracionMs));
  }
  return cruces;
}