// ==========================================================================
//  Un límite de tiempo para las esperas, y por qué el arranque lo necesitaba
// ==========================================================================
//
//  **LO QUE PASÓ.** Firestore, con la cuota agotada, no contesta con un error:
//  responde "Using maximum backoff delay", que quiere decir *todavía no, espera*. La
//  petición se queda colgada. Y el arranque del juego era una cadena de `await` sin un
//  solo reloj: `consultarSesion()` esperaba, `createGameLoop()` esperaba, y la partida
//  no se montaba nunca. El jugador se quedaba mirando un `#app` vacío **indefinidamente**,
//  sin error, sin aviso y sin nada, que es la peor de las tres formas de fallar: ni
//  siquiera hay un fallo que contar.
//
//  El aviso de error que se añadió en el mismo arreglo tampoco servía, porque solo salta
//  cuando la promesa **se rechaza**. Una promesa que no contesta no se rechaza nunca.
//
//  **QUÉ HACE ESTO.** `conTiempoLimite()` convierte "esperar para siempre" en "esperar un
//  rato y fallar". Es la diferencia entre una espera y un dato.
//
//  **POR QUÉ NO ES UNA UTILIDAD DE LA VISTA.** Los dos que la necesitan están en la
//  cadena de arranque —la comprobación de sesión y la carga de la partida—, y los dos son
//  el mismo problema: una red que no contesta. Si el límite viviera en la pantalla, cada
//  sitio que espera al servidor tendría que acordarse de ponerlo, y el cuarto que se
//  olvidara volvería a dejar la pantalla en negro.
//
//  **NO ES UN CANCELACIÓN.** La promesa original no se puede cancelar: sigue esperando,
//  y cuando conteste hará lo que tenga que hacer. El reloj solo decide cuándo *nosotros*
//  dejamos de esperar. Por eso en la carga de la partida el motor no se relanza: el
//  arranque enseña el aviso y el botón recarga la página entera, que es lo único que
//  corta de verdad la petición colgada.

/** El error que lanza `conTiempoLimite` cuando la espera se pasa de plazo. */
export class TiempoAgotadoError extends Error {
  constructor(public readonly etiqueta: string, public readonly ms: number) {
    super(`Tiempo agotado esperando a ${etiqueta} (${ms} ms)`);
    this.name = 'TiempoAgotadoError';
  }
}

/**
 * Espera `promesa`, pero como mucho `ms`.
 *
 * **NUNCA rechaza por otra cosa**: si la promesa falla, el error sale tal cual, para que
 * el `catch` de quien llama siga viendo la causa de verdad y no un "se acabó el tiempo"
 * que no ocurrió. Y **limpia el temporizador** en los dos caminos, que es lo que evita
 * que un banco de pruebas se quede esperando veinte segundos a un temporizador vivo.
 */
export function conTiempoLimite<T>(promesa: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const reloj = setTimeout(() => reject(new TiempoAgotadoError(etiqueta, ms)), ms);
    promesa.then(
      (valor) => { clearTimeout(reloj); resolve(valor); },
      (error) => { clearTimeout(reloj); reject(error); }
    );
  });
}

/** Si este error es un límite de tiempo nuestro y no un fallo del servidor. */
export function esTiempoAgotado(error: unknown): boolean {
  return error instanceof TiempoAgotadoError
    || (error as any)?.name === 'TiempoAgotadoError';
}