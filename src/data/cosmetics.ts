// ==========================================================================
// Cosméticos · Títulos, marcos y banners
//
// No afectan a la estadística. Su función es dar identidad y un objetivo de
// hunt a quien ya no progresa por potencia. Por eso casi todos se consiguen por
// logros o por permanencia en el ranking, no vendiendo: si se vendieran, el
// marco sería unpay-to-win social y perdería el sentido.
//
// Estilos: los `style` son mapas de variables CSS que las tarjetas consumen.
// Así el catálogo y la UI nunca se desincronizan.
// ==========================================================================

import type { Cosmetic } from '../types/domain';

const glassBase = { border: '1px solid', borderRadius: '9999px' };

export const COSMETICS: Cosmetic[] = [
  // ---------------------------------------------------------------- TÍTULOS
  { id: 'title_default', type: 'title', name: 'Sin título', description: 'Operativo novel.', rarity: 'Común',
    unlock: { kind: 'default', value: 0 }, style: { color: 'var(--text-muted)' } },
  { id: 'title_recruited', type: 'title', name: 'Recluta', description: 'Primera semana en la Cyber Base.',
    rarity: 'Raro', unlock: { kind: 'achievement', value: 'first_click' },
    style: { color: '#60a5fa', font: 'mono' } },
  { id: 'title_smith', type: 'title', name: 'Aprendiz de Forja', description: 'Forjaste tu primera arma.',
    rarity: 'Raro', unlock: { kind: 'achievement', value: 'first_forge' },
    style: { color: '#f97316', font: 'mono' } },
  { id: 'title_smith_master', type: 'title', name: 'Maestro de Forja', description: 'Forjaste 25 armas.',
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
    style: { background: 'repeating-linear-gradient(45deg,#0b0b12,#0b0b12 8px,#18181f 8px,#18181f 16px)' } }
];

export const COSMETICS_BY_ID: Record<string, Cosmetic> = Object.fromEntries(
  COSMETICS.map(c => [c.id, c])
);

export const COSMETICS_BY_TYPE = (type: Cosmetic['type']) => COSMETICS.filter(c => c.type === type);

/** CSS inline a partir del mapa de estilos del cosmético. */
export function cosmeticStyle(cos: Cosmetic | undefined): string {
  if (!cos) return '';
  return Object.entries(cos.style).map(([k, v]) => `${k}:${v}`).join(';');
}
