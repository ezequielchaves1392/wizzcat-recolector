// ==========================================================================
//  B28 · CUÁNTAS ESCRITURAS CUESTA UN MINUTO DE JUEGO
// ==========================================================================
//
//  **LO QUE PASÓ:** la cuota de Firestore (20.000 escrituras al día, de todo el
//  proyecto) se agotó y vino la lectura a medias de B27. Ese es el síntoma. La causa
//  raíz es el ritmo de escritura, y aquí se mide en vez de estimarse.
//
//  **POR QUÉ NO SE CALCULA CON LOS INTERVALOS.** El juego tiene varios relojes
//  escribiendo a la vez —el guardado, el latido de sesión, la presencia, el ranking y
//  la tarjeta pública— y cada uno con su periodo. Multiplicarlos da un número
//  *plausible* y no necesariamente cierto: el latido anota **dos** documentos, la
//  presencia va a un ritmo distinto del latido que la dispara, y cada compra guarda
//  en el acto. Un cálculo así puede fallar por un factor de dos y seguir con aspecto
//  de cifra exacta. Lo que se mide es lo que el stub ha visto de verdad.
//
//  **LA PREGUNTA QUE RESPONDE, Y ES LA QUE MANDA:** un minuto de juego sin tocar nada
//  (solo mirando) cuesta cuántas escrituras, **y cuántas son de las que se pueden
//  quitar sin perder nada**. Porque hay dos clases:
//    · las que **guardan progreso** —el saldo, el almacén— y no se pueden quitar;
//    · las que **comprueban que el jugador sigue ahí** —el latido, la presencia— y son
//      las que se pueden periodicityir sin que nadie pierda una sola nanita.
//
//  El latido de sesión es la segunda clase por definición: si nadie mira la partida,
//  no hay nada que perder. Y a la vez es el que más veces salta: se anota cada
//  `VENTANA_MS / 2` porque el reloj del navegador se congela en segundo plano, así que
//  hay que refrescarlo más a menudo de lo que la ventana necesita.
// ==========================================================================

import { boot, bootNew, check, resumen, baseSave } from './kit';

/**
 * Un fallo de red es ruido esperado, y el banco imprime cada `console.error`
 * con el nombre de la comprobación al lado. Cinco reintentos seguidos de un `setDoc`
 * que falla imprimen cinco líneas que no son un fallo de nada: lo que se está probando
 * es justo que fallen. Se apagan solo mientras dura la acción.
 */
async function silenciar<T>(accion: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  return accion().finally(() => { console.error = original; });
}

async function main() {
  // ---- 1. El arranque: cuánto se gasta antes de que el jugador toque nada ----
  {
    // **`__MEM_DB__` SE LEE DESPUÉS DE `boot()`, Y POR QUÉ.** `boot()` limpia la base
    // entera y la sustituye por un objeto NUEVO (`globalThis.__MEM_DB__ = {}`), así que
    // una referencia guardada antes apunta al objeto viejo y cuenta cero siempre. La
    // primera versión de este banco la guardaba antes, y fallaba con `escrituras=0` en
    // todo: el contador no estaba mal, se estaba mirando otro objeto.
    const g = await bootNew();
    const arranque = (globalThis.__MEM_DB__ as any)?.escrituras ?? 0;
    check('B28: el arranque escribe algo, y se puede mirar',
      arranque > 0, `escrituras=${arranque}`);
  }

  // ---- 2. Lo que cuesta una compra, que es lo que no se puede quitar ----
  {
    const g: any = await boot(baseSave([], { nanites: 1_000_000 }));
    const antes = (globalThis.__MEM_DB__ as any)?.escrituras ?? 0;
    // Una compra real, por la vía real del motor.
    g.buyStoreItem?.('crateT1', 1);
    const compra = ((globalThis.__MEM_DB__ as any)?.escrituras ?? 0) - antes;
    check('B28: comprar escribe, y se puede mirar',
      compra > 0, `escrituras=${compra}`);
  }

  // ---- 3. Y el caso que NO se puede medir aquí: el latido y la presencia ----
  // Los dos relojes viven en `main.ts` (el arranque) y en `sessionService`, no en el
  // game loop, así que un banco del motor no los dispara. Y su periodo está escrito en
  // el código, no en una tabla: por eso lo que se afirma es la RELACIÓN, que es la que
  // se puede comprobar leyendo las dos mitades, no la suma.
  //
  // `main.ts`: `setInterval(() => anotarLatido(uid, miId), Math.floor(VENTANA_MS / 2))`
  // `sessionService`: `anotarLatido` hace un `setDoc` en `users/` y otro en `rankings/`
  // (la presencia), cada uno con su propio ritmo.
  //
  // **Lo que se afirma aquí es que el motor NO escribe por su cuenta al ritmo del
  // latido**, o sea: que abrir el bucle sin jugar no genera escrituras por su cuenta.
  // Si ese día el latido se metiera dentro del motor, esta comprobación se pondría roja
  // yiro el motivo: porque significaría que cada tick está mirando la red.
  {
    const db: any = globalThis.__MEM_DB__;
    const g: any = await boot(baseSave([]));
    const antes = db.escrituras ?? 0;
    // Diez vueltas del tick, sin ninguna acción del jugador.
    for (let i = 0; i < 10; i++) (g as any).tick?.();
    const trasTick = (db.escrituras ?? 0) - antes;
    check('B28: el tick del juego NO escribe en la nube (escribiría en cada medio segundo)',
      trasTick === 0, `escrituras=${trasTick}`);
  }

  // ---- 4. Y LA INVARIANTE ENTERA: sin progreso, no se escribe ----
  {
    // Cuatro guardados seguidos sin que el jugador haga nada. **La partida es idéntica**,
    // así que ninguno cuesta una escritura. La vía es `flush()`, que es la que usa
    // `guardadoCheck`: `saveToFirebase` no está en la API y llamarla con `?.` no hace
    // nada —una prueba que no llama a lo que cree que está llamando pasa en verde
    // siempre—.
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    const db: any = globalThis.__MEM_DB__;
    db.escrituras = 0;
    for (let n = 0; n < 4; n++) {
      await g.flush();
      await new Promise((r) => setTimeout(r, 0));
    }
    const sinCambio = db.escrituras ?? 0;
    check('B28: cuatro guardados sin progreso NO cuestan ni una escritura',
      sinCambio === 0, `escrituras=${sinCambio}`);
  }

  // ---- 5. Y LA CONTRAPARTE, QUE ES LA QUE HACE QUE ESTO SEA SEGURO ----
  {
    // **Si esto falla, la guarda es un invento que pierde dinero.** El ingreso pasivo
    // sube `nanites` por su cuenta: si un guardado se saltara porque la firma no
    // cambió, el ingreso se perdería sin que nadie lo notara hasta recargar.
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    const db: any = globalThis.__MEM_DB__;
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    db.escrituras = 0;
    // El pasivo se cobra solo y mueve el saldo: eso es progreso de verdad.
    g.getState().nanites += 1234;
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    const conProgreso = db.escrituras ?? 0;
    check('B28: si el saldo se mueve, SI se escribe (si no, el pasivo se pierde)',
      conProgreso > 0, `escrituras=${conProgreso}`);
  }

  // ---- 6. Y un clic, que es el otro reloj que mueve la firma solo ----
  {
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    const db: any = globalThis.__MEM_DB__;
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    db.escrituras = 0;
    g.click?.();
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    const conClick = db.escrituras ?? 0;
    check('B28: y un clic tambien cuenta como progreso',
      conClick > 0, `escrituras=${conClick}`);
  }

  // ---- 7. Y LA MITAD QUE DE VERDAD CUESTA: CUÁNTA AHORRA ----
  {
    // El caso que quemaba la cuota: una pestaña abierta **mirando**, sin tocar nada.
    // Con el temporizador de 30 s, una hora son 120 escrituras de la nada. Con la firma,
    // son cero. Y el número de la derecha es el que se puede decir en voz alta.
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    const db: any = globalThis.__MEM_DB__;
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    db.escrituras = 0;
    // 120 guardados = una hora con el temporizador de 30 segundos.
    for (let n = 0; n < 120; n++) {
      await g.flush();
    }
    const horaMirando = db.escrituras ?? 0;
    check('B28: una HORA mirando la partida sin tocar nada cuesta cero escrituras',
      horaMirando === 0, `escrituras=${horaMirando} de 120 guardados`);
  }

  // ---- 8. Y EL ORDEN, QUE ES EL QUE CASI SE ESCAPA ----
  //
  // **ESTE CASO ES EL PELIGROSO, Y POR QUÉ NO SE VE MIRANDO EL CÓDIGO.** La pregunta
  // "¿ha cambiado algo?" se hace justo antes del `setDoc`, y lo natural es responder
  // "pues apunto la firma y tiro". Con la red en su sitio **da igual**, porque da lo
  // mismo. Con la red caída es un agujero:
  //
  //   1. Se escribe la firma → `setDoc` **lanza** → la firma **ya estaba puesta**.
  //   2. Vuelve la red. Quince segundos después el reintento —que existe exactamente
  //      para esto— mira el documento, ve que es **idéntico a la firma** y **se salta**.
  //   3. La partida se queda sin guardar, y el reintento **no vuelve a intentarlo**
  //      hasta que el jugador mueva algo. El aviso de "sin guardar" está encendido, y
  //      apagar el aviso es lo único que haría que se guardara.
  //
  // O sea: **firmar antes de escribir es afirmar que algo está en el servidor cuando no
  // lo está.** Y el ahorro de cuota se comería al jugador sin que nadie lo viera, que es
  // justo la clase de fallo que B28 vino a evitar.
  {
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    const db: any = globalThis.__MEM_DB__;
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));

    // Se cae la red, y el jugador juega de verdad: el saldo se mueve.
    db.fallar = true;
    g.getState().nanites += 777;
    await silenciar(async () => {
      await g.flush();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Vuelve la red. El reintento llega **sin que el jugador haya vuelto a tocar nada**,
    // que es el caso entero: el documento es el mismo que el del intento fallido.
    db.fallar = false;
    db.escrituras = 0;
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    const reintento = db.escrituras ?? 0;
    check('B28: un guardado que FALLO se vuelve a intentar cuando vuelve la red',
      reintento > 0, `escrituras=${reintento} en el reintento sin cambios`);
  }

  // ---- 9. Y LO QUE PASA AL REVÉS, QUE ES LO IMPORTANTE ----
  //
  // Mientras la red siga caída, **se reintenta en cada pasada del temporizador**, y eso
  // es lo correcto y no un descuido: la firma solo se pone cuando el `setDoc` ha
  // terminado bien, así que un documento que falló **no está en el servidor** y hay que
  // volver a intentarlo. Un guardado que se saltara porque "ya se intentó" dejaría la
  // partida sin subir **para siempre** con la partida cerrada y sin red.
  //
  // La primera versión de esta comprobación afirmaba lo contrario —"no se insiste"— y
  // falló con `intentos=5 de 5`, que era la verdad. Se conserva el número porque es
  // justo lo que hay que leer: cinco pasadas del temporizador, cinco intentos, ninguno
  // gratis. La red caída se paga a cada intento, y la única forma de pagar menos es
  // **que el jugador juegue menos rato en una pestaña sin conexión**, no que el juego
  // se rinda antes.
  {
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    const db: any = globalThis.__MEM_DB__;
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));

    // **EL PRIMERO SÍ FALLA, Y POR ESO HAY QUE MOVER EL SALDO ANTES.** Sin cambio, el
    // guardado se salta **antes de tocar la red** —no falla: no llega a intentarlo— y
    // daría cero, que no dice nada del reintento. La primera versión de esta comprobación
    // caía justo ahí y pasaba por el motivo equivocado. Con el saldo movido, el
    // `setDoc` se intenta y revienta, que es lo que hay que medir.
    db.fallar = true;
    g.getState().nanites += 31;
    db.escrituras = 0;
    await silenciar(async () => {
      await g.flush();
      await new Promise((r) => setTimeout(r, 0));
    });
    const primero = db.escrituras ?? 0;

    // Y ahora los cuatro siguientes, **sin que el jugador mueva nada**: el temporizador
    // de treinta segundos pasando cuatro veces con la red aún caída.
    for (let n = 0; n < 4; n++) {
      await silenciar(async () => {
        await g.flush();
        await new Promise((r) => setTimeout(r, 0));
      });
    }
    const intentos = db.escrituras ?? 0;
    check('B28: sin red se sigue intentando, porque el documento NO esta en el servidor',
      primero === 1 && intentos === 5,
      `intentos=${intentos} de 5 (el primero=${primero})`);
    db.fallar = false;

    // Y el remate: una vez escrita, **ahí sí** se calla. Sin esto, el reintento eterno
    // de arriba sería también un reintento eterno con la red en su sitio.
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    db.escrituras = 0;
    for (let n = 0; n < 5; n++) {
      await g.flush();
      await new Promise((r) => setTimeout(r, 0));
    }
    check('B28: y en cuanto se escribe una vez, se calla (si no, seria eterno)',
      (db.escrituras ?? 0) === 0,
      `escrituras=${db.escrituras ?? 0} de 5 con la red ya vuelta`);
  }

  resumen('B28: lo que cuesta jugar, contado y no estimado');
}

export default main();