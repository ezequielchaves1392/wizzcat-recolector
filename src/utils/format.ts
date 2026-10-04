// Formateo de numeros grandes.
//
// Antes esta funcion estaba copiada en cinco archivos (main, gameLoop, store,
// warehouse, rankings) y tres de ellas usaban un algoritmo distinto: unas
// llegaba hasta 'Sx' (septillón) y otras solo hasta 'B'. Un solo sitio.

// Sufijos de escala corta. Cubrimos hasta 1e33, que es de sobra para un
// incremental; más allá se pasa a notación exponencial.
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
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

export function formatNumber(num: number): string {
  if (num === undefined || num === null || !isFinite(num)) return '0';

  const negative = num < 0;
  const value = Math.abs(num);

  if (value < THRESHOLD) {
    return `${negative ? '-' : ''}${Math.floor(value).toLocaleString('es-ES')}`;
  }

  let tier = Math.floor(Math.log10(value) / 3);
  if (tier >= UNITS.length) {
    return value.toExponential(2).replace('e+', 'e');
  }

  const scaled = value / Math.pow(THRESHOLD, tier);
  return `${negative ? '-' : ''}${scaled.toFixed(DECIMALES_DE_LA_ABREVIATURA)} ${UNITS[tier]}`;
}

/**
 * Como `formatNumber`, pero **sin abreviar**: para un contador en el que el numero
 * entero es lo que importa y "1,000 M" ocuparia el sitio de "1000". No se usa en ningun
 * sitio todavia; se queda porque es la pieza obvia si algum dia hace falta.
 */
export function formatCompact(num: number): string {
  return formatNumber(Math.floor(num));
}
