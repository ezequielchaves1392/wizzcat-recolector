// ==========================================================================
//  Ranking global
//
//  Cuatro tablas en pestañas: la compuesta y los tres criterios por separado.
//
//  Por qué cuatro y no una: la pregunta "¿quién es el mejor?" no tiene una
//  sola respuesta, y obligar al jugador a aceptar la del juego comunicaba que
//  su estilo no contaba. Un jugador que farmea a purposefully durante dos
//  horas tiene muchos clics y pocos logros; otro que ha desbloqueado todo
//  tiene muchos logros y pocos clics. Los dos están en la última posición de
//  alguna tabla y en la primera de otra.
//
//  El compuesto va PRIMERO y es la pestaña activa: es la que resume a las otras
//  tres, así que es la que responde al entrar.
//
//  Se piden los datos UNA vez y se ordenan las cuatro listas en cliente. Cuatro
//  consultas serían cuatro esperas de red para pintar cuatro listas de la misma
//  gente, y los cortes no coincidirían entre sí.
//
//  La carga es asíncrona con un esqueleto: antes la tabla se quedaba vacía
//  durante los 3 segundos del timeout sin decir nada, y en móvil eso se lee
//  como página rota.
// ==========================================================================

import { ic } from '../ui/icons';
import { pageShell, mountInto, wireNav, emptyState } from '../ui/pageShell';
import {
  getTopRankings, sortByBoard, boardValue,
  BOARDS, ACHIEVEMENT_WEIGHT, SECRET_ACHIEVEMENT_WEIGHT, FORGED_WEIGHT,
  type LeaderboardEntry, type BoardKind
} from '../services/rankingService';
import { formatNumber } from '../utils/format';
import { miniIdentity } from '../ui/identity';

/**
 * Pestaña activa.
 *
 * A nivel de módulo y no local a la función: si fuera local, cada cambio de
 * pestaña volvería a vale 'nanitas' al re-pintar, y la lista no cambiaría.
 */
let tableroActivo: BoardKind = 'definitivo';

export function renderRankings(
  container: HTMLElement,
  currentUser: any,
  onBack: () => void,
  go?: (r: any) => void
) {
  const meId = currentUser?.uid ?? currentUser?.userId;

  const root = mountInto(container, pageShell({
    title: 'Ranking global',
    subtitle: 'La tabla general y los tres criterios por separado',
    icon: 'trophy',
    onBack
  }, `
    <div class="flex flex-col gap-2" id="rank-body">
      ${skeleton()}
    </div>
  `));

  wireNav(root, { back: onBack, go });

  const body = root.querySelector('#rank-body')!;

  // La carga es asíncrona: si el jugador navega a otra página mientras tanto,
  // `body` ya no está en el documento. La comprobación de pertenencia evita
  // hacer el trabajo para nada.
  const stillMounted = () => body.isConnected;

  getTopRankings().then((rows) => {
    if (!stillMounted()) return;
    if (rows.length === 0) {
      body.innerHTML = emptyState('trophy', 'Ranking vacío', 'Todavía no hay nadie registrado. Sé la primera persona en aparecer.');
      return;
    }

    const pintar = () => {
      if (!stillMounted()) return;
      const def = BOARDS.find(b => b.id === tableroActivo)!;
      const lista = sortByBoard(rows, tableroActivo);

      body.innerHTML = `
        ${pestanas()}
        <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed px-1 mb-1">
          ${def.hint}
        </p>
        ${lista.map((r, i) => fila(r, i, meId, tableroActivo)).join('')}
        ${nota(tableroActivo)}
      `;
      cablearPestanas(body as HTMLElement, pintar);
    };

    pintar();
  }).catch(() => {
    if (!stillMounted()) return;
    body.innerHTML = emptyState('warning', 'No se pudo cargar', 'Firestore no responde. Revisa tu conexión y vuelve a entrar.');
  });
}

/** Las cuatro pestañas, con la activa marcada. */
function pestanas(): string {
  return `
    <div class="flex gap-1 mb-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Tablas del ranking">
      ${BOARDS.map(b => `
        <button data-rank-tab="${b.id}" role="tab" aria-selected="${b.id === tableroActivo}"
          class="h-9 px-3 rounded-lg text-[11px] font-mono flex-shrink-0 cursor-pointer
                 transition-colors ${b.id === tableroActivo ? 'accent-bg text-slate-950 font-bold' : 'btn-ghost text-[var(--text-muted)]'}"
        >
          <span class="inline-flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(b.icon as any)}</span>
            ${b.label}
          </span>
        </button>
      `).join('')}
    </div>
  `;
}

function cablearPestanas(body: HTMLElement, repintar: () => void) {
  body.querySelectorAll('[data-rank-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-rank-tab') === tableroActivo) return;
      tableroActivo = btn.getAttribute('data-rank-tab') as BoardKind;
      repintar();
    });
  });
}

function fila(r: LeaderboardEntry, i: number, meId?: string, kind: BoardKind = 'definitivo'): string {
  const isMe = r.uid === meId;
  // El marco y el banner viajan en el documento `rankings/{uid}` (planos) y,
  // por compatibilidad, dentro de `cosmetics`. Los planos mandan: son los que
  // escribe el guardado actual; `cosmetics` queda como lectura de reserva.
  const frameId = r.frame ?? r.cosmetics?.frame;
  const bannerId = r.banner ?? r.cosmetics?.banner;
  const valor = boardValue(r, kind);
  const unidades = unidadesDe(kind);

  return `
    <div class="rank-row ${isMe ? 'is-me' : ''}">
      <div class="rank-pos" data-tier="${i + 1 <= 3 ? i + 1 : ''}">${i + 1}</div>

      ${miniIdentity(r.username, { title: r.title, frame: frameId, banner: bannerId })}

      <div class="min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap mt-1">
          ${isMe ? `<span class="medal accent-text flex-shrink-0">TÚ</span>` : ''}
          ${r.achievements ? `<span class="medal text-amber-400">${ic('achievement', 'w-3 h-3')} ${r.achievements}</span>` : ''}
          ${r.secretAchievements ? `<span class="medal text-fuchsia-300" title="Logros secretos">${ic('lock', 'w-3 h-3')} ${r.secretAchievements}</span>` : ''}
          ${r.forgedCount ? `<span class="medal text-cyan-300" title="Recolectores forjados">${ic('anvil', 'w-3 h-3')} ${r.forgedCount}</span>` : ''}
        </div>
      </div>

      <div class="text-right flex-shrink-0">
        <div class="font-['Orbitron'] font-bold text-[13px] accent-text tabular">${formatNumber(valor)}</div>
        <div class="text-[9px] font-mono text-[var(--text-muted)]">${unidades}</div>
      </div>
    </div>
  `;
}

/** Qué se mide en la tabla activa, para ponerlo bajo el número. */
function unidadesDe(kind: BoardKind): string {
  switch (kind) {
    case 'nanitas': return 'nanitas';
    case 'clics': return 'clics';
    case 'logros': return 'puntos de logro';
    case 'definitivo': return '◆ puntos';
  }
}

/**
 * Explicación del peso de cada cosa.
 *
 * Solo en el Definitivo: es la única tabla donde la puntuación es compuesta, y
 * en las otras un jugador que ve "750.000" sin más no entiende qué son esos
 * números.
 */
function nota(kind: BoardKind): string {
  if (kind !== 'definitivo') return '';
  return `
    <p class="text-[9px] text-[var(--text-muted)] text-center mt-3 leading-relaxed px-2">
      En esta tabla, un logro público vale ${formatNumber(ACHIEVEMENT_WEIGHT)} puntos,
      uno secreto ${formatNumber(SECRET_ACHIEVEMENT_WEIGHT)} y cada recolector
      forjado ${formatNumber(FORGED_WEIGHT)}. Los pesos son una decisión de diseño:
      igualan la partida entre grindar y completar.
    </p>
  `;
}

/** Esqueleto de carga: 6 filas fantasma con el mismo ancho que las reales. */
function skeleton(): string {
  return Array.from({ length: 6 }).map((_, i) => `
    <div class="rank-row" style="opacity:${0.7 - i * 0.1}">
      <div class="rank-pos">·</div>
      <div class="w-8 h-8 rounded-full bg-[var(--border-color)]"></div>
      <div class="min-w-0">
        <div class="h-3 rounded bg-[var(--border-color)] w-2/3"></div>
        <div class="h-2 rounded bg-[var(--border-color)] w-1/3 mt-1.5"></div>
      </div>
      <div class="h-3 rounded bg-[var(--border-color)] w-12"></div>
    </div>
  `).join('');
}