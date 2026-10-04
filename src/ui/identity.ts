// ==========================================================================
//  Identidad mínima: avatar con marco + nombre + título
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

import { COSMETICS_BY_ID, cosmeticStyle } from '../data/cosmetics';
import type { Cosmetic } from '../types/domain';

export interface IdentityCosmetics {
  title?: string;
  frame?: string;
  banner?: string;
}

/** El color del título: su estilo, el degradado y el brillo. */
export function titleStyleFor(title: Cosmetic | undefined): string {
  if (!title) return '';
  return [
    cosmeticStyle(title),
    title.style.gradient ? 'background-clip:text;-webkit-background-clip:text;color:transparent' : '',
    title.style.glow === 'true' ? 'text-shadow:0 0 16px currentColor' : ''
  ].filter(Boolean).join(';');
}

/**
 * EL AVATAR CON MARCO Y BANNER, Y POR QUÉ ESTÁ EN UN SOLO SITIO.
 *
 * ## EL PROBLEMA QUE ESTE FICHERO RESUELVE
 *
 * El avatar se pintaba en tres sitios —la cabecera, las filas del ranking y la tarjeta
 * del perfil— y cada uno tenía su copia del markup. Con dos copias del marco, el marco
 * llega a una y no a la otra; y con tres, las tres se separan el día que alguien toca el
 * tamaño. Aquí está **una vez**, y los tres la llaman.
 *
 * ## POR QUÉ EL BANNER NO ERA UN BANNER
 *
 * Era `rounded-full` con `scale(1.9)` y `opacity:.5`: **un círculo pálido detrás del
 * avatar**. Con un patrón de rejilla o de degradado, a la mitad de opacidad y escalado,
 * eso no se lee: se ve un halo que podría ser cualquier cosa. Un banner tiene que
 * **verse**, y para eso son tres cosas y las tres importan:
 *
 * · **Opacidad de 0,8 y no 0,5.** A la mitad, el patrón se mezcla con el fondo y solo
 *   queda el color medio, que es justo lo que no distingue un banner de otro.
 * · **El banner manda su propia forma.** Antes la clase `rounded-full` estaba en el
 *   marcado y el estilo del cosmético no podía cambiarlo: todos los fondos salían
 *   circulares aunque el catálogoiera rectos. Ahora el radio sale del estilo, así que un
 *   banner puede ser una placa o un círculo según lo que sea.
 * · **El marco también.** Por el mismo motivo: `glassBase` forzaba `9999px` en los siete
 *   marcos, y por eso **todos se veían iguales**: un anillo. Los que ahora tienen
 *   esquinas, cortes o doble aro dicen algo al mirarlos de reojo.
 *
 * Y el marco va **encima del núcleo** y el banner **detrás**, que es el orden correcto:
 * el banner es el fondo del retrato y el marco es el borde.
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

  return `
    <div class="avatar-stack ${dims} flex-shrink-0" aria-hidden="true">
      ${hayBanner ? `
        <span class="avatar-frame w-full h-full"
              style="${bannerStyle(banner)}"></span>` : ''}
      <span class="avatar-core w-[78%] h-[78%] ${glyphClass}">${initials}</span>
      ${hayMarco ? `
        <span class="avatar-frame w-full h-full"
              style="${frameStyle(frame)}"></span>` : ''}
    </div>`;
}

/**
 * El estilo del banner: **el del catálogo, más lo que hace falta para que se vea.**
 *
 * El `scale` y la opacidad no están en el catálogo y **no deben estar**: son la misma
 * cuenta en los tres sitios, y si cada uno los escribiera a su mano acabarian medidos por separado y volverían a no cuadrar. Lo único que sale del catálogo es la
 * forma y el relleno, que es lo que hace que un banner sea distinto de otro.
 */
function bannerStyle(banner: Cosmetic): string {
  const propio = cosmeticStyle(banner);
  const esCircular = /border-radius:\s*9999px/.test(propio);
  return [
    'position:absolute',
    'inset:0',
    `transform:scale(${esCircular ? 1.7 : 1.32})`,
    'opacity:.8',
    esCircular ? 'border-radius:9999px' : 'border-radius:1.25rem',
    propio
  ].join(';');
}

/** El estilo del marco. Idem: la forma viene del catálogo y no de la clase. */
function frameStyle(frame: Cosmetic): string {
  const propio = cosmeticStyle(frame);
  // **EL RADIO SALE DEL CATÁLOGO CUANDO EL MARCO LO TRAE, Y SI NO, CIRCULAR.** Los
  // siete marcos historicamente eran anillos; los nuevos dicen su forma con un radio
  // propio y asi se distinguen de un vistazo. La comprobacion es sobre el mapa de estilos
  // y no sobre el nombre, para que un marco futuro no necesite cambiar este sitio.
  const radio = frame.style.borderRadius ? String(frame.style.borderRadius) : '9999px';
  return ['position:absolute', 'inset:0', `border-radius:${radio}`, propio].join(';');
}

/**
 * Avatar de 32 px con marco y halo del banner, nombre y título.
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
