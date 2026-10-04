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
//   4. El árbol: 5 columnas de 4-5 nodos, con enlaces entre ramas
//   5. Bottom sheet de detalle al tocar un nodo
//
// El árbol se pinta por columnas (tier), no por ramas, porque en móvil una
// rejilla de 5 columnas se lee como una progresión izquierda-derecha sin
// necesidad de explaining las conexiones cruzadas con líneas SVG.
// ==========================================================================

import { ic, icSafe } from './icons';
import { pageShell, mountInto, wireNav, statStrip } from './pageShell';
import { TREE_NODES, TREE_BY_ID, nodeCost, TREE_CATEGORY_META } from '../data/tree';
import { canBuyNode, nextCores, coreProgress, nanitesToNextCore, treeCompletion } from '../data/prestige';
import { formatNumber } from '../utils/format';
import { sfx } from '../utils/audio';
import { showConfirmModal } from '../utils/modal';
import { showToast } from '../utils/toast';
import type { PassiveBonuses } from '../types/domain';

/** Etiqueta legible de una bonificación, con su valor. */
function bonusLabel(key: keyof PassiveBonuses, value: number): string {
  const pct = (v: number) => `+${Math.round(v * 100)}%`;
  switch (key) {
    case 'clickMult': return `${pct(value)} daño de click`;
    case 'passiveMult': return `${pct(value)} ingreso pasivo`;
    case 'costReduction': return `−${Math.round(value * 100)}% coste de tienda`;
    case 'sellMult': return `${pct(value)} precio de venta`;
    case 'craftLuck': return `${pct(value)} éxito de forja`;
    case 'consolationBonus': return `${pct(value)} cristales por fallo`;
    case 'autoClick': return `+${value} clics/s automáticos`;
    case 'afkHours': return `+${value * 60} min de AFK`;
    case 'offlineClicks': return `+${value} clics al volver`;
    case 'crateLuck': return `${pct(value)} suerte en cajas`;
    case 'coreGain': return `${pct(value)} núcleos por reinicio`;
    case 'storageSlots': return `+${value} slots de almacén`;
    case 'companionSlots': return `+${value} slots de compañero`;
    default: return `${key} +${value}`;
  }
}

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
    coreGain: bonus.coreGain
  });
  const completion = treeCompletion(state.nodeLevels || {});
  const canRecycle = pending > 0;

  // Distribución de nodos por columna (tier)
  const byTier: Record<number, typeof TREE_NODES> = {};
  for (const node of TREE_NODES) {
    (byTier[node.tier] ||= []).push(node);
  }
  for (const tier of Object.keys(byTier)) {
    byTier[Number(tier)].sort((a, b) => a.y - b.y);
  }

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
      que es otra pregunta. Y las otras dos —reinicios y porcentaje del árbol— no son
      recursos.
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
      ` : `
        <div class="mb-2.5">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-[10px] font-mono text-[var(--text-muted)]">
              Produce ${formatNumber(nanitesToNextCore({
                totalNanitesProduced: state.totalNanitesProduced,
                totalCores: state.totalCores,
                coreGain: bonus.coreGain
              }))} más para el ${state.totalCores > 0 ? 'siguiente' : 'primer'} núcleo
            </span>
          </div>
          <div class="meter is-tall"><span style="width:${Math.round(coreProgress({
            totalNanitesProduced: state.totalNanitesProduced,
            totalCores: state.totalCores,
            coreGain: bonus.coreGain
          }) * 100)}%"></span></div>
        </div>
      `}

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

    <!-- El árbol -->
    <section class="card-glass rounded-2xl p-3 md:p-4">
      <div class="flex items-center justify-between gap-2 mb-3">
        <h2 class="label-caps flex items-center gap-1.5">
          <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('tree')}</span>
          Árbol de pasivas
        </h2>
        <div class="flex items-center gap-1.5 flex-wrap justify-end">
          ${Object.values(TREE_CATEGORY_META).map(c => `
            <span class="text-[9px] font-mono ${c.color} hidden sm:inline">${c.label}</span>
          `).join('')}
        </div>
      </div>

      <div class="tree-wrap">
        <div class="tree-grid">
          ${[0, 1, 2, 3, 4].map(tier => `
            <div class="flex flex-col gap-1.5 min-w-0">
              <div class="label-caps text-center pb-0.5">T${tier}</div>
              ${(byTier[tier] || []).map(node => nodeCell(node)).join('')}
            </div>
          `).join('')}
        </div>
      </div>

      <p class="text-[10px] text-[var(--text-muted)] mt-3 leading-relaxed text-center">
        Los nodos se desbloquean de izquierda a derecha. Las ramas caras exigen
        dos nodos previos: la forja se planea, no se tapsa.
      </p>
    </section>
  `;

  const root = mountInto(container, pageShell({
    title: 'Ascensión',
    icon: 'recycle',
    route: 'prestigio',
    state,
    actions: `
      <span class="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border border-[var(--border-color)]
                   text-[11px] font-mono accent-text"
            style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
        ${ic('core', 'w-3.5 h-3.5')} ${formatNumber(state.cores)}
      </span>
    `
  }, body));

  wireNav(root, { go });
  wireEvents(root, game, state, go);
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
      coreGain: state.bonus.coreGain
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
      const descripcion = `${node.name} — nivel ${level + 1}/${node.maxLevel}. ${effectLine}.`;
      const conDinero = check.ok;

      showConfirmModal(
        conDinero
          ? descripcion
          : `${descripcion} Todavía no: ${check.reason ?? 'no está disponible'}.`,
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
          sublabel: `${cat?.label ?? 'Nodo'} · nivel ${level + 1}/${node.maxLevel}`,
          confirmText: conDinero
            ? `Comprar por ${nodeCost(node, level)} ◆`
            : `Te faltan ${nodeCost(node, level) - state.cores} ◆`,
          confirmDisabled: !conDinero
        }
      );
    });
  });
}
