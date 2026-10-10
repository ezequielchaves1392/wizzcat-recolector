// ==========================================================================
//  Herramientas de la Wiki · simulador de árbol y simulador de base (F98)
//
//  Las dos son cálculo puro sobre `src/data/`, sin game loop, sin Firebase y
//  sin auth —la Wiki ya vive así (`wiki.ts`)—. Por eso no tocan la partida:
//  todo lo que se "gasta" aquí son niveles de un objeto local, y el resumen
//  sale de las mismas funciones que cobran el juego (`nodeCost()`,
//  `coresGastadosEnArbol()`, `aggregateBonuses()`, `danioDeRango()`...). Un
//  número calculado aquí por su cuenta sería una segunda fuente de la verdad
//  (R2/R32), y es exactamente lo que se evita.
//
//  Estado: de módulo (R6), en `simHerr`. La página (`wikiPage.ts`) lo repinta
//  por zonas tras cada toque, sin volver arriba: decidir algo no puede
//  devolverte a otro sitio (precedente A5).
// ==========================================================================

import { icSafe } from './icons';
import { formatNumber } from '../utils/format';
import { bonusLabel } from './bonusLabels';
import {
  TREE_NODES, TREE_CATEGORY_META, nodeCost, coresGastadosEnArbol
} from '../data/tree';
import {
  canBuyNode, aggregateBonuses, puntosEnRama, treeCompletion,
  pendingCores, nanitesForCores, UMBRAL_PUNTOS_RAMA
} from '../data/prestige';
import {
  basePorId, basePorPosicion, tablaDe
} from '../data/bases';
import {
  AFFIXES, POOL_AFIJOS_COMPANERO, AFIX_MAX,
  danioDeRango, poderDeCompanero, poderEfectivoDeCompanio,
  multiplicadorDeNivel, multiplicadorDeRarezaDeCompanero,
  multiplicadorPorPotencialDeCompanero, efectoDeAfijos,
  efectoDeAfijosDeCompanero, techoDeNivel, estrellasDe,
  fraseDeAfijosDeRareza, desgloseDeStat
} from '../data/crafting';
import { rarezaDeTier } from '../data/tiers';
import { raritySlug, rarityClass, RARITY_TEXT } from '../components/crateLoot';
import { marcoDeBrillo, textoDeBrillo } from './brillo';
import type { PassiveBonuses } from '../types/domain';

// --------------------------------------------------------------------------
//  Estado (R6: sobrevive al repintado porque no vive en la función que pinta)
// --------------------------------------------------------------------------

export interface SelBaseSim {
  lado: 'rec' | 'com';
  tier: number;
  baseId: string | null;
  potencial: number;
  nivel: number;
  tipo: 'click' | 'passive' | 'multiplier';
  afijos: string[];
}

/** La base neutra (×1,00) del tier y el lado: la posición 6, que es la media. */
export function baseNeutra(tier: number, lado: 'rec' | 'com'): string | null {
  return basePorPosicion(tier, 6, lado === 'rec' ? 'recolector' : 'companero')?.id ?? null;
}

export const simHerr: {
  rama: string;
  niveles: Record<string, number>;
  presupuesto: number | null;
  produccion: number | null;
  base: SelBaseSim;
} = {
  rama: 'asalto',
  niveles: {},
  presupuesto: null,
  produccion: null,
  base: {
    lado: 'rec', tier: 1, baseId: baseNeutra(1, 'rec'),
    potencial: 3, nivel: 0,
    tipo: 'click', afijos: []
  }
};

// --------------------------------------------------------------------------
//  Simulador de árbol · lógica pura (la que ata el banco)
// --------------------------------------------------------------------------

export interface IntentoSim {
  ok: boolean;
  niveles: Record<string, number>;
  coste: number;
  motivo?: string;
}

/**
 * Un nivel más en el simulador, sin tocar la partida.
 *
 * La puerta es `canBuyNode()` con el presupuesto como cartera: sin presupuesto
 * (null) la cartera es infinita y solo mandan los requisitos y los puntos por
 * rama, que es lo que hace que una build imposible no se pueda armar ni aquí.
 */
export function compraSimulada(
  niveles: Record<string, number>,
  nodeId: string,
  presupuesto: number | null
): IntentoSim {
  const chk = canBuyNode(nodeId, niveles, presupuesto ?? Infinity);
  if (!chk.ok) {
    return { ok: false, niveles, coste: coresGastadosEnArbol(niveles), motivo: chk.reason };
  }
  const siguientes = { ...niveles, [nodeId]: (niveles[nodeId] || 0) + 1 };
  return { ok: true, niveles: siguientes, coste: coresGastadosEnArbol(siguientes) };
}

/** Un nivel menos. Es un sandbox: quitar no pide permiso, solo baja. */
export function quitaNivelSimulada(
  niveles: Record<string, number>,
  nodeId: string
): Record<string, number> {
  const actual = niveles[nodeId] || 0;
  if (actual <= 0) return niveles;
  const siguientes = { ...niveles };
  if (actual === 1) delete siguientes[nodeId];
  else siguientes[nodeId] = actual - 1;
  return siguientes;
}

export interface ResumenBuild {
  gastados: number;
  nodos: number;
  puntos: Record<string, number>;
  bonos: PassiveBonuses;
  avance: number;
}

/** Lo gastado, los puntos por rama y lo que otorga, todo de las reglas. */
export function resumenDeBuild(niveles: Record<string, number>): ResumenBuild {
  const puntos: Record<string, number> = {};
  for (const rama of Object.keys(TREE_CATEGORY_META)) puntos[rama] = puntosEnRama(niveles, rama);
  const nodos = Object.values(niveles)
    .reduce((a, b) => a + Math.max(0, Math.floor(Number(b) || 0)), 0);
  return {
    gastados: coresGastadosEnArbol(niveles),
    nodos,
    puntos,
    bonos: aggregateBonuses(niveles),
    avance: treeCompletion(niveles)
  };
}

/**
 * Cuánto hay que producir EN UNA SOLA RUN para pagar la build.
 *
 * No es "cuántos resets": cada Ascensión tiene que producir más que la
 * anterior (`nextCores` resta el histórico), así que un número de resets solo
 * existiría suponiendo un ritmo de producción que la Wiki no conoce. La cota
 * honesta es esta: con menos que esto en una run, los núcleos no salen.
 */
export function produccionParaBuild(gastados: number, coreGain: number): number {
  return nanitesForCores(gastados, coreGain);
}

/** Con X producidas por run, ¿cuántos núcleos darían y alcanza para C? */
export function cabeEnRun(
  produccion: number, gastados: number, coreGain: number
): { darian: number; cabe: boolean } {
  const darian = pendingCores(produccion, coreGain);
  return { darian, cabe: darian >= gastados };
}

// --------------------------------------------------------------------------
//  Simulador de árbol · HTML (las piezas visuales del juego, no copias)
// --------------------------------------------------------------------------

const RAMAS_SIM = Object.keys(TREE_CATEGORY_META);

/** Una tarjeta de nodo como la de Prestigio, con −/+ en vez de comprar. */
function tarjetaNodoSim(
  id: string, niveles: Record<string, number>, presupuesto: number | null
): string {
  const node = TREE_NODES.find(n => n.id === id);
  if (!node) return '';
  const nivel = niveles[id] || 0;
  const tope = nivel >= node.maxLevel;
  const chk = canBuyNode(id, niveles, presupuesto ?? Infinity);
  const bloqueado = !chk.ok && !tope && (chk.reason ?? '').startsWith('Requiere');
  const coste = tope ? null : nodeCost(node as any, nivel);
  const restantes = presupuesto === null ? null : presupuesto - coresGastadosEnArbol(niveles);
  const caro = coste !== null && restantes !== null && coste > restantes;
  const cat = (TREE_CATEGORY_META as Record<string, { label: string; color: string }>)[node.category];
  const puedeSubir = !tope && !bloqueado && !caro;
  // Lo pagado en ESTE nodo, nivel a nivel con la misma regla que cobra
  // (`nodeCost`, la que suma `coresGastadosEnArbol`): el resumen de abajo
  // dice el total de la build, pero mientras se sube hace falta verlo aquí.
  let pagado = 0;
  for (let i = 0; i < nivel; i++) pagado += nodeCost(node as any, i);

  return `
    <div class="card-glass border rounded-xl p-2 flex flex-col gap-1.5 ${bloqueado ? 'opacity-55' : ''}">
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="${cat?.color ?? 'accent-text'} flex-shrink-0 [&>span>svg]:w-4 [&>span>svg]:h-4">${icSafe(node.icon)}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-[11px] font-mono font-bold text-[var(--text-main)] truncate">${node.name}</span>
          <span class="block text-[10px] font-mono text-[var(--text-muted)] truncate">Nv ${nivel}/${node.maxLevel}</span>
        </span>
      </div>
      <div class="flex items-center gap-1" aria-hidden="true">
        ${Array.from({ length: Math.min(node.maxLevel, 5) }).map((_, i) =>
          `<span class="tree-pip ${i < Math.min(nivel, 5) ? 'is-on' : ''}"></span>`
        ).join('')}
        ${node.maxLevel > 5 ? `<span class="text-[9px] font-mono text-[var(--text-muted)]">+${node.maxLevel - 5}</span>` : ''}
      </div>
      <p class="text-[10px] font-mono text-[var(--text-muted)] leading-snug">${node.description}</p>
      <div class="flex items-center gap-1.5 mt-auto">
        <button data-herr="nodo-menos" data-nodo="${node.id}" aria-label="Quitar un nivel de ${node.name}"
                ${nivel <= 0 ? 'disabled' : ''}
                class="h-11 w-11 rounded-lg btn-ghost font-mono font-bold text-[14px] cursor-pointer flex-shrink-0
                       ${nivel <= 0 ? 'opacity-30 cursor-not-allowed' : ''}">−</button>
        <span class="flex-1 text-center text-[11px] font-mono tabular ${tope ? 'text-amber-400 font-bold' : 'accent-text font-bold'}">
          ${tope ? 'MAX' : `${formatNumber(coste ?? 0)} ◆`}
        </span>
        <button data-herr="nodo-mas" data-nodo="${node.id}" aria-label="Añadir un nivel de ${node.name}"
                ${puedeSubir ? '' : 'disabled'}
                title="${!puedeSubir ? (tope ? 'Nivel máximo' : (bloqueado || caro ? (chk.reason ?? '') : '')) : `Añadir por ${formatNumber(coste ?? 0)} núcleos`}"
                class="h-11 w-11 rounded-lg font-mono font-bold text-[14px] cursor-pointer flex-shrink-0
                       ${puedeSubir ? 'accent-bg text-slate-950' : 'btn-ghost opacity-30 cursor-not-allowed'}">+</button>
      </div>
      ${nivel > 0 ? `<p class="text-[10px] font-mono text-[var(--text-muted)] tabular leading-snug">Pagado ${formatNumber(pagado)} ◆ en este nodo</p>` : ''}
      ${!puedeSubir && !tope ? `<p class="text-[10px] font-mono text-[var(--text-muted)] leading-snug">${chk.reason ?? ''}</p>` : ''}
    </div>`;
}

/** El árbol por ramas y tiers, como en Prestigio pero de mentira. */
export function arbolSimHTML(): string {
  const { rama, niveles, presupuesto } = simHerr;
  const porTier: Record<number, typeof TREE_NODES> = {};
  for (const n of TREE_NODES.filter(x => x.category === rama)) (porTier[n.tier] ||= []).push(n);
  const tiers = Object.keys(porTier).map(Number).sort((a, b) => a - b);
  const puntos = puntosEnRama(niveles, rama);

  return `
    <div class="flex gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Ramas del simulador" style="overscroll-behavior-x: contain">
      ${RAMAS_SIM.map(r => {
        const cat = (TREE_CATEGORY_META as Record<string, { label: string; color: string }>)[r];
        const pts = puntosEnRama(niveles, r);
        const activa = rama === r;
        return `
        <button role="tab" aria-selected="${activa}" data-herr="rama" data-rama="${r}"
                class="flex-1 min-w-0 min-h-[44px] px-2 rounded-xl border font-mono text-[10px] leading-tight cursor-pointer
                       ${activa ? '' : 'opacity-60'}"
                style="${activa
                  ? `border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 12%, transparent)`
                  : 'border-color: var(--border-color)'}">
          <span class="block font-bold text-[11px] ${cat?.color ?? ''}">${cat?.label ?? r}</span>
          <span class="block text-[var(--text-muted)] tabular">${pts} pts</span>
        </button>`;
      }).join('')}
    </div>
    <p class="text-[10px] font-mono text-[var(--text-muted)] mb-2 leading-relaxed">
      ${puntos} puntos en ${(TREE_CATEGORY_META as Record<string, { label: string }>)[rama]?.label ?? rama}
      · el simulador no gasta tus núcleos de verdad
    </p>
    ${tiers.map(t => `
      <div class="label-caps mt-2 mb-1.5 ${puntos < (UMBRAL_PUNTOS_RAMA[t] ?? 0) ? 'opacity-50' : ''}">
        T${t}${puntos < (UMBRAL_PUNTOS_RAMA[t] ?? 0) ? ` · pide ${UMBRAL_PUNTOS_RAMA[t]}` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        ${(porTier[t] ?? []).map(n => tarjetaNodoSim(n.id, niveles, presupuesto)).join('')}
      </div>
    `).join('')}`;
}

/** El resumen: lo gastado, lo que otorga y lo que cuesta ganarlo. */
export function resumenBuildHTML(): string {
  const { niveles, presupuesto, produccion } = simHerr;
  const r = resumenDeBuild(niveles);
  const entradas = (Object.keys(r.bonos) as Array<keyof PassiveBonuses>)
    .map(k => [k, r.bonos[k]] as const)
    .filter(([, v]) => v > 0);
  const need = r.gastados > 0 ? produccionParaBuild(r.gastados, r.bonos.coreGain) : 0;
  const prueba = produccion !== null && produccion > 0 && r.gastados > 0
    ? cabeEnRun(produccion, r.gastados, r.bonos.coreGain)
    : null;

  return `
    <div class="wiki-box mb-2">
      <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)]">
        <span class="text-[11px] font-mono text-[var(--text-muted)]">Coste de la build</span>
        <span class="text-[12px] font-mono font-bold accent-text tabular">${formatNumber(r.gastados)} ◆</span>
      </div>
      <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)]">
        <span class="text-[11px] font-mono text-[var(--text-muted)]">Niveles comprados</span>
        <span class="text-[11px] font-mono text-[var(--text-main)] tabular">${r.nodos} · ${Math.round(r.avance * 100)} % del árbol</span>
      </div>
      <div class="flex items-center justify-between gap-2 py-1">
        <span class="text-[11px] font-mono text-[var(--text-muted)]">Puntos por rama</span>
        <span class="text-[10px] font-mono text-[var(--text-main)] tabular">${RAMAS_SIM.map(b =>
          `${(TREE_CATEGORY_META as Record<string, { label: string }>)[b]?.label ?? b} ${r.puntos[b] ?? 0}`).join(' · ')}</span>
      </div>
    </div>
    ${entradas.length === 0
      ? `<p class="wiki-p">Toca + en un nodo raíz para empezar: cada rama tiene la suya sin requisitos, así que siempre hay algo que probar.</p>`
      : `<div class="flex flex-wrap gap-1.5 mb-2">
          ${entradas.map(([k, v]) => `
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono
                         border border-[var(--border-color)] text-[var(--text-main)]"
                  style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
              ${bonusLabel(k, v)}
            </span>`).join('')}
        </div>`}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
      <label class="block">
        <span class="block text-[10px] font-mono text-[var(--text-muted)] mb-1">Presupuesto en núcleos (opcional)</span>
        <input data-herr-num="presupuesto" type="number" inputmode="numeric" min="0"
               value="${presupuesto ?? ''}" placeholder="Sin límite"
               aria-label="Presupuesto en núcleos"
               class="h-11 w-full px-3 rounded-xl btn-ghost text-[12px] font-mono tabular
                      focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
      </label>
      <label class="block">
        <span class="block text-[10px] font-mono text-[var(--text-muted)] mb-1">Produzco por Ascensión (opcional)</span>
        <input data-herr-num="produccion" type="number" inputmode="numeric" min="0"
               value="${produccion ?? ''}" placeholder="Ej. 10000000"
               aria-label="Nanitas que produces por Ascensión"
               class="h-11 w-full px-3 rounded-xl btn-ghost text-[12px] font-mono tabular
                      focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
      </label>
    </div>
    ${r.gastados > 0 ? `
    <div class="wiki-box">
      <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)]">
        <span class="text-[11px] font-mono text-[var(--text-muted)]">Para pagarla, una run de</span>
        <span class="text-[11px] font-mono font-bold text-[var(--text-main)] tabular">${formatNumber(need)} producidas</span>
      </div>
      ${prueba === null
        ? `<p class="text-[10px] font-mono text-[var(--text-muted)] py-1 leading-relaxed">Escribe lo que produces por Ascensión y te dice si esta build ya cabe en una run.</p>`
        : `<div class="flex items-center justify-between gap-2 py-1">
            <span class="text-[11px] font-mono text-[var(--text-muted)]">Con ${formatNumber(produccion ?? 0)} por run</span>
            <span class="text-[11px] font-mono font-bold tabular ${prueba.cabe ? 'text-emerald-400' : 'text-amber-400'}">
              Justifica ${formatNumber(prueba.darian)} ◆ en total · pide ${formatNumber(r.gastados)} ◆
            </span>
          </div>`}
    </div>` : ''}
    <button data-herr="arbol-reset"
            class="mt-2 h-11 px-3 rounded-xl btn-ghost text-[11px] font-mono font-bold cursor-pointer min-h-[44px]">
      Reiniciar el simulador
    </button>`;
}

// --------------------------------------------------------------------------
//  Simulador de base · lógica pura
// --------------------------------------------------------------------------

export interface FichaSimulada {
  techo: number;
  nivel: number;
  pot: number;
  total: number;
  filas: Array<{ texto: string; valor: string }>;
  crit: number;
  afijos: string[];
}

/**
 * Cómo quedaría una base con ese potencial, nivel y afijos.
 *
 * Recolector: `danioDeRango × nivel × (1 + afijos)`, como el intrínseco de la
 * ficha (`profile.ts`). Compañero: `poderEfectivoDeCompanio()`, que es lo que
 * cobra el ingreso. Sin buffs de partida en los dos: el simulador enseña el
 * objeto, no la run.
 */
export function fichaSimulada(sel: SelBaseSim): FichaSimulada {
  const pot = Math.min(5, Math.max(1, Math.round(sel.potencial) || 3));
  const tier = Math.min(10, Math.max(1, Math.floor(sel.tier) || 1));
  // La rareza la pone el tier y nada más: la misma tabla que ordena la
  // tienda, las cajas y la forja de compañeros. Un T10 es Divino sin que
  // nadie lo elija, y un T1 Divino no sale de ningún sitio.
  const rareza = rarezaDeTier(tier);
  const cruda = sel.baseId ? basePorId(sel.baseId) : undefined;
  // Una base de otro tier o de otro lado no pinta: cuenta como neutra en vez
  // de multiplicar con un número que no es el suyo.
  const lado = sel.lado === 'com' ? 'companero' : 'recolector';
  const tabla = tablaDe(lado);
  const base = cruda && cruda.tier === tier && (tabla[tier] ?? []).some(b => b.id === cruda.id)
    ? cruda
    : null;
  const techo = techoDeNivel(pot, base?.posicion ?? 6);
  const nivel = Math.min(techo, Math.max(0, Math.floor(Number(sel.nivel) || 0)));
  const pool = sel.lado === 'com' ? POOL_AFIJOS_COMPANERO : AFFIXES;
  const afijos = (Array.isArray(sel.afijos) ? sel.afijos : [])
    .filter(id => pool.some(a => a.id === id))
    .slice(0, AFIX_MAX);

  if (sel.lado === 'com') {
    const power = poderDeCompanero(tier, pot, base);
    const multAf = 1 + efectoDeAfijosDeCompanero(afijos, nivel, tier, sel.tipo);
    const total = poderEfectivoDeCompanio(
      { power, level: nivel, rarity: rareza, potential: pot },
      { multAfijos: multAf }
    );
    const filas = [
      { texto: `Poder T${tier}`, valor: String(power) },
      { texto: `Rareza ${rareza}`, valor: `×${multiplicadorDeRarezaDeCompanero(rareza).toFixed(2)}` }
    ];
    if (multiplicadorPorPotencialDeCompanero(pot) > 1) {
      filas.push({ texto: `Potencial ${pot}★`, valor: `×${multiplicadorPorPotencialDeCompanero(pot).toFixed(2)}` });
    }
    if (nivel > 0) filas.push({ texto: `Nivel ${nivel}`, valor: `×${multiplicadorDeNivel(nivel).toFixed(2)}` });
    if (afijos.length > 0) filas.push({ texto: `${afijos.length} afijo${afijos.length > 1 ? 's' : ''}`, valor: `×${multAf.toFixed(2)}` });
    filas.push({ texto: 'Total', valor: `${total}/s` });
    return { techo, nivel, pot, total, filas, crit: 0, afijos };
  }

  const dmg = danioDeRango(tier, pot, base);
  const multN = multiplicadorDeNivel(nivel);
  const ef = efectoDeAfijos(afijos, nivel, tier);
  const sinAfijos = Math.round(dmg * multN);
  const total = Math.floor(dmg * multN * (1 + ef.clickMult));
  const filas = desgloseDeStat(tier, dmg, pot, nivel, sinAfijos);
  // La última fila del desglose es su total sin afijos: se sustituye por la
  // cuenta entera, con los afijos dentro.
  filas.pop();
  if (afijos.length > 0) {
    filas.push({ texto: `${afijos.length} afijo${afijos.length > 1 ? 's' : ''}`, valor: `×${(1 + ef.clickMult).toFixed(2)}` });
  }
  filas.push({ texto: 'Total', valor: String(total) });
  return { techo, nivel, pot, total, filas, crit: ef.critChance, afijos };
}

// --------------------------------------------------------------------------
//  Simulador de base · HTML
// --------------------------------------------------------------------------

function selectorSim(
  clave: string, etiqueta: string, valor: string | number, opciones: Array<{ v: string | number; t: string }>, extra = ''
): string {
  return `
    <label class="block min-w-0">
      <span class="block text-[10px] font-mono text-[var(--text-muted)] mb-1">${etiqueta}</span>
      <select data-herr-sel="${clave}" aria-label="${etiqueta}"
              class="h-11 w-full px-2 rounded-xl btn-ghost text-[12px] font-mono cursor-pointer
                     focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${extra}">
        ${opciones.map(o => `<option value="${o.v}" ${String(o.v) === String(valor) ? 'selected' : ''}>${o.t}</option>`).join('')}
      </select>
    </label>`;
}

/** El comparador: eliges todo y ves el daño final, sin forja. */
export function baseSimHTML(): string {
  const sel = simHerr.base;
  const tabla = tablaDe(sel.lado === 'com' ? 'companero' : 'recolector');
  const lista = tabla[sel.tier] ?? [];
  const sumaSorteo = lista.reduce((a, b) => a + b.pesoDrop, 0) || 1;
  const baseElegida = sel.baseId ? basePorId(sel.baseId) : undefined;
  const f = fichaSimulada(sel);
  // La rareza la pone el tier y nada más: T10 es Divino sin elegirlo.
  // Sale de la misma tabla que la tienda, las cajas y la forja (R2).
  const rareza = rarezaDeTier(sel.tier);
  const tinteRareza = RARITY_TEXT[rareza] ?? 'accent-text';
  const pool = sel.lado === 'com' ? POOL_AFIJOS_COMPANERO : AFFIXES;
  const iconoSim = sel.lado === 'com' ? 'companion' : 'collector';
  // El item simulado, con lo que el brillo necesita: el techo es el que nace
  // con el item, igual que el `maxLevel` guardado que lee `brilloDeItem`.
  // Por eso el icono lleva su anillo de verdad, como en la app.
  const wSim = {
    type: sel.lado === 'com' ? 'companion' : 'collector',
    potential: f.pot, level: f.nivel, rarity: rareza, maxLevel: f.techo
  };
  const explicacionBrillo = textoDeBrillo(wSim);
  const fraseAfijos = fraseDeAfijosDeRareza(rareza);
  const partesFrase = fraseAfijos.split(rareza);

  return `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
      ${selectorSim('lado', 'Lado', sel.lado, [
        { v: 'rec', t: 'Recolector' }, { v: 'com', t: 'Compañero' }
      ])}
      ${selectorSim('tier', 'Tier', sel.tier,
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(t => ({ v: t, t: `Tier ${t}` })))}
      ${selectorSim('base', 'Base oculta', sel.baseId ?? '',
        lista.map(b => ({ v: b.id, t: `${b.nombre} ×${String(b.pesoStat).replace('.', ',')}` })))}
      ${selectorSim('potencial', 'Potencial', sel.potencial,
        [1, 2, 3, 4, 5].map(p => ({ v: p, t: `${'★'.repeat(p)} (${p})` })),
        'text-amber-400')}
      <div class="block min-w-0" aria-label="Rareza del item simulado">
        <span class="block text-[10px] font-mono text-[var(--text-muted)] mb-1">Rareza (la pone el tier)</span>
        <div class="h-11 w-full px-2 rounded-xl border border-[var(--border-color)] text-[12px] font-mono font-bold
                    flex items-center">
          <span class="${tinteRareza}">${rareza}</span>
        </div>
      </div>
      ${sel.lado === 'com' ? selectorSim('tipo', 'Tipo', sel.tipo, [
        { v: 'click', t: 'De click' }, { v: 'passive', t: 'Pasivo' }, { v: 'multiplier', t: 'Multiplier' }
      ]) : `
      <div class="block min-w-0" aria-label="Daño del item simulado">
        <span class="block text-[10px] font-mono text-[var(--text-muted)] mb-1">Daño final</span>
        <div class="h-11 w-full px-2 rounded-xl border border-[var(--border-color)] text-[12px] font-mono font-bold accent-text
                    flex items-center tabular">+${formatNumber(f.total)}</div>
      </div>`}
    </div>
    <label class="block mb-2">
      <span class="block text-[10px] font-mono text-[var(--text-muted)] mb-1">
        Nivel (techo ${f.techo} con <span class="text-amber-400">${estrellasDe(sel.potencial)}</span> y esta base)
      </span>
      <input data-herr-num="nivel" type="number" inputmode="numeric" min="0" max="${f.techo}"
             value="${sel.nivel}" aria-label="Nivel del item simulado"
             class="h-11 w-full px-3 rounded-xl btn-ghost text-[12px] font-mono tabular
                    focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
    </label>
    <h4 class="label-caps mt-3 mb-1.5">Afijos (${f.afijos.length}/${AFIX_MAX})</h4>
    <div class="flex flex-wrap gap-1.5 mb-1">
      ${pool.map(a => {
        const puesto = f.afijos.includes(a.id);
        const lleno = !puesto && f.afijos.length >= AFIX_MAX;
        return `
        <button data-herr="afijo" data-afijo="${a.id}" aria-pressed="${puesto}" ${lleno ? 'disabled' : ''}
                title="${a.description ?? a.name}"
                style="border-color: currentColor;${puesto ? ' background: color-mix(in srgb, currentColor 14%, transparent);' : ''}"
                class="min-h-[44px] px-2.5 rounded-lg text-[10px] font-mono border cursor-pointer
                       inline-flex items-center gap-1 rarity-${raritySlug(a.rarity)}
                       ${puesto ? 'font-bold' : ''} ${lleno ? 'opacity-30 cursor-not-allowed' : ''}">
          <span class="[&>span>svg]:w-3 [&>span>svg]:h-3 flex-shrink-0">${icSafe('sparkle')}</span>${a.name}
        </button>`;
      }).join('')}
    </div>
    <p class="text-[10px] font-mono text-[var(--text-muted)] mb-2 leading-relaxed">${partesFrase[0] ?? ''}<span class="${tinteRareza}">${rareza}</span>${partesFrase.slice(1).join(rareza)}</p>
    <section class="card-glass border rounded-2xl p-3.5" aria-label="Resultado de la simulación">
      <div class="flex items-center justify-between gap-2 mb-1">
        ${marcoDeBrillo(wSim, `<span class="ring-${raritySlug(rareza)} w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 ${rarityClass(rareza)} [&>span>svg]:w-5 [&>span>svg]:h-5"${explicacionBrillo ? ` title="${explicacionBrillo}"` : ''}>${icSafe(iconoSim)}</span>`, 'rarity-' + raritySlug(rareza))}
        <span class="min-w-0 flex-1 text-[12px] font-mono font-bold text-[var(--text-main)] truncate">
          ${baseElegida?.nombre ?? (sel.lado === 'com' ? 'Compañero' : 'Recolector')} <span class="text-amber-400">${estrellasDe(sel.potencial)}</span>
        </span>
        <span class="font-['Orbitron'] font-bold text-lg accent-text tabular flex-shrink-0">
          ${formatNumber(f.total)}${sel.lado === 'com' ? '<span class="text-[10px]">/s</span>' : ''}
        </span>
      </div>
      <p class="text-[10px] font-mono text-[var(--text-muted)] mb-2">
        T${sel.tier} · <span class="${tinteRareza}">${rareza}</span> · Nivel ${f.nivel}/${f.techo}
        ${baseElegida ? ` · sale 1 de cada ${Math.round(sumaSorteo / baseElegida.pesoDrop)} aprox.` : ''}
        ${sel.lado === 'rec' && f.crit > 0 ? ` · crítico ${(f.crit * 100).toFixed(0).replace('.', ',')} %` : ''}
        ${sel.lado === 'com' && sel.tipo === 'multiplier' ? ' · el aura es fija: los afijos no la mueven' : ''}
      </p>
      <div class="wiki-box">
        ${f.filas.map(r => `
          <div class="flex items-center justify-between gap-2 py-1 border-b border-[var(--border-color)] last:border-0">
            <span class="text-[11px] font-mono text-[var(--text-muted)]">${r.texto}</span>
            <span class="text-[11px] font-mono tabular ${r.texto === 'Total' ? 'font-bold accent-text' : 'text-[var(--text-main)]'}">${r.valor}</span>
          </div>`).join('')}
      </div>
      <p class="text-[10px] font-mono text-[var(--text-muted)] mt-2 leading-relaxed">
        Combinación ilustrativa, sin forja: aquí eliges todo y el juego lo sortea.
      </p>
    </section>`;
}
