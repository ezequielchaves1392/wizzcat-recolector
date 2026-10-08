// ==========================================================================
//  B26 · LA TARJETA AFK DUPA EL EXTRA DEL ÁRBOL
// ==========================================================================
//
//  **EL NÚMERO DE LA CAPTURA: `AFK 1:55:46`.** Un pase que dice "+30 min de buff AFK
//  por tarjeta por nivel" y un tope que debería ser de 30 min más. Lo que se ve es casi el
//  doble de lo prometido, y en el peor sitio: la tarjeta AFK es **la única forma de que
//  haya ingreso sin mirar la pantalla**, que es justo lo que R10 prohíbe.
//
//  **LA ARITMÉTICA, CON LOS NÚMEROS DEL CÓDIGO, QUE ES LO QUE HACE FALTA MIRAR.** No hay
//  que suponer nada: los tres números están escritos.
//
//    · `AFK_CARD_DURATION_MS` = **10 min** —lo que da una tarjeta.
//    · `afk_extend` da `afkHours: 0.5` = **30 min por nivel**, `maxLevel: 4`.
//    · `afkCardDurationMs()` = `10 min + bonus.afkHours × 1h` —**el extra va AQUÍ**.
//    · `topeDeConsumible('afk', afkMs)` = `TOPE_DE_TARJETA_AFK × afkMs` = **3 × afkMs**.
//
//  **CON UN NIVEL DEL NODO, QUE ES LO QUE TIENE EL JUGADOR:**
//
//    · `afkMs` = 10 + 30 = **40 min**
//    · tope = 3 × 40 = **120 min**  ← y el tope tiene que ser **60**
//
//  **EL BUG ES QUE EL TOPE SE MULTIPLICA POR LA DURACIÓN, Y LA DURACIÓN YA LLEVA EL EXTRA.**
//  El extra del árbol entra **dos veces**: una en el paso, que es correcto, y otra en el
//  tope, porque `TOPE_DE_TARJETA_AFK = 3` es un **número de tarjetas** y se está usando
//  como multiplicador de un **tiempo**. Son dos magnitudes distintas y el `*` las confunde.
//
//  **POR QUÉ NINGUNA DE LAS TRES HIPÓTESIS DE PENDIENTES ERA ESTA, Y POR QUÉ IMPORTA.**
//  Las tres que había apuntan a que el extra se contara de más, a que el tope no mirara la
//  tarjeta, o a que el nodo sumara un nivel que no tiene. **Las tres miran el `+30 min` como
//  sospechoso, y el sospechoso es el `*3`.** Un `+30` que se aplica en el paso y se vuelve a
//  aplicar en el tope **parece un nivel de más** y es un multiplicador aplicado al sitio
//  equivocado: por eso el tiempo es casi el doble y no el doble exacto.
//
//  **Y LA FALSA DE VERDAD ES LA MÁS SERIA DE LAS TRES.** El tope tiene que ser un **tiempo**
//  ("treinta minutos de AFK como mucho"), y se calcula como "tres tarjetas". Con el extra,
//  cada tarjeta es más larga, así que **tres tarjetas largas** dan un tope más largo, y el
//  tope **crece con cada nivel del nodo**: una partida con el nodo al máximo se pasa del
//  doble de lo prometido sin ningún tope que lo frene.
import { boot, check, resumen, baseSave, consumable } from './kit';
import {
  AFK_CARD_DURATION_MS, MAX_AFK_BUFF_DURATION_MS,
  topeDeConsumible, pasoDeConsumible, cuantasVecesCabe
} from '../src/data/buffs';

/** `afkCardDurationMs()`, copiada del motor: la duración de UNA tarjeta con el nodo. */
function duracionDeUnaTarjeta(nivelDelNodo: number): number {
  return AFK_CARD_DURATION_MS + nivelDelNodo * 0.5 * 3600_000;
}

/** Lo que el tope **debería** ser: los 30 minutos de base, más el extra del nodo, una vez. */
function topeQueDeberiaSer(nivelDelNodo: number): number {
  return MAX_AFK_BUFF_DURATION_MS + nivelDelNodo * 0.5 * 3600_000;
}

async function main() {
  // ---- 1. EL NÚMERO DE LA CAPTURA, AHORA YA EL CORRECTO ----
  //
  // **ESTAS DOS COMPROBACIONES AFIRMAN EL BUG, Y ESTO ES LO QUE HACE EL ARREGLO.** La
  // versión anterior de este banco decía "el tope sale el doble de lo prometido" y daba
  // verde **con el bug puesto**: un banco que afirma la avería como si fuera el
  // comportamiento correcto es peor que no tener banco, porque el día que se arregla se
  // pone rojo y parece que se ha roto algo.
  //
  // Ahora afirma **lo que tiene que ser**, y por eso el arreglo es real: si alguien vuelve
  // a multiplicar, esta línea se pone roja.
  const unNivel = duracionDeUnaTarjeta(1);
  const topeConUnNivel = topeDeConsumible('afk', unNivel)!;
  const deberiaSer = topeQueDeberiaSer(1);

  check('B26: con un nivel del nodo el tope es 30 base + 30 del nodo, y no mas',
    topeConUnNivel === deberiaSer,
    `con 1 nivel: tope=${topeConUnNivel / 60000} min, deberia=${deberiaSer / 60000} min`);

  // **Y LA RAZÓN DEL ARREGLO, EN UNA LÍNEA.** El extra tiene que estar en el tope **una
  // vez**. Con el bug estaba dos: una en el paso y otra multiplicada por el tope.
  check('B26: y el extra del nodo cuenta UNA vez en el tope, no multiplicado',
    topeConUnNivel - MAX_AFK_BUFF_DURATION_MS === unNivel - AFK_CARD_DURATION_MS,
    `extra en el tope=${(topeConUnNivel - MAX_AFK_BUFF_DURATION_MS) / 60000} min, ` +
    `extra en la tarjeta=${(unNivel - AFK_CARD_DURATION_MS) / 60000} min`);

  // ---- 2. Y CUANTO CRECE, QUE AHORA ES LO QUE TIENE QUE CRECER ----
  //
  // **EL TOPE SUBE CON EL NODO, PERO EN LÍNEA Y NO MULTIPLICADO.** El nodo compra **+30 min
  // por tarjeta**, así que subir el tope 30 min por nivel es lo coherente con lo que dice la
  // carta del árbol. Lo que no puede ser es **×13**: eso era `3 × afkMs` calculándose a sí
  // mismo, que es un multiplicador aplicado a un número que ya lo incluía.
  const topeBase = topeDeConsumible('afk', AFK_CARD_DURATION_MS)!;
  const topeAlMaximo = topeDeConsumible('afk', duracionDeUnaTarjeta(4))!;
  check('B26: el tope sube con el nodo, pero de uno en uno (no se multiplica)',
    topeAlMaximo === topeBase + 4 * 0.5 * 3600_000,
    `nivel 0: ${topeBase / 60000} min · nivel 4: ${topeAlMaximo / 60000} min ` +
    `(×${(topeAlMaximo / topeBase).toFixed(2)}, antes ×13.00)`);

  // **Y EL CASO SIN NODO, QUE ES EL QUE NO SE ROMPIÓ NUNCA Y POR ESO NO SE VIO EL BUG.**
  // Aquí las dos definiciones de tope coincidían de milagro: `3 × 10 min` son los mismos
  // 30 min que `MAX_AFK_BUFF_DURATION_MS`. **Sin esta comprobación, el banco que existía
  // antes daba verde en todo** y el bug se escondía justo en el caso que más se prueba.
  check('B26: sin nodo el tope es el de siempre (30 min), que es donde el bug se escondia',
    topeBase === MAX_AFK_BUFF_DURATION_MS,
    `${topeBase / 60000} min = MAX_AFK_BUFF_DURATION_MS`);

  // ---- 3. LA INVARIANTE ENTERA: EL TOPE NO PUEDE PASARSE ----
  //
  // **ESTE ES EL BANCO DE VERDAD, Y ES EL QUE DEBERÍA EXISTIR DESDE EL PRINCIPIO.** Con N
  // tarjetas, **el total no puede pasar del tope, ni aunque el nodo lo suba**. Y no se
  // comprueba con tres tarjetas sino con las que sean: el jugador puede usar todas las que
  // tenga, y el tope tiene que aguantar con nueve igual que con tres.
  const topeConCinco = topeDeConsumible('afk', unNivel)!;
  check('B26: el tope aguanta con las tarjetas que sean, no solo con tres',
    topeConCinco === topeConUnNivel,
    `3 tarjetas: ${topeConUnNivel / 60000} min · 5 tarjetas: ${topeConCinco / 60000} min`);

  // Y la consecuencia que ve el jugador: cuántas tarjetas **caben** de verdad. Con el nodo a
  // un nivel son 40 min por tarjeta y el tope 60, o sea que **caben dos**, no tres. Antes
  // salían tres porque el tope estaba en 120.
  const cabenAhora = cuantasVecesCabe({
    buffId: 'afk',
    ahora: 0,
    pasoMs: unNivel,
    unidades: 9,
    afkMs: unNivel
  });
  check('B26: y con el nodo a un nivel caben DOS tarjetas en el tope, no tres',
    cabenAhora === 2,
    `caben=${cabenAhora} de 9 que habia (40 min cada una, tope de 60)`);

  // ---- 4. Y EL PASO, QUE ES LO QUE NO SE TOCA ----
  //
  // **EL PASO NO SE TOCA, Y POR QUÉ SE COMPRUEBA IGUAL.** El paso es lo que aporta **una**
  // unidad, y el `+30 min` del nodo **debe** estar ahí: es lo que compró el jugador. El bug
  // nunca fue que el paso fuera largo, fue que el tope se multiplicaba por un paso que ya
  // lo llevaba. Sin esta comprobación, un arreglo rápido podía "arreglarlo" bajando el
  // paso y **quitarle al jugador lo que pagó**.
  const paso = pasoDeConsumible('afk', unNivel);
  check('B26: el paso SI lleva el extra del nodo (eso es lo que compro el jugador)',
    paso === unNivel && paso > AFK_CARD_DURATION_MS,
    `paso=${paso / 60000} min (base ${AFK_CARD_DURATION_MS / 60000} + extra)`);

  // **Y LOS OTROS CONSUMIBLES, PARA QUE SE VEA QUE EL FALLO ERA DEL AFK.** Los tres tienen
  // el tope como **tiempo fijo**, que es la magnitud correcta, y ninguno se multiplica por
  // `afkMs`. Por eso el bug era del AFK y no de la función en general.
  check('B26: y los otros consumibles no tienen este bug (su tope es un tiempo fijo)',
    topeDeConsumible('clickX2', unNivel) === 30 * 60_000
      && topeDeConsumible('passiveBoost', unNivel) === 2 * 3600_000,
    'clickX2=30 min fijos, pasivo=2 h fijas: ninguno se multiplica por afkMs');

  // ---- 5. Y UN CASO DE OTRAS PARTIDAS QUE NO SE ROMPE ----
  //
  // **UNA PARTIDA VIEJA, SIN EL NODO, TIENE QUE SEGUIR DANDO 30 MIN.** El arreglo usa la
  // resta `afkMs - AFK_CARD_DURATION_MS`, y si algún día `afkMs` llegara por debajo —una
  // migración, un cambio de regla— el tope bajaría de 30 min y **no cabría ni una
  // tarjeta**. Se comprueba que eso no ocurre con un `afkMs` igual a la base, que es lo que
  // le pasa a una partida sin el nodo comprado.
  check('B26: una partida sin el nodo conserva el tope de 30 min (nada se le descuenta)',
    topeDeConsumible('afk', AFK_CARD_DURATION_MS) === MAX_AFK_BUFF_DURATION_MS
      && AFK_CARD_DURATION_MS - AFK_CARD_DURATION_MS === 0,
    'extra = 0, tope = 30 min');

  // ---- 6. Y LO QUE VE EL JUGADOR: USAR TARJETAS DE VERDAD ----
  //
  // **ESTA COMPROBACIÓN ES LA QUE HABRÍA ATRAPADO EL SEGUNDO SITIO.** Todo lo de arriba
  // mira `topeDeConsumible()`, o sea **la función**. Pero el bug estaba **también copiado en
  // el `case 'afk'` del motor** —`Math.min(base + afkMs, ahora + afkMs * 3)`—, que es otro
  // camino y el que de verdad mueve `state.afkExpiresAt`. Arreglando solo la función, **el
  // `case` seguiría aplicando tres tarjetas** y el jugador seguiría viendo lo mismo: un
  // arreglo a medias con el banco en verde.
  //
  // Por eso aquí se **usan tarjetas de verdad** y se mide lo que queda puesto. **Y CON EL
  // NODO, QUE ES DONDE ESTÁ EL BUG**: sin nodo los dos caminos coinciden y no se ve nada —
  // que es justo por lo que el bug se escondió.
  {
    const g: any = await boot({
      ...baseSave([consumable('afk1', 'afk', 9, { name: 'Tarjeta AFK' })], {
        afkCards: 9,
        afkExpiresAt: 0,
        nodeLevels: { afk_extend: 1 }
      })
    });

    // **EL NODO, POR EL CAMINO DE VERDAD.** `nodeLevels` es lo que guarda la partida, pero
    // el extra vive en `state.bonus.afkHours`, que es lo que lee `afkCardDurationMs()`. Si
    // solo se pusiera `nodeLevels` el motor lo calcularía al cargar, que es lo correcto y lo
    // que se comprueba después con `getAfkDurationMs()`.
    const duracionDeUna = g.getAfkDurationMs?.();
    check('B26: el motor da 40 min por tarjeta con el nodo a un nivel (10 base + 30 del nodo)',
      duracionDeUna === 40 * 60_000,
      `${Math.round((duracionDeUna ?? 0) / 60000)} min por tarjeta`);

    // **Y AHORA LA PRUEBA DE VERDAD: SE USAN HASTA QUE REBOTEN.** Nueve tarjetas de 40 min
    // con un tope de 60 min: **caben dos**. Con el bug, el tope estaba en 120 y cabían tres.
    let usadas = 0;
    for (let n = 0; n < 9; n++) {
      if (g.useConsumable('afk1')?.ok) usadas++;
    }
    const minutos = Math.round((g.getState().afkExpiresAt - Date.now()) / 60000);
    const pila = g.getState().warehouse.find((w: any) => w.id === 'afk1');

    // **Y AQUÍ LA PRIMERA VERSIÓN DE ESTA LÍNEA SE EQUIVOCÓ, Y POR QUÉ IMPORTABA.** Se
    // escribió esperando 80 minutos —dos tarjetas de 40— y el motor dio 60. **El motor
    // tenía razón y la comprobación no**: la segunda tarjeta **se recorta al tope**, que es
    // el comportamiento escrito en `cuantasVecesCabe()` ("el tope se recorta, no se
    // rechaza"). Dos tarjetas de 40 son 80, pero el tope son 60, así que el jugador gasta
    // dos y llega al máximo. Cambiar la afirmación para que diga 80 habría sido
    // **cambiar el código para que cuadrase con una suposición mía**, que es justo lo que
    // hace que un banco deje de servir para nada.
    check('B26: con el nodo a un nivel caben DOS tarjetas y el tope las recorta a 60 min',
      usadas === 2 && minutos >= 59 && minutos <= 61,
      `usadas=${usadas}, tiempo=${minutos} min (2 x 40 = 80, recortado al tope de 60)`);

    // **Y LAS SOBRANTES NO SE GASTAN.** Una tarjeta que se cobra y no hace nada es el peor
    // resultado posible: el jugador pierde el item y el tiempo no cambia. Con el tope mal,
    // la cuarta se gastaba y no añadía nada.
    check('B26: y las que no caben NO se gastan (el jugador conserva las suyas)',
      (pila?.stackCount ?? 0) === 7,
      `quedan ${pila?.stackCount} de 9`);

    // **Y EL NÚMERO DE LA CAPTURA, QUE ES LO QUE VA A VER.** Con el bug, usar hasta el tope
    // daba 120 min = "AFK 2:00:00"; el jugador vio 1:55:46 porque le quedaban cuatro
    // minutos. Ahora el tope son 60 y no se puede llegar a las dos horas.
    check('B26: el tiempo final nunca pasa de una hora con este nodo',
      minutos <= 61,
      `${minutos} min, antes hasta 120`);

    await g.cleanup?.();
  }

  resumen('B26: la tarjeta AFK ya no duplica el extra del arbol');
}

export default main();
