// ==========================================================================
// F74 · LAS BASES OCULTAS: 10 POR TIER, 200 EN TOTAL (T1–T10)
// ==========================================================================
//
// **POR QUÉ ESTE ARCHIVO EXISTE, Y NO EN `tiers.ts`.** Las bases son **la caza**,
// y `tiers.ts` es el techo del tier. Separarlas permite que el balance de la caza
// (pesos, rarezas, nombres) viva en un sitio y el techo del tier en otro, sin
// que un cambio en uno rompa al otro. `loreCheck` solo lee este archivo.
//
// **LO QUE UNA BASE ES, Y LO QUE NO.** Una base **no es un nombre bonito**: es un
// **peso de stat** (cuánto daño/ingreso trae) y un **peso de drop** (qué tan rara
// sale). El nombre y el lore son **contenido**, y viven aquí para que `loreCheck`
// pueda verificar que cada base tiene su lore sin tocar el motor.
//
// **LA FÓRMULA, EN UNA LÍNEA:**
//   daño/poder = baseDelTier(tier) × multiplicadorDeBase(base) × multiplicadorDePotencial(★) × multiplicadorDeNivel(nivel)
//
// **LA BASE ES ±10% ALREDEDOR:** de ×0,92 a ×1,10. Suficiente para que dos T1 ★3
// se noten distintos al pegarlos, sin destronar a las estrellas. Si la base moviera
// mucho, el potencial dejaría de importar.
//
// **EL PESO DE DROP ES `11 − posición`:** La mejor base (posición 10) sale con
// peso 1 y la peor (posición 1) con peso 10: diez veces menos. Lineal se nota en
// una tarde de cajas; exponencial se nota en un mes.
//
// **200 BASES EN TOTAL, PERO F74 EMPIEZA CON 30 (T1–T3).** Las 170 restantes
// se escriben cuando el mecanismo está probado y la caza se mide en partida.
// ==========================================================================
 
export interface BaseOculta {
  /** Identificador único: `base_t{tier}_{posición}`. Ej: `base_t1_5`. */
  id: string;
  /** 1..10 dentro del tier. */
  posicion: number;
  /** 1..10. Tier al que pertenece. */
  tier: number;
  /** Multiplicador del stat: 0.92 .. 1.10 (centrado en 1.0 en la posición 5/6). */
  pesoStat: number;
  /** Peso de drop: 11 - posición. La mejor (10) sale 10x menos que la peor (1). */
  pesoDrop: number;
  /** Nombre visible. Se usa en `loreCheck` y en la UI. */
  nombre: string;
  /** Texto de lore. Se usa en `loreCheck` y en la ficha del item. */
  lore: string;
}

/** TODAS LAS BASES, ÍNDICE POR TIER Y POSICIÓN. */
export const BASES_POR_TIER: Record<number, BaseOculta[]> = {
  1: [
    { id: 'base_t1_1',  posicion: 1,  tier: 1, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Núcleo Defectuoso',      lore: 'Un primer intento que apenas calienta. La mayoría lo descarta, pero los coleccionistas saben que cada defecto es una firma única.' },
    { id: 'base_t1_2',  posicion: 2,  tier: 1, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Fragmento Inestable',    lore: 'Vibra con una energía que no termina de decidirse. Quien lo domina, domina el caos.' },
    { id: 'base_t1_3',  posicion: 3,  tier: 1, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Semilla de Chatarra',    lore: 'Parece basura, pero en las manos correctas florece. Los grandes imperios empezaron así.' },
    { id: 'base_t1_4',  posicion: 4,  tier: 1, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Trozo Olvidado',        lore: 'Yació en el olvido hasta que alguien vio su brillo. Ahora late con fuerza contenida.' },
    { id: 'base_t1_5',  posicion: 5,  tier: 1, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Núcleo Estándar',       lore: 'El estándar contra el que se miden todos los demás. No brilla, pero nunca falla.' },
    { id: 'base_t1_6',  posicion: 6,  tier: 1, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Fragmento Pulido',      lore: 'Cada golpe del martillo le quitó lo que sobraba. Lo que queda es puro propósito.' },
    { id: 'base_t1_7',  posicion: 7,  tier: 1, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Núcleo Afilado',        lore: 'Corta el aire con un susurro. Los enemigos no oyen el golpe, solo sienten el frío.' },
    { id: 'base_t1_8',  posicion: 8,  tier: 1, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Fragmento Luminoso',    lore: 'Brilla con una luz que no viene de fuera. Quien la porta camina sin sombra.' },
    { id: 'base_t1_9',  posicion: 9,  tier: 1, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Corazón de Acero',      lore: 'Late con un ritmo que no es de este mundo. Los rivales escuchan su eco y retroceden.' },
    { id: 'base_t1_10', posicion: 10, tier: 1, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Estrella Naciente',     lore: 'Nació de una colisión que no debió ocurrir. Ahora arde con la fuerza de mil soles.' },
  ],
  2: [
    { id: 'base_t2_1',  posicion: 1,  tier: 2, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Restos de Batalla',       lore: 'Sobrevivió a una guerra que no recuerda. Cada grieta cuenta una victoria.' },
    { id: 'base_t2_2',  posicion: 2,  tier: 2, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Eco de Guerra',          lore: 'Aún resuena el rugido de la batalla en su interior. Quien lo empuña oye ecos lejanos.' },
    { id: 'base_t2_3',  posicion: 3,  tier: 2, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Forja de Cenizas',        lore: 'Nació del fuego que lo consumió todo. De las cenizas, surgió más fuerte.' },
    { id: 'base_t2_4',  posicion: 4,  tier: 2, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Metal Curado',           lore: 'El tiempo y el martillo lo curaron. Ahora es más duro que el diamante.' },
    { id: 'base_t2_5',  posicion: 5,  tier: 2, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Acero Templado',         lore: 'El estándar de los veteranos. No brilla, pero aguanta lo que rompe al resto.' },
    { id: 'base_t2_6',  posicion: 6,  tier: 2, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Aleación Fina',          lore: 'La precisión de mil ciclos. Cada molécula está donde debe estar.' },
    { id: 'base_t2_7',  posicion: 7,  tier: 2, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Acero Cantor',           lore: 'Canta al cortar el aire. Sus enemigos oyen la melodía y bajan la guardia.' },
    { id: 'base_t2_8',  posicion: 8,  tier: 2, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Filosa Aurora',          lore: 'Brilla con la primera luz del día. La noche huye ante su filo.' },
    { id: 'base_t2_9',  posicion: 9,  tier: 2, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Corazón de Titanio',     lore: 'Late con la fuerza de una estrella moribunda. Nada resiste su pulso.' },
    { id: 'base_t2_10', posicion: 10, tier: 2, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Alba Eterna',            lore: 'El amanecer que nunca acaba. Quien la porta trae el día a la noche más oscura.' },
  ],
  3: [
    { id: 'base_t3_1',  posicion: 1,  tier: 3, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Restos Cuánticos',         lore: 'Existe en todos los estados a la vez. Medirlo es elegir su destino.' },
    { id: 'base_t3_2',  posicion: 2,  tier: 3, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Entrelazado Inestable',    lore: 'Vibra con su gemelo al otro lado del universo. Separarlos es imposible.' },
    { id: 'base_t3_3',  posicion: 3,  tier: 3, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Superposición Rota',       lore: 'Decidió ser dos cosas a la vez. El universo aún no ha decidido castigarlo.' },
    { id: 'base_t3_4',  posicion: 4,  tier: 3, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Colapso Controlado',       lore: 'Se colapsó a propósito. Ahora es más de lo que la suma de sus partes.' },
    { id: 'base_t3_5',  posicion: 5,  tier: 3, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Estado Estable',           lore: 'El equilibrio perfecto entre caos y orden. Los físicos lo estudian, los guerreros lo codician.' },
    { id: 'base_t3_6',  posicion: 6,  tier: 3, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Entrelazado Perfecto',     lore: 'Su gemelo está en la otra punta del cosmos. Juntos, son invencibles.' },
    { id: 'base_t3_7',  posicion: 7,  tier: 3, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Colapso Dorado',           lore: 'Se colapsó en oro puro. Quien lo toca siente el peso de mil decisiones.' },
    { id: 'base_t3_8',  posicion: 8,  tier: 3, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Singularidad Brillante',   lore: 'La luz se curva a su alrededor. La física se inclina ante su paso.' },
    { id: 'base_t3_9',  posicion: 9,  tier: 3, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Núcleo de Neutrones',      lore: 'La materia más densa que existe. Un cubo pesa más que una montaña.' },
    { id: 'base_t3_10', posicion: 10, tier: 3, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Singularidad Absoluta',    lore: 'Donde el tiempo y el espacio se rinden. El final y el principio, en uno.' },
  ],
};

/** Busca una base por su ID. */
export function basePorId(id: string): BaseOculta | undefined {
  for (const tier of Object.values(BASES_POR_TIER)) {
    const b = tier.find(b => b.id === id);
    if (b) return b;
  }
  return undefined;
}

/** Devuelve la base en la posición `pos` (1..10) del `tier`. */
export function basePorPosicion(tier: number, posicion: number): BaseOculta | undefined {
  return BASES_POR_TIER[tier]?.[posicion - 1];
}

/** El multiplicador de base que se aplica en la fórmula. */
export function multiplicadorDeBase(base: BaseOculta): number {
  return base.pesoStat;
}

/** Genera una base aleatoria para el `tier` dado, usando los pesos de drop. */
export function baseAleatoria(tier: number): BaseOculta {
  const bases = BASES_POR_TIER[tier];
  if (!bases || !bases.length) {
    throw new Error(`No hay bases definidas para el tier ${tier}`);
  }
  const total = bases.reduce((s, b) => s + b.pesoDrop, 0);
  let r = Math.random() * total;
  for (const b of bases) {
    r -= b.pesoDrop;
    if (r <= 0) return b;
  }
  return bases[bases.length - 1]; // fallback
}

/** Todas las bases aplanadas, para `loreCheck`. */
export const TODAS_LAS_BASES: BaseOculta[] = Object.values(BASES_POR_TIER).flat();