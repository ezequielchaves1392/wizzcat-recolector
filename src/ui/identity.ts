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

import { ic } from './icons';
import { COSMETICS_BY_ID, cosmeticStyle } from '../data/cosmetics';
import { iconoDeCosmetico } from '../data/avatarIcons';
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
  // **EL ICONO SALE DEL COSMÉTICO, Y SI NO HAY NINGUNO EL DE BASE.**
  //
  // `initials` llega aquí y **no se usa**, y eso es lo que hay que dejar escrito: la
  // firma lo conserva para no romper las cinco llamadas —cada una tenía su forma de
  // llamarla—, pero dentro ya no se lee. Cuando se quiten las llamadas se puede quitar
  // el parámetro; hasta entonces, dejar un argumento muerto es peor que un comentario
  // que explica por qué sigue ahí.
  const icono = iconoDeCosmetico(cosmetics);

  return `
    <div class="avatar-stack ${dims} flex-shrink-0 av-efecto-${icono.efecto}" aria-hidden="true">
      ${hayBanner ? `
        <!--
          F54 · EL ENVOLTORIO QUE RECORTA EL BANNER, Y SOLO ÉL.

          Sigue haciendo falta por lo mismo que antes: el avatar-stack NO recorta,
          y el marco se pinta centrado en el borde. Lo que cambia es lo que hay
          dentro: el banner ya **no es un aro**, es el fondo. Antes iba escalado
          a 1,32 detrás de un núcleo con su propio degradado, así que de él solo
          se veía un halo y el fondo de verdad era el degradado. Ahora rellena la
          caja y el núcleo es transparente.

          Por eso el envoltorio se llama avatar-fondo y no avatar-halo: el nombre
          era la pista de lo que había antes.
        -->
        <span class="avatar-fondo">
          <span class="avatar-frame w-full h-full" style="${bannerStyle(banner)}"></span>
        </span>` : ''}
      <span class="avatar-core w-[78%] h-[78%] ${glyphClass}" ${banner?.iconColor ? `style="color:${banner.iconColor}"` : ''}>
        <span class="[&>span>svg]:w-full [&>span>svg]:h-full">${ic(icono.icono)}</span>
      </span>
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
 *
 * **EL BORDE DEL BANNER VIENE DE SU `frameStyle`** (si lo tiene), no de un radio
 * hardcoded. Cada banner declara su forma en `frameStyle.borderRadius` y su borde
 * en `frameStyle.border`/`background`/`boxShadow`. Así un banner puede ser placa,
 * círculo, o tener un borde de gradiente animado (p.ej. Espectro).
 */
function bannerStyle(banner: Cosmetic): string {
  const propio = cosmeticStyle(banner);
  // El radio del banner: si tiene frameStyle con borderRadius, úsalo; si no, placa.
  const radio = banner.frameStyle?.borderRadius ?? '1.25rem';
  // El borde/sombra del banner: si tiene frameStyle, aplícalo al fondo (no como capa aparte).
  const borde = banner.frameStyle
    ? Object.entries(banner.frameStyle)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
        .join(';')
    : '';
  return [
    'position:absolute',
    'inset:0',
    'opacity:1',
    `border-radius:${radio}`,
    propio,
    borde
  ].filter(Boolean).join(';');
}

/** El estilo del marco. Idem: la forma viene del catálogo y no de la clase. */
function frameStyle(frame: Cosmetic): string {
  const propio = cosmeticStyle(frame);
  // **EL RADIO SALE DEL CATÁLOGO CUANDO EL MARCO LO TRAE, Y SI NO, UNO DE PLACA.**
  //
  // El if que había antes devolvía 9999px cuando el marco no decía su forma, y eso
  // convertía **cualquier marco antiguo o futuro sin radio propio en un anillo**. El
  // valor por defecto tiene que ser la forma de la caja, no la contraria: un marco sin
  // radio propio que sale redondo se lleva por delante la separación entre "marco de
  // placa" y "marco de anillo".
  const radio = frame.style.borderRadius ? String(frame.style.borderRadius) : '1.25rem';
  return ['position:absolute', 'inset:0', `border-radius:${radio}`, propio].join(';');
}

/**
 * El relleno de un banner para ponerlo **de fondo de algo que no es el avatar**.
 *
 * ## POR QUÉ ES UNA FUNCIÓN Y NO EL ESTILO DEL CATÁLOGO TAL CUAL
 *
 * `cosmeticStyle()` trae **geometría y relleno**: el radio es parte de la identidad del
 * cosmético. En el avatar esa geometría es lo que hace que un marco tenga esquinas o sea
 * un anillo. De fondo en una fila del ranking, la geometría correcta es **la de la fila**.
 *
 * `border-radius: inherit` va **al final a propósito** y no es un descuido: el estilo del
 * catálogo va en el atributo `style`, y en un `style` en línea manda **la última
 * declaración de la misma propiedad**, no el `!important` de una hoja. Ponerlo detrás no
 * la reemplazaría.
 *
 * Y por qué importa: un banner circular (`border-radius: 9999px`) de fondo en una fila de
 * 700×80 no es un banner, es un disco recortado a una franja. La forma la pone la fila.
 *
 * La opacidad y la posición **no** vienen aquí: son del sitio que lo pinta, porque el
 * avatar y la fila los necesitan distintos. Lo único que sale del catálogo es lo único que
 * es del cosmético: el relleno.
 */
export function rellenoDeBanner(banner: Cosmetic): string {
  return `${cosmeticStyle(banner)};border-radius:inherit`;
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
