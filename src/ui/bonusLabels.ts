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
    case 'clickMult': return `${pct(value)} recolección por click`;
    case 'clickPorForja': return `${Math.round(value * 100)}% de tu forja como click`;
    case 'passiveMult': return `${pct(value)} recolección por segundo`;
    case 'costReduction': return `−${Math.round(value * 100)}% coste de tienda`;
    case 'sellMult': return `${pct(value)} precio de venta`;
    case 'craftLuck': return `${pct(value)} éxito de forja`;
    case 'forgePotential': return `${pct(value)} subida de potencial`;
    case 'consolationBonus': return `${pct(value)} cristales por fallo`;
    case 'autoClick': return `+${value} clicks/s automáticos`;
    case 'afkHours': return `+${value * 60} min de AFK`;
    case 'offlineClicks': return `+${value} clicks al volver`;
    case 'crateLuck': return `${pct(value)} de que la caja dé un tier más`;
    case 'coreGain': return `${pct(value)} núcleos por reinicio`;
    case 'storageSlots': return `+${value} slots de almacén`;
    case 'companionSlots': return `+${value} slots de compañero`;
    case 'sobrecargaCada': return `crítico asegurado cada ${value} clicks`;
    case 'sobrecargaMult': return `el asegurado multiplica ×${value}`;
    case 'colmenaPorComp': return `${pct(value)} recolección por segundo por compañero activo`;
    case 'jackpotChance': return `${pct(value)} de subida de tier en cajas`;
    case 'obraMaestra': return `firma Obras Maestras al forjar`;
    case 'licenciaT2': return `vende cajas T2 en la tienda`;
    case 'licenciaT3': return `vende cajas T3 en la tienda`;
    case 'ecoDoble': return `${pct(value)} de botín doble en cajas`;
    //  LOS DOS QUE NOMBRAN A LOS COMPAÑEROS, NO A LA COLECCIÓN EN GENERAL.
    //  `compPasivo` y `compClick` multiplican a un TIPO de compañero, no al total:
    //  decir solo "recolección por segundo" (que es lo que dice `passiveMult`) o
    //  "recolección por click" (que es del recolector, y estos compañeros no
    //  cobran por click) dejaba dos reglas distintas con el mismo rótulo.
    case 'compPasivo': return `${pct(value)} recolección por segundo de tus compañeros pasivos`;
    case 'compClick': return `${pct(value)} recolección por segundo de tus compañeros de click`;
    case 'compMulti': return `${pct(value)} efecto de los compañeros multiplicadores`;
    case 'compDescuento': return `−${Math.round(value * 100)}% coste de mejora`;
    case 'critChance': return `+${Math.round(value * 100)}% prob. de crítico`;
    case 'nanoPerCrate': return `+${value} nanitas por caja`;
    default: return `${key} +${value}`;
  }
}
