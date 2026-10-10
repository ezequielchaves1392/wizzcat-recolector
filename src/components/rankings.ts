// ==========================================================================
//  Ranking global
//
//  Cinco tablas en pestañas: la compuesta y los cuatro criterios por separado.
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
  BOARDS,
  type LeaderboardEntry, type BoardKind
} from '../services/rankingService';
import { formatNumber } from '../utils/format';
import { miniIdentity, rellenoDeBanner } from '../ui/identity';
import { COSMETICS_BY_ID } from '../data/cosmetics';
import { abreTarjetaDe } from '../ui/tarjetaAjena';
import type { DatosDeRanking } from '../data/perfilParcial';
import { esc } from '../utils/esc';

/**
 * Pestaña activa.
 *
 * A nivel de módulo y no local a la función: si fuera local, cada cambio de
 * pestaña volvería a vale 'nanitas' al re-pintar, y la lista no cambiaría.
 */
let tableroActivo: BoardKind = 'definitivo';

/**
 * El nombre de cada fila pintada, por uid.
 *
 * **POR QUÉ UN MAPA Y NO UN ATRIBUTO.** El `data-ver` lleva el uid, que viene de
 * Firestore y no tiene nada que escapar. El nombre sí lo tiene —lo escribe un jugador—,
 * y meterlo en un atributo significa meter texto de otro dentro del HTML dos veces, con
 * dos `esc()` distintos que se pueden olvidar el uno del otro. Con el mapa, el texto del
 * otro solo pasa por el `esc()` del markup, una vez.
 *
 * Y se vacía en cada pintado, porque si no cambiar de pestaña dejaría dentro nombres de
 * filas que ya no están y el mapa crecería sin que nada lo limpiese.
 */
const nombreDeFila = new Map<string, string>();

/**
 * Lo que el ranking sabe de cada fila, por uid, para la ficha de perfil.
 *
 * **ES OTRO MAPA Y NO UN `data-` PORQUE EL DATO ES UN NÚMERO, Y LOS NÚMEROS EN ATRIBUTOS
 * SON CADENAS.** `score` arrives a `getAttribute` como texto y hay que volver a
 * convertirlo, con el riesgo de que se convierta mal. Además, el mapa se rellena
 * mientras se pinta la fila, que es el mismo sitio donde ya se guarda el nombre.
 */
const datosDeFila = new Map<string, DatosDeRanking>();


export function renderRankings(
  container: HTMLElement,
  currentUser: any,
  go?: (r: any) => void,
  /**
   * El estado de la partida, para la franja de recursos de la cabecera.
   *
   * **POR QUÉ ENTRA COMO ARGUMENTO Y NO SE SACA DE `currentUser`.** Porque
   * `currentUser` es el usuario de autenticación, y ese objeto no lleva la partida: no
   * tiene `getState()` ni `state`, y no los tendrá. Cuando se añadió la franja se
   * intentó deducirlo de ahí y el resultado fue una cabecera sin saldos en la única
   * pantalla donde se nota más, porque es la única que se abre para mirar y no para
   * gastar.
   */
  state?: any,
  /**
   * El juego vivo, para la fila propia (B38). La fila propia no pinta la foto
   * del documento sino el daño recalculado en el momento con `getStatFilas()`:
   * es la misma cadena de la ficha, cuesta cero lecturas y nunca llega vieja.
   * Las demás filas siguen siendo fotos —recalcular cuarenta tarjetas ajenas
   * costaría cuarenta lecturas por vista—. Sin juego no hay recálculo y la
   * fila sale como viene (previews y bancos).
   */
  game?: any
) {
  const meId = currentUser?.uid ?? currentUser?.userId;

  const root = mountInto(container, pageShell({
    title: 'Ranking global',
    icon: 'trophy',
    route: 'ranking',
    // EL ESTADO, QUE ANTES NO PASABA, Y POR QUÉ ESTA PÁGINA ERA LA EXCEPCIÓN.
    //
    // La única de las seis que no lo pasaba, y por eso era la única con la cabecera a
    // medias: medido, **0 de 3 saldos** aquí contra 3 de 3 en las otras cinco.
    state
  }, `
    <div class="flex flex-col gap-2" id="rank-body">
      ${skeleton()}
    </div>
  `));

  wireNav(root, { go });

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

      // **EL MAPA DE NOMBRES SE VACÍA EN CADA PINTADO, Y POR AQUÍ.** Es lo único que
      // garantiza que no guarda los nombres de las filas que ya no están en pantalla: la
      // lista cambia al cambiar de pestaña, y un mapa que solo crece sería memoria que
      // nadie limpia y nombres que el manejador puede usar para una fila que no existe.
      // Se vacía DESPUÉS de decidir la lista y ANTES de pintar, porque es `fila()` quien
      // lo rellena.
      nombreDeFila.clear();
      datosDeFila.clear();

      body.innerHTML = `
        ${pestanas()}
        <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed px-1 mb-1">
          ${def.hint}
        </p>
        ${lista.map((r, i) => fila(r.uid === meId ? filaPropiaViva(r, game, state) : r, i, meId, tableroActivo)).join('')}
        ${nota(tableroActivo)}
      `;
      // Las filas se cablean **una vez por carga**, no en cada pintado: el manejador busca
      // el `data-ver` más cercano en cada clic, así que sobrevive a que le cambien el
      // `innerHTML` por debajo. Si se cableara en cada `pintar()`, cada cambio de pestaña
      // dejaría un manejador más encima del mismo `body`, y un clic abriría la tarjeta
      // tantas veces como veces se ha cambiado de pestaña.
      cablearPestanas(body as HTMLElement, pintar);
      cablearFilas(body as HTMLElement);
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

/**
 * TOCAR UNA FILA ABRE LA TARJETA DE ESE JUGADOR.
 *
 * **LA DELEGACIÓN VA EN `body`, QUE ES DONDE VIVEN LAS FILAS, Y NO EN `#app`** (R5):
 * `renderRoute()` hace `app.onclick = null` en cada cambio de ruta, así que un
 * manejador en `#app` se perdería; y uno puesto por fila serían cuarenta manejadores que
 * se acumulan en cada repintado. Un solo manejador que busca el `data-ver` más cercano
 * resuelve las dos cosas.
 *
 * **TU PROPIA FILA TAMBIÉN SE ABRE, Y ES LA MISMA TARJETA.** No lleva atajo a tu pantalla
 * de perfil porque esa ya la tienes abierta, y abrir una hoja encima para enseñarte lo
 * mismo sería un rodeo. Abrirla no cuenta nada (F104): el contador de visitas se quitó
 * y mirar es gratis.
 */
function cablearFilas(body: HTMLElement): void {
  body.addEventListener('click', (e) => {
    const fila = (e.target as HTMLElement).closest('[data-ver]');
    if (!fila) return;
    const uid = fila.getAttribute('data-ver');
    if (!uid) return;
    abreTarjetaDe(uid, nombreDeFila.get(uid) ?? 'Operativo', undefined, datosDeFila.get(uid));
  });
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

/**
 * La fila propia con el daño recalculado en el momento (B38).
 *
 * La foto del documento llega con hasta minutos de retraso (ritmo de
 * publicación + caché de lectura) y la ficha de al lado es en vivo: comparar
 * las dos era comparar dos momentos distintos. Para la fila propia no hace
 * falta la foto —el juego está aquí— así que se recalcula con
 * `getStatFilas()` sobre el arma equipada, que es la misma cadena de la
 * ficha y cuesta cero lecturas. Sin juego, sin equipado o sin número, la fila
 * sale como viene: un recálculo que no puede fallar no existe, y lo que no se
 * puede calcular no se inventa (R4).
 */
export function filaPropiaViva(
  r: LeaderboardEntry, game: any, state: any
): LeaderboardEntry {
  try {
    const eqId = state?.equippedCollectorId;
    const f = eqId && typeof game?.getStatFilas === 'function'
      ? game.getStatFilas(eqId)
      : null;
    if (!f || typeof f.total !== 'number' || typeof f.delArma !== 'number') return r;
    return { ...r, danoFinal: f.total, danoArma: f.delArma };
  } catch {
    return r;
  }
}

function fila(r: LeaderboardEntry, i: number, meId?: string, kind: BoardKind = 'definitivo'): string {
  const isMe = r.uid === meId;
  // El nombre queda apuntado para el manejador del clic. Solo si hay uid: una fila sin
  // uid es un dato roto y no hay a quién abrirle la tarjeta.
  if (r.uid) nombreDeFila.set(r.uid, r.username ?? 'Operativo');
  // El marco y el banner viajan en el documento `rankings/{uid}` (planos) y,
  // por compatibilidad, dentro de `cosmetics`. Los planos mandan: son los que
  // escribe el guardado actual; `cosmetics` queda como lectura de reserva.
  const frameId = r.frame ?? r.cosmetics?.frame;
  const bannerId = r.banner ?? r.cosmetics?.banner;

  // El resto de lo que la fila ya sabe. **CAMPOS ESCRITOS UNO A UNO**, igual que el
  // tipo: si esto aceptara la fila entera, añadir un campo a la clasificación
  // publicaría un dato nuevo sin que nadie lo decidiera.
  if (r.uid) datosDeFila.set(r.uid, {
    uid: r.uid,
    username: r.username ?? 'Operativo',
    score: r.score ?? 0,
    totalClicks: r.totalClicks ?? 0,
    achievements: r.achievements ?? 0,
    secretAchievements: r.secretAchievements ?? 0,
    forgedCount: r.forgedCount ?? 0,
    cores: r.cores ?? 0,
    danoFinal: r.danoFinal ?? 0,
    danoArma: r.danoArma ?? 0,
    title: r.title,
    frame: frameId,
    banner: bannerId
  });
  const valor = boardValue(r, kind);
  const unidades = unidadesDe(kind);
  // **F83 · EL DAÑO FINAL EN LA FILA, Y AL APOYAR EL PARTIDO.** Sale de los campos
  // que el dueño publica en su fila (`danoFinal`/`danoArma`), no de una cuenta de
  // aquí: la fila no puede recalcular bonos ajenos sin leer su tarjeta, y cuarenta
  // lecturas por vista es cuota que no hay. Sin campos no hay cifra —una fila vieja
  // enseña lo mismo que antes—. Es el sostenido, sin temporales: un x2 caducado en
  // una foto no es un número que nadie pegue, y el detalle lo dice.
  const danoFila = Number(r.danoFinal) || 0;
  const armaFila = Number(r.danoArma) || 0;
  const detalleDano = danoFila > 0
    ? `Del arma +${formatNumber(armaFila)} · De la partida +${formatNumber(Math.max(0, danoFila - armaFila))} · sin buffs temporales`
    : '';

  // **EL BANNER DE FONDO DE LA FILA ENTERA, Y POR QUÉ ES UNA CAPA SUELTA.**
  //
  // El avatar ya lleva el banner como halo, y con eso el cosmético se ve: pero en el
  // ranking una fila es una tira larga y el halo solo ocupa 32 px de ella. Puesto detrás
  // de toda la tira, el banner es lo que se ve al llegar a la pantalla: es el color del
  // jugador en la tabla, y sin él las filas son todas el mismo rectángulo.
  //
  // **Es una capa aparte y no un `background` en la fila** por dos razones. Una: la fila
  // ya tiene su fondo —y `is-me` tiene el suyo, acento al 12 %— y escribir el banner
  // encima lo borraría. Dos: el contenido de la fila está en una rejilla de cuatro
  // columnas, y meter el fondo en el mismo elemento obliga a envolver todo en un div para
  // poder poner el relleno debajo, lo que parte la rejilla en dos. Con la capa suelta, el
  // fondo **no ocupa columna**: es `position: absolute` y la rejilla ni lo ve.
  //
  // Y el relleno sale de `rellenoDeBanner()`, que deja la forma para la fila. Un banner
  // circular de fondo en una tira de 700×80 no es un banner: es un disco recortado.
  const banner = bannerId ? COSMETICS_BY_ID[bannerId] : undefined;

  return `
    <div class="rank-row ${isMe ? `is-me` : ``} ${r.uid ? `cursor-pointer hover:bg-white/5 transition` : `opacity-80`}"
         data-ver="${esc(r.uid ?? '')}" title="Ver la tarjeta de ${esc(r.username ?? 'Operativo')}">
      ${banner && banner.id !== 'banner_none' ? `
        <span class="rank-banner" aria-hidden="true" style="${rellenoDeBanner(banner)}"></span>` : ''}
      <div class="rank-pos" data-tier="${i + 1 <= 3 ? i + 1 : ''}">${i + 1}</div>

      ${miniIdentity(r.username, { title: r.title, frame: frameId, banner: bannerId })}

      <div class="min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap mt-1">
          ${isMe ? `<span class="medal accent-text flex-shrink-0">TÚ</span>` : ''}
          ${r.achievements ? `<span class="medal text-amber-400">${ic('achievement', 'w-3 h-3')} ${r.achievements}</span>` : ''}
          ${r.secretAchievements ? `<span class="medal text-fuchsia-300" title="Logros secretos">${ic('lock', 'w-3 h-3')} ${r.secretAchievements}</span>` : ''}
          ${r.forgedCount ? `<span class="medal text-cyan-300" title="Recolectores forjados">${ic('anvil', 'w-3 h-3')} ${r.forgedCount}</span>` : ''}
          ${r.cores ? `<span class="medal text-emerald-300" title="Núcleos ganados ascendiendo">${ic('recycle', 'w-3 h-3')} ${r.cores}</span>` : ''}
        </div>
        ${danoFila > 0 ? `<div class="mt-1 text-[10px] font-mono tabular" title="${detalleDano}">
          <span class="text-[var(--text-muted)]">Daño</span>
          <span class="accent-text font-bold">+${formatNumber(danoFila)}</span>
        </div>` : ''}
      </div>

      <div class="text-right flex-shrink-0">
        <div class="font-['Orbitron'] font-bold text-[13px] accent-text tabular">${formatNumber(valor)}</div>
        <div class="text-[9px] font-mono text-[var(--text-muted)]">${unidades}</div>
      </div>
    </div>
  `;
}

/**
 * F104 · EL PUNTO DE PRESENCIA SE HA IDO, Y CON ÉL ESTA FUNCIÓN.
 *
 * Decía "en línea" con un latido que ya nadie escribe: sin escritora, todas
 * las filas salían "offline" para siempre y el punto era un adorno que mentía
 * por omisión. La fila enseña lo jugado (producción, clics, logros, núcleos),
 * que es lo que el ranking sí sabe.
 */

/** Qué se mide en la tabla activa, para ponerlo bajo el número. */
function unidadesDe(kind: BoardKind): string {
  switch (kind) {
    case 'nanitas': return 'nanitas';
    case 'clics': return 'clics';
    case 'logros': return 'puntos de logro';
    case 'nucleos': return 'núcleos ganados';
    case 'definitivo': return '◆ puntos';
  }
}

/**
 * Explicación del peso de cada cosa.
 *
 * F29 · **Ahora no explica los pesos, y es a propósito.** Este texto era la
 * otra mitad de F29: la pestaña "Definitivo" decía, debajo de la tabla, que un
 * logro público vale 50.000, uno secreto 250.000 y cada forja 20.000. Con esa
 * tabla a la vista, quien la lee sabe exactamente qué parte de su puntuación es
 * mashable —y en cuanto F19 deje regalar logros, regalar uno de 250.000 se
 * convierte en la jugada más rentable del juego.
 *
 * Lo que se explica ahora es **qué mide la tabla, no cuánto pesa cada parte**:
 * suficiente para entender la columna, sin dar la receta para optimizarla. Es el
 * mismo criterio de la ficha de la caja, que enseña **qué** es un premio y no
 * cuánto costó.
 */
function nota(kind: BoardKind): string {
  if (kind !== 'definitivo') return '';
  return `
    <p class="text-[9px] text-[var(--text-muted)] text-center mt-3 leading-relaxed px-2">
      Esta tabla resume lo que has juntado: potencia, tiempo jugado, lo que has
      explorado y cuántos núcleos has sacado ascendiendo.
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