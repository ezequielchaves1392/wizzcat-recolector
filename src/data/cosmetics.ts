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

/**
 * FYI · YA NO HAY `glassBase`, Y POR QUÉ.
 *
 * Los marcos eran **un borde alrededor del avatar** y compartían una base con
 * `borderRadius: '9999px'`, así que **los nueve eran el mismo círculo de un píxel**. Ahora
 * el marco es **el icono de perfil**: un emblema con su propio fondo, su propia forma y su
 * propio icono, y no comparte base con nadie. Cada uno declara su placa y su borde enteros.
 * Un marco futuro que se apoye en una base común volvería a igualarlos.
 */

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
  //
  //  **EL MARCO ES EL ICONO DE PERFIL, NO UN ARO.** Cada uno es un emblema con su
  //  propio fondo, su forma, su borde y —para los especiales— su animación. El icono
  //  que va dentro sale de `data/avatarIcons.ts` por el id, y `iconColor` decide de qué
  //  color se ve. El banner no participa: es el fondo, no la cara.
  //
  //  **LAS ANIMACIONES SON DE MOVIMIENTO CONTENIDO.** `framePulse` late, `frameEmber`
  //  respira como brasa, `frameScan` desplaza el relleno como una cascada, y
  //  `frameSpectrum` gira. El giro solo se usa en emblemas **circulares** (Cuántico y
  //  Espectro), porque un cuadrado girando se ve como un cuadrado girando; un círculo
  //  girando se ve quieto.
  { id: 'frame_none', type: 'frame', name: 'Sin marco', description: 'Perfil limpio.', rarity: 'Común',
    unlock: { kind: 'default', value: 0 }, style: {} },
  // Acero: placa metálica cepillada con un filo claro arriba, como una chapa. Hexágono de
  // icono, que es lo que dice "metal trabajado".
  { id: 'frame_steel', type: 'frame', name: 'Acero', description: 'Placa de acero cepillado.',
    rarity: 'Raro', unlock: { kind: 'achievement', value: 'first_click' },
    style: { border: '1px solid #52525b', borderRadius: '0.5rem', background: 'linear-gradient(145deg,#3f3f46,#18181b 55%,#27272a)', boxShadow: 'inset 0 1px 0 #ffffff22, 0 2px 6px #00000066' },
    iconColor: '#d4d4d8' },

  // Neón: placa oscura con un aro de acento que late. Es el primero que se ve de lejos.
  { id: 'frame_neon', type: 'frame', name: 'Neón', description: 'Aro de luz que late.',
    rarity: 'Épico', unlock: { kind: 'cores', value: 40 },
    style: { border: '2px solid var(--accent)', borderRadius: '1rem', background: 'radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent) 32%, #0b0b12), #0b0b12 72%)', boxShadow: '0 0 16px color-mix(in srgb, var(--accent) 70%, transparent), inset 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent)', animation: 'framePulse 3s ease-in-out infinite' },
    iconColor: 'var(--accent)' },

  // Brasa: el rescoldo del horno. Un radial naranja que respira, para que se lea encendido.
  { id: 'frame_ember', type: 'frame', name: 'Brasa', description: 'Rescoldo que respira.',
    rarity: 'Épico', unlock: { kind: 'achievement', value: 'smith_25' },
    style: { border: '2px solid #f97316', borderRadius: '0.75rem', background: 'radial-gradient(circle at 50% 72%, #f97316, #7c2d12 46%, #1c0a04 82%)', boxShadow: '0 0 18px #f9731666, inset 0 0 12px #fb923c55', animation: 'frameEmber 2.6s ease-in-out infinite' },
    iconColor: '#fed7aa' },

  // Vacío: un pozo violeta que se come la luz por dentro. Sin animación: el vacío no late.
  { id: 'frame_void', type: 'frame', name: 'Vacío', description: 'Un pozo que absorbe la luz.',
    rarity: 'Legendario', unlock: { kind: 'cores', value: 250 },
    style: { border: '1px solid #7c3aed', borderRadius: '1.25rem', background: 'radial-gradient(circle at 50% 50%, #2e1065, #0b0b12 66%)', boxShadow: 'inset 0 0 22px #7c3aed66, 0 0 14px #7c3aed33' },
    iconColor: '#c4b5fd' },

  // Oro: el único con brillo animado de tono. El color del glifo va oscuro para que se
  // lea sobre el oro claro.
  { id: 'frame_gold', type: 'frame', name: 'Oro Prohibido', description: 'Lingote con brillo de tono.',
    rarity: 'Divino', unlock: { kind: 'ranking', value: 1 },
    style: { border: '2px solid #fde047', borderRadius: '1rem', background: 'linear-gradient(145deg,#fde68a,#b45309 50%,#fbbf24)', boxShadow: '0 0 22px #fde04790, inset 0 0 10px #fef08c', animation: 'frameShimmer 4s linear infinite' },
    iconColor: '#78350f' },

  // Cascada: lluvia de datos que baja. `frameScan` mueve el relleno, no la caja, que es lo
  // único que hace legible una cascada.
  { id: 'frame_matrix', type: 'frame', name: 'Cascada', description: 'Lluvia de datos que cae.',
    rarity: 'Legendario', unlock: { kind: 'ranking', value: 10 },
    style: { border: '1px solid #22c55e', borderRadius: '0.5rem', background: 'repeating-linear-gradient(180deg, #22c55e22 0 2px, transparent 2px 7px), linear-gradient(180deg,#022c22,#052e16)', boxShadow: 'inset 0 0 16px #22c55e55', animation: 'frameScan 2.4s linear infinite' },
    iconColor: '#4ade80' },

  // ---------------------------------------------------------------- BANNERS
  //
  //  **EL BANNER ES EL FONDO.** Un relleno, y nada más: no da icono, no da borde y no
  //  gira. La forma la recorta la caja del avatar. Aquí solo vive lo que hace que un
  //  fondo se distinga de otro.
  { id: 'banner_none', type: 'banner', name: 'Sin fondo', description: 'Fondo transparente.', rarity: 'Común',
    unlock: { kind: 'default', value: 0 }, style: {} },
  { id: 'banner_grid', type: 'banner', name: 'Rejilla', description: 'Rejilla técnica tenue.', rarity: 'Raro',
    unlock: { kind: 'default', value: 0 },
    style: { backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)', backgroundSize: '14px 14px', backgroundColor: '#0b0f17' } },
  { id: 'banner_sunset', type: 'banner', name: 'Atardecer', description: 'Degradado cálido.', rarity: 'Raro',
    unlock: { kind: 'cores', value: 20 },
    style: { background: 'linear-gradient(160deg,#7c2d12,#db2777 60%,#7c3aed)' } },
  { id: 'banner_abyss', type: 'banner', name: 'Abismo', description: 'Azul profundo con halo.', rarity: 'Épico',
    unlock: { kind: 'cores', value: 120 },
    style: { background: 'radial-gradient(120% 100% at 50% 0%,#1e40af,#0b1220 55%,#020617)' } },
  { id: 'banner_toxic', type: 'banner', name: 'Tóxico', description: 'Verde radioactivo.', rarity: 'Épico',
    unlock: { kind: 'achievement', value: 'jackpot' },
    style: { background: 'radial-gradient(circle at 50% 30%,#10b981,#052e16 75%)' } },
  { id: 'banner_crimson', type: 'banner', name: 'Carmesí', description: 'Rojo de alarma.', rarity: 'Legendario',
    unlock: { kind: 'achievement', value: 'ascendant' },
    style: { background: 'radial-gradient(circle at 50% 35%,#dc2626,#450a0a 78%)' } },
  // Corona: el conic dorado daba vueltas como un cuadrado girando. Ahora el fondo cambia
  // de TONO, que no mueve la caja: un fondo no rota.
  { id: 'banner_crown', type: 'banner', name: 'Corona', description: 'Solo para el primer lugar.',
    rarity: 'Divino', unlock: { kind: 'ranking', value: 1 },
    style: { background: 'conic-gradient(from 180deg at 50% 0%,#fde047,#f97316,#fbbf24,#fef08c,#f97316,#fde047)', animation: 'frameShimmer 6s linear infinite' } },
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
  // Óxido: placa picada y sin pulir, con borde discontinuo. El único `dashed` del catálogo.
  { id: 'frame_oxy', type: 'frame', name: 'Óxido', description: 'Placa corroída, del montón y sin pulir.',
    rarity: 'Raro', unlock: { kind: 'crate', value: 1 },
    style: { border: '2px dashed #a16207', borderRadius: '0.25rem', background: 'linear-gradient(160deg,#3f2a12,#1c1207 70%)', boxShadow: 'inset 0 0 12px #a1620744' },
    iconColor: '#d6a35a' },

  { id: 'title_burnout', type: 'title', name: 'Fundido', description: 'Se quedó sin refrigerante a mitad de una fusión.',
    rarity: 'Épico', unlock: { kind: 'crate', value: 3 },
    style: { color: '#fb923c', font: 'display' } },
  { id: 'banner_foundry', type: 'banner', name: 'Fundición', description: 'El horno encendido, de noche.',
    rarity: 'Épico', unlock: { kind: 'crate', value: 3 },
    style: { background: 'radial-gradient(circle at 50% 78%,#facc15,#ea580c 42%,#451a03 82%)' } },

  { id: 'title_nightshift', type: 'title', name: 'Turno de Noche', description: 'La Cyber Base nunca está vacía.',
    rarity: 'Legendario', unlock: { kind: 'crate', value: 6 },
    style: { color: '#818cf8', font: 'display', glow: 'true' } },
  { id: 'banner_datastorm', type: 'banner', name: 'Tormenta de Datos', description: 'Caudal de telemetría sin filtrar.',
    rarity: 'Épico', unlock: { kind: 'crate', value: 6 },
    style: { backgroundImage: 'repeating-linear-gradient(115deg,rgba(56,189,248,.32) 0 2px,transparent 2px 9px),linear-gradient(180deg,#082f49,#0c4a6e)', animation: 'frameScan 3.6s linear infinite' } },

  // Cuántico: aro de trazos cortos que gira. El icono es un átomo: la señal que solo se ve
  // cuando la miras. Al ser circular, el giro se lee como una órbita, no como un cuadrado.
  { id: 'frame_quantum', type: 'frame', name: 'Cuántico', description: 'Aro de trazos que orbita.',
    rarity: 'Mítico', unlock: { kind: 'crate', value: 10 },
    style: { border: '2px solid transparent', borderRadius: '9999px', background: 'radial-gradient(circle,#0b0b12,#0b0b12) padding-box, repeating-conic-gradient(from 0deg,#22d3ee 0 18deg,transparent 18deg 30deg) border-box', boxShadow: '0 0 14px #22d3ee55', animation: 'frameSpectrum 10s linear infinite' },
    iconColor: '#67e8f9' },
  { id: 'banner_aurora', type: 'banner', name: 'Aurora', description: 'El cielo de la Cyber Base visto desde el tejado.',
    rarity: 'Legendario', unlock: { kind: 'crate', value: 10 },
    style: { background: 'linear-gradient(120deg,#4c1d95,#0e7490 45%,#10b981)' } },
  { id: 'title_signal', type: 'title', name: 'La Señal', description: 'El único cosmético Divino que no se gana en el ranking.',
    rarity: 'Divino', unlock: { kind: 'crate', value: 10 },
    style: { color: '#34d399', font: 'display', glow: 'true', gradient: 'linear-gradient(90deg,#34d399,#22d3ee,#a78bfa)' } },
// ------------------------------------------------------- LOGROS DIFÍCILES (F53+)
  //
  //  **TRECE COSMÉTICOS MÁS, Y LA REGLA QUE LOS GOBIERNA: EL NOMBRE DICE LO QUE SE VE.**
  //
  //  Antes el catálogo tenía la regla contraria sin decirlo: el nombre prometía y el
  //  estilo no cumplía. "Óxido: borde corroído" era un círculo de un píxel, y nueve
  //  marcos eran el mismo. Un cosmético cuyo estilo no se parece a su nombre no es un
  //  cosmético: es una etiqueta con una imagen al lado.
  //
  //  Así que aquí cada nombre es una instrucción:
  //
  //    · **Arcoíris** es un degradado de arcoíris, y se nota al mirar.
  //    · **Ónix** es negro con un filo claro, y no brilla.
  //    · **Legión** es un doble aro: dos líneas, porque son doce.
  //    · **Espectro** es la conic de todos los tonos, girando sola.
  //    · **Mosaico** es un damero de verdad, hecho con dos cónicos superpuestos.
  //    · **Escaneo** son las líneas del monitor, de las de verdad.
  //    · **Aurora Alta** es un cielo nocturno con estrellas encima.
  //
  //  Y las texturas salen de **gradientes a capas**, que es lo único que se puede meter en
  //  un `style` sin añadir un binario al repositorio: un `conic-gradient`, un
  //  `repeating-linear-gradient` y un `radial-gradient` apilados son una textura, y se leen
  //  como una.
  // ==========================================================================
  {
    id: 'frame_onyx', type: 'frame', name: 'Ónix', description: 'Negro con un filo claro. No brilla, y por eso se ve.',
    rarity: 'Legendario', unlock: { kind: 'achievement', value: 'vault_115' },
    style: { border: '1px solid #3f3f46', borderRadius: '0.5rem', background: 'linear-gradient(160deg,#18181b,#050507 80%)', boxShadow: 'inset 0 1px 0 #a1a1aa55' },
    iconColor: '#e4e4e7' },
  {
    id: 'frame_legion', type: 'frame', name: 'Legión', description: 'Doble aro. Doce en pie, y el marco los cuenta.',
    rarity: 'Legendario', unlock: { kind: 'achievement', value: 'squad_12' },
    style: { border: '2px solid #e5e7eb', borderRadius: '9999px', background: 'radial-gradient(circle,#111827,#1f2937)', boxShadow: '0 0 0 3px #6b7280, inset 0 0 0 2px #9ca3af' },
    iconColor: '#f9fafb' },
  {
    id: 'frame_prisma', type: 'frame', name: 'Prisma', description: 'El mismo borde se ve en tres tonos a la vez.',
    rarity: 'Épico', unlock: { kind: 'achievement', value: 'doblaje' },
    style: { border: '2px solid transparent', borderRadius: '0.875rem', background: 'radial-gradient(circle,#0b0b12,#0b0b12) padding-box, conic-gradient(from 90deg,#22d3ee,#a855f7,#f472b6,#22d3ee) border-box', boxShadow: '0 0 12px #a855f755' },
    iconColor: '#f0abfc' },
  {
    id: 'frame_spectrum', type: 'frame', name: 'Espectro', description: 'El arcoíris entero, girando despacio.',
    rarity: 'Mítico', unlock: { kind: 'achievement', value: 'perfect_10' },
    style: { border: '3px solid transparent', borderRadius: '9999px', background: 'radial-gradient(circle,#0b0b12,#0b0b12) padding-box, conic-gradient(from 0deg,#ef4444,#f59e0b,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444) border-box', boxShadow: '0 0 16px #a855f766', animation: 'frameSpectrum 9s linear infinite' },
    iconColor: '#f0abfc' },
  {
    id: 'banner_spectrum', type: 'banner', name: 'Espectro', description: 'Arcoíris en conic, con el centro justo detrás del avatar.',
    rarity: 'Mítico', unlock: { kind: 'achievement', value: 'perfect_10' },
    // **EL FONDO NO GIRA; CAMBIA DE TONO.** Un `conic-gradient` con `transform: rotate`
    // sobre un cuadrado se ve como un cuadrado girando, que es lo que el jugador
    // describió. Con `frameShimmer` (hue-rotate) el arcoíris se mueve sin mover la caja.
    style: { background: 'conic-gradient(from 210deg at 50% 45%,#ef4444,#f59e0b,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)', animation: 'frameShimmer 9s linear infinite' } },
  {
    id: 'banner_mosaic', type: 'banner', name: 'Mosaico', description: 'Damero de dos cónicos cruzados: cuatro tonos, ocho cuadros.',
    rarity: 'Legendario', unlock: { kind: 'achievement', value: 'cores_10k' },
    // **EL DAMERO SON DOS CÓNICOS SUPERPUESTOS**, no un `repeating-gradient`: el
    // conic dibuja la estrella de ocho puntas y el segundo, girado 45°, la otra. Sale un
    // damero real con dos capas.
    style: {
      background: 'repeating-conic-gradient(from 45deg,#0f172a 0 25%,#1e3a8a 0 50%)',
      backgroundSize: '28px 28px'
    } },
  {
    id: 'banner_scanlines', type: 'banner', name: 'Escaneo', description: 'Las líneas del monitor, de las de verdad, cada dos píxeles.',
    rarity: 'Épico', unlock: { kind: 'achievement', value: 'custodio' },
    style: {
      background: 'repeating-linear-gradient(0deg, rgba(56,189,248,.18) 0 1px, transparent 1px 3px), linear-gradient(180deg,#042f2e,#022c22)',
      animation: 'scanDown 6s linear infinite'
    } },
  {
    id: 'banner_aurora_high', type: 'banner', name: 'Aurora Alta', description: 'El cielo de la base desde el tejado, con las estrellas encima.',
    rarity: 'Legendario', unlock: { kind: 'achievement', value: 'incesante' },
    // **LAS ESTRELLAS SON UN RADIAL REPETIDO** y la aurora un lineal debajo. Dos capas: la
    // estrella se mueve despacio sobre el cielo, como un cielo que gira.
    style: {
      background: 'radial-gradient(circle at 20% 30%, rgba(226,232,240,.9) 0 1px, transparent 1.4px), radial-gradient(circle at 65% 18%, rgba(226,232,240,.6) 0 1px, transparent 1.3px), linear-gradient(120deg,#4c1d95 0%,#0e7490 45%,#10b981 78%,#052e16 100%)',
      backgroundSize: '90px 90px, 130px 130px, auto',
      animation: 'starDrift 40s linear infinite'
    } },
  {
    id: 'title_relicario', type: 'title', name: 'Relicario', description: 'Tienes un Divino. Se nota.',
    rarity: 'Divino', unlock: { kind: 'achievement', value: 'relicario' },
    style: { color: '#fde68a', font: 'display', glow: 'true', gradient: 'true' } },
  {
    id: 'title_eternidad', type: 'title', name: 'Eternidad', description: 'Veinte veces desde cero.',
    rarity: 'Divino', unlock: { kind: 'achievement', value: 'eternidad' },
    style: { color: '#c4b5fd', font: 'display', glow: 'true', gradient: 'true' } },
  {
    id: 'title_mil_millones', type: 'title', name: 'Mil Millones', description: 'El billón, contado de uno en uno.',
    rarity: 'Divino', unlock: { kind: 'achievement', value: 'mil_millones' },
    style: { color: '#67e8f9', font: 'mono', glow: 'true', gradient: 'true' } },
  {
    id: 'title_cantera', type: 'title', name: 'Cantera', description: 'Quinientas cajas y seguimos abriendo.',
    rarity: 'Legendario', unlock: { kind: 'achievement', value: 'cantera' },
    style: { color: '#fdba74', font: 'display', glow: 'true' } },
  {
    id: 'title_ninguna_bala', type: 'title', name: 'Ninguna Bala', description: 'Cien mil clics. Ni uno desperdiciado.',
    rarity: 'Legendario', unlock: { kind: 'achievement', value: 'ninguna_bala' },
    style: { color: '#e5e7eb', font: 'mono' } },
  {
    id: 'title_custodio', type: 'title', name: 'Custodio', description: 'Veinte nodos. El árbol es tuyo.',
    rarity: 'Épico', unlock: { kind: 'achievement', value: 'custodio' },
    style: { color: '#86efac', font: 'mono' } },
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

/**
 * LOS CAMINOS QUE EL MOTOR CONOCE, Y CUALES RECONCILIA.
 *
 * El catálogo declara **cuatro** vías: `default`, `achievement`, `cores`, `ranking` y
 * `crate`. Las cinco existen como dato y **solo dosllegaaban al jugador**: los de
 * `default`, que nacen desbloqueados, y los de `crate`, que los sortea el botín
 * (`crateCosmetics()`). Las otras tres no las leía nadie: el catálogo decía "se
 * desbloquea con un logro" y el logro no repartía nada, así que el Tóxico, el
 * Carmesí, el Atardecer y el Neón eran inalcanzables para siempre.
 *
 * Aquí está lo que se reconcilia y lo que no, y el motivo está en cada uno:
 *
 * · `achievement` y `secret` — **lo mismo.** Los ids de `secret` (`ghost`, `hidden`)
 *   son ids de logro, y los dos están en `SECRET_ACHIEVEMENTS`. Se concede con la
 *   misma pregunta: ¿está el id en los logros desbloqueados?
 * · `cores` — con `totalCores`, **no con el saldo.** El saldo baja cuando gastas, así
 *   que un cosmético por saldo se venderia solo al comprar un nodo; `totalCores` es el
 *   histórico de núcleos ganados y no baja nunca, que es lo que hace que "20 núcleos"
 *   sea un logro de permanencia y no una meta.
 * · `ranking` — **NO SE RECONCILIA, Y ES A PROPÓSITO.** Depende del documento público
 *   del ranking y de un histórico de posiciones que el juego no guarda: "Permaneciste
 *   7 días en el Top 1" no se puede responder con el estado de una partida. Se deja
 *   declarado y sin repartir, y `viasSinResolver()` lo enseña, para que no se perda.
 *
 * El `value` de `cores` tiene que ser **mayor que cero**. El Singularidad lo declara
 * con `value: 0` porque la vía original era "comprar el nodo", que esta función no
 * puede preguntar: con `0` el filtro lo daría a todo el mundo al cargar, y es un
 * título Divino.
 */
export function cosmeticsAlcanzables(estado: {
  unlockedAchievements?: string[];
  totalCores?: number;
}): Cosmetic[] {
  const logros = new Set(estado.unlockedAchievements ?? []);
  const total = estado.totalCores ?? 0;
  return COSMETICS.filter((c) => {
    switch (c.unlock.kind) {
      case 'default':
      case 'crate':
        return false; // los dos los resuelve otro camino
      case 'achievement':
      case 'secret':
        return logros.has(String(c.unlock.value));
      case 'cores':
        const pedido = Number(c.unlock.value);
        return Number.isFinite(pedido) && pedido > 0 && total >= pedido;
      case 'ranking':
        return false; // ver la cabecera: no hay con qué comprobarlo
      default:
        return false;
    }
  });
}

/**
 * Las vías que el catálogo declara y el motor **no** reconcilia.
 *
 * Existe para que un banco pueda afirmar que no hay ningún camino muerto sin mirar la
 * lista a mano, y para que la próxima vía que se añada aparezca aquí el mismo día que
 * se escribe en vez de tres meses después.
 */
export function viasSinResolver(): { kind: string; count: number }[] {
  const cuenta = new Map<string, number>();
  for (const c of COSMETICS) {
    if (c.unlock.kind === 'ranking') cuenta.set(c.unlock.kind, (cuenta.get(c.unlock.kind) ?? 0) + 1);
  }
  return [...cuenta].map(([kind, count]) => ({ kind, count }));
}

/**
 * CSS inline a partir del mapa de estilos del cosmético.
 *
 * ## LAS CLAVES EN CAMELCASE HAY QUE CONVERTLAS, Y POR QUÉ NO ERA VISIBLE
 *
 * `backgroundImage` y `backgroundSize` no son propiedades CSS: CSS escribe
 * `background-image` y `background-size`. En un atributo `style` una propiedad que no
 * existe **se descarta en silencio** —no es un error, no avisa, simplemente no pinta—,
 * así que el banner "Rejilla" (el que usa `backgroundImage`) y "Tormenta de Datos" salían
 * **sin fondo ninguno** en todos los sitios: la ficha del Perfil, el halo del avatar y la
 * fila del ranking. Dos banners del catálogo, invisibles, sin que nada lo delatara.
 *
 * Solo se convertían las que están en camelCase, y **solo las que son de estilo**: `glow`
 * y `gradient` no son CSS sino banderas del catálogo, y `titleStyleFor()` las lee por su
 * nombre. Convertirlas habría producido `glow:true` → una propiedad inventada, que es
 * inocua pero mentira: el mapa de estilos dice qué es CSS y qué es una marca.
 *
 * Con `kebab()` la lista es explícita y un banner nuevo que escriba `borderRadius` o
 * `backgroundColor` funciona sin que nadie se acuerde de esta línea.
 */
const CLOVES_QUE_NO_SON_CSS = new Set(['glow', 'gradient']);

export function cosmeticStyle(cos: Cosmetic | undefined): string {
  if (!cos) return '';
  return Object.entries(cos.style)
    .filter(([k]) => !CLOVES_QUE_NO_SON_CSS.has(k))
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
    .join(';');
}
