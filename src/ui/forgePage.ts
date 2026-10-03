// ==========================================================================
// Forja · Fusión de recolectores
//
// Es la pantalla con más estados simultáneos del juego: selección de
// materiales, probabilidad, consumo de piedras, animación y resultado. Se
// resuelve con un estado único a nivel de módulo y un solo delegado de
// eventos, en vez de varias variables booleanas sueltas por función.
//
// La razón concreta: la primera versión guardaba la selección en variables
// locales de `renderForgePage` y se redirigía la página entera en cada clic.
// Como `renderForgePage` volvía a crear las variables, la selección se
// borraba en el primer toque: un flujo de 6 toques se convertía en 6 toques
// sin efecto. El estado tiene que sobrevivir al re-render, y eso significa
// vivir fuera de la función.
//
// Decisiones de diseño visibles en la pantalla:
//   - La probabilidad se enseña ANTES de confirmar, con el desglose. Un
//     gambling opaco se siente como un timo; uno con números, como una apuesta.
//   - La ruleta es decorativa. El resultado ya está decidido en `attemptForge`
//     antes de que la animación arranque: si la ruleta decidiera, mentiría
//     sobre las probabilidades y el jugador lo notaría en 20 tiradas.
//   - F33 · La receta son 2 materiales del mismo tier, y el potencial de la
//     nueva es la MEDIA de los dos. Promediar nunca sube el resultado: un 5 sale
//     de un 5. Así que la perfección se consigue en la tienda o en las cajas, y
//     la forja es la que consolida — te da el potencial que querías sin depender
//     del azar. Los 2 se consumen aciertes o falles.
// ==========================================================================

import { ic } from './icons';
import { pageShell, mountInto, wireNav, statStrip, emptyState, sectionHead } from './pageShell';
import { successChance, baseSuccessChance, AFFIX_BY_ID, estrellasDe, MATERIALES_POR_FUSION } from '../data/crafting';
import { formatNumber } from '../utils/format';
import { sfx } from '../utils/audio';
import { showConfirmModal } from '../utils/modal';
import { showToast } from '../utils/toast';
import { rarityClass, raritySlug } from '../components/crateLoot';

/** Estado de la pantalla. Vive aquí para sobrevivir a los re-renders. */
interface ForgeUIState {
  selected: string[];
  stones: number;
  nano: boolean;
  tier: number;
  /**
   * Qué se está fundiendo. La misma pantalla, dos resultados distintos: el
   * recolector forjado hereda afijos y el compañero forjado hereda potencial.
   *
   * **ES ESTADO DE MÓDULO Y NO UN PARÁMETRO, PORQUE TIENE QUE SOBREVIVIR AL
   * RE-RENDER.** Si fuera un argumento, marcar una piedra devolvería la pantalla a
   * recolectores con el yunque medio lleno.
   */
  tipo: 'collector' | 'companion';
}

const ui: ForgeUIState = { selected: [], stones: 0, nano: false, tier: 0, tipo: 'collector' };

/**
 * Los dos nombres del tipo elegido, en todas las formas que hace falta.
 *
 * **ESTO NO ES COSMÉTICA: ES LO QUE DICE EL JUGADOR CUANDO RECHAZA ALGO.** Un
 * "selecciona 2 recolectores" en un yunque de compañeros hace pensar que la
 * pantalla va mal, no que el jugador tocó el material equivocado.
 */
const NOMBRES = {
  collector: {
    uno: 'recolector', muchos: 'recolectores', icono: 'collector',
    verbo: 'forjada', participio: 'forjadas', vacio: 'recolectores'
  },
  companion: {
    uno: 'compañero', muchos: 'compañeros', icono: 'companion',
    verbo: 'forjado', participio: 'forjados', vacio: 'compañeros'
  }
} as const;

/** Punto de entrada. Re-monta la página conservando la selección. */
export function renderForgePage(container: HTMLElement, game: any, onBack: () => void, go?: (r: any) => void) {
  draw(container, game, onBack, go);
}

function draw(container: HTMLElement, game: any, onBack: () => void, go?: (r: any) => void) {
  const state = game.getState();
  const info = game.getForgeInfo();
  const N = NOMBRES[ui.tipo];

  const materiales = ((state.warehouse as any[]) || [])
    .filter(w => w.type === ui.tipo)
    .sort((a, b) => (a.tier - b.tier) || ((b.damage || b.power || 0) - (a.damage || a.power || 0)));

  const tiers = Array.from(new Set(materiales.map(w => w.tier))).sort((a, b) => a - b);

  // Saneado del estado: si el jugador vendió un material, se quita de la
  // selección. Sin esto, el yunque mostraría un recolector que ya no existe y el
  // botón de forjar fallaría al ejecutarse.
  ui.selected = ui.selected.filter(id => materiales.some(w => w.id === id));
  if (ui.selected.length > MATERIALES_POR_FUSION) ui.selected = ui.selected.slice(0, MATERIALES_POR_FUSION);
  if (!tiers.includes(ui.tier)) ui.tier = tiers[0] ?? 1;

  const stonesItem = ((state.warehouse as any[]) || []).find(w => w.buffId === 'calibrationStone');
  const stoneCount = stonesItem?.stackCount || 0;
  const maxStones = Math.min(5, stoneCount);
  if (ui.stones > maxStones) ui.stones = maxStones;

  const nanoItem = ((state.warehouse as any[]) || []).find(w => w.buffId === 'stabilityNano');
  const nanoCount = nanoItem?.stackCount || 0;
  // Si el jugador no tiene ninguna, el interruptor se desactiva solo
  if (nanoCount === 0) ui.nano = false;

  const elegidos = ui.selected
    .map(id => materiales.find(w => w.id === id))
    .filter(Boolean) as any[];

  const matTier = elegidos[0]?.tier ?? 0;
  // **LOS COMPAÑEROS NO SUMAN `affixLuck` PORQUE NO TIENEN AFIJOS.** No es un trato
  // peor: es que no tienen la entrada que lo suma. Por eso la cuenta sale de aquí
  // y no del motor, y por eso los dos tienen que usar la misma fórmula.
  const affixLuck = ui.tipo === 'collector'
    ? elegidos.reduce((a, w) => a + (w.affixes?.length || 0) * 0.02, 0)
    : 0;
  const chance = elegidos.length === MATERIALES_POR_FUSION && matTier
    ? successChance(matTier, info.craftLuck, ui.stones, affixLuck, ui.nano ? 1 : 0)
    : 0;
  const ready = elegidos.length === MATERIALES_POR_FUSION;

  /** Lo equipado no se puede consumir: perderlo sería un castigo doble. */
  const equipado = (w: any) => ui.tipo === 'collector'
    ? w.id === state.equippedCollectorId
    : (state.activeCompanions || []).includes(w.id);

  // --- Fragmentos -------------------------------------------------------

  const slot = (i: number) => {
    const w = elegidos[i];
    if (!w) {
      return `
        <button class="forge-slot" data-act="clear" data-slot="${i}" aria-label="Hueco ${i + 1}">
          <span class="text-[var(--text-muted)] opacity-30 [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('plus')}</span>
        </button>`;
    }
    return `
      <button class="forge-slot is-filled" data-act="clear" data-slot="${i}"
              style="border-color: color-mix(in srgb, var(--accent) 55%, transparent)"
              aria-label="Quitar ${w.name}">
        <span class="flex flex-col items-center gap-0.5 min-w-0 w-full">
          <span class="${rarityClass(w.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(N.icono)}</span>
          <span class="text-[9px] font-mono text-center leading-tight line-clamp-2">T${w.tier}</span>
          ${`<span class="text-[9px] text-amber-400 leading-none">${estrellasDe(w.potential)}</span>`}
        </span>
      </button>`;
  };

  const matCell = (w: any) => {
    const isSel = ui.selected.includes(w.id);
    // Por el id y no por una bandera: el recolector tiene `equipped` en su ficha
    // y además el id del motor; el compañero solo tiene la lista de activos. Las
    // dos formas están en `esEquipado()` del almacén, que es la que los cuenta.
    const equipped = equipado(w);
    return `
      <button class="inv-cell ${isSel ? 'is-selected' : ''} ${equipped ? 'opacity-60' : ''}"
              data-act="pick" data-id="${w.id}"
              title="${equipped ? 'Equipada: desequípala para usarla como material' : w.name}">
        <span class="ring-${raritySlug(w.rarity)} w-9 h-9 rounded-lg grid place-items-center
                     [&>span>svg]:w-4 [&>span>svg]:h-4 ${rarityClass(w.rarity)}">${ic(N.icono)}</span>
        <span class="text-[9px] font-mono text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full">
          ${w.name}
        </span>
        <span class="text-[9px] font-mono text-[var(--text-muted)]">
          T${w.tier} · ${estrellasDe(w.potential)}${equipped ? ' · EQ' : ''}
        </span>
      </button>`;
  };

  // --- Cuerpo -----------------------------------------------------------

  const body = `
    ${statStrip([
      { label: 'Esquirlas', value: formatNumber(state.shards), tone: 'text-cyan-300' },
      { label: N.muchos[0].toUpperCase() + N.muchos.slice(1), value: String(materiales.length) },
      { label: 'Forjadas', value: String(state.forgedCount) },
      { label: 'Piedras', value: String(stoneCount) }
    ])}

    <div class="flex gap-1.5 mb-3 p-1 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)]">
      ${(['collector', 'companion'] as const).map(t2 => `
        <button class="flex-1 h-10 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition
                       ${ui.tipo === t2 ? 'accent-bg text-slate-950' : 'btn-ghost text-[var(--text-muted)]'}"
                data-act="tipo" data-tipo="${t2}" aria-pressed="${ui.tipo === t2}">
          ${t2 === 'collector' ? 'Recolectores' : 'Compañeros'}
        </button>
      `).join('')}
    </div>
    <p class="text-[9px] text-[var(--text-muted)] mb-3 leading-relaxed">
      ${ui.tipo === 'collector'
        ? 'El recolector forjado hereda los afijos de la rareza de sus materiales.'
        : 'El compañero forjado hereda el potencial, y la nanopartícula se lo sube +1.'}
      Misma probabilidad, mismas piedras y mismo fallo en las dos.
    </p>

    <section class="card-glass rounded-2xl p-3 md:p-4 mb-3">
      ${sectionHead('Yunque de fusión', 'anvil', `
        <span class="text-[9px] font-mono text-[var(--text-muted)] hidden sm:inline">2 del mismo tier → 1 del siguiente</span>
      `)}

      <div class="forge-anvil">${Array.from({ length: MATERIALES_POR_FUSION }, (_, i) => slot(i)).join('')}</div>

      <div class="mt-3">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="label-caps">Probabilidad</span>
          <span class="font-['Orbitron'] font-bold text-sm tabular
                       ${!ready ? 'text-[var(--text-muted)]'
                          : chance >= 0.6 ? 'text-emerald-400'
                          : chance >= 0.42 ? 'text-amber-400'
                          : 'text-rose-400'}">
            ${ready ? `${Math.round(chance * 100)}%` : '—'}
          </span>
        </div>
        <div class="chance-bar">
          <span style="width:${(chance * 100).toFixed(1)}%;
                       background: linear-gradient(to right, var(--accent),
                         color-mix(in srgb, var(--accent) 50%, transparent))"></span>
        </div>
        ${ready ? `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            base T${matTier} ${Math.round(baseSuccessChance(matTier) * 100)}%
            ${info.craftLuck > 0 ? ` · árbol +${Math.round(info.craftLuck * 100)}%` : ''}
            ${ui.stones > 0 ? ` · piedras +${ui.stones * 12}%` : ''}
            ${ui.nano ? ' · nanopartícula +8%' : ''}
            · tope 95%
          </p>
        ` : `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5">
            Selecciona ${MATERIALES_POR_FUSION} ${N.muchos} del mismo tier.
          </p>
        `}
      </div>

      <div class="mt-3 pt-3 border-t border-[var(--border-color)]">
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="label-caps flex items-center gap-1.5">
            <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('flask')}</span>
            Piedras de calibración
          </span>
          <span class="text-[10px] font-mono text-[var(--text-muted)]">${stoneCount} en almacén</span>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          ${Array.from({ length: maxStones }).map((_, i) => `
            <button class="w-9 h-9 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition
                           ${i < ui.stones ? 'accent-bg text-slate-950 border-transparent' : 'btn-ghost text-[var(--text-muted)]'}"
                    data-act="stones" data-n="${i + 1}" aria-label="Usar ${i + 1}">${i + 1}</button>
          `).join('')}
          ${maxStones === 0
            ? `<span class="text-[10px] text-[var(--text-muted)] leading-relaxed">
                 No tienes piedras. Se venden en la tienda y salen de cajas Épicas y Legendarias.
               </span>`
            : `<button class="ml-1 px-2.5 h-9 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
                      data-act="stones" data-n="0">Quitar</button>`}
          ${ui.stones > 0 ? `<span class="ml-auto text-[10px] font-mono accent-text">+${ui.stones * 12}%</span>` : ''}
        </div>

        <!-- Nanopartícula: interruptor, porque solo se puede gastar una -->
        <div class="mt-2 pt-2 border-t border-[var(--border-color)] flex items-center gap-2.5">
          <button class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                  data-act="nano" ${nanoCount > 0 ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'}>
            <span class="w-5 h-5 rounded-md grid place-items-center flex-shrink-0 border transition
                         ${ui.nano ? 'accent-bg text-slate-950 border-transparent' : 'btn-ghost text-[var(--text-muted)]'}"
                  aria-hidden="true">
              <span class="[&>span>svg]:w-3 [&>span>svg]:h-3">${ic('check')}</span>
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-bold text-[var(--text-main)] leading-tight">
                Nanopartícula de Estabilidad
              </span>
              <span class="block text-[9px] font-mono text-[var(--text-muted)] leading-tight">
                ${nanoCount > 0
                  ? (ui.tipo === 'collector'
                    ? `${nanoCount} en almacén · +8% y un afijo garantizado`
                    : `${nanoCount} en almacén · +8% y +1 de potencial`)
                  : 'No tienes ninguna'}
              </span>
            </span>
          </button>
          ${ui.nano ? `<span class="text-[10px] font-mono accent-text flex-shrink-0">activa</span>` : ''}
        </div>
      </div>

      <button data-act="forge" ${ready ? '' : 'disabled'}
        class="w-full mt-3 rounded-xl font-['Orbitron'] font-bold text-[12px] tracking-wide cursor-pointer
               ${ready ? 'btn-primary' : 'btn-ghost opacity-40 cursor-not-allowed'}"
        style="min-height:52px">
        ${ready ? `FORJAR ${N.uno.toUpperCase()}` : `FALTAN ${MATERIALES_POR_FUSION - elegidos.length} MATERIALES`}
      </button>
      <p class="text-[9px] text-[var(--text-muted)] text-center mt-2 leading-relaxed">
        El nuevo sale con el potencial promedio de los dos.
        Los ${MATERIALES_POR_FUSION} se consumen, aciertes o falles.
      </p>
    </section>

    <section class="card-glass rounded-2xl p-3 md:p-4">
      ${sectionHead('Materiales', 'layers', `
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${ui.selected.length}/${MATERIALES_POR_FUSION}</span>
      `)}

      ${materiales.length === 0
        ? emptyState(N.icono, `No tienes ${N.muchos}`,
            'Compra ' + N.muchos + ' en la tienda o abre cajas. Necesitas ' + MATERIALES_POR_FUSION + ' del mismo tier para fusionar.')
        : `
          <div class="flex gap-1 mb-2.5 overflow-x-auto pb-1">
            ${tiers.map(t => `
              <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer flex-shrink-0 transition
                             ${t === ui.tier ? 'accent-bg text-slate-950' : 'btn-ghost text-[var(--text-muted)]'}"
                      data-act="tier" data-tier="${t}">
                T${t} · ${materiales.filter(w => w.tier === t).length}
              </button>
            `).join('')}
          </div>
          <div class="inv-grid">
            ${materiales.filter(w => w.tier === ui.tier).map(matCell).join('') ||
              `<p class="text-[11px] text-[var(--text-muted)] col-span-full">Sin ${N.muchos} en este tier.</p>`}
          </div>
        `}
    </section>
  `;

  const root = mountInto(container, pageShell({
    title: 'Forja',
    subtitle: 'Fusión, autoría y potencial',
    icon: 'anvil',
    onBack,
    state,
    actions: `
      <span class="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border border-[var(--border-color)]
                   text-[11px] font-mono text-cyan-300">
        ${ic('crystal', 'w-3.5 h-3.5')} ${formatNumber(state.shards)}
      </span>`
  }, body));

  wireNav(root, { back: onBack, go });
  wire(root, game, onBack, go);
}

/**
 * Conecta los manejadores de la Forja.
 *
 * `root` es el nodo que `mountInto` acaba de crear, y los listeners van ahí
 * (R5). El re-render, en cambio, necesita el CONTENEDOR, y son cosas distintas:
 * `mountInto` sustituye el `[data-page-root]` que es hijo del contenedor, así
 * que si se le pasa el nodo montado no encuentra ninguno y hace `appendChild`.
 *
 * Consecuencia, y era un bug visible: la Forja se anidaba dentro de sí misma y
 * cada vez que se marcaba una piedra o se lanzaba una fusión aparecía una copia
 * entera de la pantalla debajo. Además el redraw no repassaba `go`, así que a
 * partir del segundo render el botón de inicio y los `data-nav` dejaban de
 * responder y no había forma de salir de la página.
 *
 * El contenedor se recupera con `root.parentElement`, que es exactamente lo que
 * `mountInto` usó como padre. Es el mismo truco que usa `warehouse.ts`.
 */
function wire(root: HTMLElement, game: any, onBack: () => void, go?: (r: any) => void) {
  const container = root.parentElement as HTMLElement;
  const redraw = () => draw(container, game, onBack, go);

  // Estado derivado que los manejadores necesitan. Se recalcula aquí en vez de
  // capturarlo en `draw`, porque cuando llegan los eventos `draw` ya ha
  // terminado y sus variables locales están fuera de alcance.
  const context = () => {
    const lista = ((game.getState().warehouse as any[]) || []).filter(w => w.type === ui.tipo);
    const selected = ui.selected
      .map(id => lista.find(w => w.id === id))
      .filter(Boolean) as any[];
    return { lista, selected };
  };

  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.dataset.act;

    switch (act) {
      // **CAMBIAR DE TIPO VACÍA LA SELECCIÓN, Y NO ES COSMÉTICA.** Los ids de un
      // tipo no son de otro: al cambiar, el yunque se quedaría con huecos
      // invisibles y el jugador creería que ha perdido materiales que no tocó.
      case 'tipo': {
        sfx.nav();
        ui.tipo = btn.dataset.tipo as 'collector' | 'companion';
        ui.selected = [];
        ui.tier = 0;
        redraw();
        break;
      }
      case 'tier': {
        sfx.nav();
        ui.tier = Number(btn.dataset.tier);
        redraw();
        break;
      }
      case 'pick': {
        if (ui.selected.length >= MATERIALES_POR_FUSION) {
          showToast(`El yunque ya tiene ${MATERIALES_POR_FUSION} materiales. Quita uno primero.`, 'info');
          return;
        }
        // La regla del mismo tier se filtra AQUÍ y no solo en el game loop.
        // Si se dejara pasar, el jugador llenaría el yunque, vería la
        // probabilidad de un tier y, al forjar, recibiría un error: la pantalla
        // le habría mentido dos veces seguidas.
        const { lista, selected } = context();
        const picked = lista.find(w => w.id === btn.dataset.id);
        if (!picked) return;
        // F24 · Un id por material. Sin esto, tocar el mismo dos veces llena
        // el yunque con el mismo item en las dos casillas ("enseña 3 y metí
        // 1") y el motor lo aceptaba, regalando un material.
        if (selected.includes(picked.id)) {
          sfx.error();
          showToast(`Ese ${NOMBRES[ui.tipo].uno} ya está en el yunque. Toca su casilla para quitarlo.`, 'info');
          return;
        }
        if (selected.length && picked.tier !== selected[0].tier) {
          sfx.error();
          showToast(`Ya hay un T${selected[0].tier} en el yunque. La fusión exige ${MATERIALES_POR_FUSION} del mismo tier.`, 'info');
          return;
        }
        const st = game.getState();
        const estaEquipado = ui.tipo === 'collector'
          ? picked.id === st.equippedCollectorId
          : (st.activeCompanions || []).includes(picked.id);
        if (estaEquipado) {
          sfx.error();
          showToast(`Desequipa ese ${NOMBRES[ui.tipo].uno} antes de consumirlo como material.`, 'info');
          return;
        }
        sfx.pick();
        // El tope va AQUÍ y no solo en el saneado del redibujo. Antes no había
        // ninguno al añadir: se podían elegir tres, el botón se activaba, y el
        // motor rechazaba la fusión porque exige dos. El jugador veía un tercer
        // material que ni siquiera tenía hueco en el yunque.
        ui.selected = [...ui.selected, btn.dataset.id!].slice(0, MATERIALES_POR_FUSION);
        redraw();
        break;
      }
      case 'clear': {
        sfx.pick();
        ui.selected.splice(Number(btn.dataset.slot), 1);
        redraw();
        break;
      }
      case 'stones': {
        sfx.nav();
        const n = Number(btn.dataset.n);
        // Ajuste exacto en vez de alternar uno a uno: bajar de 5 a 2 con un
        // toggle sería cinco toques.
        ui.stones = n === 0 ? 0 : (ui.stones === n ? 0 : n);
        redraw();
        break;
      }
      case 'nano': {
        const count = ((game.getState().warehouse as any[]) || [])
          .filter(w => w.buffId === 'stabilityNano')
          .reduce((a, w) => a + (w.stackCount || 1), 0);
        if (count === 0) {
          sfx.error();
          showToast('No tienes Nanopartículas de Estabilidad.', 'info');
          return;
        }
        sfx.nav();
        ui.nano = !ui.nano;
        redraw();
        break;
      }
      case 'forge': {
        confirmForge(container, game, redraw);
        break;
      }
    }
  });
}

function confirmForge(container: HTMLElement, game: any, redraw: () => void) {
  const state = game.getState();
  const N = NOMBRES[ui.tipo];
  const lista = ((state.warehouse as any[]) || []).filter(w => w.type === ui.tipo);
  const sel = ui.selected
    .map(id => lista.find(w => w.id === id))
    .filter(Boolean) as any[];
  if (sel.length !== MATERIALES_POR_FUSION) {
    showToast(`Selecciona ${MATERIALES_POR_FUSION} ${N.muchos} del mismo tier.`, 'info');
    return;
  }

  const tier = sel[0].tier;
  const info = game.getForgeInfo();
  const affixLuck = ui.tipo === 'collector'
    ? sel.reduce((a, w) => a + (w.affixes?.length || 0) * 0.02, 0)
    : 0;
  const chance = successChance(tier, info.craftLuck, ui.stones, affixLuck, ui.nano ? 1 : 0);

  showConfirmModal(
    `${ui.tipo === 'collector' ? 'Dos recolectores' : 'Dos compañeros'} de tier ${tier} ` +
    `se funden en uno de tier ${tier + 1}. El potencial del nuevo es la media ` +
    `de los dos, y los dos se consumen.`,
    () => runForge(game, sel, ui.stones, ui.nano, redraw),
    {
      sublabel: `Probabilidad ${Math.round(chance * 100)}%`,
      confirmText: 'Forjar',
      danger: chance < 0.45
    }
  );
}

/**
 * Ejecuta la fusión y muestra la ruleta.
 *
 * El resultado ya está decidido cuando se llama a `game.forgeCollector`. La
 * animación solo lo enseña: si la ruleta eligiera el premio, el jugador
 * descubriría en veinte tiradas que la ruleta no es la fuente de verdad, y a
 * partir de ahí ninguna otra cifra del juego le creería.
 */
function runForge(game: any, materials: any[], stones: number, nano: boolean, redraw: () => void) {
  sfx.hammer();
  // **LA MISMA PAGINA LLAMA A UNO DE LOS DOS MOTORES, Y NO A UNO INTERMEDIO.**
  // Un `forge()` único que repartiera dentro sería una regla más que mantener;
  // dos funciones del motor que comparten la validación y la tirada es lo que
  // garantiza que no se separen.
  const ids = materials.map(m => m.id);
  const result = ui.tipo === 'companion'
    ? game.forgeCompanion(ids, stones, nano ? 1 : 0)
    : game.forgeCollector(ids, stones, nano ? 1 : 0);
  const hecho = result.collector || result.companion;

  showForgeRoulette(result, () => {
    if (result.success && hecho) {
      sfx.forgeSuccess();
      showToast(`${hecho.name} — ${NOMBRES[ui.tipo].verbo} por ti`, 'success');
      // La selección se vacía: los materiales ya se consumieron
      ui.selected = [];
    } else {
      sfx.forgeFail();
      showToast(result.msg ?? 'La fusión falló', 'error');
      ui.selected = [];
    }
    redraw();
  }, ui.tipo === 'companion');
}

/** Ruleta de la forja: 18 celdas, la 9ª alineada con la aguja. */
function showForgeRoulette(result: any, onDone: () => void, esCompanion: boolean) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[75] flex flex-col items-center justify-center p-6';
  overlay.style.cssText = 'background: rgb(0 0 0 / 0.8); backdrop-filter: blur(8px);';
  overlay.style.animation = 'riseIn 240ms ease both';

  const success = !!result.success;
  const w = result.collector || result.companion;
  const label = success ? (w?.name ?? 'Forja completada') : 'FALLO DE FORJA';
  const tone = success ? '#fbbf24' : '#f87171';

  const sub = success
    ? [
        `T${w.tier} · ${estrellasDe(w.potential)} · ${w.rarity}`,
        // **EL COMPAÑERO NO TIENE AFIJOS NI FIRMA.** Poner "Sin afijos" debajo de un
        // compañero sería una fila que no significa nada: no le faltan afijos,
        // es que no tiene ese atributo. En su lugar va su poder, que es lo que
        // realmente hereda de la media.
        esCompanion
          ? `Poder: +${w.power}/s`
          : ((w.affixes || []).length
            ? (w.affixes as string[]).map(id => AFFIX_BY_ID[id]?.name).filter(Boolean).join(' · ')
            : 'Sin afijos'),
        esCompanion ? 'Fusionado por ti' : `Forjada por: ${w.forgedBy ?? '-'}`
      ].join('<br>')
    : `+${result.shards ?? 0} esquirlas para el siguiente intento`;

  const CELLS = 18;
  const WIN = 9;
  const cells = Array.from({ length: CELLS }, (_, i) => {
    const isWin = i === WIN;
    return `
      <div class="w-14 h-14 rounded-xl grid place-items-center flex-shrink-0 border md:w-16 md:h-16
                  ${isWin ? (success ? 'border-amber-400 text-amber-300' : 'border-rose-500 text-rose-400')
                          : 'border-[var(--border-color)] text-[var(--text-muted)] opacity-35'}"
           style="${isWin ? 'box-shadow: 0 0 24px -6px currentColor' : ''}">
        <span class="[&>span>svg]:w-5 [&>span>svg]:h-5 md:[&>span>svg]:w-6 md:[&>span>svg]:h-6">
          ${ic(isWin ? (success ? 'sparkle' : 'close') : 'core')}
        </span>
      </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="w-full max-w-md flex flex-col gap-3">
      <div class="text-center label-caps" style="color:${tone}">
        ${success ? 'Forja completada' : 'El yunque se enfrió'}
      </div>
      <div class="forge-roulette">
        <div class="flex gap-1.5 pl-8" id="forge-track" style="will-change:transform">${cells}</div>
      </div>
      <div class="text-center flex flex-col gap-1">
        <div class="font-['Orbitron'] font-bold text-[15px]" style="color:${tone}">${label}</div>
        <div class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">${sub}</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const track = overlay.querySelector('#forge-track') as HTMLElement;
  const reel = overlay.querySelector('.forge-roulette') as HTMLElement;

  let ticks = 0;
  const maxTicks = 22;
  const tickTimer = window.setInterval(() => {
    ticks++;
    sfx.forgeTick(ticks / maxTicks);
    if (ticks >= maxTicks) window.clearInterval(tickTimer);
  }, 70);

  // Posicionamiento de la ruleta.
  //
  // El desplazamiento NO se mide: se calcula con valores del estilo calculado
  // (`getComputedStyle`), que no depende del layout ni de las transformaciones
  // y por tanto nunca devuelve un dato obsoleto. Medir con
  // `getBoundingClientRect` en la misma tarea en la que se acaba de insertar
  // el DOM daba posiciones viejas, y la celda objetivo acababa 500px
  // desviada, es decir fuera de la ventana de la ruleta.
  //
  //   travel = pista + WIN·(celda + hueco) + celda/2 - aguja
  //
  // La pista de despegue (una vuelta y media del ancho visible) va como margen
  // izquierdo de la cinta y NUNCA se suma al desplazamiento: sumarla haría que
  // la celda pasara de largo.
  //
  // `rAF` no se dispara en una pestaña oculta, así que hay dos disparos y una
  // pasada de corrección: si la celda no queda clavada en la aguja, se ajusta.
  const GAP = 6;      // gap-1.5 en Tailwind
  const BASE_PAD = 32; // pl-8
  let positioned = false;

  const place = () => {
    if (positioned) return;
    const cell = track.children[WIN] as HTMLElement | undefined;
    if (!cell) return;
    positioned = true;

    const cellW = parseFloat(getComputedStyle(cell).width) || 56;
    const needle = reel.clientWidth / 2;
    const runway = Math.round(reel.clientWidth * 1.5);
    track.style.paddingLeft = `${BASE_PAD + runway}px`;

    const travel = BASE_PAD + runway + WIN * (cellW + GAP) + cellW / 2 - needle;
    track.style.setProperty('--forge-travel', `${travel.toFixed(1)}px`);
    track.style.animation = 'forgeSpin 1.9s cubic-bezier(0.12, 0.85, 0.2, 1) both';
  };

  // Comprobación: mide dónde quedó la celda y corrige la diferencia
  const verify = () => {
    const cell = track.children[WIN] as HTMLElement | undefined;
    if (!cell) return;
    const cr = cell.getBoundingClientRect();
    const rr = reel.getBoundingClientRect();
    const needle = rr.left + reel.clientLeft + reel.clientWidth / 2;
    const delta = (cr.left + cr.width / 2) - needle;
    if (Math.abs(delta) < 1) return;
    const current = parseFloat(track.style.getPropertyValue('--forge-travel')) || 0;
    track.style.setProperty('--forge-travel', `${(current + delta).toFixed(1)}px`);
  };

  requestAnimationFrame(() => { place(); verify(); });
  window.setTimeout(() => { place(); verify(); }, 60);
  window.setTimeout(verify, 220);

  window.setTimeout(() => {
    window.clearInterval(tickTimer);
    onDone();
    overlay.style.transition = 'opacity 320ms ease';
    overlay.style.opacity = '0';
    window.setTimeout(() => overlay.remove(), 340);
  }, 2200);
}
