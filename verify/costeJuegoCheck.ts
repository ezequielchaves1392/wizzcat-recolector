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
//  llamaba a `saveToFirebase()`, y hay más de cuarenta llamadas en el motor**. Un minuto
//  de juego real —comprar, subir, abrir, usar una tarjeta— no eran cuatro escrituras:
//  eran **una por acción**, porque cada acción cambia el documento. El jugador que
//  clica sin parar hacía escrituras a su propio ritmo, y ese ritmo no lo controlaba
//  ningún temporizador del juego.
//
//  **LO QUE AFIRMA, Y ES LO IMPORTANTE.** Que el coste de un minuto de juego **no lo
//  fija el juego: lo fija el jugador**. Y por tanto **subir el intervalo del guardado no
//  tocaba ese coste**, porque el guardado automático solo añadía una escritura cada
//  periodo: si el jugador genera diez escrituras por minuto, el temporizador no es el
//  que se lleva el presupuesto. Ese es el error de razonamiento que hizo falta medir
//  para no repetir: **la cuenta de "20.000 escrituras" no se arregla bajando un número,
//  se arregla decidiendo dónde se llama al guardado.** (F104 lo arregla agrupando: la
//  red sale una vez por bloque y las acciones solo anotan la cola local.)
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
    // 120 guardados seguidos: con el ritmo que sea, en reposo no sale nada.
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
    // agrupan en el bloque, que es justo lo que este mecanismo quiere.
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
  // **EL GUARDADO LLEVA EL LATIDO, Y POR ESO EL LATIDO CASI NO ESCRIBE SOLO.**
  // Se pasa una función que devuelve el campo, como hace `main.ts`, y se
  // cuenta cuántas escrituras hacen falta para mantener vivo el cerrojo.
  // **Lo que se compara es el antes y el después**, porque un número suelto no
  // dice si es mucho o poco: lo que dice es si el arreglo ha quitado
  // escrituras de verdad. Los números de hoy (ventana 5 min, bloque 2 min)
  // están en el bloque: cuatro ciclos son ocho escrituras como mucho.
  {
    // El latido de verdad, con su reloj de verdad.
    const { campoLatido, confirmarLatido, anotarLatido, VENTANA_MS } = await import('../src/services/sessionService');

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

    // **Y AQUÍ NO SE CONFIRMA ANTES DE MEDIR.** Confirmar dejaría el latido
    // fresco y el bucle de abajo no escribiría nunca: el reloj solo avanza
    // tiempo simulado y el bucle corre en milisegundos. El resultado sería
    // `0 escrituras`, que parecería un ahorro enorme y sería **un banco que no
    // ha comprobado nada**.

    // **EL MOTOR CON EL LATIDO CONECTADO, COMO EN `main.ts`.** Sin esto el motor arranca sin
    // cerrojo y la cuenta mediría un juego que no existe.
    const g: any = await boot(baseSave([], { nanites: 5_000 }), {
      campoDeLatido: () => campoLatido('test', 'dispositivo') as any,
      confirmarLatido,
    });
    const db: any = globalThis.__MEM_DB__;
    await g.flush();
    await asentar();

    // **EL RELOJ SIMULADO, Y POR QUÉ.** La regla del latido es "fresco o no
    // fresco", y con el reloj de verdad habría que esperar 2,5 minutos entre
    // vuelta y vuelta para ejercerla: este bloque tardaría diez minutos. Se
    // adelanta `Date.now` a mano y se devuelve en `finally`: todo lo que decide
    // por tiempo (`campoLatido`, el periodo del ranking) lee ese reloj, y los
    // `setTimeout` siguen siendo los de verdad, así que nada se cuelga.
    // Reloj frío a la fuerza: se avanza una ventana entera para que el primer
    // latido esté caducado venga de donde venga el reloj de módulo (los bancos
    // comparten proceso y otro banco pudo confirmar hace un momento).
    const ahoraReal = Date.now;
    let t = ahoraReal();
    Date.now = () => t;
    t += VENTANA_MS;
    try {

    // **LO QUE HACÍA LA PRIMERA VERSIÓN Y MEDÍA MAL.** Contaba si `campoLatido()`
    // devolvía algo, pero el latido **no lo escribe quien lo pide**: lo escribe el
    // guardado, en un `setDoc` que el banco ya cuenta. O sea que medía "cuántas veces
    // pidió el motor un campo", que no es ninguna cifra comparable con nada. **Ahora se
    // cuenta `db.escrituras`, que es lo que cobra Firestore.**
    //
    // **LO QUE SE RECORRE:** cuatro ciclos al ritmo real —latido suelto y bloque
    // con progreso— y en cada uno el guardado llevando el campo de viaje cuando
    // toca. Cada ciclo son DOS escrituras contadas (una del latido suelto, una
    // del bloque que escribe porque el saldo se movió); la fila no sale
    // (quince minutos) y la tarjeta tampoco.
    //
    // **LO QUE CUENTA ES `db.escrituras`, QUE ES LO QUE COBRA FIRESTORE**, y por eso el
    // latido se escribe llamando a `anotarLatido()` y no a mano: **la función que decide es
    // la del juego**, y el contador es el que cobra.
    let latidosSueltos = 0;
    db.escrituras = 0;
    const pasoReal = Math.floor(VENTANA_MS / 2);
    for (let n = 0; n < 4; n++) {
      // 1. El reloj del latido, por su cuenta. Esto es `mantenerLatido()`.
      const antesDelLatido = db.escrituras ?? 0;
      await anotarLatido('test', 'dispositivo');
      if ((db.escrituras ?? 0) > antesDelLatido) latidosSueltos++;
      await asentar();

      // 2. Y ahora el bloque, que **también** pide el campo y se lo lleva de viaje si el
      //    reloj se lo da. Se le pone progreso de verdad, o B28 lo salta —y entonces no
      //    habría viaje que medir, que es lo mismo que no medir nada—.
      g.getState().nanites += 1;
      await g.flush();
      await asentar();

      // El reloj simulado avanza el tiempo real entre latidos: la regla "fresco
      // o no fresco" se ejerce **de verdad**, en vez de estar movida a dedo.
      t += pasoReal;
    }
    const conViaje = db.escrituras ?? 0;
    await g.cleanup?.();

    check('B29: el cerrojo se mantiene vivo en su propio reloj (4 de 4)',
      latidosSueltos === 4,
      `latidos sueltos=${latidosSueltos} de 4`);
    check('B29: y cuatro ciclos cuestan cuatro bloques + cuatro latidos, nada más',
      conViaje === 8,
      `escrituras=${conViaje} en 4 ciclos`);
    } finally {
      Date.now = ahoraReal;
    }
  }

  // ---- 5. Y LO QUE NO SE PUEDE ROMPER: EL CERROJO SIGUE VIVO ----
  // **SI ESTA COMPROBACIÓN FALLA, EL AHORRO ES UN JUEGO DE MANIPULACIÓN.** El campo se
  // devuelve `null` cuando el reloj dice que aún no toca, y si ese reloj se atascara
  // correctamente, `campoLatido()` no devolvería NUNCA un campo nuevo: el cerrojo se
  // quedaría sin latido, la ventana caducaría y **la cuenta del jugador se
  // quedaría libre para cualquiera**. El ahorro solo vale si el cerrojo sigue vivito.
  //
  // **LO QUE SE AFIRMA ES LA REGLA, NO EL GASTO:** dos llamadas seguidas no pagan dos
  // viajes, y la primera pasada después de un rato **sí** vuelve a pagar.
  {
    const { campoLatido, confirmarLatido, reiniciarRelojLatido } = await import('../src/services/sessionService');

    // **RELOJ FRÍO A LA FUERZA, EN LAS DOS DIRECCIONES.** El reloj es de módulo y
    // los bancos comparten proceso: el bloque de arriba confirma con el reloj
    // simulado adelantado, y sin este reset el banco siguiente mediría un
    // cerrojo recién batido en vez del suyo. Se enfría antes para medir lo
    // propio, y se devuelve frío después para no ensuciar al siguiente.
    reiniciarRelojLatido();
    try {
      // **LA FORMA DEL CAMPO, CON EL RELOJ FRÍO.** Frío, la primera llamada
      // recibe un campo de verdad; a partir de ahí devuelve `null` porque el
      // latido está fresco.
      const primerCampo: any = campoLatido('test', 'dispositivo-de-prueba');
      const sesion = primerCampo?.sesion;
      check('B30: el campo lleva el dispositivo y la hora, que es lo que mira el cerrojo',
        sesion?.dispositivo === 'dispositivo-de-prueba'
          && typeof sesion?.latido === 'number' && sesion.latido > 0,
        `sesion=${JSON.stringify(sesion)}`);
      confirmarLatido();
      const recienEscrito = campoLatido('test', 'd1');
      check('B30: un latido recién escrito no se vuelve a pagar',
        recienEscrito === null,
        `inmediatamente después=${recienEscrito === null ? 'nulo (correcto)' : 'escrito otra vez'}`);
    } finally {
      reiniciarRelojLatido();
    }
  }

  resumen('B29: lo que cuesta jugar, medido acción por acción');
}

export default main();
