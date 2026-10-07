// ==========================================================================
//  Identidad: avatar (banner de fondo + icono de perfil) + nombre + título
//
//  Una sola fuente para los sitios que enseñan quién eres en pequeño: la
//  cabecera (F16) y las filas del ranking (F8). Antes cada una pintaba su
//  versión a mano, y por eso el marco llegó a una y no a la otra. El Perfil
//  usa `identityCard()`, más grande, para la tarjeta completa.
//
//  El estilo del título vive aquí (`titleStyleFor`) y el Perfil lo reutiliza:
//  el degradado con texto transparente y el brillo son la misma regla en los
//  dos tamaños, y con dos copias se separan en cuanto se toca una.
// ==========================================================================

import { ic } from './icons';
import { COSMETICS_BY_ID, cosmeticStyle } from '../data/cosmetics';
import { iconoDeCosmetico, ICONO_BASE } from '../data/avatarIcons';
import type { Cosmetic } from '../types/domain';

export interface IdentityCosmetics {
  title?: string;
  frame?: string;
  banner?: string;
}

/** El color del título: su estilo, el degradado y el brillo. */
export function titleStyleFor(title: Cosmetic | undefined): string {
  if (!title) return '';
  // **EL DEGRADADO NECESITA UN FONDO, Y ESTA ES LA LÍNEA QUE FALTABA.** Con
  // `background-clip:text` y `color:transparent` pero sin `background-image`,
  // el texto no se ve en ningún sitio: cinco títulos equipados (Mil Millones
  // entre ellos) no aparecían ni en el perfil ni en el ranking ni en la tarjeta
  // ajena, aunque la carta los enseñaba en plano porque ese camino nunca ponía
  // el transparente. La bandera `gradient` es la única fuente: si trae un
  // degradado se usa, y si trae `'true'` el brillo sale del propio color.
  const grad = title.style.gradient;
  const fondo = !grad
    ? ''
    : /gradient\s*\(/.test(grad)
      ? `background-image:${grad}`
      : `background-image:linear-gradient(90deg,${title.style.color},#ffffff,${title.style.color})`;
  return [
    cosmeticStyle(title),
    fondo,
    grad ? 'background-clip:text;-webkit-background-clip:text;color:transparent' : '',
    title.style.glow === 'true' ? 'text-shadow:0 0 16px currentColor' : ''
  ].filter(Boolean).join(';');
}

/**
 * EL AVATAR: BANNER DE FONDO E ICONO DE PERFIL, Y POR QUÉ SON DOS COSAS.
 *
 * ## EL PROBLEMA QUE ESTE FICHERO RESUELVE
 *
 * El avatar se pintaba en tres sitios —la cabecera, las filas del ranking y la tarjeta
 * del perfil— y cada uno tenía su copia del markup. Con dos copias del marco, el marco
 * llega a una y no a la otra; y con tres, las tres se separan el día que alguien toca el
 * tamaño. Aquí está **una vez**, y los tres la llaman.
 *
 * ## BANNER Y MARCO SON DOS COSAS, Y ANTES NO LO ERAN
 *
 * El banner era el fondo pero además elegía el icono central, y el marco era un aro
 * alrededor. Así, cambiar de fondo **cambiaba de cara**, y lo que el jugador tenía
 * equipado como marco no se veía como un icono: se veía como un borde.
 *
 * Ahora son independientes y cada uno dice lo suyo:
 *
 * · **El banner es el fondo.** Llena el avatar entero, por detrás de todo, con su
 *   relleno y su forma. No aporta icono. Un fondo no es una cara.
 * · **El marco es el icono de perfil.** Un emblema centrado con **su propio fondo, su
 *   propio icono y su propio estilo**: es la cara del jugador, y se enseña tal cual,
 *   sin que el banner la tiña. El icono sale de `avatarIcons` por el id del marco.
 *
 * Y por eso el icono central ya no toma el color del banner (`iconColor` pasó a ser del
 * marco): un icono que cambia con el fondo no es la cara de nadie.
 *
 * ## LO QUE NO HAY AQUÍ
 *
 * El envoltorio que recortaba el banner se ha ido con el halo. El banner ya no se
 * escala: rellena la caja y punto. Un fondo escalado era la forma de fingir un halo que
 * nunca llegó a leerse.
 */
export function avatarStack(
  initials: string,
  cosmetics: IdentityCosmetics | undefined,
  dims: string,
  glyphClass: string
): string {
  const frame = cosmetics?.frame ? COSMETICS_BY_ID[cosmetics.frame] : undefined;
  const banner = cosmetics?.banner ? COSMETICS_BY_ID[cosmetics.banner] : undefined;
  const hayBanner = !!banner && banner.id !== 'banner_none';
  const hayMarco = !!frame && frame.id !== 'frame_none';
  // `initials` llega aquí y **no se usa**, y eso es lo que hay que dejar escrito: la
  // firma lo conserva para no romper las cinco llamadas —cada una tenía su forma de
  // llamarla—, pero dentro ya no se lee. Cuando se quiten las llamadas se puede quitar
  // el parámetro; hasta entonces, dejar un argumento muerto es peor que un comentario
  // que explica por qué sigue ahí.
  const icono = iconoDeCosmetico(cosmetics);

  // El emblema del marco: su propia forma y su propio relleno. Sin marco, un emblema
  // neutro con el chip de base. Es la cara del jugador, y sale del marco, no del fondo.
  const emblem = hayMarco ? frame : undefined;
  const colorIcono = emblem?.iconColor;
  const estiloEmblema = emblem
    ? ['position:relative', cosmeticStyle(emblem)].join(';')
    : 'position:relative';

  return `
    <div class="avatar-stack ${dims} flex-shrink-0 av-efecto-${icono.efecto}" aria-hidden="true">
      ${hayBanner ? `
        <span class="avatar-fondo" aria-hidden="true">
          <span class="avatar-banner" style="${bannerStyle(banner)}"></span>
        </span>` : ''}
      <span class="avatar-emblem ${glyphClass}" style="${estiloEmblema}">
        <span class="avatar-emblem-glyph"${colorIcono ? ` style="color:${colorIcono}"` : ''}>${
          ic(hayMarco ? icono.icono : ICONO_BASE.icono, 'w-full h-full')
        }</span>
      </span>
    </div>`;
}

/**
 * El estilo del banner: **el fondo del avatar, y solo eso.**
 *
 * No lleva borde ni forma propia más allá del radio de la caja: el banner es el fondo, y
 * un fondo con un aro encima deja de ser un fondo. La forma la pone `.avatar-fondo`, que
 * es quien recorta para que el banner no se salga de las esquinas redondeadas.
 *
 * Y **no gira.** El "Espectro" llevaba `animation: frameSpectrum`, que es un
 * `transform: rotate`, y girar un cuadrado de fondo se ve como un cuadrado girando: el
 * jugador lo describió como que el banner "a veces se ve girando". Un fondo no rota; si
 * necesita movimiento, lo tiene con `background-position` o un cambio de tono, que no
 * mueven la caja.
 */
function bannerStyle(banner: Cosmetic): string {
  const propio = cosmeticStyle(banner);
  return ['position:absolute', 'inset:0', 'opacity:1', propio].filter(Boolean).join(';');
}

/**
 * El relleno de un banner para ponerlo **de fondo de algo que no es el avatar**.
 *
 * ## POR QUÉ ES UNA FUNCIÓN Y NO EL ESTILO DEL CATÁLOGO TAL CUAL
 *
 * `cosmeticStyle()` trae geometría y relleno. En el avatar esa geometría no aplica al
 * fondo —lo pone la caja—, pero de fondo en una fila del ranking la geometría correcta es
 * **la de la fila**.
 *
 * `border-radius: inherit` va **al final a propósito** y no es un descuido: el estilo del
 * catálogo va en el atributo `style`, y en un `style` en línea manda **la última
 * declaración de la misma propiedad**, no el `!important` de una hoja. Ponerlo detrás no
 * la reemplazaría.
 *
 * Y por qué importa: un banner circular de fondo en una fila de 700×80 no es un banner,
 * es un disco recortado a una franja. La forma la pone la fila.
 */
export function rellenoDeBanner(banner: Cosmetic): string {
  return `${cosmeticStyle(banner)};border-radius:inherit`;
}

/**
 * Avatar de 32 px con icono de perfil, nombre y título.
 *
 * El título por defecto ("Sin título") se enseña o no según `hideDefaultTitle`:
 * en el ranking sale lo equipado tal cual, y en la cabecera se esconde porque
 * es ruido al lado del nombre.
 */
export function miniIdentity(
  name: string,
  cosmetics: IdentityCosmetics | undefined,
  opts: {
    hideDefaultTitle?: boolean;
    avatarClass?: string;
    glyphClass?: string;
    nameClass?: string;
    titleClass?: string;
  } = {}
): string {
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();
  const title = cosmetics?.title ? COSMETICS_BY_ID[cosmetics.title] : undefined;
  const showTitle = !!title && (!opts.hideDefaultTitle || title.id !== 'title_default');

  return `
    <div class="flex items-center gap-2 min-w-0">
      ${avatarStack(initials, cosmetics, opts.avatarClass ?? 'w-8 h-8', opts.glyphClass ?? 'text-[11px]')}
      <div class="min-w-0">
        <div class="${opts.nameClass ?? 'text-[12px] font-bold text-[var(--text-main)]'} truncate">${name}</div>
        ${showTitle ? `<div class="title-display ${opts.titleClass ?? 'text-[9px]'} truncate" style="${titleStyleFor(title)}">${title!.name}</div>` : ''}
      </div>
    </div>
  `;
}
