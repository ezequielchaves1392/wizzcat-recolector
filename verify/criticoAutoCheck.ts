// ==========================================================================
//  B25 · LOS CLICS AUTOMÁTICOS TAMBIÉN CRITICAN
// ==========================================================================
//
//  **LO QUE SE PIDIÓ Y LO QUE ERA, QUE NO SON LO MISMO.** Se pidió crítico para "los
//  clics pasivos". La propuesta que había escrito pedía crucial para los **compañeros de
//  tipo `click`**, y esa propuesta se apoyaba en una premisa **falsa**: que un compañero
//  de tipo `click` "sí cobra por clic".
//
//  **UN COMPAÑERO DE TIPO `click` NO HACE CLICS.** Su poder entra en
//  `recalculatePassiveIncome()` como **una tasa por segundo**, dentro de `state.passiveIncome`,
//  junto a los `passive`. No hay ningún evento al que tirarle un dado. Ponerle un crítico no
//  sería un evento: sería **más ingreso de golpe**, que es otra cosa —y que además cobraría
//  sin que el jugador esté mirando la pantalla, que es justo lo que R10 prohíbe—.
//
//  **LOS QUE SÍ SON CLICS SON LOS NODOS `autoClick` DEL ÁRBOL.** El motor cuenta
//  `totalClicks` por cada uno, cada vuelta del bucle es un click, y cada click tiene su
//  propio flotante. Que no puedan criticar es **la excepción sin motivo**: es la misma acción
//  que el click del jugador.
//
//  **Y LA RESTRICCIÓN DE B16 SIGUE VIGIENDO, Y POR ESO EL DADO ESTÁ DONDE ESTÁ.** B16 dejó
//  escrito que el dado **no** va dentro de `calculateClickDamage()`, porque esa función la leen
//  el panel y el desglose y **un dado dentro haría que el número que se enseña cambiara en
//  cada lectura**. Eso sigue siendo cierto, y por eso el dado se tira en el bucle, que es
//  donde ya se ha decidido que esto **es** un click. **Este banco comprueba las dos cosas a
//  la vez**, porque el arreglo fácil —meter el dado en la función— rompería la otra.
import { boot, check, resumen, baseSave, conRoll } from './kit';
import { MULTIPLICADOR_CRITICO } from '../src/data/crafting';

interface Intervalo { fn: () => void; ms: number }

/**
 * Sustituye `setInterval` por uno que **recoge los callbacks sin llegar a llamarlos**.
 *
 * **POR QUÉ HACE FALTALO, Y ES LA PRIMERA VERSIÓN DE ESTE BANCO.** `entorno.mjs` deja el
 * `setInterval` del juego sin arrancar —los bancos no pueden esperar medio segundo por
 * partida—, así que llamar a `g.tick()` **no hace nada**: no está en la API y el bucle
 * nunca se mueve. **Las tres primeras comprobaciones de este banco salían a cero y a
 * `undefined` por eso, y el arreglo del motor era correcto.** Es el mismo truco que usa
 * `tickCheck`, y se copia porque el mecanismo es del runner y no del banco.
 *
 * Y `restaurar()` **no es opcional**: los bancos corren todos en el mismo proceso, y dejar
 * el `setInterval` cambiado es el tipo de banco que se apaga solo cuando le toca hablar a
 * otro.
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
    restaurar() { globalThis.setInterval = original; globalThis.clearInterval = originalClear; }
  };
}

/** El tick del juego: el único intervalo de medio segundo que pide. */
function tickDe(lista: Intervalo[]): () => void {
  const deMedioSegundo = lista.filter((i) => i.ms === 500);
  const elegido = deMedioSegundo[deMedioSegundo.length - 1];
  if (!elegido) throw new Error('el game loop no ha registrado ningun intervalo de 500 ms');
  return elegido.fn;
}

/**
 * Una partida con el nodo `autoClick` comprado, que es lo que dispara el bucle.
 *
 * **Y CON UN RECOLECTOR EQUIPADO QUE TENGA AFIJO DE CRÍTICO, QUE NO ES COSA MENOR.** La
 * primera versión de este banco **no llevaba recolector**, y las comprobaciones salían a
 * cero sin que el motor tuviera nada malo: `critChance` sale de los afijos del recolector
 * **equipado**, y sin recolector es `0`, así que `Math.random() < 0` **nunca** da crítico y
 * el automático pagaba siempre lo mismo. El motor estaba bien; **la partida de prueba era
  * que no tenia de donde mirar**. Sin afijo no hay probabilidad que tirar, y una
  * comprobacion que clava el dado y espera ver criticos **tiene que tener de donde salgan**.
 */
function partidaConAutoClick(nivel = 3) {
  return baseSave([{
    id: 'w_col', name: 'Recolector', type: 'collector', details: 'x',
    rarity: 'Legendario', tier: 1, sellPrice: 0, stackable: false,
    power: 100, level: 1, affixes: ['aff_focus'], potential: 0
  }], {
    nanites: 0,
    totalNanitesProduced: 0,
    equippedCollectorId: 'w_col',
    bonuses: { autoClick: nivel },
    nodeLevels: { auto_clicker: nivel },
    // **CON `first_click` YA DESBLOQUEADO (F97).** Da +2 % al extraer 100
    // nanitas, y tres ticks de autos lo cruzan: sin pre-desbloquearlo, los
    // eventos de después del desbloqueo llevarían un +2 % que los de antes no,
    // y ninguna comparación "todos iguales" valdría. Es el mismo patrón que el
    // bloque de crítico de `senalCheck`.
    unlockedAchievements: ['first_click']
  });
}

async function main() {
  // ---- 1. EL DADO SE TIRA EN EL AUTOMÁTICO, Y SE COMPRUEBA POR EL EFECTO ----
  //
  // **LO QUE SE COMPRUEBA ES EL EFECTO, NO LA LLAMADA.** Que haya un `Math.random` en
  // alguna parte no demuestra nada: podría estar en el sitio equivocado. Lo que se ve es
  // que **con el dado siempre a favor el automático paga el doble**, y eso solo puede pasar
  // si el dado está en el camino del automático.
  //
  // `conRoll` clava `Math.random`, que es lo que hace falta para que un dado sea
  // comprobable: sin eso un crítico saldría una vez de cada muchas y la prueba no probaría
  // nada.
  /**
   * El promedio por clic de los eventos automáticos, no la suma.
   *
   * **POR QUÉ EL PROMEDIO Y NO LA SUMA, Y ES LA TERCERA MEDIDA MAL HECHA EN ESTE BANCO.**
   * La suma parece la cifra natural, y en solitario daba justo (32 contra 16). **En la suite
   * entera daba 32 contra 18 y el banco se ponía rojo con el motor correcto**: entre el
   * arranque y los `tick()` manuales se cuela algún tick de verdad, y eso mueve
   * `autoClickAccumulator`, así que **la cantidad de clics depende del reloj de la máquina**.
   * Una comprobación que depende de cuántos clics han pasado **no comprueba el crítico: pide
   * suerte**.
   *
   * El promedio **no depende de cuántos clics hubo**: si el crítico dobla el daño, cada clic
   * vale el doble, y el promedio también. Con el dado a favor el promedio es exactamente el
   * doble, haya-click lo que haya-click. Que es lo que se quiere afirmar.
   */
  const maximoDeClicks = (eventos: any[]) =>
    Math.max(0, ...eventos.map((e: any) => e.cantidad));

  /**
   * Mide los eventos de los `tick()` de este banco, **drenando dos veces seguidas**.
   *
   * **POR QUÉ DOS DRENAJES Y POR QUÉ ESTA MEDIDA ES LA CUARTA MAL HECHA.** Entre el drenaje
   * y los `tick()` manuales **entra algún tick de verdad** —el del arranque, o uno que se
   * cuela porque la máquina va lenta—, y ese tick usa el `Math.random` sin clavar y trae su
   * acumulador ya avanzado. Por eso la suma daba justo en solitario (32 contra 16) y mal en
   * la suite (32 contra 18), y por eso el promedio dio **18, que es imposible**: los únicos
   * valores posibles son 8 y 16, y su promedio no puede ser 18. **Eso delató el problema, y
   * un número imposible es la pista más útil que ha dado este banco.**
   *
   * El segundo drenaje recoge lo que se coló en el primero. Y lo que se afirma **no es un
   * total, sino la forma de los valores**: con el dado a favor, todo evento es el daño o su
   * doble, y **hay al menos un doble**. Eso es cierto llegue lo que llegue de fuera, y
   * **fallaría entero si el dado no estuviera en el camino del automático**.
   */
  const medir = async (roll: number): Promise<{ dano: number; eventos: number[] }> => {
    const cap = capturarIntervalos();
    const g: any = await boot(partidaConAutoClick());
    const tick = tickDe(cap.lista);
    const r = await conRoll(roll, async () => {
      g.drainClickEvents?.();
      g.drainClickEvents?.();          // lo colado entre medias, fuera
      const dano = g.getClickDamage?.() ?? 0;
      tick(); tick(); tick();
      const eventos = (g.drainClickEvents?.() ?? []).map((e: any) => e.cantidad);
      return { dano, eventos };
    });
    cap.restaurar();
    await g.cleanup?.();
    return r;
  };

  const conDado = await medir(0);
  const sinDado = await medir(0.999);
  const d = conDado.dano;

  check('B25: con el dado a favor hay click automatico que pega el doble del dano puro',
    d > 0 && conDado.eventos.includes(d * MULTIPLICADOR_CRITICO),
    `dano=${d}, eventos=[${conDado.eventos.join(', ')}], buscando ${d * MULTIPLICADOR_CRITICO}`);

  check('B25: y ningun automatico se pasa del doble (el critico es x2, no mas)',
    conDado.eventos.every((v: number) => v === d || v === d * MULTIPLICADOR_CRITICO),
    `todos los eventos son ${d} o ${d * MULTIPLICADOR_CRITICO}`);

  check('B25: y sin el dado no sale ni un solo automatico con critico',
    sinDado.eventos.length > 0 && sinDado.eventos.every((v: number) => v === sinDado.dano),
    `dano=${sinDado.dano}, eventos=[${sinDado.eventos.join(', ')}]`);

  // ---- 2. Y LA FUNCIÓN PURA SIGUE PURA, QUE ES B16 ----
  //
  // **ESTA ES LA COMPROBACIÓN QUE HACE QUE EL ARREGLO NO SEA EL FÁCIL.** El arreglo rápido
  // es meter `Math.random` en `calculateClickDamage()`, y con eso el automático **criticaría
  //**: la comprobación de arriba pasaría. Lo que rompería es el **panel**, que llama a esa
  // función para enseñar "+X Nanitas por click" y empezaría a **cambiar de cifra en cada
  // lectura**, sin que el jugador haya tocado nada.
  //
  // **CÓMO SE COMPRUEBA SIN DOM:** con el dado clavado en dos valores distintos y el mismo
  // recolector, el daño tiene que ser **el mismo**. Si el dado estuviera dentro, serían
  // distintos.
  let a = 0;
  let b = 0;
  {
    const cap = capturarIntervalos();
    const g: any = await boot(partidaConAutoClick());
    a = await conRoll(0, async () => g.getClickDamage?.() ?? 0);
    b = await conRoll(0.999, async () => g.getClickDamage?.() ?? 0);
    cap.restaurar();
    await g.cleanup?.();
  }
  check('B25: y el dano del click NO tira el dado (si lo tirara, el panel parpadearia)',
    a > 0 && a === b,
    `con dado 0: ${a}, con dado 0.999: ${b} (iguales = la funcion sigue siendo pura)`);

  // ---- 3. Y EL EVENTO LLEVA LA MARCA, QUE SIN ELLA NO HAY SEÑAL ----
  //
  // **UN NÚMERO MAYOR NO ES UN CRÍTICO.** Un "+200" al lado de un "+100" se lee como un
  // click mejor, no como un evento: el jugador no sabe que el afijo ha hecho nada. Por eso
  // el evento lleva `critico`, y lo que se comprueba es que **la marca viaja**: una vista que
  // solo recibe la cifra no puede distinguir un crítico de un click bueno.
  {
    const cap = capturarIntervalos();
    const g: any = await boot(partidaConAutoClick());
    const tick = tickDe(cap.lista);
    let eventos: any[] = [];
    await conRoll(0, async () => {
      g.drainClickEvents?.();          // lo del arranque, fuera: se medía con el dado ya puesto
      tick(); tick(); tick();
      eventos = g.drainClickEvents?.() ?? [];
    });
    cap.restaurar();
    await g.cleanup?.();

    check('B25: el evento del automatico lleva si fue critico',
      eventos.length > 0 && eventos.every((e: any) => e && e.critico === true),
      `${eventos.length} eventos, todos marcados: ${eventos.every((e: any) => e?.critico === true)}`);
  }

  // ---- 4. Y CUANDO EL DADO NO SALE, EL EVENTO NO LLEVA MARCA ----
  //
  // **LA MITAD QUE FALTA DEL TERCER PUNTO.** Si el evento dijera siempre `critico: true`, la
  // comprobación de arriba pasaría y el jugador vería `¡CRÍT!` en cada click automático. Un
  // evento que **siempre** dice que sí no es una señal, es ruido con forma de número.
  {
    const cap = capturarIntervalos();
    const g: any = await boot(partidaConAutoClick());
    const tick = tickDe(cap.lista);
    let eventos: any[] = [];
    await conRoll(0.999, async () => {
      g.drainClickEvents?.();          // lo del arranque, fuera: se medía con el dado ya puesto
      tick(); tick(); tick();
      eventos = g.drainClickEvents?.() ?? [];
    });
    cap.restaurar();
    await g.cleanup?.();

    check('B25: y sin critico el evento NO va marcado (si siempre dijera que si, no seria señal)',
      eventos.length > 0 && eventos.every((e: any) => e?.critico === false),
      `${eventos.length} eventos, ninguno marcado`);
  }

  // ---- 5. Y EL INGRESO PASIVO SIGUE SIN CRÍTICOS, QUE ES LO QUE NO SE TOCA ----
  //
  // **POR QUÉ ESTA COMPROBACIÓN ESTÁ, Y ES LA IMPORTANTE PARA R10.** El ingreso pasivo se
  // cobra **sin que el jugador esté mirando la pantalla**, así que **no puede tener eventos**
  // que el jugador no ve. Un crítico en el ingreso pasivo sería **cobrar de más sin que se
  // vea por qué**, que es justo lo que R10 prohíbe. El compañero de tipo `click` va por ese
  // camino y **se queda fuera a propósito**, no por descuido.
  {
    // Se comprueba con números y no con `true`: un compañero de tipo `click` tiene que
    // **sumar su poder a la tasa por segundo**, y no generar eventos de click.
    const cap = capturarIntervalos();
    const g: any = await boot(baseSave([], {
      nanites: 0,
      totalNanitesProduced: 0,
      companions: [{ id: 'c1', name: 'C', type: 'click', power: 100, level: 1, rarity: 1, potential: 0 }],
      activeCompanions: ['c1'],
      bonuses: { autoClick: 0 }
    }));
    const tasa = g.getState().passiveIncome;
    let eventos = 0;
    await conRoll(0, async () => {
      tickDe(cap.lista)();
      eventos = (g.drainClickEvents?.() ?? []).length;
    });
    cap.restaurar();
    await g.cleanup?.();

    check('B25: el companero de tipo click es tasa por segundo, sin eventos ni dado',
      tasa > 0 && eventos === 0,
      `+${tasa}/s de tasa, ${eventos} eventos de click (R10: cobrar sin mirar no genera señales)`);
  }

  // ---- 6. Y LOS AUTOS NO USAN LAS TARJETAS x2/x3, QUE SON DEL JUGADOR (F97) ----
  //
  // **LA MÁQUINA NO LEE TU TARJETA.** El click del jugador cobra x2/x3 y el
  // automático no: con buff, decenas de autos pegando el triple eran presencia
  // sin juego. El crítico sí vale para los dos (B25): es del arma, no de la
  // tarjeta. Lo que se comprueba son las dos mitades a la vez, porque una sin
  // la otra es medio arreglo: autos sin buff Y jugador con buff.
  {
    const cap = capturarIntervalos();
    const g: any = await boot(partidaConAutoClick());
    const tick = tickDe(cap.lista);
    // **EL DANO PURO SE MIDE SIN BUFF.** `getClickDamage()` lleva el x2/x3
    // puesto (es lo que enseña el panel), así que con la tarjeta ya encendida
    // mediría el doble y la comparación diría que el automático paga la mitad
    // por un error de la prueba, no del motor. Se mide antes de encenderla.
    const d = g.getClickDamage?.() ?? 0;
    // La tarjeta se enciende como en el juego: con el buff vigente de verdad,
    // no con un flag que el motor no lea.
    g.updateState({ buffs: { ...(g.getState().buffs as any), clickX2ExpiresAt: Date.now() + 30_000 } });
    let eventos: number[] = [];
    let jugador = 0;
    await conRoll(0.999, async () => {
      g.drainClickEvents?.();
      g.drainClickEvents?.();
      tick(); tick(); tick();
      eventos = (g.drainClickEvents?.() ?? []).map((e: any) => e.cantidad);
      jugador = (g.click() as any).cantidad;
    });
    cap.restaurar();
    await g.cleanup?.();

    check('F97: con x2 puesta, el automatico paga lo mismo que sin buff',
      d > 0 && eventos.length > 0 && eventos.every((v: number) => v === d),
      `dano=${d}, eventos=[${eventos.join(', ')}]`);
    check('F97: y el click del jugador SI cobra el x2 (el buff no se ha roto)',
      jugador === d * 2 || jugador === d * 2 + 1,
      `jugador=${jugador} dano=${d} (el +1 es el suelo de cada lado)`);
  }

  resumen('B25: los clics automáticos del árbol también critican');
}

export default main();
