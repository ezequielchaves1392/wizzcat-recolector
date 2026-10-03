import { TIER_SYSTEM } from './tiers';

/**
 * El nombre que le toca a un item, por tier, de entre los tres que hay.
 *
 * **POR QUÉ ESTÁ EN UN MÓDULO PROPIO, CON DOCE LÍNEAS.**
 *
 * `generators.ts` tira el potencial del compañero y necesita un nombre.
 * `crafting.ts` construye el compañero **forjado**, que no lo tira, y también
 * necesita un nombre. Si cada uno guardara su copia, un día una cambiaría y la
 * otra no. Y si `crafting.ts` importara de `generators.ts`, ambos se importarían
 * mutuamente: eso aguanta hasta que un cambio mete una constante en el sitio
 * equivocado, y el fallo aparece en un fichero que no tiene nada que ver.
 *
 * Con esto, los dos dependen de un módulo que no depende de ninguno.
 */
export function nombreDe(tipo: 'companion' | 'collector', tier: number, rng: () => number): string {
  const tabla = tipo === 'companion' ? TIER_SYSTEM.companionNames : TIER_SYSTEM.collectorNames;
  const nombres = (tabla as Record<number, readonly string[]>)[tier]
    || [tipo === 'companion' ? 'Dron Explorador' : 'Blaster Láser'];
  return nombres[Math.floor(rng() * nombres.length)];
}