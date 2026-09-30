// Formateo de numeros grandes.
//
// Antes esta funcion estaba copiada en cinco archivos (main, gameLoop, store,
// warehouse, rankings) y tres de ellas usaban un algoritmo distinto: unas
// llegaba hasta 'Sx' (septillón) y otras solo hasta 'B'. Un solo sitio.

// Sufijos de escala corta. Cubrimos hasta 1e33, que es de sobra para un
// incremental; más allá se pasa a notación exponencial.
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const THRESHOLD = 1000;

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
  // 1 decimal hasta los millones, 2 por encima: evita "1.0 M" y "1.00 M"
  const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return `${negative ? '-' : ''}${scaled.toFixed(decimals)} ${UNITS[tier]}`;
}

/** Igual que formatNumber pero sin decimales: para contadores enteros. */
export function formatCompact(num: number): string {
  return formatNumber(Math.floor(num));
}
