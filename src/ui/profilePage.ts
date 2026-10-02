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
import { titleStyleFor } from './identity';
import { getSkipRoulette, setSkipRoulette } from '../roulettePrefs';
import { SECRET_ACHIEVEMENTS } from '../data/achievements';
import { formatNumber } from '../utils/format';
import { sfx } from '../utils/audio';
import { showToast } from '../utils/toast';
import { rarityClass, raritySlug, CRATE_META } from '../components/crateLoot';
import type { CrateType } from '../data/store';
import type { Cosmetic } from '../types/domain';

/** Cómo se consigue un cosmético, en una frase. */
function unlockHint(cos: Cosmetic): string {
  const u = cos.unlock;
  switch (u.kind) {
    case 'default': return 'Disponible desde el principio';
    case 'cores': return `Compra con ${u.value} núcleos en la Ascensión`;
    case 'achievement': return 'Se desbloquea con un logro';
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
  const frame = COSMETICS_BY_ID[opts.cosmetics.frame];
  const banner = COSMETICS_BY_ID[opts.cosmetics.banner];

  const titleStyle = titleStyleFor(title);

  return `
    <div class="flex items-center gap-3 min-w-0">
      <div class="avatar-stack ${dims} flex-shrink-0">
        <span class="avatar-frame w-full h-full rounded-full ${banner?.id && banner.id !== 'banner_none'
          ? '' : 'opacity-0'}"
              style="${banner && banner.id !== 'banner_none' ? `transform:scale(1.9);opacity:.5;${cosmeticStyle(banner)}` : ''}"></span>
        <span class="avatar-core w-[78%] h-[78%] ${glyph}">${initials}</span>
        <span class="avatar-frame w-full h-full rounded-full"
              style="${frame ? cosmeticStyle(frame) : ''}"></span>
      </div>
      <div class="min-w-0 flex-1">
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
const ui = { tab: 'title' as 'title' | 'frame' | 'banner' };

export function renderProfilePage(
  container: HTMLElement,
  game: any,
  onBack: () => void,
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
            <span class="w-7 h-7 rounded-full flex-shrink-0" style="${cosmeticStyle(cos)}"></span>
          ` : tab === 'banner' ? `
            <span class="w-9 h-6 rounded-md flex-shrink-0" style="${cosmeticStyle(cos)}"></span>
          ` : `
            <span class="title-display text-[9px] truncate flex-1"
                  style="${cosmeticStyle(cos)}${cos.style.gradient ? ';background-clip:text;-webkit-background-clip:text' : ''}">
              ${cos.name}
            </span>
          `}
        </div>

        <span class="text-[9px] text-[var(--text-muted)] leading-snug">${unlockHint(cos)}</span>
      </button>
    `;
  };

  const cosGrid = (type: 'title' | 'frame' | 'banner') => `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      ${COSMETICS_BY_TYPE(type).map(cosCard).join('')}
    </div>
  `;

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
    ${statStrip([
      { label: 'Nanitas', value: formatNumber(state.nanites), glyph: '◆', valueId: 'profile-nanites' },
      { label: 'Logros', value: `${unlocked.length}/${achievements.length}`, tone: 'text-amber-300' },
      { label: 'Núcleos', value: formatNumber(state.cores), tone: 'text-purple-300' },
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
              T${bestCollector.tier} · ${bestCollector.rarity}${bestCollector.potential ? ` · ${'★'.repeat(bestCollector.potential)}` : ''}
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
      <div class="flex flex-col gap-2">
        ${achievements.map(achRow).join('')}
      </div>
      ${secrets.length > 0 ? `
        <p class="text-[9px] text-[var(--text-muted)] mt-3 text-center leading-relaxed">
          Hay ${secrets.length} logro(s) secreto(s) desbloqueado(s). Nadie más puede ver cuáles.
        </p>
      ` : ''}
    </section>

    <!-- Ajustes: vive aquí y no dentro de la ruleta, porque un control dentro
         de algo que se puede saltar no se alcanza nunca. Y en el Perfil y no
         en el panel de tema, porque ese panel es solo móvil: el
         check tiene que existir en las dos versiones. -->
    <section class="card-glass rounded-2xl p-3 md:p-4 mt-3">
      ${sectionHead('Ajustes', 'gear', '')}
      <label class="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
        <input type="checkbox" data-setting="skip-roulette" class="w-5 h-5 flex-shrink-0 accent-[var(--accent)]"
               ${getSkipRoulette() ? 'checked' : ''}
               aria-describedby="skip-roulette-hint">
        <span class="min-w-0">
          <span class="block text-[12px] font-bold text-[var(--text-main)]">Saltar la animación de la ruleta</span>
          <span id="skip-roulette-hint" class="block text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Va directo al cartel del premio, en cajas y sintonizador. El premio no cambia: ya estaba decidido.
          </span>
        </span>
      </label>
    </section>
  `;

  const root = mountInto(container, pageShell({
    title: 'Perfil',
    subtitle: 'Identidad, cosméticos y logros',
    icon: 'user',
    onBack,
    state,
    // La píldora de nanitas de la cabecera se retiraba: el perfil ya trae su
    // propia cifra en la franja de estadísticas, con el mismo rombo delante de
    // la etiqueta, y tener las dos era leer el mismo saldo dos veces. El valor
    // sigue vivo porque la franja lleva `valueId` y `updateUI` la refresca.
    hideNanites: true
  }, body));

  // --- Eventos ---
  wireNav(root, { back: onBack, go });
  root.querySelector('[data-go-prestige]')?.addEventListener('click', onGoPrestige);
  // El check es un `input` real: su estado lo lleva el propio navegador y la
  // preferencia vive en `localStorage`, así que no hay que re-pintar nada al
  // cambiarlo. Se lee de la misma fuente al montar, y por eso sobrevive al
  // re-render igual que sobrevive a la recarga.
  root.querySelector<HTMLInputElement>('[data-setting="skip-roulette"]')?.addEventListener('change', (e) => {
    sfx.nav();
    setSkipRoulette((e.target as HTMLInputElement).checked);
  });

  root.querySelectorAll<HTMLElement>('[data-cos-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.nav();
      ui.tab = btn.dataset.cosTab as 'title' | 'frame' | 'banner';
      renderProfilePage(container, game, onBack, onGoPrestige, go);
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
      renderProfilePage(container, game, onBack, onGoPrestige, go);
    });
  });
}
