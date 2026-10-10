// ==========================================================================
//  Etiquetas de bonificaciones del árbol · un solo sitio
//
//  Las leen la página de Prestigio ("Bonificaciones activas") y el simulador
//  de la Wiki. Son texto, no regla, pero dos copias se separan igual: el día
//  que un bonus cambie de nombre, una diría una cosa y la otra otra.
// ==========================================================================

import type { PassiveBonuses } from '../types/domain';

/** Etiqueta legible de una bonificación, con su valor. */
export function bonusLabel(key: keyof PassiveBonuses, value: number): string {
  const pct = (v: number) => `+${Math.round(v * 100)}%`;
  switch (key) {
    case 'clickMult': return `${pct(value)} daño de click`;
    case 'clickPorForja': return `${Math.round(value * 100)}% de tu forja como click`;
    case 'passiveMult': return `${pct(value)} ingreso pasivo`;
    case 'costReduction': return `−${Math.round(value * 100)}% coste de tienda`;
    case 'sellMult': return `${pct(value)} precio de venta`;
    case 'craftLuck': return `${pct(value)} éxito de forja`;
    case 'forgePotential': return `${pct(value)} subida de potencial`;
    case 'consolationBonus': return `${pct(value)} cristales por fallo`;
    case 'autoClick': return `+${value} clics/s automáticos`;
    case 'afkHours': return `+${value * 60} min de AFK`;
    case 'offlineClicks': return `+${value} clics al volver`;
    case 'crateLuck': return `${pct(value)} salto de caja`;
    case 'coreGain': return `${pct(value)} núcleos por reinicio`;
    case 'storageSlots': return `+${value} slots de almacén`;
    case 'companionSlots': return `+${value} slots de compañero`;
    case 'sobrecargaCada': return `crítico asegurado cada ${value} clics`;
    case 'sobrecargaMult': return `el asegurado pega ×${value}`;
    case 'colmenaPorComp': return `${pct(value)} pasivo por compañero activo`;
    case 'jackpotChance': return `${pct(value)} de subida de tier en cajas`;
    case 'obraMaestra': return `firma Obras Maestras al forjar`;
    case 'licenciaT2': return `vende cajas T2 en la tienda`;
    case 'licenciaT3': return `vende cajas T3 en la tienda`;
    case 'ecoDoble': return `${pct(value)} de botín doble en cajas`;
    case 'compPasivo': return `${pct(value)} poder de pasivos`;
    case 'compClick': return `${pct(value)} poder de clicks`;
    case 'compMulti': return `${pct(value)} efecto multiplier`;
    case 'compDescuento': return `−${Math.round(value * 100)}% coste de mejora`;
    case 'critChance': return `+${Math.round(value * 100)}% prob. de crítico`;
    case 'nanoPerCrate': return `+${value} nanitas por caja`;
    default: return `${key} +${value}`;
  }
}
