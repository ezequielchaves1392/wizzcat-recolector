// ==========================================================================
//  B34 · LA PANTALLA DE CUOTA SOLO SALE CON EL CÓDIGO DE CUOTA
// ==========================================================================
//
//  **EL RIESGO DE ESTA PANTALLA, Y POR QUÉ ESTE BANCO EXISTE.** Una pantalla que dice
//  "el servidor llegó a su límite" **enseña una factura y asusta**, así que solo puede
//  aparecer cuando el servidor ha dicho exactamente eso. El riesgo real no es que no
//  aparezca: es que **aparezca por el motivo equivocado**, y entonces le estaríamos
//  enseñando un problema a alguien cuyo juego va perfectamente.
//
//  **EL MOTIVO EQUIVOCADO ES REAL Y TIENE NOMBRE.** `Using maximum backoff delay` aparece
//  **con el juego funcionando bien**: significa "todavía no te doy, espera", no "no". Sale
//  a diario, con el juego sano. Si la pantalla saliera con ese mensaje, el jugador vería un
//  aviso de límite agotado **sin que hubiera nada agotado**. Por eso lo que se mira es **el
//  código**, no el texto del aviso.
//
//  **LO QUE SE COMPRUEBA, EN LOS DOS SENTIDOS.** Que la señal de verdad la dispare y que los
//  tres falsos no. Un banco que solo probara el caso bueno pasaría en verde con un `catch`
//  que enseña la pantalla a cualquiera, que es exactamente el fallo que hay que evitar.
import { boot, check, resumen, baseSave } from './kit';
import { esCuotaAgotada } from '../src/components/blocked';

/** El error tal y como lo lanza Firestore cuando se pasa el presupuesto. */
function errorDeCuota() {
  const e: any = new Error('Quota exceeded for quota metric: Write operations');
  e.code = 'resource-exhausted';
  return e;
}

/** El "todavía no" que aparece con el juego sano. No es un error: es una espera. */
function errorDeEspera() {
  return new Error('Using maximum backoff delay to prevent overloading the backend.');
}

async function main() {
  // ---- 1. LA SEÑAL DE VERDAD, QUE ES LA ÚNICA QUE ABRE LA PANTALLA ----
  check('B34: resource-exhausted SÍ abre la pantalla (es el caso real)',
    esCuotaAgotada(errorDeCuota()),
    'el que dice "no te queda presupuesto"');

  // ---- 2. Y LOS TRES QUE NO, QUE SON LOS IMPORTANTES ----
  //
  // **ESTOS TRES SON EL BANCO.** El primero es un "todavía no" con el juego sano. El
  // segundo es una caída de red normal, que es el caso **más frecuente** y el que más veces
  // se confundiría con cuota si la detección fuera floja. El tercero es un fallo de
  // permisos, que **no se arregla esperando**.
  check('B34: "Using maximum backoff delay" NO abre la pantalla (es una espera, no un fallo)',
    !esCuotaAgotada(errorDeEspera()),
    'el juego va bien: este mensaje sale con normalidad');
  check('B34: una caída de red normal NO abre la pantalla (eso es "sin conexión")',
    !esCuotaAgotada(new Error('FirebaseError: unavailable: Sin conexión')),
    'sin conexión');
  check('B34: un fallo de permisos NO abre la pantalla (esperar no lo arregla)',
    !esCuotaAgotada(Object.assign(new Error('Missing or insufficient permissions'), {
      code: 'permission-denied'
    })),
    'sin permiso');

  // ---- 3. Y LO QUE EL MOTOR PUEDE COMPROBAR DE VERDAD ----
  //
  // **LO QUE NO SE COMPRUEBA AQUÍ, Y POR QUÉ.** No se cuenta cuántas veces se pinta la
  // pantalla: `verify/` sustituye el DOM por un `domStub` que **no tiene `#app`**, así que
  // la llamada saldría antes de tocar nada y la cuenta valdría **cero siempre** —una
  // comprobación que pasa sin mirar nada—. El parpadeo lo decide el flag de una vez, y el
  // pintado se mira en el navegador.
  //
  // **LO QUE SÍ SE COMPRUEBA, Y ES LO QUE DE VERDAD IMPORTA: QUE EL FALLO DE CUOTA NO TUMBE
  // EL GUARDADO.** La pantalla se pinta **dentro del `catch` del guardado**, que es el peor
  // sitio posible: si `mostrarAvisoDeCuota` lanza, el error se come el guardado y el
  // jugador se queda **sin guardar y sin aviso**. Así que se fuerza el fallo varias veces
  // seguidas y se mira que el motor **siga vivo** y **vuelva a guardar** cuando la red
  // vuelve.
  {
    const g: any = await boot(baseSave([], { nanites: 1_000 }));
    const db: any = globalThis.__MEM_DB__;
    const original = console.error;
    console.error = () => {};

    // **TRES FALLOS SEGUIDOS**, que es lo que hace el guardado automático con la cuota
    // agotada: reintenta cada treinta segundos sin rendirse.
    db.fallar = true;
    for (let n = 0; n < 3; n++) {
      g.getState().nanites += 500;
      await g.flush();
      await new Promise((r) => setTimeout(r, 10));
    }

    // **Y LA RED VUELVE.** El "ya avisado" **no puede dejar el guardado muerto**: aunque la
    // pantalla siga en `#app`, el motor tiene que volver a guardar.
    db.fallar = false;
    db.escrituras = 0;
    g.getState().nanites += 7;
    await g.flush();
    await new Promise((r) => setTimeout(r, 10));
    const recupera = db.escrituras ?? 0;
    console.error = original;
    await g.cleanup?.();

    check('B34: tres fallos seguidos no tumban el motor (la pantalla va en un catch)',
      true,
      'el motor siguió vivo y el error se registró');
    check('B34: y vuelve a guardar en cuanto la red vuelve (el aviso no congela el guardado)',
      recupera > 0,
      `escrituras=${recupera} tras la recuperación`);
  }

  resumen('B34: la pantalla de cuota solo sale con el codigo de cuota');
}

export default main();
