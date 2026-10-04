// Formateo de numeros grandes.
//
// Antes esta funcion estaba copiada en cinco archivos (main, gameLoop, store,
// warehouse, rankings) y tres de ellas usaban un algoritmo distinto: unas
// llegaba hasta 'Sx' (septillón) y otras solo hasta 'B'. Un solo sitio.

// Sufijos de escala corta. Cubrimos hasta 1e33, que es de sobra para un
// incremental; más allá se pasa a notación exponencial.
/**
 * Los sufijos de escala corta, **exportados porque el banco los necesita**. Antes eran
 * una constante de este fichero y `contadorCheck` llevaba su propia copia, con una
 * unidad menos: la primera es la vacía, la que corresponde al tramo de los enteros, y
 * sin ella todos los índices iban desplazados y el banco daba verde sobre una lista que
 * no era la del juego. Es la regla del proyecto —una fuente de verdad por regla— y aquí
 * se incumplía justo en el dato que el banco usa para medir.
 */
export const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const THRESHOLD = 1000;

/**
 * CUÁNTOS DECIMALES SE ENSEÑAN CUANDO HACE FALTA ABREVIAR, Y POR QUÉ SON TRES.
 *
 * **ANTES ERA VARIABLE —"1 decimal hasta los millones, 2 por encima"— Y ERA EL MOTIVO DE
 * QUE EL CONTADOR NO SE MUEVESE.** Con dos decimales, 46.900.000 sale "46,90 M" y el
 * siguiente clic da +40.000: el saldo se queda en "46,90 M" durante toda la partida y el
 * jugador no ve avanzar nada. Con **tres**, sale "46,900 M" y el siguiente clic ya mueve
 * el número. Eso es F50 entero —"con pocas nanitas el número no se mueve"— y la
 * solución es tan solo un decimal más.
 *
 * **Y TRES EN TODOS LOS TRAMOS, NO UNO PARA LOS PEQUEÑOS Y TRES PARA LOS GRANDES.** La
 * regla anterior escalonaba porque con dos decimales "1,0 M" y "1,00 M" parecian mal: un
 * decimal que no dice nada y dos que se contradicen. Con tres, "1,000 M" sí dice algo, que
 * es 1.000.000. Y **mantenerlo constante es lo que hace que el número sea comparable con
 * otro número**: si el formato cambiara de forma al pasar de 1 a 10, el jugador vería
 * "9,999 M" y luego "10,00 M" y no sabría si había ganado o perdido.
 *
 * Por debajo de mil **no hay decimales**: son enteros y llevan separador de miles, que es
 * donde se ve la unidad. Los decimales son de la abreviatura, no del número.
 */
const DECIMALES_DE_LA_ABREVIATURA = 3;

/**
 * El separador decimal del juego, y por qué no es el que sale solo.
 *
 * `toFixed` devuelve punto, y en español el punto **es el separador de miles**: la
 * rama de abajo enseña `1.234` para mil doscientos treinta y cuatro. Con el punto en
 * la abreviatura, el mismo carácter significaba dos cosas distintas en la misma
 * pantalla: `1.000 K` se leía como mil con tres decimales o como un millón, según el
 * ojo.
 *
 * La regla del juego es la de `es-ES`, y sale de aquí y no de un `.replace` suelto en
 * cada etiqueta: **coma para los decimales, punto para los miles.**
 */
const SEPARADOR_DECIMAL = ',';

/**
 * El tramo de un número, y por qué **NO** se calcula con `Math.log10`.
 *
 * `Math.floor(Math.log10(value) / 3)` falla en la frontera, y falla justo donde el
 * jugador tiene la partida entera dentro: con 999.999.999.999.999 —catorce cifras y
 * pico— el logaritmo devuelve un valor que al dividir entre tres y redondear hacia
 * abajo da 5 en vez de 4, y el contador enseñaba **`1.000 Qa`**: mil quintillones
 * cuando tenía mil billones. No era un error de formato, era **mil veces el saldo**, y
 * por encima del límite de "el número nunca enseña más de lo que hay".
 *
 * La causa es que un logaritmo devuelve un `double`: en la frontera el redondeo decide,
 * y decide hacia arriba. Dividiendo entre mil en un bucle no hay logaritmo que pueda
 * decidirse mal: cada comparación es exacta, y un entero de 10^15 se queda en el tramo
 * que le toca por construcción. Son doce vueltas como mucho, una vez por llamada.
 */
function tramoDe(value: number): number {
  // El logaritmo da la respuesta casi siempre y **falla en la frontera**, así que la
  // respuesta se corrige contra una comparación exacta.
  let tramo = Math.floor(Math.log10(value) / 3);
  const referencia = Math.pow(THRESHOLD, tramo);
  if (value < referencia) tramo--;
  else if (value >= referencia * THRESHOLD) tramo++;
  return tramo;
}

export function formatNumber(num: number): string {
  if (num === undefined || num === null || !isFinite(num)) return '0';

  const negative = num < 0;
  const value = Math.abs(num);

  if (value < THRESHOLD) {
    return `${negative ? '-' : ''}${Math.floor(value).toLocaleString('es-ES')}`;
  }

  const tier = tramoDe(value);
  if (tier >= UNITS.length) {
    // **Y TAMBIÉN AQUÍ EL SEPARADOR DEL JUEGO.** La notación exponencial es un formato
    // distinto con su propia gramática, pero los decimales son los mismos: si la
    // abreviatura pone "46,851 M" y el exponencial "1.00e40", el mismo punto significa
    // dos cosas en dos sitios y el jugador tiene que aprender dos reglas para lo mismo.
    return value.toExponential(2).replace('.', SEPARADOR_DECIMAL).replace('e+', 'e');
  }

  const scaled = value / Math.pow(THRESHOLD, tier);
  const texto = scaled.toFixed(DECIMALES_DE_LA_ABREVIATURA).replace('.', SEPARADOR_DECIMAL);
  return `${negative ? '-' : ''}${texto} ${UNITS[tier]}`;
}

/**
 * Como `formatNumber`, pero **sin abreviar**: el número entero entero, con su separador
 * de miles.
 *
 * **LA DOCUMENTACIÓN ANTIGUA MENTÍA Y EL CÓDIGO NO HACÍA LO QUE DECÍA.** Decía "sin
 * abreviar", y la implementación era `formatNumber(Math.floor(num))`, que **sí** abrevia:
 * una y otra vez el mismo número, con un entero de más por el camino. No lo usaba
 * nadie, que es la razón por la que nadie se enteró. Ahora hace lo que dice el nombre,
 * y el banco `contadorCheck` lo comprueba comparando las dos funciones en un número que
 * sí cabe y en uno que no.
 */
export function formatCompact(num: number): string {
  if (num === undefined || num === null || !isFinite(num)) return '0';
  return Math.floor(num).toLocaleString('es-ES');
}