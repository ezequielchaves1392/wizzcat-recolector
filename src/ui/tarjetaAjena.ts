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
import { avatarStack, rellenoDeBanner, titleStyleFor } from './identity';
import { COSMETICS_BY_ID } from '../data/cosmetics';
import { ACHIEVEMENTS } from '../achievements';
// **LAS MISMAS FICHAS QUE PINTA LA PANTALLA DE INICIO.** No una versión parecida: las
// mismas funciones. La ficha pública enseña recolectores y compañeros como los ves en
// tu casa, y eso solo se sostiene si las dos pantallas llaman al mismo código.
import { fichaDeRecolector, casillaDeCompanero } from './fichas';
import { TREE_CATEGORY_META } from '../data/tree';
import { rarityClass } from '../components/crateLoot';
import { leerTarjeta, registrarVisita } from '../services/profileService';
import { tarjetaDesdeRanking, type DatosDeRanking } from '../data/perfilParcial';
import { type TarjetaPublica } from '../data/profile';
import { sfx } from '../utils/audio';

/** El uid del jugador que está mirando, para no contarse a sí mismo. */
let miUid = '';

/**
 * El nombre de cada logro, por id.
 *
 * **POR QUÉ HAY QUE BUSCARLO Y POR QUÉ NO SE PINTAN LOS IDS.** La tarjeta lleva ids
 * porque es lo que sabe el documento, y un id en una lista sin nombres es una lista de
 * `first_click` que el jugador tiene que ir a buscar. El nombre sale del catálogo, que ya
 * está en memoria.
 *
 * **Y UN ID QUE NO ESTÁ EN EL CATÁLOGO SE SALTA, NO SE MUESTRA.** La tarjeta es un
 * documento de la nube: puede traer ids de una versión anterior del juego, o de uno
 * eliminado. Pintarlo sería enseñar una fila sin nombre, que es peor que no pintarla.
 */
const LOGRO_POR_ID: Record<string, string> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, a.title])
);
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
  deEjemplo?: TarjetaPublica,
  /** Lo que el ranking ya sabe de este jugador, si lo sabe. */
  delRanking?: DatosDeRanking
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

  void carga(uid, nombre, cuerpo, overlay, deEjemplo, delRanking);
}

async function carga(
  uid: string,
  nombre: string,
  cuerpo: HTMLElement,
  overlay: HTMLElement,
  deEjemplo?: TarjetaPublica,
  delRanking?: DatosDeRanking
): Promise<void> {
  // Con la tarjeta del preview no hay ni red ni espera: se pinta directamente.
  // Con la tarjeta del preview no hay ni red ni espera: se pinta directamente.
  if (deEjemplo) {
    sfx.nav();
    cuerpo.innerHTML = cuerpoDeTarjeta(deEjemplo);
    overlay.scrollTop = 0;
    return;
  }

  const lectura = await leerTarjeta(uid);

  if (!lectura.ok) {
    // **LO QUE SÍ SABEMOS SE ENSEÑA, Y POR QUÉ.** El ranking ya tiene de este jugador
    // lo que el juego publica de todos: cuánto ha producido, sus clics, sus logros, sus
    // núcleos, su título y su banner. **Eso es una ficha, aunque sea la mitad.** Pintar un
    // hueco cuando al lado tenemos media partida del jugador es tirar datos que ya
    // tenemos, y el jugador lo lee como "este jugador no ha jugado" cuando en realidad
    // sí, y lo que no ha publicado es su colección.
    //
    // **Y LOS DOS MOTIVOS SE DICEN DISTINTOS**, porque obligan a hacer cosas distintas:
    // con las reglas sin publicar no hay nada que hacer hasta que las publiques, y en
    // cuanto a su próxima guardado aparecerá entero. Con un corte de red, reintentar.
    if (delRanking) {
      sfx.nav();
      cuerpo.innerHTML = cuerpoDeTarjeta(tarjetaDesdeRanking(delRanking, uid, nombre, lectura.motivo));
      overlay.scrollTop = 0;
      return;
    }
    cuerpo.innerHTML = pantallaDeVacio(nombre, lectura.motivo);
    return;
  }

  // El contador va **después** de pintar, para que abrir un perfil no espere a una
  // escritura. Y solo si no es el tuyo: eso ya está dentro de la función.
  window.setTimeout(() => { void registrarVisita(uid, miUid); }, 400);

  sfx.nav();
  cuerpo.innerHTML = cuerpoDeTarjeta(lectura.tarjeta);
  overlay.scrollTop = 0;
}

/** El cuerpo entero de la tarjeta. */
function cuerpoDeTarjeta(t: TarjetaPublica): string {
  const banner = t.cosmetics.banner ? COSMETICS_BY_ID[t.cosmetics.banner] : undefined;

  // **UNA SOLA SECCIÓN, "LO QUE TIENE PUESTO".** Antes eran dos —recolectores y
  // compañeros— con el mismo nombre, y el mismo nombre en los dos es una señal de que la
  // separación no aportaba nada: es una persona con un recolector y tres compañeros.
  const puesto = [
    t.completa === false ? '' : bloqueDeRecolectores(t),
    t.completa === false ? '' : bloqueDeCompaneros(t),
    t.completa === false ? '' : bloqueDeLogros(t)
  ];

  return `
    ${bannerDeTarjeta(t, banner)}

    ${t.completa === false ? avisoDeFichaParcial(String(t.motivo ?? 'no-existe')) : ''}

    ${cifrasDeTarjeta(t)}

    ${seccion('Lo que tiene puesto', 'core', puesto)}

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
        ${avatarStack(
          (t.username || '?').trim().slice(0, 2).toUpperCase(),
          { frame: t.cosmetics.frame, banner: t.cosmetics.banner },
          'w-10 h-10',
          'text-[13px]'
        )}
        <div class="min-w-0">
          <div class="font-['Orbitron'] font-bold text-sm truncate">${esc(t.username)}</div>
          ${tituloDeTarjeta(t)}
        </div>
      </div>
    </div>`;
}

/**
 * EL TÍTULO, TRADUCIDO, Y POR QUÉ ESTA FUNCIÓN EXISTE.
 *
 * **ANTES SALÍA EL ID CRUDO, DEBAJO DEL NOMBRE BUENO.** La cabecera usaba
 * `miniIdentity()`, que ya traduce el título desde el catálogo y lo pinta con su color y su
 * fuente, y luego añadía su propia línea con `t.cosmetics.title`. O sea que el mismo dato
 * salía dos veces: "Recluta" y `title_recruited`, uno al lado del otro.
 *
 * **Y EL NOMBRE TAMBIÉN SALÍA DOS VECES**, porque `miniIdentity` pinta el nombre dentro de su
 * columna y la cabecera repetía `t.username` al lado. En la captura se leía "Blanqui
 * Blanqui".
 *
 * La causa es que la cabecera quiere una composición que la fila del ranking no quiere: aquí
 * el nombre va grande y el título debajo, y allí van los dos en una columna estrecha. Por eso
 * la cabecera usa `avatarStack()` —que solo es el avatar con su marco— y compone el nombre y
 * el título por su cuenta, en vez de pedirle a `miniIdentity` una cosa que no es la suya.
 *
 * **EL TÍTULO POR DEFECTO NO SE ENSEÑA.** Es "Sin título", y al lado del nombre es ruido:
 * no dice nada de la persona. Es la misma regla que ya aplica `miniIdentity` en la cabecera,
 * escrita otra vez porque aquí no se está usando `miniIdentity`.
 *
 * **Y SI EL ID NO ESTÁ EN EL CATÁLOGO, NO SE PINTA NADA.** Un título desconocido es un dato
 * que no se puede leer; enseñarlo en crudo es peor que no enseñarlo, que es justo lo que
 * pasaba.
 */
function tituloDeTarjeta(t: TarjetaPublica): string {
  const titulo = t.cosmetics.title ? COSMETICS_BY_ID[t.cosmetics.title] : undefined;
  if (!titulo || titulo.id === 'title_default') return '';
  return `<div class="title-display text-[11px] truncate" style="${titleStyleFor(titulo)}">${esc(titulo.name)}</div>`;
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
  // **EN UNA FICHA A MEDIAS SOLO SE ENSEÑAN LAS CIFRAS QUE EL RANKING SABE.** Las otras
  // no son cero: son desconocidas. Poner un 0 donde no se sabe es afirmar algo falso
  // —"ha ascended 0 veces"— y en una pantalla comparativa esa es exactamente la clase
  // de mentira que hace que la comparación no sirva.
  const parcial = t.completa === false;
  const cifras: [string, number, string][] = [
    ['Nanitas producidas', t.nanitasProducidas, 'text-amber-400'],
    ['Clics', t.totalClicks, 'text-cyan-400']
  ];
  if (!parcial) {
    cifras.push(['Ascensiones', t.resets, 'text-emerald-400']);
  }
  cifras.push(['Forjadas', t.forjadas, 'text-rose-400']);
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
  // EN UNA FICHA A MEDIAS NO SE PINTA: no es que no tenga, es que no lo ha publicado.
  if (t.completa === false) return '';
  if (t.recolectores.length === 0) return vacio('collector', 'No tiene ningún recolector equipado');
  const maxTier = t.recolectores[0].tier;
  const mostrados = t.recolectores.length;
  return `
    ${subtitulo('Recolector', '')}
    <div class="flex flex-col gap-2">
      ${t.recolectores.map(r => `
        <div class="rounded-xl border border-[var(--border-color)] p-2.5">
          ${fichaDeRecolector(r, {
            etiqueta: 'Potencial',
            valor: r.potential ? `P${r.potential}` : '--',
            title: 'Las estrellas con las que salió; suben su techo de nivel'
          })}
        </div>`).join('')}
    </div>`;
}

function bloqueDeCompaneros(t: TarjetaPublica): string {
  if (t.completa === false) return '';
  if (t.companeros.length === 0) return '';
  return `
    ${subtitulo('Compañeros', '')}
    <div class="grid grid-cols-3 gap-2">
      ${t.companeros.map(c => `
        <div class="relative">
          ${casillaDeCompanero(c)}
        </div>`).join('')}
    </div>
    <div class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
      La cifra es el valor del compañero sin los multiplicadores de su partida, que no
      se pueden conocer desde fuera.
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
  if (t.completa === false) return '';
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
  if (t.completa === false) return '';
  const conNombre = t.logros
    .map(id => ({ id, titulo: LOGRO_POR_ID[id] }))
    .filter(x => !!x.titulo);
  if (conNombre.length === 0) return vacio('achievement', 'Sin logros publicados');
  return `
    ${subtitulo('Logros', '')}
    <div class="flex flex-wrap gap-1.5">
      ${conNombre.map(x => `
        <span class="medal text-amber-400 gap-1" title="${esc(x.titulo)}">
          ${ic('achievement', 'w-3 h-3')} ${esc(x.titulo)}
        </span>`).join('')}
    </div>`;
}

/** El pie: el contador de visitas y cuándo se publicó. */
function pieDeTarjeta(t: TarjetaPublica): string {
  // **EN UNA FICHA A MEDIAS NO HAY CONTADOR NI FECHA, Y NO SE PONEN A CERO.** No los
  // sabemos: no hay documento del que sacarlos. Un "sin fecha" colgado al lado de
  // "todavía no te ha mirado nadie" parece un dato y es un hueco.
  if (t.completa === false) {
    return `<div class="pt-1 border-t border-[var(--border-color)]"></div>`;
  }
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
        ${t.updatedAt ? fechaDeTarjeta(t.updatedAt) : 'sin fecha'}
      </span>
    </div>`;
}

// --------------------------------------------------------------------------
//  Piezas
// --------------------------------------------------------------------------

/**
 * EL AVISO DE "ESTA ES LA MITAD", Y POR QUÉ NO ES UN ERROR.
 *
 * La ficha se ha construido con lo que el ranking ya sabía, así que hay una cosa que
 * el jugador tiene que entender: **que no es que este jugador no tenga nada, es que no
 * ha publicado la colección.** Sin este aviso, una ficha con cuatro cifras y sin
 * recolectores parece una ficha de alguien que no juega, y el jugador se lleva una
 * conclusión falsa de la persona que está mirando.
 *
 * Y el texto del motivo **cambia con el motivo**, porque lo que hay que hacer cambia:
 * con las reglas sin publicar, aparece entero en su próximo guardado; con un corte de
 * red, lo que hay que rehacer es la conexión.
 */
function avisoDeFichaParcial(motivo: string): string {
  // **TRES MOTIVOS Y TRES TEXTOS, Y EL TERCERO ES NUEVO.**
  //
  // `error` y `permiso` salían antes como lo mismo, y el texto era uno solo: "aparecerá en
  // cuanto vuelva la conexión". Con un permiso denegado eso es **falso y manda a la fuente
  // equivocada**: la conexión está bien y no hay nada que reconectar. Lo que hay es que las
  // reglas de Firestore sin publicar, y eso no lo arregla apagar el wifi.
  //
  // El jugador que lo ve no puede hacer nada con el aviso, y encima se le hace creer que es
  // un problema suyo de red. Un mensaje que dice una cosa que no es verdad no es un mensaje
  // mal escrito: es tiempo perdido y una idea falsa sobre lo que está pasando.
  const texto = motivo === 'permiso'
    ? 'Su ficha existe pero este juego no tiene permiso para leerla. Es un problema de las'
      + ' reglas de la base de datos, no de su conexión: por eso no se arregla reconectando.'
      + ' Su colección aparecerá cuando se publiquen.'
    : motivo === 'error'
      ? 'No se ha podido leer su ficha de la nube, así que solo se enseña lo que el ranking'
        + ' ya sabe de él. Su colección aparecerá en cuanto vuelva la conexión.'
      : 'Esta es la mitad de su ficha: lo que el juego publica de todo el mundo. Su'
        + ' colección —recolectores, compañeros y pasivas— aparece en cuanto su juego guarde'
        + ' otra vez.';
  return `
    <div class="rounded-xl border border-dashed border-[var(--border-color)] p-3
                flex items-start gap-2">
      <span class="text-amber-400 mt-0.5">${ic('eye')}</span>
      <span class="text-[11px] text-[var(--text-muted)] leading-relaxed">${texto}</span>
    </div>`;
}

/**
 * LO QUE SE VE CUANDO NO HAY TARJETA **Y TAMPOCO FILA DE RANKING**.
 *
 * O sea: alguien a quien no está en la clasificación y no publica nada. Dos motivos,
 * dos textos, y ninguno dice "error" cuando el juego está bien.
 */
function pantallaDeVacio(nombre: string, motivo: string): string {
  const titulo = motivo === 'error' || motivo === 'permiso'
    ? 'No se ha podido leer esa ficha'
    : 'Todavía no hay ficha pública';
  // El permiso tiene su propio texto, y por lo mismo que en `avisoDeFichaParcial`: un corte
  // de conexión se arregla reconectando, y un permiso denegado no.
  const texto = motivo === 'permiso'
    ? 'Este juego no tiene permiso para leer las fichas. No es un problema de conexión:'
      + ' las reglas de la base de datos sin publicar.'
    : motivo === 'error'
      ? 'Puede ser un corte de conexión o que las reglas de la base de datos no estén'
        + ' publicadas. Si es lo segundo, el perfil aparecerá en cuanto su juego guarde.'
      : 'En cuanto su juego guarde una vez, aquí habrá su ficha con su colección y sus'
        + ' números.';
  return `
    <div class="flex flex-col items-center gap-3 py-8 text-center">
      <span class="text-[var(--text-muted)]">${ic('user', 'w-8 h-8')}</span>
      <div class="text-xs text-[var(--text-main)]">${esc(nombre)} — ${titulo}</div>
      <div class="text-xs text-[var(--text-muted)] leading-relaxed">${texto}</div>
    </div>`;
}


/**
 * LA MARCA DE "PUESTO", Y POR QUÉ ES UNA PALABRA Y NO UN ICONO.
 *
 * Un icono se lee como decoración y una palabra no. Aquí lo que se dice es "este es el que
 * tienes puesto", y eso es **una diferencia entre dos objetos de la misma lista** —que es
 * información, no adorno—. Con un icono el jugador tiene que adivinar qué significa y
 * cuáles de los cinco hay en esa pantalla.
 *
 * Y sale en la fila **y en el subtítulo**, con la cuenta: "6 · 1 puesto" es mejor que
 * tener que contar a mano cuántos hay marcados.
 */

/** El "(1 puesto)" del subtítulo, o nada si no hay ninguno. */
/**
 * El subtítulo de cada bloque: qué tiene puesto y cuántos.
 *
 * **UNA SOLA PALABRA, "PUESTO", EN LOS DOS.** Decir "colección" en un sitio y "puesto"
 * en el otro haría que el lector se preguntara si lo que falta es algo que tiene o algo
 * que no enseña.
 */
function equipadosDe<T extends { equipado?: boolean }>(lista: T[], sustantivo: string): string {
  const n = lista.filter(x => x.equipado).length;
  if (n === 0) return 'nada';
  return `${n} ${sustantivo}${n > 1 ? 's' : ''}`;
}


/**
 * LA FECHA DE LA FICHA, Y POR QUÉ NO SALE UN NÚMERO DEL JUEGO.
 *
 * Estaba con `formatNumber()`, que es el formato de las cifras del juego: "1.750 T" es
 * un millón y medio de nanitas, y puesto junto a un contador de visitas parece un dato de
 * juego donde lo que se quiere decir es "hace dos días". Aquí se dice lo segundo.
 */
function fechaDeTarjeta(cuando: number): string {
  if (!cuando) return 'sin fecha';
  const dias = Math.floor((Date.now() - cuando) / 86_400_000);
  if (dias <= 0) return 'actualizado hoy';
  if (dias === 1) return 'actualizado ayer';
  if (dias < 30) return `actualizado hace ${dias} días`;
  return 'actualizado hace más de un mes';
}


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