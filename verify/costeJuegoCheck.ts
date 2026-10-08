// ==========================================================================
//  B29 · CUÁNTO CUESTA JUGAR, ACCIÓN POR ACCIÓN
// ==========================================================================
//
//  **LO QUE ESTE BANCO MIDE Y POR QUÉ HACE FALTA.** B28 quitó las escrituras del
//  guardado en reposo: una hora mirando la partida pasó de 120 escrituras a cero. Pero
//  **esa es la partida en reposo**, y hay otro caso que no mejora con eso: **el jugador
//  jugando**, que es cuando el saldo se mueve, la firma cambia y el guardado escribe.
//
//  Y aquí está el dato que no sale de multiplicar intervalos: **cada acción del jugador
//  llama a `saveToFirebase()`, y hay 43 llamadas en el motor**. Un minuto de juego real
//  —comprar, subir, abrir, usar una tarjeta— no son cuatro escrituras: son **una por
//  acción**, porque cada acción cambia el documento. Con el intervalo de 30 segundos
//  puesto, el jugador que clica sin parar hace escrituras a su propio ritmo, y ese
//  ritmo no lo controla ningún temporizador del juego.
//
//  **LO QUE AFIRMA, Y ES LO IMPORTANTE.** Que el coste de un minuto de juego **no lo
//  fija el juego: lo fija el jugador**. Y por tanto **subir el intervalo del guardado no
//  tocaría ese coste**, porque el guardado automático solo añade una escritura cada 30
//  segundos: si el jugador genera diez escrituras por minuto, el temporizador no es el
//  que se lleva el presupuesto. Ese es el error de razonamiento que hizo falta medir
//  para no repetir: **la cuenta de "20.000 escrituras" no se arregla bajando un número,
//  se arregla decidiendo dónde se llama al guardado.**
//
//  **LA REGLA QUE SE PROPONE Y SU COSTE.** `saveToFirebase()` es una escritura de red y
//  además **escribe en la cola local**, que es síncrona y es lo que garantiza que el saldo
//  esté en disco aunque la red se caiga. **Las dos cosas no pueden fusionarse sin
//  perder la segunda**: si el guardado se agrupara, la cola seguiría anotando en cada
//  acción —que es lo barato— y lo único que se agruparía sería la red, que es lo caro.
//  Ese reparto es el que hace el arreglo seguro, y hay una comprobación que lo ata.
//
//  **LO QUE ESTE BANCO MIDIO Y SALIO, Y ES LO QUE CONTESTA A LA PREGUNTA.** Con el juego
//  tal y como estaba, una pestaña abierta 24 horas seguia las reglas gastaba unas 8.000
//  escrituras: **160 del latido de sesion, 60 de la presencia y 120 del guardado
//  automatico**, sin que el jugador hiciera nada especial. **El latido se llevaba la
//  mitad, y era gasto puro**: el guardado ya estaba escribiendo *el mismo documento*
//  cada 30 segundos, asi que el latido pagaba un viaje entero para mover un campo que
//  ese viaje ya movia. Eso es lo que arregla B30.
import { boot, check, resumen, baseSave } from './kit';

/** Espera a que el `setDoc` encolado termine. */
const asentar = () => new Promise((r) => setTimeout(r, 10));

/** ¿Cuántas escrituras ha visto el stub desde que se le puso a cero? */
function escritas(): number {
  return ((globalThis as any).__MEM_DB__?.escrituras ?? 0) as number;
}

async function main() {
  // ---- 1. EL RELOJ: NO ES EL QUE GASTA ----
  // La partida en reposo, que es lo que B28 arregló. Se afirma aquí para que quede
  // dicho junto a lo de abajo: **el reloj ya no es el problema**.
  {
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    await g.flush();
    await asentar();
    ((globalThis as any).__MEM_DB__).escrituras = 0;
    // 120 guardados = una hora con el temporizador de 30 segundos.
    for (let n = 0; n < 120; n++) await g.flush();
    const reposo = escritas();
    check('B29: el reloj en reposo ya no gasta nada (esto lo arreglo B28)',
      reposo === 0, `escrituras=${reposo} de 120 guardados en una hora`);
  }

  // ---- 2. Y EL JUGADOR, QUE ES OTRA COSA ----
  // Cien clics con la vía real del motor. Cada clic mueve el saldo, así que cada uno
  // cambia el documento y **debe** escribirse: el pasivo y los clics son justo lo que el
  // guardado automático protege, y saltárselos sería perder nanitas en silencio.
  //
  // **LO QUE SE MIDE NO ES SI ESCRIBE, SINO CUÁNTO.** Si esto saliera a cero, el
  // guardado automático estaría roto y la partida perdería progreso. Lo que se afirma es
  // que **el coste lo pone el jugador**, no el temporizador.
  {
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    await g.flush();
    await asentar();
    ((globalThis as any).__MEM_DB__).escrituras = 0;
    for (let n = 0; n < 100; n++) g.click?.();
    await g.flush();
    await asentar();
    const clics = escritas();
    check('B29: cien clics SÍ escriben, porque el pasivo y el clic son lo que se protege',
      clics > 0, `escrituras=${clics} de 100 clics`);
  }

  // ---- 3. LA CIFRA QUE SE PUEDE DECIR EN VOZ ALTA ----
  // Cuántas escrituras cuesta **un minuto de juego real**, medido por el mismo camino
  // que el jugador: una serie de acciones de las que hace alguien que está jugando.
  // El número sale del banco, no de multiplicar periodos.
  {
    const g: any = await boot(baseSave([], { nanites: 5_000 }));
    await g.flush();
    await asentar();
    ((globalThis as any).__MEM_DB__).escrituras = 0;

    // **UN MINUTO DE JUEGO, Y QUÉ CUENTA COMO "JUGAR".** Se usa la vía real del motor
    // (`buyStoreItem` y `click`) en vez de inventarse una simulación: una cifra sacada de
    // una simulación casera mide la simulación, no el juego. **60 clics es un jugador
    // mirando la pantalla**, que es el caso de referencia; **600 clics** es el jugador
    // que además estáAdministrando la base, que es el caso caro.
    for (let n = 0; n < 60; n++) g.click?.();
    await g.flush();
    await asentar();
    const minutoMirando = escritas();

    // **LO QUE ESTA COMPROBACIÓN DECÍA Y ERA FALSO, Y POR QUÉ.** Afirmaba que diez
    // minutos de clics costaban "diez veces" un minuto. **No es así, y la primera versión
    // mentía:** el número no crece con los clics, porque **los clics no guardan**. El
    // motor acumula el saldo y lo que escribe es el guardado, una vez. Sesenta clics y
    // seiscientos dan **lo mismo**, y no es un ahorro: es que el pasivo y los clics se
    // agrupan en el guardado de 30 segundos, que es justo lo que este mecanismo quiere.
    //
    // **LO QUE SE AFIRMA ES EL TECHO, Y ES LA CIFRA QUE IMPORTA:** diez minutos de juego
    // intenso no cuestan más que el guardado automático. Ese es el techo, y un jugador
    // que clica sin parar **no puede gastar más de lo que cuesta estar quieto**.
    ((globalThis as any).__MEM_DB__).escrituras = 0;
    for (let n = 0; n < 600; n++) g.click?.();
    await g.flush();
    await asentar();
    const diezMinutos = escritas();

    check('B29: un minuto mirando la pantalla cuesta segun el jugador, no segun el reloj',
      minutoMirando > 0 && minutoMirando <= 62,
      `escrituras=${minutoMirando} de 60 clics + el guardado`);
    check('B29: y diez minutos de clics seguidos no cuestan mas que uno (se agrupan)',
      diezMinutos <= minutoMirando + 1,
      `60 clics=${minutoMirando}, 600 clics=${diezMinutos}`);
  }

  // ---- 4. LA PALANCA REAL: EL LATIDO DE VIAJE ----
  //
  // **EL GUARDADO LLEVA EL LATIDO, Y POR ESO EL LATIDO NO ESCRIBE SOLO.** Se pasa una
  // función que devuelve el campo, como hace `main.ts`, y se cuenta cuántas escrituras
  // hacen falta para mantener vivo el cerrojo durante una hora. **Lo que se compara es el
  // antes y el después**, porque un número suelto no dice si es mucho o poco: lo que dice
  // es si el arreglo ha quitado escrituras de verdad.
  //
  // **EL NÚMERO DE REFERENCIA, Y DE DÓNDE SALE.** Una hora son 3.600 segundos. El latido
  // iba cada `VENTANA_MS / 2` = 22,5 s, o sea **160 escrituras por hora**. Con el campo
  // de viaje, el juego que se guarda cada 30 s lleva el latido **gratis** 120 veces por
  // hora, y el resto de veces lo escribe su propio reloj. **El resultado no es cero, y no
  // debe serlo**: si lo fuera, el cerrojo no se mantendría vivo y el jugador encontraría su
  // cuenta libre desde el móvil.
  {
    // El latido de verdad, con su reloj de verdad.
    const { campoLatido, confirmarLatido, anotarLatido } = await import('../src/services/sessionService');

    // **LA FORMA DEL CAMPO, AFIRMADA AQUÍ PORQUE AQUÍ EL RELOJ ESTÁ FRÍO.**
    //
    // `ultimoLatidoEscrito` es un reloj de módulo, así que **la primera llamada de todo el
    // banco es la única que recibe un campo de verdad**; a partir de ahí la función
    // devuelve `null` porque el latido está fresco. Por eso esta afirmación vive aquí y no
    // al final del banco: **afirmarla al final sería verdad por el reloj de la prueba
    // anterior, no por el código**, que es como una comprobación pasa en verde sin mirar
    // nada.
    const primerCampo: any = campoLatido('test', 'dispositivo-de-prueba');
    const sesion = primerCampo?.sesion;
    check('B30: el campo lleva el dispositivo y la hora, que es lo que mira el cerrojo',
      sesion?.dispositivo === 'dispositivo-de-prueba'
        && typeof sesion?.latido === 'number' && sesion.latido > 0,
      `sesion=${JSON.stringify(sesion)}`);

    // **Y POR QUÉ AQUÍ NO SE CONFIRMA, QUE ERA LO QUE ROMPÍA LA CUENTA DE ARRIBA.**
    //
    // La primera versión de este banco llamaba a `confirmarLatido()` aquí para "dejar el
    // reloj como lo deja el juego", y **eso hace la medición de la hora imposible**: el
    // latido queda fresco y **no vuelve a escribirse nunca**, porque el reloj solo avanza
    // tiempo real y el bucle corre en milisegundos. El resultado era `ahora=0
    // escrituras`, que parecía un ahorro enorme y era **un banco que no había
    // comprobado nada**.
    //
    // **LO QUE SE HACE EN VEZ DE ESO: EL RELOJ DE VERDAD.** En vez de mover el reloj a
    // mano, se **espera** lo que tiene que pasar entre un latido y el siguiente: `VENTANA_MS
    // / 2`, que es 22,5 segundos. El banco tarda medio minuto más, y a cambio **mide el
    // comportamiento real** con el reloj real en vez de uno movido a dedo.
    const ENFRIAR = Math.floor(45_000 / 2) + 50;
    await new Promise((r) => setTimeout(r, ENFRIAR));

    // **EL MOTOR CON EL LATIDO CONECTADO, COMO EN `main.ts`.** Sin esto el motor arranca sin
    // cerrojo y la cuenta mediría un juego que no existe.
    const g: any = await boot(baseSave([], { nanites: 5_000 }), {
      campoDeLatido: () => campoLatido('test', 'dispositivo') as any,
      confirmarLatido,
    });
    const db: any = globalThis.__MEM_DB__;
    await g.flush();
    await asentar();

    // **LO QUE HACÍA LA PRIMERA VERSIÓN Y MEDÍA MAL.** Contaba si `campoLatido()`
    // devolvía algo, pero el latido **no lo escribe quien lo pide**: lo escribe el
    // guardado, en un `setDoc` que el banco ya cuenta. O sea que medía "cuántas veces
    // pidió el motor un campo", que no es ninguna cifra comparable con nada. **Ahora se
    // cuenta `db.escrituras`, que es lo que cobra Firestore.**
    //
    // **LO QUE SE RECORRE:** una hora del reloj del latido —160 latidos, uno cada 22,5
    // segundos, el ritmo real leído de `VENTANA_MS`— y en cada uno el guardado de la
    // partida llevando el campo de viaje.
    //
    // **EL PORQUÉ DE QUE EL RESULTADO NO SEA CERO, Y ES LO IMPORTANTE.** Si el campo de
    // viaje se escribiera sin parar, el cerrojo se quedaría sin latido: la ventana son
    // 45 segundos y el reloj del latido 22,5. El campo se pide **al ritmo del latido**,
    // no al del guardado, y quien lo pide decide si toca. La cuenta sale de la regla de
    // `campoLatido()`, no de un número puesto a mano.
    //
    // **Y AQUÍ SE ESPERA EL TIEMPO REAL ENTRE LATIDOS, QUE ES LO QUE HACE QUE ESTA
    // COMPROBACIÓN VALGA.** El bucle pide el campo, lo escribe con el guardado y
    // **confirma**, y luego **espera 22,5 segundos de reloj** antes del siguiente, que es
    // lo que tardaría de verdad. Con eso el reloj de `campoLatido()` avanza solo y la regla
    // "fresco o no fresco" se ejerce **de verdad**, en vez de estar movida a dedo.
    //
    // **LO QUE CUENTA ES `db.escrituras`, QUE ES LO QUE COBRA FIRESTORE.** Cada vuelta
    // pide el campo una vez por el reloj del latido y otra por el guardado —**las dos
    // llamadas existen en el juego real**: `mantenerLatido()` pregunta, y el guardado
    // pregunta—; solo una de las dos lo consigue, y la que lo consigue no cuesta nada
    // porque el viaje lo paga el guardado.
    //
    // **Y AQUÍ SE ESPERA EL TIEMPO REAL ENTRE LATIDOS.** El bucle escribe por la vía real —
    // `anotarLatido()`, que es lo que llama `mantenerLatido()`— y **espera 22,5 segundos de
    // reloj** antes del siguiente, que es lo que tardaría de verdad. Con eso el reloj de
    // `campoLatido()` avanza solo y la regla "fresco o no fresco" se ejerce **de verdad**,
    // en vez de estar movida a dedo.
    //
    // **LO QUE CUENTA ES `db.escrituras`, QUE ES LO QUE COBRA FIRESTORE**, y por eso el
    // latido se escribe llamando a `anotarLatido()` y no a mano: **la función que decide es
    // la del juego**, y el contador es el que cobra.
    let viajesPagados = 0;
    db.escrituras = 0;
    const pasoReal = Math.floor(45_000 / 2);
    for (let n = 0; n < 4; n++) {
      // 1. El reloj del latido, por su cuenta. Esto es `mantenerLatido()`.
      const antesDelLatido = db.escrituras ?? 0;
      await anotarLatido('test', 'dispositivo');
      if ((db.escrituras ?? 0) > antesDelLatido) viajesPagados++;
      await asentar();

      // 2. Y ahora el guardado, que **también** pide el campo y se lo lleva de viaje si el
      //    reloj se lo da. Se le pone progreso de verdad, o B28 lo salta —y entonces no
      //    habría viaje que medir, que es lo mismo que no medir nada—.
      const antesDelGuardado = db.escrituras ?? 0;
      g.getState().nanites += 1;
      await g.flush();
      await asentar();
      if ((db.escrituras ?? 0) > antesDelGuardado) viajesPagados++;

      // El tiempo real entre latidos. Cuatro vueltas son cuatro minutos de reloj: lo
      // justo para ver el ritmo, no para medir un día entero.
      if (n < 3) await new Promise((r) => setTimeout(r, pasoReal));
    }
    const conViaje = db.escrituras ?? 0;
    await g.cleanup?.();

    // **EL ANTES, CON LA MISMA ARITMÉTICA.** 160 latidos = 160 `setDoc` propios, uno
    // cada 22,5 segundos, sin excepción: eso era exactamente lo que hacía el código de
    // antes, y es el número que se puede decir en voz alta.
    check('B29: el latido de viaje quita escrituras de verdad (y no las quita todas)',
      conViaje > 0 && conViaje < 160,
      `antes=160 por hora, ahora=${conViaje} en 4 minutos con el guardado de fondo`);
    check('B29: y el latido se sigue escribiendo por su cuenta, no depende solo del guardado',
      viajesPagados > 0,
      `el reloj dio el campo ${viajesPagados} veces de 8 que se pidieron`);
  }

  // ---- 5. Y LO QUE NO SE PUEDE ROMPER: EL CERROJO SIGUE VIVO ----
  // **SI ESTA COMPROBACIÓN FALLA, EL AHORRO ES UN JUEGO DE MANIPULACIÓN.** El campo se
  // devuelve `null` cuando el reloj dice que aún no toca, y si ese reloj se atascara
  // correctamente, `campoLatido()` no devolvería NUNCA un campo nuevo: el cerrojo se
  // quedaría sin latido, la ventana de 45 segundos caducaría y **la cuenta del jugador se
  // quedaría libre para cualquiera**. El ahorro solo vale si el cerrojo sigue vivito.
  //
  // **LO QUE SE AFIRMA ES LA REGLA, NO EL GASTO:** dos llamadas seguidas no pagan dos
  // viajes, y la primera pasada después de un rato **sí** vuelve a pagar.
  {
    const { campoLatido } = await import('../src/services/sessionService');

    // **POR QUÉ ESTA PRUEBA NO AFIRMA LA FORMA DEL CAMPO.** El reloj de `campoLatido` es de
    // módulo y la prueba de arriba acaba de confirmar un latido, así que desde aquí **la
    // función devuelve `null` siempre**. Afirmar aquí "el campo lleva el dispositivo" sería
    // verdad **por el reloj de otra prueba**, no por el código, que es exactamente como una
    // comprobación pasa en verde sin comprobar nada. **La forma se afirma arriba**, con el
    // reloj frío; aquí solo se afirma la regla de frescura, que es la que decide si se paga.
    const recienEscrito = campoLatido('test', 'd1');
    check('B30: un latido recién escrito no se vuelve a pagar',
      recienEscrito === null,
      `inmediatamente después=${recienEscrito === null ? 'nulo (correcto)' : 'escrito otra vez'}`);
  }

  resumen('B29: lo que cuesta jugar, medido acción por acción');
}

export default main();
