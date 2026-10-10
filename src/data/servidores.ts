// ==========================================================================
//  El servidor en el que se juega, y por qué vive aquí y no en `firebase.ts`.
//
//  La app habla con UN backend por carga —`chronos-tap` (servidor 1, el de
//  siempre) o `pet-project-aef10` (servidor 2, jugadores nuevos)— y la
//  elección es del jugador, en la primera pantalla, ANTES del acceso. Pero la
//  regla de QUÉ vale como elección no puede vivir en la vista: una vista que
//  decide con `location.search` a mano y un `firebase.ts` que decide con
//  `localStorage` a mano son dos copias de la misma pregunta, y es así como
//  dos caminos acaban diciendo servidores distintos.
//
//  Así que aquí vive la decisión entera, en funciones puras y sin globales:
//  `resolverServidor()` dice qué servidor toca con lo que le llega, y quien
//  lee el navegador (`firebase.ts` al arrancar, `main.ts` al pintar) solo le
//  pasa lo que ha leído. Lo que se puede comprobar sin navegador se comprueba
//  en `servidorCheck`, y lo que es pintado se mira en `auth-preview.html`.
//
//  EL ORDEN, Y POR QUÉ ES ESTE. El enlace (`?servidor=2`) manda sobre lo
//  guardado, y lo guardado manda sobre el valor de serie: un enlace es una
//  decisión de ahora mismo —alguien te está mandando a un servidor—, lo
//  guardado es tu decisión de ayer, y la serie es no haber decidido nunca.
//  Cualquier otro orden haría que un enlace no cambiara nada o que volver
//  mañana te moviera de servidor sin avisarte, y las dos son formas de
//  perder la partida de vista.
// ==========================================================================

/** Los dos backends entre los que el jugador elige. No hay tercero. */
export type ServidorId = '1' | '2';

/** Dónde se guarda la elección, para no preguntarla en cada visita. */
export const CLAVE_SERVIDOR = 'cyberforge_servidor';

/** Lo que vale como elección, y nada más. Un `3`, un `0` o un texto no son un servidor. */
export function esServidor(v: unknown): v is ServidorId {
  return v === '1' || v === '2';
}

/**
 * Lee el enlace (`?servidor=2`). Devuelve el servidor pedido o nada.
 *
 * Recibe la cadena ya extraída (`location.search` en el juego) y no la lee
 * sola, porque leer globales no se puede comprobar sin navegador y esta
 * regla sí se comprueba.
 */
export function leerParametroServidor(search: string): ServidorId | null {
  const m = /(?:^|[?&])servidor=([^&]*)/.exec(search || '');
  const pedido = m ? decodeURIComponent(m[1]).trim() : '';
  return esServidor(pedido) ? pedido : null;
}

/**
 * QUÉ SERVIDOR TOCA, con las tres fuentes en orden.
 *
 * `param` es lo que vino en el enlace, `guardado` lo que se eligió otro día
 * y `porDefecto` lo que trae el build (`VITE_FIREBASE_SERVIDOR`, o el 1 si
 * nadie pidió nada). Lo primero que valga como servidor gana; si nada vale,
 * toca el valor de serie, que siempre vale.
 */
export function resolverServidor(
  param: ServidorId | null,
  guardado: unknown,
  porDefecto: ServidorId
): ServidorId {
  if (esServidor(param)) return param;
  if (esServidor(guardado)) return guardado;
  return porDefecto;
}

/**
 * La clave de un dato local, separada por servidor.
 *
 * El nombre de operativo recordado y la contraseña recordada se guardan en el
 * navegador, y una misma persona puede tener cuenta en los dos servidores con
 * contraseñas distintas: sin sufijo, entrar al segundo probaría la
 * contraseña del primero y el jugador leería "incorrectos" sin haberse
 * equivocado. Cada servidor tiene sus recuerdos.
 */
export function claveServidor(base: string, servidor: ServidorId): string {
  return `${base}:s${servidor}`;
}

// ==========================================================================
//  Lo de abajo toca el navegador y no se comprueba con banco: son tres
//  líneas con `try/catch` cada una. La decisión (qué vale y en qué orden)
//  es lo de arriba, y esa sí se comprueba en `servidorCheck`.
// ==========================================================================

/** Lo elegido otro día, o nada si nunca se eligió o no se puede leer. */
export function leerServidorGuardado(): ServidorId | null {
  try {
    const v = localStorage.getItem(CLAVE_SERVIDOR);
    return esServidor(v) ? v : null;
  } catch {
    return null;
  }
}

/** Hay elección guardada: el arranque puede seguir al acceso sin preguntar. */
export function hayServidorElegido(): boolean {
  return leerServidorGuardado() !== null;
}

/** Guarda la elección. No lanza nunca: no guardar no puede impedir jugar. */
export function guardarServidor(servidor: ServidorId): void {
  try {
    localStorage.setItem(CLAVE_SERVIDOR, servidor);
  } catch { /* modo privado: esta visita juega igual, la próxima pregunta */ }
}

/** Olvida la elección. Es el "cambiar de servidor" del acceso y los carteles. */
export function olvidarServidor(): void {
  try {
    localStorage.removeItem(CLAVE_SERVIDOR);
  } catch { /* sin nada que borrar no hay nada que olvidar */ }
}
