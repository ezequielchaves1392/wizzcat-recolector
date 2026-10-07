// ==========================================================================
// Perfil · Identidad, cosméticos y logros
//
// Reúne tres cosas que antes estaban repartidas y nadie relacionaba:
//   - la tarjeta de identidad (título, marco, banner) que sale en el ranking
//   - los cosméticos que puedes equipar y cómo se consiguen
//   - el progreso de logros, incluidos los secretos con pista
//
// El avatar se monta con la pila de 3 capas (`.avatar-stack`): banner de
// fondo, marco y glifo. Así el marco puede tener animación propia sin que el
// contenido se mueva, y el mismo marcado sirve para el perfil y para el
// ranking sin duplicar la estructura.
// ==========================================================================

import { ic, icSafe } from './icons';
import { pageShell, mountInto, wireNav, statStrip, sectionHead } from './pageShell';
import { COSMETICS_BY_ID, COSMETICS_BY_TYPE, cosmeticStyle } from '../data/cosmetics';
import { titleStyleFor, avatarStack } from './identity';
import { SECRET_ACHIEVEMENTS } from '../data/achievements';
import { ACHIEVEMENTS } from '../achievements';
import { estrellasDe } from '../data/crafting';
import { formatNumber } from '../utils/format';
import { sfx } from '../utils/audio';
import { showToast } from '../utils/toast';
import { rarityClass, raritySlug, CRATE_META } from '../components/crateLoot';
import type { CrateType } from '../data/store';
import type { Cosmetic } from '../types/domain';

/**
 * Cómo se consigue un cosmético, en una frase.
 *
 * **EL LOGRO, CON SU NOMBRE, Y POR QUÉ ANTES NO LO TENÍA.** Decía "Se desbloquea con un
 * logro" para los cinco cosméticos que vienen de un logro, y eso no es una pista: es la
 * ausencia de pista. El jugador lee la carta, ve que no la tiene, ve que hay un logro
 * detrás, y no tiene ni idea de cuál —porque el perfil **sí** enseña la lista de logros
 * con su progreso, pero sin el nombre del logro no puede cruzarlos. Poner el nombre es
 * leer `ACHIEVEMENTS` por el id que el catálogo ya guardaba.
 *
 * **Y LOS SECRETOS SE QUEDAN OCULTOS, QUE ES LO ÚNICO QUE LOS HACE SECRETOS.** La
 * salida `secret` sigue diciendo su pista o "Condición oculta", y un logro que esté en
 * `SECRET_ACHIEVEMENTS` nunca se nombra aunque el catálogo lo traiga escrito: si el
 * cosmético se desbloquea con un secreto, decir el nombre del secreto lo cuenta.
 */
export function unlockHint(cos: Cosmetic): string {
  const u = cos.unlock;
  switch (u.kind) {
    case 'default': return 'Disponible desde el principio';
    case 'cores': return `Compra con ${u.value} núcleos en la Ascensión`;
    case 'achievement': {
      const nombre = nombreDeLogro(u.value as string);
      return nombre
        ? `Se desbloquea con «${nombre}»`
        : 'Se desbloquea con un logro';
    }
    case 'ranking': return u.value === 1 ? 'Solo para quien ocupe el 1er puesto'
      : u.value === 3 ? 'Solo para el Top 3 sostenido 7 días'
      : `Solo para el Top ${u.value} sostenido 7 días`;
    // Se nombra la caja concreta en vez de decir "una caja": el jugador tiene que
    // poder decidir cuál abrir. "Sale de una caja" le obligaba a probarlas todas.
    case 'crate': return `Sale de una ${CRATE_META[u.value as CrateType]?.name ?? 'caja'}`;
    case 'secret': return u.hint ?? 'Condición oculta';
    default: return 'No disponible';
  }
}

/**
 * El nombre de un logro por su id, o `null` si no existe o **si es secreto**.
 *
 * El filtro de secretos está aquí y no en quien llama, porque es la **única** forma de que
 * ningún camino lo salte: mañana se añade un cosmético desde un secreto y esta función
 * sigue sin decir el nombre. Un `SECRET_ACHIEVEMENTS.includes(...)` en la carta sería la
 * cuarta copia de la lista de secretos.
 */
function nombreDeLogro(id: string): string | null {
  if (SECRET_ACHIEVEMENTS.includes(id as any)) return null;
  return ACHIEVEMENTS.find((a: any) => a.id === id)?.title ?? null;
}

/** Tarjeta de identidad: avatar con marco + banner + título. */
export function identityCard(opts: {
  name: string;
  cosmetics: { title: string; frame: string; banner: string };
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}): string {
  const size = opts.size ?? 'md';
  const dims = size === 'lg' ? 'w-20 h-20' : size === 'sm' ? 'w-9 h-9' : 'w-14 h-14';
  const glyph = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-[13px]' : 'text-lg';
  const initials = (opts.name || '?').trim().slice(0, 2).toUpperCase();

  const title = COSMETICS_BY_ID[opts.cosmetics.title];

  const titleStyle = titleStyleFor(title);

  // **EL AVATAR LO PINTA `avatarStack()`, EL MISMO QUE LA CABECERA Y EL RANKING.**
  //
  // Aquí había una segunda copia del markup del avatar, y las dos copias ya se habían
  // separado. Con el icono, el banner y el emblema en un solo sitio, el perfil y el
  // ranking enseñan lo mismo por construcción y no por casualidad.
  //
  // **Y VA EN COLUMNA, NO EN FILA, PARA QUE EL TÍTULO NO MUEVA EL ICONO.** En fila, el
  // bloque se centraba como un todo: un título más largo ensanchaba el conjunto y el
  // avatar se desplazaba a la izquierda. El icono es la cara del jugador y no puede
  // bailar porque cambie el nombre del título; en columna, el avatar está siempre en el
  // mismo eje y el texto crece por debajo.
  return `
    <div class="flex flex-col items-center gap-2 min-w-0">
      ${avatarStack(initials, opts.cosmetics, dims, glyph)}
      <div class="min-w-0 max-w-full text-center">
        <div class="font-['Orbitron'] font-bold text-[13px] md:text-sm text-[var(--text-main)] truncate leading-tight">
          ${opts.name}
        </div>
        ${title ? `
          <div class="title-display text-[10px] truncate" style="${titleStyle}">${title.name}</div>
        ` : `<div class="label-caps">${opts.subtitle ?? 'Operativo'}</div>`}
      </div>
    </div>
  `;
}

/** Estado de la pantalla. Sobrevive a los re-render. */
const ui = {
  tab: 'title' as 'title' | 'frame' | 'banner',
  // Índice de página de cada lista larga, para no bajar en scroll infinito. La
  // página es 0-based; `PAGINA` dice cuántos caben.
  cosPage: 0,
  achPage: 0
};

/** Cuántos elementos se enseñan por página en las listas largas. */
const PAGINA = 10;

export function renderProfilePage(
  container: HTMLElement,
  game: any,
  onGoPrestige: () => void,
  go?: (r: any) => void
) {
  const state = game.getState();
  const achievements = game.getAchievements() as any[];
  const unlocked = achievements.filter(a => a.unlocked);
  const secrets = (state.unlockedAchievements as string[]).filter(id => SECRET_ACHIEVEMENTS.includes(id as any));

  // El nombre sale de la API del juego, no de `state`. Antes se leía
  // `state.__username`, un campo que no existe en ningún sitio: la expresión
  // siempre era falsa y la tarjeta de identidad mostraba "Operativo" —el texto
  // de reserva— aunque el nombre real estuviera resuelto y visible en la
  // cabecera. `getDisplayName` es exactamente el mismo valor que se envía al
  // ranking, así que nombre y tarjeta no pueden contradecirse.
  const displayName = game.getDisplayName?.() || state.displayName || 'Operativo';

  const collectors = (state.warehouse as any[]).filter(w => w.type === 'collector');
  const bestCollector = collectors.reduce((a: any, w: any) => (!a || (w.damage || 0) > (a.damage || 0) ? w : a), null as any);
  const bestForged = collectors
    .filter((w: any) => w.forgedBy)
    .reduce((a: any, w: any) => (!a || (w.damage || 0) > (a.damage || 0) ? w : a), null as any);

  const unlockedCosmetics = state.cosmetics.unlocked as string[];

  // **LAS INICIALES DE LA CARTA DE COSMÉTICOS, Y POR QUÉ SON LAS DEL JUGADOR.** La
  // miniatura de cada marco lleva un avatar detrás porque un marco es un borde alrededor de
  // algo: sin avatar, los marcos con relleno `padding-box` salen como discos sólidos y no
  // se distinguen. Con el avatar del propio jugador se ve **el marco como se va a ver**.
  const iniciales = (displayName || '?').trim().slice(0, 2).toUpperCase();

  // F15 · Cuántos de cada tipo, no un total mezclado. El encabezado decía
  // "12/34" sin distinguir título de marco, y con los secretos dentro de la
  // misma lista no se sabía qué era cada cosa. Sale de `COSMETICS_BY_TYPE`,
  // que ya está importado: la cuenta y el catálogo no pueden separarse.
  const cuentaTipo = (type: Cosmetic['type']) => {
    const todos = COSMETICS_BY_TYPE(type);
    const tienes = todos.filter(c => unlockedCosmetics.includes(c.id)).length;
    return `${tienes}/${todos.length}`;
  };
  const desgloseCosmeticos =
    `Títulos ${cuentaTipo('title')} · Marcos ${cuentaTipo('frame')} · Banners ${cuentaTipo('banner')}`;

  // La pestaña activa vive a nivel de módulo, no como variable local de esta
  // función. Antes estaba aquí, y cada re-render la reiniciaba a 'title': al
  // tocar "Marcos" se llamaba a `renderProfilePage`, que creaba un `tab` nuevo
  // con valor 'title', y la lista no cambiaba nunca. Es el mismo error que en la
  // Forja, y la misma solución: el estado de la interfaz va fuera de la función
  // que se vuelve a pintar.
  const tab = ui.tab;

  const cosCard = (cos: Cosmetic) => {
    const owned = unlockedCosmetics.includes(cos.id);
    const equipped =
      (tab === 'title' && state.cosmetics.title === cos.id) ||
      (tab === 'frame' && state.cosmetics.frame === cos.id) ||
      (tab === 'banner' && state.cosmetics.banner === cos.id);

    return `
      <button class="text-left card-glass border rounded-xl p-2.5 flex flex-col gap-1.5 cursor-pointer
                     transition active:scale-[0.97] ${equipped ? 'is-selected' : ''} ${owned ? '' : 'opacity-55'}"
              data-cos="${cos.id}"
              style="${equipped
                ? 'border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent)'
                : ''}">
        <div class="flex items-start justify-between gap-1.5">
          <span class="text-[11px] font-bold ${rarityClass(cos.rarity)} leading-tight">${cos.name}</span>
          ${equipped
            ? `<span class="accent-text flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('check')}</span>`
            : owned
              ? `<span class="text-emerald-400 flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('unlock')}</span>`
              : `<span class="text-[var(--text-muted)] opacity-60 flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('lock')}</span>`}
        </div>

        <div class="flex items-center gap-1.5 min-h-[28px]">
          ${tab === 'frame' ? `
            <!--
              EL MARCO SE ENSEÑA CON UN AVATAR DE VERDAD, NO CON UN CÍRCULO SUELTO.

              Antes era un span redondo con el estilo del cosmético, y eso es **la mitad
              de un marco**: un marco es un borde *alrededor de algo*, y un borde alrededor
              de la nada solo enseña el trazo. Peor aún, los marcos con relleno
              padding-box/border-box —Cascada y Cuántico— salían como **discos oscuros
              sólidos**, porque su relleno del padding-box ocupa todo el interior y no hay
              avatar que lo tape. Dos marcos que en el juego se ven opuestos se veían
              iguales en la carta.

              Con avatarStack() la carta pinta el componente real: es lo mismo que se
              vera en la cabecera y en el ranking, así que **lo que eliges aquí es lo que
              te vas a poner**. Y salen todos distintos sin tocar el catálogo.
            -->
            <span class="flex-shrink-0" aria-hidden="true">
              ${avatarStack(
                iniciales, { frame: cos.id },
                'w-9 h-9', 'text-[10px]'
              )}
            </span>` : tab === 'banner' ? `
            <span class="w-9 h-6 rounded-md flex-shrink-0" style="${cosmeticStyle(cos)}"></span>
          ` : `
            <!--
              LA MUESTRA SALE DE titleStyleFor, COMO LA CABECERA. Antes tenía
              su propia cuenta del degradado a mano, y las dos ya se habían
              separado: la carta enseñaba el color plano y la cabecera no enseñaba
              nada, porque el transparente solo lo ponía una. Lo que eliges aquí
              es lo que te pones.
            -->
            <span class="title-display text-[9px] truncate flex-1"
                  style="${titleStyleFor(cos)}">
              ${cos.name}
            </span>
          `}
        </div>

        <span class="text-[9px] text-[var(--text-muted)] leading-snug">${unlockHint(cos)}</span>
      </button>
    `;
  };

  /**
   * PAGINADOR DE LAS LISTAS LARGAS.
   *
   * El perfil tenía dos listas que crecen con el contenido —los cosméticos de cada
   * pestaña y los 27 logros— y las dos se pintaban enteras. Con trece marcos y veinte
   * y tantos logros la pantalla era un scroll larguísimo para llegar a la última
   * tarjeta, y el jugador no tenía forma de saber cuánto quedaba.
   *
   * Aquí se enseña de a `PAGINA` y se navega con flechas. La página vive en `ui` (como
   * la pestaña) porque sobrevive al re-render: sin eso, pulsar "siguiente" repintaba y
   * volvía a la página 0.
   */
  const paginador = (pagina: number, total: number, attr: string) => {
    const paginas = Math.max(1, Math.ceil(total / PAGINA));
    if (paginas <= 1) return '';
    const p = Math.min(Math.max(0, pagina), paginas - 1);
    const desde = p * PAGINA + 1;
    const hasta = Math.min(total, (p + 1) * PAGINA);
    const flecha = (destino: number, deshabilitado: boolean, icono: string, etiqueta: string, giro = '') => `
      <button class="w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer
                     ${deshabilitado ? 'opacity-40 pointer-events-none' : ''}"
              data-page="${attr}" data-page-to="${destino}" aria-label="${etiqueta}">
        <span class="${giro} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic(icono as any)}</span>
      </button>`;
    return `
      <div class="flex items-center justify-center gap-3 mb-3">
        ${flecha(p - 1, p === 0, 'back', 'Página anterior')}
        <span class="text-[10px] font-mono text-[var(--text-muted)] tabular">
          ${desde}–${hasta} de ${total} · pág. ${p + 1}/${paginas}
        </span>
        ${flecha(p + 1, p >= paginas - 1, 'back', 'Página siguiente', 'rotate-180')}
      </div>`;
  };

  const cosGrid = (type: 'title' | 'frame' | 'banner') => {
    const todos = COSMETICS_BY_TYPE(type);
    const paginas = Math.max(1, Math.ceil(todos.length / PAGINA));
    const p = Math.min(ui.cosPage, paginas - 1);
    const visibles = todos.slice(p * PAGINA, p * PAGINA + PAGINA);
    return `
      ${paginador(p, todos.length, 'cos')}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        ${visibles.map(cosCard).join('')}
      </div>
    `;
  };

  // --- Logros ---
  const achRow = (a: any) => {
    const isSecret = SECRET_ACHIEVEMENTS.includes(a.id);
    const pct = a.target > 0 ? Math.min(100, (a.current / a.target) * 100) : 0;
    return `
      <div class="rounded-xl border border-[var(--border-color)] p-2.5 flex items-center gap-2.5
                  ${a.unlocked ? '' : 'opacity-65'}"
           style="${a.unlocked ? 'background: color-mix(in srgb, var(--accent) 8%, transparent)' : ''}">
        <span class="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0
                     ${a.unlocked ? 'accent-bg text-slate-950' : 'btn-ghost text-[var(--text-muted)]'}"
              aria-hidden="true">${icSafe(isSecret && !a.unlocked ? 'lock' : a.icon)}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[11px] font-bold text-[var(--text-main)] truncate">
              ${isSecret && !a.unlocked ? '???' : a.title}
            </span>
            ${a.unlocked
              ? `<span class="text-[9px] font-mono text-emerald-400 flex-shrink-0">✓</span>`
              : `<span class="text-[9px] font-mono text-[var(--text-muted)] tabular flex-shrink-0">${formatNumber(a.current)}/${formatNumber(a.target)}</span>`}
          </div>
          <p class="text-[9px] text-[var(--text-muted)] leading-snug mt-0.5">
            ${isSecret && !a.unlocked ? (a.description || 'Logro oculto') : a.description}
          </p>
          ${!a.unlocked && a.target > 0 ? `<div class="meter mt-1.5"><span style="width:${pct}%"></span></div>` : ''}
          ${a.unlocked ? `<p class="text-[9px] font-mono mt-0.5" style="color:var(--accent)">${a.rewardText}</p>` : ''}
        </div>
      </div>
    `;
  };

  const body = `
    <!--
      LOS DOS SALDOS QUE ESTABAN AQUÍ, Y POR QUÉ NO.

      "Nanitas" y "Núcleos" salían en la franja y salen también en la cabecera, con el
      mismo número. El perfil es donde más se nota: es la pantalla que se abre para
      mirar cómo va la partida, y tener el saldo en la franja y en la cabecera a la vez
      convierte una mirada en una comprobación de cuál de los dos está al día.

      Lo que queda no es saldo y no está en ningún otro sitio: cuántos logros hay y
      cuántas piezas se han forjado.
    -->
    ${statStrip([
      { label: 'Logros', value: `${unlocked.length}/${achievements.length}`, tone: 'text-amber-300' },
      { label: 'Forjadas', value: String(state.forgedCount) }
    ])}

    <!-- Mejor recolector: el objeto del que presume el jugador -->
    ${bestCollector ? `
      <section class="card-glass rounded-2xl p-3 mb-3">
        <div class="label-caps mb-2 flex items-center gap-1.5">
          <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('collector')}</span>
          ${bestForged ? 'Mejor recolector forjado' : 'Mejor recolector'}
        </div>
        <div class="flex items-center gap-2.5">
          <span class="ring-${raritySlug(bestCollector.rarity)} w-10 h-10 rounded-xl grid place-items-center flex-shrink-0
                       ${rarityClass(bestCollector.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('collector')}</span>
          <div class="min-w-0 flex-1">
            <div class="text-[12px] font-bold text-[var(--text-main)] truncate">${bestCollector.name}</div>
            <div class="text-[9px] font-mono text-[var(--text-muted)]">
              T${bestCollector.tier} · ${bestCollector.rarity} · ${estrellasDe(bestCollector.potential)}
              ${bestCollector.forgedBy ? ` · de <span class="accent-text">${bestCollector.forgedBy}</span>` : ''}
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="label-caps leading-none">Daño</div>
            <div class="font-['Orbitron'] font-bold text-[13px] accent-text tabular">+${formatNumber(bestCollector.damage)}</div>
          </div>
        </div>
      </section>
    ` : ''}

    <!-- Tarjeta de identidad -->
    <section class="card-glass rounded-2xl overflow-hidden mb-3">
      <div class="cosmetic-banner" style="${cosmeticStyle(COSMETICS_BY_ID[state.cosmetics.banner])}">
        <div class="p-4 md:p-5 flex flex-col items-center text-center gap-2"
             style="background: color-mix(in srgb, var(--bg-app) 72%, transparent)">
          ${identityCard({ name: displayName, cosmetics: state.cosmetics, size: 'lg' })}
          <div class="flex items-center gap-2 flex-wrap justify-center mt-1">
            <span class="medal text-[var(--text-muted)]">${ic('core', 'w-3 h-3')} ${state.resets} ascensiones</span>
            <span class="medal text-[var(--text-muted)]">${ic('anvil', 'w-3 h-3')} ${state.forgedCount} recolectores</span>
            <span class="medal text-amber-400">${ic('sparkle', 'w-3 h-3')} ${secrets.length} secretos</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Acceso a la ascensión -->
    <button data-go-prestige
      class="w-full card-glass border rounded-2xl p-3.5 mb-3 flex items-center gap-3 cursor-pointer
             transition active:scale-[0.99] hover:border-[var(--accent)]"
      style="border-color: color-mix(in srgb, var(--accent) 40%, transparent)">
      <span class="accent-text flex-shrink-0 [&>span>svg]:w-6 [&>span>svg]:h-6">${ic('recycle')}</span>
      <div class="min-w-0 flex-1 text-left">
        <div class="text-[12px] font-bold text-[var(--text-main)]">Ascensión y árbol de pasivas</div>
        <div class="text-[10px] text-[var(--text-muted)] font-mono">
          ${formatNumber(state.cores)} núcleos disponibles
        </div>
      </div>
      <span class="text-[var(--text-muted)] flex-shrink-0 rotate-180 [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('back')}</span>
    </button>

    <!-- Cosméticos -->
    <section class="card-glass rounded-2xl p-3 md:p-4 mb-3">
      ${sectionHead('Cosméticos', 'crown', `
        <span class="text-[10px] font-mono text-[var(--text-muted)] text-right leading-snug">${desgloseCosmeticos}</span>
      `)}

      <div class="flex gap-1 mb-3">
        ${([
          { id: 'title', label: 'Títulos', icon: 'medal' },
          { id: 'frame', label: 'Marcos', icon: 'sparkle' },
          { id: 'banner', label: 'Banners', icon: 'layers' }
        ] as const).map(t => `
          <button class="flex-1 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition flex items-center
                         justify-center gap-1.5
                         ${tab === t.id ? 'accent-bg text-slate-950' : 'btn-ghost text-[var(--text-muted)]'}"
                  data-cos-tab="${t.id}">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(t.icon as any)}</span>
            ${t.label}
          </button>
        `).join('')}
      </div>

      <div id="cos-panel">${cosGrid(tab)}</div>
    </section>

    <!-- Logros -->
    <section class="card-glass rounded-2xl p-3 md:p-4">
      ${sectionHead('Logros', 'achievement', `
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${unlocked.length}/${achievements.length}</span>
      `)}
      ${paginador(Math.min(ui.achPage, Math.max(0, Math.ceil(achievements.length / PAGINA) - 1)), achievements.length, 'ach')}
      <div class="flex flex-col gap-2">
        ${(() => {
          const paginas = Math.max(1, Math.ceil(achievements.length / PAGINA));
          const p = Math.min(ui.achPage, paginas - 1);
          return achievements.slice(p * PAGINA, p * PAGINA + PAGINA).map(achRow).join('');
        })()}
      </div>
      ${secrets.length > 0 ? `
        <p class="text-[9px] text-[var(--text-muted)] mt-3 text-center leading-relaxed">
          Hay ${secrets.length} logro(s) secreto(s) desbloqueado(s). Nadie más puede ver cuáles.
        </p>
      ` : ''}
    </section>

  `;

  const root = mountInto(container, pageShell({
    title: 'Perfil',
    icon: 'user',
    route: 'perfil',
    state,
    // La píldora de nanitas de la cabecera se retiraba: el perfil ya trae su
  }, body));

  // --- Eventos ---
  wireNav(root, { go });
  root.querySelector('[data-go-prestige]')?.addEventListener('click', onGoPrestige);
  root.querySelectorAll<HTMLElement>('[data-cos-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.cosTab === ui.tab) return;
      sfx.nav();
      ui.tab = btn.dataset.cosTab as 'title' | 'frame' | 'banner';
      // Cambiar de pestaña vuelve a la primera página: cada tipo tiene su propio
      // total, y quedarse en la página 3 de los títulos al pasar a banners, que
      // puede tener menos, dejaría la lista vacía.
      ui.cosPage = 0;
      renderProfilePage(container, game, onGoPrestige, go);
    });
  });

  // La paginación de las dos listas. `data-page` dice cuál y `data-page-to` a qué
  // página. Se repinta solo la página; el resto del perfil no se toca.
  root.querySelectorAll<HTMLElement>('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.pick();
      const destino = Math.max(0, Number(btn.dataset.pageTo) || 0);
      if (btn.dataset.page === 'cos') ui.cosPage = destino;
      else ui.achPage = destino;
      renderProfilePage(container, game, onGoPrestige, go);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cos]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cosId = btn.dataset.cos!;
      if (!unlockedCosmetics.includes(cosId)) {
        sfx.error();
        const cos = COSMETICS_BY_ID[cosId];
        showToast(`${cos?.name}: ${unlockHint(cos!)}`, 'info');
        return;
      }
      sfx.equip();
      game.equipCosmetic(tab, cosId);
      renderProfilePage(container, game, onGoPrestige, go);
    });
  });
}
