// ==========================================================================
//  La tarjeta de otro jugador, montada como hoja encima del ranking
// ==========================================================================
//
//  ## POR QUÉ UNA HOJA Y NO UNA RUTA
//
//  Porque se llega aquí **tocando un nombre en la tabla**, y el contexto es la tabla:
//  cierras y sigues viendo por dónde ibas. Con una ruta nueva habría que tocar el
//  enrutador, el botón de atrás y la barra, para algo que se abre y se cierra.
//
//  ## LO QUE SE VE Y EN QUÉ ORDEN
//
//  El orden es el de las preguntas que uno se hace al mirar a otro:
//  **quién es** (identidad y título) → **qué ha hecho** (sus números) → **qué tiene**
//  (recolectores, compañeros, nodos) → **qué ha conseguido** (logros). Ese orden es el
//  que se lee de arriba abajo sin un plan.
//
//  ## Y NADA DE ESTO CALCULA NÚMEROS QUE NO TIENE
//
//  La tarjeta enseña lo que el dueño publicó: el tier y el nivel de un recolector, el
//  poder guardado de un compañero. **No enseña "su daño por clic"**, porque eso sale de
//  los multiplicadores de su árbol y de qué compañeros tiene, que es estado suyo que la
//  tarjeta no lleva. Preferimos no enseñar una cifra a inventar una: en una pantalla
//  comparativa, un número inventado es peor que un hueco, porque el hueco se ve.
//
//  ## UN CONTADOR DE VISITAS, Y POR QUÉ NO CUENTA AL DUEÑO
//
//  Es lo que se pidió, y el que mira se cuenta **una vez por persona**: está en
//  `registrarVisita()`, que se niega a contar al dueño antes de hacer nada. Aquí solo se
//  pinta lo que venga.

import { ic, type IconName } from './icons';
import { esc } from '../utils/esc';
import { formatNumber } from '../utils/format';
import { miniIdentity, rellenoDeBanner } from './identity';
import { COSMETICS_BY_ID } from '../data/cosmetics';
import { TREE_CATEGORY_META } from '../data/tree';
import { rarityClass } from '../components/crateLoot';
import { leerTarjeta, registrarVisita } from '../services/profileService';
import { type TarjetaPublica } from '../data/profile';
import { sfx } from '../utils/audio';

/** El uid del jugador que está mirando, para no contarse a sí mismo. */
let miUid = '';
export function ponMiUid(uid: string): void { miUid = uid || ''; }

/**
 * Abre la tarjeta de un jugador.
 *
 * **SIEMPRE DEVUELVE UNA HOJA, INCLUIDO CUANDO NO HAY NADA.** Un perfil que no se puede
 * leer tiene que decir "no hay nada", no dejar el ranking intacto sin decir por qué: si
 * además la apertura falló porque las reglas no están publicadas, el jugador necesita
 * verlo, porque de lo contrario parece que el juego está roto.
 */
/**
 * Abre la tarjeta de un jugador.
 *
 * **`deEjemplo` es el seam del preview, y existe por una razón concreta.** La hoja real
 * pide el documento a Firestore, así que sin reglas publicadas —o sin red— lo único que
 * se puede ver es el estado de "todavía no tiene tarjeta", que es correcto y es lo único
 * que se vería. Con esa pantalla como única vista, **nadie habría visto nunca cómo se ve
 * una tarjeta con contenido**: si un jugador con cuarenta recolectores rompe la rejilla,
 * o si una etiqueta se pisa con un nombre largo, eso no se descubre jugando.
 *
 * Pasa la tarjeta ya construida y no se pide nada: ni red, ni espera, ni esqueleto.
 */
export function abreTarjetaDe(
  uid: string,
  nombre: string,
  deEjemplo?: TarjetaPublica
): void {
  if (!uid) return;
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[70] flex items-start justify-center';
  overlay.style.cssText = 'background: rgb(0 0 0 / 0.72); backdrop-filter: blur(6px); padding: 3vh 1rem;';
  overlay.innerHTML = `
    <div class="tarjeta-hoja card-glass-elevated border rounded-2xl w-full max-w-lg flex flex-col
                max-h-[88vh] overflow-hidden animate-rise-in" role="dialog" aria-modal="true"
                aria-label="Perfil de ${esc(nombre)}">
      <div class="flex items-center gap-3 p-4 border-b border-[var(--border-color)]">
        <div class="min-w-0 flex-1">
          <div class="label-caps text-[var(--text-muted)]">Perfil de</div>
          <div class="font-['Orbitron'] font-bold text-sm truncate">${esc(nombre)}</div>
        </div>
        <button data-cerrar aria-label="Cerrar"
                class="w-8 h-8 grid place-items-center rounded-lg text-[var(--text-muted)]
                       hover:text-[var(--text-main)] hover:bg-white/10 transition cursor-pointer">
          ${ic('close', 'w-4 h-4')}
        </button>
      </div>
      <div data-cuerpo class="p-4 flex flex-col gap-4 overflow-y-auto min-h-0"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const cuerpo = overlay.querySelector('[data-cuerpo]') as HTMLElement;
  cuerpo.innerHTML = `
    <div class="flex items-center gap-3 justify-center py-6">
      <span class="w-6 h-6 rounded-full border-2 border-[var(--border-color)] border-t-accent animate-spin"></span>
      <span class="text-[11px] font-mono text-[var(--text-muted)]">Cargando perfil...</span>
    </div>`;

  const cerrar = () => {
    document.removeEventListener('keydown', alPulsar);
    overlay.remove();
  };
  const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', alPulsar);
  overlay.querySelector('[data-cerrar]')?.addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  void carga(uid, nombre, cuerpo, overlay, deEjemplo);
}

async function carga(
  uid: string,
  nombre: string,
  cuerpo: HTMLElement,
  overlay: HTMLElement,
  deEjemplo?: TarjetaPublica
): Promise<void> {
  // Con la tarjeta del preview no hay ni red ni espera: se pinta directamente.
  const tarjeta = deEjemplo ?? (await leerTarjeta(uid));

  if (!tarjeta) {
    // **NADA DE ESTO ES UN ERROR DE PANTALLA, ES UNA RESPUESTA.** Y el texto lo dice,
    // porque hay dos motivos muy distintos: que el jugador no haya publicado tarjeta
    // todavía, o que no se pueda leer. Enseñar "no se ha podido cargar" para el segundo
    // sería mentir: sí se ha podido, lo que no hay es nada.
    cuerpo.innerHTML = `
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <span class="text-[var(--text-muted)]">${ic('user', 'w-8 h-8')}</span>
        <div class="text-xs text-[var(--text-muted)] leading-relaxed">
          ${esc(nombre)} todavía no tiene tarjeta pública.<br>
          Aparece en cuanto su juego guarde una vez.
        </div>
      </div>`;
    return;
  }

  // El contador va **después** de pintar, para que abrir un perfil no espere a una
  // escritura. Y solo si no es el tuyo: eso ya está dentro de la función.
  if (!deEjemplo) window.setTimeout(() => { void registrarVisita(uid, miUid); }, 400);

  sfx.nav();
  cuerpo.innerHTML = cuerpoDeTarjeta(tarjeta);
  overlay.scrollTop = 0;
}

/** El cuerpo entero de la tarjeta. */
function cuerpoDeTarjeta(t: TarjetaPublica): string {
  const banner = t.cosmetics.banner ? COSMETICS_BY_ID[t.cosmetics.banner] : undefined;
  const total = Math.max(1, t.recolectores.length + (t.recolectores.length < 24 ? 0 : 0));

  return `
    ${bannerDeTarjeta(t, banner)}

    ${cifrasDeTarjeta(t)}

    ${seccion('Colección', 'collector', [
      bloqueDeRecolectores(t),
      bloqueDeCompaneros(t),
      bloqueDeNodos(t)
    ])}

    ${seccion('Logros', 'achievement', [bloqueDeLogros(t)])}

    ${pieDeTarjeta(t)}
  `;
}

/**
 * LA CABECERA, Y POR QUÉ EL BANNER VA DETRÁS Y NO EN UNA CASILLA.
 *
 * Un banner es una franja de 700×80: si se pone en una caja, sale estirado y con una
 * forma que no es la suya. Va como capa de fondo —`position: absolute`— y el contenido
 * va encima, que es lo mismo que hace la fila del ranking y por eso se lee igual.
 */
function bannerDeTarjeta(t: TarjetaPublica, banner: any): string {
  return `
    <div class="relative overflow-hidden rounded-xl border border-[var(--border-color)]">
      ${banner ? `<span class="absolute inset-0" aria-hidden="true" style="${rellenoDeBanner(banner)}"></span>` : ''}
      <div class="relative flex items-center gap-3 p-3"
           style="background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--bg-app) 85%, transparent))">
        ${miniIdentity(t.username, {
          title: t.cosmetics.title,
          frame: t.cosmetics.frame,
          banner: t.cosmetics.banner
        })}
        <div class="min-w-0">
          <div class="font-['Orbitron'] font-bold text-sm truncate">${esc(t.username)}</div>
          ${t.cosmetics.title ? `<div class="text-[11px] font-mono accent-text truncate">${esc(t.cosmetics.title)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

/**
 * LAS CIFRAS GRANDES, Y POR QUÉ SON CUATRO Y NO DIEZ.
 *
 * Las cuatro que se preguntan de cualquier partida: cuánto ha producido, cuánto ha
 * clickado, cuántas veces ha reiniciado y qué ha forjado. El resto de números
 * —el total de logros, los nodos, las cajas— están en sus secciones, donde tienen
 * contexto, y no en una rejilla de dieciocifras que nadie lee entera.
 */
function cifrasDeTarjeta(t: TarjetaPublica): string {
  const cifras: [string, number, string][] = [
    ['Nanitas producidas', t.nanitasProducidas, 'text-amber-400'],
    ['Clics', t.totalClicks, 'text-cyan-400'],
    ['Ascensiones', t.resets, 'text-emerald-400'],
    ['Forjadas', t.forjadas, 'text-rose-400']
  ];
  return `
    <div class="grid grid-cols-2 gap-2">
      ${cifras.map(([etiqueta, valor, tono]) => `
        <div class="rounded-xl border border-[var(--border-color)] px-3 py-2">
          <div class="text-[10px] font-mono text-[var(--text-muted)]">${etiqueta}</div>
          <div class="font-['Orbitron'] font-bold text-base ${tono} tabular-nums">
            ${formatNumber(valor)}
          </div>
        </div>`).join('')}
    </div>
    <div class="flex flex-wrap gap-1.5">
      ${medalla('Núcleos', t.totalCores, 'recycle', 'text-emerald-300')}
      ${medalla('Logros', t.totalLogros, 'achievement', 'text-amber-400')}
      ${medalla('Cajas abiertas', t.cajasAbiertas, 'crate', 'text-purple-300')}
    </div>`;
}

/** Los bloques de la colección, y el "y N más" cuando la tarjeta se ha recortado. */
function bloqueDeRecolectores(t: TarjetaPublica): string {
  if (t.recolectores.length === 0) return vacio('collector', 'Sin recolectores todavía');
  const maxTier = t.recolectores[0].tier;
  const mostrados = t.recolectores.length;
  return `
    ${subtitulo('Recolectores', `${mostrados}${maxTier ? ` · mejor T${maxTier}` : ''}`)}
    <div class="flex flex-col gap-1">
      ${t.recolectores.map(r => `
        <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)]">
          <span class="text-[11px] font-mono font-bold w-9 flex-shrink-0">T${r.tier}</span>
          <span class="text-[11px] min-w-0 flex-1 truncate ${rarityClass(r.rarity)}">${esc(r.name)}</span>
          <span class="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
            nv ${r.level}${r.maxLevel ? `/${r.maxLevel}` : ''}
          </span>
          ${r.potential ? `<span class="text-[10px] font-mono text-fuchsia-300 flex-shrink-0" title="Potencial">P${r.potential}</span>` : ''}
        </div>`).join('')}
    </div>`;
}

function bloqueDeCompaneros(t: TarjetaPublica): string {
  if (t.companeros.length === 0) return '';
  return `
    ${subtitulo('Compañeros', String(t.companeros.length))}
    <div class="flex flex-col gap-1">
      ${t.companeros.map(c => `
        <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border-color)]">
          <span class="text-[11px] font-mono font-bold w-9 flex-shrink-0">T${c.tier}</span>
          <span class="text-[11px] min-w-0 flex-1 truncate ${rarityClass(c.rarity)}">${esc(c.name)}</span>
          ${c.power ? `<span class="text-[10px] font-mono text-cyan-300 flex-shrink-0">+${formatNumber(c.power)}/s</span>` : ''}
        </div>`).join('')}
    </div>`;
}

/**
 * LOS NODOS PAGADOS, Y POR QUÉ SE AGRUPAN POR CATEGORÍA.
 *
 * Cuarenta nodos en una lista de cuarenta líneas son ruido. Agrupados por lo que
 * hacen —multiplicadores, automatización, economía, crafteo, exclusivos— se leen como
 * "en qué ha invertido", que es lo que un jugador que compite quiere saber de otro. Y el
 * detalle del nodo concreto **no se publica**: son cuatrocientas líneas sobre cómo ha
 * repartido sus núcleos, que es su dato.
 */
function bloqueDeNodos(t: TarjetaPublica): string {
  if (t.nodosComprados === 0) return vacio('tree', 'Sin nodos comprados');
  const porCategoria = new Map<string, { nombres: string[]; niveles: number }>();
  for (const n of t.nodos) {
    const prev = porCategoria.get(n.categoria) ?? { nombres: [], niveles: 0 };
    prev.nombres.push(`${n.name} ${n.nivel}/${n.maxLevel}`);
    prev.niveles += n.nivel;
    porCategoria.set(n.categoria, prev);
  }
  return `
    ${subtitulo('Pasivas pagadas', `${t.nodosComprados}/${t.nodosTotales} nodos · ${t.nivelesDeArbol} niveles`)}
    <div class="flex flex-col gap-1">
      ${[...porCategoria.entries()].map(([cat, d]) => {
        const meta = TREE_CATEGORY_META[cat];
        return `
        <div class="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)]">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono uppercase tracking-wider ${meta?.color ?? ''}">
              ${meta?.label ?? esc(cat)}
            </span>
            <span class="text-[10px] font-mono text-[var(--text-muted)] ml-auto">${d.niveles} niv.</span>
          </div>
          <div class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 leading-relaxed">
            ${esc(d.nombres.join(' · '))}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/**
 * LOS LOGROS, EN SU ICONO Y CON SU NOMBRE.
 *
 * Los secretos **no están en la tarjeta** (los quita `tarjetaDesdeEstado`), y el total
 * que se enseña arriba es el de todos, no el de los publicados: si no, se sabría que a
 * alguien le faltan dos secretos sin llegar a saber cuáles.
 */
function bloqueDeLogros(t: TarjetaPublica): string {
  if (t.logros.length === 0) return vacio('achievement', 'Sin logros publicados');
  return `
    <div class="flex flex-wrap gap-1.5">
      ${t.logros.map(id => {
        // Un id que no exista en el catálogo no es un error: la tarjeta es un documento
        // de la nube y puede traer ids de una versión anterior del juego. Se salta.
        return `
        <span class="medal text-amber-400" title="${esc(id)}">
          ${ic('achievement', 'w-3 h-3')} ${esc(id)}
        </span>`;
      }).join('')}
    </div>`;
}

/** El pie: el contador de visitas y cuándo se publicó. */
function pieDeTarjeta(t: TarjetaPublica): string {
  const visitas = t.visitantes.length;
  const texto = visitas === 0
    ? 'Todavía no te ha mirado nadie'
    : visitas === 1
      ? 'Te ha mirado 1 persona'
      : `Te han mirado ${visitas} personas`;
  return `
    <div class="flex items-center justify-between gap-3 pt-1 border-t border-[var(--border-color)]">
      <span class="text-[10px] font-mono text-[var(--text-muted)]">
        ${ic('user', 'w-3 h-3 inline align-[-2px]')} ${texto}
      </span>
      <span class="text-[10px] font-mono text-[var(--text-muted)]">
        ${t.updatedAt ? `actualizado ${formatNumber(t.updatedAt)}` : 'sin fecha'}
      </span>
    </div>`;
}

// --------------------------------------------------------------------------
//  Piezas
// --------------------------------------------------------------------------

function seccion(titulo: string, icono: IconName, bloques: string[]): string {
  const conAlgo = bloques.filter(b => b.trim().length > 0);
  if (conAlgo.length === 0) return '';
  return `
    <div class="flex flex-col gap-2">
      <div class="label-caps accent-text flex items-center gap-1.5">
        <span class="inline-flex">${ic(icono)}</span> ${titulo}
      </div>
      ${conAlgo.join('')}
    </div>`;
}

function subtitulo(titulo: string, meta: string): string {
  return `
    <div class="flex items-baseline gap-2 mt-1">
      <span class="text-[11px] font-mono text-[var(--text-main)]">${titulo}</span>
      <span class="text-[10px] font-mono text-[var(--text-muted)]">${meta}</span>
    </div>`;
}

function vacio(icono: IconName, texto: string): string {
  return `
    <div class="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-[var(--border-color)]">
      <span class="text-[var(--text-muted)]">${ic(icono)}</span>
      <span class="text-[11px] text-[var(--text-muted)]">${texto}</span>
    </div>`;
}

function medalla(etiqueta: string, valor: number, icono: IconName, tono: string): string {
  if (!valor) return '';
  return `
    <span class="medal ${tono}">
      ${ic(icono, 'w-3 h-3')} ${etiqueta}: ${formatNumber(valor)}
    </span>`;
}