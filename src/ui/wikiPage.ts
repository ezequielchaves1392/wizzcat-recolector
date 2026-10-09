// ==========================================================================
//  Wiki · la base de conocimiento del juego
//
//  Vive en pestaña aparte (`wiki.html` + `src/wiki.ts`), sin game loop, sin
//  Firebase y sin auth: es solo lectura sobre datos. Por eso no es una ruta
//  del router —el router es del juego— y por eso abrirla no interfiere con
//  la partida: la pestaña del juego queda oculta y el juego se pausa solo.
//
//  LA REGLA QUE SOSTIENE ESTA PÁGINA (R2/R3). Cada número que se enseña sale
//  de la misma tabla o función que usa el motor: `costeDeCaja()` para los
//  precios, `tablaDePesos()` para los porcentajes de caja, `nodeCost()` para
//  las pasivas, `pendingCores()` para la Ascensión. Un número escrito a mano
//  es una segunda fuente de la verdad, y es exactamente lo que se queda
//  diciendo la regla vieja cuando la regla cambia (precedentes B6 y F51).
//
//  Estructura: siete secciones con pestañas. El estado que sobrevive al
//  repintado es de módulo (R6) y los listeners van sobre el contenedor que
//  vive toda la pestaña (R5). Los `data-*` llevan la semántica (R8).
//
//  F95: buscador y enlaces entre conceptos. El buscador no interroga al motor
//  —no hay— sino al índice de `data/wikiIndex.ts`, y los enlaces saltan a las
//  anclas que ese mismo módulo nombra: página e índice no pueden divergir.
//  El campo de búsqueda vive FUERA del nodo que se repinta, para no repetir
//  el B15 del almacén (pintar el input en cada tecla le robaba el foco).
// ==========================================================================

import { ic, icSafe } from './icons';
import { sectionHead } from './pageShell';
import { formatNumber } from '../utils/format';
import { esc } from '../utils/esc';
import {
  ANCLA, anclaAfijo, anclaBase, anclaCaja, anclaConsumible,
  anclaExclusivo, anclaExpansor, anclaGrupoBases, anclaLogro, anclaNodo,
  anclaTier, anclaVersion, buscarEnWiki,
  type SeccionWiki
} from '../data/wikiIndex';
import {
  CRATE_TIERS, CRATE_TYPES, costeDeCaja, COSTE_POR_TIER, STORE_ITEMS,
  EXPANSOR_TIERS, expansorDeCaja, CONSUMABLES, type CrateType
} from '../data/store';
import {
  CRATE_META, CRATE_LOOT, CRATE_ONLY_COMPANIONS, tablaDePesos,
  probabilidadDeSalto, RARITY_TEXT
} from '../components/crateLoot';
import { crateCosmetics } from '../data/cosmetics';
import { TIER_SYSTEM, rangoDePoder, rarezaDeTier } from '../data/tiers';
import { BASES_RECOLECTOR, BASES_COMPANERO } from '../data/bases';
import {
  AFFIXES, baseSuccessChance,
  baseDeTier, techoDeNivel, costeDeNivel,
  explicacionDeAfijos
} from '../data/crafting';
import {
  PIEDRA_PUNTOS, PROB_NANO_SUBE_RAREZA, PROB_SUBE_POTENCIAL,
  BONO_ETTER, pctDe
} from '../data/constants';
import { ACHIEVEMENTS } from '../achievements';
import { LOGROS_DIFICILES } from '../data/achievements';
import { TREE_NODES, TREE_CATEGORY_META, nodeCost } from '../data/tree';
import { pendingCores, PRESTIGE_MIN_NANITES } from '../data/prestige';
import { chanceDeSintonizacion, CRISTAL_NOMBRE } from '../data/items';
import { NOTAS } from '../data/patchNotes';
import {
  AFK_CARD_DURATION_MS, TOPE_DE_TARJETA_AFK,
  TOPE_MS_CLICK_X2, TOPE_MS_CLICK_X3
} from '../data/buffs';

/** Las siete secciones, en el orden en que un jugador las pregunta. */
const SECCIONES: Array<{ id: SeccionWiki; label: string; icon: string }> = [
  { id: 'mecanicas', label: 'Mecánicas', icon: 'info' },
  { id: 'cajas', label: 'Cajas', icon: 'crate' },
  { id: 'bases', label: 'Bases', icon: 'star' },
  { id: 'items', label: 'Items', icon: 'collector' },
  { id: 'logros', label: 'Logros', icon: 'achievement' },
  { id: 'pasivas', label: 'Pasivas', icon: 'tree' },
  { id: 'versiones', label: 'Versiones', icon: 'clock' }
];

/** Lo que sobrevive al repintado: la pestaña abierta y lo que se busca (R6). */
const ui: { seccion: SeccionWiki; q: string } = { seccion: 'mecanicas', q: '' };

/** La etiqueta legible de cada sección, para la lista de resultados. */
const ETIQUETA_SECCION: Record<SeccionWiki, string> = {
  mecanicas: 'Mecánicas', cajas: 'Cajas', bases: 'Bases', items: 'Items',
  logros: 'Logros', pasivas: 'Pasivas', versiones: 'Versiones'
};

/**
 * Un enlace a otro concepto de la Wiki: sección y ancla viajan en `data-*`
 * (R8) y el `href` es la dirección real, para que el enlace se pueda copiar.
 * El clic lo intercepta el delegado y salta sin recargar.
 */
function enlaceWiki(seccion: SeccionWiki, ancla: string, texto: string): string {
  return `<a class="wiki-link" href="#${seccion}/${ancla}" data-wiki-ir="${seccion}" data-wiki-ancla="${ancla}">${texto}</a>`;
}

/** Un porcentaje con la coma decimal del juego. */
function pct(x: number, decimales = 1): string {
  return (x * 100).toFixed(decimales).replace('.', ',') + ' %';
}

/** Etiqueta legible de una entrada de botín, sin duplicar su peso ni su regla. */
function etiquetaDeEntrada(id: string, tier: CrateType): string {
  switch (id) {
    case 'nanites': return 'Nanitas';
    case 'crystals': return CRISTAL_NOMBRE;
    case 'companion': return `Compañero T${tier}`;
    case 'collector': return `Recolector T${tier}`;
    case 'clickX3Card': return 'Tarjeta Click x3';
    case 'nextCrate': return `Caja T${tier + 1}`;
    case 'up': return `Salto a T${tier + 1}`;
    case 'expansor': return expansorDeCaja(tier).name;
    case 'calibrationStone': return 'Piedra de Calibración';
    case 'stabilityNano': return 'Nanopartícula de Estabilidad';
    case 'refiningEther': return 'Éter de Refinamiento';
    case 'cosmetic': return 'Cosmético';
    default: break;
  }
  if (id.startsWith('exclusivo_')) {
    const idx = Number(id.replace('exclusivo_', ''));
    const comp = (CRATE_ONLY_COMPANIONS as readonly any[])[idx];
    return comp ? `${comp.name} (exclusivo)` : 'Exclusivo';
  }
  return id;
}

// --------------------------------------------------------------------------
//  Mecánicas
// --------------------------------------------------------------------------

function seccionMecanicas(): string {
  const ejemplosNucleos = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000]
    .map(p => `
      <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)] last:border-0">
        <span class="text-[11px] font-mono text-[var(--text-muted)]">${formatNumber(p)} producidas</span>
        <span class="text-[11px] font-mono font-bold accent-text">+${pendingCores(p)} núcleos</span>
      </div>`).join('');

  const filaForja = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    .map(t => `
      <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)] last:border-0">
        <span class="text-[11px] font-mono text-[var(--text-muted)]">T${t} → T${t + 1}</span>
        <span class="text-[11px] font-mono font-bold text-[var(--text-main)]">${pct(baseSuccessChance(t), 0)}</span>
      </div>`).join('');

  const filasSinto = [0, 10, 20]
    .map(n => `
      <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)] last:border-0">
        <span class="text-[11px] font-mono text-[var(--text-muted)]">Nivel ${n}</span>
        <span class="text-[11px] font-mono font-bold text-[var(--text-main)]">${chanceDeSintonizacion(n)} %</span>
      </div>`).join('');

  return `
    ${bloqueWiki('Cómo se gana', 'bolt', `
      <h4 class="wiki-sub">Click</h4>
      <p class="wiki-p">Cada pulsación cobra el daño de tu recolector equipado, con
      sus multiplicadores encima: compañeros que multiplican, logros, árbol de pasivas y afijos
      del arma. El número grande de la base es ese daño, ya calculado.</p>
      <h4 class="wiki-sub">Pasivo</h4>
      <p class="wiki-p">Los compañeros activos producen cada segundo, y se cobra
      entero y de una vez, una vez por segundo. Las fichas del escuadrón enseñan lo que cada
      uno aporta, y la suma es exactamente el ingreso.</p>
      <h4 class="wiki-sub">Sin mirar no hay ingreso</h4>
      <p class="wiki-p">Con la pestaña oculta o la ventana
      sin foco, el juego se detiene y te espera: hay que pulsar para seguir cobrando.
      La Tarjeta AFK es la excepción —deja producir sin mirar hasta que se acaba—,
      con un tope de ${TOPE_DE_TARJETA_AFK} tarjetas y topes estrictos al volver.</p>
    `, ANCLA.mecanicaGanar)}
    ${bloqueWiki('La forja: dos entran, uno sale', 'anvil', `
      <p class="wiki-p">Dos recolectores —o dos compañeros— del mismo tier se fusionan en
      uno del tier siguiente. Los dos materiales se van: la forja consolida, no crea.
      El potencial del nuevo es la media de los dos (a empate, sube), y la base oculta
      también se promedia. Si la tirada falla, los materiales se pierden pero el fallo
      paga ${enlaceWiki('mecanicas', ANCLA.mecanicaSinto, 'cristales')}.</p>
      <h4 class="wiki-sub">Probabilidad base por tier</h4>
      <p class="wiki-p">Antes de pasivas y piedras, con tope del 95 %:</p>
      <div class="wiki-box">${filaForja}</div>
      <p class="wiki-p">La ${enlaceWiki('items', anclaConsumible('calibrationStone'), 'Piedra de Calibración')} suma ${PIEDRA_PUNTOS} puntos por unidad, hasta diez
      por fusión. La ${enlaceWiki('items', anclaConsumible('stabilityNano'), 'Nanopartícula')} sube la rareza del recolector un escalón la mitad de las
      veces (${pct(PROB_NANO_SUBE_RAREZA, 0)}). El ${enlaceWiki('items', anclaConsumible('refiningEther'), 'Éter')} suma ${pctDe(BONO_ETTER)} puntos a la
      probabilidad de ganar una estrella de potencial, que existe siempre:
      ${[1, 2, 3, 4].map(e => `★${e}→★${e + 1}: ${Math.round((PROB_SUBE_POTENCIAL[e] ?? 0) * 100)} %`).join(', ')}.
      Todo se gasta aunque la tirada falle.</p>
    `, ANCLA.mecanicaForja)}
    ${bloqueWiki('Sintonizar con cristales', 'crystal', `
      <p class="wiki-p">Los ${enlaceWiki('items', ANCLA.itemsExpansores, 'cristales')} suben el nivel del recolector o del compañero, un intento
      por gasto. La probabilidad solo depende del nivel al que subes: empieza en el 95 % y baja
      tres puntos por nivel, con suelo en el 35 %. Un fallo no baja el nivel.</p>
      <div class="wiki-box">${filasSinto}</div>
      <p class="wiki-p">El coste sube con el tier del item y con su nivel: el primer nivel de un
      T1 cuesta ${formatNumber(costeDeNivel(1, 0))} cristales y el de un T10,
      ${formatNumber(costeDeNivel(10, 0))}. El techo de nivel es 20, más dos por estrella
      de potencial y medio punto por posición de base: un ★1 con la peor base topa en
      ${techoDeNivel(1, 1)} y un ★5 con la mejor en ${techoDeNivel(5, 10)}.</p>
    `, ANCLA.mecanicaSinto)}
    ${bloqueWiki('La Ascensión', 'recycle', `
      <p class="wiki-p">Al producir ${formatNumber(PRESTIGE_MIN_NANITES)} nanitas en total puedes
      reciclar tu progreso a cambio de núcleos permanentes, que pagan el ${enlaceWiki('pasivas', ANCLA.pasivasArbol, 'árbol de pasivas')}.
      La cuenta es 8 por cada millón elevado a 0,6: producir más da más, pero cada núcleo
      cuesta más que el anterior.</p>
      <div class="wiki-box">${ejemplosNucleos}</div>
      <h4 class="wiki-sub">Se pierde</h4>
      <p class="wiki-p">Las nanitas, el almacén entero (incluidos los
      forjados), los buffs activos, las tarjetas AFK y la capacidad ampliada. Todo vuelve
      al kit de arranque, con los dos items de partida ya equipados.</p>
      <h4 class="wiki-sub">Se conserva</h4>
      <p class="wiki-p">Los núcleos y su histórico, el árbol de pasivas,
      los logros, los cosméticos, cuántos forjaste y los históricos de producción, clics,
      cajas y ranuras compradas.</p>
    `, ANCLA.mecanicaAscension)}
    ${bloqueWiki('Vender', 'scale', `
      <h4 class="wiki-sub">Recolectores</h4>
      <p class="wiki-p">Un recolector se revende por el 42 % de su valor —que depende de su tier, nivel,
      rareza, potencial, afijos, fama y antigüedad—. Vender siempre da menos de lo que costó:
      es una salida, no un negocio.</p>
      <h4 class="wiki-sub">El resto</h4>
      <p class="wiki-p">El resto de la tienda sale por la cuarta parte de su precio. Lo que sale de una
      caja está topado: nunca vale más que la caja que lo trajo.</p>
      <h4 class="wiki-sub">Si no cabe</h4>
      <p class="wiki-p">Si el almacén se llena al abrir, el premio que no cabe se compensa en
      nanitas: nada se pierde en silencio.</p>
    `, ANCLA.mecanicaVender)}
  `;
}

// --------------------------------------------------------------------------
//  Cajas
// --------------------------------------------------------------------------

/** El icono de cada fila del reparto, con el set del juego. El exclusivo pinta su propia cara. */
function iconoDeEntrada(id: string): string {
  if (id.startsWith('exclusivo_')) {
    const comp = (CRATE_ONLY_COMPANIONS as readonly any[])[Number(id.replace('exclusivo_', ''))];
    return comp ? icSafe(comp.icon) : '';
  }
  // Aspecto, no regla: la tabla vive aquí y no en `data/` (mismo criterio que
  // los iconos de consumibles de la sección de Items).
  const fijos: Record<string, string> = {
    nanites: 'nanite', crystals: 'crystal', companion: 'companion', collector: 'collector',
    clickX3Card: 'bolt', nextCrate: 'crate', up: 'arrowUp', expansor: 'plus',
    calibrationStone: 'flask', stabilityNano: 'gem', refiningEther: 'flask', cosmetic: 'star'
  };
  const nombre = fijos[id];
  return nombre ? ic(nombre as any) : '';
}

function tarjetaDeCaja(tier: CrateType): string {
  const meta = CRATE_META[tier];
  const tabla = CRATE_LOOT[tier];
  const pesos = tablaDePesos(tier);
  const total = pesos.reduce((a, b) => a + b, 0) || 1;
  const filas = tabla
    .map((e, i) => ({ e, p: pesos[i] / total }))
    .sort((a, b) => b.p - a.p)
    .map(({ e, p }) => `
      <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)] last:border-0">
        <span class="min-w-0 flex items-center gap-1.5">
          <span class="accent-text flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${iconoDeEntrada(e.id)}</span>
          <span class="text-[11px] font-mono text-[var(--text-main)] truncate">${etiquetaDeEntrada(e.id, tier)}</span>
        </span>
        <span class="text-[11px] font-mono text-[var(--text-muted)] tabular flex-shrink-0">${pct(p)}</span>
      </div>`).join('');
  const exclusivos = (tabla.filter(e => e.id.startsWith('exclusivo_')).length);
  const cosmeticos = crateCosmetics(tier);
  const salto = tier >= 10 ? null : probabilidadDeSalto(tier);

  return `
    <section class="card-glass border rounded-2xl p-3.5 md:p-4 mb-3" id="${anclaCaja(tier)}">
      <div class="flex items-center justify-between gap-2 mb-1">
        <h3 class="font-['Orbitron'] font-bold text-[13px] accent-text flex items-center gap-2 min-w-0">
          <span class="${meta.accent} flex-shrink-0 [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(meta.icon as any)}</span>
          <span class="truncate">${meta.name}</span>
        </h3>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-[var(--border-color)] ${RARITY_TEXT[CRATE_TYPES[tier].rarity] ?? ''} flex-shrink-0">${CRATE_TYPES[tier].rarity}</span>
      </div>
      <p class="text-[11px] font-mono text-[var(--text-muted)] mb-2">
        Cuesta ${formatNumber(meta.cost)} · Se abre sola · Trae el expansor ${expansorDeCaja(tier).name}
        ${salto !== null ? ` · Salto a T${tier + 1}: ${pct(salto)}` : ' · Sin salto: es la última'}
        ${exclusivos > 0 ? ` · ${exclusivos} exclusivo${exclusivos > 1 ? 's' : ''}` : ''}
        ${cosmeticos.length > 0 ? ` · Cosmético: ${cosmeticos.map(c => c.name).join(', ')}` : ''}
      </p>
      <div class="wiki-box">${filas}</div>
    </section>
  `;
}

function seccionCajas(): string {
  return `
    ${bloqueWiki('Diez cajas, una por tier', 'crate', `
      <p class="wiki-p">La caja T{n} suelta objetos de su tier: cristales, un compañero y un
      recolector, la caja siguiente en la cadena, un salto raro al tier de arriba, el ${enlaceWiki('items', ANCLA.itemsExpansores, 'expansor')}
      de su tramo y, desde la T2, ${enlaceWiki('items', ANCLA.itemsConsumibles, 'consumibles de forja')}. Los porcentajes salen del sorteo real,
      con la suerte del Ojo de Caja ya contada en cero.</p>
      <p class="wiki-p">Las cantidades de cristales crecen con el tier, y las nanitas son una
      fracción del precio de la caja. Los cosméticos solo salen de las cajas T1, T3, T6 y T10.</p>
    `, ANCLA.cajasIntro)}
    ${(CRATE_TIERS as readonly number[]).map(t => tarjetaDeCaja(t as CrateType)).join('')}
  `;
}

// --------------------------------------------------------------------------
//  Bases ocultas
// --------------------------------------------------------------------------

function seccionBases(): string {
  const lado = (clave: 'rec' | 'com', titulo: string, tabla: Record<number, Array<{ nombre: string; id: string; pesoStat: number; pesoDrop: number }>>, ladoIcono: string) => `
    <h3 class="label-caps mt-4 mb-2 flex items-center gap-1.5">
      <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(ladoIcono as any)}</span>${titulo}
    </h3>
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(tier => {
      const lista = tabla[tier] ?? [];
      // La mejor es la de mayor stat: sale de los datos, no está escrita a mano.
      const tope = lista.reduce((m, b) => Math.max(m, b.pesoStat), 0);
      return `
      <details class="card-glass border rounded-xl mb-2" ${tier === 1 ? 'open' : ''} id="${anclaGrupoBases(clave, tier)}">
        <summary class="px-3 py-2.5 text-[12px] font-mono font-bold text-[var(--text-main)] cursor-pointer list-none flex items-center justify-between gap-2 min-h-[44px]">
          <span>Tier ${tier} · <span class="${RARITY_TEXT[rarezaDeTier(tier)] ?? ''}">${rarezaDeTier(tier)}</span></span>
          <span class="text-[10px] text-[var(--text-muted)]">${lista.map(b => b.nombre).slice(0, 3).join(' · ')}…</span>
        </summary>
        <div class="px-3 pb-2.5">
          ${lista.map(b => {
            const mejor = b.pesoStat >= tope;
            return `
            <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)] last:border-0" id="${anclaBase(b.id)}">
              <span class="min-w-0">
                <span class="block text-[11px] font-mono text-[var(--text-main)] truncate">${b.nombre}</span>
                ${mejor ? '<span class="block text-[10px] font-mono accent-text">La mejor de su tier</span>' : ''}
              </span>
              <span class="text-[11px] font-mono tabular flex-shrink-0 ${mejor ? 'accent-text font-bold' : 'text-[var(--text-muted)]'}">×${String(b.pesoStat).replace('.', ',')} · ${pct(b.pesoDrop / 55)}</span>
            </div>`;
          }).join('')}
        </div>
      </details>`;
    }).join('')}
  `;

  return `
    ${bloqueWiki('La caza', 'star', `
      <p class="wiki-p">Cada recolector y cada compañero trae una base oculta propia: diez por
      tier y por lado. La base mueve el stat entre ×0,92 y ×1,10, y la mejor sale diez veces
      menos que la peor. Dos objetos del mismo tier y estrellas pueden rendir distinto, y no
      se ve a simple vista: se nota al pegarlos.</p>
      <p class="wiki-p">La cuenta entera es: base del tier × base oculta × potencial × nivel.
      ${enlaceWiki('mecanicas', ANCLA.mecanicaForja, 'Forjar')} promedia las bases de los dos padres, sin bonus: dos buenas dan buena, y el techo
      de nivel también mira la base. El porcentaje de cada fila es su peso de sorteo.</p>
    `, ANCLA.basesCaza)}
    ${lado('rec', 'Recolectores', BASES_RECOLECTOR as any, 'collector')}
    ${lado('com', 'Compañeros', BASES_COMPANERO as any, 'companion')}
  `;
}

// --------------------------------------------------------------------------
//  Items
// --------------------------------------------------------------------------

function seccionItems(): string {
  const filasTier = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(t => {
    const [min, max] = rangoDePoder(t);
    const nombres = (TIER_SYSTEM.collectorNames as Record<number, string[]>)[t] ?? [];
    const compas = (TIER_SYSTEM.companionNames as Record<number, string[]>)[t] ?? [];
    return `
      <div class="py-2 border-b border-[var(--border-color)] last:border-0" id="${anclaTier(t)}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[12px] font-mono font-bold text-[var(--text-main)]">Tier ${t}</span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-lg border border-[var(--border-color)] ${RARITY_TEXT[rarezaDeTier(t)] ?? ''}">${rarezaDeTier(t)}</span>
        </div>
        <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
          Rango ${min}–${max} · Base ${baseDeTier(t)} · Carta ${formatNumber(COSTE_POR_TIER[t - 1])}
        </p>
        <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5 flex items-start gap-1.5">
          <span class="accent-text flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5 mt-px">${ic('collector')}</span>
          <span>Armas: ${nombres.join(' · ')}</span>
        </p>
        <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5 flex items-start gap-1.5">
          <span class="accent-text flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5 mt-px">${ic('companion')}</span>
          <span>Compañeros: ${compas.join(' · ')}</span>
        </p>
      </div>`;
  }).join('');

  const exclusivos = (CRATE_ONLY_COMPANIONS as readonly any[]).map((c: any, i: number) => `
    <div class="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--border-color)] last:border-0" id="${anclaExclusivo(i)}">
      <span class="min-w-0 flex items-center gap-2">
        <span class="${RARITY_TEXT[c.rarity] ?? 'accent-text'} flex-shrink-0 [&>span>svg]:w-4 [&>span>svg]:h-4">${icSafe(c.icon)}</span>
        <span class="min-w-0">
          <span class="block text-[11px] font-mono font-bold text-[var(--text-main)] truncate">${c.name}</span>
          <span class="block text-[10px] font-mono ${RARITY_TEXT[c.rarity] ?? 'text-[var(--text-muted)]'}">${c.rarity} · Solo de caja</span>
        </span>
      </span>
      <span class="text-[11px] font-mono text-[var(--text-muted)] tabular flex-shrink-0">${
        c.type === 'multiplier' ? `×${Math.round((1 + c.power) * 100) / 100} global` : `+${c.power}/s`
      }</span>
    </div>`).join('');

  const precioDe = (claveTienda: string | null): string => {
    if (!claveTienda) return 'Solo de cajas';
    const carta = (STORE_ITEMS as Record<string, { cost: number } | undefined>)[claveTienda];
    return carta ? `${formatNumber(carta.cost)} nanitas` : 'Solo de cajas';
  };
  const TIENDA_POR_BUFF: Record<string, string | null> = {
    afk: 'afkCard', clickX2: 'clickX2Card', clickX3: null,
    calibrationStone: 'calibrationStone', stabilityNano: 'stabilityNano',
    refiningEther: 'refiningEther'
  };
  // El icono de cada consumible, con el mismo criterio que el juego: es aspecto,
  // no regla, así que vive aquí y no en `data/`.
  const ICONO_POR_BUFF: Record<string, string> = {
    afk: 'clock', clickX2: 'bolt', clickX3: 'bolt',
    calibrationStone: 'flask', stabilityNano: 'gem', refiningEther: 'flask'
  };
  const consumibles = Object.values(CONSUMABLES as Record<string, any>)
    .filter(c => !(EXPANSOR_TIERS as any[]).some(e => e.buffId === c.buffId))
    .map(c => `
      <div class="py-1.5 border-b border-[var(--border-color)] last:border-0" id="${anclaConsumible(c.buffId)}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-mono font-bold text-[var(--text-main)] flex items-center gap-1.5 min-w-0">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${icSafe(ICONO_POR_BUFF[c.buffId])}</span>
            <span class="truncate">${c.name}</span>
          </span>
          <span class="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">${precioDe(TIENDA_POR_BUFF[c.buffId] ?? null)}</span>
        </div>
        <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">${c.details}</p>
      </div>`).join('');

  const expansores = (EXPANSOR_TIERS as any[]).map((e, i) => `
    <div class="py-1.5 border-b border-[var(--border-color)] last:border-0" id="${anclaExpansor(i)}">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-mono font-bold text-[var(--text-main)] flex items-center gap-1.5 min-w-0">
          <span class="${RARITY_TEXT[e.rareza] ?? 'accent-text'} flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('plus')}</span>
          <span class="truncate">${e.name}</span>
        </span>
        <span class="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">${
          e.cost === null ? 'Solo de cajas' : `${formatNumber(e.cost)} nanitas`
        }</span>
      </div>
      <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">+1 ranura por uso, vale hasta ${e.maxCap} de capacidad.</p>
    </div>`).join('');

  const afijos = AFFIXES.map(a => `
    <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)] last:border-0" id="${anclaAfijo(a.id)}">
      <span class="min-w-0 flex items-center gap-1.5">
        <span class="${RARITY_TEXT[a.rarity] ?? 'accent-text'} flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('sparkle')}</span>
        <span class="min-w-0">
          <span class="block text-[11px] font-mono font-bold text-[var(--text-main)] truncate">${a.name}</span>
          <span class="block text-[10px] font-mono text-[var(--text-muted)]">${a.description}</span>
        </span>
      </span>
      <span class="text-[10px] font-mono ${RARITY_TEXT[a.rarity] ?? ''} flex-shrink-0">${a.rarity}</span>
    </div>`).join('');

  return `
    ${bloqueWiki('Los diez tiers', 'collector', `
      <p class="wiki-p">El tier manda: más tier es más daño y más ingreso, con sobreprecio
      deliberado —el tier alto rinde más por objeto y peor por nanita—. El rango es de dónde
      sale cada objeto; la base es el daño antes del potencial; la carta es lo que costaría
      comprarlo (las cartas de tier ya no se venden: se consigue por ${enlaceWiki('cajas', ANCLA.cajasIntro, 'cajas')} y ${enlaceWiki('mecanicas', ANCLA.mecanicaForja, 'forja')}).</p>
      <div class="wiki-box">${filasTier}</div>
    `, ANCLA.itemsTiers)}
    ${bloqueWiki('Exclusivos de caja', 'crown', `
      <p class="wiki-p">Seis compañeros que no se venden en la tienda: solo salen de ${enlaceWiki('cajas', ANCLA.cajasIntro, 'cajas altas')}.
      Son la única vía a los multiplicadores globales.</p>
      <div class="wiki-box">${exclusivos}</div>
    `, ANCLA.itemsExclusivos)}
    ${bloqueWiki('Consumibles', 'flask', `
      <p class="wiki-p">Las tarjetas dan buffs cortos: AFK ${Math.round(AFK_CARD_DURATION_MS / 60000)} min
      por tarjeta (tope ${TOPE_DE_TARJETA_AFK}), Click x2 y x3 ${Math.round(TOPE_MS_CLICK_X2 / 60000)} min
      de efecto por uso. La Click x3 no se vende. Piedra, nanopartícula y Éter solo se gastan
      en ${enlaceWiki('mecanicas', ANCLA.mecanicaForja, 'la forja')}. Los tiempos se acumulan con cada uso.</p>
      <div class="wiki-box">${consumibles}</div>
    `, ANCLA.itemsConsumibles)}
    ${bloqueWiki('Expansores y cristal', 'plus', `
      <p class="wiki-p">Cada expansor da una ranura y solo sirve hasta su techo. El Inicial se
      compra; el resto sale de las cajas de su tramo: Intermedio en T3–T6, Avanzado en T7–T9
      y Supremo en T10.</p>
      <div class="wiki-box">${expansores}</div>
      <p class="wiki-p">El cristal es un recurso único, sin niveles: un intento de T1 cuesta
      ${formatNumber(costeDeNivel(1, 0))} y uno de T10, ${formatNumber(costeDeNivel(10, 0))}.
      La caja de cada tier da los intentos de su tier.</p>
    `, ANCLA.itemsExpansores)}
    ${bloqueWiki('Afijos: los pone la rareza', 'sparkle', `
      <p class="wiki-p">${explicacionDeAfijos()}</p>
      <p class="wiki-p">Son ${AFFIXES.length} en total, todos en porcentaje para no romper
      los tiers bajos. Qué hace cada uno:</p>
      <div class="wiki-box">${afijos}</div>
    `, ANCLA.itemsAfijos)}
  `;
}

// --------------------------------------------------------------------------
//  Logros
// --------------------------------------------------------------------------

function seccionLogros(): string {
  const filas = ACHIEVEMENTS.map(a => {
    const r = a.reward;
    const bonus = r.clickBonus > 0 || r.passiveBonus > 0
      ? `${r.clickBonus > 0 ? `+${Math.round(r.clickBonus * 100)} % click` : ''}${r.clickBonus > 0 && r.passiveBonus > 0 ? ' · ' : ''}${r.passiveBonus > 0 ? `+${Math.round(r.passiveBonus * 100)} % pasivo` : ''}`
      : 'Solo cosmético';
    const dificil = (LOGROS_DIFICILES as Array<{ id: string; porQue: string }>).find(d => d.id === a.id);
    return `
      <div class="py-1.5 border-b border-[var(--border-color)] last:border-0" id="${anclaLogro(a.id)}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-mono font-bold text-[var(--text-main)] flex items-center gap-1.5 min-w-0">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-4 [&>span>svg]:h-4">${icSafe(a.icon)}</span>
            <span class="truncate">${a.title}</span>
          </span>
          <span class="text-[10px] font-mono text-emerald-400 flex-shrink-0">${bonus}</span>
        </div>
        <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">${a.description} — ${a.rewardText}</p>
        ${dificil ? `<p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 opacity-75">Difícil: ${dificil.porQue}</p>` : ''}
      </div>`;
  }).join('');

  return `
    ${bloqueWiki('Qué dan', 'achievement', `
      <p class="wiki-p">Los logros cortos dan bonus permanente de click o de pasivo, que se
      suma solo. Los doce difíciles y los dos secretos no dan números: su premio es el
      cosmético. Hay ${ACHIEVEMENTS.length} en total.</p>
      <div class="wiki-box">${filas}</div>
    `, ANCLA.logrosQueDan)}
  `;
}

// --------------------------------------------------------------------------
//  Pasivas
// --------------------------------------------------------------------------

function seccionPasivas(): string {
  const porTier: Record<number, typeof TREE_NODES> = {};
  for (const n of TREE_NODES) (porTier[n.tier] ||= []).push(n);
  const columnas = Object.keys(porTier).map(Number).sort((a, b) => a - b).map(tier => `
    <h3 class="label-caps mt-4 mb-2">Columna ${tier}</h3>
    ${(porTier[tier] ?? []).map(n => {
      const cat = (TREE_CATEGORY_META as Record<string, { label: string; color: string }>)[n.category];
      const catColor = cat?.color ?? 'accent-text';
      const reqs = (n.requires ?? []).map(id => (TREE_NODES as any[]).find(x => x.id === id)?.name ?? id);
      return `
        <div class="py-2 border-b border-[var(--border-color)] last:border-0" id="${anclaNodo(n.id)}">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-mono font-bold text-[var(--text-main)] flex items-center gap-1.5 min-w-0">
              <span class="${catColor} flex-shrink-0 [&>span>svg]:w-4 [&>span>svg]:h-4">${icSafe(n.icon)}</span>
              <span class="truncate">${n.name}</span>
            </span>
            <span class="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">${cat?.label ?? n.category} · Máx ${n.maxLevel} · ${formatNumber(nodeCost(n as any, 0))} ◆ base</span>
          </div>
          <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">${n.description}</p>
          <p class="text-[11px] font-mono text-[var(--text-muted)] mt-0.5 italic">“${n.lore}”</p>
          ${reqs.length > 0 ? `<p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 opacity-75">Requiere: ${reqs.join(', ')}</p>` : ''}
        </div>`;
    }).join('')}
  `).join('');

  return `
    ${bloqueWiki('El árbol', 'tree', `
      <p class="wiki-p">${TREE_NODES.length} nodos en cinco columnas, que se pagan con ${enlaceWiki('mecanicas', ANCLA.mecanicaAscension, 'núcleos')}.
      El coste sube por nivel dentro del nodo, y las ramas caras piden nodos de dos ramas
      distintas: hay que elegir camino. Los efectos se suman a todo lo demás —click, pasivo,
      tienda, forja, cajas y almacén—.</p>
      ${columnas}
    `, ANCLA.pasivasArbol)}
  `;
}

// --------------------------------------------------------------------------
//  Armazón
// --------------------------------------------------------------------------

/** Un bloque de texto con título: la unidad de la Wiki. Con ancla, el bloque es un destino de salto (buscador y enlaces). */
function bloqueWiki(titulo: string, icono: string, cuerpo: string, ancla?: string): string {
  return `
    <section class="card-glass border rounded-2xl p-3.5 md:p-4 mb-3"${ancla ? ` id="${ancla}"` : ''}>
      ${sectionHead(titulo, icono)}
      ${cuerpo}
    </section>
  `;
}

function cuerpoDeSeccion(): string {
  switch (ui.seccion) {
    case 'cajas': return seccionCajas();
    case 'bases': return seccionBases();
    case 'items': return seccionItems();
    case 'logros': return seccionLogros();
    case 'pasivas': return seccionPasivas();
    case 'versiones': return seccionVersiones();
    case 'mecanicas':
    default: return seccionMecanicas();
  }
}

// --------------------------------------------------------------------------
//  Versiones
// --------------------------------------------------------------------------

function seccionVersiones(): string {
  return `
    ${bloqueWiki('Historial del juego', 'clock', `
      <p class="wiki-p">Todos los parches desde el inicio, del más nuevo al más viejo.
      Salen de las notas del juego, sin segunda lista: lo que lees aquí es lo que el
      cartel enseña al entrar.</p>
    `, ANCLA.versionesHistorial)}
    ${NOTAS.map((n, i) => `
      <details class="card-glass border rounded-xl mb-2" ${i === 0 ? 'open' : ''} id="${anclaVersion(n.version)}">
        <summary class="px-3 py-2.5 cursor-pointer list-none flex items-center justify-between gap-2 min-h-[44px]">
          <span class="text-[12px] font-mono font-bold text-[var(--text-main)] min-w-0">
            <span class="accent-text">v${n.version}</span>
            <span class="text-[var(--text-muted)] font-normal"> · ${n.titulo}</span>
          </span>
          <span class="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">${n.fecha}</span>
        </summary>
        <div class="px-3 pb-2.5">
          ${n.lineas.map(l => `<p class="wiki-p">${l}</p>`).join('')}
        </div>
      </details>`).join('')}
  `;
}

// --------------------------------------------------------------------------
//  Buscador y saltos entre conceptos (F95)
// --------------------------------------------------------------------------

/**
 * Los nodos vivos de la pestaña. El campo de búsqueda se fija al montar y no
 * se repinta nunca: si viviera dentro del `mount`, cada tecla lo destruiría
 * y el foco se perdería (el B15 del almacén, aquí evitado por construcción).
 */
const vista: { scroller: HTMLElement | null; mount: HTMLElement | null; campo: HTMLInputElement | null } =
  { scroller: null, mount: null, campo: null };

/** La lista de resultados: cada fila es un salto a sección + ancla (R8). */
function resultadosDeBusqueda(q: string): string {
  const halladas = buscarEnWiki(q);
  if (halladas.length === 0) {
    return `
      <section class="card-glass border rounded-2xl p-3.5 md:p-4 mb-3">
        ${sectionHead('Sin resultados', 'search')}
        <p class="wiki-p">Nada en la Wiki coincide con «${esc(q)}»: prueba con
        <i>forja</i>, <i>T10</i>, un nombre de base o uno de logro.</p>
        <button data-wiki-limpiar
                class="h-9 px-3 rounded-lg btn-ghost text-[11px] font-mono font-bold cursor-pointer min-h-[44px]">
          Quitar la búsqueda
        </button>
      </section>`;
  }
  const filas = halladas.map(e => `
    <button data-wiki-ir="${e.seccion}" data-wiki-ancla="${e.ancla}"
            class="w-full text-left flex items-center justify-between gap-2 py-2 px-1
                   border-b border-[var(--border-color)] last:border-0 cursor-pointer min-h-[44px]">
      <span class="min-w-0">
        <span class="block text-[12px] font-mono font-bold text-[var(--text-main)] truncate">${e.titulo}</span>
        <span class="block text-[10px] font-mono text-[var(--text-muted)]">${ETIQUETA_SECCION[e.seccion]}</span>
      </span>
      <span class="accent-text flex-shrink-0 rotate-180 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('back')}</span>
    </button>`).join('');
  return `
    <section class="card-glass border rounded-2xl p-3.5 md:p-4 mb-3">
      ${sectionHead(`${halladas.length} resultado${halladas.length > 1 ? 's' : ''}`, 'search')}
      <p class="wiki-p">Para «${esc(q)}»: pulsar uno lleva a su sección y lo deja señalado.</p>
      <div>${filas}</div>
    </section>`;
}

/**
 * Lleva la vista a un ancla ya pintada: abre los <details> cerrados que la
 * contengan (tiers de bases, parches viejos), hace scroll y la señala un
 * momento. Sin ancla visible no hace nada: un salto a un `id` que no existe
 * cae al principio de la sección sin avisar, y eso es lo que se evita.
 */
function llevaAlAncla(ancla: string): void {
  if (!vista.mount) return;
  const doc = vista.mount.ownerDocument;
  const el = doc.getElementById(ancla) as HTMLElement | null;
  if (!el || !vista.mount.contains(el)) return;
  let p: HTMLElement | null = el.parentElement;
  while (p && p !== vista.mount) {
    if (p.tagName === 'DETAILS' && !(p as HTMLDetailsElement).open) (p as HTMLDetailsElement).open = true;
    p = p.parentElement;
  }
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
  el.classList.add('wiki-flash');
  window.setTimeout(() => { if (el.isConnected) el.classList.remove('wiki-flash'); }, 1600);
}

/**
 * El salto entre conceptos: cambia de sección si hace falta, limpia la
 * búsqueda (el resultado ya cumplió) y cae en el ancla. También deja la
 * dirección en el hash, para que el enlace se pueda copiar y abrir directo.
 */
function irA(seccion: SeccionWiki, ancla?: string | null): void {
  const cambiaSeccion = seccion !== ui.seccion || ui.q.trim() !== '';
  ui.seccion = seccion;
  ui.q = '';
  if (vista.campo) vista.campo.value = '';
  if (cambiaSeccion) pintaWiki();
  if (ancla) llevaAlAncla(ancla);
  else if (vista.scroller) vista.scroller.scrollTop = 0;
  try {
    history.replaceState(null, '', ancla ? `#${seccion}/${ancla}` : `#${seccion}`);
  } catch {
    // file:// o un iframe con sandbox: el hash es comodidad, no regla.
  }
}

/** Repinta pestañas y cuerpo. El campo de búsqueda no se toca (ver `vista`). */
function pintaWiki(): void {
  if (!vista.mount || !vista.scroller) return;
  const q = ui.q.trim();
  vista.mount.innerHTML = `${tabsHTML()}<div>${q ? resultadosDeBusqueda(q) : cuerpoDeSeccion()}</div>`;
  vista.scroller.scrollTop = 0;
}

/** La dirección con la que se abrió: `#cajas/caja-T3` o solo `#cajas`. */
function destinoDeHash(): { seccion: SeccionWiki; ancla: string | null } | null {
  const m = /^#([a-z]+)(?:\/([A-Za-z0-9_.-]+))?$/.exec(location.hash);
  if (!m) return null;
  const s = m[1] as SeccionWiki;
  if (!SECCIONES.some(x => x.id === s)) return null;
  return { seccion: s, ancla: m[2] ?? null };
}

/** La barra de las siete pestañas, compartida por los dos montajes. */
function tabsHTML(): string {
  return `
    <div class="flex gap-1.5 overflow-x-auto pb-1 mb-3 overscroll-contain" role="tablist" aria-label="Secciones de la Wiki">
      ${SECCIONES.map(s => {
        const activa = ui.seccion === s.id;
        return `
          <button data-wiki-seccion="${s.id}" role="tab" aria-selected="${activa}"
            class="h-9 px-3 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition
                   flex items-center gap-1.5 flex-shrink-0 border min-h-[44px]
                   ${activa ? 'accent-bg text-slate-950 border-transparent'
                            : 'btn-ghost text-[var(--text-muted)]'}"
            ${activa ? 'aria-current="page"' : ''}>
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(s.icon as any)}</span>
            ${s.label}
          </button>`;
      }).join('')}
    </div>
  `;
}

/**
 * Monta la Wiki en su pestaña aparte (`wiki.html`).
 *
 * No usa `pageShell` ni el router del juego a propósito: no hay partida, no
 * hay navegación a sectores y no hay nada que guardar. La cáscara es mínima
 * —título, aviso de solo lectura, buscador y botón de cerrar— y el contenido
 * se repinta dentro de su propio nodo, así que cambiar de pestaña no mueve el
 * scroll de la página: se vuelve arriba, que es donde empieza cada sección.
 */
export function renderWikiStandalone(container: HTMLElement) {
  container.innerHTML = `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">
      <header class="relative z-20 card-glass flex-shrink-0 px-3 md:px-5 py-2.5
                     border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
              style="padding-top: max(0.625rem, env(safe-area-inset-top))">
        <div class="flex items-center gap-2 min-h-[3.5rem]">
          <span class="accent-text flex-shrink-0 [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('scroll')}</span>
          <div class="min-w-0 flex-1">
            <h1 class="font-['Orbitron'] font-bold text-[15px] md:text-lg accent-text truncate leading-tight">Wiki</h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] truncate">Solo lectura: no toca tu partida</p>
          </div>
          <button data-wiki-cerrar
                  class="h-9 px-3 rounded-lg btn-ghost text-[11px] font-mono font-bold cursor-pointer
                         flex items-center gap-1.5 flex-shrink-0"
                  aria-label="Cerrar la Wiki">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('close')}</span>
            Cerrar
          </button>
        </div>
      </header>
      <div class="flex-shrink-0 w-full max-w-[68rem] mx-auto px-3 md:px-4 pt-2">
        <label class="relative block" for="wiki-q">
          <span class="sr-only">Buscar en la Wiki</span>
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none [&>span>svg]:w-4 [&>span>svg]:h-4" aria-hidden="true">${ic('search')}</span>
          <input id="wiki-q" data-wiki-q type="search" autocomplete="off"
                 placeholder="Buscar: forja, T10, un nombre de base…"
                 aria-label="Buscar en la Wiki"
                 class="h-11 w-full pl-9 pr-3 rounded-xl btn-ghost text-[12px] font-mono
                        placeholder:text-[var(--text-muted)] placeholder:opacity-70
                        focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
        </label>
      </div>
      <main data-wiki-scroll class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
                   px-3 md:px-4 pt-2 md:pt-3 overflow-y-auto overscroll-contain"
            style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))">
        <div data-wiki-mount></div>
      </main>
    </div>`;

  vista.scroller = container.querySelector('[data-wiki-scroll]') as HTMLElement;
  vista.mount = container.querySelector('[data-wiki-mount]') as HTMLElement;
  vista.campo = container.querySelector('[data-wiki-q]') as HTMLInputElement;

  // Un solo delegado en el contenedor: pestañas, enlaces y resultados se
  // recrean en cada pintado. El campo de búsqueda sobrevive (ver `vista`).
  container.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-wiki-cerrar]')) {
      e.preventDefault();
      // Si se abrió desde el juego, se puede cerrar; si se llegó directa,
      // volver al juego es lo único que tiene sentido ofrecer.
      if (window.opener) window.close();
      else location.href = 'index.html';
      return;
    }
    if ((e.target as HTMLElement).closest('[data-wiki-limpiar]')) {
      e.preventDefault();
      ui.q = '';
      if (vista.campo) {
        vista.campo.value = '';
        vista.campo.focus();
      }
      pintaWiki();
      return;
    }
    const salto = (e.target as HTMLElement).closest('[data-wiki-ir]') as HTMLElement | null;
    if (salto) {
      e.preventDefault();
      irA(salto.getAttribute('data-wiki-ir') as SeccionWiki, salto.getAttribute('data-wiki-ancla'));
      return;
    }
    const tab = (e.target as HTMLElement).closest('[data-wiki-seccion]') as HTMLElement | null;
    if (!tab) return;
    const id = tab.getAttribute('data-wiki-seccion') as SeccionWiki | null;
    if (!id || (id === ui.seccion && ui.q.trim() === '')) return;
    e.preventDefault();
    irA(id);
  });

  // El `input` repinta solo el cuerpo: el campo no se recrea y el foco queda.
  container.addEventListener('input', (e) => {
    const campo = (e.target as HTMLElement).closest('[data-wiki-q]') as HTMLInputElement | null;
    if (!campo) return;
    ui.q = campo.value;
    pintaWiki();
  });

  // Enter salta al primer resultado: es el "moverse automáticamente".
  container.addEventListener('keydown', (e) => {
    const campo = (e.target as HTMLElement).closest('[data-wiki-q]') as HTMLInputElement | null;
    if (!campo || (e as KeyboardEvent).key !== 'Enter') return;
    const primera = buscarEnWiki(ui.q)[0];
    if (!primera) return;
    e.preventDefault();
    irA(primera.seccion, primera.ancla);
  });

  const destino = destinoDeHash();
  if (destino) {
    ui.seccion = destino.seccion;
    pintaWiki();
    if (destino.ancla) llevaAlAncla(destino.ancla);
  } else {
    pintaWiki();
  }
}
