// ==========================================================================
// Ranking global
//
// Tres cambios frente a la versión anterior:
//   1. Las columnas de logros, secretos y firmas de autor. Antes la tabla solo
//      tenía nanitas, y conseguir un logro no cambiaba nada visible: el
//      jugador no tenía forma de saber que le compensaba.
//   2. La puntuación es la de `computeScore`, no las nanitas crudas. La
//      tabla se ordena en cliente porque Firestore solo conoce `score`.
//   3. La identidad (título + marco) sale del propio ranking, así que alguien
//      con el título "Leyenda de la Forja" se ve como tal en la lista.
//
// La carga es asíncrona con un esqueleto de carga: antes la tabla se quedaba
// vacía durante los 3 segundos del timeout sin decir nada, y en móvil eso se
// lee como página rota.
// ==========================================================================

import { ic } from '../ui/icons';
import { pageShell, mountInto, emptyState } from '../ui/pageShell';
import { getTopRankings, type LeaderboardEntry } from '../services/rankingService';
import { formatNumber } from '../utils/format';
import { COSMETICS_BY_ID } from '../data/cosmetics';
import { rarityClass } from './crateLoot';

export function renderRankings(
  container: HTMLElement,
  currentUser: any,
  onBack: () => void
) {
  const meId = currentUser?.uid ?? currentUser?.userId;

  const root = mountInto(container, pageShell({
    title: 'Ranking global',
    subtitle: 'Puntuación = nanitas + logros + firmas',
    icon: 'trophy',
    onBack
  }, `
    <div class="flex flex-col gap-2" id="rank-body">
      ${skeleton()}
    </div>
  `));

  root.querySelector('[data-nav-back]')?.addEventListener('click', onBack);

  const body = root.querySelector('#rank-body')!;

  // La carga es asíncrona: si el jugador navega a otra página mientras tanto,
  // `body` ya no está en el documento y escribir en él no rompería nada, pero
  // el trabajo se hace igual. La comprobación de pertenencia lo evita.
  const stillMounted = () => body.isConnected;

  getTopRankings().then((rows) => {
    if (!stillMounted()) return;
    if (rows.length === 0) {
      body.innerHTML = emptyState('trophy', 'Ranking vacío', 'Todavía no hay nadie registrado. Sé la primera persona en aparecer.');
      return;
    }
    body.innerHTML = `
      ${rows.map((r, i) => row(r, i, meId)).join('')}
      <p class="text-[9px] text-[var(--text-muted)] text-center mt-3 leading-relaxed px-2">
        Un logro público vale ${formatNumber(50_000)} puntos, uno secreto
        ${formatNumber(250_000)} y cada arma que has forjado ${formatNumber(20_000)}.
      </p>
    `;
  }).catch(() => {
    if (!stillMounted()) return;
    body.innerHTML = emptyState('warning', 'No se pudo cargar', 'Firestore no responde. Revisa tu conexión y vuelve a entrar.');
  });
}

function row(r: LeaderboardEntry, i: number, meId?: string): string {
  const isMe = r.uid === meId;
  const title = r.title ? COSMETICS_BY_ID[r.title] : null;
  const medals = r.secretAchievements || 0;

  return `
    <div class="rank-row ${isMe ? 'is-me' : ''}">
      <div class="rank-pos" data-tier="${i + 1 <= 3 ? i + 1 : ''}">${i + 1}</div>

      <div class="min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[12px] font-bold text-[var(--text-main)] truncate">
            ${r.username}
          </span>
          ${isMe ? `<span class="medal accent-text flex-shrink-0">TÚ</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 flex-wrap mt-1">
          ${title ? `<span class="text-[9px] title-display ${rarityClass(title.rarity)}">${title.name}</span>` : ''}
          ${r.achievements ? `
            <span class="medal text-amber-400">${ic('achievement', 'w-3 h-3')} ${r.achievements}</span>
          ` : ''}
          ${medals ? `
            <span class="medal text-fuchsia-300" title="Logros secretos">${ic('lock', 'w-3 h-3')} ${medals}</span>
          ` : ''}
          ${r.forgedCount ? `
            <span class="medal text-cyan-300" title="Armas forjadas">${ic('anvil', 'w-3 h-3')} ${r.forgedCount}</span>
          ` : ''}
        </div>
      </div>

      <div class="text-right flex-shrink-0">
        <div class="font-['Orbitron'] font-bold text-[13px] accent-text tabular">${formatNumber(r.score)}</div>
        <div class="text-[9px] font-mono text-[var(--text-muted)]">${formatNumber(r.nanites ?? 0)} ◆</div>
      </div>
    </div>
  `;
}

/** Esqueleto de carga: 6 filas fantasma con el mismo ancho que las reales. */
function skeleton(): string {
  return Array.from({ length: 6 }).map((_, i) => `
    <div class="rank-row" style="opacity:${0.7 - i * 0.1}">
      <div class="rank-pos">·</div>
      <div class="min-w-0">
        <div class="h-3 rounded bg-[var(--border-color)] w-2/3"></div>
        <div class="h-2 rounded bg-[var(--border-color)] w-1/3 mt-1.5"></div>
      </div>
      <div class="h-3 rounded bg-[var(--border-color)] w-12"></div>
    </div>
  `).join('');
}
