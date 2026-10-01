// ==========================================================================
//  Los generadores: un compañero o un recolector nuevo, de un tier dado
// ==========================================================================
//  POR QUÉ NO EN EL MOTOR.
//
//  Son funciones que tiran un dado y devuelven un objeto. No tocan `state`, no
//  necesitan la partida y se pueden comprobar solas. Que estuvieran en
//  `gameLoop.ts` obligaba a importarlo entero para crear un compañero, que es
//  arrastrar Firebase, el guardado y la cola de nanitas para pedir un número al
//  azar.
//
//  Y hay un detalle que conviene no perder: la.power se saca del RANGO del tier,
//  del mismo `TIER_SYSTEM.ranges` que usa el precio de su carta. Por eso
//  compañero y recolector del mismo tier cuestan lo mismo y dan el mismo poder.
//  Si un generador dejara de usar el rango y pusiera un número suelto, el precio
//  dejaría de seguir al poder y el banco de balance se enteraría.
// ==========================================================================

import { TIER_SYSTEM } from './tiers';

/** El nombre que le toca, por tier, de entre los tres que hay. */
function nombreDe(tipo: 'companion' | 'collector', tier: number, rng: () => number): string {
  const tabla = tipo === 'companion' ? TIER_SYSTEM.companionNames : TIER_SYSTEM.collectorNames;
  const nombres = (tabla as Record<number, readonly string[]>)[tier] || [tipo === 'companion' ? 'Dron Explorador' : 'Blaster Láser'];
  return nombres[Math.floor(rng() * nombres.length)];
}

/** El poder del tier, dentro de su rango, sin salirse nunca. */
function poderDe(tier: number, rng: () => number): number {
  const rango = TIER_SYSTEM.ranges[tier] || [1, 5];
  return Math.floor(rng() * (rango[1] - rango[0] + 1)) + rango[0];
}

/**
 * Un compañero nuevo del tier pedido.
 *
 * `type: 'click'` para todos los de la tienda, a propósito: el flotante que
 * anuncia y el ingreso por segundo son la misma cifra para ellos. Los `passive` y
 * `multiplier` son solo de caja, y salen de `crateLoot.ts`, que es donde vive
 * la tabla de botín.
 */
export function generateCompanionByTier(
  tier: number,
  rng: () => number = Math.random
): { id: string; name: string; type: 'click' | 'passive' | 'multiplier'; power: number; rarity: string; tier: number } {
  return {
    id: `comp_t${tier}_${Date.now()}_${Math.floor(rng() * 1e9).toString(36).substring(2, 7)}`,
    name: nombreDe('companion', tier, rng),
    type: 'click',
    power: poderDe(tier, rng),
    rarity: TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier] || 'Común',
    tier
  };
}

/**
 * Un recolector nuevo del tier pedido.
 *
 * El `damage` es el poder del rango, y `details` lo dice con el mismo número: si
 * el texto y el daño no coinciden, el jugador compara la ficha con lo que le da
 * y no entiende la diferencia.
 */
export function generateCollectorByTier(
  tier: number,
  rng: () => number = Math.random
): { id: string; name: string; type: string; details: string; rarity: string; tier: number; level: number; damage: number } {
  const power = poderDe(tier, rng);
  return {
    id: `collector_t${tier}_${Date.now()}_${Math.floor(rng() * 1e9).toString(36).substring(2, 7)}`,
    name: nombreDe('collector', tier, rng),
    type: 'collector',
    details: `Recolección por click: +${power}`,
    rarity: TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier] || 'Común',
    tier,
    level: 0,
    damage: power
  };
}