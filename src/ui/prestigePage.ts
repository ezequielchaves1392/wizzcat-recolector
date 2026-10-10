// ==========================================================================
// Página de Ascensión · Reciclaje + Árbol de Pasivas
//
// Es la página que resuelve el techo del juego. Antes de ella, un jugador
// acababa los 10 tiers de compañeros en un par de horas y se quedaba sin nada
// que comprar; aquí el progreso se convierte en una moneda permanente.
//
// Estructura de la pantalla, de arriba abajo:
//   1. Estado de la ascensión: cuántos núcleos hay y cuántos daría el reinicio
//   2. Botón de reciclar, con un resumen explícito de lo que se pierde
//   3. Resumen de bonificaciones activas (lo que el árbol ya te da)
//   4. Las ramas: cuatro pestañas (Asalto / Manada / Fortuna / Forja)
//   5. Bottom sheet de detalle al tocar un nodo
//
// Cada pestaña enseña UNA rama y sus requisitos no salen de ella: lo que se ve
// es lo que hay que decidir. El fondo de cada rama se abre por puntos —niveles
// comprados en ella—, no por nodos sueltos.
// ==========================================================================

import { ic, icSafe } from './icons';
import { pageShell, mountInto, wireNav, statStrip } from './pageShell';
import { TREE_NODES, TREE_BY_ID, nodeCost, TREE_CATEGORY_META, COLUMNA_META } from '../data/tree';
import { canBuyNode, nextCores, coreProgress, nanitesToNextCore, treeCompletion, puntosEnRama, UMBRAL_PUNTOS_RAMA } from '../data/prestige';
import { formatNumber } from '../utils/format';
import { bonusLabel } from './bonusLabels';
import { sfx } from '../utils/audio';
import { htmlToNode } from '../utils/modal';import { showConfirmModal } from '../utils/modal';
import { showToast } from '../utils/toast';
import type { PassiveBonuses } from '../types/domain';

// **LA PESTAÑA ABIERTA SOBREVIVE AL RE-RENDER (R6).** Comprar un nodo repinta
// la página entera y sin este estado volvería siempre a la primera pestaña,
// que es justo lo que rompía el selector de la forja (A5): decidir algo no
// puede devolverte a otro sitio.
const ui: { tab: string } = { tab: 'asalto' };

// Las ramas en el orden en que se enseñan: el del catálogo, que es el que
// decide la identidad de cada una.
const RAMAS = Object.keys(TREE_CATEGORY_META);

/** Etiqueta legible de una bonificación, con su valor. */
/** Resumen de lo que el árbol está aportando ahora mismo. */
function activeBonusList(bonus: PassiveBonuses): string {
  const entries = (Object.keys(bonus) as Array<keyof PassiveBonuses>)
    .map(k => [k, bonus[k]] as const)
    .filter(([, v]) => v > 0)
    // Primero lo que más rinde, para que el jugador vea el efecto gordo arriba
    .sort((a, b) => weight(b[0], b[1]) - weight(a[0], a[1]));

  if (entries.length === 0) {
    return `<p class="text-[11px] text-[var(--text-muted)] leading-relaxed">
      Todavía no has invertido ningún núcleo. Recicla una vez para desbloquear la rama de las pasivas.
    </p>`;
  }

  return `
    <div class="flex flex-wrap gap-1.5">
      ${entries.map(([k, v]) => `
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono
                     border border-[var(--border-color)] text-[var(--text-main)]"
              style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
          ${bonusLabel(k, v)}
        </span>
      `).join('')}
    </div>
  `;
}

/** Orden de importancia: los multiplicadores globales valen mucho más que los planos. */
function weight(key: keyof PassiveBonuses, value: number): number {
  const mult = (key === 'clickMult' || key === 'passiveMult') ? 4 : 1;
  return value * mult;
}

export function renderPrestigePage(
  container: HTMLElement,
  game: any,
  go?: (r: any) => void
) {
  const state = game.getState();
  const bonus: PassiveBonuses = state.bonus;
  const pending = nextCores({
    totalNanitesProduced: state.totalNanitesProduced,
    totalCores: state.totalCores,
    coreGain: bonus.coreGain,
    baseAlComprar: state.baseAlComprar
  });
  const completion = treeCompletion(state.nodeLevels || {});
  const canRecycle = pending > 0;

  // Nodos por rama, con sus tiers en orden: cada pestaña enseña una rama.
  const byRama: Record<string, typeof TREE_NODES> = {};
  for (const node of TREE_NODES) {
    (byRama[node.category] ||= []).push(node);
  }
  for (const rama of Object.keys(byRama)) {
    byRama[rama].sort((a, b) => a.tier - b.tier || a.y - b.y);
  }
  // Si el guardado trae una pestaña que ya no existe (rama renombrada), se
  // vuelve a la primera en vez de pintar una pestaña vacía. `ui` vive en
  // memoria y no se guarda, así que esto solo pasa en caliente.
  if (!byRama[ui.tab]) ui.tab = RAMAS[0];

  const nodeCell = (node: typeof TREE_NODES[number]) => {
    const level = state.nodeLevels[node.id] || 0;
    const check = canBuyNode(node.id, state.nodeLevels, state.cores);
    const capped = level >= node.maxLevel;
    const cost = capped ? null : nodeCost(node, level);
    const cat = TREE_CATEGORY_META[node.category];

    const cls = [
      'tree-node',
      level > 0 ? 'is-owned' : '',
      capped ? 'is-capped' : '',
      !check.ok && !capped ? (check.reason?.startsWith('Requiere') ? 'is-locked' : '') : 'is-affordable'
    ].filter(Boolean).join(' ');

    return `
      <button class="${cls}" data-node="${node.id}" aria-label="${node.name}">
        <span class="${cat?.color || 'accent-text'} [&>span>svg]:w-4 [&>span>svg]:h-4">${icSafe(node.icon)}</span>
        <span class="text-[9px] leading-[1.15] font-mono text-[var(--text-main)] px-0.5 line-clamp-2">
          ${node.name}
        </span>
        <span class="flex items-center gap-[3px]">
          ${Array.from({ length: Math.min(node.maxLevel, 5) }).map((_, i) =>
            `<span class="tree-pip ${i < Math.min(level, 5) ? 'is-on' : ''}"></span>`
          ).join('')}
        </span>
        ${capped
          ? `<span class="text-[9px] font-mono text-amber-400">MAX</span>`
          : `<span class="text-[9px] font-mono tabular ${state.cores >= cost! ? 'accent-text' : 'text-[var(--text-muted)]'}">${cost} ◆</span>`}
      </button>
    `;
  };

  const body = `
    <!--
      "Núcleos" sale de aquí y va a la cabecera. Es el mismo razonamiento que en el perfil,
      y aquí es más grave: **esta es la pantalla donde se gastan**, así que el saldo se
      necesita delante de cada nodo del árbol. Leyéndolo arriba, a la altura de la
      cabecera, el gesto de comprobar "cuántos tengo" es el mismo que en la base y que en
      el almacén.

      Y lo que se queda, "Al reiniciar", **no es el saldo**: es lo que vas a conseguir,
      que es otra pregunta. Por eso la tira NO repite la cartera (B14): la cabecera ya
      la enseña en su franja y dos cifras del mismo saldo se desincronizan. El
      histórico sí sale, abajo en su sector, porque no está en ningún otro sitio.
    -->
    ${statStrip([
      { label: 'Al reiniciar', value: `+${formatNumber(pending)}`, tone: 'text-emerald-400' },
      { label: 'Reinicios', value: String(state.resets) },
      { label: 'Árbol', value: `${Math.round(completion * 100)}%` }
    ])}

    <!-- Panel de reciclaje -->
    <section class="card-glass rounded-2xl p-3.5 md:p-4 mb-3">
      <div class="flex items-start gap-2.5 mb-2.5">
        <span class="accent-text flex-shrink-0 [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('recycle')}</span>
        <div class="min-w-0 flex-1">
          <h2 class="font-['Orbitron'] font-bold text-[13px] accent-text">Reciclar progreso</h2>
          <p class="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 leading-relaxed">
            Conviertes todo lo que has construido en núcleos permanentes.
          </p>
        </div>
      </div>

      ${canRecycle ? `
        <div class="flex items-center justify-between gap-3 py-2 px-3 rounded-xl mb-2.5"
             style="background: color-mix(in srgb, var(--accent) 10%, transparent);
                    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent)">
          <span class="text-[11px] font-mono text-[var(--text-muted)]">Producido total</span>
          <span class="font-['Orbitron'] font-bold text-sm accent-text tabular">${formatNumber(state.totalNanitesProduced)}</span>
        </div>
      ` : ''}
      ${(() => {
        // B42: lo que falta y la barra se enseñan SIEMPRE, también pudiendo
        // reciclar. Antes este bloque solo salía sin núcleos por ganar, y con
        // +N la pantalla no decía cuánto falta para +N+1: el progreso quedaba
        // clavado al máximo. La cuenta es la que cobra el botón (R3).
        const base = {
          totalNanitesProduced: state.totalNanitesProduced,
          totalCores: state.totalCores,
          coreGain: bonus.coreGain,
          baseAlComprar: state.baseAlComprar
        };
        const falta = nanitesToNextCore(base);
        const porc = Math.round(coreProgress(base) * 100);
        return `
        <div class="mb-2.5">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-[10px] font-mono text-[var(--text-muted)]">
              ${pending > 0
                ? `Produce ${formatNumber(falta)} más para ganar ${formatNumber(pending + 1)} núcleos`
                : `Produce ${formatNumber(falta)} más para el ${state.totalCores > 0 ? 'siguiente' : 'primer'} núcleo`}
            </span>
          </div>
          <div class="meter is-tall"><span style="width:${porc}%"></span></div>
        </div>`;
      })()}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-[10px]">
        <div class="rounded-xl border border-[var(--border-color)] p-2.5">
          <div class="label-caps mb-1" style="color:#f87171">Se pierde</div>
          <ul class="space-y-0.5 text-[var(--text-muted)] leading-snug">
            <li>Nanitas y todo el ingreso pasivo</li>
            <li>Recolectores, compañeros e infraestructura</li>
            <li>Llaves, cristales y cajas sin abrir</li>
          </ul>
        </div>
        <div class="rounded-xl border border-[var(--border-color)] p-2.5">
          <div class="label-caps mb-1" style="color:#4ade80">Se conserva</div>
          <ul class="space-y-0.5 text-[var(--text-muted)] leading-snug">
            <li>Núcleos, nodos del árbol y cosméticos</li>
            <li>Logros y sus bonificaciones</li>
            <li>Los recolectores que ya forjaste</li>
          </ul>
        </div>
      </div>

      <!--
        HISTÓRICO DE NÚCLEOS (F70). Arriba va lo actual —la cartera, que es lo
        que se gasta— y aquí lo ganado en total: son dos preguntas distintas y
        la segunda es la que sube con cada Ascensión.
      -->
      <div class="rounded-xl border border-[var(--border-color)] p-2.5 mb-3">
        <div class="label-caps mb-1">Histórico</div>
        <p class="text-[10px] font-mono text-[var(--text-muted)] leading-snug">
          ${formatNumber(state.totalCores)} núcleos ganados en ${state.resets} reinicio${state.resets === 1 ? '' : 's'}.
        </p>
      </div>

      <button id="recycle-btn" ${canRecycle ? '' : 'disabled'}
        class="w-full h-12 rounded-xl font-['Orbitron'] font-bold text-[12px] tracking-wide cursor-pointer
               ${canRecycle ? 'btn-primary' : 'btn-ghost opacity-40 cursor-not-allowed'}">
        ${canRecycle ? `RECICLAR Y GANAR ${formatNumber(pending)} NÚCLEOS` : 'AÚN NO PUEDES RECICLAR'}
      </button>
    </section>

    <!-- Bonificaciones activas -->
    <section class="card-glass rounded-2xl p-3.5 md:p-4 mb-3">
      <h2 class="label-caps mb-2 flex items-center gap-1.5">
        <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('sparkle')}</span>
        Bonificaciones activas
      </h2>
      ${activeBonusList(bonus)}
    </section>

    <!-- El árbol, por ramas -->
    <section class="card-glass rounded-2xl p-3 md:p-4">
      <div class="flex items-center gap-1.5 mb-3">
        <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('tree')}</span>
        <h2 class="label-caps">Árbol de pasivas</h2>
      </div>

      <!--
        Las pestañas son las ramas, y cada una enseña solo la suya (R8: la rama
        viaja en data-rama, no en la clase). Con role=tablist porque lo son:
        un lector de pantalla anuncia "pestaña Asalto" y no cuatro botones.
      -->
      <div class="flex gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Ramas de pasivas" style="overscroll-behavior-x: contain">
        ${RAMAS.map(rama => {
          const cat = TREE_CATEGORY_META[rama];
          const puntos = puntosEnRama(state.nodeLevels || {}, rama);
          const activa = ui.tab === rama;
          return `
          <button role="tab" aria-selected="${activa ? 'true' : 'false'}" data-rama="${rama}"
                  class="flex-1 min-w-0 min-h-[44px] px-2 rounded-xl border font-mono text-[10px] leading-tight
                         ${activa ? '' : 'opacity-60'}"
                  style="${activa
                    ? `border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 12%, transparent)`
                    : 'border-color: var(--border-color)'}">
            <span class="block font-bold text-[11px] ${cat?.color || ''}">${cat?.label || rama}</span>
            <span class="block text-[var(--text-muted)] tabular">${puntos} pts</span>
          </button>`;
        }).join('')}
      </div>

      ${(() => {
        const nodos = byRama[ui.tab] || [];
        const porTier: Record<number, typeof nodos> = {};
        for (const n of nodos) (porTier[n.tier] ||= []).push(n);
        const puntos = puntosEnRama(state.nodeLevels || {}, ui.tab);
        const tiers = Object.keys(porTier).map(Number).sort((a, b) => a - b);
        const siguiente = tiers.find(t => puntos < (UMBRAL_PUNTOS_RAMA[t] ?? 0));
        return `
        <p class="text-[10px] font-mono text-[var(--text-muted)] mb-2 leading-relaxed">
          ${puntos} puntos en ${TREE_CATEGORY_META[ui.tab]?.label || ui.tab}
          ${siguiente !== undefined
            ? ` · T${siguiente} pide ${UMBRAL_PUNTOS_RAMA[siguiente]}`
            : ' · rama abierta entera'}
        </p>
        ${tiers.map(tier => `
          <div class="label-caps mt-2 mb-1.5 ${puntos < (UMBRAL_PUNTOS_RAMA[tier] ?? 0) ? 'opacity-50' : ''}">
            T${tier}${puntos < (UMBRAL_PUNTOS_RAMA[tier] ?? 0) ? ` · pide ${UMBRAL_PUNTOS_RAMA[tier]}` : ''}
          </div>
          ${(['izq', 'centro', 'der'] as const).map(col => {
            // F102 · Cada fila se parte en sus tres columnas: los dos lados a
            // elegir y el centro común. Sin cabecera, tres grupos de nodos son
            // tres grupos que el jugador tiene que bautizar solo. El nombre
            // sale de `COLUMNA_META`, al lado del dato, no escrito a mano (R2).
            const grupo = (porTier[tier] || []).filter(n => (n.columna || 'centro') === col);
            if (grupo.length === 0) return '';
            return `
            <div class="text-[10px] font-mono text-[var(--text-muted)] mt-1 mb-1">${COLUMNA_META[ui.tab]?.[col] || col}</div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-1">
              ${grupo.map(node => nodeCell(node)).join('')}
            </div>`;
          }).join('')}
        `).join('')}`;
      })()}

      <p class="text-[10px] text-[var(--text-muted)] mt-3 leading-relaxed text-center">
        Cada rama se abre por puntos: compra niveles en ella para bajar de fila.
        Los puntos son niveles, no núcleos —lo que compromete es quedarse.
      </p>
    </section>
  `;

  const root = mountInto(container, pageShell({
    title: 'Ascensión',
    icon: 'recycle',
    route: 'prestigio',
    state
    // **SIN PÍLDORA DE NÚCLEOS EN `actions`, Y POR QUÉ.** La cabecera ya enseña los
    // núcleos en su franja de recursos, que es la cifra única del saldo en las siete
    // pantallas. La píldora repetía el mismo número en la misma fila: dos cifras
    // para un solo saldo, y basta con que una refresque antes que la otra para que
    // se note. El saldo se mira arriba, a la altura de la cabecera, como en el resto
    // de sectores.
  }, body));

  wireNav(root, { go });
  wireEvents(root, game, state, go);
}

/**
 * LA HOJA DE UN NODO, Y POR QUÉ DEJA DE SER UNA FRASE.
 *
 * Antes el diálogo del árbol llevaba **una línea de texto**: "Instinto de Forja — nivel
 * 1/5. +6 % a la probabilidad de crafteo." Con veintidós nodos en pantalla y cinco
 * niveles en cada uno, esa línea responde a "¿cuánto cuesta?" y a nada más. Y las dos
 * preguntas que un jugador tiene al mirar un nodo son otras: **qué hace esto** y
 * **para qué me sirve**.
 *
 * El `description` da el número y el `lore` da el sentido, y van en bloques distintos
 * porque no se leen igual: uno se consulta y el otro se lee. El lore va en comillas, como
 * el de los items del almacén, porque es la misma clase de cosa: una frase sobre el
 * objeto que estás mirando.
 *
 * Y el motivo del veto va **encima de todo y en su propio color**, porque es lo que el
 * jugador vino a ver al abrir un nodo que no puede pagar: si está debajo del lore, se lee
 * después de la explicación y parece una nota al pie.
 *
 * Devuelve marcado, no un nodo, porque es una función pura y `htmlToNode()` la
 * convierte en el nodo que el modal ya sabe insertar.
 */
export function nodeSheetHTML(node: any, level: number, opts: {
  ok: boolean;
  reason?: string;
  coste: number;
  cores: number;
  categoria?: { label?: string } | null;
  requiere?: string[];
}): string {
  const entradas = Object.entries(node.bonus) as Array<[keyof PassiveBonuses, number]>;
  const efectos = entradas
    .map(([k, v]) => bonusLabel(k, v))
    .join(' · ') || 'Desbloquea una función';
  const alMaximo = level >= (node.maxLevel ?? 1);

  /**
   * LO QUE EL NODO APORTA **AHORA**, Y POR QUÉ FALTABA.
   *
   * `efectos` dice "+8 % daño de click" y es el **aporte de un nivel**, no el del
   * nodo: el texto sale de `bonusLabel(k, v)` sobre el `bonus` del catálogo, que es
   * el valor de un nivel. Con el nodo en **7/10**, ese +8 % es el del nivel 1 y un
   * jugador que tiene 56 % se queda con la cifra de uno. **Y el nivel ya está en la
   * hoja, en la píldora de abajo** —o sea que las dos cosas que hacen falta para
   * multiplicar están en la misma pantalla y en el orden equivocado: primero el 8,
   * después el 7. El jugador tiene que hacer la cuenta de cabeza para saber cuánto
   * tiene, y es la cuenta más fácil del juego.
   *
   * **LO QUE SE AÑADE ES LA SUMA, Y EL NÚMERO LO PONE `aggregateBonuses`**, no una
   * multiplicación en la vista: la regla es `bonificación × nivel`, y el mismo motor
   * que la aplica es el que la enseña. Si algún día un nodo tuviera un efecto que no
   * escala linealmente, esta fila mentiría —y por eso el banco comprueba que lo que
   * dice la hoja sea lo que el agregador da.
   *
   * **SOLO CUANDO HAY NIVEL.** Con el nodo en 0, "ahora" sería "+0", que es ruido y
   * además invites a comprar. En cuanto compras uno, la fila aparece.
   */
  const acumulado = level > 0
    ? entradas
        .map(([k, v]) => bonusLabel(k, v * level))
        .join(' · ')
    : '';
  const siguiente = !alMaximo && level > 0
    ? entradas.map(([k, v]) => bonusLabel(k, v * (level + 1))).join(' · ')
    : '';

  return `
    <div class="flex flex-col gap-3 text-left" style="max-width:22rem">
      <div>
        <div class="font-['Orbitron'] font-bold text-[15px] leading-tight" style="color:var(--text-main)">
          ${node.name}
        </div>
        <div class="text-[11px] font-mono leading-relaxed mt-1" style="color:var(--text-main)">
          ${efectos}
          <span class="opacity-50"> por nivel</span>
        </div>
        ${acumulado ? `
          <div class="text-[11px] font-mono leading-relaxed mt-1 accent-text">
            Ahora (nivel ${level}): ${acumulado}
          </div>` : ''}
        ${siguiente ? `
          <div class="text-[10px] font-mono leading-relaxed mt-0.5 opacity-60">
            Al nivel ${level + 1}: ${siguiente}
          </div>` : ''}
      </div>

      ${node.lore ? `
        <blockquote class="text-[11px] italic leading-relaxed px-2.5 py-2 rounded-lg"
          style="color:var(--text-main);
                 background: color-mix(in srgb, var(--accent) 7%, transparent);
                 border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent)">
          “${node.lore}”
        </blockquote>` : ''}

      <div class="flex flex-wrap gap-1.5 text-[10px] font-mono" style="color:var(--text-muted)">
        <span class="px-2 h-6 inline-flex items-center rounded-md"
              style="background: color-mix(in srgb, var(--accent) 12%, transparent); color:var(--accent)">
          Nivel ${Math.min(level + 1, node.maxLevel)}/${node.maxLevel}
        </span>
        <span class="px-2 h-6 inline-flex items-center rounded-md border border-[var(--border-color)]">
          ${opts.coste} ◆${opts.ok ? '' : ` · tienes ${opts.cores}`}
        </span>
        ${opts.categoria?.label ? `<span class="px-2 h-6 inline-flex items-center rounded-md border border-[var(--border-color)]">${opts.categoria.label}</span>` : ''}
        ${(opts.requiere ?? []).length > 0 ? `<span class="px-2 h-6 inline-flex items-center rounded-md border border-[var(--border-color)]">Pide: ${(opts.requiere ?? []).map(id => TREE_BY_ID[id]?.name ?? id).join(', ')}</span>` : ''}
      </div>

      ${alMaximo ? `
        <p class="text-[10px] font-mono" style="color:#fbbf24">Nivel máximo alcanzado.</p>
      ` : !opts.ok ? `
        <p class="text-[10px] font-mono leading-relaxed" style="color:#f87171">
          Todavía no: ${opts.reason ?? 'no está disponible'}.
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * Conecta los manejadores de la Ascensión.
 *
 * `root` es el nodo que `mountInto` acaba de crear, y los listeners van ahí
 * (R5). El re-render, en cambio, necesita el CONTENEDOR, y son cosas distintas:
 * `mountInto` sustituye el `[data-page-root]` que es hijo del contenedor, así
 * que si se le pasa el nodo montado no encuentra ninguno y hace `appendChild`.
 *
 * Consecuencia, y era un bug visible: comprar un nodo del árbol o pulsar
 * "Reciclar" montaba una copia entera de la página DENTRO de la que ya estaba, y
 * la copia no recibía `onHome` ni `go`: a partir del primer clic, el botón de
 * inicio y los `data-nav` dejaban de responder y no había forma de salir.
 *
 * El contenedor se recupera con `root.parentElement`, que es exactamente lo que
 * `mountInto` usó como padre. Es el mismo truco que usan `warehouse.ts` y
 * `forgePage.ts`.
 */
function wireEvents(root: HTMLElement, game: any, state: any, go?: (r: any) => void) {
  const container = root.parentElement as HTMLElement;
  // --- Reciclar ---
  container.querySelector('#recycle-btn')?.addEventListener('click', () => {
    const gained = nextCores({
      totalNanitesProduced: state.totalNanitesProduced,
      totalCores: state.totalCores,
      coreGain: state.bonus.coreGain,
      baseAlComprar: state.baseAlComprar
    });
    if (gained <= 0) return;
    showConfirmModal(
      `Reciclarás todo tu progreso y ganarás ${gained} núcleos. Recolectores, compañeros, nanitas, cajas y cristales se pierden.`,
      () => {
        const res = game.prestige();
        if (res.success) {
          sfx.prestige();
          showToast(`Ascendido: ${res.msg}`, 'success');
          renderPrestigePage(container, game, go);
        } else {
          showToast(res.msg, 'error');
        }
      },
      { sublabel: 'Confirmar reciclaje', confirmText: 'Reciclar', danger: true }
    );
  });

  // --- Pestañas de rama ---
  // Van sobre el nodo montado (R5) y solo cambian `ui.tab`: el re-render es el
  // mismo de comprar un nodo, así que el scroll se conserva igual (A5).
  container.querySelectorAll<HTMLElement>('[data-rama]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rama = btn.dataset.rama!;
      if (!rama || rama === ui.tab) return;
      ui.tab = rama;
      sfx.click();
      renderPrestigePage(container, game, go);
    });
  });

  // --- Nodos del árbol ---
  container.querySelectorAll<HTMLElement>('[data-node]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nodeId = btn.dataset.node!;
      const node = TREE_BY_ID[nodeId];
      if (!node) return;

      const level = state.nodeLevels[nodeId] || 0;
      const check = canBuyNode(nodeId, state.nodeLevels, state.cores);
      const cat = TREE_CATEGORY_META[node.category];
      const effectLine = Object.entries(node.bonus)
        .map(([k, v]) => bonusLabel(k as keyof PassiveBonuses, v as number))
        .join(' · ') || 'Desbloquea una función';

      // **EL DIÁLOGO SE ABRE SIEMPRE, Y LO ÚNICO QUE SE APAGA ES LA COMPRA.**
      //
      // Antes, un nodo que no podías pagar enseñaba un aviso —"Faltan 1 núcleos"— y se
      // acababa ahí. Es decir: **no había forma de saber qué hace una pasiva sin poder
      // comprarla**, con veinticinco nodos en pantalla. El jugador no podia planear
      // nada: veía el nombre, el coste y el punto, y nada más.
      //
      // Y el aviso tapaba justo lo que se venía a buscar. Un nodo que no se puede pagar
      // es **el nodo que más información necesita**, porque es el que el jugador está
      // mirando para decidir si vale la pena seguir:
      // "Instinto de Forja" no dice nada
      // con el nombre, y "+6 % a la probabilidad de crafteo" sí.
      //
      // El motivo va DENTRO del diálogo y no en un aviso aparte, porque el motivo sin la
      // explicación al lado es la mitad de la respuesta.
      // La hoja entera, con el lore y el motivo del veto. `effectLine` se queda arriba
      // porque es el `confirmText` del botón cuando no queda claro el coste.
      const hoja = nodeSheetHTML(node, level, {
        ok: check.ok,
        reason: check.reason,
        coste: nodeCost(node, level),
        cores: state.cores,
        categoria: cat,
        requiere: node.requires
      });
      const descripcion = `${node.name} — nivel ${level + 1}/${node.maxLevel}. ${effectLine}.`;
      const conDinero = check.ok;

      showConfirmModal(
        htmlToNode(hoja),
        () => {
          const res = game.buyNode(nodeId);
          if (res.success) {
            sfx.nodeBuy();
            showToast(res.msg, 'success');
          } else {
            sfx.error();
            showToast(res.msg, 'error');
          }
          renderPrestigePage(container, game, go);
        },
        {
          // **EL NIVEL NO SE REPITE ARRIBA.** Antes el `sublabel` decia "categoria · nivel 1/5" y
          // la hoja lo decia tambien; ahora la hoja es el sitio y el subtitulo solo categoriza.
          sublabel: cat?.label ?? 'Nodo',
          confirmText: conDinero
            ? `Comprar por ${nodeCost(node, level)} ◆`
            : `Te faltan ${nodeCost(node, level) - state.cores} ◆`,
          confirmDisabled: !conDinero
        }
      );
    });
  });
}
