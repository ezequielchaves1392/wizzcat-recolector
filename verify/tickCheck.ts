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

import { check, resumen, boot, nanites, baseSave, ficha } from './kit';

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

  resumen('tick: el ingreso pasivo entra entero y a su ritmo');
}

export default main();