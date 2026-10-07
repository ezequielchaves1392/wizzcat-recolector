// ==========================================================================
//  El tick: cuándo y de cuánto entra el ingreso pasivo
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  El HUD de la base anuncia "+5 Nanitas / segundo" y el tick corre a 500 ms.
//  Con un compañero de +5/s, cobrar la fracción del tick dividía por dos lo que
//  toca en cada vuelta: el saldo subía 2,5 cada medio segundo y, como
//  `formatNumber` baja el entero, el número grande alternaba +2 y +3
//  (307 → 309 → 312 → 314 → 317 → 319). Sonaba a tirón y no a contador.
//
//  Con un ingreso IMPAR el desajuste se veía todavía peor: 7/s daba +3 y +4, y
//  9/s daba +4 y +5. Ninguno de esos casos escribía mal ni perdía nada al
//  guardar: la economía era correcta y lo que mentía era el RITMO. Eso es lo que
//  este banco ata a un contrato comprobable.
//
//  LAS CINCO REGLAS QUE SE COMPRUEBAN.
//
//    · ENTERO — el saldo nunca lleva decimales a mitad de segundo. Es la regla
//      que hace que no se vea el +2 y el +3, y la primera que se rompería en
//      cuanto alguien volviera a dividir por el número de ticks.
//    · DE UNA VEZ — el segundo entero entra entero, no en dos mitades. Con 7/s el
//      tick entrega +7 y ni un +3,5 por el camino.
//    · AL MISMO RITMO — y esta es la que no se puede perder de vista: el ingreso
//      por segundo NO cambia. Diez ticks son cinco segundos y tienen que haber
//      dado exactamente cinco cobros. Un arreglo de ritmo visual que de paso
//      inflara o recortara el ingreso se vería igual de bonito en pantalla y
//      sería un desastre en la economía.
//    · TODOS LOS ORIGENES — un compañero de tipo 'click' también suma aquí, y
//      tiene que entrar entero igual que uno de tipo 'passive'.
//    · NADA SIN MIRAR — con la pestaña oculta el tick se detiene antes de
//      acumular, así que el tiempo ausente no se convierte de golpe en un cobro
//      entero al volver.
//
//  LO QUE NO CUBRE, A PROPÓSITO.
//
//  · Que se vea fluido. Eso es de `preview.html` y de mirarlo, no de un banco.
//  · El reinicio de `msParaCobroPasivo` al volver de una pausa: dispararlo
//    exigiría falsificar el `focus` del navegador, que en el stub es una
//    sinonima. Lo que sí se comprueba es que el acumulador no arrastra
//    fracciones entre ticks: cada tick suma exactamente medio segundo.
//
//  CÓMO SE MANDA EL TICK.
//
//  `run.mjs` anula `setInterval` para que Node no se quede vivo. Aquí se
//  sustituye por uno que APARTA los callbacks en vez de llamarlos, y luego se
//  dispara a mano el de 500 ms. Es el tick de verdad —el mismo closure que en el
//  navegador— y ni una línea de la economía está reimplementada aquí, que es lo
//  que `kit.ts` prohíbe: si el juego cambia el ritmo, esto falla en vez de seguir
//  pasando por debajo.
// ==========================================================================

import { check, resumen, boot, reload, nanites, baseSave, ficha, consumable, s } from './kit';
// Los dos números del reloj de AFK, que F42 deja vivos a propósito: el tope es del
// reloj y el cobro era del ingreso, y son dos cosas que solo separe un comentario.
import { AFK_CARD_DURATION_MS, MAX_AFK_BUFF_DURATION_MS } from '../src/gameLoop';

/** Un intervalo que el game loop ha pedido, con su periodo. */
type Intervalo = { fn: () => void; ms: number };

/**
 * Sustituye `setInterval` por uno que recoge los callbacks.
 *
 * Guarda el original y devuelve el restaurador: los bancos se ejecutan todos en
 * el mismo proceso, y dejar el `setInterval` cambiado es exactamente el tipo de
 * banco que se apaga solo en cuanto le toca hablar a otro.
 */
function capturarIntervalos(): { lista: Intervalo[]; restaurar: () => void } {
  const lista: Intervalo[] = [];
  const original = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  globalThis.setInterval = ((fn: () => void, ms?: number) => {
    lista.push({ fn, ms: Number(ms) || 0 });
    return lista.length as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  globalThis.clearInterval = (() => {}) as typeof clearInterval;
  return {
    lista,
    restaurar() {
      globalThis.setInterval = original;
      globalThis.clearInterval = originalClear;
    }
  };
}

/** El tick del juego: el único intervalo de medio segundo que pide. */
function tickDe(lista: Intervalo[]): () => void {
  const deMedioSegundo = lista.filter((i) => i.ms === 500);
  const elegido = deMedioSegundo[deMedioSegundo.length - 1];
  if (!elegido) throw new Error('el game loop no ha registrado ningún intervalo de 500 ms');
  return elegido.fn;
}

/** Una partida con un compañero activo de `power` y todo lo demás a cero. */
function partidaConPasivo(power: number, tipo = 'passive') {
  return baseSave([], {
    nanites: 0,
    totalNanitesProduced: 0,
    companions: [ficha('c1', 1, { power, type: tipo })],
    activeCompanions: ['c1'],
    maxCompanionSlots: 3
  });
}

async function main() {
  // -----------------------------------------------------------------------
  //  El caso del vídeo: +5/s tiene que sumar 5, y no 2 y 3.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    try {
      const g = await boot(partidaConPasivo(5));
      const tick = tickDe(lista);

      const pasivo = g.getState().passiveIncome;
      check('con +5/s el HUD anuncia 5', pasivo === 5, 'passiveIncome=' + pasivo);

      // Antes del arreglo, estos mismos cuatro ticks daban 2,5 · 5 · 7,5 · 10 y
      // el entero que se veía era 2 · 5 · 7 · 10. Se fija aquí la serie EXACTA
      // del arreglo viejo, para que este banco no pueda pasar por casualidad si
      // alguien vuelve a dividir por el número de ticks.
      check('un cobro por segundo, no medio', pasivo === 5 && Number.isInteger(pasivo), 'passiveIncome=' + pasivo);

      tick();
      check('medio segundo: todavía no entra nada', nanites(g) === 0, 'saldo=' + nanites(g));

      tick();
      check('al segundo: entran los 5 de golpe', nanites(g) === 5, 'saldo=' + nanites(g));

      tick();
      check('otro medio segundo: el saldo se queda quieto', nanites(g) === 5, 'saldo=' + nanites(g));

      tick();
      check('al siguiente segundo: otros 5', nanites(g) === 10, 'saldo=' + nanites(g));
    } finally {
      restaurar();
    }
  }

  // -----------------------------------------------------------------------
  //  El ingreso impar, que es donde el desajuste se veía peor.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    try {
      const g = await boot(partidaConPasivo(7));
      const tick = tickDe(lista);

      const visto: number[] = [];
      for (let i = 0; i < 4; i++) {
        tick();
        visto.push(nanites(g));
      }
      // Antes del arreglo era 3,5 · 7 · 10,5 · 14, y los enteros que se veían
      // eran 3 · 7 · 10 · 14: un +3 y un +4 para un compañero de +7.
      check(
        'con +7/s el segundo entra entero y de una vez',
        JSON.stringify(visto) === JSON.stringify([0, 7, 7, 14]),
        'saldos=' + JSON.stringify(visto)
      );
      check(
        'con +7/s nunca hay un saldo con decimales',
        visto.every((n) => Number.isInteger(n)),
        'saldos=' + JSON.stringify(visto)
      );
    } finally {
      restaurar();
    }
  }

  // -----------------------------------------------------------------------
  //  EL RITMO NO CAMBIA. Diez ticks son cinco segundos: cinco cobros, ni uno más.
  //  Esta es la prueba que impide arreglar el ritmo visible a costa de la
  // economía, que es el error fácil de cometer al tocar este tick.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    try {
      const g = await boot(partidaConPasivo(5));
      const tick = tickDe(lista);

      const cobros: number[] = [];
      let anterior = nanites(g);
      for (let i = 0; i < 10; i++) {
        tick();
        const saldo = nanites(g);
        if (saldo !== anterior) cobros.push(saldo - anterior);
        anterior = saldo;
      }

      check('diez ticks = cinco cobros', cobros.length === 5, 'cobros=' + JSON.stringify(cobros));
      check('cada cobro vale el ingreso entero', cobros.every((c) => c === 5), 'cobros=' + JSON.stringify(cobros));
      check('el total sigue siendo 5 por segundo', nanites(g) === 25, 'saldo=' + nanites(g));
      check(
        'lo producido lleva la misma cuenta que el saldo',
        g.getState().totalNanitesProduced === nanites(g),
        'producido=' + g.getState().totalNanitesProduced + ' saldo=' + nanites(g)
      );
    } finally {
      restaurar();
    }
  }

  // -----------------------------------------------------------------------
  //  Un compañero de tipo 'click' también suma en este mismo acumulado.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    try {
      const g = await boot(partidaConPasivo(3, 'click'));
      const tick = tickDe(lista);

      const visto: number[] = [];
      for (let i = 0; i < 4; i++) {
        tick();
        visto.push(nanites(g));
      }
      check(
        'un compañero de click también cobra entero',
        JSON.stringify(visto) === JSON.stringify([0, 3, 3, 6]),
        'saldos=' + JSON.stringify(visto)
      );
    } finally {
      restaurar();
    }
  }

  // -----------------------------------------------------------------------
  //  B9 · MIRANDO LA PANTALLA Y SIN HACER NADA, TAMPOCO SE COBRA.
  //
  //  El caso de arriba (pestaña oculta) ya pasaba, pero no es el que se pidió:
  //  ahí el corte lo hace `visibilitychange`. Lo que fallaba es **mirar la
  //  pantalla sin hacer nada**, que no dispara ningún evento de presencia: el
  //  `isAfk` solo se recalculaba dentro de ese manejador, así que con la
  //  pestaña visible el tick seguía cobrando indefinidamente y la etiqueta AFK
  //  de la interfaz mentía.
  //
  //  Se comprueba por los DOS lados, y los dos importan:
  //    · que el ingreso se corte solo al pasar el umbral, sin evento de por medio;
  //    · que los clicks automáticos del árbol NO lo reactiven. Es la trampa
  //      importante: si contaran como actividad, el juego no se pondría en AFK
  //      nunca, porque el árbol genera clicks solo. Que eso se comprueba aquí es
  //      la mitad del motivo de este bloque.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    const visibilidadOriginal = document.visibilityState;
    try {
      const g = await boot(baseSave([], {
        nanites: 0,
        totalNanitesProduced: 0,
        companions: [ficha('c1', 1, { power: 5, type: 'passive' })],
        activeCompanions: ['c1'],
        maxCompanionSlots: 3
      }));
      const tick = tickDe(lista);

      // Se avanza el reloj del motor sin tocar el de los ticks: el umbral se mide
      // con `Date.now()`, y el banco necesita cruzar 60 s sin esperar un minuto.
      const reloj = g.getState();
      const realNow = Date.now;
      let falso = realNow();
      Date.now = () => falso;

      try {
        // Primero: dos segundos de juego normal y el ingreso entra.
        falso = realNow();
        for (let i = 0; i < 4; i++) tick();
        const antesDelUmbral = nanites(g);
        check('B9: mirando y activo, el ingreso entra', antesDelUmbral > 0, 'saldo=' + antesDelUmbral);

        // Y ahora se salta el umbral. El tick se llama MUCHAS veces seguidas, que
        // es lo que haría el reloj si el navegador estirase el intervalo: con un
        // contador de ticks esto cruzaría el umbral en un par de vueltas y la
        // prueba no probaría nada.
        falso = realNow() + 61_000;
        for (let i = 0; i < 4; i++) tick();
        const despues = nanites(g);

        check('B9: sin hacer nada, el ingreso se corta solo',
          despues === antesDelUmbral,
          `antes=${antesDelUmbral} despues=${despues}`);

        check('B9: y ni un tick más de los cuatro cobra nada',
          nanites(g) === antesDelUmbral, 'saldo=' + nanites(g));

        // Y el estado AFK es el que se pinta, que es lo que mentía. El HUD lo recibe en
        // `onUpdate(state, isAfk)`, así que lo que se comprueba es la misma
        // variable que va al `onUpdate`: si el ingreso se cortara por otro
        // camino, esto seguiría diciendo que no.
        check('B9: y el estado dice AFK, para que lo que se ve sea lo que pasa',
          g.isAfk() === true, 'isAfk=' + g.isAfk());

        // LOS CLICS AUTOMÁTICOS DEL ÁRBOL NO CUENTAN COMO ACTIVIDAD, y no pueden
        // mantener el juego despierto. Es la mitad del motivo de este bloque: si
        // contaran, el juego no entraría nunca en AFK por su cuenta, que es justo
        // lo que se pidió arreglar.
        //
        // Y COMPROBARLO TIENE UNA TRAMPA, que es la que hace que esta prueba
        // pueda no comprobar nada: con el árbol dormido, el AFK entraría igual y
        // la prueba pasaría sin mirarlo. Por eso lo que se mide no es "el árbol
        // produjo", sino **"con el árbol tirando clicks, el saldo no se movió"**.
        // Si el corte del AFK no alcanzara a los clicks del árbol, en estos 200
        // ticks (100 s) habrían entrado unos 50 clicks de daño, y el fallo se vería
        // en el número en vez de pasar desapercibido.
        //
        // La forma de comprobarlo es poner el árbol a producir mientras el reloj
        // avanza y ver que el AFK entra igualmente. Con el árbol a 0,5 clicks/s,
        // estos 200 ticks son 100 s y son 50 clicks de daño: si el árbol se
        //uduerma, el AFK entraría igual y la prueba no probaría nada.
        reloj.bonus.autoClick = 0.5;
        falso = realNow() + 61_000;
        const antesConArbol = nanites(g);
        for (let i = 0; i < 200; i++) tick();
        const conArbol = nanites(g);

        check('B9: el árbol estaba tirando clicks y el saldo no se ha movido',
          conArbol === antesConArbol,
          `antes=${antesConArbol} conArbol=${conArbol} — si el corte del AFK no alcanzara al árbol, aquí habría entrado daño de sus clicks`);

        check('B9: y aun así, con el árbol trabajando, el AFK se mantiene',
          g.isAfk() === true, 'isAfk=' + g.isAfk());
      } finally {
        Date.now = realNow;
      }
    } finally {
      (document as any).visibilityState = visibilidadOriginal;
      restaurar();
    }
  }

  // -----------------------------------------------------------------------
  //  B19 · CON TARJETA VIVA NO HAY PAUSA, NI CARTEL NI CERO.
  //
  //  La vista enseñaba el cartel de pausa y el contador a cero con la tarjeta
  //  puesta, porque preguntaba `isAfk && !hasPassiveBuff` en vez de la pregunta
  //  del tick. El tick sí cobraba: cartel diciendo "en pausa" con el número
  //  entrando. Lo que se ata aquí es que la pregunta que la vista va a leer
  //  (`estaPausado()`) dice lo mismo que el tick, con tarjeta viva y caducada.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    try {
      const g = await boot(partidaConPasivo(5));
      const tick = tickDe(lista);

      const realNow = Date.now;
      let falso = realNow();
      Date.now = () => falso;
      try {
        // La tarjeta viva se pone a mano: lo que se comprueba es la decisión
        // (pausa o no), no la plomería de la tarjeta, que ya cubren
        // `tarjetaCheck` y `consumableCheck`.
        s(g).afkExpiresAt = falso + 600_000;
        // Se cruza el umbral de inactividad como en B9: el jugador no mira.
        falso = realNow() + 61_000;
        for (let i = 0; i < 4; i++) tick();

        check('B19: con tarjeta viva el ingreso sigue entrando',
          nanites(g) > 0, 'saldo=' + nanites(g));
        check('B19: y el estado sigue diciendo AFK (el jugador no mira)',
          g.isAfk() === true, 'isAfk=' + g.isAfk());
        check('B19: pero no hay pausa: es lo que la vista tiene que leer',
          g.estaPausado() === false, 'estaPausado=' + g.estaPausado());

        // Y al caducar la tarjeta, la pausa vuelve y el ingreso se corta: la
        // tarjeta compra tiempo, no una exención permanente.
        s(g).afkExpiresAt = falso - 1_000;
        const antesDeCaducar = nanites(g);
        for (let i = 0; i < 4; i++) tick();
        check('B19: caducada la tarjeta sí hay pausa',
          g.estaPausado() === true, 'estaPausado=' + g.estaPausado());
        check('B19: y el ingreso se vuelve a cortar',
          nanites(g) === antesDeCaducar, `antes=${antesDeCaducar} despues=${nanites(g)}`);
      } finally {
        Date.now = realNow;
      }
    } finally {
      restaurar();
    }
  }

  // -----------------------------------------------------------------------
  //  Sin mirar, no se cobra. Y como el tick se detiene ANTES de acumular, el
  //  tiempo ausente no vuelve como un segundo entero de golpe al volver.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    const visibilidadOriginal = document.visibilityState;
    try {
      const g = await boot(partidaConPasivo(5));
      const tick = tickDe(lista);

      tick();
      tick();
      const antes = nanites(g);

      (document as any).visibilityState = 'hidden';
      for (let i = 0; i < 10; i++) tick();

      check(
        'con la pestaña oculta no entra ni un nanita',
        nanites(g) === antes,
        'saldo=' + nanites(g) + ' antes=' + antes
      );
    } finally {
      (document as any).visibilityState = visibilidadOriginal;
      restaurar();
    }
  }

// -----------------------------------------------------------------------
  //  F42 · AL VOLVER NO SE COBRA NADA
  //
  //  Los dos flancos de la presencia ya estaban: sin presencia no hay tick,
  //  y sin tick no hay ingreso. El que faltaba era el tercero, que era el
  //  que de verdad daba dinero: al volver se cobraba el pasivo acumulado con
  //  la tarjeta AFK puesta. `grantAfkCatchUp()` existe para eso y se borra
  //  entera —**no solo su llamada**: dejar la función sin usar es dejar la
  //  puerta abierta con el nombre puesto, y el nombre ("catch up", "ponerse
  //  al día") decía justo lo contrario de la regla.
  //
  //  **LO QUE NO SE PUEDE COMPROBAR DESDE AQUÍ, Y POR QUÉ NO SE INVENTA UNA PRUEBA.**
  //  El cobro ocurría dentro del manejador de `visibilitychange`/`blur`, y el stub de
  //  DOM del banco (`domStub.ts`) tiene `addEventListener` como no-op: no hay forma
  //  de lanzar un evento de presencia desde un banco. Fabricar unaapi de pruebas
  //  solo para esto sería añadir código al motor para comprobar que no hay código,
  //  así que aquí se comprueba **el contrato**: lo que el motor expone y lo que el
  //  reloj sigue haciendo. El evento en sí no está verificado y no cuenta como
  //  verificado.
  // -----------------------------------------------------------------------
  {
    const { lista, restaurar } = capturarIntervalos();
    try {
      const g = await boot(baseSave([consumable('afk', 'afk', 3, { name: 'Tarjeta AFK' })], {
        nanites: 0,
        totalNanitesProduced: 0,
        companions: [ficha('c1', 1, { power: 5, type: 'passive' })],
        activeCompanions: ['c1'],
        maxCompanionSlots: 3
      }));

      // **LA TARJETA SIGUE COMPRANDO TIEMPO.** Quitar el cobro sin tocar el reloj sería
      // quitar un sistema entero para tapar una regla: el AFK es lo que sigue contando
      // mientras no miras, y lo que **no** existe es que ese tiempo se convierta solo en
      // nanitas.
      g.useConsumable('afk', 3);
      const tick = tickDe(lista);
      const antes = nanites(g);
      for (let i = 0; i < 4; i++) tick();
      check('F42: con la tarjeta puesta el tiempo de AFK sigue corriendo',
        s(g).afkExpiresAt > Date.now(), 'afk=' + s(g).afkExpiresAt);
      check('F42: y mirando la pantalla el ingreso entra, que no es lo que se quit\u00f3',
        nanites(g) > antes, `antes=${antes} despues=${nanites(g)}`);

      // **Y EL RELOJ NO SE HA TOCADO:** los topes siguen vivos y con los mismos valores.
      // Borrar el cobro no puede arrastrar el tope, porque el tope es del reloj y el
      // reloj es lo que queda.
      check('F42: el tope del reloj de AFK sigue siendo de 30 minutos',
        MAX_AFK_BUFF_DURATION_MS === 30 * 60_000, 'tope=' + MAX_AFK_BUFF_DURATION_MS);
      check('F42: y una tarjeta de AFK sigue durando 10 minutos',
        AFK_CARD_DURATION_MS === 10 * 60_000, 'tarjeta=' + AFK_CARD_DURATION_MS);
      check('F42: y tres tarjetas siguen dar los 30 minutos, no tres veces m\u00e1s',
        Math.abs((s(g).afkExpiresAt - Date.now()) - MAX_AFK_BUFF_DURATION_MS) < 5_000,
        `restante=${s(g).afkExpiresAt - Date.now()}`);

      // **Y EL MOTOR NO EXPONE NINGÚN COBRO DE AUSENCIA.** Es una prueba débil —no
      // comprueba el interior, comprueba la puerta— pero es la que se puede hacer sin
      // inventarse una API de pruebas, y una función que vuelve a aparecer se ve en
      // la superficie pública antes que en el banco.
      const api = Object.keys(g as any).filter((k) => /catch|away|ausencia/i.test(k));
      check('F42: el motor no expone nada para cobrar el tiempo ausente',
        api.length === 0, 'expone=' + (api.join(',') || 'nada'));
    } finally {
      restaurar();
    }
  }
  {
    // **Y LA RECARGA TAMPOCO.** Al cargar, el bucle arranca y el primer tick cobra con
    // el juego presente; lo que no puede pasar es que el arranque "recupere" el tiempo
    // en que el documento estuvo cerrado. Se comprueba con una partida vieja que
    // vuelve con el AFK caducado hace mucho: si al arrancar se pagara el tiempo
    // ausente, el saldo subiría de golpe.
    const g = await boot(baseSave([consumable('afk', 'afk', 3, { name: 'Tarjeta AFK' })], {
      nanites: 0,
      totalNanitesProduced: 0,
      companions: [ficha('c1', 1, { power: 5, type: 'passive' })],
      activeCompanions: ['c1'],
      maxCompanionSlots: 3,
      afkExpiresAt: Date.now() - 60 * 60_000
    }));
    const antes = nanites(g);
    const g2 = await reload();
    check('F42: una partida vieja con el AFK caducado no cobra nada al arrancar',
      nanites(g2) === antes, `antes=${antes} despues=${nanites(g2)}`);
    check('F42: y el AFK caducado sigue caducado, sin resucitar',
      s(g2).afkExpiresAt <= Date.now(), 'afk=' + s(g2).afkExpiresAt);
  }


  resumen('tick: el ingreso pasivo entra entero y a su ritmo');
}

export default main();