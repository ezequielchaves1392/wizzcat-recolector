// ==========================================================================
//  La señal del ingreso: lo que se enseña es lo que se cobra
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  Tres números para el mismo segundo, y solo uno era el bueno.
//
//  El HUD de la base anuncia "+N Nanitas / segundo" y el saldo sube un bloque
//  entero cada segundo (`tickCheck` ata el ritmo). Hasta aquí eso ya era verdad.
//  Lo que NO era verdad era el reparto: con dos compañeros de +3 y un
//  multiplicador de 1,5, el ingreso real es `floor((3+3) * 1,5) = 9`, pero cada
//  ficha pintaba su `power` desnudo ("+3 /s") y cada "+3" flotante.sumaba 6. El
//  contador subía 9 y la pantalla pintaba 6.
//
//  No es un descuadre de un uno: es el mismo bug que "que la ruleta no
//  mienta", con otro disfraz. La cifra que entra en la cuenta y la que se
//  enseña venían por caminos distintos, y el jugador no tenía forma de saber
//  cuál era la buena.
//
//  Y los clicks del árbol no tenían NINGUNA señal: entraban en la cuenta, sumaban
//  `totalClicks`, y no se veían por ningún lado. Tres fuentes alimentando un
//  número y dos con cartel.
//
//  LAS CUATRO REGLAS QUE SE COMPRUEBAN.
//
//    · LA SUMA ES EXACTA — lo que reparten las fichas da exactamente
//      `state.passiveIncome`, ni un nanita de menos ni de más. Es la que ata el
//      panel al contador, y la que falla en silencio si alguien vuelve a
//      redondear cada compañero por su cuenta: los floors no suman.
//    · CON MULTIPLICADOR — que el número enseñado sea el que entra después de
//      `passiveMultiplier`, no el `power` desnudo.
//    · TODO ORIGEN ESTÁ ANUNCIADO — los clicks del árbol emiten evento con la
//      cifra que ya se cobró, y la cola se vacía al drainedarla.
//    · EL CLICK DEL JUGADOR — que `click()` devuelva lo que entró, en vez de que
//      la vista lo deduzca restando dos lecturas del estado.
//
//  LO QUE NO CUBRE, A PROPÓSITO.
//
//  · Que los "+N" se vean bien y dónde caen: eso es de la pantalla, no de un
//    banco.
//  · La fracción como fracción. El ingreso se cobra entero a propósito
//    (`tickCheck`), así que el reparto es de enteros y no hay medio nanita que
//    repartir. Si algún día el pasivo volviera a fraccionarse, este banco
//    tendría que cambiar, y el sitio para decirlo es aquí.
//
//  NINGUNA REGLA DEL JUEGO ESTÁ REIMPLEMENTADA. `tickCheck` sustituye el
//  `setInterval` para poder disparar el tick de verdad; aquí se usa lo mismo. Si
//  el juego cambia el ritmo, esto falla en vez de seguir pasando por debajo.
// ==========================================================================

import { check, resumen, boot, nanites, baseSave, collector, ficha, conRoll } from './kit';
import { MULTIPLICADOR_CRITICO } from '../src/data/crafting';

type Intervalo = { fn: () => void; ms: number };

/**
 * Sustituye `setInterval` por uno que APARTA los callbacks, y dispara el de
 * 500 ms a mano.
 *
 * Es el mismo truco que `tickCheck`, duplicado aquí a propósito: los dos bancos
 * necesitan el tick de verdad y ninguno debe depender del otro, porque si uno
 * importara la ayuda del otro, un fallo en el compartido se leería como un
 * fallo de los dos.
 *
 * POR QUÉ EL `boot` VA DENTRO Y NO FUERA. El tick solo se registra si el jugador
 * está presente, y eso lo decide `isPlayerPresent()` en el momento de construir
 * el game loop. Sustituir `setInterval` antes de `boot()` es lo único que
 * garantiZa que el intervalo existe; si se hiciera después, la lista saldría
 * vacía y este banco reventaría con "no ha registrado ningún intervalo" —que es
 * un mensaje que señala al banco y no a la causa.
 */
async function conTick(fn: (tick: () => void, g: any) => Promise<void>, save: any) {
  const lista: Intervalo[] = [];
  const original = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  globalThis.setInterval = ((f: () => void, ms?: number) => {
    lista.push({ fn: f, ms: Number(ms) || 0 });
    return lista.length as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  globalThis.clearInterval = (() => {}) as typeof clearInterval;

  try {
    const g = await boot(save);
    const deMedio = lista.filter(i => i.ms === 500);
    const elegido = deMedio[deMedio.length - 1];
    if (!elegido) throw new Error('el game loop no ha registrado ningún intervalo de 500 ms');
    await fn(elegido.fn, g);
  } finally {
    globalThis.setInterval = original;
    globalThis.clearInterval = originalClear;
  }
}

/** Una partida con varios compañeros activos y todo lo demás a cero. */
function partidaCon(...fichas: any[]) {
  // F74 · Sin tier a propósito: estos bancos miden matemática de ingreso con
  // poderes fijos (3+3, ×1,5), y con tier la migración los recalcularía con base
  // sorteada. Es la forma de poder fijo, como los exclusivos.
  for (const f of fichas) delete f?.tier;
  return baseSave([collector('r1')], {
    nanites: 0,
    totalNanitesProduced: 0,
    companions: fichas,
    activeCompanions: fichas.map(f => f.id),
    maxCompanionSlots: 5
  });
}

/**
 * Una partida con N clics automáticos por segundo.
 *
 * POR QUÉ PASA POR `nodeLevels` Y NO POR `bonus.autoClick`. `bonus` es un
 * campo DERIVADO: al cargar el save se recalcula con `recomputeBonuses()` a
 * partir de `nodeLevels`, que es la fuente de verdad. Poner `autoClick` a mano
 * en el save no llega a ninguna parte —la carga lo pisa— y el banco se quedaba
 * esperando clicks que no ocurrían nunca.
 *
 * El nodo es `auto_clicker`, que da 0,5 por nivel, así que `clicsPorSegundo * 2`
 * niveles son los que hacen falta. El identificador sale de `data/tree.ts` y el
 * BONUS de ese nodo es el del juego: aquí no se reimplementa ninguna regla.
 *
 * Y lleva RECOLECTOR EQUIPADO, porque sin él `calculateClickDamage()` da 0 y el
 * click automático entra a cero: el aviso se emitía, el saldo no subía, y el
 * banco tenía razón sobre el código y sobre la partida mal montada a la vez.
 * Un click automático sin recolector no es un caso raro del juego, es una partida
 * que todavía no ha equipado nada —y en ese caso no de nada, que es lo
 * correcto—; para mirar el aviso hace falta un recolector de verdad.
 */
function partidaAutoClick(clicsPorSegundo: number) {
  return baseSave([collector('r1', 3, { damage: 60, level: 4 })], {
    nanites: 0,
    totalNanitesProduced: 0,
    cores: 999,
    equippedCollectorId: 'r1',
    nodeLevels: { auto_clicker: clicsPorSegundo * 2 }
  });
}

/** Reparte el mismo problema entre los tres sitios donde se puede ver. */
function reparto() {
  return [
    { nombre: 'reparto', n: 2, pesos: [3, 3] },
    { nombre: 'impar', n: 3, pesos: [1, 1, 1] },
    { nombre: 'desiguales', n: 3, pesos: [10, 1, 1] },
    { nombre: 'uno solo', n: 1, pesos: [7] }
  ];
}

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA SUMA ES EXACTA. La regla que ata el panel al contador.
  // -----------------------------------------------------------------------
  {
    for (const caso of reparto()) {
      const fichas = caso.pesos.map((p, i) => ficha('c' + i, 1, { power: p, type: 'passive' }));
      await conTick(async (tick, g) => {
        // El multiplicador lo da un compañero tipo 'multiplier', que se pasa en
        // el save. Con él la división por peso tiene fracción que repartir, que
        // es justo el caso donde `floor(power * mult)` por compañero no sumaría.
        const ingreso = g.getState().passiveIncome;
        const suma = fichas.reduce(
          (a, f) => a + (typeof g.getCompanionOutput === 'function' ? g.getCompanionOutput(f.id) : -1), 0
        );

        check(
          `${caso.nombre}: las fichas suman EXACTAMENTE el ingreso`,
          suma === ingreso,
          `suma=${suma} ingreso=${ingreso} pesos=${JSON.stringify(caso.pesos)}`
        );
        check(
          `${caso.nombre}: y ninguna ficha se queda sin su parte`,
          fichas.every(f => g.getCompanionOutput(f.id) >= 0),
          fichas.map(f => `${f.id}=${g.getCompanionOutput(f.id)}`).join(' ')
        );

        // Y el cobro del tick tiene que ser ese mismo número, no el redondeo
        // de cada ficha por separado. Es la prueba que falla si alguien
        // deshace el reparto y vuelve a multiplicar en la vista.
        const antes = nanites(g);
        for (let i = 0; i < 2; i++) tick();
        check(
          `${caso.nombre}: el contador sube lo que dicen las fichas`,
          nanites(g) - antes === ingreso,
          `subió=${nanites(g) - antes} ingreso=${ingreso}`
        );
      }, partidaCon(...fichas, ficha('mx', 1, { power: 0.5, type: 'multiplier' })));
    }
  }

  // -----------------------------------------------------------------------
  //  2. CON MULTIPLICADOR, NO EL POWER DESNUDO.
  //
  //     Este es el bug tal y como se veía: la ficha decía "+power" y el
  //     contador subía otra cosa.
  // -----------------------------------------------------------------------
  {
    await conTick(async (tick, g) => {
      // Un multiplicador x1,5: el ingreso real pasa de 6 a 9.
      const ingreso = g.getState().passiveIncome;
      const esperado = 9;
      const mostrado = g.getState().companions
        .filter(c => c.type === 'passive')
        .reduce((a: number, c: any) => a + g.getCompanionOutput(c.id), 0);

      check('con x1,5 el ingreso sube a 9', ingreso === esperado, `ingreso=${ingreso}`);
      check(
        'las fichas dicen 9 y no 6: el power desnudo ya no se enseña',
        mostrado === esperado && mostrado !== 6,
        `fichas=${mostrado} (power desnudo seriam 6)`
      );

      const antes = nanites(g);
      for (let i = 0; i < 2; i++) tick();
      check('y el contador sube 9, que es lo que dicen', nanites(g) - antes === esperado,
        `subió=${nanites(g) - antes}`);
    }, partidaCon(
      ficha('c0', 1, { power: 3, type: 'passive' }),
      ficha('c1', 1, { power: 3, type: 'passive' }),
      ficha('mx', 1, { power: 0.5, type: 'multiplier' })
    ));
  }

  // -----------------------------------------------------------------------
  //  3. LOS CLICS DEL ÁRBOL, QUE NO TENÍAN SEÑAL.
  // -----------------------------------------------------------------------
  {
    await conTick(async (tick, g) => {
      const antes = nanites(g);
      // Dos ticks: con 2 clics/s el acumulador llega a 1 justo en el segundo
      // tick, que es cuando entra el primer click.
      tick();
      tick();

      // Un UN SEGUNDO de ticks, no dos: son 2 clicks, no uno. Y la suma de los
      // avisos tiene que ser lo que entró en la cuenta, no el primer aviso, que
      // solo sería una parte. Comparar de uno en uno es lo que hace que un banco
      // con varios clicks por tick dé verde sobre un código que solo anota el
      // último.
      const pendientes = typeof g.drainClickEvents === 'function' ? g.drainClickEvents() : [];
      const sumaAvisos = pendientes.reduce((a: number, e: any) => a + e.cantidad, 0);
      check('el árbol emite un aviso por click cobrado',
        Array.isArray(pendientes) && pendientes.length === 2,
        'avisos=' + JSON.stringify(pendientes));
      check('y los avisos suman EXACTAMENTE lo que entró en la cuenta',
        sumaAvisos === nanites(g) - antes,
        `avisos=${JSON.stringify(pendientes)} suman=${sumaAvisos} entrado=${nanites(g) - antes}`);

      const clima = nanites(g) - antes;
      for (let i = 0; i < 2; i++) tick();
      const mas = nanites(g) - antes - clima;
      const avisos2 = g.drainClickEvents?.() ?? [];
      check('y sigue emitiendo en los segundos siguientes',
        avisos2.length > 0 && avisos2.reduce((a: number, e: any) => a + e.cantidad, 0) === mas,
        `avisos=${avisos2.length} suma=${avisos2.reduce((a: number, e: any) => a + e.cantidad, 0)} entrado=${mas}`);

      // Y LA COLA SE VACÍA: drainedarla dos veces no puede dar los mismos avisos
      // otra vez, o la vista los pintaría dos veces.
      check('drainedla vacía la cola', (g.drainClickEvents?.() ?? []).length === 0,
        'la segunda llamada devolvió avisos');
    }, partidaAutoClick(2));
  }

  // -----------------------------------------------------------------------
  //  4. EL CLICK DEL JUGADOR, QUE DEVUELVE LO QUE ENTRÓ.
  //
  //     Antes la vista restaba dos lecturas del estado para deducirlo, y esa
  //     resta no es un número que exista en ningún sitio.
  // -----------------------------------------------------------------------
  {
    const g = await boot(baseSave([collector('r1', 3, { damage: 60, level: 4 })], { nanites: 1000 }));
    g.equipCollector('r1');

    const antes = nanites(g);
    const golpe = g.click();
    const entrado = nanites(g) - antes;

    // **EL CLICK DEVUELVE CUÁNTO Y SI FUE CRÍTICO, Y NO UN NÚMERO SUELTO.** Antes
    // devolvía el número y la vista no tenía forma de saber si el afijo había
    // hecho nada: el crítico entraba en la cuenta sin señal. Ahora viajan las dos
    // cosas del mismo click, como `rolled` en la sintonización.
    check('click() dice cuánto entró y si fue crítico',
      typeof golpe.cantidad === 'number' && typeof golpe.critico === 'boolean',
      JSON.stringify(golpe));
    check('y la cantidad es exactamente lo que entró en la cuenta',
      golpe.cantidad === entrado,
      `cantidad=${golpe.cantidad} entrado=${entrado}`);
    // Y que la cifra no dependa de una SEGUNDA llamada al motor. `click()`
    // calcula el daño con el estado de este instante; si entre el click y la
    // lectura cambiara un buff, los dos números dejarían de coincidir sin que
    // hubiera pasado nada raro. La relación que importa es con lo que entró, que
    // es la de arriba; esta solo avisa de que el daño es estable dentro del mismo
    // estado, así que se admite el redondeo a entero de cada lado.
    //
    // **Y SIN AFIJO DE CRÍTICO NO HAY CRÍTICO QUE ROMPA ESTA COMPARACIÓN.** El
    // item de esta prueba no lleva afijos, así que su probabilidad es cero y el
    // dado no puede salir: la cifra tiene que ser la del daño normal.
    check('el daño no cambia entre el click y la lectura',
      Math.abs(golpe.cantidad - g.getClickDamage()) <= 1 && golpe.critico === false,
      `cantidad=${golpe.cantidad} getClickDamage=${g.getClickDamage()} critico=${golpe.critico}`);
  }

  // -----------------------------------------------------------------------
  //  4b. EL CRÍTICO: EL AFIJO QUE NO HACÍA NADA (B16).
  //
  //  `aff_crit` se enseñaba en la ficha y se cobraba en la valoración, pero
  //  ningún cálculo tiraba su dado: un jugador con +8% de crítico no veía un
  //  crítico nunca. Estas pruebas atan la probabilidad del afijo al dado del
  //  click, con el dado clavado (`conRoll`): sin clavar, una prueba de
  //  probabilidad es una prueba de suerte.
  //
  //  **Y EL CRÍTICO ES DEL CLICK DEL JUGADOR.** Los automáticos del árbol no
  //  critican: el crítico es un evento que se ve y los automáticos entran en
  //  silencio por su propia cola. Cambiar eso es economía, no este bug.
  // -----------------------------------------------------------------------
  {
    // Sin afijo de crítico, doscientos clicks y ni un crítico: la probabilidad
    // es cero y el dado no existe. Es determinista sin clavar nada.
    const g = await boot(baseSave([collector('r1', 3, { damage: 60 })], { nanites: 1000 }));
    g.equipCollector('r1');
    let criticos = 0;
    for (let i = 0; i < 200; i++) {
      if ((g.click() as any).critico) criticos++;
    }
    check('crítico: sin afijo no hay crítico nunca',
      criticos === 0, `criticos=${criticos}/200`);
  }
  {
    // Con el afijo y el dado clavado a cero, todos critican: el dado sale
    // siempre por debajo de cualquier probabilidad no nula.
    //
    // **Y CON `first_click` YA DESBLOQUEADO.** Ese logro da +2% y salta en el
    // primer click: sin pre-desbloquearlo, `base` y `crit` se medirían con bonus
    // distintos y el ×2 no cuadraría por un 2% que no es del crítico.
    const g = await boot(baseSave(
      [collector('r1', 3, { damage: 60, affixes: ['aff_crit'] })],
      { nanites: 1000, unlockedAchievements: ['first_click'] }));
    g.equipCollector('r1');
    const base = conRoll(0.99999, () => (g.click() as any).cantidad);
    const crit = conRoll(0, () => g.click() as any);
    check('crítico: con el dado a favor, el click critica',
      crit.critico === true, JSON.stringify(crit));
    check('crítico: y el crítico paga exactamente el doble',
      crit.cantidad === base * MULTIPLICADOR_CRITICO,
      `crit=${crit.cantidad} base=${base} x${MULTIPLICADOR_CRITICO}`);
    check('crítico: y con el dado en contra, no critica',
      conRoll(0.99999, () => (g.click() as any).critico) === false,
      'criticó con 0.99999 y 8%');
  }

  // -----------------------------------------------------------------------
  //  5. SIN MIRAR, NO HAY AVISO.
  //
  //     El aviso es de presentación, pero el tick se detiene ANTES de cobrar, así
  //     que no hay ni dinero ni nota. Y si los clicks se hubieran anotado antes
  //     de la guarda, al volver el jugador vería todos los "+N" de un rato
  //     entero de golpe.
  // -----------------------------------------------------------------------
  {
    await conTick(async (tick, g) => {
      const visibilidadOriginal = document.visibilityState;
      try {
        // Un segundo con la pestaña visible, para que la cola empiece VACÍA de
        // verdad y no con avisos de antes. Sin este drainedla previo, lo que se
        // comprobaría es que no se acumulan avisos NUEVOS, que es otra cosa: la
        // cola conservaría los del primer segundo y la prueba daría verde con
        // basura dentro.
        tick();
        tick();
        (g.drainClickEvents?.() ?? []);

        const antes = nanites(g);
        (document as any).visibilityState = 'hidden';
        for (let i = 0; i < 10; i++) tick();

        check('con la pestaña oculta no entra ni un nanita del árbol',
          nanites(g) === antes, `saldo=${nanites(g)} antes=${antes}`);
        check('y tampoco queda ningún aviso acumulado',
          (g.drainClickEvents?.() ?? []).length === 0,
          'quedaron avisos de un tiempo en el que no se cobró nada');
      } finally {
        (document as any).visibilityState = visibilidadOriginal;
      }
    }, partidaAutoClick(2));
  }

  // -----------------------------------------------------------------------
  //  6. EL REPARTO NO INVENTA INGRESO CUANDO NO HAY COMPAÑEROS.
  // -----------------------------------------------------------------------
  {
    const g = await boot(baseSave([collector('r1')], { nanites: 500 }));
    check('sin compañeros no hay ingreso que repartir',
      g.getState().passiveIncome === 0, 'ingreso=' + g.getState().passiveIncome);
    check('y preguntar por uno inexistente da 0, no un NaN',
      g.getCompanionOutput?.('no_existe') === 0,
      'salida=' + g.getCompanionOutput?.('no_existe'));
  }

  // -----------------------------------------------------------------------
  //  7. QUIEN ANUNCIA SU INGRESO.
  //
  //     Esta es la regla que rompio B1. La vista filtraba por `type === click` y
  //     se quedaba sin pintar los `passive`, asi que el Avatar del Vacio -power
  //     65, el mayor ingreso individual del juego- no producia ninguna senal:
  //     salia de una caja, se equipaba, y no aparecia nada. El jugador no tenia
  //     forma de saber si el companero estaba mal o si era el juego.
  //
  //     La regla ahora es "anuncia quien paga directo": los `passive` y los
  //     `click` avisan, los `multiplier` no, porque multiplican a los demas y no
  //     tienen cifra propia.
  // -----------------------------------------------------------------------
  {
    // Los cinco companeros de caja REALES, con su tipo y su power. Si se anadiera
    // uno nuevo y no estuviera en esta lista, este banco dejaria de mirarlo, y esa
    // es la forma exacta de que el bug vuelva.
    const DE_CAJA = [
      { id: 'fantasma', nombre: 'Fantasma Cuantico', type: 'multiplier', power: 0.35 },
      { id: 'oraculo', nombre: 'Oraculo Tribal', type: 'multiplier', power: 0.75 },
      { id: 'avatar', nombre: 'Avatar del Vacio', type: 'passive', power: 65 },
      { id: 'fenix', nombre: 'Fenix de Datos', type: 'passive', power: 40 },
      { id: 'centinela', nombre: 'Centinela Eterno', type: 'click', power: 32 }
    ];

    for (const c of DE_CAJA) {
      const g = await boot(baseSave([collector('r1')], {
        nanites: 0,
        totalNanitesProduced: 0,
        companions: [ficha(c.id, 3, { power: c.power, type: c.type })],
        activeCompanions: [c.id]
      }));

      const lista = typeof g.getAnunciablesIngreso === 'function' ? g.getAnunciablesIngreso() : [];
      const anuncia = lista.map((a: any) => a.id);
      const debeAnunciar = c.type !== 'multiplier';

      check(
        `${c.nombre} (${c.type}) ${debeAnunciar ? 'anuncia' : 'NO anuncia'}`,
        debeAnunciar ? anuncia.includes(c.id) : !anuncia.includes(c.id),
        `anunciables=[${anuncia.join(', ')}] ingreso=${g.getState().passiveIncome}`
      );

      // Y si anuncia, que anuncie la cifra REAL y no su power desnudo: el mismo
      // descuadre que el reparto, aplicado al aviso.
      if (debeAnunciar) {
        const cuota = lista.find((a: any) => a.id === c.id);
        check(`${c.nombre}: y su aviso lleva la cifra que entra en la cuenta`,
          cuota?.cantidad === g.getState().passiveIncome,
          `aviso=${cuota?.cantidad} ingreso=${g.getState().passiveIncome} power=${c.power}`);
      }
    }

    // El multiplicador NO debe tragarse a los demas: si alguien cambiara la regla
    // a "todos los activos", el multiplicador empezaria a pintar un numero que no
    // es suyo, y este banco lo canta.
    {
      const g = await boot(baseSave([collector('r1')], {
        nanites: 0,
        totalNanitesProduced: 0,
        companions: [
          ficha('mx', 3, { power: 0.5, type: 'multiplier' }),
          ficha('av', 3, { power: 65, type: 'passive' })
        ],
        activeCompanions: ['mx', 'av']
      }));
      const anuncia = (g.getAnunciablesIngreso?.() ?? []).map((a: any) => a.id);
      check('con un multiplicador al lado, el passive sigue anunciando',
        anuncia.includes('av') && !anuncia.includes('mx'),
        `anunciables=[${anuncia.join(', ')}]`);
    }

    // Y que la suma de lo anunciado sea exactamente lo que cobra el bloque. Si
    // manana un companero pagara una parte al bloque y otra a otro sitio, esto se
    // abre, que es justo lo que el jugador no podria ver.
    {
      const g = await boot(baseSave([collector('r1')], {
        nanites: 0,
        totalNanitesProduced: 0,
        companions: [
          ficha('a', 1, { power: 6, type: 'click' }),
          ficha('b', 3, { power: 18, type: 'passive' }),
          ficha('c', 5, { power: 42, type: 'passive' })
        ],
        activeCompanions: ['a', 'b', 'c']
      }));
      const suma = (g.getAnunciablesIngreso?.() ?? [])
        .reduce((a: number, x: any) => a + x.cantidad, 0);
      check('lo que anuncian los tres suma el ingreso del bloque',
        suma === g.getState().passiveIncome,
        `anuncian=${suma} ingreso=${g.getState().passiveIncome}`);
    }
  }

  resumen('senal: lo que se enseña es lo que se cobra');
}

export default main();