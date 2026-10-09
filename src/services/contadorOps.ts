// ==========================================================================
//  F96 · CONTADOR DE OPERACIONES FIRESTORE EN VIVO
// ==========================================================================
//
//  **PARA QUÉ EXISTE.** La consola de Firebase dice cuántas lecturas y
//  escrituras hubo por minuto, pero no **quién** las hizo: un pico de 27
//  lecturas puede ser una apertura del ranking, la consola abierta en otra
//  pestaña o un bug del juego, y el gráfico no distingue. Este módulo es la
//  otra mitad de la medición: cada sitio del juego que toca la red anota aquí
//  **qué** hizo y **por qué**, en memoria y sin gastar ni una operación más.
//  Medir no puede costar lecturas, porque entonces la medición mentiría.
//
//  **LO QUE NO ES.** No es telemetría: nada sale de la pestaña, nada se sube a
//  Firestore y al recargar se pierde. Es un FPS de la cuota, no un registro
//  permanente. Y no decide nada del juego: ningún `if` del motor lo lee.
//
//  **LA ÚNICA FUENTE DE LOS UMBRALES.** El overlay (`ui/opsOverlay.ts`) y el
//  banco (`verify/opsCheck.ts`) leen `colorDeRitmo()` de aquí, no copian
//  números. Un umbral escrito en dos sitios es un semáforo que dice dos cosas.
//
//  Los motivos son una unión cerrada a propósito: un motivo nuevo es un sitio
//  nuevo que toca la red, y eso se tiene que ver en este fichero.

/** Los únicos motivos por los que el juego toca la red. */
export type MotivoOps =
  | 'carga' // `getDoc` de `users/{uid}` al arrancar
  | 'guardado-users' // `setDoc` de la partida en `saveToFirebase()`
  | 'guardado-ranking' // `setDoc` de `rankings/{uid}` en el mismo guardado
  | 'tarjeta' // `setDoc` de `perfiles/{uid}` junto al ranking
  | 'tarjeta-lectura' // `getDoc` de una tarjeta pública ajena o propia
  | 'visita' // `setDoc` del contador de visitas de una tarjeta ajena
  | 'latido' // `setDoc` de `{ sesion }` en `users/{uid}`
  | 'presencia' // `setDoc` de `{ latido }` en `rankings/{uid}`
  | 'soltar-sesion' // lectura + borrado del latido al cerrar
  | 'sesion-check' // `getDoc` de `users/{uid}` para ver quién tiene la cuenta
  | 'bloqueo' // `getDoc` de `bloqueos/{uid}` al arrancar o al volver
  | 'ranking-tabla'; // `getDocs` de la tabla entera al abrir el ranking

export type TipoOp = 'lectura' | 'escritura';

export interface OpAnotada {
  t: number;
  op: TipoOp;
  coleccion: string;
  motivo: MotivoOps;
  /** Dato que ayuda a leer el pico: filas traídas, bytes escritos. */
  detalle: number;
}

// --------------------------------------------------------------------------
//  UMBRALES DEL SEMÁFORO, MEDIDOS Y NO INVENTADOS
// --------------------------------------------------------------------------
//
//  Escrituras: el idle sano con pasivo corriendo son ~4-5/min (guardado 1 +
//  ranking/tarjeta 1 + latidos ~2 + presencia). Verde hasta 6 es ese idle con
//  margen; naranja es "algo escribe de más" (serie de forja, compras); rojo
//  es ritmo de quemar cuota (12/min × 24 h ≈ 17k, al borde de los 20k con una
//  sola pestaña colgada).
//
//  Lecturas: el arranque hace ~4 y abrir el ranking hasta 40 de golpe. Una
//  ráfaga aislada de 40 es naranja (alguien mirando la tabla); repetirla es
//  rojo.
export const UMBRAL_W_VERDE = 6;
export const UMBRAL_W_ROJO = 12;
export const UMBRAL_R_VERDE = 10;
export const UMBRAL_R_ROJO = 40;

export type ColorOps = 'verde' | 'naranja' | 'rojo';

/** El color de un ritmo de escrituras (w) y lecturas (r) por minuto. */
export function colorDeRitmo(w: number, r: number): ColorOps {
  if (w > UMBRAL_W_ROJO || r > UMBRAL_R_ROJO) return 'rojo';
  if (w > UMBRAL_W_VERDE || r > UMBRAL_R_VERDE) return 'naranja';
  return 'verde';
}

/** Una línea del registro. Solo memoria: al recargar se pierde. */
const registro: OpAnotada[] = [];

/** Tope del registro, para que una sesión larguísima no crezca sin límite. */
const TOPE_REGISTRO = 3000;

export interface PicoOps {
  inicio: number;
  fin: number | null;
  maxW: number;
  motivoTop: string;
}

const picos: PicoOps[] = [];
let picoAbierto: PicoOps | null = null;

/**
 * Anota una operación. La llama el sitio que toca la red, justo después de
 * que el `setDoc`/`getDoc`/`getDocs` confirme: contar antes sería afirmar
 * una escritura que quizá no ocurrió (la misma regla que B28 con la firma).
 */
export function contarOp(
  op: TipoOp,
  coleccion: string,
  motivo: MotivoOps,
  detalle = 0
): void {
  registro.push({ t: Date.now(), op, coleccion, motivo, detalle });
  if (registro.length > TOPE_REGISTRO) registro.splice(0, registro.length - TOPE_REGISTRO);
}

/** Escrituras y lecturas de los últimos 60 segundos. */
export function ritmoUltimoMinuto(ahora = Date.now()): { escrituras: number; lecturas: number } {
  let escrituras = 0;
  let lecturas = 0;
  for (let i = registro.length - 1; i >= 0; i--) {
    if (ahora - registro[i].t > 60_000) break;
    if (registro[i].op === 'escritura') escrituras++;
    else lecturas++;
  }
  return { escrituras, lecturas };
}

/**
 * Abre, actualiza o cierra el pico en curso según el ritmo de ahora.
 *
 * Se abre al entrar en rojo y se cierra al volver a verde; el naranja no abre
 * ni cierra nada, porque una ráfaga suelta (abrir el ranking) no es un pico
 * que queme cuota. El motivo dominante se fija al cerrar, que es cuando la
 * foto está completa.
 */
export function evaluarPico(ahora = Date.now()): void {
  const { escrituras } = ritmoUltimoMinuto(ahora);
  const color = colorDeRitmo(escrituras, 0);
  if (!picoAbierto && color === 'rojo') {
    picoAbierto = { inicio: ahora, fin: null, maxW: escrituras, motivoTop: '' };
    picos.push(picoAbierto);
    if (picos.length > 20) picos.splice(0, picos.length - 20);
  } else if (picoAbierto) {
    if (escrituras > picoAbierto.maxW) picoAbierto.maxW = escrituras;
    if (color === 'verde') {
      picoAbierto.fin = ahora;
      picoAbierto.motivoTop = topMotivos(5)[0]?.motivo ?? '';
      picoAbierto = null;
    }
  }
}

/** Los últimos picos, el más reciente al final. */
export function ultimosPicos(): PicoOps[] {
  return picos.slice(-5);
}

/** Motivos ordenados por veces en los últimos N minutos. */
export function topMotivos(minutos = 5, ahora = Date.now()): Array<{ motivo: MotivoOps; n: number }> {
  const cuenta = new Map<MotivoOps, number>();
  for (let i = registro.length - 1; i >= 0; i--) {
    if (ahora - registro[i].t > minutos * 60_000) break;
    cuenta.set(registro[i].motivo, (cuenta.get(registro[i].motivo) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([motivo, n]) => ({ motivo, n }))
    .sort((a, b) => b.n - a.n);
}

/** Totales desde que arrancó la pestaña (o desde el último reinicio). */
export function totales(): { escrituras: number; lecturas: number } {
  let escrituras = 0;
  let lecturas = 0;
  for (const o of registro) {
    if (o.op === 'escritura') escrituras++;
    else lecturas++;
  }
  return { escrituras, lecturas };
}

/** Lo que enseña `window.__ops()` y el overlay expandido. */
export function resumenOps(ahora = Date.now()): {
  minuto: { escrituras: number; lecturas: number; color: ColorOps };
  top: Array<{ motivo: MotivoOps; n: number }>;
  picos: PicoOps[];
  total: { escrituras: number; lecturas: number };
} {
  const minuto = ritmoUltimoMinuto(ahora);
  return {
    minuto: { ...minuto, color: colorDeRitmo(minuto.escrituras, minuto.lecturas) },
    top: topMotivos(5, ahora).slice(0, 5),
    picos: ultimosPicos(),
    total: totales(),
  };
}

/** Vacía el registro. Solo la usan los bancos: el juego nunca olvida. */
export function reiniciarContador(): void {
  registro.length = 0;
  picos.length = 0;
  picoAbierto = null;
}
