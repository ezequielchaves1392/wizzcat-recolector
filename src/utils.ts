export function formatNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num < 1000) return Math.floor(num).toLocaleString();

  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
  const exponent = Math.floor(Math.log10(num) / 3);

  if (exponent >= units.length) {
    return num.toExponential(2);
  }

  const scaled = num / Math.pow(10, exponent * 3);
  return `${scaled.toFixed(2)} ${units[exponent]}`;
}