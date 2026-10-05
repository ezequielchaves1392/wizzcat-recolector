// ==========================================================================
//  Preferencia: mostrar las notas de parche al entrar
// ==========================================================================
//  Vive en `localStorage` como el tema y el salto de la ruleta, y por el mismo motivo:
//  es una preferencia de VISTA por dispositivo y no progreso. Que sea por dispositivo
//  es lo correcto, porque las notas son un aviso de "ha habido cambios" y a quien lo
//  lee en el móvil no le sirve que se lo marquen como visto en el ordenador.
//
//  Y hay un detalle que no es un detalle: **la marca de "ya lo has visto" no se escribe
//  cuando el cartel está desactivado.** Si se escribiera, un jugador que desactiva las
//  notas, juega dos meses y las vuelve a activar se encontraría con que ya no le
//  aparecen nunca —habría perdido las notas sin saber que las había perdido—. Así que
//  desactivado es "no mostrar", no "marcar como visto": al reactivarlas aparece lo
//  pendiente, que es justo lo que se espera de una casilla que dice "mostrar".
//
//  La lectura coacciona (R11): cualquier valor que no sea '1' es "mostrar", y si
//  `localStorage` no está disponible se muestran las notas —que es lo que pasa por
//  defecto— en vez de perderlas en silencio.
// ==========================================================================

const KEY = 'cyberforge_patch_notes';

/** Si el jugador quiere ver las notas de parche al entrar. */
export function getPatchNotes(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

/** Guarda la preferencia del check. No lanza nunca. */
export function setPatchNotes(mostrar: boolean): void {
  try {
    localStorage.setItem(KEY, mostrar ? '1' : '0');
  } catch {
    // Sin almacenamiento no hay preferencia que guardar, y el juego sigue.
  }
}

/**
 * La última versión cuyas notas se han mostrado, o `''` si nunca.
 *
 * Es una **versión y no una fecha ni un "true"**: si el jugador desactivó las notas y las
 * vuelve a activar dentro de la misma versión, le aparecen; y si la próxima versión sale
 * mientras las tenía desactivadas, también le aparecen cuando vuelva a activarlas.
 */
export function getNotasVistas(): string {
  try {
    return localStorage.getItem(KEY + '_visto') ?? '';
  } catch {
    return '';
  }
}

/** Marca la versión como vista. No lanza nunca. */
export function setNotasVistas(version: string): void {
  try {
    localStorage.setItem(KEY + '_visto', version);
  } catch {
    // Sin almacenamiento, el cartel puede volver a salir. Es molesto y no rompe nada.
  }
}
