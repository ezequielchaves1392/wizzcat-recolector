// ==========================================================================
// Cosméticos · Títulos, marcos y banners
//
// No afectan a la estadística. Su función es dar identidad y un objetivo de
// hunt a quien ya no progresa por potencia. Por eso casi todos se consiguen por
// logros o por permanencia en el ranking, no vendiendo: si se vendieran, el
// marco sería unpay-to-win social y perdería el sentido.
//
// LA EXCEPCIÓN SON LOS DE CAJA, y es una excepción vigilada. Una caja se
// compra con nanitas, así que un cosmético de caja sí se paga. Como no puede
// evitarse, se acota el daño: los de `common` y `rare` se quedan en Raro, los
// de `epic` en Épico, y solo la legendaria da algo Divino. Los marcos y títulos
// de rango siguen siendo la única vía de verdad al tope del catálogo.
//
// Estilos: los `style` son mapas de variables CSS que las tarjetas consumen.
// Así el catálogo y la UI nunca se desincronizan.
//
// El `unlock.kind: 'crate'` no dice "qué hay dentro de la caja": la caja sortea
// el cosmético y lo enseña (`components/crateLoot.ts`). Aquí solo se declara DE
// QUÉ CAJA sale cada uno, y `crateCosmetics()` es la única fuente que leen las
// tablas de botín. Poner un cosmético en este archivo lo hace existir; además
// ponerlo en una tabla es lo que lo hace sorteable.
// ==========================================================================

// losing the meaning.
// (line endings note)
import type { Cosmetic } from '../types/domain';

const glassBase = { border: '1px solid', borderRadius: '9999px' };

/**
 * Cajas que pueden dar cosméticos. Son los mismos ids que `CrateType`, pero se
 * declaran aquí para que este archivo no dependa del game loop: el catálogo es
 * la capa de datos y no tiene que saber nada del bucle.
 */
/**
 * F31 · LA CAJA DE UN COSMÉTICO ES UN NÚMERO, QUE ES SU TIER.
 *
 * Antes este tipo era `'common' | 'rare' | 'epic' | 'legendary'`: una **quinta
 * copia** de la lista de cajas, escrita aparte de `CRATE_TYPES` y sin ninguna
 * comprobación de que las dos coincidieran. Con diez cajas serían diez nombres
 * más que mantener, y el día que se añadiera la caja T5 nadie se habría acordado de
 * añadirla también aquí.
 *
 * Ahora es el número, y el reparto de los cosméticos por caja es una decisión de
 * balance en una línea por cosmético, no una lista de tipos que sincronizar.
 */
export type CrateCosmeticSource = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const COSMETICS: Cosmetic[] = [
  // ---------------------------------------------------------------- TÍTULOS
  { id: 'title_default', type: 'title', name: 'Sin título', description: 'Operativo novel.', rarity: 'Común',
    unlock: { kind: 'default', value: 0 }, style: { color: 'var(--text-muted)' } },
  { id: 'title_recruited', type: 'title', name: 'Recluta', description: 'Primera semana en la Cyber Base.',
    rarity: 'Raro', unlock: { kind: 'achievement', value: 'first_click' },
    style: { color: '#60a5fa', font: 'mono' } },
  { id: 'title_smith', type: 'title', name: 'Aprendiz de Forja', description: 'Forjaste tu primera recolector.',
    rarity: 'Raro', unlock: { kind: 'achievement', value: 'first_forge' },
    style: { color: '#f97316', font: 'mono' } },
  { id: 'title_smith_master', type: 'title', name: 'Maestro de Forja', description: 'Forjaste 25 recolectores.',
    rarity: 'Épico', unlock: { kind: 'achievement', value: 'smith_25' },
    style: { color: '#fbbf24', font: 'display' } },
  { id: 'title_ascended', type: 'title', name: 'Ascendido', description: 'Reiniciaste tu progreso 5 veces.',
    rarity: 'Épico', unlock: { kind: 'achievement', value: 'ascendant' },
    style: { color: '#c084fc', font: 'display' } },
  { id: 'title_singularity', type: 'title', name: 'Singularidad', description: 'Compraste el nodo Singularidad.',
    rarity: 'Mítico', unlock: { kind: 'cores', value: 0 },
    style: { color: '#f0abfc', font: 'display', glow: 'true' } },
  { id: 'title_champion', type: 'title', name: 'Campeón', description: 'Permaneciste 7 días en el Top 3.',
    rarity: 'Legendario', unlock: { kind: 'ranking', value: 3 },
    style: { color: '#fde047', font: 'display', glow: 'true' } },
  { id: 'title_legend', type: 'title', name: 'Leyenda de la Forja', description: 'Permaneciste 7 días en el Top 1.',
    rarity: 'Divino', unlock: { kind: 'ranking', value: 1 },
    style: { color: '#fde047', font: 'display', glow: 'true', gradient: 'linear-gradient(90deg,#fde047,#fb923c,#f472b6)' } },
  { id: 'title_ghost', type: 'title', name: 'Fantasma', description: 'Un logro secreto. No se explica.',
    rarity: 'Mítico', unlock: { kind: 'secret', value: 'ghost', hint: 'Haz algo que el juego no te pide.' },
    style: { color: '#94a3b8', font: 'display', blur: 'true' } },
  { id: 'title_architect', type: 'title', name: 'Arquitecto', description: 'Abreste las 5 ramas del árbol.',
    rarity: 'Divino', unlock: { kind: 'cores', value: 2000 },
    style: { color: '#22d3ee', font: 'display', glow: 'true' } },

  // ---------------------------------------------------------------- MARCOS
  { id: 'frame_none', type: 'frame', name: 'Sin marco', description: 'Perfil limpio.', rarity: 'Común',
    unlock: { kind: 'default', value: 0 }, style: {} },
  { id: 'frame_steel', type: 'frame', name: 'Acero', description: 'Borde metálico sobrio.', rarity: 'Raro',
    unlock: { kind: 'achievement', value: 'first_click' },
    style: { ...glassBase, borderColor: '#52525b' } },
  { id: 'frame_neon', type: 'frame', name: 'Neón', description: 'Borde con brillo pulsante.', rarity: 'Épico',
    unlock: { kind: 'cores', value: 40 },
    style: { ...glassBase, borderColor: 'var(--accent)', boxShadow: '0 0 18px color-mix(in srgb, var(--accent) 60%, transparent)', animation: 'framePulse 3s ease-in-out infinite' } },
  { id: 'frame_ember', type: 'frame', name: 'Brasa', description: 'Borde naranja de fundición.', rarity: 'Épico',
    unlock: { kind: 'achievement', value: 'smith_25' },
    style: { ...glassBase, borderColor: '#f97316', boxShadow: '0 0 20px #f9731666' } },
  { id: 'frame_void', type: 'frame', name: 'Vacío', description: 'Borde que absorbe la luz.', rarity: 'Legendario',
    unlock: { kind: 'cores', value: 250 },
    style: { ...glassBase, borderColor: '#7c3aed', boxShadow: '0 0 24px #7c3aed80, inset 0 0 20px #00000080' } },
  { id: 'frame_gold', type: 'frame', name: 'Oro Prohibido', description: 'Solo para el Top 1.',
    rarity: 'Divino', unlock: { kind: 'ranking', value: 1 },
    style: { ...glassBase, borderColor: '#fde047', boxShadow: '0 0 26px #fde04790', animation: 'frameShimmer 4s linear infinite' } },
  { id: 'frame_matrix', type: 'frame', name: 'Cascada', description: 'Borde con degradado animado.',
    rarity: 'Legendario', unlock: { kind: 'ranking', value: 10 },
    style: { ...glassBase, borderColor: 'transparent', background: 'linear-gradient(#09090b,#09090b) padding-box, linear-gradient(90deg,#22c55e,#06b6d4,#a855f7) border-box', borderWidth: '2px' } },

  // ---------------------------------------------------------------- BANNERS
  { id: 'banner_none', type: 'banner', name: 'Sin fondo', description: 'Fondo transparente.', rarity: 'Común',
    unlock: { kind: 'default', value: 0 }, style: {} },
  { id: 'banner_grid', type: 'banner', name: 'Rejilla', description: 'Rejilla técnica tenue.', rarity: 'Raro',
    unlock: { kind: 'default', value: 0 },
    style: { backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)', backgroundSize: '18px 18px' } },
  { id: 'banner_sunset', type: 'banner', name: 'Atardecer', description: 'Degradado cálido.', rarity: 'Raro',
    unlock: { kind: 'cores', value: 20 },
    style: { background: 'linear-gradient(120deg,#7c2d12,#db2777)' } },
  { id: 'banner_abyss', type: 'banner', name: 'Abismo', description: 'Azul profundo con halo.', rarity: 'Épico',
    unlock: { kind: 'cores', value: 120 },
    style: { background: 'radial-gradient(120% 100% at 50% 0%,#1e3a8a,#020617 60%)' } },
  { id: 'banner_toxic', type: 'banner', name: 'Tóxico', description: 'Verde radioactivo.', rarity: 'Épico',
    unlock: { kind: 'achievement', value: 'jackpot' },
    style: { background: 'linear-gradient(135deg,#052e16,#10b981)' } },
  { id: 'banner_crimson', type: 'banner', name: 'Carmesí', description: 'Rojo de alarma.', rarity: 'Legendario',
    unlock: { kind: 'achievement', value: 'ascendant' },
    style: { background: 'linear-gradient(135deg,#450a0a,#dc2626)' } },
  { id: 'banner_crown', type: 'banner', name: 'Corona', description: 'Solo para el primer lugar.',
    rarity: 'Divino', unlock: { kind: 'ranking', value: 1 },
    style: { background: 'conic-gradient(from 180deg at 50% 0%,#fde047,#f97316,#fbbf24,#fef08c,#f97316,#fde047)' } },
  { id: 'banner_hidden', type: 'banner', name: 'Sin Nombre', description: 'Aparece en algunos perfiles. Nadie sabe de dónde sale.',
    rarity: 'Mítico', unlock: { kind: 'secret', value: 'hidden', hint: 'Cien cajas. Ni una más.' },
    style: { background: 'repeating-linear-gradient(45deg,#0b0b12,#0b0b12 8px,#18181f 8px,#18181f 16px)' } },

  // ------------------------------------------------------- COSMÉTICOS DE CAJA
  //
  // Estos sí se pagan, porque la caja se compra. Van al final y por rareza
  // creciente con la caja: el catálogo se lee de arriba (lo que solo se
  // consigue jugando) hacia abajo (lo que también se puede comprar).

  { id: 'title_scraplord', type: 'title', name: 'Señor de Chatarra', description: 'Recicló más chatarra que nadie en la base.',
    rarity: 'Raro', unlock: { kind: 'crate', value: 1 },
    style: { color: '#a3a3a3', font: 'mono' } },
  { id: 'frame_oxy', type: 'frame', name: 'Óxido', description: 'Borde corroído, del montón y sin pulir.',
    rarity: 'Raro', unlock: { kind: 'crate', value: 1 },
    style: { ...glassBase, borderColor: '#a16207', borderStyle: 'dashed' } },

  { id: 'title_burnout', type: 'title', name: 'Fundido', description: 'Se quedó sin refrigerante a mitad de una fusión.',
    rarity: 'Épico', unlock: { kind: 'crate', value: 3 },
    style: { color: '#fb923c', font: 'display' } },
  { id: 'banner_foundry', type: 'banner', name: 'Fundición', description: 'El horno encendido, de noche.',
    rarity: 'Épico', unlock: { kind: 'crate', value: 3 },
    style: { background: 'linear-gradient(160deg,#451a03,#ea580c 55%,#facc15)' } },

  { id: 'title_nightshift', type: 'title', name: 'Turno de Noche', description: 'La Cyber Base nunca está vacía.',
    rarity: 'Legendario', unlock: { kind: 'crate', value: 6 },
    style: { color: '#818cf8', font: 'display', glow: 'true' } },
  { id: 'banner_datastorm', type: 'banner', name: 'Tormenta de Datos', description: 'Caudal de telemetría sin filtrar.',
    rarity: 'Épico', unlock: { kind: 'crate', value: 6 },
    style: { backgroundImage: 'repeating-linear-gradient(115deg,rgba(56,189,248,.28) 0 2px,transparent 2px 10px),linear-gradient(180deg,#082f49,#0c4a6e)' } },

  { id: 'frame_quantum', type: 'frame', name: 'Cuántico', description: 'Borde que solo está ahí cuando lo miras.',
    rarity: 'Mítico', unlock: { kind: 'crate', value: 10 },
    style: { ...glassBase, borderColor: 'transparent', borderWidth: '2px', background: 'linear-gradient(#0b0b12,#0b0b12) padding-box, repeating-linear-gradient(90deg,#22d3ee 0 6px,transparent 6px 12px) border-box' } },
  { id: 'banner_aurora', type: 'banner', name: 'Aurora', description: 'El cielo de la Cyber Base visto desde el tejado.',
    rarity: 'Legendario', unlock: { kind: 'crate', value: 10 },
    style: { background: 'linear-gradient(120deg,#4c1d95,#0e7490 45%,#10b981)' } },
  { id: 'title_signal', type: 'title', name: 'La Señal', description: 'El único cosmético Divino que no se gana en el ranking.',
    rarity: 'Divino', unlock: { kind: 'crate', value: 10 },
    style: { color: '#34d399', font: 'display', glow: 'true', gradient: 'linear-gradient(90deg,#34d399,#22d3ee,#a78bfa)' } }
];

export const COSMETICS_BY_ID: Record<string, Cosmetic> = Object.fromEntries(
  COSMETICS.map(c => [c.id, c])
);

export const COSMETICS_BY_TYPE = (type: Cosmetic['type']) => COSMETICS.filter(c => c.type === type);

/**
 * Cosméticos que puede dar una caja.
 *
 * Es la única forma de que las tablas de botín sepan qué sortean: filtran por
 * el `unlock` del catálogo en vez de llevar su propia lista de ids. Si las dos
 * cosas vivieran separadas, bastaría con borrar una entrada de aquí para que la
 * caja siguiera anunciando un cosmético que ya no existe, y el premio saldría
 * con un id que nadie encuentra al equiparlo.
 *
 * Se lee del catálogo y no de una constante: el catálogo es la fuente de verdad
 * desde antes de que existiera el botín de cosméticos.
 */
export const crateCosmetics = (crate: CrateCosmeticSource): Cosmetic[] =>
  COSMETICS.filter(c => c.unlock.kind === 'crate' && c.unlock.value === crate);

/** CSS inline a partir del mapa de estilos del cosmético. */
export function cosmeticStyle(cos: Cosmetic | undefined): string {
  if (!cos) return '';
  return Object.entries(cos.style).map(([k, v]) => `${k}:${v}`).join(';');
}
