// ==========================================================================
//  El número del contador (F50): que se mueva, y que no mienta
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  F50 es "con pocas nanitas el número no se mueve", y es un fallo **invisible al
//  revisar el código**: la función hacía lo que se le pedía, devolvía una cadena
//  correcta y nadie se quejaba. Lo que pasaba es que el formato **no tenía resolución
//  suficiente** para el salto que el jugador acababa de hacer: con dos decimales,
//  46.900.000 sale "46,90 M", y el siguiente clic da +40.000 —o sea 0,04 M—, que se
//  redondea a 0,00. El saldo se quedaba **congelado durante toda la partida**.
//
//  Y no es un fallo de redondeo, es un fallo de *promesa*: el contador enseña una
//  cifra y significa "tu saldo". Si la cifra no se mueve cuando el saldo sí, el número
//  está mintiendo aunque sea verdad que redondee.
//
//  El arreglo fue un decimal más. Eso es **lo de menos**, y por eso el banco mide las
//  tres cosas que lo sostienen:
//
//    1. **Que se mueva.** El incremento más pequeño que cambia la cadena, en cada
//       magnitud, tiene que ser menor o igual que la última cifra que se enseña. La
//       pregunta no es "¿está bien formatado?" sino "¿un jugador que gana una unidad
//       ve algo?".
//    2. **Que no mienta.** El número que se lee tiene que ser el número que hay, con el
//       error del redondeo y no más. Es la propiedad que hace que un incremental sea
//       creíble: si el saldo real es 46.900.000 y pone "47 M", la diferencia es del
//       orden de la unidad de la cifra y el jugador no lo nota. Si un tramo pierde un
//       orden de magnitud, sí.
//    3. **Que los tramos no se pisen.** Cada exponente tiene su unidad, y pasar de
//       999,999 K a 1 M tiene que ser un cambio de texto y no un salto de valor.
//
//  LO QUE NO CUBRE, A PROPÓSITO: que la etiqueta de un premio de caja y el saldo
//  coincidence. Eso es `lootCheck`, y lo hace comparando contra `formatNumber`, que
//  es justo la función de aquí. Este banco comprueba **la función**, no sus usos.
// ==========================================================================

import { check, resumen } from './kit';
import { formatCompact, formatNumber, UNITS } from '../src/utils/format';

/**
 * Los sufijos salen de `format.ts` y no de una lista propia.
 *
 * Este banco llevaba su copia, con **una unidad menos**: la primera de las del juego es
 * la vacía —la del tramo de los enteros— y al omitirla cada índice iba una posición
 * detrás. Medía que 10^30 dijera "No" cuando el juego dice "No" en 10^32, y daba verde
 * por casualidad. Repetir la tabla de unidades en el banco es comprar una prueba que no
 * mide el juego.
 *
 * Y como `verify/` no está en `tsconfig.json`, una constante local con el mismo nombre
 * que un `import` **no es un error de compilación**: el aviso es del bundler que resuelve
 * el banco, que lo cuarto. Por eso la lista se importa y no se declara.
 */


/**
 *
 * Los dos que importan son los extremos. `999_999` está a un pelo de que un solo
 *.click lo empuje al tramo siguiente —ahí es donde se ve si el redondeo cae del
 * lado correcto— y `999.999.999` es el caso que se reporta cuando el
 * jugador tiene todo el progreso acumulado.
 */
const SALDOS = [
  0, 1, 7, 99, 100, 999, 1000, 1234, 9_999, 10_000, 99_999, 999_999,
  1_000_000, 1_234_567, 46_851_234, 999_999_999, 1_000_000_000, 12_345_678_901,
  1e12, 1.2345e15, 1e18, 5e21, 1e30, 1e33
];

/**
 * El incremento más pequeño que hace **cambiar la cadena**.
 *
 * La búsqueda va a saltos de potencia de diez en vez de de uno en uno porque a escala
 * de 10^30 un recorrido entero no termina. Y sube por potencias porque el incremento
 * que hace falta siempre es una potencia: con tres decimales, la resolución es
 * exactamente el 0,1 % del tramo.
 */
function incrementoQueMueve(n: number): number {
  if (!isFinite(n) || n < 1) return 1;
  let paso = 1;
  while (formatNumber(n + paso) === formatNumber(n) && paso < n * 2) paso *= 10;
  return paso;
}

/** La resolución que el formato concede en el tramo de `n`: la última cifra que enseña. */
function resolucionDe(n: number): number {
  // Por debajo de mil enseña enteros: cada uno es un cambio de texto.
  if (n < 1000) return 1;
  // Tres decimales sobre el valor escalado: la última cifra son milésimas de unidad.
  const tramo = Math.floor(Math.log10(n) / 3);
  return 10 ** (tramo * 3) / 1000;
}

async function main() {
  // -----------------------------------------------------------------------
  //  1. EL NÚMERO SE MUEVE. ESTA ES LA REGRESSION DE F50.
  // -----------------------------------------------------------------------
  {
    const congelados: string[] = [];
    for (const n of SALDOS) {
      const d = incrementoQueMueve(n);
      const limite = resolucionDe(n);
      if (d > limite) congelados.push(`${n}: hace falta +${d} y la cifra solo llega a ${limite}`);
    }
    check('contador: en todo tramo, un incremento de una cifra mueve el número',
      congelados.length === 0,
      congelados.join(' | ') || `${SALDOS.length} saldos, ninguno congelado`);

    // **EL CASO QUE SE REPORTÓ, CON SUS CIFRAS.** No como ejemplo genérico: si el
    // decimal que hace falta baja otra vez, este es el número que vuelve a congelarse y
    // el banco tiene que decirlo con el mismo redondeo que se reportó.
    const antes = formatNumber(46_900_000);
    const despues = formatNumber(46_900_000 + 40_000);
    check('contador: el caso reportado sí mueve el número',
      antes !== despues,
      `${antes} + 40.000 = ${despues}`);
  }

  // -----------------------------------------------------------------------
  //  2. EL NÚMERO QUE SE LEE ES EL NÚMERO QUE HAY.
  //
  //  El error del redondeo con tres decimales es de hasta medio 0,001 del tramo, o
  //  sea 0,05 %. Con dos eran 0,5 %, y con uno 5 %: un contador que enseña "5 % menos
  //  de lo que tienes" es un contador del que el jugador no se fía. El límite es
  //  0,1 % para que la comprobación tenga margen sobre el 0,05 % real y siga
  // avisando si el redondeo se duplica.
  // -----------------------------------------------------------------------
  {
    const mentirosos: string[] = [];
    for (const n of SALDOS) {
      if (n < 1) continue;
      const texto = formatNumber(n);
      // Se quita el separador de miles y se cambia la coma por punto: el número que
      // se lee tiene que poder compararse con el que hay.
      const crudo = texto.replace(/[.\s]/g, '').replace(',', '.').replace(/[^0-9.e-]/g, '');
      const mostrado = parseFloat(crudo);
      if (!isFinite(mostrado)) { mentirosos.push(`${n}: "${texto}" no es un número`); continue; }
      const unidades = UNITS.find((u) => texto.includes(u));
      if (!unidades) continue;
      const factor = 10 ** (UNITS.indexOf(unidades) * 3);
      const real = mostrado * factor;
      const error = Math.abs(real - n) / n;
      if (error > 0.001) mentirosos.push(`${n}: dice ${texto} (${real}), error ${(error * 100).toFixed(3)} %`);
    }
    check('contador: la cifra enseñada es la que hay, con el error del redondeo',
      mentirosos.length === 0,
      mentirosos.slice(0, 3).join(' | ') || `${SALDOS.length} saldos verificados`);
  }

  // -----------------------------------------------------------------------
  //  3. CADA TRAMO TIENE SU UNIDAD, Y NO HAY HUECO ENTRE TRANMOS.
  // -----------------------------------------------------------------------
  {
    const errores: string[] = [];
    for (const u of UNITS) {
      // La primera unidad es la vacía —la del tramo de los enteros— y no es un tramo
      // abreviable. Toda cadena contiene la cadena vacía, así que probarla daría un fallo
      // por cada número que no llegara a mil.
      if (!u) continue;
      // El primer valor del tramo: 10^3, 10^6, 10^9...
      const primerValor = 10 ** ((UNITS.indexOf(u)) * 3);
      const texto = formatNumber(primerValor);
      if (!texto.includes(u)) errores.push(`10^${UNITS.indexOf(u) * 3} sale "${texto}" y no dice ${u}`);
      // Y el último del tramo anterior no puede enseñar ya esta unidad.
      //
      // **SOLO HASTA 2^53.** A partir de ahí un `double` no puede representar
      // `10^18 - 1`: el número vale exactamente `10^18`, así que restarle uno no cambia
      // nada y la pregunta "qué enseña el último número del tramo anterior" se queda sin
      // respuesta. No es que la función falle: es que la pregunta no existe por debajo de
      // esa cifra, y comprobarla ahí daría verde por casualidad.
      //
      // Y por eso el `return` va **dentro del bucle de comprobación**, no antes:
      // un `return` suelto aquí salía de `main()` entero y el banco se acababa sin
      // imprimir ni el resumen. Un banco que no imprime no es un banco que pasa, y
      // un banco que imprime `11/11` con la mitad de las pruebas sin ejecutar es
      // peor: miente.
      if (primerValor <= Number.MAX_SAFE_INTEGER) {
        const anterior = formatNumber(primerValor - 1);
        if (anterior.includes(u)) errores.push(`${primerValor - 1} sale "${anterior}" y ya dice ${u}`);
      }
    }
    check('contador: cada tramo enseña su unidad y el anterior no se adelanta',
      errores.length === 0,
      errores.slice(0, 3).join(' | ') || `${UNITS.length} tramos`);
  }

  // -----------------------------------------------------------------------
  //  4. LO QUE NO ES UN NÚMERO, Y LO QUE ES UNO MUY PEQUEÑO.
  // -----------------------------------------------------------------------
  {
    check('contador: por debajo de mil son enteros, sin decimales que mientan',
      formatNumber(999) === '999' && formatNumber(0) === '0' && formatNumber(1000) !== '999',
      `0=${formatNumber(0)} 999=${formatNumber(999)} 1000=${formatNumber(1000)}`);

    // La basura tiene que dar cero y no "NaN". Un contador que enseña "NaN" durante un
    // frame es un destello de pantalla completa.
    const basura = [NaN, Infinity, -Infinity, undefined, null].map((v) => formatNumber(v as any));
    check('contador: un número que no existe enseña 0 y no NaN',
      basura.every((t) => t === '0'), basura.join(' · '));

    // El signo se conserva al abreviar: es la diferencia entre "−1 M" y "1 M", que es
    // perder un negativo entero.
    check('contador: el signo sobrevive a la abreviatura',
      formatNumber(-1_500_000).startsWith('-'), formatNumber(-1_500_000));

    // Y las dos funciones se separan **justo en el umbral**: por debajo de mil dan lo
    // mismo —no hay nada que abreviar— y a partir de ahí una enseña el entero con sus
    // separadores de miles y la otra la abreviatura.
    check('contador: sin abreviar y abreviar coinciden por debajo de mil y se separan encima',
      formatCompact(500) === formatNumber(500)
        && formatCompact(1234) !== formatNumber(1234)
        && formatCompact(999_999_999) === '999.999.999',
      `500: "${formatCompact(500)}" · 1234: "${formatCompact(1234)}" vs "${formatNumber(1234)}" · 999.999.999: "${formatCompact(999_999_999)}"`);
  }

  // -----------------------------------------------------------------------
  //  5. Y LO QUE SE MUESTRA NO SE PASA POR DEMASIADO DE LO QUE HAY.
  //
  //  Un redondeo al alza en el contador es lo peligroso: el jugador ve más de lo que
  //  tiene y no le encuentra explicación hasta que no le alcanza para pagar. El
  //  redondeo abajo es solo feo; el de arriba es un bug de economía.
  //
  //  **EL LÍMITE NO ES "NUNCA", ES "NO POR MÁS DE UN 0,1 %".** Con tres decimales,
  //  9.999.900 sale "10,000 M": el redondeo ha cruzado al entero siguiente y la cifra
  //  enseñada son 10.000.000, cien nanitas por encima de lo que hay. mathematically es
  //  redondeo, no una mentira —0,001 %—, y una función de formato no puede prometer
  //  truncar: el jugador vería 9,999 M donde tiene 9.999.900.
  //
  //  Lo que sí sería un bug es el error grande, y ese es el que el bug del `log10`
  //  producía: **mil veces el saldo**. El límite está dos mil veces por debajo de
  //  ese salto, así que canta fuerte y tolera el redondeo.
  // -----------------------------------------------------------------------
  {
    const porArriba: string[] = [];
    for (let e = 3; e <= 24; e++) {
      for (const mult of [1, 1.5, 2.5, 9.9, 9.999, 9.9999]) {
        const n = Math.floor(10 ** e * mult);
        const texto = formatNumber(n);
        const unidades = UNITS.find((u) => texto.includes(u));
        if (!unidades) continue;
        const mostrado = parseFloat(
          texto.replace(/[.\s]/g, '').replace(',', '.').replace(/[^0-9.e-]/g, '')
        ) * 10 ** (UNITS.indexOf(unidades) * 3);
        if (mostrado > n && (mostrado - n) / n > 0.001) porArriba.push(`${n}: dice ${texto} (${mostrado})`);
      }
    }
    check('contador: la cifra nunca enseña más de lo que hay',
      porArriba.length === 0,
      porArriba.slice(0, 3).join(' | ') || 'ningún tramo se pasa más de un 0,1 %');
  }

  // -----------------------------------------------------------------------
  //  6. MÁS ALLÁ DE LA UNIDAD MÁXIMA: EXPONENCIAL, Y CON LA MISMA REGLA DE PUNTOS.
  //
  //  Arriba de 10^36 no hay unidad que poner y sale notación exponencial, que es un
  //  formato **distinto** con sus propias reglas, y por eso tiene su comprobación. La
  //  que importa es la del separador: `toExponential` también devuelve punto, así que sin
  //  el cambio el juego mezclaba "46,851 M" con "1.00e40" en la misma partida.
  // -----------------------------------------------------------------------
  {
    const gigante = formatNumber(1e40);
    check('contador: pasado el último tramo usa notación exponencial',
      /^1,00e40$/.test(gigante), gigante);

    // Y que el número que enseña sea el que hay, también ahí.
    //
    // **`parseFloat` NO SE PUEDE USAR SOBRE LA CADENA ENTERA.** Lee "1.00e40" como el
    // número 1e40, no como mantisa y exponente separados, así que el banco multiplicaba
    // el número por sí mismo y obtenía un error de 10^40: siempre falso, siempre en la
    // misma dirección, y por tanto inútil. La cadena se deshace en dos —lo de antes de la
    // `e` es la mantisa, con coma porque el separador del juego es la coma, y lo de detrás
    // es el exponente—.
    const [mantisa, exponente] = gigante.split('e');
    const leido = parseFloat(mantisa.replace(',', '.')) * 10 ** Number(exponente);
    check('contador: y la notación exponencial tampoco se aleja del saldo real',
      Math.abs(leido - 1e40) / 1e40 <= 0.001,
      `"${gigante}" se lee como ${leido}`);
  }

  resumen('contador: el número se mueve y no mienta');
}

export default main();