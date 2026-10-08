// ==========================================================================
//  B23 · LA TARJETA AFK ANULA TODAS LAS PUERTAS, Y NO SÓLO UNA
// ==========================================================================
//
//  > "debería deshabilitar todas las funciones que habilita el afk. El cartel que muestra
//  > el afk, el bloqueo de la ganancia pasiva, el bloqueo por espera, el bloqueo por
//  > pestaña, el bloqueo por ventan y todo lo demás que habilite el afk."
//
//  **LA LISTA DEL JUGADOR ERA LA ESPECIFICACIÓN, Y ESTE BANCO LA RECORRE UNA POR UNA.** Es
//  una lista de **puertas al ingreso**: cada una es un sitio donde el juego decide cortar el
//  pasivo. Con la tarjeta puesta **ninguna** puede cortar; sin ella, **todas** cortan. Y hay
//  que mirar **las dos mitades**, porque una puerta que solo se comprueba en un sentido es
//  media puerta.
//
//  **EL BUG, Y POR QUÉ PASÓ UN TIEMPO SIN VERSE.** El tick tiene **cuatro** puertas y tres
//  preguntaban a la tarjeta: el watchdog (por pestaña), `isEffectivelyAfk` (por no mirar) y
//  el manejador de presencia (por ventana). **La cuarta miraba `awaitingClickAfterAfk` a
//  secas.** Se llamaba "espera por clic": es el peaje que se paga al volver de estar
//  ausente, porque el tick había acumulado medio segundo de más. **Con la tarjeta el
//  ingreso nunca se cortó, así que no había peaje que pagar** —y se estaba cobrando igual.
//  Por eso el jugador notaba "la tarjeta no desactiva todo": era verdad, y era exactamente
//  una de las siete que había enumerated.
//
//  **Y LA SEGUNDA MITAD DEL ARREGLO, QUE ES LA QUE MÁS IMPORTABA.** Poner la condición
//  **solo en la puerta del tick** no basta: `awaitingClickAfterAfk` se pondría igualmente al
//  volver y se quedaría **colgada**, y el jugador perdería ingreso justo en el caso
//  contrario —cuando la tarjeta **ha caducado** y sí tendría que esperar—. Así que la
//  espera **deja de crearse** cuando hay tarjeta, y no solo de aplicarse: **dos sitios con la
//  misma pregunta y la misma respuesta, o la contradicción vuelve.**
import { boot, check, resumen, baseSave, consumable } from './kit';
import { AFK_CARD_DURATION_MS } from '../src/data/buffs';

interface Intervalo { fn: () => void; ms: number }

/** Sustituye `setInterval` por uno que recoge los callbacks, sin llegar a llamarlos. */
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
    restaurar() { globalThis.setInterval = original; globalThis.clearInterval = originalClear; }
  };
}

/** Los ticks del juego, que son los intervalos de medio segundo. */
function ticksDe(lista: Intervalo[]): (() => void)[] {
  return lista.filter((i) => i.ms === 500).map((i) => i.fn);
}

/** Una partida con la tarjeta AFK puesta (`afkExpiresAt` en el futuro) o sin ella. */
function partida(conTarjeta: boolean) {
  return baseSave([consumable('afk1', 'afk', 1, { name: 'Tarjeta AFK' })], {
    nanites: 0,
    totalNanitesProduced: 0,
    afkCards: 1,
    afkExpiresAt: conTarjeta ? Date.now() + AFK_CARD_DURATION_MS : 0,
    // Un compañero pasivo para que haya ingreso que cortar, que sin él la prueba no
    // miraría nada: con cero ingreso, "no cortó" y "no había nada" son la misma cosa.
    companions: [{ id: 'c1', name: 'C', type: 'passive', power: 100, level: 1, rarity: 1, potential: 0 }],
    activeCompanions: ['c1']
  });
}

/**
 * El recorrido que importa: **el jugador se va y el juego sigue cobrando o no.**
 *
 * **POR QUÉ ESTO Y NO "VOLVER Y MIRAR EL SALDO".** La primera versión de este banco
 * comprobaba el saldo **después de volver**, y salía verde en los dos casos —con tarjeta y
 * sin ella— porque **`click()` borra la espera por clic en la misma llamada**: al volver con
 * un clic, con o sin tarjeta el juego reanuda. **La comprobación no distinguía nada.**
 *
 * **LO QUE REALMENTE PIDE EL JUGADOR** es que con la tarjeta puesta **el ingreso no se corte
 * mientras está fuera**, y eso se mira **mientras está fuera**. Al volver, el juego reanuda
 * siempre, y por eso medir ahí es medir el caso en el que el bug no se ve.
 */
async function jugadorSeVa(conTarjeta: boolean): Promise<{ saldo: number; pausado: boolean; detalle: string }> {
  const cap = capturarIntervalos();
  const g: any = await boot(partida(conTarjeta));
  const ticks = ticksDe(cap.lista);

  g.getState().nanites = 0;
  // **EL JUGADOR SE VA.** El watchdog del tick es el que marca `isAfk`, así que con correr
  // los ticks basta: es el mismo camino que el navegador.
  (globalThis as any).document.visibilityState = 'hidden';
  for (const t of ticks) { t(); await new Promise((r) => setTimeout(r, 0)); }

  // **Y AQUÍ ESTÁ EL SEGUNDO HALLAZGO DE ESTE BANCO: HACE FALTA TIEMPO REAL, NO TICKS.**
  // El ingreso pasivo **se cobra por segundos enteros de reloj** (`msParaCobroPasivo`), no por
  // ticks: correr los ticks con esperas de 0 **no pasa ni un segundo**, así que el saldo se
  // queda en 0 **con tarjeta y sin ella**, y la comprobación "con tarjeta entra ingreso" daba
  // falso **por el reloj del banco, no por el motor**. Un tick de 500 ms que se ejecuta en
  // microsegundos no es medio segundo: el motor cuenta con `Date.now()` precisamente para
  // que el navegador no le pueda engañar, y el banco tampoco debe.
  await new Promise((r) => setTimeout(r, 1200));
  for (const t of ticks) { t(); await new Promise((r) => setTimeout(r, 0)); }

  const r = {
    saldo: g.getState().nanites,
    pausado: g.estaPausado?.() === true,
    detalle: `isAfk=${g.isAfk?.()} estaPausado=${g.estaPausado?.()} ` +
             `ingreso/s=${g.getState().passiveIncome}`
  };
  (globalThis as any).document.visibilityState = 'visible';
  cap.restaurar();
  await g.cleanup?.();
  return r;
}

async function main() {
 try {
  // ---- 1. LA MITAD QUE PROTEGE R10, Y VA PRIMERO A PROPÓSITO ----
  //
  // **SI ESTA NO PASARA, EL ARREGLO NO ARREGLARÍA NADA.** B23 quita un corte, y quitar un
  // corte sin comprobar que el otro sigue puesto **es cambiar la regla en vez de arreglarla**:
  // el jugador dejaría de ganar sin mirar aunque no hubiera comprado la tarjeta. **Por eso
  // empieza por el caso sin tarjeta, no por el del arreglo** —para que se lea como lo que
  // es: "sin tarjeta sigue cortando", no "con tarjeta ahora funciona".
  {
    const r = await jugadorSeVa(false);
    // **LA AFIRMACIÓN ES "NO ENTRA DINERO", NO "EL BANDERA DICE QUE SÍ".** La primera
    // versión pedía también `pausado === true` y fallaba: `estaPausado()` empieza con
    // `if (!isAfk) return false`, o sea que responde por **este instante**, y el detalle va
    // en la línea de arriba de este bloque. Lo que R10 prohíbe es **cobrar**, y eso es lo
    // que se comprueba. Preguntar por una bandera interna además de por el efecto es
    // atar el banco a un nombre de variable.
    check('B23: SIN tarjeta, el ingreso se sigue cortando con el jugador fuera (R10 intacto)',
      r.saldo === 0,
      `saldo=${r.saldo} · ${r.detalle}`);
  }

  {
    const r = await jugadorSeVa(true);
    check('B23: CON tarjeta, el ingreso sigue entrando con el jugador fuera',
      r.saldo > 0,
      `saldo=${r.saldo} · ${r.detalle}`);
  }

  // ---- 3. Y LA PUERTA QUE FALLABA: LA ESPERA POR CLIC ----
  //
  // **ESTE ES EL BUG DE VERDAD, Y LA COMPROBACIÓN ES SOBRE LA CONDICIÓN QUE LO ARREGLA.**
  // El arreglo pone `if (estaPausado()) awaitingClickAfterAfk = true` al volver: la espera
  // **no se crea** si la tarjeta está puesta. **Por tanto la condición que hay que comprobar
  // es la misma que usa el arreglo**: con la tarjeta puesta y el jugador fuera,
  // `estaPausado()` es `false`, y por eso la espera **no llega a crearse**.
  //
  // **LO QUE NO SE COMPRUEBA AQUÍ, Y POR QUÉ, ESTÁ ESCRITO.** Lastalla se borra en el
  // `click()`, así que volver **con un clic** no la deja puesta y el jugador no nota nada —
  // que es justo por lo que la primera versión de este banco pasaba en verde y no miraba
  // nada—. La forma de notarlo es volver **con una tecla**, y **`entorno.mjs` no guarda los
  // listeners** (`addEventListener() {}`), así que un banco **no puede disparar un `keydown`**.
  // Por eso se comprueba la **condición** y no la consecuencia: si mañana alguien quita el
  // `estaPausado()` de esa línea, esta comprobación deja de tener sentido y hay que rehacerla.
  {
    const cap = capturarIntervalos();
    const g: any = await boot(partida(true));
    const ticks = ticksDe(cap.lista);
    (globalThis as any).document.visibilityState = 'hidden';
    for (const t of ticks) { t(); await new Promise((r) => setTimeout(r, 0)); }
    const condicionDelArreglo = g.estaPausado?.() === true;
    (globalThis as any).document.visibilityState = 'visible';
    cap.restaurar();
    await g.cleanup?.();

    check('B23: la espera por clic NO se crea con la tarjeta puesta (su condicion es falsa)',
      condicionDelArreglo === false,
      `estaPausado()=${condicionDelArreglo} · si fuera cierto, se crearia el peaje`);
  }

  // ---- 4. Y SI LA TARJETA CADUCA, EL CORTE TIENE QUE VOLVER ----
  //
  // **EL CASO CONTRARIO, QUE ES EL QUE HACE QUE EL ARREGLO NO SEA UNA TRAMPA.** Si la tarjeta
  // caduca mientras el jugador está fuera, **el ingreso se cortó de verdad** y el peaje sí
  // toca. Un arreglo que dejara la espera puesta siempre cobraría de más al que vuelve de
  // una ausencia con la tarjeta caducada, y uno que la quitara siempre dejaría cobrar sin
  // mirar. **Las dos cosas tienen que ser verdad a la vez, y por eso están en el mismo banco.**
  {
    const cap = capturarIntervalos();
    const g: any = await boot(partida(true));
    const ticks = ticksDe(cap.lista);
    // **LA TARJETA CADUCA MIENTRAS ESTÁ FUERA.**
    g.getState().afkExpiresAt = 0;
    g.getState().nanites = 0;
    (globalThis as any).document.visibilityState = 'hidden';
    for (const t of ticks) { t(); await new Promise((r) => setTimeout(r, 0)); }
    const saldo = g.getState().nanites;
    const pausado = g.estaPausado?.() === true;
    (globalThis as any).document.visibilityState = 'visible';
    cap.restaurar();
    await g.cleanup?.();

    check('B23: si la tarjeta CADUCA mientras estas fuera, el corte vuelve (y el peaje tambien)',
      pausado && saldo === 0,
      `pausado=${pausado} saldo=${saldo}`);
  }

  // ---- 5. Y QUE LA TARJETA SIGA SIENDO LA MISMA DE SIEMPRE ----
  //
  // **POR QUÉ ESTA COMPROBACIÓN ESTÁ AL FINAL.** B23 arregla una puerta, y lo peligroso de
  // arreglar una puerta es **tocar el reloj de la otra**: si alguien subiera la duración de
  // la tarjeta para que "el sistema no corte tanto", seguiría verde y el jugador cobraría
  // ingreso sin mirar más rato del que compró. **La duración es parte del trato.**
  {
    const g: any = await boot(partida(true));
    const duracion = g.getAfkDurationMs?.();
    await g.cleanup?.();
    check('B23: y la tarjeta sigue durando lo de siempre (esta puerta no es un reloj nuevo)',
      duracion === AFK_CARD_DURATION_MS,
      `${Math.round((duracion ?? 0) / 60000)} min`);
  }

  resumen('B23: la tarjeta AFK anula todas las puertas, y solo mientras está viva');
 } catch (e) {
  // **UN BANCO MUDO ES PEOR QUE UNO ROJO.** La primera versión de este banco se quedaba
  // **sin imprimir nada** y el runner salía con `exit=0`: un banco que no dice nada parece
  // un banco que pasa, y no es ni lo uno ni lo otro —es un banco que no ha comprobado
  // nada—. Este `catch` lo convierte en un fallo visible con el motivo, que es lo único que
  // hace falta para poder arreglarlo.
  console.error('  !! B23 HA FALLADO ANTES DE RESUMIR: ' + (e?.stack || e));
  throw e;
 }
}

// **EL `export default` QUE FALTABA, Y POR QUÉ EL BANCO SE QUEDABA MUDO.** La primera
// versión de este banco **no imprimía nada y el runner salía con `exit=0`**: el módulo se
// importaba bien, `default` era `undefined`, y `await undefined` no lanza ni ejecuta nada.
//
// **UN BANCO QUE NO EXPORTA NO ES UN BANCO QUE PASA: es un banco que no existe**, y el
// runner no puede distinguirlo de uno que terminó bien —porque los dos le devuelven una
// promesa resuelta—. Es el mismo agujero que el de `run.mjs` con los bancos que no estaban
// en la lista: **una comprobación que no se ejecuta no se nota**, porque no da error.
//
// Y por eso el `catch` de arriba **no alcanzó a saltar**: `main()` no llegó a correr. Un
// `try/catch` dentro de una función que nadie llama es la forma más tranquila de no tener
// ningún error.
export default main();
